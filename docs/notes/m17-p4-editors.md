# M17-P4 편집기 트랙 — 요소·스토리·리소스 편집기를 v40 게임에 맞춤 (브랜치 `m17-p4-editors`)

14차 보드(추천안 반영)의 M17-P4. 게임은 v40(main 900016e)까지 왔는데 편집기가 새 방·바다 생물·장면 일부를 몰랐다. 게시는 하지 않았다 — 합친 뒤 조정 세션이 한다.

## 한 것

### 1. 요소 편집기 「방 배치」 탭 (`elem-editor/room-tab.js` 다시 씀)
- **방 고르기**: 주민 방 · 내 집 증축 층 RM-15–17(「내 집 1층/2층/다락」 표시) · 가게, 그리고 딸린 방은 부모 밑에 점선으로 — 도토리상점 밑에 정원·도구 코너 RM-22 · 지하 밤 코너 RM-21, 박물관 밑에 관 여섯 RM-25–30.
- **상점 낮/밤 매장 `phases`**: 그림 위 매장 단추(☀️ 낮 · 🌙 밤 · 늘 있는 칸만). 고른 매장 = 늘 있는 가구 + 그 매장 가구(파란 점선 테두리). 새 가구는 그 매장에 더하고, 가구마다 「밤 매장으로만 / 두 매장 모두로」 옮기기. 매장에 따로 `keeper` 가 있으면 그것을 옮긴다. 검사는 매장마다 `phaseSpec` → `checkPlace` (모든 매장에 걸리면 한 줄, 한 매장에만이면 앞에 매장 이름).
- **실내 문 `inner`**: 벽에 갈색 문 + 문 앞 설 자리 점선 동그라미. 고르면 벽·자리·열리는 매장·이름표를 고치고, 옮기면 그 벽 자리의 문 모델(FU-80·81 벽 가구)도 같이 옮긴다. 다른 매장 문은 흐리게. 「○○ 배치 열기」로 딸린 방으로.
- **딸린 방 `parent`**: 방 정보에 「↳ 딸린 방 — 1층 동쪽 벽 실내 문(「…」)으로, 🌙 밤 매장 시간에만」 + 「1층 열기」. 검사: `parent` = `PLACE_PARENT`, 1층에 이 방으로 가는 `inner` 가 있고 매장(phase)이 같은지, 1층 `inner` 가 딸린 방만 가리키는지.
- **박물관 관 `assets/interior/halls/*.json`**: 경로 `halls/<관>/furniture|wallpaper|floor` (반영 도구 `ELEM_FILES.halls`). 그림에 `racks` 줄(점선 상자)과 전시 자리 점(`hallPlan`, 아이템 표 순서 — 테스트가 `items.list` 와 같은지 본다), 검사 `checkHall`. 로비(museum.json)는 관 입구 `halls[]` 아치를 벽에 그리고, 고르면 벽·안내판 쪽을 고치고 화살표로 0.5칸씩, 「○○관 배치 열기」.
- **증축 층 RM-15–17 (`home.json`)**: 방 크기 `size`(10×10 · 8×8 · 8×6), 문 없음(위층), 계단 `fixtures`(빗금 상자, ⬆/⬇ · 닿는 층 · n단계부터) — 끌기·화살표로 옮기고 「보이는 단계」 고르기. 가구는 `starter`(그 층을 지을 때 놓이는 처음 가구)를 고친다. 검사 `checkHomeRoom` + 처음 가구가 벽·문 매트·계단 칸·다른 가구와 안 겹치는지. 방 정보에 증축 단계·값(home.json).
- 바뀐 칸 목록 이름: 「낮 매장 가구 자리 · 밤 매장 주인 서는 곳 · 처음 가구 · 계단 · 실내 문 · 관 입구」.

### 2. 요소 편집기 표 (`elem-editor/sheets.js`) · 값 검사 (`tools/elem-checks.mjs`)
- 「아이템 값」 묶음에 **바다 생물**(`items/sea`, 20줄: 값·시간·계절·그림자·빠르기 0–3·희귀·출현 몫·설명) · **미술품**(`items/art`, 16줄: 이름·그림/조각·값·사는 값·가품 표시) · **잠수·스쿠버**(`items/scubaKit/buy·price`, 가방 `items/stack/sea`).
- 새 묶음 **🏠 집·별점·일지**: **집 증축**(`home/stages/n/cost` · 갚기 단추 `home/repay/0·1` · `afterIntro`) · **섬 별점**(`rating/parts/n/per·max·want` · 나무 `band`·`pts` · 별 문턱 `rating/stars/1–4` · 처음 오른 별 상 `rating/rewards/2–5`) · **섬 일지**(`journal/daily` · `allDoneBonus` · `afterIntro` · 할 일마다 `need`·`pts` · 목표 단계마다 `steps`·`pts`). 일지 상점 줄(`journal/shop`)은 줄 이름표가 `kind`(acorns|item, 겹침)라 경로로 못 찾아 표에 안 넣었다 — 채팅으로.
- 반영 도구 `tools/apply-edits.mjs` `ELEM_FILES` 에 `halls` · `home` · `rating` · `journal`. 편집기 `main.js` 가 세 파일과 관 여섯을 읽는다.
- 값 검사 더함 (탭 sea · dive · art · home · rating · journal): 바다 생물 그림자 1–6·빠르기 0–3·시간·계절·값·slug 겹침 / 스쿠버 키트 파는 값 < 사는 값, `shop.always` 에 있음 / 미술품 IC-AR 차례·갈래·값·가품 표시 / 증축 단계 차례·값이 늘어남·방·겉모양·갚기 단추 / 별 문턱 0부터 늘어남·상·항목 부호·최대 점수 ≥ 별 다섯 / 일지 하루 수 ≤ 목록·할 일 횟수·목표 단계·상점 아이템. `itemList` 에 sea · art · tool.scuba-kit (레시피 재료 고르기에도 보임), `CAT_KO` 에 바다 생물·미술품 (가방 쌓임 표는 `stack` 에 있는 것만).
- 홈 목록: `tools/hub-catalog.mjs` 가 표 파일(`dive`·`home`·`rating`·`journal`)을 알고, 방 분류에 관 여섯(`#rooms.hall-<관>`)을 더한다 (`tests/hub.test.mjs` 링크 검사도 halls).

### 3. 스토리 편집기 (`story-editor/words.js`)
- 장면 s23–s28 은 이미 타임라인·게시 목록에 다 있었다 (트리거·`NIGHT_KINDS` 도) — 확인만.
- 「그 밖의 글」: **섬 일상** 탭 새로 (`assets/daily/daily.json` — 🌠 유성우 · 🎈 선물 풍선 · 🍾 유리병 · 📜 레시피 쪽지 · 🛒 행상 송이, 33칸). 밤 탭에 숨어 있던 P54 글 — 🔮 운세 부스 · 🦊 여우 상인 가게 · 살랑의 말 · 🎪 이상한 천막 · 🎁 선물 상자 — 묶음으로. 어느 묶음에도 안 든 글 칸은 「그 밖」 묶음으로 모아 앞으로 새 칸이 생겨도 숨지 않는다. 묶음 제목을 한국어로.
- 편지 탭 「밤톨 안내」에 `nightShop`(실내 전수 밤 매장 안내).
- 반영 도구 `tools/apply-texts.mjs` `TEXT_FILES` 에 `daily` (편집기와 같은지 테스트가 본다).

### 4. 리소스 편집기
- `node tools/build-editor-index.mjs` 다시 → 리소스 368개 · 약속 어긋남 0 · 손볼 것 6(삼각형 수 △: gureum·pado·yeomyeong·songi·museum·cloth-raincoat). 바다 생물 20 (`item-sea-*`) · 미술품 16 (`item-art-*`) · 스쿠버 키트 · 밤 상점 BD-13–15 · 박물관 BD-16 · 망원경대 PR-40 · 증축 집 BD-12-1–3 · 붙박이 FU-67–70 · FU-79–88 · 송이·살랑 · 잠수복 CL-13 모두 나온다. 게시 묶음 121개 · 231.83MB → `dist/res-editor/publish.json` (gitignore — 조정 세션이 합친 뒤 다시 만든다. M17-P1 이 모델을 다시 만들면 그 뒤에).
- 코드 고친 것 없음. status·모델 파일은 건드리지 않았다 (M17-P1 몫).

## 확인
- `node --test tests/` **533 통과 · 실패 0** (새 테스트: `elem.test.mjs` 「M17-P4: …」 · `story-editor.test.mjs` 「M17-P4: …」).
- 개발 서버 4284 에서 세 편집기 — 콘솔 오류 0. 사진 (공유 노트 폴더 `m17-p4-editors-shots/`):
  `00-elem-shop-day` · `01-elem-shop-night-inner-door` · `02-elem-shop-night-subroom` · `03-elem-hall-art`(전시 자리 16) · `04-elem-museum-lobby-arches` · `05-elem-home-2f-stairs-edit`(계단 옮기기 → 바뀐 칸에 기록, 뒤에 「모두 되돌리기」) · `06-elem-sheet-sea` · `07-elem-sheet-home` · `08-story-texts-daily` · `09-story-texts-night-fox` · `10-story-scenes-s27` · `11-res-items-art-sea` · `12-res-env-fox-shop`.

## 게시할 파일 (조정 세션 — 합친 뒤)
요소 편집기 https://claude.ai/artifact/DcidJEY1VRNNJdCxwge3Sj (`elem-editor/files.json` 그대로, 새 아티팩트 도구면 `index.html` = elem-editor.html 을 문서 틀로 감싼 사본):
- 바뀐 것: `index.html`(elem-editor.html — 방 탭 CSS) · `elem-editor/main.js` · `elem-editor/room-tab.js` · `elem-editor/sheets.js` · `tools/elem-checks.mjs`
- 새로: `src/gameplay/house/museum-hall-data.js` · `src/gameplay/house/home.js` · `assets/interior/halls/{fish,bug,fossil,sea,art,star}.json` · `assets/interior/home.json` · `assets/rating/rating.json` · `assets/journal/journal.json`
- 지난 게시 뒤 main 에서 바뀐 방·가게 파일(shop.json v6, shop-garden/night, fortune/foxshop/oddtent, rm-15–17, items.json·rules.json, `src/gameplay/house/placedata.js`·`interior.js`)이 아직 안 올라갔으면 같이 — `list_files` 로 비교.

스토리 편집기 https://claude.ai/artifact/NrmMmozFXQCdiw1oQMxCyF (`assets/story/editor-files.json`):
- 바뀐 것: `story-editor/words.js` · 새로 `assets/daily/daily.json`
- 지난 게시에 s23–s28 장면·`songi`/`salang` 썸네일·`src/data/sea-items.js`·`art-items.js` 가 없으면 같이 (목록에는 이미 있음).

리소스 편집기 https://claude.ai/artifact/1weSx9yyf2U4mLnwvopBNV: `node tools/build-editor-index.mjs` → `dist/res-editor/publish.json` 의 묶음(batches)대로 (M17-P1 재빌드를 합친 뒤에 다시 만들어 올린다).

## 문서 세션이 반영할 문장
- CLAUDE.md 「요소와 "요소 반영" 흐름」 요소 줄 끝에: "… `assets/interior/rooms/*.json`·`places/*.json`·**`halls/*.json`** (가구 배치) · **`assets/interior/home.json`(집 증축) · `assets/rating/rating.json`(섬 별점) · `assets/journal/journal.json`(섬 일지)**."
- CLAUDE.md 「요소 편집기」 줄: "고친 칸은 `drafts/elem` 의 `changes` (첫 칸 = 파일 키 `items·rules·layout·events·night·tour·home·rating·journal·rooms/<slug>·places/<slug>·halls/<관>`, …). 「방 배치」 탭은 상점 낮/밤 매장(`phases`) · 실내 문(`inner`) · 딸린 방(`parent`) · 박물관 관(`halls`) · 내 집 증축 층(`starter`·계단 `fixtures`)까지 그리고 고친다. 주소 끝 `#rooms.hall-<관>` 도."
- CLAUDE.md 「스토리 편집기」 줄: "탭 장면 · 주민 · 편지 · 그 밖의 글 (밤·새벽 · 계절 행사 · 투어 · **섬 일상 `daily.json`**) … `texts/<night|events|tour|daily>`".
- README / docs/notes/p36-elem-editor.md 「요소 반영」: 경로 예에 `places/shop/phases/night/furniture` · `places/shop/inner` · `halls/sea/furniture` · `rooms/rm-16/fixtures` · `home/stages/2/cost` 를 더한다. 일지 상점 줄은 채팅으로 (경로 없음).
- docs/notes/p36-story-editor.md 「스토리 반영」: `texts/daily` → `node tools/apply-texts.mjs` (같은 도구).
- 편집기 홈 `editors-list` 의 요소 편집기 설명에 "바다 생물·미술품·스쿠버·집 증축·섬 별점·섬 일지 표, 관·증축 층 배치" 를 더하고, 홈 「전체 관리」 목록을 `node tools/hub-catalog.mjs` 로 다시 만든다 (방 분류 + 관 6, 숫자 표 + sea·art·dive·home·rating·journal 6).

## 남은 것 · 알림
- 게시 · 홈 `catalog/*`·`status/*` 갱신은 조정 세션.
- 리소스 편집기 「주제」 칩에 잠수·미술 갈래는 없다(아이템 전체에서 보임) — 필요하면 백로그.
