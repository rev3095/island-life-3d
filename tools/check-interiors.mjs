// P44 실내 점검: 낮(10시)·밤(23시)·새벽(4시)에 섬의 모든 문(내 집·도토리상점·박물관·주민 집 열·달빛 가게·새벽 천막) 앞에 서서
// 행동 키 글자를 보고, 열려 있으면 실제 Space 로 들어가 실내가 뜨는지 · 임시 상자(모델 없는 가구)가 남았는지 · 스크린샷을 남긴다.
// 준비만 직접 고친다(미리 보기 저장): 첫 섬 축제를 마침(state.festival.endedDay) · 이사 오는 주민 셋 입주(town.movein.skip) — 나머지는 실제 키.
// 나올 때는 각 실내의 나가기 함수를 부른다 (점검이 보는 것은 들어가기와 안의 모습).
// 사용: node tools/check-interiors.mjs [--target=dev|artifact|both] [--hours=10,23,28] [--only=pado,shop] [--headed] [--port=4264] [--build]
//       --home[=0,1,2,3]  M14 내 집 단계별만: 단계마다 겉모양 · 들어가기 · 계단 걸어 오르내리기 (다른 문은 안 봄)
// 결과: docs/qa/runs/<날짜>-interiors/report.md · report.json · shots/*.jpg (종료 코드: 막힌 것이 있으면 1)
import { spawn, execSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d = null) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const port = Number(arg('port', 4264));
const targets = arg('target', 'dev') === 'both' ? ['dev', 'artifact'] : [arg('target', 'dev')];
const headed = !!arg('headed');
const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace(/[T:]/g, '-');
const outDir = arg('out') || join(root, 'docs/qa/runs', `${stamp}-interiors`);
const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = t => process.stdout.write(`${t}\n`);
const up = async url => { try { return (await fetch(url)).ok; } catch { return false; } };
const run = (cmd, args) => new Promise((ok, no) => { const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' }); p.on('exit', c => (c === 0 ? ok() : no(new Error(`${args.join(' ')} → ${c}`)))); });
const DATE = '2027-05-15';   // 토요일 (야시장 날) · 엔딩 뒤로 둔 미리 보기 날짜
const HOURS = arg('hours') ? String(arg('hours')).split(',').map(Number) : [10, 23, 28];  // 낮 10시 · 밤 11시 · 새벽 4시 (게임 하루 시각 5~29, --hours=19,21)
const ONLY = arg('only') ? String(arg('only')).split(',') : null;   // --only=pado,shop (문 key 나 주민 slug)
const HOME = arg('home') ? (arg('home') === true ? [0, 1, 2, 3] : String(arg('home')).split(',').map(Number)) : null;   // M14 --home=0,1,2,3

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

async function visitDoor({ hour, key, slug, label }) {
  const c = window.__island, { settle, step, press, key: kd, wait } = window.__ck;
  const S = c.services, W = S.world, P = S.player;
  const out = { hour, key, slug, label, peek: null, entered: false, where: null, placeholders: [], note: '' };
  S.time.setHour(hour); c.events.emit('time:tick', { now: S.time.now() }); step(30); await settle();
  for (let k = 0; k < 20 && key !== 'villager' && key !== 'playerHouse' && !W.places[key]; k++) { step(10); await wait(100); }
  const d = key === 'villager' ? W.places.villagerHouses?.find(h => h.slug === slug)?.door : W.places[key]?.door;
  if (!d) { out.note = '건물이 없음 (이 시각엔 안 섬)'; return out; }
  P.teleport(d.x, d.z + 0.9, 0);
  step(4);
  kd('w', 'KeyW', true); step(8); kd('w', 'KeyW', false); step(6);
  const pk = S.gameplay.interactions.peek('action');
  const lab = pk ? (typeof pk.label === 'function' ? '' : pk.label ?? '') : '';
  out.peek = pk ? `${pk.name}${lab ? ` · ${lab}` : ''}` : `없음 (창 ${S.ui.isBlocking()} · 입력 ${c.input?.enabled} · 장면 ${!!S.story?.playing} · 얼음 ${!!P.frozen} · 거리 ${Math.hypot(P.position.x - d.x, P.position.z - d.z).toFixed(2)} · 안 ${!!S.house?.inside}/${S.house?.places?.where ?? ''} · ${[...document.querySelectorAll('.pk-scrim, .pk-dlg-box, [role=dialog]')].map(e => e.textContent.trim().slice(0, 24)).join(' / ')})`;
  out.atHome = key === 'villager' ? S.town.atHome(slug) : null;
  out.rule = key === 'villager' ? null : (key === 'moonshop' || key === 'tent') ? S.night?.placeRule?.(key) ?? null : S.town.placeRule?.(key) ?? null;
  if (!pk || !/^(town:(shop|museum)|house-door-in|house-visit-in|night:door)$/.test(pk.name) || pk.name === 'house-visit-in' && out.atHome !== 'home') { out.note = `문 앞 들어가기 없음`; return out; }
  const x0 = P.position.x;
  await press();
  for (let k = 0; k < 160; k++) {
    step(4); await wait(40);
    if (Math.abs(P.position.x - x0) > 100 && !S.house?.passing && !S.story?.playing) break;
    if (S.story?.playing) await press('Escape');
    else if (S.ui.isBlocking()) await press();
  }
  out.dialog = S.ui.isBlocking() ? [...document.querySelectorAll('.pk-dlg-box, [role=dialog]')].map(e => e.textContent.trim().slice(0, 40)).join(' / ') : '';
  await settle();
  out.entered = Math.abs(P.position.x - x0) > 100;
  if (!out.entered) { out.note = `들어가지 못함${out.dialog ? ` (뜬 창: ${out.dialog})` : ''}`; return out; }
  out.where = S.house.places?.where ?? (S.house.inside ? 'home' : 'room');
  const near = new Set(), v = new c.THREE.Vector3();
  c.scene.traverse(o => { if (o.userData?.placeholder && o.visible !== false && Math.abs(o.getWorldPosition(v).x - P.position.x) < 20) near.add(String(o.userData.placeholder)); });
  out.placeholders = [...near];
  // P45 진열품·전시물 앞 「보기」·「살펴보기」: 하나씩 그 앞(남쪽 0.9칸)에 서서 행동 키 글자 → 첫 하나는 실제 Space (사기 창·설명판이 뜨는지, 그만둘래요/다 봤어요)
  const HP = S.house.places, spots = HP?.where ? HP.shownSpots?.(HP.where) ?? [] : [];
  out.looks = { n: spots.length, ok: 0, bad: [] };
  for (const [i, sp] of spots.entries()) {
    P.teleport(sp.x, sp.z + 0.95, 0); step(6);
    const k = S.gameplay.interactions.peek('action');
    if (k?.name === 'house-place-look') out.looks.ok++; else out.looks.bad.push(`${sp.id}:${k?.name ?? '없음'}`);
    if (i === 0 && k?.name === 'house-place-look') {
      await press(); step(6); await wait(200);
      const box = [...document.querySelectorAll('.pk-dlg-box, [role=dialog]')].map(e => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)).join(' / ');
      out.looks.first = `${sp.id} → ${box || '창 없음'}`;
      await press('Escape'); await settle();
    }
  }
  step(10);
  return out;
}

async function leaveAll() {
  const c = window.__island, { settle, step } = window.__ck, H = c.services.house;
  try { if (H.places?.where) await H.places.leave(); else if (H.inside) await H.leave(); else await H.leaveVisit?.(); } catch (e) { /* 이미 밖 */ }
  step(40); await settle();
  return Math.abs(c.services.player.position.x) < 200;
}

// M14 내 집 단계별 (--home[=0,1,2,3]): 단계만 미리 보기 저장에 직접 넣고(state.house.grow — 점검 준비), 나머지는 실제 키 —
// 문 앞 Space 로 들어가 층마다 계단까지 걸어서(W·A·D 꾹) 오르고 내린다. 겉모양·층마다 사진, 임시 상자·층 수·높이를 적는다.
async function homeStage({ stage, step: phase }) {
  const c = window.__island, { settle, step, press, key: kd, wait } = window.__ck;
  const S = c.services, P = S.player, H = S.house;
  const out = { stage, phase, ok: true, notes: [] };
  if (phase === 'outside') {
    try { if (H.inside) await H.leave(); } catch (e) { /* 밖 */ }
    S.time.setHour(11); step(10); await settle();
    const g = (c.state.house.grow ||= {});
    Object.assign(g, { stage, debt: 0, pending: null });
    for (let i = 0; i < 40; i++) { step(2); await wait(50); }
    const ex = (S.world.home?.objects ?? S.world.objects).list().filter(o => /^house-(player|grown)/.test(o.kind)).map(o => o.kind);
    out.exterior = ex;
    out.floors = H.grow.floors().map(f => `${f.n}:${f.w}×${f.d}`);
    const d = S.world.places.playerHouse.door;
    P.teleport(d.x - 1.2, d.z + 3.2, Math.PI * 0.85);   // 겉모양 사진: 집 앞 비스듬히
    step(20); await wait(300);
    return out;
  }
  if (phase === 'enter') {
    const d = S.world.places.playerHouse.door;
    P.teleport(d.x, d.z + 0.9, 0); step(4);
    kd('w', 'KeyW', true); step(8); kd('w', 'KeyW', false); step(6);
    const pk = S.gameplay.interactions.peek('action');
    out.peek = pk?.name ?? null;
    await press();
    for (let k = 0; k < 120 && !(H.inside && !H.passing); k++) { step(4); await wait(40); }
    await settle();
    out.inside = H.inside;
    out.level = H.grow.level;
    if (!H.inside) { out.ok = false; out.notes.push('들어가지 못함'); }
    return out;
  }
  // phase = 'climb:<to>' — 지금 층에서 그 층으로 가는 계단까지 걸어간다
  const to = Number(phase.split(':')[1]);
  const st = H.grow.stairs().find(s => s.to === to);
  if (!st) { out.ok = false; out.notes.push(`${to}층 가는 계단 없음`); return out; }
  P.teleport(st.from.x, st.from.z, 0); step(6);
  const dx = st.x - st.from.x, dz = st.z - st.from.z;
  const [k, code] = Math.abs(dz) > Math.abs(dx) ? (dz < 0 ? ['w', 'KeyW'] : ['s', 'KeyS']) : (dx < 0 ? ['a', 'KeyA'] : ['d', 'KeyD']);
  const from = H.grow.level;
  let peakY = 0;
  kd(k, code, true);
  for (let i = 0; i < 90 && H.grow.level === from; i++) { step(2); peakY = Math.max(peakY, P.position.y ?? 0); await wait(30); }
  kd(k, code, false);
  for (let i = 0; i < 60 && H.passing !== false; i++) { step(3); await wait(30); }
  await settle();
  for (let i = 0; i < 30; i++) { step(2); await wait(30); }
  out.level = H.grow.level;
  out.peakY = Math.round(peakY * 100) / 100;
  if (out.level !== to) { out.ok = false; out.notes.push(`${from}층 → ${to}층 못 감 (지금 ${out.level}, 자리 ${P.position.x.toFixed(1)},${P.position.z.toFixed(1)})`); }
  const near = new Set(), v = new c.THREE.Vector3();
  c.scene.traverse(o => { if (o.userData?.placeholder && o.visible !== false && o.getWorldPosition(v) && Math.abs(v.x - P.position.x) < 20 && Math.abs(v.z - P.position.z) < 20) near.add(String(o.userData.placeholder)); });
  out.placeholders = [...near];
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
    if (HOME) {   // M14 내 집 단계별
      const shoot = async name => { const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); const f = `shots/${target}-home-${name}.jpg`; await writeFile(join(outDir, f), Buffer.from(shot.data, 'base64')); return f; };
      const ROUTE = { 0: [], 1: [], 2: [1, 0], 3: [1, 2, 1, 0] };
      for (const stage of HOME) {
        const rows = [];
        const o = await ev(homeStage, { stage, step: 'outside' }); o.shot = await shoot(`s${stage}-outside`); rows.push(o);
        const e = await ev(homeStage, { stage, step: 'enter' }); e.shot = await shoot(`s${stage}-f0`); rows.push(e);
        for (const to of ROUTE[stage] ?? []) { const r = await ev(homeStage, { stage, step: `climb:${to}` }); r.shot = await shoot(`s${stage}-to${to}-${rows.length}`); rows.push(r); }
        await ev(leaveAll);
        for (const r of rows) { r.target = target; r.home = true; results.push(r); }
        say(`  내 집 ${stage}단계: 겉모양 ${o.exterior?.join(',')} · 층 ${o.floors?.join(' ')} · 들어감 ${e.inside ? '✅' : '✗'}` + rows.slice(2).map(r => ` · →${r.level}층 ${r.ok ? '✅' : '✗'} (높이 ${r.peakY})${r.placeholders?.length ? ` ⚠ 임시 상자 ${r.placeholders.join(',')}` : ''}`).join('') + rows.filter(r => !r.ok).map(r => ` ✗ ${r.notes.join(' ')}`).join(''));
      }
      results.push({ target, console: logs.slice(0, 20) });
      if (logs.length) say(`  콘솔·요청 ${logs.length}: ${logs.slice(0, 3).join(' | ')}`);
      cdp.close(); browser.kill(); await sleep(400);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
      continue;
    }
    const doors = [{ key: 'playerHouse', label: '내 집' }, { key: 'shop', label: '도토리상점' }, { key: 'museum', label: '박물관' },
      ...(b.residents ?? []).map(s => ({ key: 'villager', slug: s, label: `${s} 집` })), { key: 'moonshop', label: '달빛 가게' }, { key: 'tent', label: '새벽 천막' }];
    for (const hour of HOURS) for (const d of doors.filter(x => !ONLY || ONLY.includes(x.slug ?? x.key))) {
      const r = await ev(visitDoor, { hour, ...d });
      r.target = target;
      r.label ??= d.label;
      if (r.entered) {
        const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
        r.shot = `shots/${target}-${hour}-${d.slug ?? d.key}.jpg`;
        await writeFile(join(outDir, r.shot), Buffer.from(shot.data, 'base64'));
        r.leftOk = await ev(leaveAll);
      }
      results.push(r);
      say(`  ${String(hour).padStart(2)}시 ${String(d.label).padEnd(12)} ${r.entered ? `✅ 들어감 (${r.where})${r.looks?.n ? ` · 보기 ${r.looks.ok}/${r.looks.n}${r.looks.bad.length ? ` ✗ ${r.looks.bad.join(',')}` : ''} · ${r.looks.first ?? ''}` : ''}` : `·· ${r.note ?? r.error}`}${r.placeholders?.length ? ` ⚠ 임시 상자 ${r.placeholders.join(',')}` : ''} [${r.peek ?? '행동 없음'}${r.atHome ? ` · ${r.atHome}` : ''}${r.rule ? ` · ${r.rule}` : ''}]`);
    }
    results.push({ target, console: logs.slice(0, 20) });
    if (logs.length) say(`  콘솔·요청 ${logs.length}: ${logs.slice(0, 3).join(' | ')}`);
    cdp.close(); browser.kill(); await sleep(400);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  server?.kill();
  await writeFile(join(outDir, 'report.json'), JSON.stringify({ ran: stamp, date: DATE, results }, null, 1));
  const rows = results.filter(r => r.hour != null);
  const homeRows = results.filter(r => r.home);
  const hr = h => (h >= 24 ? `새벽 ${h - 24}시` : h >= 18 ? `밤 ${h - 12}시` : `낮 ${h}시`);
  const md = [`# 실내 점검 ${stamp}`, '', `날짜 흉내 ${DATE} (토) · 도구 \`tools/check-interiors.mjs\``, '', '| 대상 | 시각 | 문 | 결과 | 행동 키 · 주민 · 문 규칙 | 임시 상자 |', '|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.target} | ${hr(r.hour)} | ${r.label} | ${r.entered ? `✅ 들어감${r.shot ? ` ([사진](${r.shot}))` : ''}` : r.note ?? r.error} | ${r.peek ?? '—'}${r.atHome ? ` · ${r.atHome}` : ''}${r.rule ? ` · ${r.rule}` : ''} | ${r.placeholders?.join(', ') || ''} |`),
    ...(homeRows.length ? ['', '## 내 집 단계별 (M14 --home)', '', '| 대상 | 단계 | 할 일 | 결과 | 사진 |', '|---|---|---|---|---|',
      ...homeRows.map(r => `| ${r.target} | ${r.stage} | ${r.phase} | ${r.ok ? '✅' : '✗'} ${r.exterior ? `겉모양 ${r.exterior.join(',')} · 층 ${r.floors.join(' ')}` : r.phase === 'enter' ? `들어감 ${r.inside} (${r.peek})` : `→ ${r.level}층 · 높이 ${r.peakY}`}${r.notes?.length ? ` · ${r.notes.join(' ')}` : ''}${r.placeholders?.length ? ` · 임시 상자 ${r.placeholders.join(',')}` : ''} | [사진](${r.shot}) |`)] : []),
    '', ...results.filter(r => r.console).map(r => `- [${r.target}] 콘솔 오류·실패 요청 ${r.console.length}${r.console.length ? `: ${r.console.join(' · ')}` : ''}`)].join('\n');
  await writeFile(join(outDir, 'report.md'), md);
  const bad = homeRows.filter(r => !r.ok || r.error || r.placeholders?.length).length + rows.filter(r => r.error || r.placeholders?.length || r.looks?.bad?.length || (r.entered && r.leftOk === false)).length + results.filter(r => r.console?.length).length;
  say(`\n결과 ${outDir} · 문제 ${bad}`);
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
