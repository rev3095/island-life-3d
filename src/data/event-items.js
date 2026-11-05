// 8차 계절 행사 아이템 (검수 보드 wave8 D81-A · D82-A): 행사 채집 IC-EV-01–04 와 보상 가구 FU-43–46.
// items.js 는 이 파일을 붙이기만 한다 (festival-items.js 와 같은 방식). M8-P2 가 행사 하나씩 줄을 더한다 — 지금은 봄 꽃놀이(EV-01)·여름 불꽃놀이(EV-02).
// 행사 채집은 행사 기간에만 나온다 (나오는 자리·때는 놀이 트랙 src/gameplay/events/<slug>.js 가 ctx.services.events.live() 로 거른다).

/** 아이템 분류 하나 */
export const EVENT_CATEGORY = { key: 'event', name: '행사', stack: 30 };

/** [slug, 보드 ID, 이름, 글자용 emoji, 팔 때 값, 얻는 법, 행사] — 아이콘 = assets/items/renders/event-<slug>_thumb.png */
export const EVENT_GOODS = [
  ['petal', 'IC-EV-01', '벚꽃잎', '🌸', 10, '봄 꽃놀이 때 벚나무 아래에서 (하루 10장)', 'EV-01'],
  ['sparkler', 'IC-EV-02', '손 불꽃', '🎇', 5, '여름 불꽃놀이 저녁에 코코에게 (하루 하나)', 'EV-02'],
];

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID] */
export const EVENT_FURN = [
  ['cherry-lamp', '벚꽃 등', '1×1', '봄 꽃놀이 (꽃잎 20장 + 나무 2개)', '🏮', 200, 0, 'event', 'FU-43'],
  ['wind-chime', '여름밤 풍경', '벽', '여름 불꽃놀이 (소원을 빈 다음 날 우편함)', '🎐', 200, 0, 'event', 'FU-44'],
];

/** 아이템 표에 넣을 것 (icon = items.js 의 itemIcon) */
export const eventItems = itemIcon => EVENT_GOODS.map(([slug, code, name, emoji, price, from, ev]) => ({
  id: `event.${slug}`, category: EVENT_CATEGORY.key, code, name, icon: itemIcon(`event-${slug}`), emoji, price, from, event: ev,
}));
