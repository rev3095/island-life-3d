// P40 성능 재기: 머리 없는 Chrome(진짜 GPU, ANGLE D3D11)으로 게임을 사양마다 열어 장소별 GPU 시간·그리기 호출·삼각형·CPU·메모리를 잰다.
// 이름 정하기·첫 장면은 실제 단추·Esc·Space 로 넘기고, 재는 동안만 플레이어를 옮기고 시계를 당긴다(미리 보기 저장 — 진짜 저장과 따로).
// GPU 시간 = 프레임마다 EXT_disjoint_timer_query_webgl2 를 첫 renderer.render 부터 프레임 끝까지 (모듈 update 는 빼고), 쉬지 않고 연달아 그린 프레임의 가운데 값.
// 사용: node tools/perf-bench.mjs [--port=4241] [--target=dev|artifact] [--quality=high,mid,low,min] [--scenes=plaza-day,plaza-night,market,tour] [--rounds=3] [--out=<json>] [--shots=<폴더>]
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d = null) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const port = Number(arg('port', 4241));
const target = arg('target', 'dev');
const qualities = String(arg('quality', 'high,mid,low,min')).split(',');
const scenes = String(arg('scenes', 'plaza-day,plaza-night,market,tour')).split(',');
const rounds = Number(arg('rounds', 3));
const shots = arg('shots');
const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = t => process.stdout.write(`${t}\n`);
const up = async url => { try { return (await fetch(url)).ok; } catch { return false; } };

// 장소: 날짜(요일이 중요 — 야시장은 토요일) · 시각
const DATES = { weekday: '2026-11-12', saturday: '2026-11-14' };
const SCENES = {
  'plaza-day': { date: 'weekday', hour: 12 },
  'plaza-night': { date: 'weekday', hour: 21 },
  market: { date: 'saturday', hour: 20.5 },
  tour: { date: 'weekday', hour: 12 },
};

// ---- 페이지 안에서 도는 쪽 (문자열로 보낸다) ----
async function driver({ scenes, rounds, shots, probe }) {
  const PROBE = probe;
  const out = { scenes: {}, errors: [], device: null };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 240 && !(window.__island?.services?.player && window.__island?.services?.town); i++) await wait(250);
  const c = window.__island;
  if (!c?.services?.player) { out.errors.push('게임이 안 열림'); return out; }
  await wait(1200);
  const step = n => { for (let j = 0; j < n; j++) c.step(0.05); };
  const key = (k, code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, code, bubbles: true }));
  const press = async (code = 'Space') => { const k = code === 'Space' ? ' ' : code === 'Escape' ? 'Escape' : code; key(k, code, true); key(k, code, false); step(6); await wait(100); };
  for (let i = 0; i < 20; i++) { const b = [...document.querySelectorAll('button')].find(x => /소리 없이 시작|소리 켜고 시작/.test(x.textContent)); if (b) { b.click(); break; } await wait(250); }
  for (let i = 0; i < 6 && document.querySelector('.fd-name'); i++) {
    for (const b of document.querySelectorAll('.fd-name button')) if (/추천/.test(b.getAttribute('aria-label') ?? '')) b.click();
    [...document.querySelectorAll('button')].find(b => /이대로 정할래요/.test(b.textContent))?.click();
    await wait(400);
    [...document.querySelectorAll('button')].find(b => /좋아요/.test(b.textContent))?.click();
    await wait(600);
  }
  const settle = async () => {
    for (let i = 0, calm = 0; i < 200 && calm < 12; i++) {
      if (c.services.story?.playing) { await press('Escape'); calm = 0; }
      else if (c.services.ui.isBlocking()) {
        const go = [...document.querySelectorAll('button')].find(b => /떠나요/.test(b.textContent));
        if (go) go.click(); else await press();
        calm = 0; await wait(100);
      } else { step(2); await wait(80); calm++; }
    }
  };
  await settle();
  const gl = c.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  out.device = { gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), w: innerWidth, h: innerHeight, ratio: c.renderer.getPixelRatio(), quality: c.quality };
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const R = c.renderer, render0 = R.render.bind(R);
  let active = null;
  const pending = [];
  R.render = function (s, cam) { if (ext && !active) { active = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, active); } return render0(s, cam); };
  const frame = () => { const t = performance.now(); c.step(1 / 60); const cpu = performance.now() - t; if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; } return cpu; };
  const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  async function measure(n = 90) {
    const cpu = [], gpu = [];
    for (let i = 0; i < 10; i++) frame();
    pending.splice(0).forEach(q => gl.deleteQuery(q));
    R.info.reset();
    for (let i = 0; i < n; i++) cpu.push(frame());
    // 마지막 프레임의 그리기 수 (render/index.js 가 프레임마다 지운다)
    const info = { calls: R.info.render.calls, tris: R.info.render.triangles };
    for (let k = 0; k < 200 && pending.length; k++) {
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      if (pending.length) await wait(16);
    }
    return { gpu: median(gpu), cpu: median(cpu), n: gpu.length, ...info };
  }
  const P = c.services.player, W = c.services.world, T = c.services.time;
  const actorsInfo = () => {
    let skinned = 0, skel = new Set(), mixers = 0;
    c.scene.traverse(o => { if (o.isSkinnedMesh) { skinned++; skel.add(o.skeleton); } });
    return { skinned, skeletons: skel.size };
  };
  for (const name of scenes) {
    try {
      if (name === 'tour') {
        if (!c.services.tour?.current) {
          const b = c.services.tour.boat?.(); if (b) { P.teleport(b.x, b.z + 1.5); step(6); }
          const pr = c.services.tour.go(); await wait(300); await settle(); await pr?.catch?.(() => {});
          for (let i = 0; i < 60 && !c.services.tour.current; i++) { step(4); await wait(100); await settle(); }
          if (!c.services.tour.current) throw new Error('투어 섬에 못 감');
        }
        T.setHour(SC_HOUR[name]); c.events.emit('time:tick', { now: T.now() });
        const pl = W.places; const at = pl.spawn ?? pl.plaza ?? pl.dock;
        if (at) P.teleport(at.x, at.z);
      } else if (name === 'market') {
        // 야시장 = 토요일 밤. 0~5시는 전날이라 주소 날짜만으로는 요일이 흔들린다 → 다음 토요일까지 시계를 옮긴다
        const wd = new Date(`${T.now().dayKey}T12:00:00`).getDay();
        const h = SC_HOUR[name];
        if (wd !== 6) T.shiftTo(Math.floor(h), Math.round((h % 1) * 60), { days: (6 - wd + 7) % 7 }); else T.setHour(h);
        step(4); c.events.emit('time:tick', { now: T.now() }); step(10); await wait(300); await settle();
        for (let i = 0; i < 40 && !(c.services.night?.debug?.placed?.()?.market?.length); i++) { step(4); await wait(150); }
        const pl = W.places.plaza; P.teleport(pl.x, pl.z + 2.5);
      } else {
        T.setHour(SC_HOUR[name]); c.events.emit('time:tick', { now: T.now() });
        const pl = W.places.plaza; P.teleport(pl.x, pl.z + 2.5);
      }
      step(40); await wait(400); step(20);
      const rs = [];
      for (let r = 0; r < rounds; r++) { rs.push(await measure()); await wait(200); }
      const best = rs.map(x => x.gpu).filter(x => x != null);
      const res = { gpu: +median(best)?.toFixed(2), rounds: rs.map(x => +x.gpu?.toFixed(2)), cpu: +median(rs.map(x => x.cpu)).toFixed(2), calls: rs.at(-1).calls, ktris: Math.round(rs.at(-1).tris / 1000), ...actorsInfo() };
      res.mem = { geo: R.info.memory.geometries, tex: R.info.memory.textures, programs: R.info.programs?.length };
      res.models = c.assets?.cacheStats?.()?.models ?? null;
      res.heapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null;
      res.villagers = c.services.town?.villagers?.length ?? c.services.town?.debug?.villagers?.length ?? null;
      if (name === 'market') res.market = c.services.night?.debug?.placed?.()?.market?.length ?? 0;
      if (PROBE) {
        // 쪼개 보기: 장면 맨 위 자식(과 world 묶음 종류)을 하나씩 숨기고 GPU 차이
        const base = (await measure(60)).gpu;
        const rows = [];
        const groups = [];
        c.scene.children.forEach(o => { if (o.visible) groups.push([o.name || o.type, o]); });
        for (const o of c.scene.children) if (o.children.length > 3 && o.visible) o.children.forEach(k => { if (k.visible) groups.push([`${o.name || o.type}/${k.name || k.type}`, k]); });
        for (const [label, o] of groups) {
          let tris = 0; o.traverse(m => { if (m.isMesh && m.geometry?.index) tris += m.geometry.index.count / 3 * (m.isInstancedMesh ? m.count : 1); });
          o.visible = false; const g = (await measure(40)).gpu; o.visible = true;
          rows.push({ label, d: +(base - g).toFixed(2), ktris: Math.round(tris / 1000) });
        }
        rows.sort((a, b) => b.d - a.d);
        res.probe = { base, rows: rows.slice(0, 25) };
      }
      if (shots) { window.__perfShot = name; for (let i = 0; i < 100 && window.__perfShot; i++) await wait(100); }
      out.scenes[name] = res;
    } catch (e) { out.errors.push(`${name}: ${e.message}`); }
  }
  return out;
}

// --editors: 편집기 처음 여는 시간 (dev-server, 캐시 없는 새 프로필) — load 이벤트 · 요청이 1초 조용해질 때까지 · 요청 수 · 받은 바이트
const EDITORS = ['editors.html', 'res-editor.html', 'story-editor.html', 'elem-editor.html'];
async function editors(exe) {
  const out = {};
  for (const page of EDITORS) {
    const profile = await mkdtemp(join(tmpdir(), 'island-perf-ed-'));
    const browser = spawn(exe, [`--remote-debugging-port=0`, `--user-data-dir=${profile}`, '--window-size=1280,800', '--no-first-run', '--headless=new', '--use-angle=d3d11', 'about:blank'], { stdio: 'ignore' });
    try {
      let wsPort = null;
      for (let i = 0; i < 100 && !wsPort; i++) { await sleep(150); try { wsPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim(); } catch { } }
      const pages = await (await fetch(`http://127.0.0.1:${wsPort}/json/list`)).json();
      const cdp = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
      await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      const t0 = Date.now();
      await cdp.send('Page.navigate', { url: `http://localhost:${port}/${page}` });
      let last = Date.now(), loadAt = null;
      for (;;) {
        await sleep(250);
        const m = JSON.parse((await cdp.send('Runtime.evaluate', { expression: `JSON.stringify({ ready: document.readyState, n: performance.getEntriesByType('resource').length, bytes: performance.getEntriesByType('resource').reduce((s, e) => s + (e.encodedBodySize || e.transferSize || 0), 0), last: Math.max(0, ...performance.getEntriesByType('resource').map(e => e.responseEnd)), heap: performance.memory?.usedJSHeapSize ?? 0 })`, returnByValue: true })).result.value);
        if (m.ready === 'complete' && loadAt == null) loadAt = Date.now() - t0;
        if (m.n !== out[page]?.n) last = Date.now();
        out[page] = { ...m, load: loadAt };
        if (loadAt != null && Date.now() - last > 1500) break;
        if (Date.now() - t0 > 60000) break;
      }
      const v = out[page];
      v.quiet = Math.round(v.last);
      say(`${page.padEnd(18)} load ${v.load}ms · 마지막 요청 끝 ${v.quiet}ms · 요청 ${v.n} · ${(v.bytes / 1048576).toFixed(2)}MB · 힙 ${(v.heap / 1048576).toFixed(1)}MB`);
      cdp.close();
    } finally { browser.kill(); }
  }
  return out;
}

async function main() {
  let server = null;
  if (!(await up(`http://localhost:${port}/api/ping`))) {
    server = spawn(process.execPath, ['dev-server.mjs', `--port=${port}`], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await up(`http://localhost:${port}/api/ping`)); i++) await sleep(200);
  }
  const exe = BROWSERS.find(p => existsSync(p));
  const results = {};
  if (arg('editors')) {
    try { results.editors = await editors(exe); } finally { server?.kill(); }
    if (arg('out')) await writeFile(arg('out'), JSON.stringify(results, null, 1));
    return;
  }
  try {
    for (const q of qualities) {
      // 날짜마다 장소를 묶는다 (날짜 = 새 페이지)
      const byDate = {};
      for (const s of scenes) (byDate[SCENES[s].date] ??= []).push(s);
      for (const [d, list] of Object.entries(byDate)) {
        const profile = await mkdtemp(join(tmpdir(), 'island-perf-'));
        const browser = spawn(exe, [`--remote-debugging-port=0`, `--user-data-dir=${profile}`, '--window-size=1280,800', '--no-first-run', '--no-default-browser-check',
          '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
          '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--headless=new', '--use-angle=d3d11', '--disable-gpu-vsync', '--disable-frame-rate-limit', 'about:blank'], { stdio: 'ignore' });
        try {
          let wsPort = null;
          for (let i = 0; i < 100 && !wsPort; i++) { await sleep(150); try { wsPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim(); } catch { } }
          const pages = await (await fetch(`http://127.0.0.1:${wsPort}/json/list`)).json();
          const cdp = await connect(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
          await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
          await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
          const url = target === 'artifact'
            ? `http://localhost:${port}/artifact/#${q}&date=${DATES[d]}`
            : `http://localhost:${port}/index.html?quality=${q}&date=${DATES[d]}`;
          const t0 = Date.now();
          await cdp.send('Page.navigate', { url });
          const hours = Object.fromEntries(list.map(s => [s, SCENES[s].hour]));
          const expr = `(async () => { const SC_HOUR = ${JSON.stringify(hours)}; ${driver.toString().replace(/^async function driver/, 'const driver = async function')}; return JSON.stringify(await driver(${JSON.stringify({ scenes: list, rounds, shots: !!shots, probe: !!arg('probe') })})); })()`;
          const run = cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 600000 });
          if (shots) {
            await mkdir(shots, { recursive: true });
            let done = false; run.then(() => { done = true; }, () => { done = true; });
            while (!done) {
              await sleep(300);
              const s = (await cdp.send('Runtime.evaluate', { expression: 'window.__perfShot || null', returnByValue: true })).result.value;
              if (s) {
                const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                await writeFile(join(shots, `${s}-${q}.png`), Buffer.from(shot.data, 'base64'));
                await cdp.send('Runtime.evaluate', { expression: 'window.__perfShot = null' });
              }
            }
          }
          const r = JSON.parse((await run).result.value ?? '{}');
          r.openMs = Date.now() - t0;
          for (const [s, v] of Object.entries(r.scenes ?? {})) { (results[s] ??= {})[q] = v; say(`${q.padEnd(4)} ${s.padEnd(12)} GPU ${v.gpu}ms (${v.rounds.join(' / ')}) · cpu ${v.cpu} · ${v.calls}c · ${v.ktris}k · 뼈대 메시 ${v.skinned} · 뼈대 ${v.skeletons} · 지오 ${v.mem.geo} · 텍스처 ${v.mem.tex} · 모델 ${v.models ?? '-'} · 힙 ${v.heapMB}MB${v.market != null ? ` · 노점 ${v.market}` : ''}`); }
          for (const [s, v] of Object.entries(r.scenes ?? {})) if (v.probe) { say(`  쪼개 보기 (기준 ${v.probe.base}ms)`); for (const x of v.probe.rows) say(`    ${String(x.d).padStart(6)}ms  ${x.ktris}k  ${x.label}`); }
          if (r.errors?.length) say(`  오류: ${r.errors.join(' / ')}`);
          results.device ??= r.device;
          cdp.close();
        } finally { browser.kill(); }
      }
    }
  } finally { server?.kill(); }
  if (arg('out')) await writeFile(arg('out'), JSON.stringify(results, null, 1));
}

function connect(url) {
  return new Promise((ok, no) => {
    const ws = new WebSocket(url);
    let id = 0; const wait = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { const [a, b] = wait.get(m.id); wait.delete(m.id); m.error ? b(new Error(m.error.message)) : a(m.result); } };
    ws.onopen = () => ok({ send: (method, params = {}) => new Promise((a, b) => { const i = ++id; wait.set(i, [a, b]); ws.send(JSON.stringify({ id: i, method, params })); }), close: () => ws.close() });
    ws.onerror = no;
  });
}

main().catch(e => { console.error(e); process.exit(1); });
