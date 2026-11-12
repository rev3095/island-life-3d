# M15 주민과 더 가깝게 (브랜치 `p55-m15-villagers`, 작업 폴더 `../island-worktrees/m15-villagers`)

13차 보드 로드맵 M15 (docs/PLAN.md 42). 내가 주민에게 편지·선물 · 같이 낚시/산책 · 추억 앨범 · 주민끼리 노래. 개발 서버 포트 4263.

## 만든 것

| 무엇 | 파일 | 요점 |
|---|---|---|
| 규칙 (순수) | `src/gameplay/town/bond.js` | 숫자 `BOND` 한 곳 (편지·같이 하기·노래·앨범). `planReplies`·`canTogether`·`songPlan/songPair`·`addPhoto`. town/rules.js 의 지문 대상 함수(planLetters 등)는 그대로 |
| 편지 쓰기 UI-26 | `src/ui/letter.js` · `town/mail.js` | 우편함 → 다 읽은 뒤(빈 우편함이면 바로) 「편지를 써서 보낼까?」 → 창: 받는 주민(만난 주민) · 글 80자 · 말 고르기 칩 · 선물 하나(가방에서, 도구·변형 칸 빼고). 하루 3통 · 한 주민에게 하루 1통. 다음 날 아침 답장 `reply`/`replyLove`/`replyDislike` (+ 답례 선물 가끔), 친밀도 = 3 + 선물 반응 점수 (얼굴 보고 주는 선물 하루 2개 칸과 따로). 저장 `state.mail.sent` |
| 같이 하기 | `town/companion.js` · `town/talk.js` · `villager.js` | 친구(30) 이상 · 같은 주민과 하루 한 번. 이모티콘 대화: 물건 칸 🎣 **낚싯대** 하나 = 같이 낚시, 🏃 하나 = 같이 산책 (덜 친하면 🏃 는 보통 판정). 글 대화: 메뉴 「같이 놀자」. 주민이 따라오고(mode `'with'`, `V.hold/release`), 낚시면 플레이어가 물가에 서면 옆 물가 칸(카메라 쪽 남쪽은 피함)에서 낚싯대·찌·줄 → 14–24초마다 낚음, 플레이어가 낚으면(효과음 `catch`) 손뼉. 끝: 둘이 3마리 / 150초, 산책 36칸 / 120초, 말 걸어 「그만」, 잘 시간, 섬 밖(집·무인도) → 사진 → 한마디 → 친밀도 +5 (중간에 그만두면 +3) · 작은 선물 · 다음 날 가끔 「어제 즐거웠어」 편지. 저장 `villagers[slug].together` |
| AN-14 낚싯대 들기 | `town/companion.js` | 오른팔 뼈에 자세를 얹고(`V.afterAnim`, 동작이 그 뼈를 안 움직여도 쌓이지 않게 base 기억) `player/tools.js` 낚싯대를 arm.R 에 단다 |
| 저녁 광장 노래 · s26 | `town/song.js` · `assets/story/scenes/s26-evening-song.json` | 날마다 50% · 18–20시 사이 정해진 때, 밖에 있는 주민 둘이 광장 둘레에 모여 80초 번갈아 노래 (머리 위 🎵 가사 말풍선 + `audio.speak` 목소리 합성, 7칸 안에서만 소리). 첫 노래는 초롱·모찌 → 다가가 3초 들으면 `town:song {first, x, z}` → s26 (트리거 `song-first`). 4초 들으면 사진, 절반 넘게 들으면 둘 다 친밀도 +1. 노래하는 주민에게 말 걸면 「같이 흥얼흥얼」. 저장 `town.song`·`town.songFirst` |
| 추억 앨범 UI-27 | `src/ui/album.js` · `phone.js` (앱 📷 앨범) | 사진 = 지금 3D 화면 가운데 60% 를 160×100 JPEG(약 6KB)로. 저절로: 같이 놀기 끝 · 저녁 노래 · 주민 생일 방 · 섬 축제 끝 · 계절 행사 도장. 「📷 지금 찍기」. 24장(액자 사진 빼고) 넘으면 오래된 것부터. 저장 `state.album` |
| 추억 액자 FU-71 · FU-72 | `assets/furniture/specs/album-frame*.json` · `build_furniture.py` · `src/data/album-items.js` · `house/furniture.js` 고리 한 줄 | 앨범에서 사진 → 「추억 액자로 만들기 🌰300」(탁상) · 「추억 벽 액자 🌰500」(벽). 가방 칸 변형 `사진<id>`, 집에 놓으면 `album.dress` 가 `photo` 재질에 그 사진 (UV 는 게임에서 다시 깜). Blender 모델 status review |
| 주민 대사 | `assets/villagers/*.json` (주민 10명) | `letters.reply·replyLove·replyDislike·together` · `lines.together` (12칸) · `lines.song` (`sing` 16자 · `talk`). 파일 v3 라 지문 핀은 건너뜀 (값은 그대로) |
| 스토리 편집기 | `story-editor/words.js` · `traits.js` | 편지 탭에 새 편지 넷 + 언제 나오나, 주민 탭 together·song 묶음 이름표(`SUB_LABELS`) |
| 테스트 · 봇 | `tests/m15.test.mjs` (7) · `tests/playthrough/scenario.js` `villagers-close` · `skills.js` `sk.mail({ write })` | 가구 개수 50→52 (assets·items 테스트), 편집기 게시 목록에 album-items·s26 |

다른 트랙 파일에 넣은 고리 (줄 단위로 합치면 됨): `festival/talk.js` chat 의 `h.special` 한 줄 · `house/furniture.js` `album.dress` 한 줄 · `ui/phone.js` 앱 한 줄 · `story/rules.js` 트리거 한 줄 · `story/files.js`·`assets/story/index.json` 한 줄 · `data/items.js` 두 줄.

## 결정 (추천안으로 정함, D155–D159)
- **D155-A** 숫자는 `bond.js` `BOND` 코드 상수 (요소 편집기 표로 옮기려면 rules.json `town` 에 칸을 더하고 여기서 읽는다).
- **D156-A** 같이 하기는 친구(30) 이상 · 같은 주민 하루 한 번 · 낚시는 둘이 3마리, 산책 36칸.
- **D157-A** AN-14 는 Blender 캐릭터 재빌드 대신 코드 자세 + 낚싯대 다시 쓰기 (M13 AN-13 캐릭터 재빌드와 .glb 충돌 피함). 나중에 클립이 생기면 `actor.play('fish')` 로 바꾸면 된다.
- **D158-A** 사진은 저장 칸 글자(JPEG data URL, 160×100, 장당 ≈6KB · 최대 24장 + 액자 사진) — 저장 옮기기 글이 그만큼 길어진다.
- **D159-A** 액자 값 탁상 300 · 벽 500 도토리, 상점에는 안 나옴 (출처 `album`).

## 확인
- `node --test tests/` 487 중 486 통과 · 실패 0 (1 건너뜀 = 기존).
- 개발 서버 4263 직접: 우편함 → 편지 창 → 복숭아 넣어 보내기 → 다음 날 답장(친밀도 45→51) · 🎣 토큰 → 코코 같이 낚시(물가에서 낚싯대·찌, 2마리, 사진·친밀도 +5) · 보리 같이 산책(끝·선물) · 저녁 노래(두부·초롱, 첫 노래 초롱·모찌 → s26 재생) · 앨범 창·액자 둘(사진이 바르게 입혀짐) — 콘솔 오류 0.
- 자동 플레이: 아래 「자동 플레이」 줄.

## 남은 것 · 알려 둘 것
- 액자 모델 FU-71·72 리소스 편집기 검수 (status review).
- 노래 목소리는 `audio.speak` 하나라 대화창 목소리와 겹치지 않게 창이 열려 있으면 소리만 쉰다.
- 장면 속 배우는 기본 자리라 같이 노는 중 장면이 시작되면 같이 하기는 「먼저 돌아감」으로 끝낸다.

## 문서 세션이 반영할 문장
- CLAUDE.md 「큰 구조」에 절 하나: **주민과 더 가깝게 (M15, `src/gameplay/town/bond.js`·`companion.js`·`song.js`, `src/ui/letter.js`·`album.js`)** — 우편함 편지 쓰기 UI-26(하루 3통, 다음 날 답장) · 친구 이상 🎣/🏃 같이 낚시·산책(villager mode `'with'`, AN-14 코드 자세) · 저녁 광장 노래(s26 `song-first`) · 섬폰 📷 앨범 UI-27(사진 160×100 JPEG 저장, 액자 FU-71·72 `album.dress`). 숫자 `BOND`. 저장 `state.mail.sent` · `state.album` · `villagers[slug].together` · `town.song/songFirst`. 이벤트 `mail:sent` · `town:together` · `town:song` · `album:snap` · `album:frame`. 노트 `docs/notes/m15-villagers.md`.
- CLAUDE.md 「명령어」 개수 테스트 줄: 가구 52 (+ M15 추억 액자 둘).
- CONTRACTS 에 `festival` 이모티콘 대화 `chat(h)` 의 `h.special(낱말) → 'end' | true | null` 고리, `ctx.services.album` 서비스.
- PLAN 42 M15 → 🔶/✅ 와 브랜치.
