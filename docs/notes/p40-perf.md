# p40-perf 최적화 다시 — 처음 받는 크기 줄이기 (진행 중)

2026-11-11, 브랜치 `p40-perf` (main 8eb29b2 에서). **사용 한도 때문에 중간에 멈춤** — 아래 「남은 일」.

## 잰 방법
- `tools/perf-bench.mjs` (새 도구): 머리 없는 Chrome(ANGLE D3D11, 진짜 Intel UHD)으로 1280×800, 이름·첫 장면은 실제 단추·Esc 로 넘기고 플레이어만 옮겨 잼.
  GPU = 프레임마다 `EXT_disjoint_timer_query_webgl2` (첫 `renderer.render` ~ 프레임 끝), 쉬지 않고 90프레임 × 3번의 가운데 값.
  `--probe` = 장면 맨 위 자식을 하나씩 숨겨 GPU 차이, `--editors` = 편집기 처음 여는 시간(아직 안 돌림).
- 11-06 기준(p29 합친 8d4e956)과 지금 main(8eb29b2)을 **같은 도구·같은 때 번갈아** 쟀다 (다른 세션이 GPU 를 같이 쓰면 값이 튐 — 아래 높음 32.9 같은 값은 버림).

## 처음 받는 크기 (`node tools/build-web.mjs` boot 묶음)
| | 섬 묶음 | 사람 묶음 | boot 합 | 게시 파일 | 묶음 수 | 전체 묶음 |
|---|---|---|---|---|---|---|
| 11-06 (p29) | 2.90MB | 4.5MB | 7.4MB | 145 | — | — |
| 지금 main (전) | 3.22MB | 8.26MB | 11.48MB | 202 | 17 | 26.64MB |
| **p40 (후)** | **2.46MB** | **3.64MB** | **6.10MB** | 202 | 17 | **21.50MB** |

바꾼 것:
1. `tools/glb-quantize.mjs` (새): 게시 묶음을 만들 때만 모델의 법선 float×3 → byte×3(normalized, `KHR_mesh_quantization`), 뼈 가중치 float×4 → byte×4(합 255). 자리·인덱스·애니메이션은 그대로. WASM 없음 → CSP 문제 없음, three GLTFLoader 가 그대로 읽음. 모델 전체 22.6 → 17.3MB (캐릭터 −28%). 원본 `assets/` 와 개발 서버는 그대로. `--no-quantize` 로 끔.
2. `tools/build-web.mjs` PACKS: `night` 묶음(밤 건물·등불 모델 + 별밤·여명 모델, `night.json assets`) · `movers` 묶음(`arrives: "moving"` 주민 모델 — 파도·구름·달무리). 스펙 JSON 은 boot 그대로(작고 시작할 때 읽힐 수 있음). 둘 다 world lazy·`keeperOf`·이사 입주 때 처음 읽힘.
3. 테스트: `tests/glb-quantize.test.mjs` (자리·인덱스·애니메이션 바이트 같음, 법선 1.5/127 안, 가중치 합 1) · `tests/build-web.test.mjs` 모델 비교를 「줄인 원본」으로.
4. `src/core/assets.js` `cacheStats()` (확인용: 읽은 모델·JSON 수).

## GPU 시간 (광장, ms — 같은 도구 번갈아, 1회차)
| 사양 | 11-06 코드 낮/밤 | 지금 main 낮/밤 | CLAUDE.md 11-04 (다른 방법) |
|---|---|---|---|
| 높음 | 10.1 / 10.4 | 10.5 / 10.4 (1번째 값, 나머지는 다른 세션 GPU 겹침) | 9.9 |
| 적정 | 4.96 / 5.00 | 5.03 / 4.93 | 5.1 |
| 낮음 | 2.85 / 2.89 | 2.85 / 2.92 | 3.7 |
| 매우 낮음 | 1.72 / 1.72 | 1.84 / 1.77 | 2.5 |

→ 밤·투어·M10 이 들어와도 광장 GPU 는 11-06 과 거의 같다 (차이 ±0.1ms = 잼 흔들림). 적정 쪼개 보기: 땅 판(terrain) 1.2ms(364k 삼각형, 이미 칸 묶음·칸 컬링), 나머지는 화소 채우기(땅·하늘 셰이더). 지금 main 전체(높음·적정·낮음·매우 낮음 × 광장 낮·밤·투어): `p40-perf-before.json`.

이미 돼 있어서 할 것 없던 것: 야시장 노점·등불·섬 꾸미기 물건·야외 가구 = 모두 `objects.add` → kit InstancedMesh 칸 묶음(화면 밖 칸 빼기 포함). 화면 밖 주민 동작·뼈대 갱신 쉬기(cull.js)는 주민 수만큼 저절로 늘어남(주민 한 명 = 뼈대 하나·뼈대 메시 3개). 하늘(`SKY_QUALITY`)·불꽃(`FIREWORK_QUALITY`)은 이미 사양별.

## 남은 일 (다음 세션)
- 줄인 모델로 게시본(`/artifact/`, `perf-bench --target=artifact`) 화면·GPU 비교 스크린샷 (전: scratchpad before/*.png) — **아직 화면 비교 안 함**.
- 야시장 측정: 바뀐 driver(토요일까지 시계 옮김)로 다시 (첫 기준 측정은 금요일로 잡혀 노점 0).
- `node --test tests/` 전체, 자동 플레이 `--only=boot,naming,arrival,night,tour` (dev·artifact).
- 편집기 넷 `perf-bench --editors` (리소스 편집기 게시 90파일·170MB, 스토리 74, 요소 38).
- 더 줄일 후보: 이삿짐·풍선(moving-boxes·party-balloons 190KB)도 lazy.
- 정리: 비교용 worktree `island-worktrees/island-worktrees/p40-base`(8eb29b2)·`p40-old`(8d4e956), 서버 4251·4252.

## 문서 세션에 (CLAUDE.md 「웹 배포」에 더할 문장)
- "게시 묶음의 모델은 `tools/glb-quantize.mjs` 로 법선·뼈 가중치를 줄여 넣는다(원본·개발 서버는 그대로). 밤 모델·이사 오는 주민 모델은 `night`·`movers` 묶음(처음에 받지 않음)."
