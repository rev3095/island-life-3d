// M15 저녁 광장 노래: 저녁(18–20시)에 가끔 (날마다 정해진 확률 BOND.song.chance) 밖에 있는 주민 둘이 광장에 모여 번갈아 노래한다.
// 소리는 주민 목소리 합성(audio.speak — 「라라~」 가사, '~' 는 끝을 올려 늘인다)을 다시 쓰고, 머리 위에 🎵 가사 말풍선.
// 처음 듣는 노래(첫 노래 = 초롱·모찌, BOND.song.first)에 다가가면 town:song {first, x, z} → 장면 s26 (트리거 song-first).
// 끝까지 들으면 두 주민 친밀도 +1, 사진 한 장(추억 앨범). 기록 state.town.song = { day, pair, heard }, 첫 노래 state.town.songFirst.
import { BOND, songPlan, songPair, songTime } from './bond.js';
import { villagerState, addFriendship, pickLines, shouldBeOut } from './rules.js';
import { context, speaker } from './talk.js';

const CHECK = 2;          // 시작할지 보는 간격 (초)
const GATHER_MAX = 30;    // 모이는 데 이보다 오래 걸리면 그 자리로 옮긴다
const LISTEN = 6;         // 이 거리 안이 「듣는 중」

export function createSong(ctx, { town, lines, villagers, companion }) {
  const S = () => ctx.services;
  const st = () => (ctx.state.town ||= {});
  let A = null, check = 0, planKey = null, plan = null;

  const todayPlan = () => {
    const key = context(ctx).dayKey;
    if (key !== planKey) { planKey = key; plan = songPlan(key); }
    return plan;
  };

  /** 광장 둘레에 1.6칸 떨어진 두 자리 (모닥불·행사 자리 비켜서) */
  function spots() {
    const world = S().world, isl = world.island, base = world.places.plaza ?? world.places.festival;
    if (!base) return null;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, r = 3.4 + (i % 3) * 0.6;
      const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r;
      const ox = -Math.sin(a) * 0.8, oz = Math.cos(a) * 0.8;   // 둥근 둘레를 따라 옆으로
      const p = [{ x: x - ox, z: z - oz }, { x: x + ox, z: z + oz }];
      if (p.every(q => { const t = isl.toTile(q.x, q.z); return town.nav.walkable(t.tx, t.tz) && !town.blocksAction(q.x, q.z); })) return p;
    }
    return null;
  }

  function start(pair) {
    const all = villagers();
    const who = pair.map(s => all.find(V => V.slug === s));
    const at = spots();
    if (!at || who.some(V => !V)) return false;
    A = { who, at, phase: 'gather', t: 0, sing: 0, next: 0.5, turn: 0, listen: 0, heard: 0, first: !st().songFirst && BOND.song.first.every((s, i) => pair[i] === s), snapped: false };
    who.forEach((V, i) => {
      V.hold(dt => step(V, i, dt), 'song');
      const pts = town.route(V.actor.position, at[i]);
      if (pts) V.actor.setPath(pts);
    });
    st().song = { day: context(ctx).dayKey, pair: [...pair], heard: 0 };
    console.info(`[town] 저녁 노래: ${who.map(V => V.person.name).join(' · ')}`);
    return true;
  }

  function step(V, i, dt) {
    if (!A) return;
    const a = V.actor;
    if (A.phase === 'gather') {
      if (a.path.length) {
        const res = a.walk(dt, V.person.pace.walk, (x, z, dx, dz) => town.avoid(V, x, z, dx, dz));
        a.animateMove(a.speed, false);
        if (res === 'stuck') { a.stuck = 0; a.path = []; }
      } else a.animateMove(0);
      return;
    }
    // 노래: 서로 마주 보고 살랑 (자기 차례에 조금 더)
    const o = A.who[1 - i].actor.position;
    a.lookAt(o.x, o.z);
    a.animateMove(0);
  }

  function update(dt) {
    if (!A) {
      if ((check -= dt) > 0) return;
      check = CHECK;
      const c = context(ctx), p = todayPlan();
      if (!p || st().song?.day === c.dayKey || !songTime(p, c.now) || companion?.active || S().ui?.isBlocking?.()) return;
      const free = villagers().filter(V => (V.mode === 'idle' || V.mode === 'walk') && V.talkable && shouldBeOut(V.person, c.now, c.weather)).map(V => V.slug);
      const pair = songPair(free, c.dayKey, !!st().songFirst);
      if (pair) start(pair);
      return;
    }
    A.t += dt;
    const c = context(ctx);
    // 집에 갈 시각이면 그만
    if (A.who.some(V => V.mode !== 'with' && V.mode !== 'talk') || A.who.some(V => !shouldBeOut(V.person, c.now, c.weather, { noBreak: true }))) { end(); return; }
    if (A.phase === 'gather') {
      const there = A.who.every((V, i) => Math.hypot(V.actor.position.x - A.at[i].x, V.actor.position.z - A.at[i].z) < 0.5 || !V.actor.path.length);
      if (there || A.t > GATHER_MAX) {
        A.who.forEach((V, i) => { if (Math.hypot(V.actor.position.x - A.at[i].x, V.actor.position.z - A.at[i].z) > 1.2) V.actor.place(A.at[i].x, A.at[i].z, 0); V.actor.path = []; });
        A.phase = 'sing'; A.sing = 0;
      }
      return;
    }
    A.sing += dt;
    const pl = S().player?.position;
    const mid = { x: (A.at[0].x + A.at[1].x) / 2, z: (A.at[0].z + A.at[1].z) / 2 };
    const d = pl ? Math.hypot(pl.x - mid.x, pl.z - mid.z) : 99;
    if (d < LISTEN) { A.listen += dt; A.heard += dt; } else A.listen = 0;
    // 번갈아 한 토막씩
    if ((A.next -= dt) <= 0) {
      A.next = BOND.song.lineEvery;
      const V = A.who[A.turn], O = A.who[1 - A.turn];
      A.turn = 1 - A.turn;
      const lyric = pickLines(lines[V.slug]?.song?.sing ?? ['라라~ 랄라~'], Math.random)[0];
      V.bubble = `🎵 ${lyric}`;
      O.bubble = '🎶';
      if (Math.random() < 0.35) V.happy();
      if (d < BOND.song.hear && !S().ui?.isBlocking?.() && !S().story?.playing) S().audio?.speak?.(lyric.replace(/♪/g, '~'), V.person.voice ?? V.slug);
    }
    // 처음 다가가 들으면 장면 s26 (한 번)
    if (A.first && A.listen > 3 && !st().songFirst) {
      st().songFirst = true;
      ctx.events.emit('town:song', { first: true, x: mid.x, z: mid.z, pair: A.who.map(V => V.slug) });
    }
    if (!A.snapped && A.listen > 4 && !S().ui?.isBlocking?.() && !S().story?.playing) {
      A.snapped = true;
      S().album?.snap?.({ kind: 'song', who: A.who.map(V => V.slug), title: `광장의 저녁 노래 (${A.who.map(V => V.person.name).join('·')})` });
    }
    if (A.sing >= BOND.song.seconds) end();
  }

  function end() {
    if (!A) return;
    const { who, heard } = A;
    const rec = st().song;
    if (rec) rec.heard = Math.round(heard);
    if (heard >= BOND.song.seconds * 0.5) for (const V of who) addFriendship(villagerState(ctx.state, V.slug), BOND.song.points);
    for (const V of who) { V.bubble = null; V.release(); }
    ctx.events.emit('town:song', { first: false, end: true, pair: who.map(V => V.slug), heard: Math.round(heard) });
    A = null;
  }

  /** 노래하는 주민에게 말 걸면 한마디 + 같이 흥얼 → 처리했나 */
  async function talk(V) {
    if (!A || !A.who.includes(V)) return false;
    const a = await speaker(ctx, V.person)(pickLines(lines[V.slug]?.song?.talk ?? lines[V.slug]?.chat, Math.random), ['같이 흥얼흥얼', '듣기만 할게']);
    if (a === 0) { for (const W of A.who) W.happy(); ctx.events.emit('sfx', { name: 'acorn', volume: 0.4 }); A.heard += 5; }
    return true;
  }

  return {
    update, talk, end,
    plan: () => todayPlan(),
    get active() { return A ? { pair: A.who.map(V => V.slug), phase: A.phase, sing: A.sing, heard: A.heard, first: A.first } : null; },
    /** 개발·점검용: 지금 바로 부르게 (시간 조건 무시) */
    debugStart: pair => (!A && start(pair ?? songPair(villagers().filter(V => V.talkable).map(V => V.slug), context(ctx).dayKey, !!st().songFirst) ?? [])),
  };
}
