# M21-P1 — 친구 섬 구경 모델 · 검수 (17차 보드 wave17 반영 v1, D287-A · D280-A)

브랜치 `m21-p1-models` (작업 트리 `../island-worktrees/m21-p1-models`). 저장소·구경 코드는 M21-P2 (`m21-p2-share`) 가 따로 한다.

## 한 일

### 1. 검수 대기 16개 확정
스펙 `status: "review"` → `"approved"`, Blender 없이 `--index` 로 목록만 다시 만듦 (`build-character` · `build-env` · `build-item`).

| 분류 | 확정한 것 |
|---|---|
| 캐릭터 2 | 서쪽 등대 등대지기 윤슬 CH-20 (`assets/specs/yunseul.json`) · 너울 CH-21 (`neoul.json`) |
| 배경 2 | 어선 부두 BD-19-1 (`fish-dock`) · 어선 BD-19-2 (`fish-boat`) |
| 아이템 12 | 먼바다 물고기 IC-OF-01–12 (`fish-alfonsino` · `flying-fish` · `grouper` · `hairtail` · `hammerhead` · `john-dory` · `mahi-mahi` · `marlin` · `rockfish` · `skipjack` · `sunfish` · `yellowtail`) |

- 등대 단계 모델(BD-18 ×3 · PR-41–44, `lighthouse-*`)은 이미 `approved` 였다 — 그대로.
- 눈에 띄게 틀린 것은 없어 스펙 값은 고치지 않았다.
- 리소스 스펙이 아닌 `review` 는 그대로 둠: 주민 파일 `assets/villagers/{yunseul,boreum,ssalal}.json` · 배 설정 `assets/boat/neoul.json` · 방 RM-18·19 · 장면 s29– (스토리·요소 쪽 상태).
- 등대 단계 도토리값(1,000·1,500·2,000·2,500·3,000) · 배삯 🌰300 은 손대지 않음.

### 2. 새 모델 7개 (스펙 `status: "review"`, Blender 빌드)

| ID | slug | 이름 | 분류 | 크기 (stats, X×Y×Z) | 빌더 |
|---|---|---|---|---|---|
| BD-20 | `visit-boat` | 친구 섬 배 | 배경 building · 3×2 | 2.72 × 1.25 × 1.61 | `assets/blender/visit_env.py` |
| PR-45 | `guestbook-stand` | 방명록 받침 | 배경 prop | 0.73 × 0.5 × 1.37 | 〃 |
| PR-46 | `stamp-board` | 방문 도장 판 | 배경 prop | 1.26 × 0.3 × 1.48 | 〃 |
| FU-109 | `friend-island-frame` | 친구 섬 액자 | 가구 · 벽 | | `assets/blender/visit_furniture.py` |
| FU-110 | `guestbook-desk` | 방명록 책상 | 가구 · 1×1 | | 〃 |
| FU-111 | `stamp-flag` | 도장 깃발 | 가구 · 1×1 | | 〃 |
| FU-112 | `ship-model` | 작은 배 모형 | 가구 · 1×1 | | 〃 |

- **친구 섬 배 BD-20**: 어선 BD-19-2 와 같은 몸 모양·갑판 높이(`DECK` 0.18, 원점 = 물 위 기준)·외곽선 0.014. 가운데 객실(민트 벽 · 둥근 창 셋씩 · 긴 의자 둘 · 기둥 넷 · 빨간 지붕 + 물결 차양), 위에 굴뚝 · 돛대 등(`glow`, 밤에 켜짐) · 분홍 깃발, 남쪽 옆구리 구명 튜브 둘. 충돌 `box [2.5, 1.1]`. 원점·방향(+X = 뱃머리, 동쪽)은 어선과 같으니 M21-P2 가 어선 옆에 같은 방식으로 띄우면 된다.
- **방명록 받침 PR-45**: 우편함 옆 나무 기둥 + 비스듬한 판 위 펼친 도장 책(찍힌 도장 셋 · 책갈피 끈) · 옆 선반 도장·인주 · 뒤 작은 지붕. 충돌 `r 0.25`.
- **방문 도장 판 PR-46**: 기둥 둘 + 판, 도장 자리 3×4 (여섯 칸 찍힘 — 빨강·파랑·초록·노랑), 위 리본 띠, 매단 큰 도장, 발치 화분 둘. 충돌 `box [1.2, 0.3]` (처음 1.1 → 리본 꼬리까지 모델 1.26 이라 테스트 「충돌 가로 88%」에 걸려 스펙만 고침).
- 가구 넷은 `src/data/visit-items.js` 의 `VISIT_FURN` (출처 `'visit'`, code = 보드 ID FU-109–112, 값 1,000·1,200·1,000·1,500 · 살 값 0 — 상점·나무 흔들기에 안 섞임) → `items.js` 가 붙인다. 얻는 법 글은 임시 「친구 섬 구경 기념」 — **주는 곳·글은 M21-P2 가 정한다**.
- 글자는 어디에도 넣지 않았다 (이름판·이름표는 빈 판).

### 3. 같이 고친 것
- `tests/assets.test.mjs` 배경 99 → 102 · 가구 80 → 84, `tests/items.test.mjs` 가구 80 → 84.
- `tests/villagers.test.mjs` 주민 행동 지문에서 `VISIT_FURN_IDS` 를 뺀다 (핀 값은 그대로).
- 편집기 게시 목록 `assets/story/editor-files.json` · `assets/villagers/editor-files.json` 에 `src/data/visit-items.js` (items.js 가 import 하므로).
- `node --test tests/` 616 통과 · 0 실패 (커밋 직전).

## 합칠 때 (조정 세션)
- 개수 테스트는 M21-P2 가 따로 늘리면 **main 값 + 두 쪽 더한 값**. 이 브랜치가 더한 것: 배경 +3 · 가구 +4 (아이템 아이콘·스펙 수는 그대로).
- `assets/env/index.json` · `assets/furniture/index.json` · `assets/models/index.json` · `assets/items/index.json` 충돌은 손으로 풀지 말고 `--index`.
- `build_env.py` · `build_furniture.py` 끝 import 줄 하나씩 (`visit_env` · `visit_furniture`).
- 게시: 배경·가구 모델이 7개 늘었으니 `build-web.mjs` 묶음(`PACKS`)에 새 모델이 어느 갈래로 들어가는지 확인 — 배는 동쪽 선착장(어선과 같은 갈래)이 맞고, 가구는 다른 가구와 같은 갈래.

## 문서 세션이 반영할 문장

- CLAUDE.md 「검수」 끝: "2026-11-18 M21-P1 (보드 wave17 D287-A · D280-A) 에 검수 대기 16개(윤슬 CH-20 · 너울 CH-21 · 어선 부두·어선 BD-19 · 먼바다 물고기 IC-OF-01–12) 모두 확정. 새 검수 대기 7개 = 친구 섬 배 BD-20 · 방명록 받침 PR-45 · 방문 도장 판 PR-46 · 친구 섬 기념 가구 FU-109–112 (`docs/notes/m21-p1-models.md`)."
- CLAUDE.md 「명령어」 개수 테스트 줄은 그대로 맞음 (가구 데이터 파일이 하나 늘었다는 것만): "친구 섬 기념 가구는 `src/data/visit-items.js` (`VISIT_FURN`, 출처 `visit`)."
- CLAUDE.md 「에셋 파이프라인」 또는 M21 절이 생기면: "친구 섬 구경 모델 빌더는 `assets/blender/visit_env.py` (BD-20 · PR-45–46) · `visit_furniture.py` (FU-109–112)."
- `concept/README.md` 리소스 목록(있다면): 배경 102 · 가구 84.
- devlog 「현재 상태」: "M21-P1 모델·검수 끝 (브랜치 `m21-p1-models`) — 16개 확정 · 새 모델 7개 검수 대기."
