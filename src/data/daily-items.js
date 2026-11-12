// M13 「매일 할 거리」 아이템 (13차 검수 보드 wave13 D140–D147 모두 A, concept/wave13-board.html):
// 별 조각 IC-MA-11 (색 셋 — 유성우 밤에 소원을 빈 다음 날 바닷가) · 레시피 쪽지 IC-MA-12 (유리병·풍선·섬 일지) · 별 조각 가구 FU-63–66 (별 조각 레시피로만).
// items.js 는 이 파일을 붙이기만 한다 (night-items.js 와 같은 방식). 새총 TO-07 은 도구 표(assets/data/items.json tools)에 있다.
// 놀이는 src/gameplay/daily/ (설정 assets/daily/daily.json).

/** [slug, 이름, 글자용 emoji, 팔 때 값, 모델 변형, 얻는 법] — 분류 mat (재료), 모델 mat-star-piece (색 변형 셋) */
export const DAILY_STARS = [
  ['star-yellow', '노란 별 조각', '⭐', 300, 'yellow', '유성우 밤에 소원을 빈 다음 날 바닷가'],
  ['star-pink', '분홍 별 조각', '🌟', 300, 'pink', '유성우 밤에 소원을 빈 다음 날 바닷가'],
  ['star-blue', '하늘 별 조각', '💫', 300, 'blue', '유성우 밤에 소원을 빈 다음 날 바닷가'],
];
export const STAR_IDS = DAILY_STARS.map(([slug]) => `mat.${slug}`);
/** 레시피 쪽지: 가방에 들어오면 daily 모듈이 읽고(하나 빠짐) 아직 모르는 새 레시피 하나를 연다 (D146-A). 다 알면 그냥 남아 팔 수 있다 */
export const RECIPE_NOTE = 'mat.recipe-note';

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID] — 출처 'star' 별 조각 레시피 (상점·나무 흔들기 가구에 안 섞인다) */
export const DAILY_FURN = [
  ['star-lamp', '별 조각 램프', '1×1', '제작 — 별 조각 레시피 (유리병·풍선 쪽지)', '💡', 900, 0, 'star', 'FU-63'],
  ['star-clock', '별빛 벽시계', '벽', '제작 — 별 조각 레시피 (유리병·풍선 쪽지)', '🕰️', 1100, 0, 'star', 'FU-64'],
  ['star-chair', '별 의자', '1×1', '제작 — 별 조각 레시피 (유리병·풍선 쪽지)', '🪑', 800, 0, 'star', 'FU-65'],
  ['star-mobile', '별 모빌', '1×1', '제작 — 별 조각 레시피 (유리병·풍선 쪽지)', '✨', 700, 0, 'star', 'FU-66'],
];

/** 아이템 표에 넣을 것 (icon = items.js 의 itemIcon) */
export const dailyItems = itemIcon => [
  ...DAILY_STARS.map(([slug, name, emoji, price, variant, from]) => ({
    id: `mat.${slug}`, category: 'mat', code: 'MA-11', name, icon: itemIcon('mat-star-piece', variant), emoji, price, from,
  })),
  { id: RECIPE_NOTE, category: 'mat', code: 'MA-12', name: '레시피 쪽지', icon: itemIcon('mat-recipe-note'), emoji: '📜', price: 100,
    from: '바닷가 유리병 · 선물 풍선 · 섬 일지 교환 (가방에 들어오면 새 레시피가 열려요)' },
];
