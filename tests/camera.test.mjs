// 시점 조작 (P12, src/player/camera.js): 올려다보기·내려다보기·둘레 돌기 각 계산, 땅 위로 올리기, 돌아오기, 입력 겹침.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookView, clearY, shouldReturn, LOOK, PRESETS, BASE_FOV, portraitView } from '../src/player/camera.js';
import { viewMove } from '../src/core/input.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const rad = d => (d * Math.PI) / 180;
const baseOf = (zoom = 0.15, aspect = 1280 / 800) => {
  const t = portraitView(aspect), P = PRESETS, m = (a, b) => a + (b - a) * zoom;
  return { pitch: m(P.near.pitch, P.far.pitch) + t.pitch, dist: m(P.near.dist, P.far.dist) * t.distK, curve: m(P.near.curve, P.far.curve), fov: t.fov };
};

/** 시점(v) 으로 본 화면: 카메라 높이(초점 땅 위), 곡면 지평선의 화면 높이, 플레이어 몸이 화면 어디인지 (NDC y: −1 아래 끝 ~ 1 위 끝) */
function screen(v) {
  const Hc = 0.55 + Math.sin(rad(v.elev)) * v.dist, hd = Math.cos(rad(v.elev)) * v.dist;
  const half = Math.tan(rad(v.fov / 2));
  const ndc = below => -Math.tan(rad(below) - rad(v.aim)) / half;          // 수평 아래 below 도인 점
  // 곡면 땅 y = −k·u² (u = 초점에서 앞으로) 에 카메라(u = −hd, 높이 Hc)에서 닿는 접선 = 보이는 지평선
  const u = -hd + Math.sqrt(hd * hd + Hc / Math.max(v.curve, 1e-9));
  const horizon = (Math.atan(2 * v.curve * u) * 180) / Math.PI;
  const at = h => (Math.atan2(Hc - h, hd) * 180) / Math.PI;                 // 초점 위 h 높이 점
  return { Hc, hd, horizon: ndc(horizon), feet: ndc(at(0)), body: ndc(at(0.55)), head: ndc(at(0.95)) };
}

test('시점: 조작하지 않으면(tilt 0) 원래 각도·거리·곡면·시야각 그대로', () => {
  for (const zoom of [0, 0.15, 1]) {
    const b = baseOf(zoom), v = lookView(b, 0, 0);
    assert.deepEqual(v, { elev: b.pitch, aim: b.pitch, dist: b.dist, curve: b.curve, fov: b.fov, yaw: 0 });
  }
  assert.equal(lookView(baseOf(), NaN, NaN).elev, baseOf().pitch);
});

test('시점: 끝까지 올려다보면 지평선 위 하늘이 화면 절반 넘게, 플레이어는 화면 안 (가로·세로 화면, 가까이·멀리)', () => {
  for (const aspect of [1280 / 800, 1, 375 / 812]) {
    for (const zoom of [0, 0.15, 1]) {
      const v = lookView(baseOf(zoom, aspect), 1, 0);
      near(v.elev, LOOK.upElev); near(v.aim, -LOOK.upAim);
      assert.ok(v.dist <= LOOK.upDist + 1e-9 && v.curve <= LOOK.upCurve + 1e-12);
      const s = screen(v), sky = (1 - s.horizon) / 2;
      assert.ok(sky > 0.6, `하늘 몫 ${sky.toFixed(2)} (aspect ${aspect.toFixed(2)}, zoom ${zoom})`);
      assert.ok(s.feet > -1 && s.body > -0.9, `발 ${s.feet.toFixed(2)} · 몸 ${s.body.toFixed(2)} (화면 안)`);
      assert.ok(s.Hc > 0.8, `카메라 높이 ${s.Hc.toFixed(2)}`);
    }
  }
  // 원래 시점은 지평선이 화면 위쪽 (땅만 보는 셈으로 19% — 실제로는 나무·건물·북쪽 언덕이 가려 5~8%), 올려다보면 네 배쯤
  const sky0 = (1 - screen(lookView(baseOf(), 0, 0)).horizon) / 2, sky1 = (1 - screen(lookView(baseOf(), 1, 0)).horizon) / 2;
  assert.ok(sky0 < 0.25 && sky1 > sky0 * 3, `${sky0.toFixed(2)} → ${sky1.toFixed(2)}`);
});

test('시점: 올려다볼수록 카메라가 내려오고 시야각이 넓어진다 (흔들림 줄이기면 시야각 그대로)', () => {
  const b = baseOf();
  let prev = lookView(b, 0, 0);
  for (const t of [0.25, 0.5, 0.75, 1]) {
    const v = lookView(b, t, 0);
    assert.ok(v.elev < prev.elev && v.aim < prev.aim && v.fov > prev.fov, `t ${t}`);
    prev = v;
  }
  near(lookView(b, 1, 0).fov, b.fov + LOOK.upFov);
  near(lookView(b, 1, 0, { calm: true }).fov, b.fov + LOOK.calmFov);
  assert.equal(lookView(b, 2, 0).elev, lookView(b, 1, 0).elev, '1 넘게는 안 간다');
});

test('시점: 내려다보기는 더 높이서 초점을 본다, 둘레 돌기는 한계까지·옆으로 돌수록 곡면이 약해진다', () => {
  const b = baseOf(), d = lookView(b, -1, 0);
  near(d.elev, LOOK.downElev); assert.equal(d.aim, d.elev); near(d.dist, b.dist * LOOK.downDist);
  assert.ok(lookView(b, -0.5, 0).elev > b.pitch && lookView(b, -0.5, 0).elev < LOOK.downElev);
  const lim = rad(LOOK.yawMax);
  near(lookView(b, 0, 5).yaw, lim); near(lookView(b, 0, -5).yaw, -lim);
  near(lookView(b, 0, rad(90)).curve, b.curve * (1 + (LOOK.sideCurve - 1) * Math.sin(lim) ** 2));
  assert.ok(lookView(b, 0, 0.3).curve < b.curve && lookView(b, 0, -0.3).curve === lookView(b, 0, 0.3).curve);
});

test('시점: 카메라는 땅 위로 — 뒤쪽이 높으면 올리고, 곡면으로 내려간 만큼은 덜 올린다', () => {
  const pivot = { x: 0, y: 0.55, z: 0 }, cam = { x: 0, y: 1.2, z: 9 };
  assert.equal(clearY(pivot, cam, () => 0), cam.y, '평평한 땅: 그대로');
  const hill = (x, z) => (z > 5 ? 2 : 0);                 // 카메라 쪽(남쪽) 5칸 뒤부터 2칸 높은 땅
  const y = clearY(pivot, cam, hill, { margin: 0.35 });
  assert.ok(y > 2.35, `올린 높이 ${y}`);
  for (let s = 0.1; s <= 1; s += 0.05) {                   // 올린 선은 높은 땅(+여유) 위로 지난다
    const z = 9 * s;
    if (z > 5 + 9 / 6) assert.ok(pivot.y + s * (y - pivot.y) >= 2.35 - 0.2, `z ${z.toFixed(1)}`);
  }
  assert.ok(clearY(pivot, cam, hill, { margin: 0.35, k: 0.006, fz: 0 }) < y, '곡면: 먼 땅은 내려가 보인다');
  assert.equal(clearY(pivot, cam, () => NaN), cam.y, '땅을 모르면 그대로');
});

test('시점: 돌아오기 — 놓으면(release) · 걸으면(walk) · 그대로(stay), 막히면(집 안·장면·창) 늘 돌아온다', () => {
  assert.equal(shouldReturn('release', { active: true }), false);
  assert.equal(shouldReturn('release', {}), true);
  assert.equal(shouldReturn('walk', {}), false);
  assert.equal(shouldReturn('walk', { moving: true }), true);
  assert.equal(shouldReturn('walk', { moving: true, active: true }), false);
  assert.equal(shouldReturn('stay', { moving: true }), false);
  assert.equal(shouldReturn('stay', { active: true, allowed: false }), true);
  assert.ok(['release', 'walk', 'stay'].includes(LOOK.back));
  assert.ok(LOOK.backSpeed > 0 && LOOK.calmBack > 0 && LOOK.calmBack <= LOOK.backSpeed);
});

test('시점: 둘레를 돌면 키보드·패드의 "위" 가 카메라가 보는 쪽', () => {
  assert.deepEqual(viewMove(0.3, -1, 0), { x: 0.3, z: -1 });
  assert.deepEqual(viewMove(0, 0, 1), { x: 0, z: 0 });
  for (const yaw of [-1, -0.4, 0.5, 1]) {
    const up = viewMove(0, -1, yaw), right = viewMove(1, 0, yaw);
    // 카메라는 초점 + (sin yaw, ·, cos yaw)·거리 에 있고 초점 쪽 (−sin, −cos) 을 본다 (camera.js place)
    near(up.x, -Math.sin(yaw)); near(up.z, -Math.cos(yaw));
    near(up.x * right.x + up.z * right.z, 0); near(Math.hypot(right.x, right.z), 1);
    near(up.x * right.z - up.z * right.x, 1);               // 오른쪽은 위에서 시계 방향 90° (화면 오른쪽)
  }
});

test('시점: 오른쪽·가운데 끌기는 걷기(왼쪽)와 안 겹치고, 오른쪽 메뉴는 캔버스에서만 막는다', () => {
  const cam = read('src/player/camera.js');
  assert.match(cam, /e\.button !== 2 && e\.button !== 1/);
  assert.match(cam, /el\.addEventListener\('contextmenu', e => e\.preventDefault\(\)\)/);
  assert.doesNotMatch(cam, /(window|document)\.addEventListener\('contextmenu'/);
  assert.match(cam, /e\.pointerType === 'touch'/);           // 손가락은 두 손가락 몸짓으로만
  assert.match(cam, /ctx\.services\.story\?\.playing/);       // 장면 동안 안 함
  assert.match(cam, /ui\?\.isBlocking/);                      // 창이 열려 있으면 안 함
  assert.match(cam, /story:start/);
  assert.match(read('src/player/mouse.js'), /e\.button !== 0/);
  // 시점 키는 다른 키와 안 겹친다
  const input = read('src/core/input.js');
  const keysOf = name => [...new RegExp(`const ${name} = \\{([^}]*)\\}`).exec(input)[1].matchAll(/(\w+):/g)].map(m => m[1]);
  const look = keysOf('LOOK_KEYS');
  assert.deepEqual(look.sort(), ['KeyR', 'KeyV', 'PageDown', 'PageUp']);
  for (const k of [...keysOf('KEYS'), ...keysOf('MOVE'), 'Minus', 'Equal', 'KeyH', 'ShiftLeft']) assert.ok(!look.includes(k), k);
  assert.match(read('src/ui/hud.js'), /\['우클릭 끌기 · R\/V', '올려다보기'\]/);
  assert.equal(BASE_FOV, 32);
});
