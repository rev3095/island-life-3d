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
| `input:press` | core | `{intent}` action, pickup, toolPrev, toolNext, tool1~5, toolNone, bag, phone, map |
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
- 타일 모델(`tile-grass` 등)은 1×1, 윗면 높이 0 (절벽은 윗면 1.0, 경사로는 1×2).
