# P48 셰이더 적용 분석 · 추천 (2026-11-11)

브랜치 `p48-shader-study` (main bd74a46 에서). 사용자 요청: "셰이더 적용 관련해서 어떻게 셰이더 적용할 수 있는지 분석 보고 진행, 자주 쓰이는 셰이더 찾아서 현재 모델링·사양에 맞게 최적화 고려해서 셰이더 여러 개 추천".

결과물: 이 노트 · 검수 보드 `concept/shader-board.html` (게시 아티팩트 id `6ijKYZnTxNerwg3jwTa6Vp`, slug 2e5144b1-35ec-4c1b-bb4c-f2a477272543, capabilities db·user) (보드 id `shader`, 결정 D130–D139, 그림 `concept/shader/`) · 시제품 넷(`src/core/materials.js`, **기본 0 = 게임 모습 그대로**) · 재기 도구 `tools/perf-bench.mjs --variants` / `--looks`.

---

## 1. 지금 셰이더가 붙는 길 (코드 따라가기)

```
Blender 스펙 → .glb(.json) ─▶ applyToonStyle(root)           src/core/materials.js
                               ├ 재질 이름(= 스펙 팔레트 키) → toonMaterial(color, {name,…})
                               │    MeshToonMaterial + onBeforeCompile = patch(sh, opts)
                               │    MeshBasicMaterial(flat: 눈·볼) 도 같은 patch
                               ├ 외곽선 껍데기 outlineMaterial (BackSide, 법선 방향으로 부풀림)
                               └ merge: 캐릭터 부품 → [툰 · 평면 · 외곽선] 세 SkinnedMesh (aStyle 로 부품 효과)
world 배경 묶음(kit.js) ─▶ 합친 메시 + 꼭짓점 aStyle(styleClass(재질 이름)) + styleAttr:true
                               ↓  (재질 uniform 은 모두 materials.look 공용 객체를 가리킴)
render/index.js apply(p) ─▶ look.uXxx.value = 프리셋 값 × 사양 켜기(QUALITY[q].fx)
sky/index.js 매 프레임   ─▶ look.uCloudShadow · uCloudCover · uSkyZenithL … (시간·날씨)
render/post.js           ─▶ (높음만) 장면 HDR → 빛 번짐 → 틸트 흐림 → GradeShader(색 보정·비네트·sRGB) → FXAA
sky/dome.js              ─▶ 하늘 돔 ShaderMaterial (SKY_QUALITY 로 #define, 사양 바뀌면 다시 만듦)
```

### patch() 가 셰이더 글자를 바꾸는 자리 (three 0.170 MeshToon 조각 기준)

| 꼭짓점 | 하는 일 |
|---|---|
| 맨 앞 | `#define STYLE_*` (VARYINGS · WIND · WATER · PAINT_WORLD · ATTR · GLOW) + `uCurve`·`STYLE_VERT_PARS` |
| `begin_vertex` 뒤 | `WIND_GLSL` (바람) · `FADE_VERT` (디더 값) · 외곽선 부풀림. **표시 `#include <begin_vertex>` 는 남긴다** (kit 흔들림·물거품 패치가 그 뒤에 끼움) |
| `project_vertex` 대신 | `PROJECT_CURVED` (곡면 월드: 휘기 전 좌표를 `vStyleWorld` 로) + `STYLE_VERT_MAIN` (붓질 잡음은 꼭짓점에서) |

| 조각 | 하는 일 |
|---|---|
| `lights_pars_begin` 뒤 | `STYLE_FRAG_PARS` (uniform 선언·잡음·`styleBand`) |
| `lights_toon_pars_fragment` 대신 | `STYLE_LIGHTS` — `RE_Direct_Style`(띠 명암·색조·하이라이트) · `RE_IndirectDiffuse_Style` |
| `lights_fragment_begin` 대신 | 그림자 값을 `styleShadow` 로 따로 꺼낸 복사본 |
| `color_fragment` 뒤 | `STYLE_PAINT` (붓질 색) · 외곽선 색 |
| `aomap_fragment` 뒤 | `STYLE_COMPOSE` (접촉 그늘 · 구름 그림자 · 그늘 채도 · 림 · 물결 · 하늘 반사 · 빛나기) |
| `clipping_planes_fragment` 뒤 | `FADE_FRAG` (가림 디더) |
| (P48) `normal_fragment_maps` 뒤 | `STYLE_SNOW` (눈 쌓임 — 조명 전 바탕색) |
| (P48) `fog_fragment` 뒤 | `STYLE_HFOG` (낮은 안개) |

### 규칙 (지키면 사양·편집기·테스트가 저절로 맞는다)

1. **재질 이름 = 스펙 팔레트 키**. 효과를 고르는 표는 `STYLE_NAMES` (wind · water · spec · noAO · worldPaint · glow, P48: wet · noSnow). 합친 메시는 이름이 없으니 `styleClass(이름)` → 꼭짓점 `aStyle` (0 없음 · 1 바람 · 2 물결 · 3 하이라이트). 새 이름 갈래가 합친 배경에도 필요하면 aStyle 번호를 늘려야 한다 (kit.js 가 넣는다).
2. **값은 uniform, 갈래는 `if (u > 0.0)`**. 모든 조각이 같은 갈래를 타서(균일 분기) 0 이면 거의 공짜 → 사양 끄기 = uniform 0. `#define` 은 셰이더 글자가 달라져 프로그램이 늘고(`customProgramCacheKey` 의 `keyOf`), 프리셋·사양을 바꿀 때 다시 컴파일한다 → 정말 다른 모양(바람·물·평면)만.
3. **재질별 값**은 `toonMaterial` 의 `mat` (`uMatRim`·`uMatSpec`·`uMatAO`·`uMatPaint`, P48 `uMatWet`·`uMatSnow`) → `material.userData.style`.
4. **곡면 월드**: 효과는 휘기 전 월드 좌표 `vStyleWorld` 를 쓴다 (무늬가 땅에 붙음). 깊이·법선을 다시 그리는 override 재질(SSAO·SSR·깊이 프리패스)에는 곡면 패치가 없다 → 화면 효과는 **장면을 그린 결과(색·깊이 그림)만** 써야 한다.
5. **그림자 깊이 재질**(`shadowDepthMaterial`)은 곡면·디더 없음. 정점을 움직이는 효과(바람)는 여기도 같이 걸어야 그림자가 따라온다.
6. **사양 게이트**: `quality.js QUALITY[q].fx.<키>` → `render/index.js apply()` 에서 `look.uFoo.value = p.foo * on('키')`. 하늘처럼 `#define` 인 것은 `SKY_QUALITY` + `quality:changed` 로 다시 만든다.
7. **화면 효과는 높음만**: `QUALITY.mid.post = false`. 처음 사양(적정)에서는 빛 번짐·틸트·**색 보정·비네트도 안 걸린다** → 스타일 편집기에서 고른 색감(채도 1.12·따뜻함·보랏빛 띄우기·비네트 0.25)은 높음에서만 보인다. (D134)
8. **선형 색**: 화면 효과를 쓰면 장면은 선형 HDR. 새 `ShaderMaterial` 은 `skyOut()` 으로 내보내거나 `render/index.js linearize()` 가 붙여 준다.

### 새 셰이더 효과 하나를 넣는 길 (단계)

1. **어디에**: 대상 재질 이름 정하기 → `STYLE_NAMES` 에 집합(또는 기존 집합) · 합친 배경에도 걸려야 하면 `styleClass` 번호 + kit.js.
2. **uniform**: `look` 에 `uFoo: { value: 0 }` (0 = 지금 모습). 재질마다 다르면 `toonMaterial` `mat` 에 `uMatFoo`.
3. **셰이더 조각**: 조각 종류에 맞는 자리 — 바탕색(조명 전) `color_fragment`/`normal_fragment_maps` 뒤, 빛 계산 `RE_Direct_Style`, 마지막에 더하는 빛 `STYLE_COMPOSE`, 모양 `begin_vertex` 뒤(+ 그림자 깊이 재질), 화면 마지막 색 `fog_fragment` 뒤. 선언은 `STYLE_FRAG_PARS`/`STYLE_VERT_PARS`. 갈래는 `if ( uFoo * uMatFoo > 0.0 )`.
4. **값 연결**: 스타일 값이면 `presets.js PARAMS` 한 줄 + `presets.json` 프리셋마다 값(cozy·toon, `tests/style.test.mjs` 가 빠진 값을 잡음) + `render/index.js apply()` 에서 `look.uFoo.value = p.foo * on('foo')`. 시간·날씨로 바뀌는 값이면 sky 가 매 프레임 넣고 render 는 켜기(gate)만 (구름 그림자 `uCloudShadow × uCloudGate` 모양).
5. **사양**: `QUALITY[q].fx.foo` 를 넷 모두에 (빠지면 `on()` 이 1 로 본다) — `tests/check.test.mjs` 가 apply 줄 모양을 본다.
6. **스타일 편집기**: PARAMS 에 넣으면 슬라이더가 저절로 생긴다 (`style-editor.html` 이 PARAMS 로 만든다). 편집기 게시 파일 목록 `assets/style/editor-files.json` 은 새 모듈을 import 할 때만.
7. **재기**: `node tools/perf-bench.mjs --variants=<json>` (아래) 로 사양마다 GPU 차이 · `--looks=<json> --shots=<폴더>` 로 비교 사진.
8. **테스트**: `node --test tests/` (style · check · 재질 이름을 쓰는 world 테스트).
9. **문서**: `docs/SHADERS.md` 표 한 줄 + 사양 표.

---

## 2. 흔한 스타일라이즈드 셰이더 — 있는 것 · 없는 것 (코드로 확인)

| 셰이더 | 지금 | 어디 |
|---|---|---|
| 램프·띠 툰 명암 | 있음 (램프 그림 대신 띠 수·경계 값) | `materials.js styleBand` |
| 색조 그늘·따뜻한 햇빛·그늘 채도 | 있음 | `RE_Direct_Style` · `STYLE_COMPOSE` |
| 림 라이트 | 있음 (캐릭터 더 세게) | `STYLE_COMPOSE` |
| 셀 하이라이트 | 있음 (이름 표 spec · aStyle 3) | `RE_Direct_Style` |
| 외곽선 | 껍데기만 (화면 Sobel 없음) | `outlineMaterial` |
| 바람 흔들림(정점) + 그림자 따라감 | 있음 | `WIND_GLSL` · `shadowDepthMaterial` |
| 잎 뒤 비침(SSS) | **없음** → P48 시제품 `uLeafLight` | — |
| 물: 얕은 물빛·물가 거품·밀려오는 물결 줄 | 있음 (바다) · 강 거품 | `world/coast.js` `SEA_FRAG` · `world/banks.js` |
| 물: 반짝임·하늘 반사 | 있음 | `styleWater` · `uSkyReflect` |
| 물: 카우스틱 | **없음** | — |
| 디더 투명 | 있음 (카메라 가림) | `FADE_FRAG` |
| 붓질 색 얼룩 · 가짜 접촉 그늘 · 구름 그림자 · 스스로 빛나기 | 있음 | `STYLE_PAINT` · `STYLE_COMPOSE` |
| 하프톤·해칭 | **없음** | — |
| 화면 외곽선(Sobel) | **없음** | — |
| 빛 번짐 · 틸트 흐림 · 색 보정 · 비네트 · FXAA | 있음, **높음만** | `render/post.js` |
| 색 보정 LUT | **없음** (숫자 값 보정만) | — |
| 거리 안개 | 있음 | three `Fog` (sky) |
| 높이 안개 | **없음** → P48 시제품 `uHeightFog` | — |
| 눈 쌓임(법선 위쪽) | **없음** → P48 시제품 `uSnowCover` (지금은 삼나무만 눈 모델) | — |
| 젖음 | 일부: 땅 색 30% 어둡게(CPU) → P48 시제품 `uWetSheen` 윤기 | `sky/surfaces.js` |
| 반짝임(글리터) | **없음** (물결 반짝 점만) | — |
| 하늘(그라데이션·툰 구름·빛살·은하수·별) | 있음 | `sky/dome.js` |

---

## 3. 재 본 값 (Intel UHD 내장 · 머리 없는 Chrome ANGLE D3D11 · 1280×800 · 광장)

기준 (P48 시작, `node tools/perf-bench.mjs --scenes=plaza-day,plaza-night`):

| 사양 | 광장 낮 | 광장 밤 | 그리기 호출 · 삼각형 |
|---|---|---|---|
| 높음 | 11.21 ms | 10.59 ms | 170 · 1338k |
| 적정 | 4.87 | 4.93 | 104 · 670k |
| 낮음 | 3.30 | 3.35 | 63 · 510k |
| 매우 낮음 | 1.95 | 1.94 | 60 · 425k |

(11-04 값 9.9 · 5.1 · 3.7 · 2.5 보다 높음은 조금 늘고 나머지는 줄었다 — 그 뒤 들어온 밤·시계 등과 재는 날 차이.)

시제품·있는 효과 켜고 끄기 (`--variants`, 같은 페이지에서 기준 → 켜기 → 기준, 차이 = 앞뒤 기준 평균과):

칸 = **광장 낮 · 밤** GPU 차이 (ms, − 는 줄어듦). 적정·낮음·매우 낮음은 3회, 높음은 5회 다시 잰 값.

| 갈래 | 높음 | 적정 | 낮음 | 매우 낮음 |
|---|---|---|---|---|
| 이 실행의 기준 | 10.0 · 10.5 | 5.3 · 5.3 | 3.3 · 3.4 | 1.9 · 2.0 |
| 눈 쌓임 `uSnowCover 1` | −0.7 · +0.3 | +0.04 · −0.16 | −0.01 · −0.01 | −0.01 · −0.02 |
| 잎 뒤 비침 `uLeafLight 1` | −0.7 · +0.1 | +0.22 · −0.03 | +0.02 · −0.01 | +0.06 · 0 |
| 젖은 땅 윤기 `uWetSheen 1` | −0.6 · +0.3 | +0.23 · 0 | +0.10 · +0.06 | +0.07 · +0.03 |
| 낮은 안개 `uHeightFog 1` | −0.4 · +1.3 | +0.06 · +0.01 | +0.03 · +0.01 | +0.05 · 0 |
| 넷 다 | −0.7 · +0.9 | +0.23 · +0.24 | +0.11 · +0.04 | +0.07 · +0.13 |
| (있는 것) 외곽선 끄기 | −0.9 · −0.3 | **−0.31 · −0.31** | 이미 꺼짐 | 이미 꺼짐 |
| (있는 것) 화면 효과 끄기 = 바로 그리기 + MSAA | **−2.0 · −1.2** | 이미 꺼짐 | | |
| (있는 것) 화면 효과 = 색 보정만 (FXAA·MSAA 없음) | −2.8 · −2.0 | | | |
| (있는 것) 화면 효과 = 색 보정 + FXAA | −1.5 · −0.9 | | | |

읽는 법:
- **시제품 넷은 사실상 공짜**: 적정·낮음·매우 낮음에서 넷 다 켜도 +0.25ms 안 (적정 5.3ms 의 5% 안). 이유: 모두 uniform 갈래 + 몇 줄 계산이고, 젖은 땅만 64×64 그림 1번 읽기. 눈 쌓임은 바탕색만 바꿔서 0.
- **높음은 재는 오차가 ±1ms** (같은 기준을 앞뒤로 재도 9.7~11.5ms — 내장 그래픽 클럭이 오르내림). 높음 칸의 ± 는 효과 값이 아니라 흔들림이다.
- 적정에서 **외곽선이 0.31ms (6%)**, 높음에서 **화면 효과 다섯 단이 1.2~2.0ms** — 지금 셰이더 중 가장 비싼 둘.
- 화면 효과를 "색 보정만" 으로 줄이면 바로 그리기(MSAA)보다 **오히려 0.8ms 싸다** (MSAA 를 안 해서). "색 보정 + FXAA" 는 바로 그리기보다 +0.3~0.5ms → **적정에 색 보정을 켜는 비용(D134)은 0.5ms 안팎**으로 어림한다 (적정은 화소 배율 1 이라 더 작을 것, 반영 때 다시 잰다).
- 화면을 2× 로 늘리는 휴대폰·큰 화면은 조각 비용이 화소 수에 비례 — 시제품은 조각마다 몇 줄이라 그래도 0.5ms 안쪽으로 본다.

---

## 4. 추천 (우선순위)

우선순위 = 보이는 효과 ÷ 비용 · 지금 모델과의 맞음. **보드 shader D130–D139** 에서 고른다 (추천안 미리 표시).

| 순위 | 보드 | 셰이더 | 좋아지는 것 | 붙는 자리 | 비용 (잰 값/어림) | 사양 (추천) | 모델과 맞음 · 주의 | 크기 |
|---|---|---|---|---|---|---|---|---|
| 1 | D133 | **낮은 안개** (시제품) | 새벽·비 오는 날 바다·물가에 안개 → 섬 분위기·깊이. 선착장에서 특히 | 재질 `fog_fragment` 뒤 | 적정 +0.06 | 모든 사양 | 모든 툰 재질(인스턴스·스킨 포함) 그대로. 하늘 돔·`ShaderMaterial`(빛무리·불꽃)엔 안 걸림 → 안개 색 = 지평선 색이라 티 안 남. 실내는 sky 가 안개를 멀리 밀어 꺼짐 | 작음 (sky 가 시간·날씨로 세기 넣기 + PARAMS 2) |
| 2 | D130 | **눈 쌓임** (시제품) | 겨울에 땅·지붕·잎 위가 하얘져 계절이 확 바뀜 (지금은 삼나무 모델만 바뀜) | 재질 `normal_fragment_maps` 뒤 (조명 전 바탕색) | 적정 0.0 | 모든 사양 | 법선 위쪽이라 Blender 모델·합친 배경 묶음 모두 맞음. 물(이름·aStyle 2)·불·창·캐릭터 뺌. 외곽선 껍데기는 바탕색 섞기라 눈 위 외곽선이 원래 색 쪽으로 남을 수 있음 → 반영 때 외곽선 바탕색도 눈 쪽으로 (`uOutlineBase` 섞기) | 작음 (sky: 날씨 snow·겨울로 세기, 그친 뒤 천천히) |
| 3 | D132 | **젖은 땅 윤기** (시제품) | 비 오는 날 길·돌이 하늘빛으로 반들 + 물웅덩이 얼룩 (지금은 어둡게만) | `STYLE_COMPOSE` (땅 이름 재질 `uMatWet`) | 적정 +0.23 | 높음·적정·낮음 | 땅 재질 이름 = surfaces.js `WET` 과 같은 표. 합친 배경 묶음(kit)의 땅이 `ground` 하나라 거기엔 걸리지만 묶음 안 돌·길 조각엔 이름이 없어 안 걸림 → 필요하면 aStyle 4 | 작음 |
| 4 | D134 | **적정에 색 보정 + 비네트** | 처음 사양에서도 편집기에서 고른 색감(채도·따뜻함·보랏빛 띄우기·비네트). 지금은 높음만 | 화면 효과 1단 (`GradeShader` 다시 씀) + FXAA | 어림 +0.5 | 적정 (높음은 지금대로) | 셰이더 재질은 그대로. 적정은 MSAA 를 쓰는데 화면 효과 버퍼는 MSAA 가 없음 → FXAA 로 대신 (또는 `samples: 4` 버퍼 — 더 비쌈). `post.js` 에 "lite" 모양 + `QUALITY.mid.post: 'grade'` | 중간 |
| 5 | D131 | **잎 뒤 비침** (시제품) | 아침·노을에 나무·풀·꽃이 빛을 머금음. 은은함 | `STYLE_COMPOSE` (바람 재질·aStyle 1) | 적정 +0.22 | 높음·적정·낮음 | 이름 표 wind 와 합친 배경 aStyle 1 그대로. 위에서 내려다보는 카메라라 해를 마주 보는 일이 적어 효과가 약함 — 그늘 쪽 비침이 대부분. 노을 사진에서도 은은한 정도 | 작음 |
| 6 | D136 | 물 빛 그물 (카우스틱) | 얕은 물가에 일렁이는 빛 무늬 → 여름 바다 | 바다 `SEA_FRAG`(coast.js 거리장) · 강 aStyle 2 | 어림 +0.1~0.2 (그림 2번 읽기, 물 화소만) | 높음·적정 | 바다는 해안 거리장이 있어 얕은 곳 고르기 쉬움. 강은 둑 거리장(banks) | 작음~중간 |
| 7 | D137 | 반짝임 (글리터) | 눈·젖은 땅(·모래)에 작은 반짝이 → 걸으면 반짝 | 땅 재질 (월드 격자 해시) | 어림 +0.1 | 높음·적정 | D130·D132 와 같이 켤 때만 의미. 멀리선 지글거림 → `fwidth` 로 줄이기(물결과 같은 방법) | 작음 |
| 8 | D135 | 화면 외곽선 (Sobel) | 먼 경계·땅 경계까지 선 | 화면 효과 (깊이 그림 + 전체 화면 1번) | 어림 +0.8~1.5 (높음) | 추천 안 함 (껍데기 유지) | 곡면 월드 뒤 깊이라 어긋나진 않지만 은은한 물체 색 선(지금 cozy)과 결이 다름. 껍데기를 빼면 적정 −0.3ms 지만 선 모양이 바뀜 | 중간 |
| — | D138 | 색 보정 LUT | 시간대 영화 색감 | 화면 효과 | 어림 +0.1 | 추천 안 함 | 시간대 색은 sky 팔레트가 이미 맡아 두 군데 고치게 됨 | 작음 |
| — | D139 | 하프톤·해칭 | 만화 인쇄 느낌 | 재질 그늘 | 어림 +0.05 | 추천 안 함 | 동숲풍(부드러운 파스텔)과 결이 다름 | 작음 |

이미 있어서 추천에서 뺀 것: 띠·램프 명암 · 림 · 셀 하이라이트 · 바람 · 디더 투명 · 물가 거품·얕은 물빛 · 빛 번짐 · 비네트(높음) — 값 조절은 스타일 편집기 몫.

**반영할 때 공통 모양** (보드에서 고른 뒤 "검수 보드 반영"):
1. 시제품 uniform 은 이미 있다 → `presets.js PARAMS` 에 세기 값(`snow`·`leafLight`·`wetSheen`·`heightFog`, 묶음 「날씨·계절」) + `presets.json` (toon 0 · cozy = 고른 값) + `render/index.js apply()` 에 `* on('<키>')`.
2. 날씨·시각으로 바뀌는 셋(눈·젖음·안개)은 구름 그림자처럼 **sky 가 매 프레임 세기 × 날씨**를 넣고(`uSnowCover = p.snow × 눈 정도`, `uWetSheen = p.wetSheen × wx.wet`, `uHeightFog = p.heightFog × (새벽 정도 + 비)`) render 는 사양 켜기(`uXxxGate`)만 — 값과 켜기를 두 uniform 으로 나누거나 sky 가 `style.get()` 값을 곱한다.
3. `QUALITY[q].fx` 에 키를 넷 모두 (`snow` · `leaf` · `wet` · `hfog`), 고른 사양대로.
4. 스타일 편집기는 PARAMS 로 슬라이더가 저절로 생긴다 (날씨·시간 단추가 이미 있어 바로 확인).
5. `node --test tests/` · 게임 겨울(`?date=2027-01-15`)·비·새벽 사진 · perf-bench 로 다시 재기.

---

## 5. 시제품 (기본 꺼짐)

`src/core/materials.js` — `look` 에 `uSnowCover`·`uSnowColor`·`uLeafLight`·`uWetSheen`·`uHeightFog`·`uHeightFogTop`, 재질별 `uMatWet`·`uMatSnow`, 이름 표 `STYLE_NAMES.wet`·`noSnow`, 조각 `STYLE_SNOW`(normal_fragment_maps 뒤)·`STYLE_HFOG`(fog_fragment 뒤), `STYLE_COMPOSE` 안 잎 뒤 비침·젖은 땅 윤기. 모두 `if (u > 0.0)` 갈래라 값 0 이면 게임 모습은 그대로다 (`PARAMS`·`presets.json`·`QUALITY.fx` 는 아직 안 건드림 — 보드에서 고른 뒤 "검수 보드 반영" 때).

콘솔에서 보기: `__island.materials.look.uSnowCover.value = 0.6` · `uLeafLight` · `uWetSheen` · `uHeightFog`.

재기 도구 `tools/perf-bench.mjs`:
- `--variants=<json>` `[{ name, look: { uFoo: 1 }, style: { bloom: 0 } }]` — 장소·사양마다 기준 → 갈래 → 기준.
- `--looks=<json> --shots=<폴더>` `[{ slug, hour, weather, look, style }]` — 재지 않고 비교 사진만 (`<slug>-<장소>-<사양>.png`). 보드 그림은 이것으로 찍어 640×400 jpg 로 줄였다.

---

## 6. 문서 세션이 반영할 문장

- **CLAUDE.md 「렌더링 규칙」** 끝에: "새 셰이더 효과를 넣는 길(이름 표 → look uniform → 조각 자리 → PARAMS·presets → QUALITY.fx → 재기)은 `docs/notes/p48-shader-study.md` 1절. P48 시제품 uniform(`uSnowCover`·`uLeafLight`·`uWetSheen`·`uHeightFog`)은 기본 0 이고, 셰이더 검수 보드 shader(D130–D139)에서 고른 뒤 반영한다."
- **CLAUDE.md 「사양」**: "`QUALITY.mid.post = false` 라 처음 사양(적정)에는 색 보정·비네트도 없다 — D134 결정 대기."
- **CLAUDE.md 명령어 표** `perf-bench` 줄에 `[--variants=<json>] [--looks=<json> --shots=<폴더>]` 를 더한다.
- **docs/SHADERS.md**: 「새 재질 효과 더하기」 1번 앞에 "조각 자리 표"(이 노트 1절 두 표)를 옮기고, 「효과마다 어디에 있나」 표에 시제품 넷을 "시제품(꺼짐)" 으로 한 줄씩.
- **concept/README.md 보드 목록**: `shader` · 셰이더 검수 보드 · 결정 D130–D139 · 링크 아티팩트 id `6ijKYZnTxNerwg3jwTa6Vp`.
- **편집기 홈 `editors.html` 의 `editors-list`** (group `board`) 에 shader 보드를 더한다.
- **devlog 「게시물」**: 셰이더 검수 보드 v0.1 아티팩트 id `6ijKYZnTxNerwg3jwTa6Vp` (2026-11-11).

---

## 7. 반영 v1 (2026-11-12, 보드 shader 사용자 선택 + "최대한 저사양에서 돌아가게")

보드 `boards/shader` v1 선택: D130-B(all) · D131-A(hml) · D132-A(hml) · D133-A(all) · D134-A · D135-A · D136-A(hm) · D137-A(hm) · D138-A · D139-A, 의견 없음.

### 사양별로 실제로 켜진 것

| 결정 | 높음 | 적정 | 낮음 | 매우 낮음 |
|---|---|---|---|---|
| D130-B 눈 쌓임 (눈 오는 날만, 세기 1) | 셰이더 (눈 예보가 있는 날만 넣음) | 셰이더 (같음) | 셰이더 없이 위를 보는 꼭짓점 색을 눈 색으로 (CPU — 섬 땅 + 배경 묶음 풀·지붕·나무 위) | 같음 (CPU) |
| D131-A 잎 뒤 비침 0.6 | ✅ | ✅ | — ¹ | — |
| D132-A 젖은 땅 윤기 (비 × 1) | 셰이더 (비 예보가 있는 날만) | 셰이더 (같음) | 예전처럼 어둡게만 | 예전처럼 어둡게만 |
| D133-A 낮은 안개 (새벽 0.6 · 비 0.4) | 셰이더 | 셰이더 | 거리 안개를 당김 (CPU, GPU 0) | 거리 안개 당김 |
| D134-A 색 보정·비네트 | 화면 효과 다섯 단 (그대로) | **색 보정 + FXAA** (`post: 'grade'`, 빛 번짐·흐림 없음) | — | — |
| D135-A 외곽선 | 껍데기 그대로 | 그대로 | (꺼짐 그대로) | (꺼짐 그대로) |
| D136-A 물 빛 그물 0.5 | ✅ 얕은 바다 | ✅ | — | — |
| D137-A 반짝임 1 | 눈·비 오는 날 | — ² | — | — |
| D138-A LUT · D139-A 하프톤 | 안 함 | 안 함 | 안 함 | 안 함 |

¹ 보드는 높음·적정·낮음(hml)이었지만, 낮음에서 셰이더로 넣으면 GPU 가 늘어서(아래) 사용자 조건 「낮음·매우 낮음은 늘지 않게」를 따라 뺐다.
² 보드는 높음·적정(hm)이었지만, 적정에서 눈·젖음과 같이 넣으면 +0.6ms 라 높음만.

### 저사양을 위해 바꾼 구조 — 셰이더 글자째 넣고 빼기

재 보니 **uniform 0 으로 건너뛰는 갈래도 공짜가 아니었다** (Intel UHD · ANGLE D3D11). 같은 페이지에서 번갈아 잰 값:

| 시도 | 낮음 광장 낮 | 매우 낮음 광장 낮 |
|---|---|---|
| main (반영 전) | 2.70 ~ 2.86 | 1.68 ~ 1.72 |
| 효과를 조각 셰이더 갈래로 늘 넣음 (값 0) | 3.36 (+0.55) | 1.97 (+0.28) |
| 갈래 안 그림 읽기를 `textureLod`·`fwidth` 빼기 | 3.36 (그대로 — 갈래 펴짐이 원인이 아님) | 1.96 |
| 꼭짓점에서 세어 조각은 섞기만 | 3.08 (+0.27) | 1.88 (+0.2) |
| **셰이더 글자를 빼고 CPU(땅 색·거리 안개)로** | **2.77 ~ 2.81 (±0)** | **1.66 ~ 1.71 (±0)** |

적정에서도 같았다: 효과 여섯을 다 넣어 두면 맑은 날에도 +1.27ms. 하나씩 넣어 보면 눈 0.29 · 잎 0.21 · 안개 0.13 · 젖음 0.12 · 반짝임 0.01 · 물 빛 그물 0, 여럿이면 더한 값보다 커진다 (레지스터가 늘어 GPU 가 동시에 덜 돌리는 것으로 본다). 눈과 반짝임을 같이 넣으면 눈만 넣을 때보다 +0.6ms 더 든다.

그래서:
- `core/materials.js` `setShaderTier(목록)` — 넣을 효과마다 `#define STYLE_FX_<이름>` (SNOW · HFOG · LEAF · WET · GLITTER · CAUSTIC). 툰 재질의 프로그램 열쇠에 목록이 들어가고, 바뀌면 툰 재질만 `needsUpdate`. world 의 kit·banks·coast 덧씌우기는 열쇠를 **그때그때** 읽게 바꿨다 (예전엔 만들 때 한 번 읽어 굳혀 둠).
- `render/quality.js` `QUALITY[q].shaderFx`: 높음·적정 `'full'`, 낮음·매우 낮음 `'lite'` (아무것도 안 넣음). `main.js` 가 재질을 만들기 전에, `render.setQuality` 가 바꿀 때 건다.
- `sky/index.js` `syncShaderFx()`: 높음·적정에서 **오늘 예보로** 고른다 — 잎·안개·물 빛 그물은 늘, 눈은 눈 예보가 있는 날, 젖음은 비·무지개가 있는 날, 반짝임(높음)은 그 둘과 같이. 다시 만드는 때 = 처음 · 하루가 바뀔 때(05:00) · `setWeather` · 사양 바꿀 때. **날씨가 바뀔 때마다 다시 만들지 않는다** (하루에 한 번 이하).
- 셰이더에 눈·안개가 없으면 sky 가 대신: 눈 = `surfaces.js snowVerts` 가 섬 땅(`ground`)·배경 묶음(`kit-toon`) 메시의 **꼭짓점 색**을 위를 보는 만큼(법선 y) 눈 색(#EEF2FA)으로 85% 까지 섞는다 (물 aStyle 2 는 빼고, 눈 양 0.05 단위로만, 프레임마다 꼭짓점 3만 개까지 나눠 써서 CPU 한 프레임 11ms 안 — 처음엔 재질 색만 바꿨는데 섬 땅은 색이 꼭짓점 색이라 곱하기로는 하얘지지 않았다). 꼭짓점 색 없는 땅 재질은 재질 색. 안개 = 거리 안개 near ×(1−0.45f) · far ×(1−0.3f). GPU 몫 0.
- 세기: render `apply()` → `look.uLeafLight·uCaustic·uGlitter` 는 바로, 날씨 셋은 `materials.weatherFx` 에 두고 sky 가 매 프레임 곱한다 (눈은 눈 오는 동안 40초에 쌓이고 그치면 150초에 녹음, 처음·`setWeather({instant})` 는 바로).
- 셰이더 프로그램 수: 사양 하나 안에서는 늘지 않는다 (효과는 uniform 값으로 켜고 끔). 열쇠가 바뀌는 날(눈·비 예보 날)에 툰 프로그램을 한 번 다시 만든다.

### 반영 전후 GPU 시간 (Intel UHD · 1280×800, ms — main bd74a46 → 이 브랜치, 같은 때 차례로)

| 사양 | 광장 낮 | 광장 밤 | 투어 섬 |
|---|---|---|---|
| 높음 | 9.22 → 9.54 (+0.32) | 9.11 → 9.36 (+0.25) | 6.71 → 6.96 (+0.25) |
| 적정 | 4.80 → 5.39 (+0.59) | 4.89 → 5.29 (+0.40) | 3.90 → 4.59 (+0.69) |
| 낮음 | 2.82 → 2.78 (±0) | 2.81 → 2.84 (±0) | 2.50 → 2.58 (±0.1, 투어는 흔들림 큼) |
| 매우 낮음 | 1.69 → 1.66 (±0) | 1.69 → 1.68 (±0) | 1.12 → 1.00 (±0.1) |

적정의 +0.4~0.7 = 색 보정+FXAA(MSAA 바로 그리기와 거의 같음, 재 보니 +0.1) + 맑은 날 셰이더(잎·안개·물 빛 그물 ≈ +0.36). 날씨 날 (광장 낮, 그날 셰이더까지): 적정 눈 +0.26 · 비 +0.26 더, 높음 눈 +0.9 · 비 +0.6 더 (반짝임 포함). 낮음·매우 낮음은 눈·비 날에도 ±0.05 안.

실내는 GPU 를 따로 재지 않았다 — 집 안에서는 sky 가 눈·젖음·안개 세기를 0 으로 둬서 맑은 날 광장과 같은 셰이더 몫(잎·물 빛 그물은 실내에 거의 없음). 회귀는 아래 점검으로 봤다.

### 그 밖에 바뀐 것
- `presets.json` cozy: `leafLight 0.6 · glitter 1 · caustic 0.5 · snow 1 · wetSheen 1 · heightFog 1`, toon 은 모두 0. **`version` 은 올리지 않았다** (스타일 편집기 반영 번호 applied/style 과 따로 — 다음 "스타일 반영" 때 같이).
- `PARAMS` 6줄 (빛: 잎 뒤 비침·반짝임 / 움직임: 얕은 물 빛 그물 / 새 묶음 「날씨·계절」: 눈 쌓임·젖은 땅 윤기·낮은 안개) → 스타일 편집기에 슬라이더가 저절로 생긴다.
- 테스트: `check.test.mjs` (적정 `post: 'grade'`, 새 fx 키 사양표), `mouse.test.mjs` (sky `tier` 줄 모양).
- `tools/perf-bench.mjs --variants` 갈래에 `weather`·`tier` 를 더함 (`tier: 'lite' | ['snow', …]`).

### 문서 세션이 반영할 문장 (반영 v1)
- **CLAUDE.md 「렌더링 규칙」**: "셰이더 보드 효과(눈·잎 뒤 비침·젖음·낮은 안개·물 빛 그물·반짝임)는 `#define STYLE_FX_*` 로 **필요한 날만 셰이더 글자째** 넣는다 (`materials.setShaderTier`, sky `syncShaderFx` 가 오늘 예보로 고름). uniform 0 갈래도 내장 그래픽에선 비용이 있어서다 — 새 효과도 이 모양을 따른다. 낮음·매우 낮음은 넣지 않고 눈·안개만 CPU(땅 색·거리 안개)로."
- **CLAUDE.md 「사양」**: 적정 `post: 'grade'` (색 보정 + FXAA), `shaderFx` 줄, 사양표는 이 노트 7절.
- **docs/SHADERS.md**: 「효과마다 어디에 있나」 표에 여섯 줄 + 사양표 열 여섯 개, 「새 재질 효과 더하기」에 "갈래도 비용 — 큰 효과는 `STYLE_FX_*` 로 넣고 빼기".
- **concept/README.md 보드 목록**·**편집기 홈 목록**: shader 보드 (아티팩트 id `6ijKYZnTxNerwg3jwTa6Vp`) 반영 v1.

### 회귀 점검 · 사진
- `node --test tests/` 468 통과 (1 건너뜀 그대로).
- `node tools/check-clock.mjs --port=4284` 15가지 실패 0 · `node tools/check-interiors.mjs --port=4285 --hours=10,23` 문제 0 (`docs/qa/runs/2026-11-12-01-16-clock`, `…-01-17-interiors`).
- 사진 `concept/shader/v1-<장면>-<사양>.jpg` (광장 낮·밤·비·눈 · 새벽/낮 선착장, 높음·적정·낮음 + 매우 낮음 눈·새벽). 날짜 2026-11-12 + `setWeather` 로 비·눈.
- 브라우저에서 사양 넷을 오가며 셰이더 오류 없음 (콘솔 오류 0).
