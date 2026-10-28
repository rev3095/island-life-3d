# T5 시간·계절·날씨·하늘 — 작업 노트 (`sky-time` 브랜치)

## 만든 것

| 파일 | 내용 |
|---|---|
| `src/sky/index.js` | 모듈 입구. `ctx.services.time` 등록, 매 프레임 조명·안개·하늘·입자·밤 조명 갱신, 이벤트 |
| `src/sky/clock.js` | 순수 시계 계산 (`computeNow`, `dayKeyOf`, 5시 경계, `nightFactorAt`) — DOM·three 없음 |
| `src/sky/weather.js` | 순수 날씨 예보 (`forecast(dayKey, season, seed)`, `weatherAt`) — DOM·three 없음 |
| `src/sky/look.js` | 시각·날씨 → 하늘색·조명 값 (PAL-T1~T4 섞기, 해·달 경로, 흐림 보정) — three 없음 |
| `src/sky/dome.js` | 카메라를 따라다니는 하늘 돔(그라데이션·해·달) + 별 1400개 |
| `src/sky/clouds.js` | 툰 구름 14개 (`ctx.materials.toonMaterial`, 곡면 월드 적용, 안개 끔) |
| `src/sky/precip.js` | 비(선분 1800)·물방울 튀김(220)·눈(1400)·무지개. 모두 GPU 에서 움직이고 곡면 월드로 휜다 |
| `src/sky/surfaces.js` | 밤 조명(`glow`·`window` 재질), 등불·모닥불 빛무리와 바닥 빛웅덩이, 비 올 때 젖은 땅 |
| `src/sky/seasons.js` | 배경 스펙 `variants` 로 계절 팔레트 만들기 |
| `src/sky/debug.js` | `?debug` 조절 판 (시각 끌기·멈춤·시계 모드·날씨·계절·프레임 시간) |
| `demos/sky.html` | core + sky 만으로 도는 데모 (`?hour=18.5&weather=rain&season=winter&cam=view&pause&mode=fast`) |

## 동작 요약

- **시계**: `real` = `Date`, `fast` = 실제 1분 = 게임 1시간. 하루(`dayKey`)는 5시에 바뀐다.
  - `state.time.fastOffset` 뜻: fast 모드 게임 시각(ms) = `Date.now() × 60 + fastOffset`. 저장되므로 껐다 켜도 이어지고, 꺼져 있는 동안에도 60배로 흐른다.
  - 디버그 판의 시각 끌기(실제 시계 모드)는 저장하지 않는 임시 차이값이라 새로 열면 실제 시각으로 돌아온다.
- **시간대 섞기**: 밤→새벽 4:30~5:36, 새벽→낮 7:00~8:30, 낮→노을 16:24~17:30, 노을→밤 18:30~19:36. `nightFactor` 는 17:24부터 올라 19:00에 1, 새벽 4:54~6:12에 내려간다 (가로등 스펙 "저녁 6시에 켜진다" → 18시에 0.3쯤, 19시에 다 켜짐).
- **하늘 팔레트 방향**: 컨셉 보드 띠 색 두 개 중 차갑고 어두운 쪽을 천정, 밝고 따뜻한 쪽을 지평선에 두었다 (새벽: 천정 #A9C9EE·지평선 #F9C9A5, 노을: 천정 #7A6BB3·지평선 #F59E79). 안개 색 = 지평선 색.
- **해**: 5시 동(+X) → 남쪽 하늘(+Z) → 19시 서(-X). 그림자는 북쪽(화면 위)으로 진다 → 카메라 쪽 면이 밝게 보인다. 밤엔 달이 약한 방향광. 해·달이 바뀌는 19시·5시엔 둘 다 세기 0 이라 그림자가 튀지 않는다.
  - 달 원반은 볼 수 있게 북쪽 하늘에 낮게 그린다 (빛 방향과 따로 노는 연출).
- **날씨**: `hash(섬 시드|dayKey|계절)` 시드. 아침 날씨 하나 + 11~14시에 한 번 바뀔 수 있음. 계절별 비 18~26%, 흐림 16~24%, 눈은 겨울만 28%. 무지개는 아침 비 → 한낮에 2시간 (전체 날의 3% 쯤). 바뀔 때 하늘은 2~6초, 땅은 25초에 젖고 60초에 마른다.
- **밤 조명**: 3초마다(그리고 `world:ready`·`game:ready` 때) 장면을 훑어 재질 이름을 모은다. 다른 모듈이 색을 바꾸면(계절 등) 그 색을 새 기준으로 삼는다.
- **성능**: 확인 장면(1536×1152, 비 + 밤)에서 프레임 8.6ms(화면 주사율 한계), 그리기 호출 100, 셰이더 16개. 입자는 CPU 계산 없음.

## 계약 제안 (합칠 때 `docs/CONTRACTS.md` 에 반영 부탁)

1. **`now()` 추가 필드**: `hourF`(소수 시각, 하늘·음악 섞기용), `ms`(게임 시각 ms), `weekdayName`('일'~'토'). 돌려주는 객체는 얼려 있다(`Object.freeze`) — 고치지 말고 복사해서 쓸 것.
2. **시작 알림**: `game:ready` 때 sky 가 `time:tick {now}`, `time:part {part, initial: true}`, `weather:change {weather, initial: true}` 를 한 번 보낸다. ui(시계)·audio(배경음)는 이걸로 첫 상태를 잡으면 된다. `time:newday` 는 시작 때 보내지 않는다 (data 의 `day.check()` 가 저장된 dayKey 와 비교).
3. **개발용 추가 함수** (계약 밖, 디버그·시연용): `forecast(dayKey?) → [{from, weather}]`, `setHour(hh)` (5~29, 같은 날 안), `paused`/`setPaused(bool)`, `setWeather(w, {instant})`, `weatherOverride`, `seasonOverride`/`setSeasonOverride(season|null)`.
4. **날씨 강제(`setWeather`)는 다음 날(5시)에 풀린다.** 특별 행사용으로 오래 유지가 필요하면 말해 주세요.
5. **재질 이름 약속 (T1 world 에게)**: 밤에 켜지는 것 = `glow`(등불)·`window`(창유리), 빛무리 = `glow`·`flame`, 비에 젖는 땅 = `ground grass grassDark path dirt sand sandDark stone stoneLight grout pebble cliff cliffDark`. `applyToonStyle` 이 스펙 재질 이름을 그대로 두므로 지금 모델은 다 맞는다. 땅을 합치거나 새 재질을 만들 땐 이 이름을 써 주세요.
6. **`world.setSeason(season)`** 은 `world:ready`, `game:ready`, 계절이 바뀔 때 불린다 → 여러 번 불려도 괜찮게(멱등) 만들어 주세요. 같은 내용의 `time.seasonPalette(season).variants` (`{ tree:'autumn', 'tile-grass':'autumn', cedar:'snow' ... }`)를 그대로 `objects.setVariant` 에 써도 된다.
7. **실내(P4)**: 집 안에선 비·눈·구름을 끄고 하늘 조명을 실내용으로 바꿔야 한다. `time` 에 `setIndoor(bool)` 을 두거나 `scene:indoor {on}` 이벤트를 듣는 방식 중 하나를 정해 주세요 (지금은 없음).
8. **T2 data**: `weather` 값에 `rainbow` 가 있으니 출현표에선 맑음처럼 다뤄 주세요. `day.key()` 는 `time.now().dayKey` 를 쓰면 5시 경계가 맞는다.
9. **T4 audio**: 시간대는 `dawn/day/dusk/night` 4개, 배경음은 `morning/afternoon` 이 나뉘므로 `day` 안에서는 `now().hour < 12` 로 고르면 된다. `weather:change` 에 `cloudy` 도 온다.

## 알려진 빈틈

- 게임 기본 카메라(32°, 내려다봄)에선 하늘이 거의 안 보여 구름·별·무지개·해·달이 잘 안 보인다. 조명·안개·비·눈·밤 조명은 그대로 보인다. T1 카메라가 화면 위쪽에 하늘 띠를 조금 남기면 훨씬 살아난다.
- 비가 지붕을 뚫고 내린다 (가림 처리 없음). 물방울 튀김은 `focus.y` 높이에만 생겨 언덕 위·아래 높이차가 있으면 떠 보일 수 있다 (`world.island.heightAt` 연결은 다음 단계).
- 웅덩이·천둥·눈 쌓이는 연출 없음 (겨울 팔레트로 땅·나무가 하얘지는 것까지).
- 빛무리 위치는 3초마다 다시 계산 → 움직이는 등불은 따라가는 데 시간이 걸린다.
- 순수 함수(`clock.js`, `weather.js`, `look.js`)는 node 로 확인했지만, `tests/` 는 T2 폴더라 테스트 파일은 넣지 않았다. 합친 뒤 `tests/sky-*.test.js` 를 추가하면 좋겠다.
