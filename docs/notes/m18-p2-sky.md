# M18-P2 하늘 · 그날만 날씨 (15차 보드 wave15 D192-A · D193-A · D197-A)

브랜치 `m18-p2-sky` (worktree `../island-worktrees/m18-p2-sky`, 점검 포트 4292). main 7074235 에서 갈라짐, main 에는 합치지 않았다.

## 한 것

| 무엇 | 내용 |
|---|---|
| 날짜 규칙 `src/sky/special.js` (새, 순수) | 섬 씨앗 없이 해마다 같은 규칙: **장마 하루** 6월 셋째 수요일 · **태풍** 9월 둘째 일요일 · **태풍 다음 날** 그다음 월요일 · **첫눈 하루** 12월 첫째 토요일 · **큰 유성우 밤** 8월·12월 둘째 토요일 (12월은 첫눈 한 주 뒤). 계절 행사(8월 1–7 불꽃놀이 · 12월 20– 눈사람 날)와 겹치지 않는다. 2027년 = 06-16 · 09-12 · 09-13 · 12-04 · 08-14 · 12-11 |
| 예보 덮기 | `sky/index.js forecastFor` 가 `applySpecial(dayKey, forecast(...))`: 장마·태풍 = 하루 종일 비 · 태풍 다음 날 = 맑음 · 첫눈 = 5시 흐림 → 8시부터 눈 · 큰 유성우 = 17시부터 맑음 · **12월 첫눈 전에는 눈 대신 흐림** (그래야 「첫눈」). 날씨를 직접 바꾸면(setWeather) 특별 효과는 꺼진다. 서비스 `time.special(dayKey?)` · `time.specialDays(year?)` · `time.snowCover` |
| 별자리 +6 IC-ST-13–18 | `starmap.js`: 봄 연자리 · 여름 소라껍데기자리·부채자리 · 가을 밤송이자리 · 겨울 군고구마자리·썰매자리 (계절마다 4–5). 자리는 셋과 안 겹치게 낮은 가운데(−10°, 30°) · 동쪽 높이(82°, 54° / 썰매 92°, 60°). 3D 하늘 별(stars.js)·망원경·도감은 목록을 그대로 따라온다. 「/12」 박은 글 셋을 `CONSTELLATIONS.length` 로 |
| 별자리관 칸 6 | `assets/interior/halls/star.json` 북벽 빈칸 0·2·4·7·9·11 에 FU-87 액자 여섯 → 북벽 열둘 · 서벽 셋 · 동벽 셋 = 18 (새 별자리는 북벽에 순서대로) |
| 큰 유성우 밤 | `daily/meteor.js`: 그날은 그 주 유성우 날과 상관없이 유성우 (`isSpecial(dayKey, 'big-meteor')`) · `time.meteors.set(on, { big })` → 별똥별 두 배 (`meteors.js BIG_METEOR = 2`: 높음 14 · 적정 10 줄 셰이더, 낮음·매우 낮음 CPU 선 4) · 소원 하나에 별 조각 둘 (최대 여섯, `daily.json bigMeteor`) · 아침 예고·시작 알림 따로 · 처음이면 장면 **s31 큰 유성우 밤** (트리거 `meteor-big`, `daily:meteor` 의 `bigFirst`). 그날이 생애 첫 유성우면 s23 대신 s31 (소원 안내 포함) |
| FX-03 굵은 비 | `precip.js HEAVY_QUALITY`: **높음 2200 · 적정 1400 줄의 굵은 빗줄기 겹** (같은 비 셰이더, 굵은 비 날에만 만들고 그치면 지움) + 물방울 튀김 진하게 + 바람 세게. **낮음·매우 낮음 = 새 그리기 없음**, 지금 비 줄만 길고 진하게. 태풍은 바람이 옆으로 세다(비스듬). 웅덩이 반사 = 이미 있는 젖은 땅 윤기(STYLE_FX_WET, 높음·적정) 가 하루 종일 1 |
| FX-04 쌓이는 눈 | `snowDepthAt`: 첫눈 날 8시 0 → 14시 1 (게임 시각 — 시계를 돌려도 그 시각의 깊이). 높음·적정은 이미 있는 눈 쌓임 셰이더(`uSnowCover`), 낮음·매우 낮음은 이미 있는 땅 재질 색(snowLite) — 새 셰이더 없음 |
| 발자국 (판) | `src/sky/footprints.js` (새): 땅에 눈이 0.3 넘게 쌓이면 주인공 걸음마다 왼발·오른발 판 (메시 하나 = 그리기 1, MeshBasicMaterial + 곡면 패치, 꼭짓점 색 a 로 90초에 옅어짐). 사양별 장 수만 다름 (64·48·32·24). 물·바다·절벽 위엔 안 남음. 눈이 없으면 숨김. 첫눈 날뿐 아니라 눈이 쌓인 날이면 남는다 |
| 장마 하루 | `daily/special.js` (새): 아침 알림 · 처음이면 장면 **s30 장마 하루** (트리거 `special-day` kind `monsoon`) · 비 오는 날 생물 가중치 ×3 (`spawns.bugPool rainBoost`, gather bugs 가 `daily.special.rainBoost()` 를 읽음) · **새 곤충 청개구리 IC-BG-25** (`bug.tree-frog`, 풀밭 · 비 올 때 · 여름, 520, Blender `b_frog` → 모델·아이콘, status review) |
| 우산 쓴 주민 | `town/umbrella.js` (새): 장마·태풍 날 비가 오면 밖에 있는 주민 머리 위에 우산 (원뿔 지붕+손잡이 한 메시, 툰 재질, 주민마다 그리기 1, 색 다섯 중 이름으로). 그날이 아니면 떼고 지운다. 비 오면 집에 있는 주민(rainStay)은 그대로 집에 |
| 태풍 다음 날 | 아침 바닷가 모래 칸 14곳에 떠밀려 온 것 (나뭇가지·나무·조개 여섯 가지·도토리 주머니·레시피 쪽지 하나까지 — gather drops 라 F 로 줍고 저장된다). `daily:washup` |
| 첫눈 하루 | 아침 알림 → 8시 눈이 오기 시작하면 「첫눈」 알림 · **눈 장식 레시피 「눈사람 등」 FU-46** 열기 + 눈 결정 셋 (확인 창) · 처음이면 장면 **s32 첫눈 아침** (트리거 `special-day` kind `first-snow`). 레시피는 `rules.json` 에 `"special": "first-snow"` — 쪽지로 여는 차례(`recipes.locked()`)엔 안 들고 `lockedSpecial('first-snow')` 로만 |
| 장면 s30–s32 | `assets/story/scenes/` (status review, 연출안 A 추천 + B 한 컷): s30 장마 하루 (초롱이, 내 집 앞) · s31 큰 유성우 밤 (달무리, 박물관 앞 망원경대) · s32 첫눈 아침 (밤톨, 내 집 앞). `story/files.js` · `index.json` · `editor-files.json` · 트리거 `meteor-big` · `special-day` (+ `SPECIAL_KINDS` 검사) |
| perf-bench 장면 셋 | `tools/perf-bench.mjs --scenes=monsoon-day,snow-day,meteor-night`: 광장 장마 12시 · 첫눈 15시 · 큰 유성우 22시. 그날이 특별하지 않은 코드(main)에선 비·눈을 바로 걸고 보통 유성우를 켜서 「보통 비·눈·유성우 날」과 견준다 |

## 결정 반영 (모두 A)

| 결정 | 반영 | 다르게 고르면 · 바꿀 곳 |
|---|---|---|
| D192 하늘 | 별자리 +6 (18) · 큰 유성우 둘 | B 그대로 — `starmap.js` 끝 여섯 줄 · `star.json` 액자 여섯 · `special.js SPECIAL_RULES` big-meteor 두 줄 지우기 |
| D193 그날만 날씨 | 장마·태풍 다음 날·첫눈 | B 비 생물만 — `SPECIAL_RULES` 를 비우고 청개구리만 남김 · C 없음 — 그 위에 청개구리 줄도 |
| D197 사양 | 높음·적정만 새 셰이더 겹, 낮음·매우 낮음은 점·판 | `HEAVY_QUALITY.low/min.layer` · `PRINT_QUALITY` |

## 확인

- `node --test tests/` — **TESTS_LINE**
- 날짜 흉내 점검 (머리 없는 Chrome, 개발 서버 4292, `?date=` · 적정/낮음): 사진은 공유 노트 폴더 `m18-p2-sky-shots/`
SHOTS_TABLE
- GPU (`node tools/perf-bench.mjs`, 이 컴퓨터 Intel UHD, 1280×800, 세 번 가운데 값 ms — main 7074235 → 이 브랜치):

PERF_TABLE

## 남은 것 · 제안

- 청개구리 IC-BG-25 · 장면 s30–s32 는 status review — 리소스 편집기·스토리 편집기에서 확정.
- 청개구리는 곤충 칸에 넣었다 (도감·박물관 곤충관 25칸). 개구리라 곤충이 아니니 거슬리면 분류를 바꾸는 건 P1(계절 생물) 쪽과 같이.
- 우산은 코드 메시라 리소스 편집기에 없다 — 모델로 빼고 싶으면 PR 번호 하나.
- 발자국은 주인공만. 주민 발자국까지 하려면 town 에서 같은 판 메시에 stamp.
- s30·s32 는 내 집 앞, s31 은 박물관 앞 — 처음엔 「트리거 자리(플레이어 자리)」였는데 광장에서 깃발 줄이 카메라를 가려서 고정 자리로 바꿨다. s23 도 같은 문제가 있을 수 있다.
- 9월 태풍 「당일」 은 비바람만 — 나무가 흔들리는 바람 세기(STYLE_WIND) 올리기는 셰이더 값이라 다음에.

## 겹칠 줄 (합칠 때)

- 개수 박은 테스트: 곤충 24→25 · 아이콘 166→167 · 아이템 스펙 143→144 · 들어 보이는 모델 75→76 · 박물관 total 90→91 · 관 자리 54→55 (P1 이 바다 생물을 더하면 그 수와 더할 것).
- `story/files.js` · `assets/story/index.json` · `editor-files.json` (P3 s29 와 같은 자리), `story/rules.js TRIGGERS` (P3 대회 트리거).
- `assets/data/items.json` 곤충 줄 · `rules.json recipes` 끝 (P4 계절 레시피) · `daily.json` (P4 행상 계절 진열) · `daily/index.js` 고리 · `town/index.js` T 줄.
- `assets/style/editor-files.json` 에 `src/sky/special.js` · `footprints.js`.

## 문서 세션이 반영할 문장

- CLAUDE.md 「하늘」 끝에: "그날만 날씨(M18-P2): 날짜 규칙 `src/sky/special.js` (순수 — 장마 6월 셋째 수 · 태풍 9월 둘째 일 · 태풍 다음 날 · 첫눈 12월 첫째 토 · 큰 유성우 8·12월 둘째 토) 가 예보를 덮는다 (`time.special()`). 굵은 비 FX-03 = `precip.js HEAVY_QUALITY` (높음·적정만 겹 하나, 그날만 만듦) · 쌓이는 눈 FX-04 = `snowDepthAt` (8→14시) · 눈 발자국 = `src/sky/footprints.js` (판 한 메시). 별자리는 18개 (IC-ST-13–18 계절마다 1–2개 더). 그날 놀이(우산 쓴 주민 `town/umbrella.js` · 비 오는 날 생물 · 떠밀려 온 것 · 첫눈 레시피)는 `src/gameplay/daily/special.js`, 큰 유성우 밤은 `daily/meteor.js`. 장면 s30(`special-day` monsoon)·s31(`meteor-big`)·s32(`special-day` first-snow). 노트 `docs/notes/m18-p2-sky.md`."
- CLAUDE.md 「섬 일지 · 매일 할 거리」 매일 할 거리 줄 끝에: "8·12월 큰 유성우 밤(별 조각 두 배) · 장마·태풍 다음 날·첫눈 하루 (M18-P2, `daily/special.js`)."
- CLAUDE.md 「명령어」 perf-bench 설명(있으면)에: "`--scenes=monsoon-day,snow-day,meteor-night` = 그날만 날씨 (특별한 날이 없는 코드에선 보통 비·눈·유성우로 견줌)."
- CONTRACTS: 서비스 `time.special(dayKey?)` → `{ kind, name, emoji, heavy, dayKey } | null` · `time.specialDays(year?)` · `time.snowCover` · `time.meteors.set(on, { big })` · `time.meteors.big` · `daily.meteor.big()` · `daily.special { today, rainBoost, umbrella }` · `data.recipes.lockedSpecial(tag)`. 이벤트 `daily:meteor` 에 `big`·`bigFirst` · `daily:special { kind, first, dayKey, x, z }` · `daily:washup { dayKey, n }`. 저장 `state.daily.special = { day, notice, drop, snow }` · `state.daily.seen.{monsoon, firstSnow, bigMeteor}` · `state.daily.wish.big`. rules.json recipes 줄의 `special`.
- concept/README.md ID 표: IC-ST-13–18 · FX-03 · FX-04 · IC-BG-25 (청개구리) · s30–s32 · D192 · D193 · D197 → 「반영 v1 → M18-P2 브랜치 m18-p2-sky」.
