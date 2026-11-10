# 모듈 계약 (트랙끼리 지키는 약속)

모든 트랙은 이 문서만 보고 다른 트랙 없이 개발할 수 있어야 한다. 바꿔야 할 약속이 생기면 **직접 고치지 말고** 자기 브랜치의 `docs/notes/<트랙>.md` 에 제안을 적는다 (합칠 때 반영).

## 공통 규칙

- 빌드 도구 없음. 브라우저 ES 모듈 + importmap (`three@0.170.0`, `three/addons/`). npm 패키지 설치 금지.
- 3D 모델은 `src/core/assets.js` 로 읽는다 (`.glb.json`). 재질은 `src/core/materials.js` 의 `applyToonStyle` / `toonMaterial` / `outlineMaterial` 을 써야 곡면 월드·외곽선이 맞는다.
- 코드 주석은 한국어로 짧게. 화면 문구도 한국어.
- 로컬 실행: `node dev-server.mjs` (환경변수 `PORT` 로 포트 지정). 웹 링크와 같은 보안 규칙(CSP)이 걸려 있다: 외부 스크립트는 jsdelivr·cdnjs·unpkg 만, fetch 는 같은 출처만, `data:` fetch 불가.
- 순수 규칙 코드는 `node --test tests/` 로 돌 수 있게 DOM·three 없이 짠다.
- 자기 폴더 밖 파일(특히 `src/core/`, `src/main.js`, `index.html`)은 고치지 않는다. 꼭 필요하면 `docs/notes/<트랙>.md` 에 적는다.

## 모듈 모양

각 트랙은 `src/<폴더>/index.js` 에서 아래 모양을 `export default` 한다. `src/main.js` 가 순서대로 `init` 하고 매 프레임 `update` 한다.

```js
export default {
  name: 'world',
  async init(ctx) { /* ctx.services.world = {...} 등록, 장면에 물체 추가 */ },
  update(dt, ctx) { /* 매 프레임 (dt 초, 최대 0.05) */ },
};
```

초기화 순서: `data → sky → world → player → ui → audio → gameplay`.

## ctx (src/main.js 가 만든다)

| 이름 | 내용 |
|---|---|
| `THREE` | three.js |
| `renderer`, `scene`, `camera` | 카메라는 `PerspectiveCamera(32°)`. 위치는 player 모듈이 정한다 |
| `events` | `on(name, fn) → off`, `once`, `emit(name, payload)` |
| `state` | 저장되는 상태 (`src/core/state.js`) |
| `input` | `move {x,z}`(화면 위 = -Z), `run`, `enabled`(UI가 창을 열면 false), `touch`, 누름은 `input:press` 이벤트 |
| `assets` | `loadCharacter(slug)`, `loadEnv(slug)`, `instantiate(gltf)`, `loadEnvSpec(slug)`, `loadEnvIndex()` … |
| `materials` | `applyToonStyle(root, {spec})`, `toonMaterial(color)`, `outlineMaterial(width)`, `curve.uCurve` |
| `constants` | `TILE`, `ISLAND{w:64,h:56}`, `seasonOf(month)`, `DAY_PARTS`, `VILLAGERS`, `TOOLS` |
| `lights` | `{ hemi, sun, sunOffset }` — main 이 만들고 **sky 가 색·세기와 `sunOffset`(focus 기준 해 방향·거리)을 바꾼다**. main 이 매 프레임 `sun.position = focus + sunOffset` 으로 옮긴다 |
| `uiRoot` | `#ui` DOM (게임 화면 위 HTML 층) |
| `focus` | `Vector3` — 카메라·곡면 월드 중심. **player 가 매 프레임 갱신** |
| `services` | 아래 서비스들이 올라가는 곳 |

## 서비스 (ctx.services)

### `data` — T2 (src/data/)
```js
items.get(id) → { id, category, name, icon, price, ... } | null     // id 예: 'fish.crucian', 'bug.cabbage-white', 'fossil.ammonite',
items.list(category) → [...]                                         //       'fruit.apple', 'mat.wood', 'tool.rod', 'furn.log-chair'
spawns.fish({ habitat: 'river'|'pond'|'sea'|'pier', hour, month, weather, rng }) → itemId
spawns.bug({ place: 'flower'|'tree'|'ground'|'air'|'rock'|'water'|'lamp'|'fruit'|'palm', hour, month, weather, rng }) → itemId | null
spawns.fossil(rng) → itemId,   spawns.rock(rng) → { id, count },   spawns.treeShake(kind, rng) → { id, count } | null
inventory.slots (20칸, { id, count } | null),  add(id, n=1) → 들어간 수,  remove(slotIndex, n=1),  count(id),  isFull()
wallet.get(),  add(n),  spend(n) → bool
museum.donate(id) → bool,  has(id),  progress() → { fish:[n,total], bug:[..], fossil:[..] }
recipes.list(),  recipes.canCraft(recipeId),  recipes.craft(recipeId) → bool
save.save(),  save.load() → bool,  save.reset()          // localStorage 'island-life-save-v1', try/catch 필수
day.key()  → 'YYYY-MM-DD' (time 서비스 시각 기준),  day.check() → 새 날이면 하루 리셋 실행
```
변하면 이벤트: `inventory:changed {slots}`, `wallet:changed {acorns}`, `museum:changed {id}`, `save:done {ok}`.

### `time` — T5 (src/sky/)
```js
now() → { year, month, day, hour, minute, weekday, season, part: 'dawn'|'day'|'dusk'|'night', isNight, dayKey }
mode: 'real' | 'fast',  setMode(mode)       // fast: 실제 1분 = 게임 1시간 (개발·시연용)
weather → 'clear' | 'cloudy' | 'rain' | 'snow' | 'rainbow',  setWeather(w)   // 날마다 dayKey 시드로 정해진다
nightFactor → 0(낮) ~ 1(밤)                  // 가로등·창문 켜기에 쓴다
seasonPalette(season) → { grass, leaf, ... } // 배경 스펙 variants 이름과 같은 키
```
이벤트: `time:tick {now}` (게임 1분마다), `time:newday {dayKey}`, `time:part {part}`, `weather:change {weather}`.
`ctx.lights`, `scene.background`, `scene.fog` 를 시간대에 맞춰 바꾸고, 비·눈 입자를 `ctx.focus` 주변에 그린다.

### `world` — T1 (src/world/)
```js
island: { w, h, tileAt(tx, tz) → 'grass'|'sand'|'path'|'water'|'sea'|'cliff'|'plaza'|'ramp', levelAt(tx, tz) → 0|1, heightAt(x, z) → number,
          isWalkable(x, z), isWater(x, z), toTile(x, z) → {tx, tz}, toWorld(tx, tz) → {x, z} }
objects.query(x, z, radius) → [{ id, kind, x, z, tile, data }]     // kind = 배경 스펙 slug (tree, rock, tulip ...)
objects.remove(id),  objects.add(kind, tx, tz, data) → id,  objects.setVariant(id, variant)
places: { spawn:{x,z}, plaza, shop, museum, dock, playerHouse, villagerHouses:[{slug, x, z}] }
setSeason(season)                       // 배경 variants 로 잎·풀 색 바꾸기 (time 이 부름)
```
이벤트: `world:ready {island}`.

### `player` — T1 (src/player/)
```js
position (Vector3),  facing (라디안, 0 = -Z 쪽),  tileInFront() → {tx, tz},  pointInFront(dist) → {x, z}
tool → null | 'rod' | 'net' | 'shovel' | 'axe' | 'can',  setTool(id)
play(name)  // 'idle' | 'walk' | 'run' | 'happy'
freeze(bool) // 대화·미니게임 중 이동 막기
```
이벤트: `player:moved {x, z, tx, tz}` (칸이 바뀔 때), `player:tool {tool}`.

### `ui` — T3 (src/ui/)
```js
hud.setClock(now), hud.setAcorns(n), hud.setTool(id), hud.show(bool)
dialog.open({ speaker, color, lines:[string], voice, choices? }) → Promise<choiceIndex|null>
toast(text, icon?)
bag.open({ mode: 'view'|'sell'|'donate'|'pick' }) → Promise<slotIndex|null>
phone.open(),  map.open(),  shop.open({ stock:[itemId] }),  museum.open()
isBlocking() → bool                     // 창이 열려 있으면 true (input.enabled 도 같이 끈다)
```
이벤트: `ui:open {panel}`, `ui:close {panel}`, `dialog:line {speaker, text, voice}` (한 줄 나올 때, audio 가 목소리를 낸다).
`time:tick`, `wallet:changed`, `player:tool`, `inventory:changed`, `toast` 이벤트를 듣고 HUD 를 갱신한다.

### `audio` — T4 (src/audio/)
```js
unlock()                      // 첫 클릭·키 입력 때 자동으로 부른다 (브라우저 자동재생 규칙)
sfx(name, opts?)              // 이름은 아래 표
bgm(name | null)              // 'dawn'|'morning'|'afternoon'|'evening'|'night'|'rain'|'indoor'|'shop'|'museum'
speak(text, voice) → Promise  // 동물 목소리 웅얼거림. voice = 캐릭터 slug
setVolume('bgm'|'sfx'|'voice', 0~1)
```
이벤트 듣기: `sfx {name}`, `bgm {name}`, `dialog:line`, `time:part`, `weather:change` (비 오면 rain), `ui:open` (상점·박물관 음악).

효과음 이름: `step-grass`, `step-sand`, `step-wood`, `cast`, `nibble`, `bite`, `splash`, `catch`, `net-swing`, `bug-catch`, `shake`, `fruit-drop`, `acorn`, `dig`, `fossil`, `axe-wood`, `axe-rock`, `water`, `pickup`, `bag-open`, `menu`, `sell`, `door`, `bee`.

## 이벤트 한눈에

| 이벤트 | 보내는 쪽 | 내용 |
|---|---|---|
| `input:press` | core | `{intent}` action, pickup, toolPrev, toolNext, tool1~5, toolNone, bag, phone, map. **처리 전에 `ctx.services.ui?.isBlocking()` 확인 — 창이 열려 있으면 무시** |
| `settings:changed` | ui | `{key, value, settings}` 소리 크기·외곽선·키 안내를 바꿨을 때 |
| `data:newday` / `data:loaded` / `encyclopedia:changed` | data | 하루 리셋 **뒤** `{dayKey, prev, days, regrown, fossils, shells, weeds}` / 저장 불러온 뒤 / 처음 잡은 물고기·곤충 `{id}` |
| `game:ready` | core | `{modules}` |
| `time:tick` / `time:newday` / `time:part` / `weather:change` | sky | 위 참고 |
| `world:ready` | world | `{island}` |
| `player:moved` / `player:tool` | player | 위 참고 |
| `inventory:changed` / `wallet:changed` / `museum:changed` / `save:done` | data | 위 참고 |
| `ui:open` / `ui:close` / `dialog:line` | ui | 위 참고 |
| `toast` | 누구나 | `{text, icon}` |
| `sfx` / `bgm` | 누구나 | `{name}` |

## 상태 (ctx.state) — 누가 고치나

| 칸 | 주인 |
|---|---|
| `player` | player |
| `wallet`, `inventory`, `museum`, `encyclopedia` | data |
| `island` | world (지형 변화), data (하루 리셋 기록) |
| `time` | sky |
| `settings` | ui (설정 화면), audio 가 읽음 |
| `villagers`, `house`, `flags` | 2차 gameplay |

## 리소스

- 캐릭터: `assets/models/index.json`, 스펙 `assets/specs/<slug>.json`, 동작 `idle/walk/run/happy`. 정면 = -Y(블렌더) = +Z(three). 키 ≈ 1.0.
- 배경: `assets/env/index.json`, 스펙 `assets/env/specs/<slug>.json` (`footprint`, `variants`, `animations: sway|shake|flicker`, `style.flat`).
- 가구: `assets/furniture/index.json` (`item` → `slug`, `footprint`, `place`, `layer`), 스펙 `assets/furniture/specs/<slug>.json`, 모델 `ctx.assets.loadModel('assets/furniture/models/<slug>')`. 바닥 가구 원점 = 발자국 가운데 바닥, 벽·창문 가구 원점 = 벽면 바닥.
- 타일 모델(`tile-grass` 등)은 1×1, 윗면 높이 0 (절벽은 윗면 1.0, 경사로는 1×2).

---

## 1차 합친 뒤 추가된 약속 (2026-10-28)

1차 다섯 트랙이 만들면서 정한 것들이다 (자세한 배경: `docs/notes/*.md`). 위 내용과 다르면 **이 절이 우선**한다.

### 공통
- **방향**: `player.facing` 은 three 의 `rotation.y` 와 같은 뜻. 0 = 북쪽(-Z), +π/2 = 서쪽(-X), -π/2 = 동쪽. 모델(정면 +Z)은 `rotation.y = facing + π`.
- **요일**: `now().weekday` 는 JS `Date.getDay()` 처럼 0 = 일요일.
- **하루 경계**: 새벽 05:00 에 `dayKey` 가 바뀐다 (time 이 정하고 data 도 같은 규칙을 쓴다).
- **창이 열린 동안의 입력**: ui 가 키 입력을 먼저 받아 막는다. 휴대폰 A/B 는 `input:press` 로 오므로 **gameplay·player 는 처리 전에 `ui.isBlocking()` 을 꼭 확인**한다. `isBlocking()` 은 마지막 창을 닫은 그 입력이 끝날 때까지 true 다 (A 한 번에 대화가 닫히고 다음 대화가 열리는 일 방지).
- **재질 이름** (world·sky 가 같이 쓴다): 밤에 켜지는 것 `glow`(등불)·`window`(창유리), 빛무리 `glow`·`flame`, 비에 젖는 땅 `ground grass grassDark path dirt sand sandDark stone stoneLight grout pebble cliff cliffDark`. world 가 합친 땅 타일 재질 이름은 `ground`. 새 재질을 만들 때 이 이름을 지킨다.
- **시작 알림**: `game:ready` 때 sky 가 `time:tick`, `time:part {initial: true}`, `weather:change {initial: true}` 를 한 번 보낸다 (ui 시계·audio 배경음의 첫 상태). `time:newday` 는 시작 때 보내지 않는다.

### data 추가
- `collect(id, n) → {added, left, acorns}`: 주운 것을 챙길 때 **`inventory.add` 대신 이것**을 쓴다 (도토리 주머니는 지갑으로, 물고기·곤충은 도감 기록).
- `harvest`: `shakeTree(treeId, kind, opts)`, `chopTree`, `hitRock(rockId)`, `digFossil(spotKey)`, `pickShell(spotKey)`, `shellAt`, `pullWeed()`, `fruitReady(treeId)`, `today()`. id 는 `world.objects.query` 의 id 를 그대로 쓴다.
- `economy`: `sellPrice(id)`, `buyPrice(id)`, `stock()` (→ `ui.shop.open({stock})`), `sell(slot, n)`, `buy(id, n) → 'ok'|'money'|'full'|'none'`, `isOpen(hour)`, `nativeFruit()` (섬 특산 과일, world 가 과일나무 색에 쓴다).
- `inventory`: `useTool(id) → {ok, uses, broken}`, `hasTool`, `findTool`, `canFit`, `move`, `removeId`, `countCategory`, `batch`. 도구 칸은 `{ id, count: 1, uses }`.
- `museum`: `record(id)`, `caught(id)`, `canDonate(id)`, `list(cat)`, `progress()` 에 `total`, `complete`. `recipes.missing(id)`, `recipes.get(id)` (레시피 id = 만들어지는 아이템 id).
- `day.pickSpots(candidates, n, salt)`, `day.daily()`, `day.rng(...salt)`.
- 아이템: 카테고리 `seed` 추가 (`seed.tulip`, `seed.sapling` …). 가격은 `price` = 상점이 사 주는 값(판매가), `buyPrice` = 상점에서 살 때 값. 레시피 모양 `{ id, materials: [{ id, count }] }`.
- spawns: `fish` habitat 에 `mouth`(하구), `bug` place 에 `shake`(나무 흔들기 벌), place 는 배열도 받는다. `rock(rng, hits)` 는 오늘 친 횟수가 6 이상이면 `null`. `treeShake` 결과의 `event: 'bees'` = 벌떼. `weather: 'rainbow'` 는 맑음처럼 다룬다.
- 더 새 버전의 저장이 있으면 불러오지도 덮어쓰지도 않는다 (`save.blocked`) — 안내는 ui 가 띄운다.

### world · player 추가
- **도구 숫자키**(tool1~5, toolPrev/Next/None)는 지금 player 가 처리한다. gameplay 가 가방에 있는 도구만 들게 하려면 `player.toolKeys = false` 로 끄고 직접 `setTool` 을 부른다.
- 상태: `state.island.variants` (`{물체id: 변형}`), `added` 행 `{ id, kind, tx, tz, data:{rot, scale, variant, …} }`, `removed` 는 id 목록.
- `objects.setVariant(id, 'picked')` = 열매를 딴 과일나무 모습, `setVariant(id, null)` 로 되돌린다.
- **하루 리셋 연결(2차)**: world 는 `time:newday` 가 아니라 **`data:newday`** 를 듣고 `spawnTiles('shell'|'weed'|'fossil-spot')` 후보를 `data.day.pickSpots` 로 골라 `objects.add/remove` 한다.
- `world.setSeason(season)` 은 여러 번 불려도 괜찮다 (같은 계절이면 무시). `time.seasonPalette(season).variants` (`{tree:'autumn', 'tile-grass':'autumn', ...}`) 를 그대로 써도 된다.

### ui 추가
- `ui.confirm({ title, text, icon, buttons:[{label, value, primary}], cancelValue }) → Promise<value>` (브라우저 `confirm()` 금지).
- 선택 인자: `bag.open({ mode, title?, hint?, filter?(slot, info) → bool })`, `shop.open({ stock, tab?, title?, keeper?, color? })`, `museum.open({ title?, keeper?, color? })`.
- 아이템 `icon` 은 이모지 또는 그림 경로(`.svg/.png/.webp/.jpg`).
- 상태: `state.settings.keyHint` (키 안내 보이기, H 키·설정). 설정을 바꾸면 `settings:changed` 를 보내고 소리는 `audio.setVolume` 도 직접 부른다.

### audio 추가
- `bgm(name)` = 그 곡으로 고정, **`bgm('auto')`** = 자동 선곡(시각·비)으로, **`bgm(null)`** = 끄기. 우선순위: 열린 상점·박물관 창 > 고른 곡 > 자동. 집에 들어갈 때 `bgm('indoor')`, 나올 때 `bgm('auto')`.
- `sfx` 이벤트 내용: `{ name, volume?, pitch?, pan?, delay? }`.
- `speak(text, voice) → Promise<boolean>` (끝까지 말하면 true, 끊기면 false). 소리가 잠겨 있어도 같은 시간 뒤에 끝난다. `dialog:line` 에 `voice` 가 없으면 조용히 넘어간다.
- `setVolume(kind, v)` 는 `state.settings[kind]` 에도 적는다.

### time 추가
- `now()` 에 `hourF`(소수 시각), `ms`, `weekdayName`('일'~'토'). 돌려주는 객체는 얼려 있다 — 복사해서 쓴다.
- 개발용: `forecast(dayKey?)`, `setHour(hh)`, `setPaused(bool)`, `setWeather(w, {instant})` (강제 날씨는 다음 날 5시에 풀림), `setSeasonOverride(season|null)`.

### 2차에서 정할 것
- ~~실내 장면(P4)~~ → `time.setIndoor(bool)` + 이벤트 `scene:indoor {on}` (아래 '2차 W3 집·가구·제작' 절).
- ~~외곽선 설정~~ → `main.js` 가 `settings:changed {key:'outline'}` 를 듣고 `userData.outline` 메시를 모두 켜고 끈다. 외곽선 메시를 새로 만들 땐 `userData.outline = true` 를 꼭 붙인다.
- `ctx.quality` = `'high'|'low'` (터치 기기·`?quality=low` 면 low: 해상도 1.5배 제한, 그림자 1024·PCF). 무거운 효과는 low 에서 줄인다.
- **카메라와 하늘**: 기본 카메라에서 하늘이 잘 안 보여 구름·별·무지개가 묻힌다 — 화면 위쪽에 하늘 띠를 조금 남기는 쪽으로 조정.

---

## 2차 W3 집·가구·제작에서 추가된 약속 (2026-10-29)

배경: `docs/notes/house.md`. 위 내용과 다르면 이 절이 우선한다. (다른 2차 트랙 절과 합칠 때 부딪히지 않게 '2차 준비' 절 앞에 두었다)

### time (sky)
- `time.setIndoor(bool)`, `time.indoor` — 집 안: 하늘 돔·별·구름·비·눈·무지개를 숨기고 실내 조명(낮 하얀 빛·밤 따뜻한 빛), 안개를 멀리 민다(객체는 그대로), 배경 = 방 밖 어둠. 시계·날씨는 계속 흐른다. 바뀔 때 이벤트 `scene:indoor {on}`.

### ui
- `ui.fade(on, sec = 0.3, color?) → Promise` — 화면 전환 막 (HUD 위, 창·알림 아래). 집·건물을 드나들 때 같이 쓴다.
- `ui.craft.open({ title, color, onCraft(recipeId) }) → Promise<string[]>` — 작업대 창. 레시피 목록(✔·모자람) + 재료 가진 수/필요한 수 + 만들기(`data.recipes.craft`). 닫을 때까지 여러 번 만들 수 있고, 닫으면 만든 레시피 id 들.
- `ui.confirm` 버튼에 `disabled`, 본문 `text` 의 줄바꿈(`
`)은 그대로 줄이 바뀐다. 알림·확인 창 `icon` 도 그림 경로를 받는다.
- 레시피 재료는 data 의 `needs: [{ id | category, n }]` 를 그대로 읽는다 (`category` = '조개 아무거나'). 계약의 `materials` 모양도 읽는다.

### player
- `player.camera.setBounds({ x0, x1, z0, z1 } | null)` — 카메라 중심이 머무는 네모(월드 좌표). `player.camera.setCurveScale(k)` — 곡면 월드 세기 배율(1 = 보통). 집 안에서 house 가 쓴다.

### data
- 가방 칸 `variant` (선택): `{ id, count, variant }` — 가구 색·주민 사진의 주민 slug. 같은 변형끼리만 쌓인다. `inventory.add(id, n, { variant })`, `inventory.canFit(id, n, { variant })`, `collect(id, n, { variant })`. 저장·불러오기에서 남는다. 변형 없는 칸은 예전 모양 그대로.
- 가구 아이템 `icon` = `assets/furniture/renders/<slug>_thumb.png` (가구 모델 썸네일), `emoji` = 이모지. 대화 선택지처럼 글자 안에 넣을 때는 `emoji`.

### gameplay · house
- 행동 키 우선순위 추가: **가구 옮기는 중 120** (action = 내려놓기, pickup = 그만두기), 집 문 90, 실내 가구·작업대 80 (pickup = 바로 가방에), **실내 빈 바닥 = 가구 놓기 20** (집 안에선 도구 쓰기 10 까지 가지 않는다).
- `ctx.services.house = { inside, furniture, enter(), leave(), place(item, spot?, { variant }), remove(id), workbench(), models(), room }` — 선물 연출처럼 가방을 거치지 않고 방에 놓을 때 `place`.
- 이벤트: `house:enter {}`, `house:leave {}`, `house:craft {id, result}`.
- 상태 `state.house = { furniture: [rec], inside, seeded, radio, nextId }` — 바닥 rec `{ id, item, gx, gz, rot, variant?, holds? }` (칸 = 돌린 발자국의 북서쪽, rot 0 남·1 동·2 북·3 서), 벽 rec `{ id, item, wall: 'n'|'w'|'e', slot, variant? }`. `holds` = 어항·곤충 상자에 넣어 둔 물고기·곤충 id, `radio` = 켜 둔 채널(시간대 곡 이름) 또는 null.

---

## 2차 준비 (main 에 먼저 넣은 것)

### `src/gameplay/index.js` — 2차 트랙 묶음
- 하위 폴더 `gather/`(P2) · `town/`(P3) · `house/`(P4) 의 `index.js` 를 순서대로 불러온다 (없으면 건너뜀). **각 트랙은 자기 하위 폴더만 만든다. `src/gameplay/index.js` 는 고치지 않는다.**
- **행동 키 나눠 주기**: `ctx.services.gameplay.interactions.add({ name, intent, priority, test(ctx), run(target, ctx) }) → 해제 함수`.
  `input:press` 의 `action`/`pickup` 을 받으면 (UI 창이 열려 있으면 무시) 우선순위가 높은 처리기부터 `test` 해서 처음 대상이 나온 하나만 `run` 한다.
  권장 우선순위: 주민 말 걸기 **100**, 문·건물 들어가기 **90**, 실내 가구 **80**, 줍기 **50**, 도구 쓰기 **10**. 같은 키를 직접 `input:press` 로 따로 처리하지 않는다.

### `world.addZone(zone) → 해제 함수` — 섬 밖 공간(집 실내 등)
- `zone = { contains(x, z), collide(fx, fz, nx, nz, r, y) → {x, z}, heightAt?(x, z), groundAt?(x, z), isWalkable?(x, z) }`
- 플레이어가 구역 안에 있으면 `world.collide`·`island.heightAt`·`island.groundAt`·`island.isWalkable` 이 구역의 것을 쓴다. 실내는 섬에서 멀리 떨어진 좌표(예: x = 500)에 만들고 플레이어를 옮긴다.

---

## 2차 W1 채집에서 추가된 약속 (2026-10-29)

자세한 배경: `docs/notes/gather.md`. 위 내용과 다르면 이 절이 우선한다.

### 행동 키
- 채집이 쓰는 우선순위: **진행 중 막기 200** (`gather-busy`: 도구 동작·잡은 것 들어 보이기·낚시 중에는 Space/F 를 여기서 먹는다 — 낚시 중 Space = 찌 당기기), 나무 흔들기 60, 줍기 50, 심기 45, 도구 쓰기 10.
- 숫자키 1~5·Q/E·0 은 gather 가 받는다 (`player.toolKeys = false`). 가방에 없는 도구는 들 수 없다.

### player 추가
```js
act(name, { onHit, speed = 1, lock = true }) → Promise<bool>   // 'swing'|'cast'|'reel'|'dig'|'chop'|'water'|'shake'|'pickup'|'ouch'
hold('fish' | null),  acting → 동작 이름 | null                  // 'cast' 는 끝나면 저절로 'fish' 자세
toolModel() → Group | null (userData.tip, userData.bobber),  toolTip(out) → Vector3,  headTop(out) → Vector3
```
- `act` 중에는 플레이어가 움직이지 않는다. 다른 트랙(주민·집)도 같은 동작을 써도 된다.

### world 추가
```js
world.daily: { layout(), spotOf(id) → { kind, key }, take(id), holes(), addHole(tx, tz), removeHole(tx, tz) }
world.palette(kind, variant?) → { 재질이름: 색 }   // 배경 스펙 팔레트 + 변형 + 계절
objects.update(id, { scale, data }) → bool          // 크기(충돌체도 같이)·data 바꾸기. data 값이 undefined 면 그 칸을 뺀다
objects.query(...) 결과에 scale 추가
```
- 이벤트 `world:daily {dayKey, shells, weeds, fossils}` — 오늘 조개·잡초·화석 자리를 놓은 뒤 (game:ready·data:newday 때).
- 심은 것: `objects.add(kind, tx, tz, { grow: { stage, max } })` 인 물체는 새 날마다 한 단계 자란다 (다 자라면 `grow` 가 빠진다). 덜 자란 나무는 흔들기·도끼·열매가 없다.

### 상태
| 칸 | 주인 | 내용 |
|---|---|---|
| `island.spots` | world | `{ dayKey, shell:['tx,tz'], weed, 'fossil-spot', holes }` 오늘 놓은 자리·판 구덩이 |
| `island.drops` | gather | `[{ item, count, x, z, rot }]` 땅에 떨어진 물건 |
| `island.watered` | gather | `{ dayKey, ids:[물체id] }` 오늘 물 준 꽃 |
| `flags.gatherStarterTools` | gather | 첫 시작 도구를 줬음 |

### 이벤트
| 이벤트 | 보내는 쪽 | 내용 |
|---|---|---|
| `world:daily` | world | 위 참고 |
| `gather:watered` | gather | `{ids}` 물 준 꽃 |
| `gather:bloom` | gather | `{ids}` 새 날 물 준 꽃 옆에 새로 핀 꽃 |
| `gather:planted` | gather | `{id, item}` 구덩이에 심음 |

### 재질 (W4 셰이더와 맞출 것)
- gather 메시: `toonMaterial('#ffffff', { name: 'gather' | 'gather-flat' })` 에 `vertexColors = true` 를 켠 공용 재질 + `outlineMaterial(0.0035~0.005)`. 떨어진 물건은 `InstancedMesh`.
- 투명: `fishShadow`(opacity 0.42, depthWrite false), `fx-ring`, `fireflyGlow`. 곤충 날개는 `side = DoubleSide`. 낚싯줄은 `THREE.Line` + `toonMaterial(flat)`.

---

## 2차 W2 주민에서 추가된 약속 (2026-10-29)

자세한 배경: `docs/notes/town.md`. 위 내용과 다르면 이 절이 우선한다.

### 행동 키
| 이름 | 우선순위 | 언제 |
|---|---|---|
| `town:talk` | 100 | 주민이 1.3칸 안·앞쪽(0.8칸 안이면 옆도)·같은 높이 |
| `town:intro` | 100 | 첫날 안내 전, 밤톨 2.2칸 안 |
| `town:mail` | 91 | 플레이어 집 우편함 1.15칸 안, 그쪽을 볼 때 |
| `town:knock` · `town:shop` · `town:museum` | 90 | 주민이 집에 있을 때 그 집 문 / 상점 문·밤톨 / 박물관 문·느루 |

### 이벤트
- `town:intro {done: true}` — 첫날 밤톨 안내가 끝났을 때 (`state.flags.intro = true` 와 같이).
- `mail:new {from, kind}` — 우편함에 편지가 들어왔을 때.

### 상태 (2차 gameplay 칸)
```js
state.villagers[slug] = { friendship /* 0~100 */, met, lastTalk, talkDays, giftDay, giftsToday, backDay,
                          request: { cat, id, label, day } | null, doneDay, thankedDay, pending: [itemId], photo }
state.flags = { intro, museumVisit, museumReward, … }
state.mail = { list: [{ id, from, kind, day, lines, gift, read, stub? }], day, nextId }   // 새 칸 (town)
```

### world 추가
- **`world.addMover(m) → 해제 함수`** — 움직이는 충돌체. `m = { x, z, r, y?, active? }` (값은 getter 여도 된다). 섬 위 `world.collide` 가 원으로 밀어낸다. 출발점이 그 원의 중심이면(= 자기 자신) 건너뛴다. `isWalkable` 에는 들어가지 않는다 (길찾기는 그대로). town 이 주민·가게 주인·플레이어를 올린다.

### data · ui
- 아이템 `buyPrice` 칸이 생겼다 (`buy` 와 같은 값, 상점에서 살 때 값).
- ui 의 아이템 값(`itemInfo`)은 `data.economy.sellPrice / buyPrice` 를 먼저 쓴다 → 섬 특산 과일은 싸게 사 주고, 사는 값은 판매가가 아니라 `buy`.

### 재질
- 집을 드나드는 주민은 재질의 `opacity`·`transparent` 를 바꾸고 `needsUpdate` 한다. 툰·외곽선 재질을 바꿀 때 이 둘이 그대로 먹게 둔다.

### 개발용 (계약 밖)
- `ctx.services.town = { villagers, keepers, state(slug), talkTo(slug), mail: { unread(), post(from, kind, gift), deliver(dayKey), spot }, debug }`.

---

## 2차 W4 스타일 셰이더 (stylized-shader)

자세한 설명: `docs/SHADERS.md`. 비교·조절: `demos/style.html`.

### `style` — W4 (src/render/)
```js
preset → 'cozy' | 'toon'          // cozy = 동숲풍 기본, toon = 2차 이전 모습(2단 명암·갈색 잉크 외곽선·화면 효과 없음)
presets, labels, params           // 프리셋 복사본, 화면 이름, 조절 값 목록(이름·묶음·범위)
use(name),  set({...값} | name),  get()       // set 은 지금 값에 덮어쓰기, set({ preset, ...값 }) 은 프리셋 위에
compare({ on, x, preset | params })            // 나눠 보기 (편집기용)
stats() → { ms, passes }
```
- 이벤트 `style:changed {preset, params}`. 주소 `?style=toon|cozy` 가 저장값보다 먼저.
- **처음 프리셋**: `?style=` > `state.settings.style`(섬폰 설정, 저장됨) > `cozy`. ui 는 바꿀 때 `settings:changed {key:'style', value}` 를 보내면 render 가 따라간다.
- **집 안**: `scene:indoor {on}` 을 받으면 프리셋 위에 실내 값(`presets.js` 의 `INDOOR`)을 잠깐 얹는다.

### materials 추가
- `ctx.materials.look` (모든 스타일 재질이 함께 쓰는 uniform), `STYLE_NAMES`, `styleClass(name)`, `setOutlinesVisible(bool)`.
- `toonMaterial(color, { flat, bend, name, character, wind, water, spec, glow, styleAttr })` — 이름으로 효과가 정해진다: 바람 `leaf weed petal petalDark flower stem grassDark`, 물결 `sea water waterLight waterDeep waterfall`, 하이라이트 `beak shell metal nose glasses fruit coconut window acorn bowtie`, 빛나기 `flame flameCore firefly sparkle`.
- **여러 재질을 한 메시로 합칠 때**(world 배경 묶음처럼): 꼭짓점 속성 `aStyle = styleClass(재질 이름)` (0 없음 · 1 바람 · 2 물결 · 3 하이라이트) 을 넣고 재질을 `styleAttr: true` 로 만든다. 외곽선 판에 `color` 속성 + `vertexColors = true` 를 주면 은은한 외곽선이 그 색을 따른다.
- `outlineMaterial(width, { color, bend, base, wind, styleAttr })` — 외곽선 메시엔 계속 `userData.outline = true`. 섬폰 외곽선 끄기는 메시 `visible`, 스타일 `outline: 'off'` 는 재질 `visible` 을 끈다.
- 셰이더를 덧씌울 때: `#include <begin_vertex>` 표시를 지우지 않는다. uniform 이름 `uTime` 은 world 가 쓰므로 스타일은 `uStyleTime`.
- 새 `ShaderMaterial` 은 화면 색(sRGB)을 그대로 내보내도 render 가 화면 효과 때 선형으로 바꿔 준다. 직접 맞추려면 sky 처럼 `linearToOutputTexel( vec4( sRGBTransferEOTF( vec4(c, 1.0) ).rgb, a ) )`.

## 실내 검수 보드 interiors (p12-interiors)에서 추가된 약속 (2026-11-04)

배경: `docs/notes/p12-interiors.md`, 보드 https://claude.ai/artifact/8w5fbrjNthoTgkCMqHURDh (D67–D73). 위 내용과 다르면 이 절이 우선한다.

### 문 드나들기 (house — `src/gameplay/house/door.js`)
- 내 집·주민 집·상점·박물관이 같은 `doors.through({ dir: 'in'|'out', place, kind, variant, room: { x, front, entry }, arrive(spot) })` 를 쓴다. 들어갈 때: 문짝이 안으로 열림(문 소리) → 문간까지 걸음 → 원이 좁아짐 → `arrive` (실내로 옮기기) → 원이 열리며 한두 걸음. 나올 때 거꾸로, 섬에 나와서 문이 닫힌다. 흔들림 줄이기(`ui.access.calm`)면 걷기·문 동작 없이 문 소리 + 전체 페이드.
- 지나가는 동안: 플레이어 `freeze`, 가림 투명(`world.occlusion.enabled`) 끔, 행동 키는 `house-door-busy`(우선순위 **300**)가 삼킨다. `ctx.services.house.passing` 이 참.
- 문짝은 섬 건물 모델(`assets/env` 의 `door` 재질 부분) 크기 그대로 덧씌운 판이다 — 건물 모델을 바꿀 때 `door` 재질 이름을 지킨다 (`tests/places.test.mjs`).

### player
- `player.walkTo(x, z, { speed = 걷기×0.8, face = true }) → Promise<bool>` — 연출 걷기: 충돌 없이 곧장, 걷기 동작·발소리·높이 따라가기는 그대로, 입력은 받지 않는다(얼어 있어도 걷는다). 도착하면 true, `teleport`·다른 `walkTo` 로 끊기면 false. `player.walking`.

### ui
- `ui.fade(on, sec, color?, { shape: 'plain'|'circle', at: { x, y } }?)` — `'circle'` 은 화면 점 `at`(px) 둘레로 원이 좁아졌다(on) 커진다(off) (UI-12). 흔들림 줄이기여도 화면 전환 막(`.pk-fade`)은 서서히 바뀐다.

### house 추가
- `house.where` 에 `'shop'`·`'museum'` 이 더해진다. `house.doormat()` → 지금 방 문 매트 `{ x, z }` | null (QA 봇·편집기용), `house.passing`.
- `house.places = { enter(kind), leave(), where, info(kind) → { keeper: { x, z, facing }, keeperSlug, talk: { x, z }, doormat, room, name } | null, shown(kind), placeholders(kind) }` — 상점·박물관 실내 (`places.js`). 방 자리 상점 x = 580, 박물관 x = 620 (`room.js` `PLACE_ROOMS`).
- 이벤트 `place:enter { place, name, keeper, room }` · `place:leave { place }` — 상점·박물관은 `house:enter` 를 쓰지 않는다 (첫날 할 일 '집 들어가기'·주민 방 주인 세우기와 섞이지 않게).
- 상태 `state.house.place` = 실내에서 저장했으면 `'shop'|'museum'` (없거나 null 이면 밖). 예전 저장은 그대로 열린다.
- 행동 키: 실내 문 매트 나가기 `house-place-out` **90**, 실내에선 도구를 쓰지 않음 `house-place-idle` **20**.
- `room.js`: `buildRoom(ctx, { size: [가로, 깊이], windows, door: { gx0, gx1 }, name })`, `cameraBox(origin, w, d)`, `cornerOf(origin, w, d)` (→ `{ x0, z0, w, d }`, `wallMount` 가 `w` 로 동쪽 벽을 잡는다). 8×8 방은 예전 값 그대로.
- 방 배치 `assets/interior/places/<shop|museum>.json` (RM-08 · RM-09) — 주민 방 모양 + `size`·`windows`·`door`·`keeper`·`talk`·`furniture[].role 'counter'`·`scale`·`look`, 상점 `stock`, 박물관 `cases`·`fossils`. 검사 `checkPlace` (`placedata.js`).
- 상점·박물관 붙박이 모델 = `assets/furniture/fixtures/` (FU-35–42, `category: 'fixture'`, `item: 'fixture.<slug>'` — 아이템 표 밖). 가구와 같은 빌더·같은 모양(`index.json`·`specs`·`models`), `node tools/build-furniture.mjs --fixtures`. 게임은 `createFurnitureKit(ctx, { base: 'assets/furniture/fixtures' })`, 배치는 `fu` 로 고르고 케이스는 `cases[].fixture` (slug). 모델을 못 읽으면 `box`·`color` 임시 상자.
- 방 배치 가구 `deco: true` (주민 방·상점·박물관 공통) = 1칸짜리 구석 소품. 사양(`ctx.quality`) 낮음·매우 낮음이면 숨기고 충돌에서도 뺀다. 단풍 방 RM-07 = `assets/interior/rooms/rm-07.json`.

### town 추가
- `town.placeRule(kind)` → `'open'` | `'closed'` | null (첫날 안내 전) — house.places 가 문 쪽으로 밀 때 묻는다. 상점은 영업시간(`economy.isOpen`)에만 open, 박물관은 늘 open.
- 실내가 있으면(`house.places`) 밤톨·느루는 영업시간엔 계산대·안내대 뒤(mode `'desk'`), 문 앞 행동 키 `town:shop`·`town:museum`(90) = 들어가기(글자 '들어가기'), 실내 계산대 앞 같은 처리기 = 지금의 인사·창(D73-A). 첫날 축하처럼 밖에서 할 일이 있으면 문 옆으로 나왔다가 멀어지면 다시 들어간다. 실내가 없으면 예전처럼 문 옆 밖.

## 리소스 교체 약속 (2026-10-29, 61종 임시 확정 뒤)

모델은 편집기 요청으로 언제든 다시 만들어 바꿔 끼운다. 게임 코드를 고치지 않고 바꿀 수 있게, 요소마다 필요한 값은 그 요소의 스펙 JSON 하나에 둔다. `tests/assets.test.mjs` 가 아래 약속을 검사한다.

- **파일**: 요소마다 `specs/<slug>.json` · `models/<slug>.glb.json`(+`.glb`, `.stats.json`) · `renders/<slug>_thumb.png` … 를 따로 둔다. 목록 `index.json` 은 빌드 도구가 스펙에서 만든다 (`id`·`version`·`status` 가 스펙과 같아야 한다).
- **status**: `review`(검수 대기) | `approved`(확정). "<이름> 확정" → 스펙 status 를 approved 로 바꾸고 `node tools/build-*.mjs --index`. 확정한 요소를 다시 고치면 `version` 을 올리고 status 를 `review` 로 돌린다 (다시 "확정"할 때까지).
- **재질 이름 = 팔레트 키** (빌더 고정 재질 `eyeHighlight` 만 예외). 열매 메시 `fruit`(fruit-tree)·`coconut`(palm), 땅 색 키 `tile-grass.grass/dirt` · `tile-sand.sand` · `tile-path.path` · `tile-plaza.stone` 는 이름을 바꾸지 않는다.
- **캐릭터**: 동작 `idle walk run happy`, 뼈 `arm.L arm.R spine head`, 뼈대(skin) 하나.
- **배경 `world` 칸** (게임 배치 정보, 빌더는 읽지 않는다): `collider` (충돌, 모델 원점 기준: `r` 원 · `box [가로, 세로]` · `boxes [[x0,z0,x1,z1]…]` · `circles [[x,z,r]…]`), `extent` (query 반너비 `[x, z, _, z중심이동]`), 건물 4종은 `lot` (집터 칸 수 `[가로, 세로]`, 섬 만들기가 씀). 모델 크기를 바꾸면 같은 파일의 world 값을 맞춘다 — 상자 충돌 가로가 모델 가로의 88%~+0.1, 건물 모델이 집터 안이어야 테스트가 통과한다.
- **가구**: 배치는 스펙 `footprint`·`place`·`layer` 만 쓴다. `src/data/items.js` FURN 표의 칸 글자('2×1', '벽', '창문')는 화면 표시용이라 footprint 를 바꾸면 같이 고친다 (테스트가 어긋남을 잡는다). 벽시계 바늘 노드 `hourHand`·`minuteHand`.
- **그대로 코드에 있는 것**: 해안선·바다·강 둑 모양(절차 생성, 색만 타일 팔레트), 집 안 작업대 칸 `[2, 1]`(house/index.js), 흔들림·그림자 제외 종류 표(world/objects.js `SWAY`·`NO_SHADOW`).


## 8차 계절 행사 (M8-P1, 보드 wave8 반영 v1) — 자세히는 `docs/notes/m8-events.md`
- **상태** `ctx.state.events` (주인: gameplay/events): `{ told, before, runs: {"<EV-id>:<해>": { first, days, todo: {<id>: {n, day}} }}, stamps: {<EV-id>: ["<해>"]} }`.
- **서비스** `ctx.services.events = { config, today(), active(), live(), isOpen(), progress(id, todo, n), todo(id), stamp(id), stamps(), calendar(year) }` — 행사 놀이(M8-P3–P6)는 할 것이 되면 `progress`, 보상 때 `stamp`.
- **이벤트** `events:start {id, year, first, dayKey}` · `events:todo {id, todo, n, goal, done}` · `events:stamp {id, year}`.
- **ui** `ctx.services.ui.calendar = { open() }` (섬폰 「📅 달력」 줄). **날짜 흉내** `ctx.preview = { date, saveKey } | null` — 주소 `#date=YYYY-MM-DD` · `?date=`, sky 가 시계를, data 가 저장 칸(`island-life-save-v1-preview`)을 바꾼다.
- 행사 시간 `hours` 는 게임 하루 시각 5~29. 섬 축제 날은 17시에서 끊긴다 (섬 축제 먼저, D75-A). 첫 섬 축제(엔딩) 전엔 열리지 않는다 (D83-A).

## 9차 섬 꾸미기 · M8 남은 것 (M9-P1–P3, 보드 wave9 반영 v1 = D86–D92 모두 A) — 자세히는 `docs/notes/m9-decor.md`
- **상태**: 새 칸 없음. 밖에 놓은 길·울타리·야외 가구는 `state.island.added` (주인 world) 에 `data: { decor: 'path'|'fence'|'furn', item?, rot, variant, at? }` 로 남는다. 야외 가구는 놓을 때 가방에서 빠지고 치우면 돌아온다.
- **서비스** `ctx.services.decor = { open(), close(), place(), remove(), rotate(step), choose(pick), setMode('place'|'edit'), catalog(), active, mode, pick, view, list(), isRoad(tx, tz), hangouts() → [{x, z, face, id}] }` (gameplay/decor). `ctx.services.ui.decor = { open() }` — 섬폰 APPS `decor` 줄 (`closes: true` = 섬폰을 닫고 연다).
- **이벤트** `decor:mode {active}` · `decor:place {kind, group, item, tx, tz}` · `decor:remove {kind, group, item, tx, tz}`. 꾸미는 동안 행동 키 처리기 `decor:place`(action)·`decor:rotate`(pickup) 110, 키 Q/E·Tab·X·Esc 는 decor 가 먼저 받는다(창이 아니라 걷기는 그대로).
- **world.objects 추가**: `on(tx, tz)` (한 칸의 모든 물체 — 모델을 받는 중인 것 포함) · `groundAt(tx, tz)` (spec `world.ground` → 발소리) · `spec(kind)` · 공개 모양에 `rot`. **변형 이름 = `<색 변형>+<꼬리표>…`** (`src/world/variants.js` `splitVariant`): 모델 부품 `link_<n|e|s|w|ne|nw|se|sw>` 은 그 꼬리표가 있을 때만, `opt_<묶음>_<값>` 은 `spec.world.options[묶음]` 중 꼬리표 값 하나만(없으면 첫 값) 남는다. 스펙 `world.connect`('path'|'fence') · `world.layer`('ground' = 길 위에 다른 것을 놓을 수 있음) · `world.collider.links`(이어진 쪽마다 반두께 상자) · `world.render`(렌더에 보일 팔). `setVariant` 는 받는 중인 물체에도 먹고, 울타리면 충돌도 다시 만든다.
- **야외 가구 = world 물체 `fu:<가구 slug>`**: 아이템 `outdoor: true` (`src/data/decor-items.js` `OUTDOOR`) 인 가구는 world 가 lazy 종류로 알고 가구 모델·스펙을 받아 `furnitureWorld(spec)` (extent = 발자국 반, 충돌 없으면 발자국 90% 상자) 로 놓는다. 가구 스펙 `outdoor: true` → 가구 목록 `index.json` 에도.
- **player 추가**: `setGait(name|null)` (걸을 때 걷기 대신 — 'push') · `setStance(name|null)` (서 있을 때 서기 대신 — 'sparkler') · `hasClip(name)` · `handPoint(out)`. 주인공 클립에 `sparkler`(AN-08) · `push`(AN-09) · `place`(AN-10) — 스펙 `animations` 에 이름이 있는 캐릭터만 빌드된다 (지금 주인공).
- **행사 소품**: events.json `props[0]` → 배경 모델 `event-<이름>` 을 그 행사 주간 동안 주인공 주민 뼈에 단다 (`events/props.js` `PROP_MOUNT`, 소품 모델은 그 행사 `assets.env` 에 적어 계절 묶음으로). 주민 가림 투명·나타나기를 따라간다.
- **town**: `createNav(island, { roadAt })` — 깐 길(`decor.isRoad`)은 흙길처럼 싸게. 주민 `pickSpot` 이 가끔 `decor.hangouts()` (벤치·피크닉 탁자 앞)로 간다.
- **웹 빌드**: 묶음 `decor` (길·울타리 모델·스펙, 처음에 안 받음 — `tools/build-web.mjs` `DECOR_FILES`), `assets/decor/decor.json` 은 island 묶음.

## 10차 이사 오가기 · 첫 만남 장면 (M10-P4·P5, 보드 wave10 D94-A · D98-A) — 자세히는 `docs/notes/m10-moving.md`
- **상태** `state.town.moving` (주인 town — `town/moving.js` `movingState`, 없으면 만든다 · 예전 저장 그대로 열림): `{ arrived: [slug], homes: {slug: 집터 id}, coming: slug|null, last: dayKey, opened: dayKey, freed: [집터 id], origin: dayKey, since: {slug: dayKey}, ask: {slug, day}|null, rolled: dayKey, quietFrom: dayKey, calm: {slug: dayKey}, leaving: {slug, lot, ok, boxes, gone, told?}|null, departed: [{slug, lot, day, next, sent}], welcomed: {slug: dayKey}, blockedTold? }`. 집터 id = `home:<처음 주인>` | `spare-<n>`. 엔딩 뒤 이사 단계(표지판·이삿짐·입주 날)는 엔딩 전 이사와 같은 칸 `state.town.movein[slug]` (moving 이 `start` 를 정한다). 처음부터 서 있던 집이 떠나며 치워지면 world 의 `state.island.removed` 에 `house-villager@<cx>,<cz>`·`mailbox@<x>,<z>` 가 남는다.
- **주민 파일** `"arrives": "moving"` = 엔딩 뒤 이사 오는 주민 (처음엔 섬에 없음, files.js 순서대로 온다). 선택: `house.variant` (집 지붕 색 변형, 없으면 `moving.js` `ROOF` 표: gureum lilac · pado blue · dalmuri navy), `lines.leave = { ask, ok, stay, later, packing, farewell }` (떠나기 묻기 대사, 없으면 기본 대사), `lines.letters.away` (떠난 뒤 편지, 없으면 기본 편지).
- **world**: `places.villagerHouses[]` 에 `site` (집 자리 `{tx, tz, fw, fd, cx, cz, pad}` — 모든 집), `places.spareLots` = 남는 집터 `[{ slug: null, id: 'spare-1', door, x, z, lot, site }]` (섬 생성기가 **모든 물체를 놓은 뒤** 찾아서 다른 물체 id·난수는 그대로, 그 자리 풀·나무 몇 개만 빠진다 — `SPARE_LOTS`, `generateIsland(…, { spares })`). **town 이 `places.villagerHouses` 를 고친다**: 주인 없는 집터는 목록에서 빠지고(지도·문·주민 방이 따라감), 새 주민 집터는 들어가며 `slug` 가 바뀐다.
- **서비스** `ctx.services.town` 추가: `residents()` 는 떠난 주민 빼고 엔딩 뒤 이사 온 주민 포함 · `houseVariant(slug)` (house/visit.js 문 덧판) · `moving = { state(), lots(), stage(slug) 'coming'|'moved'|'asked'|'boxes'|'gone'|null, asking(slug), count() }`.
- **이벤트** `town:movein {slug}` (엔딩 뒤 이사도) · `town:welcome {slug, x, z}` (새 주민 이삿날 저녁 17시~새벽, 집 밖일 때 한 번 — 장면 트리거) · `town:leave-ask {slug, answer: 'ok'|'stay'}` · `town:moveout {slug, lot}`. 편지 `mail:new` kind `moving`(오기 전날) · `movein` · `away`(떠난 뒤). `mail.post(from, kind, gift, { pool })` — 주민 파일에 그 편지가 없을 때 쓸 묶음.
- **장면 트리거** `move-in` (`story/rules.js`, `trigger.slug` = 주민): s17 구름 · s18 파도 · s19 달무리, `place: "event"` = 새집 문 앞. `?story=` 미리 보기는 그 주민 집(없으면 남는 집터) 문 앞.
- **말 걸기**: `town:talk` 가 `moving.talk(V)` 를 먼저 부른다 — 물을 마음이면 대사 → 확인 창 「떠나 볼까…」(말리기 = 처음 칸·primary, 허락) 로 끝, 떠나는 중이면 인사 한마디 뒤 평소 대화. 물을 마음인 주민 이름표 위에 💭.
- **앉기 (AN-11, D95-A)** — 모델: 캐릭터마다 동작 `sit_down`(한 번)·`sit`(반복)·`stand_up`(한 번), 뿌리는 그대로·엉덩이만 내려감. 앉는 자리 값 `sit = {hip, forward}` 은 `assets/models/index.json` `models[i].sit` (glTF `<slug>_rig` 노드 `userData.sit`·`.stats.json` 에도 같은 값). 놓는 법: `root.y = 자리 윗면 − hip`, `root.xz = 자리 가운데 − 바라보는 쪽 × forward`. 다리는 허벅지 `leg.L/R` + 새 정강이 뼈 `shin.L/R`. 클립이 없는 모델은 앉지 않고 앞에 서기만.
- **서비스** `ctx.services.seats` (새): `claim(key, who)` · `release(key)` · `holder(key)` · `outdoor()` · `sitPlayer(seat)` · `claims()` — 자리 이름은 밖 `decor:<id>#n`, 집 안 `house:<recId>#n`. 한 자리에 하나만, 주인공이 앉은 자리는 주민이 건너뜀. player: `sit(seat)` · `stand()` · `seated` · `seat` · `sitInfo` (앉은 동안 저장되는 자리는 일어설 곳). actor: `pinned` · `sit` · `hasClip` · `clipSeconds` · `playOnce(name, then)`, 주민 mode `'sit'`. 행동 키: 일어나기 115 · 앉기 85 (`decor-sit` 밖 · `house-sit` 집 안). 집 안 의자·소파의 가구 메뉴는 F 「고치기」.
- **이벤트** `player:sit {key}` · `player:stand {key}` · `decor:move {kind, group, item, from, tx, tz}`.
- **섬 꾸미기 (D95-A 옮기기 · D96-A 칸 누르기)**: decor 서비스 `pickUp()` · `drop()` · `cancelMove()` · `moving` · `setCell(tx, tz)` · `onCell` · `cell`, `hangouts()` 는 빈 자리마다 `seat` 도 준다. 들고 있는 동안에도 `state.island.added` 에 옛 자리를 두고(새 저장 칸 없음), 꾸미기를 끄거나 새로 고치면 제자리. 칸 누르기 = 꾸미기 중 짧은 클릭·톡 (플레이어 칸에서 가로·세로 6칸 안), 걸음은 꾹 누르기·끌기 — mouse `ctx.input.pointerMove.setClickHandler(fn)` · `pickAt`.
- **상점 (D99-A)**: `rules.json` `shop.furniturePerDay` 4 · `shop.outdoorPerDay` 1 → 하루 가구 = [실내 셋, 야외 하나] (`economy.js` `pickShopFurniture`, `shopStock` 에 `outdoor`), 상점 방 `places/shop.json` v3 야외 가구 받침.
- **가구 FU-51–53** `furn.paint-easel` · `furn.sea-chart-frame` · `furn.star-telescope` (`decor-items.js` `FAVOR_FURN`, 망원경 `outdoor: true`). 섬에 놓은 망원경 Space(`decor:telescope` 85) = 밤 19–5시 6초 올려다보기 (`src/gameplay/decor/telescope.js`). 주민 집 BD-02 지붕 변형 `lilac`·`blue`·`navy` (`world.objects.add('house-villager', x, z, { variant, owner })`).

## 투어 — P35 무인도 투어 (보드 tour 반영 v1 = D120–D128 모두 A) — 자세히는 `docs/notes/p35-tour.md`
- **설정** `assets/tour/tour.json` (`env` 투어 배경 모델 = 묶음 갈래 `tour` · `ox` 투어 섬 x 자리 700 · `ticket {item, price 1000, perDay 1, firstFree}` · `ore {maxHits, table, rest}` · `guest {every, firstTrip}` · `rare {fish, bugs}` · `boat.sail`). 결정이 바뀌면 이 파일부터.
- **상태** `state.tour` (주인 tour, 없으면 만든다): `{ day, trips (그날 다녀온 횟수), total, gifted (첫 표 받음), invited: [slug], last: {shape, seed, day} }`. **투어 섬 지형·물체·떨어진 것은 저장하지 않는다.** 섬에서 끄면 다음엔 본섬 선착장 끝에서 시작 (`game:ready` 때 x 가 `ox − 200` 넘으면 옮김). `state.town.moving.invited` = 투어 섬에서 초대한 주민 (town 주인, `planArrival` 이 먼저 고른다).
- **world** 추가: `world.islet = { active, current, enter(gen, ox) → Promise (투어 묶음 모델을 받고 세움), leave() }` (`src/world/islets.js` `buildIslet`: 본섬과 같은 지형·물체·충돌 코드, **따로 kit**). 들어가 있는 동안 `world.island` 의 칸 질문(`w`·`h`·`tileAt`·`levelAt`·`toTile`·`toWorld`·`flagsAt`·`rampAt`·`passable`·`isWalkableTile`)·`world.objects`·`world.places`·`nativeFruit` 가 **투어 섬** 것이 되고, 월드 좌표 질문(`heightAt`·`isWalkable`·`groundAt`·`collide`·`isWater`·`coastDistance`·`riverDistance`)은 자리로 고른다 (투어 섬 구역 = `addZone`). 그래서 나무 흔들기·낚시·곤충·바위 치기·꽃 꺾기·떨어진 것 줍기가 그 섬에서 그대로 돈다. 본섬을 봐야 하는 곳은 `world.home = { objects, places, island }` (날마다 놓기 `spawnTiles`·`daily` 는 늘 본섬). 생성 gen 에 `ox` 가 있으면 해안·둑·바다 판 좌표가 그만큼 옮겨진다 (`coastfield`·`banksfield`·`banks`·`terrain.buildSea`). 이벤트 `world:islet {active, shape?, seed?}`.
- **투어 섬 생성기** `src/gameplay/tour/islet.js` (순수): `generateIslet(seed, {shape, guest})` → `generateIsland` 와 같은 모양의 gen (30×26, 모양 틀 `SHAPES` TO-01 둥근 · TO-02 초승달 · TO-03 쌍둥이(다리) · TO-04 언덕(경사로를 못 놓으면 평평), 물체 id 앞붙이 `tour:`, `places = {dock, boat, spawn, guest?}`, `nativeFruit` = 망고·리치) · `isletOf(dayKey, trip, baseSeed)` → `{seed, shape}` (같은 날 같은 횟수 = 같은 섬) · `unreachable(gen)`.
- **data**: 출현표 `data.spawns.fish/bug/fishPool/bugPool` 이 `tour.active` 이면 `islet: true` 를 붙인다 → 서식지 `islet`(물고기 자리 「무인도 바다」)·곤충 자리 `islet-<자리>`(「무인도 바위」·「무인도 공중」)가 섞임. 과일 `islet: true` (망고·리치)는 섬 특산(`economy.nativeFruit`)에서 빠진다. 새 아이템: `fish.rainbow-wrasse` · `fish.flower-scorpionfish` · `bug.jewel-beetle` · `bug.moon-moth` · `fruit.mango` · `fruit.lychee` · `mat.gold-ore` · `mat.crystal` · `mat.tour-ticket` (MA-09, 아이콘 IC-TR-01).
- **서비스** `ctx.services.tour` (새): `active` · `busy` · `current {shape, seed, guest, invited}` · `canGo() → {ok, reason?, pay: 'gift'|'ticket'|'acorns'}` · `go()` · `back({auto})` · `boat()` (지금 섬의 배 자리) · `stand()` (본섬 선착장 끝) · `config`. town 서비스 `moving.movers()` · `moving.invite(slug)` 추가.
- **행동 키**: 배 `tour-boat` 95 (본섬 선착장 끝 배 1.7칸 안 → 「섬 여행」, 투어 섬 배 → 「돌아가기」) · 다른 섬 주민 `tour-guest` 99 (말 걸기 → 초대 확인 창) · 광석 바위 `tour-ore` 11 (삽·도끼를 들고 EN-13 앞, 바위 하나 하루 6번 = `ore.maxHits`, 떨어진 것은 gather drops). 투어 섬 배 앞에서 Space = 돌아가기, 새벽 5시(`data:newday`) = 저절로 돌아옴.
- **이벤트** `tour:arrive {shape, seed, guest}` · `tour:return {auto}` · `tour:invite {slug}`.
- **본섬 배** BD-08 `tour-boat` 는 tour 가 `world.home.objects.add('tour-boat', …, { persist: false, id: 'tour:home-boat', at })` 로 선착장 끝 동쪽 바다에 놓는다 (저장 안 함, 투어 묶음 모델 — 받는 동안 기다렸다 놓임).
