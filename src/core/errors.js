// 오류 모으기 (M7-P4 UI-08): 페이지에서 난 오류를 최근 것부터 조금만 기억해 두고, 문제 알리기 창(src/ui/report.js)이 보고에 담는다.
// 모으는 것: window 'error' (스크립트 오류, 그림·스크립트 파일 못 받음), 'unhandledrejection', console.error
// (main.js 의 '[boot] … 초기화 실패' · '[loop] …' 같은 모듈 실패가 여기로 온다).
// 게임에는 영향이 없다: 모으는 일 자체가 실패해도 조용히 넘어가고, console.error 는 원래대로 찍힌다.
// main.js 가 처음에 installErrors() 를 불러 ctx.errors 에 둔다. 모양은 docs/notes/p11-save.md.

export const MAX_ERRORS = 30;      // 기억하는 개수 (같은 오류는 한 줄에 count 만 올린다)
const MAX_TEXT = 500;              // 글 하나 길이
const MAX_STACK = 1200;

/** 무엇이든 → 짧은 글 */
export function errorText(v) {
  try {
    if (v == null) return String(v);
    if (typeof v === 'string') return v;
    if (v instanceof Error) return `${v.name && v.name !== 'Error' ? `${v.name}: ` : ''}${v.message}`;
    if (typeof v === 'object' && typeof v.message === 'string') return v.message;
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}

const cut = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** 스택에서 페이지 주소 앞부분을 떼어 짧게 (src/… 만 남는다) */
const decode = s => { try { return decodeURI(s); } catch { return s; } };
const shortStack = (stack, origin) => cut(String(stack ?? '').split(origin ?? '\u0000').join('').trim(), MAX_STACK) || null;

/**
 * 오류 기록장. kind: 'error' | 'rejection' | 'console' | 'module' | 'resource' | 'report' (그 밖도 된다)
 * 항목 { kind, message, source?, stack?, at, count, last }
 */
export function createErrorLog({ max = MAX_ERRORS, now = () => Date.now(), origin = globalThis.location?.origin } = {}) {
  const list = [];
  const subs = new Set();
  let total = 0;

  function add(kind, value, extra = {}) {
    try {
      const message = cut(extra.message ?? errorText(value), MAX_TEXT);
      const source = extra.source ? cut(decode(String(extra.source).split(origin ?? '\u0000').join('')), 200) : null;
      const at = now();
      total++;
      const same = list.find(e => e.kind === kind && e.message === message && e.source === source);
      if (same) {
        same.count++;
        same.last = at;
        // 맨 뒤로 (최근 것)
        list.splice(list.indexOf(same), 1);
        list.push(same);
      } else {
        list.push({ kind, message, source, stack: shortStack(extra.stack ?? value?.stack, origin), at, count: 1, last: at });
        if (list.length > max) list.splice(0, list.length - max);
      }
      for (const fn of subs) { try { fn(list.at(-1)); } catch { /* 듣는 쪽 오류는 무시 */ } }
    } catch { /* 모으기 실패는 무시 */ }
  }

  return {
    add,
    /** 최근 n 개 (오래된 것 → 새 것), 사본 */
    recent: (n = max) => list.slice(-n).map(e => ({ ...e })),
    clear() { list.length = 0; },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    get count() { return list.length; },
    get total() { return total; },
  };
}

/** console.error 인자 → 기록할 종류·글. main.js 의 '[boot] x 초기화 실패' 는 모듈 실패 */
export function classifyConsole(args) {
  const text = args.map(a => (a instanceof Error ? errorText(a) : typeof a === 'string' ? a : errorText(a))).join(' ');
  const kind = /^\[boot\]/.test(text) ? 'module' : 'console';
  const err = args.find(a => a instanceof Error);
  return { kind, message: text, stack: err?.stack };
}

let installed = null;

/**
 * 페이지에 걸기 (한 번만; 다시 부르면 같은 기록장). target = window, con = console (테스트에서 가짜를 넣는다).
 * 돌려주는 것: 기록장 + uninstall()
 */
export function installErrors({ target = globalThis, con = globalThis.console, log } = {}) {
  if (installed && !log) return installed;
  const errors = log ?? createErrorLog({ origin: target.location?.origin });
  const offs = [];
  const listen = (type, fn, capture) => {
    target.addEventListener?.(type, fn, capture);
    offs.push(() => target.removeEventListener?.(type, fn, capture));
  };

  // 스크립트 오류는 window 에서, 파일 못 받음(img·script·link)은 캡처 단계에서만 보인다
  listen('error', e => {
    const el = e?.target;
    if (el && el !== target && el.tagName) {
      errors.add('resource', null, { message: `파일을 못 받음: <${el.tagName.toLowerCase()}>`, source: el.currentSrc || el.src || el.href || '' });
      return;
    }
    const where = e?.filename ? `${e.filename}:${e.lineno ?? 0}:${e.colno ?? 0}` : null;
    errors.add('error', e?.error ?? e?.message, { message: e?.message || undefined, source: where, stack: e?.error?.stack });
  }, true);
  listen('unhandledrejection', e => errors.add('rejection', e?.reason));

  if (con?.error) {
    const original = con.error;
    const wrapped = function (...args) {
      try { const c = classifyConsole(args); errors.add(c.kind, null, { message: c.message, stack: c.stack }); } catch { /* 무시 */ }
      return original.apply(this, args);
    };
    con.error = wrapped;
    offs.push(() => { if (con.error === wrapped) con.error = original; });
  }

  const handle = Object.assign(errors, {
    uninstall() {
      offs.splice(0).forEach(off => off());
      if (installed === handle) installed = null;
    },
  });
  if (!log) installed = handle;
  return handle;
}
