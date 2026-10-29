// 장면 화면 층 (DOM): 위아래 검은 띠·자막·건너뛰기, 이모티콘 말풍선, 고르기 단추, 넘기기 표시, 사진 틀, 화면 막.
// 게임 ui 모듈과 따로 자기 DOM 을 쓴다 (ui 층 맨 위). 모양은 story.css.

const CSS = new URL('./story.css', import.meta.url).href;

export function createLayer(ctx) {
  if (!document.querySelector(`link[data-story-css]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = CSS; l.dataset.storyCss = '';
    document.head.append(l);
  }
  const h = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const root = h('div', 'st-root');
  root.setAttribute('aria-live', 'polite');
  const fadeEl = h('div', 'st-fade');
  const top = h('div', 'st-bar st-top');
  const bottom = h('div', 'st-bar st-bottom');
  const cap = h('p', 'st-caption');
  const skipBtn = h('button', 'st-skip', '건너뛰기 <kbd>Esc</kbd>');
  skipBtn.type = 'button';
  const tap = h('div', 'st-tap', '▶');
  const bubbles = h('div', 'st-bubbles');
  const choice = h('div', 'st-choice');
  const photo = h('div', 'st-photo', '<div class="st-photo-frame"></div><p class="st-photo-cap"></p>');
  bottom.append(cap, tap, skipBtn);
  root.append(bubbles, photo, top, bottom, choice, fadeEl);
  ctx.uiRoot.append(root);

  const marks = new Map();       // 배우 → 말풍선
  const v = new ctx.THREE.Vector3();
  let onSkip = () => {}, onTap = () => {};
  skipBtn.addEventListener('click', e => { e.stopPropagation(); onSkip(); });
  root.addEventListener('click', e => { if (!e.target.closest('.st-choice, .st-skip')) onTap(); });

  // 고르기
  let pick = null, sel = 0, btns = [];
  function selectBtn(k) { sel = (k + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle('is-sel', i === sel)); btns[sel]?.focus({ preventScroll: true }); }
  addEventListener('keydown', e => {
    if (!pick) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); selectBtn(sel - 1); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); selectBtn(sel + 1); }
    else if (/^Digit[1-4]$/.test(e.code)) { const k = Number(e.code.slice(5)) - 1; if (k < btns.length) { e.preventDefault(); done(k); } }
    else if (e.code === 'Enter') { e.preventDefault(); done(sel); }
  });
  function done(k) {
    const p = pick;
    if (!p) return;
    pick = null;
    choice.classList.remove('is-on');
    choice.innerHTML = '';
    p(k);
  }

  return {
    begin() { root.classList.add('is-on'); },
    end() { root.classList.remove('is-on'); this.clearBubbles(); },
    fade(a, color) { fadeEl.style.opacity = String(a); fadeEl.style.background = color; },
    caption(text) { cap.textContent = text; cap.hidden = !text; },
    tapHint(on) { tap.classList.toggle('is-on', !!on); },
    onSkip(fn) { onSkip = fn; },
    onTap(fn) { onTap = fn; },
    bubble(who, emote, text) {
      let b = marks.get(who);
      if (!b) { b = h('div', 'st-bubble', '<span class="st-emo"></span><span class="st-txt"></span>'); marks.set(who, b); bubbles.append(b); }
      b.querySelector('.st-emo').textContent = emote;
      const t = b.querySelector('.st-txt');
      t.textContent = text; t.hidden = !text;
      b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
      b.hidden = false;
    },
    clearBubbles() { for (const b of marks.values()) b.hidden = true; },
    /** 말풍선을 배우 머리 위 화면 자리로 */
    place(who, pos, height, camera) {
      const b = marks.get(who);
      if (!b || b.hidden) return;
      v.set(pos.x, pos.y + height * 1.12 + 0.12, pos.z).project(camera);
      const r = ctx.renderer.domElement.getBoundingClientRect();
      const off = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      b.style.visibility = off ? 'hidden' : '';
      b.style.transform = `translate(${r.left + (v.x * 0.5 + 0.5) * r.width}px, ${r.top + (-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`;
    },
    /** 이모티콘 고르기 → Promise<순번> */
    choose(emotes) {
      return new Promise(res => {
        pick = res;
        choice.innerHTML = '';
        btns = emotes.map((e, i) => {
          const b = h('button', 'st-opt');
          b.type = 'button';
          b.textContent = e;
          b.setAttribute('aria-label', `${i + 1}번 ${e}`);
          b.addEventListener('click', ev => { ev.stopPropagation(); done(i); });
          choice.append(b);
          return b;
        });
        choice.classList.add('is-on');
        selectBtn(0);
      });
    },
    confirmChoice() { done(sel); },
    cancelChoice() { done(0); },
    photo(on, caption = '') {
      photo.classList.toggle('is-on', !!on);
      photo.querySelector('.st-photo-cap').textContent = caption;
      root.classList.toggle('is-photo', !!on);
    },
  };
}
