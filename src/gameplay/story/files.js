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
  'assets/story/scenes/s20-moonshop-first.json',   // M12 달빛 가게 첫 방문 (trigger night-first, 문 앞에서 튼 뒤 들어감)
  'assets/story/scenes/s21-tent-first.json',   // M12 새벽 천막 첫 방문 (trigger night-first)
  'assets/story/scenes/s22-first-tour.json',   // P35 첫 섬 여행 (trigger tour-first)
  'assets/story/scenes/s23-first-meteor.json',   // M13 첫 유성우 밤 (trigger meteor-first)
  'assets/story/scenes/s24-peddler-first.json',   // M13 행상 송이 첫 방문 (trigger peddler-first)
  'assets/story/scenes/s26-evening-song.json',   // M15 저녁 광장 첫 노래 (trigger song-first)
  'assets/story/scenes/s27-fox-first.json',   // P54 수상한 여우 상인 첫 만남 (trigger night-first kind foxshop)
  'assets/story/scenes/s28-odd-tent-first.json',   // P54 이상한 천막 첫 방문 (trigger night-first kind oddtent)
  'assets/story/scenes/s29-first-contest.json',   // M18-P3 첫 계절 대회 (trigger contest-first)
  'assets/story/scenes/s25-five-stars.json',   // M14 섬 평가 별 다섯 처음 (trigger rating-five)
  'assets/story/scenes/s30-monsoon-day.json',   // M18-P2 장마 하루 (trigger special-day kind monsoon)
  'assets/story/scenes/s31-big-meteor.json',   // M18-P2 큰 유성우 밤 (trigger meteor-big)
  'assets/story/scenes/s32-first-snow.json',   // M18-P2 첫눈 아침 (trigger special-day kind first-snow)
  'assets/story/scenes/s33-bori-nap-spot.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s34-bori-first-nap.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s35-chorong-frog-choir.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s36-chorong-worry.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s37-coco-island-run.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s38-coco-rest.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s39-danpung-notebook.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s40-danpung-exhibit.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s41-dubu-old-rod.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s42-dubu-sea-letter.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s43-mochi-flowerbed.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s44-mochi-flower-words.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s45-pong-first-dish.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s46-pong-cookbook.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s47-gureum-first-show.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s48-gureum-lighthouse.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s49-pado-swim-race.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s50-pado-south-sea.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s51-dalmuri-daytime.json',   // M19-P2 주민 사연 ① 친구 (trigger bond-tier)
  'assets/story/scenes/s52-dalmuri-star-name.json',   // M19-P2 주민 사연 ② 단짝 (trigger bond-tier)
  'assets/story/scenes/s53-pair-makeup.json',   // M19-P3 짝 화해 저녁 (trigger pair-makeup, 배우는 vars.cast 로 바뀜, once false)
  'assets/story/scenes/s54-lighthouse-start.json',   // M19-P4 등대 시작 — 구름의 옛 그림 (trigger lighthouse kind start)
  'assets/story/scenes/s55-lighthouse-path.json',   // M19-P4 등대 1단계 길 내기 (kind path)
  'assets/story/scenes/s56-lighthouse-stairs.json',   // M19-P4 등대 2단계 계단 고치기 (kind stairs)
  'assets/story/scenes/s57-lighthouse-lens.json',   // M19-P4 등대 3단계 렌즈 닦기 (kind lens)
  'assets/story/scenes/s58-lighthouse-lantern.json',   // M19-P4 등대 4단계 별 조각 등불 (kind lantern)
  'assets/story/scenes/s59-lighthouse-ready.json',   // M19-P4 등대 5단계 불 켜는 날 준비 (kind night)
  'assets/story/scenes/s60-lighthouse-lit.json',   // M19-P4 등대 불 켜는 밤 — 섬 사람 모두 + 밤 상인들 (kind lit)
  'assets/story/scenes/s61-lighthouse-morning.json',   // M19-P4 등대 다음 날 아침 (kind morning)
  'assets/story/scenes/s62-ssalal-first-chair.json',   // M19-P5 쌀알 사연 ① 친구 (bond-tier)
  'assets/story/scenes/s63-ssalal-cheek-seeds.json',   // M19-P5 쌀알 사연 ② 단짝
  'assets/story/scenes/s64-boreum-faded-photo.json',   // M19-P5 보름 사연 ① 친구 — 등대 실마리
  'assets/story/scenes/s65-boreum-trunk-song.json',   // M19-P5 보름 사연 ② 단짝
  'assets/story/scenes/s68-ferryman-meet.json',   // east-fishboat 뱃사공 너울 첫 만남 (trigger boat-meet)
  'assets/story/scenes/s69-first-offshore.json',   // east-fishboat 첫 먼바다 (trigger boat-sail)
];
