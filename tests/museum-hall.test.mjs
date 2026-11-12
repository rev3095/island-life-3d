// 요청 9 박물관 재단장·증축 (관 여섯 RM-25–30) · 요청 8 별자리 (IC-ST-01–12) 규칙 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { HALL_FILES, HALLS, hallPlan, hallStatus, archesOf, lineSlots, checkHall, framesOf, signText } from '../src/gameplay/house/museum-hall-data.js';
import { checkPlace } from '../src/gameplay/house/placedata.js';
import * as items from '../src/data/items.js';
import { CONSTELLATIONS, inSeason, aimCheck, aimTarget, dirOf, azAltOf, starDir, radiusOf, fieldStars, defaultShot, isStarHour, visibleNow, CAPTURE, FOV } from '../src/sky/starmap.js';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const furnIndex = { models: [...J('assets/furniture/index.json').models, ...J('assets/furniture/fixtures/index.json').models] };
const lists = Object.fromEntries(['fish', 'bug', 'fossil', 'sea', 'art'].map(c => [c, items.list(c).map(it => ({ id: it.id, artKind: it.artKind }))]));
const halls = HALL_FILES.map(J);

test('관 여섯: 파일 · id RM-25–30 · 배치 검사 · 전시 자리 = 아이템 수', () => {
  assert.deepEqual(halls.map(h => h.hall), HALLS);
  assert.deepEqual(halls.map(h => h.id), ['RM-25', 'RM-26', 'RM-27', 'RM-28', 'RM-29', 'RM-30']);
  for (const h of halls) assert.deepEqual(checkHall(h, { checkPlace, furnIndex, lists }), [], `${h.hall}`);
});

test('로비 RM-09: 배치 검사 통과 · 아치 여섯이 관마다 하나 · 안내판·아치 앞이 방 안', () => {
  const lobby = J('assets/interior/places/museum.json');
  assert.deepEqual(checkPlace(lobby, furnIndex), []);
  const arches = archesOf(lobby);
  assert.deepEqual(arches.map(a => a.hall).sort(), [...HALLS].sort());
  const [w, d] = lobby.size;
  for (const a of arches) for (const p of [a.door, a.sign]) assert.ok(p.lx > 0 && p.lx < w && p.lz > 0 && p.lz < d - 1, `${a.hall} 자리`);
});

test('전시 자리: 아이템 표 순서로 늘 같고, 기증한 것만 donated · 아이템이 많아지면 줄이 촘촘해진다', () => {
  const fish = halls[0];
  const has = id => id === lists.fish[0].id;
  const a = hallPlan(fish, lists, has), b = hallPlan(fish, lists, has);
  assert.deepEqual(a, b);
  assert.equal(a.filter(e => e.donated).length, 1);
  const many = { ...lists, fish: Array.from({ length: 80 }, (_, i) => ({ id: `fish.x${i}` })) };
  assert.equal(hallPlan(fish, many).length, 80);
  assert.equal(lineSlots({ x0: 0, x1: 3, z0: 0, z1: 1, levels: [0.8, 1.2] }, 6).length, 6);
});

test('곧 열려요: 분류에 아이템이 없으면 soon, 생기면 저절로 채워짐 (sea · art)', () => {
  const sea = halls[3], art = halls[4];
  assert.equal(hallStatus(sea, { sea: [] }).soon, true);
  assert.match(signText(sea, hallStatus(sea, { sea: [] })), /곧 열려요/);
  const fake = { sea: [{ id: 'sea.octopus' }, { id: 'sea.star' }] };
  assert.equal(hallStatus(sea, fake).soon, false);
  assert.equal(hallPlan(sea, fake, () => true).length, 2);
  const arts = { art: [...Array.from({ length: 10 }, (_, i) => ({ id: `art.p${i}`, artKind: 'painting' })), ...Array.from({ length: 6 }, (_, i) => ({ id: `art.s${i}`, artKind: 'sculpture' }))] };
  const plan = hallPlan(art, arts);
  assert.equal(plan.length, 16);
  assert.ok(plan.filter(e => e.kind === 'frames').every(e => e.id.startsWith('art.p')), '그림은 액자에');
  assert.ok(plan.filter(e => e.kind === 'spots').every(e => e.id.startsWith('art.s')), '조각은 받침에');
});

test('별자리관: 액자 열둘 = 별자리 12개', () => {
  assert.equal(framesOf(halls[5]).length, 12);
});

test('별자리 12개: id · 계절마다 셋 · 선이 별을 가리킴 · 하늘 위', () => {
  assert.deepEqual(CONSTELLATIONS.map(c => c.id), Array.from({ length: 12 }, (_, i) => `IC-ST-${String(i + 1).padStart(2, '0')}`));
  for (const s of ['spring', 'summer', 'autumn', 'winter']) assert.equal(inSeason(s).length, 3, s);
  assert.equal(new Set(CONSTELLATIONS.map(c => c.name)).size, 12);
  for (const c of CONSTELLATIONS) {
    for (const [a, b] of c.lines) assert.ok(c.stars[a] && c.stars[b], `${c.id} 선`);
    for (let i = 0; i < c.stars.length; i++) assert.ok(starDir(c, i)[1] > 0.2, `${c.id} 별 ${i} 가 지평선 가까이`);
    const r = azAltOf(dirOf(c.az, c.alt));
    assert.ok(Math.abs(r.az - c.az) < 1e-6 && Math.abs(r.alt - c.alt) < 1e-6);
    // 기본 시야(전시·견본)는 바로 찍히는 크기
    assert.ok(aimCheck(defaultShot(c), c).ok, `${c.id} 기본 시야`);
    assert.ok(radiusOf(c) / FOV.max < CAPTURE.hi && radiusOf(c) / FOV.min > CAPTURE.lo, `${c.id} 줌 범위 안에서 찍을 수 있다`);
  }
});

test('찍기 판정: 가운데·크기 · 밤에만 · 바탕 별은 dome 과 같은 씨앗', () => {
  const c = CONSTELLATIONS[0];
  assert.equal(aimCheck({ az: c.az, alt: c.alt, fov: radiusOf(c) / 0.3 }, c).ok, true);
  assert.equal(aimCheck({ az: c.az + 40, alt: c.alt, fov: 40 }, c).why, 'off');
  assert.equal(aimCheck({ az: c.az, alt: c.alt, fov: 70 }, c).why, 'small');
  assert.equal(aimCheck({ az: c.az, alt: c.alt, fov: 10 }, c).why, 'big');
  assert.equal(aimTarget({ az: c.az, alt: c.alt, fov: 40 }, inSeason('spring')).c.id, c.id);
  assert.equal(isStarHour(22), true);
  assert.equal(isStarHour(12), false);
  assert.equal(visibleNow({ season: 'winter', hourF: 3 }).length, 3);
  assert.equal(visibleNow({ season: 'winter', hourF: 9 }).length, 0);
  assert.equal(fieldStars().length, 3600);
});

test('하늘 고리: dome·sky 는 짧은 고리만, 별자리 파일은 웹 빌드·편집기 목록에 잡힌다', () => {
  const dome = readFileSync(new URL('../src/sky/dome.js', import.meta.url), 'utf8');
  assert.match(dome, /starPoints: stars/);
  const sky = readFileSync(new URL('../src/sky/index.js', import.meta.url), 'utf8');
  assert.match(sky, /createStarSky\(dome\)/);
  for (const f of HALL_FILES) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  const files = J('assets/style/editor-files.json');
  const flat = JSON.stringify(files);
  assert.ok(flat.includes('src/sky/stars.js') && flat.includes('src/sky/starmap.js'));
});
