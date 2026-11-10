요소 편집기: https://claude.ai/artifact/DcidJEY1VRNNJdCxwge3Sj · 파일 `elem-editor.html` + `elem-editor/` (예전 게임 숫자 표 링크를 그대로 키움)

# P36 ③ 요소 편집기 (브랜치 `p36-elem-editor`) — 작업 노트

사용자 요청 "리소스 변경 고려해서 분리, 스토리 분리, 요소 분리 편집기" 의 셋째. 편집기 아홉을 셋(① 리소스 `p36-res-editor` · ② 스토리 `p36-story-editor` · ③ 요소)으로 나누며, **모델도 글도 아닌 게임 요소의 값과 배치 전부**를 이 편집기 하나로 모았다. 예전 「게임 숫자 표」(ET-09) · 「섬 지도 편집기」(ET-08) · 배경 편집기 「방 배치」 탭(ET-04, 리소스 편집기 세션이 뺌)이 여기로 들어왔다.

## 같은 링크로 키운 까닭

숫자 표 아티팩트(DcidJEY1…)의 저장소에 `history/data-v0`(처음 표 사본)가 있어 그 기록을 잇는다. 섬 지도 편집기(RYd99RBU…)의 `history/map-v0` 은 이 저장소에 `history/map-v0` 으로 **옮겨 적었다** (내용 그대로) — 요소 편집기의 「반영 기록」에 숫자 표 v0 · 섬 지도 v0 · 요소 v0 이 함께 보이고 어느 것이든 "이때 값으로 되돌리기" 가 된다. 섬 지도 편집기 링크는 지우지 않고 홈에서 「지난 편집기」로 남겼다.

## 탭 (위 줄 = 묶음 9, 아래 줄 = 그 묶음의 표)

| 묶음 | 표 (주소 `#id`) | 파일 · 칸 |
|---|---|---|
| 🏪 상점 | `shop` | `rules.json` shop(여는·닫는 시각, 하루 가구·야외 가구·꽃씨 수), starter.acorns. 진열 받침·계산대 자리는 「방 배치」 → 도토리상점. **옷 칸은 게임에 아직 없다** (옷 아이템이 생기면 shop 에 칸을 더하고 여기에 줄 하나) |
| 🐟 아이템 값 | `fish` `bugs` `fossils` `fruits` `flowers` `mats` `furniture` `recipes` | `items.json` 줄 표 (사는 값·파는 값·출현·몫·내구도…), `rules.json` recipes — 예전 숫자 표 그대로 |
| 🎲 채집·하루·주민 | `rules` `birthdays` `town` | `rules.json` gather·day·stack·town (town 은 이제 게임이 읽는다 — 예전 "연결 대기" 띠·검사 줄은 뺐다) |
| 🌸 행사 | `events` | `events.json` dates.days, 행사마다 시작 달·날·여는 시간(`hours`)·불꽃 쇼 시각·할 것 목표(`todo/<id>/goal`)·주인공 |
| 🌙 밤·새벽 | `night` | `night.json` 야시장 요일·시간·쉬는 행사·고리 던지기 값/횟수/확률·노점 값, 달빛 가게 시간·곤충 덤, 천막 시간, 야행성 집 시간·덤, 타로 뽑는 수·카드 효과 크기 |
| ⛵ 투어 | `tour` | `tour.json` 표 값·하루 횟수·첫 투어 공짜, **나오는 섬 모양 `shapes`(새 칸)**, 배 시간, 광석 바위 횟수·확률, 손님 주민 |
| 📦 이사 | `moving` | **`rules.json` moving (새 칸)** — 섬 최대 주민 수·오는 간격·떠나기 확률·편지 |
| 🗺 섬 지도 | `map` | `layout.json` — 예전 섬 지도 편집기를 `elem-editor/map-tab.js` 로 옮김 (끌기·시드·밀도·검사 그대로) |
| 🛋 방 배치 | `rooms` (`#rooms.rm-01` · `#rooms.shop` …) | `interior/rooms/rm-01…07.json` · `interior/places/shop·museum·moonshop·tent.json` 의 furniture·host/keeper·name·wallpaper·floor. 위에서 본 칸 그림(끌기·R 돌리기·Delete·화살표·가구 더하기·색 변형), 검사는 게임 코드 그대로 (`interior.js checkRoom` · `placedata.js checkPlace`). 3D 보기는 없다 (리소스 편집기 몫) |

칸마다 **"바꾸면 게임에서 무엇이 달라지는지" 한 줄**(값 표는 칸 밑, 줄 표는 표 위 「칸 뜻」, 지도 자리는 고른 자리 칸), 범위(최소·최대·종류: 정수·확률·시각 5~29·요일·여러 개 고르기)와 잘못된 값 빨간 테두리. 「확인」 칸 = `tools/elem-checks.mjs`(값 검사, 테스트와 같은 함수) + 섬 지도 검사 + 방 배치 검사, 걸린 줄을 누르면 그 탭으로 간다.

## 저장소 모양 (예전 drafts/data · drafts/map 과 같은 모양, 문서 이름만 elem)

| 문서 | 누가 | 모양 |
|---|---|---|
| `drafts/elem` | 편집기 | `{ changes: { 경로: 값 }, note, status: 'editing'|'requested', basedOn: { items, rules, layout, events, night, tour }, updatedAt, updatedBy }` |
| `applied/elem` | Claude (admin) | `{ board: 'elem', version, appliedAt, summary, commit, changed: [경로], snapshot: { <파일 키>: 반영 뒤 파일 } }` — snapshot 은 **이번에 바뀐 파일만** (v0 은 전부) |
| `history/elem-v<n>` | Claude (admin) | applied 와 같은 모양 (`board` = ApplyLog 가 찾는 칸) |
| `history/data-v0` · `history/map-v0` | (예전) | 숫자 표 `snapshot.items·rules`, 섬 지도 `layout` — 편집기가 둘 다 읽어 되돌리기에 쓴다 |

경로의 첫 칸 = 파일 키 (`tools/apply-edits.mjs` `ELEM_FILES`): `items` · `rules` · `layout` · `events` · `night` · `tour` · `rooms/<slug>` · `places/<slug>`. 예: `tour/ticket/price` · `night/market/stalls/festival-booth-food/prices/night.cocoa` (줄 이름표는 slug → kind → result → **id** 순 — `tools/edits.mjs` ROW_KEYS 에 id 를 더했다) · `rooms/rm-01/furniture`(배열 통째로) · `layout/villagers/coco`. 편집기는 처음 열 때 `drafts/elem` 이 없고 예전 `drafts/data` 에 바뀐 칸이 있으면 옮겨 온다. capabilities 는 예전 그대로 `{ db: { rules: [applied·history 쓰기 admin] }, user: {} }`.

## "요소 반영" (Claude 가 하는 일) — 예전 "지도 반영"·"숫자 반영" 과 배경 편집기 방 배치 요청을 합친 명령

1. `db_get` `drafts/elem` · `applied/elem` (링크는 이 파일 첫 줄). `changes` 가 비었으면 "바뀐 게 없다" 하고 끝. `note` 를 읽는다.
2. 받은 문서를 파일로 두고 `node tools/apply-edits.mjs elem <초안.json> --dry` → 바뀌는 칸 확인 → `--dry` 없이 (바뀐 파일만 `version` +1, **파일이 쓰던 줄 모양 그대로** 써서 diff 가 바뀐 줄만 — `formatLike`). 방을 고쳤으면 `interior/index.json` 그 방 줄(name·wallpaper·floor·version)도 저절로 맞춘다. 표에 없는 칸이 하나라도 있으면 아무것도 쓰지 않는다.
3. `node --test tests/`. 실패는 둘로 나눈다:
   - **사용자가 일부러 바꾼 값을 박아 둔 테스트** → 기대값만 새 값으로 (커밋에 적는다). 지금 박혀 있는 것: `items.test.mjs` 컨셉 보드 값, `recipes-economy.test.mjs` 상어 값 등, **`tour.test.mjs` 표 값 1000** (2026-11-11 시험 반영에서 걸림), 행사·밤 테스트의 날짜·시각.
   - **규칙 검사** (`elem.test.mjs` 값 검사 · `mapdata.test.mjs` · `interior.test.mjs` 방 검사 · `places.test.mjs` 가게 검사 · 그 밖 게임 규칙) → **반영하지 않는다**: `git checkout -- <바뀐 파일>` 후 어느 칸이 왜 걸렸는지 (편집기 「확인」 과 같은 말) 알린다.
4. 게임을 열어 본다: dev-server `/index.html` (콘솔 오류 0) — 값은 `__island.services.<tour|night|events>.config` 등, 방은 `__island.services.house.visit('<주민>')` 뒤 `scene` 의 `furniture:<slug>` 자리, 지도는 `?debug` 의 `world.debug.gen.layout`. 행사·밤은 `?date=` 흉내. 지도를 바꿨으면 저장과의 관계 (1)/(2) 를 보고에 적는다 (`m6-p5-mapdata.md` 「저장과의 관계」).
5. 커밋 (`요소 반영 v<n>: …`) → 편집기 다시 게시 (바뀐 JSON 만, 아래 「게시」) → 게임 링크도 다시 게시 (웹 배포 절 — 값 파일은 게임 묶음에 들어간다).
6. `applied/elem` = `{ board: 'elem', version: <지난 +1>, appliedAt, summary, commit, changed: Object.keys(changes), snapshot: { 바뀐 파일 키: 새 파일 } }`, 같은 내용으로 `history/elem-v<n>`. `drafts/elem` 은 `changes: {}`, `status: 'editing'`. 홈 `status/elem` · `catalog/data`·`catalog/map`·`catalog/room` (`node tools/hub-catalog.mjs`).
- **되돌리기**: 편집기 반영 기록의 "이때 값으로 되돌리기" 가 그 기록의 파일 사본과 지금 파일의 차이를 `drafts/elem` 에 넣고 요청 표시를 한다 → 위 순서 그대로. (커밋째 되돌리고 싶다면 `history/elem-v<n>.commit` 이후 요소 반영 커밋을 `git revert`.)
- 예전 명령 "지도 반영"·"숫자 반영" 이 오면 같은 흐름 (`apply-edits.mjs map|data` 도 그대로 돈다). 예전 섬 지도 편집기 저장소 `drafts/map` 에 남은 것이 있으면 `layout/` 을 붙여 같이 반영.

**로컬 흉내**: dev-server 의 `/api/db/elem-drafts` · `elem-applied` · `elem-history` (`assets/review/elem-*.json`, gitignore). 2026-11-11 에 이 흐름을 끝까지 해 봤다 (아래 「확인한 것」).

## 게시

- 파일 목록 `elem-editor/files.json` (모듈 13 · 에셋 24 + 페이지 = 38개). `index.html` = `elem-editor.html` 을 `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` … `<body>` + 파일 + `</body></html>` 로 감싼 사본 (devlog 2026-11-10 메모 — 예전 게시본과 같은 모양). 모듈을 더하면 `tests/elem.test.mjs` 가 목록에 없는 import 를 잡는다.
- `publish_files` (slug DcidJEY1VRNNJdCxwge3Sj): 예전 숫자 표 게시본(`index.html` · `tools/edits.mjs` · `assets/data/*.json`) 위에 patch. 다시 게시 때는 `list_files` 로 지금 게시본이 저장소 파일과 같은지 보고 바뀐 것만.

## 게시·저장소 기록 (2026-11-11)

- 게시: slug `662a5943-a2e5-4103-b682-cdbb023c7a54` (= DcidJEY1…) **버전 `1794325461-70c7`**, 파일 38개 (예전 4개 위에 patch), 제목 「포근섬 요소 편집기」, capabilities 그대로. 게시본은 이 브랜치 파일이라 `rules.json moving`·`tour.json shapes` 가 들어 있다 → **main 에 합치기 전에 "요소 반영" 이 오면** 이 두 칸은 main 에 없으니 합친 뒤 반영한다.
- 저장소에 쓴 것: `applied/elem` · `history/elem-v0` (`{ board:'elem', version:0, commit:'f1c7279', changed:[], snapshot:{} }` — v0 은 파일 사본 없이 시작 표시만, 되돌리기는 숫자 표 v0 · 섬 지도 v0 사본으로), `history/map-v0` (예전 섬 지도 저장소의 문서 그대로 옮김). `drafts/data`·`drafts/map` 은 비어 있었다.
- 첫 "요소 반영" 때는 `applied/elem` version 1 · 그 반영에서 바뀐 파일 사본.

## 게임 코드에서 바꾼 것 (값을 데이터로 꺼냄 — 값은 그대로)

| 파일 | 바꾼 것 |
|---|---|
| `assets/data/rules.json` | `moving` 칸 새로 (값 = 예전 `moving.js` MOVING 그대로) |
| `src/gameplay/town/moving.js` | `MOVING` = 기본값 위에 `RULES.moving` (tables.js) — 빠진 칸만 기본값, 얼린 객체 |
| `assets/tour/tour.json` | `shapes: ["TO-01", "TO-02", "TO-03", "TO-04"]` 새로 |
| `src/gameplay/tour/islet.js` · `tour/index.js` | `isletOf(dayKey, trip, seed, shapes = SHAPE_IDS)` — 넷 모두면 예전과 같은 섬 (`elem.test.mjs` 가 본다) |
| `tools/edits.mjs` | `ROW_KEYS` 끝에 `id` (밤 노점·타로 카드·행사 할 것 줄을 이름으로) |
| `tools/apply-edits.mjs` | `elem` 종류 · `ELEM_FILES` · `elemTarget` · 방 목록 줄 맞춤 · `formatLike`(원래 줄 모양대로 쓰기) |
| `tools/elem-checks.mjs` (새) | 값 검사 + `itemList` · `hourKo` · `TOUR_SHAPES` |
| `tests/elem.test.mjs` (새, 7개) · `tests/hub.test.mjs` | 칸 경로 = 실제 파일 칸, 값 검사, 투어 모양, 이사 숫자, 반영 도구, 원래 모양 쓰기, 게시 목록 / 홈: 명령 '요소 반영', `#표 id`·`#rooms.<slug>` |
| `editors.html` · `tools/hub-catalog.mjs` · `concept/README.md` | 아래 「홈」 |
| `data-editor.html` → `elem-editor.html` (git mv) + `elem-editor/` | 편집기 |

## 홈 (`editors.html`) — 다른 두 세션과 합칠 때

- `editors-list`: `elem` 줄 더함 (url = 예전 숫자 표 링크, 명령 "요소 반영", reads `drafts/elem`·`applied/elem`). **`data` 줄은 뺐다** (같은 링크가 이제 요소 편집기라 두 줄이 같은 링크를 가리키게 되므로). **`map` 줄은 group `archive`** (명령 없음 — "전체 요청 확인" 이 건너뜀) + README 보드 표에 `map-editor.html` 줄. 「지난 보드」 글은 보드가 아니면 「지난 편집기」.
- 바로 가기: 「섬 지도 ↗」「숫자 표 ↗」 → 「요소 ↗」「지난 섬 지도 ↗」. 명령 표: "지도 반영"·"숫자 반영" 두 줄 → "요소 반영" 한 줄.
- `tools/hub-catalog.mjs`: 분류 `map`·`data`·`room` 의 편집기 = `elem` (`data` 이름 「요소 값」, 표 목록은 `elem-editor/sheets.js`, 행사·밤·투어 표는 그 파일 version). 방 링크 `#rooms.<slug>`, 가게 `#rooms.shop` 등, 지도 `#map`. **붙박이(FU-35–42) 링크는 손대지 않았다** (`#place-shop` → 배경 편집기) — 리소스 편집기 세션이 정한다.
- 충돌 나면 줄 단위로 둘 다 살린다. 리소스 편집기가 배경 편집기 줄의 `edits` 에서 "방 배치" 를 빼는 것과 겹칠 수 있다.

## 조정 세션이 CLAUDE.md 에서 고칠 문장

1. 「편집기와 "요청 확인" 흐름」 배경 편집기 영역 줄의 **방 배치** 부분 → "방 배치(주민 방·상점·박물관·달빛 가게·천막)는 요소 편집기 「방 배치」 탭 → "요소 반영"" (리소스 편집기 세션 문장과 같이).
2. **「지도·숫자와 "지도 반영"·"숫자 반영" 흐름」 절 전체** → 제목 「요소와 "요소 반영" 흐름」, 내용:
   - 요소 = 모델도 글도 아닌 값과 배치: `assets/data/items.json`·`rules.json`(상점·채집·하루·레시피·생일·주민·**이사 moving**) · `assets/island/layout.json` · `assets/events/events.json` · `assets/night/night.json` · `assets/tour/tour.json`(**shapes**) · `assets/interior/rooms/*.json`·`places/*.json` (가구 배치). `src/data/tables.js` 가 표 둘을 읽고, 나머지는 각 모듈이 `loadJSON`.
   - 편집기: 요소 편집기 `elem-editor.html` + `elem-editor/` (https://claude.ai/artifact/DcidJEY1VRNNJdCxwge3Sj, capabilities `db`·`user`, `applied`·`history` 쓰기 admin, 게시 목록 `elem-editor/files.json`). 고친 칸은 `drafts/elem` 의 `changes` (첫 칸 = 파일 키, 규칙 `tools/edits.mjs`, 값 검사 `tools/elem-checks.mjs`).
   - 채팅 "요소 반영" (예전 "지도 반영"·"숫자 반영" 도): `node tools/apply-edits.mjs elem <초안.json> --dry` → 적용 → 테스트 → 게임 → 커밋 → 편집기·게임 다시 게시 → `applied/elem`·`history/elem-v<n>` → `drafts/elem` 비우기. 자세한 순서는 `docs/notes/p36-elem-editor.md` 「요소 반영」.
3. 「"전체 요청 확인"」 처리 순서의 "새 편집기" 자리에 요소 편집기가 들어간다는 것은 그대로 (명령만 "요소 반영").
4. 「명령어」 절에 `node tools/apply-edits.mjs elem <초안.json> [--dry]` 한 줄.
5. `docs/notes/m6-p5-mapdata.md` 첫 줄의 두 링크 옆에 "(P36 부터 요소 편집기 — `docs/notes/p36-elem-editor.md`)".

## 확인한 것 (2026-11-11)

- dev-server — **포트 4248** (맡은 4238 은 다른 체크아웃의 dev-server 가 이미 쓰고 있어서 끄지 않고 비켜 갔다; 미리보기 서버 칸이 다른 대화 것으로 다 차 있어 Bash 로 띄움). 표 18개 모두 그려짐·콘솔 오류 0 (dev-server 의 `/favicon.ico` 404 뿐 — 게시본엔 없음). **1009px·375px 모두 가로 넘침 0** (넓은 물고기·곤충 표는 표 안에서만 가로 스크롤).
- 섬 지도 탭: 섬 만들기 57ms, 자리 27개, 검사 9개 통과. 방 배치: 방 7 + 가게 4 모두 게임 검사 통과, 계산대를 진열 받침 위로 옮기면 `checkPlace` 가 잡고 빨갛게 → 「모두 되돌리기」.
- **반영 흐름 끝까지 (로컬 흉내)**: 편집기에서 투어 표 값 1000→800, 코코 방(RM-01) 공 바구니 (6,4)→(5,4) → `assets/review/elem-drafts.json` 에 저장·「반영 요청 표시」 → `apply-edits.mjs elem --dry` → 적용 (tour.json·rm-01.json version 2, index.json 줄 맞춤, diff = 바뀐 줄만) → `node --test tests/` 에서 일부러 바꾼 값을 박은 `tour.test.mjs`(표 값 1000) 만 걸림 → **게임**: `__island.services.tour.config.ticket.price === 800`, 코코 방에 들어가 `furniture:ball-basket` 자리 x 5.5 (전 6.5) → 로컬 `applied`·`history` 를 써서 편집기가 「요소 v1 · 바뀐 칸 없음」 으로 보이는 것, 파일을 되돌린 뒤 「이때 값으로 되돌리기」 가 같은 두 칸을 다시 내놓는 것까지. **시험 값은 커밋하지 않았다** (파일·로컬 저장소 되돌림).
- `node --test tests/` **430 / 430** (main 424 + elem 6 … 지금 7).

## 못 한 것 · 다음

- claude.ai 게시본에서 직접 끌기·저장 (`window.claude` db) 은 사용자가 열어 볼 때 (보는 사람 권한으로 `applied` 읽기는 확인).
- 방 배치의 3D 보기·새 방 더하기(`kind:'add'`)는 없다 — 새 방 파일은 리소스 편집기 요청으로.
- 진열 자리 `stock`·박물관 `cases`·말 거는 자리 `talk` 는 보기만 (예전과 같음) — 의견 칸으로.
- 타로 카드 효과 글(`effect`·`text`)은 값만 바뀌고 글은 그대로 → "요소 반영" 때 Claude 가 맞춘다.
