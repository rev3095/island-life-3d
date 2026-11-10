// P35 무인도 투어 — 투어 섬 생성기 (순수 함수, three·DOM 없이 node 로도 돈다).
// 보드 tour D122-A: 모양 틀 넷(TO-01 둥근 · TO-02 초승달 · TO-03 쌍둥이(다리) · TO-04 언덕) + 날마다 다른 시드.
// 결과는 world/island.js generateIsland 와 같은 모양(gen)이라 world 의 지형·물체·충돌 코드가 그대로 그린다 (world/islets.js buildIslet).
// 좌표는 그 섬 가운데 기준 (x = tx + 0.5 - w/2). 월드 자리(ox)는 world 가 더한다.
import { KIND, FLAG, LEVEL_HEIGHT } from '../../world/island.js';
import { mulberry32, valueNoise, pick } from '../../world/rng.js';

const { SEA, SAND, GRASS, CLIFF, RAMP } = KIND;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const ISLET_W = 30, ISLET_H = 26;
/** 모양 틀: 섬 안쪽일수록 큰 값 (0 근처가 해안선). 좌표 u, v 는 0~1 */
export const SHAPES = {
  'TO-01': { name: '둥근 섬', f: (u, v) => 1 - Math.hypot((u - 0.5) / 0.4, (v - 0.48) / 0.4) },
  'TO-02': { name: '초승달 섬', f: (u, v) => Math.min(1 - Math.hypot((u - 0.5) / 0.42, (v - 0.48) / 0.42), Math.hypot((u - 0.6) / 0.25, (v - 0.3) / 0.28) - 0.9) },
  'TO-03': { name: '쌍둥이 섬', f: (u, v) => Math.max(1 - Math.hypot((u - 0.28) / 0.21, (v - 0.48) / 0.34), 1 - Math.hypot((u - 0.73) / 0.21, (v - 0.48) / 0.32)) },
  'TO-04': { name: '언덕 섬', f: (u, v) => 1 - Math.hypot((u - 0.5) / 0.42, (v - 0.47) / 0.4), hill: 0.5 },
};
export const SHAPE_IDS = Object.keys(SHAPES);
/** 투어 섬에만 있는 과일 (보드 IC-FR-07–08) */
export const ISLET_FRUITS = ['mango', 'lychee'];
const FLOWERS = { tulip: ['red', 'yellow', 'white', 'pink'], cosmos: ['pink', 'white', 'orange', 'red'], pansy: ['purple', 'yellow', 'blue', 'orange'] };

/** 날짜·횟수로 그날 섬 정하기 → { seed, shape }. 같은 날 같은 횟수면 늘 같은 섬. shapes = 나올 수 있는 모양 (tour.json shapes, 요소 편집기 「투어」) */
export function isletOf(dayKey, trip = 0, baseSeed = 0, shapes = SHAPE_IDS) {
  let h = 2166136261 ^ baseSeed;
  for (const c of `${dayKey}#${trip}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const seed = h >>> 0;
  const ids = shapes?.filter(id => SHAPES[id]).length ? shapes.filter(id => SHAPES[id]) : SHAPE_IDS;
  return { seed, shape: ids[seed % ids.length] };
}

/**
 * 투어 섬 만들기 → gen ({ w, h, seed, shape, kind, level, flags, rampMap, ramps, bridges, dock, waterfalls, objects, places, pads, nativeFruit, … })
 * opts.idPrefix: 물체 id 앞붙이 (본섬 물체와 하루 기록이 섞이지 않게, 기본 'tour:')
 */
export function generateIslet(seed, { shape = null, w = ISLET_W, h = ISLET_H, idPrefix = 'tour:', guest = null } = {}) {
  const shapeId = shape ?? SHAPE_IDS[seed % SHAPE_IDS.length];
  const S = SHAPES[shapeId];
  if (!S) throw new Error(`[tour] 모르는 섬 모양: ${shapeId}`);
  const rng = mulberry32(seed);
  const noise = valueNoise(seed, 5);
  const N = w * h;
  const K = new Uint8Array(N), L = new Uint8Array(N), F = new Uint8Array(N);
  const idx = (tx, tz) => tz * w + tx;
  const inside = (tx, tz) => tx >= 0 && tz >= 0 && tx < w && tz < h;
  const at = (tx, tz) => (inside(tx, tz) ? K[idx(tx, tz)] : SEA);
  const lv = (tx, tz) => (inside(tx, tz) ? L[idx(tx, tz)] : 0);
  const val = new Float32Array(N);

  // ── 1. 윤곽: 모양 틀 + 잡음. 가장자리 3칸은 늘 바다 ──
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const v = S.f((tx + 0.5) / w, (tz + 0.5) / h) + (noise(tx, tz) - 0.5) * 0.3;
    val[idx(tx, tz)] = v;
    if (tx >= 3 && tz >= 3 && tx < w - 3 && tz < h - 5 && v > 0.08) K[idx(tx, tz)] = SAND;
  }
  // 섬 안에 갇힌 바다는 땅으로, 삐죽한 칸은 바다로
  fillEnclosed();
  for (let pass = 0; pass < 2; pass++) for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    if (at(tx, tz) !== SEA && N4.filter(([a, b]) => at(tx + a, tz + b) !== SEA).length < 2) K[idx(tx, tz)] = SEA;
  }
  // 작은 조각 땅 없애기 (쌍둥이 섬은 큰 둘을 남긴다)
  const parts = components();
  parts.sort((a, b) => b.length - a.length);
  const keep = shapeId === 'TO-03' ? 2 : 1;
  for (const p of parts.slice(keep)) for (const i of p) K[i] = SEA;

  // ── 2. 모래 고리 (바다에서 2칸 안쪽까지), 안쪽 풀 ──
  const dSea = distance(i => K[i] === SEA);
  for (let i = 0; i < N; i++) if (K[i] === SAND && dSea[i] > 1.9 + (noise(i % w + 40, (i / w | 0) + 40) - 0.5) * 1.2) K[i] = GRASS;

  // ── 3. 언덕 (TO-04): 안쪽 높은 곳을 1단으로, 가장자리 = 절벽, 남쪽에 경사로 하나 ──
  const ramps = [], rampMap = new Int16Array(N).fill(-1);
  if (S.hill) {
    const dGrass = distance(i => K[i] !== GRASS);
    const hill = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (K[i] === GRASS && dGrass[i] >= 2.6 && val[i] > S.hill) hill[i] = 1;
    for (let pass = 0; pass < 3; pass++) {
      const next = hill.slice();
      for (let tz = 1; tz < h - 1; tz++) for (let tx = 1; tx < w - 1; tx++) {
        const i = idx(tx, tz);
        const n8 = N8.reduce((s, [a, b]) => s + hill[idx(tx + a, tz + b)], 0), n4 = N4.reduce((s, [a, b]) => s + hill[idx(tx + a, tz + b)], 0);
        if (hill[i] && (n8 <= 3 || n4 <= 1)) next[i] = 0;
      }
      hill.set(next);
    }
    for (let i = 0; i < N; i++) if (hill[i]) L[i] = 1;
    // 경사로: 언덕 남쪽 끝 칸 (위칸 tzTop = 언덕, 아래칸 = 아래 풀)
    const cx = Math.floor(w / 2);
    for (let off = 0; off <= 6 && !ramps.length; off++) for (const sx of off ? [off, -off] : [0]) {
      if (ramps.length) break;
      const tx = cx + sx;
      let top = -1;
      for (let tz = h - 1; tz >= 0; tz--) if (lv(tx, tz)) { top = tz; break; }
      if (top < 2) continue;
      const ok = lv(tx - 1, top) && lv(tx + 1, top) && lv(tx, top - 1) && lv(tx - 1, top - 1) && lv(tx + 1, top - 1)
        && !lv(tx - 1, top + 1) && !lv(tx + 1, top + 1)
        && [[0, 1], [0, 2], [0, 3], [-1, 1], [1, 1], [-1, 2], [1, 2]].every(([a, b]) => at(tx + a, top + b) === GRASS && !lv(tx + a, top + b));
      if (!ok) continue;
      ramps.push({ tx, tzTop: top });
      K[idx(tx, top)] = RAMP; K[idx(tx, top + 1)] = RAMP;
      L[idx(tx, top)] = 1; L[idx(tx, top + 1)] = 0;
      rampMap[idx(tx, top)] = 0; rampMap[idx(tx, top + 1)] = 1;
    }
    if (!ramps.length) L.fill(0);     // 경사로를 못 놓으면 언덕 없이 (못 오르는 언덕은 안 만든다)
    for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
      const i = idx(tx, tz);
      if (!L[i] || K[i] === RAMP) continue;
      if (N8.some(([a, b]) => !lv(tx + a, tz + b) && at(tx + a, tz + b) !== RAMP)) K[i] = CLIFF;
    }
  }

  // ── 4. 다리 (TO-03): 두 섬 사이 바다 2칸 줄에 다리 ──
  const bridges = [];
  if (shapeId === 'TO-03') {
    const rows = [];
    for (let tz = 4; tz < h - 6; tz++) for (let tx = 2; tx < w - 4; tx++) {
      if (at(tx, tz) === SEA || at(tx, tz) === CLIFF) continue;
      if (at(tx + 1, tz) !== SEA || at(tx + 2, tz) !== SEA) continue;
      const far = at(tx + 3, tz);
      if (far !== SAND && far !== GRASS) continue;
      if (at(tx + 1, tz - 1) !== SEA || at(tx + 1, tz + 1) !== SEA || at(tx + 2, tz - 1) !== SEA || at(tx + 2, tz + 1) !== SEA) continue;
      rows.push({ tx: tx + 1, tz, d: Math.abs(tz - h / 2) });
    }
    rows.sort((a, b) => a.d - b.d);
    let b = rows[0];
    if (!b) {   // 사이가 넓으면 가운데 줄을 메워 2칸만 남긴다
      const tz = Math.round(h * 0.48), xs = [];
      for (let tx = 0; tx < w; tx++) if (at(tx, tz) !== SEA) xs.push(tx);
      let gap = null;
      for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > 1) gap = [xs[k - 1], xs[k]];
      if (gap) {
        for (let tx = gap[0] + 1; tx < gap[1] - 2; tx++) K[idx(tx, tz)] = SAND;
        b = { tx: gap[1] - 2, tz };
      }
    }
    if (b) {
      F[idx(b.tx, b.tz)] |= FLAG.BRIDGE; F[idx(b.tx + 1, b.tz)] |= FLAG.BRIDGE;
      bridges.push({ tx: b.tx, tz: b.tz, x: b.tx + 1 - w / 2, z: b.tz + 0.5 - h / 2, rot: 0 });
    }
  }

  // ── 5. 선착장 (남쪽 바닷가에서 바다 쪽으로 4칸) ──
  let dock = null;
  const cx0 = Math.round(w / 2);
  for (let off = 0; off <= 10 && !dock; off++) for (const sx of off ? [off, -off] : [0]) {
    if (dock) break;
    const c = cx0 + sx;
    let s = -1;
    for (let tz = h - 1; tz >= 0; tz--) if (at(c - 1, tz) !== SEA && at(c, tz) !== SEA) { s = tz; break; }
    if (s < 0 || lv(c - 1, s) || lv(c, s) || at(c - 1, s) === CLIFF || at(c, s) === CLIFF) continue;
    let ok = s + 5 < h;
    for (let dz = 1; dz <= 5 && ok; dz++) for (const tx of [c - 2, c - 1, c, c + 1]) if (at(tx, s + dz) !== SEA && (tx === c - 1 || tx === c || dz <= 4)) ok = false;
    if (!ok) continue;
    K[idx(c - 1, s)] = SAND; K[idx(c, s)] = SAND;
    if (at(c - 1, s - 1) === GRASS) K[idx(c - 1, s - 1)] = SAND;
    if (at(c, s - 1) === GRASS) K[idx(c, s - 1)] = SAND;
    dock = { tx: c - 1, tz: s, x: c - w / 2, z: s + 0.5 - h / 2, length: 4 };
    for (let dz = 1; dz <= 4; dz++) { F[idx(c - 1, s + dz)] |= FLAG.DOCK; F[idx(c, s + dz)] |= FLAG.DOCK; }
  }

  // ── 6. 물체 ──
  const objects = [];
  const occ = new Int8Array(N);   // 1 = 물체, -1 = 비워 둘 곳
  const clear = (tx0, tz0, r) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (inside(tx0 + dx, tz0 + dz) && !occ[idx(tx0 + dx, tz0 + dz)]) occ[idx(tx0 + dx, tz0 + dz)] = -1; };
  const rot = () => rng() * Math.PI * 2;
  function addObj(kind, tx, tz, { x, z, rot: r = 0, scale = 1, variant = null, data = null, force = false } = {}) {
    if (!inside(tx, tz)) return null;
    const i = idx(tx, tz);
    if (occ[i] > 0 || (occ[i] < 0 && !force)) return null;
    const o = { id: `${idPrefix}${kind}@${tx},${tz}`, kind, tx, tz, x: x ?? tx + 0.5 - w / 2, z: z ?? tz + 0.5 - h / 2,
      y: L[i] && K[i] !== RAMP ? LEVEL_HEIGHT : 0, rot: r, scale, variant, data: data ?? {} };
    objects.push(o);
    occ[i] = 1;
    return o;
  }
  const places = {};
  if (dock) {
    const o = addObj('dock', dock.tx, dock.tz, { x: dock.x, z: dock.z, force: true });
    if (o) dock.id = o.id;
    clear(dock.tx, dock.tz - 2, 2);
    // 배 (BD-10): 선착장 끝 동쪽 바다에 묶여 있다
    const boat = { x: dock.x + 1.55, z: dock.z + 3.3 };
    addObj('tour-boat', dock.tx + 2, Math.min(h - 1, dock.tz + 3), { ...boat, rot: 0, force: true });
    places.dock = { x: dock.x, z: dock.z + 2.5 };
    places.boat = boat;
    places.spawn = { x: dock.x, z: dock.z + 3.2, facing: 0 };   // 배에서 내려 선착장 끝에 선다 (북쪽을 본다)
  }
  for (const b of bridges) addObj('bridge', b.tx, b.tz, { x: b.x, z: b.z, rot: b.rot, force: true });
  for (const r of ramps) { clear(r.tx, r.tzTop - 1, 1); clear(r.tx, r.tzTop + 2, 1); }

  const cells = kinds => { const out = []; for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) { const i = idx(tx, tz); if (kinds.includes(K[i]) && !F[i] && !occ[i]) out.push([tx, tz]); } return out; };
  const shuffleIn = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const placed = [];
  const spaced = (tx, tz, d) => placed.every(p => (p[0] - tx) ** 2 + (p[1] - tz) ** 2 >= d * d);
  const notEdge = (tx, tz) => !N8.some(([a, b]) => lv(tx + a, tz + b) !== lv(tx, tz) || at(tx + a, tz + b) === RAMP || at(tx + a, tz + b) === CLIFF);
  function scatter(kind, n, kindsOk, { d = 2, opts = () => ({}), test = () => true } = {}) {
    let got = 0;
    for (const [tx, tz] of shuffleIn(cells(kindsOk))) {
      if (got >= n) break;
      if (!spaced(tx, tz, d) || !test(tx, tz) || !notEdge(tx, tz)) continue;
      if (addObj(kind, tx, tz, { rot: rot(), ...opts() })) { placed.push([tx, tz]); got++; }
    }
    return got;
  }
  // 다른 섬 주민 자리 (있을 때만): 섬 가운데쯤 풀밭
  if (guest) {
    const c = cells([GRASS]).filter(([tx, tz]) => notEdge(tx, tz) && !lv(tx, tz)).sort((a, b) => Math.hypot(a[0] - w / 2, a[1] - h * 0.45) - Math.hypot(b[0] - w / 2, b[1] - h * 0.45))[0];
    if (c) { places.guest = { x: c[0] + 0.5 - w / 2, z: c[1] + 0.5 - h / 2 }; clear(c[0], c[1], 1); }
  }
  const fruit = pick(ISLET_FRUITS, rng);
  const land = cells([GRASS]).length;
  scatter('fruit-tree', 3, [GRASS], { d: 3, opts: () => ({ scale: 0.95 + rng() * 0.1, variant: fruit, data: { fruit } }) });
  scatter('ore-rock', 3, [GRASS, SAND], { d: 3, opts: () => ({ scale: 0.95 + rng() * 0.15 }) });
  scatter('rock', 2, [GRASS], { d: 3, opts: () => ({ scale: 0.95 + rng() * 0.15 }) });
  scatter('palm', 4, [SAND], { d: 3, opts: () => ({ scale: 0.9 + rng() * 0.2 }), test: (tx, tz) => N4.some(([a, b]) => at(tx + a, tz + b) === SEA) || dSea[idx(tx, tz)] <= 2.5 });
  scatter('tree', Math.max(6, Math.round(land / 22)), [GRASS], { d: 2, opts: () => ({ scale: 0.9 + rng() * 0.2 }) });
  scatter('bush', 4, [GRASS], { d: 2, opts: () => ({ variant: pick(['pink', 'white', 'blue', 'red'], rng) }) });
  const fk = Object.keys(FLOWERS);
  for (let k = 0, n = 8; k < n; k++) {
    const kind = fk[k % fk.length];
    scatter(kind, 1, [GRASS], { d: 1.5, opts: () => ({ variant: pick(FLOWERS[kind], rng) }) });
  }

  return {
    w, h, seed, shape: shapeId, shapeName: S.name, kind: K, level: L, flags: F, rampMap, ramps, bridges, dock,
    waterfalls: [], objects, places, pads: [], buildings: [], nativeFruit: fruit, layout: null, islet: true,
  };

  function fillEnclosed() {
    const seen = new Uint8Array(N), stack = [];
    for (let tx = 0; tx < w; tx++) { stack.push(idx(tx, 0), idx(tx, h - 1)); }
    for (let tz = 0; tz < h; tz++) { stack.push(idx(0, tz), idx(w - 1, tz)); }
    while (stack.length) {
      const i = stack.pop();
      if (seen[i] || K[i] !== SEA) continue;
      seen[i] = 1;
      const tx = i % w, tz = (i / w) | 0;
      for (const [a, b] of N4) if (inside(tx + a, tz + b)) stack.push(idx(tx + a, tz + b));
    }
    for (let i = 0; i < N; i++) if (K[i] === SEA && !seen[i]) K[i] = SAND;
  }
  function components() {
    const seen = new Uint8Array(N), out = [];
    for (let s = 0; s < N; s++) {
      if (seen[s] || K[s] === SEA) continue;
      const comp = [], stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const i = stack.pop();
        comp.push(i);
        const tx = i % w, tz = (i / w) | 0;
        for (const [a, b] of N4) {
          if (!inside(tx + a, tz + b)) continue;
          const j = idx(tx + a, tz + b);
          if (!seen[j] && K[j] !== SEA) { seen[j] = 1; stack.push(j); }
        }
      }
      out.push(comp);
    }
    return out;
  }
  function distance(isSrc) {
    const d = new Float32Array(N).fill(1e9);
    for (let i = 0; i < N; i++) if (isSrc(i)) d[i] = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
        const i = idx(tx, tz);
        if (tx) d[i] = Math.min(d[i], d[i - 1] + 1); if (tz) d[i] = Math.min(d[i], d[i - w] + 1);
        if (tx && tz) d[i] = Math.min(d[i], d[i - w - 1] + 1.41); if (tz && tx < w - 1) d[i] = Math.min(d[i], d[i - w + 1] + 1.41);
      }
      for (let tz = h - 1; tz >= 0; tz--) for (let tx = w - 1; tx >= 0; tx--) {
        const i = idx(tx, tz);
        if (tx < w - 1) d[i] = Math.min(d[i], d[i + 1] + 1); if (tz < h - 1) d[i] = Math.min(d[i], d[i + w] + 1);
        if (tx < w - 1 && tz < h - 1) d[i] = Math.min(d[i], d[i + w + 1] + 1.41); if (tz < h - 1 && tx) d[i] = Math.min(d[i], d[i + w - 1] + 1.41);
      }
    }
    return d;
  }
}

/** 땅이 선착장에서 걸어서 다 이어지는지 (테스트·점검용) → 못 가는 땅 칸 수 */
export function unreachable(gen) {
  const { w, h, kind: K, flags: F } = gen;
  const walk = i => (K[i] !== SEA && K[i] !== KIND.WATER) || (F[i] & (FLAG.BRIDGE | FLAG.DOCK)) !== 0;
  if (!gen.dock) return Infinity;
  const seen = new Uint8Array(w * h), stack = [gen.dock.tz * w + gen.dock.tx];
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !walk(i)) continue;
    seen[i] = 1;
    const tx = i % w, tz = (i / w) | 0;
    for (const [a, b] of N4) if (tx + a >= 0 && tz + b >= 0 && tx + a < w && tz + b < h) stack.push((tz + b) * w + tx + a);
  }
  let n = 0;
  for (let i = 0; i < w * h; i++) if (walk(i) && !seen[i] && !(F[i] & FLAG.DOCK)) n++;
  return n;
}
