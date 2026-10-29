# M6-P2 배경 편집기 탭 (6차, 브랜치 `p9-bgtabs`)

검수 보드 wave6 반영 v1: **D28-A 배경 편집기에 "아이템" 탭 (ET-02)** · **D29-A "실내" 탭 + 방 배치 격자 (ET-03 · ET-04)**. 고친 곳은 `bg-editor.html`, `tools/build-editor-index.mjs`, `.gitignore`(묶음 줄), `CLAUDE.md` 편집기 절(배경 편집기 줄), 이 노트. 게임 코드(`src/`)·스펙·방 파일·테스트는 고치지 않았다.

## 한 것

| 무엇 | 내용 |
|---|---|
| 영역 탭 | 위 줄 **배경 35 · 가구 33 · 아이템 82 · 실내 무늬 16 · 방 배치 7**, 아래 줄은 그 영역의 분류 (배경: 자연·소품·건물·타일, 아이템: 물고기·곤충·화석·도구·재료·씨앗·과일·조개·꽃, 실내: 벽지·바닥). 영역을 바꾸면 그 영역 첫 요소를 고른다. 주소 `#<key>` 는 그대로 (아이템 `#item-<slug>`, 무늬 `#wp-01`, 방 `#rm-01`) |
| 아이템 탭 (ET-02) | 82 모델 3D 보기(들어 보이는 모델은 바닥 위로 올려서, 물고기는 물·조개는 모래 바닥), 팔레트 색 바로 바꿔 보기, 전체 크기(scale) 바로 키워 보기, 나머지 params 는 슬라이더·고르기(꼬리 모양 등 한국어 이름)·켜고 끄기·목록 값(JSON 글)으로 "다시 만들 때 반영", 꽃·씨앗 봉투 색 변형 버튼, 아이콘 시트(아이템마다 code·id), 요청·레퍼런스 |
| 실내 무늬 탭 (ET-03) | 벽지 WP-01–08 · 바닥 FL-01–08. **방에 붙여 보기**(게임 방 껍데기를 옮긴 8×8 방, 벽지는 FL-01 방에·바닥은 WP-01 방에) / **무늬 크게**(실제 크기 반복 + 1m 눈금). 팔레트 색(징두리·몰딩·걸레받이·앞 턱 포함)과 **간격**(pattern.size 가로·세로 m) 바로 보기. 격자 썸네일은 상점 견본과 같은 그림 |
| 방 배치 격자 (ET-04) | 주민 방 RM-01–06 + **RM-07 단풍(새로)**. 8×8 칸에 가구를 끌어 옮기기(바닥 가구는 칸에 맞춰, 벽 가구는 가까운 벽 자리), 돌리기(↻ · R), 빼기(Delete), 색 변형 고르기, "가구 더하기"(빈 칸·빈 벽 자리를 찾아 놓음), 주민 자리(동그라미) 끌기·바라보는 쪽, 방 이름·벽지·바닥 고르기. 문 매트·창문·벽 띠는 방 스펙 색. 배치 검사(겹침·문 매트·창문 자리·주민 자리)를 바로 보여 주고 문제 있는 가구는 빨갛게. **3D로 보기**: 같은 방 껍데기 + 가구 모델(변형 색) + 주민 자리 기둥 |

## 편집기 묶음 파일 (`node tools/build-editor-index.mjs`, gitignore)

| 파일 | 내용 | 크기 (2026-10-29) |
|---|---|---|
| `assets/env/editor-index.json` · `assets/furniture/editor-index.json` | 예전 그대로 (요소마다 spec·stats) | 52KB · 60KB |
| `assets/items/editor-index.json` | 아이템 목록 + 요소마다 `spec`·`stats`·`bundle`(모델이 든 묶음 번호), `items[].thumb` = 아이콘 PNG data: 주소 (93장) | 2.3MB |
| `assets/items/editor-models-<n>.json` | `{ slug: glb base64 }`, 목록 순서대로 1.6MB 안에서 나눔 → 지금 3개 | 1.53 · 1.49 · 1.13MB |
| `assets/interior/editor-index.json` | 무늬 목록 + `models[].spec`(벽지·바닥·방 틀) + `frame` + `rooms[].room`(방 JSON 전체) | 14KB |

- 편집기는 아이템 목록을 기다리지 않고 먼저 열린다 (아이콘 때문에 커서). 아이템 모델 묶음은 그 묶음의 아이템을 처음 고를 때 한 번만 받는다.
- 묶음이 없으면(로컬에서 빌드 전) 예전 파일(`index.json` + `specs/`·`models/`, 실내는 스펙·방 파일 하나씩)을 읽는다. 아이템 큰 렌더(`_main.png`)는 파일 수 때문에 편집기에 올리지 않는다 — 아이콘만.
- **게시 파일 수**: 지금 403 + 새 묶음 5 (`items/editor-index.json`, `items/editor-models-1…3.json`, `interior/editor-index.json`) = **408** (한도 511). 아이템이 더 늘어도 묶음이 1.6MB 마다 하나씩만 는다.

## 편집기 안에 옮겨 온 게임 코드 (그 파일이 바뀌면 같이 고친다)

편집기 게시본에는 `src/` 가 없어서 import 하지 않고 옮겨 왔다. 같은 스펙이면 게임과 같은 그림·같은 검사 결과가 나온다.
- `src/gameplay/house/pattern.js` 의 `paint`·`patternCanvas`·`patternTexture`·`swatchURL`, `interior.js` 의 `resolveFill` — 무늬 그리기
- `src/gameplay/house/room.js` 의 `buildRoom` 중 껍데기(벽·징두리·몰딩·걸레받이·창문·문 매트·벽지/바닥 판, UV = m) — 크기 상수 `WALL_H 2.6 · WAINSCOT_H 0.85 · WINDOWS n:1·n:6 · DOOR 3–4`
- `grid.js` 의 `dims`·`cellsOf`·`boxOf`, `interior.js` 의 `resolveFurniture`·`checkRoom` 규칙 (편집기는 겹친 두 가구를 모두 빨갛게 표시만 다르게), `room.js` 의 `wallMount`, `visit.js` 의 가구 자리(`poseRoot`)

제안 (house 트랙·조정 세션): `pattern.js` 의 그리기 부분을 import 없는 파일(예: `src/gameplay/house/pattern-paint.js`)로 나누면 편집기가 그 파일 하나만 같이 게시해 import 할 수 있다 — 지금은 `pattern.js` 가 `interior.js`(→ `data/rng.js`·`grid.js`)를 불러서 편집기에 그대로 올리기 어렵다.

## 요청 모양 (`env-requests`, "배경 요청 확인" 때 읽는다)

공통: `{ slug, category, group?, kind: 'edit' | 'add', base, status: 'new', createdAt, by, text, fields, refs }` — `slug` 는 편집기 key, `text` 는 사람이 읽는 요청 글, `fields` 는 폼 값 그대로.

| 영역 | slug | category · group | 반영할 곳 |
|---|---|---|---|
| 아이템 | `item-<slug>` (예 `item-fish-crucian`) | `'item'` · `group` = 분류(fish …) | `assets/items/specs/<slug>.json`: `fields.palette` → palette, `fields.params` → params 의 value, prompt 칸. 그다음 `node tools/build-item.mjs <slug>` → `node --test tests/` (`items-assets.test.mjs`) |
| 새 아이템 | `_new` | `'item'` · `group` | 새 스펙 + 빌더 `kind` (z1-items 노트), `src/data/items.js` 는 data 트랙과 함께 |
| 벽지·바닥 | `wp-0N` · `fl-0N` | `'wallpaper'` · `'floor'` | `assets/interior/specs/<slug>.json`: palette, `fields.params.sizeX/sizeY` → `pattern.size` (m). `version` +1, status `review` → `interior/index.json` 의 version·status 도 같게 (테스트). Blender 없음 |
| 새 무늬 | `_new` | `'wallpaper'` · `'floor'` | 새 스펙 + `interior/index.json` + `interior.js` `WEB_FILES` |
| 방 배치 | `rm-0N` | `'room'` | 아래 |

**방 배치 요청**은 `layout` 과 `problems` 를 더 남긴다:
```js
layout: {                       // rooms/<slug>.json 에 그대로 넣는 칸
  name, note?, wallpaper, floor, host: { lx, lz, face },
  furniture: [ { item, variant?, gx, gz, rot } | { item, wall, slot } | { fu, name, box, color, gx, gz, rot } … ],
  // 새 방(kind 'add', RM-07) 이면 id·slug·kind:'room'·owner·ownerName 도
},
problems: ['라디오: (0, 1) 소파와 겹쳐요', …]   // 편집기 배치 검사 결과 — 비어 있어야 게임 테스트를 통과한다
```
반영 순서: `layout` 칸을 `assets/interior/rooms/<slug>.json` 에 덮어쓰고 `version` +1 · status `review` → `interior/index.json` rooms 줄(name·wallpaper·floor·version·status) 맞추기 → `problems` 가 있으면 가장 가까운 빈 칸으로 고치고 답글에 적기 → 벽지·바닥을 바꿨으면 `tests/interior.test.mjs` 의 '보드대로 벽지·바닥' 표도 같이 → `node --test tests/`.
**RM-07 (단풍) 새 방**: `rooms/rm-07.json` 새로 + `interior/index.json` rooms + `src/gameplay/house/interior.js` `WEB_FILES` + `tests/interior.test.mjs`(방 수 6 → 7, 주인 표에 danpung) — house·town 트랙 파일이라 조정 세션과 같이. 그 전까지 게임은 단풍 방을 기본 방(WP-01·FL-01, 가구 없음)으로 연다 (z2-interior 노트).
반영한 뒤 `node tools/build-editor-index.mjs` → 바뀐 묶음만 publish → 요청을 `done` + `reply` + `doneVersion`.

## 다른 트랙에

1. **P1 편집기 홈 (`p9-hub`)**: 배경 편집기 요청 수를 셀 때 `env-requests` 한 컬렉션에 배경·가구·아이템·무늬·방이 다 들어 있다 (`category` 로 나뉜다: nature prop building tile furniture item wallpaper floor room). "전체 요청 확인" 은 그대로 "배경 요청 확인" 순서로.
2. **P0 묶음 파일 (`p9-pack`)**: 영향 없음 — 편집기 묶음은 게임 빌드에 들어가지 않는다 (게임 코드가 그 경로를 쓰지 않음). 다만 `build-web` 이 `assets/` 를 통째로 훑게 바뀐다면 `editor-*.json` 을 빼 주세요.
3. **CONTRACTS 끝 "리소스 교체 약속" (조정 세션)**: 줄 더하기 제안 — "아이템: `assets/items/specs` 하나만 고치면 아이콘·들어 보이기 모델이 같이 바뀐다 (`build-item.mjs`). 벽지·바닥: 무늬 스펙 하나 (색·`pattern.size`). 주민 방: `rooms/<slug>.json` 하나 — 배경 편집기 방 배치 요청의 `layout` 을 그대로."

## 확인한 것 (2026-10-29, `node dev-server.mjs --port=4223` 의 `/bg-editor.html`)

- `node tools/build-editor-index.mjs` → 위 표의 묶음 5개. `node --test tests/` **197/197**.
- 영역 탭 다섯·분류 탭 개수(아이템 82 = 물고기 20 · 곤충 22 · 화석 9 · 도구 5 · 재료 8 · 씨앗 3 · 과일 6 · 조개 6 · 꽃 3), `#item-…` 주소로 바로 열기(아이템 목록을 기다렸다 고름), 배경 요소(활엽수) 예전대로.
- 아이템: 배추흰나비·붕어·튤립 3D(묶음에서 풀어 읽음), 붕어 꼬리·지느러미 고르기, 튤립 색 변형 4, 아이콘 시트, "+ 새 아이템"(물고기) 요청 글.
- 무늬: WP-01 방에 붙여 보기, WP-04 꽃잎 색·간격 0.9m 로 바꾸면 벽에 바로, 무늬 크게(1m 눈금), 요청 글에 색·`pattern.size` 변경.
- 방: RM-01 공 바구니 마우스로 끌기, 벽시계(북쪽 벽 0번)·라디오 더하기·R 돌리기·방향키, 문 매트·소파 겹침을 검사가 잡고 빨갛게, 3D로 보기(가구 모델·벽시계·주민 자리), "요청 보내기" → 로컬 `/api/db/env-requests` 에 `layout`·`problems` 와 함께 저장 (확인 뒤 지움), RM-02–06 검사 통과(게임 테스트와 같음), RM-07 새 방 요청 글(id·owner 포함 JSON).
- 휴대폰 폭 375px: 가로 스크롤 없음, 방 격자 294px. 콘솔 오류 없음 (가짜 포인터로 시험할 때 난 setPointerCapture 오류는 막아 둠).

**게시 (2026-10-29)**: 배경 편집기 https://claude.ai/artifact/LuEvzroBSW2RFhVWvm6tkh **버전 7** — `bg-editor.html` + 새 묶음 5개만 올림, 파일 403 → **408** (capabilities db·assets·user 그대로). 다음 게시 때 아이템·무늬·방이 바뀌었으면 `node tools/build-editor-index.mjs` 뒤 바뀐 묶음만.

못 한 것: 실제 휴대폰 손가락 끌기(마우스·합성 이벤트로만), claude.ai 게시본에서 요청 저장(게시 뒤 열어 보기는 사용자), 게임 checkRoom 과 편집기 검사를 같은 입력으로 자동 비교하는 테스트(편집기 코드는 HTML 안이라 node 테스트에서 못 부름).
