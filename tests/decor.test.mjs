// 9차 M9 섬 꾸미기 (보드 wave9 D86-A·D87-A): 이어짐 꼬리표 · 발자국 · 놓을 칸 판정 · 변형 이름 · 리소스·묶음 약속 · 행사 소품
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { linkTags, footprintTiles, dirOfFacing, canPlace, turned, DIRS, GROUND_OK } from '../src/gameplay/decor/rules.js';
import { splitVariant, joinVariant, furnitureWorld } from '../src/world/variants.js';
import { generateIsland, createIslandApi, lotsOf, BUILDING_KINDS } from '../src/world/island.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';
import * as items from '../src/data/items.js';
import { DECOR_FURN, OUTDOOR } from '../src/data/decor-items.js';
import { PROP_MOUNT } from '../src/gameplay/events/props.js';
import { PACKS, DECOR_FILES } from '../tools/build-web.mjs';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const CFG = J('assets/decor/decor.json');

test('decor: 이어짐 꼬리표 — 네 방향 + 길만 모서리 (두 이웃과 대각선이 다 같을 때)', () => {
  const set = new Set(['5,5', '6,5', '5,6', '6,6', '4,5']);
  const same = (x, z) => set.has(`${x},${z}`);
  assert.deepEqual(linkTags(5, 5, same), ['e', 's', 'w']);
  assert.deepEqual(linkTags(5, 5, same, { corners: true }), ['e', 's', 'w', 'se']);
  assert.deepEqual(linkTags(4, 5, same, { corners: true }), ['e']);
  assert.deepEqual(linkTags(9, 9, same, { corners: true }), []);
  assert.deepEqual(DIRS.n, [0, -1]);   // 북 = -Z (world/objects.js LINK_DIR 과 같음)
});

test('decor: 변형 이름 = 색 변형 + 꼬리표 (예전 저장의 색 변형만 있는 이름도 그대로)', () => {
  assert.deepEqual(splitVariant('red+wow'), { pal: 'red', tags: ['wow'] });
  assert.deepEqual(splitVariant('+n+e'), { pal: null, tags: ['n', 'e'] });
  assert.deepEqual(splitVariant('blue'), { pal: 'blue', tags: [] });
  assert.deepEqual(splitVariant(null), { pal: null, tags: [] });
  assert.equal(joinVariant(null, ['n']), '+n');
  assert.equal(joinVariant('spring', []), 'spring');
});

test('decor: 발자국 — 앞으로 뻗고 돌리면 가로세로가 바뀐다', () => {
  assert.deepEqual(turned([2, 1], 1), [1, 2]);
  const a = { tx: 10, tz: 10 };
  const north = footprintTiles(a, DIRS.n, [2, 2], 0);
  assert.deepEqual(north.min, { tx: 10, tz: 9 });                // 앞(북)으로 두 칸, 옆은 가운데 맞춤
  assert.equal(north.tiles.length, 4);
  assert.ok(north.tiles.some(t => t.tx === 10 && t.tz === 10));   // 앞 칸은 늘 들어 있다
  const east = footprintTiles(a, DIRS.e, [2, 1], 1);              // 벤치를 돌려서 동쪽 앞에
  assert.deepEqual(east.size, [1, 2]);
  assert.deepEqual(east.min, { tx: 10, tz: 10 });
  assert.deepEqual(dirOfFacing(0), DIRS.n);
  assert.deepEqual(dirOfFacing(Math.PI / 2), DIRS.w);
  assert.deepEqual(dirOfFacing(Math.PI), DIRS.s);
  assert.deepEqual(dirOfFacing(-Math.PI / 2), DIRS.e);
});

test('decor: 놓을 칸 판정 — 진짜 섬에서 땅·높이·물체·문 앞·한도', () => {
  const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, J(`assets/env/specs/${k}.json`)])));
  const gen = generateIsland(20261028, { ...ISLAND, villagers: VILLAGERS, lots });
  const isl = createIslandApi(gen);
  const objAt = new Map();
  for (const o of gen.objects) objAt.set(`${o.tx},${o.tz}`, [...(objAt.get(`${o.tx},${o.tz}`) ?? []), { kind: o.kind, layer: 'top' }]);
  const placed = new Map();
  const env = (extra = {}) => ({
    inside: (x, z) => x >= 0 && z >= 0 && x < isl.w && z < isl.h, tileAt: isl.tileAt, levelAt: isl.levelAt, flagsAt: isl.flagsAt,
    on: (x, z) => [...(objAt.get(`${x},${z}`) ?? []), ...(placed.get(`${x},${z}`) ?? [])], reserved: () => false, count: 0, limit: 400, ...extra,
  });
  let grass = null, sea = null, tree = null;
  for (let z = 0; z < isl.h; z++) for (let x = 0; x < isl.w; x++) {
    const k = isl.tileAt(x, z);
    if (!grass && k === 'grass' && !objAt.has(`${x},${z}`) && !isl.flagsAt(x, z)) grass = { tx: x, tz: z };
    if (!sea && k === 'sea') sea = { tx: x, tz: z };
    if (!tree && objAt.get(`${x},${z}`)?.some(o => o.kind === 'tree')) tree = { tx: x, tz: z };
  }
  assert.ok(grass && sea && tree);
  assert.equal(canPlace([grass], 'ground', env()).ok, true);
  assert.equal(canPlace([sea], 'ground', env()).why, 'ground');
  assert.equal(canPlace([tree], 'ground', env()).why, 'taken');
  assert.equal(canPlace([grass], 'top', env({ count: 400 })).why, 'limit');
  assert.equal(canPlace([grass], 'top', env({ reserved: () => true })).why, 'door');
  assert.equal(canPlace([grass], 'top', env({ playerAt: () => true })).why, 'player');
  // 길 위에 가구는 되고, 길 위에 길은 안 된다
  placed.set(`${grass.tx},${grass.tz}`, [{ kind: 'path-stone', layer: 'ground' }]);
  assert.equal(canPlace([grass], 'top', env()).ok, true);
  assert.equal(canPlace([grass], 'ground', env()).why, 'taken');
  assert.ok(['grass', 'sand', 'path'].every(k => GROUND_OK.has(k)) && !GROUND_OK.has('plaza'));
});

test('decor: 길·울타리 리소스 — 스펙의 이어짐·바닥 소리·충돌, 모델에 팔 부품, 묶음 decor', () => {
  const kinds = [...CFG.paths, ...CFG.fences];
  assert.deepEqual(kinds.map(k => k.id), ['TI-09', 'TI-10', 'TI-11', 'TI-12', 'PR-24', 'PR-25']);
  for (const { kind } of kinds) {
    const spec = J(`assets/env/specs/${kind}.json`);
    assert.equal(spec.world?.connect, kind.startsWith('path') ? 'path' : 'fence', kind);
    if (kind.startsWith('path')) { assert.equal(spec.world.layer, 'ground'); assert.ok(spec.world.ground); }
    else assert.ok(spec.world.collider?.links > 0, `${kind} 이어지는 충돌`);
    const glb = J(`assets/env/models/${kind}.glb.json`);
    const bin = Buffer.from(glb.data ?? glb.glb ?? glb.base64 ?? '', 'base64').toString('latin1');
    for (const n of ['core', 'link_n', 'link_e', 'link_s', 'link_w']) assert.ok(bin.includes(`"${n}"`), `${kind} 모델에 ${n}`);
    assert.ok(DECOR_FILES.has(`assets/env/models/${kind}.glb.json`));
  }
  const decorPack = PACKS.find(p => p.name === 'decor');
  assert.ok(decorPack && !decorPack.boot, 'decor 묶음은 처음에 받지 않는다');
  assert.ok(decorPack.test('assets/env/models/path-stone.glb.json'));
  assert.ok(PACKS.findIndex(p => p.name === 'decor') < PACKS.findIndex(p => p.name === 'island'), 'island 보다 먼저 맞아야 한다');
});

test('decor: 야외 가구 — FU-47–50 아이템·스펙·모델, outdoor 표시, world 스펙으로 바꾸기', () => {
  assert.deepEqual(DECOR_FURN.map(r => r[8]), ['FU-47', 'FU-48', 'FU-49', 'FU-50']);
  const outdoor = items.list('furn').filter(it => it.outdoor);
  assert.ok(outdoor.length >= DECOR_FURN.length + 5);
  for (const it of outdoor) {
    const slug = it.id.slice(5);
    assert.ok(OUTDOOR.has(slug));
    assert.ok(existsSync(new URL(`../assets/furniture/models/${slug}.glb.json`, import.meta.url)), `${slug} 모델`);
  }
  for (const [slug, , size, , , , buy, source, id] of DECOR_FURN) {
    const it = items.get(`furn.${slug}`);
    assert.equal(it.code, id); assert.equal(it.source, source); assert.ok(buy > 0);
    const spec = J(`assets/furniture/specs/${slug}.json`);
    assert.equal(spec.outdoor, true); assert.ok(['review', 'approved'].includes(spec.status));
    assert.equal(spec.footprint.join('×'), size);
    const w = furnitureWorld(spec);
    assert.deepEqual(w.world.extent, [spec.footprint[0] / 2, spec.footprint[1] / 2]);
    assert.ok(w.world.collider);
  }
  assert.ok(J('assets/furniture/index.json').models.filter(m => m.outdoor).length >= 4);
});

test('행사 소품·표정·동작 (M9-P1): events.json props → 모델·붙일 뼈, 눈사람 표정 넷, 주인공 동작 셋', () => {
  const ev = J('assets/events/events.json');
  for (const e of ev.list) for (const p of e.props ?? []) {
    assert.ok(PROP_MOUNT[p], `${p} 붙일 자리`);
    assert.ok(existsSync(new URL(`../assets/env/models/event-${p}.glb.json`, import.meta.url)), `event-${p} 모델`);
    assert.ok(e.assets.env.includes(`event-${p}`), `${e.id} 계절 묶음에 event-${p}`);
  }
  const snow = J('assets/env/specs/event-snowman.json');
  assert.deepEqual(snow.world.options.face, ['smile', 'wow', 'calm', 'plain']);
  const winter = readFileSync(new URL('../src/gameplay/events/winter.js', import.meta.url), 'utf8');
  for (const k of snow.world.options.face) assert.ok(winter.includes(`key: '${k}'`), `faceOf 가 ${k} 를 준다`);
  const player = J('assets/models/player.stats.json');
  for (const a of ['sparkler', 'push', 'place']) assert.ok(player.animations[a], `주인공 동작 ${a}`);
});
