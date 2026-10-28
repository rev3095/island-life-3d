# T2 데이터 트랙 노트 (`p2-data`)

`src/data/` 는 DOM·three 없이 짠 규칙 모듈이고, `node --test tests/` 로 확인한다. 데모: `node dev-server.mjs --port=4183` → `/demos/data.html`.

## 파일

| 파일 | 내용 |
|---|---|
| `items.js` | 아이템 110개 (물고기 20 · 곤충 20 · 화석 8 · 과일 6 · 조개 6 · 꽃 12 · 재료 8 · 도구 5 · 가구 20 · 씨앗·묘목 5). 컨셉 보드 표 값 그대로 + `habitats/places/hours/months/shadow/weight/desc` |
| `rng.js` | 시드 난수 `rngFor(...parts)`, `pickWeighted`, `sample` |
| `spawns.js` | 출현표 `fish/bug/fossil/rock/treeShake/shell/chopWood` + `fishPool/bugPool` (가중치 확인용) |
| `inventory.js` · `wallet.js` · `museum.js` | 가방 20칸 · 도토리 · 기증과 도감 |
| `recipes.js` · `economy.js` | 작업대 레시피 14개 · 파는 값/사는 값/오늘의 상점 |
| `day.js` · `harvest.js` | 하루 키(새벽 5시 경계)·하루 리셋 · 하루 규칙에 맞춘 채집 |
| `save.js` | `island-life-save-v1`, `{ v, savedAt, state }`, 버전 올리기·값 고치기·참조 유지 불러오기 |
| `index.js` | `ctx.services.data` 등록, 이벤트, 자동 저장 |

## 정한 규칙 (컨셉 보드에 숫자가 없던 것)

- 시간: `낮` = 5~19시, `밤` = 17~5시 (저녁 17~19시엔 둘 다). 계절: `초여름` = 6월.
- 비·눈 오는 날: 날벌레(나비·잠자리·꿀벌·반딧불이·나방)는 안 나오고, 달팽이는 비 올 때만. 그림자 5 이상 물고기는 가중치 2배.
- 출현 가중치: 희귀 1, 1000 이상 3, 400 이상 6, 나머지 10.
- 선착장(`pier`)은 바다 물고기도 잡힌다. 하구(`mouth`)는 강 물고기 + 연어 가중치 3배.
- 쌓임: 물고기·곤충·화석·도구·가구 1, 과일·조개·꽃·씨앗 10, 재료 30, 도토리 주머니 10.
- 도구 내구도: 낚싯대 30 · 잠자리채 30 · 삽 40 · 도끼 60 · 물뿌리개 40. 상점가 낚싯대·잠자리채 400, 나머지 800.
- 새 게임 지급: 낚싯대 + 잠자리채 + 도토리 500.
- 바위: 하루 6번. 칠수록 철광석·도토리 주머니가 줄어든다. 나무 베기(도끼): 하루 3번.
- 나무 흔들기: 과일나무는 열매 5개(배경 스펙 '열매 5개'), 야자수는 2개. 가구·도토리 주머니·벌집은 나무마다 하루 한 번, 나뭇가지는 매번 35%. 과수원 언덕(`orchard`)은 벌집 15%(보통 6%), 밤엔 벌 없음.
- 하루 리셋: 화석 자리 4곳, 조개 5~8개 새로, 잡초 하루 2~4개씩 쌓임(처음 8, 최대 24), 바위·나무 횟수 초기화, 과일은 딴 지 3일 뒤 다시 열림.
- 상점: 영업 8~22시, 가구 2(상점 가구 8종 중) + 도구 5 + 꽃씨 2(3종 중) + 묘목 2. dayKey 시드라 같은 날엔 같다.
- 섬 특산 과일은 `state.island.seed` 로 정한다 (지금 시드 → 사과). 특산 100, 다른 과일 500, 야자열매 250.
- 레시피 중 수량이 없던 것: 통나무 의자 나무 4, 테이블 나무 8, 침대 나무 6 + 단단한 나무 4, 모닥불 나뭇가지 3 + 돌 3, 장작더미 나무 6, 어항 단단한 나무 2 + 점토 2, 곤충 상자 나무 3 + 나뭇가지 2, 낚싯대·잠자리채 나뭇가지 5. 조개 커튼(조개 아무거나 6), 과일 의자(과일 아무거나 10)는 카테고리 재료.
- 가구·재료 판매가는 정해서 넣었다 (상점 가구 = 사는 값의 1/4).

## 계약 제안 (합칠 때 `docs/CONTRACTS.md` 에 반영해 주세요)

1. **새 이벤트** (data 가 보냄)
   - `data:newday {dayKey, prev, days, regrown:[treeId], fossils, shells, weeds}` — 하루 리셋 **뒤에** 보낸다. world 는 `time:newday` 대신 이걸 듣고 조개·잡초·화석 자리를 다시 놓아야 순서가 맞는다 (time:newday 를 먼저 받으면 아직 리셋 전).
   - `data:loaded {}` — 저장을 불러온 뒤. `encyclopedia:changed {id}` — 처음 잡은 물고기·곤충.
2. **서비스 추가** (계약에 있는 것은 그대로, 아래는 덤)
   - `collect(id, n) → {added, left, acorns}`: 주운 것 챙기기. 도토리 주머니는 바로 지갑으로, 물고기·곤충은 도감에 기록. gameplay 는 `inventory.add` 대신 이걸 쓰면 좋다.
   - `openBag(slot)`, `donateFromSlot(slot)`.
   - `harvest`: `shakeTree(treeId, kind, {fruit, orchard, hour})`, `chopTree(treeId)`, `hitRock(rockId)`, `digFossil(spotKey)`, `pickShell(spotKey)`, `shellAt(spotKey)`, `pullWeed()`, `fruitReady(treeId)`, `today() → {dayKey, fossils, shells, weeds}`. 하루 규칙과 기록을 맡아 준다. id 는 `objects.query` 의 id 를 그대로 쓰면 된다.
   - `day.pickSpots(candidates, n, salt)` (오늘 놓을 자리 고르기), `day.daily()`, `day.rng(...salt)`.
   - `economy`: `sellPrice(id)`, `buyPrice(id)`, `stock()` → `ui.shop.open({ stock })` 에 바로, `sell(slot, n)`, `buy(id, n) → 'ok'|'money'|'full'|'none'`, `isOpen(hour)`, `nativeFruit()`.
   - `inventory`: `useTool('rod') → {ok, uses, broken}`, `hasTool`, `findTool`, `canFit`, `move`, `removeId`, `countCategory`, `batch`. 도구 칸은 `{ id, count: 1, uses }` (UI 가 남은 횟수를 보여 줄 수 있다).
   - `museum`: `record(id)`, `caught(id)`, `canDonate(id)`, `list(cat)`, `progress()` 에 `total`, `complete` 추가.
   - `recipes.missing(id)`, `recipes.get(id)`. 레시피 id = 만들어지는 아이템 id.
3. **값 추가**
   - 카테고리 `seed` (`seed.tulip` …, `seed.sapling`) — id 규칙 목록에 넣어 주세요.
   - `spawns.fish` habitat 에 `mouth`(하구, 선택), `spawns.bug` place 에 `shake`(나무 흔들기 벌), place 는 배열도 받는다 (`['flower','water']`).
   - `spawns.rock(rng, hits)` 두 번째 인자 = 오늘 친 횟수. `hits >= 6` 이면 `null` (계약은 늘 `{id,count}` 라고 돼 있음).
   - `spawns.treeShake(kind, rng, opts)` 결과에 `event: 'bees'` 가 붙으면 벌떼 이벤트다. 꿀벌은 잠자리채로 잡았을 때만 가방에 넣을 것.
4. **T5 (time) 에게**: dayKey 경계를 새벽 5시로 맞춰 주세요 (`DAY_PARTS` 의 밤이 19~29시라서). time 서비스가 없으면 data 가 로컬 시계 + 5시 경계로 계산한다.

## 알려진 빈틈

- 박물관 완성 보상(공룡 모형), 주민 선물(액자)·친밀도(주민 사진)는 아이템만 있고 주는 규칙은 2차 gameplay 몫.
- 꽃 교배(물뿌리개), 묘목·과일 심기 규칙은 아직 없다 (아이템에 `flower`/`tree`/`variant` 만 있음).
- 낚시·곤충이 나올지 말지(빈도)는 gameplay 가 정한다. spawns 는 '나온다면 무엇이' 만 정한다.
- 더 새 버전 저장이 있으면 불러오지도 덮어쓰지도 않는다 (`save.blocked`). 이때 안내 문구는 UI 가 띄워야 한다.
- 아이콘은 이모지 임시 (결정 D2: 직접 그린 아이콘 예정).
