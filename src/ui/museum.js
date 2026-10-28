// 박물관: 물고기·곤충·화석 기증 현황과 기증하기 (가방 기증 모드 → 확인 → data.museum.donate).
import { h, itemInfo, iconEl, CATEGORY_NAME, DEX_CATEGORIES } from './dom.js';
import { panelShell, button, confirmBox } from './panels.js';
import { itemPhrase } from './bag.js';
import { notice, bar } from './phone.js';

export function createMuseum(ctx, panels, { bag, toast }) {
  let current = null;

  function open({ title = '박물관', keeper = '느루', color = '#7A9A5A' } = {}) {
    if (current) return current.p.result;
    let p;
    const data = () => ctx.services.data;
    const shell = panelShell({ cls: 'pk-museum', title, tagColor: color, onClose: () => p.close(null), onOutside: () => p.close(null) });
    const view = h('div', { class: 'pk-museum-view' });
    shell.body.append(h('p', { class: 'pk-keeper' }, h('b', null, keeper), ' 섬의 생물과 화석을 모으고 있어요. 천천히 보고 가요.'), view);
    const go = button('🎒 기증하기', { primary: true, cls: 'pk-donate-go', onclick: donateLoop });
    shell.foot.append(go);

    function draw() {
      const d = data();
      view.replaceChildren();
      go.disabled = !d?.museum;
      if (!d?.museum) { view.append(notice('🏛️', '박물관이 아직 준비 중이에요.', '데이터(data) 모듈이 연결되면 기증할 수 있어요.')); return; }
      const prog = d.museum.progress?.() ?? {};
      for (const cat of DEX_CATEGORIES) {
        const all = d.items?.list?.(cat) ?? [];
        const given = all.filter(it => d.museum.has(it.id));
        const [n, total] = prog[cat] ?? [given.length, all.length];
        view.append(h('section', { class: 'pk-museum-sec', 'aria-label': CATEGORY_NAME[cat] },
          bar(CATEGORY_NAME[cat], n, total),
          given.length
            ? h('ul', { class: 'pk-museum-row', 'aria-label': `기증한 ${CATEGORY_NAME[cat]}` }, given.map(it => h('li', { title: it.name }, iconEl(it.icon), h('span', { class: 'pk-sr' }, it.name))))
            : h('p', { class: 'pk-muted pk-small' }, '아직 기증한 게 없어요.')));
      }
    }

    async function donateLoop() {
      if (p.fresh()) return;
      const d = data();
      for (;;) {
        const i = await bag.open({ mode: 'donate' });
        if (i == null || p.closed) break;
        const slot = d.inventory.slots[i];
        if (!slot) continue;
        const it = itemInfo(ctx, slot.id);
        const ok = await confirmBox(panels, { title: '기증', icon: it.icon, text: `${itemPhrase(it.name)} 박물관에 기증할까요?`, buttons: [{ label: '기증할게요', value: true, primary: true }, { label: '그만둘래요', value: false }] });
        if (!ok || p.closed) continue;
        const before = d.inventory.count?.(slot.id);
        if (!d.museum.donate(slot.id)) { toast('이미 기증한 거예요', '🏛️'); continue; }
        // donate 가 가방에서 빼 주지 않았으면 여기서 뺀다
        if (before == null || d.inventory.count(slot.id) === before) d.inventory.remove(i, 1);
        toast(`${it.name} 기증 고마워요!`, it.icon);
      }
      if (!p.closed) go.focus({ preventScroll: true });
    }

    draw();
    const offs = [ctx.events.on('museum:changed', draw), ctx.events.on('inventory:changed', draw)];
    p = panels.open('museum', shell.root, {
      initialFocus: () => (go.disabled ? shell.card.querySelector('.pk-x') : go),
      onClose: () => { offs.forEach(f => f()); current = null; },
    });
    current = { p };
    return p.result;
  }

  return { open };
}
