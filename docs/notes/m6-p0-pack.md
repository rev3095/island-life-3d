# M6-P0 묶음 파일 (`p9-pack`) 노트

게임 웹 게시본(claude.ai 아티팩트)은 **한 버전에 파일 511개까지**인데 `node tools/build-web.mjs` 가 510파일이었다 (JS 132 + 에셋 ~375). 에셋을 **묶음 파일**(`packs/<갈래>-<n>.json`) 몇 개로 모아 게시 파일을 145개로 줄였다. 빌드·게시 순서 전체는 [deploy.md](deploy.md).

| | 전 (c289d39) | 뒤 (p9-pack) |
|---|---:|---:|
| 게시 파일 (페이지 포함) | 510 | **145** (js 133 · css 3 · 묶음 8 · 페이지 1) |
| 용량 | 15.70 MB | 16.43 MB (그림 base64 +0.7 MB) |
| 게시 횟수 | 2 (255 + 255) | 1 |
| 처음에 받는 에셋 | 요청 107개 | 묶음 3개 6.2 MB (안에 130파일) |

## 바꾼 파일

| 파일 | 한 것 |
|---|---|
| `tools/build-web.mjs` | `PACKS` 갈래 표·`PACK_BYTES`(3 MB)·`makePacks`·`splitBySize`(고른 크기), 페이지에 묶음 목록 `<script type="application/json" id="island-packs">`, 로딩 어림값 = boot 묶음 안 파일 수, `dist/web/packs/` 쓰기, `--live` → `publish-<n>.json` (`planTransition`·`parseLive`), 표·`build.json` 에 묶음마다 boot·파일·용량·hash |
| `src/core/packs.js` (**새 파일**) | 받기 층: 묶음 목록 읽기, boot 묶음 먼저 받기, `readJSON`·`url`·`urlNow`·`packStatus`·`loadStats`, 묶음 안 진행 나눠 세기, blob URL(막히면 data: URL), 게시본에서만 fetch 덮개 |
| `src/core/assets.js` | 받기를 packs.js 로 옮김 (`loadJSON` = 캐시 + `readJSON`). `loadStats`·`url`·`urlNow`·`packed`·`packStatus` 내보내기. 밖에서 보는 모양은 그대로 |
| `src/ui/dom.js` `iconEl` 만 | 그림 경로면 `urlNow` → 없으면 `url()` 을 기다려 `src` 를 건다 (개발 서버는 경로 그대로라 예전과 같다) |
| `dev-server.mjs` `/artifact/` 부분 | 묶음 원본(`dist/web/packs/`)도 files.json 으로 내줌(원래 코드 그대로 됨), 아티팩트가 거절할 목록(511파일·256MB·16/15MB·웹 표준 밖 형식·없는 원본)이면 게임 대신 이유(500) + 로그 |
| `tests/build-web.test.mjs` | 15개 (아래) |
| `docs/notes/deploy.md`, `CLAUDE.md` 웹 배포 절, 이 노트 | |

`src/core/packs.js` 는 PLAN 6차 표에 없던 새 파일이다. `iconEl`(ui/dom.js) 이 묶음 그림 주소를 써야 하는데 `assets.js` 는 three(GLTFLoader)를 불러서 node 테스트(`tests/town.test.mjs` 가 dom.js 를 부른다)에서 못 읽는다 → three 없는 받기 층을 따로 두고 assets.js 가 그걸 다시 내보낸다. `src/core/` 의 P0 몫으로 봐 주면 된다.

## 결정

1. **묶음 = JSON 글 파일** `{"pack":"<이름>","files":{"<경로>": 값}}`. JSON·.glb.json 은 값 그대로(공백만 줄임), 그림은 base64 글자. 바이너리 묶음(.bin)이면 모델 base64 를 빼서 더 작지만, 아티팩트가 `.glb` 를 거절했듯 웹 표준 밖 형식은 받을지 몰라서 `.json` 만 쓴다.
2. **갈래**(`PACKS`): `icons`(그림) · `island`(boot: env·interior·story·가구 목록 + 6차가 만들 island·data·sound·style) · `people`(boot: models·specs) · `furniture` · `items` · `more`(갈래 없는 새 에셋 → 빌드 표에 알림, 테스트는 알림 0 을 본다). boot 는 개발 서버에서 새 게임을 열 때 실제로 읽는 것을 재서 골랐다.
3. **크기**: 갈래가 3 MB 를 넘으면 `ceil(합/3MB)` 개로 고르게 나눈다 (경로 순서 유지, 한 조각 3 MB 안). 큰 묶음 하나보다 boot 3개가 나란히 받아지고, 나중 묶음(아이콘·아이템)도 1.5 MB 쯤이라 처음 열 때 덜 기다린다.
4. **묶음 목록은 페이지 안에** (따로 `packs/index.json` 을 받으면 시작이 한 번 더 늦다). 목록이 없는 페이지 = 개발 서버·데모 → 예전처럼 파일 하나씩. 그래서 `/index.html` 은 아무것도 안 바뀐다.
5. **이름은 내용 hash 가 아니라 `<갈래>-<n>`**: 다시 게시할 때 같은 이름이 덮이고 낡은 묶음이 쌓이지 않는다. 바뀐 것은 `build.json` `packs[].hash` 로 안다. 145개라 통째로 올려도 한 번이다.
6. **진행**: 묶음 안 파일 수로 센다 (받기 시작 = `started += n`, 받은 바이트 비율만큼 `done`, 끝 = n). 로딩 화면(`tools/web-loader.html`)은 손대지 않았고 "파일 N / M" 글도 예전처럼 파일 수다.
7. **그림**: `url()` = blob URL. 첫 그림을 `Image` 로 열어 보고 안 되면(실제 아티팩트 CSP 가 `blob:` 그림을 막을 때) 그 뒤로는 `data:` URL. 아티팩트 도구 설명이 그림을 `data:` 로 넣으라고 하므로 `data:` 는 된다고 본다.
8. **fetch 덮개**: 게시본에서만 `window.fetch` 가 묶음 안 경로(같은 출처·페이지 아래·GET)를 `Response` 로 대답한다. 아래 '직접 fetch' 를 고치지 않고 돌리려고. 개발 서버에서는 덮지 않는다.
9. **`planWeb()` 의 `files` 뜻은 그대로** (= 빌드에 든 원본 전부, `tests/interior.test.mjs` 가 쓴다). 게시할 파일은 새 칸 `publish`, 묶음은 `packs`, 페이지 안 목록은 `manifest`.

## 에셋 경로를 직접 쓰는 곳 (grep, 고치지 않음)

`grep -rn "fetch(\|\.src\s*=\|src:\s\|new URL(\|url(" src` 와 `assets/` 글자를 본 결과:

| 곳 | 무엇 | 게시본에서 | 제안 |
|---|---|---|---|
| `src/gameplay/story/index.js:31-32` | `fetch(INDEX_FILE)`, `SCENE_FILES.map(f => fetch(f))` — 장면 13개 | fetch 덮개가 묶음(`island-1`)에서 대답 → 돈다 (`?story=s11-ending-photo` 확인) | **스토리 세션**: `ctx.assets.loadJSON(f)` 로 바꾸면 캐시·다시 받기·진행이 붙고, 나중에 덮개를 뺄 수 있다. `r.ok ? r.json() : null` 은 `loadJSON(f).catch(() => null)` 로 같은 뜻 |
| `src/ui/variants.js:7` | `ctx.assets?.loadJSON ? … : fetch(url)` | 게임에는 ctx.assets 가 있어서 loadJSON 길 | 없음 (데모용 대비) |
| `src/ui/shop.js:83` | `<img src={d.swatch}>` | 벽지·바닥 견본 = `house/pattern.js` 가 그린 data URL, 에셋 경로 아님 | 없음 |
| `src/ui/map.js:53` | `drawImage(base, …)` | 캔버스로 그린 지도, 에셋 아님 | 없음 |
| `src/gameplay/intro/dom.js:21`, `src/ui/index.js:21`, `src/gameplay/story/layer.js:4` | `new URL('./x.css', import.meta.url)` | css 는 따로 올라간다 | 없음 |
| `src/gameplay/house/interior.js`, `house/furniture.js`, `gather/meshes.js` | `ctx.assets.loadJSON`·`loadModel` | 묶음에서 | 없음 |
| `demos/sky.html` | `src/core/assets.js` 를 부름 | 데모는 묶음 목록이 없어 파일 하나씩 | 없음 |

편집기(`editor.html`·`bg-editor.html`·`story-editor.html`)는 게임 빌드와 따로 게시되므로 이 일과 상관없다.

## 다른 트랙에 제안

- **CONTRACTS `assets` 줄에 덧붙이기**: `url(path) → Promise<주소>`·`urlNow(path) → 주소|null` (`<img src>` 용, 게시본에서는 blob URL), `packed`, `packStatus()`, "게시본에서는 에셋이 묶음 안 — `fetch('assets/…')`·`<img src="assets/…">` 를 바로 쓰지 말고 `loadJSON`·`loadModel`·`url`/`iconEl`".
- **M6-P4 소리 (`assets/sound/`)·P5 지도·숫자 (`assets/island/`·`assets/data/`)·P6 스타일 (`assets/style/`)**: `PACKS` 의 boot 갈래(`island`)에 미리 넣어 두었다. 시작할 때 안 읽는 것(편집기 전용 등)이면 알려 달라. 빌드가 파일을 찾으려면 코드에 `'assets/…json'` 을 글자 그대로 적거나 `FAMILIES` 에 목록을 더해야 한다 (예전 규칙 그대로). 읽기는 `ctx.assets.loadJSON`.
- **M5 축제 (이모티콘 그림 `assets/emotes/` 등)**: 그림은 `icons` 갈래로 들어간다 (나중에 받기). `<img>` 는 `iconEl` 또는 `ctx.assets.url()`. 대화 중 바로 보여야 하면 미리 `ctx.assets.url(path)` 를 불러 두거나 boot 갈래를 부탁.
- **스토리**: 위 표 첫 줄. 그리고 `?story=s11-ending-photo` 미리 보기에서 카메라가 나무에 붙어 보인다 — 개발 서버도 같아서 이 일 탓은 아니다 (축제 자리가 아직 없어서로 보임).
- **조정 세션 (합친 뒤 첫 게시)**: 지금 게임 링크 v6 은 파일 510개라 묶음 빌드를 그냥 올리면 511을 넘는다 → `list_files` 결과를 `dist/web/live.txt` 로 저장하고 `node tools/build-web.mjs --live dist/web/live.txt` → `publish-1.json` … 을 같은 file_path 로 차례대로 (예전 목록 510개로 흉내 내면 지우기 254 → 지우기 120 + 올리기 134 → 올리기 10, 세 번). 자세히는 deploy.md '게시 순서'.

## 확인한 것 · 못 한 것

deploy.md '확인한 것 — M6-P0' 와 '못 한 것' 첫 줄. 줄이면: `node --test tests/` 203/203, 빌드 145파일, `/artifact/` 에서 섬·가방 아이콘(blob)·집 가구·아이템 모델·장면 미리 보기, 콘솔 오류 0, 목록 밖 요청 0, iframe, `/index.html` 그대로. 실제 아티팩트 게시·실제 CSP·느린 네트워크·휴대폰은 못 봤다.

테스트 (`tests/build-web.test.mjs`): 게시 파일은 모듈·css·묶음뿐 / 에셋은 한 묶음에 한 번, 내용 = 원본 (JSON 같은 값, 그림 같은 바이트) / boot 묶음에 시작 때 읽는 것만 / 고른 크기 나누기 / 페이지 순서·묶음 목록 = 계획·로딩 어림값 / 게시본 510개 → 이 빌드로 옮기는 차례가 어느 때도 511 을 안 넘고 끝 목록이 같다·list_files 글 읽기 / writeWeb 이 묶음·files.json·publish 를 쓴다 / packs.js 를 node 에서 게시본처럼 (boot 만 먼저, 나중 묶음은 한 번, 진행 중간값, blob 바이트, fetch 덮개, 404 뒤 다시 받기) / 묶음 목록 없으면 경로 그대로.
