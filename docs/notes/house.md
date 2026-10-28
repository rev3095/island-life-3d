# W3 P4 집 실내·가구·제작 — 작업 노트 (`p4-house` 브랜치)

## 만든 것

| 파일 | 내용 |
|---|---|
| `assets/blender/build_furniture.py` | 가구 빌더. `toonkit.py` 를 배경 빌더처럼 불러 쓰고(고치지 않음), 스펙 `kind` → `BUILDERS` 함수. 렌더 외곽선도 게임과 같게 **재질 이름(`style.noOutline`)으로** 뺀다. 도우미: `annulus`(나이테·무늬 고리), `rail`(위아래로 꺾여도 안 뒤틀리는 관), `scallop`(조개), `slab`(자른 면), `log`, `side_table`, `glass_frame` |
| `tools/seed-furniture-specs.mjs` | 가구 20종 스펙 만들기 (`--force` 로 다시 쓰기). 배경 스펙 모양 + `item`, `footprint`, `place`, `layer` |
| `tools/build-furniture.mjs` | `node tools/build-furniture.mjs <slug…> \| --all [--no-render]` → `.glb`·`.glb.json`·렌더·`stats.json`, 끝나면 `assets/furniture/index.json` |
| `assets/furniture/` | `specs/`, `models/`, `renders/` (`_main` `_front` `_top` `_thumb`, 변형 있으면 `_variants`), `index.json`. `.blend` 는 gitignore |
| `src/sky/indoor.js` + `src/sky/index.js` | 실내 모드 `time.setIndoor(bool)` (아래) |
| `src/gameplay/house/index.js` | 모듈 입구: 드나들기·구역·가구 상태·행동 키·이어하기 |
| `src/gameplay/house/grid.js` | 칸 계산·충돌 (three·DOM 없음). `tests/house-grid.test.mjs` 로 확인 |
| `src/gameplay/house/room.js` | 8×8 방 (x = 500): 판자 바닥, 줄무늬 벽지·징두리, 창문 둘, 문 매트 |
| `src/gameplay/house/furniture.js` | 가구 모델 불러오기·툰 스타일·변형 색·벽시계 바늘·모닥불 불꽃·어항 반투명 |
| `src/gameplay/house/craft.js` | 작업대: `ui.craft` 가 없을 때 쓰는 대화 선택지 + `ui.confirm` 판 |

### 제안을 반영하며 다른 폴더에 더한 것 (사용자 요청, 2026-10-29)

wave 2 다른 트랙(W1 `src/player/index.js`·`motions.js`·`tools.js`, W2 `src/gameplay/town/`, W4 `src/core/materials.js`·`src/main.js`·`src/render/`)이 고친 파일은 건드리지 않았다. `git merge-tree` 로 세 브랜치 모두와 충돌 없음을 확인했다.

| 파일 | 더한 것 |
|---|---|
| `src/ui/craft.js` (새) · `ui/index.js` · `ui.css` | 작업대 창 `ui.craft.open`, 화면 전환 막 `ui.fade` |
| `src/ui/panels.js` · `hud.js` | 확인 창 버튼 `disabled`·본문 줄바꿈, 알림·확인 창 그림 아이콘 |
| `src/ui/dom.js` · `phone.js` | `recipeNeeds` — 섬폰 레시피 앱이 data 의 `needs`(카테고리 재료 포함)를 읽는다 (재료가 빈칸이던 것 고침) |
| `src/player/camera.js` | `camera.setBounds`, `setCurveScale`, `bounds` |
| `src/data/inventory.js` · `index.js` · `save.js` | 가방 칸 `variant`, `collect(id, n, { variant })` |
| `src/data/items.js` | 가구 `icon` = 썸네일 그림, `emoji` = 원래 이모지 |
| `tests/house-grid.test.mjs` (옮김) · `tests/variant.test.mjs` (새) | 칸 계산 7개, 변형 4개 |
| `docs/CONTRACTS.md` | '2차 W3 집·가구·제작에서 추가된 약속' 절 ('2차 준비' 앞), '2차에서 정할 것'의 실내 항목 정리 |

## 가구 20종

좌표: Blender 정면 -Y = 게임 +Z, 1.0 = 한 칸. 바닥 가구 원점 = 발자국 가운데 바닥, 벽·창문 가구 원점 = 벽면 바닥(뒤가 벽).

| ID | slug | 이름 | 발자국 | 놓는 곳 | 변형 |
|---|---|---|---|---|---|
| FU-01 | log-chair | 통나무 의자 | 1×1 | 바닥 | |
| FU-02 | log-table | 통나무 테이블 | 2×2 | 바닥 | |
| FU-03 | wood-bed | 나무 침대 | 2×3 | 바닥 | 이불 민트·분홍·노랑·파랑 |
| FU-04 | campfire | 모닥불 | 1×1 | 바닥 (불꽃 `flicker`) | |
| FU-05 | woodpile | 장작더미 | 1×1 | 바닥 | |
| FU-06 | floor-lamp | 스탠드 조명 | 1×1 | 바닥 (`glow` = 밤에 켜짐) | 갓 크림·민트·분홍·파랑 |
| FU-07 | plant-pot | 화분 | 1×1 | 바닥 | 토분·하양·파랑 |
| FU-08 | round-rug | 동그란 러그 | 3×3 | 바닥 깔개 (`layer: 'rug'`) | 주황·민트·분홍·파랑 |
| FU-09 | bookshelf | 책장 | 2×1 | 바닥 | |
| FU-10 | radio | 라디오 | 1×1 | 바닥 (협탁 위) | 민트·빨강·노랑 |
| FU-11 | sofa | 소파 | 2×1 | 바닥 | 주황·초록·파랑·분홍 |
| FU-12 | wardrobe | 옷장 | 2×1 | 바닥 | |
| FU-13 | wall-clock | 벽시계 | 1칸 | 벽 (바늘 `hourHand`·`minuteHand` = 게임 시각) | |
| FU-14 | fish-tank | 어항 | 1×1 | 바닥 (물 반투명) | |
| FU-15 | bug-case | 곤충 상자 | 1×1 | 바닥 (뚜껑도 유리 → 위에서 안이 보임) | |
| FU-16 | picture-frame | 액자 | 1칸 | 벽 | |
| FU-17 | villager-photo | 주민 사진 | 1×1 | 바닥 (협탁 위) | 코코·보리·모찌·두부·퐁·초롱 |
| FU-18 | shell-curtain | 조개 커튼 | 1칸 | 창문 | |
| FU-19 | fruit-chair | 과일 의자 | 1×1 | 바닥 | 사과·오렌지·배·복숭아·체리 |
| FU-20 | dino-model | 공룡 모형 | 2×2 | 바닥 | |

- 재질 이름은 sky·world 가 뜻을 두는 이름을 피했다: 모닥불 돌은 `stone` 대신 `rock`(비에 젖지 않게), 실내 창유리는 `window` 대신 `pane`. 스탠드 전구만 일부러 `glow` (밤에 켜지고 빛무리가 생긴다).
- 렌더를 보고 고친 것: 과일 의자(두 덩어리처럼 보임 → 과일 하나의 앞-위 4분의 1을 잘라내고 속살 면을 붙임, 씨가 눈처럼 보여 앉는 면 별 모양으로), 곤충 상자(풍뎅이가 가지와 같은 색으로 묻힘 → 색 나눔, 뚜껑을 유리로), 책장(기댄 책과 눕힌 책이 겹침).

## 실내 모드 — `time.setIndoor(bool)` (sky 에 추가)

```js
time.setIndoor(true)   // 집 안: 하늘 돔·별·구름·비·눈·무지개를 숨기고, 따뜻한 실내 조명, 안개 끔, 배경 = 방 밖 어둠(#2E2420)
time.setIndoor(false)  // 그대로 되돌린다
time.indoor            // 지금 상태
```
- 이벤트 `scene:indoor {on}` (바뀔 때 한 번).
- 시계·날씨·하루 리셋은 그대로 흐른다 (`weather:change` 도 계속 온다). 밖의 땅은 계속 젖고 마른다.
- 조명 값은 `src/sky/indoor.js` 의 `indoorLook(nightFactor)`: 낮엔 창으로 드는 하얀 빛(반구광 1.75·해 1.45), 밤엔 스탠드 같은 따뜻한 빛(1.35·1.1). 빛 방향은 천장 앞 왼쪽에서 거의 아래로 → 가구 그림자가 뒤 오른쪽으로 짧게.
- 안개는 객체를 없애지 않고 아주 멀리 민다 (`near 1e4`) — 없애면 모든 셰이더를 다시 만든다.
- 밤 조명(`glow`·`window`)은 실내에선 비와 상관없이 밤 정도만 따른다.

## 집 동작

- **들어가기**: 집 문 앞(문 칸, 북쪽을 봄)에서 행동 키 (우선순위 90) 또는 문 쪽으로 0.2초 밀기 → `sfx door` → 0.28초 어두워짐 → 방 문 매트 위에 북쪽을 보고 → `time.setIndoor(true)`, `audio.bgm('indoor')` (라디오를 켜 뒀으면 `'morning'`) → 0.42초 밝아짐.
- **나가기**: 문 매트 위에서 행동 키(90) 또는 아래로 밀기 → 집 문 앞에 남쪽을 보고, `setIndoor(false)`, `bgm('auto')`.
- **방**: `world.addZone` 으로 등록 (방 둘레 ±8칸). 바닥 높이 0, 러그 위 0.03, 발소리 `wood`. 벽 징두리만큼 안쪽 + 가구 발자국 상자(러그 제외)에서 멈춘다. 카메라는 `player.camera.setBounds` 로 방 가운데 둘레(가로 ±0.6, 깊이 0~1.4)에서만 따라다니고 `setCurveScale(0.3)` 으로 곡면 월드를 약하게 — 방 어디에 서도 방 전체가 보인다. 화면 전환은 `ui.fade`. (둘 다 없는 예전 모듈과 합쳐도 house 가 직접 한다.)
- **가구 놓기**: 방 안에서 앞에 아무것도 없을 때 행동 키 (우선순위 20) → `bag.open({mode:'pick', filter: 가구})` → 앞 칸 (정면이 플레이어를 봄). 막히면 옆으로 1~2칸, 한 칸 더 앞. 벽 가구는 벽을 보고 1.4칸 안에서 그 칸에(창문 자리 제외, 막히면 옆 칸), 조개 커튼은 바라보는 벽의 가까운 빈 창문에. 문 매트 두 칸은 비워 둔다.
- **가구 앞 행동 키 (80)**: 돌리기(제자리, 막히면 비킴) · 옮기기(앞을 따라다니다 행동 키로 내려놓기, F 그만두기 — 우선순위 120) · 색 바꾸기(변형이 있으면) · 라디오 · 어항/곤충 상자에 넣기·꺼내기 · 가방에 넣기(`data.collect`, 색이 있으면 `{ variant }` 로 — 다시 놓아도 그 색).
- **라디오**: 켜면 지금 시간대 곡(새벽·오전·오후·저녁·밤 = `dawn morning afternoon evening night`), '다른 곡 틀기' 로 채널을 넘기고, 끄면 실내 기본곡 `indoor`('작은 라디오' 분위기). 켜 둔 채널은 `state.house.radio` 에 남아 다음에 들어와도 그 곡.
- **어항·곤충 상자**: '물고기 넣기'·'곤충 넣기' → 가방에서 고른 물고기·곤충 하나가 들어간다(`rec.holds`). 안의 물고기·풍뎅이 색이 그 생물 id 로 정한 색으로 바뀌고, 말을 걸면 '붕어가 헤엄치고 있어요'. 꺼내기·가방에 넣기 하면 생물도 가방으로 (자리가 두 칸 있어야 한다). **F (pickup, 80)** = 바로 가방에. 러그는 러그 밖에서 바라볼 때만 (위에 서 있으면 행동 키 = 가구 놓기).
- **작업대** (서쪽 벽, 배경 모델 `workbench` 그대로): `ui.craft.open` 창 — 왼쪽 레시피 14개(✔ 또는 'n가지 모자람'), 오른쪽 고른 것의 큰 그림·재료 `나무 4/4`·만들기 버튼(모자라면 꺼짐). 만들기 = `data.recipes.craft(id)` (재료 빼기 + 결과물 가방에 넣기를 한 번에, 실패하면 그대로). 망치 소리 `axe-wood` ×3, 알림, `player.play('happy')`. 창을 닫을 때까지 여러 개 만들 수 있다. ui 에 `craft` 가 없으면 예전처럼 대화 선택지(5개씩) + 확인 창.
  결과물은 `recipes.craft` 가 이미 가방에 넣으므로 `data.collect` 를 또 부르지 않는다 (두 번 들어감). `collect` 는 가구를 가방에 넣을 때 쓴다.
- **처음 들어간 날**: 동그란 러그·스탠드·화분이 놓여 있다 (`STARTER`, `state.house.seeded`). 빼려면 `index.js` 의 `STARTER` 를 비우면 된다.
- **저장·이어하기**: 들어가고 나올 때, 가구를 바꿀 때 0.5~1.5초 뒤 `data.save.save()`. 집 안에서 끝냈으면 다시 불러올 때 집 안 그 자리(막혀 있으면 문 매트)에서 시작한다. 밖에서 끝냈으면 player 모듈이 그 자리(못 걷는 곳이면 선착장)에 세운다. 게임 중에 `save.load()`·`save.reset()` 으로 가구 목록이 새 배열로 바뀌면 다음 프레임에 방 모델을 다시 맞춘다.

### 상태 `state.house`
```js
{ furniture: [ { id: 'f3', item: 'furn.sofa', gx, gz, rot, variant? }      // 바닥: (gx,gz) = 돌린 발자국의 북서쪽 칸, rot 0 남·1 동·2 북·3 서 (정면 방향)
             | { id, item: 'furn.wall-clock', wall: 'n'|'w'|'e', slot, variant? } ],   // 벽: 북쪽 slot = gx, 서·동쪽 slot = gz
  inside: bool, seeded: bool, radio: bool, nextId: n }
```

### 서비스 `ctx.services.house` (계약 밖 덤)
`inside`, `furniture`, `enter()`, `leave()`, `place(item, spot?)` (가방과 상관없이 놓기 — 선물 연출 등), `remove(id)`, `workbench()`, `models()`, `room {x, z, w, d, x0, z0}`.
이벤트: `house:enter {}`, `house:leave {}`, `house:craft {id, result}`, `scene:indoor {on}`(sky).

## 제안 — 반영한 것과 남은 것

반영함 (위 표·`docs/CONTRACTS.md` 의 '2차 W3' 절): 1 실내 모드 계약 · 2 `ui.craft`·`ui.fade`·확인 창 `disabled`·줄바꿈 · 3 카메라 범위 · 4 레시피 재료 모양(ui 가 `needs` 를 읽음) · 5 가구 썸네일 아이콘 · 6 가방 칸 변형 · 7 테스트를 `tests/` 로 · 8 라디오는 전용 곡 대신 시간대 곡 채널로 (실내 기본곡 `indoor` 가 이미 '작은 라디오' 분위기라 T4 를 고치지 않았다).

다른 트랙에 남은 부탁:
- **W2 town**: 주민 사진을 줄 때 `data.collect('furn.villager-photo', 1, { variant: 주민slug })` 로 주면 사진에 그 주민 얼굴 색이 나온다 (스펙 변형 `coco bori mochi dubu pong chorong`). 보상 가구도 색을 정해 주고 싶으면 같은 `variant`.
- **T3 ui (선택)**: 가방 칸에 변형이 있으면 이름 옆에 색 이름을 보여 주기 (변형 이름표는 `assets/furniture/specs/<slug>.json` 의 `variants[v].label`). 지금은 썸네일이 기본 색이라 파란 소파도 가방에선 주황으로 보인다.

## 확인한 것 (`node dev-server.mjs --port=4193`, `/index.html`)

- 콘솔 오류 없음 (이 브랜치 혼자일 때 없는 `gather/`·`town/` 404 두 줄은 gameplay 로더가 건너뛰는 정상 동작).
- 문 앞 행동 키·문 쪽으로 밀기로 들어감, 문 매트 행동 키·아래로 밀기로 나옴 (밖은 문 칸, 남쪽을 봄). 실내에서 하늘·구름·비 숨김, 안개 끔, 밖으로 나오면 비 오는 밤 그대로 (`bgm` indoor ↔ auto→rain).
- 가방에서 골라 놓기(소파·벽시계·조개 커튼), 돌리기(플레이어 칸을 피해 비킴), 옮기기, 색 바꾸기(소파 초록), F 로 가방에 넣기(책장), 라디오 켜기(bgm morning). 벽 규칙: 커튼은 빈 창문에만, 벽시계를 창문 칸에 걸면 옆 칸, 서·동쪽 벽 걸기.
- 충돌: 침대·소파·작업대 가장자리에서 멈춤, 러그 위 높이 0.03.
- 작업대: 쪽 넘김, ✔/모자람 표시, 통나무 의자 만들기(나무 12 → 8, 가방에 의자), 나무 침대는 '단단한 나무 4개 더' 안내.
- 새로고침: 집 안에서 끝냄 → 집 안 같은 자리·가구 10개·가방 그대로 / 밖에서 끝냄 → 집 문 앞, 초록 소파 그대로.
- 벽시계 바늘이 게임 시각(오전 1:59, 오후 1:00, 오후 10:00)을 가리킴. 낮엔 창이 하늘색, 밤엔 남색.
- `node --test tests/` 97개 통과 (기존 86 + 칸 계산 7 + 가방 변형 4).
- 제안 반영 뒤(2026-10-29): 가방 '가구 놓기' 칸에 썸네일 그림, 파란 소파를 놓고 F 로 넣으면 가방 칸 `variant: 'blue'` → 다시 놓으면 파랑, 어항에 붕어 넣기·말 걸기('붕어가 헤엄치고 있어요')·새로고침 뒤에도 들어 있음, 라디오 켜기(새벽 2시 → 밤)·다른 곡(새벽)·끄기(indoor), 작업대 창에서 통나무 테이블 만들기(나무 20 → 12, 창은 열린 채 만들기 버튼에 포커스), 섬폰 레시피 앱에 '조개 아무거나 0/6' 같은 재료가 나옴, `ui.fade` 로 드나듦, 방 북서쪽 구석에 서도 방 전체가 보임.
- 미리보기 창이 숨겨져 rAF 가 멈춰 있어서, 걷기 확인은 `player.update`·`gameplay.update` 를 JS 로 직접 돌렸다.
- 스크린샷: 공유 노트 폴더 `w3-house-shots/` (가구 20종 모음, 첫 입장, 꾸민 방 밤·낮, 벽 가구, 작업대, 비 오는 밤 문 앞).

## 알려진 빈틈

- 어항·곤충 상자에 넣은 생물은 모양이 아니라 색으로만 구분된다 (물고기·곤충 모델이 없어서). 곤충 상자 안 모양은 늘 풍뎅이.
- 가방 썸네일은 기본 색 그림이라 색을 바꾼 가구도 가방에선 기본 색으로 보인다.
- 모닥불은 집 안에만 놓인다 (아이템의 '야외 가능' — 섬에 놓기는 world 쪽 `objects.add` 연결이 필요).
- 테이블 위에 작은 가구 올리기, 벽지·바닥 바꾸기, 방 넓히기, 2층 없음. 문 여닫는 동작 없음.
- 스탠드 빛무리는 sky 가 3초마다 장면을 훑을 때 생긴다 (놓은 뒤 최대 3초 늦게 켜짐). 실제 점광원은 없다 (빛 개수가 바뀌면 셰이더를 다시 만들어서).
- 가방에 가구가 없을 때 빈 바닥에서 행동 키를 누르면 '가방에 놓을 가구가 없어요' 알림이 뜬다 (도구 쓰기 10 보다 앞).
