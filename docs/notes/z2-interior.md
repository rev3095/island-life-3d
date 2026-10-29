# Z2 벽지·바닥·주민 방 (5차, 브랜치 `p8-interior`)

검수 보드 wave5 반영 v1: **D9-A 주민마다 테마 방**, **D12-A 벽지·바닥은 상점에서 매일 하나**. 보드 ID 그대로 (WP-01–08, FL-01–08, RM-01–06).

## 한 것

| 무엇 | 파일 | 내용 |
|---|---|---|
| 벽지 8 · 바닥 8 · 방 틀 스펙 | `assets/interior/specs/{wp-0N,fl-0N,frame}.json` | 지금 room.js `COLORS` 에 박혀 있던 색을 옮김. 무늬는 검수 보드 SVG `<pattern>` 을 그대로 옮긴 판 모양(rect·circle·ellipse·path) + 팔레트. 벽지는 징두리·몰딩·걸레받이 색도, 바닥은 앞 턱 색(`edge`)·발소리(`step`)도. WP-01·FL-01 = 지금 기본(`starter`), WP-08·FL-08 = 상점 한정(`shopOnly`) |
| 주민 방 6곳 | `assets/interior/rooms/rm-0N.json` | 주인(`owner`)·벽지·바닥·주민 설 자리(`host`)·가구. 가구는 지금 있는 것은 `item`(아이템 id), 새 가구는 `fu`(FU 번호) + 모델이 없을 때 그릴 `box [가로, 깊이, 높이]`·`color` |
| 목록 | `assets/interior/index.json` | 상점·편집기용 요약 (`models` 17 · `rooms` 6). id·version·status·이름·값은 스펙과 같아야 한다 (테스트) |
| 규칙 (node 로도 돎) | `src/gameplay/house/interior.js` | 무늬·방 검사기, 오늘의 벽지·바닥 고르기(`todayPick`), 저장 칸 바로잡기(`normalizeHouse`), 주민 방 가구 풀기(`resolveFurniture`), 주민 집 문 규칙(`visitRule`), 스펙 읽기(`loadInterior`), 웹 빌드용 파일 목록(`WEB_FILES`) |
| 무늬 그리기 | `src/gameplay/house/pattern.js` | 스펙 → 캔버스 한 칸(가장자리 넘는 모양은 옆 칸에도 그려 이음매 없음) → 반복 텍스처(UV = m, repeat = 1 / 무늬 크기) · 상점 견본 data: 그림 |
| 방 짓기 | `src/gameplay/house/room.js` | 벽지·바닥은 무늬 텍스처 판(곡면 월드에 맞게 잘게 나눔), 징두리·몰딩·창틀·문 매트는 상자. `buildRoom(ctx, { origin, wallpaper, floor, frame })` → `setWallpaper(spec)`·`setFloor(spec)`. 플레이어 방 x = 500, 주민 방 x = 540 |
| 플레이어 집 꾸미기 | `src/gameplay/house/index.js` | 벽을 보고(0.95칸 안, 벽 가구 없는 자리) 행동 키 = **꾸미기 25** → 벽지 바꾸기 · 바닥 바꾸기 · 가구 놓기 · 그만두기. 가진 것 5개씩 쪽 넘김, 고르면 바로 붙음 |
| 상점 코너 | `src/ui/shop.js` | 사기 탭 맨 위 '오늘의 벽지·바닥' (견본 그림 · 상점 한정 표시 · 가진 것은 '가지고 있어요'). 사면 가방이 아니라 꾸미기 목록에. "사서 바로 붙일게요 / 사기만 할게요" |
| 주민 집·방 | `src/gameplay/house/visit.js` | 주민 집 문 행동 키(91) 또는 문 쪽으로 밀기 → 그 주민 방, 문 매트에서 나가기. 방 하나를 주민마다 다시 꾸며 쓴다. 가구 충돌·러그 높이·발소리. 방 안에서 저장하면 이어하기 |
| 테스트 | `tests/interior.test.mjs` (10개) | 스펙 모양·색, 검사기가 잡는지, 목록=스펙, WEB_FILES=목록·빌드에 들어감, 방 6곳 주인·벽지·바닥, 가구 겹침·문 매트·창문 자리·주민 자리, 새 가구 임시 상자 ↔ 모델, 오늘의 것(같은 날 같음·처음 가진 것 안 팖·모두 돌아감), 저장 칸 바로잡기, 문 규칙 |

## 상태 `state.house` 에 더한 칸
```js
wallpaper: 'wp-01',          // 플레이어 방 벽지 slug
floor: 'fl-01',              // 플레이어 방 바닥 slug
owned: ['wp-01', 'fl-01'],   // 가진 벽지·바닥 slug (처음 가진 것 starter 는 늘 들어 있다)
visit: null,                 // 주민 방 안에서 저장했으면 그 주민 slug (이어하기)
```
예전 저장·모르는 slug·안 가진 것은 `normalizeHouse` 가 기본으로 돌린다 (init·불러오기·reset 뒤 update 에서). data 쪽 수정은 필요 없다 (`save.normalize` 는 모르는 칸을 둔다).

## 행동 키 우선순위 (추가)
| 이름 | 우선순위 | 언제 |
|---|---|---|
| `house-visit-in` | **91** (action) | 주민 집 문 앞, 문(북쪽)을 볼 때. 글자 '들어가기' / 외출 중이면 '노크'(잠김 알림). town 노크 90 보다 먼저 |
| `house-visit-out` | 90 | 주민 방 문 매트 위 |
| `house-decor` | **25** | 플레이어 집 안, 가까운 벽을 볼 때 (벽 가구가 있으면 그 가구 메뉴 80 이 먼저). 글자 '꾸미기' |
| `house-visit-idle` | 20 | 주민 방 안 빈 곳 — 도구(10)를 쓰지 않게 막기만 |

## 이벤트
- `house:enter { owner }` — 플레이어 집이면 `owner: 'player'`. 주민 방이면 `{ owner: slug, roomId: 'rm-01', name: '해변 운동방', spot: { x, z }, facing, room: { x0, z0, x1, z1 } }` (spot = 방 스펙 `host` 의 월드 좌표, 주민을 세울 곳. facing 은 player 와 같은 라디안, π = 남쪽·문 쪽. room = 방 범위(월드), roomId = 방 스펙 slug — Z4 제안 모양). **Z4 town 이 받아 주민을 방 안에 세운다** (Z4 노트의 `spot?`·`facing?` 모양 그대로).
- `house:leave { owner }` — 위와 같은 owner.
- `house:owned { slug, kind }` — 벽지·바닥을 새로 가짐 (상점). `house:decor { kind, slug }` — 플레이어 방 벽지·바닥을 바꿈.

## 서비스 `ctx.services.house` 추가
```js
where              // 'player' | 주민 slug | null — 지금 있는 방 (inside 는 예전처럼 '내 집 안' 만 true)
visiting           // 주민 방이면 그 slug, 아니면 null
visit(slug), leaveVisit()        // 화면 전환까지 하고 들어가기·나오기 → Promise<boolean>
visitRoom          // { x, z, w, d, x0, z0 } 주민 방 자리 (월드)
hostSpot(slug?)    // 지금 꾸민 주민 방의 주민 자리 { x, z, facing } | null
interior: {
  index, current: { wallpaper, floor }, owned,
  list(kind) → [{ slug, id, kind, name, price, owned, current, shopOnly }],
  today() → [오늘 벽지, 오늘 바닥] (위 모양 + swatch: data: 그림),
  owns(slug), add(slug) → bool (도토리는 상점이 받는다), apply(kind, slug) → bool (가진 것만),
  swatch(slug), spec(slug),
}
```

## 주민 집 문 규칙 (Z4 와 맞춘 것)
`visitRule(town, slug)`: `town.residents()` 에 없으면(이사 오기 전) 문 없음 → `town.atHome(slug)` 가 `'home'` 이면 들어가고, `'out'` 이면 잠김 알림, `'sleep'`·`'room'` 이면 비켜서 town:knock(90) 이 노크한다. **`atHome` 이 없는 지금 main 의 town 이면 언제나 열린다** (그래서 이 브랜치 혼자서는 주민이 밖에 있어도 빈 방에 들어간다 — Z4 와 합치면 규칙대로).

## 리소스 교체 약속 (벽지·바닥·방, CONTRACTS 끝 절에 더할 것)
- 벽지·바닥 모양·색은 그 스펙 하나만 고치면 게임·상점 견본이 같이 바뀐다 (코드에 색 없음). `version` 을 올리고 status `review` — 다른 리소스와 같은 규칙. 지금 17개 모두 `review` (v1).
- 무늬 좌표는 `pattern.tile` 안(검수 보드 SVG 좌표), 실제 크기는 `pattern.size` (m). 색은 `fill`·`stroke` 에 팔레트 키(또는 #색). 벽지 팔레트엔 `wainscot molding baseboard`, 바닥 팔레트엔 `edge`, 바닥엔 `step` (`wood sand grass` — player 발소리).
- 방 배치는 `rooms/rm-0N.json`. 가구 칸은 집 안 칸 규칙(grid.js) 그대로 — 바닥 `{ gx, gz, rot }`, 벽 `{ wall, slot }`. 새 가구는 `fu` 로 적으면 `assets/furniture/index.json` 에 같은 `id` 가 들어오는 순간 그 모델·발자국으로 바뀐다. 겹침·문 매트·창문 자리·주민 자리는 테스트가 본다.
- 새 벽지·바닥·방을 더하면 `index.json` 과 `interior.js` `WEB_FILES` 에도 더한다 (테스트가 어긋남을 잡는다).

## CONTRACTS 제안 (합칠 때 '5차 Z2' 절로)
위 "상태 / 행동 키 / 이벤트 / 서비스 / 리소스 교체 약속" 다섯 묶음을 그대로. 2차 W3 절의 `house:enter {}`·`house:leave {}` 는 `{ owner }` 가 붙는다(빈 객체로 받던 곳은 그대로 돈다).

## 다른 트랙·조정 세션에 부탁 (이 트랙 폴더 밖)
1. **intro (합칠 때 꼭)**: `src/gameplay/intro/index.js` 의 `events.on('house:enter', () => complete('home'))` 가 주민 집에 들어가도 '내 집에 들어가 보기' 를 끝낸다 → `({ owner } = {}) => { if (!owner || owner === 'player') complete('home'); }`.
2. **Z3 가구**: 이미 맞음 — p8-furniture 의 `assets/furniture/index.json` (FU-21–33, id = `FU-2N`) 으로 돌려 보니 방 6곳 가구 24개가 모두 실제 모델로 풀리고 배치 검사도 통과. 합치면 임시 상자는 저절로 사라진다. 꽃 선반·과일 바구니 변형을 고르고 싶으면 방 스펙에 `variant` 만 더하면 된다.
3. **Z4 town**: `house:enter` 의 `spot`·`facing` 을 쓰면 된다. 단풍(CH-10) 방은 아직 없다 → 기본 방(WP-01·FL-01, 가구 없음)으로 열린다. RM-07 을 만들 때 `rooms/rm-07.json` + `index.json` + `WEB_FILES`.
4. **웹 빌드 (선택)**: `tools/build-web.mjs` `FAMILIES` 에 `{ name: 'interior', index: 'assets/interior/index.json', each: s => [s.startsWith('rm-') ? \`assets/interior/rooms/${s}.json\` : \`assets/interior/specs/${s}.json\`] }` 를 넣고 목록 `rooms` 도 읽게 하면 `WEB_FILES` 를 지울 수 있다. 지금은 `WEB_FILES` 글자로 빌드에 24개가 들어간다 (`--check` 295파일).
5. **배경 편집기 벽지·바닥 탭** (조정 세션): 스펙 모양은 위 약속대로. 견본 그림은 `pattern.js` `swatchURL(spec)` / `patternCanvas(spec)` 를 그대로 쓰면 게임과 같은 그림이 나온다 (DOM 캔버스만 씀).
6. **ui.css (선택)**: 상점 코너는 지금 있는 `.pk-stock` 줄 모양 + 인라인 스타일. `.pk-shop-decor` 클래스에 제목 여백·견본 테두리를 옮기면 깔끔하다.
7. **섬폰 꾸미기 (나중에)**: 지금은 집 안 벽 메뉴로만 바꾼다. 섬폰에 '꾸미기' 앱을 두려면 `house.interior.list/apply` 를 부르면 된다 (phone.js 는 Z4 몫이라 손대지 않음).

## 확인한 것 (2026-10-29, `node dev-server.mjs --port=4212`, 미리보기 창이 숨겨져 있어 화면은 느리게 그려짐)
- `node --test tests/` **175/175** (새 interior 10개). `node tools/build-web.mjs --check` 오류 없음, 295파일 (interior 24개 들어감, 묶음 255 + 40).
- 새 게임 → 이름 정하기 → 첫날 안내 → 내 집 문 Space → 방이 크림 줄무늬·나무 판자(지금과 같은 색) 무늬로 나옴. 북쪽 벽 보고 Space → 꾸미기 → 벽지 바꾸기 → 가진 6개 중 5개 + '다른 것 보기 ▶' → 연보라 꽃무늬 고르면 바로 바뀌고 징두리 색도 바뀜. 통나무 벽·연못 돌바닥·밤하늘 별(금색 몰딩)·폭신 카펫·빗방울·노랑 체크 모두 붙여 봄.
- 상점(`ui.shop.open`) 사기 탭 맨 위 '오늘의 벽지·바닥' = 통나무 벽 벽지 1,600 · 노랑 체크 타일 바닥 1,400 (견본 그림). 바닥 → "사서 바로 붙일게요" → 도토리 5,501 → 4,101, 방 바닥이 바뀌고 줄이 '가지고 있어요'. 새로 고침 뒤에도 벽지·바닥·가진 목록이 남음.
- 코코 집 문 Space → 해변 운동방(오렌지 줄무늬·밝은 판자, 오렌지 소파·스탠드 모델, 서핑보드·공 바구니는 임시 상자), `house:enter {owner:'coco', room:'rm-01', spot, facing}` (그 뒤 `room` 은 범위, slug 는 `roomId` 로 옮김). 문 매트 Space → 코코 집 문 앞으로, `house:leave {owner:'coco'}`, 실내 조명 꺼짐. 보리·모찌·두부·퐁·초롱 방도 차례로 들어가 봄 (벽 낚싯대 걸이 임시 상자 포함). 가구 칸 걷기 막힘(isWalkable false). 초롱 방 안에서 저장 → 새로 고침 → 초롱 방 안에서 이어하기.
- 웹 빌드본: `node tools/build-web.mjs` → dev-server `/artifact/` 에서 interior 스펙 17개·방을 읽고 초롱 방 이어하기 → 보리 집 문 Space → `house:enter {owner:'bori', room:'rm-02', spot:{x:539.5, z:-0.4}, facing:π}`. 문 규칙: `town.atHome` 을 흉내 내 'out' → 글자 '노크'(잠김), 'sleep' → 비킴, 'home' → '들어가기'.
- 콘솔 오류 0.

## 못 한 것 · 알아 둘 것
- Z3 모델·Z4 주민 세우기와 **함께** 돌려 보기는 합친 뒤에 (Z3 목록으로 방 배치 검사만 미리 통과시킴).
- 휴대폰 화면에서 꾸미기 선택지·상점 코너 줄 높이, 실제 GPU 성능은 안 봄. 벽지·바닥 텍스처 2장 + 주민 방 2장 (128~512px) 이라 무겁지 않다.
- 밤에는 실내 따뜻한 빛 때문에 하늘 체크·흰 타일이 베이지에 가깝게 보인다 (낮엔 스펙 색). 고치려면 render 실내 값(INDOOR) 쪽.
- claude.ai 게시본은 안 열어 봄 (게시는 조정 세션이 합친 뒤에).
