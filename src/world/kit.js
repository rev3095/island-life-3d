// 배경 모델 → '판'(템플릿) → InstancedMesh 묶음.
// 한 모델의 여러 재질을 꼭짓점 색으로 합쳐 [툰 · 평면 · 외곽선] 세 덩어리로 만든다 → 종류마다 그리기 호출 2~3번.
// 계절·색 변형은 꼭짓점 색만 다시 칠한다. 잎·꽃 흔들림(sway)과 흔들기(shake)는 셰이더에서 한다.
// 합치면 재질 이름이 사라지므로 이름의 스타일 효과(바람·물결·하이라이트)는 꼭짓점 속성 aStyle 로 남긴다 (materials.styleClass).
// 외곽선 판도 꼭짓점 색을 가져서 은은한 외곽선이 물체 색을 따라간다.
// 묶음은 종류마다 섬 전체에 하나: 그리기 직전 prepareFrame() 이 칸마다 화면 밖(곡면 월드 반영)·그림자 밖을 빼고 가까운 순으로 담는다.
// 칸마다 aFade(가림 투명, occlusion.js)를 두어 카메라와 플레이어 사이 물체를 디더로 비치게 한다.
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

// 가림 투명(디더)은 materials 공용: 묶음이 칸마다 aFade(0~1) 인스턴스 속성을 주면 모든 kit 재질(툰·평면·외곽선)이 그만큼 비친다.

export function createKit(ctx) {
  const { materials } = ctx;
  const uTime = { value: 0 };
  const matCache = new Map();

  /** 흔들림(aSway·aShake) 셰이더를 덧붙인다 — 그리는 재질과 그림자 깊이 재질이 같은 모양으로 흔들리게 */
  const addSway = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = ('attribute vec2 aSway;\nattribute float aShake;\nuniform float uTime;\n' + sh.vertexShader)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_GLSL);
  };

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
      const baseKey = m.customProgramCacheKey;   // 그때그때 읽는다 (셰이더 등급이 사양 따라 바뀜)
      m.onBeforeCompile = (sh, r) => { base.call(m, sh, r); addSway(sh); };
      m.customProgramCacheKey = () => baseKey.call(m) + '-sway';
    }
    matCache.set(key, m);
    return m;
  }

  /** 그림자 깊이 재질: 바람(aStyle 1)과 흔들림·흔들기를 그림자에도 (materials.shadowDepthMaterial 위에 흔들림을 얹는다) */
  function depthMaterial(sway) {
    if (!materials.shadowDepthMaterial) return undefined;
    return sway ? materials.shadowDepthMaterial({ attr: true }, { key: 'kit-sway', extra: addSway })
      : materials.shadowDepthMaterial({ attr: true });
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
    // 바람(aStyle 1) 부품이나 흔들림이 있으면 그림자도 같이 흔들리게
    const windy = sway || [...groups.values()].some(list => list.some(p => materials.styleClass?.(p.name) === 1));
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
        depth: type !== 'outline' && castShadow && windy ? depthMaterial(sway) : undefined,
      });
    }
    // 판 전체를 감싸는 구 (칸마다 화면 밖 판정에 쓴다). 흔들림·흔들기 몫만큼 여유
    const box = new THREE.Box3();
    for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.radius += sway ? 0.15 : 0.02;
    const tpl = { parts, sway, palette: {}, recolor, sphere, shadow: parts.some(p => p.castShadow) };
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

  /**
   * 인스턴스 묶음: 판 하나를 여러 위치에 그린다. 툰·평면·외곽선 메시가 instanceMatrix 를 같이 쓴다.
   * 칸(slot)마다 원본(위치 행렬·흔들기·가림 투명·감싸는 구)을 따로 들고, 매 프레임 prepare() 가 본 카메라·그림자 카메라에
   * 걸리는 칸만 앞에서부터 GPU 버퍼에 옮겨 담는다 → 섬 전체를 한 묶음으로 둬도(그리기 호출 적게) 보이는 것만 그린다.
   * 담는 순서는 카메라에서 가까운 것부터 (앞 물체가 먼저 깊이를 채워 뒤 조각을 덜 칠한다). 외곽선은 가까운 것만
   * (멀면 굵기가 1화소도 안 된다) — 외곽선 메시의 count 를 가까운 칸 수로 둔다.
   */
  class Batch {
    constructor(tpl, capacity = 16, parent = ctx.scene) {
      this.tpl = tpl; this.parent = parent;
      this.ids = []; this.count = 0; this.capacity = 0; this.meshes = [];
      this.dirty = false;          // 칸 내용이 바뀜 → 다음 prepare 에서 다시 골라 담는다
      this.drawn = -1;             // 지금 GPU 에 담긴 칸 수
      this.grow(Math.max(4, capacity));
      batches.add(this);
    }
    grow(cap) {
      const old = this.meshes, n = this.count;
      const keep = (src, k, fill = 0) => { const a = new Float32Array(cap * k).fill(fill); if (src) a.set(src.subarray(0, n * k)); return a; };
      this.capacity = cap;
      this.mat = keep(this.mat, 16);             // 칸별 원본
      this.fad = keep(this.fad, 1);
      this.sph = keep(this.sph, 4);
      if (this.tpl.sway) this.shk = keep(this.shk, 1, -100);
      this.drawOf = new Int32Array(cap).fill(-1);  // 칸 → GPU 자리 (-1 = 안 그림)
      this.slotOf = new Int32Array(cap);           // GPU 자리 → 칸 (지금 담긴 순서)
      this.visTmp = new Int32Array(cap);           // 이번에 보이는 칸 / 거리 칸 (가까운 순 정렬용)
      this.binTmp = new Uint8Array(cap);
      this.orderTmp = new Int32Array(cap);
      this.near = -1;                              // 외곽선을 그리는 가까운 칸 수
      // GPU 쪽 (보이는 칸만 앞에서부터)
      const attr = k => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * k), k); a.setUsage(THREE.DynamicDrawUsage); return a; };
      this.matrix = attr(16);
      this.fade = attr(1);                       // 가림 투명 정도 (occlusion.js 가 바꾼다)
      this.shake = this.tpl.sway ? attr(1) : null;
      this.meshes = this.tpl.parts.map(part => {
        const g = new THREE.BufferGeometry();
        for (const [k, v] of Object.entries(part.geometry.attributes)) g.setAttribute(k, v);
        g.setIndex(part.geometry.index);
        g.boundingSphere = part.geometry.boundingSphere;
        if (this.shake) g.setAttribute('aShake', this.shake);
        g.setAttribute('aFade', this.fade);
        const m = new THREE.InstancedMesh(g, part.material, cap);
        m.instanceMatrix = this.matrix;
        m.count = 0;
        m.frustumCulled = false;                 // 화면 밖 판정은 칸마다 여기서 한다 (곡면 월드 반영)
        m.renderOrder = this.tpl.renderOrder ?? 0;
        m.castShadow = part.castShadow;
        m.receiveShadow = part.receiveShadow;
        if (part.depth) m.customDepthMaterial = part.depth;
        if (part.type === 'outline') m.userData.outline = true;
        return m;
      });
      for (const m of old) this.parent.remove(m);
      for (const m of this.meshes) this.parent.add(m);
      this.drawn = -1;
      this.dirty = true;
      this.refreshVisible();
    }
    /** 위치 추가 → 칸 번호 */
    add(id, matrix) {
      if (this.count >= this.capacity) this.grow(this.capacity * 2);
      const slot = this.count++;
      this.ids[slot] = id;
      matrix.toArray(this.mat, slot * 16);
      tv.copy(this.tpl.sphere.center).applyMatrix4(matrix);
      this.sph[slot * 4] = tv.x; this.sph[slot * 4 + 1] = tv.y; this.sph[slot * 4 + 2] = tv.z;
      this.sph[slot * 4 + 3] = this.tpl.sphere.radius * matrix.getMaxScaleOnAxis();
      if (this.shk) this.shk[slot] = -100;
      this.fad[slot] = 0;
      this.drawOf[slot] = -1;
      this.dirty = true;
      return slot;
    }
    /** 칸 지우기 (마지막 칸을 빈자리로 옮긴다) → 옮겨진 id (없으면 null) */
    remove(slot) {
      const last = --this.count;
      let moved = null;
      if (slot !== last) {
        this.mat.copyWithin(slot * 16, last * 16, last * 16 + 16);
        this.sph.copyWithin(slot * 4, last * 4, last * 4 + 4);
        if (this.shk) this.shk[slot] = this.shk[last];
        this.fad[slot] = this.fad[last];
        moved = this.ids[slot] = this.ids[last];
      }
      this.ids.length = this.count;
      this.dirty = true;
      return moved;
    }
    shakeAt(slot) {
      if (!this.shk) return;
      this.shk[slot] = uTime.value;
      const d = this.drawOf[slot];
      if (d >= 0) { this.shake.array[d] = uTime.value; this.shake.needsUpdate = true; }
    }
    /** 가림 투명 정도 0~1 (칸마다) */
    setFade(slot, v) {
      if (slot < 0 || slot >= this.count || this.fad[slot] === v) return;
      this.fad[slot] = v;
      const d = this.drawOf[slot];
      if (d >= 0) { this.fade.array[d] = v; this.fade.needsUpdate = true; }
    }
    setOutlineVisible() { this.refreshVisible(); }
    refreshVisible() {
      const ol = ctx.state.settings.outline !== false;
      for (const m of this.meshes) m.visible = m.count > 0 && (!m.userData.outline || ol);
    }
    /** 보이는 칸만 가까운 순으로 GPU 버퍼 앞쪽에 담는다. 고른 칸·순서가 그대로면 아무것도 안 올린다 */
    cull(test, cx, cy, cz, olFar) {
      const shadow = this.tpl.shadow, vis = this.visTmp, bin = this.binTmp, sph = this.sph;
      let n = 0, near = 0;
      for (let s = 0; s < this.count; s++) {
        if (!test(sph, s * 4, shadow)) continue;
        const i = s * 4, d = Math.hypot(sph[i] - cx, sph[i + 1] - cy, sph[i + 2] - cz) - sph[i + 3];
        bin[n] = Math.min(BINS - 1, Math.max(0, Math.floor(d / BIN)));
        if (d < olFar) near++;
        vis[n++] = s;
      }
      // 거리 칸으로 세어 늘어놓기 (가까운 것부터, 같은 칸 안은 원래 순서)
      binCount.fill(0);
      for (let i = 0; i < n; i++) binCount[bin[i] + 1]++;
      for (let b = 1; b <= BINS; b++) binCount[b] += binCount[b - 1];
      const order = this.orderTmp;
      for (let i = 0; i < n; i++) order[binCount[bin[i]]++] = vis[i];
      let changed = this.dirty || n !== this.drawn || near !== this.near;
      if (!changed) for (let i = 0; i < n; i++) if (order[i] !== this.slotOf[i]) { changed = true; break; }
      this.dirty = false;
      if (!changed) return;
      for (let i = 0; i < this.drawn; i++) this.drawOf[this.slotOf[i]] = -1;
      const M = this.matrix.array, F = this.fade.array, S = this.shake?.array;
      for (let i = 0; i < n; i++) {
        const s = order[i];
        this.slotOf[i] = s;
        this.drawOf[s] = i;
        M.set(this.mat.subarray(s * 16, s * 16 + 16), i * 16);
        F[i] = this.fad[s];
        if (S) S[i] = this.shk[s];
      }
      this.matrix.needsUpdate = true;
      this.fade.needsUpdate = true;
      if (this.shake) this.shake.needsUpdate = true;
      this.drawn = n;
      this.near = near;
      for (const m of this.meshes) m.count = m.userData.outline ? near : n;
      this.refreshVisible();
    }
  }

  // ── 칸마다 화면 밖 판정 (매 프레임 그리기 직전, render 가 world.prepareFrame() 으로 부른다) ──
  // 곡면 월드: 화면에는 초점에서 떨어진 만큼(dz²·uCurve) 내려가 보이는데 three 는 휘기 전 자리로 판정한다 → 구를 그만큼 내리고 키운다.
  // 그림자 카메라는 휘기 전 자리 그대로 (그림자는 휘기 전 좌표로 그린다). 둘 중 하나에라도 걸리면 그린다.
  const batches = new Set();
  // 섬폰 외곽선 설정: main.js 가 외곽선 메시를 모두 켜고 끈 뒤 빈 묶음(count 0)은 다시 숨긴다 (빈 그리기 호출 방지)
  ctx.events?.on('settings:changed', ({ key }) => { if (key === 'outline') for (const b of batches) b.refreshVisible(); });
  const BIN = 2, BINS = 64, binCount = new Int32Array(BINS + 1);     // 가까운 순 정렬: 2칸 단위 거리 칸
  // 외곽선을 그리는 거리 (카메라에서). 1280×800 에서 30 이면 굵기가 0.3화소쯤 → 그 너머는 안 보인다. 적정은 조금 더 가깝게 (낮음 아래는 외곽선 없음)
  const OUTLINE_FAR = { high: 30, mid: 26 };
  // 그리는 거리 (초점에서, 칸). 낮은 사양은 먼 칸을 뺀다 — 곡면 월드라 먼 곳은 지평선 쪽으로 내려가 작게 보인다. 없으면 끝까지 (render/quality.js 사양 이름)
  const DRAW_FAR = { low: 28, min: 22 };   // 광장에서 삼각형 낮음 −8% · 매우 낮음 −26% (2026-11-01, 1280×800)
  const tv = new THREE.Vector3(), pm = new THREE.Matrix4();
  const view = new THREE.Frustum();
  let shadowF = null, curK = 0, curZ = 0;
  const outside = (planes, x, y, z, r) => {
    for (let i = 0; i < 6; i++) { const p = planes[i]; if (p.normal.x * x + p.normal.y * y + p.normal.z * z + p.constant < -r) return true; }
    return false;
  };
  let farR2 = 0, curX = 0;
  const test = (sph, i, shadow) => {
    const x = sph[i], y = sph[i + 1], z = sph[i + 2], r = sph[i + 3];
    if (farR2 && (x - curX) ** 2 + (z - curZ) ** 2 > farR2 + r * r) return false;
    const dz = Math.abs(z - curZ);
    if (!outside(view.planes, x, y - curK * dz * dz, z, r + curK * (2 * dz * r + r * r) + 0.05)) return true;
    return shadow && shadowF !== null && !outside(shadowF.planes, x, y, z, r);
  };
  let lastKey = '', lastOl = 0, hooked = false;
  function prepare() {
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    view.setFromProjectionMatrix(pm);
    curK = materials.curve.uCurve.value; curZ = ctx.focus.z; curX = ctx.focus.x;
    const far = api.drawFar[ctx.quality] ?? 0;
    farR2 = far > 0 ? far * far : 0;
    shadowF = null;
    const sun = ctx.lights?.sun;
    if (sun?.castShadow && ctx.renderer.shadowMap.enabled) {
      sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
      sun.shadow.updateMatrices(sun);
      shadowF = sun.shadow.getFrustum();
    }
    // 카메라·곡면·그림자 카메라가 그대로면 바뀐 묶음만 다시 고른다
    const e = pm.elements, s = shadowF ? sun.shadow.matrix.elements : null;
    const key = `${e[12].toFixed(3)},${e[13].toFixed(3)},${e[14].toFixed(3)},${e[0].toFixed(4)},${e[5].toFixed(4)},${e[6].toFixed(4)},${curK.toFixed(5)},${curZ.toFixed(2)}`
      + (s ? `|${s[12].toFixed(3)},${s[13].toFixed(3)},${s[0].toFixed(4)},${s[5].toFixed(4)}` : '') + (farR2 ? `|${curX.toFixed(1)},${farR2}` : '');
    const olFar = OUTLINE_FAR[ctx.quality] ?? OUTLINE_FAR.high;
    const all = key !== lastKey || olFar !== lastOl;
    lastKey = key; lastOl = olFar;
    tv.setFromMatrixPosition(cam.matrixWorld);
    const t = api.noCull ? keepAll : test;
    for (const b of batches) if (all || b.dirty) b.cull(t, tv.x, tv.y, tv.z, olFar);
  }
  const keepAll = () => true;
  /** world.update 에서: render 가 prepareFrame 을 부르지 않는 경우(다른 그리기)에만 여기서 고른다 (한 프레임 늦음) */
  function updateCulling() { if (!hooked) prepare(); }
  /** 그리기 직전 (render 가 부른다) */
  function prepareFrame() { hooked = true; prepare(); }

  // noCull: 확인용 — true 면 칸마다 판정 없이 모두 그린다 (가까운 순 정렬·외곽선 거리는 그대로)
  const api = { uTime, material, buildTemplate, Batch, updateCulling, prepareFrame, batches, noCull: false, drawFar: DRAW_FAR };
  return api;
}
