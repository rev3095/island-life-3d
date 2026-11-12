# M18-P4 미술품 주고받기 · 계절 레시피 · 행상 계절 진열 (브랜치 `m18-p4-seasonal`, 15차 보드 D195-A · D196-A)

15차 검수 보드(`concept/wave15-board.html`) 추천안대로. M18 「계절이 깊어진다」의 P4 트랙. main 7074235(게임 v41)에서 갈라짐, worktree `../island-worktrees/m18-p4-seasonal`, 점검 포트 4294.

## 만든 것

| 결정 | 한 것 | 자리 |
|---|---|---|
| D195-A 미술품 부탁 | 주에 한두 번(월요일 시작 주, 섬 씨앗·날짜로 늘 같음 — `artWishDays`) 친구 이상(친밀도 30+) 주민 하나가 진품 하나를 바란다. 플레이어 가방에 진품이 있으면 70% 는 그중에서 고른다. 그날 처음 말 걸 때 인사 뒤 「○○ 보고 싶어요」 → **보여 줄게요** (친밀도 +4, 작품 그대로) · **바꿔 줄게요** (작품을 건네고 친밀도 +10 + 답례 가구 하나 — 그 주민 답례 표 `gifts.back` 의 가구, 없으면 상점·제작 가구) · **다음에요** (바라는 마음은 3일 남음, 하루에 한 번만 다시 꺼냄). 가품만 있으면 「색이 좀 다르다」 하고 안 받는다. 글 대화·이모티콘 대화 둘 다 (이모티콘 대화는 고르기 이모티콘 👀/🎁/⏳) | `src/gameplay/town/artwish.js` (규칙 순수 함수 + `artStep` + `createArtWish`) · `town/talk.js` (인사 뒤 한 단계) · `town/index.js` 서비스 `town.art` · 저장 `state.town.artWish {day, slug, id}` (그날 계산해 둠) · `villagers[slug].artWish {id, day, asked, toldDay, done}` · `villagers[slug].arts` (받은 작품) |
| D195-A 대사 | 주민 10명 파일 `lines.art` = ask · remind · notYet · fake · show · trade · reward · later · recipe(계절 레시피 알려 줄 때). 새 자리 `{art}` = 작품 이름 (`traits.js PLACEHOLDERS`). 주민 파일 `version` +1 (지문 테스트는 일부러 건너뜀) | `assets/villagers/*.json` · `town/traits.js` LINE_LABELS·SUB_LABELS · `story-editor/words.js` WHEN |
| D195-A 여우 가품 되사기 | 살랑 메뉴에 「가품 되팔기」 → 가방에서 가품 고르기 → 값 = 그 작품 여우 값(buy)의 반 (10 단위 내림, 가품 파는 값 30 보다는 많이) → 이벤트 `night:art-buyback {id, price}` | `night/index.js buyBackFake` · `night/rules.js foxBuyBack` · `assets/night/night.json` v2 `lines.salang.menu`·`buyBack` |
| D196-A 계절 가구 13 | FU-92–104 (트로피 FU-89–91 은 대회 트랙 몫이라 13 = 봄 4 · 여름 3 · 가을 3 · 겨울 3): 🌸 벚꽃 의자·벚꽃 탁자·벚꽃 분재·벚꽃 가지 장식(벽) · 🐚 조개 등·조개 의자·조개 벽 거울(벽) · 🍁 단풍 선반·단풍잎 깔개(2×2 rug)·단풍 등 · ❄️ 눈 결정 등·눈 결정 탁자·눈 결정 벽 장식(벽). 등·벽 장식 일부는 `glow` (밤에 켜짐). 스펙 `season` 칸, status **review** | 빌더 `assets/blender/seasonal_furniture.py` (build_furniture.py 한 줄 import, night_special 과 같은 모양) · 스펙 `assets/furniture/specs/<slug>.json` · 아이템 `src/data/seasonal-items.js SEASON_FURN` (출처 `season`) → `items.js` |
| D196-A 계절 레시피 | `rules.json` recipes 13줄 `unlock: true` + `season` (rules.json v4). **레시피 쪽지로는 안 열린다** — `recipes.locked()` 는 계절 레시피를 빼고, `seasonLocked(season)` 따로. 열리는 길: ① 그 계절 바닷가 유리병 (`daily.json seasonal.bottleChance` 0.3, 섬·날짜로 늘 같음 `seasonBottle`) — 그날은 쪽지 대신 계절 레시피 ② 친구 이상 주민에게 좋아하는/아주 좋아하는 선물 → `villagerChance` 0.35 로 주민이 「이 계절 「○○」 만드는 법」(주민마다 하루 한 번). 열면 대화가 끝난 뒤 창 「🌸 계절 레시피」. 한 번 연 레시피는 계절이 지나도 만들 수 있다. 작업대 목록에 계절 표시(🌸🐚🍁❄️) | `src/data/recipes.js` (SEASON_RECIPES · seasonLocked) · `daily/index.js` (unlockSeason · showAnnounce · `daily.recipes.fromVillager/seasonLocked/unlockSeason`) · `daily/rules.js seasonBottle`·`withJosa` · `house/craft.js SEASON_MARK` · `daily.json` v2 `seasonal` |
| D196-A·D197-A 묶음 | 계절 가구 **모델**은 그 계절 묶음 `season-<계절>` (집에 놓으면 그때 받음). 썸네일은 icons, 스펙은 furniture 묶음 그대로 | `tools/build-web.mjs SEASON_FILES` (가구 스펙 `season` 을 읽음) |
| D196-A 행상 계절 진열 | 송이가 그 계절 꽃씨 묶음(5개, 봄 튤립·팬지 · 여름 코스모스 · 가을 코스모스·팬지 · 겨울 팬지)과 계절 벽지 하나를 더 가져온다 — 새 벽지 **WP-10 벚꽃 비 · WP-11 조개 모래 · WP-12 단풍 바람 · WP-13 눈 결정** (목록 값 0 + `peddler` + `season`, 도토리상점 코너엔 안 나옴, 행상 값 2400, status review). 들꽃 수레 WP-09 는 늘 | `daily.json peddler.seasonal` · `daily/rules.js peddlerSeasonal` · `daily/peddler.js stock` (`n` 묶음 사기) · `assets/interior/specs/wp-10–13.json` · `interior/index.json` · `house/interior.js WEB_FILES` |

## 확인 (2026-11-13)

- `node --test tests/` **553 · 통과 552 · 실패 0 · 건너뜀 1** (새 `tests/seasonal.test.mjs` 10 — 가구 13 파일·코드·묶음 · 계절 레시피 잠금 · 계절 유리병 비율 · 행상 계절 진열 · 부탁 날 · 부탁 고르기 · 대사 칸 · 대화 단계(보여 주기·바꿔 주기·다음에·가품) · 여우 되사기 값).
- 개발 서버 4294 에서 날짜 흉내 (`?date=`, 미리 보기 저장) — 준비만 직접(첫날 마침 · 주민 친밀도 45 · 도토리 · 가방에 진품/가품 큰 도토리 조각 · 복숭아), 나머지는 실제 행동 키·창 단추:
  1. **2027-04-07(수) 10시 행상**: 진열 = 희귀 꽃 둘 · 묘목 · 「튤립 씨앗 5개 (계절)」 · 「팬지 씨앗 5개 (계절)」 · 들꽃 수레 벽지 · 「🎐 벚꽃 비 벽지 (계절) 2,400」 → 벽지·튤립 씨앗 묶음 사기 (도토리 −3,600, 씨앗 5, 벽지 가짐 표시). `m18-p4-seasonal-shots/peddler-spring.jpg`
  2. 내 집에 벚꽃 비 벽지 + 계절 가구 9개(분재·의자·탁자·깔개·조개 등·눈 결정 등 + 벽 셋) 놓아 봄. `home-seasonal.jpg`
  3. **2027-04-12(월) 10시** 바닷가 유리병 Space → 「🌸 계절 레시피 — 벚꽃 의자 (재료: 벚꽃잎 6 · 나무 4)」. `bottle-season-recipe.jpg`
  4. 같은 날 코코가 「큰 도토리 조각」을 바람 → 이모티콘 대화에서 보여 주기(친밀도 +4, 작품 그대로) → 글 대화로 다시: 「요즘 「큰 도토리 조각」 생각만 한다냥…」 + 보여 줄게요/바꿔 줄게요/다음에요 (`art-wish-coco.jpg`) → 바꿔 줌: 친밀도 52→62, 작품 빠짐, 답례 「액자」, `villagers.coco.arts`.
  5. 22시 여우 상인 가게(debug.force) 살랑 → 「가품 되팔기」 → 가방에서 가품 고름 → 「🌰 3,000개에 도로 사 주지」 (여우 값 6,000 의 반) → 팔게요 → 도토리 +3,000. `fox-buyback.jpg`
  6. 퐁에게 복숭아(아주 좋아함) → 「꽥! 이 계절 한정 「벚꽃 탁자」 만드는 법 알려 줄게꽥!」 → 대화 끝난 뒤 창 「🌸 계절 레시피」 (`villager-season-recipe.jpg` — 점검을 위해 그 한 번만 villagerChance 1). 창 글의 「퐁이(가)」는 사진 뒤에 받침 조사(`withJosa` → 「퐁이」)로 고침.
  - 게임 오류 수 0.
- 가구 렌더 한 장 `m18-p4-seasonal-shots/furniture-sheet.png`.
- 자동 플레이 봇: `tests/playthrough/scenario.js` 새 단계 **`art-wish`** (fake-art 다음 — 친구 이상 주민이 있으면 부탁 날을 최대 8일 기다려 그 주민에게 말 걸고, 진품이 있으면 보여 주기·없으면 다음에. `town:art` 이벤트로 확인, 상태는 읽기만). 전체 결과는 아래 「봇」 줄.

## 숫자 (바꿀 자리)
- 부탁: `town/artwish.js ART_WISH` = 주 2번 확률 0.4 · 친구 30 · 남는 날 3 · 보여 주기 +4 · 바꿔 주기 +10 · 가진 작품 고를 확률 0.7 (요소 편집기 표에는 아직 없음).
- 계절 레시피: `daily.json seasonal.bottleChance` 0.3 · `villagerChance` 0.35. 재료: 봄 벚꽃잎(봄 꽃놀이 채집)·꽃·나무·점토·가지 · 여름 조개 아무거나·철·돌·나무 · 가을 단단한 나무·나무·과일·잡초·가지·철 · 겨울 눈 결정(겨울 행사·눈 오는 날)·철·돌.
- 여우 되사기: `night/rules.js foxBuyBack(it, 0.5)`.

## 개수 박은 테스트 (이 브랜치에서 맞춤 — 합칠 때 다른 M18 트랙 수와 더할 것)
- `assets.test` 가구 60 → **73** (+13) · `items.test` 가구 60 → **73** · `build-web.test` 묶음 ≤ 20 → **≤ 21** (계절 가구 썸네일로 icons-3) · `interior.test` 벽지 WP-01–09 → **WP-01–13**, 벽지 목록 9 → **13** · `places.test` 「모델 없는 번호」 FU-99 → **FU-199** (FU-99 가 단풍 선반이 됨) · `town.test`·`town-wave5.test` 자리 이름 KEYS 에 `art`.
- 편집기 게시 목록: `assets/villagers/editor-files.json`·`assets/story/editor-files.json` 에 `src/data/seasonal-items.js`. 요소 편집기 값 검사 `tools/elem-checks.mjs SEASON_ITEMS` (계절 가구 13 + 행사 채집 벚꽃잎·눈 결정).
- 대회 트랙(M18-P3)도 가구(트로피 FU-89–91)를 더하면: 가구 수는 **73 + 3**, `build_furniture.py` BUILDERS import 줄은 둘 다 살리기, `assets/furniture/index.json` 은 `node tools/build-furniture.mjs --index` 로 다시.

## 새 리소스 (모두 status review — 검수 대기)
| 보드 ID | slug | 비고 |
|---|---|---|
| FU-92–95 | `cherry-chair` `cherry-table` `cherry-bonsai` `cherry-wall`(벽) | 봄 벚꽃 |
| FU-96–98 | `shell-lamp`(glow) `shell-chair` `shell-mirror`(벽) | 여름 조개 |
| FU-99–101 | `maple-shelf` `maple-rug`(2×2 rug) `maple-lamp`(glow) | 가을 단풍 |
| FU-102–104 | `snowflake-lamp`(glow) `snowflake-table` `snowflake-wall`(벽, glow) | 겨울 눈 결정 |
| WP-10–13 | `wp-10` 벚꽃 비 · `wp-11` 조개 모래 · `wp-12` 단풍 바람 · `wp-13` 눈 결정 | 행상 계절 벽지 (목록 값 0) |

## 다른 트랙과 겹칠 수 있는 곳 (합칠 때 줄 단위로 둘 다 살리기)
- `assets/blender/build_furniture.py` BUILDERS 뒤 import 한 줄 · `src/data/items.js` 가구 펼치기 줄 · `assets/data/rules.json` recipes 끝·version · `assets/daily/daily.json` (version · `seasonal` · `peddler.seasonal`·`lines.season`) · `tools/build-web.mjs SEASON_FILES` · `assets/night/night.json` salang · `town/talk.js` (인사 뒤 단계 · 선물 반응 뒤) · `town/index.js` (createArtWish · 서비스 `art`) · 주민 파일 10개 `lines.art` + version · 개수 박은 테스트 위 목록 · `scenario.js` (`art-wish` 단계, fake-art 다음).

## 남은 것
- 계절 의자 둘(벚꽃 의자·조개 의자)은 앉기 자리(`decor/seats.js SEATS`)를 안 넣었다 — 앉게 하려면 한 줄씩.
- 부탁 작품 고르기는 **가방**의 진품만 「가진 것」으로 본다 (집에 걸어 둔 작품은 안 셈 — 보여 주려면 가방에 넣어 와야 함). 주민에게 건넨 작품(`arts`)을 그 주민 방에 걸어 두는 것은 하지 않았다.
- 계절 꽃씨는 지금 있는 꽃 셋(튤립·코스모스·팬지)만 — 여름 전용 꽃이 없어 여름은 코스모스. 계절 꽃을 늘리면 `daily.json peddler.seasonal` 만 고치면 된다.
- 요소 편집기 표(`elem-editor/sheets.js`)에 `seasonal`·`peddler.seasonal`·`ART_WISH` 칸은 아직 없다 (요소 편집기 쪽 몫).
- 이 트랙의 레시피 창 사진은 josa 고치기 전 글(「퐁이(가)」)이 찍혀 있다.

## 문서 세션이 반영할 문장
- CLAUDE.md 「밤 특별 상점」 가품 대사 줄 끝에: 「**미술품 주고받기 (M18-P4 D195-A)**: 주에 한두 번 친구 이상 주민이 그날 처음 말 걸 때 「○○ 보고 싶어요」 (`town/artwish.js`, 서비스 `town.art.today()`, 대사 주민 파일 `lines.art`, 자리 `{art}`) — 보여 주면 친밀도 +4, 바꿔 주면 작품을 건네고 친밀도 +10 + 답례 가구. 가품은 안 받음. 여우 상인 살랑은 「가품 되팔기」로 가품을 여우 값의 반에 되산다 (`night/rules.js foxBuyBack`).」
- CLAUDE.md 「섬 일지 · 매일 할 거리」 매일 할 거리 줄 끝에: 「계절 레시피(M18-P4 D196-A): 벚꽃·조개·단풍·눈 결정 가구 FU-92–104 (`src/data/seasonal-items.js`, 레시피 `rules.json recipes` 의 `season`)는 쪽지로 안 열리고 그 계절 유리병(`daily.json seasonal.bottleChance`)·친구 이상 주민의 좋아하는 선물 답(`villagerChance`)으로 하나씩 — `recipes.seasonLocked(season)`. 모델은 그 계절 묶음 `season-<계절>`. 행상 송이는 계절 꽃씨 묶음 · 계절 벽지 WP-10–13 을 더 가져온다 (`daily.json peddler.seasonal`).」
- CLAUDE.md 「명령어」 개수 줄 근처: 가구 73 (+계절 13) · 벽지 13 (WP-10–13 행상 계절).
- CONTRACTS: 이벤트 `town:art {slug, id, kind: ask|remind|show|trade|fake, reward?}` · `daily:season-recipe {id, season, by}` · `night:art-buyback {id, price}` · `daily:bottle` 에 `season: true`. 서비스 `town.art {today(), wishes(), config}` · `daily.recipes.{seasonLocked(), fromVillager(name, r), unlockSeason(by)}` · `data.recipes.seasonLocked(season)`. 저장 `state.town.artWish` · `villagers[slug].artWish`·`arts`·`seasonRecipeDay`.
- concept/README.md 보드 목록: wave15 D195·D196 「반영 → M18-P4 브랜치 m18-p4-seasonal」.
