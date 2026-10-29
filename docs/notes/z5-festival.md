# Z5 축제 · 이모티콘 대화 · 엔딩 (브랜치 `p8-festival`, 포트 4215)

## 지금 단계
① 검수 보드 — `concept/z5-festival-board.html`, 보드 id `z5`, https://claude.ai/artifact/Cqjh9RiTwUn1CcPhCNtoWS (버전 1, 2026-10-29). 결정 D14–D25 는 사용자가 고르는 중. "검수 보드 반영" 이 오면 ② 구현.
② 구현은 Z4(`p8-town`)를 main 에 합친 뒤 이 브랜치를 main 에 맞추고 시작한다 — 그 전에는 `src/gameplay/town/`·`src/world/island.js` 를 건드리지 않는다.

## 보드에 붙인 ID (추천안 기준, 반영 때 바뀔 수 있음)
| ID | 무엇 |
|---|---|
| D14–D25 | 결정: 대화 방식 · 이모티콘 범위 · 그림 · 팔레트 · 판정 · 광장 위치 · 부품 얻기 · 부스 구성 · 부스 서는 때 · 축제 시작 · 엔딩 사진 · 엔딩 뒤 |
| UI-04 · UI-05 · UI-06 | 이모티콘 선택기 · 축제 진행판 화면(섬폰) · 사진 모드(D24-B 일 때) |
| TK-01–07 | 주민 7명(코코·보리·모찌·두부·퐁·초롱·단풍) 이모티콘 읽는 규칙 |
| EM-01–36 | 이모티콘: 플레이어 30(인사·감정·행동·물건·자연·묻기) + 주민 대답 전용 6 |
| BD-06 · BD-07 · TI-08 | 축제 무대 · 축제 아치 · 축제 돌바닥 (BD-05 는 선착장이라 06부터) |
| FP-01–05 | 부품: 반딧불 등불(초롱) · 응원 북(코코) · 꽃 가랜드(모찌) · 과일 솥(퐁) · 낚시 대회 깃발(두부) |
| FB-01–05 | 부스: 등불 길 · 음악 무대 · 꽃 공방 · 먹거리 · 낚시 대회 |
| PR-13–16 | 깃발 줄 · 등불 기둥 · 부품 진행판 · 덮개 친 부스 자리 |
| FU-34 · IC-FE-01–04 | 축제 단체 사진 액자 · 과일 파이·주스·화관·낚시 대회 메달 |
| AN-01–05 | 새 동작 wave · nod · shake · tilt · cheer (캐릭터 빌더) |
| ED-01–06 · SF-1–6 | 엔딩 컷 · 이야기 흐름 단계 |

## 다른 트랙과의 약속 (제안 — 합칠 때 CONTRACTS 로)
- **상태**: 새 칸 `ctx.state.festival = { parts: {FP-id: dayKey}, booths: {FB-id: {...}}, readyDay, festivalDay, endedAt, photos: [] }` (주인: gameplay/festival). 주민별 이모티콘 기록은 `state.villagers[slug]` 에 `emote: { wins, todayCount, day, mistakes }` 를 더한다 (town 규칙과 같은 칸 정리 방식, `villagerState` 가 채움).
- **이벤트** (festival 이 보냄): `festival:part {id, from}` · `festival:booth {id}` · `festival:ready` (다섯 다 모음) · `festival:start` · `festival:photo {url}` · `festival:end`. 스토리 세션 장면 재생기는 이것을 듣고 장면(`festival-intro`·`festival-part`·`festival-ending`)을 튼다. 장면이 끝나면 재생기가 `story:done {scene}` 를 보내 주면 festival 이 다음 단계로 간다 (재생기가 없으면 festival 이 바로 다음으로).
- **town 대화**: `talk.js` 가 대화를 열 때 `ctx.services.festival?.emote?.converse(V)` 가 있으면 그쪽으로(D14-A/B), 없으면 지금 글 대화. 글 대사는 지우지 않고 설정 `settings.textLines`(기본 꺼짐)로 보관.
- **world 광장**: `island.js` 8단계(광장)를 D19 안대로 넓히고, 부스·무대 자리를 `places.festival = { center, stage, booths: [{id, x, z, rot}], arches, board }` 로 내보낸다. 모델은 배경 스펙의 `world` 칸(충돌·집터)에서.
- **아이템**: 부품은 가방에 넣지 않는다(진행판으로). 음식 IC-FE-01–04 는 `src/data/items.js` 에 `festival` 분류로 (Z1 의 3D 아이콘 방식).
