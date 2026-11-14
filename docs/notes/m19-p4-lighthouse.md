# M19-P4 등대 다시 켜기 (브랜치 `m19-p4-lighthouse`, 16차 보드 wave16 D203-A · D206-A)

포트 4304. main 2194691 위. **진행 중 — 사용 한도로 멈춤 (2026-11-14)**.

## 만든 것
- 설정 `assets/lighthouse/lighthouse.json`, 규칙(순수) `src/gameplay/lighthouse/rules.js`, 본체 `index.js`, 진행판 UI-37 `ui.js`, 밤 빛 띠 `beam.js` (높음·적정 = 원뿔 + 셰이더 옅어짐, 낮음·매우 낮음 = 판 + 캔버스 그라데이션, 둘 다 `materials.curved`, 밤에만 장면에 넣음).
- 단계 표 (다음 단계는 앞 단계를 끝낸 날 + 7일, 처음부터 불 켜는 날까지 28일):

| 단계 | 재료 | 돕는 주민 (후보 순) | 장면 |
|---|---|---|---|
| 시작 | — (엔딩 다음 날 · 구름이 살 때, 14일 지나면 코코) | 구름 | s54 |
| 1 길 내기 | 돌 10 · 나무 5 | 두부 · 퐁 (코코 · 보리) | s55 |
| 2 계단 고치기 | 나무 10 · 단단한 나무 5 · 철광석 2 | 보리 · 단풍 | s56 |
| 3 렌즈 닦기 | 조개껍데기 6 · 점토 3 | 모찌 · 파도 | s57 |
| 4 별 조각 등불 | 별 조각 3 · 철광석 3 | 달무리 · 초롱 | s58 |
| 5 불 켜는 밤 준비 | 꽃 10 · 나무 5 | 구름 · 코코 | s59 |
| 불 켜는 밤 (19–4시 등대 앞) | — | 섬 사람 모두 + 밤 상인들 | s60 |
| 다음 날 아침 7시 뒤 | — | 구름 | s61 |

- 행동 키: `lighthouse:ask` 101 (돕는 주민 앞 「등대 부탁」) · `lighthouse:site` 98 (등대 앞 1.6칸). 주민은 등대 앞 2.6칸에 안 섬 (town keepClear).
- 모델 (Blender `assets/blender/lighthouse_env.py`, 모두 status review): BD-18-1/2/3 `lighthouse-dark|repair|lit` · PR-41 `lighthouse-scaffold` · PR-42 `lighthouse-stairs` · PR-43 `lighthouse-lens` · PR-44 `star-lantern`. 놓기는 `world.objects` persist:false, 무엇을 놓을지는 `state.lighthouse` (저장). 자리는 처음 한 번 `rules.siteSpot` 으로 정해 `state.lighthouse.site` 에 (지금 섬 = 칸 28,6 북쪽 모래 끝).
- 묶음: 처음에 안 받는 `daily` 묶음 (`build-web.mjs LIGHTHOUSE_FILES`), world lazy (`lighthouseKinds`).
- 일지 목표 「등대 다시 켜기」 🗼 (`lighthouse:stage`, journal v6). 장면 트리거 `lighthouse` (kind) · 장면 자리 `lighthouse`.
- 테스트 `tests/lighthouse.test.mjs` 11개. 개수 테스트: 배경 90 → 97, 일지 ON 목록 + lighthouse.
- **`tests/build-web.test.mjs`**: main 이 이미 한 번 게시 255개에 닿아 새 모듈을 더하면 넘음 → 검사를 버전 한도 511 로 (여러 차례 `files-1…` 게시). M19 다른 트랙도 같은 문제 — 조정 세션 확인 필요.

## 확인
- `node --test tests/` 588 중 587 통과 · 1 건너뜀 · 실패 0.

## 남은 것 (못 함)
- 게임 안에서 실제로 열어 보기(개발 서버 4304) — 놓이는 모습·진행판·빛 띠·장면 재생 **확인 안 함**.
- 자동 플레이 봇 등대 단계 (`tests/playthrough/scenario.js`) · `playtest.mjs --only` · `check-interiors.mjs` · `perf-bench.mjs --scenes=plaza-night` 안 돌림.
- 장면 s54–s61 글 칸은 비어 있음 (스토리 편집기 검수), 대체 주민(코코 시작)일 때도 s54 배우는 구름.

## 문서 세션이 반영할 문장
- CLAUDE.md 행동 키 문장에 「등대 부탁 101 (M19-P4 — 단계 할 일 중 돕는 주민 앞) · 등대 앞 98」, gameplay 하위 모듈 목록에 `lighthouse/`(M19-P4).
- CLAUDE.md 새 절 「등대 다시 켜기 (M19-P4)」: 위 「만든 것」 요약. 「명령어」 개수 테스트 배경 97 · build-web 게시 검사 = 버전 한도.
- CONTRACTS: 이벤트 `lighthouse:start|help|stage|lit|scene`, 서비스 `ctx.services.lighthouse`, 상태 `state.lighthouse` (rules.js 맨 위), story 트리거 `lighthouse` · 장면 자리 `lighthouse` (`world.places.lighthouse`).
