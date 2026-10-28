// 꽃밭과 심기.
//   심기 (F · 우선순위 45): 삽으로 판 구덩이 앞에서 F → 가방에서 씨앗·꽃·묘목·과일을 골라 심는다.
//     씨앗 → 꽃봉오리(다음 날 핀다), 꽃 → 바로 그 색, 묘목·과일 → 어린 나무(나흘 뒤 다 자람), 야자열매는 모래에만.
//   꽃 꺾기: 줍기(F)가 꽃도 줍는다 (다른 주울 것이 없을 때). 삽으로 꽃을 파면 꽃 아이템이 된다.
//   꽃 피우기: 새 날(data:newday)에 어제 물 준 꽃 옆 같은 종류 꽃과 짝을 지어 빈 칸에 새 꽃 (규칙은 breeding.js).
import { breed } from './breeding.js';
import { eul, rand } from './util.js';

export const FLOWER_KINDS = new Set(['tulip', 'cosmos', 'pansy']);
const TREE_KINDS = new Set(['tree', 'cedar', 'fruit-tree', 'palm']);
const FLOWER_SCALE = 1.3;

export function createGarden(ctx, kit, { fx, act }) {
  const { state, events } = ctx;
  const keyOf = (tx, tz) => `${tx},${tz}`;

  /** 꽃 색 목록 (마지막 = 교배로만 피는 색) */
  const colorsOf = kind => (kit.data?.items?.list?.('flower') ?? []).filter(f => f.kind === kind).map(f => f.variant);
  const flowerItem = (kind, variant) => `flower.${kind}-${variant}`;

  // ---------- 무엇을 어디에 심나 ----------
  /** 아이템 → 심을 모습 { kind, variant, data, scale, needs: 'grass'|'sand' } | null */
  function plantOf(id) {
    const it = kit.item(id);
    if (!it) return null;
    if (it.category === 'seed' && it.flower) {
      const base = colorsOf(it.flower).slice(0, -1);
      return { kind: it.flower, variant: base[Math.floor(Math.random() * base.length)] ?? null, scale: 0.55, grow: { stage: 0, max: 1 }, needs: 'grass' };
    }
    if (it.category === 'seed' && it.tree) return { kind: it.tree, variant: null, scale: 0.32, grow: { stage: 0, max: 4 }, needs: 'grass' };
    if (it.category === 'flower') return { kind: it.kind, variant: it.variant, scale: FLOWER_SCALE, needs: 'grass' };
    if (it.category === 'fruit' && it.id === 'fruit.coconut') return { kind: 'palm', variant: 'picked', scale: 0.32, grow: { stage: 0, max: 4 }, needs: 'sand' };
    if (it.category === 'fruit' && it.variant) return { kind: 'fruit-tree', variant: 'picked', scale: 0.32, grow: { stage: 0, max: 4 }, needs: 'grass', data: { fruit: it.variant } };
    return null;
  }
  /** 이 구덩이에 이 아이템을 심을 수 있나 */
  function canPlant(id, tx, tz) {
    const p = plantOf(id), isl = kit.world.island;
    if (!p) return false;
    const tile = isl.tileAt(tx, tz);
    if (p.needs === 'sand' ? tile !== 'sand' : tile !== 'grass') return false;
    if (TREE_KINDS.has(p.kind)) {
      // 나무는 둘레 한 칸에 다른 나무·건물이 없어야 한다
      const c = isl.toWorld(tx, tz);
      if (kit.world.objects.query(c.x, c.z, 1.45).some(o => TREE_KINDS.has(o.kind) || o.kind.startsWith('house') || ['shop', 'museum', 'rock'].includes(o.kind))) return false;
    }
    return true;
  }
  const holeInFront = () => {
    const p = kit.player, world = kit.world;
    if (!p || !world?.daily) return null;
    const t = p.tileInFront();
    return world.daily.holes().includes(keyOf(t.tx, t.tz)) ? t : null;
  };

  async function plant(t) {
    const inv = kit.data.inventory;
    const ok = (slot) => slot && canPlant(slot.id, t.tx, t.tz);
    if (!inv.slots.some(ok)) {
      const sand = kit.world.island.tileAt(t.tx, t.tz) === 'sand';
      kit.toast(sand ? '모래에는 야자열매만 심을 수 있어요' : '심을 씨앗·묘목·꽃·과일이 없어요', '🌱');
      return;
    }
    const slot = await ctx.services.ui?.bag?.open?.({ mode: 'pick', title: '무엇을 심을까요?', hint: '씨앗·묘목·꽃·과일', filter: s => ok(s) });
    if (slot == null || !ok(inv.slots[slot])) return;
    const id = inv.slots[slot].id;
    const p = plantOf(id);
    const world = kit.world;
    const c = world.island.toWorld(t.tx, t.tz);
    kit.player.face(c.x, c.z);
    await act('pickup', {
      onHit() {
        if (!world.daily.holes().includes(keyOf(t.tx, t.tz)) || !inv.slots[slot] || inv.slots[slot].id !== id) return;
        inv.remove(slot, 1);
        world.daily.removeHole(t.tx, t.tz);
        events.emit('gather:garden', {});
        const objId = world.objects.add(p.kind, t.tx, t.tz, { rot: rand(0, Math.PI * 2), scale: p.scale, variant: p.variant, ...(p.data ?? {}), ...(p.grow ? { grow: p.grow } : {}) });
        kit.sfx('dig', { volume: 0.6, pitch: 1.2 });
        fx.dust({ x: c.x, y: world.island.heightAt(c.x, c.z), z: c.z }, 5);
        kit.toast(`${eul(kit.name(id))} 심었다`, kit.icon(id));
        events.emit('gather:planted', { id: objId, item: id });
      },
    });
  }

  // ---------- 꽃 꺾기 · 파기 ----------
  /** 꽃 물체 → 아이템 id (자라는 중이면 null) */
  const itemOfFlower = o => (FLOWER_KINDS.has(o.kind) && !o.data?.grow && o.variant ? flowerItem(o.kind, o.variant) : null);
  function takeFlower(o) {
    kit.world.objects.remove(o.id);
    const w = state.island.watered;
    if (w?.ids) { const i = w.ids.indexOf(o.id); if (i >= 0) w.ids.splice(i, 1); }
    events.emit('gather:garden', {});
  }

  // ---------- 새 날: 물 준 꽃 옆에 새 꽃 ----------
  function bloom(prev) {
    const w = state.island.watered, world = kit.world, d = kit.data;
    if (!w?.ids?.length || !world || !d) return;
    if (prev && w.dayKey !== prev) { state.island.watered = { dayKey: d.day.key(), ids: [] }; return; }
    const watered = new Set(w.ids);
    const isl = world.island;
    const flowers = world.objects.list().filter(o => FLOWER_KINDS.has(o.kind) && !o.data?.grow && o.variant)
      .map(o => ({ id: o.id, kind: o.kind, variant: o.variant, tx: o.tile.tx, tz: o.tile.tz, watered: watered.has(o.id), level: isl.levelAt(o.tile.tx, o.tile.tz) }));
    const byId = new Map(flowers.map(f => [f.id, f]));
    const holes = new Set(world.daily?.holes?.() ?? []);
    const colors = Object.fromEntries([...FLOWER_KINDS].map(k => [k, colorsOf(k)]));
    const free = (tx, tz) => {
      if (isl.tileAt(tx, tz) !== 'grass' || world.objects.at(tx, tz) || holes.has(keyOf(tx, tz))) return false;
      const c = isl.toWorld(tx, tz);
      return isl.isWalkable(c.x, c.z);
    };
    // 언덕 가장자리 너머(높이가 다른 칸)에는 피지 않는다
    const kids = breed(flowers, { colors, free, rng: d.day.rng('bloom') }).filter(k => isl.levelAt(k.tx, k.tz) === byId.get(k.parents[0]).level);
    const ids = [];
    for (const k of kids) ids.push(world.objects.add(k.kind, k.tx, k.tz, { variant: k.variant, rot: rand(0, Math.PI * 2), scale: FLOWER_SCALE }));
    state.island.watered = { dayKey: d.day.key(), ids: [] };
    if (ids.length) {
      kit.toast(`물 준 꽃 옆에 새 꽃이 ${ids.length}송이 피었어요!`, '🌷');
      events.emit('gather:bloom', { ids });
    }
  }
  events.on('data:newday', e => bloom(e?.prev ?? null));

  return {
    plantOf, canPlant, holeInFront, plant, itemOfFlower, takeFlower, bloom, colorsOf,
    /** 덜 자란 나무·꽃봉오리 */
    isYoung: o => !!o?.data?.grow,
  };
}
