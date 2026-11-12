// M16 잠수 (D160–D164): 스쿠버 키트 상점 · 바다 생물 출현 · 헤엄 자세 · 잡기·달아나기 규칙 (순수 함수)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as items from '../src/data/items.js';
import { shopStock } from '../src/data/economy.js';
import { seaPool, sea } from '../src/data/spawns.js';
import { pose, bodyPlace, SWIM_PITCH, DIVE_PITCH } from '../src/player/swim.js';
import { inSea, fleeStep, canCatch, CATCH_R, MARGIN, FLEE_V, WANDER_V } from '../src/gameplay/gather/dive.js';
import { rngFor } from '../src/data/rng.js';

test('상점: 스쿠버 키트는 날마다 늘 판다 (rules.json shop.always) · 하루 도구는 손 도구 그대로', () => {
  for (const day of ['2026-11-12', '2027-01-03', '2027-07-15']) {
    const s = shopStock(day, 7);
    assert.ok(s.always.includes('tool.scuba-kit'), day);
    assert.ok(s.all.includes('tool.scuba-kit'), day);
    assert.equal(s.tools.length, items.list('tool').filter(t => t.tool).length);
    assert.ok(!s.tools.includes('tool.scuba-kit'));
  }
});

test('바다 생물 출현: 시각·달을 따르고, 계절마다 몇 가지는 늘 있다', () => {
  for (let month = 1; month <= 12; month++) {
    for (const hour of [6, 12, 22]) {
      const pool = seaPool({ hour, month });
      assert.ok(pool.length >= 3, `${month}월 ${hour}시: ${pool.length}`);
      for (const { item } of pool) assert.ok(item.months.includes(month) && item.category === 'sea');
    }
  }
  // 밤에만: 전복 · 갯가재 · 투구게 · 앵무조개 — 낮 12시엔 안 나옴
  const noon = new Set(seaPool({ hour: 12, month: 7 }).map(e => e.item.id));
  for (const id of ['sea.abalone', 'sea.horseshoe-crab']) assert.ok(!noon.has(id), id);
  const night = new Set(seaPool({ hour: 22, month: 7 }).map(e => e.item.id));
  assert.ok(night.has('sea.horseshoe-crab'));
  // 같은 씨앗이면 같은 결과
  assert.equal(sea({ hour: 12, month: 1, rng: rngFor(3, 'a') }), sea({ hour: 12, month: 1, rng: rngFor(3, 'a') }));
  // 희귀(키다리게)는 흔한 것보다 가볍다
  const w = id => seaPool({ hour: 12, month: 1 }).find(e => e.item.id === id)?.weight;
  assert.ok(w('sea.spider-crab') < w('sea.starfish'));
});

test('헤엄 자세 AN-15 · 잠기기 AN-16: 섞기 0 이면 덧돌림 없음, 몸은 엉덩이를 물낯 둘레에', () => {
  const zero = pose(1.3, 0.7, 0.4, 0);
  for (const v of Object.values(zero)) assert.ok(v.every(x => Math.abs(x) < 1e-9));
  const swim = pose(0, 1, 0), dive = pose(0, 0, 1);
  assert.ok(dive.armR[0] < -2.5 && dive.armL[0] < -2.5, '잠길 땐 두 팔을 머리 앞으로');
  assert.ok(swim.head[0] < -0.5, '헤엄칠 땐 고개를 들어 앞을 본다');
  const b = bodyPlace(0.34, SWIM_PITCH, -0.05);
  // 엉덩이 (0, 0.34, 0) 을 X 로 기울이면 (0, 0.34 cos, 0.34 sin) → 더하면 (0, -0.05, 0)
  assert.ok(Math.abs(0.34 * Math.cos(SWIM_PITCH) + b.y + 0.05) < 1e-9);
  assert.ok(Math.abs(0.34 * Math.sin(SWIM_PITCH) + b.z) < 1e-9);
  assert.ok(DIVE_PITCH > SWIM_PITCH);
});

test('잡기 · 달아나기: 잠겨야 잡고, 클수록 닿는 거리가 넓고, 빠른 것은 헤엄보다 느리게 달아난다', () => {
  assert.equal(canCatch(0.5, 2, false), false, '물 위에선 못 잡음');
  assert.equal(canCatch(CATCH_R, 1, true), true);
  assert.equal(canCatch(CATCH_R + 0.2, 1, true), false);
  assert.equal(canCatch(CATCH_R + 0.2, 6, true), true);
  const n = fleeStep(1, 0, 0, 0, 1, 0.5);
  assert.deepEqual([n.x, n.z], [1.5, 0]);
  const underSpeed = 2.6 * 0.55, runUnder = 5 * 0.55;
  assert.ok(FLEE_V[2] < underSpeed && FLEE_V[3] < runUnder, '보통은 걸어서, 빠른 것은 달려서 따라잡는다');
  assert.ok(WANDER_V.every((v, i) => i === 0 ? v === 0 : v > 0));
  assert.equal(inSea(32 + MARGIN, 0, 64, 56), true);
  assert.equal(inSea(32 + MARGIN + 0.1, 0, 64, 56), false);
});

test('박물관·도감: 바다 생물을 기증·기록할 수 있다 (분류 sea)', () => {
  assert.ok(items.COLLECTIBLE.includes('sea'));
  assert.equal(items.list('sea').length, 20);
});
