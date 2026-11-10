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
import { ACCESS_KEYS, resolveAccess, applyAccess, captionFor, createCaptions } from './access.js';

/**
 * 7차 M7-P4 가 만드는 창 (src/ui/transfer.js · report.js). 있으면 ui.transfer / ui.report 로 열고 섬폰에 줄이 생긴다, 없으면 건너뛴다.
 * 모듈 모양: `export function open(ctx, opts) → Promise` (또는 `export default { open(ctx, opts) }`).
 * 창은 ctx.services.ui.panel 로 연다. 모듈이 스스로 ctx.services.ui.<이름> 을 채워도 된다 (그때는 그것을 쓴다)
 */
export const EXTRA_PANELS = [['transfer', './transfer.js'], ['report', './report.js'], ['clock', './clock.js']];   // clock: 11차 시계 (p33-clock)

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
    // 보기 편하게 (UI-10): <html> 에 글자 배율·class 를 건다. 흔들림은 정하지 않으면 기기 설정을 따른다
    const calmMq = matchMedia('(prefers-reduced-motion: reduce)');
    let access = resolveAccess(state.settings, calmMq.matches);
    const captions = createCaptions(h);
    const refreshAccess = () => {
      access = resolveAccess(state.settings, calmMq.matches);
      applyAccess(access);
      if (!access.soundText) captions.clear();
    };
    calmMq.addEventListener?.('change', refreshAccess);
    refreshAccess();
    const setSetting = (key, value) => {
      state.settings[key] = value;
      if (ACCESS_KEYS.includes(key)) refreshAccess();
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
    // 화면 전환 막 (집·건물 드나들 때): HUD 위, 창·알림 아래.
    // shape 'circle' (실내 보드 UI-12): at = { x, y } (화면 px, 없으면 가운데) 둘레로 원이 좁아졌다가 커진다 — 구멍 하나에 큰 그림자를 둘러 덮는다
    const fadeEl = h('div', { class: 'pk-fade', 'aria-hidden': 'true' });
    const irisEl = h('div', { class: 'pk-iris', 'aria-hidden': 'true' }, h('i'));
    const fade = (on = true, sec = 0.3, color, { shape = 'plain', at = null } = {}) => new Promise(res => {
      const s = Math.max(0, sec), hole = irisEl.firstChild;
      if (shape === 'circle') {
        const r = root.getBoundingClientRect();
        const x = at?.x ?? r.width / 2, y = at?.y ?? r.height / 2;
        const open = `${Math.ceil(Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2 + 40)}px`;
        if (color) irisEl.style.color = color;
        hole.style.left = `${x}px`; hole.style.top = `${y}px`;
        if (on && !irisEl.classList.contains('is-on')) {   // 다 열린 원에서 시작
          hole.style.transitionDuration = '0s';
          hole.style.width = hole.style.height = open;
          irisEl.classList.add('is-on');
          void hole.offsetWidth;
        }
        fadeEl.style.transitionDuration = '0s';
        fadeEl.classList.remove('is-on');
        hole.style.transitionTimingFunction = on ? 'cubic-bezier(.55, 0, .8, .45)' : 'cubic-bezier(.2, .55, .45, 1)';
        hole.style.transitionDuration = `${s}s`;
        hole.style.width = hole.style.height = on ? '0px' : open;
        setTimeout(() => { if (!on) irisEl.classList.remove('is-on'); res(); }, s * 1000 + 30);
        return;
      }
      if (irisEl.classList.contains('is-on')) {   // 원으로 닫았다가 그냥 열 때: 같은 색 막으로 바꿔 끼운다
        fadeEl.style.transitionDuration = '0s';
        fadeEl.classList.add('is-on');
        irisEl.classList.remove('is-on');
        void fadeEl.offsetWidth;
      }
      if (color) fadeEl.style.background = color;
      fadeEl.style.transitionDuration = `${s}s`;
      fadeEl.classList.toggle('is-on', !!on);
      setTimeout(res, s * 1000 + 30);
    });
    dialog = createDialog(ctx, panels);
    hud = createHud(ctx, { openBag: () => bag.open({ mode: 'view' }), openPhone: () => phone.open(), openMap: () => map.open(), openTools: () => tools.open(), setHint: v => setSetting('keyHint', v) });
    hud.showHint(state.settings.keyHint !== false);

    root.append(hud.root, captions.root, fadeEl, irisEl, stackEl, toasts.root);
    ctx.uiRoot.prepend(root);
    // 소리 신호 글자: 켜 두었을 때만 sfx 를 자막으로 (장면·창이 열려 있어도 — 소리는 그대로 나니까)
    events.on('sfx', p => { if (access.soundText) captions.show(captionFor(p)); });
    // 저장을 불러오면 설정이 통째로 바뀐다 → 다시 건다
    events.on('data:loaded', refreshAccess);
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
      fade,                                        // fade(on, 초, 색?, { shape: 'plain'|'circle', at: {x, y} }?) → Promise (화면 전환 막)
      confirm: opts => confirmBox(panels, opts),   // 계약 밖 추가: 예/아니요 확인 창 → Promise<value>
      isBlocking: () => panels.blocking(),
      panel: (name, root, opts) => panels.open(name, root, opts),   // 5차 Z5: 다른 모듈이 자기 DOM 을 창으로 (이모티콘 대화)
      /** 7차 UI-10 보기 편하게: 지금 걸린 값 { textSize, scale, shapes, calm, emoteText, soundText } (camera 가 calm 을 본다) */
      get access() { return access; },
      setSetting,                                  // 7차: 설정 바꾸기 (state.settings + settings:changed) — 섬폰 밖에서 바꿀 때
    };
    // P4 창: 기다리지 않는다 (없으면 조용히 건너뛰고, 있으면 섬폰을 열 때 줄이 보인다)
    for (const [name, path] of EXTRA_PANELS) {
      import(path).then(mod => {
        const ui = ctx.services.ui;
        if (ui[name]?.open) return;                // 모듈이 스스로 채웠다
        const open = mod.open ?? mod.default?.open;
        if (typeof open === 'function') ui[name] = { open: opts => open(ctx, opts) };
      }).catch(() => { if (ctx.debug) console.info(`[ui] ${name} 창 없음 — 섬폰 줄 숨김`); });
    }
  },

  update(dt) {
    dialog?.update(dt);
    hud?.update();
    if (uiCtx && (peekT += dt) >= PEEK_EVERY) { peekT = 0; showActions(uiCtx); }
  },
};
