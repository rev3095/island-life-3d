// 밤하늘 별자리 별 (요청 8): 지금 계절의 별자리 셋(starmap.js)을 dome.js 별 재질 그대로 Points 하나로 더 그린다.
//  - 새 셰이더·새 재질 없음: dome 의 별(sky-stars) 재질을 나눠 쓰고 그 아래 자식으로 단다 → 별이 보일 때만 보이고(부모 visible),
//    반짝임·구름 가림·밝기(uAlpha)·사양별 셰이더 선택이 모두 dome 별과 같다. 점 수 = 별자리 셋 × 5~7 = 20개 안팎.
//  - 계절이 바뀌면 점만 다시 만든다 (sky/index.js 의 syncSeason 고리).
//  - 별자리 선·이름은 3D 하늘에 그리지 않는다 — 망원경 보기(gameplay/stars)에서만.
import * as THREE from 'three';
import { inSeason, starDir } from './starmap.js';

const RADIUS = 110;                      // dome.js 별과 같은 거리
const SIZE = { 1: 6.6, 2: 5.4, 3: 4.4 }; // 밝기 등급 → 점 크기 (dome 별 2.0~4.2 보다 조금 크게)

/** dome = createDome() 결과 (starPoints 가 있어야 한다) → { setSeason(season), season, count } | null */
export function createStarSky(dome) {
  const parent = dome?.starPoints;
  if (!parent?.material) return null;
  let pts = null, season = null;
  function setSeason(next) {
    if (next === season) return;
    season = next;
    if (pts) { parent.remove(pts); pts.geometry.dispose(); pts = null; }
    const list = inSeason(next), n = list.reduce((s, c) => s + c.stars.length, 0);
    if (!n) return;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
    let i = 0;
    for (const c of list) c.stars.forEach(([, , mag], k) => {
      const d = starDir(c, k);
      pos.set([d[0] * RADIUS, d[1] * RADIUS, d[2] * RADIUS], i * 3);
      size[i] = SIZE[mag] ?? SIZE[2];
      phase[i] = ((k * 0.37 + c.az * 0.01) % 1 + 1) % 1;
      i++;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    pts = new THREE.Points(g, parent.material);
    pts.name = 'sky-constellations';
    pts.frustumCulled = false;
    pts.renderOrder = parent.renderOrder + 1;
    parent.add(pts);
  }
  return { setSeason, get season() { return season; }, get count() { return pts?.geometry.attributes.position.count ?? 0; } };
}
