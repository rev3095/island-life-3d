// P50 콘텐츠 마무리 묶음: B-06 축제 축하 편지 · B-12 「밤」 분류 · B-14 상점의 섬 여행 표 · B-17 광장 벤치 자리
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNightOnly, BAG_TABS } from '../src/ui/dom.js';
import { ITEMS } from '../src/data/items.js';
import { shopStock, buyPrice } from '../src/data/economy.js';
import { seatSpec, seatsOf } from '../src/gameplay/decor/seats.js';
import { VILLAGERS } from '../src/core/constants.js';
import { MOVERS } from '../src/gameplay/town/moving.js';
import { LETTER_WHEN } from '../story-editor/words.js';

const json = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('B-06: 섬 주민 열 명 모두 첫 축제·해마다 축제 축하 편지가 있고, 편집기 설명도 있다', () => {
  for (const s of [...VILLAGERS, ...MOVERS]) {
    const L = json(`assets/villagers/${s}.json`).lines.letters;
    for (const k of ['festival', 'festivalAgain']) assert.ok(Array.isArray(L[k]?.[0]) && L[k][0].length >= 2, `${s} ${k}`);
  }
  assert.ok(LETTER_WHEN.festival && LETTER_WHEN.festivalAgain);
});

test('B-12: 「밤」 = 한낮엔 안 나오고 밤에 나오는 물고기·곤충 + 야시장 먹거리, 가방 탭 다섯', () => {
  const night = ITEMS.filter(isNightOnly);
  assert.ok(night.some(i => i.category === 'fish') && night.some(i => i.category === 'bug') && night.some(i => i.category === 'night'));
  assert.ok(!isNightOnly(ITEMS.find(i => i.id === 'bug.cabbage-white')), '낮 나비는 아님');
  assert.ok(isNightOnly(ITEMS.find(i => i.id === 'bug.firefly')), '반딧불이는 밤');
  assert.deepEqual(BAG_TABS.map(t => t.id), ['all', 'life', 'mat', 'furn', 'night']);
});

test('B-14: 섬 여행 표는 도토리상점에서 늘 판다 (사는 값 1,000 = 선착장 배와 같음)', () => {
  const s = shopStock('2027-05-15', 7);
  assert.deepEqual(s.tickets, ['mat.tour-ticket']);
  assert.ok(s.all.includes('mat.tour-ticket'));
  assert.equal(buyPrice('mat.tour-ticket'), json('assets/tour/tour.json').ticket.price);
});

test('B-17: 광장 배경 벤치도 앉는 자리 둘 (돌린 대로 바라봄)', () => {
  const seats = seatsOf(seatSpec('bench'), { x: 10, z: 10, y: 0, rot: Math.PI / 2 }, 'b');
  assert.equal(seats.length, 2);
  for (const s of seats) assert.ok(Math.hypot(s.stand.x - s.x, s.stand.z - s.z) > 0.5, '일어날 자리는 앞쪽');
});
