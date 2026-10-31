// 키보드·터치를 '의도'로 바꾼다. 다른 모듈은 키 이름이 아니라 의도(action, pickup ...)만 본다.
//   이동: WASD / 방향키 (+ Shift 달리기), 휴대폰은 왼쪽 아래 떠다니는 패드 (끝까지 밀면 달리기)
//   action  Space/Enter (말 걸기·도구 쓰기)   pickup F (줍기)      휴대폰: A · B
//   toolPrev Q   toolNext E   tool1~5 숫자키   bag I/Tab   phone P/Esc   map M
// 화면 위쪽 = 월드 -Z (카메라가 남쪽에서 북쪽을 본다).
// 터치 조작은 (pointer: coarse) 기기에서 처음부터, 그 밖의 기기는 화면을 처음 손가락으로 만질 때 생긴다 (이벤트 input:touch).
// 주소에 ?touch=1 이면 늘 켜고, ?touch=0 이면 끈다.
const KEYS = {
  Space: 'action', Enter: 'action', KeyF: 'pickup', KeyQ: 'toolPrev', KeyE: 'toolNext',
  KeyI: 'bag', Tab: 'bag', KeyP: 'phone', Escape: 'phone', KeyM: 'map',
  Digit1: 'tool1', Digit2: 'tool2', Digit3: 'tool3', Digit4: 'tool4', Digit5: 'tool5', Digit0: 'toolNone',
};
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

const STICK_R = 50;     // 손잡이가 움직이는 반지름(px)
const DEAD = 0.14;      // 이보다 덜 밀면 서 있다
const RUN_AT = 0.92;    // 이만큼 밀면 달린다

export function createInput(events, { touchRoot = document.body } = {}) {
  const held = new Set();
  const stick = { x: 0, z: 0, active: false };
  let enabled = true, pad = null;
  const btnLabels = { action: '', pickup: '' };
  const api = {
    move: { x: 0, z: 0 },      // 길이 0~1
    run: false,
    /** UI 창이 열리면 ui 모듈이 false 로 바꾼다 (터치 패드는 숨기고 A·B 만 남긴다) */
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; pad?.setEnabled(enabled); },
    touch: false,
    update() {
      let x = 0, z = 0;
      for (const code of held) { const m = MOVE[code]; if (m) { x += m[0]; z += m[1]; } }
      if (stick.active) { x = stick.x; z = stick.z; }
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      api.move.x = enabled ? x : 0;
      api.move.z = enabled ? z : 0;
      api.run = enabled && (held.has('ShiftLeft') || held.has('ShiftRight') || (stick.active && Math.hypot(stick.x, stick.z) >= RUN_AT));
    },
    press(intent) { events.emit('input:press', { intent }); },
    /** 터치 조작 켜기 (이미 있으면 그대로) */
    enableTouch() { if (!pad) pad = buildTouch(); },
    /**
     * A·B 버튼 아래 작은 글자. labels = { action, pickup } (문자열, 빈 값이면 기본 '행동'·'줍기').
     * 바뀐 것만 고친다 → 0.2초마다 불러도 된다. 터치 조작이 아직 없으면 기억만 해 둔다
     */
    setLabels(labels = {}) { Object.assign(btnLabels, labels); pad?.setLabels(btnLabels); },
  };

  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    held.add(e.code);
    const intent = KEYS[e.code];
    if (intent && !e.repeat) { e.preventDefault(); api.press(intent); }
    else if (MOVE[e.code] || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => held.delete(e.code));
  addEventListener('blur', () => { held.clear(); pad?.release(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); pad?.release(); } });

  const force = new URLSearchParams(location.search).get('touch');
  if (force === '1' || (force !== '0' && matchMedia('(pointer: coarse)').matches)) api.enableTouch();
  else if (force !== '0') {
    // 터치 화면 노트북·태블릿: 처음 손가락으로 만질 때 패드를 만든다
    const first = e => {
      if (e.pointerType !== 'touch') return;
      removeEventListener('pointerdown', first, true);
      api.enableTouch();
    };
    addEventListener('pointerdown', first, true);
  }

  function buildTouch() {
    injectStyle();
    api.touch = true;
    const wrap = document.createElement('div');
    wrap.id = 'touch-controls';
    wrap.innerHTML = `<div class="tc-zone" aria-hidden="true"><div class="tc-stick"><div class="tc-knob"></div></div></div>
      <button type="button" class="tc-btn tc-b" data-intent="pickup" tabindex="-1" aria-label="B 버튼: 줍기·뒤로"><b>B</b><small>줍기</small></button>
      <button type="button" class="tc-btn tc-a" data-intent="action" tabindex="-1" aria-label="A 버튼: 행동·고르기"><b>A</b><small>행동</small></button>`;
    touchRoot.append(wrap);
    wrap.addEventListener('contextmenu', e => e.preventDefault());
    const zone = wrap.querySelector('.tc-zone'), base = wrap.querySelector('.tc-stick'), knob = wrap.querySelector('.tc-knob');

    // ---------- 패드: 왼쪽 아래 넓은 곳 어디를 눌러도 그 자리에 생긴다 ----------
    let id = null, cx = 0, cy = 0, rest = null;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const capture = (el, pid) => { try { el.setPointerCapture(pid); } catch { /* 이미 끝난 손가락 */ } };
    const placeBase = () => { base.style.transform = `translate(${cx - rest.x}px, ${cy - rest.y}px)`; };
    zone.addEventListener('pointerdown', e => {
      if (id != null || !enabled) return;
      e.preventDefault();
      id = e.pointerId;
      capture(zone, id);
      base.style.transform = '';
      const r = base.getBoundingClientRect();
      rest = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const half = r.width / 2 + 4;
      cx = clamp(e.clientX, half, innerWidth - half);
      cy = clamp(e.clientY, half, innerHeight - half);
      base.classList.add('is-on');
      placeBase();
      stick.active = true;
      moveTo(e);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === id) moveTo(e); });
    const end = e => { if (e.pointerId === id) release(); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);

    function moveTo(e) {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        // 손가락이 패드 밖으로 나가면 패드가 손가락을 따라온다 (방향을 바꿀 때 덜 움직여도 된다)
        const k = (d - STICK_R) / d;
        cx += dx * k; cy += dy * k; dx -= dx * k; dy -= dy * k;
        placeBase();
      }
      const m = Math.min(1, d / STICK_R);
      const mag = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD);
      const len = Math.hypot(dx, dy) || 1;
      stick.x = (dx / len) * mag; stick.z = (dy / len) * mag;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      base.classList.toggle('is-run', mag >= RUN_AT);
    }
    function release() {
      id = null;
      stick.active = false; stick.x = stick.z = 0;
      knob.style.transform = '';
      base.style.transform = '';
      base.classList.remove('is-on', 'is-run');
    }

    // ---------- A·B: 누르는 순간 의도를 보내고, 손을 뗄 때까지 눌린 모양 ----------
    // 포커스를 뺏지 않는다 (창 안에서는 포커스가 '커서'라서 A 가 그것을 누른다)
    for (const b of wrap.querySelectorAll('.tc-btn')) {
      const up = () => b.classList.remove('is-down');
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        capture(b, e.pointerId);
        b.classList.add('is-down');
        api.press(b.dataset.intent);
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('click', e => e.preventDefault());
    }

    events.emit('input:touch', { on: true });
    const ctl = {
      release() { if (id != null || stick.active) release(); },
      setEnabled(on) {
        wrap.classList.toggle('is-ui', !on);
        if (!on) ctl.release();
      },
    };
    const DEFAULT_LABEL = { action: '행동', pickup: '줍기' };
    const ARIA = { action: 'A 버튼: ', pickup: 'B 버튼: ' };
    const shown = {};
    ctl.setLabels = labels => {
      for (const b of wrap.querySelectorAll('.tc-btn')) {
        const intent = b.dataset.intent, text = labels[intent] || DEFAULT_LABEL[intent];
        if (shown[intent] === text) continue;
        shown[intent] = text;
        b.querySelector('small').textContent = text;
        b.classList.toggle('is-ctx', !!labels[intent]);
        b.setAttribute('aria-label', ARIA[intent] + text);
      }
    };
    ctl.setEnabled(enabled);
    ctl.setLabels(btnLabels);
    return ctl;
  }
  return api;
}

/** 터치 조작 모양. 어느 페이지에서 createInput 을 써도 같은 모양이 되게 여기서 넣는다. 안전 영역(노치)은 --safe-* (없으면 env) */
function injectStyle() {
  if (document.querySelector('style[data-touch-controls]')) return;
  const s = document.createElement('style');
  s.dataset.touchControls = '';
  s.textContent = `
#touch-controls { --tc-l: var(--safe-left, env(safe-area-inset-left, 0px)); --tc-r: var(--safe-right, env(safe-area-inset-right, 0px)); --tc-b: var(--safe-bottom, env(safe-area-inset-bottom, 0px));
  position: absolute; inset: 0; z-index: 5; pointer-events: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
#touch-controls > * { position: absolute; pointer-events: auto; touch-action: none; }
#touch-controls .tc-zone { left: 0; bottom: 0; width: 46%; height: 40%; }
@media (orientation: landscape) { #touch-controls .tc-zone { width: 38%; height: 70%; } }
#touch-controls .tc-stick { position: absolute; left: calc(20px + var(--tc-l)); bottom: calc(20px + var(--tc-b)); width: 128px; height: 128px; border-radius: 50%;
  background: rgba(255, 248, 230, .38); border: 3px solid rgba(255, 248, 230, .8); box-shadow: 0 4px 14px rgba(74, 59, 50, .16), inset 0 0 0 2px rgba(74, 59, 50, .1);
  transition: opacity .2s, transform .16s ease-out, background .15s; }
#touch-controls .tc-stick.is-on { transition: opacity .2s, background .15s; background: rgba(255, 248, 230, .55); }
#touch-controls .tc-knob { position: absolute; left: 50%; top: 50%; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%;
  background: #FFF8E6; box-shadow: 0 3px 0 #E2D2AE, 0 6px 12px rgba(74, 59, 50, .2); transition: transform .14s ease-out, background .15s, box-shadow .15s; }
#touch-controls .tc-stick.is-on .tc-knob { transition: background .15s, box-shadow .15s; }
#touch-controls .tc-stick.is-run .tc-knob { background: #F2B36B; box-shadow: 0 3px 0 #C9772E, 0 6px 12px rgba(74, 59, 50, .22); }
#touch-controls .tc-btn { display: grid; place-content: center; justify-items: center; gap: 1px; margin: 0; padding: 0; border: 0; border-radius: 50%;
  color: #4A3B32; font-family: "Jua", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; line-height: 1; cursor: pointer;
  transition: transform .07s, box-shadow .07s, opacity .2s, background .07s; }
#touch-controls .tc-btn b { font-weight: 400; }
#touch-controls .tc-btn small { font-size: calc(11px * min(var(--pk-fs, 1), 1.2)); opacity: .8; white-space: nowrap; }
#touch-controls .tc-btn.is-ctx small { opacity: 1; }
/* 누르는 곳은 보이는 원보다 조금 넓게 (손가락이 가장자리를 스쳐도 눌리게, 7차 D38) */
#touch-controls .tc-btn::before { content: ""; position: absolute; inset: -10px; border-radius: 50%; }
#touch-controls .tc-a { right: calc(20px + var(--tc-r)); bottom: calc(62px + var(--tc-b)); width: 78px; height: 78px; font-size: 30px;
  background: #F2B36B; box-shadow: 0 4px 0 #C9772E, 0 8px 16px rgba(74, 59, 50, .22); }
#touch-controls .tc-b { right: calc(108px + var(--tc-r)); bottom: calc(20px + var(--tc-b)); width: 64px; height: 64px; font-size: 25px;
  background: #FFF8E6; box-shadow: 0 4px 0 #E2D2AE, 0 8px 16px rgba(74, 59, 50, .2); }
#touch-controls .tc-a.is-down { transform: translateY(3px) scale(.93); background: #E9A257; box-shadow: 0 1px 0 #C9772E, 0 3px 8px rgba(74, 59, 50, .22); }
#touch-controls .tc-b.is-down { transform: translateY(3px) scale(.93); background: #F4E6C6; box-shadow: 0 1px 0 #E2D2AE, 0 3px 8px rgba(74, 59, 50, .2); }
#touch-controls.is-ui .tc-zone { pointer-events: none; }
#touch-controls.is-ui .tc-stick { opacity: 0; }
#touch-controls.is-ui .tc-btn:not(.is-down) { opacity: .72; }
#touch-controls.is-ui .tc-btn small { visibility: hidden; }
/* 가로 휴대폰: 엄지가 쉬는 높이로 조금 올린다 (패드·B +14, A +18 — ui.css 의 도구 단추도 같이) */
@media (orientation: landscape) and (max-height: 560px) {
  #touch-controls .tc-stick { left: calc(28px + var(--tc-l)); bottom: calc(34px + var(--tc-b)); }
  #touch-controls .tc-a { bottom: calc(80px + var(--tc-b)); }
  #touch-controls .tc-b { bottom: calc(34px + var(--tc-b)); }
}
/* 모양으로도 보기 (ui 의 <html class="pk-shapes">): 달릴 때 손잡이 색만 바뀌던 것에 » 표시 */
.pk-shapes #touch-controls .tc-stick.is-run .tc-knob::after { content: "»"; position: absolute; inset: 0; display: grid; place-items: center; font: 28px/1 "Jua", sans-serif; color: #4A3B32; }
/* 흔들림 줄이기: ui 의 <html class="pk-calm"> (ui 가 없는 페이지는 기기 설정) */
.pk-calm #touch-controls * { transition: none !important; }
@media (prefers-reduced-motion: reduce) { html:not(.pk-calm-off) #touch-controls * { transition: none !important; } }
`;
  document.head.append(s);
}
