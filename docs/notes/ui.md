# T3 UI — 계약 메모와 제안

`src/ui/` 는 `docs/CONTRACTS.md` 의 `ui` 서비스를 그대로 구현했다. 아래는 구현하면서 정한 것과, 합칠 때 계약에 넣었으면 하는 제안이다.

## 구현하면서 정한 것 (다른 트랙이 알아야 할 것)

- **창이 열려 있을 때 키 입력**: ui 가 `keydown` 을 캡처 단계에서 먼저 받고 `stopPropagation` 한다. 그래서 창이 열린 동안 키보드로는 `input:press` 가 나오지 않는다 (방향키·Enter·Esc·Tab 은 창 안 이동에 쓴다).
  휴대폰 A(action)·B(pickup) 버튼은 `input:press` 로 그대로 오고, ui 는 이것을 "고르기·뒤로"로 쓴다.
  → **gameplay·player 는 `input:press` 를 처리하기 전에 `ctx.services.ui?.isBlocking()` (또는 `ctx.input.enabled`) 를 확인해야 한다.**
- **`isBlocking()` 과 `input.enabled` 는 마지막 창을 닫은 그 입력이 끝날 때까지(마이크로태스크) 막힌 상태를 유지한다.**
  그래서 A 버튼 한 번으로 대화를 닫으면서 바로 다음 대화가 열리는 일이 없다.
- `ui` 는 `#ui` 맨 앞에 붙는다. `#touch-controls` 가 늘 위에 있고, 휴대폰에서는 창·대화창이 조이스틱·A/B 자리를 비켜 선다 (세로: 아래 156px, 가로: 왼쪽 156px·오른쪽 184px).
- 아이템 아이콘(`items.get(id).icon`)은 이모지 글자 또는 그림 경로(`.svg/.png/.webp/.jpg`) 둘 다 받는다. 없으면 분류별 기본 이모지.
- 시계: `time:tick` 이 오면 그 값을, `time` 서비스가 없으면 브라우저 시계를 보여준다. `now().weekday` 는 **JS `Date.getDay()` 처럼 0 = 일요일** 로 읽는다.
- 지도의 플레이어 화살표는 `player.facing` 을 three 의 `rotation.y` 처럼 읽는다 (0 = -Z = 지도 위, +값 = 위에서 볼 때 반시계).
- 기증: `museum.donate(id)` 가 가방에서 빼 주는지 계약에 없어서, 기증 전후 `inventory.count(id)` 를 비교해 안 빠졌으면 ui 가 그 칸에서 1개 뺀다. 어느 쪽이든 동작한다.
- 상점 거래는 ui 가 `wallet.spend → inventory.add` (가방이 차면 환불), 팔기는 `inventory.remove → wallet.add` 로 한다.

## 계약에 넣었으면 하는 것

1. **`ui.confirm({ title, text, icon, buttons:[{label, value, primary}], cancelValue }) → Promise<value>`** — 브라우저 `confirm()` 대신 쓰는 확인 창. 이미 `ctx.services.ui.confirm` 으로 올라가 있다.
2. 선택 인자 추가 (없어도 기존 계약대로 동작):
   - `bag.open({ mode, title?, hint?, filter?(slot, info) → bool })` — 부탁·선물처럼 특정 물건만 고르게 할 때.
   - `shop.open({ stock, tab?: 'buy'|'sell', title?, keeper?, color? })`, `museum.open({ title?, keeper?, color? })`.
3. **아이템 가격 필드**: `price` = 상점이 사 주는 값(판매가), `buyPrice` = 상점에서 살 때 값. ui 는 `sellPrice ?? price`, `buyPrice ?? price` 로 읽는다. T2 가 정해 주면 맞춘다.
4. **레시피 모양**: `{ id, name?, icon?, result?, materials: [{ id, count }] }` (ui 는 `[id, count]` 배열도 읽는다).
5. **새 이벤트 `settings:changed {key, value, settings}`** — 섬폰 설정에서 소리 크기·외곽선·키 안내를 바꿀 때 보낸다. 소리는 `audio.setVolume(key, v)` 도 직접 부른다 (audio 가 있으면).
   외곽선(`settings.outline`)은 아직 아무도 듣지 않는다 → world/materials 쪽에서 이 이벤트를 들어 `outlineMaterial` 을 켜고 끄면 된다.
6. **`state.settings.keyHint` (bool)** 칸 추가 — 왼쪽 아래 키 안내 보이기 (H 키·설정에서 바꾼다).
7. `isBlocking()` 설명에 "닫은 입력이 끝날 때까지 true" 를 적고, 이벤트 표의 `input:press` 줄에 "UI 창이 열려 있으면 무시" 를 적기.

## main 쪽에 하면 좋을 것 (ui 트랙은 고치지 않음)

- `index.html` 의 `.core-check` 안내가 화면 위 가운데에 있어서 좁은 화면에서 HUD 시계·알림과 겹친다 (world 가 없을 때만 보이는 개발용 장면이라 급하지 않음).
- `main.js` 가 없는 모듈을 `import` 해 보다가 콘솔에 404 가 6줄 찍힌다 (모듈 로더 동작이라 정상이지만, 합친 뒤에는 사라진다).
