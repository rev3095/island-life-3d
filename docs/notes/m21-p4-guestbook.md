# M21-P4 친구 섬 구경 — 방명록 도장 · 고른 문장 편지 · 선물 · 숨기기·알리기 · 도장 보상 (17차 보드 wave17 반영 v1: D283-A · D284-A · D286-A · D287-A)

브랜치 `m21-p4-guestbook` (main c42416a 에서). 구경 섬 자체(x 1300, 배, 섬 고르기 창 UI-39)는 M21-P3 — 이 트랙은 그 위에서 **남기기·받기·보상**만.

## 저장 모양 (확정) — `visits/<쓴 사람 uid>` 한 문서

P2 노트의 제안 `visits/<섬 코드>/<쓴 사람 id>/<글 id>` 는 쓰지 않는다. 플랫폼 규칙은 경로만 보고 `{self}` 칸만 「자기 것만 쓰기」를 막을 수 있는데, 그 모양은 쓴 사람 칸이 셋째라 `visits/{self}` 규칙으로 못 막고, 주인 숨기기도 남의 글 문서를 고쳐야 한다. 또 섬 주인이 「내 섬으로 온 글」을 찾으려면 여러 사람의 하위 컬렉션을 한꺼번에 묻는(collection group) 기능이 필요한데 있는지 모른다.

그래서:

- **`visits/<쓴 사람 uid>`** = `{ user, v: 1, from: { name, island, code? }, notes: [글…], at }` — 한 사람에 문서 하나, 글은 배열 (오래된 것부터 빼서 `NOTES_KEEP` = 60개까지).
- 글 = `{ id, to: <받는 섬 코드>, kind: 'stamp' | 'letter' | 'gift', line: <문장·도장 id>, item?: <아이템 id — gift 만>, day, at }`. **자유 글 칸이 없다** — `isNote` 가 다른 열쇠를 거절하고, 받는 쪽은 자기 문장 표(`assets/visit/lines.json`)에 있는 id 만 그린다(`lineOk`). `from` 의 이름·섬 이름은 섬 사진(P2)에 이미 올라가는 것과 같은 것(20자).
- 섬 주인은 `db.collection('visits').limit(500).get()` 로 모두 읽고 `to === 내 코드` 만 고른다 (`rules.inbox` — P2 `islands` 목록 읽기와 같은 방식, `where` 에 기대지 않음). 문서 id ≠ `user` 인 문서(남의 칸에 쓴 것)는 버린다.
- **숨기기 = 주인 자기 섬 문서 `islands/<주인 uid>` 의 `hide: [noteKey…]`** (noteKey = `<쓴 사람 uid>/<글 id>`, 최대 200). 남의 글은 건드리지 않는다. 저장 `state.visit.hide` 에도 두고, 보여 주기가 켜져 있으면 바로 다시 올린다 (`islandDoc({…, hide})`, `canWriteIsland` 가 `hide` 모양도 본다 — `bad-hide`). 구경 온 사람의 「방명록 보기」도 그 섬 문서의 `hide` 를 빼고 보여 준다.
- 판단은 모두 `src/gameplay/visit/rules.js` 순수 함수: `canWriteVisit({ docId, uid, existing, next })` (`not-own-path` · `not-owner` · `user-mismatch` · `bad-note` · `bad-from` · `too-big`) · `addNote` · `toggleHide` · `inbox` · `canLeave`/`recordLeave`/`leftToday` (하루 세 섬, 섬마다 종류 하나씩) · `stampRewardsDue`. P2 의 옛 `canWriteVisit(path…)` 는 이 모양으로 바꿨다 (P2 코드는 그것을 부르지 않았음).
- 개발 서버 `GET /api/db/visits` · `GET|PUT /api/db/visits/<uid>` → `assets/review/visits.json`, 쓰기는 같은 `canWriteVisit` 로 403 (머리글 `x-island-user`, P2 와 같은 localStorage 열쇠).
- 테스트 `tests/visit.test.mjs` 에 셋 더함: 남의 글 덮어쓰기(남의 칸·남의 user)·자유 글 칸·남의 섬 숨기기 거절 · 받는 쪽 고르기 · 하루 세 섬 · 기념 가구 · 문장 표.

## 게임 capabilities `visits` 규칙 (2026-11-18 선언함 — 버전 1794992420-0be4)

**실제 선언은 `{self}` 두 줄이 `write: "interact"`** — 플랫폼이 `view` 쓰기를 거절했다 (「people held to view cannot write shared data whatever the rules say」). 그래서 보여 주기·남기기는 **Contributor(interact) 이상으로 공유받은 사람만** 되고, 공개 링크로 보는 사람은 구경(읽기 `view`)만 된다 (`user.can('data.write')` false → 「이 링크로는 섬을 올릴 수 없어요」). 또 공개(public) 아티팩트에서는 규칙을 넓히는 선언이 거절되어, 공개 공유를 잠깐 끄고 선언한 뒤 다시 켰다.

아래는 처음 제안 (`view` 쓰기 부분만 실제와 다름):

P2 제안의 `visits` 두 줄이 이 모양에 그대로 맞는다 (`visits/{self}` = 둘째 칸 = 쓴 사람 uid):

```json
{
  "db": {
    "rules": [
      { "path": "", "read": "admin", "write": "admin" },
      { "path": "reports", "read": "interact", "write": "interact" },
      { "path": "checks", "read": "interact", "write": "interact" },
      { "path": "islands", "read": "view", "write": "owner" },
      { "path": "islands/{self}", "read": "view", "write": "view" },
      { "path": "visits", "read": "view", "write": "owner" },
      { "path": "visits/{self}", "read": "view", "write": "view" }
    ]
  },
  "downloads": {},
  "user": {}
}
```

- `visits` 읽기 `view` = 섬 주인이 모든 글을 읽어 자기 코드 것만 고른다 (글은 문장 id·아이템 id·이름뿐이라 남이 읽어도 괜찮음). 쓰기는 owner(게임 주인이 정리) + `visits/{self}` 자기 문서만.
- `write: "view"` 가 거절되면 P2 노트처럼 `interact` 로 두고 「남기기·보여 주기는 초대받은 사람만」을 보고에 적는다 (게임 코드는 그대로 — 쓰기가 막히면 「이 창에서는 친구 섬에 남길 수 없어요」).
- 알리기는 이미 있는 `reports` (`interact`) 에 쓴다 — 공유 링크로 들어온 사람은 못 보낼 수 있고, 그때도 글은 숨겨진다.
- 순서: 선언 먼저, 그다음 코드 게시.

## 한 일

- 새 파일 (모두 `src/gameplay/visit/`, `index.js` 는 import 한 줄 + `attachGuestbook` 한 줄 + `islandDoc` 에 `hide` 하나):
  - `post.js` 저장소 (게시본 `claude.use('db')` · 개발 서버). uid·종류는 P2 `visit` 서비스의 `uid`·`kind`.
  - `guestbook.js` 남기기·받기·숨기기·알리기·보상·행동 키, `attachGuestbook(ctx, visit)` (→ `visit.guestbook`, `ui.friends`).
  - `ui.js` 섬폰 「친구 섬」 창 UI-38 (탭 「📖 내 방명록」 받은 도장 · 「✉️ 받은 편지」 편지·선물, 줄마다 「숨기기/보이기」·「알리기」) + 「🏝️ 도장 모음」 UI-40 (도장 찍은 섬 칸 10개 · 오늘 남긴 섬 n/3 · 기념 가구 1·3·5·10) + 편지 문장 고르기 창.
- 문장 표 `assets/visit/lines.json`: 도장 6 (`stamps` — 받침에서는 앞 넷) · 편지 문장 10 (`letters`, `gift` = 선물에 붙는 문장). **id 는 늘리기만** (받는 쪽이 모르는 id 는 버린다).
- 남기기 (구경 중에만 — `visit.trip?.()` 가 섬 문서를 줄 때): 구경 섬의 `guestbook-stand`(PR-45) 또는 `mailbox` 물체 1.9칸 안에서 Space (행동 키 `visit-guestbook` 우선순위 **95** — P3 `visit-hands` 94 위, `visit-boat` 96 아래. 받침은 P3 가 `visit:arrive` 로 알려 준 `guestbook` 자리에 `world.objects.add('guestbook-stand', …, { persist: false })` 로 놓는다) → 「도장 찍기 · 편지 남기기 · 선물 두기 · 방명록 보기」. 하루 세 섬, 섬마다 도장·편지·선물 하나씩 (`state.visit.left = { day, islands: { <코드>: [kind…] } }`). 선물은 가방에서 하나 (도구·색 변형·가품 빼고) — 저장소에 못 올리면 가방에 돌려준다.
- 받기: 저장소가 준비될 때·`data:newday`·섬폰 「친구 섬」을 열 때 `pull()` → 새로 온 편지·선물은 우편함으로 (`town/mail.js` `friend()` — 편지 `from: 'friend'`, `friend: { name, island }`, 읽을 때 이름 「○○의 편지 · 섬 이름」, 선물은 기존 우편함 선물 받기 그대로(가방이 차면 쪽지로 남음)). 도장은 방명록 목록에만. 배달한 글 열쇠는 `state.visit.got` (400개까지). 받은 목록 사본 `state.visit.inbox` (80개).
- 알리기: `reports/<id>` 에 `buildReport(…, withInfo:false)` 모양 + `kind: 'visit'` + `visit: { key, writer, to, kind, line, item, from }` (기존 `sendReport` — 로컬은 `game-reports`). 알리면 그 글을 숨긴다.
- 보상: 도장 찍은 섬(처음 찍는 섬만) 1·3·5·10곳 → 기념 가구 FU-109–112 (`STAMP_REWARDS`, `src/data/visit-items.js`)를 「섬 우체국」 편지 선물로 (받은 것 `state.visit.rewards`). 섬 일지 목표 `friendstamp` 「친구 섬 방명록 도장」 1·3·5·10 (`on: 'stamp'`, journal.json v8, `journal/index.js` 가 `visit:stamp` 의 `newIsland` 만 셈).
- 장면 s70 `s70-first-friend-island` (trigger `visit-first`, 자리 event) · s71 `s71-first-guestbook` (`visit-stamp`, event) · s72 `s72-first-friend-letter` (`visit-letter`, playerHouse). 트리거·힌트는 `story/rules.js`, 목록 `index.json`·`story/files.js`·`assets/story/editor-files.json`. 글 칸은 비워 둠(자막만) — 스토리 편집기에서.
- 섬폰 메뉴 줄 `{ id: 'friends', name: '친구 섬', icon: '🏝️', panel: 'friends' }` (`ui/phone.js` APPS, 문제 알리기 앞 — `ui.friends.open` 이 있을 때만 보임).
- 웹 빌드: 모듈은 `visit/index.js` 의 import 로 저절로 묶인다. `assets/visit/` 는 `build-web.mjs` `island` 갈래(boot) 정규식에 `visit` 을 더했다 (안 하면 `more`).

## 약속 (CONTRACTS 「M21 친구 섬 구경」 절에 더할 것)

- **P3 과 맞춘 것 (합친 뒤)**: `visit.trip()` → `{ code, user, island, owner, guestbook: { x, z } }` | null. 받침 PR-45 는 P4 가 `visit:arrive` 의 `guestbook` 자리에 놓고, Space 는 그 자리(또는 받침·우편함 물체) 1.9칸 안. 「방명록 보기」의 주인 숨김은 `visit.find(code)` 의 섬 문서 `hide`.
- 구경 시작은 이벤트 이름에 기대지 않고 `trip()` 을 1초마다 본다 → `visit:arrive-seen { code, first, x, z }` (s70).
- 서비스 `visit.guestbook`: `can(kind)` · `leave(kind, { line, item })` · `pull()` · `hide(key, on)` · `report(entry)` · `inbox()` · `stamps()` · `rewards()` · `leftToday()` · `lines()` · `describe(n)`. 창 `ui.friends.open(tab?)` · `ui.friends.pickLine({ title, lines })`.
- 이벤트: `visit:stamp { code, stamp, first, newIsland, count, x, z }` · `visit:left { kind, code, line, item }` · `visit:letter { kind, first, from }` · `visit:inbox { count }` · `visit:arrive-seen`.
- 우편함 `town.mail.friend({ from: { name, island }, lines: [글…], gift }) → 편지 | null`.
- 저장 `state.visit` 에 더한 칸 (없으면 만든다): `left` · `stamps: [{ code, name, island, stamp, day }]` · `rewards: [item]` · `got: [noteKey]` · `inbox` · `hide: [noteKey]` · `trips` · `seen: { stamp, letter }`.

## 확인한 것 · 안 한 것

- `node --test tests/` 한 번 (커밋 전, pass/fail 줄만). 저장 규칙(남의 글 덮어쓰기·남의 섬 숨기기 거절)은 `tests/visit.test.mjs` 로 확인. 새 장면 셋은 `validateScene` 빈 오류.
- 브라우저·게시본·dev-server 실제 확인은 안 했다 (절대원칙). 구경 중 흐름은 P3 의 `trip()` 이 들어와야 돈다 — 합친 뒤 조정 세션이 개발 서버 두 브라우저(다른 `island-life-dev-uid`)로 한 번: 보여 주기 켜기 → 다른 쪽에서 구경 → 도장·편지·선물 → 처음 쪽 섬폰 「친구 섬」·우편함.
- 하루 세 섬 판단은 게임 쪽에서만 (플랫폼 규칙으로는 못 막음 — 글 수 60 과 문서 크기 한도로 크게 넘치지는 않는다). 선물도 쓴 사람이 개발자 도구로 만들어 낼 수 있다 — 받는 쪽은 있는 아이템·도구 아님·가품 아님만 받는다.

## 문서 세션이 반영할 문장

- CLAUDE.md 「큰 구조」 친구 섬 구경 줄(P2) 뒤에:
  `- **친구 섬 남기기 (M21-P4, D283-A·D284-A·D286-A·D287-A)**: `src/gameplay/visit/` `guestbook.js`(남기기·받기·숨기기·알리기·보상) · `post.js`(저장소) · `ui.js`(섬폰 「🏝️ 친구 섬」 UI-38 방명록·받은 편지 + 도장 모음 UI-40). 구경 중 받침 PR-45 Space(95) → 방명록 도장 · 고른 문장 편지(문장 표 `assets/visit/lines.json`, id 만 저장 — 자유 입력 없음) · 선물 하나, 하루 세 섬(`state.visit.left`). 저장소 `visits/<쓴 사람 uid>` 한 문서 `{ user, from, notes:[{ id, to:<섬 코드>, kind, line, item? }] }` — 자기 문서만 쓰기(`visits/{self}`, 판단 `rules.canWriteVisit`), 주인은 모두 읽어 `to` 로 고르고, 숨기기는 자기 섬 문서 `islands/<uid>.hide`. 받은 편지·선물은 우편함(`town.mail.friend`), 알리기는 `reports` `kind:'visit'`. 도장 1·3·5·10섬 → 기념 가구 FU-109–112 · 일지 목표 `friendstamp`. 장면 s70–s72. 개발 서버 `/api/db/visits`. 노트 `docs/notes/m21-p4-guestbook.md`.`
- CLAUDE.md 행동 키 우선순위 줄에 「· 친구 섬 방명록 95 (M21-P4 — 구경 중 받침 앞, `visit-hands` 94 위)」.
- CLAUDE.md 「명령어」 dev-server 설명에 「· `/api/db/visits` (방명록·편지·선물)」.
- `docs/CONTRACTS.md` 「M21 친구 섬 구경」 절에 위 「약속」.
- `concept/README.md` 「게임 저장소」: `visits/<uid>` (방명록·편지·선물, 모두 읽기·자기 것만 쓰기) · `reports` 에 `kind:'visit'` (친구 섬 글 알리기 — "전체 요청 확인" 에서 그 글은 `visit.key` 로 찾아 보고, 필요하면 Claude 가 admin 으로 그 사람 문서에서 그 글을 지운다).
- 게임 capabilities: 위 규칙 JSON (선언 먼저).
