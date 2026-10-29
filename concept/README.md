# 검수 보드 (concept/)

새 리소스나 큰 결정이 필요한 차수는 **만들기 전에 검수 보드부터** 보여 주고, 사용자가 보드에서 고른 선택대로 진행한다. 결정이 바뀌거나 되돌릴 때도 사용자는 보드를 고친 뒤 채팅에 **"검수 보드 반영"** 이라고 한다.

| 보드 | 파일 | 링크 | 보드 id |
|---|---|---|---|
| 컨셉 보드 v0.1 (1차 계획, 저장 없음) | `concept-board.html` | https://claude.ai/artifact/6Z5WJmpKasDRyVANYbwauM | — |
| 5차 검수 보드 v0.5 | `wave5-board.html` + `board-kit.js` | https://claude.ai/artifact/QmguFLRgBq2FUa3RnD8RbT | `wave5` |
| Z5 축제 검수 보드 v0.1 (이모티콘 대화·축제 광장·부품·부스·엔딩, D14–D25) | `z5-festival-board.html` + `board-kit.js` | https://claude.ai/artifact/Cqjh9RiTwUn1CcPhCNtoWS | `z5` |

## 새 보드 만드는 법 (6차부터)

1. `wave5-board.html` 을 복사해 `wave<N>-board.html` 로. 색·글꼴·카드 모양은 그대로 두고 내용만 바꾼다.
2. 결정은 `DECISIONS` 배열 `{ id: 'D14', q, opts: [[key, 제목, 설명, 추천?], …] }` — 추천안 하나에 `true`. 결정 id 는 차수가 바뀌어도 이어서 매긴다 (D1–D7 v0.1, D8–D13 5차 …).
3. 리소스마다 ID 를 붙이고(FU-34, PR-13 …, 이미 쓴 번호 다음부터) 카드에 `noteBox(ID, 이름)` 의견 칸을 둔다. 그림은 SVG 스케치.
4. 페이지 스크립트 끝에 `window.BOARD = { id: 'wave<N>', decisions: DECISIONS };`, 그 뒤 `<script src="board-kit.js"></script>`, 머리에 `<div id="boardPanel" class="out board"></div>`.
5. 게시: `file_path` = 보드 html, `files: {"board-kit.js": "concept/board-kit.js"}`, `capabilities: {"db": {"rules": [{"path":"applied","read":"view","write":"admin"},{"path":"history","read":"view","write":"admin"}]}, "user": {}}`. 첫 게시에 `icon: "palette"`.
6. 이 표와 devlog 「게시물」에 보드를 더한다.

`board-kit.js` 가 하는 일: 선택·의견을 보드 저장소 `boards/<id>` 에 바로 저장(저장소를 못 쓰는 창은 브라우저에만), 마지막 반영 `applied/<id>` 와 비교해 바뀐 카드에 테두리, 반영 기록 `history/<id>-v<n>` 목록과 **이 선택으로 되돌리기**, **반영 요청 표시** 단추.

## "검수 보드 반영" (Claude 가 하는 일)

1. ArtifactData `get` 으로 `boards/<id>` 와 `applied/<id>` 를 읽는다 (보드 링크는 위 표).
2. 결정(`picks`)과 의견(`notes`)을 비교해 바뀐 것만 고른다. 바뀐 게 없으면 그렇게 알리고 끝.
3. 바뀐 것마다 할 일을 정한다:
   - **결정 변경**: 그 결정에 걸린 트랙·파일을 고친다 (아직 안 만든 것이면 계획만 바꾼다).
   - **되돌리기**: 선택이 `history/<id>-v<n>` 와 같아졌으면 v<n> 의 `commit` 이후에 그 결정 때문에 들어간 커밋을 `git revert` 한다 (합친 커밋이면 `git revert -m 1`). 사용자에게 무엇을 되돌리는지 먼저 보여 준다.
   - **의견**: 그 ID 리소스의 스펙·그림·보드 카드를 고친다.
4. 평소처럼 세션·브랜치로 작업 → 테스트 → 사용자 승인 뒤 `main` 에 합친다.
5. 반영이 끝나면 `applied/<id>` 를 `version + 1` 로 바꾸고, 같은 내용으로 `history/<id>-v<새 버전>` 을 만든다 (`{board, version, picks, notes, appliedAt, summary, commit}` — `commit` 은 반영 직전 `main` 해시). `boards/<id>` 의 `status` 는 `editing` 으로.
6. 보드 내용(카드·ID)이 바뀌었으면 보드를 같은 파일로 다시 게시한다 (capabilities 는 생략하면 그대로).
