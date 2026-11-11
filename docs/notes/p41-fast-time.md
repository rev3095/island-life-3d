# P41 시간 빠르기 · 원형 시계 HUD (브랜치 `p41-fast-time`)

사용자 요청 (2026-11-11): "게임 시간은 현실보다 빠르게 진행, 시계는 원형으로 시간 표시 밑에 시간 조정할수있게 ui 만들고 기능 만들어".
바탕은 11차 시계 (`docs/notes/p33-clock.md` — 섬폰 「🕰 시계」, offset, 날짜는 앞으로만). 약속은 `docs/CONTRACTS.md` 「P41 시간 빠르기」.

## 정한 것

| 무엇 | 정한 값 | 까닭 |
|---|---|---|
| 빠르기 셋 | 실제와 같게 ×1 · **빠르게 ×12 (처음)** · 아주 빠르게 ×30 | ×12 = 게임 하루가 실제 2시간. 한 번 30분~1시간 하면 아침→한낮, 저녁→밤 처럼 시간대가 한두 번 바뀌는 것이 보이고, 상점(8–22시)·밤 곤충·별 보기를 한 자리에서 다 해 볼 수 있다. ×30 (하루 48분)은 짧게 자주 하는 사람용, ×60 (예전 「빠른 시간」, 하루 24분)은 너무 빨라 주민 대화·낚시 한 번에 한 시간이 지나 뺐다. 실제와 같게는 예전 그대로 (동물의 숲처럼 실제 시계) |
| 닫아 둔 동안 | **멈췄다가 이어서** (`whenClosed: "pause"`) | 빠르게일 때 따라잡기를 하면 하루만 닫아도 12일이 지나 계절 행사·이사·생일을 놓친다. 멈춤이면 "게임 하루 = 내가 논 2시간" 이 지켜진다. 탭을 숨겨도(프레임 사이 1.5초 넘게) 멈춘다. 요소 편집기에서 「흐른 만큼 따라잡기」로 바꿀 수 있다 (그때도 하루 리셋은 한 번만, 잡초는 30일치까지). **실제와 같게는 언제나 실제 시계** (닫아 둔 동안에도 흐름) |
| 하루 리셋 | 그대로 05:00, `time:newday` → data 리셋 한 번 | 빠르게 흐르다 5시를 넘으면 그 자리에서 날짜가 넘어간다 (dev-server 로 4:50 → 5:02 확인) |
| 날짜는 앞으로만 | 그대로 | 빠르게는 시각이 늘기만 하고, 빠르기를 바꿔도 그 순간 시각이 이어진다 (끊김 없음). 「돌아가기」·−1시간·바늘은 가 본 날 아침 5시 아래로 못 간다 |
| 값 자리 | `assets/data/rules.json` `time` = `{ speed, speeds: { real: 1, fast, faster }, whenClosed }` | 요소 편집기 「규칙 숫자」 표 → 「시간 빠르기 (게임 시계)」 칸 넷 (`elem-editor/sheets.js`), 값 검사 `tools/elem-checks.mjs` (빠르게 > 1, 아주 빠르게 ≥ 빠르게). "요소 반영" 으로 그대로 들어간다 |
| 고른 빠르기 | `state.time.speed` (null = rules.json 처음 값) | 섬폰 설정 「시간 빠르기」 · HUD 빠르기 단추 |

## 시계 몸통 (`src/sky/clock.js` `createTimeline`)

- 실제와 같게(×1): 시각 = `Date.now() + baseShift(날짜 흉내) + state.time.offset`.
- 빠르게(×N): 시각 = `state.time.game` (ms). sky 의 `step()` 첫 줄 `tl.advance()` 가 **실제로 흐른 ms × N** 을 더한다 (프레임 dt 가 아니라 실제 시계 — 프레임 상한 0.05초에 걸리는 느린 기기에서도 정확). 프레임 사이가 `GAP_MS` 1.5초를 넘으면 'pause' 는 0 으로 친다.
- 열 때 `tl.start({ fresh })`: 날짜 흉내(`?date=`/`#date=`)는 그 날짜의 지금 시각에서 새로 (`fresh` — 저장 시각을 안 씀), 진짜 섬은 저장된 `game` 에서 (catchUp 이면 `realAt` 부터 흐른 만큼 더함).
- 예전 저장 `mode: 'fast'` (×60) 는 그 시각에서 「아주 빠르게」로 이어지고 `mode`·`fastOffset` 칸은 지운다. 예전 `offset` 은 실제와 같게·빠르게 모두 이어진다 (빠르게 첫 시각 = 실제 + offset).
- 봇·점검의 `setPaused(true)` + `setHour` 는 그대로 (멈춘 동안 advance 는 아무것도 안 함). 자동 플레이는 `clock` 단계에서 멈추므로 빠르기와 상관없이 같은 흐름.

## time 서비스 (더한 것)

`speed` · `speedMult` · `speeds()` → `[{ key, name, mult, text }]` · `whenClosed` · `setSpeed(key)` (이벤트 `time:speed { speed, mult }`). `offset` 은 이제 "실제 시계에서 떨어진 정도" 를 계산해서 준다 (빠르게면 game − 실제). 예전 `mode`/`setMode` 는 이름만 남김 ('real' | 'fast').

## 화면

- **원형 시계 HUD** (`src/ui/hudclock.js`, 왼쪽 위 시계 칸 `.pk-clock` 에 붙음): 52px 아날로그 판 — 섬폰 「🕰 시계」 창과 **같은 판 부품** `createDial` (`src/ui/clock.js`, `compact`: 숫자 없이 굵은 바늘·4 눈금, 판 색이 새벽·낮·저녁·밤). 바늘을 끌어 놓으면 그 시각으로 바로 (5분 단위, 범위 끝은 붙음), 끄는 동안 밑에 "→ 오늘 오후 3:20 (낮)" 미리 보기.
- **그 밑 조정 칸**: `−1시간` · `⏩ ×12` (누를 때마다 실제와 같게 → 빠르게 → 아주 빠르게, 알림에 "게임 하루 = 실제 2시간") · `+1시간` · `🕰` (섬폰 시계 창 — 자세히). −1시간은 오늘 5시 아래면 꺼짐.
- **휴대폰(폭 560px 이하)**: 조정 칸이 접혀 있고 시계를 톡 누르면 펼침/접힘. 펼치면 글이 `−1` · `+1` 로 짧아지고 🕰 는 숨김 (섬폰 줄로) — 375px 에서 오른쪽 위 메뉴 단추와 안 겹침 (시계 칸 오른쪽 188px < 메뉴 195px).
- 펼친 조정 칸만큼 시계 밑에 붙은 것(첫날 할 일 목록 `intro.css` · 축제 칸 휴대폰 `festival.css`)이 내려가게 CSS 변수 `--pk-clock-extra` (두 파일에서 `top` 에 `+ var(--pk-clock-extra, 0px)` 만 더함).
- **키보드·접근성**: 시계 판 `role="slider"` (`aria-valuetext` "오늘 오후 9:21, 밤", `aria-expanded` = 조정 칸). Tab 으로 와서 ←→ 15분 · ↑↓ 1시간 · PageUp/Down 3시간 미리 보기 → Enter 적용 · Esc 취소. 시계·단추에서 키를 멈춰 게임 이동으로 새지 않고, **끌기·Enter·Esc 뒤와 마우스로 누른 단추는 포커스를 놓는다** — 안 그러면 Space(행동)가 시계·단추로 가서 줍기·문 열기가 안 됐다 (자동 플레이에서 찾음). 단추마다 `aria-label`.
- **섬폰 설정 「시간 빠르기」**: 실제와 같게 / 빠르게 ×12 / 아주 빠르게 ×30 + "실제 1분 = 게임 12분 · 게임 하루 = 실제 2시간. 게임을 닫아 두면 멈췄다가 이어서 흘러요." (예전 「시간: 실제 시간 / 빠른 시간」 줄을 바꿈).
- 문제 알리기 문서 `place.timeMode` = 이제 빠르기 키.

## 날짜에 기대는 곳 — 게임 날짜를 따르나

모두 `time.now()` (dayKey·month·hour) 나 `data.day.key()` 를 그때그때 읽어서, 시계가 빨라지면 같이 빨라진다. `new Date()`·`Date.now()` 는 time 서비스가 없을 때의 대비와 실제 시간 재기(놀이 타이머·팁 기록·보고 날짜)뿐이다 (`grep` 으로 모두 확인).

| 무엇 | 곳 | 읽는 것 |
|---|---|---|
| 계절·계절 행사 날짜·시간 | `sky` `computeNow().season` · `events/calendar.js` `activeOn(cfg, now.dayKey)` | 게임 dayKey |
| 생일 | `data/birthdays.js` `isBirthday(slug, dayKey)` ← town | 게임 dayKey |
| 이사 7일·떠나기 | `town/moving.js`·`movein.js` `addDays(dayKey)`·`daysBetween` | 게임 dayKey |
| 밤 시간 (야시장 요일·달빛 가게·천막) | `night/rules.js` `weekdayOf(dayKey)` · `now.hourF` | 게임 dayKey·시각 |
| 투어 하루 횟수 | `tour/index.js` `data.day.key()` | 게임 dayKey |
| 상점 하루 진열 | `data/economy.js` `shopStock(dayKey)` | 게임 dayKey |
| 하루 리셋 (화석·조개·잡초·과일) | `data/day.js` ← `time:newday` | 게임 dayKey, 앞으로만 |

## 확인

- `node --test tests/` — `tests/clock.test.mjs` 에 시간 빠르기 7개 더함 (rules 값·×12 흐름·닫아 둔 동안 pause/catchUp/실제·빠르기 바꿔도 끊김 없음·5시 넘어 날짜·멈춤·화면 연결), `report.test.mjs` timeMode.
- 자동 플레이 `clock-phone` 단계를 새 UI 로: HUD 빠르기 단추 한 바퀴 → +1시간 단추 (60분) → **HUD 시침 끌어 놓기**로 21시 → 밤 곤충 → 섬폰 시계 창으로 10시 → 상점에서 사기. 멈춤 상태였으면 끝에 다시 멈춤.
- `node tools/check-events.mjs --target=dev` 4/4.
- dev-server: 실제 10초 = 게임 2분 (×12), 새로 열면 저장한 시각에서 이어서, HUD 빠르기 단추 ×30 + 4:50 → 실제 26초 뒤 5:02 · `data:newday` 한 번 · 날짜 11월 11일, 휴대폰 375px 접기·펼치기, 키보드 →×4 + Enter (플레이어 안 움직임), 오류 0. 스크린샷: 노트 폴더 `p41-fast-time-shots/`.

## 다른 세션과 겹치는 파일 (최소로 고침)

`src/gameplay/intro/intro.css` (목록 top 세 줄) · `src/gameplay/festival/festival.css` (휴대폰 fe-hud top 한 줄) · `src/data/index.js` (data 서비스에 `rules: RULES` 한 줄) · `src/ui/index.js` (HUD 시계 붙이기 · 이벤트 두 줄 · 서비스 한 줄) · `src/ui/report.js` (timeMode 한 줄). `tests/playthrough/bot.js` 는 안 고쳤다.
