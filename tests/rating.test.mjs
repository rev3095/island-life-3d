// M14 섬 별점 (결정 D152-A): 세기 · 점수 · 별 · 상 · 한마디 · 섬폰 줄 · s25 트리거
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/rating/rules.js';
import { generateIsland, lotsOf, BUILDING_KINDS } from '../src/world/island.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';
import { APPS } from '../src/ui/phone.js';
import { TRIGGERS } from '../src/gameplay/story/rules.js';
import { PACKS } from '../tools/build-web.mjs';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const CFG = J('assets/rating/rating.json');

test('처음 섬은 별 하나 (잡초 30), 잡초만 뽑아도 별 둘 — 별 다섯은 꾸며야', () => {
  const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, J(`assets/env/specs/${k}.json`)])));
  const gen = generateIsland(20261028, { ...ISLAND, villagers: VILLAGERS, lots });
  const c = R.countIsland(gen.objects, { home: 0, residents: 6 });
  assert.ok(c.flowers > 50 && c.trees > 80 && c.weeds > 0, JSON.stringify(c));
  assert.equal(R.rate(c, CFG).stars, 1);
  assert.equal(R.rate({ ...c, weeds: 0 }, CFG).stars, 2);
  const tidy = { ...c, weeds: 0, flowers: 120, furn: 15, fences: 20, paths: 50, builds: 2, home: 3, residents: 8 };
  assert.equal(R.rate(tidy, CFG).stars, 5);
  assert.equal(R.rate({ ...tidy, weeds: 40 }, CFG).stars < 5, true, '잡초가 많으면 별이 내려간다');
});

test('세기: 꾸민 것은 data.decor 로, 덤불은 나무 반 개', () => {
  const objs = [{ kind: 'tulip' }, { kind: 'bush' }, { kind: 'bush' }, { kind: 'tree' }, { kind: 'weed' },
    { kind: 'path-stone', data: { decor: 'path' } }, { kind: 'fence-wood', data: { decor: 'fence' } }, { kind: 'fu:bench', data: { decor: 'furn' } }, { kind: 'bridge-built', data: { decor: 'build' } }];
  assert.deepEqual(R.countIsland(objs, { home: 2, residents: 7 }), { flowers: 1, trees: 2, furn: 1, fences: 1, paths: 1, builds: 1, weeds: 1, home: 2, residents: 7 });
});

test('상: 처음 오른 별마다 한 번, 별 다섯 처음은 한 번만', () => {
  const st = {};
  const RS = R.ensureRating(st);
  let g = R.record(RS, { stars: 3, score: 160 }, CFG, '2026-11-12');
  assert.deepEqual([g.up, g.acorns, g.firstFive], [[2, 3], 3000, false]);
  g = R.record(RS, { stars: 2, score: 100 }, CFG, '2026-11-13');
  assert.deepEqual([g.up, g.acorns, RS.best], [[], 0, 3], '내려갔다 다시 올라도 상은 한 번');
  g = R.record(RS, { stars: 5, score: 320 }, CFG, '2026-11-14');
  assert.deepEqual([g.up, g.acorns, g.firstFive], [[4, 5], 8000, true]);
  assert.equal(R.record(RS, { stars: 5, score: 330 }, CFG, '2026-11-15').firstFive, false);
});

test('한마디: 별 칭찬 + 가장 아쉬운 칸 (잡초가 먼저)', () => {
  const res = R.rate({ flowers: 100, trees: 100, weeds: 30 }, CFG);
  const lines = R.comment(res, CFG, 3);
  assert.equal(lines.length, 2);
  assert.equal(lines[1], CFG.parts.find(p => p.id === 'weeds').tip);
});

test('연결: 섬폰 ⭐ 줄 (UI-25) · 장면 s25 트리거 rating-five · 설정이 섬 묶음에', () => {
  assert.ok(APPS.some(a => a.id === 'rating' && a.panel === 'rating'));
  assert.equal(TRIGGERS['rating-five'].event, 'rating:stars');
  assert.ok(TRIGGERS['rating-five'].test({ first5: true }) && !TRIGGERS['rating-five'].test({ first5: false }));
  assert.equal(J('assets/story/scenes/s25-five-stars.json').trigger.on, 'rating-five');
  assert.equal(PACKS.find(p => p.test('assets/rating/rating.json'))?.name, 'island');
});
