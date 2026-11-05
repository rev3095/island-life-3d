// 8차 계절 행사 틀 (M8-P1, 보드 wave8): 설정 모양 · 날짜 계산 · 날짜 흉내 · 섬폰 달력 줄
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { windowOf, windowOn, activeOn, upcoming, inHours, hoursOn, isOpen, yearCalendar, daysBetween } from '../src/gameplay/events/calendar.js';
import { urlDate, validDate, shiftedMs, previewOf, PREVIEW_SAVE_KEY } from '../src/core/preview.js';
import { SAVE_KEY } from '../src/data/save.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(readFileSync(resolve(root, 'assets/events/events.json'), 'utf8'));

test('설정: 결정 D74–D85 가 다 있고 행사 넷의 칸이 맞다', () => {
  for (let n = 74; n <= 85; n++) assert.ok(['A', 'B', 'C'].includes(CFG.decisions[`D${n}`]), `D${n}`);
  assert.deepEqual(CFG.list.map(e => e.id), ['EV-01', 'EV-02', 'EV-03', 'EV-04']);
  const villagers = new Set(JSON.parse(readFileSync(resolve(root, 'assets/models/index.json'), 'utf8')).models.map(m => m.slug));
  for (const ev of CFG.list) {
    assert.ok(ev.name && ev.emoji && ev.season, ev.id);
    assert.ok(ev.start.month >= 1 && ev.start.month <= 12 && ev.start.day >= 1 && ev.start.day <= 31, `${ev.id} start`);
    assert.ok(Array.isArray(ev.hours) && ev.hours[0] >= 5 && ev.hours[1] <= 29 && ev.hours[1] > ev.hours[0], `${ev.id} hours 는 게임 하루 시각 5~29`);
    assert.ok(villagers.has(ev.host), `${ev.id} 주인공 ${ev.host} 는 있는 주민`);
    assert.ok(ev.todo.length && ev.todo.every(t => t.id && t.label && t.goal >= 1), `${ev.id} todo`);
    assert.equal(new Set(ev.todo.map(t => t.id)).size, ev.todo.length, `${ev.id} todo id 겹침`);
    // 행사 계절과 시작 달의 계절이 같다 (core/constants seasonOf)
    const m = ev.start.month, s = m >= 3 && m <= 5 ? 'spring' : m <= 8 && m >= 6 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
    assert.equal(ev.season, s, `${ev.id} 계절`);
  }
});

test('날짜: 정한 날부터 7일 (D75-A), 해를 넘기는 기간도', () => {
  const spring = CFG.list[0], winter = CFG.list[3];
  assert.deepEqual(windowOf(spring, 2027), { year: 2027, from: '2027-04-01', to: '2027-04-07' });
  assert.equal(windowOn(spring, '2027-03-31'), null);
  assert.deepEqual(windowOn(spring, '2027-04-01'), { year: 2027, from: '2027-04-01', to: '2027-04-07', day: 1, left: 7 });
  assert.equal(windowOn(spring, '2027-04-07').left, 1);
  assert.equal(windowOn(spring, '2027-04-08'), null);
  // 12/28 부터 7일이면 다음 해 1/3 까지 — 1/2 는 그 전해 기간
  const late = { ...winter, start: { month: 12, day: 28 } };
  const w = windowOn(late, '2028-01-02');
  assert.equal(w.year, 2027); assert.equal(w.day, 6); assert.equal(w.left, 2);
  // 2/29 시작은 평년이면 2/28
  assert.equal(windowOf({ start: { month: 2, day: 29 } }, 2027).from, '2027-02-28');
  assert.equal(windowOf({ start: { month: 2, day: 29 } }, 2028).from, '2028-02-29');
  assert.equal(daysBetween('2027-03-30', '2027-04-02'), 3);
});

test('달력: 오늘 열린 것 · 다음 차례 · 한 해 넷', () => {
  assert.deepEqual(activeOn(CFG, '2027-08-03').map(r => r.ev.id), ['EV-02']);
  assert.deepEqual(activeOn(CFG, '2027-06-01'), []);
  const up = upcoming(CFG, '2027-08-03');
  assert.deepEqual(up.map(r => r.ev.id), ['EV-03', 'EV-04', 'EV-01'], '지금 열린 불꽃놀이는 빼고 가까운 차례');
  assert.equal(up[0].until, daysBetween('2027-08-03', '2027-10-15'));
  assert.equal(up[2].year, 2028);
  assert.equal(yearCalendar(CFG, 2027).length, 4);
  // 기간끼리 안 겹친다
  const cal = yearCalendar(CFG, 2027).sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 1; i < cal.length; i++) assert.ok(cal[i].from > cal[i - 1].to, `${cal[i - 1].ev.id} · ${cal[i].ev.id} 겹침`);
});

test('시간: 행사 시간 · 섬 축제 날 저녁은 섬 축제 먼저 (D75-A)', () => {
  const [spring, summer, autumn] = CFG.list;
  assert.ok(inHours(spring, 10)); assert.ok(!inHours(spring, 8)); assert.ok(!inHours(spring, 18));
  assert.ok(inHours(summer, 20.5)); assert.ok(!inHours(summer, 19));
  assert.ok(inHours(autumn, 2), '수확 잔치는 하루 종일 (새벽 2시 = 게임 하루 26시)');
  assert.equal(hoursOn(summer, { festivalToday: true }), null, '밤 불꽃놀이는 섬 축제 날 쉼');
  assert.deepEqual(hoursOn(autumn, { festivalToday: true }), [5, 17]);
  assert.ok(!inHours(autumn, 19, { festivalToday: true }));
});

test('열리는 때: 첫 섬 축제(엔딩) 뒤부터 (D83-A)', () => {
  assert.equal(isOpen(CFG, {}), false);
  assert.equal(isOpen(CFG, { started: '2027-03-01' }), false);
  assert.equal(isOpen(CFG, { endedDay: '2027-03-05' }), true);
  assert.equal(isOpen({ ...CFG, open: { after: 'always' } }, {}), true);
});

test('날짜 흉내 #date= (D85-A): 주소 읽기 · 저장 칸 따로 · 시각은 그대로', () => {
  assert.equal(urlDate({ hash: '#date=2027-04-02' }), '2027-04-02');
  assert.equal(urlDate({ hash: '#low&date=2027-12-21' }), '2027-12-21');
  assert.equal(urlDate({ search: '?date=2027-08-01' }), '2027-08-01');
  assert.equal(urlDate({ hash: '#low' }), null);
  assert.equal(urlDate({ hash: '#date=2027-02-30' }), null, '없는 날');
  assert.equal(validDate('27-4-2'), null);
  assert.equal(previewOf({ hash: '' }), null);
  assert.deepEqual(previewOf({ hash: '#date=2027-04-02' }), { date: '2027-04-02', saveKey: PREVIEW_SAVE_KEY });
  assert.equal(PREVIEW_SAVE_KEY, `${SAVE_KEY}-preview`);
  const base = new Date(2026, 10, 5, 14, 30, 15).getTime();
  const d = new Date(shiftedMs('2027-04-02', base));
  assert.deepEqual([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()], [2027, 4, 2, 14, 30]);
});

test('섬폰: 달력 줄은 ui.calendar 가 있을 때만', async () => {
  const { APPS, visibleApps } = await import('../src/ui/phone.js');
  assert.ok(APPS.some(a => a.id === 'calendar' && a.panel === 'calendar'));
  assert.ok(!visibleApps({}).some(a => a.id === 'calendar'));
  assert.ok(visibleApps({ calendar: { open() {} } }).some(a => a.id === 'calendar'));
});

test('웹 빌드: 행사 설정이 열자마자 받는 묶음에', async () => {
  const { PACKS } = await import('../tools/build-web.mjs');
  const pack = PACKS.find(g => g.test('assets/events/events.json'));
  assert.equal(pack?.name, 'island');
  assert.ok(pack.boot);
  assert.ok(existsSync(resolve(root, 'src/gameplay/events/index.js')));
});

// ---- M8-P3 봄 꽃놀이: 자리 고르기 (섬 생성기 + 축제 광장 그대로) ----
import { generateIsland, createIslandApi, lotsOf, BUILDING_KINDS } from '../src/world/island.js';
import { carveFestival } from '../src/world/festival.js';
import { springSpots, petalSpots } from '../src/gameplay/events/spring.js';

test('봄 꽃놀이: 벚나무 8그루는 광장 밖 풀밭 빈 칸에 서로 떨어져, 돗자리·간판은 광장 안 땅에', () => {
  const spec = slug => JSON.parse(readFileSync(resolve(root, `assets/env/specs/${slug}.json`), 'utf8'));
  const festCfg = JSON.parse(readFileSync(resolve(root, 'assets/festival/config.json'), 'utf8'));
  const gen = generateIsland(20261028, { lots: lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, spec(k)]))) });
  const F = carveFestival(gen, { config: festCfg, specs: { 'festival-stage': spec('festival-stage') } });
  const isl = createIslandApi(gen);
  const taken = new Set(gen.objects.map(o => `${o.tx},${o.tz}`));
  const isFree = (tx, tz) => isl.isWalkableTile(tx, tz) && isl.tileAt(tx, tz) === 'grass' && !taken.has(`${tx},${tz}`);
  const s = springSpots(F, { isFree, toTile: isl.toTile, toWorld: isl.toWorld });
  assert.equal(s.trees.length, 8);
  const C = F.center;
  for (const [i, t] of s.trees.entries()) {
    assert.ok(isFree(t.tx, t.tz), `나무 ${i} 칸이 비지 않음`);
    const w = isl.toWorld(t.tx, t.tz);
    assert.ok(Math.hypot(w.x - C.x, w.z - C.z) > F.radius + 1, `나무 ${i} 가 광장 안`);
    for (const u of s.trees.slice(i + 1)) { const q = isl.toWorld(u.tx, u.tz); assert.ok(Math.hypot(q.x - w.x, q.z - w.z) >= 3.2, '나무끼리 너무 가까움'); }
  }
  for (const k of ['picnic', 'sign']) {
    assert.ok(s[k], k);
    assert.ok(!isl.isWater(s[k].x, s[k].z), `${k} 가 물 위`);
    assert.ok(Math.hypot(s[k].x - C.x, s[k].z - C.z) < F.radius + 2, `${k} 가 광장에서 멂`);
  }
  // 돗자리는 모닥불(가운데)·무대에서 떨어져 있다
  assert.ok(Math.hypot(s.picnic.x - C.x, s.picnic.z - C.z) > 1.5);
  // 꽃잎: 나무마다 둘, 같은 날엔 같은 자리, 다른 날엔 바뀜
  const a = petalSpots(s.trees, '2027-04-02', isl.toWorld), b = petalSpots(s.trees, '2027-04-02', isl.toWorld), c = petalSpots(s.trees, '2027-04-03', isl.toWorld);
  assert.equal(a.length, 16);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map(p => [p.x, p.z]), c.map(p => [p.x, p.z]));
});

// ---- M8-P4 여름 불꽃놀이: 쇼 계획 · 해변 자리 ----
import { showPlan, FIREWORK_QUALITY } from '../src/render/fireworks.js';
import { summerSpots, WISHES } from '../src/gameplay/events/summer.js';

test('불꽃 쇼 계획: 사양마다 발 수, 10분 안에 고르게, 같은 날은 같은 쇼', () => {
  for (const [q, Q] of Object.entries(FIREWORK_QUALITY)) {
    const p = showPlan(q, 600, 20270801);
    assert.equal(p.length, Q.shots, q);
    assert.ok(p.every(s => s.t >= 0 && s.t <= 600), `${q}: 10분 안`);
    assert.ok(p.every((s, i) => !i || s.t >= p[i - 1].t), `${q}: 차례대로`);
    const halves = [p.filter(s => s.t < 300).length, p.filter(s => s.t >= 300).length];
    assert.ok(Math.abs(halves[0] - halves[1]) <= Math.max(2, Q.shots * 0.1), `${q}: 앞뒤 반이 비슷`);
  }
  assert.ok(FIREWORK_QUALITY.high.shots > FIREWORK_QUALITY.mid.shots && FIREWORK_QUALITY.mid.shots > FIREWORK_QUALITY.low.shots && FIREWORK_QUALITY.low.shots > FIREWORK_QUALITY.min.shots);
  assert.deepEqual(showPlan('mid', 600, 7), showPlan('mid', 600, 7));
  assert.notDeepEqual(showPlan('mid', 600, 7), showPlan('mid', 600, 8));
  assert.equal(WISHES.length, 3);
});

test('여름 불꽃놀이: 북쪽 해변 모래에 간판, 그 앞 바다에 발사대 (카메라가 북쪽을 봄)', () => {
  const spec = slug => JSON.parse(readFileSync(resolve(root, `assets/env/specs/${slug}.json`), 'utf8'));
  const gen = generateIsland(20261028, { lots: lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, spec(k)]))) });
  const isl = createIslandApi(gen);
  const s = summerSpots(isl);
  assert.ok(s, '해변을 찾음');
  assert.equal(isl.tileAt(s.beach.tx, s.beach.tz), 'sand');
  const r = isl.toTile(s.raft.x, s.raft.z), g = isl.toTile(s.sign.x, s.sign.z);
  assert.equal(isl.tileAt(r.tx, r.tz), 'sea', '발사대는 바다 위');
  assert.notEqual(isl.tileAt(g.tx, g.tz), 'sea', '간판은 땅 위');
  assert.ok(s.raft.z < s.sign.z - 2, '발사대가 간판보다 북쪽(바다 쪽)');
  assert.ok(Math.abs(s.raft.x) < 8, '섬 가운데 세로줄 근처');
});
