// 섬폰: 도감·지도·레시피·가방·설정·저장·보기 편하게 앱 (+ P4 의 저장 옮기기·문제 알리기 창이 있으면 그 줄). 앱 화면에서 Esc(B) 는 첫 화면으로, 첫 화면에서는 닫기.
import { h, fmt, itemInfo, iconEl, recipeNeeds, clockText, nowFromDate, CATEGORY_NAME, DEX_CATEGORIES } from './dom.js';
import { panelShell, gridMove, button } from './panels.js';
import { birthdayLabel, mmdd } from '../data/birthdays.js';
import { TEXT_SIZES } from './access.js';

/** panel = 섬폰 위에 따로 여는 창 (ctx.services.ui[panel].open) — 그 창이 없으면 줄을 숨긴다 */
export const APPS = [
  { id: 'dex', name: '도감', icon: '📖', color: '#9ED3A8' },
  { id: 'map', name: '지도', icon: '🗺️', color: '#9CCBE8' },
  { id: 'recipes', name: '레시피', icon: '🔨', color: '#F3C77E' },
  { id: 'bag', name: '가방', icon: '🎒', color: '#F2A99B' },
  { id: 'settings', name: '설정', icon: '⚙️', color: '#D8D0BE' },
  { id: 'save', name: '저장', icon: '💾', color: '#C8B6E2' },
  { id: 'access', name: '보기 편하게', icon: '👓', color: '#BFE0D8' },   // 7차 UI-10
  { id: 'guide', name: '안내', icon: '💡', color: '#F6E3A1', panel: 'guide' },   // 7차 M7-P5: 첫날 할 일·조작·지난 힌트 (창은 intro 가 ui.guide 로 채운다)
  { id: 'transfer', name: '저장 옮기기', icon: '📦', color: '#E8C9A0', panel: 'transfer' },   // 7차 UI-09 (M7-P4)
  { id: 'report', name: '문제 알리기', icon: '📮', color: '#F0B8B0', panel: 'report' },       // 7차 UI-08 (M7-P4)
];
/** 지금 보일 앱 (P4 창이 아직 없으면 그 줄을 뺀다) */
export const visibleApps = ui => APPS.filter(a => !a.panel || typeof ui?.[a.panel]?.open === 'function');
const GREETING = { dawn: '좋은 새벽이에요', day: '좋은 하루예요', dusk: '노을이 예뻐요', night: '포근한 밤이에요' };

export function createPhone(ctx, panels, { openBag, openMap, toast, setSetting }) {
  let current = null;
  /** 내 이름·섬 이름 (intro 가 없으면 state, 그것도 없으면 빈 칸) */
  const names = () => {
    const n = ctx.services.intro?.names?.();
    return { player: ctx.state.player?.name || n?.player || '', island: ctx.state.island?.name || n?.island || '' };
  };

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
        const me = names();
        top.replaceChildren(h('h2', { class: 'pk-phone-title', id: shell.titleId }, '섬폰'),
          (me.player || me.island) && h('p', { class: 'pk-phone-me' },
            me.player && h('b', { class: 'pk-phone-me-name' }, me.player),
            me.island && h('span', { class: 'pk-phone-me-island' }, h('span', { 'aria-hidden': 'true' }, '🏝️ '), me.island)),
          h('p', { class: 'pk-phone-greet' }, GREETING[now?.part] ?? '오늘도 포근한 섬이에요'));
        const grid = h('div', { class: 'pk-apps' }, visibleApps(ctx.services.ui).map(a => h('button', { type: 'button', class: 'pk-app', dataset: { app: a.id }, onclick: () => launch(a.id) },
          h('i', { style: { background: a.color }, 'aria-hidden': 'true' }, a.icon), h('span', null, a.name))));
        view.append(grid);
        const target = grid.querySelector(`[data-app="${lastApp}"]`) ?? grid.firstElementChild;
        target.focus({ preventScroll: true });
        return;
      }
      const app = APPS.find(a => a.id === id);
      top.replaceChildren(h('button', { type: 'button', class: 'pk-back', 'aria-label': '첫 화면으로', onclick: () => go('home') }, '‹'),
        h('h2', { class: 'pk-phone-title', id: shell.titleId }, h('span', { 'aria-hidden': 'true' }, app.icon), ` ${app.name}`));
      ({ dex: dexScreen, recipes: recipeScreen, settings: settingsScreen, save: saveScreen, access: accessScreen })[id]?.(view);
      (view.querySelector('[data-autofocus]') ?? view.querySelector('button, input') ?? top.querySelector('.pk-back')).focus({ preventScroll: true });
      ctx.events.emit('sfx', { name: 'menu' });
    }

    function launch(id) {
      if (p.fresh()) return;
      lastApp = id;
      if (id === 'map') return void openMap();
      if (id === 'bag') return void openBag({ mode: 'view' });
      const app = APPS.find(a => a.id === id);
      if (app?.panel) {
        // P4 창은 섬폰 위에 쌓아 연다 (닫으면 섬폰으로 돌아온다). 실패해도 섬폰은 그대로
        try { Promise.resolve(ctx.services.ui?.[app.panel]?.open?.()).catch(e => console.error(`[ui] ${app.panel}`, e)); }
        catch (e) { console.error(`[ui] ${app.panel}`, e); toast(`${app.name} 창을 열지 못했어요`, '⚠️'); }
        return;
      }
      go(id);
    }

    shell.card.setAttribute('aria-labelledby', shell.titleId);
    p = panels.open('phone', shell.root, {
      toggleKey: 'KeyP',
      initialFocus: () => view.querySelector('.pk-app'),
      onCancel: () => (screen === 'home' ? p.close(null) : go('home')),
      onKey(e) {
        if (screen === 'home' && e.target.closest?.('.pk-app')) {
          const grid = view.querySelector('.pk-apps');   // 세로 3칸, 가로 휴대폰 6칸
          const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 3;
          return gridMove([...grid.querySelectorAll('.pk-app')], cols, e.code);
        }
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
    // 그래픽 사양 (매우 낮음 · 낮음 · 적정 · 높음, render/quality.js): 고르면 state.settings.spec 로 저장되고 render 가 settings:changed 로 따라간다.
    // 안 골랐으면 자동 — 적정으로 시작해 느리면 render 가 한 칸씩 낮춘다. 눌린 단추 = 지금 사양, 「자동으로」 = 고른 것 지우기
    const SPEC = [['min', '매우 낮음'], ['low', '낮음'], ['mid', '적정'], ['high', '높음']];
    const SPEC_NOTE = { high: '그림자·빛 효과까지 모두 그려요.', mid: '그림자·빛 효과 없이 그려요.', low: '외곽선도 빼고, 큰 화면은 작게 그려 늘려요.', min: '가장 가볍게 — 더 작게 그리고 초당 30장으로 쉬어요.' };
    const specRow = h('div', { class: 'pk-seg pk-seg-spec', role: 'group', 'aria-label': '그래픽 사양' });
    const specNote = h('p', { class: 'pk-muted pk-small' });
    const drawSpec = () => {
      const cur = style?.quality ?? 'mid';
      const picked = !!style?.specFixed;
      specRow.replaceChildren(...SPEC.map(([m, t]) => h('button', {
        type: 'button', class: 'pk-seg-btn', 'aria-pressed': String(cur === m), disabled: !style,
        onclick: () => { setSetting('spec', m); drawSpec(); specRow.querySelector('[aria-pressed="true"]')?.focus(); },
      }, t)));
      const auto = picked && s.spec && s.spec !== 'auto'
        ? h('button', { type: 'button', class: 'pk-spec-auto', onclick: () => { setSetting('spec', 'auto'); drawSpec(); } }, '자동으로')
        : null;
      specNote.replaceChildren(`${SPEC_NOTE[cur] ?? ''} ${picked ? '고른 사양 그대로예요.' : '자동: 끊기면 알아서 낮춰요.'} `, auto ?? '');
    };
    drawSpec();
    view.append(...[
      nameRows(),
      birthdayRows(),
      h('h3', { class: 'pk-set-head' }, '소리'), slider('bgm', '배경음'), slider('sfx', '효과음'), slider('voice', '목소리'),
      h('h3', { class: 'pk-set-head' }, '시간'), timeRow,
      !time?.setMode && h('p', { class: 'pk-muted pk-small' }, '시간(sky) 모듈이 연결되면 바꿀 수 있어요.'),
      h('h3', { class: 'pk-set-head' }, '화면'), style && styleRow, style && h('h3', { class: 'pk-set-head' }, '그래픽 사양'), style && specRow, style && specNote, toggle('outline', '외곽선'), fullscreenRow(),
      !ctx.input?.touch && toggle('keyHint', '키 안내 보기'),   // 휴대폰엔 키 안내가 없다
      h('h3', { class: 'pk-set-head' }, '대화'), toggle('textLines', '주민 글 대사 보기', false),   // 5차 Z5: 끄면 이모티콘으로만 (검수 보드 z5 D14-A)
    ].filter(Boolean));
  }

  // ---------- 보기 편하게 (7차 UI-10, D42-A 기본 묶음) ----------
  // 값은 state.settings (textSize · shapes · calm · emoteText · soundText), 거는 일은 ui/access.js
  function accessScreen(view) {
    const s = ctx.state.settings;
    const now = () => ctx.services.ui?.access ?? {};
    const sizeRow = h('div', { class: 'pk-seg pk-seg-size', role: 'group', 'aria-label': '글자 크기' });
    const drawSize = () => {
      const cur = now().textSize ?? s.textSize ?? 'normal';
      sizeRow.replaceChildren(...Object.entries(TEXT_SIZES).map(([k, [scale, name]]) => h('button', {
        type: 'button', class: 'pk-seg-btn', 'aria-pressed': String(cur === k), dataset: { size: k },
        onclick: () => { setSetting('textSize', k); drawSize(); sizeRow.querySelector('[aria-pressed="true"]')?.focus(); },
      }, h('span', { class: 'pk-size-a', style: { fontSize: `${Math.round(18 * scale)}px` }, 'aria-hidden': 'true' }, '가'), h('span', { class: 'pk-size-name' }, name))));
    };
    drawSize();
    // 스위치: 지금 걸린 값(calm 은 기기 설정 포함)을 보여 주고, 누르면 정해서 저장
    const toggle = (key, label, sub) => {
      const id = `pk-acc-${key}`;
      const b = h('button', { type: 'button', role: 'switch', class: 'pk-switch', 'aria-checked': String(!!now()[key]), 'aria-labelledby': id, 'aria-describedby': `${id}-sub` }, h('span', { class: 'pk-switch-knob' }));
      b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; setSetting(key, v); b.setAttribute('aria-checked', String(!!now()[key])); });
      return h('div', { class: 'pk-set-row pk-acc-row' },
        h('span', { class: 'pk-acc-label' }, h('span', { id }, label), h('small', { id: `${id}-sub`, class: 'pk-muted pk-acc-sub' }, sub)), b);
    };
    view.append(
      h('p', { class: 'pk-muted pk-small' }, '바꾸면 바로 걸리고, 저장할 때 같이 남아요.'),
      h('h3', { class: 'pk-set-head' }, '글자 크기'), sizeRow,
      h('h3', { class: 'pk-set-head' }, '보기'),
      toggle('shapes', '모양으로도 보기', '켬·끔, 고른 것, 모자란 것을 색 말고 ✓·글자로도 보여 줘요'),
      toggle('calm', '흔들림 줄이기', '튀는 움직임을 끄고 카메라를 덜 움직여요'),
      h('h3', { class: 'pk-set-head' }, '대화·소리'),
      toggle('emoteText', '이모티콘 뜻 보기', '이모티콘 밑에 뜻을 글자로 적어 줘요'),
      toggle('soundText', '소리를 글자로', '입질·벌 같은 소리 신호를 화면에 글자로 보여 줘요'),
    );
  }

  /** 이름: 지금 이름과 '이름 다시 정하기' (intro 의 이름 정하기 창을 다시 연다 — 섬폰은 닫는다) */
  function nameRows() {
    const intro = ctx.services.intro;
    if (!intro?.rename) return null;
    const me = names();
    const go = button('이름 다시 정하기', { onclick: () => {
      if (intro.naming) return;
      current?.p.close(null);
      // 창을 닫으면 panels 가 마이크로태스크에서 입력을 되돌린다 → 그 뒤에 열어야 이름 창이 입력을 막은 채로 남는다
      setTimeout(() => intro.rename(), 0);
    } });
    return h('div', { class: 'pk-set-names' },
      h('h3', { class: 'pk-set-head' }, '이름'),
      h('div', { class: 'pk-set-row' }, h('span', null, '내 이름'), h('b', { class: 'pk-set-val' }, me.player || '아직 없어요')),
      h('div', { class: 'pk-set-row' }, h('span', null, '섬 이름'), h('b', { class: 'pk-set-val' }, me.island || '아직 없어요')),
      h('div', { class: 'pk-set-row pk-set-action' }, go));
  }

  /** 내 생일 (5차 D11-A): 달·날을 골라 정하면 그날 주민들이 축하해 준다. 칸은 town 몫이라 town.birthday.setPlayer 로 */
  function birthdayRows() {
    const bd = ctx.services.town?.birthday;
    if (!bd?.setPlayer) return null;
    const box = h('div', { class: 'pk-set-names pk-set-birthday' });
    const sel = (label, n, value) => h('select', { 'aria-label': label, class: 'pk-select',
      style: { minHeight: '40px', padding: '0 8px', borderRadius: '12px', border: '2px solid var(--pk-edge, #d9c7a3)', background: 'var(--pk-cream, #fffaf0)', font: '15px var(--pk-display, inherit)' } },
    Array.from({ length: n }, (_, i) => h('option', { value: String(i + 1), selected: i + 1 === value || undefined }, `${i + 1}${label}`)));
    function draw() {
      const cur = bd.player();
      const today = ctx.services.time?.now?.();
      const m = sel('월', 12, cur ? Number(cur.slice(0, 2)) : today?.month ?? 1);
      const d = sel('일', 31, cur ? Number(cur.slice(3)) : today?.day ?? 1);
      const set = button(cur ? '바꾸기' : '정하기', { onclick: () => {
        if (!mmdd(m.value, d.value)) { toast('그런 날은 없어요. 날짜를 다시 골라 주세요', '📅'); return; }
        const s = bd.setPlayer(Number(m.value), Number(d.value));
        toast(bd.isPlayerToday?.() ? '오늘이 생일이었군요! 생일 축하해요' : `내 생일을 ${birthdayLabel(s)}로 정했어요`, '🎂');
        draw();
      } });
      const clear = cur && button('지우기', { onclick: () => { bd.setPlayer(null); toast('내 생일을 지웠어요', '🎂'); draw(); } });
      const todays = (bd.today?.() ?? []).map(slug => ctx.services.town?.villagers?.find(V => V.slug === slug)?.person?.name ?? slug);
      box.replaceChildren(...[
        h('h3', { class: 'pk-set-head' }, '생일'),
        h('div', { class: 'pk-set-row' }, h('span', null, '내 생일'), h('b', { class: 'pk-set-val' }, cur ? `${birthdayLabel(cur)}${bd.isPlayerToday?.() ? ' 🎂' : ''}` : '아직 없어요')),
        h('div', { class: 'pk-set-row pk-set-action', style: { display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' } }, m, d, set, clear),
        todays.length > 0 && h('p', { class: 'pk-muted pk-small' }, `🎈 오늘은 ${todays.join(', ')}의 생일이에요`),
      ].filter(Boolean));   // replaceChildren 은 false 를 글자로 쓴다 (설정 화면에 'false' 가 보이던 것)
    }
    draw();
    return box;
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
