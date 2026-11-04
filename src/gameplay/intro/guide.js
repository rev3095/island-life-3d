// 7차 M7-P5: 힌트 카드(화면 오른쪽 위, 잠깐 떴다 사라짐)와 섬폰 「💡 안내」 창 — 둘 다 intro 자기 DOM.
// 창은 ctx.services.ui.panel 로 열어 섬폰 위에 쌓는다 (ui.guide.open 을 intro 가 채우고, 섬폰 APPS 의 'guide' 줄이 그것을 부른다).
// 겉모양은 ui 창과 같게 ui.css 의 .pk-scrim·.pk-card 를 빌리고, 안쪽만 intro.css 의 .fd-guide-*.
import { el } from './dom.js';

const SHOW_MS = 14000;   // 힌트 카드가 떠 있는 시간

/** 힌트 카드 하나 (새 힌트가 오면 바꿔 끼운다). mount = intro 맨 위 층 */
export function createTipCard(mount) {
  const icon = el('span', { class: 'fd-tip-icon', 'aria-hidden': 'true' });
  const title = el('b', { class: 'fd-tip-title' });
  const text = el('p', { class: 'fd-tip-text' });
  const more = el('p', { class: 'fd-tip-more' }, '섬폰 💡「안내」에서 다시 볼 수 있어요');
  const ok = el('button', { type: 'button', class: 'fd-tip-ok', onclick: e => { hide(); if (e.detail > 0) ok.blur(); } }, '알겠어요');
  const box = el('aside', { class: 'fd-tip', role: 'status', 'aria-live': 'polite', 'aria-label': '힌트', hidden: true },
    icon, el('div', { class: 'fd-tip-body' }, title, text, more), ok);
  mount.append(box);
  let timer = 0, current = null;
  function hide() { clearTimeout(timer); current = null; box.classList.add('is-out'); timer = setTimeout(() => { box.hidden = true; box.classList.remove('is-out'); }, 250); }
  return {
    el: box,
    /** tip = { icon, title, text }, opts.again = '섬폰에서 다시 볼 수 있어요' 줄 */
    show(tip, { again = tip.again !== false, ms = SHOW_MS } = {}) {
      clearTimeout(timer);
      current = tip;
      icon.textContent = tip.icon ?? '💡';
      title.textContent = tip.title ?? '';
      text.textContent = tip.text ?? '';
      more.hidden = !again;
      box.hidden = false;
      box.classList.remove('is-out', 'is-new'); void box.offsetWidth; box.classList.add('is-new');
      timer = setTimeout(hide, ms);
    },
    hide,
    get shown() { return !box.hidden; },
    /** 떠 있는 힌트 (가려야 할 때 나중에 다시 띄우려고) */
    get current() { return current; },
  };
}

/**
 * 섬폰 「안내」 창. src = 그릴 것을 그때그때 주는 함수들:
 * { steps() → [{ id, icon, label, done, hint }], listShown(), canToggleList(), toggleList(), skipped(),
 *   friends() → [{ name, friendship, need, wins, needWins, open, part }] | null, tips() → [{ icon, title, text, day }], relisten() }
 */
export function openGuide(ctx, src) {
  const ui = ctx.services.ui;
  let p;
  const close = () => p?.close(null);
  const titleId = `fd-guide-${Math.random().toString(36).slice(2, 8)}`;
  const body = el('div', { class: 'pk-card-body fd-guide-body' });
  const card = el('section', { class: 'pk-card fd-guide', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    el('header', { class: 'pk-card-head' },
      el('h2', { class: 'pk-card-title', id: titleId }, el('span', { 'aria-hidden': 'true' }, '💡'), ' 안내'),
      el('button', { type: 'button', class: 'pk-x', 'aria-label': '닫기', onclick: close }, '✕')),
    body);
  const root = el('div', { class: 'pk-scrim fd-guide-scrim' }, card);
  root.addEventListener('click', e => { if (e.target === root) close(); });

  const head = t => el('h3', { class: 'fd-guide-head' }, t);
  const btn = (label, onclick, primary) => el('button', { type: 'button', class: `pk-btn fd-guide-btn${primary ? ' is-primary' : ''}`, onclick }, label);

  function draw() {
    const kids = [];
    // 첫날 할 일 (건너뛰었어도 하는 법은 볼 수 있게)
    const steps = src.steps();
    kids.push(head(src.skipped() ? '첫날 할 일 (건너뜀 — 하는 법은 그대로)' : '첫날 할 일'),
      el('ol', { class: 'fd-guide-steps' }, steps.map(s => el('li', { class: `fd-guide-step${s.done ? ' is-done' : ''}` },
        el('span', { class: 'fd-guide-mark', 'aria-hidden': 'true' }, s.done ? '✔' : ''),
        el('div', null,
          el('b', { class: 'fd-guide-label' }, `${s.icon} ${s.label}`, el('span', { class: 'fd-sr' }, s.done ? ' (했어요)' : '')),
          el('p', { class: 'fd-guide-hint' }, s.hint))))));
    if (src.canToggleList()) {
      kids.push(el('div', { class: 'fd-guide-row' }, btn(src.listShown() ? '왼쪽 목록 치우기' : '왼쪽 목록 다시 띄우기', () => { src.toggleList(); draw(); })));
    }
    // 밤톨 설명
    kids.push(head('조작'), el('p', { class: 'fd-guide-note' }, '걷기·말 걸기·줍기·도구·가방 여는 법을 밤톨이 다시 알려 줘요.'),
      el('div', { class: 'fd-guide-row' }, btn('밤톨 설명 다시 듣기', () => src.relisten(), true)));
    // 축제 친구 (축제 이야기가 시작된 뒤)
    const friends = src.friends();
    if (friends?.length) {
      kids.push(head('축제 준비 — 친해진 정도'),
        el('p', { class: 'fd-guide-note' }, '💗 친밀도와 🙂 마음이 통한 일(이모티콘 대화 성공 · 좋아하는 선물 · 부탁 들어주기)이 둘 다 차면 🎉 로 축제 준비물을 알려 줘요.'),
        el('ul', { class: 'fd-guide-friends' }, friends.map(f => el('li', { class: `fd-guide-friend${f.part ? ' is-part' : f.open ? ' is-open' : ''}` },
          el('b', null, f.name),
          f.part ? el('span', null, '✔ 부품 받음')
            : f.open ? el('span', null, '💗 마음이 통함 — 🎉 를 보내 봐요')
            : el('span', null, el('span', { class: 'fd-meter', role: 'img', 'aria-label': `친밀도 ${f.friendship}/${f.need}` }, el('i', { style: { width: `${Math.min(100, Math.round(f.friendship / f.need * 100))}%` } })),
              ` 💗 ${f.friendship}/${f.need} · 🙂 ${Math.min(f.wins, f.needWins)}/${f.needWins}`)))));
    }
    // 지난 힌트
    const tips = src.tips();
    kids.push(head('지난 힌트'));
    if (!tips.length) kids.push(el('p', { class: 'fd-guide-note' }, '아직 없어요. 막히는 곳이 있으면 화면 오른쪽 위에 힌트가 떠요.'));
    else kids.push(el('ul', { class: 'fd-guide-tips' }, tips.map(t => el('li', { class: 'fd-guide-tip' },
      el('span', { class: 'fd-guide-tip-icon', 'aria-hidden': 'true' }, t.icon), el('div', null, el('b', null, t.title), el('p', null, t.text))))));
    body.replaceChildren(...kids);
  }

  draw();
  p = ui.panel('guide', root, { initialFocus: () => body.querySelector('button') ?? card });
  return p.result;
}
