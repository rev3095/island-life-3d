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

// ---------- 10차 M10-P1 (보드 wave10 D95-A · D96-A · 앉기) ----------
import { pickCell, cellAt, targetCell, tilesOfBox, PICK_REACH } from '../src/gameplay/decor/rules.js';
import { SEATS, seatSpec, seatsOf, sitRoot, sitMetaOf, nearestSeat, SIT_FALLBACK } from '../src/gameplay/decor/seats.js';

test('decor 칸 누르기 (D96-A): 땅 점 → 칸, 섬 밖·너무 먼 칸은 안 고른다', () => {
  const W = 96, H = 96;
  assert.deepEqual(cellAt(0.2, -0.7, W, H), { tx: 48, tz: 47 });
  assert.deepEqual(cellAt(-48, -48, W, H), { tx: 0, tz: 0 });
  const from = { tx: 48, tz: 48 };
  assert.deepEqual(pickCell({ x: 2.5, z: 0.5 }, from, { w: W, h: H }), { ok: true, cell: { tx: 50, tz: 48 }, why: null });
  assert.equal(pickCell(null, from, { w: W, h: H }).why, 'miss');
  assert.equal(pickCell({ x: 60, z: 0 }, from, { w: W, h: H }).why, 'outside');
  assert.equal(pickCell({ x: PICK_REACH + 1.5, z: 0.5 }, from, { w: W, h: H }).why, 'far');
  assert.equal(pickCell({ x: PICK_REACH + 0.5, z: PICK_REACH + 0.5 }, from, { w: W, h: H }).ok, true, '대각선도 가로·세로 각각 PICK_REACH 안이면 됨');
});

test('decor 대상 칸: 누른 칸은 가운데 맞춤, 없으면 앞 칸으로 뻗기 (M9 그대로)', () => {
  const me = { tx: 10, tz: 10 };
  assert.deepEqual(targetCell(null, me, DIRS.n), { anchor: { tx: 10, tz: 9 }, dir: DIRS.n, picked: false });
  const t = targetCell({ tx: 14, tz: 12 }, me, DIRS.n);
  assert.deepEqual(t, { anchor: { tx: 14, tz: 12 }, dir: [0, 0], picked: true });
  // 2×2 피크닉 탁자를 누른 칸에: 누른 칸이 발자국 안 (가운데 맞춤)
  const fp = footprintTiles(t.anchor, t.dir, [2, 2], 0);
  assert.ok(fp.tiles.some(c => c.tx === 14 && c.tz === 12));
  assert.deepEqual(tilesOfBox({ tx: 3, tz: 4 }, [2, 1]), [{ tx: 3, tz: 4 }, { tx: 4, tz: 4 }]);
});

test('앉기 자리 표: 벤치 둘 · 피크닉 탁자 넷 · 의자 — 돌리면 자리·바라보는 쪽도 돈다', () => {
  assert.equal(seatSpec('fu:outdoor-bench').seats.length, 2);
  assert.equal(seatSpec('furn.picnic-table').seats.length, 4);
  assert.ok(seatSpec('log-chair') && seatSpec('sofa') && !seatSpec('furn.bookshelf'));
  for (const [slug, s] of Object.entries(SEATS)) {
    assert.ok(s.y > 0.3 && s.y < 0.7, `${slug} 앉는 면 높이`);
    assert.ok(existsSync(new URL(`../assets/furniture/specs/${slug}.json`, import.meta.url)), `${slug} 가구 스펙`);
  }
  const bench = seatsOf(seatSpec('outdoor-bench'), { x: 5, z: 5, y: 1, rot: 0 }, 'b');
  assert.equal(bench[0].key, 'b#0');
  assert.ok(Math.abs(bench[0].y - 1.455) < 1e-9, '바닥 높이 + 앉는 면');
  assert.ok(Math.abs(bench[0].facing - Math.PI) < 1e-9 || Math.abs(bench[0].facing + Math.PI) < 1e-9, '정면 +Z = 남쪽을 본다 (facing π)');
  assert.ok(bench[0].stand.z > bench[0].z, '서는 곳은 앞(+Z)');
  // 90° 돌린 벤치: 정면이 +X (three rotation.y = π/2 → +Z 가 +X 로)
  const turned90 = seatsOf(seatSpec('outdoor-bench'), { x: 0, z: 0, rot: Math.PI / 2 }, 'b');
  assert.ok(turned90[0].stand.x > 0.5 && Math.abs(turned90[0].stand.z - turned90[0].z) < 1e-9);
  // 피크닉 탁자: 탁자를 보고 앉고, 바깥에서 다가온다
  const pic = seatsOf(seatSpec('picnic-table'), { x: 0, z: 0 }, 'p');
  for (const s of pic) assert.ok(Math.hypot(s.stand.x, s.stand.z) > Math.hypot(s.x, s.z), '서는 곳은 탁자 바깥');
});

test('앉기 뿌리 자리: 엉덩이(hip) 가 앉는 면 위 — 메타가 없으면 키 × 0.28', () => {
  assert.deepEqual(sitMetaOf(null, 1), { hip: SIT_FALLBACK.hip, forward: 0 });
  assert.deepEqual(sitMetaOf({ hip: 0.3, forward: 0.05 }, 1), { hip: 0.3, forward: 0.05 });
  assert.ok(Math.abs(sitMetaOf(undefined, 1.2).hip - 0.336) < 1e-9);
  const [s] = seatsOf(seatSpec('outdoor-bench'), { x: 0, z: 0, y: 0 }, 'b');
  const r = sitRoot(s, { hip: 0.28, forward: 0.1 });
  assert.ok(Math.abs(r.y + 0.28 - s.y) < 1e-9, '뿌리 + 엉덩이 = 앉는 면');
  assert.ok(r.z < s.z, '엉덩이가 앞으로 0.1 이면 뿌리는 그만큼 뒤로');
  // 가장 가까운 빈 자리 (누가 앉은 자리는 건너뜀 · 멀면 없음)
  const bench2 = seatsOf(seatSpec('outdoor-bench'), { x: 0, z: 0 }, 'b');
  assert.equal(nearestSeat(bench2, -0.4, 0.7).key, 'b#0');
  assert.equal(nearestSeat(bench2, -0.4, 0.7, { taken: k => k === 'b#0' }).key, 'b#1');
  assert.equal(nearestSeat(bench2, 5, 5), null);
});
