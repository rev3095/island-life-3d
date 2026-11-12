// 우편함: 친해진 주민이 아침마다 가끔 편지(와 선물)를 보낸다. 부탁을 들어주면 며칠 안에 고맙다는 편지.
// 플레이어 집 우편함 앞에서 행동 키로 읽는다. 상태는 state.mail = { list:[편지], day, nextId }.
import { planLetters, pickLines, villagerState, rngOf, fill, addFriendship, daysBetween } from './rules.js';
import { speaker, giveItem, context } from './talk.js';
import { PEOPLE, KEEPERS } from './people.js';
import { BOND, canSend, recordSent, planReplies, sentBox } from './bond.js';   // M15 내가 보내는 편지 · 답장
import { openLetter, sentToast } from '../../ui/letter.js';   // M15 UI-26 편지 쓰기 창

const KEEP = 30;              // 읽은 편지는 이만큼만 남긴다
const BOX = { name: '', color: '#C9A27A', voice: '' };

export function createMail(ctx, { lines, residents = null }) {
  const world = ctx.services.world;
  const box = () => {
    const m = (ctx.state.mail ??= {});
    if (!Array.isArray(m.list)) m.list = [];
    m.day ??= null;
    m.nextId ??= 1;
    return m;
  };
  // 플레이어 집 우편함 자리 (world 가 집 문 오른쪽에 놓는다)
  const spot = (() => {
    const o = world.objects.list?.('mailbox')?.find(m => m.data?.owner === 'player');
    if (o) return { x: o.x, z: o.z };
    const h = world.places.playerHouse;
    return h ? { x: h.door.x + 1, z: h.door.z } : null;
  })();
  const who = slug => PEOPLE[slug] ?? KEEPERS[slug];
  const itemName = id => ctx.services.data?.items?.get?.(id)?.name ?? id;

  /** 편지 한 통 넣기 (kind = 대사 묶음 letters 의 키). opts.pool = 주민 파일에 그 편지가 없을 때 쓸 묶음 (10차 이사·떠난 주민 편지) */
  function post(from, kind, gift = null, opts = {}) {
    const m = box();
    const pool = lines[from]?.letters?.[kind]?.length ? lines[from].letters[kind] : opts.pool;
    if (!pool?.length || !who(from)) return null;
    const picked = pickLines(pool, rngOf(m.nextId, from, kind)).map(l => (opts.vars ? fill(l, opts.vars) : l));   // M15 답장: {item} = 내가 넣은 선물 (배달할 때 채운다)
    const letter = { id: m.nextId++, from, kind, day: context(ctx).dayKey, lines: picked, gift, read: false, ...(opts.about ? { about: opts.about } : {}) };
    m.list.push(letter);
    while (m.list.length > KEEP) { const i = m.list.findIndex(l => l.read); if (i < 0) break; m.list.splice(i, 1); }
    ctx.events.emit('mail:new', { from, kind });
    return letter;
  }

  /** 그날 아침 편지 배달 (하루 한 번, 첫날 안내 뒤부터) → 넣은 수 */
  function deliver(dayKey = context(ctx).dayKey) {
    const m = box();
    if (!dayKey || m.day === dayKey) return 0;
    m.day = dayKey;
    if (!ctx.state.flags?.intro) return 0;
    let n = 0;
    // 10차: 섬에 사는 주민만 (이사 오기 전·떠난 주민의 편지는 moving.js 가 따로)
    const live = residents?.();
    const people = live ? Object.fromEntries(Object.entries(PEOPLE).filter(([s]) => live.includes(s))) : PEOPLE;
    for (const p of planLetters(ctx.state, people, dayKey)) {
      if (p.mark) villagerState(ctx.state, p.from).thankedDay = p.mark;
      if (post(p.from, p.kind, p.gift)) n++;
    }
    // M15: 내가 보낸 편지의 답장 (전날까지 보낸 것) — 친밀도는 답장이 올 때 오른다
    for (const r of planReplies(ctx.state, people, dayKey, id => ctx.services.data?.items?.get?.(id))) {
      r.rec.replied = dayKey;
      const v = villagerState(ctx.state, r.from);
      const up = addFriendship(v, r.points).up;
      if (up) v.letterUp = up;
      const pool = lines[r.from]?.letters?.[r.kind]?.length ? null : lines[r.from]?.letters?.reply ?? lines[r.from]?.letters?.thanks;
      if (post(r.from, r.kind, r.back, { pool, vars: { item: r.rec.gift ? itemName(r.rec.gift) : '선물' }, about: r.rec.text.slice(0, 24) })) n++;
    }
    // M15: 어제 같이 낚시·산책한 주민이 가끔 「어제 즐거웠어」 편지
    for (const slug of Object.keys(people)) {
      const t = ctx.state.villagers?.[slug]?.together;
      if (!t?.day || t.lettered === t.day || daysBetween(t.day, dayKey) !== 1) continue;
      t.lettered = t.day;
      if (rngOf(dayKey, slug, 'together-letter')() < BOND.together.letterNext && post(slug, 'together', null, { pool: lines[slug]?.letters?.friend })) n++;
    }
    return n;
  }

  /** M15 UI-26: 편지 쓰기 → 보냈으면 기록 (선물은 가방에서 뺀다) */
  async function write() {
    const c = context(ctx), st = ctx.state, d = ctx.services.data;
    const live = residents?.() ?? Object.keys(PEOPLE);
    const people = live.filter(s => PEOPLE[s] && villagerState(st, s).met).map(s => ({
      slug: s, name: PEOPLE[s].name, color: PEOPLE[s].color, sentToday: canSend(st, s, c.dayKey).why === 'same',
    }));
    const why = (to, text) => ({ day: `오늘은 편지를 ${BOND.letter.perDay}통 다 보냈어요`, same: '이 주민에게는 오늘 벌써 보냈어요', text: '편지 글을 적어 주세요' })[canSend(st, to, c.dayKey, text).why] ?? null;
    const res = await openLetter(ctx, { people, max: BOND.letter.maxText, why });
    if (!res?.to || !canSend(st, res.to, c.dayKey, res.text).ok) return null;
    let gift = null;
    if (res.slot != null) {
      const s = d?.inventory?.slots?.[res.slot];
      if (s && d.items.get(s.id)?.category !== 'tool' && d.inventory.remove(res.slot, 1) > 0) gift = s.id;
    }
    const rec = recordSent(st, { to: res.to, text: res.text, gift, dayKey: c.dayKey });
    ctx.events.emit('sfx', { name: 'pickup', volume: 0.6 });
    ctx.services.ui?.toast?.(sentToast(PEOPLE[res.to].name, gift ? itemName(gift) : null), '✉️');
    ctx.events.emit('mail:sent', { to: res.to, gift, id: rec.id });
    return rec;
  }
  /** 오늘 더 쓸 수 있나 (만난 주민이 있고 하루 몫이 남았을 때) */
  const canWrite = () => {
    const live = residents?.() ?? Object.keys(PEOPLE);
    const dayKey = context(ctx).dayKey;
    return live.some(s => PEOPLE[s] && villagerState(ctx.state, s).met && canSend(ctx.state, s, dayKey).ok);
  };
  /** 다 읽은 뒤 · 빈 우편함: 편지를 쓸까 묻기 */
  async function offerWrite(say, empty) {
    if (!canWrite()) { if (empty) await say(['(우편함이 비어 있다.)']); return; }
    const a = await say([empty ? '(우편함이 비어 있다. 편지를 써서 보낼까?)' : '(편지를 써서 보낼까?)'], ['편지 쓰기', '그만두기']);
    if (a === 0) await write();
  }

  const unread = () => box().list.filter(l => !l.read);

  /** 우편함 열기: 안 읽은 편지를 차례로 읽고 붙은 선물을 받는다 */
  async function read() {
    const list = unread();
    const say = speaker(ctx, BOX);
    ctx.events.emit('sfx', { name: 'bag-open', volume: 0.6 });
    if (!list.length) { await offerWrite(say, true); return; }
    await say([`(편지가 ${list.length}통 와 있다.)`]);
    let full = false;
    for (const l of list) {
      const P = who(l.from);
      const vars = { item: l.gift ? itemName(l.gift) : '' };
      const text = [...(l.about ? [`(내가 보낸 「${l.about}」 편지의 답장이다.)`] : []), ...l.lines];
      if (l.gift && !l.stub) text.push(...pickLines(lines[l.from]?.letters?.gift, Math.random), '(편지에 {item:이} 들어 있다!)');
      await speaker(ctx, { name: P ? `${P.name}의 편지` : '편지', color: P?.color ?? BOX.color, voice: '' }, vars)(text);
      l.read = true;
      if (!l.gift) continue;
      if (giveItem(ctx, l.gift) > 0) {
        // 가방이 꽉 찼으면 선물만 남은 쪽지로 남겨 둔다
        Object.assign(l, { read: false, stub: true, lines: ['(지난번에 꺼내지 못한 {item:이} 아직 들어 있다.)'] });
        await say(['(가방이 꽉 차서 꺼내지 못했다. 가방을 비우고 다시 열어 보자.)']);
        full = true;
        break;
      }
      l.gift = null;
    }
    if (!full) await offerWrite(say, false);
  }

  return { spot, deliver, post, unread, read, box, write, canWrite, sent: () => sentBox(ctx.state) };
}
