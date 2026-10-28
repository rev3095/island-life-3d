// 땅에 떨어진 물건: 나무 흔들기·바위·도끼에서 나온 과일·나뭇가지·재료·도토리 주머니·가구 선물. F 로 줍는다.
// state.island.drops = [{ item, count, x, z, rot }] 에 적어 두어 다시 불러와도 그 자리에 남는다.
import { TAU, angleDiff } from './util.js';

const FALL = 0.48, HOP = 0.2;     // 떨어지는 시간, 한 번 통 튀는 시간

export function createDrops(ctx, kit, mk, fx) {
  const { THREE: T, scene, state } = ctx;
  const group = new T.Group();
  group.name = 'gather-drops';
  scene.add(group);
  const list = [];
  const saved = () => (Array.isArray(state.island.drops) ? state.island.drops : (state.island.drops = []));
  const ground = (x, z) => kit.world?.island.heightAt(x, z) ?? 0;

  function make(rec) {
    const mesh = mk.item(rec.item);
    mesh.rotation.y = rec.rot ?? 0;
    group.add(mesh);
    const d = { rec, mesh, x: rec.x, z: rec.z, y: ground(rec.x, rec.z), fall: null };
    mesh.position.set(d.x, d.y, d.z);
    list.push(d);
    return d;
  }

  const api = {
    list,
    /** 떨어뜨리기. to = 내려앉을 곳 {x, z}, opts.from = 떨어지기 시작하는 곳 {x, y, z}, delay 초, sound 효과음 */
    drop(item, count, to, { from = null, delay = 0, sound = 'fruit-drop' } = {}) {
      const rec = { item, count, x: to.x, z: to.z, rot: Math.random() * TAU };
      saved().push(rec);
      const d = make(rec);
      if (from) {
        d.fall = { t: -delay, x0: from.x, y0: from.y, z0: from.z, sound, landed: false };
        d.mesh.position.set(from.x, from.y, from.z);
        d.mesh.visible = delay <= 0;
      }
      return d;
    },
    remove(d) {
      group.remove(d.mesh);
      const i = list.indexOf(d);
      if (i >= 0) list.splice(i, 1);
      const s = saved(), j = s.indexOf(d.rec);
      if (j >= 0) s.splice(j, 1);
    },
    /** 다 떨어진 것 중 (x, z) 에서 r 안 → 가까운 순 */
    near(x, z, r) {
      return list.filter(d => !d.fall && Math.hypot(d.x - x, d.z - z) <= r)
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    },
    /** (cx, cz) 둘레 rMin~rMax 에 내려놓을 빈 땅 찾기. toward = 먼저 볼 방향(라디안, atan2(dx, dz) 기준) */
    findSpot(cx, cz, { rMin = 0.55, rMax = 1.0, toward = null, gap = 0.24 } = {}) {
      const world = kit.world;
      if (!world) return null;
      const y0 = ground(cx, cz);
      const tries = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + Math.random() * 0.3;
        for (const r of [rMin + Math.random() * (rMax - rMin), (rMin + rMax) / 2]) tries.push({ a, r });
      }
      if (toward != null) tries.sort((p, q) => Math.abs(angleDiff(p.a, toward)) - Math.abs(angleDiff(q.a, toward)) + (Math.random() - 0.5) * 0.9);
      for (const { a, r } of tries) {
        const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
        if (!world.island.isWalkable(x, z) || world.island.isWater(x, z)) continue;
        if (Math.abs(ground(x, z) - y0) > 0.3) continue;
        if (list.some(d => Math.hypot(d.x - x, d.z - z) < gap)) continue;
        return { x, z };
      }
      return null;
    },
    /** 저장된 것 다시 놓기 (처음 한 번) */
    restore() {
      for (const rec of saved().slice()) {
        if (!rec || !kit.item(rec.item) || !Number.isFinite(rec.x) || !Number.isFinite(rec.z) || !(rec.count > 0)) { saved().splice(saved().indexOf(rec), 1); continue; }
        make(rec);
      }
    },
    update(dt) {
      for (const d of list) {
        const f = d.fall;
        if (!f) continue;
        f.t += dt;
        if (f.t < 0) continue;
        d.mesh.visible = true;
        if (f.t < FALL) {
          const k = f.t / FALL;
          d.mesh.position.set(f.x0 + (d.x - f.x0) * k, f.y0 + (d.y - f.y0) * k * k, f.z0 + (d.z - f.z0) * k);
        } else {
          if (!f.landed) {
            f.landed = true;
            if (f.sound) kit.sfx(f.sound, { volume: 0.8, pitch: 0.9 + Math.random() * 0.2 });
            fx.dust({ x: d.x, y: d.y, z: d.z }, 3);
          }
          const h = f.t - FALL;
          d.mesh.position.set(d.x, d.y + Math.sin(Math.min(1, h / HOP) * Math.PI) * 0.07, d.z);
          if (h >= HOP) { d.mesh.position.y = d.y; d.fall = null; }
        }
      }
    },
  };
  return api;
}
