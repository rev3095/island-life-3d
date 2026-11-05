// 8차 M8-P8 계절 행사 점검: 행사 넷을 날짜 흉내(#date=)로 열어 실제 키(Space·F·WASD)로 처음부터 도장까지 해 본다.
// 처음부터 엔딩까지 하는 자동 플레이(tools/playtest.mjs)는 엔딩까지 20분이 걸리고 시계를 시각만 옮길 수 있어서, 행사는 이 도구로 따로 본다.
// 준비만 직접 고친다: 미리 보기 저장(진짜 저장과 따로)에 "첫 섬 축제를 마침"(state.festival.endedDay) · 재료(꽃잎 20·나무·과일 — 모으는 건 놀이마다 한 번은 직접).
// 사용: node tools/check-events.mjs [--target=dev|artifact|both] [--only=EV-01,EV-03] [--headed] [--port=4233] [--build]
// 결과: docs/qa/runs/<날짜>-events/report.md · report.json (종료 코드: 막힌 것이 있으면 1)
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d = null) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const port = Number(arg('port', 4233));
const targets = arg('target', 'both') === 'both' ? ['dev', 'artifact'] : [arg('target')];
const only = arg('only') ? String(arg('only')).split(',') : null;
const headed = !!arg('headed');
const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace(/[T:]/g, '-');
const outDir = arg('out') || join(root, 'docs/qa/runs', `${stamp}-events`);
const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = t => process.stdout.write(`${t}\n`);
const up = async url => { try { return (await fetch(url)).ok; } catch { return false; } };
const run = (cmd, args) => new Promise((ok, no) => { const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' }); p.on('exit', c => (c === 0 ? ok() : no(new Error(`${args.join(' ')} → ${c}`)))); });

/** 행사마다: 날짜 · 처음 시각 */
export const CASES = [
  { id: 'EV-01', date: '2027-04-02', hour: 10 },
  { id: 'EV-02', date: '2027-08-03', hour: 20.05 },
  { id: 'EV-03', date: '2027-10-16', hour: 11 },
  { id: 'EV-04', date: '2027-12-21', hour: 11 },
];

// ---- 게임 페이지 안에서 도는 쪽 (문자열로 보내므로 바깥 변수를 쓰지 않는다) ----
async function driver({ id, hour }) {
  const out = { id, checks: [], errors: [] };
  const ok = (name, cond, detail = '') => out.checks.push({ name, ok: !!cond, detail: String(detail) });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__island?.services?.events?.debug?.plays?.winter; i++) await wait(250);
  const c = window.__island;
  if (!c?.services?.events) { ok('게임이 열림', false); return out; }
  await wait(1500);
  const step = n => { for (let j = 0; j < n; j++) c.step(0.05); };
  const key = (k, code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, code, bubbles: true }));
  const press = async (code = 'Space') => { const k = code === 'Space' ? ' ' : code === 'KeyF' ? 'f' : code === 'Escape' ? 'Escape' : code; key(k, code, true); key(k, code, false); step(6); await wait(120); };
  const walk = (k, code, sec) => { key(k, code, true); step(Math.round(sec * 20)); key(k, code, false); step(4); };
  const label = (intent = 'action') => c.services.gameplay.interactions.peek(intent)?.label ?? `없음 (창 ${c.services.ui.isBlocking()} · 입력 ${c.input?.enabled} · 장면 ${!!c.services.story?.playing} · ${[...document.querySelectorAll('.pk-scrim, .pk-dlg-box, [role=dialog]')].map(e => e.textContent.trim().slice(0, 30)).join(' / ')})`;
  const P = c.services.player, E = c.services.events, inv = c.services.data.inventory, plays = E.debug.plays;
  // 시작 단추 · 이름 정하기 · 첫날 안내 (실제 단추·키)
  for (let i = 0; i < 20; i++) { const b = [...document.querySelectorAll('button')].find(x => /소리 없이 시작|소리 켜고 시작/.test(x.textContent)); if (b) { b.click(); break; } await wait(250); }   // 로딩 끝 시작 단추 (UI-11)
  for (let i = 0; i < 6 && document.querySelector('.fd-name'); i++) {
    for (const b of document.querySelectorAll('.fd-name button')) if (/추천/.test(b.getAttribute('aria-label') ?? '')) b.click();
    [...document.querySelectorAll('button')].find(b => /이대로 정할래요/.test(b.textContent))?.click();
    await wait(400);
    [...document.querySelectorAll('button')].find(b => /좋아요/.test(b.textContent))?.click();
    await wait(600);
  }
  // 첫 장면(s01…)·밤톨 안내가 이름 뒤 잠깐 있다 시작된다 — 장면은 Esc, 대화는 Space 로 넘기고, 2초 동안 조용하면 끝
  const seenScenes = [];
  const settle = async () => {
    for (let i = 0, calm = 0; i < 200 && calm < 16; i++) {
      const sp = c.services.story?.playing;
      if (sp) { if (!seenScenes.includes(sp.id)) seenScenes.push(sp.id); await press('Escape'); calm = 0; }
      else if (c.services.ui.isBlocking()) { await press(); calm = 0; }
      else { step(2); await wait(120); calm++; }
    }
  };
  await settle();
  ok('창·장면이 끝나고 움직일 수 있음', !c.services.ui.isBlocking() && !c.services.story?.playing);
  // 준비: 첫 섬 축제를 마친 섬 (미리 보기 저장)
  (c.state.festival ||= {}).endedDay = '2027-01-01';
  c.services.time.setHour(hour);
  c.events.emit('time:tick', { now: c.services.time.now() });
  step(20);
  ok('행사 시간', E.live().some(r => r.ev.id === id), E.live().map(r => r.ev.id).join(','));
  await settle();   // 그 행사를 처음 시작하면 행사 장면(s13–s16, M8-P7)이 나온다
  const SCENE = { 'EV-01': 's13-spring-blossom', 'EV-02': 's14-summer-fireworks', 'EV-03': 's15-autumn-harvest', 'EV-04': 's16-winter-snowman' }[id];
  ok('행사 장면이 나옴', seenScenes.includes(SCENE), seenScenes.join(','));
  ok('행사 칸이 보임', !document.querySelector('.ev-chip')?.hidden);
  try {
    if (id === 'EV-01') {
      const sp = plays.spring; await wait(1200);
      ok('벚나무 8 · 돗자리 · 간판', (sp.debug.placed?.ids.length ?? 0) === 10, sp.debug.placed?.ids.length);
      ok('꽃잎이 보임', sp.debug.petals.length >= 10, sp.debug.petals.length);
      const p = sp.debug.petals[0];
      P.teleport(p.x + 0.3, p.z + 0.3); step(4);
      ok('「꽃잎 줍기」', label('pickup') === '꽃잎 줍기', label('pickup'));
      await press('KeyF');
      ok('꽃잎이 가방에', inv.count('event.petal') === 1, inv.count('event.petal'));
      const m = sp.debug.placed.spots.picnic; P.teleport(m.x, m.z + 1.2); step(4);
      ok('「도시락 먹기」', label() === '도시락 먹기', label());
      await press(); for (let i = 0; i < 8 && c.services.ui.isBlocking(); i++) await press();
      c.services.data.collect('event.petal', 19); c.services.data.collect('mat.wood', 2);
      const s = sp.debug.placed.spots.sign; P.teleport(s.x - 0.3, s.z + 1.0); step(4);
      ok('「벚꽃 등 만들기」', label() === '벚꽃 등 만들기', label());
      await press();
      ok('벚꽃 등 · 도장', inv.count('furn.cherry-lamp') === 1 && E.stamps()[id]?.includes('2027'), `${inv.count('furn.cherry-lamp')} ${JSON.stringify(E.stamps()[id])}`);
    } else if (id === 'EV-02') {
      const su = plays.summer;
      ok('발사대 · 간판', (su.debug.placed?.ids.length ?? 0) === 2);
      const s = su.debug.placed.spots.sign; P.teleport(s.x - 1.0, s.z + 0.8); step(4);
      ok('「손 불꽃 받기」', label() === '손 불꽃 받기', label());
      await press();
      ok('손 불꽃이 가방에', inv.count('event.sparkler') === 1);
      let peak = 0; for (let j = 0; j < 1600 && !E.todo(id).find(t => t.id === 'watch')?.done; j++) { c.step(0.05); peak = Math.max(peak, su.debug.fx.sparks); }
      ok('불꽃이 터짐', peak > 20, `점 ${peak}`);
      ok('1분 보기', E.todo(id).find(t => t.id === 'watch')?.done);
      c.services.time.setHour(20.3); c.events.emit('time:tick', { now: c.services.time.now() }); step(6);
      ok('「소원 빌기」', label() === '소원 빌기', label());
      await press(); await wait(1200);
      document.querySelector('.pk-choice')?.click(); await wait(600);
      ok('소원 · 도장 · 풍경 대기', !!c.state.events.summer?.wish && E.stamps()[id]?.includes('2027') && c.state.events.summer.chimePending === 1);
    } else if (id === 'EV-03') {
      const au = plays.autumn; await au.debug.refresh();
      ok('솥 · 허수아비 · 버섯 다섯', au.debug.placed?.ids.length === 2 && au.debug.shrooms.length === 5, au.debug.shrooms.length);
      const m = au.debug.shrooms[0]; P.teleport(m.x + 0.3, m.z + 0.3); step(4);
      ok('「버섯 줍기」', label('pickup') === '버섯 줍기', label('pickup'));
      await press('KeyF');
      ok('버섯이 가방에', ['shiitake', 'chanterelle', 'red'].some(k => inv.count(`event.mushroom-${k}`) === 1));
      c.services.data.collect('fruit.apple', 10); c.services.data.collect('fruit.pear', 10); c.services.data.collect('fruit.peach', 10);
      const pot = au.debug.placed.pot; P.teleport(pot.x, pot.z + 1.6); step(4);
      ok('「큰 솥에 넣기」', label() === '큰 솥에 넣기', label());
      await press();
      ok('솥 30', au.debug.potCount() === 30, au.debug.potCount());
      c.services.time.setHour(18.2); c.events.emit('time:tick', { now: c.services.time.now() }); step(4);
      ok('「잔치 하기」', label() === '잔치 하기', label());
      await press(); for (let i = 0; i < 12 && c.services.ui.isBlocking(); i++) await press(); await wait(400);
      ok('바구니 · 도장', inv.count('furn.harvest-basket') === 1 && E.stamps()[id]?.includes('2027'));
    } else if (id === 'EV-04') {
      const w = plays.winter; await w.debug.refresh();
      ok('눈덩이 둘', w.debug.balls.length === 2);
      const [A, B] = w.debug.balls;
      P.teleport(A.x, A.z + 1.3); walk('w', 'KeyW', 0.15);
      ok('「눈덩이 밀기」', label() === '눈덩이 밀기', label());
      await press(); walk('a', 'KeyA', 2.5); walk('s', 'KeyS', 2.5); walk('d', 'KeyD', 2);
      ok('걸은 만큼 커짐', A.s > 1.1, A.s.toFixed(2));
      ok('「놓기」', label() === '놓기', label());
      await press();
      P.teleport(B.x, B.z + 1.3); walk('w', 'KeyW', 0.15); await press(); walk('s', 'KeyS', 1.0);
      P.teleport(A.x, A.z + A.s * 0.4 + 1.6); walk('w', 'KeyW', 0.25);
      ok('「머리 얹기」', label() === '머리 얹기', label());
      await press(); await wait(400);
      ok('눈사람 · 눈 결정 셋', (c.state.events.winter?.snowmen?.['2027']?.length ?? 0) === 1 && inv.count('event.snow-crystal') === 3 && w.debug.snowIds.length === 1);
    }
  } catch (e) { ok('도중에 오류 없음', false, e?.stack ?? e); }
  const errs = c.errors?.list?.() ?? c.errors?.recent;
  out.errors = (Array.isArray(errs) ? errs : []).map(x => String(x?.message ?? x)).slice(0, 10);
  return out;
}

async function main() {
  let server = null;
  if (!(await up(`http://localhost:${port}/api/ping`))) {
    server = spawn(process.execPath, ['dev-server.mjs', `--port=${port}`], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await up(`http://localhost:${port}/api/ping`)); i++) await sleep(200);
  }
  if (targets.includes('artifact') && (arg('build') || !existsSync(join(root, 'dist/web/index.html')))) { say('게시본 만들기: node tools/build-web.mjs'); await run(process.execPath, ['tools/build-web.mjs']); }
  const exe = BROWSERS.find(p => existsSync(p));
  if (!exe) throw new Error('Chrome·Edge 를 못 찾았어요');
  const results = [];
  for (const target of targets) for (const cs of CASES.filter(x => !only || only.includes(x.id))) {
    const profile = await mkdtemp(join(tmpdir(), 'island-events-'));   // 행사마다 새 브라우저 = 새 미리 보기 저장
    const browser = spawn(exe, [`--remote-debugging-port=0`, `--user-data-dir=${profile}`, '--window-size=1280,800', '--no-first-run', '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      ...(headed ? [] : ['--headless=new', '--use-angle=d3d11']), 'about:blank'], { stdio: 'ignore' });
    let wsPort = null;
    for (let i = 0; i < 100 && !wsPort; i++) { await sleep(150); try { wsPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim(); } catch { /* 아직 */ } }
    const page = (await (await fetch(`http://127.0.0.1:${wsPort}/json/list`)).json()).find(p => p.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);
    const logs = [];
    cdp.on('Runtime.exceptionThrown', m => logs.push(m.exceptionDetails?.exception?.description ?? m.exceptionDetails?.text));
    cdp.on('Runtime.consoleAPICalled', m => { if (m.type === 'error') logs.push(m.args.map(a => a.value ?? a.description).join(' ')); });
    cdp.on('Network.loadingFailed', m => { if (!m.canceled) logs.push(`요청 실패 ${m.errorText}`); });
    cdp.on('Network.responseReceived', m => { if (m.response.status >= 400 && !/favicon.ico$/.test(m.response.url)) logs.push(`${m.response.status} ${m.response.url}`); });   // 브라우저가 스스로 묻는 favicon 은 게임 요청이 아님
    await cdp.send('Runtime.enable'); await cdp.send('Network.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const url = target === 'artifact' ? `http://localhost:${port}/artifact/#date=${cs.date}` : `http://localhost:${port}/index.html?date=${cs.date}`;
    say(`[${target}] ${cs.id} ${url}`);
    await cdp.send('Page.navigate', { url });
    await sleep(2500);
    let r;
    try {
      const ev = await cdp.send('Runtime.evaluate', { expression: `(${driver.toString()})(${JSON.stringify(cs)})`, awaitPromise: true, returnByValue: true, timeout: 240000 });
      r = ev.result?.value?.checks ? ev.result.value : { id: cs.id, checks: [{ name: '점검이 끝남', ok: false, detail: ev.exceptionDetails?.exception?.description ?? ev.exceptionDetails?.text ?? JSON.stringify(ev.result).slice(0, 300) }], errors: [] };
    } catch (e) { r = { id: cs.id, checks: [{ name: '점검이 끝남', ok: false, detail: e.message }], errors: [] }; }
    r.target = target; r.console = logs.slice(0, 10);
    results.push(r);
    for (const k of r.checks) say(`  ${k.ok ? '✅' : '⛔'} ${k.name}${k.detail && !k.ok ? ` — ${k.detail}` : ''}`);
    if (logs.length) say(`  콘솔·요청 ${logs.length}: ${logs.slice(0, 3).join(' | ')}`);
    cdp.close(); browser.kill(); await sleep(400);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  server?.kill();
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'report.json'), JSON.stringify({ ran: stamp, results }, null, 1));
  const md = [`# 계절 행사 점검 ${stamp}`, '', `대상 ${targets.join(' · ')} · 도구 \`tools/check-events.mjs\``, '',
    ...results.map(r => [`## [${r.target}] ${r.id} — ${r.checks.every(k => k.ok) ? '✅ 모두 통과' : `⛔ ${r.checks.filter(k => !k.ok).length}개 막힘`}`, '',
      ...r.checks.map(k => `- ${k.ok ? '✅' : '⛔'} ${k.name}${k.detail ? ` (${k.detail})` : ''}`), `- 콘솔 오류·실패 요청 ${r.console.length}${r.console.length ? `: ${r.console.join(' · ')}` : ''}`, ''].join('\n'))].join('\n');
  await writeFile(join(outDir, 'report.md'), md);
  const bad = results.filter(r => !r.checks.every(k => k.ok) || r.console.length);
  say(`\n${results.length}개 중 통과 ${results.length - bad.length} · 결과 ${outDir}`);
  process.exit(bad.length ? 1 : 0);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const wait = new Map(), subs = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) { const { ok, no } = wait.get(m.id); wait.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); }
    else if (m.method) subs.get(m.method)?.forEach(fn => fn(m.params));
  };
  return new Promise((res, rej) => {
    ws.onopen = () => res({
      send: (method, params = {}) => new Promise((ok, no) => { const i = ++id; wait.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); }),
      on: (method, fn) => { if (!subs.has(method)) subs.set(method, []); subs.get(method).push(fn); },
      close: () => ws.close(),
    });
    ws.onerror = e => rej(e);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(e => { console.error(e); process.exit(2); });
