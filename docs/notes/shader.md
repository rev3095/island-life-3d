# W4 스타일 셰이더 — 작업 노트 (`stylized-shader` 브랜치)

설명서: `docs/SHADERS.md`. 비교: `demos/style.html`, `?style=toon`.

## 바꾼 파일
| 파일 | 내용 |
|---|---|
| `src/core/materials.js` | 스타일 셰이더 (내보내는 이름 그대로: `curve` `curved` `toonGradient` `toonMaterial` `outlineMaterial` `applyToonStyle` `OUTLINE_COLOR`) + 새로 `look`, `STYLE_NAMES`, `outlineMaterials`, `setOutlinesVisible` |
| `src/render/index.js` · `post.js` · `presets.js` | 스타일 서비스, 화면 효과 묶음, 프리셋 |
| `src/main.js` | `createView(ctx)` 로 그리기 (리사이즈·render 호출만), 개발용 `ctx.step(dt)` (한 프레임 돌리기 — 창이 숨겨져 rAF 가 멈출 때 확인용) |
| `demos/style.html` | 스타일 편집기 |

## 계약에 더할 것 (제안)
- `ctx.services.style = { preset, presets, params, set(값|이름), get(), use(이름), compare({on, x, preset|params}), stats() }`, 이벤트 `style:changed {preset, params}`. 주소 `?style=toon|cozy`.
- `ctx.materials` 에 `look`(공용 uniform), `STYLE_NAMES`, `setOutlinesVisible(bool)`.
- `toonMaterial(color, { flat, bend, name, character, wind, water, spec })` — `character`(림 세게), 이름과 상관없이 효과 켜기.
- `outlineMaterial(width, { color, bend, base, wind })` — `base` 를 주면 'subtle' 외곽선이 그 색을 어둡게 쓴다.
- 새 `ShaderMaterial` 을 만드는 트랙: 색을 sRGB 로 그대로 내보내도 된다 (render 가 화면 효과 때만 선형으로 바꿔 준다). 스스로 `#include <colorspace_fragment>` 를 쓰면 손대지 않는다.

## 다른 트랙에 부탁 (내 파일 밖이라 고치지 않음)

### world (W1 `p2-gather` — `src/world/kit.js`)
배경 묶음(kit)은 한 모델의 여러 재질을 `kit-toon` 하나로 합쳐서 **재질 이름이 사라진다** → 이름으로 거는 바람·물결·하이라이트가 섬의 나무·꽃·강물에는 안 걸린다 (캐릭터·모닥불·바다 판·폭포·구름에는 걸림).
둘 중 하나를 부탁:
1. **간단**: `kit.js` 의 `NAMED` 에 `'water', 'waterLight', 'waterDeep'` 을 더한다 → 강물 타일이 `water` 이름 재질로 따로 그려져 물결이 걸린다 (그리기 호출 강 묶음당 +1). 잎·꽃잎도 넣으면 바람이 걸리지만 호출이 꽤 는다.
2. **권장 (호출 그대로)**: `buildTemplate` 에서 꼭짓점 속성 `aStyle`(float: 0 없음, 1 바람, 2 물, 3 하이라이트)을 재질 이름(`materials.STYLE_NAMES`)으로 채워 주면, 그 속성을 읽는 셰이더 분기를 materials 에 더하겠다 (`toonMaterial(..., { styleAttr: true })`).
- 외곽선 'subtle' 의 물체 색: kit 외곽선 판에는 꼭짓점 색이 없어 `look.uOutlineFallback`(연한 갈색)을 쓴다. 외곽선 판에도 `color` 속성(툰 판과 같은 색)을 넣고 재질을 `vertexColors = true` 로 하면 셰이더가 자동으로 그 색을 쓴다 (`OUTLINE_FRAG` 의 `USE_COLOR`).
- 그림자 그릴 때는 three 기본 깊이 재질이라 흔들림·바람이 그림자에 안 나온다 (예전과 같음). 필요하면 `customDepthMaterial`.

### sky (W3 실내 모드 / T5)
- 실내에서 해를 끄면(세기 0) 그늘 색이 실내 전체에 걸리지 않게 빛 세기로 무게를 주었다. 그래도 실내가 보랏빛이면 실내 들어갈 때 `style.set({ shadeTint: '#F2EEF8' })` 처럼 덜 보라색으로, 나올 때 `style.use(style.preset)`.
- 노을(`SKY.dusk`)의 풀이 올리브색으로 보인다 — 툰·cozy 둘 다 그렇다 (해 #FF9C68 × 땅빛 #9A88A8). cozy 의 채도 보정이 조금 더 키운다. 노을 땅빛을 조금 덜 보랏빛·더 분홍으로 하면 동숲 노을에 가깝다.
- 하늘 돔 셰이더 등이 `#include <colorspace_fragment>` 로 선형 → 출력 변환을 하도록 바꾸면 render 의 `linearize()` 가 필요 없어진다 (지금도 문제없음).

### ui (T3)
- 섬폰 설정에 "화면 모습: 포근 / 툰" 고르기를 두려면 `ctx.services.style.use(name)` 과 `style.labels` 를 쓰면 된다. 고른 값을 저장하려면 `state.settings.style` 을 쓰고 시작할 때 `use` (지금은 저장하지 않음).

## 확인한 것
- 같은 장면 toon / cozy × 낮 · 노을 · 비 오는 밤, 바닷가 물, 캐릭터 가까이, 외곽선 세 모드, 지평선(하늘 색 같음) — 스크린샷은 조정 세션 노트 폴더 `w4-shader-shots/`.
- 걷기 (WASD), 섬폰 외곽선 끄기/켜기와 스타일 외곽선 모드가 서로 안 부딪침, 콘솔 오류 없음 (gameplay 하위 폴더 404 는 원래 있음), `node --test tests/` 86개 통과.
- 성능은 `docs/SHADERS.md` 표.

## 남은 것
- kit 묶음(섬 대부분의 나무·꽃·강물)의 바람·물결·하이라이트 — 위 world 부탁이 들어오면 연결.
- 실제 휴대폰에서 재 보지 않았다 (`?quality=low` 를 데스크톱 내장 그래픽에서만 잼).
- 주민(town 트랙)은 아직 장면에 없어 pong·neuru 를 광장에 임시로 세워 확인했다 (부리 하이라이트·림·은은한 외곽선 정상). 실제 배회 중 모습은 town 이 합쳐진 뒤 다시 보기.
