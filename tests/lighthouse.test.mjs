// M19-P4 등대 다시 켜기 — 규칙 (src/gameplay/lighthouse/rules.js) · 설정 (assets/lighthouse/lighthouse.json) · 장면 s54–s61 · 자리
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as R from '../src/gameplay/lighthouse/rules.js';
import { TRIGGERS, PLACES, scenesFor } from '../src/gameplay/story/rules.js';
import { SCENE_FILES } from '../src/gameplay/story/files.js';
import { generateIsland, createIslandApi, lotsOf, BUILDING_KINDS } from '../src/world/island.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const cfg = J('assets/lighthouse/lighthouse.json');
const ALL = ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'danpung', 'gureum', 'pado', 'dalmuri'];
const ITEMS = {
  'mat.stone': { category: 'mat', price: 75, name: '돌' }, 'mat.wood': { category: 'mat', price: 60, name: '나무' }, 'mat.hardwood': { category: 'mat', price: 60, name: '단단한 나무' },
  'mat.iron': { category: 'mat', price: 375, name: '철광석' }, 'mat.clay': { category: 'mat', price: 100, name: '점토' },
  'mat.star-yellow': { category: 'mat', price: 300 }, 'mat.star-pink': { category: 'mat', price: 300 },
  'shell.clam': { category: 'shell', price: 60 }, 'shell.scallop': { category: 'shell', price: 120 },
  'flower.tulip-red': { category: 'flower', price: 20 }, 'flower.cosmos-white': { category: 'flower', price: 20 },
};
const getItem = id => ITEMS[id] ?? null;
/** 단계 하나를 끝낼 만큼 넉넉한 가방 */
const fullBag = () => [
  { id: 'mat.stone', count: 30 }, { id: 'mat.wood', count: 30 }, { id: 'mat.hardwood', count: 10 }, { id: 'mat.iron', count: 10 }, { id: 'mat.clay', count: 5 },
  { id: 'mat.star-yellow', count: 2 }, { id: 'mat.star-pink', count: 2 }, { id: 'shell.clam', count: 4 }, { id: 'shell.scallop', count: 4 },
  { id: 'flower.tulip-red', count: 6 }, { id: 'flower.cosmos-white', count: 6 },
];
const helpAll = (st, residents = ALL) => { for (const h of R.helpersOf(R.stageNow(cfg, st), residents)) st.helped[h] = true; };

test('설정: 단계 다섯 · id·장면 겹침 없음 · 재료 · 돕는 주민 후보 · 7일 간격 (D206-A)', () => {
  assert.equal(cfg.stages.length, 5);
  assert.deepEqual(cfg.stages.map(s => s.id), ['path', 'stairs', 'lens', 'lantern', 'night']);
  assert.deepEqual(cfg.stages.map(s => s.n), [1, 2, 3, 4, 5]);
  assert.equal(cfg.gapDays, 7);
  for (const s of cfg.stages) {
    assert.ok(s.needs.length >= 1, s.id);
    for (const n of s.needs) assert.ok((n.id || n.category || n.prefix) && n.n > 0, `${s.id} 재료 모양`);
    assert.ok(s.helpers.length >= 3, `${s.id}: 후보가 둘보다 많아야 한 명이 떠나도 둘`);
    assert.equal(R.helpersOf(s, ALL).length, 2, s.id);
    for (const h of R.helpersOf(s, ALL)) assert.ok(s.ask[h], `${s.id}: ${h} 대사`);
  }
  // 주민 열 명이 모두 한 번 이상 돕는다
  const who = new Set(cfg.stages.flatMap(s => R.helpersOf(s, ALL)));
  assert.equal(who.size, 10);
  // 실제 아이템 id 인지 (재료 id 는 items.json mats)
  const mats = new Set(J('assets/data/items.json').mats.map(m => `mat.${m.slug}`));
  for (const s of cfg.stages) for (const n of s.needs) if (n.id) assert.ok(mats.has(n.id), n.id);
});

test('설정 ↔ 모델·스펙: 등대 셋 · 소품 넷이 배경 목록에 있고 확정 (M20)', () => {
  const env = new Map(J('assets/env/index.json').models.map(m => [m.slug, m]));
  for (const slug of cfg.assets.env) {
    assert.ok(env.has(slug), slug);
    assert.ok(existsSync(new URL(`../assets/env/models/${slug}.glb.json`, import.meta.url)), `${slug} 모델`);
    assert.equal(J(`assets/env/specs/${slug}.json`).status, 'approved', slug);
  }
  for (const k of Object.values(cfg.models)) assert.ok(cfg.assets.env.includes(k), k);
  for (const p of cfg.props) assert.ok(cfg.assets.env.includes(p.env), p.env);
  assert.deepEqual(cfg.props.map(p => J(`assets/env/specs/${p.env}.json`).id), ['PR-41', 'PR-42', 'PR-43', 'PR-44']);
  assert.deepEqual(Object.values(cfg.models).map(k => J(`assets/env/specs/${k}.json`).id), ['BD-18-1', 'BD-18-2', 'BD-18-3']);
});

test('시작: 엔딩 다음 날부터 · 구름이 살 때 · 14일 지나도 안 오면 코코', () => {
  const ended = '2027-04-01';
  assert.equal(R.startHost(cfg, { endedDay: null, dayKey: '2027-04-05', residents: ALL }), null, '엔딩 전');
  assert.equal(R.startHost(cfg, { endedDay: ended, dayKey: ended, residents: ALL }), null, '엔딩 날');
  assert.equal(R.startHost(cfg, { endedDay: ended, dayKey: '2027-04-02', residents: ALL }), 'gureum');
  const noGureum = ALL.filter(s => s !== 'gureum');
  assert.equal(R.startHost(cfg, { endedDay: ended, dayKey: '2027-04-10', residents: noGureum }), null, '구름을 기다림');
  assert.equal(R.startHost(cfg, { endedDay: ended, dayKey: '2027-04-15', residents: noGureum }), 'coco', '14일 뒤엔 코코');
});

test('단계: 처음엔 시작한 날 열림 → 끝내면 7일 뒤 다음 단계 → 다섯 뒤 밤 → 불 켬 → 아침', () => {
  const st = R.fresh();
  assert.equal(R.phase(cfg, st, '2027-04-02'), 'closed');
  st.started = '2027-04-02';
  assert.equal(R.phase(cfg, st, '2027-04-02'), 'work', '시작한 날 바로 1단계');
  let day = '2027-04-02';
  for (let k = 0; k < 5; k++) {
    assert.equal(R.phase(cfg, st, day), 'work', `${k + 1}단계 열림`);
    helpAll(st);
    const res = R.canFinish(cfg, st, day, { slots: fullBag(), getItem, residents: ALL });
    assert.ok(res.ok, `${k + 1}단계 끝낼 수 있음 ${res.why}`);
    const done = R.finishStage(cfg, st, day);
    assert.equal(done.n, k + 1);
    assert.deepEqual(st.helped, {}, '도움은 단계마다 새로');
    if (k < 4) {
      for (let d = 1; d < 7; d++) {
        const dk = R.addDays(day, d);
        assert.equal(R.phase(cfg, st, dk), 'wait', `${k + 1}단계 뒤 ${d}일째는 기다림`);
        assert.equal(R.daysLeft(cfg, st, dk), 7 - d);
      }
      day = R.addDays(day, 7);
      assert.equal(R.openDay(cfg, st), day);
    }
  }
  assert.equal(st.stage, 5);
  assert.equal(R.phase(cfg, st, day), 'night');
  assert.ok(R.isNight(cfg, 21) && R.isNight(cfg, 2) && !R.isNight(cfg, 12) && !R.isNight(cfg, 4.5));
  assert.ok(R.light(st, day));
  assert.equal(R.phase(cfg, st, day), 'lit');
  st.morning = R.addDays(day, 1);
  assert.equal(R.phase(cfg, st, st.morning), 'done');
  assert.equal(R.daysBetween('2027-04-02', day), 28, '처음부터 불 켜는 날까지 4주 (D206-A 「약 3~4주」)');
});

test('단계: 재료가 모자라거나 도움이 덜 오면 못 끝냄 · 7일 안에 다시 못 함', () => {
  const st = { ...R.fresh(), started: '2027-04-02' };
  assert.equal(R.canFinish(cfg, st, '2027-04-02', { slots: [], getItem, residents: ALL }).why, 'needs');
  assert.equal(R.canFinish(cfg, st, '2027-04-02', { slots: fullBag(), getItem, residents: ALL }).why, 'helpers');
  st.helped.dubu = true;
  assert.equal(R.canFinish(cfg, st, '2027-04-02', { slots: fullBag(), getItem, residents: ALL }).why, 'helpers', '한 명만');
  st.helped.pong = true;
  assert.ok(R.canFinish(cfg, st, '2027-04-02', { slots: fullBag(), getItem, residents: ALL }).ok);
  R.finishStage(cfg, st, '2027-04-02');
  helpAll(st);
  assert.equal(R.canFinish(cfg, st, '2027-04-05', { slots: fullBag(), getItem, residents: ALL }).why, 'phase', '3일 뒤엔 아직');
  assert.ok(R.canFinish(cfg, st, '2027-04-09', { slots: fullBag(), getItem, residents: ALL }).ok, '7일 뒤엔 됨');
  // 섬을 떠난 주민 대신 다음 후보
  assert.deepEqual(R.helpersOf(cfg.stages[0], ALL.filter(s => s !== 'dubu')), ['pong', 'coco']);
});

test('재료: 분류·앞부분으로 세고, 가져갈 땐 싼 것부터 · 모자라면 null', () => {
  const lens = cfg.stages.find(s => s.id === 'lens');
  const rows = R.needsOf(lens, [{ id: 'shell.scallop', count: 3 }, { id: 'shell.clam', count: 2 }, { id: 'mat.clay', count: 5 }], getItem);
  assert.deepEqual(rows.map(r => [r.label, r.have, r.n, r.ok]), [['조개껍데기', 5, 6, false], ['점토', 3, 3, true]]);
  const plan = R.takePlan(lens, [{ id: 'shell.scallop', count: 4 }, { id: 'shell.clam', count: 4 }, { id: 'mat.clay', count: 5 }], getItem);
  assert.deepEqual(plan, [{ id: 'shell.clam', n: 4 }, { id: 'shell.scallop', n: 2 }, { id: 'mat.clay', n: 3 }], '바지락(60)부터');
  assert.equal(R.takePlan(lens, [{ id: 'shell.clam', count: 1 }], getItem), null);
  const lantern = cfg.stages.find(s => s.id === 'lantern');
  assert.deepEqual(R.needsOf(lantern, [{ id: 'mat.star-yellow', count: 1 }, { id: 'mat.star-pink', count: 2 }, { id: 'mat.iron', count: 3 }], getItem).map(r => r.ok), [true, true], '별 조각은 색 상관없이');
  // 같은 재료를 두 칸이 같이 원하면(나무) 합쳐서 센다
  const stairs = cfg.stages.find(s => s.id === 'stairs');
  assert.deepEqual(R.takePlan(stairs, fullBag(), getItem), [{ id: 'mat.wood', n: 10 }, { id: 'mat.hardwood', n: 5 }, { id: 'mat.iron', n: 2 }]);
});

test('모습: 단계마다 등대 모델과 소품 (꺼짐 → 고치는 중 → 켜짐, 비계·렌즈·등불은 켜면 치움)', () => {
  const st = R.fresh();
  assert.equal(R.lookOf(st), 'dark');
  assert.deepEqual(R.propsOf(cfg, st), []);
  st.stage = 1; assert.equal(R.lookOf(st), 'repair');
  assert.deepEqual(R.propsOf(cfg, st).map(p => p.env), ['lighthouse-scaffold']);
  st.stage = 4; assert.deepEqual(R.propsOf(cfg, st).map(p => p.env), ['lighthouse-scaffold', 'lighthouse-stairs', 'lighthouse-lens', 'star-lantern']);
  st.stage = 5; st.lit = '2027-05-01';
  assert.equal(R.lookOf(st), 'lit');
  assert.deepEqual(R.propsOf(cfg, st).map(p => p.env), ['lighthouse-stairs'], '켜면 새 계단만 남음');
});

test('빛 띠: 밤에만, 켜질 때·꺼질 때 반 시간 동안 천천히', () => {
  assert.equal(R.beamLevel(cfg, 12), 0);
  assert.equal(R.beamLevel(cfg, 18.5), 0);
  assert.ok(Math.abs(R.beamLevel(cfg, 18.75) - 0.5) < 1e-9);
  assert.equal(R.beamLevel(cfg, 22), 1);
  assert.equal(R.beamLevel(cfg, 3), 1);
  assert.ok(Math.abs(R.beamLevel(cfg, 5.25) - 0.5) < 1e-9);
  assert.equal(R.beamLevel(cfg, 6), 0);
});

test('저장 모양: 깨진 값은 처음 값으로', () => {
  assert.deepEqual(R.normalize(null), R.fresh());
  // 예전(M19-P4) 저장: 북쪽 자리 · siteV 없음 → 판 1 → 서쪽 등대 설정(v2)에선 자리만 다시 고르고 단계·도움·날짜는 그대로
  const old = R.normalize({ site: { tx: 29, tz: 5 }, started: '2027-04-02', stage: 2, done: { path: '2027-04-02', stairs: '2027-04-09' }, helped: { mochi: true } });
  assert.equal(old.siteV, 1);
  assert.equal(R.siteFor(cfg, old), null);
  assert.equal(old.stage, 2);
  assert.deepEqual(old.helped, { mochi: true });
  assert.equal(R.phase(cfg, old, '2027-04-16'), 'work');
  assert.deepEqual(R.siteFor(cfg, { ...old, siteV: cfg.site.v }), { tx: 29, tz: 5 });
  assert.equal(cfg.site.v, 2);
  assert.equal(R.normalize({ keeperMet: '2027-04-02' }).keeperMet, '2027-04-02');
  const s = R.normalize({ stage: 9, site: { tx: 1.5 }, done: 3, started: '2027-04-02' });
  assert.equal(s.stage, 5);
  assert.equal(s.site, null);
  assert.deepEqual(s.done, {});
  assert.equal(s.started, '2027-04-02');
});

test('자리: 섬 서쪽 끝 곶 (서쪽 등대 D270-A) — 몸통·소품·앞 칸이 땅이고 비어 있음 · 돌길은 남쪽으로 · 등대지기 자리', () => {
  const spec = s => J(`assets/env/specs/${s}.json`);
  const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, spec(k)])));
  const layout = J('assets/island/layout.json');
  for (const seed of [layout.seed, 1, 7, 77, 2024, 20270101, 99991]) {
    const gen = generateIsland(seed, { ...ISLAND, villagers: VILLAGERS, lots, layout });
    const api = createIslandApi(gen);
    const occ = new Map(gen.objects.map(o => [`${o.tx},${o.tz}`, o.kind]));
    const ignorable = t => /^(shell|weed|flower|tulip|cosmos|pansy)/.test(t ?? '');
    const q = { w: api.w, h: api.h, tileAt: api.tileAt, levelAt: api.levelAt, toWorld: api.toWorld, toTile: api.toTile, isFree: (tx, tz) => !occ.has(`${tx},${tz}`) || ignorable(occ.get(`${tx},${tz}`)) };
    const s = R.siteSpot(cfg, q);
    assert.ok(s, `시드 ${seed}: 자리`);
    // 지금 섬(layout 시드)은 서쪽 바닷가 끝, 다른 시드 섬은 서쪽 끝이 숲·언덕이면 조금 안쪽까지 (서쪽 절반)
    assert.ok(s.tx < api.w * (seed === layout.seed ? 0.2 : 0.5), `시드 ${seed}: 서쪽 (${s.tx})`);
    if (seed === layout.seed) {
      assert.equal(api.tileAt(s.tx, s.tz), 'sand', '바닷가 모래 끝');
      // 광장과 비슷한 줄 (남쪽에서 내려다보는 카메라로 광장에서 서쪽으로 걸어가면 보이게) — 섬 북쪽 1/5 이 아님
      assert.ok(s.tz > api.h * 0.3 && s.tz < api.h * 0.7, `광장 줄 가까이 (${s.tz})`);
      assert.equal(api.tileAt(s.tx - 3, s.tz), 'sea', '등대 서쪽 세 칸 = 바다 (바닷가 끝)');
    }
    const kp = R.keeperSpot(cfg.keeper, s, api.toWorld(s.tx, s.tz), q);
    const kt = api.toTile(kp.x, kp.z);
    assert.ok(['sand', 'grass', 'path'].includes(api.tileAt(kt.tx, kt.tz)), `시드 ${seed}: 등대지기 땅 위`);
    const w = R.siteWorld(s, api.toWorld);
    assert.ok(w.front.z > w.z, '앞 = 남쪽');
    for (const p of cfg.props) {
      const t = api.toTile(w.x + p.at[0], w.z + p.at[1]);
      assert.notEqual(api.tileAt(t.tx, t.tz), 'sea', `시드 ${seed}: ${p.env} 땅 위`);
    }
    const strict = { ...q, isFree: (tx, tz) => !occ.has(`${tx},${tz}`) };
    const path = R.pathTiles(s, strict, 6);
    for (const t of path) { assert.ok(Math.abs(t.tx - s.tx) <= 1); assert.ok(t.tz > s.tz + 1); }
    if (seed === layout.seed) assert.ok(path.length >= 2, `돌길 ${path.length}칸`);
  }
});

test('장면 s54–s61: 파일·트리거 lighthouse·자리·첫 장면부터 아침까지', () => {
  const ids = ['s54-lighthouse-start', 's55-lighthouse-path', 's56-lighthouse-stairs', 's57-lighthouse-lens', 's58-lighthouse-lantern', 's59-lighthouse-ready', 's60-lighthouse-lit', 's61-lighthouse-morning'];
  const kinds = ['start', ...cfg.stages.map(s => s.id), 'lit', 'morning'];
  assert.ok(TRIGGERS.lighthouse && TRIGGERS.lighthouse.event === 'lighthouse:scene');
  assert.ok(PLACES.lighthouse);
  assert.equal(cfg.startScene, ids[0]);
  assert.deepEqual(cfg.stages.map(s => s.scene), ids.slice(1, 6));
  assert.equal(cfg.litScene, ids[6]);
  assert.equal(cfg.morningScene, ids[7]);
  const index = J('assets/story/index.json').timeline.map(r => r.scene).filter(Boolean);
  ids.forEach((id, i) => {
    assert.ok(SCENE_FILES.includes(`assets/story/scenes/${id}.json`), id);
    assert.ok(index.includes(id), `${id} 타임라인`);
    const sc = J(`assets/story/scenes/${id}.json`);
    assert.equal(sc.trigger.on, 'lighthouse');
    assert.equal(sc.trigger.kind, kinds[i]);
    assert.equal(sc.place, 'lighthouse');
    assert.ok(TRIGGERS.lighthouse.test({ kind: kinds[i] }, sc.trigger));
    assert.ok(!TRIGGERS.lighthouse.test({ kind: 'other' }, sc.trigger));
  });
  // 불 켜는 밤은 섬 사람 모두 + 밤 상인들
  const lit = J('assets/story/scenes/s60-lighthouse-lit.json');
  const cast = new Set(lit.takes[0].shots[0].actors.map(a => a.who));
  for (const s of [...ALL, 'bamtol', 'neuru', 'byeolbam', 'yeomyeong', 'salang', 'player']) assert.ok(cast.has(s), `s60 에 ${s}`);
  // 단계 장면에는 그 단계 앞 두 돕는 주민이 나온다
  for (const s of cfg.stages) {
    const sc = J(`assets/story/scenes/${s.scene}.json`);
    const who = new Set(sc.takes[0].shots.flatMap(x => x.actors.map(a => a.who)));
    for (const h of R.helpersOf(s, ALL)) assert.ok(who.has(h), `${s.scene} 에 ${h}`);
  }
  assert.deepEqual(scenesFor('lighthouse:scene', { kind: 'lens' }, ids.map(id => J(`assets/story/scenes/${id}.json`))), ['s57-lighthouse-lens']);
});

test('서쪽 등대: 등대지기 CH-20 · 단계마다 도토리 (D271-A · D273-A)', () => {
  // 등대지기 — 모델·스펙·대사 파일 · 종족은 섬 주민·상인과 안 겹침
  const K = cfg.keeper;
  assert.equal(K.slug, 'yunseul');
  const spec = J(`assets/specs/${K.slug}.json`);
  assert.equal(spec.id, 'CH-20');
  assert.equal(spec.species, 'seal');
  const others = ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'danpung', 'gureum', 'pado', 'dalmuri', 'ssalal', 'boreum', 'bamtol', 'neuru', 'byeolbam', 'yeomyeong', 'songi', 'salang'];
  for (const o of others) assert.notEqual(J(`assets/specs/${o}.json`).species, 'seal', o);
  assert.ok(!others.map(o => J(`assets/specs/${o}.json`).name).includes(spec.name), '이름 겹침 없음');
  assert.ok(existsSync(new URL(`../assets/models/${K.slug}.glb.json`, import.meta.url)), '모델');
  const v = J(`assets/villagers/${K.slug}.json`);
  assert.equal(v.role, 'keeper');
  for (const k of ['first', 'greet', 'closed', 'stage', 'needs', 'short', 'helpers', 'ready', 'thanks', 'wait', 'night', 'lit', 'bye']) assert.ok(v.lines[k]?.length, `대사 ${k}`);
  // 도토리: 단계마다 · 늘어남 · 상점 가구 값 정도 (1,000 ~ 3,000)
  const ac = cfg.stages.map(R.acornsOf);
  assert.deepEqual(ac, [1000, 1500, 2000, 2500, 3000]);
  // 재료는 다 있는데 도토리가 모자라면 'acorns' · 모자란 수
  const st = R.normalize({ started: '2027-04-02' });
  helpAll(st);
  const poor = R.canFinish(cfg, st, '2027-04-02', { slots: fullBag(), getItem, residents: ALL, acorns: 400 });
  assert.equal(poor.ok, false);
  assert.equal(poor.why, 'acorns');
  assert.deepEqual(poor.short, [{ label: '도토리', short: 600, acorn: true }]);
  // 재료도 모자라면 재료부터, 모자란 것 목록엔 둘 다
  const none = R.canFinish(cfg, st, '2027-04-02', { slots: [{ id: 'mat.stone', count: 4 }], getItem, residents: ALL, acorns: 0 });
  assert.equal(none.why, 'needs');
  assert.deepEqual(none.short.map(x => [x.label, x.short]), [['돌', 6], ['나무', 5], ['도토리', 1000]]);
  assert.equal(R.canFinish(cfg, st, '2027-04-02', { slots: fullBag(), getItem, residents: ALL, acorns: 1000 }).ok, true);
  const row = R.acornRow(cfg.stages[1], 2000);
  assert.deepEqual([row.have, row.n, row.ok], [2000, 1500, true]);
});

test('장면 s66–s67: 등대지기 첫 만남 · 불 켠 밤 한마디 (kind keeper · lit-keeper)', () => {
  const index = J('assets/story/index.json').timeline.map(r => r.scene).filter(Boolean);
  for (const [id, kind] of [['s66-lighthouse-keeper', 'keeper'], ['s67-lighthouse-keeper-night', 'lit-keeper']]) {
    assert.ok(SCENE_FILES.includes(`assets/story/scenes/${id}.json`), id);
    assert.ok(index.includes(id), `${id} 타임라인`);
    const sc = J(`assets/story/scenes/${id}.json`);
    assert.equal(sc.trigger.on, 'lighthouse');
    assert.equal(sc.trigger.kind, kind);
    assert.equal(sc.place, 'lighthouse');
    assert.ok(TRIGGERS.lighthouse.test({ kind }, sc.trigger));
    assert.ok(sc.takes[0].shots.flatMap(x => x.actors.map(a => a.who)).includes(cfg.keeper.slug), `${id} 에 등대지기`);
  }
});
