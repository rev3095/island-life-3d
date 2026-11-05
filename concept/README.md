# 검수 보드 (concept/)

새 리소스나 큰 결정이 필요한 차수는 **만들기 전에 검수 보드부터** 보여 주고, 사용자가 보드에서 고른 선택대로 진행한다. 결정이 바뀌거나 되돌릴 때도 사용자는 보드를 고친 뒤 채팅에 **"검수 보드 반영"** 이라고 한다.

모든 편집기·보드 링크와 현황은 **편집기 홈** (https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv, `editors.html`) 에 모여 있다 — 아래 「편집기 홈」·「"전체 요청 확인"」·「반영 기록 공용 모양」.

| 보드 | 파일 | 링크 | 보드 id |
|---|---|---|---|
| 컨셉 보드 v0.1 (1차 계획, 저장 없음) | `concept-board.html` | https://claude.ai/artifact/6Z5WJmpKasDRyVANYbwauM | — |
| 5차 검수 보드 v0.5 | `wave5-board.html` + `board-kit.js` | https://claude.ai/artifact/QmguFLRgBq2FUa3RnD8RbT | `wave5` |
| Z5 축제 검수 보드 v0.1 (이모티콘 대화·축제 광장·부품·부스·엔딩, D14–D25) | `z5-festival-board.html` + `board-kit.js` | https://claude.ai/artifact/Cqjh9RiTwUn1CcPhCNtoWS | `z5` |
| 6차 검수 보드 v0.6 (M6 편집기 완성) | `wave6-board.html` + `board-kit.js` | https://claude.ai/artifact/Lz3rV3HxTzQVV4RJt1DYvU | `wave6` |
| 7차 검수 보드 v0.7 (M7 출시 준비, D36–D48 · QA 결과 D49–D57) | `wave7-board.html` + `board-kit.js` | https://claude.ai/artifact/HuSkBdHEr2VrWxts9YtStV | `wave7` |
| 하늘 검수 보드 v0.1 (하늘 셰이더, D58–D66 · 하늘 층 SK-01–08, 그림 = 게임 화면 `concept/sky/*.jpg`) | `sky-board.html` + `board-kit.js` + `sky/*.jpg` | https://claude.ai/artifact/UtvXfFPhvgvYREhHoaAyGE | `sky` |
| 실내 검수 보드 v0.1 (상점·박물관 실내 · 문 드나들기, D67–D73) | `interiors-board.html` + `board-kit.js` | https://claude.ai/artifact/8w5fbrjNthoTgkCMqHURDh | `interiors` |
| 8차 검수 보드 v0.8 (M8 계절 행사 EV-01–04, D74–D85) | `wave8-board.html` + `board-kit.js` | https://claude.ai/artifact/THtUdkR9e9G9qaf6FDLM5T | `wave8` |

## ID 표 (새 ID 는 여기 다음 번호부터 — 겹치지 않게)

| 접두사 | 무엇 | 쓴 번호 |
|---|---|---|
| D | 결정 | D1–D7 (v0.1) · D8–D13 (wave5) · D14–D25 (z5) · D26–D35 (wave6) · D36–D48 (wave7) · D49–D57 (wave7 QA 결과) · D58–D66 (sky) · D67–D73 (interiors) · D74–D85 (wave8) |
| CH | 캐릭터 | CH-01–10 (CH-11·12 는 후보만) |
| EN · PR · BD · TI | 배경: 자연 · 소품 · 건물 · 타일 | EN-01–11 (+wave8 EN-12 벚나무) · PR-01–12 (+z5 PR-13–16) (+wave8 PR-17–23) · BD-01–05 (+z5 BD-06–07) · TI-01–07 (+z5 TI-08) |
| FU | 가구 | FU-01–33 (+z5 FU-34) (+interiors FU-35–42 붙박이) (+wave8 FU-43–46 행사 보상) |
| IC-xx | 아이템 아이콘 (TL MA SD FR SH FL FS BG FO, z5 FE) | 분류마다 01부터 (wave8 EV: IC-EV-01–04) |
| WP · FL · RM | 벽지 · 바닥 · 방 배치 | WP-01–08 · FL-01–08 · RM-01–07 (+interiors RM-08 상점 · RM-09 박물관) |
| EM · TK · FP · FB · AN · ED · SF · UI | z5: 이모티콘 · 주민 읽기 규칙 · 축제 부품 · 부스 · 동작 · 엔딩 컷 · 이야기 흐름 · 화면 | EM-01–36 · TK-01–07 · FP-01–05 · FB-01–05 · AN-01–05 (+interiors AN-06 문 열기 · AN-07 걸어 들어가기) (+wave8 AN-08 손 불꽃 흔들기 · AN-09 눈덩이 밀기) · ED-01–06 · SF-1–6 · UI-04–05 |
| s01– | 장면 (시나리오 편집기) | s01–s12 (+wave8 s13–s16 행사 장면 계획) |
| ET | 편집기 (wave6) | ET-01– |
| UI · RC · QA | wave7: 새 화면 (UI-01–03 v0.1, UI-04–05 z5 다음) · 출시 점검표 · QA 결과 (`docs/qa/playthrough-2026-10-30.md` 의 버그 ID 그대로) | UI-06–11 (+interiors UI-12 원형 화면 전환) (+wave8 UI-13–15) · RC-01–12 · QA-01–19 |
| SK | 하늘 층 (sky 보드): 그라데이션 · 안개 띠 · 해 빛무리·노을빛 · 빛살 · 툰 구름층 · 3D 솜구름 · 은하수 · 별·달 | SK-01–08 |
| EV · FX | wave8: 계절 행사 · 효과 셰이더 | EV-01–04 · FX-01 (불꽃) |

## 새 보드 만드는 법 (6차부터)

1. `wave5-board.html` 을 복사해 `wave<N>-board.html` 로. 색·글꼴·카드 모양은 그대로 두고 내용만 바꾼다.
2. 결정은 `DECISIONS` 배열 `{ id: 'D14', q, opts: [[key, 제목, 설명, 추천?], …] }` — 추천안 하나에 `true`. 결정 id 는 차수가 바뀌어도 이어서 매긴다 (D1–D7 v0.1, D8–D13 5차 …).
3. 리소스마다 ID 를 붙이고(FU-34, PR-13 …, 이미 쓴 번호 다음부터) 카드에 `noteBox(ID, 이름)` 의견 칸을 둔다. 그림은 SVG 스케치.
4. 페이지 스크립트 끝에 `window.BOARD = { id: 'wave<N>', decisions: DECISIONS };`, 그 뒤 `<script src="board-kit.js"></script>`, 머리에 `<div id="boardPanel" class="out board"></div>`.
5. 게시: `file_path` = 보드 html, `files: {"board-kit.js": "concept/board-kit.js"}`, `capabilities: {"db": {"rules": [{"path":"applied","read":"view","write":"admin"},{"path":"history","read":"view","write":"admin"}]}, "user": {}}`. 첫 게시에 `icon: "palette"`.
6. 이 표와 devlog 「게시물」, 그리고 편집기 홈 목록(`editors.html` 의 `editors-list`, group `board`)에 보드를 더한다 → 홈 다시 게시.

`board-kit.js` 가 하는 일: 선택·의견을 보드 저장소 `boards/<id>` 에 바로 저장(저장소를 못 쓰는 창은 브라우저에만), 마지막 반영 `applied/<id>` 와 비교해 바뀐 카드에 테두리, 반영 기록 `history/<id>-v<n>` 목록과 **이 선택으로 되돌리기**, **반영 요청 표시** 단추. 맨 위의 `window.ApplyLog` (반영 기록 머리 줄·목록 그리기·구독)는 `window.BOARD` 없이도 실려서 편집기·편집기 홈도 같이 쓴다 (아래 「반영 기록 공용 모양」).

## "검수 보드 반영" (Claude 가 하는 일)

1. ArtifactData `get` 으로 `boards/<id>` 와 `applied/<id>` 를 읽는다 (보드 링크는 위 표).
2. 결정(`picks`)과 의견(`notes`)을 비교해 바뀐 것만 고른다. 바뀐 게 없으면 그렇게 알리고 끝.
3. 바뀐 것마다 할 일을 정한다:
   - **결정 변경**: 그 결정에 걸린 트랙·파일을 고친다 (아직 안 만든 것이면 계획만 바꾼다).
   - **되돌리기**: 선택이 `history/<id>-v<n>` 와 같아졌으면 v<n> 의 `commit` 이후에 그 결정 때문에 들어간 커밋을 `git revert` 한다 (합친 커밋이면 `git revert -m 1`). 사용자에게 무엇을 되돌리는지 먼저 보여 준다.
   - **의견**: 그 ID 리소스의 스펙·그림·보드 카드를 고친다.
4. 평소처럼 세션·브랜치로 작업 → 테스트 → 사용자 승인 뒤 `main` 에 합친다.
5. 반영이 끝나면 `applied/<id>` 를 `version + 1` 로 바꾸고, 같은 내용으로 `history/<id>-v<새 버전>` 을 만든다 (`{board, version, picks, notes, appliedAt, summary, commit}` — `commit` 은 반영 직전 `main` 해시). `boards/<id>` 의 `status` 는 `editing` 으로.
6. 보드 내용(카드·ID)이 바뀌었으면 보드를 같은 파일로 다시 게시한다 (capabilities 는 생략하면 그대로). `board-kit.js` 를 바꿨으면 보드마다 `files: {"board-kit.js": "concept/board-kit.js"}` 로 다시 올린다 (게시본은 다시 올릴 때까지 예전 파일 그대로).
7. 편집기 홈 `status/<보드 id>` 를 고친다 (`open: 0`, `applied`·`recent` 를 새 기록으로, `checkedAt`) — 아래 「편집기 홈」.

## 편집기 홈 (ET-01)

https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv · 파일 `editors.html` (저장소 루트). 모든 편집기·검수 보드·게임 링크를 한곳에서 열고, 편집기마다 무엇을 고치는지 · 채팅 명령 · 마지막 반영 버전 · 처리할 것 수를 보여 주고, **「전체 관리」 표에서 모든 리소스를 골라 다시 열기 · 고쳐 주세요 · 확정을 남긴다** (아래 「전체 관리」).

- **목록 = `editors.html` 의 `<script type="application/json" id="editors-list">`.** 항목 `{ id, group: editor|board|game|soon|archive, name, url, file, edits, command, openLabel, reads, et?, track?, later? }`. `reads` 는 "전체 요청 확인" 때 Claude 가 그 아티팩트 저장소에서 읽을 곳. 머리의 **바로 가기** (`nav.quick`) 는 같은 링크를 스크립트 없이 적어 둔 것 — 목록을 바꾸면 같이 고친다. `tests/hub.test.mjs` 가 목록 ↔ 바로 가기 · CLAUDE.md·이 표·시나리오 노트의 링크, 보드 id ↔ `window.BOARD.id` 를 검사한다.
- 아티팩트는 다른 아티팩트의 저장소를 읽을 수 없다 → 홈은 **자기 저장소의 문서만** 보여 주고, 그 문서는 Claude 가 ArtifactData 로 써 넣는다. 숫자·목록은 Claude 가 마지막으로 확인한 때 기준이다. 홈 페이지가 쓰는 곳은 `manage/*` (전체 관리 요청) 하나.
- **열리게 하는 약속** (게시본에서 무엇이 실패해도 화면이 비지 않게, `tests/hub.test.mjs` 가 본다): ① 맨 앞 작은 스크립트가 오류·`unhandledrejection`·스크립트 파일 못 받음을 잡아 맨 위 상자(`#bootErr`)에 "무엇이 안 됐는지" 적는다 (오류 글 복사 단추 — 채팅에 붙이면 Claude 가 고친다) ② 글꼴은 `<link>` 대신 그 스크립트가 나중에 붙인다 (글꼴 서버가 늦어도 화면을 막지 않음, 없으면 기본 글꼴) ③ 바로 가기 링크·명령 표는 HTML 그대로 ④ `board-kit.js` 를 못 받아도 같은 모양의 대신 도구로 그린다 ⑤ `claude.use()` 는 12초 제한·`null`·던짐·Promise 아님을 모두 견디고, `user.isOwner()`·`can()`·`id()` 도 각각 8초 제한으로 감싼다 ⑥ 현황(`status`) 구독이 실패해야만 "저장소 못 읽음", 다른 구독은 그 칸에만 이유 ⑦ 15초 동안 답이 없으면 그렇게 적는다.

| 문서 (홈 저장소) | 모양 | 쓰는 쪽 |
|---|---|---|
| `status/<목록 id>` | `{ id, open, openItems, requested, applied, recent, published, note, url, checkedAt, updatedAt, updatedBy: 'claude' }` | Claude (쓰기 admin) |
| `meta/check` | 마지막 "전체 요청 확인" `{ at, summary, open, by: 'claude' }` | Claude (쓰기 admin) |
| `meta/catalog` | 목록을 만든 때 `{ at, commit, total, review, groups: [{id, label, count, review, new}], by: 'claude' }` | Claude (쓰기 admin, `tools/hub-catalog.mjs`) |
| `catalog/<분류>` | 그 분류의 모든 리소스 (아래 「전체 관리」) | Claude (쓰기 admin, `tools/hub-catalog.mjs`) |
| `marks/<분류>` | 값 데이터(소리·지도·숫자·스타일·보드 결정)의 홈 쪽 상태 `{ group, items: { <id>: { state: 'review'|'approved', at, from: '<manage 문서 id>', note } } }` | Claude (쓰기 admin) |
| `manage/<자동 id>` | 전체 관리에서 남긴 요청 (아래) | 홈 페이지 (쓰기 interact) · 처리 결과는 Claude |
| `status/game` | 다른 `status` 칸 + 게임 저장소 요약 `open`·`openItems`·`reports`·`checks` (아래 「게임 저장소」) | Claude (쓰기 admin, `tools/hub-game.mjs`) |

`status` 칸: `open` = 아직 처리 안 한 것 수 (캐릭터·배경: `status:'new'` 요청 · 보드: `applied` 뒤 바뀐 결정·의견 · 시나리오: 바뀐 장면·순서·의견 · 새 편집기: 그 편집기 노트가 정한 것), `openItems` = 짧은 이름 최대 5개, `requested` = 편집기·보드에서 "반영 요청 표시"를 눌렀는지, `applied` = 그 편집기 `applied/<id>` 요약 `{version, appliedAt, summary, commit}` (없으면 `null`), `recent` = `history` 최근 3개 `{version, appliedAt, summary}` (새 것부터), `published` = 그 편집기 아티팩트 게시 버전, `note` = 한 줄 상황, `url` = 목록에 링크가 없는 새 편집기의 링크 (`https://claude.ai/artifact/…` 만 받아 줌 — 홈을 다시 게시하지 않고 자리를 채울 때). 목록에 없는 칸은 비워 둬도 된다.

게시: `file_path: editors.html`, `files: {"concept/board-kit.js": "concept/board-kit.js"}` (홈은 루트에 있어서 로컬과 같은 경로), `capabilities: {"db": {"rules": [{"path":"status","read":"view","write":"admin"},{"path":"meta","read":"view","write":"admin"},{"path":"catalog","read":"view","write":"admin"},{"path":"marks","read":"view","write":"admin"},{"path":"manage","read":"view","write":"interact"}]}, "user": {}}` (capabilities 를 넘기면 전체를 다시 선언 — 생략하면 그대로), 첫 게시 `icon: "home"`. 로컬 확인은 dev-server `/editors.html` — `/api/db/hub-status`·`hub-meta`·`hub-catalog`·`hub-marks`·`hub-manage` (`assets/review/hub-*.json`, 행마다 `docId`; `node tools/hub-catalog.mjs --local` 이 catalog·meta 행을 채운다) 를 읽고 쓴다. 게임 카드는 같은 서버의 `/api/db/game-reports`·`/api/db/checks` (게임이 로컬에서 남긴 것) 를 바로 읽는다.

## 전체 관리 (홈의 표)

**원칙: 확정(approved)해도 편집기·요소·기록을 지우지 않는다.** 확정은 "지금 게임에 들어간 것이 이것"이라는 표시일 뿐이고, 언제든 홈에서 골라 다시 열거나(검수 대기 `review`), 편집기에서 바로 고쳐 요청할 수 있다. 게임은 status 로 거르지 않으니 다시 열어도 게임에서 빠지지 않는다. 기록(`applied`·`history`)도 앞으로만 쌓는다.

**목록 만들기** — `node tools/hub-catalog.mjs --boards <보드 반영.json> [--local]`. 저장소 파일을 읽어 `assets/review/hub/catalog/<분류>.json` 13개 + `meta-catalog.json` 을 만든다 (`--local` 은 dev-server 흉내 파일도). `--boards` 는 보드마다 `applied/<보드 id>` 문서의 data 를 `{wave5: {…}, z5: {…}, wave6: {…}}` 로 모은 파일 (결정 줄의 고른 안·상태). 링크는 `editors.html` 목록의 url 에 그 요소로 가는 주소 끝 `#…` 을 붙인다.

| 분류 (`catalog/<id>`) | 읽는 곳 | 상태 | 고치는 곳 (주소 끝) |
|---|---|---|---|
| `character` 캐릭터 | `assets/specs/*.json` | 스펙 `status` | 캐릭터 편집기 `#<slug>` |
| `villager` 주민 성격·대화 | `assets/villagers/*.json` | 파일 `status` | 캐릭터 편집기 `#<slug>.talk` |
| `env` 배경 (축제 포함) | `assets/env/specs` | 스펙 `status` | 배경 편집기 `#<slug>` |
| `furniture` 가구 | `assets/furniture/specs` | 스펙 `status` | 배경 편집기 `#furn-<slug>` |
| `item` 아이템 (`icons` = 아이콘 수) | `assets/items/specs` | 스펙 `status` | 배경 편집기 `#item-<slug>` |
| `interior` 벽지·바닥 | `assets/interior/specs` (wallpaper·floor) | 스펙 `status` | 배경 편집기 `#wp-0N`·`#fl-0N` |
| `room` 방 배치 (+ 파일 없는 RM-07 = `new`) | `assets/interior/rooms` | 파일 `status` | 배경 편집기 `#rm-0N` |
| `scene` 장면 | `assets/story/scenes` (순서 `index.json`) | 파일 `status` | 시나리오 편집기 |
| `sound` 곡·선곡 표·효과음·목소리 | `assets/sound/` | 값 데이터 → `marks` | 곡 편집기 `#songs`·`#schedule`·`#sfx`·`#voices` |
| `map` 섬 지도 자리·시드·밀도 | `assets/island/layout.json` 칸마다 | 값 데이터 → `marks` | 섬 지도 편집기 |
| `data` 숫자 표 묶음 | 숫자 표 편집기 `SHEETS` + `assets/data/*.json` | 값 데이터 → `marks` | 숫자 표 `#<표 id>` |
| `style` 스타일 프리셋 | `assets/style/presets.json` | 값 데이터 → `marks` | 스타일 편집기 |
| `decision` 보드 결정 D8– | 보드 html `DECISIONS` + `--boards` (보드 파일이 아직 이 작업 트리에 없으면 그 보드는 건너뛰고 알린다) | 고른 안이 있으면 확정 → `marks` | 그 보드 |

`catalog/<분류>` 모양: `{ group, label, editor, editorName, how: 'spec'|'value'|'board', count, approved, review, new, icons?, builtAt, commit, by: 'claude', items: [{ id, ref, name, sub, state: 'approved'|'review'|'new', version, link, file, board?, pick?, rec?, icons? }] }` (문서 하나 256 KiB 안 — 지금 가장 큰 아이템이 21 KB).

**요청 문서** `manage/<자동 id>` (홈 페이지가 씀): `{ kind: 'reopen'|'fix'|'approve', items: [{ group, id, ref, name, state, version }], note, status: 'new', from: 'hub', createdAt, by: <user id|null> }` — 한 문서에 400줄까지, 「고쳐 주세요」(`'fix'`)는 `note` 필수. 처리 전(`new`)이면 홈에서 취소(`status: 'cancelled'`). Claude 가 처리하면 `status: 'done'`, `reply`(한 줄 답), `doneAt`, `doneVersion` (그 편집기 `applied` 새 버전, 없으면 생략). 처리 중에는 `'working'`. 저장소를 못 쓰는 창에서는 같은 세 단추가 채팅에 붙일 글("전체 요청 확인 — 다시 열기 2개: 벤치(PR-02), …")을 복사한다 → 채팅으로 오면 아래와 같게 처리.

**Claude 가 처리하는 법** (분류의 `how` 마다):

| `kind` | `spec` (스펙·파일에 status 가 있는 것) | `value` (소리·지도·숫자·스타일) | `board` (보드 결정) |
|---|---|---|---|
| `'reopen'` 다시 열기 | 파일 `status: "review"` (version 은 그대로) → `node tools/build-*.mjs --index` (배경 편집기는 `build-editor-index.mjs` 도) → 그 편집기 다시 게시 (목록 파일만) | `marks/<분류>.items.<id> = {state:'review', at, from}` (파일은 그대로 — 편집기에서 바로 고치면 된다) | `marks/decision` 에 `review` → 사용자가 보드에서 다시 고르면 "검수 보드 반영" |
| `'fix'` 고쳐 주세요 | 그 편집기 요청 하나처럼 처리 (CLAUDE.md 「"요청 확인"」 흐름: 스펙·빌더 수정 → 재빌드 → 테스트 → 다시 게시 → 그 편집기 `applied`·`history` 새 버전, `changed` 에 `request: 'manage/<id>'`) → 고친 것은 `review` 로 | 의견대로 값 데이터를 고친다 (그 편집기 반영 흐름 — `apply-edits`·`apply-sound` 등과 같은 검사·버전 +1) | 의견을 보드 카드·계획에 반영 ("검수 보드 반영" 흐름) |
| `'approve'` 확정 | 파일 `status: "approved"` → `--index` → 다시 게시 | `marks` 에서 그 줄을 지운다 (= 확정) | `marks` 에서 지운다 |

끝나면 `manage` 문서를 `done` + `reply` 로, `node tools/hub-catalog.mjs` 로 목록을 다시 만들어 `catalog/*`·`meta/catalog` 를 쓴다 (아래 7번).

## 게임 저장소 (문제 알리기 · 기기 점검)

게임 링크(https://claude.ai/artifact/73gDyHVhfveR7ESQ23JrbJ) 는 v12 부터 자기 저장소가 있다 — capabilities `db` (뿌리 read·write admin, `reports`·`checks` read·write interact) · `user` · `downloads`. 홈은 그 저장소를 못 읽으니 **"전체 요청 확인" 때 Claude 가 읽어 처리하고 홈 `status/game` 에 요약을 옮겨 적는다** (홈 목록 `game` 항목 `reads: ["reports", "checks"]`, `openLabel: "새 문제"`, 카드의 「기기 점검 열기」 = 게임 링크 끝 `#check`). 공유 링크로 들어온 사람(`view`)은 쓸 수 없어서 그 사람들의 문제는 게임이 만든 글 복사 → 채팅으로 온다 — 같게 처리한다.

| 컬렉션 (게임 저장소) | 누가 남기나 | 모양 (자세히) |
|---|---|---|
| `reports/<id>` (`r<YYYYMMDD>-<HHMMSS>-<16진 4자리>`, 이름순 = 시간순) | 섬폰 「📮 문제 알리기」 | `{ status: 'new', kind: 'stuck' / 'error' / 'save' / 'look' / 'other', text, createdAt, game: {build, …}, errorTotal, reply: null, errors?, device?, place?, progress? }` — `docs/notes/p11-save.md` 「게임 저장소 `reports` 모양」 |
| `checks/<자동 id>` | 게임 링크 끝 `#check` → 30초 → 「결과 저장」 | `{ v, kind: 'device-check', at, ms, build, where, by, device: {gpu, screen, touch, …}, quality: {start, end, changes, fixed}, frame, stops, plaza: {avg, p95, goal: 33, ok}, errors: {count, list}, time }` — `docs/notes/p11-check.md` 「저장 모양」 |

**문제 처리 (D47-A)** — `reports` 를 `query where status == 'new'` 로 읽어 하나씩 `status: 'working'` 으로 바꾸고:

| `kind` | 처리 | 끝난 뒤 쓰는 칸 |
|---|---|---|
| `stuck` 막혔어요 · `error` 오류·멈춤 · `save` 저장 | 그 자리에서 고친다 — `errors`·`place`·`progress`·`game.build` 로 재현 → 고침 → 테스트 → 커밋 (게임 다시 게시는 "전체 요청 확인" 6번에서 한 번) | `status: 'done'`, `reply` (한 줄 답), `commit`, `doneAt` |
| `look` 보기·소리 · 밸런스·불편 | 7차 보드 `concept/wave7-board.html` 의 `const QA` 에 `[QA-NN, 무엇, 크기, '보드에서 고르기']` 로 올리고 보드 다시 게시 (`docs/notes/board7.md` 「QA 결과 칸」) | `status: 'board'`, `qa: 'QA-NN'`, `reply`, `doneAt` |
| `other` 그 밖 | 글을 보고 위 둘 중 하나 (막힘·저장·오류면 고침, 아니면 보드) | 위와 같게 |
| 이미 받은 문제와 같음 | 앞 것에 합친다 | `status: 'dup'`, `reply` (`'r… 와 같은 문제예요'`) |

`checks` 는 처리할 것이 아니라 기록 — 최근 5개(기기·화면·광장 평균 ms·품질)를 `status/game.checks` 에 요약한다. 광장 평균이 목표 33ms 를 넘은 점검(`plaza.ok: false`, 홈 카드에 "광장 느림")은 보고에 그 기기와 같이 적고, 품질 기준·저사양 판단을 바꿀 일이면 보드 QA 칸으로.

**요약 만들기** — 게임 저장소를 `ArtifactData list` (`collection: "reports"` · `"checks"`, `out_dir: <임시 폴더>`) 로 받아 `node tools/hub-game.mjs --reports <폴더> --checks <폴더>` → `assets/review/hub/status-game.json` (`open`·`openItems`·`reports`·`checks`·`checkedAt`·`updatedAt`·`updatedBy`) → 홈 `status/game` 에 `update` (`file_path`, `if_version`). 문제를 처리한 **뒤에** 다시 받아 돌려야 `open` 이 남은 것 수가 된다. `published`·`note` 는 게임을 다시 게시할 때 고친다 (이 도구는 건드리지 않음). 계산은 `editors.html` 의 `HubLogic.game` 하나 — 홈 카드가 로컬에서 바로 읽을 때와 같다.

`status/game` 의 요약 칸: `open` = `reports` 의 `status:'new'` 수, `openItems` = 새 것 최근 5개 `{ id, kind, text (40자), createdAt }`, `reports` = `{ total, new, working, done, board, dup }`, `checks` = `{ total, slow (광장 느림 수), recent: [{ id, at, where, build, gpu, touch, screen: '390×844 ×3', quality: {start, end, fixed}, plaza: {avg, p95, goal, ok}, errors }] }` (새 것부터 5개).

**로컬 흉내**: dev-server 에서 게임(`/index.html`)이 `POST /api/db/game-reports` (`assets/review/game-reports.json`, 행마다 `docId`) · `POST /api/db/checks` (`assets/review/checks.json`) 로 남기고, 홈 `/editors.html` 은 같은 서버라 둘을 바로 읽어 카드에 그린다. `node tools/hub-game.mjs` 를 인자 없이 돌리면 그 두 파일을 읽는다.

## "전체 요청 확인" (Claude 가 하는 일, D27-A)

지금 명령("요청 확인" · "배경 요청 확인" · "시나리오 반영" · "검수 보드 반영" · 6차 새 명령)은 그대로 두고, 모든 편집기를 한 번에 도는 명령을 더한 것.

1. **목록 읽기**: `editors.html` 의 `editors-list` + 홈 저장소 `status/*` · **`manage` (`query where status == 'new'`)** · `marks/*` (`ArtifactData list`, 홈 링크는 위). `url` 이 없는 자리는 `status/<id>.url` 을 쓴다. `command` 가 없는 것(지난 보드)은 건너뛴다.
2. **모으기** (읽기만): 항목마다 `reads` 대로 그 아티팩트 저장소를 읽는다.
   - 캐릭터 `requests` · 배경 `env-requests`: `query where status == 'new'` (되돌리기 요청 `kind: 'rollback'` 포함).
   - 시나리오: `drafts` 목록 · `timeline/main` · `applied/story` → `docs/notes/story.md` 의 "바뀐 것".
   - 보드: `boards/<id>` 와 `applied/<id>` 의 `picks`·`notes` 비교, `status == 'requested'`. `applied/<id>` 의 data 는 7번 목록 만들기의 `--boards` 파일로도 쓴다.
   - 새 편집기: 그 트랙 노트(`docs/notes/<트랙>.md`)가 정한 곳 — 정하지 않았으면 아래 공용 모양(`applied/<id>` + `requests` `status:'new'`).
   - **홈 전체 관리**: `manage` 의 `new` 문서마다 `kind` · 줄(`items` 의 `group`·`id`) · `note`. 채팅에 붙여 온 "전체 요청 확인 — 다시 열기 …" 글도 같은 것으로 본다.
   - **게임**: 게임 저장소 `reports` (`query where status == 'new'`) 와 `checks` 전부 (위 「게임 저장소」). 채팅에 붙여 온 "[포근섬 문제 알리기] r…" 글도 `reports` 한 줄로 본다.
3. **먼저 보여 주기**: 편집기마다 새 것 수와 짧은 목록, 홈에서 남긴 요청(다시 열기·고쳐 주세요·확정 몇 개, 어느 편집기)을 표로 보여 준다. 아무것도 없으면 `status/*`·`meta/check` 의 `checkedAt`·`at` 만 고치고 7번 목록만 다시 만든 뒤 끝.
4. **처리 순서**: 검수 보드(결정이 다른 일의 방향을 바꾼다) → 홈 「다시 열기」·「확정」 (status·marks 만 바꾸는 가벼운 일) → 게임 문제 (D47-A: 막힘·저장·오류는 고쳐 `'done'`, 보기·밸런스·불편은 7차 보드 QA 칸 `'board'` — 위 「게임 저장소」) → 캐릭터 → 배경 → 시나리오 → 새 편집기 (각 편집기 요청과 홈 「고쳐 주세요」를 같이). 각각 **그 편집기의 기존 흐름** 그대로 (CLAUDE.md 「편집기와 "요청 확인" 흐름」, 이 문서 「"검수 보드 반영"」·「전체 관리」, `docs/notes/story.md` 「시나리오 반영」, 새 편집기 노트). 처리를 시작한 `manage` 문서는 `status: 'working'`. 트랙 하나만큼 큰 일(새 편집기·새 리소스 묶음, 보드 결정 변경)은 세션·브랜치로 나눠 제안하고, 나머지를 먼저 끝낸다. 되돌리기는 무엇을 되돌리는지 먼저 보여 준다. **확정이든 다시 열기든 편집기·요소·기록은 지우지 않는다.**
5. **테스트**: `node --test tests/` 한 번 (편집기마다 따로 돌리지 않아도 된다 — 마지막에 한 번은 꼭).
6. **다시 게시**: 바뀐 편집기마다 바뀐 파일만, 게임 링크는 맨 끝에 한 번 (D35-A). status 만 바뀐 편집기는 목록 파일(`--index` 결과)만.
7. **기록**: 편집기마다 `applied/<id>`·`history/<id>-v<n>` (아래 공용 모양), 요청은 `done` + `reply` + `doneVersion` (홈 `manage` 문서도). 그다음 **`node tools/hub-catalog.mjs --boards <보드 반영.json>`** 으로 목록을 다시 만들고, 홈 저장소에 `catalog/<분류>` 13개 + `meta/catalog` + 바뀐 `marks/<분류>` + `status/<id>` 전부 (`open`·`openItems`·`requested`·`applied`·`recent`·`published`·`checkedAt`; `status/game` 은 게임 저장소를 다시 받아 **`node tools/hub-game.mjs`** 결과로) + `meta/check` (`at`, `summary` = "새 요청 3 처리 · 보드 1 반영 · 홈 요청 2" 처럼, 남은 것 수 `open`) 를 `batch` 로 (한 번에 50개까지 — 먼저 `list` 로 각 문서 `version` 을 읽어 `if_version` 에, 처음 만드는 문서는 생략. 파일은 `file_path` 로).
8. 사용자에게 편집기별로 한 것·남은 것·확인 못 한 것을 나눠 보고.

편집기 하나의 명령("요청 확인" 등)만 왔을 때도 끝에 홈 `status/<그 id>` 를 고치고, 그 편집기 분류의 `catalog/<분류>` 를 다시 쓴다 (`meta/check` 는 그대로). "<이름> 확정" · "<이름> 다시 열기" 가 채팅으로 오면 홈 「확정」·「다시 열기」와 같게 처리한다.

## 반영 기록 공용 모양 (ET-11)

검수 보드의 `applied`·`history` 를 모든 편집기가 같이 쓴다. 어느 편집기든 "v2 로 되돌리기"가 같은 순서로 움직이게.

| 문서 (그 편집기·보드의 저장소) | 모양 | 쓰는 쪽 |
|---|---|---|
| `applied/<id>` | 마지막 반영 (아래) | Claude (쓰기 admin) |
| `history/<id>-v<n>` | `applied` 와 같은 모양 | Claude (쓰기 admin) |

```
{ board: '<id>',            // 보드 id 또는 편집기 id — 칸 이름은 보드에서 온 것 그대로
  version: n,               // 1부터, 반영할 때마다 +1 (시나리오는 첫 초안이 v0)
  appliedAt: <ms>, summary: '한 줄',
  commit: '<반영 직전 main 해시>',            // 되돌리기 기준
  // 보드: 고른 것 전체
  picks: { D8: 'B' }, notes: { ID: 글 },
  // 편집기: picks 대신 바뀐 요소 목록 (+ 선택: 반영 뒤 요소별 스펙 버전)
  changed: [{ id: 'bench', label: '벤치', what: 'edit'|'add'|'remove'|'rollback'|'approve', version: 3, request: '<요청 문서 id>' }],
  items: { bench: 3 } }     // 시나리오는 이 칸이 지금 `scenes`, 연출안 고른 것은 `picks`
```

편집기 id = 홈 목록 id: `character` · `env` · `story` · `sound` · `map` · `data` · `style` (보드는 `wave5` · `z5` · `wave6` · `wave7`).

**되돌리기 요청** (사용자 → Claude):
- 보드: `history` 의 선택을 다시 고른다 (`board-kit.js` 단추 — 지금 그대로).
- 시나리오: `timeline/main.rollback = n` (지금 그대로).
- 다른 편집기: 요청 컬렉션에 `{ kind: 'rollback', to: n, status: 'new', createdAt, by }` 한 줄 — 새 요청 수에 같이 잡히고 그 편집기 명령으로 처리된다.

**되돌리기 처리** (Claude): `history/<id>-v<n>.commit` 기준으로 그 편집기가 맡은 파일만 되돌린다 — 그 뒤 그 편집기 때문에 들어간 커밋을 `git revert` 하거나 `git checkout <commit> -- <맡은 파일>` 뒤 새 커밋. 무엇을 되돌리는지 먼저 보여 준다. 끝나면 새 버전(`version + 1`, `changed` 에 `what: 'rollback'`, `summary` "v<n> 로 되돌림")을 남긴다 — 기록은 지우지 않고 앞으로만 쌓는다.

| 편집기 | 맡은 파일 (되돌릴 때) |
|---|---|
| `character` | `assets/specs/`, `assets/blender/build_character.py`, `assets/models/`, `assets/renders/` |
| `env` | `assets/env/`, `assets/furniture/`, `assets/blender/build_env.py`·`build_furniture.py`·`toonkit.py` (6차 탭: `assets/items/`, `assets/interior/`) |
| `story` | `assets/story/`, `src/gameplay/story/files.js` |
| `sound` · `map` · `data` · `style` | 그 트랙 노트가 정한다 (`assets/sound/` · `assets/island/` · `assets/data/` · `assets/style/`) |

**화면**: 편집기는 `concept/board-kit.js` 를 실으면 (`window.BOARD` 없이) `window.ApplyLog` 를 쓸 수 있다 — `head(applied, {label})` 머리 줄, `list(history, {action: h => 단추 HTML, title})` 기록 목록, `watch(db, id, {onApplied, onHistory})` 구독, `esc`·`when`. 보드와 같은 클래스(`.hist`, `details`)를 쓰니 편집기 CSS 에 `.hist` 정도만 있으면 된다. 붙이는 방법 제안은 `docs/notes/m6-p1-hub.md`.
