# M20-S3 게시 파일 묶기 (`m20-pack`)

게시본(claude.ai 아티팩트)에 src JS 모듈 230개가 파일 하나씩 올라가 게시 파일이 260개 — 한 번 게시 한도 255 를 넘어 `files-1/2.json` 으로 나눠 올렸고, 새 모듈을 더하기 어려웠다(M19 트랙들이 기존 파일에 억지로 붙임). 이제 **모듈을 묶음 파일 11개**에 넣는다.

## 결과 (main eea6653 기준)

| | 전 | 후 |
|---|---:|---:|
| 게시 파일 (페이지 포함) | 260 (`files-1` 255 + `files-2` 5) | **41** (`files.json` 한 번) |
| 모듈 | 230 파일 2.24 MB | 묶음 `packs/src-*.js` 11개 2.34 MB |
| 페이지 | 85.6 KB | 75.0 KB (modulepreload 줄이 230 → 11) |
| 처음 받는 것 (boot: 페이지 + 모듈 + css + boot 에셋 묶음 3) | 9.04 MB | 9.13 MB (+1%) |

예전에도 모든 모듈을 modulepreload 로 처음에 받았으므로 boot 는 변환 머리글만큼(+0.1 MB) 늘었다. 이제 모듈을 아무리 더해도 게시 파일 수는 갈래(폴더)당 640 KB 마다 하나씩만 는다.

## 방식

**blob URL importmap 은 쓰지 않았다.** dev-server CSP(`script-src 'self' 'unsafe-inline' + CDN`)에 `blob:` 이 없어 로컬에서부터 막히고, 실제 아티팩트 프레임 CSP 는 바깥 페이지에서 읽을 수 없었다(claude.ai 바깥 페이지 CSP 는 `script-src 'nonce-…' 'self' …` — 프레임 것은 못 봄). 그래서 같은 출처 `.js` 파일 + 인라인 스크립트만으로 도는 방식을 골랐다 — 지금 게시본이 이미 쓰는 것과 같은 권한.

- `tools/build-web.mjs` `transformModule(path, text)`: 모듈 하나를 등록 함수 몸으로 바꾼다.
  - `import a, { b as c } from './x.js'` → `const $isl_i0 = $isl_req("src/…/x.js"); const a = $isl_i0.default; const { b: c } = $isl_i0;` (줄 수 그대로 — 오류 줄 번호가 원본과 비슷)
  - `import * as THREE from 'three'` (바깥 모듈) → 묶음 파일 맨 위 진짜 `import * as $isl_e0 from "three"` (importmap 그대로) + 몸에서 `$isl_x0`
  - `export const|function|async function|class|default|{ … }|{ … } from` → 내보내기 객체의 getter (`$isl_exp({ name: () => name })`). 구조 분해 `export const [A, B] = …`·여러 개 `export const a = 1, b = 2` 도 이름을 읽는다 (`declNames`).
  - `import('./x.js')`·`import(path)` → `$isl_dyn(…)`: 상대 경로는 그 모듈 기준으로 풀어 묶음 안 모듈을, `'three/addons/…'` 같은 이름은 진짜 `import()` (importmap). main.js `MODULES`·gameplay `PARTS`·ui `EXTRA_PANELS` 그대로 — 없는 모듈은 거절(Promise reject)이라 지금처럼 건너뛴다.
  - `import.meta` → `{ url: <페이지 기준 원래 경로> }` → `new URL('./ui.css', import.meta.url)` 가 원래 자리의 css 를 가리킨다 (css 4개는 그대로 따로 게시).
  - top-level await (지금 `src/data/tables.js` 하나)은 몸이 동기 함수로 안 읽히면 async 함수로 (`vm.Script` 로 가린다).
- `makeSrcPacks`: 갈래 = `src/<폴더>/` (main.js 는 core), 경로 순, 640 KB(`SRC_PACK_BYTES`) 를 넘으면 고른 크기로 나눔 → `packs/src-core-1.js` … `src-gameplay-3.js`. 폴더로 나눠서 한 곳을 고치면 그 갈래 묶음만 해시가 바뀐다.
- `srcRuntime` (페이지 인라인 `<script>`): `globalThis.__islandSrc = { def, run, status }`. `run(id)` 는 ES 모듈과 같은 순서 — 의존 모듈부터 import 순서대로, 한 번만, async 모듈은 기다림. 실패한 모듈은 같은 오류를 다시 낸다.
- 페이지: `<script type="module" src="src/main.js">` 자리에 실행기 + `<script type="module" id="island-src">import "./packs/src-…js"; … __islandSrc.run("src/main.js");</script>`. modulepreload 는 three 13 + 모듈 묶음 11. 로딩 화면 `CFG.js` = 모듈 묶음 수 (PerformanceObserver 가 같은 출처 .js 를 세는 것 그대로). **`tools/web-loader.html` · `src/core/packs.js` 는 고칠 것이 없었다** (에셋 묶음 목록 `island-packs` 도 그대로 — 모듈 묶음은 거기 안 들어간다).
- 개발 서버 `/index.html` 은 그대로 모듈 파일 하나씩.

### 빌드가 막는 것 (오류)
- 순환 import (가져간 값을 한 번 꺼내 두므로) — 지금 0.
- `export let|var`, `export { x }` 의 x 가 let/var (나중에 다시 넣으면 가져간 쪽이 못 봄) — 지금 0. const·함수로.
- `export *`, 못 읽은 export 문.
- 가져가는 이름이 그 모듈 내보내기에 없음 (ES 모듈은 링크 오류, 묶음은 조용히 undefined 라서 빌드에서 막는다).
- 바꾼 몸이 JS 로 안 읽힘.

## build.json · 다시 게시

- `build.json` `packs[]` 끝에 모듈 묶음도 들어간다: `{ path: 'packs/src-ui-1.js', boot: true, kind: 'src', count, bytes, hash, modules: [...] }`. 「`packs[].hash` 가 바뀐 묶음만」 다시 올리는 순서 그대로 — 모듈을 고치면 그 갈래 `src-*.js` 해시가 바뀐다. `git diff … -- src` 로 모듈을 고르던 단계는 이제 필요 없다 (css 4개만 `git diff … -- src/**/*.css`).
- 묶음 이름은 크기로 나뉘므로 gameplay 가 커지면 `src-gameplay-4.js` 가 새로 생길 수 있다 → 새 `files.json` 에 없는 `packs/…` 는 지운다 (지금처럼).

## 처음 게시 (조정 세션) — 옛 낱개 모듈 230개 지우기

지금 게임 링크 v46 에는 `src/**/*.js` 230개가 낱개로 있다. 새 빌드에는 없으니 지워야 한다 (안 지워도 게임은 돌지만 버전 파일 수가 남는다).

1. main 에서 `node tools/build-web.mjs` (게시 파일 41개, `files.json` 하나).
2. 지울 목록 — 둘 중 하나:
   - 정확한 길: `list_files`(게임 slug) 결과 글을 `dist/web/live.txt` 에 저장 → `node tools/build-web.mjs --live dist/web/live.txt` → `publish-1.json`(·`-2`)의 값이 `null` 인 경로가 지울 것 (옛 `src/*.js` + 바뀐 묶음 이름).
   - 빠른 길 (v46 뒤 모듈이 더해지거나 빠지지 않았으면 같음):
     ```bash
     node -e "const b=require('./dist/web/build.json');console.log(JSON.stringify(b.packs.filter(p=>p.kind==='src').flatMap(p=>p.modules)))" > dist/web/remove-src.json
     ```
3. 새 아티팩트 도구 `publish_files` **한 번**에: `files` = 페이지(CLAUDE.md 「새 아티팩트 도구로 게시할 때」대로 문서 틀을 씌운 `index.html`) + `files.json` 40개, `remove` = 위 목록 (230 ≤ 256). 파일·지우기가 한 버전에 같이 들어가 중간에 덜 된 링크가 생기지 않는다. 끝나면 `list_files` 가 41개인지.
   - 옛 Artifact 도구라면 `publish-1.json`, `publish-2.json` 차례 (지우기 먼저) — 중간 단계는 덜 된 상태.

## 확인한 것 (2026-11-18, 포트 4313)

- `node tools/build-web.mjs` 오류·주의·알림 0, 게시 파일 41개, 게시 묶음 1개.
- `/artifact/` (새 탭 한 번): 로딩 화면 → 「섬에 도착했어요!」, `__islandSrc.status()` = 정의 230 · 실행 230, 서비스 28개(data … lighthouse), 콘솔 오류 0, dev-server 로그에 목록 밖 요청 0.
- `node --test tests/build-web.test.mjs` 18/18 — 새 검사: 모든 모듈이 묶음에 한 번씩·크기 안·묶음 머리는 바깥 import 만·boot 가 10% 넘게 늘지 않음 / 바꾸기 + 실행기를 node 에서 돌려 기본·이름·별칭·namespace·옆 효과 import, 구조 분해·여러 개 export, `export { a as b }`, 다시 내보내기, top-level await, 동적 import 상대 경로, import.meta.url, 한 번만 실행, 없는 모듈 거절 / 못 다루는 모양은 오류.

## 확인하지 않은 것

- **실제 아티팩트에 올려 보지 않았다** (조정 세션). 볼 것: 인라인 `<script type="module">` 이 실제 프레임 CSP 에서 도는지 (지금 게시본의 인라인 로딩 화면·importmap 이 도니 `'unsafe-inline'` 은 있다고 봄), 콘솔 오류 0.
- 게임 안 기능별 확인(집·상점·장면·옷·투어 등)은 안 했다 — 모듈 230개가 모두 실행되고 서비스가 다 올라온 것까지만. 모듈 몸은 글자 그대로라 동작 차이는 import/export 바꾸기 쪽에서만 날 수 있고, 그건 빌드 검사(이름 맞추기·JS 읽기)와 단위 테스트로 본다.
- 휴대폰·`/artifact-frame`·`?nostorage`·느린 네트워크.
- 오류 스택의 파일 이름이 `packs/src-*.js` 로 보인다 (줄은 원본과 비슷하게 맞춰 둠, 묶음 안 `// ── src/…` 머리줄로 찾는다). 소스맵은 없다.

## 다른 세션에 알림

- `tools/playtest.mjs --target=artifact`·`check-*.mjs` 는 `dist/web` 을 그대로 열어서 고칠 것 없음.
- 새 모듈은 이제 마음껏 만들어도 된다 (게시 파일 수가 늘지 않는다). 다만 **`export let` 은 쓰지 말 것** (빌드 오류) — 바뀌는 값은 객체 칸이나 getter 함수로. 순환 import 도 빌드 오류.

## 문서 세션이 반영할 문장

- CLAUDE.md 「웹 배포」 첫 줄 바꾸기: "`node tools/build-web.mjs` → `dist/web/index.html`(뼈대 없는 페이지 + 로딩 화면 + 묶음 목록 + 모듈 실행기) · `packs/<갈래>-<n>.json`(에셋) · `packs/src-<폴더>-<n>.js`(모듈 묶음, M20-S3) · `files.json` (`dist/` 는 커밋하지 않는다). 게시 파일 41개라 한 번에 올라간다."
- CLAUDE.md 「웹 배포」에 한 줄 더하기: "src 모듈도 게시본에서는 **모듈 묶음** `packs/src-*.js` 로 올라간다 (M20-S3, `docs/notes/m20-pack.md`): 빌드가 import/export 를 등록 함수로 바꾸고 페이지의 인라인 실행기 `__islandSrc` 가 ES 모듈 순서대로 돌린다. 그래서 **`export let`·`export *`·순환 import 는 빌드 오류** (const·함수로). 개발 서버 `/index.html` 은 그대로 파일 하나씩."
- CLAUDE.md 「웹 배포」 다시 게시 줄: "`packs[].hash` 가 바뀐 묶음 + `git diff --name-only <지난 build 해시> HEAD -- src index.html` 의 모듈 + 페이지" → "`packs[].hash` 가 바뀐 묶음(에셋·모듈 `kind:'src'` 둘 다) + 바뀐 css + 페이지".
- `docs/notes/deploy.md` 「무엇을 넣나」 모듈 줄 끝에: "(M20-S3 뒤로는 모듈 묶음 `packs/src-*.js` 로 — m20-pack.md)".
- devlog 「게시물」: 다음 게시가 41개 첫 게시이고 옛 `src/*.js` 230개를 `remove` 로 지웠다는 것.
