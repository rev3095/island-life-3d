// 가방 칸 변형(variant): 가구 색·주민 사진의 주민. 같은 변형끼리만 쌓이고, 저장·불러오기에서 살아남는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import { createInventory } from '../src/data/inventory.js';
import { createSave, normalize } from '../src/data/save.js';
import { createDataService } from '../src/data/index.js';
import { fakeStorage, fakeCtx } from './helpers.mjs';

test('변형을 주면 칸에 적히고, 안 주면 예전 모양 그대로', () => {
  const inv = createInventory(createState());
  inv.add('furn.sofa', 1, { variant: 'green' });
  inv.add('furn.sofa', 1);
  assert.deepEqual(inv.slots.slice(0, 2), [{ id: 'furn.sofa', count: 1, variant: 'green' }, { id: 'furn.sofa', count: 1 }]);
});

test('쌓이는 물건은 같은 변형끼리만 쌓인다', () => {
  const inv = createInventory(createState());
  inv.add('shell.scallop', 3, { variant: 'pink' });
  inv.add('shell.scallop', 2, { variant: 'pink' });
  inv.add('shell.scallop', 4);
  assert.deepEqual(inv.slots.slice(0, 2), [{ id: 'shell.scallop', count: 5, variant: 'pink' }, { id: 'shell.scallop', count: 4 }]);
  assert.equal(inv.move(1, 0), true);   // 변형이 다르면 합치지 않고 자리만 바꾼다
  assert.deepEqual(inv.slots[0], { id: 'shell.scallop', count: 4 });
  assert.equal(inv.count('shell.scallop'), 9);
});

test('저장해도 변형이 남는다 (이상한 값은 버린다)', () => {
  const st = normalize({ inventory: [{ id: 'furn.villager-photo', count: 1, variant: 'bori' }, { id: 'furn.sofa', count: 1, variant: 42 }] });
  assert.deepEqual(st.inventory.slice(0, 2), [{ id: 'furn.villager-photo', count: 1, variant: 'bori' }, { id: 'furn.sofa', count: 1 }]);
  const state = createState();
  const storage = fakeStorage();
  state.inventory[3] = { id: 'furn.wood-bed', count: 1, variant: 'pink' };
  createSave({ state, storage }).save();
  const back = createState();
  assert.equal(createSave({ state: back, storage }).load(), true);
  assert.deepEqual(back.inventory[3], { id: 'furn.wood-bed', count: 1, variant: 'pink' });
});

test('collect 도 변형을 넘긴다', () => {
  const ctx = fakeCtx();
  const { service } = createDataService(ctx, { storage: null });
  assert.equal(service.collect('furn.villager-photo', 1, { variant: 'coco' }).added, 1);
  assert.ok(service.inventory.slots.some(s => s?.id === 'furn.villager-photo' && s.variant === 'coco'));
});
