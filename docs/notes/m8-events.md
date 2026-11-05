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

## 남은 것 · 못 한 것
- 도장(UI-15)은 보드에선 도감 탭이지만 도감 창을 건드리지 않게 달력 창 아래 칸에 넣었다. 도감 탭으로 옮기려면 `src/ui/phone.js` 도감 화면에 칸 하나.
- 휴대폰 세로에서 칸은 시계 밑 왼쪽 — 섬 축제 진행판도 600px 아래에선 그 자리라, 축제 날이 행사 주간과 겹치면 겹칠 수 있다 (축제 날 저녁만). 놀이 트랙에서 확인.
- 편집기 홈 「미리 해 보기」 링크(D85-A)는 게임을 다시 게시한 뒤 (M8-P8).
- 게시본에서는 아직 안 봤다 (게임 다시 게시 전).
