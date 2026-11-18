// M21 「친구 섬 구경」 기념 가구 (17차 검수 보드 wave17 D287-A): FU-109–112 — 모델은 M21-P1 (assets/blender/visit_furniture.py).
// 주는 곳(방문 도장 수 · 구경 답례 등)은 M21-P2 가 정한다. 출처 'visit' (상점·나무 흔들기 가구에 안 섞인다).
// items.js 는 이 파일을 붙이기만 한다 (contest-items.js 와 같은 방식). 가구 code 는 순번이 아니라 보드 ID.

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID] */
export const VISIT_FURN = [
  ['friend-island-frame', '친구 섬 액자', '벽', '친구 섬 구경 기념', '🖼️', 1000, 0, 'visit', 'FU-109'],
  ['guestbook-desk', '방명록 책상', '1×1', '친구 섬 구경 기념', '📖', 1200, 0, 'visit', 'FU-110'],
  ['stamp-flag', '도장 깃발', '1×1', '친구 섬 구경 기념', '🚩', 1000, 0, 'visit', 'FU-111'],
  ['ship-model', '작은 배 모형', '1×1', '친구 섬 구경 기념', '⛴️', 1500, 0, 'visit', 'FU-112'],
];
export const VISIT_FURN_IDS = VISIT_FURN.map(([slug]) => `furn.${slug}`);
