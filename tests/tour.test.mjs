// P35 무인도 투어 규칙 검사 (보드 tour D120–D128): 투어 섬 생성기 · 그날 섬 정하기 · 투어에만 나오는 물고기·곤충 · 설정 파일.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateIslet, isletOf, unreachable, SHAPE_IDS, ISLET_FRUITS } from '../src/gameplay/tour/islet.js';
import { KIND, FLAG } from '../src/world/island.js';
import * as spawns from '../src/data/spawns.js';
import * as items from '../src/data/items.js';
import { nativeFruit } from '../src/data/economy.js';

const cfg = JSON.parse(readFileSync(new URL('../assets/tour/tour.json', import.meta.url), 'utf8'));

test('투어 섬: 모양 틀 넷 × 시드 50 — 선착장·배가 있고 땅이 모두 선착장에서 이어지며, 과일나무 3 · 광석 바위 3', () => {
  assert.deepEqual(SHAPE_IDS, ['TO-01', 'TO-02', 'TO-03', 'TO-04']);
  for (const shape of SHAPE_IDS) for (let k = 1; k <= 50; k++) {
    const g = generateIslet(k * 7919 + 13, { shape, guest: k % 3 === 0 });
    const tag = `${shape} 시드 ${g.seed}`;
    assert.ok(g.dock, `${tag}: 선착장`);
    assert.equal(unreachable(g), 0, `${tag}: 못 가는 땅`);
    assert.ok(g.places.spawn && g.places.boat, `${tag}: 내리는 곳·배 자리`);
    const kinds = g.objects.map(o => o.kind);
    assert.equal(kinds.filter(x => x === 'fruit-tree').length, 3, `${tag}: 과일나무`);
    assert.equal(kinds.filter(x => x === 'ore-rock').length, 3, `${tag}: 광석 바위`);
    assert.equal(kinds.filter(x => x === 'tour-boat').length, 1, `${tag}: 배`);
    assert.ok(ISLET_FRUITS.includes(g.nativeFruit), `${tag}: 투어 과일`);
    assert.ok(g.objects.every(o => o.id.startsWith('tour:')), `${tag}: 물체 id 앞붙이 (본섬 하루 기록과 섞이지 않게)`);
    assert.equal(new Set(g.objects.map(o => `${o.tx},${o.tz}`)).size, g.objects.length, `${tag}: 한 칸에 물체 하나`);
    const land = g.kind.filter(k => k !== KIND.SEA).length;
    assert.ok(land >= 150 && land <= 420, `${tag}: 땅 ${land}칸`);
    for (const o of g.objects) {
      if (['dock', 'tour-boat', 'bridge'].includes(o.kind)) continue;
      const i = o.tz * g.w + o.tx;
      assert.ok(g.kind[i] !== KIND.SEA && !(g.flags[i] & FLAG.DOCK), `${tag}: ${o.id} 가 땅 위`);
    }
    if (shape === 'TO-04' && g.ramps.length) assert.ok(g.level.some(l => l === 1), `${tag}: 언덕`);
    if (k % 3 === 0) assert.ok(g.places.guest, `${tag}: 다른 섬 주민 자리`);
  }
});

test('투어 섬: 같은 날 같은 횟수면 같은 섬, 날이 바뀌면 다른 섬', () => {
  assert.deepEqual(isletOf('2026-11-10', 0, 7), isletOf('2026-11-10', 0, 7));
  const days = Array.from({ length: 40 }, (_, d) => isletOf(`2026-12-${String(d % 28 + 1).padStart(2, '0')}`, Math.floor(d / 28), 7));
  assert.ok(new Set(days.map(x => x.seed)).size >= 39);
  assert.deepEqual(new Set(days.map(x => x.shape)), new Set(SHAPE_IDS), '모양 틀 넷이 모두 나온다');
  const a = generateIslet(1234, { shape: 'TO-01' }), b = generateIslet(1234, { shape: 'TO-01' });
  assert.deepEqual([...a.kind], [...b.kind]);
  assert.deepEqual(a.objects.map(o => o.id), b.objects.map(o => o.id));
});

test('투어 아이템: 무인도 물고기·곤충은 투어 섬에서만, 망고·리치는 섬 특산이 되지 않는다', () => {
  for (const id of [...cfg.rare.fish, ...cfg.rare.bugs, ...ISLET_FRUITS.map(f => `fruit.${f}`), 'mat.gold-ore', 'mat.crystal', cfg.ticket.item]) assert.ok(items.get(id), id);
  const fishOn = islet => spawns.fishPool({ habitat: 'sea', hour: 12, month: 6, islet }).map(e => e.item.id);
  assert.ok(cfg.rare.fish.every(id => !fishOn(false).includes(id)), '본섬 바다에는 없다');
  assert.ok(cfg.rare.fish.every(id => fishOn(true).includes(id)), '투어 섬 바다에는 있다');
  assert.ok(!spawns.fishPool({ habitat: 'river', hour: 12, month: 6, islet: true }).some(e => cfg.rare.fish.includes(e.item.id)), '강에는 없다');
  const bugAt = (place, hour, islet) => spawns.bugPool({ place, hour, month: 6, islet }).map(e => e.item.id);
  assert.ok(!bugAt('rock', 12, false).includes('bug.jewel-beetle') && bugAt('rock', 12, true).includes('bug.jewel-beetle'));
  assert.ok(!bugAt('air', 22, false).includes('bug.moon-moth') && bugAt('air', 22, true).includes('bug.moon-moth'));
  for (let seed = 1; seed < 300; seed++) assert.ok(!['fruit.mango', 'fruit.lychee'].includes(nativeFruit(seed)), `시드 ${seed} 특산`);
});

test('투어 설정: 표 값·하루 횟수·광석 확률·배 모델이 묶음 갈래(tour)에 든다', () => {
  assert.equal(cfg.ticket.price, 1000);
  assert.equal(cfg.ticket.perDay, 1);
  const sum = cfg.ore.table.reduce((s, [, p]) => s + p, 0);
  assert.ok(sum > 0 && sum < 1, `광석 확률 합 ${sum}`);
  for (const [id] of cfg.ore.table) assert.ok(items.get(id), id);
  assert.deepEqual(cfg.env, ['tour-boat', 'ore-rock']);
  const src = readFileSync(new URL('../tools/build-web.mjs', import.meta.url), 'utf8');
  assert.match(src, /name: 'tour', test: p => TOUR_FILES\.has\(p\)/);
});
