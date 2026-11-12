// FX-02 별똥별 (M13 유성우, 13차 보드 wave13 D144-A · D147-A). dome.js 하늘 셰이더는 그대로 두고 이 파일만 따로 — sky/index.js 에는 짧은 고리만.
// 유성우 밤(daily 모듈이 time.meteors.set(true))에만 만든다 → 다른 날엔 셰이더도 물체도 없다 (셰이더 보드 방식 「필요한 날만」).
//  - 높음 · 적정: 줄 판 몇 장을 한 그리기로 — 꼭짓점 셰이더가 시간으로 별똥별을 그었다 지운다 (별처럼 맨 끝 깊이 = 하늘 빈 화소에만, 더하기 섞기).
//  - 낮음 · 매우 낮음: 셰이더 없이 선 두 개를 CPU 로 옮긴다 (기본 선 재질 — GPU 몫은 거의 0).
// 별똥별은 게임 카메라가 올려다볼 때(시점 R/V · 두 손가락) 보이는 북쪽 하늘 (고도 15–40°) 에 떨어진다. 그룹은 하늘 돔 그룹 안이라 카메라를 따라간다.
import * as THREE from 'three';

/** 사양별 별똥별 수 · 셰이더 여부 */
export const METEOR_QUALITY = {
  high: { n: 7, shader: true },
  mid: { n: 5, shader: true },
  low: { n: 2, shader: false },
  min: { n: 2, shader: false },
};
/** M18-P2 큰 유성우 밤(8월·12월 하루씩)의 별똥별 배수 */
export const BIG_METEOR = 2;
const R = 100;                 // 하늘 반지름 (돔 120 안쪽)
const LIFE = 0.9;              // 한 줄이 그어지는 시간 (초)

// 색은 sRGB 로 섞고 화면 출력으로 (dome.js skyOut 과 같은 한 줄)
const VS = /* glsl */ `
attribute vec2 aCorner;   // x: 꼬리 0 → 머리 1, y: 옆 −1 / 1
attribute float aSeed;
uniform float uTime, uLife, uWidth;
varying float vA;
vec3 skyDir(float az, float el) { return vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el)); }
void main() {
  float period = 3.2 + fract(aSeed * 13.7) * 5.5;
  float cyc = (uTime + aSeed * 31.0) / period;
  float k = floor(cyc);
  float ph = fract(cyc) * period / uLife;                  // 0~1 동안 그어지고 그 뒤엔 숨음
  float s = fract(sin(k * 12.9898 + aSeed * 78.233) * 43758.5453);
  float az = -0.75 + s * 1.5;
  float el = 0.28 + fract(s * 7.31) * 0.38;
  float side = s > 0.5 ? 1.0 : -1.0;
  float p = clamp(ph, 0.0, 1.0);
  vec3 head = skyDir(az + side * p * 0.16, el - p * 0.2);
  vec3 tail = skyDir(az + side * max(p - 0.35, 0.0) * 0.16, el - max(p - 0.35, 0.0) * 0.2);
  vec3 dir = normalize(head - tail + vec3(1e-4));
  vec3 perp = normalize(cross(dir, head));
  vec3 pos = mix(tail, head, aCorner.x) * ${R.toFixed(1)} + perp * aCorner.y * uWidth * (0.3 + 0.7 * aCorner.x);
  vA = (ph < 1.0 ? 1.0 : 0.0) * sin(3.14159 * p) * aCorner.x;
  vec4 q = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_Position = q.xyww;
  gl_Position.z *= 0.99999;
}`;
const FS = /* glsl */ `
uniform float uAlpha;
varying float vA;
vec4 skyOut( vec3 c, float a ) { return linearToOutputTexel( vec4( sRGBTransferEOTF( vec4( c, 1.0 ) ).rgb, a ) ); }
void main() {
  float a = vA * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = skyOut(vec3(1.0, 0.95, 0.8), min(1.0, a));
}`;

function shaderStreaks(n) {
  const pos = [], corner = [], seed = [], index = [];
  for (let i = 0; i < n; i++) {
    const s = (i + 0.37) / n;
    const base = i * 4;
    for (const [x, y] of [[0, -1], [0, 1], [1, -1], [1, 1]]) { pos.push(0, 0, 0); corner.push(x, y); seed.push(s); }
    index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  g.setIndex(index);
  const uniforms = { uTime: { value: 0 }, uLife: { value: LIFE }, uWidth: { value: 0.35 }, uAlpha: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'sky-meteors';
  mesh.frustumCulled = false;
  mesh.renderOrder = -98;
  return {
    object: mesh,
    update(t, alpha) { uniforms.uTime.value = t; uniforms.uAlpha.value = alpha; },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

/** 낮은 사양: 선 n 개를 CPU 로 (셰이더 없음) */
function cpuStreaks(n) {
  const arr = new Float32Array(n * 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const lines = new THREE.LineSegments(g, mat);
  lines.name = 'sky-meteors-lite';
  lines.frustumCulled = false;
  const dir = (az, el, out, o) => { out[o] = Math.sin(az) * Math.cos(el) * R; out[o + 1] = Math.sin(el) * R; out[o + 2] = -Math.cos(az) * Math.cos(el) * R; };
  const fract = x => x - Math.floor(x);
  return {
    object: lines,
    update(t, alpha) {
      let shown = 0;
      for (let i = 0; i < n; i++) {
        const seed = (i + 0.37) / n, period = 3.2 + fract(seed * 13.7) * 5.5;
        const cyc = (t + seed * 31) / period, k = Math.floor(cyc), ph = (fract(cyc) * period) / LIFE;
        const s = fract(Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453);
        const az = -0.75 + s * 1.5, el = 0.28 + fract(s * 7.31) * 0.38, side = s > 0.5 ? 1 : -1;
        const p = Math.min(1, ph), q = Math.max(0, p - 0.35);
        dir(az + side * p * 0.16, el - p * 0.2, arr, i * 6 + 3);
        dir(az + side * q * 0.16, el - q * 0.2, arr, i * 6);
        if (ph >= 1) for (let j = 0; j < 6; j++) arr[i * 6 + j] = 0;
        else shown++;
      }
      g.attributes.position.needsUpdate = true;
      mat.opacity = shown ? alpha : 0;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

/** 하늘 별똥별 — sky/index.js 가 하늘 그룹에 붙이고 step 마다 update 를 부른다 */
export function createMeteors({ quality = 'mid' } = {}) {
  const group = new THREE.Group();
  group.name = 'sky-meteors-group';
  group.visible = false;
  let on = false, big = false, q = quality, fx = null, t = 0;
  const build = () => {
    if (fx) { group.remove(fx.object); fx.dispose(); fx = null; }
    if (!on) return;
    const c = METEOR_QUALITY[q] ?? METEOR_QUALITY.mid;
    const k = big ? BIG_METEOR : 1;   // M18-P2 큰 유성우 밤: 줄 수 두 배 (낮은 사양도 CPU 선 4개)
    fx = c.shader ? shaderStreaks(c.n * k) : cpuStreaks(c.n * k);
    group.add(fx.object);
  };
  return {
    group,
    get on() { return on; },
    get big() { return on && big; },
    get count() { return fx ? (fx.object.geometry.attributes.aSeed?.count ?? fx.object.geometry.attributes.position.count / 2 * 4) / 4 : 0; },
    /** 유성우 켜기·끄기 (켤 때만 만든다, 끄면 지운다). opt.big = 큰 유성우 밤 (M18-P2) */
    set(v, { big: b = false } = {}) { v = !!v; b = v && !!b; if (v === on && b === big) return; on = v; big = b; build(); group.visible = on; },
    setQuality(next) { if (!METEOR_QUALITY[next] || next === q) return; q = next; if (on) build(); },
    /** night 밤 정도 0~1, cover 구름 0~1 */
    update(dt, camera, { night = 1, cover = 0 } = {}) {
      if (!on || !fx) return;
      t = (t + dt) % 10000;
      fx.update(t, Math.max(0, night) * (1 - Math.min(1, cover * 1.2)));
    },
  };
}
