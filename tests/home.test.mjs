// M14 집 증축 (결정 D150-A·D151-A): 단계·빚·갚기 · 층 목록 · 계단 높이·트리거·도착 자리 · 내 집 방 파일 RM-15–17
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as HM from '../src/gameplay/house/home.js';
import { fits } from '../src/gameplay/house/grid.js';

const J = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const CFG = J('assets/interior/home.json');
const ROOMS = Object.fromEntries(HM.ROOM_FILES.map(f => J(f)).map(r => [r.slug, r]));
const BASE = { n: 0, size: [8, 8], origin: { x: 500, z: 0 }, windows: ['n:1', 'n:6'], door: { gx0: 3, gx1: 4 }, fixtures: [] };

test('집 증축 설정: 단계 0–3, 값이 기본값과 같고 방·겉모양이 있다', () => {
  assert.deepEqual(CFG.stages.map(s => s.stage), [0, 1, 2, 3]);
  assert.deepEqual(CFG.stages.map(s => s.cost ?? 0), HM.DEFAULT_HOME.stages.map(s => s.cost ?? 0));
  for (const s of CFG.stages.slice(1)) {
    assert.ok(ROOMS[s.room], s.room);
    assert.equal(J(`assets/env/specs/${s.exterior}.json`).id, `BD-12-${s.stage}`);
  }
  assert.equal(HM.maxStage(CFG), 3);
});

test('빚: 짓기 → 공사 중 → 다음 날 완공 → 갚기 → 다음 단계', () => {
  const S = {};
  const g = HM.ensureGrow(S, CFG);
  assert.deepEqual([g.stage, g.debt, g.pending], [0, 0, null]);
  assert.equal(HM.offer(g, CFG).kind, 'build');
  const st = HM.startBuild(g, CFG);
  assert.equal(st.stage, 1);
  assert.equal(g.debt, 20000);
  assert.equal(HM.offer(g, CFG).kind, 'pending');
  assert.equal(HM.startBuild(g, CFG), null, '공사 중엔 또 못 짓는다');
  assert.equal(HM.finishBuild(g), 1);
  assert.equal(HM.offer(g, CFG).kind, 'debt');
  assert.equal(HM.startBuild(g, CFG), null, '빚이 있으면 다음 단계 없음');
  // 갚기 단추: 지갑에 있는 만큼만
  assert.deepEqual(HM.repayChoices(g, 500, CFG), [{ label: '있는 만큼 갚기 (500)', amount: 500 }]);
  assert.deepEqual(HM.repayChoices(g, 0, CFG), []);
  assert.deepEqual(HM.repayChoices(g, 30000, CFG).map(c => c.amount), [1000, 10000, 20000]);
  assert.equal(HM.repay(g, 15000), 5000);
  assert.equal(HM.repay(g, 99999), 0, '빚보다 많이 갚지 않는다');
  assert.equal(g.paid, 20000);
  assert.equal(HM.offer(g, CFG).next.stage, 2);
  HM.startBuild(g, CFG); HM.finishBuild(g); HM.repay(g, g.debt);
  HM.startBuild(g, CFG); HM.finishBuild(g); HM.repay(g, g.debt);
  assert.equal(g.stage, 3);
  assert.equal(HM.offer(g, CFG).kind, 'done');
  // 망가진 저장 바로잡기
  const bad = { grow: { stage: 9, debt: -5, pending: 7, decor: 3 } };
  const b = HM.ensureGrow(bad, CFG);
  assert.deepEqual([b.stage, b.debt, b.pending, typeof b.decor], [3, 0, null, 'object']);
});

test('층 목록: 단계마다 1층 크기·층 수·계단', () => {
  const at = n => HM.floorsFor(n, ROOMS, BASE);
  assert.deepEqual(at(0).map(f => f.size), [[8, 8]]);
  assert.deepEqual(at(1).map(f => [f.n, f.size, f.fixtures.length]), [[0, [10, 10], 0]], '넓힌 1층, 계단은 아직');
  assert.deepEqual(at(2).map(f => [f.n, f.fixtures.map(x => x.slug)]), [[0, ['home-stairs']], [1, ['stair-rail']]]);
  assert.deepEqual(at(3).map(f => [f.n, f.fixtures.map(x => x.slug)]), [[0, ['home-stairs']], [1, ['stair-rail', 'attic-stairs']], [2, ['attic-hatch']]]);
  // 층마다 원점이 달라 구역이 겹치지 않는다
  const fl = at(3);
  for (const a of fl) for (const b of fl) if (a !== b) assert.ok(Math.abs(a.origin.z - b.origin.z) >= a.size[1] + b.size[1], `${a.n}·${b.n} 겹침`);
  // 계단 짝: 오르는 계단 to 층에 돌아오는 구멍이 있다
  for (const f of fl) for (const x of f.fixtures) {
    const to = fl[x.to];
    assert.ok(to?.fixtures.some(y => y.to === f.n && y.kind !== x.kind), `${x.slug} → ${x.to}층 짝`);
  }
});

test('1층이 커질 때 가구는 같은 월드 자리 (한 칸씩 옮김), 벽 가구도', () => {
  const d = HM.growShift([8, 8], [10, 10]);
  assert.deepEqual(d, { dx: 1, dz: 1 });
  const recs = [{ gx: 2, gz: 3 }, { wall: 'n', slot: 4 }, { wall: 'e', slot: 2 }, { gx: 0, gz: 0, floor: 1 }];
  HM.shiftRecs(recs, d, 0);
  assert.deepEqual(recs, [{ gx: 3, gz: 4 }, { wall: 'n', slot: 5 }, { wall: 'e', slot: 3 }, { gx: 0, gz: 0, floor: 1 }]);
});

test('계단: 높이 0 → 꼭대기, 꼭대기·구멍에서 다른 층, 도착 자리는 다시 트리거되지 않는다', () => {
  const fl = HM.floorsFor(3, ROOMS, BASE);
  const up = fl[0].fixtures[0], down = fl[1].fixtures[0];
  assert.equal(HM.stairHeight(up, 9, 3), 0);
  assert.ok(Math.abs(HM.stairHeight(up, 9, 0) - 1.7) < 1e-9);
  assert.equal(HM.stairHeight(up, 5, 5), null);
  assert.equal(HM.stairHeight(down, 7, 1), null, '구멍은 높이를 안 바꾼다');
  assert.equal(HM.stairTrigger(fl[0].fixtures, 9, 0.5), up);
  assert.equal(HM.stairTrigger(fl[0].fixtures, 9, 2.5), null);
  assert.equal(HM.stairTrigger(fl[1].fixtures, 6.6, 0.5), down, '열린 서쪽에서 구멍으로');
  for (const f of fl) for (const x of f.fixtures) {
    const to = fl[x.to], pair = to.fixtures.find(y => y.to === f.n);
    const a = HM.arrivalAt(pair, x.kind === 'up' ? 'up' : 'down');
    assert.equal(HM.stairTrigger(to.fixtures, a.lx, a.lz), null, `${x.slug} 도착 자리`);
    assert.equal(HM.stairTrigger(to.fixtures, a.walk.lx, a.walk.lz), null, `${x.slug} 걸어간 자리`);
    assert.ok(a.walk.lx > 0 && a.walk.lx < to.size[0] && a.walk.lz > 0 && a.walk.lz < to.size[1], `${x.slug} 방 안`);
    for (const b of HM.fixtureBlockers(pair)) assert.ok(!(a.walk.lx > b.x0 && a.walk.lx < b.x1 && a.walk.lz > b.z0 && a.walk.lz < b.z1), `${x.slug} 걸어간 자리가 난간 안`);
  }
});

test('내 집 방 파일 RM-15–17: 검사 통과 · 시작 가구가 계단·문 매트와 안 겹친다 · 1층 작업대가 넓힌 방 서쪽 벽', () => {
  for (const r of Object.values(ROOMS)) {
    assert.deepEqual(HM.checkHomeRoom(r), [], r.slug);
    assert.equal(r.owner, 'player');
    const reserved = new Set();
    for (const f of r.fixtures) for (let z = f.gz; z < f.gz + f.d; z++) for (let x = f.gx; x < f.gx + f.w; x++) reserved.add(`${x},${z}`);
    const info = () => ({ footprint: [1, 1] });
    for (const s of r.starter ?? []) assert.ok(fits([], { id: 's', ...s }, info, { reserved, w: r.size[0], d: r.size[1] }), `${r.slug} ${s.item}`);
  }
  assert.deepEqual(ROOMS['rm-15'].workbench, { gx: 0, gz: 3, rot: 1 }, '처음 집 작업대(0, 2) + 한 칸');
});
