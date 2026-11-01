# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 한 줄

**포근섬 이야기** — 웹 브라우저에서 바로 하는 오리지널 IP 3D 섬 생활 게임 (동물의 숲 류). 빌드 도구·npm 없이 브라우저 ES 모듈 + importmap(`three@0.170.0`, `three/addons/` from jsdelivr). 사용자는 한국어로 소통하며, 코드 주석·화면 문구·보고도 한국어로 쓴다. 닌텐도 이름·에셋·대사는 쓰지 않는다.

이전 세션의 흐름과 진행 상황은 **`devlog.md`** 에 보고서로 정리돼 있다 — 이어서 작업할 때 먼저 읽는다 (`/save-session` 이 갱신).

## 명령어

```bash
node dev-server.mjs                 # http://localhost:4180  (--port=4191 처럼 포트 지정, 작업 트리마다 다른 포트)
node --test tests/                  # 규칙 테스트 전체 (Node 22+: tests/package.json main → all.mjs 가 *.test.mjs 를 모두 불러옴)
node --test tests/save.test.mjs     # 테스트 파일 하나
node tools/build-character.mjs coco | --all [--no-render]        # 캐릭터 9종 Blender 재생성
node tools/build-env.mjs tree | --all | --category nature [--no-render]   # 배경 32종 (nature|prop|building|tile)
node tools/build-web.mjs            # 게임 웹 빌드 → dist/web/ (게시용, 커밋 안 함)
node tools/playtest.mjs [--target=artifact --build] [--mobile] [--novice] [--only=boot,naming]   # 처음부터 엔딩까지 자동 플레이 점검 (머리 없는 Chrome, 약 20분)
```

- 페이지: `/index.html` 게임 (`?debug` 모듈 로딩·시간/날씨 패널, `?quality=min|low|mid|high` 그래픽 사양 매우 낮음·낮음·적정·높음 (게시본은 링크 끝 `#low` 등, 처음은 적정 + 느리면 자동으로 한 칸씩, 섬폰 설정·로딩 화면에서 고르면 `state.settings.spec` — 값은 `src/render/quality.js` `QUALITY`), `?story=<장면 id>` 장면 재생), `/artifact/` 게시본 조건(묶음·CSP), `/editors.html` 편집기 홈, `/editor.html` 캐릭터 편집기, `/bg-editor.html` 배경 편집기, `/concept/*-board.html` 검수 보드, `/tests/playthrough/index.html` 자동 플레이 판, `/demos/*.html` 트랙별 데모.
- Blender 5.2 경로 기본값 `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` (`BLENDER` 환경변수로 변경). 빌더는 `.glb`·`.glb.json`·렌더·`stats.json`·`index.json` 을 다시 쓴다. `.blend` 는 gitignore (스크립트로 재생성).
- lint·빌드 단계는 없다. 브라우저 확인은 dev-server 로 연 주소에서 한다 (`file://` 로는 모듈·fetch 가 안 된다).

## 큰 구조

### 게임 런타임 (`index.html` → `src/main.js`)
- `main.js` 가 렌더러·장면·카메라·기본 조명(`ctx.lights = {hemi, sun, sunOffset}`)과 공용 `ctx` 를 만들고, 모듈을 **`data → sky → world → player → ui → audio → gameplay`** 순서로 동적 import 한다. 파일이 없는 모듈은 건너뛰므로 어느 브랜치에서든 열린다 (world 가 없으면 core-check 장면).
- 모듈 모양: `export default { name, async init(ctx), update(dt, ctx) }`. 기능은 `ctx.services.<이름>` 에 올리고, 모듈끼리는 **이벤트(`ctx.events`)와 서비스로만** 주고받는다. 약속은 `docs/CONTRACTS.md` 가 기준이며 뒤쪽 "1차 합친 뒤 추가된 약속"·"2차 준비" 절이 앞 내용보다 우선한다. 각 모듈의 설계 결정은 `docs/notes/<트랙>.md`.
- `src/gameplay/index.js` 는 `gather/`(P2)·`town/`(P3)·`house/`(P4) 하위 모듈을 불러오고, **Space/F 행동 키를 우선순위 디스패처**(`ctx.services.gameplay.interactions.add({name, intent, priority, test, run})`)로 나눠 준다. 말 걸기 100 · 문 90 · 가구 80 · 나무 흔들기 60 · 줍기 50 · 도구 10. `input:press` 를 직접 처리하지 말 것 (UI 창이 열려 있으면 `ui.isBlocking()` 으로 막힘).
- 섬 밖 공간(집 실내 등)은 `world.addZone({contains, collide, heightAt, groundAt, isWalkable})` 로 바닥·벽을 바꿔 끼운다. 플레이어 이동은 `world.collide` / `island.heightAt` 만 쓴다.
- 저장되는 상태는 `ctx.state` (`src/core/state.js`), 칸마다 주인 모듈이 정해져 있다. 저장·하루 리셋(05:00 경계)은 data 모듈.

### 렌더링 규칙 (`src/core/materials.js`)
- 모든 3D 모델은 `applyToonStyle(root, {spec})` / `toonMaterial` / `outlineMaterial` 을 거친다. 여기 들어 있는 **곡면 월드 패치**(`project_vertex` 대체, 중심 = `ctx.focus`, 세기 `curve.uCurve`)와 외곽선(뒤집은 껍데기, `userData.outline = true`)이 모든 메시·인스턴스·스킨 메시에 맞게 걸려야 한다. 그림자는 휘기 전 좌표로 조회해 어긋나지 않지만, 깊이·법선을 다시 그리는 후처리(SSAO 등)의 override 재질에는 곡면 패치가 없다.
- **재질 이름 = 스펙 팔레트 키**이고 의미가 있다: `glow`·`window` 밤에 켜짐, `ground grass sand …` 비에 젖음, 일부 이름은 외곽선 제외·평면(flat) 처리. world 는 합친 땅 재질 이름을 `ground` 로 둔다.

### 에셋 파이프라인 (`assets/`, `tools/`)
- 스펙 JSON → Blender 헤드리스 빌더 → 모델·렌더. 캐릭터: `assets/specs/*.json` + `assets/blender/build_character.py` (종족별 `FEATURES` 표). 배경: `assets/env/specs/*.json` + `assets/blender/build_env.py` (`kind` → `BUILDERS` 함수) + 공용 `toonkit.py`. 좌표는 Blender Z-up·정면 -Y, **타일 1칸 = 1.0**, 캐릭터 키 ≈ 1.0.
- 웹 링크(claude.ai 아티팩트)는 `.glb` 를 올릴 수 없고 CSP 가 `data:` fetch 를 막는다 → 모델은 항상 base64 래핑한 `<slug>.glb.json` 으로 두고 `src/core/assets.js` 의 `loadModel` 이 풀어 `GLTFLoader.parse` 한다. `dev-server.mjs` 가 같은 CSP 를 걸어서 로컬에서 되면 웹에서도 된다.

### 편집기와 "요청 확인" 흐름
- **편집기 홈** `editors.html` (https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv, capabilities `db`·`user`): 모든 편집기·보드·게임 링크(스크립트 없이도 보이는 바로 가기)와 편집기마다 채팅 명령·마지막 반영 버전·처리할 것 수, 그리고 **「전체 관리」 표** — 모든 리소스(캐릭터·주민·배경·가구·아이템·무늬·방·장면·소리·지도 자리·숫자 표·스타일·보드 결정, 지금 327줄)를 분류·상태·버전·고치는 편집기 링크(그 요소로 가는 `#…`)로 보고, 여러 개를 골라 다시 열기(`'reopen'`) · 고쳐 주세요(`'fix'`, 의견) · 확정(`'approve'`)을 홈 저장소 `manage/<자동 id>` 에 남긴다. 목록은 그 파일의 `editors-list` JSON(항목마다 저장소에서 읽을 곳 `reads`), 현황은 홈 저장소 `status/<id>`·`meta/check`, 전체 목록은 `catalog/<분류>`·`meta/catalog` (`node tools/hub-catalog.mjs --boards <보드 반영.json>` 이 저장소 파일로 만든다), 값 데이터의 검수 대기 표시는 `marks/<분류>`, 게임 카드의 문제 알리기·기기 점검 요약은 `status/game` (`node tools/hub-game.mjs` 가 게임 저장소 `reports`·`checks` 로 만든다) — 모두 Claude 가 써 넣는다 (아티팩트는 서로의 저장소를 못 읽는다). 게시본에서 스크립트·파일이 실패해도 맨 위 상자에 무엇이 안 됐는지 보여 주고 링크는 열린다. 모양은 `concept/README.md` 「편집기 홈」·「전체 관리」·「게임 저장소」.
- 채팅에 **"전체 요청 확인"** 이 오면: 홈 목록대로 각 편집기·보드 저장소, 홈 `manage` (`status:'new'`), **게임 저장소 `reports` (`status:'new'`)·`checks`** 를 읽어 새 요청·바뀐 선택·홈 요청·게임 문제를 모아 표로 보여 주고 → 보드 → 홈 다시 열기·확정 → **게임 문제 (D47-A: 막힘·저장·오류 `stuck`·`error`·`save` 는 고쳐 `status:'done'`+`reply`+`commit`, 밸런스·불편·보기 `look`·`other` 는 7차 보드 QA 칸에 올려 `status:'board'`+`qa`)** → 캐릭터 → 배경 → 시나리오 → 새 편집기 순서로 각자의 흐름(아래 · 검수 보드 절 · 스토리 절 · README 「전체 관리」·「게임 저장소」)대로 처리 → 테스트 한 번 → 바뀐 편집기·게임 다시 게시 → 반영 기록·`manage` 답(`done`+`reply`)·`hub-catalog.mjs` 로 목록 다시 만들어 `catalog/*`·`meta/catalog`·`hub-game.mjs` 로 `status/game` (새 문제 수 `open`·`openItems`, 최근 기기 점검 5개)·홈 `status/*`·`meta/check` 갱신. 공유 링크로 들어온 사람은 게임 저장소에 못 써서 글 복사 → 채팅으로 오고, 같게 처리한다. 자세한 순서는 `concept/README.md` 「"전체 요청 확인"」. 편집기 하나의 명령만 왔을 때도 끝에 홈 `status/<그 id>` 와 그 분류 `catalog/*` 를 고친다.
- 반영 기록은 모든 편집기가 보드와 같은 모양 `applied/<id>`·`history/<id>-v<n>` (편집기는 `picks` 대신 바뀐 요소 목록 `changed`, 되돌리기 요청은 요청 컬렉션에 `kind:'rollback'`) — `concept/README.md` 「반영 기록 공용 모양」(ET-11). 화면은 `concept/board-kit.js` 의 `window.ApplyLog`.
- `editor.html`(캐릭터 편집기, https://claude.ai/artifact/FTCqiHtFPcACcQEULNbUX2) · `bg-editor.html`(배경 편집기, https://claude.ai/artifact/LuEvzroBSW2RFhVWvm6tkh) 은 아티팩트로 공개되며 capabilities `db`·`assets`·`user` 를 쓴다 (캐릭터 편집기는 `applied`·`history` 쓰기 admin). 사용자가 레퍼런스(이미지·영상→장면 6장)와 프롬프트로 요청을 저장한다: 캐릭터 `refs`/`requests`, 배경 `env-refs`/`env-requests` 컬렉션.
- 채팅에 "요청 확인"(캐릭터) / "배경 요청 확인"(배경)이 오면: ArtifactData 로 `status:'new'` 요청 읽기 → `working` → 레퍼런스는 Artifact read `path=<asset id>` 로 내려받아 직접 본다 → 스펙·빌더 수정 (`version` 올리고, 확정이던 요소는 status `review` 로) → 재빌드 → 크기가 바뀌었으면 같은 스펙의 `world` 칸(충돌·집터) 맞추기 → `node --test tests/` (`assets.test.mjs` 가 교체 약속 검사) → 같은 아티팩트에 다시 publish (바뀐 파일만 `files` 로, 한 번에 255개. bg-editor 는 아티팩트 한 버전에 파일 511개까지라 요소별 스펙·통계 대신 `node tools/build-editor-index.mjs` 로 만든 묶음(배경·가구·아이템·실내 `editor-index.json` + 배경·가구·아이템 모델 `assets/<env|furniture|items>/editor-models-<n>.json`)을 올리고 `specs/`·`.stats.json`·모델 `.glb.json`·아이템 아이콘 파일은 올리지 않는다. 렌더 그림만 요소마다) → 게임 링크도 다시 게시 (웹 배포 절) → 요청을 `done` + `reply` + `doneVersion` 으로 갱신 → 반영 기록 `applied/<character|env>`·`history` → 편집기 홈 `status/<id>`.
- 캐릭터 편집기 **「성격·대화」 탭** (6차 M6-P3): 주민 데이터는 주민마다 `assets/villagers/<slug>.json` 한 파일(성격·말버릇 · 선물 반응 · 부탁 · 시간표 · 자주 가는 곳 · 이모티콘 규칙 `emote`(TK) · 글 대사 `lines`·꺼 둔 대사 `linesOff`, 목록 `src/gameplay/town/files.js`, 읽기 `town/people.js`, 검사 `town/traits.js`). 생일만 `assets/data/rules.json` `birthdays` (주민 파일은 가리키기만). "요청 확인" 때 `kind:'traits'` 요청은 스펙·Blender 대신: 요청 문서를 파일로 두고 `node tools/apply-traits.mjs <요청.json> --dry` → 적용(주민 파일 `version` +1, 생일이면 rules.json `version` +1) → 의견(`request`)은 직접 대사·값 고치기 → `node --test tests/` (`villagers.test.mjs` 지문은 고친 주민만 건너뜀, 일부러 바꾼 생일을 박아 둔 테스트만 기대값 고침) → 게임에서 그 주민과 말 걸어 보기 → 편집기 다시 publish (`files` 에 바뀐 주민 파일·rules.json 만) → 나머지는 위 순서. 자세한 순서는 `docs/notes/m6-p3-traits.md`.
- 배경 편집기 영역: 배경 · 가구 · 아이템(`slug` `item-<slug>`, `category:'item'` + `group`) · 실내 무늬(`wp-0N`·`fl-0N`, 간격 = `fields.params.sizeX/sizeY` → 스펙 `pattern.size`) · 방 배치(`rm-0N`, `category:'room'`). 방 요청에는 `layout`(그대로 `assets/interior/rooms/<slug>.json` 의 name·note·wallpaper·floor·host·furniture)과 `problems`(편집기 배치 검사, 비어야 정상)가 붙는다. RM-07(단풍)처럼 파일이 없는 방은 `kind:'add'` → 새 방 파일 + `interior/index.json` + `interior.js` `WEB_FILES` + `tests/interior.test.mjs`. 무늬·방은 Blender 없이 JSON 만, 아이템은 `node tools/build-item.mjs <slug>`. 자세한 순서는 `docs/notes/m6-p2-bgtabs.md`.
- "<이름> 확정" / "<이름> 다시 열기" (또는 홈 「전체 관리」의 확정·다시 열기): 스펙 `status: "approved"` / `"review"` → `node tools/build-*.mjs --index` (Blender 없이 목록만) → 편집기 다시 publish → 홈 `catalog/*` 다시 쓰기. 값 데이터(소리·지도·숫자·스타일)와 보드 결정은 파일 대신 홈 `marks/<분류>` 에 적는다. **확정해도 편집기·요소·반영 기록은 지우지 않는다** — 확정은 "지금 게임에 든 것" 표시일 뿐, 언제든 다시 열거나 편집기에서 바로 고쳐 요청할 수 있고 게임은 status 로 거르지 않는다. 2026-10-30 에 검수 대기 145개까지 모두 임시 확정(캐릭터 10 · 배경 52 · 가구 34 · 아이템 86 · 무늬 16 · 방 6). 교체 약속은 `docs/CONTRACTS.md` 끝 "리소스 교체 약속".
- 로컬 dev-server 는 `/api/db/<col>`·`/api/assets` 로 같은 흐름을 파일(`assets/review/`, `assets/references/`, gitignore)로 흉내 낸다.

### 검수 보드와 "검수 보드 반영" 흐름
- 새 리소스·큰 결정이 필요한 차수는 **선택지가 있는 검수 보드부터** 만들어 사용자가 고르게 한다 (`concept/README.md` — 만드는 법, 보드 목록). 보드는 공용 `concept/board-kit.js` 로 선택·의견을 아티팩트 저장소에 두고, 반영 기록·되돌리기를 보여 준다.
- 채팅에 "검수 보드 반영"이 오면: `boards/<id>` 와 `applied/<id>` 를 비교해 바뀐 결정·의견만 반영(되돌리기는 `history` 의 `commit` 기준 `git revert`) → 승인 뒤 합치기 → `applied` 버전 올리고 `history` 기록 → 편집기 홈 `status/<보드 id>`. 자세한 순서는 `concept/README.md`. 새 보드는 홈 목록(`editors.html`)에도 더한다.

### 스토리와 "시나리오 반영" 흐름
- 컷신은 데이터다: 장면 하나 = `assets/story/scenes/<id>.json` (트리거 · 연출안 2~3개(`takes`, 추천 하나, `pick` = 게임에 들어갈 것) · 컷(카메라·배우 자리/동작·이모티콘 말풍선 + 비워 둔 글 칸·전환·음악·고르기 갈래)), 순서는 `assets/story/index.json`, 파일 목록은 `src/gameplay/story/files.js` (웹 빌드가 이 글자로 묶는다). 재생기 `src/gameplay/story/` (`ctx.services.story.play(id)`, 이벤트 `story:start`·`story:end`), 규칙·카메라 계산 `rules.js` 는 편집기와 같이 쓴다. 모양·트리거·갈고리 제안은 `docs/notes/story.md`.
- 시나리오 편집기 `story-editor.html` (아티팩트, 링크는 `docs/notes/story.md` 첫 줄, capabilities `db`·`user`, `applied`·`history` 쓰기 admin): 사용자가 연출안을 고르고 컷·순서·글을 고치고 의견을 남기면 `drafts/<장면 id>`·`timeline/main` 에 저장된다.
- 채팅에 "시나리오 반영"이 오면: `drafts`·`timeline` 을 읽어 장면 파일과 다른 것만 반영(고침 = `version` +1, 새 장면 = 파일 + index.json + files.js, 의견 = 컷을 고치거나 새 연출안으로, 되돌리기 = `history/story-v<n>.commit` 의 `assets/story/`) → `node --test tests/` → dev-server `/index.html?story=<id>&take=<key>` 로 재생 확인 → 커밋 → 편집기 다시 publish (바뀐 파일만) → `applied/story` 버전 +1 · `history/story-v<n>` 기록. 자세한 순서는 `docs/notes/story.md` "시나리오 반영".

### 지도·숫자와 "지도 반영"·"숫자 반영" 흐름
- 섬 지도 자리·시드·나무·꽃 밀도 = `assets/island/layout.json` (자리는 섬 크기 비율 `[x, z]`, 빠진 칸은 `src/world/island.js` 의 `DEFAULT_LAYOUT` = 6차 전 섬. world 가 `layout.seed ?? state.island.seed` 로 만든다). 게임 숫자(아이템 값·사는 값·출현·채집 확률·상점·하루·레시피·생일·주민 친밀도) = `assets/data/items.json`·`rules.json`, `src/data/tables.js` 가 읽어 `src/data/*` 에 준다 (`town` 칸은 아직 town 이 안 읽음 — 연결 제안). 모양·저장과의 관계·축제 광장 빈 자리는 `docs/notes/m6-p5-mapdata.md`.
- 편집기: 섬 지도 `map-editor.html` · 게임 숫자 표 `data-editor.html` (아티팩트, 링크는 그 notes 첫 줄, capabilities `db`·`user`, `applied`·`history` 쓰기 admin). 사용자가 고친 칸이 `drafts/map`·`drafts/data` 의 `changes`(경로 → 값, 규칙 `tools/edits.mjs`)로 저장된다.
- 채팅에 "지도 반영" / "숫자 반영"이 오면: `drafts/<map|data>` 를 받아 `node tools/apply-edits.mjs <map|data> <초안.json> --dry` → 적용(`version` +1) → `node --test tests/` (걸리면 반영하지 않고 파일을 되돌려 이유를 알림. 숫자 반영에서 사용자가 일부러 바꾼 값을 박아 둔 테스트만 기대값을 고친다) → 게임 열어 보기 → 커밋 → 편집기 다시 publish (바뀐 JSON 만) → `applied/<map|data>` 버전 +1 · `history/<map|data>-v<n>` (`board` 칸, 지도는 `layout`, 숫자는 `snapshot` 사본) → `drafts` 비우기. 지도는 하던 저장과 어긋날 수 있어 보고에 그 정도를 적는다. 자세한 순서는 notes 「지도 반영」·「숫자 반영」.

### 소리와 "소리 반영" 흐름
- 배경음·효과음·목소리는 Web Audio 합성(소리 파일 없음)이고 값은 데이터다: 곡 하나 = `assets/sound/songs/<id>.json` (빠르기·박자·채널·파트(악기·세기·옥타브·끄기)·화음 `prog`·멜로디 `mel` 악보 글), 목록과 언제 틀까(시간대·날씨·자리 `indoor`·창 `shop`/`museum`) = `assets/sound/index.json`, 효과음 표 `sfx.json`(높이·길이·크기 + 소리 층), 목소리 표 `voices.json`. 파일 목록은 `src/audio/files.js` (웹 빌드가 이 글자로 묶는다). 반주 모양(마디마다 무엇을 치는지)은 코드 `src/audio/songs.js` 의 `ARRANGE` 이고 곡 데이터의 `arrange` 로 고른다. 데이터 모양·저장소 모양은 `docs/notes/m6-p4-sound.md`.
- 곡 편집기 `sound-editor.html` (아티팩트, 링크는 `docs/notes/m6-p4-sound.md` 첫 줄, capabilities `db`·`user`, `applied`·`history` 쓰기 admin): 사용자가 곡·선곡 표·효과음·목소리를 고쳐 바로 들어 보고 의견을 남기면 `drafts/*` 에 저장된다.
- 채팅에 "소리 반영"이 오면: `drafts`·`requests/sound`·`applied/sound` 읽기 → 초안 행을 파일로 저장해 `node tools/apply-sound.mjs <초안.json> --dry` 로 확인 → 실제 실행(바뀐 파일 `version` +1, 새 곡은 index·files.js 까지) → 의견은 직접 반영 → `node --test tests/` (`sound.test.mjs` 의 지문이 고치지 않은 곡·효과음 소리가 그대로인지 본다) → dev-server 에서 들어 보기 → 커밋 → 편집기 다시 publish (바뀐 파일만) → `applied/sound` 버전 +1 · `history/sound-v<n>` (`commit` = 그 버전 파일이 든 커밋) 기록. 되돌리기는 `git checkout <commit> -- assets/sound/ src/audio/files.js`. 자세한 순서는 `docs/notes/m6-p4-sound.md` "소리 반영".

### 스타일과 "스타일 반영" 흐름
- 셰이더 값(명암 띠·그늘 색·림·하이라이트·바람·물결·외곽선·화면 효과·집 안 덧씌우기)은 데이터다: `assets/style/presets.json` (`{version, default, labels, presets:{cozy,toon}, indoor}`), 조절 값 표(이름·묶음·범위)는 `src/render/presets.js` 의 `PARAMS`. 셰이더 구조는 `docs/SHADERS.md`.
- 스타일 편집기 `style-editor.html` (아티팩트 https://claude.ai/artifact/EWuGKbMpo9uTjLEUzhT2Pd, capabilities `db`·`user`, `applied`·`history` 쓰기 admin, 게시 파일 목록 `assets/style/editor-files.json`): 대표 모델 5개 작은 섬 + 진짜 하늘에서 값을 고르고 나눠 보기로 비교, 값은 `drafts/style` 에 바로 저장, 저장본 `saves/<id>`, 의견은 프리셋마다. 로컬은 `?island` 로 진짜 섬.
- 채팅에 "스타일 반영"이 오면: `drafts/style` 을 읽어 `presets.json` 과 다른 것만 반영(값 = 그대로 쓰고 `version` +1, 되돌리기 = `rollback: n` 이면 `history/style-v<n>.commit` 의 파일 값, 의견 = 그 프리셋 값을 고치거나 새 효과는 `docs/SHADERS.md` 순서로) → `node --test tests/` → dev-server 로 게임(`?style=<프리셋>` 낮·밤)·편집기 스크린샷 → 커밋 → 편집기 다시 publish (`files` 에 presets.json 등 바뀐 것만, capabilities 생략) → `applied/style` 새 버전 · `history/style-v<n>` (`{board:'style', version, style, notes, appliedAt, summary, commit}`), `drafts/style` 은 `status: 'editing'` → 게임 링크도 다시 게시 (웹 배포 절). 자세한 순서는 `docs/notes/m6-p6-style.md`.

### 웹 배포 (게임 링크)
- 게임은 claude.ai 아티팩트 https://claude.ai/artifact/73gDyHVhfveR7ESQ23JrbJ 로 게시돼 있다. `node tools/build-web.mjs` → `dist/web/index.html`(뼈대 없는 페이지 + 로딩 화면 + 묶음 목록) · `packs/<갈래>-<n>.json` · `files.json` · 255개가 넘으면 `files-1.json`, `files-2.json` … (`dist/` 는 커밋하지 않는다). 게시는 `file_path: dist/web/index.html` + `files` 에 묶음 하나씩, 같은 file_path 로 차례로. 로컬 확인은 dev-server `/artifact/`. 자세한 순서는 `docs/notes/deploy.md`.
- 아티팩트는 한 버전에 파일 511개까지라 **에셋(assets/ 의 JSON·.glb.json·그림)은 묶음 파일**로 올라간다 (M6-P0, 게시 파일 145개). 갈래는 `tools/build-web.mjs` `PACKS` (boot = 열자마자 받음). 게시본에서는 `src/core/packs.js` 가 묶음에서 꺼내고, 개발 서버(`/index.html`)는 파일을 하나씩 — 그래서 에셋은 `ctx.assets.loadJSON`·`loadModel` 로 읽고, `<img>` 그림은 `iconEl`/`ctx.assets.url(path)` (blob URL) 로 건다. 직접 `fetch('assets/…')` 는 게시본의 fetch 덮개로만 돈다. 설계는 `docs/notes/m6-p0-pack.md`.
- 다시 게시는 바뀐 것만: 빌드 전에 `dist/web/build.json` 을 따로 두고 → 새로 빌드 → `packs[].hash` 가 바뀐 묶음 + `git diff --name-only <지난 build 해시> HEAD -- src index.html` 의 모듈 + 페이지. 새 `files.json` 에 없는 예전 경로는 `files` 에 `null`. 다른 대화에서 올린 파일은 먼저 `list_files`(또는 `read_file`)로 본 뒤 같은 `url` 로 publish (같은 링크 = 플레이어 저장이 남는다). 게시 버전·빌드 해시는 devlog 「게시물」과 홈 `status/game` 에 적는다.

### QA · 자동 플레이 점검 (`docs/qa/`)
- 봇이 사람처럼 키·창 단추·가상 조이스틱으로만 처음부터 엔딩(그리고 1년 뒤 축제)까지 플레이한다: `tests/playthrough/` (`bot.js` 본체 — 게임 rAF 를 멈추고 `ctx.step(dt)` 를 직접 돌림, `skills.js` 사람 행동 단위, `scenario.js` 단계 목록), 실행기 `tools/playtest.mjs` (CDP). 지름길(`festival.debug` 등)·상태 직접 고치기 금지, 시계만 `time.setHour` 로 당긴다. 결과 `docs/qa/runs/` (커밋 안 함), 보고서 `docs/qa/playthrough-<날짜>.md` (버그 ID `QA-NN`, 크기 치명·큼·작음·다듬기). 새 흐름이 합쳐지면 `scenario.js` 에 단계를 더한다 — `docs/qa/README.md`.
- QA 결과의 처리(보드 wave7 D47-A): 막힘·저장 깨짐·오류는 그 자리에서 고쳐 합치기 승인만, 밸런스·불편·보기는 7차 보드 QA 칸(`concept/wave7-board.html` 의 `QA` 표)에 선택지로.

### 병렬 개발 방식
- 지금 마일스톤은 **M7 출시 준비** (보드 wave7 반영 v1, 트랙 M7-P1–P6 표는 `docs/PLAN.md` 「7차」, 결정·근거 `docs/notes/board7.md`), 다음은 M8 계절 행사.
- 단계 P1~P6 과 트랙 표는 `docs/PLAN.md`. 트랙마다 브랜치 + git worktree(`../island-worktrees/<브랜치>`)에서 **자기 폴더만** 고치고, 계약 변경은 `docs/notes/<트랙>.md` 에 제안한다. `main` 합치기는 사용자 승인 뒤 조정 세션이 한다 (합치기 전 `git merge-tree --write-tree main <branch>` 로 충돌 확인).
- 미리보기 브라우저 창이 숨겨져 있으면 `requestAnimationFrame` 이 느려져 fps 값이 의미 없다 — 성능은 `renderer.render` + `gl.finish()` 시간으로 잰다.
