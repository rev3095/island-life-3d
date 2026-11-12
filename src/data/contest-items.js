// M18-P3 계절 대회 상 (15차 검수 보드 wave15 D194-A, concept/wave15-board.html): 금·은·동 트로피 가구 FU-89–91.
// items.js 는 이 파일을 붙이기만 한다 (daily-items.js 와 같은 방식). 대회 놀이는 src/gameplay/contest/ (설정 assets/contest/contest.json).

/** 가구 표(FURN)와 같은 모양 + 보드 ID: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID] — 출처 'contest' 대회 상 (상점·나무 흔들기 가구에 안 섞인다) */
export const CONTEST_FURN = [
  ['trophy-gold', '금 트로피', '1×1', '계절 낚시·곤충 대회 1등', '🏆', 3000, 0, 'contest', 'FU-89'],
  ['trophy-silver', '은 트로피', '1×1', '계절 낚시·곤충 대회 2등', '🥈', 2000, 0, 'contest', 'FU-90'],
  ['trophy-bronze', '동 트로피', '1×1', '계절 낚시·곤충 대회 3등', '🥉', 1000, 0, 'contest', 'FU-91'],
];
export const TROPHY_IDS = CONTEST_FURN.map(([slug]) => `furn.${slug}`);
