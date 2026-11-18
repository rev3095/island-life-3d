# M21-P2 친구 섬 구경 — 보여 주기 · 섬 코드 · 섬 사진 저장소 (17차 보드 wave17 반영 v1: D281-A · D284-A · D285-A)

브랜치 `m21-p2-share`. 이 트랙은 **저장소·서비스 기반만**. 섬 고르기 창 UI-39 · 구경 섬 x 1300 은 M21-P3, 방명록·편지·선물은 M21-P4 가 이 위에 올린다.

## 한 일

- 새 모듈 `src/gameplay/visit/` (`gameplay/index.js` PARTS 맨 끝 — town 뒤라 `town.residents()` 를 읽는다)
  - `rules.js` (순수, three·DOM 없음 — 테스트·dev-server 가 같이 씀): 섬 코드 `makeCode`·`isCode`·`normalizeCode` (글자 `CODE_CHARS` = 0 O 1 I L 뺀 대문자·숫자 31자, 6자리) · 섬 사진 `snapshot(state, {residents})` · 문서 `islandDoc` · 하루 한 번 `needsUpload` · 「오늘의 섬」 `todayPicks(list, dayKey, {n:3, mine})` (FNV-1a 날짜 시드 + mulberry32, code 로 정렬한 뒤 섞어서 **같은 날·같은 목록이면 누구에게나 같은 셋**, 내 섬은 뺌) · `findCode` · 저장소 규칙 판단 `canWriteIsland`·`canDeleteIsland`·`canWriteVisit`.
  - `store.js`: 게시본 = `claude.use('db')` + `claude.use('user')` (`user.id()`, `user.can('data.write') === false` 면 읽기만), 개발 서버 = `/api/db/islands` (쓴 사람 id 는 localStorage `island-life-dev-uid` → 머리글 `x-island-user`). 둘 다 없으면 `null`.
  - `index.js`: 저장 `state.visit = { share: false, code: null, lastPut: null, error: null }` (없으면 만든다). 켜면 코드 만들고(겹치면 다시) 바로 올림 · `data:newday` 에 하루 한 번 · 끄면 저장소에서 지움(코드는 남겨 다시 켜면 같은 코드). 저장소가 없거나 10초 안에 답이 없으면 **조용히 꺼진 것으로 보인다** (`status().share` false — 저장의 `share` 는 그대로 둬서, 저장소가 늦은 날에도 사용자의 켜짐이 풀리지 않음). 게임 시작은 저장소를 기다리지 않는다.
- 섬 사진에 넣는 것: 시드 · `island.added` · `island.built` · `island.removed` · 섬 이름 · 집 겉모양 단계(`house.grow.stage`) · 주민 목록(`town.residents()`, 없으면 `state.villagers` 열쇠)과 주민 겉모양 칸(`VILLAGER_LOOK_KEYS` = outfit·hat·top·look·lot·home 중 있는 것) · 주인공 이름·`hair`·`shirt`·`outfit`. **넣지 않는 것**: 가방 · 도토리 · 박물관 · 편지 · 친밀도 · 저장 전체. 판 `SNAP_VERSION = 1`, 문서 크기 한도 6만 자.
  - `island.removed` 를 더 넣었다 (치운 나무·바위가 없으면 시드만으로는 다른 섬이 된다). 실내 가구(`house.furniture`)는 이번엔 안 넣음 — P3 가 집 안까지 보여 주기로 하면 `snapshot` 에 한 줄.
  - 주민 집 자리(`state.town.moving` 의 집터)는 아직 안 넣음 — P3 가 주민을 세울 때 필요하면 `snapshot` 에 `lots` 를 더한다.
- 섬폰 설정 맨 아래 「친구 섬 구경」: 「내 섬 보여 주기」 스위치 + 내 섬 코드·상태 한 줄 (`ui/phone.js visitRows`, `visit` 서비스가 없으면 안 그림, `visit:changed` 로 다시 그림).
- `dev-server.mjs`: `GET /api/db/islands` (목록, `?code=` 로 찾기) · `GET|PUT|DELETE /api/db/islands/<uid>` → `assets/review/islands.json`. **쓰기·지우기는 `canWriteIsland`·`canDeleteIsland` 로 판단해 남의 섬이면 403** (게시본 규칙 흉내).
- 테스트 `tests/visit.test.mjs` (2개): 남의 섬 덮어쓰기·지우기 거절 · 남이 쓰는 코드 거절 · 방명록 남의 글 덮어쓰기 거절·주인 숨기기만 · 코드 글자 · 섬 사진에 도토리·가방·친밀도 없음 · 오늘의 섬이 순서와 상관없이 같은 셋.
- 웹 빌드: `tools/build-web.mjs` 는 `main.js` 부터 import + **따옴표 글자 경로**를 따라가서, `gameplay/index.js` 의 `'./visit/index.js'` 글자 → `index.js`·`rules.js`·`store.js` 가 저절로 묶음(`gameplay` 갈래)에 든다. 에셋 없음 (따로 고칠 것 없음).

## 저장 자리 — `islands/<코드>` 가 아니라 `islands/<쓴 사람 id>` (문서 안에 `code`)

맡긴 일에는 `islands/<코드>` 로 적혀 있었지만 바꿨다. 아티팩트 저장소 규칙은 **경로로만** 판단하고(`rules: [{path, read, write}]`), 「이 문서는 user 필드가 쓴 사람일 때만」 같은 문서 내용 검사는 없다. 「자기 것만 쓰기」를 플랫폼이 막을 수 있는 길은 경로 칸 `{self}` (= 쓴 사람 id) 하나뿐이라, 섬 문서 id = 쓴 사람 id 로 두고 코드는 필드로 둔다. 코드로 찾기는 `where('code', '==', 코드)` (서비스 `visit.find(글)`). 경로는 `rules.js` `islandPath` 한 곳이라 P3·P4 는 서비스만 쓰면 된다.

`islands/<코드>` 그대로면 누구든(쓰기 권한이 있는 사람) 남의 코드 문서를 덮어쓸 수 있고 게임 코드의 검사는 개발자 도구로 넘을 수 있다.

## 약속 (CONTRACTS 제안 — 「M21 친구 섬 구경」 절)

- 서비스 `ctx.services.visit`:
  - `available` (이 창에서 올릴 수 있나) · `kind` `'db'|'local'|null` · `uid` · `status()` → `{ ready, available, readable, share, wanted, code, lastPut, error, busy }`
  - `setShare(on)` → `Promise<{ ok, code?, why? }>` · `upload()` (켜져 있을 때 지금 섬 다시 올리기) · `photo()` (올리지 않고 섬 사진만)
  - `list()` → 올라온 섬 문서 배열 · `today({ list?, day?, n? })` → 오늘의 섬 문서 3개 · `find(글)` → 섬 문서 | null
  - `rules` (= `visit/rules.js` 전부) · `whyText(why)` → 화면 글
- 이벤트: `visit:share` `{ on, code }` · `visit:changed` (status 와 같은 모양).
- 섬 문서 `islands/<uid>` = `{ code, user, v, snap, dayKey, at }`, `snap` = `snapshot()` 모양 `{ v, island:{name,seed,added,built,removed}, house:{stage}, player:{name,hair,shirt,outfit}, villagers:[{slug,…겉모양}], dayKey, at }`. 구경 섬(P3)은 `snap.v` 가 모르는 판이면 건너뛴다.
- 구경은 읽기만: 구경 섬(P3)은 `snap` 으로 섬을 세울 뿐 남의 문서를 쓰지 않는다. 글은 P4 가 `visits/…` 에만.
- 방명록·편지·선물 (M21-P4 가 쓸 모양 제안): `visits/<섬 코드>/<쓴 사람 id>/<글 id>` = `{ user, kind: 'guestbook'|'letter'|'gift', line: <고른 문장 id>, item?, at, hidden: false, reported?: true }`.
  - **쓴 사람 id 필드 `user` 필수**, 경로의 쓴 사람 칸 = `user` = 쓴 사람. 남의 글 덮어쓰기·지우기 금지.
  - 글은 고른 문장만 (자유 글 없음, `line` = 문장 표 id). 섬 주인은 자기 섬 글에 `hidden: true` 만 (내용은 그대로) — 순수 판단 `canWriteVisit` (테스트 있음). 「알리기」는 P4 가 게임 저장소 `reports` 에 `kind:'visit'` 으로 (이미 있는 문제 알리기 흐름).
  - ⚠ 플랫폼 규칙으로는 `{self}` 가 경로 가운데 칸(코드 다음)에 올 수 있는지, 섬 주인만 `hidden` 을 바꾸게 하는 것은 **확인 안 됨** — 경로 규칙만으로는 「주인 숨기기」가 안 되므로, P4 는 숨기기를 주인 쪽 문서(`islands/<주인 uid>` 의 `hide: [글 경로…]`)로 하는 편이 안전하다. P4 가 정할 것.

## 게임 capabilities 선언 (조정 세션이 게시 때)

지금 선언 (2026-11-18 `read_declaration`): `db.rules = [{"path":"","read":"admin","write":"admin"},{"path":"reports","read":"interact","write":"interact"},{"path":"checks","read":"interact","write":"interact"}]`, `downloads`, `user`. `user` 는 이미 있다.

제안 (위 셋은 그대로 두고 더한다):

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

- `islands` = 모두 읽기(구경), 접두 규칙은 owner 만 쓰기 (게임 주인이 정리할 수 있게 — 안내대로 `self` 대신 owner), `islands/{self}` = 자기 문서만 쓰기·지우기.
- **`write: "view"` 가 받아들여지는지 꼭 확인**: 안내문은 「Viewers/Commenters never write」(기본)라고 하고 예시는 `{self}` 에 `interact` 를 쓴다. 게임은 공개(`read: public`) 링크로 노는 사람이 대부분이라 `interact` 면 **공유 링크로 들어온 사람은 섬을 못 올린다** (`user.can('data.write')` 가 false → 섬폰에 「이 링크로는 섬을 올릴 수 없어요」). 선언이 `view` 를 거절하면 `interact` 로 두고, 「보여 주기는 초대받은 사람만」 을 보고에 적는다. 로그인 안 한 사람은 어느 쪽이든 `db` 가 null → 조용히 꺼짐.
- `visits` 는 P4 가 위 모양을 확정한 뒤에 선언해도 된다 (P2 코드는 `visits` 를 쓰지 않음). P4 가 `visits/<코드>/<uid>/…` 로 가면 규칙 경로를 그에 맞게 바꿔야 한다 — 위 제안의 `visits/{self}` 는 「쓴 사람 칸이 둘째」 인 모양(`visits/<uid>/<코드>/<글 id>`)일 때만 맞다. P4 노트에서 정하고 선언은 그 뒤.
- 순서 (안내대로): 기능이 늘어나는 게시 → **선언 먼저, 그다음 코드 게시**.

## 확인한 것 · 안 한 것

- `node --test tests/` 한 번 (커밋 전, pass/fail 줄만).
- 브라우저·게시본·dev-server 실제 확인은 안 했다 (절대원칙). 게시본 저장소 API(`db.doc().get/set/delete`, `collection().where().limit().get()`)는 `concept/board-kit.js` 가 쓰는 모양과 같게 썼지만 게임 게시본에서 돌려 보진 않았다 — 조정 세션이 게시 뒤 섬폰에서 한 번 켜 보면 된다 (`db_list` 로 `islands` 에 문서 하나).

## 문서 세션이 반영할 문장

- CLAUDE.md 「큰 구조」 섬 일지 절 근처에 한 줄:
  `- **친구 섬 구경 (M21-P2, D281-A·D284-A·D285-A)**: `src/gameplay/visit/` (규칙(순수) `rules.js` · 저장소 `store.js`). 섬폰 설정 「친구 섬 구경」 = 「내 섬 보여 주기」(기본 꺼짐, 저장 `state.visit`) → 섬 코드 6자리(0 O 1 I L 뺀 글자) + 섬 사진(시드·놓은 것·다리·치운 것·집 단계·주민·이름·옷 — 가방·도토리 없음)을 게임 저장소 `islands/<쓴 사람 id>` 에 (켤 때·하루 한 번, 끄면 지움). 「오늘의 섬」 셋 = 날짜 시드 `todayPicks`, 코드로 찾기 `visit.find`. 저장소가 없으면 조용히 꺼짐, 개발 서버는 `/api/db/islands` (남의 섬 쓰기 403 — 같은 `canWriteIsland`). 서비스 `ctx.services.visit`, 노트 `docs/notes/m21-p2-share.md`.`
- CLAUDE.md 「명령어」 아래 dev-server 줄 설명(로컬 `/api/db/<col>` 흉내 문장)에 「· `/api/db/islands` (섬 사진, 쓴 사람 머리글 `x-island-user`)」.
- `docs/CONTRACTS.md` 끝에 위 「약속」 절.
- `concept/README.md` 「게임 저장소」 에: `islands/<uid>` (섬 사진, 모두 읽기·자기 것만 쓰기) · `visits/…` (M21-P4).
