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
