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
```

- 페이지: `/index.html` 게임 (`?debug` 모듈 로딩·시간/날씨 패널, `?quality=low` 저사양), `/editor.html` 캐릭터 편집기, `/bg-editor.html` 배경 편집기, `/demos/*.html` 트랙별 데모.
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
- `editor.html`(캐릭터 편집기, https://claude.ai/artifact/FTCqiHtFPcACcQEULNbUX2) · `bg-editor.html`(배경 편집기, https://claude.ai/artifact/LuEvzroBSW2RFhVWvm6tkh) 은 아티팩트로 공개되며 capabilities `db`·`assets`·`user` 를 쓴다. 사용자가 레퍼런스(이미지·영상→장면 6장)와 프롬프트로 요청을 저장한다: 캐릭터 `refs`/`requests`, 배경 `env-refs`/`env-requests` 컬렉션.
- 채팅에 "요청 확인"(캐릭터) / "배경 요청 확인"(배경)이 오면: ArtifactData 로 `status:'new'` 요청 읽기 → `working` → 레퍼런스는 Artifact read `path=<asset id>` 로 내려받아 직접 본다 → 스펙·빌더 수정 (`version` 올리고, 확정이던 요소는 status `review` 로) → 재빌드 → 크기가 바뀌었으면 같은 스펙의 `world` 칸(충돌·집터) 맞추기 → `node --test tests/` (`assets.test.mjs` 가 교체 약속 검사) → 같은 아티팩트에 다시 publish (바뀐 파일만 `files` 로; bg-editor 는 파일 270개라 255개 제한) → 게임 링크도 다시 게시 (웹 배포 절) → 요청을 `done` + `reply` + `doneVersion` 으로 갱신.
- "<이름> 확정": 스펙 `status: "approved"` → `node tools/build-*.mjs --index` (Blender 없이 목록만) → 편집기 다시 publish. 2026-10-29 에 61종(캐릭터 9 · 배경 32 · 가구 20) 모두 임시 확정. 교체 약속은 `docs/CONTRACTS.md` 끝 "리소스 교체 약속".
- 로컬 dev-server 는 `/api/db/<col>`·`/api/assets` 로 같은 흐름을 파일(`assets/review/`, `assets/references/`, gitignore)로 흉내 낸다.

### 웹 배포 (게임 링크)
- 게임은 claude.ai 아티팩트 https://claude.ai/artifact/73gDyHVhfveR7ESQ23JrbJ 로 게시돼 있다. `node tools/build-web.mjs` → `dist/web/index.html`(뼈대 없는 페이지 + 로딩 화면) · `files.json` · 255개가 넘으면 `files-1.json`, `files-2.json` … (`dist/` 는 커밋하지 않는다). 게시는 `file_path: dist/web/index.html` + `files` 에 묶음 하나씩, 같은 file_path 로 차례로. 로컬 확인은 dev-server `/artifact/`. 자세한 순서는 `docs/notes/deploy.md`.

### 병렬 개발 방식
- 단계 P1~P6 과 트랙 표는 `docs/PLAN.md`. 트랙마다 브랜치 + git worktree(`../island-worktrees/<브랜치>`)에서 **자기 폴더만** 고치고, 계약 변경은 `docs/notes/<트랙>.md` 에 제안한다. `main` 합치기는 사용자 승인 뒤 조정 세션이 한다 (합치기 전 `git merge-tree --write-tree main <branch>` 로 충돌 확인).
- 미리보기 브라우저 창이 숨겨져 있으면 `requestAnimationFrame` 이 느려져 fps 값이 의미 없다 — 성능은 `renderer.render` + `gl.finish()` 시간으로 잰다.
