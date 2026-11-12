# M13-P1 섬 일지 (13차 보드 D141-A 추천안)

- 설정 `assets/journal/journal.json` — 하루 할 일 `daily` 5 (할 일 13가지 중 날짜·섬 씨앗으로 고름, 같은 「셀 일」은 하루 하나) · 다 한 날 덤 `allDoneBonus` 50 · 오래 하는 목표 7 (단계 셋) · 포인트 교환 8칸 (지금 있는 아이템·도토리만 — 새 모델 없음, 일지 전용 가구 FU-63–66 은 P4 별 조각 가구가 생기면 더함).
- 규칙(순수) `src/gameplay/journal/rules.js` (`pickTasks`·`ensure`·`bump`·`view`·`spend`), 모듈 `index.js` (이벤트로 세기 · 섬폰 「📔 섬 일지」 창 · 서비스 `ctx.services.journal` `{open, count, buy, view, points}` · 이벤트 `journal:points`).
- 셀 일: fish(sfx catch) · bug(bug-catch) · shake · dig(fossil) · weed(sfx pickup kind:'weed' — `gather/pickup.js` 에 kind 를 더함) · water(gather:watered 송이 수) · plant(gather:planted) · talk(dialog:line 섬 주민 이름, 하루 한 사람 한 번) · sell(상점 창이 열린 동안 도토리가 늘 때) · craft(house:craft) · donate(museum:changed) · allDone.
- 저장 `state.journal = { day, tasks:[{id,n,done}], points, earned, counts, goals, allDay, bought, talked }`. 첫날 할 일(`flags.firstday.finished`)이 끝난 뒤부터 센다.
- 게시: 새 에셋 폴더 `journal` 은 `build-web.mjs` island 묶음.

## 문서 세션이 반영할 문장
- CLAUDE.md 큰 구조: 「섬 일지 (M13-P1, `src/gameplay/journal/`) — 설정 `assets/journal/journal.json`, 저장 `state.journal`, 섬폰 📔. 셀 일은 다른 모듈 이벤트만 듣는다 (새 놀이가 생기면 sfx·이벤트 이름을 index.js `listen` 에 더함).」
- CONTRACTS: `journal:points { points, gained | spent, id }` · sfx `pickup` 에 `kind`.
