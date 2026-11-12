// 망원경 보기 화면 UI-32 · 찍은 결과 UI-33 (요청 8). 2D 캔버스 하나에 starmap.drawSky — 셰이더·3D 없음, 볼 때만 돈다.
//  조준: 마우스 끌기 · 한 손가락 끌기 · 방향키/WASD · 게임패드 왼쪽 막대
//  당기기(줌): 휠 · 화면 + / − 단추 · 두 손가락 벌리기 · Q/E · -/= · 게임패드 RT/LT(오른쪽 막대 위아래)
//  찍기: 아직 못 찍은 별자리를 시야 가운데(알맞은 크기)에 CAPTURE.hold 초 두면 저절로 「찰칵」 → UI-33 카드. Space/Enter/A 는 바로 찍기(맞을 때만)
//  닫기: Esc · B · 「그만 보기」
// 그리기는 게임 update(dt) 가 부른다 (봇이 ctx.step 으로 돌려도 같은 화면).
import { drawSky, visibleNow, aimTarget, aimCheck, FOV, CAPTURE, SEASON_NAME, CLOUDY, byId, dirOf, basisOf } from '../../sky/starmap.js';

const STYLE_ID = 'pk-scope-style';
const CSS = `
.pk-scope { position: absolute; inset: 0; pointer-events: auto; background: #05070D; color: #F4EEDD; font-family: inherit; touch-action: none; user-select: none; }
.pk-scope canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
.pk-scope canvas:active { cursor: grabbing; }
.pk-scope-top { position: absolute; left: 50%; top: calc(12px + var(--sat, 0px)); transform: translateX(-50%); text-align: center; pointer-events: none; text-shadow: 0 1px 3px #000; }
.pk-scope-title { font-size: calc(18px * var(--pk-fs, 1)); font-weight: 700; }
.pk-scope-hint { font-size: calc(13px * var(--pk-fs, 1)); opacity: .85; margin-top: 2px; }
.pk-scope-side { position: absolute; right: calc(14px + var(--sar, 0px)); top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; }
.pk-scope-btn { min-width: 52px; min-height: 52px; border-radius: 26px; border: 2px solid #B98A4A; background: rgba(30,24,20,.82); color: #F4EEDD; font-size: 22px; font-weight: 700; cursor: pointer; }
.pk-scope-btn:focus-visible { outline: 3px solid #FFD27A; outline-offset: 2px; }
.pk-scope-close { position: absolute; left: 50%; bottom: calc(18px + var(--sab, 0px)); transform: translateX(-50%); padding: 10px 22px; border-radius: 22px; border: 2px solid #B98A4A; background: rgba(30,24,20,.85); color: #F4EEDD; font-size: calc(15px * var(--pk-fs, 1)); cursor: pointer; }
.pk-scope-zoom { position: absolute; right: calc(76px + var(--sar, 0px)); top: 50%; transform: translateY(-50%); font-size: 12px; opacity: .7; pointer-events: none; }
.pk-scope-ring { position: absolute; left: 50%; top: 50%; width: 96px; height: 96px; margin: -48px 0 0 -48px; pointer-events: none; }
.pk-scope-ring circle { fill: none; stroke-width: 4; }
.pk-scope-msg { position: absolute; left: 50%; top: calc(50% + 66px); transform: translateX(-50%); font-size: calc(14px * var(--pk-fs, 1)); text-shadow: 0 1px 3px #000; pointer-events: none; white-space: nowrap; }
.pk-scope-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(340px, calc(100% - 32px)); padding: 16px 16px 14px; border-radius: 18px; background: #FFF8EA; color: #4A3B32; box-shadow: 0 10px 30px rgba(0,0,0,.5); text-align: center; }
.pk-scope-card canvas { position: static; width: 200px; height: 200px; border-radius: 14px; margin: 4px auto 8px; cursor: default; }
.pk-scope-card h3 { margin: 2px 0 2px; font-size: calc(19px * var(--pk-fs, 1)); }
.pk-scope-card .pk-scope-season { font-size: 13px; opacity: .75; }
.pk-scope-card p { margin: 8px 0 12px; font-size: calc(14px * var(--pk-fs, 1)); line-height: 1.5; text-align: left; }
.pk-scope-card button { padding: 9px 26px; border-radius: 20px; border: 0; background: #7FB069; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
`;

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * 망원경 보기 열기. stars = 별자리 서비스 안쪽 (found·capture), where = '공용 망원경' 같은 이름
 * → { close(), update(dt), get view(), get target(), get card(), aimAt(id), state } (닫히면 onClose)
 */
export function openScope(ctx, { stars, where = '망원경', onClose = () => {} } = {}) {
  if (!document.getElementById(STYLE_ID)) document.head.append(el('style', { id: STYLE_ID }, CSS));
  const ui = ctx.services.ui;
  const now = () => ctx.services.time?.now?.() ?? { season: 'spring', hourF: 22 };
  const weather = () => ctx.services.time?.weather ?? 'clear';
  const lowSpec = ctx.quality === 'min' || ctx.quality === 'low';

  const canvas = el('canvas', { 'aria-label': '망원경으로 본 밤하늘', role: 'img' });
  const title = el('div', { class: 'pk-scope-title' }, `🔭 ${where}`);
  const hint = el('div', { class: 'pk-scope-hint' });
  const ringFg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const ringBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  for (const c of [ringBg, ringFg]) { c.setAttribute('cx', 48); c.setAttribute('cy', 48); c.setAttribute('r', 40); }
  ringBg.setAttribute('stroke', 'rgba(255,255,255,.35)');
  ringFg.setAttribute('stroke', '#FFD27A');
  ringFg.setAttribute('stroke-dasharray', String(2 * Math.PI * 40));
  ringFg.setAttribute('transform', 'rotate(-90 48 48)');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('class', 'pk-scope-ring');
  ring.setAttribute('viewBox', '0 0 96 96');
  ring.append(ringBg, ringFg);
  const msg = el('div', { class: 'pk-scope-msg', 'aria-live': 'polite' });
  const zoomTxt = el('div', { class: 'pk-scope-zoom' });
  const zIn = el('button', { type: 'button', class: 'pk-scope-btn', 'aria-label': '당겨 보기 (줌인)', 'data-scope': 'in' }, '+');
  const zOut = el('button', { type: 'button', class: 'pk-scope-btn', 'aria-label': '멀리 보기 (줌아웃)', 'data-scope': 'out' }, '−');
  const closeBtn = el('button', { type: 'button', class: 'pk-scope-close', 'data-scope': 'close' }, '그만 보기 (Esc)');
  const root = el('div', { class: 'pk-scope', role: 'dialog', 'aria-label': '망원경 보기' },
    canvas, el('div', { class: 'pk-scope-top' }, title, hint), ring, msg, zoomTxt, el('div', { class: 'pk-scope-side' }, zIn, zOut), closeBtn);

  // 처음 겨누는 곳: 아직 못 찍은 이 계절 별자리 쪽으로 반쯤 (찾는 재미는 남긴다)
  const list0 = visibleNow(now());
  const todo0 = list0.filter(c => !stars.has(c.id));
  const first = todo0[0] ?? list0[0];
  const V = { az: first ? first.az * 0.5 : 0, alt: first ? (first.alt + 45) / 2 : 45, fov: FOV.start };
  const S = { t: 0, hold: 0, lines: {}, keys: new Set(), drag: null, touches: new Map(), pinch0: null, card: null, closed: false, flash: 0, lastTarget: null };

  const zoom = k => { V.fov = clamp(V.fov * k, FOV.min, FOV.max); };
  const pan = (dx, dy) => { V.az = ((V.az + dx + 540) % 360) - 180; V.alt = clamp(V.alt + dy, 4, 88); };
  const degPerPx = () => V.fov / Math.max(200, Math.min(canvas.clientWidth, canvas.clientHeight) * 0.94);

  zIn.addEventListener('click', () => zoom(0.8));
  zOut.addEventListener('click', () => zoom(1.25));
  closeBtn.addEventListener('click', () => close());
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture?.(e.pointerId);
    S.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.touches.size === 2) { const [a, b] = [...S.touches.values()]; S.pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: V.fov }; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = S.touches.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    S.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.touches.size >= 2 && S.pinch0) {
      const [a, b] = [...S.touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 10) V.fov = clamp(S.pinch0.fov * (S.pinch0.d / d), FOV.min, FOV.max);
    } else if (S.touches.size === 1) {
      const k = degPerPx();
      pan(-dx * k, dy * k);   // 하늘을 잡아 끄는 느낌: 오른쪽으로 끌면 왼쪽 하늘이 온다
    }
  });
  const up = e => { S.touches.delete(e.pointerId); if (S.touches.size < 2) S.pinch0 = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const keyUp = e => S.keys.delete(e.code);
  addEventListener('keyup', keyUp);
  addEventListener('blur', () => S.keys.clear());

  const PAN_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'Minus', 'Equal', 'NumpadAdd', 'NumpadSubtract', 'PageUp', 'PageDown']);
  const panel = ui?.panel?.('scope', root, {
    initialFocus: () => closeBtn,
    onKey(e, p) {
      if (S.card) {   // 결과 카드: Enter·Space·Esc 로 닫기
        if (['Enter', 'NumpadEnter', 'Space', 'Escape'].includes(e.code)) { if (!e.repeat) closeCard(); return true; }
        return false;
      }
      if (PAN_KEYS.has(e.code)) { S.keys.add(e.code); return true; }
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
        if (document.activeElement && root.contains(document.activeElement) && document.activeElement !== closeBtn && document.activeElement.tagName === 'BUTTON') return false;
        tryCapture(true); return true;
      }
      return false;
    },
    onAction: () => (S.card ? closeCard() : tryCapture(true)),
    onCancel: () => (S.card ? closeCard() : close()),
  });
  if (!panel) return null;

  function resize() {
    const dpr = Math.min(lowSpec ? 1 : 1.5, globalThis.devicePixelRatio || 1);
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    let W = Math.round(w * dpr), H = Math.round(h * dpr);
    const cap = lowSpec ? 0.9e6 : 1.6e6;
    if (W * H > cap) { const s = Math.sqrt(cap / (W * H)); W = Math.round(W * s); H = Math.round(H * s); }
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }

  function gamepad() {
    const pads = globalThis.navigator?.getGamepads?.() ?? [];
    for (const g of pads) {
      if (!g?.connected) continue;
      const ax = i => (Math.abs(g.axes[i] ?? 0) > 0.18 ? g.axes[i] : 0);
      const trig = i => g.buttons[i]?.value ?? 0;
      return { x: ax(0), y: ax(1), zoom: (trig(7) - trig(6)) || -ax(3) };
    }
    return null;
  }

  function tryCapture(manual) {
    const list = visibleNow(now());
    const tgt = aimTarget(V, list.filter(c => !stars.has(c.id)));
    if (!tgt?.check.ok || CLOUDY.has(weather())) { if (manual) S.flash = 0.6; return false; }
    if (!manual && S.hold < CAPTURE.hold) return false;
    capture(tgt.c);
    return true;
  }
  function capture(c) {
    const shot = stars.capture(c.id, V);
    if (!shot) return;
    S.hold = 0;
    S.lines[c.id] = 1;
    ctx.events.emit('sfx', { name: 'fossil' });
    showCard(c, shot);
  }
  function showCard(c, shot) {
    const pic = el('canvas', { width: '400', height: '400', 'aria-label': `${c.name} 그림` });
    drawSky(pic.getContext('2d'), 400, 400, shot, { list: [c], lines: { [c.id]: 1 }, lens: true, t: 1.3, names: false });
    const ok = el('button', { type: 'button', 'data-autofocus': '' }, '좋아요');
    const n = stars.count();
    const card = el('div', { class: 'pk-scope-card', role: 'alertdialog', 'aria-label': `${c.name} 찰칵` },
      el('div', {}, '📸 찰칵!'), pic, el('h3', {}, c.name), el('div', { class: 'pk-scope-season' }, `${SEASON_NAME[c.season]} 밤하늘 · ${c.id}`),
      el('p', {}, `${c.desc}\n\n📖 별자리 도감에 적었어요 (${n}/12). 박물관 별자리관에도 걸려요.`), ok);
    card.querySelector('p').style.whiteSpace = 'pre-line';
    ok.addEventListener('click', () => closeCard());
    root.append(card);
    S.card = card;
    ok.focus({ preventScroll: true });
  }
  function closeCard() {
    S.card?.remove();
    S.card = null;
    closeBtn.focus({ preventScroll: true });
  }

  function update(dt) {
    if (S.closed) return;
    S.t += dt;
    resize();
    const n = now(), list = visibleNow(n), wx = weather(), cloudy = CLOUDY.has(wx);
    if (!list.length && !(n.hourF >= 18.5 || n.hourF < 5.5)) { close('day'); return; }
    if (!S.card) {
      const sp = V.fov * 0.6 * dt;
      const k = S.keys, has = c => k.has(c);
      pan(((has('ArrowRight') || has('KeyD')) - (has('ArrowLeft') || has('KeyA'))) * sp, ((has('ArrowUp') || has('KeyW')) - (has('ArrowDown') || has('KeyS'))) * sp);
      const zk = (has('KeyE') || has('Equal') || has('NumpadAdd') || has('PageUp')) - (has('KeyQ') || has('Minus') || has('NumpadSubtract') || has('PageDown'));
      if (zk) zoom(Math.exp(-zk * dt * 1.1));
      const gp = gamepad();
      if (gp) { pan(gp.x * sp * 1.2, -gp.y * sp * 1.2); if (gp.zoom) zoom(Math.exp(-gp.zoom * dt * 1.1)); }
    }
    // 가운데 별자리
    const todo = list.filter(c => !stars.has(c.id));
    const tgt = aimTarget(V, todo), known = aimTarget(V, list.filter(c => stars.has(c.id)));
    const okNow = !!tgt?.check.ok && !cloudy && !S.card;
    S.hold = okNow ? S.hold + dt : Math.max(0, S.hold - dt * 2);
    for (const c of list) {
      const goal = stars.has(c.id) ? 0.85 : (tgt?.c === c ? Math.min(1, S.hold / CAPTURE.hold) : 0);
      S.lines[c.id] = (S.lines[c.id] ?? 0) + (goal - (S.lines[c.id] ?? 0)) * Math.min(1, dt * 6);
    }
    if (okNow && S.hold >= CAPTURE.hold) tryCapture(false);
    S.lastTarget = tgt?.c?.id ?? null;
    // 그리기
    const g = canvas.getContext('2d');
    const marks = drawSky(g, canvas.width, canvas.height, V, { t: S.t, list, lines: S.lines, lens: true, names: true, cloud: cloudy ? 0.85 : 0 });
    // 아직 못 찍은 별자리 쪽 화살표 (렌즈 가장자리)
    if (!cloudy) arrows(g, todo, marks);
    const p = Math.min(1, S.hold / CAPTURE.hold);
    ringFg.setAttribute('stroke-dashoffset', String(2 * Math.PI * 40 * (1 - p)));
    ring.style.opacity = tgt ? '1' : '0.45';
    zoomTxt.textContent = `×${(FOV.max / V.fov).toFixed(1)}`;
    hint.textContent = list.length
      ? `${SEASON_NAME[n.season]} 밤하늘 · 별자리 ${list.length}개 중 ${list.length - todo.length}개 찍음 · 도감 ${stars.count()}/12`
      : '해가 지면 별자리가 떠요';
    let m = '';
    if (cloudy) m = wx === 'rain' ? '비구름에 가려 별이 안 보여요' : wx === 'snow' ? '눈구름에 가려 별이 안 보여요' : '구름이 많아 별자리가 흐려요 — 맑은 밤에 다시 봐요';
    else if (tgt) m = tgt.check.ok ? `${tgt.c.name}… 그대로! 📸` : tgt.check.why === 'small' ? '조금 더 당겨 봐요 (+)' : tgt.check.why === 'big' ? '조금 멀리 봐요 (−)' : '가운데에 맞춰 봐요';
    else if (known && aimCheck(V, known.c).off < 0.2) m = `${known.c.name} — 도감에 있어요`;
    else if (!todo.length && list.length) m = '이 계절 별자리는 다 찍었어요! 다른 계절에 또 봐요';
    else m = '끌거나 방향키로 하늘을 둘러봐요 · 휠·+/−로 당기기';
    if (S.flash > 0) { S.flash -= dt; if (!tgt?.check.ok) m = '아직 별자리가 가운데에 없어요'; }
    if (msg.textContent !== m) msg.textContent = m;
  }

  function arrows(g, todo, marks) {
    const w = canvas.width, h = canvas.height, R = Math.min(w, h) * 0.47, cx = w / 2, cy = h / 2;
    const { f, r, u } = basisOf(V.az, V.alt);
    for (const c of todo) {
      const mk = marks.find(x => x.id === c.id);
      if (mk && Math.hypot(mk.x - cx, mk.y - cy) < R * 0.9) continue;
      const d = dirOf(c.az, c.alt);
      const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2], y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
      const a = Math.atan2(-y, x), px = cx + Math.cos(a) * R * 0.9, py = cy + Math.sin(a) * R * 0.9;
      void f;
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.fillStyle = 'rgba(255,210,122,0.8)';
      const s = Math.max(8, R * 0.04);
      g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.6, -s * 0.7); g.lineTo(-s * 0.6, s * 0.7); g.closePath(); g.fill();
      g.restore();
    }
  }

  function close(why = null) {
    if (S.closed) return;
    S.closed = true;
    removeEventListener('keyup', keyUp);
    panel.close(why);
    onClose(why);
  }

  return {
    close, update,
    get view() { return { ...V }; },
    get target() { return S.lastTarget; },
    get card() { return !!S.card; },
    get hold() { return S.hold; },
    /** 개발·점검용: 화면 가운데를 이 별자리로 (사람은 끌기·키로 한다) */
    aimAt(id) { const c = byId(id); if (c) { V.az = c.az; V.alt = c.alt; } },
    root,
  };
}
