// 5차 Z5 축제 광장 (검수 보드 z5 D19-A): 섬을 만든 뒤 지금 광장을 동쪽 강가까지 넓혀 지름 12칸 원형 광장을 깐다.
// three·DOM 없음 (node 로 확인). generateIsland 결과(gen)를 고친다 — 섬 만들기 순서·난수는 건드리지 않아서 다른 물체 id 는 그대로다.
// 놓는 것: 무대 BD-06 · 아치 BD-07 ×2 · 바닥 무늬 TI-08 · 부스 자리 5 (열린 것은 FB-01–05, 아닌 것은 덮개 PR-16) · 등불 기둥 PR-14 ×8 ·
//          깃발 줄 PR-13 ×8 · 진행판 PR-15 · 모닥불. 자리는 gen.places.festival (story·gameplay 가 쓴다).
import { KIND } from './island.js';

export const FESTIVAL_RADIUS = 6;
/** 광장 가운데 = 지금 광장에서 동쪽으로 몇 칸 */
export const SHIFT_X = 3;
/** 부스 다섯 (각도: 북쪽 0° 에서 시계 방향) — 무대·입구 네 갈래를 피한 자리 */
export const BOOTHS = [
  { id: 'FB-01', slug: 'festival-booth-lantern', part: 'FP-01', angle: 112 },
  { id: 'FB-02', slug: 'festival-booth-music', part: 'FP-02', angle: 304 },
  { id: 'FB-03', slug: 'festival-booth-flower', part: 'FP-03', angle: 234 },
  { id: 'FB-04', slug: 'festival-booth-food', part: 'FP-04', angle: 170 },
  { id: 'FB-05', slug: 'festival-booth-fish', part: 'FP-05', angle: 202 },
];
export const BOOTH_R = 5.15;
export const BOOTH_SIZE = [2.96, 1.93];            // 모델 크기 (가로, 깊이)
export const BOOTH_SCALE = 0.78;                   // 둘레에 다섯이 들어가게 조금 작게
export const STAGE = { r: 5.0, dx: 0.9, size: [5.72, 3.48] };   // dx: 북쪽 길을 비키려고 조금 동쪽으로
/** 등불 기둥: 부스·입구·무대 사이 빈자리 (원 바깥쪽 가장자리) */
export const LANTERNS = [52, 91, 136, 185, 217, 249, 288, 320];
const LANTERN_R = 6.3;
const GARLAND_LEN = 4.6;                            // 깃발 줄 모델 길이 (PR-13 params.length)
const GARLAND_Y = 2.42;                             // 등불 기둥 꼭대기 갈고리 높이
const BOARD_ANGLE = 284;                            // 진행판: 서쪽 입구 바로 북쪽

const { GRASS, PATH, PLAZA } = KIND;
const rad = d => (d * Math.PI) / 180;
/** 가운데에서 angle 방향 r 떨어진 곳 (북쪽 = -z) */
export const around = (c, angle, r) => ({ x: c.x + Math.sin(rad(angle)) * r, z: c.z - Math.cos(rad(angle)) * r });
/** 가운데를 보게 돌린 각 (rot 0 = 남쪽(+z)을 본다) */
export const faceCenter = angle => -rad(angle);

/** 돌린 직사각형 네 꼭짓점 (x, z) */
export function rectCorners({ x, z }, [w, d], rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => ({ x: x + a * c + b * s, z: z - a * s + b * c }));
}
/** 볼록 다각형 두 개가 겹치나 (분리축) */
export function overlaps(A, B, gap = 0) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    const nx = q.z - p.z, nz = -(q.x - p.x), L = Math.hypot(nx, nz) || 1;
    const proj = Q => Q.map(v => (v.x * nx + v.z * nz) / L);
    const a = proj(A), b = proj(B);
    if (Math.max(...a) + gap <= Math.min(...b) || Math.max(...b) + gap <= Math.min(...a)) return false;
  }
  return true;
}

/** 축제 광장 자리 계산 (gen 을 고치지 않는다) */
export function festivalLayout(gen) {
  const { w, h } = gen;
  const p = gen.places.plaza;
  const tile = { tx: Math.floor(p.x + w / 2) + SHIFT_X, tz: Math.floor(p.z + h / 2) };
  const center = { x: tile.tx + 0.5 - w / 2, z: tile.tz + 0.5 - h / 2 };
  const stage = { slug: 'festival-stage', x: center.x + STAGE.dx, z: center.z - STAGE.r, rot: 0 };
  const booths = BOOTHS.map(b => ({ ...b, ...around(center, b.angle, BOOTH_R), rot: faceCenter(b.angle) }));
  const lanterns = LANTERNS.map(a => ({ angle: a, ...around(center, a, LANTERN_R), rot: faceCenter(a) }));
  // 깃발 줄: 이웃한 등불 기둥 사이 (무대를 건너는 마지막→첫 기둥은 빼고). 길이는 크기로 맞춘다
  const garlands = lanterns.slice(0, -1).map((L, i) => {
    const M = lanterns[i + 1];
    const len = Math.hypot(M.x - L.x, M.z - L.z);
    return { x: (L.x + M.x) / 2, z: (L.z + M.z) / 2, rot: -Math.atan2(M.z - L.z, M.x - L.x), y: GARLAND_Y, scale: len / GARLAND_LEN };
  });
  const arches = [270, 72].map(a => ({ angle: a, ...around(center, a, FESTIVAL_RADIUS + 0.2), rot: faceCenter(a) }));
  const board = { slug: 'festival-board', ...around(center, BOARD_ANGLE, FESTIVAL_RADIUS + 1.0), rot: faceCenter(BOARD_ANGLE) };
  return { tile, center, radius: FESTIVAL_RADIUS, stage, booths, lanterns, garlands, arches, board };
}

/**
 * gen 에 축제 광장을 깐다. opened = 열린 부스 id 집합 (state.festival.booths 의 열쇠).
 * specs = 배경 스펙 (무대 pad 높이). 돌려주는 값 = gen.places.festival.
 */
export function carveFestival(gen, { opened = new Set(), specs = {} } = {}) {
  const { w, h, kind: K, level: L } = gen;
  const idx = (tx, tz) => tz * w + tx;
  const F = festivalLayout(gen);
  const { center: C, tile: T } = F;
  const R = FESTIVAL_RADIUS;
  // 1. 바닥: 원 안의 평지 풀·흙길·광장 칸을 광장으로
  for (let tz = T.tz - R - 1; tz <= T.tz + R + 1; tz++) for (let tx = T.tx - R - 1; tx <= T.tx + R + 1; tx++) {
    if (tx < 0 || tz < 0 || tx >= w || tz >= h) continue;
    const i = idx(tx, tz);
    const d = Math.hypot(tx + 0.5 - w / 2 - C.x, tz + 0.5 - h / 2 - C.z);
    if (d <= R + 0.05 && !L[i] && (K[i] === GRASS || K[i] === PATH || K[i] === PLAZA)) K[i] = PLAZA;
  }
  // 2. 원 안(과 둘레 반 칸)의 물체는 치운다 — 지금 광장의 모닥불·벤치·가로등·안내판, 나무·덤불·꽃
  const keep = o => Math.hypot(o.x - C.x, o.z - C.z) > R + 0.6 && Math.hypot(o.x - F.board.x, o.z - F.board.z) > 1.4;
  for (let i = gen.objects.length - 1; i >= 0; i--) if (!keep(gen.objects[i])) gen.objects.splice(i, 1);
  // 3. 놓기
  const put = (kind, at, id, extra = {}) => {
    const t = { tx: Math.floor(at.x + w / 2), tz: Math.floor(at.z + h / 2) };
    gen.objects.push({ id: `${kind}@${id}`, kind, ...t, x: at.x, z: at.z, y: at.y ?? 0, rot: at.rot ?? 0, scale: at.scale ?? 1, variant: at.variant ?? null, data: { festival: id, ...extra } });
  };
  put('festival-floor', { x: C.x, z: C.z, y: 0.05 }, 'floor');   // 광장 돌 칸(윗면 ≈ 0.06) 위로 무늬가 보이게
  put('campfire', C, 'campfire');
  put('festival-stage', F.stage, 'BD-06');
  for (const b of F.booths) put(opened.has(b.id) ? b.slug : 'festival-cover', { ...b, scale: BOOTH_SCALE }, b.id, { booth: b.id });
  for (const [i, l] of F.lanterns.entries()) put('festival-lantern', l, `PR-14-${i + 1}`);
  for (const [i, g] of F.garlands.entries()) put('festival-garland', g, `PR-13-${i + 1}`);
  for (const [i, a] of F.arches.entries()) put('festival-arch', a, `BD-07-${i + 1}`);
  put('festival-board', F.board, 'PR-15');
  // 4. 무대 위는 걸을 수 있는 높은 바닥 (둘레 두 단 계단). 뒤 판·기둥은 충돌체 (스펙 world.collider)
  const pad = specs['festival-stage']?.world?.pad ?? { steps: [0.36, 0.24, 0.12], stepW: 0.18 };
  const [sw, sd] = STAGE.size;
  gen.pads.push({ x0: F.stage.x - sw / 2, x1: F.stage.x + sw / 2, z0: F.stage.z - 1.5, z1: F.stage.z + 1.86, y: 0, steps: pad.steps, stepW: pad.stepW, festival: true });
  gen.places.festival = {
    x: C.x, z: C.z, center: C, radius: R, tile: T,
    stage: { x: F.stage.x, z: F.stage.z, front: { x: F.stage.x, z: F.stage.z + sd / 2 - 0.3 }, y: pad.steps[0] },
    booths: F.booths.map(b => ({ id: b.id, slug: b.slug, part: b.part, x: b.x, z: b.z, rot: b.rot, angle: b.angle, front: around(C, b.angle, BOOTH_R - 1.45) })),
    board: { x: F.board.x, z: F.board.z, rot: F.board.rot, front: around(C, BOARD_ANGLE, FESTIVAL_RADIUS - 0.1) },
    arches: F.arches.map(a => ({ x: a.x, z: a.z })),
    lanterns: F.lanterns.map(l => ({ x: l.x, z: l.z })),
  };
  return gen.places.festival;
}
