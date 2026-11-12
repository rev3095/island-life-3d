// M18-P1 계절 생물 (D191-A · D197-A): 바다 생물 18종 IC-SE-21–38 · 연중 일부를 계절로 · 도감 「이번 달」 UI-35 · 계절 묶음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as items from '../src/data/items.js';
import { seaPool } from '../src/data/spawns.js';
import { seaPackOf } from '../src/data/sea-items.js';

const T = JSON.parse(readFileSync(new URL('../assets/data/items.json', import.meta.url), 'utf8'));
const LIVING = ['fish', 'bug', 'sea'];
const NEW_SEA = T.sea.slice(20);

test('바다 생물 18종: IC-SE-21–38 · 계절마다 4–5종 (봄 4 · 여름 4 · 가을 5 · 겨울 5) · 이름이 물고기·바다 생물과 안 겹침', () => {
  assert.equal(NEW_SEA.length, 18);
  const sea = items.list('sea');
  assert.deepEqual(sea.slice(20).map(s => s.code), Array.from({ length: 18 }, (_, i) => `IC-SE-${i + 21}`));
  const by = {};
  for (const r of NEW_SEA) by[r.season] = (by[r.season] ?? 0) + 1;
  assert.deepEqual(by, { 봄: 4, 여름: 4, 가을: 5, 겨울: 5 });
  const names = [...T.fish, ...T.bugs, ...T.sea].map(r => r.name);
  assert.equal(new Set(names).size, names.length, '이름 겹침');
  for (const r of NEW_SEA) {
    assert.ok(r.desc?.length > 10 && r.shadow >= 1 && r.shadow <= 6 && r.speed >= 0 && r.speed <= 3 && r.price > 0, r.slug);
    assert.ok(r.time in T.times, r.slug);
  }
});

test('달마다 새로 나오는 것: 1–12월 모두 물고기·곤충·바다 생물 중 하나 이상', () => {
  const all = LIVING.flatMap(c => items.list(c));
  for (let m = 1; m <= 12; m++) {
    const fresh = all.filter(it => items.isNewIn(it, m));
    assert.ok(fresh.length >= 1, `${m}월 새로 나오는 것 없음`);
    for (const it of fresh) assert.ok(items.inMonth(it, m) && !items.inMonth(it, m === 1 ? 12 : m - 1), it.id);
  }
  // 연중 23 → 15 (8종을 계절로)
  const yearRound = [...T.fish, ...T.bugs, ...T.sea].filter(r => r.season === '연중');
  assert.equal(yearRound.length, 15);
});

test('이번 달 도우미: 연중·화석은 새것·끝 아님 · 해 넘김 범위', () => {
  const get = id => items.get(id);
  assert.equal(items.isNewIn(get('fish.crucian'), 3), false, '연중');
  assert.equal(items.isNewIn(get('fossil.ammonite'), 3), false);
  assert.equal(items.inMonth(get('fossil.ammonite'), 7), true);
  assert.equal(items.isNewIn(get('fish.octopus'), 10), true);      // 10~3월
  assert.equal(items.isNewIn(get('fish.octopus'), 1), false);
  assert.equal(items.isLastIn(get('fish.octopus'), 3), true);
  assert.equal(items.inMonth(get('fish.octopus'), 12), true);
  assert.equal(items.isNewIn(get('sea.cod'), 12), true);           // 겨울 [12, 1, 2]
  assert.equal(items.isLastIn(get('sea.cod'), 2), true);
});

test('계절 바다 생물은 그 계절에만 잡히고, 모델 묶음은 그 계절 것 (sea-<계절>)', () => {
  for (const r of NEW_SEA) {
    const it = items.get(`sea.${r.slug}`);
    assert.equal(it.pack, seaPackOf(r.season));
    for (let m = 1; m <= 12; m++) {
      const ids = new Set([3, 12, 22].flatMap(hour => seaPool({ hour, month: m }).map(e => e.item.id)));
      assert.equal(ids.has(it.id), it.months.includes(m), `${it.name} ${m}월`);
    }
  }
  assert.deepEqual(items.seaPacksFor(1).sort(), ['sea-winter']);
  assert.deepEqual(items.seaPacksFor(2).sort(), ['sea-spring', 'sea-winter'], '다음 달 것도 미리');
  assert.ok(items.list('sea').every(it => !it.pack || it.pack.startsWith('sea-')));
});
