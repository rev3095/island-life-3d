// 이름 정하기 창: 내 이름 · 섬 이름 (한글 입력, 글자 수 제한, 🎲 추천) → ui.confirm 으로 한 번 더 묻고 → { player, island, guide }.
// 새 게임이면 첫날 안내를 '차근차근'(밤톨 설명 + 할 일 목록) / '짧게'(해 본 적 있는 사람: 밤톨 인사만, 목록 없이) 중에 고른다 (7차 D44-A).
// ui 창(panels)이 아니라 intro 자기 DOM 이다. 열려 있는 동안 게임 입력을 직접 막는다 (input.enabled = false, 키는 이 창 안에서만).
import { el } from './dom.js';
import { checkPlayerName, checkIslandName, countChars, suggest, tidy, NAME_MAX, ISLAND_MAX, ISLAND_SUFFIX } from './rules.js';

/**
 * opts: { mount, initial: { player, island }, again: 이미 하던 저장(첫 안내를 들은 뒤), rename: 정한 이름 바꾸기 (그만둘 수 있다) }
 * → Promise<{ player, island, guide: 'full'|'short' } | null>   (island 는 '…섬' 까지, null = 바꾸지 않고 그만둠 — rename 일 때만. guide 는 새 게임만)
 */
export function openNaming(ctx, { mount, initial = {}, again = false, rename = false } = {}) {
  return new Promise(resolve => {
    const touch = !!ctx.input?.touch;
    const field = ({ id, label, max, value, placeholder, suffix, enter }) => {
      const input = el('input', {
        id, class: 'fd-input', type: 'text', value: value ?? '', placeholder, maxlength: max + (suffix ? 1 : 0),
        autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'ko', enterkeyhint: enter,
        'aria-describedby': `${id}-err`,
      });
      const count = el('span', { class: 'fd-count', 'aria-hidden': 'true' });
      const err = el('p', { class: 'fd-err', id: `${id}-err`, 'aria-live': 'polite' });
      const dice = el('button', { type: 'button', class: 'fd-dice', title: '추천 이름', 'aria-label': `${label} 추천받기` }, '🎲');
      const box = el('div', { class: 'fd-field' },
        el('label', { class: 'fd-label', for: id }, label, count),
        el('div', { class: 'fd-row' }, el('div', { class: 'fd-input-wrap' }, input, suffix && el('span', { class: 'fd-suffix', 'aria-hidden': 'true' }, suffix)), dice),
        err);
      return { box, input, count, err, dice, max };
    };

    const name = field({ id: 'fd-player', label: '내 이름', max: NAME_MAX, value: initial.player, placeholder: '예) 하늘', enter: 'next' });
    const isle = field({ id: 'fd-island', label: '섬 이름', max: ISLAND_MAX, value: initial.island ? initial.island.replace(/섬$/, '') : '포근', placeholder: '예) 포근', suffix: ISLAND_SUFFIX, enter: 'done' });
    // 첫날 안내 고르기 (새 게임만): 두 단추 중 하나 (radio 처럼, aria-pressed)
    let guide = 'full';
    const mode = (value, label, sub) => el('button', { type: 'button', class: 'fd-mode', 'data-mode': value, 'aria-pressed': String(value === guide) },
      el('b', null, label), el('span', null, sub));
    const modes = rename || again ? null : [mode('full', '차근차근', '밤톨 설명 + 첫날 할 일'), mode('short', '짧게', '해 본 적 있어요')];
    const pick = v => { guide = v; for (const b of modes) b.setAttribute('aria-pressed', String(b.dataset.mode === v)); };
    modes?.forEach(b => b.addEventListener('click', () => { pick(b.dataset.mode); ctx.events.emit('sfx', { name: 'menu' }); }));
    const guideBox = modes && el('div', { class: 'fd-field fd-guide-pick', role: 'group', 'aria-labelledby': 'fd-guide-label' },
      el('span', { class: 'fd-label', id: 'fd-guide-label' }, '첫날 안내'), el('div', { class: 'fd-modes' }, modes),
      el('p', { class: 'fd-mode-note' }, '어느 쪽이든 섬폰 💡「안내」에서 다시 볼 수 있어요.'));
    const go = el('button', { type: 'button', class: 'fd-go' }, rename ? '이걸로 바꿀래요' : '이대로 정할래요');
    const stay = rename ? el('button', { type: 'button', class: 'fd-stay' }, '그대로 둘래요') : null;
    const lead = rename
      ? el('p', { class: 'fd-lead' }, el('b', { text: '내 이름' }), '과 ', el('b', { text: '섬 이름' }), '을 새로 정해요. 주민들도 새 이름으로 불러 줄 거예요.')
      : again
      ? el('p', { class: 'fd-lead' }, '아직 이름이 없네요! ', el('b', { text: '내 이름' }), '과 ', el('b', { text: '섬 이름' }), '을 정해 주세요. 주민들이 이 이름으로 불러 줄 거예요.')
      : el('p', { class: 'fd-lead' }, '섬 생활을 시작하기 전에 ', el('b', { text: '내 이름' }), '과 ', el('b', { text: '섬 이름' }), '을 정해 주세요. ',
        touch ? '🎲 단추를 누르면 이름을 추천해 줘요.' : '🎲 를 누르면 이름을 추천해 줘요.');
    const card = el('section', { class: 'fd-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fd-name-title' },
      el('h2', { class: 'fd-card-tag', id: 'fd-name-title', text: rename ? '이름 다시 정하기' : again ? '이름 정하기' : '어서 와요!' }), lead, name.box, isle.box, guideBox, el('div', { class: 'fd-foot' }, stay, go));
    const wrap = el('div', { class: 'fd-name' }, card);

    // 글자 수 (조합 중인 한글도 한 글자로 센다)
    const counted = f => {
      const n = countChars(tidy(f === isle ? f.input.value.replace(/섬$/, '') : f.input.value));
      f.count.textContent = `${n}/${f.max}`;
      f.count.classList.toggle('is-over', n > f.max);
    };
    for (const f of [name, isle]) {
      counted(f);
      f.input.addEventListener('input', e => {
        // 조합이 끝난 뒤에만 넘친 글자를 자른다 (조합 중에 자르면 한글이 깨진다)
        if (!e.isComposing) {
          const max = f.max + (f === isle && f.input.value.endsWith(ISLAND_SUFFIX) ? 1 : 0);
          const cs = Array.from(f.input.value);
          if (cs.length > max) f.input.value = cs.slice(0, max).join('');
        }
        counted(f);
        f.err.textContent = '';
      });
      f.input.addEventListener('compositionend', () => counted(f));
      f.dice.addEventListener('click', () => {
        const cur = tidy(f.input.value);
        f.input.value = suggest(f === name ? 'player' : 'island', Math.random, cur);
        counted(f);
        f.err.textContent = '';
        ctx.events.emit('sfx', { name: 'menu' });
        f.input.focus({ preventScroll: true });
      });
    }
    name.input.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      isle.input.focus();
    });
    isle.input.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      submit();
    });
    go.addEventListener('click', () => submit());
    stay?.addEventListener('click', () => cancel());

    // 창 밖으로 가는 키는 막는다 (가방·섬폰·이동 키가 게임에 가지 않게). Tab 은 창 안에서만 돈다
    let asking = false;
    const focusables = () => [name.input, name.dice, isle.input, isle.dice, ...(modes ?? []), stay, go].filter(Boolean);
    const onKey = e => {
      if (asking) return;                                  // 확인 창(ui.confirm)이 키를 받는다
      if (rename && e.key === 'Escape' && !e.isComposing) { e.preventDefault(); e.stopPropagation(); cancel(); return; }
      if (e.key === 'Tab') {
        const list = focusables(), i = list.indexOf(document.activeElement);
        e.preventDefault(); e.stopPropagation();
        list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
        return;
      }
      // 창 안: 글자 칸은 그대로 (다른 처리기들은 input 을 건너뛴다), 단추 위 키는 게임에 안 가게 (Space·Enter 누르기는 그대로 된다)
      if (wrap.contains(e.target)) { if (!e.target.closest('input')) e.stopPropagation(); return; }
      e.stopPropagation();
      e.preventDefault();
      name.input.focus({ preventScroll: true });
    };
    addEventListener('keydown', onKey, true);
    const wasEnabled = ctx.input.enabled;
    ctx.input.enabled = false;

    (mount ?? ctx.uiRoot).append(wrap);
    // 휴대폰은 글자판이 화면을 덮으니 바로 열지 않는다 (누르면 열림)
    if (!touch) setTimeout(() => (initial.player ? isle.input : name.input).focus({ preventScroll: true }), 60);

    async function submit() {
      if (asking) return;
      const a = checkPlayerName(name.input.value), b = checkIslandName(isle.input.value);
      name.err.textContent = a.error ?? '';
      isle.err.textContent = b.error ?? '';
      if (!a.ok || !b.ok) {
        card.classList.remove('is-shake'); void card.offsetWidth; card.classList.add('is-shake');
        (a.ok ? isle : name).input.focus({ preventScroll: true });
        return;
      }
      name.input.value = a.value;
      isle.input.value = b.base;
      const ui = ctx.services.ui;
      let ok = true;
      if (ui?.confirm) {
        asking = true;
        wrap.hidden = true;
        document.activeElement?.blur?.();
        try {
          ok = await ui.confirm({
            title: '이렇게 정할까요?', icon: '🏝️', cancelValue: false,
            text: `내 이름: ${a.value}\n섬 이름: ${b.value}${modes ? `\n첫날 안내: ${guide === 'short' ? '짧게' : '차근차근'}` : ''}\n\n이름은 나중에 섬폰 설정에서 다시 바꿀 수 있어요.`,
            buttons: [{ label: '좋아요!', value: true, primary: true }, { label: '다시 정할래요', value: false }],
          });
        } finally { asking = false; wrap.hidden = false; }
      }
      if (!ok) { if (!touch) name.input.focus({ preventScroll: true }); return; }
      close();
      resolve({ player: a.value, island: b.value, ...(modes ? { guide } : {}) });
    }

    function cancel() {
      if (asking) return;
      close();
      resolve(null);
    }

    function close() {
      removeEventListener('keydown', onKey, true);
      wrap.remove();
      // 다른 창이 열려 있지 않으면 게임 입력을 돌려준다
      if (!ctx.services.ui?.isBlocking?.()) ctx.input.enabled = wasEnabled !== false;
    }
  });
}
