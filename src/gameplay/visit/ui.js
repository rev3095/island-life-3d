// M21-P4 섬폰 「친구 섬」 화면 UI-38 (내 방명록 도장 · 받은 편지·선물, 글마다 숨기기·알리기) + 방문 도장 모음 UI-40 + 편지 문장 고르기 창.
// 창만 맡는다 — 남기기·받기·숨기기·알리기는 guestbook.js. ctx.services.ui.panel 로 연다 (ui/index.js 를 고치지 않는다).
// 섬폰 메뉴 줄은 ui/phone.js APPS 의 { id: 'friends', panel: 'friends' } — ui.friends.open 이 있을 때만 보인다.
import { h } from '../../ui/dom.js';
import { panelShell, button } from '../../ui/panels.js';

const CSS = `
.pk-friends { width: min(460px, 100%); }
.pk-friends .pk-card-body { display: flex; flex-direction: column; gap: 10px; }
.pk-fr-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.pk-fr-tab { font: inherit; border: 2px solid transparent; background: #F4ECDD; border-radius: 999px; padding: 5px 12px; cursor: pointer; }
.pk-fr-tab[aria-selected="true"] { border-color: var(--pk-ink, #4A3B32); background: #fff; font-weight: 700; }
.pk-fr-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 52vh; overflow: auto; }
.pk-fr-item { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 14px; background: #FFF8EA; border: 1px solid #EBDDC2; }
.pk-fr-item.is-hidden { opacity: .55; }
.pk-fr-item p { flex: 1; margin: 0; font-size: calc(14px * var(--pk-fs, 1)); word-break: keep-all; }
.pk-fr-item small { display: block; color: var(--pk-ink-soft, #7A6A5C); }
.pk-fr-item .pk-btn-small { padding: 4px 9px; min-height: 0; font-size: calc(12px * var(--pk-fs, 1)); }
.pk-fr-stamps { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.pk-fr-stamp { text-align: center; padding: 8px 4px; border-radius: 14px; background: #FFF8EA; border: 2px dashed #E3CFA8; font-size: calc(12px * var(--pk-fs, 1)); }
.pk-fr-stamp b { display: block; font-size: 28px; line-height: 1.2; }
.pk-fr-stamp.is-empty { opacity: .4; }
.pk-fr-rewards { display: flex; flex-wrap: wrap; gap: 6px; font-size: calc(12px * var(--pk-fs, 1)); }
.pk-fr-rewards span { padding: 3px 8px; border-radius: 999px; background: #F4ECDD; }
.pk-fr-rewards span.is-got { background: #CFE8C4; }
.pk-fr-lines { display: flex; flex-direction: column; gap: 6px; max-height: 50vh; overflow: auto; }
.pk-fr-line { text-align: left; font: inherit; padding: 8px 12px; border-radius: 14px; border: 2px solid #EBDDC2; background: #FFF8EA; cursor: pointer; }
.pk-fr-line[aria-pressed="true"] { border-color: var(--pk-ink, #4A3B32); background: #fff; }
`;
let styled = false;
function style() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  document.head.append(h('style', { 'data-pk-friends': '' }, CSS));
}
const TABS = [['book', '📖 내 방명록'], ['mail', '✉️ 받은 편지'], ['stamps', '🏝️ 도장 모음']];

export function createFriendsUI(ctx, gb) {
  const ui = () => ctx.services.ui;
  const toast = (t, i = '🏝️') => ui()?.toast?.(t, i);

  /** UI-38 · UI-40 */
  function open(tab = 'book') {
    style();
    let p = null, now = tab, busy = false;
    const shell = panelShell({ cls: 'pk-friends', title: '🏝️ 친구 섬', tagColor: '#9CCBE8', onClose: () => p?.close(null), onOutside: () => p?.close(null) });
    const tabs = h('div', { class: 'pk-fr-tabs', role: 'tablist' });
    const view = h('div', { class: 'pk-fr-view' });
    const status = h('p', { class: 'pk-small pk-muted', 'aria-live': 'polite', style: { margin: 0 } });
    shell.body.append(tabs, status, view);
    shell.foot.append(button('닫기', { onclick: () => p.close(null) }));

    function row(n) {
      const hidden = n.hidden;
      return h('li', { class: `pk-fr-item${hidden ? ' is-hidden' : ''}`, dataset: { visitKey: n.key } },
        h('p', null, gb.describe(n), h('small', null, `${n.day ?? ''}${hidden ? ' · 숨김' : ''}`)),
        button(hidden ? '보이기' : '숨기기', { cls: 'pk-btn-small', 'data-visit-hide': '', onclick: async () => { await gb.hide(n.key, !hidden); draw(); } }),
        !hidden && button('알리기', {
          cls: 'pk-btn-small', 'data-visit-report': '',
          onclick: async () => {
            if (busy) return;
            busy = true;
            const r = await gb.report(n);
            busy = false;
            toast(r?.ok ? '알렸어요. 이 글은 숨겨 둘게요.' : '알리지 못했어요. 숨겨 두기만 했어요.', '📮');
            draw();
          },
        }));
    }
    function draw() {
      tabs.replaceChildren(...TABS.map(([id, label]) => h('button', {
        type: 'button', class: 'pk-fr-tab', role: 'tab', 'aria-selected': String(id === now), dataset: { friendsTab: id },
        onclick: () => { now = id; draw(); },
      }, label)));
      const st = ctx.services.visit?.status?.() ?? {};
      status.textContent = st.share ? `내 섬 코드 ${st.code ?? ''} · 친구가 다녀가면 여기에 남아요` : '설정에서 「내 섬 보여 주기」를 켜면 친구가 도장·편지를 남길 수 있어요';
      const inbox = gb.inbox();
      if (now === 'book' || now === 'mail') {
        const list = inbox.filter(n => (now === 'book' ? n.kind === 'stamp' : n.kind !== 'stamp'));
        view.replaceChildren(list.length ? h('ul', { class: 'pk-fr-list' }, list.map(row))
          : h('p', { class: 'pk-muted' }, now === 'book' ? '아직 찍힌 도장이 없어요.' : '아직 받은 편지가 없어요.'));
        return;
      }
      // UI-40 방문 도장 모음
      const stamps = gb.stamps();
      const left = gb.leftToday();
      const cells = stamps.map(s => h('div', { class: 'pk-fr-stamp' }, h('b', { 'aria-hidden': 'true' }, gb.stampOf(s.stamp)?.icon ?? '🔖'), s.island || '친구 섬', h('br'), s.name || ''));
      while (cells.length < 10) cells.push(h('div', { class: 'pk-fr-stamp is-empty', 'aria-hidden': 'true' }, h('b', null, '◌'), ' '));
      view.replaceChildren(
        h('p', { class: 'pk-small', style: { margin: '0 0 6px' } }, `도장 찍은 섬 ${stamps.length}곳 · 오늘 남긴 섬 ${Object.keys(left.islands).length}/3`),
        h('div', { class: 'pk-fr-rewards', 'aria-label': '기념 가구' }, gb.rewards().map(r => h('span', { class: r.got ? 'is-got' : '' }, `${r.n}곳 ${r.name}${r.got ? ' ✓' : ''}`))),
        h('div', { class: 'pk-fr-stamps', style: { marginTop: '8px' } }, cells));
    }
    draw();
    p = ui().panel('friends', shell.root, { initialFocus: () => tabs.querySelector('[aria-selected="true"]') });
    gb.pull().then(() => { if (shell.root.isConnected) draw(); }, () => {});
    return p.result;
  }

  /** 편지 문장 고르기 → 문장 id | null (자유 입력 없음) */
  function pickLine({ title = '✉️ 편지 남기기', lines = [] } = {}) {
    style();
    let p = null, pick = null;
    const shell = panelShell({ cls: 'pk-friends', title, tagColor: '#C9A27A', onClose: () => p?.close(null), onOutside: () => p?.close(null) });
    const box = h('div', { class: 'pk-fr-lines', role: 'group', 'aria-label': '남길 문장' });
    const send = button('남기기', { primary: true, 'data-visit-send': '', onclick: () => pick && p.close(pick) });
    const draw = () => {
      box.replaceChildren(...lines.map(l => h('button', { type: 'button', class: 'pk-fr-line', 'aria-pressed': String(l.id === pick), dataset: { visitLine: l.id }, onclick: () => { pick = l.id; draw(); } }, l.text)));
      send.disabled = !pick;
    };
    shell.body.append(h('p', { class: 'pk-small pk-muted', style: { margin: 0 } }, '문장 하나를 골라 남겨요'), box);
    shell.foot.append(button('그만두기', { onclick: () => p.close(null) }), send);
    draw();
    p = ui().panel('visit-line', shell.root, { initialFocus: () => box.querySelector('button') });
    return p.result;
  }

  return { open, pickLine };
}
