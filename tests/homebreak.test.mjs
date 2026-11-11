// P44 FB-01: 낮에 집에 들르는 시간 (schedule.homeBreak) — 맑은 날에도 낮에 주민 방에 찾아갈 수 있다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeBreakOf, shouldBeOut } from '../src/gameplay/town/rules.js';
import { PEOPLE } from '../src/gameplay/town/people.js';
import { VILLAGERS } from '../src/core/constants.js';
import { MOVERS } from '../src/gameplay/town/moving.js';

const at = (dayKey, hourF) => ({ dayKey, hour: Math.floor(hourF), hourF });

test('낮 주민은 모두 homeBreak 가 있고, 그 시간엔 맑아도 집에 있다 (행사 주인공이면 건너뜀)', () => {
  const day = [...VILLAGERS, ...MOVERS].map(s => PEOPLE[s]).filter(p => p && !p.nocturnal);
  assert.ok(day.length >= 9);
  for (const p of day) {
    const br = homeBreakOf(p, '2027-05-15');
    assert.ok(br, `${p.slug}: homeBreak`);
    const mid = (br[0] + br[1]) / 2;
    assert.equal(shouldBeOut(p, at('2027-05-15', mid), 'clear'), false, `${p.slug} ${mid.toFixed(2)}시 집`);
    assert.equal(shouldBeOut(p, at('2027-05-15', mid), 'clear', { noBreak: true }), true, `${p.slug} 행사 주인공이면 밖`);
  }
});

test('낮 10–18시 어느 시각이든 맑은 날 집에 깨어 있는 주민이 있다 (homeBreak 가 서로 엇갈림)', () => {
  const day = [...VILLAGERS, ...MOVERS].map(s => PEOPLE[s]).filter(p => p && !p.nocturnal);
  for (let h = 11; h < 17.5; h += 0.5) {
    const home = day.filter(p => !shouldBeOut(p, at('2027-05-15', h), 'clear'));
    assert.ok(home.length >= 1, `${h}시: 집에 있는 주민 없음`);
  }
});

test('FB-02: 야시장 날 노점 주인은 24시까지 밖(노점), 24시–늦잠 사이엔 집에 깨어 있다', async () => {
  const { setLateHook, homeFrom, isAsleep } = await import('../src/gameplay/town/rules.js');
  const p = PEOPLE.pong;
  setLateHook((slug) => (slug === 'pong' ? 25.5 : null));
  try {
    assert.equal(homeFrom(p, '2027-05-15'), 24);
    assert.equal(shouldBeOut(p, at('2027-05-15', 23.5), 'clear', { noBreak: true }), true, '23:30 노점');
    assert.equal(shouldBeOut(p, at('2027-05-16', 0.5), 'clear', { noBreak: true }), false, '0:30 집');
    assert.equal(isAsleep(p, { dayKey: '2027-05-15', hour: 0, hourF: 0.5 }), false, '0:30 깨어 있음');
  } finally { setLateHook(null); }
});
