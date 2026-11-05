// 8차 M8-P5 가을 수확 잔치 EV-03 놀이 (보드 wave8 D78-A · D82-A, 설정 assets/events/events.json 의 EV-03: 10/15–21 · 하루 종일 · feastAt 18).
// 행사 기간 동안 광장 무대 앞(봄 돗자리 자리)에 수확 큰 솥(PR-19), 그 동쪽에 허수아비(PR-20)를 놓고 (저장 안 함),
// 날마다: 나무 밑에 버섯(IC-EV-03 셋) 다섯 — 줍기 · 솥에 과일·버섯 넣기 (섬 모두 합쳐 30, 주민도 하루 둘씩 넣는다) · 18시에 솥이 차 있으면 「잔치」
// → 퐁과 나눠 먹기 + 도장 + 「수확 바구니」(FU-45). 버섯 자리 고르기 mushroomSpots 는 순수 함수 — tests/events.test.mjs.
import { giveItem } from '../town/talk.js';
import { springSpots } from './spring.js';
import { dayHour } from './calendar.js';

export const EV = 'EV-03';
const BASKET = 'furn.harvest-basket';
const POT_GOAL = 30, VILLAGER_DAILY = 2, MUSHROOMS = 5;
/** 버섯 셋 = 모델 하나의 색 변형 (assets/items/specs/event-mushroom.json variants — 게시본엔 아이템 스펙이 없어서 갓 색만 여기에도) */
export const MUSHROOM_KINDS = [
  { id: 'event.mushroom-shiitake', weight: 5, cap: null },
  { id: 'event.mushroom-chanterelle', weight: 3, cap: '#E8A93A', dot: '#F2C14E' },
  { id: 'event.mushroom-red', weight: 2, cap: '#D9443A', dot: '#FBFDF8' },
];
const isPotFood = id => id.startsWith('fruit.') || id.startsWith('event.mushroom');

const hashOf = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };

/**
 * 오늘 버섯 자리: 나무(trees = [{x, z}]) 중 날짜로 고른 다섯 그루 밑, 나무 둘레 0.8칸 · 걸을 수 있는 곳(isFree(x, z)) → [{ id, x, z, kind }]
 * kind = MUSHROOM_KINDS 순번 (무게대로). 같은 날엔 같은 자리·같은 버섯
 */
export function mushroomSpots(trees, dayKey, isFree, n = MUSHROOMS) {
  if (!trees.length) return [];
  let h = hashOf(dayKey);
  const rnd = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const total = MUSHROOM_KINDS.reduce((s, k) => s + k.weight, 0);
  const out = [], used = new Set();
  for (let tries = 0; out.length < n && tries < n * 12; tries++) {
    const ti = Math.floor(rnd() * trees.length);
    if (used.has(ti)) continue;
    const t = trees[ti], a = rnd() * Math.PI * 2;
    const x = t.x + Math.cos(a) * 0.8, z = t.z + Math.sin(a) * 0.8;
    if (!isFree(x, z)) continue;
    used.add(ti);
    let r = rnd() * total, kind = 0;
    while (r >= MUSHROOM_KINDS[kind].weight) r -= MUSHROOM_KINDS[kind++].weight;
    out.push({ id: `m${ti}`, x, z, kind });
  }
  return out;
}

export function createAutumn(ctx, events) {
  const S = () => ctx.services;
  const cfg = events.config.list.find(e => e.id === EV);
  const year = () => (events.active().find(r => r.ev.id === EV)?.year ?? events.today()?.slice(0, 4));
  const st = () => {
    const s = ((ctx.state.events ||= {}).autumn ||= { pot: {}, villagerDay: {}, picked: {} });
    return s;
  };
  const potCount = () => st().pot[year()] ?? 0;
  let placed = null, shrooms = [], tpl = null;
  const group = new ctx.THREE.Group();
  group.name = 'events:autumn-mushrooms';
  ctx.scene.add(group);

  const active = () => events.active().some(r => r.ev.id === EV);
  const live = () => events.isOpen() && events.live().some(r => r.ev.id === EV);
  const feastTime = () => dayHour(S().time?.now?.().hourF ?? 0) >= (cfg.feastAt ?? 18);
  const player = () => S().player?.position;
  const near = (p, q, d) => !!p && !!q && Math.hypot(p.x - q.x, p.z - q.z) < d;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const todo = id => events.todo(EV).find(t => t.id === id);

  function place() {
    const W = S().world;
    if (!W?.objects || placed) return;
    const isl = W.island;
    const sp = springSpots(W.places?.festival, { isFree: () => false, toTile: isl.toTile, toWorld: isl.toWorld });   // 나무는 안 고르고 돗자리 자리만
    if (!sp.picnic) return;
    const ids = [];
    const at = (kind, p, data = {}) => { const t = isl.toTile(p.x, p.z); ids.push(W.objects.add(kind, t.tx, t.tz, { persist: false, at: { x: p.x, z: p.z }, ...data })); };
    const pot = { x: sp.picnic.x, z: sp.picnic.z }, crow = { x: sp.picnic.x + 2.6, z: sp.picnic.z + 0.4 };
    at('event-pot', pot);
    at('event-scarecrow', crow);
    placed = { ids: ids.filter(Boolean), pot, crow };
    villagersPut();
    refreshShrooms();
  }
  function clear() {
    if (!placed) return;
    for (const id of placed.ids) S().world?.objects?.remove(id);
    placed = null;
    refreshShrooms();
  }
  function sync() { if (active()) place(); else clear(); }

  // 주민도 하루 둘씩 솥에 넣는다 (그날 처음 놓을 때, 첫 섬 축제 뒤부터)
  function villagersPut() {
    const s = st(), key = events.today();
    if (!events.isOpen() || s.villagerDay[key]) return;
    s.villagerDay[key] = true;
    const before = potCount();
    s.pot[year()] = Math.min(POT_GOAL, before + VILLAGER_DAILY);
    if (s.pot[year()] > before) events.progress(EV, 'pot', s.pot[year()] - before);
  }

  // ---- 버섯 ----
  async function model() {
    if (tpl || !ctx.assets?.loadModel) return tpl;
    try {
      const gltf = await ctx.assets.loadModel('assets/items/models/event-mushroom');
      const { scene: m } = ctx.assets.instantiate(gltf);
      ctx.materials.applyToonStyle(m, { spec: { style: { outlineWidth: 0.004 } } });
      m.scale.setScalar(1.5);
      tpl = m;
    } catch (e) { console.warn('[events] 버섯 모델을 못 받았어요', e); }
    return tpl;
  }
  function tint(mesh, kind) {
    const K = MUSHROOM_KINDS[kind];
    if (!K.cap) return mesh;
    mesh.traverse(o => {
      if (!o.isMesh || o.userData.outline) return;
      const name = o.material?.name;
      if (name === 'cap' || name === 'dot') { o.material = o.material.clone(); o.material.color.set(name === 'cap' ? K.cap : K.dot); }
    });
    return mesh;
  }
  let gen = 0;   // 다시 그리기가 겹치면 마지막 것만
  async function refreshShrooms() {
    const my = ++gen;
    for (const m of shrooms) group.remove(m.mesh);
    shrooms = [];
    if (!placed || !live()) return;
    const W = S().world, isl = W.island, key = events.today(), picked = st().picked[key] ?? [];
    const trees = W.objects.list('tree').map(o => ({ x: o.x, z: o.z }));
    const m = await model();
    if (my !== gen) return;
    for (const s of mushroomSpots(trees, key, (x, z) => isl.isWalkable(x, z))) {
      if (picked.includes(s.id)) continue;
      const mesh = m ? tint(m.clone(), s.kind) : new ctx.THREE.Object3D();
      mesh.position.set(s.x, isl.heightAt(s.x, s.z), s.z);
      mesh.rotation.y = s.x * 2.3;
      group.add(mesh);
      shrooms.push({ ...s, mesh });
    }
  }

  // ---- 행동 키 ----
  const foodInBag = () => (S().data?.inventory?.slots ?? []).filter(Boolean).filter(s => isPotFood(s.id));
  const canFeast = () => live() && feastTime() && potCount() >= POT_GOAL && !todo('feast')?.done;
  function register(gp) {
    gp.add({
      name: 'events:autumn-mushroom', priority: 52, label: '버섯 줍기',
      test() { if (!live() || !shrooms.length) return null; const pl = player(); return shrooms.find(s => near(pl, s, 0.9)) ?? null; },
      run(s) {
        if (giveItem(ctx, MUSHROOM_KINDS[s.kind].id, 1) > 0) return;
        (st().picked[events.today()] ||= []).push(s.id);
        group.remove(s.mesh);
        shrooms = shrooms.filter(x => x !== s);
        events.progress(EV, 'mushroom');
      },
    });
    gp.add({
      name: 'events:autumn-pot', intent: 'action', priority: 96,
      label: () => (canFeast() ? '잔치 하기' : foodInBag().length && potCount() < POT_GOAL ? '큰 솥에 넣기' : '큰 솥'),
      test() { return live() && placed && near(player(), placed.pot, 1.9) ? placed.pot : null; },
      run() {
        if (canFeast()) return feast();
        const food = foodInBag();
        if (!food.length || potCount() >= POT_GOAL) {
          const left = POT_GOAL - potCount();
          S().ui?.dialog?.open({ speaker: '수확 큰 솥', lines: left > 0 ? [`솥이 ${potCount()}/${POT_GOAL} 찼어요. 과일이나 버섯을 넣어 주세요.`] : [`솥이 가득 찼어요! ${cfg.feastAt}시에 잔치를 열어요.`] });
          return;
        }
        const inv = S().data.inventory;
        let room = POT_GOAL - potCount(), put = 0;
        for (const s of food) {
          if (room <= 0) break;
          const n = Math.min(room, s.count);
          inv.removeId(s.id, n);
          put += n; room -= n;
        }
        st().pot[year()] = potCount() + put;
        events.progress(EV, 'pot', put);
        ctx.events.emit('sfx', { name: 'water' });
        toast(`큰 솥에 ${put}개를 넣었어요 (${potCount()}/${POT_GOAL})`, '🍲');
      },
    });
    gp.add({
      name: 'events:autumn-scarecrow', intent: 'action', priority: 96, label: '허수아비',
      test() { return events.isOpen() && active() && placed && near(player(), placed.crow, 1.3) ? placed.crow : null; },
      run() {
        const t = todo('mushroom');
        S().ui?.dialog?.open({ speaker: '허수아비', lines: [`🍂 ${cfg.name} — 큰 솥 ${potCount()}/${POT_GOAL} · 오늘 버섯 ${t?.n ?? 0}/${t?.goal ?? MUSHROOMS}`, `솥이 차면 ${cfg.feastAt}시에 잔치예요. 버섯은 나무 밑을 살펴봐요.`] });
      },
    });
  }
  async function feast() {
    const host = S().town?.villagers?.find(v => v.slug === cfg.host)?.person ?? null;
    await S().ui?.dialog?.open({ speaker: host?.name ?? '퐁', color: host?.color, voice: cfg.host, lines: ['다 같이 모은 걸로 끓였어! 한 그릇씩 먹자.', '내년에도 솥을 꽉 채워 보자. 이건 오늘 기념이야!'] });
    events.progress(EV, 'feast');
    giveItem(ctx, BASKET, 1);
    if (events.stamp(EV)) toast(`${cfg.name} 도장을 받았어요! (섬폰 📅 달력)`, '🧺');
  }

  ctx.events.on('time:newday', () => { clear(); sync(); });
  ctx.events.on('time:part', () => refreshShrooms());
  ctx.events.on('festival:end', sync);
  events.spot?.(EV, () => placed?.pot ?? null);
  sync();

  return { register, sync, debug: { get placed() { return placed; }, get shrooms() { return shrooms; }, potCount, place, clear, refresh: refreshShrooms } };
}
