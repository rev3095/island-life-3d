// 하늘 돔과 별. 카메라를 따라다니고 항상 가장 먼 곳에 그려진다.
// 색은 sRGB 그대로 섞는다 (컨셉 보드 그라데이션과 같은 느낌).
// 2026-11-04 하늘 셰이더: 세 단 그라데이션 + 지평선 안개 띠 · 해 빛무리 + 해 쪽 지평선 노을빛 · 해 둘레 빛살 ·
//   툰 구름층(바람 따라 흐름, 날씨 cover 만큼, 해 쪽 가장자리 빛남, 그늘 면 두 단) · 밤 은하수 · 구름 뒤 별 가림.
// 그리기 비용: 돔은 불투명 물체를 다 그린 뒤(renderOrder 1000) 깊이 시험으로 "아무것도 안 그린 화소"에서만 칠한다
//   (예전엔 화면 전체를 먼저 칠하고 땅이 덮었다). 사양(render/quality.js)에 따라 구름 겹 수·빛살·은하수를 줄인다 (setQuality).
import * as THREE from 'three';

/** 사양별 하늘 셰이더 선택지: oct = 구름 잡음 겹 수, rays = 해 빛살, milky = 은하수 */
export const SKY_QUALITY = {
  high: { oct: 5, rays: true, milky: true },
  mid: { oct: 4, rays: true, milky: true },
  low: { oct: 3, rays: false, milky: true },
  min: { oct: 2, rays: false, milky: false },
};

/** 하늘 모양 값 (조절할 때 여기만). 구름 높이·크기·흐름은 화면에 보이는 하늘 띠(위쪽 1/5 쯤)에 맞춘 값 */
export const SKY_FX = {
  haze: 0.22,          // 지평선 안개 띠 밝기
  sunGlow: 0.16,       // 해 둘레 넓은 빛무리
  sunsetSide: 0.34,    // 노을 때 해 쪽 지평선 빛 (낮엔 0.1 정도로 줄어든다)
  rays: 0.10,          // 해 빛살 세기
  cloudScale: 1.5,     // 구름 무늬 크기 (클수록 잘게)
  cloudSpeed: [0.012, 0.004],   // 구름 흐름 (초당, 하늘 평면 좌표)
  cloudClear: 0.60,    // 맑은 날 구름 문턱 (높을수록 구름이 적다)
  cloudFull: 0.30,     // 흐린 날 구름 문턱
  cloudEdge: 0.07,     // 구름 가장자리 부드러움 (툰은 작게)
  silver: 0.55,        // 해 쪽 구름 가장자리 빛
  shade: 0.75,         // 구름 그늘 면 세기 (0 = 그늘 없는 흰 구름)
  shadeDeep: 0,        // 구름 그늘 색: 0 = 하늘빛·라벤더, 1 = 진한 회청 (입체감)
  gradDeep: 0,         // 하늘 그라데이션: + 천정을 더 진한 파랑으로, − 파스텔로 옅게
  milky: 0.12,         // 은하수 밝기
  starBoost: 1,        // 별 밝기 배율
};

const DOME_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
  gl_Position.z *= 0.99999;   // 맨 끝보다 아주 조금 앞 — 깊이 시험으로 "빈 화소"에만 그린다 (먼 평면에 걸려 잘리지 않게)
}`;

// 색은 sRGB(화면 색)로 섞고 skyOut 으로 내보낸다 → 화면에 바로 그려도, 화면 효과 버퍼(선형)에 그려도 같은 색
const SKY_OUT = /* glsl */ `
vec4 skyOut( vec3 c, float a ) { return linearToOutputTexel( vec4( sRGBTransferEOTF( vec4( c, 1.0 ) ).rgb, a ) ); }
`;

// 돔과 별이 같이 쓰는 구름 모양 (별은 구름 뒤에서 가려진다)
const CLOUD_CORE = /* glsl */ `
uniform float uTime, uCover;
uniform vec2 uCloudSpeed;
uniform float uCloudScale, uCloudClear, uCloudFull, uCloudEdge;
float skyHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float skyNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float a = skyHash( i ), b = skyHash( i + vec2( 1.0, 0.0 ) ), c = skyHash( i + vec2( 0.0, 1.0 ) ), d = skyHash( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
float skyFbm( vec2 p ) {
  float s = 0.0, a = 0.5;
  for ( int i = 0; i < CLOUD_OCT; i++ ) { s += a * skyNoise( p ); p = p * 2.03 + vec2( 1.7, 9.2 ); a *= 0.5; }
  return s / ( 1.0 - pow( 0.5, float( CLOUD_OCT ) ) );   // 겹 수가 달라도 0~1 범위가 같게
}
/** 하늘 방향 → 구름 평면 좌표 (지평선 쪽은 멀리 눌려 보인다) */
vec2 cloudUV( vec3 d ) { return d.xz / ( max( d.y, 0.0 ) + 0.12 ) * uCloudScale + uCloudSpeed * uTime; }
float cloudCut() { return mix( uCloudClear, uCloudFull, uCover ); }
/** 구름 짙기 0~1 (지평선 아래·바로 위는 0) */
float cloudDensity( vec3 d, out float n, out vec2 uv ) {
  uv = cloudUV( d );
  n = skyFbm( uv );
  float c = cloudCut();
  return smoothstep( c, c + uCloudEdge, n ) * smoothstep( 0.02, 0.16, d.y );
}
`;

const DOME_FS = /* glsl */ `${SKY_OUT}
uniform vec3 uZenith, uHorizon, uSunDir, uSunColor, uMoonDir;
uniform float uSunVis, uMoonVis, uGrey, uNight, uGold, uStars;
uniform float uHaze, uSunGlow, uSunsetSide, uRays, uSilver, uMilky, uShade, uShadeDeep, uGradDeep;
varying vec3 vDir;
${CLOUD_CORE}
void main() {
  vec3 d = normalize( vDir );
  float e = d.y;
  // ── 세 단 그라데이션: 지평선 → 가운데 → 천정 ──
  // 천정 색 조절: + 더 진한 파랑, − 파스텔 (uGradDeep)
  vec3 zen = mix( uZenith, uZenith * vec3( 0.62, 0.76, 1.0 ), max( uGradDeep, 0.0 ) );
  zen = mix( zen, mix( uZenith, vec3( 1.0 ), 0.4 ), max( -uGradDeep, 0.0 ) );
  vec3 mid = mix( uHorizon, zen, 0.55 );
  vec3 col = mix( mix( uHorizon, mid, smoothstep( -0.02, 0.22, e ) ), zen, smoothstep( 0.18, 0.8, e ) );
  // 지평선 안개 띠 (낮엔 밝게, 밤엔 옅게)
  col += ( uHorizon * uHaze + 0.03 ) * exp( -abs( e ) * 16.0 ) * ( 1.0 - 0.65 * uNight );

  // ── 해: 빛무리 + 해 쪽 지평선 노을빛 + 둥근 해 ──
  vec3 sd = normalize( uSunDir );
  float s = max( dot( d, sd ), 0.0 );
  vec3 warm = mix( uSunColor, vec3( 1.0, 0.6, 0.44 ), uGold );
  float side = pow( max( dot( normalize( d.xz + 1e-5 ), normalize( sd.xz + 1e-5 ) ), 0.0 ), 3.0 );
  col += warm * side * exp( -max( e, 0.0 ) * 4.5 ) * mix( 0.1, uSunsetSide, uGold ) * uSunVis * ( 1.0 - 0.7 * uGrey );
  col += uSunColor * ( pow( s, 5.0 ) * uSunGlow + pow( s, 36.0 ) * 0.3 + pow( s, 420.0 ) * 0.55 ) * uSunVis;
  col = mix( col, vec3( 1.0, 0.98, 0.9 ), smoothstep( 0.9985, 0.9991, s ) * uSunVis );
#if SKY_RAYS
  // 해 둘레 빛살: 해를 도는 각도로 잡음 → 천천히 바뀌는 살
  vec3 rx = normalize( cross( sd, vec3( 0.0, 1.0, 0.0 ) ) + vec3( 1e-4 ) ), ry = cross( rx, sd );
  float ang = atan( dot( d, rx ), dot( d, ry ) );
  float streak = skyNoise( vec2( ang * 5.0, uTime * 0.04 ) ) * 0.6 + skyNoise( vec2( ang * 13.0, uTime * 0.07 + 3.0 ) ) * 0.4;
  col += warm * pow( s, 3.0 ) * smoothstep( 0.45, 0.85, streak ) * uRays * uSunVis * ( 1.0 - 0.8 * uCover );
#endif

  // ── 달: 크림색 원 + 옅은 빛무리 ──
  float m = max( dot( d, normalize( uMoonDir ) ), 0.0 );
  col += vec3( 0.45, 0.52, 0.8 ) * ( pow( m, 12.0 ) * 0.12 + pow( m, 90.0 ) * 0.3 ) * uMoonVis;
  col = mix( col, vec3( 1.0, 0.97, 0.84 ), smoothstep( 0.99905, 0.99925, m ) * uMoonVis );

#if SKY_MILKY
  // ── 은하수: 기운 큰 원을 따라 얼룩진 띠 (밤에만) ──
  vec3 mwN = normalize( vec3( 0.92, 0.28, 0.12 ) );   // 띠가 카메라가 보는 북쪽 하늘을 비스듬히 지나가게
  float band = exp( -pow( dot( d, mwN ) * 3.6, 2.0 ) );
  col += vec3( 0.58, 0.62, 0.92 ) * band * ( 0.45 + 0.55 * skyNoise( d.xz * 11.0 + d.y * 7.0 ) ) * uMilky * uStars;
#endif

  // ── 툰 구름층 ──
  float n; vec2 uv;
  float dens = cloudDensity( d, n, uv );
  if ( dens > 0.001 ) {
    // 해 쪽으로 조금 옮겨 본 짙기와 비교 → 해 반대쪽이 그늘 (두 단)
    float toward = skyFbm( uv - normalize( sd.xz + 1e-5 ) * 0.22 );
    float shade = step( 0.035, n - toward );
    vec3 cLit = mix( vec3( 1.0, 0.99, 0.96 ), warm * 1.05 + 0.08, uGold * 0.55 );
    // 그늘 면: 잿빛 대신 하늘빛이 비친 옅은 하늘색·라벤더 (노을엔 지평선 색이 섞여 분홍빛)
    vec3 cShade = mix( vec3( 0.84, 0.88, 0.97 ), mix( uZenith, uHorizon, 0.45 + 0.35 * uGold ), 0.38 + 0.2 * uGold );
    cShade = mix( cShade, vec3( 0.52, 0.58, 0.72 ) * mix( vec3( 1.0 ), uHorizon * 1.2, 0.3 * uGold ), uShadeDeep );   // 진한 회청 (입체감)
    vec3 cc = mix( cLit, cShade, shade * uShade );
    // 해 쪽 가장자리 빛 (은빛 테두리)
    cc += warm * dens * ( 1.0 - dens ) * 4.0 * pow( s, 4.0 ) * uSilver * uSunVis;
    // 흐린 날 잿빛, 밤엔 어둡고 푸른 구름 (달 쪽 테두리만 옅게)
    cc = mix( cc, vec3( dot( cc, vec3( 0.3, 0.59, 0.11 ) ) ) * 0.88, uGrey );
    cc = mix( cc, uZenith * 1.35 + 0.04 + vec3( 0.2, 0.22, 0.3 ) * pow( m, 6.0 ) * uMoonVis, uNight * 0.85 );
    col = mix( col, cc, dens * 0.95 );
  }
  gl_FragColor = skyOut( col, 1.0 );
}`;

const STAR_VS = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uAlpha, uPixel;
varying float vAlpha;
${CLOUD_CORE}
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
  gl_Position.z *= 0.99999;
  float tw = 0.65 + 0.35 * sin(uTime * (1.3 + aPhase) + aPhase * 17.0);
  gl_PointSize = aSize * uPixel * (0.8 + 0.4 * tw);
  // 지평선 가까운 별은 옅게, 구름 뒤 별은 가린다
  vec3 d = normalize(position);
  float n; vec2 uv;
  vAlpha = uAlpha * tw * smoothstep(0.0, 0.12, d.y) * (1.0 - cloudDensity(d, n, uv));
}`;

const STAR_FS = /* glsl */ `${SKY_OUT}
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = skyOut(vec3(1.0, 0.97, 0.85), min(1.0, a * 1.4));
}`;

/** 셰이더 선택지 → material.defines */
const definesFor = q => {
  const c = SKY_QUALITY[q] ?? SKY_QUALITY.mid;
  return { CLOUD_OCT: c.oct, SKY_RAYS: c.rays ? 1 : 0, SKY_MILKY: c.milky ? 1 : 0 };
};

export function createDome({ quality = 'mid' } = {}) {
  const v3 = () => ({ value: new THREE.Vector3() });
  const f = v => ({ value: v });
  // 구름 값은 돔·별이 같은 객체를 나눠 쓴다 (별이 구름 뒤에서 가려지게)
  const cloudU = {
    uTime: f(0), uCover: f(0), uCloudSpeed: { value: new THREE.Vector2(...SKY_FX.cloudSpeed) },
    uCloudScale: f(SKY_FX.cloudScale), uCloudClear: f(SKY_FX.cloudClear), uCloudFull: f(SKY_FX.cloudFull), uCloudEdge: f(SKY_FX.cloudEdge),
  };
  const uniforms = {
    ...cloudU,
    uZenith: v3(), uHorizon: v3(), uSunDir: v3(), uSunColor: v3(), uMoonDir: v3(), uSunVis: f(0), uMoonVis: f(0),
    uGrey: f(0), uNight: f(0), uGold: f(0), uStars: f(0),
    uHaze: f(SKY_FX.haze), uSunGlow: f(SKY_FX.sunGlow), uSunsetSide: f(SKY_FX.sunsetSide), uRays: f(SKY_FX.rays), uSilver: f(SKY_FX.silver), uMilky: f(SKY_FX.milky),
    uShade: f(SKY_FX.shade), uShadeDeep: f(SKY_FX.shadeDeep), uGradDeep: f(SKY_FX.gradDeep),
  };
  const domeMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: DOME_VS, fragmentShader: DOME_FS, defines: definesFor(quality),
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), domeMat);
  dome.name = 'sky-dome';
  dome.scale.setScalar(120);
  dome.frustumCulled = false;
  dome.renderOrder = 1000;          // 불투명 물체 다 그린 뒤 → 빈 화소만 칠한다
  dome.matrixAutoUpdate = true;

  // 별 1400개: 위쪽 반구에 흩뿌린다 (시드 고정). 카메라 시야가 좁아(32°) 넉넉히.
  const N = 1400;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const y = 0.02 + Math.pow(rnd(), 1.3) * 0.98, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 110, y * 110, Math.sin(a) * r * 110], i * 3);
    size[i] = rnd() < 0.1 ? 4.2 : 2.0 + rnd() * 1.6;
    phase[i] = rnd();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const starU = { ...cloudU, uAlpha: f(0), uPixel: f(1) };
  const starMat = new THREE.ShaderMaterial({
    uniforms: starU, vertexShader: STAR_VS, fragmentShader: STAR_FS, defines: definesFor(quality),
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.name = 'sky-stars';
  stars.frustumCulled = false;
  stars.renderOrder = -99;

  const group = new THREE.Group();
  group.name = 'sky';
  group.add(dome, stars);
  let q = quality;
  // 구름 시간: sky 의 time 은 2000초마다 돌아가므로(반짝임용) 따로 이어 센다 → 구름이 갑자기 튀지 않게 (10만 초마다 한 번)
  let lastTime = null, cloudTime = 0;

  return {
    group,
    starPoints: stars,   // 요청 8: 별자리 별(stars.js)이 이 재질을 나눠 쓰고 자식으로 달린다
    get quality() { return q; },
    /** 하늘 모양 값 바꾸기 { haze, sunGlow, … } (SKY_FX 이름) — uniform 만 바꾼다. 돌려주는 값 = 지금 값 */
    setFx(v = {}) {
      const map = { haze: 'uHaze', sunGlow: 'uSunGlow', sunsetSide: 'uSunsetSide', rays: 'uRays', silver: 'uSilver', milky: 'uMilky',
        shade: 'uShade', shadeDeep: 'uShadeDeep', gradDeep: 'uGradDeep', cloudScale: 'uCloudScale', cloudClear: 'uCloudClear', cloudFull: 'uCloudFull', cloudEdge: 'uCloudEdge' };
      for (const [k, u] of Object.entries(map)) if (typeof v[k] === 'number') uniforms[u].value = v[k];
      if (Array.isArray(v.cloudSpeed)) cloudU.uCloudSpeed.value.set(v.cloudSpeed[0], v.cloudSpeed[1]);
      if (typeof v.starBoost === 'number') SKY_FX.starBoost = v.starBoost;
      return Object.fromEntries([...Object.entries(map).map(([k, u]) => [k, uniforms[u].value]), ['cloudSpeed', cloudU.uCloudSpeed.value.toArray()], ['starBoost', SKY_FX.starBoost]]);
    },
    /** 사양이 바뀌면 (render/quality.js 이름) — 셰이더를 다시 만든다 */
    setQuality(next) {
      if (!SKY_QUALITY[next] || next === q) return;
      q = next;
      for (const m of [domeMat, starMat]) { m.defines = definesFor(q); m.needsUpdate = true; }
    },
    /**
     * look: skyLook() 결과. wx: { cover 구름 0~1, grey 잿빛 0~1, night 밤 0~1 }
     */
    update(look, camera, time, pixelRatio, { cover = 0, grey = 0, night = 0 } = {}) {
      group.position.copy(camera.position);
      uniforms.uZenith.value.fromArray(look.zenith);
      uniforms.uHorizon.value.fromArray(look.horizon);
      uniforms.uSunDir.value.fromArray(look.sunSky);
      uniforms.uSunColor.value.fromArray(look.sunDisc);
      uniforms.uSunVis.value = look.sunVis;
      uniforms.uMoonDir.value.fromArray(look.moonSky);
      uniforms.uMoonVis.value = look.moonVis;
      uniforms.uGold.value = Math.min(1, (look.weights?.dawn ?? 0) + (look.weights?.dusk ?? 0));   // 노을·새벽빛
      uniforms.uStars.value = look.stars;
      if (lastTime !== null) cloudTime = (cloudTime + ((time - lastTime + 2000) % 2000)) % 1e5;
      lastTime = time;
      cloudU.uTime.value = cloudTime;
      cloudU.uCover.value = cover;
      uniforms.uGrey.value = grey;
      uniforms.uNight.value = night;
      starU.uAlpha.value = Math.min(1.6, look.stars * SKY_FX.starBoost);
      starU.uPixel.value = pixelRatio;
      stars.visible = look.stars > 0.01;
    },
  };
}
