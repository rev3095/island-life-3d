// 집 안 바닥 칸 계산 (three·DOM 없음 → node 로도 돈다).
// 좌표는 방 기준 칸 단위: lx = 0(서쪽 벽) ~ W(동쪽 벽), lz = 0(북쪽 벽) ~ D(앞쪽 문). 칸 (gx, gz) 는 [gx, gx+1) × [gz, gz+1).
// 바닥 가구 rec = { id, item, gx, gz, rot } — (gx, gz) 는 돌린 뒤 발자국의 북서쪽 칸, rot 0~3 은 정면 방향 (0 남 · 1 동 · 2 북 · 3 서).
// 벽 가구 rec = { id, item, wall: 'n'|'w'|'e', slot } — 북쪽 벽은 slot = gx, 서·동쪽 벽은 slot = gz.

export const ROOM_W = 8, ROOM_D = 8;
export const QUARTER = Math.PI / 2;

/** 돌린 발자국 [가로, 깊이] */
export const dims = ([w, d], rot) => (rot % 2 ? [d, w] : [w, d]);

/** 바닥 가구가 차지하는 칸들 */
export function cellsOf(rec, footprint) {
  const [w, d] = dims(footprint, rec.rot);
  const out = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) out.push([rec.gx + x, rec.gz + z]);
  return out;
}

/** 발자국 상자 (칸 단위) { x0, z0, x1, z1, cx, cz } */
export function boxOf(rec, footprint) {
  const [w, d] = dims(footprint, rec.rot);
  return { x0: rec.gx, z0: rec.gz, x1: rec.gx + w, z1: rec.gz + d, cx: rec.gx + w / 2, cz: rec.gz + d / 2 };
}

/** 플레이어 facing(라디안, 0 = 북쪽) → 바라보는 네 방향 번호 0 북 · 1 서 · 2 남 · 3 동, 그리고 그 쪽을 보며 놓을 때의 rot */
export function facingDir(facing) {
  const k = ((Math.round(facing / QUARTER) % 4) + 4) % 4;
  return { k, rot: [0, 1, 2, 3][k], step: [[0, -1], [-1, 0], [0, 1], [1, 0]][k] };
}

/**
 * 바닥 가구를 놓아도 되나.
 * info(itemId) → { footprint, layer } ('rug' 면 깔개: 깔개끼리만 겹치면 안 된다)
 * opts: { reserved: Set('gx,gz'), ignore: rec.id, blockCells: Set('gx,gz') (플레이어가 선 칸 등, 깔개는 무시) }
 */
export function fits(placed, rec, info, { reserved = new Set(), ignore = null, blockCells = new Set(), w = ROOM_W, d = ROOM_D } = {}) {
  const me = info(rec.item);
  if (!me) return false;
  const rug = me.layer === 'rug';
  const mine = cellsOf(rec, me.footprint);
  for (const [x, z] of mine) {
    if (x < 0 || z < 0 || x >= w || z >= d) return false;
    if (reserved.has(`${x},${z}`)) return false;
    if (!rug && blockCells.has(`${x},${z}`)) return false;
  }
  const taken = new Set();
  for (const o of placed) {
    if (o === rec || o.id === ignore || o.id === rec.id || o.wall) continue;
    const oi = info(o.item);
    if (!oi || (oi.layer === 'rug') !== rug) continue;
    for (const [x, z] of cellsOf(o, oi.footprint)) taken.add(`${x},${z}`);
  }
  return !mine.some(([x, z]) => taken.has(`${x},${z}`));
}

/**
 * 플레이어 앞에 놓을 자리 찾기. lx, lz: 방 기준 플레이어 위치, facing: player.facing.
 * 앞줄 가운데 → 옆으로 한두 칸 → 한 칸 더 앞 순서로 맞는 자리를 찾는다. 없으면 null.
 * 돌려주는 값: { gx, gz, rot } (정면이 플레이어를 본다)
 */
export function spotInFront(placed, item, lx, lz, facing, info, opts = {}) {
  const me = info(item);
  if (!me) return null;
  const { k, rot } = facingDir(facing);
  const [w, d] = dims(me.footprint, rot);
  const ptx = Math.floor(lx), ptz = Math.floor(lz);
  const base = [
    { gx: Math.round(lx - w / 2), gz: ptz - d },   // 북
    { gx: ptx - w, gz: Math.round(lz - d / 2) },   // 서
    { gx: Math.round(lx - w / 2), gz: ptz + 1 },   // 남
    { gx: ptx + 1, gz: Math.round(lz - d / 2) },   // 동
  ][k];
  const [fx, fz] = [[0, -1], [-1, 0], [0, 1], [1, 0]][k];
  const side = [fz !== 0 ? 1 : 0, fx !== 0 ? 1 : 0];
  const blockCells = new Set([`${ptx},${ptz}`, ...(opts.blockCells ?? [])]);
  for (const ahead of [0, 1]) {
    for (const s of [0, -1, 1, -2, 2]) {
      const rec = { id: opts.ignore ?? '__new__', item, rot, gx: base.gx + fx * ahead + side[0] * s, gz: base.gz + fz * ahead + side[1] * s };
      if (fits(placed, rec, info, { ...opts, blockCells })) return { gx: rec.gx, gz: rec.gz, rot };
    }
  }
  return null;
}

/** 제자리에서 90° 돌리기 → 새 { gx, gz, rot } 또는 null (가운데를 지키고, 안 되면 한 칸씩 비켜 본다) */
export function rotateInPlace(placed, rec, info, opts = {}) {
  const me = info(rec.item);
  if (!me) return null;
  const rot = (rec.rot + 1) % 4;
  const { cx, cz } = boxOf(rec, me.footprint);
  const [w, d] = dims(me.footprint, rot);
  const gx0 = Math.round(cx - w / 2), gz0 = Math.round(cz - d / 2);
  for (const [sx, sz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    const next = { ...rec, rot, gx: gx0 + sx, gz: gz0 + sz };
    if (fits(placed, next, info, { ...opts, ignore: rec.id })) return { gx: next.gx, gz: next.gz, rot };
  }
  return null;
}

/**
 * 벽에 걸 자리: 플레이어가 벽 가까이에서 벽을 보고 있으면 { wall, slot }, 아니면 null.
 * reach: 벽까지 거리(칸) 한계, w·d: 방 크기 (M14 넓힌 방)
 */
export function wallInFront(lx, lz, facing, { w = ROOM_W, d = ROOM_D, reach = 1.4 } = {}) {
  const { k } = facingDir(facing);
  if (k === 0 && lz < reach) return { wall: 'n', slot: clampInt(Math.floor(lx), 0, w - 1) };
  if (k === 1 && lx < reach) return { wall: 'w', slot: clampInt(Math.floor(lz), 0, d - 1) };
  if (k === 3 && lx > w - reach) return { wall: 'e', slot: clampInt(Math.floor(lz), 0, d - 1) };
  return null;
}
const clampInt = (v, a, b) => Math.max(a, Math.min(b, v));

/** 벽 자리가 비었나. windows: 창문 자리 Set('n:1') — 창문 가구는 창문 자리만, 벽 가구는 창문이 아닌 자리만 */
export function wallFree(placed, wall, slot, place, windows, ignore = null) {
  const key = `${wall}:${slot}`;
  if (place === 'window' ? !windows.has(key) : windows.has(key)) return false;
  return !placed.some(o => o.wall === wall && o.slot === slot && o.id !== ignore);
}

// ---------- 충돌 (방 안에서 원 하나 옮기기) ----------

const pushBox = (p, r, b) => {
  const qx = Math.max(b.x0, Math.min(p.x, b.x1)), qz = Math.max(b.z0, Math.min(p.z, b.z1));
  const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) { const dd = Math.sqrt(d2), k = (r - dd) / dd; p.x += dx * k; p.z += dz * k; }
  else {
    const pen = [[p.x - b.x0 + r, -1, 0], [b.x1 - p.x + r, 1, 0], [p.z - b.z0 + r, 0, -1], [b.z1 - p.z + r, 0, 1]].sort((a, c) => a[0] - c[0])[0];
    p.x += pen[1] * pen[0]; p.z += pen[2] * pen[0];
  }
  return true;
};

/** (fx,fz) → (nx,nz) 로 반지름 r 원을 옮긴다. boxes 는 막는 상자, bounds 는 걸을 수 있는 네모. 벽을 따라 미끄러진 자리 {x, z} */
export function moveCircle(boxes, bounds, fx, fz, nx, nz, r) {
  const p = { x: fx, z: fz };
  const steps = Math.max(1, Math.ceil(Math.hypot(nx - fx, nz - fz) / 0.12));
  const sx = (nx - fx) / steps, sz = (nz - fz) / steps;
  for (let s = 0; s < steps; s++) {
    p.x += sx; p.z += sz;
    for (let it = 0; it < 3; it++) {
      let hit = false;
      for (const b of boxes) hit = pushBox(p, r, b) || hit;
      if (!hit) break;
    }
    p.x = Math.max(bounds.x0 + r, Math.min(bounds.x1 - r, p.x));
    p.z = Math.max(bounds.z0 + r, Math.min(bounds.z1 - r, p.z));
  }
  return p;
}

/** 점이 상자 안에 있나 (margin 만큼 넓혀서) */
export const inBox = (b, x, z, margin = 0) => x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin;
