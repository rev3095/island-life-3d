// 11차 M11 옷 갈아입기 (보드 wave11 D100-A · D101-A · D102-A): 옷 목록·스펙·모델 약속, 저장 칸 고르기, 상점 하루 옷 둘, 진열대 자리.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { SLOTS, SLOT_BONES, parseWear, wearId, paletteOf, wearName } from '../src/player/wear.js';
import {
  BASE_TOP_ID, DEFAULT_OUTFIT, entryOf, validWear, canonical, normalizeOutfit, normalizeCloset, closetBySlot, shopPool, pickShopClothes, addToCloset,
} from '../src/player/outfit-rules.js';
import { stockPlan, sizeOf } from '../src/gameplay/house/placedata.js';
import { shopStock } from '../src/data/economy.js';
import { RULES } from '../src/data/tables.js';

const ROOT = new URL('../', import.meta.url);
const json = p => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const catalog = json('assets/clothes/index.json');
const specs = readdirSync(new URL('assets/clothes/specs/', ROOT)).map(f => json(`assets/clothes/specs/${f}`));
const player = json('assets/specs/player.json');

test('옷 목록 = 스펙 13벌 (CL-00 기본 + 모자 넷 · 윗옷 다섯 · 신발 셋), 검수 대기', () => {
  assert.equal(specs.length, 13);
  assert.deepEqual(catalog.models.map(m => m.id), Array.from({ length: 13 }, (_, i) => `CL-${String(i).padStart(2, '0')}`));
  assert.deepEqual(catalog.models.map(m => m.slug).sort(), specs.map(s => s.slug).sort(), '목록 = 스펙 (node tools/build-clothes.mjs --index)');
  const count = slot => catalog.models.filter(m => m.slot === slot && !m.builtin).length;
  assert.deepEqual([count('hat'), count('top'), count('shoes')], [4, 5, 3]);
  for (const s of specs) {
    const m = catalog.models.find(x => x.slug === s.slug);
    assert.equal(m.version, s.version, s.slug);
    assert.equal(m.status, s.status, s.slug);
    assert.ok(['review', 'approved'].includes(s.status), s.slug);
    assert.ok(SLOTS.includes(s.slot), s.slug);
    for (const [k, v] of Object.entries({ ...s.palette, ...Object.assign({}, ...Object.values(s.variants ?? {}).map(v => v.palette)) })) assert.match(v, /^#[0-9A-F]{6}$/i, `${s.slug} ${k}`);
  }
  const base = entryOf(catalog, BASE_TOP_ID);
  assert.ok(base.builtin && base.slot === 'top' && base.part === 'player_top', 'CL-00 = 몸 모델의 player_top');
});

test('옷 모델: 주인공 뼈대에 끼우는 약속 — 칸마다 쓰는 뼈 · 재질 = 팔레트 키 · 몸 팔레트와 안 겹침 · 크기', () => {
  const reserved = new Set([...Object.keys(player.palette), 'eyeHighlight', 'outline']);
  for (const s of specs.filter(s => !s.builtin)) {
    const st = json(`assets/clothes/models/${s.slug}.stats.json`);
    assert.ok(existsSync(new URL(`assets/clothes/models/${s.slug}.glb.json`, ROOT)), `${s.slug} 모델`);
    assert.ok(existsSync(new URL(`assets/clothes/renders/${s.slug}_thumb.png`, ROOT)), `${s.slug} 썸네일`);
    assert.equal(st.body, 'player');
    assert.equal(st.version, s.version, `${s.slug} 모델이 스펙 version 으로 빌드됐다`);
    for (const b of st.bones) assert.ok(SLOT_BONES[s.slot].includes(b), `${s.slug}: ${s.slot} 옷이 뼈 ${b} 를 쓴다`);
    assert.deepEqual(st.materials.slice().sort(), Object.keys(s.palette).filter(k => st.materials.includes(k)).sort());
    for (const m of st.materials) {
      assert.ok(m in s.palette, `${s.slug}: 재질 ${m} 이 팔레트에 있다`);
      assert.ok(!reserved.has(m), `${s.slug}: 재질 ${m} 이 몸 팔레트와 겹친다`);
    }
    assert.ok(st.triangles > 50 && st.triangles <= 3500, `${s.slug}: 삼각형 ${st.triangles} (옷 하나 3.5k 안 — 몸 10.6k + 세 칸 합쳐도 캐릭터 예산 근처)`);
  }
});

test('주인공 몸 · 기본 윗옷 나누기: player_top + 빙글 AN-12 (처음 모습 그대로 — 삼각형 수 같음)', () => {
  assert.equal(player.clothes?.split, true);
  assert.equal(player.clothes.top, BASE_TOP_ID);
  assert.ok(player.animations.includes('spin'));
  const st = json('assets/models/player.stats.json');
  assert.ok(st.parts.player_top > 0 && st.parts.player > 0);
  assert.equal(st.parts.player + st.parts.player_top, st.triangles);
  assert.equal(st.triangles, 10604, '나누기 전 삼각형 수 (0.1.1) 와 같다');
  assert.ok(st.animations.spin);
});

test('옷 이름: slug@변형, 기본 변형 붙이기, 이름·팔레트', () => {
  assert.deepEqual(parseWear('striped-tee@berry'), { slug: 'striped-tee', variant: 'berry' });
  assert.equal(wearId('straw-hat', null), 'straw-hat');
  assert.equal(canonical(catalog, 'striped-tee'), 'striped-tee@sea', '변형 있는 옷은 첫 변형');
  assert.equal(canonical(catalog, 'striped-tee@nope'), 'striped-tee@sea');
  assert.equal(canonical(catalog, 'straw-hat@x'), 'straw-hat', '변형 없는 옷은 slug');
  assert.equal(canonical(catalog, 'nothing'), null);
  assert.ok(validWear(catalog, 'striped-tee@berry') && !validWear(catalog, 'striped-tee@nope'));
  const tee = entryOf(catalog, 'striped-tee');
  assert.equal(paletteOf(tee, 'berry').teeStripe, '#D2546A');
  assert.equal(paletteOf(tee, 'berry').tee, tee.palette.tee);
  assert.equal(wearName(tee, 'sea'), '줄무늬 티');
  assert.equal(wearName(tee, 'berry'), '딸기 줄무늬');
});

test('저장 칸 고르기: 모르는 옷·칸이 다른 옷·안 가진 옷은 빼고, 윗옷은 늘 하나 (예전 저장 = 기본 옷)', () => {
  assert.deepEqual(normalizeOutfit(undefined, catalog, []), DEFAULT_OUTFIT, '예전 저장');
  const closet = normalizeCloset(['straw-hat', 'striped-tee', 'striped-tee@sea', 'ghost', 'basic-tee', 'sneakers'], catalog);
  assert.deepEqual(closet, ['straw-hat', 'striped-tee@sea', 'sneakers'], '겹침·모르는 것·기본 옷 빼기, 변형 붙이기');
  assert.deepEqual(normalizeOutfit({ hat: 'straw-hat', top: 'striped-tee', shoes: 'sneakers' }, catalog, closet), { hat: 'straw-hat', top: 'striped-tee@sea', shoes: 'sneakers' });
  assert.deepEqual(normalizeOutfit({ hat: 'sneakers', top: 'overalls@denim', shoes: 'ghost' }, catalog, closet), DEFAULT_OUTFIT, '칸이 다르거나 안 가진 옷');
  assert.deepEqual(normalizeOutfit({ top: null }, catalog, closet).top, BASE_TOP_ID);
  const by = closetBySlot(closet, catalog);
  assert.deepEqual(by.hat.map(x => x.id), [null, 'straw-hat'], '모자: 없음 + 가진 것');
  assert.deepEqual(by.top.map(x => x.id), [BASE_TOP_ID, 'striped-tee@sea'], '윗옷: 기본 티 + 가진 것');
  assert.deepEqual(by.shoes.map(x => x.id), [null, 'sneakers']);
  assert.deepEqual(addToCloset(closet, 'raincoat@pink', catalog), [...closet, 'raincoat@pink']);
  assert.equal(addToCloset(closet, 'straw-hat', catalog), closet, '이미 있음');
  assert.equal(addToCloset(closet, BASE_TOP_ID, catalog), closet, '기본 옷은 늘 가진 것');
});

test('상점 하루 옷 둘 (D102-A): 같은 날 같은 옷 · 같은 옷 다른 색은 같은 날 안 나옴 · 날마다 바뀜 · 기본 옷은 안 팖', () => {
  assert.equal(RULES.shop.clothesPerDay, 2);
  const pool = shopPool(catalog);
  assert.equal(pool.length, 4 + 5 * 2 + 3, '모자 넷 + 윗옷 다섯 × 색 둘 + 신발 셋');
  assert.ok(!pool.includes(BASE_TOP_ID));
  const a = pickShopClothes(catalog, '2027-03-01', 20261028, 2);
  assert.equal(a.length, 2);
  assert.deepEqual(pickShopClothes(catalog, '2027-03-01', 20261028, 2), a, '같은 날 = 같은 옷');
  const seen = new Set();
  for (let d = 1; d <= 28; d++) {
    const ids = pickShopClothes(catalog, `2027-02-${String(d).padStart(2, '0')}`, 20261028, 2);
    assert.notEqual(parseWear(ids[0]).slug, parseWear(ids[1]).slug);
    ids.forEach(i => seen.add(i));
  }
  assert.ok(seen.size >= 12, `한 달이면 옷이 골고루 (${seen.size})`);
  assert.deepEqual(pickShopClothes(catalog, '2027-03-01', 1, 0), [], '0 = 안 팖');
});

test('상점 옷 진열대 FU-54: 옷 둘이 진열대 위 · 방 안, 윗옷은 가로대 높이에 건다', () => {
  const shop = json('assets/interior/places/shop.json');
  const groups = { ...shopStock('2027-03-01', 20261028), clothes: pickShopClothes(catalog, '2027-03-01', 20261028, 2) };
  const plan = stockPlan(shop, groups).filter(s => s.group === 'clothes');
  assert.equal(plan.length, 2);
  const rack = shop.furniture.find(f => f.fu === 'FU-54');
  assert.ok(rack, '옷 진열대가 상점 배치에 있다');
  const [w, d] = sizeOf(shop);
  for (const s of plan) {
    assert.ok(s.lx > rack.gx && s.lx < rack.gx + rack.box[0] && s.lz > rack.gz && s.lz < rack.gz + rack.box[1], `${s.id} 진열대 위`);
    assert.ok(s.lx < w && s.lz < d, `${s.id} 방 안`);
    assert.ok(s.hang > 0.8 && s.hang < rack.box[2], '가로대 높이');
  }
});
