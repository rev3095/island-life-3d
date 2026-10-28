// 하늘 돔과 별. 카메라를 따라다니고 항상 가장 먼 곳(깊이 1)에 그려져 다른 물체 뒤에 깔린다.
// 색은 sRGB 그대로 섞는다 (컨셉 보드 그라데이션과 같은 느낌).
import * as THREE from 'three';

const DOME_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;   // 깊이 = 맨 끝
}`;

// 색은 sRGB(화면 색)로 섞고 skyOut 으로 내보낸다 → 화면에 바로 그려도, 화면 효과 버퍼(선형)에 그려도 같은 색
const SKY_OUT = /* glsl */ `
vec4 skyOut( vec3 c, float a ) { return linearToOutputTexel( vec4( sRGBTransferEOTF( vec4( c, 1.0 ) ).rgb, a ) ); }
`;

const DOME_FS = /* glsl */ `${SKY_OUT}
uniform vec3 uZenith, uHorizon, uSunDir, uSunColor, uMoonDir;
uniform float uSunVis, uMoonVis;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  float t = pow(smoothstep(-0.03, 0.6, e), 0.75);
  vec3 col = mix(uHorizon, uZenith, t);
  // 해 둘레 빛무리 + 둥근 해
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 6.0) * 0.18 + pow(s, 48.0) * 0.35) * uSunVis;
  col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.9985, 0.9991, s) * uSunVis);
  // 달: 크림색 원 + 옅은 빛무리
  float m = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.45, 0.52, 0.8) * (pow(m, 12.0) * 0.12 + pow(m, 90.0) * 0.3) * uMoonVis;
  col = mix(col, vec3(1.0, 0.97, 0.84), smoothstep(0.99905, 0.99925, m) * uMoonVis);
  gl_FragColor = skyOut(col, 1.0);
}`;

const STAR_VS = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime, uAlpha, uPixel;
varying float vAlpha;
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
  float tw = 0.65 + 0.35 * sin(uTime * (1.3 + aPhase) + aPhase * 17.0);
  gl_PointSize = aSize * uPixel * (0.8 + 0.4 * tw);
  // 지평선 가까운 별은 옅게
  vAlpha = uAlpha * tw * smoothstep(0.0, 0.12, normalize(position).y);
}`;

const STAR_FS = /* glsl */ `${SKY_OUT}
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = skyOut(vec3(1.0, 0.97, 0.85), min(1.0, a * 1.4));
}`;

export function createDome() {
  const v3 = () => ({ value: new THREE.Vector3() });
  const uniforms = { uZenith: v3(), uHorizon: v3(), uSunDir: v3(), uSunColor: v3(), uMoonDir: v3(), uSunVis: { value: 0 }, uMoonVis: { value: 0 } };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.ShaderMaterial({ uniforms, vertexShader: DOME_VS, fragmentShader: DOME_FS, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.name = 'sky-dome';
  dome.scale.setScalar(120);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
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
  const starU = { uTime: { value: 0 }, uAlpha: { value: 0 }, uPixel: { value: 1 } };
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: starU, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  }));
  stars.name = 'sky-stars';
  stars.frustumCulled = false;
  stars.renderOrder = -99;

  const group = new THREE.Group();
  group.name = 'sky';
  group.add(dome, stars);

  return {
    group,
    /** look: skyLook() 결과 */
    update(look, camera, time, pixelRatio) {
      group.position.copy(camera.position);
      uniforms.uZenith.value.fromArray(look.zenith);
      uniforms.uHorizon.value.fromArray(look.horizon);
      uniforms.uSunDir.value.fromArray(look.sunSky);
      uniforms.uSunColor.value.fromArray(look.sunDisc);
      uniforms.uSunVis.value = look.sunVis;
      uniforms.uMoonDir.value.fromArray(look.moonSky);
      uniforms.uMoonVis.value = look.moonVis;
      starU.uTime.value = time;
      starU.uAlpha.value = look.stars;
      starU.uPixel.value = pixelRatio;
      stars.visible = look.stars > 0.01;
    },
  };
}
