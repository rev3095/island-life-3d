// 가림 투명: 카메라와 플레이어(대화 중이면 그 상대도) 사이를 막는 키 큰 배경 물체(나무·건물)를 디더로 비치게 한다.
// 그리기는 kit.js 의 칸마다 aFade(0~1). 여기서는 매 프레임 광선(카메라 → 발·몸·머리)이 물체 모양에 닿는지 보고 aFade 를 부드럽게 올리고 내린다.
// 물체 모양은 판(템플릿) 꼭짓점으로 한 번 잰다: 나무류는 높이 띠마다 반지름(돌려도 같다), 건물은 돌린 상자.
// 곡면 월드: 화면에는 초점에서 떨어진 만큼(dz²·uCurve) 낮게 보이므로 모양도 그만큼 내려서 잰다.

// 가리는 물체 종류 → 모양. 키 작은 것(꽃·바위·덤불·울타리)과 밟고 서는 것(다리·선착장)은 빼고, 가는 가로등도 뺀다
const OCCLUDERS = {
  tree: 'bands', 'fruit-tree': 'bands', cedar: 'bands', palm: 'bands',
  'house-player': 'box', 'house-villager': 'box', shop: 'box', museum: 'box', signboard: 'box',
};
const BANDS = 8;               // 나무 모양 높이 띠 수
const BODY = [0.18, 0.55, 0.92];   // 캐릭터 몸에서 보는 점 (발·몸·머리, 키 ≈ 1)
const SPEED = 7;               // 비치는 빠르기 (1/초)
const AHEAD = 3.2, RADIUS = 4.6;   // 물체를 찾는 범위: 대상에서 카메라 쪽(남쪽)으로 AHEAD 떨어진 곳 둘레

export function createOcclusion(ctx, objects) {
  const shapes = new Map();    // 판 → 모양
  const fades = new Map();     // 물체 id → 지금 투명 정도
  const watchers = new Set();  // 더 보이게 할 점 (getPoint() → {x, y, z} | null)
  const hit = new Set();
  const C = { x: 0, y: 0, z: 0 };
  let enabled = true;

  /** 판 꼭짓점으로 모양 재기 (판마다 한 번) */
  function shapeOf(tpl, type) {
    let s = shapes.get(tpl);
    if (s) return s;
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const parts = tpl.parts.filter(p => p.type !== 'outline');
    for (const p of parts) {
      const a = p.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
    }
    s = { type, y0, y1, box: [x0, z0, x1, z1] };
    if (type === 'bands') {
      const r = new Float32Array(BANDS), h = (y1 - y0) / BANDS || 1;
      for (const p of parts) {
        const a = p.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          const b = Math.min(BANDS - 1, Math.floor((a.getY(i) - y0) / h));
          const d = Math.hypot(a.getX(i), a.getZ(i));
          if (d > r[b]) r[b] = d;
        }
      }
      s.r = r; s.h = h;
    }
    shapes.set(tpl, s);
    return s;
  }

  /** 광선 C → P (t 0~1) 가 물체 o 를 지나는가. 대상 바로 앞(t > 0.97)이나 뒤는 빼고 */
  function blocks(o, s, P, drop) {
    const dx = P.x - C.x, dy = P.y - C.y, dz = P.z - C.z;
    const sc = o.scale;
    if (s.type === 'bands') {
      const base = o.y - drop + s.y0 * sc, hh = s.h * sc;
      for (let b = 0; b < BANDS; b++) {
        const r = s.r[b] * sc;
        if (r <= 0) continue;
        // 광선이 이 띠 높이에 있는 구간 [ta, tb]
        const ya = base + b * hh, yb = ya + hh;
        let ta, tb;
        if (Math.abs(dy) < 1e-6) { if (C.y < ya || C.y > yb) continue; ta = 0; tb = 1; }
        else { ta = (ya - C.y) / dy; tb = (yb - C.y) / dy; if (ta > tb) [ta, tb] = [tb, ta]; }
        ta = Math.max(ta, 0); tb = Math.min(tb, 0.97);
        if (ta > tb) continue;
        // 그 구간에서 물체 축까지 가장 가까운 거리 (바닥 평면)
        const ax = o.x - C.x, az = o.z - C.z, dd = dx * dx + dz * dz;
        let t = dd > 1e-9 ? (ax * dx + az * dz) / dd : 0;
        t = Math.min(tb, Math.max(ta, t));
        if (Math.hypot(C.x + dx * t - o.x, C.z + dz * t - o.z) <= r) return true;
      }
      return false;
    }
    // 상자: 돌린 만큼 넓힌 축 정렬 상자로 (건물은 90° 단위라 딱 맞는다)
    const [bx0, bz0, bx1, bz1] = s.box;
    const cs = Math.abs(Math.cos(o.rot)), sn = Math.abs(Math.sin(o.rot));
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, ex = (bx1 - bx0) / 2, ez = (bz1 - bz0) / 2;
    const c = Math.cos(o.rot), si = Math.sin(o.rot);
    const wx = o.x + (cx * c + cz * si) * sc, wz = o.z + (-cx * si + cz * c) * sc;
    const hx = (ex * cs + ez * sn) * sc, hz = (ex * sn + ez * cs) * sc;
    const lo = [wx - hx, o.y - drop + s.y0 * sc, wz - hz], hi = [wx + hx, o.y - drop + s.y1 * sc, wz + hz];
    const org = [C.x, C.y, C.z], dir = [dx, dy, dz];
    let t0 = 0, t1 = 0.97;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(dir[k]) < 1e-9) { if (org[k] < lo[k] || org[k] > hi[k]) return false; continue; }
      let a = (lo[k] - org[k]) / dir[k], b = (hi[k] - org[k]) / dir[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  }

  // 대화 중인 상대는 town 이 대화 동안 watch 로 넣는다
  const targets = [];
  function update(dt) {
    hit.clear();
    const player = ctx.services.player;
    if (enabled && player) {
      targets.length = 0;
      targets.push(player.position);
      for (const fn of watchers) { const p = fn(); if (p) targets.push(p); }
      C.x = ctx.camera.position.x; C.y = ctx.camera.position.y; C.z = ctx.camera.position.z;
      const k = ctx.materials.curve.uCurve.value, fz = ctx.focus.z;
      for (const T of targets) {
        // 카메라는 남쪽 위에 있다 → 대상에서 카메라 쪽으로 조금 간 곳 둘레의 물체만 본다
        const qx = T.x + (C.x - T.x) * 0.1, qz = T.z + Math.sign(C.z - T.z || 1) * AHEAD;
        for (const q of objects.api.query(qx, qz, RADIUS)) {
          const type = OCCLUDERS[q.kind];
          if (!type || hit.has(q.id)) continue;     // 이미 다른 대상을 가린 물체는 또 볼 필요 없다
          const o = objects.raw(q.id);
          if (!o?.batch) continue;
          const s = shapeOf(o.batch.tpl, type);
          const drop = k * (o.z - fz) ** 2;
          for (const h of BODY) {
            if (blocks(o, s, { x: T.x, y: T.y + h, z: T.z }, drop)) { hit.add(q.id); break; }
          }
        }
      }
    }
    // 부드럽게: 가리는 것은 1 쪽으로, 아닌 것은 0 쪽으로 (0 이 되면 목록에서 뺀다)
    const a = 1 - Math.exp(-dt * SPEED);
    for (const id of hit) if (!fades.has(id)) fades.set(id, 0);
    for (const [id, f] of fades) {
      const o = objects.raw(id);
      if (!o?.batch) { fades.delete(id); continue; }
      const goal = hit.has(id) ? 1 : 0;
      let v = f + (goal - f) * a;
      if (Math.abs(goal - v) < 0.01) v = goal;
      o.batch.setFade(o.slot, v);
      if (v === 0) fades.delete(id); else fades.set(id, v);
    }
  }

  return {
    update,
    /** 더 보이게 할 점: getPoint() → {x, y(발 높이), z} | null. 돌려받은 함수로 해제 */
    watch(getPoint) { watchers.add(getPoint); return () => watchers.delete(getPoint); },
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; },
    /** 지금 비치는 물체 { id: 정도 } (확인용) */
    list() { return Object.fromEntries(fades); },
  };
}
