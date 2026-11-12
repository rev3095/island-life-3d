// M12 밤·새벽 콘텐츠 (밤·새벽 검수 보드 night 반영 v1 = D106–D114 모두 A). 설정은 assets/night/night.json 하나, 규칙은 rules.js (순수 함수).
//  - D106·D107 야시장: 토요일 19–24시 광장 북쪽에 노점 셋(축제 부스 모델 다시 씀) + 등불 줄 PR-30. 먹거리·밤 가구 노점 = ui.shop, 고리 던지기 = 도토리 내고 상품.
//    퐁·코코가 노점 둘레에 있고(hostSpot → town.pickSpot) 그날은 늦게 잔다(lateUntil → town rules 의 늦잠 고리).
//  - D109 달빛 가게: 광장 동쪽 언덕에 건물 BD-08 (밤 콘텐츠가 열린 뒤 늘 서 있고, 22–3시만 문이 열린다). 실내 RM-10 은 house/places.js 가 짓고
//    여기서는 문 규칙(placeRule) · 오늘의 진열(stockGroups) · 주인 별밤(CH-14) · 계산대 말 걸기 → ui.shop (곤충 팔 때 +20%, data.luck).
//  - D111 새벽 천막: 3–5시에만 동쪽 숲 끝에 BD-09 이 서고(안개와 함께 알림) 5시에 걷힌다. 주인 여명(CH-15)에게 말 걸면 UI-20 카드 뽑기.
//  - D112 타로: 하루 한 장, 다음 5시부터 하루 동안 data.luck 에 그 카드 보너스. UI-21 오늘 운세 칸.
//  - D108·D110 야행성 주민: 달무리 시간표(assets/villagers/dalmuri.json, 19–5시 깨어 있음)는 town 이 그대로 돌리고, 낮엔 문 옆에 「자는 중」 쪽지 PR-32,
//    밤에 처음 놀러 가면 마음 +.
//  - D113 행사 날(불꽃놀이·수확 잔치)·섬 축제 날엔 야시장만 쉰다. D114 밤 콘텐츠는 첫날 안내를 마친 다음 날부터.
//  - P54 밤 특별 상점 (D165–D169, docs/notes/night-special.md): 운세 부스 BD-15 (20–3시 광장 남서쪽, 여명이 저녁엔 여기서 카드) ·
//    수상한 여우 상인 BD-14 (가끔 오는 밤, 실내 RM-18 에서 미술품 2–3점 · 진품·가품 섞임 · 감정 대사) · 이상한 천막 BD-13 (가끔, 주인 없이 받침 하나) ·
//    선물 상자 PR-35 (낮·밤, 섬 풀밭 어딘가 — 열면 미술품·가구·도토리). 서는 날·진열은 rules.js 의 (섬 씨앗 · 날) 난수로 정해진다.
// 시각은 언제나 ctx.services.time.now() (섬폰 시계 바늘이 옮긴 시각 그대로). 저장 칸 state.night (이 모듈 몫). 약속 docs/CONTRACTS.md 「밤」.
import * as R from './rules.js';
import { openDraw, createFortuneChip, openFortune, ensureNightCss } from './ui.js';
import { createActor } from '../town/actor.js';

export const CONFIG_FILE = 'assets/night/night.json';
const NEAR = 1.7;          // 노점 · 계산대 행동 거리
const DESK_DIST = 2.6;     // 실내 말 거는 자리 → 주인 (keepers.js 와 같게)
const STALL_CLEAR = 2.2;   // 노점 앞 비워 둘 거리 (주민이 서지 않는다)
const DOOR_CLEAR = 1.6;
const FAR = 6;            // 새벽 천막 ↔ 달빛 가게 (칸)
const DEFAULT_LOT = { 'night-shop': [4, 3], 'dawn-tent': [3, 3], 'fortune-booth': [3, 3], 'fox-shop': [3, 3], 'odd-tent': [3, 3] };
const GIFT_NEAR = 1.3;     // 선물 상자 열기 거리

let N = null;

function createNight(ctx, cfg) {
  const S = () => ctx.services;
  const st = () => {
    const s = (ctx.state.night ||= {});
    s.v ??= 1;
    s.spots ??= {};       // 건물 자리 { moonshop: {tx, tz, x, z, door, fw, fd}, tent: … } — 한 번 정하면 그대로
    s.tarot ??= {};       // { card, drawnOn (뽑은 게임 날), forDay (기운이 있는 날) }
    s.met ??= {};         // 가게 주인 처음 만남 { byeolbam: dayKey }
    s.visits ??= {};      // 야행성 주민 밤 방문 { dalmuri: dayKey (처음) }
    s.friend ??= null;    // 타로 「친구」 받은 날
    s.acorns ??= null;    // 타로 「도토리」 받은 날
    s.market ??= null;    // 야시장 알림을 보낸 날
    s.visit ??= {};       // P54 여우 상인·이상한 천막이 마지막으로 선 날 { foxshop: dayKey, oddtent: dayKey }
    s.fox ??= {};         // 여우 상인에게 산 것 { day, ids: [] }
    s.gift ??= {};        // 선물 상자 { day, spot: {tx, tz, x, z}, opened }
    return s;
  };
  const cards = cfg.tarot.cards;
  const now = () => S().time?.now?.() ?? null;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const world = () => S().world;
  const isl = () => world()?.island;

  // ── 열렸나 (D114-A) ──
  function introDay() {
    const f = ctx.state.flags ?? {};
    const d = f.firstday?.done?.intro;
    if (typeof d === 'string') return d;
    return d || f.intro ? '2000-01-01' : null;   // 목록이 생기기 전 저장 = 오래전에 마침
  }
  function isOpen(n = now()) {
    if (!n) return false;
    const day = introDay();
    return !!day && R.daysBetween(day, n.dayKey) >= (cfg.opensAfterDay ?? 1);
  }

  // ── 건물 자리 ──
  const placed = { moonshop: null, tent: null, fortune: null, foxshop: null, oddtent: null, gift: null, sleepNotes: new Map(), market: null };   // 섬에 놓은 world 물체 id
  const lotOf = async kind => {
    try { const sp = await ctx.assets.loadEnvSpec(kind); if (Array.isArray(sp?.world?.lot)) return sp.world.lot; } catch { /* 모델이 아직 없으면 기본 */ }
    return DEFAULT_LOT[kind] ?? [3, 3];
  };
  /** 칸 검사 — mode 'floor' 건물 바닥 (풀밭 · 단단한 물체 없음 · 다른 건물 문 앞마당 밖) · 'open' 둘레 (걸을 수 있는 땅) · 'clear' 문 앞 (걸을 수 있고 물체 없음) */
  function cellFn(mode, grounds = ['grass']) {   // P54: grounds = 바닥으로 쓸 땅 (이상한 천막은 모래밭도)
    const W = world(), I = isl(), doors = R.doorsOf(W.places);
    const hard = (tx, tz) => W.objects.on?.(tx, tz)?.some(o => !R.SOFT_KINDS.has(o.kind)) ?? !!W.objects.at(tx, tz);
    return (tx, tz) => {
      if (tx < 0 || tz < 0 || tx >= I.w || tz >= I.h) return false;
      const c = I.toWorld(tx, tz), k = I.tileAt(tx, tz);
      if (k === 'water' || k === 'sea' || k === 'cliff' || k === 'ramp') return false;
      if (mode === 'open') return true;   // 둘레엔 나무가 있어도 된다
      if (mode === 'clear') return !hard(tx, tz);   // 문 앞: 단단한 물체 없음 (꽃·잡초는 밟고 지나간다)
      return grounds.includes(k) && !hard(tx, tz) && !R.nearDoor(doors, c);
    };
  }
  /** 건물 기준점: 달빛 가게 = 광장에서 offset 칸 (동쪽), 천막 = 섬 동쪽 끝 쪽 */
  function anchorOf(kind) {
    const W = world(), I = isl();
    if (kind === 'moonshop') {
      const p = W.places.plaza, [ox, oz] = cfg.shop.offset ?? [17, -13];
      return { x: p.x + ox, z: p.z + oz };   // 광장 북쪽 언덕 (보드 D109-A 는 「동쪽 언덕」 — 동쪽 언덕엔 3×3 빈 곳이 없어 박물관 서쪽 언덕)
    }
    if (kind === 'fortune') {   // P54 운세 부스: 광장 남서쪽
      const p = W.places.plaza, [ox, oz] = cfg.fortune.offset ?? [-12, 8];
      return { x: p.x + ox, z: p.z + oz };
    }
    const sp = kinds[kind]?.spot;   // P54 여우 상인(서쪽) · 이상한 천막(북서쪽): 섬 크기 비율
    if (Array.isArray(sp)) return { x: I.w * sp[0], z: I.h * sp[1] };
    return { x: I.w * 0.29, z: I.h * 0.26 };   // 섬 가운데가 (0,0) — 남동쪽 숲 끝 (보드 D111-A)
  }
  async function spotOf(kind, building) {
    // P54: 앞 순서 건물(달빛 가게·새벽 천막…)의 자리를 먼저 정해 둔다 — 아직 안 선 건물 자리를 새 건물이 가로채지 않게
    for (const k of NIGHT_PLACES.slice(0, NIGHT_PLACES.indexOf(kind))) if (!st().spots[k]) await spotOf(k, kinds[k].building);
    const s = st().spots[kind];
    const free0 = cellFn('floor', kinds[kind]?.ground);
    // 다른 밤 건물(지금 서 있지 않아도 자리를 정해 둔 것)과 떨어지게 (FAR 칸 안쪽은 건물 바닥으로 안 씀) — 천막은 달빛 가게와, P54 건물은 서로·모두와
    // 앞 순서(NIGHT_PLACES: 달빛 가게 → 천막 → 운세 부스 → 여우 → 이상한 천막)의 정해 둔 자리 + 지금 서 있는 건물만 피한다 (뒤 순서끼리 서로 막아 둘 다 못 서는 일이 없게)
    const order = NIGHT_PLACES.indexOf(kind);
    const I = isl(), others = Object.entries(st().spots).filter(([k, v]) => k !== kind && v && (NIGHT_PLACES.indexOf(k) < order || placed[k])).map(([, v]) => v);
    const free = others.length ? (tx, tz) => free0(tx, tz) && others.every(o => Math.hypot(I.toWorld(tx, tz).x - o.x, I.toWorld(tx, tz).z - o.z) > FAR) : free0;
    if (s && occupiedOk(s, free)) return s;
    const lot = await lotOf(building);
    const spot = R.buildingSpot(anchorOf(kind), lot, { isFree: free, isOpen: cellFn('open'), isClear: cellFn('clear'), levelAt: (tx, tz) => I.levelAt(tx, tz), toTile: I.toTile, toWorld: I.toWorld, reach: kinds[kind]?.reach ?? 18 });
    if (spot) st().spots[kind] = spot;
    return spot;
  }
  /** 저장해 둔 자리가 아직 비어 있나 (섬 꾸미기로 뭘 놓았으면 다시 찾는다) */
  function occupiedOk(s, free) {
    for (let tz = s.tz; tz < s.tz + s.fd; tz++) for (let tx = s.tx; tx < s.tx + s.fw; tx++) if (!free(tx, tz)) return false;
    return true;
  }
  const pending = new Set();
  const warned = new Set();
  let placing = Promise.resolve();   // P54: 건물 자리 찾기를 하나씩 (같은 틱에 둘이 같은 자리를 고르지 않게 — 앞 건물 자리가 st().spots 에 들어간 뒤 다음)
  function putBuilding(kind, building) {
    if (placed[kind] || pending.has(kind)) return placing;
    pending.add(kind);
    placing = placing.then(() => placeOne(kind, building)).catch(e => console.warn('[night] 건물을 못 놓았어요', kind, e)).finally(() => pending.delete(kind));
    return placing;
  }
  async function placeOne(kind, building) {
    {
      const W = world();
      if (!W?.objects) return;
      const s = await spotOf(kind, building);
      if (!s) { if (!warned.has(kind)) { warned.add(kind); console.warn('[night] 건물 자리를 못 찾았어요 (섬에 빈 곳이 없음)', kind); } return; }
      const t = isl().toTile(s.x, s.z);
      const id = W.objects.add(building, t.tx, t.tz, { persist: false, at: { x: s.x, z: s.z } });
      if (!id) return;
      placed[kind] = id;
      const tile = isl().toTile(s.door.x, s.door.z);
      W.places[kind] = { x: s.x, z: s.z, door: { ...s.door }, tx: tile.tx, tz: tile.tz };
    }
  }
  function takeBuilding(kind) {
    if (!placed[kind]) return;
    if (S().house?.where === kind) return;   // 안에 있는 동안은 걷지 않는다 (나오면 다음 sync 에)
    world()?.objects?.remove(placed[kind]);
    placed[kind] = null;
    if (world()?.places) delete world().places[kind];
  }

  // ── 야시장 (D106·D107·D113) ──
  function eventsLive() {
    const E = S().events;
    try { return E?.isOpen?.() === false ? [] : (E?.live?.() ?? []).map(r => r.ev.id); } catch { return []; }
  }
  const market = (n = now()) => (n && isOpen(n) ? R.marketPlan(n, cfg.market, { eventsLive: eventsLive(), festivalToday: !!S().festival?.due?.() }) : { today: false, open: false, why: 'closed' });
  /** 노점 자리: 축제 광장 가운데 둘레에서 빈 곳 셋 (서로 2.6칸 넘게) */
  function marketSpots() {
    const W = world(), I = isl(), F = W.places.festival ?? W.places.plaza, C = F.center ?? F;
    const free = cellFn('clear'), plazaOk = (tx, tz) => { const k = I.tileAt(tx, tz); return (k === 'plaza' || k === 'grass' || k === 'path') && I.isWalkable(I.toWorld(tx, tz).x, I.toWorld(tx, tz).z) && !W.objects.at(tx, tz); };
    const out = [];
    for (const r of [4.2, 5.2, 6.4, 7.6]) for (let i = 0; i < 24 && out.length < cfg.market.stalls.length; i++) {
      const a = Math.PI * (0.5 + ((i % 2 ? 1 : -1) * Math.ceil(i / 2)) / 12);   // 북쪽부터 좌우로 번갈아
      const x = C.x + Math.cos(a) * r, z = C.z - Math.sin(a) * r, t = I.toTile(x, z);
      const ok = [[0, 0], [-1, 0], [1, 0]].every(([dx, dz]) => plazaOk(t.tx + dx, t.tz + dz) || free(t.tx + dx, t.tz + dz)) && plazaOk(t.tx, t.tz + 1);
      if (!ok || out.some(o => Math.hypot(o.x - x, o.z - z) < 3.2)) continue;
      out.push({ x, z, rot: 0 });
    }
    return out;
  }
  function putMarket() {
    if (placed.market) return;
    const W = world(), I = isl();
    const spots = marketSpots();
    if (spots.length < cfg.market.stalls.length) { console.warn('[night] 야시장 노점 자리가 모자라요', spots.length); }
    const ids = [], stalls = [];
    cfg.market.stalls.forEach((s, i) => {
      const p = spots[i];
      if (!p) return;
      const t = I.toTile(p.x, p.z);
      const id = W.objects.add(s.kind, t.tx, t.tz, { persist: false, at: { x: p.x, z: p.z }, rot: p.rot });
      if (id) ids.push(id);
      stalls.push({ ...s, x: p.x, z: p.z, front: { x: p.x, z: p.z + 1.25 } });
    });
    for (const p of R.lanternSpots(stalls)) {
      const t = I.toTile(p.x, p.z);
      const id = W.objects.add(cfg.market.lanterns, t.tx, t.tz, { persist: false, at: { x: p.x, z: p.z - 0.4 }, rot: 0 });
      if (id) ids.push(id);
    }
    placed.market = { ids, stalls };
  }
  function takeMarket() {
    if (!placed.market) return;
    for (const id of placed.market.ids) world()?.objects?.remove(id);
    placed.market = null;
  }

  // ── 야행성 주민 「자는 중」 쪽지 (D110-A) ──
  const nocturnal = cfg.nocturnal.villagers;
  function syncNotes(n) {
    const W = world(), I = isl(), T = S().town;
    for (const slug of nocturnal) {
      const lives = (T?.residents?.() ?? []).includes(slug);
      const want = lives && isOpen(n) && T?.atHome?.(slug) === 'sleep';
      const id = placed.sleepNotes.get(slug);
      if (want && !id) {
        const h = W.places.villagerHouses?.find(v => v.slug === slug);
        if (!h?.door) continue;
        const x = h.door.x + 1.15, z = h.door.z + 0.35, t = I.toTile(x, z);
        const nid = W.objects.add(cfg.nocturnal.note, t.tx, t.tz, { persist: false, at: { x, z }, rot: 0 });
        if (nid) placed.sleepNotes.set(slug, nid);
      } else if (!want && id) {
        W.objects.remove(id);
        placed.sleepNotes.delete(slug);
      }
    }
  }

  // ── 가게 주인 (CH-14 별밤 · CH-15 여명) ──
  const keepers = {};   // kind → { actor, person }
  const kinds = { moonshop: cfg.shop, tent: cfg.tent, fortune: cfg.fortune, foxshop: cfg.fox, oddtent: cfg.odd };   // P54: 운세 부스 · 여우 상인 · 이상한 천막
  const NIGHT_PLACES = Object.keys(kinds).filter(k => kinds[k]);
  const KEEPER_PLACES = NIGHT_PLACES.filter(k => kinds[k].keeper);
  async function keeperOf(kind) {
    const c = kinds[kind];
    if (keepers[kind]) return keepers[kind];
    if (!c?.keeper) return null;
    const L = cfg.lines[c.keeper];
    const person = { slug: c.keeper, name: L.name, color: L.color, voice: L.voice };
    keepers[kind] = { person, actor: null, loading: createActor(ctx, c.keeper).then(a => { keepers[kind].actor = a; a.setOpacity(0); a.root.visible = false; return a; })
      .catch(e => { console.warn('[night] 가게 주인 모델을 못 받았어요 (말은 걸 수 있어요)', c.keeper, e); return null; }) };
    return keepers[kind];
  }
  async function showKeeper(kind) {
    const K = await keeperOf(kind);
    const a = await K?.loading;
    const spot = S().house?.places?.info?.(kind)?.keeper;
    if (!a || !spot) return;
    a.root.visible = true;
    a.place(spot.x, spot.z, spot.facing);
    a.setOpacity(1); a.fadeTo = 1;
    a.play?.('idle');
  }
  function hideKeeper(kind) { const a = keepers[kind]?.actor; if (a) { a.root.visible = false; a.setOpacity(0); } }

  /** 달빛 가게·천막 문 (house/places.js 가 문 쪽으로 밀 때·문 앞 행동 키): 'open' | 'closed' | null (건물이 없음) */
  /** [22, 27] → '밤 10시–새벽 3시에 열어요' (게임 하루 시각 5~29) */
  function openText(hours) {
    if (!Array.isArray(hours)) return '';
    const t = h => { const x = ((h % 24) + 24) % 24; const part = h >= 24 || x < 5 ? '새벽' : x < 12 ? '오전' : x < 18 ? '오후' : '밤'; const hh = x === 0 ? 12 : x > 12 ? x - 12 : x; return `${part} ${hh}시`; };
    return `${t(hours[0])}–${t(hours[1])}에 열어요`;
  }
  function placeRule(kind, n = now()) {
    const c = kinds[kind];
    if (!c || !n || !placed[kind]) return null;
    return R.placeOpen(c, n.hourF) ? 'open' : 'closed';
  }
  function stockGroups(kind) {
    const c = kinds[kind];
    if (!c) return {};
    const have = id => !!S().data?.items?.get?.(id);
    if (kind === 'foxshop') return { art: foxLeft(), furniture: (c.stock ?? []).filter(have) };   // P54 받침 셋에 미술품, 앞에 여우불 등
    if (kind === 'oddtent') { const o = oddToday(); return o && have(o.id) && !holding(o.id) ? { [o.group]: [o.id] } : {}; }
    return { furniture: (c.stock ?? []).filter(have) };
  }

  // ── P54 미술품 · 여우 상인 · 이상한 천막 · 선물 상자 (D165–D169) ──
  const seed = () => ctx.state.island?.seed ?? 0;
  /** 진품 16점 + 가품 id (가품이 있는 작품만) */
  function works() {
    const it = S().data?.items;
    return (it?.list?.('art') ?? []).map(a => ({ id: a.id, fake: it.get(`${a.id}-fake`) ? `${a.id}-fake` : null }));
  }
  const holding = id => (S().data?.inventory?.slots ?? []).some(x => x?.id === id);
  const forced = {};   // 점검용 (debug.force) — 저장하지 않는다
  /** 그 가게가 오늘 오나 (여우 상인 · 이상한 천막) — 여우는 열린 첫날 밤 꼭, 천막은 열린 날부터 센다 */
  const visits = (kind, n = now()) => !!forced[kind] || (!!n && R.visitsToday(n.dayKey, seed(), kinds[kind], { last: st().visit[kind] ?? null, since: kind === 'foxshop' ? null : introDay() }));
  function foxToday(n = now()) { return n ? R.foxStock(works(), n.dayKey, seed(), cfg.fox) : []; }
  /** 오늘 아직 안 판 미술품 (산 것 · 지금 가방에 있는 것은 받침에서 뺀다) */
  function foxLeft(n = now()) {
    const sold = st().fox.day === n?.dayKey ? st().fox.ids ?? [] : [];
    return foxToday(n).filter(id => !sold.includes(id) && !holding(id));
  }
  function oddToday(n = now()) { return n ? R.oddStock(works(), n.dayKey, seed(), cfg.odd) : null; }

  // 달빛 가게 안에서만: 곤충을 팔 때 +20% (data.luck — 타로 보너스에 더한다)
  let shopBonus = null;
  function luckTable() {
    const n = now(), card = n ? R.fortuneOf(st().tarot, cards, n.dayKey) : null;
    const out = { ...(card?.luck ?? {}) };
    if (shopBonus) for (const [cat, v] of Object.entries(shopBonus)) out[`sell:${cat}`] = (out[`sell:${cat}`] ?? 0) + v;
    return out;
  }

  const speak = who => (lines, choices) => S().ui.dialog.open({ speaker: who.name, color: who.color, lines: [lines].flat().filter(Boolean), voice: who.voice ?? who.slug, choices });
  const pick = list => list[Math.floor(Math.random() * list.length)];

  async function talkShop() {
    const n = now(), s = st(), K = await keeperOf('moonshop'), L = cfg.lines.byeolbam, say = speak(K.person);
    if (!s.met.byeolbam) { s.met.byeolbam = n.dayKey; await say(L.first); ctx.events.emit('night:met', { slug: 'byeolbam' }); }
    const a = await say([pick(L.greet)], ['살래요', '팔래요', '그냥 구경할게요']);
    if (a === 0 || a === 1) {
      shopBonus = cfg.shop.sellBonus ?? null;
      try { await S().ui.shop.open({ stock: stockGroups('moonshop').furniture, title: cfg.shop.name, tab: a === 1 ? 'sell' : 'buy', keeper: K.person.name, color: K.person.color, greet: ' 밤 곤충은 값을 더 쳐 줄게찍.' }); }
      finally { shopBonus = null; }
      await say([pick(L.after)]);
    } else await say(L.bye);
  }

  /** 여명 (새벽 천막 3–5시 · P54 운세 부스 20–3시): 카드 뽑기 UI-20 은 하루 한 장을 둘이 같이 쓴다 */
  async function talkTent(kind = 'tent') {
    const n = now(), s = st(), K = await keeperOf(kind), L = cfg.lines.yeomyeong, say = speak(K.person);
    const c = kinds[kind], booth = kind === 'fortune', goods = booth ? '물건 보기' : '수정 구슬 보기';
    const openGoods = () => S().ui.shop.open({ stock: stockGroups(kind).furniture, title: c.name, keeper: K.person.name, color: K.person.color, greet: booth ? L.goods ?? '' : ' 별을 담은 구슬이란다스르륵.' });
    if (!s.met.yeomyeong) { s.met.yeomyeong = n.dayKey; await say(booth ? L.firstBooth ?? L.first : L.first); ctx.events.emit('night:met', { slug: 'yeomyeong' }); }
    if (!R.canDraw(s.tarot, n.dayKey)) {
      const a = await say([...L.already], [goods, '그만']);
      if (a === 0) await openGoods();
      return;
    }
    const a = await say([pick(L.greet)], ['카드 뽑기', goods, '그만']);
    if (a === 1) { await openGoods(); return; }
    if (a !== 0) { await say(L.bye); return; }
    const id = await draw(n);
    if (id) await say([pick(L.after)]);
  }

  /** P54 여우 상인 살랑 (CH-17): 오늘의 미술품 고르기 → 감정 대사 → 값 → 사기 (한 밤에 perNight 점). 여우불 등은 상점 창 */
  async function talkFox() {
    const n = now(), s = st(), K = await keeperOf('foxshop'), L = cfg.lines.salang, say = speak(K.person), d = S().data, ui = S().ui, c = cfg.fox;
    if (!s.met.salang) { s.met.salang = n.dayKey; await say(L.first); ctx.events.emit('night:met', { slug: 'salang' }); }
    const a = await say([pick(L.greet)], L.menu);
    if (a === 1) { await ui.shop.open({ stock: stockGroups('foxshop').furniture, title: c.name, keeper: K.person.name, color: K.person.color, greet: ' 여우불은 밤길 친구지콩.' }); return; }
    if (a !== 0) { await say(L.bye); return; }
    if (s.fox.day !== n.dayKey) s.fox = { day: n.dayKey, ids: [] };
    if (s.fox.ids.length >= (c.perNight ?? 1)) { await say(L.soldOut); return; }
    const left = foxLeft(n);
    if (!left.length) { await say(L.empty); return; }
    const i = await say([L.pickAsk], [...left.map(id => d.items.get(id)?.name ?? id), '그만']);
    const id = left[i];
    if (!id) { await say(L.bye); return; }
    const it = d.items.get(id), fill = t => t.replaceAll('{name}', it.name).replaceAll('{price}', Number(it.buy).toLocaleString('ko-KR'));
    const ok = await say([fill(pick(it.fake ? L.fake : L.real)), fill(L.price)], ['살게요', '그만둘래요']);
    if (ok !== 0) { await say(L.bye); return; }
    const fits = d.inventory?.canFit ? d.inventory.canFit(id, 1) > 0 : !d.inventory?.isFull?.();
    if (!fits) { await say(L.full); return; }
    if (!d.wallet.spend(it.buy)) { await say(L.money); return; }
    if (!(d.inventory.add(id, 1) > 0)) { d.wallet.add(it.buy); await say(L.full); return; }
    s.fox.ids.push(id);
    ctx.events.emit('sfx', { name: 'acorn' });
    ui.toast?.(`${it.name}을(를) 샀어요`, it.icon);
    ctx.events.emit('night:art', { id, fake: !!it.fake, from: 'fox' });
    await say([pick(L.bought)]);
  }

  // ── P54 선물 상자 PR-35 (D169-A): 낮·밤, 오늘 섬 풀밭 어딘가에 하나 ──
  const giftToday = (n = now()) => (n && isOpen(n) ? R.giftPlan(works(), n.dayKey, seed(), cfg.gift) : { today: false, contents: null });
  function giftSpot(n) {
    const g = st().gift;
    if (g.day === n.dayKey && g.spot) return g.spot;
    const W = world(), I = isl(), doors = R.doorsOf(W.places), spots = Object.values(st().spots).filter(Boolean);
    const ok = (tx, tz) => {
      if (I.tileAt(tx, tz) !== 'grass' || W.objects.at(tx, tz)) return false;
      const c = I.toWorld(tx, tz);
      return I.isWalkable(c.x, c.z) && !R.nearDoor(doors, c) && spots.every(o => Math.hypot(c.x - o.x, c.z - o.z) > 4);
    };
    const cell = R.pickCell(R.rngOf(seed(), n.dayKey, 'gift-spot'), I.w, I.h, ok);
    if (!cell) return null;
    const c = I.toWorld(cell.tx, cell.tz);
    st().gift = { day: n.dayKey, spot: { tx: cell.tx, tz: cell.tz, x: c.x, z: c.z }, opened: false };
    return st().gift.spot;
  }
  function syncGift(n) {
    const want = giftToday(n).today && !(st().gift.day === n.dayKey && st().gift.opened);
    if (want && !placed.gift) {
      const sp = giftSpot(n);
      if (!sp) return;
      const id = world().objects.add(cfg.gift.prop, sp.tx, sp.tz, { persist: false, at: { x: sp.x, z: sp.z }, rot: 0 });
      if (id) placed.gift = { id, x: sp.x, z: sp.z, day: n.dayKey };
    } else if (placed.gift && (!want || placed.gift.day !== n.dayKey)) {
      world()?.objects?.remove(placed.gift.id);
      placed.gift = null;
    }
  }
  function giftInFront() {
    const g = placed.gift, p = S().player?.position, pl = S().player;
    if (!g || !p || S().house?.where) return null;
    const dx = g.x - p.x, dz = g.z - p.z, dist = Math.hypot(dx, dz);
    if (dist > GIFT_NEAR) return null;
    return dist < 0.5 || (dx * -Math.sin(pl.facing) + dz * -Math.cos(pl.facing)) / dist > 0.3 ? g : null;
  }
  function openGift() {
    const n = now(), d = S().data, L = cfg.lines.gift, got = giftToday(n).contents;
    if (!got) return;
    if (got.kind === 'acorns') { d.wallet.add(got.n); toast(L.acorns.replace('{n}', got.n), '🎁'); }
    else {
      const it = d.items.get(got.id);
      if (!it || !(d.collect(got.id, 1)?.added > 0)) { toast(L.full, '🎒'); return; }
      toast((got.kind === 'art' ? L.art : L.item).replace('{name}', it.name), it.icon);
      if (got.kind === 'art') ctx.events.emit('night:art', { id: got.id, fake: !!it.fake, from: 'gift' });
    }
    ctx.events.emit('sfx', { name: 'pickup' });
    st().gift.opened = true;
    ctx.events.emit('night:gift', { dayKey: n.dayKey, contents: got });
    syncGift(n);
  }

  /** UI-20 카드 뽑기 → 카드 id | null. 고르면 다음 게임 날 하루 동안 기운 */
  async function draw(n = now()) {
    const s = st();
    if (!R.canDraw(s.tarot, n.dayKey)) return null;
    const ids = R.spread(cards, n.dayKey, ctx.state.island?.seed ?? 0, cfg.tarot.pick ?? 3);
    const id = await openDraw(ctx, cards, ids);
    if (!id) return null;
    s.tarot = { card: id, drawnOn: n.dayKey, forDay: R.nextDayKey(n.dayKey) };
    ctx.events.emit('night:tarot', { card: id, forDay: s.tarot.forDay });
    return id;
  }

  // ── 야시장 노점 행동 ──
  function stallInFront() {
    const m = placed.market, p = S().player?.position;
    if (!m || !p || !market().open || S().house?.where) return null;
    const pl = S().player, fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
    let best = null, bd = Infinity;
    for (const s of m.stalls) {
      const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz);
      if (d > NEAR + 0.6 || d < 0.2) continue;
      if ((dx * fx + dz * fz) / d < 0.3) continue;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  async function useStall(s) {
    const ui = S().ui, d = S().data, L = cfg.lines.market;
    const host = s.host ? cfg.lines[s.host] ?? null : null;
    if (s.game === 'ring') return ringToss();
    const name = s.host ? ({ pong: '퐁', coco: '코코' })[s.host] ?? s.name : s.name;
    await ui.shop.open({ stock: s.stock.filter(id => d?.items?.get?.(id)), title: s.name, tab: 'buy', keeper: name, color: '#A8642E', greet: ' 야시장에 온 걸 환영해요!' });
    return host;
  }
  async function ringToss() {
    const ui = S().ui, d = S().data, c = cfg.market, L = cfg.lines.market;
    const fill = t => t.replace('{cost}', c.ringCost).replace('{n}', c.ringThrows);
    const a = await ui.dialog.open({ speaker: '고리 던지기', color: '#2F86A6', lines: [fill(L.ringIntro)], choices: [`던질래요 (🌰 ${c.ringCost})`, '그만'] });
    if (a !== 0) return;
    if (!d?.wallet?.spend?.(c.ringCost)) { ui.toast('도토리가 모자라요', '🌰'); return; }
    ctx.events.emit('sfx', { name: 'acorn' });
    const hits = R.ringToss(Math.random, c.ringThrows, c.ringHit);
    const prize = R.ringPrize(c.ringPrizes, hits);
    if (!prize) { await ui.dialog.open({ speaker: '고리 던지기', color: '#2F86A6', lines: [L.ringLose] }); return; }
    const id = pick(prize.items.filter(x => d.items?.get?.(x)));
    const it = id && d.items.get(id);
    await ui.dialog.open({ speaker: '고리 던지기', color: '#2F86A6', lines: [L.ringWin.replace('{hits}', hits).replace('{prize}', it?.name ?? '별사탕')] });
    if (id) { const res = d.collect(id, 1); if (res.added > 0) { ui.toast(`${it.name}을(를) 받았어요`, it.icon); ctx.events.emit('sfx', { name: 'pickup' }); } }
    ctx.events.emit('night:ring', { hits, prize: id ?? null });
  }

  // ── 실내 계산대 · 탁자 앞 (달빛 가게 · 천막) ──
  function deskInFront() {
    const where = S().house?.where;
    if (!KEEPER_PLACES.includes(where)) return null;
    const info = S().house?.places?.info?.(where), p = S().player?.position;
    if (!info?.keeper || !p) return null;
    return Math.hypot(info.keeper.x - p.x, info.keeper.z - p.z) < DESK_DIST ? where : null;
  }
  /** 섬에서 달빛 가게·천막 문 앞 */
  function doorInFront() {
    if (S().house?.where) return null;
    const p = S().player?.position, pl = S().player;
    if (!p) return null;
    for (const kind of NIGHT_PLACES) {
      const d = placed[kind] && world().places[kind]?.door;
      if (!d) continue;
      const dx = d.x - p.x, dz = d.z - p.z, dist = Math.hypot(dx, dz);
      const fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
      if (dist < 1.5 && (dist < 0.5 || (dx * fx + dz * fz) / dist > 0.3)) return kind;
    }
    return null;
  }

  // ── 하루 · 시각 맞추기 ──
  let last = { phase: null, day: null, market: null, tentOpen: null };
  function sync() {
    const n = now(), W = world();
    if (!n || !W?.objects || !W.places) return;
    const open = isOpen(n);
    // 달빛 가게: 열린 뒤 늘 (낮엔 덧문)
    if (open) putBuilding('moonshop', cfg.shop.building); else takeBuilding('moonshop');
    // 새벽 천막: 3–5시에만
    const tentNow = open && R.placeOpen(cfg.tent, n.hourF);
    if (tentNow) { putBuilding('tent', cfg.tent.building); if (last.tentOpen === false) toast('숲 끝에 안개가 끼었어요… 무언가 나타났어요', '🌫️'); }
    else takeBuilding('tent');
    last.tentOpen = tentNow;
    // P54 운세 부스 (매일 밤) · 여우 상인 · 이상한 천막 (오는 밤만) — 영업 시간에만 선다
    for (const [kind, msg] of [['fortune', null], ['foxshop', cfg.lines.fox?.toast], ['oddtent', cfg.lines.odd?.toast]]) {
      const c = kinds[kind];
      const up = open && R.placeOpen(c, n.hourF) && (kind === 'fortune' || visits(kind, n));
      if (up) {
        putBuilding(kind, c.building);
        if (kind !== 'fortune' && st().visit[kind] !== n.dayKey) { st().visit[kind] = n.dayKey; if (msg) toast(msg, kind === 'foxshop' ? '🦊' : '🎪'); ctx.events.emit('night:visitor', { kind, dayKey: n.dayKey }); }
      } else takeBuilding(kind);
    }
    if (open) syncGift(n); else if (placed.gift) { W.objects.remove(placed.gift.id); placed.gift = null; }
    // 야시장
    const m = market(n);
    if (m.open) putMarket(); else takeMarket();
    if (m.today && st().market !== n.dayKey && (m.open || m.why === 'later')) {
      st().market = n.dayKey;
      toast(m.open ? cfg.lines.market.start : cfg.lines.market.morning, '🏮');
      ctx.events.emit('night:market', { open: m.open, dayKey: n.dayKey });
    }
    if (last.market !== m.open) { last.market = m.open; ctx.events.emit('night:market', { open: m.open, dayKey: n.dayKey }); }
    syncNotes(n);
    // 하루가 바뀜: 타로 「도토리」
    if (last.day !== n.dayKey) {
      last.day = n.dayKey;
      const card = R.fortuneOf(st().tarot, cards, n.dayKey);
      const acorns = card?.luck?.acorns ?? 0;
      if (acorns > 0 && st().acorns !== n.dayKey && open) {
        st().acorns = n.dayKey;
        S().data?.wallet?.add?.(acorns);
        toast(`카드 「${card.name}」의 기운 — 도토리 ${acorns}개가 굴러왔어요`, '🔮');
      }
    }
    const ph = R.phaseOf(n.hourF);
    if (ph !== last.phase) { last.phase = ph; ctx.events.emit('night:phase', { phase: ph, dayKey: n.dayKey }); }
    chipSync(n);
  }

  // ── UI-21 오늘 운세 칸 ──
  let chip = null;
  function chipSync(n = now()) {
    if (!chip) return;
    const card = n ? R.fortuneOf(st().tarot, cards, n.dayKey) : null;
    chip.show(card, card ? cards.indexOf(card) + 1 : 1);
  }

  // ── 야행성 주민 밤 방문 (D110-A) ──
  function onHouseEnter(e = {}) {
    const slug = e.owner ?? e.slug ?? null, n = now();
    if (!slug || !n || !nocturnal.includes(slug) || !R.nightHouseOpen(cfg.nocturnal, n.hourF)) return;
    const s = st();
    if (s.visits[slug]) return;
    s.visits[slug] = n.dayKey;
    const up = S().town?.befriend?.(slug, cfg.nocturnal.firstNightVisitBonus ?? 2);
    toast('밤에 놀러 와서 반가워해요', '🌙');
    ctx.events.emit('night:visit', { slug, up: up ?? null });
  }

  // ---- 첫 방문 장면 (s20 달빛 가게 · s21 새벽 천막, 트리거 night-first) ----
  // house/places.js enter 가 들어가기 전에 기다린다: 문 앞에서 night:first → story 가 줄을 세우면 그 장면이 끝날 때까지.
  // 장면은 집 안에서 못 트니(story free) 섬 문 앞에서 튼다. 처음 한 번만 (state.night.visited — 장면이 없어도 표시).
  let gate = null;            // { id, res, t, started }
  function firstVisit(kind) {
    if (!NIGHT_PLACES.includes(kind)) return null;
    const s = st(), door = world()?.places?.[kind]?.door;
    s.visited ??= {};
    if (s.visited[kind] || !door) return null;
    s.visited[kind] = now()?.dayKey ?? true;
    if (s.met?.[kinds[kind]?.keeper]) return null;   // 장면이 생기기 전에 이미 들어가 본 저장
    const story = S().story;
    if (!story) return null;
    const before = new Set(story.queue ?? []);
    ctx.events.emit('night:first', { kind, x: door.x, z: door.z, name: kinds[kind]?.name ?? '' });
    const id = (story.queue ?? []).find(q => !before.has(q));
    if (!id) return null;
    gate?.res();
    return new Promise(res => { gate = { id, res, t: 0, started: false }; });
  }
  ctx.events.on('story:start', ({ id } = {}) => { if (gate?.id === id) gate.started = true; });
  ctx.events.on('story:end', ({ id } = {}) => { if (gate?.id === id) { const g = gate; gate = null; g.res(); } });

  const service = {
    config: cfg,
    firstVisit,
    get open() { return isOpen(); },
    phase: () => { const n = now(); return n ? R.phaseOf(n.hourF) : 'day'; },
    market: () => market(),
    placeRule, stockGroups,
    /** town.pickSpot: 야시장 시간에 노점 주인 주민이면 그 노점 자리 {x, z} */
    hostSpot(slug) {
      const m = placed.market;
      if (!m || !market().open) return null;
      const s = m.stalls.find(x => x.host === slug);
      return s ? { x: s.x, z: s.z } : null;
    },
    /** town: 그날 늦게 자는 시각 (야시장 날 노점 주인) */
    lateUntil(slug, dayKey) {
      if (!cfg.market.hosts.includes(slug) || R.weekdayOf(dayKey) !== cfg.market.weekday) return null;
      const n = now();
      if (!n || !isOpen(n)) return null;
      return cfg.market.hostsLate ?? 24.5;
    },
    /** town.keepClear: 주민이 서지 않을 자리 */
    clearSpots() {
      const out = [];
      for (const s of placed.market?.stalls ?? []) out.push({ x: s.front.x, z: s.front.z, r: STALL_CLEAR });
      for (const k of NIGHT_PLACES) { const d = placed[k] && world()?.places?.[k]?.door; if (d) out.push({ x: d.x, z: d.z, r: DOOR_CLEAR }); }
      if (placed.gift) out.push({ x: placed.gift.x, z: placed.gift.z, r: GIFT_NEAR });
      return out;
    },
    /** 오늘 기운이 있는 카드 | null */
    fortune() { const n = now(); return n ? R.fortuneOf(st().tarot, cards, n.dayKey) : null; },
    /** town/talk.js: 그날 처음 말 건 주민 → 더할 친밀도 (타로 「친구」, 하루 한 번) */
    claimFriend(slug) {
      const n = now(), card = n && R.fortuneOf(st().tarot, cards, n.dayKey), v = card?.luck?.friend ?? 0;
      if (!v || st().friend === n.dayKey) return 0;
      st().friend = n.dayKey;
      ctx.events.emit('night:friend', { slug });
      return v;
    },
    draw: () => draw(),
    debug: {
      placed: () => ({ moonshop: placed.moonshop, tent: placed.tent, fortune: placed.fortune, foxshop: placed.foxshop, oddtent: placed.oddtent, gift: placed.gift, market: placed.market?.stalls.map(s => ({ id: s.id, x: +s.x.toFixed(2), z: +s.z.toFixed(2) })) ?? null, notes: [...placed.sleepNotes.keys()] }),
      spots: () => ({ ...st().spots }),
      setCard(id, dayKey = now()?.dayKey) { st().tarot = { card: id, drawnOn: null, forDay: dayKey }; chipSync(); },
      sync,
      /** 점검용: 오늘 밤 여우 상인·이상한 천막을 꼭 세운다 (저장하지 않음) — debug.force({ foxshop: true, oddtent: true }) */
      force(o = {}) { Object.assign(forced, o); sync(); return { ...forced }; },
      /** 오늘의 진열·선물 (점검·봇이 볼 곳) */
      today: () => ({ fox: foxToday(), foxLeft: foxLeft(), odd: oddToday(), gift: giftToday(), giftAt: placed.gift ? { x: placed.gift.x, z: placed.gift.z } : null, visits: { foxshop: visits('foxshop'), oddtent: visits('oddtent') } }),
    },
    /** P54: 밤 가게 종류 (world.places · house.places 의 이름) */
    places: () => NIGHT_PLACES.slice(),
    /** P54 선물 상자 자리 (오늘 섬에 있으면 {x, z}) */
    giftSpot: () => (placed.gift ? { x: placed.gift.x, z: placed.gift.z } : null),
  };

  function register(gp) {
    gp.add({
      name: 'night:stall', intent: 'action', priority: 101,   // 행사 할 일과 같은 자리: 노점 주인 주민의 말 걸기(100)보다 먼저
      label: s => (s?.game === 'ring' ? '고리 던지기' : '노점'),
      test: () => stallInFront(),
      run: s => useStall(s),
    });
    gp.add({
      name: 'night:desk', intent: 'action', priority: 90,   // 실내 계산대 앞 (도토리상점 town:shop 과 같은 자리)
      label: '말 걸기',
      test: () => deskInFront(),
      run: kind => (kind === 'moonshop' ? talkShop() : kind === 'foxshop' ? talkFox() : talkTent(kind)),
    });
    gp.add({
      name: 'night:gift', intent: 'action', priority: 55,   // P54 선물 상자 (줍기 50 · 나무 흔들기 60 사이)
      label: cfg.lines.gift?.label ?? '열기',
      test: () => giftInFront(),
      run: () => openGift(),
    });
    gp.add({
      name: 'night:door', intent: 'action', priority: 90,   // 섬: 달빛 가게 · 천막 문
      // P46 FB-03: 닫혀 있으면 문 앞 글자에 여는 시각을 보여 준다 (예전엔 「들어가기」 → 눌러야 「닫혔어요」)
      label: kind => (placeRule(kind) === 'open' ? '들어가기' : `닫힘 · ${openText(kinds[kind]?.hours)}`),
      test: () => doorInFront(),
      run: kind => {
        if (placeRule(kind) === 'open') return S().house?.places?.enter?.(kind);
        const L = cfg.lines[kinds[kind].keeper ?? 'odd'];
        ctx.events.emit('sfx', { name: 'door', volume: 0.4 });
        toast((L?.closed?.[0] ?? '닫혀 있어요').replace(/^\(|\)$/g, ''), { moonshop: '🌙', foxshop: '🦊', oddtent: '🎪', fortune: '🔮' }[kind] ?? '🌫️');
      },
    });
  }

  function init() {
    ensureNightCss();
    S().data?.luck?.set?.(luckTable);
    chip = createFortuneChip(ctx.uiRoot, { onOpen: () => { const c = service.fortune(); if (c) openFortune(ctx, c, cards.indexOf(c) + 1); } });
    ctx.events.on('place:enter', ({ place } = {}) => { if (KEEPER_PLACES.includes(place)) showKeeper(place); });
    ctx.events.on('place:leave', ({ place } = {}) => { if (KEEPER_PLACES.includes(place)) hideKeeper(place); });
    ctx.events.on('house:enter', onHouseEnter);
    ctx.events.on('story:start', () => chip?.hide(true));
    ctx.events.on('story:end', () => chip?.hide(false));
    for (const name of ['time:newday', 'data:loaded', 'festival:end', 'events:start']) ctx.events.on(name, () => sync());
  }

  let clock = 0;
  function update(dt) {
    // 첫 방문 장면이 줄에서 빠졌는데(다른 장면에 밀려 지워짐 등) 안 틀리면 그냥 들어간다
    if (gate && !gate.started && (gate.t += dt) > 8 && !(S().story?.queue ?? []).includes(gate.id)) { const g = gate; gate = null; g.res(); }
    clock += dt;
    if (clock >= 1) { clock = 0; sync(); }
    for (const K of Object.values(keepers)) if (K.actor?.root.visible) K.actor.update(dt, true);
  }

  return { service, register, init, update, sync };
}

export default {
  name: 'night',

  async init(ctx) {
    const cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(CONFIG_FILE) : fetch(CONFIG_FILE).then(r => r.json()));
    N = createNight(ctx, cfg);
    ctx.services.night = N.service;
    const gp = ctx.services.gameplay?.interactions;
    if (gp) N.register(gp);
    N.init();
    N.sync();
  },

  update(dt) { N?.update(dt); },
};
