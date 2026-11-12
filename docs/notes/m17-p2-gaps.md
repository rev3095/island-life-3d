# M17-P2 빈칸 트랙 (브랜치 `m17-p2-gaps`, 14차 보드 D181–D185 추천안 A)

14차 검수 보드(`concept/wave14-board.html`)를 추천안대로 반영. M14 집 증축 · M16 잠수 · P54 밤 특별 상점 · 박물관 별자리 트랙이 「남은 것」으로 둔 빈칸을 채운다. main 900016e(게임 v40)에서 갈라짐.

## 만든 것

| 결정 | 한 것 | 자리 |
|---|---|---|
| D181-A 가품 대사 | 박물관 기증 창에서 가품 미술품을 고르면(이제 고를 수 있다) 창이 닫히고 느루가 「…이건 가품이에요…」 + **진품과 다른 점 한 줄** + 「돌려 드릴게요…」 → 가방에 그대로 · 「다른 것도 보여 주시겠어요…?」 네 → 기증 창 다시. 이벤트 `museum:fake {id}`(창 → 느루) · `museum:fake-told {id, tell}`(봇·점검용) | `src/ui/museum.js` donateLoop · `src/ui/bag.js` canPick · `town/keepers.js` museumFlow·`fakeTalk` · 대사 `assets/villagers/neuru.json lines.fake` (look·found·back·more, v2) |
| D181-A 다른 점 한 줄 | 작품마다 느루 말투 한 줄 `MUSEUM_TELL` (가품 8점) → 가품 아이템 칸 `museumTell`. 여우 상인 `tell`(items.json) 은 그대로 | `src/data/art-items.js` |
| D181-A 가품 3D 색 | 가품 아이템 칸 `fakeLook` (= 아이템 스펙 `variants.fake.palette`, 게시본엔 아이템 스펙이 없어 게임 칸으로) → 실내 진열(여우 상인·이상한 천막) 틀을 가품 따로 칠함 | `art-items.js FAKE_LOOK` · `house/places.js itemModel` |
| (덤) 진품 미술품 기증 | 가방 기증 모드가 `DEX_CATEGORIES`(물고기·곤충·화석·바다 생물)만 받아서 **진품 미술품도 기증할 수 없었다** → 박물관 분류 `MUSEUM_CATEGORIES` = DEX + art. 박물관 창에 「미술품 n/16」 칸. 도감 탭은 그대로 | `src/ui/dom.js` · `bag.js` · `museum.js` |
| D183-A 일지 조건 | 할 일 칸 `needs` (아이템 id 또는 배열): 그날 할 일을 뽑을 때 가방에 없으면 건너뜀 (섞는 순서는 그대로 — 다 가졌으면 예전과 같은 할 일). `sea1` needs `tool.scuba-kit` · `balloon` needs `tool.sling` | `assets/journal/journal.json` v3 · `journal/rules.js` `needsMet`·`pickTasks(…, has)`·`ensure(…, has)` · `journal/index.js` |
| D184-A 미술품 집에 놓기 | 집 가구 키트가 `assets/items/index.json` 의 art 모델도 안다 (`furniture.js artInfos`): 그림 = 벽 칸(`place: 'wall'`, 받침·다리 숨기고 기운 것을 세워 벽 높이 1.45 · ×1.7), 조각 = 바닥 1칸(×1.6). 진품·가품 모두, 가품은 `fakeLook` 색. 가방 「가구 놓기」에 미술품도. 옮기기·돌리기(조각)·가방에 넣기 그대로 | `house/furniture.js` `ART_PLACE`·`makeArt` · `house/index.js placeFromBag` · `places.js` (진열 미술품은 키트가 아니라 아이템 모델로 — 받침 위 그대로) |
| D184-A 별점 | 섬 별점 칸 「집 안 미술품」 🖼️ 한 점 3점, 최대 6점(18점) · want 0 (안 놓아도 아쉬운 칸으로 안 뜸) | `assets/rating/rating.json` v2 · `rating/rules.js countIsland(…, {art})` · `rating/index.js` |
| D185-A 증축 묻기 | 도토리상점 밤톨 대화에 「집을 넓히고 싶어요」 (첫날 전엔 안 뜸) → 다음 단계 짓기 · 짓는 중 · 빚이 남았으면 「빚은 우편함에서」 · 다 지음. **우편함은 빚 갚기만** — 처리기 `house-grow`(92) 는 빚이 있을 때만 잡고(라벨 「집 빚 갚기」), 빚이 없으면 우편함 Space = 편지(town:mail). 빚 갚기 대화에 오늘 편지를 더 쓸 수 있으면 「편지 쓸래요」 줄 | `house/home.js growTopic` · `house/index.js growTalk({where, say})` · `house.grow.ask`·`offer` · `town/keepers.js shopFlow` · `town/index.js town.mail.write` |
| 집 안 별 망원경 | 집 안에 놓은 FU-53 별 망원경 앞 Space → 메뉴 맨 위 「망원경 보기」 → 박물관 앞 망원경대와 같은 망원경 보기 UI-32 (`stars.open({ where: '집 안 별 망원경' })`, 밤 19–5시만 · 낮엔 안내) | `house/index.js menu` |
| D182-A | 지금 그대로 — 할 일 없음 | — |

- 편집기 이름표: `town/traits.js` · `story-editor/words.js` 에 `fake` 칸 이름 (스토리 편집기 주민 탭 느루).

## 확인 (2026-11-13)

- 테스트 `node --test tests/` **537 · 통과 536 · 실패 0 · 건너뜀 1** (새 `tests/gaps.test.mjs` 6 — 가품 색 = 스펙 · 느루 줄 · 기증 창/가방 · 일지 needs 60일 · 미술품 칸 24개 · 별점 · 증축 자리 `growTopic` · 망원경 메뉴). `rating.test.mjs` 세기 결과에 `art: 0` 한 칸.
- check-interiors `--port=4282`: **팝업만 뜬 문 0 · 이 트랙 몫 못 들어간 문 0 · 상점 실내 문 문제 0/6 · 문제 0** (여우 상인 가게·이상한 천막 진열 「보기」도 됨).
- 개발 서버 4282 에서 실제 키(Space·W/S·HUD 「내일 ▶」·창 단추)로 — 준비만 미리 보기 저장에 직접(첫날 마침 · 가방에 가품 그림·진품 그림·가품 조각·진품 조각·별 망원경·스쿠버 키트 · 도토리):
  1. 박물관 느루 → 기증하러 → 가품 「아침 바다의 돛」 고름 → 「이건… 아침 바다의 돛이로군요… / 잠깐만요… 빛에… 비춰 볼게요… / 음… 아쉽지만… 이건 가품이에요… / 진품의… 해는… 노랗게 떠오르는데… 이건… 해가… 붉군요… / …돌려 드릴게요…」 → 가방에 그대로 → 「네, 더 볼게요」 → 진품 기증 → 첫 소장품 대사 · `museum.has` 참.
  2. 여우 상인 가게(밤, debug.force 로 세움) 진열: 가품 「창가의 꽃병」 vase `#8a5ab8`(가품 보라) · 진품 「도토리 언덕」 그대로.
  3. 내 집: 벽 보고 꾸미기 → 가구 놓기 → 가품 그림 북쪽 벽 n3 (해 `#e8604f`) · 바닥에 가품 곰 흉상(분홍 `#f2c4c4`) · 진품 개구리 · 별 망원경. 섬 별점 「집 안 미술품」 3점 → +9. 사진 `m17-p2-gaps-shots/home-art.jpg`·`home-art-zoom.png`.
  4. 집 안 별 망원경 앞 Space → 「별 망원경이에요. 창밖 밤하늘을 볼까요?」 → 망원경 보기 → 「🔭 집 안 별 망원경」 화면 (`home-telescope-scope.jpg`).
  5. 빚 없을 때 우편함 앞 행동 키 = `town:mail` · 상점 계산대 밤톨 → 「팔래요 / 주문할래요 / 집을 넓히고 싶어요 / 그냥 구경할게요」 → 「방 넓히기」 지어 주세요 → 빚 20,000 · 「빚은 우편함에서 갚아요!」 → 우편함 「집 빚 갚기」 → 1,000 갚음.
  6. 일지: 스쿠버 키트만 가진 채 「내일 ▶」 두 번씩 → 03-10·03-11 할 일이 `pickTasks(…, 키트만 있음)` 와 같음 — 03-11 은 `sea1` 이 뽑히고, 새총이 없어 `balloon` 대신 `craft`.
  - 게임 오류 수(`errors.total`) 0 · 개발 서버 오류 0.
- 자동 플레이 봇 `tests/playthrough/scenario.js`: 새 단계 `fake-art` (night-shops 다음 — 가방에 가품이 있으면 박물관에서 내밀고 `museum:fake-told` · 가방에 남음 확인, 없으면 건너뜀). `home-grow` 는 밤톨 「집을 넓히고 싶어요」로 짓고 우편함은 빚 갚기만 (빚 없을 때 우편함이 집 넓히기를 잡으면 이상으로 적음).
- 자동 플레이 전체 `node tools/playtest.mjs --port=4282`: **40단계 · 통과 37 · 어색함 0 · 막힘 0 · 건너뜀 3** (fake-art = 가품 없음 · birthday · yearly) · 콘솔 오류 0 · 봇이 찾은 문제 5 (모두 작음 — 운세 부스 문·부스 FB-02·coco 집 문·내 집 문·광석 바위 앞에서 걷다 막힘, 이 트랙과 무관한 길찾기). `home-grow` 통과: 「1단계 · 1층 10×10 · 빚 20000 · 빚이 남아 2층은 다음에」 — 밤톨 「집을 넓히고 싶어요」로 지음. 13분.

## 다른 트랙과 겹칠 수 있는 곳 (합칠 때 줄 단위로 둘 다 살리기)
- `src/ui/dom.js` `DEX_CATEGORIES` 밑 한 줄 · `CATEGORY_NAME` 끝 `art` · `bag.js` canPick·whyNot · `ui/museum.js` 머리·donateLoop.
- `town/keepers.js` shopFlow 메뉴 · museumFlow 기증 부분 · `fakeTalk` 새 함수. `house/index.js` growTalk 통째(우편함/상점 갈래) · 처리기 `house-grow` 줄 · `grow.ask/offer` · menu 의 `scope` · placeFromBag.
- `house/furniture.js` load·info·make 머리 + `makeArt` · `places.js` itemModel·stockJobs 한 줄.
- 숫자 박은 테스트는 안 바뀜 (아이템·가구 수 그대로). `rating.test.mjs` 세기 deepEqual 에 `art: 0`.
- `assets/villagers/neuru.json` v2 (villagers.test 지문은 v1 만 보므로 건너뜀 — 일부러 고친 것).

## 남은 것
- 가방 「팔기」 값이 가품은 30 이라 기증 창에서도 값으로 가품을 알 수 있다 (예전부터). 감추려면 가방 칸 글에서 가품 값 빼기 — 보드 질문거리.
- 박물관 3D 미술관은 기증한 진품만 (가품은 못 들어가니 색 문제 없음). 집에 건 그림은 아이템 모델을 키운 것이라 액자 테가 조금 두껍다 — 보기 싫으면 `ART_PLACE.wallScale`.
- 일지 조건은 그날 할 일을 **처음 뽑을 때** 본다 (하루 중간에 키트를 사도 오늘 할 일은 그대로). 낚싯대·잠자리채·삽 할 일에는 needs 를 안 달았다 (시작 지급) — 필요하면 journal.json 한 칸씩.
- 봇은 도토리가 모자라 살랑에게서 가품을 잘 못 사서 `fake-art` 는 대개 건너뛴다 (선물 상자에서 가품이 나오면 돈다).
- 요소 편집기 표(`elem-editor/sheets.js`)에 journal `needs` · rating `art` 칸은 문서/요소 편집기 쪽에서.

## 문서 세션이 반영할 문장
- CLAUDE.md 「밤 특별 상점 (P54…)」 끝에: 「**가품 대사 (M17-P2 D181-A)**: 박물관 기증 창에서 가품을 고르면 `museum:fake` → 느루 `fakeTalk` 가 「이건 가품이에요…」 + 작품마다 다른 점 한 줄(`art-items.js MUSEUM_TELL` → 아이템 칸 `museumTell`)을 말하고 돌려준다. 가품 3D 색은 아이템 칸 `fakeLook`(= 아이템 스펙 variants.fake). 박물관 기증 분류는 `ui/dom.js MUSEUM_CATEGORIES`(도감 탭 DEX + art).」
- CLAUDE.md 「내 집 증축 (M14)」의 「우편함(92)에서 도토리 빚으로 짓고 갚는다」를 → 「도토리상점 밤톨 대화 「집을 넓히고 싶어요」로 짓고(`house.grow.ask`, M17-P2 D185-A), 우편함(92 `house-grow`, 빚이 있을 때만)에서 갚는다 — 규칙 `home.js growTopic`」.
- CLAUDE.md 「섬 일지 · 매일 할 거리」 섬 일지 줄 끝에: 「할 일 칸 `needs`(아이템 id)는 그날 할 일을 뽑을 때 가방에 있어야 뽑힌다 (sea1 = 스쿠버 키트 · balloon = 새총, M17-P2 D183-A).」
- CLAUDE.md 「하늘」 망원경 문장의 「섬에 놓은 FU-53」을 → 「섬·집 안에 놓은 FU-53 (집 안은 가구 메뉴 「망원경 보기」)」.
- CLAUDE.md 「큰 구조」 실내 줄 근처에: 「미술품(art.*, 진품·가품)은 집 가구 키트가 가구처럼 놓는다 — 그림 벽 칸 · 조각 바닥 1칸 (`house/furniture.js artInfos`·`makeArt`, 값 `ART_PLACE`), 섬 별점 「집 안 미술품」(rating.json `art`).」
- CONTRACTS 「밤 · 새벽」 또는 P54 절에 이벤트 `museum:fake {id}` · `museum:fake-told {id, tell}`, 서비스 `house.grow.ask({say})`·`house.grow.offer()`·`town.mail.write()`.
- docs/notes `night-special.md` 남은 것 1·2·3, `museum-stars.md` 「실내 FU-53」, `m14-home.md` 「상점 주인 대화에서 집 증축 묻기」, `m16-dive.md` 「sea1 조건 칸」은 이 트랙에서 끝남.
