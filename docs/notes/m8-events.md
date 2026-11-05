# M8 계절 행사 (8차 검수 보드 wave8)

보드 https://claude.ai/artifact/THtUdkR9e9G9qaf6FDLM5T (`concept/wave8-board.html`). **반영 v1 (2026-11-05)** = 보드 저장소 `boards/wave8` 에 고른 기록이 없음 → 미리 골라 둔 추천안 그대로 **D74–D85 모두 A**, 의견 없음 (7차 D49–D57 과 같은 규칙). `applied/wave8` v1 · `history/wave8-v1` (`commit` b87b247).

## M8-P1 행사 틀 (브랜치 `p19-events`)

| 파일 | 하는 일 |
|---|---|
| `assets/events/events.json` | 결정 갈래(D74–D85) · 날짜 규칙 `dates` · 열리는 때 `open` · 날씨 `weather` · 행사 넷 `list` (id·이름·이모지·계절·시작 날·시간 `hours`(게임 하루 시각 5~29)·장소·주인공·소품·할 것 `todo`·보상·행사 채집·장면·맡는 트랙). 웹 빌드는 `island` 묶음(boot) |
| `src/gameplay/events/calendar.js` | 순수 함수: 그 해 기간 `windowOf` (2/29 → 평년 2/28) · 오늘 기간 `windowOn` (해 넘김) · `activeOn` · 다음 차례 `upcoming` · 한 해 `yearCalendar` · 행사 시간 `inHours`/`hoursOn` (섬 축제 날은 17시까지) · 열리는 때 `isOpen` |
| `src/gameplay/events/index.js` | 모듈: 알림·도장·진행 기록·비 막기, 서비스 `ctx.services.events` |
| `src/gameplay/events/eventsui.js` | UI-14 오른쪽 아래 칸(휴대폰 세로는 시계 밑 왼쪽) · UI-13 섬폰 「📅 달력」 창 · UI-15 도장 (CSS 는 이 파일 안 글자) |
| `src/core/preview.js` | D85-A 날짜 흉내: 주소 끝 `#date=2027-04-02` (사양과 같이 `#low&date=…`, 개발판 `?date=`) → `ctx.preview = { date, saveKey }`. sky 가 시계를 그 날짜의 지금 시각으로 옮기고(`baseShift` — 실제 시계로 돌아가도 그 날짜), data 가 저장 칸을 `island-life-save-v1-preview` 로 |
| `src/ui/phone.js` | APPS 에 `calendar` 줄 (창이 있을 때만 보임) |
| `tests/events.test.mjs` | 설정 모양 · 날짜 · 시간 · 열리는 때 · 날짜 흉내 · 섬폰 줄 · 빌드 묶음 (8개) |

확인 (11-05, 개발판): `#date=2027-04-02` → 꽃놀이 2일째·남은 날 6, 진짜 저장 그대로·미리 보기 칸에만 저장(새로고침해도 이어짐), 첫 축제 전엔 밤톨 한 줄만, 엔딩 뒤 10시 → 알림·칸 「🌸 봄 꽃놀이 · 6일」, 달력 창(할 것 3/10 · 했어요, 다음 행사 셋, 도장 1/4), 섬폰 줄 「📅 달력」, 휴대폰 375×812 가로 넘침 0. `#date` 없이 열면 오늘(11/5) 행사 없음·칸 숨김. 콘솔 오류 0. 테스트 368.

## 약속 (CONTRACTS 「8차」)
- **상태** `ctx.state.events` (주인: gameplay/events) = `{ told: {"EV-01:2027": dayKey}, before: {…}, runs: {"EV-01:2027": { first, days: [dayKey], todo: { <할 것 id>: { n, day } } }}, stamps: { "EV-01": ["2027"] } }`.
- **서비스** `ctx.services.events` = `{ config, today(), active(dayKey?) → [{ev, year, from, to, day, left}], live() (지금 행사 시간인 것), isOpen(), progress(id, todo, n=1) → {n, goal, done} | null, todo(id), stamp(id) → 새로 찍었나, stamps(), calendar(year), debug: { check, openCalendar } }`.
- **이벤트 (보냄)** `events:start { id, year, first, dayKey }` (그날 처음 행사 시간에) · `events:todo { id, todo, n, goal, done }` · `events:stamp { id, year }`. **들음** `time:tick` · `time:newday` · `data:loaded` · `festival:end` · `story:start/end` (칸 숨김).
- **ui** `ctx.services.ui.calendar = { open() }` (섬폰 줄이 부른다).
- `ctx.preview` = `{ date, saveKey } | null` (main.js).

## 놀이 트랙(M8-P3–P6)에 — 이 틀 위에서
- 행사 놀이는 `src/gameplay/events/<slug>.js` (spring·summer·autumn·winter) 하나씩, `index.js` 에서 불러 `events:start`·`live()` 로 켜고 끈다. 할 것이 하나 되면 `progress(id, todoId)`, 보상을 줄 때 `stamp(id)` + 보상 가구 (FU-43–46, M8-P2 모델) + 그날 사진(FU-34 다시 씀).
- 행사 시간은 `events.json` `hours` 만 고치면 된다. 섬 축제 날은 17시에 끊긴다 (불꽃놀이는 그날 쉼).
- 행사 채집(IC-EV-01–04)은 아이템 표(`assets/data/items.json` 등)에 넣고, 나오는 때는 `live()` 로 거른다.
- 미리 해 보기: 개발판 `/index.html?date=2027-08-01`, 게시본 링크 끝 `#date=2027-08-01`. 시각은 `time.setHour` 로.

## 바꿀 자리 (보드 결정이 바뀌면)
| 결정 | 설정 칸 (지금 값) | 다른 안으로 바꾸면 할 일 |
|---|---|---|
| D74 크기 | `list` 넷 · `todo` 2~3 개 | B 큰 행사 = 행사마다 부품·부스 놀이 (P3–P6 일이 두 배) · C 둘만 = `list` 에서 EV-02·03 빼기 |
| D75 날짜 | `dates.mode` `week` · `days` 7 · `festivalFirst` | B 하루 = `days` 1 + 날짜 바꿈 · C 처음 들어온 날부터 = `calendar.js` 에 `firstVisit` 갈래 (state.events.runs[].first 기준) |
| D76–D77 · D82 | `todo` · `gather` | 할 것 글·수만 바꾸면 달력이 따른다. 놀이는 P3·P4 |
| D78 장소 | `place` (plaza·beach·anywhere) | B = 지도 편집기 `layout.json` 에 행사 자리 + world 배치 |
| D79 주민 | `host` · `props` | B·C = `host` 비움 (장면·대사가 줄어듦, P7) |
| D80 날씨 | `weather.mode` `noRain` | B 실제 날씨 = `"real"` (index.js `weather()` 가 건너뜀) · C 실내판 = 놀이 트랙 일 |
| D81 보상 | `rewards.mode` · `reward` | B·C = 놀이 트랙이 가구 대신 도토리·레시피·사진 |
| D83 열리는 때 | `open.after` `ending` | B = `"always"` · C = `"always"` + 놀이 트랙이 `isOpen()` 으로 할 것·보상만 막기 |
| D84 리소스 | — | M8-P2 범위 |
| D85 미리 보기 | `preview.mode` `hash` | B 개발판만 = `core/preview.js` `urlDate` 가 `hash` 를 안 보게 · C 섬폰 다시 하기 = 달력 창에 단추 |

## M8-P2 리소스 — 봄 꽃놀이 (EV-01) 2026-11-05, 브랜치 `p20-spring-assets`
행사 하나씩 컨셉 → 모델 → 편집기 검수. 봄 꽃놀이 다섯을 만들어 모두 status `review` (사용자 검수 대기).

| ID | 이름 | 스펙 | 빌더 | 비고 |
|---|---|---|---|---|
| EN-12 | 벚나무 | `assets/env/specs/cherry-tree.json` (nature) | `build_env.py` `b_cherry_tree` | 굽은 줄기 + 가지 넷이 옆으로, 가지 끝마다 납작한 꽃 구름(가지가 사이로 보임) + 떨어진 꽃잎. 활엽수(EN-01, 봄엔 분홍 동그라미)와 모양으로 갈림. 변형 봄(기본)·여름·가을·겨울(눈 덮인 흰색 — 빈 가지는 모양이 달라 색 변형으로 못 함). 흔들기 sway·shake, 충돌 r 0.34 |
| PR-17 | 꽃놀이 돗자리 | `event-picnic.json` (prop) | `b_picnic_mat` | 1.8칸 체크 돗자리 + 3단 도시락·보자기·찻잔 둘. 돗자리 위는 걷고 도시락만 막음 (충돌 r 0.22). 변형 빨강·파랑·초록 |
| PR-23 | 행사 간판 | `event-sign.json` (prop) | `b_event_sign` | 세움 간판 + 지붕, 그림판 색 변형 넷 = 행사 넷 (꽃놀이·불꽃·수확·눈사람) |
| FU-43 | 벚꽃 등 | `assets/furniture/specs/cherry-lamp.json` | `build_furniture.py` `b_cherry_lamp` | 벌어진 꽃잎 다섯 + 가운데 불빛(glow, 밤에 켜짐) + 꽃술. 아이템 `furn.cherry-lamp` (code FU-43, `src/data/event-items.js` EVENT_FURN) |
| IC-EV-01 | 벚꽃잎 | `assets/items/specs/event-petal.json` (group event) | `build_item.py` `b_petal` | 홈 파인 꽃잎 석 장, 위에서 보는 렌더(pitch 74). 아이템 `event.petal` (분류 `event` 「행사」, 30개씩) |

- 아이템 표: `src/data/event-items.js` (festival-items.js 와 같은 모양) → `items.js` 가 붙임. 가구 code 는 보드 ID 를 그대로 (순번 FU-35 이 아니라 FU-43).
- 테스트: 개수 표 +1 (배경 55 · 가구 35 · 아이콘 98 · 아이템 스펙 87), 아이템 ID 규칙에 EV, `villagers.test.mjs` 지문은 행사 아이템을 빼고 뜸 (목록 순번으로 고르는 칸이 많아 아이템이 늘면 모든 주민 지문이 바뀌므로 — 행동은 그대로라 핀 값 그대로 통과), 캐릭터 편집기 파일 목록에 event-items.js.
- 배경 편집기 v12 (아이템 탭에 「행사」 분류, 게시 파일 435 → 459/511).
- **아직 게임에는 안 놓였다** — 벚나무 자리·돗자리·간판 배치와 꽃잎 줍기는 M8-P3 (봄 놀이). 게임 다시 게시도 그때.

## M8-P2 리소스 — 여름 불꽃놀이 (EV-02) 2026-11-05, 브랜치 `p21-summer-assets`
봄은 사용자 "그대로" (검수 대기인 채로 main 966f198 에 합침). 여름 셋, 모두 status `review`.

| ID | 이름 | 스펙 | 빌더 | 비고 |
|---|---|---|---|---|
| PR-18 | 불꽃 발사대 | `assets/env/specs/event-raft.json` (prop, 2×1) | `build_env.py` `b_fireworks_raft` | 통나무 뗏목 + 발사 통 셋(띠·구멍) + 밧줄 테두리 + 작은 깃발. 물 위라 충돌 없음 (extent 만) |
| FU-44 | 여름밤 풍경 | `assets/furniture/specs/wind-chime.json` (벽) | `build_furniture.py` `b_wind_chime` | 벽에서 나온 나무 팔 + 유리 종(금붕어 무늬 둘) + 추 + 소원 종이. 'chime' 덩어리에 새 가구 동작 `sway` (빌더 ANIMS 에 더함). 변형 물빛·분홍·밤하늘. 아이템 `furn.wind-chime` (벽) |
| IC-EV-02 | 손 불꽃 | `assets/items/specs/event-sparkler.json` (event) | `build_item.py` `b_sparkler` | 철사 손잡이 + 회색 화약 + 끝의 별 불티 열 가닥. 아이템 `event.sparkler` (5 도토리) |

- **이번에 안 만든 것 (M8-P4 로)**: FX-01 불꽃 셰이더 — 모델이 아니라 게임 코드(`src/render/fireworks.js`, 사양별 발 수)라 놀이 트랙에서. AN-08 손 불꽃 흔들기 — 캐릭터 빌더(`build_character.py`)에 동작을 더하면 캐릭터 9종을 모두 다시 만들어야 해서, 손 불꽃 놀이와 함께 M8-P4 에서.
- PR-23 행사 간판의 「불꽃놀이」 그림판은 봄 때 색 변형으로 이미 있음.
- 테스트 개수 +1 (배경 56 · 가구 36 · 아이콘 99 · 아이템 스펙 88). 배경 편집기 v13 (469/511).

## M8-P2 리소스 — 가을 수확 잔치 (EV-03) 2026-11-05, 브랜치 `p22-autumn-assets`
여름은 사용자 "합치고 가을 진행" (main 81fc2d3). 가을 넷, 모두 status `review`.

| ID | 이름 | 스펙 | 빌더 | 비고 |
|---|---|---|---|---|
| PR-19 | 수확 큰 솥 | `assets/env/specs/event-pot.json` (prop, 2×2) | `build_env.py` `b_harvest_pot` | 돌 기둥 셋 위에 띄운 지름 2칸 무쇠 솥(테두리 고리·손잡이) + 국물 위 과일·버섯 + 김 셋 + 아래 장작불 ('flame' 덩어리 flicker). 처음 렌더에서 테두리가 국물을 덮고 불이 솥 밑에 묻혀 두 번 고침. 충돌 r 0.86 |
| PR-20 | 허수아비 | `event-scarecrow.json` (prop) | `b_scarecrow` | 기둥·가로대, 노란 옷(기운 데), 자루 얼굴, 밀짚모자·띠, 소매·목 밀짚. 변형 노랑·파랑·빨강 옷. 충돌 상자 1.15×0.22 (밀짚까지 1.24) |
| FU-45 | 수확 바구니 | `assets/furniture/specs/harvest-basket.json` (1×1) | `build_furniture.py` `b_harvest_basket` | 엮은 바구니(띠·고리 테두리·손잡이)에 호박·사과·버섯 + 앞의 단풍잎. 가구 빌더에 `tube` 를 가져오게 고침 |
| IC-EV-03 | 버섯 (셋) | `assets/items/specs/event-mushroom.json` (event) | `build_item.py` `b_mushroom` | 큰 버섯 + 작은 버섯 한 쌍, 모델 하나에 색 변형 셋 = 아이템 셋 `event.mushroom-shiitake` 표고(60) · `-chanterelle` 꾀꼬리(80) · `-red` 빨간 버섯(120, 솥에만). 보드 ID 는 셋 다 IC-EV-03. `event-items.js` 줄에 `{ model, variant }` 칸을 더해 아이콘이 변형 그림을 가리킴 |

- 테스트 개수: 배경 58 · 가구 37 · 아이콘 102 · 아이템 스펙 89 (색 변형 13). 배경 편집기 v14 (배경 모델 묶음이 셋으로 — 485/511).

## M8-P2 리소스 — 겨울 눈사람 날 (EV-04) 2026-11-05, 브랜치 `p23-winter-assets`
가을은 사용자 "합치고 겨울 진행" (main 96c013c). 겨울 넷, 모두 status `review`. **이것으로 M8-P2 모델 16개 끝** (FX-01·AN-08·AN-09 는 코드·캐릭터 동작이라 놀이 트랙).

| ID | 이름 | 스펙 | 빌더 | 비고 |
|---|---|---|---|---|
| PR-21 | 눈덩이 | `assets/env/specs/event-snowball.json` (prop) | `build_env.py` `b_snowball` | 지름 0.8 공 + 겉면에 붙은 눈 뭉치 다섯 + 풀잎. 게임이 'ball' 덩어리 크기를 늘림(0.4 → 1.6칸). 처음엔 jitter 로 꼭대기가 오므라져서 jitter 를 뺌. 충돌 r 0.4 |
| PR-22 | 눈사람 | `event-snowman.json` (prop) | `b_snowman` | 'body'·'head' 따로 된 덩어리 (굴린 크기대로 게임이 늘림), 숯 눈·입·단추, 당근 코, 나뭇가지 팔, 목도리. 변형 = 목도리 색 넷. 표정은 지금 웃음 하나 — 비율 표정 넷(😊😮😌🙂)은 M8-P6 에서 입 모양을 바꿔 끼움 |
| FU-46 | 눈사람 등 | `assets/furniture/specs/snowman-lamp.json` (1×1) | `build_furniture.py` `b_snowman_lamp` | 아래 몸이 불빛(glow, 밤에 켜짐), 머리·당근 코·목도리·털모자·방울. 변형 파랑·빨강 모자 |
| IC-EV-04 | 눈 결정 | `assets/items/specs/event-snow-crystal.json` (event) | `build_item.py` `b_snow_crystal` | 여섯 갈래 + 잔가지 둘씩 + 가운데 육각 판, 위에서 보는 렌더 |

- 테스트 개수: 배경 60 · 가구 38 · 아이콘 103 · 아이템 스펙 90. **배경 편집기 v15 = 게시 파일 501/511** — 다음에 요소를 더하려면 렌더 그림(front·top·hero 등)을 묶음으로 바꾸거나 행사 리소스를 따로 편집기로 나눠야 한다.

## M8-P3 봄 꽃놀이 놀이 (EV-01) 2026-11-05, 브랜치 `p24-spring-play`
겨울 리소스는 main d2f654c 에 합침. 놀이 파일 `src/gameplay/events/spring.js` (events/index.js 가 `E.plays.spring` 으로 만들고 행동 키를 단다).

| 무엇 | 어떻게 |
|---|---|
| 놓기 | 행사 기간(4/1–7) 동안 — 벚나무 EN-12 여덟 그루를 광장 둘레 바깥(반지름 + 2.4~4칸) 풀밭 빈 칸에 서로 3.2칸 넘게, 돗자리 PR-17 을 모닥불–무대 사이(무대 쪽 55%, 축제 바닥 무늬 윗면 y 0.09), 행사 간판 PR-23(변형 spring)을 돗자리 동쪽 2칸. 모두 `objects.add(…, { persist: false })` — **저장에 안 들어가고** 들어올 때마다 다시 놓는다, 기간이 끝나면 `time:newday` 에 거둠 |
| 꽃잎 줍기 | 행사 시간(9–17시)에만, 벚나무마다 꽃잎 둘(날짜로 정해지는 자리, 아이템 모델 IC-EV-01 을 1.6배로 땅 위에). 우선순위 52 「꽃잎 줍기」(Space·F 둘 다) → `event.petal` + `progress('EV-01','petals')`, 하루 10장. 주운 자리는 `state.events.spring.picked[dayKey]` |
| 돗자리 도시락 | 96 「도시락 먹기」 1.5칸 안 → 모찌 대사 + `progress('picnic')` (하루 한 번) |
| 벚꽃 등 | 간판 96 — 꽃잎 20 · 나무 2 있으면 「벚꽃 등 만들기」 → 재료 빼고 FU-43 + `progress('lamp')` + **도장** `stamp('EV-01')`, 없으면 「행사 안내」 (모은 수 · 행사 시간) |
| world | `objects.js` `SEASONAL` 에 `cherry-tree` (계절 색) · `SWAY` 에 (흔들림) — 이 두 줄만 |

- 자리 고르기 `springSpots`·`petalSpots` 는 순수 함수 — `tests/events.test.mjs` 가 섬 생성기 + 축제 광장으로 돌림 (나무 8 · 빈 풀밭 · 광장 밖 · 3.2칸 · 돗자리·간판 땅 위 · 꽃잎 날마다 같음/다름).
- 확인 (개발판 `#date=2027-04-02`, 미리 보기 저장): 벚나무 8 · 돗자리 · 간판이 광장에, 21시엔 꽃잎 없음 → 10시 꽃잎 16, F 키로 줍기(가방 +1, 진행), 간판 Space 로 벚꽃 등 만들기(꽃잎 20·나무 2 빠짐, 등 +1, 도장 2027). `#date` 없이(11/5) 열면 아무것도 안 놓이고 진짜 저장 `island.added` 에 행사 물체 0. 콘솔 오류 0. 테스트 369.
- 고친 것 (화면 보고): 돗자리가 축제 바닥 무늬에 묻힘 → y 0.09 / 간판이 진행판 옆 등불 기둥·아치에 끼임 → 돗자리 옆으로.
- **못 한 것**: 주인공 모찌가 행사 동안 돗자리 둘레에 서기·주민 꽃 머리띠(D79-A — town 일과, P7 대사와 같이) · 행사 날 사진 액자(D81-A FU-34) · 장면 s13 (P7) · 꽃잎이 바람에 날리는 효과. 섬 축제 날이 꽃놀이 주간과 겹치면 무대 앞 돗자리가 단체 사진 자리와 겹칠 수 있음 — 축제 날엔 돗자리를 치우는 게 좋을지 P8 QA 에서 확인.

## M8-P4 여름 불꽃놀이 놀이 (EV-02) 2026-11-05, 브랜치 `p25-summer-play`
봄 놀이는 main 2d17bbd 에 합침. 놀이 `src/gameplay/events/summer.js`, 불꽃 FX-01 `src/render/fireworks.js`. events/index.js 의 `update(dt)` 가 놀이마다 `update` 를 부른다.

| 무엇 | 어떻게 |
|---|---|
| 자리 | **북쪽** 해변 (섬 가운데 ±6칸에서 북쪽 끝 모래, 앞 바다 3칸에 발사대 PR-18 · 모래에 간판 PR-23 변형 summer). 보드엔 "남쪽 해변"이라 적었지만 게임 카메라가 남쪽에서 북쪽을 봐서 남쪽 바다 불꽃은 카메라 뒤라 바꿈. 저장 안 함 |
| 손 불꽃 | 간판 96 「손 불꽃 받기」 (행사 시간 20–22시, 하루 하나) → `event.sparkler` + progress. 들고 흔드는 동작 AN-08 은 아직 (캐릭터 전체 재빌드) |
| 불꽃 쇼 | 20시 정각부터 10분(`SHOW_SECONDS`), 도중에 들어오면 지난 만큼 건너뜀. 사양별 발 수 `FIREWORK_QUALITY` (높음 120 · 적정 60 · 낮음 30 · 매우 낮음 12), 점 `THREE.Points` + `materials.curved`, 색 넷, 덧칠. **터질 높이는 발마다 지금 카메라로 계산** (`aimHeight` — 화면 NDC y 0.7~0.84, 곡면 휨 포함): 게임 카메라가 내려다보고 플레이어를 따라가서 고정 높이면 화면 밖(잰 값: 해변에서 하늘 띠는 바다 위 1.5~3칸). 발사대에서 6칸 더 나간 바다에서 쏨 |
| 불꽃 보기 | 쇼 동안 발사대 26칸 안에서 60초 → progress('watch') |
| 소원 | 쇼가 끝난 뒤 간판 「소원 빌기」 → 셋 중 하나(`WISHES`) → progress('wish') + **도장**, 다음 날(`data:loaded`·`time:newday`) `furn.wind-chime` (가방이 차 있으면 다음 날 또) |
| 날씨 | 행사 시간 비 → 흐림 (P1 의 `weather()`), 확인함 |

- 테스트 +2: 쇼 계획(사양별 발 수·10분 안·고르게·같은 날 같음) · 북쪽 해변 자리(모래 간판·바다 발사대).
- 확인 (`#date=2027-08-03`, 미리 보기 저장): 북쪽 해변에 발사대·간판, 20:02 쇼 시작 알림·폭발(적정 한 발 64점), 화면 위쪽 바다 위 하늘에 분홍 불꽃, 실제 Space 로 손 불꽃 받기 → 20:18 「소원 빌기」 → 고르기 셋 → 도장 2027 · 풍경 대기. 콘솔 오류 0. 테스트 371.
- 고친 것: 처음엔 카메라 뒤(남쪽) · 화면 위로 넘침(높이 9~14) · 겹친 점이 하얗게 → 북쪽 · 카메라로 높이 맞춤 · 점 작게·덜 밝게.
- **못 한 것**: AN-08 흔들기 · 손 불꽃 켜기(들고 쓰기) · 불꽃 소리(지금은 'splash' — 소리 편집기에 firework 효과음 제안) · 물에 비침(높음 사양 `reflect`, 아직 안 씀) · 코코가 해변에 서기(P7) · 행사 소품 부채. 미리 보기 창이 숨겨진 채라 실제 초당 장수로는 못 봄 — `ctx.step` 으로 돌려서 확인.

## M8-P5 가을 수확 잔치 놀이 (EV-03) 2026-11-05, 브랜치 `p26-autumn-play`
여름 놀이는 main 168f81d 에 합침. 놀이 `src/gameplay/events/autumn.js`.

| 무엇 | 어떻게 |
|---|---|
| 놓기 | 행사 기간(10/15–21) 동안 큰 솥 PR-19 를 봄 돗자리 자리(모닥불–무대 사이)에, 허수아비 PR-20 을 그 동쪽 2.6칸. 저장 안 함 |
| 버섯 | 날마다 활엽수 중 다섯 그루 밑(둘레 0.8칸, 걸을 수 있는 곳)에 버섯 — 무게 표고 5 · 꾀꼬리 3 · 빨간 2 (`MUSHROOM_KINDS`), 모델 하나(IC-EV-03)에 갓 색만 바꿔 칠함. 52 「버섯 줍기」 → 그 버섯 아이템 + progress('mushroom') |
| 큰 솥 | 96 「큰 솥에 넣기」 → 가방의 과일·버섯을 30이 찰 때까지만 넣음 (남는 건 그대로), `state.events.autumn.pot[해]`. 주민도 날마다 처음 놓일 때 둘씩 (`VILLAGER_DAILY`) |
| 잔치 | 18시(`feastAt`) 넘고 솥이 30 이면 「잔치 하기」 → 퐁 대사 + progress('feast') + 수확 바구니 FU-45 + **도장** |
| 허수아비 | 96 「허수아비」 → 솥·오늘 버섯 진행 한 줄 |

- 테스트 +1: 버섯 자리(다섯 · 나무마다 하나 · 걸을 수 있는 곳 · 같은 날 같음 · 일주일이면 셋 다).
- 확인 (`#date=2027-10-16`): 솥·허수아비·버섯 다섯(셋 다), F 로 꾀꼬리버섯 줍기, Space 로 과일 넣기(30 에서 멈추고 남은 과일 3 그대로), 18:12 「잔치 하기」 → 바구니 · 도장 2027. 화면에서 무대 앞 김 나는 솥·허수아비 확인. 콘솔 오류 0. 테스트 372.
- **못 한 것**: 퐁이 솥 옆에 서기·주민 스카프(D79-A, P7) · 솥에 넣은 만큼 김이 커지기(지금은 모델 그대로) · 잔치에 주민이 모이는 장면 s15 (P7) · 섬 축제 날은 calendar 가 17시에 끊어 그날은 잔치 못 함(다음 날).

## M8-P6 겨울 눈사람 날 놀이 (EV-04) 2026-11-05, 브랜치 `p27-winter-play`
가을 놀이는 main 691e693 에 합침. 놀이 `src/gameplay/events/winter.js`. **이것으로 행사 넷 놀이(P3–P6) 끝.**

| 무엇 | 어떻게 |
|---|---|
| 눈덩이 | 행사 시간(9–17시) 날마다 광장 남쪽(반지름 + 3칸, 남 ±60°) 눈 덮인 풀밭에 작은 눈덩이 둘 (`ballSpots`). 움직이고 커져야 해서 world 물체가 아니라 이 모듈의 메시 (PR-21 모델). 저장 안 함 — 들어올 때마다 그날 것 둘 |
| 밀기 | 97 「눈덩이 밀기」(눈덩이 바로 앞) → 플레이어 앞에 붙고, 풀밭 위를 걸은 한 칸마다 scale +0.09 (`grown`, 0.5 → 2.0 = 지름 0.4 → 1.6칸) → 「놓기」. 우선순위 97 = 문·우편함(90)보다 먼저 (처음 53 으로 했다가 집 앞 눈덩이에서 우편함이 이겨서 올림) |
| 눈사람 | 작은 눈덩이를 밀고 더 큰 눈덩이 옆에서 「머리 얹기」 → 눈사람 PR-22 (world 물체 persist:false, 크기 = 몸 기준) · 표정 `faceOf` (머리/몸 0.5~0.75 😊 · 0.9 넘게 😮 · 0.5 아래 😌 · 그 밖 🙂, 지금은 알림 이모지로만 — 모델이 묶음이라 머리만 키우거나 입을 못 바꿈) · 목도리 색은 만든 차례로. `state.events.winter.snowmen[해]` 에 남아 그 해 행사 끝까지 다시 놓임 |
| 보상 | 하루 하나: progress('snowman') + 눈 결정 IC-EV-04 셋 + progress('three') → 셋째에 눈사람 등 FU-46 + **도장** |

- 테스트 +1: 표정 넷 · 커지기(멈춤·음수 무시) · 눈덩이 자리(둘 · 풀밭 · 광장 남쪽 · 떨어짐 · 같은 날 같음).
- 확인 (`#date=2027-12-21`): 겨울 섬에 눈덩이 둘, 실제 W·A·S·D·Space 로 밀기(0.5 → 1.31) · 놓기 · 둘째 밀기(0.73) · 머리 얹기 → 😊 눈사람(scale 1.375, 빨강 목도리) + 눈 결정 3 · 진행 1/3, 화면에서 눈사람 확인. 콘솔 오류 0. 테스트 373.
- 고친 것: 플레이어 방향 값이 NaN 이면 앞 자리 계산이 깨짐 → 북쪽으로 (개발 중 `face()` 를 잘못 불러서 생긴 것이지만 막아 둠).
- **못 한 것**: AN-09 밀기 동작(지금은 걷기 동작 그대로) · 눈덩이 굴러가는 회전 · 물·길·절벽에서 멈추기(지금은 길·모래 위에선 안 커지기만) · 표정 모델 넷 · 두부 자리·목도리 소품·장면 s16 (P7) · 눈덩이끼리·플레이어와 충돌 없음.

## 남은 것 · 못 한 것
- 도장(UI-15)은 보드에선 도감 탭이지만 도감 창을 건드리지 않게 달력 창 아래 칸에 넣었다. 도감 탭으로 옮기려면 `src/ui/phone.js` 도감 화면에 칸 하나.
- 휴대폰 세로에서 칸은 시계 밑 왼쪽 — 섬 축제 진행판도 600px 아래에선 그 자리라, 축제 날이 행사 주간과 겹치면 겹칠 수 있다 (축제 날 저녁만). 놀이 트랙에서 확인.
- 편집기 홈 「미리 해 보기」 링크(D85-A)는 게임을 다시 게시한 뒤 (M8-P8).
- 게시본에서는 아직 안 봤다 (게임 다시 게시 전).
