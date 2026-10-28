# W1 P2 채집 연결 — 작업 노트 (`p2-gather` 브랜치)

규칙(무엇이 나오나·하루 몇 번·가방·도감)은 `ctx.services.data` 를 그대로 쓰고, 이 트랙은 섬 위에서 보이고 움직이게 만든다.
확인: `node dev-server.mjs --port=4191` → `/index.html?debug`.

## 만든 것

| 파일 | 내용 |
|---|---|
| `src/gameplay/gather/index.js` | 모듈 입구. 행동 키 처리기 4개 등록, 하위 기능 묶기, `ctx.services.gather`(확인용) |
| `gather/toolbelt.js` | 도구 들기: `player.toolKeys = false` 로 숫자키·Q/E·0 을 받아 **가방에 있는 도구만** 든다. 첫 시작 지급(`state.flags.gatherStarterTools`), `inventory.useTool` 내구도, 부서지면 알림 |
| `gather/pickup.js` | 줍기 (F): 떨어진 물건 · 조개(`harvest.pickShell`) · 잡초(`harvest.pullWeed`) |
| `gather/drops.js` | 땅에 떨어진 물건 (떨어지는 연출, `state.island.drops` 에 저장) |
| `gather/trees.js` | 맨손 나무 흔들기 (`harvest.shakeTree`) → 열매 5개(야자 2개)·나뭇가지·도토리 주머니·가구 선물, `picked` 모습, **벌떼** |
| `gather/fishing.js` | 물고기 그림자(서식지별), 찌·낚싯줄, 입질 1~3번 → 덥석 → 짧은 순간에 Space |
| `gather/bugs.js` · `bugmodels.js` | 곤충 나오기(장소·시각·달·날씨), 날기·앉기·뛰기·물 위 미끄러지기, 달려오면 도망, 잠자리채로 잡기. 곤충 20종 + 꿀벌 도형 모델 |
| `gather/work.js` | 삽(화석 자리 → `digFossil`, 구덩이·메우기), 도끼(바위 `hitRock` · 나무 `chopTree`, 나무는 안 베임), 물뿌리개(꽃 반짝) |
| `gather/results.js` | `data.collect` → 알림 "○○을(를) 잡았다!" (받침 따라 을/를), 머리 위로 들어 보이기 + `happy`, 가방이 차면 안내 |
| `gather/meshes.js` · `fx.js` · `util.js` | 떨어진 물건·물고기·찌·그림자·구덩이 모델(꼭짓점 색 합친 툰 메시 + 외곽선), 물 튀김·흙먼지·부스러기·반짝임, 도우미 |
| `src/player/motions.js` | **절차적 도구 동작**: swing · cast(→ 'fish' 자세) · reel · dig · chop · water · shake · pickup · ouch |
| `src/player/index.js` · `tools.js` | `act/hold/acting/toolModel/toolTip/headTop` 추가, 도구 끝 표시(`userData.tip`)·쥐는 각도(`GRIP`), 저장된 도구로 시작할 때 오류 고침 |
| `src/world/daily.js` | 매일 다시 놓기: 조개·잡초·화석 자리 (`spawnTiles` → `day.pickSpots`), 열매 다시 열기 |
| `src/world/objects.js` | 야자수 `picked` 변형 (열매 재질 빼기) |

모든 메시는 `ctx.materials.toonMaterial` / `outlineMaterial` (곡면 월드·외곽선, `userData.outline = true`) 를 쓴다. 날개만 `side = DoubleSide`, 물고기 그림자·물결만 투명.

## 행동 키 (gameplay 디스패처)

| 이름 | 키 | 우선순위 | 대상 |
|---|---|---|---|
| `gather-busy` | 둘 다 | **200** | 동작 중·기뻐하는 중·낚시 중이면 여기서 받는다 (낚시 중 Space = 당기기, 그 밖엔 무시). 낚시 중에 주민 말 걸기(100)가 끼지 않게 |
| `gather-shake` | action | 60 | 맨손 + 앞(0.55)에 나무(tree·fruit-tree·palm·cedar) |
| `gather-pickup` | pickup | 50 | 발밑·앞 1.05 안의 떨어진 물건·조개·잡초 중 앞에 가장 가까운 것 |
| `gather-tool` | action | 10 | 든 도구가 있으면 그 도구 쓰기 |

## 정한 것

- **도구 내구도**: 낚싯대·잠자리채는 잡았을 때만, 삽은 땅을 팔 때마다, 도끼는 바위·나무를 칠 때마다, 물뿌리개는 쓸 때마다 1. 허공에 휘두르면 안 깎인다.
- **낚시**: 그림자는 플레이어 3.5~13칸 안 물(최대 7, 저사양 5), 19칸 밖이면 사라진다. 서식지 = 바다 `sea`, 선착장 둘레 `pier`, 언덕 위 연못 둘레 `pond`(나머지 언덕 물은 `river`), 바다에서 3칸 안 강물 `mouth`, 그 밖 강 `river`. 크기 = 아이템 `shadow`(1~6).
  찌에서 3.4 안의 같은 물줄기 그림자가 다가와 입질 1~3번(0.8~1.6초 간격) → 덥석 → **0.75 − 그림자×0.03 초** 안에 Space. 입질 중에 당기면 "너무 일찍", 늦으면 "놓쳐 버렸다". 움직이려 하면 걷어 올린다. 같은 높이의 물에만 던진다(언덕 밑에서 연못으로 못 던짐).
- **곤충**: 1.1초마다 한 번, 4.5~14칸 안에 장소를 골라 `spawns.bug({place})` (꽃 3 · 나무 2 · 풀밭 2 · 물가 1.4 · 공중 1.2 · 바위 0.8 · 야자 0.6 · 밤엔 가로등 2 · 떨어진 과일 1). 최대 7(저사양 5). 달리며(3.6 칸/초 이상) 3칸 안, 또는 0.5칸 안이면 도망. 잠자리채는 앞 0.85 지점 0.72 안·높이 2.1 아래를 잡고, 빗나가면 2.4 안 곤충이 놀란다.
- **벌떼**: 벌집이 떨어지고 0.55초 뒤 벌 5마리가 3.2칸/초로 11초 동안 쫓는다(걷기 2.6 < 벌 < 달리기 5). 0.42 안으로 붙으면 쏘인다('ouch' 동작). 잠자리채로 쓸면 꿀벌.
- **떨어진 물건**: 나무 둘레 0.5~0.95(플레이어 쪽 먼저), 바위 0.65~1.05. 놓을 자리가 없으면 바로 가방으로. 가방이 차면 줍지 않고 "가방이 꽉 찼어요!"(물건은 그대로). 잡은 물고기·곤충은 도감에 기록되고 "가방이 꽉 차서 놓아주었다…".
- **매일 다시 놓기 (world)**: 처음 한 번 생성기가 놓은 조개·잡초·화석 자리는 지우고(`removed`) 하루 규칙으로 놓는다. 새 날: 조개·화석 자리는 새로, 안 뽑은 잡초는 남기고 모자란 만큼 더(`harvest.today()` 수). 같은 날 다시 불러오면 적어 둔 자리 그대로. 과일나무·야자수는 `fruitReady` 로 `picked`/원래 모습.
- **동작 중에는** 움직이지 않는다(`act` 가 이동을 막음). 잡았을 때 1.5초, 쏘였을 때 1초 `freeze`.

## 상태·이벤트·서비스 추가 (계약 제안)

1. **상태 칸** (`state.island` 은 world·data 공용 — world/gather 가 쓰는 칸으로 적어 주세요)
   - `state.island.spots = { dayKey, shell:['tx,tz'], weed:[...], 'fossil-spot':[...], holes:['tx,tz'] }` — 오늘 놓은 자리 (world.daily)
   - `state.island.drops = [{ item, count, x, z, rot }]` — 땅에 떨어진 물건 (gather)
   - `state.island.watered = { dayKey, ids:[물체id] }` — 오늘 물 준 꽃 (gather, 꽃 교배 때 쓸 수 있게)
   - `state.flags.gatherStarterTools` — 첫 시작 도구 지급 했음
2. **player 추가**: `act(name, { onHit, speed, lock }) → Promise<bool>`, `hold('fish'|null)`, `acting`, `toolModel()`, `toolTip(out)`, `headTop(out)`. 주민·가구 트랙도 `act('pickup')` 같은 동작을 그대로 쓸 수 있다.
3. **world 추가**: `world.daily = { layout(), spotOf(id), take(id), holes(), addHole(tx,tz), removeHole(tx,tz) }`, 이벤트 `world:daily {dayKey, shells, weeds, fossils}` (오늘 자리를 놓은 뒤).
4. **이벤트** `gather:watered {ids}` — 물 준 꽃 (꽃 교배 규칙이 생기면 data 가 들으면 된다).
5. `ctx.services.gather` 는 확인용(계약 밖): `drops`, `bugs`, `fishing`, `trees.bees`, `habitatAt(x,z)`, `spawnBug(id, place)`.
6. **data 에게**: 꽃 교배(물뿌리개), 화석 감정(지금은 파면 바로 종류가 나옴) 규칙이 생기면 `gather:watered`·`state.island.watered` 를 쓰면 된다.
7. **W4 셰이더 트랙에게**: gather 메시는 `toonMaterial` 에 `vertexColors = true` 를 켠 공용 재질 2개(`gather`, `gather-flat`)와 `outlineMaterial(0.0035~0.005)` 를 쓴다. 투명: `fishShadow`(opacity 0.42, depthWrite false), `fx-ring`. 낚싯줄은 `THREE.Line` + `toonMaterial(flat)`. 셰이더를 바꿀 때 꼭짓점 색·Line 이 그대로 되는지 봐 주세요.

## 고친 것 (T1 코드)

- `player.init` 에서 저장된 도구가 있으면 `const TOOLS` 선언 전에 `setTool` 을 불러 **플레이어 모듈이 통째로 실패**했다 (도구를 든 채 저장하면 다음 실행부터 섬에 플레이어가 없음). 선언을 위로 올림.

## 확인한 것

- 키보드(`keydown` 이벤트 Space·F·1~5·Q·E·0·WASD·Shift) + 숨은 창이라 모듈 `update` 를 직접 돌려서 확인: 나무 흔들기→사과 5개·`picked`, 줍기(사과·조개·잡초, 받침 조사), 삽(화석·구덩이·메우기), 도끼(바위 6번 뒤 끝, 나무 3번·안 베임), 물뿌리개(반짝·하루 기록), 낚시(잡기·늦음·너무 일찍·움직이면 걷기), 잠자리채(잡기·빗나가면 놀람·달려오면 도망), 벌떼(쏘임·잡기), 가방 꽉 참, 도구 부서짐(HUD 맨손), Q/E 가 없는 도구 건너뜀, 저장→새로고침 뒤 떨어진 물건·구덩이·물 준 꽃·오늘 자리·딴 나무 그대로, 사흘 뒤로 시계를 돌려 새 날(조개 8·화석 4·잡초 7+10·과일 다시 열림).
- 콘솔 오류 없음 (town·house 폴더가 없어 나는 404 2줄은 정상).
- 비용 (800×600, 곤충 7·그림자 7·떨어진 물건 20): 그리기 0.58 → 0.72ms (`render + gl.finish`), 그리기 호출 153 → 184, gather 의 `update` 0.01ms 아래.
- `node --test tests/` 86개 통과.
- 스크린샷: 공유 노트 폴더 `w1-gather-shots/`.

## 알려진 빈틈

- 꽃 교배·나무 심기·화석 감정은 없다 (물뿌리개는 반짝까지).
- 낚시에 '물고기가 당긴다' 같은 줄 당김 미니게임은 없다 (입질 → 덥석 → 타이밍 한 번).
- 곤충은 바위를 들추거나(쥐며느리) 나무를 흔들어 떨어뜨리는 연출 없이 그냥 그 자리에 나온다. 반딧불이 빛은 몸 색만 깜빡인다(빛무리 없음).
- 잡은 물고기·곤충을 '들어 보이는' 모델은 도형이고, 물고기 몸 색은 종마다 한 가지.
- 나무 흔들기 잎 부스러기 색은 계절과 상관없이 초록.
- 떨어진 물건은 사라지지 않고 계속 쌓인다 (동숲처럼). 많이 쌓이면 그리기 호출이 늘어난다 (물건 하나에 2번).
- 휴대폰: B(줍기)·A(행동)로 다 되지만 화면에서 직접 해 보지는 않았다.
