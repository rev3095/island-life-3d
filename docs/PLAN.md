# 포근섬 이야기 개발 계획

웹 브라우저에서 바로 하는 3D 섬 생활 게임. 리소스(캐릭터 9종, 배경 32종)는 Blender 파이프라인으로 만들었고, 이제 게임을 만든다.

## 마일스톤 (M · P 번호, 2026-10-29 부터 이 번호로 부른다)

**M** = 마일스톤(끝나면 할 수 있는 큰 목표, 차수와 거의 같다), **P** = 그 안의 단계(트랙 하나 = P 하나). 부를 때는 `M4-P2` 처럼. 괄호 안은 세션·브랜치에서 쓰는 트랙 이름.

| M | 이름 | 상태 | P (단계) |
|---|---|---|---|
| **M0** | 리소스 기초 | ✅ 10-28 | P1 캐릭터 9 파이프라인·캐릭터 편집기 · P2 배경 32 파이프라인·배경 편집기 · P3 컨셉 보드 v0.1 |
| **M1** | 기본 게임 (1·2차) | ✅ 10-28 | P1 섬과 이동(T1) · P2 데이터·저장(T2) · P3 UI(T3) · P4 사운드(T4) · P5 시간·날씨(T5) · P6 채집(W1) · P7 주민·상점·박물관(W2) · P8 집·가구 20·제작(W3) · P9 동숲풍 셰이더·스타일 편집기(W4) |
| **M2** | 휴대폰·웹 배포 (3차) | ✅ 10-29 | P1 휴대폰 조작(X1) · P2 성능·카메라·해안(X2) · P3 첫날 흐름(X3) · P4 웹 배포(X4) → 게임 링크 v2 |
| **M3** | 다듬기 (4차) | ✅ 10-29 | P1 조작 안내(Y1) · P2 채집 콘텐츠(Y2) · P3 그리기 다듬기(Y3) → v3 · P4 리소스 61종 임시 확정·교체 준비 → v4 |
| **M4** | 섬 생활 확장 (5차) | ✅ 10-29 합침 → 게임 v6 | P1 아이템 모델·아이콘 93(Z1) · P2 벽지·바닥·주민 방(Z2) · P3 새 가구 13·소품 3(Z3) · P4 이사·생일·단풍(Z4) · P5 시나리오 편집기·장면 12(스토리 v1) · P6 합치기 → 편집기 재게시 → 게임 v5 |
| **M5** | 축제와 엔딩 | 🔶 1차 합침 10-29 → 게임 v9 (보드 z5 반영 v1, 결정은 `assets/festival/config.json`). 남은 것: 축제 곡(P4 형식)·광장 자리 맞추기 등 Z5 notes "합친 뒤" | P1 Z5 검수 보드 ✅ · P2 이모티콘 대화 · P3 축제 광장·부스·부품 3D · P4 부스 해금·상호작용 · P5 축제·단체 사진 엔딩 · P6 엔딩 뒤 계속(해마다 축제) · P7 장면 05~12 를 실제 이벤트에 연결(스토리) |
| **M6** | 편집기 완성 (6차) | 🔶 P0·P1·P2·P4·P5·P6 합침 10-29 (게임 v9 = 묶음 160파일), P3 남음 | P0 묶음 파일(파일 511 한계) · P1 편집기 홈·전체 요청·반영 기록 공용 · P2 배경 편집기 아이템·실내 탭·방 배치 · P3 성격·대화 탭(M5-P2 뒤) · P4 곡·효과음 편집기 · P5 지도·숫자 편집기 · P6 스타일 편집기 게시 |
| **M7** | 출시 준비 (7차) | 예정 | 처음부터 엔딩까지 플레이 확인, 도토리·출현 밸런스, 실제 휴대폰·다른 GPU, 성능, 접근성(색만으로 구분하지 않기), 저장 옮기기, 공유 |

순서: M4 합치기 ✅ → M5 구현 (광장 넓히기는 M6-P5 합친 뒤, 축제 곡은 M6-P4 합친 뒤, 게시는 M6-P0 합친 뒤)(이모티콘 대화가 town 을 고치므로 Z4 합친 뒤) → M6 의 대화 편집은 M5-P2 뒤, 나머지 M6 는 M5 와 함께 가능.

## 개발 단계 (P1 ~ P6) — 지금은 M1·M2 의 P 로 들어감

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

### 5차 (2026-10-29 — 검수 보드 반영 v1 대로)

검수 보드 `wave5` 반영 v1: **D8-B 3D 렌더 아이콘** · D9-A 주민마다 테마 방 · D10-A 새 주민 1명 이사 · D11-A 주민+플레이어 생일 · D12-A 벽지·바닥은 상점에서 매일 · D13 새 주민 = 단풍(여우, CH-10). 의견 없음. ID 는 보드 기준 (https://claude.ai/artifact/QmguFLRgBq2FUa3RnD8RbT). `main` 에서 갈라진다.

| 트랙 | 브랜치 · 포트 | 고치는 곳 (여기만) | 결과물 |
|---|---|---|---|
| Z1 아이템 모델·아이콘 | `p8-items` · 4211 | `assets/items/` (새), `assets/blender/build_item.py` (새), `tools/build-item.mjs` (새), `src/data/items.js` 의 **`icon` 자리만**, `src/gameplay/gather/results.js`·`bugmodels.js`·`meshes.js`, `tests/items-assets.test.mjs` (새) | IC 93개를 3D 모델 렌더 썸네일로 (물고기 20·곤충 22·화석 9 새 모델 + 도구·재료·씨앗·과일·조개·꽃), 잡은 것 들어 보일 때 같은 모델 |
| Z2 벽지·바닥·주민 방 | `p8-interior` · 4212 | `assets/interior/` (새: 벽지 WP-01–08·바닥 FL-01–08 스펙, 방 RM-01–06 배치), `src/gameplay/house/`, `src/ui/shop.js` (벽지·바닥 코너) | 방 색을 스펙으로, 플레이어 집 벽지·바닥 바꾸기(상점에서 매일 하나), 주민 집 문으로 들어가기·주민 방 6곳 (새 가구 FU-21–32 는 id 로 두고 없으면 임시 상자) |
| Z3 새 가구·소품 | `p8-furniture` · 4213 | `assets/furniture/` (FU-21–33), `assets/blender/build_furniture.py`, `assets/env/specs/` 의 PR-10–12 · `house-villager` 변형 하나, `assets/blender/build_env.py`, `src/data/items.js` 의 **`FURN` 표만**, `src/data/recipes.js` | 가구 13개·소품 3개 Blender 모델·렌더(스펙 `world` 칸 포함), 단풍 집 지붕색 변형, 제작 레시피 |
| Z4 이사·생일·새 주민 | `p8-town` · 4214 | `src/gameplay/town/`, `src/data/birthdays.js` (새), `src/core/constants.js` 의 `VILLAGERS`, `src/world/island.js` (7번째 집터), `src/ui/phone.js` (플레이어 생일), `assets/specs/danpung.json` (새) · `assets/blender/build_character.py` (여우 FEATURES) | 단풍(CH-10) 모델, 빈 집터 → 이삿짐 → 입주 흐름, 주민 생일 파티·선물 3배·편지, 플레이어 생일, 주민이 자기 방 안에 있기 (house 가 주는 `house:enter` 이벤트) |

**5차 추가 (2026-10-29 사용자 요청)** — 둘 다 검수 보드·편집기로 먼저 고르게 한 뒤 만든다.

| 트랙 | 브랜치 · 포트 | 단계 | 결과물 |
|---|---|---|---|
| Z5 축제·이모티콘 대화·엔딩 | `p8-festival` · 4215 | ① 지금: Z5 검수 보드 (`concept/z5-festival-board.html`, 보드 id `z5`) — 대화 방식·이모티콘 팔레트·축제 광장·부스 5·부품 5·엔딩 사진·엔딩 뒤 계속하기의 선택지와 ID 붙은 3D 리소스 스케치. ② 사용자가 고른 뒤 + Z4 합친 뒤(town·world 를 Z4 가 고치는 중): 구현 | 섬 가운데 축제 광장, 주민과 **이모티콘으로 소통**(everyones_festival 방식, 규칙 판정·유료 API 없음), 축제 부품 5개 → 부품마다 부스·세부 공간 해금·상호작용, 5개 다 모으면 축제 → 주민들과 단체 사진 엔딩, 엔딩 뒤에도 채집·탐험·수집 계속 |
| 스토리 (고정 세션) | `story` · 4216 | 계속: 사용자가 시나리오·스토리보드·연출을 편집기처럼 고르고 고치고 적용 | 시나리오 편집기 아티팩트(`story-editor.html`, db) + 장면 데이터 `assets/story/` + 장면 재생기 `src/gameplay/story/` (카메라·배우·이모티콘 말풍선·화면 전환·음악). 게임 시작부터 엔딩까지 |

겹치면 안 되는 곳: `src/data/items.js` 는 Z1 이 `icon` 자리, Z3 가 `FURN` 표만. `src/ui/` 는 Z2 가 `shop.js`, Z4 가 `phone.js` 만. house ↔ town 은 이벤트·서비스로만 (`docs/notes/<트랙>.md` 에 약속 제안). 편집기 화면(`editor.html`·`bg-editor.html`)은 고치지 않는다 — 새 탭(아이템·벽지)은 조정 세션이 합친 뒤에. 새 리소스는 모두 스펙 파일로 두고 리소스 교체 약속(`docs/CONTRACTS.md` 끝)을 지킨다.

### 6차 = M6 편집기 완성 (2026-10-29 — 검수 보드 wave6 반영 v1: D26–D35 모두 추천안 A, 임시)

보드 https://claude.ai/artifact/Lz3rV3HxTzQVV4RJt1DYvU. `main` 82239d2 에서 갈라진다. **P0 은 보드 밖에서 더한 것**: 게임 웹 빌드가 510파일로 아티팩트 한 버전 한계(511)에 닿았고, D28-A(배경 편집기 아이템 탭)도 파일 수가 넘쳐서.

| P | 브랜치 · 포트 | 고치는 곳 (여기만) | 결과물 |
|---|---|---|---|
| M6-P0 묶음 파일 | `p9-pack` · 4221 | `tools/build-web.mjs`, `src/core/assets.js`, `src/ui/dom.js` 의 `iconEl` 만, `dev-server.mjs` 의 `/artifact/`, `docs/notes/deploy.md`, `tests/build-web.test.mjs` | 게임 게시본의 JSON·모델·그림을 묶음 파일 몇 개로 (게시 파일 수 150 아래), 로더가 묶음에서 꺼내 쓰기, 개발 서버(`/index.html`)는 그대로 |
| M6-P1 편집기 홈 (ET-01 · ET-11) | `p9-hub` · 4222 | `editors.html` (새), `concept/board-kit.js`, `concept/README.md`, `CLAUDE.md` 의 편집기 절 | 편집기 홈 아티팩트, "전체 요청 확인" 순서, 모든 편집기가 같이 쓰는 반영 기록 모양 |
| M6-P2 배경 편집기 탭 (ET-02 – ET-04) | `p9-bgtabs` · 4223 | `bg-editor.html`, `tools/build-editor-index.mjs` | 아이템 탭(82 모델 — 편집기 묶음 파일로), 실내 무늬 탭, 방 배치 격자 |
| M6-P3 성격·대화 탭 (ET-05) | (M5-P2 뒤) | `editor.html`, `assets/villagers/` | 대기 — 이모티콘 대화가 town 을 고친 뒤 |
| M6-P4 곡·효과음 (ET-06 · ET-07) | `p9-sound` · 4224 | `src/audio/`, `assets/sound/` (새), `sound-editor.html` (새) | 곡·효과음·목소리 값을 데이터로, 곡 편집기 아티팩트, "소리 반영" |
| M6-P5 지도·숫자 (ET-08 · ET-09) | `p9-mapdata` · 4225 | `src/world/island.js` (고정 자리 읽기만), `src/data/` 의 표, `assets/island/`·`assets/data/` (새), `map-editor.html`·`data-editor.html` (새) | 섬 지도 편집기, 게임 숫자 표 편집기, "지도 반영"·"숫자 반영" |
| M6-P6 스타일 편집기 (ET-10) | `p9-style` · 4226 | `demos/style.html`, `docs/SHADERS.md`, `src/render/presets.js`, `assets/style/` (새) | 스타일 편집기 아티팩트 게시, 값 저장(db), "스타일 반영" |

겹치면 안 되는 곳: `src/core/assets.js`·`tools/build-web.mjs` 는 P0 만. `bg-editor.html` 은 P2 만, `editor.html` 은 아무도(P3 대기). Z5(M5) 는 아직 보드 선택 대기 — P5 가 `island.js`·`src/data/` 를 먼저 고치므로 Z5 는 구현 전에 main 을 맞춘다. 편집기 아티팩트는 각 트랙 세션이 새로 게시하고, 게임 링크 재게시는 조정 세션이 합친 뒤에(D35-A: 반영할 때마다).

## 합치기

각 트랙은 자기 브랜치에 커밋만 하고, 합치기(merge)는 사용자 확인 후 `main` 에서 한다.
합칠 때 `src/main.js` 의 `MODULES` 순서대로 모듈이 자동으로 붙는다.
