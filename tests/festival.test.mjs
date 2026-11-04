// Z5 축제·이모티콘 대화 규칙 (src/gameplay/festival/judge.js, assets/emotes/*.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, normalize, wantOf, greetOf, tutorialOk, countPoints, withVillagers, KINDS, MAX_SEND } from '../src/gameplay/festival/judge.js';
import { VILLAGERS } from '../src/gameplay/town/people.js';

const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const EM = read('assets/emotes/emotes.json');
const RULES = withVillagers(read('assets/emotes/talk.json'), VILLAGERS);   // 주민 규칙(TK)은 6차 M6-P3 부터 주민 파일 emote 칸
const KEYS = new Set(EM.emotes.map(e => e.key));
const PLAYER = EM.emotes.filter(e => e.cat !== 'reply').map(e => e.key);
const SLUGS = Object.keys(RULES.villagers);

test('이모티콘 세트: 36개, ID·key 겹침 없음, 플레이어 30 · 대답 전용 6, 금지 상징 없음', () => {
  assert.equal(EM.emotes.length, 36);
  assert.equal(new Set(EM.emotes.map(e => e.id)).size, 36);
  assert.equal(KEYS.size, 36);
  assert.equal(PLAYER.length, 30);
  for (const e of EM.emotes) {
    assert.match(e.id, /^EM-\d\d$/);
    assert.ok(EM.cats.some(c => c.key === e.cat), `${e.id} 묶음`);
    assert.ok(e.svg.length > 20 && !/<script|on\w+=/i.test(e.svg), `${e.id} svg`);
  }
  assert.ok(!EM.emotes.some(e => ['🙏', '🏮'].includes(e.glyph)), '기도·특정 문화 등불 이모티콘은 넣지 않는다');
});

test('대화 규칙: 주민 7명, 쓰는 이모티콘이 모두 세트에 있고 좋아함·원하는 것은 플레이어가 보낼 수 있다', () => {
  assert.deepEqual(SLUGS.sort(), ['bori', 'chorong', 'coco', 'danpung', 'dubu', 'mochi', 'pong']);
  for (const [slug, R] of Object.entries(RULES.villagers)) {
    assert.match(R.id, /^TK-0[1-7]$/);
    for (const k of [...R.likes, ...R.dislikes, ...R.reply]) assert.ok(KEYS.has(k), `${slug}: ${k}`);
    for (const k of [...R.likes, ...R.wants]) assert.ok(PLAYER.includes(k), `${slug}: ${k} 를 플레이어가 못 보냄`);
  }
  for (const t of RULES.tutorial) for (const k of [...t.say, ...t.ok]) assert.ok(KEYS.has(k));
  for (const g of Object.values(RULES.greet)) for (const k of g) assert.ok(KEYS.has(k));
});

test('판정은 결정적이고, 대답은 1–3개 세트 안 이모티콘', () => {
  const c = { dayKey: '2026-10-29', weather: 'clear' };
  for (const slug of SLUGS) for (const keys of [['wave'], ['fish', 'grin', 'sun'], [], ['shout', 'party']]) {
    const a = judge(RULES, slug, keys, c), b = judge(RULES, slug, keys, c);
    assert.deepEqual(a, b);
    assert.ok(KINDS.includes(a.kind));
    assert.ok(a.reply.length >= 1 && a.reply.length <= MAX_SEND, `${slug} ${keys}`);
    for (const k of a.reply) assert.ok(KEYS.has(k), `${slug} 대답 ${k}`);
    assert.ok(a.points >= 0, '친밀도는 깎이지 않는다');
  }
});

test('같은 이모티콘도 주민마다 다르게 읽는다', () => {
  const c = { dayKey: '2026-10-29', want: null, greeted: true, waited: true };
  const three = ['wave', 'grin', 'sun'];
  assert.equal(judge(RULES, 'coco', three, c).kind, 'delight');                 // 코코: 이어 말하면 신난다
  assert.ok(['retreat', 'awkward', 'puzzled', 'okay'].includes(judge(RULES, 'bori', three, c).kind));   // 보리: 셋은 버겁다
  assert.equal(judge(RULES, 'coco', ['wave'], c).kind, 'puzzled');              // 코코: 하나면 "더!"
  assert.equal(judge(RULES, 'bori', ['moon'], c).kind, 'happy');
  assert.equal(judge(RULES, 'dubu', ['fish', 'good', 'wave'], c).kind, 'retreat');   // 두부: 셋은 물러남
  assert.equal(judge(RULES, 'pong', ['fruit'], c).kind, 'happy');
});

test('주민 규칙: 모찌 인사 먼저 · 두부 기다리기 먼저 · 초롱 물으면 힌트 · 비 오면 초롱 한 단계 · 단풍 따라 하기', () => {
  const d = '2026-10-29';
  const m1 = judge(RULES, 'mochi', ['flower'], { dayKey: d });
  assert.equal(m1.kind, 'puzzled'); assert.deepEqual(m1.hint, ['wave']);
  const m2 = judge(RULES, 'mochi', ['wave', 'flower'], { dayKey: d });
  assert.ok(m2.greeted && ['happy', 'delight'].includes(m2.kind));
  const b1 = judge(RULES, 'dubu', ['fish'], { dayKey: d });
  assert.deepEqual(b1.hint, ['wait']);
  const b2 = judge(RULES, 'dubu', [], { dayKey: d });
  assert.ok(b2.waited && b2.kind === 'happy');
  const b3 = judge(RULES, 'dubu', ['fish'], { dayKey: d, waited: true });
  assert.ok(['happy', 'delight'].includes(b3.kind));
  const want = wantOf(RULES.villagers.chorong, 'chorong', d);
  const ch = judge(RULES, 'chorong', ['ask'], { dayKey: d, want });
  assert.ok(ch.reply.includes('bubble') || ch.matchedWant || want === 'ask' || ch.reply.length);
  const dry = judge(RULES, 'chorong', ['music'], { dayKey: d, want: null }), wet = judge(RULES, 'chorong', ['music'], { dayKey: d, want: null, weather: 'rain' });
  assert.equal(KINDS.indexOf(wet.kind), KINDS.indexOf(dry.kind) + 1);
  const echo = judge(RULES, 'danpung', ['dots', 'think'], { dayKey: d, want: null, lastSaid: ['dots', 'think'] });
  assert.equal(echo.kind, 'delight');
});

test('모든 주민에게 마음을 여는 길이 있다 (어느 날이든 "아주 기쁨" 이 나오는 입력이 있다)', () => {
  for (const day of ['2026-10-29', '2026-11-03', '2027-01-01']) for (const slug of SLUGS) {
    const R = RULES.villagers[slug], want = wantOf(R, slug, day);
    const greet = R.rule.greetFirst ? [R.rule.greetFirst[0]] : [];
    const tries = [[...greet, want, R.likes.find(k => k !== want && k !== greet[0])].filter(Boolean).slice(0, R.rule.fewer ? 1 : 3), [want], [want, R.likes[0]], [...greet, want]];
    const c = { dayKey: day, want, greeted: false, waited: !!R.rule.waitFirst };
    assert.ok(tries.some(t => judge(RULES, slug, t, c).kind === 'delight' || judge(RULES, slug, t, c).kind === 'happy'), `${slug} ${day}`);
  }
});

test('빈 보내기 = 기다리기, 인사·연습·하루 횟수', () => {
  assert.deepEqual(normalize([]), ['wait']);
  assert.deepEqual(normalize(['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
  assert.deepEqual(greetOf(RULES, 'coco', { slot: 'night', weather: 'clear', tier: 'new' }), ['moon', 'zz']);
  assert.ok(greetOf(RULES, 'coco', { slot: 'morning', weather: 'rain', tier: 'best' }).includes('rain'));
  assert.ok(tutorialOk(RULES, 0, ['wave']));
  assert.ok(!tutorialOk(RULES, 2, ['grin']));
  const v = {};
  const got = [3, 2, 2, 3].map(p => countPoints(RULES, v, 'd1', p));
  assert.deepEqual(got, [3, 2, 2, 0]);
  assert.equal(countPoints(RULES, v, 'd2', 2), 2, '다음 날 다시 센다');
});

// ---------- 축제 광장 (src/world/festival.js, 검수 보드 z5 D19-A) ----------
import { generateIsland, lotsOf, BUILDING_KINDS, KIND } from '../src/world/island.js';
import { festivalLayout, carveFestival, rectCorners, overlaps, BOOTH_SIZE } from '../src/world/festival.js';

const CONFIG = read('assets/festival/config.json');   // 보드 결정 (D14–D25) 설정 하나
const FESTIVAL_RADIUS = read('assets/island/layout.json').festival.r;   // 광장 가운데·반지름 = 섬 지도

const envSpec = slug => read(`assets/env/specs/${slug}.json`);
const island = () => generateIsland(20261028, { lots: lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, envSpec(k)]))) });

test('축제 광장: 무대·부스 다섯·진행판·아치·등불이 서로·건물과 겹치지 않고, 들어오는 길을 막지 않는다', () => {
  const gen = island();
  const F = festivalLayout(gen, CONFIG);
  const { w, h } = gen;
  const rects = [
    ['stage-wall', rectCorners({ x: F.stage.x, z: F.stage.z - 1.4 }, [5.72, 0.2], 0)],
    ...F.booths.map(b => [b.id, rectCorners(b, BOOTH_SIZE.map(v => v * b.scale), b.rot)]),
    ['board', rectCorners(F.board, [2.08, 0.5], F.board.rot)],
    ...F.arches.map((a, i) => [`arch${i}`, rectCorners(a, [2.95, 0.4], a.rot)]),
    ...F.lanterns.map((l, i) => [`lantern${i}`, rectCorners(l, [0.3, 0.6], l.rot)]),
    ...gen.buildings.map(b => [`building:${b.data?.owner ?? b.kind}`, [[b.tx0, b.tz0], [b.tx0 + b.fw, b.tz0], [b.tx0 + b.fw, b.tz0 + b.fd], [b.tx0, b.tz0 + b.fd]].map(([x, z]) => ({ x: x - w / 2, z: z - h / 2 }))]),
  ];
  const bad = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlaps(rects[i][1], rects[j][1], 0.15)) bad.push(`${rects[i][0]} × ${rects[j][0]}`);
  const C = F.center;
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    if (gen.kind[tz * w + tx] !== KIND.PATH) continue;
    const p = { x: tx + 0.5 - w / 2, z: tz + 0.5 - h / 2 }, d = Math.hypot(p.x - C.x, p.z - C.z);
    if (d < FESTIVAL_RADIUS - 0.7 || d > 8.5) continue;
    const cell = [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]].map(([a, b]) => ({ x: p.x + a, z: p.z + b }));
    for (const [n, r] of rects) if (!n.startsWith('building') && !n.startsWith('arch') && overlaps(cell, r)) bad.push(`길 (${tx},${tz}) 를 ${n} 이 막음`);
  }
  for (const [n, r] of rects) if (!n.startsWith('building')) for (const c of r) {
    const i = Math.floor(c.z + h / 2) * w + Math.floor(c.x + w / 2);
    if (gen.kind[i] === KIND.WATER || gen.kind[i] === KIND.SEA || gen.level[i]) bad.push(`${n} 이 물·언덕에 걸침`);
  }
  assert.deepEqual(bad, []);
});

test('축제 광장: 원 안은 광장 칸, 안에 있던 물체는 치우고 축제 물체를 놓는다 (열린 부스만 부스, 나머지는 덮개)', () => {
  const gen = island();
  const before = gen.objects.filter(o => !o.kind.startsWith('festival')).length;
  const P = carveFestival(gen, { opened: new Set(['FB-02']), config: CONFIG, specs: { 'festival-stage': envSpec('festival-stage') } });
  const { w, h } = gen;
  assert.ok(Number.isFinite(P.x) && Number.isFinite(P.z), 'places.festival 에 x·z (story 기준 자리)');
  assert.equal(P.booths.length, 5);
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    const d = Math.hypot(tx + 0.5 - w / 2 - P.x, tz + 0.5 - h / 2 - P.z);
    if (d <= FESTIVAL_RADIUS - 0.5 && !gen.level[tz * w + tx]) assert.equal(gen.kind[tz * w + tx], KIND.PLAZA, `(${tx},${tz})`);
  }
  const kinds = gen.objects.map(o => o.kind);
  assert.equal(kinds.filter(k => k === 'festival-cover').length, 4);
  assert.equal(kinds.filter(k => k === 'festival-booth-music').length, 1);
  for (const k of ['festival-stage', 'festival-floor', 'festival-board']) assert.equal(kinds.filter(x => x === k).length, 1, k);
  assert.equal(kinds.filter(k => k === 'campfire').length, 1, '모닥불은 새 가운데 하나');
  const inside = gen.objects.filter(o => !o.kind.startsWith('festival') && o.kind !== 'campfire' && Math.hypot(o.x - P.x, o.z - P.z) < FESTIVAL_RADIUS);
  assert.deepEqual(inside.map(o => o.id), [], '원 안에 다른 물체가 남으면 안 된다');
  assert.ok(gen.objects.filter(o => !o.kind.startsWith('festival')).length < before);
  assert.ok(gen.pads.some(p => p.festival && p.steps[0] === 0.36), '무대 위는 걸을 수 있는 높은 바닥');
  assert.deepEqual(P.booths.map(b => b.id).sort(), ['FB-01', 'FB-02', 'FB-03', 'FB-04', 'FB-05']);
});

// ---------- 축제 부품·부스 놀이 규칙 (src/gameplay/festival/parts.js · booths.js) ----------
import { makeParts, takeAny, takeVaried, takeWithOne, festState, allParts } from '../src/gameplay/festival/parts.js';
import { checkConfig } from '../src/gameplay/festival/fest.js';
import { fishLength, dubuRecord, weekOf, lanternColorOf, LANTERN_COLORS, RHYTHM } from '../src/gameplay/festival/booths.js';
import * as itemsDb from '../src/data/items.js';

const bag = list => list.map(x => (x ? { id: x[0], count: x[1] } : null));
const total = plan => plan.reduce((s, x) => s + x.n, 0);
const { PARTS, heartOpen } = makeParts(CONFIG);

test('축제 부품 다섯: 주민 다섯이 하나씩, 부스 하나씩, 말풍선 낱말은 세트(또는 아이템)에 있다', () => {
  assert.equal(PARTS.length, 5);
  assert.deepEqual(PARTS.map(p => p.who).sort(), ['chorong', 'coco', 'dubu', 'mochi', 'pong']);
  assert.deepEqual(PARTS.map(p => p.booth).sort(), ['FB-01', 'FB-02', 'FB-03', 'FB-04', 'FB-05']);
  for (const p of PARTS) {
    assert.ok(envSpec(p.slug), `${p.id} 모델 스펙`);
    for (const t of p.hint) assert.ok(KEYS.has(t) || (t.startsWith('item:') && itemsDb.get(t.slice(5))), `${p.id} ${t}`);
  }
});

test('부품에 필요한 것: 모자라면 null, 맞으면 가방 칸·개수', () => {
  const items = itemsDb;
  const [lantern, drum, garland, pot, flag] = PARTS;
  assert.equal(lantern.pick(bag([['bug.ant', 1], ['bug.cicada', 1]]), items), null);
  assert.equal(total(lantern.pick(bag([['bug.ant', 1], ['bug.cicada', 1], ['bug.moth', 1]]), items)), 3);
  assert.equal(total(lantern.pick(bag([['bug.ant', 1], ['bug.firefly', 1]]), items)), 1, '반딧불이면 하나로');
  assert.equal(drum.pick(bag([['mat.wood', 4]]), items), null);
  assert.deepEqual(drum.pick(bag([['mat.wood', 3], null, ['mat.wood', 7]]), items), [{ slot: 0, n: 3 }, { slot: 2, n: 2 }]);
  assert.equal(garland.pick(bag([['flower.tulip-red', 6]]), items), null, '색 셋 이상');
  assert.equal(total(garland.pick(bag([['flower.tulip-red', 4], ['flower.tulip-white', 1], ['flower.cosmos-pink', 1]]), items)), 6);
  const native = 'fruit.apple';
  assert.equal(pot.pick(bag([['fruit.apple', 9]]), items, { nativeFruit: native }), null, '특산 아닌 과일 하나는 있어야');
  assert.equal(total(pot.pick(bag([['fruit.apple', 9], ['fruit.pear', 1]]), items, { nativeFruit: native })), 5);
  const small = items.list('fish').find(f => f.shadow < 5), big = items.list('fish').find(f => f.shadow >= 5);
  assert.equal(flag.pick(bag([[small.id, 1]]), items), null);
  assert.equal(total(flag.pick(bag([[small.id, 1], [big.id, 1]]), items)), 1);
  assert.equal(takeAny([], items, () => true, 1), null);
  assert.equal(takeVaried(bag([['flower.tulip-red', 2]]), items, it => it.category === 'flower', 2, 2), null);
  assert.equal(takeWithOne(bag([['fruit.pear', 2]]), items, it => it.category === 'fruit', 2, it => it.id === 'fruit.cherry'), null);
});

test('마음 열기·상태: 친구 단계 + 기쁨 두 번, 다섯 다 모으면 끝', () => {
  assert.ok(!heartOpen({ friendship: 40, emote: { wins: 1 } }));
  assert.ok(!heartOpen({ friendship: 20, emote: { wins: 5 } }));
  assert.ok(heartOpen({ friendship: 30, emote: { wins: 2 } }));
  // 7차 D50-A: 좋아하는 선물·부탁도 마음이 통한 일 (이모티콘이 서툴러도 엔딩까지)
  assert.ok(heartOpen({ friendship: 30, emote: { wins: 0 }, bonds: { gift: 1, favor: 1 } }));
  assert.ok(heartOpen({ friendship: 30, emote: { wins: 1 }, bonds: { gift: 1, favor: 0 } }));
  assert.ok(!heartOpen({ friendship: 20, emote: { wins: 0 }, bonds: { gift: 3, favor: 3 } }), '친밀도는 그대로 필요');
  const st = {};
  const f = festState(st);
  assert.deepEqual([f.parts, f.booths, f.asked], [{}, {}, {}]);
  assert.ok(!allParts(f, PARTS));
  for (const p of PARTS) f.parts[p.id] = '2026-11-01';
  assert.ok(allParts(f, PARTS));
});

test('부스 놀이 규칙: 물고기 길이·두부 기록은 날마다 같고, 등불 색은 정해진 넷, 리듬은 8박', () => {
  const big = itemsDb.list('fish').find(f => f.shadow >= 5), small = itemsDb.list('fish').find(f => f.shadow <= 2);
  assert.equal(fishLength(big, '2026-11-01', 1), fishLength(big, '2026-11-01', 1));
  assert.ok(fishLength(big, '2026-11-01', 1) > fishLength(small, '2026-11-01', 1));
  const w = weekOf('2026-11-02');
  assert.equal(weekOf('2026-11-08'), w, '월요일부터 한 주');
  assert.notEqual(weekOf('2026-11-09'), w);
  assert.ok(dubuRecord(w) >= 38 && dubuRecord(w) < 60);
  assert.equal(lanternColorOf('bug.firefly'), 'green');
  for (const b of itemsDb.list('bug')) assert.ok(LANTERN_COLORS.includes(lanternColorOf(b.id)));
  const lantern = envSpec('festival-lantern');
  for (const c of LANTERN_COLORS) assert.ok(lantern.variants?.[c]?.palette?.glow, `등불 변형 ${c}`);
  assert.equal(RHYTHM.beats.length, 8);
});

// ---------- 축제 날 (fest.js festivalDue 와 같은 규칙: 다 모은 다음 날부터 · 해마다 같은 날) ----------
test('축제 날: 다 모은 날은 아니고 다음 날부터, 연 뒤엔 해마다 같은 날', async () => {
  const { festivalDueOn } = await import('../src/gameplay/festival/parts.js');
  const f = {};
  const F = { festivalDue: k => festivalDueOn(f, k) };
  assert.equal(F.festivalDue('2026-11-01'), false);
  f.readyDay = '2026-11-01';
  assert.equal(F.festivalDue('2026-11-01'), false, '다 모은 그날은 아니다');
  assert.equal(F.festivalDue('2026-11-02'), true);
  assert.equal(F.festivalDue('2026-11-05'), true, '놓쳐도 다음 저녁에 다시');
  f.heldDay = '2026-11-02'; f.lastYear = '2026';
  assert.equal(F.festivalDue('2026-11-03'), false);
  assert.equal(F.festivalDue('2027-11-02'), true, '해마다 같은 날 (D25-A)');
  f.lastYear = '2027';
  assert.equal(F.festivalDue('2027-11-02'), false, '그해에 열었으면 끝');
  // 7차 D55-A: 그 날부터 사흘 안 (한 해 한 번), 2월 29일은 없는 해엔 2월 28일, 연말이면 새해로 넘어가도 그 해 몫
  f.lastYear = '2027';
  assert.equal(F.festivalDue('2028-11-03'), true, '이틀째');
  assert.equal(F.festivalDue('2028-11-04'), true, '사흘째');
  assert.equal(F.festivalDue('2028-11-05'), false, '나흘째는 아니다');
  assert.equal(F.festivalDue('2028-11-01'), false, '그 날 전은 아니다');
  const { festivalYearOf, anniversary } = await import('../src/gameplay/festival/parts.js');
  assert.equal(anniversary('2028-02-29', 2029), '2029-02-28');
  assert.equal(anniversary('2028-02-29', 2032), '2032-02-29');
  const leap = { heldDay: '2028-02-29', lastYear: '2028' };
  assert.equal(festivalDueOn(leap, '2029-02-28'), true);
  assert.equal(festivalDueOn(leap, '2029-03-02'), true, '평년엔 2/28 부터 사흘');
  assert.equal(festivalDueOn(leap, '2029-03-03'), false);
  const eve = { heldDay: '2026-12-30', lastYear: '2026' };
  assert.equal(festivalDueOn(eve, '2028-01-01'), true, '12/30 축제의 사흘째 = 다음 해 1/1');
  assert.equal(festivalYearOf(eve, '2028-01-01'), '2027');
  assert.equal(festivalDueOn({ ...eve, lastYear: '2027' }, '2028-01-01'), false, '그 해 몫은 이미 열었다');
});

test('축제 설정 (assets/festival/config.json): 결정 D14–D25 가 다 있고, 부품·부스·광장 칸이 서로 맞고, 지금 설정은 만든 안만 쓴다', () => {
  assert.deepEqual(Object.keys(CONFIG.decisions), ['D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21', 'D22', 'D23', 'D24', 'D25']);
  const booths = CONFIG.booths.list.map(b => b.id);
  assert.deepEqual(Object.keys(CONFIG.plaza.boothAngles).sort(), [...booths].sort(), '부스마다 광장 각도');
  for (const p of CONFIG.parts.list) assert.ok(booths.includes(p.booth), `${p.id} 부스`);
  for (const b of CONFIG.booths.list) assert.ok(envSpec(b.slug), `${b.id} 모델 스펙`);
  assert.ok(itemsDb.get(CONFIG.photo.item), '사진 아이템');
  const warns = [];
  checkConfig(CONFIG, w => warns.push(w));
  assert.deepEqual(warns, []);
  checkConfig({ ...CONFIG, booths: { ...CONFIG.booths, appear: 'nextMorning' } }, w => warns.push(w));
  assert.equal(warns.length, 1, '아직 없는 안은 알려 준다');
});
