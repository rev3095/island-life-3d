// 주민 데이터 파일 목록 (웹 빌드 tools/build-web.mjs 가 이 글자들을 보고 파일을 묶는다 — 주민을 더하거나 빼면 여기도.
// tests/villagers.test.mjs 가 assets/villagers/ 폴더와 맞는지 본다). 순서 = 주민 순서 (편지·목록), 가게 주인은 뒤에.
export const VILLAGER_FILES = [
  'assets/villagers/coco.json',
  'assets/villagers/bori.json',
  'assets/villagers/mochi.json',
  'assets/villagers/dubu.json',
  'assets/villagers/pong.json',
  'assets/villagers/chorong.json',
  'assets/villagers/danpung.json',
  'assets/villagers/bamtol.json',
  'assets/villagers/neuru.json',
];
export const villagerFile = slug => `assets/villagers/${slug}.json`;
