// 도구 고르기 고리: HUD 도구 단추를 누르면 맨손과 가방에 있는 도구를 동그랗게 펼친다 (엄지로 한 번에 고르기).
// 고르면 창을 닫고 tool1~6 / toolNone 의도를 보낸다 — 드는 규칙(가방에 없는 도구는 못 든다)은 gather·player 가 정한다.
// 키보드는 Q·E·숫자키 그대로이고, 이 창에서는 방향키·Enter, 휴대폰은 A(고르기)·B(닫기).
import { h, toolSvg, TOOL_NAME } from './dom.js';

export function createToolRing(ctx, panels) {
  let current = null;

  function open() {
    if (current) return current.p.result;
    const TOOLS = ctx.constants?.TOOLS ?? ['rod', 'net', 'shovel', 'axe', 'can', 'sling'];
    const inv = ctx.services.data?.inventory;
    const owned = inv?.hasTool ? TOOLS.filter(t => inv.hasTool(t)) : TOOLS;
    const now = ctx.services.player?.tool ?? null;
    const list = [null, ...owned];
    let p;

    const mid = h('div', { class: 'pk-toolring-mid', 'aria-hidden': 'true' });
    const say = t => mid.replaceChildren(h('b', null, TOOL_NAME[t ?? 'none']),
      h('span', null, !owned.length ? '가방에 도구가 없어요' : t === now ? '지금 든 것' : '눌러서 들기'));
    const btns = list.map((t, i) => {
      const slot = t && inv?.findTool ? inv.slots?.[inv.findTool(t)] : null;
      const b = h('button', {
        type: 'button', class: `pk-toolring-btn${t === now ? ' is-on' : ''}`, role: 'menuitemradio', 'aria-checked': String(t === now),
        'aria-label': `${TOOL_NAME[t ?? 'none']}${slot?.uses != null ? `, ${slot.uses}번 더 쓸 수 있어요` : ''}`,
        html: toolSvg(t ?? 'none'),
        onclick: () => { if (!p.fresh()) p.close({ tool: t }); },
        onfocus: () => say(t),
        onpointerenter: () => say(t),
      });
      b.style.setProperty('--a', `${(360 / list.length) * i}deg`);   // 0 = 위, 시계 방향
      if (slot?.uses != null) b.append(h('span', { class: 'pk-toolring-uses', 'aria-hidden': 'true' }, slot.uses));
      return b;
    });
    const ring = h('div', { class: 'pk-toolring', role: 'menu', 'aria-label': '도구 고르기' }, mid, btns);
    const root = h('div', { class: 'pk-scrim pk-toolring-scrim' }, ring);
    root.addEventListener('click', e => { if (e.target === root) p.close(null); });
    say(now);

    p = panels.open('tools', root, {
      initialFocus: () => btns[Math.max(0, list.indexOf(now))],
      onKey(e) {
        // 1~6·0 은 이 창에서도 바로 고른다
        const n = /^Digit([0-6])$/.exec(e.code);
        if (!n) return false;
        const t = n[1] === '0' ? null : TOOLS[n[1] - 1];
        if (list.includes(t)) p.close({ tool: t });
        return true;
      },
      onClose: () => { current = null; },
    });
    current = { p };
    ctx.events.emit('sfx', { name: 'menu' });
    return p.result.then(r => {
      if (!r || r.tool === now) return r;
      // 창이 막고 있는 동안(닫은 입력이 끝날 때까지)은 게임이 의도를 무시하므로 한 박자 뒤에 보낸다
      setTimeout(() => ctx.input.press?.(r.tool ? `tool${TOOLS.indexOf(r.tool) + 1}` : 'toolNone'), 0);
      return r;
    });
  }

  return { open };
}
