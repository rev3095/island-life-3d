// 11차 UI-19 옷장 창 (보드 wave11 D100-A): 옷장(FU-12) 「갈아입기」로 연다. 모자 · 윗옷 · 신발 칸, 고르면 바로 입어 보기, 「입기」 = 저장 + 빙글(AN-12).
// 데이터·입히기는 ctx.services.outfit (src/player/outfit.js). 창은 오른쪽(휴대폰은 아래)에 붙어서 입어 보는 주인공이 가려지지 않는다.
import { h, iconEl, josa } from './dom.js';
import { panelShell, button } from './panels.js';
import { notice } from './phone.js';

const SLOT_ICON = { hat: '🎩', top: '👕', shoes: '👟' };

export function createCloset(ctx, panels, { toast }) {
  let current = null;

  /** 창 열기 → Promise<입었나 (true) | 그만둠 (false)> */
  function open({ slot: startSlot = null } = {}) {
    if (current) return current.p.result;
    const O = ctx.services.outfit;
    let p, slot = startSlot ?? 'top';
    const pick = O ? O.worn() : {};
    const shell = panelShell({ cls: 'pk-closet', title: '옷장', tagColor: '#B98957', onClose: () => cancel(), onOutside: () => cancel() });
    shell.root.classList.add('pk-closet-scrim');
    const tabs = h('div', { class: 'pk-tabs', role: 'tablist', 'aria-label': '옷 칸' });
    const view = h('div', { class: 'pk-closet-view', role: 'tabpanel' });
    const wearing = h('p', { class: 'pk-closet-now', 'aria-live': 'polite' });
    shell.body.append(wearing, tabs, view);
    const wearBtn = button('입기', { primary: true, cls: 'pk-closet-wear', onclick: () => confirm() });
    shell.foot.append(button('그만두기', { onclick: () => cancel() }), wearBtn);

    const nameOf = id => (id ? O.info(id)?.name ?? id : '없음');
    function draw(focusSel) {
      if (!O) { view.replaceChildren(notice('🚪', '옷장이 아직 비어 있어요.', '옷 갈아입기를 켜지 못했어요.')); return; }
      const by = O.bySlot();
      wearing.textContent = O.slots.map(s => `${O.slotLabel[s]} ${nameOf(pick[s])}`).join(' · ');
      tabs.replaceChildren(...O.slots.map(s => h('button', {
        type: 'button', role: 'tab', class: 'pk-tab', 'aria-selected': String(slot === s), tabindex: slot === s ? '0' : '-1', dataset: { slot: s },
        onclick: () => { slot = s; draw(`[role="tab"][data-slot="${s}"]`); },
      }, `${SLOT_ICON[s]} ${O.slotLabel[s]}`)));
      const list = by[slot] ?? [];
      const only = list.filter(x => x.id && x.id !== 'basic-tee').length === 0;
      view.replaceChildren(
        h('ul', { class: 'pk-closet-list' }, list.map(x => {
          const it = x.id ? O.info(x.id) : null;
          const on = (pick[slot] ?? null) === (x.id ?? null);
          return h('li', null, h('button', {
            type: 'button', class: `pk-closet-item${on ? ' is-on' : ''}`, 'aria-pressed': String(on), dataset: { wear: x.id ?? '' },
            'aria-label': `${it ? it.name : `${O.slotLabel[slot]} 없음`}${it?.worn ? ', 지금 입은 것' : ''}`,
            onclick: () => choose(x.id),
          },
          it?.thumb ? iconEl(it.thumb, 'pk-closet-thumb') : h('span', { class: 'pk-closet-thumb pk-closet-swatch', style: it ? { background: it.swatch } : null, 'aria-hidden': 'true' }, it ? '' : '✕'),
          h('span', { class: 'pk-closet-name' }, it ? it.name : '없음'),
          it?.worn ? h('small', { class: 'pk-closet-tag' }, '입은 것') : null));
        })),
        only ? h('p', { class: 'pk-closet-hint' }, `도토리상점 옷 진열대에서 ${josa(O.slotLabel[slot], '을/를')} 사면 여기에 걸려요.`) : null);
      const changed = O.slots.some(s => (pick[s] ?? null) !== (O.worn()[s] ?? null));
      wearBtn.textContent = changed ? '입기' : '이대로 입기';
      (focusSel && shell.card.querySelector(focusSel))?.focus({ preventScroll: true });
    }

    function choose(id) {
      if (p.fresh()) return;
      pick[slot] = id;
      O.preview(pick);
      ctx.events.emit('sfx', { name: 'menu' });
      draw(`[data-wear="${CSS.escape(id ?? '')}"]`);
    }
    async function confirm() {
      if (p.fresh() || p.closed) return;
      const changed = O ? O.slots.some(s => (pick[s] ?? null) !== (O.worn()[s] ?? null)) : false;
      p.close(true);
      if (!O) return;
      await O.wear(pick, { spin: changed });
      if (changed) toast(`${josa(O.slots.filter(s => pick[s] && pick[s] !== 'basic-tee').map(s => nameOf(pick[s])).join(' · ') || '기본 옷', '으로/로')} 갈아입었어요`, '👕');
    }
    function cancel() {
      if (p.closed) return;
      O?.revert();
      p.close(false);
    }

    draw();
    p = panels.open('closet', shell.root, {
      initialFocus: () => view.querySelector('.is-on') ?? view.querySelector('button'),
      onCancel: () => cancel(),
      onKey(e) {
        if (!O) return false;
        if (e.target.closest?.('[role="tab"]') && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
          const i = O.slots.indexOf(slot);
          slot = O.slots[(i + (e.code === 'ArrowLeft' ? -1 : 1) + O.slots.length) % O.slots.length];
          draw(`[role="tab"][data-slot="${slot}"]`);
          return true;
        }
        return false;
      },
      onClose: () => { current = null; },
    });
    current = { p };
    return p.result;
  }

  return { open };
}
