// 8차 M8-P3 봄 꽃놀이 EV-01 놀이 (보드 wave8 D76-A · D78-A · D82-A, 설정 assets/events/events.json 의 EV-01).
// 행사 기간(7일) 동안 광장 둘레에 벚나무(EN-12)·무대 앞 돗자리(PR-17)·진행판 옆 행사 간판(PR-23)을 놓고 (저장 안 함 — 들어올 때마다 다시 놓는다),
// 행사 시간(hours)에만: 벚나무 밑 꽃잎(IC-EV-01) 줍기 하루 10장 · 돗자리 도시락 하루 한 번 · 간판에서 꽃잎 20 + 나무 2 → 벚꽃 등(FU-43) + 도장.
// 행동 키 우선순위: 간판·돗자리 96 (말 걸기 100 · 축제 시작 101 아래, 문 90 위) · 꽃잎 52 (줍기 50 위).
// 자리 고르기(springSpots)는 순수 함수 — tests/events.test.mjs 가 섬 생성기로 바로 돌린다.
import { giveItem } from '../town/talk.js';

export const EV = 'EV-01';
const PETAL = 'event.petal', WOOD = 'mat.wood', LAMP = 'furn.cherry-lamp';
const LAMP_NEED = { petals: 20, wood: 2 };
const TREES = 8, TREE_GAP = 3.2, RING = 2.4;   // 광장 둘레에서 바깥으로 몇 칸
const PETALS_PER_TREE = 2;
const FLOOR_TOP = 0.09;   // 축제 광장 바닥 무늬 윗면

/**
 * 벚나무·돗자리·간판 자리. isFree(tx, tz) = 놓을 수 있는 풀밭 칸, toTile/toWorld = 섬 좌표 변환, F = world.places.festival.
 * → { trees: [{tx, tz}], picnic: {x, z}, sign: {x, z} } (못 찾은 것은 빠짐)
 */
export function springSpots(F, { isFree, toTile, toWorld }) {
  const out = { trees: [] };
  if (!F) return out;
  const C = F.center ?? F, R = F.radius ?? 6;
  // 벚나무: 광장 바깥 둘레를 돌며 풀밭 빈 칸, 서로 TREE_GAP 넘게
  for (let i = 0; i < 48 && out.trees.length < TREES; i++) {
    const ang = (i * 37) % 360 * Math.PI / 180;   // 37° 씩 건너뛰며 둘레를 고르게
    for (const extra of [0, 0.8, 1.6]) {
      const r = R + RING + extra;
      const t = toTile(C.x + Math.sin(ang) * r, C.z - Math.cos(ang) * r);
      if (!isFree(t.tx, t.tz)) continue;
      const w = toWorld(t.tx, t.tz);
      if (out.trees.some(o => { const q = toWorld(o.tx, o.tz); return Math.hypot(q.x - w.x, q.z - w.z) < TREE_GAP; })) continue;
      out.trees.push(t);
      break;
    }
  }
  // 돗자리: 모닥불과 무대 사이 (무대 쪽 55%)
  if (F.stage) out.picnic = { x: C.x + (F.stage.x - C.x) * 0.55, z: C.z + (F.stage.z - C.z) * 0.55 };
  // 간판: 돗자리 동쪽 2칸, 앞면(+Z)이 남쪽(카메라 쪽)을 본다 — 광장 둘레엔 등불·아치·부스 덮개가 빽빽해서 가운데 쪽에
  if (out.picnic) out.sign = { x: out.picnic.x + 2.0, z: out.picnic.z + 0.2, rot: 0 };
  return out;
}

/** 오늘 꽃잎 자리: 나무마다 PETALS_PER_TREE 개, 날짜로 정해지는 둘레 각도 (같은 날엔 같은 자리) */
export function petalSpots(trees, dayKey, toWorld) {
  let h = 0;
  for (const c of dayKey) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out = [];
  trees.forEach((t, i) => {
    const c = toWorld(t.tx, t.tz);
    for (let k = 0; k < PETALS_PER_TREE; k++) {
      const a = ((h >> (k * 3 + i)) % 360 + k * 170 + i * 45) * Math.PI / 180;
      out.push({ id: `${i}.${k}`, x: c.x + Math.cos(a) * 0.85, z: c.z + Math.sin(a) * 0.85 });
    }
  });
  return out;
}

export function createSpring(ctx, events) {
  const S = () => ctx.services;
  const cfg = events.config.list.find(e => e.id === EV);
  const st = () => (((ctx.state.events ||= {}).spring ||= { picked: {} }));
  let placed = null;          // { ids: [world 물체 id], spots }
  let petals = [];            // [{ id, x, z, mesh }]
  let petalModel = null;
  let petalsLive = false;     // 꽃잎을 마지막으로 그린 때 행사 시간이었나
  const group = new ctx.THREE.Group();
  group.name = 'events:spring-petals';
  ctx.scene.add(group);

  const active = () => events.active().some(r => r.ev.id === EV);
  const live = () => events.isOpen() && events.live().some(r => r.ev.id === EV);
  const today = () => events.today();
  const near = (p, q, d) => !!p && !!q && Math.hypot(p.x - q.x, p.z - q.z) < d;
  const player = () => S().player?.position;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);

  // ---- 놓기 · 거두기 ----
  function place() {
    const W = S().world;
    if (!W?.objects || placed) return;
    const isl = W.island;
    // world.island 은 칸 대신 자리로 묻는다 (isWalkable = 땅 + 충돌체 밖)
    const isFree = (tx, tz) => { const c = isl.toWorld(tx, tz); return isl.tileAt(tx, tz) === 'grass' && isl.isWalkable(c.x, c.z) && !W.objects.at(tx, tz); };
    const spots = springSpots(W.places?.festival, { isFree, toTile: isl.toTile, toWorld: isl.toWorld });
    const ids = [];
    for (const t of spots.trees) ids.push(W.objects.add('cherry-tree', t.tx, t.tz, { persist: false, rot: (t.tx * 13 + t.tz * 7) % 6 }));
    const at = (kind, p, data = {}) => { const t = isl.toTile(p.x, p.z); ids.push(W.objects.add(kind, t.tx, t.tz, { persist: false, at: { x: p.x, z: p.z, ...(p.y != null ? { y: p.y } : {}) }, ...data })); };
    if (spots.picnic) at('event-picnic', { ...spots.picnic, y: FLOOR_TOP });   // 광장 축제 바닥 무늬(world/festival.js, y 0.05 + 두께 0.04) 위
    if (spots.sign) at('event-sign', spots.sign, { rot: spots.sign.rot, variant: 'spring' });
    placed = { ids: ids.filter(Boolean), spots };
    refreshPetals();
  }
  function clear() {
    if (!placed) return;
    for (const id of placed.ids) S().world?.objects?.remove(id);
    placed = null;
    refreshPetals();
  }
  function sync() { if (active()) place(); else clear(); }

  // ---- 꽃잎 (그날 행사 시간에만 보이고, 주우면 사라진다) ----
  async function model() {
    if (petalModel || !ctx.assets?.loadModel) return petalModel;
    try {
      const gltf = await ctx.assets.loadModel('assets/items/models/event-petal');
      const { scene: m } = ctx.assets.instantiate(gltf);
      ctx.materials.applyToonStyle(m, { spec: { style: { outlineWidth: 0.004 } } });
      m.scale.setScalar(1.6);
      petalModel = m;
    } catch (e) { console.warn('[events] 꽃잎 모델을 못 받았어요', e); }
    return petalModel;
  }
  let gen = 0;   // 다시 그리기가 겹치면(모델을 기다리는 사이 또 불림) 마지막 것만 그린다
  async function refreshPetals() {
    const my = ++gen;
    for (const p of petals) group.remove(p.mesh);
    petals = [];
    petalsLive = !!placed && live();
    if (!petalsLive) return;
    const key = today(), picked = st().picked[key] ?? [];
    const W = S().world, isl = W.island;
    const tpl = await model();
    if (my !== gen) return;
    for (const s of petalSpots(placed.spots.trees, key, isl.toWorld)) {
      if (picked.includes(s.id)) continue;
      const mesh = tpl ? tpl.clone() : new ctx.THREE.Object3D();
      mesh.position.set(s.x, isl.heightAt(s.x, s.z) + 0.01, s.z);
      mesh.rotation.y = s.x * 3.1;
      group.add(mesh);
      petals.push({ ...s, mesh });
    }
  }
  const todo = id => events.todo(EV).find(t => t.id === id);

  // ---- 행동 키 ----
  function register(gp) {
    gp.add({
      name: 'events:spring-petal', priority: 52, label: '꽃잎 줍기',
      test() {
        if (!live() || !petals.length) return null;
        const pl = player();
        return petals.find(p => near(pl, p, 0.9)) ?? null;
      },
      run(p) {
        const t = todo('petals');
        if (t?.done) { toast(`오늘 꽃잎은 다 주웠어요 (${t.goal}장). 내일 또 날려요`, '🌸'); return; }
        if (giveItem(ctx, PETAL, 1) > 0) return;   // 가방이 꽉 참 (giveItem 이 알린다)
        (st().picked[today()] ||= []).push(p.id);
        group.remove(p.mesh);
        petals = petals.filter(x => x !== p);
        const r = events.progress(EV, 'petals');
        if (r?.done) toast(`오늘 꽃잎 ${r.goal}장을 다 모았어요!`, '🌸');
      },
    });
    gp.add({
      name: 'events:spring-picnic', intent: 'action', priority: 96, label: '도시락 먹기',
      test() {
        const p = placed?.spots.picnic;
        return live() && near(player(), p, 1.5) ? p : null;
      },
      run() {
        const host = S().town?.villagers?.find(v => v.slug === cfg.host)?.person ?? null;
        const done = todo('picnic')?.done;
        S().ui?.dialog?.open({
          speaker: host?.name ?? '모찌', color: host?.color, voice: cfg.host,
          lines: done ? ['도시락은 내일 또 싸 올게. 오늘은 꽃잎 구경하자!'] : ['꽃 아래서 먹으니까 더 맛있지?', '꽃잎 스무 장을 모으면 간판 앞에서 벚꽃 등을 만들 수 있어.'],
        });
        if (!done) events.progress(EV, 'picnic');
      },
    });
    gp.add({
      name: 'events:spring-sign', intent: 'action', priority: 96,
      label: () => (canLamp() ? '벚꽃 등 만들기' : '행사 안내'),
      test() {
        const p = placed?.spots.sign;
        return events.isOpen() && active() && near(player(), p, 1.4) ? p : null;
      },
      run() {
        if (canLamp() && live()) return makeLamp();
        const inv = S().data?.inventory;
        const lines = [`🌸 ${cfg.name} — 오늘 할 것은 섬폰 📅 달력에서 볼 수 있어요.`,
          `벚꽃 등: 꽃잎 ${inv?.count(PETAL) ?? 0}/${LAMP_NEED.petals} · 나무 ${inv?.count(WOOD) ?? 0}/${LAMP_NEED.wood}`];
        if (!live()) lines.push(`행사 시간은 ${cfg.hours[0]}시부터 ${cfg.hours[1]}시까지예요.`);
        S().ui?.dialog?.open({ speaker: '행사 간판', lines });
      },
    });
  }
  function canLamp() {
    const inv = S().data?.inventory;
    return !!inv && !todo('lamp')?.done && inv.count(PETAL) >= LAMP_NEED.petals && inv.count(WOOD) >= LAMP_NEED.wood;
  }
  function makeLamp() {
    const inv = S().data.inventory;
    if (!inv.canFit?.(LAMP, 1) && inv.isFull?.()) { toast('가방이 꽉 찼어요. 한 칸 비워 주세요', '🎒'); return; }
    inv.removeId(PETAL, LAMP_NEED.petals);
    inv.removeId(WOOD, LAMP_NEED.wood);
    giveItem(ctx, LAMP, 1);
    events.progress(EV, 'lamp');
    if (events.stamp(EV)) toast(`${cfg.name} 도장을 받았어요! (섬폰 📅 달력)`, '🏮');
    ctx.events.emit('sfx', { name: 'pickup' });
  }

  ctx.events.on('time:newday', () => { clear(); sync(); });
  ctx.events.on('time:part', () => refreshPetals());
  ctx.events.on('time:tick', () => { if (petalsLive !== (!!placed && live())) refreshPetals(); });   // 행사 시간이 시작·끝날 때
  ctx.events.on('festival:end', sync);
  events.spot?.(EV, () => placed?.spots.picnic ?? null);
  sync();

  return { register, sync, debug: { get placed() { return placed; }, get petals() { return petals; }, place, clear } };
}
