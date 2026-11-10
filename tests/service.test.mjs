// 데이터 모듈이 CONTRACTS.md 의 data 서비스 모양을 지키는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dataModule, { createDataService, STARTER, AUTOSAVE_GAME_MINUTES } from '../src/data/index.js';
import { SAVE_KEY } from '../src/data/save.js';
import { fakeCtx, fakeStorage, fakeTime } from './helpers.mjs';

const fn = 'function';

test('모듈 모양: { name: data, init, update }', () => {
  assert.equal(dataModule.name, 'data');
  assert.equal(typeof dataModule.init, fn);
  assert.equal(typeof dataModule.update, fn);
});

test('init 은 ctx.services.data 를 계약대로 올린다 (다른 서비스 없이)', () => {
  const ctx = fakeCtx();
  dataModule.init(ctx);
  const d = ctx.services.data;
  assert.ok(d);
  for (const k of ['get', 'list']) assert.equal(typeof d.items[k], fn, `items.${k}`);
  for (const k of ['fish', 'bug', 'fossil', 'rock', 'treeShake']) assert.equal(typeof d.spawns[k], fn, `spawns.${k}`);
  assert.equal(d.inventory.slots.length, 20);
  for (const k of ['add', 'remove', 'count', 'isFull']) assert.equal(typeof d.inventory[k], fn, `inventory.${k}`);
  for (const k of ['get', 'add', 'spend']) assert.equal(typeof d.wallet[k], fn, `wallet.${k}`);
  for (const k of ['donate', 'has', 'progress']) assert.equal(typeof d.museum[k], fn, `museum.${k}`);
  for (const k of ['list', 'canCraft', 'craft']) assert.equal(typeof d.recipes[k], fn, `recipes.${k}`);
  for (const k of ['save', 'load', 'reset']) assert.equal(typeof d.save[k], fn, `save.${k}`);
  for (const k of ['key', 'check']) assert.equal(typeof d.day[k], fn, `day.${k}`);
  assert.match(d.day.key(), /^\d{4}-\d{2}-\d{2}$/);
  dataModule.update(0.016, ctx);
});

test('계약 예시 호출이 그대로 돈다', () => {
  const ctx = fakeCtx();
  const { service: d } = createDataService(ctx, { storage: fakeStorage() });
  assert.equal(d.items.get('fish.crucian').name, '붕어');
  assert.ok(d.items.list('fish').length === 22);   // + P35 무인도 물고기 둘
  assert.ok(d.spawns.fish({ habitat: 'river', hour: 12, month: 10, weather: 'clear', rng: Math.random }).startsWith('fish.'));
  const b = d.spawns.bug({ place: 'flower', hour: 12, month: 4, weather: 'clear', rng: Math.random });
  assert.ok(b === null || b.startsWith('bug.'));
  assert.ok(d.spawns.fossil(Math.random).startsWith('fossil.'));
  const r = d.spawns.rock(Math.random);
  assert.ok(r.id && r.count >= 1);
  const t = d.spawns.treeShake('tree', Math.random);
  assert.ok(t === null || (t.id && t.count >= 1));
  assert.deepEqual(Object.keys(d.museum.progress()).slice(0, 3), ['fish', 'bug', 'fossil']);
});

test('이벤트: inventory:changed {slots}, wallet:changed {acorns}, museum:changed {id}, save:done {ok}', () => {
  const ctx = fakeCtx();
  const { service: d } = createDataService(ctx, { storage: fakeStorage() });
  d.inventory.add('fish.carp');
  d.wallet.add(50);
  d.museum.donate('fish.carp');
  d.save.save();
  const names = ctx.log.map(([n]) => n);
  for (const n of ['inventory:changed', 'wallet:changed', 'museum:changed', 'save:done']) assert.ok(names.includes(n), n);
  const get = n => ctx.log.find(([x]) => x === n)[1];
  assert.equal(get('inventory:changed').slots, d.inventory.slots);
  assert.equal(get('wallet:changed').acorns, 50);
  assert.deepEqual(get('museum:changed'), { id: 'fish.carp' });
  assert.deepEqual(get('save:done'), { ok: true });
});

test('새 게임은 낚싯대·잠자리채와 도토리를 받는다, 저장이 있으면 불러온다', () => {
  const storage = fakeStorage();
  const a = createDataService(fakeCtx(), { storage });
  assert.equal(a.start(), false);
  assert.equal(a.service.inventory.count('tool.rod'), 1);
  assert.equal(a.service.inventory.count('tool.net'), 1);
  assert.equal(a.service.wallet.get(), STARTER.acorns);
  a.service.wallet.add(100);
  a.service.save.save();

  const b = createDataService(fakeCtx(), { storage });
  assert.equal(b.start(), true);
  assert.equal(b.service.wallet.get(), STARTER.acorns + 100);
  assert.equal(b.service.inventory.count('tool.rod'), 1, '두 번 지급하지 않는다');
});

test('collect: 도토리 주머니는 지갑으로, 물고기는 가방과 도감으로', () => {
  const ctx = fakeCtx();
  const { service: d } = createDataService(ctx, { storage: null });
  assert.deepEqual(d.collect('mat.acorn-bag'), { added: 1, left: 0, acorns: 100 });
  assert.equal(d.wallet.get(), 100);
  assert.deepEqual(d.collect('fish.tuna'), { added: 1, left: 0, acorns: 0 });
  assert.ok(d.museum.caught('fish.tuna'));
  assert.ok(ctx.log.some(([n, p]) => n === 'encyclopedia:changed' && p.id === 'fish.tuna'));
  d.inventory.add('mat.acorn-bag', 3);
  assert.equal(d.openBag(d.inventory.find('mat.acorn-bag')), 300);
  assert.equal(d.wallet.get(), 400);
  const slot = d.inventory.find('fish.tuna');
  assert.equal(d.donateFromSlot(slot), true);
  assert.equal(d.inventory.count('fish.tuna'), 0);
  assert.equal(d.donateFromSlot(slot), false);
});

test('time:newday 를 받으면 하루 리셋, data:newday 를 보낸다', () => {
  let now = { dayKey: '2026-10-28', hour: 9 };
  const ctx = fakeCtx({ time: { now: () => now } });
  createDataService(ctx, { storage: null });
  ctx.events.emit('game:ready', {});
  assert.equal(ctx.state.island.dayKey, '2026-10-28');
  now = { dayKey: '2026-10-29', hour: 5 };
  ctx.events.emit('time:newday', { dayKey: '2026-10-29' });
  assert.equal(ctx.state.island.dayKey, '2026-10-29');
  const news = ctx.log.filter(([n]) => n === 'data:newday').map(([, p]) => p.dayKey);
  assert.deepEqual(news, ['2026-10-28', '2026-10-29']);
});

test('자동 저장: 게임 몇 분마다 (빠른 시간이어도 너무 자주는 아니게)', () => {
  const storage = fakeStorage();
  const ctx = fakeCtx({ time: fakeTime({ dayKey: '2026-10-28' }) });
  const inst = createDataService(ctx, { storage });
  const tick = n => { for (let i = 0; i < n; i++) ctx.events.emit('time:tick', {}); };
  tick(AUTOSAVE_GAME_MINUTES);
  assert.equal(storage.getItem(SAVE_KEY), null, '실제 시간이 아직 짧다');
  inst.update(20);
  tick(1);
  assert.ok(storage.getItem(SAVE_KEY), '저장됨');
  inst.dispose();
});

test('time 서비스가 없으면 실제 1분마다 저장', () => {
  const storage = fakeStorage();
  const inst = createDataService(fakeCtx(), { storage });
  inst.update(30);
  assert.equal(storage.getItem(SAVE_KEY), null);
  inst.update(31);
  assert.ok(storage.getItem(SAVE_KEY));
});

test('save.reset 은 새 게임 지급과 이벤트를 다시 한다', () => {
  const ctx = fakeCtx();
  const inst = createDataService(ctx, { storage: fakeStorage() });
  inst.start();
  inst.service.inventory.add('fish.shark');
  inst.service.wallet.add(9999);
  ctx.log.length = 0;
  inst.service.save.reset();
  assert.equal(inst.service.inventory.count('fish.shark'), 0);
  assert.equal(inst.service.inventory.count('tool.rod'), 1);
  assert.equal(inst.service.wallet.get(), STARTER.acorns);
  assert.ok(ctx.log.some(([n]) => n === 'wallet:changed'));
});
