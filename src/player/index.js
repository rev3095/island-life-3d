// 트랙 T1: 플레이어 — 걷기·달리기·충돌·높이 따라가기·발소리, 도구 들기, 카메라. ctx.services.player 를 올린다.
import { LoopOnce, LoopRepeat } from 'three';
import { createCameraRig } from './camera.js';
import { buildTool } from './tools.js';

const WALK = 2.6, RUN = 5.0;          // 칸/초
const RADIUS = 0.26;                  // 충돌 원 반지름
const ACCEL = 14;                     // 속도 따라가기 (1/초)
const TURN = 13;                      // 최대 회전 (라디안/초)
const FADE = 0.18;                    // 동작 바꿀 때 섞는 시간
const STEP_SFX = { sand: 'step-sand', wood: 'step-wood', ramp: 'step-wood' };

let P = null;                         // 이 모듈의 상태

export default {
  name: 'player',

  async init(ctx) {
    const { THREE, assets, materials, scene, events, state } = ctx;
    const world = ctx.services.world;
    const gltf = await assets.loadCharacter('player');
    const { scene: model, animations } = assets.instantiate(gltf);
    materials.applyToonStyle(model, { outlineWidth: 0.006 });
    const root = new THREE.Group();
    root.name = 'player';
    root.add(model);
    scene.add(root);

    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(animations.map(c => [c.name, mixer.clipAction(c)]));
    const hand = model.getObjectByName('armR') ?? model.getObjectByName('arm.R');
    const toolMount = new THREE.Group();
    toolMount.position.set(0, 0.11, 0.02);
    toolMount.rotation.set(Math.PI * 0.5, 0, 0);
    hand?.add(toolMount);

    P = {
      root, model, mixer, actions, toolMount, toolModels: {},
      position: root.position, facing: 0, vx: 0, vz: 0, speed: 0,
      frozen: false, anim: null, oneShot: null, tool: null, toolKeys: true,
      tile: { tx: -1, tz: -1 }, stepPhase: 0, rig: createCameraRig(ctx),
    };

    // 처음 설 곳: 저장된 자리가 걸을 수 있으면 거기, 아니면 선착장 앞
    const sp = world?.places?.spawn ?? { x: 0, z: 0, facing: 0 };
    const saved = state.player;
    const useSaved = world && (saved.x || saved.z) && world.island.isWalkable(saved.x, saved.z);
    P.position.set(useSaved ? saved.x : sp.x, 0, useSaved ? saved.z : sp.z);
    P.facing = useSaved ? saved.facing ?? 0 : sp.facing ?? 0;
    P.position.y = world ? world.island.heightAt(P.position.x, P.position.z) : 0;
    root.rotation.y = Math.PI - P.facing;
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
      pointInFront(dist = 0.75) { return { x: P.position.x + Math.sin(P.facing) * dist, z: P.position.z - Math.cos(P.facing) * dist }; },
      setTool,
      play(name) { playOnce(name); },
      freeze(v = true) { P.frozen = !!v; if (P.frozen) { P.vx = P.vz = 0; } },
      /** 순간이동 (집 안팎 등). facing 생략하면 그대로 */
      teleport(x, z, facing = P.facing) {
        P.position.set(x, world ? world.island.heightAt(x, z) : 0, z);
        P.facing = facing; P.vx = P.vz = 0;
        root.rotation.y = Math.PI - facing;
        P.rig.snap(P.position);
      },
      /** 바라보는 방향으로 돌기 (대화 상대 쪽 등) */
      face(x, z) { P.facing = Math.atan2(x - P.position.x, -(z - P.position.z)); root.rotation.y = Math.PI - P.facing; },
      camera: P.rig,
      /** 숫자키 도구 바꾸기를 이 모듈이 맡을지 (gameplay 가 가방 확인 후 바꾸려면 false) */
      set toolKeys(v) { P.toolKeys = v; }, get toolKeys() { return P.toolKeys; },
    };
    ctx.services.player = api;
    if (saved.tool) setTool(saved.tool, { silent: true });

    const TOOLS = ctx.constants.TOOLS;
    events.on('input:press', ({ intent }) => {
      if (!P.toolKeys || P.frozen) return;
      const n = /^tool([1-5])$/.exec(intent);
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

    // 이동 의도 → 목표 속도
    let mx = P.frozen ? 0 : input.move.x, mz = P.frozen ? 0 : input.move.z;
    const mag = Math.min(1, Math.hypot(mx, mz));
    const top = input.run && !P.frozen ? RUN : WALK;
    const tx = mag > 0.05 ? (mx / (mag || 1)) * top * mag : 0, tz = mag > 0.05 ? (mz / (mag || 1)) * top * mag : 0;
    const k = 1 - Math.exp(-dt * ACCEL);
    P.vx += (tx - P.vx) * k;
    P.vz += (tz - P.vz) * k;
    if (Math.hypot(P.vx, P.vz) < 0.02 && mag < 0.05) P.vx = P.vz = 0;

    // 바라보는 방향: 입력 방향으로 부드럽게 (0 = 북쪽 -Z, 시계 방향)
    if (mag > 0.05) {
      const want = Math.atan2(mx, -mz);
      let d = want - P.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      P.facing += Math.sign(d) * Math.min(Math.abs(d), TURN * dt);
      P.facing = Math.atan2(Math.sin(P.facing), Math.cos(P.facing));
    }

    // 충돌하며 움직이기 → 실제로 간 거리로 속도를 잰다 (벽에 붙으면 걷기 동작도 느려진다)
    const pos = P.position;
    const ox = pos.x, oz = pos.z;
    if (P.vx || P.vz) {
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
    P.root.rotation.y = Math.PI - P.facing;

    // 동작
    const moving = P.speed > 0.25 && mag > 0.05;
    if (!P.oneShot) {
      const want = !moving ? 'idle' : P.speed > (WALK + RUN) / 2 - 0.3 ? 'run' : 'walk';
      play(want);
      if (want === 'walk') P.actions.walk.timeScale = Math.max(0.6, P.speed / WALK) * 1.45;
      if (want === 'run') P.actions.run.timeScale = Math.max(0.7, P.speed / RUN) * 1.2;
    }
    P.mixer.update(dt);

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
  },
};

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
