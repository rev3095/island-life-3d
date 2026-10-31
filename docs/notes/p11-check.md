# M7-P2 기기 점검·시작 단추 — 작업 노트 (`p11-check` 브랜치, 포트 4241)

main b37e5ba 에서 갈라짐. 보드 wave7 반영 v1: D39-A (기기 점검 `?check`, UI-07) · D45-A (소리 값 그대로 + 시작 단추, UI-11) · D37-B (묶음·`packs.js`·로딩 화면 UI-06 은 그대로).

## 만든 것

| 파일 | 내용 |
|---|---|
| `src/render/check.js` (새) | 기기 점검. 주소에 `?check` (claude.ai 게시본은 `#check`) 가 있을 때만 만든다. 섬이 열리고 (게시본은 로딩 화면·시작 단추가 걷힌 뒤) 2초 쉬고 → **광장 12초**(축제 광장 가운데에서 반지름 2.5 원을 돈다) → **선착장 8초** → **집 앞 8초** = 30초. 플레이어는 얼려 두고 자리만 옮기며, 끝나면 원래 자리로. 자리를 옮긴 뒤 1.5초는 버린다. 재는 것: 프레임 간격(rAF, 평균·가운데·95%·가장 긴 것), 그리기 시간(8프레임마다 `gl.finish` 까지 = GPU 포함), 그리기 직후 CPU 시간, `renderer.info` 호출·삼각형, GPU 이름(`WEBGL_debug_renderer_info`, 없으면 `RENDERER`), 화면·배율·캔버스·세로/가로, 품질(시작·끝·자동으로 바뀐 때와 자리), 오류 수(점검을 켠 때 = 모듈 불러오기 전부터 `console.error`·잡히지 않은 오류·거절), 게임 시각·계절·날씨, 웹 빌드 번호(게시 페이지 주석). 결과 카드: 표 + 「결과 저장」·「다시 재기」·「닫기」, 「결과 글로 보기」(저장소가 없을 때 복사해서 채팅에 붙이기). 순수 함수 `routeSpots`·`buildRecord`·`checkProblems` 는 테스트용으로 DOM 없이 |
| `src/render/quality.js` | **광장 기준** `createPlazaWatch` (+ `PLAZA` 값, `frameStats`·`percentile`·`isPlazaSlow`·`plazaArea`·`inArea`). 플레이어가 광장(축제 광장 반지름 + 2, 없으면 광장 자리 7) 안에 있고 집 안이 아니고 창이 보일 때만, 들어온 뒤 1초를 버리고 프레임 간격을 3초어치 모아 **평균이 33ms 를 넘으면 low** 로 한 번 내린다 (드나들어도 이어서 잰다, 250ms 넘는 간격은 멈춤으로 버림, 표본 20개 아래면 판단 안 함). 처음 몇 초 판단(`createAutoQuality`, 22ms·GPU 10ms)은 그대로 |
| `src/render/index.js` | 위 둘을 잇는 몇 줄: `plazaQ` 는 주소에 `?quality=` 가 없고 high 일 때만, `check` 는 `?check` 일 때만. `style.plazaQuality`·`style.check` (확인용) |
| `tools/web-loader.html` | 시작 단추 자리만: 다 받으면 막을 바로 걷지 않고 「🔊 소리 켜고 시작」·「소리 없이 시작」 + 「iPhone 은 무음 모드(옆 스위치·제어 센터)를 켜 두면 소리가 나지 않아요.」 한 줄. 누르면 막이 걷힌다. 「이대로 할래요」(일부 실패) 뒤에도 같은 단추 |
| `tests/check.test.mjs` (새) | 12개: 켜는 주소(`?check`·`#check`)· 통계·33ms 경계·표본 모자람·광장 자리·광장 판단 흉내(25fps → low 한 번, 60fps 그대로, 광장 밖·집 안 안 잼)·30초 순서·저장 모양·모양 검사·index.js 연결·단추 글·소리 기본값 0.6·0.8·0.7 |
| `assets/style/editor-files.json` | `src/render/check.js` 한 줄 (스타일 편집기가 `src/render/index.js` 를 불러오므로 게시 목록에 있어야 한다 — `style.test.mjs` 가 잡음) |

## 시작 단추의 소리 처리 (D45-A)

- 기본값(`state.js` 0.6·0.8·0.7)은 손대지 않았다.
- **소리 켜고 시작**: 누름 자체가 첫 입력이라 audio 가 깨어난다 (`audio.unlock()` 도 한 번 더 부름). 키보드도 이 누름으로 게임에 들어온다.
- **소리 없이 시작**: 섬폰 설정과 같은 길로 `bgm`·`sfx`·`voice` 를 0 으로 (`state.settings` + `audio.setVolume` + `settings:changed`) → 저장에도 남고 섬폰 「소리」 칸에서 다시 올릴 수 있다. 0 으로 내리기 전 값을 이 브라우저 `localStorage['island:start-muted']` 에 적어 두고, 다음에 「소리 켜고 시작」을 누르면 **셋 다 0 일 때만** 그 값으로 되돌린다 (그 사이 섬폰에서 올렸으면 그대로).
- 첫 누름(`pointerdown`·`keydown`)에 audio 가 엔진을 만들며 그때의 크기를 읽으므로, 로딩 화면 글이 창 capture 로 **audio 보다 먼저** 크기를 정한다 (로딩 화면 글이 main.js 보다 앞서 들어가서 먼저 불린다). 그래서 「소리 없이」가 잠깐이라도 소리를 내지 않는다.
- 단추를 눌렀는데도 소리가 잠겨 있으면 (예전처럼) 「화면을 한 번 누르면 소리가 켜져요」 안내. 「소리 없이」를 골랐으면 안내 없음.
- 로컬 `/index.html` 에는 로딩 화면이 없어서 단추도 없다 (예전처럼 첫 클릭에 소리). 확인은 `/artifact/`.

## 저장 모양 — 게임 저장소 `checks`

게시본(claude.ai)에서는 `claude.use('db')` → `db.collection('checks').add(문서)`, 문서 id 는 자동. 로컬 dev-server 는 `POST /api/db/checks` (`assets/review/checks.json`, gitignore), 그것도 없으면 이 브라우저 `localStorage['island:check:last']`. 저장 전에 `checkProblems` 로 모양을 본다. 문서 하나 ≈ 2~3 KB (원본 표본은 넣지 않는다).

```js
{
  v: 1, kind: 'device-check',
  at: '2026-10-31T03:22:40.830Z',      // 시작 시각 (ISO)
  ms: 28131,                            // 실제로 돈 시간
  build: 'b37e5ba' | null,              // 웹 빌드 번호 (게시 페이지 주석), 로컬 index.html 은 null
  where: 'claude' | 'artifact-local' | 'local',
  by: '<user id>' | null,               // 게시본에서만 (user capability 가 있으면) — 이름은 넣지 않는다
  device: {
    gpu: 'ANGLE (Intel, Intel(R) UHD Graphics …)', vendor, webgl: 2, maxTexture,
    screen: { w, h, vw, vh, dpr, ratio, canvas: [w, h], portrait },   // ratio = 실제 그리기 배율 (품질)
    touch, ua (300자), lang, cores, memory,
  },
  quality: { start: 'high', end: 'low', changes: [{ to: 'low', auto: true, at: 5.44, stop: 'plaza' }], fixed: false },  // fixed = ?quality= 로 고름
  frame: { n, avg, p50, p95, max },     // 모든 자리 프레임 간격 (ms)
  stops: [{ id: 'plaza'|'dock'|'home', label, frame: {n, avg, p50, p95, max}, draw: {avg, p95, n}, cpu, calls: {avg, max}, tris }],
  plaza: { avg, p95, goal: 33, ok },    // 목표 = 광장 평균 33ms 이하
  errors: { count, list: [최대 5줄, 200자] },
  time: { hour, season, weather } | null,
}
```

- `frame` 은 사람이 느끼는 프레임(rAF 간격), `draw` 는 그리기 + GPU 대기(`gl.finish`). 둘이 크게 다르면 그리기 말고 다른 것(창이 가려져 rAF 가 느려짐·모듈 update·다른 탭)이 느린 것.
- 편집기 홈이 이 컬렉션을 보여 주려면 홈 목록 `reads` 에 게임 저장소 `checks` 를 더하고, Claude 가 읽어서 홈 저장소에 옮겨 적는다 (아티팩트는 서로의 저장소를 못 읽는다 — P4 `reports` 와 같은 길).

## 게시 때 조정 세션이 할 일 (M7-P6)

1. 합치기: 겹치는 파일 없음 (`src/render/`·`tools/web-loader.html`·`tests/check.test.mjs`·`assets/style/editor-files.json` 한 줄). `git merge-tree --write-tree main p11-check` 로 확인.
2. 게임 다시 게시 때 **capabilities 에 `db` 와 `user`** (P4 문제 알리기와 같이). 규칙 제안 — 알림·점검은 누구나(로그인한 사람) 남기고 읽기·고치기는 편집자만:
   ```js
   capabilities: { db: { rules: [
     { path: 'checks', read: 'admin', write: 'interact' },
     // P4 reports 도 같은 모양이면: { path: 'reports', read: 'admin', write: 'interact' },
   ] }, user: {} }
   ```
   `write: 'interact'` 라 공유받은 사람이 남의 줄을 덮어쓸 수는 있다 (점검 기록이라 위험 낮음). 막고 싶으면 `checks/{self}` 규칙으로 문서 id = 사람 id (한 사람 한 줄) 로 바꿔야 하므로 `check.js` 의 `add` 를 `doc(id).set` 으로 — 그때 `CHECK_STORE.version` +1.
3. 바뀐 모듈: `src/render/check.js`(새)·`quality.js`·`index.js`, 페이지(`index.html`, 로딩 화면이 바뀜). 묶음은 그대로.
4. 스타일 편집기를 다시 게시할 일이 있으면 `src/render/check.js` 도 같이 올린다 (`editor-files.json` 에 넣어 둠).
5. 점검 링크는 **게임 링크 끝에 `#check`** (https://claude.ai/artifact/73gDyHVhfveR7ESQ23JrbJ#check). claude.ai 아티팩트는 링크의 `?…` 를 페이지에 넘기지 않고 `#…` 만 넘기므로 `checkRequested` 가 둘 다 받는다 (로컬은 `?check`). 게시 뒤 그 링크로 실제로 켜지는지 한 번 확인. RC-06·07·08 은 사용자가 휴대폰·다른 GPU 로 열어 「결과 저장」.

## 다른 트랙에 부탁 (제안)

- **QA (P1, `tests/playthrough/`)**: `--target=artifact` 로 돌리면 로딩 끝에 시작 단추가 막을 덮고 기다린다. `boot` 단계에서 `#ld-sound` (또는 `#ld-mute`) 를 눌러야 한다 — 사람이 하는 것과 같다. `?check` 와는 상관없음.
- **P4 (`src/core/errors.js`)**: 오류 모으기가 생기면 `check.js` 의 `watchErrors()` 대신 그것을 읽게 바꾸면 된다 (지금은 `?check` 일 때만 `console.error` 를 감싼다).
- **P3 (`src/ui/`)**: 점검 카드·진행 알약은 `src/render/check.js` 가 자기 DOM·CSS(`ck-` 접두어)로 `body` 에 붙인다. `ui.isBlocking()` 은 카드를 모른다 (점검은 개발·확인용이라 그대로 둠).

## 확인한 것 (2026-10-31)

- `node --test tests/` 273/273 (새 12개).
- dev-server `/index.html?check`: 30초 돌고 (광장 12 · 선착장 8 · 집 앞 8, 실제 28.1초) 결과 카드, 콘솔 오류 0, 「결과 저장」 → `assets/review/checks.json` 한 줄, 「닫기」 → 플레이어 풀림. 이름 정하기 창이 떠 있어도 뒤에서 돈다.
- `node tools/build-web.mjs` 뒤 `/artifact/`: 로딩 끝에 단추 둘 + iPhone 안내. 「소리 없이 시작」 → 크기 셋 0·버스 이득 0·안내 없음·이전 값 기록. 다시 열어 「소리 켜고 시작」 → 0.6·0.8·0.7 로 돌아오고 배경음 재생. `/artifact/?check` → 단추를 누른 뒤에 점검 시작, 빌드 번호 b37e5ba·오류 0·콘솔 오류 0. 375px 에서 카드·단추 넘침 없음.
- **이 컴퓨터 값은 믿지 말 것**: 미리보기 창이 숨겨져 rAF 가 느려서 프레임 간격이 50~110ms 로 나왔고, 그래서 광장 기준이 점검 중에 low 로 내렸다 (그리기 시간은 광장 3.8ms·16ms). 실제 화면에서 다시 재야 한다 (RC-09).
