# M7-P3 휴대폰·접근성 (p11-access) — 한 일·설정 키·P4 연결 약속

브랜치 `p11-access` (main b37e5ba 에서), 포트 4242. 보드 wave7 반영 v1 의 **D38-A**(최근 4년 휴대폰, 가로·세로 둘 다)·**D42-A**(접근성 기본 묶음 = UI-10 「보기 편하게」), 그리고 QA-12.
고친 곳: `src/ui/` (새 `access.js`), `src/core/input.js`, `src/player/camera.js`, `src/gameplay/festival/talkui.js`·`festival.css`, 테스트 `tests/access.test.mjs`(새)·`tests/build-web.test.mjs`(P4 대기 모듈 표 한 줄).

## 한 일

### 1. 휴대폰 (D38-A)
- **세로 화면 시야** (`src/player/camera.js` `portraitView(aspect)`): 화면 비율이 1 아래로 내려갈수록 세로 시야각 32° → 최대 46°, 카메라 거리 ×1.1, 내려다보는 각 +4°. 375×812·390×844(비율 0.47 아래)에서 끝까지 걸린다. 375×812 에서 플레이어 자리 좌우 폭이 예전의 약 1.6배 (예전엔 집 한 채 폭 → 지금은 양옆 집·주민이 같이 보임). 가로 화면·데스크톱은 그대로. 집 안(INDOOR)에도 같이 걸린다 (중심 네모는 그대로). 처음엔 거리를 ×1.25 로 늘렸는데 광장에서 카메라 앞 무대 지붕(QA-03)이 화면 아래를 더 가려서, 거리는 조금만 늘리고 시야각으로 넓혔다 — QA-03 자체(가림 투명이 카메라→플레이어 선만 봄)는 world 몫으로 남는다.
- **터치 패드·A·B** (`src/core/input.js`):
  - A·B 는 보이는 원보다 10px 넓게 눌린다 (`.tc-btn::before`) — 가장자리를 스쳐도 눌림. B 의 넓힌 자리도 패드 영역(왼쪽 46%) 밖.
  - 가로 휴대폰(높이 560 아래): 엄지가 쉬는 높이로 패드·B +14px, A +18px. `ui.css` 의 도구 단추도 148 → 168px.
  - A·B 밑 글자는 글자 배율을 따른다 (최대 1.2배, 원 안에 들어가게).
  - 달리기(손잡이 주황)는 '모양으로도 보기'를 켜면 `»` 표시도.
- 확인: 머리 없는 Chrome 375×812(터치·픽셀 2배)·812×375(터치)·1280×800 스크린샷, `node tools/playtest.mjs --mobile --only=boot,naming,arrival,clock,fd-tool` 5/5 통과·콘솔 오류 0.

### 2. 섬폰 「보기 편하게」 앱 (UI-10, D42-A)
섬폰 첫 화면에 👓 **보기 편하게** 앱 (`src/ui/phone.js` `accessScreen`). 바꾸면 바로 걸리고 다른 설정처럼 저장된다.

| 줄 | 설정 키 (`state.settings`) | 값 · 기본 | 하는 일 |
|---|---|---|---|
| 글자 크기 | `textSize` | `'normal'`(1) · `'large'`(1.15) · `'huge'`(1.3), 기본 normal | `<html style="--pk-fs">` 배율. ui.css·festival.css 의 글자 크기가 모두 `calc(Npx * var(--pk-fs, 1))` (고정 칸 안의 그림 이모지·시계 큰 숫자는 그대로) |
| 모양으로도 보기 | `shapes` | true/false, 기본 false | `<html class="pk-shapes">`: 스위치 안에 켬/끔, 고른 탭·나눔 단추 ✓+테두리, 재료 ✓/✗, 상점 '✗ 모자라요', 가방 경고 ⚠, 고른 칸 테두리 두 겹, 진행 막대 빗금, 이모티콘 고른 묶음 굵은 밑줄, 달리기 » |
| 흔들림 줄이기 | `calm` | true/false, **정하지 않으면(undefined) 기기 설정** `prefers-reduced-motion` | `<html class="pk-calm">` 이면 ui·축제 대화·터치 조작의 움직임·튀는 효과(토스트 튀어오름·도토리 펄쩍·말풍선 팝·칸 흔들기)를 끔, 카메라 앞보기 0.34 → 0.12 (방향을 바꿀 때 화면이 덜 쏠림). 끄면 `pk-calm-off` (기기 설정을 이김) |
| 이모티콘 뜻 보기 | `emoteText` | true/false, 기본 false | `<html class="pk-emote-words">`: 주민 말풍선 밑에 뜻 줄(`손 흔들기, 마음`), 선택기 묶음 탭·이모티콘 칸·대답 고르기 밑에 이름 |
| 소리를 글자로 | `soundText` | true/false, 기본 false | `sfx` 이벤트를 화면 자막으로 (`src/ui/access.js` `SOUND_CAPTIONS` 19개 — 입질 '덥석! 지금 당겨요'·벌 '윙윙 — 도망쳐요'는 크게·오래, 발소리·메뉴 딸깍·가방은 뺌, 같은 소리는 ×2 로 묶음, 최대 3줄). 자리: 화면 아래 가운데(세로 휴대폰은 A·도구 단추 위, 가로는 패드와 B 사이), 창·대화 중엔 위로 |

- 풀이·적용은 `src/ui/access.js` (`resolveAccess(settings, 기기 움직임 줄이기)` → `applyAccess`), ui 가 init·설정 바꿀 때·`data:loaded`·기기 설정이 바뀔 때 다시 건다.
- 서비스 추가: `ctx.services.ui.access` (지금 걸린 값 `{ textSize, scale, shapes, calm, emoteText, soundText }`, camera 가 `calm` 을 본다) · `ctx.services.ui.setSetting(key, value)` (state.settings + `settings:changed` — 섬폰 밖에서 바꿀 때).
- **바뀐 것 하나**: 예전엔 ui.css 의 `@media (prefers-reduced-motion: reduce)` 가 직접 움직임을 껐다 → 이제 `.pk-calm` class 로 (기본값이 기기 설정이라 처음 모습은 같고, 섬폰에서 끌 수도 있다). festival.css·input.js 는 ui 가 없는 페이지(데모)를 위해 `@media` 도 남기고 `html:not(.pk-calm-off)` 로 감쌌다.

### 3. 섬폰에 P4 창 두 줄
- 섬폰 앱 표 `APPS` 에 📦 **저장 옮기기**(`panel: 'transfer'`)·📮 **문제 알리기**(`panel: 'report'`). `visibleApps(ui)` 가 `ctx.services.ui.transfer/report.open` 이 있을 때만 줄을 보인다 → P4 가 합쳐지기 전엔 7개, 뒤엔 9개(세로 3×3, 가로 6+3).
- 누르면 섬폰은 열린 채 그 위에 `ui.<이름>.open()` (닫으면 섬폰으로 돌아옴). 던지거나 실패해도 섬폰은 그대로 (`console.error` + 알림).
- 섬폰 첫 화면 방향키 이동이 칸 수를 css 에서 읽는다 (가로 휴대폰 6칸에서 위아래가 어긋나던 것).

### 4. QA-12 · 축제 대화창
- "잘 가" 단추 그림을 인사 탭의 손 흔들기와 다른 **열린 문 + 나가는 화살표**로, 밑에 '그만' 글자 (`talkui.js` `ICON.bye`).
- 보내기 단추: 칸이 비면(= 기다리기) 색(파랑)만 바뀌던 것 → 그림도 모래시계, 글자 '기다리기'/'보내기', 화면 읽기 이름도 상태대로.

### 5. 겸사겸사 고친 것
- 섬폰 설정 화면 '생일' 아래에 **`false` 글자가 보이던 것** (`birthdayRows` 의 `replaceChildren` 이 `false` 를 글자로 씀 — 오늘 생일인 주민이 없을 때마다).

## P4(M7-P4 p11-save)와의 연결 약속
- `src/ui/index.js` `EXTRA_PANELS = [['transfer', './transfer.js'], ['report', './report.js']]` — ui init 끝에 기다리지 않고 `import()`. 없으면 건너뛴다 (개발 서버에선 네트워크 404 줄 두 개가 콘솔 '불러오기 실패'로 찍힌다 — JS 오류는 아니고 P4 를 합치면 사라진다).
- 모듈 모양: **`export function open(ctx, opts) → Promise`** (또는 `export default { open(ctx, opts) }`). ui 가 `ctx.services.ui.transfer = { open: opts => open(ctx, opts) }` 를 만든다. 모듈이 스스로 `ctx.services.ui.<이름>.open` 을 채웠으면 그것을 쓴다.
- 창은 `ctx.services.ui.panel(name, root, opts)` 로 (섬폰 위에 쌓인다). 섬폰 줄 이름·아이콘은 P3 몫 (`phone.js` `APPS`).
- 웹 빌드: `'./transfer.js'` 글자를 `tools/build-web.mjs` 가 읽어 파일이 있으면 게시 목록에 넣는다. 합치기 전 테스트를 위해 `tests/build-web.test.mjs` 에 **`PENDING_MODULES`** (두 파일이 없을 때만 '없는 모듈 글자' 주의를 봐줌) — **P4 를 합친 뒤 조정 세션이 비운다** (hub 테스트의 `PENDING_BOARDS` 와 같은 방식).
- P4 세션에 같은 내용을 메시지로 보냈다 (10-31).
- P4 답 (p11-save 97d6748): `open(ctx, opts)` 로 맞췄고 `src/ui/index.js` 는 안 고친다. 옵션 transfer `{ tab: 'export'|'import' }`, report `{ kind?, text? }`. 두 작업 폴더를 얹어 node --test 295 통과·섬폰 📦·📮 → 창이 쌓여 열림 (P4 확인).
- P4 부탁으로 `src/ui/panels.js`: 창 안 **글 칸**(text input·textarea)에선 방향키가 글자 사이를 옮기고, 창 여닫는 글자 키(섬폰 P 등)가 창을 닫지 않는다 → report.js 의 `textFieldKeys` 우회는 합친 뒤 빼도 된다.

## 계약 제안 (CONTRACTS.md 「7차」에 넣었으면 하는 것)
1. `state.settings` 칸 더하기: `textSize` · `shapes` · `calm` · `emoteText` · `soundText` (주인 ui). `calm` 은 undefined = 기기 설정.
2. `<html>` 표시: `--pk-fs` 글자 배율, `data-pk-text`, class `pk-shapes` · `pk-calm`/`pk-calm-off` · `pk-emote-words` · `pk-sound-words`. #ui 에 DOM 을 붙이는 모듈의 css 는 이것을 따른다.
3. `ui.access` (읽기) · `ui.setSetting(key, value)` · `ui.transfer.open()` · `ui.report.open()` (P4 창이 있을 때).

## 다른 트랙에 부탁 (고치지 않음)
- **intro·story css** (`src/gameplay/intro/`, `src/gameplay/story/story.css`): 글자 크기를 `calc(Npx * var(--pk-fs, 1))` 로, `@media (prefers-reduced-motion)` 대신(또는 같이) `.pk-calm` 을 따르게. 지금은 이름 정하기 창·장면 글자가 「글자 크기」를 안 따른다.
- **festival talk.js** (주민 몸짓 `MOTION`): `ctx.services.ui.access?.calm` 이면 고개 젓기·흔들기 폭을 줄이기.
- **render (P2)**: 바람·물결 흔들림을 `calm` 일 때 줄일지 — 스타일 값이라 보드로.
- 소리 자막에 **배경음 이름**(지금 무슨 곡인지)·**주민 목소리**를 넣을지는 다음 보드 의견으로 (지금은 효과음만; 주민 말은 이미 글/이모티콘으로 보임).

## 확인한 것
- `node --test tests/` 269/269 (새 `access.test.mjs` 8개: 설정 풀이·저장 왕복·자막 표가 sfx.json 과 맞는지·세로 카메라·섬폰 P4 줄·css 배율/움직임·QA-12).
- 스크린샷 (머리 없는 Chrome, 공용 노트 폴더 `p11-access-shots/`): 세로 375×812 · 가로 812×375 · 데스크톱 1280×800 각각 섬 · 섬폰 첫 화면 · 보기 편하게(아주 크게+모양) · 설정(아주 크게) · 자막 · 이모티콘 선택기(뜻 글자) · 대답 고르기. 콘솔: JS 오류 0 (네트워크 404 = favicon·P4 두 파일, 데스크톱은 기존 FXAA 셰이더 경고 1개).
- `node tools/playtest.mjs --mobile --only=boot,naming,arrival,clock,fd-tool` 통과 5 · 막힘 0 · 콘솔 오류 0. `--only=boot … fd-home,meet` (11단계, 주민 6명 이모티콘 대화 포함) 통과 11 · 막힘 0 · 콘솔 오류 0 (봇 '물가에서 걷다 막힘' 작음 2건은 world·봇 길찾기, 이번 변경과 무관).
- 실제 휴대폰 기기·iOS Safari 는 못 봄 (RC-06·07 사용자 손).
