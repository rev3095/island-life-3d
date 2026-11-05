// 아이템 모델·아이콘 약속 검사 (5차 Z1, 검수 보드 D8-B): 가구를 뺀 아이템 93개의 아이콘이 3D 모델 렌더 썸네일이고,
// 스펙 하나(assets/items/specs/<slug>.json)로 모델·아이콘을 바꿔 끼울 수 있는지 — 리소스 교체 약속(docs/CONTRACTS.md 끝)과 같은 규칙.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ITEMS, get } from '../src/data/items.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const has = p => existsSync(resolve(root, p));
/** .glb.json → glTF JSON 덩어리 */
const gltfOf = p => {
  const b = Buffer.from(json(p).data, 'base64');
  assert.equal(b.readUInt32LE(0), 0x46546c67, `${p}: glb 아님`);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};

const DIR = 'assets/items';
const LIST = json(`${DIR}/index.json`).models;
const SPECS = Object.fromEntries(readdirSync(resolve(root, `${DIR}/specs`)).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), json(`${DIR}/specs/${f}`)]));
const NOT_FURN = ITEMS.filter(i => i.category !== 'furn');
const GROUP = { tool: 'tool', mat: 'mat', seed: 'seed', fruit: 'fruit', shell: 'shell', flower: 'flower', fish: 'fish', bug: 'bug', fossil: 'fossil', festival: 'festival', event: 'event' };
const HOLD = new Set(['fish', 'bug', 'fossil']);       // 잡아서 들어 보이는 것 (gather/results.js)
const FIXED_MATERIALS = new Set(['eyeHighlight']);

test('아이템 아이콘: 가구를 뺀 93개가 모두 렌더 썸네일이고 글자용 emoji 가 남아 있다', () => {
  assert.equal(NOT_FURN.length, 102);   // 93 + 5차 Z5 축제 4 (IC-FE) + 8차 행사 채집 5 (IC-EV-01·02 · 버섯 셋 IC-EV-03)
  for (const it of NOT_FURN) {
    assert.match(it.icon, /^assets\/items\/renders\/[\w-]+_thumb\.png$/, `${it.id}: icon 이 썸네일 경로가 아님`);
    assert.ok(has(it.icon), `${it.id}: 썸네일 없음 ${it.icon} (node tools/build-item.mjs)`);
    assert.ok(it.emoji && !/\.png$/.test(it.emoji), `${it.id}: emoji (글자로 쓸 곳)`);
  }
});

test('아이템 모델 목록: 스펙 82개가 빠짐없이 빌드되어 있고 id·version·status 가 스펙과 같다', () => {
  assert.equal(Object.keys(SPECS).length, 89, '스펙 개수 (고유 모델 89 = 아이콘 102 − 같은 모델의 색 변형 13)');
  assert.equal(LIST.length, Object.keys(SPECS).length, '목록에 없는 스펙이 있다 (node tools/build-item.mjs <slug>)');
  const ids = new Set();
  for (const m of LIST) {
    const sp = SPECS[m.slug];
    assert.ok(sp, `${m.slug}: 스펙 없음`);
    assert.equal(sp.slug, m.slug);
    assert.equal(sp.id, m.id, `${m.slug}: 목록 id (빌드 도구로 목록을 다시 쓸 것)`);
    assert.equal(sp.version, m.version, `${m.slug}: 목록 version`);
    assert.equal(sp.status ?? 'review', m.status, `${m.slug}: 목록 status (--index)`);
    assert.ok(['review', 'approved'].includes(m.status));
    assert.match(m.id, /^IC-(TL|MA|SD|FR|SH|FL|FS|BG|FO|FE|EV)-\d\d$/, `${m.slug}: 검수 보드 ID`);   // FE = 5차 Z5 축제 · EV = 8차 계절 행사
    assert.ok(!ids.has(m.id), `id 겹침 ${m.id}`);
    ids.add(m.id);
    for (const f of [`${DIR}/models/${m.slug}.glb.json`, `${DIR}/models/${m.slug}.stats.json`, `${DIR}/renders/${m.slug}_thumb.png`]) assert.ok(has(f), `${m.slug}: ${f} 없음`);
    assert.deepEqual(m.style, Object.fromEntries(Object.entries(sp.style ?? {}).filter(([k]) => ['outlineWidth', 'flat', 'noOutline'].includes(k))), `${m.slug}: 목록 style`);
  }
});

test('아이템 모델 목록: 아이템마다 모델이 하나, 아이콘 경로가 items.js 와 같고, 색 변형은 썸네일이 따로', () => {
  const seen = new Map();
  for (const m of LIST) {
    const sp = SPECS[m.slug];
    assert.deepEqual(m.items.map(x => x.item), sp.items.map(x => x.item), `${m.slug}: 목록 items`);
    const vars = Object.keys(sp.variants ?? {});
    assert.deepEqual(m.variants, vars);
    for (const x of m.items) {
      const it = get(x.item);
      assert.ok(it, `${m.slug}: 없는 아이템 ${x.item}`);
      assert.ok(!seen.has(x.item), `${x.item}: 모델이 둘 (${seen.get(x.item)}, ${m.slug})`);
      seen.set(x.item, m.slug);
      assert.equal(GROUP[it.category], m.group, `${x.item}: 분류`);
      assert.equal(it.icon, x.icon, `${x.item}: items.js icon ↔ 목록 icon`);
      if (x.variant) assert.ok(vars.includes(x.variant), `${x.item}: 변형 ${x.variant} 이 스펙에 없다`);
      else assert.equal(vars.length, 0, `${x.item}: 변형 있는 모델인데 아이템에 변형이 없다`);
      if (x.variant) assert.equal(x.icon, `${DIR}/renders/${m.slug}_${x.variant}_thumb.png`);
    }
    if (vars.length) assert.equal(m.items.length, vars.length, `${m.slug}: 변형마다 아이템 하나`);
  }
  for (const it of NOT_FURN) assert.ok(seen.has(it.id), `${it.id}: 아이템 모델 없음`);
  assert.equal(seen.size, 102);
});

test('아이템 모델: 재질 이름은 모두 스펙 팔레트 키 (리소스 교체 약속)', () => {
  for (const m of LIST) {
    const sp = SPECS[m.slug];
    const keys = new Set([...Object.keys(sp.palette), ...Object.values(sp.variants ?? {}).flatMap(v => Object.keys(v.palette ?? {}))]);
    const mats = gltfOf(`${DIR}/models/${m.slug}.glb.json`).materials ?? [];
    assert.ok(mats.length > 0, `${m.slug}: 재질 없음`);
    for (const mat of mats) assert.ok(keys.has(mat.name) || FIXED_MATERIALS.has(mat.name), `${m.slug}: 재질 ${mat.name} 이 팔레트에 없다`);
    for (const k of Object.keys(sp.palette)) assert.match(sp.palette[k], /^#[0-9A-Fa-f]{6}$/, `${m.slug}: 팔레트 ${k}`);
    for (const k of Object.keys(sp.paletteLabels ?? {})) assert.ok(keys.has(k), `${m.slug}: 이름표만 있는 색 ${k}`);
  }
});

test('아이템 모델: 물고기·곤충·화석은 들어 보이는 모델(hold) — 한가운데가 원점, 손에 들 크기', () => {
  for (const m of LIST) {
    assert.equal(m.hold, HOLD.has(m.group), `${m.slug}: hold`);
    const st = json(`${DIR}/models/${m.slug}.stats.json`);
    const [lo, hi] = st.bounds;
    const big = Math.max(...st.size);
    if (m.hold) {
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(lo[k] + hi[k]) / 2 < 0.01, `${m.slug}: 원점이 가운데가 아니다 (${k})`);
      assert.ok(big >= 0.12 && big <= 0.9, `${m.slug}: 크기 ${big} (머리 위로 들 크기 0.12~0.9 칸)`);
    } else {
      assert.ok(Math.abs(lo[2]) < 0.01, `${m.slug}: 바닥이 원점 높이가 아니다`);
    }
  }
  assert.equal(LIST.filter(m => m.hold).length, 51, '물고기 20 · 곤충 22 · 화석 9');
});

test('아이템 스펙: 편집기가 읽을 params 모양 (label·value, 숫자는 min ≤ value ≤ max, 고르기는 options 안)', () => {
  for (const sp of Object.values(SPECS)) {
    assert.ok(sp.prompt?.concept, `${sp.slug}: prompt.concept`);
    for (const [k, p] of Object.entries(sp.params ?? {})) {
      assert.ok(p.label && 'value' in p, `${sp.slug}.${k}: label·value`);
      if (typeof p.value === 'number' && 'min' in p) assert.ok(p.min <= p.value && p.value <= p.max, `${sp.slug}.${k}: ${p.value} 이 범위 밖`);
      if (p.options) assert.ok(p.options.includes(p.value), `${sp.slug}.${k}: ${p.value} 가 options 에 없다`);
    }
  }
});
