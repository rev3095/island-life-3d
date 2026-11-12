# M18-P3 계절 낚시·곤충 대회 (브랜치 `m18-p3-contest`, 15차 보드 wave15 D194-A)

보드: https://claude.ai/artifact/3hoiPoHF3nZJS2fDj5nSVc (D190–D197 모두 A). 포트 4293. main 7074235 위.

## 만든 것

- **설정 하나** `assets/contest/contest.json` — 날짜·시간(9–18시)·제한 시간(`seconds` 180 = 실제 3분)·점수(`score.perCatch`)·크기 표(`size`)·사회 주민(`host` = 초롱)·주민 참가자(`rivals`)·상(`prizes`)·무대(`stage`, `assets.env`)·대사(`lines`, `{name}` `{whatObj}` `{toolSubj}` 칸). 결정이 바뀌면 이 파일부터.
  - 대회 날: 봄 낚시 3/20 (CT-01) · 봄 곤충 5/20 (CT-02) · 여름 낚시 7/20 (CT-03) · 가을 곤충 10/5 (CT-04) · 겨울 낚시 12/10 (CT-05). 계절 행사 7일(4/1 · 8/1 · 10/15 · 12/20 시작)과 안 겹친다 — 테스트가 2026–2034 해마다 본다. 섬 축제 날이면 그날 대회는 쉰다(`contestOn(…, { festivalToday })`), 엔딩(첫 섬 축제) 뒤부터 (`open.after: "ending"`, 계절 행사와 같은 규칙).
- **규칙(순수)** `src/gameplay/contest/rules.js` — `contestOn` · `inHours` · `upcoming` · `sizeOf`(물고기 = 그림자 크기별 기준 cm, 곤충 = 값 구간별 기준 cm, 둘 다 ±25%) · `scoreOf`(점수 = 가장 큰 것 cm + 마릿수 × 10) · `rivalsOf`(사회 주민 빼고 섬 주민 셋을 날짜 씨앗으로, 잡는 시각·크기까지 날짜로) · `standings`(점수 → 그 점수에 먼저 닿은 쪽 → 플레이어) · `prizeOf` · `stageSpot`(무대 자리, 섬 생성기로 테스트).
- **놀이** `src/gameplay/contest/index.js` (gameplay `PARTS` 에 `contest`) — 대회 날 하루 동안 광장 가까이 무대 BD-17 (`world.objects.add(…, { persist: false })`, 저장 안 함, 다음 날 치움, `game:ready` 뒤에만 놓음 — 망원경대·행상 수레를 먼저 자리 잡게) · 9–18시 사회 초롱이 무대 둘레(town `pickSpot` 의 `contest.hostSpot`) · 접수 탁자 앞 Space → 초롱 대화 → 「나갈래요!」 → 대회 도구를 들려 주고 시작 (`contest:enter`) → 잡을 때마다 크기 알림 (`gather:catch` → `contest:catch`) → 3분 뒤 결과 발표(초롱 대화로 4위부터 1위까지) → 상 (`contest:end`). 대회 시간엔 비 대신 흐림(행사 D80-A 와 같게).
  - 시간은 실제 초(프레임 dt)로 센다 — 창이 열린 동안·장면 동안은 멈추고 주민 기록도 같은 시각으로 멈춘다. 날이 바뀌면 그 자리에서 끝낸다. 진행 중 대회는 저장하지 않는다 (다시 열면 그날 다시 접수할 수 있다).
  - 접수는 하루 한 번 (`state.contest.runs['CT-0N:해']`). 18시 뒤·이미 나간 뒤엔 「대회」 안내만. 가방이 꽉 차면 트로피는 `state.contest.owed` 에 맡겨 두고 다음에 탁자에서 준다.
- **대회 창 UI-34** `src/gameplay/contest/ui.js` — 대회 중에만, 창을 막지 않는다. 화면 위 가운데: 이름 · ⏱ 남은 시간(30초 아래는 빨강) · 내 기록(가장 큰 것·마릿수·점수) · 순위 넷(🥇🥈🥉 · 나는 노란 줄). 휴대폰(560px 이하)은 한 줄(`🐞 ⏱ 2:50 · 1위 · 14점 · 1마리`) — 맨 위 줄은 시계 HUD·가방 단추가 차지해서 시계 칸 바로 밑(`--pk-clock-extra` 따라 내려감). 장면 동안은 숨긴다.
- **상** — 1등 금 트로피 FU-89 + 🌰3000 · 2등 은 트로피 FU-90 + 🌰2000 · 3등 동 트로피 FU-91 + 🌰1000 · 4등·못 잡음 = 참가 🌰300. 가구 표 `src/data/contest-items.js` (`CONTEST_FURN`, 출처 `contest` — 상점·나무 흔들기에 안 섞임) → `items.js` 가 붙임.
- **새 모델 넷 (모두 status `review`)** — 무대 BD-17 `assets/env/specs/contest-stage.json` (빌더 `assets/blender/contest_env.py`, 3×2 마루·시상대 셋·현수막·삼각 깃발 줄·앞 왼쪽 접수 탁자, 충돌 `boxes` 셋) · 트로피 FU-89–91 `assets/furniture/specs/trophy-{gold,silver,bronze}.json` (빌더 `assets/blender/contest_furniture.py`, 한 모양 `contest-trophy` 에 잔 높이·별 크기·팔레트만 다름). 빌더 파일을 따로 둬서 `build_env.py`·`build_furniture.py` 는 `import … BUILDERS.update(…)` 한 줄씩만 바뀜.
- **섬 일지** — 목표 「대회 나가기」 🏆 `contester` (`on: "contest"`, 1·5·15번 → 150·400·1000 포인트, journal.json v5). `journal/index.js` `listen` 에 `contest:enter` → `count('contest')`.
- **장면 s29 「첫 대회」** `assets/story/scenes/s29-first-contest.json` (트리거 새 `contest-first` = `contest:enter` 의 `first`, 자리 `event` = 접수 탁자 앞, 연출안 A 넷 컷 · B 한 컷, status review) — `story/rules.js TRIGGERS`·`story/files.js`·`assets/story/index.json`·`assets/story/editor-files.json` 에 한 줄씩.
- **잡기 신호** `gather/results.js` `gain(…, { verb: '잡았다' })` 이 `gather:catch { id, category, n, added }` 를 보낸다 (물고기·곤충·바다 생물 — 대회는 category 로 거른다). 섬 일지·다른 놀이도 들을 수 있다.
- **행동 키** — 접수 탁자 `contest:desk` **104** (대회 날 무대 탁자 앞 1.6칸에서만). 축제 시작·행사 할 일 101 · 눈덩이 102 · 소원 103 과 같은 값을 쓰지 않고, 말 걸기 100 위라 근처 주민에게 새지 않는다. 주민은 탁자 앞 3.2칸에 서지 않는다 (town `keepClear` 에 `contest.clearSpots()`). 낚시 중(찌가 나가 있음)엔 `gather-busy` 가 먼저다.
- **게시 묶음** — 무대 모델은 처음에 받지 않고(world `lazy`, `contestKinds`) `daily` 묶음에 같이 (`build-web.mjs CONTEST_FILES`). `assets/contest/` 는 `island` 묶음. 트로피 썸네일 셋으로 `icons` 묶음이 하나 늘어 묶음 21개 (`tests/build-web.test.mjs` 상한 20 → 21).
- **봇** `tests/playthrough/scenario.js` 단계 `contest` (`yearly` 앞): 시계를 29시로 넘기며 다음 대회 날까지 → 10시 → 걸어서 접수 탁자 → Space → 「나갈래요!」 → (첫 대회면 s29) → `sk.fish`/`sk.bug` 로 3분 → 결과 → 상·섬 일지·대회 창 닫힘 → 다시 Space = 「벌써 나갔어요」. 봇은 `?date=` 를 쓰지 않고 날을 넘긴다(시나리오는 날짜를 박지 않는다).

## 확인 (2026-11-13)

- `node --test tests/` — 553개 중 552 통과 · 1 건너뜀 · 실패 0 (`tests/contest.test.mjs` 10개 새로).
- 개발 서버 4293, 날짜 흉내 `?date=` 로 실제 키 확인 (준비는 행사 점검과 같게 미리 보기 저장에 `state.festival.endedDay` 만):
  - 3/20 봄 낚시: 엔딩 전엔 대회 없음 → 엔딩 뒤 10시 무대 · 접수 탁자 앞 행동 키 「접수」 → Space 대화 → 「나갈래요!」 → 낚싯대를 들고 시작 → **s29 장면** → 낚시 1마리 39.6cm → 3분 뒤 결과 발표 (4위 보리 45.4 · 3위 하늘 49.6 · 2위 파도 73.9 · 1위 코코 78) → **동 트로피 FU-91 + 🌰1000**.
  - 7/20 여름 낚시: 두 번째 대회라 장면 없음 · 2마리 31.2점 4위 → 참가 🌰300 · 다시 Space = 「오늘 대회는 벌써 나갔어요!」 · 19시 = 「대회」 안내(접수 안 됨) · 다음 날 무대 치워짐 · 다음 대회 10/5 (76일 뒤).
  - 10/5 가을 곤충: 잠자리채를 들고 시작 · 무당벌레 4cm 기록 · 휴대폰 한 줄 확인.
  - 콘솔 오류 0 · 404 0.
- 스크린샷 (공유 노트 폴더 `m18-p3-contest-shots/`): `01-s29-first-contest.jpg` · `02-contest-window-pc.jpg` · `03-contest-line-mobile.jpg`.
- 봇 전체 플레이 (`node tools/playtest.mjs --port=4293 --date=2027-03-08`) — 결과는 아래 「봇」 줄.

## 밸런스 (주민 점수)

- 주민 셋의 마릿수·가장 큰 것은 `rivals.catches`·`rivals.best` (낚시 2–5마리 · 20–65cm, 곤충 1–4마리 · 4–9cm). 보통 실력(3분에 물고기 4마리 14·28·28·45cm, 곤충 3마리 4·6·6cm)이면 100해 중 1등 낚시 35 · 곤충 24번 — 테스트가 20해 중 1등 ≥2 · 1등 아님 ≥2 를 본다. 처음엔 22–75cm 로 너무 세서(1등 1/20) 낮췄다.
- 개발 서버에서 손으로(봇 흉내) 3분 낚시는 1–2마리였다 — 사람 손이면 더 잡는다. 실제 플레이 기록이 쌓이면 `rivals` 를 다시 맞춘다.

## 다른 트랙과 겹칠 수 있는 곳 (합칠 때 줄 단위로 둘 다 살리기)

- `src/data/items.js` 가구 줄 (`...CONTEST_FURN`) — M18-P4 계절 레시피 가구(FU-92–104 쯤)도 같은 줄에 더할 것.
- 개수 테스트: `tests/assets.test.mjs` 배경 89 → 90 · 가구 60 → 63, `tests/items.test.mjs` 가구 60 → 63, `tests/build-web.test.mjs` 묶음 상한 20 → 21 — 합칠 때 **main 값 + 두 쪽이 더한 만큼**. 생성 목록 `assets/{env,furniture}/index.json` 은 `--index` 로 다시.
- `assets/story/index.json`·`story/files.js`·`story/rules.js TRIGGERS`·`assets/story/editor-files.json` — M18-P2 장면 s30–s32 도 같은 자리에 더함.
- `assets/villagers/editor-files.json`·`assets/story/editor-files.json` 에 `src/data/contest-items.js` (items.js 를 편집기가 부르므로).
- `src/gameplay/town/index.js` (keepClear · hostBusy · pickSpot 세 줄), `src/world/index.js` (`contestKinds`), `src/gameplay/gather/results.js` (`gather:catch` 한 줄 — M18-P1 계절 생물이 gather 를 고치면 그 줄만 살리기), `src/gameplay/journal/index.js` (listen 한 줄), `assets/journal/journal.json` (목표 한 줄, version 5), `tools/build-web.mjs` (`CONTEST_FILES` · island 정규식 `contest`).
- `assets/blender/build_env.py`·`build_furniture.py` 끝 `import contest_*` 한 줄씩.
- M18-P2 「그날만 날씨」(장마·태풍·첫눈): 대회 시간엔 비를 흐림으로 바꾼다 (`T.weatherOverride` 가 있으면 그대로) — 태풍 같은 날이 대회 날(3/20 · 5/20 · 7/20 · 10/5 · 12/10)과 겹치면 어느 쪽이 먼저인지 정해야 한다. 12/10 은 첫눈 하루 후보와 가까울 수 있음.

## 남은 것

- 새 모델 넷(BD-17 · FU-89–91)과 장면 s29 는 **검수 대기(review)** — 리소스 편집기·스토리 편집기 게시는 조정 세션이 합친 뒤.
- 섬폰 📅 달력(UI-13)에 대회 날 줄을 더하기 (지금은 대회 날 아침 알림·서비스 `contest.upcoming()` 만). 달력은 `events/eventsui.js` 라 이 트랙에선 건드리지 않음 → 제안: `openCalendar` 의 `upcoming` 에 `ctx.services.contest?.upcoming?.()` 를 섞어 「🎣 봄 낚시 대회 3/20」 줄.
- 행사 점검 도구 `tools/check-events.mjs` 에 `--only=CT-01` 같은 대회 점검을 넣으면 게시본에서도 날짜 흉내로 볼 수 있다 (이번엔 개발 서버 손 점검만).
- 주민 참가자는 기록만 있고 실제로 낚시하는 모습은 없다 — 대회 시간에 참가 주민을 물가로 보내는 것은 나중 (town `together` 의 낚시 자세를 다시 쓰면 된다).

## 문서 세션이 반영할 문장

- CLAUDE.md 「큰 구조 · 게임 런타임」 행동 키 우선순위 문장에: 「… 소원 빌기 103 (유성우 밤 올려다보며) · **대회 접수 탁자 104 (M18-P3 — 대회 날 광장 무대 앞에서만, 축제·행사 101·눈덩이 102·소원 103 과 겹치지 않는 값)** · 눈덩이를 밀고 있을 때 …」 (값 순서상 맨 앞에 두어도 된다: 「대회 접수 탁자 104 · 소원 빌기 103 · …」). 그리고 「`src/gameplay/index.js` 는 … `tour/`(P35) · `contest/`(M18-P3) 하위 모듈을 …」.
- CLAUDE.md 새 절 (「섬 일지 · 매일 할 거리」 뒤): 「### 계절 대회 (M18-P3, `src/gameplay/contest/`, 보드 wave15 D194-A)
  - 설정 하나 `assets/contest/contest.json`, 규칙(순수) `contest/rules.js`, 대회 창 UI-34 `contest/ui.js`. 낚시 대회 3/20·7/20·12/10 · 곤충 대회 5/20·10/5, 그날 9–18시, 엔딩 뒤 · 섬 축제 날 쉼 · 계절 행사 7일과 안 겹침(테스트). 그날 하루 광장 가까이 무대 BD-17 (`persist:false`, 자리 `rules.stageSpot` — 섬 생성기로 테스트, `game:ready` 뒤에 놓음) · 사회 초롱(`contest.hostSpot`, 탁자 앞 3.2칸 `clearSpots`). 접수 탁자 Space(104) → 대화 → 3분(실제 초, 창·장면 동안 멈춤) 동안 잡은 것(`gather:catch`)의 크기·마릿수 → 점수 = 가장 큰 것 cm + 마릿수 × 10 → 주민 셋(날짜로 정한 기록)과 순위 → 금·은·동 트로피 FU-89–91 (`src/data/contest-items.js`) + 도토리, 4등 아래 참가 도토리. 섬 일지 목표 「대회 나가기」(`contest:enter`), 첫 대회 장면 s29 (`contest-first`). 저장 `state.contest` (`runs`·`first`·`owed`·`told`), 진행 중 대회는 저장 안 함. 봇 단계 `contest` 는 날을 넘겨 다음 대회 날로. 노트 `docs/notes/m18-p3-contest.md`.」
- CLAUDE.md 「섬 일지」 줄: 「셀 일은 … `listen` 에 더한다」 뒤에 「(M18-P3 `contest:enter` → `contest`)」.
- CLAUDE.md 「명령어」 개수 테스트 문장에 「`tests/build-web.test.mjs` 묶음 상한(지금 21)」을 더하기.
- CONTRACTS 「1차 합친 뒤 추가된 약속」에: 이벤트 `gather:catch { id, category, n, added }` (gather/results.js, 잡았다 동사일 때) · `contest:enter { id, kind, first, dayKey, x, z }` · `contest:catch { id, item, size, n }` · `contest:end { id, kind, rank, score, best, count, prize }`, 서비스 `ctx.services.contest = { config, today(), live(), running, view(), upcoming(), record(id), hostSpot(slug), clearSpots(), desk(), debug }`, 상태 `state.contest` (주인 gameplay/contest).
- PLAN 47줄 M18-P3: 「✅ 11-13 브랜치 `m18-p3-contest` — 대회 다섯 날 · 무대 BD-17 · 트로피 FU-89–91 · UI-34 · s29 · 일지 목표 · 봇 단계, 새 모델 넷 review」.
- `concept/README.md` 보드 목록 wave15 줄에 「M18-P3 반영 = 대회 (`assets/contest/contest.json`)」.
