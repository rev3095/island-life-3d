// 기기 점검·저사양 기준·시작 단추 (M7-P2 · 보드 wave7 D39-A · D45-A · UI-07 · UI-11)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAZA, frameStats, percentile, isPlazaSlow, plazaArea, inArea, createPlazaWatch, QUALITY, QUALITY_ORDER, QUALITY_LABELS, DEFAULT_QUALITY, lowerQuality, urlQuality, normalizeQuality, ratioFor, createFrameGate } from '../src/render/quality.js';
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

test('점검: render/index.js 는 주소에 check 가 있을 때만 점검을 만들고, 광장 판단은 매우 낮음이 아닐 때만 (느리면 한 칸씩)', () => {
  const src = read('src/render/index.js');
  assert.match(src, /checkRequested\(location\) \? createCheck\(/);
  assert.match(src, /quality === LAST \|\| !ctx\.lights \? null/);
  assert.match(src, /setQuality\(lowerQuality\(quality\)/);
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

test('사양: 넷 — 높음·적정·낮음·매우 낮음, 처음은 적정, 한 칸씩 내려가 매우 낮음에서 멈춤', () => {
  assert.deepEqual(QUALITY_ORDER, ['high', 'mid', 'low', 'min']);
  assert.deepEqual(QUALITY_LABELS, { high: '높음', mid: '적정', low: '낮음', min: '매우 낮음' });
  assert.equal(DEFAULT_QUALITY, 'mid');
  // 높음만 그림자·화면 효과, 적정까지 외곽선, 매우 낮음만 초당 30장
  assert.deepEqual(QUALITY_ORDER.map(q => QUALITY[q].shadows), [true, false, false, false]);
  assert.deepEqual(QUALITY_ORDER.map(q => QUALITY[q].post), [true, false, false, false]);
  assert.deepEqual(QUALITY_ORDER.map(q => QUALITY[q].outlines), [true, true, false, false]);
  assert.deepEqual(QUALITY_ORDER.map(q => QUALITY[q].fps), [0, 0, 0, 30]);
  assert.equal(lowerQuality('high'), 'mid');
  assert.equal(lowerQuality('mid'), 'low');
  assert.equal(lowerQuality('low'), 'min');
  assert.equal(lowerQuality('min'), 'min');
  assert.equal(lowerQuality('lite'), 'low');            // 예전 이름 lite = 적정
  assert.equal(normalizeQuality('lite'), 'mid');
  assert.equal(normalizeQuality('ultra'), null);
});

test('사양: 화소 배율 — 큰 창은 낮음·매우 낮음에서 작게, 작은 창(휴대폰)은 1, 0.5 아래로 안 내림', () => {
  assert.equal(ratioFor('high', 1920, 1080, 1.5), 1.5);
  assert.equal(ratioFor('high', 1920, 1080, 3), 2);
  assert.equal(ratioFor('mid', 1920, 1080, 1.5), 1);
  assert.equal(ratioFor('mid', 390, 844, 3), 1);
  assert.ok(ratioFor('low', 1920, 1080, 1) < 0.7 && ratioFor('low', 1920, 1080, 1) >= 0.6);   // 화소 75만 개 안쪽
  assert.ok(ratioFor('low', 1920, 1080, 1) ** 2 * 1920 * 1080 <= 750_000 * 1.01);
  assert.equal(ratioFor('low', 390, 844, 3), 1);
  assert.equal(ratioFor('min', 1920, 1080, 1), 0.5);    // √(40만 ÷ 207만) ≈ 0.44 → 0.5
  assert.ok(ratioFor('min', 1280, 800, 1) < ratioFor('low', 1280, 800, 1));
  assert.ok(ratioFor('low', 1280, 800, 1) < ratioFor('mid', 1280, 800, 1));
  assert.equal(ratioFor('min', 0, 0, 1), 1);            // 크기를 모를 때는 배율 상한만
});

test('사양: 주소로 고르기 — 로컬 ?quality=, claude.ai 게시본 #low · #min · #quality=high, 예전 #lite = 적정', () => {
  assert.equal(urlQuality({ search: '?quality=low' }), 'low');
  assert.equal(urlQuality({ search: '?quality=lite' }), 'mid');
  assert.equal(urlQuality({ search: '?quality=min&debug' }), 'min');
  assert.equal(urlQuality({ hash: '#lite' }), 'mid');
  assert.equal(urlQuality({ hash: '#mid' }), 'mid');
  assert.equal(urlQuality({ hash: '#min' }), 'min');
  assert.equal(urlQuality({ hash: '#quality=high' }), 'high');
  assert.equal(urlQuality({ hash: '#low&check' }), 'low');
  assert.equal(urlQuality({ search: '?quality=ultra' }), null);
  assert.equal(urlQuality({ hash: '#check' }), null);
  assert.equal(urlQuality({ hash: '#lights' }), null);
  assert.equal(urlQuality({ hash: '#minimal' }), null);
  assert.equal(urlQuality({}), null);
});

test('사양: main.js 는 처음 사양을 주소 또는 적정으로, 그림자는 QUALITY 값, 매우 낮음은 초당 장수 상한', () => {
  const src = read('src/main.js');
  assert.match(src, /urlQuality\(location\) \?\? DEFAULT_QUALITY/);
  assert.match(src, /sun\.castShadow = QUALITY\[quality\]\.shadows/);
  assert.match(src, /gate\(clock\.getDelta\(\), QUALITY\[ctx\.quality\]\?\.fps\)/);
  assert.match(src, /prefetchPacks/);
});

test('사양: 섬폰 설정·로딩 화면에 네 단추, 고르면 settings.spec 으로', () => {
  const phone = read('src/ui/phone.js');
  assert.match(phone, /\['min', '매우 낮음'\], \['low', '낮음'\], \['mid', '적정'\], \['high', '높음'\]/);
  assert.match(phone, /setSetting\('spec', m\)/);
  const loader = read('tools/web-loader.html');
  for (const q of ['min', 'low', 'mid', 'high']) assert.match(loader, new RegExp(`data-q="${q}"`));
  assert.match(loader, /setSetting\('spec', q\)/);
  const render = read('src/render/index.js');
  assert.match(render, /key === 'spec'/);
  assert.match(render, /compileAsync/);
});

test('사양: 초당 장수 상한 — 60Hz 화면에서 매우 낮음(30)은 두 번에 한 번, 상한 없으면 매번', () => {
  const gate = createFrameGate();
  const hz = 1 / 60;
  const drawn = Array.from({ length: 60 }, () => gate(hz, 30)).filter(dt => dt !== null);
  assert.equal(drawn.length, 30);
  for (const dt of drawn) assert.ok(Math.abs(dt - 2 * hz) < 1e-9);       // 건너뛴 시간까지 모아서
  const free = createFrameGate();
  assert.equal(Array.from({ length: 60 }, () => free(hz, 0)).filter(dt => dt !== null).length, 60);
  assert.equal(free(1, 0), 0.05);                                          // 오래 멈췄다 와도 0.05 까지
  const slow = createFrameGate();                                          // 화면이 30Hz 보다 느리면 매번 그린다
  assert.equal(Array.from({ length: 20 }, () => slow(1 / 24, 30)).filter(dt => dt !== null).length, 20);
});
