# interiors-all — 실내 전수 · 도토리상점 낮/밤 매장 (브랜치 `interiors-all`, 진행 중)

사용자 요청 6·7번: 「실내 무조건 전부 들어갈 수 있게, 리스트·팝업만으로 된 실내는 버리고 NPC 와 말할 때만 팝업」 + 「상점은 낮/밤마다 파는 품목·갈 수 있는 공간이 다르게」.

## 조사 표 (문·장소 → 들어가지 않고 목록·창만 뜨던 곳)

| 곳 | 예전 | 지금 (이 브랜치) | 몫 |
|---|---|---|---|
| 도토리상점 문 (22–8시) | 닫힘 대사 · 첫날 「문 너머 팔기」 상점 창 | **늘 들어감** — 밤엔 밤 매장 (`keepers.staffed`, `placeRule('shop')` 늘 open) | 이 트랙 |
| 도토리상점 안 | 계산대 말 걸기 → 사기·팔기 창 | 진열품 앞 「보기」→ 사기 · 밤톨 = 「팔래요 / 주문할래요」 (창 탭 「주문」·제목에 낮/밤 매장, UI-31) | 이 트랙 |
| 주민 집 (외출 중) | 「잠겨 있어요」 알림만 | **들어감** — 빈 방 구경 (`visitRule` 'away', house:enter `absent`) | 이 트랙 |
| 주민 집 (자는 중) | 노크 대화만 | **살금살금 들어감** — 빈 방 (`visitRule` 'asleep') | 이 트랙 |
| 내 집 · 박물관 | 늘 실내 | 그대로 (박물관 내용은 박물관 트랙, 증축은 M14) | — |
| 달빛 가게 낮 · 새벽 천막 3–5시 밖 | 「닫힘」 글자 | 그대로 — **밤 트랙 몫** | 밤 트랙 |
| 야시장 노점 · 방문 행상 | 노점 주인과 말 → 창 | 열린 노점(공간 아님), NPC 팝업이라 그대로 | 밤 · M13 |
| 선착장 배 · 우편함 · 축제 무대/부스 · 섬폰 앱 | 묻기 창·편지 창·놀이 | 건물이 아님(탈것·물건·열린 무대) — 그대로 | — |

## 한 것

- **도토리상점 = 세 방**: 1층 RM-08 v6 (`shop.json` `phases.day/night` · `inner` 실내 문 둘) + 낮 정원·도구 코너 **RM-22** `shop-garden.json` (x 580, z 40) + 밤 지하 밤 코너 **RM-21** `shop-night.json` (z −40, 창 없음, 무인 계산함). 낮 = 실내 가구 3(1층) · 야외 가구·도구·꽃씨·묘목·늘 파는 것(정원 코너), 밤 = 1층 가구 코너 덮개 천 · 밤 가구 2·밤 도구·밤 간식·늘 파는 것(지하).
- 진열표 데이터: `rules.json shop.phases·night·always` (`tool.scuba-kit` 은 items 에 값이 있을 때만), `economy.phase`·`hours`·`stock(dayKey, phase)`, `placedata.phaseGroups`.
- 문 틀: `door.js through({ dir: 'pass' })` 방↔방 · `placedata` `phaseSpec`·`innerSpot`·`PLACE_PARENT`·`OUTER_KINDS`, `checkPlace` 가 딸린 방·실내 문 검사 · `places.js` 매장 갈래별 가구 묶음, 실내 문 처리기 `house-place-inner`(92), UI-31 이름표(오른쪽 위), `api.phase/inner/parentOf`.
- 붙박이 Blender 6종 (status review): FU-79 진열 덮개 천 · FU-80 지하 계단 문 · FU-81 정원 코너 문 · FU-82 화분 선반 · FU-83 무인 계산함 · FU-84 등불 진열장.
- 밤톨 대사 `nightShop` (bamtol.json v4). 테스트 479 통과 (places · night · interior 고침, elem-editor/files.json 에 새 방 파일).

## 남은 것 (사용량 한도로 멈춤)

- `tools/check-interiors.mjs` 넓히기 (팝업만 0 · 실내 문 · 낮/밤) — 안 함
- 자동 플레이(`--port=4266`) · 개발 서버 직접 확인(콘솔 오류) — 안 함. 봇 `skills.js` 의 상점 대화가 「살래요」를 찾으므로 「주문할래요」·탭 「주문」에 맞춰야 함, 딸린 방에서 `leavePlace` 두 번
- 요소 편집기 방 배치 탭이 `phases`·`inner` 를 아직 모름

## 문서 세션이 반영할 문장

- CLAUDE.md 실내 줄: 「도토리상점은 늘 열고 낮/밤 매장(`economy.phase`)이 다르다 — 1층 RM-08 + 낮 정원·도구 코너 RM-22(x 580, z 40) · 밤 지하 밤 코너 RM-21(z −40), 방↔방은 `through({ dir: 'pass' })`. 주민 집은 외출·자는 중에도 빈 방으로 들어간다.」
