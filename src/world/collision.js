// 충돌: 원(플레이어·주민) 하나를 지형 칸과 물체 충돌체에서 밀어낸다 → 벽을 따라 미끄러진다.
// 지형: 지금 서 있는 칸에서 못 넘어가는 이웃 칸(물, 높이가 다른 칸, 경사로 옆)을 상자로 본다.
// 물체: 원(나무 줄기·바위) 또는 축 정렬 상자(건물·울타리·벤치). 칸별 해시로 가까운 것만 본다.

export function createCollision(island) {
  const { w, h } = island;
  const cells = new Map();          // 칸 번호 → Set(충돌체)

  const cellsOf = c => {
    const out = [];
    const [x0, z0, x1, z1] = c.type === 'circle' ? [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r] : [c.x0, c.z0, c.x1, c.z1];
    const a = island.toTile(x0, z0), b = island.toTile(x1, z1);
    for (let tz = a.tz; tz <= b.tz; tz++) for (let tx = a.tx; tx <= b.tx; tx++) if (tx >= 0 && tz >= 0 && tx < w && tz < h) out.push(tz * w + tx);
    return out;
  };
  function add(c) { for (const k of cellsOf(c)) { if (!cells.has(k)) cells.set(k, new Set()); cells.get(k).add(c); } return c; }
  function remove(c) { for (const k of cellsOf(c)) cells.get(k)?.delete(c); }

  // 움직이는 원 (주민·플레이어): 칸 해시에 넣지 않고 move 때마다 본다. m = { x, z, r, y?, active? } (값은 getter 여도 된다)
  // 자기 자신은 막지 않는다 — 출발점이 그 원의 중심이면 건너뛴다.
  const movers = new Set();
  function addMover(m) { movers.add(m); return () => movers.delete(m); }

  function near(tx, tz, out) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, z = tz + dz;
      if (x < 0 || z < 0 || x >= w || z >= h) continue;
      const s = cells.get(z * w + x);
      if (s) for (const c of s) out.add(c);
    }
    return out;
  }

  /** 점이 충돌체 안에 있나 */
  function blockedAt(x, z, y = null) {
    const { tx, tz } = island.toTile(x, z);
    for (const c of near(tx, tz, new Set())) {
      if (y != null && Math.abs(c.y - y) > 0.6) continue;
      if (c.type === 'circle' ? (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r : x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true;
    }
    return false;
  }

  // 원을 상자 밖으로 민다. 겹치면 true
  const pushBox = (p, r, x0, z0, x1, z1) => {
    const qx = Math.max(x0, Math.min(p.x, x1)), qz = Math.max(z0, Math.min(p.z, z1));
    const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else {   // 중심이 상자 안: 가장 얕은 쪽으로
      const pen = [[p.x - x0 + r, -1, 0], [x1 - p.x + r, 1, 0], [p.z - z0 + r, 0, -1], [z1 - p.z + r, 0, 1]].sort((a, b) => a[0] - b[0])[0];
      p.x += pen[1] * pen[0]; p.z += pen[2] * pen[0];
    }
    return true;
  };
  const pushCircle = (p, r, cx, cz, cr) => {
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz, R = r + cr;
    if (d2 >= R * R) return false;
    const d = Math.sqrt(d2) || 1e-5;
    p.x = cx + (dx / d) * R; p.z = cz + (dz / d) * R;
    return true;
  };

  /**
   * (fx, fz) 에서 (nx, nz) 로 반지름 r 인 원을 옮긴다. 막히면 벽을 따라 미끄러진 자리를 돌려준다.
   * y: 지금 높이 (다른 단의 물체는 무시)
   */
  function move(fx, fz, nx, nz, r = 0.28, y = null) {
    const p = { x: fx, z: fz };
    const dist = Math.hypot(nx - fx, nz - fz);
    const steps = Math.max(1, Math.ceil(dist / 0.12));
    const sx = (nx - fx) / steps, sz = (nz - fz) / steps;
    const set = new Set();
    const others = [];
    for (const m of movers) {
      if (m.active === false || (Math.abs(m.x - fx) < 1e-6 && Math.abs(m.z - fz) < 1e-6)) continue;
      if (y != null && m.y != null && Math.abs(m.y - y) > 0.6) continue;
      if (Math.hypot(m.x - fx, m.z - fz) < dist + r + m.r + 0.5) others.push({ x: m.x, z: m.z, r: m.r });
    }
    for (let s = 0; s < steps; s++) {
      const prev = { x: p.x, z: p.z };
      const pt = island.toTile(prev.x, prev.z);
      p.x += sx; p.z += sz;
      for (let it = 0; it < 3; it++) {
        const { tx, tz } = island.toTile(p.x, p.z);
        const free = !island.isWalkableTile(tx, tz);        // 물속에 갇혔으면 빠져나오게 둔다
        let hit = false;
        if (!free) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          if (island.passable(tx, tz, tx + dx, tz + dz)) continue;
          const c = island.toWorld(tx + dx, tz + dz);
          hit = pushBox(p, r, c.x - 0.5, c.z - 0.5, c.x + 0.5, c.z + 0.5) || hit;
        }
        set.clear();
        for (const c of near(tx, tz, set)) {
          if (y != null && Math.abs(c.y - y) > 0.6) continue;
          hit = (c.type === 'circle' ? pushCircle(p, r, c.x, c.z, c.r) : pushBox(p, r, c.x0, c.z0, c.x1, c.z1)) || hit;
        }
        for (const c of others) hit = pushCircle(p, r, c.x, c.z, c.r) || hit;
        if (!hit) break;
      }
      // 밀어낸 뒤에도 못 가는 칸에 들어갔으면 이 걸음은 취소
      const nt = island.toTile(p.x, p.z);
      if ((nt.tx !== pt.tx || nt.tz !== pt.tz) && island.isWalkableTile(pt.tx, pt.tz) && !island.passable(pt.tx, pt.tz, nt.tx, nt.tz)) { p.x = prev.x; p.z = prev.z; break; }
    }
    return p;
  }

  return { add, remove, move, blockedAt, cells, addMover, movers };
}
