// 툰 재질 · 외곽선 · 곡면 월드. 게임 안의 모든 3D 모델은 여기서 만든 재질을 쓴다.
// 곡면 월드: 화면 중심(플레이어)에서 앞뒤(Z)로 멀어질수록 땅이 아래로 휘어 "굴러가는 통나무" 위에 있는 느낌을 낸다.
// 그림자 조회는 휘기 전 좌표(worldPosition)를 쓰므로 그림자 위치는 어긋나지 않는다.
// 스타일 셰이더(동숲풍): 명암 띠·그늘 색·가장자리 빛·장난감 하이라이트·바람·물결은 모두 아래 `look` 값(uniform)으로 움직인다.
// 값을 바꿔도 셰이더를 다시 만들지 않는다 → 프리셋(src/render/presets.js)을 실시간으로 바꿔 끼울 수 있다. 자세한 설명: docs/SHADERS.md
import * as THREE from 'three';

export const curve = {
  uCurve: { value: 0.0016 },              // 0 이면 평평한 세상
  uCurveOrigin: { value: new THREE.Vector3() },
};

/** 모든 스타일 재질이 함께 쓰는 값. 기본값 = 예전 2단 툰 모습 (src/render 가 프리셋으로 바꾼다) */
export const look = {
  uStyleTime: { value: 0 },
  // 명암 띠: 띠 수 · 띠 경계 부드러움 · 그늘 쪽 밝기 · 감싸는 빛(0 = 램버트, 1 = 반대편까지) · 드리운 그림자 진하기(1 = 예전처럼 햇빛 0)
  uBands: { value: 2 }, uBandSoft: { value: 0 }, uShadeFloor: { value: 168 / 255 }, uWrap: { value: 1 }, uCastDark: { value: 1 },
  // 색조: 그늘(하늘빛·그림자)에 곱하는 색, 햇빛에 곱하는 색, 그늘 채도
  uShadeTint: { value: new THREE.Color(1, 1, 1) }, uLitTint: { value: new THREE.Color(1, 1, 1) }, uShadeSat: { value: 0 },
  // 가장자리 빛(림): 배경 물체 · 캐릭터 · 날카로움
  uRim: { value: 0 }, uRimChar: { value: 0 }, uRimPower: { value: 3 },
  // 장난감 하이라이트 (부리·껍데기·쇠·유리): 세기 · 크기(0~1)
  uSpec: { value: 0 }, uSpecSize: { value: 0.5 },
  // 붓질 색 흔들림 (월드 좌표 저주파 무늬): 세기 · 무늬 크기
  uPaint: { value: 0 }, uPaintScale: { value: 0.35 },
  // 가짜 접촉 그늘: 물체 바닥(원점) 가까운 옆면을 어둡게. 세기 · 높이
  uAO: { value: 0 }, uAOHeight: { value: 0.45 },
  // 바람 (잎·풀·꽃잎): 세기 · 빠르기
  uWind: { value: 0 }, uWindSpeed: { value: 1 },
  // 물결 반짝임 (sea·water·waterLight·waterfall): 세기 · 무늬 크기
  uWater: { value: 0 }, uWaterScale: { value: 1 },
  // 스스로 빛나기 (불꽃·반딧불·반짝이): 0 = 예전 색 그대로, 클수록 밝아져 빛 번짐이 걸린다
  uGlow: { value: 0 },
  // 외곽선: 굵기 배율 · 바탕색 섞기(0 = 갈색 잉크, 1 = 물체 색을 어둡게) · 어둡게 하는 정도
  uOutlineScale: { value: 1 }, uOutlineTint: { value: 0 }, uOutlineDark: { value: 0.55 },
  uOutlineFallback: { value: new THREE.Color('#7A6656') },   // 바탕색을 모르는 외곽선(합친 배경 묶음)에 쓰는 색
};

// 재질 이름 → 효과 (재질 이름 = 스펙 팔레트 키)
export const STYLE_NAMES = {
  wind: new Set(['leaf', 'weed', 'petal', 'flower', 'stem', 'grassDark', 'petalDark']),
  water: new Set(['sea', 'water', 'waterLight', 'waterDeep', 'waterfall']),
  spec: new Set(['beak', 'shell', 'metal', 'nose', 'glasses', 'fruit', 'coconut', 'window', 'acorn', 'bowtie']),
  noAO: new Set(['sea', 'water', 'waterLight', 'waterDeep', 'cloud', 'foam', 'glow', 'flame', 'flameCore', 'window']),
  worldPaint: new Set(['sea', 'ground']),       // 월드 좌표 무늬 (안 움직이는 큰 판). 나머지는 모델 좌표라 걸어도 무늬가 안 미끄러진다
  glow: new Set(['flame', 'flameCore', 'firefly', 'sparkle']),
};

/**
 * 재질 이름 → 꼭짓점 스타일 번호 (여러 재질을 한 메시로 합친 곳에서 aStyle 속성으로 쓴다: world 의 배경 묶음)
 * 0 없음 · 1 바람 · 2 물결 · 3 장난감 하이라이트
 */
export function styleClass(name) {
  if (STYLE_NAMES.wind.has(name)) return 1;
  if (STYLE_NAMES.water.has(name)) return 2;
  if (STYLE_NAMES.spec.has(name)) return 3;
  return 0;
}

const PROJECT_CURVED = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 curvedWorld = modelMatrix * mvPosition;
#ifdef STYLE_VARYINGS
  vStyleWorld = curvedWorld.xyz;
#endif
float curveDz = curvedWorld.z - uCurveOrigin.z;
curvedWorld.y -= curveDz * curveDz * uCurve;
mvPosition = viewMatrix * curvedWorld;
gl_Position = projectionMatrix * mvPosition;
`;

// 곡면 없이 월드 좌표만 넘길 때 (bend: false)
const PROJECT_FLAT = /* glsl */ `
#include <project_vertex>
#ifdef STYLE_VARYINGS
  {
    vec4 sw = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      sw = instanceMatrix * sw;
    #endif
    vStyleWorld = ( modelMatrix * sw ).xyz;
  }
#endif
`;

// 물체 원점(인스턴스·모델) — 접촉 그늘 높이와 바람 위상의 기준
const STYLE_ORIGIN = /* glsl */ `
  vec4 styleOrigin = vec4( 0.0, 0.0, 0.0, 1.0 );
  #ifdef USE_INSTANCING
    styleOrigin = instanceMatrix * styleOrigin;
  #endif
  styleOrigin = modelMatrix * styleOrigin;
`;

// 바람: 물체 원점 기준 위로 갈수록 크게, 원점마다 위상을 달리한다 (인스턴스도 안전). 모델 좌표 xz 로 민다 (회전·크기는 무시해도 티 안 남)
const WIND_GLSL = /* glsl */ `
#ifdef STYLE_ATTR
  vStyleKind = aStyle;
#endif
#if defined( STYLE_WIND ) || defined( STYLE_ATTR )
  #ifdef STYLE_WIND
    float windK = 1.0;
  #else
    float windK = step( 0.5, aStyle ) * step( aStyle, 1.5 );     // aStyle 1 = 바람
  #endif
  if ( windK > 0.0 ) {
    ${STYLE_ORIGIN}
    vec4 wv = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      wv = instanceMatrix * wv;
    #endif
    wv = modelMatrix * wv;
    float wh = clamp( wv.y - styleOrigin.y, 0.0, 2.5 );
    float wt = uStyleTime * 1.9 * uWindSpeed;
    float wph = wt + styleOrigin.x * 0.71 + styleOrigin.z * 0.53 + wv.y * 1.7;
    float gust = 0.55 + 0.45 * sin( wt * 0.27 + styleOrigin.x * 0.06 + styleOrigin.z * 0.09 );
    transformed.xz += vec2( sin( wph ), cos( wph * 0.83 + 1.3 ) ) * uWind * 0.03 * wh * gust * windK;
  }
#endif
`;

const STYLE_VERT_PARS = /* glsl */ `
uniform float uStyleTime, uWind, uWindSpeed, uPaintScale;
#ifdef STYLE_ATTR
  attribute float aStyle;
  varying float vStyleKind;
#endif
#ifdef STYLE_VARYINGS
  varying vec3 vStyleWorld;
  varying float vStylePaint;
  varying float vStyleBase;
  NOISE_CORE
#endif
`;

// project_vertex 뒤: 붓질 무늬(꼭짓점마다 — 저주파라 픽셀마다 셀 필요 없다) · 물체 바닥 높이
const STYLE_VERT_MAIN = /* glsl */ `
#ifdef STYLE_VARYINGS
  {
    ${STYLE_ORIGIN}
    vStyleBase = styleOrigin.y;
    #if defined( USE_INSTANCING ) || defined( STYLE_PAINT_WORLD )
      vec3 pp = vStyleWorld * uPaintScale;
    #else
      vec3 pp = position * uPaintScale;
    #endif
    vStylePaint = styleNoise( pp ) * 0.7 + styleNoise( pp * 2.7 + 3.1 ) * 0.3 - 0.5;
  }
#endif
`;

const NOISE_CORE = /* glsl */ `
float styleHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
// 값 잡음 0~1 (부드러움)
float styleNoise( vec3 x ) {
  vec3 i = floor( x ), f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( styleHash( i ), styleHash( i + vec3( 1, 0, 0 ) ), f.x ),
                   mix( styleHash( i + vec3( 0, 1, 0 ) ), styleHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( styleHash( i + vec3( 0, 0, 1 ) ), styleHash( i + vec3( 1, 0, 1 ) ), f.x ),
                   mix( styleHash( i + vec3( 0, 1, 1 ) ), styleHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
`;
const NOISE_GLSL = NOISE_CORE + /* glsl */ `
// 물결 무늬: 0~1 (밝은 줄 + 반짝 점)
float styleWater( vec2 p, float t ) {
  float n1 = styleNoise( vec3( p * 0.55, t * 0.28 ) );
  float n2 = styleNoise( vec3( p * 1.7 + 7.3, t * 0.41 ) );
  float r = abs( n1 * 0.7 + n2 * 0.3 - 0.5 );
  float aa = fwidth( r );
  float line = 1.0 - smoothstep( 0.007, 0.007 + aa * 1.5 + 0.004, r );
  // 줄은 군데군데만 (큰 무늬로 가린다)
  line *= smoothstep( 0.32, 0.58, styleNoise( vec3( p * 0.23 + 3.7, t * 0.12 ) ) );
  line *= smoothstep( 0.42, 0.62, styleNoise( vec3( p * 1.1 + 1.9, t * 0.35 ) ) );   // 긴 줄을 짧은 물결 조각으로 끊는다
  float glint = smoothstep( 0.83, 0.87, styleNoise( vec3( p * 3.1, t * 1.2 ) ) ) * smoothstep( 0.5, 0.7, n1 );
  // 멀어서 무늬가 픽셀보다 촘촘해지면 줄여서 지글거림을 막는다
  float far = 1.0 - smoothstep( 0.015, 0.05, aa );
  return ( line * 0.8 + glint * 0.5 ) * mix( 0.35, 1.0, far );
}
`;

const STYLE_FRAG_PARS = /* glsl */ `
uniform float uStyleTime, uBands, uBandSoft, uShadeFloor, uWrap, uCastDark, uShadeSat;
uniform vec3 uShadeTint, uLitTint;
uniform float uRim, uRimChar, uRimPower, uSpec, uSpecSize, uPaint, uPaintScale, uAO, uAOHeight, uWater, uWaterScale, uGlow;
uniform float uMatRim, uMatSpec, uMatAO, uMatPaint;     // 재질마다 (캐릭터는 림 세게, 물은 접촉 그늘 없음 …)
varying vec3 vStyleWorld;
varying float vStylePaint;
varying float vStyleBase;
#ifdef STYLE_ATTR
  varying float vStyleKind;      // aStyle (1 바람 · 2 물결 · 3 하이라이트)
#endif
float styleSpecK = 0.0;    // 이 조각의 하이라이트 세기 (재질 값 또는 aStyle 3)
float styleShadow = 1.0;   // 지금 방향광의 그림자 (0 = 그림자 속). 점·스포트 빛은 예전처럼 색에 곱한다
float styleSun = 0.0;      // 빛을 받은 정도 0~1 (띠 × 그림자 × 빛 세기) — 그늘 색·채도를 어디에 줄지 정한다
${NOISE_GLSL}
// 명암 띠: 감싸는 빛 → 띠 나누기 → 경계 부드럽게
float styleBand( float ndl ) {
  float x = clamp( ( ndl + uWrap ) / ( 1.0 + uWrap ), 0.0, 1.0 );
  float n = max( uBands - 1.0, 1.0 );
  float y = x * n;
  float i = floor( y ), f = y - i;
  float w = max( uBandSoft * 0.5, fwidth( y ) * 0.75 );
  return clamp( ( i + smoothstep( 0.5 - w, 0.5 + w, f ) ) / n, 0.0, 1.0 );
}
`;

// lights_toon_pars_fragment 대신: 띠 명암 · 그늘/햇빛 색조 · 장난감 하이라이트
const STYLE_LIGHTS = /* glsl */ `
varying vec3 vViewPosition;
struct ToonMaterial {
  vec3 diffuseColor;
};
void RE_Direct_Style( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  float q = styleBand( dot( geometryNormal, directLight.direction ) );
  float s = styleShadow;
  float lit = q * s;
  vec3 k = mix( uShadeFloor * mix( 1.0, s, uCastDark ) * uShadeTint, uLitTint, lit );
  reflectedLight.directDiffuse += directLight.color * k * BRDF_Lambert( material.diffuseColor );
  // 해가 꺼진(세기 0) 실내에서도 맞게: 빛 세기로 무게를 준다 (낮 해 ≈ 1, 달 ≈ 0.9, 꺼짐 = 0)
  styleSun = max( styleSun, lit * clamp( dot( directLight.color, vec3( 0.2126, 0.7152, 0.0722 ) ) * 1.5, 0.0, 1.0 ) );
  if ( styleSpecK > 0.0 && uSpec > 0.0 ) {
    vec3 hv = normalize( directLight.direction + geometryViewDir );
    float ndh = max( dot( geometryNormal, hv ), 0.0 );
    float edge = mix( 0.985, 0.90, uSpecSize );
    float sp = smoothstep( edge, edge + ( 1.0 - edge ) * 0.45, ndh );
    reflectedLight.directSpecular += directLight.color * sp * lit * uSpec * styleSpecK * 0.35;
  }
}
void RE_IndirectDiffuse_Style( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  // 하늘빛(간접광)은 빛을 못 받은 곳에서만 그늘 색으로 (직접광이 먼저 돌아 styleSun 이 정해져 있다)
  reflectedLight.indirectDiffuse += irradiance * mix( uShadeTint, vec3( 1.0 ), styleSun ) * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Style
#define RE_IndirectDiffuse RE_IndirectDiffuse_Style
`;

// color_fragment 뒤: 붓질 색 흔들림 (밝기 + 살짝 따뜻/차가움)
const STYLE_PAINT = /* glsl */ `
styleSpecK = uMatSpec;
#ifdef STYLE_ATTR
  styleSpecK = max( styleSpecK, step( 2.5, vStyleKind ) );
#endif
if ( uPaint > 0.0 && uMatPaint > 0.0 ) {
  float pn = vStylePaint;
  float pk = uPaint * uMatPaint;
  diffuseColor.rgb *= 1.0 + pk * pn * 1.6;
  diffuseColor.rgb += pk * pn * vec3( 0.05, 0.015, -0.05 ) * dot( diffuseColor.rgb, vec3( 0.333 ) );
}
`;

// aomap_fragment 뒤: 접촉 그늘 · 그늘 채도 · 가장자리 빛 · 물결 · 하이라이트를 합친다
const STYLE_COMPOSE = /* glsl */ `
{
  vec3 wn = inverseTransformDirection( geometryNormal, viewMatrix );
  // 접촉 그늘: 물체 바닥 가까운 옆면 (위를 보는 면 = 땅은 빼고)
  float aoH = max( vStyleWorld.y - vStyleBase, 0.0 );
  float ao = uAO * uMatAO * ( 1.0 - smoothstep( 0.0, uAOHeight, aoH ) ) * ( 1.0 - smoothstep( 0.55, 0.9, wn.y ) );
  reflectedLight.indirectDiffuse *= 1.0 - ao;
  reflectedLight.directDiffuse *= 1.0 - ao * 0.6;
  // 그늘 채도: 해를 덜 받은 곳일수록 색을 진하게
  vec3 lsum = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
  float lum = dot( lsum, vec3( 0.2126, 0.7152, 0.0722 ) );
  lsum = max( mix( vec3( lum ), lsum, 1.0 + uShadeSat * ( 1.0 - styleSun ) ), 0.0 );
  reflectedLight.directDiffuse = lsum;
  reflectedLight.indirectDiffuse = vec3( 0.0 );
  vec3 skyLight = vec3( 0.0 );
  #if NUM_HEMI_LIGHTS > 0
    skyLight = hemisphereLights[ 0 ].skyColor;
  #endif
  // 가장자리 빛: 하늘빛 색, 해를 받은 쪽에서 더 밝게
  float rimK = uRim + uRimChar * uMatRim;
  if ( rimK > 0.0 ) {
    float fres = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
    float rim = smoothstep( 0.25, 1.0, pow( fres, uRimPower ) * 1.6 );
    totalEmissiveRadiance += rim * rimK * skyLight * mix( vec3( 1.0 ), diffuseColor.rgb, 0.55 ) * ( 0.35 + 0.65 * styleSun ) * 0.22;
  }
  #if defined( STYLE_WATER ) || defined( STYLE_ATTR )
    #ifdef STYLE_WATER
      float waterK = 1.0;
    #else
      float waterK = step( 1.5, vStyleKind ) * step( vStyleKind, 2.5 );   // aStyle 2 = 물결
    #endif
    if ( waterK > 0.0 && uWater > 0.0 ) {
      float wpat = styleWater( vStyleWorld.xz * uWaterScale, uStyleTime );
      totalEmissiveRadiance += wpat * uWater * waterK * ( skyLight * 0.22 + reflectedLight.directDiffuse * 0.42 );
    }
  #endif
  #ifdef STYLE_GLOW
    totalEmissiveRadiance += diffuseColor.rgb * uGlow;
  #endif
  totalEmissiveRadiance += reflectedLight.directSpecular;
}
`;

const STYLE_UNIFORM_KEYS = Object.keys(look);

// lights_fragment_begin 을 복사해 방향광 그림자 값을 따로 꺼낸다 (띠 명암 · 그림자 진하기를 따로 다루려고)
const DIR_SHADOW_FROM = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]';
const DIR_INFO_FROM = 'getDirectionalLightInfo( directionalLight, directLight );';
let lightsBegin = null;
function styledLightsBegin() {
  if (lightsBegin != null) return lightsBegin;
  const src = THREE.ShaderChunk.lights_fragment_begin;
  if (src.includes(DIR_SHADOW_FROM) && src.includes(DIR_INFO_FROM)) {
    // 방향광마다 그림자 값을 새로 받는다. 점·스포트 빛은 방향광보다 먼저 돌고 styleShadow = 1 그대로
    lightsBegin = src
      .replace(DIR_INFO_FROM, `${DIR_INFO_FROM}\n\t\tstyleShadow = 1.0;`)
      .replace(DIR_SHADOW_FROM, 'styleShadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]');
  } else {
    console.warn('[materials] three 셰이더 조각이 예상과 달라 그림자 진하기 조절을 끕니다');
    lightsBegin = '#include <lights_fragment_begin>';
  }
  return lightsBegin;
}

const OUTLINE_FRAG = /* glsl */ `
{
  vec3 olBase = uOutlineBase;
  #ifdef USE_COLOR
    olBase = vColor;
  #endif
  vec3 olDark = olBase * uOutlineDark;
  olDark = max( mix( vec3( dot( olDark, vec3( 0.2126, 0.7152, 0.0722 ) ) ), olDark, 1.3 ), 0.0 );
  diffuseColor.rgb = mix( diffuse, olDark, uOutlineTint );   // diffuse = 잉크 색 (꼭짓점 색이 곱해지기 전)
}
`;

/**
 * 셰이더 고치기. opts: { bend, outline(uniform), lit(툰 조명), wind, water, paintWorld, mat(재질별 uniform), base(외곽선 바탕색 uniform) }
 */
function patch(shader, opts) {
  const { bend = true, outline = null, lit = false, wind = false, water = false, paintWorld = false, attr = false, glow = false, mat = null, base = null } = opts;
  Object.assign(shader.uniforms, { uCurve: curve.uCurve, uCurveOrigin: curve.uCurveOrigin });
  for (const k of STYLE_UNIFORM_KEYS) shader.uniforms[k] = look[k];
  if (mat) Object.assign(shader.uniforms, mat);
  const varyings = lit || water;
  let defs = '';
  if (varyings) defs += '#define STYLE_VARYINGS\n';
  if (wind) defs += '#define STYLE_WIND\n';
  if (water) defs += '#define STYLE_WATER\n';
  if (paintWorld) defs += '#define STYLE_PAINT_WORLD\n';
  if (attr) defs += '#define STYLE_ATTR\n';
  if (glow) defs += '#define STYLE_GLOW\n';

  let vs = `${defs}uniform float uCurve;\nuniform vec3 uCurveOrigin;\n${STYLE_VERT_PARS.replace('NOISE_CORE', NOISE_CORE)}` + shader.vertexShader;
  let begin = '#include <begin_vertex>\n' + WIND_GLSL;
  if (outline) {
    shader.uniforms.uOutline = outline;
    vs = 'uniform float uOutline, uOutlineScale;\n' + vs;
    begin += '\n  transformed += normalize( normal ) * uOutline * uOutlineScale;';
  }
  // begin_vertex 표시는 남겨 둔다 (world 의 흔들림·물거품 패치가 그 뒤에 끼운다)
  vs = vs.replace('#include <begin_vertex>', begin);
  vs = vs.replace('#include <project_vertex>', (bend ? PROJECT_CURVED : PROJECT_FLAT) + STYLE_VERT_MAIN);
  shader.vertexShader = vs;

  let fs = defs + shader.fragmentShader;
  if (lit) {
    fs = fs.replace('#include <lights_pars_begin>', `#include <lights_pars_begin>\n${STYLE_FRAG_PARS}`)
      .replace('#include <lights_toon_pars_fragment>', STYLE_LIGHTS)
      .replace('#include <lights_fragment_begin>', styledLightsBegin())
      .replace('#include <color_fragment>', `#include <color_fragment>\n${STYLE_PAINT}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${STYLE_COMPOSE}`);
  } else if (water || glow) {
    // 평면(빛 안 받는) 물: 폭포 판 등. 하늘빛 대신 고정 밝기로 반짝임
    // 평면 재질: 물(폭포) 반짝임 · 스스로 빛나기(반딧불·반짝이)
    let add = '';
    if (water) add += '\n  diffuseColor.rgb += styleWater( vec2( ( vStyleWorld.x + vStyleWorld.z ) * 1.6, ( vStyleWorld.y + uStyleTime * 1.1 ) * 0.6 ) * uWaterScale, uStyleTime * 0.8 ) * uWater * 0.22;';
    if (glow) add += '\n  diffuseColor.rgb *= 1.0 + uGlow;';
    fs = `uniform float uStyleTime, uWater, uWaterScale, uGlow;\n${water ? 'varying vec3 vStyleWorld;\n' + NOISE_GLSL : ''}` + fs.replace('#include <map_fragment>', '#include <map_fragment>' + add);
  }
  if (outline) {
    shader.uniforms.uOutlineBase = base ?? look.uOutlineFallback;
    fs = 'uniform vec3 uOutlineBase;\nuniform float uOutlineTint, uOutlineDark;\n' + fs.replace('#include <color_fragment>', `#include <color_fragment>\n${OUTLINE_FRAG}`);
  }
  shader.fragmentShader = fs;
}

/** 프로그램 캐시 열쇠: 셰이더 글자가 달라지는 선택지만 담는다 (값은 uniform 이라 안 들어감) */
const keyOf = (kind, o) => [kind, o.bend === false ? 'flat' : 'curved', o.wind && 'wind', o.water && 'water', o.paintWorld && 'pw', o.attr && 'attr', o.glow && 'glow'].filter(Boolean).join('-');

/** 기존 재질에 곡면 월드 패치를 건다 (같은 종류 재질끼리 셰이더 프로그램을 공유한다). */
export function curved(material) {
  material.onBeforeCompile = sh => patch(sh, {});
  material.customProgramCacheKey = () => 'curved';
  return material;
}

/** 예전 2단 툰 명암 텍스처 (편집기·Blender 렌더와 같은 값). 스타일 셰이더는 쓰지 않지만 다른 곳에서 쓸 수 있게 남겨 둔다. */
export const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([168, 168, 168, 255, 255, 255, 255, 255]), 2, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export const OUTLINE_COLOR = '#4A3B32';

/**
 * 툰 재질. name 으로 효과가 정해진다 (STYLE_NAMES). 추가 선택지:
 *   character: 캐릭터(림 세게, 접촉 그늘·무늬는 약하게), wind / water / spec / glow: 이름과 상관없이 켜기
 *   styleAttr: 여러 재질을 합친 메시 — 꼭짓점 속성 aStyle(styleClass)로 바람·물결·하이라이트를 고른다 (world 배경 묶음)
 */
export function toonMaterial(color, { flat = false, bend = true, name = '', character = false, wind, water, spec, glow, styleAttr = false } = {}) {
  const o = {
    bend,
    wind: wind ?? STYLE_NAMES.wind.has(name),
    water: water ?? STYLE_NAMES.water.has(name),
    paintWorld: STYLE_NAMES.worldPaint.has(name),
    glow: glow ?? STYLE_NAMES.glow.has(name),
    attr: !flat && styleAttr,
  };
  let m;
  if (flat) {
    m = new THREE.MeshBasicMaterial({ color });
    o.wind = false;
    m.onBeforeCompile = sh => patch(sh, o);
    m.customProgramCacheKey = () => keyOf('basic', o);
  } else {
    m = new THREE.MeshToonMaterial({ color });
    const mat = {
      uMatRim: { value: character ? 1 : 0 },
      uMatSpec: { value: spec ?? STYLE_NAMES.spec.has(name) ? 1 : 0 },
      uMatAO: { value: STYLE_NAMES.noAO.has(name) ? 0 : character ? 0.7 : 1 },
      uMatPaint: { value: character ? 0.5 : name === 'cloud' ? 0.4 : 1 },
    };
    m.userData.style = mat;
    m.onBeforeCompile = sh => patch(sh, { ...o, lit: true, mat });
    m.customProgramCacheKey = () => keyOf('toon', o);
  }
  m.name = name;
  if (o.attr) m.defaultAttributeValues = { aStyle: [0] };   // aStyle 이 없는 메시에 써도 0(효과 없음)으로
  if (!bend && !o.water && !o.glow && flat) {   // 곡면도 효과도 없는 평면 재질은 그대로
    m.onBeforeCompile = () => {};
    m.customProgramCacheKey = () => 'plain';
  }
  return m;
}

/** 지금까지 만든 외곽선 재질 (스타일 'off' 때 한꺼번에 숨긴다) */
export const outlineMaterials = new Set();
const outlineState = { visible: true };
/** 외곽선 재질을 모두 켜고 끈다 (메시 visible 은 섬폰 설정 몫이라 건드리지 않는다) */
export function setOutlinesVisible(v) {
  outlineState.visible = !!v;
  for (const m of outlineMaterials) m.visible = outlineState.visible;
}

/**
 * 뒤집은 껍데기 외곽선 재질. width 는 모델 단위(타일 1칸 = 1).
 * base: 바탕색 (외곽선 'subtle' 모드에서 이 색을 어둡게 해서 쓴다. 없으면 꼭짓점 색(vertexColors), 그것도 없으면 look.uOutlineFallback)
 * wind: 바람 따라 흔들리기, styleAttr: 합친 메시의 aStyle 로 바람 (툰 재질과 같은 모양으로 흔들리게)
 */
export function outlineMaterial(width = 0.01, { color = OUTLINE_COLOR, bend = true, base = null, wind = false, styleAttr = false } = {}) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const uOutline = { value: width };
  const uBase = base ? { value: new THREE.Color(base) } : null;
  m.userData.uOutline = uOutline;
  if (uBase) m.userData.uOutlineBase = uBase;
  const o = { bend, wind, attr: styleAttr };
  m.onBeforeCompile = sh => patch(sh, { ...o, outline: uOutline, base: uBase });
  m.customProgramCacheKey = () => keyOf('outline', o);
  m.visible = outlineState.visible;
  if (styleAttr) m.defaultAttributeValues = { aStyle: [0] };
  outlineMaterials.add(m);
  return m;
}

const DEFAULT_NO_OUTLINE = ['eye', 'eyeHighlight', 'blush', 'marking', 'innerEar', 'glasses', 'glow', 'flame', 'flameCore', 'crack', 'paper',
  'waterLight', 'center', 'petalDark', 'rockDark', 'shellRib', 'flower', 'grassDark', 'pebble', 'window'];
const DEFAULT_FLAT = ['eye', 'eyeHighlight', 'blush'];

/**
 * glTF 장면의 재질을 툰 재질로 바꾸고 외곽선을 붙인다.
 * 돌려주는 값: { materials: {재질이름: [재질...]}, outlines: [메시...], setColor(name, hex), setOutlineVisible(bool) }
 * spec(편집기 스펙)을 넘기면 style.flat / style.outlineWidth 를 그대로 따른다.
 * 뼈대가 있는 메시(캐릭터)는 가장자리 빛을 더 세게 받는다.
 */
export function applyToonStyle(root, { spec = null, flat = [], noOutline = [], outlineWidth, bend = true } = {}) {
  const flatSet = new Set([...DEFAULT_FLAT, ...flat, ...(spec?.style?.flat ?? [])]);
  const noOutlineSet = new Set([...DEFAULT_NO_OUTLINE, ...noOutline, ...(spec?.style?.noOutline ?? [])]);
  const width = outlineWidth ?? spec?.style?.outlineWidth ?? 0.006;
  const olCache = new Map();          // 재질 이름별 외곽선 재질 (바탕색 = 그 재질 색, 같은 모델 안에서 나눠 쓴다)
  const outlineFor = (name, base, wind) => {
    const key = `${name}|${base.getHexString()}|${wind}`;
    if (!olCache.has(key)) olCache.set(key, outlineMaterial(width, { bend, base, wind }));
    return olCache.get(key);
  };
  const materials = {};
  const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.userData.outline) meshes.push(o); });
  for (const o of meshes) {
    const src = o.material;
    const m = toonMaterial(src.color.clone(), { flat: flatSet.has(src.name), bend, name: src.name, character: !!o.isSkinnedMesh });
    o.material = m;
    o.castShadow = true;
    o.receiveShadow = true;
    (materials[src.name] ||= []).push(m);
  }
  const outlines = [];
  for (const o of meshes) {
    if (noOutlineSet.has(o.material.name)) continue;
    const ol = outlineFor(o.material.name, o.material.color, !o.isSkinnedMesh && STYLE_NAMES.wind.has(o.material.name));
    let hull;
    if (o.isSkinnedMesh) {
      hull = new THREE.SkinnedMesh(o.geometry, ol);
      hull.bind(o.skeleton, o.bindMatrix);
      hull.position.copy(o.position); hull.quaternion.copy(o.quaternion); hull.scale.copy(o.scale);
      o.parent.add(hull);
    } else {
      hull = new THREE.Mesh(o.geometry, ol);
      o.add(hull);
    }
    hull.userData.outline = true;
    hull.userData.outlineOf = o.material.name;
    hull.castShadow = false;
    hull.frustumCulled = !o.isSkinnedMesh;
    outlines.push(hull);
  }
  for (const o of meshes) if (o.isSkinnedMesh) o.frustumCulled = false;
  const outlineMats = [...olCache.values()];
  return {
    materials, outlines, outlineMaterial: outlineMats[0] ?? null, outlineMaterials: outlineMats,
    setColor(name, hex) {
      (materials[name] ?? []).forEach(m => m.color.set(hex));
      // 외곽선 바탕색도 따라간다
      for (const h of outlines) if (h.userData.outlineOf === name) h.material.userData.uOutlineBase?.value.set(hex);
    },
    setOutlineVisible(v) { outlines.forEach(h => { h.visible = v; }); },
  };
}
