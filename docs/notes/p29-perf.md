# p29-perf 최적화 — 계절 행사 지연 받기 · 화면 밖 계산 줄이기

2026-11-05, 브랜치 `p29-perf` (main 7bc5078 에서). 사용자 요청: "계절 넷을 다 처음에 받는 거 아니지? 플레이하면서 연산을 줄여 최적화, 필요한 API·MCP 조사·추천·적용".

## 진단 (바꾸기 전)
- 처음 받는 묶음(boot) = 섬 `island` 3.55MB + 사람 `people` 4.5MB. **계절 행사 모델 10개(0.8MB)도 날짜와 상관없이 boot 에 들어가고 world 가 시작할 때 모두 풀었다** (GLTFLoader.parse).
- 게임이 열리고 3초 뒤 `prefetchPacks` 가 나머지 묶음(가구·아이템·아이콘 약 13MB)을 모두 쉬엄쉬엄 받는다 — 결국 한 번 열면 전부 받는 셈 (브라우저 캐시가 다음 방문을 줄임).
- 그리기 쪽은 이미 잘 돼 있었다: 배경은 InstancedMesh + 칸마다 화면 밖 빼기(`kit.js` prepareFrame) · 사양별 그리는 거리 · 캐릭터 화면 밖 빼기·뼈 텍스처 건너뛰기(`render/cull.js`) · 그림자 범위 맞추기 · 가림 투명. **남은 낭비: 화면 밖 주민의 AnimationMixer 가 매 프레임 돌았다.**

## 바꾼 것
| 곳 | 내용 |
|---|---|
| `assets/events/events.json` | 행사마다 `assets: { env: [...], items: [...] }` — 그 행사에서만 쓰는 모델 |
| `tools/build-web.mjs` | `SEASON_FILES` → 묶음 `season-<slug>` (봄 316KB · 여름 68KB · 가을 249KB · 겨울 209KB), boot 아님. 여러 행사가 같이 쓰는 간판은 섬 묶음. manifest 에 `season` |
| `src/core/packs.js` | `prefetchPacks({ seasons })` — 계절 묶음은 넣은 slug 만 미리 받음 |
| `src/world/index.js` · `objects.js` | 행사 모델은 처음에 안 읽고 `objects.add` 때 받아서 놓음(받는 동안 `remove` 되면 버림), `objects.ensure(kinds)` |
| `src/gameplay/events/index.js` | 열린 행사 = 모델까지 미리 풀기, 2일(`SOON_DAYS`) 안에 열릴 행사 = 묶음만 받기, `service.soon()` |
| `src/main.js` | 처음 미리 받기에 `seasons: events.soon()` |
| `src/render/cull.js` · `town/actor.js` | `culler.offscreen(root)` → 화면·그림자 밖 주민은 동작 계산을 쉬고 0.5초마다 밀린 시간만 맞춤 |

결과: boot 섬 묶음 3.55 → **2.90MB**, 행사 없는 날은 행사 모델 0개를 받고 0개를 푼다. 가을 날짜로 연 개발판에서 가을 모델만 풀림, 주민 7명 중 화면 밖 3명이 동작 계산 쉼. 테스트 374, `check-events --target=both` 7/8 (실패 하나 = 게시본 여름 「소원」 확인, main 에서도 같음 → QA 세션), 게시본 짧은 자동 플레이 막힘 0·오류 0.

## 조사한 API · 도구 · MCP
| 것 | 무엇 | 이 게임에 | 판단 |
|---|---|---|---|
| `EXT_disjoint_timer_query_webgl2` | GPU 시간 재기 | 이미 씀 (사양별 ms) | 유지 |
| `KHR_parallel_shader_compile` / `compileAsync` | 셰이더 미리 만들기 | 이미 씀 (멈춤 70ms 잡음) | 유지 |
| `requestIdleCallback` | 한가할 때 일하기 | 묶음 미리 받기에 씀 | 유지 |
| Page Visibility API | 탭이 숨으면 멈춤 | rAF 가 저절로 멈춤 | 할 것 없음 |
| PerformanceObserver (`long-animation-frame`) | 긴 프레임 원인 기록 | 기기 점검(`#check`)에 넣으면 좋음 | 다음 후보 |
| `navigator.deviceMemory`·`hardwareConcurrency`·`connection.saveData` | 기기·회선 힌트 | 처음 사양 고르기 보조 | 다음 후보 (작음) |
| OffscreenCanvas + Worker | 그리기를 다른 스레드로 | three 전체 구조 바꿈, 아티팩트 CSP 위험 | 안 함 |
| WebGPU (three WebGPURenderer) | 새 그래픽 API | 셰이더 패치(곡면·툰) 전부 다시 써야 함, 내장 그래픽 이득 불확실 | 보류 |
| **meshopt** (gltf-transform + MeshoptDecoder) | 모델 압축 | 잼: 원본 −51%, gzip 전송 −31%. **WASM 이 아티팩트 CSP 에 막힘** | 자체 웹 서비스로 갈 때 1순위 |
| KHR_mesh_quantization (양자화만) | WASM 없는 압축 | gzip 뒤 거의 같음 | 안 함 |
| Draco | 모델 압축 | WASM 필요 + 푸는 게 느림 | 안 함 |
| KTX2/Basis | 텍스처 압축 | 게임이 텍스처를 거의 안 씀 | 할 것 없음 |
| three-mesh-bvh | 광선 시험 빠르게 | 마우스 땅 찍기·가림 투명은 이미 가벼운 수식 | 안 함 |
| spector.js | WebGL 프레임 한 장 분해 | 사람이 볼 때 좋음 | 필요할 때 |
| stats-gl / three-perf | 화면 위 성능 표 | `?debug` 패널이 비슷한 것 | 안 함 |
| **chrome-devtools-mcp** (Google, 1.12.0) | Claude 가 Chrome 성능 기록(trace)·네트워크·콘솔을 직접 봄 | 긴 프레임·멈춤 원인 찾기에 가장 쓸모 | **설치함** (`.mcp.json`, `--isolated --no-performance-crux --no-usage-statistics`) — 다음 세션부터 |
| threejs-devtools-mcp | three 장면 살펴보기 MCP | 같은 이름 사본이 여러 계정에 흩어져 출처가 불분명 | 설치 안 함 |
| Playwright MCP | 브라우저 조작 | 이미 `tools/playtest.mjs`(CDP) 가 같은 일 | 안 함 |
| blender-mcp | Blender 대화 조작 | 리소스 문서 `local-resources.md` E 절 | 보류 |
