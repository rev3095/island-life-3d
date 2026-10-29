곡 편집기(아티팩트): https://claude.ai/artifact/MDYGS6UsDmmBJXTu9c8qY2 — `sound-editor.html`, capabilities `db`(applied·history 쓰기 admin)·`user`, 반영 기록 v0 = 커밋 f3bb3ce

# M6-P4 곡·효과음 (ET-06 · ET-07) — 소리를 데이터로, 곡 편집기, "소리 반영"

검수 보드 wave6 반영 v1 의 D31-A(곡 편집기 + 효과음 표). 브랜치 `p9-sound`.

## 한 것

- 코드 안에 있던 배경음 9곡(`songs.js` 의 값·악보), 효과음 24종(`sfx.js` 의 레시피·크기), 주민 목소리 9종(`voice.js` 의 VOICES), 언제 어느 곡을 틀지(`index.js` 의 trackForHour·rain·상점/박물관 창)를 **`assets/sound/` JSON** 으로 옮겼다. 보드에는 효과음 16종이라고 적혀 있었지만 실제 코드는 24종이라 24종 모두 옮김.
- 소리는 옮기기 전과 같다: 곡마다 두 바퀴 음 나열(5379음)이 **정확히** 같고, 효과음은 Web Audio 노드 기록(만들기·값·시작/멈춤, 10자리)이, 목소리는 말하기 계획이 같다. `tests/sound.test.mjs` 의 지문 표가 이것을 계속 지킨다.
- 곡 편집기 `sound-editor.html` (새 아티팩트) + "소리 반영" 도우미 `tools/apply-sound.mjs`.

## 파일 (새 JSON 12개)

| 파일 | 내용 |
|---|---|
| `assets/sound/index.json` | `songs` (곡 id 순서) · `schedule` (언제 틀까) · `fade` (넘어가는 초) |
| `assets/sound/songs/<id>.json` | 곡 하나 (9개). 파일 하나로 바꿔 끼운다 |
| `assets/sound/sfx.json` | 효과음 표: `sfx.<이름> = { label, trim(dB), pitch, length, layers }` · `jitter` |
| `assets/sound/voices.json` | 목소리 표: `voices.<id> = { name, desc, f0, syl, gap, formant, jitter, wave, gain, droop·bounce·croak·crisp }` |

`src/audio/files.js` 에 파일 경로를 **글자로** 적어 둔다 (웹 빌드가 이 글자로 묶음 — 스토리 `files.js` 와 같은 방식). 곡을 더하면 여기도 (`apply-sound.mjs` 가 알아서 고친다). 파일은 모두 `formatJSON` 모양(짧은 묶음은 한 줄)으로 쓴다 — 테스트가 본다.

### 곡 데이터

```
{ id, version, code: "BGM-01", title, mood, bpm, meter(한 마디 박 수), bars, swing?, gain, room(small|medium|large|hall), key, scale(major|pentatonic|minor|minorPenta),
  arrange(반주 모양), vibrato?{rate,cents}, radio?{low,mid,midGain,high,drive}, loops?[{kind:"rain"|"hiss", …}],
  channels: { 채널: { label, gain, pan, verb } },
  parts: { 파트: { label, inst, ch, vel?(세기 배율), octave?, on?(false = 끔), opts?(패드 attack·release·cutoff 등) } },
  prog: ["화음 | 화음 | …"], mel: ["음이름:박자 … | …"] }
```

- **반주 모양**(`arrange`)은 코드에 남았다 (`src/audio/songs.js` 의 `ARRANGE`, 9가지 = 처음 쓴 곡 이름). 마디마다 어떤 파트가 어느 박에 무엇을 치는지 = 배경 빌더의 `kind → BUILDERS` 와 같은 생각. 반주 모양마다 필요한 파트 이름은 `ARRANGE_PARTS`.
- 반주 모양은 `s.play(파트, 음, 박, 길이, 세기, 옵션)` 로 부르고, 악기·채널·세기·옥타브·끄기는 그 파트 데이터에서 온다. 끈 파트도 난수는 똑같이 써서 다른 파트의 흔들림이 안 바뀐다. 플루트 파트에는 곡의 `vibrato` 가 저절로 붙고, 패드가 아닌 악기로 바꾼 화음 파트는 음마다 따로 친다.
- 변주 규칙의 "곡 뒤쪽 절반"(`i >= 8`)은 `bars / 2`, "온 마디 화음"(`dur === 4`)은 `meter` 로 바꿔 적었다 (지금 곡들은 값이 같아 소리 그대로).
- 틀린 데이터는 `buildSong` 이 한국어로 알려 준다 (예: `새벽: 멜로디가 3박이에요 (16마디 × 4박 = 64박)`). 게임은 틀린 곡만 빼고 경고.

### 효과음 층

`layers` = `tone`(사인·삼각파, f→to) · `noise`(거른 잡음) · `sweep`(휘는 잡음) · `bubble`(물방울) · `note`(악기 음) · `buzz`(벌). `f`·`to`(·`mid`·`end`)는 높이를 따라가고 `keep` 에 적은 칸은 그대로, `[a, b]` = 부를 때마다 a~b 사이, `n`·`every` = 여러 번. 효과음마다 `pitch`·`length`·`trim` 이 편집기의 높이·길이·크기.

### 언제 틀까 (`index.json` 의 `schedule`)

| 칸 | 뜻 |
|---|---|
| `time: [{ part, label, from, song }]` | from 시부터 다음 줄 전까지. 첫 줄보다 이른 시각은 마지막 줄(밤) |
| `weather: { 날씨: 곡 \| '' }` | sky 의 `WEATHERS` 5개. `''` = 시간대 곡 |
| `places: { indoor: 곡 \| '' }` | 다른 모듈이 `bgm(이름)` 으로 부르는 자리. house·visit 가 `bgm('indoor')`. `''` = 바깥처럼 자동 |
| `panels: { shop, museum }` | `ui:open {panel}` 동안 트는 곡 |

고르는 순서는 예전과 같다: 열린 창 > `bgm(이름)`(이름이 places 에 있으면 그 자리 곡, 아니면 곡 id) > 날씨 > 시간대. 라디오는 house 가 곡 id(`dawn`…`night`)를 직접 부른다.

### 새 곡 · 새 상황 더하기 (예: Z5 축제 무대·등불 축제·엔딩 사진)

- **새 곡**: `assets/sound/songs/<id>.json` 하나 + `index.json` 의 `songs` 에 id + `src/audio/files.js` 의 `SONG_FILES` 에 경로. 있는 반주 모양(`arrange`)을 쓰면 코드는 안 고친다 (편집기 "복사해서 새 곡" → "소리 반영" 이면 `apply-sound.mjs` 가 세 곳을 다 고친다). 새 반주 모양이 필요하면 `songs.js` 의 `ARRANGE` 와 `ARRANGE_PARTS` 에 한 칸씩.
- **새 상황**: `index.json` 의 `schedule.places` 에 이름 한 칸 (`"festival": "festival-stage"`, `"ending": "ending-photo"`) → 그 모듈이 들어갈 때 `ctx.services.audio.bgm('festival')`(또는 `events.emit('bgm', { name: 'festival' })`), 나올 때 `bgm('auto')`. 곡을 바꾸고 싶으면 표만 고치면 되고 코드는 그대로 (편집기 "언제 틀까" 의 자리 목록에 저절로 나온다 — 화면 이름은 `sound-editor.html` 의 `PLACE_LABEL` 에 한 줄, 없으면 키 그대로). 창을 여는 동안만이면 `panels` 에 (`ui:open { panel }`). 장면(컷신)도 `shot.music` 에 자리 이름을 쓸 수 있다.
- 주의: `bgm(이름)` 은 "직접 고른 곡" 한 자리뿐이라 나중 부른 것이 이긴다. 축제 중에 장면이 끝나면 story 가 `bgm('auto')` 를 보내므로, 축제 쪽은 `story:end` 때 `bgm('festival')` 을 다시 부른다.

## 코드 바뀐 곳 (`src/audio/`)

- `bank.js` (새): `loadSound(load)` → `installSound(data)` (곡·효과음·목소리·선곡 표에 넣음, 문제 목록), `SCHEDULE`·`slotForHour`·`autoSong`, `formatJSON`. DOM·Web Audio 없음 → node·편집기·게임이 같이 쓴다.
- `songs.js`: `buildSong(json)`·`setSongs`·`setSong`·`ARRANGE`·`ARRANGE_PARTS`·`ROOMS`, `SONGS`·`TRACKS` 는 데이터를 읽으면 채워지는 표.
- `music.js`: `play(name, { restart, from })` (편집기에서 고친 곡을 그 마디부터), 파트 `play()`.
- `sfx.js`·`voice.js`: `SFX`·`VOICES` 표를 데이터로 채움 (`setSfx`·`setVoices`), `playSfx(engine, name, opts, def?)`.
- `index.js`: 모듈 `init` 이 **async** — `core/assets.js` 의 `loadJSON` 으로 데이터를 다 읽은 뒤 끝난다 (P0 묶음 파일·로딩 화면 진행이 거기 있으니). `assets.js` 를 못 부르는 페이지(demos)는 `fetch` (경로는 이 파일 자리 기준). 바깥에서 보이는 서비스(`bgm`·`sfx`·`speak`…)는 그대로 + `load()`.
- `instruments.js`: `INSTRUMENT_INFO` (편집기용 이름·종류: tone 끼리·hit 끼리만 바꿔 끼움, nature 는 고정).
- `notation.js`: `SCALES`·`keyToPc`·`minor`·`minorPenta`.

## 곡 편집기 `sound-editor.html`

탭 넷 + 아래 듣기 막대 (브라우저 소리는 단추를 누른 뒤에만):
- **곡**: 곡 목록(틀 때 표시) → 빠르기·박자·마디 수·스윙·크기·울림·조성·반주 모양, 악보 띠(마디를 누르면 그 마디부터), 멜로디·화음 글, 파트(악기·세기·옥타브·켜기), 채널(크기·좌우·울림), 의견. 고치면 듣던 마디부터 바로 다시. "두 번째 바퀴부터", "원래대로", "복사해서 새 곡".
- **언제 틀까**: 하루 24시간 띠(맑음·비·눈), 시간대(시작 시각·곡) · 날씨 · 집 안 · 상점/박물관 창.
- **효과음**: 24종 ▶ · 높이 · 길이 · 크기(dB) · 원래대로 · 소리 층 보기 · 의견.
- **목소리**: 9명 ▶(들어 볼 말) · 높이 · 글자 길이 · 크기 · 글자 사이 · 입 크기 · 흔들림 · 의견.

게시 파일: 페이지 + `src/audio/` 9개(engine·music·songs·sfx·voice·instruments·notation·bank·files) + `assets/sound/` 12개 = 22개. 로컬: `node dev-server.mjs --port=4224` → `/sound-editor.html` (저장은 `assets/review/sound-*.json`).

### 저장소 (db) 모양

| 문서 | 누가 | 내용 |
|---|---|---|
| `drafts/song-<id>` | 편집기 | `{ kind:'song', id, song(고친 곡 전체 \| null), isNew, removed, note, sid, updatedAt, updatedBy }` |
| `drafts/schedule` | 편집기 | `{ kind:'schedule', schedule, note }` |
| `drafts/sfx` | 편집기 | `{ kind:'sfx', changes: { 이름: { pitch, length, trim } }, notes: { 이름: 글 } }` (바뀐 것만) |
| `drafts/voices` | 편집기 | `{ kind:'voices', changes: { id: { f0, syl, gain, gap, formant, jitter } }, notes }` |
| `requests/sound` | 편집기 | 반영 요청 표시 `{ status:'requested', at, by, changed[], rollback? }` |
| `applied/sound` | Claude | 마지막 반영 `{ board:'sound', version, appliedAt, summary, commit, branch, changed[], notes{}, files{경로: version} }` |
| `history/sound-v<n>` | Claude | 반영 기록 (applied 와 같은 모양) |

편집기는 파일(=게임에 들어간 것)과 초안을 비교해 "바뀐 것"을 보이고 (곡은 `version` 만 다른 건 같은 것으로), 의견은 `applied.notes` 와 비교한다. `commit` = **그 버전의 `assets/sound/` 가 들어 있는 커밋** (되돌릴 때 여기서 꺼낸다). 반영 기록 모양은 검수 보드(`concept/README.md`)와 같고, M6-P1 의 공용 모양(`changed` 목록)을 따른다.

## "소리 반영" (Claude 가 하는 일)

1. ArtifactData `list` 로 `drafts` 와 `requests`, `get` 으로 `applied/sound` 를 읽는다 (편집기 링크는 이 파일 첫 줄). 초안을 파일로 저장: `list` 결과의 행 배열(각 행의 `data`)을 `…/scratchpad/sound-drafts.json` 에.
2. `node tools/apply-sound.mjs <초안.json> --dry` 로 바뀔 것을 본다 → 바뀐 게 없고 새 의견도 없으면 그렇게 알리고 끝.
3. `node tools/apply-sound.mjs <초안.json>` — 곡(`version` +1, 새 곡은 파일 + `index.json` + `files.js`), 언제 틀까·효과음·목소리(그 파일 `version` +1). `buildSong` 검사에 걸린 곡은 넣지 않고 "넣지 못한 것"으로 알려 준다 → 사용자에게 고칠 곳 전달.
4. **의견**은 도우미가 모아 보여 준다 → 직접 고친다: 데이터로 되는 것(값·악보)은 그 파일을, "새 반주 모양"·"악기 음색" 같은 것은 `src/audio/songs.js` 의 `ARRANGE`·`instruments.js` 를 고친다. 코드를 고쳐 **고치지 않은 곡의 소리까지 바뀌면** 지문 테스트가 잡는다 — 일부러 바꾼 것이면 `SOUND_FP=print node --test tests/sound.test.mjs` 로 찍어 `FINGERPRINTS` 에 붙인다.
5. `node --test tests/` → dev-server 의 `/sound-editor.html`·`/index.html` 에서 바뀐 곡·효과음을 들어 본다 (콘솔 오류 없음).
6. 커밋 (`assets/sound/` + 고친 코드) → 그 커밋 해시를 `commit` 으로.
7. 편집기 다시 게시: 같은 `file_path: sound-editor.html`, `files` 에 **바뀐 파일만** (새 곡이면 `src/audio/files.js` 도). capabilities 는 생략(그대로).
8. 반영 기록: `applied/sound` 를 `version + 1` 로(`summary`·`commit`·`changed`·`notes`·`files`), 같은 내용으로 `history/sound-v<새 버전>`, `requests/sound` 는 `{ status: 'editing' }`. 한 번의 batch 로.
9. 게임 링크 다시 게시는 D35-A 대로 반영 때마다 — 단 합치기·게임 게시는 조정 세션이 (main 에 합친 뒤 `node tools/build-web.mjs`).

**되돌리기** (`requests/sound.rollback = n`): `history/sound-v<n>.commit` 에서 `git checkout <commit> -- assets/sound/ src/audio/files.js` → 사용자에게 무엇이 돌아가는지 보여 주고 → 4~8 과 같이 (새 버전 번호로, summary 에 "v<n> 로 되돌림"). 편집기의 초안은 되돌린 파일과 같아지므로 "바뀐 것" 이 비게 된다 (안 비면 그 초안을 편집기에서 "원래대로").

## 확인

- `node --test tests/` — 207개 중 205 통과. **실패 2개는 `build-web` 의 파일 수 한계**: 게임 게시본이 510 → 524 파일(새 JSON 12 + `bank.js`·`files.js`)이 되어 아티팩트 한 버전 한계 511 을 넘는다. **M6-P0(`p9-pack`) 묶음 파일을 먼저 합치면 풀린다** (이 브랜치는 P0 다음에 합친다). `tests/sound.test.mjs` 10개는 모두 통과 — 도우미로 초안을 넣은 뒤(고친 데이터)에도 통과하는 것까지 확인.
- dev-server 4224: 게임 `/index.html` — `[boot] audio 준비됨`, 받기 실패 0, 콘솔 오류 0, 클릭 뒤 소리 켜짐·21시 `night` 곡, 효과음 이벤트, 상점 창 → `shop`, `bgm('indoor')` → `indoor`, `setWeather('rain')` → `rain`, 눈 → 시간대 곡. `/demos/audio.html` — 곡 9 · 효과음 24 · 목소리 9 읽음.
- 곡 편집기 로컬: 듣기(재생 막대 움직임), 빠르기·악기 바꾸면 듣던 곳에서 바로 다시, 틀린 악보 → 한국어 오류, 저장 → 새로 고침 뒤에도 남음, 효과음 6종·목소리 재생 뒤 노드가 0으로 돌아옴. 게시본: 저장소 `drafts` 읽기(비어 있음), `applied/sound`·`history/sound-v0` 쓰기, 보기 권한으로 `applied/sound` 읽힘.
- 못 한 것: 실제 귀로 듣기(합성 결과가 같다는 건 노드 기록으로만), claude.ai 게시본에서 직접 소리 내 보기·저장(사용자), 휴대폰 화면.

## 다른 트랙에 제안

1. **조정 세션 · M6-P0**: 이 브랜치는 P0 다음에 합친다 (위 build-web 실패). 소리 데이터는 게임에서 `assets.js` 의 `loadJSON` 으로 읽으니, P0 이 `loadJSON` 을 묶음에서 꺼내게 하면 그대로 된다. 경로 글자는 `src/audio/files.js`.
2. **`docs/CONTRACTS.md` 끝 "리소스 교체 약속"** 에 소리 절을 더하면 좋겠다: "곡 = `assets/sound/songs/<id>.json` 하나(반주 모양의 파트가 다 있고 악보 길이 = 마디 × 박), 목록은 `index.json` + `src/audio/files.js`, 효과음·목소리는 표 한 칸, 선곡 표의 곡은 모두 있어야 — `tests/sound.test.mjs`". 그리고 `audio` 서비스 약속에 `bgm(이름)` 의 자리 이름(places, `indoor`)과 `init` 이 데이터를 다 읽고 끝난다는 것.
3. **M6-P1 편집기 홈 (`editors.html`)**: 소리 편집기 카드 — 링크는 이 파일 첫 줄, 반영 기록 id `sound` (`applied/sound`, `history` 의 `board == 'sound'`), 채팅 명령 "소리 반영". 공용 `ApplyLog` 가 합쳐지면 편집기의 반영 상태 칸을 그걸로 바꿔도 된다 (모양은 이미 같음).
4. **town**: 단풍(`danpung`)은 `people.js` 에서 코코 목소리를 빌려 쓴다. 단풍 목소리를 따로 두려면 `voices.json` 에 `danpung` 한 칸 + `people.js` 의 `voice: 'coco'` 를 빼면 된다 (편집기 의견으로 받아도 됨).
5. **devlog 「게시물」 표**에 곡 편집기 줄 (조정 세션이 합칠 때).
