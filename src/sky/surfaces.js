// 장면 속 재질을 시간·날씨에 맞게 바꾼다.
//  - 밤 조명: 재질 이름 'glow'(가로등 등불)·'window'(창문 유리)를 밝히고, 등불·모닥불 둘레에 빛무리와 바닥 빛웅덩이를 띄운다.
//  - 젖은 땅: 비가 오면 땅 재질(풀·길·모래·돌)을 조금 어둡게.
// 다른 모듈(world)이 색을 바꿔도(계절 등) 그 색을 새 기준으로 삼는다.
import * as THREE from 'three';

const NIGHT = new Set(['glow', 'window']);
const WET = new Set(['ground', 'grass', 'grassDark', 'path', 'dirt', 'sand', 'sandDark', 'stone', 'stoneLight', 'grout', 'pebble', 'cliff', 'cliffDark']);
const WARM = new THREE.Color('#FFD27A');
const WINDOW_LIT = new THREE.Color('#FFD98F');
const MAX_HALOS = 96;

const HALO_VS = /* glsl */ `
uniform float uCurve, uScale, uTime, uOn;
uniform vec3 uCurveOrigin;
attribute float aSize, aKind, aPhase;
varying float vA, vKind;
void main() {
  vec3 p = position;
  float dz = p.z - uCurveOrigin.z; p.y -= dz * dz * uCurve;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // 모닥불은 일렁인다
  float flick = aKind > 0.5 ? 0.85 + 0.15 * sin(uTime * 9.0 + aPhase * 30.0) * sin(uTime * 5.3 + aPhase * 11.0) : 1.0;
  gl_PointSize = aSize * flick * uScale / -mv.z;
  vKind = aKind;
  vA = (aKind > 0.5 ? 0.25 + 0.75 * uOn : uOn) * flick;
}`;
// 빛무리·빛웅덩이는 미리 곱한 알파(One, OneMinusSrcAlpha) → 색만 바꾼 뒤 알파를 곱한다 (화면 효과 버퍼에 그려도 같은 색)
const SKY_OUT = /* glsl */ `
vec4 skyOut( vec3 c, float a ) { return linearToOutputTexel( vec4( sRGBTransferEOTF( vec4( c, 1.0 ) ).rgb, a ) ); }
`;
const HALO_FS = /* glsl */ `${SKY_OUT}
varying float vA, vKind;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.2) * vA * 0.55;
  if (a < 0.004) discard;
  vec3 c = vKind > 0.5 ? vec3(1.0, 0.62, 0.28) : vec3(1.0, 0.85, 0.5);
  gl_FragColor = vec4(skyOut(c, 1.0).rgb * a, a);
}`;

// 바닥 빛웅덩이 (곡면 월드에 맞춰 휜다)
const POOL_VS = /* glsl */ `
uniform float uCurve;
uniform vec3 uCurveOrigin;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  float dz = w.z - uCurveOrigin.z; w.y -= dz * dz * uCurve;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const POOL_FS = /* glsl */ `${SKY_OUT}
uniform float uOn;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a = a * a * uOn * 0.42;
  if (a < 0.004) discard;
  gl_FragColor = vec4(skyOut(vec3(1.0, 0.78, 0.45), 1.0).rgb * a, a);
}`;

export function createSurfaces(curve) {
  const night = new Map();   // material → { base, baseEmissive, flat, kind }
  const wet = new Map();     // material → { dry, written }
  const tmpBox = new THREE.Box3(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpC = new THREE.Color();
  const haloU = { uCurve: curve.uCurve, uCurveOrigin: curve.uCurveOrigin, uScale: { value: 600 }, uTime: { value: 0 }, uOn: { value: 0 } };
  const hp = new Float32Array(MAX_HALOS * 3), hs = new Float32Array(MAX_HALOS), hk = new Float32Array(MAX_HALOS), hph = new Float32Array(MAX_HALOS);
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
  hg.setAttribute('aSize', new THREE.BufferAttribute(hs, 1));
  hg.setAttribute('aKind', new THREE.BufferAttribute(hk, 1));
  hg.setAttribute('aPhase', new THREE.BufferAttribute(hph, 1));
  hg.setDrawRange(0, 0);
  const halos = new THREE.Points(hg, new THREE.ShaderMaterial({
    uniforms: haloU, vertexShader: HALO_VS, fragmentShader: HALO_FS, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  halos.name = 'sky-halos';
  halos.frustumCulled = false;

  const poolU = { uCurve: curve.uCurve, uCurveOrigin: curve.uCurveOrigin, uOn: { value: 0 } };
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, new THREE.ShaderMaterial({
    uniforms: poolU, vertexShader: POOL_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }), MAX_HALOS);
  pools.name = 'sky-light-pools';
  pools.count = 0;
  pools.frustumCulled = false;
  pools.renderOrder = 1;

  const group = new THREE.Group();
  group.name = 'sky-night-lights';
  group.add(pools, halos);

  /** 등불이 달린 물체의 바닥 높이: 작은 묶음(모델 하나)까지 올라가서 그 아래쪽 */
  function groundY(mesh, scene) {
    let root = mesh;
    for (let i = 0; i < 4 && root.parent && root.parent !== scene && root.parent.children.length <= 12; i++) root = root.parent;
    return tmpBox.setFromObject(root).min.y;
  }

  function addLight(kind, center, y0, size) {
    const i = hg.drawRange.count;
    if (i >= MAX_HALOS) return;
    hp.set([center.x, center.y, center.z], i * 3);
    hs[i] = size; hk[i] = kind === 'flame' ? 1 : 0;
    hph[i] = Math.abs(Math.sin(center.x * 12.9898 + center.z * 78.233) * 43758.5453) % 1;   // 다시 훑어도 같은 값
    hg.setDrawRange(0, i + 1);
    const r = kind === 'flame' ? 3.2 : 3.6;
    tmpM.makeScale(r, 1, r).setPosition(center.x, y0 + 0.03, center.z);
    pools.setMatrixAt(pools.count++, tmpM);
  }

  const seenMats = new Set();
  return {
    group,
    /** 장면을 훑어 밤 조명·젖는 재질을 모은다 (가벼움: 몇 초마다 불러도 된다) */
    scan(scene) {
      hg.setDrawRange(0, 0);
      pools.count = 0;
      seenMats.clear();
      scene.updateMatrixWorld();
      scene.traverse(o => {
        if (!o.isMesh || o.userData.outline || o.parent === group || o === pools) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m || !m.name) continue;
          seenMats.add(m);
          if (NIGHT.has(m.name) && !night.has(m)) {
            night.set(m, { base: m.color.clone(), baseEmissive: m.emissive?.clone() ?? null, written: null, kind: m.name });
          }
          if (WET.has(m.name) && !wet.has(m)) wet.set(m, { dry: m.color.clone(), written: null });
          // 등불·불꽃 둘레 빛무리
          const kind = m.name === 'glow' ? 'lamp' : m.name === 'flame' ? 'flame' : null;
          if (!kind) continue;
          if (o.isInstancedMesh) {
            o.geometry.computeBoundingBox();
            for (let k = 0; k < o.count; k++) {
              o.getMatrixAt(k, tmpM);
              tmpM.premultiply(o.matrixWorld);
              tmpBox.copy(o.geometry.boundingBox).applyMatrix4(tmpM);
              tmpBox.getCenter(tmpV);
              addLight(kind, tmpV, tmpBox.min.y - (kind === 'lamp' ? 2 : 0.2), kind === 'lamp' ? 2.6 : 2.4);
            }
          } else {
            tmpBox.setFromObject(o).getCenter(tmpV);
            addLight(kind, tmpV, groundY(o, scene), kind === 'lamp' ? 2.6 : 2.4);
          }
        }
      });
      // 장면에서 사라진 재질은 잊는다
      for (const m of night.keys()) if (!seenMats.has(m)) night.delete(m);
      for (const m of wet.keys()) if (!seenMats.has(m)) wet.delete(m);
      for (const a of ['position', 'aSize', 'aKind', 'aPhase']) hg.attributes[a].needsUpdate = true;
      pools.instanceMatrix.needsUpdate = true;
    },
    /** lightsOn 0~1 (밤 정도), wetness 0~1 */
    update(time, lightsOn, wetness, viewScale) {
      haloU.uTime.value = time;
      haloU.uOn.value = lightsOn;
      haloU.uScale.value = viewScale;
      poolU.uOn.value = lightsOn;
      halos.visible = hg.drawRange.count > 0;
      pools.visible = pools.count > 0 && lightsOn > 0.01;
      for (const [m, s] of night) {
        if (s.written && !m.color.equals(s.written)) s.base.copy(m.color);   // 누가 색을 바꿨다 → 새 기준
        if (m.name === 'window') {
          m.color.copy(s.base).lerp(WINDOW_LIT, lightsOn * 0.85);
          if (m.emissive) m.emissive.copy(s.baseEmissive ?? tmpC.set(0)).lerp(WARM, lightsOn * 0.7);
        } else if (m.emissive) {
          // 툰 재질 등불: 스스로 빛나게
          m.color.copy(s.base).lerp(WARM, lightsOn * 0.5);
          m.emissive.copy(s.baseEmissive ?? tmpC.set(0)).lerp(WARM, lightsOn * 0.9);
        } else {
          // 평면(flat) 등불: 낮엔 살짝 꺼진 색, 밤엔 따뜻한 불빛
          m.color.copy(s.base).multiplyScalar(0.84 + 0.16 * lightsOn).lerp(WARM, lightsOn * 0.45);
        }
        (s.written ??= new THREE.Color()).copy(m.color);
      }
      for (const [m, s] of wet) {
        if (!s.written || !m.color.equals(s.written)) s.dry.copy(m.color);   // 우리가 쓴 색이 아니면 그게 마른 색
        if (wetness < 0.001) {
          if (s.written) { m.color.copy(s.dry); s.written = null; }          // 다 말랐으면 손 뗀다
          continue;
        }
        m.color.copy(s.dry).multiplyScalar(1 - 0.3 * wetness);
        m.color.b += (s.dry.b * 1.06 - s.dry.b) * wetness * 0.6;         // 젖으면 살짝 푸르스름
        (s.written ??= new THREE.Color()).copy(m.color);
      }
    },
    counts: () => ({ night: night.size, wet: wet.size, halos: hg.drawRange.count }),
  };
}
