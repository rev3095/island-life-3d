# P54 밤 특별 상점 · 미술품 · 운세 부스 (사용자 요청 3·4·5번, 결정 D165–D169)

브랜치 `p54-night-special` (main 2299be4 에서), 작업 폴더 `../island-worktrees/p54-night-special`, 포트 4265. **진행 중 (사용 한도로 중간에 멈춤)**.

## 결정 (추천안으로 정함 — 보드 없음)

| 결정 | 내용 | 파일 |
|---|---|---|
| D165-A 미술품 `art` | 진품 16 IC-AR-01–16 (그림 01–10 · 조각 11–16, 오리지널 작품명), 가품 8 = 같은 모델의 색 변형 `art.<slug>-fake` (이름·설명 같음, 아이콘 한 색이 다름 `tell`). 가품은 `list('art')` 밖 · 박물관이 안 받음. `COLLECTIBLE` + art | `assets/data/items.json art` · `src/data/art-items.js` · `items.js` · `museum.js`(두 줄) |
| D166-A 이상한 천막 BD-13 / RM-19 | 밤 21–5시, 30% (7일 넘게 안 서면 꼭), 북서쪽. 주인 없음 — 받침 하나에 미술품(60%, 가품 40%) 또는 수상한 궤짝 FU-75, 받침 앞 「보기」로 산다. 첫 방문 장면 s28 | `night.json odd` · `places/oddtent.json` |
| D167-A 여우 상인 살랑 CH-17 · BD-14 / RM-18 | 밤 20–5시, 열린 첫날 밤 꼭 · 그 뒤 35% (6일 넘게 안 오면 꼭), 서쪽. 받침 셋에 미술품 2–3점 (가품 반쯤). 말 걸기 → 고르기 → 감정 대사(진품/가품 다른 말) → 값 → 사기 (한 밤에 한 점). 여우불 등 FU-73 은 상점 창. 첫 만남 s27 | `night.json fox` · `places/foxshop.json` · `night/index.js talkFox` |
| D168-A 운세 부스 BD-15 / RM-20 | 밤 20–3시 매일, 광장 남서쪽. **점쟁이는 새 캐릭터 대신 여명 CH-15 를 옮김**: 저녁엔 부스, 3시엔 새벽 천막. 카드 뽑기 UI-20 은 여명에게 말할 때만, 하루 한 장을 둘이 같이 씀 (`state.night.tarot`). 부스 물건 점괘 등 FU-76 · 타로 액자 FU-78, 천막은 수정 구슬 그대로 | `night.json fortune` · `places/fortune.json` · `talkTent(kind)` |
| D169-A 선물 상자 PR-35 | 낮·밤, 날마다 50% 섬 풀밭 어딘가(씨앗·날로 정함). 행동 키 「선물 상자 열기」(55) → 미술품 25%(가품 반) · 가구/별사탕 · 도토리 200–600, 창 없이 알림만 | `night.json gift` · `syncGift/openGift` |

서는 날·진열은 모두 `rules.js` 의 (섬 씨앗 · 날) 난수 (`visitsToday` · `foxStock` · `oddStock` · `giftPlan` · `pickCell`). 실내 자리 `room.js PLACE_ROOMS` z 60 줄 (fortune 620 · foxshop 660 · oddtent 700). 점검용 `night.debug.force({ foxshop: true, oddtent: true })` · `debug.today()`.

## 한 것 (커밋됨)
- 데이터·규칙·밤 모듈 일반화(밤 가게 다섯 = `NIGHT_PLACES`), 실내 셋 JSON, 장면 s27·s28 (+ index·files.js·editor-files), story `NIGHT_KINDS` 확장, check-interiors 문 셋 + force, 테스트 개수·새 테스트 (night.test P54 다섯).
- 고리: `placedata.js` PLACE_FILES/KINDS/BUILDING 에 push, `room.js` PLACE_ROOMS 에 assign (실내 트랙 파일 — 짧은 줄만).

## 남은 것
1. **Blender 모델** (부속 에이전트가 이 작업 폴더에서 만들던 중, 커밋 안 됨): 미술품 16 스펙 `assets/items/specs/art-*.json` · 가구 FU-73·75·76·78 · 붙박이 FU-74 `art-plinth` · FU-77 `fortune-table` · env BD-13 `odd-tent` · BD-14 `fox-shop` · BD-15 `fortune-booth` · PR-35 `gift-box` · 캐릭터 `assets/specs/salang.json`. 빌더는 새 파일 `assets/blender/night_special_*.py` + 기존 빌더 BUILDERS 뒤 한 줄. `git status` 로 확인 → 빌드 결과 보고 커밋.
2. 그 뒤 `node --test tests/` 전체 (기대 개수: 캐릭터 16 · 배경 80 · 가구 54 · 아이템 스펙 119 · 아이콘 140).
3. 자동 플레이 「밤 상점」 단계 (`tests/playthrough/scenario.js` 에 아직 없음 — 운세 부스 카드 · 여우 상인 살랑 대화 · 이상한 천막 · 선물 상자).
4. `node tools/check-interiors.mjs --hours=22,26,28 --port=4265`, 개발 서버 직접 확인(콘솔 오류 0).
5. 박물관 트랙(p57-museum-stars)과 정함: museum.js 두 줄(KINDS = COLLECTIBLE · 가품 거절)은 이 브랜치가 하고, 미술관은 `items.list('art')` 순서로 그림 액자·조각 받침에 `museum.has(id)` 인 것만 놓는다. **가품 거절 대사(느루, `town/keepers.js`)는 어느 트랙도 안 함** — 지금은 기증 창에 가품이 안 뜰 뿐 까닭을 말해 주지 않는다 → 뒤 일감 (keepers.js 에 「이건 가품이에요… {tell}」 한 줄).
6. 알려진 한계: 실내 「보기」로 사면 여우의 한 밤 한 점 제한을 안 거침(가방에 든 작품은 받침에서 빠짐). 가품 3D 모델은 실내 진열에서 진품 색 (아이콘만 다름). 미술품을 집에 놓기는 없음.

## 문서 세션이 반영할 문장
- CLAUDE.md 「밤 · 새벽」: 「P54 밤 특별 상점 (D165–D169): 운세 부스 BD-15 20–3시(여명이 저녁엔 부스, 3시엔 새벽 천막 — 카드는 하루 한 장 같이) · 여우 상인 살랑 CH-17 BD-14/RM-18 (오는 밤만, 미술품 2–3점 진품·가품) · 이상한 천막 BD-13/RM-19 (오는 밤만, 주인 없음) · 선물 상자 PR-35. 미술품 분류 `art` IC-AR-01–16 (`src/data/art-items.js`, 가품 `-fake` 는 list 밖·기증 불가). 노트 `docs/notes/night-special.md`.」
- CLAUDE.md 실내 줄: 「P54 밤 실내 셋은 z 60 줄 (620·660·700)」.
