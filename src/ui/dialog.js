// 대화창: 이름표 + 한 글자씩 나오는 대사 + ▼. 행동 키·클릭·Enter 로 넘기고, 마지막에 선택지를 고른다.
// 여러 대화가 한꺼번에 오면 차례로 보여준다. 한 줄 나올 때마다 dialog:line 을 보낸다 (audio 가 목소리를 낸다).
import { h, inkOn, SPEAKERS } from './dom.js';

const CPS = 34;                       // 초당 글자 수
const PAUSE = { '.': 0.16, '!': 0.16, '?': 0.16, '~': 0.12, ',': 0.08, '…': 0.2 };

export function createDialog(ctx, panels) {
  let chain = Promise.resolve();
  let active = null;   // 지금 보여주는 대화의 타자기 상태

  function open(opts = {}) {
    const run = chain.then(() => show(opts));
    chain = run.catch(() => {});
    return run;
  }

  function show({ speaker = '', color, lines = [], voice, choices } = {}) {
    const list = (Array.isArray(lines) ? lines : [lines]).map(l => String(l ?? ''));
    const opts = Array.isArray(choices) && choices.length ? choices.map(String) : null;
    if (!list.length && !opts) return Promise.resolve(null);
    if (!list.length) list.push('');
    const known = SPEAKERS[voice] ?? Object.values(SPEAKERS).find(s => s.name === speaker);
    const tagColor = color ?? known?.color ?? '#F2B36B';

    const text = h('p', { class: 'pk-dlg-text' });
    const next = h('span', { class: 'pk-next', 'aria-hidden': 'true', style: { color: tagColor } }, '▼');
    const live = h('p', { class: 'pk-sr', 'aria-live': 'polite' });
    const choiceBox = h('div', { class: 'pk-choices', role: 'group', 'aria-label': '대답 고르기', hidden: true });
    const box = h('div', { class: 'pk-dlg-box', tabindex: '-1', role: 'dialog', 'aria-label': speaker ? `${speaker}의 말` : '대화' },
      speaker && h('span', { class: 'pk-name', style: { background: tagColor, color: inkOn(tagColor) } }, speaker),
      text, next, live);
    const root = h('div', { class: 'pk-dialog' }, h('div', { class: 'pk-dlg-catch' }), h('div', { class: 'pk-dlg-wrap' }, choiceBox, box));

    const st = { i: -1, chars: [], shown: 0, wait: 0, typing: false, choicesShown: false };
    let p;

    const finishLine = () => {
      st.shown = st.chars.length; st.typing = false;
      text.textContent = st.chars.join('');
      const last = st.i >= list.length - 1;
      if (last && opts) showChoices();
      else box.classList.add('is-ready');
    };
    const nextLine = () => {
      st.i++;
      const line = list[st.i];
      st.chars = Array.from(line);
      st.shown = 0; st.wait = 0.05; st.typing = true;
      text.textContent = '';
      box.classList.remove('is-ready');
      live.textContent = speaker ? `${speaker}: ${line}` : line;
      if (line) ctx.events.emit('dialog:line', { speaker, text: line, voice });
      if (!st.chars.length) finishLine();
    };
    const showChoices = () => {
      st.choicesShown = true;
      box.classList.remove('is-ready');
      choiceBox.replaceChildren(...opts.map((c, i) => h('button', { type: 'button', class: 'pk-choice', onclick: () => p.close(i) }, c)));
      choiceBox.hidden = false;
      choiceBox.querySelector('button')?.focus({ preventScroll: true });
    };
    const advance = () => {
      if (p.fresh() || st.choicesShown) return;
      if (st.typing) finishLine();
      else if (st.i < list.length - 1) nextLine();
      else p.close(null);
    };
    st.tick = dt => {
      if (!st.typing) return;
      st.wait -= dt;
      while (st.typing && st.wait <= 0) {
        const ch = st.chars[st.shown++];
        st.wait += 1 / CPS + (PAUSE[ch] ?? 0);
        if (st.shown >= st.chars.length) finishLine();
        else text.textContent = st.chars.slice(0, st.shown).join('');
      }
    };

    root.querySelector('.pk-dlg-catch').addEventListener('click', advance);
    box.addEventListener('click', advance);

    p = panels.open('dialog', root, {
      initialFocus: () => box,
      onAction: () => (st.choicesShown ? document.activeElement?.closest?.('.pk-choice')?.click() : advance()),
      onCancel: () => (st.choicesShown ? p.close(null) : advance()),
      onKey(e) {
        const go = e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space';
        if (st.choicesShown) {
          if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            const bs = [...choiceBox.querySelectorAll('button')];
            const i = bs.indexOf(document.activeElement);
            bs[(i + (e.code === 'ArrowUp' ? -1 : 1) + bs.length) % bs.length]?.focus();
            return true;
          }
          return false;   // Enter 는 포커스된 선택지를 누르고, Esc 는 고르지 않고 닫는다
        }
        if (go || e.code === 'Escape') { if (!e.repeat) advance(); return true; }
        return e.code.startsWith('Arrow');
      },
      onClose: () => { if (active === st) active = null; },
    });
    active = st;
    nextLine();
    return p.result;
  }

  return {
    open,
    update(dt) { active?.tick(dt); },
  };
}
