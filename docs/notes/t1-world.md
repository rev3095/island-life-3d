# T1 섬 월드 · 플레이어 — 작업 노트 (`p1-world` 브랜치)

## 만든 것

| 파일 | 내용 |
|---|---|
| `src/world/island.js` | 섬 생성기 (three·DOM 없음, node 로도 돈다). 시드 → 타일 종류·높이·강·폭포·경사로·다리·선착장·광장·흙길·건물 자리·배경 물체 목록·장소. `createIslandApi` 가 조회 함수(`tileAt`, `heightAt`, `passable` …)를 붙인다 |
| `src/world/rng.js` | 시드 난수(mulberry32), 값 잡음, 섞기 |
| `src/world/kit.js` | 배경 모델 → '판'(재질을 꼭짓점 색으로 합친 툰·평면·외곽선 덩어리) → `InstancedMesh` 묶음. 잎·꽃 흔들림(sway)·흔들기(shake) 셰이더, 곡면 월드에 맞춘 화면 밖 판정 |
| `src/world/terrain.js` | 타일 InstancedMesh (종류 × 16×16 구역), 섬 밖 바다 판(얕은 곳·깊은 곳 꼭짓점 색), 바닷가 물거품, 폭포 |
| `src/world/objects.js` | 배경 물체 목록 `objects.query/add/remove/setVariant` + 저장 연결 + 계절 색 |
| `src/world/collision.js` | 원 충돌: 지형 칸(물·높이 다른 칸·경사로 옆)과 물체 충돌체(원·상자)에서 밀어내기 → 벽 따라 미끄러짐 |
| `src/world/index.js` | 모듈 입구. `ctx.services.world` 등록, `world:ready`, `?debug` 성능 표시(왼쪽 아래) |
| `src/player/index.js` | 플레이어: 걷기 2.6 / 달리기 5 칸/초, 부드러운 방향 전환, idle/walk/run 섞기, 높이 따라가기, 발소리, 도구 |
| `src/player/camera.js` | 동숲식 고정 각도 카메라: 감쇠 따라가기, 진행 방향 앞보기, 휠·두 손가락·`-`/`=` 확대, `uCurve` 조절 |
| `src/player/tools.js` | 도구 5종 간단 모델 (도형) |

## 섬 모양 (기본 시드 20261028)

- 64×56. 바다 테두리 3칸 이상 → 모래사장 고리(2~4칸) → 풀밭. 북쪽에 한 단 높은 언덕(가장자리는 절벽 타일), 남쪽 가장자리에 경사로 3곳.
- 강: 언덕 위 연못 → 폭포(언덕 남쪽 가장자리, 2칸 폭) → 북쪽 다리(28줄) → 남쪽 다리(42줄) → 남동쪽 바다.
- 광장(가운데 서쪽, 모닥불·안내판·벤치 2·가로등 4), 상점(동쪽), 박물관(언덕 위 북서쪽), 플레이어 집(남서쪽, 뒤뜰 울타리·튤립), 주민 집 6채(코코·보리 서쪽, 모찌·두부 남쪽, 퐁·초롱 동쪽, 지붕 색 = 주민 변형), 선착장(남쪽).
- 배경 물체 약 320개: 활엽수 78, 삼나무(언덕) ~21, 야자수 12, 과일나무 12(과수원 7), 바위 6, 꽃 ~80(무더기), 잡초 32, 조개 11, 꽃덤불 ~29, 울타리, 가로등 10, 우편함 7, 화석 자리 4, 다리 2, 선착장.
- 다른 시드 6개로 확인: 걸을 수 있는 칸이 모두 처음 자리에서 이어지고(갇힌 곳 0), 모든 건물 문에 갈 수 있다.

## 좌표·규칙

- 월드 원점 = 섬 가운데. `toWorld(tx, tz)` = 칸 가운데. 북쪽 = -Z, 타일 1칸 = 1.0.
- 높이: 언덕 1.0, 경사로는 아래칸 남쪽 끝 0 → 위칸 북쪽 끝 1 (직선), 다리는 아치(가운데 0.38), 선착장 0.385, 집·상점 앞 계단 0.12, 박물관 기단 0.45 (3단). 물 칸 `heightAt` = 물 윗면(-0.15, 언덕 위 연못 0.85).
- 통행: 같은 높이끼리만. 경사로는 위칸↔북쪽 언덕, 아래칸↔남쪽 땅으로만 (옆으로는 못 나간다). 다리·선착장 칸은 물 위지만 걸을 수 있다.
- `tileAt` 의 `'cliff'` = 언덕 가장자리 칸 (윗면은 걸을 수 있는 높이 1 땅). 경사로 `levelAt` 은 위칸 1, 아래칸 0.
- 물체 id = `'<종류>@<tx>,<tz>'` (같은 칸에 또 놓으면 `~2` …). 생성기가 만든 물체를 지우면 `state.island.removed` 에, 새로 놓으면 `state.island.added` 에, 변형을 바꾸면 `state.island.variants` 에 적힌다 → 불러오면 그대로 다시 놓인다.

## 서비스

계약(`docs/CONTRACTS.md`) 그대로 + 덤:

```js
world.island: { w, h, tileAt, levelAt, heightAt, isWalkable /* 물체 충돌체 포함 */, isWater, toTile, toWorld,
                passable(ax,az,bx,bz), rampAt(tx,tz), groundAt(x,z) → 'grass'|'sand'|'wood'|…, flagsAt }
world.objects: { query(x,z,r) → [{id,kind,x,z,y,tile,variant,data,dist}] (가까운 순), add, remove, setVariant,
                 get(id), at(tx,tz), list(kind), shake(id) /* 나무·덤불 흔들기 연출 */ }
world.places: { spawn{x,z,facing}, plaza, shop{x,z,door,tx,tz}, museum{…}, dock, playerHouse{…}, villagerHouses[{slug,x,z,door,tx,tz}],
                pond, waterfall, bridges[], ramps[], orchard }
world.setSeason(season)   // 같은 계절이면 아무것도 안 한다 (여러 번 불러도 됨)
world.season, world.nativeFruit
world.collide(fx,fz,nx,nz,r,y) → {x,z}     // 주민 배회(P3)도 같은 충돌을 쓰면 된다
world.spawnTiles(kind)  → [{tx,tz,x,z,level}] // 조개(물가 모래)·잡초/화석/꽃(빈 풀밭) 후보 칸
world.setOutlineVisible(bool)

player: { position, facing, tool, setTool, play, freeze, tileInFront, pointInFront,
          speed, frozen, teleport(x,z,facing?), face(x,z), camera{zoom,setZoom,snap}, toolKeys }
```

이벤트: `world:ready {island}`, `world:season {season}`, `world:object {type:'add'|'remove', id, kind}`, `player:moved`, `player:tool`,
`sfx {name:'step-grass'|'step-sand'|'step-wood', ground, volume}` (걷기 한 주기에 두 번, 달리면 volume 1).

## 계약 제안 (합칠 때 `docs/CONTRACTS.md` 에 반영 부탁)

1. **`facing` 은 three 의 `rotation.y` 와 같은 뜻**으로 적어 주세요: 0 = 북쪽(-Z), +π/2 = 서쪽(-X), -π/2 = 동쪽. T3(지도)가 이렇게 읽는다고 해서 맞췄다. 모델(정면 +Z)은 `rotation.y = facing + π`.
2. **도구 숫자키(tool1~5, toolPrev/Next/None)는 지금 player 가 처리**한다 (가방 검사 없이 바로 든다). 2차 gameplay 가 가방에 있는 도구만 들게 하려면 `player.toolKeys = false` 로 끄고 직접 `setTool` 을 부르면 된다. UI 창이 열려 있으면(`input.enabled` false / `ui.isBlocking()`) 무시한다.
3. **상태 칸 추가**: `state.island.variants` (`{ 물체id: 변형 }`, 생성기 물체의 변형 바꾸기 기록). `added` 행 모양은 `{ id, kind, tx, tz, data:{rot, scale, variant, …} }`, `removed` 는 id 목록.
4. **재질 이름 약속 (T5 와 맞춤)**: 배경은 재질을 합쳐 그리지만 `glow`·`window`·`flame` 은 따로 같은 이름으로 남기고, 합친 땅 타일(풀·모래·길·광장·절벽·경사로) 재질 이름은 `'ground'` 로 둔다 → sky 의 밤 조명·빛무리·젖은 땅이 그대로 붙는다 (합친 상태에서 확인함: 가로등 10 + 모닥불 = 빛무리 11).
5. **특산 과일**: world 는 `data.economy.nativeFruit()` 가 있으면 그 과일(`item.variant`)로 과일나무를 칠한다. 없으면 자기 시드로 고른다 → data 가 있는 한 둘이 같다 (합쳐서 확인: `fruit.apple` = 사과).
6. **하루 리셋 연결 (2차)**: `data:newday` 를 받으면 world 가 `spawnTiles('shell'|'weed'|'fossil-spot')` 후보를 `data.day.pickSpots(후보, n, salt)` 에 넣어 오늘 자리를 고르고 `objects.add/remove` 로 바꾸면 된다. 지금은 생성기가 처음 자리만 놓는다.
7. **과일나무 '열매 딴' 모습**: `objects.setVariant(id, 'picked')` 를 쓰면 열매 재질을 뺀 모습이 된다 (스펙에 없는 가짜 변형). 다시 `setVariant(id, null)` 로 돌아온다.
8. **그림자 품질 설정 (core 제안)**: Intel UHD(0xA788)·1536×1152 에서 GPU 4.9~11.7ms 중 그림자 그리기·받기가 약 5ms (그림자 끄면 9.2 → 3.2ms). 더 약한 노트북을 위해 `main.js` 에 품질 단계(그림자 1024 / `PCFShadowMap`, 휴대폰 DPR 1.5 제한)를 두면 좋겠다. world 는 이미 작은 물체(꽃·잡초·조개·화석 자리)·평평한 땅은 그림자를 드리우지 않게 했다.

## 확인한 것 (로컬 `node dev-server.mjs --port=4181`, `/index.html?debug`)

- 콘솔 오류 없음 (이 브랜치 혼자일 때 없는 모듈 data·sky·ui·audio·gameplay 404 는 main.js 가 건너뛰는 정상 동작).
- 키보드 이동(WASD/방향키/Shift), 선착장 끝·옆에서 멈춤, 강둑에서 멈추고 둑 따라 미끄러짐, 다리 건너기(아치 높이), 다리 난간, 절벽 밑·언덕 가장자리에서 멈춤, 경사로 오르기(0 → 1), 경사로 옆으로 못 나감, 집 앞 계단, 나무 줄기 충돌, `player:moved`, 발소리 3종, `freeze`, `play('happy')`, 도구 바꾸기·`player:tool`, `objects.*` 와 저장 칸, 계절 4개 바꾸기 (겨울은 화면으로 확인, 같은 계절을 또 부르면 무시).
- 성능 (Intel UHD 0xA788, 1536×1152, 그림자 2048 PCFSoft): GPU 4.9~11.7ms/프레임 (선착장에서 섬 전체를 바라볼 때가 가장 무거움), 그리기 호출 94~293, 삼각형 0.7~2.2M(그림자 패스 포함). 실제 창에서 잠깐 잰 fps 94~96.
- 다섯 트랙을 임시 작업 트리에서 합쳐(커밋 안 함) 돌려 봄: data·sky·world·player·ui 가 오류 없이 함께 뜨고, 밤 가로등·빛무리·젖은 땅·HUD 가 겹쳐 잘 보였다.
- 스크린샷: 공유 노트 폴더의 `t1-world-shots/` (01 섬 전체 · 02 선착장 · 03 강·다리·폭포 · 04 북쪽 바닷가 지평선 · 05 박물관·경사로 · 06 겨울 광장 · 07 잠자리채 · 08 강어귀 물거품 · 09 가을 광장 · 10 다섯 트랙 합친 비 오는 밤).

## 알려진 빈틈

- 바닷가 윤곽이 타일 계단 모양이다 (둥근 해안선·모래 비탈 없음).
- 카메라와 플레이어 사이 나무가 플레이어를 가린다 (투명 처리 없음).
- 기본 확대(0.15)에서는 섬 한가운데에서 화면 위쪽이 땅·나무로 차서 하늘이 잘 안 보인다. 가까이(휠 위로)·바닷가에서는 휘어진 지평선과 하늘 띠가 보인다.
- 바다는 판 하나 + 물거품 띠뿐 (파도·물결 움직임 없음), 강도 흐름 연출 없음.
- 도구는 도형으로 만든 임시 모델이고 휘두르는 동작은 없다 (P2).
- 매일 조개·잡초·화석 다시 놓기는 2차 (`data:newday` 연결).
- 이 세션에서는 미리보기 창이 숨겨져 있어서 화면 루프를 JS 로 직접 돌려 확인했다 (fps 는 GPU 타이머·잠깐 보인 실제 창 값).
