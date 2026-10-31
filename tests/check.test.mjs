// 기기 점검·저사양 기준·시작 단추 (M7-P2 · 보드 wave7 D39-A · D45-A · UI-07 · UI-11)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAZA, frameStats, percentile, isPlazaSlow, plazaArea, inArea, createPlazaWatch } from '../src/render/quality.js';
import { CHECK, ROUTE, CHECK_STORE, routeSpots, buildRecord, checkProblems, checkRequested } from '../src/render/check.js';
import { createEvents } from '../src/core/events.js';
import { createState } from '../src/core/state.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PLACES = {
  plaza: { x: 2.5, z: -1.5 },
  festival: { center: { x: 4.5, z: -1.5 }, radius: 6 },
  dock: { x: -10, z: 20 },
  playerHouse: { x: 8, z: 6, door: { x: 8.5, z: 8.5 } },
};

test('점검: 프레임 통계 — 평균·가운데·95%·가장 긴 것', () => {
  assert.deepEqual(frameStats([]), { n: 0, avg: null, p50: null, p95: null, max: null });
  const list = Array.from({ length: 100 }, (_, i) => i + 1);    // 1..100
  assert.deepEqual(frameStats(list), { n: 100, avg: 50.5, p50: 50, p95: 95, max: 100 });
  assert.equal(percentile([5], 0.95), 5);
  assert.equal(frameStats([16.666, 16.667, 50]).avg, 27.78, '소수 둘째 자리');
});

test('저사양 기준: 광장 평균이 33ms 를 넘을 때만, 표본이 모자라면 판단하지 않는다', () => {
  assert.equal(PLAZA.slowMs, 33, '보드 D39-A 목표');
  const st = (avg, n = 90) => ({ n, avg });
  assert.equal(isPlazaSlow(st(33)), false, '딱 33ms 는 목표 안');
  assert.equal(isPlazaSlow(st(33.01)), true);
  assert.equal(isPlazaSlow(st(80, PLAZA.minSamples - 1)), false, '표본 모자람');
  assert.equal(isPlazaSlow(null), false);
});

test('저사양 기준: 광장 자리 = 축제 광장 가운데 (없으면 광장 자리)', () => {
  assert.deepEqual(plazaArea(PLACES), { x: 4.5, z: -1.5, r: 6 + PLAZA.pad });
  assert.deepEqual(plazaArea({ plaza: { x: 1, z: 2 } }), { x: 1, z: 2, r: PLAZA.radius });
  assert.equal(plazaArea({}), null);
  assert.equal(inArea(plazaArea(PLACES), { x: 4.5 + 7.9, z: -1.5 }), true);
  assert.equal(inArea(plazaArea(PLACES), { x: 4.5 + 8.1, z: -1.5 }), false);
});

/** 광장 판단 흉내: fps 로 frames 장을 그린다 (where = 플레이어 자리) */
function runWatch({ fps, frames, where = PLACES.festival.center, indoorAt = -1 }) {
  let t = 0, slow = 0;
  const events = createEvents();
  const ctx = { events, services: { player: { position: { ...where } }, world: { places: PLACES } } };
  const w = createPlazaWatch(ctx, { onSlow: () => slow++, now: () => t });
  for (let i = 0; i < frames; i++) {
    if (i === indoorAt) events.emit('scene:indoor', { on: true });
    t += 1000 / fps;
    w.end(1 / fps);
  }
  return { result: w.result, slow };
}

test('저사양 기준: 광장에서 25fps 면 low 로 한 번, 60fps 면 그대로', () => {
  const slowRun = runWatch({ fps: 25, frames: 400 });
  assert.equal(slowRun.result.state, 'done');
  assert.equal(slowRun.result.slow, true);
  assert.equal(slowRun.slow, 1, '한 번만 부른다');
  assert.ok(Math.abs(slowRun.result.frame.avg - 40) < 0.01);
  const fast = runWatch({ fps: 60, frames: 400 });
  assert.equal(fast.result.slow, false);
  assert.equal(fast.slow, 0);
  assert.ok(fast.result.frame.n >= PLAZA.sampleSec * 60 - 2);
});

test('저사양 기준: 광장 밖·집 안에서는 재지 않는다', () => {
  const away = runWatch({ fps: 10, frames: 300, where: { x: 40, z: 40 } });
  assert.equal(away.result.state, 'wait');
  assert.equal(away.slow, 0);
  const indoor = runWatch({ fps: 10, frames: 300, indoorAt: 5 });
  assert.notEqual(indoor.result.state, 'done');
  assert.equal(indoor.slow, 0);
});

test('점검: 30초 — 쉬는 시간 + 광장·선착장·집 앞', () => {
  assert.deepEqual(ROUTE.map(r => r.id), ['plaza', 'dock', 'home']);
  assert.equal(CHECK.warm + ROUTE.reduce((n, r) => n + r.sec, 0), CHECK.total);
  assert.equal(CHECK.total, 30, '보드 UI-07: 30초');
  const spots = routeSpots(PLACES);
  assert.deepEqual(spots.map(s => s.id), ['plaza', 'dock', 'home']);
  assert.equal(spots[0].x, 4.5, '광장은 축제 광장 가운데');
  assert.ok(spots[0].walk && spots[0].r > 0 && spots[0].r <= 2.5, '광장에서 작은 원');
  assert.deepEqual([spots[1].x, spots[1].z], [-10, 20]);
  assert.equal(spots[2].z, 8.5 + 1.2, '집 문 앞');
  // 선착장이 없으면 그 시간은 광장에 (모두 합해 그대로 30초)
  const noDock = routeSpots({ ...PLACES, dock: null });
  assert.deepEqual(noDock.map(s => s.id), ['plaza', 'home']);
  assert.equal(CHECK.warm + noDock.reduce((n, s) => n + s.sec, 0), CHECK.total);
  assert.deepEqual(routeSpots(null), []);
});

function sampleRecord(over = {}) {
  const spots = routeSpots(PLACES);
  const mk = (ms, n) => ({ gaps: Array(n).fill(ms), render: Array(n).fill(3), finish: Array(n / 8 | 0).fill(ms - 2), calls: Array(n).fill(120), tris: Array(n).fill(90000) });
  return buildRecord({
    spots,
    samples: { plaza: mk(20, 600), dock: mk(16, 380), home: mk(18, 380) },
    device: { gpu: 'ANGLE (Intel, Intel(R) UHD Graphics)', vendor: 'Google Inc. (Intel)', webgl: 2, screen: { w: 1920, h: 1080, vw: 1280, vh: 720, dpr: 1.5, ratio: 1.5, canvas: [1920, 1080], portrait: false }, touch: false, ua: 'test' },
    quality: { start: 'high', end: 'high', changes: [], fixed: false },
    errors: { count: 7, list: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
    time: { hour: 14, season: 'autumn', weather: 'sunny' },
    startedAt: '2026-10-31T05:00:00.000Z', ms: 28012.4, build: 'abc1234', where: 'local',
    ...over,
  });
}

test('점검: 저장 모양 — 자리마다 프레임·그리기·호출, 광장 목표, 오류는 다섯 줄까지', () => {
  const rec = sampleRecord();
  assert.deepEqual(checkProblems(rec), []);
  assert.equal(rec.v, CHECK_STORE.version);
  assert.equal(CHECK_STORE.collection, 'checks');
  assert.deepEqual(Object.keys(rec).sort(), ['at', 'build', 'device', 'errors', 'frame', 'kind', 'ms', 'plaza', 'quality', 'stops', 'time', 'v', 'where'].sort());
  assert.equal(rec.ms, 28012);
  assert.equal(rec.frame.n, 600 + 380 + 380);
  assert.deepEqual(rec.stops.map(s => [s.id, s.frame.avg, s.calls.avg, s.calls.max]), [['plaza', 20, 120, 120], ['dock', 16, 120, 120], ['home', 18, 120, 120]]);
  assert.equal(rec.stops[0].draw.avg, 18);
  assert.deepEqual(rec.plaza, { avg: 20, p95: 20, goal: 33, ok: true });
  assert.equal(rec.errors.count, 7);
  assert.equal(rec.errors.list.length, CHECK.maxErrors);
  assert.ok(JSON.stringify(rec).length < 8 * 1024, '저장소 문서 하나로 넉넉');
  // 광장이 느리면 ok: false
  const slow = sampleRecord({ samples: { plaza: { gaps: Array(90).fill(41) }, dock: {}, home: {} } });
  assert.equal(slow.plaza.ok, false);
  assert.equal(slow.stops[1].frame.avg, null, '표본 없는 자리는 null (undefined 없음)');
  assert.deepEqual(checkProblems(slow), []);
});

test('점검: 모양 검사가 틀린 것을 잡는다', () => {
  assert.ok(checkProblems({}).length >= 4);
  const bad = sampleRecord();
  bad.stops.push({ id: 'moon' });
  bad.device.gpu = '';
  bad.at = 'yesterday';
  bad.frame.avg = NaN;
  const p = checkProblems(bad).join(' / ');
  for (const w of ['moon', 'gpu', 'at', 'NaN']) assert.ok(p.includes(w), `${w} → ${p}`);
});

test('점검: render/index.js 는 주소에 check 가 있을 때만 점검을 만들고, 광장 판단은 high 일 때만', () => {
  const src = read('src/render/index.js');
  assert.match(src, /checkRequested\(location\) \? createCheck\(/);
  assert.match(src, /if \(quality === 'high'\) plazaQ\?\.end\(dt\)/);
  assert.match(src, /check\?\.begin\(\)/);
  assert.match(src, /check\?\.end\(dt\)/);
});

test('점검: 켜는 주소 — 로컬 ?check, claude.ai 게시본 #check', () => {
  assert.equal(checkRequested({ search: '?check' }), true);
  assert.equal(checkRequested({ search: '?debug&check' }), true);
  assert.equal(checkRequested({ hash: '#check' }), true);
  assert.equal(checkRequested({ search: '', hash: '' }), false);
  assert.equal(checkRequested({ search: '?checker=1' }), false);
  assert.equal(checkRequested({ hash: '#checklist' }), false);
  assert.equal(checkRequested(), false);
});

test('시작 단추: 로딩 화면 끝에 「소리 켜고 시작」·「소리 없이 시작」과 iPhone 무음 안내 (UI-11)', () => {
  const html = read('tools/web-loader.html');
  assert.match(html, /id="ld-sound"[^>]*>[\s\S]*?소리 켜고 시작<\/button>/);
  assert.match(html, /id="ld-mute"[^>]*>소리 없이 시작<\/button>/);
  assert.match(html, /iPhone[^<]*무음/);
  // 첫 누름에 audio 가 깨기 전에 크기를 정한다 (창 capture)
  assert.match(html, /addEventListener\(type, early, \{ capture: true/);
});

test('시작 단추: 소리 기본값은 그대로 0.6 · 0.8 · 0.7 (D45-A)', () => {
  const s = createState().settings;
  assert.deepEqual([s.bgm, s.sfx, s.voice], [0.6, 0.8, 0.7]);
});
