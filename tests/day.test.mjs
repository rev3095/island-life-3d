import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import {
  dayKeyOf, dayKeyFromNow, daysBetween, runDailyReset, createDay,
  FOSSILS_PER_DAY, FRUIT_REGROW_DAYS, SHELLS_PER_DAY, WEEDS_START, WEEDS_MAX,
} from '../src/data/day.js';
import { createHarvest } from '../src/data/harvest.js';
import { ROCK_MAX_HITS, CHOP_MAX_HITS } from '../src/data/spawns.js';

test('하루는 새벽 5시에 바뀐다', () => {
  assert.equal(dayKeyOf(new Date(2026, 9, 28, 4, 59)), '2026-10-27');
  assert.equal(dayKeyOf(new Date(2026, 9, 28, 5, 0)), '2026-10-28');
  assert.equal(dayKeyOf(new Date(2026, 9, 28, 23, 59)), '2026-10-28');
  assert.equal(dayKeyOf(new Date(2026, 0, 1, 3, 0)), '2025-12-31', '해 넘김');
  assert.equal(dayKeyOf(new Date(2026, 2, 1, 2, 0)), '2026-02-28', '달 넘김');
});

test('time 서비스 now() → dayKey', () => {
  assert.equal(dayKeyFromNow({ dayKey: '2026-11-02' }), '2026-11-02');
  assert.equal(dayKeyFromNow({ year: 2026, month: 10, day: 28, hour: 3 }), '2026-10-27');
  assert.equal(dayKeyFromNow({ year: 2026, month: 10, day: 28, hour: 9 }), '2026-10-28');
  assert.equal(dayKeyFromNow(null), null);
  assert.equal(dayKeyFromNow({}), null);
});

test('daysBetween', () => {
  assert.equal(daysBetween('2026-10-28', '2026-10-31'), 3);
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(daysBetween('2026-10-28', '2026-10-27'), -1);
});

test('첫날 리셋: 화석 4곳, 조개·잡초 수', () => {
  const island = createState().island;
  const r = runDailyReset(island, '2026-10-28');
  assert.equal(r.days, 0);
  assert.equal(island.dayKey, '2026-10-28');
  assert.equal(island.daily.fossils, FOSSILS_PER_DAY);
  assert.ok(island.daily.shells >= SHELLS_PER_DAY[0] && island.daily.shells <= SHELLS_PER_DAY[1]);
  assert.equal(island.daily.weeds, WEEDS_START);
  assert.equal(runDailyReset(island, '2026-10-28'), null, '같은 날 두 번은 안 한다');
  assert.equal(runDailyReset(island, 'bad'), null);
});

test('하루 리셋은 같은 상태 + 같은 날이면 늘 같다', () => {
  const run = () => {
    const island = createState().island;
    island.fruit = { a: '2026-10-25', b: '2026-10-27' };
    const out = [];
    for (const d of ['2026-10-28', '2026-10-29', '2026-11-05']) out.push(runDailyReset(island, d), structuredClone(island));
    return out;
  };
  assert.deepEqual(run(), run());
  // 섬 시드가 다르면 날마다 조개 수가 다르게 나온다
  const shellsFor = seed => {
    const island = createState().island;
    island.seed = seed;
    return Array.from({ length: 10 }, (_, i) => runDailyReset(island, `2026-11-${String(i + 1).padStart(2, '0')}`).shells);
  };
  assert.deepEqual(shellsFor(5), shellsFor(5));
  assert.notDeepEqual(shellsFor(5), shellsFor(6));
});

test('과일은 딴 지 3일 뒤에 다시 열린다', () => {
  const island = createState().island;
  runDailyReset(island, '2026-10-28');
  island.fruit = { t1: '2026-10-28' };
  runDailyReset(island, '2026-10-29');
  runDailyReset(island, '2026-10-30');
  assert.ok('t1' in island.fruit, '2일 뒤엔 아직');
  const r = runDailyReset(island, '2026-10-31');
  assert.equal(FRUIT_REGROW_DAYS, 3);
  assert.deepEqual(r.regrown, ['t1']);
  assert.ok(!('t1' in island.fruit));
});

test('며칠 건너뛰어도 한 번에 리셋, 잡초는 쌓이되 최대치까지', () => {
  const island = createState().island;
  runDailyReset(island, '2026-10-28');
  const r = runDailyReset(island, '2026-12-28');
  assert.equal(r.days, 61);
  assert.equal(island.daily.weeds, WEEDS_MAX);
  island.daily.weeds = 0;
  const next = runDailyReset(island, '2026-12-29');
  assert.ok(next.weeds >= 2 && next.weeds <= 4);
});

test('시계를 되돌려도 하루로 친다', () => {
  const island = createState().island;
  runDailyReset(island, '2026-10-28');
  island.fruit = { t: '2026-10-28' };
  const r = runDailyReset(island, '2026-10-20');
  assert.equal(r.days, 1);
  assert.deepEqual(r.regrown, ['t']);
});

test('createDay: time 서비스가 있으면 그 날을, 없으면 로컬 날짜', () => {
  const state = createState();
  let now = { dayKey: '2026-10-28' };
  const news = [];
  const day = createDay({ state, getNow: () => now, onNewDay: r => news.push(r.dayKey) });
  assert.equal(day.key(), '2026-10-28');
  assert.equal(day.check(), true);
  assert.equal(day.check(), false);
  now = { dayKey: '2026-10-29' };
  assert.equal(day.check(), true);
  assert.deepEqual(news, ['2026-10-28', '2026-10-29']);
  const broken = createDay({ state: createState(), getNow: () => { throw new Error('없음'); } });
  assert.match(broken.key(), /^\d{4}-\d{2}-\d{2}$/);
});

test('pickSpots: 오늘 화석 자리 4곳, 같은 날이면 같다', () => {
  const state = createState();
  const tiles = Array.from({ length: 30 }, (_, i) => ({ tx: i, tz: i * 2 }));
  const day = createDay({ state, getNow: () => ({ dayKey: '2026-10-28' }) });
  const a = day.pickSpots(tiles, 4, 'fossil');
  assert.equal(a.length, 4);
  assert.deepEqual(a, day.pickSpots(tiles, 4, 'fossil'));
  const day2 = createDay({ state, getNow: () => ({ dayKey: '2026-10-29' }) });
  assert.notDeepEqual(a, day2.pickSpots(tiles, 4, 'fossil'));
});

test('harvest: 화석은 하루 4곳, 바위는 6번, 나무 베기는 3번, 다음 날 다시', () => {
  const state = createState();
  let now = { dayKey: '2026-10-28' };
  const day = createDay({ state, getNow: () => now });
  const h = createHarvest({ state, day });
  day.check();
  const found = ['a', 'b', 'c', 'd', 'e'].map(k => h.digFossil(k));
  assert.ok(found.slice(0, 4).every(id => id?.startsWith('fossil.')));
  assert.equal(found[4], null);
  assert.equal(h.digFossil('a'), null);
  assert.equal(h.fossilsLeft(), 0);

  const rocks = Array.from({ length: ROCK_MAX_HITS + 1 }, () => h.hitRock('rock-1'));
  assert.ok(rocks.slice(0, ROCK_MAX_HITS).every(Boolean));
  assert.equal(rocks[ROCK_MAX_HITS], null);
  assert.equal(h.rockHitsLeft('rock-1'), 0);
  const chops = Array.from({ length: CHOP_MAX_HITS + 1 }, () => h.chopTree('tree-1'));
  assert.equal(chops.filter(Boolean).length, CHOP_MAX_HITS);

  now = { dayKey: '2026-10-29' };
  assert.equal(h.fossilsLeft(), 4, '새 날이면 다시 4곳');
  assert.ok(h.hitRock('rock-1'));
});

test('harvest: 기본 시드라 같은 날 같은 바위는 같은 결과', () => {
  const roll = () => {
    const state = createState();
    const day = createDay({ state, getNow: () => ({ dayKey: '2026-10-28' }) });
    const h = createHarvest({ state, day });
    return [h.hitRock('r'), h.hitRock('r'), h.digFossil('s1'), h.pickShell('beach-3'), h.shakeTree('t', 'tree')];
  };
  assert.deepEqual(roll(), roll());
});

test('harvest: 과일나무 흔들기 → 열매, 3일 동안 없음', () => {
  const state = createState();
  let now = { dayKey: '2026-10-28' };
  const day = createDay({ state, getNow: () => now });
  const h = createHarvest({ state, day });
  assert.ok(h.fruitReady('ft'));
  const r = h.shakeTree('ft', 'fruit-tree', { fruit: 'fruit.cherry' });
  assert.equal(r.id, 'fruit.cherry');
  assert.equal(h.fruitReady('ft'), false);
  const again = h.shakeTree('ft', 'fruit-tree', { fruit: 'fruit.cherry' });
  assert.ok(!again || !again.id.startsWith('fruit.'), '열매는 한 번만');
  now = { dayKey: '2026-10-30' };
  assert.equal(h.fruitReady('ft'), false);
  now = { dayKey: '2026-10-31' };
  assert.equal(h.fruitReady('ft'), true);
});

test('harvest: 조개·잡초는 오늘 수만큼', () => {
  const state = createState();
  const day = createDay({ state, getNow: () => ({ dayKey: '2026-10-28' }) });
  const h = createHarvest({ state, day });
  const { shells, weeds } = h.today();
  const picked = Array.from({ length: shells + 1 }, (_, i) => h.pickShell(`s${i}`));
  assert.equal(picked.filter(Boolean).length, shells);
  assert.equal(picked[0], h.shellAt('s0'), 'shellAt 으로 미리 볼 수 있다');
  for (let i = 0; i < weeds; i++) assert.deepEqual(h.pullWeed(), { id: 'mat.weed', count: 1 });
  assert.equal(h.pullWeed(), null);
  assert.deepEqual(h.today(), { dayKey: '2026-10-28', fossils: 4, shells: 0, weeds: 0 });
});
