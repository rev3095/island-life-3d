# 포근섬 이야기 개발 계획

웹 브라우저에서 바로 하는 3D 섬 생활 게임. 리소스(캐릭터 9종, 배경 32종)는 Blender 파이프라인으로 만들었고, 이제 게임을 만든다.

## 개발 단계 (P1 ~ P6)

| 단계 | 이름 | 끝나면 할 수 있는 것 | 주요 내용 |
|---|---|---|---|
| **P1** | 섬과 이동 | 섬을 걸어 다닐 수 있다 | 64×56 섬 생성(타일맵), 지형·물·절벽·경사로, 곡면 월드, 배경 요소 배치, 충돌, 플레이어 이동·애니메이션, 카메라, 키보드·터치 |
| **P2** | 채집과 가방 | 잡고 줍고 가방에 담는다 | 도구 5종, 나무 흔들기·과일, 낚시 미니게임, 곤충 채집, 화석 파기, 바위 치기, 줍기, 가방 20칸, 도토리 |
| **P3** | 주민과 가게 | 주민과 이야기하고 사고판다 | 주민 6명 배회·대화·목소리, 도토리상점, 박물관 기증·도감, 부탁, 친밀도 |
| **P4** | 집과 제작 | 집을 꾸미고 다시 접속해도 이어진다 | 집 실내, 가구 배치·회전, 작업대 레시피, 자동 저장·불러오기, 매일 리셋 |
| **P5** | 시간과 분위기 | 밤·비·가을 분위기가 난다 | 실제 시계, 하늘·조명·밤 조명, 계절 팔레트, 비·눈·무지개, 배경음·효과음 |
| **P6** | 마무리와 배포 | 링크로 바로 플레이 | 휴대폰 조작 다듬기, 성능, 첫날 안내, 웹 링크 배포 |

## 병렬 개발 방식

단계가 서로 기대는 부분(P2는 P1의 섬 위에서 동작)이 있어서, **기능 단계가 아니라 '파일이 겹치지 않는 시스템' 단위로 나눠** 동시에 만든다.
공용 기반(`src/core/`, `src/main.js`, 이 문서와 `docs/CONTRACTS.md`)은 `main` 브랜치에 먼저 올리고, 각 트랙은 자기 브랜치·자기 폴더에서만 작업한다.
모듈끼리는 `docs/CONTRACTS.md` 의 이벤트·서비스 약속으로만 주고받으므로, 다른 트랙이 없어도 각자 데모 페이지로 확인할 수 있다.

### 1차 (지금 동시 진행)

| 트랙 | 브랜치 | 폴더 | 담당 단계 | 결과물 |
|---|---|---|---|---|
| T1 섬 월드·플레이어 | `p1-world` | `src/world/`, `src/player/` | **P1 전체** | `index.html` 에서 섬을 걸어 다님 |
| T2 데이터·채집 규칙·저장 | `p2-data` | `src/data/`, `tests/` | P2·P3·P4 의 규칙 | 아이템 DB, 출현표, 가방·지갑, 저장, 하루 리셋 + 테스트 |
| T3 UI | `ui-system` | `src/ui/`, `demos/ui.html` | P2~P4 화면 | HUD, 대화창, 가방, 섬폰, 상점·박물관 창 |
| T4 사운드 | `audio` | `src/audio/`, `demos/audio.html` | P5 소리 | 합성 배경음 9곡, 효과음 16종, 주민 목소리 9종 |
| T5 시간·날씨·하늘 | `sky-time` | `src/sky/`, `demos/sky.html` | P5 분위기 | 시계, 계절, 하늘·조명, 비·눈 |

### 2차 (1차 합친 뒤, 지금 동시 진행)

| 트랙 | 브랜치 | 고치는 곳 (여기만) | 결과물 |
|---|---|---|---|
| W1 P2 채집 연결 | `p2-gather` | `src/gameplay/gather/`, 그리고 `src/player/`·`src/world/` (도구 동작, 매일 다시 놓기) | 도구 5종·낚시·곤충·화석·나무 흔들기·바위·줍기를 실제로 플레이 |
| W2 P3 주민·상점·박물관 | `p3-town` | `src/gameplay/town/` | 주민 6명 배회·대화·목소리·친밀도·부탁, 밤톨 상점, 느루 박물관 |
| W3 P4 집·가구·제작 | `p4-house` | `src/gameplay/house/`, `assets/furniture/`, `assets/blender/build_furniture.py`, `tools/*furniture*`, `src/sky/` (실내 모드만) | 집 실내, 가구 20종 모델, 배치·회전, 작업대 제작, 저장 이어하기 |
| W4 스타일 셰이더 | `stylized-shader` | `src/core/materials.js`, `src/render/`, `src/main.js` (그리기 부분), `demos/style.html`, `docs/SHADERS.md` | 모델은 그대로 두고 동숲풍 3D 스타일 셰이더·후처리, 비교·조절 페이지 |

행동 키(Space·F)는 `ctx.services.gameplay.interactions` 우선순위로 나눠 받는다 (`docs/CONTRACTS.md` 2차 준비).

### 3차 (2차 후속을 합친 뒤 — P6 마무리와 배포, 2026-10-29 시작)

`main` 1b200c4 에서 갈라진다. 포트는 작업 트리마다 다르게 (`node dev-server.mjs --port=…`).

| 트랙 | 브랜치 · 포트 | 고치는 곳 (여기만) | 결과물 |
|---|---|---|---|
| X1 휴대폰·조작 | `p6-mobile` · 4195 | `src/core/input.js`, `src/ui/` (모든 창·HUD·`ui.css`), `index.html` 의 `<head>`·viewport | 터치 조이스틱·A/B 버튼 크기·위치·눌림 표시, 세로/가로 화면과 안전 영역, 가방·섬폰·대화·상점·제작 창 터치, 가방에서 가구 변형 색 이름 보이기, 휴대폰 크기에서 채집·대화·가구 놓기 끝까지 |
| X2 성능·카메라·섬 경관 | `p6-perf` · 4196 | `src/player/camera.js`, `src/render/`, `src/world/` | 카메라 각도(하늘이 조금 더), 카메라와 플레이어 사이 나무 반투명, 해안선 다듬기·바다 물결, 그리기 호출·프레임 시간 줄이기, 저사양 자동 판단 |
| X3 첫날 흐름 | `p6-firstday` · 4197 | `src/gameplay/intro/` (새 폴더), `src/gameplay/index.js` 의 하위 모듈 목록 한 줄, `src/gameplay/town/keepers.js` · `lines/bamtol.js` 의 첫날 안내 | 플레이어·섬 이름 정하기 → 밤톨 안내 → 도구 들기 → 첫 채집 → 첫 판매·기증 → 집 들어가기까지 이어지는 첫날 할 일(체크리스트)과 보상 |
| X4 웹 배포 | `p6-deploy` · 4198 | `tools/build-web.mjs` (새), `dist/` (새), `src/core/assets.js` | 게임을 claude.ai 아티팩트 한 페이지 + 파일들로 묶는 빌드, 파일 수·용량 표, 로딩 화면, 저장은 브라우저 저장소. **게시는 조정 세션이 합친 뒤에** |

겹치면 안 되는 곳: X1 만 `src/ui/` 를 고친다 (X3 의 이름 정하기 창은 `src/gameplay/intro/` 안에 자기 DOM 으로). X2 만 `src/world/`·`src/render/` 를 고친다. 다른 트랙 파일이 꼭 필요하면 `docs/notes/<트랙>.md` 에 제안으로 적는다.

### 4차 (2026-10-29 — 다듬기와 콘텐츠, 새 모델·그림 없이)

`main` 에서 갈라진다. 새 모델·그림이 필요한 일(주민 집 안, 도구 아이콘 D2, 새 가구)은 검수 보드를 먼저 보여 준 뒤 5차로 미룬다. → 5차 검수 보드 v0.5: `concept/wave5-board.html` (https://claude.ai/artifact/QmguFLRgBq2FUa3RnD8RbT), 승인 뒤 트랙 Z1–Z4.

| 트랙 | 브랜치 · 포트 | 고치는 곳 (여기만) | 결과물 |
|---|---|---|---|
| Y1 조작 안내·편의 | `p7-ux` · 4201 | `src/gameplay/index.js`, `src/core/input.js`, `src/ui/`, `src/data/save.js`, `src/gameplay/intro/` | `interactions.peek(intent)` + 이름→글자 표로 A·B 버튼 글자가 상황에 맞게('말 걸기'·'흔들기'·'들어가기'·'줍기'), 키보드 화면 아래 같은 힌트, 섬폰에 내 이름·섬 이름과 이름 다시 정하기, `save.reset()` 이 모든 칸(편지 등)을 지우게, 저장 실패 알림 |
| Y2 채집 콘텐츠 | `p7-content` · 4202 | `src/gameplay/gather/`, `src/data/items.js`·`museum.js`·`spawns.js`·`harvest.js`, `src/gameplay/town/keepers.js`·`lines/neuru.js` | 화석 감정(파면 '알 수 없는 화석' → 느루가 감정), 큰 물고기 줄 당김, 곤충 들추기(바위 → 쥐며느리, 나무 흔들기 → 떨어지는 곤충), 잡은 물고기 종별 색 |
| Y3 그리기 다듬기 | `p7-render` · 4203 | `src/core/materials.js`, `src/render/`, `src/world/`, `src/player/index.js`, `src/gameplay/town/actor.js`, `src/gameplay/house/furniture.js` | 캐릭터 툰 부품 합치기(그리기 호출 줄이기), 디더 가림을 materials 공용으로(주민·가구도 비치게), 강 둑·풀/모래 경계 부드럽게, 그림자에 바람 |

겹치면 안 되는 곳: data 는 Y1 이 `save.js` 만, Y2 가 나머지. town 은 Y2 가 `keepers.js`·`lines/neuru.js` 만, Y3 가 `actor.js` 만. 다른 트랙 파일이 꼭 필요하면 `docs/notes/<트랙>.md` 에 제안으로 적는다.

## 합치기

각 트랙은 자기 브랜치에 커밋만 하고, 합치기(merge)는 사용자 확인 후 `main` 에서 한다.
합칠 때 `src/main.js` 의 `MODULES` 순서대로 모듈이 자동으로 붙는다.
