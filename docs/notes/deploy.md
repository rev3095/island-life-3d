# X4 웹 배포 (p6-deploy) 노트

게임을 claude.ai 아티팩트 **페이지 하나 + 파일들** 로 묶는 빌드. 게시(publish)는 조정 세션이 모든 트랙을 `main` 에 합친 뒤에 한다.

## 빌드

```bash
node tools/build-web.mjs           # dist/web/ 에 쓴다. 오류가 있으면 쓰지 않고 exit 1
node tools/build-web.mjs --check   # 쓰지 않고 검사·표만
node --test tests/build-web.test.mjs
```

결과물 (`dist/web/`):

| 파일 | 내용 |
|---|---|
| `index.html` | 게시할 페이지. `index.html` 을 바탕으로 만든다 (뼈대 없음, 로딩 화면·modulepreload 넣음) |
| `files.json` | 게시 경로 → 원본 경로 (저장소 루트 기준, 둘이 같다). Artifact `files` 인자에 그대로 넣는다 |
| `files-1.json`, `files-2.json` … | 255개가 넘을 때만: 한 번에 올릴 묶음 (첫 묶음 254개 = 페이지 자리 하나 비움, 다음부터 255개, 64MB 씩) |
| `build.json` | 요약: 빌드 해시·파일 수·용량·묶음·묶음별 표·큰 파일·외부 모듈·주의 |

**`dist/` 는 커밋하지 않는다** (`dist/.gitignore`). 파일 목록은 다른 트랙이 파일을 더하면 바로 낡는다 → 게시 직전에 늘 새로 빌드한다. 빌드는 1초 안에 끝나고 결과가 소스에서 정해진다.

### 무엇을 넣나

- **모듈**: `src/main.js` 에서 닿는 모든 것 — 정적 `import`/`export … from`, `import('…')`, 그리고 `'./x/index.js'` 처럼 상대 경로로 적힌 글자(MODULES·PARTS 표, `new URL('./ui.css', import.meta.url)`). css 안의 `url()`·`@import` 도. 데모 전용(`src/audio/levels.js`)은 안 닿아서 빠진다.
- **에셋**: 목록(index.json)의 slug 마다 정해진 파일 (`FAMILIES` 표):
  - 배경 `assets/env/models/<slug>.glb.json` + `assets/env/specs/<slug>.json`
  - 캐릭터 `assets/models/<slug>.glb.json` + `assets/specs/<slug>.json`
  - 가구 `assets/furniture/models/<slug>.glb.json` + `specs/<slug>.json` + `renders/<slug>_thumb.png` (가방 아이콘)
  - 모듈 코드 안에 글자 그대로 적힌 `assets/…` 경로
- **빼는 것**: `.glb`(아티팩트가 못 올림), `.stats.json`, 렌더(썸네일 말고), `.blend`, 편집기·데모 페이지.
- 외부: three 는 importmap 그대로 jsdelivr (`three@0.170.0`, 12개 파일을 modulepreload). 글꼴은 Google Fonts.

### 지금 파일 표 (326b8bc 기준, 3차 트랙 합치기 전)

| 묶음 | 개수 | 용량 |
|---|---:|---:|
| 모듈 (js) | 105 | 788.9 KB |
| 스타일 (css) | 1 | 26.4 KB |
| 캐릭터 모델 | 9 | 4.03 MB |
| 배경 모델 | 32 | 1.32 MB |
| 가구 모델 | 20 | 1.48 MB |
| 가구 썸네일 | 20 | 402.3 KB |
| 목록 (index.json) | 3 | 15.6 KB |
| 스펙 (json) | 61 | 81.0 KB |
| 페이지 index.html | 1 | 23.9 KB |
| **합계** | **252** | **8.14 MB** |

가장 큰 파일은 캐릭터 모델 (`neuru` 501 KB, `mochi` 492 KB, `coco` 481 KB …). 파일당 16 MB·한 번 64 MB·버전당 256 MB 와는 거리가 멀다.
**개수가 아슬아슬하다**: 255 - 252 = 3. X3 가 `src/gameplay/intro/` 에 파일 몇 개만 더해도 255 를 넘어 묶음 두 개(`files-1.json`, `files-2.json`)로 나뉜다. 빌드가 알아서 나누고, 버전당 511 개까지는 괜찮다.

## 페이지

- 아티팩트가 `<!doctype html>…<head>…</head><body>` 뼈대를 씌우므로 `<html>`·`<head>`·`<body>`·doctype 없이 쓴다. 맨 앞에 `<title>포근섬 이야기</title>` (아티팩트 이름), 그다음 `index.html` 의 viewport meta(`viewport-fit=cover`, X1 이 정한 값), 나머지 `<head>` 내용(글꼴·`<style>`·importmap) 그대로, 그다음 modulepreload, 본문.
  - `index.html` `<head>` 를 X1 이 바꾸면 다음 빌드에 그대로 따라온다 (charset·title·viewport 만 따로 다룸).
- **modulepreload**: main.js 는 모듈을 하나씩 `await import` 하므로 받기가 줄줄이 늘어진다. 닿는 js 105 개와 three 12 개를 미리 알려 한꺼번에 받게 했다 (importmap 뒤에 있어야 한다 — 앞에 있으면 Chrome 이 importmap 을 무시).
- 모듈·fetch 는 상대 경로 그대로 (`src/main.js`, `assets/…`). 게시 경로 = 저장소 경로라 페이지 옆에 같은 모양으로 놓인다. `/` 로 시작하는 경로는 코드에 없다 (확인함).
- 페이지는 생성물이다. 고칠 곳은 `index.html` (X1), `tools/web-loader.html` (로딩 화면), `tools/build-web.mjs`.

### 로딩 화면 (`tools/web-loader.html`)

게임 코드는 건드리지 않고 지켜보기만 한다.

- 하늘색 막에 작은 섬 그림·게임 이름·도토리가 굴러가는 진행 막대·단계 글·파일 수·저장 안내.
- 진행 = 받은 모듈 js 수(PerformanceObserver, 같은 출처 `.js`) + 받은 에셋 수(`assets.js` 의 `island:load`) ÷ 처음에 받을 어림값(빌드가 넣음: js 105 + 에셋 83 — 실제로 잰 값과 같다), 모듈 단계(`ctx.services` 에 data·time·world… 가 올라오는 것)로 조금 더. `game:ready` 에 100%.
  - 단계 글: 아이템 도감을 펼치는 중 → 하늘과 시계를 맞추는 중 → 섬 땅을 고르는 중 → 주인공을 깨우는 중 → 섬폰을 켜는 중 → 악기를 조율하는 중 → 주민들을 부르는 중.
  - `window.__island = ctx` 가 들어오는 순간(속성 setter) `game:ready` 를 듣는다 — 놓칠 일이 없다.
- **실패하면** 막대가 갈색이 되고 이유 + **다시 시도**(새로고침):
  - main.js 가 남기는 `.core-check`("시작하지 못했어요: 불러오기 실패 (404): assets/…"),
  - `<script type="module">` 받기 실패, ctx 가 생기기 전의 오류,
  - `game:ready` 의 `modules` 에 main.js MODULES 중 빠진 것이 있을 때 (네트워크로 모듈 import 가 실패하면 main.js 는 조용히 건너뛰므로) → "섬의 일부를 불러오지 못했어요 — 섬, 소리" + **이대로 할래요**,
  - 에셋이 끝내 안 받아진 게 있을 때 → "파일 N개를 받지 못했어요" + **이대로 할래요**.
  - 20초 동안 진행이 없으면 "조금 오래 걸리고 있어요" + 다시 시도 단추 (기다리면 계속 된다).
- **소리 안내**: 막이 걷힐 때 소리가 아직 잠겨 있으면(`audio.unlocked`) 위쪽 HUD 바로 아래 가운데에 한 줄. 휴대폰 "화면을 한 번 누르면 소리가 켜져요", 컴퓨터 "화면을 한 번 클릭하면 소리와 키보드가 켜져요" — claude.ai 안(iframe)에서는 한 번 클릭해야 키 입력도 게임에 들어온다 (로컬 iframe 으로 확인). 소리가 켜지면 사라진다. `#ui` 바로 앞에 두어 대화·창이 덮는다.
- 저장 안내: 막 아래 "진행은 이 기기의 이 브라우저에만 저장돼요." / 저장소가 막힌 창이면 "이 창에서는 저장할 수 없어요. 닫으면 처음부터 다시 시작해요." (경고색).
- 한 가지 모양(하늘·크림·갈색 글씨)으로 고정 — 게임 화면과 같은 세계라 어두운 테마를 따로 두지 않았다. 움직임 줄이기 설정이면 섬 흔들림·막 사라짐 효과를 끈다.

## 저장

- 저장은 이미 `src/data/save.js` 가 try/catch 로 감싸 있다: `defaultStorage()` 가 써 보기까지 해서 안 되면 `null`, `save()` 는 `false`, `load()` 는 새 게임, 예외를 내지 않는다. **고칠 것 없음** — 막힌 창에서 실제로 확인했다 (아래).
- 아티팩트의 localStorage 는 아티팩트마다 따로이고 **같은 링크로 다시 게시해도 남는다**. 새 링크로 게시하면 모두 처음부터 → 고칠 때는 꼭 같은 `url` 로 다시 게시.
- 저장 시점: 게임 시간 몇 분마다 + 탭이 숨을 때(`visibilitychange`) + `pagehide`. 아티팩트가 새 버전을 열린 화면에 넣을 때 새로고침하면 `pagehide` 로 저장된다 (아티팩트의 `window.claude.hot` 은 쓰지 않았다 — 아래 '못 한 것').

## `src/core/assets.js` 바꾼 것

- `loadStats = { started, done, failed, failedUrls }` 내보내기 + 바뀔 때마다 `window` 에 `CustomEvent('island:load', { detail: { …loadStats, url, ok } })` (캐시에서 꺼낸 건 세지 않음). 로딩 화면이 듣는다.
- 받기 실패 다시 하기: 네트워크 끊김·5xx·408·429·덜 받은 JSON 은 0.4초·1.5초 쉬고 두 번 더. 404 등은 바로 실패.
- **실패한 받기는 캐시에 남기지 않는다** (`loadJSON`, `loadModel`) — 예전에는 한 번 실패하면 같은 경로가 계속 실패했다. 이제 나중에 다시 부르면(집에 다시 들어갈 때 가구 등) 다시 받는다.
- base64 풀기: `Uint8Array.fromBase64` 가 있으면 그것, 없으면 한 글자씩 도는 반복문 (예전 `Uint8Array.from(atob(), fn)` 보다 빠르다). 결과는 같다.
- 계약 제안 (CONTRACTS `assets` 줄에 덧붙이기): `loadStats`, window 이벤트 `island:load`, "실패는 캐시하지 않음".

## 로컬에서 아티팩트처럼 열기 (`dev-server.mjs`)

`node tools/build-web.mjs` 뒤에 `node dev-server.mjs --port=4198`:

| 주소 | 내용 |
|---|---|
| `/artifact/` | `dist/web/index.html` 에 아티팩트 뼈대(charset·viewport·`:root` safe-area 여백·`[hidden]` 규칙)를 씌워 **하위 경로**에서 연다. CSP 는 dev-server 것 그대로. **`files.json` 에 있는 파일만** 내주고, 없는 파일은 404 + 서버 로그 `[artifact] 게시 목록에 없는 파일: …` |
| `/artifact/?nostorage` | localStorage 를 읽기만 해도 `SecurityError` 가 나는 창 흉내 |
| `/artifact-frame` | claude.ai 처럼 iframe 안에서 연다 (`?nostorage` 도 넘김) |

(실제 아티팩트에서는 주소의 `?…` 가 페이지에 안 넘어온다. `?debug` 등은 로컬에서만.)

## 게시 순서 (조정 세션)

1. 3차 트랙을 모두 `main` 에 합친 뒤 main 작업 폴더에서:
   ```bash
   node --test tests/
   node tools/build-web.mjs
   ```
   오류 없이 끝나야 한다 (exit 0, "오류:" 줄 없음). 표에서 묶음 수를 본다.
2. 로컬 확인: `node dev-server.mjs` → `http://localhost:4180/artifact/` — 섬이 뜨고, 서버 로그에 `[artifact] 게시 목록에 없는 파일` 이 없고, 콘솔 오류가 없을 것. 집에 한 번 들어가 가구 모델·썸네일도.
3. **첫 게시** — Artifact 도구:
   - `file_path`: `dist/web/index.html`
   - `files`: `dist/web/files.json` 내용 그대로 (묶음이 여럿이면 `dist/web/files-1.json`). 모양 `{ "src/main.js": "src/main.js", … }` — 값은 작업 폴더 기준 원본 경로.
   - `icon`: `game`
   - `description`: `브라우저에서 바로 하는 3D 섬 생활 게임 — 채집, 주민, 가게, 집 꾸미기`
   - 제목은 페이지의 `<title>포근섬 이야기</title>` 이 된다.
4. 묶음이 더 있으면 **같은 대화에서 같은 `file_path`** 로 다시 publish 하며 `files` 에 `files-2.json`, `files-3.json` … 내용. 고친 버전에 파일이 더해지고 앞 묶음 파일은 남는다 (빠진 파일은 지워지지 않음). 마지막 묶음 전에는 링크가 덜 된 상태다.
5. 게시 뒤: Artifact `open` 으로 열어 로딩 화면 → 섬, 한 번 클릭 → 소리·키보드. 휴대폰 앱에서도 한 번.
6. **다시 게시** (고친 뒤): 다른 대화에서는 `url` 로 먼저 `read` → 같은 `url` 로 publish (같은 링크 = 플레이어 저장이 남는다). `build.json` 의 `build` 해시를 devlog 에 적어 두면 다음엔 `git diff --name-only <해시> HEAD` ∩ `files.json` 만 올려도 된다 (나머지는 남는다). 없어진 파일은 `files` 에 `"경로": null`.

## 확인한 것

로컬 `node dev-server.mjs --port=4198`, 미리보기 브라우저(창 숨김 상태라 프레임은 `ctx.step()` 으로 직접 돌림):

- `node tools/build-web.mjs` → 252 개·8.14 MB, 묶음 1 개, 오류·주의 없음. `.glb` 0 개.
- `/artifact/` (뼈대·하위 경로·`files.json` 에 있는 것만): 로딩 화면 → 섬. 서버 로그에 목록 밖 요청 **0 건**, 콘솔 오류 0. 같은 출처 요청 189 개 = js 105 + 에셋 83 + css 1 (`loadStats` started 83 = done 83, failed 0).
- 걷기: D 키로 1.76 칸 이동 → `save()` true → 새로고침 → 같은 자리(-0.24, 21.5)에서 이어짐, 지갑·가방도 그대로.
- `/artifact/?nostorage`: 로딩 화면이 경고 문구, 게임 전부 뜸(서비스 11 개), 걷기 됨, `save.available` false·`save()` false, 콘솔 오류 0.
- 파일 하나를 목록에서 빼고(나무 모델) 열기: 404 는 다시 받지 않고 바로 실패, 로딩 화면이 "게임을 시작하지 못했어요 / 불러오기 실패 (404): assets/env/models/tree.glb.json" + 다시 시도.
- 휴대폰 크기 375×812: 로딩 화면 한 줄 폭 맞음, 게임에서 조이스틱·A/B 보임, 소리 안내가 HUD 아래 한 줄 (조이스틱·도구 단추와 안 겹침). 밤톨 첫 안내 대화 끝까지 넘긴 뒤 조이스틱으로 4.6 칸 이동. 화면 한 번 누르면 `audio.unlocked` true·안내 사라짐. `quality` low.
- `/artifact-frame` (iframe): 섬 뜸. 클릭 전에는 키 입력이 게임에 0 번, 클릭 뒤 1 번 들어오고 소리 켜짐 → 안내 문구에 키보드를 넣은 이유.
- 원래 `index.html` 도 그대로 뜬다 (assets.js 바뀐 뒤).
- `node --test tests/` 123/123 (원래 114 + `build-web.test.mjs` 9).

## 못 한 것

- **실제 claude.ai 아티팩트에는 올려 보지 않았다** (조정 세션 몫). 뼈대가 본문에 있는 viewport meta 를 어떻게 다루는지, 실제 CSP 에서 modulepreload, 실제 iframe 의 sandbox 는 게시 뒤 확인.
- 진짜 휴대폰 기기 (흉내 낸 375×812 만), 느린·끊기는 네트워크 (404 실패 길만 확인, 5xx 다시 받기는 직접 못 돌림), 실제 로딩 시간.
- 아티팩트 `window.claude.hot` (열린 화면에 새 버전 넣기) 연결 — 화면을 새로 띄우면 `pagehide` 저장으로 충분하다고 보고 넣지 않았다. 게시 뒤 열린 화면이 새 버전을 받을 때 진행이 남는지 한 번 볼 것.
- 3차 다른 트랙이 합쳐진 모습. 합친 뒤 **꼭 다시 빌드** (파일 수가 255 를 넘을 가능성이 크다).

## 다른 트랙에 부탁

- **X1 (ui)**:
  - 섬폰 설정(또는 저장 안내 자리)에 "진행은 이 기기의 이 브라우저에만 저장돼요" 한 줄. `ctx.services.data.save.available === false` 면 시작할 때 한 번 알림 "이 창에서는 저장이 안 돼요 — 닫으면 처음부터예요" (`save:done {ok:false}` 도 같이).
  - 로딩 화면의 소리 안내는 화면 위 `118px + safe-area` 가운데에 뜬다 (HUD 시계·도토리·단추 줄 바로 아래). HUD 높이를 바꾸면 알려 주거나 `tools/web-loader.html` 의 `#sound-hint` `top` 을 같이 맞춰 달라.
  - 가장자리 컨트롤이 모두 safe-area 를 쓰면 `index.html` `<head>` 에 `<meta name="claude:viewport-fit-sides" content="cover">` 를 넣어도 된다 (가로 휴대폰에서 노치 아래까지 그림). 빌드가 그대로 옮긴다.
  - 브라우저 `alert`·`confirm`·`prompt` 는 아티팩트에서 동작하지 않는다 (지금 코드엔 없음).
- **X3 (첫날)**: 이름 정하기는 `prompt()` 말고 자기 DOM 입력칸으로 (아티팩트에서 `prompt()` 는 바로 null). `src/gameplay/index.js` PARTS 에 `intro` 줄을 넣으면 빌드가 저절로 따라간다 (폴더가 없으면 테스트가 주의로 막는다). 그림 파일을 새로 쓰면 코드에 `'assets/…png'` 처럼 경로를 글자 그대로 적거나 X4 에 알려 달라.
- **X2 (성능·섬)**: 새 에셋(텍스처 등)을 계산된 경로로 읽으면 빌드가 못 찾는다 → 글자 그대로 적거나 `tools/build-web.mjs` 의 `FAMILIES` 에 더해 달라. 모듈은 import 그래프로 자동.
- **모두**: 합치기 전에 `node tools/build-web.mjs --check` 와 `/artifact/` 로 목록 밖 요청이 없는지 한 번.
