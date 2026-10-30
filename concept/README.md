# 검수 보드 (concept/)

새 리소스나 큰 결정이 필요한 차수는 **만들기 전에 검수 보드부터** 보여 주고, 사용자가 보드에서 고른 선택대로 진행한다. 결정이 바뀌거나 되돌릴 때도 사용자는 보드를 고친 뒤 채팅에 **"검수 보드 반영"** 이라고 한다.

모든 편집기·보드 링크와 현황은 **편집기 홈** (https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv, `editors.html`) 에 모여 있다 — 아래 「편집기 홈」·「"전체 요청 확인"」·「반영 기록 공용 모양」.

| 보드 | 파일 | 링크 | 보드 id |
|---|---|---|---|
| 컨셉 보드 v0.1 (1차 계획, 저장 없음) | `concept-board.html` | https://claude.ai/artifact/6Z5WJmpKasDRyVANYbwauM | — |
| 5차 검수 보드 v0.5 | `wave5-board.html` + `board-kit.js` | https://claude.ai/artifact/QmguFLRgBq2FUa3RnD8RbT | `wave5` |
| Z5 축제 검수 보드 v0.1 (이모티콘 대화·축제 광장·부품·부스·엔딩, D14–D25) | `z5-festival-board.html` + `board-kit.js` | https://claude.ai/artifact/Cqjh9RiTwUn1CcPhCNtoWS | `z5` |
| 6차 검수 보드 v0.6 (M6 편집기 완성) | `wave6-board.html` + `board-kit.js` | https://claude.ai/artifact/Lz3rV3HxTzQVV4RJt1DYvU | `wave6` |
| 7차 검수 보드 v0.7 (M7 출시 준비, D36–D48) | `wave7-board.html` + `board-kit.js` | https://claude.ai/artifact/HuSkBdHEr2VrWxts9YtStV | `wave7` |

## ID 표 (새 ID 는 여기 다음 번호부터 — 겹치지 않게)

| 접두사 | 무엇 | 쓴 번호 |
|---|---|---|
| D | 결정 | D1–D7 (v0.1) · D8–D13 (wave5) · D14–D25 (z5) · D26–D35 (wave6) · D36–D48 (wave7) |
| CH | 캐릭터 | CH-01–10 (CH-11·12 는 후보만) |
| EN · PR · BD · TI | 배경: 자연 · 소품 · 건물 · 타일 | EN-01–11 · PR-01–12 (+z5 PR-13–16) · BD-01–05 (+z5 BD-06–07) · TI-01–07 (+z5 TI-08) |
| FU | 가구 | FU-01–33 (+z5 FU-34) |
| IC-xx | 아이템 아이콘 (TL MA SD FR SH FL FS BG FO, z5 FE) | 분류마다 01부터 |
| WP · FL · RM | 벽지 · 바닥 · 방 배치 | WP-01–08 · FL-01–08 · RM-01–07 |
| EM · TK · FP · FB · AN · ED · SF · UI | z5: 이모티콘 · 주민 읽기 규칙 · 축제 부품 · 부스 · 동작 · 엔딩 컷 · 이야기 흐름 · 화면 | EM-01–36 · TK-01–07 · FP-01–05 · FB-01–05 · AN-01–05 · ED-01–06 · SF-1–6 · UI-04–05 |
| s01– | 장면 (시나리오 편집기) | s01–s12 |
| ET | 편집기 (wave6) | ET-01– |
| UI · RC · QA | wave7: 새 화면 (UI-01–03 v0.1, UI-04–05 z5 다음) · 출시 점검표 · QA 결과 (`docs/qa/` 에서 올린 큰 문제) | UI-06–11 · RC-01–12 · QA-01– |

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

https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv · 파일 `editors.html` (저장소 루트). 모든 편집기·검수 보드·게임 링크를 한곳에서 열고, 편집기마다 무엇을 고치는지 · 채팅 명령 · 마지막 반영 버전 · 처리할 것 수를 보여 준다. 6차에 생길 편집기(곡·지도·숫자·스타일)는 링크 없는 자리로 둔다.

- **목록 = `editors.html` 의 `<script type="application/json" id="editors-list">`.** 항목 `{ id, group: editor|board|game|soon|archive, name, url, file, edits, command, openLabel, reads, et?, track?, later? }`. `reads` 는 "전체 요청 확인" 때 Claude 가 그 아티팩트 저장소에서 읽을 곳. `tests/hub.test.mjs` 가 목록 ↔ CLAUDE.md·이 표·시나리오 노트의 링크, 보드 id ↔ `window.BOARD.id` 를 검사한다.
- 아티팩트는 다른 아티팩트의 저장소를 읽을 수 없다 → 홈은 **자기 저장소의 문서만** 보여 주고, 그 문서는 Claude 가 ArtifactData 로 써 넣는다 (홈 페이지는 읽기만). 숫자는 Claude 가 마지막으로 확인한 때 기준이다.

| 문서 (홈 저장소) | 모양 | 쓰는 쪽 |
|---|---|---|
| `status/<목록 id>` | `{ id, open, openItems, requested, applied, recent, published, note, url, checkedAt, updatedAt, updatedBy: 'claude' }` | Claude (쓰기 admin) |
| `meta/check` | 마지막 "전체 요청 확인" `{ at, summary, open, by: 'claude' }` | Claude (쓰기 admin) |

`status` 칸: `open` = 아직 처리 안 한 것 수 (캐릭터·배경: `status:'new'` 요청 · 보드: `applied` 뒤 바뀐 결정·의견 · 시나리오: 바뀐 장면·순서·의견 · 새 편집기: 그 편집기 노트가 정한 것), `openItems` = 짧은 이름 최대 5개, `requested` = 편집기·보드에서 "반영 요청 표시"를 눌렀는지, `applied` = 그 편집기 `applied/<id>` 요약 `{version, appliedAt, summary, commit}` (없으면 `null`), `recent` = `history` 최근 3개 `{version, appliedAt, summary}` (새 것부터), `published` = 그 편집기 아티팩트 게시 버전, `note` = 한 줄 상황, `url` = 목록에 링크가 없는 새 편집기의 링크 (`https://claude.ai/artifact/…` 만 받아 줌 — 홈을 다시 게시하지 않고 자리를 채울 때). 목록에 없는 칸은 비워 둬도 된다.

게시: `file_path: editors.html`, `files: {"concept/board-kit.js": "concept/board-kit.js"}` (홈은 루트에 있어서 로컬과 같은 경로), `capabilities: {"db": {"rules": [{"path":"status","read":"view","write":"admin"},{"path":"meta","read":"view","write":"admin"}]}, "user": {}}`, 첫 게시 `icon: "home"`. 로컬 확인은 dev-server `/editors.html` — `/api/db/hub-status`·`hub-meta` (`assets/review/hub-*.json`, 행마다 `docId`) 를 읽는다.

## "전체 요청 확인" (Claude 가 하는 일, D27-A)

지금 명령("요청 확인" · "배경 요청 확인" · "시나리오 반영" · "검수 보드 반영" · 6차 새 명령)은 그대로 두고, 모든 편집기를 한 번에 도는 명령을 더한 것.

1. **목록 읽기**: `editors.html` 의 `editors-list` + 홈 저장소 `status/*` (`ArtifactData list`, 홈 링크는 위). `url` 이 없는 자리는 `status/<id>.url` 을 쓴다. `command` 가 없는 것(게임·지난 보드)은 건너뛴다.
2. **모으기** (읽기만): 항목마다 `reads` 대로 그 아티팩트 저장소를 읽는다.
   - 캐릭터 `requests` · 배경 `env-requests`: `query where status == 'new'` (되돌리기 요청 `kind: 'rollback'` 포함).
   - 시나리오: `drafts` 목록 · `timeline/main` · `applied/story` → `docs/notes/story.md` 의 "바뀐 것".
   - 보드: `boards/<id>` 와 `applied/<id>` 의 `picks`·`notes` 비교, `status == 'requested'`.
   - 새 편집기: 그 트랙 노트(`docs/notes/<트랙>.md`)가 정한 곳 — 정하지 않았으면 아래 공용 모양(`applied/<id>` + `requests` `status:'new'`).
3. **먼저 보여 주기**: 편집기마다 새 것 수와 짧은 목록을 표로 보여 준다. 아무것도 없으면 `status/*`·`meta/check` 의 `checkedAt`·`at` 만 고치고 끝.
4. **처리 순서**: 검수 보드(결정이 다른 일의 방향을 바꾼다) → 캐릭터 → 배경 → 시나리오 → 새 편집기. 각각 **그 편집기의 기존 흐름** 그대로 (CLAUDE.md 「편집기와 "요청 확인" 흐름」, 이 문서 「"검수 보드 반영"」, `docs/notes/story.md` 「시나리오 반영」, 새 편집기 노트). 트랙 하나만큼 큰 일(새 편집기·새 리소스 묶음, 보드 결정 변경)은 세션·브랜치로 나눠 제안하고, 나머지를 먼저 끝낸다. 되돌리기는 무엇을 되돌리는지 먼저 보여 준다.
5. **테스트**: `node --test tests/` 한 번 (편집기마다 따로 돌리지 않아도 된다 — 마지막에 한 번은 꼭).
6. **다시 게시**: 바뀐 편집기마다 바뀐 파일만, 게임 링크는 맨 끝에 한 번 (D35-A).
7. **기록**: 편집기마다 `applied/<id>`·`history/<id>-v<n>` (아래 공용 모양), 요청은 `done` + `reply` + `doneVersion`. 그다음 홈 `status/<id>` 전부 (`open`·`openItems`·`requested`·`applied`·`recent`·`published`·`checkedAt`) 와 `meta/check` (`at`, `summary` = "새 요청 3 처리 · 보드 1 반영" 처럼, 남은 것 수 `open`) 를 한 번의 `batch` 로.
8. 사용자에게 편집기별로 한 것·남은 것·확인 못 한 것을 나눠 보고.

편집기 하나의 명령("요청 확인" 등)만 왔을 때도 끝에 홈 `status/<그 id>` 를 고친다 (`meta/check` 는 그대로).

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

편집기 id = 홈 목록 id: `character` · `env` · `story` · `sound` · `map` · `data` · `style` (보드는 `wave5` · `z5` · `wave6`).

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
