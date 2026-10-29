# Y2 채집 콘텐츠 — 작업 노트 (`p7-content` 브랜치, 4차)

화석 감정, 큰 물고기 줄다리기, 곤충 들추기(바위·나무), 잡은 물고기 종별 색. 새 그림·모델 파일 없이 코드 도형·꼭짓점 색만 썼다.
확인: `node dev-server.mjs --port=4202` → `/index.html?debug`.

## 만든 것

| 파일 | 내용 |
|---|---|
| `src/data/items.js` | `fossil.unknown` '알 수 없는 화석' (카테고리 fossil, `unknown: true`, 값 200, `list('fossil')`·박물관·도감에서 빠짐, `items.UNKNOWN_FOSSIL`). 새 곤충 `bug.caterpillar` 송충이(나무 흔들기)·`bug.earwig` 집게벌레(바위 밑) → 곤충 22종. 쥐며느리 장소 '바위 밑' → place `under`. 물고기마다 `colors: { body, back, belly, fin }` |
| `src/data/museum.js` | `unknown` 아이템은 `canDonate`·`donate`·`record` 모두 거절 |
| `src/data/spawns.js` | `FOSSIL_UNKNOWN`, `appraise(rng)`, `shakeBugPool()`, `underRockPool()`, `rockBug(rng, opts)`, `SHAKE_BUG_CHANCE`·`ROCK_BUG_CHANCE`, `treeShake` 에 `event: 'bug'` (opts 에 `month`·`weather`), `BUG_PLACES` 에 `under` |
| `src/data/harvest.js` | `digFossil` → `'fossil.unknown'`, `appraise(rng?)`, `rockBug(rockId, { hour, month, weather, rng })` (바위 하나에 하루 한 번, `state.island.daily.rockBugs`) |
| `gather/tug.js` | 줄다리기 순수 규칙 (`needsTug`, `pullsFor`, `createTug`, `tugStep`, `tugPress`, `TUG` 표) |
| `gather/fishing.js` | 덥석 뒤 그림자 5~6 이면 `bob.state = 'tug'`: 몸부림·찌 잠김/떠오름·물결·반짝임, 줄 색이 팽팽할수록 빨개짐, 조금씩 끌려옴 |
| `gather/bugs.js` | `popOut(id, { x, z, from: 'rock'|'tree', top })`: 바위 옆에서 기어 나오거나 나무에서 떨어져 튕긴 뒤 플레이어 반대쪽으로 기어감(`scurry`), 바위 7초·나무 10초 뒤 숨음 |
| `gather/work.js` | 도끼·삽 공용 `strikeRock` (삽으로 바위를 쳐도 돌·광석 + 곤충), 화석 첫 발굴 때 감정 안내 알림 한 번 (`state.flags.fossilAppraiseHint`) |
| `gather/trees.js` | 흔들기 결과 `event: 'bug'` → `bugs.popOut(..., 'tree')` + 알림 |
| `gather/bugmodels.js` | 송충이(마디 넷 + 노란 띠)·집게벌레(길쭉한 몸 + 꽁무니 집게) 도형 모델 |
| `gather/meshes.js` | 들어 보이는 물고기: 몸 위쪽은 `back`, 꼬리·등지느러미 `fin`, 배 `belly` (도형은 그대로, `topTint` 로 꼭짓점 색만). 감정 전 화석 모양(흙덩이 + 뼈 끝) |
| `town/keepers.js` | 박물관: 가방에 감정 전 화석이 있으면 인사 뒤 "감정해 드릴까요" → 하나씩 감정(가방 칸 바꿈·알림·효과음) → 메뉴. 감정을 미루고 '기증'을 고르면 한 번 일러 줌. 끝나면 `museum:appraised { ids }` |
| `town/lines/neuru.js` | 감정 대사 (`appraise.*`, `menu`), 이야기 '빈 박물관'에 감정 안내 한 줄 |
| `tests/content.test.mjs` | 11개: 감정 전 화석 목록·기증·값, 파기→감정, 들추기 출현표, 흔들기 곤충 비율·겨울 없음, 바위 하루 한 번, 줄다리기 잡기·끊김·도망, 물고기 색, 대사 칸 |

## 규칙 표

### 화석 감정
| 단계 | 내용 |
|---|---|
| 파기 | 화석 자리 → `fossil.unknown` (하루 4곳 그대로). 처음 한 번 "박물관 느루에게 가져가면 감정해 준대요" |
| 팔기 | 감정 전 200 (진짜 화석 1000~6000) |
| 감정 | 느루에게 말 걸기 → 인사 뒤 묻기 → 가방의 감정 전 화석 칸마다 `spawns.fossil` 과 같은 가중치로 하나 (공룡 두개골이 가장 드묾) |
| 이미 기증한 종류 | "전시실에 벌써 있어요 … 밤톨 씨 가게에 팔면 좋은 값" → 그대로 가방에 남아 제값에 팔 수 있음 |
| 기증 | 감정한 뒤 평소처럼 (`museum:changed` → X3 첫날 '기증' 단계 그대로 완료, 화면에서 확인) |

### 큰 물고기 줄다리기 (`TUG`)
| 항목 | 값 |
|---|---|
| 대상 | 그림자 5~6 (연어·가물치·참치·상어). 1~4 는 전처럼 한 번에 |
| 당길 횟수 | 크기 5 → 3번, 6 → 4번 |
| 물고기가 당김 (찌 잠김) | 0.7~1.25초 |
| 틈 (찌가 톡 떠오름·반짝) | 크기 5 → 0.55초, 6 → 0.48초. 이때 Space/A = 한 번 당김 |
| 당기는 동안 누름 | 팽팽함 +0.45 (첫 번째에 경고 알림) |
| 0.22초 안에 또 누름 | 팽팽함 +0.3 더 |
| 팽팽함 풀림 | 초당 0.3. 1 이 되면 줄이 끊어짐 |
| 틈 놓침 | 연달아 3번이면 도망 |
| 휴대폰 | A 버튼 (gather-busy 200 이 모든 행동 키를 받는다). 안내 알림이 "A!" 로 바뀜 |

### 들추기 곤충
| 장소 | 확률 | 출현표 (data 규칙) |
|---|---|---|
| 바위 밑 (도끼·삽으로 칠 때, 바위가 아직 나올 때만) | 한 번 칠 때 15%, 바위 하나에 하루 한 번 | `under`: 쥐며느리 종일·연중, 집게벌레 밤·봄~가을 |
| 나무 흔들기 (그 나무 그날 첫 '떨어짐' 몫) | 8% (벌집 다음, 그 시각·달에 나올 곤충이 있을 때만) | `shake` + `tree` 곤충에서 꿀벌 뺌: 송충이 종일·봄~가을, 매미 낮·여름, 장수풍뎅이 밤·여름 |
- 비·눈 오는 날의 날벌레 제외 규칙은 그대로 (`bugPool`). 쥐며느리는 더 이상 저절로 바위 위에 나오지 않는다 (달팽이만 비 올 때).
- 튀어나온 곤충은 걸어서 다가가도 도망가지 않는다 (달려오면 도망). 잠자리채로 잡는다.

### 물고기 몸 색 (`items.js` `FISH_COLORS`: 몸·등·배·지느러미)
붕어 녹회색/올리브 등 · 피라미 은청 + 주홍 지느러미 · 송사리 연노랑 · 잉어 금갈색 · 미꾸라지 흙갈색 · 은어 연두 + 노란 지느러미 · 메기 진한 올리브 · 쏘가리 황토 + 검갈 등 · 연어 주홍 몸 + 회청 등 · 금붕어 주황 · 가물치 짙은 갈색 · 전갱이 은청 + 노란 지느러미 · 고등어 푸른 등 · 광어 모래색 · 오징어 우윳빛 · 문어 빨강 · 해마 귤색 · 도미 분홍 · 참치 남색 + 노란 지느러미 · 상어 회청.

## 대사 (느루, 모두 새로 씀)
- `appraise.notice` "오오… 가방에서… 오래된 흙냄새가… 나는군요…" / "그건… 아직… 정체를 모르는… 화석이군요…"
- `appraise.noticeMany` "알 수 없는 화석이… {n}점이나…" / "{n}점이라니… 오늘은… 땅이… 아주… 너그러웠군요…"
- `appraise.later` · `look`("흙을… 살살… 털어 내고…") · `next` · `result`("이건… {item:이군요}…!" 외 2) · `rare`("평생… 몇 번… 볼까 말까 한… 보물이에요…!") · `owned`("전시실에… 벌써… 같은 것이… 있답니다… 밤톨 씨 가게에…") · `done` · `doneOwned` · `notYet`("감정하지 않은 화석은… 아직… 받을 수가 없답니다…") · `menu`
- `story.empty` 끝에 "파낸 화석은… 저에게… 가져오시면… 무엇인지… 감정해… 드리지요…"
- 알림(채집): "큰 녀석이다! 찌가 떠오를 때 Space!/A!", "너무 세게 당기면 줄이 끊어져요! 찌가 떠오를 때만", "툭! 줄이 끊어져 버렸다… 물고기가 도망갔다", "물고기가 줄을 끌고 도망갔다…", "바위 밑에서 ○○이(가) 튀어나왔다! 잠자리채로 잡자", "나무에서 ○○이(가) 떨어졌다! 잠자리채로 잡자", "무슨 화석일까? 박물관 느루에게 가져가면 감정해 준대요"

## 계약 변경·제안 (`docs/CONTRACTS.md` 에 넣어 주세요 — 조정 세션)
1. **아이템**: `fossil.unknown` (`unknown: true`) — `items.list('fossil')` 엔 없고 `items.get`·`items.list()` 엔 있다. 물고기 `colors`. 곤충 22종 (`caterpillar`, `earwig`), 박물관 전체 48 → 50.
2. **곤충 place**: `under`(바위를 칠 때만), `shake`(나무 흔들기 때만) — 곤충 스폰이 저절로 고르지 않는 자리.
3. **data**: `harvest.digFossil` 이 이제 `'fossil.unknown'` 을 돌려준다. `harvest.appraise()`, `harvest.rockBug()`, `spawns.treeShake` 의 `event: 'bug'`.
4. **이벤트** `museum:appraised { ids }` — 느루가 감정을 마친 뒤 (밝혀진 화석 id 들).
5. `state.island.daily.rockBugs = [바위 id]` (오늘 곤충이 나온 바위), `state.flags.fossilAppraiseHint`.

## 다른 트랙에 부탁 (고치지 않음)
- **Y1 (`src/ui/bag.js` · `src/ui/museum.js`)**: 기증 모드 `canPick` 이 카테고리만 보고 감정 전 화석도 고를 수 있게 둔다 → 고르면 data 가 거절하고 "이미 기증한 거예요" 가 뜬다 (화면에서 확인). `canPick` 을 `data.museum.canDonate(slot.id)` 로, `whyNot` 에 `info.unknown`(또는 `items.get(id).unknown`)이면 '느루에게 먼저 감정을 받아요' 를 부탁. 지금은 느루가 메뉴 전에 감정을 먼저 묻고, 미뤘으면 기증 창 전에 한 번 일러 줘서 거의 안 보인다.
- **Y1 (`src/gameplay/intro/index.js`)**: 첫날 '기증' 힌트의 `canDonate` 가 감정 전 화석을 못 센다 → 화석만 파 온 경우 "(기증할 게 없으면 하나 더 잡아 와요)" 가 붙는다. `|| inventory.count('fossil.unknown') > 0` 정도로 세 주면 좋다.
- **Y1 (`interactions.peek`·A/B 글자)**: 낚시 줄다리기 중엔 `gather-busy`(200) 가 받는다. A 글자를 '당기기' 로 바꾸고 싶으면 `ctx.services.gather.fishing.active` / `.bobber.state === 'tug'` 를 보면 된다.
- **UI 도감(phone)**: 곤충 칸이 22개가 된다 (목록은 `items.list('bug')` 라 자동).

## 확인한 것
- `node --test tests/` 144개 통과 (새 11개 + 기존 3개 수치 갱신: 곤충 20→22, 박물관 48→50, 쥐며느리 rock→under).
- 화면 (키보드, 800×600): 화석 자리를 삽으로 파기 → '알 수 없는 화석을 파냈다!' + 감정 안내 → 느루 첫 방문 인사 → "{n}점이라니…" → 두 점 감정(둘 다 이미 기증한 종류 → `owned` 대사) → 메뉴. 박물관 화석 비운 뒤 다시 감정 → 공룡 발자국 → 기증 창에서 기증 → 첫 기증 대사 + `museum:changed` → 첫날 할 일 `donate` 완료 기록 확인. 상점 값 `sellPrice('fossil.unknown') = 200`.
- 낚시: 선착장에서 그림자를 참치·상어로 바꿔 덥석 → 줄다리기 → 틈에 4번 당겨 상어 잡기, 마구 눌러 줄 끊김(경고 → 끊김 알림), 도미(그림자 4)는 한 번에. 들어 보이는 도미(분홍)·고등어(푸른 등) 색 확인.
- 바위: 도끼로 쳐서 집게벌레·쥐며느리 튀어나옴(알림, 기어서 멀어짐), 잠자리채로 바꿔 쥐며느리 잡기·도감 기록. 나무 흔들기 → 송충이가 0.7 높이에서 떨어져 튕긴 뒤 기어감. (곤충이 나오는 운은 확인을 위해 data 함수를 잠깐 바꿔 끼워 강제했다 — 확률 자체는 테스트로 확인)
- 휴대폰 크기(375×812 터치 흉내): A 버튼으로 던지기 → 덥석 → 줄다리기 4번 → 참치, 알림 "찌가 떠오를 때 A!".
- 콘솔 오류 없음.

## 못 한 것 · 알려진 빈틈
- 실제 휴대폰 기기는 아님 (터치 흉내). 미리보기 창이 숨겨져 있을 땐 `ctx.step` 으로 프레임을 돌려 확인했다.
- 줄다리기 수치(틈 길이·팽팽함)는 혼자 몇 번 해 본 느낌으로 정했다 — 사용자가 해 보고 조정할 만하다.
- 집게벌레 모델은 덤불 뒤에 가려 화면에서 또렷이는 못 봤다 (송충이는 확인).
- 줄다리기 중 진행 정도(몇 번 남았는지)는 화면 칸 없이 줄 색·물결로만 보인다. UI 칸이 생기면 `bob.tug.left/total` 을 쓰면 된다.
- 감정 결과는 그때그때 `Math.random` (가방에 바로 들어가 저장되므로 다시 불러와도 같다).
