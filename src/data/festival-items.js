// 5차 Z5 축제 아이템 (검수 보드 z5): 부스에서 만드는 것 IC-FE-01–04 와 엔딩 사진 가구 FU-34.
// items.js 는 이 파일을 붙이기만 한다 (6차 M6-P5 가 아이템 표를 JSON 으로 옮길 때 이 표도 같이 옮긴다).
// 축제 분류 아이템은 누구에게나 아주 좋아하는 선물 (town/rules.js giftReaction).

/** 아이템 분류 하나 */
export const FESTIVAL_CATEGORY = { key: 'festival', name: '축제', stack: 5 };

/** [slug, 보드 ID, 이름, 글자용 emoji, 팔 때 값, 얻는 법] — 아이콘 = assets/items/renders/festival-<slug>_thumb.png */
export const FESTIVAL_GOODS = [
  ['pie', 'IC-FE-01', '과일 파이', '🥧', 400, '먹거리 부스에서 과일 2개로'],
  ['juice', 'IC-FE-02', '과일 주스', '🧃', 300, '먹거리 부스에서 과일 2개로'],
  ['wreath', 'IC-FE-03', '화관', '💐', 360, '꽃 공방에서 꽃 3송이로'],
  ['medal', 'IC-FE-04', '낚시 대회 메달', '🏅', 1000, '낚시 대회에서 두부의 기록을 넘으면'],
];

/** 가구 표(FURN)와 같은 모양: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처] */
export const FESTIVAL_FURN = [
  ['festival-photo', '축제 단체 사진', '1×1', '축제 엔딩', '📸', 10, 0, 'festival'],   // FU-34
];

/** 아이템 표에 넣을 것 (icon = items.js 의 itemIcon) */
export const festivalItems = itemIcon => FESTIVAL_GOODS.map(([slug, code, name, emoji, price, from]) => ({
  id: `festival.${slug}`, category: FESTIVAL_CATEGORY.key, code, name, icon: itemIcon(`festival-${slug}`), emoji, price, from,
}));
