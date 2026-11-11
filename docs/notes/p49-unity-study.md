# P49 Unity 3D 이식 조사 (조사·보고만, 게임 코드 변경 없음)

조사 기준: main `bd74a46` (게임 v35). 2026-11-11. Unity 는 이 PC 에 **에디터가 설치돼 있지 않다** (`C:\Program Files\Unity\Hub\Editor` 비어 있음) → Unity 안에서 확인할 일은 맨 끝 「사용자가 할 것」에 남겼다.

## 한 줄 결론

- **지금 게임은 WebGL 버전이 맞다.** 정확히는 three.js 0.170 `WebGLRenderer` = **WebGL2 전용** (three 는 r163 부터 WebGL1 을 지원하지 않는다). WebGPU 는 쓰지 않는다 (`WebGPURenderer`·`three/webgpu`·TSL 사용 없음).
- **그대로 옮겨지는 것**: 3D 모델 268개 (glTF 2.0 검증 오류 0), 애니메이션 132개, 재질 이름·색, JSON 데이터 거의 전부.
- **다시 써야 하는 것**: 게임 로직·UI·셰이더·소리·저장·편집기 연동 — 코드 약 3.2만 줄 (JS → C#, DOM/CSS → UI Toolkit, GLSL 조각 → URP Shader Graph/HLSL).
- **추천**: 한 번에 다 옮기지 말고 **C안(작은 시험판)** 으로 모델·섬 지도·주민 몇 명만 Unity 에 띄워 보고, 그 결과로 전체 이식(A안)을 할지 정한다. 웹 게시본은 three.js 로 계속 유지.

---

## 1. 지금 기술 바탕

| 항목 | 지금 | 근거 |
|---|---|---|
| 렌더러 | `THREE.WebGLRenderer` (WebGL2), MSAA·PCF 그림자·사양 4단계 | `src/main.js:41-44`, `src/render/quality.js` |
| WebGPU | 안 씀 | `src/` 전체에 WebGPU·TSL 없음 |
| three 불러오기 | importmap → jsdelivr `three@0.170.0` (빌드 도구·npm 없음) | `index.html:36-40` |
| 모듈 구조 | `data → sky → world → player → ui → audio → gameplay` 순서로 `init(ctx)` / 매 프레임 `update(dt, ctx)`. 서로는 `ctx.services.*` 와 `ctx.events`(on/emit) 로만 이어진다 | `docs/CONTRACTS.md`, `src/main.js:18-26` |
| 재질 | three 의 내장 셰이더에 `onBeforeCompile` 로 GLSL 조각을 끼워 넣음 (툰 띠·곡면 월드·바람·물결·외곽선·가림 디더) | `src/core/materials.js` (787줄) |
| 화면 효과 | `EffectComposer`: 빛 번짐(UnrealBloom) → 틸트시프트 → 색 보정·톤 → FXAA | `src/render/post.js` |
| 게시 | claude.ai 아티팩트. 모델은 `.glb` 를 base64 로 바꾼 `.glb.json` (게시 묶음에선 `KHR_mesh_quantization` 으로 줄임) | `tools/glb-to-json.mjs`, `tools/build-web.mjs:264`, `tools/glb-quantize.mjs` |
| 저장 | `localStorage['island-life-save-v1']` JSON | `src/data/save.js` |
| 아티팩트 전용 | `window.claude.use('db'/'user')` (사양 확인 기록 등), 편집기들의 "요청 확인" 흐름 | `src/render/check.js:162`, `*-editor.html` |

이 구조(모듈 + 서비스 + 이벤트)는 Unity 의 "매니저 MonoBehaviour + C# 이벤트/ScriptableObject 채널" 로 1:1 대응시키기 쉬운 편이다. three·DOM 을 쓰지 않는 순수 규칙 코드가 많고(`tests/` 54개가 node 로 돈다) 이것들은 C# 로 옮기기 가장 쉽다.

## 2. 요소별 이식 가능성

표기: ◎ 거의 그대로 · ○ 가져오되 손볼 곳 있음 · △ 다시 만들기 · ✕ Unity 엔 해당 없음

### 2-1. 3D 모델 (실제 파일을 열어 확인)

전체 `assets/**/models/*.glb` **268개** (캐릭터 15 · 옷 12 · 배경 76 · 가구 50+12 · 아이템 103), 삼각형 합계 약 71만, 텍스처 0장(색은 전부 재질 baseColor), 확장 기능 없음(원본 .glb 기준). 모두 `Khronos glTF Blender I/O v5.2.41` 로 내보낸 glTF 2.0.

| 항목 | 확인 결과 | Unity 에서 | 판정 |
|---|---|---|---|
| 형식 | glTF 2.0 바이너리, 확장 없음 | glTFast(Unity 공식 패키지 `com.unity.cloud.gltfast`) 또는 UnityGLTF 로 바로 가져옴. 원본 `.glb` 를 쓰면 됨 (`.glb.json` base64 는 웹 게시용이라 필요 없음) | ◎ |
| 뼈대 | 예: `bori.glb` 뼈 14개 + inverseBindMatrices, `player.glb`·옷은 `player_rig` 뼈 10개. 뼈대 있는 파일 27개 | SkinnedMeshRenderer 로 들어옴. 옷(`clothes/*.glb`)도 같은 `player_rig` 이름이라 플레이어 뼈에 다시 묶는 스크립트(뼈 이름으로 bones 배열 맞추기) 하나 필요 | ○ |
| 애니메이션 | Blender NLA 트랙 → glTF 애니메이션 클립으로 나뉘어 있음. 예: bori `happy·idle·run·sit·sit_down·stand_up·walk` (클립당 42채널 = 뼈 14 × 이동·회전·크기), player 11개 (`place·push·sparkler·spin` 등). 전체 33개 파일 · 132클립 | glTFast 가져오기 설정에서 Animation = Mecanim 을 고르면 AnimationClip 으로 들어옴 → Animator Controller 상태(걷기/뛰기/앉기)는 새로 짜야 함. 지금의 섞기·전환 로직은 `src/player/motions.js` 등에 있음 | ○ |
| 재질 이름 = 팔레트 키 | 재질 이름이 `fur·muzzle·shirt·eye…` 그대로 보존 (`assets/specs/<slug>.json` 의 `palette` 키와 같음). 전체 고유 재질 이름 444개 | Unity Material 이름으로 들어옴. 처음엔 glTF 기본(URP Lit 계열) 셰이더가 붙으므로 **가져온 뒤 툰 셰이더로 바꿔 끼우는 AssetPostprocessor/스크립트** 필요 (이름 → 팔레트 색, 이름 → flat/외곽선 여부) | ○ |
| 외곽선 껍데기 | **모델 파일엔 없음.** 게임이 불러온 뒤 메시를 복제해 법선 방향으로 부풀리는 뒤집은 껍데기를 만든다 (`materials.js:684` 에서 `userData.outline = true` 를 붙이는 쪽). Blender 의 `add_outlines` 는 미리보기 그림용 | Unity 에서도 따로 만들어야 함: 툰 셰이더에 외곽선 패스를 넣거나(HLSL, 두 번째 패스) URP Renderer Feature(Render Objects) 로. 가장 쉬운 길은 셰이더 쪽 | △ |
| 노드 extras | 뼈대 노드에 `extras.sit {hip, forward}` (앉기 자세 보정) 27개 파일 | glTFast 는 extras 를 기본으로 안 읽음 → `*.stats.json`/spec JSON 에서 따로 읽거나 UnityGLTF 의 extras 가져오기 사용 | ○ |
| 좌표 | glTF 오른손 좌표·미터 | 임포터가 왼손 좌표로 바꿔 줌(X 뒤집기). 게임 코드의 "북쪽 = -Z" 같은 약속은 C# 쪽에서 다시 맞춰야 함 | ○ |
| 정점 속성 | `POSITION·NORMAL`(+뼈 `JOINTS_0·WEIGHTS_0`). 정점색·UV 없음 | 툰 셰이더가 UV 없이 동작하게 짜면 됨 (지금도 그렇다) | ◎ |
| 병합·인스턴싱 | 게임이 배경 물체를 실행 중 합치고(`bakeParts`) 인스턴싱 | Unity 의 Static Batching / GPU Instancing / SRP Batcher 가 대신함 | ○ |

**검증 결과 (gltf-validator 2.0.0-dev.3.10, Khronos 공식 검증기, 스크래치 폴더에서만 실행)**:

```
bori.glb   오류 0 · 경고 1 (NODE_SKINNED_MESH_NON_ROOT /nodes/14) · 정보 0
bench.glb  오류 0 · 경고 0 · 정보 0
전체 268개: 오류 0 · 경고 28 · 정보 0  — 경고는 전부 NODE_SKINNED_MESH_NON_ROOT
```

경고 `NODE_SKINNED_MESH_NON_ROOT` = "뼈대 붙은 메시가 루트 아래에 있다" — Blender 가 내보낼 때 늘 나오는 경고로, glTFast·UnityGLTF·three 모두 문제없이 읽는다. **모델은 Unity 로 그대로 가져갈 수 있는 상태.**

### 2-2. 셰이더

| 지금 | 하는 일 | Unity URP 에서 | 판정 |
|---|---|---|---|
| `src/core/materials.js` 툰 | 명암 띠 수·부드러움·그늘 밝기·감싸는 빛·그늘/햇빛 색조·림·장난감 하이라이트·붓질 흔들림·가짜 접촉 그늘·구름 그림자 (`look` uniform 묶음) | Shader Graph(Unlit + Custom Function 으로 주광 방향·그림자 읽기) 또는 HLSL 손코딩. 공용 값은 `Shader.SetGlobalFloat` 로 지금의 `look` 처럼 한꺼번에 바꿀 수 있음. 프리셋(`src/render/presets.js`)은 ScriptableObject 로 | △ (공식은 그대로, 코드는 새로) |
| 곡면 월드 | 카메라 중심에서 Z 로 멀수록 정점을 아래로 (`uCurve`), 그림자는 휘기 전 좌표 | Shader Graph 의 Position 노드로 정점 옮기기 — 흔히 쓰는 기법이라 쉬움. 그림자 캐스터 패스에도 같은 휘기 넣기 주의, 컬링 경계 넓히기 필요 | △ (쉬움) |
| 바람·물결·스스로 빛나기·가림 디더 | 정점 흔들기, 물 반짝임, 글로우, 플레이어 가리는 물체 디더 투명 | 모두 Shader Graph 로 가능 (Dither 노드 있음) | △ |
| 외곽선 | 뒤집은 껍데기, 바탕색 섞기 | HLSL 두 번째 패스(Cull Front) 또는 Renderer Feature | △ |
| `src/sky/dome.js` 하늘 (281줄) | 세 단 그라데이션·지평선 띠·해 빛무리·빛살·툰 구름층·은하수·별 | 커스텀 Skybox 셰이더(Shader Graph/HLSL)로 새로 씀. 시간대 색은 지금 데이터 그대로 C# 에서 넣기 | △ |
| `src/render/post.js` 화면 효과 | Bloom → 틸트시프트 → 색 보정·톤 → FXAA | URP Volume 기본 제공: Bloom·Tonemapping·Color Adjustments·FXAA(카메라) — 거의 공짜. **틸트시프트만** Depth of Field(Gaussian)로 비슷하게 하거나 Renderer Feature 로 새로 | ○ |

요약: GLSL 을 three 내장 셰이더 사이사이에 끼워 넣는 방식이라 **코드를 그대로 옮길 수는 없다.** 하지만 공식·값(docs/SHADERS.md 에 정리돼 있음)은 그대로 쓰므로 "같은 모습을 다시 맞추는 작업" 이다. 셰이더 전체 약 1,400줄 분량.

### 2-3. 데이터 (JSON)

| 폴더 | 파일 수 / 크기 | Unity 에서 | 판정 |
|---|---|---|---|
| `assets/data` (items·rules) | 2 / 36KB | `TextAsset` 로 넣고 `JsonUtility`/Newtonsoft 로 읽기, 또는 가져오기 스크립트로 ScriptableObject 생성 | ◎ |
| `assets/villagers` | 13 / 192KB | 같음 | ◎ |
| `assets/story` (scenes 등) | 24 / 152KB | 같음. 장면(컷·대사·카메라) 데이터는 그대로, 재생기는 C# 로 새로 (Timeline/Cinemachine 으로 옮길 수도) | ◎ 데이터 / △ 재생 |
| `assets/events`·`night`·`tour`·`festival`·`decor`·`emotes`·`island` | 각 1~2 | 같음 | ◎ |
| `assets/interior` | 32 / 102KB | 같음 | ◎ |
| `assets/specs` (캐릭터 스펙·팔레트) | 15 / 64KB | 재질 색 입히기에 바로 사용 | ◎ |
| `assets/sound` (곡·효과음·목소리 악보) | 13 / 68KB | 데이터는 그대로지만 **소리를 만드는 엔진이 웹 전용** (2-5 참고) | ○ |

주의할 점: JSON 안의 `"//"` 같은 설명 칸, 칸마다 모양이 다른 자리(객체/배열 섞임)는 `JsonUtility` 가 못 읽는다 → **Newtonsoft Json (Unity 패키지 `com.unity.nuget.newtonsoft-json`)** 을 쓰는 게 안전. `src/data/*.js` 에 JS 로 적힌 표(아이템·확률 등 19파일 1,672줄)는 JSON 으로 뽑아내거나 C# 로 옮겨야 한다.

### 2-4. 게임 로직·UI (분량 재기, `src/` 실행 코드만)

| 폴더 | 파일 | 줄 | Unity 에서 |
|---|---:|---:|---|
| `src/gameplay` (아래 합) | 84 | 15,683 | C# 다시 쓰기 |
| ├ town (주민·길찾기) | 17 | 3,328 | |
| ├ house (집·실내) | 11 | 2,764 | |
| ├ gather (채집) | 16 | 2,526 | |
| ├ events / intro / festival | 8 / 7 / 9 | 1,278 / 1,220 / 1,194 | |
| ├ decor / story / night / tour | 6 / 4 / 3 / 2 | 883 / 858 / 859 / 641 | |
| `src/world` (섬 생성·충돌·배치) | 16 | 3,381 | C# 다시 쓰기 (순수 계산이 대부분이라 옮기기 쉬움) |
| `src/ui` (+ CSS 1,424줄) | 19 | 3,219 | UI Toolkit(UXML+USS — CSS 와 가장 비슷) 또는 uGUI 로 새로 |
| `src/audio` | 11 | 2,152 | 2-5 참고 |
| `src/sky` | 12 | 1,754 | C# + 하늘 셰이더 |
| `src/data` | 19 | 1,672 | C# (저장·가방·지갑·확률) |
| `src/render` | 7 | 1,557 | 대부분 URP 설정으로 대체 |
| `src/core` | 9 | 1,547 | 대부분 Unity 가 대신 (이벤트·입력·에셋 로드) |
| `src/player` | 8 | 1,449 | C# (CharacterController·카메라는 Cinemachine 가능) |
| **합계** | **185** | **32,414** | |

그 밖: 편집기 HTML 10개(9,548줄)·`elem-editor`(1,624)·`story-editor`(840)·`tools`(4,089)·`tests` 54개(10,138줄).

| 요소 | 지금 | Unity 에서 | 판정 |
|---|---|---|---|
| 모듈·서비스·이벤트 | `ctx.services`, `events.on/emit` | 매니저 컴포넌트 + C# event / ScriptableObject 이벤트 채널. 구조는 그대로 따라가면 됨 | △ (설계는 재사용) |
| 입력 | 키보드·터치 패드·마우스 (`src/core/input.js`) | Input System 패키지 (터치·패드 포함) | △ |
| UI | DOM + CSS, 한국어 글꼴 | UI Toolkit 권장. 한국어 글꼴(TMP/UI Toolkit Font Asset)에 한글 글리프 넣기 필요 | △ |
| 저장 | localStorage JSON | `Application.persistentDataPath` 에 같은 JSON 파일 (PlayerPrefs 는 큰 JSON 에 안 맞음). **저장 모양 그대로 쓸 수 있어** 웹 저장을 옮겨 오는 것도 가능 | ○ |
| 테스트 | `node --test` 54개 | Unity Test Framework(NUnit). 테스트 내용(기대값)은 그대로 옮겨 쓰면 이식 검증에 큰 도움 | △ |
| 편집기·아티팩트 저장소 | 웹 페이지 + `window.claude` db, "요청 확인" 흐름 | **Unity 엔 해당 없음.** 대신 편집기는 웹에 그대로 두고, 편집기가 만드는 JSON 을 Unity 가 읽는 "콘텐츠 도구" 로 계속 쓰면 됨 | ✕ (웹에 남김) |

### 2-5. 소리

지금은 **소리 파일이 없다.** 곡·효과음·목소리를 악보 JSON 에서 Web Audio 노드(오실레이터·필터·잔향 IR 직접 생성·리미터)로 실행 중에 합성한다 (`src/audio/engine.js` 등 2,152줄). Unity 엔 Web Audio 가 없다.

- **쉬운 길 (추천)**: 지금 엔진이 이미 `OfflineAudioContext` 에서도 똑같이 돌게 짜여 있다 (`engine.js` 첫 줄 주석). 그러니 **브라우저/node 에서 곡·효과음을 WAV 로 미리 녹음**해 AudioClip 으로 넣는다. 배경음 전환·버스 볼륨은 Unity AudioMixer 로.
- 목소리(대사 글자마다 나는 동물 소리)는 음절 묶음을 미리 녹음해 두고 C# 에서 이어 붙이면 됨.
- 실시간 합성을 그대로 하려면 `OnAudioFilterRead` 로 C# 합성기를 새로 짜야 함 — 일이 크다, 비추천.

### 2-6. 섬 생성 · 길찾기 · 곡면 월드

| 요소 | 지금 | Unity 에서 | 판정 |
|---|---|---|---|
| 섬 생성 `src/world/island.js` (803줄) | 시드 하나로 타일 종류·높이·강·다리·건물 자리. **three·DOM 안 씀**, `assets/island/layout.json` 을 따름 | 두 길: ① C# 로 옮김(시드 난수 `mulberry32` 를 똑같이 옮기면 같은 섬) ② **node 로 섬을 한 번 만들어 타일 지도 JSON 으로 뽑고** Unity 는 그 JSON 을 읽어 타일 모델을 깔기 — 시험판엔 ② 가 빠르다 | ○ |
| 타일·배경 깔기 (`kit.js`·`objects.js`·`coast*.js`·`banks*.js`) | 타일 모델을 이어 붙이고 합침 | C# 로 다시. Tilemap 보단 프리팹 배치 + Static Batching | △ |
| 길찾기 `src/gameplay/town/path.js` (159줄) | 칸 A* (흙길 싸게) | 그대로 C# 로 옮기기 쉬움 (159줄). Unity NavMesh 로 바꿀 수도 있지만 칸 기반이라 직접 옮기는 게 결과가 같다 | ○ |
| 충돌 `src/world/collision.js` | 칸·원 충돌 직접 계산 | 직접 옮기거나 Unity Physics(콜라이더)로 | △ |
| 곡면 월드 | 셰이더 정점 휘기 + `ctx.focus` | 셰이더(2-2) + 매 프레임 중심을 `Shader.SetGlobalVector` | △ (쉬움) |
| 카메라 `src/player/camera.js` (293줄) | 32° 원근, 따라가기·실내 시점 | Cinemachine 으로 비슷하게 + 세부 값 옮기기 | △ |

## 3. 이식 방법 선택지

### A안 — 모델·데이터는 그대로 가져가고, 로직·UI·셰이더는 C# 로 새로 (전체 이식)

- 할 일: 모델 268개 가져오기 + 툰 재질 바꿔 끼우기 스크립트 · 셰이더 다시 쓰기(툰·외곽선·곡면·하늘·틸트시프트) · 로직 약 3.2만 줄 C# · UI 다시 · 소리 WAV 녹음 · 저장.
- 장점: 데스크톱/모바일 앱(스토어)·콘솔급 성능, Unity 도구(애니메이터·Timeline·프로파일러), 에셋 스토어.
- 단점: **사실상 게임을 한 번 더 만드는 일.** 웹 판과 Unity 판을 같이 고치면 두 배. claude.ai 아티팩트로 바로 하는 장점이 사라짐.
- 작업량: 가장 큼 — 지금까지 만든 실행 코드 전체를 다시 쓰는 규모 (테스트 1만 줄도 옮기면 검증은 쉬워짐).
- 위험: 모습(툰 띠·외곽선·하늘)을 웹과 똑같이 맞추는 데 시간이 많이 든다. 한국어 UI 글꼴·모바일 입력 다시 맞추기.

### B안 — 웹(three.js) 그대로 두고, Unity WebGL 빌드와 비교만

- 사실: Unity WebGL 빌드도 결국 **WebGL2 로 돈다** (Unity 6 의 WebGPU 는 아직 실험 기능). 지금 게임도 WebGL2 라 그래픽 바탕은 같다.
- Unity WebGL 의 단점: 첫 다운로드가 수십 MB(wasm+데이터), 시작이 느림, 모바일 브라우저 지원이 약함, claude.ai 아티팩트 보안 규칙(CSP·파일 크기 제한) 안에서 돌지 확실치 않음.
- 결론: **웹으로 내는 목적이면 Unity 로 옮길 이유가 약하다.** 지금 three.js 판이 가볍고 이미 게시돼 있다.
- 작업량: 작음 (비교 문서·작은 시험만).

### C안 — 작은 시험판 (모델·데이터·섬 지도만 Unity 에 띄우기) → 결과 보고 A안 결정 (추천)

1. glTFast 로 캐릭터 2~3명·배경 20개쯤 가져오기, 애니메이션 클립 재생 확인.
2. 재질 이름 → 팔레트 색으로 바꿔 끼우는 가져오기 스크립트 + 간단한 툰·외곽선·곡면 셰이더 하나.
3. node 로 섬 타일 지도를 JSON 으로 뽑아 Unity 에서 타일 깔기.
4. 플레이어 걷기 + 카메라 + 주민 하나가 A* 로 걷기.
5. 같은 장면을 웹 판과 나란히 찍어 모습·성능 비교.

- 장점: 가장 비싼 위험(모습 맞추기·가져오기 흐름)을 먼저 확인. 웹 판은 건드리지 않음. 실패해도 잃는 게 적다.
- 단점: 그 자체로는 게임이 아님.
- 작업량: 작음~중간 (셰이더·가져오기 스크립트·로직 몇백 줄 수준).
- 위험: Unity 설치·URP 프로젝트 준비가 필요 (사용자가 할 것).

**추천: C안.** 웹 게시는 three.js 판을 계속 쓰고(B안의 결론), Unity 판이 정말 필요한지(앱 출시 등 목적)는 C안 시험판으로 모습·작업 흐름을 확인한 뒤 정하는 것이 안전하다. A안을 하게 되면 순서는 순수 규칙(data·world·path, 테스트 함께) → 플레이어·카메라 → 셰이더 → UI → 콘텐츠(gameplay) 가 좋다. 편집기들은 웹에 남겨 JSON 을 만드는 도구로 계속 쓴다.

## 4. 사용자가 할 것 (Unity 쪽 확인)

1. Unity Hub 에서 **Unity 6 LTS** 설치, 새 프로젝트를 **Universal 3D (URP)** 템플릿으로 만들기. (지금 PC 엔 Unity 에디터가 없다)
2. Package Manager → `com.unity.cloud.gltfast` (glTFast) 추가. JSON 용 `com.unity.nuget.newtonsoft-json` 도.
3. `assets/models/bori.glb`, `assets/models/player.glb`, `assets/env/models/bench.glb` 를 프로젝트 `Assets/` 에 끌어 넣고 확인:
   - 모양·크기(1칸 = 1m)·방향이 맞는지
   - 가져오기 설정 Animation 을 Mecanim 으로 바꾸고 `walk`·`idle` 클립이 재생되는지
   - 재질 이름(`fur`·`shirt` …)이 그대로 있는지, 색이 spec 의 palette 와 같은지
4. (선택) 위 결과를 알려 주면 C안 2~5단계를 이어서 진행.

## 부록: 확인에 쓴 방법

- glTF 구조: `.glb` 머리(JSON 덩어리)를 node 로 직접 읽어 노드·스킨·애니메이션·재질·정점 속성 확인 (스크래치 폴더 스크립트, 저장소에 안 넣음).
- 검증: `gltf-validator@2.0.0-dev.3.10` 을 스크래치 폴더에만 설치해 `validateBytes` 로 268개 전부 검사. 저장소엔 패키지를 설치하지 않았다 (CONTRACTS 「npm 패키지 설치 금지」).
- 줄 수: `src/*` 아래 `.js` 를 `wc -l` 로 셈 (빈 줄·주석 포함).
