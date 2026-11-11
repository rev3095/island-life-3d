// M13-P1 섬 일지 규칙 (13차 보드 D141-A): 하루 할 일 고르기 · 세기 · 다 한 날 덤 · 오래 하는 목표 · 교환
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/journal/rules.js';
import * as items from '../src/data/items.js';

const cfg = JSON.parse(readFileSync(new URL('../assets/journal/journal.json', import.meta.url), 'utf8'));

test('일지 설정: 할 일 id 겹침 없음 · 셀 일은 모듈이 세는 것만 · 교환 물건은 있는 아이템', () => {
  const ON = new Set(['fish', 'bug', 'shake', 'dig', 'weed', 'water', 'plant', 'talk', 'sell', 'craft', 'donate', 'allDone']);
  const ids = cfg.tasks.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of cfg.tasks) { assert.ok(ON.has(t.on), t.id); assert.ok(t.need >= 1 && t.pts > 0, t.id); }
  for (const g of cfg.goals) { assert.ok(ON.has(g.on), g.id); assert.equal(g.steps.length, g.pts.length, g.id); }
  for (const e of cfg.shop) if (e.kind === 'item') assert.ok(items.has(e.item), e.item);
  assert.ok(new Set(cfg.tasks.map(t => t.on)).size >= cfg.daily, '셀 일 가짓수 ≥ 하루 할 일 수');
});

test('하루 할 일: 날마다 같게 · 날이 바뀌면 달라짐 · 셀 일 겹치지 않음', () => {
  const a = R.pickTasks(cfg, '2026-11-12', 3).map(t => t.id);
  assert.deepEqual(R.pickTasks(cfg, '2026-11-12', 3).map(t => t.id), a);
  assert.equal(a.length, cfg.daily);
  const ons = R.pickTasks(cfg, '2026-11-12', 3).map(t => t.on);
  assert.equal(new Set(ons).size, ons.length);
  const days = ['2026-11-13', '2026-11-14', '2026-11-15'].map(d => R.pickTasks(cfg, d, 3).map(t => t.id).join());
  assert.ok(days.some(d => d !== a.join()), '다른 날엔 다른 목록');
});

test('세기: 할 일 끝 → 포인트 · 다 한 날 덤 한 번 · 다음 날 새로', () => {
  const state = {};
  const j = R.ensure(state, cfg, '2026-11-12', 3);
  let total = 0;
  for (const row of [...j.tasks]) {
    const t = cfg.tasks.find(x => x.id === row.id);
    const r = R.bump(j, cfg, t.on, t.need);
    assert.ok(r.done.some(d => d.id === t.id));
    total += r.gained;
  }
  assert.equal(j.allDay, '2026-11-12');
  assert.equal(j.points, total);
  const again = R.bump(j, cfg, cfg.tasks.find(x => x.id === j.tasks[0].id).on, 5);
  assert.equal(again.done.length, 0, '끝난 할 일은 다시 안 셈');
  assert.equal(again.allDone, false);
  R.ensure(state, cfg, '2026-11-13', 3);
  assert.ok(state.journal.tasks.every(r => !r.done && r.n === 0));
  assert.equal(state.journal.points, j.points, '포인트는 남음');
});

test('오래 하는 목표: 단계마다 한 번씩 포인트', () => {
  const j = R.ensure({}, { ...cfg, tasks: [] }, '2026-11-12');
  const g = cfg.goals.find(x => x.on === 'fish');
  const r1 = R.bump(j, cfg, 'fish', g.steps[0]);
  assert.deepEqual(r1.goals.map(x => x.step), [1]);
  assert.equal(r1.gained, g.pts[0]);
  const r2 = R.bump(j, cfg, 'fish', g.steps[2]);
  assert.deepEqual(r2.goals.map(x => x.step), [2, 3]);
  assert.equal(R.bump(j, cfg, 'fish', 1000).goals.length, 0);
  assert.equal(R.view(j, cfg).goals.find(x => x.id === g.id).max, true);
});

test('교환: 모자라면 안 되고, 되면 포인트를 뺌', () => {
  const j = R.ensure({}, cfg, '2026-11-12');
  const e = cfg.shop[0];
  assert.equal(R.spend(j, e), false);
  j.points = e.cost + 5;
  assert.equal(R.spend(j, e), true);
  assert.equal(j.points, 5);
  assert.equal(j.bought[e.id], 1);
  assert.equal(R.view(j, cfg).shop.find(x => x.id === e.id).can, false);
});

test('섬폰: 일지 창이 있을 때만 「섬 일지」 줄', async () => {
  const { visibleApps } = await import('../src/ui/phone.js');
  assert.ok(!visibleApps({}).some(a => a.id === 'journal'));
  assert.ok(visibleApps({ journal: { open() {} } }).some(a => a.id === 'journal'));
});
