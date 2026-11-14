// M19-P3 주민끼리 짝 (16차 보드 D202-A): 짝 여섯(assets/town/pairs.json) — 짝끼리 가끔 같이 걷고, 말 걸면 짝 이야기를 꺼낸다.
// 엔딩 뒤 한 달에 한 번쯤 한 짝이 다투는 날: 말풍선 💢 · 서로 피함 · 팔짱 끼고 고개 돌리기 AN-17 (코드 자세, .glb 클립 아님 — player/swim.js 처럼).
// 플레이어가 둘 이야기를 차례로 들어 주면(대화 갈래 「이야기 들어 줄게」) 저녁(makeupHour) 광장에서 화해 장면 s53 (배우 자리만 바뀌는 한 장면 —
// town:pair {makeup, cast} → story 트리거 pair-makeup, vars.cast 로 배우를 바꿔 끼운다) → 둘이 같이 편지 + 선물(우편함), 섬 일지 makeup 한 칸.
// 날짜는 언제나 time.now() (context(ctx).dayKey). 비·눈·그날만 날씨·계절 행사·대회·섬 축제·짝 생일은 피하고 다음 날로 미룬다.
// 저장 state.town.pairs = { fight: { month, day, pair, status, heard: {slug: bool} } | null, history: [{ month, day, pair, outcome }], count: {pair: n}, walks: { day, n: {pair: n} }, mention: { day, said: [slug] } }
// 위쪽은 순수 규칙(tests/pairs.test.mjs), 아래 createPairs 가 게임 안 연결. three 는 ctx.THREE 로만 쓴다.
import { villagerState, addFriendship, pickLines, shouldBeOut, dayHour, fill, josa, rngOf, daysBetween } from './rules.js';
import { context, speaker } from './talk.js';

export const PAIRS_FILE = 'assets/town/pairs.json';
const NEAR_TOAST = 9;       // 다툼 날 알림: 둘 중 하나가 이만큼 안에 오면
const APART_CHECK = 1;      // 서로 피하기 확인 간격 (초)

// ---------- 순수 규칙 ----------

/** 저장 칸 (없으면 만든다) */
export function pairsState(state) {
  const town = (state.town ||= {});
  const P = (town.pairs ||= {});
  P.fight ??= null;
  if (!Array.isArray(P.history)) P.history = [];
  P.count ||= {};
  P.walks ||= { day: null, n: {} };
  P.mention ||= { day: null, said: [] };
  return P;
}

/** 지금 섬에서 짝이 될 수 있는 것 (둘 다 섬에 살고 ok(slug) 를 넘는 짝) */
export const livePairs = (cfg, residents = [], ok = () => true) => (cfg?.pairs ?? []).filter(p => residents.includes(p.a) && residents.includes(p.b) && ok(p.a) && ok(p.b));

/** 짝의 다른 쪽 */
export const partnerOf = (pair, slug) => (pair?.a === slug ? pair.b : pair?.b === slug ? pair.a : null);

/** 그 달 다툼이 일어날 수 있는 첫날 (fromDay + 0~spread-1, 달마다 정해짐) */
export const fightFrom = (cfg, month) => (cfg.fight.fromDay ?? 6) + Math.floor(rngOf('pair-fight', month)() * Math.max(1, cfg.fight.spread ?? 1));

/**
 * 오늘 다툼을 시작할까 → 짝 | null
 * o = { cfg, P(저장 칸), dayKey, endedDay(첫 섬 축제), pairs(livePairs), blocked(오늘 피하는 날인가) }
 * 한 달에 한 번: 그달 첫날(fightFrom) 이 지나고 lastDay 전, 피하는 날이 아닌 첫 날. 짝은 덜 다툰 짝부터 돌아가며.
 */
export function planFight({ cfg, P, dayKey, endedDay, pairs, blocked = false }) {
  if (!dayKey || !endedDay || !pairs?.length) return null;
  if (daysBetween(endedDay, dayKey) < (cfg.fight.afterEnding ?? 3)) return null;
  const month = dayKey.slice(0, 7);
  if (P.fight?.month === month || P.history.some(h => h.month === month)) return null;
  const d = Number(dayKey.slice(8, 10));
  if (d < fightFrom(cfg, month) || d > (cfg.fight.lastDay ?? 27)) return null;
  if (blocked) return null;
  const least = Math.min(...pairs.map(p => P.count[p.id] ?? 0));
  const pool = pairs.filter(p => (P.count[p.id] ?? 0) === least);
  return pool[Math.floor(rngOf('pair-pick', month)() * pool.length)];
}

/** 다툼 시작 기록 */
export function startFight(P, pair, dayKey) {
  P.fight = { month: dayKey.slice(0, 7), day: dayKey, pair: pair.id, status: 'fight', heard: { [pair.a]: false, [pair.b]: false } };
  P.count[pair.id] = (P.count[pair.id] ?? 0) + 1;
  return P.fight;
}

/** 오늘 다투는 중인 짝 기록 (화해하면 null) */
export const fightToday = (P, dayKey) => (P.fight && P.fight.day === dayKey && P.fight.status !== 'made' && P.fight.status !== 'self' ? P.fight : null);

/** 이야기를 들어 줌 → { both } (둘 다 들었으면 status 'heard') */
export function listen(P, slug) {
  const f = P.fight;
  if (!f || !(slug in f.heard)) return { both: false };
  f.heard[slug] = true;
  const both = Object.values(f.heard).every(Boolean);
  if (both && f.status === 'fight') f.status = 'heard';
  return { both };
}

/** 저녁 화해를 지금 틀까 */
export const makeupDue = (cfg, P, now) => !!P.fight && P.fight.day === now?.dayKey && P.fight.status === 'heard' && dayHour(now) >= (cfg.fight.makeupHour ?? 17);

/** 화해 끝 기록 */
export function finishFight(P, outcome = 'made') {
  const f = P.fight;
  if (!f) return null;
  f.status = outcome;
  P.history.push({ month: f.month, day: f.day, pair: f.pair, outcome });
  if (P.history.length > 24) P.history.shift();
  return f;
}

/** 날이 바뀌었다: 화해 못 한 다툼은 저절로 풀린 것으로 (outcome self) → 닫았나 */
export function closeDay(P, dayKey) {
  const f = P.fight;
  if (!f || !(daysBetween(f.day, dayKey) > 0) || f.status === 'made' || f.status === 'self') return false;   // 앞으로 간 날만 (날짜 흉내로 뒤로 가면 그대로)
  finishFight(P, 'self');
  return true;
}

/** 오늘 이 짝이 같이 걸어도 되나 (하루 perDay 번, 다투는 날엔 안 됨) */
export function canWalk(cfg, P, pair, dayKey) {
  if (fightToday(P, dayKey)?.pair === pair.id) return false;
  if (P.walks.day !== dayKey) P.walks = { day: dayKey, n: {} };
  return (P.walks.n[pair.id] ?? 0) < (cfg.walk.perDay ?? 2);
}
export function noteWalk(P, pair, dayKey) {
  if (P.walks.day !== dayKey) P.walks = { day: dayKey, n: {} };
  P.walks.n[pair.id] = (P.walks.n[pair.id] ?? 0) + 1;
}

/** 오늘 피하는 날인가 — o = { forecast: [{weather}], weather, special, event, contest, festival, birthday } (모두 그날 값) */
export const avoidDay = o => !!(o.special || o.event || o.contest || o.festival || o.birthday
  || ['rain', 'snow'].includes(o.weather) || (o.forecast ?? []).some(s => s.weather === 'rain' || s.weather === 'snow'));

/**
 * AN-17 팔짱 끼고 고개 돌리기 (순수 — 테스트): k = 섞기 0~1, ph = 숨 쉬듯 살랑 (라디안)
 * → { 뼈: [x, y, z] } 부모(몸통) 공간 Euler YXZ — player/swim.js 처럼 동작 위에 부모 공간에서 덧돌린다 (q = 델타 · 동작).
 *   팔 x − = 앞으로 들어 올림, y = 몸 안쪽으로 모음 → 두 팔이 가슴 앞에서 겹친다. 머리 y = 옆으로 돌리기, x − = 턱 들기.
 *   (2026-11-14 dev-server 4303 에서 초롱으로 렌더해 맞춤 — 뼈 로컬 곱하기는 팔이 옆으로 벌어졌다)
 */
export function sulkPose(k, ph = 0) {
  const b = 0.04 * Math.sin(ph);
  return {
    armR: [(-1.3 + b) * k, 0.85 * k, 0],     // 앞으로 들어 가슴 앞을 가로지른다
    armL: [(-1.3 + b) * k, -0.85 * k, 0],
    head: [-0.22 * k, 0.6 * k, 0.05 * k],    // 턱을 들고 옆으로 「흥」
  };
}

// ---------- 게임 안 ----------

export async function createPairs(ctx, { town, villagers, residents, mail, party = null, companion = null, song = null, toast }) {
  const S = () => ctx.services;
  let cfg;
  try { cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(PAIRS_FILE) : fetch(PAIRS_FILE).then(r => r.json())); } catch (e) { console.warn('[town] 짝 설정을 못 읽었어요', e); return null; }
  const P = () => pairsState(ctx.state);
  const byId = id => cfg.pairs.find(p => p.id === id) ?? null;
  const V$ = slug => villagers().find(V => V.slug === slug) ?? null;
  const nameOf = slug => V$(slug)?.person.name ?? slug;
  const met = slug => !!villagerState(ctx.state, slug).met;
  const live = () => livePairs(cfg, residents(), met);
  const pairsOf = slug => live().filter(p => p.a === slug || p.b === slug);
  const vars = pair => ({ a: nameOf(pair.a), b: nameOf(pair.b) });
  const L = cfg.lines ?? {};
  const free = () => !S().ui?.isBlocking?.() && !S().story?.playing;

  // ---- 다툼 날 정하기 (하루 한 번) ----
  let dayChecked = null, toasted = null;
  function blockedToday(pair, dayKey) {
    const T = S().time;
    let forecast = [], event = false, contest = false, festival = false;
    try { forecast = T?.forecast?.(dayKey) ?? []; } catch { /* 예보 없음 */ }
    try { event = (S().events?.active?.() ?? []).length > 0; } catch { /* 행사 없음 */ }
    try { contest = !!S().contest?.today?.(); } catch { /* 대회 없음 */ }
    try { festival = !!S().festival?.due?.(); } catch { /* 축제 없음 */ }
    const birthday = !!pair && [pair.a, pair.b].some(s => party?.isBirthday?.(s, dayKey));
    return avoidDay({ forecast, weather: T?.weather, special: T?.special?.(dayKey), event, contest, festival, birthday });
  }
  function checkDay(dayKey) {
    if (!dayKey || dayChecked === dayKey) return;
    dayChecked = dayKey;
    const st = P();
    if (closeDay(st, dayKey)) clearSulk();
    const pairs = live();
    // 피하는 날인지는 「고를 짝」 기준(생일)까지 보려고 고른 뒤 한 번 더
    let pick = planFight({ cfg, P: st, dayKey, endedDay: ctx.state.festival?.endedDay, pairs, blocked: blockedToday(null, dayKey) });
    if (pick && blockedToday(pick, dayKey)) pick = null;
    if (!pick) return;
    if (W && (W.pair === pick.id)) endWalk();
    startFight(st, pick, dayKey);
    console.info(`[town] 짝 다툼 날: ${nameOf(pick.a)} · ${nameOf(pick.b)} (${pick.id})`);
    ctx.events.emit('town:pair', { phase: 'fight', pair: pick.id, a: pick.a, b: pick.b });
  }

  // ---- AN-17 팔짱·고개 돌리기 ----
  const { THREE } = ctx;
  const sulk = new Map();   // slug → { bones, k, ph, fn }
  const tmpQ = THREE ? new THREE.Quaternion() : null, tmpE = THREE ? new THREE.Euler() : null;
  function bonesOf(V) {
    let skin = null;
    V.actor.model?.traverse?.(o => { if (!skin && o.isSkinnedMesh) skin = o; });
    const list = skin?.skeleton?.bones ?? [];
    const find = n => list.find(b => b.name === n || b.name === n.replace(/\./g, '')) ?? null;
    return { armR: find('arm.R'), armL: find('arm.L'), head: find('head') };
  }
  function wantSulk(V, on) {
    let s = sulk.get(V.slug);
    if (!s) {
      if (!on || !THREE) return;
      const bones = bonesOf(V);
      s = { V, bones, k: 0, ph: Math.random() * 6, on, base: {}, applied: {} };
      s.fn = dt => {
        const want = s.on && (V.mode === 'idle' || V.mode === 'talk' || V.mode === 'chat') ? 1 : 0;
        s.k += (want - s.k) * Math.min(1, dt * 5);
        s.ph += dt * 2.2;
        const pose = sulkPose(s.k, s.ph);
        for (const [name, bone] of Object.entries(s.bones)) {
          if (!bone) continue;
          const q = bone.quaternion;
          if (!s.applied[name] || !q.equals(s.applied[name])) s.base[name] = q.clone();
          q.copy(s.base[name]).premultiply(tmpQ.setFromEuler(tmpE.set(...pose[name], 'YXZ')));
          s.applied[name] = q.clone();
        }
        if (!s.on && s.k < 0.01) dropSulk(V.slug);
      };
      sulk.set(V.slug, s);
    }
    s.on = on;
    if (!V.afterAnim) V.afterAnim = s.fn;   // 같이 낚시(AN-14)가 쓰는 중이면 기다린다
  }
  function dropSulk(slug) {
    const s = sulk.get(slug);
    if (!s) return;
    for (const [name, bone] of Object.entries(s.bones)) if (bone && s.base[name]) bone.quaternion.copy(s.base[name]);
    if (s.V.afterAnim === s.fn) s.V.afterAnim = null;
    sulk.delete(slug);
  }
  function clearSulk() {
    for (const s of sulk.values()) { s.on = false; if (s.V.bubble === '💢') s.V.bubble = null; }
  }

  // ---- 같이 걷기 ----
  let W = null, walkCheck = cfg.walk.check * Math.random();
  function startWalk(pair) {
    const A = V$(pair.a), B = V$(pair.b);
    if (!A || !B || W) return false;
    const [lead, foll] = Math.random() < 0.5 ? [A, B] : [B, A];
    let pts = null;
    for (let i = 0; i < 4 && !pts; i++) { const s = town.pickSpot(lead.person, lead); if (s) pts = town.route(lead.actor.position, s); }
    if (!pts) return false;
    W = { pair: pair.id, def: pair, lead, foll, t: 0, rest: 0, next: 1.2, turn: 0, repath: 0 };
    lead.hold(dt => stepLead(dt), 'pair');
    foll.hold(dt => stepFollow(dt), 'pair');
    lead.actor.setPath(pts);
    noteWalk(P(), pair, context(ctx).dayKey);
    ctx.events.emit('town:pair', { phase: 'walk', pair: pair.id, a: pair.a, b: pair.b });
    return true;
  }
  function stepLead(dt) {
    if (!W) return;
    const a = W.lead.actor;
    if (a.path.length) {
      const res = a.walk(dt, W.lead.person.pace.walk * 0.85, (x, z, dx, dz) => town.avoid(W.lead, x, z, dx, dz));
      a.animateMove(a.speed, false);
      if (res === 'stuck') { a.stuck = 0; a.path = []; }
      // 짝이 너무 뒤처지면 기다린다
      const f = W.foll.actor.position;
      if (Math.hypot(f.x - a.position.x, f.z - a.position.z) > 4) a.speed = 0;
    } else {
      const o = W.foll.actor.position;
      a.lookAt(o.x, o.z);
      a.animateMove(0);
    }
  }
  function stepFollow(dt) {
    if (!W) return;
    const a = W.foll.actor, l = W.lead.actor;
    const d = Math.hypot(l.position.x - a.position.x, l.position.z - a.position.z);
    if ((W.repath -= dt) <= 0) {
      W.repath = 0.5;
      if (d > 16) { a.place(l.position.x + 0.8, l.position.z + 0.8, a.facing); a.path = []; }
      else if (d > cfg.walk.follow + 0.25) {
        const fx = -Math.sin(l.facing), fz = -Math.cos(l.facing);
        const pts = town.route(a.position, { x: l.position.x - fx * cfg.walk.follow, z: l.position.z - fz * cfg.walk.follow });
        a.path = pts ?? [];
      } else a.path = [];
    }
    if (a.path.length && d > cfg.walk.follow) {
      const res = a.walk(dt, W.foll.person.pace.walk * (d > 3 ? 1.15 : 0.9), (x, z, dx, dz) => town.avoid(W.foll, x, z, dx, dz));
      a.animateMove(a.speed, false);
      if (res === 'stuck') { a.stuck = 0; a.path = []; }
    } else {
      a.lookAt(l.position.x, l.position.z);
      a.animateMove(0);
    }
  }
  function stepWalk(dt, now, weather) {
    W.t += dt;
    const { lead, foll } = W;
    const gone = [lead, foll].some(V => (V.mode !== 'with' && V.mode !== 'talk') || !shouldBeOut(V.person, now, weather, { noBreak: true }));
    if (!lead.actor.path.length) W.rest += dt;
    if (gone || W.t > cfg.walk.seconds || W.rest > cfg.walk.rest) { endWalk(); return; }
    if ((W.next -= dt) <= 0) {
      W.next = cfg.walk.lineEvery;
      const sp = W.turn ? foll : lead, o = W.turn ? lead : foll;
      W.turn ^= 1;
      if (sp.mode === 'with') sp.bubble = pickLines(W.def.walk, Math.random)[0] ?? '💬';
      if (o.mode === 'with') o.bubble = null;
      if (Math.random() < 0.25) sp.happy();
    }
  }
  function endWalk() {
    if (!W) return;
    const w = W;
    W = null;
    for (const V of [w.lead, w.foll]) { if (V.bubble && V.bubble !== '💢') V.bubble = null; if (V.withKind === 'pair') V.release(); }
    ctx.events.emit('town:pair', { phase: 'walked', pair: w.pair });
  }

  // ---- 화해 장면 ----
  let sceneWait = 0;
  function makeupSpot() {
    const world = S().world, isl = world?.island, base = world?.places?.plaza ?? world?.places?.festival;
    if (!base || !isl) return null;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + Math.PI / 2, r = 3.6 + (i % 3) * 0.5;
      const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r;
      const ok = [[-1.3, 0], [1.3, 0], [0, 2.4]].every(([dx, dz]) => { const t = isl.toTile(x + dx, z + dz); return town.nav.walkable(t.tx, t.tz) && !town.blocksAction(x + dx, z + dz); });
      if (ok) return { x, z };
    }
    return { x: base.x, z: base.z + 3.6 };
  }
  function startMakeup() {
    const st = P(), f = st.fight, pair = byId(f.pair);
    if (!pair) { finishFight(st, 'self'); return; }
    f.status = 'scene';
    sceneWait = 0;
    const story = S().story, id = cfg.fight.scene;
    const at = makeupSpot();
    const v = vars(pair);
    const [ca, cb] = cfg.fight.sceneCast;
    if (!story?.scene?.(id)) { console.info('[town] 화해 장면이 없어 바로 선물'); makeupDone(); return; }
    ctx.events.emit('town:pair', { phase: 'makeup', makeup: true, pair: pair.id, x: at.x, z: at.z, a: v.a, b: v.b, ab: `${josa(v.a, '와')} ${v.b}`, about: pair.fight?.about ?? '', cast: { [ca]: pair.a, [cb]: pair.b } });
  }
  function makeupDone() {
    const st = P(), f = st.fight;
    if (!f || f.status === 'made') return;
    const pair = byId(f.pair);
    finishFight(st, 'made');
    clearSulk();
    if (!pair) return;
    for (const s of [pair.a, pair.b]) addFriendship(villagerState(ctx.state, s), cfg.fight.makeupPoints ?? 3);
    const v = vars(pair);
    mail?.post?.(pair.a, 'pair', pair.gift ?? null, { pool: pair.letter, vars: { ...v, other: v.b } });
    toast?.(fill(L.madeToast ?? '{a:와} {b:이} 같이 보낸 편지가 우편함에 왔어요', v), '💌');
    for (const s of [pair.a, pair.b]) V$(s)?.happy?.();
    ctx.events.emit('town:pair', { phase: 'made', pair: pair.id, a: pair.a, b: pair.b });
    console.info(`[town] 짝 화해: ${v.a} · ${v.b}`);
  }
  ctx.events.on('story:end', ({ id } = {}) => { if (id === cfg.fight.scene && P().fight?.status === 'scene') makeupDone(); });

  // ---- 매 프레임 ----
  let apartT = 0;
  function update(dt) {
    const c = context(ctx);
    if (!c.now || !c.dayKey) return;
    checkDay(c.dayKey);
    const st = P(), f = fightToday(st, c.dayKey), pair = f && byId(f.pair);
    // 같이 걷기
    if (W) stepWalk(dt, c.now, c.weather);
    else if ((walkCheck -= dt) <= 0) {
      walkCheck = cfg.walk.check;
      if (Math.random() < cfg.walk.chance && free() && !song?.active) {
        const ok = V => V && (V.mode === 'idle' || V.mode === 'walk') && V.talkable && shouldBeOut(V.person, c.now, c.weather) && companion?.active?.slug !== V.slug;
        const cand = live().filter(p => canWalk(cfg, st, p, c.dayKey) && ok(V$(p.a)) && ok(V$(p.b)));
        if (cand.length) startWalk(cand[Math.floor(Math.random() * cand.length)]);
      }
    }
    // 다툼 날
    if (pair) {
      const A = V$(pair.a), B = V$(pair.b);
      for (const V of [A, B]) if (V) {
        wantSulk(V, f.status === 'fight' || f.status === 'heard' || f.status === 'scene');
        if (!V.bubble && (V.mode === 'idle' || V.mode === 'walk')) V.bubble = '💢';
      }
      if (A && B && (apartT -= dt) <= 0) {
        apartT = APART_CHECK;
        apart(A, B);
        const pl = S().player?.position;
        if (pl && toasted !== c.dayKey && [A, B].some(V => V.talkable && Math.hypot(V.actor.position.x - pl.x, V.actor.position.z - pl.z) < NEAR_TOAST) && free()) {
          toasted = c.dayKey;
          toast?.(fill(L.fightToast ?? '{a:와} {b} 사이에 찬 바람이 불어요', vars(pair)), '💢');
        }
      }
      if (makeupDue(cfg, st, c.now) && free() && !S().house?.inside && !S().house?.places?.where) startMakeup();
    }
    // 장면이 줄에서 사라졌는데(새로고침 · 장면을 못 틂) 끝 소식이 없으면 선물만이라도
    if (st.fight?.status === 'scene' && st.fight.day === c.dayKey) {
      const story = S().story, id = cfg.fight.scene;
      const waiting = story?.playing?.id === id || (story?.queue ?? []).includes(id);
      sceneWait = waiting ? 0 : sceneWait + dt;
      if (sceneWait > 4) makeupDone();
    }
  }
  /** 다투는 둘이 가까우면 한쪽이 등을 돌려 다른 데로 간다 · 멀면 서로 반대쪽을 본다 */
  function apart(A, B) {
    const a = A.actor.position, b = B.actor.position, d = Math.hypot(a.x - b.x, a.z - b.z);
    const pl = S().player?.position;
    const near = V => pl && Math.hypot(V.actor.position.x - pl.x, V.actor.position.z - pl.z) < 2.6;
    if (d < cfg.fight.apart) {
      const mover = [B, A].find(V => V.mode === 'idle' && !near(V));
      if (mover) {
        const o = mover === A ? b : a;
        for (let i = 0; i < 6; i++) {
          const s = town.pickSpot(mover.person, mover);
          if (s && Math.hypot(s.x - o.x, s.z - o.z) > cfg.fight.apart + 2 && mover.goTo?.(s)) break;
        }
      }
    }
    for (const [V, o] of [[A, b], [B, a]]) {
      if (V.mode !== 'idle' || near(V) || d > 12) continue;
      const p = V.actor.position;
      V.actor.lookAt(2 * p.x - o.x, 2 * p.z - o.z);   // 고개 돌리기: 짝 반대쪽을 본다
    }
  }

  // ---- 말 걸기 (index.js town:talk 가 converse 전에 묻는다) → 처리했나 ----
  async function talk(V) {
    const c = context(ctx), st = P();
    const f = fightToday(st, c.dayKey), fp = f && byId(f.pair);
    const other = slug => nameOf(partnerOf(fp ?? pairsOf(slug)[0], slug));
    if (fp && (fp.a === V.slug || fp.b === V.slug) && f.status !== 'scene') {
      const v = { other: other(V.slug) };
      const say = speaker(ctx, V.person, v);
      const F = fp.fight?.[V.slug] ?? {};
      if (f.heard[V.slug]) {
        await say(pickLines(f.status === 'heard' ? L.bothHeard : L.heardWait, Math.random));
        return true;
      }
      const a = await say(pickLines(F.grumble ?? L.fightLater, Math.random), L.choices ?? ['이야기 들어 줄게', '나중에']);
      if (a !== 0) { await say(pickLines(L.fightLater, Math.random)); return true; }
      await say(pickLines(F.listen, Math.random));
      addFriendship(villagerState(ctx.state, V.slug), cfg.fight.listenPoints ?? 1);
      const { both } = listen(st, V.slug);
      V.happy();
      ctx.events.emit('town:pair', { phase: 'listen', pair: fp.id, slug: V.slug, both });
      if (both) {
        await say(pickLines(L.bothHeard, Math.random));
        toast?.(fill(L.readyToast ?? '{a:와} {b:이} 저녁에 광장에서 만나기로 했어요', vars(fp)), '🤝');
      }
      return true;
    }
    // 같이 걷는 중: 짝 이야기 (글 대화 — 이모티콘 대화를 켰으면 보통 대화로 넘긴다)
    const emote = !!S().festival?.emote?.on?.();
    const mine = pairsOf(V.slug);
    if (!mine.length) return false;
    const walking = W && (W.lead === V || W.foll === V);
    const pair = walking ? W.def : mine[0];
    const lines = pair.talk?.[V.slug];
    if (!lines?.length || emote) return false;
    if (walking) {
      await speaker(ctx, V.person, { other: nameOf(partnerOf(pair, V.slug)) })(pickLines(lines, Math.random));
      return true;
    }
    // 하루 한 번쯤 대화 앞에 짝 이야기 한마디 (그다음 보통 대화)
    const m = st.mention;
    if (m.day !== c.dayKey) { m.day = c.dayKey; m.said = []; }
    if (!m.said.includes(V.slug) && Math.random() < (cfg.walk.mention ?? 0.35)) {
      m.said.push(V.slug);
      const p = mine[Math.floor(Math.random() * mine.length)];
      await speaker(ctx, V.person, { other: nameOf(partnerOf(p, V.slug)) })(pickLines(p.talk?.[V.slug], Math.random));
    }
    return false;
  }

  /** 주민끼리 수다(chatter) 를 막을까: 다투는 둘 */
  const avoid = (a, b) => { const f = fightToday(P(), context(ctx).dayKey), p = f && byId(f.pair); return !!p && ((p.a === a && p.b === b) || (p.a === b && p.b === a)); };

  const service = {
    config: cfg,
    /** 지금 섬의 짝 [{ id, a, b, title }] */
    list: () => live().map(p => ({ id: p.id, a: p.a, b: p.b, title: p.title })),
    /** 오늘 다툼 { pair, a, b, status, heard } | null */
    today: () => { const f = fightToday(P(), context(ctx).dayKey) ?? (P().fight?.day === context(ctx).dayKey ? P().fight : null); const p = f && byId(f.pair); return f ? { pair: f.pair, a: p?.a, b: p?.b, status: f.status, heard: { ...f.heard } } : null; },
    /** 지금 같이 걷는 짝 { pair, lead, foll } | null */
    walking: () => (W ? { pair: W.pair, lead: W.lead.slug, foll: W.foll.slug } : null),
    partners: slug => pairsOf(slug).map(p => partnerOf(p, slug)),
    state: () => P(),
    /** 개발·점검용: 지금 이 짝을 같이 걷게 (봇은 쓰지 않는다) */
    debug: { startWalk: id => { const p = byId(id); return !!p && startWalk(p); }, endWalk },
  };
  return { update, talk, avoid, service, endWalk };
}
