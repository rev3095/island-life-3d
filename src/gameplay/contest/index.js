// M18-P3 계절 낚시·곤충 대회 (15차 검수 보드 wave15 https://claude.ai/artifact/3hoiPoHF3nZJS2fDj5nSVc, D194-A). 노트 docs/notes/m18-p3-contest.md
// 설정 assets/contest/contest.json · 규칙(순수) rules.js · 대회 창 UI-34 ui.js.
//
// 대회 날(낚시 3·7·12월 · 곤충 5·10월, 정한 하루 — 계절 행사 7일과 안 겹침 · 섬 축제 날은 쉼 · 엔딩 뒤부터):
//   그날 하루 광장 한쪽에 대회 무대 BD-17 (world.objects persist:false — 저장 안 함) · 사회 주민(초롱)이 9–18시 무대 둘레에.
//   무대 앞 접수 탁자에서 Space → 사회 대화 → 접수 → 제한 시간(cfg.seconds, 실제 초 — 창이 열린 동안·장면 동안은 멈춤) 동안 잡은 것(gather:catch)의
//   크기(cm)·마릿수로 점수 → 시간 끝 → 결과 발표(사회 대화) → 금·은·동 트로피 FU-89–91 + 도토리 (4등 아래·못 잡음 = 참가 도토리).
//   주민 참가자 셋은 날짜로 정한 기록을 시간에 따라 쌓는다 (rules.rivalsOf) → 대회 창 순위가 바뀐다.
// 행동 키: 접수 탁자 'contest:desk' 104 (대회 날 무대 앞에서만 — 축제 시작·행사 할 일 101 · 눈덩이 102 · 소원 103 과 안 겹치는 값, 말 걸기 100 위).
// 상태 ctx.state.contest (주인: gameplay/contest) = { runs: { '<CT-id>:<해>': { day, rank, score, best, count, prize, rows } }, first: dayKey, owed: [아이템 id], told: { '<CT-id>:<해>': dayKey } }
// 이벤트 (보냄): contest:enter { id, kind, first, dayKey, x, z } · contest:catch { id, item, size, n } · contest:end { id, rank, score, best, count, prize }
// 서비스 ctx.services.contest = { config, today(), live(), running, view(), upcoming(), hostSpot(slug), clearSpots(), desk(), debug }
import * as R from './rules.js';
import { createContestBox } from './ui.js';

export const CONFIG_FILE = 'assets/contest/contest.json';
const NEAR = 1.6;          // 접수 탁자 앞 행동 거리
const CLEAR = 3.2;         // 주민이 서지 않는 탁자 앞 둘레 (town EVENT_CLEAR 와 같은 값)
const KIND_OK = new Set(['grass', 'plaza', 'path']);

export function createContest(ctx, cfg) {
  const S = () => ctx.services;
  const st = () => { const c = (ctx.state.contest ||= {}); c.runs ||= {}; c.owed ||= []; c.told ||= {}; return c; };
  const now = () => S().time?.now?.() ?? null;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const world = () => S().world;
  const isl = () => world()?.island;
  const seed = () => ctx.state.island?.seed ?? 0;
  const festivalToday = () => { try { return !!S().festival?.due?.(); } catch { return false; } };
  const open = () => R.isOpen(cfg, ctx.state.festival);
  const onIsland = () => {
    const p = S().player?.position;
    return !!p && Math.abs(p.x) < 200 && Math.abs(p.z) < 200 && !S().house?.where && !S().house?.inside && !S().tour?.active;
  };
  const kindOf = c => cfg.kinds?.[c.kind] ?? {};
  const keyOf = (c, n) => `${c.id}:${n.dayKey.slice(0, 4)}`;

  /** 오늘 대회 (엔딩 전 · 섬 축제 날이면 null) */
  const today = (n = now()) => (n && open() ? R.contestOn(cfg, n.dayKey, { festivalToday: festivalToday() }) : null);
  const inHours = (n = now()) => !!n && R.inHours(cfg, n.hourF);

  // ── 무대 BD-17 (그날만, 저장 안 함) ──
  const placed = { id: null, spot: null, day: null };
  function findSpot() {
    const W = world(), I = isl(), P = W?.places;
    if (!P?.plaza || !I) return null;
    const free = (tx, tz) => KIND_OK.has(I.tileAt(tx, tz)) && I.isWalkableTile?.(tx, tz) !== false && !W.objects.at(tx, tz);
    // 피할 곳: 행상 수레 · 박물관 앞 망원경대 (PR-40, stars 가 persist:false 로 놓아서 아직 안 놓였을 수 있다 → 저장된 자리도)
    const ped = S().daily?.peddler?.spot?.(), stand = S().stars?.stand?.() ?? ctx.state.stars?.spot;
    const avoid = [ped && { x: ped.x, z: ped.z, r: 5 }, stand && { x: stand.x, z: stand.z, r: 3.5 }].filter(Boolean);
    return R.stageSpot(P, { isFree: free, levelAt: I.levelAt, toTile: I.toTile, toWorld: I.toWorld }, { offset: cfg.stage?.offset ?? [0, 0], avoid });
  }
  function putStage(n) {
    const W = world();
    if (!W?.objects) return;
    if (placed.id && placed.day === n.dayKey) return;
    takeStage();
    const s = findSpot();
    if (!s) { console.warn('[contest] 대회 무대 자리를 못 찾았어요'); return; }
    const id = W.objects.add(cfg.stage?.env ?? 'contest-stage', s.tx, s.tz, { persist: false, at: { x: s.x, z: s.z }, rot: 0 });
    if (!id) return;
    Object.assign(placed, { id, spot: s, day: n.dayKey });
  }
  function takeStage() {
    if (placed.id) world()?.objects?.remove(placed.id);
    Object.assign(placed, { id: null, spot: null, day: null });
  }

  // ── 진행 중인 대회 (저장 안 함 — 다시 열면 다시 접수할 수 있다) ──
  let run = null;   // { c, key, day, t, catches: [{t, size, item}], rivals }
  const box = createContestBox(ctx.uiRoot);
  const nameOf = slug => {
    const V = S().town?.villagers?.find?.(v => v.slug === slug);
    return V?.person?.name ?? V?.name ?? slug;
  };
  const residents = () => { try { return S().town?.residents?.() ?? []; } catch { return []; } };
  const playerName = () => ctx.state.player?.name ?? '나';

  function entries(r = run) {
    return [{ who: 'player', catches: r.catches }, ...r.rivals.map(v => ({ who: v.slug, catches: v.catches }))];
  }
  function view(r = run) {
    if (!r) return null;
    const sec = cfg.seconds ?? 180, k = kindOf(r.c);
    const rows = R.standings(cfg, entries(r), r.t);
    const me = rows.find(x => x.who === 'player');
    return {
      id: r.c.id, emoji: r.c.emoji, name: r.c.name, unit: k.unit ?? '마리', left: R.clock(sec - r.t), leftSec: Math.max(0, sec - r.t), low: sec - r.t <= 30,
      me: { best: me.best, count: me.count, score: me.score, rank: me.rank },
      rows: rows.map(x => ({ rank: x.rank, who: x.who, name: x.who === 'player' ? playerName() : nameOf(x.who), best: x.best, count: x.count, score: x.score, me: x.who === 'player' })),
    };
  }

  // ── 사회 (초롱) ──
  const host = () => {
    const V = S().town?.villagers?.find?.(v => v.slug === cfg.host);
    return { name: V?.person?.name ?? '초롱', color: V?.person?.color ?? '#8CCB6E', voice: V?.person?.voice ?? cfg.host };
  };
  const L = cfg.lines ?? {};
  const vars = c => { const k = kindOf(c); return { name: c.name, emoji: c.emoji, time: Math.round((cfg.seconds ?? 180) / 60), what: k.what, whatObj: k.whatObj ?? k.what, toolSubj: k.toolSubj ?? k.label, tool: S().data?.items?.get?.(k.toolItem)?.name ?? k.label }; };
  const say = (lines, choices) => { const h = host(); return S().ui.dialog.open({ speaker: h.name, color: h.color, voice: h.voice, lines: [lines].flat().filter(Boolean), choices }); };

  function deskInFront() {
    const s = placed.spot, pl = S().player, p = pl?.position;
    if (!s || !p || !onIsland() || run) return null;
    const n = now();
    if (!n || placed.day !== n.dayKey) return null;
    const dx = s.desk.x - p.x, dz = s.desk.z - p.z, d = Math.hypot(dx, dz);
    const df = Math.hypot(s.front.x - p.x, s.front.z - p.z);
    if (d > NEAR + 0.5 && df > NEAR) return null;
    return d < 0.9 || df < 0.6 || (dx * -Math.sin(pl.facing) + dz * -Math.cos(pl.facing)) / d > 0.2 ? s : null;
  }

  async function atDesk() {
    const n = now(), c = today(n);
    if (!c) return;
    const k = kindOf(c), V = vars(c), rec = st().runs[keyOf(c, n)];
    await giveOwed();
    if (rec?.day === n.dayKey) { await say([R.fill(L.already, V)]); return; }
    if (!inHours(n)) { await say([R.fill(n.hourF < (cfg.hours?.[0] ?? 9) ? L.before : L.closed, V)]); return; }
    const pick = await say(L.invite.map(l => R.fill(l, V)).concat(R.fill(L.ask, V)), [L.yes ?? '나갈래요!', L.no ?? '다음에요']);
    if (pick !== 0) return;
    if (!S().data?.inventory?.hasTool?.(k.tool)) { await say([R.fill(L.noTool, V)]); return; }
    begin(c, n);
    await say([R.fill(L.start, V)]);
  }

  function begin(c, n) {
    const s = st(), first = !s.first;
    if (first) s.first = n.dayKey;
    run = { c, key: keyOf(c, n), day: n.dayKey, t: 0, catches: [], rivals: R.rivalsOf(cfg, c, n.dayKey, residents(), seed()) };
    ctx.events.emit('sfx', { name: 'acorn' });
    ctx.events.emit('contest:enter', { id: c.id, kind: c.kind, first, dayKey: n.dayKey, ...(placed.spot ? { x: placed.spot.front.x, z: placed.spot.front.z } : {}) });
    // 도구를 바로 들어 준다 (가방에 있는 대회 도구)
    try { if (S().player?.tool !== kindOf(c).tool) S().player?.setTool?.(kindOf(c).tool); } catch { /* 도구 들기는 손으로 */ }
    box.show(view());
  }

  function onCatch({ id, category } = {}) {
    if (!run || category !== run.c.kind || !id) return;
    const it = S().data?.items?.get?.(id);
    const size = R.sizeOf(cfg, run.c.kind, it, Math.random());
    run.catches.push({ t: Math.round(run.t * 10) / 10, size, item: id });
    const v = view();
    toast(`📏 ${it?.name ?? id} ${size}cm! (${v.me.count}${v.unit} · ${v.me.score}점 · ${v.me.rank}위)`, run.c.emoji);
    ctx.events.emit('contest:catch', { id: run.c.id, item: id, size, n: run.catches.length });
    box.show(v);
  }

  async function finish() {
    const r = run;
    if (!r) return;
    run = null;
    const rows = R.standings(cfg, entries(r));
    const me = rows.find(x => x.who === 'player');
    const prize = R.prizeOf(cfg, me.rank, me.count);
    const V = vars(r.c);
    st().runs[r.key] = { day: r.day, rank: me.rank, score: me.score, best: me.best, count: me.count, prize: { item: prize.item, acorns: prize.acorns },
      rows: rows.map(x => ({ who: x.who, score: x.score, best: x.best, count: x.count })) };
    box.show({ ...view(r), left: '0:00', low: true });
    ctx.events.emit('sfx', { name: 'acorn' });
    toast(R.fill(L.timeUp, V), '⏱');
    // 결과 발표 — 창이 닫혀 있을 때까지 기다렸다가 (낚시 줄 당기는 중이면 끝나고)
    for (let i = 0; i < 40 && (S().ui?.isBlocking?.() || S().story?.playing); i++) await new Promise(res => setTimeout(res, 250));
    const lines = [R.fill(L.timeUp, V), R.fill(L.results, V)];
    for (const x of rows.slice().reverse()) lines.push(`${x.rank}위 ${x.who === 'player' ? playerName() : nameOf(x.who)} — ${x.score}점 (${x.count ? `${x.best}cm · ` : ''}${x.count}${kindOf(r.c).unit ?? '마리'})`);
    lines.push(R.fill(!me.count ? L.none : L[`rank${Math.min(4, me.rank)}`], V));
    try { await say(lines); } catch (e) { console.warn('[contest] 결과 대화', e); }
    box.hide();
    give(prize);
    ctx.events.emit('contest:end', { id: r.c.id, kind: r.c.kind, rank: me.rank, score: me.score, best: me.best, count: me.count, prize: { item: prize.item, acorns: prize.acorns } });
  }

  function give(prize) {
    const d = S().data;
    if (prize.acorns) { d?.wallet?.add?.(prize.acorns); toast(`도토리 ${prize.acorns.toLocaleString('ko-KR')}개를 받았어요!`, '🌰'); }
    if (prize.item) {
      const it = d?.items?.get?.(prize.item);
      if ((d?.inventory?.add?.(prize.item, 1) ?? 0) > 0) { toast(`${it?.name ?? prize.item}를 받았어요!`, it?.emoji ?? '🏆'); ctx.events.emit('sfx', { name: 'acorn' }); }
      else { st().owed.push(prize.item); toast(`가방이 꽉 찼어요. ${it?.name ?? '트로피'}는 대회 무대 접수 탁자에 맡겨 둘게요 (다음 대회 날 받아요)`, '🎒'); }
    }
  }
  async function giveOwed() {
    const s = st(), d = S().data;
    if (!s.owed.length) return;
    const left = [];
    for (const id of s.owed) { if ((d?.inventory?.add?.(id, 1) ?? 0) > 0) toast(`맡겨 둔 ${d.items.get(id)?.name ?? id}를 받았어요!`, '🏆'); else left.push(id); }
    s.owed = left;
  }

  // ── 날마다: 무대 놓기·치우기 · 알림 · 비 막기 ──
  let ready = false;   // game:ready 뒤에만 무대를 놓는다 (망원경대·행상 수레 같은 persist:false 물체가 먼저 자리 잡게)
  function sync() {
    const n = now();
    if (!n || !world()?.objects || !ready || S().tour?.active) return;   // 투어 섬에 가 있는 동안은 world 칸 질문이 그 섬으로 간다
    const c = today(n);
    if (c) putStage(n); else takeStage();
    if (!c) return;
    const k = keyOf(c, n), s = st();
    if (inHours(n) && s.told[k] !== n.dayKey && onIsland()) { s.told[k] = n.dayKey; toast(R.fill(L.announce, vars(c)), c.emoji); }
    // 대회 시간엔 비 대신 흐림 (계절 행사 D80-A 와 같은 규칙) — 개발 패널·다른 모듈이 고른 날씨는 그대로
    const T = S().time;
    if (inHours(n) && T && !T.weatherOverride && T.weather === 'rain') T.setWeather?.('cloudy');
  }

  function register(gp) {
    gp.add({ name: 'contest:desk', intent: 'action', priority: 104, label: () => { const n = now(), c = today(n); return c && inHours(n) && !st().runs[keyOf(c, n)] ? '접수' : '대회'; }, test: () => deskInFront(), run: () => atDesk() });
  }

  let tick = 0;
  function update(dt) {
    if ((tick += dt) >= 1) { tick = 0; sync(); }
    if (!run) return;
    const n = now();
    // 날이 바뀌거나 섬을 떠나면(투어·실내) 그 자리에서 끝낸다
    if (!n || n.dayKey !== run.day) { finish(); return; }
    if (S().story?.playing) { box.hide(); return; }   // 장면 동안은 창을 숨기고 시간도 멈춘다
    if (S().ui?.isBlocking?.() || ctx.paused) { box.show(view()); return; }   // 창이 열린 동안은 시간이 멈춘다 (주민 기록도 같은 t 로 멈춤)
    run.t += Math.min(dt, 0.5);
    if (run.t >= (cfg.seconds ?? 180)) { run.t = cfg.seconds ?? 180; finish(); return; }
    box.show(view());
  }

  return {
    sync, update, register, onCatch, setReady: () => { ready = true; sync(); },
    service: {
      config: cfg,
      today: () => { const c = today(); return c ? { ...c } : null; },
      live: () => !!today() && inHours(),
      get running() { return !!run; },
      view: () => view(),
      upcoming: () => { const n = now(); return n ? R.upcoming(cfg, n.dayKey).map(u => ({ id: u.c.id, name: u.c.name, kind: u.c.kind, day: u.day, until: u.until })) : []; },
      record: id => { const n = now(); const c = cfg.list.find(x => x.id === id); return c && n ? st().runs[keyOf(c, n)] ?? null : null; },
      /** town.pickSpot 이 묻는다: 사회 주민이면 대회 시간 동안 무대 둘레 (탁자 앞 CLEAR 칸은 비움) */
      hostSpot: slug => (slug === cfg.host && placed.spot && today() && inHours() ? { x: placed.spot.front.x, z: placed.spot.front.z } : null),
      /** town.keepClear: 주민이 서지 않을 자리 (접수 탁자 앞) */
      clearSpots: () => (placed.spot ? [{ x: placed.spot.front.x, z: placed.spot.front.z, r: CLEAR }] : []),
      desk: () => (placed.spot ? JSON.parse(JSON.stringify(placed.spot)) : null),
      debug: { sync, finish: () => finish(), get run() { return run; } },
    },
  };
}

let C = null;
export default {
  name: 'contest',
  async init(ctx) {
    const cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(CONFIG_FILE) : fetch(CONFIG_FILE).then(r => r.json()));
    C = createContest(ctx, cfg);
    ctx.services.contest = C.service;
    ctx.events.on('gather:catch', p => C.onCatch(p));
    ctx.events.on('game:ready', () => C.setReady());
    for (const name of ['time:newday', 'data:loaded', 'festival:end', 'place:leave', 'house:leave']) ctx.events.on(name, () => C.sync());
    const gp = ctx.services.gameplay?.interactions;
    if (gp) C.register(gp);
    C.sync();
  },
  update(dt) { C?.update(dt); },
};
