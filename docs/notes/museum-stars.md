# museum-stars — 요청 8 별자리 · 요청 9 박물관 재단장·증축 (브랜치 `p57-museum-stars`)

결정 번호 D175–D179 (이 트랙 몫). 보드 없이 요청대로 만든 「반영 v1 (임시)」 — 아래 D 표가 추천안이고, 다르게 고르면 「바꿀 곳」만 고치면 된다.

## 한 것

| 무엇 | 내용 |
|---|---|
| 별자리 12개 (IC-ST-01–12) | `src/sky/starmap.js` (순수, node 테스트): 섬 오리지널 별자리 — 봄 도토리자리·벚꽃잎자리·새싹자리 / 여름 밀짚모자자리·수박조각자리·반딧불자리 / 가을 단풍잎자리·버섯자리·낚싯대자리 / 겨울 눈사람자리·털장갑자리·등대자리. 별 = 가운데 (az, alt) + 하늘 평면 dx·dy 도 + 밝기, 선 = 별 번호 짝, 이야기 한 줄. 계절의 셋만, 밤 19–5시만 뜬다 |
| 3D 밤하늘 별자리 별 | `src/sky/stars.js` (새): 그 계절 별자리 별 20개 안팎을 **dome.js 별 재질 그대로** Points 하나로, dome 별(sky-stars)의 자식으로 단다 → 새 셰이더·재질 없음, 별이 보일 때만·구름에 가려짐·반짝임 모두 dome 과 같다. 고리: `dome.js` 반환에 `starPoints` 한 줄, `sky/index.js` import 한 줄 + `createStarSky(dome)` 한 줄 + `syncSeason` 끝에 `starSky?.setSeason(season)` |
| 공용 망원경대 PR-40 | 새 배경 `assets/env/specs/telescope-stand.json` (Blender `b_telescope_stand`, 삼각형 1,442, 충돌 r 0.36). 박물관 문에서 (오른쪽 4.5, 앞 1.5) 근처 빈 풀밭 1칸에 `world.objects.add(…, { persist: false })` — 자리는 `state.stars.spot` 에 두어 늘 같다. 섬 터·섬 생성은 그대로 |
| 망원경 보기 UI-32 | `src/gameplay/stars/view.js`: `ui.panel('scope', …)` 창 하나에 **2D 캔버스**(`starmap.drawSky`) — 셰이더 없음, 볼 때만 그린다(게임 update 가 부름 → 봇 `ctx.step` 에서도 같다). 낮음·매우 낮음은 화소 배율 1·90만 화소 상한. 조준: 마우스·한 손가락 끌기 · 방향키/WASD · 게임패드 왼쪽 막대. 줌: 휠 · 화면 + / − · 두 손가락 벌리기 · Q/E·-/= · 게임패드 RT/LT. 렌즈 가장자리에 아직 못 찍은 별자리 쪽 화살표, 가운데 링이 차오름. 비·눈·흐림이면 구름이 가리고 못 찍음. 닫기 Esc·B·「그만 보기」, 해가 뜨면 저절로 닫힘 |
| 찍기 → UI-33 | 아직 못 찍은 별자리를 가운데(시야의 16% 안)에 알맞은 크기(반지름이 시야의 14–50%)로 1.6초 → 「📸 찰칵!」 카드(그 장면 그림 · 이름 · 계절 · 이야기 · 도감 n/12). Space·Enter·A = 맞을 때 바로 찍기. 저장 `state.stars.found[id] = { day, az, alt, fov }` — **그림 대신 시야 값만** 두고 그릴 때마다 다시 그린다(저장 크기 거의 0) |
| 별자리 도감 | 섬폰 「도감」 끝에 「⭐ 별자리」 탭 (`ui/phone.js` 탭 줄 한 줄 + `draw()` 앞 갈래 하나 → `stars.dexPanel`): 12칸, 찍은 것은 작은 그림, 못 찍은 것은 `??? (계절)` |
| FU-53 별 망원경 | `decor/telescope.js`: 별자리 모듈이 있으면 올려다보기 대신 같은 망원경 보기(`stars.open({ where: '별 망원경' })`)를 연다 (섬에 놓은 것). 실내(집 안 가구)는 그대로 house 「살피기」 |
| 박물관 증축 BD-16 | `assets/env/specs/museum.json` id BD-16 v0.2 (예전 BD-04): 앞 신전(문·기둥·박공·계단)은 그대로 두고 **같은 6×6 터 안에서 뒤로** — 뒤채 · 가운데 천체 투영실 둥근 지붕(별 무늬 `glow` 밤에 켜짐) · 서쪽 수조관 물빛 유리 지붕 · 동쪽 곤충관 온실 지붕 · 양옆 둥근 창 · 앞벽 깃발 둘. 높이 2.7 → 4.9, 삼각형 10,054. 섬 터(lot)는 그대로라 섬 생성·저장이 안 바뀐다 (충돌 상자만 뒤로 0.65) |
| 박물관 로비 RM-09 v3 | `assets/interior/places/museum.json` 14×9: 가운데 안내대 FU-37 뒤 느루(기증·설명은 느루와 말할 때만 — keepers.js 그대로) · 둥근 깔개 둘 · 벤치. 벽마다 관 입구 아치 `halls[]` — 서쪽 물고기관·바다 생물관, 동쪽 곤충관·미술관, 북쪽 화석관·별자리관 |
| 관 여섯 RM-25–30 | `assets/interior/halls/{fish,bug,fossil,sea,art,star}.json` (12×8, 문 매트 5–6). 물고기관 = 대형 수조 FU-86 넷 + 긴 수조 FU-41 · 곤충관 = 곤충 유리 상자 FU-42 둘 + 화분 선반 · 화석관 = 공룡 모형 + 화석 받침 FU-38 넷 + 유리 진열장 FU-85 넷 · 바다 생물관 = FU-86 넷 + FU-85 넷 · 미술관 = 그림 액자 FU-87 열(그림) + 받침 여섯(조각) · 별자리관 = 천체 투영기 FU-88 + 액자 열둘(별자리 12) + 투영기 위 별 점 구름 |
| 관 코드 | `src/gameplay/house/museum-hall-data.js` (순수: 자리 `hallPlan`·`lineSlots`·`archesOf`·`hallStatus`·`signText`·`checkHall`) + `museum-hall.js` (짓기·드나들기·전시·안내판). 관 방은 x 620 · z 40 + 30×순번. 드나들기 = `door.js through()` 그대로(place 없이 → 원형 전환): 로비 아치 앞 행동 키 「○○관 들어가기」(90) 또는 아치 쪽으로 밀기 → 관 문 매트 / 관 문 매트 행동 키 「로비로」 또는 아래로 밀기 → 로비 그 아치 앞. 아치 옆 안내판 행동 키 「○○관 안내」 → 설명 창 (기증 n/N · 「들어가 볼래요」) |
| 전시 | 기증한 것만 그 관의 제자리에 (아이템 표 순서로 늘 같은 자리). 수조·온실은 두 층 줄(line, 아이템이 늘면 촘촘해짐), 받침·진열장은 하나씩(spots), 미술 그림(`artKind: painting`)은 액자 캔버스에 아이콘 그림, 조각(`sculpture`)은 받침에 모델. 모델이 없으면 받침 위 세운 그림 판. 전시물 앞 「살펴보기」(91) → 설명판 |
| 곧 열려요 | 분류에 아이템이 없으면(`items.list('sea'|'art')` 가 빔) 그 관은 「🚧 곧 열려요」 — 들어가 볼 수는 있고 빈 수조·액자, 안내판·들어갈 때 알림. 다른 트랙이 분류를 넣고 `data/museum.js` KINDS 가 받아 주면 **코드 고침 없이** 저절로 채워진다 (`museum.has(id)` 로 본다) |
| places.js 고리 (짧게) | import 한 줄 · `createMuseumHalls(…)` 세 줄 · 실내 밖 판정에 `&& !halls?.inside` · `goOut` 에 `halls?.drop()` · `resume` 끝 두 줄(관 안에서 저장 → 그 관으로) · `update` 끝 `halls?.update(dt)` · api `halls` · `doormat` 이 관 문 매트 |
| 붙박이 FU-85–88 | `assets/furniture/fixtures/specs/` 유리 진열장 FU-85 (1×1) · 대형 수조 FU-86 (3×1, 층 0.82·1.24) · 그림 액자 FU-87 (벽, 캔버스 가운데 1.5, 그림 등 밤에 켜짐) · 천체 투영기 FU-88 (2×2). `build_furniture.py` 빌더 넷 |
| 저사양 | 3D 쪽 더한 것: 하늘 점 20개 안팎(새 셰이더 0) · 망원경대 1개 · 박물관 모델 삼각형 +7.3k. 관 안은 places 와 같은 규칙(낮음·매우 낮음 = deco·물 장식 숨김, 매우 낮음 = 전시물 가만히·투영기 별 구름 숨김). 망원경 보기는 2D 캔버스 |
| 점검 | `tools/check-interiors.mjs` — 박물관에 들어가면 **관 여섯을 실제 Space 로 하나씩** 들어가 사진·전시 수·살펴보기 글자·문 매트 Space 로 로비 (`visitHall`·`leaveHall`, 실패 = 문제). 자동 플레이 `scenario.js` 단계 `museum-halls` (evening-bugs 뒤) · `stars` (night 뒤) |
| 테스트 | `tests/museum-hall.test.mjs` 8개 (관 배치 검사·전시 자리 = 아이템 수·곧 열려요·미술 그림/조각 나누기·로비 아치·별자리 12 모양·찍기 판정·하늘 고리) · 고정 개수: `assets.test.mjs` 배경 76 → 77 · `places.test.mjs` 붙박이 +FU-85–88 · `assets/style/editor-files.json` 에 `src/sky/starmap.js`·`stars.js` |

## 결정 (반영 v1 임시 — 다르게 고르면)

| 결정 | 반영 v1 | 다르게 고르면 · 바꿀 곳 |
|---|---|---|
| D175 관 드나드는 모양 | **A** 로비 벽 아치 → 관마다 따로 방 (원형 전환) | B 한 층 넓은 홀에 칸막이(전환 없음) — 방 크기 16×12 상한·카메라 범위 때문에 관 하나가 작아짐. `museum-hall.js` 를 방 하나로 합쳐야 해서 일이 큼 |
| D176 박물관 겉모양 | **A** 같은 6×6 터에서 뒤채·둥근 지붕으로 키움 (섬 생성 그대로) | B 터를 8×7 로 키움 — `museum.json world.lot` + 섬 생성이 바뀌어 **기존 저장의 나무·물건 자리가 어긋남** (권하지 않음) |
| D177 별자리 볼 수 있는 때 | **A** 그 계절 셋 · 밤 19–5시 · 맑거나 무지개 날 | B 열둘 언제나 — `starmap.visibleNow` 를 `CONSTELLATIONS` 로 · C 날씨 상관없이 — `view.js` `CLOUDY` 를 빈 Set 으로 |
| D178 찍는 방법 | **A** 가운데에 알맞은 크기로 1.6초 두면 저절로 (Space 로 바로도) | B 단추로만 — `CAPTURE.hold` 를 크게(사실상 끔) · 판정 너그럽게 — `CAPTURE.center`·`lo`·`hi` |
| D179 미술관 그림 | **A** 액자 캔버스에 아이템 아이콘 그림 · 조각은 받침에 모델 | B 그림도 모델(받침 위 이젤) — `art.json` racks 의 frames 를 spots 로 |

## 확인

- `node --test tests/` — 488개 (480 + 새 8) 통과.
- `node tools/check-interiors.mjs --only=museum --port=4269` — 낮 10시·밤 23시·새벽 4시 모두: 박물관 ✅ + 관 여섯 ✅ 들어감 · 로비로 ✅ · 살펴보기 글자 ✅ · 콘솔 오류 0 · 문제 0. (요청은 `--port=4267` 이었지만 4267 은 실내 전수 세션 `interiors-all` 의 dev-server 가 쓰고 있어서, 같은 포트로 돌리면 그쪽 코드를 점검하게 된다 → 이 작업 트리 서버 4269)
- 개발 서버(4269, `?debug&date=2027-01-10`)에서 실제 키로: 이름 정하기 → 밤 22시 → 망원경대 앞 Space(「망원경 보기」) → 방향키 ←·↓ 로 눈사람자리 맞춤 → 찰칵 카드 → Enter·Esc → 박물관 → 로비 아치 여섯 Space 들어가기·문 매트 Space 나오기 → 별자리관에서 저장 → 새로고침 → 별자리관 안에서 이어 하기. 콘솔 오류 0.
- 자동 플레이·사양 넷 GPU: 아래 「돌린 결과」.

## 남은 것 · 제안

- **sea·art 연결**: 잠수 트랙(`sea`)·밤 특별 상점 트랙(`art`, `items.list('art')` = 진품 16, `artKind`, 가품은 list 에서 빠짐 — 그 트랙이 알려 옴)이 `data/museum.js` KINDS 를 넓히면 관은 저절로 찬다. 느루 기증 창(`ui/museum.js`)이 새 분류를 보여 주는지는 그 트랙들 몫. 가품 거절 대사도 그쪽.
- 박물관 모델 BD-16·망원경대 PR-40·FU-85–88 은 status `review` (리소스 편집기에서 확정). PR-40 번호는 이 트랙이 잡음 — 다른 트랙 PR 번호와 겹치면 조정 세션이 바꿔도 된다.
- 실내(집 안)에 놓은 FU-53 별 망원경은 아직 예전 「살피기」 — 창가에서 망원경 보기를 열게 하려면 house 쪽 한 줄.
- 망원경 보기 동안에도 3D 장면은 뒤에서 그려진다(2D 화면이 덮음). 더 아끼려면 render 쪽에 「덮였으면 건너뛰기」 고리 — render 트랙 몫.
- 관 방 자리(x 620, z 40–190)는 다른 실내와 겹치지 않게 골랐다. 실내 전수 트랙이 x 620 줄에 방을 더하면 맞출 것.

## 문서 세션이 반영할 문장

- CLAUDE.md 「게임 런타임」 실내 줄: "실내는 내 집(x 500) · 주민 방(540) · 도토리상점(580) · 박물관(620, **로비 RM-09 + 벽 아치로 들어가는 관 여섯 RM-25–30 — x 620 · z 40+30n, `house/museum-hall.js`·`museum-hall-data.js`, 배치 `assets/interior/halls/*.json`**)."
- CLAUDE.md 「하늘」: "별자리(요청 8): 12개 IC-ST-01–12 = `src/sky/starmap.js` (순수 — 계절 셋·밤 19–5시, 2D 그리기 `drawSky`), 3D 하늘의 별자리 별은 `src/sky/stars.js` 가 dome 별 재질을 나눠 쓰는 Points 하나. 박물관 앞 망원경대 PR-40 · 섬에 놓은 FU-53 → 망원경 보기 UI-32(2D 캔버스) → 찍기 UI-33 → `state.stars.found` (시야 값만) → 섬폰 도감 「⭐ 별자리」 · 박물관 별자리관 (`src/gameplay/stars/`)."
- CLAUDE.md 「행동 키」 우선순위 목록에 "망원경 보기 85 · 박물관 관 들어가기·안내판·로비로 90 · 관 전시물 살펴보기 91".
- CLAUDE.md 「명령어」 check-interiors 줄: "박물관이면 관 여섯도 실제 Space 로 들어가 본다".
- CONTRACTS: 이벤트 `stars:captured { id }` · `stars:view { on }` · `museum:hall { hall, on }`, 서비스 `ctx.services.stars` (list·has·count·found·picture·open·dexPanel·stand), `house.places.halls` (arches·halls·status·shown·shownSpots·doormat·enter·leave), 저장 `state.stars = { found, spot }` · `state.house.hall`.
- concept/README.md ID 표: IC-ST-01–12 · RM-25–30 · BD-16 (BD-04 증축) · PR-40 · FU-85–88 · UI-32 · UI-33 · D175–D179.
