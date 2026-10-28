// 게임 전체가 같이 쓰는 숫자와 이름.
export const TILE = 1;                       // 타일 1칸 = 1.0 (캐릭터 키 ≈ 1.0)
export const ISLAND = { w: 64, h: 56 };      // 섬 크기 (타일), 결정 사항 D6 '보통'
export const LEVEL_HEIGHT = 1.0;             // 언덕 한 단 높이

export const CATEGORIES = ['nature', 'prop', 'building', 'tile'];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
/** 실제 달(1~12) → 계절. 편집기 변형 이름(spring/summer/autumn/winter)과 같다. */
export const seasonOf = month => (month >= 3 && month <= 5 ? 'spring' : month <= 8 && month >= 6 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter');

/** 시간대: 하늘 팔레트(PAL-T1~T4)와 배경음(BGM-01~05) 구간 */
export const DAY_PARTS = [
  { id: 'dawn', from: 5, to: 8 },
  { id: 'day', from: 8, to: 17 },
  { id: 'dusk', from: 17, to: 19 },
  { id: 'night', from: 19, to: 29 },   // 19시 ~ 다음날 5시
];

export const CHARACTERS = ['player', 'coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'bamtol', 'neuru'];
export const VILLAGERS = ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong'];

export const TOOLS = ['rod', 'net', 'shovel', 'axe', 'can'];   // 낚싯대, 잠자리채, 삽, 도끼, 물뿌리개
