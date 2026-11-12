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
 * T = items.json 표, ctx = { itemIcon, weightOf } (items.js 의 도우미).
 * → 아이템 목록 (바다 생물 20 + 스쿠버 키트)
 */
export function seaItems(T, { itemIcon, weightOf }) {
  const out = (T.sea ?? []).map(({ slug, name, time, season, shadow, speed, price, rare, emoji, desc, weight }, i) => ({
    id: `sea.${slug}`, category: SEA_CATEGORY.key, code: `IC-SE-${String(i + 1).padStart(2, '0')}`, name, icon: itemIcon(`sea-${slug}`), emoji, price, desc,
    time, season, hours: T.times[time], months: T.seasons[season], shadow, speed: speed ?? 1, rare: !!rare, weight: weight ?? weightOf(price, rare),
  }));
  const k = T.scubaKit;
  // 손에 드는 도구가 아니라(tool 칸 없음) 가방에 있으면 바다에 들어갈 수 있는 것. 내구도 없음. 입으면 잠수복 CL-13 (바다에서만)
  if (k) out.push({ id: SCUBA_KIT, category: 'tool', code: 'TL-06', name: k.name, icon: itemIcon('tool-scuba-kit'), emoji: k.emoji, price: k.price, buy: k.buy, use: k.use, from: k.from, wear: 'scuba' });
  return out;
}
