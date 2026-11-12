// M13 매일 할 거리 P2–P5 (13차 보드 D142–D147 A): 규칙(순수) src/gameplay/daily/rules.js · 설정 assets/daily/daily.json · 레시피 잠금 · 아이템
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/daily/rules.js';
import * as items from '../src/data/items.js';
import { createRecipes, LOCKED, RECIPES } from '../src/data/recipes.js';
import { createInventory } from '../src/data/inventory.js';
import { createState } from '../src/core/state.js';
import { STAR_IDS, RECIPE_NOTE, DAILY_FURN } from '../src/data/daily-items.js';
import { CODE_ITEMS } from '../tools/elem-checks.mjs';
import { TRIGGERS } from '../src/gameplay/story/rules.js';
import { SEATS } from '../src/gameplay/decor/seats.js';

const cfg = JSON.parse(readFileSync(new URL('../assets/daily/daily.json', import.meta.url), 'utf8'));
const days = (from, n) => Array.from({ length: n }, (_, i) => R.addDays(from, i));

test('유성우: 주마다 1~2 밤, 서로 이틀 넘게 떨어지고, 같은 섬·같은 날이면 같다', () => {
  let two = 0;
  for (let w = 0; w < 52; w++) {
    const monday = R.addDays('2026-11-09', w * 7);   // 월요일
    const list = R.meteorDaysOfWeek(monday, 42, cfg.meteor);
    assert.ok(list.length >= 1 && list.length <= 2, monday);
    for (const d of list) assert.ok(R.daysBetween(monday, d) >= 0 && R.daysBetween(monday, d) < 7);
    if (list.length === 2) { two++; assert.ok(R.daysBetween(list[0], list[1]) > 1); }
    // 그 주 어느 날로 물어도 같은 답
    for (const d of days(monday, 7)) assert.deepEqual(R.meteorDaysOfWeek(d, 42, cfg.meteor), list);
  }
  assert.ok(two > 5 && two < 40, `두 번인 주 ${two}`);
  assert.notDeepEqual(days('2026-11-09', 70).filter(d => R.meteorDaysOfWeek(d, 1, cfg.meteor).includes(d)), days('2026-11-09', 70).filter(d => R.meteorDaysOfWeek(d, 2, cfg.meteor).includes(d)));
});

test('유성우: 밤 20–4시 예보가 맑을 때만, 밖에서만 보인다', () => {
  const clear = [{ from: 5, weather: 'clear' }], rainy = [{ from: 5, weather: 'clear' }, { from: 22, weather: 'rain' }];
  assert.equal(R.clearNight(clear, [20, 28], cfg.meteor.weather), true);
  assert.equal(R.clearNight(rainy, [20, 28], cfg.meteor.weather), false);
  assert.equal(R.clearNight([{ from: 5, weather: 'rain' }, { from: 19, weather: 'clear' }], [20, 28]), true);
  assert.equal(R.meteorNow(true, 21, cfg.meteor), true);
  assert.equal(R.meteorNow(true, 27.5, cfg.meteor), true);    // 새벽 3시 반
  assert.equal(R.meteorNow(true, 28.5, cfg.meteor), false);   // 새벽 4시 반
  assert.equal(R.meteorNow(true, 3.5, cfg.meteor), true);     // 0~5 로 와도 같은 밤
  assert.equal(R.meteorNow(true, 19, cfg.meteor), false);
  assert.equal(R.meteorNow(true, 21, cfg.meteor, true), false);   // 실내
  assert.equal(R.meteorNow(false, 21, cfg.meteor), false);
  assert.equal(R.starsForWishes(0, cfg.meteor), 0);
  assert.equal(R.starsForWishes(2, cfg.meteor), 2);
  assert.equal(R.starsForWishes(9, cfg.meteor), cfg.meteor.maxStars);
  const c = R.starColors(3, '2026-11-12', 7, STAR_IDS);
  assert.deepEqual(c, R.starColors(3, '2026-11-12', 7, STAR_IDS));
  for (const id of c) assert.ok(STAR_IDS.includes(id));
});

test('풍선: 하루 perDay 번, 9–18시 사이 차례로, 바다 쪽에서 반대편으로 건넌다 · 새총 닿는 거리', () => {
  const plan = R.balloonPlan('2026-11-12', 3, cfg.balloons);
  assert.equal(plan.length, cfg.balloons.perDay);
  for (let i = 0; i < plan.length; i++) {
    assert.ok(plan[i].at >= cfg.balloons.hours[0] && plan[i].at < cfg.balloons.hours[1]);
    if (i) assert.ok(plan[i].at > plan[i - 1].at);
    assert.ok(cfg.balloons.colors.includes(plan[i].color));
    assert.ok([1, -1].includes(plan[i].side));
  }
  assert.deepEqual(plan, R.balloonPlan('2026-11-12', 3, cfg.balloons));
  const b = { x0: -22, z0: 0, dir: 1, lane: 0.3, span: 44 };
  const p0 = R.balloonPos(b, 0, cfg.balloons), p1 = R.balloonPos(b, 10, cfg.balloons);
  assert.ok(p1.x > p0.x && !p1.done);
  assert.ok(R.balloonPos(b, 44 / cfg.balloons.speed + 1, cfg.balloons).done);
  assert.ok(p0.y > 3.5 && p0.y < 6);
  // 바로 위는 늘 맞고, 뒤쪽·먼 곳은 안 맞는다 (바라보는 쪽 = 북쪽 −Z)
  assert.equal(R.slingHits(0, 0, 0, -1, 0.3, 0.2), true);
  assert.equal(R.slingHits(0, 0, 0, -1, 0, -3), true);
  assert.equal(R.slingHits(0, 0, 0, -1, 0, 3), false);
  assert.equal(R.slingHits(0, 0, 0, -1, 0, -6), false);
  // 선물: 쪽지는 열 레시피가 남았을 때만
  const r = R.rngOf('t');
  for (let i = 0; i < 200; i++) assert.notEqual(R.balloonGift(cfg.balloons, r, { canNote: false }).item, RECIPE_NOTE);
  for (const g of [...cfg.balloons.gifts, ...cfg.bottle.after]) assert.ok(items.get(g.item), g.item);
});

test('유리병·별 조각 자리: 모래 칸에서 그날 늘 같게, 서로 떨어지게', () => {
  const cells = Array.from({ length: 60 }, (_, i) => ({ tx: i, tz: i % 3 }));
  const a = R.pickSandCells(cells, 3, '2026-11-12', 5, 'stars', 3);
  assert.equal(a.length, 3);
  assert.deepEqual(a, R.pickSandCells(cells, 3, '2026-11-12', 5, 'stars', 3));
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) assert.ok(Math.hypot(a[i].tx - a[j].tx, a[i].tz - a[j].tz) > 3);
  assert.deepEqual(R.pickSandCells([], 2, '2026-11-12', 5), []);
});

test('레시피 (D146-A): 지금 있던 레시피는 그대로 알고, 새 레시피는 쪽지로 표 순서대로 하나씩 열린다', () => {
  assert.deepEqual(LOCKED, ['tool.sling', 'furn.star-lamp', 'furn.star-clock', 'furn.star-chair', 'furn.star-mobile']);
  const state = createState();
  state.recipes = { known: [] };
  const inv = createInventory(state);
  const rec = createRecipes(inv, { known: id => state.recipes.known.includes(id) });
  const before = RECIPES.filter(r => !r.unlock).map(r => r.id);
  assert.deepEqual(rec.list().map(r => r.id), before);
  assert.deepEqual(rec.locked(), LOCKED);
  assert.equal(R.nextRecipe(rec.locked()), 'tool.sling');
  inv.add('mat.wood', 3); inv.add('mat.branch', 4);
  assert.equal(rec.craft('tool.sling'), false, '모르는 레시피는 못 만든다');
  state.recipes.known.push('tool.sling');
  assert.equal(rec.isOpen('tool.sling'), true);
  assert.equal(rec.list().length, before.length + 1);
  assert.equal(rec.craft('tool.sling'), true);
  assert.equal(inv.count('tool.sling'), 1);
  assert.equal(R.nextRecipe(rec.locked()), 'furn.star-lamp');
  // known 을 안 주면 (예전 테스트·도구) 모두 안다
  assert.equal(createRecipes(inv).list().length, RECIPES.length);
  // 새 레시피 재료·결과는 모두 있는 아이템이고, 별 조각 가구는 별 조각을 쓴다
  for (const r of RECIPES.filter(x => x.unlock)) {
    assert.ok(items.get(r.result), r.result);
    for (const n of r.needs) assert.ok(n.id ? items.get(n.id) : n.category, JSON.stringify(n));
    if (r.result.startsWith('furn.star-')) assert.ok(r.needs.some(n => STAR_IDS.includes(n.id)), r.result);
  }
});

test('아이템: 별 조각 셋 · 쪽지 · 새총 · 별 조각 가구 FU-63–66 (요소 편집기 검사도 안다)', () => {
  for (const id of STAR_IDS) assert.equal(items.get(id)?.category, 'mat');
  assert.equal(items.get(RECIPE_NOTE)?.code, 'MA-12');
  assert.equal(items.get('tool.sling')?.tool, 'sling');
  assert.ok(items.get('tool.sling').buy > 0);
  assert.deepEqual(DAILY_FURN.map(f => items.get(`furn.${f[0]}`)?.code), ['FU-63', 'FU-64', 'FU-65', 'FU-66']);
  assert.equal(items.get('furn.star-clock').place, 'wall');
  assert.deepEqual([...CODE_ITEMS].sort(), [...STAR_IDS, RECIPE_NOTE, ...DAILY_FURN.map(f => `furn.${f[0]}`)].sort());
  assert.ok(SEATS['star-chair'], '별 의자에 앉을 수 있다');
});

test('행상 (D145-A): 수·일 낮만 · 오늘의 진열은 꽃 둘 + 묘목 하나 · 값', () => {
  assert.equal(R.weekdayOf('2026-11-11'), 3);   // 수요일
  assert.equal(R.peddlerDay('2026-11-11', cfg.peddler), true);
  assert.equal(R.peddlerDay('2026-11-15', cfg.peddler), true);    // 일요일
  assert.equal(R.peddlerDay('2026-11-12', cfg.peddler), false);
  assert.equal(R.peddlerHere('2026-11-11', 10, cfg.peddler), true);
  assert.equal(R.peddlerHere('2026-11-11', 18, cfg.peddler), false);
  assert.equal(R.peddlerHere('2026-11-11', 8, cfg.peddler), false);
  const flowers = items.list('flower').filter(it => it.hybrid).map(it => it.id);
  assert.ok(flowers.length >= 3);
  const s = R.peddlerStock('2026-11-11', 9, cfg.peddler, { flowers, saplings: cfg.peddler.saplingPool });
  assert.equal(s.length, cfg.peddler.flowers + cfg.peddler.saplings);
  assert.deepEqual(s, R.peddlerStock('2026-11-11', 9, cfg.peddler, { flowers, saplings: cfg.peddler.saplingPool }));
  for (const id of s) assert.ok(R.peddlerPrice(items.get(id), cfg.peddler) > 0, id);
  assert.equal(R.peddlerPrice(items.get('seed.sapling'), cfg.peddler), items.get('seed.sapling').buy);
  assert.equal(new Set(s).size, s.length);
});

test('장면 트리거 · 설정 모양', () => {
  assert.equal(TRIGGERS['meteor-first'].event, 'daily:meteor');
  assert.equal(TRIGGERS['meteor-first'].test({ first: true }), true);
  assert.equal(TRIGGERS['peddler-first'].test({ first: false }), false);
  assert.deepEqual(cfg.assets.env, ['gift-balloon', 'sea-bottle', 'peddler-cart']);
  assert.ok(cfg.meteor.wished.length && cfg.peddler.lines.greet.length);
  assert.ok(R.inHours(27, [20, 28]) && !R.inHours(12, [20, 28]) && R.inHours(10, [9, 17]));
});
