// 도토리상점: 사기(진열 목록) / 팔기(가방 팔기 모드). 거래는 data 서비스(wallet·inventory)로 한다.
import { h, fmt, itemInfo, iconEl } from './dom.js';
import { panelShell, button, confirmBox } from './panels.js';
import { itemPhrase } from './bag.js';
import { notice } from './phone.js';

export function createShop(ctx, panels, { bag, toast }) {
  let current = null;

  function open({ stock = [], title = '도토리상점', keeper = '밤톨', color = '#C7743E', tab: startTab } = {}) {
    if (current) return current.p.result;
    let p, tab = startTab === 'sell' ? 'sell' : 'buy';
    const data = () => ctx.services.data;
    const shell = panelShell({ cls: 'pk-shop', title, tagColor: color, onClose: () => p.close(null), onOutside: () => p.close(null) });
    const wallet = h('span', { class: 'pk-wallet' });
    const tabs = h('div', { class: 'pk-tabs', role: 'tablist', 'aria-label': '사기 팔기' });
    const view = h('div', { class: 'pk-shop-view', role: 'tabpanel' });
    shell.body.append(h('p', { class: 'pk-keeper' }, h('b', null, keeper), ' 어서 와요! 천천히 둘러봐요.'), tabs, view);
    shell.foot.append(wallet);

    const acorns = () => data()?.wallet?.get?.() ?? ctx.state.wallet?.acorns ?? 0;
    function draw(focusSel) {
      wallet.textContent = `🌰 ${fmt(acorns())}`;
      wallet.setAttribute('aria-label', `가진 도토리 ${fmt(acorns())}개`);
      tabs.replaceChildren(...[['buy', '사기'], ['sell', '팔기']].map(([id, t]) => h('button', {
        type: 'button', role: 'tab', class: 'pk-tab', 'aria-selected': String(tab === id), tabindex: tab === id ? '0' : '-1',
        onclick: () => { tab = id; draw('[role="tab"][aria-selected="true"]'); },
      }, t)));
      view.replaceChildren();
      if (!data()?.wallet) view.append(notice('🏪', '가게가 아직 문을 열지 않았어요.', '데이터(data) 모듈이 연결되면 사고팔 수 있어요.'));
      else if (tab === 'buy') {
        if (!stock.length) view.append(notice('📦', '오늘은 물건이 다 팔렸어요.', '내일 다시 와 주세요.'));
        else view.append(h('ul', { class: 'pk-stock' }, stock.map(id => {
          const it = itemInfo(ctx, id);
          const short = it.buy > acorns();
          return h('li', null, h('button', { type: 'button', class: `pk-stock-item${short ? ' is-short' : ''}`, dataset: { id }, onclick: () => buy(id),
            'aria-label': `${it.name}, ${fmt(it.buy)}도토리${short ? ', 도토리가 모자라요' : ''}` },
          iconEl(it.icon, 'pk-stock-icon'), h('span', { class: 'pk-stock-name' }, it.name), h('span', { class: 'pk-price' }, `🌰 ${fmt(it.buy)}`)));
        })));
      } else {
        view.append(h('div', { class: 'pk-sell' }, h('p', null, '가방에서 팔 물건을 고르면 값을 쳐 줄게요.'),
          button('🎒 팔 물건 고르기', { primary: true, cls: 'pk-sell-go', onclick: sellLoop })));
      }
      (focusSel && shell.card.querySelector(focusSel))?.focus({ preventScroll: true });
    }

    async function buy(id) {
      if (p.fresh()) return;
      const d = data();
      const it = itemInfo(ctx, id);
      if (it.buy > acorns()) { toast('도토리가 모자라요', '🌰'); return; }
      if (d.inventory?.isFull?.()) { toast('가방이 꽉 찼어요', '🎒'); return; }
      const ok = await confirmBox(panels, { title: '사기', icon: it.icon, text: `${itemPhrase(it.name)} 🌰 ${fmt(it.buy)}에 살까요?`, buttons: [{ label: '살게요', value: true, primary: true }, { label: '그만둘래요', value: false }] });
      if (!ok || p.closed) return;
      if (!d.wallet.spend(it.buy)) { toast('도토리가 모자라요', '🌰'); return; }
      if (!(d.inventory.add(id, 1) > 0)) { d.wallet.add(it.buy); toast('가방이 꽉 찼어요', '🎒'); return; }
      ctx.events.emit('sfx', { name: 'acorn' });
      toast(`${it.name} 샀어요!`, it.icon);
      draw(`[data-id="${CSS.escape(id)}"]`);
    }

    async function sellLoop() {
      if (p.fresh()) return;
      const d = data();
      for (;;) {
        const i = await bag.open({ mode: 'sell' });
        if (i == null || p.closed) break;
        const slot = d.inventory.slots[i];
        if (!slot) continue;
        const it = itemInfo(ctx, slot.id);
        const buttons = slot.count > 1
          ? [{ label: `모두 팔기 (🌰 ${fmt(it.sell * slot.count)})`, value: slot.count, primary: true }, { label: `1개만 (🌰 ${fmt(it.sell)})`, value: 1 }, { label: '그만둘래요', value: 0 }]
          : [{ label: '팔게요', value: 1, primary: true }, { label: '그만둘래요', value: 0 }];
        const n = await confirmBox(panels, { title: '팔기', icon: it.icon, cancelValue: 0, buttons,
          text: slot.count > 1 ? `${it.name} ${slot.count}개, 하나에 🌰 ${fmt(it.sell)}이에요. 몇 개 팔까요?` : `${itemPhrase(it.name)} 🌰 ${fmt(it.sell)}에 팔까요?` });
        if (!n || p.closed) continue;
        d.inventory.remove(i, n);
        d.wallet.add(it.sell * n);
        ctx.events.emit('sfx', { name: 'sell' });
        toast(`${it.name}${n > 1 ? ` ${n}개` : ''} 팔고 🌰 ${fmt(it.sell * n)} 받았어요`, '🌰');
      }
      if (!p.closed) draw('.pk-sell-go');
    }

    draw();
    const offs = [ctx.events.on('wallet:changed', () => draw()), ctx.events.on('inventory:changed', () => draw())];
    p = panels.open('shop', shell.root, {
      initialFocus: () => view.querySelector('button') ?? tabs.querySelector('button'),
      onKey(e) {
        if (e.target.closest?.('[role="tab"]') && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
          tab = tab === 'buy' ? 'sell' : 'buy'; draw('[role="tab"][aria-selected="true"]'); return true;
        }
        return false;
      },
      onClose: () => { offs.forEach(f => f()); current = null; },
    });
    current = { p };
    return p.result;
  }

  return { open };
}
