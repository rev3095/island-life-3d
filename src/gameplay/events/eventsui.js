// 8차 계절 행사 화면 (보드 wave8): UI-14 오른쪽 아래 행사 칸(이모지 · 남은 날 → 누르면 오늘 할 것) · UI-13 섬폰 「📅 달력」 창 · UI-15 행사 도장.
// 창 겉모양은 ui 창과 같게 ui.css 의 .pk-scrim·.pk-card 를 빌리고, 안쪽만 아래 CSS (.ev-*). 창은 ctx.services.ui.panel 로 섬폰 위에 쌓는다.
// 도장(UI-15)은 보드에선 도감 탭이지만 도감 창을 건드리지 않게 달력 창 아래 칸에 둔다 (docs/notes/m8-events.md).

const CSS = `
.ev-chip { position: absolute; right: calc(12px + var(--safe-r, 0px)); bottom: calc(148px + var(--safe-b, 0px)); z-index: 6;
  display: flex; align-items: center; gap: 6px; padding: 6px 12px 6px 8px; border-radius: 999px; border: 2px solid #F4B6C8;
  background: rgba(251, 253, 248, .94); color: #26332D; font: 14px/1.2 var(--pk-font, "Gowun Dodum", sans-serif); cursor: pointer; pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.ev-chip[hidden] { display: none; }
.ev-chip .ev-e { font-size: 20px; }
.ev-chip b { font-weight: 700; }
.ev-chip:focus-visible { outline: 3px solid #2F86A6; outline-offset: 2px; }
@media (max-width: 600px) and (orientation: portrait) { .ev-chip { bottom: auto; top: calc(96px + var(--safe-t, 0px)); right: auto; left: calc(10px + var(--safe-l, 0px)); font-size: 13px; } }
.ev-card { width: min(520px, calc(100vw - 24px)); }
.ev-body { display: grid; gap: 14px; }
.ev-head { font-size: 15px; margin: 0; color: #5F7268; }
.ev-now { display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: #FDF1F4; border: 2px solid #F4B6C8; }
.ev-now h3 { margin: 0; font-size: 18px; }
.ev-todo { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 14px; }
.ev-todo li { display: flex; gap: 8px; align-items: baseline; }
.ev-todo .ev-n { margin-left: auto; font-variant-numeric: tabular-nums; color: #A8642E; }
.ev-todo .is-done { color: #3F8F5C; }
.ev-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.ev-row { display: grid; grid-template-columns: 34px 1fr auto; gap: 2px 10px; align-items: center; padding: 8px 10px; border-radius: 12px; background: #F3F7EC; font-size: 14px; }
.ev-row .ev-e { font-size: 22px; grid-row: span 2; text-align: center; }
.ev-row .ev-d { color: #5F7268; font-size: 12px; }
.ev-row .ev-s { grid-row: span 2; font-size: 12px; color: #3F8F5C; text-align: right; }
.ev-row.is-now { background: #FDF1F4; box-shadow: inset 0 0 0 2px #F4B6C8; }
.ev-row.is-fest { background: #E6F2F8; }
.ev-stamps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; font-size: 12px; }
.ev-stamp { display: grid; place-items: center; gap: 2px; }
.ev-stamp i { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; font-style: normal; font-size: 22px; border: 2px dashed #C9D3C5; opacity: .5; }
.ev-stamp.is-got i { border: 2px solid #C9583B; background: #FDF1F4; opacity: 1; }
.ev-note { font-size: 12px; color: #5F7268; margin: 0; }
`;

export function ensureEventsCss() {
  if (document.querySelector('style[data-events-css]')) return;
  const s = document.createElement('style');
  s.dataset.eventsCss = '';
  s.textContent = CSS;
  document.head.append(s);
}

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
}
const md = key => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;

/** UI-14 오른쪽 아래 행사 칸. onOpen = 누르면 (달력 창) */
export function createChip(mount, { onOpen }) {
  const e = el('span', { class: 'ev-e', 'aria-hidden': 'true' });
  const t = el('span');
  const chip = el('button', { type: 'button', class: 'ev-chip', hidden: true, onclick: () => onOpen() }, e, t);
  mount?.append(chip);
  return {
    el: chip,
    /** run = { ev, left } | null */
    show(run) {
      if (!run) { chip.hidden = true; return; }
      e.textContent = run.ev.emoji;
      t.replaceChildren(el('b', { text: run.ev.name }), ` · ${run.left}일`);
      chip.setAttribute('aria-label', `${run.ev.name}, 남은 날 ${run.left}일 — 오늘 할 것 보기`);
      chip.hidden = false;
    },
    hide(on) { chip.style.visibility = on ? 'hidden' : ''; },
  };
}

/**
 * UI-13 섬폰 「📅 달력」 창 (+ UI-15 도장). src = 그때그때 그릴 것:
 * { today() → dayKey, active() → [run], upcoming() → [run], festival() → { day: dayKey|null }, open() → bool, beforeLine,
 *   todo(run) → [{ label, n, goal, done }], stamps() → { [id]: [year…] }, list }
 */
export function openCalendar(ctx, src) {
  const ui = ctx.services.ui;
  let p;
  const close = () => p?.close(null);
  const titleId = `ev-cal-${Math.random().toString(36).slice(2, 8)}`;
  const body = el('div', { class: 'pk-card-body ev-body' });
  const card = el('section', { class: 'pk-card ev-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    el('header', { class: 'pk-card-head' },
      el('h2', { class: 'pk-card-title', id: titleId }, el('span', { 'aria-hidden': 'true', text: '📅' }), ' 섬 달력'),
      el('button', { type: 'button', class: 'pk-x', 'aria-label': '닫기', onclick: close, text: '✕' })),
    body);
  const root = el('div', { class: 'pk-scrim' }, card);
  root.addEventListener('click', e => { if (e.target === root) close(); });

  const today = src.today();
  const active = src.active();
  for (const run of active) {
    const items = src.open() ? src.todo(run) : [];
    body.append(el('div', { class: 'ev-now' },
      el('h3', {}, `${run.ev.emoji} ${run.ev.name} — ${run.day}일째 · 남은 날 ${run.left}일`),
      src.open()
        ? el('ul', { class: 'ev-todo', 'aria-label': '오늘 할 것' }, items.map(x => el('li', {},
            el('span', { 'aria-hidden': 'true', text: x.done ? '✅' : '⬜' }), el('span', { class: x.done ? 'is-done' : '', text: x.label }),
            el('span', { class: 'ev-n', text: x.goal > 1 ? `${Math.min(x.n, x.goal)} / ${x.goal}` : x.done ? '했어요' : '' }))))
        : el('p', { class: 'ev-note', text: `🐿 ${src.beforeLine}` })));
  }

  // 한 해 차례: 지금 열린 것 → 다음 것들 + 내 섬 축제 날
  body.append(el('p', { class: 'ev-head', text: `오늘 ${md(today)} · 다음 행사` }));
  const rows = [
    ...active.map(r => ({ ...r, now: true })),
    ...src.upcoming(),
  ];
  const fest = src.festival();
  const list = el('ul', { class: 'ev-list' }, rows.map(r => el('li', { class: `ev-row${r.now ? ' is-now' : ''}` },
    el('span', { class: 'ev-e', 'aria-hidden': 'true', text: r.ev.emoji }),
    el('b', { text: r.ev.name }),
    el('span', { class: 'ev-s', text: r.now ? '지금!' : r.until === 1 ? '내일' : `${r.until}일 뒤` }),
    el('span', { class: 'ev-d', text: `${md(r.from)} – ${md(r.to)}` }))));
  if (fest?.day) list.append(el('li', { class: 'ev-row is-fest' },
    el('span', { class: 'ev-e', 'aria-hidden': 'true', text: '🎉' }), el('b', { text: '섬 축제' }),
    el('span', { class: 'ev-s', text: '해마다' }), el('span', { class: 'ev-d', text: `${md(fest.day)}부터 사흘 · 저녁 6시` })));
  body.append(list);

  // UI-15 도장: 올해 행사마다 하나
  const year = today.slice(0, 4);
  const stamps = src.stamps();
  const got = src.list.filter(ev => stamps[ev.id]?.includes(year)).length;
  body.append(el('p', { class: 'ev-head', text: `${year}년 행사 도장 ${got} / ${src.list.length}` }),
    el('div', { class: 'ev-stamps' }, src.list.map(ev => {
      const has = stamps[ev.id]?.includes(year);
      const years = stamps[ev.id]?.length ?? 0;
      return el('div', { class: `ev-stamp${has ? ' is-got' : ''}`, 'aria-label': `${ev.name} ${has ? '도장 받음' : '아직'}${years ? ` · 모두 ${years}번` : ''}` },
        el('i', { 'aria-hidden': 'true', text: ev.emoji }), el('span', { text: ev.name.replace(/^\S+ /, '') }));
    })));
  if (!src.open()) body.append(el('p', { class: 'ev-note', text: '행사는 첫 섬 축제를 연 다음부터 함께해요.' }));

  p = ui.panel('calendar', root, {});
  card.focus();
  return p.result;
}
