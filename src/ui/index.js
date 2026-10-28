// 트랙 T3: UI — HUD·대화창·알림·가방·섬폰·지도·상점·박물관을 ctx.uiRoot 안에 DOM 으로 만든다.
// ctx.services.ui 로 다른 모듈에 기능을 주고 (docs/CONTRACTS.md 'ui'), 다른 서비스는 있으면 쓰고 없으면 빈 화면을 보여준다.
import { h } from './dom.js';
import { createPanels, confirmBox } from './panels.js';
import { createHud, createToasts } from './hud.js';
import { createDialog } from './dialog.js';
import { createBag } from './bag.js';
import { createPhone } from './phone.js';
import { createMap } from './map.js';
import { createShop } from './shop.js';
import { createMuseum } from './museum.js';
import { createCraft } from './craft.js';

let dialog = null, hud = null;

function loadCss() {
  if (document.querySelector('link[data-pk-ui]')) return Promise.resolve();
  const link = h('link', { rel: 'stylesheet', href: new URL('./ui.css', import.meta.url).href, 'data-pk-ui': '' });
  const done = new Promise(res => { link.onload = link.onerror = res; setTimeout(res, 4000); });
  document.head.append(link);
  return done;
}

export default {
  name: 'ui',

  async init(ctx) {
    await loadCss();
    const { events, state } = ctx;
    state.settings ??= {};
    state.settings.keyHint ??= true;

    // 화면 층: HUD < 창 < 알림. 맨 앞에 넣어서 휴대폰 조이스틱(#touch-controls)이 늘 위에 있게 한다.
    const stackEl = h('div', { class: 'pk-stack' });
    const toasts = createToasts();
    const root = h('div', { class: `pk-root${ctx.input?.touch ? ' pk-touch' : ''}` });
    const panels = createPanels(ctx, stackEl);

    const toast = (text, icon) => toasts.push(text, icon);
    const setSetting = (key, value) => {
      state.settings[key] = value;
      if (key === 'keyHint') hud.showHint(value);
      if (['bgm', 'sfx', 'voice'].includes(key)) ctx.services.audio?.setVolume?.(key, value);
      events.emit('settings:changed', { key, value, settings: state.settings });
    };

    const bag = createBag(ctx, panels);
    const map = createMap(ctx, panels);
    const phone = createPhone(ctx, panels, { openBag: o => bag.open(o), openMap: () => map.open(), toast, setSetting });
    const shop = createShop(ctx, panels, { bag, toast });
    const museum = createMuseum(ctx, panels, { bag, toast });
    const craft = createCraft(ctx, panels, { toast });
    // 화면 전환 막 (집·건물 드나들 때): HUD 위, 창·알림 아래
    const fadeEl = h('div', { class: 'pk-fade', 'aria-hidden': 'true' });
    const fade = (on = true, sec = 0.3, color) => new Promise(res => {
      if (color) fadeEl.style.background = color;
      fadeEl.style.transitionDuration = `${Math.max(0, sec)}s`;
      fadeEl.classList.toggle('is-on', !!on);
      setTimeout(res, Math.max(0, sec) * 1000 + 30);
    });
    dialog = createDialog(ctx, panels);
    hud = createHud(ctx, { openBag: () => bag.open({ mode: 'view' }), openPhone: () => phone.open(), openMap: () => map.open(), setHint: v => setSetting('keyHint', v) });
    hud.showHint(state.settings.keyHint !== false);

    root.append(hud.root, fadeEl, stackEl, toasts.root);
    ctx.uiRoot.prepend(root);

    // 바쁠 때(창·대화) HUD 일부를 접는다
    events.on('ui:open', () => root.classList.add('is-busy'));
    events.on('ui:close', () => root.classList.toggle('is-busy', panels.isOpen()));

    // HUD 갱신
    events.on('time:tick', ({ now } = {}) => hud.tick(now));
    events.on('weather:change', ({ weather } = {}) => hud.setWeather(weather));
    events.on('wallet:changed', ({ acorns } = {}) => hud.setAcorns(acorns));
    events.on('player:tool', ({ tool } = {}) => hud.setTool(tool));
    events.on('inventory:changed', () => bag.refresh());
    events.on('toast', ({ text, icon } = {}) => toast(text, icon));

    // 키·버튼 의도로 창 열기 (창이 열려 있을 땐 panels 가 키를 먼저 받으므로 여기 오지 않는다)
    events.on('input:press', ({ intent } = {}) => {
      if (panels.blocking()) return;
      if (intent === 'bag') bag.open({ mode: 'view' });
      else if (intent === 'phone') phone.open();
      else if (intent === 'map') map.open();
    });
    // H: 키 안내 접기·펴기 (게임 의도 키가 아니라서 core/input 과 겹치지 않는다)
    addEventListener('keydown', e => {
      if (e.code !== 'KeyH' || e.repeat || panels.blocking() || e.target.closest?.('input, textarea, select')) return;
      setSetting('keyHint', state.settings.keyHint === false);
    });

    ctx.services.ui = {
      hud: {
        setClock: now => hud.setClock(now),
        setAcorns: n => hud.setAcorns(n),
        setTool: id => hud.setTool(id),
        show: (on = true) => hud.show(on),
      },
      dialog: { open: opts => dialog.open(opts) },
      toast,
      bag: { open: opts => bag.open(opts) },
      phone: { open: () => phone.open() },
      map: { open: () => map.open() },
      shop: { open: opts => shop.open(opts) },
      museum: { open: opts => museum.open(opts) },
      craft: { open: opts => craft.open(opts) },   // 작업대 창 → Promise<만든 레시피 id 들>
      fade,                                        // fade(on, 초, 색?) → Promise (화면 전환 막)
      confirm: opts => confirmBox(panels, opts),   // 계약 밖 추가: 예/아니요 확인 창 → Promise<value>
      isBlocking: () => panels.blocking(),
    };
  },

  update(dt) {
    dialog?.update(dt);
    hud?.update();
  },
};
