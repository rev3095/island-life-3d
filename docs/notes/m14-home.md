# M14 집과 섬이 자란다 — 트랙 노트

브랜치 `p55-m14-home` · 작업 트리 `../island-worktrees/m14-home` · 포트 4262 · main 2299be4 위. 합치기·게시는 하지 않음 (조정 세션 몫).

## 만든 것

### 1. 집 증축 (D150-A · D151-A · D154-A)
- 규칙(순수) `src/gameplay/house/home.js` — 단계·빚·갚기(`offer`·`startBuild`·`finishBuild`·`repay`·`repayChoices`), 층 목록 `floorsFor`, 1층 넓힐 때 가구 옮김 `growShift`·`shiftRecs`, 계단 `stairHeight`·`stairTrigger`·`fixtureBlockers`·`arrivalAt`, 방 검사 `checkHomeRoom`.
- 설정 `assets/interior/home.json` — 0 처음 집(8×8) · 1 방 넓히기 20,000 · 2 2층 50,000 · 3 다락 100,000, 갚기 단추 1,000·10,000·다 갚기, `afterIntro`.
- 방 배치 `assets/interior/rooms/rm-15.json` (넓힌 1층 10×10, z 0) · `rm-16.json` (2층 8×8, z 40) · `rm-17.json` (다락 8×6, z 80, 벽 1.8) — `owner: 'player'`, `floorIndex`, `fixtures` (계단·구멍 칸, `from` 단계), `starter`. interior `index.json`·`WEB_FILES`·요소 편집기 `files.json` 에 더함.
- `house/index.js` 다시 씀 — **층(level)마다 방·구역(world.addZone)** 이 따로, 가구 rec 에 `floor`, 층별 벽지·바닥(`state.house.grow.decor[n]`), 집 안 층 `state.house.level`(이어하기).
  - 우편함(`house-grow`, 우선순위 92 — 안 읽은 편지가 있으면 town:mail 91 이 먼저): 밤톨 대화로 짓기·갚기. 짓기는 **다음 날 아침(data:newday)** 에 완공, 집 안에 있으면 나올 때.
  - 계단: 1층 동쪽 벽 FU-67 을 남→북으로 걸어 오르면(높이 0 → 1.7) 꼭대기에서 짧게 어두워졌다(원 없음 0.24+0.32초) 2층 구멍 옆에 서서 몇 걸음. 2층 FU-69 구멍의 열린 북서쪽으로 들어서면 1층 계단 꼭대기 → 걸어 내려옴. 2층 FU-68 → 다락 FU-70 도 같다. **팝업 없음.**
  - 겉모양: 단계 1 부터 BD-12 `house-grown-1|2|3` 을 저장하지 않는 물체로 놓고 처음 집 BD-01 은 치운다 (`applyExterior`, 문짝은 그 모델에서 잰다).
  - 서비스 `house.grow` = { stage, debt, pending, max, level, floors(), stairs(), talk(), finish() }, `house.room` 은 지금 층.
- `room.js buildRoom` 옵션 `wallH`·`door: null`, `grid.js wallInFront` 에 `d`.

### 2. 섬 별점 (D152-A)
- `src/gameplay/rating/` (rules.js 순수 · index.js 창), 설정 `assets/rating/rating.json`.
- 꽃 0.6/개(150까지) · 나무 80–140 그루 40점 · 꾸민 가구 4 · 울타리 1 · 길 0.75 · 다리·경사로 6 · 집 단계 12 · 주민 3 · 잡초 −2.5 → 별 문턱 0/90/150/230/300. 새 섬(잡초 30)은 ★1, 잡초만 뽑으면 ★2.
- 섬폰 「⭐ 섬 평가」 UI-25 (`phone.js APPS` 한 줄): 별 · 다음 별까지 · 오늘의 주민 한마디(칭찬 + 가장 아쉬운 칸) · 칸별 점수.
- 하루 리셋·창 열 때 다시 잼, 처음 오른 별마다 도토리(★2 1,000 · ★3 2,000 · ★4 3,000 · ★5 5,000), 첫날 할 일 뒤부터. 별 다섯 처음 → `rating:stars {first5}` → 장면 **s25-five-stars** (트리거 `rating-five`, story/rules.js · files.js · index.json · 편집기 게시 목록).

### 3. 다리·경사로 (D153-A)
- `src/world/built.js` — 생성기 칸 표(kind·level·flags·rampMap·ramps·bridges)를 바꿔 **플레이어 이동·높이·주민/봇 길찾기가 그대로 따라온다**. `world.build` 로 올림. island.js `deckHeight` 에 `rot`(남북 다리)·`y`(언덕 위 강).
- 다리 TI-13: 강물 정확히 2칸 줄 + 양 끝이 같은 높이 땅(동서·남북). 경사로 TI-14: 남쪽 보는 절벽(높이 1) 바로 앞 아래 두 칸(높이 0 풀·모래·흙길), 생성기 경사로와 같은 칸 모양.
- 섬 꾸미기 `decor.json builds` (다리 🌰3,000 · 경사로 🌰2,000, `buildLimit` 12) — 아래 칸에서 골라 앞 칸(또는 한 칸 더 앞)에 놓기, 고치기에서 치우기(돌려받지 않음, 서 있는 칸은 못 치움). 저장 `state.island.built`, 모델은 시작할 때 다시 놓는 저장 안 하는 물체.
- 모델 lazy: `decor.json` `builds`·`homes` → world `decorKinds` · 게시 `DECOR_FILES` (decor 묶음, 처음에 안 받음). occlusion 에 house-grown-*.

### 4. 모델 (Blender 스크립트, 모두 status review)
- BD-12 `house-grown-1|2|3` (build_env.py `b_house_grown`, stage 1 날개 방 · 2 2층 창·꽃 상자 · 3 다락 내민 창·둥근 창) — 문 자리 BD-01 과 같음, 집터 world.lot 4×3(모델 3.04 폭), 충돌 3.0.
- TI-13 `bridge-built` (`b_built_bridge`) · TI-14 `ramp-built` (`b_built_ramp`).
- 붙박이 FU-67 `home-stairs` · FU-68 `attic-stairs` · FU-69 `stair-rail` · FU-70 `attic-hatch` (build_furniture.py, assets/furniture/fixtures).

## 확인 (2026-11-12)
- main 585c28a (m13-daily · p54-night-special · board-archive · museum-stars 포함) 를 브랜치에 합침 — 충돌은 줄 단위로 둘 다 살림, 개수 테스트는 main 값 + M14 (배경 84+5 = 89 · 붙박이 18+4 = 22), env·붙박이 index.json 은 `--index` 로 다시 만듦.
- `node --test tests/` **517 통과 · 0 실패** (합친 뒤).
- `node tools/check-interiors.mjs --home --port=4262`: 0–3단계 겉모양 · 들어가기 · 계단 1→2→다락→2→1층 모두 ✅, 콘솔 오류 0 (합친 뒤 다시 돌림).
- `node tools/playtest.mjs --port=4262` (합치기 전): 31✅ 0🟡 0⛔ · 콘솔 오류 0 · `home-grow` 통과 (1단계 짓기 · 10×10 · 섬 평가 ★). 봇은 도토리가 모자라 2층은 다음으로 넘김 — 계단은 check-interiors 가 본다. 처음엔 봇이 빚에 도토리를 다 써서 뒤 `clock-phone` 이 🟡 → 1,000 씩만 갚게 고침.
- 실제 게임(머리 없는 Chrome)에서 다리·경사로를 Space 로 놓고 걸어서 건너고·오름 확인 (도토리 3,000·2,000 빠짐, 콘솔 오류 0).
- 원래 줄: 새 테스트 `home.test.mjs` · `built.test.mjs` · `rating.test.mjs`. 개수 맞춘 테스트: assets 배경 76→81 · 붙박이 목록 +FU-67–70 · 주민 방 테스트는 `owner !== 'player'` 만 · 방 목록은 전부.
- `node tools/check-interiors.mjs --home --port=4262` (새 `--home[=0,1,2,3]`): 단계마다 겉모양 · 문으로 들어가기 · 계단 걸어 오르내리기 · 사진 (결과 docs/qa/runs/<날짜>-interiors).
- 자동 플레이 단계 `home-grow` (scenario.js, island-decor 다음).

## 결정 (추천안으로 정함)
- **D150-A** 단계 넷과 값(위). 빚을 다 갚아야 다음, 짓기는 다음 날 아침. 묻기·갚기는 내 집 우편함만 — 상점 주인 대화는 `places.js` 가 다른 트랙이라 넣지 않음 (나중에 `house.grow.talk()` 를 상점 대화 선택지에서 부르면 된다).
- **D151-A** 계단은 걸어서, 층 사이는 원 없는 짧은 어둠 + 자동 몇 걸음 (흔들림 줄이기면 걷기 없이).
- **D152-A** 섬 별점 값·상(위). 주민 한마디는 섬폰 창 안에만 (주민 대사 파일·talk.js 는 M15 트랙 몫이라 안 건드림).
- **D153-A** 다리·경사로 자리 규칙과 값(위), 남쪽 절벽만 (게임 카메라가 남쪽에서 봄 · 생성기 경사로 높이 공식이 남북).
- **D154-A** 겉모양 BD-12 세 모델, 처음 집 BD-01 은 치우고 저장 안 하는 물체.

## 다른 트랙과 겹칠 수 있는 곳 (합칠 때 줄 단위로 둘 다 살리기)
- `src/world/index.js` (decorKinds 한 줄 · `build` 한 줄 · import 한 줄) · `src/world/island.js` (deckHeight·groundAt 두 줄) · `src/world/occlusion.js` (한 줄)
- `src/ui/phone.js` APPS 한 줄 · `src/gameplay/index.js` 모듈 한 줄 · `src/gameplay/story/rules.js` 트리거 한 줄 · `story/files.js`·`assets/story/index.json`·`assets/story/editor-files.json` 각 한 줄
- `tools/build-web.mjs` (island 묶음 정규식에 `rating`, DECOR_FILES) · `tools/check-interiors.mjs` (`--home`) · `tests/playthrough/scenario.js` (`home-grow`)
- `assets/blender/build_env.py`·`build_furniture.py` BUILDERS 줄 · `assets/env/index.json` · `assets/furniture/fixtures/index.json` (빌더가 다시 씀 — 합친 뒤 `--index` 로 다시 만들면 됨)
- 개수 테스트: `tests/assets.test.mjs` 배경 count (+5), `tests/places.test.mjs` 붙박이 id 목록 (+FU-67–70)

## 남은 것
- BD-12·TI-13·TI-14·FU-67–70 검수 (status review) — 리소스 편집기 목록·홈 catalog 갱신은 문서/조정 세션.
- 상점 주인 대화에서 집 증축 묻기(places.js 트랙과 같이).
- 다리·경사로는 섬 꾸미기 안에서 놓는 칸이 정해져 있어 봇 단계는 아직 없음 (테스트 built.test.mjs 가 칸 표·길찾기를 본다).

## 문서 세션이 반영할 문장
- CLAUDE.md 「큰 구조」 실내 줄: "내 집은 M14 집 증축으로 층이 늘 수 있다 — 1층 x 500 z 0 (넓히면 10×10) · 2층 z 40 · 다락 z 80, 층마다 방·구역이 따로이고 계단(붙박이 FU-67–70)을 걸어 오르내린다. 규칙 `house/home.js`, 설정 `assets/interior/home.json`, 방 RM-15–17, 우편함(92)에서 도토리 빚으로 짓고 갚는다 (`docs/notes/m14-home.md`)."
- CLAUDE.md 「섬 꾸미기」: "M14 다리 TI-13·경사로 TI-14 는 `decor.json builds` — `world.build` (world/built.js) 가 생성기 칸 표를 바꿔 이동·길찾기가 따라오고, 저장은 `state.island.built`."
- CLAUDE.md 새 줄: "섬 별점 `src/gameplay/rating/` (설정 `assets/rating/rating.json`, 섬폰 ⭐ UI-25, 별 상, 별 다섯 처음 s25 `rating-five`)."
- CLAUDE.md 명령어: "`node tools/check-interiors.mjs --home[=0,1,2,3]` 내 집 단계별 (겉모양 · 들어가기 · 계단)."
- 「명령어」 개수 테스트 문단: 배경 81 · 붙박이 FU-67–70.
- CONTRACTS: `house.grow`, `world.build`, 이벤트 `house:build`·`house:grown`·`house:repay`·`house:paid`·`house:floor`·`decor:build`·`rating:stars`, 상태 `state.house.grow`·`state.house.level`·`state.island.built`·`state.rating`.
- PLAN 41 M14: ✅ (브랜치 p55-m14-home), 결정 D150–D154.
