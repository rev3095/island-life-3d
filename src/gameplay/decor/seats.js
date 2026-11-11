// 10차 M10-P1 앉기 (AN-11 쓰기): 가구마다 앉는 자리 표 + 자리 계산 (DOM·three 없음 → tests/decor.test.mjs).
// 자리 좌표는 가구 모델 기준(three 좌표, 모델 가운데 = 발자국 가운데, 정면 +Z). 값은 assets/blender/build_furniture.py 의 빌더에서 읽었다:
//   야외 벤치 b_outdoor_bench 앉는 판 윗면 0.43 + 0.025 · 피크닉 탁자 b_picnic_table 긴 의자 0.44 + 0.025 (가운데에서 ±0.665)
//   통나무 의자 b_log_chair sh 0.42 · 소파 b_sofa 방석 0.45 + 0.07 · 과일 의자 b_fruit_chair zc 0.5 · 연잎 의자 b_lotus_chair 0.47
// face = 앉은 사람이 바라보는 쪽 (모델 기준 단위 벡터 [x, z]), step = 앉기 전·일어난 뒤 서는 곳까지 (face 쪽으로, 음수 = 뒤쪽)

export const SEATS = {
  'outdoor-bench': { y: 0.455, step: 0.62, seats: [{ x: -0.42, z: 0.02, face: [0, 1] }, { x: 0.42, z: 0.02, face: [0, 1] }] },
  // B-17: 섬에 처음부터 있는 광장 벤치 (배경 EN bench, build_env.py b_bench — 판 윗면 0.42 + 0.025, 등받이는 뒤 −Z)
  bench: { y: 0.445, step: 0.62, seats: [{ x: -0.38, z: 0.02, face: [0, 1] }, { x: 0.38, z: 0.02, face: [0, 1] }] },
  // 피크닉 탁자: 양쪽 긴 의자에 둘씩, 탁자를 보고 앉는다 → 바깥(뒤쪽)에서 다가와 앉는다
  'picnic-table': { y: 0.465, step: -0.58, seats: [
    { x: -0.4, z: -0.665, face: [0, 1] }, { x: 0.4, z: -0.665, face: [0, 1] },
    { x: -0.4, z: 0.665, face: [0, -1] }, { x: 0.4, z: 0.665, face: [0, -1] },
  ] },
  'log-chair': { y: 0.42, step: 0.55, seats: [{ x: 0, z: 0.03, face: [0, 1] }] },
  sofa: { y: 0.52, step: 0.62, seats: [{ x: -0.4, z: 0.08, face: [0, 1] }, { x: 0.4, z: 0.08, face: [0, 1] }] },
  'fruit-chair': { y: 0.5, step: 0.6, seats: [{ x: 0, z: 0.16, face: [0, 1] }] },
  'lotus-chair': { y: 0.47, step: 0.62, seats: [{ x: 0, z: 0, face: [0, 1] }] },
};

/** 가구 slug ('furn.' · 'fu:' 머리는 떼고) → 앉는 자리 표 | null */
export function seatSpec(slugOrKind) {
  const s = String(slugOrKind ?? '').replace(/^furn\./, '').replace(/^fu:/, '');
  return SEATS[s] ?? null;
}

/** 캐릭터 엉덩이 닿는 곳 (모델 메타 sit: {hip, forward} 가 없으면 키의 0.28 · 앞 0) */
export const SIT_FALLBACK = { hip: 0.28, forward: 0 };
export function sitMetaOf(meta, height = 1) {
  const m = meta && typeof meta === 'object' ? meta : null;
  const hip = Number.isFinite(m?.hip) ? m.hip : SIT_FALLBACK.hip * height;
  const forward = Number.isFinite(m?.forward) ? m.forward : SIT_FALLBACK.forward;
  return { hip, forward };
}

// facing 은 player.facing 과 같은 뜻 (0 = 북쪽 -Z, atan2(-dx, -dz))
export const facingOf = (dx, dz) => Math.atan2(-dx, -dz);

/**
 * 놓인 가구 하나의 앉는 자리들 (월드 좌표). obj = { x, z, y (바닥 높이), rot (rotation.y) }, key = 자리 이름 머리
 * → [{ key, x, z, y (앉는 면 높이), facing, stand: {x, z} }]
 */
export function seatsOf(spec, obj, key = 'seat') {
  if (!spec) return [];
  const rot = obj.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
  // three rotation.y: (x, z) → (x·cos + z·sin, −x·sin + z·cos)
  const turn = (x, z) => [x * c + z * s, -x * s + z * c];
  return spec.seats.map((st, i) => {
    const [ox, oz] = turn(st.x, st.z), [fx, fz] = turn(st.face[0], st.face[1]);
    const x = obj.x + ox, z = obj.z + oz;
    return { key: `${key}#${i}`, x, z, y: (obj.y ?? 0) + spec.y, facing: facingOf(fx, fz), dir: [fx, fz], stand: { x: x + fx * spec.step, z: z + fz * spec.step } };
  });
}

/**
 * 앉았을 때 캐릭터 뿌리(발 자리) — 엉덩이 닿는 곳(sit.hip 높이 · sit.forward 앞)이 앉는 면 위에 오게.
 * seat = seatsOf 의 하나, sit = sitMetaOf 결과 → { x, z, y, facing }
 */
export function sitRoot(seat, sit) {
  const [fx, fz] = seat.dir ?? [-Math.sin(seat.facing), -Math.cos(seat.facing)];
  return { x: seat.x - fx * sit.forward, z: seat.z - fz * sit.forward, y: seat.y - sit.hip, facing: seat.facing };
}

/** 점 (px, pz) 에서 가장 가까운 빈 자리 (reach 안, 바라보는 쪽 앞이면 더 좋게). taken(key) → 누가 앉아 있으면 true */
export function nearestSeat(list, px, pz, { reach = 1.3, taken = () => false, facing = null } = {}) {
  let best = null, bestD = Infinity;
  for (const s of list) {
    if (taken(s.key)) continue;
    const d = Math.hypot(s.x - px, s.z - pz);
    if (d > reach) continue;
    let score = d;
    if (facing != null) {   // 바라보는 쪽에 있는 자리를 먼저 (뒤쪽 자리는 덜)
      const ax = -Math.sin(facing), az = -Math.cos(facing);
      const dot = ((s.x - px) * ax + (s.z - pz) * az) / (d || 1);
      score = d * (1.5 - 0.5 * dot);
    }
    if (score < bestD) { bestD = score; best = s; }
  }
  return best;
}
