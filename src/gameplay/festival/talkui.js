// 이모티콘 대화 화면 (UI-04): 주민 머리 위 말풍선 + 화면 아래 선택기(묶음 탭 6 · 격자 · 보낼 칸 3 · 보내기 · 닫기).
// ui 의 창 쌓기(ctx.services.ui.panel)로 열어서 창이 열린 동안 게임 입력이 막히고, 키·A/B 버튼이 이 창으로 온다.
// 글자는 화면에 쓰지 않는다 — 단추마다 이름(aria-label), 말풍선 내용은 스크린리더용 줄에만.
// 단, 섬폰 「보기 편하게」의 '이모티콘 뜻 보기'(7차 UI-10, <html class="pk-emote-words">)를 켜면 뜻 글자(.fe-word)가 보인다.
const CSS = new URL('./festival.css', import.meta.url).href;
const MAX = 3;
const INK = '#4A3B32';
/** 보내기(종이비행기) · 기다리기(모래시계) · 잘 가(열린 문 + 나가는 화살표, QA-12: 인사 탭의 손 흔들기와 헷갈리지 않게) */
const ICON = {
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 L20 5 L15 19 L12 13z" fill="currentColor"/></svg>',
  wait: `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/></g></svg>`,
  bye: `<svg viewBox="0 0 48 48" aria-hidden="true" class="fe-emo"><g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><path d="M9 42 V7 h20 v35" fill="#F3E0BC"/><path d="M9 7 l13 5 v34 l-13 -4z" fill="#C98F55"/><circle cx="18.5" cy="27" r="1.6" fill="${INK}"/><path d="M31 25 h12 M38 19 l6 6 -6 6" fill="none"/></g></svg>`,
};

export function ensureCss() {
  if (document.querySelector('link[data-festival-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = CSS; l.dataset.festivalCss = '';
  document.head.append(l);
}

/** 뜻 글자 줄 (보기 편하게를 켰을 때만 css 가 보인다). 화면 읽기는 aria-label 이 있으니 숨긴다 */
const word = text => { const w = el('span', 'fe-word', { 'aria-hidden': 'true' }); w.textContent = text; return w; };

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
  const words = el('p', 'fe-bubble-words', { 'aria-hidden': 'true' });
  const next = el('span', 'fe-next', { 'aria-hidden': 'true' });
  next.textContent = '▼';
  const live = el('p', 'fe-sr', { 'aria-live': 'polite' });
  const meter = el('p', 'fe-meter');   // 하트 칸 (7차 D54-A: 마음 열기까지 ♥ 22/30 · 🙂 1/2)
  meter.hidden = true;
  bubble.append(nameTag, emos, words, meter, next, live);

  const dock = el('div', 'fe-dock');
  const choices = el('div', 'fe-choices', { role: 'group', 'aria-label': '대답 고르기' });
  const picker = el('div', 'fe-picker', { role: 'group', 'aria-label': '이모티콘으로 말하기' });
  const tabs = el('div', 'fe-tabs', { role: 'tablist', 'aria-label': '이모티콘 묶음' });
  const grid = el('div', 'fe-grid', { role: 'group', 'aria-label': '이모티콘 고르기' });
  const bar = el('div', 'fe-bar');
  const slotsEl = el('div', 'fe-slots', { role: 'group', 'aria-label': '보낼 이모티콘 (최대 3개)' });
  const sendBtn = el('button', 'fe-send', { type: 'button', 'aria-label': '보내기 (비우면 기다리기)' });
  const byeBtn = el('button', 'fe-bye', { type: 'button', 'aria-label': '잘 가 (대화 끝내기)' });
  byeBtn.innerHTML = ICON.bye;
  byeBtn.append(word('그만'));
  bar.append(slotsEl, sendBtn, byeBtn);
  picker.append(tabs, grid, bar);
  dock.append(choices, picker);
  const catch_ = el('div', 'fe-catch');
  root.append(catch_, bubble, dock);

  let mode = null, resolve = null, slots = [], tab = 0, extra = [], closed = false;
  const finish = v => { const r = resolve; resolve = null; mode = null; r?.(v); };

  // ---- 말풍선 ----
  function showBubble(toks, waiting, extra = '') {
    meter.textContent = extra;
    meter.hidden = !extra;
    emos.innerHTML = toks.map(t => tok(t, true)).join('');
    bubble.classList.toggle('is-wait', !!waiting);
    bubble.hidden = !toks.length;
    const text = emo.say(toks, items());
    live.textContent = `${who.name}: ${text}${extra ? ` (${extra})` : ''}`;
    words.textContent = text;
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
      b.append(word(c.name));
      b.addEventListener('click', () => { tab = i; drawTabs(); drawGrid(); });
      return b;
    }));
  }
  function drawGrid() {
    const cat = cats[tab]?.key;
    const list = [...new Set([...emo.player.filter(e => e.cat === cat).map(e => e.key), ...(cat === 'thing' ? extra : [])])];
    grid.replaceChildren(...list.map(k => {
      const name = String(k).startsWith('item:') ? emo.say([k], items()) : emo.name(k);
      const b = el('button', 'fe-cell', { type: 'button', 'aria-label': name });
      b.innerHTML = tok(k, false);
      b.append(word(name));
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
    // 비었을 때 = 기다리기: 색(파랑)만이 아니라 그림(모래시계)·글자도 바꾼다 (7차 UI-10 색만으로 구분 X)
    const wait = !slots.length;
    sendBtn.classList.toggle('is-wait', wait);
    sendBtn.innerHTML = wait ? ICON.wait : ICON.send;
    sendBtn.append(word(wait ? '기다리기' : '보내기'));
    sendBtn.setAttribute('aria-label', wait ? '기다리기 (아무것도 안 보내기)' : '보내기');
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
    /** 주민 말풍선을 보여 주고 넘길 때까지 기다린다. meter = 말풍선 아래 작은 글 (하트 칸) */
    say(toks, { meter: m = '' } = {}) {
      if (closed) return Promise.resolve(null);
      showBubble(toks, true, m);
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
        b.innerHTML = `<span class="fe-choice-emos">${o.map(t => tok(t, false)).join('')}</span>`;
        b.append(word(emo.say(o, items())));
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
