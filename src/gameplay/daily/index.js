// M13 「매일 할 거리」 P2–P5 (13차 검수 보드 wave13 D142–D147 모두 A, concept/wave13-board.html). 설정 assets/daily/daily.json 하나, 규칙(순수) rules.js.
//  - P2 유성우·소원 (D144-A, meteor.js): 맑은 밤 주 1–2번 20–4시 별똥별 FX-02 (하늘은 src/sky/meteors.js — time.meteors.set) ·
//    올려다보기(R/V · 두 손가락) + Space = 소원 AN-13 → 다음 날 아침 바닷가에 별 조각 IC-MA-11 (색 셋) · 그날 아침 달무리 예고 · 첫 유성우 장면 s23.
//  - P3 선물 풍선 (D142-A, balloon.js): 하루 몇 번 바다 쪽에서 PR-33 · 새총 TO-07(숫자키 6) 으로 맞히면 선물이 떨어진다.
//  - P4 유리병·레시피 (D143-A · D146-A, 이 파일): 날마다 아침 바닷가에 유리병 PR-34 → 레시피 쪽지 IC-MA-12. 쪽지가 가방에 들어오면 읽고
//    (하나 빠짐) 잠긴 새 레시피(rules.json recipes 의 unlock) 하나를 연다 — 지금 있던 레시피는 그대로. 별 조각 가구 FU-63–66.
//  - P5 방문 행상 (D145-A, peddler.js): 수·일 낮 광장 수레 BD-11 + 행상 송이 CH-16 · 희귀 꽃 모종·묘목·벽지 하나 · 첫 방문 장면 s24.
//  - M18-P4 계절 레시피 (15차 보드 D196-A): 벚꽃·조개·단풍·눈 결정 가구 FU-92–104 의 레시피(rules.json recipes 의 season)는 쪽지로 안 열리고,
//    그 계절 유리병(cfg.seasonal.bottleChance) · 친구 이상 주민 선물(town/talk.js → recipes.fromVillager) 로 하나씩 바로 열린다 (창은 대화가 끝난 뒤).
//    행상 송이는 계절 꽃씨 · 계절 벽지(WP-10–13)를 가져온다 (cfg.peddler.seasonal).
// 시각은 언제나 ctx.services.time.now() (시계 바늘·빠르기·날짜 흉내를 따라옴). 저장 칸 state.daily (이 모듈 몫) · 열린 레시피 state.recipes.known.
// 섬 일지(journal) 셀 일: 'wish' · 'balloon' · 'bottle' 을 journal.count 로 직접 센다. 첫날 안내를 마친 다음 날부터 열린다 (밤 콘텐츠와 같음).
import * as R from './rules.js';
import { createMeteor } from './meteor.js';
import { createBalloons } from './balloon.js';
import { createPeddler } from './peddler.js';
import { RECIPE_NOTE } from '../../data/daily-items.js';

export const CONFIG_FILE = 'assets/daily/daily.json';
const BOTTLE_NEAR = 1.4;

function createDaily(ctx, cfg) {
  const S = () => ctx.services;
  const st = () => {
    const s = (ctx.state.daily ||= {});
    s.v ??= 1;
    s.seen ??= {};          // 처음 본 것 { meteor: dayKey, balloon: dayKey, peddler: dayKey }
    s.wish ??= null;        // { day, n, dropped }
    s.balloons ??= null;    // { day, done: [i] }
    s.bottle ??= null;      // { day, opened }
    s.notice ??= null;      // 유성우 아침 예고를 보낸 날
    return s;
  };
  const known = () => { const r = (ctx.state.recipes ||= {}); if (!Array.isArray(r.known)) r.known = []; return r.known; };
  const now = () => S().time?.now?.() ?? null;
  const seed = () => ctx.state.island?.seed ?? 0;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const world = () => S().world;
  const isl = () => world()?.island;
  const count = on => { try { S().journal?.count?.(on); } catch (e) { console.warn('[daily] 섬 일지', e); } };
  const emit = (name, p) => ctx.events.emit(name, p);

  // ── 열렸나: 첫날 안내를 마친 다음 날부터 (night 와 같은 기준) ──
  function introDay() {
    const f = ctx.state.flags ?? {};
    const d = f.firstday?.done?.intro;
    if (typeof d === 'string') return d;
    return d || f.intro ? '2000-01-01' : null;
  }
  function isOpen(n = now()) {
    if (!n) return false;
    const day = introDay();
    return !!day && R.daysBetween(day, n.dayKey) >= (cfg.opensAfterDay ?? 1);
  }
  /** 플레이어가 섬 밖(실내 x 500– · 투어 섬 x 900)이 아닌가 */
  function onIsland() {
    const p = S().player?.position;
    return !!p && Math.abs(p.x) < 200 && Math.abs(p.z) < 200 && !S().house?.where && !S().house?.inside;
  }

  // ── 바닷가 모래 칸 (유리병 · 별 조각) ──
  let sandMemo = null;
  function sandCells() {
    const I = isl(), W = world();
    if (!I) return [];
    const day = now()?.dayKey;
    if (sandMemo?.day === day) return sandMemo.cells;
    const cells = [];
    for (let tz = 1; tz < I.h - 1; tz++) for (let tx = 1; tx < I.w - 1; tx++) {
      if (I.tileAt(tx, tz) !== 'sand' || !I.isWalkableTile?.(tx, tz) || W.objects.at(tx, tz)) continue;
      // 물가 둘레 (바다가 3칸 안) — 바닷가 느낌
      let sea = false;
      for (let dz = -3; dz <= 3 && !sea; dz++) for (let dx = -3; dx <= 3 && !sea; dx++) if (I.tileAt(tx + dx, tz + dz) === 'sea') sea = true;
      if (sea) cells.push({ tx, tz });
    }
    sandMemo = { day, cells };
    return cells;
  }

  /** 아이템 받기 (가방 꽉 차면 발밑에 떨어뜨린다) → 받은 수 */
  function give(id, n = 1, at = null) {
    const d = S().data, it = d?.items?.get?.(id);
    if (!it) return 0;
    const got = d.collect ? d.collect(id, n).added ?? 0 : d.inventory.add(id, n);
    const left = n - got;
    if (left > 0) {
      const p = at ?? S().player?.pointInFront?.(0.6);
      if (p) S().gather?.drops?.drop?.(id, left, p);
      toast('가방이 꽉 차서 발밑에 두었어요', '🎒');
    }
    return n;
  }

  // ── 레시피 쪽지 (D146-A) ──
  let reading = false, notesPending = false;
  function unlock(id) {
    const k = known();
    if (!id || k.includes(id)) return false;
    k.push(id);
    emit('daily:recipe', { id });
    return true;
  }
  /** 가방에 쪽지가 있고 열 레시피가 남았으면 하나 읽는다 (창이 열려 있으면 닫힌 뒤에) */
  async function readNotes() {
    const d = S().data, ui = S().ui;
    if (reading || !d?.inventory || !d.recipes?.locked) return;
    if (!d.inventory.count(RECIPE_NOTE)) { notesPending = false; return; }
    const next = R.nextRecipe(d.recipes.locked());
    if (!next) { notesPending = false; return; }
    if (ui?.isBlocking?.() || S().story?.playing) { notesPending = true; return; }
    reading = true; notesPending = false;
    try {
      d.inventory.removeId(RECIPE_NOTE, 1);
      unlock(next);
      const it = d.items.get(next), r = d.recipes.get(next);
      const needs = (r?.needs ?? []).map(x => (x.id ? `${d.items.get(x.id)?.name ?? x.id} ${x.n}` : `${x.category} ${x.n}`)).join(' · ');
      ctx.events.emit('sfx', { name: 'bag-open' });
      await ui?.confirm?.({ title: '📜 레시피 쪽지', icon: it?.icon ?? '📜', text: `${cfg.recipes.read.replace('{name}', it?.name ?? next)} (재료: ${needs})`,
        buttons: [{ label: '좋아요', value: true, primary: true }], cancelValue: true });
      if (!ui?.confirm) toast(cfg.recipes.read.replace('{name}', it?.name ?? next), '📜');
    } finally { reading = false; }
    if (d.inventory.count(RECIPE_NOTE) && d.recipes.locked().length) notesPending = true;
  }

  // ── M18-P4 계절 레시피 (D196-A): 그 계절 유리병 · 주민 선물로 바로 열림 ──
  const seasonNow = () => { const n = now(); return n ? (n.season ?? ctx.constants?.seasonOf?.(n.month) ?? null) : null; };
  const announce = [];   // 열었는데 아직 창을 못 띄운 것 [{ id, by }]
  let announcing = false;
  /** 지금 계절의 잠긴 계절 레시피 하나를 연다 → id (없으면 null). by = 'bottle' | 주민 이름 */
  function unlockSeason(by = 'bottle', season = seasonNow()) {
    const d = S().data;
    const id = R.nextRecipe(d?.recipes?.seasonLocked?.(season) ?? []);
    if (!id || !unlock(id)) return null;
    announce.push({ id, by });
    emit('daily:season-recipe', { id, season, by });
    return id;
  }
  async function showAnnounce() {
    const ui = S().ui, d = S().data, C = cfg.seasonal ?? {};
    if (announcing || !announce.length || ui?.isBlocking?.() || S().story?.playing) return;
    announcing = true;
    try {
      const { id, by } = announce.shift();
      const it = d.items.get(id), r = d.recipes.get(id);
      const needs = (r?.needs ?? []).map(x => (x.id ? `${d.items.get(x.id)?.name ?? x.id} ${x.n}` : `${d.items.categoryName?.(x.category) ?? x.category} 아무거나 ${x.n}`)).join(' · ');
      const head = (by === 'bottle' ? C.bottle : C.villager ?? '').replaceAll('{name}', it?.name ?? id).replaceAll('{who}이(가)', R.withJosa(by, '이', '가')).replaceAll('{who}', by);
      ctx.events.emit('sfx', { name: 'bag-open' });
      if (ui?.confirm) await ui.confirm({ title: `${C.mark?.[r?.season] ?? '📜'} 계절 레시피`, icon: it?.icon ?? '📜', text: `${head} (재료: ${needs})`,
        buttons: [{ label: '좋아요', value: true, primary: true }], cancelValue: true });
      else toast(head, '📜');
    } finally { announcing = false; }
  }

  // ── 유리병 (D143-A) ──
  const bottle = { id: null, day: null, spot: null };
  function syncBottle(n) {
    const W = world(), I = isl(), s = st();
    if (!W?.objects || !I) return;
    if (!isOpen(n)) { takeBottle(); return; }
    if (s.bottle?.day !== n.dayKey) s.bottle = { day: n.dayKey, opened: false };
    if (s.bottle.opened) { takeBottle(); return; }
    if (bottle.id && bottle.day === n.dayKey) return;
    takeBottle();
    const [c] = R.pickSandCells(sandCells(), 1, n.dayKey, seed(), 'bottle');
    if (!c) return;
    const w = I.toWorld(c.tx, c.tz);
    const id = W.objects.add(cfg.bottle.kind, c.tx, c.tz, { persist: false, rot: ((R.hashOf(n.dayKey) % 628) / 100) });
    if (!id) return;
    Object.assign(bottle, { id, day: n.dayKey, spot: { x: w.x, z: w.z, tx: c.tx, tz: c.tz } });
  }
  function takeBottle() {
    if (bottle.id) world()?.objects?.remove(bottle.id);
    Object.assign(bottle, { id: null, day: null, spot: null });
  }
  function bottleInFront() {
    if (!bottle.spot || !onIsland()) return null;
    const pl = S().player, p = pl.position, dx = bottle.spot.x - p.x, dz = bottle.spot.z - p.z, d = Math.hypot(dx, dz);
    if (d > BOTTLE_NEAR) return null;
    return d < 0.6 || (dx * -Math.sin(pl.facing) + dz * -Math.cos(pl.facing)) / d > 0.3 ? bottle : null;
  }
  async function openBottle() {
    const n = now(), s = st(), d = S().data;
    if (!bottle.spot || !n) return;
    s.bottle = { day: n.dayKey, opened: true };
    const at = { ...bottle.spot };
    takeBottle();
    ctx.events.emit('sfx', { name: 'pickup' });
    S().player?.play?.('place');
    // M18-P4: 그 계절 레시피가 남았으면 가끔(seasonal.bottleChance) 쪽지 대신 계절 레시피가 들어 있다
    const season = seasonNow();
    if (R.seasonBottle(n.dayKey, seed(), cfg.seasonal) && R.nextRecipe(d?.recipes?.seasonLocked?.(season) ?? [])) {
      toast(cfg.seasonal.found, '🍾');
      unlockSeason('bottle', season);
      count('bottle');
      emit('daily:bottle', { dayKey: n.dayKey, note: false, season: true });
      return;
    }
    const canNote = !!R.nextRecipe(d?.recipes?.locked?.() ?? []);
    if (canNote) {
      toast(cfg.bottle.found, '🍾');
      give(RECIPE_NOTE, 1, at);
    } else {
      const g = R.weighted(cfg.bottle.after, R.rngOf('bottle-gift', n.dayKey, seed()));
      toast(cfg.bottle.afterText, '🍾');
      if (g) give(g.item, g.n, at);
    }
    count('bottle');
    emit('daily:bottle', { dayKey: n.dayKey, note: canNote });
  }

  // ── 하위 놀이 ──
  const K = { ctx, cfg, S, st, now, seed, toast, world, isl, isOpen, onIsland, sandCells, give, count, emit };
  const meteor = createMeteor(K);
  const balloons = createBalloons(K);
  const peddler = createPeddler(K);

  let last = { day: null };
  function sync() {
    const n = now();
    if (!n || !world()?.objects) return;
    if (last.day !== n.dayKey) { last.day = n.dayKey; sandMemo = null; }
    syncBottle(n);
    meteor.sync(n);
    balloons.sync(n);
    peddler.sync(n);
  }

  const service = {
    config: cfg,
    get open() { return isOpen(); },
    recipes: {
      known: () => [...known()], unlock, read: () => readNotes(),
      /** M18-P4: 지금 계절 레시피 중 아직 모르는 것 */
      seasonLocked: () => S().data?.recipes?.seasonLocked?.(seasonNow()) ?? [],
      /** M18-P4: 친구 이상 주민이 선물로 계절 레시피를 알려 줌 (town/talk.js) — 열었으면 id, 아니면 null. 창은 대화가 끝난 뒤 */
      fromVillager: (name, r = Math.random) => (r() < (cfg.seasonal?.villagerChance ?? 0.35) ? unlockSeason(name) : null),
      unlockSeason: by => unlockSeason(by),
    },
    bottle: { spot: () => (bottle.spot ? { ...bottle.spot } : null), opened: () => !!st().bottle?.opened },
    meteor: meteor.service,
    balloons: balloons.service,
    peddler: peddler.service,
    debug: { sync, sandCells: () => sandCells().length, state: () => JSON.parse(JSON.stringify(st())) },
  };

  function register(gp) {
    gp.add({ name: 'daily:bottle', intent: 'action', priority: 55, label: '열기', test: () => bottleInFront(), run: () => openBottle() });
    meteor.register(gp);
    balloons.register(gp);
    peddler.register(gp);
  }

  function init() {
    ctx.events.on('inventory:changed', () => { if (!reading) notesPending = true; });
    for (const name of ['time:newday', 'data:loaded', 'game:ready', 'place:leave', 'house:leave']) ctx.events.on(name, () => sync());
    notesPending = true;
  }

  let clock = 0;
  function update(dt) {
    clock += dt;
    if (clock >= 1) { clock = 0; sync(); }
    if (notesPending && !reading) readNotes();
    if (announce.length && !announcing) showAnnounce();
    meteor.update(dt);
    balloons.update(dt);
    peddler.update(dt);
  }

  return { service, register, init, update, sync };
}

let D = null;
export default {
  name: 'daily',
  async init(ctx) {
    const cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(CONFIG_FILE) : fetch(CONFIG_FILE).then(r => r.json()));
    D = createDaily(ctx, cfg);
    ctx.services.daily = D.service;
    const gp = ctx.services.gameplay?.interactions;
    if (gp) D.register(gp);
    D.init();
    D.sync();
  },
  update(dt) { D?.update(dt); },
};
