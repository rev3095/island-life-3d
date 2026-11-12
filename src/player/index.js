// 트랙 T1: 플레이어 — 걷기·달리기·충돌·높이 따라가기·발소리, 도구 들기·도구 동작, 카메라. ctx.services.player 를 올린다.
// 11차: 옷 갈아입기 ctx.services.outfit (outfit.js — 옷 모델을 주인공 뼈대에 끼운다, 빙글 동작 spin AN-12)
import { LoopOnce, LoopRepeat, Vector3 } from 'three';
import { createCameraRig } from './camera.js';
import { buildTool } from './tools.js';
import { createMotions } from './motions.js';
import { createMouseMove } from './mouse.js';
import { sitMetaOf, sitRoot } from '../gameplay/decor/seats.js';   // 10차 앉기: 엉덩이 닿는 곳 → 뿌리 자리 (순수 함수)

const WALK = 2.6, RUN = 5.0;          // 칸/초
const RADIUS = 0.26;                  // 충돌 원 반지름
const ACCEL = 14;                     // 속도 따라가기 (1/초)
const TURN = 13;                      // 최대 회전 (라디안/초)
const FADE = 0.18;                    // 동작 바꿀 때 섞는 시간
const STEP_SFX = { sand: 'step-sand', wood: 'step-wood', ramp: 'step-wood', stone: 'step-sand' };   // stone = 9차 돌길·벽돌길
// facing = three 의 rotation.y 와 같은 뜻: 0 = 북쪽(-Z), +π/2 = 서쪽(-X), π = 남쪽, -π/2 = 동쪽.
// 모델 정면은 +Z 라서 모델 rotation.y = facing + π.
const facingOf = (dx, dz) => Math.atan2(-dx, -dz);
const SIT_SLIDE = 0.42, STAND_SLIDE = 0.4;   // 10차 앉기: 앉는 자리로 미끄러지는 시간 · 일어나 서는 곳으로 (초, 클립이 짧으면 클립 길이)

let P = null;                         // 이 모듈의 상태

export default {
  name: 'player',

  async init(ctx) {
    const { THREE, assets, materials, scene, events, state } = ctx;
    const world = ctx.services.world;
    const gltf = await assets.loadCharacter('player');
    const { scene: model, animations } = assets.instantiate(gltf);
    // merge: 툰 부품을 [몸 · 눈·볼 · 외곽선] 세 메시로 합친다. 플레이어는 가림 투명 대상에서 뺀다 (늘 보여야 하는 쪽)
    materials.applyToonStyle(model, { outlineWidth: 0.006, merge: true });
    model.userData.occluder = false;
    const root = new THREE.Group();
    root.name = 'player';
    root.add(model);
    scene.add(root);

    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(animations.map(c => [c.name, mixer.clipAction(c)]));
    const hand = model.getObjectByName('armR') ?? model.getObjectByName('arm.R');
    const toolMount = new THREE.Group();
    toolMount.position.set(0, 0.11, 0.02);
    toolMount.rotation.set(Math.PI * 0.7, 0, 0);       // 손잡이가 앞 위쪽으로 비스듬히
    hand?.add(toolMount);

    P = {
      root, model, mixer, actions, toolMount, toolModels: {},
      position: root.position, facing: 0, vx: 0, vz: 0, speed: 0,
      frozen: false, anim: null, oneShot: null, tool: null, toolKeys: true, gait: null, stance: null,
      tile: { tx: -1, tz: -1 }, stepPhase: 0, rig: createCameraRig(ctx),
      motions: createMotions(model, toolMount),
    };
    const headBone = model.getObjectByName('head');
    // 10차 AN-11: 앉을 때 엉덩이 닿는 곳 (모델 메타 sit: {hip, forward} — 없으면 키 × 0.28)
    {
      let meta = null;
      model.traverse(o => { if (!meta && o.userData?.sit) meta = o.userData.sit; });
      meta ??= gltf.scene?.userData?.sit ?? gltf.userData?.sit ?? gltf.parser?.json?.extras?.sit ?? gltf.parser?.json?.scenes?.[0]?.extras?.sit ?? null;
      const box = new THREE.Box3().setFromObject(model);
      P.height = Number.isFinite(box.max.y) && box.max.y > 0.3 ? box.max.y : 1;
      P.sitMeta = sitMetaOf(meta, P.height);
      P.sitFromModel = !!meta;
    }

    // 처음 설 곳: 저장된 자리가 걸을 수 있으면 거기, 아니면 선착장 앞
    const sp = world?.places?.spawn ?? { x: 0, z: 0, facing: 0 };
    const saved = state.player;
    const useSaved = world && (saved.x || saved.z) && world.island.isWalkable(saved.x, saved.z);
    P.position.set(useSaved ? saved.x : sp.x, 0, useSaved ? saved.z : sp.z);
    P.facing = useSaved ? saved.facing ?? 0 : sp.facing ?? 0;
    P.position.y = world ? world.island.heightAt(P.position.x, P.position.z) : 0;
    root.rotation.y = P.facing + Math.PI;
    P.rig.snap(P.position);
    play('idle');

    mixer.addEventListener('finished', e => { if (P.oneShot && e.action === P.actions[P.oneShot]) P.oneShot = null; });

    const api = {
      position: P.position,
      get facing() { return P.facing; },
      get tool() { return P.tool; },
      get frozen() { return P.frozen; },
      get speed() { return P.speed; },
      tileInFront() { const p = api.pointInFront(0.75); return world ? world.island.toTile(p.x, p.z) : { tx: 0, tz: 0 }; },
      pointInFront(dist = 0.75) { return { x: P.position.x - Math.sin(P.facing) * dist, z: P.position.z - Math.cos(P.facing) * dist }; },
      setTool,
      play(name) { playOnce(name); },
      /** 9차 M9-P1: 걸을 때 걷기·달리기 대신 쓸 동작 ('push' 눈덩이 밀기 AN-09, null = 보통). 클립이 없으면 보통 걷기 */
      setGait(name) { P.gait = name || null; },
      /** 서 있을 때 서기 대신 되풀이할 동작 ('sparkler' 손 불꽃 흔들기 AN-08, null = 보통) */
      setStance(name) { P.stance = name || null; },
      get gait() { return P.gait; }, get stance() { return P.stance; },
      /** 동작 클립이 있나 ('place' 놓기 AN-10 등) */
      hasClip: name => !!P.actions[name],
      /**
       * 10차 AN-11 앉기: seat = { key, x, z, y (앉는 면 높이), facing, stand: {x, z} } (gameplay/decor/seats.js seatsOf 의 하나).
       * 앉는 자리로 돌아 미끄러지며 sit_down → sit 되풀이. 'sit' 클립이 없으면 false (앉지 않는다). 움직이면·stand() 하면 stand_up 하고 seat.stand 에 선다.
       * 이벤트 player:sit {key} · player:stand {key}
       */
      sit(seat) {
        if (!seat || !P.actions.sit || P.seat || P.frozen || P.motions.locked) return false;
        P.mouse?.cancel(); P.script?.done(false);
        const to = sitRoot(seat, P.sitMeta);
        P.seat = { seat, to, from: { x: P.position.x, y: P.position.y, z: P.position.z, facing: P.facing }, phase: 'down', t: 0, wait: [] };
        P.vx = P.vz = 0;
        if (P.actions.sit_down) playOnce('sit_down'); else play('sit');
        P.seat.dur = Math.min(SIT_SLIDE, P.actions.sit_down ? P.actions.sit_down.getClip().duration * 0.8 : SIT_SLIDE);
        events.emit('player:sit', { key: seat.key });
        return true;
      },
      /** 일어나기 → Promise (다 서면). 앉아 있지 않으면 바로 */
      stand() {
        const st = P.seat;
        if (!st) return Promise.resolve(false);
        return new Promise(res => {
          st.wait.push(res);
          if (st.phase === 'up') return;
          st.phase = 'up'; st.t = 0;
          st.upFrom = { x: P.position.x, y: P.position.y, z: P.position.z };
          if (P.actions.stand_up) playOnce('stand_up'); else P.oneShot = null;
          st.dur = Math.min(STAND_SLIDE, P.actions.stand_up ? P.actions.stand_up.getClip().duration * 0.8 : STAND_SLIDE);
        });
      },
      /** 앉아 있는 자리 { key, … } | null (일어나는 중에도 그 자리) */
      get seat() { return P.seat?.seat ?? null; },
      get seated() { return !!P.seat; },
      /** 앉기 메타 (엉덩이 높이 hip · 앞 forward, 모델에서 읽었나 fromModel) */
      get sitInfo() { return { ...P.sitMeta, height: P.height, fromModel: P.sitFromModel }; },
      /**
       * 도구 동작 (절차적): 'swing' 'cast' 'reel' 'dig' 'chop' 'water' 'shake' 'pickup' 'ouch'.
       * opts: { onHit() 효과 나는 순간, speed, lock=true 동작 중 못 움직임 } → Promise<bool> (끝까지 하면 true)
       */
      act(name, opts) { P.oneShot = null; return P.motions.play(name, opts); },
      /** 잡고 있을 자세 ('fish' = 낚싯대 내밀기, null = 놓기). 'cast' 는 끝나면 저절로 'fish' */
      hold(name) { P.motions.hold(name); },
      get acting() { return P.motions.active; },
      /** 지금 든 도구 모델 (Group, userData.tip·bobber) 또는 null */
      toolModel() { return (P.tool && P.toolModels[P.tool]) || null; },
      /** 도구 끝(낚싯대 끝·잠자리채 그물·물뿌리개 주둥이)의 월드 좌표 */
      toolTip(out = new Vector3()) {
        const m = api.toolModel();
        if (!m) return null;
        P.root.updateMatrixWorld(true);
        return (m.userData.tip ?? m).getWorldPosition(out);
      },
      /** 오른손 자리 (9차 손 불꽃 불티) */
      handPoint(out = new Vector3()) {
        P.root.updateMatrixWorld(true);
        if (hand) return hand.localToWorld(out.set(0, 0.13, 0.02));
        return out.copy(P.position).setY(P.position.y + 0.4);
      },
      /** 머리 위 (잡은 것을 들어 보일 때) */
      headTop(out = new Vector3()) {
        P.root.updateMatrixWorld(true);
        if (headBone) headBone.getWorldPosition(out); else out.copy(P.position).setY(P.position.y + 0.8);
        out.y += 0.55;
        return out;
      },
      freeze(v = true) { P.frozen = !!v; if (P.frozen) { P.vx = P.vz = 0; } },
      /**
       * 연출 걷기 (문 드나들기 등, 실내 보드 AN-07): 충돌 없이 (x, z) 까지 곧장 걷는다. 걷기 동작·발소리·높이 따라가기는 그대로, 입력은 받지 않는다.
       * opts: { speed 칸/초 (기본 걷기의 0.8배), face 가는 쪽을 볼지 } → Promise<bool> (도착하면 true, 순간이동·다른 walkTo 로 끊기면 false)
       */
      walkTo(x, z, { speed = WALK * 0.8, face = true } = {}) {
        P.script?.done(false);
        return new Promise(res => { const s = { x, z, speed, face, done: v => { if (P.script === s) P.script = null; res(v); } }; P.script = s; });
      },
      get walking() { return !!P.script; },
      /** 순간이동 (집 안팎 등). facing 생략하면 그대로 */
      teleport(x, z, facing = P.facing) {
        if (P.seat) endSeat();                            // 앉아 있었으면 그 자리는 잊는다
        P.position.set(x, world ? world.island.heightAt(x, z) : 0, z);
        P.facing = facing; P.vx = P.vz = 0;
        P.mouse?.cancel();                                // 마우스로 가던 곳은 잊는다
        P.script?.done(false);
        root.rotation.y = facing + Math.PI;
        P.rig.snap(P.position);
      },
      /** 바라보는 방향으로 돌기 (대화 상대 쪽 등) */
      face(x, z) { P.facing = facingOf(x - P.position.x, z - P.position.z); root.rotation.y = P.facing + Math.PI; },
      camera: P.rig,
      /** 숫자키 도구 바꾸기를 이 모듈이 맡을지 (gameplay 가 가방 확인 후 바꾸려면 false) */
      set toolKeys(v) { P.toolKeys = v; }, get toolKeys() { return P.toolKeys; },
    };
    ctx.services.player = api;
    // 11차 M11-P4 옷 갈아입기 (D100-A): 저장된 옷을 입힌다 (옷 모델은 따로 받는 묶음이라 기다리지 않는다 — 그동안 기본 모습)
    try {
      const { createOutfit } = await import('./outfit.js');
      ctx.services.outfit = await createOutfit(ctx, { model, outlineWidth: 0.006 });
    } catch (e) { console.warn('[player] 옷 갈아입기를 못 켰어요', e); }
    function endSeat() {
      const st = P.seat;
      if (!st) return;
      P.seat = null; P.oneShot = null;
      events.emit('player:stand', { key: st.seat.key });
      for (const f of st.wait) f(true);
    }
    P.endSeat = endSeat;
    // 마우스로 걷기 (mouse.js): input 이 키보드·패드가 없을 때 이 방향을 쓴다
    P.mouse = createMouseMove(ctx, { position: () => P.position });
    ctx.input.pointerMove = P.mouse;
    const TOOLS = ctx.constants.TOOLS;
    if (saved.tool) setTool(saved.tool, { silent: true });     // TOOLS 다음에 (저장된 도구가 있으면 바로 쓴다)

    events.on('input:press', ({ intent }) => {
      if (!P.toolKeys || P.frozen || !ctx.input.enabled || ctx.services.ui?.isBlocking?.()) return;
      const n = /^tool([1-6])$/.exec(intent);
      if (n) setTool(P.tool === TOOLS[n[1] - 1] ? null : TOOLS[n[1] - 1]);
      else if (intent === 'toolNone') setTool(null);
      else if (intent === 'toolNext' || intent === 'toolPrev') {
        const list = [null, ...TOOLS], i = list.indexOf(P.tool);
        setTool(list[(i + (intent === 'toolNext' ? 1 : list.length - 1)) % list.length]);
      }
    });

    function setTool(id, { silent = false } = {}) {
      if (id && !TOOLS.includes(id)) id = null;
      for (const m of Object.values(P.toolModels)) m.visible = false;
      if (id) {
        P.toolModels[id] ??= buildTool(ctx, id);
        if (P.toolModels[id] && !P.toolModels[id].parent) P.toolMount.add(P.toolModels[id]);
        if (P.toolModels[id]) P.toolModels[id].visible = true;
      }
      if (P.tool === id) return;
      P.tool = id;
      state.player.tool = id;
      if (!silent) events.emit('player:tool', { tool: id });
    }
  },

  update(dt, ctx) {
    if (!P) return;
    const { input, events, state } = ctx;
    const world = ctx.services.world;

    // 10차 앉기: 앉아 있는 동안은 걷기·충돌·높이 따라가기 대신 자리에 붙어 있는다
    if (P.seat) { updateSeat(dt, ctx); return; }

    // 이동 의도 → 목표 속도
    const still = P.frozen || P.motions.locked;
    let mx = still ? 0 : input.move.x, mz = still ? 0 : input.move.z;
    const mag = Math.min(1, Math.hypot(mx, mz));
    const top = input.run && !still ? RUN : WALK;
    const tx = mag > 0.05 ? (mx / (mag || 1)) * top * mag : 0, tz = mag > 0.05 ? (mz / (mag || 1)) * top * mag : 0;
    const k = 1 - Math.exp(-dt * ACCEL);
    P.vx += (tx - P.vx) * k;
    P.vz += (tz - P.vz) * k;
    if (Math.hypot(P.vx, P.vz) < 0.02 && mag < 0.05) P.vx = P.vz = 0;

    // 바라보는 방향: 입력 방향으로 부드럽게
    if (mag > 0.05) {
      const want = facingOf(mx, mz);
      let d = want - P.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      P.facing += Math.sign(d) * Math.min(Math.abs(d), TURN * dt);
      P.facing = Math.atan2(Math.sin(P.facing), Math.cos(P.facing));
    }

    // 충돌하며 움직이기 → 실제로 간 거리로 속도를 잰다 (벽에 붙으면 걷기 동작도 느려진다)
    const pos = P.position;
    const ox = pos.x, oz = pos.z;
    const sc = P.script;
    if (sc) {
      // 연출 걷기 (walkTo): 입력·충돌 없이 곧장
      const dx = sc.x - pos.x, dz = sc.z - pos.z, d = Math.hypot(dx, dz), step = sc.speed * dt;
      if (d <= step || d < 1e-3) { pos.x = sc.x; pos.z = sc.z; P.vx = P.vz = 0; }
      else {
        pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        P.vx = (dx / d) * sc.speed; P.vz = (dz / d) * sc.speed;
        if (sc.face) P.facing = facingOf(dx, dz);
      }
    } else if (P.vx || P.vz) {
      const nx = pos.x + P.vx * dt, nz = pos.z + P.vz * dt;
      const r = world ? world.collide(pos.x, pos.z, nx, nz, RADIUS, pos.y) : { x: nx, z: nz };
      pos.x = r.x; pos.z = r.z;
    }
    P.speed = dt > 0 ? Math.hypot(pos.x - ox, pos.z - oz) / dt : 0;

    // 높이: 경사로·언덕·다리를 따라간다 (계단 턱은 살짝 부드럽게)
    if (world) {
      const gy = world.island.heightAt(pos.x, pos.z);
      const dy = gy - pos.y;
      pos.y = Math.abs(dy) > 0.6 ? gy : pos.y + dy * (1 - Math.exp(-dt * 22));
    }
    P.root.rotation.y = P.facing + Math.PI;

    // 동작
    const moving = P.speed > 0.25 && (mag > 0.05 || !!sc);
    if (sc && !P.vx && !P.vz) sc.done(true);
    if (!P.oneShot) {
      const gait = P.gait && P.actions[P.gait] ? P.gait : null, stance = P.stance && P.actions[P.stance] ? P.stance : null;
      const want = !moving ? stance ?? 'idle' : gait ?? (P.speed > (WALK + RUN) / 2 - 0.3 ? 'run' : 'walk');
      play(want);
      if (want === 'walk' || want === gait) P.actions[want].timeScale = Math.max(0.6, P.speed / WALK) * (want === 'walk' ? 1.45 : 1.1);
      if (want === 'run') P.actions.run.timeScale = Math.max(0.7, P.speed / RUN) * 1.2;
    }
    P.mixer.update(dt);
    P.motions.update(dt);

    // 발소리: 걷기·달리기 한 주기에 두 번
    const a = P.anim === 'walk' || P.anim === 'run' ? P.actions[P.anim] : null;
    if (a && world) {
      const ph = (a.time / a.getClip().duration) * 2 % 1;
      if (ph < P.stepPhase) {
        const g = world.island.groundAt(pos.x, pos.z);
        events.emit('sfx', { name: STEP_SFX[g] ?? 'step-grass', ground: g, volume: P.anim === 'run' ? 1 : 0.7 });
      }
      P.stepPhase = ph;
    } else P.stepPhase = 0;

    // 칸이 바뀌면 알린다
    if (world) {
      const t = world.island.toTile(pos.x, pos.z);
      if (t.tx !== P.tile.tx || t.tz !== P.tile.tz) {
        P.tile = t;
        events.emit('player:moved', { x: pos.x, z: pos.z, tx: t.tx, tz: t.tz });
      }
    }
    const sp = state.player;
    sp.x = pos.x; sp.z = pos.z; sp.facing = P.facing;

    P.rig.update(dt, pos, P.vx, P.vz);
    P.mouse?.update(dt);
  },
};

/** 앉아 있는 동안 (sit → 내려앉기 · 앉기 · 일어나기) */
function updateSeat(dt, ctx) {
  const st = P.seat, pos = P.position;
  const ease = t => t * t * (3 - 2 * t);
  st.t += dt;
  const k = ease(Math.min(1, st.t / Math.max(0.05, st.dur ?? SIT_SLIDE)));
  if (st.phase === 'down' || st.phase === 'sit') {
    pos.set(st.from.x + (st.to.x - st.from.x) * k, st.from.y + (st.to.y - st.from.y) * k, st.from.z + (st.to.z - st.from.z) * k);
    let d = st.to.facing - st.from.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    P.facing = st.from.facing + d * Math.min(1, k * 1.6);
    if (st.phase === 'down' && !P.oneShot && k >= 1) { st.phase = 'sit'; play('sit'); }
    // 움직이려 하면 일어난다 (키보드·패드·마우스 걷기 — input.move)
    const m = ctx.input.move, frozen = P.frozen || ctx.services.ui?.isBlocking?.();
    if (!frozen && Math.hypot(m.x, m.z) > 0.3 && st.t > 0.25) ctx.services.player.stand();
  } else if (st.phase === 'up') {
    const g = st.seat.stand, gy = ctx.services.world ? ctx.services.world.island.heightAt(g.x, g.z) : 0;
    pos.set(st.upFrom.x + (g.x - st.upFrom.x) * k, st.upFrom.y + (gy - st.upFrom.y) * k, st.upFrom.z + (g.z - st.upFrom.z) * k);
    if (k >= 1 && (!P.oneShot || st.t > (st.dur ?? STAND_SLIDE) + 0.35)) { P.endSeat(); play('idle'); }
  }
  P.vx = P.vz = 0; P.speed = 0;
  P.root.rotation.y = P.facing + Math.PI;
  P.mixer.update(dt);
  P.motions.update(dt);
  // 저장은 일어나 설 곳 (불러왔을 때 의자 충돌 안에 서지 않게)
  const sp = ctx.state.player;
  sp.x = st.seat.stand.x; sp.z = st.seat.stand.z; sp.facing = P.facing;
  P.rig.update(dt, pos, 0, 0);
  P.mouse?.update(dt);
}

function play(name) {
  if (P.anim === name || !P.actions[name]) return;
  const next = P.actions[name], prev = P.anim && P.actions[P.anim];
  next.reset();
  next.setLoop(LoopRepeat, Infinity);
  next.enabled = true;
  next.setEffectiveTimeScale(1).setEffectiveWeight(1);
  if (prev) { next.crossFadeFrom(prev, FADE, false); }
  next.play();
  P.anim = name;
}

/** 한 번만 하는 동작 (기뻐하기 등). 끝나면 걷기/서기로 돌아간다 */
function playOnce(name) {
  if (!P.actions[name]) return;
  if (name === 'idle' || name === 'walk' || name === 'run') { P.oneShot = null; play(name); return; }
  const next = P.actions[name], prev = P.anim && P.actions[P.anim];
  next.reset();
  next.setLoop(LoopOnce, 1);
  next.clampWhenFinished = true;                      // 마지막 자세에서 멈췄다가 다음 동작으로 섞인다
  next.setEffectiveTimeScale(1).setEffectiveWeight(1);
  if (prev && prev !== next) next.crossFadeFrom(prev, FADE, false);
  next.play();
  P.anim = name;
  P.oneShot = name;
}
