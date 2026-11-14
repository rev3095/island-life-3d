# M19-P6 다듬기 (16차 보드 D207-A)

브랜치 `m19-p6-polish` (main 2bc7800 에서), 포트 4306. backlog 작은 다듬기 7개. 사용자 원칙대로 브라우저·스크린샷·점검 도구 확인 없이 코드로만 고치고 `node --test tests/` 한 번.
P5(섬폰 추억 탭·이사·장면) 와 겹치지 않게 `src/ui/phone.js`·`album.js`·`town/moving.js`·`assets/story/` 는 건드리지 않았다.

## 고친 것

| ID | 무엇 | 고친 곳 |
|---|---|---|
| B-09 | 안내를 「짧게」 고른 사람에게 s02(할 일 목록 건네기)가 안 나온다 | `town/keepers.js` 가 `town:intro` 에 `short: flags.firstday.skip === 'short'` 를 싣고, `story/rules.js` `guide-done` 트리거가 `!p.short` 일 때만 맞음 |
| B-16 | 휴대폰 세로(600px 이하)에서 축제 진행판(`.fe-hud`)이 보이면 행사 칸(`.ev-chip`)이 그 밑(112px)으로 내려간다. 시계를 펼친 만큼(`--pk-clock-extra`)도 같이 내려간다 | `events/eventsui.js` CSS (`body:has(.fe-hud:not([hidden]))`) |
| B-22 | 실내 밤 빛을 덜 노랗게: 하늘 빛 `#FFE2B8 → #FFEAD0`, 등 빛 `#FFD08A → #FFDDAA` (세기는 그대로). `presets.json indoor` 는 낮·밤 공통이라 밤 빛 표 `sky/indoor.js NIGHT` 에서 고침 | `src/sky/indoor.js` |
| B-23 | 560px 이하: 대화 선택지 `.pk-choices` 가 최대 `min(58vh, 420px)` 에서 스크롤 (벽지·바닥 목록이 길 때), 줄 높이 44px 유지. 상점 코너 줄 `.pk-stock-item` 최소 52px · 이름 칸 `minmax(0,1fr)` + 줄바꿈, 값은 한 줄 | `src/ui/ui.css` |
| B-27 | HUD 날씨: 밤 19–5시 맑음은 🌙 (시각이 바뀌어 밤이 되면 바로 다시 그림) | `src/ui/hud.js` |
| B-28 | **일부**: 게임용 짧은 이름 칸 `presets.json shortLabels` (`cozy: 포근`, `toon: 툰 (예전)`) + `presets.js PRESET_SHORT` (없으면 labels) + 서비스 `style.shortLabels`, 검사 `checkStyle` 에 한 줄. **`phone.js` 단추는 P5 가 그 파일을 고치는 중이라 손대지 않음** — 아래 남은 것 | `assets/style/presets.json` · `src/render/presets.js` · `src/render/index.js` |
| B-30 | 올려다볼수록 틸트 흐림을 0 쪽으로: `post.lookUp(t)` = 흐림 × (1 − clamp(t,0,1)), 프레임마다 `render/index.js` 가 `player.camera.look.tilt` 로 부름 (2% 넘게 바뀔 때만 다시 계산, 0 이면 흐림 패스 꺼짐 → 그동안 GPU 도 아낌) | `src/render/post.js` · `src/render/index.js` |

## 남은 것

- **B-28 마지막 한 줄** (P5 합친 뒤): `src/ui/phone.js` 「화면 모습」의
  `[['cozy', '포근'], ['toon', '툰 (예전)']]` →
  `Object.entries(style?.shortLabels ?? { cozy: '포근', toon: '툰 (예전)' })`.
- 화면으로 본 것은 없다 (사용자 원칙). B-16 의 112px 는 진행판 높이(이모 18px + 안쪽 여백) 계산 값, B-22 색은 보고 더 고를 수 있다 (스타일 편집기 값 아님 — `sky/indoor.js`).

## 문서 세션이 반영할 문장

- CLAUDE.md 「스타일과 "스타일 반영" 흐름」의 presets.json 모양에 `shortLabels` 를 더한다: `{version, default, labels, shortLabels, presets:{cozy,toon}, indoor, sky}` — `labels` 는 편집기용 긴 이름, `shortLabels` 는 게임 화면(섬폰 「화면 모습」)용 짧은 이름 (서비스 `style.shortLabels`).
- devlog: M19-P6 다듬기 B-09 · B-16 · B-22 · B-23 · B-27 · B-30 고침, B-28 은 이름 칸까지 (phone.js 한 줄은 P5 뒤).
