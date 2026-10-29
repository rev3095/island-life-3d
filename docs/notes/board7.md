7차 검수 보드 (M7 출시 준비): https://claude.ai/artifact/HuSkBdHEr2VrWxts9YtStV · 파일 `concept/wave7-board.html` + `concept/board-kit.js` · 보드 id `wave7`

# 7차 검수 보드 (브랜치 `p10-board7`, 포트 4233)

`concept/README.md` 「새 보드 만드는 법」 그대로. 5·6차 보드와 같은 모양(색·글꼴·카드)에, 결정 카드마다 SVG 스케치를 더했다. 게시 v1 (2026-10-30), capabilities `db`(`applied`·`history` 쓰기 admin) · `user`, 아이콘 palette. 게시 뒤 저장소: `boards`·`applied` 모두 비어 있음 (아직 고른 것 없음 — 페이지는 추천안을 미리 골라 둔 채로 열린다).

보드 차례: 마일스톤 M0–M8 → 지금 출시 준비 상태(13줄) → 결정 D36–D48 → 새 화면 UI-06–11 → 출시 점검표 RC-01–12 → QA 결과(QA-01–, 지금 빈 표) → 진행 계획 M7-P1–P6 · M8 → 요청 글.

## 결정과 추천안

"지금" 은 main 0c14b41 을 재 보고 노트에서 모은 것 (아래 「근거」).

| 결정 | 묻는 것 | 추천 (A) | 다른 안 | 걸리는 트랙 |
|---|---|---|---|---|
| D36 | 공개 범위 | 점검표 ✅ 뒤 **게임만 링크 공유**, 편집기·보드는 나만 (공유 단추는 사용자) | B 조직 안 · C 나만 | P6 |
| D37 | 처음 로딩 | **4.5 MB 안팎** — 주민 모델은 처음 보일 때, 축제 17종은 축제 이야기 시작 때, 로딩 화면 UI-06, 느린 기기 처음부터 저사양 | B 지금 8.4 MB 그대로 · C 2 MB (걸으면서 채움) | P2 |
| D38 | 휴대폰 목표 | **최근 4년 기기(iPhone 12·S21 급) 30fps, 가로·세로 둘 다** (세로 시야 넓히기) | B 가로만 · C 오래된 기기까지(휴대폰 기본 저사양) | P3 (P2 성능) |
| D39 | 실제 기기·다른 GPU 확인 | **게임 안 기기 점검 `?check` (UI-07)** — 30초 자동 순회·잰 값 저장소에, 목표 광장 33ms 아래 | B 손으로 해 보고 채팅 · C 이 컴퓨터 흉내만 | P2 |
| D40 | 밸런스 고치는 방식 | **QA 가 재고 → 숫자 표 초안(`drafts/data`) → 사용자가 고쳐 "숫자 반영"** | B Claude 가 바로 고치고 알림 · C 그대로 | P1 → P5 |
| D41 | 축제(엔딩)까지 날 수 | **일주일 안팎(5~7일)** — 부품 친밀도 기준·필요한 것 수를 조금 늘림, 하루 도토리 ≈ 가구 하나 값 | B 지금(3~5일) · C 2주 이상 | P5 |
| D42 | 접근성 | **기본 묶음** — 섬폰 "보기 편하게"(UI-10): 글자 3단계 · 색만으로 구분 X · 흔들림 줄이기 · 이모티콘 뜻 · 소리 신호 글자 | B 최소 · C 넓게(한 손·키 바꾸기·읽기 프로그램·고대비) | P3 |
| D43 | 저장 | **이 브라우저 + 내보내기·불러오기 (UI-09)** | B 3칸 + 내보내기 · C claude.ai 계정 저장(사람별 저장소 칸) + 내보내기 | P4 |
| D44 | 첫날 안내 | **지금 7단계 + 다듬기** — QA 가 막힌 곳 힌트, 안내 건너뛰기, 섬폰에서 다시 보기 | B 3단계 + 편지 · C 축제 이야기까지 손잡기 | P5 |
| D45 | 소리 기본값 | **지금 값(0.6·0.8·0.7) + 시작 단추 둘 (UI-11)** — iPhone 무음 스위치 안내 | B 조금 낮게(0.45·0.7·0.55) · C 처음엔 끔 | P2 (단추) · P5 (값) |
| D46 | 오류·버그 알림 | **게임 안 "문제 알리기"(UI-08) → 게임 저장소 `reports` → "전체 요청 확인"·편집기 홈** | B 오류 글 복사만 · C 알림 없음 | P4 (+ 홈) |
| D47 | QA 큰 문제 처리 | **막힘·저장 깨짐·오류는 바로 고쳐 합치기 승인만, 밸런스·불편·보기는 보드 QA 칸에 선택지로** | B 모두 보드로 · C 모두 Claude 판단 | P1 · P6 |
| D48 | 엔딩 뒤 다음 콘텐츠 (M8) | **계절 행사** (봄 꽃놀이·여름 불꽃·가을 수확·겨울 눈사람, 실제 날짜, 광장·부스 다시 씀) | B 새 주민(CH-11·12) · C 낚시·곤충 대회 매주 | M8 보드 (7차에서는 안 만듦) |

새 화면 (추천안을 고르면 생김): UI-06 로딩 화면 v2 · UI-07 기기 점검 `?check` · UI-08 문제 알리기 · UI-09 저장 옮기기 · UI-10 보기 편하게 · UI-11 시작 단추. 출시 점검표 RC-01–12: QA 자동(RC-01–04 ⏳) · 사용자 손(RC-05–08·12 — claude.ai 직접 열기, 휴대폰 iPhone·Android, 다른 GPU, 휴대폰 데이터 로딩, 다른 계정 공유 링크) · Claude(RC-09 △ 이 컴퓨터만 · RC-10 · RC-11).

## 근거 (보드 「지금 출시 준비 상태」)
- 로딩: `node tools/build-web.mjs` (0c14b41) → 게시 152파일 17.82 MB, boot 묶음 `island-1` 2.84 · `people-1` 2.23 · `people-2` 2.27 = 7.34 MB + 모듈 139개 1.07 MB.
- 성능: `docs/notes/perf.md` (3차 X2, 광장 낮 high 10.3ms · low 8.3ms, Intel UHD). 축제 광장(M5) 뒤로 다시 안 잼.
- 휴대폰: `docs/notes/mobile.md`, 실제 기기 미확인 (devlog).
- 밸런스: `assets/data/rules.json` (`starter.acorns` 500, `town.tiers` friend 30, `talkBonus` 2, 선물 2~6 하루 2번) + `assets/festival/config.json` `parts.open` {tier friend, wins 2} + 이모티콘 판정 0~+3 하루 3번 → 주민마다 하루 10점쯤 → 친구까지 2~3일, 다 모은 다음 날 저녁 축제 → "빠르면 3일째, 보통 4~5일째". 셈한 값이라 QA 가 잰 값으로 바꿀 것.
- 접근성: `prefers-reduced-motion` 은 `src/core/input.js`·`ui.css`·intro·story·festival css 에만, 글자 크기 고정(`ui.css` 16px), 섬폰 설정 = 소리 3·시간·화면 모습·외곽선·전체 화면·글 대사.
- 저장: `src/data/save.js` localStorage `island-life-save-v1` 한 칸, 섬폰 "이 기기의 이 브라우저에만".
- 소리: `src/core/state.js` `settings` bgm 0.6 · sfx 0.8 · voice 0.7.
- 오류: `tools/web-loader.html` 의 실패·다시 시도뿐.

## 진행 계획 (승인 뒤) — 맡는 파일

| P | 할 일 | 맡는 파일 (여기만) | 먼저 |
|---|---|---|---|
| M7-P1 | QA 자동 점검 (이미 도는 중, QA 고정 세션 `local_4f51f7d3-c776-4372-a16d-c2d94ef76528`) — RC-01–04, 밸런스 숫자 재기, 큰 문제 QA-01– | `docs/qa/` + 그 세션이 정한 도구·테스트 | — |
| M7-P2 | 로딩·성능·기기 점검 (UI-06·07·11) | `tools/build-web.mjs` `PACKS` · `tools/web-loader.html` · `src/core/packs.js` · `src/render/quality.js` · 기기 점검 새 파일 (`src/render/` 안) | D37 · D39 · D45 |
| M7-P3 | 휴대폰·접근성 (UI-10) + 섬폰 메뉴 줄 | `src/ui/` (P4 새 파일 둘 빼고) · `src/core/input.js` · `src/player/camera.js` · `src/gameplay/festival/talkui.js`·`festival.css` | D38 · D42 |
| M7-P4 | 저장 옮기기·문제 알리기 (UI-08·09) | `src/data/save.js` · `src/ui/transfer.js`·`report.js` (새, `ui.panel` 로 창만 — 섬폰 메뉴 줄은 P3) · `src/core/errors.js` (새) · 게임 아티팩트 capabilities (`db` `reports` 쓰기 interact 등, 게시는 P6) | D43 · D46 |
| M7-P5 | 밸런스·첫날 안내·소리 값 | `assets/data/*.json` ("숫자 반영" 흐름으로) · `assets/festival/config.json` `parts` · `src/gameplay/intro/` · `src/core/state.js` `settings` 줄만 | P1 결과 · D40 · D41 · D44 · D45 |
| M7-P6 | 출시 (조정 세션): 합치기 → 게임 다시 게시 → RC 점검 → 공유는 사용자 | `README.md` · `docs/notes/release.md` (새) · `devlog.md` | P1–P5 · D36 · D47 |
| M8 | D48 방향으로 8차 검수 보드부터 | — | M7 끝 |

겹치면 안 되는 곳: `src/ui/` 는 P3 만 (P4 는 새 파일 둘만 만들고 메뉴 줄은 P3 에 부탁). `src/core/` 는 P2 `packs.js`, P4 `errors.js`(새), P5 `state.js` 의 `settings` 줄만. 로딩 화면(`web-loader.html`)은 P2 만 — 그래서 시작 단추 UI-11 도 P2. 다른 트랙 파일이 꼭 필요하면 `docs/notes/<트랙>.md` 에 제안.

## QA 결과 칸 (D47) 채우는 법
- QA 세션 결과가 `docs/qa/` 에 오면: 큰 문제를 `concept/wave7-board.html` 의 `const QA = []` 에 `[id, 무엇, 크기, 처리]` 로 (`QA-01` 부터, 크기 = 막힘·저장·오류·밸런스·불편·보기, 처리 = D47 대로 "바로 고침 (P?)" 또는 "보드에서 고르기"), 밸런스 숫자는 `goalTable()` 의 "지금" 칸(지금은 "QA 가 잼")에 → 같은 file_path 로 다시 게시 (capabilities 생략). 머리 줄 `QA 결과 0` 숫자도.
- "보드에서 고르기" 문제가 여러 개면 결정 카드(D49–)로 올리는 것도 된다 — 그때는 README ID 표의 D 줄을 고친다.

## "검수 보드 반영" 때
`concept/README.md` 순서 그대로: `boards/wave7` ↔ `applied/wave7` 비교 → 위 「결정과 추천안」의 걸리는 트랙대로 계획 → PLAN 7차 표 → 작업 폴더·세션 → `applied/wave7` v1 · `history/wave7-v1` (`commit` = 반영 직전 main) → 편집기 홈 `status/wave7`. 사용자가 아무것도 안 바꾸면 저장소가 비어 있을 수 있다 (6차처럼 추천안 그대로를 v1 로 기록).

## 다른 세션에 (부탁)
- **편집기 홈 (`p10-hub`, `editors.html` 주인)**: `editors-list` 의 `board` 무리 맨 앞(wave6 위)에 이 줄을 더하고 홈을 다시 게시해 주세요:
  ```json
  { "id": "wave7", "group": "board", "name": "7차 검수 보드 v0.7", "url": "https://claude.ai/artifact/HuSkBdHEr2VrWxts9YtStV", "file": "concept/wave7-board.html",
    "edits": "M7 출시 준비. 결정 D36–D48, 새 화면 UI-06–11, 출시 점검 RC-01–12, QA 결과 QA-01–.",
    "command": "검수 보드 반영", "openLabel": "바뀐 선택", "reads": ["boards/wave7", "applied/wave7"] },
  ```
  그리고 `tests/hub.test.mjs` 의 README 보드 표 검사 목록(`['wave5', 'z5', 'wave6', 'concept']`)에 `'wave7'` 을, `concept/README.md` 「반영 기록 공용 모양」의 보드 id 예(`wave5` · `z5` · `wave6`)에 `wave7` 을. 홈 저장소 `status/wave7` 처음 값은 `{ id: 'wave7', open: 0, openItems: [], requested: false, applied: null, recent: [], published: 1, note: '게시 v1 — 사용자 선택 대기', checkedAt, updatedAt, updatedBy: 'claude' }`.
  - D46-A 를 고르면 홈 목록 `game` 항목 `reads` 에 게임 저장소 `reports` (`status:'new'`) 를 더하는 일이 생긴다 (P4 가 저장소 모양을 정한 뒤).
- **조정 세션**: devlog 「게시물」에 이 보드 줄, `docs/PLAN.md` M7 줄 "예정 → 보드 wave7 v1, 선택 대기".
- **QA 세션**: 결과 파일 이름·모양이 정해지면 이 노트 「QA 결과 칸」에 맞춰 큰 문제 목록을 따로 모아 주면 보드에 옮기기 쉽다 (무엇·어디서·다시 하는 법·크기).

## 확인한 것 · 못 한 것
- 확인: dev-server `/concept/wave7-board.html` (포트 4233) 콘솔 오류 0, 결정 13·라디오 39(추천안 13 골라짐)·의견 칸 32·그림 19(결정 13 + 화면 6), 1009px·375px 에서 가로 넘침 0, 스케치 19장 눈으로 확인(D38 글자 잘림 고침), 선택을 바꾸고 의견을 적으면 저장(로컬은 이 브라우저)·요청 글에 "(추천안에서 바꿈)"·의견 줄이 나오고 되돌리면 지워짐. 게시 v1 뒤 저장소 `boards`·`applied` 읽기 (둘 다 비어 있음, view 권한으로도 읽힘). `node --test tests/` 254/254.
- 못 함: claude.ai 에서 보드를 직접 열어 저장소에 써 보기(사용자 창), 어두운 화면 눈 확인(토큰은 6차와 같음, 스케치는 밝은 받침에 고정색).
