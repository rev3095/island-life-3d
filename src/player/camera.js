// 동물의 숲처럼 남쪽 위에서 비스듬히 내려다보는 고정 각도 카메라.
// 플레이어를 부드럽게 따라가고(감쇠), 걷는 방향으로 살짝 앞을 비춘다. 휠·두 손가락 벌리기로 가까이/멀리.
// 세로 화면(휴대폰)은 좌우가 좁아서 시야각·거리를 늘린다 (7차 D38, portraitView). 흔들림 줄이기(ui.access.calm)면 앞보기를 줄인다.
// 시점 조작 (P12): 오른쪽·가운데 버튼 끌기 / R·V·PageUp·PageDown (input.js look) / 두 손가락 함께 끌기로
//   위아래 = 올려다보기·내려다보기 (lookView), 좌우 = 둘레 돌기. 놓으면(LOOK.back) 부드럽게 원래 시점으로. Home = 바로 되돌리기.
//   집 안·장면(컷신)·창이 열린 동안은 조작하지 않고 원래 시점으로 돌아간다. 둘레를 돌면 input.viewYaw 로 키보드·패드 방향도 같이 돈다.

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
const CALM_AHEAD = 0.12;      // 흔들림 줄이기: 방향을 바꿀 때 화면이 덜 쏠린다
const FOLLOW = 4.5;           // 따라가기 빠르기 (클수록 딱 붙는다)
export const BASE_FOV = 32;   // main.js 의 PerspectiveCamera 세로 시야각
/** 세로 화면 맞춤: 가로/세로 비율이 1 아래로 내려갈수록(0.47 아래 = 375×812·390×844 휴대폰에서 끝까지) 시야각·거리를 늘리고 조금 더 내려다본다 */
export const PORTRAIT = { full: 0.47, fov: 14, dist: 0.1, pitch: 4 };   // 거리는 조금만 — 멀어질수록 카메라 앞 지붕(QA-03)이 화면 아래를 더 가린다

/** 화면 비율 → { fov, distK, pitch(더할 도) }. 가로 화면은 그대로 */
export function portraitView(aspect) {
  const p = Number.isFinite(aspect) ? Math.min(1, Math.max(0, (1 - aspect) / (1 - PORTRAIT.full))) : 0;
  return { p, fov: BASE_FOV + PORTRAIT.fov * p, distK: 1 + PORTRAIT.dist * p, pitch: PORTRAIT.pitch * p };
}

/**
 * 시점 조작 값 (조절할 때 여기만). tilt = −1 끝까지 내려다보기 · 0 원래 · 1 끝까지 올려다보기, yaw = 둘레 돌기 (라디안).
 * 끝까지 올려다보면: 카메라가 땅 가까이(upElev) 내려와 가까이 오고(upDist) 지평선 위로 upAim 도를 본다 + 시야각 upFov →
 * 지평선이 화면 아래 1/4 쯤, 하늘이 3/4 (플레이어는 화면 아래쪽에 남는다). 곡면도 upCurve 로 약하게 (땅이 덜 휘어 보이게).
 */
// 시점 값은 M7-P9 (2026-11-05) 에 모두 지금 값으로 확정 — 선택지·확정 표는 docs/notes/p12-camera.md 「확정」
export const LOOK = {
  upElev: 4,          // 끝까지 올려다볼 때 카메라 높이각 (도, 초점에서 본)
  upAim: 12,          // 그때 보는 방향: 지평선 위로 (도)
  upFov: 16,          // 시야각을 이만큼 넓힌다 (도). 흔들림 줄이기면 calmFov
  calmFov: 0,
  upDist: 9,          // 그때 거리 (칸, 확대와 상관없이 같은 모습)
  upCurve: 0.0030,    // 그때 곡면 세기 (기본 가까이 0.0064 — 낮게 보면 땅이 너무 빨리 넘어간다)
  downElev: 62,       // 끝까지 내려다볼 때 높이각 (도)
  downDist: 1.08,     // 그때 거리 배율
  yawMax: 60,         // 둘레 돌기 한계 (도, 좌우 각각). 곡면이 남북(z)으로만 휘어서 옆으로 돌수록 곡면을 줄인다 (sideCurve)
  sideCurve: 0.25,    // 옆으로 90° 돌았을 때 곡면 배율 (그 사이는 sin² 로 섞는다)
  dragY: 0.0055,      // 끌기: 화소당 tilt (위로 끌면 올려다보기)
  dragX: 0.0050,      // 끌기: 화소당 yaw (라디안, 오른쪽으로 끌면 오른쪽을 본다)
  touchY: 0.0075,     // 두 손가락: 화소당 tilt
  touchX: 0.0060,
  keyRate: 1.6,       // R·V 를 누르고 있으면 초당 tilt
  back: 'release',    // 돌아오기: 'release' 놓으면 · 'walk' 놓아도 그대로, 걸으면 · 'stay' 그대로 (Home 으로 되돌리기)
  backSpeed: 3,       // 돌아오는 빠르기 (1/초, 클수록 빨리. 3 ≈ 1초면 거의 다)
  calmBack: 1.6,      // 흔들림 줄이기: 더 천천히
  walkFrom: 0.6,      // 'walk': 이보다 빨리 움직이면 걷는 것으로 (칸/초)
  follow: 14,         // 조작 값 따라가기 (끌기를 부드럽게, 1/초)
  calmFollow: 7,
  clear: 0.35,        // 카메라와 땅 사이 여유 (칸) — 초점에서 카메라까지 땅 위로 지나가게
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;

/**
 * 시점 각 계산. base = { pitch(도), dist, curve, fov } (지금 확대·세로 화면 맞춤까지 들어간 원래 값), tilt −1~1, yaw(라디안) →
 * { elev: 초점에서 본 카메라 높이각(도), aim: 보는 방향이 수평 아래로 몇 도(음수 = 위를 본다), dist, curve, fov, yaw }.
 * tilt 0 이면 원래 값 그대로 (elev = aim = pitch → 초점을 본다)
 */
export function lookView(base, tilt = 0, yaw = 0, { calm = false } = {}) {
  const t = clamp(Number.isFinite(tilt) ? tilt : 0, -1, 1);
  const L = LOOK;
  const yw = clamp(Number.isFinite(yaw) ? yaw : 0, -L.yawMax * Math.PI / 180, L.yawMax * Math.PI / 180);
  const side = mix(1, L.sideCurve, Math.sin(yw) ** 2);
  if (t >= 0) {
    const u = t * t * (3 - 2 * t);       // 끝에서 부드럽게 멈춘다
    return {
      elev: mix(base.pitch, L.upElev, u),
      aim: mix(base.pitch, -L.upAim, u),
      dist: mix(base.dist, Math.min(base.dist, L.upDist), u),
      curve: mix(base.curve, Math.min(base.curve, L.upCurve), u) * side,
      fov: base.fov + (calm ? L.calmFov : L.upFov) * u,
      yaw: yw,
    };
  }
  const s = -t, u = s * s * (3 - 2 * s);
  const elev = mix(base.pitch, Math.max(base.pitch, L.downElev), u);
  return { elev, aim: elev, dist: base.dist * mix(1, L.downDist, u), curve: base.curve * side, fov: base.fov, yaw: yw };
}

/**
 * 카메라가 땅에 묻히지 않을 높이: 초점(pivot)에서 카메라(cam)까지 steps 점을 보고, 그 선이 보이는 땅
 * (땅 높이 − 곡면으로 내려간 k·(z − fz)²) + margin 아래로 지나지 않게 카메라 y 를 올린다 → 올린 y (그대로면 cam.y)
 */
export function clearY(pivot, cam, ground, { k = 0, fz = 0, margin = LOOK.clear, steps = 6 } = {}) {
  let y = cam.y;
  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    const x = pivot.x + (cam.x - pivot.x) * s, z = pivot.z + (cam.z - pivot.z) * s;
    const g = ground(x, z);
    if (!Number.isFinite(g)) continue;
    const need = pivot.y + (g - k * (z - fz) ** 2 + margin - pivot.y) / s;   // 선 높이 pivot.y + s·(y − pivot.y) ≥ 땅 + 여유
    if (need > y) y = need;
  }
  return y;
}

/** 지금 tilt·yaw 를 돌아오게 할지: 끌거나 키를 누르는 중이면 아니고, back 모드와 걷는지에 따라 */
export function shouldReturn(mode, { active = false, moving = false, allowed = true } = {}) {
  if (!allowed) return true;
  if (active) return false;
  return mode === 'release' || (mode === 'walk' && moving);
}

export function createCameraRig(ctx) {
  const { THREE, camera, renderer, materials } = ctx;
  const focus = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const aimAt = new THREE.Vector3();
  let zoom = 0.15, zoomTarget = 0.15;          // 0 = 가까이, 1 = 멀리
  let bounds = null, curveScale = 1;           // 집 안처럼 좁은 곳: 카메라 중심을 네모 안으로, 곡면 월드 세기 배율
  const look = { tilt: 0, yaw: 0, tiltGoal: 0, yawGoal: 0, lift: 0 };   // 시점 조작: 목표(Goal)를 따라간다, lift = 땅 위로 올린 높이
  const lerp = THREE.MathUtils.lerp;
  const deg = THREE.MathUtils.degToRad;
  const yawLim = deg(LOOK.yawMax);
  const setLook = (t, y) => { look.tiltGoal = clamp(t, -1, 1); look.yawGoal = clamp(y, -yawLim, yawLim); };

  // 시점 조작을 받아도 되나: 집 안·장면·창이 열린 동안은 아니다
  const canLook = () => !bounds && ctx.input?.enabled !== false && !ctx.services.ui?.isBlocking?.() && !ctx.services.story?.playing;

  const el = renderer.domElement;
  const onWheel = e => {
    e.preventDefault();
    zoomTarget = THREE.MathUtils.clamp(zoomTarget + Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0035, 0, 1);
  };
  el.addEventListener('wheel', onWheel, { passive: false });

  // 마우스 오른쪽·가운데 버튼 끌기 (왼쪽은 마우스로 걷기 — mouse.js)
  const drag = { id: null, x: 0, y: 0 };
  const endDrag = () => { if (drag.id != null) { try { el.releasePointerCapture(drag.id); } catch { /* 이미 놓음 */ } } drag.id = null; };
  el.addEventListener('contextmenu', e => e.preventDefault());                    // 캔버스에서만 오른쪽 메뉴를 막는다
  el.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });   // 가운데 버튼 자동 스크롤 막기

  // 두 손가락: 벌리기/모으기 = 가까이/멀리, 함께 끌기 = 올려다보기·둘레 돌기 (처음 움직임으로 하나를 고른다)
  const pts = new Map();
  let pinch0 = 0, zoom0 = 0, mid0 = null, look0 = null, gesture = null;
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const middle = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { pinch0 = spread(); zoom0 = zoomTarget; mid0 = middle(); look0 = { t: look.tiltGoal, y: look.yawGoal }; gesture = null; }
      return;
    }
    if ((e.button !== 2 && e.button !== 1) || drag.id != null || !canLook()) return;
    e.preventDefault();
    drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch { /* 이미 놓음 */ }
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId === drag.id) {
      if (!(e.buttons & 6)) { endDrag(); return; }      // 버튼을 놓았는데 pointerup 이 안 온 경우 (창 밖에서 놓기)
      if (!canLook()) { endDrag(); return; }
      setLook(look.tiltGoal - (e.clientY - drag.y) * LOOK.dragY, look.yawGoal - (e.clientX - drag.x) * LOOK.dragX);
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size !== 2 || !(pinch0 > 0)) return;
    let ds = spread() - pinch0, m = middle(), dx = m.x - mid0.x, dy = m.y - mid0.y;
    if (!gesture) {
      if (Math.abs(ds) > 28) gesture = 'zoom';
      else if (Math.hypot(dx, dy) > 22) gesture = canLook() ? 'look' : 'zoom';
      else return;
      // 고른 순간을 기준으로 다시 잡는다 (문턱만큼 튀지 않게)
      pinch0 = spread(); mid0 = m; zoom0 = zoomTarget; look0 = { t: look.tiltGoal, y: look.yawGoal };
      ds = dx = dy = 0;
    }
    if (gesture === 'zoom') zoomTarget = THREE.MathUtils.clamp(zoom0 - ds / 300, 0, 1);
    else if (gesture === 'look' && canLook()) setLook(look0.t - dy * LOOK.touchY, look0.y - dx * LOOK.touchX);
  });
  const end = e => {
    if (e.pointerId === drag.id) endDrag();
    pts.delete(e.pointerId);
    if (pts.size < 2) { pinch0 = 0; gesture = null; }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  addEventListener('blur', () => { endDrag(); pts.clear(); pinch0 = 0; gesture = null; });
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomTarget = Math.min(1, zoomTarget + 0.25);
    if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomTarget = Math.max(0, zoomTarget - 0.25);
    if (e.code === 'Home' && canLook()) { e.preventDefault(); setLook(0, 0); }
  });
  // 장면(컷신)이 시작되면 바로 원래 시점 (장면이 카메라를 맡는다 — 시야각만은 여기서 돌려 둔다)
  ctx.events?.on?.('story:start', () => resetLook());
  function resetLook() { endDrag(); gesture = null; look.tilt = look.yaw = look.tiltGoal = look.yawGoal = look.lift = 0; }

  let lastFov = camera.fov;
  function place(dt = 0) {
    const P = bounds ? INDOOR : PRESETS;
    const tall = portraitView(camera.aspect);
    const base = {
      pitch: lerp(P.near.pitch, P.far.pitch, zoom) + tall.pitch,
      dist: lerp(P.near.dist, P.far.dist, zoom) * tall.distK,
      curve: lerp(P.near.curve, P.far.curve, zoom),
      fov: tall.fov,
    };
    const v = lookView(base, look.tilt, look.yaw, { calm: !!ctx.services.ui?.access?.calm });
    if (Math.abs(v.fov - lastFov) > 0.01) { camera.fov = lastFov = v.fov; camera.updateProjectionMatrix(); }
    const elev = deg(v.elev), sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    const fx = bounds ? THREE.MathUtils.clamp(focus.x, bounds.x0, bounds.x1) : focus.x;
    const fz = bounds ? THREE.MathUtils.clamp(focus.z, bounds.z0, bounds.z1) : focus.z;
    const curveK = v.curve * curveScale;
    tmp.set(fx, focus.y + 0.55, fz);
    const hd = Math.cos(elev) * v.dist;
    camera.position.set(tmp.x + sy * hd, tmp.y + Math.sin(elev) * v.dist, tmp.z + cy * hd);
    // 땅 위로: 카메라를 낮게 내리면 뒤쪽 언덕·높은 땅에 묻히지 않게 올린다 (올릴 땐 바로, 내릴 땐 천천히).
    // 여유는 올려다볼수록 늘린다 (원래 시점은 여유 0 — 선이 땅을 뚫을 때만 올라가서 예전과 같다)
    let aim = deg(v.aim);
    const island = !bounds && ctx.services.world?.island;
    if (island) {
      const margin = LOOK.clear * clamp(look.tilt * 3, 0, 1);
      const need = clearY(tmp, camera.position, (x, z) => island.heightAt(x, z), { k: curveK, fz, margin }) - camera.position.y;
      look.lift = need > look.lift || !dt ? need : look.lift + (need - look.lift) * (1 - Math.exp(-dt * 4));
      if (look.lift > 1e-3) {
        camera.position.y += look.lift;
        aim += Math.atan2(camera.position.y - tmp.y, hd) - elev;     // 올린 만큼 같이 내려다봐서 플레이어가 화면 같은 자리에 남는다
      }
    } else look.lift = 0;
    // 보는 방향: 둘레(yaw) 쪽에서 수평 아래로 aim
    const ca = Math.cos(aim);
    aimAt.set(camera.position.x - sy * ca, camera.position.y - Math.sin(aim), camera.position.z - cy * ca);
    camera.lookAt(aimAt);
    materials.curve.uCurve.value = curveK;
    ctx.focus.set(fx, focus.y, fz);
    if (ctx.input) ctx.input.viewYaw = v.yaw;                             // 키보드·패드 방향도 같이 돈다 (input.js)
  }

  /** 시점 조작 한 프레임: 키(input.look) → 목표, 돌아오기, 목표 따라가기 */
  function updateLook(dt, vx, vz) {
    const allowed = canLook();
    if (!allowed) { endDrag(); gesture = gesture === 'look' ? null : gesture; }
    const key = allowed ? ctx.input?.look?.y ?? 0 : 0;
    if (key) setLook(look.tiltGoal + key * LOOK.keyRate * dt, look.yawGoal);
    const active = drag.id != null || gesture === 'look' || !!key;
    const calm = !!ctx.services.ui?.access?.calm;
    if (shouldReturn(LOOK.back, { active, moving: Math.hypot(vx, vz) > LOOK.walkFrom, allowed })) {
      const k = Math.exp(-dt * (calm ? LOOK.calmBack : LOOK.backSpeed));
      look.tiltGoal = Math.abs(look.tiltGoal) < 1e-3 ? 0 : look.tiltGoal * k;
      look.yawGoal = Math.abs(look.yawGoal) < 1e-4 ? 0 : look.yawGoal * k;
    }
    const f = 1 - Math.exp(-dt * (calm ? LOOK.calmFollow : LOOK.follow));
    look.tilt += (look.tiltGoal - look.tilt) * f;
    look.yaw += (look.yawGoal - look.yaw) * f;
    if (Math.abs(look.tilt) < 1e-4 && !look.tiltGoal) look.tilt = 0;
    if (Math.abs(look.yaw) < 1e-5 && !look.yawGoal) look.yaw = 0;
  }

  return {
    get zoom() { return zoomTarget; },
    setZoom(v) { zoomTarget = THREE.MathUtils.clamp(v, 0, 1); },
    /** 카메라 중심(focus)이 머무는 네모 { x0, x1, z0, z1 } (월드 좌표). null 이면 풀린다. 집 안처럼 좁은 곳에서 벽 너머가 덜 보이게 */
    setBounds(b) { bounds = b ? { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 } : null; if (bounds) resetLook(); },
    /** 곡면 월드 세기 배율 (1 = 보통, 집 안은 낮게) */
    setCurveScale(k = 1) { curveScale = Number.isFinite(k) ? Math.max(0, k) : 1; },
    get bounds() { return bounds; },
    /** 시점 조작 지금 값 { tilt, yaw, tiltGoal, yawGoal, dragging } (확인용) */
    get look() { return { tilt: look.tilt, yaw: look.yaw, tiltGoal: look.tiltGoal, yawGoal: look.yawGoal, dragging: drag.id != null || gesture === 'look' }; },
    /** 시점 조작 목표 정하기 (tilt −1~1, yaw 라디안). 막혀 있으면(집 안·장면·창) 무시 */
    setLook(tilt = 0, yaw = 0) { if (canLook()) setLook(tilt, yaw); },
    /** 순간이동할 때 (처음 섰을 때·집에서 나올 때) — 시점 조작도 원래대로 */
    snap(target) { focus.copy(target); ahead.set(0, 0, 0); zoom = zoomTarget; resetLook(); place(); },
    update(dt, target, vx, vz) {
      const k = 1 - Math.exp(-dt * 3);
      const lead = ctx.services.ui?.access?.calm ? CALM_AHEAD : LOOK_AHEAD;
      ahead.x += (vx * lead - ahead.x) * k;
      ahead.z += (vz * lead * 0.7 - ahead.z) * k;
      const f = 1 - Math.exp(-dt * FOLLOW);
      focus.x += (target.x + ahead.x - focus.x) * f;
      focus.z += (target.z + ahead.z - focus.z) * f;
      focus.y += (target.y - focus.y) * (1 - Math.exp(-dt * 6));
      zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 6));
      updateLook(dt, vx, vz);
      place(dt);
    },
    dispose() { el.removeEventListener('wheel', onWheel); },
  };
}
