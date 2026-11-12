// 실내 검수 보드 interiors (p12): 도토리상점·박물관 실내 배치 (assets/interior/places, src/gameplay/house/placedata.js) · 문 드나들기 규칙 (door.js) · 저장 이어하기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkPlace, exhibitPlan, stockPlan, caseSlots, blockersOf, boundsOf, doormatOf, sizeOf, reachable, PLACE_FILES, PLACE_KINDS, PLACE_BUILDING, MUSEUM_CATS, FIXTURE_BASE, FIXTURE_INDEX,
  OUTER_KINDS, phaseSpec, phaseGroups } from '../src/gameplay/house/placedata.js';
import { resolveFurniture } from '../src/gameplay/house/interior.js';
import { inBox } from '../src/gameplay/house/grid.js';
import { leafLook, walkPlan, doorFront, TIMING, DOOR_STYLE, OPEN_ANGLE } from '../src/gameplay/house/door.js';
import { LABELS } from '../src/gameplay/index.js';
import * as items from '../src/data/items.js';
import { shopStock } from '../src/data/economy.js';
import { createState } from '../src/core/state.js';
import { createSave } from '../src/data/save.js';
import { fakeStorage } from './helpers.mjs';
import { planWeb } from '../tools/build-web.mjs';

const ROOT = new URL('../', import.meta.url);
const json = p => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
// 배치가 고르는 모델 = 가구 목록 + 상점·박물관 붙박이 목록 (places.js 와 같이)
const furnOnly = json('assets/furniture/index.json'), fixtures = json('assets/furniture/fixtures/index.json');
const furn = { models: [...furnOnly.models, ...fixtures.models] };
const specs = Object.fromEntries(PLACE_KINDS.map((k, i) => [k, json(PLACE_FILES[i])]));
const listOf = spec => (spec.furniture ?? []).map((e, i) => resolveFurniture(e, furn, i));

test('실내 배치 파일: 폴더 = PLACE_FILES, 상점 RM-08 · 박물관 RM-09, 섬 건물과 짝', () => {
  const files = readdirSync(new URL('assets/interior/places/', ROOT)).map(f => `assets/interior/places/${f}`).sort();
  assert.deepEqual(files, [...PLACE_FILES].sort());
  assert.equal(specs.shop.id, 'RM-08');
  assert.equal(specs.museum.id, 'RM-09');
  assert.equal(specs.moonshop.id, 'RM-10');   // M12 밤·새벽 D109-A
  assert.equal(specs.tent.id, 'RM-11');       // M12 밤·새벽 D111-A
  for (const k of PLACE_KINDS) {
    assert.equal(specs[k].place, k);
    assert.equal(specs[k].kind, 'place');
    assert.ok(json(`assets/env/specs/${PLACE_BUILDING[k]}.json`), `${k} 건물 스펙`);
  }
  assert.equal(specs.shop.keeper.slug, 'bamtol');
  assert.equal(specs.museum.keeper.slug, 'neuru');
});

test('실내 배치 검사: 모든 방 · 낮/밤 매장 갈래마다 통과 (가구·창·문 매트·계산대·주인·말 거는 자리·케이스·길·실내 문)', () => {
  for (const k of PLACE_KINDS) {
    assert.deepEqual(checkPlace(specs[k], furn), [], k);
    for (const ph of Object.keys(specs[k].phases ?? {})) assert.deepEqual(checkPlace(phaseSpec(specs[k], ph), furn), [], `${k} ${ph}`);
  }
});

test('실내 배치 검사기가 틀린 배치를 잡는다', () => {
  const bad = structuredClone(specs.shop);
  bad.furniture.push({ item: 'furn.sofa', gx: 4, gz: 6, rot: 0 });            // 문 매트 칸
  bad.furniture.push({ item: 'furn.wall-clock', wall: 'n', slot: 1 });        // 창문 자리
  bad.furniture = bad.furniture.filter(f => f.role !== 'counter');
  bad.talk = { lx: 0.5, lz: 2 };                                              // 진열 받침 위
  const errs = checkPlace(bad, furn);
  assert.ok(errs.some(e => e.includes('furn.sofa')), errs.join('\n'));
  assert.ok(errs.some(e => e.includes('창문 자리에는')), errs.join('\n'));
  assert.ok(errs.some(e => e.includes('계산대')), errs.join('\n'));
  assert.ok(errs.some(e => e.includes('talk')), errs.join('\n'));
  // 문 매트에서 계산대 앞까지 길이 막히면
  const walled = structuredClone(specs.museum);
  walled.furniture.push({ fu: 'FU-99', box: [12, 1, 0.5], gx: 0, gz: 6, rot: 0 });   // 모델 없는 번호 = box 크기 임시 상자
  assert.ok(checkPlace(walled, furn).some(e => e.includes('걸어갈 수 없어요')));
});

test('박물관 전시: 물고기 22 · 곤충 24 · 화석 8 자리, 늘 같은 자리, 케이스·받침 안, 겹치지 않음', () => {
  const lists = Object.fromEntries(MUSEUM_CATS.map(c => [c, items.list(c).map(it => it.id)]));
  assert.equal(lists.fish.length, 22);   // + P35 무인도 물고기 둘
  assert.equal(lists.bug.length, 24);    // + P35 무인도 곤충 둘
  assert.equal(lists.fossil.length, specs.museum.fossils.length, '화석 받침 = 화석 종류 수 (알 수 없는 화석 빼고)');
  const given = new Set(['fish.carp', 'bug.ladybug', 'fossil.ammonite']);
  const plan = exhibitPlan(specs.museum, lists, id => given.has(id));
  assert.equal(plan.length, 54);
  assert.deepEqual(plan.filter(e => e.donated).map(e => e.id).sort(), [...given].sort());
  // 기증 여부와 상관없이 자리는 같다
  const again = exhibitPlan(specs.museum, lists, () => true);
  assert.deepEqual(again.map(e => [e.id, e.lx, e.lz, e.y]), plan.map(e => [e.id, e.lx, e.lz, e.y]));
  const keys = new Set(plan.map(e => `${e.lx.toFixed(2)},${e.lz.toFixed(2)},${e.y}`));
  assert.equal(keys.size, plan.length, '두 전시가 한 자리에 겹치지 않는다');
  for (const e of plan) {
    if (e.cat === 'fossil') continue;
    const c = specs.museum.cases.find(x => x.cat === e.cat);
    assert.ok(e.lx > c.lx0 && e.lx < c.lx1 && e.lz > c.lz0 && e.lz < c.lz1, `${e.id} 가 케이스 안`);
    assert.ok(e.y > 0.1 && e.y < c.h, `${e.id} 높이`);
  }
  // 케이스 자리 계산: 한 자리면 가운데
  const one = caseSlots({ lx0: 0, lz0: 0, lx1: 2, lz1: 2, levels: [0.5] }, 1)[0];
  assert.deepEqual([one.lx, one.lz, one.y], [1, 1, 0.5]);
});

test('상점 진열 (실내 전수 낮/밤 매장): 낮 = 1층 실내 가구 3 + 정원 코너 야외 가구 1 · 도구 5 · 꽃씨 · 묘목 · 늘 파는 것, 밤 = 지하 밤 코너 밤 가구 · 밤 도구 · 밤 간식 · 늘 파는 것 — 모두 방 안 · 막는 상자 위', () => {
  const groups = shopStock('2026-11-04', 12345);
  const rooms = { day: [phaseSpec(specs.shop, 'day'), specs['shop-garden']], night: [phaseSpec(specs.shop, 'night'), specs['shop-night']] };
  const plans = {};
  for (const [ph, list] of Object.entries(rooms)) {
    plans[ph] = [];
    for (const spec of list) {
      const plan = stockPlan(spec, phaseGroups(groups, ph));
      plans[ph].push(...plan);
      const [w, d] = sizeOf(spec), boxes = blockersOf(spec, listOf(spec));
      for (const s of plan) {
        assert.ok(s.lx > 0 && s.lx < w && s.lz > 0 && s.lz < d - 1, `${spec.slug} ${s.id} 방 안`);
        assert.ok(boxes.some(b => inBox(b, s.lx, s.lz)), `${spec.slug} ${s.id} 는 받침·진열대 위 (바닥에 굴러다니지 않게)`);
      }
    }
  }
  const ids = (ph, g) => plans[ph].filter(s => s.group === g).map(s => s.id);
  assert.deepEqual(ids('day', 'indoor'), groups.indoor, '낮 1층: 오늘의 실내 가구 셋');
  assert.deepEqual(ids('day', 'outdoor'), groups.outdoor, '낮 정원 코너: 야외 가구');
  assert.deepEqual(ids('day', 'tools'), groups.tools.slice(0, 5));
  assert.ok(ids('day', 'seeds').length && ids('day', 'saplings').length);
  assert.ok(ids('day', 'always').includes('mat.tour-ticket'), '늘 파는 것 (섬 여행 표)');
  assert.ok(!plans.night.some(s => ['indoor', 'outdoor', 'tools', 'seeds', 'saplings'].includes(s.group)), '밤엔 낮 코너 물건이 안 보인다 (1층 가구 코너는 덮개 천)');
  assert.deepEqual(ids('night', 'night-furniture'), groups.night.furniture);
  assert.ok(ids('night', 'night-tools').length && ids('night', 'night-snacks').length, '밤 도구 · 밤 간식');
  assert.ok(ids('night', 'always').includes('mat.tour-ticket'));
  // 다른 날이면 물건이 바뀌어도 자리 수는 같다
  const next = shopStock('2026-11-05', 12345);
  for (const [ph, list] of Object.entries(rooms)) assert.equal(list.reduce((n, sp) => n + stockPlan(sp, phaseGroups(next, ph)).length, 0), plans[ph].length, ph);
});

test('실내: 문 매트 → 계산대 앞 → 주인 자리 앞까지 걸어갈 수 있고, 주인은 막는 상자 뒤', () => {
  for (const k of OUTER_KINDS) for (const ph of specs[k].phases ? Object.keys(specs[k].phases) : [null]) {
    const spec = ph ? phaseSpec(specs[k], ph) : specs[k], list = listOf(spec), m = doormatOf(spec), B = boundsOf(spec);
    assert.ok(m.entry > B.z0 && m.entry < B.z1, `${k} 들어와서 서는 곳`);
    assert.ok(reachable(spec, list, { lx: m.lx, lz: m.entry }, spec.talk), `${k} 계산대 앞까지`);
    if (spec.unattended) continue;   // P54 이상한 천막: 주인 없음 (talk = 진열 받침 앞)
    const counter = list.find(r => r.entry.role === 'counter');
    const cz = counter.rec.gz + 0.5;
    assert.ok(spec.keeper.lz < cz && spec.talk.lz > cz, `${k}: 주인 · 계산대 · 말 거는 자리 순서 (북 → 남)`);
    assert.ok(Math.hypot(spec.keeper.lx - spec.talk.lx, spec.keeper.lz - spec.talk.lz) < 2.6, `${k}: 말 거는 자리에서 주인까지 2.6칸 안 (keepers.js DESK_DIST)`);
  }
});

test('문 드나들기 규칙 (door.js): 반영 v1 = D67-A · D68-A, 문짝 모양, 걸음 시간', () => {
  assert.deepEqual([DOOR_STYLE.motion, DOOR_STYLE.fade], ['walk', 'circle']);
  // 문짝: 닫힘 = 그대로, 열수록 가로가 줄고 어두워진다 (안으로 열림)
  const a = leafLook(0), b = leafLook(0.5), c = leafLook(1);
  assert.equal(a.width, 1);
  assert.equal(a.shade, 1);
  assert.ok(b.width < a.width && c.width < b.width && c.width > 0);
  assert.ok(c.shade < b.shade && b.shade < 1);
  assert.ok(OPEN_ANGLE > 1 && OPEN_ANGLE < Math.PI / 2);
  // 걸음: 가까우면 보통 연출 걸음, 멀면 walkMax 초 안에 닿게 빨리. 원은 문간에 닿을 즈음 닫히기 시작
  const near = walkPlan({ x: 0, z: 1 }, { x: 0, z: 0 }), far = walkPlan({ x: 0, z: 3 }, { x: 0, z: 0 });
  assert.equal(near.speed, TIMING.walk);
  assert.ok(far.speed > TIMING.walk && far.time <= TIMING.walkMax + 1e-9);
  assert.ok(near.fadeAt >= 0 && near.fadeAt < near.time);
  assert.equal(walkPlan({ x: 0, z: 0 }, { x: 0, z: 0 }).fadeAt, 0);
  // 들고 나는 데 2초를 넘지 않는다 (연 · 걸음 · 원 닫힘 · 원 열림)
  assert.ok(TIMING.beforeWalk + TIMING.walkMax + TIMING.fadeOut * 0.2 + TIMING.fadeIn < 2);
  assert.deepEqual(doorFront({ x: 10, z: 5 }, { x0: -0.3, x1: 0.3, y0: 0.2, z: 1.2 }, 1), { x: 10, y: 1.2, z: 6.2 });
});

test('건물 모델 4종에 문(door 재질)이 있고 크기가 문답다 — door.js 가 이 크기로 문짝을 덧씌운다', () => {
  for (const kind of ['house-player', 'house-villager', 'shop', 'museum']) {
    const j = json(`assets/env/models/${kind}.glb.json`);
    const bin = Buffer.from(j.data, 'base64'), len = bin.readUInt32LE(12);
    const g = JSON.parse(bin.subarray(20, 20 + len).toString());
    const prims = g.meshes.flatMap(m => m.primitives).filter(p => g.materials[p.material]?.name === 'door');
    assert.ok(prims.length, `${kind}: door 재질`);
    const acc = g.accessors[prims[0].attributes.POSITION];
    const w = acc.max[0] - acc.min[0], h = acc.max[1] - acc.min[1];
    assert.ok(w > 0.4 && w < 1.2 && h > 0.8 && h < 2.0, `${kind}: 문 크기 ${w.toFixed(2)}×${h.toFixed(2)}`);
    assert.ok(acc.max[2] > 0.9, `${kind}: 문은 건물 앞(남쪽)에`);
  }
});

test('행동 키 글자: 새 처리기에도 글자가 있다', () => {
  for (const n of ['house-door-busy', 'house-place-out', 'house-place-idle']) assert.ok(n in LABELS, n);
  assert.equal(LABELS['house-place-out'], '나가기');
});

test('웹 빌드가 실내 배치 파일을 넣는다', () => {
  const files = new Set(planWeb().files.map(f => f.path));
  for (const p of PLACE_FILES) assert.ok(files.has(p), `빌드에 ${p}`);
});

test('저장: 상점·박물관 안 칸(house.place)이 왕복하고, 그 칸이 없는 예전 저장도 그대로 열린다', () => {
  const storage = fakeStorage();
  const src = createState();
  src.house.place = 'museum';
  src.player.x = 620; src.player.z = 1;
  assert.equal(createSave({ state: src, storage, now: () => 1 }).save(), true);
  const dst = createState();
  assert.equal(createSave({ state: dst, storage }).load(), true);
  assert.equal(dst.house.place, 'museum');
  // 예전 저장 (p12 전): house 에 place 가 없다 → 밖에서 시작 (places.js 는 S.place 가 있을 때만 이어 들어간다)
  const old = createState();
  old.house = { furniture: [], inside: false, visit: null };
  const st2 = fakeStorage();
  assert.equal(createSave({ state: old, storage: st2, now: () => 2 }).save(), true);
  const back = createState();
  assert.equal(createSave({ state: back, storage: st2 }).load(), true);
  assert.equal(back.house.place ?? null, null);
  assert.deepEqual(back.house.furniture, []);
});

test('사양이 낮을 때 빼는 deco 소품은 1×1 구석 소품만 — 계산대·케이스·받침·주민 방 핵심 가구는 아니다', () => {
  const rooms = readdirSync(new URL('assets/interior/rooms/', ROOT)).map(f => json(`assets/interior/rooms/${f}`));
  const all = [...PLACE_KINDS.map(k => specs[k]), ...rooms];
  let n = 0;
  for (const spec of all) for (const r of listOf(spec)) {
    if (!r.entry.deco) continue;
    n++;
    const [w, d] = r.footprint;
    assert.ok(w * d <= 1, `${spec.slug} ${r.key}: deco 는 1칸짜리만`);
    assert.ok(r.entry.role !== 'counter' && !r.entry.fu && r.real, `${spec.slug} ${r.key}: 계산대·임시 받침은 deco 가 아님`);
  }
  assert.ok(n >= 3, 'deco 가 몇 개는 있다');
  // deco 를 빼도 문 매트 → 계산대 앞 길은 그대로
  for (const k of PLACE_KINDS) {
    const lite = { ...specs[k], furniture: specs[k].furniture.filter(f => !f.deco) };
    assert.deepEqual(checkPlace(lite, furn), [], `${k} (deco 뺌)`);
  }
});

test('단풍 방 RM-07: 이사 온 단풍의 집이 빈 기본 방이 아니라 자기 방으로 열린다', () => {
  const index = json('assets/interior/index.json');
  const entry = index.rooms.find(r => r.owner === 'danpung');
  assert.ok(entry, 'interior/index.json 에 단풍 방');
  assert.equal(entry.id, 'RM-07');
  const room = json(`assets/interior/rooms/${entry.slug}.json`);
  assert.ok(room.furniture.length >= 8, '가구가 채워져 있다');
  assert.ok(room.furniture.every(f => f.item && furn.models.some(m => m.item === f.item)), '모두 지금 가구 모델 (임시 상자 없음)');
  assert.ok(room.furniture.some(f => f.item === 'furn.bookshelf') && room.furniture.some(f => f.item === 'furn.dino-model'), '수집가 방 (책장 · 공룡 모형)');
});

test('붙박이 FU-35–42 + 옷 진열대 FU-54 (11차) + 새벽 천막 FU-60–62 (P44) + 상점 낮/밤 FU-79–84 (실내 전수): 스펙 = 목록 = 모델, 아이템 표 밖, 크기가 발자국 안 · 배치의 box 와 같은 칸', () => {
  assert.equal(FIXTURE_INDEX, `${FIXTURE_BASE}/index.json`);
  const dir = `${FIXTURE_BASE}/specs/`;
  const fspecs = readdirSync(new URL(dir, ROOT)).map(f => json(dir + f));
  assert.deepEqual(fixtures.models.map(m => m.slug).sort(), fspecs.map(s => s.slug).sort(), '목록 = 스펙 (node tools/build-furniture.mjs --fixtures --index)');
  assert.deepEqual(fixtures.models.map(m => m.id).sort(), [...Array.from({ length: 8 }, (_, i) => `FU-${35 + i}`), 'FU-54', 'FU-60', 'FU-61', 'FU-62', 'FU-74', 'FU-77', ...Array.from({ length: 6 }, (_, i) => `FU-${79 + i}`)]);   // + P54 미술품 받침 FU-74 · 운세 탁자 FU-77 · 실내 전수 상점 낮/밤 FU-79–84
  const furnIds = new Set(furnOnly.models.map(m => m.id)), itemIds = new Set(items.list().map(it => it.id));
  for (const m of fixtures.models) {
    const sp = fspecs.find(x => x.slug === m.slug);
    assert.equal(sp.category, 'fixture', m.slug);
    assert.ok(m.item.startsWith('fixture.') && !itemIds.has(m.item), `${m.slug}: 아이템 표 밖 (사고팔지 않는다)`);
    assert.ok(!furnIds.has(m.id), `${m.slug}: 가구 목록과 번호가 겹치지 않는다`);
    assert.equal(sp.status, m.status, `${m.slug}: status`);
    assert.ok(readFileSync(new URL(`${FIXTURE_BASE}/models/${m.slug}.glb.json`, ROOT)).length > 1000, `${m.slug}: 모델`);
    assert.ok(m.size[0] <= m.footprint[0] + 0.05 && m.size[1] <= m.footprint[1] + 0.05, `${m.slug}: 모델이 칸보다 크다`);
  }
  // 배치가 고른 붙박이: 모델을 못 읽을 때의 임시 상자 칸 = 모델 칸, 케이스 모델 = 케이스 상자 크기
  let used = 0;
  for (const k of PLACE_KINDS) {
    for (const e of [...specs[k].furniture, ...Object.values(specs[k].phases ?? {}).flatMap(P => P.furniture ?? [])]) {
      const m = fixtures.models.find(x => x.id === e.fu);
      if (!m) continue;
      used++;
      if (m.place === 'wall') { assert.ok(e.wall, `${k} ${e.fu}: 벽 붙박이는 wall·slot`); continue; }
      assert.deepEqual(e.box.slice(0, 2), m.footprint, `${k} ${e.fu}: box 칸 = 모델 칸`);
    }
    for (const c of specs[k].cases ?? []) {
      const m = fixtures.models.find(x => x.slug === c.fixture);
      assert.ok(m, `${k} ${c.name}: 케이스 모델 ${c.fixture}`);
      assert.ok(Math.abs(m.size[0] - (c.lx1 - c.lx0)) < 0.1 && Math.abs(m.size[1] - (c.lz1 - c.lz0)) < 0.1 && Math.abs(m.size[2] - c.h) < 0.05, `${k} ${c.fixture}: 모델 크기 = 케이스 상자`);
      used++;
    }
  }
  assert.equal(used, 1 + 1 + 2 + 2 + 2 + 1 + 8 + 2 + 3 + 8 + 5 + 4 + 4 + 5 + 4, '상점 1층 계산대·옷 진열대(11차)·실내 문 둘 + 낮 진열 받침 둘 + 밤 덮개 천 둘 · 박물관 안내대·화석 받침 여덟·케이스 둘 · M12 달빛 가게 계산대·받침 둘 · 천막 타로 탁자·받침·촛대 둘·휘장 넷 (P44) · P54 운세 부스·여우 상인·이상한 천막 (5 + 4 + 4) · 실내 전수 정원 코너 도구 받침·씨앗 진열대 둘·받침·화분 선반 · 지하 밤 코너 등불 진열장·받침·도구 받침·무인 계산함');
  // 계산대·안내대·받침 윗면 높이가 게임이 물건을 올리는 높이와 맞는다 (진열 0.18 · 도구 0.12 · 씨앗 0.6 · 화석 0.55)
  const top = slug => json(`${FIXTURE_BASE}/models/${slug}.stats.json`);
  assert.ok(Math.abs(top('fossil-pedestal').size[2] - specs.museum.fossilY) < 0.02, '화석 받침 윗면 = fossilY');
  for (const k of ['shop-garden', 'shop-night']) for (const row of specs[k].stock) if (/tools|always/.test(row.group) && row.lx > 7) assert.ok(row.y >= 0.1 && row.y <= 0.14, `${k} 도구 받침 윗면`);
  assert.equal(specs['shop-night'].stock.find(row => row.group === 'night-snacks').y, 0.78, '등불 진열장 윗면 0.78 (등불은 뒤쪽 위)');
});

test('방 셋 확정: 단풍 방 RM-07 · 상점 RM-08 · 박물관 RM-09 status approved', () => {
  const index = json('assets/interior/index.json');
  assert.equal(index.rooms.find(r => r.id === 'RM-07').status, 'approved');
  assert.equal(json('assets/interior/rooms/rm-07.json').status, 'approved');
  assert.equal(specs.museum.status, 'approved');
  for (const k of ['shop', 'shop-garden', 'shop-night']) assert.ok(['review', 'approved'].includes(specs[k].status), `${k}: 실내 전수 낮/밤 매장 (v6 · RM-21 · RM-22) 검수 대기`);
  for (const k of ['moonshop', 'tent']) assert.ok(['review', 'approved'].includes(specs[k].status), `${k}: M12 새 방은 검수 대기`);
});
