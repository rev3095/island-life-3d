// M18-P3 계절 낚시·곤충 대회 규칙 (15차 보드 wave15 D194-A): 날짜 · 행사와 안 겹침 · 크기 · 점수 · 주민 참가자 · 순위 · 상 · 연결
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as R from '../src/gameplay/contest/rules.js';
import { windowOf } from '../src/gameplay/events/calendar.js';
import * as items from '../src/data/items.js';
import { STAY } from '../src/gameplay/town/moving.js';
import { TRIGGERS } from '../src/gameplay/story/rules.js';
import { SCENE_FILES as STORY_FILES } from '../src/gameplay/story/files.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const cfg = JSON.parse(read('assets/contest/contest.json'));
const events = JSON.parse(read('assets/events/events.json'));

test('대회 날짜: 낚시 3·7·12월 · 곤충 5·10월, 하루씩, 9–18시, 엔딩 뒤', () => {
  const months = k => cfg.list.filter(c => c.kind === k).map(c => c.date.month).sort((a, b) => a - b);
  assert.deepEqual(months('fish'), [3, 7, 12]);
  assert.deepEqual(months('bug'), [5, 10]);
  assert.deepEqual(cfg.hours, [9, 18]);
  assert.equal(new Set(cfg.list.map(c => c.id)).size, cfg.list.length);
  assert.equal(cfg.open.after, 'ending');
  assert.equal(R.isOpen(cfg, {}), false);
  assert.equal(R.isOpen(cfg, { endedDay: '2026-11-01' }), true);
  assert.ok(R.inHours(cfg, 9) && R.inHours(cfg, 17.99) && !R.inHours(cfg, 8.99) && !R.inHours(cfg, 18));
});

test('대회 날은 계절 행사 7일과 겹치지 않는다 (여러 해)', () => {
  const days = events.dates?.days ?? 7;
  for (let y = 2026; y <= 2034; y++) {
    const wins = events.list.map(ev => windowOf(ev, y, days)).concat(events.list.map(ev => windowOf(ev, y - 1, days)));
    for (const { c, day } of R.yearDays(cfg, y)) {
      for (const w of wins) assert.ok(!(day >= w.from && day <= w.to), `${y} ${c.name} ${day} 가 행사 ${w.from}~${w.to} 와 겹침`);
    }
  }
});

test('contestOn: 그날만 · 섬 축제 날은 쉼 · upcoming 은 가까운 순', () => {
  assert.equal(R.contestOn(cfg, '2027-03-20')?.id, 'CT-01');
  assert.equal(R.contestOn(cfg, '2027-10-05')?.kind, 'bug');
  assert.equal(R.contestOn(cfg, '2027-03-21'), null);
  assert.equal(R.contestOn(cfg, '2027-03-20', { festivalToday: true }), null);
  const u = R.upcoming(cfg, '2027-11-13');
  assert.equal(u[0].c.id, 'CT-05'); assert.equal(u[0].day, '2027-12-10'); assert.equal(u[0].until, 27);
  assert.equal(u[1].day, '2028-03-20');
  assert.equal(R.upcoming(cfg, '2027-07-20')[0].until, 0);
});

test('크기: 물고기는 그림자 크기, 곤충은 값 구간 — 기준 ± spread, 큰 것일수록 크다', () => {
  const fish = items.list('fish'), bugs = items.list('bug');
  for (const it of fish) for (const r of [0, 0.5, 1]) assert.ok(R.sizeOf(cfg, 'fish', it, r) > 0, it.id);
  const small = fish.find(f => f.shadow === 1), big = fish.find(f => f.shadow === 6);
  assert.ok(R.sizeOf(cfg, 'fish', big, 0) > R.sizeOf(cfg, 'fish', small, 1));
  const cheap = bugs.reduce((a, b) => (a.price < b.price ? a : b)), dear = bugs.reduce((a, b) => (a.price > b.price ? a : b));
  assert.ok(R.sizeOf(cfg, 'bug', dear, 0) > R.sizeOf(cfg, 'bug', cheap, 1));
  const s = cfg.size.spread, base = cfg.size.fish.byShadow['3'];
  assert.equal(R.sizeOf(cfg, 'fish', { shadow: 3 }, 0), Math.round(base * (1 - s) * 10) / 10);
  assert.equal(R.sizeOf(cfg, 'fish', { shadow: 3 }, 1), Math.round(base * (1 + s) * 10) / 10);
});

test('점수 = 가장 큰 것 + 마릿수 × perCatch · 순위 = 점수 → 먼저 닿은 쪽 → 플레이어', () => {
  assert.deepEqual(R.scoreOf(cfg, []), { best: 0, count: 0, score: 0 });
  assert.deepEqual(R.scoreOf(cfg, [{ size: 20, t: 5 }, { size: 31.5, t: 9 }]), { best: 31.5, count: 2, score: 51.5 });
  const rows = R.standings(cfg, [
    { who: 'player', catches: [{ size: 30, t: 50 }] },
    { who: 'bori', catches: [{ size: 30, t: 20 }] },
    { who: 'pong', catches: [{ size: 10, t: 5 }, { size: 12, t: 8 }, { size: 14, t: 170 }] },
  ]);
  assert.deepEqual(rows.map(r => r.who), ['pong', 'bori', 'player']);   // pong 44 · bori 40(20초) · player 40(50초)
  assert.deepEqual(rows.map(r => r.rank), [1, 2, 3]);
  const early = R.standings(cfg, [{ who: 'player', catches: [{ size: 30, t: 50 }] }, { who: 'pong', catches: [{ size: 10, t: 5 }, { size: 12, t: 8 }, { size: 14, t: 170 }] }], 60);
  assert.equal(early[0].who, 'player');   // 60초엔 pong 이 32점 · 플레이어 40점
  const tie = R.standings(cfg, [{ who: 'bori', catches: [{ size: 30, t: 20 }] }, { who: 'player', catches: [{ size: 30, t: 20 }] }]);
  assert.equal(tie[0].who, 'player');
});

test('주민 참가자: 사회 주민 빼고 셋, 날짜로 늘 같고, 제한 시간 안에 잡는다', () => {
  const residents = ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'danpung'];
  const c = cfg.list[0];
  const a = R.rivalsOf(cfg, c, '2027-03-20', residents, 7), b = R.rivalsOf(cfg, c, '2027-03-20', [...residents].reverse(), 7);
  assert.deepEqual(a, b);
  assert.equal(a.length, cfg.rivals.count);
  assert.ok(!a.some(r => r.slug === cfg.host));
  assert.equal(new Set(a.map(r => r.slug)).size, a.length);
  for (const r of a) {
    assert.ok(r.catches.length >= cfg.rivals.catches.fish[0] && r.catches.length <= cfg.rivals.catches.fish[1]);
    for (const x of r.catches) assert.ok(x.t > 0 && x.t < cfg.seconds && x.size > 0);
    const best = Math.max(...r.catches.map(x => x.size));
    assert.ok(best >= cfg.rivals.best.fish[0] && best <= cfg.rivals.best.fish[1]);
    assert.deepEqual(r.catches.map(x => x.t), [...r.catches.map(x => x.t)].sort((p, q) => p - q));
  }
  assert.notDeepEqual(R.rivalsOf(cfg, c, '2028-03-20', residents, 7), a);
  assert.equal(R.rivalsOf(cfg, c, '2027-03-20', ['chorong', 'bori'], 1).length, 1);   // 주민이 적으면 있는 만큼
  // 사회 주민은 섬을 떠나지 않는다 (이사 STAY)
  assert.ok(STAY.includes(cfg.host));
});

test('주민 점수가 3분 대회에서 해 볼 만한 범위 (봇이 흉내 낸 기록과 비교)', () => {
  // 3분 동안 보통 물고기 3~5마리 · 곤충 2~4마리 (자동 플레이 기록 기준) — 1등 주민을 넘을 수 있는 날도, 못 넘는 날도 있어야 한다
  const residents = ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'danpung'];
  for (const c of cfg.list) {
    const typical = c.kind === 'fish' ? [14, 28, 28, 45] : [4, 6, 6];
    const me = typical.map((s, i) => ({ size: s, t: 30 + i * 30 }));
    let wins = 0, losses = 0;
    for (let y = 2027; y < 2047; y++) {
      const rank = R.standings(cfg, [{ who: 'player', catches: me }, ...R.rivalsOf(cfg, c, R.dateOf(c, y), residents, 3).map(r => ({ who: r.slug, catches: r.catches }))]).find(r => r.who === 'player').rank;
      if (rank === 1) wins++; else losses++;
    }
    assert.ok(wins >= 2 && losses >= 2, `${c.name}: 20년 중 1등 ${wins} · 아님 ${losses}`);
  }
});

test('상: 1–3등 트로피 FU-89–91 + 도토리, 4등 아래·못 잡음은 참가 도토리', () => {
  const p1 = R.prizeOf(cfg, 1), p2 = R.prizeOf(cfg, 2), p3 = R.prizeOf(cfg, 3), p4 = R.prizeOf(cfg, 4), p0 = R.prizeOf(cfg, 1, 0);
  assert.deepEqual([p1.item, p2.item, p3.item], ['furn.trophy-gold', 'furn.trophy-silver', 'furn.trophy-bronze']);
  assert.ok(p1.acorns > p2.acorns && p2.acorns > p3.acorns && p3.acorns > p4.acorns && p4.acorns > 0);
  assert.equal(p4.item, null); assert.equal(p0.item, null); assert.equal(p0.acorns, p4.acorns);
  assert.equal(R.prizeOf(cfg, 9).item, null);
  for (const [id, code] of [['furn.trophy-gold', 'FU-89'], ['furn.trophy-silver', 'FU-90'], ['furn.trophy-bronze', 'FU-91']]) {
    const it = items.get(id);
    assert.ok(it, id); assert.equal(it.code, code); assert.equal(it.source, 'contest'); assert.equal(it.category, 'furn');
  }
});

test('연결: 무대 BD-17 · 트로피 모델(review) · 섬 일지 목표 · 장면 s29 · 모듈 목록 · 묶음', () => {
  const stage = JSON.parse(read('assets/env/specs/contest-stage.json'));
  assert.equal(stage.id, 'BD-17'); assert.equal(stage.status, 'review');
  assert.ok(existsSync(new URL('../assets/env/models/contest-stage.glb.json', import.meta.url)));
  assert.deepEqual(cfg.assets.env, [cfg.stage.env]);
  for (const s of ['trophy-gold', 'trophy-silver', 'trophy-bronze']) {
    assert.equal(JSON.parse(read(`assets/furniture/specs/${s}.json`)).status, 'review');
    assert.ok(existsSync(new URL(`../assets/furniture/models/${s}.glb.json`, import.meta.url)), s);
  }
  const jn = JSON.parse(read('assets/journal/journal.json'));
  assert.ok(jn.goals.some(g => g.on === 'contest' && g.label === '대회 나가기'));
  assert.match(read('src/gameplay/journal/index.js'), /'contest:enter'.*count\('contest'\)/);
  assert.equal(TRIGGERS['contest-first'].event, 'contest:enter');
  assert.ok(STORY_FILES.includes('assets/story/scenes/s29-first-contest.json'));
  const sc = JSON.parse(read('assets/story/scenes/s29-first-contest.json'));
  assert.equal(sc.trigger.on, 'contest-first'); assert.equal(sc.status, 'review');
  assert.ok(sc.takes.every(t => t.shots.some(s => s.actors.some(a => a.who === cfg.host))));
  assert.match(read('src/gameplay/index.js'), /\['contest', '\.\/contest\/index\.js'\]/);
  assert.match(read('src/gameplay/gather/results.js'), /'gather:catch'/);
  // 행동 키 우선순위: 축제 시작·행사 할 일 101 · 눈덩이 102 · 소원 103 과 다른 값
  assert.match(read('src/gameplay/contest/index.js'), /name: 'contest:desk', intent: 'action', priority: 104/);
});

import { generateIsland, createIslandApi, lotsOf, BUILDING_KINDS } from '../src/world/island.js';
import { carveFestival } from '../src/world/festival.js';

test('무대 자리: 섬 지도(layout 시드)에서 광장 가까이, 칸이 비고 평평하고, 문·모닥불·축제 무대에서 떨어져', () => {
  const spec = slug => JSON.parse(read(`assets/env/specs/${slug}.json`));
  const festCfg = JSON.parse(read('assets/festival/config.json'));
  const layout = JSON.parse(read('assets/island/layout.json'));
  const gen = generateIsland(layout.seed, { lots: lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, spec(k)]))) });
  const F = carveFestival(gen, { config: festCfg, specs: { 'festival-stage': spec('festival-stage') } });
  const isl = createIslandApi(gen);
  const taken = new Set(gen.objects.map(o => `${o.tx},${o.tz}`));
  const OK = new Set(['grass', 'plaza', 'path']);
  const isFree = (tx, tz) => isl.isWalkableTile(tx, tz) && OK.has(isl.tileAt(tx, tz)) && !taken.has(`${tx},${tz}`);
  const places = { ...gen.places, festival: F };
  const q = { isFree, levelAt: isl.levelAt, toTile: isl.toTile, toWorld: isl.toWorld };
  const s = R.stageSpot(places, q, { offset: cfg.stage.offset });
  assert.ok(s, '무대 자리가 없음');
  assert.equal(s.tier, 0, '첫 단계(앞 줄까지 빈 곳)에서 찾음');
  for (let z = -1; z <= R.STAGE_TIERS[s.tier].rows; z++) for (let x = -1; x <= 1; x++) assert.ok(isFree(s.tx + x, s.tz + z), `칸 ${x},${z}`);
  assert.ok(Math.hypot(s.x - F.center.x, s.z - F.center.z) >= F.radius + 3);
  for (const b of [places.shop, places.museum, places.playerHouse, ...places.villagerHouses]) if (b?.door) assert.ok(Math.hypot(b.door.x - s.front.x, b.door.z - s.front.z) >= 4, '문 앞');
  assert.ok(Math.hypot(s.x - places.plaza.x, s.z - places.plaza.z) < 30, '광장에서 너무 멂');
  // 앞 줄이 다 막혀도(꽃·꾸민 물건) 다음 단계에서 찾는다
  const s2 = R.stageSpot(places, { ...q, isFree: (tx, tz) => isFree(tx, tz) && !(tz === s.tz + 3) }, { offset: cfg.stage.offset });
  assert.ok(s2);
  // 행상 수레 둘레는 피한다
  const s3 = R.stageSpot(places, q, { offset: cfg.stage.offset, avoid: [{ x: s.x, z: s.z, r: 5 }] });
  assert.ok(s3 && Math.hypot(s3.x - s.x, s3.z - s.z) >= 5);
});
