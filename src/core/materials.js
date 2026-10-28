// 툰 재질 · 외곽선 · 곡면 월드. 게임 안의 모든 3D 모델은 여기서 만든 재질을 쓴다.
// 곡면 월드: 화면 중심(플레이어)에서 앞뒤(Z)로 멀어질수록 땅이 아래로 휘어 "굴러가는 통나무" 위에 있는 느낌을 낸다.
// 그림자 조회는 휘기 전 좌표(worldPosition)를 쓰므로 그림자 위치는 어긋나지 않는다.
import * as THREE from 'three';

export const curve = {
  uCurve: { value: 0.0016 },              // 0 이면 평평한 세상
  uCurveOrigin: { value: new THREE.Vector3() },
};

const PROJECT_CURVED = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 curvedWorld = modelMatrix * mvPosition;
float curveDz = curvedWorld.z - uCurveOrigin.z;
curvedWorld.y -= curveDz * curveDz * uCurve;
mvPosition = viewMatrix * curvedWorld;
gl_Position = projectionMatrix * mvPosition;
`;

function patch(shader, outline) {
  shader.uniforms.uCurve = curve.uCurve;
  shader.uniforms.uCurveOrigin = curve.uCurveOrigin;
  let vs = 'uniform float uCurve;\nuniform vec3 uCurveOrigin;\n' + shader.vertexShader;
  if (outline) {
    shader.uniforms.uOutline = outline;
    vs = 'uniform float uOutline;\n' + vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize( normal ) * uOutline;');
  }
  shader.vertexShader = vs.replace('#include <project_vertex>', PROJECT_CURVED);
}

/** 기존 재질에 곡면 월드 패치를 건다 (같은 종류 재질끼리 셰이더 프로그램을 공유한다). */
export function curved(material) {
  material.onBeforeCompile = sh => patch(sh, null);
  material.customProgramCacheKey = () => 'curved';
  return material;
}

/** 2단 툰 명암 (편집기·Blender 렌더와 같은 값) */
export const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([168, 168, 168, 255, 255, 255, 255, 255]), 2, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export const OUTLINE_COLOR = '#4A3B32';

export function toonMaterial(color, { flat = false, bend = true, name = '' } = {}) {
  const m = flat ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshToonMaterial({ color, gradientMap: toonGradient });
  m.name = name;
  return bend ? curved(m) : m;
}

/** 뒤집은 껍데기 외곽선 재질. width 는 모델 단위(타일 1칸 = 1). */
export function outlineMaterial(width = 0.01, { color = OUTLINE_COLOR, bend = true } = {}) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const uOutline = { value: width };
  m.userData.uOutline = uOutline;
  m.onBeforeCompile = sh => {
    if (bend) patch(sh, uOutline);
    else {
      sh.uniforms.uOutline = uOutline;
      sh.vertexShader = 'uniform float uOutline;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize( normal ) * uOutline;');
    }
  };
  m.customProgramCacheKey = () => (bend ? 'curved-outline' : 'outline');
  return m;
}

const DEFAULT_NO_OUTLINE = ['eye', 'eyeHighlight', 'blush', 'marking', 'innerEar', 'glasses', 'glow', 'flame', 'flameCore', 'crack', 'paper',
  'waterLight', 'center', 'petalDark', 'rockDark', 'shellRib', 'flower', 'grassDark', 'pebble', 'window'];
const DEFAULT_FLAT = ['eye', 'eyeHighlight', 'blush'];

/**
 * glTF 장면의 재질을 툰 재질로 바꾸고 외곽선을 붙인다.
 * 돌려주는 값: { materials: {재질이름: [재질...]}, outlines: [메시...], setColor(name, hex), setOutlineVisible(bool) }
 * spec(편집기 스펙)을 넘기면 style.flat / style.outlineWidth 를 그대로 따른다.
 */
export function applyToonStyle(root, { spec = null, flat = [], noOutline = [], outlineWidth, bend = true } = {}) {
  const flatSet = new Set([...DEFAULT_FLAT, ...flat, ...(spec?.style?.flat ?? [])]);
  const noOutlineSet = new Set([...DEFAULT_NO_OUTLINE, ...noOutline, ...(spec?.style?.noOutline ?? [])]);
  const ol = outlineMaterial(outlineWidth ?? spec?.style?.outlineWidth ?? 0.006, { bend });
  const materials = {};
  const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.userData.outline) meshes.push(o); });
  for (const o of meshes) {
    const src = o.material;
    const m = toonMaterial(src.color.clone(), { flat: flatSet.has(src.name), bend, name: src.name });
    o.material = m;
    o.castShadow = true;
    o.receiveShadow = true;
    (materials[src.name] ||= []).push(m);
  }
  const outlines = [];
  for (const o of meshes) {
    if (noOutlineSet.has(o.material.name)) continue;
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
    hull.castShadow = false;
    hull.frustumCulled = !o.isSkinnedMesh;
    outlines.push(hull);
  }
  for (const o of meshes) if (o.isSkinnedMesh) o.frustumCulled = false;
  return {
    materials, outlines, outlineMaterial: ol,
    setColor(name, hex) { (materials[name] ?? []).forEach(m => m.color.set(hex)); },
    setOutlineVisible(v) { outlines.forEach(h => { h.visible = v; }); },
  };
}
