// 먼바다 낚시 (east-fishboat, D275–D279): 어선을 타고 나간 먼바다에서만 잡히는 물고기 IC-OF-01–12.
// 분류는 물고기(fish) 그대로라 도감 물고기 탭 · 박물관 물고기관 · 대회 · 상점이 그대로 받는다. 서식지 'offshore' 는 섬 낚시 자리(강·연못·바다·선착장·하구)
// 어디에도 없어서 섬에서는 안 나오고, 배 위 낚시(src/gameplay/boat/)만 'offshore' 를 준다.
// 표 값(이름·시간·계절·그림자 크기·값)은 assets/data/items.json 의 offshore 칸 (요소 편집기 → "요소 반영"), items.js 는 이 파일을 붙이기만 한다.
// 아이콘 = assets/items/renders/fish-<slug>_thumb.png (스펙 assets/items/specs/fish-<slug>.json, id IC-OF-NN).

/** 먼바다 서식지 이름 (spawns.HABITAT_POOLS · gather/fishing.js habitatAt 갈고리) */
export const OFFSHORE_HABITAT = 'offshore';
const FISH_COLOR_DEFAULT = ['#8FA7B5', '#6E8898', '#F7F1E4', '#7E98A8'];

/** T = items.json 표, ctx = { itemIcon, weightOf } → 물고기 아이템 목록 (code OF-01…) */
export function offshoreItems(T, { itemIcon, weightOf }) {
  return (T.offshore ?? []).map(({ slug, name, place, time, season, shadow, price, rare, emoji, desc, colors, weight }, i) => ({
    id: `fish.${slug}`, category: 'fish', code: `OF-${String(i + 1).padStart(2, '0')}`, name, icon: itemIcon(`fish-${slug}`), emoji, price, desc,
    place: place ?? '먼바다', time, season, habitats: T.fishPlaces[place ?? '먼바다'] ?? [OFFSHORE_HABITAT], hours: T.times[time], months: T.seasons[season],
    shadow, rare: !!rare, weight: weight ?? weightOf(price, rare), offshore: true,
    colors: (([body, back, belly, fin]) => ({ body, back, belly, fin }))(colors ?? FISH_COLOR_DEFAULT),
  }));
}
