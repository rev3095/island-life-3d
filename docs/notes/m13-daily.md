# M13-P2–P5 매일 할 거리 (13차 보드 wave13 D142–D147 모두 A)

브랜치 `m13-daily` (worktree `../island-worktrees/m13-daily`, 점검 포트 4261). 설정 하나 `assets/daily/daily.json`, 규칙(순수) `src/gameplay/daily/rules.js`, 모듈 `src/gameplay/daily/` (`index.js` 공용·유리병·레시피 쪽지 · `meteor.js` · `balloon.js` · `peddler.js`), 저장 `state.daily` · 열린 레시피 `state.recipes.known`. 열리는 때 = 첫날 안내를 마친 다음 날부터 (밤 콘텐츠와 같은 기준).

## P2 유성우 · 소원 (D144-A · D147-A)
- 주마다(월요일 시작) 1~2 밤 (`twoChance` 0.4, 서로 이틀 넘게), 그날 예보가 20–28시 내내 맑음(`clear`·`rainbow`)일 때만. 섬 씨앗·날짜로 늘 같다 (`meteorDaysOfWeek`·`meteorTonight`).
- 하늘 FX-02 = `src/sky/meteors.js` (dome.js 는 그대로). **유성우 밤에만 만든다** (`time.meteors.set(true)` 때 셰이더·물체 생성, 끄면 지움). 높음 7·적정 5 줄 = 한 그리기의 꼭짓점 셰이더 (별처럼 맨 끝 깊이 · 더하기 섞기), 낮음·매우 낮음 = 선 2개 CPU (`LineBasicMaterial`) — 다른 날 GPU 몫 0. 북쪽 하늘 고도 15–40° (올려다볼 때 보이는 곳). sky/index.js 고리: import · 만들기·돔 그룹에 붙이기 · `service.meteors` · step 의 `meteors.update` · 사양 바뀜.
- 소원: 올려다보기(카메라 LOOK tilt ≥ `lookTilt` 0.45 — R/V · 두 손가락 · 오른쪽 끌기) 중 Space → 처리기 `daily:wish` (우선순위 103, 「소원 빌기」), 하룻밤 3번. 주인공 AN-13 `wish` (52프레임, player.json animations — 주인공만 재빌드), 없으면 happy.
- 다음 날 아침 바닷가 모래(바다 3칸 안) 칸에 별 조각 IC-MA-11 (소원 수만큼, 최대 3, 색 셋 중) — gather drops 라 F 로 줍고 저장된다.
- 그날 아침(5–20시 처음 볼 때) 예고 알림: 달무리가 살면 「🦉 달무리 쪽지」, 아니면 일반 문구 (달무리 편지 묶음은 주민 파일이라 건드리지 않음 — 편지로 바꾸려면 dalmuri.json letters 에 `meteor`).
- 처음 별똥별이 떨어질 때 `daily:meteor {first, x, z}` → 장면 **s23 첫 유성우 밤** (트리거 `meteor-first`, 달무리와 하늘 보기).

## P3 선물 풍선 · 새총 (D142-A · D147-A)
- 하루 3번 (9–18시를 셋으로 나눈 칸마다 하나, 1.5시간 안에 밖에 있으면 나옴). 플레이어 옆 22칸 바다 쪽에서 반대편으로 1.15칸/초, 땅 위 4.6. 한 번에 하나.
- 풍선 PR-33 은 world 물체가 아니라 놀이 메시 (저장 안 함). 색 셋 = `balloon` 재질 색만 바꿈. 흔들림: **높음·적정은 풍선·줄 재질을 바람 정점 셰이더(STYLE_WIND, 이미 있는 갈래)로**, 낮음·매우 낮음은 CPU 로 통째 기울이기.
- 새총 TO-07 = 도구 6번째 `sling` (숫자키 6 · Q/E · 도구 고리). items.json tools 에 `buy` 1200 → 도토리상점 도구 진열에 저절로 들어감 (shopStock 이 도구 전부 — 진열 구조는 안 건드림), 레시피(첫 쪽지)로도. 처리기 `daily:sling` 12 (든 도구 쓰기 10 보다 먼저): 수평 3.4칸 안 · 앞쪽 반원(바로 위는 늘) 이면 맞음, 내구도 30.
- 맞으면 풍선이 사라지고 상자가 0.75초 떨어져 선물(gather drop, F) — 표 `balloons.gifts` (나무·돌·철·점토·도토리 주머니·레시피 쪽지(열 레시피가 남았을 때만)·화분·코스모스 씨앗). 바다 위면 플레이어 옆 땅에.

## P4 유리병 · 레시피 (D143-A · D146-A)
- 날마다 아침 바닷가 모래 칸 하나에 유리병 PR-34 (world 물체 persist:false, 날마다 다른 자리). 처리기 `daily:bottle` 55 「열기」 → 열 레시피가 남았으면 레시피 쪽지 IC-MA-12, 다 알면 작은 선물(`bottle.after`).
- **레시피 쪽지가 가방에 들어오면**(유리병·풍선·섬 일지 교환·나중에 주민 선물 무엇이든) daily 가 읽는다: 쪽지 하나 빠지고 잠긴 레시피 중 표 순서 첫째를 `state.recipes.known` 에 → 확인 창. 창·장면이 열려 있으면 닫힌 뒤.
- 레시피 잠금: `rules.json` recipes 의 `unlock: true` 다섯 줄 (새총 · 별 조각 램프 · 별빛 벽시계 · 별 의자 · 별 모빌). `recipes.js` `createRecipes(inv, { known })` — known 을 주면 잠긴 것은 목록·만들기에서 빠짐, 안 주면 다 앎(예전 도구·테스트). `locked()`·`isOpen()`. 작업대(house/craft.js)는 쪽지 레시피에 📜, 첫 줄에 「새 레시피 n개 더」.
- 별 조각 가구 FU-63–66 (`src/data/daily-items.js` DAILY_FURN, 출처 'star', 별 조각 레시피로만): 램프(glow) · 벽시계(벽, 바늘 = 지금 시각) · 별 의자(앉기 — decor/seats.js 한 줄) · 별 모빌(glow).
- 요소 편집기 값 검사(`tools/elem-checks.mjs`)는 items.json 밖 아이템을 몰라서 `CODE_ITEMS` 목록을 더함 (tests/daily.test.mjs 가 daily-items.js 와 맞는지 봄).

## P5 방문 행상 (D145-A)
- 수·일 9–17시, 광장 + `offset` [-7, 5] 둘레에서 빈 곳(수레 2칸 + 행상 1칸 + 앞 두 줄, 문·축제 광장 밖)에 수레 BD-11 (persist:false, 자리는 `state.daily.peddler.spot`). 행상 **송이 CH-16 — 고슴도치** (지금 섬에 없는 종족, build_character.py 새 종족 `hedgehog` + 부품 `spines`: 머리 뒤·등 갈색 털 덮개 + 뒤로 누운 가시). 밤 상인은 다른 트랙 — 낮만.
- 처리기 `daily:peddler` 101 「행상」(말 걸기 100 보다 먼저) → 대화 고르기 + 확인 창으로 사기 (상점 창 ui/shop.js 안 씀). 오늘의 진열 = 교배로만 피는 넷째 색 꽃(심을 수 있음) 둘 · 묘목 하나(`saplingPool`) · 벽지 **WP-09 「들꽃 수레」** (interior 목록 값 0 + `peddler: true` → 도토리상점 오늘의 벽지 코너엔 안 나옴, 행상 값 2600).
- 처음 7칸 안으로 다가가면 `daily:peddler {first, x, z}` → 장면 **s24 행상 송이 첫 방문** (트리거 `peddler-first`). 장면 동안 진짜 행상은 숨김.

## 섬 일지 (M13-P1 연결)
- journal.json v2: 할 일 `balloon` 「선물 풍선 하나 맞히기」 · `bottle` 「바닷가 유리병 열기」, 목표 `wisher` 「별똥별 소원」(on wish) · `sharpshot` 「풍선 명사수」, 교환 「레시피 쪽지」 250. daily 가 `journal.count('wish'|'balloon'|'bottle')` 로 직접 셈 (journal/index.js 는 안 고침).
- 할 일 표가 늘어 그날 고르는 할 일(pickTasks)이 예전 날짜와 달라진다 (같은 날 같은 섬이면 여전히 같음).

## 새 리소스 (모두 status review — 검수 대기)
| 보드 ID | slug | 비고 |
|---|---|---|
| TO-07 (IC-TL-06) | `tool-sling` | 손 모델은 player/tools.js 도형 |
| IC-MA-11 | `mat-star-piece` | 변형 yellow·pink·blue = 아이템 셋 |
| IC-MA-12 | `mat-recipe-note` | |
| PR-33 | `gift-balloon` | 부품 balloon·gift (맞히면 balloon 재질만 숨김) |
| PR-34 | `sea-bottle` | |
| BD-11 | `peddler-cart` | 앞 = +Z(남쪽) |
| FU-63–66 | `star-lamp` `star-clock` `star-chair` `star-mobile` | |
| CH-16 | `songi` | 고슴도치, 동작 idle·walk·run·happy |
| AN-13 | `player` `wish` | 주인공만 재빌드 (player.json 0.2.1, review) |
| WP-09 | `wp-09` | 행상 전용 벽지 |
| s23 · s24 | 장면 | review |
- IC-MA-13 일지 교환권은 만들지 않음 (일지 교환이 포인트로 바로 되어 필요 없었음).
- 게시: 새 묶음 `daily` (풍선·유리병·수레 모델 + 송이 모델 — 처음 나올 때), 설정 `assets/daily/` 는 island 묶음. world 는 이 셋을 lazy 로.

## 개수 박은 테스트 (이 브랜치에서 맞춤 — 합칠 때 다른 트랙 수와 더할 것)
- assets.test 캐릭터 15→16 · 배경 76→79 · 가구 50→54 / items-assets 아이콘 116→121 · 스펙 103→106 / items.test 도구 5→6 · 가구 50→54 / recipes-economy 상점 도구 5→6 / interior 벽지 8→9 (WP-09 는 값 0 허용) / build-web 묶음 ≤18→≤19 / journal ON 에 wish·balloon·bottle / ux TOOL_LABEL sling / 편집기 게시 목록: story(daily-items.js · s23 · s24 · songi_thumb) · style(sky/meteors.js) · villagers(daily-items.js).
- 새 테스트 `tests/daily.test.mjs` 8개.

## 점검 (2026-11-12)
- `node --test tests/` 488 (통과 487 · 건너뜀 1 · 실패 0) — 새 `tests/daily.test.mjs` 8.
- 자동 플레이 `node tools/playtest.mjs --port=4261 --only=boot,naming,arrival,clock,fd-tool,fd-gather,fd-catch,fd-sell,fd-donate,fd-home,buy-tools,daily` → **12✅ 0🟡 0⛔ · 콘솔 오류 0** (새 단계 `daily`: 유리병 열기 → 새총 레시피 → 나무·가지 모아 작업대에서 새총 → 풍선 1발 명중 → 선물 줍기 → 11-22 유성우 밤 장면 s23 → R 꾹 + Space 소원 2번 → 다음 날 바닷가 별 조각 2개 줍기 → 11-25(수) 행상 장면 s24 → 묘목 640 사기). 봇이 찾은 문제 1건은 기존 단계 fd-sell 「상점 문 걷다 막힘」(작음, 이 트랙과 무관).
- 봇 쪽: `bot.keyUp` · KEY_OF `tool6` 을 더함. 상점 진열 받침에 새총 자리가 아직 없어 봇은 쪽지 레시피로 만든다 (진열은 실내 트랙).
- 확인 못 한 것: 별똥별 줄 자체가 사진에 잡히지는 않음 (0.9초씩 지나가서) — 사양별 GPU 시간·모습은 M13-P6 QA.

## 문서 세션이 반영할 문장
- CLAUDE.md 큰 구조에 절 하나: 「### 매일 할 거리 (M13-P2–P5, `src/gameplay/daily/`) — 보드 wave13 반영 v1 (D142–D147 A). 설정 `assets/daily/daily.json`, 규칙(순수) `daily/rules.js`, 저장 `state.daily` · 열린 레시피 `state.recipes.known`. 유성우(주 1–2 맑은 밤 20–4시, 하늘 `src/sky/meteors.js` — 그날만 만듦, `time.meteors.set`) · 올려다보기+Space 소원(AN-13) → 다음 날 바닷가 별 조각 · 선물 풍선(하루 3, 새총 = 도구 6번째 `sling`) · 날마다 바닷가 유리병 → 레시피 쪽지(가방에 들어오면 잠긴 레시피 `unlock` 하나 열림) · 수·일 낮 광장 행상 송이(CH-16 고슴도치, 수레 BD-11, 행상 전용 벽지 WP-09). 장면 s23(`meteor-first`)·s24(`peddler-first`). 노트 `docs/notes/m13-daily.md`.」
- CLAUDE.md 행동 키 우선순위 줄에 더함: 소원 빌기 103 · 행상 101 · 유리병 열기 55 · 새총 쏘기 12.
- CLAUDE.md 「명령어」 개수 줄: 캐릭터 16종(송이) · 가구 54 · 도구 6 (숫자키 1~6).
- CONTRACTS: 이벤트 `daily:meteor {on, first, dayKey, x, z}` · `daily:meteor-notice` · `daily:wish {dayKey, n}` · `daily:stars` · `daily:balloon {spawn|hit|gone, i, item}` · `daily:bottle {dayKey, note}` · `daily:recipe {id}` · `daily:peddler {arrive|first, dayKey, x, z}` · `daily:peddler-buy`. 서비스 `ctx.services.daily` `{open, recipes:{known, unlock, read}, bottle, meteor, balloons, peddler}` · `time.meteors {set(on), on}` · `data.recipes.locked()/isOpen(id)`.
- concept/README.md 보드 목록: wave13 「반영 v1 → M13-P2–P5 브랜치 m13-daily」.

## 남은 것
- (합칠 때) 다른 트랙과 겹칠 줄: `gameplay/index.js` PARTS · `build-web.mjs` PACKS · `world/index.js` lazy · `story/files.js`·`index.json` · `editor-files.json` 셋 · 개수 박은 테스트 · `constants.TOOLS`. WP-09 slug 를 다른 트랙(집 증축 등)이 쓰면 번호를 바꿀 것.
- 상점 진열 받침에 새총 자리 (실내 트랙): shopStock 도구가 5→6 이 됨.
- 그래픽 사양별 GPU 시간 재기(perf-bench, 유성우 밤) — M13-P6 QA 몫.
