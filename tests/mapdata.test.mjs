// 6차 M6-P5 지도·숫자: assets/island/layout.json (섬 지도 편집기 → "지도 반영") 과 assets/data/*.json (표 편집기 → "숫자 반영") 검사.
// 반영할 때 이 파일이 문을 지킨다 — 여기 검사에 걸리면 반영하지 않고 이유를 알린다 (docs/notes/m6-p5-mapdata.md).
// node --test tests/mapdata.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { generateIsland, resolveLayout, DEFAULT_LAYOUT, lotsOf, BUILDING_KINDS, KIND } from '../src/world/island.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';
import * as items from '../src/data/items.js';
import { ITEM_TABLE, RULES } from '../src/data/tables.js';
import * as townRules from '../src/gameplay/town/rules.js';

const readJSON = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, readJSON(`assets/env/specs/${k}.json`)])));
const FILE = readJSON('assets/island/layout.json');
const make = (seed, layout) => generateIsland(seed, { ...ISLAND, villagers: VILLAGERS, lots, layout });
const sha = v => createHash('sha256').update(v).digest('hex').slice(0, 16);
const print = g => [sha(Buffer.concat([Buffer.from(g.kind), Buffer.from(g.level), Buffer.from(g.flags)])), sha(JSON.stringify(g.objects)), sha(JSON.stringify(g.places)), g.objects.length];

/* ---------- 지도 ---------- */

test('지도: 기본 자리(DEFAULT_LAYOUT)로 만든 섬은 6차 전 섬과 한 칸도 다르지 않다', () => {
  // 6차 전 island.js(코드에 박힌 자리)로 만든 지문 — 기본값을 바꾸면 여기가 깨진다. 지도를 바꾸려면 layout.json 을 고친다
  assert.deepEqual(print(make(20261028)), ['6b43a67dcf22fc85', '5ff2e8fdbf1322ae', '7807d82a6980f847', 316]);
  assert.deepEqual(print(make(12345)), ['f7bacd67f47de42b', '6e7ffa34628c33a4', '28aece487f61570d', 300]);
  assert.deepEqual(print(make(20261028, DEFAULT_LAYOUT)), print(make(20261028)));
});

test('지도: 빠진 칸·틀린 칸은 기본값, 준 칸은 그대로', () => {
  const r = resolveLayout({ shop: [0.7, 0.5], dock: 'x', bridges: [[0.5, 0.5]], villagers: { coco: [0.3, 0.4], bori: 'no' }, density: { trees: 40, flowerSize: [3] } });
  assert.deepEqual(r.shop, [0.7, 0.5]);
  assert.equal(r.dock, DEFAULT_LAYOUT.dock);
  assert.deepEqual(r.bridges, DEFAULT_LAYOUT.bridges);            // 다리는 2개 그대로여야 받는다
  assert.deepEqual(r.villagers.coco, [0.3, 0.4]);
  assert.deepEqual(r.villagers.bori, DEFAULT_LAYOUT.villagers.bori);
  assert.equal(r.density.trees, 40);
  assert.deepEqual(r.density.flowerSize, DEFAULT_LAYOUT.density.flowerSize);
  assert.equal(r.seed, DEFAULT_LAYOUT.seed);
  assert.equal(resolveLayout({ seed: null }).seed, null);         // null = 저장의 섬 시드
  assert.deepEqual(resolveLayout(null), resolveLayout({}));
});

test('지도: layout.json 칸은 모두 알맞은 모양이고 섬 안쪽 (반영 문지기)', () => {
  const r = resolveLayout(FILE);
  for (const k of Object.keys(DEFAULT_LAYOUT)) {
    if (k in FILE) assert.deepEqual(r[k], k === 'villagers' ? { ...DEFAULT_LAYOUT.villagers, ...FILE.villagers } : FILE[k], `layout.json ${k} 칸 모양이 틀려 기본값으로 바뀐다`);
  }
  assert.ok(Number.isInteger(FILE.version) && FILE.version >= 0, 'version');
  const inside = ([x, z], what) => assert.ok(x > 0.05 && x < 0.95 && z > 0.05 && z < 0.95, `${what} 자리 ${x}, ${z} 가 섬 밖`);
  for (const k of ['pond', 'plaza', 'museum', 'museumLow', 'shop', 'playerHouse', 'orchard']) inside(r[k], k);
  for (const [s, p] of Object.entries(r.villagers)) inside(p, s);
  r.bridges.forEach((p, i) => inside(p, `다리 ${i + 1}`));
  r.rocks.forEach((p, i) => inside(p, `바위 ${i + 1}`));
  inside(r.festival.at, '축제 광장');
  assert.ok(r.dock > 0.1 && r.dock < 0.9 && r.ramps.every(x => x > 0.1 && x < 0.9));
  assert.ok(r.festival.r > 0 && r.festival.r <= 12);
  const d = r.density;
  for (const k of ['trees', 'cedars', 'fruitTrees', 'orchardTrees', 'palms', 'flowerClusters', 'bushes', 'weeds', 'shells', 'fossils']) assert.ok(Number.isInteger(d[k]) && d[k] >= 0 && d[k] <= 200, `밀도 ${k} = ${d[k]}`);
  assert.ok(d.fruitChance >= 0 && d.fruitChance <= 1 && d.forest >= 0 && d.forest <= 3);
  assert.ok(Number.isInteger(d.flowerSize[0]) && d.flowerSize[0] >= 1 && d.flowerSize[1] >= d.flowerSize[0] && d.flowerSize[1] <= 24);
  assert.ok(FILE.seed === null || (Number.isInteger(FILE.seed) && FILE.seed >= 0), '시드는 0 이상 정수 또는 null');
});

test('지도: layout.json 섬에 건물·다리·선착장·경사로·폭포·광장이 다 서고, 같은 시드면 늘 같은 섬', () => {
  const seed = FILE.seed ?? 20261028;
  const g = make(seed, FILE);
  const p = g.places;
  assert.ok(p.museum && p.shop && p.playerHouse, '박물관·상점·플레이어 집 자리');
  assert.deepEqual(p.villagerHouses.map(v => v.slug), VILLAGERS, '주민 집 7채 자리 (못 찾은 집이 있다)');
  assert.equal(g.bridges.length, 2, '다리 2개');
  assert.ok(g.dock, '선착장');
  assert.equal(g.ramps.length, 3, '경사로 3곳');
  assert.ok(g.waterfalls.length >= 1, '폭포');
  const at = (x, z) => g.kind[Math.round(z) * g.w + Math.round(x)];
  assert.equal(at(p.plaza.x + g.w / 2 - 0.5, p.plaza.z + g.h / 2 - 0.5), KIND.PLAZA, '광장 가운데가 광장 돌바닥');
  const [fx, fz] = g.layout.festival.at;
  const fk = at(Math.round(g.w * fx), Math.round(g.h * fz));
  assert.ok(fk !== KIND.SEA && fk !== KIND.WATER, '축제 광장 빈 자리 가운데가 땅');
  assert.deepEqual(print(make(seed, FILE)), print(g));
});

/* ---------- 숫자 표 ---------- */

const T = ITEM_TABLE;
const isInt0 = v => Number.isInteger(v) && v >= 0;
const prob = v => typeof v === 'number' && v >= 0 && v <= 1;

test('숫자 표: 아이템 줄은 이름·값이 있고 장소·시간·계절 낱말이 표에 있다', () => {
  const groups = { fish: T.fish, bugs: T.bugs, fossils: T.fossils, fruits: T.fruits, shells: T.shells, mats: T.mats, tools: T.tools, furniture: T.furniture, seeds: T.seeds };
  for (const [g, rows] of Object.entries(groups)) {
    const slugs = rows.map(r => r.slug);
    assert.equal(new Set(slugs).size, slugs.length, `${g}: slug 가 겹친다`);
    for (const r of rows) {
      assert.ok(typeof r.name === 'string' && r.name.trim(), `${g}.${r.slug} 이름`);
      assert.ok(isInt0(r.price), `${g}.${r.slug} 파는 값 ${r.price} (0 이상 정수)`);
      if ('buy' in r) assert.ok(isInt0(r.buy), `${g}.${r.slug} 사는 값 ${r.buy}`);
      if ('weight' in r) assert.ok(typeof r.weight === 'number' && r.weight > 0, `${g}.${r.slug} 출현 몫 ${r.weight}`);
    }
  }
  for (const r of [...T.fish, ...T.bugs]) {
    assert.ok(r.time in T.times, `${r.slug} 시간 '${r.time}' 이 times 표에 없다`);
    assert.ok(r.season in T.seasons, `${r.slug} 계절 '${r.season}' 이 seasons 표에 없다`);
  }
  for (const r of T.fish) {
    assert.ok(r.place in T.fishPlaces, `${r.slug} 장소 '${r.place}'`);
    assert.ok(Number.isInteger(r.shadow) && r.shadow >= 1 && r.shadow <= 6, `${r.slug} 그림자 1~6`);
    assert.ok(!r.colors || (r.colors.length === 4 && r.colors.every(c => /^#[0-9A-Fa-f]{6}$/.test(c))), `${r.slug} 몸 색 4개`);
  }
  for (const r of T.bugs) assert.ok(r.place in T.bugPlaces, `${r.slug} 장소 '${r.place}'`);
  for (const [k, ms] of Object.entries(T.seasons)) assert.ok(ms.length && ms.every(m => Number.isInteger(m) && m >= 1 && m <= 12), `계절 ${k}`);
  for (const [k, hs] of Object.entries(T.times)) assert.ok(hs.every(([a, b]) => a >= 0 && b <= 24 && a < b), `시간 ${k}`);
  for (const f of T.flowers) assert.ok(f.colors.length === 4 && isInt0(f.price) && isInt0(f.hybridPrice), `꽃 ${f.kind}: 색 4개(마지막 = 교배)·값`);
  for (const [cat, n] of Object.entries(T.stack)) assert.ok(Number.isInteger(n) && n >= 1 && n <= 99, `쌓기 ${cat}`);
  assert.ok(T.weight.byPrice.every(([a, w], i, l) => w > 0 && (i === 0 || l[i - 1][0] > a)), '값 기준 출현 몫은 비싼 것부터');
  assert.ok(isInt0(T.unknownFossil.price) && isInt0(T.acornBag.acorns) && T.acornBag.acorns > 0);
  // 상점에서 파는 가구는 사는 값이 있어야 한다
  for (const f of T.furniture) if (f.source === 'shop') assert.ok(f.buy > 0, `상점 가구 ${f.slug} 사는 값`);
});

test('숫자 표: 규칙 숫자 — 확률은 0~1, 합은 1 아래, 범위는 작은 값이 먼저', () => {
  const G = RULES.gather;
  for (const k of ['shakeBugChance', 'rockBugChance']) assert.ok(prob(G[k]), k);
  for (const k of ['fruitPerTree', 'coconutPerPalm', 'rockMaxHits', 'chopMaxHits', 'mouthMult']) assert.ok(Number.isFinite(G[k]) && G[k] > 0, k);
  const S = G.shake, R = G.rock;
  for (const v of [...Object.values(S), ...Object.values(R), G.chop.wood]) assert.ok(prob(v), '확률 0~1');
  assert.ok(Math.max(S.bees, S.beesOrchard) + G.shakeBugChance + S.furniture + S.acornBag <= 1, '나무 흔들기: 벌집 + 곤충 + 가구 + 도토리 ≤ 1');
  assert.ok(R.acornBag + R.iron + R.clay <= 1, '바위: 도토리 + 철광석 + 점토 ≤ 1');
  const { shop, day, starter } = RULES;
  assert.ok(Number.isInteger(shop.open) && Number.isInteger(shop.close) && shop.open >= 0 && shop.open < shop.close && shop.close <= 24, '상점 시각');
  assert.ok(isInt0(shop.furniturePerDay) && isInt0(shop.flowerSeedsPerDay));
  assert.ok(Number.isInteger(day.boundaryHour) && day.boundaryHour >= 0 && day.boundaryHour < 12, '하루 바뀌는 시각');
  for (const k of ['shellsPerDay', 'weedsPerDay']) assert.ok(isInt0(day[k][0]) && day[k][1] >= day[k][0], `${k} [작은 값, 큰 값]`);
  assert.ok(isInt0(day.fossilsPerDay) && isInt0(day.fruitRegrowDays) && day.weedsStart <= day.weedsMax);
  assert.ok(isInt0(starter.acorns) && starter.items.every(([id, n]) => items.has(id) && n >= 1), '시작 지급');
});

test('숫자 표: 레시피 재료·결과는 있는 아이템, 생일은 맞는 날', () => {
  const seen = new Set();
  for (const r of RULES.recipes) {
    assert.ok(items.has(r.result), `레시피 결과 ${r.result} 가 아이템 사전에 없다`);
    assert.ok(!seen.has(r.result), `레시피 ${r.result} 가 두 번`); seen.add(r.result);
    assert.ok(r.needs.length >= 1);
    for (const n of r.needs) {
      assert.ok(Number.isInteger(n.n) && n.n >= 1 && n.n <= 99, `${r.result} 재료 수 ${n.n}`);
      if (n.id) assert.ok(items.has(n.id), `${r.result} 재료 ${n.id} 가 없다`);
      else assert.ok(items.CATEGORIES.includes(n.category), `${r.result} 재료 분류 ${n.category}`);
    }
  }
  for (const [slug, d] of Object.entries(RULES.birthdays.dates)) assert.ok(d === null || /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d), `${slug} 생일 ${d}`);
  assert.ok(items.has(RULES.birthdays.cake) && RULES.birthdays.giftMult >= 1);
});

test('숫자 표: 주민(town) 칸은 아직 town/rules.js 가 읽지 않는다 → 표와 코드 값이 같아야 한다 (연결 전)', () => {
  // town 연결 제안(docs/notes/m6-p5-mapdata.md)을 합치면 이 검사는 저절로 맞는다. 그 전에 표만 바꾸면 게임에 안 들어가므로 여기서 막는다
  const t = RULES.town;
  assert.deepEqual(
    [t.friendMax, t.tiers, t.talkBonus, t.giftPoints, t.giftsCountedPerDay, t.requestPoints, t.requestDays],
    [townRules.FRIEND_MAX, townRules.TIERS, townRules.TALK_BONUS, townRules.GIFT_POINTS, townRules.GIFTS_COUNTED_PER_DAY, townRules.REQUEST_POINTS, townRules.REQUEST_DAYS],
    'rules.json town 칸이 src/gameplay/town/rules.js 와 다르다 — town 연결 전에는 반영할 수 없다');
  const q = t.requestReward;
  const furn = { rewards: ['furn.sofa'] };
  assert.equal(townRules.requestReward(furn, null, () => q.furnitureChance - 1e-9).id, 'furn.sofa', '부탁 보상 가구 확률');
  assert.equal(townRules.requestReward(furn, null, () => q.furnitureChance).id, 'mat.acorn-bag');
  for (const price of [null, 0, 100, 800, 15000]) {
    const v = price ?? q.valueDefault;
    const n = Math.max(q.bagMin, Math.min(q.bagMax, Math.round((v * q.valueMult + q.valuePlus) / 100)));
    assert.equal(townRules.requestReward({}, price == null ? null : { price }, () => 0).n, n, `부탁 보상 도토리 주머니 수 (값 ${price})`);
  }
});
