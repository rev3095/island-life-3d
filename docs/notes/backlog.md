# 남은 일 모음 (backlog)

`docs/notes/*.md` 의 「남은 것 · 다음 · 아직 안 한 것 · 제안 · 알아 둘 것」을 한 표로 모았다. 지금 코드·에셋과 맞춰 보고 상태를 적었다 (「이번 p39 에서」 = 이 브랜치가 하는 것, 「최적화 세션」 = 같이 돌고 있는 성능 세션 몫. M11 옷 세션 몫은 노트에 없었다).
2026-11-11 기준 (브랜치 p39-scenes, main 8eb29b2 위).
크기: **작음** = 파일 한두 개, 게임 흐름은 그대로 (문구·알림 글·빠진 이름표·숫자 하나·문서 줄·테스트·봇 단계) / **큼** = 새 기능·새 리소스·밸런스나 설계 결정·모듈 사이 약속 바꾸기·사용자가 골라야 함.

모두 116줄: 남음(반쯤 포함) 작음 **41** · 남음 큼 **18** · 이번 p39·다른 세션 **6** · 이미 됨 **51**.
P39 에서 바로 고친 작은 것 6 (B-25 · B-26 · B-44 · B-45 · B-60 · B-65) → 남음 작음 **35**. 남긴 작은 것 가운데 B-09(장면 흐름이 바뀜) · B-22·B-27·B-40(사용자가 보고 골라야 함) · B-30(최적화 세션 파일) · B-28(위) · B-39(오류 모으기 시점) · B-50(게시본 봇 로딩 — 지금 어떻게 넘기는지 먼저 확인)은 일부러 두었다.

### 스토리·장면

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-01 | m12-night | s20 달빛 가게 첫 방문 장면 (지금은 첫 만남 대사 `lines.<slug>.first`) | 큼 | 이번 p39 에서 | night | `assets/story/scenes/s20-*.json` |
| B-02 | m12-night | s21 새벽 천막 첫 방문 장면 | 큼 | 이번 p39 에서 | night | `assets/story/scenes/s21-*.json` |
| B-03 | p35-tour | s22 첫 섬 여행 + 배가 바다로 나가는 3초 장면 (지금은 원형 전환 + 알림) | 큼 | 이번 p39 에서 | tour 「배 장면」 | `assets/story/scenes/s22-*.json` · `src/gameplay/tour/` |
| B-04 | story | H1 s01 도착 장면을 이름 정하기 *전* 배 위로 (지금은 이름 정한 뒤 `intro:named`) | 큼 | 남음 | 스토리 s01 연출안 A | `src/gameplay/intro/index.js` · `story/rules.js` |
| B-05 | story | H2 town 이 `story.playing` 을 보고 기다리기 (지금은 story 가 `ui.isBlocking` 을 감싸서 대신) | 큼 | 반쯤 (감싸기로 돌아감) | — | `town/keepers.js` · `villager.js` · `story/index.js` |
| B-06 | story | H3 엔딩 사진 뒤 주민 축하 편지 (s12-C) — `festival:end` 듣고 `mail.post(slug, 'festival')`, 편지 글 `letters.festival` 없음 | 큼 | 남음 | 스토리 s12 | `src/gameplay/town/mail.js` · `assets/villagers/*.json` |
| B-07 | story | H4 장면 이모티콘을 Z5 이모티콘 id 로 (`emote.glyph(id)`), 말풍선 모양 맞추기 — 지금은 `EMOTES` 글자 50개 | 큼 | 남음 | Z5 축제 보드 | `story/rules.js` · `layer.js` · `story.css` |
| B-08 | story | 장면 시작 대기열을 저장하지 않음 (부품 얻고 바로 새로고침하면 그 장면은 다음 트리거까지 안 나옴) | 작음 | **고침 (p43)** — `state.story.queue` 에 줄 선 장면·트는 중인 장면을 적어 두고 다시 열면 이어서 | — | `src/gameplay/story/index.js` |
| B-09 | p11-tune | 짧게 고른 사람에게도 s02(할 일 목록 건네기)가 나옴 → 트리거 `guide-done` 에 `skip` 조건 | 작음 | 남음 | wave7 D44 | `src/gameplay/story/rules.js` (또는 `s02-guide-after.json`) |
| B-10 | m6-p0-pack | `?story=s11-ending-photo` 미리 보기에서 카메라가 나무에 붙어 보임 — 축제 자리(`places.festival`)가 생겼으니 다시 보기 | 작음 | 반쯤 (다시 볼 것) | — | `story/rules.js cameraAt` · `world/festival.js` |

### 밤·투어

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-11 | m12-night | 야시장 노점 자리가 축제 부스(엔딩 뒤)와 겹치지 않는지 손 점검 | 작음 | 남음 | night D106·D107 | `src/gameplay/night/index.js` |
| B-12 | m12-night | 가방·도감 「밤」 분류 탭 — 가방엔 분류 탭이 아예 없고, 도감 탭은 물고기·곤충·화석뿐 | 큼 | 남음 | night | `src/ui/bag.js` · `phone.js` · `data/night-items.js` |
| B-13 | p35-tour | UI-23 오른쪽 위 「🏝 섬 이름」 작은 칸 (지금은 도착 알림으로 대신) | 작음 | **고침 (p43)** — `.pk-tour-tag` 를 HUD 오른쪽 위 줄 맨 위에, 돌아오면 치움 (봇 tour 단계가 확인) | tour UI-23 | `src/gameplay/tour/index.js` · `ui.css` |
| B-14 | p35-tour | 배 표를 도토리상점 진열에도 (지금은 선착장 배에서만, 없으면 1,000 도토리) | 큼 | 남음 | tour | `assets/data/rules.json shop` · `src/data/economy.js` |

### 계절 행사

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-15 | m8-events | 도장(UI-15)을 달력 창 아래 칸 → 도감 탭으로 옮기기 | 큼 | 남음 | wave8 UI-15 | `src/ui/phone.js` · `gameplay/events/eventsui.js` |
| B-16 | m8-events | 휴대폰 세로: 행사 칸과 축제 진행판(600px 아래)이 축제 날 저녁에 겹칠 수 있음 — 확인 | 작음 | 남음 | wave8 | `events/eventsui.js` · `festival/` 진행판 |

### 집·실내·꾸미기

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-17 | m9-decor | 주민이 벤치·피크닉 탁자에 앉는 동작 (지금은 앞에 서기만) | 큼 | 남음 | wave9 | `assets/specs/*.json` animations · `town/actor.js` |
| B-18 | m9-decor | 꾸밈 옮기기 (들어서 다른 칸으로 — 지금은 치우고 다시 놓기) | 큼 | 남음 | wave9 | `src/gameplay/decor/` |
| B-19 | m9-decor | 휴대폰에서 놓을 칸을 손가락으로 고르기 (지금은 앞 칸) | 큼 | 남음 | wave9 | `src/gameplay/decor/` · `core/input.js` |
| B-20 | m9-decor | 상점 가구 후보가 넷 늘어 하루 진열이 섞임 — 밸런스 정하기 | 큼 | 남음 | wave9 D92 | `assets/data/rules.json shop` |
| B-21 | p12-interiors | 상점 실내에 「오늘의 벽지·바닥」 견본 걸기 (지금은 창에서만) | 큼 | 남음 | interiors | `src/gameplay/house/places.js` · `pattern.js` |
| B-22 | z2-interior | 밤엔 실내 따뜻한 빛 때문에 하늘 체크·흰 타일이 베이지로 보임 — 실내 값 보고 고르기 | 작음 | 남음 | interiors | `src/render/presets.js INDOOR` · `sky/indoor.js` |
| B-23 | z2-interior | 휴대폰 화면에서 꾸미기 선택지·상점 코너 줄 높이 확인 | 작음 | 남음 | — | `src/ui/ui.css` · `house/` |
| B-24 | z3-furniture | 친밀도 선물 가구의 주인 주민을 FURN 표 칸으로 (지금은 얻는 법 글자 `from` 에만) | 작음 | **고침 (p43)** — items.json 친밀도 가구 6줄에 `owner` (v2), items.js 가 넘김 | — | `src/data/items.js` FURN |

### 주민·마을

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-25 | p11-tune | 첫날 할 일을 건너뛴 사람에게도 「다 해냈네요」 축하 대사 → `progress().skipped` 면 환영 선물 대사 | 작음 | **고침 (p39)** — bamtol.json `firstday.welcome` (v3) · `celebrateFlow` | wave7 D44 | `src/gameplay/town/keepers.js celebrateFlow` · `assets/villagers/bamtol.json` |
| B-26 | z4-town | 대화창 `SPEAKERS` 에 단풍·구름·파도·달무리 (지금은 color 를 넘겨서 화면은 맞음) | 작음 | **고침 (p39)** | — | `src/ui/dom.js` |

### UI·접근성·휴대폰

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-27 | p33-clock | HUD 날씨 아이콘이 밤에도 ☀️ — 밤엔 🌙 로 할지 | 작음 | 남음 | 다음 보드 QA 칸 후보 | `src/ui/hud.js setWeather` · `dom.js WEATHER_ICON` |
| B-28 | m6-p6-style | 섬폰 「화면 모습」 단추가 `cozy`·`toon` 을 글자로 박아 둠 → `style.labels` 로 그리기 | 작음 | 남음 — `presets.json labels` 에 「동숲풍」이 있어 게임 화면엔 그대로 못 씀 → 게임용 짧은 이름 칸부터 | — | `src/ui/phone.js` (213줄 근처) |
| B-29 | ui | `index.html` `.core-check` 안내가 좁은 화면에서 HUD 시계와 겹침 (world 없을 때만 보이는 개발용) | 작음 | **고침 (p43)** — 720px 아래에선 화면 아래로 | — | `index.html` |

### 렌더·성능·하늘

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-30 | p12-camera | 올려다볼수록 틸트 흐림(`tiltTop`·`tiltBottom`)을 0 쪽으로 — 높음에서 하늘·마을이 뿌옇게 됨 | 작음 | 남음 | — | `src/render/post.js apply` · `player/camera.js look.tilt` |
| B-31 | p12-camera | 하늘 보드에 「올려다보기」 장면 칸 — 구름층·천정 그라데이션·3D 솜구름을 올려다본 화면으로도 고르기 | 큼 | 남음 | sky 보드 | `src/sky/` · `clouds.js` · `concept/sky-board.html` |
| B-32 | p12-camera | 곡면 축을 `uCurveDir` 로 → 둘레 돌기 한 바퀴 | 큼 | 남음 | — | `core/materials.js` · `mouse.js` · `world/kit.js` · `occlusion.js` · `render/cull.js` |
| B-33 | perf · render · shader | 실제 휴대폰·다른 GPU·진짜 rAF 로 오래 걸으며 fps 재기 (내장 그래픽에서만 잼) | 큼 | 최적화 세션 | — | `src/render/quality.js` |
| B-34 | p11-check | RC-06·07·08: 사용자가 휴대폰·다른 GPU 로 `#check` 열어 「결과 저장」 | 작음 | 최적화 세션 | wave7 RC | 게임 링크 `#check` |
| B-35 | perf | 해안 비탈(바다 칸) 걸어 들어가기 — 물보다 0.7칸 앞에서 멈춤. 충돌·`heightAt`·길찾기를 칸보다 잘게 | 큼 | 남음 | — | `src/world/collision.js` · `index.js` |
| B-36 | render | 겨울·봄 둑 윗면·풀/모래 경계 색을 화면으로 확인 (가을만 봄) | 작음 | 남음 | — | `src/world/banks.js` |
| B-37 | render | 강어귀(강이 바다와 만나는 곳) 해안 앞치마·둑 판을 가까이서 보기 | 작음 | 남음 | — | `src/world/banks.js` · 해안 |
| B-38 | render | 주민 사라지기 반투명 중 몸 안쪽 면이 비침 → 디더(`setFade`)로 바꾸기 (actor `setOpacity` 약속이 바뀜) | 큼 | 남음 | — | `src/gameplay/town/actor.js` · `core/materials.js` |
| B-39 | p11-check | 점검의 오류 세기를 `check.js watchErrors()` 대신 `src/core/errors.js` (ctx.errors) 에서 읽기 | 작음 | **고침 (p43)** — `watchErrors(ctx.errors)` 가 오류 기록장 `on` 을 듣고, 없을 때만 예전 방식 | wave7 | `src/render/check.js` |

### 소리

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-40 | m6-p4-sound · z4-town | 단풍 목소리 따로 (지금 코코 목소리를 빌림, 구름도 모찌 목소리) — 목소리 값 고르기 | 작음 | 남음 | — | `assets/sound/voices.json` · `assets/villagers/danpung.json` |

### 편집기·홈·게시

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-41 | hub-manage | 홈 「장면」 줄 `hash` 가 null → 스토리 편집기 `#scenes/<id>` 로 그 장면 열기 (편집기는 `#탭/slug` 를 받지만 장면 고르기는 안 함) | 작음 | 반쯤 | — | `tools/hub-catalog.mjs` scene · `story-editor.html fromHash` |
| B-42 | hub-manage | 스타일 편집기 `#cozy`·`#toon` 으로 그 프리셋 열기 + 홈 목록 `style` 칸 hash | 작음 | 남음 | — | `style-editor.html` · `tools/hub-catalog.mjs` |
| B-43 | hub-manage · m6-p1-hub | 모든 편집기 머리에 편집기 홈 링크 하나 (지금은 홈에만) | 작음 | **고침 (p43)** — 리소스·스토리·소리·요소·스타일 편집기 제목 옆 「🏠 편집기 홈」 | — | `res-` · `story-` · `sound-` · `elem-` · `style-editor.html` |
| B-44 | m6-p3-traits | `rules.json about` 글이 옛 이름 — 「표 편집기(data-editor.html)」·「town 칸은 연결 제안」 → 요소 편집기 · 연결됨 | 작음 | **고침 (p39)** | — | `assets/data/rules.json` |
| B-45 | m6-p3-traits | 테스트 이름 「주민(town) 칸은 아직 town/rules.js 가 읽지 않는다 (연결 전)」 → 연결된 지금에 맞게 | 작음 | **고침 (p39)** | — | `tests/mapdata.test.mjs` 205줄 |
| B-46 | p36-elem-editor | claude.ai 게시본에서 직접 끌기·저장 (`window.claude` db) — 사용자가 열어 볼 때 | 작음 | 남음 (사용자 몫) | — | `elem-editor.html` |
| B-47 | p36-elem-editor | 방 배치 3D 보기·새 방 더하기(`kind:'add'`) — 새 방은 리소스 편집기 요청으로 | 큼 | 남음 | — | `elem-editor/room-tab.js` |
| B-48 | p36-elem-editor | 진열 `stock`·박물관 `cases`·말 거는 자리 `talk` 는 보기만 — 고치기 | 큼 | 남음 | — | `elem-editor/room-tab.js` |

### QA·자동 플레이

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-49 | board7 QA-10 | 자동 플레이 벽지 단계 (첫날 도토리로 벽지) | 작음 | 이번 p39 에서 | wave7 QA-10 · D52 | `tests/playthrough/scenario.js` |
| B-50 | p11-check | `--target=artifact` 때 봇 `boot` 단계가 로딩 시작 단추 `#ld-sound`(또는 `#ld-mute`)를 누르기 | 작음 | **고침 (p43)** — boot 단계가 로딩 화면이 있으면 「소리 없이 시작」을 누르고 닫힐 때까지 기다림 | — | `tests/playthrough/scenario.js` boot · `bot.js` |

### 문서

| # | 노트 | 남은 일 (한 줄) | 크기 | 상태 | 닿는 보드·결정 | 어디 |
|---|---|---|---|---|---|---|
| B-51 | content | CONTRACTS 에 4차 내용: `fossil.unknown`·곤충 place `under`·`shake`·`museum:appraised`·`daily.rockBugs`·`harvest.appraise` | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-52 | firstday | CONTRACTS 에 '3차 X3 첫날 흐름' 절: `intro` 서비스·`intro:named/step/done/reward`·`town:firstday` 95·`flags.firstday` | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-53 | mobile | CONTRACTS 에 X1: `input.enabled` getter·`input:touch`·`?touch=`·`ui.tools.open`·`--safe-*`·터치 조작 자리 | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-54 | ux | CONTRACTS 에 Y1: `interactions.peek`·`label`·`pure:false`·`input.setLabels`·`intro.rename`·`save.reset` 이 모듈 칸도 지움 | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-55 | z2-interior · z4-town | CONTRACTS '5차 Z2' 절 (실내 상태·행동 키·이벤트) · Z4 town 상태 표·이벤트·서비스 — 일부만 실내·10차 절에 있음 | 작음 | 반쯤 | — | `docs/CONTRACTS.md` |
| B-56 | m6-p0-pack | CONTRACTS `assets` 줄: `url`·`urlNow`·`packed`·`packStatus()`, 「게시본에선 `fetch('assets/…')` 대신 `loadJSON`·`url`」 | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-57 | m6-p3-traits | CONTRACTS town 절: 주민 데이터 = `assets/villagers/<slug>.json`, 이모티콘 규칙 = 그 파일 `emote`, 생일 = rules.json · z5-festival 노트의 「talk.json (주민 규칙)」 줄 | 작음 | **반쯤 (p43)** — CONTRACTS 주민 데이터 소절은 넣음, `z5-festival.md` 「talk.json」 줄은 남음 | — | `docs/CONTRACTS.md` · `docs/notes/z5-festival.md` |
| B-58 | m6-p4-sound | CONTRACTS 「리소스 교체 약속」에 소리 절 (곡 파일·`index.json`·`files.js`·`tests/sound.test.mjs`) + `bgm` 자리 이름·`init` 이 다 읽고 끝남 | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-59 | m6-p5-mapdata | CONTRACTS data 절 「숫자 표 = items.json·rules.json (tables.js)」, world 절 `generateIsland(seed,{layout})`·`layout.json`·`layout.festival` | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-60 | m6-p6-style | CONTRACTS 「2차 W4」 첫 줄 `demos/style.html` → `style-editor.html` (값은 `assets/style/presets.json`) | 작음 | **고침 (p39)** | — | `docs/CONTRACTS.md` 340줄 |
| B-61 | p11-access | CONTRACTS 「7차」: `settings` 칸 `textSize`·`shapes`·`calm`·`emoteText`·`soundText`, `<html>` 표시(`--pk-fs`·`pk-calm`…), `ui.setSetting`·`transfer`·`report` | 작음 | 반쯤 (`ui.access` 만) | wave7 | `docs/CONTRACTS.md` |
| B-62 | p12-camera | CONTRACTS: `input.look`·`input.viewYaw`·`camera.look`·`camera.setLook(tilt, yaw)` | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-63 | perf · render | CONTRACTS: `occlusion.watch/add`·`prepareFrame`·`coastDistance`·`riverDistance`·`quality:changed`·뼈대 메시 `frustumCulled`·`applyToonStyle merge`·`aFade`·`shadowDepthMaterial` | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-64 | story | H7 CONTRACTS 에 스토리 재생기 서비스·이벤트·`state.story` | 작음 | **고침 (p43)** — CONTRACTS 에 넣음 | — | `docs/CONTRACTS.md` |
| B-65 | z4-town | `src/core/assets.js` 주석 「캐릭터 9종」 → 지금 수 (주민 파일 13개) | 작음 | **고침 (p39)** — 목록 파일을 가리키게 | — | `src/core/assets.js` 17줄 |

### 이미 된 것

| # | 노트 | 한 일 | 어디서 됨 |
|---|---|---|---|
| B-66 | audio | `settings:changed`·`bgm('auto'/null)` 계약에 넣기 — CONTRACTS 1차 audio 추가 | `docs/CONTRACTS.md` |
| B-67 | audio | 개발용 추가 멤버(`stopVoice`·`stats()` …) — 알아 둘 것, 할 일 없음 | `src/audio/` |
| B-68 | data | `data:newday`·`collect`·`seed`·`spawns.rock hits`·`bees` 계약 — CONTRACTS 「data 추가」 | `docs/CONTRACTS.md` 166–176줄 |
| B-69 | house | W2 주민 사진 `variant` — town 이 `{ id, variant: slug }` 로 줌 | `src/gameplay/town/` |
| B-70 | house | 가방 칸 변형 색 이름 — X1 이 `variants.js` 로 | `src/ui/variants.js` |
| B-71 | hub-manage | 섬 지도 편집기 hash — 요소 편집기 `#map` (지도 편집기는 보관) | `tools/hub-catalog.mjs` map |
| B-72 | hub-manage | 조정 세션 합치기·wave7 검사 | main |
| B-73 | m6-p0-pack | P4·P5·P6 boot 갈래·첫 묶음 게시 순서 | 게임 v28·v29 게시 (devlog) |
| B-74 | m6-p1-hub | 캐릭터 편집기 반영 기록 칸 (`ApplyLog`) — 배경 편집기는 「예전」으로 보관돼 할 일 없음 | `editor.html` · `editors.html` |
| B-75 | m6-p1-hub | 6차 편집기 홈 `url`·`reads`, devlog 「게시물」 줄 | `editors.html` · devlog |
| B-76 | m6-p3-traits | 표 편집기 「주민」 탭 `waiting: true` 경고 — data-editor 가 요소 편집기로 바뀌며 없어짐 | `elem-editor/` |
| B-77 | m6-p3-traits | concept/README 맡은 파일 표에 `assets/villagers/` | `concept/README.md` 99줄 |
| B-78 | m6-p4-sound | 편집기 홈 곡 편집기 카드·devlog 줄 | `editors.html` · devlog |
| B-79 | m6-p5-mapdata | town 규칙이 `rules.json town` 칸을 읽음 | `src/gameplay/town/rules.js` |
| B-80 | m6-p6-style | P0 먼저 합치기 (파일 수 511) | main |
| B-81 | m8-events | 편집기 홈 「미리 해 보기」 링크 (D85-A) | `editors.html` `#date=` |
| B-82 | m8-events | 게시본에서 보기 | 게임 v28·v29 |
| B-83 | mobile | `interactions.peek` — Y1 이 만듦 | `src/gameplay/index.js` |
| B-84 | p11-check | 게임 capabilities `db`·`user`, `#check` 링크 | `editors.html` 「기기 점검」 |
| B-85 | p11-check | 스타일 편집기 게시 때 `check.js` 같이 — `editor-files.json` 에 있음 (알아 둘 것) | `assets/style/editor-files.json` |
| B-86 | p11-tune | 두부 큰 물고기 = 연어(하구) 힌트 — FP-05 준비물이 「큰 물고기 아무거나」로 바뀜 | `assets/festival/config.json` |
| B-87 | p11-tune | QA-05·09·17·18 — 7차 보드 D50·D51·D56·D57 | `festival/parts.js` · `keepers.js` · `fest.js` · `town/rules.js` |
| B-88 | p12-interiors | 편집기 홈에 실내 보드 | `editors.html` interiors |
| B-89 | p12-interiors | 방 배치 탭이 상점·박물관(places) 도 앎 | `elem-editor/room-tab.js` |
| B-90 | p12-interiors | 붙박이 FU-35–42 편집기 목록 | `tools/build-editor-index.mjs` fixtures |
| B-91 | p12-interiors | 실내 올려다보기 — 방 안(bounds)에선 시점 조작 막음 | `src/player/camera.js canLook` |
| B-92 | p12-interiors | `player.walkTo` 합치기 | main |
| B-93 | p33-clock | 봇 `bot.setHour` 는 조용한 지름길 — 알아 둘 것 | `tests/playthrough/` |
| B-94 | p35-tour | 섬 자리 x 900·`world.home.island`·TO-04 평평한 섬·TO-03 다리 — 알아 둘 것 | `assets/tour/tour.json` |
| B-95 | p35-tour | main 합치기·편집기·게임 게시 | `827283d` · 배경 편집기 v23 · 게임 v29 |
| B-96 | p36-elem-editor | 타로 효과 글은 「요소 반영」 때 Claude 가 맞춤 — 알아 둘 것 | `elem-editor/` |
| B-97 | perf | 재는 법 (rAF 멈춤·처리량으로 재기) — 알아 둘 것 | `docs/notes/perf.md` |
| B-98 | perf | 가림 투명이 주민·가구에도 — render 트랙 `occlusion.add` | `src/world/occlusion.js` |
| B-99 | perf · shader | 그림자에 바람 — `shadowDepthMaterial` | `src/core/materials.js` |
| B-100 | perf | 강 둑 계단 모양 — 둑 판·`riverDistance` | `src/world/banks.js` |
| B-101 | render · shader | 점광 그림자 없음·비 오는 밤 cozy 빗줄기 또렷함 — 일부러 둠 | — |
| B-102 | shader | 주민 실제 배회 모습 다시 보기 — town 합친 뒤 봄 | main |
| B-103 | sky | `now()` `hourF`·시작 알림·재질 이름·`setWeather` 5시 풀림 — CONTRACTS time 추가 | `docs/CONTRACTS.md` 164·197줄 |
| B-104 | sky | 실내 하늘 끄기 `setIndoor` | `src/sky/index.js` |
| B-105 | story | H5 이사 장면 — s17–s19 도착 장면 | `assets/story/scenes/s17–s19` |
| B-106 | story | H4 `festival:part`·`festival:start` 연결 · s05–s10 실제로 틀기 | `festival/fest.js` · 자동 플레이 |
| B-107 | story | 장면 동안 I·P·M 단축키 막기 | `src/ui/index.js` 176줄 |
| B-108 | t1-world | `facing`·`toolKeys`·`island.variants` 계약, `data:newday` 로 오늘 자리, 그림자 품질 단계 | CONTRACTS · `world/daily.js` · `render/quality.js` |
| B-109 | town | 상점·박물관 `ui.fade` — 실내 장면이 생김 | `src/gameplay/house/places.js` |
| B-110 | town | 아이템 `desc` 한 줄 60자 안쪽 — 알아 둘 것 | `assets/data/items.json` |
| B-111 | ui | `ui.confirm`·`keyHint`·`settings:changed` 계약, 외곽선 설정을 듣기 | CONTRACTS · `src/world/kit.js` 313줄 |
| B-112 | ui | 없는 모듈 import 404 — 합친 뒤 사라짐 | `src/main.js` |
| B-113 | z2-interior | Z3·Z4 와 함께 돌려 보기·게시 | main · 게임 게시 |
| B-114 | z3-furniture | 벽 가구 자리·소품 slug·가구 개수 테스트 | `src/gameplay/house/` · `tests/items.test.mjs` |
| B-115 | z4-town | 주민 집 문 `atHome` 규칙·이사 전 문 없음·`house:enter {owner}` | `src/gameplay/house/interior.js` · `visit.js` |
| B-116 | z4-town | 캐릭터 편집기 다시 게시 (단풍) | 캐릭터 편집기 v14 |
