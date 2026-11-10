// 11차 M11-P4 옷 갈아입기 (보드 wave11 D100-A · D101-A · D102-A) — ctx.services.outfit. 약속은 docs/CONTRACTS.md 「11차 옷」.
// 주인공 모델(player/index.js)에 옷을 끼운다: 옷 모델을 받아 주인공 뼈대에 다시 묶고(wear.js bindClothes) 툰 재질을 입힌다.
// 윗옷을 바꾸면 몸 모델의 기본 윗옷(player_top = CL-00)을 숨긴다. 저장 칸 state.player.outfit · state.player.closet (주인 = player 모듈).
// 목록 assets/clothes/index.json 은 섬 묶음(처음에 받음), 옷 모델·썸네일은 clothes 묶음(처음에 안 받음 — 입은 옷이 있거나 상점·옷장을 열 때).
import { SLOTS, SLOT_LABEL, bindClothes, setBaseTop, parseWear, paletteOf, wearName } from './wear.js';
import { BASE_TOP_ID, DEFAULT_OUTFIT, CLOTHES_PER_DAY, entryOf, canonical, normalizeOutfit, normalizeCloset, closetBySlot, pickShopClothes, addToCloset } from './outfit-rules.js';
import { RULES } from '../data/tables.js';

export const CLOTHES_INDEX = 'assets/clothes/index.json';
const thumbOf = e => (e?.builtin ? null : `assets/clothes/renders/${e?.slug}_thumb.png`);   // 기본 옷은 그림 없이 색 칸

/**
 * model = 주인공 모델 (툰 합치기까지 끝난 것), outlineWidth = 주인공 외곽선 굵기.
 * 돌려주는 값이 ctx.services.outfit.
 */
export async function createOutfit(ctx, { model, outlineWidth = 0.006 }) {
  const { assets, materials, events, state } = ctx;
  let catalog = { models: [] };
  try { catalog = await assets.loadJSON(CLOTHES_INDEX); } catch (e) { console.warn('[outfit] 옷 목록을 못 읽었어요 — 기본 옷만', e); }
  const P = (state.player ||= {});
  P.closet = normalizeCloset(P.closet, catalog);
  P.outfit = normalizeOutfit(P.outfit, catalog, P.closet);

  const gltfs = new Map();     // slug → Promise<gltf>
  const shown = {};            // 칸 → { id, group, toon }
  let gen = 0;                 // 입히기 세대 (겹친 요청은 마지막 것만)
  let previewing = null;       // 옷장 창에서 입어 보는 중인 칸 묶음

  const gltfOf = slug => {
    if (!gltfs.has(slug)) {
      const e = entryOf(catalog, slug);
      const job = e?.model ? assets.loadModel(e.model.replace(/\.glb\.json$/, '')) : Promise.reject(new Error(`옷 모델 없음 ${slug}`));
      job.catch(() => gltfs.delete(slug));
      gltfs.set(slug, job);
    }
    return gltfs.get(slug);
  };

  /** 한 칸에 옷 하나를 만든다 → { group, toon } | null */
  async function make(id) {
    const w = parseWear(id), e = entryOf(catalog, id);
    if (!w || !e || e.builtin) return null;
    const gltf = await gltfOf(e.slug);
    const { scene } = assets.instantiate(gltf);
    const group = bindClothes(model, scene, { name: `outfit:${e.slot}` });
    if (!group) return null;
    const toon = materials.applyToonStyle(group, { outlineWidth, merge: true });
    for (const [k, hex] of Object.entries(paletteOf(e, w.variant))) toon.setColor(k, hex);
    group.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.outline; o.frustumCulled = false; } });
    return { group, toon };
  }

  function drop(slot) {
    const s = shown[slot];
    if (!s) return;
    s.group?.removeFromParent();
    delete shown[slot];
  }

  /** 칸 묶음을 모델에 입힌다 (저장은 안 함). 같은 칸이 같으면 그대로 */
  async function dress(fit) {
    const my = ++gen;
    const want = { ...DEFAULT_OUTFIT, ...fit };
    const jobs = SLOTS.map(async slot => {
      const id = want[slot] && want[slot] !== BASE_TOP_ID ? want[slot] : null;
      if ((shown[slot]?.id ?? null) === id) return;
      let made = null;
      if (id) {
        try { made = await make(id); } catch (e) { console.warn('[outfit] 옷을 못 입혔어요', id, e); }
      }
      if (my !== gen) { made?.group.removeFromParent(); return; }   // 그 사이 다른 옷을 골랐다
      drop(slot);
      if (made) { model.add(made.group); shown[slot] = { id, ...made }; }
    });
    await Promise.all(jobs);
    if (my === gen) setBaseTop(model, !shown.top);
    return my === gen;
  }

  // 시작: 저장된 옷 (모델을 기다리는 동안은 기본 모습)
  const ready = dress(P.outfit).catch(e => console.warn('[outfit]', e));

  const owns = id => { const c = canonical(catalog, id); return !!c && (c === BASE_TOP_ID || P.closet.includes(c)); };
  const perDay = () => Math.max(0, Math.min(2, RULES.shop?.clothesPerDay ?? CLOTHES_PER_DAY));
  const info = id => {
    const e = entryOf(catalog, id), w = parseWear(id);
    if (!e) return null;
    const c = canonical(catalog, id);
    return { id: c, slug: e.slug, variant: parseWear(c).variant, slot: e.slot, slotName: SLOT_LABEL[e.slot], name: wearName(e, parseWear(c).variant), baseName: e.name,
      buy: e.buy ?? 0, sell: e.sell ?? 0, owned: owns(c), worn: P.outfit[e.slot] === c, thumb: thumbOf(e), swatch: Object.values(paletteOf(e, w?.variant ?? parseWear(c).variant))[e.slot === 'top' && e.kind === 'striped-tee' ? 1 : 0] ?? '#ccc' };
  };

  const api = {
    ready,
    get catalog() { return catalog; },
    slots: SLOTS, slotLabel: SLOT_LABEL,
    /** 입은 옷 { hat, top, shoes } (사본) */
    worn: () => ({ ...P.outfit }),
    /** 옷장에 있는 옷 이름들 (기본 윗옷 빼고, 산 차례) */
    closet: () => [...P.closet],
    /** 칸별 옷장 보기 (옷장 창 UI-19) */
    bySlot: () => closetBySlot(P.closet, catalog),
    owns, info,
    /** 옷장에 더하기 → 새로 들어갔나 */
    add(id) {
      const next = addToCloset(P.closet, id, catalog);
      if (next === P.closet) return false;
      P.closet = next;
      events.emit('outfit:closet', { id: canonical(catalog, id), closet: [...P.closet] });
      return true;
    },
    /** 입기 (저장): 가진 옷만. spin = 빙글 동작 AN-12 */
    async wear(fit, { spin = false } = {}) {
      const next = normalizeOutfit({ ...P.outfit, ...fit }, catalog, P.closet);
      previewing = null;
      const changed = SLOTS.some(s => next[s] !== P.outfit[s]);
      P.outfit = next;
      await dress(next);
      if (spin) ctx.services.player?.play?.('spin');
      if (changed) { events.emit('outfit:changed', { outfit: { ...next } }); ctx.services.data?.save?.save?.(); }
      return changed;
    },
    /** 입어 보기 (저장 안 함, 옷장 창에서) — 가지지 않은 옷도 보여 준다 (상점 미리 보기) */
    async preview(fit) {
      previewing = { ...P.outfit, ...fit };
      return dress(previewing);
    },
    /** 입어 보기 그만 → 저장된 옷으로 */
    async revert() { previewing = null; return dress(P.outfit); },
    get previewing() { return previewing ? { ...previewing } : null; },
    /** 그날 상점 옷 진열대 (D102-A, rules.json shop.clothesPerDay) → [info…] */
    today(dayKey = ctx.services.data?.day?.key?.()) {
      if (!dayKey) return [];
      return pickShopClothes(catalog, dayKey, ctx.state.island?.seed ?? 0, perDay()).map(info).filter(Boolean);
    },
    /** 가게 진열대에 놓을 옷 모델 (쉰 자세 그대로, 툰 재질) → { root, size, slot, dispose } */
    async displayModel(id) {
      const w = parseWear(id), e = entryOf(catalog, id);
      if (!e || e.builtin) return null;
      const gltf = await gltfOf(e.slug);
      const { scene } = assets.instantiate(gltf);
      const toon = materials.applyToonStyle(scene, { outlineWidth, merge: true });
      for (const [k, hex] of Object.entries(paletteOf(e, w.variant))) toon.setColor(k, hex);
      // 뼈대(쉰 자세)째로 둔다: 메시 크기는 쉰 자세 꼭짓점으로 잰다
      const box = new ctx.THREE.Box3();
      scene.traverse(o => { if (o.isMesh && !o.userData.outline) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); o.frustumCulled = false; } });
      return { root: scene, size: box, slot: e.slot, tick() {}, dispose() { scene.removeFromParent(); } };
    },
    /**
     * 사기 (상점 옷 진열대): → 'ok' | 'money' | 'owned' | 'none'. 첫 옷이고 집에 옷장이 없으면 옷장(FU-12)을 가방에 (rules shop.clothesGiftWardrobe)
     * 돌려주는 값 { result, gift } (gift = 옷장을 받았나)
     */
    buy(id) {
      const it = info(id), d = ctx.services.data;
      if (!it || !(it.buy > 0)) return { result: 'none' };
      if (it.owned) return { result: 'owned' };
      if (!d?.wallet?.spend?.(it.buy)) return { result: 'money' };
      api.add(it.id);
      let gift = false;
      const flags = (ctx.state.flags ||= {});
      if (RULES.shop?.clothesGiftWardrobe !== false && !flags.wardrobeGift) {
        const house = ctx.services.house;
        const hasOne = (house?.furniture ?? ctx.state.house?.furniture ?? []).some(r => r.item === 'furn.wardrobe')
          || (d.inventory?.slots ?? []).some(s => s?.id === 'furn.wardrobe');
        if (hasOne) flags.wardrobeGift = 'had';
        else if (d.collect?.('furn.wardrobe', 1)?.added) { flags.wardrobeGift = 'given'; gift = true; }
      }
      events.emit('outfit:bought', { id: it.id, price: it.buy, gift });
      return { result: 'ok', gift, info: it };
    },
  };
  return api;
}
