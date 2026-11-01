// 기기 점검 ?check (M7-P2 · 보드 wave7 D39-A · 화면 UI-07).
// 주소 끝에 ?check 를 붙여 열면 (claude.ai 게시본은 #check) 섬이 열린 뒤 30초 동안 광장 → 선착장 → 집 앞을 차례로 돌며 잰다:
//   GPU 이름, 화면 크기·픽셀 배율, 프레임 시간(평균·95%), 그리기 시간(gl.finish 까지), 그리기 호출·삼각형, 고른 품질(자동으로 바뀐 때),
//   오류 수. 끝나면 결과 카드를 보여 주고 「결과 저장」이면 게임 저장소 checks 컬렉션에 한 줄 (모양은 docs/notes/p11-check.md).
// 목표는 광장 평균 33ms 아래 (quality.js PLAZA.slowMs). 넘으면 quality.js 의 광장 판단이 점검 중에 저사양으로 내리고, 결과에 그 일이 남는다.
// 플레이어는 점검 동안 얼려 두고 자리만 옮긴다 (광장에서는 작은 원을 돈다). 끝나면 원래 자리로 돌려놓는다.
// render/index.js 가 주소에 check 가 있을 때만 (checkRequested) 만들고, 매 프레임 그리기 앞뒤로 begin() · end(dt) 를 부른다.
// 아래 순수 함수(routeSpots · buildRecord · checkProblems)는 tests/check.test.mjs 가 Node 에서 검사한다 — 모듈 위쪽에서 DOM 을 건드리지 않는다.
import { frameStats, plazaArea, PLAZA, urlQuality, normalizeQuality, QUALITY_LABELS } from './quality.js';

/** 점검 시간 (초). warm + 자리 sec 합 = total */
export const CHECK = {
  total: 30,
  warm: 2,            // 섬이 열린 뒤 (로딩 화면이 걷힌 뒤) 셰이더 만들기 등으로 튀는 시간 — 재지 않는다
  settle: 1.5,        // 자리를 옮긴 뒤 건너뛰는 시간 (그림자·가림 다시 계산)
  finishEvery: 8,     // 몇 프레임마다 gl.finish 로 GPU 까지 기다려 그리기 시간을 잴지 (그 다음 간격은 버린다)
  gapMax: 1000,       // 이보다 긴 간격은 멈춤으로 보고 버린다
  maxErrors: 5,       // 결과에 적는 오류 글 수 (개수는 모두 센다)
};

/** 도는 자리 (차례대로). 보드 UI-07 「광장·선착장·집 앞」 */
export const ROUTE = [
  { id: 'plaza', label: '광장', sec: 12, walk: true },
  { id: 'dock', label: '선착장', sec: 8 },
  { id: 'home', label: '집 앞', sec: 8 },
];

/** 저장소 모양 (게임 아티팩트 capabilities db). 고치면 version 을 올리고 notes 의 표도 고친다 */
export const CHECK_STORE = { collection: 'checks', version: 1 };

/** 점검을 켤까: 주소 ?check (로컬) 또는 #check (claude.ai 게시본 — 링크의 ?… 는 페이지까지 오지 않고 #… 만 온다) */
export function checkRequested({ search = '', hash = '' } = {}) {
  return new URLSearchParams(search).has('check') || /^#check(?:$|[&?=])/.test(hash);
}

/** world.places → 자리 목록 [{ id, label, sec, walk, x, z, r }]. 없는 자리는 빼고 그 시간은 광장에 더한다 */
export function routeSpots(places) {
  const plaza = plazaArea(places);
  const door = places?.playerHouse?.door;
  const at = {
    plaza: plaza && { x: plaza.x, z: plaza.z, r: Math.min(2.5, plaza.r * 0.4) },
    dock: places?.dock && { x: places.dock.x, z: places.dock.z },
    home: door && { x: door.x, z: door.z + 1.2 },       // 문 앞 칸에서 한 칸 남짓 앞 (문은 섬 남쪽 = +z 를 본다)
  };
  const out = [];
  let spare = 0;
  for (const s of ROUTE) {
    if (at[s.id]) out.push({ ...s, ...at[s.id] });
    else spare += s.sec;
  }
  if (out.length && spare) out[0] = { ...out[0], sec: out[0].sec + spare };
  return out;
}

const r2 = v => (v == null ? null : +Number(v).toFixed(2));
const avgOf = a => (a.length ? r2(a.reduce((x, y) => x + y, 0) / a.length) : null);

/**
 * 잰 값 → 저장할 한 줄 (JSON 값만, 원본 표본은 넣지 않는다 — 문서 하나 256 KiB 안).
 * samples: { [자리 id]: { gaps:[], render:[], finish:[], calls:[], tris:[] } }
 */
export function buildRecord({ spots, samples, device = {}, quality = {}, errors = { count: 0, list: [] }, time = null, startedAt, ms, build = null, where = null }) {
  const all = [];
  const stops = spots.map(s => {
    const m = samples[s.id] ?? {};
    all.push(...(m.gaps ?? []));
    const fin = frameStats(m.finish ?? []);
    return {
      id: s.id, label: s.label,
      frame: frameStats(m.gaps ?? []),
      draw: { avg: fin.avg, p95: fin.p95, n: fin.n },
      cpu: avgOf(m.render ?? []),
      calls: { avg: avgOf(m.calls ?? []) == null ? null : Math.round(avgOf(m.calls)), max: m.calls?.length ? Math.max(...m.calls) : null },
      tris: m.tris?.length ? Math.round(avgOf(m.tris)) : null,
    };
  });
  const plaza = stops.find(s => s.id === 'plaza') ?? null;
  return {
    v: CHECK_STORE.version,
    kind: 'device-check',
    at: startedAt,
    ms: Math.round(ms ?? 0),
    build, where,
    device,
    quality: { start: quality.start ?? null, end: quality.end ?? null, changes: quality.changes ?? [], fixed: !!quality.fixed },
    frame: frameStats(all),
    stops,
    plaza: plaza && { avg: plaza.frame.avg, p95: plaza.frame.p95, goal: PLAZA.slowMs, ok: plaza.frame.avg != null && plaza.frame.avg <= PLAZA.slowMs },
    errors: { count: errors.count ?? 0, list: (errors.list ?? []).slice(0, CHECK.maxErrors) },
    time,
  };
}

/** 저장 전에 모양 검사 → 문제 글 목록 (비면 정상) */
export function checkProblems(rec) {
  const out = [];
  if (rec?.v !== CHECK_STORE.version) out.push(`v 가 ${CHECK_STORE.version} 이 아님`);
  if (rec?.kind !== 'device-check') out.push('kind 가 device-check 가 아님');
  if (typeof rec?.at !== 'string' || Number.isNaN(Date.parse(rec.at))) out.push('at 이 날짜 글이 아님');
  if (!Array.isArray(rec?.stops) || !rec.stops.length) out.push('stops 가 비었음');
  for (const s of rec?.stops ?? []) if (!ROUTE.some(r => r.id === s.id)) out.push(`모르는 자리 ${s.id}`);
  if (!rec?.device?.gpu) out.push('device.gpu 없음');
  const text = JSON.stringify(rec ?? null);
  if (text.length > 64 * 1024) out.push(`너무 큼 (${text.length} 글자)`);
  if (/undefined|NaN/.test(JSON.stringify(rec, (k, v) => (v === undefined ? 'undefined' : Number.isNaN(v) ? 'NaN' : v)))) out.push('undefined · NaN 값');
  return out;
}

// ───────────────────────── 여기부터 브라우저에서만 ─────────────────────────

/** GPU 이름: 확장이 있으면 실제 이름, 없으면 브라우저가 주는 이름 */
function gpuInfo(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const get = k => { try { return String(gl.getParameter(k) ?? ''); } catch { return ''; } };
  return {
    gpu: (ext && get(ext.UNMASKED_RENDERER_WEBGL)) || get(gl.RENDERER) || '알 수 없음',
    vendor: (ext && get(ext.UNMASKED_VENDOR_WEBGL)) || get(gl.VENDOR) || '',
    webgl: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? 2 : 1,
    maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || null,
  };
}

function deviceInfo(ctx) {
  const { renderer } = ctx;
  const gl = renderer.getContext();
  const c = renderer.domElement;
  return {
    ...gpuInfo(gl),
    screen: { w: screen.width, h: screen.height, vw: innerWidth, vh: innerHeight, dpr: r2(devicePixelRatio), ratio: r2(renderer.getPixelRatio()), canvas: [c.width, c.height], portrait: innerHeight > innerWidth },
    touch: !!ctx.input?.touch || matchMedia('(pointer: coarse)').matches,
    ua: navigator.userAgent.slice(0, 300),
    lang: navigator.language ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    memory: navigator.deviceMemory ?? null,
  };
}

/** 웹 빌드 번호: build-web.mjs 가 페이지에 남기는 주석 「포근섬 이야기 웹 빌드 <번호> · …」 */
function buildStamp() {
  try {
    const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const m = /웹 빌드 (\S+)/.exec(n.data); if (m) return m[1]; }
  } catch { /* 없음 */ }
  return null;
}

/** 오류 세기: 점검을 켠 순간(그리기 준비 = 모듈 불러오기 전)부터 console.error · 잡히지 않은 오류 · 거절 */
function watchErrors() {
  const box = { count: 0, list: [] };
  const add = msg => { box.count++; if (box.list.length < CHECK.maxErrors) box.list.push(String(msg).slice(0, 200)); };
  const orig = console.error;
  console.error = (...a) => { add(a.map(x => (x instanceof Error ? x.message : typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(' ')); return orig.apply(console, a); };
  addEventListener('error', e => add(e.message || `파일을 받지 못함: ${e.target?.src ?? e.target?.href ?? '?'}`), true);
  addEventListener('unhandledrejection', e => add(`거절: ${e.reason?.message ?? e.reason}`));
  return box;
}

/** 저장: 게시본은 게임 저장소(db) → 로컬 dev-server 는 /api/db/checks → 그것도 안 되면 이 브라우저 (마지막 한 줄) */
export async function saveCheck(rec) {
  if (window.claude?.use) {
    const db = await window.claude.use('db').catch(() => null);
    if (!db) return { ok: false, where: 'none', msg: '이 창에서는 게임 저장소를 쓸 수 없어요 (로그인했는지 확인해 주세요).' };
    let by = null;
    try { const user = await window.claude.use('user'); by = (await user?.id?.()) ?? null; } catch { /* 누구인지 모름 */ }
    try {
      const ref = await db.collection(CHECK_STORE.collection).add({ ...rec, by });
      return { ok: true, where: 'db', id: ref.id, msg: '게임 저장소에 남겼어요.' };
    } catch (e) {
      return { ok: false, where: 'db', msg: `게임 저장소에 남기지 못했어요 (${e?.code ?? e?.message ?? '오류'}).` };
    }
  }
  try {
    const r = await fetch(`/api/db/${CHECK_STORE.collection}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec) });
    if (r.ok) return { ok: true, where: 'local', id: (await r.json()).id, msg: '개발 서버 assets/review/checks.json 에 남겼어요.' };
  } catch { /* 서버 없음 */ }
  try { localStorage.setItem('island:check:last', JSON.stringify(rec)); return { ok: true, where: 'browser', msg: '저장소가 없어 이 브라우저에만 남겼어요.' }; }
  catch { return { ok: false, where: 'none', msg: '저장할 곳이 없어요. 아래 글을 복사해 채팅에 붙여 주세요.' }; }
}

const CSS = `
.ck-pill,.ck-card{position:fixed;z-index:90;left:max(12px,env(safe-area-inset-left,0px));top:max(12px,env(safe-area-inset-top,0px));box-sizing:border-box;color:#4A3B32;background:#FFF8E6;box-shadow:0 3px 0 #E2D2AE,0 0 0 2px #E2D2AE inset;font:400 15px/1.4 "Gowun Dodum","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.ck-pill{display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px;border-radius:999px;pointer-events:none}
.ck-ring{width:34px;height:34px;flex:none}
.ck-ring circle{fill:none;stroke-width:4}
.ck-pill b,.ck-card h2{font:400 17px/1.2 "Jua","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.ck-card{word-break:keep-all;width:min(420px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:16px;border-radius:18px;display:grid;gap:10px}
.ck-card h2{margin:0;font-size:21px}
.ck-card dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0}
.ck-card dt{color:#76675B}
.ck-card dd{margin:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.ck-card table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.ck-card th,.ck-card td{padding:4px 6px;text-align:right;border-bottom:1px solid #E2D2AE}
.ck-card th:first-child,.ck-card td:first-child{text-align:left}
.ck-card th{font-weight:400;color:#76675B;font-size:13px}
.ck-goal{padding:8px 12px;border-radius:12px;background:#E6F2D9}
.ck-goal.is-bad{background:#F8E0D4;color:#8A3B1C}
.ck-btns{display:flex;flex-wrap:wrap;gap:8px}
.ck-btns button{font:400 16px/1 "Jua","Apple SD Gothic Neo","Malgun Gothic",sans-serif;padding:11px 18px;border:0;border-radius:999px;cursor:pointer;background:#4A3B32;color:#FFF8E6;box-shadow:0 3px 0 #2E2420}
.ck-btns button.is-soft{background:#FFF8E6;color:#4A3B32;box-shadow:0 3px 0 #E2D2AE,0 0 0 2px #E2D2AE inset}
.ck-btns button:disabled{opacity:.5;cursor:default}
.ck-btns button:focus-visible{outline:3px solid #7DB356;outline-offset:3px}
.ck-msg{margin:0;min-height:1.4em;color:#76675B}
.ck-card details textarea{width:100%;box-sizing:border-box;height:9em;font:12px/1.4 ui-monospace,monospace;color:#4A3B32;background:#fff;border:1px solid #E2D2AE;border-radius:8px}
@media (prefers-reduced-motion: reduce){.ck-ring circle{transition:none}}
`;

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const k of kids) n.append(k);
  return n;
};
const ms = v => (v == null ? '-' : `${v.toFixed(1)}ms`);

/** 점검 하나. render/index.js 가 주소에 check 가 있을 때 만든다 → { begin(), end(dt), result } */
export function createCheck(ctx, { service } = {}) {
  const { renderer, events } = ctx;
  const gl = renderer.getContext();
  const errors = watchErrors();
  const isFixed = () => !!urlQuality(location) || !!normalizeQuality(ctx.state?.settings?.spec);   // 저장을 불러온 뒤에 본다 (섬폰 「그래픽 사양」)
  let state = 'boot', ready = false, t0 = 0, frameT0 = 0, lastNow = 0, frameNo = 0, skipGap = false;
  let spots = [], spot = -1, samples = {}, home = null, froze = false, startedAt = null, quality = null, result = null;
  let pill = null, card = null, ring = null, pillText = null;
  events?.once?.('game:ready', () => { ready = true; });
  events?.on?.('quality:changed', ({ quality: q, auto }) => {
    if (state !== 'run' || !quality) return;
    quality.changes.push({ to: q, auto: !!auto, at: r2((performance.now() - t0) / 1000), stop: spots[spot]?.id ?? null });
  });

  const css = () => { if (!document.getElementById('ck-css')) document.head.append(el('style', { id: 'ck-css' }, CSS)); };
  const player = () => ctx.services.player;
  const loaderUp = () => !!document.getElementById('loader');   // 게시본: 로딩 화면·시작 단추가 걷힌 뒤에 시작

  function start() {
    spots = routeSpots(ctx.services.world?.places);
    samples = Object.fromEntries(spots.map(s => [s.id, { gaps: [], render: [], finish: [], calls: [], tris: [] }]));
    spot = -1;
    startedAt = new Date().toISOString();
    t0 = performance.now();
    quality = { start: ctx.quality ?? service?.quality ?? null, end: null, changes: [], fixed: isFixed() };
    const p = player();
    if (p) { home = { x: p.position.x, z: p.position.z, facing: p.facing }; froze = !p.frozen; if (froze) p.freeze(true); }
    card?.remove(); card = null;
    css();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ck-ring'); svg.setAttribute('viewBox', '0 0 34 34'); svg.setAttribute('aria-hidden', 'true');
    const back = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    Object.entries({ cx: 17, cy: 17, r: 14, stroke: '#E2D2AE' }).forEach(([k, v]) => back.setAttribute(k, v));
    const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    Object.entries({ cx: 17, cy: 17, r: 14, stroke: '#7DB356', 'stroke-dasharray': '88 88', 'stroke-dashoffset': '88', transform: 'rotate(-90 17 17)' }).forEach(([k, v]) => fg.setAttribute(k, v));
    svg.append(back, fg);
    ring = fg;
    pillText = el('span', {}, '');
    pill = el('div', { class: 'ck-pill', role: 'status', 'aria-live': 'polite' }, svg, el('b', {}, '기기 점검'), pillText);
    document.body.append(pill);
    state = 'run';
    console.info(`[check] 기기 점검 시작 — ${spots.map(s => `${s.label} ${s.sec}초`).join(' · ')}`);
  }

  /** 자리 옮기기 (광장은 작은 원을 돈다) */
  function place(s, sec) {
    const p = player();
    if (!p || !s) return;
    if (s.walk) {
      const a = sec * 0.45;
      p.teleport(s.x + Math.cos(a) * s.r, s.z + Math.sin(a) * s.r, Math.atan2(Math.sin(a), -Math.cos(a)));
    } else if (sec === 0) p.teleport(s.x, s.z, 0);
  }

  function finish() {
    state = 'done';
    pill?.remove(); pill = null;
    const p = player();
    if (p && home) { p.teleport(home.x, home.z, home.facing); if (froze) p.freeze(false); }
    quality.end = ctx.quality ?? service?.quality ?? null;
    const t = ctx.services.time;
    let time = null;
    try { const n = t?.now?.(); time = n ? { hour: n.hour ?? null, season: n.season ?? null, weather: t.weather ?? null } : null; } catch { /* 시계 없음 */ }
    result = buildRecord({
      spots, samples, device: deviceInfo(ctx), quality, errors, time, startedAt,
      ms: performance.now() - t0, build: buildStamp(), where: window.claude ? 'claude' : location.pathname.startsWith('/artifact') ? 'artifact-local' : 'local',
    });
    const bad = checkProblems(result);
    if (bad.length) console.warn('[check] 결과 모양 문제', bad);
    console.info('[check] 기기 점검 끝', result);
    events?.emit?.('check:done', { result });
    showCard(result);
  }

  function showCard(rec) {
    css();
    const d = rec.device, q = rec.quality;
    const L = k => QUALITY_LABELS[k] ?? k;
    const qText = q.changes.length ? `${L(q.start)} → ${L(q.end)} (${q.changes.map(c => `${c.auto ? '자동' : '바꿈'}, ${spots.find(s => s.id === c.stop)?.label ?? '?'} ${c.at}초`).join(' · ')})` : `${L(q.end)}${q.fixed ? ' (골라 둔 사양)' : ''}`;
    const dl = el('dl');
    const row = (k, v) => dl.append(el('dt', {}, k), el('dd', {}, v));
    row('GPU', d.gpu);
    row('화면', `${d.screen.vw}×${d.screen.vh} (${d.screen.portrait ? '세로' : '가로'}) · 배율 ${d.screen.dpr} → 그리기 ${d.screen.ratio}`);
    row('품질', qText);
    row('프레임', `평균 ${ms(rec.frame.avg)} · 95% ${ms(rec.frame.p95)} · ${rec.frame.n}장`);
    row('오류', String(rec.errors.count));
    const table = el('table');
    table.append(el('tr', {}, ...['자리', '평균', '95%', '그리기', '호출'].map(h => el('th', { scope: 'col' }, h))));
    for (const s of rec.stops) table.append(el('tr', {}, el('td', {}, s.label), el('td', {}, ms(s.frame.avg)), el('td', {}, ms(s.frame.p95)), el('td', {}, ms(s.draw.avg)), el('td', {}, s.calls.avg == null ? '-' : String(s.calls.avg))));
    const ok = rec.plaza?.ok;
    const goal = el('p', { class: `ck-goal${ok ? '' : ' is-bad'}` }, rec.plaza
      ? (ok ? `광장 평균 ${ms(rec.plaza.avg)} — 목표 ${rec.plaza.goal}ms 안이에요.` : `광장 평균 ${ms(rec.plaza.avg)} — 목표 ${rec.plaza.goal}ms 를 넘어요.${q.end === 'low' ? ' 저사양으로 낮췄어요.' : ''}`)
      : '광장 자리를 찾지 못했어요.');
    const msg = el('p', { class: 'ck-msg', role: 'status', 'aria-live': 'polite' }, '');
    const save = el('button', { type: 'button' }, '결과 저장');
    const again = el('button', { type: 'button', class: 'is-soft' }, '다시 재기');
    const close = el('button', { type: 'button', class: 'is-soft' }, '닫기');
    const text = el('textarea', { readonly: '', 'aria-label': '점검 결과 글' });
    text.value = JSON.stringify(rec, null, 1);
    const more = el('details', {}, el('summary', {}, '결과 글로 보기 (복사해서 채팅에 붙여도 돼요)'), text);
    save.addEventListener('click', async () => {
      save.disabled = true; msg.textContent = '남기는 중…';
      const r = await saveCheck(rec);
      msg.textContent = r.msg;
      if (r.ok) save.textContent = '저장했어요'; else save.disabled = false;
      if (!r.ok) more.open = true;
    });
    again.addEventListener('click', () => { card.remove(); card = null; state = 'warm'; t0 = performance.now(); });
    close.addEventListener('click', () => { card.remove(); card = null; });
    card = el('section', { class: 'ck-card', role: 'dialog', 'aria-label': '기기 점검 결과' },
      el('h2', {}, '기기 점검 결과'), dl, goal, el('div', { style: 'overflow-x:auto' }, table), el('div', { class: 'ck-btns' }, save, again, close), msg, more);
    document.body.append(card);
    save.focus({ preventScroll: true });
  }

  return {
    get result() { return result; },
    get state() { return state; },
    /** 그리기 직전 */
    begin() { frameT0 = performance.now(); },
    /** 그린 직후 */
    end(dt) {
      const now = performance.now();
      const gap = now - lastNow;
      lastNow = now;
      if (state === 'boot') {
        if (ready && !loaderUp() && ctx.services.player) { state = 'warm'; t0 = now; }
        return;
      }
      if (state === 'warm') {
        if (!t0) t0 = now;
        if (now - t0 >= CHECK.warm * 1000) start();
        return;
      }
      if (state !== 'run') return;
      const sec = (now - t0) / 1000, total = spots.reduce((n, x) => n + x.sec, 0);
      // 지금 자리
      let acc = 0, i = 0;
      for (; i < spots.length; i++) { if (sec < acc + spots[i].sec) break; acc += spots[i].sec; }
      if (i >= spots.length || !spots.length) return finish();
      const s = spots[i], inSpot = sec - acc;
      if (i !== spot) { spot = i; place(s, 0); skipGap = true; }
      place(s, inSpot);
      // 고리·글
      ring?.setAttribute('stroke-dashoffset', String(88 * (1 - Math.min(1, sec / total))));
      if (pillText) pillText.textContent = `${s.label} · ${Math.max(0, Math.ceil(total - sec))}초`;
      if (inSpot < CHECK.settle || document.hidden) { skipGap = true; return; }
      const m = samples[s.id];
      frameNo++;
      if (!skipGap && gap > 0 && gap < CHECK.gapMax) m.gaps.push(gap);
      skipGap = false;
      m.render.push(now - frameT0);
      const info = renderer.info.render;
      m.calls.push(info.calls); m.tris.push(info.triangles);
      if (frameNo % CHECK.finishEvery === 0) {
        gl.finish();
        m.finish.push(performance.now() - frameT0);
        skipGap = true;                 // 기다린 만큼 다음 간격이 길어진다
      }
    },
  };
}
