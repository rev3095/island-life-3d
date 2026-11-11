// 11차 시계 (p33-clock): 섬폰 시계 바늘 · 시각 offset · 날짜는 앞으로만.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createTimeline, catchUpOffset, msAtClock, clampShift, floorMsOf, laterDay, dayKeyOf, dayStartMs, DAY_MS, SHIFT_MAX_DAYS,
  timeRules, dayLengthText, GAP_MS, SPEED_KEYS,
} from '../src/sky/clock.js';
import { wrapDeg, handAngles, pointAngle, dragMinutes, clampDelta, labelOf, offsetText, activityHints, KEY_STEP } from '../src/ui/clock.js';
import { isStarTime } from '../src/gameplay/decor/telescope.js';
import { createState } from '../src/core/state.js';
import { normalize } from '../src/data/save.js';

const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const HOUR = 3600e3;

/** 가짜 실제 시계로 timeline 만들기 */
function fake({ real = at(2026, 11, 10, 14, 0), time = {}, island = null, baseShift = 0, rules } = {}) {
  const clock = { real };
  const state = { time: { offset: 0, ...time } };
  const tl = createTimeline({ getTime: () => state.time, baseShift, extraDay: () => island, realNow: () => clock.real, ...(rules ? { rules } : {}) });
  return { tl, state, clock };
}

test('시계: offset 은 실제 시계에서 떨어진 정도이고 저장 칸 state.time.offset 에 남는다', () => {
  const { tl, state, clock } = fake();
  assert.equal(tl.clockMs(), at(2026, 11, 10, 14));
  tl.shiftTo(at(2026, 11, 10, 21, 30));
  assert.equal(state.time.offset, 7.5 * HOUR);
  clock.real += 60e3;                                   // 실제 1분 흐르면 게임도 1분
  assert.equal(tl.clockMs(), at(2026, 11, 10, 21, 31));
  // 새로 열어도(같은 state) 유지
  const again = createTimeline({ getTime: () => state.time, realNow: () => clock.real });
  assert.equal(again.clockMs(), at(2026, 11, 10, 21, 31));
});

test('시계: 새 저장·옛 저장엔 offset 0 이 채워진다', () => {
  assert.equal(createState().time.offset ?? 0, 0);
  const s = normalize({ ...createState(), time: { mode: 'real', fastOffset: 0 } });
  const tl = createTimeline({ getTime: () => s.time, realNow: () => 0 });
  assert.equal(tl.state().offset, 0);
  assert.equal(tl.state().maxDay ?? null, null);
});

test('시계: 시계 창 시각 → ms (5시 경계 — 새벽 2시는 그날 밤)', () => {
  assert.equal(msAtClock('2026-11-10', 20, 30), at(2026, 11, 10, 20, 30));
  assert.equal(msAtClock('2026-11-10', 2, 0), at(2026, 11, 11, 2, 0), '0~5시 = 다음 달력 날 새벽 (같은 게임 하루)');
  assert.equal(dayKeyOf(msAtClock('2026-11-10', 2, 0)), '2026-11-10');
  assert.equal(msAtClock('2026-11-10', 5, 0), at(2026, 11, 10, 5));
  assert.equal(msAtClock('2026-11-10', 9, 0, 1), at(2026, 11, 11, 9), '내일 9시');
});

test('시계: 날짜는 앞으로만 — 가 본 날 아침 5시보다 앞으로는 못 돌린다', () => {
  const { tl } = fake({ time: { maxDay: '2026-11-10' } });
  assert.equal(tl.floorMs(), dayStartMs('2026-11-10'));
  assert.deepEqual(tl.clamp(at(2026, 11, 10, 9)), { ms: at(2026, 11, 10, 9), clamped: null }, '오늘 안에서 되감기는 된다');
  assert.equal(tl.clamp(at(2026, 11, 10, 4, 59)).clamped, 'floor', '어제(5시 전)로는 안 된다');
  assert.equal(tl.clamp(at(2026, 11, 10, 4, 59)).ms, at(2026, 11, 10, 5));
  assert.equal(tl.clamp(tl.clockMs() + (SHIFT_MAX_DAYS + 1) * DAY_MS).clamped, 'ceil');
  assert.equal(clampShift(5, { floor: 10 }).ms, 10);
  assert.equal(floorMsOf(null), -Infinity);
});

test('시계: 가 본 날 = state.time.maxDay 와 data 의 island.dayKey 중 늦은 쪽', () => {
  assert.equal(laterDay('2026-11-10', '2026-11-12'), '2026-11-12');
  assert.equal(laterDay(null, '2026-11-12'), '2026-11-12');
  const { tl } = fake({ time: { maxDay: '2026-11-10' }, island: '2026-11-11' });
  assert.equal(tl.maxDay(), '2026-11-11');
  tl.mark('2026-11-09');
  assert.equal(tl.state().maxDay, '2026-11-10', '앞 날은 적지 않는다');
  tl.mark('2026-11-13');
  assert.equal(tl.maxDay(), '2026-11-13');
});

test('시계: 「돌아가기」 — offset 0, 가 본 날보다 앞이면 그 날 같은 시각 (하루 두 번 받기 막기)', () => {
  // 내일 밤까지 돌려 놓았다가 돌아가기
  const { tl, state } = fake({ time: { maxDay: '2026-11-10' } });
  tl.shiftTo(msAtClock('2026-11-10', 22, 0, 1));
  tl.mark(dayKeyOf(tl.clockMs()));                     // sky 의 step 이 적는다
  assert.equal(state.time.maxDay, '2026-11-11');
  const r = tl.resetTarget();
  assert.equal(r.caught, 1, '하루를 더해 내일 같은 시각으로');
  assert.equal(r.target, at(2026, 11, 11, 14));
  assert.equal(r.offset, DAY_MS);
  // 오늘 안에서만 돌렸으면 그대로 0
  const b = fake({ time: { maxDay: '2026-11-10', offset: 5 * HOUR } });
  const r2 = b.tl.resetTarget();
  assert.equal(r2.caught, 0);
  assert.equal(r2.offset, 0);
  assert.equal(b.state.time.offset, 5 * HOUR, 'resetTarget 은 계산만 (sky 가 jump 로 옮긴다)');
});

test('시계: PC 시계를 되돌리거나 빠른 시간 → 실제 시간이면 가 본 날로 맞춘다', () => {
  const r = catchUpOffset(at(2026, 11, 8, 10), 0, '2026-11-10');
  assert.equal(r.days, 2);
  assert.equal(dayKeyOf(at(2026, 11, 8, 10) + r.offset), '2026-11-10');
  assert.deepEqual(catchUpOffset(at(2026, 11, 10, 10), 0, '2026-11-10'), { offset: 0, days: 0 });
  // p41: 빠르게로 사흘 앞서 간 섬을 실제와 같게로 — 시각이 끊기지 않고 이어진다 (offset = 앞선 만큼), 날짜가 뒤로 가지 않는다
  const { tl, state } = fake({ time: { maxDay: '2026-11-13', speed: 'fast', game: at(2026, 11, 13, 9) }, rules: timeRules({}) });
  assert.equal(tl.speed, 'fast');
  tl.setSpeed('real');
  assert.equal(state.time.speed, 'real');
  assert.equal(tl.clockMs(), at(2026, 11, 13, 9));
  assert.equal(dayKeyOf(tl.clockMs()), '2026-11-13');
  // 예전 저장 mode 'fast' (실제 1분 = 1시간) 는 그 시각에서 「아주 빠르게」로 이어진다
  const old = fake({ time: { mode: 'fast', fastOffset: -at(2026, 11, 10, 14) * 59 } });
  assert.equal(old.tl.speed, 'faster');
  assert.equal(old.state.time.mode, undefined);
  assert.equal(old.tl.clockMs(), at(2026, 11, 10, 14));
});

test('시계: 바늘 각도 — 시침 한 바퀴 12시간, 분침 한 바퀴 1시간, 12를 넘으면 오전·오후가 바뀐다', () => {
  assert.deepEqual(handAngles(3, 0), { hour: 90, minute: 0 });
  assert.deepEqual(handAngles(15, 30), { hour: 105, minute: 180 });
  assert.equal(wrapDeg(350), -10);
  assert.equal(wrapDeg(-190), 170);
  assert.equal(Math.round(pointAngle(10, 0, 0, 0)), 90, '오른쪽 = 3시');
  assert.equal(Math.round(pointAngle(0, 10, 0, 0)), 180, '아래 = 6시');
  assert.equal(dragMinutes('hour', 330, 30), 120, '시침이 11시 → 1시 (12를 지남) = +2시간');
  assert.ok(Math.abs(dragMinutes('minute', 350, 10) - 20 / 6) < 1e-9, '분침 20° = 3.33분');
  assert.equal(dragMinutes('minute', 90, 0), -15);
  // 오전 11시 → 시침을 2시간 = 오후 1시
  const base = at(2026, 11, 10, 11);
  assert.equal(labelOf(base, '2026-11-10').ampm, '오전');
  const L = labelOf(base + dragMinutes('hour', 330, 30) * 60e3, '2026-11-10');
  assert.equal(L.text, '오후 1:00');
  assert.equal(L.part, 'day');
});

test('시계: 바늘을 계속 돌리면 5시 경계로 날이 바뀐다 (오늘·내일 표시)', () => {
  const base = at(2026, 11, 10, 23);
  assert.equal(labelOf(base, '2026-11-10').dayLabel, '오늘');
  assert.equal(labelOf(base + 3 * HOUR, '2026-11-10').dayLabel, '오늘', '새벽 2시는 아직 오늘 밤');
  assert.equal(labelOf(base + 3 * HOUR, '2026-11-10').part, 'night');
  assert.equal(labelOf(base + 6 * HOUR, '2026-11-10').dayLabel, '내일', '새벽 5시부터 내일');
  assert.equal(labelOf(base + 6 * HOUR, '2026-11-10').part, 'dawn');
});

test('시계: 키보드 ←→ 15분 · 범위를 넘으면 끝에 붙는다', () => {
  assert.equal(KEY_STEP.ArrowRight, 15);
  assert.equal(KEY_STEP.ArrowLeft, -15);
  assert.equal(KEY_STEP.ArrowUp, 60);
  const base = at(2026, 11, 10, 6);
  const floor = dayStartMs('2026-11-10');
  assert.equal(clampDelta(-120, base, { floor }), -60, '5시보다 앞은 안 됨');
  assert.equal(clampDelta(30, base, { floor, ceil: base + 20 * 60e3 }), 20);
});

test('시계: offset 글 · 시간대별 할 것 안내', () => {
  assert.equal(offsetText(0), '실제 시각 그대로예요');
  assert.equal(offsetText(3 * HOUR + 20 * 60e3), '실제 시각보다 3시간 20분 빨라요');
  assert.equal(offsetText(-DAY_MS - HOUR), '실제 시각보다 1일 1시간 느려요');
  assert.ok(activityHints(21, { shopOpen: false }).includes('🔭 별 보기'));
  assert.ok(activityHints(21, { shopOpen: false }).includes('🛒 상점 닫힘'));
  assert.ok(activityHints(11, { shopOpen: true }).includes('🦋 낮 곤충'));
  assert.ok(activityHints(2, {}).includes('🦗 밤 곤충'), '새벽 2시도 밤');
});

test('시계: 망원경 별 보기 시간(19–05시)이 시계 안내와 같다', () => {
  for (const hh of [19, 23, 0, 4.9]) { assert.ok(isStarTime(hh), hh); assert.ok(activityHints(Math.floor(hh)).includes('🔭 별 보기'), hh); }
  for (const hh of [5, 12, 18.9]) { assert.ok(!isStarTime(hh), hh); assert.ok(!activityHints(Math.floor(hh)).includes('🔭 별 보기'), hh); }
});

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('시계: 섬폰 줄·창·시각 서비스 API·바뀜 이벤트가 이어져 있다', async () => {
  const { APPS, visibleApps } = await import('../src/ui/phone.js');
  assert.ok(APPS.some(a => a.id === 'clock' && a.panel === 'clock'));
  assert.ok(!visibleApps({}).some(a => a.id === 'clock'), '창이 없으면 줄을 숨긴다');
  const sky = read('src/sky/index.js');
  for (const api of ['setOffset(ms)', 'jumpTo:', 'shiftTo(hour, minute', 'resetOffset()', 'get offset()', 'range:']) assert.ok(sky.includes(api), api);
  assert.match(sky, /events\.emit\('time:shift', info\)/);
  // 시각을 옮기면 다시 놓는 곳: 주민 · 곤충 · 물고기
  assert.match(read('src/gameplay/town/index.js'), /ctx\.events\.on\('time:shift'/);
  assert.match(read('src/gameplay/gather/index.js'), /events\.on\('time:shift', \(\) => \{ bugs\.reshuffle\?\.\(\); fishing\.reshuffle\?\.\(\); \}\)/);
  // 하루 리셋은 앞으로만 (날짜 흉내만 allowBack)
  assert.match(read('src/data/index.js'), /allowBack: !!ctx\.preview/);
});

test('상점: 가방이 꽉 차도 같은 물건 칸에 겹쳐 담을 수 있으면 산다 (clock-phone 🟡 — 받은 튤립 씨앗)', async () => {
  const { createInventory, SLOTS } = await import('../src/data/inventory.js');
  const state = createState();
  const inv = createInventory(state);
  inv.add('seed.tulip', 1);
  for (let i = 1; i < SLOTS; i++) state.inventory[i] = { id: 'fish.carp', count: 1 };
  assert.equal(inv.isFull(), true);
  assert.ok(inv.canFit('seed.tulip', 1) > 0, '튤립 씨앗은 겹쳐 담긴다');
  assert.equal(inv.canFit('seed.pansy', 1), 0, '없는 씨앗은 못 담는다');
  const shop = readFileSync(new URL('../src/ui/shop.js', import.meta.url), 'utf8');
  assert.match(shop, /canFit\(id, 1\) > 0/, '상점 사기는 빈칸이 아니라 canFit 으로 본다');
});

// ── p41 시간 빠르기 ──
const R12 = timeRules({ speed: 'fast', speeds: { fast: 12, faster: 30 }, whenClosed: 'pause' });
/** 프레임을 n 번, 한 번에 ms 씩 돌리기 */
const frames = (f, n, ms = 100) => { for (let i = 0; i < n; i++) { f.clock.real += ms; f.tl.advance(); } };

test('시간 빠르기: rules.json time 값 · 빠진 칸은 기본값 · 실제와 같게는 언제나 1배', () => {
  const rules = JSON.parse(readFileSync(new URL('../assets/data/rules.json', import.meta.url), 'utf8'));
  const R = timeRules(rules.time);
  assert.ok(SPEED_KEYS.includes(R.speed));
  assert.equal(R.speeds.real, 1);
  assert.ok(R.speeds.fast > 1 && R.speeds.faster >= R.speeds.fast);
  assert.deepEqual(timeRules({ speeds: { real: 5, fast: -1 } }).speeds, { real: 1, fast: 12, faster: 30, fastest: 60 });   // P47 번개처럼 ×60
  assert.equal(timeRules({ whenClosed: 'x' }).whenClosed, 'pause');
  assert.equal(dayLengthText(12), '게임 하루 = 실제 2시간');
  assert.equal(dayLengthText(30), '게임 하루 = 실제 48분');
  assert.equal(dayLengthText(1), '실제 시계와 같아요');
});

test('시간 빠르기: 빠르게(×12) — 실제 1분에 게임 12분, 새 게임은 실제 시각에서 시작', () => {
  const f = fake({ rules: R12 });
  f.tl.start();
  assert.equal(f.tl.clockMs(), at(2026, 11, 10, 14));
  frames(f, 600);                                      // 실제 60초
  assert.equal(f.tl.clockMs(), at(2026, 11, 10, 14, 12));
  assert.equal(f.state.time.game, at(2026, 11, 10, 14, 12), '게임 시각은 state.time.game 에 저장');
});

test('시간 빠르기: 닫아 둔 동안 — pause 는 멈춰 있다가 이어서, catchUp 은 흐른 만큼 (실제와 같게는 언제나 실제 시계)', () => {
  const saved = { speed: 'fast', game: at(2026, 11, 10, 20), realAt: at(2026, 11, 10, 14) };
  const a = fake({ real: at(2026, 11, 10, 15), time: { ...saved }, rules: R12 });   // 실제 1시간 뒤에 다시 염
  a.tl.start();
  assert.equal(a.tl.clockMs(), at(2026, 11, 10, 20), 'pause: 저장한 시각 그대로');
  const b = fake({ real: at(2026, 11, 10, 15), time: { ...saved }, rules: timeRules({ ...R12, whenClosed: 'catchUp' }) });
  b.tl.start();
  assert.equal(b.tl.clockMs(), at(2026, 11, 11, 8), 'catchUp: 실제 1시간 × 12 = 게임 12시간');
  // 탭을 숨겼다가(프레임 사이 GAP_MS 넘게) 돌아와도 pause 면 그동안 안 흐른다
  const c = fake({ rules: R12 }); c.tl.start();
  c.clock.real += GAP_MS * 10; c.tl.advance();
  assert.equal(c.tl.clockMs(), at(2026, 11, 10, 14));
  const r = fake({ time: { speed: 'real', offset: HOUR } , rules: R12 }); r.tl.start();
  r.clock.real += 3 * HOUR;
  assert.equal(r.tl.clockMs(), at(2026, 11, 10, 18), '실제와 같게: 닫아 둔 동안에도 실제 시계대로');
});

test('시간 빠르기: 빠르기를 바꿔도 그 순간 시각은 끊기지 않는다 (실제와 같게 ↔ 빠르게 ↔ 아주 빠르게)', () => {
  const f = fake({ rules: R12 }); f.tl.start();
  frames(f, 300);                                      // 30초 × 12 = 6분
  const t1 = f.tl.clockMs();
  assert.equal(f.tl.setSpeed('faster'), true);
  assert.equal(f.tl.clockMs(), t1);
  frames(f, 20);                                       // 2초 × 30 = 1분
  assert.equal(f.tl.clockMs(), t1 + 60e3);
  f.tl.setSpeed('real');
  assert.equal(f.tl.clockMs(), t1 + 60e3);
  f.clock.real += 60e3;
  assert.equal(f.tl.clockMs(), t1 + 120e3, '실제와 같게: 1분에 1분');
  assert.equal(f.tl.setSpeed('nope'), false);
});

test('시간 빠르기: 빠르게 흐르다 새벽 5시를 넘으면 날짜가 넘어가고, 가 본 날 아래로는 못 돌린다', () => {
  const f = fake({ rules: R12, time: { speed: 'fast', game: at(2026, 11, 10, 4, 30), maxDay: '2026-11-09' } });
  f.tl.start();
  assert.equal(dayKeyOf(f.tl.clockMs()), '2026-11-09', '새벽 4시 반은 아직 어제');
  frames(f, 160, 1000);                                // 실제 160초 × 12 = 32분 → 5:02
  const key = dayKeyOf(f.tl.clockMs());
  assert.equal(key, '2026-11-10');
  f.tl.mark(key);
  assert.equal(f.tl.clamp(at(2026, 11, 10, 4)).clamped, 'floor', '어제로 되돌리기는 막힘');
  // 돌아가기 = 실제 시각 (가 본 날보다 앞이면 그 날 같은 시각)
  const g = fake({ rules: R12, real: at(2026, 11, 10, 14), time: { speed: 'fast', game: at(2026, 11, 12, 9), maxDay: '2026-11-12' } });
  g.tl.start();
  const r = g.tl.resetTarget();
  assert.equal(r.caught, 2);
  assert.equal(r.target, at(2026, 11, 12, 14));
});

test('시간 빠르기: 멈춤(봇·점검)이면 흐르지 않고, 풀면 그 시각에서 이어서', () => {
  const f = fake({ rules: R12 }); f.tl.start();
  f.tl.setPaused(true);
  frames(f, 100);
  assert.equal(f.tl.clockMs(), at(2026, 11, 10, 14));
  f.tl.shiftTo(at(2026, 11, 10, 9));                  // setHour
  f.tl.setPaused(false);
  frames(f, 50);                                       // 5초 × 12 = 1분
  assert.equal(f.tl.clockMs(), at(2026, 11, 10, 9, 1));
});

test('p41 화면: HUD 원형 시계 + 조정 칸 · 섬폰 「시간 빠르기」 · 요소 편집기 칸이 이어져 있다', async () => {
  const hud = read('src/ui/hudclock.js');
  assert.match(hud, /createDial\(\{\s*\n?\s*cls: 'pk-hclock-dial', compact: true/, 'HUD 는 섬폰 시계 창과 같은 판 부품');
  for (const k of ['step(-1)', 'step(1)', 'cycleSpeed()', "ui?.clock?.open"]) assert.ok(hud.includes(k), k);
  assert.match(hud, /--pk-clock-extra/, '펼친 조정 칸만큼 밑의 칸이 내려간다');
  assert.match(hud, /release\(\)/, '끌기·적용 뒤 포커스를 놓아 Space 가 게임으로');
  const ui = read('src/ui/index.js');
  assert.match(ui, /hudClock\.mount\(hud\.root\.querySelector\('\.pk-clock'\)\)/);
  for (const name of ['time:shift', 'time:speed', 'time:newday']) assert.ok(ui.includes(`'${name}'`), name);
  assert.match(read('src/ui/phone.js'), /time\.setSpeed\(sp\.key\)/);
  assert.match(read('src/sky/index.js'), /tl\.advance\(\)/);
  const sheets = read('elem-editor/sheets.js');
  for (const p of ['rules/time/speed', 'rules/time/speeds/fast', 'rules/time/speeds/faster', 'rules/time/whenClosed']) assert.ok(sheets.includes(`'${p}'`), p);
  for (const f of ['src/gameplay/intro/intro.css', 'src/gameplay/festival/festival.css']) assert.match(read(f), /var\(--pk-clock-extra, 0px\)/, f);
});

test('P47 오늘·내일: todayRange = 그날 새벽 5시 ~ 다음 새벽 5시 직전, 가 본 날 하한과 겹치면 더 늦은 쪽 · 낮밤 단추는 오늘 안', async () => {
  const { todayRange, DAY_JUMPS, TOMORROW_HOUR, msAtDayHour } = await import('../src/sky/clock.js');
  const R = todayRange('2027-05-15');
  assert.equal(R.floor, msAtDayHour('2027-05-15', 5));
  assert.equal(R.ceil, msAtDayHour('2027-05-15', 29) - 60000);
  assert.equal(todayRange('2027-05-15', { floor: msAtDayHour('2027-05-15', 9) }).floor, msAtDayHour('2027-05-15', 9));
  for (const j of DAY_JUMPS) { const m = msAtDayHour('2027-05-15', j.hour); assert.ok(m >= R.floor && m <= R.ceil, j.key); }
  assert.ok(TOMORROW_HOUR >= 5 && TOMORROW_HOUR < 12);
});
