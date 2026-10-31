// M7-P4 문제 알리기 (UI-08): 오류 모으기(core/errors.js)와 보고 문서 모양(ui/report.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createErrorLog, installErrors, classifyConsole, errorText, MAX_ERRORS } from '../src/core/errors.js';
import { buildReport, reportText, reportId, sendReport, textFieldKeys, REPORT_KINDS, REPORT_TEXT_MAX } from '../src/ui/report.js';
import { createState } from '../src/core/state.js';
import { SAVE_VERSION } from '../src/data/save.js';

/** addEventListener 만 있는 가짜 window */
function fakeTarget() {
  const subs = {};
  return {
    location: { origin: 'http://localhost:4243', pathname: '/index.html', search: '?debug' },
    addEventListener: (t, fn) => { (subs[t] ??= []).push(fn); },
    removeEventListener: (t, fn) => { subs[t] = (subs[t] ?? []).filter(f => f !== fn); },
    fire: (t, e) => (subs[t] ?? []).forEach(fn => fn(e)),
    subs,
  };
}

test('errorText: 무엇이든 짧은 글로', () => {
  assert.equal(errorText(new TypeError('x is undefined')), 'TypeError: x is undefined');
  assert.equal(errorText(new Error('boom')), 'boom');
  assert.equal(errorText('글'), '글');
  assert.equal(errorText({ message: 'm' }), 'm');
  assert.equal(errorText({ a: 1 }), '{"a":1}');
  assert.equal(errorText(undefined), 'undefined');
  const loop = {}; loop.self = loop;
  assert.equal(typeof errorText(loop), 'string');
});

test('기록장: 같은 오류는 한 줄에 count, 최근 것이 뒤, 개수 제한', () => {
  let t = 0;
  const log = createErrorLog({ now: () => ++t, origin: 'http://h' });
  log.add('error', new Error('a'));
  log.add('error', new Error('b'));
  log.add('error', new Error('a'));
  const r = log.recent();
  assert.deepEqual(r.map(e => [e.message, e.count]), [['b', 1], ['a', 2]]);
  assert.equal(r[1].at, 1);
  assert.equal(r[1].last, 3);
  assert.equal(log.total, 3);
  for (let i = 0; i < MAX_ERRORS + 5; i++) log.add('console', `e${i}`);
  assert.equal(log.count, MAX_ERRORS);
  assert.equal(log.recent(1)[0].message, `e${MAX_ERRORS + 4}`);
  log.clear();
  assert.equal(log.count, 0);
});

test('기록장: 긴 글은 자르고, 스택의 페이지 주소는 뗀다, 듣는 쪽 오류는 삼킨다', () => {
  const log = createErrorLog({ origin: 'http://localhost:4243' });
  log.on(() => { throw new Error('듣는 쪽'); });
  const e = new Error('x'.repeat(2000));
  e.stack = 'Error: x\n    at f (http://localhost:4243/src/main.js:10:5)';
  log.add('error', e);
  const [got] = log.recent();
  assert.ok(got.message.length <= 500);
  assert.match(got.stack, /at f \(\/src\/main\.js:10:5\)/);
});

test('installErrors: window error·unhandledrejection·파일 못 받음·console.error 를 모은다', () => {
  const target = fakeTarget();
  const printed = [];
  const con = { error: (...a) => printed.push(a) };
  const errors = installErrors({ target, con, log: createErrorLog({ origin: target.location.origin }) });

  target.fire('error', { target, message: 'Uncaught ReferenceError: foo is not defined', filename: 'http://localhost:4243/src/ui/hud.js', lineno: 3, colno: 9, error: new ReferenceError('foo is not defined') });
  target.fire('unhandledrejection', { reason: new Error('약속 실패') });
  target.fire('error', { target: { tagName: 'IMG', src: 'http://localhost:4243/assets/%EC%97%86%EC%9D%8C.png' } });
  con.error('[boot] world 초기화 실패', new Error('지형'));
  con.error('[loop] player', new TypeError('t'));

  const r = errors.recent();
  assert.deepEqual(r.map(e => e.kind), ['error', 'rejection', 'resource', 'module', 'console']);
  assert.equal(r[0].source, '/src/ui/hud.js:3:9');
  assert.equal(r[0].message, 'Uncaught ReferenceError: foo is not defined');
  assert.equal(r[1].message, '약속 실패');
  assert.equal(r[2].source, '/assets/없음.png', '주소의 한글은 풀어서');
  assert.match(r[3].message, /\[boot\] world 초기화 실패 지형/);
  assert.equal(printed.length, 2, 'console.error 는 원래대로 찍힌다');

  errors.uninstall();
  con.error('끝');
  assert.equal(errors.count, 5, '떼면 더 모으지 않는다');
  assert.equal(printed.length, 3);
  assert.equal(target.subs.error.length, 0);
});

test('classifyConsole: [boot] 만 모듈 실패', () => {
  assert.equal(classifyConsole(['[boot] ui 초기화 실패', new Error('x')]).kind, 'module');
  assert.equal(classifyConsole(['[ui] peek', new Error('x')]).kind, 'console');
  assert.ok(classifyConsole([new Error('s')]).stack);
});

const fakeGame = () => {
  const state = createState();
  state.player.name = '하늘';
  state.island.name = '포근섬';
  state.wallet.acorns = 300;
  state.flags.firstday = { v: 1, done: { named: '2026-10-31', tool: true, sell: false }, finished: null };
  const errors = createErrorLog();
  for (let i = 0; i < 14; i++) { const e = new Error(`오류 ${i}`); errors.add('error', e); }
  return {
    state, errors, quality: 'low', input: { touch: true },
    services: {
      player: { position: { x: 12.345, z: -3.21 }, tool: 'net' },
      house: { inside: false },
      time: { now: () => ({ year: 2026, month: 10, day: 31, hour: 9, minute: 5 }), weather: 'rain', indoor: false },
      story: { playing: null },
    },
  };
};
const env = { navigator: { userAgent: 'TestUA', language: 'ko-KR' }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, screen: { width: 390, height: 844 }, location: { pathname: '/', search: '' } };

test('보고 문서 모양: 홈이 읽는 칸 (status new · kind · text · game · device · place · progress · errors)', () => {
  const doc = buildReport(fakeGame(), { kind: 'stuck', text: '  다리 앞에서 못 가요  ' }, { now: 1000, env });
  assert.equal(doc.status, 'new');
  assert.equal(doc.kind, 'stuck');
  assert.equal(doc.text, '다리 앞에서 못 가요');
  assert.equal(doc.createdAt, 1000);
  assert.equal(doc.reply, null);
  assert.deepEqual(doc.game, { build: 'dev', saveVersion: SAVE_VERSION, stateVersion: 1, page: '/', artifact: false });
  assert.deepEqual(doc.place, { x: 12.3, z: -3.2, indoor: false, time: '2026-10-31 09:05', timeMode: 'real', weather: 'rain', story: null, tool: 'net' });
  assert.deepEqual(doc.device.view, { w: 390, h: 844, dpr: 3 });
  assert.equal(doc.device.touch, true);
  assert.equal(doc.device.quality, 'low');
  assert.equal(doc.device.ua, 'TestUA');
  assert.deepEqual(doc.progress.firstday, ['named', 'tool']);
  assert.equal(doc.progress.player, '하늘');
  assert.equal(doc.errors.length, 10, '최근 10개만');
  assert.equal(doc.errors.at(-1).message, '오류 13');
  assert.equal(doc.errors.filter(e => e.stack).length, 3, '스택은 최근 3개만');
  assert.equal(doc.errorTotal, 14);
  assert.ok(JSON.stringify(doc).length < 256 * 1024 / 4, '저장소 문서 한도(256 KiB) 안에 넉넉히');
});

test('보고 문서: 정보 빼기 · 모르는 종류는 other · 글 길이 제한 · 서비스가 없어도 만든다', () => {
  const doc = buildReport(fakeGame(), { kind: 'zzz', text: 'x'.repeat(5000), withInfo: false }, { now: 1, env });
  assert.equal(doc.kind, 'other');
  assert.equal(doc.text.length, REPORT_TEXT_MAX);
  assert.equal(doc.errors, undefined);
  assert.equal(doc.device, undefined);
  const bare = buildReport({ state: createState(), services: {} }, {}, { now: 1, env: {} });
  assert.equal(bare.place.x, 0);
  assert.equal(bare.errorTotal, 0);
  assert.deepEqual(bare.errors, []);
  assert.deepEqual(REPORT_KINDS.map(([k]) => k), ['stuck', 'error', 'save', 'look', 'other']);
});

test('reportId: 저장소 경로 글자만, 시각 순', () => {
  const id = reportId(new Date(2026, 9, 31, 14, 23, 5).getTime(), () => 0.5);
  assert.equal(id, 'r20261031-142305-8000');
  assert.match(id, /^[A-Za-z0-9_\-.~:@+]+$/);
});

test('reportText: 붙여 넣을 글에 무엇·글·판·자리·오류', () => {
  const t = reportText(buildReport(fakeGame(), { kind: 'error', text: '멈췄어요' }, { now: 0, env }), 'r1');
  assert.match(t, /^\[포근섬 문제 알리기\] r1/);
  assert.match(t, /무엇: 오류·멈춤/);
  assert.match(t, /글: 멈췄어요/);
  assert.match(t, /자리: 섬 \(12\.3, -3\.2\)/);
  assert.match(t, /최근 오류 10개 \(모두 14번\)/);
});

test('sendReport: 아티팩트 저장소 → reports/<id> 에 set', async () => {
  const writes = [];
  const claude = { use: async name => (name === 'db' ? { doc: path => ({ set: async d => writes.push([path, d]) }) } : null) };
  const doc = buildReport(fakeGame(), { kind: 'save' }, { now: 5, env });
  const r = await sendReport(doc, { id: 'r-test', claude });
  assert.deepEqual(r, { ok: true, where: 'db', id: 'r-test' });
  assert.equal(writes[0][0], 'reports/r-test');
  assert.equal(writes[0][1].status, 'new');
});

test('sendReport: 쓰기 거절·저장소 없음(공유 링크)이면 실패 → 글 복사로', async () => {
  const denied = { use: async () => ({ doc: () => ({ set: async () => { throw { code: 'invalid_argument' }; } }) }) };
  const r1 = await sendReport(buildReport(fakeGame(), {}, { now: 1, env }), { claude: denied });
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /권한/);
  const none = { use: async () => null };
  const r2 = await sendReport(buildReport(fakeGame(), {}, { now: 1, env }), { claude: none, fetchFn: async () => { throw new Error('부르면 안 됨'); } });
  assert.equal(r2.ok, false);
});

test('sendReport: 로컬 dev-server 는 api/db/game-reports 로', async () => {
  const calls = [];
  const fetchFn = async (url, opt) => { calls.push([url, opt]); return { ok: true, json: async () => ({ id: 'x' }) }; };
  const r = await sendReport(buildReport(fakeGame(), { kind: 'look' }, { now: 1, env }), { id: 'r-l', claude: null, fetchFn });
  assert.deepEqual(r, { ok: true, where: 'local', id: 'r-l' });
  const post = calls.find(([u]) => u === 'api/db/game-reports');
  assert.equal(JSON.parse(post[1].body).docId, 'r-l');
});

test('textFieldKeys: 글 칸 안의 방향키·Enter 는 창 이동으로 가져가지 않는다', () => {
  let prevented = false;
  const e = { code: 'ArrowLeft', target: { matches: s => s.includes('textarea') }, preventDefault: () => { prevented = true; } };
  assert.equal(textFieldKeys(e), true);
  e.preventDefault();
  assert.equal(prevented, false);
  assert.equal(textFieldKeys({ code: 'Escape', target: e.target }), false, 'Esc 는 창 닫기 그대로');
  assert.equal(textFieldKeys({ code: 'ArrowLeft', target: { matches: () => false } }), false, '단추 위에서는 창 이동');
});
