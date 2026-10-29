# Z5 축제 · 이모티콘 대화 · 엔딩 (브랜치 `p8-festival`, 포트 4215)

검수 보드 `z5` (https://claude.ai/artifact/Cqjh9RiTwUn1CcPhCNtoWS) 반영 v1 = 추천안 그대로(D14-A · D15-A · D16-A · D17-A · D18-A · D19-A · D20-B · D21-A · D22-A · D23-A · D24-A · D25-A), 의견 없음.
main 453379a 를 합친 뒤(a014b36) 구현. 커밋: P2 4d5908e · P3 c396f5b · P4 8c221b0 · P5–P7 (이 노트와 같은 커밋).

## 만든 것
| 단계 | 파일 | 내용 |
|---|---|---|
| P2 이모티콘 대화 | `assets/emotes/emotes.json` · `talk.json`, `src/gameplay/festival/judge.js` · `emotes.js` · `talkui.js` · `talk.js` | EM-01–36 손그림 SVG, 주민 7명 읽기 규칙 TK-01–07, 판정 6단계(친밀도 0~+3, 깎이지 않음, 하루 3번), 첫 이모티콘 대화 연습 3번, 선택기 UI-04(묶음 탭 6·격자·3칸·보내기·잘 가), 머리 위 말풍선, 몸짓(끄덕·갸웃·도리도리·물러남 — 모델 동작 AN-01–05 가 생기기 전엔 모델을 기울여서) |
| P3 광장 3D | `assets/env/specs/festival-*.json` (17), `assets/blender/build_env.py` 축제 빌더, `src/world/festival.js` | 무대 BD-06 · 아치 BD-07 ×2 · 바닥 무늬 TI-08 · 부스 FB-01–05 · 덮개 PR-16 · 등불 기둥 PR-14 ×8 (색 변형 넷) · 깃발 줄 PR-13 ×7 · 진행판 PR-15 · 부품 FP-01–05. 지금 광장을 동쪽으로 3칸 옮겨 지름 12칸 원(섬 난수·다른 물체 id 그대로). 무대 위는 높은 바닥(pads) |
| P4 부품·부스 | `parts.js` · `fest.js` · `booths.js` · `icons.js`, 아이템 IC-FE-01–04 (`assets/items/specs/festival-*.json`), 가구 FU-34 (`assets/furniture/specs/festival-photo.json`) | 🎉 → 💭 필요한 것 → 건네면 부품 → 스토리 장면 뒤 덮개가 걷히고 부스, 진행판 화면 UI-05(위 가운데 다섯 칸), 부스 놀이 다섯 |
| P5–P6 축제·엔딩 | `fest.js` | 다 모은 다음 날 저녁 6시(놓치면 다음 날) 광장 가운데 "축제 시작" → `festival:start` → 스토리 s10·s11 → 사진 액자 FU-34 + 그림 파일 저장 → 엔딩 뒤 부스는 그대로, 해마다 같은 날 다시 축제 |
| P7 스토리 연결 | 이벤트 (아래) | s04 끝 → 축제 이야기 시작, s05–s09 ← `festival:part {n}`, s10 ← `festival:start`, s11 의 photo 컷에서 화면을 잡아 둠, s11 끝 → 엔딩 |

## 다른 트랙과의 약속 (합칠 때 CONTRACTS 로)
- **상태** `ctx.state.festival` (주인: gameplay/festival): `{ talkTutorial, started, parts: {FP-id: dayKey}, booths: {FB-id: {openedDay, …놀이 기록}}, asked: {slug: dayKey}, readyDay, heldDay, lastYear, festivals: [dayKey], endedDay, photos: [{day}], announced, photoPending }`. 주민별 이모티콘 기록은 `state.villagers[slug].emote = { day, today, wins, wantDone }`.
- **설정** `state.settings.textLines` (섬폰 '대화 › 주민 글 대사 보기', 기본 꺼짐) — 켜면 예전 글 대화.
- **이벤트 (festival 이 보냄)**: `festival:emote {slug, keys, kind, points}` · `festival:started` · `festival:part {n, total, id, name, emoji, from, booth:{x,z}, x, z}` · `festival:booth {id}` · `festival:ready` · `festival:start {first, day}` · `festival:photo {day, url}` · `festival:end {day, first}`. **들음**: `story:end` (s04 · s05–s09 · s11), `story:shot` (photo 컷), `story:start` (진행판 숨김), `data:newday`.
- **서비스** `ctx.services.festival = { emotes, emote: { on(), session(V) }, ask(V, E), state, due(), debug }`. town/talk.js 가 `say(lines, choices, emotes, choiceEmotes)` 로 쓴다.
- **world**: `world.places.festival = { x, z, center, radius, tile, stage: {x, z, front, y}, booths: [{id, slug, part, x, z, rot, angle, scale, front}], board, arches, lanterns }`. `world.objects.add(kind, tx, tz, { at: {x, z, y} })` 로 정확한 자리. 원 충돌체는 아무 각도·크기로 돈다.
- **ui**: `ctx.services.ui.panel(name, root, opts)` (panels.open 그대로) — 다른 모듈이 자기 DOM 을 창으로.
- **아이템**: 분류 `festival` (축제), `festival.pie · juice · wreath · medal` 은 누구에게나 아주 좋아하는 선물 (town/rules.js giftReaction 한 줄). 부품은 가방에 넣지 않는다(진행판으로). 사진 액자 `furn.festival-photo`.

## 스토리 세션에 (H4 답)
- 위 이벤트 그대로 보낸다. 부스 공개는 `story:end {id:'s0N-partN'}` 뒤 (장면이 90초 안에 안 끝나면 그래도 연다).
- 이모티콘: 장면 말풍선이 지금 기기 이모지(🎺 등)를 쓴다. 섬 전용 세트로 바꾸려면 `ctx.services.festival.emotes.svg(key)` (key 는 `assets/emotes/emotes.json`) — 장면 파일의 `emote` 를 key 로 쓰거나 glyph → key 표(`emotes.json` 의 glyph 칸)로 바꾸면 된다.
- 축제·사진 장면은 기준 자리 `event` = `places.festival`(광장 가운데). 무대는 북쪽 5칸 (`places.festival.stage`, 무대 바닥 높이 0.36).
- s12(섬 생활은 계속) 뒤로 festival 은 아무것도 하지 않는다 — 섬은 그대로.

## M6 에 (편집기)
- 성격·대화 탭(M6-P3): `assets/emotes/talk.json` (주민 규칙)·`emotes.json` (그림) 두 파일. 테스트 `tests/festival.test.mjs` 가 모양·보낼 수 있는지·모든 주민 해법을 검사.
- 배경 편집기: 축제 17종은 보통 배경 스펙과 같다 (status `review`). 부스 크기를 바꾸면 `src/world/festival.js` 의 `BOOTH_SIZE`·각도도 같이 — 테스트가 겹침·길 막힘을 잡는다.

## 알려진 것 · 못 한 것
- 웹 빌드 파일 수 564 > 511 → `tests/build-web.test.mjs` 2개 실패. M6-P0 묶음 파일이 들어와야 게시할 수 있다.
- 새 캐릭터 동작 AN-01–05(손 흔들기·끄덕·도리도리·갸웃·만세)는 아직 Blender 에 없다 — 지금은 모델을 기울이고 흔드는 몸짓. 캐릭터 빌더에 더하는 일은 따로.
- 미리보기 창이 숨겨진 채로 확인해서 스토리 장면은 처음 컷까지만 눈으로 봤다 (s05·s10 시작, 부스 공개·사진 액자·저장 묻기는 이벤트로 확인).
