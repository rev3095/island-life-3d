// 지형 그리기: 타일 모델을 종류·구역(16×16칸)별 InstancedMesh 로, 섬 밖 바다는 큰 판 하나로, 폭포·물거품은 따로.
import * as THREE from 'three';
import { KIND, LEVEL_HEIGHT, WATER_TOP } from './island.js';
import { mulberry32 } from './rng.js';

export const CHUNK = 16;                       // 구역 크기 (화면 밖 구역은 그리지 않는다)
const SEA_Y = WATER_TOP - 0.02;                // 바다 판 높이 (강 물 타일보다 살짝 아래 → 겹침 깜빡임 없음)

// 타일 종류 → 모델 slug, 변형
const TILE_MODEL = {
  [KIND.GRASS]: 'tile-grass', [KIND.SAND]: 'tile-sand', [KIND.PATH]: 'tile-path', [KIND.PLAZA]: 'tile-plaza',
  [KIND.WATER]: 'tile-water', [KIND.CLIFF]: 'tile-cliff', [KIND.RAMP]: 'tile-ramp',
};
const SPIN = new Set([KIND.GRASS, KIND.SAND, KIND.PATH, KIND.PLAZA, KIND.WATER, KIND.CLIFF]);   // 90° 돌려 무늬를 섞는다

export function buildTerrain(ctx, gen, island, kit, models) {
  const { scene } = ctx;
  const { w, h } = gen;
  const group = new THREE.Group();
  group.name = 'terrain';
  scene.add(group);

  // 타일 판: 평평한 바닥은 그림자를 드리우지 않는다
  const templates = {};
  for (const [k, slug] of Object.entries(TILE_MODEL)) {
    const { gltf, spec } = models[slug];
    const flatGround = +k !== KIND.CLIFF && +k !== KIND.RAMP;
    const palette = { ...spec.palette, ...(+k === KIND.WATER ? spec.variants?.river?.palette : null) };
    // 평평한 바닥(풀·모래·길·광장·물)은 외곽선을 빼서 칸 무늬가 바둑판처럼 보이지 않게 한다
    // 땅 재질 이름 'ground' → 비가 오면 sky 가 젖은 색으로 바꾼다 (물은 빼고)
    templates[k] = kit.buildTemplate(gltf, spec, { palette, castShadow: !flatGround, outline: flatGround ? 0 : undefined,
      materialName: +k === KIND.WATER ? null : 'ground' });
  }

  const batches = new Map();
  const batchFor = (k, tx, tz) => {
    const key = `${k}|${Math.floor(tx / CHUNK)},${Math.floor(tz / CHUNK)}`;
    if (!batches.has(key)) batches.set(key, new kit.Batch(templates[k], CHUNK * CHUNK, group));
    return batches.get(key);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  // 평평한 바닥 타일은 4% 크게 겹쳐 칸 사이 틈(흙 줄)을 덮고, 종류마다 높이를 아주 조금 달리해 겹친 곳이 깜빡이지 않게 한다
  const wide = new THREE.Vector3(1.04, 1, 1.04);
  const LIFT = { [KIND.GRASS]: 0, [KIND.SAND]: -0.004, [KIND.PATH]: 0.003, [KIND.PLAZA]: 0.005, [KIND.WATER]: 0 };
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const i = tz * w + tx, k = gen.kind[i];
    if (k === KIND.SEA) continue;
    const { x, z } = island.toWorld(tx, tz);
    let y = gen.level[i] * LEVEL_HEIGHT + (LIFT[k] ?? 0), zz = z;
    if (k === KIND.CLIFF) y = 0;
    if (k === KIND.RAMP) {
      const r = gen.rampMap[i];
      if (r & 1) continue;                     // 경사로는 위칸에 한 번만 (1×2 모델)
      y = 0; zz = z + 0.5;
    }
    const spin = SPIN.has(k) ? (((tx * 7 + tz * 13) ^ (tx * tz)) & 3) * Math.PI / 2 : 0;
    q.setFromAxisAngle(up, spin);
    m4.compose(p.set(x, y, zz), q, LIFT[k] != null ? wide : one);
    batchFor(k, tx, tz).add(i, m4);
  }
  for (const b of batches.values()) b.flush();

  const sea = buildSea(ctx, gen, island, models['tile-water'].spec);
  group.add(sea);
  const foam = buildFoam(ctx, gen, island);
  group.add(foam.mesh);
  const falls = buildWaterfalls(ctx, gen, island);
  group.add(falls.group);

  return {
    group, templates, batches,
    update(dt, t) { foam.update(t); falls.update(dt, t); },
    setOutlineVisible(v) { for (const b of batches.values()) b.setOutlineVisible(v); },
  };
}

/** 섬 둘레 바다: 바닷가는 얕은 색, 멀어질수록 깊은 색 (꼭짓점 색). 곡면 월드가 휘도록 잘게 나눈다. */
function buildSea(ctx, gen, island, waterSpec) {
  const { w, h } = gen;
  // 땅에서의 거리 (타일)
  const N = w * h, d = new Float32Array(N).fill(1e9);
  for (let i = 0; i < N; i++) if (gen.kind[i] !== KIND.SEA) d[i] = 0;
  const relax = (i, j, c) => { if (d[j] + c < d[i]) d[i] = d[j] + c; };
  for (let pass = 0; pass < 2; pass++) {
    for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
      const i = tz * w + tx;
      if (tx) relax(i, i - 1, 1); if (tz) relax(i, i - w, 1);
      if (tx && tz) relax(i, i - w - 1, 1.41); if (tz && tx < w - 1) relax(i, i - w + 1, 1.41);
    }
    for (let tz = h - 1; tz >= 0; tz--) for (let tx = w - 1; tx >= 0; tx--) {
      const i = tz * w + tx;
      if (tx < w - 1) relax(i, i + 1, 1); if (tz < h - 1) relax(i, i + w, 1);
      if (tx < w - 1 && tz < h - 1) relax(i, i + w + 1, 1.41); if (tz < h - 1 && tx) relax(i, i + w - 1, 1.41);
    }
  }
  const distAt = (x, z) => {
    const { tx, tz } = island.toTile(x, z);
    if (tx < 0 || tz < 0 || tx >= w || tz >= h) {
      const ex = Math.max(0, -x - w / 2, x - w / 2), ez = Math.max(0, -z - h / 2, z - h / 2);
      const cx = Math.min(w - 1, Math.max(0, tx)), cz = Math.min(h - 1, Math.max(0, tz));
      return d[cz * w + cx] + Math.hypot(ex, ez);
    }
    return d[tz * w + tx];
  };
  const SIZE = 360, SEG = 180;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const shallow = new THREE.Color('#9ED6E8'), mid = new THREE.Color(waterSpec.variants?.sea?.palette?.water ?? '#5BAFD0'), deep = new THREE.Color('#4C9CC4');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const dd = distAt(x, z);
    const a = THREE.MathUtils.smoothstep(dd, 0.6, 3.2), b = THREE.MathUtils.smoothstep(dd, 6, 30);
    c.copy(shallow).lerp(mid, a).lerp(deep, b);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = ctx.materials.toonMaterial('#ffffff', { name: 'sea' });
  mat.vertexColors = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = SEA_Y;
  mesh.receiveShadow = true;
  mesh.name = 'sea';
  return mesh;
}

/** 바닷가 물거품: 바다에 닿은 땅 타일 가장자리를 따라 흰 띠. 천천히 밀려왔다 빠진다. */
function buildFoam(ctx, gen, island) {
  const { w, h } = gen;
  const pos = [], off = [];
  const isSea = (tx, tz) => tx < 0 || tz < 0 || tx >= w || tz >= h || (gen.kind[tz * w + tx] === KIND.SEA && !(gen.flags[tz * w + tx]));
  const seaOnly = (tx, tz) => tx < 0 || tz < 0 || tx >= w || tz >= h || gen.kind[tz * w + tx] === KIND.SEA;
  const W0 = 0.02, W1 = 0.24, Y = SEA_Y + 0.012;
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    if (seaOnly(tx, tz)) continue;
    const { x, z } = island.toWorld(tx, tz);
    // 네 변: [이웃 방향, 변의 두 끝]
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isSea(tx + dx, tz + dz)) continue;
      const ex = x + dx * 0.5, ez = z + dz * 0.5;      // 변 가운데
      const tx_ = -dz, tz_ = dx;                       // 변 방향
      const quad = [[-0.5, W0], [0.5, W0], [0.5 + W1 * 0.6, W1], [-0.5 - W1 * 0.6, W1]];
      const v = quad.map(([s, n]) => [ex + tx_ * s + dx * n, Y, ez + tz_ * s + dz * n]);
      for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(...v[k]); off.push(dx, dz); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 2));
  geo.computeVertexNormals();
  const mat = ctx.materials.toonMaterial('#F4FBFF', { flat: true, name: 'foam' });
  mat.transparent = true;
  mat.opacity = 0.85;
  mat.side = THREE.DoubleSide;           // 변 방향마다 감는 순서가 달라서 양면으로
  mat.depthWrite = false;
  const uWave = { value: 0 };
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    sh.uniforms.uWave = uWave;
    sh.vertexShader = 'attribute vec2 aOff;\nuniform float uWave;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  transformed.xz += aOff * (uWave * 0.16 + sin(position.x * 0.7 + position.z * 0.5) * 0.03);');
  };
  mat.customProgramCacheKey = () => 'curved-foam';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'foam';
  mesh.renderOrder = 1;
  return { mesh, update(t) { uWave.value = 0.5 + 0.5 * Math.sin(t * 0.9); mat.opacity = 0.65 + 0.25 * (1 - uWave.value); } };
}

/** 폭포: 언덕 위 물이 아래 물로 떨어지는 곳에 흐르는 물줄기 판 + 아래 물보라 */
function buildWaterfalls(ctx, gen, island) {
  const group = new THREE.Group();
  group.name = 'waterfalls';
  if (!gen.waterfalls.length) return { group, update() {} };
  // 흰 줄무늬 무늬 (캔버스로 만든다 → 외부 파일 없음)
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const g2 = cv.getContext('2d');
  g2.fillStyle = '#7CC6E2'; g2.fillRect(0, 0, 64, 128);
  const rnd = mulberry32(7);
  for (let i = 0; i < 26; i++) {
    g2.fillStyle = i % 3 ? 'rgba(235,250,255,0.85)' : 'rgba(170,222,240,0.9)';
    const x = rnd() * 64, y = rnd() * 128, ww = 2 + rnd() * 4, hh = 14 + rnd() * 34;
    g2.beginPath(); g2.roundRect(x, y, ww, hh, ww / 2); g2.fill();
    g2.beginPath(); g2.roundRect(x - 64, y, ww, hh, ww / 2); g2.fill();
    g2.beginPath(); g2.roundRect(x, y - 128, ww, hh, ww / 2); g2.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const mat = ctx.materials.toonMaterial('#ffffff', { flat: true, name: 'waterfall' });
  mat.map = tex;
  const foamMat = ctx.materials.toonMaterial('#F4FBFF', { flat: true, name: 'waterfall-foam' });
  // 이어진 폭포 칸을 한 줄로 묶는다
  const rows = new Map();
  for (const f of gen.waterfalls) { const k = f.tz; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(f.tx); }
  const blobs = [];
  for (const [tz, txs] of rows) {
    txs.sort((a, b) => a - b);
    let s = 0;
    for (let i = 1; i <= txs.length; i++) {
      if (i < txs.length && txs[i] === txs[i - 1] + 1) continue;
      const t0 = txs[s], t1 = txs[i - 1], width = t1 - t0 + 1;
      const a = island.toWorld(t0, tz), b = island.toWorld(t1, tz);
      const cx = (a.x + b.x) / 2, ez = a.z + 0.5;
      const top = LEVEL_HEIGHT + WATER_TOP + 0.01, bottom = WATER_TOP;
      // 위에서 살짝 둥글게 넘어가는 물줄기: 세로로 잘게 나눈 판
      const geo = new THREE.PlaneGeometry(width - 0.04, top - bottom + 0.08, 2, 6);
      const pa = geo.attributes.position;
      for (let k = 0; k < pa.count; k++) {
        const yy = Math.min(1, Math.max(0, pa.getY(k) / (top - bottom + 0.08) + 0.5));   // 0 아래 ~ 1 위
        pa.setZ(k, 0.05 + Math.sqrt(1 - yy) * 0.14 - (yy > 0.9 ? (yy - 0.9) * 1.6 : 0));
      }
      geo.computeVertexNormals();
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * width);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(cx, (top + bottom) / 2 - 0.02, ez);
      group.add(m);
      // 물보라 방울
      for (let j = 0; j < width * 3; j++) {
        const s0 = new THREE.Mesh(new THREE.SphereGeometry(0.16 + rnd() * 0.1, 10, 8), foamMat);
        s0.scale.y = 0.55;
        s0.position.set(cx + (j / (width * 3 - 1) - 0.5) * (width - 0.3), WATER_TOP + 0.02, ez + 0.2 + rnd() * 0.2);
        s0.userData.phase = rnd() * 6.28;
        s0.userData.base = s0.position.clone();
        group.add(s0);
        blobs.push(s0);
      }
      s = i;
    }
  }
  return {
    group,
    update(dt, t) {
      tex.offset.y = (t * 1.1) % 1;
      for (const b of blobs) {
        const k = 0.5 + 0.5 * Math.sin(t * 5 + b.userData.phase);
        b.scale.setScalar(0.8 + k * 0.35); b.scale.y *= 0.55;
        b.position.y = b.userData.base.y + k * 0.05;
      }
    },
  };
}
