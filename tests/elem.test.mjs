// P36 요소 편집기 약속: 편집기(elem-editor/)의 모든 칸 경로가 실제 파일 칸을 가리키고, 반영 도구(tools/apply-edits.mjs elem)가
// 파일을 바르게 고르고 원래 모양대로 쓰며(바뀐 줄만 diff), 방을 고치면 interior/index.json 줄도 맞추고, 값 검사(tools/elem-checks.mjs)가
// 지금 게임 파일을 모두 통과한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { plan, elemTarget, formatLike, ELEM_FILES } from '../tools/apply-edits.mjs';
import { getAt } from '../tools/edits.mjs';
import { checkElements, TOUR_SHAPES, hourKo } from '../tools/elem-checks.mjs';
import { SHEETS, GROUPS } from '../elem-editor/sheets.js';
import { SHAPES, isletOf } from '../src/gameplay/tour/islet.js';
import { MOVING } from '../src/gameplay/town/moving.js';
import { PLACE_KINDS } from '../src/gameplay/house/placedata.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const text = p => readFileSync(`${ROOT}/${p}`, 'utf8');
const json = p => JSON.parse(text(p));
const W = {
  items: json(ELEM_FILES.items), rules: json(ELEM_FILES.rules), layout: json(ELEM_FILES.layout),
  events: json(ELEM_FILES.events), night: json(ELEM_FILES.night), tour: json(ELEM_FILES.tour),
};

test('요소 편집기 표: 탭 묶음·id 가 맞고, 모든 칸 경로가 실제 파일 칸이다', () => {
  assert.equal(new Set(SHEETS.map(s => s.id)).size, SHEETS.length, '표 id 겹침');
  for (const s of SHEETS) assert.ok(GROUPS.some(g => g.id === s.group), `${s.id}: 묶음 ${s.group}`);
  for (const g of GROUPS) assert.ok(SHEETS.some(s => s.group === g.id), `${g.id}: 빈 묶음`);
  for (const s of SHEETS.filter(s => s.object)) {
    for (const [title, rows] of s.groups(W)) for (const [path, label, type] of rows) {
      assert.ok(getAt(W, path) !== undefined, `${s.id} · ${title} · ${label}: ${path} 가 파일에 없다`);
      assert.ok(elemTarget(path), `${path}: 반영 도구가 모르는 파일`);
      assert.ok(['int', 'num', 'prob', 'pair', 'hours', 'select', 'bool', 'mmdd', 'multi'].includes(type), `${path}: 칸 종류 ${type}`);
    }
  }
  for (const s of SHEETS.filter(s => s.file)) assert.ok(Array.isArray(getAt(W, `${s.file}/${s.section}`)), `${s.id}: ${s.file}/${s.section}`);
});

test('값 검사: 지금 게임 파일은 모두 통과하고, 틀린 값은 잡는다', () => {
  const bad = checkElements(W).filter(c => !c.ok);
  assert.deepEqual(bad, [], bad.map(c => `${c.label} — ${c.why}`).join('\n'));
  const broken = structuredClone(W);
  broken.tour.ore.table[0][1] = 0.9;
  broken.night.market.hours = [22, 19];
  broken.events.list[0].start = { month: 2, day: 30 };
  broken.rules.shop.outdoorPerDay = 9;
  broken.rules.moving.boxesAfter = 5;
  const tabs = checkElements(broken).filter(c => !c.ok).map(c => c.tab);
  for (const t of ['tour', 'night', 'events', 'shop', 'moving']) assert.ok(tabs.includes(t), `${t} 검사가 틀린 값을 못 잡았다`);
  assert.equal(hourKo(27), '새벽 3시');
  assert.equal(hourKo(24), '자정');
  assert.equal(hourKo(19), '저녁 7시');
});

test('투어 섬 모양 이름 = islet.js SHAPES, tour.json shapes 로 나오는 모양을 고른다', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.name])), TOUR_SHAPES);
  for (let t = 0; t < 12; t++) assert.equal(isletOf('2027-05-01', t, 7, ['TO-02']).shape, 'TO-02');
  assert.ok(Object.keys(SHAPES).includes(isletOf('2027-05-01', 0, 7, ['없는 모양']).shape), '모르는 모양뿐이면 전부에서 고른다');
  assert.deepEqual(isletOf('2027-05-01', 3, 7), isletOf('2027-05-01', 3, 7, W.tour.shapes), 'tour.json 기본 = 넷 모두 = 예전과 같은 섬');
});

test('이사 숫자는 rules.json moving 에서 온다', () => {
  for (const [k, v] of Object.entries(W.rules.moving)) assert.deepEqual(MOVING[k], v, `moving.${k}`);
  assert.ok(Object.isFrozen(MOVING));
});

test('반영 도구 elem: 경로 첫 칸으로 파일을 고르고, 방·가게는 slug 파일, 모르는 파일은 쓰지 않는다', () => {
  assert.deepEqual(elemTarget('rooms/rm-01/furniture'), { key: 'rooms/rm-01', file: 'assets/interior/rooms/rm-01.json', sub: 'furniture' });
  assert.deepEqual(elemTarget('places/shop/keeper'), { key: 'places/shop', file: 'assets/interior/places/shop.json', sub: 'keeper' });
  assert.equal(elemTarget('night/market/weekday').file, 'assets/night/night.json');
  assert.equal(elemTarget('nope/x'), null);
  assert.equal(elemTarget('rooms/../x'), null);
  for (const k of PLACE_KINDS) assert.ok(text(`assets/interior/places/${k}.json`));

  const rm = json('assets/interior/rooms/rm-01.json');
  const moved = rm.furniture.map((f, i) => (i === rm.furniture.length - 1 ? { ...f, gx: Math.max(0, f.gx - 1) } : f));
  const p = plan('elem', {
    'tour/ticket/price': 800, 'night/market/weekday': 5, 'night/market/stalls/festival-booth-food/prices/night.cocoa': 150,
    'night/tarot/cards/TA-01/luck/sell': 0.2, 'events/list/spring/todo/petals/goal': 8, 'rules/moving/max': 11,
    'rooms/rm-01/furniture': moved, 'rooms/rm-01/name': '해변 쉼터', 'layout/shop': [0.7, 0.55],
  });
  assert.deepEqual(p.errors, []);
  assert.equal(p.files.tour.after.ticket.price, 800);
  assert.equal(p.files.tour.after.version, W.tour.version + 1);
  assert.equal(p.files.night.after.market.weekday, 5);
  assert.equal(p.files.night.after.market.stalls.find(s => s.kind === 'festival-booth-food').prices['night.cocoa'], 150);
  assert.equal(p.files.night.after.tarot.cards.find(c => c.id === 'TA-01').luck.sell, 0.2);
  assert.equal(p.files.events.after.list.find(e => e.slug === 'spring').todo.find(t => t.id === 'petals').goal, 8);
  assert.equal(p.files.rules.after.moving.max, 11);
  assert.deepEqual(p.files.layout.after.shop, [0.7, 0.55]);
  assert.equal(p.files['rooms/rm-01'].after.version, rm.version + 1);
  const ix = p.files['interior-index'];
  assert.ok(ix && ix.keepVersion, '방을 고치면 interior/index.json 줄도');
  const row = ix.after.rooms.find(r => r.slug === 'rm-01');
  assert.equal(row.name, '해변 쉼터');
  assert.equal(row.version, rm.version + 1);

  const bad = plan('elem', { 'tour/ticket/price': 900, 'tour/nope/x': 1, 'zzz/a': 1, 'rooms/rm-99/name': 'x' });
  assert.equal(bad.errors.length, 3, JSON.stringify(bad.errors));
  // 예전 명령 모양도 그대로 (map: 파일 이름 없는 경로, data: items·rules)
  assert.deepEqual(plan('map', { shop: [0.7, 0.55] }).errors, []);
  assert.deepEqual(plan('data', { 'rules/shop/open': 9 }).errors, []);
});

test('원래 모양대로 쓰기: 바뀐 칸만 글이 바뀐다 (한 줄 줄은 한 줄로, 섞인 파일도)', () => {
  for (const [file, change] of [
    ['assets/interior/index.json', o => { o.rooms[0].version += 1; }],
    ['assets/tour/tour.json', o => { o.ticket.price = 800; }],
    ['assets/interior/rooms/rm-01.json', o => { o.furniture.at(-1).gx -= 1; o.version += 1; }],
    ['assets/night/night.json', o => { o.market.weekday = 5; }],
    ['assets/data/items.json', o => { o.fish[0].price = 170; }],
  ]) {
    const src = text(file).replace(/\r\n/g, '\n');
    assert.equal(formatLike(src, JSON.parse(src)), src.endsWith('\n') ? src : src + '\n', `${file}: 그대로 쓰면 글자 하나 안 바뀐다`);
    const obj = JSON.parse(src);
    change(obj);
    const out = formatLike(src, obj);
    assert.deepEqual(JSON.parse(out), obj, `${file}: 값`);
    const a = src.split('\n'), b = out.split('\n');
    assert.equal(a.length, b.length, `${file}: 줄 수가 그대로`);
    const diff = a.filter((l, i) => l !== b[i]).length;
    assert.ok(diff >= 1 && diff <= 2, `${file}: 바뀐 줄 ${diff}`);
  }
});

test('게시 파일 목록(elem-editor/files.json)이 편집기가 import 하는 모듈·읽는 방 파일을 모두 담는다', async () => {
  const { readdirSync, existsSync } = await import('node:fs');
  const posix = (await import('node:path')).posix;
  const F = json('elem-editor/files.json');
  const seen = new Set();
  const walk = f => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of text(f).matchAll(/from '(\.[^']+)'/g)) walk(posix.normalize(posix.join(posix.dirname(f), m[1])));
  };
  walk('elem-editor/main.js');
  for (const f of seen) assert.ok(F.modules.includes(f), `${f} 가 게시 목록에 없다 (게시본에서 404)`);
  for (const f of [...F.modules, ...F.assets, F.page]) assert.ok(existsSync(`${ROOT}/${f}`), `${f} 파일이 없다`);
  for (const d of ['rooms', 'places']) for (const f of readdirSync(`${ROOT}/assets/interior/${d}`)) assert.ok(F.assets.includes(`assets/interior/${d}/${f}`), `${d}/${f}`);
  assert.ok(F.modules.length + F.assets.length + 1 < 511, '아티팩트 한 버전 파일 511개 안');
});
