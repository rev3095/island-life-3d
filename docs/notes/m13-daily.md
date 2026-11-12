# M13 매일 할 거리 P2–P5 (13차 보드 wave13 D142–D147 A) — 진행 중 (WIP)

브랜치 `m13-daily` (worktree `../island-worktrees/m13-daily`, 포트 4261). **아직 게임에 연결 안 됨 · 테스트 미통과 · 자동 플레이 단계 없음.**

## 된 것
- 모델 (모두 status review): 아이템 IC-TL-06 새총 `tool-sling` · IC-MA-11 별 조각 `mat-star-piece`(변형 yellow/pink/blue) · IC-MA-12 레시피 쪽지 `mat-recipe-note` / 배경 PR-33 `gift-balloon` · PR-34 `sea-bottle` · BD-11 `peddler-cart` / 가구 FU-63–66 `star-lamp`·`star-clock`(바늘 hourHand·minuteHand)·`star-chair`·`star-mobile` / 캐릭터 CH-16 `songi` (고슴도치, build_character.py 새 종족 hedgehog + spines) / 주인공 AN-13 `wish` 동작 (player.json animations + 재빌드).
- 데이터: `src/data/daily-items.js` (별 조각 셋·쪽지·FU-63–66, items.js 두 줄) · items.json tools 에 sling (buy 1200, 진열은 안 건드림) · rules.json recipes 에 `unlock: true` 다섯 줄 · `recipes.js` 잠금(list 거름, `locked()`·`isOpen()`, `createRecipes(inv, {known})`) · data/index.js 가 `state.recipes.known` 로 앎.
- 도구 6번째: constants TOOLS + sling, input Digit6, player/toolbelt/toolring 정규식 1–6, ui/dom.js 아이콘·이름, player/tools.js 손 모델, gameplay/index.js TOOL_LABEL.
- 하늘: `src/sky/meteors.js` (높음·적정 셰이더 / 낮음·매우 낮음 CPU 선, 켤 때만 만듦), sky/index.js 고리 4줄 (`time.meteors.set`).
- 설정 `assets/daily/daily.json`, 놀이 `src/gameplay/daily/` — rules.js(순수) · index.js(유리병·레시피 쪽지 읽기·공용) · meteor.js(유성우·소원·별 조각·달무리 예고) · balloon.js(풍선·새총·선물).

## 남은 것 (다음 세션)
1. `src/gameplay/daily/peddler.js` 작성 (index.js 가 import 함 — 없으면 모듈이 안 열림): 수·일 9–17시 광장 offset 자리에 `peddler-cart` (world.objects.add persist:false) + `createActor(ctx,'songi')`, 우선순위 101 대화 → 희귀 꽃(교배색 flower)·묘목·벽지 wp-09 사기, 첫 접근 `daily:peddler {first,x,z}`, 장면 중엔 숨김. service `{here, stock, spot}`.
2. 연결: gameplay/index.js PARTS 에 `['daily', './daily/index.js']` · world/index.js lazy 에 daily.json assets.env · build-web.mjs `DAILY_FILES` 묶음 + island 정규식에 `daily` · decor/seats.js 에 `star-chair`.
3. story/rules.js TRIGGERS `meteor-first`(daily:meteor first) · `peddler-first`(daily:peddler first), 장면 s23·s24 JSON + index.json + story/files.js.
4. 벽지 wp-09 (행상 전용, index price 0 → 상점 코너에 안 나옴) 스펙·목록.
5. journal.json: 할 일 balloon·bottle, 목표 wish·balloon, 교환 레시피 쪽지.
6. 테스트 개수 맞추기 (items.test tool 6·furn 54 · items-assets 아이콘·스펙 수·ID · assets.test 캐릭터 16·배경 79·가구 54 · villagers.test EVENT_IDS 에 daily 아이템·tool.sling) + `tests/daily.test.mjs` (rules.js).
7. playtest 단계 · 개발 서버 4261 확인(콘솔 오류 0) · 이 노트 「문서 세션이 반영할 문장」.

## 문서 세션이 반영할 문장
- (끝나면 채움)
