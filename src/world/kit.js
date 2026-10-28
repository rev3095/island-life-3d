// 배경 모델 → '판'(템플릿) → InstancedMesh 묶음.
// 한 모델의 여러 재질을 꼭짓점 색으로 합쳐 [툰 · 평면 · 외곽선] 세 덩어리로 만든다 → 종류마다 그리기 호출 2~3번.
// 계절·색 변형은 꼭짓점 색만 다시 칠한다. 잎·꽃 흔들림(sway)과 흔들기(shake)는 셰이더에서 한다.
// 합치면 재질 이름이 사라지므로 이름의 스타일 효과(바람·물결·하이라이트)는 꼭짓점 속성 aStyle 로 남긴다 (materials.styleClass).
// 외곽선 판도 꼭짓점 색을 가져서 은은한 외곽선이 물체 색을 따라간다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 편집기·core 와 같은 규칙: 외곽선 없는 재질, 평면(그늘 없는) 재질
const NO_OUTLINE = new Set(['eye', 'eyeHighlight', 'blush', 'marking', 'innerEar', 'glasses', 'glow', 'flame', 'flameCore', 'crack', 'paper',
  'waterLight', 'center', 'petalDark', 'rockDark', 'shellRib', 'flower', 'grassDark', 'pebble', 'window']);
const FLAT = new Set(['eye', 'eyeHighlight', 'blush']);
// 이름을 지켜야 하는 재질: sky(T5)가 재질 이름으로 밤 조명(glow·window)·빛무리(glow·flame)를 붙인다 → 따로 떼어 같은 이름의 재질로 그린다
const NAMED = new Set(['glow', 'window', 'flame']);

// 흔들림 셰이더: aSway = (세기, 중심 높이). 인스턴스 위치로 위상을 달리한다. aShake = 흔들기 시작 시각.
const SWAY_GLSL = /* glsl */ `
#ifdef USE_INSTANCING
  vec2 swP = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
#else
  vec2 swP = vec2(0.0);
#endif
  float swH = max(transformed.y - aSway.y, 0.0) * aSway.x;
  float swT = uTime * 1.5 + swP.x * 0.41 + swP.y * 0.27;
  vec2 swD = vec2(sin(swT), cos(swT * 0.83)) * 0.03 * swH;
  float shk = uTime - aShake;
  if (shk > 0.0 && shk < 0.8) swD += vec2(sin(shk * 34.0), cos(shk * 27.0)) * 0.09 * (1.0 - shk / 0.8) * swH;
  transformed.xz += swD;
`;

export function createKit(ctx) {
  const { materials } = ctx;
  const uTime = { value: 0 };
  const matCache = new Map();

  /** 꼭짓점 색 재질 (공유). type: toon | flat | outline, name: 재질 이름 (sky 가 이름으로 찾는다) */
  function material(type, { sway = false, width = 0.01, name = `kit-${type}` } = {}) {
    const key = `${type}|${sway}|${type === 'outline' ? width : name}`;
    if (matCache.has(key)) return matCache.get(key);
    let m;
    if (type === 'outline') m = materials.outlineMaterial(width, { styleAttr: true });
    else m = materials.toonMaterial('#ffffff', { flat: type === 'flat', name, styleAttr: true });
    m.vertexColors = true;
    if (sway) {
      const base = m.onBeforeCompile;
      const baseKey = m.customProgramCacheKey();
      m.onBeforeCompile = (sh, r) => {
        base.call(m, sh, r);
        sh.uniforms.uTime = uTime;
        sh.vertexShader = 'attribute vec2 aSway;\nattribute float aShake;\nuniform float uTime;\n'
          + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_GLSL);
      };
      m.customProgramCacheKey = () => baseKey + '-sway';
    }
    matCache.set(key, m);
    return m;
  }

  /**
   * 판 만들기. gltf 장면의 메시를 원점 기준으로 굳혀 합친다.
   * opts.palette: 재질 이름 → 색 (스펙 palette + 변형), opts.sway: 흔들림을 쓸지, opts.outline: 외곽선 굵기 (0 이면 없음)
   * opts.materialName: 합친 재질 이름 (땅 타일은 'ground' → 비 올 때 sky 가 젖은 색으로)
   */
  function buildTemplate(gltf, spec, { palette = {}, sway = false, outline, castShadow = true, noOutline = [], materialName = null } = {}) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    // 흔들리는 노드: 애니메이션 트랙이 가리키는 노드 (나무는 canopy, 덤불은 전체)
    const swayNodes = new Map();
    if (sway) {
      for (const clip of gltf.animations) for (const tr of clip.tracks) {
        const node = root.getObjectByName(tr.name.split('.')[0]);
        if (node && !swayNodes.has(node)) swayNodes.set(node, new THREE.Vector3().setFromMatrixPosition(node.matrixWorld).y);
      }
    }
    const width = outline ?? spec?.style?.outlineWidth ?? 0.01;
    const skipOutline = new Set([...NO_OUTLINE, ...(spec?.style?.noOutline ?? []), ...noOutline]);
    const flatSet = new Set([...FLAT, ...(spec?.style?.flat ?? [])]);
    const groups = new Map();            // '종류|재질 이름' → 부품 목록
    const push = (key, part) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(part); };
    root.traverse(o => {
      if (!o.isMesh) return;
      const name = o.material.name;
      let swayW = 0, pivot = 0;
      for (let p = o; p && p !== root; p = p.parent) if (swayNodes.has(p)) { swayW = 1; pivot = swayNodes.get(p); break; }
      if (sway && !swayNodes.size) { swayW = 1; pivot = 0; }            // 애니메이션 노드가 없으면 전체를 땅 기준으로
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', o.geometry.attributes.position.clone());
      g.setAttribute('normal', o.geometry.attributes.normal.clone());
      if (o.geometry.index) g.setIndex(o.geometry.index.clone());
      g.applyMatrix4(o.matrixWorld);
      const n = g.attributes.position.count;
      g.setAttribute('aStyle', new THREE.BufferAttribute(new Float32Array(n).fill(materials.styleClass?.(name) ?? 0), 1));
      if (sway) {
        const sw = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) { sw[i * 2] = swayW; sw[i * 2 + 1] = pivot; }
        g.setAttribute('aSway', new THREE.BufferAttribute(sw, 2));
      }
      const part = { g, name, srcColor: o.material.color.clone() };
      const type = flatSet.has(name) ? 'flat' : 'toon';
      push(`${type}|${NAMED.has(name) ? name : materialName ?? `kit-${type}`}`, part);
      if (width > 0 && !skipOutline.has(name)) push('outline|', { g: g.clone(), name, srcColor: part.srcColor });
    });

    const parts = [];
    for (const [key, list] of groups) {
      const [type, matName] = key.split('|');
      const ranges = [];
      let start = 0;
      for (const p of list) { ranges.push({ name: p.name, start, count: p.g.attributes.position.count, src: p.srcColor }); start += p.g.attributes.position.count; }
      const geo = list.length === 1 ? list[0].g : mergeGeometries(list.map(p => p.g), false);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(start * 3), 3));   // 외곽선 판도 (물체 색을 어둡게 쓴다)
      geo.computeBoundingSphere();
      parts.push({
        type, geometry: geo, ranges,
        material: material(type, { sway, width, name: matName || undefined }),
        castShadow: type !== 'outline' && castShadow, receiveShadow: type !== 'outline',
      });
    }
    const tpl = { parts, sway, palette: {}, recolor };
    recolor(palette);
    return tpl;

    /** 재질 이름 → 색 으로 꼭짓점 색을 다시 칠한다 (계절·변형) */
    function recolor(pal) {
      Object.assign(tpl.palette, pal);
      const c = new THREE.Color();
      for (const part of parts) {
        const col = part.geometry.attributes.color;
        if (!col) continue;
        for (const r of part.ranges) {
          if (tpl.palette[r.name]) c.set(tpl.palette[r.name]); else c.copy(r.src);
          for (let i = r.start; i < r.start + r.count; i++) col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
      }
    }
  }

  /** 인스턴스 묶음: 판 하나를 여러 위치에 그린다. 툰·평면·외곽선 메시가 instanceMatrix 를 같이 쓴다. */
  class Batch {
    constructor(tpl, capacity = 16, parent = ctx.scene) {
      this.tpl = tpl; this.parent = parent;
      this.ids = []; this.count = 0; this.capacity = 0; this.meshes = [];
      this.dirty = false;
      this.grow(Math.max(4, capacity));
    }
    grow(cap) {
      const old = this.meshes;
      const oldMatrix = old[0]?.instanceMatrix, oldShake = this.shake;
      this.capacity = cap;
      this.matrix = new THREE.InstancedBufferAttribute(new Float32Array(cap * 16), 16);
      this.matrix.setUsage(THREE.DynamicDrawUsage);
      if (oldMatrix) this.matrix.array.set(oldMatrix.array.subarray(0, this.count * 16));
      if (this.tpl.sway) {
        this.shake = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(-100), 1);
        if (oldShake) this.shake.array.set(oldShake.array.subarray(0, this.count));
      }
      this.meshes = this.tpl.parts.map(part => {
        const g = new THREE.BufferGeometry();
        for (const [k, v] of Object.entries(part.geometry.attributes)) g.setAttribute(k, v);
        g.setIndex(part.geometry.index);
        g.boundingSphere = part.geometry.boundingSphere;
        if (this.shake) g.setAttribute('aShake', this.shake);
        const m = new THREE.InstancedMesh(g, part.material, cap);
        m.instanceMatrix = this.matrix;
        m.count = this.count;
        m.castShadow = part.castShadow;
        m.receiveShadow = part.receiveShadow;
        if (part.type === 'outline') m.userData.outline = true;
        return m;
      });
      for (const m of old) { this.parent.remove(m); all.delete(m); }
      for (const m of this.meshes) this.parent.add(m);
      this.dirty = true;
    }
    /** 위치 추가 → 칸 번호 */
    add(id, matrix) {
      if (this.count >= this.capacity) this.grow(this.capacity * 2);
      const slot = this.count++;
      this.ids[slot] = id;
      matrix.toArray(this.matrix.array, slot * 16);
      if (this.shake) this.shake.array[slot] = -100;
      this.dirty = true;
      return slot;
    }
    /** 칸 지우기 (마지막 칸을 빈자리로 옮긴다) → 옮겨진 id (없으면 null) */
    remove(slot) {
      const last = --this.count;
      let moved = null;
      if (slot !== last) {
        this.matrix.array.copyWithin(slot * 16, last * 16, last * 16 + 16);
        if (this.shake) this.shake.array[slot] = this.shake.array[last];
        moved = this.ids[slot] = this.ids[last];
      }
      this.ids.length = this.count;
      this.dirty = true;
      return moved;
    }
    shakeAt(slot) {
      if (!this.shake) return;
      this.shake.array[slot] = uTime.value;
      this.shake.needsUpdate = true;
    }
    setOutlineVisible(v) { for (const m of this.meshes) if (m.userData.outline) m.visible = v; }
    /** 바뀐 내용을 GPU 로 (한 프레임에 한 번) */
    flush() {
      if (!this.dirty) return;
      this.dirty = false;
      this.matrix.needsUpdate = true;
      if (this.shake) this.shake.needsUpdate = true;
      for (const m of this.meshes) {
        m.count = this.count;
        m.visible = this.count > 0 && (!m.userData.outline || ctx.state.settings.outline !== false);
        m.computeBoundingSphere();
        if (m.boundingSphere) m.userData.s0 = m.boundingSphere.clone();
      }
      bendSpheres(this.meshes);
    }
  }

  // 곡면 월드: 화면에는 휘어서(아래로 내려가서) 보이는데 three 는 휘기 전 자리로 화면 밖인지 따진다.
  // 초점보다 북쪽(먼 쪽) 묶음은 구를 휜 만큼 내리고, 구 안에서 휘는 정도가 다른 만큼 반지름을 늘린다.
  // 남쪽(카메라 쪽)은 휘면 더 아래로 내려가 화면 밖이 될 뿐이라 그대로 둔다.
  let lastZ = NaN, lastK = NaN;
  const all = new Set();
  function bendSpheres(meshes) {
    const fz = ctx.focus.z, k = materials.curve.uCurve.value;
    for (const m of meshes) {
      all.add(m);
      const s = m.boundingSphere, s0 = m.userData.s0;
      if (!s || !s0) continue;
      s.copy(s0);
      const dz = fz - s0.center.z, r = s0.radius;     // 북쪽으로 얼마나 먼가
      if (dz + r <= 0) continue;
      const a = Math.max(dz, 0);
      s.center.y -= k * a * a;
      s.radius += k * (2 * a * r + r * r) + 0.3;
    }
  }
  /** 매 프레임: 초점이 움직였으면 모든 묶음의 구를 다시 늘린다 */
  function updateCulling() {
    const fz = ctx.focus.z, k = materials.curve.uCurve.value;
    if (Math.abs(fz - lastZ) < 0.5 && Math.abs(k - lastK) < 0.0001) return;
    lastZ = fz; lastK = k;
    bendSpheres(all);
  }

  return { uTime, material, buildTemplate, Batch, updateCulling };
}
