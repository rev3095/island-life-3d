import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import { createWallet, WALLET_MAX } from '../src/data/wallet.js';
import { createMuseum } from '../src/data/museum.js';

test('지갑: 더하기·쓰기', () => {
  const state = createState();
  const seen = [];
  const w = createWallet(state, { onChange: n => seen.push(n) });
  assert.equal(w.get(), 0);
  assert.equal(w.add(300), 300);
  assert.equal(w.spend(120), true);
  assert.equal(w.get(), 180);
  assert.equal(state.wallet.acorns, 180);
  assert.deepEqual(seen, [300, 180]);
});

test('지갑: 모자라면 안 빠지고, 음수·NaN 은 무시', () => {
  const state = createState();
  const w = createWallet(state);
  w.add(100);
  assert.equal(w.spend(101), false);
  assert.equal(w.get(), 100);
  assert.equal(w.spend(-50), false);
  assert.equal(w.spend(NaN), false);
  assert.equal(w.add(-500), 100);
  assert.equal(w.add(NaN), 100);
  assert.equal(w.add(Infinity), 100);
  assert.equal(w.get(), 100);
  assert.equal(w.spend(100), true);
  assert.equal(w.get(), 0);
});

test('지갑: 최대치를 넘지 않는다', () => {
  const state = createState();
  const w = createWallet(state);
  w.add(WALLET_MAX - 10);
  assert.equal(w.add(1000), WALLET_MAX);
  state.wallet.acorns = -30;        // 망가진 값도 0 으로 읽는다
  assert.equal(w.get(), 0);
});

test('박물관: 한 번씩만 기증, 물고기·곤충·화석만', () => {
  const state = createState();
  const seen = [];
  const m = createMuseum(state, { onChange: id => seen.push(id) });
  assert.equal(m.donate('fish.crucian'), true);
  assert.equal(m.donate('fish.crucian'), false);
  assert.equal(m.donate('fruit.apple'), false);
  assert.equal(m.donate('nope'), false);
  assert.equal(m.donate('fossil.amber'), true);
  assert.ok(m.has('fish.crucian'));
  assert.ok(!m.has('fish.carp'));
  assert.deepEqual(seen, ['fish.crucian', 'fossil.amber']);
  assert.deepEqual(state.museum.fish, ['fish.crucian']);
  assert.ok(m.caught('fish.crucian'), '기증하면 도감에도 적힌다');
});

test('박물관: progress', () => {
  const state = createState();
  const m = createMuseum(state);
  m.donate('bug.ant');
  m.donate('bug.moth');
  const p = m.progress();
  assert.deepEqual(p.fish, [0, 22]);   // + P35 무인도 물고기 둘
  assert.deepEqual(p.bug, [2, 24]);    // + P35 무인도 곤충 둘
  assert.deepEqual(p.fossil, [0, 8]);
  assert.deepEqual(p.art, [0, 16]);   // P54 미술품 진품 16 (가품은 안 받음)
  assert.deepEqual(p.total, [2, 70]);
  assert.equal(p.complete, false);
});

test('도감: 잡은 것 기록', () => {
  const state = createState();
  const m = createMuseum(state);
  assert.equal(m.record('fish.tuna'), true);
  assert.equal(m.record('fish.tuna'), false);
  assert.equal(m.record('fossil.amber'), false);
  assert.deepEqual(state.encyclopedia.fish, ['fish.tuna']);
});
