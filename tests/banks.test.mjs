// 강 둑·풀/모래 경계·해안 거리장 확인 (src/world/banksfield.js · coastfield.js — three 없이 도는 순수 계산). node --test tests/banks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateIsland, lotsOf, BUILDING_KINDS, KIND } from '../src/world/island.js';
import { riverBanks, groundBlend, bankWaterline, bankY, BANK } from '../src/world/banksfield.js';
import { coastField } from '../src/world/coastfield.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';

const SEEDS = [12345, 777, 2026];
// 건물 집터는 배경 스펙의 world.lot (게임과 같은 값)
const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, JSON.parse(readFileSync(new URL(`../assets/env/specs/${k}.json`, import.meta.url), 'utf8'))])));
const gens = SEEDS.map(seed => generateIsland(seed, { ...ISLAND, villagers: VILLAGERS, lots }));

/** 거리장 격자에서 (칸 좌표) 의 거리 — 꼭짓점 평균 (판 꼭짓점과 같은 값) */
const nodeAt = (L, tx, tz) => L.nodeD(Math.round((tx - L.tx0) * L.R), Math.round((tz - L.tz0) * L.R));

test('강 둑: 물가 선은 둑 비탈 안, 둑 높이는 위에서 아래로', () => {
  const wl = bankWaterline(-0.15);
  assert.ok(wl > 0 && wl < BANK.W, `물가 선 ${wl}`);
  assert.ok(Math.abs(bankY(wl) + 0.15) < 1e-3);
  assert.equal(bankY(-0.5), BANK.TOP);
  assert.ok(bankY(BANK.W) < -0.3);
});

test('강 둑: 튀어나온 땅 모서리는 둑 윗면에 묻히고, 곧은 둑은 칸 경계에서 조금만 물 쪽으로', () => {
  let corners = 0, edges = 0;
  for (const gen of gens) {
    const { w, h } = gen;
    const at = (tx, tz) => (tx < 0 || tz < 0 || tx >= w || tz >= h ? -1 : gen.kind[tz * w + tx]);
    const lv = (tx, tz) => gen.level[tz * w + tx];
    const fallNear = (tx, tz) => gen.waterfalls.some(f => Math.abs(f.tx - tx) <= 2 && Math.abs(f.tz - tz) <= 2);
    for (const L of riverBanks(gen)) {
      for (let tz = 1; tz < h - 1; tz++) for (let tx = 1; tx < w - 1; tx++) {
        if (at(tx, tz) !== KIND.WATER || lv(tx, tz) !== L.level || fallNear(tx, tz)) continue;
        const land = (a, b) => [KIND.GRASS, KIND.SAND, KIND.PATH, KIND.PLAZA].includes(at(a, b)) && lv(a, b) === L.level;
        const water = (a, b) => at(a, b) === KIND.WATER;
        // 서쪽이 땅, 북·남쪽이 물인 곧은 둑: 서쪽 변 가운데
        if (land(tx - 1, tz) && water(tx, tz - 1) && water(tx, tz + 1) && land(tx - 1, tz - 1) && land(tx - 1, tz + 1) && water(tx + 1, tz)) {
          const d = nodeAt(L, tx, tz + 0.5);
          assert.ok(d > -0.6 && d < 0.05, `곧은 둑 (${tx},${tz}) 거리 ${d}`);
          edges++;
        }
        // 튀어나온 땅 모서리: 북서쪽 칸만 땅이고 북·서는 물 → 이 물 칸의 북서 꼭짓점은 땅 칸 모서리
        if (land(tx - 1, tz - 1) && water(tx - 1, tz) && water(tx, tz - 1)) {
          const d = nodeAt(L, tx, tz);
          assert.ok(d <= 0.08, `땅 모서리 (${tx},${tz}) 거리 ${d}`);
          corners++;
        }
      }
    }
  }
  assert.ok(edges > 0 && corners > 0, `곧은 둑 ${edges} · 모서리 ${corners}`);
});

test('강 둑: 층마다 강물 칸을 덮는 격자 · 둑 윗면 색은 같은 층의 땅', () => {
  for (const gen of gens) {
    const levels = riverBanks(gen);
    const waterLevels = new Set();
    for (let i = 0; i < gen.w * gen.h; i++) if (gen.kind[i] === KIND.WATER) waterLevels.add(gen.level[i]);
    assert.deepEqual(new Set(levels.map(L => L.level)), waterLevels);
    for (const L of levels) {
      assert.equal(L.d.length, L.NX * L.NZ);
      for (const k of L.land) assert.ok([KIND.GRASS, KIND.SAND, KIND.PATH, KIND.PLAZA].includes(k));
    }
  }
});

test('풀/모래: 칸 가운데는 제 종류, 다른 종류 칸은 비워 둔다', () => {
  for (const gen of gens) {
    const { w, h } = gen;
    const g = groundBlend(gen);
    assert.equal(g.s.length, g.NX * g.NZ);
    let sand = 0, grass = 0;
    for (let tz = 1; tz < h - 1; tz++) for (let tx = 1; tx < w - 1; tx++) {
      const i = tz * w + tx, k = gen.kind[i];
      const v = g.s[(tz * g.R + g.R / 2) * g.NX + tx * g.R + g.R / 2];
      if (k !== KIND.GRASS && k !== KIND.SAND) { assert.equal(v, 0); continue; }
      // 네 이웃이 같은 종류·같은 층이면 확실히 그쪽
      const same = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => gen.kind[i + a + b * w] === k && gen.level[i + a + b * w] === gen.level[i]);
      if (!same) continue;
      if (k === KIND.SAND) { assert.ok(v > 200, `모래 (${tx},${tz}) ${v}`); sand++; }
      else { assert.ok(v < 55, `풀 (${tx},${tz}) ${v}`); grass++; }
    }
    assert.ok(sand > 10 && grass > 100);
  }
});

test('해안 거리장: 땅 칸 가운데는 안쪽, 바다 칸 먼 곳은 바깥 (contourDistance 로 나눈 뒤에도 같게)', () => {
  for (const gen of gens) {
    const f = coastField(gen);
    const { w, h } = gen;
    for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
      const k = gen.kind[tz * w + tx];
      const x = tx + 0.5 - w / 2, z = tz + 0.5 - h / 2;
      if (k !== KIND.SEA && k !== KIND.WATER) assert.ok(f.at(x, z) <= -0.5, `땅 (${tx},${tz}) ${f.at(x, z)}`);
    }
    assert.ok(f.at(-w / 2 - 6, 0) > 4);
  }
});
