// M18-P2 우산 쓴 주민 (15차 보드 D193-A 장마 하루): 장마·태풍 날 비가 오면 밖에 있는 주민이 우산을 쓴다.
//  - 우산 = 코드로 만든 납작한 원뿔 지붕 + 손잡이를 한 메시로 (주민마다 그리기 1번, 툰 재질 — 사양마다 같다. 새 셰이더 없음).
//  - 그날만 만든다: 우산 날이 아니면 메시를 떼고 지운다 → 다른 날 GPU 몫 0. 색은 주민 이름으로 늘 같다.
//  - 붙이는 곳 = 주민 뿌리(actor.root) 머리 위 (뼈대에 묶지 않음 — 걷기·앉기 동작과 상관없이 똑바로).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const UMBRELLA_COLORS = ['#F2C14E', '#E86A6A', '#6FA8DC', '#8BC48A', '#C79BE0'];

function umbrellaGeometry() {
  const roof = new THREE.ConeGeometry(0.46, 0.2, 10, 1, true);
  roof.translate(0, 0.1, 0);
  const tip = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5);
  tip.translate(0, 0.23, 0);
  const stick = new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5);
  stick.translate(0, -0.27, 0);
  const g = mergeGeometries([roof.toNonIndexed(), tip.toNonIndexed(), stick.toNonIndexed()]);
  g.computeVertexNormals();
  return g;
}

export function createUmbrellas(ctx) {
  let geo = null;
  const mats = new Map(), held = new Map();   // slug → mesh
  const colorOf = slug => UMBRELLA_COLORS[[...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % UMBRELLA_COLORS.length];
  const matOf = color => {
    if (!mats.has(color)) {
      const m = ctx.materials?.toonMaterial?.(color, { name: 'umbrella' }) ?? new THREE.MeshLambertMaterial({ color });
      m.side = THREE.DoubleSide;
      mats.set(color, m);
    }
    return mats.get(color);
  };
  function drop(slug) {
    const m = held.get(slug);
    if (m) { m.parent?.remove(m); held.delete(slug); }
  }
  function clear() {
    for (const slug of [...held.keys()]) drop(slug);
    geo?.dispose(); geo = null;
    for (const m of mats.values()) m.dispose();
    mats.clear();
  }
  return {
    get count() { return held.size; },
    /** 매 프레임: on = 우산 날(daily.special.umbrella()), villagers = town 주민 목록 */
    update(on, villagers) {
      if (!on) { if (held.size || geo) clear(); return; }
      geo ??= umbrellaGeometry();
      for (const V of villagers) {
        const out = V.actor.visible && V.mode !== 'home' && V.mode !== 'room' && !(V.mode === 'talk' && V.talkFrom === 'room');
        if (!out) { drop(V.slug); continue; }
        if (held.has(V.slug)) continue;
        const mesh = new THREE.Mesh(geo, matOf(colorOf(V.slug)));
        mesh.name = 'town-umbrella';
        mesh.position.set(0.08, (V.actor.height ?? 1) + 0.26, 0.04);
        mesh.rotation.z = -0.12;
        mesh.castShadow = true;
        V.actor.root.add(mesh);
        held.set(V.slug, mesh);
      }
    },
    clear,
  };
}
