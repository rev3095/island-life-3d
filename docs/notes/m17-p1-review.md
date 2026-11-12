# M17-P1 검수 확정 (브랜치 `m17-p1-review`, 보드 wave14 D187-A)

14차 검수 보드 반영 v1 — D180-A 「다듬기·검수 확정·밸런스」, D187-A 「검수 대기 116개를 묶음별로 모두 확정하고 고칠 후보만 다시 만듦」(사용자 의견 없음, 추천안). main 900016e 에서 갈라짐. 점검 포트 4281.

## 한 것

### 1. 고칠 후보 다시 만들기 (`docs/notes/m16-dive.md` 「파일」의 아쉬운 점)
| ID | 아쉬운 점 | 고친 것 | 고친 곳 |
|---|---|---|---|
| IC-SE-01 미역 | 넓은 잎 풀처럼 보임 | 길고 가장자리가 주름진 **갈색 띠** 세 가닥 + 가운데 굵은 잎맥. 새 도우미 `ruffle_strip()` (가운데 평평 · 가장자리로 갈수록 u²×sin 으로 앞뒤 출렁임). 키 0.4→0.6, 갈래 5→3, 너비 0.11→0.075, 새 칸 `ruffle` 0.9, 팔레트 올리브 녹색 → 짙은 갈색 (`#5E4423` 등) | `items_sea.py b_seaweed`·`ruffle_strip` · 스펙 v0.2 |
| IC-SE-15 대게 | 키다리게와 작은 아이콘에서 비슷 | **넓고 납작한 몸** (너비 0.17→0.26, 높이 비 0.3→0.17) · 짧고 굵은 다리 (길이 0.3→0.19, 굵기 0.014→0.017, 무릎 낮게) · 색 주황 → **모래 황갈색** `#C99252` | 스펙만 v0.2 |
| IC-SE-16 키다리게 | 〃 | **아주 작은 몸** (너비 0.12→0.085) + **아주 긴 가는 다리** (0.38→0.52, 범위 max 0.45→0.7, 굵기 0.0055) · 긴 집게 팔 · 전체 크기 0.8 (손에 들 크기 0.9칸 한도 — `items-assets.test`) · 색 **붉은 주황 + 흰 돌기** `#C8432C` | 스펙만 v0.2 |
| IC-SE-10 바닷가재 | 작게 보임 | 몸 길이 0.36→0.44 · 굵기 0.13→0.14 · **집게 1→1.7** (범위 max 2). 집게가 클수록 팔을 굵게·양옆으로 벌려 두 집게가 겹치지 않게 (`claw > 1` 일 때만 — 단새우는 그대로). 아이콘 각도 yaw −70 → −40·pitch 28 (두 집게가 다 보이게). 크기 0.59 → 0.86칸 | `items_sea.py b_shrimp` 집게 4줄 · 스펙 v0.2 |
| CL-13 잠수복 | 공기통이 옆에서 떠 보임 · 물안경이 큰 안경 같음 | **물안경 → 두 눈을 한 장으로 덮는 작은 마스크** (얼굴 겉을 따라 도는 둥근 네모 테 + 코 위 홈 + 렌즈 반짝임 둘, 칸 `maskSide` 0.12 · `maskHeight` 0.2). **공기통은 높이마다 등 겉을 재서 기울여 세우고** 받침판 + 허리띠 + 가슴까지 내려오는 어깨 끈으로 묶음. 삼각형 2,530 → 2,810 (예산 3,000 안) | `build_clothes.py` wetsuit 갈래 · 스펙 v0.2 |

- 빌드: `node tools/build-item.mjs sea-seaweed sea-snow-crab sea-spider-crab sea-lobster` · `node tools/build-clothes.mjs wetsuit` (아이콘·렌더 같이 다시 만듦).
- 스크린샷 (공유 노트 폴더 `m17-p1-review-shots/`): Blender 렌더 전후 `before-items.png`·`after-items.png` · 아이콘 전후 `before-icons.png`·`after-icons.png` · 잠수복 `before-wetsuit.png`·`after-wetsuit.png` · 개발 서버 4281 리소스 편집기 3D 보기 `dev-seaweed.png`·`dev-snow-crab.png`·`dev-spider-crab.png`·`dev-lobster.png`·`dev-wetsuit.png` (모두 「확정」 표시, 콘솔 오류 0).

### 2. 묶음 확정 116개 (D187-A)
확정 값은 기존 확정 리소스와 같은 **`"status": "approved"`** (리소스 편집기·홈 「전체 관리」가 읽는 값, `version` 은 그대로 — 7f69c21 「확정: 행사 모델 16 · 행사 장면 s13–s16」과 같은 모양). 생성 목록은 손으로 풀지 않고 `--index` 로 다시 씀: `build-env` · `build-furniture` · `build-furniture --fixtures` · `build-item` · `build-clothes` · `build-character` `--index`. 방 목록 `assets/interior/index.json` 은 `--index` 도구가 없어서 그 줄의 status 만 같게 고침 (`tests/interior.test.mjs` 가 파일과 목록이 같은지 본다). 장면은 「스토리 반영」의 확정 방식대로 장면 파일 `status` 만 `approved` (글·`pick` 은 그대로, version 그대로).

| 묶음 | 수 | ID |
|---|---|---|
| 바다 생물 | 20 | IC-SE-01–20 |
| 도구 | 2 | IC-TL-07 스쿠버 키트 · IC-TL-06 새총 |
| 미술품 | 16 | IC-AR-01–16 |
| 재료 | 2 | IC-MA-11 별 조각 · IC-MA-12 레시피 쪽지 |
| 가구 | 10 | FU-63–66 · FU-71–73 · FU-75·76 · FU-78 |
| 붙박이 | 16 | FU-67–70 · FU-74 · FU-77 · FU-79–88 |
| 건물 | 8 | BD-11 · BD-12-1·2·3 · BD-13 · BD-14 · BD-15 · BD-16 |
| 소품·놓는 것 | 6 | PR-33 · PR-34 · PR-35 · PR-40 · TI-13 · TI-14 |
| 방 | 16 | RM-08 · RM-09 · RM-15–22 · RM-25–30 |
| 무늬 | 1 | WP-09 |
| 캐릭터 | 6 | CH-01 (주인공 스펙) · CH-16 송이 · CH-17 살랑 (스펙) · CH-11 구름 · CH-12 파도 · CH-13 달무리 (주민 파일) |
| 옷 | 1 | CL-13 잠수복 |
| 장면 | 12 | s17–s28 |
| **합** | **116** | |

- 확정 뒤 `assets` 아래 status `review` 0 (리소스 편집기 머리 「검수 대기 0」). 전체 `approved` 617 → 733 (생성 목록 줄 포함).

### 3. 확인
- `node --test tests/`: **531 · 통과 531 · 실패 0 · 건너뜀 0**. 개수를 박아 둔 테스트는 바꿀 것 없음 (리소스 수는 그대로, status 만 바뀜). 처음 돌렸을 때 걸린 둘: 잠수복 모델 version 이 스펙 v0.2 와 달랐음(다시 빌드) · 키다리게 1.05칸이 손에 들 크기 0.9칸 넘음(크기 0.8).
- `node tools/build-editor-index.mjs`: 리소스 편집기 게시 파일 121개 · 232.02MB (한도 511개 · 256MB), 배경 편집기 77개. 삼각형 예산 넘음 경고에 잠수복이 처음엔 3,138 이었다가 줄여서 빠짐 (남은 경고 gureum·pado·yeomyeong·songi·museum·raincoat 는 예전 그대로).

## 남은 것
- **게시는 안 함** (조정 세션 게시 차례): 리소스 편집기 다시 게시 (`dist/res-editor/publish.json`, 바뀐 모델 5 + 목록), 스토리 편집기(장면 12 status), 게임 링크 (모델 5 — `items`·`clothes` 묶음).
- 편집기 홈: `catalog/*` 다시 쓰기 (`node tools/hub-catalog.mjs`), `status/res`·`status/story`, 스토리 `applied/story` +1 · `history/story-v<n>` (장면 s17–s28 확정, commit = 이 브랜치 합친 커밋). 홈 `manage` 에 남은 확정 요청이 있으면 `done`.
- 게임 안에서 잡아 머리 위로 들어 보이는 모습(바닷가재·키다리게가 커짐)은 리소스 편집기 3D 보기로만 봤다 — 잠수 단계 자동 플레이(`--only=…,dive`)는 안 돌림.
- 미역은 정면에서 띠 셋이 겹쳐 조금 어수선하다 — 더 고치려면 `ruffle`·`blades` 칸으로.

## 문서 세션이 반영할 문장
- CLAUDE.md 「편집기와 "요청 확인" 흐름」 확정 문단 끝: 「2026-11-13 M17-P1 (보드 wave14 D187-A) 에 검수 대기 116개를 모두 확정 (바다 생물 20 · 도구 2 · 미술품 16 · 재료 2 · 가구·붙박이 26 · 건물·소품·놓는 것 14 · 방 16 · 무늬 1 · 캐릭터 6 · 옷 1 · 장면 12) — 검수 대기 0.」
- CLAUDE.md 「잠수 (M16)」 끝: 「잠수복 CL-13 v0.2 = 한 장 마스크 + 등에 붙은 공기통 (M17-P1)」.
- `docs/notes/m16-dive.md` 「파일」의 「아쉬운 것」 줄 끝: 「→ M17-P1 에서 미역·대게·키다리게·바닷가재·잠수복 다시 만들고 확정 (`docs/notes/m17-p1-review.md`)」.
- `docs/notes/story.md` 이력 표: 「v? | 2026-11-13 | s17–s28 확정 (status approved, 보드 wave14 D187-A) | (합친 커밋)」.
- 바깥 `Subculture projects/.claude/launch.json` 에 미리보기 설정 `m17-p1-review` (포트 4281) 를 더했다 (저장소 밖).
