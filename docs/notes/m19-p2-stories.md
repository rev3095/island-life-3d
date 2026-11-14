# M19-P2 주민 사연 장면 (브랜치 `m19-p2-stories`, 작업 폴더 `../island-worktrees/m19-p2-stories`, 포트 4302)

16차 검수 보드 wave16 (https://claude.ai/artifact/7vq1nQedDmmGB45RJGxTNU) **D201-A** — 주민 열 명 × 장면 둘(① 「친구」가 되는 날 · ② 「단짝」이 되는 날) = s33–s52. 줄거리 초안은 보드 「주민 사연 지도」(`concept/wave16-board.html` `STORIES`), 성격·말버릇은 `assets/villagers/<slug>.json`.

## 장면 20

| 주민 | ① 친구 (tier friend) | 자리 | ② 단짝 (tier close) | 자리 | ② 답례 |
|---|---|---|---|---|---|
| 보리 | s33 낮잠 자리 지키기 | 광장 | s34 섬에 온 날의 낮잠 | 집 앞 | 낮잠 방석 FU-105 |
| 초롱 | s35 개구리 합창단 | 연못 | s36 수다 뒤에 숨긴 고민 | 집 앞 | 💭 속마음 |
| 코코 | s37 섬 한 바퀴 기록 도전 | 선착장 | s38 쉬어 가는 법 | 집 앞 | 💦 땀 |
| 단풍 | s39 잃어버린 수집 수첩 | 집 앞 | s40 단풍의 작은 전시 (느루) | 박물관 앞 | ✨ 반짝 |
| 두부 | s41 오래된 낚싯대 | 연못 | s42 바다에 띄운 편지 | 선착장 | … 말줄임 |
| 모찌 | s43 시든 꽃밭 되살리기 | 집 앞 | s44 모찌의 꽃말 편지 (초롱) | 광장 | 꽃말 액자 FU-106 |
| 퐁 | s45 퐁의 첫 요리 대접 | 집 앞 | s46 할머니 요리책의 빠진 쪽 | 과수원 | 할머니 요리책 FU-107 |
| 구름 | s47 그림을 처음 보여 주는 날 | 집 앞 | s48 등대가 그려진 옛 그림 | 선착장 | 등대 그림 FU-108 |
| 파도 | s49 선착장 끝까지 헤엄 내기 | 선착장 | s50 남쪽 바다 이야기 | 집 앞 | ❗ 깨달음 |
| 달무리 | s51 낮에 깨어 있어 보기 | 광장 | s52 이름 붙인 별 | 박물관 앞 | 💤 졸음 |

- 트리거는 모두 `{ "on": "bond-tier", "slug": <주민>, "tier": "friend" | "close" }`, `status: review`, 연출안 둘 — **A 사연 따라가기 (5컷, 추천·pick)**: 넓게 → 다가가기 → 사연(넘기기 대기) → 풀림 → 사진 컷 · **B 짧게 두 컷**. 마지막 컷은 모두 `photo: true` (사진 틀 + 하얀 번쩍임).
- 대사 글 칸(`text`)은 다른 장면처럼 비워 두고, 줄거리는 자막(`caption`) 한 줄씩 — 주민 말끝(멍·개굴·냥·콘·…·깡·꽥·뭉·펭·부엉)을 넣었다. 글은 스토리 편집기 「장면」 탭에서 다듬는다.
- s48 의 등대 그림은 P4 「등대 다시 켜기」 시작 장면(구름의 옛 등대 그림)과 같은 그림 — P4 가 FU-108 을 소품으로 써도 된다.

## 만든 것

| 무엇 | 파일 | 요점 |
|---|---|---|
| 트리거 | `src/gameplay/story/rules.js` | `TRIGGERS['bond-tier']` (이벤트 `town:bond`, 그 주민 · 그 단계 이상), `BOND_TIERS`, `tierReached`, `bondPick` (아래), 자리 `PLACES.home` = 트리거 주민 집 문 앞, 검사(slug·tier) |
| 보내는 곳 | `src/gameplay/town/talk.js` | `tierUp` (단계가 올라 「○○와 친구가 되었어요」 알림이 뜨는 자리)에서 `town:bond {slug, tier: up, up}` · 대화가 끝날 때 `town:bond {slug, tier: 지금 단계, up: null}` (따라잡기, 같이 놀러 가는 대화면 안 보냄) |
| 줄 세우기 | `src/gameplay/story/index.js` | `town:bond` 만 `R.bondPick` 으로 거른다, 하루 기록 `state.story.bondDay`. 줄은 기존 `state.story.queue` 그대로 (새로고침해도 이어 튼다). 자리 `home` = `world.places.villagerHouses` 의 그 주민 문. `?story=s3x-…` 미리 보기도 그 주민 집. 같이 낚시·산책 중이면 사연 장면은 끝날 때까지 기다린다 |
| 사진 · 답례 | `talk.js` 끝 `createBondStories` (town/index.js 가 만들고 `update` 로 돌림, 서비스 `town.stories = { got(), emotes() }`) | 사진 컷이 시작되고 게임 시간 0.6초 뒤 `album.snap({kind:'story', who:[slug], title: 장면 제목})` (건너뛰면 끝난 자리에서 한 장). ② 가 끝나면 답례 — 가구는 가방(꽉 차면 그 주민 `pending`), 이모티콘은 `state.town.giftEmotes`. 한 장면에 한 번 (`state.town.storyGot`). 이벤트 `town:story {id, slug, tier, item?, emote?, photo, skipped}` |
| 답례 표 | `src/gameplay/town/bond.js` `BOND_STORY` · `bondReward` · `giftEmotes` | 순수 |
| 배운 이모티콘 | `src/gameplay/festival/talkui.js` (두 줄) | 이모티콘 대화 「감정」 칸 끝에 `state.town.giftEmotes` |
| 앨범 | `src/ui/album.js` (한 줄) | 사진 종류 `story: '🎬 주민 이야기'` |
| 가구 FU-105–108 | `assets/furniture/specs/{nap-cushion,flower-word-frame,grandma-cookbook,lighthouse-painting}.json` · `assets/blender/story_furniture.py` (`build_furniture.py` 한 줄) · `src/data/album-items.js` `STORY_FURN` (`items.js` 한 줄) | 출처 `story` (상점·나무 흔들기에 안 섞임), status **review** — 리소스 편집기에서 검수 |
| 장면 | `assets/story/scenes/s33-…s52-….json` · `assets/story/index.json` · `story/files.js` (끝에 20줄) · `assets/story/editor-files.json` | |
| 편집기 | `story-editor.html` (한 줄) | `bond-tier` 장면은 주민 slug·단계 칸 |
| 테스트 | `tests/m19-stories.test.mjs` (5) · `items.test.mjs`·`assets.test.mjs` 가구 76→80 | 열 명 모두 단짝인 저장도 하루 하나씩 20일 |

## 결정 (추천안으로 정함, D220–D229)
- **D220-A** 트리거는 새 이벤트 하나 `town:bond` (talk.js `tierUp` 자리 + 대화 끝). 편지·같이 하기·미술품·노래로 단계가 오른 경우는 talk 밖이라 바로 안 나오고, **다음에 그 주민과 말할 때** 따라잡기로 나온다.
- **D221-A** 자리: ① 은 그 주민이 자주 가는 곳(roam.haunts 중 광장·연못·선착장·박물관·과수원 — 바닷가·강·다리·꽃밭은 world.places 에 이름 자리가 없어 집 앞), ② 는 대개 집 앞(새 자리 `home`).
- **D222-A** 따라잡기(이미 친구·단짝인 저장): 그 주민과 대화가 끝나면 **하루 하나**, 낮은 단계(①)부터. 그날 단계가 올라 나온 사연이 있으면 따라잡기는 다음 날. 줄에 사연이 있으면 쉰다.
- **D223-A** ② 답례: 가구 넷(보리·모찌·퐁·구름) + 나머지 여섯은 **주민 대답 전용 이모티콘 여섯(EM-31–36 💭❗💦…💤✨)을 하나씩** 플레이어 이모티콘 「감정」 칸에 열어 준다 — 여섯이 딱 맞아서 기존 가구 대신 골랐다.
- **D224-A** 사진은 장면의 마지막 사진 컷(사진 틀·자막은 DOM 이라 안 찍힘), 앨범 종류 「🎬 주민 이야기」. ① ② 모두.
- **D225-A** 사연 장면은 같이 낚시·산책이 끝난 뒤에 튼다 (장면이 같이 하기를 「먼저 돌아감」으로 끊지 않게).
- **D226-A** 새 JS 모듈을 만들지 않았다 — 게시본 한 번에 올리는 파일 수가 지금 main 에서 255/256 이라 (`tests/build-web.test.mjs`) 모듈 둘을 더하면 넘는다. 답례 가구 표는 `album-items.js`, 사진·답례는 `talk.js` 끝에 붙였다.

## 확인
- `node --test tests/` — **582 중 581 통과 · 실패 0** (건너뜀 1 = 기존).
- 개발 서버 4302: `?story=s34-bori-first-nap` → 보리 집 문 앞(−13.5, 6.5)에서 다섯 컷 → 앨범 「섬에 온 날의 낮잠」(kind story) + 낮잠 방석 · `town:bond` 를 직접 보내 코코 ① (선착장) 줄 서기 · 같은 날 따라잡기는 쉼 · `state.story.queue` 에 저장 확인 · 연못(s35·s41)·박물관(s40) 자리 확인 (연못은 처음에 물 위에 서서 동쪽 둑으로 옮김).
- 자동 플레이 `node tools/playtest.mjs --port=4302` (전체, 1388초): **28✅ 4🟡 2⛔**. 사연 장면은 단계가 오를 때마다 실제로 나왔다 — ① 열 중 여덟(코코·모찌·퐁·초롱·두부·단풍·보리 …)·② 여섯(초롱·코코·모찌·퐁·단풍·보리 …), 장면마다 앨범 사진, 답례 💭·💦·✨ 이모티콘과 꽃말 액자·할머니 요리책·낮잠 방석이 들어왔다. 봇은 장면을 Space·A 로 넘기며 막히지 않았고 `villagers-close` 는 **pass** (편지 → 코코 같이 낚시 · 답장 · 앨범 16장 · 추억 액자 — 같이 낚시가 사연 장면에 끊기지 않음).
  - ⛔ 둘은 festival-loop 「10일 동안 부품 4/5」와 그 뒤 festival-day — 퐁에게 낼 과일(섬 특산 아닌 과일 1개 포함)을 봇이 끝내 못 모음(퐁 🎉 → 🍎 말풍선 → 봇이 낼 게 없음). 같은 단계까지(`--only=boot…festival-loop`) **main 2194691 에서 22✅ 0⛔ (4일째 5/5)**, **이 브랜치로 다시 돌려도 22✅ 0⛔ (4일째 5/5, 사연 사진 8장)** — 봇 과일 운으로 본다 (사연 장면 탓 아님). 엔딩을 못 가서 엔딩 뒤 단계는 skip, 🟡 넷(home-grow 빚 · clothes 창 · dive 0마리 · daily 새총)도 엔딩 전 상태 때문.

## 남은 것 · 알려 둘 것
- 장면 20 · 가구 넷 모두 검수 대기 (스토리 편집기 「장면」 · 리소스 편집기 `#furn-nap-cushion` …).
- 연못 장면(s35·s41)은 소나무가 화면 가장자리를 가린다 — 편집기에서 카메라 각도·거리를 다듬으면 좋다.
- `?story=` 개발 미리 보기로 ② 를 틀어도 답례가 들어온다 (미리 보기 저장 칸이라 진짜 저장엔 안 섞임).
- 짝 주민 cameo 는 s40(느루)·s44(초롱)만. 짝 대사·다툼·화해는 P3.
- M19-P5 「추억」 다시 보기가 사연을 거를 때는 `trigger.on === 'bond-tier'` · `trigger.slug` 로 고르면 된다.

## 문서 세션이 반영할 문장
- CLAUDE.md 「주민과 더 가깝게 (M15…)」 절 끝에: **주민 사연 장면 (M19-P2, D201-A)**: 주민 열 × ① 친구 · ② 단짝 = s33–s52 (트리거 `bond-tier` — `town/talk.js` 가 단계가 오를 때·대화 끝에 `town:bond {slug, tier, up}`, 이미 그 단계인 저장은 그 주민과 말한 뒤 하루 하나 `story/rules.js bondPick` · `state.story.bondDay`, 자리 `home` = 그 주민 집 문 앞). 마지막 사진 컷이 앨범(kind `story`)에, ② 답례 = 가구 FU-105–108(`album-items.js STORY_FURN`) 또는 주민 대답 전용 이모티콘 여섯을 「감정」 칸에(`state.town.giftEmotes`) — 표 `town/bond.js BOND_STORY`, 주는 곳 `talk.js createBondStories`. 노트 `docs/notes/m19-p2-stories.md`.
- CLAUDE.md 「명령어」 개수 테스트 줄: 가구 80 (+ M19-P2 사연 답례 넷).
- `docs/notes/story.md` 트리거 표에 줄 하나: `bond-tier` | `town:bond` (M19-P2) | `slug` 같고 `tier` 이상 (`up` 이면 그 단계만, 아니면 하루 하나) | s33–s52 주민 사연. 장소 표에 `home` (트리거 주민 집 문 앞).
- CONTRACTS 에 이벤트 `town:bond {slug, tier, up}` · `town:story {id, slug, tier, item?, emote?, photo, skipped}`, 상태 `state.story.bondDay` · `state.town.storyGot` · `state.town.giftEmotes`, 서비스 `town.stories`.
- 게시 파일 수가 255/256 — 다음 트랙이 새 모듈을 더하면 `tests/build-web.test.mjs` 한도에 걸린다 (조정 세션이 게시를 두 번으로 나누거나 묶음을 늘려야 함).
- PLAN M19-P2 → 🔶/✅ 와 브랜치.
