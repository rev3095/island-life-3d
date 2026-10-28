// 작업대 창: 레시피 목록(아이콘·이름·만들 수 있나) + 고른 레시피의 재료(가진 수/필요한 수) + 만들기.
// 만들기는 data.recipes.craft(id) — 재료를 빼고 결과물을 가방에 넣는 것까지 한 번에 한다(안 되면 그대로). 닫을 때까지 여러 번 만들 수 있다.
import { h, itemInfo, iconEl, recipeNeeds, josa } from './dom.js';
import { panelShell, button } from './panels.js';
import { notice } from './phone.js';

export function createCraft(ctx, panels, { toast }) {
  let current = null;

  /** opts: { title, color, onCraft(recipeId) } → Promise<string[]> 만든 레시피 id 들 (창을 닫을 때) */
  function open({ title = '작업대', color = '#C99B68', onCraft } = {}) {
    if (current) return current.p.result;
    const data = ctx.services.data;
    const recipes = data?.recipes?.list?.() ?? [];
    const made = [];
    let p, sel = null;

    const shell = panelShell({ cls: 'pk-craft', title, tagColor: color, onClose: () => p.close(made), onOutside: () => p.close(made) });
    const list = h('ul', { class: 'pk-craft-list', 'aria-label': '레시피' });
    const detail = h('div', { class: 'pk-craft-detail', 'aria-live': 'polite' });
    if (!recipes.length) shell.body.append(notice('🔨', '아직 아는 레시피가 없어요.', '주민에게 얘기를 들어 보세요.'));
    else shell.body.append(list, detail);

    const status = r => {
      const needs = recipeNeeds(ctx, r);
      const short = needs.filter(x => x.have < x.n);
      return { needs, short, can: !short.length && !!data.recipes.canCraft?.(r.id) };
    };
    const shortText = st => st.short.map(x => `${x.name} ${x.n - x.have}개`).join(', ');

    function draw(focusSel) {
      // 다시 그려도 포커스가 있던 곳(레시피 줄·만들기 버튼)을 지킨다
      const was = document.activeElement;
      focusSel ??= was?.dataset?.id ? `[data-id="${CSS.escape(was.dataset.id)}"]` : was?.classList?.contains('pk-craft-go') ? '.pk-craft-go' : null;
      list.replaceChildren(...recipes.map(r => {
        const out = itemInfo(ctx, r.result ?? r.id), st = status(r);
        return h('li', null, h('button', {
          type: 'button', class: `pk-craft-item${st.can ? ' is-can' : ''}${sel === r.id ? ' is-selected' : ''}`, dataset: { id: r.id },
          'aria-label': `${out.name}, ${st.can ? '만들 수 있어요' : st.short.length ? `${shortText(st)} 모자라요` : '가방에 자리가 없어요'}`,
          onclick: () => { select(r.id); detail.querySelector('.pk-craft-go:not(:disabled)')?.focus({ preventScroll: true }); },
          onfocus: () => select(r.id),
        }, iconEl(out.icon, 'pk-craft-icon'), h('span', { class: 'pk-craft-name' }, out.name),
        st.can ? h('span', { class: 'pk-badge' }, '✔') : h('span', { class: 'pk-craft-short' }, st.short.length ? `${st.short.length}가지 모자람` : '가방 가득')));
      }));
      drawDetail();
      (focusSel && shell.card.querySelector(focusSel))?.focus({ preventScroll: true });
    }

    function select(id) {
      if (sel === id) return;
      sel = id;
      for (const b of list.querySelectorAll('.pk-craft-item')) b.classList.toggle('is-selected', b.dataset.id === id);
      drawDetail();
    }

    function drawDetail() {
      const r = recipes.find(x => x.id === sel);
      if (!r) { detail.replaceChildren(h('p', { class: 'pk-muted' }, '만들 것을 골라 주세요')); return; }
      const out = itemInfo(ctx, r.result ?? r.id), st = status(r);
      detail.replaceChildren(
        h('div', { class: 'pk-craft-head' }, iconEl(out.icon, 'pk-craft-big'), h('b', null, out.name)),
        h('ul', { class: 'pk-mats pk-craft-mats', 'aria-label': '재료' }, st.needs.map(x => h('li', { class: x.have >= x.n ? 'is-ok' : 'is-short' }, iconEl(x.icon), `${x.name} ${Math.min(x.have, x.n)}/${x.n}`))),
        h('p', { class: 'pk-muted pk-small' }, st.can ? '재료가 다 있어요' : st.short.length ? `${shortText(st)} 더 있어야 해요` : '가방에 자리가 없어요'),
        button('🔨 만들기', { primary: true, cls: 'pk-craft-go', disabled: !st.can, onclick: () => craft(r) }));
    }

    function craft(r) {
      if (p.fresh()) return;
      const out = itemInfo(ctx, r.result ?? r.id);
      if (!data.recipes.craft(r.id)) { toast('만들지 못했어요', '🔨'); draw(); return; }
      made.push(r.id);
      for (let i = 0; i < 3; i++) ctx.events.emit('sfx', { name: 'axe-wood', volume: 0.7, pitch: 1.1 + i * 0.05, delay: i * 0.22 });
      toast(`${josa(out.name, '을/를')} 만들었어요!`, out.icon);
      try { onCraft?.(r.id); } catch (e) { console.error('[ui] craft onCraft', e); }
      draw(status(r).can ? '.pk-craft-go' : `[data-id="${CSS.escape(r.id)}"]`);
    }

    sel = (recipes.find(r => status(r).can) ?? recipes[0])?.id ?? null;
    if (recipes.length) draw();
    const off = ctx.events.on('inventory:changed', () => { if (!p.closed) draw(); });
    p = panels.open('craft', shell.root, {
      initialFocus: () => list.querySelector('.is-selected') ?? list.querySelector('button'),
      onClose: () => { off(); current = null; },
    });
    current = { p };
    ctx.events.emit('sfx', { name: 'menu' });
    return p.result;
  }

  return { open };
}
