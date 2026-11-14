// M15 「주민과 더 가깝게」 추억 액자 (FU-71 탁상 · FU-72 벽): 섬폰 「📷 앨범」에서 사진 하나를 골라 도토리를 내고 만든다 (ui/album.js FRAMES).
// 가방 칸 변형 = '사진<사진 id>' (집에 놓으면 그 사진이 액자에 걸린다). 상점·나무 흔들기 가구에는 안 섞인다 (출처 'album').
// items.js 는 이 파일을 붙이기만 한다 (night-items.js 와 같은 방식). 가구 code 는 순번이 아니라 보드 ID.

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID] */
export const ALBUM_FURN = [
  ['album-frame', '추억 액자', '1×1', '섬폰 앨범에서 만들기 (도토리 300)', '🖼️', 150, 0, 'album', 'FU-71'],
  ['album-frame-wall', '추억 벽 액자', '벽', '섬폰 앨범에서 만들기 (도토리 500)', '🖼️', 250, 0, 'album', 'FU-72'],
];

// ---- M19-P2 주민 사연 ② 답례 가구 (16차 보드 wave16 D201-A): FU-105–108 — 주는 곳은 town/talk.js createBondStories (답례 표 town/bond.js BOND_STORY).
// 게시 파일 수 한도(255) 때문에 새 모듈을 만들지 않고 여기에 둔다. 출처 'story' (상점·나무 흔들기 가구에 안 섞인다).
export const STORY_FURN = [
  ['nap-cushion', '낮잠 방석', '1×1', '보리와 단짝이 된 날 답례 (사연 s34)', '🛏️', 1200, 0, 'story', 'FU-105'],
  ['flower-word-frame', '꽃말 액자', '벽', '모찌와 단짝이 된 날 답례 (사연 s44)', '💐', 1200, 0, 'story', 'FU-106'],
  ['grandma-cookbook', '할머니 요리책', '1×1', '퐁과 단짝이 된 날 답례 (사연 s46)', '📖', 1200, 0, 'story', 'FU-107'],
  ['lighthouse-painting', '등대 그림', '벽', '구름과 단짝이 된 날 답례 (사연 s48)', '🖼️', 1500, 0, 'story', 'FU-108'],
];
export const STORY_FURN_IDS = STORY_FURN.map(([slug]) => `furn.${slug}`);
