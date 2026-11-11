// 10차 M10-P4 이사 오가기 (town/moving.js) 순수 규칙: 오는 날 · 집터 · 묻기 확률·굴리기 · 떠나는 단계 · 떠난 주민 편지 · 남는 집터.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MOVING, LEAD, STAY, MOVERS, ROOF, movingState, nextArrivalDay, planArrival, askChance, leaveCandidates, rollAsk,
  leavePlan, leaveStage, lettersDue, letterPool,
} from '../src/gameplay/town/moving.js';
import { addDays, advanceMovein, moveinState, MOVEIN_DAYS } from '../src/gameplay/town/movein.js';
import { generateIsland, lotsOf, BUILDING_KINDS, SPARE_LOTS } from '../src/world/island.js';
import { ISLAND, VILLAGERS } from '../src/core/constants.js';

const json = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const END = '2027-03-01';

test('이사 오기: 엔딩 뒤 7일마다, 입주 5일 전에 시작 (표지판 → 이삿짐 → 집 단계는 movein 그대로)', () => {
  assert.equal(LEAD, MOVEIN_DAYS.lot + MOVEIN_DAYS.boxes + MOVEIN_DAYS.house);
  const M = movingState({});
  assert.equal(nextArrivalDay(M, null), null, '엔딩 전엔 없음');
  assert.equal(nextArrivalDay(M, END), addDays(END, 7));
  const o = { M, endedDay: END, count: 9, movers: ['gureum', 'pado', 'dalmuri'], freeLots: ['spare-1'] };
  assert.equal(planArrival({ ...o, today: addDays(END, 1) }), null, '시작 날 전');
  const p = planArrival({ ...o, today: addDays(END, 2) });
  assert.deepEqual(p, { slug: 'gureum', lot: 'spare-1', start: addDays(END, 2) });
  // movein 단계로 진행하면 입주 날 = 엔딩 + 7
  const r = moveinState({}, 'gureum');
  r.start = p.start;
  advanceMovein(r, addDays(END, 30), true);
  assert.equal(r.lot, addDays(END, 3));
  assert.equal(r.boxes, addDays(END, 6), '이삿짐 날 = 오기 전날 (그 주민 편지)');
  assert.equal(r.moved, addDays(END, 7));
  // 오래 쉬었다 와도 시작 날은 예정 날 그대로 (따라잡기)
  assert.equal(planArrival({ ...o, today: addDays(END, 40) }).start, addDays(END, 2));
});

test('이사 오기: 섬 최대 12명 (11차 D103-A) · 오는 중이면 하나만 · 빈 집터·차례·빈 집터가 늦게 생기면 그날부터', () => {
  const M = movingState({});
  const o = { M, endedDay: END, today: addDays(END, 20), movers: ['gureum', 'pado', 'dalmuri'], freeLots: ['spare-1'] };
  assert.equal(MOVING.max, 12);
  assert.equal(planArrival({ ...o, count: 12 }), null, '12명이면 안 온다');
  assert.ok(planArrival({ ...o, count: 11 }), '11명이면 온다 (새 주민 셋이 모두 함께 산다)');
  assert.equal(planArrival({ ...o, count: 9, freeLots: [] }), null, '빈 집터가 없으면 안 온다');
  M.coming = 'gureum';
  assert.equal(planArrival({ ...o, count: 9 }), null, '오는 중');
  M.coming = null; M.arrived = ['gureum']; M.last = addDays(END, 7);
  M.departed = [{ slug: 'bori', lot: 'home:bori', day: addDays(END, 30) }];
  M.opened = addDays(END, 30);
  assert.equal(planArrival({ ...o, count: 9, today: addDays(END, 28), freeLots: ['home:bori'] }), null, '떠나기 전');
  const p = planArrival({ ...o, count: 9, today: addDays(END, 31), freeLots: ['home:bori'] });
  assert.deepEqual(p, { slug: 'pado', lot: 'home:bori', start: addDays(END, 29) }, '다음 차례 · 떠난 날 바로 표지판 (시작 = 그 전날)');
  M.arrived = ['gureum', 'pado', 'dalmuri'];
  assert.equal(planArrival({ ...o, count: 8 }), null, '올 주민이 더 없다');
});

test('떠나 볼까: 30일 넘게 산 주민 · 축제/행사 주인공 빼고 · 말린 주민은 한동안 안 묻는다', () => {
  const since = { bori: '2027-01-01', danpung: '2027-02-20', gureum: '2027-01-01', coco: '2027-01-01' };
  const day = '2027-03-05';
  const c = leaveCandidates({ residents: ['coco', 'bori', 'danpung', 'gureum'], sinceOf: s => since[s], day });
  assert.deepEqual(c, ['bori', 'gureum']);
  assert.deepEqual(leaveCandidates({ residents: ['bori', 'gureum'], sinceOf: s => since[s], day, calm: { bori: '2027-02-20' } }), ['gureum'], '말린 지 30일 안');
  assert.deepEqual(leaveCandidates({ residents: ['bori'], sinceOf: s => since[s], day, calm: { bori: '2027-01-20' } }), ['bori'], '30일 지나면 다시');
  // 확률: 조용한 날 7일까지 0, 그 뒤 하루 0.02씩, 최대 0.35
  assert.equal(askChance(5), 0);
  assert.equal(askChance(MOVING.quiet), 0);
  assert.ok(Math.abs(askChance(12) - 0.1) < 1e-9);
  assert.equal(askChance(400), MOVING.chanceMax);
});

test('떠나 볼까 굴리기: 날마다 같은 난수 (같은 저장·같은 날 = 같은 결과), 마음은 5일 뒤 사라짐, 하나씩만', () => {
  const run = () => {
    const M = movingState({});
    rollAsk({ M, endedDay: END, today: addDays(END, 60), candidatesOn: () => ['bori', 'danpung'] });
    return M;
  };
  const a = run(), b = run();
  assert.deepEqual(a.ask, b.ask, '같은 결과');
  assert.equal(a.rolled, addDays(END, 60));
  assert.ok(a.ask === null || ['bori', 'danpung'].includes(a.ask.slug));
  // 60일 중엔 거의 늘 한 번은 마음을 먹는다 (확률이 쌓이므로) — 엔딩 날을 바꿔 여러 번
  let made = 0;
  for (let k = 0; k < 20; k++) {
    const M = movingState({});
    const end = addDays(END, k * 3);
    let any = false;
    for (let d = 1; d <= 60; d++) { if (rollAsk({ M, endedDay: end, today: addDays(end, d), candidatesOn: () => ['bori'] })) any = true; }
    if (any) made++;
  }
  assert.ok(made >= 18, `60일 안에 묻기 (${made}/20)`);
  // 후보가 없거나 떠나는 중·막힌 날엔 안 생긴다
  const M = movingState({});
  assert.equal(rollAsk({ M, endedDay: END, today: addDays(END, 90), candidatesOn: () => [] }), null);
  const M2 = movingState({}); M2.leaving = leavePlan('bori', 'home:bori', END);
  rollAsk({ M: M2, endedDay: END, today: addDays(END, 90), candidatesOn: () => ['dubu'] });
  assert.equal(M2.ask, null);
  // 마음 사라짐
  const M3 = movingState({}); M3.ask = { slug: 'bori', day: addDays(END, 10) }; M3.rolled = addDays(END, 10);
  rollAsk({ M: M3, endedDay: END, today: addDays(END, 16), candidatesOn: () => [] });
  assert.equal(M3.ask, null);
  assert.equal(M3.quietFrom, addDays(END, 16));
});

test('떠나는 단계: 허락한 날 → 다음 날 이삿짐 → 그다음 날 떠남 · 떠난 주민 편지 3일 뒤부터 12일마다 4통', () => {
  const L = leavePlan('bori', 'home:bori', '2027-04-10');
  assert.equal(leaveStage(L, '2027-04-10'), 'asked');
  assert.equal(leaveStage(L, '2027-04-11'), 'boxes');
  assert.equal(leaveStage(L, '2027-04-12'), 'gone');
  assert.equal(leaveStage(L, '2027-05-12'), 'gone');
  const dep = [{ slug: 'bori', day: '2027-04-12', next: addDays('2027-04-12', MOVING.letters.first), sent: 0 }];
  assert.equal(lettersDue(dep, '2027-04-14').length, 0);
  assert.equal(lettersDue(dep, '2027-04-15').length, 1);
  assert.equal(lettersDue(dep, '2027-04-16').length, 0);
  let n = 1;
  for (let d = 0; d < 200; d++) n += lettersDue(dep, addDays('2027-04-16', d)).length;
  assert.equal(n, MOVING.letters.max);
  for (const k of ['moving', 'movein', 'away']) assert.ok(letterPool('gureum', k).every(l => Array.isArray(l) && l.length >= 2), k);
});

test('떠나지 않는 주민 = 섬 축제 부스 주인 + 계절 행사 주인공, 새 주민 셋은 집 색 변형이 있다', () => {
  const hosts = json('assets/events/events.json').list.map(e => e.host).filter(Boolean);
  const fest = JSON.stringify(json('assets/festival/config.json'));
  const owners = [...fest.matchAll(/"owner":\s*"([a-z]+)"/g)].map(m => m[1]);
  for (const s of new Set([...hosts, ...owners])) assert.ok(STAY.includes(s), `${s} 는 떠나면 안 된다`);
  const variants = json('assets/env/specs/house-villager.json').variants ?? {};
  for (const [slug, v] of Object.entries(ROOF)) assert.ok(v in variants, `${slug} 집 변형 ${v} (배경 house-villager variants)`);
  for (const s of MOVERS) assert.ok(!VILLAGERS.includes(s), `${s} 는 처음부터 사는 주민이 아니다`);
});

test('남는 집터: 섬에 셋 (11차 D103-A), 다른 집·건물·서로 안 겹치고 처음 물체 목록은 그 자리 풀·나무만 빠진다', () => {
  const specs = Object.fromEntries(BUILDING_KINDS.map(k => [k, json(`assets/env/specs/${k}.json`)]));
  const layout = json('assets/island/layout.json');
  const g = generateIsland(20261028, { ...ISLAND, villagers: VILLAGERS, lots: lotsOf(specs), layout });
  assert.equal(SPARE_LOTS.length, 3);
  assert.equal(g.places.spareLots.length, SPARE_LOTS.length, '기본 섬에서 셋 다 찾는다');
  assert.deepEqual(g.places.spareLots.map(s => s.id), ['spare-1', 'spare-2', 'spare-3']);
  // 앞 집터는 10차 그대로 (예전 저장의 spare-1 이사 주민이 같은 자리)
  assert.deepEqual([g.places.spareLots[0].x, g.places.spareLots[0].z], [8.5, 5.5]);
  // 처음 주민 7 + 남는 집터 3 = 새 주민 셋이 모두 들어갈 자리
  assert.ok(g.places.villagerHouses.length + g.places.spareLots.length >= VILLAGERS.length + MOVERS.length);
  for (const sp of g.places.spareLots) {
    assert.equal(sp.slug, null);
    assert.ok(sp.lot && sp.site && sp.lot.pad.off, `${sp.id} 빈 집터 · 계단 꺼짐`);
    for (const b of g.buildings.filter(b => !(b.tx0 === sp.lot.tx && b.tz0 === sp.lot.tz))) {
      const sep = sp.lot.tx + sp.lot.fw + 1 <= b.tx0 || b.tx0 + b.fw + 1 <= sp.lot.tx || sp.lot.tz + sp.lot.fd + 1 <= b.tz0 || b.tz0 + b.fd + 1 <= sp.lot.tz;
      assert.ok(sep, `${sp.id} 가 ${b.kind} (${b.data?.owner ?? ''}) 와 떨어져 있다`);
    }
    for (const o of g.objects) {
      const inLot = o.tx >= sp.lot.tx && o.tx < sp.lot.tx + sp.lot.fw && o.tz >= sp.lot.tz && o.tz < sp.lot.tz + sp.lot.fd;
      assert.ok(!inLot, `${sp.id} 집터 안 물체 ${o.id}`);
    }
  }
  // 처음부터 있는 집에도 site (떠나면 빈 집터로)
  for (const h of g.places.villagerHouses) assert.ok(h.site && Number.isInteger(h.site.cx), h.slug);
});
