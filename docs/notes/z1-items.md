# Z1 아이템 모델·아이콘 (5차, 브랜치 `p8-items`)

검수 보드 wave5 결정 **D8-B (3D 렌더 썸네일)** 대로, 가구를 뺀 아이템 93개(IC-TL 5 · IC-MA 8 · IC-SD 5 · IC-FR 6 · IC-SH 6 · IC-FL 12 · IC-FS 20 · IC-BG 22 · IC-FO 9)의 아이콘을 이모지에서 Blender 모델 렌더로 바꿨다.
잡은 물고기·곤충·화석을 머리 위로 들어 보일 때도 같은 모델을 쓴다.

## 파이프라인

```
assets/items/specs/<slug>.json ─ node tools/build-item.mjs ─▶ Blender 5.2 (assets/blender/build_item.py + toonkit.py)
   ├─ assets/items/models/<slug>.glb · .glb.json · .stats.json
   ├─ assets/items/renders/<slug>_main.png (480) · <slug>_thumb.png (200, 아이콘)
   │                        <slug>_<변형>_main.png · <slug>_<변형>_thumb.png (색 변형마다)
   └─ assets/items/index.json (목록: 아이템 id → 모델·아이콘 경로·hold·style)
```

- 명령: `node tools/build-item.mjs fish-crucian [...]` · `--all [--jobs 6]` · `--category fish` (tool mat seed fruit shell flower fish bug fossil) · `--index` (Blender 없이 목록만) · `--no-render`. 82개 전부 6개씩 같이 돌려 약 1분 30초.
- slug = 아이템 id 의 `.` → `-` (`fish.crucian` → `fish-crucian`). 예외: 꽃은 종류 하나에 색 변형 4 (`flower-tulip` + variants red·yellow·white·pink), 꽃 씨앗 3종은 `seed-bag` 하나 + variants tulip·cosmos·pansy. 그래서 **고유 모델 82 + 변형 썸네일 11 = 아이콘 93**.
- 스펙 칸: 다른 리소스 스펙과 같은 `id`(검수 보드 IC 번호, 변형 모델은 첫 번호)·`version`·`status`·`prompt`·`style`·`params`·`palette`·`paletteLabels`·`variants` + 아이템 칸:
  - `group` (분류), `kind` (빌더 함수), `items: [{ item, code, variant? }]` (이 모델을 아이콘으로 쓰는 아이템), `hold` (들어 보이는 것: 물고기·곤충·화석),
  - `render: { yaw, pitch }` (썸네일 방향, 없으면 분류 기본값), `pose: { x, y, z }` (도구처럼 비스듬히 세울 때, 도).
- 빌더 `kind` 55개: 물고기는 종마다 함수를 두지 않고 `fish` 하나에 params(길이·몸 높이·두께·꼬리 fork/moon/straight/round/fan/shark·등지느러미 tri/long/spiky/sickle/shark·수염·눈 크기·아가미·꼬리자루 지느러미·무늬 spots/bands/line/waves/patch)로 20종 중 16종, 넙치·오징어·문어·해마만 따로(`flatfish` `squid` `octopus` `seahorse`). 곤충은 `butterfly`(배추흰·호랑·노랑나비·나방: 날개 모양·무늬 자리·깃털 더듬이) · `beetle`(무당벌레·장수풍뎅이·사슴벌레: 점·뿔·큰 턱) · `hopper`(메뚜기·귀뚜라미·방울벌레·사마귀) · `dragonfly`(2종) 등 13개.
- 좌표: Blender Z-up, 정면 -Y, 1.0 = 타일 1칸. 물고기·곤충은 머리가 -Y(게임 three 에서는 +Z — 코드 모델과 같은 방향). **hold 모델은 원점 = 한가운데**, 나머지는 바닥 가운데. 크기 = 들어 보일 때 크기(물고기 0.26~0.74칸, 곤충 0.17~0.38칸).
- 썸네일: 정사영 카메라를 모델 꼭짓점에 꽉 맞춘다(`frame`). 외곽선 굵기는 모델 크기의 0.9% (작은 조개·큰 낚싯대가 같은 굵기로 보이게). 투명 배경 PNG.
- 재질 이름 = 팔레트 키 (리소스 교체 약속). `eye`·`eyeHighlight`·`glow` 는 평면색, 게임 규칙 이름(`glow` 밤에 빛남 — 반딧불이 꽁무니, `shell`·`metal`·`fruit`·`coconut` 하이라이트)도 같은 뜻으로 썼다.

## 게임 쪽

- `src/data/items.js`: 가구 아닌 93개의 `icon` 을 `itemIcon(모델, 변형)` = `assets/items/renders/<모델>[_<변형>]_thumb.png` 로. 예전 이모지는 `emoji` 칸에 그대로 (가구와 같은 방식, 글자 안에 넣을 곳 — `house/craft.js` textIcon 등). FURN 표는 건드리지 않음.
- UI 는 이미 `ui/dom.js iconEl` 이 그림 경로를 `<img>` 로 그려서 가방·상점·박물관·알림·확인 창·제작 창이 그대로 바뀐다.
- 들어 보이기: `gather/meshes.js` 에 `heldModel(id)` (목록에서 hold 모델을 찾아 `assets.loadModel` → `materials.applyToonStyle(목록 style)`, 원본 하나를 캐시하고 사본을 준다 — 도형·재질을 같이 써서 잡을 때마다 재질이 늘지 않는다) · `preloadHeld(id)`. `gather/results.js show()` 는 코드 모델을 먼저 들고, 모델이 오면(두 번째부터는 같은 프레임 안에) 바꿔 든다. 목록·모델을 못 받으면 코드 모델 그대로.
- 코드 모델(`meshes.js` fishParts·화석, `bugmodels.js`)은 그대로 둔다: 날아다니는 곤충·물고기 그림자·받는 동안·못 받았을 때 씀.

## 트랙 폴더 밖에서 고친 것 (합칠 때 확인)

꼭 필요해서 한 줄씩만 고쳤다. 다른 5차 트랙(Z2~Z4)의 파일은 아니다.
1. `src/ui/ui.css` — `img.pk-dex-icon` 크기(34px) 추가. 섬폰 도감은 물고기·곤충·화석을 `iconEl(it.icon, 'pk-dex-icon')` 로 그리는데 지금까지 이모지만 있어서 그림 크기 규칙이 없었다 → 없으면 200px 그림이 칸을 뚫는다.
2. `tools/build-web.mjs` — 에셋 묶음 `items` 추가(아이콘 93 + hold 모델 51, 스펙은 안 넣음 — 게임은 목록의 style 만 쓴다), 표 묶음 이름 '아이템 모델'·'아이템 아이콘', 로딩 진행 어림값에서 `assets/items/` 뺌(처음 잡을 때 받으니까).
3. `tests/build-web.test.mjs` — png 경로 검사에 `assets/items/renders/` 허용.
- 하지 않은 것: `fishing.js`·`bugs.js` 에서 `mk.preloadHeld(id)` 부르기 (물고기가 물었을 때·곤충이 가까울 때 미리 받으면 첫 번째 잡을 때도 코드 모델이 안 비친다 — gather 트랙이 원하면 한 줄).

## 웹 묶음 (게시 파일 수 주의)

`node tools/build-web.mjs --check`: 268 → **413파일 · 13.15MB** (아이템 모델 51개 3.15MB, 아이콘 93개 1.62MB), 묶음 255 + 158. 버전당 511파일 제한에 Z3 가구 13종(×3 = 39) 등을 더하면 ~450 이상 — 5차를 모두 합치면 511 에 가까워질 수 있다. 넘으면 아이콘을 스프라이트 한 장으로 묶는 방법(ui 의 iconEl 이 배경 위치로 그리게)이 있다.

## 만든 것 (빌드 기록)

모델 82개 (물고기 20 · 곤충 22 · 화석 9 · 도구 5 · 재료 8 · 씨앗 3 · 과일 6 · 조개 6 · 꽃 3) · 아이콘 93장 (200px) · 큰 렌더 93장 (480px, 편집기용).
삼각형 합계 약 14만 (모델 하나 최대 5,240 — 공룡 두개골), .glb 합계 3.26MB (.glb.json 4.35MB). 전부 `status: review`, version 0.1.
리소스 교체 약속(CONTRACTS 끝)에 "아이템" 줄을 더하면 좋겠다 (제안): `assets/items/specs` → `index.json` items[].icon = items.js icon, hold 모델 원점 = 가운데.

## 편집기 (합친 뒤 조정 세션)

`bg-editor.html` 에 아이템 탭을 붙이면 같은 "요청 확인" 흐름으로 고칠 수 있다: 스펙 수정 → `node tools/build-item.mjs <slug>` → `node --test tests/` (`items-assets.test.mjs`) → 바뀐 파일만 publish. 스펙 params 는 편집기가 읽는 모양(label·value·min·max 또는 options)으로 두었다. 모두 `status: "review"`, version 0.1.

## 검사 `tests/items-assets.test.mjs` (6개)

아이콘 93개가 썸네일 경로·파일 있음·emoji 남음 / 스펙 82 = 목록 82, id·version·status·style 같음, 모델·통계·썸네일 파일 / 아이템마다 모델 하나, items.js icon = 목록 icon, 변형 썸네일 / 재질 이름 ⊂ 팔레트 키 / hold 51개는 원점 가운데·크기 0.12~0.9, 나머지는 바닥 원점 / params 모양.
