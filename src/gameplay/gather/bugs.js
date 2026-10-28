// 곤충: 지금 시각·달·날씨에 맞는 곤충이 꽃·나무·풀밭·바위·물가·가로등 둘레에 나온다 (무엇이 나올지는 data.spawns.bug).
// 나는 곤충은 날아다니고, 앉아 있는 곤충은 꽃 위·나무 줄기·바위에 붙어 있다. 달려서 가까이 가면 도망간다.
// 잠자리채를 휘두르면 앞에 있는 곤충을 잡는다 (빗나가면 둘레 곤충이 놀라 달아난다).
import { rand, pickOne } from './util.js';

const MAX_BUGS = 7, MAX_BUGS_LOW = 5;
const RING = [4.5, 14];       // 플레이어에게서 이 거리 사이에 생긴다 (바로 눈앞에 툭 나타나지 않게)
const FAR = 20;
const SCARE_RUN = 3.0;        // 달려오면 이 거리에서 도망
const SCARE_NEAR = 0.5;       // 이만큼 붙으면 걸어도 도망
const FLOWERS = new Set(['tulip', 'cosmos', 'pansy', 'bush']);
const TREES = new Set(['tree', 'cedar', 'fruit-tree']);

export function createBugs(ctx, kit, { bugModels, drops }) {
  const { scene } = ctx;
  const bugs = [];
  let spawnT = 1;

  const ground = (x, z) => kit.world.island.heightAt(x, z);
  const isl = () => kit.world.island;

  // ---------- 나올 자리 고르기 ----------
  function ringOk(x, z) {
    const p = kit.player.position, d = Math.hypot(x - p.x, z - p.z);
    return d >= RING[0] && d <= RING[1];
  }
  function objectAnchor(test) {
    const p = kit.player.position;
    const list = kit.world.objects.query(p.x, p.z, RING[1]).filter(o => test(o) && o.dist >= RING[0] && !bugs.some(b => b.objId === o.id));
    return list.length ? pickOne(list) : null;
  }
  function tileAnchor(test) {
    const p = kit.player.position;
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2), r = rand(...RING);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      const { tx, tz } = isl().toTile(x, z);
      if (test(tx, tz, x, z)) return { x, z, tx, tz };
    }
    return null;
  }
  const nearWater = (tx, tz) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isl().tileAt(tx + a, tz + b) === 'water');

  function choosePlace(night) {
    const table = [['flower', 3], ['tree', 2], ['ground', 2], ['air', 1.2], ['water', 1.4], ['rock', 0.8], ['palm', 0.6]];
    if (night > 0.3) table.push(['lamp', 2]);
    if (drops.list.some(d => kit.item(d.rec.item)?.category === 'fruit')) table.push(['fruit', 1]);
    let r = Math.random() * table.reduce((s, [, w]) => s + w, 0);
    for (const [p, w] of table) { if ((r -= w) < 0) return p; }
    return 'flower';
  }

  function trySpawn() {
    const now = kit.now();
    const place = choosePlace(now.night);
    let anchor = null, obj = null;
    if (place === 'flower') obj = objectAnchor(o => FLOWERS.has(o.kind));
    else if (place === 'tree') obj = objectAnchor(o => TREES.has(o.kind));
    else if (place === 'palm') obj = objectAnchor(o => o.kind === 'palm');
    else if (place === 'rock') obj = objectAnchor(o => o.kind === 'rock');
    else if (place === 'lamp') obj = objectAnchor(o => o.kind === 'lamp');
    else if (place === 'fruit') {
      const d = drops.list.find(dd => kit.item(dd.rec.item)?.category === 'fruit' && ringOk(dd.x, dd.z) && !bugs.some(b => b.drop === dd));
      if (d) anchor = { x: d.x, z: d.z, y: d.y, drop: d };
    } else if (place === 'ground') anchor = tileAnchor((tx, tz, x, z) => isl().tileAt(tx, tz) === 'grass' && isl().isWalkable(x, z));
    else if (place === 'air') anchor = tileAnchor((tx, tz) => ['grass', 'sand', 'path'].includes(isl().tileAt(tx, tz)));
    else if (place === 'water') anchor = tileAnchor((tx, tz) => isl().tileAt(tx, tz) === 'water' || (isl().tileAt(tx, tz) !== 'sea' && nearWater(tx, tz)));
    if (obj) anchor = { x: obj.x, z: obj.z, y: obj.y, obj };
    if (!anchor) return;
    const id = kit.data?.spawns?.bug?.({ place, hour: Math.floor(now.hour), month: now.month, weather: now.weather, rng: Math.random });
    if (!id) return;
    add(id, place, anchor);
  }

  function add(id, place, a) {
    const item = kit.item(id);
    const model = bugModels.build(id);
    model.root.traverse(o => { o.frustumCulled = false; });
    scene.add(model.root);
    const slug = id.split('.')[1];
    const gy = a.y ?? ground(a.x, a.z);
    const b = { id, item, model, place, objId: a.obj?.id ?? null, drop: a.drop ?? null, ax: a.x, az: a.z, ay: gy, x: a.x, y: gy, z: a.z, heading: rand(0, Math.PI * 2), t: rand(0, 10), age: 0, state: 'idle', mode: 'sit', timer: rand(0.5, 2), target: null, pitch: 0 };
    if (item?.flying) {
      b.mode = slug.includes('dragonfly') || slug === 'skimmer' ? 'dart' : slug === 'firefly' ? 'float' : 'flutter';
      b.y = gy + (place === 'lamp' ? 1.75 : b.mode === 'dart' ? 1.0 : 0.55);
      if (place === 'water' && isl().isWater(a.x, a.z)) b.y = gy + 0.5;
    } else if (place === 'tree' || place === 'palm') {
      // 줄기에 붙어 머리를 위로
      const ang = Math.atan2(kit.player.position.x - a.x, kit.player.position.z - a.z) + rand(-1.4, 1.4);
      const r = place === 'palm' ? 0.24 : 0.3;
      b.mode = 'trunk';
      b.x = a.x + Math.sin(ang) * r; b.z = a.z + Math.cos(ang) * r; b.y = gy + rand(0.45, 0.7);
      b.heading = ang + Math.PI; b.pitch = -Math.PI / 2;      // 머리는 위, 등은 바깥쪽
    } else if (place === 'flower') {
      b.mode = 'perch';
      const top = a.obj?.kind === 'bush' ? 0.72 : a.obj?.kind === 'pansy' ? 0.22 : 0.5;
      b.y = gy + top;
      if (a.obj?.kind === 'bush') { b.x += rand(-0.25, 0.25); b.z += rand(-0.2, 0.2); }
    } else if (place === 'rock') {
      b.mode = 'sit';
      if (slug === 'snail') b.y = gy + 0.5;
      else { const ang = rand(0, Math.PI * 2); b.x = a.x + Math.sin(ang) * 0.5; b.z = a.z + Math.cos(ang) * 0.5; b.y = ground(b.x, b.z); }
    } else if (place === 'water' && slug === 'pond-skater') {
      b.mode = 'skate';
      const w = findWater(a.x, a.z);
      if (w) { b.x = b.ax = w.x; b.z = b.az = w.z; }
      b.y = ground(b.x, b.z) + 0.01;
    } else if (place === 'fruit') {
      b.mode = 'crawl';
      b.y = gy + 0.02;
    } else {
      b.mode = 'hop';
      b.y = gy;
    }
    place3(b);
    bugs.push(b);
    return b;
  }
  function findWater(x, z) {
    for (let r = 0; r <= 2; r += 0.5) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      const { tx, tz } = isl().toTile(px, pz);
      if (isl().tileAt(tx, tz) === 'water' && !isl().flagsAt?.(tx, tz)) return { x: px, z: pz };
    }
    return null;
  }

  function remove(b) {
    scene.remove(b.model.root);
    const i = bugs.indexOf(b);
    if (i >= 0) bugs.splice(i, 1);
  }
  function place3(b) {
    const r = b.model.root;
    r.position.set(b.x, b.y, b.z);
    r.rotation.set(b.pitch, b.heading, 0, 'YXZ');
  }

  // ---------- 움직임 ----------
  function wander(b, dt, { radius, speed, yBase, yAmp, hover = false }) {
    b.timer -= dt;
    if (!b.target || b.timer <= 0) {
      const a = rand(0, Math.PI * 2), r = rand(0.2, radius);
      b.target = { x: b.ax + Math.sin(a) * r, z: b.az + Math.cos(a) * r, y: yBase + rand(-yAmp, yAmp) };
      b.timer = hover ? rand(1, 2.6) : rand(1.5, 3.5);
    }
    const dx = b.target.x - b.x, dz = b.target.z - b.z, dy = b.target.y - b.y, d = Math.hypot(dx, dz, dy);
    if (d > 0.02) {
      const go = Math.min(d, speed * dt);
      b.x += (dx / d) * go; b.z += (dz / d) * go; b.y += (dy / d) * go;
      const want = Math.atan2(dx, dz);
      b.heading += Math.atan2(Math.sin(want - b.heading), Math.cos(want - b.heading)) * Math.min(1, dt * 6);
    }
  }

  function step(b, dt) {
    b.t += dt;
    b.age += dt;
    const gy = b.ay;
    if (b.state === 'flee') {
      b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
      if (!b.item?.flying && b.mode !== 'trunk') b.vy -= 9 * dt;
      if (b.y < ground(b.x, b.z) && b.vy < 0) { b.y = ground(b.x, b.z); b.vy = 2.5; }
      b.model.root.scale.setScalar(Math.max(0.01, 1 - b.ft / 1.2));
      b.ft += dt;
      bugModels.flap(b.model, b.t, 1.6);
      place3(b);
      return b.ft < 1.2;
    }
    switch (b.mode) {
      case 'flutter': wander(b, dt, { radius: b.place === 'lamp' ? 0.55 : 1.4, speed: 0.7, yBase: gy + (b.place === 'lamp' ? 1.75 : 0.55), yAmp: 0.18 }); b.y += Math.sin(b.t * 9) * 0.004; break;
      case 'dart': {
        b.timer -= dt;
        if (b.timer <= 0) { const a = rand(0, Math.PI * 2), r = rand(0.5, 2); b.target = { x: b.ax + Math.sin(a) * r, z: b.az + Math.cos(a) * r, y: gy + rand(0.85, 1.3) }; b.timer = rand(1.2, 3); }
        if (b.target) {
          const dx = b.target.x - b.x, dz = b.target.z - b.z, dy = b.target.y - b.y, d = Math.hypot(dx, dz, dy);
          if (d > 0.02) { const go = Math.min(d, 3 * dt); b.x += (dx / d) * go; b.z += (dz / d) * go; b.y += (dy / d) * go; b.heading = Math.atan2(dx, dz); }
        }
        b.y += Math.sin(b.t * 5) * 0.002;
        break;
      }
      case 'float': {
        wander(b, dt, { radius: 1.2, speed: 0.35, yBase: gy + 0.6, yAmp: 0.25 });
        const g = b.model.glow;
        if (g) { const on = 0.35 + 0.65 * Math.max(0, Math.sin(b.t * 2.4)); g.material.color.setRGB(0.55 + 0.4 * on, 0.6 + 0.37 * on, 0.25 + 0.2 * on); }
        break;
      }
      case 'hop': {
        b.timer -= dt;
        if (b.hop) {
          b.hop.t += dt;
          const k = Math.min(1, b.hop.t / 0.35);
          b.x = b.hop.x0 + (b.hop.x1 - b.hop.x0) * k; b.z = b.hop.z0 + (b.hop.z1 - b.hop.z0) * k;
          b.y = ground(b.x, b.z) + Math.sin(k * Math.PI) * 0.22;
          if (k >= 1) b.hop = null;
        } else if (b.timer <= 0) {
          b.timer = rand(1.2, 3.5);
          const a = rand(0, Math.PI * 2), r = rand(0.3, 0.8);
          const x1 = b.ax + Math.sin(a) * r, z1 = b.az + Math.cos(a) * r;
          if (isl().isWalkable(x1, z1)) { b.hop = { t: 0, x0: b.x, z0: b.z, x1, z1 }; b.heading = Math.atan2(x1 - b.x, z1 - b.z); }
        }
        break;
      }
      case 'skate': {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.timer = rand(0.8, 2.2);
          const a = rand(0, Math.PI * 2), r = rand(0.2, 0.9), x1 = b.ax + Math.sin(a) * r, z1 = b.az + Math.cos(a) * r;
          if (isl().tileAt(...Object.values(isl().toTile(x1, z1))) === 'water') b.target = { x: x1, z: z1 };
        }
        if (b.target) {
          const dx = b.target.x - b.x, dz = b.target.z - b.z, d = Math.hypot(dx, dz);
          if (d > 0.02) { const go = Math.min(d, 0.9 * dt); b.x += (dx / d) * go; b.z += (dz / d) * go; b.heading = Math.atan2(dx, dz); }
        }
        b.y = ground(b.x, b.z) + 0.01;
        break;
      }
      case 'crawl': {
        const a = b.t * 0.8;
        b.x = b.ax + Math.sin(a) * 0.13; b.z = b.az + Math.cos(a) * 0.13; b.heading = a + Math.PI / 2;
        if (b.drop && !drops.list.includes(b.drop)) return false;    // 과일을 주웠으면 개미도 간다
        break;
      }
      default: break;     // perch · trunk · sit
    }
    bugModels.flap(b.model, b.t, b.mode === 'perch' ? 0.3 : 1);
    place3(b);
    return true;
  }

  function scare(b) {
    if (b.state === 'flee') return;
    const p = kit.player.position;
    const a = Math.atan2(b.x - p.x, b.z - p.z) + rand(-0.4, 0.4);
    const fly = b.item?.flying || b.mode === 'perch' || b.mode === 'trunk';
    const sp = fly ? 3.2 : 2.2;
    b.state = 'flee';
    b.ft = 0;
    b.vx = Math.sin(a) * sp; b.vz = Math.cos(a) * sp; b.vy = fly ? 1.8 : 2.4;
    b.heading = a; b.pitch = 0;
  }

  return {
    bugs,
    /** 잠자리채가 쓸고 지나간 곳 (x, z) 둘레에서 잡을 곤충 */
    catchAt(x, z, r, py) {
      let best = null, bd = Infinity;
      for (const b of bugs) {
        if (b.state === 'flee') continue;
        const d = Math.hypot(b.x - x, b.z - z);
        if (d > r || b.y - py > 2.1) continue;
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    },
    take(b) { remove(b); return b.id; },
    /** 빗나간 잠자리채: 둘레 곤충이 놀란다 */
    startle(x, z, r) { for (const b of bugs) if (Math.hypot(b.x - x, b.z - z) < r) scare(b); },
    nearest(x, z, r) { return bugs.filter(b => b.state !== 'flee' && Math.hypot(b.x - x, b.z - z) < r).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] ?? null; },
    /** 확인용: 곤충 하나 바로 놓기 */
    debugSpawn(id, place, x, z) { return add(id, place, { x, z, y: ground(x, z) }); },
    clear() { for (const b of [...bugs]) remove(b); },
    update(dt, paused) {
      if (!kit.world || !kit.player || paused) return;
      const p = kit.player.position, speed = kit.player.speed ?? 0;
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = 1.1;
        if (bugs.length < (ctx.quality === 'low' ? MAX_BUGS_LOW : MAX_BUGS)) trySpawn();
      }
      for (const b of [...bugs]) {
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        if (d > FAR || (b.age > 150 && d > 9)) { remove(b); continue; }
        if (b.state !== 'flee' && ((speed > 3.6 && d < SCARE_RUN) || d < SCARE_NEAR)) scare(b);
        if (!step(b, dt)) remove(b);
      }
    },
  };
}
