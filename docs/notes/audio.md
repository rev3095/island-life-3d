# T4 사운드 — 계약 메모와 제안

`src/audio/` 는 `docs/CONTRACTS.md` 의 `audio` 서비스를 그대로 올린다. 아래는 계약에 적혀 있지 않아서 정한 것과, 합칠 때 계약에 넣으면 좋을 제안이다.

## 정한 것 (계약 해석)

| 항목 | 동작 |
|---|---|
| `bgm(name)` | 곡 이름이면 그 곡으로 고정. **`bgm('auto')`** = 자동 선곡으로 돌아가기, **`bgm(null)`** (또는 `'off'`) = 배경음 끄기. 처음 상태는 자동 |
| 자동 선곡 | 비(`weather === 'rain'`) → `rain`, 아니면 `time.now().hour` 로 5~8 `dawn` · 8~12 `morning` · 12~17 `afternoon` · 17~19 `evening` · 그 밖 `night`. `time` 서비스가 없으면 실제 시계 |
| 우선순위 | 열린 창(`ui:open {panel:'shop'|'museum'}`) > `bgm(name)` 으로 고른 곡 > 자동. `ui:close` 로 창이 닫히면 아래 단계로 돌아간다 |
| `time:part` 만으로는 부족 | 계약의 `part` 는 `day` 하나라 오전/오후가 안 나뉜다 → `time:tick` 도 들어서 정오에 `morning → afternoon` 으로 바꾼다 |
| 크로스페이드 | 시간·날씨 4초, 직접 고름 2초, 상점·박물관 창 1.2초 |
| `speak(text, voice)` | `Promise<boolean>` — 끝까지 말하면 `true`, 새 줄·`stopVoice()`·`ui:close {panel:'dialog'}`·탭 숨김으로 끊기면 `false`. 소리가 아직 잠겨 있거나 음량 0이어도 **같은 시간 뒤에** 끝난다 (대사 넘김 타이밍이 소리 유무와 상관없게). 한 줄 최대 60글자까지만 소리 냄 |
| `dialog:line` | `voice` 가 있을 때만 말한다 (플레이어 대사처럼 `voice` 가 없으면 조용히) |
| `sfx` 이벤트 | `{ name, volume?, pitch?, pan?, delay? }` — 이름 말고 나머지는 선택 |
| `setVolume(kind, v)` | 버스 음량을 바꾸고 `ctx.state.settings[kind]` 에도 적는다 (저장되게). 실제 게인 = v² |

## 제안 (CONTRACTS.md 에 넣으면 좋을 것)

1. **`settings:changed` 이벤트** — 이벤트 표에 없다. audio 는 `{ key, value }` 또는 `{ bgm, sfx, voice }` 둘 다 받아서 `ctx.state.settings` 를 다시 읽는다. ui 의 설정 화면이 음량을 바꾼 뒤 이 이벤트를 보내거나 `audio.setVolume()` 을 직접 부르면 된다.
2. **`bgm('auto')` / `bgm(null)` 의미**를 위 표처럼 계약에 적기. 집 안에 들어갈 때 gameplay 가 `bgm('indoor')`, 나올 때 `bgm('auto')`.
3. 개발용 추가 멤버(계약 밖): `stopVoice()`, `unlocked`, `current`(지금 곡), `wanted`(골라야 할 곡), `position`(마디·바퀴), `stats()`(살아 있는 노드 수), `context`, `engine`. 게임 코드는 계약의 5개만 쓰면 된다.

## 소리 고치는 법 (데모 페이지는 계속 유지)

`demos/audio.html` 은 소리를 다듬는 작업대로 계속 둔다. `node dev-server.mjs --port=4185` → http://localhost:4185/demos/audio.html, 고친 뒤 새로고침하면 바로 들린다.

| 고칠 것 | 파일 · 위치 |
|---|---|
| 곡의 멜로디·화음 | `src/audio/songs.js` 곡마다 `mel`(음이름:박자, `\|` 마디선) · `prog`(화음 기호). 길이가 안 맞으면 불러올 때 오류로 알려 준다 |
| 곡의 반주·변주 | 같은 파일 `bar(s, i, pass)` — `pass % 2 === 1` 이 두 번째 바퀴 |
| 곡 전체 크기 | 곡 정의의 `gain`, 악기별 크기는 `setup` 의 `s.channel(이름, { gain, pan, verb })` |
| 악기 음색 | `src/audio/instruments.js` 의 `TONED`(배음·감쇠) · `UNTONED`(타악기·자연 소리) |
| 효과음 소리·크기 | `src/audio/sfx.js` 의 `RECIPES`(소리) · `TRIM_DB`(크기, dB) |
| 주민 목소리 | `src/audio/voice.js` 의 `VOICES` — `f0` 높이, `syl` 빠르기, `formant` 입 크기, `gain` 크기 |
| 시각별 자동 곡 | `src/audio/index.js` 의 `trackForHour` |

고친 뒤에는 데모의 **레벨 측정** 버튼으로 크기를 다시 본다: 배경음은 곡끼리 LUFS 가 ±2dB 안, peak 는 −1 dBFS 아래(빨간 표시 없음)면 된다.

## 다른 트랙이 보내 주면 좋은 효과음

- player: 걸음마다 `sfx {name:'step-grass'|'step-sand'|'step-wood'}` (칸 종류에 따라), 도구 사용 때 `cast` · `net-swing` · `dig` · `axe-wood` · `axe-rock` · `water`
- ui: 버튼 `menu`, 가방 열기 `bag-open`, 판매 `sell`
- gameplay(2차): 낚시 `nibble` → `bite` → `splash` → `catch`, 곤충 `bug-catch`, 나무 흔들기 `shake` → `fruit-drop`, 화석 `fossil`, 도토리 `acorn`, 줍기 `pickup`, 문 `door`, 벌 `bee`
