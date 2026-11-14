// M19-P3 주민끼리 짝 (src/gameplay/town/pairs.js 순수 규칙 + assets/town/pairs.json + 장면 s53): 다툼 날 고르기 · 피하는 날 · 화해 흐름 · AN-17
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/town/pairs.js';
import { PEOPLE } from '../src/gameplay/town/people.js';
import * as items from '../src/data/items.js';
import { TRIGGERS, scenesFor, validateScene, recastTake, takeOf, castOf } from '../src/gameplay/story/rules.js';
import { SCENE_FILES } from '../src/gameplay/story/files.js';

const ROOT = new URL('../', import.meta.url);
const readJSON = p => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const cfg = readJSON(R.PAIRS_FILE);
const ALL = ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'danpung', 'gureum', 'pado', 'dalmuri'];
const day = (k, n) => new Date(Date.parse(`${k}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const ENDED = '2027-02-20';
/** 그 달 1일부터 날마다 planFight 를 돌린다 (blocked(day) 가 true 면 피하는 날) → 다툼이 시작된 날 */
function runMonth(P, month, { blocked = () => false, pairs = R.livePairs(cfg, ALL), listenBoth = false } = {}) {
  const started = [];
  for (let d = 0; d < 31; d++) {
    const k = day(`${month}-01`, d);
    if (k.slice(0, 7) !== month) break;
    R.closeDay(P, k);
    const pick = R.planFight({ cfg, P, dayKey: k, endedDay: ENDED, pairs, blocked: blocked(k) });
    if (pick) {
      R.startFight(P, pick, k);
      started.push({ k, pair: pick.id });
      if (listenBoth) { R.listen(P, pick.a); R.listen(P, pick.b); R.finishFight(P, 'made'); }
    }
  }
  return started;
}

test('짝 설정: 보드 지도대로 여섯 · 섬 주민 · 짝마다 대사·다툼·편지·선물 아이템', () => {
  const ids = cfg.pairs.map(p => p.id);
  assert.deepEqual(ids, ['bori-pong', 'chorong-mochi', 'coco-pado', 'dubu-pado', 'danpung-dalmuri', 'gureum-danpung']);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of cfg.pairs) {
    assert.ok(PEOPLE[p.a] && PEOPLE[p.b], p.id);
    assert.equal(p.id, `${p.a}-${p.b}`);
    assert.ok(items.get(p.gift), `${p.id} 선물 ${p.gift}`);
    assert.ok(p.walk.length >= 3 && p.letter.length >= 1, p.id);
    for (const s of [p.a, p.b]) {
      assert.ok(p.talk[s]?.length, `${p.id} talk.${s}`);
      assert.ok(p.fight[s]?.grumble?.length && p.fight[s]?.listen?.length, `${p.id} fight.${s}`);
    }
  }
  assert.deepEqual(R.livePairs(cfg, ['bori', 'pong', 'coco']).map(p => p.id), ['bori-pong'], '이사 오기 전(파도 없음) 엔 그 짝은 없다');
  assert.equal(R.partnerOf(cfg.pairs[3], 'pado'), 'dubu');
});

test('다툼 날 고르기: 엔딩 뒤에만 · 한 달에 한 번 · fromDay~lastDay · 같은 달은 늘 같은 날', () => {
  const P = R.pairsState({});
  const pairs = R.livePairs(cfg, ALL);
  assert.equal(R.planFight({ cfg, P, dayKey: '2027-02-15', endedDay: null, pairs }), null, '엔딩 전');
  assert.equal(R.planFight({ cfg, P, dayKey: '2027-02-21', endedDay: ENDED, pairs }), null, '엔딩 바로 뒤 며칠');
  const started = runMonth(P, '2027-03');
  assert.equal(started.length, 1, '한 달에 한 번');
  const d = Number(started[0].k.slice(8));
  assert.equal(d, R.fightFrom(cfg, '2027-03'));
  assert.ok(d >= cfg.fight.fromDay && d < cfg.fight.fromDay + cfg.fight.spread && d <= cfg.fight.lastDay);
  const again = runMonth(R.pairsState({}), '2027-03');
  assert.deepEqual(again, started, '같은 달은 같은 날 · 같은 짝');
  // 1년: 달마다 하나, 짝은 돌아가며 (한 짝이 두 번 다투기 전에 여섯이 한 번씩)
  const Y = R.pairsState({});
  const year = [];
  for (let m = 3; m <= 14; m++) year.push(...runMonth(Y, `${2027 + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, '0')}`, { listenBoth: true }));
  assert.equal(year.length, 12);
  assert.equal(new Set(year.slice(0, 6).map(x => x.pair)).size, 6, '처음 여섯 달 = 여섯 짝 한 번씩');
  assert.ok(Object.values(Y.count).every(n => n === 2));
});

test('피하는 날: 비·눈·그날만 날씨·행사·대회·축제·생일이면 다음 날로 · 끝까지 막히면 그달은 건너뜀', () => {
  assert.equal(R.avoidDay({ forecast: [{ weather: 'clear' }] }), false);
  assert.equal(R.avoidDay({ forecast: [{ weather: 'clear' }, { weather: 'rain' }] }), true, '오후에 비');
  assert.equal(R.avoidDay({ weather: 'snow' }), true);
  for (const k of ['special', 'event', 'contest', 'festival', 'birthday']) assert.equal(R.avoidDay({ [k]: true }), true, k);
  const month = '2027-04', first = R.fightFrom(cfg, month);
  const k0 = `${month}-${String(first).padStart(2, '0')}`;
  const blocked = new Set([k0, day(k0, 1), day(k0, 2)]);
  const s = runMonth(R.pairsState({}), month, { blocked: k => blocked.has(k) });
  assert.equal(s.length, 1);
  assert.equal(s[0].k, day(k0, 3), '막힌 사흘 뒤 첫 맑은 날');
  assert.equal(runMonth(R.pairsState({}), month, { blocked: () => true }).length, 0, '한 달 내내 비 → 그달은 없음');
  assert.equal(runMonth(R.pairsState({}), month, { pairs: [] }).length, 0, '짝이 없으면 없음');
});

test('화해 흐름: 둘 다 들어 줘야 heard → 저녁 makeupHour 부터 → made 기록 · 못 하면 다음 날 저절로(self)', () => {
  const P = R.pairsState({});
  const pair = cfg.pairs[0], k = '2027-05-12';
  R.startFight(P, pair, k);
  assert.equal(R.fightToday(P, k).status, 'fight');
  assert.equal(R.canWalk(cfg, P, pair, k), false, '다투는 날엔 같이 안 걷는다');
  assert.equal(R.listen(P, pair.a).both, false);
  assert.equal(R.listen(P, 'coco').both, false, '짝이 아닌 주민은 셈 안 함');
  const now = h => ({ dayKey: k, hour: Math.floor(h), minute: 0, hourF: h });
  assert.equal(R.makeupDue(cfg, P, now(18)), false, '한쪽만 들었으면 아직');
  assert.equal(R.listen(P, pair.b).both, true);
  assert.equal(P.fight.status, 'heard');
  assert.equal(R.makeupDue(cfg, P, now(cfg.fight.makeupHour - 1)), false, '저녁 전');
  assert.equal(R.makeupDue(cfg, P, now(cfg.fight.makeupHour + 0.5)), true);
  assert.equal(R.makeupDue(cfg, P, { ...now(18), dayKey: day(k, 1) }), false, '다른 날');
  R.finishFight(P, 'made');
  assert.equal(R.fightToday(P, k), null);
  assert.deepEqual(P.history.at(-1), { month: '2027-05', day: k, pair: pair.id, outcome: 'made' });
  assert.equal(R.closeDay(P, day(k, 1)), false, '화해한 날은 다시 안 닫는다');
  // 안 들어 주면: 다음 날 저절로 풀림
  const Q = R.pairsState({});
  R.startFight(Q, cfg.pairs[1], k);
  R.listen(Q, cfg.pairs[1].a);
  assert.equal(R.closeDay(Q, k), false, '그날 안엔 그대로');
  assert.equal(R.closeDay(Q, day(k, -3)), false, '날짜 흉내로 앞날로 가도 그대로');
  assert.equal(R.closeDay(Q, day(k, 1)), true);
  assert.equal(Q.history.at(-1).outcome, 'self');
  assert.equal(R.fightToday(Q, k), null);
  assert.equal(R.planFight({ cfg, P: Q, dayKey: day(k, 2), endedDay: ENDED, pairs: R.livePairs(cfg, ALL) }), null, '그달엔 더 없음');
});

test('같이 걷기: 하루 perDay 번 · 다음 날 다시', () => {
  const P = R.pairsState({}), pair = cfg.pairs[2], k = '2027-06-01';
  for (let i = 0; i < cfg.walk.perDay; i++) { assert.ok(R.canWalk(cfg, P, pair, k)); R.noteWalk(P, pair, k); }
  assert.equal(R.canWalk(cfg, P, pair, k), false);
  assert.ok(R.canWalk(cfg, P, cfg.pairs[0], k), '다른 짝은 따로');
  assert.ok(R.canWalk(cfg, P, pair, day(k, 1)));
});

test('AN-17 팔짱·고개 돌리기: k=0 이면 그대로 · k=1 이면 두 팔이 앞으로 가로지르고 고개가 옆으로', () => {
  const z = R.sulkPose(0);
  for (const v of Object.values(z)) assert.ok(v.every(x => Math.abs(x) < 1e-9));
  const p = R.sulkPose(1);
  assert.ok(p.armR[0] < -1 && p.armL[0] < -1, '팔을 앞으로');
  assert.ok(p.armR[1] > 0.5 && p.armL[1] < -0.5, '두 팔이 안쪽으로 (서로 반대)');
  assert.ok(Math.abs(p.head[1]) > 0.4, '고개 돌리기');
});

test('장면 s53: 짝 화해 트리거 · 여러 번 · 배우 바꾸기 (cast) · 검사 통과', () => {
  const file = 'assets/story/scenes/s53-pair-makeup.json';
  assert.ok(SCENE_FILES.includes(file));
  const sc = readJSON(file);
  assert.equal(sc.id, cfg.fight.scene);
  assert.ok(TRIGGERS['pair-makeup']);
  assert.equal(sc.once, false);
  assert.deepEqual(validateScene(sc, { cast: [...Object.keys(PEOPLE), 'player'] }), []);
  assert.deepEqual(castOf(sc).sort(), [...cfg.fight.sceneCast, 'player'].sort(), '파일 속 배우 = sceneCast + 플레이어');
  assert.deepEqual(scenesFor('town:pair', { makeup: true, x: 0, z: 0 }, [sc], { [sc.id]: '2027-03-10' }), [sc.id], '본 적 있어도 또');
  assert.deepEqual(scenesFor('town:pair', { phase: 'listen' }, [sc]), []);
  const t = recastTake(takeOf(sc), { bori: 'gureum', pong: 'danpung' });
  const who = new Set(t.shots.flatMap(s => s.actors.map(a => a.who)));
  assert.deepEqual([...who].sort(), ['danpung', 'gureum', 'player']);
  assert.ok(t.shots.some(s => s.actors.some(a => a.who === 'gureum' && a.face === 'danpung')), 'face 도 바뀐다');
  assert.equal(takeOf(sc).shots[0].actors[0].who, 'bori', '원본은 그대로');
  // 순서를 바꿔 끼워도 (bori → pong, pong → bori) 한꺼번에 바뀐다
  const sw = recastTake(takeOf(sc), { bori: 'pong', pong: 'bori' });
  assert.equal(sw.shots[0].actors[0].who, 'pong');
  assert.equal(sw.shots[0].actors[1].who, 'bori');
  assert.equal(recastTake(takeOf(sc), null), takeOf(sc));
});

test('저장 칸: state.town.pairs 를 만든다 · 있던 값은 그대로', () => {
  const st = {};
  const P = R.pairsState(st);
  assert.equal(st.town.pairs, P);
  assert.deepEqual(P.history, []);
  P.count['bori-pong'] = 2;
  assert.equal(R.pairsState(st).count['bori-pong'], 2);
});
