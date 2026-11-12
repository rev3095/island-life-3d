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
| **M5** | 축제와 엔딩 | ✅ 10-30 합침 → 게임 v10 (보드 z5 반영 v1, 결정은 `assets/festival/config.json`, 광장 자리는 섬 지도, 축제 곡 BGM-10). 처음부터 엔딩까지 이어서 해 보기는 아직 | P1 Z5 검수 보드 ✅ · P2 이모티콘 대화 · P3 축제 광장·부스·부품 3D · P4 부스 해금·상호작용 · P5 축제·단체 사진 엔딩 · P6 엔딩 뒤 계속(해마다 축제) · P7 장면 05~12 를 실제 이벤트에 연결(스토리) |
| **M6** | 편집기 완성 (6차) | ✅ 10-30 P0~P6 모두 합침 → 게임 v10 (묶음 152파일) | P0 묶음 파일(파일 511 한계) · P1 편집기 홈·전체 요청·반영 기록 공용 · P2 배경 편집기 아이템·실내 탭·방 배치 · P3 성격·대화 탭(M5-P2 뒤) · P4 곡·효과음 편집기 · P5 지도·숫자 편집기 · P6 스타일 편집기 게시 |
| **M7** | 출시 준비 (7차) | 🔶 P1–P5 ✅ 합침 (10-31) · 하늘·시점·실내 ✅ (11-04, 게임 v21) · 보드 wave7 **반영 v2 (11-04 확정)** = D37-B · D41-B · 나머지 A (QA 결정 D49–D57 추천안) → P7 만듦 (합치기 승인 대기) | P1 QA 자동 점검 ✅ · P2 기기 점검·시작 단추 ✅ · P3 휴대폰·접근성 ✅ · P4 저장 옮기기·문제 알리기 ✅ · P5 첫날 안내·밸런스 ✅ · **P7 QA 결정 반영** 🔶 · P8 편집기 맞추기 · P9 시점 조작 마무리 · P6 출시·공유 (P7–P9 뒤) · P10 정리 |
| **M8** | 계절 행사 (8차) | ✅ 11-06 (보드 wave8 반영 v1, 게임 v24) | P0 8차 보드 · P1 행사 틀 · P2 리소스 · P3–P6 봄·여름·가을·겨울 놀이 · P7 장면 · P8 QA |
| **M9** | 섬 꾸미기 (9차) | ✅ 11-08 main 5a7577e (보드 wave9 반영 v1, 게임 v25) | P0 9차 보드 · P1 M8 남은 것 · P2 섬 꾸미기 틀 · P3 리소스 · P4 리소스 시험 · P5 정리 · P6 QA |
| **M10** | 새 주민·이사 오가기 (10차) | ✅ 11-10 main 6a2c88c (보드 wave10 반영 v1, 게임 v26) | P0 10차 보드 · P1 앉기·옮기기 · P2 배경 편집기 렌더 묶음 · P3 새 주민 셋 · P4 이사 · P5 가구·장면 · P6 QA |
| **M11** | 옷 갈아입기 · 주민 12명 (11차) | ✅ 11-11 main ba6a490 (보드 wave11 반영 v1 = D100–D105 A) | P0 11차 보드 · P1 주민 12명·집터 셋 · P2 몸/옷 나누기 · P3 옷 12벌·FU-54 · P4 옷장·상점·빙글 · P5 봇 단계 (`docs/notes/m11-clothes.md`) |
| **M12** | 밤·새벽 | ✅ 11-11 main de3117f (보드 night 반영 v1, 게임 v27–v29) | P0 보드 · P1–P6 (`docs/notes/m12-night.md`) |

순서: M4 합치기 ✅ → M5 구현 (광장 넓히기는 M6-P5 합친 뒤, 축제 곡은 M6-P4 합친 뒤, 게시는 M6-P0 합친 뒤)(이모티콘 대화가 town 을 고치므로 Z4 합친 뒤) → M6 의 대화 편집은 M5-P2 뒤, 나머지 M6 는 M5 와 함께 가능.

## 앞으로 일정 (P 로 부른다, 2026-11-12 기준)

순서대로 한다. 부를 때는 `M7-P8` 처럼. 끝나면 ✅ 와 날짜·커밋을 적는다.

| 차례 | P | 할 일 | 끝나면 | 먼저 필요한 것 |
|---|---|---|---|---|
| 1 | **M7-P7** QA 결정 반영 | 7차 보드 D49–D57 (모두 추천안 A) — 화면 아래 가림 투명 · 마음 열기에 선물·부탁 · 첫날 밤 문 너머 팔기 · 밤톨 말 · 감정 알림 문장 · 하트 칸 · 축제 사흘 · 축제 시작 먼저·주민 비켜 서기 · 잠들기 전 집에 (브랜치 `p13-qa-picks`) | 합치기 → 게임 v22 | ✅ 11-04 main bf53798 · 게임 v22 |
| 2 | **M7-P8** 편집기 맞추기 | 배경 편집기 「방 배치」 탭에 상점·박물관(RM-08·09, `assets/interior/places/` 의 `size`·`cases`·`stock`) · 캐릭터 편집기 다시 게시(밤톨 v2 대사) · 스타일 편집기에 하늘 값(`SKY_FX`)·구름 그림자 세기 · 홈 `status/*`·`catalog/*` | 편집기 셋 다시 게시 | ✅ 11-05 main 8cf042c · 배경 v11 · 캐릭터 v10 · 스타일 v3 · 게임 v23 |
| 3 | **M7-P9** 시점 조작 마무리 | `docs/notes/p12-camera.md` 선택지 7개는 **지금 값 그대로** 확정. 바꾸고 싶은 게 있으면 작은 보드(카메라) → "검수 보드 반영" | 시점 값 확정 표시 | ✅ 11-05 모두 지금 값 (`docs/notes/p12-camera.md` 「확정」) |
| 4 | **M7-P6** 출시 | 자동 플레이 다시(개발판·게시본·휴대폰, RC-01–04) → 출시 점검표 `docs/notes/release.md` → 사용자 손 점검 RC-05–08·12 (claude.ai 직접 · iPhone · Android · 다른 GPU · 휴대폰 데이터 · 다른 계정 공유 링크) → 공유는 사용자가 | M7 끝 | 🔶 11-05 Claude 몫 끝 (`docs/notes/release.md`), 사용자 손 점검 대기 |
| 5 | **M7-P10** 정리 | 합친 작업 폴더·브랜치(p8-*·p9-*·p10-*·p11-*·p12-*·qa·story 등 20여 개)와 끝난 세션 보관 | 저장소에 main 만 | P6 · 사용자 확인 |
| 6 | **M8-P0** 8차 검수 보드 | 계절 행사 결정·리소스 ID (꽃놀이·불꽃·수확·눈사람, 날짜 규칙, 광장·부스 다시 쓰기, 새 모델 컨셉) | 사용자 선택 → M8-P1… | ✅ 11-05 보드 v1 게시 → 반영 v1 = D74–D85 모두 A (`docs/notes/m8-events.md`) |
| 7 | **M8-P1** 행사 틀 | `assets/events/events.json` · `src/gameplay/events/` (날짜·시간·알림·진행·도장·비 막기) · 섬폰 달력 UI-13 · 칸 UI-14 · 도장 UI-15 · 날짜 흉내 `#date=` (저장 칸 따로) | 합치기 | 🔶 11-05 브랜치 `p19-events`, 합치기 승인 대기 |
| 8 | **M8-P2** 리소스 | 한 행사씩 컨셉 → Blender 모델 → 편집기 검수: EN-12 · PR-17–23 · FU-43–46 · IC-EV-01–04 · AN-08–09 · 부스 덮개·등불 색 변형 | 편집기 다시 게시 | ✅ 11-05 모델 16 (봄 5·여름 3·가을 4·겨울 4) 모두 검수 대기, 배경 편집기 v15. FX-01·AN-08·AN-09·부스 덮개 색 변형은 놀이 트랙(P3–P6) |
| 9 | **M8-P3–P6** 행사 놀이 (✅ 11-05 P3 봄 · P4 여름 · P5 가을 · P6 겨울 모두) | 봄 `events/spring.js` · 여름 `summer.js` + 불꽃 셰이더 `src/render/fireworks.js` · 가을 `autumn.js` · 겨울 `winter.js` (파일이 안 겹쳐 동시에) | 합치기 | P1 · P2 의 그 행사 모델 |
| 10 | **M8-P7–P8** 장면·QA·게시 (P7 ✅ 11-05 장면 넷 · 주인공 자리) | 장면 s13–s16 · 행사 대사·소품 → 자동 플레이(날짜 흉내) → 게임 다시 게시 · 홈 「미리 해 보기」 링크 | M8 끝 | P3–P6 |
| 11 | **M9-P0** 9차 검수 보드 | M9 방향과 정리 — 결정 D86–D92 (큰 방향 · M8 남은 것 · 리소스 만드는 법 · 게임 두는 곳 · 밸런스 · 정리 · 성능), D86-A 기준 리소스 계획 | 사용자 선택 → "검수 보드 반영" → M9-P1… | 🔶 11-07 보드 v1 게시 https://claude.ai/artifact/LqYJsMK1gF7FaP5ZBvFnfc, 선택 대기 (M8 행사 모델 16·장면 넷 확정) |
| 12 | **M9-P1** M8 남은 것 (D87-A) | 동작 AN-08 손 불꽃 흔들기 · AN-09 눈덩이 밀기 · AN-10 놓기 (주인공, 캐릭터 전체 재빌드) · 눈사람 표정 넷 (입 부품) · 주민 행사 소품 넷 PR-26–29 (꽃 머리띠·부채·스카프·목도리, 주인공 주민 뼈에 붙임 `events/props.js`) | 합치기 | ✅ 11-08 브랜치 `p31-m9`, 합치기 승인 대기 |
| 13 | **M9-P2** 섬 꾸미기 틀 (D86-A) | `src/gameplay/decor/` (밖에 놓기·칸 판정·이어지는 길/울타리·돌리기·치우기, 저장 `state.island.added`) · 섬폰 「🪴 섬 꾸미기」 UI-16 · 놓을 칸 미리 보기 UI-17 · 주민 길찾기(깐 길 싸게·벤치 앞 쉬기) | 합치기 | ✅ 11-08 `p31-m9` |
| 14 | **M9-P3** 리소스 | 길 TI-09–12 · 울타리 PR-24–25 · 야외 가구 FU-47–50 (검수 대기), 게시 묶음 `decor` | 배경 편집기 다시 게시 (렌더 그림 묶음으로 — 501/511) | ✅ 11-08 `p31-m9` |
| 15 | **M9-P4** 리소스 시험 (D88-A) | WP-04 무늬 하나를 로컬 ComfyUI(SDXL base + 이음매 없는 타일)로 → 색 줄이기 → 스크립트와 비교 `docs/notes/local-resources.md` §7 | — | ✅ 11-08 결론: 무늬는 스크립트 유지, 로컬 그림은 레퍼런스용 |
| 16 | **M9-P5** 정리 (D91-A) | 합친 브랜치·작업 폴더 지우기 | — | ✅ 11-07 (빈 폴더 `p1-world`·`p6-firstday` 둘은 다른 프로세스가 써서 남음) |
| 17 | **M9-P6** QA | 자동 플레이 `island-decor` 단계 · 행사 점검 개발판·게시본 · 테스트 382 → 합치기 → 배경 편집기·게임 다시 게시 | M9 끝 | 🔶 11-08 행사 점검 8/8, 합치기 승인 대기 |
| 18 | **M10-P0** 10차 검수 보드 | M10 방향 — 결정 D93–D99 (큰 방향 · 주민 오가는 규칙 · M9 남은 꾸미기 · 휴대폰 놓을 칸 · 배경 편집기 파일 한도 · 첫 만남 장면 · 상점 진열), D93-A 기준 리소스 CH-11–13 · FU-51–53 · AN-11 · UI-18 · s17–s19, 계획 M10-P1–P6 | 사용자 선택 → "검수 보드 반영" → M10-P1… | ✅ 11-10 보드 v1 게시 https://claude.ai/artifact/AZHj6d7gTqXyjXhZcCkW1H · **반영 v1 = D93–D99 모두 A** (`applied/wave10` v1, commit 07ca691) |
| 19 | **M10-P1** M9 남은 것 (D95-A · D96-A · D99-A) | 앉기 AN-11 (`sit_down`·`sit`·`stand_up`, 캐릭터 13종 재빌드, 정강이 뼈) — 주민이 벤치·피크닉 탁자에 앉음 · 주인공은 밖 꾸밈 가구·집 의자·소파 · 꾸밈 옮기기 (C 「옮기기」) · 칸 누르기 (짧은 클릭·톡, 6칸 안) · 상점 진열 실내 셋 + 야외 하나 (`rules.json` `shop`) | 합치기 | ✅ 11-10 main 6a2c88c |
| 20 | **M10-P2** 배경 편집기 렌더 묶음 (D97-A) | 렌더·썸네일 모두 `editor-renders-<n>.json`·`editor-thumbs.json` → 게시 파일 504 → 61 | 배경 편집기 다시 게시 (`dist/bg-editor/publish.json`, 첫 차례 replace) | ✅ 11-10 main 6a2c88c |
| 21 | **M10-P3** 새 주민 셋 (D93-A) | CH-11 구름(양) · CH-12 파도(펭귄) · CH-13 달무리(부엉이) 모델·성격·대화 (`arrives: "moving"`), 모두 검수 대기 | 캐릭터 편집기 다시 게시 | ✅ 11-10 main 6a2c88c |
| 22 | **M10-P4** 이사 오가기 (D94-A) | `town/moving.js` — 엔딩 뒤 7일마다 한 명 (섬 최대 10) · 30일 넘은 주민이 묻고 허락해야 떠남 · 편지 UI-18 · 남는 집터 · 지붕 색 BD-02 · 저장 `state.town.moving` (CONTRACTS 「10차」) | 합치기 | ✅ 11-10 main 6a2c88c |
| 23 | **M10-P5** 가구 · 첫 만남 장면 | FU-51 그림 이젤 · FU-52 바다 지도 액자 · FU-53 별 망원경 (밤 하늘 보기) · 장면 s17–s19 (트리거 `move-in`, 연출안 둘씩), 모두 검수 대기 | 시나리오 편집기 다시 게시 | ✅ 11-10 main 6a2c88c |
| 24 | **M10-P6** QA | 자동 플레이 `moving-in`·`moving-out` 단계 · 행사 점검 개발판·게시본 · 테스트 394 | 합치기 → 편집기·게임 다시 게시 | ✅ 11-10 main 6a2c88c · 게임 v26 · 편집기 셋 |
| 25 | **M11-P0** 11차 검수 보드 | M11 방향 — 결정 D100–D105 (큰 방향 · 옷 범위 · 옷 얻는 곳 · 주민 수 한도 · 게임 두는 곳 · 자동 플레이 정리), D100-A 기준 리소스 CL-01–12 · FU-54 · UI-19 · AN-12, 계획 M11-P1–P5 | 사용자 선택 → "검수 보드 반영" | ✅ 11-10 보드 v1 게시 https://claude.ai/artifact/SKNtCRjBfZEJ1iES9hcWKY · **반영 v1 = D100–D105 모두 A** (11-11, `applied/wave11`) |
| 26 | **M12-P0** 밤·새벽 검수 보드 | 밤·새벽 콘텐츠 — 결정 D106–D114 (야시장 때·자리 · 야시장 물건 · 야행성 주민 · 밤 상점 · 밤에만 여는 집 · 새벽 마술 상점 · 타로 효과 · 밤 행사 겹침 · 여는 때), 추천안 기준 리소스 BD-08–09 · CH-14–15 · RM-10–11 · PR-30–32 · FU-55–59 · IC-NT-01–04 · UI-20–21 · s20–s21 · TA-01–12, 계획 M12-P1–P6 (`src/gameplay/night/`, 브랜치 `p34-night`) | 사용자 선택 → "검수 보드 반영" | ✅ 11-10 보드 게시 https://claude.ai/artifact/PLWgpRtW8quwEBFBVJiyWU → 반영 v1 = D106–D114 모두 A (저장 없음 = 추천안) |
| 27 | **M12-P1–P6** 밤·새벽 | 밤 틀 `src/gameplay/night/` (규칙·설정 `assets/night/night.json`·`state.night`) · 리소스 18 (BD-08·09 · CH-14·15 · PR-30·32 · FU-55–59 · IC-NT-01–04, 검수 대기) · 달빛 가게 RM-10 · 새벽 천막 RM-11 · 야시장 · 야행성 달무리 · 타로 12장 (`data.luck`) · CONTRACTS 「밤」 · 자동 플레이 `night` 단계 | 합치기 승인 → 게임·편집기 다시 게시 | ✅ 11-11 main de3117f (+ 고침 3684652) · 게임 v27–v29 (`docs/notes/m12-night.md`) |
| 28 | **P35-T0** 무인도 투어 검수 보드 | 선착장 BD-05 에서 배 타고 다른 무인도 — 결정 D120–D128 (가는 방법 · 표 · 섬 모양 · 할 것 · 머무는 시간 · 저장 · 장면 전환 · 성능 · 계절·밤), 추천안 기준 리소스 BD-10 · EN-13 · TO-01–04 · 아이템 9 · UI-22–23 · s22, 계획 T1–T5 (브랜치 `p35-tour`) | 사용자 선택 → "검수 보드 반영" | ✅ 11-10 보드 v1 게시 https://claude.ai/artifact/Nf9TMCFMXbHRCP8Y3xiUvx · 반영 v1 = 모두 A |
| 29 | **P35-T1–T5** 무인도 투어 만들기 (tour 반영 v1) | 투어 섬 생성기(TO-01–04) · `world.islet` (따로 kit, 칸 질문 돌리기) · 배 BD-10 · 광석 바위 EN-13 · 아이템 9 · 여행 묻기 창 · 표 · 다른 섬 주민 초대 · 05:00 귀환 · `state.tour` · CONTRACTS 「투어」 · 봇 `tour` 단계 · 테스트 398 (`docs/notes/p35-tour.md`) | main 합치기 · 게임·배경 편집기 게시 승인 | ✅ 11-11 main 1c9480f (+ 봇 고침 827283d) · 게임 v27–v29. 배 나가는 장면 · s22 · UI-23 칸은 P39 |
| 30 | **P33** 시계 바늘 | 섬폰 「🕰 시계」 바늘 끌기로 시각 offset (날짜는 앞으로만), 낮·밤 활동이 `time.now()` 를 따라옴 (`docs/notes/p33-clock.md`) | 합치기 | ✅ 11-11 main 1bfe881 (+ 시계 상점 고침 fc76759) |
| 31 | **P36** 편집기 셋 나누기 | ① 리소스 편집기 https://claude.ai/artifact/1weSx9yyf2U4mLnwvopBNV ("리소스 요청 확인") · ② 스토리 편집기 https://claude.ai/artifact/NrmMmozFXQCdiw1oQMxCyF (시나리오 링크를 키움, "스토리 반영") · ③ 요소 편집기 https://claude.ai/artifact/DcidJEY1VRNNJdCxwge3Sj (숫자 표 링크를 키움, "요소 반영"). 예전 캐릭터·배경·섬 지도 편집기는 「예전」 (`docs/notes/p36-*.md`) | 편집기 셋 게시 | ✅ 11-11 main 312fcfb · f44b45b · b454d52 (+ 이사 봇 고침 8eb29b2) |
| 32 | **P37** 링크·문서 | CLAUDE.md · `concept/README.md` · devlog · PLAN 을 편집기 셋에 맞추기, 「전체 관리」 링크를 새 편집기로, 깨진 링크 검사, 편집기 홈 다시 게시 | 합치기 | ✅ 11-11 main c1e2f88 (홈 v17) · 최종 정리 P42 `p42-final-docs` |
| 33 | **M11-P1–P5** 옷 갈아입기 (wave11 반영 v1) | 주인공 몸/옷 나누기 · 옷 CL-01–12 (모자·윗옷·신발) · 옷장 창 UI-19 · 옷 진열대 FU-54 (상점) · 빙글 AN-12 · 주민 12명 + 집터 spare-2·3 · 자동 플레이 정리 (D105-A) | 합치기 → 게임·리소스 편집기 게시 | ✅ 11-11 main ba6a490 (`docs/notes/m11-clothes.md`) — 옷 12벌·FU-54 검수 대기, 봇 `clothes` 🟡 (봇 쪽) |
| 34 | **P39** 남은 장면 · QA | 밤 s20·s21 · 투어 s22 · 배 나가는 장면 · UI-23 칸 · 자동 플레이 🟡 정리 | 합치기 → 스토리 편집기·게임 게시 | ✅ 11-11 main 9483ee2 — s20·s21·s22 (연출안 둘씩, review) · 배 떠나기 3.2초 · 자동 플레이 29✅ 0🟡 · 남은 일 표 `docs/notes/backlog.md` (UI-23 칸은 B-13 으로 남음) |
| 35 | **P40** 최적화 | 처음 받는 묶음 크기 · 밤·투어 GPU 시간 · 게시 파일 수 | 합치기 → 게임 게시 | ✅ 11-11 main 010b196 — 게시 묶음 모델 양자화 · `night`·`movers` 묶음 → boot 11.48 → 6.10MB, 광장 GPU 는 11-06 과 같음 (`docs/notes/p40-perf.md`, 게시본 화면 비교는 남음) |
| 36 | **P41** 시간 빠르기 · 원형 시계 | 빠르기 ×1·×12(처음)·×30 (`rules.json time`, 닫아 두면 멈춤) · 왼쪽 위 원형 시계 HUD + −1시간·빠르기·+1시간 (`docs/notes/p41-fast-time.md`) | 합치기 | ✅ 11-11 main ef317c6 |
| 37 | **P42** 최종 문서 정리 | 노트 넷(M11·P39·P40·P41)의 문장을 CLAUDE.md · `concept/README.md` · PLAN · README 에, CLAUDE.md 새 절(시각·꾸미기/이사·옷·투어)·게시 방식·병렬 규칙 | 합치기 | ✅ 11-11 브랜치 `p42-final-docs` |
| 38 | **최종 게시** | M11 · P39 · P40 · P41 합친 뒤 게임 · 편집기 셋 · 홈 `status/*`·`catalog/*` (옷 13줄 포함) 다시 게시, devlog 마지막 정리 | 이번 묶음 끝 | 조정 세션 (11-11 main 010b196 위) |
| 39 | **M13-P0** 13차 검수 보드 | 「동물의 숲처럼 풍성하게」 — 결정 D140–D147 (M13 방향 · 섬 일지 · 풍선 선물 · 유리병 · 유성우 소원 · 방문 행상 · 레시피 모으기 · 저사양), D140-A 기준 리소스 UI-24 · TO-07 · PR-33–34 · IC-MA-11–13 · FX-02 · AN-13 · CH-16 · BD-11 · FU-63–66 · s23–s24, 계획 M13-P1–P6 | 사용자 선택 → "검수 보드 반영" | ✅ 11-12 보드 v1 확정(추천안 D140–D147 모두 A) https://claude.ai/artifact/Lo1QpQ9svMsenNYUGUM72B |
| 40 | **M13-P1–P6** 매일 할 거리 (추천안) | P1 섬 일지 · P2 유성우·소원 · P3 풍선·새총 · P4 유리병·레시피 · P5 방문 행상 · P6 QA·게시 (보드 「진행 계획」) | 합치기 → 게임·편집기 게시 | ✅ 11-12 P1 섬 일지 aedd040 · P2–P5 매일 할 거리 (브랜치 m13-daily) → main · 게임 v40 b475984 |
| 41 | **M14** 집과 섬이 자란다 | 집 증축(방 넓히기 · 2층 · 다락) · 섬 별점 평가 · 다리·경사로 — 14차 보드에서 정함 | — | ✅ 11-12 브랜치 p55-m14-home → main cc674cb · 게임 v40 (결정 D150–D154) |
| 42 | **M15** 주민과 더 가깝게 | 주민에게 편지·선물 · 같이 낚시·산책 · 추억 앨범 · 주민끼리 노래 | — | ✅ 11-12 브랜치 p55-m15-villagers → main b355184 · 게임 v40 |
| 43 | **M16** 모으기 넓히기 | 잠수(바다 생물) · 미술품(진품·모조품) · 별자리 도감 · 박물관 새 관 | — | ✅ 11-12 잠수 m16-dive (D160–D164) · 밤 특별 상점·미술품 night-special (D165–D169) · 별자리·박물관 관 여섯 museum-stars · 실내 전부 직접 입장 interiors-all → main b475984 · 게임 v40. 남은 일 = 14차 보드 |
| 44 | **M17-P0** 14차 검수 보드 | M13–M16 마무리 · 트랙 결정 D150–D179 확정 칸 · 결정 D180–D187 (M17 방향 · 가품 대사 · 밤 건물 닫힌 시각 · 일지 잠수 조건 · 미술품 집에 · 증축 묻기 · 축제까지 5~7일 · 검수 방식) · 검수 대기 116 묶음 · 계획 M17-P1–P5 | 사용자 선택 → "검수 보드 반영" | ✅ 11-13 보드 v1 확정(추천안 D180–D187 모두 A, 트랙 결정 D150–D179 확정) |
| 45 | **M17-P1–P5** 다듬기 (D180-A 추천안) | P1 검수 확정·고칠 모델 · P2 빈칸(가품 대사 · 일지 조건 · 미술품 집에 · 증축 묻기 · 집 안 망원경) · P3 밸런스(D41-A) · P4 편집기 따라잡기·게시 · P5 QA·게시 | 합치기 → 게임·편집기 게시 | ✅ 11-13 P1 m17-p1-review · P2 m17-p2-gaps · P3 m17-p3-balance · P4 m17-p4-editors → main c6f9fc3 (P5 점검·게시는 조정 세션) |
| 46 | **M18-P0** 15차 검수 보드 | M18 방향 「계절이 깊어진다」 — 결정 D190–D197 (방향 · 계절 생물 · 하늘 · 그날만 날씨 · 대회 · 미술품 주고받기 · 계절 레시피 · 사양), D190-A 기준 리소스 IC-SE-21–38 · IC-ST-13–18 · FX-03–04 · BD-17 · FU-89–104 · UI-34–35 · s29–s32, 계획 M18-P1–P5 | 사용자 선택 → "검수 보드 반영" | 🔶 11-13 보드 v1 게시 https://claude.ai/artifact/3hoiPoHF3nZJS2fDj5nSVc, 선택 대기 |

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
| M6-P3 성격·대화 탭 (ET-05) | `p9-traits` · 4227 | `editor.html`, `assets/villagers/` (새), `src/gameplay/town/`(데이터 읽기), `assets/emotes/talk.json`·`assets/data/rules.json` 주민 칸, `src/gameplay/festival/judge.js`(읽는 곳만) | 주민 데이터를 `assets/villagers/<slug>.json` 으로, 캐릭터 편집기 성격·대화 탭(반응 미리 보기), "요청 확인" 으로 적용 — 10-29 시작 |
| M6-P4 곡·효과음 (ET-06 · ET-07) | `p9-sound` · 4224 | `src/audio/`, `assets/sound/` (새), `sound-editor.html` (새) | 곡·효과음·목소리 값을 데이터로, 곡 편집기 아티팩트, "소리 반영" |
| M6-P5 지도·숫자 (ET-08 · ET-09) | `p9-mapdata` · 4225 | `src/world/island.js` (고정 자리 읽기만), `src/data/` 의 표, `assets/island/`·`assets/data/` (새), `map-editor.html`·`data-editor.html` (새) | 섬 지도 편집기, 게임 숫자 표 편집기, "지도 반영"·"숫자 반영" |
| M6-P6 스타일 편집기 (ET-10) | `p9-style` · 4226 | `demos/style.html`, `docs/SHADERS.md`, `src/render/presets.js`, `assets/style/` (새) | 스타일 편집기 아티팩트 게시, 값 저장(db), "스타일 반영" |

겹치면 안 되는 곳: `src/core/assets.js`·`tools/build-web.mjs` 는 P0 만. `bg-editor.html` 은 P2 만, `editor.html` 은 아무도(P3 대기). Z5(M5) 는 아직 보드 선택 대기 — P5 가 `island.js`·`src/data/` 를 먼저 고치므로 Z5 는 구현 전에 main 을 맞춘다. 편집기 아티팩트는 각 트랙 세션이 새로 게시하고, 게임 링크 재게시는 조정 세션이 합친 뒤에(D35-A: 반영할 때마다).

### 7차 = M7 출시 준비 (2026-10-30 — 검수 보드 wave7 반영 v1, 임시)

보드 https://claude.ai/artifact/HuSkBdHEr2VrWxts9YtStV. 반영 v1 = D36-A 게임만 링크 공유 · **D37-B 처음 로딩 지금 그대로**(8.4 MB, 로딩 화면 UI-06 안 만듦) · D38-A 최근 4년 휴대폰·가로/세로 · D39-A 기기 점검 `?check` · D40-A QA 측정 → 숫자 표 초안 · **D41-B 축제까지 지금 빠르기(3~5일)** — 의견 "임시 실행, 추후 D41-A(5~7일) 방향으로 밸런스 변경 예정" · D42-A 접근성 기본 묶음 · D43-A 내보내기·불러오기 · D44-A 첫날 안내 다듬기 · D45-A 소리 값 그대로 + 시작 단추 · D46-A 문제 알리기 → 편집기 홈 · D47-A 막힘·저장·오류는 바로, 나머지는 보드로 · D48-A 다음은 계절 행사(M8). 결정·근거·부탁은 `docs/notes/board7.md`.

| P | 브랜치 · 포트 | 고치는 곳 (여기만) | 결과물 |
|---|---|---|---|
| M7-P1 QA 자동 점검 | `qa` · 4232 (고정 세션, 도는 중) | `docs/qa/` · `tools/playtest.mjs` + QA 세션이 정한 것 | 처음부터 엔딩까지 자동 플레이(RC-01–04), 하루 도토리·축제까지 날 수 재기, 큰 문제 QA-01– (막힘·저장 깨짐·오류는 그 자리에서 고침) |
| M7-P2 기기 점검·시작 단추 | `p11-check` · 4241 | `src/render/quality.js`, 기기 점검 새 파일(`src/render/` 안), `tools/web-loader.html` 의 시작 단추 자리만 | `?check` 30초 자동 순회 → GPU·화면·프레임 시간·품질·오류를 보여 주고 게임 저장소에 저장(UI-07), 로딩 끝 "소리 켜고 시작 / 소리 없이 시작"(UI-11), 광장 33ms 넘으면 저사양 |
| M7-P3 휴대폰·접근성 | `p11-access` · 4242 | `src/ui/` (P4 새 파일 둘 빼고), `src/core/input.js`, `src/player/camera.js`, `src/gameplay/festival/talkui.js`·`festival.css` | 세로 화면 시야·패드 자리, 섬폰 "보기 편하게"(UI-10: 글자 3단계·색만으로 구분 X·흔들림 줄이기·이모티콘 뜻·소리 신호 글자), 섬폰 메뉴에 P4 창 두 줄 |
| M7-P4 저장 옮기기·문제 알리기 | `p11-save` · 4243 | `src/data/save.js`, `src/ui/transfer.js`·`report.js` (새, `ui.panel` 로 창만), `src/core/errors.js` (새) | 저장 파일 받기·불러오기(UI-09), 문제 알리기(UI-08) → 게임 저장소 `reports` 모양 제안 (게임 capabilities·홈 `reads` 는 합친 뒤 조정 세션·홈 세션) |
| M7-P5 첫날 안내·밸런스 | `p11-tune` · 4244 — **P1 결과 뒤** | `src/gameplay/intro/`, `assets/data/*.json` ("숫자 반영"으로), (D41-A 로 바꿀 때) `assets/festival/config.json` 의 `parts` | QA 가 막힌 곳 힌트·안내 건너뛰기·섬폰에서 다시 보기. 밸런스는 지금 빠르기 그대로 — 잰 값이 3~5일을 벗어날 때만 숫자 표 초안 |
| M7-P6 출시 | 조정 세션 — **P7–P9 뒤** | `README.md`, `docs/notes/release.md` (새), `devlog.md` | 합치기 → 게임 링크 다시 게시(게임 capabilities `db` 더하기 — 기기 점검·문제 알리기) → 출시 점검표 RC → 공유는 사용자가 claude.ai 공유 단추 (게임만) |
| M7-P7 QA 결정 반영 | `p13-qa-picks` (조정 세션, main 20b52a0 에서) | `src/world/occlusion.js`·`index.js` · `src/gameplay/festival/` (`parts.js`·`fest.js`·`talk.js`·`talkui.js`·`festival.css`) · `src/gameplay/town/` (`rules.js`·`talk.js`·`keepers.js`·`index.js`·`traits.js`) · `src/gameplay/intro/` · `src/ui/shop.js` · `assets/villagers/bamtol.json` v2 · `assets/festival/config.json` `parts.open.ways` | 보드 wave7 반영 v2 = D49–D57 모두 A (아래 표 `docs/notes/board7.md` 「반영 v2」) |
| M7-P8 편집기 맞추기 | 조정 세션 (P7 합친 뒤) | `bg-editor.html` 방 배치 탭 · 편집기 게시 | 상점·박물관 방 배치 편집, 밤톨 v2·새 하늘 값이 편집기에 보임 |
| M7-P9 시점 조작 마무리 | — | `src/player/camera.js` `LOOK` | 선택지 7개 지금 값 확정 (바꾸려면 작은 보드) |
| M7-P10 정리 | 조정 세션 (사용자 확인 뒤) | `../island-worktrees/` | 합친 작업 폴더·브랜치·세션 보관 |

겹치면 안 되는 곳: `src/ui/` 는 P3 만 (P4 는 새 파일 둘만, 섬폰 메뉴 줄은 P3 에 부탁). `src/render/` 는 P2 만. `src/core/` 는 P3 `input.js`, P4 `errors.js`(새)만. QA 세션(P1)이 같은 파일의 작은 버그를 고쳤으면 그 커밋을 먼저 합친 뒤 트랙 브랜치를 맞춘다. 다른 트랙 파일이 꼭 필요하면 `docs/notes/<트랙>.md` 에 제안.

## 합치기

각 트랙은 자기 브랜치에 커밋만 하고, 합치기(merge)는 사용자 확인 후 `main` 에서 한다.
합칠 때 `src/main.js` 의 `MODULES` 순서대로 모듈이 자동으로 붙는다.
