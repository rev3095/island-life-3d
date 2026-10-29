// 4차 Y2 채집 콘텐츠: 화석 감정, 들추기 곤충, 큰 물고기 줄다리기, 물고기 몸 색
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as items from '../src/data/items.js';
import * as spawns from '../src/data/spawns.js';
import { createMuseum } from '../src/data/museum.js';
import { createDay } from '../src/data/day.js';
import { createHarvest } from '../src/data/harvest.js';
import { createState } from '../src/core/state.js';
import { rngFor } from '../src/data/rng.js';
import { TUG, needsTug, pullsFor, createTug, tugStep, tugPress } from '../src/gameplay/gather/tug.js';
import neuru from '../src/gameplay/town/lines/neuru.js';

const ids = pool => pool.map(e => e.item.id);

test('알 수 없는 화석: 카테고리는 화석이지만 도감·박물관 목록엔 없고, 값이 싸다', () => {
  const u = items.get('fossil.unknown');
  assert.ok(u && u.unknown && u.category === 'fossil');
  assert.equal(items.UNKNOWN_FOSSIL, 'fossil.unknown');
  assert.ok(!items.list('fossil').some(it => it.id === u.id));
  assert.ok(items.list().some(it => it.id === u.id), '전체 목록에는 있다');
  for (const f of items.list('fossil')) assert.ok(u.price < f.price, f.id);
});

test('알 수 없는 화석은 기증할 수 없고, 박물관 수에도 안 든다', () => {
  const state = createState();
  const m = createMuseum(state);
  assert.equal(m.canDonate('fossil.unknown'), false);
  assert.equal(m.donate('fossil.unknown'), false);
  assert.deepEqual(m.progress().fossil, [0, 8]);
  assert.equal(m.record('fossil.unknown'), false);
});

test('화석 자리를 파면 감정 전 화석, 감정하면 진짜 화석 8종 중 하나', () => {
  const state = createState();
  const day = createDay({ state, getNow: () => ({ dayKey: '2026-10-29' }) });
  const h = createHarvest({ state, day });
  day.check();
  assert.equal(h.digFossil('s1'), 'fossil.unknown');
  assert.equal(h.digFossil('s1'), null, '같은 자리는 한 번');
  const real = new Set(items.list('fossil').map(it => it.id));
  const rng = rngFor('appraise');
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const id = h.appraise(rng);
    assert.ok(real.has(id), id);
    seen.add(id);
  }
  assert.equal(seen.size, 8, '모든 화석이 나올 수 있다');
  assert.notEqual(spawns.fossil(rngFor('x')), 'fossil.unknown');
});

test('들추기 곤충 출현표: 바위 밑(쥐며느리 종일·집게벌레 밤) · 나무에서 떨어짐(송충이 봄~가을)', () => {
  assert.deepEqual(ids(spawns.underRockPool({ hour: 12, month: 5 })), ['bug.pill-bug']);
  assert.deepEqual(ids(spawns.underRockPool({ hour: 22, month: 5 })).sort(), ['bug.earwig', 'bug.pill-bug']);
  assert.deepEqual(ids(spawns.underRockPool({ hour: 22, month: 1 })), ['bug.pill-bug'], '집게벌레는 겨울엔 없다');
  assert.ok(!ids(spawns.bugPool({ place: 'rock', hour: 12, month: 5 })).includes('bug.pill-bug'), '쥐며느리는 그냥 바위 위엔 안 나온다');
  const summer = ids(spawns.shakeBugPool({ hour: 12, month: 7 }));
  assert.ok(summer.includes('bug.caterpillar') && summer.includes('bug.cicada'));
  assert.ok(!summer.includes('bug.honeybee'), '꿀벌은 벌집 쪽으로');
  assert.deepEqual(ids(spawns.shakeBugPool({ hour: 12, month: 1 })), [], '겨울 낮엔 떨어질 곤충이 없다');
  assert.ok(ids(spawns.shakeBugPool({ hour: 22, month: 7 })).includes('bug.rhino-beetle'));
});

test('나무 흔들기: 곤충이 떨어지는 일(event bug)이 있다, 겨울엔 없다', () => {
  const count = month => {
    const rng = rngFor(`shake-bug-${month}`);
    let n = 0;
    for (let i = 0; i < 3000; i++) {
      const r = spawns.treeShake('tree', rng, { hour: 12, month });
      if (r?.event === 'bug') { n++; assert.equal(items.get(r.id).category, 'bug'); assert.notEqual(r.id, 'bug.honeybee'); }
    }
    return n;
  };
  const july = count(7);
  assert.ok(july > 3000 * spawns.SHAKE_BUG_CHANCE * 0.6 && july < 3000 * spawns.SHAKE_BUG_CHANCE * 1.4, `7월 ${july}`);
  assert.equal(count(1), 0);
});

test('바위 밑 곤충: 바위 하나에 하루 한 번, 다음 날 다시', () => {
  const state = createState();
  let now = { dayKey: '2026-10-29' };
  const day = createDay({ state, getNow: () => now });
  const h = createHarvest({ state, day });
  day.check();
  const always = () => 0;    // 늘 나온다
  assert.equal(h.rockBug('r1', { rng: always, hour: 12, month: 5 }), 'bug.pill-bug');
  assert.equal(h.rockBug('r1', { rng: always, hour: 12, month: 5 }), null, '같은 바위는 하루 한 번');
  assert.equal(h.rockBug('r2', { rng: () => 0.99, hour: 12, month: 5 }), null, '확률 밖');
  assert.equal(h.rockBug('r2', { rng: always, hour: 12, month: 5 }), 'bug.pill-bug');
  now = { dayKey: '2026-10-30' };
  day.check();
  assert.equal(h.rockBug('r1', { rng: always, hour: 12, month: 5 }), 'bug.pill-bug', '새 날');
  // 기본 시드 rng 로도 대략 ROCK_BUG_CHANCE
  let n = 0;
  for (let i = 0; i < 2000; i++) if (h.rockBug(`rock-${i}`, { hour: 12, month: 5 })) n++;
  assert.ok(n > 2000 * spawns.ROCK_BUG_CHANCE * 0.6 && n < 2000 * spawns.ROCK_BUG_CHANCE * 1.4, `${n}`);
});

test('줄다리기: 그림자 5~6 만, 틈에 당기면 잡힌다', () => {
  assert.equal(needsTug(4), false);
  assert.equal(needsTug(5), true);
  assert.equal(pullsFor(5), 3);
  assert.equal(pullsFor(6), 4);
  const s = createTug(6, () => 0.5);
  let caught = null;
  for (let i = 0; i < 400 && !caught; i++) {
    const ev = tugStep(s, 0.05);
    assert.notEqual(ev, 'escape');
    if (s.phase === 'slack' && s.timer < 0.3) caught = tugPress(s) === 'caught' ? 'yes' : null;
  }
  assert.equal(caught, 'yes');
  assert.equal(s.done, 'caught');
});

test('줄다리기: 당기는 동안 마구 누르면 줄이 끊긴다', () => {
  const s = createTug(5, () => 0.5);
  assert.equal(s.phase, 'pull');
  assert.equal(tugPress(s), 'strain');
  tugStep(s, 0.05);
  assert.equal(tugPress(s), 'snap', '빨리 두 번이면 끊김');
  assert.equal(s.done, 'snap');
  assert.equal(tugPress(s), null);
  // 천천히 한 번씩은 버틴다 (팽팽함이 풀린다)
  const t = createTug(5, () => 0);
  assert.equal(tugPress(t), 'strain');
  tugStep(t, 0.6);
  assert.equal(t.phase, 'pull', '0.7초 당김이 0.6초 뒤엔 아직 당기는 중');
  assert.ok(t.tension < TUG.wrong);
  assert.equal(tugPress(t), 'strain', '쉬었다 누르면 한 번은 버틴다');
});

test('줄다리기: 틈을 계속 놓치면 도망간다', () => {
  const s = createTug(5, () => 0.5);
  let ev = null;
  for (let i = 0; i < 2000 && ev !== 'escape'; i++) ev = tugStep(s, 0.05);
  assert.equal(ev, 'escape');
  assert.equal(s.done, 'escape');
  assert.ok(s.clock < (TUG.pull[1] + TUG.slack[0]) * TUG.maxMiss + 0.1);
});

test('물고기마다 몸 색(몸·등·배·지느러미)이 있고 서로 다르다', () => {
  const seen = new Set();
  for (const f of items.list('fish')) {
    for (const k of ['body', 'back', 'belly', 'fin']) assert.match(f.colors?.[k] ?? '', /^#[0-9A-F]{6}$/i, `${f.id} ${k}`);
    seen.add(`${f.colors.body}/${f.colors.back}/${f.colors.fin}`);
  }
  assert.equal(seen.size, items.list('fish').length);
});

test('느루 감정 대사가 다 있다', () => {
  for (const k of ['notice', 'noticeMany', 'later', 'look', 'next', 'result', 'rare', 'owned', 'done', 'doneOwned', 'notYet']) {
    assert.ok(neuru.appraise[k]?.length, k);
  }
  assert.ok(neuru.menu.length);
  assert.ok(neuru.appraise.result.every(v => v.some(l => l.includes('{item'))));
});
