// 문 드나들기 (실내 검수 보드 interiors — AN-06 문 열기 · AN-07 걸어 들어가기 · UI-12 원형 전환). 내 집·주민 집·상점·박물관이 같이 쓴다.
//  들어갈 때: 문 쪽으로 돌아서고 문짝이 안으로 열림(문 소리) → 문간까지 두세 걸음 → 원이 좁아짐 → (어두운 동안) 실내로 → 원이 열리며 문 매트에서 한두 걸음.
//  나올 때: 문 매트에서 화면 앞으로 걸어 나감 → 원이 좁아짐 → 섬의 문간(문은 열린 채)으로 → 원이 열리며 문 밖으로 두 걸음 → 문이 닫힘.
//  흔들림 줄이기(ui.access.calm)면 걷기·문 동작 없이 문 소리와 화면 전환만 (원 없이 전체).
// 문짝은 건물 모델(assets/env 의 'door' 재질 부분) 크기 그대로 덧씌운 판. 섬 건물은 묶음(InstancedMesh)이라 진짜 문은 못 움직여서,
// 문간을 어두운 상자로 덮고 그 앞에 같은 색 문짝을 두어 경첩 쪽으로 접어(가로로 줄어들며 어두워짐) 안으로 열리는 것처럼 보이게 한다.
import { LEVEL_HEIGHT } from '../../world/island.js';

/** 반영 v1 (임시, 보드 추천안): D67-A 열리고 걸어 들어감 · D68-A 원형. motion 'walk' | 'open' (D67-B) | 'none' (D67-C), fade 'circle' | 'plain' */
export const DOOR_STYLE = { motion: 'walk', fade: 'circle', color: '#2E2420' };
/** 시간 (초)과 연출 걸음 walk (칸/초, 보통 걷기 2.6). 문에서 멀리 서 있으면 walkMax 초 안에 닿게 빨리 걷는다. 원은 문간에 닿을 즈음 닫히게 늦춘다 */
export const TIMING = { open: 0.32, beforeWalk: 0.14, fadeOut: 0.36, fadeIn: 0.44, close: 0.3, plainOut: 0.28, plainIn: 0.42, walk: 1.6, walkMax: 0.85 };

/** 연출 걸음: (from → to) 거리 → { speed, time, fadeAt (걷기 시작부터 원이 닫히기 시작할 때) } */
export function walkPlan(from, to) {
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  const speed = Math.max(TIMING.walk, dist / TIMING.walkMax);
  const time = dist / speed;
  return { dist, speed, time, fadeAt: Math.max(0, time - TIMING.fadeOut * 0.8) };
}
export const DOORWAY_DEPTH = 0.07;      // 문간 상자 두께 (건물 문 앞면에서 바깥쪽으로 — 문고리까지 덮는다)
export const OPEN_ANGLE = 1.38;         // 다 열렸을 때 (라디안, 약 80°)
/** 모양이 네모가 아닌 문: 위쪽 반달 높이 (m) — 박물관 문은 네모 위에 반달 (build_env.py museum) */
export const ARCH = { museum: 0.32 };
const DOORWAY_COLOR = '#2A1F1B';

/** 건물 모델 → 문 네모 (건물 원점 기준 m): { x0, x1, y0, y1, z (문 앞면), arch } | null */
export function doorRect(scene, THREE, kind) {
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  scene.updateMatrixWorld(true);
  let found = false;
  scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some(m => m?.name === 'door')) return;
    tmp.setFromObject(o);
    box.union(tmp);
    found = true;
  });
  if (!found) return null;
  return { x0: box.min.x, x1: box.max.x, y0: box.min.y, y1: box.max.y, z: box.max.z, arch: ARCH[kind] ?? 0 };
}

/** 문짝 펼친 정도 p (0 닫힘 ~ 1 열림) → 안으로 열릴 때 앞에서 보이는 가로 비율 · 밝기 */
export function leafLook(p) {
  const a = Math.max(0, Math.min(1, p)) * OPEN_ANGLE;
  return { width: Math.max(0.06, Math.cos(a)), shade: 1 - 0.38 * Math.sin(a) };
}

/** 장소 (world.places 의 건물) + 문 네모 → 월드의 문 앞면 가운데 { x, y, z } */
export function doorFront(place, rect, y = 0) {
  return { x: place.x + (rect.x0 + rect.x1) / 2, y: y + rect.y0, z: place.z + rect.z };
}

export function createDoors(ctx, { fadeTo }) {
  const { THREE, scene, events, materials } = ctx;
  const player = ctx.services.player, world = ctx.services.world;
  const rects = new Map();      // kind → Promise<rect|null>
  const leaves = new Map();     // 건물 자리 키 → 문짝
  const tweens = new Set();
  let busy = false;

  const calm = () => !!ctx.services.ui?.access?.calm;
  const wait = sec => new Promise(res => setTimeout(res, sec * 1000));
  const tween = (dur, fn) => new Promise(res => { const t = { t: 0, dur: Math.max(0.001, dur), fn, res }; tweens.add(t); fn(0); });

  function rectOf(kind) {
    if (!rects.has(kind)) {
      rects.set(kind, ctx.assets.loadEnv(kind).then(g => doorRect(g.scene, THREE, kind)).catch(e => { console.warn('[house] 문 크기를 못 읽었어요', kind, e); return null; }));
    }
    return rects.get(kind);
  }
  /** 건물이 선 높이: 문 앞 칸의 층 (박물관은 언덕 위) */
  function baseY(place) {
    const isl = world.island;
    if (Number.isFinite(place.tx) && isl.levelAt) return (isl.levelAt(place.tx, place.tz) || 0) * LEVEL_HEIGHT;
    return isl.heightAt(place.x, place.z) ?? 0;
  }

  function leafShape(w, h, arch) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(w, 0);
    if (arch > 0) { s.lineTo(w, h - arch); s.absellipse(w / 2, h - arch, w / 2, arch, 0, Math.PI, false); }
    else { s.lineTo(w, h); s.lineTo(0, h); }
    s.lineTo(0, 0);
    return s;
  }

  /** 건물 문짝 하나 (처음 쓸 때 짓는다) */
  async function leafFor(place, kind, variant) {
    const key = `${kind}@${place.x.toFixed(2)},${place.z.toFixed(2)}`;
    if (leaves.has(key)) return leaves.get(key);
    const rect = await rectOf(kind);
    if (!rect) return null;
    const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
    const color = world.palette?.(kind, variant)?.door ?? '#9A6B45';
    const group = new THREE.Group();
    group.name = `door-leaf:${key}`;
    group.position.set(place.x + rect.x0, baseY(place) + rect.y0, place.z + rect.z - 0.006);
    group.visible = false;
    // 문간: 건물 문을 덮는 어두운 상자 (안쪽은 보이지 않게)
    const holeGeo = new THREE.ExtrudeGeometry(leafShape(w, h, rect.arch), { depth: DOORWAY_DEPTH, bevelEnabled: false, curveSegments: 10 });
    const holeMat = materials.toonMaterial(DOORWAY_COLOR, { name: 'doorway', flat: true });
    const hole = new THREE.Mesh(holeGeo, holeMat);
    group.add(hole);
    // 문짝: 경첩(서쪽 끝)에 매단 판 + 문고리
    const pivot = new THREE.Group();
    pivot.position.z = DOORWAY_DEPTH + 0.004;
    const leafGeo = new THREE.ExtrudeGeometry(leafShape(w, h, rect.arch), { depth: 0.035, bevelEnabled: false, curveSegments: 10 });
    const leafMat = materials.toonMaterial(color, { name: 'doorLeaf' });
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.castShadow = true;
    pivot.add(leaf);
    const knobMat = materials.toonMaterial(world.palette?.(kind, variant)?.trim ?? '#6A4A33', { name: 'doorKnob' });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), knobMat);
    knob.position.set(w - 0.11, Math.min(0.48, h * 0.45), 0.05);
    pivot.add(knob);
    group.add(pivot);
    scene.add(group);
    const base = new THREE.Color(color);
    const L = {
      group, rect, front: doorFront(place, rect, baseY(place)), p: 0,
      /** 펼친 정도 (0 닫힘 ~ 1 열림) */
      set(p) {
        L.p = p;
        const { width, shade } = leafLook(p);
        pivot.scale.x = width;
        leafMat.color.copy(base).multiplyScalar(shade);
        knob.visible = p < 0.6;
      },
      show(v) { group.visible = v; },
    };
    L.set(0);
    leaves.set(key, L);
    return L;
  }

  /** 플레이어 머리의 화면 자리 (원형 전환 가운데) */
  function screenOf() {
    const cam = ctx.camera, el = ctx.renderer.domElement;
    cam.updateMatrixWorld();
    const p = player.position;
    const v = new THREE.Vector3(p.x, p.y + 0.75, p.z).project(cam);
    const r = el.getBoundingClientRect();
    const k = (n, max) => (Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : max / 2);   // 화면 밖이면 가장자리로
    return v.z > 1 ? { x: r.width / 2, y: r.height / 2 } : { x: k(((v.x + 1) / 2) * r.width, r.width), y: k(((1 - v.y) / 2) * r.height, r.height) };
  }
  function fade(on, plain) {
    const circle = !plain && DOOR_STYLE.fade === 'circle';
    const sec = circle ? (on ? TIMING.fadeOut : TIMING.fadeIn) : (on ? TIMING.plainOut : TIMING.plainIn);
    return fadeTo(on, sec, DOOR_STYLE.color, circle ? { shape: 'circle', at: screenOf() } : undefined);
  }

  /**
   * 문 지나가기. dir 'in' (섬 → 실내) | 'out' (실내 → 섬).
   *  place: world.places 의 건물 { x, z, door, tx, tz }, kind: 건물 모델 slug, variant: 색 변형 (주민 집 = 주민 slug)
   *  room: 실내 문 매트 { x, front (방 앞 끝 z), entry (들어와서 설 z) } (월드)
   *  arrive({ x, z, facing }): 화면이 닫힌 동안 부른다 — 그 자리로 옮기고 방·카메라·소리를 바꾼다 (Promise 여도 된다)
   * → Promise (다 끝나면). 이미 지나가는 중이면 false
   */
  async function through({ dir, place, kind, variant = null, room, arrive }) {
    if (busy) return false;
    busy = true;
    player.freeze(true);
    // 문간에 서면 건물이 카메라와 플레이어 사이라 가림 투명으로 통째로 비친다 → 지나가는 동안은 끈다
    const occ = world.occlusion, occWas = occ?.enabled;
    if (occ && occWas) occ.enabled = false;
    const motion = calm() ? 'none' : DOOR_STYLE.motion;
    const plain = motion === 'none' || calm();
    let L = null;
    try {
      if (motion !== 'none' && place) L = await leafFor(place, kind, variant);
      const outside = L?.front ?? (place?.door ? { x: place.door.x, z: place.door.z - 0.6 } : null);
      if (dir === 'in') {
        events.emit('sfx', { name: 'door' });
        if (L) {
          player.face(L.front.x, L.front.z - 3);
          L.show(true);
          const opening = tween(TIMING.open, k => L.set(ease(k)));
          if (motion === 'walk') {
            await wait(TIMING.beforeWalk);
            const to = { x: L.front.x, z: L.front.z - 0.1 }, plan = walkPlan(player.position, to);
            const walk = player.walkTo(to.x, to.z, { speed: plan.speed });
            await wait(plan.fadeAt);
            await Promise.all([fade(true, plain), walk, opening]);
          } else { await opening; await fade(true, plain); }
        } else await fade(true, plain);
        const walkIn = motion === 'walk';
        await arrive({ x: room.x, z: walkIn ? room.front - 0.18 : room.entry, facing: 0 });
        if (L) { L.set(0); L.show(false); }
        if (walkIn) await Promise.all([fade(false, plain), player.walkTo(room.x, room.entry, { speed: TIMING.walk })]);
        else await fade(false, plain);
      } else {
        if (motion === 'walk') {
          player.face(player.position.x, player.position.z + 3);
          const to = { x: room.x, z: room.front + 0.3 }, plan = walkPlan(player.position, to);
          const walk = player.walkTo(to.x, to.z, { speed: plan.speed });
          await wait(plan.fadeAt);
          await Promise.all([fade(true, plain), walk]);
        } else {
          events.emit('sfx', { name: 'door' });
          await fade(true, plain);
        }
        const step = place?.door ? { x: place.door.x, z: place.door.z + 0.15 } : null;
        if (L && motion === 'walk') { L.set(1); L.show(true); }
        await arrive(L && motion === 'walk' ? { x: L.front.x, z: L.front.z - 0.1, facing: Math.PI } : { ...(step ?? outside ?? { x: 0, z: 0 }), facing: Math.PI });
        if (L && motion === 'walk') {
          events.emit('sfx', { name: 'door', volume: 0.7 });
          await Promise.all([fade(false, plain), player.walkTo(step.x, step.z, { speed: TIMING.walk })]);
          player.freeze(false);
          events.emit('sfx', { name: 'door', volume: 0.45 });
          await tween(TIMING.close, k => L.set(1 - ease(k)));
          L.show(false);
        } else await fade(false, plain);
      }
    } catch (e) {
      console.error('[house] 문 지나가기', e);
      fadeTo(false, 0.2);
      if (L) { L.set(0); L.show(false); }
    } finally {
      player.freeze(false);
      busy = false;
      if (occ && occWas) occ.enabled = true;
    }
    return true;
  }

  function update(dt) {
    for (const t of tweens) {
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      t.fn(k);
      if (k >= 1) { tweens.delete(t); t.res(); }
    }
  }

  return {
    through, update, leafFor, rectOf,
    get busy() { return busy; },
    /** 개발·테스트용: 지금 만든 문짝들 */
    leaves: () => [...leaves.values()],
  };
}

const ease = k => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
