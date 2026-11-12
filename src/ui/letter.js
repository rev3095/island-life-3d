// M15 UI-26 편지 쓰기 창: 우편함 「편지 쓰기」로 연다. 받는 주민 고르기 · 짧은 글(80자) · 선물 하나 동봉(가방에서 고르기) → 보내기.
// 창만 맡는다 — 보내기(가방에서 빼기·기록·다음 날 답장)는 gameplay/town/mail.js. ctx.services.ui.panel 로 연다 (ui/index.js 를 고치지 않는다).
// 자동 플레이 봇이 고를 수 있게 단추마다 data-letter-* 가 붙어 있다.
import { h, iconEl, josa } from './dom.js';
import { panelShell, button } from './panels.js';

const PHRASES = ['잘 지내?', '늘 고마워!', '오늘 즐거웠어', '내일 또 놀자', '선물 받아 줘!'];
const CSS = `
.pk-letter { width: min(420px, 100%); }
.pk-letter-paper { background: #FFF8EA; border: 2px dashed #E3CFA8; border-radius: 14px; padding: 10px 12px; }
.pk-letter-to { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
.pk-letter-who { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; border: 2px solid transparent; background: #F4ECDD; font: inherit; cursor: pointer; }
.pk-letter-who i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.pk-letter-who[aria-pressed="true"] { border-color: var(--pk-ink, #4A3B32); background: #fff; font-weight: 700; }
.pk-letter-who:disabled { opacity: .45; cursor: default; }
.pk-letter-text { width: 100%; box-sizing: border-box; min-height: 84px; resize: none; border: none; background: repeating-linear-gradient(#FFF8EA 0 26px, #EBDDC2 26px 27px); line-height: 27px; font: inherit; font-size: calc(15px * var(--pk-fs, 1)); padding: 0 4px; color: var(--pk-ink, #4A3B32); outline: none; }
.pk-letter-count { text-align: right; font-size: calc(12px * var(--pk-fs, 1)); color: var(--pk-ink-soft, #7A6A5C); margin: 2px 0 6px; }
.pk-letter-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
.pk-letter-chip { font: inherit; font-size: calc(12px * var(--pk-fs, 1)); border: 1px solid #E3CFA8; background: #fff; border-radius: 999px; padding: 3px 9px; cursor: pointer; }
.pk-letter-gift { display: flex; align-items: center; gap: 8px; min-height: 40px; }
.pk-letter-gift .pk-icon { width: 34px; height: 34px; }
.pk-letter-gift .pk-btn-small { padding: 4px 10px; min-height: 0; font-size: calc(13px * var(--pk-fs, 1)); }
.pk-letter-why { min-height: 1.2em; margin: 6px 0 0; font-size: calc(12px * var(--pk-fs, 1)); color: #B4543F; }
`;
let styled = false;
function style() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  document.head.append(h('style', { 'data-pk-letter': '' }, CSS));
}

/**
 * 편지 쓰기 창 열기 → Promise<{ to, text, slot } | null>.
 * opts = { people: [{ slug, name, color, sentToday }], max (글자 수), canGift (선물 칸 보이기), why(to, text) → 못 보내는 까닭 글 | null }
 */
export function openLetter(ctx, { people = [], max = 80, canGift = true, why = () => null } = {}) {
  style();
  const ui = ctx.services.ui, data = ctx.services.data;
  let to = people.find(p => !p.sentToday)?.slug ?? null, slot = null, p = null;
  const shell = panelShell({ cls: 'pk-letter', title: '✉️ 편지 쓰기', tagColor: '#C9A27A', onClose: () => p?.close(null), onOutside: () => p?.close(null) });
  const toRow = h('div', { class: 'pk-letter-to', role: 'group', 'aria-label': '받는 주민' });
  const text = h('textarea', { class: 'pk-letter-text', maxlength: String(max), rows: '3', placeholder: '짧게 마음을 적어 보세요', 'aria-label': '편지 글', 'data-letter-text': '' });
  const count = h('p', { class: 'pk-letter-count', 'aria-live': 'polite' });
  const chips = h('div', { class: 'pk-letter-chips' }, PHRASES.map(t => h('button', {
    type: 'button', class: 'pk-letter-chip', dataset: { letterPhrase: t },
    onclick: () => { text.value = (text.value ? `${text.value} ` : '') + t; text.value = text.value.slice(0, max); draw(); text.focus(); },
  }, t)));
  const gift = h('div', { class: 'pk-letter-gift' });
  const whyEl = h('p', { class: 'pk-letter-why', 'aria-live': 'polite' });
  shell.body.append(h('div', { class: 'pk-letter-paper' },
    h('p', { class: 'pk-small pk-muted', style: { margin: '0 0 6px' } }, '받는 주민'), toRow, text, count, chips,
    canGift && h('p', { class: 'pk-small pk-muted', style: { margin: '0 0 4px' } }, '선물 하나 같이 넣기 (없어도 돼요)'), canGift && gift), whyEl);
  const sendBtn = button('보내기', { primary: true, cls: 'pk-letter-send', 'data-letter-send': '', onclick: () => send() });
  shell.foot.append(button('그만두기', { onclick: () => p.close(null), 'data-letter-cancel': '' }), sendBtn);

  const item = () => (slot != null ? data?.inventory?.slots?.[slot] : null);
  function drawTo() {
    toRow.replaceChildren(...(people.length ? people.map(P => h('button', {
      type: 'button', class: 'pk-letter-who', 'aria-pressed': String(P.slug === to), disabled: P.sentToday || null, dataset: { letterTo: P.slug },
      title: P.sentToday ? '오늘은 벌써 보냈어요' : null,
      onclick: () => { to = P.slug; drawTo(); draw(); },
    }, h('i', { style: { background: P.color ?? '#ccc' }, 'aria-hidden': 'true' }), P.name, P.sentToday ? ' ✓' : '')) : [h('span', { class: 'pk-muted pk-small' }, '아직 편지를 보낼 주민이 없어요 (주민과 먼저 인사해 보세요)')]));
  }
  function drawGift() {
    const s = item(), it = s && data?.items?.get?.(s.id);
    gift.replaceChildren(
      it ? iconEl(it.icon ?? it.emoji) : h('span', { class: 'pk-icon', 'aria-hidden': 'true' }, '🎁'),
      h('span', null, it ? ui?.bag?.variants?.name?.(s, it.name) ?? it.name : '선물 없음'),
      button(it ? '바꾸기' : '선물 넣기', { cls: 'pk-btn-small', 'data-letter-gift': '', onclick: () => pickGift() }),
      it && button('빼기', { cls: 'pk-btn-small', onclick: () => { slot = null; drawGift(); } }));
  }
  function draw() {
    count.textContent = `${text.value.length} / ${max}`;
    const w = !to ? '받는 주민을 골라 주세요' : !text.value.trim() ? '편지 글을 적어 주세요' : why(to, text.value);
    whyEl.textContent = to && text.value.trim() ? (w ?? '') : '';
    sendBtn.disabled = !!w;
  }
  async function pickGift() {
    const s = await ui.bag.open({ mode: 'pick', title: '편지에 넣을 선물', hint: '하나만 넣을 수 있어요 (도구는 못 넣어요)', filter: x => !x.variant && data.items.get(x.id)?.category !== 'tool' });
    if (s != null) slot = s;
    drawGift();
    sendBtn.focus({ preventScroll: true });
  }
  function send() {
    draw();
    if (sendBtn.disabled) return;
    p.close({ to, text: text.value, slot });
  }
  text.addEventListener('input', draw);
  drawTo(); drawGift(); draw();
  p = ui.panel('letter', shell.root, { initialFocus: () => (to ? text : toRow.querySelector('button:not([disabled])')) });
  return p.result;
}

/** '코코에게 편지를 보냈어요' 같은 알림 글 */
export const sentToast = (name, giftName) => (giftName ? `${name}에게 ${josa(giftName, '을/를')} 넣은 편지를 보냈어요` : `${name}에게 편지를 보냈어요`);
