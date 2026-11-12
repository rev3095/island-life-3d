// 아이템 사전. 원본은 concept/concept-board.html 의 FISH·BUGS·FOSSILS·MATS·TOOLS·FURN 표.
// 6차(M6-P5)부터 표 값(이름·장소·시간·계절·가격·사는 값)은 assets/data/items.json 에 있고 (표 편집기 data-editor.html → "숫자 반영"),
// 여기서는 게임에서 쓰기 좋은 칸(id·code·icon·habitats·hours·months·weight …)을 덧붙인다.
// price = 파는 값(도토리), buy = 상점에서 살 때 값.
import { ITEM_TABLE as T } from './tables.js';
// 5차 Z5 축제 분류·아이템·가구는 festival-items.js 에서 붙인다 (분류는 아래 CATEGORIES, 가구 FU-34 는 가구 줄, 아이템 IC-FE 는 ITEMS 뒤)
import { FESTIVAL_CATEGORY as FC, FESTIVAL_FURN, festivalItems } from './festival-items.js';
// 8차 계절 행사 분류·채집·보상 가구는 event-items.js 에서 (가구는 보드 ID FU-43– 를 code 로 그대로)
import { EVENT_CATEGORY as EC, EVENT_FURN, eventItems } from './event-items.js';
// 9차 섬 꾸미기 야외 가구 FU-47–50 와 밖에 놓을 수 있는 가구 표시(outdoor)는 decor-items.js 에서
import { DECOR_FURN, FAVOR_FURN, OUTDOOR } from './decor-items.js';   // 10차 좋아하는 가구 FU-51–53 은 FAVOR_FURN
// 12차 밤·새벽 분류(야시장 먹거리 IC-NT)·달빛 가게·새벽 천막 가구 FU-55–59 는 night-items.js 에서
import { NIGHT_CATEGORY as NC, NIGHT_FURN, nightItems } from './night-items.js';
// M16 잠수: 바다 생물 분류(IC-SE-01–20)와 스쿠버 키트는 sea-items.js 에서 (표 값은 items.json sea · scubaKit)
import { SEA_CATEGORY as SC, seaItems } from './sea-items.js';

export const CATEGORIES = ['fish', 'bug', 'fossil', 'fruit', 'shell', 'flower', 'mat', 'tool', 'furn', 'seed'];
export const CATEGORY_NAMES = { fish: '물고기', bug: '곤충', fossil: '화석', fruit: '과일', shell: '조개', flower: '꽃', mat: '재료', tool: '도구', furn: '가구', seed: '씨앗·묘목' };
CATEGORIES.push(FC.key, EC.key, NC.key); CATEGORY_NAMES[FC.key] = FC.name; CATEGORY_NAMES[EC.key] = EC.name; CATEGORY_NAMES[NC.key] = NC.name;
CATEGORIES.push(SC.key); CATEGORY_NAMES[SC.key] = SC.name;

/** 한 칸에 쌓이는 최대 개수 (아이템에 stack 이 있으면 그 값) */
export const STACK = { [SC.key]: 1, ...T.stack, [FC.key]: FC.stack, [EC.key]: EC.stack, [NC.key]: NC.stack };
/** 계절 표기 → 달 목록 */
export const SEASON_MONTHS = T.seasons;
/** 시간 표기 → [시작, 끝) 시각 구간. 낮 = 새벽~저녁(5~19시), 밤 = 저녁~새벽(17~5시). 저녁엔 둘 다 나온다 */
export const TIME_HOURS = T.times;
/** 물고기 장소 표기 → 서식지 (하구는 강 끝이라 강으로도 친다), 곤충 장소 표기 → 계약의 place 값 ('shake' 나무 흔들기 · 'under' 바위 밑) */
const FISH_PLACE = T.fishPlaces;
const BUG_PLACE = T.bugPlaces;

/** 출현 가중치: 희귀 1, 비쌀수록 드묾 (값 기준은 표의 weight.byPrice, 줄마다 weight 를 적으면 그 값) */
const weightOf = (price, rare) => (rare ? T.weight.rare : T.weight.byPrice.find(([min]) => price >= min)?.[1] ?? T.weight.base);

// 감정 전 화석 (4차 Y2): 화석 자리를 파면 이것이 나오고, 박물관 느루가 감정하면 화석 8종 중 하나가 된다.
// 카테고리는 화석이지만 list('fossil')·박물관·도감에는 들어가지 않는다 (unknown: true). 상점에선 싸게 팔린다.
export const UNKNOWN_FOSSIL = 'fossil.unknown';

// 물고기 몸 색 (잡아서 들어 보일 때): 몸·등·배·지느러미. 모양은 모두 같고 색만 다르다
const FISH_COLOR_DEFAULT = ['#8FA7B5', '#6E8898', '#F7F1E4', '#7E98A8'];

const code = (p, i) => `${p}-${String(i + 1).padStart(2, '0')}`;
const sizeOf = s => (s.includes('×') ? s.split('×').map(Number) : [1, 1]);
const placeOf = s => (s === '벽' ? 'wall' : s === '창문' ? 'window' : 'floor');
// 아이콘 = 아이템 모델 썸네일 그림 (assets/items, 5차 Z1 · tools/build-item.mjs). 색 변형(꽃·씨앗 봉투)은 <모델>_<변형>_thumb.png.
// 글자로 써야 하는 곳(대화 선택지 등)은 emoji — 표의 이모지 그대로
const itemIcon = (model, variant) => `assets/items/renders/${model}${variant ? `_${variant}` : ''}_thumb.png`;

/** @type {object[]} 모든 아이템 (읽기 전용) */
export const ITEMS = [
  // 물고기 (FI-01 ~ FI-20)
  ...T.fish.map(({ slug, name, place, time, season, shadow, price, rare, emoji, desc, colors, weight }, i) => ({
    id: `fish.${slug}`, category: 'fish', code: code('FI', i), name, icon: itemIcon(`fish-${slug}`), emoji, price, desc,
    place, time, season, habitats: FISH_PLACE[place], hours: TIME_HOURS[time], months: SEASON_MONTHS[season],
    shadow, rare: !!rare, weight: weight ?? weightOf(price, rare),
    colors: (([body, back, belly, fin]) => ({ body, back, belly, fin }))(colors ?? FISH_COLOR_DEFAULT),
  })),
  // 곤충 (BU-01 ~ BU-22)
  ...T.bugs.map(({ slug, name, place, time, season, price, rare, flying, emoji, desc, weight }, i) => ({
    id: `bug.${slug}`, category: 'bug', code: code('BU', i), name, icon: itemIcon(`bug-${slug}`), emoji, price, desc,
    place, time, season, places: BUG_PLACE[place], hours: TIME_HOURS[time], months: SEASON_MONTHS[season],
    rainOnly: time === '비 올 때', flying: !!flying, rare: !!rare, weight: weight ?? weightOf(price, rare),
  })),
  // 화석 (FO-01 ~ FO-08)
  ...T.fossils.map(({ slug, name, price, rare, emoji, desc, weight }, i) => ({
    id: `fossil.${slug}`, category: 'fossil', code: `FO-0${i + 1}`, name, icon: itemIcon(`fossil-${slug}`), emoji, price, desc, rare: !!rare, weight: weight ?? weightOf(price, rare),
  })),
  { id: UNKNOWN_FOSSIL, category: 'fossil', code: 'FO-00', name: T.unknownFossil.name, icon: itemIcon('fossil-unknown'), emoji: T.unknownFossil.emoji, price: T.unknownFossil.price, unknown: true,
    desc: T.unknownFossil.desc },
  // 과일 (MA-01, MA-02): 섬 특산 과일(economy.nativeFruit)은 nativePrice 로 팔린다. variant = 배경 fruit-tree 변형 이름
  ...T.fruits.map(({ slug, name, emoji, price, nativePrice, variant, islet }) => ({
    id: `fruit.${slug}`, category: 'fruit', code: slug === 'coconut' ? 'MA-02' : 'MA-01', name, icon: itemIcon(`fruit-${slug}`), emoji, price,
    nativePrice: nativePrice ?? price, variant, tree: variant ? 'fruit-tree' : 'palm', ...(islet ? { islet: true } : {}),   // islet = 무인도 투어 섬에만 (P35)
  })),
  // 조개 (MA-07): weight = 해변 출현 가중치, variant = 배경 shell 변형
  ...T.shells.map(({ slug, name, emoji, price, weight, variant }) => ({
    id: `shell.${slug}`, category: 'shell', code: 'MA-07', name, icon: itemIcon(`shell-${slug}`), emoji, price, weight, variant,
  })),
  // 꽃 (PR-06: 튤립·코스모스·팬지 × 색 4). 씨앗에서는 앞의 3색, 마지막 색은 교배로만 핀다
  ...T.flowers.flatMap(({ kind, name: kindName, emoji, price, hybridPrice, colors }) => colors.map(([variant, color], ci) => ({
    id: `flower.${kind}-${variant}`, category: 'flower', code: 'PR-06', name: `${color} ${kindName}`, icon: itemIcon(`flower-${kind}`, variant), emoji,
    price: ci === 3 ? hybridPrice : price, kind, variant, hybrid: ci === 3,
  }))),
  // 재료 (MA-03 ~ MA-06, MA-08)
  ...T.mats.map(({ slug, name, emoji, price, buy, from, code: c }) => ({   // buy = 상점에서 살 때 값 (B-14 섬 여행 표만)
    id: `mat.${slug}`, category: 'mat', code: c, name, icon: itemIcon(`mat-${slug}`), emoji, price, ...(buy ? { buy } : {}), from,
  })),
  { id: 'mat.acorn-bag', category: 'mat', code: 'MA-08', name: T.acornBag.name, icon: itemIcon('mat-acorn-bag'), emoji: T.acornBag.emoji, price: T.acornBag.price,
    acorns: T.acornBag.acorns, stack: T.acornBag.stack, from: T.acornBag.from },
  // 도구 (TL-01 ~ TL-05): 용도, 얻는 법, 내구도(쓸 수 있는 횟수), 상점 값
  ...T.tools.map(({ slug, name, emoji, price, buy, durability, use, from }, i) => ({
    id: `tool.${slug}`, category: 'tool', code: code('TL', i), name, icon: itemIcon(`tool-${slug}`), emoji, price, buy, tool: slug, use, from, durability,
  })),
  // 가구 (FU-01 ~ FU-33): 아이콘 = 가구 모델 썸네일 그림 (assets/furniture, W3). 크기 '가로×세로' · '벽' · '창문'
  // 얻는 법(source): craft 제작, shop 상점, gift 주민 선물, friend 친밀도, museum 박물관 보상, birthday 생일 선물
  // FU-34 축제 단체 사진은 festival-items.js 의 FESTIVAL_FURN (표와 같은 순서의 줄)
  // FU-43– 행사 보상 가구는 event-items.js 의 EVENT_FURN (줄 끝의 보드 ID 가 code)
  // 친밀도 선물 가구(source 'friend')는 items.json 의 owner = 주는 주민 slug (B-24)
  ...[...T.furniture, ...FESTIVAL_FURN.map(([slug, name, size, from, emoji, price, buy, source]) => ({ slug, name, size, from, emoji, price, buy, source })),
    ...EVENT_FURN.map(([slug, name, size, from, emoji, price, buy, source, id]) => ({ slug, name, size, from, emoji, price, buy, source, id })),
    ...[...DECOR_FURN, ...FAVOR_FURN, ...NIGHT_FURN].map(([slug, name, size, from, emoji, price, buy, source, id]) => ({ slug, name, size, from, emoji, price, buy, source, id }))]
    .map(({ slug, name, emoji, price, buy, size, source, from, id, owner }, i) => ({
    id: `furn.${slug}`, category: 'furn', code: id ?? code('FU', i), name, icon: `assets/furniture/renders/${slug}_thumb.png`, emoji, price, ...(buy ? { buy } : {}),
    size: sizeOf(size), place: placeOf(size), sizeText: size, from, source, ...(owner ? { owner } : {}),
    ...(OUTDOOR.has(slug) ? { outdoor: true } : {}), ...(slug === 'radio' ? { plays: 'bgm' } : {}),
    ...(slug === 'fish-tank' ? { holds: 'fish' } : {}), ...(slug === 'bug-case' ? { holds: 'bug' } : {}),
  })),
  // 씨앗·묘목 (상점 판매): flower = 피는 꽃 종류, tree = 자라는 배경 나무
  ...T.seeds.map(({ slug, name, emoji, price, buy, ...extra }) => ({
    id: `seed.${slug}`, category: 'seed', name, icon: extra.flower ? itemIcon('seed-bag', extra.flower) : itemIcon(`seed-${slug}`), emoji, price, buy, ...extra,
  })),
];
ITEMS.push(...festivalItems(itemIcon));   // IC-FE-01–04 축제 부스에서 만드는 것 (5차 Z5)
ITEMS.push(...eventItems(itemIcon));      // IC-EV-01– 계절 행사 채집 (8차 M8)
ITEMS.push(...nightItems(itemIcon));      // IC-NT-01–04 토요일 밤 야시장 먹거리 (12차)
ITEMS.push(...seaItems(T, { itemIcon, weightOf }));   // M16 잠수: 바다 생물 IC-SE-01–20 + 스쿠버 키트 (TL-06)

const deepFreeze = v => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    Object.values(v).forEach(deepFreeze);
  }
  return v;
};
for (const it of ITEMS) {
  if (it.stack == null) it.stack = STACK[it.category] ?? 1;
  if (it.buy) it.buyPrice = it.buy;   // 계약 이름 (docs/CONTRACTS.md: buyPrice = 상점에서 살 때 값)
  deepFreeze(it);   // months·hours 같은 배열은 여러 아이템이 같이 쓴다
}

const BY_ID = new Map(ITEMS.map(it => [it.id, it]));
// 감정 전 화석은 카테고리 목록(도감·박물관 칸·화석 뽑기)에서 뺀다
const BY_CAT = new Map(CATEGORIES.map(c => [c, ITEMS.filter(it => it.category === c && !it.unknown)]));

/** id → 아이템 또는 null */
export const get = id => BY_ID.get(id) ?? null;
/** 카테고리의 아이템 목록 (카테고리를 안 주면 전부) */
export const list = category => (category == null ? ITEMS.slice() : (BY_CAT.get(category) ?? []).slice());
export const has = id => BY_ID.has(id);
/** 한 칸에 몇 개까지 쌓이나 (모르는 id 는 1) */
export const stackOf = id => BY_ID.get(id)?.stack ?? 1;
/** 박물관·도감에 들어가는 카테고리 (M16 잠수: 바다 생물 sea — 박물관 관 배치는 박물관 트랙) */
export const COLLECTIBLE = ['fish', 'bug', 'fossil', SC.key];
