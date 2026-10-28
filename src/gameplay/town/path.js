// 칸 길찾기 (DOM·three 없음): world.island 의 isWalkable(물체 충돌 포함)·passable(높이·경사로·물)로 A*.
// 흙길·광장 칸은 조금 싸게 쳐서 주민이 길을 따라 걷는 편이다.

const SQRT2 = Math.SQRT2;
const ROAD = { path: 0.75, plaza: 0.75 };

export function createNav(island) {
  const { w, h } = island;
  const N = w * h;
  const inside = (tx, tz) => tx >= 0 && tz >= 0 && tx < w && tz < h;
  const center = (tx, tz) => island.toWorld(tx, tz);

  /** 칸 가운데가 걸을 수 있나 (나무·건물 칸은 못 감) */
  function walkable(tx, tz) {
    if (!inside(tx, tz)) return false;
    const c = center(tx, tz);
    return island.isWalkable(c.x, c.z);
  }
  /** 이웃 칸으로 한 걸음 (대각선은 양옆이 다 열려 있어야) */
  function step(ax, az, bx, bz) {
    if (!walkable(bx, bz) || !island.passable(ax, az, bx, bz)) return false;
    if (ax !== bx && az !== bz) {
      if (!walkable(bx, az) || !walkable(ax, bz)) return false;
      if (!island.passable(ax, az, bx, az) || !island.passable(ax, az, ax, bz)) return false;
    }
    return true;
  }

  // A* 용 재사용 배열
  const g = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), closed = new Uint32Array(N);
  let stamp = 0;

  /** a, b = {tx, tz} → 칸 목록 [{tx,tz}…] (a, b 포함) 또는 null */
  function findPath(a, b, { maxNodes = 2600 } = {}) {
    if (!inside(a.tx, a.tz) || !walkable(b.tx, b.tz)) return null;
    if (a.tx === b.tx && a.tz === b.tz) return [{ tx: a.tx, tz: a.tz }];
    stamp++;
    const goal = b.tz * w + b.tx, start = a.tz * w + a.tx;
    const hOf = i => { const dx = Math.abs(i % w - b.tx), dz = Math.abs(((i / w) | 0) - b.tz); return 0.75 * (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)); };
    const heap = new MinHeap();
    g[start] = 0; from[start] = -1; seen[start] = stamp;
    heap.push(start, hOf(start));
    let n = 0;
    while (heap.size) {
      const i = heap.pop();
      if (closed[i] === stamp) continue;
      closed[i] = stamp;
      if (i === goal) break;
      if (++n > maxNodes) return null;
      const tx = i % w, tz = (i / w) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = tx + dx, nz = tz + dz;
        if (!inside(nx, nz)) continue;
        const j = nz * w + nx;
        if (closed[j] === stamp || !step(tx, tz, nx, nz)) continue;
        const cost = (dx && dz ? SQRT2 : 1) * (ROAD[island.tileAt(nx, nz)] ?? 1);
        const ng = g[i] + cost;
        if (seen[j] === stamp && ng >= g[j]) continue;
        seen[j] = stamp; g[j] = ng; from[j] = i;
        heap.push(j, ng + hOf(j));
      }
    }
    if (closed[goal] !== stamp) return null;
    const out = [];
    for (let i = goal; i !== -1; i = from[i]) out.push({ tx: i % w, tz: (i / w) | 0 });
    return out.reverse();
  }

  /** 두 점 사이를 곧게 걸어도 되나 (지나는 칸마다 걸을 수 있고 넘어갈 수 있는지) */
  function lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 0.2));
    let prev = island.toTile(ax, az);
    for (let k = 1; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      const t = island.toTile(x, z);
      if (t.tx !== prev.tx || t.tz !== prev.tz) {
        if (!walkable(t.tx, t.tz) || !island.passable(prev.tx, prev.tz, t.tx, t.tz)) return false;
        prev = t;
      }
      // 칸 안쪽이라도 물체(줄기·울타리)에 닿으면 안 된다
      if (!island.isWalkable(x, z)) return false;
    }
    return true;
  }

  /** 칸 목록 → 곧은 구간을 줄인 월드 좌표 목록 [{x, z}] (첫 점은 뺀다) */
  function smooth(tiles, fromX, fromZ) {
    const pts = tiles.map(t => center(t.tx, t.tz));
    const out = [];
    let cx = fromX, cz = fromZ, i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 7);
      while (j > i && !lineClear(cx, cz, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      cx = pts[j].x; cz = pts[j].z;
      i = j + 1;
    }
    return out;
  }

  /** start 칸에서 depth 걸음 안에 갈 수 있는 칸들 */
  function reach(start, depth, test = null) {
    const out = [];
    if (!inside(start.tx, start.tz)) return out;
    const dist = new Map([[start.tz * w + start.tx, 0]]);
    const q = [start.tz * w + start.tx];
    while (q.length) {
      const i = q.shift(), d = dist.get(i), tx = i % w, tz = (i / w) | 0;
      if (walkable(tx, tz) && (!test || test(tx, tz))) out.push({ tx, tz });
      if (d >= depth) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx, nz = tz + dz, j = nz * w + nx;
        if (!inside(nx, nz) || dist.has(j) || !step(tx, tz, nx, nz)) continue;
        dist.set(j, d + 1);
        q.push(j);
      }
    }
    return out;
  }

  return { findPath, smooth, lineClear, walkable, reach, step };
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p] <= val) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mv = lv;
        if (l < n && v[l] < mv) { m = l; mv = v[l]; }
        if (r < n && v[r] < mv) { m = r; mv = v[r]; }
        if (m === i) break;
        k[i] = k[m]; v[i] = v[m]; i = m;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}
