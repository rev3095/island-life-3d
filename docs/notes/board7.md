7차 검수 보드 (M7 출시 준비): https://claude.ai/artifact/HuSkBdHEr2VrWxts9YtStV · 파일 `concept/wave7-board.html` + `concept/board-kit.js` · 보드 id `wave7`

# 7차 검수 보드 (브랜치 `p10-board7`, 포트 4233)

`concept/README.md` 「새 보드 만드는 법」 그대로. 5·6차 보드와 같은 모양(색·글꼴·카드)에, 결정 카드마다 SVG 스케치를 더했다. 게시 v1 (2026-10-30), capabilities `db`(`applied`·`history` 쓰기 admin) · `user`, 아이콘 palette. 게시 뒤 저장소: `boards`·`applied` 모두 비어 있음 (아직 고른 것 없음 — 페이지는 추천안을 미리 골라 둔 채로 열린다).

보드 차례: 마일스톤 M0–M8 → 지금 출시 준비 상태(13줄) → 결정 D36–D48 → 새 화면 UI-06–11 → 출시 점검표 RC-01–12 → QA 결과(QA-01–19 표 + 고를 것 D49–D57 카드) → 진행 계획 M7-P1–P6 · M8 → 요청 글.

## 반영 v1 (2026-10-30, 임시) — 사용자 "7차 검수 보드 작성 완료, 반영"
- 보드 저장소 `boards/wave7` (v6, `status: requested`): **D37-B · D41-B**, 나머지 11개 추천안 A. 의견 하나 — **D41**: "D41-B 임시 실행, 추후 D41-A 방향으로 밸런스 변경 예정".
- `applied/wave7` v1 · `history/wave7-v1` (`commit` 5223e1e = 반영 직전 main), `boards/wave7` → `editing`, 편집기 홈 `status/wave7`.
- 아직 만든 것이 없어서 **계획만 바꿈** (`concept/README.md` 「"검수 보드 반영"」 3번):
  - D37-B → 묶음(`PACKS`)·`packs.js`·로딩 화면 UI-06 은 손대지 않는다. P2 는 기기 점검 UI-07 · 시작 단추 UI-11 · 저사양 기준만. RC-08 은 지금 8.4 MB 로 휴대폰 데이터 로딩 시간만 잰다.
  - D41-B → 밸런스 목표 = 지금 빠르기(3~5일). P5 는 QA 가 잰 값이 그 밖일 때만 숫자 표 초안. **D41-A 로 바꿀 예정** (사용자 의견) — 보드에서 D41 을 A 로 바꾸고 "검수 보드 반영"하면: P1 이 잰 값 기준으로 `assets/festival/config.json` `parts.open`(지금 tier friend · wins 2)·`parts.list[].need` 와 `assets/data/rules.json` `town`(talkBonus·giftPoints·giftsCountedPerDay) 을 5~7일에 맞춘 초안 → 숫자 표 편집기(`drafts/data`)·축제 설정 → "숫자 반영". 그때 `applied/wave7` v2.
  - D45-A → 소리 값은 그대로 (`state.js` 손대지 않음). 시작 단추만 P2.
- 보드 다시 게시(v2): 진행 계획 표를 v1 계획으로, UI-06 "만들지 않음", RC-08 글, 머리 줄 "반영 v1".
- 트랙 표: `docs/PLAN.md` 「7차」. P2·P3·P4 는 바로 시작할 수 있고 P5 는 QA 결과 뒤, P6 은 조정 세션.

## QA 결과 칸 (2026-10-31, 게시 v3) — 조정 세션 부탁 ("이후 개발 재개")
- main(b3525f2, QA 보고서·M7-P2·P3·P4·스토리 합친 뒤)을 이 브랜치에 맞춘 뒤 `docs/qa/playthrough-2026-10-30.md` 를 옮김.
- `const QA` = QA-01–19 그대로 `[id, 무엇, 크기(보고서 크기: 치명·큼·작음·다듬기), 처리]`, 처리는 `['fix', 어디서·커밋]` 또는 `['pick', 결정 id, 덧붙임]`:
  - **고침 10**: QA-04·06·07·08 (qa edf80c1) · QA-15·16 (qa 9f34110) · QA-19 (qa bbd0f59) · QA-12 (M7-P3 bca7dc3) · QA-01·02 카메라 (스토리 97007a1 — QA-02 부스 배치 자체는 그대로).
  - **보드에서 고르기 9** → 결정 카드 **D49–D57** (`DECISIONS` 에 `qa:` 칸을 붙여 같이 둠 — `tools/hub-catalog.mjs` 가 `const DECISIONS` 를 읽으므로 홈 「보드 결정」에도 들어간다. 그리는 곳만 "QA 결과" 절). 추천안은 모두 A (아래 표).
- QA 칸 위 숫자 6개 (막힘 0 · 통과 68/75 · 콘솔 오류 0 · 버그 19 · 고침 10 · 고를 것 9), `goalTable()` "지금 (QA 10-30)" 칸, 머리 줄 `QA 결과 19 (고침 10 · 고르기 9)`·`QA 고를 것 9`, 지금 상태 첫 줄 ✅, RC-01·02·04 ✅ · RC-03 △ (새로고침 이어 하기는 첫날만), 계획 표 P1 끝 · P2–P4 합침 · P5 하는 중, 게임 링크 v12.
- 홈 `status/wave7` v2: `open` 9, `openItems` D49–D57, `published` 3.

| 결정 | QA | 묻는 것 | 추천 (A) | 다른 안 | 고칠 곳 |
|---|---|---|---|---|---|
| D49 | QA-03 | 무대 지붕이 화면 아래를 덮음 | 가림 투명이 화면 아래 끝 땅 점도 봄 (QA 시험해 보니 됨) | B BD-06 3.7 → 2.6칸 (배경 요청) · C 둘 다 | `src/world/occlusion.js` · (B) 배경 편집기 |
| D50 | QA-05 | 두부 때문에 엔딩이 막히지 않게 | 마음 열기에 선물·부탁도 (이모티콘 성공 2번 대신) | B 두부 ⏳ + 다른 것도 인정 · C 힌트만 (P5) | `src/gameplay/festival/parts.js heartOpen` · (B) `assets/villagers/dubu.json emote` |
| D51 | QA-09 | 밤에 시작한 첫날 팔기 | 첫날만 밤톨이 문 너머로 사 줌 | B 밤엔 팔기를 내일 할 일로 · C 그대로 | `src/gameplay/town/keepers.js` · `src/gameplay/intro/` (P5) |
| D52 | QA-10 | 첫날 도토리 | 숫자 그대로, 밤톨 말만 ("하나 먼저, 벽지는 내일") | B 선물 1,000 → 2,000 (`intro/rules.js REWARD`) · C 첫날 벽지 600 | `assets/villagers/bamtol.json` · (B·C) P5 |
| D53 | QA-11 | 감정 알림 | "호박으로 밝혀졌어요!" | B + 바로 기증 묻기 · C 그대로 | `src/gameplay/town/keepers.js appraiseTalk` |
| D54 | QA-13 | 얼마나 더 친해져야 | 하트 칸 + 남은 수 (♥ 22/30 · 🙂 1/2) | B 말로만 단계 · C 그대로 | `src/gameplay/festival/fest.js ask` (P5 가 만드는 중 — 고른 모양에 맞춤) |
| D55 | QA-14 | 둘째 해 축제를 놓치면 | 그 날부터 사흘 안 (2/29 → 2/28) | B 그 해 안 처음 들어온 날 · C 그날만 (2/29 만 고침) | `src/gameplay/festival/parts.js festivalDueOn` |
| D56 | QA-17 | 모닥불·문 앞 주민 | 둘 다: 축제 날 모닥불 앞은 축제 시작 먼저 + 주민이 문 앞·둘레에서 비켜 섬 | B 축제 시작만 먼저 · C 그대로 | `src/gameplay/festival/fest.js register` · `src/gameplay/town/` |
| D57 | QA-18 | 맑은 날 주민 방 | 잠들기 전 1~2시간은 집에 | B 주민마다 집에 있는 시간 (성격·대화 탭) · C 그대로 | `src/gameplay/town/villager.js shouldBeOut` · 주민 파일 `schedule` |

## 반영 v2 (2026-11-04, 확정) — 사용자 "이어서 진행, 보드 확정된대로 개발 진행"
- 보드 저장소 `boards/wave7` 에 D49–D57 고른 기록이 없음 = 보드가 미리 골라 둔 추천안 그대로 → **D49–D57 모두 A** 로 확정. D36–D48 은 v1 그대로 (D37-B · D41-B, 의견 D41 "추후 D41-A 방향" 유지 → `docs/PLAN.md` 「앞으로 일정」 보류 줄).
- 만든 곳: **M7-P7** (브랜치 `p13-qa-picks`, main 20b52a0 에서). `applied/wave7` v2 · `history/wave7-v2` (`commit` 20b52a0).

| 결정 | 한 것 | 파일 | 확인 |
|---|---|---|---|
| D49-A | 가림 투명 대상에 **화면 아래 끝 가운데 땅 점**(NDC y −0.9, 카메라에서 14칸 안, 실내 빼고). `world.occlusion.bottom` 으로 끄고 켬, `bottomPoint()` 확인용 | `src/world/occlusion.js` · `index.js` | 박물관 문 앞(QA-03 자리) 끄면 무대 지붕이 화면 아래를 덮고, 켜면 `festival-stage@BD-06` 1 (디더) |
| D50-A | 마음 열기 = 친구(30) + **마음이 통한 일** 2번. 통한 일 = 이모티콘 대화 성공 · 좋아하는 선물(좋아함·아주 좋아함, 친밀도가 오른 것만, 하루 한 번) · 부탁 들어주기. 축제 설정 `parts.open.ways` (`["emote"]` 로 두면 예전 규칙). 주민 상태 `bonds {gift, favor, giftDay}` | `town/rules.js` `noteBond`·`heartCount` · `town/talk.js` · `festival/parts.js` · `assets/festival/config.json` · 봇 `scenario.js` | `festival.test` · `town.test` · `tips.test` |
| D51-A | 첫날 '팔기' 전이면(`intro.doorSell()`) 상점이 닫혀도 밤톨이 문을 빼꼼 열고 **팔기 탭만** 연다 (`ui.shop.open({ only: 'sell', greet })`). 첫날 목록은 밤에 팔기를 더는 미루지 않고(`NIGHT_DOOR_SELL`), 힌트 night·팔기 안내 글을 바꿈 | `town/keepers.js` · `intro/index.js`·`rules.js`·`tips.js` · `ui/shop.js` · `bamtol.json` `firstday.night`·`nightAfter` | 23시 상점 문 앞 Space → 밤톨 말 → 팔기 탭 하나 |
| D52-A | 숫자 그대로, 밤톨 첫날 끝 말 "삽이나 도끼 하나 먼저 … 벽지·바닥은 내일 사도 늦지 않아요" | `bamtol.json` `firstday.after` (v2) | 주민 파일 검사 |
| D53-A | 감정 알림 "호박으로 밝혀졌어요!" (받침 ㄹ 은 '로') | `town/keepers.js` `appraiseToast` | — |
| D54-A | 마음이 덜 열린 주민에게 🎉 → **말풍선 아래 하트 칸** `♥ 22/30 · 🙂 1/2` (talk UI `say(toks, { meter })`). 섬폰 「안내」 친구 줄도 🙂 | `festival/fest.js`·`talk.js`·`talkui.js`·`festival.css` · `intro/tips.js` `heartMeter` · `guide.js` | 두부 22/30 · 선물 1 → "♥ 22/30 · 🙂 1/2" |
| D55-A | 해마다 축제 = 처음 연 날의 월·일부터 **사흘 안** 저녁 6시(한 해 한 번), 2월 29일은 평년 2월 28일, 연말 축제는 새해로 넘어가도 그 해 몫 (`festivalYearOf`) | `festival/parts.js` · `fest.js` | `festival.test` |
| D56-A | 축제 시작 우선순위 95 → **101** (그날 저녁 모닥불 2.4칸 안에서만 잡히므로 다른 때는 그대로) + 주민이 상점·박물관 문 앞 1.6칸 · 모닥불 2.8칸 안을 목표로 고르지 않음 (`town.blocksAction`) | `festival/fest.js` · `town/index.js` | — |
| D57-A | 잠들기 전 **1~2시간**(날마다 다름, `homeFrom`)은 집에 깨어 있음 → `town.atHome` 은 일과의 잠자는 때(`isAsleep`)만 'sleep' (예전엔 밤·새벽 시간대 전부) | `town/rules.js` · `town/index.js` | 20.6시: 보리·모찌·두부·초롱·단풍 home, 코코·퐁 out |

- 주민 지문(`tests/villagers.test.mjs` `PINS`)의 주민 play 값은 D50·D57 로 일부러 다시 뜸. 밤톨 v2 라 공통 지문은 건너뜀.

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
| M7-P2 | 기기 점검·시작 단추 (UI-07·11) — 반영 v1: D37-B 라 묶음·UI-06 은 그대로 | `tools/web-loader.html` 시작 단추 자리만 · `src/render/quality.js` · 기기 점검 새 파일 (`src/render/` 안) | D39 · D45 |
| M7-P3 | 휴대폰·접근성 (UI-10) + 섬폰 메뉴 줄 | `src/ui/` (P4 새 파일 둘 빼고) · `src/core/input.js` · `src/player/camera.js` · `src/gameplay/festival/talkui.js`·`festival.css` | D38 · D42 |
| M7-P4 | 저장 옮기기·문제 알리기 (UI-08·09) | `src/data/save.js` · `src/ui/transfer.js`·`report.js` (새, `ui.panel` 로 창만 — 섬폰 메뉴 줄은 P3) · `src/core/errors.js` (새) · 게임 아티팩트 capabilities (`db` `reports` 쓰기 interact 등, 게시는 P6) | D43 · D46 |
| M7-P5 | 첫날 안내·밸런스 — 반영 v1: 밸런스는 지금 빠르기(D41-B), 소리 값 그대로(D45-A) | `src/gameplay/intro/` · `assets/data/*.json` ("숫자 반영" 흐름으로, 3~5일 밖일 때만) · (D41-A 때) `assets/festival/config.json` `parts` | P1 결과 · D40 · D41 · D44 |
| M7-P6 | 출시 (조정 세션): 합치기 → 게임 다시 게시 → RC 점검 → 공유는 사용자 | `README.md` · `docs/notes/release.md` (새) · `devlog.md` | P1–P5 · D36 · D47 |
| M8 | D48 방향으로 8차 검수 보드부터 | — | M7 끝 |

겹치면 안 되는 곳: `src/ui/` 는 P3 만 (P4 는 새 파일 둘만 만들고 메뉴 줄은 P3 에 부탁). `src/core/` 는 P3 `input.js`, P4 `errors.js`(새)만 (반영 v1 로 P2 `packs.js`·P5 `state.js` 는 빠짐). 로딩 화면(`web-loader.html`)은 P2 만 — 그래서 시작 단추 UI-11 도 P2. 다른 트랙 파일이 꼭 필요하면 `docs/notes/<트랙>.md` 에 제안.

## QA 결과 칸 (D47) 채우는 법
- 다음 QA 결과가 `docs/qa/` 에 오면: `concept/wave7-board.html` 의 `const QA` 에 이어서 `[id, 무엇, 크기, ['fix', 어디서·커밋] | ['pick', 결정 id, 덧붙임]]` (ID 는 보고서 그대로 QA-20–), 고를 것은 `DECISIONS` 끝에 `{ id: 'D58', qa: 'QA-20', q, now, opts }` + `sketch()` 의 그림 하나, 밸런스 숫자는 `goalTable()` "지금" 칸 (도감 절반은 아직 안 잼) → 같은 file_path 로 다시 게시 (capabilities 생략). 숫자 칸·머리 줄은 `QA` 배열에서 저절로 센다 (`qaSum` 의 버그 크기 줄만 손으로).
- 결정 id 를 더하면 README ID 표의 D 줄을 고친다.

## "검수 보드 반영" 때
`concept/README.md` 순서 그대로: `boards/wave7` ↔ `applied/wave7` 비교 → 위 「결정과 추천안」의 걸리는 트랙대로 계획 → PLAN 7차 표 → 작업 폴더·세션 → `applied/wave7` v<n> · `history/wave7-v<n>` (`commit` = 반영 직전 main) → 편집기 홈 `status/wave7`. 사용자가 아무것도 안 바꾸면 저장소가 비어 있을 수 있다 (6차처럼 추천안 그대로를 v1 로 기록).
- **D49–D57 (v2 반영 때)**: `boards/wave7` (v7, 반영 v1 때 Claude 가 씀) 의 `picks` 에는 D36–D48 만 있다. 사용자가 보드에서 하나라도 바꾸면 페이지가 화면의 선택 전부(D49–D57 포함)를 저장한다. 그래도 D49–D57 이 없으면 화면에 골라져 있던 **추천안 A 를 고른 것으로** 보고 `applied/wave7` v2 `picks` 에 22개를 모두 적는다. 할 일은 위 「QA 결과 칸」 표의 "고칠 곳" 대로 — 대부분 town·festival·world 의 작은 고침이라 트랙 하나(예: M7-P7 QA 남은 것, `src/gameplay/town/`·`festival/`(P3 의 `talkui.js`·`festival.css` 빼고)·`src/world/occlusion.js`)로 묶고, D50-C·D52-B/C·D54 는 P5 (첫날 안내·숫자)와 겹치므로 P5 가 끝난 뒤나 P5 에 넘긴다.

## 다른 세션에 (부탁)
- **편집기 홈 (`p10-hub`, `editors.html` 주인)**: `editors-list` 의 `board` 무리 맨 앞(wave6 위)에 이 줄을 더하고 홈을 다시 게시해 주세요:
  ```json
  { "id": "wave7", "group": "board", "name": "7차 검수 보드 v0.7", "url": "https://claude.ai/artifact/HuSkBdHEr2VrWxts9YtStV", "file": "concept/wave7-board.html",
    "edits": "M7 출시 준비. 결정 D36–D48, 새 화면 UI-06–11, 출시 점검 RC-01–12, QA 결과 QA-01–.",
    "command": "검수 보드 반영", "openLabel": "바뀐 선택", "reads": ["boards/wave7", "applied/wave7"] },
  ```
  (10-31) 보드에 D49–D57 이 생겼으니 이 줄 `edits` 를 `"M7 출시 준비. 결정 D36–D48, QA 결과 QA-01–19 와 고를 것 D49–D57, 새 화면 UI-06–11, 출시 점검 RC-01–12."` 로 — 홈 「보드 결정」 목록은 합친 뒤 `node tools/hub-catalog.mjs` 를 다시 돌리면 D49–D57 이 들어간다 (`tests/hub.test.mjs` 는 D36–D48 만 확인).
  그리고 `tests/hub.test.mjs` 의 README 보드 표 검사 목록(`['wave5', 'z5', 'wave6', 'concept']`)에 `'wave7'` 을, `concept/README.md` 「반영 기록 공용 모양」의 보드 id 예(`wave5` · `z5` · `wave6`)에 `wave7` 을. 홈 저장소 `status/wave7` 처음 값은 `{ id: 'wave7', open: 0, openItems: [], requested: false, applied: null, recent: [], published: 1, note: '게시 v1 — 사용자 선택 대기', checkedAt, updatedAt, updatedBy: 'claude' }`.
  - D46-A 를 고르면 홈 목록 `game` 항목 `reads` 에 게임 저장소 `reports` (`status:'new'`) 를 더하는 일이 생긴다 (P4 가 저장소 모양을 정한 뒤).
- **조정 세션**: devlog 「게시물」에 이 보드 줄, `docs/PLAN.md` M7 줄 "예정 → 보드 wave7 v1, 선택 대기".
- **QA 세션**: 결과 파일 이름·모양이 정해지면 이 노트 「QA 결과 칸」에 맞춰 큰 문제 목록을 따로 모아 주면 보드에 옮기기 쉽다 (무엇·어디서·다시 하는 법·크기).

## 확인한 것 · 못 한 것
- 확인: dev-server `/concept/wave7-board.html` (포트 4233) 콘솔 오류 0, 결정 13·라디오 39(추천안 13 골라짐)·의견 칸 32·그림 19(결정 13 + 화면 6), 1009px·375px 에서 가로 넘침 0, 스케치 19장 눈으로 확인(D38 글자 잘림 고침), 선택을 바꾸고 의견을 적으면 저장(로컬은 이 브라우저)·요청 글에 "(추천안에서 바꿈)"·의견 줄이 나오고 되돌리면 지워짐. 게시 v1 뒤 저장소 `boards`·`applied` 읽기 (둘 다 비어 있음, view 권한으로도 읽힘). `node --test tests/` 254/254.
- 못 함: claude.ai 에서 보드를 직접 열어 저장소에 써 보기(사용자 창), 어두운 화면 눈 확인(토큰은 6차와 같음, 스케치는 밝은 받침에 고정색).
- 확인 (10-31, QA 칸 · 게시 v3): 콘솔 오류 0, 결정 22 (본 절 13 + QA 절 9)·라디오 66·의견 칸 41·그림 28, QA 표 19줄, `hub-catalog.mjs boardDecisions` 가 22개를 읽음 (추천 모두 A), 1024px·375px 가로 넘침 0 (QA 표는 375 에서 표만 옆으로 밀림 — `min-width: 600px`), 새 스케치 9장 눈으로 확인(D52·D56 글자 겹침, 주민 그림 종족 고침 — 두부 곰·느루 거북), D55 를 B 로 바꾸면 요청 글에 "(추천안에서 바꿈)"·로컬 저장, 되돌림. `node --test tests/` 308/308. 게시 v3 뒤 `boards/wave7` 그대로 (v7, D36–D48 만).
