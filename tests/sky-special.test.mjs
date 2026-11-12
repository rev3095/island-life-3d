// M18-P2 하늘·그날만 날씨 (15차 보드 D192-A · D193-A · D197-A): src/sky/special.js 날짜 규칙 · 예보 덮기 · 첫눈 쌓임 ·
// 큰 유성우 밤(daily) · 별자리 +6 · 장면 s30–s32 · 비 오는 날 생물 · 첫눈 레시피 · 사양 표
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as SP from '../src/sky/special.js';
import { forecast, weatherAt } from '../src/sky/weather.js';
import * as R from '../src/gameplay/daily/rules.js';
import { CONSTELLATIONS, inSeason, angleBetween, dirOf, radiusOf, starDir } from '../src/sky/starmap.js';
import { TRIGGERS, SPECIAL_KINDS, validateScene as checkScene } from '../src/gameplay/story/rules.js';
import { createRecipes, LOCKED, RECIPES } from '../src/data/recipes.js';
import { createInventory } from '../src/data/inventory.js';
import { createState } from '../src/core/state.js';
import * as items from '../src/data/items.js';
import { bugPool } from '../src/data/spawns.js';
import { seasonOf } from '../src/core/constants.js';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const cfg = J('assets/daily/daily.json');
const wd = k => new Date(`${k}T00:00:00Z`).getUTCDay();

test('그날만 날: 해마다 규칙대로 (장마 6월 셋째 수 · 태풍 9월 둘째 일 · 다음 날 월 · 첫눈 12월 첫째 토 · 큰 유성우 8·12월 둘째 토)', () => {
  for (let y = 2026; y <= 2040; y++) {
    const [mon] = SP.daysOf(y, 'monsoon'), [ty] = SP.daysOf(y, 'typhoon'), [after] = SP.daysOf(y, 'after-typhoon'), [snow] = SP.daysOf(y, 'first-snow');
    const big = SP.daysOf(y, 'big-meteor');
    assert.equal(mon.slice(5, 7), '06'); assert.equal(wd(mon), 3); assert.ok(+mon.slice(8) >= 15 && +mon.slice(8) <= 21, mon);
    assert.equal(ty.slice(5, 7), '09'); assert.equal(wd(ty), 0); assert.ok(+ty.slice(8) >= 8 && +ty.slice(8) <= 14, ty);
    assert.equal(after, R.addDays(ty, 1)); assert.equal(wd(after), 1);
    assert.equal(snow.slice(5, 7), '12'); assert.equal(wd(snow), 6); assert.ok(+snow.slice(8) <= 7, snow);
    assert.deepEqual(big.map(d => d.slice(5, 7)).sort(), ['08', '12']);
    for (const d of big) { assert.equal(wd(d), 6); assert.ok(+d.slice(8) >= 8 && +d.slice(8) <= 14, d); }
    assert.equal(R.daysBetween(snow, big.find(d => d.slice(5, 7) === '12')), 7, '12월 큰 유성우는 첫눈 한 주 뒤');
    assert.equal(Object.keys(SP.specialDays(y)).length, 6, '여섯 날이 서로 안 겹친다');
  }
  assert.deepEqual(SP.specialDays(2027), { '2027-06-16': 'monsoon', '2027-09-12': 'typhoon', '2027-09-13': 'after-typhoon', '2027-12-04': 'first-snow', '2027-08-14': 'big-meteor', '2027-12-11': 'big-meteor' });
  assert.equal(SP.specialOf('2027-06-15'), null);
  assert.equal(SP.specialOf('2027-06-16').heavy, true);
  assert.equal(SP.specialOf('2027-09-12').heavy, true);
  assert.equal(SP.specialOf('2027-12-04').heavy, false);
});

test('예보 덮기: 장마·태풍 하루 종일 비 · 태풍 다음 날 맑음 · 첫눈 8시부터 눈 · 큰 유성우 17시부터 맑음 · 12월 첫눈 전엔 눈 대신 흐림', () => {
  const fc = (k, seed = 3) => SP.applySpecial(k, forecast(k, seasonOf(+k.slice(5, 7)), seed));
  for (const h of [5, 9, 14, 22, 28]) {
    assert.equal(weatherAt(fc('2027-06-16'), h), 'rain');
    assert.equal(weatherAt(fc('2027-09-12'), h), 'rain');
    assert.equal(weatherAt(fc('2027-09-13'), h), 'clear');
  }
  assert.equal(weatherAt(fc('2027-12-04'), 7), 'cloudy');
  assert.equal(weatherAt(fc('2027-12-04'), 8.5), 'snow');
  assert.equal(weatherAt(fc('2027-12-04'), 27), 'snow');
  for (let seed = 0; seed < 40; seed++) {
    const segs = fc('2027-08-14', seed);
    for (const h of [17, 20, 23, 27]) assert.equal(weatherAt(segs, h), 'clear', `seed ${seed} ${h}시`);
    assert.equal(segs[0].from, 5);
    for (const k of ['2027-12-01', '2027-12-02', '2027-12-03']) assert.ok(!fc(k, seed).some(s => s.weather === 'snow'), `${k} seed ${seed}`);
  }
  let after = 0;
  for (let seed = 0; seed < 40; seed++) for (const k of ['2027-12-15', '2027-12-16', '2027-12-17']) after += fc(k, seed).some(s => s.weather === 'snow') ? 1 : 0;
  assert.ok(after > 0, '첫눈 뒤엔 눈 오는 날이 있다');
  const base = forecast('2027-04-10', 'spring', 9);
  assert.deepEqual(SP.applySpecial('2027-04-10', base), base);
  assert.notEqual(SP.applySpecial('2027-04-10', base), base);
});

test('FX-04 첫눈 쌓임: 8시 0 → 14시 1, 밤(0–5시)도 1, 다른 날은 null', () => {
  assert.equal(SP.snowDepthAt('2027-12-04', 7), 0);
  assert.equal(SP.snowDepthAt('2027-12-04', 8), 0);
  assert.equal(SP.snowDepthAt('2027-12-04', 11), 0.5);
  assert.equal(SP.snowDepthAt('2027-12-04', 14), 1);
  assert.equal(SP.snowDepthAt('2027-12-04', 2), 1);
  assert.equal(SP.snowDepthAt('2027-12-05', 12), null);
});

test('큰 유성우 밤: 설정 · 별 조각 두 배(최대 여섯) · 트리거 meteor-big', () => {
  const big = { ...cfg.meteor, ...cfg.bigMeteor };
  assert.equal(R.starsForWishes(3, cfg.meteor), 3);
  assert.equal(R.starsForWishes(3, big), 6);
  assert.equal(R.starsForWishes(1, big), 2);
  for (const k of ['notice', 'noticeNoOwl', 'start']) assert.ok(cfg.bigMeteor[k], k);
  assert.equal(TRIGGERS['meteor-big'].event, 'daily:meteor');
  assert.equal(TRIGGERS['meteor-big'].test({ bigFirst: true }), true);
  assert.equal(TRIGGERS['meteor-big'].test({ first: true }), false);
  assert.equal(TRIGGERS['special-day'].test({ kind: 'monsoon', first: true }, { kind: 'monsoon' }), true);
  assert.equal(TRIGGERS['special-day'].test({ kind: 'monsoon', first: true }, { kind: 'first-snow' }), false);
  const src = readFileSync(new URL('../src/gameplay/daily/meteor.js', import.meta.url), 'utf8');
  assert.match(src, /isSpecial\(n\.dayKey, 'big-meteor'\)/, '큰 유성우 밤은 그 주 유성우 날과 상관없이');
  assert.match(src, /meteors\?\.set\?\.\(on, \{ big \}\)/);
  assert.match(readFileSync(new URL('../src/sky/meteors.js', import.meta.url), 'utf8'), /BIG_METEOR = 2/);
});

test('별자리 +6 (IC-ST-13–18): 계절마다 1–2개 · 같은 계절끼리 안 겹침 · 별이 지평선 위', () => {
  const added = CONSTELLATIONS.slice(12);
  assert.deepEqual(added.map(c => c.id), ['IC-ST-13', 'IC-ST-14', 'IC-ST-15', 'IC-ST-16', 'IC-ST-17', 'IC-ST-18']);
  for (const s of ['spring', 'summer', 'autumn', 'winter']) {
    const n = added.filter(c => c.season === s).length;
    assert.ok(n >= 1 && n <= 2, s);
    const l = inSeason(s);
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++)
      assert.ok(angleBetween(dirOf(l[i].az, l[i].alt), dirOf(l[j].az, l[j].alt)) > radiusOf(l[i]) + radiusOf(l[j]) + 3, `${l[i].name}·${l[j].name} 겹침`);
  }
  for (const c of added) for (let i = 0; i < c.stars.length; i++) assert.ok(starDir(c, i)[1] > 0.2, `${c.name} ${i}`);
});

test('장면 s30–s32: 검사 통과 · 트리거 · 목록 셋에 들어 있음', () => {
  const ids = ['s30-monsoon-day', 's31-big-meteor', 's32-first-snow'];
  const files = readFileSync(new URL('../src/gameplay/story/files.js', import.meta.url), 'utf8');
  const index = J('assets/story/index.json'), editor = J('assets/story/editor-files.json');
  for (const id of ids) {
    const sc = J(`assets/story/scenes/${id}.json`);
    assert.deepEqual(checkScene(sc), [], id);
    assert.ok(files.includes(`scenes/${id}.json`), `files.js ${id}`);
    assert.ok(index.timeline.some(t => t.scene === id), `index.json ${id}`);
    assert.ok(JSON.stringify(editor).includes(`${id}.json`), `editor-files ${id}`);
  }
  assert.equal(J('assets/story/scenes/s30-monsoon-day.json').trigger.kind, 'monsoon');
  assert.equal(J('assets/story/scenes/s32-first-snow.json').trigger.kind, 'first-snow');
  assert.equal(J('assets/story/scenes/s31-big-meteor.json').trigger.on, 'meteor-big');
  for (const k of Object.keys(SPECIAL_KINDS)) assert.ok(SP.SPECIAL_NAME[k], k);
});

test('장마 하루: 비 오는 날 생물(청개구리 IC-BG-25 · 달팽이) 가중치 · 우산 · 태풍 다음 날 떠밀려 온 것', () => {
  const frog = items.get('bug.tree-frog');
  assert.ok(frog && frog.rainOnly && frog.months.includes(6), '청개구리 = 비 올 때 · 여름');
  assert.ok(existsSync(new URL('../assets/items/models/bug-tree-frog.glb.json', import.meta.url)));
  assert.ok(existsSync(new URL('../assets/items/renders/bug-tree-frog_thumb.png', import.meta.url)));
  const at = rainBoost => bugPool({ place: 'ground', hour: 10, month: 6, weather: 'rain', rainBoost });
  const w = (pool, id) => pool.find(e => e.item.id === id)?.weight ?? 0;
  const one = at(1), three = at(cfg.special.monsoon.rainBoost);
  assert.ok(w(one, 'bug.tree-frog') > 0);
  assert.equal(w(three, 'bug.tree-frog'), w(one, 'bug.tree-frog') * 3);
  assert.equal(bugPool({ place: 'ground', hour: 10, month: 6, weather: 'clear' }).some(e => e.item.id === 'bug.tree-frog'), false);
  const A = cfg.special.afterTyphoon;
  assert.ok(A.count >= 10);
  for (const d of A.drops) assert.ok(items.get(d.item), d.item);
  assert.match(readFileSync(new URL('../src/gameplay/town/umbrella.js', import.meta.url), 'utf8'), /mergeGeometries/);
});

test('첫눈 레시피: 쪽지 차례(LOCKED)엔 안 들고 lockedSpecial 로만 · 재료가 모두 아이템', () => {
  const id = cfg.special.firstSnow.recipe;
  const r = RECIPES.find(x => x.id === id);
  assert.ok(r && r.unlock && r.special === 'first-snow');
  assert.ok(!LOCKED.includes(id));
  for (const n of r.needs) assert.ok(items.get(n.id), n.id);
  const known = [];
  const rc = createRecipes(createInventory(createState()), { known: k => known.includes(k) });
  assert.ok(!rc.locked().includes(id));
  assert.deepEqual(rc.lockedSpecial('first-snow'), [id]);
  known.push(id);
  assert.deepEqual(rc.lockedSpecial('first-snow'), []);
  assert.ok(rc.isOpen(id));
});

test('사양 (D197-A): 굵은 비 겹·발자국 — 낮음·매우 낮음은 새 셰이더 겹 없음, 발자국은 판', () => {
  const src = readFileSync(new URL('../src/sky/precip.js', import.meta.url), 'utf8');
  const HQ = Function(`return ${/HEAVY_QUALITY = (\{[^;]+\});/.exec(src)[1]}`)();
  assert.ok(HQ.high.layer > 0 && HQ.mid.layer > 0);
  assert.equal(HQ.low.layer, 0); assert.equal(HQ.min.layer, 0);
  const fp = readFileSync(new URL('../src/sky/footprints.js', import.meta.url), 'utf8');
  assert.match(fp, /MeshBasicMaterial/);
  assert.doesNotMatch(fp, /ShaderMaterial/, '발자국은 판 (새 셰이더 없음)');
});
