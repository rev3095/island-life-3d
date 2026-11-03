# p12-interiors — 장소마다 들어가는 실내 · 문 드나들기 동작 (브랜치 `p12-interiors`)

실내 검수 보드: https://claude.ai/artifact/8w5fbrjNthoTgkCMqHURDh (`concept/interiors-board.html`, 보드 id `interiors`, 결정 **D67–D73**).
사용자 요청: "각 집, 박물관, 가게 등 장소마다 들어갈 수 있게 실제 공간 구현 · space 로 문 열고 들어가는 모션 · fade in/out 애니메이션·모션 포함".

## 반영 v1 (임시, 2026-11-04) — 보드 추천안 모두 A

사용자 선택을 기다리지 않고 추천안으로 먼저 만들었다. 보드에서 다르게 고르면 "검수 보드 반영" 때 아래 「다르게 고르면」대로 고친다.

| 결정 | 반영 v1 | 고칠 곳 |
|---|---|---|
| D67 문 여는 동작 | **A** 문이 안으로 열리고 걸어 들어감 (나올 때 걸어 나와 문이 닫힘) | `door.js` `DOOR_STYLE.motion = 'walk'` |
| D68 화면 전환 모양 | **A** 플레이어 머리 둘레로 좁아지는 원 (색은 예전 밤색 #2E2420) | `door.js` `DOOR_STYLE.fade = 'circle'`, `color` |
| D69 상점 실내 | **A** 10×7, 안쪽 계산대 + 왼쪽 진열 받침 둘(오늘의 가구) + 오른쪽 도구·꽃씨·묘목 | `assets/interior/places/shop.json` (RM-08) |
| D70 박물관 실내 | **A** 12×8 한 홀: 왼쪽 긴 수조(물고기) · 가운데 받침 8 + 공룡 모형(화석) · 오른쪽 유리 상자(곤충), 입구 앞 안내대 | `assets/interior/places/museum.json` (RM-09) |
| D71 기증품 보이기 | **A** 기증한 것만 아이템 모델(손에 드는 모델과 같은 `assets/items`)로, 빈 자리는 비워 둠 | `places.js` `exhibitJobs` · `placedata.js` `exhibitPlan` |
| D72 주인 자리 | **A** 영업시간엔 계산대·안내대 뒤 (밖 문 옆엔 첫날 안내·축하 때만) | `town/keepers.js` (mode `'desk'`) |
| D73 실내에서 창 | **A** 계산대·안내대 앞에서 Space → 지금 인사·고르기 → 창 | `town/keepers.js` `town:shop`·`town:museum` |

## 한 것

| 무엇 | 내용 |
|---|---|
| 공용 문 전환 `src/gameplay/house/door.js` (새) | `through({ dir, place, kind, variant, room, arrive })`. 들어갈 때: 문 쪽으로 돌기 + 문 소리 → 문짝이 경첩 쪽으로 접히며 안으로 열림(0.32초) → 문간까지 걸음(멀면 0.85초 안에 닿게 빨리) → 문간에 닿을 즈음 원이 닫힘(0.36초) → 실내로 → 원이 열리며(0.44초) 문 매트에서 한 걸음. 나올 때: 문 매트에서 화면 앞으로 걸어 나감 → 원 → 섬의 문간(문은 열린 채) → 원이 열리며 문 밖으로 두 걸음 → 문 닫힘(작은 문 소리). 지나가는 동안 행동 키를 삼키고(`house-door-busy` 300) 가림 투명을 끈다 (문간에 서면 건물이 통째로 비쳐 보여서) |
| 문짝 (AN-06) | 섬 건물은 묶음(InstancedMesh)이라 진짜 문을 못 움직인다 → 건물 모델의 `door` 재질 부분 크기(박물관은 위 반달까지)대로 어두운 문간 상자 + 같은 색 문짝(+문고리)을 덧씌우고, 가로로 줄이며 어둡게 해서 안으로 열리는 것처럼 보인다. 주민 집은 주민 색 변형(`world.palette`) 그대로 |
| 연출 걷기 (AN-07) `player.walkTo` | `src/player/index.js` 에 작은 API 하나 (충돌 없이 곧장, 걷기 동작·발소리 그대로). 카메라(`camera.js`)는 고치지 않았다 |
| 원형 전환 (UI-12) | `ui.fade(on, sec, color, { shape: 'circle', at })` — 구멍 하나에 큰 그림자를 두르고 크기를 CSS 로 줄였다 늘린다 (`src/ui/index.js` · `ui.css`). 흔들림 줄이기면 원 없이 전체 페이드(이때도 막은 서서히, 걷기·문 동작 없음) |
| 내 집 · 주민 집 | `house/index.js` `enter`/`leave`, `visit.js` `enter`/`leave` 가 `through()` 를 쓴다. 방·가구·저장은 그대로. 나올 때 카메라 범위를 먼저 풀고 순간이동 (안 그러면 원 가운데가 한 프레임 어긋났다) |
| 상점·박물관 실내 `src/gameplay/house/places.js` (새) | 방 짓기(크기를 받게 바꾼 `room.js` `buildRoom`), `world.addZone` 바닥·벽·가구 충돌, 가구(지금 모델, 없으면 FU-35 임시 상자), 긴 수조·유리 상자, 오늘의 물건 진열, 기증품 전시(창에서 기증하면 바로), 문 매트 나가기(Space · 아래로 밀기), 문 쪽으로 밀어 들어가기(`town.placeRule` 이 open 일 때만), 실내에서 저장 → 다시 열면 그 안에서 이어 하기(`state.house.place`) |
| 규칙 `src/gameplay/house/placedata.js` (새, node 로 돈다) | 배치 검사 `checkPlace`(가구 겹침·문 매트·창 자리·계산대·주인·말 거는 자리·케이스·문 매트에서 계산대까지 길), 전시 자리 `exhibitPlan`, 진열 `stockPlan` |
| 주인 (`town/keepers.js`) | 밤톨·느루 mode `'desk'`(계산대 뒤), 문 앞 행동 키 = 들어가기, 계산대 앞 = 인사·창. 첫날 축하는 문 앞에서 누르면 밤톨이 문 밖으로 나왔다가, 플레이어가 7칸 넘게 멀어지거나 어디 들어가면 다시 들어간다. 상점 안에 있는 동안은 문 닫을 시간이 지나도 판다. 실내가 없는 게임(house 없음)이면 예전 그대로 |
| 첫날 안내 (`intro/index.js` 한 줄) | 실내(집·주민 방·상점·박물관) 안에서는 섬 방향 화살표("⬅ 566칸")를 숨긴다 |
| 계산대 높이 | 부엌 조리대(FU-29) 모델이 1.17m 라 키 0.8 인 밤톨·느루가 가려졌다 → 배치 `scale: [1, 0.6, 1]` |
| QA 봇 | `skills.js` `sk.enterPlace`·`sk.leavePlace` (문 → 실내 → 계산대 앞 → 창 → 문 매트), `bot.exitRoom` 이 `house.doormat()` 을 본다, `bot.settle` 이 문 드나드는 동안을 기다린다. 처음 들어갈 때 실내 사진 `interior-shop`·`interior-museum` |
| 테스트 `tests/places.test.mjs` (새, 11개) | 배치 파일·검사(맞는 것·틀린 것), 전시 50자리, 진열, 길, door.js 규칙(문짝 모양·걸음 시간·2초 안), 건물 모델 4종의 `door` 재질·크기, 행동 키 글자, 웹 빌드 포함, 저장 왕복·예전 저장 |
| 문서 | `docs/CONTRACTS.md` 「실내 검수 보드 interiors」 절, `concept/README.md` 보드·ID 표, `CLAUDE.md` 실내 한 줄 |

## 확인

- `node --test tests/` — 343개 통과 (새 11개 포함).
- 미리보기(dev-server 4252, `?debug`)에서 실제 키(Space)·마우스(땅 누르기·화면 'Space 나가기' 단추)로: 상점 들어가기 → 계산대에서 사기 창 → 문 매트로 나가기 · 박물관 들어가기(수조·받침·곤충 상자에 기증품) → 안내대에서 기증 창 → 나가기(원형 전환 단계별 화면) · 내 집 들고 나기 · 모찌네(비 오는 날) 들고 나기. 문짝이 열리는 모습은 확인용으로만 콘솔에서 `TIMING` 을 4배 늘려 찍었다. 흔들림 줄이기 켬 → 원 없이 0.8초 페이드. 상점 안에서 저장 → 새로고침 → 상점 안에서 이어 하기. 콘솔 오류 0.
- 자동 플레이: `node tools/playtest.mjs --only=boot,…,fd-sell,fd-donate,fd-home,buy-tools,evening-bugs` — 12단계 통과 · 봇이 찾은 문제 0 · 콘솔 오류 0 (상점·박물관을 새 실내 흐름으로 들어가 팔기·기증·사기·나오기).
- 전체 자동 플레이 (개발판, 엔딩까지, 실제 358초): 25단계 — 통과 21 · 어색함 2 · 막힘 1 · 건너뜀 1(해마다 축제, 옵션) · 콘솔 오류 0 · 봇이 찾은 문제 1(다듬기: 박물관 문 앞에 주민이 서 있으면 말 걸기로 감 — QA-17 그대로). 상점·박물관을 쓰는 단계(첫날 팔기·기증, 도구 사기, 저녁 기증, 꾸미기용 팔기, 부품 모으기 중 팔기)는 모두 실내로 들어가 계산대에서 처리하고 문 매트로 나왔다 (`shopInside: { inside: true, left: true }`). 어색함·막힘은 이번 작업과 무관한 기존 것: 집 꾸미기 = QA-10(첫날 도토리 50 남아 벽지 못 삼), 주민 방 구경 = QA-18(맑은 날 집에 주민 없음), 생일 막힘 = 시나리오가 "새 게임 = 10-30"을 가정해 오늘(11-04) 시작하면 두부 생일(11-03)이 이미 지남 — QA 시나리오 날짜 갱신은 QA 세션 몫.
- 사진: 공유 노트 폴더 `p12-interiors-shots/` (봇 실내 사진).

## 다르게 고르면 (검수 보드 반영 때)

- **D67-B** 열리고 바로 전환: `DOOR_STYLE.motion = 'open'` (걷기만 빠진다, 이미 들어 있음). **D67-C** 페이드만: `'none'`.
- **D68-B** 전체 밤색: `DOOR_STYLE.fade = 'plain'`. **D68-C** 크림색: `fade = 'plain'`, `color = '#FFF3DC'`.
- **D69-B·C** 상점 모양: `shop.json` 의 `size`·`furniture`·`stock`·`keeper`·`talk` 만 고치면 된다 (`checkPlace` 가 검사). C(8×6)는 `size: [8, 6]`.
- **D70-B** 방 셋: 지금 places.js 는 장소 하나 = 방 하나라, 방 사이 문(실내 → 실내)을 새로 만들어야 한다 (`through()` 를 실내 문에도 쓰게 — 가장 일이 많음). **D70-C** 섞기: `museum.json` `cases`·`fossils` 자리만.
- **D71-B** 이름표: `exhibitPlan` 은 이미 모든 자리(기증 안 한 것 포함)를 준다 → 빈 자리에 이름 판(글자 텍스처)만 더한다. **D71-C** 숫자판: 북쪽 벽에 판 하나.
- **D72-B** 밖에서도 맞이: `keepers.js` 에서 `'desk'` 대신 문 옆 `'stand'` 로 두고, `place:enter` 때 계산대로 옮겼다가 `place:leave` 때 문 옆으로.
- **D73-B** 먼저 말 걸기: `place:enter` 를 받아 `town.conversation(B, shopFlow)`. **D73-C** 진열대마다 사기: places.js 진열 자리마다 행동 키(80) → `ui.confirm` 값 확인 → `economy.buy` (새 처리기).

## 남은 것 · 제안 (이 브랜치에서 안 함)

- **main 합치기 · 게임 링크 다시 게시**는 확인 뒤 조정 세션이 한다. 편집기 홈 목록(`editors.html` 의 `editors-list`, group `board`)에 보드를 더하고 홈 `status/interiors` 를 쓰는 것도 조정 세션에 부탁 (하늘 보드와 같은 자리를 고치고 있어서 여기서는 안 건드림).
- **배경 편집기 「방 배치」 탭**은 8×8 주민 방만 안다 → 상점·박물관(RM-08·09, `assets/interior/places/`)은 아직 편집기에서 못 고친다. 고치려면 탭이 `size`·`cases`·`stock` 을 읽게 (M6-P2 노트 순서대로) — 따로 할 일.
- **FU-35 진열 받침 · FU-36 계산대**는 v1 임시(색 상자 · 부엌 조리대 0.6배). 보드 의견이나 배경 편집기 「가구」 요청으로 Blender 모델을 만들면 방 배치의 `fu`/`item` 만 바꾸면 된다. 긴 수조·곤충 유리 상자도 지금은 코드로 만든 반투명 상자.
- 상점 실내에 "오늘의 벽지·바닥" 견본을 거는 자리는 아직 없다 (창에서만).
- 카메라: `camera.js` 는 고치지 않았다. 넓은 방(상점 10×7 · 박물관 12×8)은 `cameraBox(origin, w, d)` 로 카메라 중심 범위만 넓혔다 (8×8 방 값은 그대로). 시점 조작 세션(`p12-camera`)이 실내에서 오른쪽 버튼 올려다보기를 막거나 줄일지 정하면 좋겠다 — 실내는 하늘이 없다.
- `player.walkTo` 를 `src/player/index.js` 에 더했다 (`p12-camera` 가 `camera.js` 를 고치는 중이라 그 파일은 안 건드림). 합칠 때 `player/index.js` 의 `update` 이동 부분이 부딪히면 이 노트의 「연출 걷기」만 다시 얹으면 된다.
