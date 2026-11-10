import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import { createInventory } from '../src/data/inventory.js';
import { createWallet } from '../src/data/wallet.js';
import { createRecipes, RECIPES, needText } from '../src/data/recipes.js';
import { createEconomy, shopStock, pickShopFurniture, nativeFruit, sellPrice, isShopOpen } from '../src/data/economy.js';
import * as items from '../src/data/items.js';

const make = () => {
  const state = createState();
  const changes = [];
  const inventory = createInventory(state, { onChange: s => changes.push(s) });
  const wallet = createWallet(state);
  return { state, inventory, wallet, changes, recipes: createRecipes(inventory) };
};

test('레시피는 모두 있는 아이템을 쓴다', () => {
  for (const r of RECIPES) {
    assert.ok(items.get(r.result), r.id);
    for (const n of r.needs) assert.ok(n.id ? items.get(n.id) : items.CATEGORIES.includes(n.category), `${r.id} 재료`);
  }
  assert.equal(needText({ id: 'mat.wood', n: 5 }), '나무 5');
  assert.equal(needText({ category: 'shell', n: 6 }), '조개 아무거나 6');
});

test('도끼 만들기: 나뭇가지 5 + 돌 1 을 쓴다', () => {
  const { inventory, recipes } = make();
  inventory.add('mat.branch', 7);
  assert.equal(recipes.canCraft('tool.axe'), false);
  assert.deepEqual(recipes.missing('tool.axe').map(m => [m.id, m.have]), [['mat.stone', 0]]);
  inventory.add('mat.stone', 2);
  assert.equal(recipes.canCraft('tool.axe'), true);
  assert.equal(recipes.craft('tool.axe'), true);
  assert.equal(inventory.count('mat.branch'), 2);
  assert.equal(inventory.count('mat.stone'), 1);
  assert.equal(inventory.count('tool.axe'), 1);
  assert.equal(inventory.slots[inventory.find('tool.axe')].uses, items.get('tool.axe').durability);
});

test('재료가 모자라면 아무것도 안 빠진다', () => {
  const { inventory, recipes } = make();
  inventory.add('mat.wood', 3);
  assert.equal(recipes.craft('furn.log-chair'), false);
  assert.equal(inventory.count('mat.wood'), 3);
  assert.equal(recipes.craft('없는 레시피'), false);
  assert.equal(recipes.missing('없는 레시피'), null);
});

test('카테고리 재료: 조개 아무거나 6개', () => {
  const { inventory, recipes } = make();
  inventory.add('shell.clam', 4);
  inventory.add('shell.coral', 1);
  assert.equal(recipes.canCraft('furn.shell-curtain'), false);
  inventory.add('shell.scallop', 2);
  assert.equal(recipes.craft('furn.shell-curtain'), true);
  assert.equal(inventory.countCategory('shell'), 1);
  assert.equal(inventory.count('shell.clam'), 0, '많은 것부터 쓴다');
  assert.equal(inventory.count('furn.shell-curtain'), 1);
});

test('결과물 자리가 없으면 실패하고 가방은 그대로', () => {
  const { inventory, recipes } = make();
  inventory.add('mat.wood', 10);           // 칸 1개
  inventory.add('fish.carp', 19);          // 나머지 19칸
  // 나무 4개를 써도 나무 칸이 남으니 의자가 들어갈 자리가 없다
  assert.equal(recipes.canCraft('furn.log-chair'), false);
  assert.equal(recipes.craft('furn.log-chair'), false);
  assert.equal(inventory.count('mat.wood'), 10);
  assert.equal(inventory.count('furn.log-chair'), 0);
});

test('재료를 다 쓰면 그 칸에 결과물이 들어간다', () => {
  const { inventory, recipes } = make();
  inventory.add('mat.wood', 4);
  inventory.add('fish.carp', 19);
  assert.equal(recipes.craft('furn.log-chair'), true);
  assert.equal(inventory.isFull(), true);
  assert.equal(inventory.count('furn.log-chair'), 1);
});

test('canCraft 는 가방 이벤트를 보내지 않는다, craft 는 한 번만', () => {
  const { inventory, recipes, changes } = make();
  inventory.add('mat.wood', 10);
  changes.length = 0;
  recipes.canCraft('tool.shovel');
  assert.equal(changes.length, 0);
  recipes.craft('tool.shovel');
  assert.equal(changes.length, 1);
});

test('상점: 같은 날은 같은 물건, 가구 4 (실내 3 + 야외 1, D99-A) + 도구 + 씨앗·묘목', () => {
  const a = shopStock('2026-10-28', 7), b = shopStock('2026-10-28', 7);
  assert.deepEqual(a, b);
  assert.equal(a.furniture.length, 4);
  assert.equal(new Set(a.furniture).size, 4, '같은 가구 두 번 안 나옴');
  for (const id of a.furniture) assert.equal(items.get(id).source, 'shop');
  // 실내 셋이 먼저, 마지막 하나가 야외 (진열 받침 순서)
  assert.deepEqual(a.furniture.map(id => !!items.get(id).outdoor), [false, false, false, true]);
  assert.deepEqual(a.outdoor, a.furniture.slice(3));
  for (let d = 1; d <= 20; d++) {
    const s = shopStock(`2026-11-${String(d).padStart(2, '0')}`, 99);
    assert.equal(s.furniture.filter(id => items.get(id).outdoor).length, 1, `11-${d} 야외 하나`);
  }
  assert.equal(a.tools.length, 5);
  assert.equal(a.seeds.length, 2);
  assert.ok(a.saplings.length >= 1);
  for (const id of a.all) assert.ok(items.get(id).buy > 0, id);
  const week = new Set(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map(d => shopStock(d, 7).furniture.join()));
  assert.ok(week.size > 1, '날이 바뀌면 가구도 바뀐다');
});

test('파는 값: 특산 과일은 100, 다른 과일은 500', () => {
  const native = nativeFruit(20261028);
  assert.equal(nativeFruit(20261028), native);
  assert.equal(sellPrice(native, { native }), 100);
  const other = items.list('fruit').find(f => f.variant && f.id !== native).id;
  assert.equal(sellPrice(other, { native }), 500);
  assert.equal(sellPrice('fish.shark'), 15000);
  assert.equal(sellPrice('nope'), 0);
});

test('사고팔기', () => {
  const { state, inventory, wallet } = make();
  const eco = createEconomy({ inventory, wallet, getSeed: () => state.island.seed, getDayKey: () => '2026-10-28' });
  inventory.add('fish.sea-bream');
  assert.equal(eco.sell(0), 3000);
  assert.equal(wallet.get(), 3000);
  assert.equal(inventory.slots[0], null);
  assert.equal(eco.sell(0), 0);
  assert.equal(eco.buy('tool.shovel'), 'ok');
  assert.equal(wallet.get(), 2200);
  assert.equal(eco.buy('furn.sofa'), 'money');
  wallet.add(1000);
  assert.equal(eco.buy('furn.sofa'), 'ok');
  assert.equal(wallet.get(), 200);
  assert.equal(eco.buy('furn.sofa'), 'money');
  assert.equal(eco.buy('fish.shark'), 'none');
  inventory.add('fish.carp', 18);
  wallet.add(10000);
  assert.equal(eco.buy('tool.axe'), 'full');
  assert.ok(isShopOpen(8) && isShopOpen(21) && !isShopOpen(22) && !isShopOpen(7));
});

test('상점 가구 고르기 (D99-A): 야외 몫 · 후보가 모자랄 때 채우기', () => {
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'o1', outdoor: true }, { id: 'o2', outdoor: true }];
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = pickShopFurniture(pool, rng, { total: 4, outdoor: 1 });
  assert.equal(r.indoor.length, 3);
  assert.equal(r.outdoor.length, 1);
  assert.ok(r.outdoor[0].startsWith('o'));
  assert.deepEqual(r.all, [...r.indoor, ...r.outdoor]);
  // 야외 후보가 없으면 실내로 다 채운다
  assert.deepEqual(pickShopFurniture(pool.slice(0, 4), rng, { total: 4, outdoor: 1 }).all.length, 4);
  // 실내 후보가 모자라면 야외로 채운다
  const few = pickShopFurniture([{ id: 'a' }, { id: 'o1', outdoor: true }, { id: 'o2', outdoor: true }, { id: 'o3', outdoor: true }], rng, { total: 4, outdoor: 1 });
  assert.equal(few.indoor.length, 1);
  assert.equal(few.outdoor.length, 3);
  // 야외 0 = 예전처럼 모두 실내
  assert.equal(pickShopFurniture(pool, rng, { total: 2, outdoor: 0 }).outdoor.length, 0);
});
