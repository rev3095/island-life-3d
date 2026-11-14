# M19-P3 주민끼리 짝 (보드 D202-A, 브랜치 `m19-p3-pairs`, 포트 4303)

## 짝 표 (보드 지도대로 여섯 — 「짝 다섯」 글보다 지도가 자연스러워 여섯, D230-A)
| id | 짝 | 선물 |
|---|---|---|
| bori-pong | 보리–퐁 | furn.picnic-table |
| chorong-mochi | 초롱–모찌 | furn.flower-pots |
| coco-pado | 코코–파도 | furn.surfboard |
| dubu-pado | 두부–파도 | furn.rod-rack |
| danpung-dalmuri | 단풍–달무리 | furn.star-telescope |
| gureum-danpung | 구름–단풍 | furn.paint-easel |
둘 다 섬에 살고 만난 짝만 켜진다 (파도·구름·달무리는 이사 온 뒤).

## 만든 것
- `src/gameplay/town/pairs.js` (순수 규칙 + `createPairs`, 서비스 `town.pairs`), 설정 `assets/town/pairs.json`, 저장 `state.town.pairs`.
- 같이 걷기: 12초마다 16%, 짝마다 하루 2번, 앞장·뒤따름(V.hold mode 'with', town.route 길찾기), 말풍선 이모지. 같이 걷는 중 말 걸면 짝 이야기(글 대화일 때), 하루 한 번쯤 대화 앞에 짝 이야기 한마디(글 대화일 때만).
- 다툼 날: 엔딩 3일 뒤부터 한 달에 한 번, 그달 첫날 = 6일 + (달마다 0~11), 27일까지. 비·눈 예보·그날만 날씨·계절 행사·대회·축제·짝 생일이면 다음 날로. 덜 다툰 짝부터 돌아가며. 💢 말풍선 · 서로 피함(5칸 안이면 한쪽이 떠남) · 멀면 서로 반대쪽 보기 · 수다(chatter) 안 함 · AN-17 팔짱+고개 돌리기 (코드 자세, 부모 공간 Euler YXZ 덧돌림, `sulkPose`).
- 화해: 둘에게 차례로 「이야기 들어 줄게」(친밀도 +1씩) → 둘 다면 17시부터 광장 둘레에서 `town:pair {makeup, cast}` → 장면 **s53-pair-makeup** (트리거 `pair-makeup`, once false, 연출안 A 다섯 컷 · B 한 컷; 파일 속 배우 bori·pong 을 `vars.cast` 로 바꿔 끼움 — `story/rules.js recastTake`, `story/index.js` 한 줄) → 끝나면 둘 친밀도 +3 · 우편함 편지(kind `pair`, 짝 앞쪽 주민이 보냄) + 선물 · `town:pair {phase:'made'}`. 못 들어 주면 다음 날 저절로 풀림(outcome self).
- 섬 일지: `town:pair` made → `makeup`, 목표 `peacemaker` 🤝 (1·3·6).

## 결정 (추천안으로 정함)
- D230-A 짝 여섯 (지도대로). D231-A 짝 설정은 `assets/town/pairs.json` (rules.json 아님). D232-A s53 은 배우 바꾸기(vars.cast)로 한 파일. D233-A 다툼 날은 그날 아침 정함(미리 달력 아님) — 막히면 다음 날로 밀림. D234-A AN-17 은 부모 공간 덧돌림(뼈 로컬 곱은 팔이 옆으로 벌어짐). D235-A 화해 편지는 짝 앞쪽 주민 이름으로 우편함에.

## 확인
- `node --test tests/` 585 중 584 통과 · 실패 0 (1 건너뜀 = 기존). 새 `tests/pairs.test.mjs` 8.
- 개발 서버 4303 (`?date=2027-03-10`, 엔딩 뒤 미리 보기 저장): 3/14 비라 건너뛰고 3/15 초롱–모찌 다툼 날 · 💢 · 알림 · 팔짱 자세 렌더로 확인 (화면 밖 캐릭터는 cull.js 가 뼈 계산을 쉬니 렌더 점검 땐 플레이어를 옆에).
- 고친 것: 날짜 흉내로 날짜가 뒤로 가면 다툼이 self 로 닫히던 것.

## 확인 못 한 것
- 게임 안에서 실제 키로 「이야기 들어 줄게」→ s53 재생 → 우편함 선물까지 한 바퀴는 못 봤다 (한도).
- 자동 플레이 봇 단계 `pairs` (scenario.js, contest 뒤)는 썼지만 `node tools/playtest.mjs --port=4303 --only=...` 로 돌리지 못했다. 엔딩이 필요해 --only 만으로는 skip — 전체 실행이나 엔딩 저장 + `tests/playthrough/index.html?keep=1&only=pairs` 로 볼 것.
- s53 글 칸(text)은 비워 둠 — 스토리 편집기 검수(status review).

## 문서 세션이 반영할 문장
- CLAUDE.md 「큰 구조」: **주민끼리 짝 (M19-P3, `src/gameplay/town/pairs.js`, 설정 `assets/town/pairs.json`)** — 짝 여섯 같이 걷기 · 엔딩 뒤 한 달에 한 번 다툼 날(💢 · 서로 피함 · AN-17 코드 자세) → 둘 이야기 들어 주기 → 저녁 s53 (`pair-makeup`, `vars.cast` 배우 바꾸기) → 편지·선물. 저장 `state.town.pairs`, 이벤트 `town:pair {phase: fight|listen|walk|walked|makeup|made}`, 일지 `makeup`. 노트 `docs/notes/m19-p3-pairs.md`.
- CONTRACTS: story `play`/트리거 vars 에 `cast: {파일 slug: 실제 slug}` (`recastTake`).
- 합칠 때: `tools/build-web.mjs` island 정규식에 `|town` · `tests/build-web.test.mjs` 게시 수 단언을 버전 한도로 (모듈이 늘어 256개 → files-1/2 두 번 게시) · `story/files.js`·`index.json`·`editor-files.json` 끝 줄 · `journal.json` 목표 한 줄 · `tests/journal.test.mjs` ON 에 makeup.
