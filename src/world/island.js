// 섬 지형 생성기. 시드 하나로 늘 같은 섬(타일 종류·높이·강·다리·건물·배경 배치)을 만든다.
// three·DOM 을 쓰지 않아서 node 로도 돌릴 수 있다 (tools 없이 `node -e` 로 지도 확인 가능).
// 좌표: 타일 (tx, tz) — tx 0 = 서쪽, tz 0 = 북쪽. 월드 (x, z) 는 섬 가운데가 원점, 타일 1칸 = 1.0, 북쪽 = -Z.
// 대략적인 배치는 concept/concept-board.html 의 MAP (640×560 그림 = 64×56 타일, 10px = 1칸) 을 따른다.
import { mulberry32, valueNoise, shuffle, pick } from './rng.js';

export const KIND = { SEA: 0, SAND: 1, GRASS: 2, PATH: 3, PLAZA: 4, WATER: 5, CLIFF: 6, RAMP: 7 };
export const KIND_NAMES = ['sea', 'sand', 'grass', 'path', 'plaza', 'water', 'cliff', 'ramp'];
export const FLAG = { BRIDGE: 1, DOCK: 2 };
export const LEVEL_HEIGHT = 1.0;
export const WATER_TOP = -0.15;          // 물 타일 윗면 (tile-water 모델)

const { SEA, SAND, GRASS, PATH, PLAZA, WATER, CLIFF, RAMP } = KIND;
const SQRT2 = Math.SQRT2;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

// 건물 발자국(타일)과 모델 원점 기준 충돌 상자. 문은 +Z(남쪽)를 본다.
export const BUILDINGS = {
  'house-player': { fp: [3, 3] },
  'house-villager': { fp: [3, 3] },
  shop: { fp: [5, 4] },
  museum: { fp: [6, 6] },
};

/**
 * 섬 만들기. 돌려주는 값은 순수 데이터 (배열·목록) 이고, createIslandApi 가 조회 함수를 붙인다.
 * @returns {{ w, h, seed, kind, level, flags, ramps, bridges, dock, waterfalls, objects, places, pads }}
 */
export function generateIsland(seed, { w = 64, h = 56, villagers = ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong'], nativeFruit: fruitWanted = null } = {}) {
  const rng = mulberry32(seed);
  const N = w * h;
  const K = new Uint8Array(N);           // 타일 종류 (처음엔 모두 바다)
  const L = new Uint8Array(N);           // 높이 단 (0 | 1)
  const F = new Uint8Array(N);           // FLAG
  const idx = (tx, tz) => tz * w + tx;
  const inside = (tx, tz) => tx >= 0 && tz >= 0 && tx < w && tz < h;
  const at = (tx, tz) => (inside(tx, tz) ? K[idx(tx, tz)] : SEA);
  const lv = (tx, tz) => (inside(tx, tz) ? L[idx(tx, tz)] : 0);

  // ── 1. 섬 윤곽: 둥근 사각형(초타원)에 시드 물결을 얹는다 ──
  const cx = w * 0.511, cz = h * 0.509, rx = w * 0.395, rz = h * 0.409;
  const harm = [2, 3, 4, 5, 7].map((k, i) => ({ k, a: [0.034, 0.028, 0.02, 0.014, 0.01][i], p: rng() * Math.PI * 2 }));
  const wobble = th => 1 + harm.reduce((s, H) => s + H.a * Math.sin(H.k * th + H.p), 0);
  const P = 2.5;
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    if (tx < 3 || tz < 3 || tx >= w - 3 || tz >= h - 3) continue;
    const dx = (tx + 0.5 - cx) / rx, dz = (tz + 0.5 - cz) / rz;
    const n = Math.pow(Math.abs(dx) ** P + Math.abs(dz) ** P, 1 / P);
    if (n < wobble(Math.atan2(dz, dx))) K[idx(tx, tz)] = SAND;
  }
  // 섬 안에 갇힌 바다는 땅으로, 삐죽한 한 칸 땅은 바다로
  fillEnclosedSea();
  for (let pass = 0; pass < 2; pass++) for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    if (at(tx, tz) === SEA) continue;
    if (N4.filter(([a, b]) => at(tx + a, tz + b) !== SEA).length < 2) K[idx(tx, tz)] = SEA;
  }

  // ── 2. 모래사장 고리 (폭 2~4칸) 안쪽은 풀밭 ──
  const dSea = distanceFrom(i => K[i] === SEA);
  const bPh = [rng() * 6.28, rng() * 6.28];
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const i = idx(tx, tz);
    if (K[i] !== SAND) continue;
    const th = Math.atan2(tz + 0.5 - cz, tx + 0.5 - cx);
    const bw = Math.max(1.7, 2.7 + 0.8 * Math.sin(3 * th + bPh[0]) + 0.4 * Math.sin(5 * th + bPh[1]));
    if (dSea[i] > bw) K[i] = GRASS;
  }
  // 선착장 쪽(남쪽 가운데) 모래사장은 넉넉하게 3칸 이상
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const i = idx(tx, tz);
    if (K[i] === GRASS && dSea[i] <= 3.2 && tz > h * 0.75 && Math.abs(tx + 0.5 - w * 0.47) < 6) K[i] = SAND;
  }
  // 모래 속 외톨이 풀은 모래로
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    if (at(tx, tz) === GRASS && N4.filter(([a, b]) => at(tx + a, tz + b) === GRASS).length < 2) K[idx(tx, tz)] = SAND;
  }

  // ── 3. 북쪽 언덕 (한 단 높은 땅) ──
  const dGrass = distanceFrom(i => K[i] !== GRASS);
  const RAMP_X = [0.37, 0.48, 0.70].map(f => Math.round(w * f));     // 경사로 3곳 (지도 12번)
  const ePh = [rng() * 6.28, rng() * 6.28];
  const edgeAt = x => h * 0.395 + 0.9 * Math.sin(x * 0.33 + ePh[0]) + 0.6 * Math.sin(x * 0.71 + ePh[1]);
  const RIVER_X = Math.round(w * 0.5625);                              // 강이 언덕을 넘는 곳 (폭포)
  const FLAT_X = [...RAMP_X.map(r => r + 0.5), RIVER_X];               // 경사로·폭포 둘레는 가장자리를 곧게
  const edgeZ = x => {
    for (const f of FLAT_X) if (Math.abs(x - f) < 2.6) return Math.round(edgeAt(f)) + 0.01;
    return edgeAt(x);
  };
  const hill = new Uint8Array(N);
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const i = idx(tx, tz);
    if (K[i] === GRASS && dGrass[i] >= 2.6 && tz + 0.5 < edgeZ(tx + 0.5)) hill[i] = 1;
  }
  // 다듬기: 한 칸짜리 돌기·구멍 없애기 (경사로 둘레는 그대로)
  const nearRamp = tx => FLAT_X.some(f => Math.abs(tx + 0.5 - f) <= 2.6);
  for (let pass = 0; pass < 3; pass++) {
    const next = hill.slice();
    for (let tz = 1; tz < h - 1; tz++) for (let tx = 1; tx < w - 1; tx++) {
      const i = idx(tx, tz);
      if (nearRamp(tx) && hill[i]) continue;
      const n8 = N8.reduce((s, [a, b]) => s + hill[idx(tx + a, tz + b)], 0);
      const n4 = N4.reduce((s, [a, b]) => s + hill[idx(tx + a, tz + b)], 0);
      if (hill[i] && (n8 <= 3 || n4 <= 1)) next[i] = 0;
      else if (!hill[i] && K[i] === GRASS && n4 >= 3 && dGrass[i] >= 2) next[i] = 1;
    }
    hill.set(next);
  }
  for (let i = 0; i < N; i++) if (hill[i]) L[i] = 1;

  // ── 4. 강: 언덕 위 연못 → 폭포 → 북쪽 다리 → 남쪽 다리 → 남동쪽 바다 (폭 2칸) ──
  const S = (fx, fz) => [fx * w, fz * h];
  const pond = { x: w * 0.5625 + 0.5, z: h * 0.255, rx: 2.7, rz: 1.8 };
  const BRIDGE_ROWS = [Math.round(h * 0.5), Math.round(h * 0.75)];      // 28, 42
  const riverPts = [
    [pond.x - 0.5, pond.z], [pond.x - 0.5, pond.z + 3], S(0.5625, 0.36), S(0.5625, 0.46),             // 폭포까지 곧게
    [w * 0.5625, BRIDGE_ROWS[0] - 2.5], [w * 0.5625, BRIDGE_ROWS[0] + 3],                          // 북쪽 다리 (곧게)
    S(0.54 + (rng() - 0.5) * 0.02, 0.6), S(0.575 + (rng() - 0.5) * 0.02, 0.68),
    [w * 0.625, BRIDGE_ROWS[1] - 2.5], [w * 0.625, BRIDGE_ROWS[1] + 2],                            // 남쪽 다리 (곧게)
    S(0.66, 0.84), S(0.7, 0.91), S(0.72, 1.05),
  ];
  const river = new Uint8Array(N);
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const px = tx + 0.5, pz = tz + 0.5;
    let d = Infinity;
    for (let k = 0; k < riverPts.length - 1; k++) d = Math.min(d, segDist(px, pz, riverPts[k], riverPts[k + 1]));
    const pd = ((px - pond.x) / pond.rx) ** 2 + ((pz - pond.z) / pond.rz) ** 2;
    if (d < 1.0 || pd < 1) river[idx(tx, tz)] = 1;
  }
  for (let i = 0; i < N; i++) if (river[i] && K[i] !== SEA) K[i] = WATER;
  // 언덕 위 물은 둘레가 언덕(또는 물)이어야 한다. 폭포 자리(남쪽이 아래 물)만 예외
  for (let pass = 0; pass < 2; pass++) for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const i = idx(tx, tz);
    if (K[i] !== WATER || !L[i]) continue;
    const bad = N8.some(([a, b]) => { const j = idx(tx + a, tz + b); return !L[j] && !(K[j] === WATER && b === 1 && a === 0); });
    if (bad) { const s = idx(tx, tz + 1); if (!(K[s] === WATER && !L[s])) K[i] = GRASS; }
  }
  // 폭포: 언덕 위 물 바로 남쪽이 아래 물인 곳
  const waterfalls = [];
  for (let tz = 0; tz < h - 1; tz++) for (let tx = 0; tx < w; tx++) {
    const i = idx(tx, tz), s = idx(tx, tz + 1);
    if (K[i] === WATER && L[i] && K[s] === WATER && !L[s]) waterfalls.push({ tx, tz });
  }

  // ── 5. 경사로 3곳 ──
  const ramps = [];
  const rampMap = new Int16Array(N).fill(-1);       // 경사로 번호*2 + (0 위칸 | 1 아래칸)
  for (const target of RAMP_X) {
    let best = null;
    for (let off = 0; off <= 5 && !best; off++) for (const sx of off ? [off, -off] : [0]) {
      const tx = target + sx;
      if (best || ramps.some(r => Math.abs(r.tx - tx) < 4)) continue;
      let top = -1;
      for (let tz = h - 1; tz >= 0; tz--) if (L[idx(tx, tz)] && K[idx(tx, tz)] === GRASS) { top = tz; break; }
      if (top < 2) continue;
      const ok = lv(tx - 1, top) && lv(tx + 1, top) && lv(tx, top - 1) && lv(tx - 1, top - 1) && lv(tx + 1, top - 1)
        && at(tx, top - 1) === GRASS
        && !lv(tx - 1, top + 1) && !lv(tx + 1, top + 1)
        && [[0, 1], [0, 2], [0, 3], [-1, 1], [1, 1], [-1, 2], [1, 2]].every(([a, b]) => at(tx + a, top + b) === GRASS && !lv(tx + a, top + b));
      if (ok) best = { tx, tzTop: top };
    }
    if (!best) continue;
    const r = ramps.length;
    ramps.push(best);
    K[idx(best.tx, best.tzTop)] = RAMP; K[idx(best.tx, best.tzTop + 1)] = RAMP;
    L[idx(best.tx, best.tzTop)] = 1; L[idx(best.tx, best.tzTop + 1)] = 0;
    rampMap[idx(best.tx, best.tzTop)] = r * 2; rampMap[idx(best.tx, best.tzTop + 1)] = r * 2 + 1;
  }

  // 언덕 가장자리 = 절벽 타일 (윗면은 걸을 수 있는 언덕 땅)
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const i = idx(tx, tz);
    if (!L[i] || K[i] !== GRASS) continue;
    if (N8.some(([a, b]) => !lv(tx + a, tz + b) || !inside(tx + a, tz + b))) K[i] = CLIFF;
  }

  // ── 6. 다리 2개 (긴 쪽이 동서, 강 2칸 + 양쪽 둑 반 칸씩) ──
  const bridges = [];
  for (const tz of BRIDGE_ROWS) {
    const xs = [];
    for (let tx = 0; tx < w; tx++) if (K[idx(tx, tz)] === WATER) xs.push(tx);
    if (!xs.length) continue;
    const a = xs[0];
    // 다리 줄과 위아래 줄은 정확히 2칸 폭으로 맞춘다
    for (let dz = -1; dz <= 1; dz++) for (let tx = a - 3; tx <= a + 4; tx++) {
      const i = idx(tx, tz + dz);
      if (tx === a || tx === a + 1) K[i] = WATER;
      else if (K[i] === WATER) K[i] = GRASS;
    }
    F[idx(a, tz)] |= FLAG.BRIDGE; F[idx(a + 1, tz)] |= FLAG.BRIDGE;
    bridges.push({ tx: a, tz, x: a + 1 - w / 2, z: tz + 0.5 - h / 2, rot: 0 });
  }

  // ── 7. 선착장 (남쪽 바닷가, 바다 쪽으로 4칸) ──
  let dock = null;
  for (let off = 0; off <= 6 && !dock; off++) for (const sx of off ? [off, -off] : [0]) {
    const c = Math.round(w * 0.47) + sx;
    let s = -1;
    for (let tz = h - 1; tz >= 0; tz--) if (at(c - 1, tz) !== SEA && at(c, tz) !== SEA) { s = tz; break; }
    if (s < 0 || at(c - 1, s) !== SAND || at(c, s) !== SAND) continue;
    let ok = true;
    for (let dz = 1; dz <= 5; dz++) for (const tx of [c - 2, c - 1, c, c + 1]) if (at(tx, s + dz) !== SEA && (tx === c - 1 || tx === c || dz <= 4)) ok = false;
    if (!ok || s + 5 >= h) continue;
    dock = { tx: c - 1, tz: s, x: c - w / 2, z: s + 0.5 - h / 2, length: 4 };
    for (let dz = 1; dz <= 4; dz++) { F[idx(c - 1, s + dz)] |= FLAG.DOCK; F[idx(c, s + dz)] |= FLAG.DOCK; }
  }

  // ── 8. 광장 (지도 2번) ──
  const plazaC = { tx: Math.round(w * 0.37), tz: Math.round(h * 0.54) };
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    if (dx * dx + dz * dz > 3.3 * 3.3) continue;
    const i = idx(plazaC.tx + dx, plazaC.tz + dz);
    if (K[i] === GRASS && !L[i]) K[i] = PLAZA;
  }

  // 통행 판정: 같은 높이끼리, 경사로는 위·아래 끝으로만
  const walkableI = i => (K[i] !== SEA && K[i] !== WATER) || (F[i] & (FLAG.BRIDGE | FLAG.DOCK)) !== 0;
  const passable = (ax, az, bx, bz) => passableOn({ inside, idx, K, L, F, rampMap, walkableI }, ax, az, bx, bz);

  // ── 9. 건물 자리 ──
  const occ = new Int16Array(N);           // 0 빈칸, -1 비워 둘 칸, >0 배경 물체 번호+1
  const objects = [];
  const pads = [];                         // 걸을 수 있는 높은 바닥 (건물 앞 계단, 박물관 기단)
  const buildings = [];
  const fits = (b, tx0, tz0, lvl) => {
    const [fw, fd] = BUILDINGS[b].fp;
    for (let tz = tz0 - 1; tz <= tz0 + fd + 2; tz++) for (let tx = tx0 - 1; tx <= tx0 + fw; tx++) {
      if (!inside(tx, tz)) return false;
      const i = idx(tx, tz), k = K[i];
      const inFp = tx >= tx0 && tx < tx0 + fw && tz >= tz0 && tz < tz0 + fd;
      if (occ[i]) return false;
      if (inFp) { if (k !== GRASS || L[i] !== lvl) return false; }
      else if (tz >= tz0 + fd) { if (!(k === GRASS || k === CLIFF) || L[i] !== lvl) return false; }    // 문 앞 2줄
      else if (!walkableI(i) || L[i] !== lvl || k === RAMP) return false;                               // 둘레 1칸
    }
    for (const r of ramps) if (Math.abs(r.tx - (tx0 + fw / 2)) < fw / 2 + 2.5 && r.tzTop + 1 >= tz0 - 2 && r.tzTop <= tz0 + fd + 3) return false;
    return true;
  };
  const placeBuilding = (kind, fx, fz, lvl, data) => {
    const [fw, fd] = BUILDINGS[kind].fp;
    const ox = Math.round(fx - fw / 2), oz = Math.round(fz - fd / 2);
    let spot = null;
    for (let r = 0; r <= 20 && !spot; r++) {             // 목표 자리 가까운 곳부터 넓혀 가며 찾는다
      const ring = [];
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r) ring.push([dx, dz]);
      ring.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
      for (const [dx, dz] of ring) if (fits(kind, ox + dx, oz + dz, lvl)) { spot = [ox + dx, oz + dz]; break; }
    }
    if (!spot) return null;
    const [tx0, tz0] = spot;
    const x = tx0 + fw / 2 - w / 2, z = tz0 + fd / 2 - h / 2;
    const door = { tx: tx0 + Math.floor(fw / 2), tz: tz0 + fd };
    for (let tz = tz0 - 1; tz <= tz0 + fd + 1; tz++) for (let tx = tx0 - 1; tx <= tx0 + fw; tx++) occ[idx(tx, tz)] = -1;
    const b = { kind, tx0, tz0, fw, fd, x, z, door, level: lvl, data };
    buildings.push(b);
    addObj(kind, tx0 + Math.floor(fw / 2), tz0 + Math.floor(fd / 2), { x, z, rot: 0, data, variant: data?.variant, force: true });
    const y = lvl * LEVEL_HEIGHT;
    if (kind === 'museum') pads.push({ x0: x - 2.95, x1: x + 2.95, z0: z - 2.25, z1: z + 2.85, y, steps: [0.45, 0.3, 0.15], stepW: 0.15 });
    else if (kind === 'shop') pads.push({ x0: x - 2.07, x1: x + 2.07, z0: z + 1.3, z1: z + 1.89, y, h: 0.12 });
    else pads.push({ x0: x - 1.27, x1: x + 1.27, z0: z + 1.1, z1: z + 1.59, y, h: 0.12 });
    return b;
  };

  const museum = placeBuilding('museum', w * 0.345, h * 0.3, 1, {}) ?? placeBuilding('museum', w * 0.345, h * 0.42, 0, {});   // 언덕에 자리가 없으면 아래에
  const shop = placeBuilding('shop', w * 0.728, h * 0.535, 0, {});
  const playerHouse = placeBuilding('house-player', w * 0.273, h * 0.73, 0, { owner: 'player' });
  const VILLAGER_SPOTS = { coco: [0.21, 0.5], bori: [0.26, 0.61], mochi: [0.44, 0.71], dubu: [0.5, 0.8], pong: [0.72, 0.445], chorong: [0.81, 0.47] };
  const villagerHouses = [];
  for (const slug of villagers) {
    const [fx, fz] = VILLAGER_SPOTS[slug] ?? [0.5, 0.5];
    const b = placeBuilding('house-villager', w * fx, h * fz, 0, { owner: slug, variant: slug });
    if (b) villagerHouses.push(b);
  }

  // ── 10. 흙길 (A*): 선착장·광장·집·상점·다리·경사로·박물관을 잇는다 ──
  const spawnT = dock ? { tx: dock.tx + 1, tz: dock.tz - 1 } : { tx: plazaC.tx, tz: plazaC.tz + 5 };
  const isPlaza = (tx, tz) => at(tx, tz) === PLAZA;
  const route = (from, goal, { maxLen = 999 } = {}) => {
    const path = astar(from, goal);
    if (!path || path.length > maxLen) return false;
    for (const [tx, tz] of path) {
      const i = idx(tx, tz);
      if (K[i] === GRASS) K[i] = PATH;      // 언덕 가장자리(절벽 타일)는 그대로 둔다
    }
    return true;
  };
  const goalTile = t => ({ test: (tx, tz) => tx === t.tx && tz === t.tz, hx: t.tx, hz: t.tz });
  const goalPlaza = { test: isPlaza, hx: plazaC.tx, hz: plazaC.tz };
  const goalPath = (h0) => ({ test: (tx, tz) => at(tx, tz) === PATH || isPlaza(tx, tz), hx: h0.tx, hz: h0.tz });
  const bridgeEnd = (b, side) => ({ tx: side < 0 ? b.tx - 1 : b.tx + 2, tz: b.tz });

  route(spawnT, goalPlaza);
  if (playerHouse) route(playerHouse.door, goalPlaza);
  if (bridges[0]) { route(bridgeEnd(bridges[0], -1), goalPlaza); if (shop) route(shop.door, goalTile(bridgeEnd(bridges[0], 1))); }
  if (ramps[0]) {
    route({ tx: ramps[0].tx, tz: ramps[0].tzTop + 2 }, goalPlaza);
    if (museum) route(museum.door, goalTile({ tx: ramps[0].tx, tz: ramps[0].tzTop - 1 }));
  }
  if (bridges[1]) { route(bridgeEnd(bridges[1], -1), goalPath(spawnT)); if (shop) route(bridgeEnd(bridges[1], 1), goalPath(shop.door)); }
  if (ramps[2] && shop) route({ tx: ramps[2].tx, tz: ramps[2].tzTop + 2 }, goalPath(shop.door), { maxLen: 14 });
  for (const b of villagerHouses) route(b.door, goalPath(b.door), { maxLen: 9 });
  // 길 끝이 경사로·다리에 닿게: 경사로 바로 앞·뒤 칸은 길로
  for (const r of ramps) for (const tz of [r.tzTop - 1, r.tzTop + 2]) {
    const i = idx(r.tx, tz);
    if (K[i] === GRASS) K[i] = PATH;
  }

  // ── 11. 배경 물체 흩뿌리기 ──
  const noise = valueNoise(seed ^ 0x5bd1e995, 9);
  const noise2 = valueNoise(seed ^ 0x2c1b3c6d, 5);
  function addObj(kind, tx, tz, { x, z, rot, scale = 1, variant = null, data = null, force = false } = {}) {
    if (!inside(tx, tz)) return null;
    const i = idx(tx, tz);
    if (occ[i] > 0 || (occ[i] < 0 && !force)) return null;
    const o = {
      id: `${kind}@${tx},${tz}`, kind, tx, tz,
      x: x ?? tx + 0.5 - w / 2, z: z ?? tz + 0.5 - h / 2,
      y: (L[i] && K[i] !== RAMP ? LEVEL_HEIGHT : 0), rot: rot ?? 0, scale, variant, data: data ?? {},
    };
    objects.push(o);
    occ[i] = objects.length;
    return o;
  }
  const freeGrass = (tx, tz, { level = null, kinds = [GRASS] } = {}) => {
    if (!inside(tx, tz)) return false;
    const i = idx(tx, tz);
    return occ[i] === 0 && kinds.includes(K[i]) && !F[i] && (level === null || L[i] === level);
  };
  const isWaterT = (tx, tz) => at(tx, tz) === WATER || at(tx, tz) === SEA;
  const levelEdge = (tx, tz) => nearAny(tx, tz, 1, (a, b) => inside(a, b) && L[idx(a, b)] !== L[idx(tx, tz)]);
  const rampNear = (tx, tz, r = 2) => nearAny(tx, tz, r, (a, b) => at(a, b) === RAMP);
  const trees = [];
  const treeOk = (tx, tz, minD = 2) => trees.every(t => (t.tx - tx) ** 2 + (t.tz - tz) ** 2 >= minD * minD);
  const rot = () => rng() * Math.PI * 2;

  // 비워 둘 곳: 광장 둘레, 선착장 앞, 다리 양끝, 경사로 앞뒤, 처음 서는 곳
  const reserve = (tx, tz, r) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (inside(tx + dx, tz + dz) && !occ[idx(tx + dx, tz + dz)]) occ[idx(tx + dx, tz + dz)] = -1; };
  reserve(spawnT.tx, spawnT.tz, 2);
  for (const b of bridges) { reserve(b.tx - 1, b.tz, 1); reserve(b.tx + 2, b.tz, 1); }
  for (const r of ramps) { reserve(r.tx, r.tzTop - 1, 1); reserve(r.tx, r.tzTop + 2, 1); }
  for (const b of buildings) if (b.kind === 'museum' || b.kind === 'shop') reserve(b.door.tx, b.door.tz + 1, 2);   // 큰 건물 앞마당

  // 광장: 모닥불·안내판·벤치·가로등
  if (inside(plazaC.tx, plazaC.tz)) {
    const P0 = { tx: plazaC.tx, tz: plazaC.tz };
    addObj('campfire', P0.tx, P0.tz, { force: true });
    addObj('signboard', P0.tx, P0.tz - 2, { rot: 0, force: true });
    addObj('bench', P0.tx - 2, P0.tz + 1, { rot: Math.PI / 2, force: true });
    addObj('bench', P0.tx + 2, P0.tz + 1, { rot: -Math.PI / 2, force: true });
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 3], [2, 3]]) addObj('lamp', P0.tx + dx, P0.tz + dz, { force: true });
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (inside(P0.tx + dx, P0.tz + dz) && !occ[idx(P0.tx + dx, P0.tz + dz)]) occ[idx(P0.tx + dx, P0.tz + dz)] = -1;
    for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 3], [4, 3], [-3, -4], [3, -4]]) addObj('bush', P0.tx + dx, P0.tz + dz, { force: true, variant: pick(['pink', 'white', 'blue', 'red'], rng), rot: rot() });
  }

  // 다리·선착장 (배경 물체이기도 하다)
  for (const b of bridges) {
    const o = addObj('bridge', b.tx, b.tz, { x: b.x, z: b.z, rot: 0, force: true });
    if (o) { occ[idx(b.tx + 1, b.tz)] = objects.length; b.id = o.id; }
    addObj('lamp', b.tx - 1, b.tz - 1, { force: true });
  }
  if (dock) {
    const o = addObj('dock', dock.tx, dock.tz, { x: dock.x, z: dock.z, rot: 0, force: true });
    if (o) dock.id = o.id;
    addObj('lamp', dock.tx - 1, dock.tz - 1, { force: true });
  }

  // 집 둘레: 우편함, 양옆 꽃덤불, 플레이어 집 뒤뜰 울타리·꽃밭
  const MAIL = { player: 'red', coco: 'red', bori: 'blue', mochi: 'yellow', dubu: 'green', pong: 'blue', chorong: 'yellow' };
  for (const b of buildings) {
    if (b.kind === 'house-player' || b.kind === 'house-villager') {
      addObj('mailbox', b.door.tx + 1, b.door.tz, { force: true, variant: MAIL[b.data.owner] ?? 'red', data: { owner: b.data.owner } });
      for (const tx of [b.tx0 - 1, b.tx0 + b.fw]) addObj('bush', tx, b.tz0 + b.fd - 1, { force: true, variant: pick(['pink', 'white', 'blue', 'red'], rng), rot: rot() });
    }
    if (b.kind === 'shop') {
      addObj('lamp', b.door.tx - 2, b.door.tz, { force: true });
      for (const tx of [b.tx0 - 1, b.tx0 + b.fw]) addObj('bush', tx, b.tz0 + b.fd - 1, { force: true, variant: 'white', rot: rot() });
    }
    if (b.kind === 'museum') {
      addObj('lamp', b.door.tx - 2, b.door.tz, { force: true });
      addObj('lamp', b.door.tx + 2, b.door.tz, { force: true });
    }
  }
  if (playerHouse) {
    const b = playerHouse, fz = b.tz0 - 2;
    let ok = true;
    for (let tx = b.tx0 - 2; tx <= b.tx0 + b.fw + 1; tx++) if (!freeGrass(tx, fz) && occ[idx(tx, fz)] !== -1) ok = false;
    if (ok) {
      for (let tx = b.tx0 - 2; tx <= b.tx0 + b.fw + 1; tx++) if (K[idx(tx, fz)] === GRASS) addObj('fence', tx, fz, { force: true, variant: 'white' });
      for (const tx of [b.tx0 - 2, b.tx0 + b.fw + 1]) for (let tz = fz + 1; tz <= b.tz0 + 1; tz++) if (K[idx(tx, tz)] === GRASS) addObj('fence', tx, tz, { force: true, variant: 'white', rot: Math.PI / 2 });
      for (let tx = b.tx0 - 1; tx <= b.tx0 + b.fw; tx++) if (K[idx(tx, b.tz0 - 1)] === GRASS) addObj('tulip', tx, b.tz0 - 1, { force: true, variant: pick(['red', 'yellow', 'white', 'pink'], rng), rot: rot(), scale: 1.35 });
    }
  }

  // 과수원 언덕 (지도 13번): 고장 과일나무
  const FRUITS = ['apple', 'pear', 'peach', 'cherry', 'orange'];
  const fruitRolled = pick(FRUITS, rng);                            // 난수 순서를 지키려고 늘 뽑는다
  const nativeFruit = FRUITS.includes(fruitWanted) ? fruitWanted : fruitRolled;   // data 모듈이 정한 특산 과일이 있으면 그걸로
  const orchard = { tx: Math.round(w * 0.81), tz: Math.round(h * 0.76) };
  {
    const spots = [];
    for (let dz = -4; dz <= 4; dz++) for (let dx = -5; dx <= 5; dx++) spots.push([orchard.tx + dx, orchard.tz + dz]);
    spots.sort((p, q) => Math.hypot(p[0] - orchard.tx, p[1] - orchard.tz) - Math.hypot(q[0] - orchard.tx, q[1] - orchard.tz));
    let n = 0;
    for (const [tx, tz] of spots) {
      if (n >= 7) break;
      if ((tx + tz) % 2 || !freeGrass(tx, tz, { level: 0 }) || nearAny(tx, tz, 1, isWaterT) || !treeOk(tx, tz, 2.2) || levelEdge(tx, tz)) continue;
      const o = addObj('fruit-tree', tx, tz, { rot: rot(), scale: 0.95 + rng() * 0.1, variant: nativeFruit, data: { fruit: nativeFruit } });
      if (o) { trees.push(o); n++; }
    }
  }

  // 바위 지대 (지도 14번) + 섬 곳곳: 바위 6개
  const rockTargets = [[0.18, 0.37], [0.2, 0.4], [0.22, 0.36], [0.62, 0.2], [0.86, 0.62], [0.4, 0.86]];
  for (const [fx, fz] of rockTargets) {
    const t = [Math.round(w * fx), Math.round(h * fz)];
    let done = false;
    for (let r = 0; r <= 4 && !done; r++) for (let dz = -r; dz <= r && !done; dz++) for (let dx = -r; dx <= r && !done; dx++) {
      const tx = t[0] + dx, tz = t[1] + dz;
      if (!freeGrass(tx, tz) || nearAny(tx, tz, 1, isWaterT) || levelEdge(tx, tz) || rampNear(tx, tz)) continue;
      if (objects.some(o => o.kind === 'rock' && Math.abs(o.tx - tx) + Math.abs(o.tz - tz) < 2)) continue;
      done = !!addObj('rock', tx, tz, { rot: rot(), scale: 0.95 + rng() * 0.15 });
    }
  }

  // 나무: 숲 밀도 잡음을 따라 활엽수(아래)·삼나무(언덕 위), 과일나무 몇 그루
  const cells = [];
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) cells.push([tx, tz]);
  shuffle(cells, rng);
  let nTree = 0, nCedar = 0, nFruit = 0;
  for (const [tx, tz] of cells) {
    if (!freeGrass(tx, tz)) continue;
    const i = idx(tx, tz);
    if (nearAny(tx, tz, 1, isWaterT) || levelEdge(tx, tz) || rampNear(tx, tz, 2)) continue;
    if (nearAny(tx, tz, 1, (a, b) => at(a, b) === PATH || at(a, b) === PLAZA) && rng() < 0.6) continue;
    const dens = noise(tx, tz);
    if (L[i]) {
      if (nCedar >= 26 || !treeOk(tx, tz, 2.2) || rng() > (dens - 0.15) * 1.4) continue;
      const o = addObj('cedar', tx, tz, { rot: rot(), scale: 0.9 + rng() * 0.25 });
      if (o) { trees.push(o); nCedar++; }
    } else {
      if (nTree >= 78 || !treeOk(tx, tz, 2) || rng() > (dens - 0.22) * 1.3) continue;
      const fruit = nFruit < 5 && rng() < 0.1;
      const o = addObj(fruit ? 'fruit-tree' : 'tree', tx, tz, { rot: rot(), scale: 0.9 + rng() * 0.2, variant: fruit ? nativeFruit : null, data: fruit ? { fruit: nativeFruit } : {} });
      if (o) { trees.push(o); fruit ? nFruit++ : nTree++; }
    }
  }

  // 야자수: 모래사장 안쪽 (풀밭 가까이)
  const palms = [];
  for (const [tx, tz] of cells) {
    if (palms.length >= 12 || !freeGrass(tx, tz, { kinds: [SAND] })) continue;
    if (!nearAny(tx, tz, 2, (a, b) => at(a, b) === GRASS) || nearAny(tx, tz, 1, (a, b) => at(a, b) === WATER)) continue;
    if (dock && Math.abs(tx - dock.tx) < 5 && tz > dock.tz - 4) continue;
    if (!treeOk(tx, tz, 2) || palms.some(p => Math.hypot(p.tx - tx, p.tz - tz) < 5)) continue;
    const o = addObj('palm', tx, tz, { rot: rot(), scale: 0.9 + rng() * 0.2 });
    if (o) { trees.push(o); palms.push(o); }
  }

  // 꽃 무더기: 같은 꽃끼리 4~8송이, 색은 두 가지씩
  const FLOWERS = { tulip: ['red', 'yellow', 'white', 'pink'], cosmos: ['pink', 'white', 'orange', 'red'], pansy: ['purple', 'yellow', 'blue', 'orange'] };
  const clusters = [];
  for (const [tx, tz] of cells) {
    if (clusters.length >= 14) break;
    if (!freeGrass(tx, tz) || clusters.some(c => Math.hypot(c[0] - tx, c[1] - tz) < 6)) continue;
    if (noise2(tx, tz) < 0.35) continue;
    clusters.push([tx, tz]);
    const sp = pick(Object.keys(FLOWERS), rng);
    const cols = shuffle(FLOWERS[sp].slice(), rng).slice(0, 2);
    const n = 4 + Math.floor(rng() * 5);
    let made = 0;
    for (let r = 0; r <= 2 && made < n; r++) for (let dz = -r; dz <= r && made < n; dz++) for (let dx = -r; dx <= r && made < n; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || rng() < 0.25) continue;
      if (!freeGrass(tx + dx, tz + dz, { level: L[idx(tx, tz)] })) continue;
      if (addObj(sp, tx + dx, tz + dz, { rot: rot(), scale: 1.25 + rng() * 0.2, variant: pick(cols, rng) })) made++;
    }
  }

  // 꽃덤불 몇 개, 잡초, 조개, 화석 자리
  let nBush = 0, nWeed = 0, nShell = 0, nFossil = 0;
  for (const [tx, tz] of cells) {
    if (nBush >= 8) break;
    if (!freeGrass(tx, tz, { level: 0 }) || nearAny(tx, tz, 1, isWaterT) || levelEdge(tx, tz) || noise(tx, tz) < 0.55 || !treeOk(tx, tz, 1.5)) continue;
    if (addObj('bush', tx, tz, { rot: rot(), variant: pick(['pink', 'white', 'blue', 'red'], rng) })) nBush++;
  }
  for (const [tx, tz] of cells) {
    if (nWeed >= 32) break;
    if (!freeGrass(tx, tz) || rng() < 0.5) continue;
    if (addObj('weed', tx, tz, { rot: rot(), scale: 1.2 + rng() * 0.3 })) nWeed++;
  }
  for (const [tx, tz] of cells) {
    if (nShell >= 11) break;
    if (!freeGrass(tx, tz, { kinds: [SAND] }) || !nearAny(tx, tz, 1, (a, b) => at(a, b) === SEA)) continue;
    if (dock && Math.abs(tx - dock.tx) < 3 && tz > dock.tz - 3) continue;
    if (objects.some(o => o.kind === 'shell' && Math.abs(o.tx - tx) + Math.abs(o.tz - tz) < 5)) continue;
    if (addObj('shell', tx, tz, { rot: rot(), scale: 1.4, variant: pick(['peach', 'white', 'pink'], rng) })) nShell++;
  }
  for (const [tx, tz] of cells) {
    if (nFossil >= 4) break;
    if (!freeGrass(tx, tz) || nearAny(tx, tz, 1, (a, b) => at(a, b) === PATH)) continue;
    if (objects.some(o => o.kind === 'fossil-spot' && Math.hypot(o.tx - tx, o.tz - tz) < 12)) continue;
    if (addObj('fossil-spot', tx, tz, { rot: rot() })) nFossil++;
  }

  // ── 12. 장소 ──
  const tw = (tx, tz) => ({ x: tx + 0.5 - w / 2, z: tz + 0.5 - h / 2 });
  const bPlace = b => b && { x: b.x, z: b.z, door: tw(b.door.tx, b.door.tz), tx: b.door.tx, tz: b.door.tz };
  const places = {
    spawn: dock ? { x: dock.x, z: dock.z - 1, facing: 0 } : { ...tw(spawnT.tx, spawnT.tz), facing: 0 },
    plaza: tw(plazaC.tx, plazaC.tz),
    shop: bPlace(shop),
    museum: bPlace(museum),
    dock: dock ? { x: dock.x, z: dock.z + 2.5 } : null,
    playerHouse: bPlace(playerHouse),
    villagerHouses: villagerHouses.map(b => ({ slug: b.data.owner, ...bPlace(b) })),
    pond: { x: pond.x - w / 2, z: pond.z - h / 2 },
    waterfall: waterfalls[0] ? tw(waterfalls[0].tx, waterfalls[0].tz + 1) : null,
    bridges: bridges.map(b => ({ x: b.x, z: b.z })),
    ramps: ramps.map(r => ({ x: r.tx + 0.5 - w / 2, z: r.tzTop + 1 - h / 2 })),
    orchard: tw(orchard.tx, orchard.tz),
  };

  return { w, h, seed, kind: K, level: L, flags: F, rampMap, ramps, bridges, dock, waterfalls, objects, places, pads, buildings, nativeFruit };

  // ── 도우미 ──
  function nearAny(tx, tz, r, test) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if ((dx || dz) && test(tx + dx, tz + dz)) return true;
    return false;
  }

  function fillEnclosedSea() {
    const seen = new Uint8Array(N);
    const q = [];
    for (let tx = 0; tx < w; tx++) { q.push(idx(tx, 0), idx(tx, h - 1)); }
    for (let tz = 0; tz < h; tz++) { q.push(idx(0, tz), idx(w - 1, tz)); }
    for (const i of q) seen[i] = 1;
    while (q.length) {
      const i = q.pop(), tx = i % w, tz = (i / w) | 0;
      for (const [a, b] of N4) {
        const x = tx + a, z = tz + b;
        if (!inside(x, z)) continue;
        const j = idx(x, z);
        if (!seen[j] && K[j] === SEA) { seen[j] = 1; q.push(j); }
      }
    }
    for (let i = 0; i < N; i++) if (K[i] === SEA && !seen[i]) K[i] = SAND;
  }

  /** test(i) 가 참인 칸에서의 거리 (8방향 근사) */
  function distanceFrom(test) {
    const d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = test(i) ? 0 : 1e9;
    const relax = (tx, tz, a, b, c) => {
      const x = tx + a, z = tz + b;
      const v = inside(x, z) ? d[idx(x, z)] + c : c;      // 바깥은 거리 0 으로 본다
      if (v < d[idx(tx, tz)]) d[idx(tx, tz)] = v;
    };
    for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) { relax(tx, tz, -1, 0, 1); relax(tx, tz, 0, -1, 1); relax(tx, tz, -1, -1, SQRT2); relax(tx, tz, 1, -1, SQRT2); }
    for (let tz = h - 1; tz >= 0; tz--) for (let tx = w - 1; tx >= 0; tx--) { relax(tx, tz, 1, 0, 1); relax(tx, tz, 0, 1, 1); relax(tx, tz, 1, 1, SQRT2); relax(tx, tz, -1, 1, SQRT2); }
    return d;
  }

  /** 4방향 A*. 길은 곧게(꺾으면 비용), 기존 길은 싸게, 건물 자리는 못 지나간다. */
  function astar(from, goal) {
    const g = new Float32Array(N * 4).fill(Infinity);   // 칸 × 들어온 방향
    const prev = new Int32Array(N * 4).fill(-1);
    const heap = [];
    const push = (s, f) => { heap.push([f, s]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const hfun = (tx, tz) => Math.abs(tx - goal.hx) + Math.abs(tz - goal.hz);
    const s0 = idx(from.tx, from.tz) * 4;
    g[s0] = 0; push(s0, hfun(from.tx, from.tz));
    while (heap.length) {
      const [, s] = pop();
      const i = s >> 2, dir = s & 3, tx = i % w, tz = (i / w) | 0;
      if (goal.test(tx, tz)) {
        const out = [];
        for (let c = s; c >= 0; c = prev[c]) out.push([(c >> 2) % w, ((c >> 2) / w) | 0]);
        return out.reverse();
      }
      for (let d = 0; d < 4; d++) {
        const [a, b] = N4[d], nx = tx + a, nz = tz + b;
        if (!passable(tx, tz, nx, nz)) continue;
        const j = idx(nx, nz);
        if (occ[j] === -1 && !goal.test(nx, nz) && buildings.some(bd => nx >= bd.tx0 && nx < bd.tx0 + bd.fw && nz >= bd.tz0 && nz < bd.tz0 + bd.fd)) continue;
        if (occ[j] > 0) continue;
        const k = K[j];
        let c = k === PATH || k === PLAZA ? 0.35 : k === SAND ? 1.6 : 1;
        if (k === GRASS && nearAny(nx, nz, 1, (p, q) => at(p, q) === WATER)) c += 0.8;
        if (s !== s0 && d !== dir) c += 0.6;
        const ns = j * 4 + d, ng = g[s] + c;
        if (ng < g[ns]) { g[ns] = ng; prev[ns] = s; push(ns, ng + hfun(nx, nz)); }
      }
    }
    return null;
  }
}

/** 두 칸 사이를 걸어서 지나갈 수 있나 (가로세로 이웃). 같은 높이끼리, 경사로는 위칸↔북쪽 언덕, 아래칸↔남쪽 땅만. */
function passableOn(g, ax, az, bx, bz) {
  if (!g.inside(bx, bz) || !g.inside(ax, az)) return false;
  const ia = g.idx(ax, az), ib = g.idx(bx, bz);
  if (!g.walkableI(ib) || !g.walkableI(ia)) return false;
  const ra = g.rampMap[ia], rb = g.rampMap[ib];
  if (ra >= 0 || rb >= 0) {
    if (ra >= 0 && rb >= 0) return ra >> 1 === rb >> 1;
    const part = ra >= 0 ? ra & 1 : rb & 1;
    const [rx, rz, ox, oz] = ra >= 0 ? [ax, az, bx, bz] : [bx, bz, ax, az];
    if (ox !== rx) return false;
    return part === 0 ? oz === rz - 1 : oz === rz + 1;
  }
  return g.L[ia] === g.L[ib];
}

/** 생성 결과에 조회 함수를 붙인다 (CONTRACTS 의 world.island). */
export function createIslandApi(gen) {
  const { w, h, kind: K, level: L, flags: F, rampMap, ramps, bridges, dock, pads } = gen;
  const idx = (tx, tz) => tz * w + tx;
  const inside = (tx, tz) => tx >= 0 && tz >= 0 && tx < w && tz < h;
  const walkableI = i => (K[i] !== SEA && K[i] !== WATER) || (F[i] & (FLAG.BRIDGE | FLAG.DOCK)) !== 0;
  const g = { inside, idx, K, L, F, rampMap, walkableI };
  const toTile = (x, z) => ({ tx: Math.floor(x + w / 2), tz: Math.floor(z + h / 2) });
  const toWorld = (tx, tz) => ({ x: tx + 0.5 - w / 2, z: tz + 0.5 - h / 2 });

  const passable = (ax, az, bx, bz) => {
    if (ax === bx || az === bz) return passableOn(g, ax, az, bx, bz);
    return (passableOn(g, ax, az, bx, az) && passableOn(g, bx, az, bx, bz)) || (passableOn(g, ax, az, ax, bz) && passableOn(g, ax, bz, bx, bz));
  };

  const deckHeight = (x, z) => {
    for (const b of bridges) {
      const u = x - b.x, v = z - b.z;
      if (Math.abs(u) <= 1.55 && Math.abs(v) <= 0.72) return Math.max(0.1, 0.38 - 0.11 * u * u);
    }
    if (dock && Math.abs(x - dock.x) <= 1.0 && z >= dock.z - 0.1 && z <= dock.z + 4.1) return 0.385;
    for (const p of pads) {
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      if (p.h != null) return p.y + p.h;
      const e = Math.min(x - p.x0, p.x1 - x, z - p.z0, p.z1 - z);
      const step = Math.min(p.steps.length - 1, Math.floor(e / p.stepW));
      return p.y + p.steps[p.steps.length - 1 - step];
    }
    return null;
  };

  const api = {
    w, h,
    tileAt(tx, tz) { return inside(tx, tz) ? KIND_NAMES[K[idx(tx, tz)]] : 'sea'; },
    levelAt(tx, tz) { return inside(tx, tz) ? L[idx(tx, tz)] : 0; },
    flagsAt(tx, tz) { return inside(tx, tz) ? F[idx(tx, tz)] : 0; },
    heightAt(x, z) {
      const d = deckHeight(x, z);
      const { tx, tz } = toTile(x, z);
      if (!inside(tx, tz)) return WATER_TOP;
      const i = idx(tx, tz), k = K[i];
      let y;
      if (k === RAMP) {
        const r = ramps[rampMap[i] >> 1];
        const zLow = r.tzTop + 2 - h / 2;
        y = Math.min(1, Math.max(0, (zLow - z) / 2)) * LEVEL_HEIGHT;
      } else if (k === WATER || k === SEA) y = L[i] * LEVEL_HEIGHT + WATER_TOP;
      else y = L[i] * LEVEL_HEIGHT;
      return d != null ? Math.max(d, y) : y;
    },
    /** 땅만 본 걸을 수 있음 (물체 충돌은 world.isWalkable 이 더한다) */
    isWalkableTile(tx, tz) { return inside(tx, tz) && walkableI(idx(tx, tz)); },
    isWater(x, z) { const { tx, tz } = toTile(x, z); const k = inside(tx, tz) ? K[idx(tx, tz)] : SEA; return k === WATER || k === SEA; },
    toTile, toWorld, passable,
    rampAt(tx, tz) { const r = inside(tx, tz) ? rampMap[idx(tx, tz)] : -1; return r < 0 ? null : { ramp: ramps[r >> 1], part: r & 1 }; },
    /** 발소리·효과용 바닥 종류 */
    groundAt(x, z) {
      if (deckHeight(x, z) != null) {
        const { tx, tz } = toTile(x, z);
        const f = inside(tx, tz) ? F[idx(tx, tz)] : 0;
        if (f || bridges.some(b => Math.abs(x - b.x) <= 1.55 && Math.abs(z - b.z) <= 0.72)) return 'wood';
      }
      return api.tileAt(...Object.values(toTile(x, z)));
    },
  };
  return api;
}

function segDist(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
