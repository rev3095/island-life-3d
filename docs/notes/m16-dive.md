# M16 잠수 (브랜치 `m16-dive`, 결정 D160–D164) — 진행 중 인계 메모

사용 한도로 중간에 멈춤. 아래 「남은 것」부터 이어서 한다.

## 결정 (제안, 사용자 확인 전)
- D160 스쿠버 키트 `tool.scuba-kit` (TL-06, 사는 값 3000 · 파는 값 750): 가방에 있으면 바다에 들어감. 손에 드는 도구가 아님(`tool` 칸 없음, `wear: 'scuba'`, 내구도 없음). 상점 늘 파는 목록 `rules.json shop.always` → `economy.shopStock().always`. 하루 도구 다섯은 `t.tool` 있는 것만.
- D161 헤엄 AN-15 · 잠기기 AN-16 은 **코드 자세** (`src/player/swim.js`, 서기 클립 위에 뼈 덧돌림 + 몸 기울이기) — 주인공 .glb.json 을 다시 굽으면 다른 트랙과 바이너리 충돌이라. 나중에 build_character.py 클립으로 옮길 수 있게 `pose()` 하나로 모음.
- D162 바다 = `world.addZone` 구역 (헤엄치는 동안만): 해안 물가 선 + 0.6 바깥 · 섬 칸 밖 7칸까지, 빠르기 걷기 × 0.62 (잠기면 0.55). 구역 `isWalkable` 은 false (주민 길찾기가 바다로 안 가게). 투어 섬·실내에선 안 됨.
- D163 물속 화면: 모든 사양 안개 색·거리, 높음·적정만 화면 셰이더 한 장 (`dive-fx.js`). 물방울 FX-03 = InstancedMesh (사양별 개수).
- D164 바다 생물 `sea` 「바다 생물」 IC-SE-01–20 (items.json `sea`: 시간·계절·그림자 1–6·빠르기 0–3·값). 헤엄칠 때만 둘레에 나옴 (`spawns.sea`). 박물관 기증 가능 (`items.COLLECTIBLE`, `museum.js` KINDS = COLLECTIBLE), 도감 탭 (`ui/dom.js DEX_CATEGORIES`). 섬 일지 할 일 `sea1` (이벤트 `dive:catch`).

## 한 것 (커밋됨)
- 데이터: `assets/data/items.json` (stack.sea · 계절 「가을~겨울」 · scubaKit · sea 20), `rules.json shop.always`, `src/data/sea-items.js`(새), `items.js`·`economy.js`·`spawns.js`·`museum.js`.
- 놀이: `src/gameplay/gather/dive.js`·`dive-fx.js`(새), `src/player/swim.js`(새), `gather/index.js` 연결 (행동 키 물속 150 · 들어가기 48).
- UI: `ui/dom.js` (분류 이름·도감·가방 「생물」 탭), `ui/bag.js` 문구. 일지 `assets/journal/journal.json`·`journal/index.js` 한 줄.
- 봇: `tests/playthrough/skills.js sk.dive` · `scenario.js` 단계 `dive` (아직 돌려 보지 않음).
- 개발 서버 4264 에서 손으로 확인: 물가 → 「바다에 들어가기」 → 헤엄(머리만 물 위) → 그림자·물방울 → 「잠수」 → 물속 이동. 잡기 반경을 0.55 → 0.7 로 넓힘(지나쳐서 못 잡았음). 잡기·나오기는 아직 손으로 못 봄.

## 남은 것
1. **모델 21개 + 잠수복 CL-13**: 보조 에이전트가 작업 폴더에서 만드는 중이었음 (`assets/blender/items_sea.py`, `assets/items/specs/sea-*.json`·`tool-scuba-kit.json`, `assets/clothes/specs/wetsuit.json`, build_clothes.py kind, wear.js `SLOT_BONES.suit`, 테스트 개수). 커밋 안 됨 — 파일이 있는지·빌드됐는지 보고 커밋.
2. 테스트 실패 6 (481 중 474 통과): 아이템 아이콘·모델 목록 둘(모델 대기) · 박물관 progress (`service.test.mjs` 가 키 셋 기대 → sea 더함) · 반영 도구 diffTables (`tools/edits.mjs` 가 새 표 칸 scubaKit/sea 모름) · 스토리/캐릭터 편집기 게시 파일 목록 (`items.js` 가 `sea-items.js` 를 import → `assets/story/editor-files.json`·`assets/villagers/editor-files.json` 에 더하기). `villagers.test.mjs` 지문도 확인.
3. 잡기·나오기 손 확인, 자동 플레이 `node tools/playtest.mjs --port=4264 --only=…,dive`, `tools/perf-bench.mjs` 사양 넷 (잠긴 상태도), 콘솔 오류 0.
4. 모르는 것: 저장 중 물에 있으면 다시 열 때 선착장에서 시작 (들고 있던 도구 기억은 잃음). 일지 `sea1` 은 키트가 없어도 뽑힘 — 조건 칸이 필요할 수 있음. 박물관 keepers `CAT_KO` 에 sea 대사 없음 (박물관 트랙 몫).

## 문서 세션이 반영할 문장
- CLAUDE.md 「게임 런타임」 행동 키 순위에 「물에 있는 동안 150 · 바다에 들어가기 48」.
- CLAUDE.md 새 절 「잠수 (M16, `src/gameplay/gather/dive.js`)」: 위 D160–D164 요약.
- 실내 트랙: 상점 진열은 `economy.shopStock().always` (지금 `tool.scuba-kit`) 를 늘 보여 줄 것.
