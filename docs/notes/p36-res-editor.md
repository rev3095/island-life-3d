# p36 리소스 편집기 — https://claude.ai/artifact/1weSx9yyf2U4mLnwvopBNV

2026-11-11 · 브랜치 `p36-res-editor` (main 25eb0c6 에서). 사용자 요청 "리소스 변경 고려해서 분리, 스토리 분리, 요소 분리 편집기" 중 **① 리소스**. 함께 도는 세션: 스토리 편집기 `p36-story-editor` · 요소 편집기 `p36-elem-editor`.

게임에 들어가는 **모델·그림 리소스 전부**를 한 편집기에서 맡는다. 나중에 리소스를 로컬 생성이나 다른 모델로 바꿀 수 있게(`docs/notes/local-resources.md`), 요소마다 "어떻게 바꿀지"와 "바꿔도 되는지(교체 약속)"를 한 화면에 둔다.

| 영역 | 개수 | 주소 끝 `#…` (예전 편집기와 같음) |
|---|---|---|
| 캐릭터 | 15 (CH-01–15) | `#coco` |
| 배경 (자연·소품·건물·타일, 축제·행사·밤·투어 포함) | 76 | `#bench` |
| 가구 + 상점·박물관 붙박이 | 50 + 8 | `#furn-sofa` · `#fix-display-stand` |
| 아이템 | 103 모델 (아이콘 116) | `#item-fish-carp` |
| 벽지·바닥 무늬 | 16 | `#wp-04` |

맡지 **않는** 것: 방 배치(`rm-*`, `place-shop`·`place-museum`) → 요소 편집기, 주민 성격·대화 탭 → 스토리 편집기.

## 화면 (`res-editor.html`, 완전한 HTML 문서)

- **위**: 영역 탭(전체·캐릭터·배경·가구·아이템·무늬) · 주제 칩(계절 행사·축제·밤·새벽·무인도 투어 — 설정 파일 `events.json`·`festival/config.json`·`night.json`·`tour.json` 이 slug·아이템 id 를 부르면 그 주제) · 상태(검수 대기·확정·요청 있음·약속 △✗) · 찾기 · 요소 격자 (+ 새 리소스).
- **왼쪽**: 3D 보기 (캐릭터는 동작 버튼, 가구 색 변형, 무늬는 실제 크기 반복 + 1m 눈금), 수치(삼각형·크기·뼈·동작·칸), Blender 렌더(캐릭터 보기 넷 · 배경·가구 렌더 묶음 · 아이템 아이콘), **버전 비교** — 바로 전 그림(git 기록) ↔ 지금, 나란히 + 겹쳐 보기 + "예전 그림으로 되돌리기 요청".
- **오른쪽**: 상태(확정/검수 대기 + 확정 요청 · 다시 열기 요청) → **바꾸는 방법** 셋 → **교체 약속 검사** 표 → 레퍼런스 그림(이미지·영상 → 장면 6장) → 요청 글·보내기·글로 복사·이 요소의 요청 기록.
  - `blender` **스펙 고쳐 다시 빌드**: 색(바로 보기) · 수치(캐릭터 proportions / 무늬 pattern.size / 나머지 params — `live` 만 바로 보기) · 컨셉.
  - `local` **로컬 생성 시험**: 만드는 것(ComfyUI SDXL 그림 · ComfyUI 이음매 없는 무늬(무늬만) · Hunyuan3D-2.1 · TRELLIS — 3D 는 캐릭터·무늬 빼고) · 결과 쓰는 곳(레퍼런스로만 · 스펙 숫자 맞추기 · 모양 가져와 바꿔 끼우기 · 무늬 그림 직접) · 프롬프트 · 시드 · Decimate.
  - `file` **만든 파일로 교체**: .glb 를 골라 **브라우저에서 풀어** 3D 로 보고, 같은 검사 함수로 "바꿀 파일" 칸을 채운다. .glb 는 웹 저장소에 못 올리니 파일 위치(이 PC 경로·링크)를 적는다.
- **아래**: 반영 순서 · 반영 기록(`applied/res` 머리 줄 + `history/res-v<n>` 목록, 되돌리기 요청 단추 — `concept/board-kit.js` `window.ApplyLog`).

## 교체 약속 검사 (`tools/res-contracts.mjs`)

`docs/CONTRACTS.md` 끝 「리소스 교체 약속」과 `tests/assets.test.mjs` · `items-assets.test.mjs` 가 보는 것을 **요소 하나 단위** 순수 함수로. 세 곳이 같은 함수를 쓴다: 묶음 빌더(지금 모델 결과를 `assets/res/editor-index.json` 에) · 편집기(바꿀 .glb 를 브라우저에서) · `tests/res-editor.test.mjs`.

| id | 약속 | ✗/△ |
|---|---|---|
| `index` | 목록 = 스펙 (id·version·status) | ✗ |
| `status` · `palette` | review·approved / 색 #RRGGBB | ✗ |
| `materials` | 재질 이름 = 팔레트 키 (+ 변형 팔레트, `eyeHighlight` 만 예외) | ✗ |
| `named` | 코드가 이름으로 찾는 재질·노드 (fruit-tree `fruit` · palm `coconut` · 타일 땅 색 · 벽시계 바늘) | ✗ |
| `clips` · `bones` · `skin` | 캐릭터 동작 idle·walk·run·happy · 뼈 arm.L·arm.R·spine·head · 뼈대 하나 | ✗ |
| `sit` · `height` | 앉기 동작(스펙에 있으면) · 키 0.6–1.4 | △ |
| `collider` · `lot` | 배경 world.collider ↔ 모델 크기(가로 88%~+0.1) · 건물 집터 | ✗ |
| `footprint` · `item` | 가구 모델 ≤ 칸 · items.js 놓는 곳·칸 수 | ✗ |
| `budget` | 삼각형 예산 캐릭터 12.5k · 배경·가구 8k · 아이템 6k (Intel UHD 기준) | △ |
| `pattern` | 무늬 pattern.size·tile | ✗ |

지금(11-11, main 25eb0c6) 268개 모두 ✗ 0, △ 3 (구름 18.0k · 파도 17.4k · 여명 16.2k 삼각형 — 12.5k 예산보다 큼).

## 저장소 (편집기 아티팩트 db) — capabilities `db`·`assets`·`user`, 규칙 `applied`·`history` 쓰기 admin

| 컬렉션·문서 | 모양 | 쓰는 쪽 |
|---|---|---|
| `res-requests/<자동 id>` | 아래 요청 | 편집기 (interact) · 처리 결과는 Claude |
| `res-refs/<자동 id>` | `{ key, area, cat, gen?, kind: 'image'\|'video'\|'frame', asset, mime, name, note, parent?, t?, status: 'active'\|'removed', createdAt }` | 편집기 |
| `applied/res` · `history/res-v<n>` | 반영 기록 공용 모양 (`board: 'res'`, `changed: [{ id: <key>, label, what, version, request: 'res-requests/<id>' }]`, `items: { <key>: <스펙 version> }`) | Claude (admin) |

로컬 dev-server 흉내: `assets/review/res-requests.json` · `res-refs.json` · `res-applied.json` · `res-history.json` (행마다 `docId`), 그림은 `assets/references/`.

**요청 문서** `res-requests/<자동 id>`:
```js
{ key,                 // 편집기 주소 끝 ('bench' · 'furn-sofa' · 'item-fish-carp' · 'fix-…' · 'wp-04' · 'coco'), 새 리소스 '_new', 편집기 전체 되돌리기 '_log'
  area, cat,           // character | env | furniture | fixture | item | pattern · 분류 (prop · fish · wallpaper …)
  ref, slug, name,     // 요소 ID (PR-02 …) — 'id' 칸은 저장소 문서 id 와 겹쳐서 쓰지 않는다
  kind,                // 'edit' | 'swap' | 'add' | 'rollback' | 'approve' | 'reopen'
  method,              // 'blender' | 'local' | 'file' | null (rollback·approve·reopen)
  base,                // 요청 때 스펙 version
  status: 'new',       // → 'working' → 'done' (Claude) · 'cancelled'
  createdAt, by, text, // text = 사람이 읽는 요청 글 (채팅에 붙여도 같은 글)
  request,             // 하고 싶은 말
  fields?: { palette: {키: 새 색}, values: {키: 새 값}, concept? },          // method 'blender' — 바뀐 것만
  local?: { generator, use: 'ref'|'spec'|'shape'|'texture', prompt, seed, decimate },   // method 'local'
  file?: { path, from, name, bytes, size: [X,Y,Z], info: { materials, clips, skins, triangles, nodes } }, checks?: [검사 줄], // method 'file'
  refs: [{ id, asset, kind, name, note, gen, frames }],
  to?, commit?,        // rollback: 요소는 예전 그림의 스펙 version·커밋, '_log' 는 반영 기록 버전 n
  // Claude 가 더함: reply, doneAt, doneVersion
}
```
`kind` 정하는 법: 새 요소 → `add`, `file` 또는 `local`+`shape` → `swap`, 그 밖 → `edit`. 상태 단추 → `approve`·`reopen`, 버전 비교·반영 기록 단추 → `rollback`.

## 채팅 명령 "리소스 요청 확인" — Claude 처리 순서

예전 **"요청 확인"(캐릭터 모델)** · **"배경 요청 확인"** 의 모델·그림 요청을 이 하나로 합친다 (예전 편집기 저장소 `requests`·`refs`·`env-requests`·`env-refs` 는 비어 있어 옮기지 않는다 — 11-11 확인 기준).

1. ArtifactData 로 리소스 편집기 `res-requests` 에서 `status:'new'` 를 모두 읽어 표로 보여 준다 (요소·kind·method·글). 처리할 것마다 `status:'working'`.
2. 레퍼런스(`refs[].asset`, 영상은 `frames`)는 Artifact read `path=<asset id>` 로 내려받아 직접 본다.
3. kind·method 마다:
   - **`edit` · `blender`**: `fields` 를 스펙에 (색 → `palette`, 값 → 캐릭터 `proportions` · 무늬 `pattern.size` (sizeX/sizeY) · 나머지 `params.<키>.value`, 컨셉 → `prompt.concept`) + `request` 글은 직접 해석. `version` 올림, 확정이던 것은 `status:"review"`. 재빌드 `node tools/build-character.mjs <slug>` · `build-env.mjs <slug>` · `build-furniture.mjs <slug>` (붙박이 `--fixtures`) · `build-item.mjs <slug>` · 무늬는 JSON 만 (`interior/index.json` version·status 도).
   - **`edit` · `local`** (`use` ref·spec): ComfyUI(`../_tools/ComfyUI_windows_portable`, API `/prompt`)로 프롬프트·시드대로 그림을 뽑아 (시드 없으면 넷) 리소스 편집기 `res-refs` 에 `gen: <generator>` 로 올리고, `spec` 이면 그 그림을 보고 스펙 숫자·색을 맞춰 위처럼 재빌드. 큰 모델 내려받기는 사용자 승인 먼저.
   - **`swap` · `local`** (`use` shape): local-resources.md 3-C 순서 — 생성 결과 `assets/<분류>/sources/<slug>.glb` (커밋 안 함) → `assets/blender/build_import.py`(아직 없음 — 처음 요청 때 만든다: 크기 맞추기 · Decimate · 팔레트 재질로 다시 칠하기 · 법선) → 스펙에 `source: { kind: 'import', generator, image, seed, decimate }` · `regions`. **캐릭터는 하지 않는다** (자동 뼈 심기가 뼈 이름·동작과 안 맞음 → 그림만).
   - **`swap` · `file`**: `file.path` 의 .glb 를 받아 (경로를 못 읽으면 채팅으로 첨부 부탁) 같은 손질 순서(`build_import.py`)로 원점·크기·재질 이름을 약속에 맞춘다 → `.glb.json`·`stats`·렌더. 요청에 붙은 `checks` 의 ✗ 가 무엇인지 먼저 본다.
   - **`add`**: 새 스펙(ID 는 `concept/README.md` ID 표 다음 번호) + 빌더 `kind` + 목록 `--index` + 개수 박은 테스트(`assets.test.mjs` count · `items-assets.test.mjs` 등, CLAUDE.md 명령어 절).
   - **`rollback`** (요소): `commit` 의 그 요소 스펙을 꺼내(`git show <commit>:<스펙>`) 값만 되살리고 `version` 은 앞으로(+1)·`status:"review"` → 재빌드. 기록은 지우지 않고 앞으로만. `'_log'` 는 `history/res-v<to>.commit` 기준으로 그 뒤 리소스 편집기 때문에 들어간 커밋을 `git revert` (README 「반영 기록 공용 모양」) — 무엇을 되돌리는지 먼저 보여 준다.
   - **`approve` · `reopen`**: 스펙 `status` 만 바꾸고 `--index`.
4. 크기가 바뀌었으면 같은 스펙의 `world` 칸(충돌·집터)·가구 `footprint` 와 `src/data/items.js` 칸 글자를 맞춘다.
5. `node tools/build-editor-index.mjs` → 출력의 `약속 어긋남 0` 확인 (✗ 가 있으면 그 줄이 나온다) → `node --test tests/`.
6. 리소스 편집기 다시 게시: `dist/res-editor/publish.json` 의 `batches` 중 **바뀐 묶음만** `publish_files` (slug `07a13dca-ff9b-4654-8aa9-f3699643919e`, base_version = 지난 게시 결과). `assets/res/editor-index.json`·`editor-prev.json` 은 늘 같이. capabilities 는 그대로(다시 선언하지 않음). 게임 링크도 다시 게시 (CLAUDE.md 「웹 배포」).
7. 요청 `status:'done'` + `reply`(한 줄) + `doneAt` + `doneVersion`(새 스펙 version). 반영 기록 `applied/res` version+1 + `history/res-v<n>` (`commit` = 반영 직전 main). 편집기 홈 `status/res` · `catalog/<분류>`.

윈도우에서 파이썬으로 JSON 을 쓸 때는 `open(p, 'w', encoding='utf8', newline='')`. git bash 의 `curl -d` 로 한글을 보내면 cp949 로 깨진다 — 로컬 흉내 저장소에 쓸 때는 node `fetch` 로.

## 묶음 · 게시 (`node tools/build-editor-index.mjs`)

배경 편집기 묶음에 더해 만든다 (모두 gitignore):
- `assets/models/editor-index.json` · `editor-models-1…6.json` (캐릭터 스펙·통계·모델), `assets/renders/editor-renders-1…15.json` (보기 넷: 3/4·정면·옆·뒤 — 동작·장면 렌더는 빼서 30MB) · `editor-thumbs.json`.
- `assets/res/editor-index.json` (268줄: key·area·cat·ID·이름·상태·version·주제·검사 결과·삼각형·크기·스펙 경로·`prev`) · `assets/res/editor-prev.json` (바로 전 썸네일 data: — `git log` 로 썸네일이 바뀐 커밋 중 지금 커밋된 것 바로 앞, 고친 채 아직 커밋 전이면 HEAD 것. 무늬는 예전 스펙으로 그린다).
- 게시 목록 `dist/res-editor/publish.json`: 페이지 + `tools/res-contracts.mjs` + `concept/board-kit.js` + 묶음 = **90개 · 171MB** (한도 511개 · 256MB), 60MB 차례 셋. 배경 편집기 묶음과 같은 파일을 같이 쓴다.
- 페이지는 이미 `<!doctype html>` 로 시작하는 완전한 문서라 감싼 사본이 따로 필요 없다 (예전 편집기 파일은 `<title>` 부터라 감쌌다).

게시 (11-11): 새 아티팩트 v4 `1794325001-43a1` (파일 90, `declare_capabilities` `{ assets: {}, db: { rules: [applied·history read view write admin] }, user: {} }`).

## 편집기 홈 (`editors.html`) — 이 브랜치가 한 것

- `editors-list` 맨 앞에 `res` 줄 (group `editor`, command `리소스 요청 확인`, reads `res-requests: status == 'new'`), 바로 가기 「리소스 ↗」.
- `character` · `env` 줄은 **지우지 않고** group `archive` 로 (이름 끝 「(예전)」, edits 앞에 옮겨 가는 곳). 바로 가기 맨 끝 「예전 캐릭터 편집기 ↗」·「예전 배경 편집기 ↗」. 아래 「지난 보드」 줄은 concept/ 밖이면 「예전 편집기」로.
- 명령 표에 `"리소스 요청 확인"` 줄. `tests/hub.test.mjs`: COMMANDS 에 '리소스 요청 확인', archive 중 concept/ 밖(예전 편집기)은 보드 표 검사를 건너뜀 (CLAUDE.md 링크 검사는 그대로).
- 합칠 때: 스토리·요소 편집기 세션도 같은 목록·바로 가기·명령 표·COMMANDS 줄에 더한다 — **충돌은 줄 단위로 둘 다 살린다**. character 줄은 셋이 같이 건드릴 수 있다 (스토리 세션: 성격·대화) → group `archive` 하나로.
- 아직 안 한 것: `tools/hub-catalog.mjs` 의 전체 관리 링크는 예전 편집기 그대로 (주소 끝이 같아서, 새 편집기가 확정되면 `editor` 를 `res` 로만 바꾸면 된다 — 캐릭터 `#slug` · 배경 `#slug` · 가구 `#furn-` · 아이템 `#item-` · 무늬 `#wp-`, 붙박이는 지금 `#place-shop` → `#fix-<slug>`). 홈 저장소 `status/res` 는 사용자 승인·합치기 뒤.

## 조정 세션이 합칠 때 고칠 문장 (지금은 고치지 않음)

**CLAUDE.md 「편집기와 "요청 확인" 흐름」**
- 넷째 줄(`editor.html` · `bg-editor.html` …) 앞에 새 줄:
  > - **리소스 편집기** `res-editor.html` (https://claude.ai/artifact/1weSx9yyf2U4mLnwvopBNV, capabilities `db`·`assets`·`user`, `applied`·`history` 쓰기 admin): 모델·그림 리소스 전부(캐릭터 15 · 배경 76 · 가구 50 + 붙박이 8 · 아이템 103 · 무늬 16). 요소마다 스펙 값 · 레퍼런스 · 바꾸는 방법(`blender` 다시 빌드 / `local` 로컬 생성 시험 / `file` 만든 .glb 교체) · 교체 약속 검사(`tools/res-contracts.mjs` — 테스트와 같은 약속) · 예전↔지금 렌더 비교 · 확정/다시 열기. 요청 `res-requests` (kind `edit|swap|add|rollback|approve|reopen`), 레퍼런스 `res-refs`. 채팅 **"리소스 요청 확인"** — 순서는 `docs/notes/p36-res-editor.md`. 게시 묶음은 `node tools/build-editor-index.mjs` → `dist/res-editor/publish.json`.
- "요청 확인"(캐릭터) / "배경 요청 확인"(배경) 줄 앞에: 「(예전 — 모델·그림 요청은 "리소스 요청 확인", 성격·대화는 스토리 편집기, 방 배치는 요소 편집기로 옮김. 예전 편집기와 저장소는 지우지 않는다)」.
- 명령어 절 `build-editor-index.mjs` 줄 주석: 「배경·리소스 편집기 게시용 묶음 (… + 캐릭터·`assets/res/`, 게시 목록 `dist/bg-editor/`·`dist/res-editor/publish.json`)」.
- "전체 요청 확인" 순서의 「→ 캐릭터 → 배경 →」 을 「→ 리소스 →」 로.

**concept/README.md 「편집기 홈」·「전체 관리」·「반영 기록 공용 모양」**
- 「전체 관리」 표 `character`·`env`·`furniture`·`item`·`interior` 의 「고치는 곳」 을 「리소스 편집기 `#<slug>` (`#furn-` · `#item-` · `#fix-` · `#wp-0N`)」 로 (새 편집기 확정 뒤, `hub-catalog.mjs` 와 같이). `room` 은 요소 편집기, `villager` 는 스토리 편집기.
- 「반영 기록 공용 모양」 편집기 id 목록에 `res`, 맡은 파일 표에 `res` = `assets/specs/`·`assets/models/`·`assets/renders/`·`assets/env/`·`assets/furniture/`·`assets/items/`·`assets/interior/specs/`·`assets/blender/build_*.py`·`toonkit.py` (방 파일 `assets/interior/rooms`·`places` 는 요소 편집기).
- 「편집기 홈」 첫 문단 뒤: 「목록 group `archive` 는 지난 보드와 예전 편집기(링크만 남김, 2026-11-11 캐릭터·배경 편집기)」.

## 확인한 것 (11-11, `node dev-server.mjs --port=4236` 의 `/res-editor.html`)

- 영역 여섯 모두 열림: 코코(동작 7 · 외곽선 · 보기 넷) · 벤치 · 벚나무(계절 변형 넷 · 「계절 행사」) · 축제 무대(「축제」) · 소파(색 변형) · 진열 받침(붙박이) · 잉어(아이템) · WP-04(무늬 크게 · 간격 슬라이더).
- 1200px · 375px 가로 넘침 0 (요소 넷 × 방법 셋), 콘솔 오류 0.
- 바꿀 파일 미리 보기: 벤치 자리에 소파 .glb → 재질 `fabric·cushion·leg` 팔레트 밖 ✗ · 충돌 가로 1.4 ↔ 1.81 ✗, 벤치 .glb → ✗ 0.
- **벤치로 처리 흐름 끝까지 (로컬 흉내 `/api/db/*`)**: 교체 요청(`swap`·`file`) 저장 → 색 요청(`edit`·`blender`, wood #B98957 → #D9A066) 저장 → `working` → 스펙 v0.2·review → `node tools/build-env.mjs bench` (Blender 6초) → `build-editor-index` 약속 어긋남 0 · 예전 버전에 벤치(905f905 v0.1)가 잡힘 → `node --test tests/` 424 통과 → `done`+`reply`+`doneVersion 0.2`, `res-applied` v1 · `res-history` res-v1 → 편집기에서 「반영 완료」·답·머리 줄·버전 비교(어두운 v0.1 ↔ 밝은 v0.2, 겹쳐 보기) 확인 → 「예전 그림으로 되돌리기 요청」(`rollback`, to 0.1, commit 905f905) → 시험이라 벤치 파일을 main 그대로 되돌림 (`git checkout HEAD -- …`) → done. 시험 행은 `assets/review/res-*.json` (gitignore) 에만.
- 첫 시험에서 요청 문서의 `id` 칸(요소 ID)이 저장소 문서 id 와 겹쳐 덮이는 것을 찾아 `ref` 로 바꿈 (테스트가 막음).

못 한 것: claude.ai 게시본에서 요청 저장·업로드(게시 뒤 열어 보기는 사용자), ComfyUI·Hunyuan3D 실제 생성(요청이 와야 함 — `build_import.py` 는 첫 `swap` 요청 때), 홈 저장소 `status/res` 쓰기(합친 뒤).
