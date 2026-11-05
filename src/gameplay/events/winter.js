// 8차 M8-P6 겨울 눈사람 날 EV-04 놀이 (보드 wave8 D76–D82 겨울 줄, 설정 assets/events/events.json 의 EV-04: 12/20–26 · 9–17시).
// 행사 시간에 광장 남쪽 풀밭에 작은 눈덩이(PR-21) 둘이 날마다 놓인다. 「눈덩이 밀기」로 앞에 붙이고 걸으면 걸은 만큼 커진다 (지름 0.4 → 1.6칸).
// 「놓기」로 내려놓고, 다른 눈덩이를 밀고 와서 더 큰 눈덩이 옆에서 「머리 얹기」 → 눈사람(PR-22) — 몸·머리 비율로 표정 넷(faceOf).
// 하루 하나 · 눈사람마다 눈 결정(IC-EV-04) 셋 · 셋째 눈사람에 「눈사람 등」(FU-46) + 도장. 만든 눈사람은 그 해 행사가 끝날 때까지 남는다 (state.events.winter.snowmen).
// 눈덩이는 움직이고 커져야 해서 world 물체가 아니라 이 모듈이 그리는 메시, 다 만든 눈사람만 world 물체(persist: false, 들어올 때마다 다시 놓음).
// 눈사람 모델은 묶음(instanced)이라 머리·몸을 따로 늘릴 수 없어 크기 하나(몸 기준)로 놓고 표정은 알림 이모지로 — M8-P7/P8 에서 모델 표정 넷 제안.
import { giveItem } from '../town/talk.js';

export const EV = 'EV-04';
const CRYSTAL = 'event.snow-crystal', LAMP = 'furn.snowman-lamp';
const BALL_R = 0.4;                 // 눈덩이 모델 반지름 (scale 1)
const MIN_S = 0.5, MAX_S = 2.0;     // 지름 0.4 → 1.6칸
const GROW = 0.09;                  // 걸은 한 칸마다 scale 이만큼
const BALLS_PER_DAY = 2;

/** 몸·머리 크기(scale) → 표정 { key, emoji, label } — 보드 EV-04: 딱 맞음 😊 · 머리 큼 😮 · 몸 큼 😌 · 비슷 🙂 */
export function faceOf(body, head) {
  const r = head / body;
  if (r > 0.9) return { key: 'wow', emoji: '😮', label: '머리가 커서 깜짝 놀란' };
  if (r >= 0.5 && r <= 0.75) return { key: 'smile', emoji: '😊', label: '딱 맞아서 웃는' };
  if (r < 0.5) return { key: 'calm', emoji: '😌', label: '몸이 커서 든든한' };
  return { key: 'plain', emoji: '🙂', label: '둘이 비슷한' };
}
/** 걸은 거리만큼 커진 scale */
export const grown = (s, dist) => Math.min(MAX_S, s + Math.max(0, dist) * GROW);

/** 오늘 눈덩이 자리: 광장 가운데에서 남쪽으로 R+3 칸 둘레, 날짜로 정한 각도 → [{x, z}] (isFree(x, z) 인 곳만) */
export function ballSpots(F, dayKey, isFree, n = BALLS_PER_DAY) {
  if (!F) return [];
  const C = F.center ?? F, R = (F.radius ?? 6) + 3;
  let h = 0;
  for (const c of dayKey) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  const out = [];
  for (let i = 0; i < 24 && out.length < n; i++) {
    const a = Math.PI + ((h + i * 47) % 120 - 60) * Math.PI / 180;   // 남쪽 ±60°
    const x = C.x + Math.sin(a) * R, z = C.z - Math.cos(a) * R;
    if (isFree(x, z) && out.every(p => Math.hypot(p.x - x, p.z - z) > 2.5)) out.push({ x, z });
  }
  return out;
}

export function createWinter(ctx, events) {
  const S = () => ctx.services;
  const cfg = events.config.list.find(e => e.id === EV);
  const st = () => (((ctx.state.events ||= {}).winter ||= { snowmen: {}, ballsDay: null }));
  const year = () => String(events.active().find(r => r.ev.id === EV)?.year ?? events.today()?.slice(0, 4));
  const group = new ctx.THREE.Group();
  group.name = 'events:winter-balls';
  ctx.scene.add(group);
  let balls = [], pushing = null, snowIds = [], tpl = null, last = null, ballsLive = false;

  const active = () => events.active().some(r => r.ev.id === EV);
  const live = () => events.isOpen() && events.live().some(r => r.ev.id === EV);
  const player = () => S().player;
  const near = (p, q, d) => !!p && !!q && Math.hypot(p.x - q.x, p.z - q.z) < d;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const todo = id => events.todo(EV).find(t => t.id === id);
  const front = (pl, d) => { const f = Number.isFinite(pl.facing) ? pl.facing : 0; return { x: pl.position.x - Math.sin(f) * d, z: pl.position.z - Math.cos(f) * d }; };   // facing 0 = 북쪽 (player/index.js)

  async function model() {
    if (tpl || !ctx.assets?.loadEnv) return tpl;
    try {
      const gltf = await ctx.assets.loadEnv('event-snowball');
      const { scene: m } = ctx.assets.instantiate(gltf);
      ctx.materials.applyToonStyle(m, { spec: { style: { outlineWidth: 0.01 } } });
      tpl = m;
    } catch (e) { console.warn('[events] 눈덩이 모델을 못 받았어요', e); }
    return tpl;
  }
  const isl = () => S().world.island;
  function setBall(b) { b.mesh.scale.setScalar(b.s); b.mesh.position.set(b.x, isl().heightAt(b.x, b.z), b.z); }

  // ---- 눈덩이 · 눈사람 놓기 ----
  let gen = 0;   // 다시 그리기가 겹치면 마지막 것만
  async function refresh() {
    const my = ++gen;
    for (const b of balls) group.remove(b.mesh);
    balls = []; pushing = null;
    const W = S().world;
    ballsLive = !!W?.objects && live();
    if (!ballsLive) return;
    const m = await model();
    if (my !== gen) return;
    for (const p of ballSpots(W.places?.festival, events.today(), (x, z) => isl().isWalkable(x, z) && isl().tileAt(...Object.values(isl().toTile(x, z))) === 'grass')) {
      const b = { x: p.x, z: p.z, s: MIN_S, mesh: m ? m.clone() : new ctx.THREE.Object3D() };
      setBall(b); group.add(b.mesh); balls.push(b);
    }
  }
  function placeSnowmen() {
    const W = S().world;
    for (const id of snowIds) W?.objects?.remove(id);
    snowIds = [];
    if (!W?.objects || !active()) return;
    for (const sm of st().snowmen[year()] ?? []) {
      const t = W.island.toTile(sm.x, sm.z);
      const id = W.objects.add('event-snowman', t.tx, t.tz, { persist: false, at: { x: sm.x, z: sm.z }, scale: sm.scale, variant: sm.variant, rot: sm.rot });
      if (id) snowIds.push(id);
    }
  }
  function sync() { placeSnowmen(); refresh(); }

  // ---- 밀기: 플레이어 앞에 붙어 걸은 만큼 커진다 ----
  function update() {
    const pl = player();
    if (!pushing || !pl?.position) { last = null; return; }
    if (!live()) { drop(); return; }
    const p = pl.position;
    if (last) {
      const d = Math.hypot(p.x - last.x, p.z - last.z);
      const f = front(pl, BALL_R * pushing.s + 0.35);
      const onSnow = isl().tileAt(...Object.values(isl().toTile(f.x, f.z))) === 'grass' && isl().isWalkable(f.x, f.z);
      if (d > 0 && d < 1 && onSnow) pushing.s = grown(pushing.s, d);
      roll(pushing, f.x - pushing.x, f.z - pushing.z);
      Object.assign(pushing, f);
      setBall(pushing);
    }
    last = { x: p.x, z: p.z };
  }
  function drop() { pushing = null; last = null; }
  // 굴러가기: 모델의 'ball' 부품(가운데가 공 중심, build_env.py b_snowball pivot)을 간 방향에 맞게 돌린다 — 축 = 위 × 간 방향, 각 = 거리 / 반지름
  const spin = { axis: null, q: null };
  function roll(b, dx, dz) {
    const d = Math.hypot(dx, dz);
    if (!(d > 1e-4 && d < 1)) return;
    const node = (b.ball ??= b.mesh.getObjectByName?.('ball') ?? null);
    if (!node) return;
    spin.axis ??= new ctx.THREE.Vector3(); spin.q ??= new ctx.THREE.Quaternion();
    const a = d / (BALL_R * b.s);
    node.quaternion.premultiply(spin.q.setFromAxisAngle(spin.axis.set(dz / d, 0, -dx / d), a));
    b.rolled = (b.rolled ?? 0) + a;   // 돈 각 합 (확인용)
  }

  function build(body, head) {
    const face = faceOf(body.s, head.s);
    const sm = { x: body.x, z: body.z, scale: +(body.s * BALL_R / 0.38).toFixed(3), face: face.key, variant: ['red', 'blue', 'green', 'yellow'][(st().snowmen[year()]?.length ?? 0) % 4], rot: 0, day: events.today() };
    ((st().snowmen[year()] ||= [])).push(sm);
    for (const b of [body, head]) { group.remove(b.mesh); balls = balls.filter(x => x !== b); }
    pushing = null;
    placeSnowmen();
    const daily = todo('snowman');
    if (!daily?.done) {
      events.progress(EV, 'snowman');
      giveItem(ctx, CRYSTAL, 3);
      const r = events.progress(EV, 'three');
      if (r?.done && events.stamp(EV)) { giveItem(ctx, LAMP, 1); toast(`눈사람 셋! 두부가 「눈사람 등」을 줬어요 — ${cfg.name} 도장`, '⛄'); }
    }
    toast(`${face.emoji} ${face.label} 눈사람이 생겼어요! 행사가 끝날 때까지 남아요`, '⛄');
  }

  function register(gp) {
    // 밀고 있을 때 (놓기·머리 얹기): 말 걸기(100)·축제 시작(101)보다 먼저 — 주인공 두부가 눈덩이 둘레에 서 있어서 (M8-P8 점검에서 찾음)
    gp.add({
      name: 'events:winter-carry', priority: 102,
      label: t => (t.kind === 'stack' ? '머리 얹기' : '놓기'),
      test() {
        if (!pushing || !live()) return null;
        const base = balls.find(b => b !== pushing && b.s > pushing.s && near(b, pushing, BALL_R * (b.s + pushing.s) + 0.5));
        return base ? { kind: 'stack', base } : { kind: 'drop' };
      },
      run(t) { if (t.kind === 'stack') build(t.base, pushing); else drop(); },
    });
    // 눈덩이 바로 앞: 문·우편함(90)보다 먼저, 말 걸기(100)보다는 뒤
    gp.add({
      name: 'events:winter-ball', priority: 97, label: '눈덩이 밀기',
      test() {
        if (pushing || !live()) return null;
        const pl = player();
        if (!pl?.position) return null;
        const f = front(pl, 0.5);
        return balls.find(x => near(x, f, BALL_R * x.s + 0.6)) ?? null;
      },
      run(b) { pushing = b; last = null; toast('걸으면 눈덩이가 커져요. 눈 덮인 풀밭에서만!', '❄️'); },
    });
  }

  ctx.events.on('time:newday', sync);
  ctx.events.on('time:tick', () => { if (ballsLive !== (!!S().world?.objects && live())) refresh(); });   // 행사 시간이 시작·끝날 때
  ctx.events.on('festival:end', sync);
  events.spot?.(EV, () => balls[0] ? { x: balls[0].x, z: balls[0].z } : (S().world?.places?.festival ?? null));
  sync();

  return { register, update, sync, debug: { get balls() { return balls; }, get pushing() { return pushing; }, get snowIds() { return snowIds; }, refresh } };
}
