# Y1 조작 안내·편의 (p7-ux) — 만든 것·정한 것·제안

브랜치 `p7-ux` (main 3b98be9 에서), 포트 4201. 고친 곳: `src/gameplay/index.js`, `src/core/input.js`, `src/ui/` (`hud.js`·`index.js`·`phone.js`·`ui.css`), `src/data/save.js`, `src/gameplay/intro/` (`index.js`·`naming.js`·`intro.css`), 새 테스트 `tests/ux.test.mjs`. 다른 트랙 파일은 건드리지 않았다.

## 만든 것

### 행동 키 미리보기 `interactions.peek(intent)` (`src/gameplay/index.js`)
- `ctx.services.gameplay.interactions.peek('action' | 'pickup') → { name, label } | null` — 지금 그 키를 누르면 처리할 첫 처리기. `run` 은 하지 않는다. 창이 열렸거나(`ui.isBlocking()`) `input.enabled === false` 면 `null`, 맞는 처리기가 없어도 `null`.
- 디스패처는 `createInteractions(ctx) → { api, dispatch }` 로 빼서 node 테스트가 된다. `input:press` 처리(`dispatch`)와 `peek` 가 같은 순서·같은 규칙을 쓴다.
- 글자는 (1) 처리기가 스스로 준 `label` (문자열 또는 `(대상, ctx) → 문자열`) → (2) `LABELS` 표 → (3) 기본 `INTENT_LABEL` (`행동`·`줍기`). `''` = 눌러도 아무 일 없음(화면은 기본 글자).
- `LABELS` 표:

| 처리기 | 글자 |
|---|---|
| `gather-busy` | 낚시 중 `당기기`, 그 밖(동작 중) `''` |
| `gather-shake` | 흔들기 |
| `gather-pickup` | 잡초 `뽑기`, 꽃 `꺾기`, 그 밖 `줍기` |
| `gather-plant` | 심기 |
| `gather-tool` | 낚싯대 `낚시`, 잠자리채 `채집`, 삽 `파기`, 도끼 `찍기`, 물뿌리개 `물 주기` (`TOOL_LABEL`) |
| `town:talk`·`town:intro`·`town:firstday` | 말 걸기 |
| `town:knock` | 노크 |
| `town:mail` | 우편함 |
| `town:shop` / `town:museum` | 가게 / 박물관 |
| `house-door-in` / `house-door-out` | 들어가기 / 나가기 |
| `house-furniture` | 작업대 `만들기`, 가구 `살피기` |
| `house-furniture-store` | 넣기 |
| `house-place` | 가구 놓기 |
| `house-move-drop` / `house-move-cancel` | 내려놓기 / 취소 |

- 부작용이 있는 `test()` 는 peek 가 부르지 않는다: 처리기에 `pure: false` 를 달거나 `IMPURE` 집합에 이름을 넣는다 (건너뛰고 다음 처리기를 본다 — 그 키는 아래 처리기 글자 또는 기본 글자가 된다). **지금은 비어 있다** (아래 표).
- 비용: peek 두 번(A·B)을 0.2초마다. 처리기 19개의 `test` 는 모두 거리 계산·`objects.query`·배열 훑기라 가볍다.

### `test()` 부작용 표 (읽어서 확인)

| 처리기 | 우선 | test 가 하는 일 | 부작용 |
|---|---|---|---|
| `gather-busy` (intent 없음) | 200 | `busy \|\| lockT > 0 \|\| fishing.active` | 없음 |
| `house-move-drop` / `-cancel` | 120 | `H.moving` | 없음 |
| `town:talk` | 100 | 주민 훑어 앞쪽 가장 가까운 `talkable` | 없음 |
| `town:intro` | 100 | `intro.pending`·`holding`·`near()` | 없음 (`near` 는 `heightAt` 읽기만) |
| `town:firstday` | 95 | `intro.rewardPending()`·`near`·`facingTo` | 없음 |
| `town:mail` | 91 | 우편함 거리·방향 | 없음 |
| `town:knock` | 90 | 집에 있는 주민 문 거리·방향 | 없음 |
| `town:shop` / `town:museum` | 90 | 문·주인 거리·방향 | 없음 |
| `house-door-in` / `-out` | 90 | `nearDoor(true)` / `onDoormat()` | 없음 |
| `house-furniture` / `-store` | 80 | `targetInFront()` (상자 겹침, `wallInFront`) | 없음 |
| `gather-shake` | 60 | `trees.find()` = `objects.query` + 거르기 | 없음 |
| `gather-pickup` | 50 | `pickup.find()` = `drops.near` + `objects.query` + `itemOfFlower` | 없음 (후보 객체를 새로 만들 뿐) |
| `gather-plant` | 45 | `garden.holeInFront()` = `daily.holes()` 읽기 | 없음 |
| `house-place` | 20 | `H.inside && !H.busy` | 없음 |
| `gather-tool` | 10 | `kit.player.tool` | 없음 |

→ 지금은 모두 부작용이 없어 `IMPURE` 가 비어 있다. 새 처리기(4차 Y2 화석 감정·곤충 들추기 등)는 `test` 에서 소리·이벤트·상태 바꾸기를 하지 말고 `run` 에서 할 것. 꼭 필요하면 `pure: false` 를 달면 peek 가 건너뛴다.

### 버튼 글자·키보드 안내 (`src/core/input.js`, `src/ui/hud.js`·`index.js`·`ui.css`)
- ui 모듈 `update` 가 0.2초마다 `peek('action')`·`peek('pickup')` → `ctx.input.setLabels({ action, pickup })` + `hud.setActions(…)`.
- **휴대폰**: A·B 아래 작은 글자가 `말 걸기`·`흔들기`·`들어가기`·`줍기`… 로 바뀐다. 할 일이 없으면 기본 `행동`·`줍기`(조금 흐리게), 상황 글자일 때 진하게(`is-ctx`). `aria-label` 도 `A 버튼: 흔들기`. 창이 열리면(`is-ui`) 작은 글자는 `visibility: hidden` (자리는 그대로라 A·B 글자가 움직이지 않음). 바뀐 것만 DOM 에 쓴다.
- **키보드**: 화면 아래 가운데(아래 84px) 작은 말풍선 `[Space] 흔들기 [F] 줍기`. 할 일이 있는 키만 보이고, 없으면 글자를 남긴 채 흐려져 사라진다(깜빡임 없음). 창·대화 중(`is-busy`)·터치 화면(`pk-touch`)에선 숨김. 왼쪽 아래 키 안내 목록은 그대로(`Space 행동`, `F 줍기`).
- `input.setLabels` 는 터치 조작이 아직 없으면 값만 기억했다가 패드가 생길 때 쓴다.

### 섬폰 이름 (`src/ui/phone.js`)
- 첫 화면 제목 아래 이름표: **내 이름** + `🏝️ 섬 이름` (가로 휴대폰에선 제목·이름표·인사가 한 줄).
- 설정 맨 위 '이름' 칸: 내 이름·섬 이름과 **이름 다시 정하기** 단추 → 섬폰을 닫고 `ctx.services.intro.rename()`.
  (panels 가 창을 닫을 때 마이크로태스크에서 `input.enabled` 를 되돌리므로 `setTimeout 0` 뒤에 연다 — 바로 열면 이름 창이 열린 채 걷기가 됐다.)

### 이름 다시 정하기 (`src/gameplay/intro/`)
- `intro.rename() → Promise<boolean>` (계약 밖 개발용이던 것을 정식으로). 이름이 있으면 `openNaming(…, { rename: true })`: 제목 '이름 다시 정하기', 지금 이름이 채워져 있고, **'그대로 둘래요'** 단추·Esc 로 그만두기(→ `null`, 아무것도 안 바뀜). 정하면 `state.player.name`·`state.island.name` → `intro:named { player, island, renamed: true, before }` → 저장 → 알림 `이제 바다, 몽글섬이에요!`.
- 확인 창 문구: "이름은 한 번 정하면 바꿀 수 없어요." → "이름은 나중에 섬폰 설정에서 다시 바꿀 수 있어요."
- 이름을 바꿔도 첫날 할 일 진행은 그대로 (rename 일 땐 `complete('intro')` 를 부르지 않는다).

### 저장 (`src/data/save.js`, `src/ui/index.js`)
- `save.reset()`: `createState()` 에 없는 최상위 칸(`state.mail` 등 모듈이 만든 칸)을 지운 뒤 새 상태로. 있는 칸은 그대로 같은 참조(안쪽 값만 새로).
- 저장 알림(ui, 한 세션에 한 번):
  - 시작할 때 `data.save.available === false` → `이 창에서는 저장할 수 없어요. 닫으면 처음부터 다시 시작해요` (이름 정하기 창이 떠 있으면 `intro:named` 뒤 1.2초).
  - `save:done { ok: false }` (창이 안 열렸을 때) → `blocked` 면 `더 새 게임의 저장이 있어서 저장하지 않았어요`, 그 밖 `저장하지 못했어요. 저장 공간을 확인해 주세요`. 섬폰 저장 앱은 원래대로 자기 알림.

## CONTRACTS.md 에 넣을 문장 (제안)
- **gameplay**: `interactions.peek(intent) → { name, label } | null` — 지금 그 키를 누르면 처리할 처리기와 버튼 글자 (run 하지 않음, 창이 열렸으면 null). 처리기는 `label`(문자열 또는 `(대상, ctx) → 문자열`)과 `pure: false`(test 에 부작용 — peek 가 건너뜀)를 줄 수 있다. **`test(ctx)` 는 부작용 없이 0.2초마다 불려도 가벼워야 한다**; 소리·이벤트·상태 바꾸기는 `run` 에서. 글자를 안 주면 `src/gameplay/index.js` 의 `LABELS` 표, 거기도 없으면 `행동`·`줍기`.
- **input**: `setLabels({ action, pickup })` — 휴대폰 A·B 아래 글자 (빈 값 = 기본). ui 가 0.2초마다 부른다; 다른 모듈은 부르지 말 것.
- **intro**: `rename() → Promise<boolean>` (섬폰 설정에서 부름), 이벤트 `intro:named` 에 이름을 바꿨을 때 `renamed: true, before: { player, island }`.
- **data.save**: `reset()` 은 `createState` 에 없는 최상위 칸도 지운다 → 자기 칸을 `state` 최상위에 두는 모듈은 reset 뒤 다시 `??=` 로 만들어야 한다 (지금은 reset 을 부르는 화면이 없다).

## 다른 트랙에 부탁
- **Y2 채집 콘텐츠**: 새 처리기(화석 감정 대화·바위 들추기 등)를 `interactions.add` 할 때 `label` 을 달아 주면 A 글자가 맞게 나온다 (예 바위 앞 삽 `들추기`). 기존 `gather-tool` 에서 대상에 따라 다른 일을 하면 `test` 가 대상을 돌려주고 `label: t => …` 로. `test` 에 부작용 금지.
  `keepers.js` 의 `town:shop`·`town:museum` 은 대상이 `'door' | 'keeper'` 라 `label: t => (t === 'keeper' ? '말 걸기' : '가게')` 를 달면 주인 앞에선 '말 걸기'가 된다 (지금은 표 기본값 '가게'·'박물관').
- **조정 세션**: 위 CONTRACTS 문장. 그리고 `data/index.js`(Y2 몫)에 `reset` 뒤 `data:reset` 이벤트가 있으면 `state.mail` 같은 칸을 잡은 모듈이 다시 만들 수 있다 (지금은 reset 뒤 새로 고침을 권함).

## 확인한 것
- `node --test tests/` 143개 통과 (새 `tests/ux.test.mjs` 10개: peek 순서·intent·글자 표·처리기 label 우선·낚시 당기기·창 열림 null·pure:false/IMPURE 건너뛰기·test 예외·save.reset 여분 칸 지우기와 참조 유지).
- `node tools/build-web.mjs --check` 통과(묶음 255+10개), 빌드 뒤 `/artifact/` 열림·peek 있음·콘솔 오류 없음.
- 브라우저(`/index.html?debug`, 데스크톱 800×706): 새 게임 → 이름 정하기 확인 창 새 문구 → 밤톨 앞 peek `town:intro 말 걸기` → 나무 앞 `[Space] 흔들기` 말풍선 → 흔든 뒤 `F 줍기` → 집 문 앞(북쪽 볼 때) `들어가기` → 섬폰 설정 이름 칸 → 이름 다시 정하기 → Esc 로 그만두기(이름 그대로, 입력 돌아옴) → 다시 열어 '바다·몽글섬'으로 바꾸기(저장에도 들어감, 알림) → `save:done {ok:false}` 두 번에 알림 한 번.
- 휴대폰 흉내 375×812(`?touch=1`): A 아래 `흔들기`(진하게)·B `줍기`, 키보드 말풍선은 숨김, 섬폰 열면 작은 글자 숨김, 섬폰 첫 화면 이름표. 812×375: 섬폰 첫 화면 한 줄 머리·설정 이름 칸 안 잘림.
- 콘솔 오류 없음.

## 못 한 것
- **저장소가 막힌 창(`save.available === false`) 시작 알림은 실제로 못 띄워 봤다** — 페이지 모듈이 뜨기 전에 localStorage 를 막을 방법이 없어서, 같은 알림 함수를 `save:done` 경로로만 확인했다 (`available: false` 문구가 나오는 것까지).
- 실제 휴대폰은 안 해 봤다. 미리보기 창이 숨겨질 때가 있어 몇몇은 화면 대신 DOM 값으로 확인했다.
- 낚시 중 `당기기`, 집 안 가구 `살피기`·`만들기`·`내려놓기` 는 node 테스트와 표로만 확인 (브라우저에서 그 상황까지 가 보지 않음).
- 이름을 바꾼 뒤 주민 머리 위 이름표·편지 문구가 바로 새 이름을 쓰는지는 town 쪽 코드라 보지 않았다 (대사는 `dialog.open` 감싸기로 매번 채우므로 새 이름이 나온다).

## 스크린샷 (공유 노트 폴더 `y1-ux-shots/`)
- `01-keyboard-space-shake.jpg` — 나무 앞 `[Space] 흔들기`
- `02-keyboard-phone-settings-names.jpg` — 섬폰 설정 이름 칸
- `03-375x812-A-shake.png` — 휴대폰 A `흔들기`·B `줍기`
- `04-375x812-phone-home-names.jpg` — 섬폰 첫 화면 이름표
- `05-812x375-settings-names.jpg`, `06-812x375-phone-home.jpg` — 가로 휴대폰
