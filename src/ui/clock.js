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

export function createClock(ctx) {
  let current = null;

  function open() {
    const ui = ctx.services.ui, time = ctx.services.time;
    if (!ui?.panel) return Promise.resolve(null);
    if (current) return current.result;
    injectCss('clock', CSS);
    let p;
    const n0 = time?.now?.() ?? { ms: Date.now(), dayKey: dayKeyOf(Date.now()) };
    const baseMs = Math.floor(n0.ms / MIN) * MIN;
    const baseDay = n0.dayKey;
    let delta = 0, dragging = null;   // 창을 연 시각에서 옮긴 분 · 끄는 중 { hand, last }

    const shell = panelShell({ cls: 'pk-tclock', title: '🕰 시계', onClose: () => p.close(null), onOutside: () => p.close(null) });
    const dayEl = h('div', { class: 'pk-tclock-day' });
    const timeEl = h('div', { class: 'pk-tclock-time', 'aria-hidden': 'true' });
    const partEl = h('div', { class: 'pk-tclock-part', 'aria-hidden': 'true' });
    const hints = h('ul', { class: 'pk-tclock-hints', 'aria-label': '이 시각에 할 수 있는 것' });
    const note = h('p', { class: 'pk-tclock-note', 'aria-live': 'polite' });

    // 시계 판 (SVG 200×200)
    const face = s('circle', { class: 'face', cx: 100, cy: 100, r: 94, 'stroke-width': 6 });
    const ticks = s('g');
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
      const r1 = big ? 78 : 83, r2 = 87;
      ticks.append(s('line', { x1: 100 + Math.sin(a) * r1, y1: 100 - Math.cos(a) * r1, x2: 100 + Math.sin(a) * r2, y2: 100 - Math.cos(a) * r2, 'stroke-width': big ? 3 : 1.2, 'stroke-linecap': 'round' }));
    }
    const nums = s('g');
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const t = s('text', { class: 'num', x: 100 + Math.sin(a) * 66, y: 100 - Math.cos(a) * 66 });
      t.textContent = String(i);
      nums.append(t);
    }
    const ampmText = s('text', { class: 'num', x: 100, y: 136, 'font-size': 13 });
    const hourHand = s('g', { class: 'h-hour', 'data-hand': 'hour' }, [s('line', { class: 'hit', x1: 100, y1: 100, x2: 100, y2: 50 }), s('line', { class: 'hand', x1: 100, y1: 108, x2: 100, y2: 52, 'stroke-width': 8 })]);
    const minHand = s('g', { class: 'h-minute', 'data-hand': 'minute' }, [s('line', { class: 'hit', x1: 100, y1: 100, x2: 100, y2: 22 }), s('line', { class: 'hand', x1: 100, y1: 112, x2: 100, y2: 24, 'stroke-width': 4.5 })]);
    const pin = s('circle', { cx: 100, cy: 100, r: 6 });
    const dial = s('svg', {
      class: 'pk-tclock-dial', viewBox: '0 0 200 200', role: 'slider', tabindex: '0', 'aria-label': '시계 바늘 (← → 15분, ↑ ↓ 1시간)',
      'aria-valuemin': '0', 'aria-valuemax': '1440', 'data-autofocus': '',
    }, [face, ticks, nums, ampmText, hourHand, minHand, pin]);

    const range = () => time?.range?.() ?? { floor: -Infinity, ceil: Infinity };
    const target = () => baseMs + delta * MIN;
    function setDelta(v, why) {
      const c = clampDelta(Math.round(v), baseMs, range());
      const hit = c !== Math.round(v);
      delta = c;
      draw();
      if (hit) say(why ?? (v < c ? '오늘 새벽 5시보다 앞으로는 돌릴 수 없어요 (지난 날은 다시 오지 않아요)' : '한 번에 7일 뒤까지만 돌릴 수 있어요'), true);
      else if (why !== '') say('');
    }
    const say = (msg, warn = false) => { note.textContent = msg; note.classList.toggle('is-warn', warn); };

    function draw() {
      const L = labelOf(target(), baseDay);
      const ang = handAngles(L.hour, L.minute);
      hourHand.setAttribute('transform', `rotate(${ang.hour} 100 100)`);
      minHand.setAttribute('transform', `rotate(${ang.minute} 100 100)`);
      const [bg, ink] = FACE[L.part];
      face.setAttribute('fill', bg); face.setAttribute('stroke', 'var(--pk-edge, #E2D2AE)');
      for (const el of [ticks, nums, pin]) { el.setAttribute('stroke', ink); el.setAttribute('fill', ink); }
      ampmText.setAttribute('fill', ink); ampmText.textContent = L.ampm;
      hourHand.querySelector('.hand').setAttribute('stroke', ink);
      minHand.querySelector('.hand').setAttribute('stroke', L.part === 'night' ? '#F2B36B' : '#C9772E');
      dayEl.textContent = `${L.dayLabel}${L.days !== 0 ? ` (${dayKeyOf(target()).slice(5).replace('-', '월 ')}일)` : ''}`;
      timeEl.replaceChildren(h('small', null, L.ampm), `${L.h12}:${L.mm}`);
      partEl.textContent = `${L.icon} ${L.partName}`;
      const shopOpen = ctx.services.data?.economy?.isOpen?.(L.hour) ?? (L.hour >= 8 && L.hour < 22);
      hints.replaceChildren(...activityHints(L.hour, { shopOpen }).map(t => h('li', null, t)));
      dial.setAttribute('aria-valuenow', String(L.hour * 60 + L.minute));
      dial.setAttribute('aria-valuetext', `${L.dayLabel} ${L.text}, ${L.partName}`);
      apply.disabled = delta === 0;
    }

    // ---- 끌기 ----
    const angleOf = e => {
      const r = dial.getBoundingClientRect();
      return pointAngle(e.clientX, e.clientY, r.left + r.width / 2, r.top + r.height / 2);
    };
    function pickHand(e) {
      const tagged = e.target.closest?.('[data-hand]')?.dataset.hand;
      if (tagged) return tagged;
      // 바늘 밖을 눌렀으면 각도가 가까운 바늘 (가운데 가까우면 시침 쪽으로 기운다)
      const r = dial.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
      const L = labelOf(target(), baseDay), ang = handAngles(L.hour, L.minute), a = angleOf(e);
      const dh = Math.abs(wrapDeg(a - ang.hour)) - (dist < 0.6 ? 25 : 0), dm = Math.abs(wrapDeg(a - ang.minute));
      return dh < dm ? 'hour' : 'minute';
    }
    dial.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      dial.focus({ preventScroll: true });
      const hand = pickHand(e);
      const L = labelOf(target(), baseDay), ang = handAngles(L.hour, L.minute);
      dragging = { hand, last: ang[hand], acc: delta, id: e.pointerId };
      dial.classList.add(`is-${hand}`);
      try { dial.setPointerCapture(e.pointerId); } catch { /* 일부 브라우저 */ }
      move(e);
    });
    function move(e) {
      if (!dragging || e.pointerId !== dragging.id) return;
      const a = angleOf(e);
      dragging.acc += dragMinutes(dragging.hand, dragging.last, a);
      dragging.last = a;
      const v = dragging.hand === 'hour' ? Math.round(dragging.acc / HOUR_SNAP) * HOUR_SNAP : dragging.acc;
      setDelta(v);
      // 끝에 닿았으면 쌓인 값도 그 끝으로 (되돌려 끌 때 바로 따라오게)
      if (Math.round(v) !== delta) dragging.acc = delta;
    }
    const end = e => {
      if (!dragging || e.pointerId !== dragging.id) return;
      dial.classList.remove(`is-${dragging.hand}`);
      dragging = null;
      ctx.events.emit('sfx', { name: 'menu' });
    };
    dial.addEventListener('pointermove', move);
    dial.addEventListener('pointerup', end);
    dial.addEventListener('pointercancel', end);
    dial.addEventListener('lostpointercapture', end);

    // ---- 단추 ----
    const apply = button('적용', { primary: true, onclick: () => doApply() });
    const reset = button('지금 시각으로 돌아가기', { onclick: () => doReset() });
    const offsetEl = h('p', { class: 'pk-tclock-help' });
    const showOffset = () => { offsetEl.textContent = offsetText(time?.offset ?? 0); reset.disabled = !time?.resetOffset || ((time?.offset ?? 0) === 0 && time?.mode !== 'fast'); };

    function doApply() {
      if (!time?.jumpTo || delta === 0) return;
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
    draw();
    showOffset();

    p = ui.panel('clock', shell.root, {
      initialFocus: () => dial,
      onKey(e) {
        if (e.target !== dial) return false;
        if (KEY_STEP[e.code]) { setDelta(delta + KEY_STEP[e.code]); return true; }
        if (e.code === 'Home') { setDelta(0); return true; }
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
