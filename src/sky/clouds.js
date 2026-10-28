// 몽글몽글한 툰 구름. 섬 바깥 먼 하늘에 떠서 천천히 흘러간다.
// ctx.materials 의 툰 재질(곡면 월드 포함)을 써서 다른 물체와 같은 그림체로 보인다. 안개는 받지 않는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX = 14;
const SPAN = 280;                // 구름이 흘러가는 폭 (focus 기준 ±140)

function puffGeometry(rnd) {
  const parts = [];
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = 2.6 + rnd() * 2.2 - Math.abs(i - (n - 1) / 2) * 0.5;
    const g = new THREE.IcosahedronGeometry(r, 2);
    g.translate((i - (n - 1) / 2) * 3.1 + rnd() * 0.8, rnd() * 1.4 - (Math.abs(i - (n - 1) / 2) * 0.6), rnd() * 2 - 1);
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  g.scale(1, 0.72, 0.8);       // 아래가 납작한 솜뭉치
  return g;
}

export function createClouds(materials) {
  let seed = 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const mat = materials.toonMaterial('#FFFFFF', { name: 'cloud' });
  mat.fog = false;
  mat.emissive = new THREE.Color(0, 0, 0);
  const group = new THREE.Group();
  group.name = 'sky-clouds';
  const clouds = [];
  for (let i = 0; i < MAX; i++) {
    const mesh = new THREE.Mesh(puffGeometry(rnd), mat);
    mesh.castShadow = mesh.receiveShadow = false;
    // 대부분 북쪽(-Z, 카메라가 바라보는 쪽) 먼 하늘, 몇 개는 동서쪽
    const north = i % 4 !== 3;
    clouds.push({
      mesh,
      x: (rnd() - 0.5) * SPAN,
      z: north ? -55 - rnd() * 95 : (rnd() - 0.5) * 120,
      side: north ? 0 : (rnd() < 0.5 ? -1 : 1),
      y: 24 + rnd() * 14,
      speed: 0.6 + rnd() * 0.8,
      size: 0.8 + rnd() * 0.6,
      order: i,              // 맑은 날엔 앞 번호 몇 개만 보인다
      show: 0,
    });
    mesh.rotation.y = (rnd() - 0.5) * 0.6;
    group.add(mesh);
  }

  return {
    group,
    material: mat,
    /** cover: 0(맑음, 5개) ~ 1(흐림·비, 14개), grey: 0~1 잿빛, horizon: 지평선 색 (sRGB 배열) */
    update(dt, focus, cover, grey, horizon) {
      const want = Math.round(5 + cover * (MAX - 5));
      for (const c of clouds) {
        c.x += c.speed * dt * (1 + cover);
        if (c.x > SPAN / 2) c.x -= SPAN;
        const target = c.order < want ? 1 : 0;
        c.show = dt === 0 ? target : c.show + (target - c.show) * Math.min(1, dt * 0.8);   // 첫 프레임은 바로
        const s = c.size * c.show * (1 + cover * 0.35);
        c.mesh.visible = s > 0.02;
        c.mesh.scale.setScalar(s || 0.001);
        const sx = c.side ? c.side * (75 + Math.abs(c.z) * 0.3) : 0;
        c.mesh.position.set(focus.x + c.x + sx, focus.y + c.y - cover * 4, focus.z + c.z);
      }
      // 흐릴수록 잿빛, 어두운 면이 너무 시커멓지 않게 지평선 색을 조금 스스로 낸다
      mat.color.setRGB(1 - grey * 0.38, 1 - grey * 0.34, 1 - grey * 0.28, THREE.SRGBColorSpace);
      mat.emissive.setRGB(horizon[0], horizon[1], horizon[2], THREE.SRGBColorSpace).multiplyScalar(0.22);
    },
  };
}
