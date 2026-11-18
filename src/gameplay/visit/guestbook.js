// M21-P4 친구 섬 구경 — 남기기(방명록 도장 · 고른 문장 편지 · 선물 하나) · 받기(우편함 배달 · 방명록) · 숨기기 · 알리기 · 방문 도장 보상.
// 보드 wave17 반영 v1: D283-A (고른 문장만, 숨기기·알리기) · D284-A (남의 섬·글은 덮어쓰지 못함) · D286-A (도장·편지·선물 하나, 하루 세 섬) · D287-A (기념 가구 넷).
// 구경 중인 섬은 M21-P3 의 visit.trip?.() (→ 섬 문서 { code, user, snap, hide? } | null). 없으면 남기기는 조용히 쉰다.
// 저장 state.visit 에 더하는 칸 (없으면 만든다): left · stamps · rewards · got · inbox · hide · trips · seen
// 노트 docs/notes/m21-p4-guestbook.md.
import * as R from './rules.js';
import { openPost } from './post.js';
import { buildReport, sendReport } from '../../ui/report.js';
import { createFriendsUI } from './ui.js';

export const LINES_FILE = 'assets/visit/lines.json';
const INBOX_KEEP = 80;
const GOT_KEEP = 400;
const REACH = 1.9;
const OFFICE = { name: '섬 우체국', island: '' };

const WHY = {
  'day-full': `오늘은 친구 섬 ${R.LEAVE_ISLANDS_PER_DAY}곳에 벌써 남겼어요. 내일 또 와요.`,
  same: '이 섬에는 오늘 벌써 남겼어요.',
  'no-store': '이 창에서는 친구 섬에 남길 수 없어요.',
  'not-owner': '다른 사람의 글 자리라 쓸 수 없어요.',
  'not-own-path': '다른 사람의 글 자리라 쓸 수 없어요.',
};
export const leaveWhy = why => WHY[why] ?? '지금은 남기지 못했어요.';

export function createGuestbook(ctx, visit) {
  const S = () => ctx.services;
  const V = () => {
    const v = (ctx.state.visit ||= {});
    for (const k of ['stamps', 'rewards', 'got', 'inbox', 'hide']) if (!Array.isArray(v[k])) v[k] = [];
    v.trips = Number(v.trips) || 0;
    v.seen ||= {};
    return v;
  };
  V();
  const dayKey = () => S().time?.now?.().dayKey ?? S().data?.day?.key?.() ?? '';
  let lines = { stamps: [], letters: [] };
  const linesReady = (ctx.assets?.loadJSON ? ctx.assets.loadJSON(LINES_FILE) : fetch(LINES_FILE).then(r => r.json()))
    .then(j => { lines = { stamps: j?.stamps ?? [], letters: j?.letters ?? [] }; }, e => console.warn('[visit] 문장 표를 못 읽음', e));
  const stampOf = id => lines.stamps.find(s => s.id === id);
  const letterOf = id => lines.letters.find(l => l.id === id);
  const lineOk = (kind, id) => (kind === 'stamp' ? !!stampOf(id) : !!letterOf(id));

  // ---------- 저장소 (visit 서비스가 uid 를 정한 뒤 연다) ----------
  let post = null, opening = null;
  async function store() {
    if (post) return post;
    if (!visit.uid || !visit.kind) return null;
    opening ||= openPost({ uid: visit.uid, kind: visit.kind }).catch(() => null).finally(() => { opening = null; });
    post = await opening;
    return post;
  }

  const trip = () => { try { return visit.trip?.() ?? null; } catch { return null; } };
  const me = () => ({ name: String(ctx.state.player?.name ?? '').slice(0, 20), island: String(ctx.state.island?.name ?? '').slice(0, 20), ...(R.isCode(V().code) ? { code: V().code } : {}) });
  const tripName = t => ({ name: String(t?.snap?.player?.name ?? '').slice(0, 20), island: String(t?.snap?.island?.name ?? '').slice(0, 20) });
  let noteN = 0;
  const noteId = () => `n${Date.now().toString(36)}${(noteN++ % 36).toString(36)}`;

  /** 지금 구경 중인 섬에 kind 를 남길 수 있나 → { ok, why? } */
  function can(kind, t = trip()) {
    if (!t?.code) return { ok: false, why: 'no-trip' };
    if (!visit.available) return { ok: false, why: 'no-store' };
    return R.canLeave(V().left, dayKey(), t.code, kind);
  }

  /** 남기기 → { ok, why? }. kind = stamp | letter | gift, line = 문장·도장 id, item = 선물 아이템 id */
  async function leave(kind, { line, item = null } = {}) {
    const t = trip();
    const c = can(kind, t);
    if (!c.ok) return c;
    await linesReady;
    if (!lineOk(kind, line)) return { ok: false, why: 'bad' };
    const st = await store();
    if (!st) return { ok: false, why: 'no-store' };
    const day = dayKey();
    const note = { id: noteId(), to: t.code, kind, line, ...(kind === 'gift' ? { item } : {}), day, at: Date.now() };
    try {
      const doc = R.addNote(await st.mine(), { uid: st.uid, from: me(), note, now: Date.now() });
      const res = await st.putMine(doc);
      if (!res?.ok) return { ok: false, why: res?.why ?? 'error' };
    } catch (e) { console.warn('[visit] 남기기 실패', e); return { ok: false, why: 'error' }; }
    const v = V();
    v.left = R.recordLeave(v.left, day, t.code, kind);
    const p = S().player?.position;
    if (kind === 'stamp') {
      const first = !v.seen.stamp;
      v.seen.stamp = true;
      const newIsland = !v.stamps.some(s => s.code === t.code);
      if (newIsland) v.stamps.push({ code: t.code, ...tripName(t), stamp: line, day });
      ctx.events.emit('visit:stamp', { code: t.code, stamp: line, first, newIsland, count: v.stamps.length, x: p?.x, z: p?.z });
      giveRewards();
    } else ctx.events.emit('visit:left', { kind, code: t.code, line, item });
    return { ok: true };
  }

  /** 도장 찍은 섬 수가 1·3·5·10 이 되면 기념 가구를 우편함으로 (D287-A) */
  function giveRewards() {
    const v = V();
    for (const r of R.stampRewardsDue(v.stamps.length, v.rewards)) {
      if (!S().data?.items?.get?.(r.item)) continue;
      const sent = S().town?.mail?.friend?.({ from: OFFICE, lines: [`(친구 섬 방문 도장 ${r.n}곳 기념 선물이 왔다.)`, '구경 다니느라 수고 많았어요!'], gift: r.item });
      if (sent) v.rewards.push(r.item);   // 우편함이 없으면(town 없음) 다음 도장 때 다시
    }
  }

  /** 받은 글 다시 읽기 → 새로 온 편지·선물은 우편함으로 (하루 한 번 + 섬폰 열 때) → 받은 목록 */
  let pulling = null;
  async function pull() {
    if (pulling) return pulling;
    pulling = (async () => {
      const v = V();
      if (!R.isCode(v.code)) return v.inbox;
      const st = await store();
      if (!st) return v.inbox;
      await linesReady;
      let docs = [];
      try { docs = await st.all(); } catch (e) { console.warn('[visit] 받은 글 읽기 실패', e); return v.inbox; }
      const list = R.inbox(docs, v.code, { hide: v.hide, mine: st.uid, lineOk });
      const got = new Set(v.got);
      for (const n of list.slice().reverse()) {   // 오래된 것부터 배달
        if (got.has(n.key)) continue;
        got.add(n.key);
        v.got.push(n.key);
        if (n.kind === 'stamp' || n.hidden) continue;
        const gift = n.kind === 'gift' && giftOk(n.item) ? n.item : null;
        const text = letterOf(n.line)?.text ?? '';
        const letter = S().town?.mail?.friend?.({ from: n.from, lines: [text, `— ${n.from.name || '친구'}${n.from.island ? ` (${n.from.island})` : ''}`], gift });
        if (letter === undefined) { v.got.pop(); got.delete(n.key); continue; }   // 우편함이 아직 없음 → 다음에
        const first = !v.seen.letter;
        v.seen.letter = true;
        ctx.events.emit('visit:letter', { kind: n.kind, first, from: n.from });
      }
      if (v.got.length > GOT_KEEP) v.got.splice(0, v.got.length - GOT_KEEP);
      v.inbox = list.slice(0, INBOX_KEEP).map(({ key, writer, kind, line, item, day, at, from }) => ({ key, writer, kind, line, item, day, at, from }));
      ctx.events.emit('visit:inbox', { count: v.inbox.length });
      return v.inbox;
    })().finally(() => { pulling = null; });
    return pulling;
  }
  /** 받아도 되는 선물인가 (있는 아이템 · 도구·가품 아님) */
  function giftOk(id) {
    const it = id && S().data?.items?.get?.(id);
    return !!it && it.category !== 'tool' && !String(id).endsWith('-fake');
  }

  /** 섬 주인 숨기기 (내 섬 문서 hide — 남의 글은 건드리지 않음) → 켜져 있으면 바로 다시 올림 */
  async function hide(key, on = true) {
    const v = V();
    v.hide = R.toggleHide(v.hide, key, on);
    ctx.events.emit('visit:inbox', { count: v.inbox.length });
    if (visit.status?.().share) await visit.upload?.();
    return { ok: true };
  }
  const isHidden = key => V().hide.includes(key);

  /** 알리기 → 게임 저장소 reports 에 kind:'visit' (문제 알리기와 같은 모양) + 숨기기 */
  async function report(entry) {
    const base = buildReport(ctx, { kind: 'other', text: describe(entry), withInfo: false });
    const doc = { ...base, kind: 'visit', visit: { key: entry.key, writer: entry.writer, to: V().code, kind: entry.kind, line: entry.line, item: entry.item ?? null, from: entry.from ?? null } };
    const res = await sendReport(doc).catch(() => ({ ok: false }));
    await hide(entry.key, true);
    return res;
  }
  /** 글 하나 → 화면 글 */
  function describe(n) {
    const who = `${n.from?.name || '친구'}${n.from?.island ? ` (${n.from.island})` : ''}`;
    if (n.kind === 'stamp') return `${stampOf(n.line)?.icon ?? '🔖'} ${who} · ${stampOf(n.line)?.label ?? '도장'}`;
    const t = letterOf(n.line)?.text ?? '';
    if (n.kind === 'gift') return `🎁 ${who} · ${S().data?.items?.get?.(n.item)?.name ?? '선물'} — ${t}`;
    return `✉️ ${who} · ${t}`;
  }

  // ---------- 구경 섬 받침 PR-45 Space (구경 중에만) ----------
  function standNear() {
    if (!trip()) return null;
    const p = S().player?.position, objs = S().world?.objects;
    if (!p || !objs?.list) return null;
    for (const kind of ['guestbook-stand', 'mailbox']) {
      for (const o of objs.list(kind) ?? []) if (Math.hypot(o.x - p.x, o.z - p.z) < REACH) return o;
    }
    return null;
  }
  async function atStand() {
    const t = trip();
    if (!t) return;
    const say = (l, choices) => S().ui.dialog.open({ speaker: '방명록', color: '#C9A27A', lines: [l].flat(), voice: '', choices });
    const n = tripName(t);
    const a = await say([`(${n.island || '친구 섬'}의 방명록이다.)`], ['도장 찍기', '편지 남기기', '선물 두기', '방명록 보기', '그만두기']);
    const toast = (text, icon = '🏝️') => S().ui?.toast?.(text, icon);
    const done = r => { if (!r.ok && r.why !== 'cancel') toast(leaveWhy(r.why)); return r; };
    if (a === 0) {
      const c = can('stamp', t); if (!c.ok) return done(c);
      await linesReady;
      const opts = lines.stamps.slice(0, 4);
      const k = await say(['(어떤 도장을 찍을까?)'], [...opts.map(s => `${s.icon} ${s.label}`), '그만두기']);
      if (k == null || k >= opts.length) return;
      const r = await leave('stamp', { line: opts[k].id });
      if (r.ok) { ctx.events.emit('sfx', { name: 'pickup', volume: 0.6 }); toast(`${n.island || '친구 섬'} 방명록에 ${opts[k].label}을 찍었어요`, opts[k].icon); }
      return done(r);
    }
    if (a === 1) {
      const c = can('letter', t); if (!c.ok) return done(c);
      await linesReady;
      const id = await S().ui?.friends?.pickLine?.({ title: '✉️ 편지 남기기', lines: lines.letters });
      if (!id) return;
      const r = await leave('letter', { line: id });
      if (r.ok) toast(`${n.name || '친구'}에게 편지를 남겼어요`, '✉️');
      return done(r);
    }
    if (a === 2) {
      const c = can('gift', t); if (!c.ok) return done(c);
      const data = S().data, ui = S().ui;
      const slot = await ui?.bag?.open?.({ mode: 'pick', title: '친구 섬에 둘 선물', hint: '하나만 둘 수 있어요 (도구는 못 둬요)', filter: x => !x.variant && giftOk(x.id) });
      const s = slot != null ? data?.inventory?.slots?.[slot] : null;
      if (!s || !giftOk(s.id)) return;
      const id = s.id;
      if (!(data.inventory.remove(slot, 1) > 0)) return;
      const r = await leave('gift', { line: 'gift', item: id });
      if (!r.ok) { data.collect?.(id, 1); return done(r); }   // 못 올렸으면 돌려준다
      toast(`${n.name || '친구'}의 우편함에 ${data.items.get(id)?.name ?? '선물'}을 넣었어요`, '🎁');
      return r;
    }
    if (a === 3) {
      const st = await store();
      const docs = st ? await st.all().catch(() => []) : [];
      await linesReady;
      const list = R.inbox(docs, t.code, { hide: t.hide ?? [], lineOk }).filter(x => x.kind === 'stamp' && !x.hidden).slice(0, 6);
      await say(list.length ? list.map(x => `${describe(x)} · ${x.day ?? ''}`) : ['(아직 도장이 없다. 첫 도장을 찍어 볼까?)']);
    }
  }

  /** 구경 시작 지켜보기 (P3 의 trip 이 null → 섬 문서로 바뀌면) — s70 첫 구경 */
  let lastTrip = null;
  function watch() {
    const t = trip(), code = t?.code ?? null;
    if (code === lastTrip) return;
    lastTrip = code;
    if (!code) return;
    const v = V();
    v.trips += 1;
    const p = S().player?.position;
    ctx.events.emit('visit:arrive-seen', { code, first: v.trips === 1, x: p?.x, z: p?.z });
  }

  return {
    lines: () => lines, linesReady, stampOf, letterOf, describe,
    can, leave, pull, hide, isHidden, report, giftOk,
    standNear, atStand, watch,
    /** UI-38 받은 것 (방명록 도장 · 편지·선물) — 숨긴 것도 hidden 표시로 */
    inbox: () => V().inbox.map(n => ({ ...n, hidden: isHidden(n.key) })),
    /** UI-40 내가 도장 찍은 섬들 */
    stamps: () => V().stamps.slice(),
    rewards: () => R.STAMP_REWARDS.map(r => ({ ...r, got: V().rewards.includes(r.item), name: S().data?.items?.get?.(r.item)?.name ?? r.item })),
    leftToday: () => R.leftToday(V().left, dayKey()),
  };
}

/**
 * visit/index.js 가 부르는 한 줄: 방명록을 만들고 행동 키 · 섬폰 창 · 이벤트를 단다 → gb.
 * 구경 시작은 visit.trip?.() 을 1초마다 본다 (P3 이벤트 이름에 기대지 않게).
 */
export async function attachGuestbook(ctx, visit) {
  const gb = createGuestbook(ctx, visit);
  visit.guestbook = gb;
  const S = () => ctx.services;
  S().gameplay?.interactions?.add?.({
    name: 'visit-guestbook', intent: 'action', priority: 93, label: '방명록',
    test: () => (S().ui?.isBlocking?.() ? null : gb.standNear()),
    run: () => gb.atStand(),
  });
  const ui = S().ui;
  if (ui?.panel && !ui.friends) {
    ui.friends = createFriendsUI(ctx, gb);
  }
  let pulledReady = false;
  ctx.events.on('visit:changed', st => { if (st?.ready && !pulledReady && visit.uid) { pulledReady = true; gb.pull(); } });
  ctx.events.on('data:newday', () => gb.pull());
  if (typeof setInterval === 'function') setInterval(() => gb.watch(), 1000);
  return gb;
}
