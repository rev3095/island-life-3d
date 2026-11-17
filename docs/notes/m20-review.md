# M20-S4 검수 13 확정 · 편집기 홈 목록 (브랜치 `m20-review`)

main eea6653 에서 갈라짐. `src/`·`tools/build-web.mjs` 는 안 건드림.

## 1. 검수 대기 13 확정
렌더 한 장씩(캐릭터 `_hero.png`, 나머지 `_main.png`) 모아 봄. **고친 것 없음** — 눈에 띄게 깨진 모델 없음.

| 묶음 | 수 | slug |
|---|---|---|
| 새 주민 모델 | 2 | `ssalal` 쌀알 (CH-18) · `boreum` 보름 (CH-19) |
| 등대 | 6 | `lighthouse-dark` · `-repair` · `-lit` · `-scaffold` · `-stairs` · `-lens` |
| 별 등불 | 1 | `star-lantern` |
| 답례 가구 | 4 | `nap-cushion` · `flower-word-frame` · `grandma-cookbook` · `lighthouse-painting` |
| **합** | **13** | |

- 스펙 `"status": "approved"` (version 그대로, M19-P1 과 같은 모양) → `build-character.mjs --index` (19) · `build-env.mjs --index` (97) · `build-furniture.mjs --index` (80).
- 테스트 기대값: `tests/lighthouse.test.mjs` (등대·소품 `approved`) · `tests/m19-stories.test.mjs` (답례 가구 `approved`). 장면(s-*) 검수 대기는 그대로.
- 남은 검수 대기: 주민 파일 2 (쌀알·보름 성격·대화) · 방 배치 2 · 장면 37 — 이번 범위 밖.

## 2. 편집기 홈 「전체 관리」 목록
- 보드 18개(wave5–16 · z5 · sky · interiors · night · tour · shader · newfolk) 의 `applied/<id>` 를 읽어 `--boards` 로 넣음 → `node tools/hub-catalog.mjs --boards … --out ../m20-review-hub`.
- **768줄** (M17 무렵 648 → +120): 캐릭터 19 · 주민 14 · 배경 97 · 가구 108 · 아이템 162 · 벽지 21 · 방 30 · 장면 65 · 소리 46 · 지도 15 · 요소 값 22 · 스타일 3 · 보드 결정 166 (D8–D217, 모두 고른 안 있음). 검수 대기·새로 41.
- 홈 저장소(slug `3afb14a9-…`)에 `catalog/<분류>` 13 + `meta/catalog` 덮어씀, `status/res` 의 `open` 갱신.

## 확인
- `node --test tests/`: 607 · 통과 606 · 실패 0 · 건너뜀 1.

## 남은 것 (조정 세션)
- main 합치기 · 리소스 편집기 다시 게시 (13개가 「확정」으로 바뀐 묶음).
