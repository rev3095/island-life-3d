// W3 집 안 칸 계산 (src/gameplay/house/grid.js): 놓을 자리·돌리기·러그 겹침·벽 자리·방 안 충돌
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dims, cellsOf, facingDir, fits, spotInFront, rotateInPlace, wallInFront, wallFree, moveCircle } from '../src/gameplay/house/grid.js';

const INFO = { sofa: { footprint: [2, 1] }, bed: { footprint: [2, 3] }, rug: { footprint: [3, 3], layer: 'rug' }, chair: { footprint: [1, 1] } };
const info = id => INFO[id] ?? null;

test('돌리면 발자국 가로·깊이가 바뀐다', () => {
  assert.deepEqual(dims([2, 3], 0), [2, 3]);
  assert.deepEqual(dims([2, 3], 1), [3, 2]);
  assert.deepEqual(cellsOf({ gx: 1, gz: 2, rot: 1 }, [2, 1]), [[1, 2], [1, 3]]);
});

test('바라보는 쪽 → 놓을 때 정면이 플레이어를 본다', () => {
  assert.equal(facingDir(0).rot, 0);              // 북쪽을 보면 가구는 남쪽(플레이어)을 본다
  assert.equal(facingDir(Math.PI / 2).rot, 1);    // 서쪽 → 동쪽을 본다
  assert.equal(facingDir(Math.PI).rot, 2);
  assert.equal(facingDir(-Math.PI / 2).rot, 3);
});

test('앞 칸에 놓고, 막히면 옆으로 비킨다', () => {
  const placed = [];
  assert.deepEqual(spotInFront(placed, 'sofa', 4.5, 6.5, 0, info), { gx: 4, gz: 5, rot: 0 });
  placed.push({ id: 'a', item: 'sofa', gx: 3, gz: 5, rot: 0 });
  assert.deepEqual(spotInFront(placed, 'sofa', 4.5, 6.5, 0, info), { gx: 5, gz: 5, rot: 0 });
  assert.equal(spotInFront([], 'bed', 1.5, 6.5, Math.PI, info), null);   // 앞이 벽이면 자리 없음
});

test('러그는 가구와 겹쳐도 되고 러그끼리는 안 된다', () => {
  const placed = [{ id: 'r', item: 'rug', gx: 2, gz: 2, rot: 0 }];
  assert.ok(fits(placed, { id: 'c', item: 'chair', gx: 3, gz: 3, rot: 0 }, info));
  assert.ok(!fits(placed, { id: 'r2', item: 'rug', gx: 4, gz: 4, rot: 0 }, info));
  assert.ok(!fits([], { id: 'c', item: 'chair', gx: 3, gz: 3, rot: 0 }, info, { reserved: new Set(['3,3']) }));
  assert.ok(!fits([], { id: 'c', item: 'bed', gx: 7, gz: 0, rot: 0 }, info));   // 방 밖으로 나감
});

test('제자리 돌리기는 가운데를 지키고, 막히면 비킨다', () => {
  const rec = { id: 'a', item: 'sofa', gx: 3, gz: 5, rot: 0 };
  assert.deepEqual(rotateInPlace([rec], rec, info), { gx: 4, gz: 5, rot: 1 });
  assert.deepEqual(rotateInPlace([rec], rec, info, { blockCells: new Set(['4,5']) }), { gx: 3, gz: 5, rot: 1 });
});

test('벽 가구: 벽을 보고 가까이 서야 하고, 창문 자리는 창문 가구만', () => {
  assert.deepEqual(wallInFront(2.3, 0.8, 0), { wall: 'n', slot: 2 });
  assert.equal(wallInFront(2.3, 3.0, 0), null);
  assert.deepEqual(wallInFront(0.8, 3.2, Math.PI / 2), { wall: 'w', slot: 3 });
  const windows = new Set(['n:1']);
  assert.ok(wallFree([], 'n', 1, 'window', windows));
  assert.ok(!wallFree([], 'n', 2, 'window', windows));
  assert.ok(!wallFree([], 'n', 1, 'wall', windows));
  assert.ok(!wallFree([{ id: 'x', wall: 'n', slot: 2 }], 'n', 2, 'wall', windows));
});

test('충돌: 가구 상자와 방 벽에서 멈춘다', () => {
  const box = [{ x0: 3, z0: 5, x1: 5, z1: 6 }], bounds = { x0: 0, z0: 0, x1: 8, z1: 8 };
  assert.deepEqual(moveCircle(box, bounds, 4, 6.5, 4, 5.5, 0.26), { x: 4, z: 6.26 });
  const p = moveCircle([], bounds, 1, 1, -1, 1, 0.26);
  assert.equal(p.x, 0.26);
});
