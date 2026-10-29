// 강 둑·풀/모래 경계 다듬기: 타일 계단 모양을 해안선처럼 부드럽게. 모델(타일)은 그대로 둔다. 거리장 계산은 banksfield.js.
//  1. 둑 앞치마: 강물 칸 안에 땅 윗면 높이의 판을 깔고, 부드러운 등고선에서 흙 비탈로 물 밑까지 내린다
//     → 물 칸 모서리가 둥글게 메워지고, 강이 한 칸 꺾이는 곳의 계단이 곡선이 된다. 윗면 색 = 붙은 땅(풀·모래·길·광장).
//  2. 물가 거품: 둑이 물에 잠기는 선을 따라 물 위에 얇은 거품 띠 (밀려왔다 빠지고 군데군데 끊긴다). 잘라 내기(discard)만 써서 정렬 없음.
//  3. 풀/모래: 땅 타일이 함께 쓰는 'ground' 재질에 '모래 정도' 텍스처로 경계를 곡선으로 다시 칠한다.
//     풀 타일의 풀 술·모래 타일의 점은 경계 반대편이면 지운다 (판 꼭짓점 속성 aGround: 1 윗면 · 2 풀 술 · 3 모래 점).
import * as THREE from 'three';
import { riverBanks, groundBlend, bankY, bankWaterline, BANK } from './banksfield.js';
import { KIND, LEVEL_HEIGHT, WATER_TOP } from './island.js';

const NOISE = /* glsl */ `
float bankHash( vec2 p ) { p = fract( p * vec2( 0.1031, 0.1030 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }
float bankNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( bankHash( i ), bankHash( i + vec2( 1, 0 ) ), f.x ), mix( bankHash( i + vec2( 0, 1 ) ), bankHash( i + vec2( 1, 1 ) ), f.x ), f.y );
}
`;

/** 재질 셰이더에 덧붙이기 (원래 onBeforeCompile 다음에) */
function extend(mat, key, fn) {
  const base = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => { base.call(mat, sh, r); fn(sh); };
  mat.customProgramCacheKey = () => `${baseKey}-${key}`;
}

/**
 * colors: { grass, sand, path, plaza, dirt } (hex), time: { value } (초, 해안과 같은 시계)
 * → { mesh(둑 앞치마), foam(물가 거품), patchGround(mat), markGround(tpl, kind), setGrass(hex), stats }
 */
export function buildBanks(ctx, gen, colors, time) {
  const levels = riverBanks(gen);
  const wl = bankWaterline(WATER_TOP);
  const col = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, new THREE.Color(v)]));
  const landColor = k => (k === KIND.SAND ? col.sand : k === KIND.PATH ? col.path : k === KIND.PLAZA ? col.plaza : col.grass);

  // ── 둑 앞치마 + 거품 띠 판 (층마다 격자 꼭짓점) ──
  const pos = [], cols = [], idx = [], kinds = [], tops = [];
  const fpos = [], fd = [], fidx = [];
  const cc = new THREE.Color();
  for (const L of levels) {
    const { NX, NZ, R, x0, z0, d } = L;
    const NXv = NX + 1, vmap = new Map(), fmap = new Map();
    const baseY = L.level * LEVEL_HEIGHT;
    const vert = (i, j) => {
      const key = j * NXv + i;
      if (vmap.has(key)) return vmap.get(key);
      const dd = L.nodeD(i, j), k = L.landAt(i, j);
      // 윗면 → 흙 비탈 (물가 선 조금 위에서 다 흙)
      const top = 1 - THREE.MathUtils.smoothstep(dd, 0.0, wl * 0.6);
      pos.push(x0 + i / R, baseY + bankY(dd), z0 + j / R);
      cc.copy(col.dirt).lerp(landColor(k), top);
      cols.push(cc.r, cc.g, cc.b);
      kinds.push(k); tops.push(top);
      vmap.set(key, pos.length / 3 - 1);
      return pos.length / 3 - 1;
    };
    const fvert = (i, j) => {
      const key = j * NXv + i;
      if (fmap.has(key)) return fmap.get(key);
      fpos.push(x0 + i / R, baseY + WATER_TOP + 0.007, z0 + j / R);
      fd.push(L.nodeD(i, j) - wl);
      fmap.set(key, fpos.length / 3 - 1);
      return fpos.length / 3 - 1;
    };
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      if (!L.inWater(i, j)) continue;
      const ds = [L.nodeD(i, j), L.nodeD(i + 1, j), L.nodeD(i, j + 1), L.nodeD(i + 1, j + 1)];
      const lo = Math.min(d[j * NX + i], ...ds), hi = Math.max(...ds);
      if (lo < BANK.REACH && hi > -0.99) {
        // 다 물 밑이면 깔 필요 없다 (물 윗면보다 한참 아래)
        if (lo < BANK.W + 0.02) {
          const a = vert(i, j), b = vert(i + 1, j), c2 = vert(i + 1, j + 1), e = vert(i, j + 1);
          idx.push(a, e, b, b, e, c2);
        }
      }
      // 거품: 물가 선 바로 밖 (물 위로 보이는 쪽)
      if (hi > wl - 0.03 && lo < wl + 0.3) {
        const a = fvert(i, j), b = fvert(i + 1, j), c2 = fvert(i + 1, j + 1), e = fvert(i, j + 1);
        fidx.push(a, e, b, b, e, c2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  // 이름 'ground': 비 오면 sky 가 젖은 색으로, 붓질 무늬도 땅 타일과 같은 월드 좌표 무늬
  const mat = ctx.materials.toonMaterial('#ffffff', { name: 'ground' });
  mat.vertexColors = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'river-banks';
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;

  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  fgeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(fpos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  fgeo.setAttribute('aBankD', new THREE.Float32BufferAttribute(fd, 1));
  fgeo.setIndex(fidx);
  fgeo.computeBoundingSphere();
  const fmat = ctx.materials.toonMaterial(colors.foam ?? '#F4FBFF', { name: 'foam' });
  extend(fmat, 'riverfoam', sh => {
    sh.uniforms.uBankTime = time;
    sh.vertexShader = 'attribute float aBankD;\nvarying float vBankD;\nvarying vec2 vBankXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vBankD = aBankD;\n  vBankXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;');
    sh.fragmentShader = `uniform float uBankTime;\nvarying float vBankD;\nvarying vec2 vBankXZ;\n${NOISE}` + sh.fragmentShader.replace('#include <clipping_planes_fragment>', /* glsl */ `#include <clipping_planes_fragment>
{
  // 물가 선(0)에서 물 쪽으로: 밀려왔다 빠지는 거품 띠 + 바깥에 끊긴 거품 자국
  float aa = max( fwidth( vBankD ), 1e-4 );
  float ph = uBankTime * 1.25 + vBankXZ.x * 0.9 + vBankXZ.y * 0.7;
  float n = bankNoise( vBankXZ * 2.6 + vec2( uBankTime * 0.22, uBankTime * 0.15 ) );
  float reach = 0.035 + 0.035 * ( 0.5 + 0.5 * sin( ph ) ) + ( n - 0.5 ) * 0.05;
  float foam = 1.0 - smoothstep( reach - aa, reach + aa, vBankD );
  float trail = reach + 0.07 + 0.02 * sin( ph * 0.6 );
  foam = max( foam, ( 1.0 - smoothstep( 0.012, 0.012 + aa * 1.5, abs( vBankD - trail ) ) ) * step( 0.55, n ) );
  if ( foam < 0.5 ) discard;
}`);
  });
  const foam = new THREE.Mesh(fgeo, fmat);
  foam.name = 'river-foam';
  foam.receiveShadow = true;
  foam.renderOrder = 1;

  // ── 풀/모래 경계 ──
  const blend = groundBlend(gen);
  const tex = new THREE.DataTexture(blend.s, blend.NX, blend.NZ, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const gu = {
    uGroundTex: { value: tex },
    uGroundBox: { value: new THREE.Vector4(blend.x0, blend.z0, blend.NX / blend.R, blend.NZ / blend.R) },
    uGroundGrass: { value: col.grass.clone() },
    uGroundSand: { value: col.sand.clone() },
  };
  /** 땅 타일이 함께 쓰는 'ground' 재질에 경계 다시 칠하기를 건다 (aGround 가 없는 타일 = 길·광장·절벽은 그대로) */
  function patchGround(m) {
    if (m.userData.groundBlend) return;
    m.userData.groundBlend = true;
    m.defaultAttributeValues = { ...m.defaultAttributeValues, aGround: [0] };
    extend(m, 'groundblend', sh => {
      Object.assign(sh.uniforms, gu);
      sh.vertexShader = 'attribute float aGround;\nvarying float vGround;\nvarying vec2 vGroundXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
  vGround = aGround;
  {
    vec4 gw = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      gw = instanceMatrix * gw;
    #endif
    vGroundXZ = ( modelMatrix * gw ).xz;
  }`);
      sh.fragmentShader = `uniform sampler2D uGroundTex;\nuniform vec4 uGroundBox;\nuniform vec3 uGroundGrass, uGroundSand;\nvarying float vGround;\nvarying vec2 vGroundXZ;\n${NOISE}`
        + sh.fragmentShader.replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
if ( vGround > 0.5 ) {
  float gs = texture2D( uGroundTex, ( vGroundXZ - uGroundBox.xy ) / uGroundBox.zw ).r;
  if ( gs > 0.01 && gs < 0.99 ) {
    // 0.5 등고선을 잔물결처럼 흔든다 (자로 그은 곡선이 아니게)
    float e = gs - 0.5 + ( bankNoise( vGroundXZ * 2.3 ) - 0.5 ) * 0.24 + ( bankNoise( vGroundXZ * 6.1 + 4.7 ) - 0.5 ) * 0.07;
    float aw = fwidth( e ) * 0.75 + 0.003;
    float t = smoothstep( -aw, aw, e );          // 1 = 모래
    if ( vGround > 2.5 ) { if ( t < 0.5 ) discard; }        // 모래 점이 풀 쪽에
    else if ( vGround > 1.5 ) { if ( t > 0.5 ) discard; }   // 풀 술이 모래 쪽에
    else diffuseColor.rgb = diffuse * mix( uGroundGrass, uGroundSand, t );
  }
}`);
    });
  }
  /** 땅 판(풀·모래)에 aGround 꼭짓점 속성 (재질 이름 범위로: 윗면 1, 풀 술 2, 모래 점 3, 흙·옆면 0). 묶음을 만들기 전에 부른다 */
  function markGround(tpl, kind) {
    for (const part of tpl.parts) {
      if (part.type !== 'toon') continue;
      const p = part.geometry.attributes.position, a = new Float32Array(p.count);
      for (const r of part.ranges) {
        for (let i = r.start; i < r.start + r.count; i++) {
          if (r.name === 'grass' || r.name === 'sand') a[i] = 1;
          else if (r.name === 'grassDark' && kind === KIND.GRASS) a[i] = 2;
          else if (r.name === 'sandDark' && kind === KIND.SAND && p.getY(i) > -0.008) a[i] = 3;
        }
      }
      part.geometry.setAttribute('aGround', new THREE.BufferAttribute(a, 1));
      patchGround(part.material);
    }
  }
  /** 계절: 풀 색 (경계 셰이더 · 둑 윗면) */
  function setGrass(hex) {
    col.grass.set(hex);
    gu.uGroundGrass.value.set(hex);
    const c = geo.attributes.color;
    for (let i = 0; i < kinds.length; i++) {
      if (kinds[i] !== KIND.GRASS) continue;
      cc.copy(col.dirt).lerp(col.grass, tops[i]);
      c.setXYZ(i, cc.r, cc.g, cc.b);
    }
    c.needsUpdate = true;
  }
  /** 월드 (x, z) 가 강물 칸이면 보이는 물가 선에서 물 쪽으로의 거리 (칸, 둑 위면 < 0), 강물 칸이 아니면 null */
  function riverDistance(x, z) {
    const tx = Math.floor(x + gen.w / 2), tz = Math.floor(z + gen.h / 2);
    if (tx < 0 || tz < 0 || tx >= gen.w || tz >= gen.h || gen.kind[tz * gen.w + tx] !== KIND.WATER) return null;
    const L = levels.find(l => l.level === gen.level[tz * gen.w + tx]);
    if (!L) return null;
    const fi = (x - L.x0) * L.R - 0.5, fj = (z - L.z0) * L.R - 0.5;
    const i = Math.max(0, Math.min(L.NX - 2, Math.floor(fi))), j = Math.max(0, Math.min(L.NZ - 2, Math.floor(fj)));
    const u = Math.min(1, Math.max(0, fi - i)), t = Math.min(1, Math.max(0, fj - j)), c = j * L.NX + i, d = L.d;
    return (d[c] * (1 - u) + d[c + 1] * u) * (1 - t) + (d[c + L.NX] * (1 - u) + d[c + L.NX + 1] * u) * t - wl;
  }
  return {
    mesh, foam, patchGround, markGround, setGrass, riverDistance, waterline: wl,
    stats: { levels: levels.length, bankTris: idx.length / 3, foamTris: fidx.length / 3 },
  };
}
