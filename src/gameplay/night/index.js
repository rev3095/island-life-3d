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
const DEFAULT_LOT = { 'night-shop': [4, 3], 'dawn-tent': [3, 3] };

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
  const placed = { moonshop: null, tent: null, sleepNotes: new Map(), market: null };   // 섬에 놓은 world 물체 id
  const lotOf = async kind => {
    try { const sp = await ctx.assets.loadEnvSpec(kind); if (Array.isArray(sp?.world?.lot)) return sp.world.lot; } catch { /* 모델이 아직 없으면 기본 */ }
    return DEFAULT_LOT[kind] ?? [3, 3];
  };
  /** 칸 검사 — mode 'floor' 건물 바닥 (풀밭 · 단단한 물체 없음 · 다른 건물 문 앞마당 밖) · 'open' 둘레 (걸을 수 있는 땅) · 'clear' 문 앞 (걸을 수 있고 물체 없음) */
  function cellFn(mode) {
    const W = world(), I = isl(), doors = R.doorsOf(W.places);
    const hard = (tx, tz) => W.objects.on?.(tx, tz)?.some(o => !R.SOFT_KINDS.has(o.kind)) ?? !!W.objects.at(tx, tz);
    return (tx, tz) => {
      if (tx < 0 || tz < 0 || tx >= I.w || tz >= I.h) return false;
      const c = I.toWorld(tx, tz), k = I.tileAt(tx, tz);
      if (k === 'water' || k === 'sea' || k === 'cliff' || k === 'ramp') return false;
      if (mode === 'open') return true;   // 둘레엔 나무가 있어도 된다
      if (mode === 'clear') return !hard(tx, tz);   // 문 앞: 단단한 물체 없음 (꽃·잡초는 밟고 지나간다)
      return k === 'grass' && !hard(tx, tz) && !R.nearDoor(doors, c);
    };
  }
  /** 건물 기준점: 달빛 가게 = 광장에서 offset 칸 (동쪽), 천막 = 섬 동쪽 끝 쪽 */
  function anchorOf(kind) {
    const W = world(), I = isl();
    if (kind === 'moonshop') {
      const p = W.places.plaza, [ox, oz] = cfg.shop.offset ?? [17, -13];
      return { x: p.x + ox, z: p.z + oz };   // 광장 북쪽 언덕 (보드 D109-A 는 「동쪽 언덕」 — 동쪽 언덕엔 3×3 빈 곳이 없어 박물관 서쪽 언덕)
    }
    return { x: I.w * 0.29, z: I.h * 0.26 };   // 섬 가운데가 (0,0) — 남동쪽 숲 끝 (보드 D111-A)
  }
  async function spotOf(kind, building) {
    const s = st().spots[kind];
    const free0 = cellFn('floor');
    // 천막은 달빛 가게와 떨어져 숲 끝에 (FAR 칸 안쪽은 건물 바닥으로 안 씀)
    const other = kind === 'tent' ? st().spots.moonshop : null, I = isl();
    const free = other ? (tx, tz) => free0(tx, tz) && Math.hypot(I.toWorld(tx, tz).x - other.x, I.toWorld(tx, tz).z - other.z) > FAR : free0;
    if (s && occupiedOk(s, free)) return s;
    const lot = await lotOf(building);
    const spot = R.buildingSpot(anchorOf(kind), lot, { isFree: free, isOpen: cellFn('open'), isClear: cellFn('clear'), levelAt: (tx, tz) => I.levelAt(tx, tz), toTile: I.toTile, toWorld: I.toWorld, reach: 18 });
    if (spot) st().spots[kind] = spot;
    return spot;
  }
  /** 저장해 둔 자리가 아직 비어 있나 (섬 꾸미기로 뭘 놓았으면 다시 찾는다) */
  function occupiedOk(s, free) {
    for (let tz = s.tz; tz < s.tz + s.fd; tz++) for (let tx = s.tx; tx < s.tx + s.fw; tx++) if (!free(tx, tz)) return false;
    return true;
  }
  const pending = new Set();
  async function putBuilding(kind, building) {
    if (placed[kind] || pending.has(kind)) return;
    pending.add(kind);
    try {
      const W = world();
      if (!W?.objects) return;
      const s = await spotOf(kind, building);
      if (!s) { console.warn('[night] 건물 자리를 못 찾았어요', kind); return; }
      const t = isl().toTile(s.x, s.z);
      const id = W.objects.add(building, t.tx, t.tz, { persist: false, at: { x: s.x, z: s.z } });
      if (!id) return;
      placed[kind] = id;
      const tile = isl().toTile(s.door.x, s.door.z);
      W.places[kind] = { x: s.x, z: s.z, door: { ...s.door }, tx: tile.tx, tz: tile.tz };
    } finally { pending.delete(kind); }
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
  const kinds = { moonshop: cfg.shop, tent: cfg.tent };
  async function keeperOf(kind) {
    const c = kinds[kind];
    if (keepers[kind]) return keepers[kind];
    const L = cfg.lines[c.keeper];
    const person = { slug: c.keeper, name: L.name, color: L.color, voice: L.voice };
    keepers[kind] = { person, actor: null, loading: createActor(ctx, c.keeper).then(a => { keepers[kind].actor = a; a.setOpacity(0); a.root.visible = false; return a; })
      .catch(e => { console.warn('[night] 가게 주인 모델을 못 받았어요 (말은 걸 수 있어요)', c.keeper, e); return null; }) };
    return keepers[kind];
  }
  async function showKeeper(kind) {
    const K = await keeperOf(kind);
    const a = await K.loading;
    const spot = S().house?.places?.info?.(kind)?.keeper;
    if (!a || !spot) return;
    a.root.visible = true;
    a.place(spot.x, spot.z, spot.facing);
    a.setOpacity(1); a.fadeTo = 1;
    a.play?.('idle');
  }
  function hideKeeper(kind) { const a = keepers[kind]?.actor; if (a) { a.root.visible = false; a.setOpacity(0); } }

  /** 달빛 가게·천막 문 (house/places.js 가 문 쪽으로 밀 때·문 앞 행동 키): 'open' | 'closed' | null (건물이 없음) */
  function placeRule(kind, n = now()) {
    const c = kinds[kind];
    if (!c || !n || !placed[kind]) return null;
    return R.placeOpen(c, n.hourF) ? 'open' : 'closed';
  }
  function stockGroups(kind) {
    const c = kinds[kind];
    if (!c) return {};
    const have = id => !!S().data?.items?.get?.(id);
    return { furniture: (c.stock ?? []).filter(have) };
  }

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

  async function talkTent() {
    const n = now(), s = st(), K = await keeperOf('tent'), L = cfg.lines.yeomyeong, say = speak(K.person);
    if (!s.met.yeomyeong) { s.met.yeomyeong = n.dayKey; await say(L.first); ctx.events.emit('night:met', { slug: 'yeomyeong' }); }
    if (!R.canDraw(s.tarot, n.dayKey)) {
      const a = await say([...L.already], ['수정 구슬 보기', '그만']);
      if (a === 0) await S().ui.shop.open({ stock: stockGroups('tent').furniture, title: cfg.tent.name, keeper: K.person.name, color: K.person.color, greet: ' 별을 담은 구슬이란다스르륵.' });
      return;
    }
    const a = await say([pick(L.greet)], ['카드 뽑기', '수정 구슬 보기', '그만']);
    if (a === 1) { await S().ui.shop.open({ stock: stockGroups('tent').furniture, title: cfg.tent.name, keeper: K.person.name, color: K.person.color, greet: ' 별을 담은 구슬이란다스르륵.' }); return; }
    if (a !== 0) { await say(L.bye); return; }
    const id = await draw(n);
    if (id) await say([pick(L.after)]);
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
    if (where !== 'moonshop' && where !== 'tent') return null;
    const info = S().house?.places?.info?.(where), p = S().player?.position;
    if (!info?.keeper || !p) return null;
    return Math.hypot(info.keeper.x - p.x, info.keeper.z - p.z) < DESK_DIST ? where : null;
  }
  /** 섬에서 달빛 가게·천막 문 앞 */
  function doorInFront() {
    if (S().house?.where) return null;
    const p = S().player?.position, pl = S().player;
    if (!p) return null;
    for (const kind of ['moonshop', 'tent']) {
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
    if (kind !== 'moonshop' && kind !== 'tent') return null;
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
      for (const k of ['moonshop', 'tent']) { const d = placed[k] && world()?.places?.[k]?.door; if (d) out.push({ x: d.x, z: d.z, r: DOOR_CLEAR }); }
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
      placed: () => ({ moonshop: placed.moonshop, tent: placed.tent, market: placed.market?.stalls.map(s => ({ id: s.id, x: +s.x.toFixed(2), z: +s.z.toFixed(2) })) ?? null, notes: [...placed.sleepNotes.keys()] }),
      spots: () => ({ ...st().spots }),
      setCard(id, dayKey = now()?.dayKey) { st().tarot = { card: id, drawnOn: null, forDay: dayKey }; chipSync(); },
      sync,
    },
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
      run: kind => (kind === 'moonshop' ? talkShop() : talkTent()),
    });
    gp.add({
      name: 'night:door', intent: 'action', priority: 90,   // 섬: 달빛 가게 · 천막 문
      label: () => '들어가기',
      test: () => doorInFront(),
      run: kind => {
        if (placeRule(kind) === 'open') return S().house?.places?.enter?.(kind);
        const L = cfg.lines[kinds[kind].keeper];
        ctx.events.emit('sfx', { name: 'door', volume: 0.4 });
        toast(L.closed[0].replace(/^\(|\)$/g, ''), kind === 'moonshop' ? '🌙' : '🌫️');
      },
    });
  }

  function init() {
    ensureNightCss();
    S().data?.luck?.set?.(luckTable);
    chip = createFortuneChip(ctx.uiRoot, { onOpen: () => { const c = service.fortune(); if (c) openFortune(ctx, c, cards.indexOf(c) + 1); } });
    ctx.events.on('place:enter', ({ place } = {}) => { if (place === 'moonshop' || place === 'tent') showKeeper(place); });
    ctx.events.on('place:leave', ({ place } = {}) => { if (place === 'moonshop' || place === 'tent') hideKeeper(place); });
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
