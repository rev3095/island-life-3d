섬 지도 편집기: https://claude.ai/artifact/RYd99RBUsbUN8M3vNhwSST · 파일 `map-editor.html` · 게임 숫자 표: https://claude.ai/artifact/DcidJEY1VRNNJdCxwge3Sj · 파일 `data-editor.html`

# M6-P5 지도·숫자 (ET-08 · ET-09, `p9-mapdata`) — 작업 노트

검수 보드 wave6 반영 v1: **D32-A 자리 고정 + 시드** · **D33-A 표 편집기**. 사용자 원칙대로 지도·숫자를 편집기에서 고르고 고치고, 채팅 명령("지도 반영" · "숫자 반영")으로 적용하고, 반영 기록으로 되돌린다.

## 한 것

| 무엇 | 파일 | 모양 |
|---|---|---|
| 섬 지도 자리·시드·밀도 | `assets/island/layout.json` (새) | 아래 「layout.json」. 읽는 곳: `src/world/index.js` → `generateIsland(seed, { layout })` |
| 아이템 사전 | `assets/data/items.json` (새) | 줄 표 `fish` `bugs` `fossils` `fruits` `shells` `flowers` `mats` `tools` `furniture` `seeds` + 낱말표 `seasons` `times` `fishPlaces` `bugPlaces`, `stack`, `weight`, `unknownFossil`, `acornBag`. 읽는 곳 `src/data/items.js` |
| 규칙 숫자 | `assets/data/rules.json` (새) | `starter` `shop` `gather` `day` `recipes` `birthdays` `town`. 읽는 곳 `spawns.js` · `economy.js` · `day.js` · `recipes.js` · `birthdays.js` · `index.js`(STARTER). `town` 은 아직 아무도 안 읽음 (아래 제안) |
| 표 불러오기 | `src/data/tables.js` (새) | top-level await 로 두 표를 받는다 — 브라우저 `assets.loadJSON('assets/data/…')`, node(테스트·도구, 22.3+)는 `process.getBuiltinModule('node:fs')` 로 파일. `src/data/*` 가 지금처럼 바로(동기) 쓴다 |
| 섬 만들기 | `src/world/island.js` | `DEFAULT_LAYOUT`(6차 전 코드 값) · `resolveLayout(layout)`(빠진·틀린 칸은 기본값) · `generateIsland(…, { layout })` · 돌려주는 값에 `layout`(합친 값). 그 밖은 그대로 |
| 편집기 | `map-editor.html` · `data-editor.html` (새, 아티팩트) | 아래 「편집기」 |
| 바뀐 칸 규칙·반영 도구 | `tools/edits.mjs` · `tools/apply-edits.mjs` (새) | 편집기·도구·테스트가 같은 규칙 (`changes` = { 경로: 값 }) |
| 테스트 | `tests/mapdata.test.mjs` (새, 10개) | 지도·숫자 반영 문지기 + 반영 도구 |
| 데모 | `demos/data.html` | `<base href="../">` + three importmap (표 로더가 assets.js 를 쓴다), 아이콘 자리에 이모지 |

**지금 섬·숫자와 같다**: 바꾸기 전에 뜬 지문(섬 8시드 × 특산 과일 2 = 16개: 타일·높이·깃발·경사로·물체·장소·집터·다리·선착장·폭포 / 아이템 126 · 출현표 모든 장소×시각×달×날씨 · 고정 난수 굴리기 400번 · 상점 물건 · 특산 과일 · 파는/사는 값 · 레시피 글)이 바꾼 뒤와 모두 같다. 게임(dev-server `?debug`)에서도 `world.debug.gen` 지문(타일·물체 316·장소)이 같고, 위에서 본 그림도 같다. 앞으로는 `tests/mapdata.test.mjs` 첫 테스트가 `DEFAULT_LAYOUT` 지문을 지킨다 (layout.json 을 바꿔도 이 테스트는 그대로 — 기본값이 6차 전 섬인지 보는 것).

## layout.json

자리는 섬 크기에 대한 비율 `[x, z]` (0 = 서쪽·북쪽, 1 = 동쪽·남쪽). 건물은 그 자리에서 가까운 빈 땅부터 넓혀 가며 집터를 찾는다 (예전과 같은 규칙).

| 칸 | 뜻 |
|---|---|
| `version` | 반영할 때마다 +1 (v0 = 6차 전 섬) |
| `seed` | **지도 시드**. world 가 `layout.seed ?? state.island.seed` 로 섬을 만든다. `null` 이면 저장마다의 섬 시드. 날씨·상점·특산 과일·날마다 놓는 것은 지금처럼 저장의 `state.island.seed` (=20261028) |
| `pond` | 언덕 위 연못·폭포 (강이 언덕을 넘는 x) |
| `bridges` | 다리 2개 `[x, z]` — 강이 이 자리를 곧게 지난다. 다리 사이·아래 강 굽이 점은 코드에 그대로 |
| `ramps` | 경사로 3곳 x |
| `dock` | 선착장 x (남쪽 바닷가에서 찾는다) — 선착장 앞 모래사장 넓히기도 이 x |
| `plaza` | 광장 가운데 (반지름 3.3 은 코드, Z5 가 넓힌다) |
| `museum` · `museumLow` | 박물관 (언덕 위) · 언덕에 자리가 없을 때 아래 |
| `shop` · `playerHouse` · `villagers.<slug>` | 상점 · 내 집 · 주민 집 7 (단풍 = 빈 집터) |
| `orchard` · `rocks` | 과수원 언덕 · 바위 지대 6곳 |
| `festival` | **축제 광장 빈 자리** `{ at: [x, z], r }` — 아래 |
| `density` | 나무·꽃 밀도: `trees` `cedars` `fruitTrees` `fruitChance` `forest`(숲 잡음에 곱하는 세기) `orchardTrees` `palms` `flowerClusters` `flowerSize: [적게, 많게]` `bushes` `weeds` `shells` `fossils` (모두 처음 섬에 놓는 최대 개수 — 날마다 새로 놓는 조개·잡초·화석은 rules.json `day`) |

### 축제 광장 빈 자리 (M5 · Z5 몫)

- `festival: { at: [0.453, 0.54], r: 6 }` = Z5 보드 D19-A 추천안(지금 광장을 동쪽으로 5칸, 지름 12칸) 자리를 미리 적어 둔 것. **지금 섬 만들기는 이 칸을 읽지 않는다** (섬이 그대로여야 해서). 지도 편집기에서 점선 원으로 보이고 끌어 옮길 수 있다.
- Z5 가 광장을 넓힐 때: `island.js` 8단계(광장)에서 `lay.festival` 을 읽어 쓰면 된다 (`generateIsland` 안의 `lay` = `resolveLayout(layout)`, 결과 `gen.layout.festival`). 그러면 `tests/mapdata.test.mjs` 첫 지문 테스트는 기본값으로 만든 섬이 바뀌므로 그 숫자를 새로 뜨고 이유를 적는다. `places.festival` 은 Z5 notes 의 제안대로.
- 사용자가 D19-B/C 를 고르면 `festival` 칸 모양(두 마당 · 네모 광장)을 Z5 가 바꾼다 — `resolveLayout` 의 `festival` 줄과 편집기 `PINS` 의 `festival/at` 만 고치면 된다.

## 저장과의 관계 (반영 v1 규칙)

섬 위의 저장은 칸 좌표로 적혀 있다: `state.island.removed`(없앤 생성 물체 id = `종류@tx,tz`), `added`(놓은·심은 것 `{tx, tz}`), `variants`, `fruit`(딴 날), `daily`(그날 친 횟수). 지도가 바뀌면 —

1. **건물·광장·다리·선착장 자리만 옮긴 반영**: 섬 모양·나무 대부분은 그대로. 다만 새 건물 자리에 놓아 둔 물건(`added`)이 겹치거나, 옮겨 간 건물 둘레의 나무·꽃이 바뀌어 `removed` 가 다른 것을 가리킬 수 있다.
2. **시드·밀도를 바꾼 반영**: 해안선·언덕·강과 생성 물체가 모두 새로 놓인다 → `removed`·`variants`·`fruit` 는 엉뚱한 물체를 가리키고, `added` 는 물·건물 위에 놓일 수 있다.

정한 것:
- 지도는 **모든 저장에 같이 적용**된다 (layout 이 정한다). 저장은 지금 지도 버전을 모른다.
- 편집기는 늘 경고 문구를 보이고, 시드·밀도를 바꾸면 경고를 굵게 한다.
- **"지도 반영" 보고에 Claude 가 (1)/(2) 어느 쪽인지 적고**, (2) 면 "하던 게임은 새로 시작하는 게 깔끔하다" 를 함께 알린다.
- 제안 (world 담당·조정 세션, 아직 안 함): `state.island.layout` = 마지막으로 연 지도 버전. 다르면 `removed`·`variants`·`fruit` 를 비우고, `added` 중 새 지도에서 못 놓는 칸(물·건물·다리·다른 물체 위)은 가방이나 우편으로 돌려준다. `world/objects.js` 의 `populate` 와 `state.js` 한 칸이 필요해 이 트랙 밖.

## 편집기

둘 다 같은 모양 (시나리오 편집기와 같은 저장소 흐름, 로컬 dev-server 에서는 `/api/db` 로 `assets/review/map-*.json` · `data-*.json`):

| 저장소 문서 | 누가 쓰나 | 모양 |
|---|---|---|
| `drafts/map` · `drafts/data` | 편집기 (Contributor 이상) | `{ changes: { 경로: 값 }, note, status: 'editing'|'requested', basedOn, updatedAt, updatedBy }` — 반영된 파일과 다른 칸만 |
| `applied/map` · `applied/data` | Claude (admin) | `{ board: 'map'|'data', version, appliedAt, summary, commit, changed: [경로], layout | snapshot: { items, rules } }` |
| `history/map-v<n>` · `history/data-v<n>` | Claude (admin) | applied 와 같은 모양 (`board` 칸 = P1 `ApplyLog.watch` 가 찾는 칸) |

capabilities: `{ db: { rules: [{ path: 'applied', read: 'view', write: 'admin' }, { path: 'history', read: 'view', write: 'admin' }] }, user: {} }`. v0 기록(2026-10-29, commit 2c125c6)을 둘 다 써 두었다.

**경로 규칙** (`tools/edits.mjs`): `'/'` 로 나눈 칸 이름. 줄 표(`slug` · `kind` · `result` 이름표가 있는 배열)는 그 이름으로, 그 밖 배열은 번호로. 값 `{ "$delete": true }` = 칸 지우기 (줄마다 덧붙인 `weight` 를 비울 때), 줄 경로에 `null` = 줄 빼기, 줄 객체 = 새 줄. 지도는 `shop` · `villagers/coco` · `density/trees` · `bridges` (배열 칸은 편집기가 배열 통째로), 숫자는 첫 칸이 파일: `items/fish/crucian/price` · `rules/gather/shake/bees` · `rules/recipes/tool.rod/needs` · `rules/recipes/furn.sofa` (새 레시피). 저장소는 객체 칸 순서를 이름 순으로 돌려주므로 비교는 `canon`/`same` (칸 순서 무시).

**지도 편집기**: 64×56 타일 그림(바다·모래·풀밭·언덕·흙길·광장·강, 나무·꽃·바위 점, 건물·빈 집터·다리·선착장, 축제 광장 점선 원) 위에 자리 표시 27개(박물관·박물관 아래 자리·상점·내 집·주민 집 7·광장·축제 광장·다리 2·선착장·연못·과수원·경사로 3·바위 6). 끌기(칸 눈금에 맞춤, 빠르면 끄는 동안에도 다시 만들기 — 섬 만들기 약 20ms)·화살표 키(Shift 3칸). 목표 자리 → 실제로 지은 자리 점선, 고른 자리 칸에 "목표에서 n칸 떨어져 지음 / 자리를 못 찾음". 시드(🎲), 밀도 슬라이더 14개(실제 개수 같이), 확인(반영 문지기 테스트와 같은 검사), 바뀐 것 목록·되돌리기, 의견, 반영 요청 표시, 반영 기록에서 "이 지도로 되돌리기".

**표 편집기**: 탭 11개 (물고기 · 곤충 · 화석 · 과일·조개 · 꽃·씨앗 · 재료·도구 · 가구 · 레시피 · 규칙 숫자 · 생일 · 주민). 칸 종류별 입력(정수·확률·글·고르기·체크·몸 색 4개·출현 몫(비우면 값으로)·월-일·작은~큰 값), 잘못된 값은 저장하지 않고 빨간 테두리 + 이유. 바뀐 칸 색칠(반영된 값은 칸 위에 올리면), 모든 표에서 찾기(탭 옆 찾은 줄 수), 레시피 줄 더하기·빼기·재료 고르기(아이템 · "분류 아무거나"), 확인(확률 합 ≤ 1, 상점 가구 사는 값, 레시피 아이템 있음, 잡초 범위, 친밀도 단계 차례, 주민 칸 연결 대기), 반영 기록에서 "이 표로 되돌리기".

## "지도 반영" (Claude 가 하는 일)

1. ArtifactData `get` `drafts/map` 과 `applied/map` (지도 편집기 링크는 이 파일 첫 줄). `changes` 가 비었으면 "바뀐 게 없다" 하고 끝. `note` 를 읽는다.
2. 받은 문서를 파일로 두고 `node tools/apply-edits.mjs map <초안.json> --dry` → 바뀌는 칸 확인 → `--dry` 없이 다시 (layout.json `version` +1). 표에 없는 칸이 있으면 쓰지 않는다.
3. `node --test tests/` — `tests/mapdata.test.mjs` 가 칸 모양·섬 안쪽·건물 10채·다리 2·선착장·경사로 3·폭포·광장·축제 자리를 본다. 걸리면 **반영하지 않고** `git checkout -- assets/island/layout.json` 후 이유(편집기 「확인」 칸과 같은 말)를 알린다.
4. dev-server `/index.html?debug` 로 섬을 열어 본다 (콘솔 오류 0, `world.debug.gen.layout`). 저장과의 관계 (1)/(2) 를 정한다.
5. 커밋 (`지도 반영 v<n>: …`) → 편집기 다시 게시 (`file_path: map-editor.html`, `files: {"assets/island/layout.json": "assets/island/layout.json"}` — 섬 코드가 바뀌었으면 `src/world/island.js` 도) → 게임 링크는 조정 세션 (D35-A 반영할 때마다).
6. `applied/map` = `{ board: 'map', version, appliedAt, summary, commit(반영 직전 main), changed: Object.keys(changes), layout(새 파일) }`, 같은 내용으로 `history/map-v<n>`. `drafts/map` 은 `changes: {}`, `status: 'editing'` (편집기는 파일과 같아진 칸을 저절로 버리지만 깔끔하게).
- **되돌리기**: 편집기 "이 지도로 되돌리기" 가 그 버전과 지금 파일의 차이를 `drafts/map` 에 넣고 요청 표시를 한다 → 위 순서 그대로. (커밋을 되돌리고 싶다고 하면 `history/map-v<n>.commit` 이후 지도 반영 커밋을 `git revert`.)

## "숫자 반영" (Claude 가 하는 일)

1. ArtifactData `get` `drafts/data` · `applied/data`. 바뀐 게 없으면 끝.
2. `node tools/apply-edits.mjs data <초안.json> --dry` → 확인 → 적용 (`items.json` · `rules.json` 중 바뀐 것만 `version` +1).
3. `node --test tests/`. 실패는 두 가지로 나눈다:
   - **사용자가 일부러 바꾼 값을 박아 둔 테스트** → 그 기대값을 새 값으로 고친다 (커밋에 적는다). 지금 박혀 있는 것: `tests/items.test.mjs` "컨셉 보드 값 그대로"(붕어·상어·사슴벌레·공룡 두개골·삽), `tests/recipes-economy.test.mjs` 의 상어 값·특산 과일 100/500·소파·도구 사기(도토리 500 으로 소파를 못 산다) 등.
   - **규칙 검사** (`tests/mapdata.test.mjs` 의 표 검사, 확률 합, 없는 아이템, 생일 모양, 주민 칸 연결 전, 그 밖 게임 규칙 테스트) → **반영하지 않는다**: `git checkout -- assets/data` 후 어느 칸이 왜 걸렸는지 알린다.
4. 게임을 열어 본다 (데이터 데모 `demos/data.html` 에서 값·출현표 굴려 보기, `index.html` 콘솔 오류 0).
5. 커밋 (`숫자 반영 v<n>: …`) → 편집기 다시 게시 (`files: {"assets/data/items.json": …, "assets/data/rules.json": …}`) → 게임 링크는 조정 세션.
6. `applied/data` = `{ board: 'data', version: <items.json version>, appliedAt, summary, commit, changed, snapshot: { items, rules } }` (약 20KB), `history/data-v<n>`, `drafts/data` 비우기. 되돌리기는 지도와 같다.

## 다른 트랙에 (제안)

- **town (주민 친밀도·부탁 보상 연결)** — `src/gameplay/town/rules.js` 를 이렇게 바꾸면 rules.json `town` 칸이 게임에 들어간다 (값은 지금과 같아 town 테스트 그대로):
  ```js
  import { RULES } from '../../data/tables.js';
  const T = RULES.town;
  export const FRIEND_MAX = T.friendMax;
  export const TIERS = T.tiers;
  export const TALK_BONUS = T.talkBonus;
  export const GIFT_POINTS = T.giftPoints;
  export const GIFTS_COUNTED_PER_DAY = T.giftsCountedPerDay;
  export const REQUEST_POINTS = T.requestPoints;
  export const REQUEST_DAYS = T.requestDays;
  // requestReward 안: 0.4 → T.requestReward.furnitureChance, 200 → .valueDefault, 1.2 → .valueMult, 250 → .valuePlus, 2·12 → .bagMin·.bagMax
  ```
  합친 뒤 표 편집기 「주민」 탭의 경고 띠(`waiting: true`)와 「확인」의 "주민 칸 연결 대기" 줄을 지운다. 주민마다의 보상 가구·좋아하는 것(`people.js`)은 M6-P3 성격·대화 탭 몫.
- **P0 묶음 파일 (`p9-pack`)** — 게임이 새로 받는 파일 4개: `src/data/tables.js`, `assets/data/items.json`, `assets/data/rules.json`, `assets/island/layout.json`. 둘 다 `assets.loadJSON` 으로 읽고(data 모듈을 불러올 때 · world init 때) 웹 빌드가 글자 그대로 잡는다 (`--check` 로 확인). **지금 이 브랜치만으로는 게시 파일이 514개 > 511 이라 `tests/build-web.test.mjs` 2개가 실패**한다 — 묶음 파일이 합쳐지면 풀린다. 표 두 개는 data 모듈보다 먼저 있어야 하니 첫 묶음(부팅)에.
- **P1 편집기 홈 (`p9-hub`)** — `editors.html` 의 `map`·`data` 줄: `group: 'editor'`, url 위 두 링크, 명령 "지도 반영"·"숫자 반영", reads = `drafts/map` · `drafts/data` (`status: 'requested'` 이면 할 일), 반영 기록은 `applied/<map|data>` · `history` where `board ==`. 편집기 안의 반영 기록 칸은 지금 각자 그리고, `board-kit.js` 의 `ApplyLog` 가 합쳐지면 그걸로 바꿔도 된다 (같은 모양).
- **CONTRACTS** — data 절에 "숫자 표는 `assets/data/items.json`·`rules.json` (src/data/tables.js 가 읽음)", world 절에 "`generateIsland(seed, { layout })`, 지도 자리는 `assets/island/layout.json`, `world.debug.gen.layout`". Z5 가 축제 광장 자리를 서비스로 내보낼 때 `world.places.festival` 과 함께 `layout.festival` 을 원본으로.
- **Z5** — 위 「축제 광장 빈 자리」. 구현 전에 main 을 맞추면 `island.js` 에 `lay` 가 있다.

## 확인한 것 / 못 한 것

- 확인: `node --test tests/` 207 중 205 통과 (실패 2 = build-web 파일 수 한계, 위 P0). 바꾸기 전·후 지문 같음(섬 16 · 데이터 전부). 게임(dev-server 4225 `?debug`) 섬 지문·물체 316·콘솔 오류 0, 새 JSON 3개를 받음, 위에서 본 그림 비교. 데이터 데모 열림. 두 편집기 로컬: 섬 그림·자리 표시, 상점 끌기 → 다시 만들기 → `assets/review/map-drafts.json` 저장, 표: 값 고치기·잘못된 값 막기·출현 몫·레시피 더하기·찾기·저장. 두 초안으로 반영 도구 `--dry`/적용 → 테스트(일부러 바꾼 상어 값을 박아 둔 테스트 2개가 걸리는 것까지) → 되돌림. 휴대폰 폭(375)·어두운 화면에서 가로 넘침 없음. 아티팩트 게시 v2, 저장소 빈 상태 읽기 → v0 기록 쓰기 → 보는 사람 권한으로 history 읽기, 되돌리기 계산이 저장소 사본과 차이 0.
- 못 한 것: claude.ai 안에서 편집기를 직접 끌어 보기(저장소 쓰기 권한·`user.can` 동작), 실제 휴대폰 터치 끌기, 지도를 실제로 바꾼 "지도 반영" 한 바퀴(사용자 요청이 올 때), 하던 저장에서 지도를 바꿨을 때 게임 화면.
