# P54 밤 특별 상점 · 미술품 · 운세 부스 (사용자 요청 3·4·5번, 결정 D165–D169)

브랜치 `p54-night-special` (main 2299be4 에서), 작업 폴더 `../island-worktrees/p54-night-special`. 점검 포트는 4265 를 받았지만 다른 세션 서버가 쓰고 있어서 **4268** (`.claude/launch.json` 「p54-night-special」) 로 돌렸다.
모든 가게는 직접 걸어 들어가는 실내이고, 창은 NPC 에게 말할 때만 뜬다 (진열품 앞 「보기」는 다른 가게와 같은 P45 모양).

## 결정 (추천안으로 정함 — 보드 없음)

| 결정 | 내용 | 파일 |
|---|---|---|
| D165-A 미술품 `art` | 진품 16 IC-AR-01–16 (그림 01–10 · 조각 11–16, 오리지널 작품명·구도), 가품 8 = 같은 모델의 색 변형 `art.<slug>-fake` (이름·설명은 진품과 같고 아이콘 한 색이 다름 — `tell`). 가품은 `list('art')` 밖 · 박물관이 안 받음 · 팔면 30. `COLLECTIBLE` + art | `assets/data/items.json art` · `src/data/art-items.js` · `items.js` · `museum.js`(두 줄) |
| D166-A 이상한 천막 BD-13 / RM-19 | 밤 21–5시, 30% (열린 지·마지막으로 선 지 7일 넘으면 꼭). 주인 없음(`unattended`) — 받침 하나에 미술품(60%, 가품 40%) 또는 수상한 궤짝 FU-75, 받침 앞 「보기」로 산다. 첫 방문 장면 s28 | `night.json odd` · `places/oddtent.json` |
| D167-A 여우 상인 살랑 CH-17 · BD-14 / RM-18 | 밤 20–5시, 열린 첫날 밤 꼭 · 그 뒤 35% (6일 넘게 안 오면 꼭). 받침 셋에 미술품 2–3점 (가품이 있는 작품은 반쯤 가품). 말 걸기 → 「미술품 보기」 → 고르기 → 감정 대사(진품·가품 다른 말 — 가품엔 「색이 특별하지?」 식 힌트) → 값 → 사기 (한 밤에 한 점). 여우불 등 FU-73 은 상점 창. 첫 만남 s27 | `night.json fox` · `places/foxshop.json` · `night/index.js talkFox` |
| D168-A 운세 부스 BD-15 / RM-20 | 밤 20–3시 매일. **점쟁이는 새 캐릭터 대신 여명 CH-15 를 옮김**: 저녁엔 부스, 3시엔 새벽 천막 (시간이 안 겹침). 카드 뽑기 UI-20 은 여명에게 말할 때만, **하루 한 장을 둘이 같이 씀** (`state.night.tarot.drawnOn`). 부스 물건 점괘 등 FU-76 · 타로 액자 FU-78, 천막은 수정 구슬 그대로. 부스 첫 대사 `lines.yeomyeong.firstBooth` | `night.json fortune` · `places/fortune.json` · `talkTent(kind)` |
| D169-A 선물 상자 PR-35 | 낮·밤, 날마다 50% 섬 풀밭 어딘가(씨앗·날로 정함). 행동 키 「선물 상자 열기」(55) → 미술품 25%(가품 반) · 가구/별사탕 · 도토리 200–600, 창 없이 알림만 | `night.json gift` · `syncGift/openGift` |

- 서는 날·진열은 모두 `rules.js` 의 (섬 씨앗 · 날) 난수 (`visitsToday` · `foxStock` · `oddStock` · `giftPlan` · `pickCell`) — 같은 날엔 다시 열어도 같다.
- 실내 자리 `room.js PLACE_ROOMS` **z 60 줄** (fortune 620 · foxshop 660 · oddtent 700) — x 줄 끝에 다른 실내가 더해져도 안 겹치게.
- 점검용 `night.debug.force({ foxshop: true, oddtent: true })` (저장 안 함, check-interiors 가 씀) · `debug.today()`.

### 새벽 천막과 역할 정리
- 예전: 새벽 천막(3–5시)만 타로. 지금: 운세 부스(20–3시)가 주 타로 자리, 새벽 천막은 그대로 서고 여명이 3시에 옮겨 와서 카드(그날 아직 안 뽑았으면) · 수정 구슬. 하루 한 장은 그대로.
- s21(새벽 천막 첫 방문)은 여명을 처음 만난 곳이 부스면 `met.yeomyeong` 이 있어 안 나온다 (예전 저장 처리와 같은 줄) — 스토리 편집기에서 s21 을 「여명이 옮겨 온 천막」 장면으로 바꿀지 고르면 좋다.

### 건물 자리 (반영하며 바꿈)
- 지금 섬(64×56)은 빽빽해서 3×3 풀밭 빈 곳이 거의 없다. 처음 계획(북서쪽·풀밭만)으로는 이상한 천막이 새벽 천막 자리를 가로채 **새벽 천막이 안 서는** 일이 생겼다 → 고침:
  - 자리 찾기를 **하나씩** (`placing` 줄) — 같은 틱에 두 건물이 같은 자리를 고르던 것.
  - **앞 순서 먼저**: `NIGHT_PLACES` = 달빛 가게 → 새벽 천막 → 운세 부스 → 여우 → 이상한 천막. 뒤 건물은 앞 건물 자리를 (아직 안 섰어도) 미리 정해 두고 피한다.
  - 새 건물 셋은 섬 전체(`reach 30`)에서, 바닥으로 풀밭·모래·광장·길도 쓴다 (`ground`). 개발판 새 게임: 운세 부스 서쪽(-20.5, -2.5) · 여우 남쪽 해변(5.5, 20.5) · 이상한 천막 동쪽(13.5, -3.5).
  - 자리가 아예 없으면 그날 안 서고 경고 한 번.

## 점검 결과 (2026-11-12)
- `node --test tests/` — 485 중 484 통과 (1 건너뜀), 실패 0. (P54 새 테스트: night.test 다섯 — 설정 · 미술품·박물관 · 서는 날·진열·선물 · 건물 자리 · 실내)
- `node tools/check-interiors.mjs --hours=22,26,28 --port=4268` — **문제 0**. 운세 부스 22·26시 · 여우 상인 가게 22·26·28시 · 이상한 천막 22·26·28시 모두 들어가고 「보기」 다 됨 (부스 1/1 · 여우 3/3 · 천막 1/1), 새벽 천막 28시 그대로. 결과 `docs/qa/runs/2026-11-12-19-51-interiors`.
- 자동 플레이 `node tools/playtest.mjs --port=4268 --only=boot,naming,arrival,clock,fd-tool,fd-gather,fd-catch,fd-sell,fd-donate,fd-home,buy-tools,day2,night,night-shops` — **14 단계 모두 통과, 콘솔 오류 0** (480초). 「밤 상점」: 운세 부스 여명 카드 TA-03 · 선물 상자에서 미술품 「등대가 있는 곶」 · 여우 상인 첫 만남 s27 → 살랑 대화·미술품 3점 (도토리 모자라 못 삼) · 이상한 천막 s28 → 궤짝 진열. 처음 돌렸을 땐 부스 말 거는 자리가 여명에게서 2.6칸 경계라 「말 걸기」가 안 떠서 고침 (말 거는 자리 0.9칸 안이면 됨).
- 개발 서버 직접 확인: 밤 22시 30분에 달빛 가게·운세 부스·여우·이상한 천막·선물 상자가 다 다른 자리에 서고, 새벽 3시 30분엔 새벽 천막도 선다. 콘솔 오류 0 (경고는 자리 못 찾음 한 번뿐이었고 고침).

## 모델 (status review, 부속 에이전트가 Blender 스크립트로)
- 빌더 새 파일 `assets/blender/night_special_{items,furniture,env}.py` + 기존 빌더 셋에 BUILDERS 뒤 한 줄 (`BUILDERS.update(…builders(globals()))`).
- 미술품 16 (그림 0.57×0.32×0.48 · 조각 0.32×0.32×0.4–0.6, 삼각형 930–2752) · 가구 FU-73·75·76·78 · 붙박이 FU-74 미술품 받침(1×1, 높이 0.35) · FU-77 운세 탁자(2×2, 4886 삼각형 — 바닥까지 늘어진 천) · 건물 BD-13 2996 · BD-14 4804 · BD-15 3302 · 선물 상자 PR-35 1548 · 살랑 CH-17 11372.
- 개수: 캐릭터 16 · 배경 80 · 가구 54 (+ 붙박이 14) · 아이템 스펙 119 · 아이콘 140.
- 살랑은 반쯤 감은 눈 부품이 없어 눈 크기 0.86 + 안경으로 「능청」을 냄.

## 남은 것 · 제안
1. **가품 거절 대사** (느루, `town/keepers.js`): 박물관 트랙(p57-museum-stars)과 정함 — museum.js 두 줄은 이 브랜치, 미술관(그림 액자·조각 받침, `items.list('art')` 순서, `museum.has` 만)은 그쪽, 가품 대사는 **어느 트랙도 안 함**. 지금은 기증 창에 가품이 안 뜰 뿐 까닭을 말해 주지 않는다 → 뒤 일감 「이건 가품이에요… {tell}」.
2. 실내 「보기」로 사면 여우의 「한 밤에 한 점」을 거치지 않는다 (가방에 든 작품은 받침에서 빠짐). 가품 3D 모델은 실내 진열에서 진품 색 (아이콘만 다름 — places.js 가 변형 색을 안 칠함).
3. 미술품을 집에 놓기 없음 (집 트랙 M14 와 이어서).
4. 자동 플레이 봇은 도토리가 모자라 살랑에게서 못 산다 (대화·고르기·감정 대사까지는 돎).
5. **실내 트랙 파일을 건드린 곳** (짧은 줄): `placedata.js` PLACE_FILES/KINDS/BUILDING push · `checkPlace` 에 `unattended`(주인 없는 곳은 계산대·주인 검사 안 함) · `room.js` PLACE_ROOMS assign. 이야기 트랙: `story/rules.js` NIGHT_KINDS · `story/files.js`. 도구: `check-interiors.mjs` 문 셋 + force.

## 문서 세션이 반영할 문장
- CLAUDE.md 「밤 · 새벽」: 「P54 밤 특별 상점 (D165–D169): 운세 부스 BD-15 20–3시(여명이 저녁엔 부스, 3시엔 새벽 천막 — 카드는 하루 한 장 같이) · 여우 상인 살랑 CH-17 BD-14/RM-18 (오는 밤만, 미술품 2–3점 진품·가품, 감정 대사) · 이상한 천막 BD-13/RM-19 (오는 밤만, 주인 없음 `unattended`) · 선물 상자 PR-35 (낮·밤). 밤 건물 자리는 `NIGHT_PLACES` 순서로 하나씩 정한다. 미술품 분류 `art` IC-AR-01–16 (`src/data/art-items.js`, 가품 `-fake` 는 list 밖·기증 불가). 노트 `docs/notes/night-special.md`.」
- CLAUDE.md 실내 줄: 「P54 밤 실내 셋은 z 60 줄 (620·660·700)」.
- CLAUDE.md 명령어 `check-interiors` 줄: 「…달빛 가게·새벽 천막·운세 부스·여우 상인 가게·이상한 천막」.
- CONTRACTS 「밤 · 새벽」: `night.places()` · `night.giftSpot()` · `night:art` `{id, fake, from}` · `night:gift` · `night:visitor` 이벤트, `stockGroups(kind)` 의 `art` 묶음.
