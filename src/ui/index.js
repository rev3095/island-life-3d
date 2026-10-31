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
import { createToolRing } from './toolring.js';
import { createTransfer } from './transfer.js';   // M7-P4: 저장 옮기기·문제 알리기 창 (여는 함수만 서비스로)
import { createReport } from './report.js';

let dialog = null, hud = null, uiCtx = null;
const PEEK_EVERY = 0.2;    // 행동 안내(A·B 글자, Space·F) 갱신 간격 (초)
let peekT = 0;

function loadCss() {
  if (document.querySelector('link[data-pk-ui]')) return Promise.resolve();
  const link = h('link', { rel: 'stylesheet', href: new URL('./ui.css', import.meta.url).href, 'data-pk-ui': '' });
  const done = new Promise(res => { link.onload = link.onerror = res; setTimeout(res, 4000); });
  document.head.append(link);
  return done;
}

/** 지금 행동 키를 누르면 할 일 → 휴대폰 A·B 글자와 키보드 Space·F 안내 (gameplay.interactions.peek) */
function showActions(ctx) {
  const peek = ctx.services.gameplay?.interactions?.peek;
  if (!peek) return;
  const labels = {};
  for (const intent of ['action', 'pickup']) {
    let r = null;
    try { r = peek(intent); } catch (e) { console.error('[ui] peek', e); }
    labels[intent] = r?.label ?? '';
  }
  ctx.input?.setLabels?.(labels);
  hud?.setActions(labels);
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
    const tools = createToolRing(ctx, panels);
    // 화면 전환 막 (집·건물 드나들 때): HUD 위, 창·알림 아래
    const fadeEl = h('div', { class: 'pk-fade', 'aria-hidden': 'true' });
    const fade = (on = true, sec = 0.3, color) => new Promise(res => {
      if (color) fadeEl.style.background = color;
      fadeEl.style.transitionDuration = `${Math.max(0, sec)}s`;
      fadeEl.classList.toggle('is-on', !!on);
      setTimeout(res, Math.max(0, sec) * 1000 + 30);
    });
    dialog = createDialog(ctx, panels);
    hud = createHud(ctx, { openBag: () => bag.open({ mode: 'view' }), openPhone: () => phone.open(), openMap: () => map.open(), openTools: () => tools.open(), setHint: v => setSetting('keyHint', v) });
    hud.showHint(state.settings.keyHint !== false);

    root.append(hud.root, fadeEl, stackEl, toasts.root);
    ctx.uiRoot.prepend(root);
    // 터치 화면 노트북처럼 나중에 손가락으로 만지면 core/input 이 패드를 만들고 알려 준다
    events.on('input:touch', () => root.classList.add('pk-touch'));

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

    // 저장이 안 되는 창·저장 실패: 한 번만 알린다 (섬폰 저장 앱이 열려 있으면 그쪽이 알린다)
    let saveWarned = false;
    const warnSave = () => {
      if (saveWarned) return;
      const save = ctx.services.data?.save;
      if (!save) return;
      saveWarned = true;
      if (save.available === false) toast('이 창에서는 저장할 수 없어요. 닫으면 처음부터 다시 시작해요', '⚠️');
      else if (save.blocked) toast('더 새 게임의 저장이 있어서 저장하지 않았어요', '⚠️');
      else toast('저장하지 못했어요. 저장 공간을 확인해 주세요', '⚠️');
    };
    events.on('save:done', ({ ok } = {}) => { if (ok === false && !panels.isOpen()) warnSave(); });
    events.once('game:ready', () => {
      if (ctx.services.data?.save?.available !== false) return;
      // 이름 정하기 창이 떠 있으면 다 정한 뒤에
      const later = () => setTimeout(warnSave, 1200);
      if (ctx.services.intro?.holding) events.once('intro:named', later);
      else later();
    });

    // 키·버튼 의도로 창 열기 (창이 열려 있을 땐 panels 가 키를 먼저 받으므로 여기 오지 않는다).
    // 서비스의 isBlocking 을 본다 — 스토리 장면이 감싸서 장면 동안 true (Esc 로 장면을 건너뛸 때 섬폰이 같이 열리던 것, QA)
    events.on('input:press', ({ intent } = {}) => {
      if (ctx.services.ui?.isBlocking?.() ?? panels.blocking()) return;
      if (intent === 'bag') bag.open({ mode: 'view' });
      else if (intent === 'phone') phone.open();
      else if (intent === 'map') map.open();
    });
    // H: 키 안내 접기·펴기 (게임 의도 키가 아니라서 core/input 과 겹치지 않는다)
    addEventListener('keydown', e => {
      if (e.code !== 'KeyH' || e.repeat || panels.blocking() || e.target.closest?.('input, textarea, select')) return;
      setSetting('keyHint', state.settings.keyHint === false);
    });

    uiCtx = ctx;
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
      tools: { open: () => tools.open() },         // 도구 고르기 고리 → Promise<{tool} | null>
      fade,                                        // fade(on, 초, 색?) → Promise (화면 전환 막)
      confirm: opts => confirmBox(panels, opts),   // 계약 밖 추가: 예/아니요 확인 창 → Promise<value>
      isBlocking: () => panels.blocking(),
      panel: (name, root, opts) => panels.open(name, root, opts),   // 5차 Z5: 다른 모듈이 자기 DOM 을 창으로 (이모티콘 대화)
    };
    Object.assign(ctx.services.ui, { transfer: createTransfer(ctx), report: createReport(ctx) });   // M7-P4: ui.transfer.open() · ui.report.open()
  },

  update(dt) {
    dialog?.update(dt);
    hud?.update();
    if (uiCtx && (peekT += dt) >= PEEK_EVERY) { peekT = 0; showActions(uiCtx); }
  },
};
