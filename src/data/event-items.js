// 8차 계절 행사 아이템 (검수 보드 wave8 D81-A · D82-A): 행사 채집 IC-EV-01–04 와 보상 가구 FU-43–46.
// items.js 는 이 파일을 붙이기만 한다 (festival-items.js 와 같은 방식). M8-P2 가 행사 하나씩 줄을 더한다 — 행사 넷(EV-01–04) 모두 들어 있다.
// 행사 채집은 행사 기간에만 나온다 (나오는 자리·때는 놀이 트랙 src/gameplay/events/<slug>.js 가 ctx.services.events.live() 로 거른다).

/** 아이템 분류 하나 */
export const EVENT_CATEGORY = { key: 'event', name: '행사', stack: 30 };

/** [slug, 보드 ID, 이름, 글자용 emoji, 팔 때 값, 얻는 법, 행사, { model, variant }?] — 아이콘 = assets/items/renders/event-<slug>_thumb.png,
 *  색 변형이면 모델 하나(event-<model>)의 변형 그림 event-<model>_<variant>_thumb.png (버섯 셋 = 모델 하나, 보드 ID 도 하나) */
export const EVENT_GOODS = [
  ['petal', 'IC-EV-01', '벚꽃잎', '🌸', 10, '봄 꽃놀이 때 벚나무 아래에서 (하루 10장)', 'EV-01'],
  ['sparkler', 'IC-EV-02', '손 불꽃', '🎇', 5, '여름 불꽃놀이 저녁에 코코에게 (하루 하나)', 'EV-02'],
  ['mushroom-shiitake', 'IC-EV-03', '표고버섯', '🍄', 60, '가을 수확 잔치 때 숲·나무 밑에서 (하루 다섯)', 'EV-03', { model: 'mushroom', variant: 'shiitake' }],
  ['mushroom-chanterelle', 'IC-EV-03', '꾀꼬리버섯', '🍄', 80, '가을 수확 잔치 때 숲·나무 밑에서 (하루 다섯)', 'EV-03', { model: 'mushroom', variant: 'chanterelle' }],
  ['mushroom-red', 'IC-EV-03', '빨간 버섯', '🍄', 120, '가을 수확 잔치 때 숲·나무 밑에서 — 먹지 않고 큰 솥에만', 'EV-03', { model: 'mushroom', variant: 'red' }],
  ['snow-crystal', 'IC-EV-04', '눈 결정', '❄️', 30, '겨울 눈사람 날 — 눈사람을 만들 때마다 셋, 눈 오는 날 가끔', 'EV-04'],
];

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID] */
export const EVENT_FURN = [
  ['cherry-lamp', '벚꽃 등', '1×1', '봄 꽃놀이 (꽃잎 20장 + 나무 2개)', '🏮', 200, 0, 'event', 'FU-43'],
  ['wind-chime', '여름밤 풍경', '벽', '여름 불꽃놀이 (소원을 빈 다음 날 우편함)', '🎐', 200, 0, 'event', 'FU-44'],
  ['harvest-basket', '수확 바구니', '1×1', '가을 수확 잔치 (18시 잔치 뒤 퐁이)', '🧺', 200, 0, 'event', 'FU-45'],
  ['snowman-lamp', '눈사람 등', '1×1', '겨울 눈사람 날 (눈사람 셋을 만든 날 두부가)', '⛄', 200, 0, 'event', 'FU-46'],
];

/** 아이템 표에 넣을 것 (icon = items.js 의 itemIcon) */
export const eventItems = itemIcon => EVENT_GOODS.map(([slug, code, name, emoji, price, from, ev, art]) => ({
  id: `event.${slug}`, category: EVENT_CATEGORY.key, code, name, icon: itemIcon(`event-${art?.model ?? slug}`, art?.variant), emoji, price, from, event: ev,
  ...(art?.variant ? { variant: art.variant } : {}),
}));
