// 창(패널) 쌓기, 키보드 길잡이, 포커스 관리.
// 창이 하나라도 열려 있으면 ctx.input.enabled = false 로 게임 입력을 막고,
// 키 입력은 core/input.js 로 넘기지 않고 맨 위 창이 받는다 (방향키·Enter·Esc·Tab).
import { h, nextId, inkOn, iconEl } from './dom.js';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** 보이는 포커스 가능 요소들 (문서 순서) */
export const focusablesIn = root => [...root.querySelectorAll(FOCUSABLE)].filter(el => !el.closest('[hidden], [inert]') && el.getClientRects().length);

/** 격자 방향키 이동. 처리했으면 true */
export function gridMove(items, cols, code) {
  const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[code];
  if (d == null || !items.length) return false;
  const i = items.indexOf(document.activeElement);
  if (i < 0) { items[0].focus(); return true; }
  const j = i + d;
  if (j >= 0 && j < items.length) items[j].focus();
  return true;
}

export function createPanels(ctx, stackEl) {
  const stack = [];
  let inputWas = true;
  // 마지막 창을 닫은 그 입력(휴대폰 A·B 등)이 같은 순간 게임에도 전달되지 않도록,
  // 지금 처리 중인 입력이 끝날 때(마이크로태스크)까지는 막힌 상태를 유지한다.
  let holding = false;
  const GUARD_MS = 160;   // 창을 연 그 입력이 바로 창을 넘기지 않도록

  /**
   * 창 열기. root 는 stackEl 에 붙는다.
   * opts: initialFocus() → 요소, onKey(e, p) → 처리했으면 true, onAction(p) (A 버튼·포커스 밖 Enter),
   *       onCancel(p) (Esc·B 버튼; 없으면 닫기), toggleKey ('KeyI' 처럼 같은 키로 닫기), onClose()
   */
  function open(name, root, opts = {}) {
    const p = { name, root, opts, openedAt: performance.now(), closed: false, returnFocus: document.activeElement };
    p.result = new Promise(res => { p.resolve = res; });
    p.close = value => {
      if (p.closed) return;
      p.closed = true;
      stack.splice(stack.indexOf(p), 1);
      root.remove();
      opts.onClose?.();
      if (!stack.length) {
        holding = true;
        queueMicrotask(() => { holding = false; if (!stack.length) ctx.input.enabled = inputWas; });
      }
      ctx.events.emit('ui:close', { panel: name });
      const back = p.returnFocus;
      if (back?.isConnected && back !== document.body && (!stack.length || stack.at(-1).root.contains(back))) back.focus({ preventScroll: true });
      else if (stack.length) focusFirst(stack.at(-1));
      p.resolve(value === undefined ? null : value);
    };
    p.cancel = () => (opts.onCancel ? opts.onCancel(p) : p.close(null));
    p.fresh = () => performance.now() - p.openedAt < GUARD_MS;

    if (!stack.length && !holding) inputWas = ctx.input.enabled;
    ctx.input.enabled = false;
    stack.push(p);
    stackEl.append(root);
    ctx.events.emit('ui:open', { panel: name });
    focusFirst(p);
    return p;
  }

  function focusFirst(p) {
    const el = p.opts.initialFocus?.() ?? p.root.querySelector('[data-autofocus]') ?? focusablesIn(p.root)[0] ?? p.root.querySelector('[tabindex="-1"]');
    el?.focus({ preventScroll: true });
  }

  function cycle(p, dir) {
    const list = focusablesIn(p.root);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const j = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    list[j].focus();
  }

  function clickFocused(p) {
    const el = document.activeElement;
    if (el && p.root.contains(el) && el.matches('button, [role="button"], [role="tab"], [role="switch"]')) el.click();
    else focusFirst(p);
  }

  // 창이 열려 있을 때 키 입력은 여기서 먼저 받는다 (캡처 단계, core/input.js 보다 앞)
  addEventListener('keydown', e => {
    const p = stack.at(-1);
    if (!p) return;
    e.stopPropagation();
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (p.opts.onKey?.(e, p)) { e.preventDefault(); return; }
    const field = e.target.closest?.('input, textarea, select');
    // 글 칸(문제 알리기 등, 7차 P4): 방향키는 글자 사이를 옮기고, 창 여닫는 글자 키(P 등)는 글자로 들어가야 한다
    const typing = field && (field.tagName === 'TEXTAREA' || (field.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(field.type)));
    switch (e.code) {
      case 'Escape': e.preventDefault(); if (!e.repeat) p.cancel(); return;
      case 'Tab': e.preventDefault(); cycle(p, e.shiftKey ? -1 : 1); return;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
        if (typing) return;
        if (field?.type === 'range' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return;   // 슬라이더 값 바꾸기
        e.preventDefault();
        cycle(p, e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -1 : 1);
        return;
      case 'Enter': case 'NumpadEnter': case 'Space':
        if (e.repeat) { e.preventDefault(); return; }
        if (!p.root.contains(document.activeElement)) { e.preventDefault(); p.opts.onAction ? p.opts.onAction(p) : focusFirst(p); }
        return;   // 포커스된 버튼은 브라우저가 눌러 준다
      default:
        if (p.opts.toggleKey && e.code === p.opts.toggleKey && !e.repeat && !typing) { e.preventDefault(); p.cancel(); }
    }
  }, true);

  // 휴대폰 A(action)·B(pickup) 버튼: 창 안에서 고르기·뒤로
  ctx.events.on('input:press', ({ intent } = {}) => {
    const p = stack.at(-1);
    if (!p || p.fresh()) return;
    if (intent === 'action') p.opts.onAction ? p.opts.onAction(p) : clickFocused(p);
    else if (intent === 'pickup') p.cancel();
  });

  return {
    open,
    top: () => stack.at(-1) ?? null,
    find: name => stack.find(p => p.name === name) ?? null,
    blocking: () => stack.length > 0 || holding,
    isOpen: () => stack.length > 0,
    focusFirst,
  };
}

// ---------- 창 껍데기 ----------

/**
 * 가운데 뜨는 카드 창. 바깥(어두운 막)을 누르면 onOutside.
 * 돌려주는 것: { root, card, head, body, foot, titleId }
 */
export function panelShell({ cls = '', title, tagColor, onClose, onOutside, label }) {
  const titleId = nextId('pk-title');
  const head = h('header', { class: 'pk-card-head' },
    title && h('h2', { class: 'pk-card-title', id: titleId, style: tagColor ? { background: tagColor, color: inkOn(tagColor) } : null, text: title }),
    onClose && h('button', { type: 'button', class: 'pk-x', 'aria-label': '닫기', onclick: () => onClose() }, '✕'));
  const body = h('div', { class: 'pk-card-body' });
  const foot = h('footer', { class: 'pk-card-foot' });
  const card = h('section', { class: `pk-card ${cls}`, role: 'dialog', 'aria-modal': 'true', tabindex: '-1', ...(title ? { 'aria-labelledby': titleId } : { 'aria-label': label }) }, head, body, foot);
  const root = h('div', { class: 'pk-scrim' }, card);
  root.addEventListener('click', e => { if (e.target === root) onOutside?.(); });
  return { root, card, head, body, foot, titleId };
}

export function button(label, { cls = '', onclick, primary, disabled, ...rest } = {}) {
  return h('button', { type: 'button', class: `pk-btn${primary ? ' is-primary' : ''} ${cls}`, onclick, disabled, ...rest }, label);
}

/**
 * 확인 창 (브라우저 confirm() 대신).
 * buttons: [{ label, value, primary, disabled }] — 기본은 예/아니요. Esc·바깥 누르기 = cancelValue.
 * text 의 줄바꿈(
)은 그대로 줄이 바뀐다. icon 은 이모지 또는 그림 경로.
 */
export function confirmBox(panels, { title = '확인', text = '', icon, buttons, cancelValue = null } = {}) {
  buttons ??= [{ label: '예', value: true, primary: true }, { label: '아니요', value: false }];
  let p;
  const shell = panelShell({ cls: 'pk-confirm', title, onOutside: () => p.close(cancelValue) });
  if (icon) shell.body.append(h('div', { class: 'pk-confirm-icon', 'aria-hidden': 'true' }, iconEl(icon, 'pk-confirm-img')));
  shell.body.append(h('p', { class: 'pk-confirm-text', text }));
  const first = Math.max(0, buttons.findIndex(b => !b.disabled));
  const row = h('div', { class: 'pk-btn-row' }, buttons.map((b, i) => button(b.label, {
    primary: b.primary, disabled: !!b.disabled, onclick: () => p.close(b.value), ...(i === first ? { 'data-autofocus': '' } : {}),
  })));
  shell.foot.append(row);
  p = panels.open('confirm', shell.root, { onCancel: () => p.close(cancelValue) });
  return p.result;
}
