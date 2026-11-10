# p33-clock — 11차 시계: 섬폰 시계 바늘로 게임 시각 바꾸기

사용자 요청 (2026-11-10): "시간을 돌리고 임의로 시계바늘을 조작하여 시계 변경하도록 기능을 제작해줘 / 시간 변경으로 낮 시간, 밤 시간에 할 수 있는 것 전부 가능하도록 진행".
브랜치 `p33-clock` (worktree `../island-worktrees/p33-clock`), 약속은 `docs/CONTRACTS.md` 「11차 시계」.

## 만든 것

| 곳 | 무엇 |
|---|---|
| `src/ui/clock.js` (새) | 섬폰 「🕰 시계」 창. 아날로그 시계 판(SVG) — 시침·분침을 마우스·손가락으로 끌어 돌린다. 돌린 만큼 이어서 세서 시침이 12를 넘으면 오전·오후가, 계속 돌리면 날이 바뀐다 (위에 「오늘·내일·모레」, 5시 경계). 시침은 5분 단위, 분침은 1분. 판 색이 시간대(새벽·낮·저녁·밤)를 따라가고, 그 시각에 할 수 있는 것(상점 열림/닫힘·별 보기·밤 곤충·낮 곤충·주민 나들이·저녁 모임)을 칩으로 보여 준다. 「적용」·「지금 시각으로 돌아가기」, 아래에 「실제 시각보다 3시간 20분 빨라요」. |
| 키보드·접근성 | 시계 판이 `role="slider"` (`aria-valuenow` = 0~1439 분, `aria-valuetext` = "오늘 오후 9:21, 밤"), 열면 판에 포커스. ←→ 15분 · ↑↓ 1시간 · PageUp/PageDown 3시간 · Home = 연 시각 · Enter = 적용. 범위 끝에 닿으면 글로 알림(`aria-live`). 휴대폰 A = 판에서는 적용, 단추 위에서는 누르기. |
| 휴대폰 화면 | 판 크기 `min(260px, 70vw, 42vh)`, `touch-action: none` 으로 끌기가 화면 스크롤로 새지 않음. 375×812 에서 창이 다 들어감 (가로 넘침 없음). |
| `src/sky/clock.js` | 순수 함수: `createTimeline` (시계 몸통 — offset·maxDay·되감기 막기·빠른 시간), `catchUpOffset`, `msAtClock`, `clampShift`, `floorMsOf`, `laterDay`, `dayDiff`. |
| `src/sky/index.js` | time 서비스 `offset`·`maxDay`·`range()`·`jumpTo(ms)`·`shiftTo(h, m, {days})`·`setOffset(ms)`·`resetOffset()` + 이벤트 `time:shift`. 옮기면 그 자리에서 `step(0)` 으로 하늘·조명·안개·밤 창 불빛(glow·window 재질 다시 훑기)·별/은하수를 맞추고 날씨 섞기도 새 날씨로 바로. |
| `src/data/day.js` | `runDailyReset(…, { allowBack })` — 지난 날이면 리셋 안 함. |
| `src/gameplay/gather/` | `time:shift` → `bugs.reshuffle()` (모두 거두고 새 시간대 곤충 몇 마리 바로) · `fishing.reshuffle()` (찌에 붙은 것 빼고 그림자 거둠, 곧 새로). |
| `src/gameplay/town/index.js` | `time:shift` → 주민 `V.spawn(now, weather)` 로 새 시간대 자리에 (밤이면 집 안, 낮이면 자주 가는 곳). 말하는 중·방 안·앉은 주민은 그대로. **다른 세션(M10 주민 만나기)이 고치는 파일이라 6줄만** 더했다. |

## 하루 두 번 받기 막기 — 정한 방법: "날짜는 앞으로만"

- `state.time.maxDay` = 가 본 가장 늦은 게임 날 (sky 가 날이 바뀔 때마다 적음). data 의 `island.dayKey`(하루 리셋한 날)와 늦은 쪽을 쓴다.
- **시계는 그 날 아침 5시보다 앞으로 돌릴 수 없다.** 오늘 안에서 되감기(밤 → 아침)는 된다 — 날(dayKey)이 같아서 하루 일은 그대로. 앞으로는 7일까지 한 번에.
- **「지금 시각으로 돌아가기」**: offset 을 0 으로. 하지만 실제 날짜가 가 본 날보다 앞이면(내일로 돌려 놓았던 경우) 하루씩 더해 **가 본 날의 같은 시각**으로 맞추고 "지난 날로는 못 가서, 오늘 같은 시각 …에 맞췄어요" 라고 알린다. 실제 날짜가 따라잡으면 offset 0 이 된다.
- 같은 규칙을 불러오기(`data:loaded`)·게임 열 때(PC 시계를 되돌렸을 때)·빠른 시간 → 실제 시간에도 건다. (예전에는 PC 시계를 되돌리면 "되돌려도 하루로 친다" 로 리셋을 또 했다 — 이번에 바꿈, `tests/day.test.mjs`.)
- 바깥 막이: `runDailyReset` 자체도 지난 날이면 아무것도 안 한다. 그날 받은 것(화석·조개·과일·주민 대화 친밀도·상점 물건·행사 기록)은 모두 dayKey 로 갈려서 같은 날을 다시 와도 두 번 안 준다.
- 날짜 흉내(`?date=` / `#date=`)는 시험 칸이라 열 때 `maxDay`·`offset` 을 비우고, 리셋은 `allowBack` (예전처럼 지난 날로도 리셋).

## 시각으로 갈리는 곳 — 바꾼 시각을 따르나 (점검표)

모두 `time.now()` 를 그때그때 읽거나 `time:tick`·`time:part`·`time:newday` 를 들어서, offset 만 바꾸면 따라온다. `jump` 가 `step(0)` 을 바로 불러 바뀐 이벤트를 그 자리에서 보낸다.

| 무엇 | 곳 | 따라오는 법 | 확인 |
|---|---|---|---|
| 조명·하늘·안개·별/은하수 | `sky/index.js` step | `now().hourF` 매 프레임 + jump 의 `step(0)` | dev-server 낮 ↔ 밤 스크린샷 |
| 밤 창 불빛 glow·window·가로등 | `sky/surfaces.js` | `nightFactor`, jump 가 재질 다시 훑기 | 밤 21시 nightFactor 1.00 |
| 배경음 시간대 | `audio/index.js` | `time:part`·`time:tick` | 밤 → `night` 곡 |
| 주민 시간표·귀가 | `town/villager.js` think · `rules.shouldBeOut` | 0.5초마다 + `time:shift` 다시 놓기 | 낮 6명 밖 → 밤 1명(퐁: 늦게 자는 주민) |
| 상점(8~22시)·가게 주인 | `town/keepers.js` `isOpen(now.hour)` | 매번 읽음 | 봇 단계에서 낮 10시 사기 |
| 박물관 | 시간 제한 없음 | — | — |
| 곤충·물고기 출현 시간 | `data/spawns.js` (`assets/data/items.json`) ← `gather` | 나올 때마다 `kit.now()` + `time:shift` 다시 놓기 | 낮: 무당벌레·메뚜기·고추잠자리 / 밤: 나방·귀뚜라미 |
| 밤 행사(불꽃놀이 20–22시 등 `events.json` hours) | `events/index.js` `inHours` | `time:tick` 마다 `E.check()` | 엔딩 뒤 행사 — `check-events` |
| 축제 저녁(모닥불 18시~) | `intro/index.js` · `festival/fest.js` | 매번 `now.hour` | 코드 확인 |
| 이사 첫 만남 장면(17시~) | `town/moving.js` update | 1초마다 `now.hour` | 코드 확인 |
| 망원경 별 보기(19–5시) | `decor/telescope.js` `isStarTime` | 매번 `hourF` | 테스트 (시계 안내와 같은 시간) |
| 첫날 밤 문 앞 팔기 | `house/index.js` | 매번 `now().hour` | 코드 확인 |
| 하루 리셋(5시) | `data/day.js` ← `time:newday` | jump 의 `step(0)` 이 바로 보냄 | 내일로 → `data:newday` 한 번, 돌아가기 → 다시 안 함 |
| 가을 버섯·봄 꽃잎 | `events/autumn.js`·`spring.js` | `time:part`·`time:tick` | 코드 확인 |
| 집 안 벽시계 바늘 | `house/furniture.js` | 매 프레임 `now()` | — |

고칠 것이 없던 곳은 위 표대로 그대로 두었다. 시각을 직접 `new Date()` 로 읽는 곳은 모두 time 서비스가 없을 때의 대비뿐이다.

## 점검

- `node --test tests/` — 새 `tests/clock.test.mjs` (13) + `day.test.mjs` 바뀐 규칙 (2 더함).
- 자동 플레이 새 단계 `clock-phone` (`tests/playthrough/scenario.js`, `yearly` 앞): 섬폰 → 🕰 시계 → **시침을 포인터로 끌어** 21시로 → 적용 → 밤인지·불빛 → 밤 곤충 잡기 → 다시 끌어 다음 날 10시 → 상점에서 가장 싼 물건 사기. 단독: `node tools/playtest.mjs --only=boot,naming,arrival,clock-phone`.
- 결과 (2026-11-10 23시): `node --test tests/` 409 통과 · `playtest --only=boot,naming,arrival,clock-phone` 4/4 통과 ("밤 20시 귀뚜라미 · 낮 다음 날 9시 팬지 씨 🌰240", 콘솔 오류 0 — 실제 시각이 23시라 21시는 '다음에 오는 21시' = 내일 밤) · `check-events --target=dev` 4/4 통과.
- dev-server 로 실제 마우스 끌기: 밤 11:11 → 시침을 시계 반대로 끌어 오후 2:51 → 적용 (낮·주민 나옴·낮 곤충) → 키보드 ↑×6 →×2 → Enter 오후 9:21 (밤·불빛·밤 곤충·밤 곡·주민 귀가) → ↓ 계속 = 오전 5:00 에서 멈추고 안내 → 새로 열기 뒤 offset 유지 → 돌아가기 = 실제 시각. 내일로 → 리셋 한 번 → 돌아가기 = caught 1 (내일 같은 시각), 3일 전으로 jump = floor.

## 남은 것·제안

- HUD 날씨 아이콘이 밤에도 ☀️ (맑음) — 시계와 상관없이 원래 그렇다. 밤엔 🌙 로 보이게 할지 다음 보드 QA 칸 후보.
- 봇의 `bot.setHour` 는 그대로 조용한 지름길(`time:shift` 없음). 봇이 시계 창을 쓰는 단계는 `clock-phone` 하나.

## 합친 뒤 고침 (p33-clock-fix, 2026-11-11)

- 전체 자동 플레이(`2026-11-10-23-56-dev`) `clock-phone` 🟡 「못 삼 (seed.tulip) 🌰0」: 시계 문제가 아니라 상점이었다. 시계로 옮긴 뒤 여는 시간(10시)·진열(`economy.stock()` 을 열 때마다 읽음)은 맞았고 도토리도 1640 이었다. 바로 앞 단계에서 튤립 씨앗을 선물로 받아 **가방 빈칸이 0** 이었는데, 상점 `buy()` 가 `inventory.isFull()`(빈칸 0)만 보고 막아서 가진 씨앗 봉투에 겹쳐 담을 수 있어도 못 샀다. 상점 알림은 상점 자체 toast 라 봇 기록에 안 남아 「🌰0」만 보였다.
- 고침: `src/ui/shop.js` 사기를 `inventory.canFit(id, 1) > 0` 로 판단 (테스트 `clock.test.mjs` 「상점: 가방이 꽉 차도…」). 봇 단계는 가방이 정말 꽉 차서 담을 수 없으면 먼저 하나 팔고 사며, 결과에 가방 빈칸을 적는다.
- 확인: 전체 자동 플레이 27✅ 2🟡 0⛔ (🟡 decor·moving-in 은 시계와 무관한 예전 것), `clock-phone` ✅ 「밤 21시 나방 · 낮 12-20 10시 seed.tulip 🌰240」.
