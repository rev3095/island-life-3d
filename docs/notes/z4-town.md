# Z4 이사·생일·새 주민 (5차, 브랜치 `p8-town`)

검수 보드 `wave5` 반영 v1 의 D10-A(새 주민 1명 이사, 아무도 안 떠남) · D11-A(주민 + 플레이어 생일) · D13(새 주민 = 단풍) 을 맡았다.
고친 곳은 PLAN 5차 표의 Z4 칸 그대로: `src/gameplay/town/`, `src/data/birthdays.js`(새), `src/core/constants.js`, `src/world/island.js`, `src/ui/phone.js`, `assets/specs/danpung.json`·캐릭터 모델, `assets/blender/build_character.py`, `tests/town-wave5.test.mjs`(새), `tests/assets.test.mjs`(캐릭터 9 → 10).

## 만든 것

| 무엇 | 어디 | 메모 |
|---|---|---|
| 단풍 CH-10 (여우) | `assets/specs/danpung.json` · `models/danpung.glb(.json)` · `renders/danpung_*` | 빌더 `FEATURES.fox = { ears: 'fox', muzzle: 'cat', tail: 'fox' }` — 고양이 귀 + 귀 끝 진한 색 껍질(`earTip`), 다람쥐 꼬리 + 끝 흰색(`tailTip`), 흰 주둥이. 새 부품 없음. 삼각형 10,240 · 뼈 12. status `review` (확정 전) |
| 단풍 대사 | `src/gameplay/town/lines/danpung.js` | 말끝 '콘', 차분한 존댓말, 첫 줄에 `{player:이라고}`. 박물관·수집·가을 얘기. `letters.moving`(이삿짐 온 날) · `letters.movein`(입주한 날) |
| 단풍 설정 | `people.js` | 테마 색 #D9583B, `joySeason: 'autumn'`(가을엔 초롱의 비처럼 더 뛰고 기뻐함), 박물관을 자주 감, 화석·희귀한 것을 제일 좋아함 |
| 7번째 집터 | `src/world/island.js` | `VILLAGER_SPOTS.danpung = [0.73, 0.67]` (과수원 위 풀밭, 시드 20261028 에서 문 46,39). `NEWCOMERS` 는 집 물체·우편함 없이 자리만 잡고, `places.villagerHouses` 칸에 `lot: { tx, tz, fw, fd, cx, cz, pad }` 를 더 준다. 문 앞 계단 `pad.off = true` (heightAt 이 건너뜀) |
| 이사 흐름 | `src/gameplay/town/movein.js` | 첫날 안내가 끝난 날 = 시작 → **다음 날** 표지판(PR-12) + 밤톨 소식 편지 → **3일 뒤** 이삿짐(PR-10) + 단풍 편지 → **다음 날** 집 + 우편함 + 입주 + 단풍 편지 + `town:movein`. 단계 날은 예정된 날로 적어서 며칠 쉬었다 오면 한꺼번에 따라잡는다(알림은 마지막 것만). 시계를 되돌려도 물러나지 않는다 |
| 생일표 | `src/data/birthdays.js` | 코코 7/14 · 보리 3/21 · 모찌 4/8 · 두부 11/3 · 퐁 9/27 · 초롱 6/18 · 단풍 = 이사 온 날(`state.town.birthdays.danpung`, 이사 온 그날엔 파티 안 함 — 다음 해부터). 2월 29일 생일은 평년엔 2월 28일 |
| 생일 | `src/gameplay/town/party.js` · `talk.js` · `lines/birthday.js` | 그날 주민은 하루 종일 집에(문 두드리면 "들어와" → 생일 대화), 집 문 왼쪽에 풍선(PR-11), 아침 알림 + 초대 편지(만난 주민만), 생일 인사, **선물 친밀도 3배**(+ 기쁜 한마디), 케이크 한 번(`furn.birthday-cake`). 주민 7명 모두 말버릇대로 생일 대사·편지 |
| 플레이어 생일 | `src/ui/phone.js` 설정 → '생일' | 달·날 고르기 → `town.birthday.setPlayer(m, d)`. 그날: 알림, 친한 주민 3명(만난 사람 중 친밀도 순)이 축하 편지(제일 친한 주민 편지에 케이크), 아무도 안 만났으면 밤톨 편지. 대화 첫마디에 주민마다 축하 한마디. 섬폰에 '오늘은 ○○의 생일' 줄 |
| 주민 방 | `villager.js` 모드 `'room'` · `index.js` | `house:enter {owner}` 을 받으면 집에 있던(=`mode 'home'`) 주인을 방 안에 세워 말 걸 수 있게, `house:leave` 면 다시 보이지 않는 집 안으로. 밖에 나가 있으면 방은 비어 있다 |

## 약속 (CONTRACTS 에 넣을 것 — 합칠 때 조정 세션이)

### 상태 `state.town` (새 칸, town 몫)
```js
state.town = {
  movein: { danpung: { start, lot, boxes, moved } },   // 각 단계가 시작된 dayKey (없으면 null)
  birthdays: { danpung: 'MM-DD' },                    // 이사 온 주민 생일 (입주 날)
  playerBirthday: 'MM-DD' | null,                     // 섬폰에서 고름 (town.birthday.setPlayer 로만)
  partyDay, cheerDay,                                 // 하루 한 번 보내는 생일 편지·축하 막기
}
state.villagers[slug].cakeDay / cheerDay              // 케이크 준 날, 플레이어 생일 축하한 날 (rules.villagerState 가 채움)
```
`save.normalize` 는 모르는 칸을 그대로 두고 `save.reset` 은 지우므로 data 쪽 수정은 필요 없다.

### 이벤트
- `town:movein {slug}` — 새 주민이 입주한 순간 (집 물체가 선 뒤). **Z2 house 는 이 뒤에 그 집 문을 연다.**
- `town:birthday {who: 'player', date}` — 섬폰에서 플레이어 생일을 바꿨을 때.
- 받는 쪽: `house:enter {owner, spot?: {x, z}, facing?}` / `house:leave {owner?}`. 주인 이름은 `owner ?? slug ?? villager ?? who ?? house.owner` 순으로 찾는다(`rules.ownerOf`), 없거나 `'player'` 면 플레이어 집. `spot` 이 없으면 들어온 플레이어 자리에서 북쪽 2.3칸(+동쪽 0.4)에 세운다 — **Z2 가 방 안 주민 자리를 spot 으로 넘겨 주면 제일 좋다.** facing 기본 π(남쪽, 문 쪽).

### 서비스 `ctx.services.town` 추가
```js
residents() → ['coco', …]          // 지금 섬에 사는 주민 (단풍은 입주 뒤부터)
atHome(slug) → 'out' | 'home' | 'sleep' | 'room' | null   // home = 깨어 집에 있음(비·저녁·생일), sleep = 밤·새벽(생일이면 home)
birthday: { of(slug), today(), isToday(slug), player(), setPlayer(달, 날 | null), isPlayerToday() }
movein: { stage(slug?), skip(slug?) /* 개발용: 다음 단계로 */, lot(slug?) }
```

### world
- `generateIsland(…, { newcomers = NEWCOMERS })` — 빈 집터 주민. `places.villagerHouses[i].lot` 은 빈 집터에만 있다. 집이 서도 `lot` 칸은 남는다(입주 여부는 `town.residents()` 로).
- 빈 집터·소품·새 집은 `world.objects.add(kind, tx, tz, { persist: false, id: '<kind>@<slug>', owner })` — 저장하지 않고 시작할 때마다 단계대로 다시 놓는다. 집 id `house-villager@danpung`, 우편함 `mailbox@danpung`.
- 7번째 집터가 생기면서 그 뒤에 흩뿌리는 나무·꽃 자리가 조금 바뀐다(같은 시드라도). 예전 저장의 `island.removed` 에 적힌 나무 id 가 다른 나무를 가리킬 수 있지만 오류는 없다.

## 다른 트랙에 맞출 이름 (제안 — Z2·Z3 세션에 메시지로도 보냄)

| 무엇 | Z4 가 찾는 이름 | 없을 때 |
|---|---|---|
| PR-12 집터 표지판 | 배경 slug `lot-sign` (또는 스펙 id `PR-12` 인 아무 slug) | 기존 안내판 `signboard` 로 임시 |
| PR-10 이삿짐 상자 | `moving-boxes` (또는 id `PR-10`) | 건너뜀 |
| PR-11 파티 풍선 | `party-balloons` (또는 id `PR-11`) | 건너뜀 |
| FU-33 생일 케이크 | 아이템 `furn.birthday-cake` (`BIRTHDAY_CAKE`) | 케이크 대사·편지 선물 건너뜀 |
| 단풍 집 지붕 | `house-villager` 스펙 `variants.danpung` (지붕 #D9583B) | 기본 지붕색 (변형 이름은 이미 `danpung` 으로 넘긴다) |

소품은 1×1 칸 가운데에 놓는다(원점 = 바닥 가운데). 표지판은 집터 앞줄 가운데 칸, 이삿짐은 집터 가운데 칸, 풍선은 문 왼쪽 칸(흙길이면 한 칸 더 왼쪽). 스펙 id 로도 찾으므로 slug 가 달라도 합치면 저절로 보인다.

### Z2 (house) 에 바라는 것
- 주민 집 문: 주인이 `town.atHome(slug)` 가 `'home'` 일 때만 들어가게(우선순위 91 이상이면 town 노크 90 보다 먼저). `'sleep'` 이면 test 가 null → 지금처럼 노크만. `'out'` 이면 잠겨 있다고 말하거나 노크로.
- 단풍 집은 `town:movein` 전(= `town.residents()` 에 없을 때)엔 문을 만들지 않는다.
- `house:enter` 에 `owner`(slug) 와 방 안 주인 자리 `spot` 을 넣어 준다. `house:leave` 엔 owner 가 없어도 된다(town 이 기억함).

### 합칠 때 조정 세션이 할 일 (Z4 폴더 밖)
- `src/audio/voice.js` 에 `danpung` 목소리 — 지금은 `PEOPLE.danpung.voice = 'coco'` 를 빌려 쓴다.
- `src/ui/dom.js` `SPEAKERS` 에 `danpung: { name: '단풍', color: '#D9583B' }` (대화창은 color 를 넘겨서 지금도 맞게 나온다).
- `src/core/assets.js` 주석 '캐릭터 9종' → 10종.
- 캐릭터 편집기(`editor.html`) 다시 게시 — 단풍이 `assets/models/index.json` 에 들어가 있다(status review).
- CONTRACTS 상태 표에 `town` 칸, 위 이벤트·서비스.

## 확인한 것 (2026-10-29, dev-server :4214, 창이 숨겨져 `ctx.step` 으로 프레임을 돌림)
- `node --test tests/` 174/174 (새 `town-wave5.test.mjs` 9개: 생일표·윤년·플레이어 생일·선물 3배·이사 단계/따라잡기·소품 이름 찾기·방 주인 이름·섬 집터 4개 시드·대사 묶음). `node tools/build-web.mjs --check` 275파일(캐릭터 모델 10).
- 첫날 안내 끝 → 하루씩 넘기기(디버그 `time.setHour(29)`): 10/30 표지판(임시 안내판) + 밤톨 편지 → 11/2 이삿짐(모델 없어 건너뜀) + 단풍 편지 → 11/3 집·우편함·계단 + 단풍 입주(주민 7명) + 편지. 새로 고침해도 그대로(집·주민 7명).
- 11/3 두부 생일: 두부가 집으로 들어감, 노크 → "들어와" → 자기소개 + 생일 대화 → 잉어 선물 친밀도 2 → 11 (좋아함 3 × 3) + 생일 선물 대사. 케이크는 아이템이 아직 없어 건너뜀. 풍선도 모델이 없어 건너뜀.
- `house:enter {owner:'dubu'}` → 두부가 방 안(플레이어 앞 2.3칸)에 보이고 말 걸 수 있음, `house:leave` → 다시 집 안.
- 섬폰 설정 '생일'에서 11월 3일로 정하기 → 축하 알림 + 두부 축하 편지, 단풍에게 말 걸면 자기소개 뒤 "오늘 생일이시죠? … 축하해요콘!".
- 새 게임(저장 지움): 주민 6명, 빈 집터, 콘솔 오류 없음.

## 못 한 것
- Z2 의 실제 주민 방·문과 함께 돌려 보기 (이벤트만 흉내 냄). Z3 의 PR-10–12·케이크·지붕 변형 모델과 함께 보기 — 합친 뒤 확인.
- 창이 보이는 상태에서 사람 손으로 걷기·애니메이션 확인, 휴대폰 화면에서 섬폰 생일 줄 배치.
