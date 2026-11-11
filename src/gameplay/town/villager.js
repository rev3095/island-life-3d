// 주민 한 명의 하루: 집에서 나오기 → 자주 가는 곳을 오가며 쉬기 → 밤(또는 비)엔 문까지 걸어가 들어가기.
// 길은 path.js 의 칸 A*, 실제 걸음은 world.collide. 플레이어·다른 주민은 비켜 가고, 가까이 오면 쳐다본다.
// 10차 M10-P1: 섬에 놓은 벤치·피크닉 탁자·통나무 의자(decor.hangouts → seat)에 가면 실제로 앉는다 (mode 'sit': sit_down → sit → stand_up, 자리 맡기 ctx.services.seats).
// 5차: 생일엔 하루 종일 집에 있고(town.staysIn), 플레이어가 그 집 방에 들어오면(house:enter) 방 안에 서 있다 (mode 'room').
import { createActor } from './actor.js';
import { shouldBeOut } from './rules.js';
import { sitRoot } from '../decor/seats.js';   // 10차 앉기: 엉덩이 닿는 곳 → 뿌리 자리

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
    partner: null, bubble: null, chatAt: -99,   // 주민끼리 수다: 상대, 지금 말풍선 글자
    seat: null, seatGoal: null, sitAnim: null,  // 10차 앉기: 앉은 자리 · 가는 중인 자리 · 내려앉기/일어나기 진행

    get out() { return V.mode !== 'home'; },
    get inRoom() { return V.mode === 'room' || (V.mode === 'talk' && V.talkFrom === 'room'); },
    /** 말 걸 수 있는 상태인가 (문을 드나드는 중엔 안 됨) */
    get talkable() { return actor.visible && actor.opacity > 0.9 && V.mode !== 'home' && V.mode !== 'enter' && V.mode !== 'emerge'; },

    /** 처음 놓기: 밖에 있을 시각이면 자주 가는 곳 아무 데나, 아니면 집 안 */
    spawn(now, weather) {
      if (outNow(now, weather)) {
        const s = town.pickSpot(person, V) ?? step;
        actor.place(s.x, s.z, r() * Math.PI * 2);
        actor.setOpacity(1); actor.fadeTo = 1;
        idle(1 + r() * 4);
      } else toHome();
    },

    beginTalk() {
      if (V.mode === 'talk') return;
      V.talkFrom = V.mode;
      if (V.mode === 'sit') { V.mode = 'talk'; actor.speed = 0; return; }   // 앉은 채로 말한다 (자세 그대로)
      V.chatWith = V.mode === 'chat' ? V.partner : null;   // 수다 떨던 상대 (인사에 쓴다)
      V.partner = null;
      V.bubble = null;
      V.mode = 'talk';
      actor.speed = 0;
      actor.play('idle');
    },
    endTalk() {
      if (V.mode !== 'talk') return;
      const back = V.talkFrom;
      // 집 안(문 너머·방)에서 말했으면 그대로 집 안에
      V.mode = back === 'walk' || back === 'toDoor' || back === 'home' || back === 'room' || (back === 'sit' && V.seat) ? back : 'idle';
      if (V.mode === 'idle') V.timer = 1.5 + r() * 2;
      V.think = 0;
    },
    happy() { actor.playOnce('happy'); },
    /** 플레이어가 이 주민 방에 들어왔다: 방 안 spot 에 세운다 (집에 있을 때만) → 세웠으면 true */
    enterRoom(spot, facing = Math.PI) {
      if (V.mode !== 'home' && V.mode !== 'room') return false;
      V.mode = 'room';
      V.partner = null; V.bubble = null;
      actor.path = [];
      actor.place(spot.x, spot.z, facing);
      actor.setOpacity(1); actor.fadeTo = 1;
      return true;
    },
    /** 플레이어가 방에서 나갔다: 다시 보이지 않는 집 안으로 */
    leaveRoom() { if (V.inRoom) toHome(); },
    /** 다른 주민과 수다 시작 (index.js 가 짝을 지어 준다) */
    startChat(other, seconds) {
      V.mode = 'chat';
      V.partner = other;
      V.timer = seconds;
      V.chatAt = V.clock;
      actor.path = [];
      actor.lookAt(other.actor.position.x, other.actor.position.z);
    },
    stopChat() {
      if (V.mode !== 'chat') return;
      V.partner = null;
      V.bubble = null;
      idle(1 + r() * 2.5);
    },

    update(dt, now, weather, animate) {
      V.clock += dt;
      if ((V.think -= dt) <= 0) { V.think = THINK; think(now, weather); }
      const pace = person.pace;
      const p = actor.position;
      const pl = ctx.services.player?.position;
      const pd = pl ? Math.hypot(pl.x - p.x, pl.z - p.z) : 99;
      // 앉은 자리를 떠났는데(집에 숨기·방·순간이동) 자리가 남아 있으면 놓아준다
      if (V.seat && V.mode !== 'sit' && !(V.mode === 'talk' && V.talkFrom === 'sit')) leaveSeat();

      switch (V.mode) {
        case 'home': break;
        case 'room':
          if (pl && pd < LOOK_DIST * 1.5) actor.lookAt(pl.x, pl.z);
          actor.animateMove(0);
          break;
        case 'talk':
          if (pl && !V.seat) actor.lookAt(pl.x, pl.z);
          break;
        case 'sit': sitStep(dt); break;
        case 'chat': {
          const o = V.partner;
          if (!o || o.mode !== 'chat' || o.partner !== V) { V.stopChat(); break; }
          actor.lookAt(o.actor.position.x, o.actor.position.z);
          actor.animateMove(0);
          if ((V.timer -= dt) <= 0) { if (r() < 0.5) V.happy(); V.stopChat(); }
          break;
        }
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
          const speed = V.run ? pace.run * (town.joy(V) ? 1.1 : 1) : pace.walk;
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
    if (r() < person.pace.happy * (town.joy(V) ? 2.5 : 0.5)) V.happy();
  }

  function walkTo(spot, mode = 'walk') {
    const pts = town.route(actor.position, spot);
    if (!pts) return false;
    V.seatGoal = mode === 'walk' ? spot.seat ?? null : null;
    actor.setPath(pts);
    V.mode = mode;
    const far = pts.length > 4 || Math.hypot(spot.x - actor.position.x, spot.z - actor.position.z) > 9;
    V.run = mode === 'walk' && far && r() < person.pace.runChance * (town.joy(V) ? 2 : 1);
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
    else if (V.seatGoal) trySit();
    else idle();
  }

  // ── 10차 앉기 ──
  const ease = t => t * t * (3 - 2 * t);
  /** 자리 앞에 왔다: 빈 자리면 맡고 돌아 앉는다 (sit 클립이 없거나 누가 앉았으면 그냥 앞에 서 있기) */
  function trySit() {
    const seat = V.seatGoal, seats = ctx.services.seats;
    V.seatGoal = null;
    if (!seat || !actor.hasClip('sit') || !seats?.claim(seat.key, V.slug)) { idle(); return; }
    const p = actor.position;
    V.seat = seat; V.mode = 'sit'; V.run = false;
    actor.path = [];
    actor.pinned = true;
    actor.wantFacing = seat.facing;
    V.sitAnim = { phase: 'down', t: 0, from: { x: p.x, y: p.y, z: p.z }, to: sitRoot(seat, actor.sit), dur: Math.min(0.45, (actor.clipSeconds('sit_down') || 0.5) * 0.8) };
    if (actor.hasClip('sit_down')) actor.playOnce('sit_down', 'sit'); else actor.play('sit');
    const [a, b] = person.pace.idle;
    V.timer = Math.max(8, (a + b) * 1.2) + r() * 12;   // 서 있기보다 조금 오래
  }
  function sitStep(dt) {
    const A = V.sitAnim, p = actor.position;
    if (!A) { idle(); return; }
    A.t += dt;
    const k = ease(Math.min(1, A.t / Math.max(0.05, A.dur)));
    if (A.phase === 'down' || A.phase === 'sit') {
      p.set(A.from.x + (A.to.x - A.from.x) * k, A.from.y + (A.to.y - A.from.y) * k, A.from.z + (A.to.z - A.from.z) * k);
      if (A.phase === 'down' && k >= 1) A.phase = 'sit';
      if (A.phase === 'sit' && (V.timer -= dt) <= 0) standUp();
    } else if (A.phase === 'up') {
      const g = V.seat.stand, gy = ctx.services.world?.island.heightAt(g.x, g.z) ?? A.from.y;
      p.set(A.from.x + (g.x - A.from.x) * k, A.from.y + (gy - A.from.y) * k, A.from.z + (g.z - A.from.z) * k);
      if (k >= 1 && (!actor.oneShot || A.t > A.dur + 0.6)) { const then = A.then; leaveSeat(); (then ?? (() => idle(1 + r() * 2)))(); }
    }
  }
  /** 일어나기 (then = 다 일어난 뒤 할 일, 기본 잠깐 서 있기) */
  function standUp(then = null) {
    const A = V.sitAnim, p = actor.position;
    if (!V.seat || !A) { then?.(); return; }
    if (A.phase === 'up') { if (then) A.then = then; return; }
    Object.assign(A, { phase: 'up', t: 0, from: { x: p.x, y: p.y, z: p.z }, then, dur: Math.min(0.4, (actor.clipSeconds('stand_up') || 0.5) * 0.8) });
    if (actor.hasClip('stand_up')) actor.playOnce('stand_up', 'idle'); else actor.play('idle');
  }
  /** 자리를 놓아주고 땅으로 (뿌리 붙들기 끝) */
  function leaveSeat() {
    if (V.seat) ctx.services.seats?.release(V.seat.key, V.slug);
    V.seat = null; V.sitAnim = null;
    actor.pinned = false;
  }
  V.standUp = then => standUp(then);
  /** 점검용: 그 자리로 걸어가기 (spot.seat 가 있으면 도착해서 앉는다) → 길이 있으면 true */
  V.goTo = spot => (V.mode === 'idle' || V.mode === 'walk' ? walkTo(spot) : false);

  function unstick() {
    actor.stuck = 0;
    if (V.mode === 'toDoor') { if (++V.tries > 3 || !walkTo(step, 'toDoor')) { V.mode = 'enter'; actor.path = []; actor.fade(0, 0.8); } return; }
    if (V.mode === 'emerge' || V.mode === 'enter') { actor.path = []; arrived(); return; }
    idle(1 + r() * 2);
  }

  /** 지금 밖에 있어야 하나 (일과·날씨 + 생일엔 집에) */
  function outNow(now, weather) { return shouldBeOut(person, now, weather, { noBreak: !!town.hostBusy?.(person.slug) }) && !town.staysIn?.(V); }

  function think(now, weather) {
    if (!now || V.mode === 'talk' || V.mode === 'room') return;
    const want = outNow(now, weather);
    if (want && V.mode === 'home') {
      if ((V.emergeDelay -= THINK) <= 0) emerge();
    } else if (want && V.mode === 'toDoor') {
      idle(1 + r() * 2);   // 집에 가던 길인데 다시 밖에 있을 시각 (시계를 돌렸을 때)
    } else if (!want && (V.mode === 'idle' || V.mode === 'walk' || V.mode === 'chat')) { V.partner = null; V.bubble = null; goHome(); }
    else if (!want && V.mode === 'sit') standUp(() => goHome());   // 집에 갈 시각이면 일어나서
  }

  return V;
}
