// 마우스로 걷기 (src/player/mouse.js): 화면 광선 → 보이는(곡면) 땅 위 점, 가는 곳까지 방향·달리기·도착.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundPick, steer, MOUSE } from '../src/player/mouse.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const norm = v => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('마우스: 평평한 땅(곡면 0)은 광선이 y = h 와 만나는 점', () => {
  const o = { x: 0, y: 10, z: 10 }, d = norm({ x: 0, y: -1, z: -1 });
  const p = groundPick(o, d, { h: 0, k: 0 });
  near(p.x, 0); near(p.z, 0);
  const q = groundPick({ x: 2, y: 5, z: 3 }, { x: 0, y: -1, z: 0 }, { h: 1 });
  near(q.x, 2); near(q.z, 3);
});

test('마우스: 곡면 월드 — 찍은 점이 보이는 땅(y = h − k·(z − fz)²) 위에 있다', () => {
  const k = 0.0016, fz = 0, h = 0.4;
  for (const dz of [-0.2, -0.5, -0.9]) {
    const o = { x: 1, y: 14, z: 16 }, d = norm({ x: 0.05, y: -1, z: dz });
    const p = groundPick(o, d, { h, k, fz });
    assert.ok(p, `dz ${dz}`);
    const t = (p.z - o.z) / d.z;
    const y = o.y + d.y * t;
    near(y, h - k * (p.z - fz) ** 2, 1e-6);
    near(p.x, o.x + d.x * t, 1e-9);
  }
  // 곡면이 있으면 먼 곳은 평평할 때보다 더 멀리 찍힌다 (땅이 내려가 보이므로)
  const o = { x: 0, y: 14, z: 16 }, d = norm({ x: 0, y: -0.35, z: -1 });
  assert.ok(groundPick(o, d, { h: 0, k }).z < groundPick(o, d, { h: 0, k: 0 }).z);
});

test('마우스: 하늘을 누르면(땅을 안 만나면) 없음', () => {
  assert.equal(groundPick({ x: 0, y: 10, z: 0 }, norm({ x: 0, y: 0.3, z: -1 }), { h: 0, k: 0 }), null);
  assert.equal(groundPick({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, { h: 0, k: 0 }), null);
});

test('마우스: 가는 곳까지 — 멀면 길이 1, 가까우면 천천히, 도착하면 done, 꾹 누를 때 멀면 달리기', () => {
  const far = steer(0, 0, 0, -10, { holding: false });
  near(far.x, 0); near(far.z, -1); assert.equal(far.done, false); assert.equal(far.run, false);
  assert.equal(steer(0, 0, 0, -10, { holding: true }).run, true);
  assert.equal(steer(0, 0, 0, -3, { holding: true }).run, false);
  assert.equal(steer(0, 0, 0, -3, { shift: true }).run, true);
  const slow = steer(0, 0, 0.6, 0);
  assert.ok(Math.hypot(slow.x, slow.z) < 1 && Math.hypot(slow.x, slow.z) >= 0.35);
  assert.equal(steer(0, 0, MOUSE.arrive * 0.9, 0).done, true);
});

test('마우스: input 은 키보드·패드가 우선이고, 쓰면 마우스로 가던 것을 멈춘다', () => {
  const src = read('src/core/input.js');
  assert.match(src, /if \(x \|\| z \|\| stick\.active\) api\.pointerMove\?\.cancel\(\)/);
  assert.match(src, /api\.pointerMove\.get\(\)/);
  const mouse = read('src/player/mouse.js');
  assert.match(mouse, /e\.pointerType === 'touch'/);      // 손가락은 패드
  assert.match(mouse, /blocked\(\)/);                      // 창이 열려 있으면 안 함
  const player = read('src/player/index.js');
  assert.match(player, /ctx\.input\.pointerMove = P\.mouse/);
});

test('하늘: 사양 넷마다 하늘 셰이더 선택지가 있고, 돔은 불투명 물체 뒤 빈 화소에만 그린다', () => {
  const dome = read('src/sky/dome.js');
  for (const q of ['high', 'mid', 'low', 'min']) assert.ok(dome.includes(`  ${q}: { oct: `), q);
  assert.match(dome, /dome\.renderOrder = 1000/);
  assert.match(dome, /gl_Position\.z \*= 0\.99999/);
  assert.match(dome, /cloudDensity\(d, n, uv\)/);          // 별은 구름 뒤에서 가려진다
  const sky = read('src/sky/index.js');
  assert.match(sky, /events\.on\('quality:changed', \(\{ quality \}\) => tier\(quality\)\)/);
  assert.match(sky, /const tier = q => \{ dome\.setQuality\(q\); applyPuffs\(\); \}/);
  assert.match(sky, /cover: wx\.cover/);
});
