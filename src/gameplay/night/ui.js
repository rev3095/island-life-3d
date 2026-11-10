// M12 밤·새벽 화면 (보드 night D112-A): UI-20 카드 뽑기 창 · UI-21 오늘 운세 칸 · 야시장 고리 던지기 결과.
// 창 겉모양은 events/eventsui.js 와 같게 ui.css 의 .pk-scrim·.pk-card 를 빌리고 안쪽만 아래 CSS (.nt-*). 창은 ctx.services.ui.panel 로 쌓는다.
// 카드 그림은 모델이 아니라 SVG (TA-01–12, 섬 이야기로 새로 그린 카드 — 실제 타로 그림을 쓰지 않는다).

const CSS = `
.nt-chip { position: absolute; right: calc(12px + var(--safe-r, 0px)); bottom: calc(196px + var(--safe-b, 0px)); z-index: 6;
  display: flex; align-items: center; gap: 6px; padding: 4px 12px 4px 4px; border-radius: 999px; border: 2px solid #B9A6E0;
  background: rgba(251, 253, 248, .94); color: #26332D; font: 14px/1.2 var(--pk-font, "Gowun Dodum", sans-serif); cursor: pointer; pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.nt-chip[hidden] { display: none; }
.nt-chip svg { width: 26px; height: 36px; display: block; }
.nt-chip:focus-visible { outline: 3px solid #2F86A6; outline-offset: 2px; }
@media (max-width: 600px) and (orientation: portrait) { .nt-chip { bottom: auto; top: calc(144px + var(--safe-t, 0px)); right: auto; left: calc(10px + var(--safe-l, 0px)); font-size: 13px; } }
.nt-card { width: min(520px, calc(100vw - 24px)); }
.nt-body { display: grid; gap: 14px; justify-items: center; text-align: center; }
.nt-lead { margin: 0; color: #5F7268; font-size: 14px; }
.nt-spread { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.nt-pick { width: 104px; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 12px; perspective: 600px; }
.nt-pick svg { width: 100%; height: auto; display: block; transition: transform .35s ease; }
.nt-pick:hover svg, .nt-pick:focus-visible svg { transform: translateY(-6px); }
.nt-pick:focus-visible { outline: 3px solid #2F86A6; outline-offset: 3px; }
.nt-pick[disabled] { cursor: default; opacity: .45; }
.nt-pick.is-flip svg { animation: nt-flip .5s ease; }
@keyframes nt-flip { 0% { transform: rotateY(0) } 50% { transform: rotateY(90deg) } 100% { transform: rotateY(0) } }
@media (prefers-reduced-motion: reduce) { .nt-pick svg, .nt-pick.is-flip svg { transition: none; animation: none; } }
.nt-result { display: grid; gap: 6px; max-width: 34ch; }
.nt-result h3 { margin: 0; font-size: 20px; }
.nt-result p { margin: 0; }
.nt-eff { color: #7A6A9A; font-weight: 700; }
.nt-note { font-size: 12px; color: #5F7268; margin: 0; }
`;

export function ensureNightCss() {
  if (document.querySelector('style[data-night-css]')) return;
  const s = document.createElement('style');
  s.dataset.nightCss = '';
  s.textContent = CSS;
  document.head.append(s);
}

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 작은 별 몇 개 (카드 무늬, 씨앗 n 으로 늘 같은 자리) */
function stars(n, x, y, w, h, k = 5) {
  let out = '';
  for (let i = 0; i < k; i++) {
    const a = ((i * 37 + n * 11) % 100) / 100, b = ((i * 59 + n * 7) % 100) / 100, r = 1.6 + (i % 3);
    const cx = (x + a * w).toFixed(1), cy = (y + b * h).toFixed(1);
    out += `<path d="M${cx} ${cy - r}L${+cx + r * .3} ${cy - r * .3}L${+cx + r} ${cy}L${+cx + r * .3} ${+cy + r * .3}L${cx} ${+cy + r}L${cx - r * .3} ${+cy + r * .3}L${cx - r} ${cy}L${cx - r * .3} ${cy - r * .3}z" fill="#F6E7A8"/>`;
  }
  return out;
}
/** 카드 앞면 SVG (card = night.json tarot.cards 한 줄) */
export function cardFace(card, i = 1) {
  return `<svg viewBox="0 0 120 170" role="img" aria-label="${esc(card.name)} 카드"><rect x="2" y="2" width="116" height="166" rx="10" fill="#FBF7F2" stroke="#7A6A9A" stroke-width="3"/>`
    + `<rect x="12" y="12" width="96" height="146" rx="6" fill="${esc(card.color)}"/>${stars(i, 18, 20, 84, 36)}`
    + `<text x="60" y="106" font-size="46" text-anchor="middle" fill="#FBF7F2">${esc(card.sym)}</text>`
    + `<text x="60" y="146" font-size="15" text-anchor="middle" fill="#FBF7F2">${esc(card.name)}</text></svg>`;
}
/** 카드 뒷면 SVG */
export function cardBack(i = 1) {
  return `<svg viewBox="0 0 120 170" role="img" aria-label="엎어 둔 카드"><rect x="2" y="2" width="116" height="166" rx="10" fill="#FBF7F2" stroke="#7A6A9A" stroke-width="3"/>`
    + `<rect x="12" y="12" width="96" height="146" rx="6" fill="#3A3360"/>${stars(i + 20, 16, 16, 88, 138, 9)}`
    + `<circle cx="60" cy="85" r="22" fill="none" stroke="#B9A6E0" stroke-width="3"/><path d="M60 67 L64 81 L78 85 L64 89 L60 103 L56 89 L42 85 L56 81z" fill="#F2C14E"/></svg>`;
}

function shell(ctx, { title, icon }) {
  let p = null;
  const close = v => p?.close(v ?? null);
  const titleId = `nt-${Math.random().toString(36).slice(2, 8)}`;
  const body = el('div', { class: 'pk-card-body nt-body' });
  const card = el('section', { class: 'pk-card nt-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    el('header', { class: 'pk-card-head' },
      el('h2', { class: 'pk-card-title', id: titleId }, el('span', { 'aria-hidden': 'true', text: icon }), ` ${title}`),
      el('button', { type: 'button', class: 'pk-x', 'aria-label': '닫기', onclick: () => close(null), text: '✕' })),
    body);
  const root = el('div', { class: 'pk-scrim' }, card);
  root.addEventListener('click', e => { if (e.target === root) close(null); });
  return { body, card, root, close, open(name) { p = ctx.services.ui.panel(name, root, {}); card.focus(); return p.result; } };
}

/**
 * UI-20 카드 뽑기 창: 엎어 둔 카드 ids 중 하나를 누르면 뒤집혀 이름 · 운세 · 효과 → 「받기」. → 고른 카드 id | null (닫음)
 * cards = 카드 표, ids = 엎어 둘 카드 (rules.spread)
 */
export function openDraw(ctx, cards, ids) {
  ensureNightCss();
  const S = shell(ctx, { title: '오늘의 카드', icon: '🔮' });
  let chosen = null;
  const lead = el('p', { class: 'nt-lead', text: '마음이 가는 카드 한 장을 골라 보렴.' });
  const result = el('div', { class: 'nt-result', 'aria-live': 'polite' });
  const take = el('button', { type: 'button', class: 'pk-btn is-primary', hidden: true, onclick: () => S.close(chosen) }, '받기');
  const picks = ids.map((id, i) => el('button', { type: 'button', class: 'nt-pick', 'aria-label': `${i + 1}번째 카드 뒤집기`, html: cardBack(i + 1),
    onclick: ev => {
      if (chosen) return;
      const c = cards.find(x => x.id === id);
      chosen = id;
      const b = ev.currentTarget;
      b.classList.add('is-flip');
      setTimeout(() => { b.innerHTML = cardFace(c, cards.indexOf(c) + 1); }, 220);
      for (const o of picks) if (o !== b) o.disabled = true;
      lead.textContent = '카드가 대답했어요.';
      result.replaceChildren(el('h3', { text: `${c.id} · ${c.name}` }), el('p', { text: c.text }), el('p', { class: 'nt-eff', text: `내일 하루 (새벽 5시부터): ${c.effect}` }));
      take.hidden = false;
      setTimeout(() => take.focus({ preventScroll: true }), 260);
      ctx.events.emit('sfx', { name: 'menu', volume: 0.5 });
    } }));
  S.body.append(lead, el('div', { class: 'nt-spread' }, picks), result, take,
    el('p', { class: 'nt-note', text: '카드의 기운은 다음 새벽 5시부터 하루 동안이에요. 나쁜 카드는 없어요.' }));
  return S.open('tarot');
}

/** UI-21 오늘 운세 칸 (오른쪽 아래, 행사 칸 위). onOpen = 누르면 */
export function createFortuneChip(mount, { onOpen }) {
  ensureNightCss();
  const art = el('span', { 'aria-hidden': 'true' });
  const t = el('span');
  const chip = el('button', { type: 'button', class: 'nt-chip', hidden: true, onclick: () => onOpen() }, art, t);
  mount?.append(chip);
  let shown = null;
  return {
    el: chip,
    show(card, i) {
      if (!card) { chip.hidden = true; shown = null; return; }
      if (shown !== card.id) { art.innerHTML = cardFace(card, i); shown = card.id; }
      t.replaceChildren(el('b', { text: card.name }), ' · 오늘');
      chip.setAttribute('aria-label', `오늘의 카드 ${card.name} — ${card.effect}`);
      chip.hidden = false;
    },
    hide(on) { chip.style.visibility = on ? 'hidden' : ''; },
  };
}

/** 오늘 운세 보기 (칸을 누르면) */
export function openFortune(ctx, card, i, { until = '다음 새벽 5시' } = {}) {
  ensureNightCss();
  const S = shell(ctx, { title: '오늘의 운세', icon: '🔮' });
  S.body.append(el('div', { class: 'nt-pick', html: cardFace(card, i), 'aria-hidden': 'true' }),
    el('div', { class: 'nt-result' }, el('h3', { text: `${card.id} · ${card.name}` }), el('p', { text: card.text }), el('p', { class: 'nt-eff', text: card.effect })),
    el('p', { class: 'nt-note', text: `${until}까지 · 새벽 3–5시 숲 끝 천막에서 다음 카드를 뽑을 수 있어요.` }));
  return S.open('fortune');
}
