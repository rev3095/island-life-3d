// 4차 Y1: 행동 키 미리보기(interactions.peek)·버튼 글자 표·save.reset 이 모든 칸을 지우는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInteractions, labelOf, LABELS, TOOL_LABEL, INTENT_LABEL, IMPURE } from '../src/gameplay/index.js';
import { createSave, SAVE_KEY } from '../src/data/save.js';
import { createState } from '../src/core/state.js';
import { fakeCtx, fakeStorage } from './helpers.mjs';

function setup() {
  const ctx = fakeCtx();
  ctx.input = { enabled: true };
  const I = createInteractions(ctx);
  const runs = [];
  const add = (h) => I.api.add({ run: t => runs.push([h.name, t]), ...h });
  return { ctx, I, runs, add };
}

test('peek: 우선순위 높은 처리기부터, intent 가 맞는 첫 처리기의 이름·글자', () => {
  const { I, add } = setup();
  let villager = null, tree = null;
  add({ name: 'town:talk', intent: 'action', priority: 100, test: () => villager });
  add({ name: 'gather-shake', intent: 'action', priority: 60, test: () => tree });
  add({ name: 'gather-pickup', intent: 'pickup', priority: 50, test: () => ({ type: 'weed' }) });
  assert.equal(I.api.peek('action'), null);
  tree = { id: 1 };
  assert.deepEqual(I.api.peek('action'), { name: 'gather-shake', label: '흔들기' });
  villager = { slug: 'bori' };
  assert.deepEqual(I.api.peek('action'), { name: 'town:talk', label: '말 걸기' });
  assert.deepEqual(I.api.peek('pickup'), { name: 'gather-pickup', label: '뽑기' });
});

test('peek 는 run 하지 않고, dispatch 는 peek 와 같은 처리기를 run 한다', () => {
  const { I, runs, add } = setup();
  add({ name: 'house-door-in', intent: 'action', priority: 90, test: () => true });
  add({ name: 'gather-tool', intent: 'action', priority: 10, test: () => 'axe' });
  const p = I.api.peek('action');
  assert.equal(runs.length, 0);
  assert.equal(p.label, '들어가기');
  assert.equal(I.dispatch('action'), true);
  assert.deepEqual(runs, [['house-door-in', true]]);
});

test('도구 글자: 든 도구에 따라', () => {
  const { I, add } = setup();
  let tool = 'rod';
  add({ name: 'gather-tool', intent: 'action', priority: 10, test: () => tool });
  for (const [t, label] of Object.entries(TOOL_LABEL)) { tool = t; assert.equal(I.api.peek('action').label, label); }
  assert.deepEqual(TOOL_LABEL, { rod: '낚시', net: '채집', shovel: '파기', axe: '찍기', can: '물 주기', sling: '쏘기' });   // + M13 새총
});

test('처리기가 준 label 이 표보다 먼저, 표에 없으면 기본 글자', () => {
  const { ctx } = setup();
  assert.equal(labelOf({ name: 'town:talk', label: '인사하기' }, {}, 'action', ctx), '인사하기');
  assert.equal(labelOf({ name: 'town:talk', label: t => `${t.name}와 얘기` }, { name: '보리' }, 'action', ctx), '보리와 얘기');
  assert.equal(labelOf({ name: 'something-new' }, true, 'action', ctx), INTENT_LABEL.action);
  assert.equal(labelOf({ name: 'something-new' }, true, 'pickup', ctx), INTENT_LABEL.pickup);
  assert.equal(labelOf({ name: 'x', label: () => { throw new Error('x'); } }, true, 'action', ctx), '');
});

test('낚시 중엔 당기기, 동작 중엔 빈 글자 (intent 가 없는 처리기는 두 키 다)', () => {
  const { ctx, I, add } = setup();
  const fishing = { active: true };
  ctx.services.gather = { fishing };
  add({ name: 'gather-busy', priority: 200, test: () => 'busy' });
  assert.equal(I.api.peek('action').label, '당기기');
  assert.equal(I.api.peek('pickup').label, '당기기');
  fishing.active = false;
  assert.equal(I.api.peek('action').label, '');
});

test('창이 열렸거나 입력이 꺼지면 peek 는 null', () => {
  const { ctx, I, add } = setup();
  add({ name: 'house-place', intent: 'action', priority: 20, test: () => true });
  ctx.services.ui = { isBlocking: () => true };
  assert.equal(I.api.peek('action'), null);
  assert.equal(I.dispatch('action'), false);
  ctx.services.ui.isBlocking = () => false;
  ctx.input.enabled = false;
  assert.equal(I.api.peek('action'), null);
  ctx.input.enabled = true;
  assert.equal(I.api.peek('action').name, 'house-place');
});

test('부작용 있는 test 는 peek 가 부르지 않는다 (pure: false · IMPURE)', () => {
  const { I, add } = setup();
  let calls = 0;
  add({ name: 'noisy', intent: 'action', priority: 100, pure: false, test: () => { calls++; return true; } });
  add({ name: 'gather-shake', intent: 'action', priority: 60, test: () => ({}) });
  assert.equal(I.api.peek('action').name, 'gather-shake');
  assert.equal(calls, 0);
  assert.equal(I.dispatch('action'), true);
  assert.equal(calls, 1);
  IMPURE.add('gather-shake');
  try { assert.equal(I.api.peek('action'), null); } finally { IMPURE.delete('gather-shake'); }
});

test('test 가 예외를 내면 건너뛴다', () => {
  const { I, add } = setup();
  const err = console.error; console.error = () => {};
  try {
    add({ name: 'broken', intent: 'action', priority: 100, test: () => { throw new Error('x'); } });
    add({ name: 'town:mail', intent: 'action', priority: 91, test: () => ({}) });
    assert.deepEqual(I.api.peek('action'), { name: 'town:mail', label: '우편함' });
  } finally { console.error = err; }
});

test('글자 표: 모든 처리기 이름에 글자가 있다', () => {
  const names = ['gather-busy', 'gather-shake', 'gather-pickup', 'gather-plant', 'gather-tool',
    'town:talk', 'town:intro', 'town:firstday', 'town:knock', 'town:mail', 'town:shop', 'town:museum',
    'house-move-drop', 'house-move-cancel', 'house-door-in', 'house-door-out', 'house-furniture', 'house-furniture-store', 'house-place'];
  for (const n of names) assert.ok(n in LABELS, n);
  const ctx = fakeCtx();
  assert.equal(labelOf({ name: 'house-furniture' }, { kind: 'workbench' }, 'action', ctx), '만들기');
  assert.equal(labelOf({ name: 'gather-pickup' }, { type: 'drop' }, 'pickup', ctx), '줍기');
  assert.equal(labelOf({ name: 'gather-pickup' }, { type: 'flower' }, 'pickup', ctx), '꺾기');
});

test('save.reset: createState 에 없는 최상위 칸까지 지우고, 있는 칸은 같은 참조로 새 값', () => {
  const storage = fakeStorage();
  const state = createState();
  state.mail = { box: [{ from: 'bori' }] };
  state.extra = 3;
  state.player.name = '하늘';
  state.island.spots = { holes: ['1,2'] };
  const inv = state.inventory, island = state.island;
  let resets = 0;
  const s = createSave({ state, storage, onReset: () => resets++ });
  s.save();
  assert.equal(s.reset(), true);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(resets, 1);
  assert.equal('mail' in state, false);
  assert.equal('extra' in state, false);
  assert.equal(state.player.name, '');
  assert.equal(state.island, island);
  assert.equal('spots' in state.island, false);
  assert.equal(state.inventory, inv);
  assert.deepEqual(Object.keys(state).sort(), Object.keys(createState()).sort());
});
