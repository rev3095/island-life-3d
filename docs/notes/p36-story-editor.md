스토리 편집기: https://claude.ai/artifact/NrmMmozFXQCdiw1oQMxCyF · 파일 `story-editor.html` + `story-editor/words.js` · 게시 목록 `assets/story/editor-files.json`

# P36 ② 스토리 편집기 — 작업 노트 (`p36-story-editor` 브랜치)

사용자 요청 "리소스 변경 고려해서 분리, 스토리 분리, 요소 분리 편집기" 중 **스토리**. 글과 이야기에 관한 것을 한 편집기에 모았다.
**예전 시나리오 편집기 아티팩트를 같은 링크로 키웠다** — 저장소 `drafts`·`timeline`·`applied/story`·`history` 가 그대로 이어진다. 그래서 홈 목록은 새 줄을 더하고 옛 줄을 archive 로 옮기는 대신 **`story` 줄을 그 자리에서 고쳤다** (같은 링크를 두 줄로 두면 "전체 요청 확인" 때 같은 저장소를 두 번 읽는다).
확인: `node dev-server.mjs --port=4237` → `/story-editor.html` (`#villager/coco` · `#letters` · `#texts` 로 탭을 바로 연다).

## 화면 — 탭 넷

| 탭 | 고치는 것 | 파일 | 「언제 나오나」 |
|---|---|---|---|
| **장면** | 예전 시나리오 편집기 그대로: 타임라인·장면 정보·연출안·컷 스토리보드·스케치 미리 보기·의견 | `assets/story/` | 트리거 (타임라인 칸·「언제 시작」) |
| **주민** | 주민 10 + 가게 주인 2(밤톨·느루) 고르기 → 갈래 다섯 (성격·말버릇 · 좋아하는 것·부탁 · 이모티콘 반응 · 글 대사 · 생일·시간표; 가게 주인은 둘). 왼쪽 **대답 시험** (게임 판정 `festival/judge.js`·선물 반응·인사 대사 그대로, 3D 모델 몸짓만 뺌) | `assets/villagers/<slug>.json`, 생일 `assets/data/rules.json` | 대사 묶음마다 🕰 줄 (시간대 시각 · 행사 날짜 · 부탁/선물 단계) |
| **편지** | 편지 종류 칩(친구·단짝·고마워·선물 동봉·주민 생일·내 생일·이사 전날·이사 온 날·떠난 뒤·환영·집터)을 고르면 그 종류를 가진 주민 편지가 모두 나온다 + **밤톨 안내 글**(처음·첫날·오늘 들어온 가구·그다음·문 닫은 때). 편지 한 통 = 한 칸, 칸 안 줄 = 편지 줄 | 주민 파일 `lines.letters.*` · 밤톨 `lines.*` | 종류마다 (`words.js` `LETTER_WHEN`, `town/mail.js`·`rules.js`·`moving.js`·`movein.js`·`party.js`·`keepers.js` 에서 읽음) |
| **그 밖의 글** | **밤·새벽**: 야시장·달빛 가게·새벽 천막 이름, 타로 카드 글·효과 설명, 별밤·여명 대사, 야시장 알림·고리 던지기 말, 야행성 집 쪽지·방문 말. **계절 행사**: 이름·할 일 이름·「축제 전」 한마디 + 행사 기간 주민 대사(주민 파일 `lines.event.EV-0n`, 접어 둠). **투어**: 글이 아직 코드(`src/gameplay/tour/index.js`) 안이라 의견만 | `assets/night/night.json` · `assets/events/events.json` · `assets/tour/tour.json` | 영업시간·요일·행사 날짜·장소·맡은 주민 |

- 숫자·때·id·구조는 고치지 않는다 (「요소」 편집기 몫). 글 칸 = 한글이 든 문자열 (`about`·`note`·`id`·`sym`·`color` … 제외, `words.js` `textLeaves` = `apply-texts.mjs` 와 같은 규칙).
- 머리의 반영 상태 칸은 네 탭을 합쳐 보여 준다 (장면 · 주민 이름 · 「밤 · 새벽」 …), 탭 이름 옆 숫자 = 그 탭의 바뀐 것 수. 「반영 요청 표시」 하나가 모두를 덮는다 (`timeline/main.status = 'requested'`).
- 편지 탭·행사 대사에서 고친 것도 그 주민의 같은 초안(`talk/<slug>`)에 들어간다. 주민 탭에서 그 주민에 빨간 점.
- 예전 캐릭터 편집기 탭과 다른 점: 「요청 보내기」 단추가 없다 — 고치면 바로 저장(장면 탭과 같게)되고 반영 요청 표시로 알린다. 3D 모델 몸짓 대신 썸네일.

## 저장소 (이 아티팩트 db) — 새 컬렉션 둘

| 문서 | 모양 | 쓰는 쪽 |
|---|---|---|
| `drafts/<장면 id>` · `timeline/main` · `applied/story` · `history/story-v<n>` | `docs/notes/story.md` 그대로 | 편집기 / Claude |
| **`talk/<slug>`** | `{ slug, kind: 'traits', base: <주민 파일 version>, changes: { '<주민 파일 안 경로>': 값 }, rules: { 'birthdays/dates/<slug>': 'MM-DD'\|null }, request: '의견', text, updatedAt, updatedBy }` — **`tools/apply-traits.mjs` 요청과 같은 모양** (예전 캐릭터 편집기 `requests` 의 `kind:'traits'`) | 편집기 |
| **`texts/<night\|events\|tour>`** | `{ which, file, base: <파일 version>, changes: { '<파일 안 경로>': '새 글' }, request, text, updatedAt, updatedBy }` (`which` = 글 파일 — 로컬 흉내가 행마다 `id` 를 덮어써서 `id` 를 쓰지 않는다) | 편집기 |

- 편집기는 `base` 가 **지금 게시된 파일 version 과 같은 초안만** 읽는다 → 반영해서 파일 version 이 오르면 예전 초안은 저절로 빠진다 (지울 필요는 없지만 지워도 된다).
- `applied/story` 는 공용 모양을 더한다: `{ board: 'story', version, appliedAt, summary, commit, scenes: {id: v}, picks, notes, villagers: {slug: v}, texts: {night: v, …}, changed: [{ id, label, what: 'edit'|'traits'|'texts'|'add'|'remove'|'rollback', version, request? }] }`.
- 로컬 dev-server: `/api/db/story-<컬렉션>` → `assets/review/story-talk.json`·`story-texts.json` (gitignore).

## "스토리 반영" (Claude 가 하는 일) — 예전 "시나리오 반영" + 성격·대화 `kind:'traits'` 를 하나로

0. 작업 트리를 main 에 맞춘다. 저장소에서 `drafts`·`timeline/main`·`talk`·`texts`·`applied/story` 를 읽는다 (`db_list` / `db_get`).
1. **장면** — `docs/notes/story.md` 「시나리오 반영」 2번 그대로 (고침 = `version` +1·확정이면 review, 새 장면 = 파일+index.json+files.js, 뺀 장면, 순서, 의견, 되돌리기). 장면 파일 모양(들여쓰기)은 지금 파일에 맞춘다.
2. **주민** — `talk/<slug>` 마다 (`base` 가 지금 파일 version 과 다르면 그 사이 반영을 먼저 본다): 문서를 파일로 받아 `node tools/apply-traits.mjs <talk.json> --dry` → 확인 → `--dry` 없이 (주민 파일 `version` +1, 생일이면 rules.json `version` +1). 의견(`request`)은 직접 대사·값을 고친다 (`traits.speech`·`ending` 말투 따라) — 같은 파일이라 version 은 한 번만.
3. **그 밖의 글** — `texts/<id>` 마다 `node tools/apply-texts.mjs <texts.json> --dry` → 쓰기 (`version` +1, 글 칸만, 파일 모양 그대로). 의견은 직접 (투어 글은 `src/gameplay/tour/index.js` — 많아지면 `tour.json` 에 `lines` 칸으로 옮기자고 제안).
4. `node --test tests/` — 걸리는 것 다루기는 `docs/notes/m6-p3-traits.md` 「요청 확인」 5번 그대로 (지문 테스트는 고친 주민을 건너뜀, 사용자가 일부러 바꾼 값을 박아 둔 테스트만 기대값 고침, 규칙 검사에 걸리면 `git checkout -- assets/villagers assets/data/rules.json assets/night assets/events assets/tour` 로 되돌리고 이유 알림). `tests/night.test.mjs`·`events` 테스트가 글을 박아 두었으면 같은 규칙.
5. 게임에서 보기: dev-server `/index.html?story=<id>&take=<key>` (장면) · `?debug` 에서 `__island.services.town.talkTo('<slug>')` (대사) · 밤/행사는 그 때로 시계를 돌려서 (`docs/notes/m12-night.md`·`check-events.mjs`).
6. 커밋 (`스토리 반영 v<n>: …`).
7. 편집기 다시 게시: 바뀐 파일만 (아래 「게시」), capabilities 는 그대로.
8. 반영한 장면의 `drafts/<id>` 는 `scene` 을 새 파일 내용으로 덮는다 (안 그러면 「고침」으로 남는다 — 장면 초안에는 base 가 없다). `timeline/main` = `status:'editing'`, `rollback` 지움. `talk`·`texts` 는 그대로 둬도 되고 지워도 된다.
9. `applied/story` `version` +1 (위 모양) · `history/story-v<n>` (같은 내용) → 편집기 홈 `status/story` · `catalog/scene` (+ 주민 줄이 생기면 그 분류).
10. 게임 링크 게시는 조정 세션 (main 합친 뒤).

**되돌리기** (`timeline/main.rollback = n`): `history/story-v<n>.commit` 의 `assets/story src/gameplay/story/files.js assets/villagers assets/night assets/events assets/tour` + rules.json `birthdays` 칸. 무엇을 되돌리는지 먼저 보여 준다.

## 게시

- 같은 아티팩트(slug `b102b17a-2146-42ea-b83f-255f0bb90a02`)에 `publish_files`. 먼저 `list_files` 로 게시본을 본다.
- 페이지 = `story-editor.html` 을 `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n` + 파일 + `\n</body>\n</html>\n` 로 감싼 사본을 `index.html` 로 (devlog 2026-11-10 메모).
- 나머지 = `assets/story/editor-files.json` 의 `files` (74개, 게시 경로 = 저장소 경로 — `tests/story-editor.test.mjs` 가 페이지에서 닿는 모듈·데이터를 다 담는지 본다). 다시 게시는 바뀐 것만.
- capabilities 는 바꾸지 않는다: `db` (`applied`·`history` 쓰기 admin) · `user`. 새 컬렉션 `talk`·`texts` 는 기본 규칙(편집 권한이면 쓰기)으로 충분.

## 게시 기록

| 버전 | 날짜 | 내용 |
|---|---|---|
| (이번) | 2026-11-11 | 스토리 편집기 첫 게시 — 탭 넷, 파일 36 → 75 |

## 확인한 것

- dev-server 4237: 1200px·375px 모든 탭·갈래(주민 다섯·편지 종류 열둘·글 셋, 가게 주인) 가로 넘침 0, 콘솔 오류 0.
- 반영 흐름 끝까지 (로컬 저장소 흉내): 편집기에서 코코 잡담 첫 줄 + 의견, 별밤 인사 첫 줄, s02 첫 컷 설명을 고침 → `story-talk.json`·`story-texts.json`·`story-drafts.json`·`timeline requested` 저장, 새로고침해도 그대로 → `apply-traits.mjs`(coco v2)·`apply-texts.mjs`(night v2, 바뀐 줄 둘)·장면 파일(s02 v2 review) → `node --test tests/` 429 통과 (지문은 코코를 건너뜀) → 편집기를 다시 열면 주민·밤 초안은 저절로 빠짐, drafts 를 맞추고 `applied/story` v1 을 쓰니 「게임에 들어간 스토리 v1 · 바뀐 것 없음」 → `town/people.js` 가 새 대사를, night.json 이 새 인사를 읽음. 시험이라 파일은 되돌림.
- 못 한 것: claude.ai 안에서 직접 눌러 보기(저장소 쓰기 권한·`user`), 게임 창에서 별밤에게 말 걸기(밤 22시 시계 돌리기).

## 조정 세션에 (다른 파일 — 합칠 때 한 번에)

### CLAUDE.md 바꿀 문장

- 「스토리와 "시나리오 반영" 흐름」 절 제목 → **「스토리와 "스토리 반영" 흐름」**, 둘째 줄을 이것으로:
  > - **스토리 편집기** `story-editor.html` (아티팩트 https://claude.ai/artifact/NrmMmozFXQCdiw1oQMxCyF — 예전 시나리오 편집기를 같은 링크로 키움, capabilities `db`·`user`, `applied`·`history` 쓰기 admin, 모듈 `story-editor/words.js`, 게시 목록 `assets/story/editor-files.json`): 탭 **장면 · 주민 · 편지 · 그 밖의 글**, 글마다 언제 나오는지(트리거·시간대·행사)를 같이 보여 준다. 고친 것은 바로 `drafts/<장면 id>`·`timeline/main` (장면), `talk/<slug>` (주민 파일·생일, `apply-traits` 요청 모양), `texts/<night|events|tour>` (글 칸) 에 저장된다.
- 셋째 줄 (명령) 을 이것으로:
  > - 채팅에 **"스토리 반영"**(예전 "시나리오 반영"도 같은 뜻)이 오면: 장면은 `docs/notes/story.md` 「시나리오 반영」 2번대로, `talk/*` 는 `node tools/apply-traits.mjs`, `texts/*` 는 `node tools/apply-texts.mjs` (`--dry` 먼저, 바뀐 파일 `version` +1) → 의견은 직접 → `node --test tests/` → 게임에서 확인 → 커밋 → 편집기 다시 게시 (바뀐 파일만) → 반영한 장면 drafts 를 새 파일로 · `applied/story` +1 · `history/story-v<n>`. 자세한 순서는 `docs/notes/p36-story-editor.md` 「스토리 반영」.
- 「편집기와 "요청 확인" 흐름」의 **캐릭터 편집기 「성격·대화」 탭** 줄 → 이것으로 (리소스 편집기 세션이 탭을 빼는 것과 같이):
  > - 주민 성격·대화 (6차 M6-P3, P36 부터 **스토리 편집기 「주민」 탭**): 주민 데이터는 주민마다 `assets/villagers/<slug>.json` 한 파일 (…모양은 그대로…). 생일만 `assets/data/rules.json` `birthdays`. 반영은 "스토리 반영" (`talk/<slug>` → `tools/apply-traits.mjs`). 예전 캐릭터 편집기 `requests` 의 `kind:'traits'` 가 남아 있으면 같은 도구로 처리한다. 자세한 칸·검사는 `docs/notes/m6-p3-traits.md`.
- 「"전체 요청 확인"」 줄의 처리 순서 "캐릭터 → 배경 → 시나리오" 의 "시나리오" → "스토리".

### 그 밖에

- **`tests/villagers.test.mjs` 「캐릭터 편집기: 「성격·대화」 탭 게시 파일 목록…」** (`assets/villagers/editor-files.json`, `editor.html` 에 `kind: 'traits'`): 리소스 편집기 세션이 탭을 빼면 이 테스트가 깨진다 → 지우거나 리소스 세션 쪽 목록으로. 스토리 편집기 쪽 같은 검사는 `tests/story-editor.test.mjs` 가 따로 한다.
- **`editors.html` `character` 줄 `edits`** 의 "주민 9명 성격·…(성격·대화 탭, #coco.talk)" 은 리소스 세션이 고친다. 홈 「반영 순서」 표의 `"요청 확인"` 줄 "캐릭터·주민 성격 요청" 도.
- **`concept/README.md`**: 「편집기 홈」 표의 "시나리오" → "스토리" (85·158·164줄), 「반영 기록 공용 모양」 맡은 파일 표 `story` 줄에 `assets/villagers/`, `assets/night/`·`events/`·`tour/` 의 글 칸, rules.json `birthdays` (`character` 줄에서 빠짐), 「전체 관리」 `scene` 줄 편집기 이름.
- `docs/notes/story.md` 첫 줄 링크는 그대로 (테스트), 이 노트를 가리키는 줄만 더함.
- 다른 두 편집기와 겹치는 파일: `editors.html` (story 줄·바로 가기 글·명령 표 한 줄씩), `tests/hub.test.mjs` (`COMMANDS` 에 '스토리 반영') — 합칠 때 줄 단위로 둘 다 살린다.
- `night.json`·`events.json` 의 숫자·때는 「요소」 편집기가 고친다 — 같은 파일을 두 편집기가 고치므로 반영할 때 `base` version 이 다르면 그 사이 반영을 먼저 보고 칸 단위로 얹는다 (두 도구 모두 칸 단위).
