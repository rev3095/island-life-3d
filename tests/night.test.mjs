// M12 밤·새벽 (보드 night 반영 v1 = D106–D114 모두 A): 설정 모양 · 밤 단계 · 야시장 날 · 가게 시각 · 타로 · 자리 · 야행성 주민 시간표 · 행운 고리
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as R from '../src/gameplay/night/rules.js';
import { setLuck, luck, sellMult, buyMult } from '../src/data/luck.js';
import { createEconomy } from '../src/data/economy.js';
import * as spawns from '../src/data/spawns.js';
import { scheduleOf, isAsleep, shouldBeOut, homeFrom, setLateHook } from '../src/gameplay/town/rules.js';
import { toPerson, checkVillager as validate } from '../src/gameplay/town/traits.js';
import { PLACE_KINDS, PLACE_FILES, PLACE_BUILDING } from '../src/gameplay/house/placedata.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const CFG = json('assets/night/night.json');
const now = (dayKey, hourF) => ({ dayKey, hourF, hour: Math.floor(hourF) });

test('설정: 야시장 · 달빛 가게 · 새벽 천막 · 야행성 주민 · 타로 12장', () => {
  assert.equal(CFG.market.weekday, 6, 'D106-A 토요일');
  assert.deepEqual(CFG.market.hours, [19, 24]);
  assert.deepEqual(CFG.shop.hours, [22, 27], 'D109-A 22–3시');
  assert.deepEqual(CFG.tent.hours, [27, 29], 'D111-A 3–5시');
  assert.equal(CFG.shop.hours[1], CFG.tent.hours[0], '달빛 가게가 닫을 때 천막이 열린다');
  assert.deepEqual(CFG.nocturnal.villagers, ['dalmuri']);
  assert.equal(CFG.tarot.cards.length, 12);
  assert.deepEqual(CFG.tarot.cards.map(c => c.id), Array.from({ length: 12 }, (_, i) => `TA-${String(i + 1).padStart(2, '0')}`));
  const keys = new Set(['sell', 'bigFish', 'rareFossil', 'shakeBug', 'rockHits', 'acorns', 'friend']);
  for (const c of CFG.tarot.cards) {
    assert.ok(c.name && c.sym && /^#[0-9A-F]{6}$/i.test(c.color) && c.text && c.effect, c.id);
    const ks = Object.keys(c.luck);
    assert.equal(ks.length, 1, `${c.id}: 효과 하나`);
    assert.ok(keys.has(ks[0]) || /^(sell|buy):\w+$/.test(ks[0]), `${c.id}: 모르는 효과 ${ks[0]}`);
    assert.ok(Object.values(c.luck)[0] > 0 || ks[0].startsWith('buy:'), `${c.id}: 나쁜 카드 없음 (D112-A)`);
  }
  for (const k of CFG.market.stalls) assert.ok(existsSync(resolve(root, `assets/env/specs/${k.kind}.json`)), `노점 모델 ${k.kind} (축제 부스 다시 씀)`);
  for (const h of CFG.market.hosts) assert.ok(existsSync(resolve(root, `assets/villagers/${h}.json`)), h);
  for (const slug of [CFG.shop.keeper, CFG.tent.keeper]) assert.ok(CFG.lines[slug]?.greet?.length && CFG.lines[slug].first?.length, `${slug} 대사`);
});

test('밤 단계 · 게임 하루 시각 (자정 넘으면 24+)', () => {
  assert.equal(R.dayHour(2), 26);
  assert.equal(R.dayHour(13), 13);
  assert.equal(R.phaseOf(12), 'day');
  assert.equal(R.phaseOf(19.5), 'evening');
  assert.equal(R.phaseOf(23), 'night');
  assert.equal(R.phaseOf(1), 'night');
  assert.equal(R.phaseOf(3.2), 'dawn');
  assert.equal(R.phaseOf(5), 'day');
});

test('D114-A: 첫날 안내를 마친 다음 날부터', () => {
  assert.equal(R.daysBetween('2026-11-10', '2026-11-11'), 1);
  assert.equal(R.daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(R.weekdayOf('2026-11-14'), 6, '2026-11-14 는 토요일');
});

test('D106-A · D113-A: 야시장은 토요일 19–24시, 불꽃놀이·수확 잔치·섬 축제 날엔 쉰다', () => {
  const m = CFG.market;
  assert.deepEqual(R.marketPlan(now('2026-11-14', 20), m), { today: true, open: true, why: 'open' });
  assert.equal(R.marketPlan(now('2026-11-14', 18), m).why, 'later');
  assert.equal(R.marketPlan(now('2026-11-14', 23.9), m).open, true);
  assert.equal(R.marketPlan(now('2026-11-14', 0.5), m).open, false, '자정이 넘으면 끝 (같은 게임 날 24.5시)');
  assert.equal(R.marketPlan(now('2026-11-13', 20), m).open, false, '금요일');
  assert.equal(R.marketPlan(now('2026-08-01', 20), m, { eventsLive: ['EV-02'] }).why, 'event:EV-02');
  assert.equal(R.marketPlan(now('2026-11-14', 20), m, { eventsLive: ['EV-01'] }).open, true, '낮 행사(꽃놀이)와는 안 겹침');
  assert.equal(R.marketPlan(now('2026-11-14', 20), m, { festivalToday: true }).why, 'festival');
});

test('D109-A · D111-A: 달빛 가게 22–3시, 새벽 천막 3–5시, 야행성 주민 집 20–5시', () => {
  assert.ok(R.placeOpen(CFG.shop, 22.1) && R.placeOpen(CFG.shop, 2.9));
  assert.ok(!R.placeOpen(CFG.shop, 21.9) && !R.placeOpen(CFG.shop, 3.1) && !R.placeOpen(CFG.shop, 12));
  assert.ok(R.placeOpen(CFG.tent, 3) && R.placeOpen(CFG.tent, 4.99));
  assert.ok(!R.placeOpen(CFG.tent, 5) && !R.placeOpen(CFG.tent, 2.9) && !R.placeOpen(CFG.tent, 23));
  assert.ok(R.nightHouseOpen(CFG.nocturnal, 20.5) && R.nightHouseOpen(CFG.nocturnal, 4.5) && !R.nightHouseOpen(CFG.nocturnal, 15));
});

test('D112-A 타로: 카드 셋은 날마다 정해지고 겹치지 않음, 뽑으면 다음 날 하루 기운, 하루 한 번', () => {
  const a = R.spread(CFG.tarot.cards, '2026-11-14', 7), b = R.spread(CFG.tarot.cards, '2026-11-14', 7);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 3);
  const many = new Set();
  for (let d = 1; d <= 28; d++) for (const id of R.spread(CFG.tarot.cards, `2026-02-${String(d).padStart(2, '0')}`, 7)) many.add(id);
  assert.ok(many.size >= 10, '한 달이면 거의 모든 카드가 나온다');
  assert.equal(R.nextDayKey('2026-11-14'), '2026-11-15');
  assert.equal(R.nextDayKey('2026-12-31'), '2027-01-01');
  const tarot = { card: 'TA-04', drawnOn: '2026-11-14', forDay: '2026-11-15' };
  assert.equal(R.fortuneOf(tarot, CFG.tarot.cards, '2026-11-14'), null, '뽑은 새벽(같은 게임 날)엔 아직');
  assert.equal(R.fortuneOf(tarot, CFG.tarot.cards, '2026-11-15').name, '바다');
  assert.equal(R.fortuneOf(tarot, CFG.tarot.cards, '2026-11-16'), null, '하루만');
  assert.equal(R.canDraw(tarot, '2026-11-14'), false);
  assert.equal(R.canDraw(tarot, '2026-11-15'), true);
});

test('고리 던지기: 걸린 수 → 상품 줄', () => {
  const seq = [0.1, 0.9, 0.2], rng = () => seq.shift();
  assert.equal(R.ringToss(rng, 3, 0.45), 2);
  assert.equal(R.ringPrize(CFG.market.ringPrizes, 0), null);
  assert.equal(R.ringPrize(CFG.market.ringPrizes, 2).hits, 2);
  assert.equal(R.ringPrize(CFG.market.ringPrizes, 3).hits, 3);
});

test('행운 고리 (data/luck.js): 타로 보너스가 값·출현에 걸리고, 끄면 그대로', () => {
  const items = new Map([['bug.moth', { id: 'bug.moth', category: 'bug', price: 130 }], ['furn.sofa', { id: 'furn.sofa', category: 'furn', price: 100, buy: 1000 }]]);
  try {
    setLuck(() => ({ sell: 0.1, 'sell:bug': 0.25, 'buy:furn': -0.1 }));
    assert.equal(luck('sell'), 0.1);
    assert.ok(Math.abs(sellMult('bug') - 1.35) < 1e-9);
    assert.ok(Math.abs(buyMult('furn') - 0.9) < 1e-9);
    const eco = createEconomy({ inventory: { slots: [] }, wallet: {} });
    const moth = eco.sellPrice('bug.moth');
    assert.equal(moth, Math.round(130 * 1.35));
    setLuck(() => ({ rockHits: 2 }));
    assert.ok(spawns.rock(() => 0.5, spawns.ROCK_MAX_HITS + 1) !== null, '「돌」: 두 번 더');
    setLuck(() => ({ bigFish: 1 }));
    const big = spawns.fishPool({ habitat: 'sea', hour: 12, month: 8 }).filter(e => e.item.shadow >= 5);
    setLuck(null);
    const base = spawns.fishPool({ habitat: 'sea', hour: 12, month: 8 }).filter(e => e.item.shadow >= 5);
    if (base.length) assert.equal(big[0].weight, base[0].weight * 2, '「바다」: 큰 물고기 가중치 ×2');
    assert.equal(spawns.rock(() => 0.5, spawns.ROCK_MAX_HITS), null, '끄면 그대로');
    assert.equal(eco.sellPrice('bug.moth'), 130);
  } finally { setLuck(null); }
  void items;
});

test('D108-A 야행성 달무리: 19시–5시 깨어 있고 낮엔 잠, 새벽엔 집에 / 야시장 날 퐁·코코 늦게', () => {
  const d = json('assets/villagers/dalmuri.json');
  assert.deepEqual(validate(d), [], '주민 파일 검사 통과');
  const P = toPerson(d);
  assert.equal(P.nocturnal, true);
  const day = '2026-11-14';
  assert.ok(isAsleep(P, { dayKey: day, hourF: 13, hour: 13 }), '낮 1시엔 잠');
  assert.ok(!isAsleep(P, { dayKey: day, hourF: 21, hour: 21 }), '밤 9시엔 깨어');
  assert.ok(shouldBeOut(P, { dayKey: day, hourF: 21, hour: 21 }, 'clear'), '밤 9시엔 밖 (광장)');
  assert.ok(!shouldBeOut(P, { dayKey: day, hourF: 4, hour: 4 }, 'clear'), '새벽 4시엔 집에 (깨어 있음 → 문이 열린다)');
  assert.ok(homeFrom(P, day) > 21.5 && homeFrom(P, day) < 24.5, '밤 10~12시쯤 집에 들어감');
  const pong = toPerson(json('assets/villagers/pong.json'));
  try {
    setLateHook((slug, dk) => (slug === 'pong' && R.weekdayOf(dk) === 6 ? CFG.market.hostsLate : null));
    assert.ok(scheduleOf(pong, '2026-11-14').sleep >= CFG.market.hostsLate, '토요일엔 늦게');
    assert.ok(scheduleOf(pong, '2026-11-13').sleep < 24.5, '금요일엔 그대로');
  } finally { setLateHook(null); }
  // 다른 주민은 지금처럼 (야행성 칸이 없으면 5~12시에 나온다)
  const coco = json('assets/villagers/coco.json');
  assert.deepEqual(validate({ ...coco, schedule: { ...coco.schedule, wake: 19 } }).map(e => e.path ?? e[0] ?? e).length > 0, true, '낮 주민이 19시에 나오면 검사에 걸림');
});

test('달빛 가게 RM-10 · 새벽 천막 RM-11: 실내 자리 · 건물 · 방 자리가 겹치지 않음', () => {
  assert.deepEqual(PLACE_KINDS.slice(2), ['moonshop', 'tent']);
  assert.equal(PLACE_BUILDING.moonshop, CFG.shop.building);
  assert.equal(PLACE_BUILDING.tent, CFG.tent.building);
  for (const [i, k] of PLACE_KINDS.entries()) assert.equal(json(PLACE_FILES[i]).place, k);
  const src = readFileSync(resolve(root, 'src/gameplay/house/room.js'), 'utf8');   // room.js 는 three 를 불러서 글로 읽는다
  const xs = [...src.match(/PLACE_ROOMS = \{([^}]*\}){4,}[^;]*;/)[0].matchAll(/x: (\d+)/g)].map(m => Number(m[1])).sort((a, b) => a - b);
  assert.equal(xs.length, 4);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 32, '실내끼리 32 넘게 떨어짐 (방 가장 큰 16칸 × 2)');
  assert.equal(json('assets/interior/places/moonshop.json').keeper.slug, CFG.shop.keeper);
  assert.equal(json('assets/interior/places/tent.json').keeper.slug, CFG.tent.keeper);
});

// ---- 자리: 섬 생성기 그대로 ----
import { generateIsland, createIslandApi, lotsOf, BUILDING_KINDS } from '../src/world/island.js';
import { carveFestival } from '../src/world/festival.js';
import * as C from '../src/core/constants.js';
import { nativeFruit as nativeFruitOf } from '../src/data/economy.js';
import * as itemsMod from '../src/data/items.js';

test('건물 자리: 달빛 가게(광장 북쪽 언덕) · 새벽 천막(남동쪽 숲)이 지금 섬 지도에서 서로 안 겹치게, 다른 건물 문 앞을 막지 않고 문 앞이 열려 있다', () => {
  const spec = slug => json(`assets/env/specs/${slug}.json`);
  const layout = json('assets/island/layout.json');
  // 게임과 같은 섬 (world/index.js 와 같은 인자 — 주민 · 특산 과일까지)
  const fruitId = nativeFruitOf(layout.seed), fruit = fruitId ? (itemsMod.get(fruitId)?.variant ?? fruitId.split('.')[1]) : null;
  const gen = generateIsland(layout.seed, { ...C.ISLAND, villagers: C.VILLAGERS, nativeFruit: fruit, layout, lots: lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, spec(k)]))) });
  carveFestival(gen, { config: json('assets/festival/config.json'), specs: { 'festival-stage': spec('festival-stage') } });
  const isl = createIslandApi(gen);
  const at = new Map(gen.objects.map(o => [`${o.tx},${o.tz}`, o.kind]));
  const doors = R.doorsOf(gen.places);
  const land = (tx, tz) => !['water', 'sea', 'cliff', 'ramp'].includes(isl.tileAt(tx, tz));
  const used = new Set();
  const floor = (tx, tz) => isl.tileAt(tx, tz) === 'grass' && !used.has(`${tx},${tz}`) && (!at.has(`${tx},${tz}`) || R.SOFT_KINDS.has(at.get(`${tx},${tz}`))) && !R.nearDoor(doors, isl.toWorld(tx, tz));
  const soft = (tx, tz) => !at.has(`${tx},${tz}`) || R.SOFT_KINDS.has(at.get(`${tx},${tz}`));
  const clear = (tx, tz) => land(tx, tz) && soft(tx, tz) && !used.has(`${tx},${tz}`);
  const opts = { isOpen: land, isClear: clear, levelAt: (tx, tz) => isl.levelAt(tx, tz), toTile: isl.toTile, toWorld: isl.toWorld, reach: 18 };
  const plaza = gen.places.plaza, [ox, oz] = CFG.shop.offset;
  const shop = R.buildingSpot({ x: plaza.x + ox, z: plaza.z + oz }, spec('night-shop').world.lot, { ...opts, isFree: floor });
  assert.ok(shop, '달빛 가게 자리');
  assert.equal(shop.level, 1, '언덕 위');
  for (let tz = shop.tz - 1; tz <= shop.tz + shop.fd + 1; tz++) for (let tx = shop.tx - 1; tx <= shop.tx + shop.fw; tx++) used.add(`${tx},${tz}`);
  const far = (tx, tz) => { const w = isl.toWorld(tx, tz); return Math.hypot(w.x - shop.x, w.z - shop.z) > 6; };   // index.js FAR
  const tent = R.buildingSpot({ x: gen.w * 0.29, z: gen.h * 0.26 }, spec('dawn-tent').world.lot, { ...opts, isFree: (tx, tz) => floor(tx, tz) && far(tx, tz) });
  assert.ok(tent, '천막 자리');
  assert.ok(tent.x > 0 && tent.z > 0, '천막은 섬 남동쪽');
  for (const s of [shop, tent]) {
    assert.ok(doors.every(d => Math.hypot(d.x - s.x, d.z - s.z) > 3), '다른 건물 문 앞을 막지 않음');
    const d = isl.toTile(s.door.x - 0.01, s.door.z);
    assert.ok(isl.isWalkableTile(d.tx, d.tz), '문 앞 칸을 걸을 수 있다');
  }
});
