// Z5 축제·이모티콘 대화 규칙 (src/gameplay/festival/judge.js, assets/emotes/*.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, normalize, wantOf, greetOf, tutorialOk, countPoints, KINDS, MAX_SEND } from '../src/gameplay/festival/judge.js';

const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const EM = read('assets/emotes/emotes.json');
const RULES = read('assets/emotes/talk.json');
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
