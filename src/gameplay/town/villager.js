// 주민 한 명의 하루: 집에서 나오기 → 자주 가는 곳을 오가며 쉬기 → 밤(또는 비)엔 문까지 걸어가 들어가기.
// 길은 path.js 의 칸 A*, 실제 걸음은 world.collide. 플레이어·다른 주민은 비켜 가고, 가까이 오면 쳐다본다.
import { createActor } from './actor.js';
import { shouldBeOut } from './rules.js';

const THINK = 0.5;            // 일과 확인 간격 (초)
const LOOK_DIST = 2.6;

export async function createVillager(ctx, person, town) {
  const actor = await createActor(ctx, person.slug);
  const house = town.houseOf(person.slug);
  const door = house?.door ?? town.fallbackSpot();
  const inside = { x: door.x, z: door.z - 0.75 };   // 문 안쪽 (사라지는 곳)
  const step = { x: door.x, z: door.z + 0.7 };      // 문 앞 한 걸음
  const r = Math.random;

  const V = {
    slug: person.slug, person, actor, house, door,
    mode: 'home', timer: 0, think: Math.random() * THINK, run: false, tries: 0,
    talkFrom: null, noticedAt: -99, clock: 0, emergeDelay: 0,

    get out() { return V.mode !== 'home'; },
    /** 말 걸 수 있는 상태인가 (문을 드나드는 중엔 안 됨) */
    get talkable() { return actor.visible && actor.opacity > 0.9 && V.mode !== 'home' && V.mode !== 'enter' && V.mode !== 'emerge'; },

    /** 처음 놓기: 밖에 있을 시각이면 자주 가는 곳 아무 데나, 아니면 집 안 */
    spawn(now, weather) {
      if (shouldBeOut(person, now, weather)) {
        const s = town.pickSpot(person, V) ?? step;
        actor.place(s.x, s.z, r() * Math.PI * 2);
        actor.setOpacity(1); actor.fadeTo = 1;
        idle(1 + r() * 4);
      } else toHome();
    },

    beginTalk() {
      if (V.mode === 'talk') return;
      V.talkFrom = V.mode;
      V.mode = 'talk';
      actor.speed = 0;
      actor.play('idle');
    },
    endTalk() {
      if (V.mode !== 'talk') return;
      const back = V.talkFrom;
      V.mode = back === 'walk' || back === 'toDoor' ? back : 'idle';
      if (V.mode === 'idle') V.timer = 1.5 + r() * 2;
      V.think = 0;
    },
    happy() { actor.playOnce('happy'); },

    update(dt, now, weather, animate) {
      V.clock += dt;
      if ((V.think -= dt) <= 0) { V.think = THINK; think(now, weather); }
      const pace = person.pace;
      const p = actor.position;
      const pl = ctx.services.player?.position;
      const pd = pl ? Math.hypot(pl.x - p.x, pl.z - p.z) : 99;

      switch (V.mode) {
        case 'home': break;
        case 'talk':
          if (pl) actor.lookAt(pl.x, pl.z);
          break;
        case 'idle':
          if (pl && pd < LOOK_DIST && actor.visible) {
            actor.lookAt(pl.x, pl.z);
            // 오랜만에 다가오면 반가워한다 (친할수록 자주)
            if (pd < 2 && V.clock - V.noticedAt > 40) {
              V.noticedAt = V.clock;
              if (r() < pace.happy * (1 + town.friendship(V.slug) / 50)) V.happy();
            }
          }
          if ((V.timer -= dt) <= 0) wander();
          actor.animateMove(0);
          break;
        case 'walk': case 'toDoor': case 'emerge': case 'enter': {
          const speed = V.run ? pace.run * (town.rainJoy(V) ? 1.1 : 1) : pace.walk;
          const res = actor.walk(dt, speed, (x, z, dx, dz) => town.avoid(V, x, z, dx, dz));
          actor.animateMove(actor.speed, V.run);
          if (res === 'arrived') arrived();
          else if (res === 'stuck') unstick();
          break;
        }
      }
      actor.update(dt, animate);
      if (V.mode === 'enter' && actor.opacity <= 0.01) toHome();
    },
  };

  function idle(t) {
    V.mode = 'idle';
    V.run = false;
    const [a, b] = person.pace.idle;
    V.timer = t ?? a + r() * (b - a);
    actor.path = [];
    if (r() < person.pace.happy * (town.rainJoy(V) ? 2.5 : 0.5)) V.happy();
  }

  function walkTo(spot, mode = 'walk') {
    const pts = town.route(actor.position, spot);
    if (!pts) return false;
    actor.setPath(pts);
    V.mode = mode;
    const far = pts.length > 4 || Math.hypot(spot.x - actor.position.x, spot.z - actor.position.z) > 9;
    V.run = mode === 'walk' && far && r() < person.pace.runChance * (town.rainJoy(V) ? 2 : 1);
    return true;
  }

  function wander() {
    for (let i = 0; i < 4; i++) {
      const s = town.pickSpot(person, V);
      if (s && walkTo(s)) return;
    }
    idle(2 + r() * 3);
  }

  function goHome() {
    V.tries = 0;
    if (!walkTo(step, 'toDoor')) {
      // 길이 막혔으면 그 자리에서 사라진다 (아침에 문 앞에서 다시 나온다)
      V.mode = 'enter';
      actor.path = [];
      actor.fade(0, 0.8);
    }
  }

  function toHome() {
    V.mode = 'home';
    V.run = false;
    actor.path = [];
    actor.place(inside.x, inside.z, Math.PI);
    actor.setOpacity(0); actor.fadeTo = 0;
    V.emergeDelay = 0.5 + r() * 6;
  }

  function emerge() {
    actor.place(inside.x, inside.z, Math.PI);
    actor.setOpacity(0.02);
    actor.fade(1, 0.7);
    actor.setPath([door, step]);
    V.mode = 'emerge';
    V.run = false;
    town.sfxAt('door', door, 0.5);
  }

  function arrived() {
    if (V.mode === 'toDoor') {
      V.mode = 'enter';
      actor.setPath([door, inside]);
      actor.fade(0, 0.9);
      town.sfxAt('door', door, 0.5);
    } else if (V.mode === 'emerge') idle(0.8 + r() * 1.5);
    else if (V.mode === 'enter') { /* 사라질 때까지 기다린다 */ }
    else idle();
  }

  function unstick() {
    actor.stuck = 0;
    if (V.mode === 'toDoor') { if (++V.tries > 3 || !walkTo(step, 'toDoor')) { V.mode = 'enter'; actor.path = []; actor.fade(0, 0.8); } return; }
    if (V.mode === 'emerge' || V.mode === 'enter') { actor.path = []; arrived(); return; }
    idle(1 + r() * 2);
  }

  function think(now, weather) {
    if (!now || V.mode === 'talk') return;
    const want = shouldBeOut(person, now, weather);
    if (want && V.mode === 'home') {
      if ((V.emergeDelay -= THINK) <= 0) emerge();
    } else if (!want && (V.mode === 'idle' || V.mode === 'walk')) goHome();
  }

  return V;
}
