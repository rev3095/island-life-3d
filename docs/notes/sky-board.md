# 하늘 검수 보드 (sky) — 2026-11-04

보드 https://claude.ai/artifact/UtvXfFPhvgvYREhHoaAyGE · 파일 `concept/sky-board.html` + `concept/board-kit.js` + 그림 `concept/sky/*.jpg` (게시 경로 `sky/*.jpg`). 보드 id `sky`, 결정 D58–D66, 하늘 층 SK-01–08. 게시 v1 때 capabilities `db`(`applied`·`history` 쓰기 admin) · `user`, 아이콘 palette.

## 그림 찍는 법 (다시 찍을 때)
게임 v16 하늘 셰이더(`src/sky/dome.js`)를 개발판에서 그대로 찍었다 — UI 없이 캔버스만, 640×400 JPG.
1. dev-server `/index.html` 을 1280×800 으로 열고 게임 그리기 고리를 멈춘다 (`ctx.renderer.setAnimationLoop(null)`), 선착장(`places.dock`)으로 순간이동.
2. 날씨는 `time.setWeather('clear')` 뒤 `ctx.step(1/30)` 500번 (날씨가 섞이는 시간).
3. 장마다: `time.skyFx(기본값)` → `time.skyFx({ …그 선택지 값, puffs })` → `time.setHour(h)` → 카메라를 (플레이어 + (0, 3.2, 9)) 에서 북쪽 위 (높이 +4.5, 밤 +7) 또는 해 쪽(`uSunDir` 수평 방향)으로 → `renderer.render` → 캔버스를 640×400 으로 줄여 `toBlob('image/jpeg', .84)` → `POST /api/assets?name=sky-<이름>` → `assets/references/` 에서 `concept/sky/<이름>.jpg` 로 복사.
4. 시각: 낮 13시, 노을 17.6시(해 쪽은 17.3시), 밤 22.5시, 비 11시.

## "검수 보드 반영" 때 (이 보드)
`concept/README.md` 순서 그대로 (`boards/sky` ↔ `applied/sky`). 결정마다 고른 안의 값을 **`src/sky/dome.js` 의 `SKY_FX` 기본값**에 그대로 쓴다 — 보드의 `DECISIONS` 배열 다섯째 칸(`fx`)이 그 값이다:

| 결정 | A (지금) | B | C | 고칠 곳 |
|---|---|---|---|---|
| D58 맑은 날 구름 양 | `cloudClear 0.60` | 0.50 | 0.72 | `SKY_FX.cloudClear` |
| D59 구름 가장자리 | `cloudEdge 0.07` | 0.20 | 0.015 + `shade 0.9` | `cloudEdge` (`shade`) |
| D60 구름 그늘 | `shade 0.75 · shadeDeep 0` | 0.22 · 0 | 0.85 · 1 | `shade` · `shadeDeep` |
| D61 노을 쪽 지평선 빛 | `sunsetSide 0.34 · sunGlow 0.16` | 0.62 · 0.16 | 0.15 · 0.10 | `sunsetSide` · `sunGlow` |
| D62 해 빛살 | `rays 0.10` | 0.24 | 0 | `rays` |
| D63 낮 하늘 색 | `gradDeep 0` | 0.55 | −0.55 | `gradDeep` |
| D64 북쪽 3D 솜구름 | 같이 | 빼기 | — | `src/sky/index.js` 의 `let puffs` 처음 값 (빼면 `clouds.js` 를 아예 안 만들어도 됨) |
| D65 밤하늘 | `milky 0.12 · starBoost 1` | 0.28 · 1.6 | 0 · 1 | `milky` · `starBoost` |
| D66 구름 빠르기 | `cloudSpeed [0.012, 0.004]` | ×2 | ×¼ | `cloudSpeed` |

- 의견(D·SK)은 셰이더를 직접 고친다 (`docs/SHADERS.md` 「하늘 셰이더」). 바꾼 뒤 위 순서로 그 결정 그림을 다시 찍어 보드를 다시 게시하면 사용자가 바뀐 모습을 본다.
- 값만 바꿀 때는 `node --test tests/` → dev-server 로 낮·노을·밤 확인 → 커밋 → 게임 링크 다시 게시 (웹 배포 절, 바뀐 모듈 `src/sky/dome.js`) → `applied/sky` · `history/sky-v<n>` → 홈 `status/sky`.
- 게임 안에서 값을 바로 바꿔 볼 때: `ctx.services.time.skyFx({ cloudClear: 0.5, puffs: false })` (돌려주는 값 = 지금 값). 스타일 편집기로 옮기는 것은 다음 일 (지금은 `presets.json` 밖).

## 사양별 (render/quality.js)
`SKY_QUALITY`: 높음 구름 5겹·빛살·은하수 · 적정 4겹·빛살·은하수 · 낮음 3겹·은하수 · 매우 낮음 2겹. 보드 값은 사양과 따로 (값은 모든 사양에 같게 걸린다).
