// 동물의 숲처럼 남쪽 위에서 비스듬히 내려다보는 고정 각도 카메라.
// 플레이어를 부드럽게 따라가고(감쇠), 걷는 방향으로 살짝 앞을 비춘다. 휠·두 손가락으로 가까이/멀리.

// 섬 밖(바깥): 조금 낮게 보고 곡면을 세게 → 휘어 넘어가는 지평선 위로 하늘 띠가 남는다 (기본 확대 0.15 에서 화면 위 5~8%, 가까이 10%).
// 곡면이 셀수록 지평선이 가까워지고, 각도가 낮을수록 화면 위 끝이 수평에 가까워진다. 둘을 같이 맞춘 값.
export const PRESETS = {
  near: { dist: 11, pitch: 22, curve: 0.0064 },      // 가까이: 낮게 보고 곡면을 세게 → 화면 위쪽에 휘어진 지평선과 하늘
  far: { dist: 21, pitch: 40, curve: 0.0030 },       // 멀리: 섬을 넓게 (하늘은 거의 안 보인다)
};
// 집 안(setBounds 가 걸렸을 때)은 예전 각도 그대로 — W3 가 이 각도로 방이 다 보이는 카메라 범위를 맞췄다
const INDOOR = {
  near: { dist: 11, pitch: 27, curve: 0.0036 },
  far: { dist: 21, pitch: 45, curve: 0.0018 },
};
const LOOK_AHEAD = 0.34;      // 속도(칸/초) × 초
const FOLLOW = 4.5;           // 따라가기 빠르기 (클수록 딱 붙는다)

export function createCameraRig(ctx) {
  const { THREE, camera, renderer, materials } = ctx;
  const focus = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let zoom = 0.15, zoomTarget = 0.15;          // 0 = 가까이, 1 = 멀리
  let bounds = null, curveScale = 1;           // 집 안처럼 좁은 곳: 카메라 중심을 네모 안으로, 곡면 월드 세기 배율
  const lerp = THREE.MathUtils.lerp;

  const el = renderer.domElement;
  const onWheel = e => {
    e.preventDefault();
    zoomTarget = THREE.MathUtils.clamp(zoomTarget + Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0035, 0, 1);
  };
  el.addEventListener('wheel', onWheel, { passive: false });
  // 두 손가락 벌리기/모으기
  const pts = new Map();
  let pinch0 = 0, zoom0 = 0;
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  el.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { pinch0 = spread(); zoom0 = zoomTarget; } });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch0 > 0) zoomTarget = THREE.MathUtils.clamp(zoom0 - (spread() - pinch0) / 300, 0, 1);
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomTarget = Math.min(1, zoomTarget + 0.25);
    if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomTarget = Math.max(0, zoomTarget - 0.25);
  });

  function place() {
    const P = bounds ? INDOOR : PRESETS;
    const pitch = THREE.MathUtils.degToRad(lerp(P.near.pitch, P.far.pitch, zoom));
    const dist = lerp(P.near.dist, P.far.dist, zoom);
    const fx = bounds ? THREE.MathUtils.clamp(focus.x, bounds.x0, bounds.x1) : focus.x;
    const fz = bounds ? THREE.MathUtils.clamp(focus.z, bounds.z0, bounds.z1) : focus.z;
    tmp.set(fx, focus.y + 0.55, fz);
    camera.position.set(tmp.x, tmp.y + Math.sin(pitch) * dist, tmp.z + Math.cos(pitch) * dist);
    camera.lookAt(tmp);
    materials.curve.uCurve.value = lerp(P.near.curve, P.far.curve, zoom) * curveScale;
    ctx.focus.set(fx, focus.y, fz);
  }

  return {
    get zoom() { return zoomTarget; },
    setZoom(v) { zoomTarget = THREE.MathUtils.clamp(v, 0, 1); },
    /** 카메라 중심(focus)이 머무는 네모 { x0, x1, z0, z1 } (월드 좌표). null 이면 풀린다. 집 안처럼 좁은 곳에서 벽 너머가 덜 보이게 */
    setBounds(b) { bounds = b ? { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 } : null; },
    /** 곡면 월드 세기 배율 (1 = 보통, 집 안은 낮게) */
    setCurveScale(k = 1) { curveScale = Number.isFinite(k) ? Math.max(0, k) : 1; },
    get bounds() { return bounds; },
    /** 순간이동할 때 (처음 섰을 때·집에서 나올 때) */
    snap(target) { focus.copy(target); ahead.set(0, 0, 0); zoom = zoomTarget; place(); },
    update(dt, target, vx, vz) {
      const k = 1 - Math.exp(-dt * 3);
      ahead.x += (vx * LOOK_AHEAD - ahead.x) * k;
      ahead.z += (vz * LOOK_AHEAD * 0.7 - ahead.z) * k;
      const f = 1 - Math.exp(-dt * FOLLOW);
      focus.x += (target.x + ahead.x - focus.x) * f;
      focus.z += (target.z + ahead.z - focus.z) * f;
      focus.y += (target.y - focus.y) * (1 - Math.exp(-dt * 6));
      zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 6));
      place();
    },
    dispose() { el.removeEventListener('wheel', onWheel); },
  };
}
