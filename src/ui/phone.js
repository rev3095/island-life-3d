// 섬폰: 도감·지도·레시피·가방·설정·저장 앱. 앱 화면에서 Esc(B) 는 첫 화면으로, 첫 화면에서는 닫기.
import { h, fmt, itemInfo, iconEl, recipeNeeds, clockText, nowFromDate, CATEGORY_NAME, DEX_CATEGORIES } from './dom.js';
import { panelShell, gridMove, button } from './panels.js';

const APPS = [
  { id: 'dex', name: '도감', icon: '📖', color: '#9ED3A8' },
  { id: 'map', name: '지도', icon: '🗺️', color: '#9CCBE8' },
  { id: 'recipes', name: '레시피', icon: '🔨', color: '#F3C77E' },
  { id: 'bag', name: '가방', icon: '🎒', color: '#F2A99B' },
  { id: 'settings', name: '설정', icon: '⚙️', color: '#D8D0BE' },
  { id: 'save', name: '저장', icon: '💾', color: '#C8B6E2' },
];
const GREETING = { dawn: '좋은 새벽이에요', day: '좋은 하루예요', dusk: '노을이 예뻐요', night: '포근한 밤이에요' };

export function createPhone(ctx, panels, { openBag, openMap, toast, setSetting }) {
  let current = null;

  function open() {
    if (current) return current.p.result;
    let p, screen = 'home', lastApp = null;
    const shell = panelShell({ cls: 'pk-phone', label: '섬폰', onOutside: () => p.close(null) });
    shell.head.remove();
    const status = h('div', { class: 'pk-phone-status', 'aria-hidden': 'true' });
    const top = h('div', { class: 'pk-phone-top' });
    const view = h('div', { class: 'pk-phone-view' });
    shell.body.append(status, top, view);
    shell.foot.append(h('button', { type: 'button', class: 'pk-phone-home', 'aria-label': '섬폰 닫기', onclick: () => p.cancel() }));

    function setStatus() {
      const now = ctx.services.time?.now?.() ?? nowFromDate();
      const acorns = ctx.services.data?.wallet?.get?.() ?? ctx.state.wallet?.acorns ?? 0;
      status.replaceChildren(h('span', null, clockText(now).time), h('span', null, `🌰 ${fmt(acorns)}`));
    }

    function go(id) {
      screen = id;
      view.replaceChildren();
      view.className = `pk-phone-view is-${id}`;
      if (id === 'home') {
        const now = ctx.services.time?.now?.();
        top.replaceChildren(h('h2', { class: 'pk-phone-title', id: shell.titleId }, '섬폰'),
          h('p', { class: 'pk-phone-greet' }, GREETING[now?.part] ?? '오늘도 포근한 섬이에요'));
        const grid = h('div', { class: 'pk-apps' }, APPS.map(a => h('button', { type: 'button', class: 'pk-app', dataset: { app: a.id }, onclick: () => launch(a.id) },
          h('i', { style: { background: a.color }, 'aria-hidden': 'true' }, a.icon), h('span', null, a.name))));
        view.append(grid);
        const target = grid.querySelector(`[data-app="${lastApp}"]`) ?? grid.firstElementChild;
        target.focus({ preventScroll: true });
        return;
      }
      const app = APPS.find(a => a.id === id);
      top.replaceChildren(h('button', { type: 'button', class: 'pk-back', 'aria-label': '첫 화면으로', onclick: () => go('home') }, '‹'),
        h('h2', { class: 'pk-phone-title', id: shell.titleId }, h('span', { 'aria-hidden': 'true' }, app.icon), ` ${app.name}`));
      ({ dex: dexScreen, recipes: recipeScreen, settings: settingsScreen, save: saveScreen })[id]?.(view);
      (view.querySelector('[data-autofocus]') ?? view.querySelector('button, input') ?? top.querySelector('.pk-back')).focus({ preventScroll: true });
      ctx.events.emit('sfx', { name: 'menu' });
    }

    function launch(id) {
      if (p.fresh()) return;
      lastApp = id;
      if (id === 'map') return void openMap();
      if (id === 'bag') return void openBag({ mode: 'view' });
      go(id);
    }

    shell.card.setAttribute('aria-labelledby', shell.titleId);
    p = panels.open('phone', shell.root, {
      toggleKey: 'KeyP',
      initialFocus: () => view.querySelector('.pk-app'),
      onCancel: () => (screen === 'home' ? p.close(null) : go('home')),
      onKey(e) {
        if (screen === 'home' && e.target.closest?.('.pk-app')) return gridMove([...view.querySelectorAll('.pk-app')], 3, e.code);
        if (screen === 'dex' && e.target.closest?.('[role="tab"]') && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
          const tabs = [...view.querySelectorAll('[role="tab"]')];
          const i = tabs.indexOf(e.target) + (e.code === 'ArrowLeft' ? -1 : 1);
          tabs[(i + tabs.length) % tabs.length].click();
          return true;
        }
        return false;
      },
      onClose: () => { offs.forEach(f => f()); current = null; },
    });
    const offs = [ctx.events.on('time:tick', setStatus), ctx.events.on('wallet:changed', setStatus)];
    current = { p };
    setStatus();
    go('home');
    ctx.events.emit('sfx', { name: 'menu' });
    return p.result;
  }

  // ---------- 도감 ----------
  function dexScreen(view) {
    const data = ctx.services.data;
    let cat = 'fish';
    const tabs = h('div', { class: 'pk-tabs', role: 'tablist', 'aria-label': '도감 종류' });
    const panel = h('div', { class: 'pk-dex', role: 'tabpanel', tabindex: '0' });
    view.append(tabs, panel);
    if (!data?.items?.list) {
      tabs.remove();
      panel.append(notice('📖', '도감 정보를 아직 불러올 수 없어요.', '데이터(data) 모듈이 연결되면 잡은 물고기·곤충·화석이 여기에 모여요.'));
      return;
    }
    const caughtOf = c => new Set([...(ctx.state.encyclopedia?.[c] ?? []), ...(ctx.state.museum?.[c] ?? [])]);
    function draw() {
      const all = data.items.list(cat) ?? [];
      const caught = caughtOf(cat);
      const prog = data.museum?.progress?.()?.[cat];
      const donated = prog?.[0] ?? all.filter(it => data.museum?.has?.(it.id)).length;
      const total = prog?.[1] ?? all.length;
      const nCaught = all.filter(it => caught.has(it.id)).length;
      tabs.replaceChildren(...DEX_CATEGORIES.map(c => h('button', {
        type: 'button', role: 'tab', class: 'pk-tab', 'aria-selected': String(c === cat), tabindex: c === cat ? '0' : '-1',
        onclick: () => { cat = c; draw(); tabs.querySelector('[aria-selected="true"]')?.focus(); },
      }, CATEGORY_NAME[c])));
      panel.replaceChildren(
        bar(cat === 'fossil' ? '찾은 것' : '잡은 것', nCaught, all.length),
        bar('기증', donated, total),
        h('ul', { class: 'pk-dex-grid', 'aria-label': `${CATEGORY_NAME[cat]} 목록` }, all.map(it => {
          const got = caught.has(it.id);
          const gave = data.museum?.has?.(it.id);
          return h('li', { class: `pk-dex-cell${got ? '' : ' is-unknown'}`, title: got ? it.name : '아직 못 만났어요' },
            got ? iconEl(it.icon, 'pk-dex-icon') : h('span', { class: 'pk-dex-icon', 'aria-hidden': 'true' }, '?'),
            h('span', { class: 'pk-dex-name' }, got ? it.name : '???'),
            gave && h('span', { class: 'pk-dex-gave', title: '기증함', 'aria-label': '기증함' }, '🏛️'));
        })),
      );
    }
    draw();
  }

  // ---------- 레시피 ----------
  function recipeScreen(view) {
    const data = ctx.services.data;
    const list = data?.recipes?.list?.();
    if (!list) { view.append(notice('🔨', '레시피를 아직 불러올 수 없어요.', '데이터(data) 모듈이 연결되면 배운 레시피가 여기에 보여요.')); return; }
    if (!list.length) { view.append(notice('🔨', '아직 배운 레시피가 없어요.', '주민에게 얘기를 들어 보세요.')); return; }
    view.append(h('p', { class: 'pk-muted pk-small' }, '만들기는 집의 작업대에서 해요.'),
      h('ul', { class: 'pk-recipes', tabindex: '0', 'aria-label': '레시피 목록' }, list.map(r => {
        const out = itemInfo(ctx, r.result ?? r.id);
        const mats = recipeNeeds(ctx, r);
        const can = data.recipes.canCraft?.(r.id);
        return h('li', { class: `pk-recipe${can ? ' is-can' : ''}` },
          iconEl(r.icon ?? out.icon, 'pk-recipe-icon'),
          h('div', null, h('b', null, r.name ?? out.name), can && h('span', { class: 'pk-badge' }, '만들 수 있어요'),
            h('ul', { class: 'pk-mats' }, mats.map(m => h('li', { class: m.have >= m.n ? 'is-ok' : '' }, iconEl(m.icon), `${m.name} ${Math.min(m.have, m.n)}/${m.n}`)))));
      })));
  }

  // ---------- 설정 ----------
  function settingsScreen(view) {
    const s = ctx.state.settings;
    const slider = (key, label) => {
      const id = `pk-set-${key}`;
      const out = h('output', { for: id, class: 'pk-range-val' }, `${Math.round((s[key] ?? 0) * 100)}%`);
      const input = h('input', { type: 'range', id, min: '0', max: '100', step: '5', value: String(Math.round((s[key] ?? 0) * 100)), class: 'pk-range' });
      input.addEventListener('input', () => { out.textContent = `${input.value}%`; setSetting(key, Number(input.value) / 100); });
      return h('div', { class: 'pk-set-row' }, h('label', { for: id }, label), input, out);
    };
    const toggle = (key, label, fallback = true) => {
      const b = h('button', { type: 'button', role: 'switch', class: 'pk-switch', 'aria-checked': String(s[key] ?? fallback) }, h('span', { class: 'pk-switch-knob' }));
      b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); setSetting(key, v); });
      const id = `pk-set-${key}`;
      b.setAttribute('aria-labelledby', id);
      return h('div', { class: 'pk-set-row' }, h('span', { id }, label), b);
    };
    const time = ctx.services.time;
    const timeRow = h('div', { class: 'pk-seg', role: 'group', 'aria-label': '시간 흐름' });
    const drawTime = () => {
      const mode = time?.mode ?? ctx.state.time?.mode ?? 'real';
      timeRow.replaceChildren(...[['real', '실제 시간'], ['fast', '빠른 시간']].map(([m, t]) => h('button', {
        type: 'button', class: 'pk-seg-btn', 'aria-pressed': String(mode === m), disabled: !time?.setMode,
        onclick: () => { time.setMode(m); drawTime(); timeRow.querySelector('[aria-pressed="true"]')?.focus(); toast(m === 'fast' ? '빠른 시간: 1분이 1시간이에요' : '실제 시계와 같이 흘러요', '⏰'); },
      }, t)));
    };
    drawTime();
    // 화면 모습 (스타일 셰이더 프리셋): 고른 값은 state.settings.style 로 저장되고 render 가 settings:changed 로 따라간다
    const style = ctx.services.style;
    const styleRow = h('div', { class: 'pk-seg', role: 'group', 'aria-label': '화면 모습' });
    const drawStyle = () => {
      const cur = style?.preset ?? s.style ?? 'cozy';
      styleRow.replaceChildren(...[['cozy', '포근'], ['toon', '툰 (예전)']].map(([m, t]) => h('button', {
        type: 'button', class: 'pk-seg-btn', 'aria-pressed': String(cur === m), disabled: !style,
        onclick: () => { setSetting('style', m); drawStyle(); styleRow.querySelector('[aria-pressed="true"]')?.focus(); },
      }, t)));
    };
    drawStyle();
    view.append(...[
      h('h3', { class: 'pk-set-head' }, '소리'), slider('bgm', '배경음'), slider('sfx', '효과음'), slider('voice', '목소리'),
      h('h3', { class: 'pk-set-head' }, '시간'), timeRow,
      !time?.setMode && h('p', { class: 'pk-muted pk-small' }, '시간(sky) 모듈이 연결되면 바꿀 수 있어요.'),
      h('h3', { class: 'pk-set-head' }, '화면'), style && styleRow, toggle('outline', '외곽선'), fullscreenRow(),
      !ctx.input?.touch && toggle('keyHint', '키 안내 보기'),   // 휴대폰엔 키 안내가 없다
    ].filter(Boolean));
  }

  /** 전체 화면 (휴대폰에서 주소창을 숨긴다). 브라우저·아티팩트 틀이 막으면 줄을 안 보인다. 저장하지 않는다 */
  function fullscreenRow() {
    const de = document.documentElement;
    if (!document.fullscreenEnabled || !de.requestFullscreen) return null;
    const b = h('button', { type: 'button', role: 'switch', class: 'pk-switch', 'aria-checked': String(!!document.fullscreenElement), 'aria-labelledby': 'pk-set-fullscreen' }, h('span', { class: 'pk-switch-knob' }));
    b.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await de.requestFullscreen({ navigationUI: 'hide' });
      } catch { toast('전체 화면으로 바꾸지 못했어요', '📱'); }
      b.setAttribute('aria-checked', String(!!document.fullscreenElement));
    });
    return h('div', { class: 'pk-set-row' }, h('span', { id: 'pk-set-fullscreen' }, '전체 화면'), b);
  }

  // ---------- 저장 ----------
  function saveScreen(view) {
    const result = h('p', { class: 'pk-save-result', 'aria-live': 'polite' });
    const go = button('저장하기', { primary: true, 'data-autofocus': '', onclick: async () => {
      const save = ctx.services.data?.save?.save;
      if (!save) { result.textContent = '저장 기능이 아직 연결되지 않았어요.'; toast('저장 기능이 아직 없어요', '💾'); return; }
      go.disabled = true;
      let ok;
      try { ok = (await save()) !== false; } catch { ok = false; }
      go.disabled = false;
      go.focus();
      const now = clockText(ctx.services.time?.now?.() ?? nowFromDate());
      result.textContent = ok ? `${now.date} ${now.time}에 저장했어요.` : '저장하지 못했어요. 다시 해 볼까요?';
      toast(ok ? '저장했어요!' : '저장하지 못했어요', ok ? '💾' : '⚠️');
      ctx.events.emit('sfx', { name: 'menu' });
    } });
    // 웹 링크(아티팩트)에서는 저장이 이 기기의 이 브라우저에만 남고, 저장소가 막힌 창이면 아예 안 된다 (X4)
    const canSave = ctx.services.data?.save?.available !== false;
    view.append(h('div', { class: 'pk-save' }, h('div', { class: 'pk-save-icon', 'aria-hidden': 'true' }, '💾'),
      h('p', null, '지금까지의 섬 생활을 저장할까요?'), go, result,
      h('p', { class: 'pk-muted pk-small' }, canSave ? '진행은 이 기기의 이 브라우저에만 저장돼요.' : '이 창에서는 저장할 수 없어요. 닫으면 처음부터 다시 시작해요.')));
  }

  return { open };
}

function bar(label, n, total) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return h('div', { class: 'pk-bar' },
    h('span', { class: 'pk-bar-label' }, label),
    h('span', { class: 'pk-bar-track', role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(n) },
      h('span', { class: 'pk-bar-fill', style: { width: `${pct}%` } })),
    h('span', { class: 'pk-bar-num' }, `${n} / ${total}`));
}

export function notice(icon, title, sub) {
  return h('div', { class: 'pk-notice' }, h('div', { class: 'pk-notice-icon', 'aria-hidden': 'true' }, icon), h('p', null, title), sub && h('p', { class: 'pk-muted pk-small' }, sub));
}
export { bar };
