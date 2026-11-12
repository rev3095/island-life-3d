import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as spawns from '../src/data/spawns.js';
import * as items from '../src/data/items.js';
import { createRng, rngFor, hashSeed, pickWeighted, sample } from '../src/data/rng.js';

const ids = pool => pool.map(e => e.item.id);

test('시드 난수: 같은 시드면 같은 수열', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every(x => x >= 0 && x < 1));
  assert.equal(hashSeed('a', 1), hashSeed('a', 1));
  assert.notEqual(hashSeed('a', 1), hashSeed('a', 2));
  assert.deepEqual(sample([1, 2, 3, 4, 5], 3, rngFor('x')), sample([1, 2, 3, 4, 5], 3, rngFor('x')));
  assert.equal(pickWeighted([], () => 1), null);
});

test('같은 rng 면 같은 물고기가 나온다', () => {
  const opts = { habitat: 'sea', hour: 22, month: 7, weather: 'clear' };
  const run = () => Array.from({ length: 20 }, ((rng) => () => spawns.fish({ ...opts, rng }))(rngFor('fish-test')));
  assert.deepEqual(run(), run());
});

test('물고기: 서식지로 거른다', () => {
  const pond = ids(spawns.fishPool({ habitat: 'pond', hour: 12, month: 7 }));
  assert.ok(pond.includes('fish.carp') && pond.includes('fish.goldfish'));
  assert.ok(!pond.includes('fish.crucian'), '붕어는 강에만');
  const sea = ids(spawns.fishPool({ habitat: 'sea', hour: 12, month: 1 }));
  assert.ok(!sea.includes('fish.tuna'), '참치는 선착장에서만');
  const pier = ids(spawns.fishPool({ habitat: 'pier', hour: 12, month: 1 }));
  assert.ok(pier.includes('fish.tuna') && pier.includes('fish.horse-mackerel'), '선착장은 바다 물고기도 (고등어는 M18-P1 부터 8~12월)');
  assert.deepEqual(spawns.fishPool({ habitat: 'lava' }), []);
  assert.equal(spawns.fish({ habitat: 'lava' }), null);
});

test('물고기: 시간대로 거른다', () => {
  const day = ids(spawns.fishPool({ habitat: 'pond', hour: 12, month: 7 }));
  const night = ids(spawns.fishPool({ habitat: 'pond', hour: 22, month: 7 }));
  assert.ok(!day.includes('fish.snakehead') && night.includes('fish.snakehead'), '가물치는 밤');
  assert.ok(night.includes('fish.catfish'));
  assert.ok(ids(spawns.fishPool({ habitat: 'river', hour: 10, month: 7 })).includes('fish.sweetfish'), '은어는 낮');
  assert.ok(!ids(spawns.fishPool({ habitat: 'river', hour: 23, month: 7 })).includes('fish.sweetfish'));
  assert.ok(ids(spawns.fishPool({ habitat: 'sea', hour: 2, month: 7 })).includes('fish.shark'), '새벽 2시도 밤');
});

test('물고기: 계절(달)로 거른다', () => {
  const autumn = ids(spawns.fishPool({ habitat: 'river', hour: 12, month: 10 }));
  const spring = ids(spawns.fishPool({ habitat: 'river', hour: 12, month: 4 }));
  assert.ok(autumn.includes('fish.salmon') && !spring.includes('fish.salmon'), '연어는 가을');
  assert.ok(ids(spawns.fishPool({ habitat: 'pier', hour: 12, month: 1 })).includes('fish.tuna'));
  assert.ok(!ids(spawns.fishPool({ habitat: 'pier', hour: 12, month: 6 })).includes('fish.tuna'), '참치는 겨울');
  assert.ok(ids(spawns.fishPool({ habitat: 'sea', hour: 12, month: 1 })).includes('fish.squid'), '오징어 겨울~봄');
  assert.ok(ids(spawns.fishPool({ habitat: 'sea', hour: 12, month: 4 })).includes('fish.squid'));
  assert.ok(!ids(spawns.fishPool({ habitat: 'sea', hour: 12, month: 8 })).includes('fish.squid'));
});

test('물고기: 비 오면 큰 그림자 가중치가 오른다, 그림자 크기', () => {
  const w = weather => spawns.fishPool({ habitat: 'pond', hour: 22, month: 7, weather }).find(e => e.item.id === 'fish.snakehead').weight;
  assert.equal(w('rain'), w('clear') * 2);
  assert.equal(spawns.shadowOf('fish.shark'), 6);
  assert.equal(spawns.shadowOf('fish.medaka'), 1);
});

test('물고기: 희귀종은 드물다', () => {
  const rng = rngFor('rare');
  let shark = 0, total = 2000;
  for (let i = 0; i < total; i++) if (spawns.fish({ habitat: 'sea', hour: 22, month: 7, rng }) === 'fish.shark') shark++;
  assert.ok(shark > 0 && shark / total < 0.1, `상어 ${shark}/${total}`);
});

test('곤충: 장소·시간·계절로 거른다', () => {
  const springFlower = ids(spawns.bugPool({ place: 'flower', hour: 10, month: 4 }));
  assert.ok(springFlower.includes('bug.yellow-butterfly'));
  assert.ok(!ids(spawns.bugPool({ place: 'flower', hour: 10, month: 7 })).includes('bug.yellow-butterfly'), '노랑나비는 봄');
  assert.ok(!ids(spawns.bugPool({ place: 'flower', hour: 22, month: 4 })).includes('bug.cabbage-white'), '나비는 낮');
  const autumnNight = ids(spawns.bugPool({ place: 'ground', hour: 21, month: 10 }));
  assert.ok(autumnNight.includes('bug.cricket') && autumnNight.includes('bug.bell-cricket'));
  assert.deepEqual(ids(spawns.bugPool({ place: 'palm', hour: 22, month: 7 })), ['bug.stag-beetle']);
  assert.deepEqual(ids(spawns.bugPool({ place: 'palm', hour: 12, month: 7 })), []);
  assert.equal(spawns.bug({ place: 'palm', hour: 12, month: 7 }), null);
  assert.deepEqual(ids(spawns.bugPool({ place: 'water', hour: 21, month: 6 })), ['bug.firefly'], '반딧불이는 초여름 밤 물가');
});

test('곤충: 여러 장소를 한 번에', () => {
  const both = ids(spawns.bugPool({ place: ['flower', 'water'], hour: 12, month: 7 }));
  assert.ok(both.includes('bug.swallowtail') && both.includes('bug.pond-skater'));
});

test('곤충: 날씨로 거른다', () => {
  assert.ok(!ids(spawns.bugPool({ place: 'rock', hour: 12, month: 6, weather: 'clear' })).includes('bug.snail'), '달팽이는 비 올 때만');
  assert.ok(ids(spawns.bugPool({ place: 'rock', hour: 12, month: 6, weather: 'rain' })).includes('bug.snail'));
  assert.ok(ids(spawns.bugPool({ place: 'under', hour: 12, month: 6, weather: 'rain' })).includes('bug.pill-bug'), '쥐며느리는 바위 밑 (비 와도)');
  assert.deepEqual(ids(spawns.bugPool({ place: 'flower', hour: 12, month: 4, weather: 'rain' })).sort(), ['bug.ladybug', 'bug.mantis'], '비 오면 나비는 숨는다');
  assert.ok(!ids(spawns.bugPool({ place: 'lamp', hour: 22, month: 1, weather: 'snow' })).includes('bug.moth'));
  assert.ok(ids(spawns.bugPool({ place: 'lamp', hour: 22, month: 1, weather: 'cloudy' })).includes('bug.moth'));
});

test('화석: 8종 중 하나, 공룡 두개골이 가장 드묾', () => {
  const rng = rngFor('fossil');
  const count = {};
  for (let i = 0; i < 4000; i++) {
    const id = spawns.fossil(rng);
    count[id] = (count[id] ?? 0) + 1;
  }
  assert.equal(Object.keys(count).length, 8);
  const skull = count['fossil.dino-skull'];
  for (const [id, n] of Object.entries(count)) if (id !== 'fossil.dino-skull') assert.ok(n > skull, id);
});

test('바위: 돌·철광석·점토·도토리 주머니, 칠수록 덜 나오고 6번이면 끝', () => {
  const tally = hits => {
    const rng = rngFor('rock', hits);
    const c = {};
    for (let i = 0; i < 3000; i++) {
      const r = spawns.rock(rng, hits);
      c[r.id] = (c[r.id] ?? 0) + 1;
    }
    return c;
  };
  const first = tally(0), late = tally(5);
  assert.deepEqual(Object.keys(first).sort(), ['mat.acorn-bag', 'mat.clay', 'mat.iron', 'mat.stone']);
  assert.ok(first['mat.acorn-bag'] > (late['mat.acorn-bag'] ?? 0) * 3);
  assert.ok(first['mat.iron'] > late['mat.iron'] * 2);
  assert.equal(spawns.rock(rngFor('x'), spawns.ROCK_MAX_HITS), null);
});

test('나무 흔들기: 과일나무는 열매, 야자수는 야자열매', () => {
  assert.deepEqual(spawns.treeShake('fruit-tree', rngFor('t'), { fruit: 'fruit.peach', fruitReady: true }), { id: 'fruit.peach', count: spawns.FRUIT_PER_TREE });
  assert.deepEqual(spawns.treeShake('palm', rngFor('t'), { fruitReady: true }), { id: 'fruit.coconut', count: spawns.COCONUT_PER_PALM });
  assert.equal(spawns.treeShake('palm', rngFor('t'), { fruitReady: false }), null);
});

test('나무 흔들기: 나뭇가지·도토리·가구·벌집, 하루 한 번 뒤로는 나뭇가지만', () => {
  const rng = rngFor('shake');
  const seen = new Set();
  let bees = 0;
  for (let i = 0; i < 3000; i++) {
    const r = spawns.treeShake('tree', rng, { hour: 12 });
    if (!r) continue;
    seen.add(items.get(r.id).category === 'furn' ? 'furn' : r.id);
    if (r.event === 'bees') bees++;
  }
  assert.deepEqual([...seen].sort(), ['bug.honeybee', 'furn', 'mat.acorn-bag', 'mat.branch']);
  assert.ok(bees > 0);
  for (let i = 0; i < 500; i++) {
    const r = spawns.treeShake('tree', rng, { dropped: true });
    assert.ok(r === null || r.id === 'mat.branch');
  }
  for (let i = 0; i < 500; i++) assert.notEqual(spawns.treeShake('tree', rng, { hour: 23 })?.event, 'bees', '밤에는 벌이 없다');
});

test('나무 흔들기: 과수원 언덕은 벌집이 더 잦다', () => {
  const beesIn = orchard => {
    const rng = rngFor('orchard');
    let n = 0;
    for (let i = 0; i < 3000; i++) if (spawns.treeShake('fruit-tree', rng, { orchard })?.event === 'bees') n++;
    return n;
  };
  assert.ok(beesIn(true) > beesIn(false) * 1.5);
});
