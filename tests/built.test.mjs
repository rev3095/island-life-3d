// M14 섬 꾸미기 다리 TI-13 · 경사로 TI-14 (결정 D153-A): world/built.js 가 칸 표를 바꾸면 걷기(passable)·높이(heightAt)·길찾기가 따라온다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateIsland, createIslandApi, lotsOf, BUILDING_KINDS } from '../src/world/island.js';
import { createBuilt } from '../src/world/built.js';
import { createNav } from '../src/gameplay/town/path.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';
import { DECOR_FILES } from '../tools/build-web.mjs';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, J(`assets/env/specs/${k}.json`)])));
const fresh = () => {
  const gen = generateIsland(20261028, { ...ISLAND, villagers: VILLAGERS, lots });
  return { gen, api: createIslandApi(gen), B: createBuilt(gen) };
};
/** 섬의 모든 칸에서 자리 찾기 */
function findSpot(B, gen, kind) {
  for (let tz = 0; tz < gen.h; tz++) for (let tx = 0; tx < gen.w; tx++) {
    const s = kind === 'bridge' ? B.bridgeSpot(tx, tz, [1, 0]) : B.rampSpot(tx, tz);
    if (s.ok) return s;
  }
  return null;
}

test('다리: 강폭 2칸 + 양쪽 둑에만, 놓으면 물을 건너고 높이가 다리 판 위', () => {
  const { gen, api, B } = fresh();
  const s = findSpot(B, gen, 'bridge');
  assert.ok(s, '본섬에 놓을 수 있는 다리 자리가 하나는 있다');
  assert.equal(s.cells.length, 2);
  const [a, b] = s.cells, [e0, e1] = s.ends;
  assert.equal(api.tileAt(a.tx, a.tz), 'water');
  assert.ok(!api.passable(e0.tx, e0.tz, a.tx, a.tz), '놓기 전엔 둑에서 물로 못 간다');
  const before = api.heightAt(s.x, s.z);
  const rec = B.addBridge(s);
  assert.ok(api.passable(e0.tx, e0.tz, a.tx, a.tz) && api.passable(a.tx, a.tz, b.tx, b.tz) && api.passable(b.tx, b.tz, e1.tx, e1.tz), '놓은 뒤엔 건넌다');
  assert.ok(api.heightAt(s.x, s.z) > before + 0.3, '다리 위 높이');
  assert.equal(api.groundAt(s.x, s.z), 'wood');
  // 같은 자리에 또 못 놓는다 · 물이 아닌 칸은 'water'
  assert.equal(B.bridgeSpot(a.tx, a.tz, [1, 0]).ok, false);
  assert.equal(B.bridgeSpot(e0.tx, e0.tz, [1, 0]).why, 'water');
  // 길찾기: 다리를 지나는 길이 생긴다
  const nav = createNav({ ...api, isWalkable: (x, z) => { const t = api.toTile(x, z); return api.isWalkableTile(t.tx, t.tz); } });
  assert.ok(nav.findPath(e0, e1), '둑에서 둑으로 길이 있다');
  // 치우면 처음대로
  B.remove(rec);
  assert.ok(!api.passable(e0.tx, e0.tz, a.tx, a.tz));
  assert.ok(Math.abs(api.heightAt(s.x, s.z) - before) < 1e-9);
});

test('경사로: 남쪽 절벽 앞 아래 두 칸, 놓으면 언덕에 오르고 높이가 0 → 1', () => {
  const { gen, api, B } = fresh();
  const s = findSpot(B, gen, 'ramp');
  assert.ok(s, '본섬에 놓을 수 있는 경사로 자리가 하나는 있다');
  const [t, l] = s.cells, cliff = { tx: t.tx, tz: t.tz - 1 };
  assert.equal(api.tileAt(cliff.tx, cliff.tz), 'cliff');
  assert.ok(!api.passable(t.tx, t.tz, cliff.tx, cliff.tz), '놓기 전엔 절벽에 못 오른다');
  const rec = B.addRamp(s);
  assert.ok(api.passable(l.tx, l.tz + 1, l.tx, l.tz) && api.passable(l.tx, l.tz, t.tx, t.tz) && api.passable(t.tx, t.tz, cliff.tx, cliff.tz), '아래 땅 → 경사로 → 절벽 위');
  assert.ok(!api.passable(t.tx, t.tz, t.tx + 1, t.tz), '경사로 옆으로는 못 나간다');
  const low = api.toWorld(l.tx, l.tz), top = api.toWorld(t.tx, t.tz);
  assert.ok(api.heightAt(low.x, low.z + 0.49) < 0.05 && api.heightAt(top.x, top.z - 0.49) > 0.95, '아래 끝 0 · 위 끝 1');
  assert.equal(B.rampSpot(t.tx, t.tz).ok, false, '같은 자리에 또 못 놓는다');
  B.remove(rec);
  assert.ok(!api.passable(t.tx, t.tz, cliff.tx, cliff.tz), '치우면 처음대로');
  assert.notEqual(api.tileAt(t.tx, t.tz), 'ramp');
  assert.ok(B.rampSpot(t.tx, t.tz).ok, '치운 자리에 다시 놓을 수 있다');
});

test('다리·경사로: decor.json builds (TI-13·TI-14) · 커진 집 모델이 꾸미기 묶음(처음에 안 받음)에 든다', () => {
  const cfg = J('assets/decor/decor.json');
  assert.deepEqual(cfg.builds.map(b => [b.id, b.type]), [['TI-13', 'bridge'], ['TI-14', 'ramp']]);
  for (const b of cfg.builds) {
    assert.ok(b.cost > 0);
    assert.equal(J(`assets/env/specs/${b.kind}.json`).id, b.id);
    assert.ok(DECOR_FILES.has(`assets/env/models/${b.kind}.glb.json`));
  }
  for (const k of cfg.homes) assert.ok(DECOR_FILES.has(`assets/env/models/${k}.glb.json`), k);
});
