// 그리기 줄이기 (render 가 매 프레임 그리기 전에 부른다). 모양·재질은 건드리지 않는다.
//
// 1. 캐릭터 화면 밖 빼기: applyToonStyle 은 뼈대 메시(캐릭터·그 외곽선)를 frustumCulled = false 로 둔다 (움직이는 정점의 구를 모르니까).
//    그러면 화면 밖 주민·가게 주인까지 본 장면 + 그림자 지도에 매번 그려진다 — 9명 × (몸 · 외곽선 · 그림자) ≈ 220번, Intel UHD GPU 3~4ms.
//    뼈대 메시마다 쉰 자세 구를 넉넉히 키워 두고, 곡면 월드로 내려가 보이는 만큼 내리고 키운 구를 매 프레임 넣은 뒤 판정을 다시 켠다.
//    (그림자 카메라도 같은 구를 쓴다 → 휘기 전·후 자리를 다 덮게 반씩 내린다)
//    three 는 화면 밖이어도 뼈대(Skeleton)마다 뼈 텍스처를 매 프레임 올린다 (메시마다 뼈대가 따로라 87개) → 본 카메라·그림자 카메라
//    둘 다에서 안 보이는 뼈대는 그 프레임 update 를 건너뛴다 (다시 보이면 그리기 전에 three 가 먼저 update 한다).
// 2. 그림자 범위 맞추기: 해 그림자 카메라 네모(±18 고정)를 카메라가 실제로 보는 땅(초점 남쪽 몇 칸 ~ 북쪽 FAR 칸)에 맞춘다.
//    해 쪽에서 본 네모를 지도 한 칸(텍셀) 단위로 붙여서 걸을 때 그림자 가장자리가 지글거리지 않게 한다.
import * as THREE from 'three';

const PAD = 1.45, PAD_ADD = 0.3;     // 쉰 자세 구 → 동작(걷기·도구·기뻐하기)까지 덮게
const OUTLINE_FAR = { high: 26, low: 20 };   // 캐릭터 외곽선을 그리는 거리 (카메라에서) — 멀면 굵기가 1화소도 안 된다
const SHADOW_FAR = 21;                // 그림자를 그리는 가장 먼 북쪽 (초점에서, 칸) — 그 너머는 위쪽 흐림 속이라 티가 안 난다
const SHADOW_TOP = 4.8;               // 그림자를 받는 가장 높은 곳 (박물관 지붕)

export function createCuller(ctx) {
  const { scene, camera } = ctx;
  const curve = ctx.materials?.curve;
  const tracked = [];
  let scanIn = 0;
  const inv = new THREE.Matrix4(), wc = new THREE.Vector3(), pm = new THREE.Matrix4();
  const view = new THREE.Frustum(), ws = new THREE.Sphere(), eye = new THREE.Vector3();
  const skip = new WeakSet(), seen = new Set();

  function scan() {
    tracked.length = 0;
    scene.traverse(o => {
      if (!o.isSkinnedMesh) return;
      let info = o.userData.cull;
      if (!info) {
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        info = o.userData.cull = { c: g.boundingSphere.center.clone(), r: g.boundingSphere.radius * PAD + PAD_ADD };
        o.boundingSphere = new THREE.Sphere();
        o.frustumCulled = true;
        const sk = o.skeleton;
        if (sk && !sk.userCullHooked) {
          sk.userCullHooked = true;
          const base = sk.update;
          sk.update = function () { if (!skip.has(this)) base.call(this); };
        }
      }
      tracked.push(o);
    });
  }

  /** 뼈대 메시 구: 월드에서 (중심, 반지름) → 곡면으로 내려간 만큼 반 내리고 그만큼 키움 → 모델 좌표로 되돌려 넣는다.
   *  본 카메라·그림자 카메라 둘 다에서 밖인 뼈대는 이번 프레임 update 를 건너뛴다 */
  function updateCharacters() {
    const k = curve?.uCurve.value ?? 0, fz = ctx.focus.z;
    camera.updateMatrixWorld();
    view.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const sun = ctx.lights?.sun;
    let shadow = null;
    if (sun?.castShadow && ctx.renderer.shadowMap.enabled) {
      sun.updateMatrixWorld(); sun.target.updateMatrixWorld();      // main.js 가 방금 옮긴 해 자리로
      sun.shadow.updateMatrices(sun);
      shadow = sun.shadow.getFrustum();
    }
    seen.clear();
    const olFar = OUTLINE_FAR[ctx.quality] ?? OUTLINE_FAR.high;
    eye.setFromMatrixPosition(camera.matrixWorld);
    for (const m of tracked) {
      const sk = m.skeleton;
      if (!m.frustumCulled) { if (sk) { skip.delete(sk); seen.add(sk); } continue; }   // 누가 다시 끈 메시는 그대로 둔다
      const info = m.userData.cull;
      wc.copy(info.c).applyMatrix4(m.matrixWorld);
      const s = Math.max(1e-6, m.matrixWorld.getMaxScaleOnAxis());
      const dz = wc.z - fz, drop = k * dz * dz;
      wc.y -= drop / 2;
      const r = info.r * s + drop / 2;
      inv.copy(m.matrixWorld).invert();
      m.boundingSphere.center.copy(wc).applyMatrix4(inv);
      m.boundingSphere.radius = r / s;
      // 먼 캐릭터의 외곽선 껍데기: 구를 비워 화면 밖으로 친다 (몸은 그대로)
      if (m.userData.outline && wc.distanceTo(eye) - r > olFar) m.boundingSphere.radius = -1e6;   // 음수 반지름 = 어느 판정에도 안 걸림
      if (!sk) continue;
      ws.center.copy(wc); ws.radius = r;
      const vis = view.intersectsSphere(ws) || (m.castShadow && shadow?.intersectsSphere(ws));
      if (vis) { skip.delete(sk); seen.add(sk); }
      else if (!seen.has(sk)) skip.add(sk);
    }
  }

  // ── 그림자 범위 ──
  const sun = ctx.lights?.sun;
  const ndc = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const ray = new THREE.Vector3(), org = new THREE.Vector3(), lv = new THREE.Matrix4(), pt = new THREE.Vector3();
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  let rect = null, rectIn = 0;
  /** 보이는 땅(곡면 무시, 북쪽은 SHADOW_FAR 까지)을 해 쪽에서 본 네모 (해 카메라 좌표) */
  function fitRect() {
    const f = ctx.focus;
    const pts = [];
    camera.updateMatrixWorld();
    org.setFromMatrixPosition(camera.matrixWorld);
    for (const [x, y] of ndc) {
      ray.set(x, y, 0.5).unproject(camera).sub(org).normalize();
      // y = 0 땅과 만나는 곳, 못 만나거나 너무 멀면 북쪽 FAR 에서 자른다
      let t = ray.y < -1e-4 ? -org.y / ray.y : Infinity;
      if (ray.z < -1e-4) t = Math.min(t, (f.z - SHADOW_FAR - org.z) / ray.z);
      if (!Number.isFinite(t)) t = 40;
      pt.copy(org).addScaledVector(ray, t);
      pts.push(pt.x, f.y - 0.3, pt.z, pt.x, f.y + SHADOW_TOP, pt.z);
    }
    // 해 카메라 축 (three 와 같게: target 을 보고 위 = +Y)
    az.copy(ctx.lights.sunOffset).normalize();
    ax.crossVectors(THREE.Object3D.DEFAULT_UP, az).normalize();
    if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
    ay.crossVectors(az, ax);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      pt.set(pts[i] - f.x, pts[i + 1] - f.y, pts[i + 2] - f.z);
      const px = pt.dot(ax), py = pt.dot(ay);
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    // 1칸 여유 + 2칸 단위로 키운다 (크기가 프레임마다 바뀌면 텍셀이 달라져 지글거린다)
    const q = v => Math.ceil(v / 2) * 2;
    return { x0: -q(-x0 + 1), x1: q(x1 + 1), y0: -q(-y0 + 1), y1: q(y1 + 1) };
  }

  let fit = true;
  function updateShadow(dt) {
    if (!sun?.castShadow || ctx.services.time?.indoor) return;
    const cam = sun.shadow.camera;
    if ((rectIn -= dt) <= 0 || !rect) {
      rectIn = 0.5;
      const r = fit ? fitRect() : { x0: -18, x1: 18, y0: -18, y1: 18 };   // fit = false: main.js 의 예전 고정 네모 (비교용)
      // 아주 조금 바뀐 것은 무시 (줌 중이 아니면 같은 네모)
      if (!rect || r.x0 !== rect.x0 || r.x1 !== rect.x1 || r.y0 !== rect.y0 || r.y1 !== rect.y1) {
        rect = r;
        cam.left = r.x0; cam.right = r.x1; cam.bottom = r.y0; cam.top = r.y1;
        cam.updateProjectionMatrix();
      }
    }
    // 해 자리를 지도 텍셀 단위로 붙이기 (빛 방향은 그대로 → 밝기는 같다)
    const size = sun.shadow.mapSize;
    const tx = (rect.x1 - rect.x0) / size.x, ty = (rect.y1 - rect.y0) / size.y;
    pt.copy(sun.target.position);
    const px = pt.dot(ax), py = pt.dot(ay);
    const dx = Math.round(px / tx) * tx - px, dy = Math.round(py / ty) * ty - py;
    sun.target.position.addScaledVector(ax, dx).addScaledVector(ay, dy);
    sun.position.addScaledVector(ax, dx).addScaledVector(ay, dy);
  }

  return {
    update(dt) {
      if ((scanIn -= dt) <= 0) { scanIn = 1; scan(); }
      updateShadow(dt);          // 그림자 범위 먼저 (캐릭터가 그림자 카메라에 걸리는지 볼 때 쓴다)
      updateCharacters();
    },
    get rect() { return rect; },
    get tracked() { return tracked.length; },
    /** 그림자 범위를 보이는 땅에 맞출지 (false = 예전 ±18 고정) */
    get fitShadow() { return fit; },
    set fitShadow(v) { fit = !!v; rectIn = 0; },
  };
}
