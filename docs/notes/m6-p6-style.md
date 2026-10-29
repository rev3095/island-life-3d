스타일 편집기: https://claude.ai/artifact/EWuGKbMpo9uTjLEUzhT2Pd · 파일 `style-editor.html` (+ `assets/style/editor-files.json` 의 31개)

# M6-P6 스타일 편집기 (ET-10) — 작업 노트 (`p9-style` 브랜치)

검수 보드 wave6 D34-A: 로컬에서만 열리던 스타일 편집기(`demos/style.html`)를 **링크로 게시**하고, 값 복사 대신 **저장소에 남기고**, 채팅 **"스타일 반영"** 으로 게임에 넣는다. 셰이더(`src/core/materials.js`)·그리기(`src/render/index.js`)는 그대로, 값만 데이터로 뺐다.

## 바꾼 파일
| 파일 | 내용 |
|---|---|
| `assets/style/presets.json` (새) | 프리셋 값: `{ version, default, labels, presets: {cozy, toon}, indoor: {cozy} }`. `version` = 게임에 들어간 반영 버전 (지금 0) |
| `src/render/presets.js` | `PARAMS` 표는 그대로. 값은 `presets.json` 을 **게임 로더 `loadJSON`** 으로 읽는다 (최상위 await — 웹 빌드 묶음·다시 받기를 같이 탄다). 내보내는 이름 그대로(`PRESETS` `INDOOR` `DEFAULT_PRESET` `PRESET_LABELS`) + 새 `STYLE_FILE` · `STYLE_VERSION` · `checkValue` · `checkStyle`(모양 검사) · `replaceIndoor`(편집기 전용). Node(테스트)에서는 파일을 읽지 않고 비워 둔다 |
| `style-editor.html` (새) | 스타일 편집기 아티팩트. 아래 "편집기" |
| `demos/style.html` | 옛 주소 → `style-editor.html?island` 로 넘겨 주기만 |
| `assets/style/editor-files.json` (새) | 편집기 게시 파일 목록 (모듈 21 · presets.json · 모델 5 · 스펙 4) |
| `tests/style.test.mjs` (새) | presets.json ↔ PARAMS (값·범위·집 안), 검사가 틀린 값을 잡는지, 웹 빌드에 presets.json, 게시 목록이 편집기 모듈 그래프·무대 모델을 다 담는지 |
| `docs/SHADERS.md` · `CLAUDE.md` 새 절 | 편집기·"스타일 반영" 흐름 |

## 편집기
- **무대**: 기본은 대표 모델 5개로 꾸민 작은 섬 — 플레이어·퐁(림·부리 하이라이트), 집(창문 밤 불빛), 나무 ×3(바람), 모닥불(스스로 빛나기·빛 번짐). 바다·모래·풀 판은 페이지가 만든다 (`sea`·`sand`·`ground` 재질 — 물결·붓질·비에 젖기). 조명·하늘·구름·비·눈·밤 불빛은 **진짜 sky 모듈**(`src/sky/`)을 그대로 돌린다 (`ctx.assets.loadEnvIndex` 만 무대 모델로 줄임). 그리기는 게임과 같은 `createView`.
- **집 안**: 바닥·벽 두 면·깔개 방으로 바꾸고 `time.setIndoor(true)` → 실내 조명 + `scene:indoor` → 스타일의 집 안 덧씌우기. 이때 슬라이더는 **덧씌우기 값**을 고친다 (`집` 표시, 누르면 덧씌우기에서 뺀다).
- **진짜 섬** (로컬 dev-server 만): `style-editor.html?island` → `src/main.js` 를 통째로 띄우고 같은 조절판. 게시본에는 섬 파일이 없어 링크를 숨긴다.
- **비교**: 나눠 보기 왼쪽 = 게임 값(같은 프리셋 / 포근 / 툰) · 반영 v<n> · 저장본. 오른쪽 = 고치는 값.
- 시간(새벽·낮·노을·밤) · 날씨(맑음·흐림·비·눈) · 계절(풀·나무 색) · 카메라(끌어서 돌리기·가까이/기본/멀리). 카메라 중심은 조절판이 안 가린 곳 가운데 (`setViewOffset`).
- 값마다 바꾼 표시 • 와 ↺(게임 값으로). "이 프리셋을 게임 값으로", "값 복사"(저장소가 없을 때).

### 저장소 (아티팩트 db · 로컬은 dev-server `/api/db/style-*` → `assets/review/style-*.json`)
| 경로 | 쓰는 쪽 | 모양 |
|---|---|---|
| `drafts/style` | 편집기 (0.7초 모아 쓰기) | `{ style: presets.json 모양, notes: {프리셋: 글}, status: 'editing'|'requested', rollback: n|null, base, updatedAt, updatedBy }` |
| `saves/<id>` | 편집기 | 저장본 `{ name, preset, params, indoor, createdAt, by }` |
| `applied/style` | Claude (규칙: 쓰기 admin) | `{ board: 'style', version, style, notes, appliedAt, summary, commit }` — 검수 보드 반영 기록과 같은 모양 |
| `history/style-v<n>` | Claude (쓰기 admin) | `applied` 와 같은 모양. 편집기의 "이 버전으로 되돌리기" 가 `style` 을 `drafts` 로 옮기고 `rollback: n` + `status: 'requested'` |

capabilities: `{ db: { rules: [ {path:'applied', read:'view', write:'admin'}, {path:'history', read:'view', write:'admin'} ] }, user: {} }`.

## "스타일 반영" (Claude 가 하는 일)
1. ArtifactData `get drafts/style`, `get applied/style`, `list history` (로컬에서 고쳤다면 `assets/review/style-drafts.json`).
2. `drafts/style.style` 을 `assets/style/presets.json` 과 비교 (프리셋 값 · 집 안 덧씌우기 · `default`), `notes` 를 `applied.notes` 와 비교. 바뀐 게 없으면 그렇게 알리고 끝.
   - **값**: `presets.json` 에 그대로 쓴다 (`version` = applied 버전 + 1, 키 순서는 PARAMS). `checkStyle` 로 검사 — 범위 밖이면 잘라 넣고 알린다.
   - **되돌리기** (`rollback: n`): `history/style-v<n>.commit` 의 `assets/style/presets.json` 과 같은지 보고(`git show <commit>:assets/style/presets.json`) 그 값으로, `version` 은 새로 +1. 무엇을 되돌리는지 먼저 보여 준다.
   - **의견**: 그 프리셋 값을 의견대로 고친다. 새 효과(새 uniform·패스)가 필요하면 `docs/SHADERS.md` "새 재질 효과 더하기" — 셰이더 파일은 render 트랙 몫이라 따로 세션·승인.
3. `node --test tests/` (`style.test.mjs`).
4. 화면 확인: dev-server → `/index.html?style=<프리셋>` (낮·밤, `__island.services.time.setPaused(true); setHour(12)`), `/style-editor.html` 나눠 보기(왼쪽 반영 v<n>). 스크린샷은 공유 노트 폴더.
5. 커밋 (해시를 적어 둔다).
6. 편집기를 같은 아티팩트에 다시 게시: `file_path: style-editor.html`, `files: {"assets/style/presets.json": "assets/style/presets.json"}` (+ 바뀐 모듈·모델이 있으면 `editor-files.json` 에서). capabilities 는 생략(그대로).
7. `applied/style` 을 새 버전으로(`style` = 새 presets.json, `notes`, `appliedAt`, `summary`, `commit` = 5의 해시), 같은 내용으로 `history/style-v<n>`. `drafts/style` 은 `status: 'editing'`, `rollback: null` (`update`, `if_version`).
8. 게임 링크 다시 게시 (D35-A) — 6차 트랙 브랜치에선 조정 세션이 합친 뒤.

## 반영 기록
| 버전 | 날짜 | 내용 | 커밋 |
|---|---|---|---|
| v0 | 2026-10-29 | 처음 값 — `presets.js` 에 있던 cozy · toon · 집 안(cozy) 값을 그대로 `presets.json` 으로 | (이 노트를 넣은 커밋) |

## 확인한 것
- `node --test tests/` 201/201 (새 `style.test.mjs` 4개).
- 게임 화면이 전과 같음: 바뀌기 전 사본(`git archive HEAD`, 포트 4227)과 바뀐 뒤(4226)에서 cozy·toon·집 안 cozy 의 `style.get()` 값 · 재질 uniform(`materials.look`) · 화면 효과 패스 목록을 JSON 으로 떠서 SHA-256 앞 16자 비교 → 둘 다 `551e7483fbb8158c`. 낮 12시 맑음 스크린샷도 같음 (주민 위치만 다름). 콘솔 오류 0.
- 편집기 로컬(4226): 작은 섬 낮·밤(창문·모닥불 빛 번짐), 슬라이더 → 0.7초 뒤 `assets/review/style-drafts.json` 에 저장, 다시 열면 되살아남, 집 안 덧씌우기만 따로 저장(바깥 `ao` 그대로), 툰 프리셋 바꾸기(2단·잉크), 저장본 남기기 → 왼쪽에 놓고 비교, `demos/style.html` → `?island` 진짜 섬. 콘솔 오류 0. 시험 데이터는 지웠다.
- 게시 뒤 저장소 읽기: `drafts`·`applied` 비어 있음(처음) → v0 기록을 넣었다.
- 스크린샷: 공유 노트 폴더 `m6-p6-style-shots/`.

## 못 한 것
- claude.ai 안에서 편집기를 직접 열어 슬라이더·저장(아티팩트 db) 해 보기 — 이 세션에선 게시와 저장소 읽기·쓰기(ArtifactData)까지만. 처음 열 때 `user`·`db` 동의 창이 뜰 수 있다.
- 휴대폰 실제 기기 (720px 아래는 아래쪽 판으로 바뀌게만 해 둠).
- 새 프리셋 만들기 (아래 제안 3).

## 다른 트랙에 제안
1. **P0 (`p9-pack`) — 웹 빌드 파일 수**: `presets.json` 하나가 더해져 게임 웹 빌드가 **511파일(버전 한계 511 딱)** 이 된다 (`node tools/build-web.mjs --check` 통과). 묶음 파일이 들어오기 전에 합치면 다른 트랙이 새 파일을 더할 여유가 없다 → P0 를 먼저 합치거나 같이. `presets.js` 는 `loadJSON('assets/style/presets.json')` 를 쓰므로 P0 의 묶음 로더가 `loadJSON` 을 덮으면 저절로 묶음에서 읽힌다 (최상위 await 라 묶음 목록이 그보다 먼저 준비돼 있어야 한다 — `render/index.js` 는 `main.js` 가 정적으로 불러온다).
2. **P1 (`p9-hub`) — 편집기 홈**: 스타일 편집기 링크 위 첫 줄, 채팅 명령 "스타일 반영", 반영 기록 `applied/style`·`history/style-v<n>` (검수 보드와 같은 모양, 값은 `style` 칸), 새 요청 표시는 `drafts/style.status === 'requested'`.
3. **ui (`src/ui/phone.js`)**: 섬폰 "화면 모습" 버튼이 `cozy`·`toon` 을 글자로 박아 두었다. `ctx.services.style.labels` 로 그리면 편집기에서 새 프리셋을 만들어도 섬폰에 저절로 나온다 (그 뒤 편집기에 "새 프리셋" 단추를 넣을 수 있다).
4. **CONTRACTS.md** "2차 W4 스타일 셰이더" 첫 줄의 `demos/style.html` → `style-editor.html` (값은 `assets/style/presets.json`). 조정 세션이 합칠 때.
