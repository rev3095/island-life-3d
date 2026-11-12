// M18-P3 대회 창 UI-34 (15차 보드 wave15 D194-A): 대회 중에만 화면 위 가운데에 뜨는 작은 칸 — 창을 막지 않는다 (ui.isBlocking 과 상관없음).
// ⏱ 남은 시간 · 지금 내 기록(가장 큰 것 · 마릿수 · 점수) · 순위 넷. 휴대폰(560px 이하)은 위 한 줄 (남은 시간 · 내 순위 · 점수).

const CSS = `
.ct-box { position: absolute; top: calc(10px + var(--safe-t, 0px)); left: 50%; transform: translateX(-50%); z-index: 6; pointer-events: none;
  min-width: 240px; max-width: min(360px, calc(100vw - 24px)); padding: 8px 12px; border-radius: 14px; border: 2px solid #F2C14E;
  background: rgba(251, 253, 248, .95); color: #26332D; font: 14px/1.3 var(--pk-font, "Gowun Dodum", sans-serif); box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.ct-box[hidden] { display: none; }
.ct-top { display: flex; align-items: baseline; gap: 10px; }
.ct-name { font-weight: 700; }
.ct-time { margin-left: auto; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; color: #A8642E; }
.ct-time.is-low { color: #D9483B; }
.ct-me { margin: 4px 0 6px; font-size: 13px; color: #3F5A4C; }
.ct-me b { color: #26332D; }
.ct-rank { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; font-size: 13px; }
.ct-rank li { display: grid; grid-template-columns: 22px 1fr auto auto; gap: 8px; align-items: baseline; padding: 1px 4px; border-radius: 6px; }
.ct-rank li.is-me { background: #FFF3CC; font-weight: 700; }
.ct-rank .ct-r { text-align: center; }
.ct-rank .ct-b { color: #5F7268; font-variant-numeric: tabular-nums; }
.ct-rank .ct-s { font-variant-numeric: tabular-nums; }
.ct-line { display: none; }
@media (max-width: 560px) {
  /* 휴대폰: 맨 위 줄은 시계 HUD·가방 단추가 차지해서, 시계 칸 바로 밑 가운데 한 줄 (펼친 시계만큼 --pk-clock-extra 로 내려감) */
  .ct-box { min-width: 0; max-width: calc(100vw - 20px); padding: 4px 12px; border-radius: 999px; font-size: 13px; top: calc(128px + var(--pk-clock-extra, 0px) + var(--safe-t, 0px)); }
  .ct-top, .ct-me, .ct-rank { display: none; }
  .ct-line { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
}
`;

export function ensureContestCss() {
  if (document.querySelector('style[data-contest-css]')) return;
  const s = document.createElement('style');
  s.dataset.contestCss = '';
  s.textContent = CSS;
  document.head.append(s);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
const MEDAL = ['🥇', '🥈', '🥉'];

/** UI-34 → { show(view), hide(), el } — view = { emoji, name, left('m:ss'), low, me: {best, count, score, rank}, rows: [{rank, name, best, count, score, me}], unit } */
export function createContestBox(root) {
  ensureContestCss();
  const box = el('div', 'ct-box');
  box.hidden = true;
  box.dataset.contest = '';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'off');
  const top = el('div', 'ct-top'), name = el('span', 'ct-name'), time = el('span', 'ct-time');
  top.append(name, time);
  const me = el('div', 'ct-me'), list = el('ol', 'ct-rank'), line = el('div', 'ct-line');
  box.append(top, me, list, line);
  root?.append(box);
  let last = '';
  return {
    el: box,
    show(v) {
      const key = JSON.stringify(v);
      box.hidden = false;
      if (key === last) return;
      last = key;
      name.textContent = `${v.emoji} ${v.name}`;
      time.textContent = `⏱ ${v.left}`;
      time.classList.toggle('is-low', !!v.low);
      me.innerHTML = '';
      me.append('내 기록 ', el('b', null, v.me.count ? `${v.me.best}cm` : '—'), ` · ${v.me.count}${v.unit} · `, el('b', null, `${v.me.score}점`));
      list.innerHTML = '';
      for (const r of v.rows) {
        const li = el('li', r.me ? 'is-me' : '');
        li.append(el('span', 'ct-r', MEDAL[r.rank - 1] ?? `${r.rank}`), el('span', null, r.name), el('span', 'ct-b', r.count ? `${r.best}cm·${r.count}` : '—'), el('span', 'ct-s', `${r.score}점`));
        list.append(li);
      }
      line.textContent = `${v.emoji} ⏱ ${v.left} · ${v.me.rank}위 · ${v.me.score}점 · ${v.me.count}${v.unit}`;
    },
    hide() { box.hidden = true; last = ''; },
  };
}
