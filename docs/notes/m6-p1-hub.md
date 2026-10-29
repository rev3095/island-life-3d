편집기 홈: https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv · 파일 `editors.html`

# M6-P1 편집기 홈 · 전체 요청 확인 · 반영 기록 공용 (ET-01 · ET-11) — 작업 노트

브랜치 `p9-hub` · 포트 4222. 검수 보드 wave6 반영 v1: **D26-A** 편집기 홈 + 편집기는 따로 · **D27-A** 지금 명령 그대로 + "전체 요청 확인".

## 한 것

| 무엇 | 어디 |
|---|---|
| 편집기 홈 아티팩트 (버전 1, icon `home`, capabilities `db` 규칙 `status`·`meta` 쓰기 admin + `user`) | `editors.html` |
| 홈 목록 JSON (`editors-list`: 편집기 3 · 보드 3 · 지난 보드 1 · 게임 · 6차 자리 4) | `editors.html` 안 |
| 처음 현황 `status/*` 11개 + `meta/check` (2026-10-29 12:14 UTC 에 각 저장소를 읽어서) | 홈 저장소 |
| 반영 기록 공용 도구 `window.ApplyLog` (`head`·`list`·`watch`·`sort`·`esc`·`when`) — 보드 화면은 이걸로 그린다 | `concept/board-kit.js` 맨 위 |
| 홈 모양 · "전체 요청 확인" 순서 · 반영 기록 공용 모양(ET-11) | `concept/README.md` |
| 편집기 절 · 검수 보드 절에 홈·전체 요청 확인·status 갱신 | `CLAUDE.md` |
| 목록 ↔ 문서 링크, 보드 id, ApplyLog 검사 (4개) | `tests/hub.test.mjs` |

처음 채울 때 읽은 것: 캐릭터 `requests` · 배경 `env-requests` 는 비어 있음(새 요청 0), 시나리오 `applied/story` v1 · `history` v0·v1 · `drafts` 없음 · `timeline/main` 없음, 보드 셋 모두 `boards/<id>` = `applied/<id>` (바뀐 선택 0, 의견 없음). 게시 버전은 devlog 「게시물」 표에서 (캐릭터·배경 6, 5차 보드 2, Z5·6차 보드 1, 게임 6). 시나리오 편집기 게시 버전은 기록이 없어 비워 둠.

## 설계 결정

- **홈은 읽기만, Claude 가 쓴다.** 아티팩트는 다른 아티팩트의 저장소를 읽지 못해서, 홈 저장소의 `status/<id>` 를 Claude 가 "전체 요청 확인"·각 반영 때 ArtifactData 로 써 넣는다. 그래서 숫자는 "마지막으로 확인한 때" 기준이고, 홈 화면에도 그렇게 적었다.
- **목록은 홈 파일 안 JSON 한 덩어리.** "전체 요청 확인" 때 Claude 가 읽는 목록, 화면, 테스트가 같은 글을 본다. 항목의 `reads` = 그 아티팩트에서 읽을 곳.
- **새 편집기 링크는 두 길.** 홈을 다시 게시하지 않고 `status/<id>.url` 만 써 넣어도 자리가 채워진다 (`https://claude.ai/artifact/…` 만 받음). 합친 뒤엔 목록의 `url` 에 적고 다시 게시하는 게 정식.
- **`ApplyLog` 는 새 파일이 아니라 `board-kit.js` 안에.** 보드 html 은 이 트랙 파일이 아니라서 `<script>` 를 더할 수 없고, 게시된 보드는 `board-kit.js` 하나만 갖고 있다. 따로 떼면 보드를 다시 올릴 때 파일 하나를 빠뜨리면 상태 칸이 깨진다. 대신 `window.BOARD` 가 없으면 보드 부분은 건너뛰고 `ApplyLog` 만 실리게 해서, 편집기·홈은 `board-kit.js` 를 실어 같이 쓴다. 보드 화면 HTML 은 예전과 같다 (머리 줄·기록 목록·되돌리기 단추·disabled 조건 그대로).
- **편집기 되돌리기 요청 = 요청 컬렉션의 한 줄** `{ kind: 'rollback', to: n, status: 'new' }`. 새 요청 수에 같이 잡히고 그 편집기의 명령으로 처리돼서 따로 흐름을 만들 필요가 없다. 보드(선택 다시 고르기)·시나리오(`timeline/main.rollback`)는 지금 방식 그대로.
- 기록 칸 이름 `board` 는 편집기도 그대로 쓴다 (시나리오가 이미 `board: 'story'` 로 쓰고, `history` 를 `where('board','==',id)` 로 고른다).

## 다른 트랙·세션에 드리는 제안 (이 트랙은 그 파일을 고치지 않음)

1. **배경 편집기 `bg-editor.html` (M6-P2 `p9-bgtabs`)** · **캐릭터 편집기 `editor.html` (지금 아무도 — M6-P3 때)**: 반영 기록 칸 붙이기.
   - `<script src="concept/board-kit.js"></script>` 를 페이지 스크립트보다 먼저, 게시 `files` 에 `"concept/board-kit.js": "concept/board-kit.js"` (편집기가 루트에 있어서 홈처럼 이 경로면 로컬·게시본이 같다).
   - 저장소에 붙은 뒤: `ApplyLog.watch(db, 'env', { onApplied: d => …, onHistory: rows => … })`, 상태 칸에 `ApplyLog.head(applied)` + `ApplyLog.list(history, { action: h => '<button data-rollback="…">이 버전으로 되돌리기 요청</button>' })`.
   - 되돌리기 단추: `store.add('env-requests', { kind: 'rollback', to: v, status: 'new', createdAt: Date.now(), by: await store.who() })` (캐릭터는 `requests`).
   - capabilities 다시 선언 때 규칙 더하기: `{"path":"applied","read":"view","write":"admin"},{"path":"history","read":"view","write":"admin"}`. **capabilities 를 넘기면 전체를 다시 선언하는 것**이라 지금 쓰는 `db`·`assets`·`user` 를 모두 다시 적어야 한다 (생략하면 그대로).
   - 머리에 편집기 홈 링크 하나 (`https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv`).
2. **시나리오 편집기 `story-editor.html` (story 세션)**: 기록 모양은 이미 같다. 바꿀 것은 없고, 원하면 자기 기록 목록을 `ApplyLog.list` 로 바꾸고 머리에 홈 링크. `applied/story` 의 `scenes` 는 공용 모양의 `items` 자리로 본다 (이름은 그대로 둬도 된다).
3. **6차 새 편집기 (M6-P4 `p9-sound` · P5 `p9-mapdata` · P6 `p9-style`)**:
   - 편집기 id 는 홈 목록 id 그대로: `sound` · `map` · `data` · `style`. 반영 기록은 `applied/<id>`·`history/<id>-v<n>` (공용 모양, `changed` 칸), 규칙 `applied`·`history` 쓰기 admin.
   - 새 요청은 `requests` 컬렉션 `status: 'new'` 로 두면 "전체 요청 확인"이 따로 설명 없이 읽는다. 값 문서(`drafts/…` 처럼)와 `applied` 를 비교하는 방식이면 `docs/notes/<트랙>.md` 에 "전체 요청 확인 때 읽을 곳"을 한 줄로.
   - 게시하면 링크를 조정 세션에 알려 주기 → `status/<id>.url` 로 바로 채우고, 합칠 때 목록 `url`·`reads` 에 적는다.
4. **조정 세션 (합친 뒤)**:
   - `editors.html` 목록의 6차 자리 `url`·`reads` 채우고 홈 다시 게시: `file_path: editors.html`, `files: {"concept/board-kit.js": "concept/board-kit.js"}`, capabilities 생략.
   - devlog 「게시물」 표에 편집기 홈 줄 (링크 위, 버전 1). PLAN 6차 표 P1 끝.
   - 보드 셋(wave5·z5·wave6)은 `board-kit.js` 가 바뀌었지만 화면이 같아서 다시 올리지 않아도 된다. 다음에 보드를 다시 올릴 때 새 파일이 같이 간다.
   - 게임 다시 게시(M6-P0 뒤)나 편집기 게시가 있을 때마다 홈 `status/<id>.published` 를 고친다.

## 확인

- `node --test tests/` 전체 통과 (새 `hub.test.mjs` 4개 포함).
- 로컬 dev-server 4222: `/editors.html` 콘솔 오류 0, 휴대폰 폭(375) 어두운 테마에서 가로 넘침 없음, `#character` 같은 카드 링크로 바로 감, 로컬 흉내(`assets/review/hub-status.json`)로 새 요청·반영 요청 표시·기록 목록 그려짐. `/concept/wave5-board.html`·`/concept/wave6-board.html` 콘솔 오류 0, 결정 라디오·상태 칸 그대로, 가짜 저장소를 붙여 반영 기록 2개·되돌리기 단추·요약 글 escape 확인.
- 게시본: 홈 저장소 `status` 를 보기 전용 수준(`as_level: view`)으로 읽어 11개 문서가 보임.
- 못 한 것: claude.ai 에서 게시본 홈을 직접 열어 보기(사용자), 쓰기 규칙(admin 만)을 실제 낮은 권한으로 써 보기 — 시험 쓰기는 하지 않았다.
