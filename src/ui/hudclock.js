// p41 원형 시계 HUD: 왼쪽 위 시계 칸에 늘 보이는 작은 아날로그 시계(시침·분침, 낮·밤 색) + 그 밑 시간 조정 칸.
// 판은 섬폰 「🕰 시계」 창과 같은 부품(src/ui/clock.js createDial, compact). 바늘을 끌어 놓으면 그 시각으로 바로 간다.
// 조정 칸: −1시간 · 빠르기(누를 때마다 실제와 같게 → 빠르게 → 아주 빠르게) · +1시간 · 🕰(섬폰 시계 창).
// 키보드: Tab 으로 시계에 와서 ←→ 15분 · ↑↓ 1시간 · PageUp/PageDown 3시간 (미리 보기) → Enter 적용 · Esc 취소 (둘 다 포커스를 놓아 게임 키로 돌아감).
// 휴대폰(좁은 화면)은 조정 칸이 접혀 있고 시계를 톡 누르면 펼친다 (다시 누르면 접힘).
import { h } from './dom.js';
import { injectCss } from './report.js';
import { createDial, labelOf } from './clock.js';

const HOUR = 3600e3;
const NARROW = '(max-width: 560px)';
const CSS = `
.pk-clock.has-dial { display: grid; grid-template-columns: auto auto; column-gap: 10px; align-items: center; pointer-events: auto; }
.pk-clock.has-dial > .pk-hclock-dial { grid-row: 1; grid-column: 1; }
.pk-clock.has-dial > .pk-clock-time, .pk-clock.has-dial > .pk-clock-row { grid-column: 2; }
.pk-clock.has-dial > .pk-clock-time { align-self: end; }
.pk-clock.has-dial > .pk-clock-row { align-self: start; }
.pk-hclock-dial { grid-row: 1 / span 2; width: 52px; height: 52px; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; border-radius: 50%; display: block; }
.pk-hclock-dial:active { cursor: grabbing; }
.pk-hclock-dial:focus-visible { outline: 3px solid var(--pk-focus); outline-offset: 2px; }
.pk-hclock-dial .face { transition: fill .6s; }
.pk-hclock-dial .hand { stroke-linecap: round; }
.pk-hclock-dial .hit { stroke: transparent; stroke-width: 40; stroke-linecap: round; }
.pk-hclock-dial.is-preview .h-minute .hand { stroke: #E0663A !important; }
.pk-hclock-strip { grid-column: 1 / span 2; display: flex; align-items: center; gap: 4px; margin-top: 6px; font: 13px var(--pk-display); }
.pk-hclock-strip[hidden] { display: none; }
.pk-hclock-strip button { min-width: 34px; min-height: 30px; padding: 2px 7px; border: 2px solid var(--pk-edge); border-radius: 999px; background: var(--pk-slot); color: var(--pk-ink); font: 13px var(--pk-display); }
.pk-hclock-strip button:focus-visible { outline: 3px solid var(--pk-focus); outline-offset: 1px; }
.pk-hclock-strip button:disabled { opacity: .45; cursor: default; }
.pk-hclock-speed { flex: 1; white-space: nowrap; }
.pk-hclock-speed[data-speed="real"] { background: var(--pk-cream); }
.pk-hclock-speed[data-speed="faster"] { background: #FBE2C4; }
.pk-hclock-peek { grid-column: 1 / span 2; margin-top: 2px; font-size: 12px; color: var(--pk-accent-deep); min-height: 0; }
.pk-hclock-peek:empty { display: none; }
.pk-hclock-strip .sm { display: none; }
@media ${NARROW} {
  .pk-hclock-dial { width: 44px; height: 44px; }
  .pk-hclock-strip { gap: 3px; }
  .pk-hclock-strip button { min-height: 36px; min-width: 36px; padding: 2px 6px; font-size: 13px; }
  .pk-hclock-strip .lg, .pk-hclock-more { display: none; }
  .pk-hclock-strip .sm { display: inline; }
}
`;
const SPEED_ICON = { real: '🕰', fast: '⏩', faster: '⏭' };

export function createHudClock(ctx, { toast = () => {}, blocking = () => false } = {}) {
  const S = () => ctx.services;
  const time = () => S().time;
  const nowOf = () => time()?.now?.() ?? { ms: Date.now(), dayKey: '2000-01-01' };
  const peek = h('div', { class: 'pk-hclock-peek', 'aria-live': 'polite' });
  const dw = createDial({
    cls: 'pk-hclock-dial', compact: true, label: '게임 시계 — 바늘을 끌어 놓으면 그 시각으로. ← → 15분, ↑ ↓ 1시간, Enter 적용, Esc 취소',
    getBase: () => nowOf(),
    getRange: () => time()?.range?.() ?? { floor: -Infinity, ceil: Infinity },
    onChange: (L, { hit, low }) => {
      dw.el.classList.toggle('is-preview', dw.delta !== 0);
      peek.textContent = dw.delta === 0 ? '' : `→ ${L.dayLabel} ${L.text} (${L.partName})${hit ? (low ? ' · 오늘 새벽 5시까지만' : ' · 7일 뒤까지만') : ''}`;
      extra();
    },
    onEnd: ({ moved }) => { if (moved) apply(); else toggle(); release(); },
  });
  // 마우스·손가락으로 누른 뒤에는 포커스를 놓는다 (남아 있으면 Space·방향키가 게임 대신 단추·시계로 간다). 키보드로 누른 것(detail 0)은 그대로
  const btn = (label, aria, onclick, cls = '') => h('button', { type: 'button', class: cls, 'aria-label': aria, title: aria, onclick: e => { e.stopPropagation(); onclick(); if (e.detail) e.currentTarget.blur(); } }, label);
  /** 시계에서 포커스 놓기 — 끌기를 마쳤거나, 키보드로 적용·취소했을 때 (게임 키가 다시 게임으로) */
  const release = () => { if (document.activeElement === dw.el) dw.el.blur(); };
  const two = (lg, sm) => [h('span', { class: 'lg' }, lg), h('span', { class: 'sm', 'aria-hidden': 'true' }, sm)];   // 좁은 화면은 짧은 글
  const minus = btn(two('−1시간', '−1'), '게임 시계 1시간 앞으로 되돌리기', () => step(-1));
  const plus = btn(two('+1시간', '+1'), '게임 시계 1시간 뒤로 보내기', () => step(1));
  const speed = btn('', '시간 빠르기 바꾸기', () => cycleSpeed(), 'pk-hclock-speed');
  const more = btn('🕰', '시계 창 열기 (자세히 돌리기)', () => S().ui?.clock?.open?.(), 'pk-hclock-more');
  const strip = h('div', { class: 'pk-hclock-strip', role: 'group', 'aria-label': '시간 조정' }, minus, speed, plus, more);
  const narrow = () => !!globalThis.matchMedia?.(NARROW).matches;
  let open = !narrow();

  function toggle(force) {
    open = force ?? !open;
    strip.hidden = !open;
    dw.el.setAttribute('aria-expanded', String(open));
    extra();
  }
  // 시계 칸 밑에 붙은 것(첫날 할 일 목록·축제 칸)이 펼친 조정 칸만큼 내려가게: CSS 변수 --pk-clock-extra
  function extra() {
    const px = (open ? strip.offsetHeight + 6 : 0) + (peek.textContent ? peek.offsetHeight + 2 : 0);
    try { document.documentElement.style.setProperty('--pk-clock-extra', `${px}px`); } catch { /* DOM 없음 */ }
  }
  const busy = () => blocking() || !!S().story?.playing;
  function apply() {
    const t = time();
    if (!t?.jumpTo || dw.delta === 0) { cancel(); return; }
    if (busy()) { cancel(); return; }
    const target = dw.target(), L = dw.label();
    const r = t.jumpTo(target);
    ctx.events.emit('sfx', { name: 'menu' });
    if (r?.ok) toast(`시계를 ${r.days > 0 ? `${L.dayLabel} ` : ''}${L.text}(${L.partName})에 맞췄어요`, L.icon);
    cancel();
  }
  function cancel() { dw.rebase(); dw.el.classList.remove('is-preview'); peek.textContent = ''; extra(); refresh(); }
  function step(dir) {
    const t = time();
    if (!t?.jumpTo || busy()) return;
    const n = nowOf();
    const r = t.jumpTo(n.ms + dir * HOUR);
    const L = labelOf(r?.now?.ms ?? n.ms, n.dayKey);
    ctx.events.emit('sfx', { name: 'menu' });
    if (r?.clamped === 'floor') toast('오늘 새벽 5시보다 앞으로는 못 돌려요 (지난 날은 다시 오지 않아요)', '🕰');
    else toast(`${dir > 0 ? '+1시간' : '−1시간'} → ${L.dayLabel === '오늘' ? '' : `${L.dayLabel} `}${L.text}`, L.icon);
    cancel();
  }
  function cycleSpeed() {
    const t = time();
    if (!t?.setSpeed) return;
    const list = t.speeds();
    const i = list.findIndex(x => x.key === t.speed);
    const next = list[(i + 1) % list.length];
    t.setSpeed(next.key);
    toast(`시간 빠르기: ${next.name}${next.mult > 1 ? ` (×${next.mult} · ${next.text})` : ''}`, SPEED_ICON[next.key]);
    refresh();
  }
  function refresh() {
    const t = time();
    const cur = t?.speeds?.().find(x => x.key === t.speed);
    speed.dataset.speed = cur?.key ?? 'real';
    speed.textContent = cur ? `${SPEED_ICON[cur.key]} ${cur.mult > 1 ? `×${cur.mult}` : '실제'}` : '—';
    speed.setAttribute('aria-label', cur ? `시간 빠르기 ${cur.name}${cur.mult > 1 ? ` (실제 1분에 게임 ${cur.mult}분)` : ''} — 눌러서 바꾸기` : '시간 빠르기');
    speed.disabled = !t?.setSpeed;
    const floor = t?.range?.().floor ?? -Infinity;
    minus.disabled = !t?.jumpTo || nowOf().ms - HOUR < floor - 60e3;
    plus.disabled = !t?.jumpTo;
  }

  // 키보드: 게임 이동 키로 새지 않게 여기서 멈춘다
  dw.el.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let done = dw.key(e.code);
    if (!done && (e.code === 'Enter' || e.code === 'NumpadEnter')) { if (!e.repeat) { apply(); release(); } done = true; }
    if (!done && e.code === 'Escape') { cancel(); release(); done = true; }
    if (done) { e.preventDefault(); e.stopPropagation(); }
  });
  dw.el.addEventListener('blur', () => { if (!dw.dragging && dw.delta !== 0) cancel(); });

  injectCss('hclock', CSS);
  toggle(open);
  refresh();
  // 처음 뜰 때는 화면 폭이 아직 0 일 수 있다 → 게임이 준비되면·폭이 넓고 좁음을 넘나들면 다시 정한다 (사용자가 접고 편 것은 그 사이에만)
  ctx.events.on('game:ready', () => toggle(!narrow()));
  try { globalThis.matchMedia?.(NARROW).addEventListener?.('change', e => toggle(!e.matches)); } catch { /* 옛 브라우저 */ }

  return {
    dial: dw, strip, peek,
    get open() { return open; },
    toggle, apply, step, cycleSpeed, refresh,
    /** HUD 시계 칸(.pk-clock)에 붙인다 */
    mount(bubble) {
      if (!bubble) return;
      bubble.classList.add('has-dial');
      bubble.prepend(dw.el);
      bubble.append(strip, peek);
      requestAnimationFrame?.(extra);
    },
    /** 게임 1분마다 (time:tick) · 시각이 옮겨졌을 때 — 미리 보는 중이 아니면 바늘을 지금 시각으로 */
    tick() { if (dw.delta === 0 && !dw.dragging) dw.rebase(); refresh(); },
  };
}
