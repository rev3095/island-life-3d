// 꽃 교배 규칙 (src/gameplay/gather/breeding.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { childColor, breed } from '../src/gameplay/gather/breeding.js';
import { list } from '../src/data/items.js';

const seq = values => { let i = 0; return () => values[i++ % values.length]; };
const TULIP = ['red', 'yellow', 'white', 'pink'];

test('교배: 꽃 색 목록은 아이템 사전과 같다 (마지막이 교배색)', () => {
  const tulips = list('flower').filter(f => f.kind === 'tulip');
  assert.deepEqual(tulips.map(f => f.variant), TULIP);
  assert.equal(tulips.at(-1).hybrid, true);
});

test('교배: 색 고르기', () => {
  assert.equal(childColor('red', 'red', TULIP, seq([0.5])), 'red');          // 같은 기본색 → 대개 그 색
  assert.equal(childColor('red', 'red', TULIP, seq([0.05])), 'pink');        // 가끔 교배색
  assert.equal(childColor('red', 'white', TULIP, seq([0.1])), 'pink');       // 다른 색끼리 → 교배색이 잘 나온다
  assert.equal(childColor('red', 'white', TULIP, seq([0.9, 0.2])), 'red');
  assert.equal(childColor('red', 'white', TULIP, seq([0.9, 0.8])), 'white');
  assert.equal(childColor('pink', 'yellow', TULIP, seq([0.2])), 'pink');     // 교배색이 끼면 절반은 교배색
  assert.equal(childColor('pink', 'yellow', TULIP, seq([0.8])), 'yellow');
  for (let i = 0; i < 50; i++) assert.ok(TULIP.includes(childColor('pink', 'pink', TULIP)));
});

test('교배: 물 준 꽃 옆 같은 종류가 있어야 핀다', () => {
  const colors = { tulip: TULIP };
  const free = () => true;
  const lone = [{ id: 'a', kind: 'tulip', variant: 'red', tx: 5, tz: 5, watered: true }];
  assert.equal(breed(lone, { colors, free, rng: () => 0 }).length, 0);
  const other = [...lone, { id: 'b', kind: 'cosmos', variant: 'pink', tx: 6, tz: 5, watered: true }];
  assert.equal(breed(other, { colors: { ...colors, cosmos: ['pink', 'white', 'orange', 'red'] }, free, rng: () => 0 }).length, 0);
  const dry = [{ id: 'a', kind: 'tulip', variant: 'red', tx: 5, tz: 5 }, { id: 'b', kind: 'tulip', variant: 'red', tx: 6, tz: 5 }];
  assert.equal(breed(dry, { colors, free, rng: () => 0 }).length, 0);                 // 아무도 물을 안 줬으면 없음
});

test('교배: 한 쌍이 빈 칸 하나에 한 송이, 같은 꽃은 하루 한 번', () => {
  const colors = { tulip: TULIP };
  const flowers = [
    { id: 'a', kind: 'tulip', variant: 'red', tx: 5, tz: 5, watered: true },
    { id: 'b', kind: 'tulip', variant: 'white', tx: 6, tz: 5, watered: true },
    { id: 'c', kind: 'tulip', variant: 'yellow', tx: 7, tz: 5, watered: true },
  ];
  const blocked = new Set(['5,4', '6,4', '7,4', '4,4', '4,5', '4,6', '5,6', '6,6']);
  const out = breed(flowers, { colors, free: (tx, tz) => !blocked.has(`${tx},${tz}`), rng: () => 0 });
  assert.equal(out.length, 1);                                            // a·b 가 짝 → c 는 짝이 없다
  assert.deepEqual(out[0].parents.sort(), ['a', 'b']);
  assert.ok(!blocked.has(`${out[0].tx},${out[0].tz}`));
  assert.ok(!flowers.some(f => f.tx === out[0].tx && f.tz === out[0].tz));
  assert.ok(TULIP.includes(out[0].variant));
});

test('교배: 확률을 넘으면 안 핀다, 한쪽만 물 주면 확률이 준다', () => {
  const colors = { tulip: TULIP };
  const pair = (wb) => [{ id: 'a', kind: 'tulip', variant: 'red', tx: 5, tz: 5, watered: true }, { id: 'b', kind: 'tulip', variant: 'red', tx: 6, tz: 5, watered: wb }];
  assert.equal(breed(pair(true), { colors, free: () => true, rng: seq([0.49, 0, 0.5]) }).length, 1);
  assert.equal(breed(pair(true), { colors, free: () => true, rng: seq([0.51]) }).length, 0);
  assert.equal(breed(pair(false), { colors, free: () => true, rng: seq([0, 0.3]) }).length, 0);   // 0.5 × 0.5 = 0.25
  assert.equal(breed(pair(false), { colors, free: () => true, rng: seq([0, 0.2, 0, 0.5]) }).length, 1);
});
