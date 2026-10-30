# QA · 자동 플레이 점검

포근섬 이야기를 **처음부터 엔딩까지** 봇이 사람처럼 플레이하며 단계마다 통과·막힘·어색함, 걸린 시간, 콘솔 오류, 중요 장면 스크린샷을 남긴다.
플레이테스트·QA 고정 세션(브랜치 `qa`, 포트 4232)이 맡는다. 결과 보고서는 이 폴더의 `playthrough-<날짜>.md`.

## 돌리기

```bash
node tools/playtest.mjs                      # 개발판 /index.html · 1280×800 · 머리 없는 Chrome — 처음부터 엔딩까지
node tools/playtest.mjs --target=artifact    # 게시본 조건 /artifact/ (dist/web 이 없으면 --build 로 node tools/build-web.mjs 먼저)
node tools/playtest.mjs --mobile             # 375×812 터치 흉내 (화면 A·B 단추로 누름)
node tools/playtest.mjs --novice             # 처음 하는 사람 흉내: 주민 좋아함·축제 설정을 모르고 💭 힌트·주민이 알려 준 준비물만 (최대 20일)
node tools/playtest.mjs --only=boot,naming,arrival,clock,fd-tool,fd-gather,fd-catch,fd-sell,fd-donate,fd-home   # 첫날만 (1분)
```

- 옵션: `--port=4232`(개발 서버가 없으면 띄움) · `--days=10`(부품 모으기 최대 날 수) · `--speed=4`(최대 배속) · `--yearly`(1년 뒤 축제까지 날 넘기기) · `--from=<단계>` · `--headed`(창 보이기) · `--browser=edge` · `--out=<폴더>` · `--timeout=90`(분).
- 결과: `docs/qa/runs/<날짜-시각>-<대상>[-mobile]/` 에 `report.md`(단계 표·봇이 찾은 문제·콘솔 오류·날마다 기록·스크린샷 목록) · `report.json` · `transcript.json`(대사·이모티콘 대화 전부) · `shots/*.jpg`. 막힌 단계가 있으면 종료 코드 1. `runs/` 는 커밋하지 않는다 (보고서에 필요한 장면만 `docs/qa/shots/<날짜>/` 로 옮겨 커밋).
- 브라우저 주소 하나로도: dev-server 를 띄우고 `http://localhost:4232/tests/playthrough/index.html` (오른쪽 위 판에 단계 표·기록). 주소 옵션 `?target=artifact` `&touch=1` `&only=…` `&from=…` `&days=10` `&speed=4` `&keep=1`(저장을 지우지 않고 이어서) `&yearly=1` `&debug=1`(하늘 조절 판) `&panel=0`.

## 어떻게 도나

| 파일 | 하는 일 |
|---|---|
| `tests/playthrough/index.html` | 실행 페이지: 저장을 지우고 게임을 iframe 으로 연 뒤 봇·단계를 돌린다. `window.__playtest` 에 상태·기록·보고서 |
| `tests/playthrough/bot.js` | 봇 본체. 게임 rAF 를 멈추고 `ctx.step(dt)` 를 직접 돌린다(창이 숨겨져도, 최대 배속까지). 가상 조이스틱(`input.move`)·칸 길찾기(town 과 같은 A*)·진짜 키 이벤트·창 단추 `click()`. 열린 창(대화·확인·가방·이모티콘·리듬)과 장면은 단계가 준 정책대로 넘긴다. 콘솔 오류·경고·알림·이벤트 수를 모은다 |
| `tests/playthrough/skills.js` | 사람이 하는 일 단위: 나무 흔들기·줍기, 낚시(입질·덥석 소리에 0.2~0.3초 반응, 큰 물고기 줄다리기는 찌가 떠오르는 소리에), 곤충(멀면 달리고 4칸 안에선 걸어서), 꽃 꺾기, 도끼·삽, 상점 팔기·사기·벽지, 박물관 기증, 집 드나들기·가구 놓기, 주민 쫓아가 말 걸기·이모티콘 대화(선물·🎉·부탁), 우편함 |
| `tests/playthrough/scenario.js` | 단계 목록: 새 게임 → 이름 → s01·밤톨 안내·s02 → 첫날 할 일 7 → 밤톨 선물·s03 → 도구 사기 → 주민 6명(연습) → 우편함 → 저녁 채집·기증 → 집 꾸미기·벽지 → 둘째 날 s04(장면 중 I·M 키 점검) → ❓ 부탁 받고 들어주기·🎁 선물 → (날마다) 마음 열기·🎉·재료 채집·전달·부스 놀이·팔기 → 두부 생일 → 단풍 이사 → 주민 방 → 축제 날 18시 광장 → s10·s11 사진·s12 → 엔딩 뒤(부스·대화·사진 액자 걸기) → (선택) 1년 뒤 축제 |
| `tools/playtest.mjs` | 명령줄 실행기: 개발 서버 확인·띄우기 → 머리 없는 Chrome/Edge 를 CDP(내장 WebSocket)로 → 실행 페이지 열기 → 기록 줄을 터미널에 → 스크린샷 요청을 받아 화면 전체를 찍음 → 보고서 파일 |

### 지키는 것 (점검이 되게)
- **지름길 없음**: `festival.debug`·`movein.skip`·상태 직접 고치기·`talkTo` 를 쓰지 않는다. 행동은 키(Space·F·숫자키)와 창 단추로만. 게임 상태는 읽기만(어디로 갈지·잘 됐는지 보려고).
- **시계만 당긴다**: `time.setPaused(true)` 뒤 `time.setHour(h)` (다음 날 = `setHour(29)`). 과제에서 허용한 길.
- **순간이동은 길이 없거나 오래 막혔을 때만**, 그때마다 문제(`world: 길이 없어요` / `걷다가 막혔어요`)로 남긴다 → 보고서의 막힘 후보.
- **공략을 아는 사람**: 이모티콘 대화는 주민 파일(`assets/villagers/<slug>.json`)의 좋아함·읽는 법·`talk.json` 연습 답을 알고, 말풍선 💭 힌트를 따른다. 축제 재료도 `assets/festival/config.json` 을 안다. 그래서 날 수는 "잘 아는 사람" 기준이다 (처음 하는 사람은 더 걸린다 — 보고서에 따로 적는다).

### 새 기능이 합쳐지면
1. `node --test tests/` → `node tools/playtest.mjs` (개발판) → `--target=artifact --build` → `--mobile --only=…첫날`.
2. 새 흐름이면 `skills.js` 에 기술, `scenario.js` 에 단계를 더한다 (단계 id 는 짧게, 결과 `{ status: pass|awkward|block|skip, note }`).
3. 보고서 `docs/qa/playthrough-<날짜>.md` 를 새로 쓰거나 이어 쓴다. 큰 문제는 공유 노트 폴더 `qa.md` 와 7차 보드(QA 칸)로.
