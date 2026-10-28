// 맨손 나무 흔들기 (Space · 우선순위 60): data.harvest.shakeTree → 열매·나뭇가지·도토리 주머니·가구 선물이 떨어지거나 벌떼.
// 열매를 따면 나무는 'picked' 모습이 되고, 사흘 뒤 world.daily 가 다시 열어 준다.
// 벌떼는 플레이어를 쫓아온다: 잠자리채로 휘둘러 잡으면 꿀벌, 따라잡히면 쏘인다 (달리면 따돌릴 수 있다).
import { rand } from './util.js';

const TREE_KINDS = new Set(['tree', 'fruit-tree', 'palm', 'cedar']);
const CANOPY = { tree: 1.05, 'fruit-tree': 1.05, palm: 1.75, cedar: 1.3 };
const BEE_SPEED = 3.2;        // 걷기 2.6 보다 빠르고 달리기 5 보다 느리다
const BEE_TIME = 11;          // 이만큼 쫓다가 돌아간다 (초)
const STING_R = 0.42;

export function createTrees(ctx, kit, { drops, fx, mk, bugModels, results, act, lock }) {
  const { THREE: T, scene } = ctx;

  function find() {
    const p = kit.player, world = kit.world;
    if (!p || !world || p.tool) return null;
    const f = p.pointInFront(0.55);
    const hits = world.objects.query(f.x, f.z, 0.62).filter(o => TREE_KINDS.has(o.kind) && Math.abs(o.y - p.position.y) < 0.5);
    return hits[0] ?? null;
  }

  function result(o) {
    const world = kit.world, data = kit.data, p = kit.player;
    if (!data?.harvest) return;
    const fruitSlug = o.data?.fruit ?? world.nativeFruit ?? 'apple';
    const orchard = world.places.orchard && Math.hypot(o.x - world.places.orchard.x, o.z - world.places.orchard.z) < 6;
    const r = data.harvest.shakeTree(o.id, o.kind, { fruit: `fruit.${fruitSlug}`, orchard, hour: Math.floor(kit.now().hour) });
    if (!r) return;
    if (r.event === 'bees') { bees.start(o); return; }
    const toward = Math.atan2(p.position.x - o.x, p.position.z - o.z);
    const top = { x: o.x, y: o.y + (CANOPY[o.kind] ?? 1), z: o.z };
    const isFruit = r.id.startsWith('fruit.');
    const pieces = isFruit ? r.count : 1;
    for (let i = 0; i < pieces; i++) {
      const spot = drops.findSpot(o.x, o.z, { rMin: 0.5, rMax: 0.95, toward });
      if (!spot) { results.gain(r.id, isFruit ? 1 : r.count); continue; }     // 내려놓을 데가 없으면 바로 챙긴다
      const from = { x: o.x + (spot.x - o.x) * 0.5, y: top.y + rand(-0.1, 0.15), z: o.z + (spot.z - o.z) * 0.5 };
      drops.drop(r.id, isFruit ? 1 : r.count, spot, { from, delay: 0.12 + i * 0.09, sound: i === 0 || i === pieces - 1 ? 'fruit-drop' : null });
    }
    if (isFruit) world.objects.setVariant(o.id, 'picked');
  }

  // ---------- 벌떼 ----------
  const bees = (() => {
    let swarm = null;      // { x, z, y, t, phase: 'out'|'chase'|'leave', models, hive, sfxT, vx, vz }
    const hiveGeo = mk.geometry('hive', () => [
      mk.part(mk.G.sphere(0.17, 10, 8), '#C99A5B', { p: [0, 0.18, 0], sc: [1, 1.2, 1] }),
      ...[0.08, 0.18, 0.28].map(y => mk.part(mk.G.torus(0.15 - Math.abs(y - 0.18) * 0.5, 0.022, 4, 14), '#A87A42', { p: [0, y, 0], r: [Math.PI / 2, 0, 0] })),
      mk.part(mk.G.sphere(0.045, 6, 4), '#3B3530', { p: [0, 0.12, 0.15] }),
    ]);
    function clear() {
      if (!swarm) return;
      for (const m of swarm.models) scene.remove(m.root);
      scene.remove(swarm.hive);
      swarm = null;
    }
    return {
      get active() { return !!swarm && swarm.phase !== 'leave'; },
      start(o) {
        clear();
        const hive = mk.mesh(hiveGeo, { outline: 0.004 });
        const spot = drops.findSpot(o.x, o.z, { rMin: 0.45, rMax: 0.7, toward: Math.atan2(kit.player.position.x - o.x, kit.player.position.z - o.z) }) ?? { x: o.x, z: o.z + 0.5 };
        const gy = kit.world.island.heightAt(spot.x, spot.z);
        hive.position.set(spot.x, o.y + (CANOPY[o.kind] ?? 1), spot.z);
        scene.add(hive);
        const models = [];
        for (let i = 0; i < 5; i++) {
          const m = bugModels.build('bug.honeybee');
          m.root.visible = false;
          m.phase = rand(0, Math.PI * 2);
          m.r = rand(0.15, 0.32);
          scene.add(m.root);
          models.push(m);
        }
        swarm = { x: spot.x, z: spot.z, gy, y: gy + 0.75, t: 0, phase: 'out', models, hive, hy0: hive.position.y, sfxT: 0 };
        kit.sfx('fruit-drop', { pitch: 0.7 });
        kit.toast('벌떼다! 잠자리채로 잡거나 달려서 도망치자', '🐝');
      },
      /** 잠자리채가 (x, z) 둘레 r 을 쓸었을 때 → 벌떼를 잡았으면 true */
      catchAt(x, z, r) {
        if (!swarm || swarm.phase === 'leave' || swarm.phase === 'out') return false;
        if (Math.hypot(swarm.x - x, swarm.z - z) > r + 0.35) return false;
        clear();
        return true;
      },
      /** 가까이 있나 (휘두를 때 겨냥) */
      near(x, z, r) { return !!swarm && swarm.phase === 'chase' && Math.hypot(swarm.x - x, swarm.z - z) < r; },
      get position() { return swarm ? { x: swarm.x, z: swarm.z, y: swarm.y } : null; },
      clear,
      update(dt, paused) {
        const s = swarm;
        if (!s || paused) return;
        s.t += dt;
        const p = kit.player;
        // 벌집이 떨어지고 → 벌이 나온다
        if (s.hive.position.y > s.gy) s.hive.position.y = Math.max(s.gy, s.hive.position.y - dt * 4.5);
        if (s.phase === 'out' && s.t > 0.55) { s.phase = 'chase'; for (const m of s.models) m.root.visible = true; }
        if (s.phase === 'chase') {
          const dx = p.position.x - s.x, dz = p.position.z - s.z, d = Math.hypot(dx, dz);
          const sp = BEE_SPEED * Math.min(1, s.t / 1.2);
          if (d > 1e-3) { s.x += (dx / d) * Math.min(d, sp * dt); s.z += (dz / d) * Math.min(d, sp * dt); }
          s.y += (p.position.y + 0.75 - s.y) * Math.min(1, dt * 3);
          s.sfxT -= dt;
          if (s.sfxT <= 0) { s.sfxT = 1.1; kit.sfx('bee', { volume: 0.7 }); }
          if (d < STING_R) {
            s.phase = 'leave';
            s.t = 0;
            kit.sfx('bee', { pitch: 1.3 });
            kit.toast('아야! 벌에 쏘였다…', '🐝');
            p.act('ouch');
            lock(1.0);
          } else if (s.t > BEE_TIME) { s.phase = 'leave'; s.t = 0; }
        } else if (s.phase === 'leave') {
          s.y += dt * 1.6;
          s.x += dt * 1.2; s.z -= dt * 1.5;
          if (s.t > 1.6) { clear(); return; }
        }
        for (const m of s.models) {
          const a = s.t * 7 + m.phase;
          m.root.position.set(s.x + Math.cos(a) * m.r, s.y + Math.sin(a * 1.7) * 0.08, s.z + Math.sin(a) * m.r);
          m.root.rotation.y = a + Math.PI;
          bugModels.flap(m, s.t + m.phase);
        }
      },
    };
  })();

  return {
    find,
    bees,
    async shake(o) {
      const p = kit.player;
      p.face(o.x, o.z);
      await act('shake', {
        onHit() {
          kit.world.objects.shake(o.id);
          kit.sfx('shake');
          fx.leaves({ x: o.x, y: o.y + (CANOPY[o.kind] ?? 1) - 0.1, z: o.z }, o.kind === 'cedar' ? '#4E8A4C' : o.kind === 'palm' ? '#4E9A4C' : '#6FAE4A', 4);
          result(o);
        },
      });
    },
    update(dt, paused) { bees.update(dt, paused); },
  };
}
