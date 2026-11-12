// M14 섬 꾸미기로 놓는 다리(TI-13)·경사로(TI-14): 생성기 칸 표(gen.kind·level·flags·rampMap·ramps·bridges)를 바꿔서
// 플레이어 이동(collision.js — passable)·높이(heightAt — deckHeight·경사로)·주민·봇 길찾기(town/path.js)가 그대로 따라오게 한다 (결정 D153-A).
// three·DOM 없음 → tests/built.test.mjs 가 섬 생성기로 돌린다. 저장·모델은 gameplay/decor 가 맡는다 (state.island.built).
//  - 다리: 강물(WATER, 바다 아님) 정확히 2칸 줄 + 양 끝이 같은 높이의 걸을 수 있는 땅. 동서(axis 'x') 또는 남북('z').
//  - 경사로: 남쪽을 보는 절벽(CLIFF, 높이 1) 바로 남쪽 아래칸 둘(높이 0 풀·모래·흙길)에 — 생성기 경사로와 같은 모양 (위칸 part 0 · 아래칸 part 1).
import { KIND, FLAG } from './island.js';

const { SEA, SAND, GRASS, PATH, WATER, CLIFF, RAMP } = KIND;
const LAND = new Set([GRASS, SAND, PATH]);

export const BUILD_WHY = {
  outside: '섬 밖이에요', water: '강물 칸을 바라보고 놓아요', span: '강폭이 2칸인 곳에만 놓을 수 있어요', bank: '양쪽 둑이 걸을 수 있는 땅이어야 해요',
  bridge: '이미 다리가 있어요', cliff: '남쪽을 보는 절벽 바로 앞(아래 칸)에 놓아요', ground: '경사로 자리(아래 두 칸)가 풀밭·모래·흙길이어야 해요',
  top: '절벽 위가 걸을 수 있는 땅이어야 해요', near: '다른 경사로와 너무 가까워요', taken: '자리에 무언가 있어요', limit: '더 놓을 수 없어요',
};

export function createBuilt(gen) {
  const { w, h } = gen;
  const K = gen.kind, Lv = gen.level, F = gen.flags;
  const idx = (tx, tz) => tz * w + tx;
  const inside = (tx, tz) => tx >= 0 && tz >= 0 && tx < w && tz < h;
  const at = (tx, tz) => (inside(tx, tz) ? K[idx(tx, tz)] : SEA);
  const lv = (tx, tz) => (inside(tx, tz) ? Lv[idx(tx, tz)] : 0);
  const walkLand = (tx, tz) => inside(tx, tz) && (LAND.has(at(tx, tz)) || at(tx, tz) === CLIFF || (F[idx(tx, tz)] & FLAG.BRIDGE) !== 0) && at(tx, tz) !== RAMP;
  const toWorld = (tx, tz) => ({ x: tx + 0.5 - w / 2, z: tz + 0.5 - h / 2 });
  const records = [];   // 놓은 것 { type, tx, tz, axis?, undo }

  /**
   * 다리 자리: 바라보는 강물 칸 (tx, tz), 방향 dir [dx, dz] (바라보는 쪽 — 그 축을 먼저 본다)
   * → { ok, why, axis, cells: [{tx,tz}×2], x, z, y, rot }
   */
  function bridgeSpot(tx, tz, dir = [0, -1], { blocked = () => false } = {}) {
    if (!inside(tx, tz)) return { ok: false, why: 'outside' };
    if (at(tx, tz) !== WATER) return { ok: false, why: 'water' };
    const axes = Math.abs(dir[0]) > Math.abs(dir[1]) ? ['x', 'z'] : ['z', 'x'];
    let why = 'span';
    for (const axis of axes) {
      const [ax, az] = axis === 'x' ? [1, 0] : [0, 1];
      // 이 칸이 2칸 물줄의 앞 또는 뒤
      for (const back of [0, 1]) {
        const a = { tx: tx - ax * back, tz: tz - az * back }, b = { tx: a.tx + ax, tz: a.tz + az };
        if (at(a.tx, a.tz) !== WATER || at(b.tx, b.tz) !== WATER || lv(a.tx, a.tz) !== lv(b.tx, b.tz)) continue;
        const e0 = { tx: a.tx - ax, tz: a.tz - az }, e1 = { tx: b.tx + ax, tz: b.tz + az };
        if (at(e0.tx, e0.tz) === WATER || at(e1.tx, e1.tz) === WATER) { why = 'span'; continue; }
        if (!walkLand(e0.tx, e0.tz) || !walkLand(e1.tx, e1.tz) || lv(e0.tx, e0.tz) !== lv(a.tx, a.tz) || lv(e1.tx, e1.tz) !== lv(a.tx, a.tz)) { why = 'bank'; continue; }
        if ((F[idx(a.tx, a.tz)] | F[idx(b.tx, b.tz)]) & (FLAG.BRIDGE | FLAG.DOCK)) { why = 'bridge'; continue; }
        if (blocked(e0.tx, e0.tz) || blocked(e1.tx, e1.tz)) { why = 'taken'; continue; }
        const c0 = toWorld(a.tx, a.tz), c1 = toWorld(b.tx, b.tz);
        return { ok: true, why: null, axis, cells: [a, b], ends: [e0, e1], x: (c0.x + c1.x) / 2, z: (c0.z + c1.z) / 2, y: lv(a.tx, a.tz), rot: axis === 'x' ? 0 : Math.PI / 2 };
      }
    }
    return { ok: false, why };
  }

  /**
   * 경사로 자리: 위칸 (tx, tz) = 절벽 바로 남쪽 칸. (tx, tz-1) 이 높이 1 절벽, (tx, tz)·(tx, tz+1) 이 높이 0 땅, (tx, tz-2) 가 높이 1 걸을 수 있는 땅.
   * → { ok, why, cells: [위, 아래], x, z (두 칸 가운데), y: 0 }
   */
  function rampSpot(tx, tz, { blocked = () => false } = {}) {
    if (!inside(tx, tz) || !inside(tx, tz + 1) || !inside(tx, tz - 2)) return { ok: false, why: 'outside' };
    if (at(tx, tz - 1) !== CLIFF || lv(tx, tz - 1) !== 1) return { ok: false, why: 'cliff' };
    for (const z of [tz, tz + 1]) if (!LAND.has(at(tx, z)) || lv(tx, z) !== 0 || F[idx(tx, z)]) return { ok: false, why: 'ground' };
    if (!(LAND.has(at(tx, tz - 2)) || at(tx, tz - 2) === CLIFF) || lv(tx, tz - 2) !== 1) return { ok: false, why: 'top' };
    for (const r of gen.ramps) if (!r.off && Math.abs(r.tx - tx) < 2 && Math.abs(r.tzTop - tz) < 4) return { ok: false, why: 'near' };
    if (blocked(tx, tz) || blocked(tx, tz + 1)) return { ok: false, why: 'taken' };
    const c = toWorld(tx, tz);
    return { ok: true, why: null, cells: [{ tx, tz }, { tx, tz: tz + 1 }], x: c.x, z: c.z + 0.5, y: 0 };
  }

  /** 다리 놓기 (bridgeSpot 결과) → 기록 | null */
  function addBridge(spot) {
    if (!spot?.ok) return null;
    const [a, b] = spot.cells;
    const before = [F[idx(a.tx, a.tz)], F[idx(b.tx, b.tz)]];
    F[idx(a.tx, a.tz)] |= FLAG.BRIDGE; F[idx(b.tx, b.tz)] |= FLAG.BRIDGE;
    const deck = { x: spot.x, z: spot.z, rot: spot.axis === 'x' ? 0 : 1, y: spot.y, built: true };
    gen.bridges.push(deck);
    const rec = { type: 'bridge', tx: a.tx, tz: a.tz, axis: spot.axis, deck,
      undo() { F[idx(a.tx, a.tz)] = before[0]; F[idx(b.tx, b.tz)] = before[1]; const i = gen.bridges.indexOf(deck); if (i >= 0) gen.bridges.splice(i, 1); } };
    records.push(rec);
    return rec;
  }

  /** 경사로 놓기 (rampSpot 결과) → 기록 | null. 생성기 경사로와 같은 칸 표 (위칸 높이 1·아래칸 0, rampMap = 번호*2 + part) */
  function addRamp(spot) {
    if (!spot?.ok) return null;
    const [t, l] = spot.cells, it = idx(t.tx, t.tz), il = idx(l.tx, l.tz);
    const before = { K: [K[it], K[il]], L: [Lv[it], Lv[il]], R: [gen.rampMap[it], gen.rampMap[il]] };
    const ramp = { tx: t.tx, tzTop: t.tz, built: true };
    const r = gen.ramps.length;
    gen.ramps.push(ramp);
    K[it] = RAMP; K[il] = RAMP;
    Lv[it] = 1; Lv[il] = 0;
    gen.rampMap[it] = r * 2; gen.rampMap[il] = r * 2 + 1;
    const rec = { type: 'ramp', tx: t.tx, tz: t.tz, ramp,
      undo() {
        K[it] = before.K[0]; K[il] = before.K[1]; Lv[it] = before.L[0]; Lv[il] = before.L[1];
        gen.rampMap[it] = before.R[0]; gen.rampMap[il] = before.R[1];
        ramp.off = true;   // 번호가 밀리지 않게 자리는 남겨 둔다 (rampMap 이 번호를 가리킴)
      } };
    records.push(rec);
    return rec;
  }

  function remove(rec) {
    const i = records.indexOf(rec);
    if (i < 0) return false;
    rec.undo();
    records.splice(i, 1);
    return true;
  }

  /** 칸이 놓은 다리·경사로에 들어 있나 → 기록 | null (다리는 물 2칸 + 양 끝 둑 반 칸 — 고치기 대상 고르기) */
  function at2(tx, tz) {
    return records.find(r => {
      if (r.type === 'ramp') return r.tx === tx && (tz === r.tz || tz === r.tz + 1);
      const [ax, az] = r.axis === 'x' ? [1, 0] : [0, 1];
      for (let k = -1; k <= 2; k++) if (r.tx + ax * k === tx && r.tz + az * k === tz) return true;
      return false;
    }) ?? null;
  }

  return { bridgeSpot, rampSpot, addBridge, addRamp, remove, at: at2, list: () => [...records] };
}
