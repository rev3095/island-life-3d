// 가림 투명: 카메라와 플레이어(대화 중이면 그 상대도) 사이를 막는 키 큰 배경 물체(나무·건물)를 디더로 비치게 한다.
// 그리기는 kit.js 의 칸마다 aFade(0~1). 여기서는 매 프레임 광선(카메라 → 발·몸·머리)이 물체 모양에 닿는지 보고 aFade 를 부드럽게 올리고 내린다.
// 물체 모양은 판(템플릿) 꼭짓점으로 한 번 잰다: 나무류는 높이 띠마다 반지름(돌려도 같다), 건물은 돌린 상자.
// 곡면 월드: 화면에는 초점에서 떨어진 만큼(dz²·uCurve) 낮게 보이므로 모양도 그만큼 내려서 잰다.
// 묶음 밖 모델(주민·가게 주인·가구·배경 단독 물체 등 applyToonStyle 로 칠한 것)은 root.userData.toonFade(재질 uniform)를 단다 →
// 1초마다 장면에서 찾아 감싸는 상자로 같은 광선 시험을 하고, 모델 통째로 디더한다 (materials 공용 디더).
// 바깥 모듈이 직접 넣을 수도 있다: add({ box(out: Box3) → Box3|null, setFade(v) }) — 공유 재질 인스턴스(채집 물체) 같은 것.
// 7차 D49-A (QA-03): 화면 아래 끝 가운데가 닿는 땅 점도 대상으로 본다 — 카메라 바로 밑 키 큰 것(무대 지붕·부스·집·나무)이 화면 아래를 덮지 않게.
import { Box3, Matrix4, Vector3 } from 'three';

// 가리는 물체 종류 → 모양. 키 작은 것(꽃·바위·덤불·울타리)과 밟고 서는 것(다리·선착장)은 빼고, 가는 가로등도 뺀다
const OCCLUDERS = {
  tree: 'bands', 'fruit-tree': 'bands', cedar: 'bands', palm: 'bands',
  'house-player': 'box', 'house-villager': 'box', shop: 'box', museum: 'box', signboard: 'box',
  // 5차 Z5 축제 광장의 키 큰 것 (무대 3.7 · 아치 3.0 · 부스·덮개 2.6칸). 빠져 있어서 그 뒤(북쪽)에 서면 플레이어가 안 보였다 (QA-07)
  'festival-stage': 'box', 'festival-arch': 'box', 'festival-cover': 'box',
  'festival-booth-lantern': 'box', 'festival-booth-music': 'box', 'festival-booth-flower': 'box', 'festival-booth-food': 'box', 'festival-booth-fish': 'box',
};
const BANDS = 8;               // 나무 모양 높이 띠 수
const BODY = [0.18, 0.55, 0.92];   // 캐릭터 몸에서 보는 점 (발·몸·머리, 키 ≈ 1)
const SPEED = 7;               // 비치는 빠르기 (1/초)
const AHEAD = 3.2, RADIUS = 4.6;   // 물체를 찾는 범위: 대상에서 카메라 쪽(남쪽)으로 AHEAD 떨어진 곳 둘레
const MODEL_NEAR = 14;         // 묶음 밖 모델: 대상에서 이 거리 안만 본다
const MODEL_MIN_H = 0.45;      // 이보다 낮은 모델(러그·작은 물건)은 가리지 않는 것으로 친다
const SELF_PAD = 0.15;         // 대상 발밑이 상자 안(+여유)이면 그 대상 자신(대화 상대)이나 대상이 들어가 선 것 → 뺀다
const BOTTOM_NDC = -0.9;       // 화면 아래 끝 땅 점: 화면 높이 아래쪽 5% 자리 (NDC y)
const BOTTOM_FAR = 14;         // 그 점이 카메라에서 이보다 멀면(거의 수평으로 볼 때) 보지 않는다

export function createOcclusion(ctx, objects) {
  const shapes = new Map();    // 판 → 모양
  const fades = new Map();     // 물체 id → 지금 투명 정도
  const watchers = new Set();  // 더 보이게 할 점 (getPoint() → {x, y, z} | null)
  const hit = new Set();
  const C = { x: 0, y: 0, z: 0 };
  let enabled = true;
  // 묶음 밖 모델: root(또는 add 로 넣은 것) → { local: 모델 좌표 상자 | null, box(out), setFade(v), v: 지금 값, hit }
  const models = new Map();
  let scanIn = 0;
  const wb = new Box3(), inv = new Matrix4(), mm = new Matrix4(), bb = new Box3();
  const ndc = new Vector3(), bottom = { x: 0, y: 0, z: 0 };
  let watchBottom = true;
  /** 화면 아래 끝 가운데 광선이 발 높이(y)의 땅에 닿는 점 → bottom | null */
  function bottomPoint(y) {
    ndc.set(0, BOTTOM_NDC, 0.5).unproject(ctx.camera);
    const dx = ndc.x - C.x, dy = ndc.y - C.y, dz = ndc.z - C.z;
    if (dy > -1e-4) return null;
    const t = (y - C.y) / dy;
    if (!(t > 0) || Math.hypot(dx * t, dz * t) > BOTTOM_FAR) return null;
    bottom.x = C.x + dx * t; bottom.y = y; bottom.z = C.z + dz * t;
    return bottom;
  }

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
    return rayBox(wx - hx, o.y - drop + s.y0 * sc, wz - hz, wx + hx, o.y - drop + s.y1 * sc, wz + hz, P);
  }

  /** 광선 C → P (t 0 ~ 0.97) 가 축 정렬 상자를 지나는가 */
  function rayBox(x0, y0, z0, x1, y1, z1, P) {
    const lo = [x0, y0, z0], hi = [x1, y1, z1];
    const org = [C.x, C.y, C.z], dir = [P.x - C.x, P.y - C.y, P.z - C.z];
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

  // ── 묶음 밖 모델 ──
  /** 장면에서 toonFade 를 단 모델 찾기 (1초마다). 장면에서 빠진 것은 원래대로 돌리고 목록에서 뺀다 */
  function scan() {
    const seen = new Set();
    ctx.scene.traverse(o => {
      const f = o.userData.toonFade;
      if (!f || o.userData.occluder === false) return;
      seen.add(o);
      if (models.has(o)) return;
      models.set(o, { root: o, local: localBox(o), v: 0, hit: false, setFade: v => { f.value = v; }, box: out => worldBox(o, models.get(o).local, out) });
    });
    for (const [k, m] of models) {
      if (!m.root || seen.has(k)) continue;
      m.setFade(0);
      models.delete(k);
    }
  }
  /** 모델 좌표 상자 (외곽선 껍데기 빼고, 뼈대 메시는 쉰 자세). 너무 낮으면 null */
  function localBox(root) {
    root.updateMatrixWorld(true);
    inv.copy(root.matrixWorld).invert();
    const out = new Box3();
    root.traverse(o => {
      if (!o.isMesh || o.userData.outline || !o.geometry?.attributes.position) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      out.union(bb.copy(o.geometry.boundingBox).applyMatrix4(mm.multiplyMatrices(inv, o.matrixWorld)));
    });
    return out.isEmpty() || out.max.y - out.min.y < MODEL_MIN_H ? null : out;
  }
  /** 월드 상자 (숨겨진 모델은 null) */
  function worldBox(root, local, out) {
    if (!local) return null;
    for (let p = root; p; p = p.parent) if (!p.visible) return null;
    return out.copy(local).applyMatrix4(root.matrixWorld);
  }
  /** 이번 프레임 모델들이 대상들을 가리는지 */
  function testModels(k, fz) {
    for (const m of models.values()) {
      m.hit = false;
      if (!m.box(wb)) continue;
      const cz = (wb.min.z + wb.max.z) / 2, drop = k * (cz - fz) ** 2;
      for (const T of targets) {
        if (Math.hypot((wb.min.x + wb.max.x) / 2 - T.x, cz - T.z) > MODEL_NEAR) continue;
        // 대상 자신(대화 상대)·대상이 들어가 선 것은 빼고
        if (T.x > wb.min.x - SELF_PAD && T.x < wb.max.x + SELF_PAD && T.z > wb.min.z - SELF_PAD && T.z < wb.max.z + SELF_PAD) continue;
        if (BODY.some(h => rayBox(wb.min.x, wb.min.y - drop, wb.min.z, wb.max.x, wb.max.y - drop, wb.max.z, { x: T.x, y: T.y + h, z: T.z }))) { m.hit = true; break; }
      }
    }
  }

  // 대화 중인 상대는 town 이 대화 동안 watch 로 넣는다
  const targets = [];
  function update(dt) {
    hit.clear();
    const player = ctx.services.player;
    if ((scanIn -= dt) <= 0) { scanIn = 1; scan(); }
    for (const m of models.values()) m.hit = false;
    if (enabled && player) {
      targets.length = 0;
      targets.push(player.position);
      for (const fn of watchers) { const p = fn(); if (p) targets.push(p); }
      C.x = ctx.camera.position.x; C.y = ctx.camera.position.y; C.z = ctx.camera.position.z;
      if (watchBottom && !ctx.services.house?.inside) { const b = bottomPoint(player.position.y); if (b) targets.push(b); }
      const k = ctx.materials.curve.uCurve.value, fz = ctx.focus.z;
      for (const T of targets) {
        // 대상에서 카메라 쪽으로 조금 간 곳 둘레의 물체만 본다 (보통 카메라는 남쪽 위. 시점 조작으로 둘레를 돌면 그쪽으로).
        // 카메라가 낮으면(올려다보기 — 높이각 17° 아래) 광선이 키 큰 물체를 카메라 가까이서도 지나므로 카메라까지 덮는다
        const ex = C.x - T.x, ez = C.z - T.z, L = Math.hypot(ex, ez);
        const ux = L > 1e-3 ? ex / L : 0, uz = L > 1e-3 ? ez / L : 1;
        const low = C.y - T.y < L * 0.3;
        const reach = low ? Math.max(AHEAD, L / 2) : AHEAD, rad = low ? Math.max(RADIUS, L / 2 + 1.2) : RADIUS;
        for (const q of objects.api.query(T.x + ux * reach, T.z + uz * reach, rad)) {
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
      testModels(k, fz);
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
    for (const m of models.values()) {
      const goal = m.hit ? 1 : 0;
      if (m.v === goal) continue;
      let v = m.v + (goal - m.v) * a;
      if (Math.abs(goal - v) < 0.01) v = goal;
      m.v = v;
      m.setFade(v);
    }
  }

  return {
    update,
    /** 더 보이게 할 점: getPoint() → {x, y(발 높이), z} | null. 돌려받은 함수로 해제 */
    watch(getPoint) { watchers.add(getPoint); return () => watchers.delete(getPoint); },
    /**
     * 비치게 할 것 직접 넣기 (toonFade 를 단 모델은 저절로 들어간다): { box(out: Box3) → 월드 상자 | null, setFade(v 0~1) } → 해제 함수.
     * 공유 재질 인스턴스(채집 물체)는 aFade 인스턴스 속성을 두고 setFade 에서 그 칸 값을 바꾸면 된다
     */
    add(item) {
      const m = { root: null, v: 0, hit: false, box: out => item.box(out), setFade: v => item.setFade(v) };
      models.set(item, m);
      return () => { if (models.get(item) === m) { m.setFade(0); models.delete(item); } };
    },
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; },
    /** 화면 아래 끝 땅 점도 볼지 (7차 D49-A, 기본 켬) · 지금 그 점 (확인용) */
    get bottom() { return watchBottom; },
    set bottom(v) { watchBottom = !!v; },
    bottomPoint: () => { C.x = ctx.camera.position.x; C.y = ctx.camera.position.y; C.z = ctx.camera.position.z; const p = ctx.services.player?.position; return p ? { ...(bottomPoint(p.y) ?? {}) } : null; },
    /** 지금 비치는 물체 { id 또는 모델 이름: 정도 } (확인용) */
    list() {
      const out = Object.fromEntries(fades);
      for (const m of models.values()) if (m.v > 0) out[m.root?.parent?.name || m.root?.name || 'model'] = +m.v.toFixed(2);
      return out;
    },
  };
}
