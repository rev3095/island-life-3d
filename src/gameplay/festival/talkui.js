// 이모티콘 대화 화면 (UI-04): 주민 머리 위 말풍선 + 화면 아래 선택기(묶음 탭 6 · 격자 · 보낼 칸 3 · 보내기 · 닫기).
// ui 의 창 쌓기(ctx.services.ui.panel)로 열어서 창이 열린 동안 게임 입력이 막히고, 키·A/B 버튼이 이 창으로 온다.
// 글자는 화면에 쓰지 않는다 — 단추마다 이름(aria-label), 말풍선 내용은 스크린리더용 줄에만.
const CSS = new URL('./festival.css', import.meta.url).href;
const MAX = 3;

export function ensureCss() {
  if (document.querySelector('link[data-festival-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = CSS; l.dataset.festivalCss = '';
  document.head.append(l);
}

const el = (tag, cls, attrs = {}) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  return e;
};

/**
 * who = { name, color, voice }. 돌려주는 것: { say, choose, compose, place, close, closed }
 * 대화가 끝나면 close() — 그 전에 Esc·B 는 지금 단계에 맞게 (말풍선 넘기기 / 고르지 않기 / 잘 가).
 */
export function openTalkUI(ctx, emo, who) {
  ensureCss();
  const items = () => ctx.services.data?.items;
  const tok = (t, label) => emo.token(t, items(), label);

  const root = el('div', 'fe-talk');
  const bubble = el('div', 'fe-bubble', { role: 'group', 'aria-label': `${who.name}의 말` });
  const nameTag = el('span', 'fe-name');
  nameTag.textContent = who.name;
  nameTag.style.background = who.color ?? '#F2B36B';
  const emos = el('div', 'fe-bubble-emos');
  const next = el('span', 'fe-next', { 'aria-hidden': 'true' });
  next.textContent = '▼';
  const live = el('p', 'fe-sr', { 'aria-live': 'polite' });
  bubble.append(nameTag, emos, next, live);

  const dock = el('div', 'fe-dock');
  const choices = el('div', 'fe-choices', { role: 'group', 'aria-label': '대답 고르기' });
  const picker = el('div', 'fe-picker', { role: 'group', 'aria-label': '이모티콘으로 말하기' });
  const tabs = el('div', 'fe-tabs', { role: 'tablist', 'aria-label': '이모티콘 묶음' });
  const grid = el('div', 'fe-grid', { role: 'group', 'aria-label': '이모티콘 고르기' });
  const bar = el('div', 'fe-bar');
  const slotsEl = el('div', 'fe-slots', { role: 'group', 'aria-label': '보낼 이모티콘 (최대 3개)' });
  const sendBtn = el('button', 'fe-send', { type: 'button', 'aria-label': '보내기 (비우면 기다리기)' });
  sendBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 L20 5 L15 19 L12 13z" fill="currentColor"/></svg>';
  const byeBtn = el('button', 'fe-bye', { type: 'button', 'aria-label': '잘 가 (대화 끝내기)' });
  byeBtn.innerHTML = emo.svg('wave', false);
  bar.append(slotsEl, sendBtn, byeBtn);
  picker.append(tabs, grid, bar);
  dock.append(choices, picker);
  const catch_ = el('div', 'fe-catch');
  root.append(catch_, bubble, dock);

  let mode = null, resolve = null, slots = [], tab = 0, extra = [], closed = false;
  const finish = v => { const r = resolve; resolve = null; mode = null; r?.(v); };

  // ---- 말풍선 ----
  function showBubble(toks, waiting) {
    emos.innerHTML = toks.map(t => tok(t, true)).join('');
    bubble.classList.toggle('is-wait', !!waiting);
    bubble.hidden = !toks.length;
    const text = emo.say(toks, items());
    live.textContent = `${who.name}: ${text}`;
    if (toks.length) ctx.events.emit('dialog:line', { speaker: who.name, text: '♪'.repeat(Math.max(2, toks.length * 3)), voice: who.voice });
    bubble.classList.remove('is-pop'); void bubble.offsetWidth; bubble.classList.add('is-pop');
  }

  // ---- 선택기 ----
  const cats = emo.cats;
  function drawTabs() {
    tabs.replaceChildren(...cats.map((c, i) => {
      const first = emo.player.find(e => e.cat === c.key);
      const b = el('button', 'fe-tab', { type: 'button', role: 'tab', 'aria-selected': String(i === tab), 'aria-label': `${i + 1} ${c.name}` });
      b.innerHTML = emo.svg(first?.key, false);
      b.addEventListener('click', () => { tab = i; drawTabs(); drawGrid(); });
      return b;
    }));
  }
  function drawGrid() {
    const cat = cats[tab]?.key;
    const list = [...new Set([...emo.player.filter(e => e.cat === cat).map(e => e.key), ...(cat === 'thing' ? extra : [])])];
    grid.replaceChildren(...list.map(k => {
      const b = el('button', 'fe-cell', { type: 'button', 'aria-label': String(k).startsWith('item:') ? emo.say([k], items()) : emo.name(k) });
      b.innerHTML = tok(k, false);
      b.addEventListener('click', () => add(k));
      return b;
    }));
  }
  function drawSlots() {
    slotsEl.replaceChildren(...Array.from({ length: MAX }, (_, i) => {
      const k = slots[i];
      const b = el('button', `fe-slot${k ? '' : ' is-empty'}`, { type: 'button', 'aria-label': k ? `${i + 1}번째 칸 ${emo.say([k], items())} 빼기` : `${i + 1}번째 칸 비어 있음`, disabled: !k });
      if (k) { b.innerHTML = tok(k, false); b.addEventListener('click', () => { slots.splice(i, 1); drawSlots(); }); }
      return b;
    }));
    sendBtn.classList.toggle('is-wait', !slots.length);
  }
  function add(k) {
    if (slots.length >= MAX) { slotsEl.classList.remove('is-full'); void slotsEl.offsetWidth; slotsEl.classList.add('is-full'); return; }
    slots.push(k);
    drawSlots();
  }
  sendBtn.addEventListener('click', () => { if (mode === 'compose') { const s = slots.slice(); slots = []; drawSlots(); finish(s); } });
  byeBtn.addEventListener('click', () => { if (mode === 'compose') finish(null); });

  const advance = () => { if (mode === 'say' && !p?.fresh?.()) finish(null); };
  catch_.addEventListener('click', advance);
  bubble.addEventListener('click', advance);

  // ---- 창 ----
  const ui = ctx.services.ui;
  const p = ui.panel('emote', root, {
    initialFocus: () => (mode === 'compose' ? grid.querySelector('button') : bubble),
    onAction: () => {
      if (mode === 'say') advance();
      else if (mode === 'choose') document.activeElement?.closest?.('.fe-choice')?.click();
      else if (mode === 'compose') sendBtn.click();
    },
    onCancel: () => {
      if (mode === 'say') advance();
      else if (mode === 'choose' || mode === 'compose') finish(null);
    },
    onKey(e) {
      if (mode === 'say' && ['Enter', 'NumpadEnter', 'Space', 'Escape'].includes(e.code)) { if (!e.repeat) advance(); return true; }
      if (mode === 'compose') {
        const d = /^Digit([1-6])$/.exec(e.code);
        if (d) { tab = Number(d[1]) - 1; drawTabs(); drawGrid(); grid.querySelector('button')?.focus(); return true; }
        if (e.code === 'Backspace' && slots.length) { slots.pop(); drawSlots(); return true; }
      }
      return false;
    },
    onClose: () => { closed = true; finish(null); },
  });
  bubble.tabIndex = -1;

  drawTabs(); drawGrid(); drawSlots();
  picker.hidden = true; choices.hidden = true;

  return {
    /** 주민 말풍선을 보여 주고 넘길 때까지 기다린다 */
    say(toks) {
      if (closed) return Promise.resolve(null);
      showBubble(toks, true);
      picker.hidden = true; choices.hidden = true;
      mode = 'say';
      bubble.focus({ preventScroll: true });
      return new Promise(r => { resolve = r; });
    },
    /** 말풍선 + 대답 고르기 (options = 낱말 목록들) → 고른 번호 | null */
    choose(toks, options) {
      if (closed) return Promise.resolve(null);
      showBubble(toks, false);
      picker.hidden = true;
      choices.replaceChildren(...options.map((o, i) => {
        const b = el('button', 'fe-choice', { type: 'button', 'aria-label': emo.say(o, items()) });
        b.innerHTML = o.map(t => tok(t, false)).join('');
        b.addEventListener('click', () => finish(i));
        return b;
      }));
      choices.hidden = false;
      mode = 'choose';
      choices.querySelector('button')?.focus({ preventScroll: true });
      return new Promise(r => { resolve = r; });
    },
    /** 플레이어가 이모티콘을 골라 보낸다 → 낱말 목록 (빈 목록 = 기다리기) | null (잘 가) */
    compose({ things = [], keep } = {}) {
      if (closed) return Promise.resolve(null);
      extra = things;
      if (keep) showBubble(keep, false);
      bubble.classList.remove('is-wait');
      choices.hidden = true; picker.hidden = false;
      drawGrid();
      mode = 'compose';
      (grid.querySelector('button') ?? sendBtn).focus({ preventScroll: true });
      return new Promise(r => { resolve = r; });
    },
    /** 말풍선을 머리 위 화면 자리로 (매 프레임) */
    place(pos, height, camera) {
      if (closed || !camera) return;
      const v = place.v ??= new ctx.THREE.Vector3();
      v.set(pos.x, pos.y + height * 1.15 + 0.15, pos.z).project(camera);
      const r = ctx.renderer.domElement.getBoundingClientRect();
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { bubble.style.transform = ''; bubble.classList.add('is-free'); return; }
      bubble.classList.remove('is-free');
      const top = Math.max(64, r.top + (-v.y * 0.5 + 0.5) * r.height);
      bubble.style.transform = `translate(${r.left + (v.x * 0.5 + 0.5) * r.width}px, ${top}px) translate(-50%, -100%)`;
    },
    get closed() { return closed; },
    close() { if (!closed) p.close(null); },
  };
}
const place = {};
