# M16 잠수 (브랜치 `m16-dive`, 결정 D160–D164)

사용자 요청: 잠수로 바다에 들어갈 수 있게, 스쿠버다이빙 키트는 상점에서 구매. 결정은 모두 이 트랙의 추천안(사용자 확인 전)이고 바꿀 자리를 같이 적는다.

## 결정 (추천안)
| ID | 정한 것 | 바꿀 자리 |
|---|---|---|
| D160 | 스쿠버 키트 `tool.scuba-kit` (TL-06 · 모델 IC-TL-06): 사는 값 3000 · 파는 값 750. 손에 드는 도구가 아니라(`tool` 칸 없음, `wear: 'scuba'`, 내구도 없음) **가방에 있으면** 해변 물가에서 들어간다. 도토리상점이 **늘** 판다 | 값 `items.json scubaKit` · 늘 파는 목록 `rules.json shop.always` → `economy.shopStock().always` (하루 도구 다섯은 `t.tool` 있는 것만) |
| D161 | 헤엄 AN-15 · 잠기기 AN-16 은 **코드 자세** (`src/player/swim.js` `pose()` — 서기 클립 위에 뼈 덧돌림 + 몸 앞으로 기울이기). 주인공 .glb.json 을 다시 구우면 다른 트랙(M13 AN-13 등)과 바이너리 충돌이라서 | 나중에 `build_character.py` 클립 `swim`·`dive` 로 옮기려면 swim.js `pose()` 만 바꾸면 된다 |
| D162 | 바다 = `world.addZone` 구역 (헤엄치는 동안만): 해안 물가 선 + `DEEP` 0.6 바깥 ~ 섬 칸 밖 `MARGIN` 7칸, 빠르기 걷기 × 0.62 (잠기면 × 0.55). 선착장 다리 둘레는 비움. 구역 `isWalkable` = false (주민 길찾기가 바다로 안 감). 투어 섬·실내에선 안 됨. 더 먼 바다는 「물살이 세서 못 가요」 | `dive.js` 위쪽 상수 |
| D163 | 물속 화면: 모든 사양 안개 색·거리 (sky 가 매 장면 다시 칠해서 나오면 저절로 돌아옴) · **높음·적정만** 화면 셰이더 한 장(물빛 그물·가장자리 어둡게). 낮음·매우 낮음은 셰이더 없음. 물방울 FX-03 = InstancedMesh 하나 (사양별 72·56·32·20개). 잠긴 주인공은 바다 판이 불투명이라 물낯 그림자 + 물방울 줄로 보임 | `dive-fx.js` |
| D164 | 바다 생물 분류 `sea` 「바다 생물」 IC-SE-01–20: 시간·계절·그림자 1–6·빠르기 0–3(가만히·느림·보통·빠름 — 잠긴 주인공이 가까이 오면 달아남, 빠른 것은 물 위에서 빨리 다가와도 달아남)·값. **헤엄칠 때만** 둘레에 6마리(낮음 4·매우 낮음 3), 출현 `spawns.sea({hour, month})` (날씨 안 탐). 박물관 기증 (`items.COLLECTIBLE` · `museum.js` KINDS = COLLECTIBLE) · 도감 탭 · 섬 일지 할 일 `sea1` 「바다 생물 잡기」 (이벤트 `dive:catch`) | `items.json sea` · `journal.json` |

## 흐름
- 물가에서 키트를 가진 채 도구를 안 들고 바다를 보면 행동 키 「바다에 들어가기」(우선순위 48 — 줍기 50 다음) → 걸어 들어가며 첨벙 → 잠수복 CL-13 입음(옷 칸 옷·기본 윗옷은 숨김, 들던 도구는 넣었다가 나오면 다시 듦, 숫자 도구 키 꺼짐).
- 물에 있는 동안 행동 키는 모두 잠수가 받는다(150): 앞이 뭍이면 「나오기」, 아니면 「잠수」, 잠겨 있으면 「떠오르기」. 잠기기 0.45초 → 물속 최대 3.6초 → 떠오르기 0.45초. 물속에서 그림자에 닿으면(0.7 + 크기 × 0.04) 잡고 떠올라 머리 위로 들어 보임(`results.gain` — 아이템 모델 hold).
- 장면 시작·투어 섬 들어가기·시계 옮기기는 곧장 뭍 상태로 되돌린다 (`dive.cut`).
- 이벤트: `dive:enter` · `dive:dive` · `dive:catch {id}` · `dive:leave`. 서비스 `ctx.services.gather.dive` (`active`·`mode`·`creatures`·`swimmable`·`entryPoint`·`exitPoint`·`cut`).

## 파일
- 새: `src/gameplay/gather/dive.js` · `dive-fx.js` · `src/player/swim.js` · `src/data/sea-items.js` · `assets/blender/items_sea.py` · `assets/items/specs/sea-*.json` 20 · `tool-scuba-kit.json` · `assets/clothes/specs/wetsuit.json` · `tests/dive.test.mjs`.
- 고침(줄 몇 개): `items.js` · `economy.js` · `spawns.js` · `museum.js` · `gather/index.js` · `journal/index.js` · `ui/dom.js` · `ui/bag.js` · `player/wear.js` (`SLOT_BONES.suit`·`SLOT_LABEL.suit`, SLOTS 는 그대로) · `outfit-rules.js` (SLOTS 밖 칸 옷은 옷장에 안 들어감) · `build_item.py` (items_sea.py exec 두 줄) · `build_clothes.py` (kind wetsuit) · `tools/build-clothes.mjs` (`EXTRA_SLOTS`) · `tools/res-contracts.mjs` · 데이터 `items.json`·`rules.json`·`journal.json` · 편집기 게시 목록 `assets/story/editor-files.json`·`assets/villagers/editor-files.json` (items.js 가 sea-items.js 를 읽음).
- 모델 22개 모두 **검수 대기 (status review)**: 바다 생물 20 (삼각형 1.0–5.7k) · 스쿠버 키트 3.4k · 잠수복 2.5k. 아쉬운 것: 미역이 넓은 잎 풀처럼 보임 · 대게와 키다리게가 작은 아이콘에서 비슷 · 바닷가재가 작게 · 잠수복 공기통이 옆에서 살짝 떠 보임, 물안경이 큰 안경처럼.
- 개수 박은 테스트(이 브랜치): 아이콘 116→137 · 스펙 103→124 · hold 55→75 · 옷 13→14 · 도구 5→6(손 도구 5) · 박물관 total 54→74.

## 확인
- 테스트: (끝에 적음)
- 개발 서버 4264 (날짜 흉내 저장 칸): 들어가기 → 헤엄(머리만 물 위) → 생물 그림자·물방울 → 잠수 → 물속 화면 → 불가사리·투구게 잡기(가방·도감, 머리 위 모델) → 나오기(도구 키 돌아옴), 잠수복 입음. 이 load 의 4xx 없음.
- 물속 셰이더 비용: 미리 보기 창에서 render+finish 0.8 → 0.9ms (적정).

## 남은 것 · 모르는 것
- 섬 일지 `sea1` 은 키트가 없어도 뽑힌다 (일지 규칙에 조건 칸이 없음 — M13 트랙과 맞춰 `needs` 같은 칸을 둘지).
- 물에 있을 때 저장하고 다시 열면 선착장에서 시작 (뭍 자리가 아니라서 — 원래 규칙), 넣어 둔 도구는 다시 안 듦.
- 박물관 `keepers.js` 의 `CAT_KO`·완성 대사에 바다 생물이 없음, 3D 관 배치 — 박물관 트랙 몫. 바다 생물이 들어오면 `progress().complete`(모두 기증 보상) 기준이 74개로 늚.
- 요소 편집기 표(`elem-editor/sheets.js`)에 바다 생물·스쿠버 키트 칸 없음 — 문서/요소 편집기 쪽에서 더할 것 (`items.json sea`·`scubaKit`). `tools/elem-checks.mjs` 의 아이템 목록에도.
- 리소스 편집기 묶음(`node tools/build-editor-index.mjs`) 다시 만들기·게시는 조정 세션 게시 차례에.

## 문서 세션이 반영할 문장
- CLAUDE.md 「게임 런타임」 행동 키 순위: 「… 줍기 50 · **바다에 들어가기 48** · 심기 45 · 도구 10, 물에 있는 동안은 잠수 **150** 이 모두 받음」.
- CLAUDE.md 새 절 **「잠수 (M16, `src/gameplay/gather/dive.js`)」**: 위 D160–D164 표의 요약 + 「바다는 헤엄치는 동안만 `addZone` 구역(isWalkable false), 자세는 `player/swim.js` 코드 자세, 잠수복 CL-13 은 slot `suit` (옷장·상점에 안 나옴), 물속 셰이더는 높음·적정만」.
- CLAUDE.md 「명령어」 개수: 아이템 모델 103 → **124** (+ 바다 생물 20 · 스쿠버 키트), 옷 12벌 → **13벌 + 잠수복**, `items-assets` 아이템 ID 규칙에 `SE`.
- CLAUDE.md 「리소스 편집기」 수: 아이템 103 → 124 · 옷 13 → 14.
- `docs/CONTRACTS.md` 「M16 잠수」 제안: 서비스 `gather.dive` · 이벤트 `dive:*` · `economy.shopStock().always` · `items.COLLECTIBLE` 에 sea · `wear.js SLOT_BONES.suit`.
- 실내 트랙(상점 진열): `shopStock().always` (지금 `tool.scuba-kit`) 를 늘 보여 줄 것.
