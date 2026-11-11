// P47 시계 점검: HUD 원형 시계의 실제 단추(−1시간 · 빠르기 · +1시간 · 오늘/내일 · 낮/밤 단추)와 시계 판 키보드(↑↓ · Enter · Esc)만으로
// 빠르기 돌기 · 빠르게 흐름 · 낮↔밤 오가기 · 오늘 새벽 5시 하한 · 날 넘기기 · 「내일」 미리 보기를 본다. 결과와 사진을 남긴다.
// 사용: node tools/check-clock.mjs [--target=dev|artifact|both] [--headed] [--port=4270] [--build]
// 결과: docs/qa/runs/<날짜>-clock/report.md · report.json · shots/*.jpg (종료 코드: 실패가 있으면 1)
import { spawn, execSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d = null) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const port = Number(arg('port', 4270));
const targets = arg('target', 'dev') === 'both' ? ['dev', 'artifact'] : [arg('target', 'dev')];
const headed = !!arg('headed');
const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace(/[T:]/g, '-');
const outDir = arg('out') || join(root, 'docs/qa/runs', `${stamp}-clock`);
const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = t => process.stdout.write(`${t}\n`);
const up = async url => { try { return (await fetch(url)).ok; } catch { return false; } };
const run = (cmd, args) => new Promise((ok, no) => { const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' }); p.on('exit', c => (c === 0 ? ok() : no(new Error(`${args.join(' ')} → ${c}`)))); });
const DATE = '2027-05-15';   // 토요일 (야시장 날) · 엔딩 뒤로 둔 미리 보기 날짜



// ---- 게임 페이지 안 (문자열로 보내므로 바깥 변수를 쓰지 않는다) ----
async function boot() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 240 && !window.__island?.services?.night; i++) await wait(250);
  const c = window.__island;
  if (!c?.services?.house) return { ok: false, why: '게임이 안 열림' };
  await wait(1200);
  const step = n => { for (let j = 0; j < n; j++) c.step(0.05); };
  const key = (k, code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, code, bubbles: true }));
  const press = async (code = 'Space') => { const k = code === 'Space' ? ' ' : code === 'Escape' ? 'Escape' : code; key(k, code, true); key(k, code, false); step(6); await wait(120); };
  for (let i = 0; i < 20; i++) { const b = [...document.querySelectorAll('button')].find(x => /소리 없이 시작|소리 켜고 시작/.test(x.textContent)); if (b) { b.click(); break; } await wait(250); }
  for (let i = 0; i < 6 && document.querySelector('.fd-name'); i++) {
    for (const b of document.querySelectorAll('.fd-name button')) if (/추천/.test(b.getAttribute('aria-label') ?? '')) b.click();
    [...document.querySelectorAll('button')].find(b => /이대로 정할래요/.test(b.textContent))?.click();
    await wait(400);
    [...document.querySelectorAll('button')].find(b => /좋아요/.test(b.textContent))?.click();
    await wait(600);
  }
  const settle = async () => {
    for (let i = 0, calm = 0; i < 300 && calm < 16; i++) {
      if (c.services.story?.playing) { await press('Escape'); calm = 0; }
      else if (c.services.ui.isBlocking()) { await press('Escape'); calm = 0; }   // 창(상점 「문 너머에서」 팔기 등)은 닫고, 대화는 Esc 도 넘김 (dialog.js)
      else { step(2); await wait(100); calm++; }
    }
  };
  await settle();
  window.__ck = { settle, step, press, key, wait };
  // 준비 (점검 준비만 직접, 미리 보기 저장): 첫 섬 축제를 마친 섬 · 첫날 안내를 오래전에 마침(밤 콘텐츠 열림) ·
  // 단풍 + 이사 오는 주민 셋(구름·파도·달무리)이 남는 집터에 입주. 저장한 뒤 다시 열어야 town 이 주민을 새로 세운다.
  if (!c.state.flags?.ckPrepared) {
    (c.state.festival ||= {}).endedDay = '2027-01-01';
    const f = ((c.state.flags ||= {}).firstday ||= {});
    f.done = { ...(f.done ?? {}), intro: '2027-04-01' };
    const T = (c.state.town ||= {}), M = (T.moving ||= {});
    const stamp = { start: '2027-04-02', lot: '2027-04-03', boxes: '2027-04-04', moved: '2027-04-05' };
    T.movein ||= {};
    T.movein.danpung = { ...stamp };
    const spare = c.services.world.places.spareLots ?? [];
    M.arrived = ['gureum', 'pado', 'dalmuri'];
    M.homes = { ...(M.homes ?? {}) };
    M.arrived.forEach((s, i) => { T.movein[s] = { ...stamp }; if (spare[i]) M.homes[s] = spare[i].id; });
    // 박물관 전시를 보려고 물고기·곤충·화석 몇 개 기증 (점검 준비)
    const D = c.services.data;
    for (const cat of ['fish', 'bug', 'fossil']) for (const it of (D.items.list?.(cat) ?? []).slice(0, 3)) D.museum.donate(it.id);
    c.state.flags.ckPrepared = true;
    c.services.data.save.save();
    return { ok: true, reload: true, spare: spare.map(l => l.id) };
  }
  const mv = [];
  return { ok: true, residents: c.services.town.residents(), moved: mv };
}

// ---- 시계 점검 (게임 페이지 안) — 실제 HUD 단추 클릭 · 시계 판 키보드 · 섬폰 시계 창 단추만 쓴다 ----
async function clockTest() {
  const c = window.__island, { settle, step, wait } = window.__ck;
  const T = c.services.time, out = [];
  const now = () => { const n = T.now(); return `${n.dayKey} ${String(n.hour).padStart(2, '0')}:${String(n.minute ?? 0).padStart(2, '0')}`; };
  const rec = (name, ok, detail = '') => out.push({ name, ok: !!ok, detail: `${detail} [지금 ${now()}]` });
  const q = sel => document.querySelector(sel);
  const hudBtns = () => [...document.querySelectorAll('.pk-hclock-strip button')];
  const byLabel = re => hudBtns().find(b => re.test(b.getAttribute('aria-label') ?? '') || re.test(b.textContent));
  const click = async el => { if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); step(4); await wait(150); return true; };
  const dial = () => q('.pk-hclock-dial');
  const dialKey = async (code, n = 1) => { const d = dial(); d.focus(); for (let i = 0; i < n; i++) d.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); step(2); await wait(80); };
  const peek = () => q('.pk-hclock-peek')?.textContent ?? '';
  const day0 = T.now().dayKey;
  out.ui = { strip: hudBtns().map(b => b.textContent.trim() || b.getAttribute('aria-label')) };

  // 1) 빠르기 넷
  const sp = q('.pk-hclock-speed'); const seen = [];
  for (let i = 0; i < 5; i++) { seen.push(T.speed); await click(sp); }
  rec('빠르기 단추: 실제·빠르게·아주 빠르게·번개처럼 넷을 돈다', new Set(seen).size === 4 && seen.includes('fastest'), seen.join('→'));
  while (T.speed !== 'fastest') await click(sp);
  T.setHour(9); step(2);
  let m0 = T.now().ms; for (let i = 0; i < 30; i++) { step(1); await wait(100); }
  rec('번개처럼(×60) 실제 3초 → 게임 약 3분', T.now().ms - m0 > 100e3, `${Math.round((T.now().ms - m0) / 1e3)}초`);
  while (T.speed !== 'fast') await click(sp);

  // 2) 낮·밤 바로 가기 (같은 날 안에서 앞뒤로)
  T.setHour(10); step(4); await settle();
  await click(byLabel(/오늘 밤/)); await settle();
  rec('🌙 밤 → 오늘 밤 10시', T.now().hour === 22 && T.now().dayKey === day0);
  await click(byLabel(/오늘 낮/)); await settle();
  rec('☀️ 낮 → 오늘 낮 12시로 되돌아감 (날 그대로)', T.now().hour === 12 && T.now().dayKey === day0);
  await click(byLabel(/오늘 새벽/)); await settle();
  rec('🌌 새벽 → 오늘 밤 새벽 3시 (아직 같은 게임 하루)', T.now().hour === 3 && T.now().dayKey === day0);
  await click(byLabel(/오늘 아침/)); await settle();
  rec('🌅 아침 → 오늘 아침 7시로 되돌아감', T.now().hour === 7 && T.now().dayKey === day0);
  await click(byLabel(/오늘 저녁/)); await settle();
  rec('🌇 저녁 → 오늘 저녁 6시', T.now().hour === 18 && T.now().dayKey === day0);

  // 3) 바늘은 오늘 안에서만
  T.setHour(22); step(4); await settle();
  await dialKey('ArrowUp', 10);
  const p1 = peek();
  await dialKey('Enter'); await settle();
  rec('밤 10시에서 바늘 +10시간 → 새벽 4:59 에서 멈추고 「내일 ▶」 안내 (날 그대로)', T.now().dayKey === day0 && T.now().hour === 4, p1);
  await click(byLabel(/1시간 뒤로/)); await settle();
  rec('새벽 4시대에 +1시간 → 안 넘어감 (내일은 단추로)', T.now().dayKey === day0 && T.now().hour === 4);

  // 4) 내일 ▶ 두 번
  const next = q('.pk-hclock-next');
  await click(next);
  rec('「내일 ▶」 한 번 → 아직 오늘, 「한 번 더」 안내', T.now().dayKey === day0 && /한 번 더/.test(peek()), peek());
  await click(next); await settle();
  const d1 = T.now().dayKey;
  rec('「내일 ▶」 두 번 → 내일 아침 7시', d1 !== day0 && T.now().hour === 7);
  for (let i = 0; i < 4; i++) await click(byLabel(/1시간 앞으로/));
  rec('내일이 된 뒤 −1시간은 그날 새벽 5시에서 멈춤 (어제로 못 감)', T.now().dayKey === d1 && T.now().hour === 5);
  await click(byLabel(/오늘 밤/)); await settle();
  rec('새 날에서도 🌙 밤 → 그날 밤 10시', T.now().dayKey === d1 && T.now().hour === 22);

  // 5) 섬폰 시계 창: 🕰 → ☀️ 낮 → 적용
  await click(q('.pk-hclock-more')); await wait(300); step(4);
  const jb = [...document.querySelectorAll('.pk-tclock-jumps button')];
  const noon = jb.find(b => /낮/.test(b.textContent));
  await click(noon);
  const ap = [...document.querySelectorAll('.pk-tclock button')].find(b => b.textContent.trim() === '적용');
  await click(ap); await settle();
  rec('섬폰 시계 창: ☀️ 낮 → 적용 → 그날 낮 12시 (밤 10시에서 되돌아감)', T.now().dayKey === d1 && T.now().hour === 12, `창 단추 ${jb.map(b => b.textContent.trim()).join(' ')}`);
  return out;
}

async function main() {
  let server = null;
  if (!(await up(`http://localhost:${port}/api/ping`))) {
    server = spawn(process.execPath, ['dev-server.mjs', `--port=${port}`], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await up(`http://localhost:${port}/api/ping`)); i++) await sleep(200);
  }
  const stale = targets.includes('artifact') && (arg('build') ? '--build' : staleWeb());
  if (stale) { say(`게시본 만들기 (${stale}): node tools/build-web.mjs`); await run(process.execPath, ['tools/build-web.mjs']); }
  const exe = BROWSERS.find(p => existsSync(p));
  if (!exe) throw new Error('Chrome·Edge 를 못 찾았어요');
  const results = [];
  await mkdir(join(outDir, 'shots'), { recursive: true });
  for (const target of targets) {
    const profile = await mkdtemp(join(tmpdir(), 'island-interiors-'));
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
    cdp.on('Network.responseReceived', m => { if (m.response.status >= 400 && !/favicon.ico$/.test(m.response.url)) logs.push(`${m.response.status} ${m.response.url}`); });
    await cdp.send('Runtime.enable'); await cdp.send('Network.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const url = target === 'artifact' ? `http://localhost:${port}/artifact/#date=${DATE}` : `http://localhost:${port}/index.html?date=${DATE}`;
    say(`[${target}] ${url}`);
    await cdp.send('Page.navigate', { url });
    await sleep(2500);
    const ev = (fn, a) => cdp.send('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(a ?? null)})`, awaitPromise: true, returnByValue: true, timeout: 240000 })
      .then(r => r.result?.value ?? { error: r.exceptionDetails?.exception?.description ?? r.exceptionDetails?.text });
    let b = await ev(boot);
    say(`  준비: ${JSON.stringify(b)}`);
    if (b.reload) { await cdp.send('Page.reload', {}); await sleep(2500); b = await ev(boot); say(`  다시 열기: ${JSON.stringify(b)}`); }
    const shot = async name => { const s = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); const p = `shots/${target}-${name}.jpg`; await writeFile(join(outDir, p), Buffer.from(s.data, 'base64')); return p; };
    await shot('start');
    const r = await ev(clockTest);
    if (!Array.isArray(r)) results.push({ target, name: '점검이 끝남', ok: false, detail: JSON.stringify(r).slice(0, 300) });
    else for (const k of r) { k.target = target; results.push(k); say(`  ${k.ok ? '✅' : '⛔'} ${k.name} — ${k.detail}`); }
    if (r.ui) say(`  HUD 단추: ${r.ui.strip.join(' | ')}`);
    await shot('end');
    results.push({ target, console: logs.slice(0, 20) });
    if (logs.length) say(`  콘솔·요청 ${logs.length}: ${logs.slice(0, 3).join(' | ')}`);
    cdp.close(); browser.kill(); await sleep(400);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  server?.kill();
  await writeFile(join(outDir, 'report.json'), JSON.stringify({ ran: stamp, results }, null, 1));
  const rows = results.filter(r => r.name);
  const md = [`# 시계 점검 ${stamp}`, '', '도구 `tools/check-clock.mjs`', '', ...rows.map(r => `- [${r.target}] ${r.ok ? '✅' : '⛔'} ${r.name} — ${r.detail}`),
    '', ...results.filter(r => r.console).map(r => `- [${r.target}] 콘솔 오류·실패 요청 ${r.console.length}${r.console.length ? `: ${r.console.join(' · ')}` : ''}`)].join('\n');
  await writeFile(join(outDir, 'report.md'), md);
  const bad = rows.filter(r => !r.ok).length + results.filter(r => r.console?.length).length;
  say(`\n결과 ${outDir} · 실패 ${bad}`);
  process.exit(bad ? 1 : 0);
}

/**
 * dist/web 이 지금 코드보다 오래됐나 → 까닭 글 | '' (새것). 예전엔 있기만 하면 그대로 써서, 고치기 전 빌드로 게시본을 보고
 * 개발판과 다르다고 착각할 수 있었다 (2026-11-05 EV-02). src·assets·index.html 가운데 build.json 보다 새로 바뀐 파일이 있거나 빌드 커밋이 HEAD 와 다르면.
 */
function staleWeb() {
  const stamp = join(root, 'dist/web/build.json');
  if (!existsSync(join(root, 'dist/web/index.html')) || !existsSync(stamp)) return '빌드 없음';
  const built = statSync(stamp).mtimeMs;
  let head = '';
  try { head = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* git 없음 */ }
  try { const b = JSON.parse(readFileSync(stamp, 'utf8')).build ?? ''; if (head && !b.startsWith(head)) return `빌드 ${b.split(' ')[0]} ≠ HEAD ${head}`; } catch { return 'build.json 을 못 읽음'; }
  const SKIP = new Set(['review', 'references']);   // dev-server 저장소 흉내 (게임 파일 아님)
  const newer = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name) && newer(f)) return f; }
      else if (statSync(f).mtimeMs > built) return f;
    }
    return null;
  };
  const f = newer(join(root, 'src')) ?? newer(join(root, 'assets')) ?? (statSync(join(root, 'index.html')).mtimeMs > built ? 'index.html' : null);
  return f ? `빌드 뒤 바뀜: ${f.slice(root.length)}` : '';
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
