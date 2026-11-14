# M19-P5 추억 다시 보기 · 새 주민 이사 연결 (브랜치 `m19-p5-memories`, 16차 보드 D205-A · D204-A)

작업 폴더 `../island-worktrees/m19-p5-memories`, 포트 4305, main 2bc7800 에서 갈라짐. 결정 D250–D256, 장면 s62–s65.

## 만든 것

| 무엇 | 파일 | 요점 |
|---|---|---|
| 섬폰 🎬 「추억」 UI-36 | `src/ui/album.js` (앨범 창에 칸 「📷 사진 · 🎬 추억」) · `src/ui/phone.js` 앱 한 줄 · `town/index.js` 한 줄 (`ui.memories`) | 본 장면을 묶음 셋(📖 이야기 · 🐾 주민 · 🍂 계절, 묶음마다 본 수/전체)으로. 본 칸 = 제목·본 날·「▶ 다시 보기」, 못 본 칸 = 「?」 + 힌트 한 줄. 누르면 섬폰·창을 모두 닫고(`ui.closeAll`, `ui/index.js` 한 줄) 재생 → 끝나면 앨범 추억 칸으로 돌아옴. 집 안·바닷속·무인도에서는 안 됨(알림) |
| 재생 전용 모드 | `src/gameplay/story/index.js` `story.replay(id, vars)` · `story.memories(opts)` | 본 기록·저장 줄 안 건드림(`finishSeen` 건너뜀), 장면 이벤트(`story:start|shot|choice|end`) 대신 **`story:replay {phase, id, …}` 만** 보냄 → 앨범 사진·② 답례·짝 화해 끝·축제 엔딩·`after` 트리거가 안 돈다, 재생 동안 `time.setPaused(true)` (시각 그대로), `playerEnd: 'stay'` 자리 옮기기 안 함 |
| 추억 규칙 (순수) | `src/gameplay/story/rules.js` `MEMORY_GROUPS` · `memoryGroup` · `memoryHint` · `memoryList` | 주민 = bond-tier · move-in · pair-makeup · song-first (+ 첫 만남 칸), 계절 = event-start · special-day · meteor-first · meteor-big · contest-first, 나머지 이야기. 힌트는 트리거마다 한 줄 (받침 조사) |
| 새 주민 이사 연결 | `town/moving.js` (`town:welcome` 에 `welcome` 칸) · `story/index.js` · `rules.js` `WELCOME_BASE` · `welcomeKey` · `welcomeTake` · `assets/villagers/{ssalal,boreum}.json` `welcome` 칸 | 이사 차례는 이미 `MOVERS` 끝(구름·파도·달무리 → 쌀알 → 보름, 7일마다, 섬 최대 12). 첫 만남 장면: 장면 파일 없이 **s17 을 배우만 바꿔** (`recastTake` + 주민 파일 `welcome.takes.<연출안>.<컷>` 의 말풍선·자막 덮기), 본 기록 `state.story.seen['welcome:<slug>']` |
| 사연 장면 4 | `assets/story/scenes/s62-ssalal-first-chair` · `s63-ssalal-cheek-seeds` · `s64-boreum-faded-photo` · `s65-boreum-trunk-song` · `index.json` · `story/files.js` · `story/editor-files.json` | P2 모양 그대로 (s47 틀: 연출안 A 다섯 컷 · B 두 컷, 마지막 사진 컷, status review, 글 칸 비움·자막 한 줄). ② 답례 `bond.js BOND_STORY` 쌀알 `seed.cosmos` · 보름 `furn.radio` |
| 스토리 편집기 | `story-editor/words.js` · `tools/apply-texts.mjs` (`TEXT_FILES` 에 `pairs` · `lighthouse`) · `assets/story/editor-files.json` | 「그 밖의 글」 탭에 **주민끼리 짝**(짝마다 묶음 💞 + 공통 말) · **등대 다시 켜기**(단계마다 + 공통 말) — 새 장면 s62–s65 는 「장면」 탭에 저절로 |
| 테스트 | `tests/m19-memories.test.mjs` (6) · `m19-stories.test.mjs` BOND_STORY 열둘 | |

### 장면 넷 (자막 줄거리)
| id | 주민 · 단계 | 자리 | 줄거리 |
|---|---|---|---|
| s62 부서진 첫 의자 | 쌀알 ① 친구 | 집 앞 | 처음 만든 의자 다리가 짧아 기우뚱 → 둘이 나무 대고 망치질 → 「하나, 둘, 셋… 안 흔들려쪼르!」 |
| s63 볼주머니 씨앗 | 쌀알 ② 단짝 | 집 앞 (노을) | 섬에 온 날부터 하루 한 알씩 모은 해바라기씨 → 반을 나눠 주며 같이 심자 (답례 코스모스 씨앗) |
| s64 빛바랜 사진 | 보름 ① 친구 | 집 앞 | 낡은 앨범 속 빛바랜 사진 — 바닷가 뒤 불 켜진 등대 (등대 BD-18 실마리) |
| s65 코로 부는 노래 | 보름 ② 단짝 | 광장 (저녁) | 코로 부는 옛 섬 노래, 처음엔 삑 → 다시 불자 광장에 퍼짐 (답례 라디오) |

## 결정 (추천안으로 정함)
- **D250-A** 「추억」은 새 창이 아니라 앨범 창의 칸 + 섬폰 🎬 앱(같은 창을 추억 칸으로 엶) — 새 JS 모듈 0 (게시 파일 수).
- **D251-A** 새 주민 첫 만남은 새 장면 id 없이 s17 배우 바꾸기 + 주민 파일 `welcome` (장면 id 범위 s62–s65 는 사연 넷). 글은 스토리 편집기 「주민」 파일 쪽에서 고친다(파일 칸 `welcome`, 지금 편집기 화면엔 안 보임 → 의견으로).
- **D252-A** 재생 전용 = 장면 이벤트를 아예 안 보내기 (듣는 쪽마다 막기보다 새는 곳이 없다). 대가: 재생 동안 행사·축제·밤 칸이 숨지 않고 그대로 보일 수 있음(보기만).
- **D253-A** 재생 동안 시계 멈춤 (`time.setPaused`) — 빠르게 ×12 에서 장면 30초면 게임 6분이 흐르던 것.
- **D254-A** 집 안·바닷속·무인도에서는 다시 보기 안 함 (장면 자리가 섬 밖이라 카메라·배우가 어긋남).
- **D255-A** 섬 최대 12명 그대로 — 쌀알·보름은 누가 떠나 집터가 빌 때 차례로 온다 (P1 노트와 같음). 투어 섬 초대(`M.invited`)로 먼저 올 수도 있음.
- **D256-A** ② 답례는 이미 있는 아이템 (새 모델 없이): 쌀알 코스모스 씨앗(사연 속 씨앗 나눔) · 보름 라디오(노래). 앨범 사진은 ① ② 모두.

## 확인
- `node --test tests/` — **607 중 606 통과 · 실패 0** (건너뜀 1 = 기존 리소스 편집기 옷 영역).

## 확인 안 한 것 (사용자 원칙: 플레이·스크린샷·브라우저 확인 없음)
- 게임 안에서 추억 칸 모양·다시 보기 재생·끝난 뒤 앨범으로 돌아오기·시계 멈춤 — 눈으로 안 봄.
- 쌀알·보름 첫 만남 장면(s17 배우 바꾸기)이 실제로 나오는지 — 섬 12명이라 누가 떠나야 해서 긴 플레이가 필요. 규칙 테스트만.
- s62–s65 카메라 각도·배우 자리 (s47 틀 그대로라 s65 광장은 자리 확인 필요).
- 스토리 편집기 「그 밖의 글」 짝·등대 탭 화면.
- 이 브랜치 게시 안 함 (조정 세션).

## 알려 둘 것
- s48 마지막 자막 「구름과 단짝가 되었어요」 등 P2 장면 ② 자막의 「단짝가」 → 「단짝이」 맞춤법 (P2 생성 글, 이번 범위 밖 — 스토리 편집기 검수 때 같이).
- 재생 중 `story:replay` 를 들어 HUD 칸(행사·축제·밤 칩)을 숨기고 싶으면 각 모듈 한 줄씩 (`events/index.js` · `festival/index.js` · `night/index.js` — P6 파일 겹침이라 안 함).

## 문서 세션이 반영할 문장
- CLAUDE.md 「주민과 더 가깝게 (M15…)」 절 끝 (P2 문장 뒤): **섬폰 🎬 추억 (M19-P5 UI-36, D205-A)**: 앨범 창 「🎬 추억」 칸(섬폰 🎬 앱도 같은 창)에서 본 장면을 이야기·주민·계절로 다시 본다 — `story.replay(id, vars)` 는 재생 전용(본 기록·저장 안 함, 장면 이벤트 대신 `story:replay` 만, 시계 멈춤), 못 본 칸은 「?」 + 힌트 (`story/rules.js memoryList·memoryHint`). 노트 `docs/notes/m19-p5-memories.md`.
- CLAUDE.md 「섬 꾸미기 · 이사 오가기」 이사 문장 끝: 엔딩 뒤 이사 차례 구름·파도·달무리 → 쌀알 → 보름 (섬 12명이라 뒤 둘은 집터가 빌 때). 장면 파일 없는 이사 주민의 첫 만남은 s17 배우 바꾸기 + 주민 파일 `welcome` (`story/rules.js welcomeTake`, 본 기록 `welcome:<slug>`).
- CLAUDE.md 「스토리와 "스토리 반영"」: 탭 「그 밖의 글」 = 밤 · 행사 · 투어 · 섬 일상 · **짝(`assets/town/pairs.json`) · 등대(`assets/lighthouse/lighthouse.json`)** (`texts/<pairs|lighthouse>` → `apply-texts.mjs`).
- `docs/notes/story.md` 장면 표에 s62–s65 (bond-tier 쌀알·보름), 트리거 표 move-in 줄에 「장면 없는 주민은 s17 + welcome」.
- CONTRACTS: 서비스 `story.replay(id, vars)` · `story.memories({welcomes, nameOf})` · `ui.memories.open()` · `ui.closeAll()`, 이벤트 `story:replay {phase: start|shot|choice|end, id, take, …}`, `town:welcome` 에 `welcome` 칸, 주민 파일 칸 `welcome {title, takes}`.
- PLAN M19-P5 → ✅ 와 브랜치 `m19-p5-memories`.
