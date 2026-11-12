// M16 잠수 (D160–D164): 스쿠버 키트(tool.scuba-kit, 도토리상점에서 늘 팖)를 가방에 넣고 해변 물가에서 행동 키 → 바다로 들어가 헤엄(AN-15).
// 헤엄치는 동안 행동 키 = 잠수(AN-16 잠기기) → 물속에서 바다 생물 그림자(물방울 FX-03 이 오름)를 따라가 닿으면 잡는다. 물가를 보고 행동 키 = 나오기.
// - 바다는 world.addZone 구역으로 붙인다: 헤엄치는 동안만 섬 둘레 바다(해안 물가 선 + DEEP 바깥, 섬 칸 밖 MARGIN 칸까지)를 걸을 수 있는 곳으로 바꾸고
//   움직임을 느리게(SWIM_K · 잠기면 UNDER_K). 높이는 섬 그대로(바다 물낯), 몸은 swim.js 가 물에 잠기게 내린다.
// - 잠수복 CL-13 은 옷 칸과 따로 — 바다에 있는 동안만 (swim.js). 들고 있던 도구는 넣어 뒀다가 나오면 다시 든다.
// - 바다 생물은 헤엄칠 때만 둘레에 나온다 (data.spawns.sea: 시각·달). 빠르기 0–3 (items.json sea.speed): 잠긴 주인공이 가까이 오면 달아난다.
// - 섬 일지 「바다 생물 잡기」 = 이벤트 dive:catch. 그 밖 이벤트 dive:enter · dive:leave · dive:dive.
// 행동 키 순위: 물에 있는 동안 150 (다른 처리기가 물속에서 안 돌게 — 낚시·말 걸기 등) · 물가에서 들어가기 48 (줍기 50 다음, 도구를 들지 않았을 때만).
import { rand } from './util.js';
import { createDiveFx } from './dive-fx.js';
import { createSwim } from '../../player/swim.js';

export const KIT = 'tool.scuba-kit';
export const MARGIN = 7;           // 섬 칸 밖으로 헤엄칠 수 있는 칸 (섬 밖 바다 경계)
export const DEEP = 0.6;           // 해안 물가 선에서 이만큼 더 바다 쪽이어야 헤엄 (그 안쪽은 모래 비탈 — 걷는다)
const SPAWN_DEEP = 1.6;            // 바다 생물은 이보다 깊은 곳에
export const SWIM_K = 0.62, UNDER_K = 0.55;   // 걷기 대비 빠르기
const DOWN = 0.45, UP = 0.45;      // 잠기기 · 떠오르기 (초)
export const UNDER_MAX = 3.6;      // 한 번 잠겨 있을 수 있는 시간 (초)
export const CATCH_R = 0.7;        // 이만큼 닿으면 잡음 (+ 그림자 크기 × 0.04) — 주인공 몸 반지름 0.26 + 그림자 반지름 둘레
const MAX_SEA = { high: 6, mid: 6, low: 4, min: 3 };
const NEAR = 11, FAR = 16;
// 빠르기 0 가만히 · 1 느림 · 2 보통 · 3 빠름
export const WANDER_V = [0, 0.12, 0.28, 0.42];
export const FLEE_R = [0, 1.1, 1.7, 2.3];
export const FLEE_V = [0, 0.35, 0.8, 1.15];
const STARTLE = 1.6;               // 물 위에서 이보다 빨리 헤엄쳐 오면 빠른 것(3)은 미리 달아난다

/** 섬 칸 + MARGIN 안인가 (순수) */
export const inSea = (x, z, w, h, margin = MARGIN) => Math.abs(x) <= w / 2 + margin && Math.abs(z) <= h / 2 + margin;

/** 달아나기 (순수): 생물 (cx,cz) 이 주인공 (px,pz) 에게서 speed 만큼 벗어나는 다음 자리 */
export function fleeStep(cx, cz, px, pz, speed, dt) {
  const dx = cx - px, dz = cz - pz, d = Math.hypot(dx, dz) || 1;
  return { x: cx + (dx / d) * speed * dt, z: cz + (dz / d) * speed * dt };
}

/** 잡히나 (순수): 잠긴 동안 거리 ≤ CATCH_R + 크기 × 0.04 */
export const canCatch = (dist, size, under) => !!under && dist <= CATCH_R + (size ?? 2) * 0.04;

export function createDive(ctx, kit, { results }) {
  const { THREE: T, scene, events, materials } = ctx;
  const fx = createDiveFx(ctx);
  let swim = null;                       // swim.js (주인공 모델이 생긴 뒤 처음 쓸 때 만든다)
  const getSwim = () => (swim ??= createSwim(ctx));
  const S = { mode: 'land', phase: null, t: 0, under: 0, prevTool: null, zoneOff: null, caught: null, strokeT: 0, warnT: 0, gen: 0 };

  const world = () => kit.world;
  const home = () => world()?.home?.island ?? world()?.island;
  const hasKit = () => (kit.data?.inventory?.count?.(KIT) ?? 0) > 0;

  // ---------- 바다 자리 ----------
  function deepness(x, z) {
    const w = world();
    const cd = w?.coastDistance?.(x, z);
    return Number.isFinite(cd) ? cd - w.coastWaterline : 99;
  }
  /** 헤엄칠 수 있는 바다인가 (본섬 둘레만 — 투어 섬·실내는 안 됨) */
  function swimmable(x, z, deep = DEEP) {
    const w = world(), isl = home();
    if (!w || !isl || w.islet?.active) return false;
    if (!inSea(x, z, isl.w, isl.h)) return false;
    const { tx, tz } = isl.toTile(x, z);
    if (tx >= 0 && tz >= 0 && tx < isl.w && tz < isl.h && (isl.tileAt(tx, tz) !== 'sea' || isl.flagsAt?.(tx, tz))) return false;
    const d = w.home?.places?.dock ?? w.places?.dock;
    if (d && Math.abs(x - d.x) < 2.4 && z > d.z - 1.6 && z < d.z + 4.8) return false;   // 선착장 다리 둘레는 비운다
    return deepness(x, z) >= deep;
  }
  const landAt = (x, z) => {
    const isl = home();
    if (!isl || swimmable(x, z, 0)) return false;
    return !!world()?.island?.isWalkable?.(x, z) && isl.heightAt(x, z) < 0.6 && !isl.isWater?.(x, z);
  };

  // ---------- 바다 구역 (헤엄치는 동안만) ----------
  const zone = {
    // 뭍 칸(다리·선착장 포함)은 섬 그대로. landAt 을 부르면 isWalkable → 구역 → contains 로 되돌아오므로 칸만 본다
    contains: (x, z) => {
      if (S.mode === 'land' || S.mode === 'entering') return false;
      const isl = home();
      if (!isl || !inSea(x, z, isl.w, isl.h, MARGIN + 0.5)) return false;
      const { tx, tz } = isl.toTile(x, z);
      return !isl.isWalkableTile(tx, tz);
    },
    collide(fx0, fz0, nx, nz) {
      const k = S.mode === 'diving' ? UNDER_K : SWIM_K;
      const x = fx0 + (nx - fx0) * k, z = fz0 + (nz - fz0) * k;
      if (swimmable(x, z)) return { x, z };
      if (swimmable(x, fz0)) return { x, z: fz0 };
      if (swimmable(fx0, z)) return { x: fx0, z };
      const isl = home();
      if (isl && !inSea(x, z, isl.w, isl.h) && S.warnT <= 0) { S.warnT = 8; kit.toast('더 먼 바다는 물살이 세서 못 가요', '🌊'); }
      return { x: fx0, z: fz0 };
    },
    isWalkable: () => false,   // 주민 길찾기(town/path.js)가 바다로 길을 내지 않게 — 헤엄은 collide 로만
    groundAt: () => 'sea',
  };

  // ---------- 바다 생물 ----------
  const group = new T.Group();
  group.name = 'gather-sea';
  scene.add(group);
  const shadowMat = Object.assign(materials.toonMaterial('#163246', { flat: true, name: 'seaShadow' }), { transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const disc = new T.CircleGeometry(1, 18).rotateX(-Math.PI / 2);
  const shadowR = size => 0.12 + size * 0.075;
  const sea = [];
  let spawnT = 0;
  const waterY = (x, z) => (home()?.heightAt(x, z) ?? -0.15) + 0.012;
  // 잠긴 주인공 그림자 (물속 모습 대신 — 바다 판은 불투명이라 몸이 안 보인다)
  const me = new T.Mesh(disc, Object.assign(materials.toonMaterial('#163246', { flat: true, name: 'seaShadow' }), { transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  me.scale.set(0.42, 1, 0.62);
  me.frustumCulled = false;
  me.visible = false;
  group.add(me);

  function addSea(x, z) {
    const { hour, month } = kit.now();
    const id = kit.data?.spawns?.sea?.({ hour: Math.floor(hour), month, rng: Math.random });
    const it = id && kit.item(id);
    if (!it) return null;
    const mesh = new T.Mesh(disc, shadowMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.scale.setScalar(0.001);
    group.add(mesh);
    const c = { id, size: it.shadow ?? 2, speed: it.speed ?? 1, x, z, heading: rand(0, Math.PI * 2), target: null, wait: rand(0.4, 2), mesh, life: 0, bubbleT: rand(0.2, 1), fleeing: 0 };
    sea.push(c);
    return c;
  }
  function removeSea(c) {
    group.remove(c.mesh);
    const i = sea.indexOf(c);
    if (i >= 0) sea.splice(i, 1);
  }
  function clearSea() { for (const c of [...sea]) removeSea(c); }
  function spawnTick(dt) {
    spawnT -= dt;
    if (spawnT > 0) return;
    spawnT = 0.8;
    const p = kit.player.position;
    for (const c of [...sea]) if (Math.hypot(c.x - p.x, c.z - p.z) > FAR) removeSea(c);
    if (sea.length >= (MAX_SEA[ctx.quality] ?? 6)) return;
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2), r = rand(3, NEAR);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (!swimmable(x, z, SPAWN_DEEP) || sea.some(c => Math.hypot(c.x - x, c.z - z) < 1.8)) continue;
      addSea(x, z);
      return;
    }
  }
  function moveSea(c, dt) {
    const p = kit.player.position;
    const dist = Math.hypot(c.x - p.x, c.z - p.z);
    const under = S.mode === 'diving' && S.under > 0.5;
    const startled = c.speed >= 3 && kit.player.speed > STARTLE && dist < FLEE_R[3] * 0.8;
    if (c.speed > 0 && ((under && dist < FLEE_R[c.speed]) || startled)) c.fleeing = 0.6;
    if (c.fleeing > 0) {
      c.fleeing -= dt;
      const n = fleeStep(c.x, c.z, p.x, p.z, FLEE_V[c.speed], dt);
      if (swimmable(n.x, n.z, SPAWN_DEEP * 0.6)) { c.heading = Math.atan2(n.x - c.x, n.z - c.z); c.x = n.x; c.z = n.z; }
      c.target = null;
      return;
    }
    if (!c.speed) return;
    c.wait -= dt;
    if (!c.target && c.wait <= 0) {
      const a = c.heading + rand(-1.8, 1.8), r = rand(0.6, 2);
      const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
      if (swimmable(x, z, SPAWN_DEEP * 0.8)) c.target = { x, z }; else c.wait = 0.5;
    }
    if (c.target) {
      const dx = c.target.x - c.x, dz = c.target.z - c.z, d = Math.hypot(dx, dz), step = WANDER_V[c.speed] * dt;
      if (d <= step) { c.target = null; c.wait = rand(0.8, 2.6); }
      else { c.x += (dx / d) * step; c.z += (dz / d) * step; c.heading = Math.atan2(dx, dz); }
    }
  }
  function drawSea(c, dt) {
    c.life += dt;
    const grow = Math.min(1, c.life / 0.8), r = shadowR(c.size);
    c.mesh.position.set(c.x, waterY(c.x, c.z), c.z);
    c.mesh.scale.set(r * grow, 1, r * grow * (c.speed ? 1.25 : 1));
    c.mesh.rotation.y = c.heading;
    c.bubbleT -= dt;
    if (c.bubbleT <= 0) {   // FX-03: 그림자 위로 뽀글뽀글 (큰 것은 많이)
      c.bubbleT = rand(0.5, 1.3);
      fx.bubble(c.x, waterY(c.x, c.z), c.z, { n: 1 + Math.round(c.size / 2), spread: r * 0.7 });
    }
  }

  // ---------- 들어가기 · 나오기 · 잠수 ----------
  const splash = (x, z, n = 6) => { fx.bubble(x, waterY(x, z), z, { n, spread: 0.45, size: 1.4 }); kit.sfx('splash'); };

  /** 물가에서 앞쪽 바다 자리 (들어갈 곳) | null */
  function entryPoint() {
    const p = kit.player;
    if (!p || S.mode !== 'land' || p.tool || p.frozen || p.seated || p.walking || ctx.services.tour?.active) return null;
    if (!world() || world().islet?.active || !hasKit()) return null;
    const { x, z } = p.position;
    if (!home() || !inSea(x, z, home().w, home().h, 0) || swimmable(x, z, 0)) return null;
    for (let d = 0.8; d <= 2.6; d += 0.3) {
      const q = p.pointInFront(d);
      if (swimmable(q.x, q.z)) return { x: q.x, z: q.z };
      if (!landAt(q.x, q.z) && !home().isWater?.(q.x, q.z)) return null;   // 앞이 바위·나무·절벽 같은 곳 (물가 모래 비탈은 지나감)
    }
    return null;
  }
  /** 물에서 앞쪽 뭍 자리 (나올 곳) | null */
  function exitPoint() {
    const p = kit.player;
    for (let d = 0.8; d <= 2.6; d += 0.3) {
      const q = p.pointInFront(d);
      if (landAt(q.x, q.z)) { const r = p.pointInFront(d + 0.45); return landAt(r.x, r.z) ? r : q; }
    }
    return null;
  }

  async function enter(at) {
    const p = kit.player, my = ++S.gen;
    S.mode = 'entering';
    S.prevTool = p.tool;
    p.setTool(null);
    p.toolKeys = false;
    getSwim()?.loadSuit();
    const ok = await p.walkTo(at.x, at.z, { speed: 2.1 });
    if (my !== S.gen) return;
    if (!ok) { restore(); return; }
    S.zoneOff = world().addZone(zone);
    S.mode = 'swim';
    const sw = getSwim();
    if (sw) { sw.active = true; sw.depth = 0; sw.wear(true); }
    p.setGait('idle'); p.setStance('idle');
    splash(at.x, at.z, 8);
    events.emit('dive:enter', { x: at.x, z: at.z });
    if (!ctx.state.flags?.diveHint) {
      (ctx.state.flags ||= {}).diveHint = true;
      kit.toast('헤엄치는 중 — 행동 키로 잠수, 물가를 보고 행동 키로 나와요', '🤿');
    }
  }
  async function leave(at) {
    const p = kit.player, my = ++S.gen;
    S.mode = 'leaving';
    const sw = getSwim();
    if (sw) { sw.depth = 0; sw.active = false; }
    p.setGait(null); p.setStance(null);
    splash(p.position.x, p.position.z, 5);
    await p.walkTo(at.x, at.z, { speed: 2.1 });
    if (my !== S.gen) return;
    restore();
  }
  /** 뭍 사람으로 되돌리기 (구역·옷·도구·생물) */
  function restore({ instant = false } = {}) {
    const p = kit.player;
    S.zoneOff?.(); S.zoneOff = null;
    const sw = getSwim();
    if (sw) { sw.wear(false); if (instant) sw.reset(); else sw.active = false; }
    p?.setGait(null); p?.setStance(null);
    if (p) p.toolKeys = true;
    const tool = S.prevTool;
    S.prevTool = null;
    if (tool && kit.data?.inventory?.slots?.some(s => s && kit.item(s.id)?.tool === tool)) p?.setTool(tool);
    const was = S.mode !== 'land';
    S.mode = 'land'; S.phase = null; S.under = 0; S.caught = null;
    clearSea();
    fx.clear();
    me.visible = false;
    if (was) events.emit('dive:leave', {});
  }
  function dive() {
    S.mode = 'diving'; S.phase = 'down'; S.t = 0; S.caught = null;
    const sw = getSwim();
    if (sw) sw.depth = 1;
    const { x, z } = kit.player.position;
    splash(x, z, 7);
    events.emit('dive:dive', { x, z });
  }
  function surface() {
    if (S.mode !== 'diving' || S.phase === 'up') return;
    S.phase = 'up'; S.t = 0;
    const sw = getSwim();
    if (sw) sw.depth = 0;
  }
  function landed() {
    S.mode = 'swim'; S.phase = null;
    const { x, z } = kit.player.position;
    splash(x, z, 6);
    const id = S.caught;
    S.caught = null;
    if (!id) return;
    kit.sfx('pickup', { kind: 'sea' });
    results.gain(id, 1, { verb: '잡았다', show: true });
    events.emit('dive:catch', { id });
  }

  // 장면·순간이동·투어로 끊기면 곧장 뭍으로 (가까운 물가 대신 들어온 자리 둘레 — 플레이어 teleport 는 부르는 쪽 몫)
  const cut = () => { if (S.mode !== 'land') { S.gen++; restore({ instant: true }); } };
  events.on('story:start', cut);
  events.on('world:islet', cut);
  events.on('time:shift', () => { if (S.mode !== 'land') clearSea(); });

  const api = {
    /** 행동 키 처리기 (gather/index.js 가 단다) */
    handlers: [
      {
        name: 'dive-water', priority: 150,
        test: () => {
          if (S.mode === 'land') return null;
          if (S.mode === 'swim') return exitPoint() ? { kind: 'exit' } : { kind: 'dive' };
          if (S.mode === 'diving') return { kind: 'surface' };
          return { kind: 'wait' };
        },
        label: t => ({ exit: '나오기', dive: '잠수', surface: '떠오르기' })[t?.kind] ?? '',
        run: t => {
          if (t.kind === 'exit') { const at = exitPoint(); if (at) leave(at); }
          else if (t.kind === 'dive') dive();
          else if (t.kind === 'surface') surface();
        },
      },
      { name: 'dive-enter', priority: 48, test: () => entryPoint(), label: '바다에 들어가기', run: at => enter(at) },
    ],
    get active() { return S.mode !== 'land'; },
    get mode() { return S.mode; },
    get phase() { return S.phase; },
    get under() { return S.under; },
    get creatures() { return sea.map(c => ({ id: c.id, x: c.x, z: c.z, size: c.size, speed: c.speed })); },
    swimmable, entryPoint, exitPoint, fx,
    get swim() { return getSwim(); },
    /** 지금 바로 뭍으로 (점검·다른 트랙) */
    cut,
    update(dt, paused) {
      if (S.warnT > 0) S.warnT -= dt;
      fx.update(paused ? 0 : dt);
      const sw = swim;
      if (S.mode === 'land' && !sw?.active) { fx.underwater = 0; return; }
      const p = kit.player;
      sw?.update(paused ? 0 : dt, p?.speed ?? 0);
      fx.underwater = sw?.depth ?? 0;
      if (paused || S.mode === 'land' || S.mode === 'entering') return;
      // 잠기기 · 물속 · 떠오르기
      if (S.mode === 'diving') {
        S.t += dt;
        if (S.phase === 'down' && S.t >= DOWN) { S.phase = 'under'; S.t = 0; }
        else if (S.phase === 'under' && S.t >= UNDER_MAX) surface();
        else if (S.phase === 'up' && S.t >= UP) landed();
        S.under = S.phase === 'under' ? 1 : S.phase === 'down' ? S.t / DOWN : S.phase === 'up' ? 1 - S.t / UP : 0;
        if (S.phase === 'under' && !S.caught) {
          const { x, z } = p.position;
          let best = null, bd = Infinity;
          for (const c of sea) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
          if (best && canCatch(bd, best.size, true)) {
            S.caught = best.id;
            fx.bubble(best.x, waterY(best.x, best.z), best.z, { n: 6, spread: 0.3 });
            removeSea(best);
            surface();
          }
        }
        S.strokeT -= dt;
        if (S.strokeT <= 0) { S.strokeT = 0.22; fx.bubble(p.position.x, waterY(p.position.x, p.position.z), p.position.z, { n: 1, spread: 0.15 }); }
      } else if (S.mode === 'swim' && p.speed > 0.4) {
        S.strokeT -= dt;
        if (S.strokeT <= 0) { S.strokeT = 0.9; kit.sfx('splash', { volume: 0.18 }); fx.bubble(p.position.x, waterY(p.position.x, p.position.z), p.position.z, { n: 2, spread: 0.3 }); }
      }
      // 잠긴 주인공 그림자
      const k = S.mode === 'diving' ? S.under : 0;
      me.visible = k > 0.02;
      if (me.visible) { me.material.opacity = 0.42 * k; me.position.set(p.position.x, waterY(p.position.x, p.position.z) + 0.002, p.position.z); me.rotation.y = p.facing; }
      if (S.mode === 'swim' || S.mode === 'diving') spawnTick(dt);
      for (const c of sea) { moveSea(c, dt); drawSea(c, dt); }
    },
  };
  return api;
}
