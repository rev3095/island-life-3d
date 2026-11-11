// 해안선 다듬기: 타일 계단 모양 바닷가를 부드러운 모래 비탈 + 물가 거품 띠 + 밀려오는 물결로.
// 모델(타일)은 그대로 두고, 그 둘레 바다 칸에만 '모래 앞치마' 판을 깔고 바다 셰이더가 해안 거리로 색·거품·물결을 그린다.
//  1. 땅(바다·강물이 아닌 칸) 가면을 4배 촘촘한 격자에서 흐리게 → 문턱 THETA 의 등고선 = 부드러운 해안선 (튀어나온 모서리까지 감싼다)
//  2. 그 등고선에서 바깥으로의 거리(칸) → 반 float 텍스처 (R = 거리, G = 강물 가까움)
//  3. 앞치마 판: 바다 칸 안에서 거리 0 이면 모래 윗면 높이, 바깥으로 갈수록 내려가 바다 밑으로 → 물가 선이 부드러운 곡선이 된다
//  4. 바다 셰이더 (terrain.js 의 buildSea 가 patchSea 로 건다): 얕은 물빛, 물가 거품(밀려왔다 빠짐), 해안으로 오는 물결 줄, 잔잔한 오르내림
import * as THREE from 'three';
import { KIND } from './island.js';
import { coastField, apronY, waterlineD, R, M, APRON } from './coastfield.js';

export { coastField, apronY, waterlineD };

/**
 * 해안 만들기 → { field, texture, apron (Mesh), uniforms, waterline }
 * sand: 모래 팔레트 { sand, sandDark }
 */
export function buildCoast(ctx, gen, sand, seaY) {
  const field = coastField(gen);
  const { NX, NZ, x0, z0, d } = field;
  const { w, h } = gen;

  // 텍스처 (R = 해안 거리, G = 강물 가까움) — 반 float, 선형 보간
  const data = new Uint16Array(NX * NZ * 2);
  for (let c = 0; c < NX * NZ; c++) {
    data[c * 2] = THREE.DataUtils.toHalfFloat(d[c]);
    data[c * 2 + 1] = THREE.DataUtils.toHalfFloat(Math.min(1, field.river[c] * 2.5));
  }
  const texture = new THREE.DataTexture(data, NX, NZ, THREE.RGFormat, THREE.HalfFloatType);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  // 앞치마 판: 바다 칸 안의 격자 칸 중 해안선에서 APRON 안쪽인 것만. 꼭짓점 = 격자 꼭짓점 (둘레 네 칸 평균 거리)
  const NXv = NX + 1;
  const nodeD = (i, j) => {
    const ii = [Math.max(0, i - 1), Math.min(NX - 1, i)], jj = [Math.max(0, j - 1), Math.min(NZ - 1, j)];
    return (d[jj[0] * NX + ii[0]] + d[jj[0] * NX + ii[1]] + d[jj[1] * NX + ii[0]] + d[jj[1] * NX + ii[1]]) / 4;
  };
  const isSeaTile = (tx, tz) => tx < 0 || tz < 0 || tx >= w || tz >= h || gen.kind[tz * w + tx] === KIND.SEA;
  const index = new Map(), pos = [], col = [], idx = [];
  const cDry = new THREE.Color(sand.sand ?? '#F1DFAE'), cWet = new THREE.Color(sand.sandDark ?? '#DDC690').lerp(new THREE.Color('#B9A57E'), 0.35), cc = new THREE.Color();
  const wl = waterlineD(seaY);
  const vert = (i, j) => {
    const key = j * NXv + i;
    if (index.has(key)) return index.get(key);
    const dd = nodeD(i, j);
    pos.push(x0 + i / R, apronY(dd), z0 + j / R);
    cc.copy(cDry).lerp(cWet, THREE.MathUtils.smoothstep(dd, 0.04, wl * 0.95));
    col.push(cc.r, cc.g, cc.b);
    index.set(key, pos.length / 3 - 1);
    return pos.length / 3 - 1;
  };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const tx = Math.floor(i / R) - M, tz = Math.floor(j / R) - M;
    if (!isSeaTile(tx, tz)) continue;
    const m = Math.min(d[j * NX + i], nodeD(i, j), nodeD(i + 1, j), nodeD(i, j + 1), nodeD(i + 1, j + 1));
    if (m > APRON) continue;
    const a = vert(i, j), b = vert(i + 1, j), c2 = vert(i + 1, j + 1), e = vert(i, j + 1);
    idx.push(a, e, b, b, e, c2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  // 이름 'ground': 비 오면 sky 가 젖은 색으로, 붓질 무늬도 땅 타일과 같은 월드 좌표 무늬
  const mat = ctx.materials.toonMaterial('#ffffff', { name: 'ground' });
  mat.vertexColors = true;
  const apron = new THREE.Mesh(geo, mat);
  apron.name = 'coast-apron';
  apron.receiveShadow = true;

  const uniforms = {
    uCoast: { value: texture },
    uCoastBox: { value: new THREE.Vector4(x0, z0, NX / R, NZ / R) },   // 텍스처가 덮는 월드 네모 (x0, z0, 가로, 세로)
    uSeaTime: { value: 0 },
    uWaterline: { value: wl },
  };
  return { field, texture, apron, uniforms, waterline: wl, tris: idx.length / 3 };
}

// ── 바다 셰이더 덧씌우기 ──
const SEA_VERT_PARS = /* glsl */ `
uniform sampler2D uCoast;
uniform vec4 uCoastBox;
uniform float uSeaTime;
varying vec2 vCoastXZ;
`;
// 잔잔한 오르내림: 바다 판을 아래로만 내렸다 올린다 (강물 칸보다 높아지면 강 안에 바다가 비친다) → 물가 선이 비탈을 따라 오르내린다
const SEA_VERT = /* glsl */ `
{
  vec4 cw = modelMatrix * vec4( transformed, 1.0 );
  vCoastXZ = cw.xz;
  vec2 cuv = ( cw.xz - uCoastBox.xy ) / uCoastBox.zw;
  vec2 cf = texture2D( uCoast, cuv ).rg;
  float near = 1.0 - smoothstep( 2.5, 6.0, cf.r );
  float wave = 0.5 + 0.5 * sin( uSeaTime * 1.15 - cf.r * 1.7 + cw.x * 0.05 );
  transformed.y -= 0.075 * wave * near * ( 1.0 - cf.g );
}
`;
const SEA_FRAG_PARS = /* glsl */ `
uniform sampler2D uCoast;
uniform vec4 uCoastBox;
uniform float uSeaTime, uWaterline;
uniform vec3 uShallow, uFoam;
varying vec2 vCoastXZ;
float coastHash( vec2 p ) { p = fract( p * vec2( 0.1031, 0.1030 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }
float coastNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( coastHash( i ), coastHash( i + vec2( 1, 0 ) ), f.x ), mix( coastHash( i + vec2( 0, 1 ) ), coastHash( i + vec2( 1, 1 ) ), f.x ), f.y );
}
`;
// color_fragment 뒤: 얕은 물빛 → 물가 거품 → 해안으로 오는 물결 줄 (모두 조명 전 바탕색이라 그늘·밤에 맞게 어두워진다)
const SEA_FRAG = /* glsl */ `
{
  vec2 cuv = ( vCoastXZ - uCoastBox.xy ) / uCoastBox.zw;
  float cd = texture2D( uCoast, cuv ).r;
  float aa = max( fwidth( cd ), 1e-4 );
  // 얕은 물: 해안선 가까이 밝은 청록 → 바깥 꼭짓점 색(깊은 물)
  diffuseColor.rgb = mix( uShallow, diffuseColor.rgb, smoothstep( uWaterline, uWaterline + 2.6, cd ) );
  // D136 물 빛 그물 (카우스틱): 얕은 물(물가 2칸 안)만, 구름 그림자 잡음 그림을 두 방향으로 흘려 겹친 곳이 밝은 그물. 사양 낮음 아래는 uCaustic 0 → 건너뜀
  #ifdef STYLE_FX_CAUSTIC
  if ( uCaustic > 0.0 ) {
    float csh = 1.0 - smoothstep( uWaterline + 0.3, uWaterline + 2.2, cd );
    if ( csh > 0.0 ) {
      // 갈래 안이라 texture2D·fwidth 대신 textureLod (materials.js styleLod — 갈래가 펴지지 않게)
      vec2 cq = vCoastXZ * 0.17;
      float clod = styleLod( length( vViewPosition ), 0.23 );
      float c1 = textureLod( uCloudTex, cq + vec2( uSeaTime * 0.012, uSeaTime * 0.007 ), clod ).r;
      float c2 = textureLod( uCloudTex, cq * 1.37 + vec2( 0.37 - uSeaTime * 0.010, 0.11 + uSeaTime * 0.013 ), clod ).r;
      float cdv = abs( c1 - c2 );
      float cw = 1.0 - smoothstep( 0.0, 0.035 + clod * 0.02, cdv );
      diffuseColor.rgb += cw * csh * uCaustic * 0.32;
    }
  }
  #endif
  float n = coastNoise( vCoastXZ * 1.3 + vec2( uSeaTime * 0.07, -uSeaTime * 0.05 ) );
  // 물가 거품: 물가 선에서 밀려왔다 빠지는 흰 띠 (자리마다 박자가 조금씩 다르다)
  float ph = uSeaTime * 0.95 + vCoastXZ.x * 0.21 + vCoastXZ.y * 0.17;
  float reach = uWaterline + 0.1 + 0.22 * ( 0.5 + 0.5 * sin( ph ) ) + ( n - 0.5 ) * 0.12;
  float foam = 1.0 - smoothstep( reach - aa, reach + aa * 1.5, cd );
  // 거품 띠 바깥 가장자리 한 줄 더 (빠질 때 남는 거품 자국)
  float trail = reach + 0.16 + 0.05 * sin( ph * 0.5 );
  foam = max( foam, ( 1.0 - smoothstep( 0.02, 0.02 + aa * 1.5, abs( cd - trail ) ) ) * 0.55 * smoothstep( 0.35, 0.65, n ) );
  // 해안으로 밀려오는 물결 줄: 거리 등고선을 따라 안쪽으로 움직이고, 멀수록·물가 가까울수록 옅게, 군데군데 끊긴다
  float rp = cd * 0.62 + uSeaTime * 0.16;
  float rf = fract( rp );
  float ring = smoothstep( 0.0, aa * 0.62 + 0.012, rf ) * ( 1.0 - smoothstep( 0.035, 0.035 + aa * 0.62 + 0.02, rf ) );
  float seg = smoothstep( 0.42, 0.62, coastNoise( vCoastXZ * 0.55 + floor( rp ) * 7.31 ) );
  ring *= seg * smoothstep( uWaterline + 0.35, uWaterline + 0.9, cd ) * ( 1.0 - smoothstep( 1.6, 3.4, cd ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, uFoam, clamp( foam * 0.92 + ring * 0.55, 0.0, 1.0 ) );
}
`;

/** 바다 재질(toonMaterial 'sea')에 해안 효과를 덧씌운다. W4 스타일 패치(물결 반짝임 등)는 그대로 먼저 돈다 */
export function patchSea(mat, coast, { shallow = '#A6DCEA', foam = '#F4FBFF' } = {}) {
  const u = { ...coast.uniforms, uShallow: { value: new THREE.Color(shallow) }, uFoam: { value: new THREE.Color(foam) } };
  const base = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey;   // 그때그때 읽는다 (셰이더 등급이 사양 따라 바뀜)
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = SEA_VERT_PARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SEA_VERT);
    sh.fragmentShader = SEA_FRAG_PARS + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + SEA_FRAG);
  };
  mat.customProgramCacheKey = () => baseKey.call(mat) + '-coast';
  return u;
}
