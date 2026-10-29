# Y3 그리기 다듬기 — 작업 노트 (`p7-render` 브랜치)

main 3b98be9 에서 갈라짐. 고친 곳: `src/core/materials.js`, `src/render/cull.js`, `src/world/`, `src/player/index.js`, `src/gameplay/town/actor.js`, `docs/SHADERS.md`, 새 테스트 `tests/banks.test.mjs`. 모델 파일은 그대로.
`src/gameplay/house/furniture.js` 는 고칠 필요가 없었다 (가구는 `applyToonStyle` 을 거쳐서 저절로 가림 투명 대상).
스크린샷(전·후): 조정 세션 노트 폴더 `y3-render-shots/`.

## 만든 것

| 파일 | 내용 |
|---|---|
| `src/core/materials.js` | ① **캐릭터 합치기** `applyToonStyle(root, { merge: true })`: 같은 뼈대의 부품을 꼭짓점 색 + `aStyle`(하이라이트) 로 굳혀 [몸 · 눈·볼 · 외곽선] 세 `SkinnedMesh`, 뼈대 하나. 굳힌 모양은 같은 모델끼리 나눠 쓰고(첫 부품 geometry 열쇠), 색 속성은 `setColor` 때만 떼어 낸다. ② **공용 디더 가림**: 모든 툰·평면·외곽선 재질에 `FADE_FRAG` (세기 = max(재질 uniform, `aFade` 속성)). `applyToonStyle` 은 모델마다 uniform 하나를 재질 전부에 나눠 주고 `root.userData.toonFade`·`setFade(v)` 로 내놓는다. ③ **그림자 깊이 재질** `shadowDepthMaterial({ wind, attr }, { key, extra })` (곡면·디더 없음, 선택지마다 하나), 바람 재질엔 `userData.shadowSway` |
| `src/world/kit.js` | 자기 디더 코드를 지우고 materials 공용으로 (인스턴스 `aFade` 는 그대로). 흔들림(`aSway`·`aShake`)을 그리는 재질과 그림자 깊이 재질에 같이 얹는다 → 나무 흔들기·바람이 그림자에도. 바람 부품이 없는 판은 기본 깊이 재질 그대로 |
| `src/world/occlusion.js` | 묶음 밖 모델(주민·가게 주인·가구·배경 단독 물체): 1초마다 장면에서 `toonFade` 를 단 root 를 찾아 모델 좌표 상자를 한 번 재고, 매 프레임 월드 상자(곡면만큼 내림)로 같은 광선 시험 → 통째로 디더. 대상 발밑이 상자 안이면(대화 상대 자신) 뺀다. 낮은 것(< 0.45, 러그)은 뺀다. `add({ box, setFade })` 로 직접 넣기 |
| `src/render/cull.js` | 1초 훑기 때 `shadowSway` 재질로 그림자를 드리우는 메시에 깊이 재질을 붙인다 (`aStyle` 이면 바람 꼭짓점이 실제로 있을 때만). `culler.windShadow` 켜고 끄기 (비교용) |
| `src/world/banksfield.js` (새, three 없음) | ① 강 둑 거리장: 층마다 강물 칸 둘레 네모(±2칸)만, 칸당 8격자, '같은 층의 땅'(풀·모래·길·광장) 가면을 σ 0.32 로 흐려 문턱 0.27 등고선 → 물 쪽 거리. 폭포 둘레 1.8칸은 등고선을 칸 경계로 되돌린다(폭포 판이 강 너비 그대로라). ② 풀/모래 '모래 정도': 같은 층의 풀·모래 칸만 무게를 두고 흐린 비율 (다른 칸은 경계를 밀지 않는다) |
| `src/world/banks.js` (새) | ① 둑 앞치마 판: 강물 칸 안 격자 꼭짓점, 등고선 안쪽은 땅 윗면(-0.006) → 0.16칸 흙 비탈로 물 밑. 윗면 색 = 붙은 땅 종류, 비탈 = 흙. 재질 이름 `ground` (비에 젖음). ② 물가 거품 띠: 물 위 얇은 판, 물가 선에서의 거리로 밀려왔다 빠지는 띠 + 끊긴 자국, discard 만 (정렬 없음). ③ 풀/모래: 땅 타일 공용 `ground` 재질에 R8 텍스처(칸당 4)로 0.5 등고선을 잔물결처럼 흔들어 다시 칠한다. 풀 술·모래 점은 반대편이면 지운다 (판 꼭짓점 `aGround` 1 윗면 · 2 풀 술 · 3 모래 점). ④ `riverDistance(x, z)` |
| `src/world/coastfield.js` | 등고선 거리 계산을 `contourDistance()` 로 떼어 내 둑과 같이 쓴다 (`blur` 도 내보냄). 해안 값은 예전과 한 비트도 안 다름 (시드 3개 비교) |
| `src/world/terrain.js` · `index.js` | 둑·거품 판을 지형 묶음에, 계절 바뀌면 `banks.setGrass`. `world.riverDistance`, `world.occlusion.add` |
| `src/player/index.js` · `src/gameplay/town/actor.js` | `merge: true`. 플레이어는 `model.userData.occluder = false` |

## 정한 것

- **합치는 단위 = 뼈대 하나**. 캐릭터 glTF 는 메시 하나에 부품 7~12개라 three 가 부품마다 `SkinnedMesh` + `Skeleton` 을 만든다 (장면에 뼈대 87개 → 뼈 텍스처 87번 올림). 합치면 9개. 눈·볼은 평면(빛 안 받음) 재질이라 따로 한 메시, 그림자는 안 드리운다 (몸에 붙어 몫이 없다). 투명 부위는 캐릭터에 없어서 따로 둘 것이 없었다.
- 주민 사라지기(opacity)는 예전처럼 재질 `transparent` — 합친 재질 세 개에 그대로 걸린다. 디더로 바꾸지 않았다 (계약 그대로, 반투명 모습 유지).
- **디더 세기 두 갈래**: 배경 묶음은 칸마다 다르니 인스턴스 속성, 모델은 통째라 uniform. 셰이더 하나에서 max 로 합쳐 프로그램이 늘지 않는다 (`aFade` 기본값 0, uniform 기본은 함께 쓰는 0).
- 가림 대상 찾기는 등록이 아니라 **1초마다 장면 훑기** — 가구를 넣고 빼거나 주민이 생겨도 따로 부를 것이 없고, 빠진 것은 원래대로 돌린다.
- **강 둑 폭**: 문턱이 0.25 아래면 튀어나온 땅 모서리가 둑 밖으로 삐죽 나온다 (해안과 같은 이유로 0.27). 그 대신 곧은 둑도 칸 경계보다 0.2칸 물 쪽으로 나와 강이 한쪽 0.26칸씩 좁아 보인다 (2칸 강 → 약 1.5칸). 흐림을 줄여(σ 0.32, 해안 0.55) 좁아지는 몫을 줄이고, 비탈을 좁게(0.16칸) 해서 동숲처럼 벽에 가까운 둑으로. 걷기·충돌은 칸 그대로라 플레이어는 둑 위(땅 칸)에서 멈춘다.
- **풀/모래는 판 대신 셰이더**: 같은 높이 두 타일이라 판을 겹치면 깜빡인다 → 땅 재질에서 다시 칠하기. 땅 재질은 풀·모래·길·광장·절벽이 함께 쓰는데 `aGround` 가 있는 풀·모래 판만 텍스처를 읽는다 (경계 근처만 잡음 계산).
- **그림자 바람**: 바람 재질만 깊이 재질을 바꾼다 (기본 깊이 재질과 같은 프로그램 수 + 선택지마다 하나).

## 성능 표

Intel UHD (내장), 1280×800, 화소 배율 1, `cozy`. **처리량** = 60프레임을 쉬지 않고 그린 뒤 한 번 기다린 프레임당 ms (3번 중 가운데). 전 = main 3b98be9 를 다른 포트로 띄워 같은 브라우저에서 번갈아 (각 2번씩, 아래는 두 번 값). 주민 6명을 플레이어 둘레 같은 자리에 세웠다 (선착장·광장·비 오는 밤). c = 그리기 호출(그림자·화면 효과 포함), k = 삼각형, cpu = `ctx.step` 시간.

### high
| 장면 | 전 | 후 |
|---|---|---|
| 광장 낮 (주민 6) | 11.06 / 10.59ms · 363c · 1642k · cpu 6.8 / 4.5 | **9.94 / 9.88ms · 167~171c** · 1580~1609k · cpu 1.2 / 1.0 |
| 선착장 (주민 6) | 10.99 / 11.03ms · 363c · 2077k · cpu 4.6 / 4.7 | **10.70 / 10.55ms · 194c** · 2078k · cpu 2.1 / 1.1 |
| 비 오는 밤 광장 (주민 6) | 10.61 / 10.47ms · 339~367c · cpu 5.2 / 5.4 | **9.90 / 9.93ms · 175c** · cpu 1.1 |
| 집 안 | 5.41 / 5.48ms · 104c · 53k | **5.36 / 5.43ms · 90c** · 52k |

### low (`?quality=low`)
| 장면 | 전 | 후 |
|---|---|---|
| 광장 낮 | 9.72 / 9.73ms · 353c · 1564k · cpu 4.8 | **9.00 / 8.91ms · 166~169c** · cpu 3.9 / 2.5 |
| 선착장 | 9.83 / 9.88ms · 352c · 1928k · cpu 4.4 | **9.28 / 9.49ms · 183c** · cpu 2.2 / 2.5 |
| 비 오는 밤 광장 | 9.48 / 9.71ms · 341~357c | **8.73 / 8.69ms · 170~172c** |
| 집 안 | 4.75 / 4.64ms · 104c | **4.65 / 4.70ms · 90c** |

- 그리기 호출은 주민이 모이면 절반 아래로, CPU(`step`) 는 1/3~1/5 (뼈 텍스처 올리기 87 → 9번, 호출 줄어듦). GPU 처리량은 0.3~1.1ms 줄었다 (이 GPU 는 호출 하나 ≈ 40µs).
- 삼각형 수는 그대로 (합쳐도 같은 꼭짓점). 둑 판 4.9k · 거품 판 5.8k 삼각형이 더해졌다 (강이 보일 때만 화면에).
- **그림자 바람 비용** (광장 high, 같은 페이지에서 `culler.windShadow` 켜고 끄기 3번): 10.52/10.39 · 10.44/10.24 · 10.39/10.24ms → **약 +0.15ms**. 나무 많은 곳 2번: 10.68/9.96 · 10.09/10.08 (흔들림이 커서 들쭉날쭉, 0~0.7ms).
- 확인: 나무 흔들기 5프레임 뒤 그림자 자리(200×120 화소)의 바뀐 화소 779개(깊이 재질 있음) vs 193개(없음, 둘레 다른 움직임).

## 계약 제안 (합칠 때 `docs/CONTRACTS.md` 에 반영 부탁)

**materials**
1. `applyToonStyle(root, { …, merge })` — `merge: true` 면 뼈대 메시 부품을 합친다. 돌려주는 값에 `fade`(uniform) · `setFade(v)` 추가. 합쳤을 때 `materials[이름]` 은 합친 재질(부품 공유) → 색은 `setColor` 로만.
2. 모든 툰·평면·외곽선 재질은 디더 가림을 안다: 꼭짓점·인스턴스 속성 `aFade`(0~1) 또는 `toonMaterial/outlineMaterial({ fade: {value} })`. `FADE_MAX` (0.7). `root.userData.toonFade` / `root.userData.occluder = false`.
3. `shadowDepthMaterial({ wind, attr }, { key, extra })` → 바람 그림자용 `customDepthMaterial`. 재질 `userData.shadowSway` 가 있으면 render 가 그림자 드리우는 메시에 붙인다 (직접 붙인 `customDepthMaterial` 은 건드리지 않는다).

**world**
4. `world.occlusion.add({ box(out: Box3) → Box3|null, setFade(v) })` → 해제 함수. `applyToonStyle` 모델은 저절로 대상 (주민·가구도 카메라와 플레이어 사이면 비친다). `list()` 에 모델 이름도 나온다.
5. `world.riverDistance(x, z)` → 강물 칸이면 보이는 물가 선에서 물 쪽 거리(칸, 둑 위 < 0), 아니면 `null`.
6. 셰이더 덧씌우기 이름: 땅 공용 재질에 `aGround`·`uGround*`, 거품에 `aBankD`·`uBankTime` 을 쓴다.

**render**
7. `style.culler.windShadow` (기본 true) — 비교·문제 찾기용.

## 다른 트랙에 부탁

- **Y2 채집** (`src/gameplay/gather/`): ① 강에서 낚시찌가 떨어지는 자리·물고기 그림자 자리는 둑이 0.2칸쯤 물 쪽으로 나와 있다 → `world.riverDistance?.(x, z) > 0.15` 인 곳으로 (지금은 칸 경계 바로 옆이면 둑 위 풀에 찌가 앉아 보일 수 있다). ② 공유 재질 인스턴스(채집 물체)를 가림 투명에 넣고 싶으면 `aFade` 인스턴스 속성을 두고 `world.occlusion.add({ box, setFade })` — 지금 채집 물체는 키가 작아 가릴 일이 거의 없어 넣지 않았다. ③ 바람 이름 재질(`weed` 등)로 그림자를 드리우면 그림자도 저절로 흔들린다 (따로 할 것 없음).
- **Y1 조작** : 부탁 없음. (섬폰 외곽선 끄기·스타일 외곽선 'off' 는 합친 캐릭터 외곽선에도 그대로 된다 — 확인함.)
- **조정 세션**: 새 파일 `src/world/banks.js`·`banksfield.js` 는 import 를 따라 웹 묶음에 저절로 들어간다 (`node tools/build-web.mjs --check` 통과, files-2 에 12개). 캐릭터 편집기(`editor.html`)는 자기 툰 코드라 영향 없음.

## 확인한 것

- `node --test tests/` 138개 통과 (새 `tests/banks.test.mjs` 5개: 물가 선, 튀어나온 땅 모서리 ≤ 0.08칸 · 곧은 둑, 층마다 격자, 풀/모래 칸 가운데, 해안 거리장). `node tools/build-web.mjs --check` 통과. 콘솔 오류 없음 (`index.html?debug`, `?quality=low`, `demos/style.html` 프리셋·외곽선 바꾸기).
- 해안 거리장을 함수로 나눈 뒤 값이 예전과 같음 (시드 1·12345·99, 92160칸 모두).
- 캐릭터: 뼈대 메시 139 → 27, 뼈대 87 → 9. 가까이(시야 14°) 전·후 비교 — 눈·볼·코 하이라이트·은은한 외곽선·털 색 같음 (`chars-before/after`). 동작: 걷기·기뻐하기(happy 한 번)·서기, 플레이어 잠자리채 들고 `act('swing')`, 주민 opacity 0.5 반투명 (`chars-anim-after`).
- 가림 투명: 주민이 플레이어 바로 남쪽(카메라 쪽)에 서면 디더 (`occl-villager-after`, 그림자 남음), 집 안 스탠드를 플레이어 앞으로 옮기면 디더 → 제자리로 돌리면 0 (`09-indoor-occlude-after`). 나무·박물관(kit) 디더도 그대로.
- 강: 한 칸 꺾이는 곳·연못 모서리가 곡선, 물가 거품 띠, 폭포 앞뒤는 강 너비 그대로 (`river-jog-zoom-after`, `river-fall-zoom-after`, `pond-after`, `05-river-*`). 풀/모래 경계 곡선 (`06-grass-sand-*`).
- 낮·노을·비 오는 밤 광장, 선착장, 집 안 낮·밤 전·후 (`01~08`) — 캐릭터·물체 모습 차이 없음.

## 확인 못 한 것 · 남은 빈틈

- 실제 휴대폰·다른 GPU — 이 노트북 내장 그래픽에서만 쟀다. 진짜 rAF 로 오래 걸으며 본 fps 는 못 봄 (미리보기 창이 숨겨져 `ctx.step` 으로).
- 겨울(풀이 흰색)·봄 계절의 둑 윗면·풀/모래 경계 색은 코드로 따라가게 했지만 화면으로는 가을만 봤다.
- 강어귀(강이 바다와 만나는 곳)는 해안 앞치마와 둑 판이 각자 그려진다 — 가까이서 보지 않았다.
- 주민 사라지기(반투명) 중엔 합친 몸 안쪽 면이 비쳐 보인다 (예전도 부품마다 비슷했다). 더 깔끔하게 하려면 사라지기도 디더(`setFade`)로 바꾸는 방법이 있다 — actor 의 `setOpacity` 계약을 바꾸게 되니 그대로 뒀다.
- 그림자 깊이 재질은 방향광(해)만. 점광·스포트 그림자는 지금 장면에 없어 `customDistanceMaterial` 은 만들지 않았다.
