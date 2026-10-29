// 5차 Z5 축제 광장 (검수 보드 z5 D19-A): 섬을 만든 뒤 지금 광장을 동쪽 강가까지 넓혀 지름 12칸 원형 광장을 깐다.
// three·DOM 없음 (node 로 확인). generateIsland 결과(gen)를 고친다 — 섬 만들기 순서·난수는 건드리지 않아서 다른 물체 id 는 그대로다.
// 놓는 것: 무대 BD-06 · 아치 BD-07 ×2 · 바닥 무늬 TI-08 · 부스 자리 5 (열린 것은 FB-01–05, 아닌 것은 덮개 PR-16) · 등불 기둥 PR-14 ×8 ·
//          깃발 줄 PR-13 ×8 · 진행판 PR-15 · 모닥불. 자리는 gen.places.festival (story·gameplay 가 쓴다).
import { KIND } from './island.js';

// 자리 숫자(가운데를 옮길 칸·반지름·부스 각도·등불·아치·진행판)는 assets/festival/config.json 의 plaza 칸 (D19), 부스 목록은 booths 칸 (D21).
// 6차 M6-P5 가 섬 배치를 assets/island/layout.json 으로 옮기면 plaza 칸을 그쪽으로 옮긴다. 아래는 모델 크기에서 온 값.
export const BOOTH_SIZE = [2.96, 1.93];            // 부스 모델 크기 (가로, 깊이)
export const STAGE_SIZE = [5.72, 3.48];             // 무대 모델 크기
const LANTERN_R_OUT = 0.3;                          // 등불 기둥은 원 가장자리보다 이만큼 바깥
const GARLAND_LEN = 4.6;                            // 깃발 줄 모델 길이 (PR-13 params.length)
const GARLAND_Y = 2.42;                             // 등불 기둥 꼭대기 갈고리 높이

/** 설정 → 광장 자리 값 (빠진 칸은 반영 v1 값) */
export function layoutOf(cfg = {}) {
  const P = cfg.plaza ?? {};
  const list = cfg.booths?.list ?? [];
  const partOf = id => cfg.parts?.list?.find(p => p.booth === id)?.id ?? null;
  return {
    mode: P.mode ?? 'widen', shiftX: P.shiftX ?? 3, radius: P.radius ?? 6, stage: { r: 5.0, dx: 0.9, ...(P.stage ?? {}) },
    boothR: P.boothR ?? 5.15, boothScale: P.boothScale ?? 0.78,
    booths: list.map(b => ({ id: b.id, slug: b.slug, part: partOf(b.id), angle: P.boothAngles?.[b.id] ?? 0 })),
    lanterns: P.lanterns ?? [], arches: P.arches ?? [270, 72], boardAngle: P.boardAngle ?? 284,
  };
}

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

/** 축제 광장 자리 계산 (gen 을 고치지 않는다). cfg = assets/festival/config.json */
export function festivalLayout(gen, cfg) {
  const { w, h } = gen;
  const Lo = layoutOf(cfg), R = Lo.radius;
  const p = gen.places.plaza;
  const tile = { tx: Math.floor(p.x + w / 2) + Lo.shiftX, tz: Math.floor(p.z + h / 2) };
  const center = { x: tile.tx + 0.5 - w / 2, z: tile.tz + 0.5 - h / 2 };
  const stage = { slug: 'festival-stage', x: center.x + Lo.stage.dx, z: center.z - Lo.stage.r, rot: 0 };
  const booths = Lo.booths.map(b => ({ ...b, ...around(center, b.angle, Lo.boothR), rot: faceCenter(b.angle), scale: Lo.boothScale }));
  const lanterns = Lo.lanterns.map(a => ({ angle: a, ...around(center, a, R + LANTERN_R_OUT), rot: faceCenter(a) }));
  // 깃발 줄: 이웃한 등불 기둥 사이 (무대를 건너는 마지막→첫 기둥은 빼고). 길이는 크기로 맞춘다
  const garlands = lanterns.slice(0, -1).map((L, i) => {
    const M = lanterns[i + 1];
    const len = Math.hypot(M.x - L.x, M.z - L.z);
    return { x: (L.x + M.x) / 2, z: (L.z + M.z) / 2, rot: -Math.atan2(M.z - L.z, M.x - L.x), y: GARLAND_Y, scale: len / GARLAND_LEN };
  });
  const arches = Lo.arches.map(a => ({ angle: a, ...around(center, a, R + 0.2), rot: faceCenter(a) }));
  const board = { slug: 'festival-board', angle: Lo.boardAngle, ...around(center, Lo.boardAngle, R + 1.0), rot: faceCenter(Lo.boardAngle) };
  return { tile, center, radius: R, boothR: Lo.boothR, boothScale: Lo.boothScale, stage, booths, lanterns, garlands, arches, board };
}

/**
 * gen 에 축제 광장을 깐다. opened = 열린 부스 id 집합 (state.festival.booths 의 열쇠).
 * specs = 배경 스펙 (무대 pad 높이), config = assets/festival/config.json. 돌려주는 값 = gen.places.festival.
 */
export function carveFestival(gen, { opened = new Set(), specs = {}, config = {} } = {}) {
  const { w, h, kind: K, level: L } = gen;
  const idx = (tx, tz) => tz * w + tx;
  const F = festivalLayout(gen, config);
  const { center: C, tile: T } = F;
  const R = F.radius;
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
  for (const b of F.booths) put(opened.has(b.id) ? b.slug : 'festival-cover', b, b.id, { booth: b.id });
  for (const [i, l] of F.lanterns.entries()) put('festival-lantern', l, `PR-14-${i + 1}`);
  for (const [i, g] of F.garlands.entries()) put('festival-garland', g, `PR-13-${i + 1}`);
  for (const [i, a] of F.arches.entries()) put('festival-arch', a, `BD-07-${i + 1}`);
  put('festival-board', F.board, 'PR-15');
  // 4. 무대 위는 걸을 수 있는 높은 바닥 (둘레 두 단 계단). 뒤 판·기둥은 충돌체 (스펙 world.collider)
  const pad = specs['festival-stage']?.world?.pad ?? { steps: [0.36, 0.24, 0.12], stepW: 0.18 };
  const [sw, sd] = STAGE_SIZE;
  gen.pads.push({ x0: F.stage.x - sw / 2, x1: F.stage.x + sw / 2, z0: F.stage.z - 1.5, z1: F.stage.z + 1.86, y: 0, steps: pad.steps, stepW: pad.stepW, festival: true });
  gen.places.festival = {
    x: C.x, z: C.z, center: C, radius: R, tile: T,
    stage: { x: F.stage.x, z: F.stage.z, front: { x: F.stage.x, z: F.stage.z + sd / 2 - 0.3 }, y: pad.steps[0] },
    booths: F.booths.map(b => ({ id: b.id, slug: b.slug, part: b.part, x: b.x, z: b.z, rot: b.rot, angle: b.angle, scale: b.scale, front: around(C, b.angle, F.boothR - 1.35) })),
    board: { x: F.board.x, z: F.board.z, rot: F.board.rot, front: around(C, F.board.angle, R - 0.1) },
    arches: F.arches.map(a => ({ x: a.x, z: a.z })),
    lanterns: F.lanterns.map(l => ({ x: l.x, z: l.z })),
  };
  return gen.places.festival;
}
