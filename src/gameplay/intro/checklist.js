// 첫날 할 일 목록 (왼쪽 위 시계 아래, 자기 DOM). 머리를 누르면 접기·펴기 — 접으면 지금 할 일만 보인다.
// 지금 할 일 아래에 짧은 안내와 (가야 할 곳이 있으면) 화살표·거리. 머리 옆 ✕ = 건너뛰기 (7차 D44-A, 물어본 뒤 index.js 가 처리).
import { el } from './dom.js';

const REWARD_ROW = { id: 'reward', label: '밤톨에게 알려 주기', icon: '🎁' };

export function createChecklist(root, { onToggle, onSkip } = {}) {
  const n = el('span', { class: 'fd-head-n' });
  const caret = el('span', { class: 'fd-caret', 'aria-hidden': 'true' }, '▾');
  // 마우스·터치로 누른 뒤엔 포커스를 놓는다 (안 그러면 게임 중 Space 를 누를 때마다 같이 눌린다)
  const head = el('button', { type: 'button', class: 'fd-head', 'aria-expanded': 'true', onclick: e => { onToggle?.(); if (e.detail > 0) head.blur(); } },
    el('span', { 'aria-hidden': 'true' }, '📋'), el('span', { text: '첫날 할 일' }), n, caret);
  const skip = el('button', { type: 'button', class: 'fd-skip', 'aria-label': '첫날 할 일 건너뛰기', title: '건너뛰기 (섬폰 💡 안내에서 다시 볼 수 있어요)',
    onclick: e => { onSkip?.(); if (e.detail > 0) skip.blur(); } }, '✕');
  const list = el('ol', { class: 'fd-steps', 'aria-label': '첫날 할 일' });
  const box = el('aside', { class: 'fd-list is-away', 'aria-label': '첫날 할 일', role: 'region' }, el('div', { class: 'fd-head-row' }, head, skip), list);
  const hint = el('p', { class: 'fd-hint', 'aria-live': 'polite' });
  const arrow = el('span', { class: 'fd-arrow', 'aria-hidden': 'true' }, '⬆');
  const far = el('span');
  const dir = el('span', { class: 'fd-dir', hidden: true }, arrow, far);
  root.append(box);

  let rows = new Map();
  let lastKey = '';

  return {
    el: box,
    /** view = rules.viewOf(...) + { hint, collapsed } */
    render(view) {
      const key = JSON.stringify([view.steps.map(s => [s.id, s.done, s.current]), view.reward, view.finished]);
      const count = `${view.n}/${view.total}`;
      if (n.textContent !== count) n.textContent = count;
      box.classList.toggle('is-collapsed', !!view.collapsed);
      box.classList.toggle('is-done', !!view.finished);
      head.setAttribute('aria-expanded', view.collapsed ? 'false' : 'true');
      if (hint.textContent !== (view.hint ?? '')) hint.textContent = view.hint ?? '';   // 같은 글이면 다시 읽어 주지 않게
      if (key === lastKey) return;
      lastKey = key;
      const steps = view.reward ? [...view.steps, { ...REWARD_ROW, done: false, current: true }] : view.steps;
      rows = new Map();
      list.replaceChildren(...steps.map(s => {
        const li = el('li', { class: `fd-step${s.done ? ' is-done' : ''}${s.current ? ' is-current' : ''}`, 'data-step': s.id },
          el('span', { class: 'fd-mark', 'aria-hidden': 'true' }, s.done ? '✔' : ''),
          el('span', { class: 'fd-label-t' }, `${s.icon} ${s.label}`),
          el('span', { class: 'fd-sr', text: s.done ? ' (했어요)' : s.current ? ' (지금 할 일)' : '' }));
        if (s.current) li.append(hint, dir);
        rows.set(s.id, li);
        return li;
      }));
    },
    /** 화살표: angle = 화면 위 기준 시계 방향 라디안, dist = 칸 (null 이면 숨김) */
    direction(angle, dist) {
      if (angle == null || !(dist > 0)) { dir.hidden = true; return; }
      dir.hidden = false;
      arrow.style.transform = `rotate(${angle}rad)`;
      far.textContent = `${Math.round(dist)}칸`;
    },
    /** 방금 끝낸 단계 체크 표시를 튀게 */
    pop(id) {
      const li = rows.get(id);
      if (!li) return;
      li.classList.remove('is-pop'); void li.offsetWidth; li.classList.add('is-pop');
    },
    show(on) { box.classList.toggle('is-away', !on); },
    get shown() { return !box.classList.contains('is-away'); },
    remove() { box.remove(); },
  };
}
