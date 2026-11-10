// 10차 M10-P4 이사 오가기 (보드 wave10 D94-A, 화면 UI-18). 자세히는 docs/notes/m10-moving.md.
//  - 오기: 첫 섬 축제(엔딩, state.festival.endedDay) 뒤 7일마다 한 명씩, 주민 파일에 "arrives": "moving" 이 적힌 주민(구름·파도·달무리)이
//    빈 집터로 이사 온다. 섬 최대 10명 (가게 주인 둘 포함 — 지금 9명). 단계는 엔딩 전 이사(movein.js)와 같다:
//    표지판(PR-12) → 3일 뒤 이삿짐(PR-10, 이날 그 주민의 "내일 이사 가요" 편지 = 오기 전날 편지) → 다음 날 집(house-villager 색 변형) + 입주.
//  - 떠나기: 30일 넘게 산 주민이 가끔 "떠나 볼까…" 할 마음을 먹고, 말을 걸면 묻는다 → 허락 / 말리기 창.
//    허락하면 다음 날 집 앞 이삿짐, 그다음 날 떠난다 (집이 사라지고 표지판이 다시 선다 → 다음 주민이 올 수 있는 빈 집터).
//    말리면 그대로 남고 한동안 묻지 않는다. 떠난 주민은 가끔 편지를 보낸다.
//  - 축제·계절 행사 주인공(STAY)은 떠나지 않는다 (1년 뒤 축제 부스·행사 장면에 나온다).
// 상태는 state.town.moving (없으면 만든다 — 예전 저장 그대로 열린다). 아래 순수 함수는 tests/moving.test.mjs 가 본다.
import { daysBetween, josa, rngOf, pickLines } from './rules.js';
import { addDays, moveinState, MOVEIN_DAYS, PROPS, propKind } from './movein.js';
import { VILLAGERS as FILES, LINES } from './people.js';

/** 숫자 (바꿀 자리는 여기 하나) */
export const MOVING = {
  every: 7,            // 엔딩 뒤 입주 날 사이 (첫 입주 = 엔딩 날 + 7)
  max: 10,             // 섬 최대 주민 수 (가게 주인 포함)
  minStay: 30,         // 이만큼 넘게 산 주민만 떠나 볼까 묻는다
  quiet: 7,            // 엔딩·지난 묻기 뒤 이 날 수까지는 아무도 묻지 않는다
  chanceStep: 0.02,    // 그 뒤 하루 지날 때마다 묻기 확률 + 이만큼 (하루에 섬 전체 한 번 굴림)
  chanceMax: 0.35,
  askDays: 5,          // 물을 마음을 먹고 이만큼 지나도 말을 안 걸면 마음이 사라진다
  calmDays: 30,        // 말리면 그 주민은 이만큼 다시 묻지 않는다
  boxesAfter: 1,       // 허락한 날 + 1 = 집 앞 이삿짐
  goneAfter: 2,        // 허락한 날 + 2 = 떠남
  letters: { first: 3, every: 12, max: 4 },   // 떠난 주민 편지: 떠난 뒤 3일에 첫 편지, 그 뒤 12일마다, 4통까지
  catchUp: 120,        // 오래 쉬었다 와도 굴려 보는 지난 날 수 (넘으면 그 앞은 건너뜀)
};
/** 입주 날 - LEAD = 이사 흐름 시작(start) — 다음 날 표지판, 3일 뒤 이삿짐, 다음 날 집 (movein.js MOVEIN_DAYS 합) */
export const LEAD = MOVEIN_DAYS.lot + MOVEIN_DAYS.boxes + MOVEIN_DAYS.house;
/** 떠나지 않는 주민: 섬 축제 부스 주인(축제 설정 booths.owner)과 계절 행사 주인공(events.json host) — tests/moving.test.mjs 가 맞는지 본다 */
export const STAY = ['coco', 'mochi', 'dubu', 'pong', 'chorong'];
/** 새 주민 집 지붕 색 변형 (배경 house-villager 의 variants — 없으면 변형 없이) */
export const ROOF = { gureum: 'lilac', pado: 'blue', dalmuri: 'navy' };
/** 엔딩 뒤 이사 오는 주민 (주민 파일 "arrives": "moving", files.js 순서) */
export const MOVERS = FILES.filter(d => d.role === 'villager' && d.arrives === 'moving').map(d => d.slug);

// ---------- 상태 ----------

/** state.town.moving (빈 칸 채움) */
export function movingState(state) {
  const t = (state.town ??= {});
  const M = (t.moving ??= {});
  M.arrived ??= [];       // 엔딩 뒤 이사 온 주민 (온 차례)
  M.homes ??= {};         // 이사 오는·온 주민 → 집터 id ('home:<원래 주인>' | 'spare-1')
  M.coming ??= null;      // 지금 이사 오는 중인 주민 (표지판~입주)
  M.last ??= null;        // 마지막 입주 날
  M.opened ??= null;      // 마지막으로 빈 집터가 생긴 날 (떠난 날)
  M.freed ??= [];         // 떠나서 빈 집터 id (표지판이 서 있다)
  M.origin ??= null;      // 처음부터 산 주민이 섬에 산 첫날 (첫날 안내 날)
  M.since ??= {};         // 새 주민이 입주한 날
  M.ask ??= null;         // { slug, day } 떠나 볼까 물을 마음 (말 걸면 묻는다)
  M.rolled ??= null;      // 묻기를 굴려 본 마지막 날
  M.quietFrom ??= null;   // 묻기 확률을 세기 시작한 날 (지난 묻기가 끝난 날, 없으면 엔딩 날)
  M.calm ??= {};          // slug → 말린 날
  M.leaving ??= null;     // { slug, lot, ok, boxes, gone } 허락해서 떠나는 중
  M.departed ??= [];      // [{ slug, lot, day, next, sent }] 떠난 주민 (편지)
  M.welcomed ??= {};      // slug → 첫 만남 장면 신호를 보낸 날
  return M;
}

export const isDeparted = (M, slug) => M.departed.some(d => d.slug === slug);

// ---------- 오기 (순수) ----------

/** 다음 입주 예정 날 (엔딩 전이면 null) */
export const nextArrivalDay = (M, endedDay, every = MOVING.every) => (endedDay ? addDays(M.last ?? endedDay, every) : null);

/**
 * 다음 이사를 시작할까 → { slug, lot, start } | null
 * o = { M, endedDay, today, count(지금 주민 수 + 오는 중), max, movers, freeLots: [집터 id] }
 * start = 입주 예정 날 - LEAD (빈 집터가 그 뒤에 생겼으면 그 전날 = 떠난 날 바로 표지판). start 가 오늘보다 뒤면 아직.
 */
export function planArrival({ M, endedDay, today, count, max = MOVING.max, movers = MOVERS, freeLots = [] }) {
  if (!endedDay || !today || M.coming || count >= max) return null;
  const slug = movers.find(s => !M.arrived.includes(s) && !isDeparted(M, s));
  const lot = freeLots[0];
  if (!slug || !lot) return null;
  let start = addDays(nextArrivalDay(M, endedDay), -LEAD);
  const opened = M.opened && addDays(M.opened, -MOVEIN_DAYS.lot);   // 떠난 날 바로 표지판이 서게 (그 전날 시작한 셈)
  if (opened && daysBetween(start, opened) > 0) start = opened;
  if (daysBetween(endedDay, start) < 0) start = endedDay;
  if (daysBetween(today, start) > 0) return null;
  return { slug, lot, start };
}

// ---------- 떠나기 (순수) ----------

/** 조용한 날 수 → 그날 묻기 확률 */
export const askChance = (quietDays, o = MOVING) => Math.max(0, Math.min(o.chanceMax, (quietDays - o.quiet) * o.chanceStep));

/** 떠나 볼까 물을 수 있는 주민 (그날 기준) — residents 순서 그대로 */
export function leaveCandidates({ residents, sinceOf, calm = {}, day, stay = STAY, exclude = [], o = MOVING }) {
  return residents.filter(s => !stay.includes(s) && !exclude.includes(s)
    && daysBetween(sinceOf(s), day) > o.minStay
    && !(calm[s] && daysBetween(calm[s], day) < o.calmDays));
}

/**
 * 지난번 굴린 날 다음부터 오늘까지 하루씩 묻기 마음을 굴린다 (그날마다 같은 난수 — 같은 저장·같은 날이면 늘 같다).
 * o = { M, endedDay, today, candidatesOn(day) → [slug], blocked?(day) → 그날은 안 굴림 } → 새로 생긴 ask | null
 */
export function rollAsk({ M, endedDay, today, candidatesOn, blocked = () => false, o = MOVING }) {
  if (!endedDay || !today) return null;
  let from = M.rolled && daysBetween(endedDay, M.rolled) > 0 ? M.rolled : endedDay;
  if (daysBetween(from, today) > o.catchUp) from = addDays(today, -o.catchUp);
  let made = null;
  const before = M.ask;   // 지난번에 먹은 마음만 사라진다 — 쉬는 동안(따라잡기) 먹은 마음은 돌아온 오늘 먹은 것으로 친다
  for (let d = addDays(from, 1); daysBetween(d, today) >= 0; d = addDays(d, 1)) {
    M.rolled = d;
    if (M.ask && M.ask === before && daysBetween(M.ask.day, d) > o.askDays) { M.ask = null; M.quietFrom = d; }
    if (M.ask || M.leaving || blocked(d)) continue;
    const r = rngOf('leave', d);
    const quiet = daysBetween(M.quietFrom ?? endedDay, d);
    if (r() >= askChance(quiet, o)) continue;
    const list = candidatesOn(d);
    if (!list.length) continue;
    M.ask = { slug: list[Math.floor(r() * list.length)], day: d };
    made = M.ask;
  }
  if (made) made.day = today;
  return made;
}

/** 허락 → 떠나는 일정 */
export const leavePlan = (slug, lot, day, o = MOVING) => ({ slug, lot, ok: day, boxes: addDays(day, o.boxesAfter), gone: addDays(day, o.goneAfter) });
/** 떠나는 단계: 'asked'(허락한 날) | 'boxes' | 'gone' */
export const leaveStage = (L, day) => (!L ? null : daysBetween(L.gone, day) >= 0 ? 'gone' : daysBetween(L.boxes, day) >= 0 ? 'boxes' : 'asked');

/** 떠난 주민 편지 차례 → 보낼 departed 항목들 (next·sent 를 고친다) */
export function lettersDue(departed, day, o = MOVING.letters) {
  const out = [];
  for (const d of departed) {
    if ((d.sent ?? 0) >= o.max || !d.next || daysBetween(d.next, day) < 0) continue;
    d.sent = (d.sent ?? 0) + 1;
    d.next = addDays(day, o.every);
    out.push(d);
  }
  return out;
}

// ---------- 편지 글 (주민 파일 letters 에 없을 때) ----------

const nameOf = slug => FILES.find(d => d.slug === slug)?.name ?? slug;
/** kind: 'moving'(오기 전날) · 'movein'(입주) · 'away'(떠난 뒤) → 편지 묶음 [[줄…]…] */
export function letterPool(slug, kind) {
  const own = LINES[slug]?.letters?.[kind];   // 주민 파일 lines.letters.<kind> 가 있으면 그 말투로
  if (own?.length) return own;
  const n = nameOf(slug), sig = `— ${n}`;
  const P = {
    moving: [
      [`처음 인사드려요. ${josa(n, '이에요')}.`, '빈 집터에 이삿짐을 먼저 보냈어요. 내일 이사 가요!', `바다 건너에서 소문 많이 들었어요. 벌써 설레요. ${sig}`],
      [`안녕하세요, 곧 이웃이 될 ${josa(n, '이에요')}.`, '내일이면 그 섬에서 처음 맞는 저녁이에요.', `집 앞에서 만나면 인사해 주세요. ${sig}`],
    ],
    movein: [
      [`오늘 이사 왔어요! ${josa(n, '이에요')}.`, '짐은 천천히 풀어 볼게요.', `집 앞에서 만나면 인사해 주세요. ${sig}`],
    ],
    away: [
      ['잘 지내고 있어?', '새 섬도 좋지만, 가끔 그 섬 바닷소리가 생각나.', `다들 보고 싶다고 전해 줘. ${sig}`],
      ['여기는 오늘 바람이 많이 불었어.', '창밖을 보다가 네 생각이 났어. 그 섬 사진을 아직 벽에 걸어 두고 있어.', sig],
      ['새 이웃들에게 네 이야기를 했어.', '"그 섬엔 정말 다정한 친구가 있어"라고.', `언젠가 놀러 갈게. ${sig}`],
      ['편지 받으면 우편함 앞에서 웃어 줘.', '나도 여기서 웃고 있을게.', `늘 고마워. ${sig}`],
    ],
  };
  return P[kind] ?? null;
}

// ---------- 게임 흐름 ----------

/**
 * createMoving(ctx, { canLive }) → 주민을 세우기 전에 만든다 (집터 주인을 먼저 정해 둬야 town.houseOf·주민 방이 맞는다).
 * 나머지(편지·이사·주민 넣고 빼기)는 attach({ mail, movein, addResident, removeResident, toast, villagers, keepers, roomOwner }) 뒤에.
 */
export function createMoving(ctx, { canLive = () => true } = {}) {
  const world = ctx.services.world;
  const M = movingState(ctx.state);
  const NEW = ctx.constants.NEWCOMERS ?? [];
  const BASE = ctx.constants.VILLAGERS ?? [];
  const P = world.places;
  let A = null;           // attach 로 받은 것
  const placed = {};      // 열쇠 → 물체 id (저장하지 않는 표지판·이삿짐)
  const today = () => ctx.services.time?.now?.()?.dayKey ?? ctx.services.data?.day?.key?.() ?? null;
  const endedDay = () => ctx.state.festival?.endedDay ?? null;

  // ---- 집터 표: 처음부터 있는 집(home:<주인>) + 남는 집터(spare-n) ----
  const LOTS = [
    ...(P.villagerHouses ?? []).filter(h => BASE.includes(h.slug)).map(h => ({ id: `home:${h.slug}`, home: h.slug, entry: h })),
    ...(P.spareLots ?? []).map(h => ({ id: h.id, home: null, entry: h })),
  ];
  const lotById = id => LOTS.find(l => l.id === id) ?? null;
  const departed = slug => isDeparted(M, slug);
  /** 집터 주인: 그 집터로 이사 오는·온 새 주민 → 처음 주인(떠나지 않았으면) → 없음 */
  function ownerOf(lot) {
    const n = Object.entries(M.homes).find(([s, id]) => id === lot.id && !departed(s))?.[0];
    if (n) return n;
    return lot.home && !departed(lot.home) ? lot.home : null;
  }
  const freeLots = () => LOTS.filter(l => !ownerOf(l));
  /** 집터 위·문 앞에 다른 물건(섬 꾸미기로 놓은 것 등)이 없나 — 이 흐름의 표지판은 빼고 */
  const NATURE = /^(weed|shell|fossil-spot|tree|cedar|palm|fruit-tree|bush|tulip|cosmos|pansy|flower|mushroom|stump)/;   // 저절로 나는 것 — 집터를 쓸 때 치운다
  const lotTiles = lot => {
    const L = lot.entry.lot ?? lot.entry.site, out = [];
    if (L) for (let tz = L.tz; tz <= L.tz + L.fd; tz++) for (let tx = L.tx; tx < L.tx + L.fw; tx++) out.push([tx, tz]);
    return out;
  };
  /** 집터 위·문 앞에 플레이어가 놓은 물건(섬 꾸미기·심은 것 등)이 없나 — 잡초·조개처럼 저절로 난 것과 이 흐름의 표지판은 빼고 */
  function lotClear(lot) {
    if (!world.objects.on) return true;
    const ours = new Set(Object.values(placed));
    const mine = new Set((ctx.state.island?.added ?? []).filter(a => !NATURE.test(a.kind) || a.data?.grow).map(a => a.id));
    return lotTiles(lot).every(([tx, tz]) => !(world.objects.on(tx, tz) ?? []).some(o => !ours.has(o.id) && (mine.has(o.id) || !NATURE.test(o.kind))));
  }
  /** 쓰기로 한 집터 위의 잡초·조개·화석 자리·꽃 같은 것을 치운다 (오늘 난 것은 daily 목록에서, 생성된 것은 removed 로) */
  function clearNature(lot) {
    if (!world.objects.on) return;
    for (const [tx, tz] of lotTiles(lot)) for (const o of world.objects.on(tx, tz) ?? []) {
      if (!NATURE.test(o.kind) || Object.values(placed).includes(o.id)) continue;
      if (!world.daily?.take?.(o.id)) world.objects.remove(o.id);
    }
  }

  /** world.places.villagerHouses 를 지금 주인대로 (주인 없는 집터는 목록에서 뺀다 — 지도·문·주민 방이 따라간다) */
  function applyLots() {
    const list = P.villagerHouses ?? (P.villagerHouses = []);
    for (const lot of LOTS) {
      const owner = ownerOf(lot), e = lot.entry, i = list.indexOf(e);
      if (lot.home && departed(lot.home)) {
        e.lot ??= e.site;                 // 처음 주인이 떠난 집 = 이제 빈 집터
        removeBuiltHouse(lot);
      }
      e.slug = owner;
      if (owner && i < 0) list.push(e);
      if (!owner && i >= 0) list.splice(i, 1);
    }
  }
  /** 처음부터 서 있던 집·우편함 치우기 (world 가 state.island.removed 에 적어서 다음에 열어도 없다) */
  function removeBuiltHouse(lot) {
    const S = lot.entry.site;
    if (!S) return;
    world.objects.remove?.(`house-villager@${S.cx},${S.cz}`);
    world.objects.remove?.(`mailbox@${lot.entry.tx + 1},${lot.entry.tz}`);
    if (S.pad && !Object.values(M.homes).includes(lot.id)) S.pad.off = true;
  }

  // ---- 누가 사나 ----
  /** 섬에 사는 주민 (base = 처음부터 사는 주민 중 지금 사는 이 — town 이 준다) */
  const residents = base => [...base.filter(s => !departed(s)), ...M.arrived.filter(s => canLive(s) && !departed(s) && !!ctx.state.town?.movein?.[s]?.moved)];
  /** 최대 수에 세는 주민: 처음부터 사는 이(엔딩 전 이사 포함, 떠나지 않은) + 이사 온·오는 이 + 가게 주인 */
  const countAll = () => BASE.filter(s => !departed(s)).length + M.arrived.filter(s => !departed(s)).length + (M.coming ? 1 : 0) + (A?.keepers ?? 0);
  /** movein.js 가 단계를 진행할 주민: 엔딩 전 이사 + 엔딩 뒤 이사 (떠난 주민은 빼고) */
  const moveinSlugs = () => [...NEW, ...M.arrived, ...(M.coming ? [M.coming] : [])].filter(s => !departed(s));
  const sinceOf = slug => M.since[slug] ?? (NEW.includes(slug) ? ctx.state.town?.movein?.[slug]?.moved : null) ?? M.origin;
  /** 집 지붕 색: 주민 파일 house.variant → ROOF 표 → slug (엔딩 전 주민) — 배경에 없는 변형이면 변형 없이 */
  function variantOf(slug) {
    const want = FILES.find(d => d.slug === slug)?.house?.variant ?? ROOF[slug] ?? slug;
    const vars = world.debug?.models?.['house-villager']?.spec?.variants;
    return !vars || vars[want] ? want : null;
  }
  const letter = (slug, kind) => letterPool(slug, kind);

  // ---- 표지판 (떠나서 빈 집터) · 떠나는 날 이삿짐 ----
  function put(key, kind, tx, tz, data = {}) {
    if (placed[key] || !kind) return;
    placed[key] = world.objects.add(kind, tx, tz, { persist: false, id: `${kind}@${key}`, ...data });
  }
  function drop(key) {
    if (!placed[key]) return;
    world.objects.remove(placed[key]);
    placed[key] = null;
  }
  function sync() {
    const sign = propKind(world, PROPS.sign), boxes = propKind(world, PROPS.boxes);
    if (M.coming) { const l = lotById(M.homes[M.coming]); if (l) clearNature(l); }   // 오는 동안 새로 난 잡초 등
    for (const lot of LOTS) {
      const L = lot.entry.lot ?? lot.entry.site;
      const show = !ownerOf(lot) && M.freed.includes(lot.id);
      if (show && L) put(`free-${lot.id}`, sign, L.cx, sign === PROPS.sign.fallback ? L.cz + 1 : L.cz, { owner: null });
      else drop(`free-${lot.id}`);
    }
    const st = leaveStage(M.leaving, today());
    const h = M.leaving && P.villagerHouses?.find(x => x.slug === M.leaving.slug);
    if (st === 'boxes' && h) put(`leave-${M.leaving.slug}`, boxes, h.tx - 1, h.tz, { owner: M.leaving.slug });
    else for (const k of Object.keys(placed)) if (k.startsWith('leave-')) drop(k);
    // 이삿날엔 새집 문 옆에 풀다 만 이삿짐 (첫 만남 장면 s17–s19 에 보인다)
    for (const slug of M.arrived) {
      const hh = P.villagerHouses?.find(x => x.slug === slug);
      if (hh && M.since[slug] === today() && !departed(slug)) put(`unpack-${slug}`, boxes, hh.tx - 1, hh.tz, { owner: slug });
      else drop(`unpack-${slug}`);
    }
  }

  // ---- 하루가 바뀔 때 ----
  const blockedNow = () => {
    try {
      const E = ctx.services.events;
      if (E?.isOpen?.() && E.active?.()?.length) return true;   // 계절 행사 주간 (7일 내내 — 행사 시간만이 아니라)
      if (ctx.services.festival?.due?.()) return true;
    } catch { /* 서비스가 아직 없다 */ }
    return false;
  };
  function check(dayKey = today()) {
    if (!A || !dayKey) return;
    if (ctx.state.flags?.intro) M.origin ??= ctx.state.town?.movein?.[NEW[0]]?.start ?? dayKey;
    const ended = endedDay();
    if (!ended) { sync(); return; }
    // 떠나기 진행
    const st = leaveStage(M.leaving, dayKey);
    if (st === 'boxes' && !M.leaving.told) {
      M.leaving.told = true;
      A.toast(`${josa(nameOf(M.leaving.slug), '이')} 떠날 짐을 싸고 있어요`, '📦');
    }
    if (st === 'gone' && A.roomOwner?.() !== M.leaving.slug) leave(M.leaving, dayKey);
    // 떠난 주민 편지
    for (const d of lettersDue(M.departed, dayKey)) {
      A.mail.post(d.slug, 'away', null, { pool: letterPool(d.slug, 'away') });
    }
    // 묻기 마음 (오늘이 행사·축제 날이면 오늘은 굴리지 않는다)
    const base = A.residents();
    rollAsk({
      M, endedDay: ended, today: dayKey,
      blocked: d => d === dayKey && blockedNow(),
      candidatesOn: d => leaveCandidates({ residents: base, sinceOf, calm: M.calm, day: d, exclude: [M.coming].filter(Boolean) }),
    });
    if (M.ask && (departed(M.ask.slug) || !base.includes(M.ask.slug))) M.ask = null;
    // 행사·축제 날엔 묻지 않으니, 먹은 마음이 그동안 사라지지 않게 오늘 먹은 것으로
    if (M.ask && blockedNow()) M.ask.day = dayKey;
    // 다음 이사
    plan(dayKey);
    sync();
  }
  function plan(dayKey) {
    const free = freeLots().filter(lotClear).map(l => l.id);
    const p = planArrival({ M, endedDay: endedDay(), today: dayKey, count: countAll(), freeLots: free });
    if (!p) {
      if (!M.coming && freeLots().length && !free.length && !(M.blockedTold && daysBetween(M.blockedTold, dayKey) < 7) && countAll() < MOVING.max && MOVERS.some(s => !M.arrived.includes(s) && !departed(s))) {
        M.blockedTold = dayKey;
        A.toast('빈 집터에 놓인 물건을 치우면 새 주민이 이사 올 수 있어요', '🪧');
      }
      return;
    }
    M.coming = p.slug;
    M.homes[p.slug] = p.lot;
    M.freed = M.freed.filter(id => id !== p.lot);
    drop(`free-${p.lot}`);
    const lot = lotById(p.lot);
    lot.entry.lot ??= lot.entry.site;
    clearNature(lot);
    applyLots();
    const r = moveinState(ctx.state, p.slug);
    r.start = p.start;
    console.info(`[town] 이사 예정: ${nameOf(p.slug)} → ${p.lot} (시작 ${p.start}, 입주 ${addDays(p.start, LEAD)})`);
  }
  /** movein.js 가 입주시켰다 (town:movein) */
  function moved(slug) {
    if (slug !== M.coming) return;
    M.coming = null;
    if (!M.arrived.includes(slug)) M.arrived.push(slug);
    M.last = ctx.state.town?.movein?.[slug]?.moved ?? today();
    M.since[slug] = M.last;
  }
  /** 떠나는 날: 집·우편함·이삿짐을 치우고 주민을 섬에서 뺀다 → 표지판이 선 빈 집터 */
  function leave(L, dayKey) {
    const slug = L.slug;
    M.leaving = null;
    M.ask = null;
    M.quietFrom = dayKey;
    M.departed.push({ slug, lot: L.lot, day: L.gone, next: addDays(L.gone, MOVING.letters.first), sent: 0 });
    M.opened = dayKey;
    if (L.lot && !M.freed.includes(L.lot)) M.freed.push(L.lot);
    A.movein.clear(slug);
    applyLots();
    for (const k of Object.keys(placed)) if (k.startsWith('leave-')) drop(k);
    Promise.resolve(A.removeResident(slug)).catch(e => console.error('[town] 떠나기', e));
    ctx.events.emit('town:moveout', { slug, lot: L.lot });
    A.toast(`${josa(nameOf(slug), '이')} 섬을 떠났어요. 빈 집터에 표지판이 다시 섰어요`, '🧳');
  }

  // ---- 말 걸기 (UI-18 떠나기 묻기 창) ----
  const lotOfSlug = slug => LOTS.find(l => ownerOf(l) === slug)?.id ?? null;
  const asking = slug => !!M.ask && M.ask.slug === slug && !M.leaving && !blockedNow() && !ctx.services.story?.playing;
  /** 말 걸 때 먼저 부른다 → true 면 이 대화는 여기서 끝 (묻기 창), false 면 평소 대화로 */
  async function talk(V) {
    if (!A) return false;
    const ui = ctx.services.ui, P = V.person, day = today();
    const say = lines => ui.dialog.open({ speaker: P.name, color: P.color, lines, voice: P.voice ?? V.slug });
    // 주민 파일 lines.leave = { ask, ok, stay, later, packing, farewell } (줄 묶음 하나 = [줄…]) 가 있으면 그 말투로, 없으면 아래 기본 대사
    const own = (k, def) => { const pool = LINES[V.slug]?.leave?.[k]; return pool?.length ? pickLines(pool, Math.random).flat() : def; };
    if (M.leaving?.slug === V.slug) {
      const st = leaveStage(M.leaving, day);
      await say(st === 'boxes'
        ? own('farewell', ['짐을 다 쌌어. 내일이면 정말 떠나…', '이 섬에서 지낸 날들, 하나도 안 잊을게. 편지 쓸게!'])
        : own('packing', ['허락해 줘서 고마워. 내일부터 짐을 쌀 거야.', '떠나기 전에 한 번 더 인사하러 와 줘.']));
      return false;
    }
    if (!asking(V.slug)) return false;
    await say(own('ask', ['저기… 요즘 바다 건너 다른 섬 이야기를 자주 들어.', '나… 떠나 볼까 생각 중이야.']));
    const pick = await (ui.confirm ? ui.confirm({
      title: '떠나 볼까…', icon: '🧳',
      text: `${josa(P.name, '이')} 섬을 떠나고 싶어 해요. 보내 줄까요?\n허락하면 다음 날 짐을 싸고, 그다음 날 떠나요.`,
      buttons: [{ label: '말리기', value: 'stay', primary: true }, { label: '허락', value: 'ok' }],   // 말리기가 먼저(처음 고른 칸) — 대사를 Space 로 넘기다 실수로 허락하지 않게
      cancelValue: null,
    }) : Promise.resolve('stay'));
    if (pick === 'ok') {
      M.leaving = leavePlan(V.slug, lotOfSlug(V.slug), day);
      M.ask = null;
      ctx.events.emit('town:leave-ask', { slug: V.slug, answer: 'ok' });
      await say(own('ok', ['…알았어. 허락해 줘서 고마워.', '내일 짐을 싸고, 모레 떠날게. 그동안 정말 즐거웠어.']));
      A.toast(`${josa(P.name, '이')} 모레 섬을 떠나요`, '🧳');
    } else if (pick === 'stay') {
      M.ask = null;
      M.quietFrom = day;
      M.calm[V.slug] = day;
      ctx.events.emit('town:leave-ask', { slug: V.slug, answer: 'stay' });
      V.happy?.();
      await say(own('stay', ['…그렇지? 역시 여기가 제일 좋아!', '말려 줘서 고마워. 앞으로도 잘 부탁해.']));
    } else {
      await say(own('later', ['…아직 잘 모르겠어. 다음에 다시 이야기하자.']));
    }
    return true;
  }

  // ---- 이삿날 저녁 첫 만남 장면 신호 (story 트리거 'move-in') ----
  let tick = 0;
  function update(dt) {
    if (!A || (tick -= dt) > 0) return;
    tick = 1;
    const now = ctx.services.time?.now?.();
    if (!now) return;
    const h = now.hour ?? 12;
    if (!(h >= 17 || h < 5)) return;
    if (ctx.services.house?.inside || ctx.services.house?.where || ctx.services.house?.passing || ctx.services.story?.playing) return;
    if (ctx.services.ui?.isBlocking?.()) return;
    for (const slug of M.arrived) {
      if (M.welcomed[slug] || departed(slug)) continue;
      const V = A.villagers().find(v => v.slug === slug);
      const door = V?.door;
      if (!door) continue;
      M.welcomed[slug] = now.dayKey ?? today();
      ctx.events.emit('town:welcome', { slug, x: door.x, z: door.z });
      break;
    }
  }

  return {
    applyLots, residents, moveinSlugs, variantOf, letter, check, moved, talk, update, sync,
    attach(o) { A = o; },
    state: () => M,
    lots: () => LOTS.map(l => ({ id: l.id, home: l.home, owner: ownerOf(l), free: !ownerOf(l), x: l.entry.x, z: l.entry.z })),
    asking: slug => asking(slug),
    stage: slug => (M.leaving?.slug === slug ? leaveStage(M.leaving, today()) : departed(slug) ? 'gone' : M.coming === slug ? 'coming' : M.arrived.includes(slug) ? 'moved' : null),
    count: countAll,
  };
}
