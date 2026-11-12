# M15 주민과 더 가깝게 (브랜치 p55-m15-villagers) — 진행 중 (WIP)

## 된 것 (코드 · 데이터, 개발 서버 확인 전)
- 규칙 `src/gameplay/town/bond.js` (숫자 BOND — D155-A: 코드 상수, 요소 편집기 표는 나중)
- 편지 쓰기 UI-26 `src/ui/letter.js` + `town/mail.js` (우편함 → 편지 쓰기 · 선물 하나 · 다음 날 답장 reply/replyLove/replyDislike · 같이 논 다음 날 together 편지 · 친밀도)
- 같이 하기 `town/companion.js` (🎣 낚싯대 토큰 = 낚시, 🏃 = 산책, 글 대화 「같이 놀자」 메뉴) · `villager.js` mode 'with' (V.hold/release/afterAnim)
  - AN-14 = 뼈 자세 + player/tools.js 낚싯대 다시 씀 (D157-A: Blender 캐릭터 재빌드 안 함 — M13 AN-13 과 겹침 피함)
  - festival/talk.js chat 에 `h.special` 고리 한 줄
- 노래 `town/song.js` + 장면 `s26-evening-song` (트리거 song-first, 첫 노래 = 초롱·모찌)
- 추억 앨범 UI-27 `src/ui/album.js` (섬폰 📷, 160×100 JPEG, 24장 + 액자 사진), 액자 FU-71·72 (Blender, status review, `src/data/album-items.js`, house/furniture.js 에 dress 고리 한 줄)
- 주민 10명 대사 (letters.reply·replyLove·replyDislike·together, lines.together, lines.song) — 파일 v3 라 지문 핀은 건너뜀
- 스토리 편집기 words.js 편지 탭 새 종류 · traits.js SUB_LABELS

## 남은 것
1. 테스트 4개: 가구 개수 50→52 (assets·items·컨셉 보드 수량 테스트), 스토리 편집기 게시 목록에 s26·album-items 등 (`assets/story/editor-files.json`)
2. traits.js 편지 여러 줄 규칙 정규식에 reply·together 넣기 (편집 확인 필요)
3. 개발 서버 4263 에서 직접 확인 (콘솔 0) — 낚싯대 자세 각도·액자 사진 UV 방향
4. 자동 플레이 단계 (`tests/playthrough/scenario.js` 'villagers-close': 편지 쓰기 → 다음 날 답장 · 🎣 같이 낚시 · 앨범) + `--port=4263`
5. bond 규칙 테스트 `tests/m15.test.mjs`

## 결정 (추천안으로 정함)
- D155-A 숫자는 bond.js BOND 상수 · D156-A 같이 하기는 친구(30) 이상, 하루 한 번 · D157-A AN-14 는 코드 자세 · D158-A 사진은 저장 칸 글자 (160×100 JPEG) · D159-A 액자 값 300/500 도토리

## 문서 세션이 반영할 문장
- CLAUDE.md 「큰 구조」에 M15 절: bond.js · companion.js · song.js · ui/letter.js · ui/album.js, 저장 state.mail.sent · state.album · villagers[slug].together · town.song/songFirst, 이벤트 mail:sent · town:together · town:song · album:snap · album:frame.
