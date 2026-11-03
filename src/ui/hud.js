// HUD: 왼쪽 위 시계·날짜·날씨, 오른쪽 위 도토리와 메뉴 단추, 오른쪽 아래 지금 든 도구, 왼쪽 아래 키 안내,
// 아래 가운데 '지금 Space·F 를 누르면' 안내 (키보드만 — 휴대폰은 A·B 버튼 글자가 바뀐다).
import { h, fmt, clockText, nowFromDate, toolSvg, TOOL_NAME, WEATHER_ICON, WEATHER_NAME, iconEl } from './dom.js';

const HINT_KEYS = [['WASD', '이동'], ['클릭', '그 자리로'], ['Shift', '달리기'], ['Space', '행동'], ['F', '줍기'], ['Q/E', '도구'], ['I', '가방'], ['P', '섬폰'], ['M', '지도'], ['H', '안내 숨기기']];

export function createHud(ctx, { openBag, openPhone, openMap, openTools, setHint }) {
  const time = h('b', { class: 'pk-clock-time' });
  const date = h('span', { class: 'pk-clock-date' });
  const wx = h('span', { class: 'pk-clock-wx', role: 'img' });
  const clock = h('div', { class: 'pk-bubble pk-clock' }, time, h('span', { class: 'pk-clock-row' }, date, wx));

  const acornN = h('span', { class: 'pk-acorns-n' }, '0');
  const acorns = h('div', { class: 'pk-bubble pk-acorns' }, h('span', { 'aria-hidden': 'true' }, '🌰'), acornN);
  acorns.addEventListener('animationend', () => acorns.classList.remove('is-bump'));

  const quick = (icon, label, key, fn) => h('button', { type: 'button', class: 'pk-quick-btn', 'aria-label': `${label} 열기 (${key})`, title: `${label} (${key})`, onclick: () => fn() },
    h('span', { 'aria-hidden': 'true' }, icon), h('kbd', { class: 'pk-quick-key', 'aria-hidden': 'true' }, key));
  const quickRow = h('nav', { class: 'pk-quick', 'aria-label': '메뉴' }, quick('🎒', '가방', 'I', openBag), quick('📱', '섬폰', 'P', openPhone), quick('🗺️', '지도', 'M', openMap));

  // 도구 단추: 누르면 도구 고르기 고리 (없으면 다음 도구 — 키보드 E 와 같다)
  const toolRing = h('span', { class: 'pk-tool-ring' });
  const toolName = h('span', { class: 'pk-tag pk-tool-name' });
  const tool = h('button', { type: 'button', class: 'pk-tool', onclick: () => (openTools ? openTools() : ctx.input.press?.('toolNext')) }, toolRing, toolName);

  const hint = h('div', { class: 'pk-hint', role: 'note', 'aria-label': '키 안내' },
    h('span', { class: 'pk-hint-keys' }, HINT_KEYS.map(([k, t]) => h('span', { class: 'pk-hint-item' }, h('kbd', null, k), t))),
    h('button', { type: 'button', class: 'pk-hint-x', 'aria-label': '키 안내 숨기기', onclick: () => setHint(false) }, '✕'));

  // 지금 누르면 할 일: 빈 글자면 그 키는 숨긴다. 사라질 때는 글자를 남긴 채 흐려지게 해서 깜빡이지 않는다
  const actItem = key => { const t = h('span', { class: 'pk-act-text' }); return { t, el: h('span', { class: 'pk-act-item', hidden: true }, h('kbd', null, key), t) }; };
  const act = { action: actItem('Space'), pickup: actItem('F') };
  const actRoot = h('div', { class: 'pk-act', 'aria-hidden': 'true' }, act.action.el, act.pickup.el);

  const root = h('div', { class: 'pk-hud' }, clock, h('div', { class: 'pk-top-right' }, acorns, quickRow), tool, hint, actRoot);

  let lastAcorns = null, gotTick = false, lastMinute = -1;
  const api = {
    root,
    setClock(now) {
      if (!now) return;
      const t = clockText(now);
      time.textContent = t.time;
      date.textContent = t.date;
      clock.setAttribute('aria-label', `${t.time}, ${t.date}`);
    },
    setWeather(w) {
      wx.hidden = !w;
      wx.textContent = WEATHER_ICON[w] ?? '';
      wx.setAttribute('aria-label', WEATHER_NAME[w] ?? '');
    },
    setAcorns(n) {
      const v = Number(n) || 0;
      acornN.textContent = fmt(v);
      acorns.setAttribute('aria-label', `도토리 ${fmt(v)}개`);
      if (lastAcorns != null && v !== lastAcorns) { acorns.classList.remove('is-bump'); void acorns.offsetWidth; acorns.classList.add('is-bump'); }
      lastAcorns = v;
    },
    setTool(id) {
      const key = id && TOOL_NAME[id] ? id : 'none';
      toolRing.innerHTML = toolSvg(key);
      toolName.textContent = TOOL_NAME[key];
      tool.setAttribute('aria-label', `지금 든 도구: ${TOOL_NAME[key]}. 눌러서 도구 고르기`);
      tool.classList.remove('is-swap'); void tool.offsetWidth; tool.classList.add('is-swap');
    },
    show(on = true) { root.hidden = !on; },
    /** labels = { action, pickup } (빈 값·null = 그 키로 할 일 없음). 바뀐 것만 고친다 */
    setActions(labels = {}) {
      let any = false;
      for (const k of ['action', 'pickup']) {
        const text = labels[k] || '';
        if (!text) continue;
        any = true;
        if (act[k].t.textContent !== text) act[k].t.textContent = text;
      }
      if (!any) { actRoot.classList.remove('is-on'); return; }
      for (const k of ['action', 'pickup']) act[k].el.hidden = !labels[k];
      actRoot.classList.add('is-on');
    },
    showHint(on) { hint.hidden = !on; },
    /** time:tick 을 받으면 그 값을 쓰고, time 서비스가 없으면 브라우저 시계로 분마다 바꾼다 */
    tick(now) { gotTick = true; api.setClock(now); },
    update() {
      if (gotTick || ctx.services.time) return;
      const d = new Date();
      if (d.getMinutes() !== lastMinute) { lastMinute = d.getMinutes(); api.setClock(nowFromDate(d)); }
    },
  };

  // 처음 값
  const t = ctx.services.time;
  api.setClock(t?.now?.() ?? nowFromDate());
  api.setWeather(t?.weather ?? null);
  api.setAcorns(ctx.services.data?.wallet?.get?.() ?? ctx.state.wallet?.acorns ?? 0);
  api.setTool(ctx.services.player?.tool ?? ctx.state.player?.tool ?? null);
  tool.classList.remove('is-swap');
  return api;
}

/** 알림 줄: 한 번에 3개까지, 나머지는 줄을 선다 */
export function createToasts() {
  const root = h('div', { class: 'pk-toasts', role: 'status', 'aria-live': 'polite' });
  const queue = [];
  let showing = 0;
  const MAX = 3, SHOW_MS = 2600, OUT_MS = 280;
  function pump() {
    while (showing < MAX && queue.length) {
      const { text, icon } = queue.shift();
      showing++;
      const el = h('div', { class: 'pk-toast' }, icon && iconEl(icon, 'pk-toast-icon'), h('span', null, text));
      root.append(el);
      setTimeout(() => {
        el.classList.add('is-out');
        setTimeout(() => { el.remove(); showing--; pump(); }, OUT_MS);
      }, SHOW_MS);
    }
  }
  return {
    root,
    push(text, icon) { if (text == null || text === '') return; queue.push({ text: String(text), icon }); pump(); },
  };
}
