# M11 옷 갈아입기 · 주민 12명 (보드 wave11 반영 v1 = D100–D105 모두 A)

2026-11-11 · 브랜치 `p38-m11` (main 8eb29b2 에서) · 포트 4243 (4239 는 리소스 편집기 확인, 4241 은 최적화 세션 perf-bench 가 씀).
11차 검수 보드 https://claude.ai/artifact/SKNtCRjBfZEJ1iES9hcWKY (`concept/wave11-board.html`, `applied/wave11` v1). 약속은 `docs/CONTRACTS.md` 「11차 옷」.

| 결정 | 이 브랜치가 한 것 |
|---|---|
| D100-A 옷 갈아입기 | 모자 · 윗옷 · 신발 칸, 상점에서 사서 옷장에서 갈아입기 (P2–P4) |
| D101-A 주인공만 | 주인공 모델만 몸 · 옷으로 나눔. 주민 13종 모델은 손대지 않음 |
| D102-A 상점 진열대 | 도토리상점 문 오른쪽 옷 진열대 FU-54, 하루 옷 둘 |
| D103-A 12명 + 집터 둘 | `moving.max` 12, 남는 집터 셋 (P1) |
| D104-A 아티팩트 유지 | 바꿀 것 없음 (옷 묶음도 아티팩트 한도 안) |
| D105-A 자동 플레이 둘 다 | 벽지 단계 QA-10 은 남은 장면·QA 세션 몫. 여기서는 옷 단계만 더함 |

## P1 주민 12명 + 집터 둘 (D103-A)

- `assets/data/rules.json` `moving.max` 10 → 12, `src/gameplay/town/moving.js` 기본값·주석도 12. 요소 편집기 「이사」 칸은 이미 `max: 12` 까지 받는다 (`elem-editor/sheets.js`).
- `src/world/island.js` `SPARE_LOTS` = `[[0.6, 0.64], [0.3, 0.7], [0.7, 0.75]]`. 기본 섬(시드 20261028)에서:
  - `spare-1` (8.5, 5.5): 10차 그대로, 상점·단풍 집 사이 강가.
  - `spare-2` (-8.5, 9.5): 서쪽, 모찌 집 옆.
  - `spare-3` (19.5, 8.5): 동쪽, 단풍 집 옆.
  차례로 찾고 앞 집터 자리를 예약 칸으로 바꾸니 **늘 끝에만 더한다**. 그 자리 풀·나무만 생성 목록에서 빠진다 (물체 308 → 297 + 집터 둘). 다른 물체 id·난수는 그대로라 예전 저장도 열린다. 다만 그 자리에 있던 나무 몇 그루는 사라진다.
- 처음 주민 7 + 남는 집터 3 = 새 주민 셋(구름 · 파도 · 달무리)이 아무도 떠나지 않아도 모두 들어온다. 이사 단계·편지·장면은 10차 그대로다.
- 테스트 `tests/moving.test.mjs`: 12명 한도, 집터 셋이 서로·다른 건물과 안 겹침, spare-1 자리가 그대로임.

## P2 몸 · 옷 나누기 + 옷 끼우는 틀

- `assets/specs/player.json` v0.2.0 (review):
  - `clothes: { split: true, top: "basic-tee" }`.
  - 동작에 `spin` 을 더했다.
- `assets/blender/build_character.py` 는 `clothes.split` 이면 윗옷(shirt · stripe 면)을 따로 된 메시 `player_top` 으로 뗀다.
  - 법선은 떼기 전 합친 몸에서 재서 넣는다 (`normals_split_custom_set_from_vertices`). 그래서 자른 자리의 음영도 같다.
  - **처음 모습 비교**: 지난 렌더 12장과 화소를 비교했다. 680k 화소 중 24 넘게 다른 화소는 1–16개(외곽선 반올림). 삼각형은 10,604 그대로이고, 앉는 자리 `sit` 값도 그대로다.
- AN-12 `spin(t)`: 26장(1.1초). 뿌리 뼈가 Y 로 한 바퀴 돌고, 팔을 살짝 벌리고 가볍게 뜬다. 끝 자세는 서기.
- `build_clothes.py` (새):
  - `build_character.py` 를 그대로 exec 한다. `WEAR` 고리를 넘겨 같은 몸 수치 · 같은 뼈대로 옷 메시만 만든다.
  - 내보내는 것은 뼈대 + 옷이고, 동작은 없다.
  - 렌더는 옷을 입은 주인공 보기 넷 + 걷기 + 썸네일(3/4)이다.
  - 팔레트 키가 몸 팔레트와 겹치면 멈춘다.
- `src/player/wear.js` (새, three 를 import 하지 않음):
  - `bindClothes` 가 뼈 이름으로 다시 묶는다 (three 가 `arm.L` → `armL` 로 바꾸는 것까지).
  - 그 밖에 `setBaseTop` · `SLOT_BONES` · `paletteOf` · `wearName` 이 있다.
  - 게임과 리소스 편집기가 같이 쓴다. 편집기 게시본은 이 파일을 그대로 올린다 — **다른 src 모듈을 import 하게 되면 편집기 게시 목록에도 넣는다**.

## P3 옷 12벌 (status review)

`node tools/build-clothes.mjs --all --jobs 4` 를 돌리면 4개씩 동시에 만들고, 한 벌에 4초 안팎 걸린다. 목록은 `assets/clothes/index.json` 이다.

| ID | slug | 이름 | 칸 | 색 변형 | 값 | 삼각형 |
|---|---|---|---|---|---|---|
| CL-00 | basic-tee | 기본 티셔츠 | 윗옷 | — (player `shirt`) | 안 팖 | 1,116 (`player_top`) |
| CL-01 | straw-hat | 밀짚모자 | 모자 | — | 1,400 | |
| CL-02 | knit-beanie | 털모자 | 모자 | — | 1,200 | |
| CL-03 | flower-pin | 꽃 머리핀 | 모자 | — | 900 | |
| CL-04 | sailor-cap | 선원 모자 | 모자 | — | 1,600 | |
| CL-05 | striped-tee | 줄무늬 티 | 윗옷 | 바다 · 딸기 | 1,400 | |
| CL-06 | overalls | 멜빵 | 윗옷 | 청 · 도토리색 | 2,200 | |
| CL-07 | wool-sweater | 털 스웨터 | 윗옷 | 단풍 · 민트 | 2,400 | |
| CL-08 | raincoat | 비옷 | 윗옷 | 노랑 · 분홍 | 2,000 | 3,048 △ |
| CL-09 | festival-vest | 축제 조끼 | 윗옷 | 솔잎 · 자두 | 2,600 | |
| CL-10 | sneakers | 운동화 | 신발 | — | 1,200 | |
| CL-11 | rain-boots | 장화 | 신발 | — | 1,500 | |
| CL-12 | sandals | 샌들 | 신발 | — | 1,000 | |

- 판 값은 사는 값의 ¼ 이다 (아직 팔기는 없다 — 옷장에서 버리기 · 팔기는 열린 것).
- 축제 조끼는 한복 느낌(앞트임 · 고름 매듭)만 빌린 오리지널 디자인이다.
- 확인 렌더는 `assets/clothes/renders/<slug>_three_quarter.png` 다.
- 처음 빌드 뒤 고친 것: 줄무늬 굵기와 소매 끝 줄, 꽃 핀 자리(뒤로 숨던 것), 선원 모자 높이.
- 상점 붙박이 **FU-54 옷 진열대** `clothes-rack` (review): `node tools/build-furniture.mjs --fixtures clothes-rack`. 생김새는 2×1 낮은 단(윗면 0.14) + 가로대 1.12 + 옷걸이 둘 + 값표.

### 리소스 편집기 「옷」 영역 (https://claude.ai/artifact/1weSx9yyf2U4mLnwvopBNV — **아직 다시 게시 안 함**)

`res-editor.html` 의 탭 「옷」(13벌, 주소 끝 `#cloth-<slug>`, 예: `#cloth-straw-hat`)은 옷마다 3D 로 **주인공이 입은 모습**을 보여 준다.
- 캐릭터 묶음의 player 에 `src/player/wear.js` `bindClothes` 로 다시 묶는다. 윗옷이면 `setBaseTop(false)` 로 기본 윗옷을 숨긴다. 동작은 idle · walk · spin 등이다.
- 함께 보여 주는 것: Blender 렌더(입은 모습 보기 넷), 색 변형 버튼, 칸 · 값 · 변형 수, 교체 약속 표.
- 기본 윗옷 CL-00 은 몸 모델 안의 `player_top` 이라 player 모델 · 렌더를 그대로 쓰고, 목록 · 상태 · 색만 검사한다.

옷 약속은 `tools/res-contracts.mjs` 의 area `clothes` 다.
- 목록 · 상태 · 색 (변형 포함)
- 재질 = 팔레트 키
- 몸 재질 이름(fur · hair · shirt · pants · eye · blush · outline · eyeHighlight)과 안 겹침
- skin 이 있음
- 뼈대 이름 = 주인공 10개
- 무게가 실린 뼈 ⊆ `SLOT_BONES[slot]`
- 삼각형 3,000 넘으면 △

묶음은 `node tools/build-editor-index.mjs` 가 `assets/res/editor-clothes.json` · `editor-clothes-models.json` · `editor-clothes-renders-<n>.json` 으로 만든다. 옷마다 낱개 파일은 없고, 게시 목록에 `src/player/wear.js` 가 들어간다.
- 결과: 리소스 282개 · 어긋남 0 · △ 4 (구름 · 파도 · 여명 삼각형 + 비옷 3,048).
- 게시 목록 `dist/res-editor/publish.json` = 105개 · 196MB (한도 511개 · 256MB), 차례 4개.
- 로컬 확인(4239): 13벌, 밀짚모자가 머리에 얹힘, 줄무늬 티를 입히면 청록 기본 티가 사라짐, 딸기 변형으로 색이 바뀜, 375px 넘침 0, 콘솔 오류 0, 요청 저장(`area 'clothes'`, `cat 'hat'`, `ref 'CL-01'`).

**"리소스 요청 확인" — 옷 요청 처리**: 요청은 `res-requests` 에 `key: 'cloth-<slug>'`, `area: 'clothes'`, `cat: hat|top|shoes`, `ref: 'CL-NN'` 으로 온다. kind 는 다른 영역과 같다.
- `edit · blender`:
  - `fields.palette` → 스펙 `palette`, `fields.values` → `params.<키>.value`, `concept` → `prompt.concept`.
  - 스펙 `version` 을 올리고, 확정이던 것은 `status: "review"` 로 바꾼 뒤 `node tools/build-clothes.mjs <slug>` 로 다시 만든다.
  - CL-00 은 `assets/specs/player.json` palette `shirt` 를 고쳐 `node tools/build-character.mjs player` → `node tools/build-clothes.mjs --index`.
- `swap · file`: 만든 .glb 는 주인공 뼈대(player_rig, 쉰 자세 같음)에 다시 맞추고, 재질 이름을 옷 팔레트 키로 바꾼다. 요청에 붙은 `checks` 의 ✗ 부터 본다.
- 옷은 로컬 3D 생성을 쓰지 않는다 (뼈대 · 무게가 없음). 레퍼런스 그림만 쓴다.
- `approve` · `reopen`: 스펙 `status` 만 바꾸고 `node tools/build-clothes.mjs --index`.
- 그다음은 공통 순서와 같다: `node tools/build-editor-index.mjs` (약속 어긋남 0 확인) → `node --test tests/` → 바뀐 묶음(`assets/res/editor-clothes*` + `editor-index.json`)만 다시 게시.

## P4 옷장 · 상점 · 저장 · 빙글

- **옷 서비스** `src/player/outfit.js` (`ctx.services.outfit`, player 모듈이 켬)와 규칙 `src/player/outfit-rules.js` (순수).
  - 저장 칸: `state.player.outfit` · `state.player.closet`.
  - 옷 모델은 받는 대로 입힌다. 시작은 기다리지 않아서, 받는 동안은 기본 모습이다.
  - 겹친 요청은 세대 번호로 마지막 것만 입힌다.
- **옷장 창 UI-19** `src/ui/closet.js`:
  - 여는 곳: 집 옷장(FU-12) 메뉴 첫 칸 「갈아입기」.
  - 칸 탭은 모자 · 윗옷 · 신발. 모자 · 신발은 「없음」이 있고, 윗옷은 기본 티가 맨 앞이다.
  - 고르면 바로 입어 보고, 「입기」를 누르면 저장 + 빙글. 「그만두기」 · Esc 는 원래 옷으로 돌아간다.
  - 창 자리: 데스크톱은 오른쪽 붙임, 좁은 화면 · 세로 휴대폰은 아래 붙임. 막은 연해서 입어 보는 주인공이 보인다.
- **상점**:
  - 도토리상점 계산대 창 사기 탭에 「오늘의 옷」 칸이 있다 (`ui.shop.open({ clothes: true })`, `town/keepers.js`).
  - 고르면 창 뒤 주인공이 그 옷을 미리 입는다. 사는 길은 둘: 「사서 바로 입을게요」 · 「사기만 할게요」.
  - 산 옷은 가방이 아니라 옷장으로 간다.
  - 첫 옷이고 집 · 가방에 옷장이 없으면 옷장 가구를 가방에 받는다 (`rules.json` `shop.clothesGiftWardrobe`, `state.flags.wardrobeGift`).
- **진열대**:
  - `places/shop.json` v4 에 FU-54 (gx 6 · gz 6) + 진열 줄 `group: 'clothes'` (dx 0.9, y 0.14, hang 1.06).
  - 윗옷은 가로대에 걸고, 모자 · 신발은 아래 단에 둔다 (`places.js` `stockJobs`). 진열은 옷장에 있는 옷이어도 그대로다.
- **진열 규칙** `rules.json` `shop.clothesPerDay` 2 (0–2):
  - 같은 날 같은 옷이 나오고, 같은 옷의 다른 색은 같은 날 안 나온다.
  - 요소 편집기 「상점」 시트에 「옷 진열대 (11차)」 두 칸(하루 옷 수 · 첫 옷과 옷장 주기)이 있다.
- **웹 빌드**:
  - `PACKS` 맨 앞에 `clothes` 를 둔다. 처음에 받지 않고 1.33MB 다.
  - `assets/clothes/index.json` 은 섬 묶음(boot)이다.
  - `FAMILIES` 에 `clothes` 를 더했다.

## P5 마무리

- 자동 플레이 단계 `clothes` (`tests/playthrough/scenario.js`, 시계 단계 뒤 · 투어 앞):
  - 흐름: 오늘의 옷 중 가장 싼 것 → 도토리가 모자라면 남는 것 팔기 → 상점 「사기만」 → 집에 옷장 놓기(덤) → 옷장 「갈아입기」 → 칸 탭 → 옷 → 「입기」 → 입은 옷 확인.
  - 기술은 `skills.js` 의 `sk.shop({ clothes })` · `sk.changeClothes(id)` 다.
- 테스트: 441 → 452 (+ `tests/outfit.test.mjs` 7, 리소스 편집기 옷 4).
  - 개수를 박은 테스트도 고쳤다: `places.test.mjs` 붙박이 FU-54 · 쓰인 붙박이 수, `build-web.test.mjs` 옷 썸네일, `res-editor.test.mjs` 268 → 282, `moving.test.mjs`.
- **게임 확인** (머리 없는 Chrome, 새 게임 `?date=2027-03-01`, 준비로 도토리만 넣음):
  - 상점 「오늘의 옷」에 운동화 · 선원 모자가 나왔다. 운동화를 「사서 바로 입을게요」 → 옷장에 들어가고 입었고, 옷장을 덤으로 받았다 (`given`).
  - 선원 모자를 「사기만」 → 옷장 창에서 입어 보기는 저장되지 않았다 → 「입기」 하자 `{hat: 'sailor-cap', top: 'basic-tee', shoes: 'sneakers'}` 가 저장됐다.
  - 주인공에 `outfit:hat` · `outfit:shoes` 가 붙었다.
  - **다시 열어도 그대로** (입은 옷 · 옷장 · 메시).
  - 상점 실내 진열대 아래 단에 운동화 · 선원 모자가 놓였다. 콘솔 오류 · 실패 요청 0.

### 잰 것

(아래 「자동 플레이 · 행사 점검 · GPU」 절에 이어 적음)

## 문서 세션이 반영할 문장 (지금은 고치지 않음)

**CLAUDE.md**
- 명령어 절, `build-furniture` 줄 다음에:
  > `node tools/build-clothes.mjs straw-hat | --all [--jobs 4] | --index   # 11차 옷 12벌 (assets/clothes — 주인공 몸과 같은 뼈대, build_clothes.py 가 build_character.py 를 exec)`
- 명령어 절 개수 테스트 줄 끝에:
  > 옷을 더하면 `tests/outfit.test.mjs` (13벌 · 칸별 4·5·3 · 상점 후보 수) 와 `tests/res-editor.test.mjs` 전체 수.
- 「에셋 파이프라인」 캐릭터 줄 뒤:
  > 주인공은 몸 · 기본 윗옷으로 나뉜다 (`player.json` `clothes.split` → 메시 `player` + `player_top` = CL-00). 옷은 `assets/clothes/specs` → `build_clothes.py` → `assets/clothes/models/<slug>.glb.json` (뼈대 + 옷, 동작 없음), 게임은 `src/player/wear.js` 로 주인공 뼈대에 이름으로 다시 묶는다.
- 「큰 구조」에 새 절 (밤 · 새벽 절 앞):
  > ### 옷 갈아입기 (M11, `src/player/outfit.js`)
  > - 보드 wave11 반영 v1 (D100–D105 모두 A). 모자 · 윗옷 · 신발 칸, 주인공만. 서비스 `ctx.services.outfit` (규칙 `outfit-rules.js`, 끼우기 `wear.js`), 저장 `state.player.outfit` · `closet`. 옷장(FU-12) 「갈아입기」 → 옷장 창 UI-19 (`ui/closet.js`) → 입기 + 빙글 AN-12. 도토리상점 옷 진열대 FU-54 + 상점 창 「오늘의 옷」 (`rules.json` `shop.clothesPerDay`), 첫 옷이면 옷장 덤. 옷 모델은 처음에 받지 않는 `clothes` 묶음. 약속 CONTRACTS 「11차 옷」, 노트 `docs/notes/m11-clothes.md`.
- 「병렬 개발 방식」 지금 마일스톤 줄을 M11 로 바꾼다 (main · 게임 버전은 합친 뒤 값):
  > 지금 마일스톤은 **M11 옷 갈아입기 · 주민 12명** (보드 wave11 반영 v1 = D100–D105 모두 A): P1 주민 12명 · 집터 셋(`SPARE_LOTS`) · P2 몸 · 옷 나누기(`player_top`) · P3 옷 12벌 CL-01–12 + FU-54 (검수 대기) · P4 옷장 창 UI-19 · 상점 진열대 · 저장 · 빙글 AN-12 · P5 봇 단계 `clothes` (`docs/notes/m11-clothes.md`, CONTRACTS 「11차 옷」).
- 「편집기와 "요청 확인" 흐름」 리소스 편집기 줄 (p36 노트 문장)의 영역 목록에 「· 옷 13 (`#cloth-<slug>`)」.

**concept/README.md** ID 표 CL 줄의 「(wave11 계획)」을 「M11 검수 대기 CL-01–12 · FU-54 · UI-19 · AN-12」로.

**devlog.md** 「현재 상태」: M11 P1–P5 끝 (이 노트 요약), 「다음에 할 일」: 옷 12벌 · FU-54 검수, 아래 「열린 것」.

**편집기 홈 `editors.html` 전체 관리**: 분류 `clothes` 13줄 (`tools/hub-catalog.mjs` 가 `assets/clothes/index.json` 을 읽게 — 고치는 곳 리소스 편집기 `#cloth-<slug>`). 이 브랜치는 hub-catalog 를 고치지 않았다.

## 열린 것

- **장면(컷신) 속 주인공은 기본 옷**: 장면 배우는 `town/actor.js` 가 player 모델을 따로 불러서 옷을 안 입힌다. `story/index.js` 의 배우 만들 때 `outfit` 으로 같은 옷을 입히면 된다 (`bindClothes` 를 배우 모델에). 다음 차수 후보.
- 옷 팔기 · 버리기 · 옷장 칸 한도 없음. 옷 선물 · 주민 옷(D101-B)은 하지 않음.
- 비옷 삼각형 3,048 (예산 3,000 △) — 검수 때 소매 고리를 줄이면 3k 안.
- 모자 아래 머리카락: 털모자는 앞머리(세 갈래)가 단 아래로 보이게 둠 (의도). 다른 머리 모양 주인공이 생기면 모자 높이를 머리 스펙에서 다시 잰다.
- 리소스 편집기 · 게임 다시 게시는 합친 뒤 (조정 세션 / 최종 게시).
