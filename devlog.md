# 포근섬 이야기 개발 일지 (devlog)

이 문서는 세션이 끝나거나 `/clear` 하기 전에 대화와 작업을 보고서로 남긴 기록이다. 새 세션은 **「현재 상태」부터 읽고**, 자세한 경위는 「세션 기록」을 본다. 구조·명령어는 [CLAUDE.md](CLAUDE.md), 개발 단계는 [docs/PLAN.md](docs/PLAN.md), 모듈 약속은 [docs/CONTRACTS.md](docs/CONTRACTS.md), 실행법은 [README.md](README.md).

마지막 갱신: 2026-10-28

---

## 현재 상태 (2026-10-28 기준)

### 한 줄 요약
리소스(캐릭터 9 · 배경 32)를 Blender 스크립트로 모두 만들고 편집기 2개로 공개했다. 1차 병렬 개발 5트랙(섬·데이터·UI·사운드·하늘)은 `main` 에 합쳐져 섬을 걸어 다닐 수 있다. **2차 4트랙(P2 채집 · P3 주민·가게 · P4 집·제작 · 동숲풍 셰이더)이 별도 세션에서 진행 중**이다.

### 게시물
| 이름 | 링크 | 원본 파일 | 상태 |
|---|---|---|---|
| 캐릭터 편집기 | https://claude.ai/artifact/FTCqiHtFPcACcQEULNbUX2 | `editor.html` (+ `assets/models`, `assets/specs`, `assets/renders`) | 9종 모두 검수 대기. db 컬렉션 `refs` / `requests` |
| 배경 편집기 | https://claude.ai/artifact/LuEvzroBSW2RFhVWvm6tkh | `bg-editor.html` (+ `assets/env/*`) | 32종 모두 검수 대기. db 컬렉션 `env-refs` / `env-requests`. 파일 271개라 두 번에 나눠 publish |
| 컨셉 보드 v0.1 | https://claude.ai/artifact/6Z5WJmpKasDRyVANYbwauM | `concept/concept-board.html` | 2D 계획 보드. 결정 D1~D7 는 명시적 답 없음 → 추천안으로 진행 중 |
| 게임 | (아직 웹 게시 안 함) | `index.html` + `src/` | 로컬 `node dev-server.mjs` → http://localhost:4180/index.html |

### 진행 중 (2차 병렬 트랙)
모두 `main` d471668 에서 갈라졌고, 기록 시점에 커밋 0개(작업 중). 각 세션은 끝나면 이 세션에 보고를 보낸다.

| 세션 | 세션 id | 브랜치 · 작업 폴더 | 포트 | 고치는 곳 |
|---|---|---|---|---|
| W1 · P2 채집 연결 | `local_67ef3508-3c29-46c1-8f91-1ca2b277b83b` | `p2-gather` · `../island-worktrees/p2-gather` | 4191 | `src/gameplay/gather/`, `src/player/`, `src/world/` |
| W2 · P3 주민·상점·박물관 | `local_9ed02860-f2e3-4ec1-a98b-96ce0a1e772f` | `p3-town` · `../island-worktrees/p3-town` | 4192 | `src/gameplay/town/` |
| W3 · P4 집·가구·제작 | `local_6232f2a5-9cef-4d2c-bde3-ee67083c4896` | `p4-house` · `../island-worktrees/p4-house` | 4193 | `src/gameplay/house/`, `assets/furniture/`, `assets/blender/build_furniture.py`, `tools/*furniture*`, `src/sky/`(실내 모드만) |
| W4 · 동숲풍 스타일 셰이더 | `local_b29f8fe0-6a9d-4061-9d51-20528d621e73` | `stylized-shader` · `../island-worktrees/stylized-shader` | 4194 | `src/core/materials.js`, `src/render/`, `src/main.js`(그리기 부분), `demos/style.html`, `docs/SHADERS.md` |

**끝나면 할 일 (1차 때와 같은 순서)**
1. 세션 보고를 그대로 믿지 말고 확인: `git log --oneline main..<브랜치>`, `git diff --name-only main...<브랜치>` 로 자기 폴더만 고쳤는지, 두 브랜치가 같은 파일을 건드렸는지(`sort | uniq -d`), `git merge-tree --write-tree main <브랜치>` 로 충돌 여부, `node --test tests/`.
2. 각 브랜치 포트의 `/index.html`, W4 는 `/demos/style.html` 을 열어 직접 확인 (창이 숨겨져 있으면 fps 대신 `gl.finish` 로 그리기 시간 측정).
3. 사용자에게 결과·빈틈을 보고하고 **합치기 승인**을 받는다 (브랜치는 `refs/heads/<이름>` 으로 부른다). 승인 뒤 `main` 에서 `git merge --no-ff` 로 하나씩 합치고, `docs/notes/<트랙>.md` 의 계약 제안을 `docs/CONTRACTS.md` 에 반영, 합친 게임을 다시 확인하고 커밋.
4. W1 과 W4 는 모두 셰이더/재질에 닿을 수 있다(W1 이 만든 새 물체는 `ctx.materials` 를 써야 W4 셰이더가 붙는다) — 합친 뒤 새 물체에도 새 셰이더가 걸리는지 본다.

### 다음에 할 일
- 2차 합치기 → **3차 P6**: 휴대폰 조작 다듬기, 성능, 첫날 안내 정리, 게임을 웹 링크로 배포 (아티팩트: `.glb.json` 만 사용, 파일 255개·64MB 제한이면 여러 번 publish).
- 사용자가 편집기에서 요청을 보내면 "요청 확인" / "배경 요청 확인" 흐름으로 처리 (아래 「반영 흐름」).
- 셰이더 추가 요청은 W4 가 만드는 스타일 편집기(`demos/style.html`)와 `docs/SHADERS.md` 를 기준으로 받는다.
- 남은 빈틈(1차 보고): 기본 카메라에서 하늘이 잘 안 보임, 계단 모양 해안선·바다 물결 없음, 나무가 플레이어를 가림, 도구 휘두르기 없음(W1 진행 중), 아이콘은 이모지 임시(D2 미정).
- 합쳐진 1차 브랜치·작업 폴더(`p1-world`, `p2-data`, `ui-system`, `audio`, `sky-time`)는 아직 남아 있다 → 사용자에게 정리 여부를 물어본 뒤 `git worktree remove`.

### 사용자 원칙·선호 (계속 지킬 것)
- 한국어로 소통. 결과는 확인한 것과 못 한 것을 나눠서 보고.
- **모델링 전에 리소스 계획·컨셉 이미지로 검수받고, 고친 뒤 진행**한다. 한 번에 다 만들지 말고 하나(또는 한 분류) 완성 → 보여주기 → 다음.
- 실제 3D 모델(2D 그림 아님)을 웹에서 실시간으로. Blender 로 모델링하고 기존 모델은 유지.
- 편집기는 요소마다 버튼으로 골라 색·디자인·렌더·프롬프트·레퍼런스(이미지·영상)로 수정·추가 요청하는 구조. 요청 처리는 **채팅으로 알려주는 방식**(자동 확인 거절).
- 레퍼런스는 사용자 본인 그림 → 저작권 걱정 없이 적극 반영.
- 개발 작업은 **세션·브랜치로 나눠 병렬** 진행, 합치기는 사용자 승인 뒤.
- 셰이더: 모델은 그대로, 동물의 숲 같은 3D 스타일라이즈드 셰이더만 입힌다.
- `/save-session` = 이 devlog 를 보고서 형태로 갱신. `/clear` 전에 항상.

---

## 세션 기록

### 세션 1 · 2026-10-28 — 기획부터 리소스·편집기, 1차 개발 합치기, 2차 시작까지

#### 1. 요청과 작업 흐름
| # | 사용자 요청 요지 | 한 일 | 결과 |
|---|---|---|---|
| 1 | 동물의숲 같은 3D 게임을 웹으로 전부 만들어줘 | 계획 세움 → 사용자가 "나중에 이어서" | 메모리에 계획 저장 |
| 2 | 이어서. 모델링 전에 리소스 계획·컨셉 이미지로 검수받고 고친 뒤 진행 | 컨셉 보드 v0.1 (캐릭터 9·지도·소품·수집물·가구·UI·사운드·결정 D1~D7, 모든 항목 ID) | 아티팩트 6Z5WJm… |
| 3 | 2D 그림 말고 실제 3D 모델이 웹에 나오게 가능한가 | 가능 설명, Blender 5.2 설치 확인 | 방식 합의 |
| 4 | 샘플 하나만 Blender 로 완성 + 이미지 컨셉 보드, 레퍼런스·키워드를 프롬프트로 수정 가능하게 | 코코(CH-02) 스펙 JSON → `build_character.py` (모델·12본 리그·동작 4·툰 렌더) → 3D 뷰어 + 프롬프트 편집 보드 | 아티팩트 FTCqi… (처음엔 '코코 캐릭터 시트') |
| 5 | 보드에서 .glb 를 못 불러옴. 구조·동작 원리 설명. 레퍼런스에 실제 이미지·영상 넣고 싶음 | 원인(CSP 가 data: fetch 차단) 재현·수정(base64 `.glb.json` + `GLTFLoader.parse`), 로컬 CSP 흉내 dev-server, 이미지·영상 업로드(영상은 장면 6장 추출), 요청 저장·기록 (db·assets) | 같은 링크 갱신 |
| 6 | 요청 처리는 지금처럼 채팅으로 | 자동 확인 안 함 | — |
| 7 | '캐릭터 편집기'로 이름 변경, 모델마다 버튼으로 개별 수정, 이후 개발·모델링 진행 | 빌더를 9종족 공용으로 확장, 캐릭터 9종 빌드·렌더 검수(밤톨 앞치마·귀·꼬리, 초롱 턱 경계 수정), 편집기 다중 모델·새 모델 요청·#링크 | 같은 링크 갱신 |
| 8 | 자연·소품·건물·타일도 요소별로 나눠 3D 로 만들고 이미지로 확정 결정, 캐릭터 편집기 같은 '배경 편집기' | `toonkit.py` + `build_env.py` (요소 kind 별 함수), 32종 스펙·빌드·렌더 검수(조개 줄무늬, 우편함, 박물관 박공, 절벽 지층, 변형 외곽선 잔여물 수정), 배경 편집기(분류 탭·격자·변형·3×3 타일·키 막대) | 아티팩트 LuEvzro… |
| 9 | 게임 M1, P1부터 개발 계획, 실제 개발, 작업은 세션·브랜치로 병렬 | git 저장소 만들기, 공통 기반(`index.html`, `src/main.js`, `src/core/*`, PLAN·CONTRACTS), 5트랙 세션 시작 | T1~T5 진행 |
| 10 | (5세션 완료) | 브랜치 직접 검증: 폴더 겹침 없음·충돌 없음·테스트 86/86·섬 걷기 77fps·UI/하늘 데모 확인 | 합치기 승인 요청 |
| 11 | 5개 모두 합치기 | `main` 에 `--no-ff` 합치기, CONTRACTS 에 제안 반영, 저사양 모드·외곽선 설정 연결 | 8281c0b |
| 12 | 2차 시작 + stylized 검색해서 동숲풍 3D 셰이더만 입히기 (모델 유지) | 웹 검색(ACNH 그래픽 분석·three.js 후처리), 2차 준비(gameplay 로더·행동 키 디스패처·`world.addZone`), W1~W4 세션 시작 | 진행 중 |
| 13 | 나중에 셰이더를 더 입히려면 프롬프트·링크·첨부를 어떻게? | 요청 틀·첨부 방법 안내, W4 에 스타일 편집기·SHADERS.md 를 맡김 | 아래 5절 |
| 14 | /init + /save-session, 앞으로도 /save-session 시 이 작업, /clear 전 기록 | `CLAUDE.md`, 이 `devlog.md` | 이 문서 |

#### 2. 결정 사항
| 무엇을 | 왜 | 누가 |
|---|---|---|
| 오리지널 IP '포근섬 이야기', 화폐 도토리, 한국어 UI | 닌텐도 IP 회피 | Claude 제안, 사용자 진행 |
| Blender 헤드리스 스크립트로 모델링 (스펙 JSON → 빌더) | 실제 3D 모델 + 프롬프트·수치로 다시 만들기 쉬움 | 사용자 요청, Claude 설계 |
| 모델은 `.glb` + base64 `.glb.json` 둘 다, 웹은 `.glb.json` 만 | 아티팩트가 .glb 를 못 올리고 CSP 가 data: fetch 를 막음 | 문제 발견 후 Claude |
| 결정 D1~D7 은 추천안(툰+외곽선, 실제 시계, 주민 6, 64×56 섬 …)으로 진행 | 사용자가 따로 답하지 않고 진행 요청 | 진행 중 합의 |
| 요청 처리는 채팅 "요청 확인"으로 (자동 주기 확인 X) | 사용자 선택 | 사용자 |
| 병렬 개발 = 파일이 겹치지 않는 시스템 단위 트랙 + 계약 문서 | 단계끼리 서로 기대서 단계 단위로는 병렬 불가 | Claude |
| 세션 작업 폴더는 수동 git worktree(`../island-worktrees/`) | 앱이 부모 폴더(git 아님) 기준이라 자동 worktree 실패 | Claude |
| 합치기는 사용자 승인 뒤 | 사용자 원칙 | 사용자 |
| 저사양 모드(`?quality=low`/터치 기기: DPR 1.5, 그림자 1024) | 그림자가 프레임 시간 절반 (T1 측정) | Claude |
| 행동 키는 우선순위 디스패처 하나로 | P2(도구)·P3(대화)가 같은 Space 키 사용 | Claude |
| 셰이더는 별도 트랙(W4), 기존 `toon` 프리셋 유지 + 새 `cozy` 기본 | 모델 유지·비교 가능 | 사용자 요청, Claude 설계 |

#### 3. 내용
- **캐릭터 9종** (`assets/specs/*.json`, 종족 FEATURES): CH-01 플레이어(사람), CH-02 코코(고양이), CH-03 보리(강아지), CH-04 모찌(토끼), CH-05 두부(곰), CH-06 퐁(오리), CH-07 초롱(개구리), CH-08 밤톨(다람쥐·상점), CH-09 느루(거북·박물관). 본 12개 내외, 동작 idle/walk/run/happy, 삼각형 9~12k.
- **배경 32종** (`assets/env/specs/*.json`): 자연 EN-01~11(활엽수·과일나무·야자수·삼나무·바위·튤립·코스모스·팬지·잡초·조개·꽃덤불), 소품 PR-01~09(가로등·벤치·우편함·안내판·나무다리·울타리·화석 자리·작업대·모닥불), 건물 BD-01~05(플레이어 집·주민 집·도토리상점·박물관·선착장), 타일 TI-01~07(풀밭·모래·흙길·물·절벽·경사로·광장). 계절·색 변형, 나무 sway/shake, 모닥불 flicker.
- **게임 1차** (main): 64×56 결정적 섬(강·폭포·다리·언덕·경사로·구역), 인스턴싱 지형·물체, 충돌, 플레이어 이동·카메라·발소리; 아이템 110종·출현표·가방·지갑·박물관·레시피·상점·저장·05시 하루 리셋(테스트 86); HUD·대화·가방·섬폰·지도·상점·박물관·확인 창; 합성 배경음 9·효과음 24·목소리 9; 실제 시계·날씨·하늘·밤 조명·비·눈·무지개·계절.

#### 4. 만든 것 (파일)
- 리소스: `assets/blender/{build_character.py, build_env.py, toonkit.py}`, `assets/specs/`, `assets/env/specs/`, 생성물 `assets/models/`, `assets/renders/`, `assets/env/{models,renders}`, `index.json` 들.
- 도구: `tools/{build-character.mjs, build-env.mjs, glb-to-json.mjs, seed-character-specs.mjs, seed-env-specs.mjs}`, `dev-server.mjs` (CSP 흉내 + `/api/db`·`/api/assets` + `--port=`).
- 편집기: `editor.html`, `bg-editor.html`, `concept/concept-board.html`.
- 게임: `index.html`, `src/main.js`, `src/core/*`, `src/gameplay/index.js`, 1차 트랙 `src/{data,sky,world,player,ui,audio}/`, `demos/{data,ui,audio,sky}.html`, `tests/`.
- 문서: `README.md`, `CLAUDE.md`, `docs/PLAN.md`, `docs/CONTRACTS.md`, `docs/notes/{t1-world,data,ui,audio,sky}.md`, 이 `devlog.md`.
- 커밋 흐름 (main): 905f905 기반 → 130bb1a 공통 기반 → 4ae6e59 포트 옵션 → 5개 merge → 8281c0b 통합 → fa047d2 2차 준비 → d471668 PLAN 2차 표.

#### 5. 반영 흐름·명령어
- **"요청 확인"** (캐릭터 편집기) / **"배경 요청 확인"** (배경 편집기): ArtifactData `list` 로 `requests`/`env-requests` 의 `status:'new'` 읽기 → `working` 으로 바꾸기 → 레퍼런스는 Artifact `read` 에 `path=<asset id>` 로 내려받아 직접 보기(영상은 장면 이미지) → 스펙 JSON·빌더 수정 → `node tools/build-character.mjs <slug>` / `node tools/build-env.mjs <slug>` → 같은 링크에 publish (캐릭터: `url` 지정, 배경: 파일 많으면 나눠서) → 요청을 `done` + `reply` + `doneVersion` 으로 갱신.
- **"<이름> 확정"**: 그 스펙의 `status` 를 `approved` 로 바꾸고 다시 빌드(목록 갱신)·publish.
- **셰이더 추가 요청** (사용자 안내함): 스타일 편집기에서 슬라이더 조절 → "현재 값 복사" 붙여넣기, 또는 틀 `[셰이더 요청] 대상 / 원하는 느낌 / 레퍼런스(이미지 첨부+링크) / 조절할 값 / 휴대폰 여부`. 영상은 장면 캡처로, 코드 링크는 라이선스 확인.
- **세션 합치기**: 위 「진행 중 → 끝나면 할 일」.
- 실행: `node dev-server.mjs` → `/index.html?debug`, 테스트 `node --test tests/`.

#### 6. 문제와 해결
| 문제 | 원인 | 해결 |
|---|---|---|
| 보드에서 3D 모델 로딩 실패 | 아티팩트가 .glb 미지원, 내장 버퍼 `data:` fetch 를 CSP 가 차단 | base64 `.glb.json` 을 받아 직접 풀고 `GLTFLoader.parse`. dev-server 에 같은 CSP |
| 로컬 테스트 중 태그 저장이 사라짐 | dev-server 의 읽고-고치고-쓰기 경쟁 | 컬렉션별 쓰기 큐 |
| 편집기에서 숨긴 요소가 보임 | 로컬엔 아티팩트의 `[hidden]` 리셋이 없음 | 페이지 CSS 에 `[hidden]{display:none!important}` |
| `#이름` 만 바꾸면 모델 안 바뀜 | hashchange 미처리 | 리스너 추가 |
| 밤톨이 여우처럼·앞치마가 셔츠처럼 | 뾰족 귀·앞치마 범위 | 귀 둥글게·꼬리 풍성·앞치마 좁힘 |
| 배경 섬 컷에 검은 얼룩 | 변형 모델을 지울 때 외곽선 껍데기가 남음 | `children_recursive` 까지 삭제 |
| 박물관 박공이 지붕색으로 덮임 | 꽉 찬 삼각기둥 지붕 | 경사판 두 장 지붕 + 기둥색 박공 |
| 절벽 지층이 안 보임 | 상자 옆면이 면 하나 | 층 판 여러 장 쌓기 |
| 세션 worktree 자동 생성 실패 | 앱의 프로젝트 루트가 git 아닌 부모 폴더 | `git worktree add` 로 직접 만들고 `cwd` 로 세션 시작 |
| 합친 게임 fps 16 | 미리보기 창이 숨겨져 rAF 가 느려짐 | `gl.finish` 측정: 프레임당 약 1~2ms |
| 해 위치를 main 이 덮어씀 | 고정 오프셋 | `ctx.lights.sunOffset` 을 sky 가 바꾸게 |

#### 7. 검증한 것 / 확인 못 한 것
- 검증: `node --test tests/` 86/86 통과(main, 2026-10-28), 합친 게임에서 6개 모듈 로드·콘솔 오류 없음, 저사양 모드 적용, 외곽선 145개 끄고 켜기, 가방 열면 이동 막힘·Esc 로 닫힘, 섬 걷기 속도·선착장 끝 멈춤, 실내용 `addZone` 동작, 두 편집기 웹 링크 파일·저장소 접근.
- 확인 못 함: 웹 링크에서 사용자가 실제로 파일을 올리는 동작(로그인 필요), 소리(사용자가 데모로 들어보고 승인함), 숨겨진 창 때문에 실제 체감 fps, 2차 4트랙 결과(진행 중).
