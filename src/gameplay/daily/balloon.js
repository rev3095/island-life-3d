// M13-P3 선물 풍선 · 새총 (13차 보드 D142-A): 하루 cfg.perDay 번 (9–18시 사이 정해진 때) 바다 쪽에서 풍선 PR-33 이 바람 따라 섬을 건넌다.
// 새총 TO-07(숫자키 6, 도구 'sling')을 들고 풍선 아래·앞에서 Space → 돌이 날아가 맞으면 풍선이 터지고 선물 상자가 떨어져 선물(gather drops, F 로 줍기)이 된다.
// 풍선은 world 물체가 아니라 이 놀이의 메시 (움직이니까, 저장 안 함). 그날 맞혔거나 놓친 풍선은 state.daily.balloons.done.
// 흔들림 (D147-A): 높음·적정은 풍선·줄 재질에 바람 정점 셰이더(STYLE_WIND — 이미 있는 갈래), 낮음·매우 낮음은 CPU 로 통째 기울이기.
import * as R from './rules.js';

const POP_FALL = 0.75;     // 상자가 떨어지는 시간 (초)
const SHOT = 0.28;         // 돌이 날아가는 시간 (초)
const BALLOON_MATS = new Set(['balloon', 'shine', 'string']);

export function createBalloons(K) {
  const { ctx, cfg: CFG, S, st, now, seed, toast, emit, count } = K;
  const cfg = CFG.balloons;
  const { THREE, scene } = ctx;
  const flying = [];        // { e (계획), root, t, x0, z0, dir, lane, span, base, popped, fall }
  const shots = [];         // 날아가는 돌 { mesh, t, from, to, hit }
  let model = null, loading = null;

  function loadModel() {
    loading ??= Promise.all([ctx.assets.loadEnv('gift-balloon'), ctx.assets.loadEnvSpec('gift-balloon').catch(() => null)])
      .then(([gltf, spec]) => (model = { gltf, spec }))
      .catch(e => { console.warn('[daily] 풍선 모델을 못 받았어요', e); return null; });
    return loading;
  }

  const shaderSway = () => ['high', 'mid'].includes(ctx.quality);

  function makeBalloon(color) {
    const { scene: obj } = ctx.assets.instantiate(model.gltf);
    const toon = ctx.materials.applyToonStyle(obj, { spec: model.spec });
    toon.setColor?.('balloon', color);
    const root = new THREE.Group();
    root.name = 'daily:balloon';
    root.add(obj);
    const parts = { balloon: [], gift: [] };
    obj.traverse(o => {
      if (!o.isMesh || o.userData.outline) return;
      const name = o.material?.name ?? '';
      if (BALLOON_MATS.has(name)) {
        parts.balloon.push(o);
        if (shaderSway() && name !== 'shine') {   // 높음·적정: 바람 정점 셰이더로 흔들기
          const m = ctx.materials.toonMaterial(o.material.color.clone(), { name, wind: true, flat: o.material.flatShading });
          if (name === 'balloon') m.color.set(color);
          o.material = m;
        }
      } else parts.gift.push(o);
    });
    scene.add(root);
    return { root, parts };
  }

  function removeBalloon(b) {
    scene.remove(b.root);
    b.root.traverse(o => { if (o.isMesh && !o.userData.outline) o.material?.dispose?.(); });
    const i = flying.indexOf(b);
    if (i >= 0) flying.splice(i, 1);
  }

  const doneList = n => {
    const s = st();
    if (s.balloons?.day !== n.dayKey) s.balloons = { day: n.dayKey, done: [] };
    return s.balloons.done;
  };

  async function spawn(e, n) {
    const p = S().player?.position, I = K.isl();
    if (!p || !I) return;
    const b = { e, root: null, t: 0, dir: -e.side, lane: e.lane, x0: p.x + e.side * 22, z0: p.z - 1.6 + e.lane * 2, span: 44, base: 0, popped: false, fall: null, spawning: true };
    flying.push(b);
    if (!model && !(await loadModel())) { flying.splice(flying.indexOf(b), 1); return; }
    const made = makeBalloon(e.color);
    Object.assign(b, made, { spawning: false });
    place(b, 0);
    const s = st();
    const has = !!S().data?.inventory?.hasTool?.('sling');
    if (s.seen.balloon == null) toast(cfg.first, '🎈'); else toast(cfg.again, '🎈');
    if (!has) setTimeout(() => toast(cfg.noSling, '🎯'), 1800);
    s.seen.balloon ??= n.dayKey;
    emit('daily:balloon', { spawn: true, i: e.i, dayKey: n.dayKey });
  }

  function place(b, dt) {
    const pos = R.balloonPos(b, b.t, cfg);
    const I = K.isl();
    const ground = Math.max(0, I?.heightAt?.(pos.x, pos.z) ?? 0);
    b.base = dt ? b.base + (ground - b.base) * Math.min(1, dt * 0.6) : ground;
    b.pos = { x: pos.x, y: b.base + pos.y, z: pos.z };
    b.root.position.set(b.pos.x, b.pos.y - 1.25, b.pos.z);   // 모델 원점 = 상자 바닥, 풍선 가운데는 1.25 위
    if (!shaderSway()) b.root.rotation.z = Math.sin(b.t * 1.3 + b.lane * 4) * 0.07;
    else b.root.rotation.z = 0;
    return pos.done;
  }

  function sync(n) {
    if (!K.isOpen(n)) return;
    const done = doneList(n);
    if (!K.onIsland() || flying.length) return;
    for (const e of R.balloonPlan(n.dayKey, seed(), cfg)) {
      if (done.includes(e.i)) continue;
      if (n.hourF >= e.at && n.hourF < e.at + (cfg.window ?? 1.5)) { spawn(e, n); break; }
    }
  }

  // ── 새총 ──
  function target() {
    const pl = S().player, p = pl?.position;
    if (!p) return null;
    const fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
    let best = null, bd = Infinity;
    for (const b of flying) {
      if (b.popped || !b.pos) continue;
      const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
      if (R.slingHits(p.x, p.z, fx, fz, b.pos.x, b.pos.z, cfg.reach ?? 3.4) && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  let pebbleGeo = null, pebbleMat = null;
  function shoot() {
    const pl = S().player, p = pl.position;
    S().gather?.toolbelt?.use?.('sling');
    ctx.events.emit('sfx', { name: 'net-swing', pitch: 1.5, volume: 0.8 });
    pebbleGeo ??= new THREE.SphereGeometry(0.06, 8, 6);
    pebbleMat ??= ctx.materials.toonMaterial('#B9B4A8', { name: 'pebble' });
    const mesh = new THREE.Mesh(pebbleGeo, pebbleMat);
    const tip = pl.toolTip?.(new THREE.Vector3()) ?? new THREE.Vector3(p.x, (p.y ?? 0) + 0.8, p.z);
    mesh.position.copy(tip);
    scene.add(mesh);
    const b = target();
    if (b) b.popped = true;   // 날아가는 동안 다른 돌이 같은 풍선을 노리지 않게
    const fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
    const to = b ? new THREE.Vector3(b.pos.x, b.pos.y, b.pos.z) : new THREE.Vector3(p.x + fx * 3, tip.y + 4.5, p.z + fz * 3);
    shots.push({ mesh, t: 0, from: tip.clone(), to, hit: b });
    if (!b && flying.some(x => !x.popped && x.pos && Math.hypot(x.pos.x - p.x, x.pos.z - p.z) < 9)) toast(cfg.miss, '🎯');
    return !!b;
  }

  function pop(b) {
    const n = now();
    for (const o of b.parts.balloon) o.visible = false;
    ctx.events.emit('sfx', { name: 'bite', pitch: 1.8, volume: 0.9 });
    const fx = S().gather?.fx;
    try { fx?.sparkle?.(b.pos.x, b.pos.y, b.pos.z); } catch { /* 반짝이 없어도 */ }
    const I = K.isl(), pl = S().player?.position;
    let land = { x: b.pos.x, z: b.pos.z };
    if (!I?.isWalkable?.(land.x, land.z) || I?.isWater?.(land.x, land.z)) land = (pl && S().gather?.drops?.findSpot?.(pl.x, pl.z, { rMin: 0.6, rMax: 1.4 })) ?? (pl ? { x: pl.x, z: pl.z } : land);
    b.fall = { t: 0, y0: b.root.position.y, x0: b.root.position.x, z0: b.root.position.z, land, ground: I?.heightAt?.(land.x, land.z) ?? 0 };
    if (n) doneList(n).push(b.e.i);
  }

  function landed(b) {
    const n = now();
    const canNote = !!R.nextRecipe(S().data?.recipes?.locked?.() ?? []);
    const g = R.balloonGift(cfg, R.rngOf('balloon-gift', n?.dayKey ?? '', seed(), b.e.i), { canNote });
    removeBalloon(b);
    if (g && S().data?.items?.get?.(g.item)) S().gather?.drops?.drop?.(g.item, g.n ?? 1, b.fall.land, { sound: 'fruit-drop' });
    const it = g && S().data?.items?.get?.(g.item);
    if (it) toast(`풍선 선물: ${it.name}${(g.n ?? 1) > 1 ? ` ${g.n}개` : ''} — F 로 주워요`, '🎁');
    count('balloon');
    emit('daily:balloon', { hit: true, i: b.e.i, item: g?.item ?? null, n: g?.n ?? 0, dayKey: n?.dayKey });
  }

  function update(dt) {
    for (const b of [...flying]) {
      if (b.spawning || !b.root) continue;
      if (b.fall) {
        b.fall.t += dt;
        const k = Math.min(1, b.fall.t / POP_FALL);
        b.root.position.set(b.fall.x0 + (b.fall.land.x - b.fall.x0) * k, b.fall.y0 + (b.fall.ground - b.fall.y0) * k * k, b.fall.z0 + (b.fall.land.z - b.fall.z0) * k);
        b.root.rotation.z *= 0.9;
        if (k >= 1) landed(b);
        continue;
      }
      b.t += dt;
      if (!b.popped || !shots.some(s => s.hit === b)) {
        if (place(b, dt)) {   // 반대편 바다로 가 버림 = 놓침
          const n = now();
          if (n) doneList(n).push(b.e.i);
          removeBalloon(b);
          emit('daily:balloon', { gone: true, i: b.e.i });
        }
      } else place(b, dt);
    }
    for (const s of [...shots]) {
      s.t += dt;
      const k = Math.min(1, s.t / SHOT);
      if (s.hit?.pos) s.to.set(s.hit.pos.x, s.hit.pos.y, s.hit.pos.z);
      s.mesh.position.lerpVectors(s.from, s.to, k);
      s.mesh.position.y += Math.sin(Math.PI * k) * 0.4;
      if (k >= 1) {
        scene.remove(s.mesh);
        shots.splice(shots.indexOf(s), 1);
        if (s.hit && !s.hit.fall) pop(s.hit);
      }
    }
  }

  function register(gp) {
    gp.add({
      name: 'daily:sling', intent: 'action', priority: 12,   // 든 도구 쓰기(gather-tool 10)보다 먼저 — 새총을 들었을 때만
      label: '쏘기',
      test: () => (S().player?.tool === 'sling' && K.onIsland() ? true : null),
      run: () => shoot(),
    });
  }

  return {
    sync, update, register,
    service: {
      /** 지금 떠 있는 풍선 [{ i, x, y, z, popped }] — 자동 플레이 봇이 눈으로 보듯 쓴다 */
      list: () => flying.filter(b => b.pos).map(b => ({ i: b.e.i, x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2), popped: b.popped })),
      plan: (dayKey = now()?.dayKey) => (dayKey ? R.balloonPlan(dayKey, seed(), cfg) : []),
      done: () => { const n = now(); return n ? [...doneList(n)] : []; },
      canHit: () => !!target(),
    },
  };
}
