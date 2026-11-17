# east-fishboat 어선 · 뱃사공 · 먼바다 낚시 (D275–D279)

브랜치 `east-fishboat` (worktree `../island-worktrees/east-fishboat`, 포트 4322). 같은 때 서쪽 등대 세션(west-lighthouse, CH-20)이 돈다.
사용자 요청: 섬 동쪽 끝에 어선 + 뱃사공 NPC + 도토리를 내고 타는 배로 바다 낚시, 바다에서만 나오는 물고기, 도감 반영 (「밤톨」 = 도토리로 읽음).

## 결정

| 번호 | 무엇 | 고른 것 |
|---|---|---|
| D275 | 어선 선착장 BD-19 | 섬 동쪽 끝 모래 칸에서 바다로 뻗은 짧은 나무 부두(BD-19-1 `fish-dock`, 등불·어망 상자) + 남쪽에 묶인 어선(BD-19-2 `fish-boat`, 하늘색 조타실·뒤 갑판). `world.objects` persist:false — 저장 안 함. 자리 = `layout.json fishDock` 의 z 비율(0.56) 줄 둘레에서 동쪽 끝 첫 모래 칸 (`boat/rules.js findDockSite`). 지금 섬 = 칸 (57, 31), 월드 x 25.5 z 3.5 — 도토리상점 동쪽, 광장과 같은 줄 |
| D276 | 뱃사공 CH-21 | **너울**, 해달(otter). 종족 이유: 지금 섬에 없고 바다·배와 가장 어울림 (서쪽 등대지기와 겹치지 않게 바닷새·거북은 피함). 이름 = 바다의 큰 물결. 새 부품 없이 곰 둥근 귀 + 곰 주둥이 + 긴 꼬리 (`build_character.py FEATURES.otter`). 노란 비옷 · 남색 바지, 말끝 「~이여」. 대사 `assets/boat/neoul.json` (밤톨 주민 파일 모양 lines — 이사 주민이 아니라 `VILLAGER_FILES` 에 넣지 않음) |
| D277 | 배 값·시간 | 뱃삯 🌰 300 (처음 한 번 공짜), 하루 횟수 제한 없음, 먼바다 **게임 시간 2시간** (20분 남으면 알림) → 저절로 돌아옴 · 배 위 너울에게 「돌아가요」 · 05:00 새 날. 낚싯대가 없으면 안 태움. 값은 `assets/boat/boat.json fare·trip` |
| D278 | 먼바다 물고기 IC-OF-01–12 | 분류는 물고기(fish) 그대로, 서식지 `offshore` (섬 물 다섯 곳·무인도 바다 어디에도 없음). 도감 물고기 탭 · 박물관 물고기관(줄이 촘촘해짐) · 대회 · 상점이 그대로 받는다. 표 값 `items.json offshore`, 아이템 `src/data/offshore-items.js` (code OF-NN, `offshore: true`) |
| D279 | 먼바다 자리 | x **1100** (실내 500–700 · 투어 900 과 안 겹침, 구역 ±110). 따로 띄운 바다 판 + 어선 + 갑판 구역(`world.addZone`, 갑판 타원 안·조타실 뒤만 걸음). 낚시는 `gather/fishing.js habitatAt` 이 `services.boat.habitatAt` 을 먼저 물어 그대로 돈다. 저장 `state.boat = { met, freeUsed, trips, total, day, caught, seenFirst }` 만 — 배 위는 저장 안 함, 먼바다에서 끈 저장은 부두 앞에서 시작 |

## 먼바다 물고기 표

| ID | 이름 | 시간 | 계절 | 크기(그림자) | 값 |
|---|---|---|---|---|---|
| IC-OF-01 | 날치 | 낮 | 여름 | 2 | 900 |
| IC-OF-02 | 방어 | 종일 | 겨울 | 5 | 4,500 |
| IC-OF-03 | 갈치 | 밤 | 여름~가을 | 4 | 3,200 |
| IC-OF-04 | 만새기 | 낮 | 여름 | 5 | 5,000 |
| IC-OF-05 | 가다랑어 | 종일 | 봄~가을 | 4 | 2,500 |
| IC-OF-06 | 능성어 | 종일 | 연중 | 5 | 4,000 |
| IC-OF-07 | 볼락 | 밤 | 겨울~봄 | 3 | 1,500 |
| IC-OF-08 | 개복치 ✨ | 낮 | 봄~가을 | 6 | 8,000 |
| IC-OF-09 | 청새치 ✨ | 종일 | 여름 | 6 | 15,000 |
| IC-OF-10 | 귀상어 ✨ | 밤 | 여름~가을 | 6 | 12,000 |
| IC-OF-11 | 달고기 | 종일 | 가을~겨울 | 3 | 2,200 |
| IC-OF-12 | 금눈돔 | 밤 | 겨울~봄 | 3 | 3,000 |

✨ = 희귀. 크기 5–6 은 줄다리기(tug.js). 1–12월 · 3·9·14·21시 모두 고를 물고기가 둘 넘는다 (`tests/boat.test.mjs`).

## 흐름

부두 6칸 안 처음 → `boat:meet {first, x, z}` → 장면 **s68** 「뱃사공 너울」(트리거 `boat-meet`) → 너울 Space(99 `boat-keeper`) → 첫 만남 대사 → 「먼바다 낚시 — 🌰 300」 고르기 → 묻기 창 → 어선이 동쪽으로 3초 → 원형 전환 → x 1100 갑판 → 첫 출항이면 `boat:sail {first}` → 장면 **s69** 「첫 먼바다」(트리거 `boat-sail`). 먼바다 물고기를 잡으면 `boat:catch` → 섬 일지 목표 「🚤 먼바다 물고기」(1·10·30마리). 돌아오면 바다에 떨군 것은 부두 앞으로 옮긴다. `boat:return {auto}`.

## 리소스 (모두 status review)

| ID | 무엇 | 파일 |
|---|---|---|
| BD-19-1 | 어선 부두 | `assets/env/specs/fish-dock.json` (`fishboat_env.py b_fish_dock`) |
| BD-19-2 | 어선 | `assets/env/specs/fish-boat.json` (`b_fish_boat`, 먼바다에서도 같은 모델) |
| CH-21 | 뱃사공 너울 | `assets/specs/neoul.json` |
| IC-OF-01–12 | 먼바다 물고기 | `assets/items/specs/fish-<slug>.json` (모두 무지개놀래기 틀에 값만 — 귀상어 망치 머리 · 청새치 창 주둥이(수염 한 쌍으로 대신)는 검수 때 고칠 거리) |
| s68 · s69 | 장면 | `assets/story/scenes/s68-ferryman-meet.json` · `s69-first-offshore.json` (연출안 둘씩, review) |

게시 묶음: 부두·어선·너울 모델은 `daily` 묶음 (`build-web.mjs BOAT_FILES`), `assets/boat/` 는 island 묶음, 새 모듈 `src/gameplay/boat/` · `src/data/offshore-items.js` 는 src 묶음.

## 개수 바꾼 테스트

캐릭터 19 → 20 · 배경 97 → 99 · 아이템 아이콘 185 → 197 · 스펙 162 → 174 · 들어 보이는 모델 94 → 106 · 물고기 22 → 34 · 박물관 전시 55 → 67 · 박물관 total 109 → 121 · 아이템 ID 규칙에 `OF` · 일지 셀 일에 `offshore`. 새 `tests/boat.test.mjs` 셋.

## 검증 안 한 것

절대원칙대로 브라우저·자동 플레이·스크린샷·perf 는 안 했다. `node --test tests/` 만. 그래서 **게임 안에서 한 번도 안 열어 봤다**: 부두·어선이 바다 칸 위에 제대로 보이는지(회전·높이), 너울이 모래 위에 서는지, 갑판 위 걷기·낚싯대 던지기(찌가 바다 판에 뜨는지), 먼바다 하늘·그림자, 장면 s68·s69 카메라, 떠나는 배 연출. 합칠 때 한 번 눈으로 볼 것.

## 문서 세션이 반영할 문장

- CLAUDE.md 「큰 구조」 무인도 투어 절 뒤에: **어선·먼바다 낚시 (east-fishboat, `src/gameplay/boat/`)** — 설정 `assets/boat/boat.json`, 규칙(순수) `boat/rules.js`. 섬 동쪽 끝(layout `fishDock`)에 부두 BD-19-1 + 어선 BD-19-2 (persist:false), 뱃사공 너울 CH-21(해달, 대사 `assets/boat/neoul.json`) 말 걸기 99 → 뱃삯 🌰 300(처음 공짜) → **x 1100** 먼바다 갑판 구역 (게임 2시간 · 05:00 · 너울에게 말하면 돌아옴). 낚시는 `fishing.js habitatAt` 이 `services.boat.habitatAt` 을 먼저 물어 서식지 `offshore` → 먼바다 물고기 IC-OF-01–12 (분류 fish, `src/data/offshore-items.js`, 표 `items.json offshore`). 저장 `state.boat` 만. 장면 s68(`boat-meet`)·s69(`boat-sail`), 일지 목표 `offshore` (`boat:catch`). 노트 `docs/notes/east-fishboat.md`.
- CLAUDE.md 「명령어」 개수 박힌 테스트 문단: 아이템 ID 규칙에 `OF`.
- 실내 x 자리 문단: 먼바다 x 1100 (구역 ±110, 정리 기준 ox − 100) 더하기. tour 의 game:ready 가 x > 800 이면 투어 선착장으로 옮기므로 boat 는 gameplay 목록에서 tour 뒤 (나중에 부두 앞으로 다시 옮김).
- CONTRACTS 끝에 「어선」: `services.boat = { active, busy, habitatAt(x, z) → 'offshore'|null|undefined, go, back, site(), left(), config }`, 이벤트 `boat:meet|sail|catch|return`.
