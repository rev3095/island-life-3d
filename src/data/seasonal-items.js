// M18-P4 계절 가구 (15차 검수 보드 wave15 D196-A, concept/wave15-board.html): 벚꽃·조개·단풍·눈 결정 가구 FU-92–104 (트로피 FU-89–91 은 대회 트랙).
// 계절 레시피로만 만든다 — 레시피 표는 assets/data/rules.json recipes 의 `season` 줄 (unlock: true). 그 계절 유리병·친구 이상 주민 선물로 열린다
// (src/gameplay/daily/index.js · town/talk.js). 일반 레시피 쪽지(유리병·풍선·일지)는 계절 레시피를 열지 않는다 (recipes.js locked()).
// items.js 는 이 파일을 붙이기만 한다 (daily-items.js 와 같은 방식). 모델은 그 계절 묶음 season-<계절> (tools/build-web.mjs SEASON_FILES).

/** 계절 이름 (constants.seasonOf 와 같은 키) */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
export const SEASON_THEME = { spring: '벚꽃', summer: '조개', autumn: '단풍', winter: '눈 결정' };

const FROM = s => `제작 — ${SEASON_KO[s]} 계절 레시피 (${SEASON_KO[s]} 유리병 · 친구 주민 선물)`;

/** 가구 표(FURN)와 같은 모양 + 보드 ID + 계절: [slug, 이름, 칸, 얻는 법, emoji, 값, 살 값, 출처, 보드 ID, 계절] — 출처 'season' (상점·나무 흔들기에 안 섞인다) */
export const SEASON_FURN = [
  ['cherry-chair', '벚꽃 의자', '1×1', FROM('spring'), '🌸', 900, 0, 'season', 'FU-92', 'spring'],
  ['cherry-table', '벚꽃 탁자', '1×1', FROM('spring'), '🌸', 1000, 0, 'season', 'FU-93', 'spring'],
  ['cherry-bonsai', '벚꽃 분재', '1×1', FROM('spring'), '🌸', 1200, 0, 'season', 'FU-94', 'spring'],
  ['cherry-wall', '벚꽃 가지 장식', '벽', FROM('spring'), '🌸', 800, 0, 'season', 'FU-95', 'spring'],
  ['shell-lamp', '조개 등', '1×1', FROM('summer'), '🐚', 900, 0, 'season', 'FU-96', 'summer'],
  ['shell-chair', '조개 의자', '1×1', FROM('summer'), '🐚', 1000, 0, 'season', 'FU-97', 'summer'],
  ['shell-mirror', '조개 벽 거울', '벽', FROM('summer'), '🐚', 1000, 0, 'season', 'FU-98', 'summer'],
  ['maple-shelf', '단풍 선반', '1×1', FROM('autumn'), '🍁', 1100, 0, 'season', 'FU-99', 'autumn'],
  ['maple-rug', '단풍잎 깔개', '2×2', FROM('autumn'), '🍁', 900, 0, 'season', 'FU-100', 'autumn'],
  ['maple-lamp', '단풍 등', '1×1', FROM('autumn'), '🍁', 900, 0, 'season', 'FU-101', 'autumn'],
  ['snowflake-lamp', '눈 결정 등', '1×1', FROM('winter'), '❄️', 900, 0, 'season', 'FU-102', 'winter'],
  ['snowflake-table', '눈 결정 탁자', '1×1', FROM('winter'), '❄️', 1000, 0, 'season', 'FU-103', 'winter'],
  ['snowflake-wall', '눈 결정 벽 장식', '벽', FROM('winter'), '❄️', 900, 0, 'season', 'FU-104', 'winter'],
];
export const SEASON_FURN_IDS = SEASON_FURN.map(([slug]) => `furn.${slug}`);
/** 아이템 id → 계절 */
export const SEASON_OF_FURN = Object.fromEntries(SEASON_FURN.map(r => [`furn.${r[0]}`, r[9]]));
