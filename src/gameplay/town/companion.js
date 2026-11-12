// M15 같이 하기: 친구 이상 주민에게 「같이 낚시 / 산책 할래?」(talk.js) → 주민이 따라오며 같이 논다.
//   산책 = 플레이어 뒤를 따라 걷는다 (걸은 칸 수 BOND.together.walkGoal 이면 끝)
//   낚시 = 낚싯대를 들고 따라오다가, 플레이어가 물가에 서면 옆 물가 칸에 서서 같이 낚는다 (AN-14: 낚싯대 들기 — 뼈 자세 + 코드 낚싯대·찌·줄,
//          Blender 재빌드 없이 player/tools.js 낚싯대를 다시 쓴다, D157-A). 주민도 가끔 낚고, 플레이어가 낚으면(효과음 catch) 옆에서 손뼉.
// 끝나면 (목표·시간·말 걸어 「그만」·잘 시간·플레이어가 집/섬 밖) 사진 한 장(추억 앨범) → 한마디 → 친밀도 + 작은 선물. 같은 주민과는 하루 한 번.
// 주민은 villager.js 의 mode 'with' (V.hold / V.release) 로 넘겨받는다.
import { villagerState, addFriendship, pickLines, shouldBeOut, homeFrom, dayHour, fill, josa } from './rules.js';
import { canTogether, noteTogether, togetherGift, togetherDone, catchDelay } from './bond.js';
import { context, giveItem, speaker } from './talk.js';
import { buildTool } from '../../player/tools.js';

const FOLLOW = 1.3;        // 이만큼 뒤에서 따라온다
const RUN_FAR = 3.6;       // 이보다 멀면 뛰어 온다
const WARP = 16;           // 이보다 멀어지면 (순간이동·문) 옆으로 옮겨 놓는다
const REPATH = 0.45;
const WATER_NEAR = 2.2;    // 플레이어가 물가 이 거리 안에 서 있으면 낚시 자리를 찾는다
const STILL = 0.9;         // 그만큼(초) 서 있어야 낚시 자리로 간다
const TIER_LINE = { tier: 'notYet', today: 'busy', late: 'busy' };

export function createCompanion(ctx, { town, lines, toast }) {
  const { THREE } = ctx;
  const S = () => ctx.services;
  let C = null;   // 지금 같이 노는 것 { V, kind, sec, walked, caught:[], playerCaught, last, ... }

  const L = slug => lines[slug]?.together ?? {};
  const say = (V, vars) => speaker(ctx, V.person, vars);
  const nameOf = id => S().data?.items?.get?.(id)?.name ?? id;

  /** 이 주민과 지금 같이 놀 수 있나 → { ok, why } (why: tier · today · late) */
  function can(V) {
    const c = context(ctx);
    const r = canTogether(villagerState(ctx.state, V.slug), c.dayKey);
    if (!r.ok) return r;
    if (C) return { ok: false, why: 'today' };
    // 들어갈 시각이 1시간도 안 남았으면 다음에
    if (dayHour(c.now) > homeFrom(V.person, c.dayKey) - 1 || !shouldBeOut(V.person, c.now, c.weather, { noBreak: true })) return { ok: false, why: 'late' };
    return { ok: true, why: null };
  }
  /** 못 놀 때 한마디 묶음 */
  const refusal = (V, why) => pickLines(L(V.slug)[TIER_LINE[why] ?? 'busy'] ?? lines[V.slug]?.bye, Math.random);

  // ---------- 낚싯대 (AN-14) ----------
  const tmpQ = new THREE.Quaternion();
  const POSE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.05, 0, 0.18));   // 오른팔을 앞으로 들어 올린 자세
  function restBone(model, name) {
    let skin = null;
    model.traverse(o => { if (!skin && o.isSkinnedMesh) skin = o; });
    const bones = skin?.skeleton?.bones ?? [];
    const i = bones.findIndex(b => b.name === name || b.name === name.replace(/\./g, ''));
    return i < 0 ? null : { bone: bones[i], rest: new THREE.Matrix4().copy(skin.skeleton.boneInverses[i]).invert() };
  }
  function holdRod(V) {
    const rb = restBone(V.actor.model, 'arm.R');
    const rod = buildTool(ctx, 'rod');
    if (!rb || !rod) return null;
    const H = V.actor.height ?? 1;
    const holder = new THREE.Group();
    holder.add(rod);
    rod.rotation.set(0.95, 0, 0);   // 손잡이 +Y → 앞 위로
    const restPos = new THREE.Vector3().setFromMatrixPosition(rb.rest).add(new THREE.Vector3(-0.055, -0.14, 0.03).multiplyScalar(H));
    const want = new THREE.Matrix4().compose(restPos, new THREE.Quaternion(), new THREE.Vector3(H, H, H));
    new THREE.Matrix4().copy(rb.rest).invert().multiply(want).decompose(holder.position, holder.quaternion, holder.scale);
    holder.name = 'm15-rod';
    rb.bone.add(holder);
    // 찌와 줄 (물에 던졌을 때만 보인다)
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), ctx.materials.toonMaterial('#E8504F', { name: 'tool' }));
    bob.visible = false;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, ctx.materials.curved(new THREE.LineBasicMaterial({ color: '#4A3B32' })));
    line.visible = false; line.frustumCulled = false;
    ctx.scene.add(bob, line);
    const R = { holder, rod, bone: rb.bone, bob, line, pose: 0, base: null, applied: null };
    // 동작이 그 뼈를 안 움직이면 지난 자세가 그대로 남아 있으니, 동작이 쓴 값(base)을 따로 기억해 그 위에 얹는다
    V.afterAnim = dt => {
      const want = C?.V === V && C.phase === 'fish' ? 1 : 0.35;   // 들고 따라올 때도 조금 들고 있다
      R.pose += (want - R.pose) * Math.min(1, dt * 6);
      const q = R.bone.quaternion;
      if (!R.applied || !q.equals(R.applied)) R.base = q.clone();
      tmpQ.identity().slerp(POSE, R.pose);
      q.copy(R.base).multiply(tmpQ);
      R.applied = q.clone();
      if (bob.visible) {
        const tip = rod.userData.tip;
        tip.updateWorldMatrix(true, false);
        const a = new THREE.Vector3().setFromMatrixPosition(tip.matrixWorld);
        const pos = lineGeo.attributes.position;
        pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, bob.position.x, bob.position.y + 0.02, bob.position.z);
        pos.needsUpdate = true;
      }
    };
    rod.userData.bobber && (rod.userData.bobber.visible = false);
    return R;
  }
  function dropRod(V, R) {
    if (!R) return;
    R.holder.removeFromParent();
    R.bob.removeFromParent(); R.line.removeFromParent();
    R.line.geometry.dispose();
    if (R.base) R.bone.quaternion.copy(R.base);
    V.afterAnim = null;
  }

  // ---------- 낚시 자리 ----------
  /** 플레이어 옆 물가 칸 → { x, z, face, wx, wz (찌 자리), hab } | null */
  function fishSpot(p) {
    const world = S().world, isl = world?.island, nav = town.nav;
    if (!isl || !nav) return null;
    const t0 = isl.toTile(p.x, p.z);
    let best = null, bestD = Infinity;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const tx = t0.tx + dx, tz = t0.tz + dz;
      if (!nav.walkable(tx, tz) || (dx === 0 && dz === 0)) continue;
      const c = isl.toWorld(tx, tz), d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < 0.9 || d > 3.4 || d >= bestD) continue;
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (isl.tileAt(tx + ax, tz + az) !== 'water') continue;
        const w = isl.toWorld(tx + ax, tz + az);
        const wx = w.x + ax * 0.5, wz = w.z + az * 0.5;
        best = { x: c.x + ax * 0.15, z: c.z + az * 0.15, wx, wz, face: Math.atan2(-(wx - c.x), -(wz - c.z)), hab: S().gather?.habitatAt?.(wx, wz) ?? 'river' };
        bestD = d;
        break;
      }
    }
    return best;
  }
  /** 플레이어가 물가에 서 있나 (앞이나 옆 WATER_NEAR 안에 물 칸) */
  function playerAtWater(p) {
    const isl = S().world?.island;
    if (!isl) return false;
    const t = isl.toTile(p.x, p.z), n = Math.ceil(WATER_NEAR);
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) if (isl.tileAt(t.tx + dx, t.tz + dz) === 'water') {
      const c = isl.toWorld(t.tx + dx, t.tz + dz);
      if (Math.hypot(c.x - p.x, c.z - p.z) < WATER_NEAR) return true;
    }
    return false;
  }

  // ---------- 시작 · 걸음 ----------
  function start(V, kind) {
    if (C || !V) return false;
    const p = S().player.position;
    C = { V, kind, sec: 0, walked: 0, caught: [], playerCaught: 0, last: { x: p.x, z: p.z }, repath: 0, goal: null, phase: 'follow', still: 0, spot: null, next: catchDelay(Math.random), rod: null, ending: false };
    V.hold(dt => step(dt), 'together');
    if (kind === 'fish') C.rod = holdRod(V);
    V.bubble = kind === 'fish' ? '🎣' : '🚶';
    toast(`${josa(V.person.name, '와')} 같이 ${kind === 'fish' ? '낚시' : '산책'} 중이에요 · 말 걸면 그만할 수 있어요`, kind === 'fish' ? '🎣' : '🚶');
    ctx.events.emit('town:together', { slug: V.slug, kind, phase: 'start' });
    return true;
  }

  function behindPlayer() {
    const pl = S().player, p = pl.position;
    return { x: p.x + Math.sin(pl.facing) * FOLLOW, z: p.z + Math.cos(pl.facing) * FOLLOW };
  }

  function walkToward(dt, goal, pd) {
    const V = C.V, a = V.actor;
    if ((C.repath -= dt) <= 0 || !a.path.length) {
      C.repath = REPATH;
      if (!C.goal || Math.hypot(C.goal.x - goal.x, C.goal.z - goal.z) > 0.6 || !a.path.length) {
        C.goal = { ...goal };
        const pts = town.route(a.position, goal);
        if (pts) a.setPath(pts); else a.path = [];
      }
    }
    if (!a.path.length) { a.animateMove(0); return 'arrived'; }
    const run = pd > RUN_FAR;
    const res = a.walk(dt, run ? V.person.pace.run : V.person.pace.walk * 1.15, (x, z, dx, dz) => town.avoid(V, x, z, dx, dz));
    a.animateMove(a.speed, run);
    if (res === 'stuck') { a.stuck = 0; a.path = []; C.goal = null; }
    return res;
  }

  function step(dt) {
    if (!C || C.ending) return;
    const V = C.V, a = V.actor, pl = S().player, p = pl.position;
    C.sec += dt;
    // 플레이어가 걸은 거리 (순간이동은 빼고)
    const mv = Math.hypot(p.x - C.last.x, p.z - C.last.z);
    if (mv < 2) C.walked += mv;
    C.last = { x: p.x, z: p.z };
    const pd = Math.hypot(p.x - a.position.x, p.z - a.position.z);
    // 집·가게·무인도 (섬 밖 구역) 에 들어가면 먼저 돌아간다
    if (Math.abs(p.x) > 300 || S().tour?.active) { finish('away'); return; }
    // 잘 시간이 되면 먼저 들어간다
    const c = context(ctx);
    if (!shouldBeOut(V.person, c.now, c.weather, { noBreak: true }) || dayHour(c.now) > homeFrom(V.person, c.dayKey)) { finish('sleepy'); return; }
    if (pd > WARP) {
      const b = behindPlayer(), t = S().world.island.toTile(b.x, b.z);
      if (town.nav.walkable(t.tx, t.tz)) { a.place(b.x, b.z, pl.facing); a.path = []; C.goal = null; }
    }
    const done = togetherDone(C.kind, { caught: C.caught.length + C.playerCaught, walked: C.walked, sec: C.sec });
    if (done) { finish(done); return; }

    if (C.kind === 'fish') {
      const still = pl.speed < 0.05;
      C.still = still ? C.still + dt : 0;
      if (C.phase !== 'fish' && C.still > STILL && playerAtWater(p)) {
        const s = fishSpot(p);
        if (s) { C.spot = s; C.phase = 'toSpot'; C.goal = null; }
      }
      if (C.spot && Math.hypot(p.x - C.spot.x, p.z - C.spot.z) > 4.5) { C.phase = 'follow'; C.spot = null; castOff(); }
    }
    if (C.phase === 'toSpot') {
      if (walkToward(dt, C.spot, pd) === 'arrived' || Math.hypot(a.position.x - C.spot.x, a.position.z - C.spot.z) < 0.25) { C.phase = 'fish'; a.path = []; cast(); }
      return;
    }
    if (C.phase === 'fish') {
      a.wantFacing = C.spot.face; a.facing = C.spot.face;
      a.root.rotation.y = C.spot.face;
      a.animateMove(0);
      const R = C.rod;
      if (R?.bob.visible) R.bob.position.y = S().world.island.heightAt(R.bob.position.x, R.bob.position.z) + 0.01 + Math.sin(C.sec * 3) * 0.012;
      if ((C.next -= dt) <= 0) { C.next = catchDelay(Math.random); villagerCatch(); }
      return;
    }
    // 따라가기 (가까우면 서서 플레이어 쪽을 본다)
    if (pd > FOLLOW + 0.5) walkToward(dt, behindPlayer(), pd);
    else { a.path = []; a.animateMove(0); a.lookAt(p.x, p.z); }
  }

  function cast() {
    const R = C?.rod;
    if (!R || !C.spot) return;
    R.bob.position.set(C.spot.wx, S().world.island.heightAt(C.spot.wx, C.spot.wz) + 0.01, C.spot.wz);
    R.bob.visible = R.line.visible = true;
    town.sfxAt('cast', C.V.actor.position, 0.4);
  }
  function castOff() { const R = C?.rod; if (R) R.bob.visible = R.line.visible = false; }

  function villagerCatch() {
    const V = C.V, now = context(ctx).now;
    const id = S().data?.spawns?.fish?.({ habitat: C.spot?.hab ?? 'river', hour: Math.floor(now.hour ?? 12), month: now.month ?? 1, weather: context(ctx).weather, rng: Math.random });
    if (!id) return;
    C.caught.push(id);
    town.sfxAt('splash', V.actor.position, 0.5);
    V.happy();
    V.bubble = '🐟✨';
    setTimeout(() => { if (C?.V === V) V.bubble = '🎣'; }, 2200);
    const line = pickLines(L(V.slug).caught, Math.random)[0];
    toast(line ? `${V.person.name}: ${fill(line, { item: nameOf(id) })}` : `${V.person.name}도 ${josa(nameOf(id), '을')} 낚았어요!`, '🎣');
    ctx.events.emit('town:together', { slug: V.slug, kind: 'fish', phase: 'catch', id });
  }

  // 플레이어가 낚으면 옆에서 기뻐한다 (gather 는 효과음 catch 로 알린다 — journal 과 같은 방법)
  ctx.events.on('sfx', ({ name } = {}) => {
    if (name !== 'catch' || C?.kind !== 'fish' || C.ending) return;
    C.playerCaught++;
    const V = C.V;
    V.happy();
    V.bubble = '👏';
    setTimeout(() => { if (C?.V === V) V.bubble = '🎣'; }, 2000);
    const line = pickLines(L(V.slug).cheer, Math.random)[0];
    if (line && C.playerCaught === 1) toast(`${V.person.name}: ${line}`, '👏');
  });

  // ---------- 말 걸기 (같이 노는 중) ----------
  /** 같이 노는 주민에게 말 걸면: 한마디 + 계속 / 그만 */
  async function talk(V) {
    if (C?.V !== V) return false;
    const s = say(V);
    const pool = C.kind === 'fish' ? L(V.slug).cheer : L(V.slug).walking;
    const a = await s(pickLines(pool ?? lines[V.slug]?.chat, Math.random), ['계속 같이 놀자', '이제 그만할까?']);
    if (a === 1) { await s(pickLines(L(V.slug).stop, Math.random)); await finish('stop', { talked: true }); }
    return true;
  }

  // ---------- 끝 ----------
  async function finish(reason, { talked = false } = {}) {
    if (!C || C.ending) return;
    C.ending = true;
    const { V, kind, caught } = C;
    const c = context(ctx);
    const v = villagerState(ctx.state, V.slug);
    const full = reason === 'goal' || reason === 'time';
    const pts = noteTogether(v, kind, c.dayKey, full);
    const up = addFriendship(v, pts).up;
    castOff();
    const gift = full || reason === 'stop' ? togetherGift(V.person, kind, caught, Math.random) : null;
    ctx.events.emit('town:together', { slug: V.slug, kind, phase: 'end', reason, points: pts });
    if (reason === 'away') {
      toast(`${V.person.name}는 먼저 집에 돌아갔어요`, kind === 'fish' ? '🎣' : '🚶');
      end();
      return;
    }
    // 사진 한 장 (주민이 플레이어 옆에 서 있을 때) → 한마디 · 선물
    if (full) {
      const p = S().player.position;
      V.actor.lookAt(p.x, p.z);
      await S().album?.snap?.({ kind: 'together', who: [V.slug], title: `${josa(V.person.name, '와')} 같이 ${kind === 'fish' ? '낚시' : '산책'}` });
    }
    const conv = async () => {
      const vars = {};
      const s = say(V, vars);
      if (reason === 'sleepy') await s(pickLines(L(V.slug).sleepy ?? lines[V.slug]?.goingHome, Math.random));
      else if (!talked) await s(pickLines(L(V.slug).end, Math.random));
      if (gift) {
        vars.item = nameOf(gift);
        await s(pickLines(L(V.slug).gift, Math.random));
        if (giveItem(ctx, gift) > 0) v.pending.push(gift);
      }
      if (up) { V.happy(); toast(`${josa(V.person.name, '와')} 더 친해졌어요`, '💛'); }
    };
    end();
    // 대화는 창이 비어 있을 때 (말 걸어 그만둔 때는 지금 대화 안에서)
    if (talked) await conv();
    else await waitFree().then(() => town.conversation(V, conv));
  }
  function end() {
    if (!C) return;
    const { V } = C;
    dropRod(V, C.rod);
    C = null;
    V.release();
  }
  function waitFree() {
    return new Promise(res => {
      const t0 = performance.now();
      const tick = () => (!S().ui?.isBlocking?.() || performance.now() - t0 > 20000 ? res() : setTimeout(tick, 200));
      tick();
    });
  }

  // 장면이 시작되면 (주민이 배우로 불려 가면) 그만
  ctx.events.on('story:start', () => { if (C && !C.ending) finish('away'); });

  return {
    can, start, talk, refusal, finish,
    /** 지금 같이 노는 주민 slug · 종류 · 진행 */
    get active() { return C ? { slug: C.V.slug, kind: C.kind, phase: C.phase, sec: C.sec, walked: C.walked, caught: C.caught.length, playerCaught: C.playerCaught } : null; },
    with: V => C?.V === V,
  };
}
