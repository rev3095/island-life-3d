// 문제 알리기 창 (M7-P4 UI-08, 보드 wave7 D46-A): 무엇이 문제였는지 글 + 최근 오류·기기·버전·지금 자리를 담아
// 게임 저장소 `reports/<id>` 에 { status: 'new', … } 로 보낸다 → "전체 요청 확인"·편집기 홈이 읽는다.
// 저장소가 없는 창(공유 링크로 들어온 사람·로그인 안 함)은 쓰지 못하므로 같은 내용을 글로 복사해 만든 사람에게 보내게 한다.
// 로컬 dev-server 는 /api/db/game-reports (assets/review/game-reports.json) 로 대신 받는다.
// 창은 ctx.services.ui.panel 로만 연다 (섬폰 메뉴 줄은 P3 이 ui.report.open() 을 부른다). 모양은 docs/notes/p11-save.md.
import { h } from './dom.js';
import { panelShell, button } from './panels.js';
import { SAVE_VERSION } from '../data/save.js';
import { STATE_VERSION } from '../core/state.js';

/** 무엇이 문제였나요 — 고르는 칸 (id → 글). 저장소 `kind` 값 */
export const REPORT_KINDS = [
  ['stuck', '막혔어요'],
  ['error', '오류·멈춤'],
  ['save', '저장'],
  ['look', '보기·소리'],
  ['other', '그 밖'],
];
export const REPORT_TEXT_MAX = 1000;
const ERRORS_IN_REPORT = 10;
const STACKS_IN_REPORT = 3;     // 스택은 최근 오류 몇 개만 (문서 크기)

const p2 = n => String(n).padStart(2, '0');
/** 문서 id: r20261031-142305-ab12 (저장소 경로 글자만) */
export function reportId(at = Date.now(), rand = Math.random) {
  const d = new Date(at);
  const tail = Math.floor(rand() * 0x10000).toString(16).padStart(4, '0');
  return `r${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}-${tail}`;
}

const safe = fn => { try { return fn(); } catch { return null; } };
const round = (v, k = 100) => (Number.isFinite(v) ? Math.round(v * k) / k : null);

/** 기기: 브라우저·화면·터치·품질·GPU (개인 정보 없이) */
export function deviceInfo(ctx, env = globalThis) {
  const nav = env.navigator ?? {};
  const gl = safe(() => ctx.renderer?.getContext?.());
  const gpu = safe(() => {
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
  });
  return {
    ua: String(nav.userAgent ?? '').slice(0, 300),
    lang: nav.language ?? null,
    screen: env.screen ? { w: env.screen.width, h: env.screen.height } : null,
    view: Number.isFinite(env.innerWidth) ? { w: env.innerWidth, h: env.innerHeight, dpr: round(env.devicePixelRatio ?? 1) } : null,
    touch: !!ctx.input?.touch,
    quality: ctx.quality ?? null,
    gpu: gpu ? String(gpu).slice(0, 160) : null,
    memory: nav.deviceMemory ?? null,
  };
}

/** 지금 자리: 섬 위 좌표·집 안·시각·날씨·장면·열린 창 */
export function placeInfo(ctx) {
  const s = ctx.services ?? {};
  const pos = safe(() => s.player?.position);
  const now = safe(() => s.time?.now?.());
  return {
    x: round(pos?.x ?? ctx.state?.player?.x, 10),
    z: round(pos?.z ?? ctx.state?.player?.z, 10),
    indoor: safe(() => !!(s.house?.inside ?? s.time?.indoor)) ?? false,
    time: now ? `${now.year}-${p2(now.month)}-${p2(now.day)} ${p2(now.hour)}:${p2(now.minute)}` : null,
    timeMode: ctx.state?.time?.mode ?? null,
    weather: safe(() => s.time?.weather) ?? null,
    story: safe(() => s.story?.playing?.id) ?? null,
    tool: safe(() => s.player?.tool) ?? ctx.state?.player?.tool ?? null,
  };
}

/** 진행: 이름·도토리·첫날 안내 단계 (무엇까지 했는지 보는 정도) */
export function progressInfo(state) {
  const fd = state?.flags?.firstday;
  return {
    player: state?.player?.name ?? '',
    island: state?.island?.name ?? '',
    acorns: state?.wallet?.acorns ?? 0,
    days: Number.isFinite(state?.createdAt) ? Math.max(0, Math.floor((Date.now() - state.createdAt) / 864e5)) : null,
    firstday: fd?.done && typeof fd.done === 'object' ? Object.keys(fd.done).filter(k => fd.done[k]).slice(0, 30) : [],   // 첫날 안내에서 끝낸 단계
    firstdayFinished: fd?.finished ?? null,
    museum: ['fish', 'bug', 'fossil'].reduce((n, c) => n + (state?.museum?.[c]?.length ?? 0), 0),
  };
}

/** 지금 판 (빌드·주소·저장 버전). 빌드는 게시본 로딩 화면이 window.__islandBuild 로 두면 그 값 (P2 부탁), 아니면 'dev' */
export function gameInfo(env = globalThis) {
  const loc = env.location;
  return {
    build: typeof env.__islandBuild === 'string' ? env.__islandBuild : 'dev',
    saveVersion: SAVE_VERSION,
    stateVersion: STATE_VERSION,
    page: loc ? `${loc.pathname}${loc.search}`.slice(0, 200) : null,
    artifact: !!env.claude,
  };
}

/**
 * 보낼 문서 만들기. withInfo=false 면 오류·기기·자리 없이 글만.
 * 모양: { status:'new', kind, text, createdAt, game, device?, place?, progress?, errors?, errorTotal, reply:null }
 */
export function buildReport(ctx, { kind = 'other', text = '', withInfo = true } = {}, { now = Date.now(), env = globalThis } = {}) {
  const doc = {
    status: 'new',
    kind: REPORT_KINDS.some(([k]) => k === kind) ? kind : 'other',
    text: String(text ?? '').trim().slice(0, REPORT_TEXT_MAX),
    createdAt: now,
    game: gameInfo(env),
    errorTotal: ctx.errors?.total ?? 0,
    reply: null,
  };
  if (!withInfo) return doc;
  const errs = ctx.errors?.recent?.(ERRORS_IN_REPORT) ?? [];
  doc.errors = errs.map((e, i) => ({
    kind: e.kind, message: e.message, source: e.source ?? null, count: e.count, at: e.at,
    ...(i >= errs.length - STACKS_IN_REPORT && e.stack ? { stack: e.stack } : {}),
  }));
  doc.device = deviceInfo(ctx, env);
  doc.place = placeInfo(ctx);
  doc.progress = progressInfo(ctx.state);
  return doc;
}

const KIND_NAME = Object.fromEntries(REPORT_KINDS);
const localTime = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
/** 채팅·메시지에 붙여 넣을 글 (저장소에 못 보낼 때) */
export function reportText(doc, id) {
  const lines = [`[포근섬 문제 알리기] ${id ?? ''}`.trim(), `무엇: ${KIND_NAME[doc.kind] ?? doc.kind}`, `글: ${doc.text || '(없음)'}`,
    `판: ${doc.game.build} · 저장 v${doc.game.saveVersion} · ${localTime(doc.createdAt)}`];
  if (doc.place) lines.push(`자리: ${doc.place.indoor ? '집 안' : '섬'} (${doc.place.x}, ${doc.place.z}) · ${doc.place.time ?? ''} · ${doc.place.weather ?? ''}${doc.place.story ? ` · 장면 ${doc.place.story}` : ''}`);
  if (doc.device) lines.push(`기기: ${doc.device.view ? `${doc.device.view.w}×${doc.device.view.h}@${doc.device.view.dpr}` : ''} ${doc.device.touch ? '터치' : ''} · ${doc.device.quality ?? ''} · ${doc.device.gpu ?? ''}`, `브라우저: ${doc.device.ua}`);
  if (doc.errors?.length) {
    lines.push(`최근 오류 ${doc.errors.length}개 (모두 ${doc.errorTotal}번):`);
    for (const e of doc.errors) lines.push(`- [${e.kind}] ${e.message}${e.count > 1 ? ` ×${e.count}` : ''}${e.source ? ` (${e.source})` : ''}`);
  }
  return lines.join('\n');
}

/** 로컬 dev-server 인가 (/api/ping) — 한 번만 물어본다 */
let localApi = null;
async function hasLocalApi(fetchFn) {
  if (localApi == null) localApi = fetchFn('api/ping').then(r => r.ok, () => false);
  return localApi;
}

/**
 * 보내기 → { ok, where: 'db' | 'local', id } | { ok: false, reason }.
 * 순서: 아티팩트 저장소 `reports/<id>` → 로컬 dev-server `api/db/game-reports` → 실패 (글 복사로).
 */
export async function sendReport(doc, { id = reportId(doc.createdAt), claude = globalThis.claude, fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
  let db = null;
  if (claude?.use) {
    let timer;
    db = await Promise.race([
      Promise.resolve().then(() => claude.use('db')).catch(() => null),
      new Promise(res => { timer = setTimeout(() => res(null), 10000); }),
    ]);
    clearTimeout(timer);
  }
  if (db) {
    try {
      await db.doc(`reports/${id}`).set(doc);
      return { ok: true, where: 'db', id };
    } catch (e) {
      return { ok: false, reason: e?.code === 'invalid_argument' ? '이 창에서는 보낼 권한이 없어요.' : `보내지 못했어요 (${e?.code ?? '오류'}).` };
    }
  }
  if (fetchFn && !claude && await hasLocalApi(fetchFn)) {
    try {
      const r = await fetchFn('api/db/game-reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...doc, docId: id }) });
      if (r.ok) return { ok: true, where: 'local', id };
    } catch { /* 아래로 */ }
  }
  return { ok: false, reason: '이 창에서는 게임 저장소에 보낼 수 없어요.' };
}

// ---------- 창 ----------

const CSS = `
.pk-report { width: min(460px, 100%); }
.pk-report .pk-card-body { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; }
.pk-report .pk-seg { flex-wrap: wrap; border-radius: 22px; }
.pk-report .pk-seg-btn { flex: 1 1 auto; padding: 0 12px; }
.pk-report-text { width: 100%; box-sizing: border-box; min-height: 96px; resize: vertical; padding: 10px 12px; border: 2px solid var(--pk-edge); border-radius: 16px; background: var(--pk-slot); font: 16px/1.5 var(--pk-body); color: var(--pk-ink); }
.pk-report-text:focus-visible, .pk-report-copy:focus-visible { outline: 3px solid var(--pk-focus); outline-offset: 1px; }
.pk-report-check { display: flex; gap: 8px; align-items: center; font-size: 15px; }
.pk-report-check input { width: 22px; height: 22px; accent-color: var(--pk-accent-deep); }
.pk-report details { font-size: 13px; }
.pk-report summary { cursor: pointer; padding: 4px 0; }
.pk-report-copy { width: 100%; box-sizing: border-box; min-height: 120px; max-height: 30vh; padding: 8px 10px; border: 2px dashed var(--pk-edge); border-radius: 12px; background: var(--pk-cream); font: 12px/1.45 ui-monospace, Consolas, monospace; color: var(--pk-ink); white-space: pre; }
.pk-report-result { min-height: 1.4em; margin: 0; font-size: 15px; word-break: keep-all; }
.pk-report-result.is-warn { color: #B4532A; }
`;
export function injectCss(id, css) {
  if (globalThis.document?.querySelector(`style[data-pk-${id}]`)) return;
  document.head.append(h('style', { [`data-pk-${id}`]: '' }, css));
}

/** 글 칸 안에서는 방향키·Enter·Home/End 를 글 편집에 쓴다 (panels 가 창 안 이동으로 가져가지 않게) */
const EDIT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter', 'Space', 'Home', 'End']);
export function textFieldKeys(e) {
  const el = e.target;
  if (!el?.matches?.('textarea, input[type="text"], input:not([type])') || !EDIT_KEYS.has(e.code)) return false;
  e.preventDefault = () => {};   // panels 가 true 를 받으면 preventDefault 를 부른다 → 글 편집이 그대로 되게
  return true;
}

export async function copyText(text, fallbackEl) {
  try {
    await globalThis.navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 클립보드가 막힌 창: 글 상자를 골라 두면 사용자가 Ctrl+C / 길게 눌러 복사
    if (fallbackEl) { fallbackEl.focus(); fallbackEl.select?.(); }
    try { return globalThis.document.execCommand?.('copy') ?? false; } catch { return false; }
  }
}

export function createReport(ctx) {
  let open = null;

  function openReport({ kind = null, text = '' } = {}) {
    const ui = ctx.services.ui;
    if (!ui?.panel) return Promise.resolve(null);
    if (open) return open.result;
    injectCss('report', CSS);
    // 창을 여는 순간 그대로 담는다 (창이 열린 뒤의 자리·시각이 아니라)
    const at = Date.now();
    let picked = kind ?? (ctx.errors?.count ? 'error' : null);
    let sentId = null;

    let p;
    const shell = panelShell({ cls: 'pk-report', title: '문제 알리기', onClose: () => p.close(null), onOutside: () => p.close(null) });
    const seg = h('div', { class: 'pk-seg', role: 'group', 'aria-label': '무엇이 문제였나요' });
    const kindBtns = REPORT_KINDS.map(([k, label]) => h('button', {
      type: 'button', class: 'pk-seg-btn', 'aria-pressed': String(k === picked), dataset: { kind: k },
      onclick: () => { picked = k; kindBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === k))); refresh(); },
    }, label));
    seg.append(...kindBtns);
    const area = h('textarea', { class: 'pk-report-text', maxlength: String(REPORT_TEXT_MAX), rows: '4', 'aria-label': '무슨 일이 있었나요',
      placeholder: '무슨 일이 있었나요? 어디서 무엇을 하다가 그랬는지 적어 주면 고치기 쉬워요.' });
    area.value = text;
    const withInfo = h('input', { type: 'checkbox', checked: true, id: 'pk-report-info' });
    const preview = h('textarea', { class: 'pk-report-copy', readonly: true, rows: '6', 'aria-label': '보낼 내용 미리 보기' });
    const result = h('p', { class: 'pk-report-result', 'aria-live': 'polite' });
    const errCount = ctx.errors?.count ?? 0;

    const build = () => buildReport(ctx, { kind: picked ?? 'other', text: area.value, withInfo: withInfo.checked }, { now: at });
    const refresh = () => { preview.value = reportText(build(), sentId); sendBtn.disabled = !picked && !area.value.trim(); };
    const say = (msg, warn = false) => { result.textContent = msg; result.classList.toggle('is-warn', warn); };

    const sendBtn = button('보내기', { primary: true, onclick: async () => {
      if (sendBtn.disabled) return;
      sendBtn.disabled = true;
      say('보내는 중…');
      const doc = build();
      const r = await sendReport(doc).catch(e => ({ ok: false, reason: String(e?.message ?? e) }));
      if (r.ok) {
        sentId = r.id;
        say(`보냈어요! 고마워요. (번호 ${r.id})`);
        ui.toast?.('문제를 알려 줘서 고마워요', '📮');
        ctx.events?.emit('report:sent', { id: r.id, where: r.where, kind: doc.kind });
        sendBtn.textContent = '보냄';
        refresh();
        sendBtn.disabled = true;
      } else {
        details.open = true;
        const copied = await copyText(reportText(doc, null), preview);
        say(`${r.reason} ${copied ? '내용을 복사해 두었어요 — 만든 사람에게 붙여 넣어 보내 주세요.' : '아래 글을 복사해 만든 사람에게 보내 주세요.'}`, true);
        sendBtn.disabled = false;
      }
    } });
    const copyBtn = button('글 복사', { onclick: async () => {
      const ok = await copyText(reportText(build(), sentId), preview);
      details.open = true;
      say(ok ? '복사했어요. 채팅이나 메시지에 붙여 넣으면 돼요.' : '복사가 막힌 창이에요. 아래 글을 길게 눌러(또는 Ctrl+C) 복사해 주세요.', !ok);
    } });
    const details = h('details', null,
      h('summary', null, `보낼 내용 보기${errCount ? ` (최근 오류 ${errCount}개)` : ''}`),
      preview);

    shell.body.append(
      h('p', { class: 'pk-muted pk-small', text: '무엇이 문제였나요? 고르고 한 줄만 적어도 돼요.' }),
      seg, area,
      h('label', { class: 'pk-report-check', for: 'pk-report-info' }, withInfo, '최근 오류 · 기기 · 판 · 지금 자리도 같이 보내기'),
      details, result);
    shell.foot.append(h('div', { class: 'pk-btn-row' }, copyBtn, sendBtn));
    area.addEventListener('input', refresh);
    withInfo.addEventListener('change', refresh);
    refresh();

    p = ui.panel('report', shell.root, { initialFocus: () => (picked ? area : kindBtns[0]), onKey: textFieldKeys, onClose: () => { open = null; } });
    open = p;
    return p.result;
  }

  return { open: openReport };
}

/** 섬폰(src/ui/index.js EXTRA_PANELS, P3)이 부르는 모양: open(ctx, opts) → Promise. ctx 마다 창 하나 */
const byCtx = new WeakMap();
export function open(ctx, opts) {
  if (!byCtx.has(ctx)) byCtx.set(ctx, createReport(ctx));
  return byCtx.get(ctx).open(opts);
}
