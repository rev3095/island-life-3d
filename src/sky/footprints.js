// M18-P2 FX-04 눈 발자국 (15차 보드 D193-A · D197-A): 땅에 눈이 쌓이면(첫눈 하루 · 다른 눈 오는 날도) 주인공 뒤로 발자국이 남는다.
//  - 「판」: 작은 납작한 판 PRINTS 장을 메시 하나에 (그리기 1번, 새 셰이더 없음 — 기본 재질 + 곡면 월드 패치 materials.curved).
//    사양마다 같은 방식이고 장 수만 다르다 (매우 낮음 24장). 눈이 없으면 숨긴다 → 다른 날 GPU 몫 0.
//  - 발자국은 걸음마다 왼발·오른발 번갈아, 오래된 것부터 지워지고 천천히 옅어진다. 물·모래사장 위에는 안 남긴다.
import * as THREE from 'three';

export const PRINT_QUALITY = { high: 64, mid: 48, low: 32, min: 24 };
const STRIDE = 0.42;     // 이만큼 걸을 때마다 한 발
const SIDE = 0.09;       // 몸 가운데에서 옆으로
const LIFE = 90;         // 초 — 이만큼 지나면 다 옅어짐
const MIN_SNOW = 0.3;    // 땅에 쌓인 눈이 이만큼은 돼야 남는다
const NO_PRINT = new Set(['sea', 'water', 'cliff']);   // island.js KIND_NAMES 중 발자국이 안 남는 곳 (모래사장도 눈이 덮이면 남는다)

export function createFootprints(materials, { quality = 'mid' } = {}) {
  const MAX = PRINT_QUALITY.high;
  let n = PRINT_QUALITY[quality] ?? PRINT_QUALITY.mid;
  const pos = new Float32Array(MAX * 4 * 3), alpha = new Float32Array(MAX * 4), idx = [];
  for (let i = 0; i < MAX; i++) { const b = i * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 4 * 4).fill(0), 4));   // rgba — a 가 진하기 (vec4 꼭짓점 색)
  g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color: '#7389A6', transparent: true, opacity: 0.75, depthWrite: false, vertexColors: true, side: THREE.DoubleSide });   // 판 방향(발 좌우)에 따라 뒤집혀도 보이게
  materials?.curved?.(mat);
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'sky-footprints';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.visible = false;
  const born = new Float32Array(MAX).fill(-1e9);
  let head = 0, t = 0, last = null, foot = 1, count = 0;
  const col = g.attributes.color;

  function stamp(x, y, z, facing) {
    const i = head % n;
    head++;
    count = Math.min(n, count + 1);
    foot = -foot;
    const fx = -Math.sin(facing), fz = -Math.cos(facing);   // 앞 (facing 0 = 북 -z)
    const rx = -fz, rz = fx;                                 // 오른쪽
    const cx = x + rx * SIDE * foot, cz = z + rz * SIDE * foot;
    const L = 0.14, W = 0.07;
    const c = [[-W, -L], [W, -L], [-W, L], [W, L]];
    c.forEach(([a, b], k) => {
      const o = (i * 4 + k) * 3;
      pos[o] = cx + rx * a + fx * b;
      pos[o + 1] = y + 0.025;
      pos[o + 2] = cz + rz * a + fz * b;
    });
    born[i] = t;
    g.attributes.position.needsUpdate = true;
  }

  return {
    object: mesh,
    get count() { return mesh.visible ? count : 0; },
    setQuality(q) {
      const next = PRINT_QUALITY[q];
      if (!next || next === n) return;
      n = next; head = 0; count = 0; born.fill(-1e9); pos.fill(0); g.attributes.position.needsUpdate = true;
    },
    /** o = { snow 땅에 쌓인 눈 0~1, player (services.player), island (world.island) } */
    update(dt, { snow = 0, player = null, island = null } = {}) {
      t += dt;
      mesh.visible = snow > 0.05 && count > 0;
      const p = player?.position;
      if (snow >= MIN_SNOW && p && !player?.swimming) {
        if (!last) last = { x: p.x, z: p.z };
        const d = Math.hypot(p.x - last.x, p.z - last.z);
        if (d > 2) last = { x: p.x, z: p.z };   // 순간 이동 (문·시계) — 잇지 않는다
        else if (d >= STRIDE) {
          last = { x: p.x, z: p.z };
          let kind = null;
          try { const tl = island?.toTile?.(p.x, p.z); kind = tl ? island.tileAt(tl.tx, tl.tz) : null; } catch { kind = null; }
          if (!NO_PRINT.has(kind) && !island?.isWater?.(p.x, p.z)) stamp(p.x, p.y ?? 0, p.z, player.facing ?? 0);
          mesh.visible = true;
        }
      } else last = null;
      if (!mesh.visible) return;
      // 옅어지기: 오래된 발자국일수록 흐리게 (꼭짓점 색 a = 진하기, 바탕 재질은 그대로)
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, 1 - (t - born[i]) / LIFE) * Math.min(1, snow / MIN_SNOW);
        for (let k = 0; k < 4; k++) { const o = (i * 4 + k) * 4; col.array[o] = col.array[o + 1] = col.array[o + 2] = 1; col.array[o + 3] = a; }
      }
      col.needsUpdate = true;
    },
  };
}
