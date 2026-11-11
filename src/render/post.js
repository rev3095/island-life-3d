// 화면 효과 묶음 (EffectComposer): 장면 → 빛 번짐 → 위·아래 흐림(틸트시프트) → 색 보정(톤·sRGB 포함) → FXAA → 화면.
// 장면은 선형 HDR(HalfFloat) 버퍼에 그린다. 톤 매핑·sRGB 변환은 색 보정 패스가 같이 해서 OutputPass 를 따로 두지 않는다 (전체 화면 한 번 아낌).
// 틸트시프트는 three 의 Horizontal/VerticalTiltShiftShader 를 절반 해상도에서 돌려 흐린 그림만 만들고, 섞기는 색 보정 패스가 한다
// (전체 해상도 9탭 두 번 → 1/4 넓이 두 번: 1920×1200 에서 약 3ms 절약). FXAA 는 화면 색(sRGB) 위에서 해야 잘 되므로 맨 끝.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// 틸트시프트 흐림 정도: 또렷한 줄(uFocus) 위로 uRange 만큼 지나면 uTop, 아래로 지나면 uBottom (곡면 월드가 넘어가는 위쪽을 더 흐리게)
const TILT_PARS = 'uniform float uTop, uBottom, uFocus, uRange;\n';
const TILT_AMOUNT = '( smoothstep( uFocus + uRange * 0.2, uFocus + uRange, vUv.y ) * uTop + ( 1.0 - smoothstep( uFocus - uRange, uFocus - uRange * 0.2, vUv.y ) ) * uBottom )';

function tiltShader(base, from, to) {
  const fs = base.fragmentShader.includes(from)
    ? TILT_PARS + base.fragmentShader.replace(from, to)
    : base.fragmentShader;                                       // three 가 바뀌어 못 찾으면 원래 모양대로
  return {
    name: base.name + 'Style',
    uniforms: { ...THREE.UniformsUtils.clone(base.uniforms), uTop: { value: 1 }, uBottom: { value: 0.3 }, uFocus: { value: 0.45 }, uRange: { value: 0.35 } },
    vertexShader: base.vertexShader,
    fragmentShader: fs,
  };
}

/** 틸트시프트 흐린 그림 만들기 (가로 → 세로, 작은 해상도). 화면에는 안 그리고 texture 만 내놓는다 */
class TiltBlurPass extends Pass {
  constructor(scale) {
    super();
    this.needsSwap = false;
    this.scale = scale;
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(2, 2, opt);
    this.rtB = new THREE.WebGLRenderTarget(2, 2, opt);
    this.texture = this.rtB.texture;
    this.matH = new THREE.ShaderMaterial(tiltShader(HorizontalTiltShiftShader, 'float hh = h * abs( r - vUv.y );', `float hh = h * ${TILT_AMOUNT};`));
    this.matV = new THREE.ShaderMaterial(tiltShader(VerticalTiltShiftShader, 'float vv = v * abs( r - vUv.y );', `float vv = v * ${TILT_AMOUNT};`));
    this.quad = new FullScreenQuad(this.matH);
  }
  setSize(w, h) {
    const sw = Math.max(2, Math.round(w * this.scale)), sh = Math.max(2, Math.round(h * this.scale));
    this.rtA.setSize(sw, sh); this.rtB.setSize(sw, sh);
    // 탭 간격 = 원래 해상도 1픽셀 × 흐림 값 (작은 버퍼에서 돌려도 흐림 크기는 같게)
    this.matH.uniforms.h.value = 1 / w;
    this.matV.uniforms.v.value = 1 / h;
  }
  setProfile(top, bottom, focus, range) {
    for (const { uniforms: u } of [this.matH, this.matV]) {
      u.uTop.value = top; u.uBottom.value = bottom; u.uFocus.value = focus; u.uRange.value = range;
    }
  }
  render(renderer, writeBuffer, readBuffer) {
    this.matH.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.matH;
    renderer.setRenderTarget(this.rtA);
    this.quad.render(renderer);
    this.matV.uniforms.tDiffuse.value = this.rtA.texture;
    this.quad.material = this.matV;
    renderer.setRenderTarget(this.rtB);
    this.quad.render(renderer);
  }
  dispose() { this.rtA.dispose(); this.rtB.dispose(); this.matH.dispose(); this.matV.dispose(); this.quad.dispose(); }
}

const GradeShader = {
  name: 'StyleGradeShader',
  uniforms: {
    tDiffuse: { value: null }, tBlur: { value: null }, uTiltOn: { value: 0 }, uFocus: { value: 0.5 }, uRange: { value: 0.4 },
    uExposure: { value: 1 }, uShoulder: { value: 0.72 }, uWarmth: { value: 0 },
    uSat: { value: 1 }, uContrast: { value: 1 }, uLift: { value: 0 }, uLiftTint: { value: new THREE.Color(1, 1, 1) },
    uGamma: { value: 1 }, uGain: { value: 1 }, uVignette: { value: 0 }, uVigSoft: { value: 0.6 }, uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse, tBlur;
uniform float uTiltOn, uFocus, uRange;
uniform float uExposure, uShoulder, uWarmth, uSat, uContrast, uLift, uGamma, uGain, uVignette, uVigSoft, uAspect;
uniform vec3 uLiftTint;
varying vec2 vUv;
// 밝은 곳 눌러주기: uShoulder 아래는 그대로 두고, 위쪽만 1 로 부드럽게 접는다 (파스텔 색이 그대로 남는다)
vec3 styleShoulder( vec3 c ) {
  float k = uShoulder;
  if ( k >= 0.999 ) return min( c, 1.0 );
  vec3 x = max( c - k, 0.0 );
  return min( c, vec3( k ) ) + ( 1.0 - k ) * ( 1.0 - exp( - x / ( 1.0 - k ) ) );
}
void main() {
  vec3 c = texture2D( tDiffuse, vUv ).rgb;
  if ( uTiltOn > 0.5 ) {
    // 또렷한 띠 밖에서만 흐린 그림으로
    float k = max( smoothstep( uFocus + uRange * 0.2, uFocus + uRange, vUv.y ), 1.0 - smoothstep( uFocus - uRange, uFocus - uRange * 0.2, vUv.y ) );
    c = mix( c, texture2D( tBlur, vUv ).rgb, k );
  }
  c *= uExposure;
  c *= vec3( 1.0 + uWarmth * 0.07, 1.0 + uWarmth * 0.012, 1.0 - uWarmth * 0.08 );
  c = styleShoulder( max( c, 0.0 ) );
  c = sRGBTransferOETF( vec4( c, 1.0 ) ).rgb;
  // 화면 색에서 보정: 밝은 곳 · 어두운 곳 띄우기(색) · 중간 밝기 · 대비 · 채도
  c = c * uGain + uLift * uLiftTint * ( 1.0 - c );
  c = pow( max( c, 0.0 ), vec3( 1.0 / uGamma ) );
  c = ( c - 0.5 ) * uContrast + 0.5;
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, uSat );
  // 가장자리: 살짝 어둡고 따뜻한 보랏빛으로
  vec2 d = ( vUv - 0.5 ) * vec2( uAspect, 1.0 );
  float v = smoothstep( 0.75 - uVigSoft * 0.55, 0.75 + uVigSoft * 0.35, length( d ) * 1.35 );
  c *= mix( vec3( 1.0 ), vec3( 0.80, 0.74, 0.80 ), v * uVignette );
  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`,
};

/**
 * quality: 'high' | 'low'. low 는 빛 번짐(1/8)·틸트시프트 흐림(1/4)을 한 단계 더 작은 해상도에서 만들고, 화소가 촘촘하면 FXAA 를 끈다.
 */
export function createPost(renderer, scene, camera, { quality = 'high', lite = false } = {}) {
  // lite (적정, 셰이더 보드 D134-A): 빛 번짐·흐림 패스는 만들지 않고 장면 → 색 보정 → FXAA 만 (적정에서도 편집기 색감·비네트)
  const low = quality === 'low';
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x * pr), Math.max(1, size.y * pr), { type: THREE.HalfFloatType });
  rt.texture.name = 'style.scene';
  const composer = new EffectComposer(renderer, rt);

  const scenePass = new RenderPass(scene, camera);
  let bloom = null, tilt = null;
  if (!lite) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x * pr, size.y * pr), 0.35, 0.5, 1.05);
    // 빛 번짐은 원래 1/2 해상도에서 시작한다 → 1/4 (low 는 1/8) 로 줄인다. 흐린 빛무리라 차이가 거의 안 보이고 1920×1200 에서 약 1ms 아낀다
    { const set = bloom.setSize.bind(bloom), k = low ? 0.25 : 0.5; bloom.setSize = (w, h) => set(Math.max(4, w * k), Math.max(4, h * k)); }
    tilt = new TiltBlurPass(low ? 0.25 : 0.5);
  }
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.tBlur.value = tilt?.texture ?? null;
  const fxaa = new ShaderPass(FXAAShader);
  for (const p of [scenePass, bloom, tilt, grade, fxaa]) if (p) composer.addPass(p);

  const state = { width: size.x, height: size.y };
  function setSize(w, h) {
    state.width = w; state.height = h;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    const pw = w * renderer.getPixelRatio(), ph = h * renderer.getPixelRatio();
    fxaa.uniforms.resolution.value.set(1 / pw, 1 / ph);
    grade.uniforms.uAspect.value = w / Math.max(1, h);
  }
  setSize(size.x, size.y);

  /** 스타일 값(p) → 패스 켜기·uniform */
  function apply(p) {
    if (bloom) {
      bloom.enabled = p.bloom > 0.001;
      bloom.strength = p.bloom;
      bloom.radius = p.bloomRadius;
      bloom.threshold = p.bloomThreshold;
    }
    if (tilt) {
      tilt.enabled = p.tiltTop > 0.001 || p.tiltBottom > 0.001;
      // 탭 간격(픽셀) = 흐림 값 × 화면 높이 비율 → 해상도가 달라도 같은 정도로 흐려 보인다
      const k = Math.max(1, state.height * renderer.getPixelRatio() / 900);
      tilt.setProfile(p.tiltTop * k, p.tiltBottom * k, p.tiltFocus, p.tiltRange);
    }
    const g = grade.uniforms;
    g.uTiltOn.value = tilt?.enabled ? 1 : 0; g.uFocus.value = p.tiltFocus; g.uRange.value = p.tiltRange;
    g.uExposure.value = p.exposure; g.uShoulder.value = p.shoulder; g.uWarmth.value = p.warmth;
    g.uSat.value = p.saturation; g.uContrast.value = p.contrast; g.uLift.value = p.lift; g.uLiftTint.value.set(p.liftTint);
    g.uGamma.value = p.gamma; g.uGain.value = p.gain; g.uVignette.value = p.vignette; g.uVigSoft.value = p.vignetteSoft;
    // low 에서 화소가 촘촘하면(배율 1.5 이상, 휴대폰) 계단이 덜 보이고 FXAA 가 비싸서(1920×1200 약 2ms) 끈다
    fxaa.enabled = !!p.fxaa && !(low && renderer.getPixelRatio() >= 1.5);
  }

  return {
    composer, passes: { scene: scenePass, bloom, tilt, grade, fxaa },
    setSize, apply,
    render(dt) { composer.render(dt); },
    dispose() { composer.dispose?.(); tilt?.dispose(); rt.dispose(); },
  };
}
