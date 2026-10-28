// 키보드·터치를 '의도'로 바꾼다. 다른 모듈은 키 이름이 아니라 의도(action, pickup ...)만 본다.
//   이동: WASD / 방향키 (+ Shift 달리기), 휴대폰은 왼쪽 아래 조이스틱
//   action  Space/Enter (말 걸기·도구 쓰기)   pickup F (줍기)
//   toolPrev Q   toolNext E   tool1~5 숫자키   bag I/Tab   phone P/Esc   map M
// 화면 위쪽 = 월드 -Z (카메라가 남쪽에서 북쪽을 본다).
const KEYS = {
  Space: 'action', Enter: 'action', KeyF: 'pickup', KeyQ: 'toolPrev', KeyE: 'toolNext',
  KeyI: 'bag', Tab: 'bag', KeyP: 'phone', Escape: 'phone', KeyM: 'map',
  Digit1: 'tool1', Digit2: 'tool2', Digit3: 'tool3', Digit4: 'tool4', Digit5: 'tool5', Digit0: 'toolNone',
};
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

export function createInput(events, { touchRoot = document.body } = {}) {
  const held = new Set();
  const stick = { x: 0, z: 0, active: false };
  const api = {
    move: { x: 0, z: 0 },      // 길이 0~1
    run: false,
    enabled: true,             // UI 창이 열리면 ui 모듈이 false 로 바꾼다
    touch: false,
    update() {
      let x = 0, z = 0;
      for (const code of held) { const m = MOVE[code]; if (m) { x += m[0]; z += m[1]; } }
      if (stick.active) { x = stick.x; z = stick.z; }
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      api.move.x = api.enabled ? x : 0;
      api.move.z = api.enabled ? z : 0;
      api.run = api.enabled && (held.has('ShiftLeft') || held.has('ShiftRight') || (stick.active && Math.hypot(stick.x, stick.z) > 0.85));
    },
    press(intent) { events.emit('input:press', { intent }); },
  };

  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    held.add(e.code);
    const intent = KEYS[e.code];
    if (intent && !e.repeat) { e.preventDefault(); api.press(intent); }
    else if (MOVE[e.code] || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  if (matchMedia('(pointer: coarse)').matches) buildTouch();

  function buildTouch() {
    api.touch = true;
    const wrap = document.createElement('div');
    wrap.id = 'touch-controls';
    wrap.innerHTML = `<div class="tc-stick"><div class="tc-knob"></div></div>
      <button type="button" class="tc-btn tc-a" data-intent="action">A</button>
      <button type="button" class="tc-btn tc-b" data-intent="pickup">B</button>`;
    touchRoot.append(wrap);
    const base = wrap.querySelector('.tc-stick'), knob = wrap.querySelector('.tc-knob');
    let id = null, cx = 0, cy = 0;
    const R = 46;
    base.addEventListener('pointerdown', e => {
      id = e.pointerId; base.setPointerCapture(id);
      const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      stick.active = true; moveTo(e);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) moveTo(e); });
    const end = e => { if (e.pointerId !== id) return; id = null; stick.active = false; stick.x = stick.z = 0; knob.style.transform = ''; };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    function moveTo(e) {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      stick.x = dx / R; stick.z = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    wrap.addEventListener('pointerdown', e => { const b = e.target.closest('[data-intent]'); if (b) { e.preventDefault(); api.press(b.dataset.intent); } });
  }
  return api;
}
