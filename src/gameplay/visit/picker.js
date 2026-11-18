// M21-P3 섬 고르기 창 UI-39 (보드 wave17 D285-A): 「오늘의 섬」 셋 + 섬 코드 넣기 + 닫기.
// 내 섬을 보여 주기 켜지 않았어도 고를 수 있다 (읽기만). 고르면 섬 문서를, 닫으면 null 을 돌려준다.
import { h } from '../../ui/dom.js';
import { panelShell, button } from '../../ui/panels.js';
import { tripOf } from './trip.js';

const CSS = `
.pk-visit-pick { width: min(420px, 100%); }
.pk-visit-pick .pk-card-body { display: grid; gap: 12px; padding-top: 10px; }
.pk-visit-sub { margin: 0; font-weight: 700; font-size: 0.95em; }
.pk-visit-list { display: grid; gap: 6px; }
.pk-visit-isle { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; width: 100%; padding: 8px 12px; }
.pk-visit-isle b { font-size: 1.02em; }
.pk-visit-isle small { opacity: 0.75; }
.pk-visit-isle code { grid-row: span 2; align-self: center; letter-spacing: 0.08em; opacity: 0.8; }
.pk-visit-note { margin: 0; opacity: 0.8; font-size: 0.92em; }
.pk-visit-code { display: flex; gap: 6px; }
.pk-visit-code input { flex: 1; min-width: 0; font: inherit; font-size: 1.1em; letter-spacing: 0.15em; text-transform: uppercase; padding: 6px 10px; border-radius: 10px; border: 2px solid currentColor; background: transparent; color: inherit; }
.pk-visit-why { margin: 0; min-height: 1.2em; color: #C0504D; font-size: 0.92em; }
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  document.head.append(h('style', { 'data-pk': 'visit-pick' }, CSS));
}

/**
 * 창 열기 → Promise<섬 문서 | null>
 * @param {object} ui ctx.services.ui
 * @param {{ today: () => Promise<doc[]>, find: (글) => Promise<doc|null>, check: (doc) => { ok, why }, why: (why) => 글, readable: boolean }} o
 */
export function openPicker(ui, { today, find, check, why, readable }) {
  style();
  let p = null;
  const shell = panelShell({ cls: 'pk-visit-pick', title: '⛴ 친구 섬 구경', onClose: () => p?.close(null), onOutside: () => p?.close(null) });
  const say = h('p', { class: 'pk-visit-why', role: 'status' });
  const pickDoc = doc => {
    const c = check(doc);
    if (!c.ok) { say.textContent = why(c.why); return; }
    p.close(doc);
  };

  // 오늘의 섬
  const list = h('div', { class: 'pk-visit-list' }, h('p', { class: 'pk-visit-note', text: readable ? '배가 섬을 찾고 있어요…' : why('no-store') }));
  shell.body.append(h('p', { class: 'pk-visit-sub', text: '🏝 오늘의 섬' }), list);

  // 섬 코드
  const input = h('input', { type: 'text', maxlength: '8', autocomplete: 'off', spellcheck: 'false', placeholder: '섬 코드 6자리', 'aria-label': '섬 코드', inputmode: 'text' });
  const go = button('찾기', { primary: true, onclick: () => search() });
  async function search() {
    if (!readable) { say.textContent = why('no-store'); return; }
    const text = input.value.trim();
    if (!text) { say.textContent = '섬 코드를 넣어 주세요.'; return; }
    go.disabled = true;
    say.textContent = '찾는 중…';
    const doc = await find(text).catch(() => null);
    go.disabled = false;
    if (p.closed) return;
    if (!doc) { say.textContent = why('missing'); return; }
    say.textContent = '';
    pickDoc(doc);
  }
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); search(); } });
  shell.body.append(h('p', { class: 'pk-visit-sub', text: '🔑 섬 코드로 찾기' }), h('div', { class: 'pk-visit-code' }, input, go), say);
  shell.foot.append(h('div', { class: 'pk-btn-row' }, button('닫기', { onclick: () => p.close(null) })));

  p = ui.panel('visit-pick', shell.root, { initialFocus: () => input, onCancel: () => p.close(null), onAction: () => { if (document.activeElement === input) search(); } });

  if (readable) {
    today().then(docs => {
      if (p.closed) return;
      list.replaceChildren();
      if (!docs?.length) { list.append(h('p', { class: 'pk-visit-note', text: '오늘은 구경할 수 있는 섬이 아직 없어요. 섬 코드를 받았다면 아래에 넣어 보세요.' })); return; }
      for (const doc of docs) {
        const t = tripOf(doc);
        list.append(button([h('b', { text: t.island }), h('code', { text: t.code ?? '' }), h('small', { text: `${t.owner}의 섬` })], { cls: 'pk-visit-isle', onclick: () => pickDoc(doc) }));
      }
    }, () => { if (!p.closed) list.replaceChildren(h('p', { class: 'pk-visit-note', text: '지금은 섬 목록을 받지 못했어요.' })); });
  }
  return p.result;
}
