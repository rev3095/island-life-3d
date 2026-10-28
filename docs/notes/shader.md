# W4 스타일 셰이더 — 작업 노트 (`stylized-shader` 브랜치)

설명서: `docs/SHADERS.md`. 비교: `demos/style.html`, `?style=toon`.

## 바꾼 파일
| 파일 | 내용 |
|---|---|
| `src/core/materials.js` | 스타일 셰이더 (내보내는 이름 그대로: `curve` `curved` `toonGradient` `toonMaterial` `outlineMaterial` `applyToonStyle` `OUTLINE_COLOR`) + 새로 `look`, `STYLE_NAMES`, `styleClass`, `outlineMaterials`, `setOutlinesVisible` |
| `src/render/index.js` · `post.js` · `presets.js` | 스타일 서비스, 화면 효과 묶음, 프리셋 |
| `src/main.js` | `createView(ctx)` 로 그리기 (리사이즈·render 호출만), 개발용 `ctx.step(dt)` (한 프레임 돌리기 — 창이 숨겨져 rAF 가 멈출 때 확인용) |
| `demos/style.html` | 스타일 편집기 |

## 계약
`docs/CONTRACTS.md` 끝 "2차 W4 스타일 셰이더" 절에 넣었다 (style 서비스, materials 추가, 합친 메시의 `aStyle`, 새 ShaderMaterial 색 공간).

## 사용자 요청으로 다른 트랙 파일까지 고친 것 (2026-10-29)
1차 제안을 사용자가 "제안 내용 실행"으로 승인해서 직접 넣었다. 합치기 전에 2차 다른 브랜치(`p2-gather`·`p3-town`·`p4-house`)가 같은 파일을 고치지 않는 것을 확인했다.

| 파일 (주인) | 바꾼 것 |
|---|---|
| `src/world/kit.js` (world) | 판 만들 때 꼭짓점 속성 `aStyle = materials.styleClass(재질 이름)` (1 바람 · 2 물결 · 3 하이라이트), 재질은 `styleAttr: true`. 외곽선 판에도 `color` 속성(계절 다시 칠하기도 같이) + `vertexColors` → 은은한 외곽선이 물체 색을 따른다. 그리기 호출 수는 그대로 |
| `src/sky/dome.js` · `precip.js` · `surfaces.js` (sky) | 모든 ShaderMaterial 이 `skyOut()` 으로 sRGB → 선형 → `linearToOutputTexel`. 화면에 바로 그리면 예전과 같은 색(노을 지평선 #F59E79 그대로 확인), 화면 효과 버퍼에서도 같은 색. render 의 `linearize()` 는 이제 sky 재질을 건너뛴다 |
| `src/sky/look.js` (sky) | 노을 빛을 주황 → 분홍 쪽으로: 해 `#FF9C68 → #FFBC9C`, 하늘빛 `#FFCDB3 → #FCD8D2`, 땅빛 `#9A88A8 → #A898BE`, 세기 1.2 → 1.25. 풀이 올리브색 대신 노란 연두로 |
| `src/ui/phone.js` (ui) | 섬폰 설정 → 화면 → **화면 모습: 포근 / 툰 (예전)**. `setSetting('style', …)` → `state.settings.style` 로 저장, render 가 `settings:changed`·`data:loaded` 로 따라간다 |

내 파일 쪽: `presets.js` 에 `INDOOR`(집 안에서 얹는 값)·`glow`(불꽃·반딧불 빛나기), `render/index.js` 에 저장된 설정·`scene:indoor`(W3 의 `time.setIndoor`)·설정 변경 듣기.

## 아직 안 한 것
- 그림자 그릴 때는 three 기본 깊이 재질이라 흔들림·바람이 그림자에 안 나온다 (예전과 같음). 필요하면 `customDepthMaterial`.
- 비 오는 밤: cozy(선형 버퍼에서 섞기)에서 빗줄기·물방울 고리가 toon 보다 조금 또렷하다. 일부러 두었다 (빗속 분위기). 줄이려면 sky 의 비 알파.

## 확인한 것
- 같은 장면 toon / cozy × 낮 · 노을 · 비 오는 밤, 바닷가 물, 캐릭터 가까이, 외곽선 세 모드, 지평선(하늘 색 같음) — 스크린샷은 조정 세션 노트 폴더 `w4-shader-shots/`.
- 걷기 (WASD), 섬폰 외곽선 끄기/켜기와 스타일 외곽선 모드가 서로 안 부딪침, 콘솔 오류 없음 (gameplay 하위 폴더 404 는 원래 있음), `node --test tests/` 86개 통과.
- 성능은 `docs/SHADERS.md` 표.
- **2차 네 브랜치 임시 합치기** (`stylized-shader` + `p2-gather` + `p3-town` + `p4-house`, 충돌 없음, 커밋은 버림): 오류 없이 모든 모듈이 뜨고, 주민 배회·노을, 집 안 낮·밤(`scene:indoor` 로 실내 값 얹기 — 크림 벽이 주황으로 바래지 않게 따뜻함·채도를 덜었다), 밤 반딧불·등불을 확인. 스크린샷 `w4-shader-shots/13~15-*`.
- 반딧불은 아주 작아서(구 반지름 ≈ 0.02) 빛나기를 세게(평면 재질 ×(1 + glow×3)) 해도 기본 카메라에선 점으로 보인다. 더 보이게 하려면 gather 쪽에서 빛무리 스프라이트를 붙이는 게 낫다.

## 남은 것
- 실제 휴대폰에서 재 보지 않았다 (`?quality=low` 를 데스크톱 내장 그래픽에서만 잼).
- 주민(town 트랙)은 아직 장면에 없어 pong·neuru 를 광장에 임시로 세워 확인했다 (부리 하이라이트·림·은은한 외곽선 정상). 실제 배회 중 모습은 town 이 합쳐진 뒤 다시 보기.
