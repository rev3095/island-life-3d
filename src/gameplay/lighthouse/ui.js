// M19-P4 UI-37 등대 진행판 — 오른쪽 아래 (계절 행사 칸 UI-14 위). 섬 일지 목표처럼: 단계 점 다섯 · 지금 단계 · 할 것(재료·도움 주민·남은 날).
// 누르면 할 것 줄을 접고 편다. 창을 막지 않는다 (pointer-events 는 판에만). 장면 동안·창이 열린 동안은 숨긴다.
// 휴대폰 세로(600px 이하)는 왼쪽 위 행사 칸 아래로.

const CSS = `
.lh-box { position: absolute; right: calc(12px + var(--safe-r, 0px)); bottom: calc(196px + var(--safe-b, 0px)); z-index: 6;
  width: min(250px, calc(100vw - 24px)); padding: 8px 10px 9px; border-radius: 14px; border: 2px solid #9CC9DD;
  background: rgba(251, 253, 248, .95); color: #26332D; font: 13px/1.35 var(--pk-font, "Gowun Dodum", sans-serif);
  box-shadow: 0 2px 8px rgba(0,0,0,.15); pointer-events: auto; cursor: pointer; text-align: left; }
.lh-box[hidden] { display: none; }
.lh-box:focus-visible { outline: 3px solid #2F86A6; outline-offset: 2px; }
.lh-head { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; }
.lh-head .lh-e { font-size: 18px; }
.lh-dots { margin-left: auto; display: flex; gap: 3px; }
.lh-dots i { width: 9px; height: 9px; border-radius: 50%; background: #D6DDD2; display: block; }
.lh-dots i.is-done { background: #F2C14E; box-shadow: 0 0 0 1px #C9963A inset; }
.lh-dots i.is-now { background: #fff; box-shadow: 0 0 0 2px #2F86A6 inset; }
.lh-stage { margin: 3px 0 0; color: #3F5A66; }
.lh-list { margin: 4px 0 0; padding: 0; list-style: none; display: grid; gap: 1px; }
.lh-list li { display: flex; gap: 6px; }
.lh-list li .lh-n { margin-left: auto; font-variant-numeric: tabular-nums; color: #A8642E; }
.lh-list li.is-ok { color: #3F8F5C; }
.lh-list li.is-ok .lh-n { color: #3F8F5C; }
.lh-box.is-folded .lh-list { display: none; }
@media (max-width: 600px) and (orientation: portrait) {
  .lh-box { bottom: auto; top: calc(140px + var(--safe-t, 0px)); right: auto; left: calc(10px + var(--safe-l, 0px)); width: min(220px, calc(100vw - 20px)); font-size: 12px; }
}
`;

function ensureCss() {
  if (document.querySelector('style[data-lighthouse-css]')) return;
  const s = document.createElement('style');
  s.dataset.lighthouseCss = '';
  s.textContent = CSS;
  document.head.append(s);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/**
 * 진행판. show(view) — view = { stages: [{ name, emoji, state: 'done'|'now'|'todo' }], title, line, rows: [{ text, n?, ok }] } | null
 */
export function createProgressBox(mount) {
  ensureCss();
  const box = el('button', 'lh-box');
  box.type = 'button';
  box.hidden = true;
  const head = el('div', 'lh-head');
  const e = el('span', 'lh-e', '🗼');
  e.setAttribute('aria-hidden', 'true');
  const title = el('span', null, '등대 다시 켜기');
  const dots = el('span', 'lh-dots');
  head.append(e, title, dots);
  const stage = el('p', 'lh-stage');
  const list = el('ul', 'lh-list');
  box.append(head, stage, list);
  let folded = false;
  box.addEventListener('click', () => { folded = !folded; box.classList.toggle('is-folded', folded); box.blur(); });
  mount?.append(box);
  let last = '';
  return {
    el: box,
    show(view) {
      if (!view) { box.hidden = true; last = ''; return; }
      const key = JSON.stringify(view);
      box.hidden = false;
      if (key === last) return;
      last = key;
      dots.replaceChildren(...view.stages.map(s => { const i = el('i', s.state === 'done' ? 'is-done' : s.state === 'now' ? 'is-now' : ''); i.title = s.name; return i; }));
      stage.textContent = view.line;
      list.replaceChildren(...(view.rows ?? []).map(r => {
        const li = el('li', r.ok ? 'is-ok' : '');
        li.append(el('span', null, `${r.ok ? '✓' : '·'} ${r.text}`));
        if (r.n) li.append(el('span', 'lh-n', r.n));
        return li;
      }));
      const done = view.stages.filter(s => s.state === 'done').length;
      box.setAttribute('aria-label', `등대 다시 켜기 — ${done}/${view.stages.length}단계, ${view.line}. 누르면 할 것을 접거나 펴요`);
    },
    hide() { box.hidden = true; },
  };
}
