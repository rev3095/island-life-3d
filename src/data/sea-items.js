// M16 잠수 (D160–D164): 바다 생물 분류 「바다 생물」 IC-SE-01–20 과 스쿠버 키트 tool.scuba-kit.
// 표 값(이름·시간·계절·그림자 크기·빠르기·값)은 assets/data/items.json 의 sea · scubaKit 칸 (요소 편집기 → "요소 반영"),
// items.js 는 이 파일을 붙이기만 한다 (night-items.js 와 같은 방식). 아이콘 = assets/items/renders/sea-<slug>_thumb.png.
// 잡는 곳·움직임은 src/gameplay/gather/dive.js, 출현은 src/data/spawns.js seaPool.

/** 아이템 분류 하나 (박물관·도감에 들어감 — items.js COLLECTIBLE) */
export const SEA_CATEGORY = { key: 'sea', name: '바다 생물' };
/** 빠르기 0 가만히 · 1 느림 · 2 보통 · 3 빠름 (다가가면 달아나는 정도, dive.js) */
export const SEA_SPEEDS = ['가만히', '느림', '보통', '빠름'];
export const SCUBA_KIT = 'tool.scuba-kit';
/**
 * M18-P1 계절 생물 (D191-A · D197-A): 한 계절(봄·여름·가을·겨울)에만 나오는 바다 생물 모델은 그 계절 묶음 sea-<계절> 에 든다
 * (tools/build-web.mjs PACKS — 처음에 받지 않고, 그 계절 무렵에만 미리 받는다). 여러 계절·연중인 것은 items 묶음 그대로.
 */
export const SEA_PACK_SEASONS = { 봄: 'spring', 여름: 'summer', 가을: 'autumn', 겨울: 'winter' };
/** items.json sea 줄의 계절 → 묶음 이름 (sea-spring …) | null */
export const seaPackOf = season => (SEA_PACK_SEASONS[season] ? `sea-${SEA_PACK_SEASONS[season]}` : null);

/**
 * T = items.json 표, ctx = { itemIcon, weightOf } (items.js 의 도우미).
 * → 아이템 목록 (바다 생물 20 + 스쿠버 키트)
 */
export function seaItems(T, { itemIcon, weightOf }) {
  const out = (T.sea ?? []).map(({ slug, name, time, season, shadow, speed, price, rare, emoji, desc, weight }, i) => ({
    id: `sea.${slug}`, category: SEA_CATEGORY.key, code: `IC-SE-${String(i + 1).padStart(2, '0')}`, name, icon: itemIcon(`sea-${slug}`), emoji, price, desc,
    time, season, hours: T.times[time], months: T.seasons[season], shadow, speed: speed ?? 1, rare: !!rare, weight: weight ?? weightOf(price, rare), pack: seaPackOf(season),
  }));
  const k = T.scubaKit;
  // 손에 드는 도구가 아니라(tool 칸 없음) 가방에 있으면 바다에 들어갈 수 있는 것. 내구도 없음. 입으면 잠수복 CL-13 (바다에서만)
  if (k) out.push({ id: SCUBA_KIT, category: 'tool', code: 'TL-07', name: k.name, icon: itemIcon('tool-scuba-kit'), emoji: k.emoji, price: k.price, buy: k.buy, use: k.use, from: k.from, wear: 'scuba' });
  return out;
}
