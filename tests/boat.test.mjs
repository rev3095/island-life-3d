// 어선·먼바다 낚시 (east-fishboat, D275–D279): 부두 자리 · 뱃삯 · 시간 · 갑판 · 먼바다 물고기는 섬 물에서 안 나옴.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/boat/rules.js';
import * as spawns from '../src/data/spawns.js';
import { list } from '../src/data/items.js';
import { generateIsland, createIslandApi, lotsOf, BUILDING_KINDS, resolveLayout } from '../src/world/island.js';

const json = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const cfg = json('assets/boat/boat.json');
const layout = json('assets/island/layout.json');
const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, json(`assets/env/specs/${k}.json`)])));

test('먼바다 물고기 12종: OF-01–12, 서식지 offshore, 섬 물 다섯 곳 어디서도 안 나오고 먼바다에서만', () => {
  const off = list('fish').filter(f => f.offshore);
  assert.equal(off.length, 12);
  assert.deepEqual(off.map(f => f.code), Array.from({ length: 12 }, (_, i) => `OF-${String(i + 1).padStart(2, '0')}`));
  for (const f of off) assert.deepEqual([...f.habitats], ['offshore']);
  for (const habitat of ['river', 'pond', 'sea', 'pier', 'mouth']) for (let m = 1; m <= 12; m++) for (const hour of [3, 9, 14, 21]) {
    assert.ok(!spawns.fishPool({ habitat, month: m, hour }).some(e => e.item.offshore), `${habitat} ${m}월 ${hour}시`);
    assert.ok(!spawns.fishPool({ habitat, month: m, hour, islet: true }).some(e => e.item.offshore));
  }
  for (let m = 1; m <= 12; m++) for (const hour of [3, 9, 14, 21]) {
    const pool = spawns.fishPool({ habitat: 'offshore', month: m, hour });
    assert.ok(pool.length >= 2, `먼바다 ${m}월 ${hour}시에 고를 물고기 ${pool.length}`);
    assert.ok(pool.every(e => e.item.offshore), '먼바다엔 먼바다 물고기만');
  }
});

test('부두 자리: 지금 섬 동쪽 끝 모래, 동쪽으로 바다가 이어짐 · 시드가 달라도 대개 찾는다', () => {
  const at = seed => { const gen = generateIsland(seed, { lots, layout: resolveLayout(layout) }); return { gen, site: R.findDockSite(createIslandApi(gen), layout.fishDock[1], { pier: cfg.dock.pier }) }; };
  const { gen, site } = at(layout.seed);
  assert.ok(site, '지금 섬에서 부두 자리');
  assert.ok(site.tx > gen.w * 0.8, `동쪽 끝 (tx ${site.tx} / ${gen.w})`);
  let found = 0;
  for (let s = 1; s <= 12; s++) if (at(s * 7919).site) found++;
  assert.ok(found >= 10, `시드 12 중 ${found}`);
});

test('뱃삯 · 시간 · 갑판', () => {
  assert.deepEqual(R.fareOf(cfg, {}, 0), { ok: true, pay: 'free', price: 0 });
  assert.equal(R.fareOf(cfg, { freeUsed: true }, 10).reason, 'short');
  assert.equal(R.fareOf(cfg, { freeUsed: true }, cfg.fare.price).ok, true);
  const h = 3600e3;
  assert.equal(R.tripLeft(cfg, 0, 0), cfg.trip.hours * 60);
  assert.equal(R.tripLeft(cfg, 0, cfg.trip.hours * h), 0);
  assert.equal(R.tripLeft(cfg, 10 * h, 9 * h), 0, '시계를 뒤로 돌리면 끝');
  const sp = cfg.boat.spawn;
  assert.deepEqual(R.clampDeck(cfg, sp[0], sp[1]), { x: sp[0], z: sp[1] }, '갑판 위 시작 자리');
  const out = R.clampDeck(cfg, -5, 3);
  assert.ok(R.onDeck(cfg, out.x, out.z), '갑판 밖은 안쪽으로');
  assert.ok(R.clampDeck(cfg, 0.8, 0).x <= cfg.boat.maxX, '조타실엔 못 들어감');
  assert.equal(R.habitatAt(cfg, 0, 0), null);
  assert.equal(R.habitatAt(cfg, 0, 2.5), 'offshore');
});

