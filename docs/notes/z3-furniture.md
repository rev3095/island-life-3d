# Z3 새 가구·소품 (5차, 브랜치 `p8-furniture`)

검수 보드 wave5 (https://claude.ai/artifact/QmguFLRgBq2FUa3RnD8RbT, `concept/wave5-board.html` 의 `FURN`·`PROPS` 와 SVG 스케치) 의 FU-21–33 · PR-10–12 를 Blender 모델로 만들었다. 새 스펙은 모두 `status: "review"` (검수 대기).

## 가구 13종 (`assets/furniture/`, 아이템 id = `furn.<slug>`)

| ID | slug | 이름 | 칸 | 얻는 법 (items.js source) | 변형·동작 | 삼각형 |
|---|---|---|---|---|---|---|
| FU-21 | surfboard | 서핑보드 | 1×1 | 코코 친밀도 선물 (friend) | | 2560 |
| FU-22 | ball-basket | 공 바구니 | 1×1 | 상점 1,200 (shop) | | 5492 |
| FU-23 | cushion-bed | 쿠션 침대 | 2×2 | 보리 친밀도 선물 (friend) | | 2448 |
| FU-24 | bone-cushion | 뼈다귀 쿠션 | 1×1 | 상점 1,000 (shop) | | 3596 |
| FU-25 | flower-shelf | 꽃 선반 | 2×1 | 제작: 나무 6 · 꽃 4 (craft) | 꽃 색 mix·pink·purple·yellow·white | 7684 |
| FU-26 | terrarium | 유리 온실 | 1×1 | 모찌 친밀도 선물 (friend) | | 3626 |
| FU-27 | rod-rack | 낚싯대 걸이 | 벽 | 두부 친밀도 선물 (friend) | | 2632 |
| FU-28 | wood-stove | 나무 난로 | 1×1 | 제작: 철광석 4 · 나무 4 (craft) | flicker, 불 창 재질 `glow` = 밤에 빛남 | 2100 |
| FU-29 | kitchen-counter | 조리대 | 2×1 | 퐁 친밀도 선물 (friend) | | 3208 |
| FU-30 | fruit-basket | 과일 바구니 | 1×1 | 제작: 과일 5 (craft) | 과일 apple·pear·peach·cherry·orange | 5432 |
| FU-31 | umbrella-stand | 우산꽂이 | 1×1 | 상점 1,120 (shop) | | 2766 |
| FU-32 | lotus-chair | 연잎 의자 | 1×1 | 초롱 친밀도 선물 (friend) | | 4272 |
| FU-33 | birthday-cake | 생일 케이크 | 1×1 | 생일 선물 (birthday — 새 source 값) | flicker (촛불 `flame`) | 5828 |

- 제작 셋은 `src/data/recipes.js` 끝에 추가 (꽃·과일은 카테고리 아무거나).
- 아이템 code 는 FURN 표 순서라 FU-21–33 이 그대로 붙는다. `icon` 은 기존 가구 줄과 같은 썸네일 경로 (`FURN.map` 줄은 건드리지 않음).
- 유리 온실은 앞 유리 없이 살만 두고 뒤쪽 반만 `glass` 판을 둔다 (곤충 상자와 같은 방식 — 게임 재질이 불투명해도 안의 화초가 보인다).

## 배경 소품 3종 (`assets/env/specs/`, category prop)

| ID | slug | 이름 | 크기 (가로×깊이×높이) | world |
|---|---|---|---|---|
| PR-10 | moving-boxes | 이삿짐 상자 | 1.09×0.55×0.79 | `collider.box [1.1, 0.56]`, extent `[0.6, 0.32]` |
| PR-11 | party-balloons | 파티 풍선 장식 | 1.69×0.42×1.88 | 기둥 둘·선물 상자 `circles`, extent `[0.85, 0.2]`. 꼬마전구 재질 `glow` (밤에 등불 빛무리) |
| PR-12 | lot-sign | 집터 표지판 | 2.74×2.77×0.99 | 원점 = 집터(3×3) 가운데. 네 귀퉁이 말뚝 + 앞 가운데 팻말 `circles`, extent `[1.4, 1.4]` |

- `lot-sign` 의 '집터' 글자는 윈도 맑은 고딕(`C:/Windows/Fonts/malgunbd.ttf`)을 메시로 바꾼 것. 글꼴이 없는 기계에서 다시 빌드하면 집 그림으로 대신한다.
- 주민 집 `house-villager` 에 `danpung` 변형 (지붕 #D9583B, 보드 D13) — version 0.2, status review. 코코 기본 지붕(#E86A5B)과 꽤 비슷한 빨강이라 섬에서 구별이 잘 안 되면 색을 다시 고를 것.

## 다른 트랙에 제안

- **Z2 (house)**: 벽 가구(`rod-rack`)는 `house.place(item)` 만으로는 플레이어가 벽을 바라볼 때만 자리가 난다 — 주민 방 배치표에는 `{ wall: 'n', slot }` 처럼 자리를 직접 주면 된다. 꽃 선반·과일 바구니는 `variant` 로 색을 고를 수 있다 (`mix`·`pink`… / `apple`·`orange`…).
- **Z4 (town)**: 친밀도 선물 가구는 `source: 'friend'` 이고 주인 주민은 얻는 법 글자(`from`, 예: '코코 친밀도 선물')에만 있다. 코드에서 주민으로 고르려면 FURN 표에 주민 칸을 하나 더 두는 것을 제안 (items.js `FURN.map` 줄을 함께 고쳐야 해서 이번엔 하지 않음). 생일 케이크는 `source: 'birthday'`.
- **Z4**: 소품 slug 는 `moving-boxes` · `party-balloons` · `lot-sign`. `lot-sign` 은 주민 집과 같은 3×3 집터 가운데에 놓으면 말뚝이 집터 귀퉁이에 선다.
- `tests/items.test.mjs` 의 가구 개수(20 → 33)도 이 트랙에서 맞췄다.
