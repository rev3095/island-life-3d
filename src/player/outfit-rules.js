// 11차 M11-P4 옷 규칙 (보드 wave11 D100-A 옷 갈아입기 · D101-A 주인공만 · D102-A 도토리상점 옷 진열대) — 순수 함수 (tests/outfit.test.mjs).
// 옷 목록 = assets/clothes/index.json (node tools/build-clothes.mjs). 옷 한 벌의 이름 = 'slug' 또는 색 변형이 있으면 'slug@변형'.
// 저장: state.player.outfit = { hat, top, shoes } (입은 것, 없으면 null — 윗옷은 늘 하나, 기본 'basic-tee')
//       state.player.closet = [옷 이름…] (옷장에 있는 것, 산 차례. 기본 윗옷은 늘 가진 것으로 친다 — 목록에 넣지 않는다)
import { rngFor, sample } from '../data/rng.js';
import { SLOTS, parseWear, wearId } from './wear.js';

export const BASE_TOP_ID = 'basic-tee';
export const DEFAULT_OUTFIT = Object.freeze({ hat: null, top: BASE_TOP_ID, shoes: null });
/** 상점 하루 옷 수 기본값 (실제 값은 assets/data/rules.json shop.clothesPerDay — 요소 편집기 「상점」) */
export const CLOTHES_PER_DAY = 2;

/** 목록에서 한 벌 찾기 (이름에 변형이 붙어 있어도) */
export const entryOf = (catalog, id) => {
  const w = parseWear(id);
  return w ? (catalog?.models ?? []).find(c => c.slug === w.slug) ?? null : null;
};

/** 이 이름이 목록에 있는 옷인가 (변형이 있으면 변형 이름도 맞아야) */
export function validWear(catalog, id) {
  const w = parseWear(id), e = entryOf(catalog, id);
  if (!w || !e) return false;
  const keys = Object.keys(e.variants ?? {});
  return w.variant ? keys.includes(w.variant) : true;
}

/** 이름을 고르게: 변형이 있는 옷인데 변형이 없으면 첫(기본) 변형을 붙인다 */
export function canonical(catalog, id) {
  const w = parseWear(id), e = entryOf(catalog, id);
  if (!w || !e) return null;
  const keys = Object.keys(e.variants ?? {});
  return keys.length ? wearId(e.slug, w.variant && keys.includes(w.variant) ? w.variant : keys[0]) : e.slug;
}

/** 저장된 칸 → 고른 칸 (모르는 옷 · 칸이 다른 옷 · 가지지 않은 옷은 빼고, 윗옷이 비면 기본) */
export function normalizeOutfit(saved, catalog, closet = []) {
  const out = { ...DEFAULT_OUTFIT };
  const own = new Set([BASE_TOP_ID, ...closet.map(c => canonical(catalog, c)).filter(Boolean)]);
  for (const slot of SLOTS) {
    const id = saved?.[slot];
    if (id == null) { if (slot !== 'top') out[slot] = null; continue; }
    const c = canonical(catalog, id), e = entryOf(catalog, id);
    if (c && e?.slot === slot && own.has(c)) out[slot] = c;
  }
  if (!out.top) out.top = BASE_TOP_ID;
  return out;
}

/** 옷장 목록 고르게 (모르는 것·겹친 것 빼기, 기본 윗옷 빼기) */
export function normalizeCloset(list, catalog) {
  const seen = new Set();
  for (const id of Array.isArray(list) ? list : []) {
    const c = canonical(catalog, id);
    if (c && c !== BASE_TOP_ID && !entryOf(catalog, c)?.builtin) seen.add(c);
  }
  return [...seen];
}

/** 칸별 옷장 보기: { hat: [{ id, entry, variant }], … } — 모자·신발은 맨 앞에 '없음'(id null), 윗옷은 기본 티가 맨 앞 */
export function closetBySlot(closet, catalog) {
  const by = Object.fromEntries(SLOTS.map(s => [s, s === 'top' ? [] : [{ id: null, entry: null, variant: null }]]));
  const base = entryOf(catalog, BASE_TOP_ID);
  if (base) by.top.push({ id: BASE_TOP_ID, entry: base, variant: null });
  for (const id of closet) {
    const e = entryOf(catalog, id);
    if (e && by[e.slot]) by[e.slot].push({ id, entry: e, variant: parseWear(id).variant });
  }
  return by;
}

/** 가게에 나올 수 있는 옷 (기본 옷 빼고 모델이 있는 것 · 값이 있는 것) — 변형마다 하나씩 */
export function shopPool(catalog) {
  const out = [];
  for (const e of catalog?.models ?? []) {
    if (e.builtin || !(e.buy > 0) || !e.model) continue;
    const keys = Object.keys(e.variants ?? {});
    if (keys.length) for (const k of keys) out.push(wearId(e.slug, k));
    else out.push(e.slug);
  }
  return out;
}

/**
 * 그날의 옷 (D102-A 하루 옷 둘): 섬 시드 + 날짜로 정해서 같은 날엔 늘 같다. 같은 옷의 다른 색은 같은 날 함께 나오지 않는다.
 * → [옷 이름…] (진열대 순서)
 */
export function pickShopClothes(catalog, dayKey, seed = 0, perDay = CLOTHES_PER_DAY) {
  const pool = shopPool(catalog);
  const rng = rngFor(seed, dayKey, 'clothes');
  const order = sample(pool, pool.length, rng);
  const out = [], slugs = new Set();
  for (const id of order) {
    if (out.length >= perDay) break;
    const s = parseWear(id).slug;
    if (slugs.has(s)) continue;
    slugs.add(s);
    out.push(id);
  }
  return out;
}

/** 옷장에 더하기 → 새 목록 (이미 있으면 그대로) */
export function addToCloset(closet, id, catalog) {
  const c = canonical(catalog, id);
  if (!c || c === BASE_TOP_ID || closet.includes(c)) return closet;
  return [...closet, c];
}
