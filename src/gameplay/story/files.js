// 장면 파일 목록 (웹 빌드 tools/build-web.mjs 가 이 글자들을 보고 파일을 묶는다 — 장면을 더하거나 빼면 여기도. tests/story.test.mjs 가 index.json 과 맞는지 본다)
export const INDEX_FILE = 'assets/story/index.json';
export const SCENE_FILES = [
  'assets/story/scenes/s01-arrival.json',
  'assets/story/scenes/s02-guide-after.json',
  'assets/story/scenes/s03-firstday-done.json',
  'assets/story/scenes/s04-stopped-festival.json',
  'assets/story/scenes/s05-part1.json',
  'assets/story/scenes/s06-part2.json',
  'assets/story/scenes/s07-part3.json',
  'assets/story/scenes/s08-part4.json',
  'assets/story/scenes/s09-part5.json',
  'assets/story/scenes/s10-festival.json',
  'assets/story/scenes/s11-ending-photo.json',
  'assets/story/scenes/s12-life-goes-on.json',
  'assets/story/scenes/s13-spring-blossom.json',   // 8차 계절 행사 (trigger event-start)
  'assets/story/scenes/s14-summer-fireworks.json',   // 8차 계절 행사 (trigger event-start)
  'assets/story/scenes/s15-autumn-harvest.json',   // 8차 계절 행사 (trigger event-start)
  'assets/story/scenes/s16-winter-snowman.json',   // 8차 계절 행사 (trigger event-start)
  'assets/story/scenes/s17-gureum-arrival.json',   // 10차 엔딩 뒤 이사 첫 만남 (trigger move-in)
  'assets/story/scenes/s18-pado-arrival.json',   // 10차 엔딩 뒤 이사 첫 만남 (trigger move-in)
  'assets/story/scenes/s19-dalmuri-arrival.json',   // 10차 엔딩 뒤 이사 첫 만남 (trigger move-in)
];
