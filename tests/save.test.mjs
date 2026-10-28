import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import { createSave, migrate, normalize, applyTo, SAVE_KEY, SAVE_VERSION } from '../src/data/save.js';
import { fakeStorage, brokenStorage } from './helpers.mjs';

const sample = () => {
  const s = createState();
  s.wallet.acorns = 1234;
  s.inventory[0] = { id: 'fruit.apple', count: 7 };
  s.inventory[3] = { id: 'tool.rod', count: 1, uses: 12 };
  s.museum.fish.push('fish.crucian');
  s.encyclopedia.bug.push('bug.ant');
  s.island.dayKey = '2026-10-28';
  s.island.fruit = { 'tree-3': '2026-10-27' };
  s.player.x = 4.5;
  s.flags.tutorial = true;
  return s;
};

test('저장 키 이름', () => {
  assert.equal(SAVE_KEY, 'island-life-save-v1');
});

test('저장 → 불러오기 왕복', () => {
  const storage = fakeStorage();
  const src = sample();
  const done = [];
  assert.equal(createSave({ state: src, storage, now: () => 111, onDone: e => done.push(e) }).save(), true);
  assert.deepEqual(done, [{ ok: true }]);
  const raw = JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(raw.v, SAVE_VERSION);
  assert.equal(raw.savedAt, 111);

  const dst = createState();
  const invRef = dst.inventory, walletRef = dst.wallet;
  const s = createSave({ state: dst, storage });
  assert.equal(s.load(), true);
  assert.equal(s.lastSavedAt, 111);
  assert.equal(dst.inventory, invRef, '배열 참조가 그대로');
  assert.equal(dst.wallet, walletRef, '객체 참조가 그대로');
  assert.deepEqual(dst.inventory, src.inventory);
  assert.equal(dst.wallet.acorns, 1234);
  assert.deepEqual(dst.museum, src.museum);
  assert.deepEqual(dst.encyclopedia, src.encyclopedia);
  assert.deepEqual(dst.island, src.island);
  assert.equal(dst.player.x, 4.5);
  assert.equal(dst.flags.tutorial, true);
});

test('저장이 없으면 load 는 false, 상태는 그대로', () => {
  const st = createState();
  st.wallet.acorns = 5;
  assert.equal(createSave({ state: st, storage: fakeStorage() }).load(), false);
  assert.equal(st.wallet.acorns, 5);
});

test('저장소가 없어도(사생활 보호 창) 오류 없이 false', () => {
  const done = [];
  const s = createSave({ state: createState(), storage: null, onDone: e => done.push(e) });
  assert.equal(s.available, false);
  assert.equal(s.save(), false);
  assert.equal(s.load(), false);
  assert.equal(s.exists(), false);
  assert.equal(s.reset(), true);
  assert.deepEqual(done, [{ ok: false }]);
});

test('저장소가 예외를 내도 오류 없이 false', () => {
  const s = createSave({ state: createState(), storage: brokenStorage() });
  assert.equal(s.save(), false);
  assert.equal(s.load(), false);
  assert.equal(s.exists(), false);
  assert.equal(s.reset(), false);
});

test('망가진 저장은 -broken 으로 옮겨 두고 false', () => {
  const storage = fakeStorage({ [SAVE_KEY]: '{not json' });
  assert.equal(createSave({ state: createState(), storage }).load(), false);
  assert.equal(storage.getItem(`${SAVE_KEY}-broken`), '{not json');
});

test('migrate: 버전 정보 없는 옛 저장(v0)을 올린다', () => {
  const old = sample();
  delete old.version;
  delete old.encyclopedia;         // 옛 저장엔 도감 칸이 없었다고 치자
  const data = migrate(old);
  assert.equal(data.v, 1);
  assert.equal(data.state.wallet.acorns, 1234);

  const storage = fakeStorage({ [SAVE_KEY]: JSON.stringify(old) });
  const st = createState();
  assert.equal(createSave({ state: st, storage }).load(), true);
  assert.equal(st.version, 1);
  assert.deepEqual(st.encyclopedia, { fish: [], bug: [] }, '빠진 칸은 기본값');
  assert.deepEqual(st.inventory[0], { id: 'fruit.apple', count: 7 });
});

test('migrate: 더 새 버전 저장은 읽지 않고, 덮어쓰지도 않는다', () => {
  const future = JSON.stringify({ v: SAVE_VERSION + 1, savedAt: 1, state: { wallet: { acorns: 9 } } });
  const storage = fakeStorage({ [SAVE_KEY]: future });
  const s = createSave({ state: createState(), storage });
  assert.equal(s.load(), false);
  assert.equal(s.blocked, true);
  assert.equal(s.save(), false);
  assert.equal(storage.getItem(SAVE_KEY), future);
  assert.throws(() => migrate(null));
  assert.throws(() => migrate('text'));
});

test('normalize: 망가진 값 고치기', () => {
  const st = normalize({
    wallet: { acorns: -4 },
    inventory: [{ id: 'fruit.apple', count: 99 }, { id: '없는.아이템', count: 1 }, { id: 'fish.carp', count: 0 }, 'x', { id: 'tool.axe', count: 1 }],
    museum: { fish: ['fish.carp', 'fish.carp', 'bug.ant', 3] },
    island: { fruit: 'oops' },
  });
  assert.equal(st.inventory.length, 20);
  assert.deepEqual(st.inventory.slice(0, 5), [{ id: 'fruit.apple', count: 10 }, null, null, null, { id: 'tool.axe', count: 1, uses: 60 }]);
  assert.equal(st.wallet.acorns, 0);
  assert.deepEqual(st.museum.fish, ['fish.carp']);
  assert.deepEqual(st.museum.bug, []);
  assert.deepEqual(st.island.fruit, {});
  assert.equal(st.island.seed, createState().island.seed);
  assert.ok(st.settings && st.time && st.house);
});

test('reset: 저장을 지우고 새 상태로', () => {
  const storage = fakeStorage();
  const st = sample();
  let resetCalled = 0;
  const s = createSave({ state: st, storage, onReset: () => resetCalled++ });
  s.save();
  assert.equal(s.exists(), true);
  assert.equal(s.reset(), true);
  assert.equal(s.exists(), false);
  assert.equal(st.wallet.acorns, 0);
  assert.ok(st.inventory.every(x => x === null));
  assert.equal(resetCalled, 1);
});

test('applyTo 는 참조를 지킨다', () => {
  const t = { a: { x: 1, y: 2 }, b: [1, 2], c: 1 };
  const a = t.a, b = t.b;
  applyTo(t, { a: { z: 3 }, b: [9], c: 2, d: 'new' });
  assert.equal(t.a, a);
  assert.deepEqual(t.a, { z: 3 });
  assert.equal(t.b, b);
  assert.deepEqual(t.b, [9]);
  assert.equal(t.c, 2);
  assert.equal(t.d, 'new');
});
