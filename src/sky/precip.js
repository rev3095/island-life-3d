// 비·눈·무지개. 입자는 ctx.focus 둘레 상자 안에서 GPU 로만 움직인다 (CPU 는 시간·중심만 넘김).
// 곡면 월드와 같은 식으로 휘어서 땅과 어긋나지 않는다.
import * as THREE from 'three';

const CURVE_GLSL = /* glsl */ `
uniform float uCurve;
uniform vec3 uCurveOrigin;
vec3 bend(vec3 p) { float dz = p.z - uCurveOrigin.z; p.y -= dz * dz * uCurve; return p; }
// 상자 안에서 감싸기: 세계 좌표에 고정된 입자가 focus 를 따라 다시 나타난다
uniform vec3 uFocus, uBox;
float wrapAround(float v, float c, float size) { return c + mod(v - c + size * 0.5, size) - size * 0.5; }
`;

const RAIN_VS = /* glsl */ `
${CURVE_GLSL}
attribute float aEnd;
uniform float uTime, uSpeed, uLen, uAlpha;
uniform vec2 uWind;
varying float vA;
void main() {
  float y = mod(position.y - uTime * uSpeed, uBox.y);
  vec3 p = vec3(wrapAround(position.x + uWind.x * uTime, uFocus.x, uBox.x), uFocus.y + y - 0.6, wrapAround(position.z + uWind.y * uTime, uFocus.z, uBox.z));
  p += vec3(-uWind.x, uSpeed, -uWind.y) * (aEnd * uLen / uSpeed);
  vA = uAlpha * smoothstep(0.0, 1.2, y) * (1.0 - smoothstep(uBox.y - 3.0, uBox.y, y)) * (0.55 + 0.45 * aEnd);
  gl_Position = projectionMatrix * viewMatrix * vec4(bend(p), 1.0);
}`;
// 색은 화면 색(sRGB)으로 계산하고 skyOut 으로 내보낸다 (화면 효과 버퍼에 그려도 같은 색)
const SKY_OUT = /* glsl */ `
vec4 skyOut( vec3 c, float a ) { return linearToOutputTexel( vec4( sRGBTransferEOTF( vec4( c, 1.0 ) ).rgb, a ) ); }
`;
const RAIN_FS = /* glsl */ `${SKY_OUT}
uniform vec3 uColor;
varying float vA;
void main() { gl_FragColor = skyOut(uColor, vA); }`;

// 빗방울이 땅에 닿아 퍼지는 동그라미
const SPLASH_VS = /* glsl */ `
${CURVE_GLSL}
uniform float uTime, uAlpha, uScale;
varying float vT, vA;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float cyc = uTime * 1.6 + position.y;
  float k = floor(cyc);
  vT = fract(cyc);
  vec3 p = vec3(uFocus.x + (hash(k * 1.7 + position.x) - 0.5) * uBox.x, uFocus.y + 0.03, uFocus.z + (hash(k * 2.3 + position.z) - 0.5) * uBox.z);
  vec4 mv = viewMatrix * vec4(bend(p), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.1 + 0.5 * vT) * uScale / -mv.z;
  vA = uAlpha * (1.0 - vT);
}`;
const SPLASH_FS = /* glsl */ `${SKY_OUT}
uniform vec3 uColor;
varying float vT, vA;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * vec2(1.0, 2.2);   // 납작한 타원
  float d = length(q);
  float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.26, 0.4, d);
  if (ring * vA < 0.01) discard;
  gl_FragColor = skyOut(uColor, ring * vA);
}`;

const SNOW_VS = /* glsl */ `
${CURVE_GLSL}
attribute float aSeed;
uniform float uTime, uSpeed, uAlpha, uScale, uPixel;
varying float vA;
void main() {
  float y = mod(position.y - uTime * uSpeed * (0.7 + aSeed * 0.6), uBox.y);
  float sway = sin(uTime * (0.7 + aSeed) + aSeed * 40.0) * 0.6;
  vec3 p = vec3(wrapAround(position.x + sway + uTime * 0.4, uFocus.x, uBox.x), uFocus.y + y - 0.3, wrapAround(position.z + cos(uTime * 0.5 + aSeed * 20.0) * 0.4, uFocus.z, uBox.z));
  vec4 mv = viewMatrix * vec4(bend(p), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min((0.09 + aSeed * 0.08) * uScale / -mv.z, 9.0 * uPixel);   // 카메라 코앞 송이가 너무 크지 않게
  vA = uAlpha * smoothstep(0.0, 0.8, y) * (1.0 - smoothstep(uBox.y - 3.0, uBox.y, y));
}`;
const SNOW_FS = /* glsl */ `${SKY_OUT}
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.2, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = skyOut(vec3(1.0), a);
}`;

// 무지개: 반원 띠. 하늘 돔처럼 카메라를 따라다니며 맨 뒤에 그린다.
const BOW_VS = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const BOW_FS = /* glsl */ `${SKY_OUT}
uniform float uAlpha, uInner, uOuter, uDrop;
varying vec2 vP;
vec3 band(float t) {
  // 바깥 빨강 → 안쪽 보라, 파스텔 톤
  vec3 c[7];
  c[0] = vec3(0.96, 0.55, 0.55); c[1] = vec3(0.98, 0.74, 0.50); c[2] = vec3(0.99, 0.92, 0.55);
  c[3] = vec3(0.62, 0.88, 0.60); c[4] = vec3(0.55, 0.78, 0.96); c[5] = vec3(0.58, 0.62, 0.92); c[6] = vec3(0.76, 0.60, 0.90);
  float x = clamp(t, 0.0, 0.9999) * 6.0;
  int i = int(floor(x));
  vec3 a = c[0], b = c[0];
  for (int k = 0; k < 7; k++) { if (k == i) a = c[k]; if (k == i + 1) b = c[k]; }
  if (i >= 6) b = c[6];
  return mix(a, b, smoothstep(0.35, 0.65, fract(x)));
}
void main() {
  float r = length(vP);
  float t = (uOuter - r) / (uOuter - uInner);
  float edge = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.88, t);
  float foot = smoothstep(uDrop - 8.0, uDrop + 20.0, vP.y);       // 지평선 쪽 발치는 흐리게
  float a = edge * foot * uAlpha;
  if (a < 0.005) discard;
  gl_FragColor = skyOut(band(t), a);
}`;

export function createPrecip(curve) {
  const group = new THREE.Group();
  group.name = 'sky-precip';
  const shared = { uCurve: curve.uCurve, uCurveOrigin: curve.uCurveOrigin, uFocus: { value: new THREE.Vector3() }, uTime: { value: 0 } };
  let seed = 101;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // 비: 선분 1800개
  const RAIN_N = 1800, RAIN_BOX = new THREE.Vector3(34, 18, 34);
  const rp = new Float32Array(RAIN_N * 6), re = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) {
    const x = rnd() * 400, y = rnd() * RAIN_BOX.y, z = rnd() * 400;
    rp.set([x, y, z, x, y, z], i * 6);
    re[i * 2 + 1] = 1;
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rg.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const rainU = { ...shared, uBox: { value: RAIN_BOX }, uSpeed: { value: 21 }, uLen: { value: 0.75 }, uAlpha: { value: 0 },
    uWind: { value: new THREE.Vector2(-1.6, 0.6) }, uColor: { value: new THREE.Color('#DDEBFA') } };
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ uniforms: rainU, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, fog: false }));

  // 물방울 튀김: 220개
  const SPL_N = 220;
  const sp = new Float32Array(SPL_N * 3);
  for (let i = 0; i < SPL_N; i++) sp.set([rnd() * 100, rnd(), rnd() * 100], i * 3);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const splashU = { ...shared, uBox: { value: new THREE.Vector3(26, 1, 22) }, uAlpha: { value: 0 }, uScale: { value: 600 }, uColor: { value: new THREE.Color('#EEF6FF') } };
  const splash = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: splashU, vertexShader: SPLASH_VS, fragmentShader: SPLASH_FS, transparent: true, depthWrite: false, fog: false }));

  // 눈: 1400송이
  const SNOW_N = 1400, SNOW_BOX = new THREE.Vector3(34, 16, 34);
  const np = new Float32Array(SNOW_N * 3), ns = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i++) { np.set([rnd() * 400, rnd() * SNOW_BOX.y, rnd() * 400], i * 3); ns[i] = rnd(); }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
  ng.setAttribute('aSeed', new THREE.BufferAttribute(ns, 1));
  const snowU = { ...shared, uBox: { value: SNOW_BOX }, uSpeed: { value: 1.5 }, uAlpha: { value: 0 }, uScale: { value: 600 }, uPixel: { value: 1 } };
  const snow = new THREE.Points(ng, new THREE.ShaderMaterial({ uniforms: snowU, vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false, fog: false }));

  // 무지개
  // 넓고 납작한 활: 중심은 지평선 아래 깊이, 꼭대기는 올려본 각 10° 쯤 (낮은 카메라에도 걸리게)
  const INNER = 141, OUTER = 150, DROP = 130;
  const bowU = { uAlpha: { value: 0 }, uInner: { value: INNER }, uOuter: { value: OUTER }, uDrop: { value: DROP } };
  const bow = new THREE.Mesh(new THREE.RingGeometry(INNER, OUTER, 96, 1, 0, Math.PI),
    new THREE.ShaderMaterial({ uniforms: bowU, vertexShader: BOW_VS, fragmentShader: BOW_FS, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  bow.name = 'sky-rainbow';
  bow.renderOrder = -98;

  for (const o of [rain, splash, snow, bow]) { o.frustumCulled = false; o.visible = false; group.add(o); }

  return {
    group,
    /** amounts: { rain, snow, rainbow } 0~1 */
    update(dt, time, focus, camera, amounts, viewHeight, pixelRatio = 1) {
      snowU.uPixel.value = pixelRatio;
      shared.uTime.value = time;
      shared.uFocus.value.copy(focus);
      // 화면 높이에 맞춘 점 크기 비율 (월드 크기 → 픽셀)
      const scale = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      splashU.uScale.value = snowU.uScale.value = scale;
      rainU.uAlpha.value = 0.55 * amounts.rain;
      splashU.uAlpha.value = 0.5 * amounts.rain;
      snowU.uAlpha.value = 0.95 * amounts.snow;
      rain.visible = splash.visible = amounts.rain > 0.01;
      snow.visible = amounts.snow > 0.01;
      bowU.uAlpha.value = 0.55 * amounts.rainbow;
      bow.visible = amounts.rainbow > 0.01;
      if (bow.visible) {
        // 카메라가 바라보는 쪽(수평 방향) 먼 하늘, 지평선에 발을 걸친다
        const f = camera.getWorldDirection(_v).setY(0);
        if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
        f.normalize();
        bow.position.copy(camera.position).addScaledVector(f, 110).add(_r.set(f.z, 0, -f.x).multiplyScalar(-14));
        bow.position.y = camera.position.y - DROP;
        bow.lookAt(camera.position.x, bow.position.y, camera.position.z);
      }
    },
  };
}
const _v = new THREE.Vector3(), _r = new THREE.Vector3();
