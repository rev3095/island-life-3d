import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import { createInventory, SLOTS } from '../src/data/inventory.js';

const make = () => {
  const state = createState();
  const changes = [];
  const inv = createInventory(state, { onChange: s => changes.push(s) });
  return { state, inv, changes };
};

test('20칸, 처음엔 비어 있다', () => {
  const { inv } = make();
  assert.equal(inv.slots.length, SLOTS);
  assert.equal(SLOTS, 20);
  assert.equal(inv.freeSlots(), 20);
  assert.equal(inv.isFull(), false);
});

test('과일은 10개씩 쌓이고 넘치면 다음 칸으로', () => {
  const { inv } = make();
  assert.equal(inv.add('fruit.apple', 13), 13);
  assert.deepEqual(inv.slots.slice(0, 2), [{ id: 'fruit.apple', count: 10 }, { id: 'fruit.apple', count: 3 }]);
  assert.equal(inv.add('fruit.apple', 5), 5);
  assert.deepEqual(inv.slots[1], { id: 'fruit.apple', count: 8 });
  assert.equal(inv.count('fruit.apple'), 18);
});

test('물고기는 쌓이지 않는다 (한 칸에 한 마리)', () => {
  const { inv } = make();
  assert.equal(inv.add('fish.crucian', 3), 3);
  assert.equal(inv.freeSlots(), 17);
  assert.ok(inv.slots.slice(0, 3).every(s => s.id === 'fish.crucian' && s.count === 1));
});

test('재료는 30개씩', () => {
  const { inv } = make();
  inv.add('mat.wood', 45);
  assert.deepEqual(inv.slots.slice(0, 2).map(s => s.count), [30, 15]);
});

test('가방이 꽉 차면 들어간 수만 돌려준다', () => {
  const { inv } = make();
  assert.equal(inv.add('fish.carp', 19), 19);
  assert.equal(inv.isFull(), false);
  assert.equal(inv.add('fruit.pear', 15), 10);
  assert.equal(inv.isFull(), true);
  assert.equal(inv.add('fish.carp', 1), 0);
  assert.equal(inv.add('fruit.pear', 1), 0);
  assert.equal(inv.canFit('fruit.pear', 5), 0);
});

test('꽉 찼어도 같은 아이템 칸에 자리가 있으면 쌓인다', () => {
  const { inv } = make();
  inv.add('fish.carp', 19);
  inv.add('shell.clam', 4);
  assert.equal(inv.isFull(), true);
  assert.equal(inv.canFit('shell.clam', 10), 6);
  assert.equal(inv.add('shell.clam', 10), 6);
  assert.equal(inv.count('shell.clam'), 10);
});

test('없는 아이템·잘못된 수는 넣지 않는다', () => {
  const { inv, changes } = make();
  assert.equal(inv.add('fish.nope'), 0);
  assert.equal(inv.add('fish.carp', 0), 0);
  assert.equal(inv.add('fish.carp', -2), 0);
  assert.equal(inv.add('fish.carp', NaN), 0);
  assert.equal(changes.length, 0);
});

test('remove / removeId', () => {
  const { inv } = make();
  inv.add('mat.stone', 12);
  assert.equal(inv.remove(0, 5), 5);
  assert.equal(inv.count('mat.stone'), 7);
  assert.equal(inv.remove(0, 99), 7);
  assert.equal(inv.slots[0], null);
  assert.equal(inv.remove(0), 0);
  inv.add('mat.branch', 40);
  assert.equal(inv.removeId('mat.branch', 35), 35);
  assert.equal(inv.count('mat.branch'), 5);
  assert.equal(inv.removeId('mat.branch', 10), 5);
});

test('바뀔 때마다 onChange 를 부른다', () => {
  const { inv, changes } = make();
  inv.add('fruit.apple', 2);
  inv.remove(0, 1);
  assert.equal(changes.length, 2);
  assert.equal(changes[1], inv.slots);
});

test('batch 는 한 번만, silent 는 안 알린다', () => {
  const { inv, changes } = make();
  inv.batch(() => { inv.add('fruit.apple'); inv.add('fruit.pear'); });
  assert.equal(changes.length, 1);
  inv.batch(() => { inv.add('fruit.apple'); }, { silent: true });
  assert.equal(changes.length, 1);
});

test('move: 합치기와 자리 바꾸기', () => {
  const { inv } = make();
  inv.add('fish.carp');
  inv.add('fruit.apple', 10);
  inv.add('fruit.apple', 4);   // 칸 2 (count 4)
  inv.remove(1, 7);            // 칸 1 (count 3)
  assert.ok(inv.move(2, 1));
  assert.deepEqual(inv.slots[1], { id: 'fruit.apple', count: 7 });
  assert.equal(inv.slots[2], null);
  assert.ok(inv.move(0, 1));
  assert.equal(inv.slots[0].id, 'fruit.apple');
  assert.equal(inv.slots[1].id, 'fish.carp');
});

test('도구 내구도: 쓰면 줄고 다 쓰면 부서진다', () => {
  const { inv } = make();
  inv.add('tool.rod');
  assert.deepEqual(inv.slots[0], { id: 'tool.rod', count: 1, uses: 30 });
  assert.ok(inv.hasTool('rod'));
  let r;
  for (let i = 0; i < 29; i++) r = inv.useTool('rod');
  assert.deepEqual(r, { ok: true, uses: 1, broken: false });
  r = inv.useTool('rod');
  assert.deepEqual(r, { ok: true, uses: 0, broken: true });
  assert.equal(inv.slots[0], null);
  assert.equal(inv.useTool('rod').ok, false);
});
