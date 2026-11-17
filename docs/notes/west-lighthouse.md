# 서쪽 등대 · 등대지기 (west-lighthouse, D270–D274)

M19-P4 「등대 다시 켜기」의 등대가 섬 북쪽 바위 끝(z ≈ 5)이라 남쪽에서 내려다보는 카메라로 잘 안 보였다 (사용자: 「잘 안 보인다」).
등대를 지금 모습(BD-18 dark|repair|lit · 소품 PR-41–44 · 돌길) 그대로 **섬 서쪽 끝 바닷가**로 옮기고, **등대지기 NPC 윤슬 CH-20** 을 세워
단계마다 **재료 + 도토리**를 받아 진행하게 했다. 같은 때 동쪽 끝은 다른 세션(어선·뱃사공·바다 낚시).

## 결정

| 번호 | 결정 | 자리 |
|---|---|---|
| D270-A | 등대 자리 = 섬 서쪽 끝 바닷가 곶. `lighthouse.json site` = `{ v: 2, at: [0.12, 0.56], side: "west" }` — 광장(0.37, 0.54)과 같은 줄이라 광장에서 서쪽으로 걸으면 화면에 들어온다. 지금 섬(시드 20261028) = 칸 (9, 26) 모래, 서쪽 세 칸 밖 바다. 다른 시드 섬은 서쪽 절반 안에서 가까운 곳 (`rules.siteSpot` side west: 서쪽 절반 · 같은 거리면 서쪽부터 · 뒤 서쪽 귀퉁이는 바다여도 됨) | `assets/lighthouse/lighthouse.json` · `rules.js siteSpot` |
| D270-B | 섬 자리 파일(`layout.json`·`island.js`)은 **고치지 않았다** — 등대 자리는 처음부터 `lighthouse.json site` 에 있었다 (동쪽 세션과 안 겹침) | — |
| D270-C | 저장 이어가기: `state.lighthouse.siteV` (자리를 고른 설정 판). 예전 저장은 siteV 가 없어 1 → 지금 설정 v2 와 달라 **자리만 다시 고르고** 시작한 날·단계·끝낸 날·도움·불 켠 날은 그대로 (`rules.siteFor`). 단계 소품·돌길은 저장하지 않고 새 자리에 다시 놓인다 | `rules.js normalize·siteFor` · `index.js findSite` |
| D271-A | 등대지기 = **윤슬 (바다표범 노인)**, CH-20, slug `yunseul`. 이유: 섬 주민·상인·밤 상인(고양이·개·토끼·곰·오리·개구리·여우·거북·양·펭귄·부엉이·햄스터·코끼리·다람쥐·박쥐·나방·고슴도치)에 없는 바다 동물이고, 바닷가 등대를 오래 지킨 노인에 어울린다. 이름 「윤슬」 = 햇빛·달빛에 반짝이는 물결 (등대 불빛과 이어짐), 기존 이름과 안 겹침 | `assets/specs/yunseul.json` (status review) · 빌더 `FEATURES.seal` (귀 없음 · 곰 주둥이 · 볼 · 새 부품 `whiskers` 수염) |
| D272-A | 등대지기는 등대 앞 왼쪽(가운데 + `keeper.at` [-2.1, 2.2], 막히면 `alt`)에 늘 서서 남쪽을 본다 (돌아다니지 않음). 말 걸기(행동 키 99, `lighthouse:keeper`) = 지금 단계 · 필요한 재료와 개수 · 가방에 있는 수 · 필요한 도토리 · 모자란 것과 몇 개 · 도와줄 이웃 → 다 모이면 「건네기」. 등대 앞 Space(98)도 같은 이야기. 처음 7칸 안에 오면 s66, 불 켜는 밤 s60 이 끝나면 s67 | `src/gameplay/lighthouse/keeper.js` · `index.js keeperTalk` · 대사 `assets/villagers/yunseul.json` (role keeper) |
| D273-A | 단계마다 도토리 (`stages[].acorns`) — 상점 가구 값(250–3,000) 정도로 1,000 · 1,500 · 2,000 · 2,500 · 3,000 (모두 10,000). 재료 → 도토리 → 도움 차례로 막고(`canFinish.why` = needs·acorns·helpers), `short` 에 모자란 것과 수 | `rules.js acornsOf·acornRow·shortOf·canFinish` |
| D274-A | 진행판 UI-37 에 「🌰 도토리 가진/필요」 줄 (재료 줄 뒤, 도움 줄 앞), 다 모이면 「등대지기 윤슬에게 건네기」 | `index.js view` |

## 단계별 재료 · 도토리

| 단계 | 재료 | 도토리 |
|---|---|---|
| 1 🪨 길 내기 | 돌 10 · 나무 5 | 1,000 |
| 2 🪜 계단 고치기 | 나무 10 · 단단한 나무 5 · 철광석 2 | 1,500 |
| 3 🔍 렌즈 닦기 | 조개껍데기 6 · 점토 3 | 2,000 |
| 4 ⭐ 별 조각 등불 | 별 조각 3 · 철광석 3 | 2,500 |
| 5 🗼 불 켜는 밤 | 꽃 10 · 나무 5 | 3,000 |

(돕는 주민 둘 · 다음 단계 7일 뒤 · 시작 조건 s54 는 그대로)

## 파일

- 새: `src/gameplay/lighthouse/keeper.js` · `assets/specs/yunseul.json` · `assets/models/yunseul.glb(.json)`·`stats.json` · `assets/renders/yunseul_*.png` · `assets/villagers/yunseul.json` · 장면 `s66-lighthouse-keeper`·`s67-lighthouse-keeper-night` (status review)
- 고침: `lighthouse.json` (v2: site · keeper · acorns · about) · `rules.js` · `index.js` · `assets/blender/build_character.py` (seal · whiskers) · `assets/models/index.json` (20개) · `town/files.js`·`villagers/editor-files.json` (yunseul) · `story/files.js`·`story/index.json` (s66–s67) · `story/rules.js` (트리거 설명·힌트 keeper·lit-keeper) · `tools/build-web.mjs` (등대지기 모델 = daily 묶음) · 테스트 `lighthouse.test.mjs`·`assets.test.mjs` (캐릭터 20)

## 검증하지 않은 것 (사용자 절대원칙 — 제작 집중)

- 브라우저에서 등대가 서쪽에 실제로 어떻게 보이는지 · 카메라 화면 안에 드는지 · 등대지기 모델 모양(렌더 png 는 만들었지만 안 봄) · 수염 방향 · 장면 s66–s67 카메라·`face` 각도 · 예전 저장을 불러왔을 때 자리 옮김 · 동쪽 세션과 합친 뒤 섬 끝 겹침 — 모두 안 봄. 자동 플레이·check-*·스크린샷 안 함.

## 문서 세션이 반영할 문장

- CLAUDE.md 「명령어」 개수 줄: 캐릭터 20 (+ CH-20 등대지기 윤슬).
- CLAUDE.md 큰 구조에 한 줄: **서쪽 등대 (west-lighthouse D270–D274)**: 등대(`src/gameplay/lighthouse/`)는 섬 서쪽 끝 바닷가 (`lighthouse.json site` v2, 예전 북쪽 저장은 `siteV` 로 자리만 다시 고름). 등대지기 윤슬 CH-20 (바다표범, `lighthouse/keeper.js`, 대사 `assets/villagers/yunseul.json` role keeper) 이 단계마다 재료 + 도토리(`stages[].acorns` 1,000–3,000)를 받는다 — 행동 키 99. 첫 만남 s66 · 불 켠 밤 뒤 s67. 노트 `docs/notes/west-lighthouse.md`.
- 행동 키 우선순위 줄에 「등대지기 말 걸기 99」 더하기 (말 걸기 100 과 등대 앞 98 사이).
- CONTRACTS 「등대」 절: 서비스 `lighthouse.keeper()` · `clearSpots()` 에 등대지기 자리 · `lighthouse:scene` kind 에 `keeper`·`lit-keeper` · 상태 `siteV`·`keeperMet`.
- devlog: 장면 66개까지, 결정 D270–D274.
