// 9차 섬 꾸미기 야외 가구 (검수 보드 wave9 D86-A): FU-47–50. items.js 는 이 파일을 붙이기만 한다 (event-items.js 와 같은 방식).
// 밖(섬)에 놓을 수 있는 가구 = 아이템 outdoor: true — 새 넷 + 지금 가구 중 밖에 어울리는 것(OUTDOOR). 놓기는 src/gameplay/decor/.

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID] */
export const DECOR_FURN = [
  ['outdoor-bench', '야외 벤치', '2×1', '도토리상점 (가끔)', '🪑', 400, 1600, 'shop', 'FU-47'],
  ['garden-lamp', '정원 등', '1×1', '도토리상점 (가끔)', '🏮', 300, 1200, 'shop', 'FU-48'],
  ['flower-pots', '화분 셋', '1×1', '도토리상점 (가끔)', '🪴', 250, 1000, 'shop', 'FU-49'],
  ['picnic-table', '피크닉 탁자', '2×2', '도토리상점 (가끔)', '🧺', 600, 2400, 'shop', 'FU-50'],
];

/** 섬에도 놓을 수 있는 지금 가구 (보드 wave9 RES 「실내 가구 다시 씀」) */
export const OUTDOOR = new Set(['campfire', 'log-chair', 'log-table', 'plant-pot', 'woodpile', 'surfboard', 'harvest-basket', 'snowman-lamp', 'cherry-lamp',
  ...DECOR_FURN.map(r => r[0])]);
