# 스타일 셰이더 안내 (동숲풍 3D 모습)

3D 모델(캐릭터 9종 · 배경 32종)은 그대로 두고 **그리는 방식만** 바꿔서 부드럽고 장난감 같은 동숲풍 모습을 낸다.
비교·조절은 스타일 편집기 `style-editor.html` (링크 https://claude.ai/artifact/EWuGKbMpo9uTjLEUzhT2Pd), 값은 `assets/style/presets.json`, 예전 모습은 주소 뒤에 `?style=toon`.

## 한눈에

```
모델 ─▶ 재질 (src/core/materials.js)             ─▶ 화면 효과 (src/render/post.js)                          ─▶ 화면
        띠 명암 · 보랏빛 그늘 · 따뜻한 햇빛            장면(선형 HDR) → 빛 번짐 → 위쪽 흐림 → 색 보정 → FXAA
        가장자리 빛 · 장난감 하이라이트
        붓질 색 · 접촉 그늘 · 바람 · 물결 · 외곽선
                          ▲                                          ▲
                          └─ 값(프리셋) assets/style/presets.json ─┘   src/render/presets.js 가 읽고 ctx.services.style 이 나눠 넣는다 (src/render/index.js)
```

- 모든 값은 **uniform** 이라 슬라이더를 움직여도 셰이더를 다시 만들지 않는다 (끊김 없음).
- 프리셋 두 개: `cozy` (새 기본, 동숲풍) · `toon` (2차 이전 모습: 2단 명암, 갈색 잉크 외곽선, 화면 효과 없음). 값은 `assets/style/presets.json` (6차 M6-P6 부터 — 편집기에서 고르고 채팅 "스타일 반영"), 조절 값 표(이름·묶음·범위)는 `src/render/presets.js` 의 `PARAMS`.

## 효과마다 어디에 있나

| 효과 | 하는 일 | 위치 | 값 (프리셋 키) |
|---|---|---|---|
| 띠 명암 | 감싸는 빛(wrap) 뒤 2~5단 띠, 경계를 부드럽게 | `materials.js` `styleBand` · `RE_Direct_Style` | `bands` `bandSoft` `shadeFloor` `wrap` |
| 드리운 그림자 진하기 | 그림자를 햇빛 0 이 아니라 그늘 쪽 밝기까지만 | `styledLightsBegin()` 이 three `lights_fragment_begin` 의 방향광 그림자를 따로 꺼낸다 | `castDark` |
| 색조 그늘 | 빛 못 받은 곳(그늘·그림자)은 보랏빛, 햇빛은 따뜻하게, 그늘 채도 올리기 | `RE_Direct_Style` · `RE_IndirectDiffuse_Style` · `STYLE_COMPOSE` | `shadeTint` `litTint` `shadeSat` |
| 가장자리 빛 (림) | 하늘빛 색 프레넬. 뼈대 있는 메시(캐릭터)는 더 세게 | `STYLE_COMPOSE` | `rim` `rimChar` `rimPower` |
| 장난감 하이라이트 | 부리·껍데기·쇠·유리·과일 등 이름이 정해진 재질에 둥근 반짝임 (합친 메시는 `aStyle` 3) | `RE_Direct_Style` (`styleSpecK`), 이름 표 `STYLE_NAMES.spec` | `spec` `specSize` |
| 붓질 색 흔들림 | 저주파 잡음으로 평평한 색에 얼룩. **꼭짓점에서** 세어 싸다. 움직이는 것(캐릭터·구름)은 모델 좌표라 무늬가 안 미끄러진다 | `STYLE_VERT_MAIN` · `STYLE_PAINT` | `paint` `paintScale` |
| 접촉 그늘 (가짜 AO) | 물체 원점(바닥) 가까운 옆면을 어둡게. 위를 보는 면(땅)은 빼고 | `STYLE_COMPOSE` | `ao` `aoHeight` |
| 바람 | 잎·풀·꽃잎이 원점마다 다른 위상으로 살랑 (인스턴스 안전). 섬의 나무·꽃·풀 타일은 합친 메시라 꼭짓점 속성 `aStyle` 1 로 고른다 | `WIND_GLSL` (이름 표 `STYLE_NAMES.wind`) | `wind` `windSpeed` |
| 물결 | 짧은 물결 조각 + 반짝 점, 멀면 줄어든다. 바다 판·폭포는 재질 이름, 강물 타일은 `aStyle` 2 | `styleWater` (이름 표 `STYLE_NAMES.water`: `sea` `water` `waterLight` `waterfall` …) | `water` `waterScale` |
| 스스로 빛나기 | 불꽃·반딧불·반짝이를 밝게 → 빛 번짐이 걸린다 | `STYLE_GLOW` (이름 표 `STYLE_NAMES.glow`) | `glow` |
| 외곽선 | `off` / `subtle`(가늘게, 물체 색을 어둡게 — 바탕색 `base` 또는 꼭짓점 색) / `ink`(예전 갈색) | `outlineMaterial` · `OUTLINE_FRAG`, 숨기기 `setOutlinesVisible` | `outline` `outlineScale` `outlineTint` `outlineDark` |
| 가림 투명 (디더) | 카메라와 플레이어 사이 물체에 4×4 바이어 구멍 (최대 `FADE_MAX` 70%). 세기 = max(재질 uniform `uStyleFade`, 꼭짓점·인스턴스 속성 `aFade`). 그림자는 그대로 | `FADE_FRAG` (모든 툰·평면·외곽선 재질), 판정은 world `occlusion.js` | — |
| 그림자 바람 | 바람(이름·`aStyle` 1)과 배경 묶음 흔들림·흔들기로 움직이는 물체의 그림자가 같이 흔들린다 | `shadowDepthMaterial()` → 메시 `customDepthMaterial` (render `cull.js` 가 붙이고, kit 은 흔들림까지 얹어 직접) | `wind` `windSpeed` |
| 빛 번짐 (bloom) | 문턱보다 밝은 곳(등불·모닥불·해)만 번진다. 1/4 해상도 | `post.js` `UnrealBloomPass` | `bloom` `bloomRadius` `bloomThreshold` |
| 위쪽 흐림 (틸트시프트) | 곡면 월드가 넘어가는 화면 위쪽을 더 흐리게, 아래는 살짝. three 의 `Horizontal/VerticalTiltShiftShader` 를 절반 해상도로 돌리고 색 보정에서 섞는다 | `post.js` `TiltBlurPass` + `GradeShader` | `tiltTop` `tiltBottom` `tiltFocus` `tiltRange` |
| 색 보정 | 노출 → 밝은 곳 눌러주기(파스텔 색 유지) → sRGB → lift/gamma/gain · 대비 · 채도 · 따뜻함 · 비네트 | `post.js` `GradeShader` (OutputPass 역할도 한다) | `exposure` `shoulder` `lift` `liftTint` `gamma` `gain` `contrast` `saturation` `warmth` `vignette` `vignetteSoft` |
| 가장자리 매끈 | FXAA (화면 색 위에서, 맨 끝) | `post.js` | `fxaa` |

world 쪽 땅 다듬기 (재질이 아니라 판·덧씌우기): 해안선 `coast.js`(X2), 강 둑·물가 거품·풀/모래 경계 `banks.js`(Y3) — 거리장은 three 없이 도는 `coastfield.js` · `banksfield.js`.

### 꼭 알아 둘 것
- **곡면 월드**는 예전처럼 `project_vertex` 자리에서 휜다. 스타일 효과는 휘기 **전** 월드 좌표(`vStyleWorld`)를 쓴다 → 그림자·물결 무늬가 땅에 붙어 있다.
- world 의 흔들림(sway)·물거품 패치는 `#include <begin_vertex>` 뒤에 끼운다. 스타일 패치도 그 표시를 지우지 않는다 → 새 패치를 만들 때도 지키기.
- 재질마다 다른 값(`uMatRim`·`uMatSpec`·`uMatAO`·`uMatPaint`)은 `material.userData.style` 에 있다. 셰이더 글자가 달라지는 선택지(바람·물·평면)는 `customProgramCacheKey` 에 들어간다.
- 깊이·법선을 다시 그리는 SSAO 류는 override 재질에 곡면 패치가 없어 어긋난다 → 쓰지 않고 접촉 그늘을 재질에서 흉내 낸다.
- **합친 메시(world 배경 묶음)**: 여러 재질이 한 메시라 이름이 없다 → `kit.js` 가 꼭짓점마다 `aStyle = styleClass(재질 이름)` 을 넣고 재질은 `styleAttr: true`. 외곽선 판도 `aStyle`(바람을 같이 따라가게)과 꼭짓점 색(은은한 외곽선 색)을 가진다.
- 화면 효과를 쓰면 장면은 **선형** 버퍼에 그린다. sky 의 `ShaderMaterial` 들은 `skyOut()`(sRGB → 선형 → `linearToOutputTexel`)으로 내보내 어느 쪽에 그려도 같은 색이다. 그렇게 하지 않은 새 `ShaderMaterial` 은 `src/render/index.js` 의 `linearize()` 가 끝에 변환을 붙여 준다 (1초마다 훑음, `uStyleLinear` 가 1 일 때만).
- 외곽선 메시에는 계속 `userData.outline = true`. 섬폰 설정(`settings:changed {key:'outline'}`)은 메시 `visible` 을, 스타일 `outline: 'off'` 는 재질 `visible` 을 끈다 → 둘이 부딪치지 않는다.
- **캐릭터 합치기** (`applyToonStyle(root, { merge: true })`, 플레이어·주민·가게 주인): 캐릭터 glTF 는 부품(재질)마다 뼈대 메시라 한 명이 20~30번 그렸다. 같은 뼈대의 부품을 꼭짓점 색 + `aStyle`(부리·코·껍데기 하이라이트)로 굳혀 **[몸(툰) · 눈·볼(평면) · 외곽선]** 세 메시, 뼈대 하나로 줄인다. 굳힌 모양은 같은 모델끼리 나눠 쓴다. `toon.materials[이름]` 은 합친 재질(모든 부품 공유)이라 `.color` 를 바꾸지 말고 `setColor(이름, 색)` 을 쓴다 (꼭짓점 색). 부품별 메시가 필요한 곳(캐릭터 편집기)은 `merge` 를 쓰지 않는다.
- **가림 투명**: `applyToonStyle` 은 모델마다 uniform 하나(`root.userData.toonFade`)를 재질 전부에 나눠 준다 → world 가 장면에서 찾아 카메라와 플레이어(·대화 상대) 사이면 통째로 디더 (`setFade(v)`). 빠지려면 `root.userData.occluder = false` (플레이어). 공유 재질 인스턴스는 `aFade` 인스턴스 속성 + `world.occlusion.add({ box, setFade })`.
- **그림자 깊이 재질**은 곡면을 걸지 않고(그림자는 휘기 전 좌표), 디더도 없다(비쳐도 그림자는 남는다). 재질에 `userData.shadowSway = { wind, attr }` 가 있으면 render 가 1초마다 훑어 붙인다. 비교: `__island.services.style.culler.windShadow = false`.

## 쓰는 법 (`ctx.services.style`)

```js
const style = ctx.services.style;
style.preset              // 'cozy' | 'toon'
style.presets             // { cozy: {...}, toon: {...} } 복사본
style.params              // 조절 값 목록 (이름·묶음·범위) — 편집기가 이걸로 슬라이더를 만든다
style.use('toon')         // 프리셋으로
style.set({ bloom: 0.6 }) // 지금 값에 덮어쓰기 (범위 밖 값은 잘린다)
style.set({ preset: 'cozy', water: 0 }) // 프리셋 위에 덮어쓰기
style.get()               // 지금 값 복사본
style.compare({ on: true, x: 0.5, preset: 'toon' })  // 나눠 보기: 왼쪽 = toon, 오른쪽 = 지금 값
style.stats()             // { ms: CPU 그리기 시간, passes: [...] }
style.labels              // { cozy: '포근 (동숲풍)', toon: '툰 (예전)' }
```
이벤트: `style:changed {preset, params}`. 주소: `?style=toon` · `?quality=low`.
- **처음 프리셋**: `?style=` > 섬폰 설정 **화면 모습**(포근 / 툰, `state.settings.style` 로 저장) > `cozy`.
- **집 안**: `scene:indoor {on}` 동안 프리셋 위에 `presets.json` 의 `indoor.<프리셋>` 값(덜 푸른 그늘, 약한 흐림)을 얹는다. `get()` 은 얹기 전 값.

## 스타일 편집기 (`style-editor.html`)
게시 링크 https://claude.ai/artifact/EWuGKbMpo9uTjLEUzhT2Pd · 로컬 `node dev-server.mjs` 후 `/style-editor.html` (옛 주소 `/demos/style.html` 은 진짜 섬 보기로 넘겨 준다). 자세한 설계·저장소 모양은 `docs/notes/m6-p6-style.md`.
1. **무대**: 대표 모델 5개(플레이어·퐁·집·나무·모닥불)로 꾸민 작은 섬 + 진짜 하늘 모듈. 게임과 같은 재질·화면 효과라 값이 그대로 보인다. 로컬 dev-server 에선 "진짜 섬에서 보기"(`?island`, 모든 모듈이 돈다, WASD).
2. 위쪽 프리셋 단추로 고칠 프리셋(포근·툰)을 고르고, 가운데 ↔ 손잡이로 왼쪽(게임 값 · 반영 v<n> · 저장본)과 오른쪽(고치는 값)을 비교한다. 시간(새벽·낮·노을·밤)·날씨·계절·카메라를 바꿔 본다.
3. 슬라이더를 움직이면 바로 바뀌고 **저장소에 바로 저장**된다 (어느 기기에서 열어도 같은 값). 게임 값과 다른 값은 이름 옆 •, ↺ 로 게임 값으로. **집 안** 을 켜면 슬라이더가 집 안 덧씌우기 값을 고친다.
4. 의견 칸(프리셋마다), **저장본**(이름 붙여 남기기 · 불러오기 · 왼쪽에 놓고 비교).
5. **반영 요청 표시** → 채팅에 **"스타일 반영"**. Claude 가 저장소를 읽어 `assets/style/presets.json` 을 고치고 테스트·스크린샷·커밋 → 편집기 다시 게시 → 반영 기록(`applied/style`, `history/style-v<n>`). 반영 기록의 **이 버전으로 되돌리기** → 다시 "스타일 반영" 이면 그 버전 값으로. 순서는 `CLAUDE.md` 의 스타일 반영 절과 `docs/notes/m6-p6-style.md`.

## 새 재질 효과 더하기
1. `look` 에 uniform 하나 (`uFoo: { value: 0 }`), 기본값은 예전 모습이 그대로 나오게 (보통 0).
2. 셰이더 조각에 쓴다: 조명 계산이면 `RE_Direct_Style`, 마지막에 더하는 빛이면 `STYLE_COMPOSE`, 색이면 `STYLE_PAINT`, 모양이면 `WIND_GLSL` 처럼 `begin_vertex` 뒤. uniform 선언은 `STYLE_FRAG_PARS`(조각) / `STYLE_VERT_PARS`(꼭짓점).
3. 특정 재질만이면: 이름 표(`STYLE_NAMES`)에 넣고 `toonMaterial` 에서 재질별 값(`mat`)이나 `#define`(+ `keyOf` 열쇠)을 단다. **값으로 끌 수 있으면 `#define` 보다 uniform 이 낫다** (프리셋 전환 때 다시 컴파일 안 함).
4. `presets.js` 의 `PARAMS` 에 한 줄 (이름·묶음·범위) + `assets/style/presets.json` 의 프리셋마다 값(`toon` 은 효과 없음 값, `cozy` 기본값 — `tests/style.test.mjs` 가 빠진 값을 잡는다), `src/render/index.js` `apply()` 에서 `look.uFoo.value = p.foo`.
5. 편집기에 슬라이더는 저절로 생긴다.

## 새 화면 효과(후처리 패스) 더하기
1. `src/render/post.js` 에 `ShaderPass(셰이더)` 또는 `Pass` 를 만들어 `composer.addPass` 순서 안에 넣는다. 장면 버퍼는 **선형 HDR** — 색 보정(`grade`) 앞은 선형, 뒤(FXAA)는 화면 색이다.
2. 큰 흐림·번짐은 작은 해상도에서 (예: `TiltBlurPass` 처럼 1/2, low 는 1/4).
3. `apply(p)` 에서 켜기/끄기와 uniform 을 값에 연결하고 `PARAMS`·프리셋에 값을 더한다.
4. 재 보기: 콘솔에서 `__island.services.style.post.composer.passes`, 시간은 아래 "성능".

## 프리셋 다듬기
- 편집기에서 고르고 채팅 **"스타일 반영"** 이 가장 빠르다 (값 복사·붙여 넣기 필요 없음). 직접 고칠 땐 `assets/style/presets.json` — 고친 뒤 `node --test tests/style.test.mjs`, 편집기 다시 게시, 반영 기록 버전 +1 (`CLAUDE.md` 흐름).
- 빛 번짐 문턱(`bloomThreshold`)은 해 비친 흰 벽(선형 ≈ 1.0)보다 높게, 등불(≈ 1.5~2)보다 낮게.
- 노을·밤 색은 sky 의 하늘·조명 팔레트가 정한다. 스타일은 그 위에 색조만 얹는다 → 노을이 너무 누렇다면 sky 의 `SKY.dusk` 를 먼저 본다.

## 새 셰이더를 부탁할 때 알려 주면 좋은 것
1. **어디에**: 대상 물체·재질 이름 (예: "물 타일 `water`", "캐릭터 털 `fur`", "모든 나무 잎 `leaf`").
2. **어떤 모습**: 레퍼런스 그림이나 영상 링크, 또는 지금 화면 스크린샷에 "여기가 이렇게" 표시. 시간대·날씨도 (낮/노을/밤, 비).
3. **조절하고 싶은 값**: 편집기에 슬라이더로 둘 것 (예: "물결 크기, 반짝임 세기").
4. **휴대폰 성능**: 휴대폰에서도 켜야 하는지, 아니면 `?quality=low` 에서 꺼도 되는지.
5. 기존 모습과 바꿀지, 새 프리셋으로 둘지.

## 성능 (Intel UHD 내장 그래픽, 비 오는 밤 광장, GPU 시간 = `EXT_disjoint_timer_query`)

| 화면 | 품질 | toon (예전) | cozy |
|---|---|---|---|
| 1280×800 | high | 9.5 ms | 10.4 ms (+0.9) |
| 1280×800 | low | 8.4 ms | 8.2 ms |
| 1920×1200 | high | 15.1 ms | 21.3 ms (+6) |
| 1280×800, 2차 네 트랙 임시로 합친 섬 (주민·채집·집) | high | 10.3 ms | 12.2 ms (+1.9) |

- 4차(Y3) 캐릭터 합치기 뒤 주민이 모인 광장: 363 → 167 그리기 호출, 처리량 10.6 → 9.9ms, CPU 4.5 → 1.0ms. 그림자 바람 +0.15ms. 표는 `docs/notes/render.md`.
- toon 은 화면에 바로 그려서 4× MSAA 를 쓰고, cozy 는 MSAA 없는 HDR 버퍼 + FXAA 다. 그래서 작은 화면에선 거의 같다.
- 1920×1200 cozy 의 덧셈: 빛 번짐 ≈ 1.5ms, FXAA ≈ 2ms, 틸트 ≈ 1ms, HDR 버퍼·색 보정 ≈ 1.5ms. 재질 자체는 toon 과 같은 값.
- low: 빛 번짐 1/8 · 틸트 1/4 해상도, 화소 배율 1.5 이상이면 FXAA 끔. 그림자 1024·PCF (main.js).
- 재는 법: 창이 숨겨지면 rAF 가 느려져 fps 는 믿을 수 없다. GPU 시간 쿼리나 `readPixels` 로 GPU 를 기다린 프레임 시간을 잰다.

## 하늘 셰이더 (2026-11-04, `src/sky/dome.js`)

하늘 돔 하나의 조각 셰이더가 다 그린다 (색은 `look.js` 의 시간대 팔레트 `SKY` 를 그대로 받는다).

| 층 | 하는 일 | 값 (`SKY_FX`) |
|---|---|---|
| 그라데이션 | 지평선 → 가운데(둘을 섞은 색) → 천정, 세 단 | — |
| 지평선 안개 띠 | 지평선 바로 위 밝은 띠 (밤엔 옅게) | `haze` |
| 해 | 넓은 빛무리 + 둥근 해 + 해 쪽 지평선 노을빛 (새벽·노을 `uGold` 일 때 세게) | `sunGlow` · `sunsetSide` |
| 빛살 | 해를 도는 각도로 잡음 → 천천히 바뀌는 살 (구름 많으면 약하게) | `rays` |
| 툰 구름층 | 하늘 평면 잡음(fbm) → 문턱으로 자른 구름, 바람 따라 흐름. 해 쪽으로 옮긴 짙기와 비교해 그늘 면 두 단, 해 쪽 가장자리 은빛. 흐림·비는 `uCover`(날씨 cover)로 문턱을 낮추고 `uGrey` 로 잿빛, 밤엔 푸른 구름 | `cloudScale` · `cloudSpeed` · `cloudClear` · `cloudFull` · `cloudEdge` · `silver` |
| 은하수 | 기운 큰 원을 따라 얼룩진 띠 (별이 보일 때만) | `milky` |
| 별 | 점 1400개, 구름 뒤에서 가려진다 (별 셰이더도 같은 구름 함수) | — |

- **그리는 순서**: 돔은 `renderOrder 1000` 으로 불투명 물체를 다 그린 뒤, 깊이 시험으로 아무것도 안 그린 화소에서만 칠한다 (`gl_Position.z *= 0.99999`). 예전엔 화면 전체를 먼저 칠했다. 광장 화면에서 하늘 몫은 GPU 0.5ms 안팎 (Intel UHD, 1280×800).
- **사양별** (`SKY_QUALITY`, render/quality.js 이름): 높음 구름 5겹·빛살·은하수 · 적정 4겹·빛살·은하수 · 낮음 3겹·은하수 · 매우 낮음 2겹. 사양이 바뀌면 sky 가 `quality:changed` 로 `dome.setQuality` (셰이더 다시 만들기).
- 섬 북쪽 먼 하늘의 3D 솜구름(`clouds.js`)은 그대로 — 셰이더 구름층 앞에 떠서 깊이를 준다.

## 구름 그림자 · 물 하늘 반사 · 해 렌즈 빛 (2026-11-04, 하늘 확정 뒤)

| 효과 | 어디 | 하는 일 | 비용 |
|---|---|---|---|
| 구름 그림자 | `core/materials.js` STYLE_COMPOSE (`uCloudShadow × uCloudGate`) | 땅·물체·캐릭터의 해를 받은 곳을 흘러가는 구름 모양으로 최대 30% 어둡게. 무늬 = 이음매 없는 64×64 잡음 그림 1장(`uCloudTex`, 계산 잡음 대신 그림 1번 읽기). 세기는 sky 가 해 보임·흐림으로(`CLOUD_SHADOW 0.3`), 구름 양은 날씨 cover, 흐름 `CLOUD_DRIFT` ≈ 0.35칸/초 | 재 보니 잡음 안 (광장 적정 5.1ms 그대로) |
| 물 하늘 반사 | 같은 곳, 물 갈래 (`uSkyReflect`) | 바다·강에 하늘 색(천정·지평선 섞음, 선형 `uSkyZenithL/HorizonL` — sky 가 매 프레임)이 비침, 비스듬히 볼수록(프레넬) 세게 | 계산 몇 줄 |
| 해 렌즈 빛 | `sky/flare.js` (three.js 예제 `three/addons/objects/Lensflare.js` 그대로) | 해가 화면 안이면 빛무리 + 고리 4개. 해 자리 16×16 화소만 복사해 깊이로 가림을 본다. 그림은 캔버스로 만든다. 하늘 셰이더 해 빛무리와 겹치므로 옅게(`GLOW 0.32 · GHOST 0.2`), 노을엔 주황 | 해가 화면 안일 때만 |

**사양별 켜고 끄기** (`render/quality.js` `QUALITY[].fx` → `render/index.js` `apply` 가 uniform 으로. 0 이면 셰이더가 그 갈래를 통째로 건너뛴다 — 모든 조각이 같은 갈래라 싸고, 셰이더를 다시 만들지 않는다):

| | 구름 그림자 | 물 하늘 반사 | 렌즈 빛 | 하이라이트 | 가장자리 빛 | 접촉 그늘 | 물결 무늬 | 3D 솜구름 | 계단 무늬 줄이기 |
|---|---|---|---|---|---|---|---|---|---|
| 높음 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 적정 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 낮음 | — | ✅ | — | — | ✅ | — | ✅ | ✅ | — |
| 매우 낮음 | — | — | — | — | — | — | — | — | — |

- 계단 무늬 줄이기(MSAA)는 렌더러를 만들 때만 정해진다 → `main.js` 가 저장 글(`island-life-save-v1`)에서 섬폰 사양을 미리 엿봐(`savedSpec`) 처음부터 그 사양으로 연다. 사양을 바꾸면 섬폰에 "다시 열면 …" 안내 (`style.needsReload`). 렌더러는 `powerPreference: 'high-performance'` (그래픽 카드 둘인 노트북은 빠른 쪽).
- 잰 값 (Intel UHD · 1280×800 · 광장 낮, GPU 시간 — 계단 무늬 줄이기는 켠 채): 높음 9.9ms · 적정 5.1ms · 낮음 3.7ms · 매우 낮음 2.5ms. 낮음·매우 낮음으로 다시 열면 계단 무늬 줄이기가 꺼져 더 줄어든다.
