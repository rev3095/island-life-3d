M7-P4 저장 옮기기 (UI-09, D43-A) · 문제 알리기 (UI-08, D46-A) — 브랜치 `p11-save` · 포트 4243. 여는 함수 `ctx.services.ui.transfer.open()` · `ctx.services.ui.report.open()`, 게임 저장소 `reports/<id>`.

# 저장 옮기기 · 문제 알리기 — 작업 노트

## 한 것

| 무엇 | 어디 |
|---|---|
| 저장 글 만들기·검사·써 넣기: `exportSave` · `parseSave` · `saveInfo` · `checksum`, `createSave` 에 `exportText()` · `importText(text)` · `held` | `src/data/save.js` |
| 오류 모으기: window `error`(스크립트 오류 + 파일 못 받음) · `unhandledrejection` · `console.error`(main.js 의 `[boot] … 초기화 실패` = 모듈 실패) → 최근 30개 | `src/core/errors.js` (새) |
| 저장 옮기기 창: 「저장 글 받기」(글 복사 + 글 상자 + 파일로 받기) / 「불러오기」(붙여 넣기 · 파일 고르기 → 검사 → 확인 창 → 써 넣고 다시 열기) | `src/ui/transfer.js` (새) |
| 문제 알리기 창: 무엇(5가지) + 글 + 「최근 오류·기기·판·지금 자리도 같이」 + 보낼 내용 미리 보기 → 보내기 / 글 복사 | `src/ui/report.js` (새) |
| 연결 (최소한, 합칠 때 볼 것 ↓) | `src/main.js` 3줄 · 두 창 파일의 `export function open(ctx, opts)` (P3 의 `src/ui/index.js` `EXTRA_PANELS` 가 불러온다) |
| 테스트 25개 (저장 글 12 · 오류·보고 13) | `tests/transfer.test.mjs` · `tests/report.test.mjs` |

### 다른 트랙 파일에 넣은 줄 (합칠 때 충돌 확인)
- `src/main.js`: `import { installErrors } from './core/errors.js';` + 모듈 맨 위 `const errors = installErrors();` + ctx 에 `errors,` 한 줄 (`services: {}` 바로 위). P2 가 main.js 그리기 부분을 고치면 줄이 겹치지 않는지만 본다.
- `src/ui/index.js` (P3 파일)는 **이 브랜치에서 고치지 않는다.** P3(`p11-access`)이 init 끝에 `EXTRA_PANELS = [['transfer', './transfer.js'], ['report', './report.js']]` 를 `import()` 해서 `ctx.services.ui.transfer / ui.report = { open: opts => mod.open(ctx, opts) }` 를 만들고 섬폰에 📦 저장 옮기기 · 📮 문제 알리기 줄을 단다. 그래서 두 파일은 `open(ctx, opts) → Promise` 를 내보낸다 (ctx 마다 창 하나, `WeakMap`). **이 브랜치만으로는 ui.transfer·ui.report 가 생기지 않는다** — p11-access 와 합친 뒤 생긴다. 합친 뒤 조정 세션은 `tests/build-web.test.mjs` 의 `PENDING_MODULES` 를 비우면 된다 (P3 부탁).
- `src/ui/panels.js`·`dom.js` 는 고치지 않았다 (`panelShell`·`button`·`h`·`fmt` 를 가져다 쓰기만). 창 모양 CSS 는 각 파일이 `<style data-pk-report>`·`<style data-pk-transfer>` 로 직접 붙인다 (`ui.css` 는 P3 것이라). 색·글꼴은 `--pk-*` 변수를 그대로 쓴다.

## 저장 글 모양 (내보내기)

```
# 포근섬 이야기 저장 — 포근섬 · 하늘 — 2026-10-31 12:24      ← 사람이 읽는 줄 ('#' 줄은 불러올 때 무시)
POGEUN-SAVE 1 2a2c89ea                                     ← 머리 줄: 표시 · 저장 버전(SAVE_VERSION) · 확인 값(FNV-1a 32비트, 16진 8자리)
eyJ2IjoxLCJzYXZlZEF0IjoxNzkzNDE3MDc5NjUyLCJleHBvcnRlZEF0Ijox…   ← base64(UTF-8 JSON), 76자씩
…
```
- 안의 JSON = `{ v, savedAt, exportedAt, build, state }` — localStorage `island-life-save-v1` 의 `{ v, savedAt, state }` 와 같은 모양 + 내보낸 때·빌드. `state` 는 `ctx.state` 통째 (createState 에 없는 모듈 칸 `mail` 같은 것도 같이 간다).
- 첫날 섬 하나의 저장 글이 약 3.5 KB (안의 JSON 약 2.5 KB). base64 줄은 영문·숫자뿐이라 메신저·메모장을 거쳐도 바뀌지 않는다 (설명 줄은 없어져도 된다).
- 불러올 때 견디는 것: 앞뒤 빈칸·빈 줄, CRLF, 줄 들여쓰기, BOM, '#' 줄 없음, base64 를 한 줄로 이은 것, **localStorage 저장 JSON 을 그대로** 붙인 것(예전 v0 형식 포함).

### 불러오기 검사 (`parseSave` → `{ ok, data, info, build }` | `{ ok:false, reason }`)
1. 빈 글 → 2. 머리 줄 `POGEUN-SAVE` (또는 `{` 로 시작하는 JSON) → 3. 저장 버전이 이 게임보다 크면 "더 새 버전" → 4. base64 풀기 → 5. 확인 값 (잘림·바뀜) → 6. JSON → 7. `migrate` (버전 올리기, 더 새 버전이면 거절) → 8. 모양 (`player`·`island`·`wallet` 객체, `inventory` 배열) → 9. `normalize` (모르는 아이템·음수 도토리 고치기). `reason` 은 화면에 그대로 보여 주는 한국어.

### 써 넣기 (`save.importText(text)`)
- 검사를 통과해야만 쓴다. 실패면 아무것도 안 쓰고 "지금 저장은 그대로예요" (= D43 "잘못된 글이면 지금 저장 지키기").
- 쓰기 전 지금 저장을 **`island-life-save-v1-before-import`** 에 사본으로 둔다 (한 칸, 마지막 것만). 되살리기 화면은 없다 — 필요하면 콘솔·다음 차수.
- `ctx.state` 는 바꾸지 않고 **페이지를 다시 연다** (`location.reload()`). 모듈마다 화면·모델·주민 자리를 상태와 따로 들고 있어서 그 자리에서 상태만 바꾸면 어긋난다. 다시 열기 전 자동 저장(pagehide·visibilitychange)이 새 저장을 덮지 않게 `held = true` (그동안 `save()` 는 쓰지 않고 `{ ok:true, held:true }`).
- 더 새 버전 저장 때문에 막힌 창(`blocked`)도 사용자가 고른 저장으로 풀린다 (막혀 있던 저장은 사본으로).
- 저장소가 없는 창(사생활 보호)은 불러오기 단추가 꺼지고 「저장 글 받기」만 된다.
- 이벤트: `save:imported { info }` (다시 열기 직전).

### 창에서
- 「글 복사」는 `navigator.clipboard.writeText`. 막힌 창이면 글 상자를 골라 두고 "길게 눌러(Ctrl+A, Ctrl+C) 복사"를 알려 준다.
- 「파일로 받기」는 **아티팩트에서 `downloads` 능력이 있을 때만** 보인다 (`claude.use('downloads')` → `save({ filename: 'pogeun-save-<섬>-<시각>.txt', data })`, 보는 사람에게 확인 창이 뜬다). 로컬(아티팩트 밖)은 `<a download>`. 없으면 단추를 숨긴다.
- 「파일 고르기」는 `<input type=file accept=".txt,.json,text/plain,application/json">` (4 MB 까지) → 글 칸에 넣고 「검사하고 불러오기」.
- 확인 창 (`ui.confirm`): 「포근섬 · 하늘」 · 도토리 · 가방 칸 · 기증 수 · 저장한 때 → 「바꾸고 다시 열기」/「그만두기」.

## 오류 모으기 (`ctx.errors`, `src/core/errors.js`)
- main.js 가 모듈을 불러오기 **전에** `installErrors()` → `ctx.errors`. 한 번만 걸린다 (다시 부르면 같은 기록장). 다른 모듈도 `ctx.errors.add(kind, value, { message, source, stack })` 로 직접 남길 수 있다.
- 항목 `{ kind, message, source, stack, at, count, last }` — kind `error`(스크립트) · `rejection`(약속 실패) · `resource`(img·script·link 파일 못 받음) · `module`(`[boot] …` console.error) · `console`(그 밖 console.error). 같은 kind·글·자리는 한 줄에 `count` 만 올리고 맨 뒤로 (매 프레임 나는 `[loop]` 오류가 30칸을 다 먹지 않게). 글 500자·스택 1200자, 페이지 주소 앞부분은 떼고 주소의 한글은 풀어 둔다.
- `console.error` 는 원래대로 찍힌다 (감싸기만). 모으기가 실패해도 조용히 넘어간다.
- 아직 안 모으는 것: 로딩 화면(`web-loader.html`)이 main.js 전에 보는 실패 — 그건 로딩 화면이 직접 보여 준다.

## 게임 저장소 `reports` 모양 (편집기 홈·"전체 요청 확인"이 읽는 것)

문서 경로 **`reports/<id>`**, id = `r<YYYYMMDD>-<HHMMSS>-<16진 4자리>` (예 `r20261031-122615-88d5`, 보낸 기기 시각, 이름순 = 시간순).

```js
{
  status: 'new',               // 'new' → (Claude) 'working' → 'done' | 'board'(보드 QA 칸으로 넘김) | 'dup'
  kind: 'stuck' | 'error' | 'save' | 'look' | 'other',   // 막혔어요 · 오류·멈춤 · 저장 · 보기·소리 · 그 밖
  text: '다리 앞에서 못 가요',   // 사용자가 쓴 글, 1000자까지 (비어 있을 수 있음)
  createdAt: 1793417175372,    // 창을 연 때 (ms)
  game: { build: 'b37e5ba 2026-10-31' | 'dev', saveVersion: 1, stateVersion: 1, page: '/…', artifact: true },
  errorTotal: 3,               // 이 페이지에서 난 오류 수 (같은 것 겹친 수 포함)
  reply: null,                 // Claude 답 (처리하면 글)
  // 「같이 보내기」를 끄면 아래 넷은 없다
  errors: [{ kind, message, source, count, at, stack? }],   // 최근 10개, 스택은 최근 3개만
  device: { ua, lang, screen: {w,h}, view: {w,h,dpr}, touch, quality: 'high'|'low', gpu, memory },
  place: { x, z, indoor, time: '2026-10-31 12:26', timeMode: 'real'|'fast', weather, story: '<장면 id>'|null, tool },
  progress: { player, island, acorns, days, firstday: ['<끝낸 단계 id>', …], firstdayFinished, museum },
}
```
- 한 문서 약 1–3 KB (256 KiB 한도에 넉넉). 사람 이름·이메일은 담지 않는다 (게임 안 플레이어·섬 이름만). 누가 보냈는지 알고 싶으면 P6 이 `user` 능력을 더하고 `by: await user.id()` 한 칸을 넣으면 된다 (지금은 안 넣음).
- 처리한 뒤 Claude 가 고쳐 쓰는 칸: `status`, `reply`, `doneAt`, `commit` (고친 커밋), `qa` (보드 QA-NN 으로 넘겼으면 그 번호).

### 보내는 순서 (`sendReport`)
1. 아티팩트: `claude.use('db')` (10초 기다림) → `db.doc('reports/<id>').set(doc)`.
2. 로컬 dev-server (`window.claude` 없음 + `/api/ping`): `POST api/db/game-reports` (`assets/review/game-reports.json`, 행마다 `docId`).
3. 둘 다 안 되면 (공유 링크로 들어와 `view` 인 사람, 로그인 안 함, 쓰기 거절): **실패 이유 + 같은 내용을 글로 복사** → "만든 사람에게 붙여 넣어 보내 주세요". 「글 복사」 단추는 언제나 있다 (보드 D46-B 와 같은 길).
- ⚠️ 아티팩트 규칙상 **공유 링크로 들어온 사람(Viewer·Commenter·조직 밖)은 db 에 쓸 수 없다** (`view` 는 읽기만). D36-A "게임만 링크 공유"로 받은 친구들의 문제는 저장소가 아니라 글 복사로 온다. 저장소에는 주인·편집자·조직 안 참여자(Contributor = `interact`) 것만 쌓인다.

## 부탁

### P6 조정 세션 (게임 다시 게시)
- 게임 capabilities 제안 (P2 기기 점검 저장과 합쳐서 한 번에):
  ```json
  { "db": { "rules": [ { "path": "reports", "read": "interact", "write": "interact" } ] }, "downloads": true }
  ```
  - `reports` 는 공유 링크 사람(`view`)에게 안 보이게 `read: "interact"` (쓰기 ≥ 읽기 규칙이라 write 도 interact). 서로의 보고를 고칠 수 있는 것까지 막으려면 「건의함」 모양(`{path:"reports", read:"admin", write:"self"}` + `{path:"reports/{self}", read:"interact", write:"interact"}`, 문서는 `reports/<user id>/items/<id>`)이 되지만 홈이 사람별로 찾아 읽어야 해서 지금은 위 간단한 것을 추천.
  - `downloads: true` 는 「파일로 받기」 단추용 (없으면 단추가 숨고 글 복사만). 둘 다 동의 창은 처음 쓸 때만 뜬다 (열 때 묻지 않음: 보고는 「보내기」를 눌러야 `use('db')`).
- 게시 뒤 확인: claude.ai 에서 문제 알리기 → 저장소 `reports` 읽기(Artifact `read_db`), 휴대폰에서 글 복사·파일 고르기, 다른 계정(공유 링크)에서 보내기가 글 복사로 넘어가는지.

### P3 (`p11-access`, 섬폰 메뉴 줄) — 섬폰 두 줄·불러오기는 P3 이 이미 넣음 (`EXTRA_PANELS`, 10-31 알림 받음)
- (넣음) 섬폰 메뉴에 두 줄: **「저장 옮기기」 → `ctx.services.ui.transfer.open()`** (`{ tab: 'export' | 'import' }` 선택, 기본 export) · **「문제 알리기」 → `ctx.services.ui.report.open()`** (`{ kind?, text? }` 로 미리 고를 수 있음). 둘 다 창이 닫히면 `null` 로 풀리는 Promise, 이미 열려 있으면 같은 Promise. 섬폰 창 위에 쌓여 열린다 (`ui.panel`).
- (P3 이 고침, p11-access 41d6980) `panels.js` 가 창 안 글 칸에서 방향키·toggleKey 를 가져가지 않는다. 이 트랙의 우회(`report.js` `textFieldKeys`, 두 창의 `onKey`)는 이 브랜치만 따로 돌 때를 위해 남겨 두었다 — 합친 뒤 조정 세션이 빼도 되고 남겨도 충돌 없음.
- (선택) 오류가 나면 HUD 에 작은 「문제 알리기」 알림: `ctx.errors.on(e => …)` 로 들을 수 있다.

### P2 (`p11-check`, 로딩 화면)
- `tools/web-loader.html` 에 `window.__islandBuild = CFG.build;` 한 줄 → 보고의 `game.build` 가 게시 빌드(커밋·날짜)가 된다 (없으면 `'dev'`).
- 기기 점검(`?check`) 저장도 같은 게임 저장소면 경로를 `reports` 와 다르게 (`checks/<id>` 등) 하고 규칙을 위 P6 묶음에 같이.

### 편집기 홈 세션 (`editors.html`)
- 홈 목록 `game` 항목 (`status:'new'` 인 것만 셈): `"reads": ["reports"]`, `"openLabel": "새 문제"`. 아티팩트는 다른 아티팩트 저장소를 못 읽으니, "전체 요청 확인" 때 Claude 가 게임 저장소 `reports` 를 `read_db query where status == 'new'` 로 읽어 → D47 대로 (막힘·저장·오류 = 그 자리에서 고침 → `status:'done'` + `reply` + `commit` / 밸런스·불편·보기 = 보드 wave7 QA 칸 → `status:'board'` + `qa`) → 홈 `status/game` 의 `open`·`openItems` (`{ id, kind, text 앞 40자, createdAt }`) 갱신.
- 로컬 흉내는 `assets/review/game-reports.json` (행마다 `docId`).

### 첫날 안내 (P5 `p11-tune`, 선택)
- 새 기기에서 이름 정하기 창이 먼저 뜬다. 거기에 「다른 기기 저장 불러오기」 작은 링크(`ui.transfer.open({ tab: 'import' })`)가 있으면 옮겨 오는 사람이 이름을 새로 정하지 않아도 된다 (지금도 창은 이름 정하기 위에 열리고, 불러오면 다시 열려서 이름 정하기가 건너뛰어진다 — 확인함).

## 확인
- `node --test tests/` 287 통과 (새 26).
- dev-server 4243 `/index.html` (미리보기 창이 숨겨져 rAF 대신 `ctx.step` 으로 돌림):
  - 이름 정하기(하늘·포근섬) → 사과 5·붕어 1·도토리 +777·플래그 → 「저장 옮기기」 글 복사 → 글 3462자 → 저장 지우고 새 게임(도토리 500, 이름 없음) → 「불러오기」에 잘못된 글 → "확인 값이 달라요 … 지금 저장은 그대로예요" → 진짜 글 → 확인 창 「포근섬 · 하늘 · 도토리 1,277 · 가방 4칸」 → 다시 열림 → **`ctx.state` 가 내보내기 때와 칸마다 같음 (차이 0)**, 사본 `-before-import` 있음, 이름 정하기 건너뜀.
  - 일부러 낸 오류 3개 (setTimeout throw · Promise.reject · 없는 그림) → 문제 알리기 창이 「오류·멈춤」을 미리 고르고 "최근 오류 3개" → 글 칸에서 방향키·Enter 가 글 편집으로 → 보내기 → `assets/review/game-reports.json` 에 위 모양 문서 (1.3 KB).
  - 새로 연 페이지에서 `ctx.errors` 0개 (= console.error 0), 두 창 열고 닫기 정상. 휴대폰 폭 375 에서 두 창 가로 넘침 없음.
  - 웹 빌드 `node tools/build-web.mjs` → `/artifact/`: 새 모듈 3개가 들어가고 `ui.transfer`·`ui.report` 있음, 오류 0, 같은 저장 이어짐.
- P3 와 합친 모습 (10-31, 이 브랜치 97d6748 + p11-access 작업 폴더의 커밋 전 변경을 임시 작업 트리에 얹어서): `node --test tests/` 295 통과, 섬폰 📦·📮 줄이 보이고 누르면 섬폰 위에 저장 옮기기·문제 알리기 창이 쌓여 열리고, 닫으면 섬폰으로 돌아옴, 오류 0. (섬폰은 연 지 160ms 안의 누르기를 무시한다 — 정상.)
- 못 한 것: **클립보드 복사 성공** (숨은 미리보기 창은 클립보드가 막혀 대신 글 상자 고르기로 넘어가는 것만 봄 — 보이는 브라우저에서 확인 필요), claude.ai 에서 `reports` 쓰기와 `downloads` 확인 창 (게임 capabilities 는 P6), 휴대폰의 파일 고르기, 다른 계정(공유 링크)에서 글 복사로 넘어가기.
