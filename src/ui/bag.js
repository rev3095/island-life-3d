// 가방: 동그란 20칸. 보기(view)·팔기(sell)·기증(donate)·고르기(pick) 모드. open() 은 고른 칸 번호(또는 null)를 돌려준다.
import { h, fmt, itemInfo, iconEl, josa, DEX_CATEGORIES, BAG_TABS } from './dom.js';
import { panelShell, gridMove } from './panels.js';
import { createVariants } from './variants.js';

const COLS = 5, SIZE = 20;
const MODES = {
  view: { title: '가방', hint: '' },
  sell: { title: '팔기', hint: '팔 물건을 골라 주세요' },
  donate: { title: '기증', hint: '박물관에 기증할 것을 골라 주세요' },
  pick: { title: '고르기', hint: '물건을 하나 골라 주세요' },
};

export function createBag(ctx, panels) {
  const slots = () => ctx.services.data?.inventory?.slots ?? ctx.state.inventory ?? [];
  let current = null;   // 열려 있는 가방 { p, render }
  // 가구 색·주민 사진 같은 변형 이름 (스펙을 받으면 열린 가방을 다시 그린다)
  const variants = createVariants(ctx, () => current?.render());

  /** 이 모드에서 고를 수 있는 칸인가 */
  function canPick(mode, slot, info) {
    if (!slot) return false;
    if (mode === 'sell') return info.sell > 0;
    if (mode === 'donate') return DEX_CATEGORIES.includes(info.category) && !ctx.services.data?.museum?.has?.(slot.id);
    return true;
  }
  function whyNot(mode, info) {
    if (mode === 'sell') return '팔 수 없는 물건이에요';
    if (mode === 'donate') return DEX_CATEGORIES.includes(info.category) ? '이미 기증했어요' : '박물관에는 물고기·곤충·화석·바다 생물만 받아요';
    return '';
  }

  function open({ mode = 'view', title, hint, filter } = {}) {
    if (current) return current.p.result;
    const m = MODES[mode] ? mode : 'view';
    const pickable = (slot, info) => (filter ? !!slot && filter(slot, info) : canPick(m, slot, info));
    let p, selected = -1;

    const shell = panelShell({ cls: `pk-bag is-${m}`, title: title ?? MODES[m].title, onClose: () => p.close(null), onOutside: () => p.close(null) });
    const modeHint = h('p', { class: 'pk-bag-hint', hidden: !(hint ?? MODES[m].hint) }, hint ?? MODES[m].hint);
    const grid = h('div', { class: 'pk-bag-grid', role: 'grid', 'aria-label': '가방 칸' });
    const cells = Array.from({ length: SIZE }, (_, i) => {
      const b = h('button', { type: 'button', class: 'pk-slot', role: 'gridcell', dataset: { i } });
      b.addEventListener('click', () => choose(i));
      b.addEventListener('focus', () => detail(i));
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') detail(i); });   // 손가락은 누르면 포커스로 보인다
      return b;
    });
    // 5칸씩 줄로 묶어 표 구조를 맞춘다
    for (let r = 0; r < SIZE / COLS; r++) grid.append(h('div', { class: 'pk-bag-row', role: 'row' }, cells.slice(r * COLS, r * COLS + COLS)));
    const info = h('div', { class: 'pk-bag-info', 'aria-live': 'polite' });
    const wallet = h('span', { class: 'pk-wallet' });
    // B-12 분류 탭 (보기 모드만): 고른 분류가 아닌 칸은 흐리게 (칸 자리·순서는 그대로)
    let tab = 'all';
    const tabRow = h('div', { class: 'pk-tabs pk-bag-tabs', role: 'tablist', 'aria-label': '가방 분류', hidden: m !== 'view' });
    const drawTabs = () => tabRow.replaceChildren(...BAG_TABS.map(t => h('button', { type: 'button', role: 'tab', class: 'pk-tab', 'aria-selected': String(t.id === tab), tabindex: t.id === tab ? '0' : '-1',
      onclick: () => { tab = t.id; drawTabs(); render(); } }, t.name)));
    drawTabs();
    shell.body.append(tabRow, modeHint, grid, info);
    shell.foot.append(wallet);

    function render() {
      const s = slots();
      cells.forEach((b, i) => {
        const slot = s[i] ?? null;
        const it = slot ? itemInfo(ctx, slot.id) : null;
        const ok = pickable(slot, it);
        b.replaceChildren();
        b.classList.toggle('is-empty', !slot);
        const inTab = !slot || m !== 'view' || BAG_TABS.find(t => t.id === tab)?.test(ctx.services.data?.items?.get?.(slot.id) ?? it) !== false;   // 표의 아이템 (나오는 시간 hours 포함)
        b.classList.toggle('is-off', !!slot && ((m !== 'view' && !ok) || !inTab));
        b.classList.toggle('is-selected', i === selected);
        if (slot) {
          const v = variants.of(slot);
          b.append(iconEl(it.icon, 'pk-slot-icon'));
          if (v?.color) b.append(h('span', { class: 'pk-slot-dot', style: { background: v.color }, 'aria-hidden': 'true' }));
          if (slot.count > 1) b.append(h('span', { class: 'pk-count', 'aria-hidden': 'true' }, slot.count));
          b.append(h('span', { class: 'pk-tip', 'aria-hidden': 'true' }, h('b', null, it.name), v && variantTag(v), it.sell > 0 && h('span', null, `🌰 ${fmt(it.sell)}`)));
          b.setAttribute('aria-label', `${i + 1}번 칸: ${it.name}${v ? ` (${v.label})` : ''}${slot.count > 1 ? ` ${slot.count}개` : ''}${it.sell > 0 ? `, 판매 가격 ${fmt(it.sell)}도토리` : ''}${m !== 'view' && !ok ? ', 고를 수 없음' : ''}`);
        } else b.setAttribute('aria-label', `${i + 1}번 칸: 비어 있음`);
        b.setAttribute('aria-disabled', m !== 'view' && !ok ? 'true' : 'false');
      });
      const acorns = ctx.services.data?.wallet?.get?.() ?? ctx.state.wallet?.acorns ?? 0;
      wallet.textContent = `🌰 ${fmt(acorns)}`;
      wallet.setAttribute('aria-label', `가진 도토리 ${fmt(acorns)}개`);
      const used = s.filter(Boolean).length;
      shell.foot.dataset.count = `${used} / ${SIZE}칸`;
      detail(cells.indexOf(document.activeElement));
    }

    function detail(i) {
      const slot = slots()[i];
      if (!slot) { info.replaceChildren(h('span', { class: 'pk-muted' }, i >= 0 ? '빈 칸' : '')); return; }
      const it = itemInfo(ctx, slot.id);
      const ok = pickable(slot, it);
      const v = variants.of(slot);
      info.replaceChildren(...[iconEl(it.icon, 'pk-bag-info-icon'),
        h('b', null, it.name), v && variantTag(v), slot.count > 1 && h('span', null, `× ${slot.count}`),
        it.sell > 0 && h('span', { class: 'pk-price' }, `🌰 ${fmt(it.sell)}`),
        m !== 'view' && !ok && h('span', { class: 'pk-muted' }, whyNot(m, it))].filter(Boolean));
    }

    function choose(i) {
      if (p.fresh()) return;
      const slot = slots()[i];
      const it = slot ? itemInfo(ctx, slot.id) : null;
      // iOS 는 눌러도 단추에 포커스를 주지 않아서 직접 준다 (설명 줄·A 버튼이 이 칸을 본다)
      if (document.activeElement !== cells[i]) cells[i].focus({ preventScroll: true });
      if (m === 'view') { selected = slot ? i : -1; render(); return; }
      if (!pickable(slot, it)) {
        cells[i].classList.remove('is-nope'); void cells[i].offsetWidth; cells[i].classList.add('is-nope');
        if (slot) info.lastElementChild?.classList.add('is-warn');
        return;
      }
      p.close(i);
    }

    const off = ctx.events.on('inventory:changed', render);
    const offW = ctx.events.on('wallet:changed', render);
    p = panels.open('bag', shell.root, {
      toggleKey: 'KeyI',
      initialFocus: () => cells.find((b, i) => slots()[i] && (m === 'view' || pickable(slots()[i], itemInfo(ctx, slots()[i].id)))) ?? cells[0],
      onKey: (e) => {
        if (!e.target.closest?.('.pk-slot') || !gridMove(cells, COLS, e.code)) return false;
        detail(cells.indexOf(document.activeElement));
        return true;
      },
      onClose: () => { off(); offW(); current = null; },
    });
    current = { p, render };
    render();
    ctx.events.emit('sfx', { name: 'bag-open' });
    return p.result;
  }

  return { open, refresh: () => current?.render(), variants };
}

/** 변형 이름표: 색 점 + '파랑' */
const variantTag = v => h('span', { class: 'pk-variant' }, v.color && h('i', { style: { background: v.color }, 'aria-hidden': 'true' }), v.label);

/** 팔기·기증 문구에 쓰는 '사과 3개를' 같은 말 */
export const itemPhrase = (name, n = 1) => (n > 1 ? `${name} ${n}개를` : josa(name, '을/를'));
