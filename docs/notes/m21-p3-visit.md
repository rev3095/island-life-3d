# M21-P3 친구 섬 구경 가기 — 배 · 섬 고르기 · x 1300 구경 섬 (17차 보드 wave17 반영 v1: D282-A · D285-A)

브랜치 `m21-p3-visit` (작업 트리 `../island-worktrees/m21-p3-visit`). 저장소·섬 사진은 M21-P2, 방명록·편지·선물은 M21-P4 (`m21-p4-guestbook`, 같은 때).

## 한 일

- **설정** `assets/visit/visit.json` (새 폴더 — 섬 묶음 `island` 에 듦): 모델 `assets.env` = BD-20 `visit-boat` · PR-45 `guestbook-stand` · PR-46 `stamp-board` · 자리 `ox` 1300 · 본섬 배 자리 `dock` (어선 부두 뿌리 `boat.site().root` 기준 `boat [2.2, -1.45]`·서는 곳 `stand [1.6, -0.35]`) · 구경 섬 자리 `islet` (선착장 BD-05 `dock` 물체 기준 — 투어 섬과 같은 셈 `boat [1.55, 3.3]`·`stand [0.15, 3.4]`, 방명록 받침 `guestbook` = 도착 자리 기준 `[-1.4, -0.9]`) · 주민 수 `villagers.max` 10 · 인사 `greet` (두 줄씩 다섯).
- **`src/gameplay/visit/` 새 파일 넷** (`index.js` 는 붙이는 3줄 + `update` 1줄):
  - `trip.js` (순수): `visitable(doc, {uid, mine})` → `{ok, why}` (`snap.v !== SNAP_VERSION`·시드 없음 = `'version'` 「이 섬은 지금 구경할 수 없어요」, 내 섬 = `'mine'`) · `tripOf` · `greetLines` · `shiftAdded` (놓은 것의 `data.at.x` + ox) · `TRIP_WHY`.
  - `islet-build.js` (순수): `planVisitIsland(snap, {constants, layout, specs, festival, nativeFruit, builds, exterior, ox})` → `{ gen, island:{removed, added}, houseKind, built }`. 본섬 `world/index.js` 와 같은 생성기·같은 시드 규칙(`layout.seed ?? snap.island.seed`) + 축제 광장 깎기(열린 부스 없음) + 다리·경사로(`world/built.js`, decor 의 `applyBuilt` 와 같은 검사) + 집 단계(처음 집 물체를 `home.json` 그 단계 `exterior` 로). `villagerSpots(gen, slugs)` = 자기 집 문 앞 / 없으면 광장 둘레.
  - `picker.js`: 섬 고르기 창 **UI-39** (`ui.panel('visit-pick')`) — 「🏝 오늘의 섬」(`visit.today()` 셋, 버튼 = 섬 이름·코드·「○○의 섬」) · 「🔑 섬 코드로 찾기」(입력 + 찾기, Enter) · 닫기. 저장소가 없으면 「이 창에서는 친구 섬을 찾을 수 없어요」. **보여 주기를 안 켜도 된다** (`status().readable` 만 본다).
  - `travel.js` `attachTravel(ctx, api)`: 오가기 전부.
- **흐름**: 어선 부두 옆 배 BD-20 (본섬 `world.home.objects`, `persist:false`, id `visit:home-boat`) Space(96 `visit-boat`, 「친구 섬 구경」) → UI-39 → 섬 문서 → 배 옆으로 걸어감 → 원형 전환 → `world.islet.enter(gen, 1300, { island })` → 선착장 옆에 돌아갈 배(`visit:islet-boat`) → 도착 자리(`gen.places.spawn`) → 주민 세우기 → 원형 열림 → 오른쪽 위 「🏝 섬 이름」 칸 + 알림 「○○의 「섬」에 왔어요! 구경만 할 수 있어요 👀」 → `visit:arrive`.
  - 떠나기: 구경 섬 배 Space(96, 「돌아가기」) → 묻기 창 → 원형 전환 → 본섬 배 옆 → `visit:leave`. 05:00 `data:newday` 에 저절로.
  - 주민: 섬 사진 `villagers` 의 slug 마다 `town/actor.js createActor` (겉모양 칸 outfit 등은 아직 안 입힘 — 기본 모델), 말 걸기 99 `visit-greet` → `ui.dialog` 두 줄 (부탁·선물·친밀도 없음).
- **읽기만**: 구경 중엔 `visit-hands` (94, intent 없음 = Space·줍기 둘 다) 가 행동 키를 받아 「친구 섬에서는 구경만 할 수 있어요 👀」(2.5초에 한 번) — 흔들기 60·줍기 50·유리병 55·도구 10·새총 12·문 90·가구 80·망원경 85 가 모두 아래라 막힌다. 그래서 drops·과일·하루 기록·화석이 생기지 않는다. 떠날 때 x > 1200 drops 는 혹시 몰라 치운다. 남의 문서는 읽기(`visit.today`·`find`)만.
- **저장**: `state.visit.trip = { code, user, day }` (구경 중 표시) 만. 섬은 저장하지 않는다 — `world/islets.js` 가 받는 `island` 는 가짜 칸. 구경 섬에서 끈 저장은 `game:ready` 에 본섬 배 옆에서 시작 (tour·boat 의 game:ready 가 먼저 옮긴 뒤 visit 가 맨 끝이라 이긴다).
- **world 고리 (작게)**: `world.islet.enter(gen, ox, { island })` 셋째 인자, `buildIslet(…, { island })` 가 그 `removed`·`added` 로 가짜 칸을 채운다 (투어는 그대로 빈 칸). `world/index.js visitKinds` 로 세 모델을 lazy.
- **다른 모듈 한 줄씩**: `stars/index.js` 망원경대 다시 놓기 · `contest/index.js sync` 가 `world.islet.active` 도 본다 (전엔 `tour.active` 만 → 구경 섬 물체에 망원경대·무대를 놓을 뻔).
- **게시 묶음**: `tools/build-web.mjs` `VISIT_FILES` → 새 갈래 **`visit`** (처음에 받지 않음, 배를 놓을 때 받음 — 세 모델). 스펙·`assets/visit/visit.json` 은 섬 묶음. 새 모듈 `trip.js`·`islet-build.js`·`picker.js`·`travel.js` 는 `visit/index.js` 의 `'./travel.js'` 글자 → import 를 따라 src 묶음. 방명록 받침·도장 판 모델은 전엔 어디에도 lazy 가 아니라 boot 에 들어갔을 것 → 이제 `visit` 묶음.
- 테스트 `tests/visit-trip.test.mjs` (2개): 모르는 판·시드 없음·내 섬 거르기 · 인사 · 놓은 것 옮기기 · 같은 시드 = 같은 물체 수 · 치운 것·놓은 것 넘기기 · 집 단계 → 커진 집 · 주민 자리 · 모델 = `visit` 묶음(boot 아님)·스펙 = island · 먼바다와 안 겹침.

## 약속 (CONTRACTS 제안 — 「M21 친구 섬 구경」 절에 더함)

- 서비스 `ctx.services.visit` 에 더함:
  - **`trip()`** → `{ code, user (섬 주인 uid), island, owner, guestbook: { x, z } }` | null — 지금 구경 중인 섬. `guestbook` = 방명록 받침 PR-45 를 놓을 월드 자리 (도착 자리 서쪽 위).
  - `visiting` · `travelBusy` · `pick()` (UI-39 열기) · `go(doc)` → `{ ok, why? }` · `back({ auto })` · `boat()` · `stand()` · `travelConfig`.
- 이벤트: `visit:arrive` `{ code, user, island, owner, x, z, guestbook }` · `visit:leave` `{ code, user, auto }`.
- 행동 키: `visit-greet` 99 · `visit-boat` 96 · **`visit-hands` 94 (구경 중 아래를 모두 막음)**. M21-P4 의 방명록 받침 Space 는 **95** (94 위, 96 아래)에 달면 된다. 받침 물체는 P4 가 `trip().guestbook` 자리에 `world.objects.add('guestbook-stand', …, { persist: false })` (구경 섬 물체 — 떠나면 섬과 같이 사라짐), 모델은 이미 `visit` 묶음·lazy.
- 구경 중엔 `world.islet.active` 가 true (투어와 같은 틀) — 새로 칸·물체를 쓰는 모듈은 `tour.active` 대신 `world.islet.active` 를 볼 것.

## 확인한 것 · 안 한 것

- `node --test tests/` 커밋 직전 한 번 (pass/fail 줄만).
- **게임 안에서 한 번도 안 열어 봤다** (절대원칙): 본섬 배가 어선 부두 북쪽 바다에 제대로 떠 있는지(자리 `dock.boat`·`stand` 는 어선 설정에서 셈한 값), 부두 위에서 배까지 1.9칸 안에 서지는지, 구경 섬 생성 시간(본섬 생성기 + 모든 배경 스펙 읽기, 첫 번만), 커진 집·다리 모델, 주민 세우기, UI-39 모양·휴대폰 폭, 원형 전환. 합칠 때 한 번 눈으로 볼 것 — 게시본 저장소에 섬이 하나도 없으면 오늘의 섬이 비어 「아직 없어요」.

## 남은 것 · 알아 둘 것

- 주민 겉모양 칸(`outfit`·`hat`…)은 아직 안 입힘 · 이사 와서 빈 집터(spare·lot)에 사는 주민 집은 섬 사진에 없어서(P2 노트 — `lots` 미포함) 그 주민은 광장 둘레에 선다. 주인공(섬 주인)은 세우지 않는다.
- 실내(친구 집 안)는 안 들어간다 (문 90 이 막힘).
- 섬 꾸미기(섬폰 🪴)·망원경 창 등 섬폰에서 여는 것은 구경 중에도 열린다 — 투어와 같은 오래된 빈틈. 섬 꾸미기가 구경 섬의 가짜 칸에 놓으면 저장엔 안 남지만(가짜 칸) `state.island.built` 쪽은 확인 안 함 → 다음에 decor 가 `world.islet.active` 면 안 열리게 한 줄 (backlog 후보).
- 낚시·곤충 생김은 본섬 표(`data.spawns` 의 islet 갈래는 `tour.active` 만 봄) — 잡을 수 없으니 그대로 둠.
- 하늘·계절·날씨는 내 섬 것 (투어 D128 과 같음).

## 문서 세션이 반영할 문장

- CLAUDE.md 「큰 구조」 무인도 투어 절 뒤 (또는 M21 절이 생기면 그 안):
  `- **친구 섬 구경 가기 (M21-P3, D282-A·D285-A, `src/gameplay/visit/travel.js`)**: 어선 부두 옆 친구 섬 배 BD-20 Space(96) → 섬 고르기 창 UI-39 (`picker.js`, 「오늘의 섬」 셋 + 섬 코드, 보여 주기를 안 켜도 됨) → 원형 전환 → **x 1300** 구경 섬 = 섬 사진 snap 으로 본섬 생성기를 다시 돌림 (`islet-build.js planVisitIsland`, 투어 틀 `world.islet.enter(gen, ox, { island })` + removed·added·다리·집 단계) + 주민 겉모양·인사만(99). **읽기만**: 구경 중 `visit-hands` 94 가 흔들기·줍기·도구·문을 막음, 남의 문서 안 씀, 저장 `state.visit.trip` 만, 05:00 저절로 돌아옴. 고리 `visit.trip()` (P4 방명록), 설정 `assets/visit/visit.json`, 모델은 `visit` 묶음. 노트 `docs/notes/m21-p3-visit.md`.`
- CLAUDE.md 실내 x 자리 문단: 「구경 섬 x 1300 (구역 ±92, 정리 기준 ox − 100)」 더하기.
- CLAUDE.md 「웹 배포」 처음에 받지 않는 묶음 목록에 `visit` (친구 섬 배·방명록 받침·도장 판).
- `docs/CONTRACTS.md` 「M21 친구 섬 구경」 절에 위 「약속」.
- `concept/README.md` 리소스 표(있다면): UI-39 섬 고르기 창 = `src/gameplay/visit/picker.js`.
