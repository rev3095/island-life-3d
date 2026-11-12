// 9차 UI-16 섬 꾸미기 칸: 화면 아래 가운데 (휴대폰은 화면 아래 꽉 차게). 창(panel)이 아니라서 열려 있어도 걷고 행동 키를 쓴다.
// 위 줄 = 고를 것 (길 · 울타리 · 가방의 야외 가구), 아래 줄 = 놓기/치우기 · (고치기 때) 옮기기 · 돌리기 · 고치기 · 끝내기.
// 10차: 옮기는 중엔 아래 줄 = 놓기 · 돌리기 · 취소 (D95-A).
import { h, iconEl } from '../../ui/dom.js';

const CSS = `
.pk-decor { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 6; width: min(620px, calc(100% - 24px));
  background: var(--pk-cream, #FFF8E6); border: 2px solid var(--pk-edge, #E2D2AE); border-radius: 18px; box-shadow: var(--pk-shadow);
  padding: 8px 10px 10px; font-family: var(--pk-body); color: var(--pk-ink, #4A3B32); pointer-events: auto; }
.pk-decor[hidden] { display: none; }
.pk-decor-head { display: flex; align-items: center; gap: 8px; margin: 0 2px 6px; font-family: var(--pk-display); font-size: 15px; }
.pk-decor-head span:nth-child(2) { white-space: nowrap; }
.pk-decor-head small { margin-left: auto; text-align: right; font-family: var(--pk-body); font-size: 12px; color: var(--pk-ink-soft, #7A6656); }
.pk-decor-list { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
.pk-decor-item { flex: 0 0 auto; display: grid; justify-items: center; gap: 2px; min-width: 64px; padding: 6px 6px 4px; border-radius: 12px;
  border: 2px solid var(--pk-ring, #E4D5B5); background: var(--pk-slot, #FFF9EC); font: 12px/1.2 var(--pk-body); color: inherit; cursor: pointer; }
.pk-decor-item i { font-style: normal; font-size: 22px; line-height: 28px; height: 28px; }
.pk-decor-item img { width: 28px; height: 28px; object-fit: contain; }
.pk-decor-item.is-on { border-color: var(--pk-accent-deep, #C9772E); background: #FFE9C9; }
.pk-decor-item b { font-weight: normal; font-size: 11px; color: var(--pk-ink-soft, #7A6656); }
.pk-decor-sep { flex: 0 0 2px; align-self: stretch; background: var(--pk-ring, #E4D5B5); border-radius: 2px; margin: 4px 2px; }
.pk-decor-acts { display: flex; gap: 6px; margin-top: 6px; }
.pk-decor-acts button { flex: 1; min-height: 38px; border-radius: 12px; border: 2px solid var(--pk-ring, #E4D5B5); background: #fff;
  font: 14px var(--pk-display); color: inherit; cursor: pointer; }
.pk-decor-acts button.is-main { background: var(--pk-accent, #F2B36B); border-color: var(--pk-accent-deep, #C9772E); }
.pk-decor-acts button.is-on { background: #FFE9C9; border-color: var(--pk-accent-deep, #C9772E); }
.pk-decor-acts kbd { font: 11px var(--pk-body); opacity: .7; margin-left: 4px; }
/* 10차: 휴대폰은 화면 아래가 패드·A/B 단추라 겹쳐서, 위쪽(시계·섬폰 단추 줄 아래)에 둔다 */
.pk-touch .pk-decor { top: calc(env(safe-area-inset-top, 0px) + 138px); bottom: auto; width: calc(100% - 16px); border-radius: 18px; }
.pk-touch .pk-decor-acts kbd { display: none; }
.pk-touch .pk-decor-acts button { min-height: 46px; }
`;

export function createDecorBar(ctx, api) {
  if (!document.getElementById('pk-decor-css')) document.head.append(h('style', { id: 'pk-decor-css', text: CSS }));
  const root = h('div', { class: 'pk-decor', role: 'toolbar', 'aria-label': '섬 꾸미기', hidden: true });
  const head = h('div', { class: 'pk-decor-head' });
  const list = h('div', { class: 'pk-decor-list', role: 'listbox', 'aria-label': '놓을 것' });
  const acts = h('div', { class: 'pk-decor-acts' });
  root.append(head, list, acts);
  // HUD 위 (창·알림 아래) — ui 가 만든 pk-root 안에 넣어 터치 class 를 따른다
  (document.querySelector('.pk-root') ?? ctx.uiRoot).append(root);
  // 칸을 눌러도 땅 누르기(마우스 걷기)로 새지 않게
  for (const ev of ['pointerdown', 'mousedown', 'touchstart']) root.addEventListener(ev, e => e.stopPropagation());

  const key = c => `${c.kind}|${c.variant ?? ''}`;
  function render() {
    const D = api.state;
    const edit = D.mode === 'edit', moving = D.moving;
    const items = api.catalog();
    const cur = D.pick && key(D.pick);
    const left = items.find(c => key(c) === cur)?.count ?? 0;
    head.replaceChildren(h('span', { 'aria-hidden': 'true' }, '🪴'), h('span', null, '섬 꾸미기'),
      h('small', null, moving ? `${moving.pick.name} 옮기는 중` : edit ? '앞·누른 칸의 것 고치기' : D.pick ? `${D.pick.name}${D.pick.group === 'furn' ? ` · 남은 ${left}` : D.pick.group === 'build' ? ` · 🌰 ${(D.pick.cost ?? 0).toLocaleString('ko-KR')}` : ' · 거저'}` : '놓을 것을 골라요'));
    const kids = [];
    let lastGroup = null;
    for (const c of items) {
      if (lastGroup && c.group !== lastGroup) kids.push(h('span', { class: 'pk-decor-sep', 'aria-hidden': 'true' }));
      lastGroup = c.group;
      const icon = typeof c.icon === 'string' && /\.(png|webp|svg|jpe?g)$/i.test(c.icon) ? iconEl(c.icon, '') : h('i', { 'aria-hidden': 'true' }, c.icon ?? c.emoji ?? '🪴');
      kids.push(h('button', { type: 'button', role: 'option', class: `pk-decor-item${!edit && key(c) === cur ? ' is-on' : ''}`, 'aria-selected': String(!edit && key(c) === cur),
        dataset: { decor: c.kind, group: c.group }, onclick: () => api.choose(c) },
      icon, h('span', null, c.name), c.group === 'furn' ? h('b', null, `×${c.count}`) : null));
    }
    if (!items.some(c => c.group === 'furn')) kids.push(h('span', { class: 'pk-decor-sep', 'aria-hidden': 'true' }), h('span', { class: 'pk-decor-item', style: { cursor: 'default', opacity: 0.7 } }, h('i', null, '🎒'), h('span', null, '야외 가구 없음'), h('b', null, '상점에서')));
    list.replaceChildren(...kids);
    if (moving) {
      acts.replaceChildren(
        h('button', { type: 'button', class: 'is-main', dataset: { act: 'do' }, onclick: () => api.place() }, '놓기', h('kbd', null, 'Space')),
        h('button', { type: 'button', dataset: { act: 'rotate' }, onclick: () => api.rotate(1) }, '돌리기', h('kbd', null, 'Q/E')),
        h('button', { type: 'button', dataset: { act: 'cancel' }, onclick: () => api.cancelMove() }, '취소', h('kbd', null, 'Esc')),
      );
      return;
    }
    acts.replaceChildren(...[
      h('button', { type: 'button', class: 'is-main', dataset: { act: 'do' }, onclick: () => (edit ? api.remove() : api.place()) }, edit ? '치우기' : '놓기', h('kbd', null, 'Space')),
      edit ? h('button', { type: 'button', dataset: { act: 'move' }, onclick: () => api.pickUp() }, '옮기기', h('kbd', null, 'C')) : null,
      h('button', { type: 'button', dataset: { act: 'rotate' }, onclick: () => api.rotate(1) }, '돌리기', h('kbd', null, 'Q/E')),
      h('button', { type: 'button', class: edit ? 'is-on' : '', dataset: { act: 'edit' }, 'aria-pressed': String(edit), onclick: () => api.setMode(edit ? 'place' : 'edit') }, '고치기', h('kbd', null, 'X')),
      h('button', { type: 'button', dataset: { act: 'close' }, onclick: () => api.close() }, '끝내기', h('kbd', null, 'Esc')),
    ].filter(Boolean));
  }
  return {
    root, render,
    show(v) { root.hidden = !v; if (v) render(); },
  };
}
