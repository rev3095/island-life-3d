// 5차 Z2 벽지·바닥·주민 방 (assets/interior, src/gameplay/house/interior.js): 스펙 모양·목록 맞춤·상점 오늘의 것·저장 칸·주민 방 배치
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkPattern, checkRoom, todayPick, normalizeHouse, resolveFurniture, listOf, resolveFill, visitRule, DEFAULT, WEB_FILES } from '../src/gameplay/house/interior.js';
import { VILLAGERS } from '../src/core/constants.js';
import { MOVERS } from '../src/gameplay/town/moving.js';
import { planWeb } from '../tools/build-web.mjs';

const ROOT = new URL('../', import.meta.url);
const json = p => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const index = json('assets/interior/index.json');
const furn = json('assets/furniture/index.json');
const specs = readdirSync(new URL('assets/interior/specs/', ROOT)).map(f => json(`assets/interior/specs/${f}`));
const rooms = readdirSync(new URL('assets/interior/rooms/', ROOT)).map(f => json(`assets/interior/rooms/${f}`));
const WINDOWS = new Set(['n:1', 'n:6']);   // room.js WINDOWS

test('벽지 8 · 바닥 8 · 방 틀 스펙이 있고 무늬·색이 맞다', () => {
  const wp = specs.filter(s => s.kind === 'wallpaper'), fl = specs.filter(s => s.kind === 'floor');
  assert.deepEqual(wp.map(s => s.id).sort(), ['WP-01', 'WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08']);
  assert.deepEqual(fl.map(s => s.id).sort(), ['FL-01', 'FL-02', 'FL-03', 'FL-04', 'FL-05', 'FL-06', 'FL-07', 'FL-08']);
  for (const s of [...wp, ...fl]) {
    assert.deepEqual(checkPattern(s), [], s.slug);
    assert.ok(s.price > 0, `${s.slug} 값`);
    assert.equal(s.slug, s.id.toLowerCase(), 'slug = id 소문자');
  }
  // 벽지는 징두리·몰딩·걸레받이 색, 바닥은 앞 턱 색과 발소리
  for (const s of wp) for (const k of ['wainscot', 'molding', 'baseboard']) assert.ok(resolveFill(s, k), `${s.slug}.${k}`);
  for (const s of fl) { assert.ok(resolveFill(s, 'edge'), `${s.slug}.edge`); assert.ok(['wood', 'sand', 'grass'].includes(s.step), `${s.slug}.step`); }
  const frame = specs.find(s => s.kind === 'frame');
  for (const k of ['frameTrim', 'pane', 'paneNight', 'doormat', 'doormatEdge']) assert.ok(resolveFill(frame, k), `frame.${k}`);
  // 지금 기본 방 색 그대로 (room.js 에 박혀 있던 값)
  const wp1 = specs.find(s => s.slug === 'wp-01'), fl1 = specs.find(s => s.slug === 'fl-01');
  assert.equal(wp1.palette.base, '#F7EBD3');
  assert.equal(fl1.palette.base, '#D9B382');
  assert.ok(wp1.starter && fl1.starter);
});

test('무늬 검사기가 틀린 스펙을 잡는다', () => {
  const bad = { palette: { base: '#FFFFFF', x: 'red' }, pattern: { tile: [10, 0], size: [1, 1], base: 'base', shapes: [{ circle: [1, 2] , fill: 'base' }, { rect: [0, 0, 1, 1], fill: 'nope' }, { star: 1 }] } };
  const errs = checkPattern(bad);
  assert.ok(errs.some(e => e.includes('tile')));
  assert.ok(errs.some(e => e.includes('circle')));
  assert.ok(errs.some(e => e.includes("'nope'")));
  assert.ok(errs.some(e => e.includes('모양이 없어요')));
  assert.ok(errs.some(e => e.includes('palette.x')));
});

test('목록 index.json 이 스펙·방과 같다 (id·version·status·이름·값)', () => {
  assert.equal(index.models.length, specs.length);
  for (const s of specs) {
    const m = index.models.find(x => x.slug === s.slug);
    assert.ok(m, `목록에 ${s.slug}`);
    for (const k of ['id', 'kind', 'name', 'version', 'status']) assert.equal(m[k], s[k], `${s.slug}.${k}`);
    assert.equal(m.price ?? 0, s.price ?? 0, `${s.slug}.price`);
    assert.equal(!!m.starter, !!s.starter, `${s.slug}.starter`);
    assert.equal(!!m.shopOnly, !!s.shopOnly, `${s.slug}.shopOnly`);
    assert.ok(['review', 'approved'].includes(s.status));
  }
  assert.equal(index.rooms.length, rooms.length);
  for (const r of rooms) {
    const m = index.rooms.find(x => x.slug === r.slug);
    assert.ok(m, `목록에 ${r.slug}`);
    for (const k of ['id', 'owner', 'name', 'version', 'status', 'wallpaper', 'floor']) assert.equal(m[k], r[k], `${r.slug}.${k}`);
  }
});

test('웹 빌드가 interior 파일을 모두 넣는다 (WEB_FILES = 목록 + 스펙 + 방)', () => {
  const want = ['assets/interior/index.json', ...index.models.map(m => `assets/interior/specs/${m.slug}.json`), ...index.rooms.map(r => `assets/interior/rooms/${r.slug}.json`)];
  assert.deepEqual([...WEB_FILES].sort(), want.sort());
  const files = new Set(planWeb().files.map(f => f.path));
  for (const p of want) assert.ok(files.has(p), `빌드에 ${p}`);
});

test('주민 방 10곳: 주민마다 하나 (이사 오는 셋 포함), 보드대로 벽지·바닥, WP-08·FL-08 은 상점 한정', () => {
  const want = { coco: ['wp-02', 'fl-02'], bori: ['wp-03', 'fl-03'], mochi: ['wp-04', 'fl-04'], dubu: ['wp-05', 'fl-05'], pong: ['wp-06', 'fl-06'], chorong: ['wp-07', 'fl-07'], danpung: ['wp-01', 'fl-05'],   // 단풍 RM-07 = 실내 보드 interiors
    gureum: ['wp-01', 'fl-02'], pado: ['wp-03', 'fl-07'], dalmuri: ['wp-04', 'fl-05'] };   // P44 이사 오는 주민 RM-12–14
  const ALL = [...VILLAGERS, ...MOVERS];
  assert.equal(rooms.length, 10);
  for (const r of rooms) {
    assert.ok(ALL.includes(r.owner), `${r.slug} 주인 ${r.owner}`);
    assert.deepEqual([r.wallpaper, r.floor], want[r.owner], r.slug);
  }
  assert.equal(new Set(rooms.map(r => r.owner)).size, 10);
  assert.deepEqual(rooms.map(r => r.owner).sort(), [...ALL].sort(), '섬 주민 모두 방이 있다 (이사 오는 구름·파도·달무리까지)');
  const used = new Set(rooms.flatMap(r => [r.wallpaper, r.floor]));
  assert.ok(!used.has('wp-08') && !used.has('fl-08'));
  for (const s of specs.filter(s => s.shopOnly)) assert.ok(['wp-08', 'fl-08'].includes(s.slug));
});

test('주민 방 가구가 벽·문 매트·서로 겹치지 않고, 주민 설 자리가 비어 있다', () => {
  for (const r of rooms) assert.deepEqual(checkRoom(r, furn, { windows: WINDOWS }), [], r.slug);
  // 검사기가 겹침을 잡는다
  const bad = { host: { lx: 0.5, lz: 0.5, face: 's' }, furniture: [{ item: 'furn.sofa', gx: 0, gz: 0, rot: 0 }, { item: 'furn.log-chair', gx: 1, gz: 0, rot: 0 }, { item: 'furn.log-chair', gx: 3, gz: 7, rot: 0 }, { item: 'furn.wall-clock', wall: 'n', slot: 1 }] };
  const errs = checkRoom(bad, furn, { windows: WINDOWS });
  assert.ok(errs.some(e => e.includes('(1, 0)')), '소파와 의자 겹침');
  assert.ok(errs.some(e => e.includes('(3, 7)')), '문 매트');
  assert.ok(errs.some(e => e.includes('창문 자리')), '창문 자리 벽시계');
  assert.ok(errs.some(e => e.includes('host')), '주민 자리');
});

test('새 가구(FU-21–32)는 목록에 없으면 임시 상자, 들어오면 그 모델·발자국으로', () => {
  const fus = rooms.flatMap(r => r.furniture.filter(f => f.fu).map(f => f.fu));
  assert.deepEqual([...new Set(fus)].sort(), Array.from({ length: 12 }, (_, i) => `FU-${21 + i}`));
  for (const r of rooms) for (const f of r.furniture) {
    if (f.item) assert.ok(furn.models.some(m => m.item === f.item), `${r.slug}: ${f.item} 가 가구 목록에 있다`);
    if (f.fu) { assert.ok(Array.isArray(f.box) && f.box.length === 3 && f.box.every(n => n > 0), `${f.fu} box`); assert.match(f.color, /^#[0-9A-Fa-f]{6}$/); }
  }
  const e = { fu: 'FU-23', box: [2, 2, 0.4], color: '#9CC3EA', gx: 5, gz: 0, rot: 0 };
  const before = resolveFurniture(e, { models: [] });
  assert.equal(before.real, false);
  assert.deepEqual(before.footprint, [2, 2]);
  const after = resolveFurniture(e, { models: [{ id: 'FU-23', item: 'furn.cushion-bed', slug: 'cushion-bed', footprint: [2, 2], place: 'floor' }] });
  assert.equal(after.real, true);
  assert.equal(after.item, 'furn.cushion-bed');
  // 벽 가구 임시 상자
  const w = resolveFurniture({ fu: 'FU-27', box: [0.9, 0.12, 0.6], color: '#8C6440', wall: 'n', slot: 3 }, { models: [] });
  assert.equal(w.place, 'wall');
  assert.deepEqual(w.rec, { id: 'v0', item: 'fu:FU-27', wall: 'n', slot: 3 });
});

test('상점 오늘의 벽지·바닥: 같은 날엔 같고, 처음 가진 것은 안 팔고, 날마다 돌아간다', () => {
  const a = todayPick(index, { seed: 20261028, dayKey: '2026-10-29' });
  assert.deepEqual(a, todayPick(index, { seed: 20261028, dayKey: '2026-10-29' }));
  assert.equal(index.models.find(m => m.slug === a.wallpaper).kind, 'wallpaper');
  assert.equal(index.models.find(m => m.slug === a.floor).kind, 'floor');
  const seen = { wallpaper: new Set(), floor: new Set() };
  for (let d = 1; d <= 120; d++) {
    const p = todayPick(index, { seed: 7, dayKey: `2026-${String(1 + (d % 12)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}` });
    seen.wallpaper.add(p.wallpaper); seen.floor.add(p.floor);
  }
  assert.ok(!seen.wallpaper.has('wp-01') && !seen.floor.has('fl-01'), '처음 가진 것은 안 판다');
  assert.equal(seen.wallpaper.size, 7, '벽지 7가지 모두 언젠가 나온다 (WP-08 포함)');
  assert.equal(seen.floor.size, 7);
  assert.equal(listOf(index, 'wallpaper').length, 8);
});

test('state.house 벽지·바닥 칸: 예전 저장·모르는 slug·안 가진 것을 바로잡는다', () => {
  const old = { furniture: [] };
  assert.equal(normalizeHouse(old, index), true);
  assert.equal(old.wallpaper, DEFAULT.wallpaper);
  assert.equal(old.floor, DEFAULT.floor);
  assert.deepEqual(old.owned.sort(), ['fl-01', 'wp-01']);
  assert.equal(normalizeHouse(old, index), false, '두 번째는 그대로');
  const odd = { wallpaper: 'wp-03', floor: 'wp-02', owned: ['wp-03', 'zz-99', 'wp-02', 'wp-03'] };
  normalizeHouse(odd, index);
  assert.equal(odd.wallpaper, 'wp-03');
  assert.equal(odd.floor, 'fl-01', '벽지를 바닥 칸에 둘 수 없다');
  assert.deepEqual([...odd.owned].sort(), ['fl-01', 'wp-01', 'wp-02', 'wp-03']);
  const notOwned = { wallpaper: 'wp-08', floor: 'fl-01', owned: [] };
  normalizeHouse(notOwned, index);
  assert.equal(notOwned.wallpaper, 'wp-01', '안 가진 벽지는 기본으로');
});

test('주민 집 문: 집에 있으면 들어가고, 외출이면 잠기고, 자면 노크(town), 이사 전이면 문이 없다', () => {
  const town = at => ({ residents: () => ['coco', 'bori'], atHome: () => at });
  assert.equal(visitRule(town('home'), 'coco'), 'open');
  assert.equal(visitRule(town('out'), 'coco'), 'locked');
  assert.equal(visitRule(town('sleep'), 'coco'), null);
  assert.equal(visitRule(town('room'), 'coco'), null);
  assert.equal(visitRule(town('home'), 'danpung'), null, '입주 전');
  assert.equal(visitRule({ villagers: [] }, 'coco'), 'open', 'atHome 이 없는 town');
  assert.equal(visitRule(undefined, 'coco'), 'open');
});
