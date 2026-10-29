// 소리 데이터 파일 목록 (웹 빌드 tools/build-web.mjs 가 이 글자들을 보고 파일을 묶는다 — 곡을 더하거나 빼면 여기도.
// tests/sound.test.mjs 가 index.json 의 songs 와 맞는지 본다)
export const INDEX_FILE = 'assets/sound/index.json';
export const SFX_FILE = 'assets/sound/sfx.json';
export const VOICES_FILE = 'assets/sound/voices.json';
export const SONG_FILES = [
  'assets/sound/songs/dawn.json',
  'assets/sound/songs/morning.json',
  'assets/sound/songs/afternoon.json',
  'assets/sound/songs/evening.json',
  'assets/sound/songs/night.json',
  'assets/sound/songs/rain.json',
  'assets/sound/songs/indoor.json',
  'assets/sound/songs/shop.json',
  'assets/sound/songs/museum.json',
  'assets/sound/songs/festival.json',   // 5차 Z5 축제 (schedule.places.festival)
];
export const songFile = id => `assets/sound/songs/${id}.json`;
