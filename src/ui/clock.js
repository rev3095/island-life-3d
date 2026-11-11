// 11차 시계 (p33-clock): 섬폰 「🕰 시계」 — 아날로그 시계 바늘을 끌어 게임 시각을 바꾼다.
// 시침·분침을 마우스·손가락으로 돌린다 (돌린 만큼 이어서 센다: 시침이 12를 넘으면 오전·오후가, 한 바퀴 더 돌면 날이 바뀐다).
// 날은 새벽 5시에 바뀐다 (sky/clock.js). 가 본 가장 늦은 날의 5시보다 앞으로는 못 돌린다 (하루 일을 두 번 받지 않게).
// 키보드: 시계에서 ←→ 15분 · ↑↓ 1시간 · PageUp/PageDown 3시간 · Home 지금 창을 연 시각 · Enter 적용.
// 「적용」 = time.jumpTo(ms) · 「지금 시각으로 돌아가기」 = time.resetOffset() (offset 0). 바꾼 정도는 state.time.offset 로 저장된다.
// 아래 순수 함수들은 DOM 없이 돈다 (tests/clock.test.mjs).
import { h } from './dom.js';
import { panelShell, button } from './panels.js';
import { injectCss } from './report.js';
import { dayKeyOf, dayDiff, partOf } from '../sky/clock.js';

const MIN = 60e3;
export const KEY_STEP = { ArrowLeft: -15, ArrowRight: 15, ArrowDown: -60, ArrowUp: 60, PageDown: -180, PageUp: 180 };
export const HOUR_SNAP = 5;           // 시침을 끌면 5분 단위로
const PART_NAME = { dawn: '새벽', day: '낮', dusk: '저녁', night: '밤' };
const PART_ICON = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };
const DAY_PARTS = [{ id: 'dawn', from: 5, to: 8 }, { id: 'day', from: 8, to: 17 }, { id: 'dusk', from: 17, to: 19 }, { id: 'night', from: 19, to: 29 }];

/** 각도를 (-180, 180] 로 */
export const wrapDeg = d => { d = ((d % 360) + 360) % 360; return d > 180 ? d - 360 : d; };
/** 시·분 → 바늘 각도 (12시 = 0°, 시계 방향) */
export function handAngles(hour, minute) {
  return { hour: (((hour % 12) + minute / 60) / 12) * 360, minute: (minute / 60) * 360 };
}
/** 화면 점 → 시계 각도 (가운데 cx,cy · 12시 = 0°) */
export const pointAngle = (x, y, cx, cy) => ((Math.atan2(x - cx, cy - y) * 180) / Math.PI + 360) % 360;
/**
 * 바늘을 fromDeg 에서 toDeg 로 끌었다 → 옮길 분 (짧은 쪽으로 돈다고 본다).
 * 시침 한 바퀴 = 12시간, 분침 한 바퀴 = 1시간.
 */
export function dragMinutes(hand, fromDeg, toDeg) {
  const d = wrapDeg(toDeg - fromDeg);
  return hand === 'hour' ? (d / 360) * 720 : (d / 360) * 60;
}
/** 고른 분(delta)을 돌릴 수 있는 범위로 */
export function clampDelta(delta, baseMs, { floor = -Infinity, ceil = Infinity } = {}) {
  const lo = Math.ceil((floor - baseMs) / MIN), hi = Math.floor((ceil - baseMs) / MIN);
  return Math.min(hi, Math.max(lo, delta));
}
/** 갈 시각(ms) → 화면 글 { ampm, h12, mm, text, dayLabel, days, part, partName, icon, hour, minute } */
export function labelOf(ms, baseDayKey) {
  const d = new Date(ms);
  const hour = d.getHours(), minute = d.getMinutes();
  const days = dayDiff(baseDayKey, dayKeyOf(ms));
  const part = partOf(hour + minute / 60, DAY_PARTS);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  const dayLabel = days === 0 ? '오늘' : days === 1 ? '내일' : days === 2 ? '모레' : days > 0 ? `${days}일 뒤` : `${-days}일 전`;
  const ampm = hour < 12 ? '오전' : '오후';
  return { ampm, h12, mm, hour, minute, days, dayLabel, part, partName: PART_NAME[part], icon: PART_ICON[part], text: `${ampm} ${h12}:${mm}` };
}
/** 실제 시각과 차이 → '실제 시각보다 3시간 20분 빠름' 같은 글 */
export function offsetText(offsetMs) {
  const m = Math.round(offsetMs / MIN);
  if (Math.abs(m) < 1) return '실제 시각 그대로예요';
  const a = Math.abs(m), d = Math.floor(a / 1440), hh = Math.floor((a % 1440) / 60), mm = a % 60;
  const parts = [d && `${d}일`, hh && `${hh}시간`, mm && `${mm}분`].filter(Boolean).join(' ');
  return `실제 시각보다 ${parts} ${m > 0 ? '빨라요' : '느려요'}`;
}
/** 그 시각에 할 수 있는 것 (짧은 안내) */
export function activityHints(hour, { shopOpen } = {}) {
  const hh = hour < 5 ? hour + 24 : hour;
  const out = [];
  out.push(shopOpen ? '🛒 상점 열림' : '🛒 상점 닫힘');
  if (hh >= 19) out.push('🔭 별 보기', '🦗 밤 곤충');
  else if (hh >= 17) out.push('🔥 저녁 모임');
  else if (hh < 8) out.push('🌅 아침 산책');
  else out.push('🦋 낮 곤충', '🏡 주민 나들이');
  return out;
}

const CSS = `
.pk-tclock { width: min(380px, 100%); }
.pk-tclock .pk-card-body { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 10px; }
.pk-tclock-read { text-align: center; line-height: 1.25; }
.pk-tclock-day { font: 14px var(--pk-display); color: var(--pk-ink-soft); }
.pk-tclock-time { font: 30px var(--pk-display); color: var(--pk-ink); letter-spacing: .5px; }
.pk-tclock-time small { font-size: 18px; margin-right: 6px; }
.pk-tclock-part { font: 15px var(--pk-display); }
.pk-tclock-dial { width: min(260px, 70vw, 42vh); height: auto; aspect-ratio: 1; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; border-radius: 50%; }
.pk-tclock-dial:active { cursor: grabbing; }
.pk-tclock-dial:focus-visible { outline: 4px solid var(--pk-focus); outline-offset: 4px; }
.pk-tclock-dial .face { transition: fill .4s; }
.pk-tclock-dial .num { font: 15px var(--pk-display); text-anchor: middle; dominant-baseline: central; }
.pk-tclock-dial .hand { stroke-linecap: round; }
.pk-tclock-dial .hit { stroke: transparent; stroke-width: 26; stroke-linecap: round; }
.pk-tclock-dial.is-hour .h-hour, .pk-tclock-dial.is-minute .h-minute { filter: drop-shadow(0 0 3px #fff8); }
.pk-tclock-hints { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 8px; margin: 0; padding: 0; list-style: none; font-size: 13px; color: var(--pk-ink-soft); }
.pk-tclock-hints li { background: var(--pk-slot); border: 2px solid var(--pk-edge); border-radius: 999px; padding: 1px 8px; }
.pk-tclock-note { margin: 0; font-size: 13px; color: var(--pk-ink-soft); text-align: center; word-break: keep-all; min-height: 1.3em; }
.pk-tclock-note.is-warn { color: #B4532A; }
.pk-tclock .pk-card-foot { flex-direction: column; align-items: center; gap: 6px; }
.pk-tclock .pk-btn-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.pk-tclock-help { margin: 0; font-size: 12px; color: var(--pk-ink-soft); text-align: center; }
`;
const FACE = { dawn: ['#FDE3C8', '#7A5A44'], day: ['#FFF8E6', '#4A3B32'], dusk: ['#F7C9A4', '#5A3A2E'], night: ['#2E3A66', '#F3E9C8'] };

const SVGNS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, kids = []) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) el.append(k);
  return el;
};

/**
 * 시계 판 부품 (섬폰 「🕰 시계」 창과 HUD 원형 시계가 같이 쓴다 — p41).
 * getBase() → { ms, dayKey } 끌기·키보드의 기준 시각 (창 = 연 시각, HUD = 지금), getRange() → { floor, ceil }.
 * onChange(L, { hit, low }) = 바늘이 바뀔 때 (hit = 범위 끝에 닿음, low = 앞쪽 끝), onEnd() = 끌기를 놓았을 때.
 * compact = HUD 용 작은 판 (숫자·잔 눈금·오전/오후 글 없음, 굵은 바늘).
 */
export function createDial({ cls = 'pk-tclock-dial', compact = false, label = '시계 바늘 (← → 15분, ↑ ↓ 1시간)', getBase, getRange = () => ({ floor: -Infinity, ceil: Infinity }), onChange = () => {}, onEnd = () => {} } = {}) {
  let base = getBase(), delta = 0, dragging = null;
  const baseMs = () => Math.floor(base.ms / MIN) * MIN;
  const face = s('circle', { class: 'face', cx: 100, cy: 100, r: 94, 'stroke-width': compact ? 10 : 6 });
  const ticks = s('g');
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    if (compact && !(i % 15 === 0)) continue;
    const a = (i / 60) * Math.PI * 2, r1 = compact ? 72 : big ? 78 : 83, r2 = compact ? 86 : 87;
    ticks.append(s('line', { x1: 100 + Math.sin(a) * r1, y1: 100 - Math.cos(a) * r1, x2: 100 + Math.sin(a) * r2, y2: 100 - Math.cos(a) * r2, 'stroke-width': compact ? 9 : big ? 3 : 1.2, 'stroke-linecap': 'round' }));
  }
  const nums = s('g');
  if (!compact) for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const t = s('text', { class: 'num', x: 100 + Math.sin(a) * 66, y: 100 - Math.cos(a) * 66 });
    t.textContent = String(i);
    nums.append(t);
  }
  const ampmText = s('text', { class: 'num', x: 100, y: 136, 'font-size': 13 });
  // P46 FB-04: 바늘이 다음 날로 넘어가면 판 위쪽에 「내일」(모레·n일 뒤) — 끄는 동안 날짜가 바뀌는 걸 바로 보이게
  const dayText = s('text', { class: 'num pk-dial-day', x: 100, y: compact ? 76 : 70, 'font-size': compact ? 26 : 15, 'font-weight': 700 });
  const hourHand = s('g', { class: 'h-hour', 'data-hand': 'hour' }, [s('line', { class: 'hit', x1: 100, y1: 100, x2: 100, y2: 50 }), s('line', { class: 'hand', x1: 100, y1: 108, x2: 100, y2: compact ? 48 : 52, 'stroke-width': compact ? 16 : 8 })]);
  const minHand = s('g', { class: 'h-minute', 'data-hand': 'minute' }, [s('line', { class: 'hit', x1: 100, y1: 100, x2: 100, y2: 22 }), s('line', { class: 'hand', x1: 100, y1: 112, x2: 100, y2: compact ? 20 : 24, 'stroke-width': compact ? 10 : 4.5 })]);
  const pin = s('circle', { cx: 100, cy: 100, r: compact ? 11 : 6 });
  const svg = s('svg', {
    class: cls, viewBox: '0 0 200 200', role: 'slider', tabindex: '0', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '1439',
  }, compact ? [face, ticks, dayText, hourHand, minHand, pin] : [face, ticks, nums, ampmText, dayText, hourHand, minHand, pin]);

  const target = () => baseMs() + delta * MIN;
  const L = () => labelOf(target(), base.dayKey);
  function draw() {
    const l = L(), ang = handAngles(l.hour, l.minute);
    hourHand.setAttribute('transform', `rotate(${ang.hour} 100 100)`);
    minHand.setAttribute('transform', `rotate(${ang.minute} 100 100)`);
    const [bg, ink] = FACE[l.part];
    face.setAttribute('fill', bg); face.setAttribute('stroke', 'var(--pk-edge, #E2D2AE)');
    for (const el of [ticks, nums, pin]) { el.setAttribute('stroke', ink); el.setAttribute('fill', ink); }
    ampmText.setAttribute('fill', ink); ampmText.textContent = l.ampm;
    dayText.setAttribute('fill', l.part === 'night' ? '#F2B36B' : '#C9772E'); dayText.textContent = l.days ? l.dayLabel : '';
    hourHand.querySelector('.hand').setAttribute('stroke', ink);
    minHand.querySelector('.hand').setAttribute('stroke', l.part === 'night' ? '#F2B36B' : '#C9772E');
    svg.dataset.part = l.part;
    svg.setAttribute('aria-valuenow', String(l.hour * 60 + l.minute));
    svg.setAttribute('aria-valuetext', `${l.dayLabel} ${l.text}, ${l.partName}`);
    return l;
  }
  function setDelta(v) {
    const want = Math.round(v), c = clampDelta(want, baseMs(), getRange());
    delta = c;
    const l = draw();
    onChange(l, { hit: c !== want, low: want < c });
    return c !== want;
  }

  // ---- 끌기 ----
  const angleOf = e => {
    const r = svg.getBoundingClientRect();
    return pointAngle(e.clientX, e.clientY, r.left + r.width / 2, r.top + r.height / 2);
  };
  function pickHand(e) {
    const tagged = e.target.closest?.('[data-hand]')?.dataset.hand;
    if (tagged) return tagged;
    // 바늘 밖을 눌렀으면 각도가 가까운 바늘 (가운데 가까우면 시침 쪽으로 기운다)
    const r = svg.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
    const l = L(), ang = handAngles(l.hour, l.minute), a = angleOf(e);
    const dh = Math.abs(wrapDeg(a - ang.hour)) - (dist < 0.6 ? 25 : 0), dm = Math.abs(wrapDeg(a - ang.minute));
    return dh < dm ? 'hour' : 'minute';
  }
  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();   // HUD: 땅 누르기(걷기)로 새지 않게
    svg.focus({ preventScroll: true });
    const hand = pickHand(e);
    const l = L(), ang = handAngles(l.hour, l.minute);
    dragging = { hand, last: ang[hand], acc: delta, id: e.pointerId, moved: false };
    svg.classList.add(`is-${hand}`);
    try { svg.setPointerCapture(e.pointerId); } catch { /* 일부 브라우저 */ }
  });
  function move(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    const a = angleOf(e);
    const d = dragMinutes(dragging.hand, dragging.last, a);
    if (Math.abs(d) > 0.01) dragging.moved = true;
    dragging.acc += d;
    dragging.last = a;
    const v = dragging.hand === 'hour' ? Math.round(dragging.acc / HOUR_SNAP) * HOUR_SNAP : dragging.acc;
    setDelta(v);
    // 끝에 닿았으면 쌓인 값도 그 끝으로 (되돌려 끌 때 바로 따라오게)
    if (Math.round(v) !== delta) dragging.acc = delta;
  }
  const end = e => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const moved = dragging.moved;
    svg.classList.remove(`is-${dragging.hand}`);
    dragging = null;
    onEnd({ moved });
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('lostpointercapture', end);
  draw();

  return {
    el: svg,
    get delta() { return delta; },
    get dragging() { return !!dragging; },
    target, label: L, draw,
    /** delta 를 정한다 (범위 끝에 붙음) → 끝에 닿았으면 true */
    setDelta,
    /** 키 하나 (KEY_STEP · Home) → 처리했으면 true */
    key(code) {
      if (KEY_STEP[code]) { setDelta(delta + KEY_STEP[code]); return true; }
      if (code === 'Home') { setDelta(0); return true; }
      return false;
    },
    /** 기준 시각을 다시 (HUD: 지금 시각으로) — 끄는 중이면 그대로 */
    rebase() { if (dragging) return; base = getBase(); delta = 0; draw(); },
  };
}

export function createClock(ctx) {
  let current = null;

  function open() {
    const ui = ctx.services.ui, time = ctx.services.time;
    if (!ui?.panel) return Promise.resolve(null);
    if (current) return current.result;
    injectCss('clock', CSS);
    let p;
    const n0 = time?.now?.() ?? { ms: Date.now(), dayKey: dayKeyOf(Date.now()) };
    const baseDay = n0.dayKey;

    const shell = panelShell({ cls: 'pk-tclock', title: '🕰 시계', onClose: () => p.close(null), onOutside: () => p.close(null) });
    const dayEl = h('div', { class: 'pk-tclock-day' });
    const timeEl = h('div', { class: 'pk-tclock-time', 'aria-hidden': 'true' });
    const partEl = h('div', { class: 'pk-tclock-part', 'aria-hidden': 'true' });
    const hints = h('ul', { class: 'pk-tclock-hints', 'aria-label': '이 시각에 할 수 있는 것' });
    const note = h('p', { class: 'pk-tclock-note', 'aria-live': 'polite' });

    const say = (msg, warn = false) => { note.textContent = msg; note.classList.toggle('is-warn', warn); };
    // 시계 판 (createDial — HUD 원형 시계와 같은 부품)
    const dw = createDial({
      getBase: () => n0,
      getRange: () => time?.range?.() ?? { floor: -Infinity, ceil: Infinity },
      onChange: (L, { hit, low }) => {
        drawExtra(L);
        if (hit) say(low ? '오늘 새벽 5시보다 앞으로는 돌릴 수 없어요 (지난 날은 다시 오지 않아요)' : '한 번에 7일 뒤까지만 돌릴 수 있어요', true);
        else say('');
      },
      onEnd: () => ctx.events.emit('sfx', { name: 'menu' }),
    });
    const dial = dw.el;
    dial.setAttribute('data-autofocus', '');
    const target = () => dw.target();
    function drawExtra(L) {
      dayEl.textContent = `${L.dayLabel}${L.days !== 0 ? ` (${dayKeyOf(target()).slice(5).replace('-', '월 ')}일)` : ''}`;
      timeEl.replaceChildren(h('small', null, L.ampm), `${L.h12}:${L.mm}`);
      partEl.textContent = `${L.icon} ${L.partName}`;
      const shopOpen = ctx.services.data?.economy?.isOpen?.(L.hour) ?? (L.hour >= 8 && L.hour < 22);
      hints.replaceChildren(...activityHints(L.hour, { shopOpen }).map(t => h('li', null, t)));
      apply.disabled = dw.delta === 0;
    }

    // ---- 단추 ----
    const apply = button('적용', { primary: true, onclick: () => doApply() });
    const reset = button('지금 시각으로 돌아가기', { onclick: () => doReset() });
    const offsetEl = h('p', { class: 'pk-tclock-help' });
    const showOffset = () => { offsetEl.textContent = offsetText(time?.offset ?? 0); reset.disabled = !time?.resetOffset || Math.abs(time?.offset ?? 0) < MIN; };

    function doApply() {
      if (!time?.jumpTo || dw.delta === 0) return;
      const L = labelOf(target(), baseDay);
      const r = time.jumpTo(target());
      ctx.events.emit('sfx', { name: 'menu' });
      ui.toast?.(`시계를 ${r.days > 0 ? `${L.dayLabel} ` : ''}${L.text}(${L.partName})에 맞췄어요`, L.icon);
      p.close(r);
    }
    function doReset() {
      if (!time?.resetOffset) return;
      const r = time.resetOffset();
      const L = labelOf(r.now?.ms ?? Date.now(), r.now?.dayKey ?? baseDay);
      ui.toast?.(r.caught > 0 ? `지난 날로는 못 가서, 오늘 같은 시각 ${L.text}에 맞췄어요` : `실제 시각 ${L.text}에 맞췄어요`, '🕰');
      p.close(r);
    }

    shell.body.append(h('div', { class: 'pk-tclock-read' }, dayEl, timeEl, partEl), dial, hints, note);
    shell.foot.append(h('div', { class: 'pk-btn-row' }, apply, reset), offsetEl,
      h('p', { class: 'pk-tclock-help' }, '바늘을 끌어 돌려요 · 새벽 5시에 날이 바뀌어요'));
    if (!time?.jumpTo) say('시간(sky) 모듈이 없어 돌릴 수 없어요', true);
    drawExtra(dw.label());
    showOffset();

    p = ui.panel('clock', shell.root, {
      initialFocus: () => dial,
      onKey(e) {
        if (e.target !== dial) return false;
        if (dw.key(e.code)) return true;
        if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) { doApply(); return true; }
        return false;
      },
      onAction: () => (document.activeElement === dial ? doApply() : document.activeElement?.click?.()),
      onClose: () => { current = null; },
    });
    current = p;
    ctx.events.emit('sfx', { name: 'menu' });
    return p.result;
  }

  return {
    open,
    /** 점검·봇용: 창이 열려 있으면 그 상태 */
    get isOpen() { return !!current; },
  };
}

/** 섬폰(src/ui/index.js EXTRA_PANELS)이 부르는 모양: open(ctx, opts) → Promise. ctx 마다 창 하나 */
const byCtx = new WeakMap();
export function open(ctx, opts) {
  if (!byCtx.has(ctx)) byCtx.set(ctx, createClock(ctx));
  return byCtx.get(ctx).open(opts);
}
