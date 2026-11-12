import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as items from '../src/data/items.js';

test('컨셉 보드 수량: 물고기 20 · 곤충 20(+4차 들추기 2) · 화석 8 · 도구 5 · 가구 20(+5차 13)', () => {
  assert.equal(items.list('fish').length, 22);   // + P35 무인도 투어 무지개놀래기 · 꽃쏨뱅이
  assert.equal(items.list('bug').length, 24);    // + P35 보석풍뎅이 · 달빛나방
  assert.equal(items.list('fossil').length, 8);
  assert.equal(items.list('tool').length, 7);   // + M13 새총 TO-07 + M16 스쿠버 키트 (손에 드는 도구는 6 — tool 칸 있는 것)
  assert.equal(items.list('tool').filter(t => t.tool).length, 6);
  assert.equal(items.list('sea').length, 38);    // M16 잠수 바다 생물 IC-SE-01–20 + M18-P1 계절 생물 IC-SE-21–38
  assert.equal(items.list('furn').length, 60);   // + M15 추억 액자 둘 (FU-71–72) + M13 별 조각 가구 FU-63–66 + P54 밤 특별 상점 가구 넷 (FU-73·75·76·78)
  assert.equal(items.list('art').length, 16);   // P54 미술품 진품 (가품 8 은 list 밖 — items.get 으로만)
  assert.equal(items.list('night').length, 4);   // 12차 토요일 밤 야시장 먹거리 (IC-NT-01–04)
  assert.equal(items.list('festival').length, 4);   // 5차 Z5 축제 부스에서 만드는 것 (IC-FE-01–04)
  assert.equal(items.list('fruit').length, 8);   // + P35 망고 · 리치 (투어 섬에만)
  assert.equal(items.list('shell').length, 6);
});

test('id 는 겹치지 않고 카테고리 접두사를 따른다', () => {
  const ids = items.ITEMS.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const it of items.ITEMS) {
    assert.ok(items.CATEGORIES.includes(it.category), it.id);
    assert.ok(it.id.startsWith(`${it.category}.`), it.id);
    assert.equal(typeof it.name, 'string');
    assert.ok(it.icon, `${it.id} 아이콘`);
    assert.ok(Number.isFinite(it.price) && it.price >= 0, `${it.id} 가격`);
    assert.ok(it.stack >= 1);
  }
});

test('계약 예시 id 가 있다', () => {
  for (const id of ['fish.crucian', 'bug.cabbage-white', 'fossil.ammonite', 'fruit.apple', 'mat.wood', 'tool.rod', 'furn.log-chair']) {
    assert.ok(items.get(id), id);
  }
  assert.equal(items.get('nope'), null);
});

test('컨셉 보드 값 그대로: 이름·장소·시간·계절·가격', () => {
  const crucian = items.get('fish.crucian');
  assert.deepEqual([crucian.name, crucian.place, crucian.time, crucian.season, crucian.shadow, crucian.price], ['붕어', '강', '종일', '연중', 2, 160]);
  const shark = items.get('fish.shark');
  assert.deepEqual([shark.place, shark.time, shark.season, shark.shadow, shark.price, shark.rare], ['바다', '밤', '여름', 6, 15000, true]);
  const stag = items.get('bug.stag-beetle');
  assert.deepEqual([stag.name, stag.place, stag.price, stag.rare], ['사슴벌레', '야자수', 8000, true]);
  assert.equal(items.get('fossil.dino-skull').price, 6000);
  assert.equal(items.get('tool.shovel').buy, 800);
});

test('물고기·곤충·화석은 모두 도감 설명이 있다', () => {
  for (const cat of ['fish', 'bug', 'fossil']) {
    for (const it of items.list(cat)) assert.ok(it.desc && it.desc.length > 10, it.id);
  }
});

test('물고기·곤충은 출현 조건이 해석돼 있다', () => {
  for (const f of items.list('fish')) {
    assert.ok(f.habitats?.length && f.hours?.length && f.months?.length, f.id);
    assert.ok(f.shadow >= 1 && f.shadow <= 6, f.id);
  }
  for (const b of items.list('bug')) assert.ok(b.places?.length && b.hours?.length && b.months?.length, b.id);
});

test('도구는 내구도가 있고, 쌓임 규칙은 카테고리별', () => {
  for (const t of items.list('tool')) assert.ok(t.wear ? !t.tool && t.buy > 0 : t.durability > 0 && t.tool, t.id);   // M16 스쿠버 키트는 입는 것 (wear, 내구도 없음)
  assert.equal(items.stackOf('fish.crucian'), 1);
  assert.equal(items.stackOf('fruit.apple'), 10);
  assert.equal(items.stackOf('mat.wood'), 30);
  assert.equal(items.stackOf('mat.acorn-bag'), 10);
});

test('아이템은 고칠 수 없다', () => {
  assert.throws(() => { items.get('fish.crucian').price = 1; });
  assert.throws(() => { items.get('fish.crucian').months.push(13); });
});

test('M16 잠수: 바다 생물은 출현 조건·그림자·빠르기·설명이 있고 박물관에 기증할 수 있다', () => {
  assert.ok(items.COLLECTIBLE.includes('sea'));
  assert.equal(items.CATEGORY_NAMES.sea, '바다 생물');
  const codes = items.list('sea').map(s => s.code);
  assert.deepEqual(codes, Array.from({ length: 38 }, (_, i) => `IC-SE-${String(i + 1).padStart(2, '0')}`));
  for (const s of items.list('sea')) {
    assert.ok(s.hours?.length && s.months?.length, s.id);
    assert.ok(s.shadow >= 1 && s.shadow <= 6, s.id);
    assert.ok([0, 1, 2, 3].includes(s.speed), s.id);
    assert.ok(s.price > 0 && s.desc.length > 10, s.id);
    assert.equal(items.stackOf(s.id), 1);
  }
  const kit = items.get('tool.scuba-kit');
  assert.ok(kit && kit.buy > 0 && kit.wear === 'scuba' && !kit.tool);
});
