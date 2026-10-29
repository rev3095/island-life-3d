// 채집에서 쓰는 작은 모델: 떨어진 물건(과일·나뭇가지·재료·도토리 주머니·선물), 들어 보이는 물고기·화석, 찌, 물고기 그림자.
// 도형 여러 개를 꼭짓점 색으로 합쳐 메시 하나 + 외곽선 하나로 그린다 (재질은 ctx.materials 의 툰·곡면 월드).
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FRUIT_COLOR = { apple: '#E8504F', pear: '#D9D36A', peach: '#F7A6A0', cherry: '#B5232F', orange: '#F39A3B', coconut: '#7A5232' };
const LEAF = '#5FAE5A', STEM = '#7F5636';

// 물고기 몸 색은 아이템 데이터 colors { body, back, belly, fin } (data/items.js, 4차 Y2). 없으면 이 색
const FISH_FALLBACK = { body: '#8FA7B5', back: '#6E8898', belly: '#F7F1E4', fin: '#7E98A8' };

export function createMeshKit(ctx) {
  const { THREE, materials } = ctx;
  const T = THREE;
  const toon = materials.toonMaterial('#ffffff', { name: 'gather' });
  toon.vertexColors = true;
  const flat = materials.toonMaterial('#ffffff', { flat: true, name: 'gather-flat' });
  flat.vertexColors = true;
  const outlines = new Map();
  const outlineMat = w => { if (!outlines.has(w)) outlines.set(w, materials.outlineMaterial(w)); return outlines.get(w); };
  const cache = new Map();
  const col = new T.Color();
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3();

  /** 도형 한 조각: 위치·회전·크기를 굳히고 색을 칠한다 */
  function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], sc = [1, 1, 1] } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m4.compose(v.set(...p), q.setFromEuler(e.set(...r)), s.set(...(Array.isArray(sc) ? sc : [sc, sc, sc]))));
    col.set(color);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    return g;
  }
  /** 조각의 위쪽(높이 비율 from 이상)을 다른 색으로 — 물고기 등 색 */
  function topTint(g, color, from = 0.58) {
    const pos = g.attributes.position, c = g.attributes.color;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const top = new T.Color(color), base = new T.Color(), mix = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const k = (pos.getY(i) - lo) / (hi - lo || 1);
      if (k <= from) continue;
      base.setRGB(c.getX(i), c.getY(i), c.getZ(i));
      mix.copy(base).lerp(top, Math.min(1, (k - from) / 0.2));
      c.setXYZ(i, mix.r, mix.g, mix.b);
    }
    return g;
  }
  const merge = parts => { const g = mergeGeometries(parts, false); g.computeBoundingSphere(); return g; };
  /** key 로 캐시한 합친 도형 */
  const geometry = (key, build) => { if (!cache.has(key)) cache.set(key, merge(build())); return cache.get(key); };

  /** 메시 + 외곽선. opts: { flat, outline: 굵기(0 = 없음), shadow } */
  function mesh(geo, { flat: isFlat = false, outline = 0.005, shadow = false } = {}) {
    const m = new T.Mesh(geo, isFlat ? flat : toon);
    m.castShadow = shadow;
    if (outline > 0) {
      const hull = new T.Mesh(geo, outlineMat(outline));
      hull.userData.outline = true;
      hull.visible = ctx.state.settings?.outline !== false;
      m.add(hull);
    }
    return m;
  }

  // 자주 쓰는 도형
  const G = {
    sphere: (r = 1, w = 10, h = 7) => new T.SphereGeometry(r, w, h),
    cyl: (r1, r2, h, n = 8) => new T.CylinderGeometry(r1, r2, h, n),
    box: (x, y, z) => new T.BoxGeometry(x, y, z),
    cone: (r, h, n = 8) => new T.ConeGeometry(r, h, n),
    torus: (r, t, a = 6, b = 14, arc = Math.PI * 2) => new T.TorusGeometry(r, t, a, b, arc),
  };

  // ---------- 떨어진 물건 ----------
  function fruitParts(kind) {
    const c = FRUIT_COLOR[kind] ?? FRUIT_COLOR.apple;
    if (kind === 'coconut') return [part(G.sphere(0.12), c, { p: [0, 0.11, 0], sc: [1, 0.92, 1] }), part(G.sphere(0.018, 6, 4), '#3E2A1C', { p: [0.03, 0.2, 0.06] }), part(G.sphere(0.018, 6, 4), '#3E2A1C', { p: [-0.04, 0.2, 0.05] })];
    if (kind === 'cherry') return [
      part(G.sphere(0.06), c, { p: [0.05, 0.06, 0] }), part(G.sphere(0.06), c, { p: [-0.05, 0.06, 0.01] }),
      part(G.cyl(0.006, 0.006, 0.12, 5), STEM, { p: [0.025, 0.16, 0], r: [0, 0, 0.4] }), part(G.cyl(0.006, 0.006, 0.12, 5), STEM, { p: [-0.025, 0.16, 0], r: [0, 0, -0.4] }),
      part(G.sphere(0.03, 6, 4), LEAF, { p: [0.04, 0.22, 0], sc: [1.4, 0.35, 0.8] }),
    ];
    const body = kind === 'pear'
      ? [part(G.sphere(0.095), c, { p: [0, 0.095, 0] }), part(G.sphere(0.065), c, { p: [0, 0.17, 0] })]
      : [part(G.sphere(0.1), c, { p: [0, 0.1, 0], sc: [1, kind === 'orange' ? 0.95 : 0.9, 1] })];
    const top = kind === 'pear' ? 0.23 : 0.19;
    return [...body, part(G.cyl(0.008, 0.01, 0.05, 5), STEM, { p: [0, top, 0] }), part(G.sphere(0.03, 6, 4), LEAF, { p: [0.032, top + 0.005, 0], sc: [1.4, 0.35, 0.8], r: [0, 0, 0.3] })];
  }
  const ITEM_PARTS = {
    'mat.branch': () => [
      part(G.cyl(0.017, 0.012, 0.42, 6), '#9A6B45', { p: [0, 0.02, 0], r: [0, 0, Math.PI / 2] }),
      part(G.cyl(0.011, 0.008, 0.15, 5), '#9A6B45', { p: [0.06, 0.02, 0.05], r: [Math.PI / 2, 0, -0.9] }),
      part(G.sphere(0.03, 6, 4), LEAF, { p: [-0.2, 0.03, 0], sc: [1.5, 0.4, 0.9] }),
    ],
    'mat.acorn-bag': () => [
      part(G.sphere(0.13), '#D9B27C', { p: [0, 0.12, 0], sc: [1, 0.9, 1] }),
      part(G.cyl(0.045, 0.06, 0.06, 8), '#D9B27C', { p: [0, 0.24, 0] }),
      part(G.cyl(0.056, 0.056, 0.022, 10), '#8A5A3A', { p: [0, 0.225, 0] }),
      part(G.sphere(0.045, 8, 5), '#D9B27C', { p: [0, 0.285, 0], sc: [1.2, 0.7, 1.2] }),
      part(G.sphere(0.038, 8, 6), '#9A6B45', { p: [0, 0.13, 0.118], sc: [1, 1.1, 0.5] }),
      part(G.sphere(0.03, 8, 5), '#5E3D26', { p: [0, 0.16, 0.12], sc: [1.3, 0.6, 0.5] }),
    ],
    'mat.wood': () => logParts('#B98957', '#E5C48F'),
    'mat.hardwood': () => logParts('#7F5636', '#C49A6C'),
    'mat.stone': () => [part(G.sphere(0.11, 7, 5), '#A8A49B', { p: [0, 0.07, 0], sc: [1, 0.72, 0.9] }), part(G.sphere(0.06, 6, 4), '#BDB9AF', { p: [0.08, 0.05, 0.05] })],
    'mat.iron': () => [part(G.sphere(0.1, 6, 4), '#6E7275', { p: [0, 0.07, 0], sc: [1, 0.8, 0.9] }), part(G.sphere(0.035, 5, 3), '#C9D2D6', { p: [0.05, 0.12, 0.04] }), part(G.sphere(0.03, 5, 3), '#C9D2D6', { p: [-0.05, 0.1, 0.06] })],
    'mat.clay': () => [part(G.sphere(0.1, 8, 6), '#C47A4E', { p: [0, 0.06, 0], sc: [1.15, 0.65, 1] }), part(G.sphere(0.05, 6, 4), '#D18D62', { p: [0.04, 0.1, 0.02], sc: [1, 0.6, 1] })],
    'mat.weed': () => [part(G.cone(0.03, 0.16, 5), '#6E9E3E', { p: [0, 0.08, 0] }), part(G.cone(0.025, 0.12, 5), '#6E9E3E', { p: [0.04, 0.06, 0], r: [0, 0, -0.5] }), part(G.cone(0.025, 0.12, 5), '#6E9E3E', { p: [-0.04, 0.06, 0], r: [0, 0, 0.5] })],
    present: () => [
      part(G.box(0.24, 0.2, 0.24), '#F2C14E', { p: [0, 0.1, 0] }),
      part(G.box(0.25, 0.205, 0.04), '#E8504F', { p: [0, 0.1, 0] }), part(G.box(0.04, 0.205, 0.25), '#E8504F', { p: [0, 0.1, 0] }),
      part(G.sphere(0.04, 8, 5), '#E8504F', { p: [0.035, 0.215, 0], sc: [1.2, 0.6, 0.7] }), part(G.sphere(0.04, 8, 5), '#E8504F', { p: [-0.035, 0.215, 0], sc: [1.2, 0.6, 0.7] }),
    ],
    fossil: () => [
      part(G.sphere(0.14, 9, 6), '#D9C7A3', { p: [0, 0.1, 0], sc: [1, 0.78, 0.9] }),
      part(G.torus(0.065, 0.016, 5, 14), '#A88A60', { p: [0, 0.12, 0.1], sc: [1, 1, 0.6] }),
      part(G.sphere(0.022, 6, 4), '#A88A60', { p: [0, 0.12, 0.11] }),
    ],
    // 감정 전 화석: 흙투성이 덩어리에 뼈 끝이 살짝 보인다
    'fossil.unknown': () => [
      part(G.sphere(0.15, 8, 6), '#9C7E5A', { p: [0, 0.1, 0], sc: [1.1, 0.75, 0.95] }),
      part(G.sphere(0.07, 6, 5), '#8A6E4C', { p: [0.08, 0.15, 0.04] }),
      part(G.cyl(0.025, 0.03, 0.12, 6), '#E8DCC0', { p: [-0.06, 0.17, 0.06], r: [0.5, 0, 0.6] }),
      part(G.sphere(0.035, 6, 4), '#E8DCC0', { p: [-0.1, 0.21, 0.09] }),
    ],
  };
  function logParts(bark, ring) {
    return [part(G.cyl(0.07, 0.07, 0.3, 10), bark, { p: [0, 0.07, 0], r: [0, 0, Math.PI / 2] }),
      part(G.cyl(0.058, 0.058, 0.006, 10), ring, { p: [0.151, 0.07, 0], r: [0, 0, Math.PI / 2] }), part(G.cyl(0.058, 0.058, 0.006, 10), ring, { p: [-0.151, 0.07, 0], r: [0, 0, Math.PI / 2] })];
  }
  const CAT_COLOR = { shell: '#F9D9C4', flower: '#E8504F', mat: '#B98957', seed: '#8FBF5A', furn: '#F2C14E', tool: '#9AA6A8', fish: '#8FA7B5', bug: '#6E5A3E', fossil: '#D9C7A3' };

  /** 아이템 id → { key, geo } 떨어진 모습 도형 (같은 key 끼리 인스턴스로 묶어 그린다) */
  function itemGeometry(id) {
    const it = ctx.services.data?.items?.get?.(id);
    const cat = it?.category ?? String(id).split('.')[0];
    let key = id, build = ITEM_PARTS[id];
    if (cat === 'fruit') { key = `fruit:${it?.variant ?? id.split('.')[1]}`; build = () => fruitParts(id.split('.')[1]); }
    else if (cat === 'furn') { key = 'present'; build = ITEM_PARTS.present; }
    else if (cat === 'fossil' && !build) { key = 'fossil'; build = ITEM_PARTS.fossil; }
    else if (cat === 'fish') { key = `fish:${id}`; build = () => fishParts(id); }
    if (!build) { key = `cat:${cat}`; build = () => [part(G.box(0.16, 0.16, 0.16), CAT_COLOR[cat] ?? '#CCCCCC', { p: [0, 0.08, 0] })]; }
    return { key, geo: geometry(key, build) };
  }
  /** 아이템 id → 떨어진 모습 메시 (들어 보일 때) */
  const item = id => mesh(itemGeometry(id).geo);

  // ---------- 물고기 (잡았을 때 들어 보이기) ----------
  function fishParts(id) {
    const slug = id.split('.')[1];
    const it = ctx.services.data?.items?.get?.(id);
    const L = 0.16 + (it?.shadow ?? 2) * 0.06;
    const { body: c, back, belly, fin } = { ...FISH_FALLBACK, ...it?.colors };
    const dark = '#3B3530';
    if (slug === 'octopus') {
      const out = [topTint(part(G.sphere(L * 0.4), c, { p: [0, L * 0.45, 0], sc: [1, 1.1, 1] }), back, 0.62)];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; out.push(part(G.cyl(0.02, 0.012, L * 0.6, 5), fin, { p: [Math.cos(a) * L * 0.18, L * 0.1, Math.sin(a) * L * 0.18], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] })); }
      out.push(part(G.sphere(0.025, 6, 4), dark, { p: [L * 0.14, L * 0.5, L * 0.33] }), part(G.sphere(0.025, 6, 4), dark, { p: [-L * 0.14, L * 0.5, L * 0.33] }));
      return out;
    }
    if (slug === 'squid') return [topTint(part(G.cone(L * 0.22, L, 8), c, { p: [0, L * 0.5, 0] }), back, 0.5), part(G.box(L * 0.5, L * 0.18, 0.02), back, { p: [0, L * 0.9, 0] }),
      ...[-1, 0, 1].map(k => part(G.cyl(0.015, 0.01, L * 0.45, 5), fin, { p: [k * L * 0.08, -L * 0.15, 0] })), part(G.sphere(0.02, 6, 4), dark, { p: [L * 0.1, L * 0.2, L * 0.14] })];
    // 보통 물고기: 머리가 +Z, 꼬리가 -Z. 몸 위쪽은 등 색, 꼬리·등지느러미는 지느러미 색, 배는 배 색
    return [
      topTint(part(G.sphere(1, 12, 8), c, { sc: [L * 0.2, L * 0.28, L * 0.5] }), back),
      part(G.cone(L * 0.2, L * 0.3, 6), fin, { p: [0, 0, -L * 0.6], r: [-Math.PI / 2, 0, 0], sc: [0.35, 1, 1.2] }),
      part(G.cone(L * 0.1, L * 0.25, 5), fin, { p: [0, L * 0.3, -L * 0.05], r: [0.4, 0, 0], sc: [0.3, 1, 1] }),
      part(G.sphere(0.022, 6, 4), dark, { p: [L * 0.13, L * 0.06, L * 0.33] }), part(G.sphere(0.022, 6, 4), dark, { p: [-L * 0.13, L * 0.06, L * 0.33] }),
      part(G.sphere(1, 8, 6), belly, { p: [0, -L * 0.1, L * 0.05], sc: [L * 0.14, L * 0.12, L * 0.36] }),
    ];
  }

  // ---------- 찌 · 물고기 그림자 · 구덩이 ----------
  const bobber = () => mesh(geometry('bobber', () => [
    part(new T.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#E8504F'),
    part(new T.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#F7F1E4'),
    part(G.cyl(0.008, 0.008, 0.06, 5), '#4E5A57', { p: [0, 0.08, 0] }),
  ]), { outline: 0.004 });

  /** 물 위에 비치는 물고기 그림자 (반투명 납작한 판). size = 1~6 */
  let shadowMat = null;
  function fishShadow(size) {
    shadowMat ??= Object.assign(materials.toonMaterial('#1F3A48', { flat: true, name: 'fishShadow' }), { transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const L = 0.22 + size * 0.18;
    const geo = geometry(`shadow:${size}`, () => [
      part(new T.CircleGeometry(1, 16), '#ffffff', { r: [-Math.PI / 2, 0, 0], sc: [L * 0.22, L * 0.5, 1] }),
      part(new T.CircleGeometry(1, 3), '#ffffff', { p: [0, 0, -L * 0.55], r: [-Math.PI / 2, 0, Math.PI / 2], sc: [L * 0.14, L * 0.14, 1] }),
    ]);
    const m = new T.Mesh(geo, shadowMat);
    m.renderOrder = 2;
    m.userData.length = L;
    return m;
  }
  /** 오늘 판 구덩이 (흙 둔덕 + 어두운 가운데) */
  const hole = () => mesh(geometry('hole', () => [
    part(G.cyl(0.36, 0.4, 0.04, 14), '#B79870', { p: [0, 0.02, 0] }),
    part(G.cyl(0.24, 0.24, 0.045, 12), '#6B5238', { p: [0, 0.025, 0] }),
    part(G.sphere(0.07, 6, 4), '#B79870', { p: [0.3, 0.04, 0.1], sc: [1, 0.5, 1] }),
  ]), { outline: 0.004 });

  return { part, merge, geometry, mesh, G, toon, flat, outlineMat, item, itemGeometry, fishShadow, bobber, hole, fishParts };
}
