# P35 무인도 투어 (보드 tour, 반영 v1 = D120–D128 모두 A)

보드: https://claude.ai/artifact/Nf9TMCFMXbHRCP8Y3xiUvx (`concept/tour-board.html`, 보드 id `tour`). 반영 v1 = 사용자 "추천안 그대로 진행" (2026-11-10, `boards/tour` 문서 없음 → 추천안 승인), `applied/tour`·`history/tour-v1` commit 3854e75.
약속은 `docs/CONTRACTS.md` 끝 「투어」. 설정은 `assets/tour/tour.json`.

## 고른 것 → 만든 것

| 결정 | 고른 안 | 어디에 |
|---|---|---|
| D120 가는 방법 | A 선착장에 묶인 작은 배 (혼자) | BD-08 `tour-boat` (본섬은 tour 가 선착장 끝 동쪽 바다에 놓음, 투어 섬은 생성기가 놓음) · 행동 키 `tour-boat` 95 |
| D121 표·횟수 | A 1,000 도토리 · 하루 한 번 · 첫 여행 선물 | `tour.json ticket` · 여행 묻기 창 UI-20 (`ui.confirm`) · 표 아이템 `mat.tour-ticket` (가방에 있으면 표를 먼저 씀) |
| D122 섬 모양 | A 모양 틀 넷 + 날마다 시드 | `src/gameplay/tour/islet.js` `SHAPES` · `isletOf(dayKey, trip)` |
| D123 할 것 | A 희귀 채집 + 다른 섬 주민 초대 | 망고·리치 나무 3 · 광석 바위 EN-13 셋 · 무인도 물고기·곤충 넷 · 꽃·나무·바위·야자 · 주민(첫 2번째 여행, 그 뒤 5번에 한 번) |
| D124 머무는 시간 | A 제한 없음 · 배에서 돌아가기 · 05:00 저절로 | `tour.back()` · `data:newday` |
| D125 저장 | A 섬은 저장 안 함 | `state.tour` 만 · 투어 섬 물체 변경은 가짜 island 칸 · 떠날 때 drops·하루 기록(`tour:` id) 치움 |
| D126 장면 전환 | A 게임 안 원형 전환 + 따로 둔 지역 | 선착장 끝으로 걸어감 → 원형 닫힘 → 「바다를 건너는 중…」 (약 1초) → x 700 투어 섬 선착장 끝 → 원형 열림 |
| D127 성능 | A 새 `tour` 묶음 · 한 섬만 그림 | `tools/build-web.mjs` `TOUR_FILES` · 투어 섬은 따로 kit, 본섬 칸은 화면 밖이라 안 그림 |
| D128 계절·밤 | A 본섬과 같은 시각·계절·날씨 | world `setSeason` 이 투어 섬도 칠함 · 하늘·시계는 그대로 (시계 바늘 offset 포함) · 밤엔 달빛나방 |

## 구조

- **world** (`src/world/islets.js` + `index.js`): `world.islet.enter(gen, ox)` 가 투어 섬을 세우고 `world.island`·`objects`·`places` 의 칸 질문을 그 섬으로 돌린다. 덕분에 gather(흔들기·낚시·곤충·바위·꽃·줍기)를 고치지 않았다. 해안·둑·바다 판 좌표에 `gen.ox` 를 더한 곳: `coastfield.js` x0 · `banksfield.js` x0 (둘) · `banks.js riverDistance` · `terrain.js buildSea`.
- **따로 kit**: 처음엔 본섬 kit 을 같이 썼더니 땅 재질의 풀·모래 섞기 텍스처(banks `markGround`)가 재질에 하나라 투어 섬 경계가 바둑판처럼 보였다 → 투어 섬은 `createKit` 을 새로 만들고, `world.prepareFrame` 과 update 에서 둘 다 부른다.
- **tour** (`src/gameplay/tour/index.js`): 배·여행 묻기·표·전환·광석 캐기·다른 섬 주민(`town/actor.js createActor`)·초대(`town.moving.invite`)·돌아오기·정리.
- **data**: `spawns.js` 의 `islet` 갈래, `data/index.js` 가 `tour.active` 를 붙임. 망고·리치 `islet: true` → 섬 특산 후보에서 빠짐 (예전 저장의 특산 과일이 바뀌지 않게).
- **town**: `planArrival` 이 `M.invited` 를 먼저 고른다 (`moving.js`), 서비스 `moving.movers()`·`invite(slug)`.

## 리소스 (모두 검수 대기 review)

| ID | 무엇 | 파일 |
|---|---|---|
| BD-08 | 여행 배 | `assets/env/specs/tour-boat.json` (`b_tour_boat`) |
| EN-13 | 광석 바위 | `assets/env/specs/ore-rock.json` (`b_ore_rock`) |
| TO-01–04 | 섬 모양 틀 | `src/gameplay/tour/islet.js` `SHAPES` |
| IC-FR-07–08 | 망고 · 리치 | `assets/items/specs/fruit-mango.json` · `fruit-lychee.json` (모양은 배·사과 틀을 빌림 — 검수 때 고칠 거리) · 과일나무 변형 `mango`·`lychee` (`fruit-tree.json`) · 떨어진 열매 색 `meshes.js FRUIT_COLOR` |
| IC-MA-09–10 | 금광석 · 수정 | `mat-gold-ore.json` (철광석 틀) · `mat-crystal.json` (`b_crystal`) |
| IC-FS-21–22 | 무지개놀래기 · 꽃쏨뱅이 | `fish-*.json` (도미 틀) |
| IC-BG-23–24 | 보석풍뎅이 · 달빛나방 | `bug-*.json` (사슴벌레·나방 틀) |
| IC-TR-01 | 섬 여행 표 (`mat.tour-ticket`, MA-09) | `mat-tour-ticket.json` (`b_ticket`) |
| UI-20 | 여행 묻기 창 | `ui.confirm` (제목 「⛵ 섬 여행」·「⛵ 돌아가기」) |
| UI-21 | 투어 섬 표시 | 도착 알림 「무인도 「초승달 섬」에 도착했어요!」 + 배 앞 「Space 돌아가기」 (오른쪽 위 칸은 아직 — 아래 「남은 것」) |
| s20 | 첫 섬 여행 장면 | 아직 (아래 「남은 것」) |

## 잰 값 (2026-11-10, Intel UHD, 개발판 1280×800, 적정)

| 자리 | GPU | 그리기 호출 | 삼각형 |
|---|---|---|---|
| 본섬 광장 (투어 전) | 4.74ms | 85 | 660k |
| 투어 섬 선착장 (TO-02 초승달) | 3.96ms | 35 | 286k |
| 투어 섬 가운데 | 3.34ms | 29 | 211k |
| 본섬 광장 (돌아온 뒤) | 5.06ms | 86 | 660k |

돌아온 뒤 x 500–900 에 남은 보이는 메시 0, 본섬 kit 묶음 수 그대로, geometry 147 → 144.

처음 받는 크기 (`node tools/build-web.mjs`): boot 묶음 = island 2.96MB + people 7.01MB (변화: `items.json` +2.1KB · `env/index.json` +0.4KB · `fruit-tree.json` +0.2KB · `tour/tour.json` 0.8KB = **약 +3.5KB**). 새 `packs/tour-1.json` 82KB (배·광석 바위 모델·스펙, 선착장 배를 놓을 때 받음). 새 아이템 아이콘·모델은 기존 `icons`·`items` 묶음. 게시 파일 191 → 195.

## 점검

- `node --test tests/` 398 통과 (새 `tests/tour.test.mjs` 넷: 모양 틀 넷 × 시드 50 — 선착장·배·이어진 땅·과일나무 3·광석 3 · 같은 날 같은 섬 · 투어에만 나오는 물고기·곤충·특산 제외 · 설정·묶음). 개수 박은 테스트: 배경 72 · 아이템 아이콘 112 · 스펙 99 · 들어 보이는 모델 55 · 물고기 22 · 곤충 24 · 과일 8 · 박물관 54 · 주민 지문에서 투어 아이템 뺌.
- 자동 플레이 `--only=boot,naming,tour` 3/3 통과 (콘솔 오류 0): 선착장 끝 → 묻기 창 → TO-02 → 망고 5 → 배로 돌아옴. 새 게임엔 삽이 없어 광석은 「삽 없음」으로 기록 (전체 플레이에서는 엔딩 뒤라 삽이 있다).
- 손으로 (개발판): 본섬 배 Space → 묻기 창 → 도착 → 망고 흔들기 → 삽으로 광석 6번(철·돌·점토…) → 7번째 「오늘 다 캤어요」 → 두 번째 여행에 「구름」이 와 있음 → 초대 → `state.town.moving.invited = 'gureum'` → 배로 돌아오기 → drops·`tour:` 기록 0.

## 남은 것 · 알아 둘 것

- **배 장면**: 지금은 선착장 끝으로 걸어가 원형 전환 + 「바다를 건너는 중…」 알림. 배가 바다로 나가는 3초 장면(배 모델·주인공이 같이 움직임)과 첫 여행 장면 s20 은 아직 — 시나리오 편집기에 장면으로 더하는 것이 다음 차례.
- **UI-21**: 오른쪽 위 「🏝 초승달 섬」 작은 칸은 아직 (도착 알림으로 대신).
- 표는 선착장 배에서만 산다 (표가 없으면 그 자리에서 1,000 도토리). 도토리상점 진열에 표를 더하는 것은 다음 (`rules.json shop`).
- 투어 중엔 `world.island` 의 칸 질문이 투어 섬이라, 본섬 주민의 칸 질문도 투어 섬 칸을 받는다 (주민은 멀리 있어 안 보임 — 돌아오면 다시 본섬). 자동 플레이에서 문제는 없었다. 새로 칸을 읽는 모듈은 `world.home.island` 를 쓸 것.
- 언덕 섬 TO-04 는 경사로 자리를 못 찾으면(시드 200 중 79) 평평한 둥근 섬이 된다.
- 쌍둥이 섬 TO-03 다리는 바다 2칸 위 (시드 200 중 196, 나머지는 모래 띠로 이음).
- 편집기 게시(배경 편집기에 BD-08 · EN-13 · 아이템 9 검수 대기)와 게임 게시는 main 합치기 승인 뒤.
