// 자동 플레이 점검 실행기: 머리 없는 Chrome(또는 Edge)을 띄워 tests/playthrough/index.html 을 열고,
// 봇이 처음부터 엔딩까지 돌면 보고서(JSON·MD)와 스크린샷을 남긴다. npm 없이 Node 내장 WebSocket 으로 CDP 를 쓴다.
//
//   node tools/playtest.mjs                       # 개발판 /index.html, 1280×800, 처음부터 엔딩까지
//   node tools/playtest.mjs --target=artifact     # 게시본 조건 /artifact/ (먼저 node tools/build-web.mjs, 없으면 --build)
//   node tools/playtest.mjs --mobile              # 375×812 터치 (A·B 단추)
//   node tools/playtest.mjs --only=boot,naming,arrival,clock,fd-tool   # 단계 몇 개만
//   node tools/playtest.mjs --novice             # 처음 하는 사람 흉내 (좋아함·축제 설정을 모르고 💭 힌트만, 최대 20일)
//   옵션: --port=4232 --days=10 --speed=4 --yearly --headed --browser=edge --out=<폴더> --build --date=2026-11-10 (시작 날짜 흉내)
// 결과: docs/qa/runs/<날짜>-<대상>[-mobile]/report.json · report.md · shots/*.jpg  (종료 코드: 막힌 단계가 있으면 1)
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d = null) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const port = Number(arg('port', 4232));
const target = arg('target', 'dev');
const mobile = !!arg('mobile');
const headed = !!arg('headed');
const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace(/[T:]/g, '-');
const outDir = arg('out') || join(root, 'docs/qa/runs', `${stamp}-${target}${mobile ? '-mobile' : ''}${arg('novice') ? '-novice' : ''}`);
const BROWSERS = {
  chrome: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  edge: ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/microsoft-edge'],
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = t => process.stdout.write(`${t}\n`);

async function up(url) { try { const r = await fetch(url); return r.ok; } catch { return false; } }
const run = (cmd, args) => new Promise((ok, no) => { const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' }); p.on('exit', c => (c === 0 ? ok() : no(new Error(`${args.join(' ')} → ${c}`)))); });

async function main() {
  // 1) 개발 서버
  let server = null;
  if (!(await up(`http://localhost:${port}/api/ping`))) {
    say(`개발 서버를 띄워요 (포트 ${port})`);
    server = spawn(process.execPath, ['dev-server.mjs', `--port=${port}`], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await up(`http://localhost:${port}/api/ping`)); i++) await sleep(200);
  }
  if (target === 'artifact' && (arg('build') || !existsSync(join(root, 'dist/web/index.html')))) { say('게시본 만들기: node tools/build-web.mjs'); await run(process.execPath, ['tools/build-web.mjs']); }

  // 2) 브라우저
  const exe = (arg('browser') ? BROWSERS[arg('browser')] : [...BROWSERS.chrome, ...BROWSERS.edge]).find(p => existsSync(p));
  if (!exe) throw new Error('Chrome·Edge 를 못 찾았어요 (--browser=chrome|edge)');
  const profile = await mkdtemp(join(tmpdir(), 'island-playtest-'));
  const [W, H] = mobile ? [375, 812] : [1280, 800];
  const flags = [`--remote-debugging-port=0`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--ignore-gpu-blocklist', '--enable-gpu-rasterization', ...(headed ? [] : ['--headless=new', '--use-angle=d3d11']), 'about:blank'];
  const browser = spawn(exe, flags, { stdio: 'ignore' });
  let wsPort = null;
  for (let i = 0; i < 100 && !wsPort; i++) {
    await sleep(150);
    try { wsPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim(); } catch { /* 아직 */ }
  }
  if (!wsPort) throw new Error('브라우저 디버깅 포트를 못 열었어요');
  const pages = await (await fetch(`http://127.0.0.1:${wsPort}/json/list`)).json();
  const page = pages.find(p => p.type === 'page');
  const cdp = await connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  if (mobile) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  } else await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  const params = new URLSearchParams({ target, shots: '1', days: String(arg('days', 10)), speed: String(arg('speed', 4)) });
  if (mobile) params.set('touch', '1');
  if (arg('only')) params.set('only', arg('only'));
  if (arg('from')) params.set('from', arg('from'));
  if (arg('date')) params.set('date', arg('date'));   // 시작 날짜 흉내 (게임 ?date=) — 그날 실패한 실행을 같은 날씨로 다시
  if (arg('yearly')) params.set('yearly', '1');
  if (arg('novice')) { params.set('novice', '1'); if (!arg('days')) params.set('days', '20'); }
  const url = `http://localhost:${port}/tests/playthrough/index.html?${params}`;
  await mkdir(join(outDir, 'shots'), { recursive: true });
  say(`열기: ${url}\n결과: ${outDir}`);
  await cdp.send('Page.navigate', { url });

  // 3) 돌면서: 새 기록 줄 보여 주기, 스크린샷 요청 받기
  const t0 = Date.now();
  let seen = 0, status = 'loading';
  const evalJ = async expr => JSON.parse((await cdp.send('Runtime.evaluate', { expression: `JSON.stringify(${expr})`, returnByValue: true })).result.value ?? 'null');
  const limit = Number(arg('timeout', 90)) * 60000;
  while (Date.now() - t0 < limit) {
    await sleep(400);
    let s;
    try { s = await evalJ(`(() => { const h = window.__playtest; return h && { status: h.status, n: h.log.length, shot: h.pendingShot, lines: h.log.slice(${seen}) }; })()`); } catch { continue; }
    if (!s) continue;
    for (const l of s.lines) say(l);
    seen = s.n;
    status = s.status;
    if (s.shot) {
      const file = `${s.shot.name}.jpg`.replace(/[^\w.-]+/g, '_');
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
      await writeFile(join(outDir, 'shots', file), Buffer.from(shot.data, 'base64'));
      await cdp.send('Runtime.evaluate', { expression: `window.__playtest.lastShotFile = ${JSON.stringify(`shots/${file}`)}; window.__playtest.pendingShot = null;` });
    }
    if (status === 'done' || status === 'error') break;
  }
  const report = await evalJ('window.__playtest?.report ?? null');
  const transcript = await evalJ('window.__playtest?.transcript ?? []');
  if (report) {
    report.browser = exe.split(/[\\/]/).pop(); report.headless = !headed; report.ran = stamp;
    await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 1));
    await writeFile(join(outDir, 'transcript.json'), JSON.stringify(transcript, null, 1));
    await writeFile(join(outDir, 'report.md'), markdown(report));
    say(`\n${summary(report)}`);
  } else say(`보고서를 못 받았어요 (상태 ${status})`);

  cdp.close();
  browser.kill();
  server?.kill();
  await sleep(300);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  process.exit(!report || report.steps.some(s => s.status === 'block') ? 1 : 0);
}

/** 아주 작은 CDP 클라이언트 */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const wait = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) { const { ok, no } = wait.get(m.id); wait.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); }
  };
  return new Promise((res, rej) => {
    ws.onopen = () => res({
      send: (method, params = {}) => new Promise((ok, no) => { const i = ++id; wait.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); }),
      close: () => ws.close(),
    });
    ws.onerror = e => rej(e);
  });
}

const ICON = { pass: '✅', awkward: '🟡', block: '⛔', skip: '⏭' };
function summary(r) {
  const c = k => r.steps.filter(s => s.status === k).length;
  const sev = k => r.issues.filter(i => i.sev === k).length;
  return `단계 ${r.steps.length}: 통과 ${c('pass')} · 어색함 ${c('awkward')} · 막힘 ${c('block')} · 건너뜀 ${c('skip')} | 봇이 찾은 문제 ${r.issues.length} (치명 ${sev('critical')} · 큼 ${sev('major')} · 작음 ${sev('minor')}) | 콘솔 오류 ${r.errors.length} | 실제 ${r.realSec}초`;
}
function markdown(r) {
  const lines = [`# 자동 플레이 결과 — ${r.ran} · ${r.target}${r.touch ? ' · 터치' : ''} · ${r.viewport}`, '', summary(r), '',
    '| | 단계 | 결과 | 게임 초 / 실제 초 | 날짜 | 오류 |', '|---|---|---|---|---|---|',
    ...r.steps.map(s => `| ${ICON[s.status] ?? ''} | **${s.id}** ${s.title} | ${(s.note ?? '').replace(/\|/g, '/')} | ${s.gameSec} / ${s.realSec} | ${s.day ?? ''}${s.dayEnd && s.dayEnd !== s.day ? ` → ${s.dayEnd}` : ''} | ${s.errors.length || ''} |`),
    '', '## 봇이 찾은 문제', '', ...(r.issues.length ? r.issues.map(i => `- [${i.sev}] ${i.module}: ${i.text} (단계 ${i.step}, ${i.day}${i.n > 1 ? `, ${i.n}번` : ''})`) : ['없음']),
    '', '## 콘솔 오류', '', ...(r.errors.length ? r.errors.slice(0, 40).map(e => `- (${e.step}) ${String(e.text).split('\n')[0]}`) : ['없음']),
    '', '## 날마다 (축제 부품 모으기)', '', ...(r.days ?? []).map(d => `- ${d.day} ${d.weather}: 부품 ${d.parts}/5 · 친밀도 ${JSON.stringify(d.friend)} · 이사 ${d.movein}${d.gather ? ` · 채집 ${JSON.stringify(d.gather)}` : ''}`),
    '', '## 스크린샷', '', ...r.shots.map(s => `- ${s.file ? `[${s.name}](${s.file})` : s.name} — ${s.note} (${s.day} ${s.hour}시)`), ''];
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(2); });
