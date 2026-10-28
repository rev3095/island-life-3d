// 낚시: 낚싯대를 들고 물가를 보며 Space → 찌를 던진다. 근처 물고기 그림자가 다가와 1~3번 톡톡(입질)하다가
// 덥석 물면 찌가 쑥 잠긴다 — 그 짧은 순간에 Space 를 누르면 잡는다. 너무 일찍 당기거나 늦으면 도망간다.
// 그림자는 강·연못·바다·선착장·하구 물에서 헤엄치고, 종류(=크기)는 data.spawns.fish 가 서식지·시각·달·날씨로 정한다.
import { rand, eul } from './util.js';

const MAX_FISH = 7;           // 플레이어 둘레 그림자 수
const NEAR = 13, FAR = 19;    // 이 안에 생기고, 이보다 멀어지면 사라진다
const NOTICE = 3.4;           // 찌를 알아채는 거리
const FLY = 0.42;             // 찌가 날아가는 시간
const CAST_DIST = [2.3, 2.0, 2.7, 1.7, 3.0, 1.4, 3.3];

export function createFishing(ctx, kit, { mk, fx, results, toolbelt, act }) {
  const { THREE: T, scene } = ctx;
  const group = new T.Group();
  group.name = 'gather-fish';
  scene.add(group);
  const fish = [];
  let spawnT = 0;

  // ---------- 물 자리 → 서식지 ----------
  const mouthCache = new Map();
  function habitatAt(x, z) {
    const world = kit.world;
    if (!world) return null;
    const isl = world.island;
    const { tx, tz } = isl.toTile(x, z);
    const tile = isl.tileAt(tx, tz);
    if (tx < 0 || tz < 0 || tx >= isl.w || tz >= isl.h) return null;
    if (isl.flagsAt?.(tx, tz)) return null;                     // 다리·선착장 밑
    if (tile === 'sea') {
      const d = world.places.dock;
      if (d && Math.abs(x - d.x) < 3.2 && z > d.z - 2 && z < d.z + 4.5) return 'pier';
      return 'sea';
    }
    if (tile !== 'water') return null;
    if (isl.levelAt(tx, tz) === 1) {
      const pond = world.places.pond;
      return pond && Math.hypot(x - pond.x, z - pond.z) < 3.4 ? 'pond' : 'river';
    }
    const key = tz * isl.w + tx;
    if (!mouthCache.has(key)) {
      let mouth = false;
      for (let dz = -3; dz <= 3 && !mouth; dz++) for (let dx = -3; dx <= 3 && !mouth; dx++) if (isl.tileAt(tx + dx, tz + dz) === 'sea') mouth = true;
      mouthCache.set(key, mouth);
    }
    return mouthCache.get(key) ? 'mouth' : 'river';
  }
  // 같은 물줄기로 치는 서식지 (하구↔강은 이어져 있다)
  const sameWater = (a, b) => a === b || (a === 'river' && b === 'mouth') || (a === 'mouth' && b === 'river') || (a === 'sea' && b === 'pier') || (a === 'pier' && b === 'sea');
  const waterY = (x, z) => kit.world.island.heightAt(x, z);
  // 물가에서 너무 붙지 않은 열린 물
  const open = (x, z, hab) => [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].every(([a, b]) => sameWater(habitatAt(x + a, z + b), hab));

  // ---------- 그림자 ----------
  function addFish(x, z, hab) {
    const { hour, month, weather } = kit.now();
    const id = kit.data?.spawns?.fish?.({ habitat: hab, hour: Math.floor(hour), month, weather, rng: Math.random });
    if (!id) return null;
    const size = kit.item(id)?.shadow ?? 2;
    const mesh = mk.fishShadow(size);
    mesh.frustumCulled = false;
    group.add(mesh);
    const f = { id, size, hab, x, z, heading: rand(0, Math.PI * 2), speed: rand(0.3, 0.55), target: null, mesh, state: 'swim', t: 0, life: 0, wait: rand(0.5, 2), len: mesh.userData.length };
    fish.push(f);
    return f;
  }
  function removeFish(f) {
    group.remove(f.mesh);
    const i = fish.indexOf(f);
    if (i >= 0) fish.splice(i, 1);
  }
  function spawnTick(dt) {
    spawnT -= dt;
    if (spawnT > 0) return;
    spawnT = 0.7;
    const p = kit.player.position;
    for (const f of [...fish]) if (Math.hypot(f.x - p.x, f.z - p.z) > FAR && f !== bob.fish) removeFish(f);
    if (fish.length >= (ctx.quality === 'low' ? 5 : MAX_FISH)) return;
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2), r = rand(3.5, NEAR);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      const hab = habitatAt(x, z);
      if (!hab || !open(x, z, hab)) continue;
      if (fish.some(f => Math.hypot(f.x - x, f.z - z) < 1.6)) continue;
      addFish(x, z, hab);
      return;
    }
  }
  function swim(f, dt) {
    f.wait -= dt;
    if (!f.target && f.wait <= 0) {
      for (let i = 0; i < 4 && !f.target; i++) {
        const a = f.heading + rand(-1.6, 1.6), r = rand(0.8, 2.2);
        const x = f.x + Math.sin(a) * r, z = f.z + Math.cos(a) * r;
        if (sameWater(habitatAt(x, z), f.hab) && sameWater(habitatAt((x + f.x) / 2, (z + f.z) / 2), f.hab) && open(x, z, f.hab)) f.target = { x, z };
      }
      if (!f.target) f.wait = 0.6;
    }
    if (f.target) {
      if (moveTo(f, f.target.x, f.target.z, f.speed, dt)) { f.target = null; f.wait = rand(0.6, 2.4); }
    }
  }
  /** 목표로 헤엄 → 도착하면 true */
  function moveTo(f, x, z, speed, dt, turn = 3) {
    const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz);
    if (d < 0.04) return true;
    const want = Math.atan2(dx, dz);
    let dh = Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading));
    f.heading += Math.sign(dh) * Math.min(Math.abs(dh), turn * dt);
    const go = Math.min(d, speed * dt * (Math.abs(dh) > 1.2 ? 0.3 : 1));
    f.x += Math.sin(f.heading) * go;
    f.z += Math.cos(f.heading) * go;
    return false;
  }
  function draw(f, dt) {
    f.t += dt;
    f.life += dt;
    const grow = Math.min(1, f.life / 0.8) * (f.state === 'flee' ? Math.max(0, 1 - f.t / 0.6) : 1);
    f.mesh.position.set(f.x, waterY(f.x, f.z) + 0.012, f.z);
    f.mesh.rotation.y = f.heading + Math.sin(f.t * 6) * 0.08;      // 꼬리 흔들기
    f.mesh.scale.setScalar(Math.max(0.001, grow));
  }

  // ---------- 찌 ----------
  const bobberMesh = mk.bobber();
  bobberMesh.visible = false;
  bobberMesh.frustumCulled = false;
  scene.add(bobberMesh);
  const LINE_N = 16;
  const lineGeo = new T.BufferGeometry();
  lineGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(LINE_N * 3), 3));
  const line = new T.Line(lineGeo, ctx.materials.toonMaterial('#F7F1E4', { flat: true, name: 'fishingLine' }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);
  const tip = new T.Vector3();

  // state: idle | fly | wait | back
  const bob = { state: 'idle', x: 0, z: 0, y: 0, t: 0, from: null, fish: null, dip: 0, look: 0, timer: 0, nibbles: 0, window: 0, hab: null, frozeIt: false };

  function castTarget() {
    const p = kit.player, isl = kit.world.island;
    const myLevel = isl.levelAt(...Object.values(isl.toTile(p.position.x, p.position.z)));
    for (const d of CAST_DIST) {
      const q = p.pointInFront(d);
      const hab = habitatAt(q.x, q.z);
      if (!hab) continue;
      const t = isl.toTile(q.x, q.z);
      if (isl.levelAt(t.tx, t.tz) !== myLevel) continue;          // 언덕 위 연못을 아래에서 던지지 않게
      return { ...q, hab };
    }
    return null;
  }
  const rodBobber = vis => { const m = kit.player.toolModel(); if (m?.userData.bobber) m.userData.bobber.visible = vis; };
  function setFrozen(v) {
    const p = kit.player;
    if (v && !p.frozen) { p.freeze(true); bob.frozeIt = true; }
    else if (!v && bob.frozeIt) { p.freeze(false); bob.frozeIt = false; }
  }
  function endFishing() {
    bob.state = 'idle';
    bob.fish = null;
    bob.window = 0; bob.dip = 0; bob.nibbles = 0;
    bobberMesh.visible = false;
    line.visible = false;
    rodBobber(true);
    kit.player.hold(null);
    setFrozen(false);
  }
  function scare(f, quiet = false) {
    if (!f) return;
    f.state = 'flee';
    f.t = 0;
    f.heading = Math.atan2(f.x - bob.x, f.z - bob.z);
    if (bob.fish === f) bob.fish = null;
    if (!quiet) fx.ripple({ x: f.x, y: waterY(f.x, f.z), z: f.z }, 0.4);
  }
  async function reel({ caught = null } = {}) {
    const p = kit.player;
    bob.state = 'back';
    bob.t = 0;
    bob.from = { x: bob.x, y: bob.y, z: bob.z };
    if (caught) {
      const at = { x: bob.x, y: bob.y, z: bob.z };
      fx.splash(at, true);
      kit.sfx('splash');
      removeFish(caught);
    } else kit.sfx('splash', { volume: 0.4, pitch: 1.3 });
    await act('reel', { speed: caught ? 1.2 : 1 });
    endFishing();
    if (caught) {
      kit.sfx('catch');
      const it = kit.item(caught.id);
      results.gain(caught.id, 1, { verb: '잡았다', show: true });
      if (it?.rare) kit.toast(`와, ${eul(it.name)} 낚다니!`, '✨');
      toolbelt.use('rod');
    }
  }

  async function cast() {
    const target = castTarget();
    if (!target) { kit.toast('물 쪽을 보고 던져 보자', '🎣'); return; }
    const p = kit.player;
    setFrozen(true);
    bob.state = 'cast';
    await act('cast', {
      onHit() {
        p.toolTip(tip);
        bob.state = 'fly';
        bob.t = 0;
        bob.from = { x: tip.x, y: tip.y, z: tip.z };
        bob.x = target.x; bob.z = target.z; bob.y = waterY(target.x, target.z);
        bob.hab = target.hab;
        bob.fish = null; bob.window = 0; bob.dip = 0; bob.nibbles = 0;
        rodBobber(false);
        bobberMesh.visible = true;
        line.visible = true;
        kit.sfx('cast');
      },
    });
    if (bob.state === 'cast') endFishing();      // 던지기 전에 끊겼으면
  }

  function updateBob(dt) {
    const p = kit.player;
    bob.t += dt;
    if (bob.state === 'fly') {
      const k = Math.min(1, bob.t / FLY);
      bobberMesh.position.set(bob.from.x + (bob.x - bob.from.x) * k, bob.from.y + (bob.y - bob.from.y) * k + Math.sin(k * Math.PI) * 0.9, bob.from.z + (bob.z - bob.from.z) * k);
      if (k >= 1) {
        bob.state = 'wait';
        bob.look = rand(0.4, 1.2);
        fx.ripple({ x: bob.x, y: bob.y, z: bob.z }, 0.45);
        kit.sfx('splash', { volume: 0.35, pitch: 1.4 });
      }
    } else if (bob.state === 'back') {
      p.toolTip(tip);
      const k = Math.min(1, bob.t / 0.25);
      bobberMesh.position.set(bob.from.x + (tip.x - bob.from.x) * k, bob.from.y + (tip.y - bob.from.y) * k + Math.sin(k * Math.PI) * 0.4, bob.from.z + (tip.z - bob.from.z) * k);
    } else if (bob.state === 'wait') {
      waitTick(dt);
      bob.dip = Math.max(0, bob.dip - dt * 0.6);
      const sink = bob.window > 0 ? 0.07 : 0;
      bobberMesh.position.set(bob.x, bob.y + 0.012 + Math.sin(bob.t * 2.6) * 0.008 - bob.dip * 0.2 - sink, bob.z);
      // 움직이려 하면 걷어 올린다
      if (Math.hypot(ctx.input.move.x, ctx.input.move.z) > 0.6) press();
    }
    if (line.visible) drawLine();
  }

  function waitTick(dt) {
    const f = bob.fish;
    if (!f) {
      bob.window = 0;
      bob.look -= dt;
      if (bob.look > 0) return;
      bob.look = 0.5;
      const cands = fish.filter(g => g.state === 'swim' && sameWater(g.hab, bob.hab) && Math.hypot(g.x - bob.x, g.z - bob.z) < NOTICE);
      cands.sort((a, b) => Math.hypot(a.x - bob.x, a.z - bob.z) - Math.hypot(b.x - bob.x, b.z - bob.z));
      if (cands[0] && Math.random() < 0.6) {
        bob.fish = cands[0];
        bob.fish.state = 'approach';
        bob.fish.target = null;
      }
      return;
    }
    // 입이 찌에 닿는 자리
    const ang = Math.atan2(bob.x - f.x, bob.z - f.z);
    const mx = bob.x - Math.sin(ang) * f.len * 0.48, mz = bob.z - Math.cos(ang) * f.len * 0.48;
    if (f.state === 'approach') {
      if (moveTo(f, mx, mz, 0.55, dt, 2.4) || Math.hypot(f.x - mx, f.z - mz) < 0.06) {
        f.state = 'nibble';
        bob.nibbles = 1 + Math.floor(Math.random() * 3);
        bob.timer = rand(0.5, 1.1);
      }
    } else if (f.state === 'nibble') {
      bob.timer -= dt;
      f.lunge = Math.max(0, (f.lunge ?? 0) - dt * 4);
      f.x = mx - Math.sin(ang) * (0.05 - f.lunge * 0.05); f.z = mz - Math.cos(ang) * (0.05 - f.lunge * 0.05);
      if (bob.window > 0) {
        bob.window -= dt;
        if (bob.window <= 0) {
          scare(f);
          kit.toast('놓쳐 버렸다… 물고기가 도망갔다', '💨');
          bob.look = rand(1, 2);
        }
      } else if (bob.timer <= 0) {
        f.lunge = 1;
        if (bob.nibbles > 0) {
          bob.nibbles--;
          bob.dip = 0.35;
          bob.timer = rand(0.8, 1.6);
          kit.sfx('nibble');
          fx.ripple({ x: bob.x, y: bob.y, z: bob.z }, 0.25, 0.5);
        } else {
          bob.dip = 0.6;
          bob.window = 0.75 - (f.size ?? 2) * 0.03;                // 큰 물고기일수록 조금 짧게
          kit.sfx('bite');
          fx.splash({ x: bob.x, y: bob.y, z: bob.z });
        }
      }
    }
  }

  function drawLine() {
    const p = kit.player;
    if (!p.toolTip(tip)) return;
    const a = tip, b = bobberMesh.position;
    const pos = lineGeo.attributes.position;
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const sag = bob.state === 'wait' ? (bob.window > 0 ? 0.05 : 0.18 + dist * 0.06) : 0.05;
    for (let i = 0; i < LINE_N; i++) {
      const k = i / (LINE_N - 1);
      pos.setXYZ(i, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * sag, a.z + (b.z - a.z) * k);
    }
    pos.needsUpdate = true;
  }

  /** 찌가 나가 있을 때 Space (또는 움직임) */
  function press() {
    if (bob.state !== 'wait') return;
    const f = bob.fish;
    if (f && bob.window > 0) { reel({ caught: f }); return; }
    if (f && f.state === 'nibble') { scare(f); kit.toast('너무 일찍 당겼다… 물고기가 도망갔다', '💨'); }
    else if (f) scare(f, true);
    reel();
  }

  return {
    habitatAt,
    /** 찌가 나가 있거나 던지는 중 */
    get active() { return bob.state !== 'idle'; },
    get fish() { return fish; },
    get bobber() { return bob; },
    cast, press,
    /** 낚싯대를 내려놓거나 끊겼을 때 */
    stop() { if (bob.state !== 'idle') { if (bob.fish) scare(bob.fish, true); endFishing(); } },
    update(dt, paused) {
      if (!kit.world || !kit.player || paused) return;
      spawnTick(dt);
      for (const f of [...fish]) {
        if (f.state === 'swim') swim(f, dt);
        else if (f.state === 'flee') {
          f.x += Math.sin(f.heading) * 2.4 * dt; f.z += Math.cos(f.heading) * 2.4 * dt;
          if (f.t > 0.6) { removeFish(f); continue; }
        } else if (f !== bob.fish) f.state = 'swim';
        draw(f, dt);
      }
      if (bob.state !== 'idle') updateBob(dt);
      // 낚싯대를 내려놓았으면 정리
      if (bob.state !== 'idle' && bob.state !== 'back' && kit.player.tool !== 'rod') this.stop();
    },
  };
}
