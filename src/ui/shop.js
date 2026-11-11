// 도토리상점: 사기(진열 목록) / 팔기(가방 팔기 모드). 거래는 data 서비스(wallet·inventory)로 한다.
// 사기 탭 아래 '오늘의 벽지·바닥' 코너 (5차 Z2): house.interior.today() 가 날마다 하나씩 고른 것. 산 것은 가방이 아니라 집 꾸미기 목록(house.interior.add)에 들어간다.
// 11차 D102-A '오늘의 옷' 코너 (clothes: true — 도토리상점만): outfit.today() 의 옷 둘. 산 옷은 가방이 아니라 옷장(outfit 옷장 목록)에, 첫 옷이면 옷장 가구도.
import { h, fmt, itemInfo, iconEl, josa } from './dom.js';
import { panelShell, button, confirmBox } from './panels.js';
import { itemPhrase } from './bag.js';
import { notice } from './phone.js';

const DECOR_NAME = { wallpaper: '벽지', floor: '바닥' };
const DECOR_ICON = { wallpaper: '🖼️', floor: '🟫' };
// 받침 맞춘 조사: 벽지를·벽지로·벽지예요 / 바닥을·바닥으로·바닥이에요
const DECOR_JOSA = { wallpaper: { obj: '를', to: '로', is: '예요' }, floor: { obj: '을', to: '으로', is: '이에요' } };

export function createShop(ctx, panels, { bag, toast }) {
  let current = null;

  /** only = 'sell' 이면 팔기 탭만 (첫날 밤 문 너머 장사, 7차 D51-A), greet = 주인 한 줄 */
  function open({ stock = [], title = '도토리상점', keeper = '밤톨', color = '#C7743E', tab: startTab, only = null, clothes = false, greet = ' 어서 와요! 천천히 둘러봐요.' } = {}) {
    if (current) return current.p.result;
    let p, tab = only === 'sell' || startTab === 'sell' ? 'sell' : 'buy';
    const data = () => ctx.services.data;
    const shell = panelShell({ cls: 'pk-shop', title, tagColor: color, onClose: () => p.close(null), onOutside: () => p.close(null) });
    const wallet = h('span', { class: 'pk-wallet' });
    const tabs = h('div', { class: 'pk-tabs', role: 'tablist', 'aria-label': '사기 팔기' });
    const view = h('div', { class: 'pk-shop-view', role: 'tabpanel' });
    shell.body.append(h('p', { class: 'pk-keeper' }, h('b', null, keeper), greet), tabs, view);
    shell.foot.append(wallet);

    const acorns = () => data()?.wallet?.get?.() ?? ctx.state.wallet?.acorns ?? 0;
    function draw(focusSel) {
      wallet.textContent = `🌰 ${fmt(acorns())}`;
      wallet.setAttribute('aria-label', `가진 도토리 ${fmt(acorns())}개`);
      tabs.replaceChildren(...[['buy', '사기'], ['sell', '팔기']].filter(([id]) => !only || id === only).map(([id, t]) => h('button', {
        type: 'button', role: 'tab', class: 'pk-tab', 'aria-selected': String(tab === id), tabindex: tab === id ? '0' : '-1',
        onclick: () => { tab = id; draw('[role="tab"][aria-selected="true"]'); },
      }, t)));
      view.replaceChildren();
      if (!data()?.wallet) view.append(notice('🏪', '가게가 아직 문을 열지 않았어요.', '데이터(data) 모듈이 연결되면 사고팔 수 있어요.'));
      else if (tab === 'buy') {
        const corner = decorCorner();   // 날마다 바뀌는 것이라 맨 위에
        if (corner) view.append(corner);
        const cl = clothes ? clothesCorner() : null;
        if (cl) view.append(cl);
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
      // 빈칸이 없어도 같은 물건 칸에 겹쳐 담을 수 있으면 산다 (가진 씨앗 봉투 등 — 예전엔 빈칸만 봐서 못 샀다)
      const fits = d.inventory?.canFit ? d.inventory.canFit(id, 1) > 0 : !d.inventory?.isFull?.();
      if (!fits) { toast('가방이 꽉 찼어요', '🎒'); return; }
      const ok = await confirmBox(panels, { title: '사기', icon: it.icon, text: `${itemPhrase(it.name)} 🌰 ${fmt(it.buy)}에 살까요?`, buttons: [{ label: '살게요', value: true, primary: true }, { label: '그만둘래요', value: false }] });
      if (!ok || p.closed) return;
      if (!d.wallet.spend(it.buy)) { toast('도토리가 모자라요', '🌰'); return; }
      if (!(d.inventory.add(id, 1) > 0)) { d.wallet.add(it.buy); toast('가방이 꽉 찼어요', '🎒'); return; }
      ctx.events.emit('sfx', { name: 'acorn' });
      toast(`${it.name} 샀어요!`, it.icon);
      draw(`[data-id="${CSS.escape(id)}"]`);
    }

    // ── 오늘의 벽지·바닥 ──
    const decor = () => ctx.services.house?.interior;
    function decorCorner() {
      let today = [];
      try { today = decor()?.today?.() ?? []; } catch (e) { console.warn('[shop] 오늘의 벽지·바닥', e); }
      if (!today.length) return null;
      return h('section', { class: 'pk-shop-decor', 'aria-label': '오늘의 벽지·바닥', style: { marginBottom: '14px' } },
        h('p', { class: 'pk-keeper', style: { margin: '0 0 8px' } }, h('b', null, '오늘의 벽지·바닥'), ' 날마다 바뀌어요'),
        h('ul', { class: 'pk-stock' }, today.map(d => {
          const short = !d.owned && d.price > acorns();
          const kind = DECOR_NAME[d.kind] ?? '';
          return h('li', null, h('button', { type: 'button', class: `pk-stock-item${short ? ' is-short' : ''}${d.owned ? ' is-owned' : ''}`, dataset: { decor: d.slug }, onclick: () => buyDecor(d),
            'aria-label': `${kind} ${d.name}${d.shopOnly ? ', 상점 한정' : ''}, ${d.owned ? '이미 가지고 있어요' : `${fmt(d.price)}도토리${short ? ', 도토리가 모자라요' : ''}`}` },
          d.swatch ? h('img', { class: 'pk-stock-icon', src: d.swatch, alt: '', style: { borderRadius: '10px', boxShadow: 'inset 0 0 0 2px rgba(74,59,50,.15)' } }) : iconEl(DECOR_ICON[d.kind], 'pk-stock-icon'),
          h('span', { class: 'pk-stock-name' }, `${d.name} ${kind}`, d.shopOnly ? h('small', { style: { display: 'block', fontSize: '12px', opacity: '.7' } }, '상점 한정') : null),
          h('span', { class: 'pk-price', style: d.owned ? { opacity: '.6' } : null }, d.owned ? '가지고 있어요' : `🌰 ${fmt(d.price)}`)));
        })));
    }

    // ── 11차 오늘의 옷 (옷 진열대 FU-54) ──
    const outfit = () => ctx.services.outfit;
    function clothesCorner() {
      let today = [];
      try { today = outfit()?.today?.() ?? []; } catch (e) { console.warn('[shop] 오늘의 옷', e); }
      if (!today.length) return null;
      return h('section', { class: 'pk-shop-decor pk-shop-clothes', 'aria-label': '오늘의 옷', style: { marginBottom: '14px' } },
        h('p', { class: 'pk-keeper', style: { margin: '0 0 8px' } }, h('b', null, '오늘의 옷'), ' 문 옆 옷 진열대 · 날마다 바뀌어요'),
        h('ul', { class: 'pk-stock' }, today.map(c => {
          const short = !c.owned && c.buy > acorns();
          return h('li', null, h('button', { type: 'button', class: `pk-stock-item${short ? ' is-short' : ''}${c.owned ? ' is-owned' : ''}`, dataset: { clothes: c.id }, onclick: () => buyClothes(c),
            'aria-label': `${c.slotName} ${c.name}, ${c.owned ? '옷장에 있어요' : `${fmt(c.buy)}도토리${short ? ', 도토리가 모자라요' : ''}`}` },
          c.thumb ? iconEl(c.thumb, 'pk-stock-icon pk-stock-thumb') : iconEl('👕', 'pk-stock-icon'),
          h('span', { class: 'pk-stock-name' }, c.name, h('small', { style: { display: 'block', fontSize: '12px', opacity: '.7' } }, c.slotName)),
          h('span', { class: 'pk-price', style: c.owned ? { opacity: '.6' } : null }, c.owned ? '옷장에 있어요' : `🌰 ${fmt(c.buy)}`)));
        })));
    }

    async function buyClothes(c) {
      if (p.fresh()) return;
      const O = outfit();
      if (!O) return;
      if (O.owns(c.id)) { toast(`이미 옷장에 있는 ${josa(c.slotName, '이에요/예요')}. 집 옷장에서 갈아입을 수 있어요`, '👕'); return; }
      if (c.buy > acorns()) { toast('도토리가 모자라요', '🌰'); return; }
      O.preview({ [c.slot]: c.id });   // 사기 전에 입어 본 모습 (창 뒤 주인공)
      const now = await confirmBox(panels, { title: '사기', icon: c.thumb ?? '👕', text: `${josa(c.name, '을/를')} 🌰 ${fmt(c.buy)}에 살까요?
산 옷은 집 옷장에 걸려요.`,
        buttons: [{ label: '사서 바로 입을게요', value: 'wear', primary: true }, { label: '사기만 할게요', value: 'buy' }, { label: '그만둘래요', value: false }], cancelValue: false });
      if (!now || p.closed) { O.revert(); return; }
      const r = O.buy(c.id);
      if (r.result !== 'ok') { O.revert(); toast(r.result === 'money' ? '도토리가 모자라요' : '살 수 없는 옷이에요', '🌰'); return; }
      if (now === 'wear') await O.wear({ [c.slot]: r.info.id }, { spin: true });
      else O.revert();
      ctx.events.emit('sfx', { name: 'acorn' });
      toast(now === 'wear' ? `${josa(c.name, '을/를')} 사서 입었어요!` : `${c.name} 샀어요! 옷장에 걸어 둘게요`, c.thumb ?? '👕');
      if (r.gift) setTimeout(() => toast('밤톨이 옷장을 덤으로 줬어요 — 집에 놓고 「갈아입기」 해 봐요', '🚪'), 900);
      draw(`[data-clothes="${CSS.escape(c.id)}"]`);
    }

    async function buyDecor(d) {
      if (p.fresh()) return;
      const w = data()?.wallet, inter = decor();
      if (!w || !inter) return;
      const kind = DECOR_NAME[d.kind] ?? '', j = DECOR_JOSA[d.kind] ?? DECOR_JOSA.wallpaper;
      if (inter.owns(d.slug)) { toast(`이미 가진 ${kind}${j.is}. 집에서 벽을 보고 꾸밀 수 있어요`, DECOR_ICON[d.kind]); return; }
      if (d.price > acorns()) { toast('도토리가 모자라요', '🌰'); return; }
      const now = await confirmBox(panels, { title: '사기', icon: DECOR_ICON[d.kind], text: `${d.name} ${kind}${j.obj} 🌰 ${fmt(d.price)}에 살까요?\n집 안에서 벽을 바라보고 행동 키를 누르면 바꿀 수 있어요.`,
        buttons: [{ label: '사서 바로 붙일게요', value: 'apply', primary: true }, { label: '사기만 할게요', value: 'buy' }, { label: '그만둘래요', value: false }], cancelValue: false });
      if (!now || p.closed) return;
      if (!w.spend(d.price)) { toast('도토리가 모자라요', '🌰'); return; }
      if (!inter.add(d.slug)) { w.add(d.price); toast(`이미 가진 ${kind}${j.is}`, DECOR_ICON[d.kind]); return; }
      if (now === 'apply') inter.apply(d.kind, d.slug);
      ctx.events.emit('sfx', { name: 'acorn' });
      toast(now === 'apply' ? `${d.name} ${kind}${j.to} 바꿨어요!` : `${d.name} ${kind} 샀어요!`, DECOR_ICON[d.kind]);
      draw(`[data-decor="${CSS.escape(d.slug)}"]`);
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
        const name = bag.variants?.name(slot, it.name) ?? it.name;   // '파랑 소파'
        const buttons = slot.count > 1
          ? [{ label: `모두 팔기 (🌰 ${fmt(it.sell * slot.count)})`, value: slot.count, primary: true }, { label: `1개만 (🌰 ${fmt(it.sell)})`, value: 1 }, { label: '그만둘래요', value: 0 }]
          : [{ label: '팔게요', value: 1, primary: true }, { label: '그만둘래요', value: 0 }];
        const n = await confirmBox(panels, { title: '팔기', icon: it.icon, cancelValue: 0, buttons,
          text: slot.count > 1 ? `${name} ${slot.count}개, 하나에 🌰 ${fmt(it.sell)}이에요. 몇 개 팔까요?` : `${itemPhrase(name)} 🌰 ${fmt(it.sell)}에 팔까요?` });
        if (!n || p.closed) continue;
        d.inventory.remove(i, n);
        d.wallet.add(it.sell * n);
        ctx.events.emit('sfx', { name: 'sell' });
        toast(`${name}${n > 1 ? ` ${n}개` : ''} 팔고 🌰 ${fmt(it.sell * n)} 받았어요`, '🌰');
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
