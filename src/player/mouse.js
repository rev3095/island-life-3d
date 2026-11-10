// 마우스로 걷기: 땅을 한 번 누르면 그 자리까지 걸어가고, 꾹 누르고 있으면 커서를 따라간다 (커서가 멀면 달리기, Shift 도 달리기).
// 키보드·패드로 움직이면 바로 그만둔다. 창이 열려 있거나(input.enabled false·ui.isBlocking) 손가락(터치 — 패드가 따로 있다)이면 하지 않는다.
// 화면 → 땅: 곡면 월드(보이는 y = y − (z − 초점 z)² · uCurve)까지 맞춰, 광선이 "보이는" 땅과 만나는 점을 푼다 (groundPick).
// input.js 가 매 프레임 pointerMove.get() 으로 이동 방향을 받는다 (키보드·패드가 없을 때만). 가는 곳엔 작은 고리 표시.
// 10차 D96-A: setClickHandler(fn) 가 걸려 있으면 (섬 꾸미기 동안) 짧게 누르기 = fn(땅 점) (걷지 않음), 꾹 누르기·끌기 = 걷기 그대로.
//   손가락도 짧게 톡 = fn (걷기는 패드라서). 두 손가락(시점)은 셈하지 않는다.
// three 는 ctx.THREE 로 받는다 (위쪽 순수 함수 groundPick·steer 를 tests/mouse.test.mjs 가 Node 에서 검사)

export const MOUSE = {
  arrive: 0.3,       // 이만큼 가까우면 도착 (칸)
  slowFrom: 1.0,     // 이보다 가까우면 천천히 (도착할 때 미끄러지지 않게)
  runAt: 5.5,        // 꾹 누를 때 커서가 이보다 멀면 달리기
  clickMs: 280,      // 이보다 짧게 누르고,
  clickPx: 10,       // 이보다 덜 움직였으면 "한 번 누름" → 놓아도 그 자리까지 걸어간다
  stuckSec: 0.7,     // 이만큼 동안 거의 못 가면 (벽·물) 그만
};

/**
 * 화면 광선 → 보이는 땅 위 점. origin·dir = 광선 (월드), h = 땅 높이(초점 높이), k = uCurve, fz = 곡면 중심 z.
 * 보이는 땅: y = h − k·(z − fz)². 광선 o + t·d 를 넣으면 t 에 대한 2차식 → 가장 가까운 양수 근. 땅을 안 만나면 null
 */
export function groundPick(origin, dir, { h = 0, k = 0, fz = 0 } = {}) {
  const oz = origin.z - fz;
  const a = k * dir.z * dir.z;
  const b = dir.y + 2 * k * dir.z * oz;
  const c = origin.y - h + k * oz * oz;
  let t;
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) < 1e-9) return null;
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc), t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
    t = t1 > 0 && t2 > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  }
  if (!(t > 0)) return null;
  return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
}

/** 지금 자리 → 가는 곳: { x, z (길이 0~1), run, done } — 가까우면 천천히, 도착하면 done */
export function steer(px, pz, tx, tz, { holding = false, shift = false } = {}) {
  const dx = tx - px, dz = tz - pz, d = Math.hypot(dx, dz);
  if (d <= MOUSE.arrive) return { x: 0, z: 0, run: false, done: true };
  const mag = Math.min(1, Math.max(0.35, d / MOUSE.slowFrom));
  return { x: (dx / d) * mag, z: (dz / d) * mag, run: shift || (holding && d > MOUSE.runAt), done: false };
}

export function createMouseMove(ctx, { position }) {
  const { THREE, renderer, camera, materials } = ctx;
  const el = renderer.domElement;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let holding = false, pointerId = null, downAt = 0, downX = 0, downY = 0, curX = 0, curY = 0, shift = false;
  let target = null;                 // { x, z } — 놓은 뒤에도 걸어가는 곳 (한 번 누름)
  let best = Infinity, stuck = 0;    // 못 가는 곳 알아채기
  let clickFn = null, pending = false; // 10차 칸 누르기: 짧은 누름을 넘겨줄 곳 · 아직 누름인지 걷기인지 모름
  const taps = new Map();            // 손가락 톡: pointerId → { x, y, t }

  // 가는 곳 표시: 땅에 얇은 고리 (곡면 월드 맞춤, 깊이는 쓰지 않아 땅에 묻히지 않는다)
  const ringMat = materials.curved(new THREE.MeshBasicMaterial({ color: 0xFFF8E6, transparent: true, opacity: 0, depthWrite: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 28).rotateX(-Math.PI / 2), ringMat);
  ring.name = 'mouse-target';
  ring.renderOrder = 5;
  ring.visible = false;
  ctx.scene.add(ring);

  const blocked = () => !ctx.input.enabled || !!ctx.services.ui?.isBlocking?.();

  function pick(sx, sy) {
    const r = el.getBoundingClientRect();
    ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = position();
    const hit = groundPick(ray.ray.origin, ray.ray.direction, { h: p.y, k: materials.curve.uCurve.value, fz: materials.curve.uCurveOrigin.value.z });
    if (!hit) return null;
    const world = ctx.services.world;
    return { x: hit.x, z: hit.z, y: world?.island?.heightAt?.(hit.x, hit.z) ?? p.y };
  }

  function stop() { holding = false; target = null; best = Infinity; stuck = 0; pending = false; }

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      if (clickFn && !blocked()) taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), multi: taps.size > 0 });
      if (taps.size > 1) for (const t of taps.values()) t.multi = true;   // 두 손가락 = 시점 (camera.js)
      return;
    }
    if (e.button !== 0 || blocked()) return;
    holding = true; pointerId = e.pointerId; shift = e.shiftKey;
    downAt = performance.now(); downX = curX = e.clientX; downY = curY = e.clientY;
    pending = !!clickFn;               // 칸 누르기 중: 꾹 누르거나 끌 때까지 걷지 않는다
    target = pending ? null : pick(curX, curY);
    best = Infinity; stuck = 0;
    try { el.setPointerCapture(e.pointerId); } catch { /* 이미 놓음 */ }
  });
  el.addEventListener('pointermove', e => { if (holding && e.pointerId === pointerId) { curX = e.clientX; curY = e.clientY; shift = e.shiftKey; } });
  const up = e => {
    const tap = taps.get(e.pointerId);
    if (tap) {
      taps.delete(e.pointerId);
      const ok = !tap.multi && performance.now() - tap.t < MOUSE.clickMs * 1.6 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < MOUSE.clickPx * 2;
      if (ok && clickFn && !blocked()) clickFn(pick(e.clientX, e.clientY), e);
      return;
    }
    if (!holding || e.pointerId !== pointerId) return;
    holding = false;
    const click = performance.now() - downAt < MOUSE.clickMs && Math.hypot(e.clientX - downX, e.clientY - downY) < MOUSE.clickPx;
    if (pending) {                   // 짧게 눌렀다 뗌 = 칸 고르기 (걷지 않음)
      pending = false;
      target = null;
      if (click && clickFn && !blocked()) clickFn(pick(e.clientX, e.clientY), e);
      return;
    }
    if (!click) target = null;       // 꾹 눌러 따라가던 것은 놓으면 멈춘다
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', e => { taps.delete(e.pointerId); if (e.pointerId === pointerId) stop(); });
  addEventListener('blur', stop);

  return {
    /** input.js 가 매 프레임: 이동 방향 { x, z, run } 또는 null */
    get(dt = 1 / 60) {
      if (blocked()) { stop(); return null; }
      if (holding && pending) {      // 칸 누르기 중: 꾹 누르거나 끌면 그때부터 걷기
        if (performance.now() - downAt < MOUSE.clickMs && Math.hypot(curX - downX, curY - downY) < MOUSE.clickPx) return null;
        pending = false;
      }
      if (holding) target = pick(curX, curY) ?? target;
      if (!target) return null;
      const p = position();
      const s = steer(p.x, p.z, target.x, target.z, { holding, shift });
      if (s.done) { if (!holding) target = null; return null; }
      // 못 가는 곳: 가장 가까웠던 거리가 줄지 않으면 그만 (꾹 누르는 중엔 커서를 옮기면 되니 놔둔다)
      const d = Math.hypot(target.x - p.x, target.z - p.z);
      if (d < best - 0.05) { best = d; stuck = 0; } else if (!holding && (stuck += dt) > MOUSE.stuckSec) { stop(); return null; }
      return s;
    },
    /** 키보드·패드를 쓰면 input.js 가 부른다 */
    cancel: stop,
    /** 10차 D96-A: 짧은 누르기·톡을 받을 곳 (point = {x, z, y} | null) → 걸려 있는 동안 짧게 누르면 걷지 않는다. null = 끄기 */
    setClickHandler(fn) { clickFn = typeof fn === 'function' ? fn : null; pending = false; taps.clear(); },
    /** 화면 점 → 보이는 땅 점 (곡면 월드까지) */
    pickAt: (sx, sy) => pick(sx, sy),
    /** 플레이어 update 에서: 고리 표시 */
    update(dt) {
      const show = !!target && !blocked();
      if (show) ring.position.set(target.x, (target.y ?? position().y) + 0.04, target.z);
      ringMat.opacity += ((show ? 0.85 : 0) - ringMat.opacity) * Math.min(1, dt * 12);
      ring.visible = ringMat.opacity > 0.02;
      if (ring.visible) ring.scale.setScalar(1 + 0.12 * Math.sin(performance.now() / 160));
    },
    get target() { return target; },
    get holding() { return holding; },
  };
}
