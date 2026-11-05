// 리소스 약속 검사: 편집기로 고친 모델·스펙을 바꿔 끼워도 게임이 그대로 도는지.
// 캐릭터 10 · 배경 35 · 가구 33 이 각자 스펙(json) · 모델(.glb.json) · 통계(stats) · 썸네일로 따로 있고,
// 게임 코드가 이름으로 찾는 것(뼈·동작·재질·노드)과 스펙의 world 칸(충돌·집터)이 모델 크기와 맞는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { BUILDING_KINDS, lotsOf } from '../src/world/island.js';
import { ITEMS } from '../src/data/items.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
/** .glb.json → glTF JSON 덩어리 (노드·동작·재질 이름) */
const gltfOf = p => {
  const b = Buffer.from(json(p).data, 'base64');
  assert.equal(b.readUInt32LE(0), 0x46546c67, `${p}: glb 아님`);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};

const SETS = [
  { name: '캐릭터', index: 'assets/models/index.json', models: 'assets/models', specs: 'assets/specs', renders: 'assets/renders', count: 10 },
  { name: '배경', index: 'assets/env/index.json', models: 'assets/env/models', specs: 'assets/env/specs', renders: 'assets/env/renders', count: 55 },   // + 8차 봄 꽃놀이 EN-12·PR-17·PR-23,
  { name: '가구', index: 'assets/furniture/index.json', models: 'assets/furniture/models', specs: 'assets/furniture/specs', renders: 'assets/furniture/renders', count: 35 },   // + 8차 FU-43,
];
for (const s of SETS) {
  s.list = json(s.index).models;
  s.spec = Object.fromEntries(s.list.map(m => [m.slug, json(`${s.specs}/${m.slug}.json`)]));
  s.stats = Object.fromEntries(s.list.map(m => [m.slug, json(`${s.models}/${m.slug}.stats.json`)]));
  s.gltf = Object.fromEntries(s.list.map(m => [m.slug, gltfOf(`${s.models}/${m.slug}.glb.json`)]));
}
const [CH, ENV, FURN] = SETS;
// 재질 이름 = 팔레트 키. 빌더가 늘 붙이는 고정 재질만 예외
const FIXED_MATERIALS = new Set(['eyeHighlight']);

test('리소스: 요소마다 스펙·모델·통계·썸네일 파일이 따로 있고 목록과 맞는다', () => {
  for (const s of SETS) {
    assert.equal(s.list.length, s.count, `${s.name} 개수`);
    const ids = new Set();
    for (const m of s.list) {
      const sp = s.spec[m.slug];
      assert.equal(sp.slug, m.slug, `${s.name} ${m.slug}: 스펙 slug`);
      assert.equal(sp.id, m.id, `${s.name} ${m.slug}: 목록 id 가 스펙과 다름 (빌드 도구로 목록을 다시 쓸 것)`);
      assert.equal(sp.version, m.version, `${s.name} ${m.slug}: 목록 version 이 스펙과 다름`);
      assert.equal(sp.status ?? 'review', m.status, `${s.name} ${m.slug}: 목록 status 가 스펙과 다름 (--index)`);
      assert.ok(['review', 'approved'].includes(m.status), `${s.name} ${m.slug}: status ${m.status}`);
      assert.ok(!ids.has(m.id), `${s.name} id 겹침 ${m.id}`);
      ids.add(m.id);
      assert.ok(existsSync(resolve(root, `${s.renders}/${m.slug}_thumb.png`)), `${s.name} ${m.slug}: 썸네일 없음`);
    }
  }
});

test('리소스: 모델 재질 이름은 모두 스펙 팔레트(또는 변형 팔레트)에 있다', () => {
  for (const s of SETS) for (const m of s.list) {
    const sp = s.spec[m.slug];
    const keys = new Set([...Object.keys(sp.palette ?? {}), ...Object.values(sp.variants ?? {}).flatMap(v => Object.keys(v.palette ?? {}))]);
    for (const mat of s.gltf[m.slug].materials ?? []) {
      assert.ok(keys.has(mat.name) || FIXED_MATERIALS.has(mat.name), `${s.name} ${m.slug}: 재질 ${mat.name} 이 팔레트에 없다`);
    }
  }
});

test('리소스: 캐릭터는 게임이 쓰는 동작·뼈 이름을 모두 가진다', () => {
  const CLIPS = ['idle', 'walk', 'run', 'happy'];            // player/index.js · town/actor.js · gather/results.js
  const BONES = ['arm.L', 'arm.R', 'spine', 'head'];         // player/motions.js (GLTFLoader 가 '.' 을 빼서 armR 로 읽는다)
  for (const m of CH.list) {
    const g = CH.gltf[m.slug];
    const clips = new Set((g.animations ?? []).map(a => a.name)), nodes = new Set(g.nodes.map(n => n.name));
    for (const c of CLIPS) assert.ok(clips.has(c), `캐릭터 ${m.slug}: 동작 ${c} 없음`);
    for (const b of BONES) assert.ok(nodes.has(b), `캐릭터 ${m.slug}: 뼈 ${b} 없음`);
    assert.equal(g.skins?.length, 1, `캐릭터 ${m.slug}: 뼈대(skin) 하나`);
  }
  // 이야기·주민 코드가 slug 로 부르는 캐릭터
  for (const slug of ['player', 'coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'bamtol', 'neuru', 'danpung']) assert.ok(CH.spec[slug], `캐릭터 ${slug} 없음`);
});

test('리소스: 배경 — 코드가 이름으로 찾는 종류·재질이 있다', () => {
  const USED = ['tree', 'fruit-tree', 'palm', 'cedar', 'rock', 'tulip', 'cosmos', 'pansy', 'weed', 'shell', 'bush', 'lamp', 'bench', 'mailbox',
    'signboard', 'bridge', 'fence', 'fossil-spot', 'workbench', 'campfire', 'house-player', 'house-villager', 'shop', 'museum', 'dock',
    'tile-grass', 'tile-sand', 'tile-path', 'tile-water', 'tile-cliff', 'tile-ramp', 'tile-plaza',
    'moving-boxes', 'party-balloons', 'lot-sign',   // 5차: 이사·생일 소품 (town 이 slug 로 놓는다)
    'festival-stage', 'festival-arch', 'festival-floor', 'festival-cover', 'festival-lantern', 'festival-garland', 'festival-board',   // 5차 Z5 축제 광장 (world/festival.js)
    'festival-booth-lantern', 'festival-booth-music', 'festival-booth-flower', 'festival-booth-food', 'festival-booth-fish',
    'festival-part-lantern', 'festival-part-drum', 'festival-part-garland', 'festival-part-pot', 'festival-part-flag'];
  for (const slug of USED) assert.ok(ENV.spec[slug], `배경 ${slug} 없음`);
  // 열매 딴 나무는 이 재질 메시를 뺀다 (world/objects.js PICKED)
  const mats = slug => new Set(ENV.gltf[slug].materials.map(x => x.name));
  assert.ok(mats('fruit-tree').has('fruit'));
  assert.ok(mats('palm').has('coconut'));
  // 땅·물·해안 색은 타일 팔레트에서 (world/terrain.js)
  assert.ok(ENV.spec['tile-grass'].palette.grass && ENV.spec['tile-grass'].palette.dirt && ENV.spec['tile-sand'].palette.sand);
  assert.ok(ENV.spec['tile-path'].palette.path && ENV.spec['tile-plaza'].palette.stone);
});

test('리소스: 배경 — 충돌·집터(world 칸)가 모델 크기와 맞는다', () => {
  const lots = lotsOf(ENV.spec);                             // 건물 4종 집터가 모두 있어야 섬을 만든다
  for (const k of BUILDING_KINDS) {
    const [sx, sy] = ENV.stats[k].size;                      // Blender X(가로)·Y(깊이)
    assert.ok(lots[k][0] >= sx && lots[k][1] >= sy, `${k}: 모델(${sx}×${sy})이 집터 ${lots[k].join('×')} 보다 크다 → world.lot 을 늘릴 것`);
  }
  // 상자 충돌체: 가로가 모델 가로의 88% 이상 · 모델보다 0.1 넘게 크지 않게 (모델만 키우고 충돌을 잊으면 여기서 걸린다)
  for (const m of ENV.list) {
    const c = ENV.spec[m.slug].world?.collider;
    if (!c) continue;
    const [sx, sy] = ENV.stats[m.slug].size;
    const boxes = [...(c.box ? [[-c.box[0] / 2, -c.box[1] / 2, c.box[0] / 2, c.box[1] / 2]] : []), ...(c.boxes ?? [])];
    if (boxes.length && m.slug !== 'dock') {
      const bw = Math.max(...boxes.map(b => b[2])) - Math.min(...boxes.map(b => b[0]));
      const bd = Math.max(...boxes.map(b => b[3])) - Math.min(...boxes.map(b => b[1]));
      assert.ok(bw >= sx * 0.88 && bw <= sx + 0.1, `${m.slug}: 충돌 가로 ${bw.toFixed(2)} ↔ 모델 ${sx} → world.collider 를 맞출 것`);
      assert.ok(bd <= sy + 0.1, `${m.slug}: 충돌 깊이 ${bd.toFixed(2)} > 모델 ${sy}`);
    }
    if (c.r) assert.ok(c.r * 2 <= Math.max(sx, sy) + 0.1, `${m.slug}: 충돌 원이 모델보다 크다`);
  }
  // 작업대는 집 안에서 2×1 칸을 차지한다 (house/index.js WORKBENCH_INFO)
  assert.ok(ENV.stats.workbench.size[0] <= 2 && ENV.stats.workbench.size[1] <= 1);
});

test('리소스: 가구 — 아이템 표와 스펙 칸 수·놓는 곳이 맞고, 벽시계 바늘이 있다', () => {
  const furn = ITEMS.filter(i => i.category === 'furn');
  assert.equal(furn.length, FURN.count);
  for (const it of furn) {
    const m = FURN.list.find(x => x.item === it.id);
    assert.ok(m, `${it.id}: 가구 목록에 모델 없음`);
    assert.equal(m.place, it.place, `${it.id}: 놓는 곳 (items.js ↔ 스펙)`);
    if (m.place !== 'floor') continue;                       // 벽·창문 가구는 칸 대신 벽에 붙는다
    assert.deepEqual(m.footprint, it.size, `${it.id}: 칸 수 (items.js 글자 ↔ 스펙 footprint)`);
    assert.ok(m.size[0] <= m.footprint[0] + 0.05 && m.size[1] <= m.footprint[1] + 0.05, `${it.id}: 모델이 칸(${m.footprint.join('×')})보다 크다`);
  }
  const clock = new Set(FURN.gltf['wall-clock'].nodes.map(n => n.name));
  assert.ok(clock.has('hourHand') && clock.has('minuteHand'), '벽시계 바늘 노드 (house/furniture.js)');
});
