시나리오 편집기: https://claude.ai/artifact/NrmMmozFXQCdiw1oQMxCyF · 파일 `story-editor.html`

# 스토리 — 작업 노트 (`story` 브랜치, 고정 세션)

게임 시작부터 엔딩까지의 **장면(컷신)** 을 데이터로 두고, 게임 안 재생기로 틀고, 사용자가 편집기에서 고르고·고치고·적용한다.
확인: `node dev-server.mjs --port=4216` → `/index.html?story=s11-ending-photo` (이름을 정한 뒤 그 장면을 튼다, `&take=B` 로 연출안), 편집기 `/story-editor.html`.

## 만든 것

| 파일 | 내용 |
|---|---|
| `assets/story/index.json` | 타임라인: 처음 → 엔딩 뒤 순서. `{scene}` 줄 = 장면, `{fixed, title, owner, note}` 줄 = 지금 있는 흐름(이름 정하기·밤톨 안내·첫날 할 일·부품 찾기·엔딩 뒤 섬 생활) — 순서 기준으로만 |
| `assets/story/scenes/<id>.json` | 장면 하나 = 파일 하나 (바꿔 끼우기 단위). 12개 초안 |
| `src/gameplay/story/rules.js` | 순수 규칙 (DOM·three 없음): 트리거 표·장소·카메라 크기/움직임·이모티콘 판, 연출안 고르기, 배우 자리 쌓기·걷기, 카메라 계산(`cameraAt`)·투영(`project`, 편집기 스케치), 글 자리 채우기, 장면·타임라인 검사. **게임과 편집기가 같은 파일을 쓴다** |
| `src/gameplay/story/files.js` | 장면 파일 목록 `SCENE_FILES` (웹 빌드가 글자를 보고 묶는다 — 장면을 더하거나 빼면 여기도. 테스트가 index.json 과 맞는지 본다) |
| `src/gameplay/story/index.js` | 재생기 모듈 (`name: 'story'`). 트리거 이벤트 → 줄 세우기 → 틀어도 될 때 재생. `ctx.services.story` |
| `src/gameplay/story/layer.js` · `story.css` | 장면 화면 층 (자기 DOM, ui 층 맨 위): 위아래 띠·자막·건너뛰기, 이모티콘 말풍선, 고르기 단추, 넘기기 표시, 사진 틀, 화면 막 |
| `src/gameplay/index.js` | 하위 모듈 목록에 `['story', './story/index.js']` **한 줄** (intro 다음). 폴더 밖에서 고친 건 이것뿐 |
| `story-editor.html` | 시나리오 편집기 (아티팩트, db·user) |
| `tests/story.test.mjs` | 7개: 장면 모양·타임라인↔파일↔files.js·처음~엔딩 이어짐·연출안 2~3개와 글 칸·트리거·카메라·걷기 |

## 장면 파일 모양

```jsonc
{
  "id": "s11-ending-photo",          // 's' + 두 자리 + '-이름', 파일 이름과 같다
  "version": 1, "status": "draft",   // draft | review | approved (리소스 교체 약속과 같은 생각: 고치면 version +1)
  "chapter": "엔딩", "title": "단체 사진", "summary": "줄거리 (편집기용)",
  "trigger": { "on": "after", "scene": "s10-festival" },   // 아래 표
  "place": "event",                  // 기준 자리 (rules.PLACES). 배우·카메라 자리는 여기서 떨어진 칸
  "once": true,                      // 한 번만 (state.story.seen)
  "playerEnd": "stay",               // 끝나면 진짜 주인공을 장면 속 주인공 자리로 (없으면 원래 자리)
  "pick": "A",                       // 게임에 들어갈 연출안
  "takes": [                         // 연출안 = 선택지 (2~3개, recommended 하나)
    { "key": "A", "title": "광장 무대 앞 두 줄", "recommended": true, "desc": "…", "place": "dock"?,   // place 는 연출안마다 바꿀 수 있다
      "shots": [
        { "id": "c1", "note": "컷 설명", "dur": 4,
          "cam": { "size": "group", "target": "group", "angle": 0, "move": "static", "height": 0, "place": "pond"? },
          "transition": "fade" | "white" | (없음 = 바로),
          "music": "evening" | "auto" | "stop" | (없음 = 그대로),
          "sfx": "door"?, "caption": "{island} 축제"?, "wait": true?, "photo": true?,
          "goto": "c6" | "end"?,      // 끝나면 다음 컷 대신
          "choice": { "options": [{ "emote": "✌️", "goto": "c3" }, …] }?,   // 플레이어가 이모티콘을 고른다 (2~4개)
          "actors": [
            { "who": "coco", "at": [-2.2, 1.8], "to": [x, z]?, "do": "idle|walk|run|happy",
              "face": 180 | "camera" | "player" | "<slug>" | [x, z],
              "emote": "👏", "text": "",     // 말풍선 = 이모티콘. text = 글 대사 칸 (지금은 비워 둠)
              "hide": true?, "optional": true? }   // optional = 모델이 없으면 빼고 튼다 (단풍처럼 다른 트랙이 만드는 중)
          ] }
      ] }
  ]
}
```

- 좌표: 기준 자리에서 x 동쪽+, z 남쪽+ (칸). `face` 숫자는 `player.facing` 과 같은 뜻의 도(0 북 · 90 서 · 180 남 · -90 동). 카메라 `angle` 0 = 대상 남쪽에서 북쪽을 봄(게임 기본 카메라 쪽), 180 = 북쪽에서.
- 카메라 크기 `wide full group medium close overhead`, 움직임 `static push pull orbit crane pan`(pan = 앞 컷 끝 카메라에서 이어 옮기기). 대상 = 배우 slug · `place` · `group`(보이는 배우 가운데) · `[x, z]`. 대상이 배우면 걸어도 따라간다.
- 배우는 장면 안에서 이어진다: 한 번 놓으면 다음 컷에도 그 자리. `to` 를 주면 그 컷부터 일정한 빠르기(걷기 2.1·달리기 4.2칸/초)로 가고, 컷이 바뀌어도 도착할 때까지 간다. 말풍선은 컷마다 새로.
- 글 자리: `{player}` `{island}` (intro 가 조사까지 채움), 트리거 내용 `{part.emoji}` `{part.name}` `{n}`.

## 트리거 (`rules.TRIGGERS`)

| on | 듣는 이벤트 | 조건 | 쓰는 장면 |
|---|---|---|---|
| `newgame` | `intro:named` | `renamed` 가 아님 | s01 섬에 도착 |
| `guide-done` | `town:intro` | `done` | s02 오늘 할 일 시작 |
| `firstday-done` | `intro:reward` | | s03 첫날을 마치고 |
| `newday` | `data:newday` | `trigger.scene` 을 본 뒤 | s04 멈춘 축제 |
| `festival-part` | `festival:part` (Z5) | `n` 이 같음 | s05~s09 부품 1~5 |
| `festival` | `festival:start` (Z5) | | s10 섬 축제 |
| `after` | `story:end` | `id` = `trigger.scene` | s11 단체 사진, s12 섬 생활은 계속 |
| `manual` | — | `story.play(id)` 로만 | |

## 재생기 (`ctx.services.story`)

```js
play(id, { take?, vars? }) → Promise<{ id, take, skipped }>   // 이미 틀고 있으면 null
preview(sceneObject, take?)       // 편집기에서 고친 장면 객체를 바로 (본 기록 안 남김)
stop()  playing → { id, take, shot } | null   queue   scenes()   scene(id)   index()   seen(id)   reset(id?)
```
이벤트: `story:start {id, take}` · `story:shot {id, take, shot, index}` · `story:choice {id, shot, emote, index}` · `story:end {id, take, skipped}`. 상태 `state.story = { seen: { 장면id: dayKey } }` (story 주인).

- **언제 트나**: 트리거가 오면 줄을 세우고 0.5초 뒤, 창·대화·이름 정하기·도구 동작·집 안이 아닐 때. 장면이 끝나면 `story:end` → `after` 장면이 바로 이어진다 (건너뛰어도).
- **장면 동안**: 플레이어 `freeze`, HUD 숨김, 첫날 목록·주민 이름표 숨김(`body.story-on`), 위아래 띠. **`ui.isBlocking()` 을 감싸서 true** → 주민 자동 대화·행동 키·채집이 창이 열린 것처럼 기다린다 (intro 가 `ui.dialog.open` 을 감싸는 것과 같은 방식, 아래 H2 가 정식 갈고리). 그래서 A·Space 는 story 가 `input:press` 를 직접 듣는다 (넘기기·고르기), Esc·건너뛰기 단추 = 장면 건너뛰기.
- **배우**: 장면마다 `town/actor.js` 의 `createActor` 로 만든 복제(한 번 만들면 계속 씀, 이름 `story:<slug>`). 같은 slug 의 town 주민·가게 주인은 장면 동안 숨긴다. 주인공이 나오면 진짜 플레이어(`scene` 의 `player`)를 숨기고 복제를 쓴다.
- **카메라**: gameplay 는 player 다음에 돌므로 매 프레임 player 카메라를 덮어쓴다. 곡면 세기 0.0026, `ctx.focus` = 바라보는 곳. 끝나면 `player.camera.snap`.
- 창이 숨겨져 rAF 가 멈추면 재생도 멈춘다 — 확인은 `__island.step(1/30)` 을 돌리면서 (`story.debug()` 로 진행 보기).

## 시나리오 편집기 (`story-editor.html`)

타임라인(처음 → 엔딩 뒤, 점선 = 지금 있는 흐름) · 장면 정보(제목·장·장소·줄거리·트리거·끝 자리) · **연출안 고르기**(A/B/C, 추천, 이름·설명 고치기, 복제·빼기) · **스토리보드**(컷마다 게임과 같은 카메라 계산으로 그린 스케치 + 위에서 본 지도, 카메라·배우·이모티콘·글 칸·자막·전환·음악·고르기 갈래, 컷 더하기·빼기·순서) · **▶ 스케치로 보기**(컷 길이대로 움직이는 미리 보기, 고르기는 눌러서) · 의견 칸 · 반영 상태(마지막 반영 버전·바뀐 것·반영 요청 표시·반영 기록과 되돌리기 요청).

저장소 (db, 컬렉션/문서):

| 문서 | 내용 | 쓰는 쪽 |
|---|---|---|
| `drafts/<장면 id>` | `{ sceneId, scene: 장면 객체 전체, note, removed, updatedAt, updatedBy }` — 고친 장면 (새 장면도) | 편집기 |
| `timeline/main` | `{ rows: index.json 의 timeline 모양, status: 'editing'\|'requested', rollback?: 버전, requestedAt }` | 편집기 |
| `applied/story` | `{ version, appliedAt, summary, commit, scenes: {id: version}, picks: {id: key}, notes: {id: 글} }` | Claude (쓰기 admin) |
| `history/story-v<n>` | `applied` 와 같은 모양 + `board: 'story'` | Claude (쓰기 admin) |

"바뀐 것" = 편집기에 들어 있는 파일(게임에 들어간 장면)과 drafts 의 장면이 다름 · 의견이 `applied.notes` 와 다름 · 순서가 다름. 로컬 dev-server 에서는 `/api/db/story-<컬렉션>` (파일 `assets/review/story-*.json`, gitignore) 로 흉내 낸다.

## "시나리오 반영" (Claude 가 하는 일)

1. ArtifactData `list` 로 편집기의 `drafts`·`timeline` 을 읽고, `get applied/story` (없으면 v0).
2. drafts 의 `scene` 마다 `assets/story/scenes/<id>.json` 과 비교해 바뀐 장면만 고른다. 바뀐 게 없고 의견도 그대로면 그렇게 알리고 끝.
   - **고침**: 장면 파일을 drafts 내용으로 바꾸고 `version` +1, 확정(`approved`)이던 장면은 `review` 로.
   - **새 장면**: id 를 이름에 맞게 정해(`s13-…`) 파일을 만들고, `index.json` 타임라인·`files.js` 의 `SCENE_FILES` 에 넣는다. **뺀 장면**(`removed`): 파일·목록에서 뺀다.
   - **순서**: `timeline.rows` 를 `index.json` 에 (files.js 순서도 같이).
   - **의견**: 그 장면의 컷·연출안을 의견대로 고치거나, 새 연출안(다음 글자)으로 더해 사용자가 고르게 한다. 고친 뒤 무엇을 했는지 `reply` 대신 반영 요약에 적는다.
   - **되돌리기**: `timeline.rollback = n` 이면 `history/story-v<n>.commit` 의 `assets/story/` 로 되돌린다 (`git checkout <commit> -- assets/story src/gameplay/story/files.js` 뒤 커밋). 무엇을 되돌리는지 먼저 보여 준다.
   - 다른 트랙 갈고리가 필요한 고침(새 트리거 이벤트 등)은 아래 '갈고리 제안' 에 적는다.
3. `node --test tests/` (`story.test.mjs` 가 모양·목록·이어짐을 본다).
4. 재생기로 확인: dev-server `--port=4216` → `/index.html?story=<id>&take=<key>`, 바뀐 장면을 끝까지 (`story.debug()` · `__island.step`), 스크린샷 한두 장.
5. 커밋 (`story` 브랜치). 커밋 해시를 적어 둔다.
6. 편집기를 같은 아티팩트에 다시 게시: `file_path: story-editor.html`, 바뀐 파일만 `files` 로 (장면 json·index.json·files.js·rules.js). capabilities 는 생략(그대로).
7. `applied/story` 를 `version + 1` 로 (`scenes`·`picks`·`notes`·`summary`·`commit` = 5의 해시), 같은 내용 + `board: 'story'` 로 `history/story-v<새 버전>`. `timeline/main` 의 `status` 는 `editing`, `rollback` 은 지운다.
8. 게임 링크 게시는 조정 세션이 main 에 합친 뒤 (이 브랜치는 커밋만).

## 반영 기록

| 버전 | 날짜 | 내용 | 커밋 |
|---|---|---|---|
| v0 | 2026-10-29 | 첫 초안 12장면 (status draft) | 4f90074 |
| v1 | 2026-10-29 | **추천안 A 로 12장면 모두 임시 확정** (status approved, 사용자: "향후 변경될 수 있음"). 고치면 그 장면 version +1 · status review | (이 표 다음 커밋) |

## 첫 시나리오 초안 (v0, 12장면)

| # | 장면 | 트리거 | 연출안 (★ 추천) |
|---|---|---|---|
| 01 | 섬에 도착 | 새 게임 | ★A 선착장 마중 · B 하늘에서 내려오기 · C 짧게 인사만 |
| 02 | 오늘 할 일 시작 | 밤톨 첫 안내 끝 | ★A 섬을 한눈에 · B 연출 없음 |
| 03 | 첫날을 마치고 | 밤톨 선물 뒤 | ★A 주민들의 박수 · B 밤톨과 둘이서 · C 한 컷 축하 |
| 04 | 멈춘 축제 | 03 본 다음 날 | ★A 아침 광장 모임 · B 박물관 옛 사진 · C 주민 한 명씩 걱정 |
| 05~09 | 부품 1~5 | 축제 부품 n개째 | ★A 부스에 불 / 주민이 도우러 / 음악 연습 / 등불 시험 / 모두 모였다 · B 짧게 한 컷 · (07) C 나도 같이 (고르기) |
| 10 | 섬 축제 | 축제 시작 | ★A 등불 축제 (북·불꽃 고르기) · B 낮 퍼레이드 · C 무대에서 시작 신호 |
| 11 | 단체 사진 | 10 뒤 | ★A 광장 무대 앞 두 줄 (포즈 고르기 → 셋·둘·하나 → 찰칵) · B 노을 선착장 · C 내 집 앞 소박하게 |
| 12 | 섬 생활은 계속 | 11 뒤 | ★A 섬 곳곳 훑기 · B 다음 날 아침 집에서 · C 바로 돌아오기 + 편지 |

자막은 섬 이름 카드(`{island}`)·부품 수(`🧩 n/5`)·사진 글·마지막 한 줄만. 대사는 모두 이모티콘, 글 칸은 비워 둠.
자리 값은 지금 광장(모닥불 0,0 · 벤치 ±2,1 · 가로등 ±2,±3 · 안내판 0,-2)에 맞춘 초안 — Z5 축제 광장이 생기면 `event` 자리가 그쪽으로 옮겨 가니 다시 맞춘다.

## 갈고리 제안 (다른 트랙 파일 — 합칠 때 반영)

- **H1 · intro** (`src/gameplay/intro/index.js`): s01 을 *이름 정하기 전* 배에서 도착으로 하려면, `game:ready` 에서 `askNames()` 전에 `ctx.services.story?.play('s01-arrival')` 을 기다리는 선택(트리거 `newgame` 을 `game:ready`+이름 없음으로). 지금은 이름을 정한 뒤 틀린다 (연출안 A 가 여기에 맞춰져 있음).
- **H2 · town** (`keepers.js` 첫 안내 자동 시작·`celebrateFlow`, `villager.js` 자동 말 걸기): `ctx.services.story?.playing` 이면 기다리기. 들어오면 story 의 `ui.isBlocking` 감싸기를 지우고 디스패처 처리기(우선순위 1000)로 돌아간다.
- **H3 · town 편지** (s12-C): `story:end {id: 's11-ending-photo'}` 를 듣고 주민들이 축하 편지 `mail.post(slug, 'festival')`.
- **H4 · Z5 축제** (`docs/notes/z5-festival.md` 와 맞출 것):
  - 이벤트 `festival:part { n, total: 5, id, name, emoji, x?, z? | booth: {x, z} }` — 부품을 놓은 순간. story 가 `{part.emoji}`·`{part.name}`·`{n}` 을 채우고 `event` 자리 = `booth` 또는 `x,z`.
  - 이벤트 `festival:start {}` — 축제가 시작될 때 (s10 → s11 → s12 는 story 가 이어서 튼다). 사진 장면이 끝나면 `story:end {id: 's11-ending-photo'}` 로 축제 쪽 정리(엔딩 뒤 상태 플래그 등).
  - 장소 `world.places.festival` 이 생기면 `event` 기본 자리로 쓴다 (없으면 광장).
  - 부품 장면 동안 부스 공개 연출은 Z5 가 `story:end` 를 듣고 시작하면 겹치지 않는다.
  - **이모티콘 팔레트**: Z5 검수 보드에서 대화 방식·팔레트가 정해지면 `rules.EMOTES` 를 그 목록으로 바꾸고, 말풍선 모양도 Z5 대화 말풍선과 맞춘다 (`layer.js`·`story.css`). 이모티콘을 id 로 정하면 `emote` 값을 id 로 두고 `ctx.services.emote?.glyph(id)` 로 바꾸는 한 줄을 넣는다.
- **H5 · Z4 이사** (`p8-town`): 단풍(`danpung`)은 `optional` 배우로 s10·s11 에 넣어 둠 — 모델이 없으면 빠진다. 이사 장면을 스토리로 만들려면 `town:movein {slug}` 같은 이벤트를 주면 트리거를 더한다.
- **H6 · 웹 빌드**: 장면 파일은 `files.js` 의 글자 목록으로 묶인다 (도구 수정 없음). 편집기는 게임 빌드와 따로 게시.
- **H7 · CONTRACTS**: 위 '재생기' 절의 서비스·이벤트·상태 칸(`state.story`)을 합칠 때 약속 문서에 옮긴다.

## 아직 안 한 것

- 진짜 축제 부품·축제 이벤트가 없어 s05~s10 은 `?story=` 로만 틀어 봤다 (부품 그림은 기본 🎁).
- 장면 동안 상점·박물관 창 단축키(I·P·M)는 ui 가 따로 받아서 열릴 수 있다 (H2 와 같이 ui 가 `story.playing` 을 보면 막힌다).
- 장면 시작 대기열은 저장하지 않는다 (집 안에서 부품을 얻고 바로 새로고침하면 그 장면은 다음 트리거까지 안 나온다).
