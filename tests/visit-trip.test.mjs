// M21-P3 친구 섬 구경 가기 (D282-A · D285-A): 모르는 판은 구경 안 함 · 내 섬 거르기 · 섬 사진으로 같은 섬 · 묶음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILDING_KINDS, resolveLayout } from '../src/world/island.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';
import { visitable, tripOf, greetLines, shiftAdded } from '../src/gameplay/visit/trip.js';
import { planVisitIsland, villagerSpots } from '../src/gameplay/visit/islet-build.js';
import { SNAP_VERSION } from '../src/gameplay/visit/rules.js';
import { PACKS } from '../tools/build-web.mjs';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const doc = (snap = {}, extra = {}) => ({ code: 'ABCDEF', user: 'u-friend', v: 1, snap: { v: SNAP_VERSION, island: { name: '별빛섬', seed: 20261028, added: [], built: [], removed: [] }, house: { stage: 0 }, player: { name: '하루' }, villagers: [{ slug: 'coco' }], ...snap }, ...extra });

test('구경 가능 판단: 모르는 판·시드 없음은 「이 섬은 지금 구경할 수 없어요」, 내 섬은 거름', () => {
  assert.deepEqual(visitable(doc()), { ok: true, why: null });
  assert.equal(visitable(doc({ v: SNAP_VERSION + 1 })).why, 'version');
  assert.equal(visitable(doc({ island: { seed: null } })).why, 'version');
  assert.equal(visitable(null).why, 'missing');
  assert.equal(visitable(doc(), { uid: 'u-friend' }).why, 'mine');
  assert.equal(visitable(doc(), { mine: 'ABCDEF' }).why, 'mine');
  assert.deepEqual(tripOf(doc()), { code: 'ABCDEF', user: 'u-friend', island: '별빛섬', owner: '하루' });
  assert.deepEqual(greetLines([['{owner}네 {island}!', '또 와']], 3, { owner: '하루', island: '별빛섬' }), ['하루네 별빛섬!', '또 와']);
  const moved = shiftAdded([{ id: 'a', kind: 'furn:sofa', tx: 3, tz: 4, data: { at: { x: 1, z: 2, y: 0 } } }, { id: 'b', kind: 'path-stone', tx: 1, tz: 1 }], 1300);
  assert.equal(moved[0].data.at.x, 1301);
  assert.equal(moved[1].data.at, undefined);
});

test('섬 사진으로 세운 구경 섬: 치운 것·놓은 것은 넘기고 집 단계는 커진 집, 묶음은 처음 받지 않는 visit', () => {
  const specs = Object.fromEntries(BUILDING_KINDS.map(k => [k, J(`assets/env/specs/${k}.json`)]));
  const layout = resolveLayout(J('assets/island/layout.json'));
  const base = planVisitIsland(doc().snap, { constants: { ISLAND, VILLAGERS }, layout, specs }).gen;
  const tree = base.objects.find(o => o.kind === 'tree');
  const snap = doc({ island: { name: '별빛섬', seed: 20261028, removed: [tree.id], added: [{ id: 'd1', kind: 'path-stone', tx: 5, tz: 5 }], built: [] }, house: { stage: 2 } }).snap;
  const plan = planVisitIsland(snap, { constants: { ISLAND, VILLAGERS }, layout, specs, exterior: s => (s ? `house-grown-${s}` : 'house-player') });
  assert.deepEqual(plan.island.removed, [tree.id]);
  assert.equal(plan.island.added.length, 1);
  assert.equal(plan.houseKind, 'house-grown-2');
  assert.ok(plan.gen.objects.some(o => o.kind === 'house-grown-2') && !plan.gen.objects.some(o => o.kind === 'house-player'));
  assert.equal(plan.gen.objects.length, base.objects.length, '같은 시드 = 같은 섬 (물체 수)');
  const spots = villagerSpots(plan.gen, ['coco', 'nobody']);
  assert.equal(spots.length, 2);
  assert.ok(spots.every(s => Number.isFinite(s.x) && Number.isFinite(s.z)));
  const cfg = J('assets/visit/visit.json');
  for (const k of cfg.assets.env) {
    const g = PACKS.find(p => p.test(`assets/env/models/${k}.glb.json`));
    assert.equal(g.name, 'visit', k);
    assert.ok(!g.boot, `${k} 는 처음에 받지 않는다`);
    assert.equal(PACKS.find(p => p.test(`assets/env/specs/${k}.json`)).name, 'island');
  }
  assert.ok(cfg.ox - 100 > 1100 + 110 - 20, '먼바다(x 1100 ±110)와 떨어져 있다');
});
