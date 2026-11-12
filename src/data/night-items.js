// 12차 밤·새벽 아이템 (검수 보드 밤·새벽 D106–D114 모두 A, https://claude.ai/artifact/PLWgpRtW8quwEBFBVJiyWU):
// 야시장 먹거리 IC-NT-01–04 와 달빛 가게·새벽 천막 가구 FU-55–59.
// items.js 는 이 파일을 붙이기만 한다 (event-items.js 와 같은 방식). 가구 code 는 순번이 아니라 보드 ID.
// 야시장 먹거리는 토요일 밤에만 판다 (파는 때·자리는 놀이 트랙이 정한다).

/** 아이템 분류 하나 */
export const NIGHT_CATEGORY = { key: 'night', name: '밤', stack: 30 };

/** [slug, 보드 ID, 이름, 글자용 emoji, 팔 때 값, 살 값, 얻는 법] — 야시장 노점은 ui.shop 창(economy.buyPrice = buy)으로 판다. 아이콘 = assets/items/renders/night-<slug>_thumb.png */
export const NIGHT_GOODS = [
  ['bungeoppang', 'IC-NT-01', '붕어빵', '🐟', 80, 160, '토요일 밤 야시장 (19–24시)'],
  ['moon-tteok', 'IC-NT-02', '달떡', '🌕', 110, 220, '토요일 밤 야시장 (19–24시)'],
  ['cocoa', 'IC-NT-03', '따뜻한 코코아', '☕', 90, 180, '토요일 밤 야시장 (19–24시)'],
  ['star-candy', 'IC-NT-04', '별사탕', '⭐', 60, 120, '토요일 밤 야시장 (19–24시)'],
];

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID]
 *  출처 'night-shop' 달빛 가게 · 'dawn-tent' 새벽 천막 — 도토리상점(source 'shop') 진열·나무 흔들기 가구에는 안 섞인다 */
export const NIGHT_FURN = [
  ['glow-star-lamp', '야광 별 등', '1×1', '달빛 가게 (밤 22–3시)', '🌟', 300, 1200, 'night-shop', 'FU-55'],
  ['moon-lamp', '초승달 램프', '1×1', '달빛 가게 (밤 22–3시)', '🌙', 400, 1600, 'night-shop', 'FU-56'],
  ['firefly-jar', '반딧불 병', '1×1', '달빛 가게 (밤 22–3시)', '🫙', 200, 800, 'night-shop', 'FU-57'],
  ['star-rug', '별자리 깔개', '2×2', '달빛 가게 (밤 22–3시)', '✨', 500, 2000, 'night-shop', 'FU-58'],
  ['crystal-ball', '수정 구슬', '1×1', '새벽 천막 (3–5시)', '🔮', 600, 2400, 'dawn-tent', 'FU-59'],
  // P54 밤 특별 상점 (D165–D169): 여우 상인 가게 BD-14 · 이상한 천막 BD-13 · 운세 부스 BD-15 (FU-74 미술품 받침 · FU-77 운세 탁자는 붙박이라 표 밖)
  ['fox-lantern', '여우불 등', '1×1', '수상한 여우 상인 (밤에 가끔)', '🏮', 600, 2400, 'fox-shop', 'FU-73'],
  ['odd-chest', '수상한 궤짝', '1×1', '이상한 천막 · 선물 상자 (가끔)', '🧳', 450, 1800, 'odd-tent', 'FU-75'],
  ['fortune-lamp', '점괘 등', '1×1', '운세 부스 (밤 8시–새벽 3시)', '🪔', 500, 2000, 'fortune-booth', 'FU-76'],
  ['tarot-frame', '타로 액자', '벽', '운세 부스 (밤 8시–새벽 3시)', '🃏', 400, 1600, 'fortune-booth', 'FU-78'],
];

/** 아이템 표에 넣을 것 (icon = items.js 의 itemIcon) */
export const nightItems = itemIcon => NIGHT_GOODS.map(([slug, code, name, emoji, price, buy, from]) => ({
  id: `night.${slug}`, category: NIGHT_CATEGORY.key, code, name, icon: itemIcon(`night-${slug}`), emoji, price, buy, from,
}));
