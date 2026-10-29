// 2차 트랙 W1 (P2 채집 연결): 도구 들기·도구 동작, 줍기, 나무 흔들기·벌떼, 낚시, 곤충, 삽·도끼·물뿌리개, 심기·꽃 피우기.
// 무엇이 나오나·하루 몇 번·가방·도감 같은 규칙은 ctx.services.data 가 맡고, 여기서는 섬 위에서 보이고 움직이게 한다.
// 행동 키(Space·F)는 gameplay 디스패처로만 받는다: 진행 중 막기 200 · 나무 흔들기 60 · 줍기 50 · 심기 45 · 도구 쓰기 10.
import { createKit } from './util.js';
import { createMeshKit } from './meshes.js';
import { createFx } from './fx.js';
import { createDrops } from './drops.js';
import { createToolbelt } from './toolbelt.js';
import { createResults } from './results.js';
import { createPickup } from './pickup.js';
import { createBugModels } from './bugmodels.js';
import { createTrees } from './trees.js';
import { createFishing } from './fishing.js';
import { createBugs } from './bugs.js';
import { createWork } from './work.js';
import { createGarden } from './garden.js';

let G = null;

export default {
  name: 'gather',

  init(ctx) {
    const kit = createKit(ctx);
    const interactions = ctx.services.gameplay?.interactions;
    if (!kit.world || !kit.player || !kit.data || !interactions) {
      console.warn('[gather] world·player·data·gameplay 서비스가 있어야 채집을 켤 수 있다 — 건너뜀');
      return;
    }
    const { events } = ctx;
    const mk = createMeshKit(ctx);
    const fx = createFx(ctx);

    // 동작 중(busy)·기뻐하는 중(lock)에는 다른 행동을 막는다
    let busy = false, lockT = 0, lockedIt = false;
    const lock = sec => {
      const p = kit.player;
      lockT = Math.max(lockT, sec);
      if (!p.frozen) { p.freeze(true); lockedIt = true; }
    };
    const act = async (name, opts) => {
      busy = true;
      try { return await kit.player.act(name, opts); }
      finally { busy = false; }
    };
    const tickLock = dt => {
      if (lockT <= 0) return;
      lockT -= dt;
      if (lockT > 0) return;
      lockT = 0;
      if (lockedIt) { kit.player.freeze(false); lockedIt = false; }
    };
    let fishing = null;
    const isBusy = () => busy || lockT > 0 || !!fishing?.active;

    const drops = createDrops(ctx, kit, mk, fx);
    const toolbelt = createToolbelt(ctx, kit, { isBusy });
    const results = createResults(ctx, kit, mk, fx, { lock });
    const bugModels = createBugModels(ctx, mk);
    const garden = createGarden(ctx, kit, { fx, act });
    const pickup = createPickup(ctx, kit, { drops, results, fx, act, garden });
    const bugs = createBugs(ctx, kit, { bugModels, drops });
    const trees = createTrees(ctx, kit, { drops, fx, mk, bugModels, bugs, results, act, lock });
    fishing = createFishing(ctx, kit, { mk, fx, results, toolbelt, act });
    const work = createWork(ctx, kit, { mk, fx, drops, results, toolbelt, act, garden, bugs });

    // ---------- 잠자리채 ----------
    const bugMesh = id => { const m = bugModels.build(id); m.root.scale.setScalar(1.6); return m.root; };
    async function swing() {
      const p = kit.player;
      const f0 = p.pointInFront(0.8);
      const aim = bugs.nearest(f0.x, f0.z, 0.9);
      if (aim) p.face(aim.x, aim.z);
      await act('swing', {
        onHit() {
          kit.sfx('net-swing');
          const f = p.pointInFront(0.85);
          if (trees.bees.catchAt(f.x, f.z, 0.8)) {
            kit.sfx('bug-catch');
            results.gain('bug.honeybee', 1, { verb: '잡았다', show: true, mesh: bugMesh('bug.honeybee') });
            toolbelt.use('net');
            return;
          }
          const b = bugs.catchAt(f.x, f.z, 0.72, p.position.y);
          if (!b) { bugs.startle(f.x, f.z, 2.4); return; }
          bugs.take(b);
          kit.sfx('bug-catch');
          results.gain(b.id, 1, { verb: '잡았다', show: true, mesh: bugMesh(b.id) });
          toolbelt.use('net');
        },
      });
    }
    const USE = { rod: () => fishing.cast(), net: swing, shovel: () => work.dig(), axe: () => work.chop(), can: () => work.water() };

    // ---------- 행동 키 ----------
    interactions.add({
      name: 'gather-busy', priority: 200,
      // 낚시 중·동작 중에는 Space/F 를 여기서 받는다 (찌 당기기, 그 밖엔 무시)
      test: () => (isBusy() ? 'busy' : null),
      run: () => { if (fishing.active) fishing.press(); },
    });
    interactions.add({ name: 'gather-shake', intent: 'action', priority: 60, test: () => trees.find(), run: o => trees.shake(o) });
    interactions.add({ name: 'gather-pickup', intent: 'pickup', priority: 50, test: () => pickup.find(), run: t => pickup.run(t) });
    interactions.add({ name: 'gather-plant', intent: 'pickup', priority: 45, test: () => garden.holeInFront(), run: t => garden.plant(t) });
    interactions.add({ name: 'gather-tool', intent: 'action', priority: 10, test: () => kit.player.tool ?? null, run: tool => USE[tool]?.() });

    toolbelt.init();
    drops.restore();
    // world.daily 가 오늘 자리를 놓은 뒤 (game:ready · data:newday) 구덩이·물 준 꽃을 다시 그린다
    const resync = () => { work.syncHoles(); work.syncTwinkles(); };
    events.on('world:daily', resync);
    events.on('game:ready', resync);
    events.on('gather:garden', resync);

    G = { kit, fx, drops, results, trees, fishing, bugs, work, tickLock };
    // 확인·다른 트랙용 (계약 밖): 지금 낚시·곤충 상태, 강제로 놓기
    ctx.services.gather = {
      get busy() { return isBusy(); },
      drops, bugs, fishing, trees, work, toolbelt, results, garden,
      habitatAt: (x, z) => fishing.habitatAt(x, z),
      spawnBug: (id, place = 'flower', dist = 1.2) => { const f = kit.player.pointInFront(dist); return bugs.debugSpawn(id, place, f.x, f.z); },
    };
    console.info('[gather] 채집 준비됨');
  },

  update(dt) {
    if (!G) return;
    const paused = G.kit.paused();
    if (!paused) G.tickLock(dt);
    G.fx.update(dt);
    G.drops.update(dt);
    G.results.update(dt);
    G.trees.update(dt, paused);
    G.fishing.update(dt, paused);
    G.bugs.update(dt, paused);
    G.work.update(dt);
  },
};
