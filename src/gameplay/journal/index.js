// M13-P1 섬 일지 (13차 보드 D141-A 추천안): 날마다 바뀌는 할 일 5개 + 오래 하는 목표 + 포인트 교환.
// 셀 일(on)은 다른 모듈의 이벤트만 듣고 센다 — fish·bug·shake·dig(sfx) · water·plant(gather) · talk(dialog:line 말한 주민 수) ·
// sell(상점 창에서 도토리가 늘 때) · craft(house:craft) · donate(museum:changed) · weed(잡초 뽑기 sfx kind).
// 섬폰 「📔 섬 일지」 = ui.journal.open (phone.js APPS). 저장 state.journal (규칙 rules.js). 첫날 할 일이 끝난 뒤부터 센다 (afterIntro).
import * as R from './rules.js';
import { el } from '../intro/dom.js';

export const CONFIG_FILE = 'assets/journal/journal.json';

const CSS = `
.jn-body { display: grid; gap: 12px; }
.jn-pts { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-radius: 12px; background: #FFF4D6; font-weight: 700; }
.jn-pts small { font-weight: 400; color: #6B5B4E; }
.jn-h { margin: 4px 0 0; font-size: 14px; color: #6B5B4E; }
.jn-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.jn-list li { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 10px; background: #F3F7EF; }
.jn-list li.is-done { background: #E2F1DA; }
.jn-list li.is-done .jn-t { text-decoration: line-through; color: #6B7F66; }
.jn-n { font-size: 13px; color: #6B5B4E; white-space: nowrap; }
.jn-shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; }
.jn-shop button { display: grid; gap: 2px; text-align: left; padding: 8px 10px; border-radius: 10px; border: 2px solid #E3D6BF; background: #FFFDF8; font: inherit; color: inherit; cursor: pointer; }
.jn-shop button[disabled] { opacity: .5; cursor: default; }
.jn-shop b { font-size: 14px; }
.jn-shop span { font-size: 12px; color: #6B5B4E; }
.jn-note { margin: 0; font-size: 13px; color: #6B5B4E; }
`;
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  document.head.append(el('style', { 'data-jn-css': true }, CSS));
}

function createJournal(ctx, cfg) {
  const S = () => ctx.services;
  const dayKey = () => S().time?.now?.().dayKey ?? S().data?.day?.key?.() ?? '';
  const live = () => !cfg.afterIntro || !!ctx.state.flags?.firstday?.finished;
  const J = () => R.ensure(ctx.state, cfg, dayKey(), ctx.state.island?.seed ?? 0);
  let shopOpen = false, acorns = null;

  function count(on, amount = 1) {
    if (!live() || !dayKey()) return null;
    const res = R.bump(J(), cfg, on, amount);
    const ui = S().ui;
    for (const t of res.done) ui?.toast?.(`섬 일지: ${t.label} (+${t.pts})`, '📔');
    if (res.allDone) ui?.toast?.(`오늘 할 일을 다 했어요! 덤 +${cfg.allDoneBonus ?? 0}`, '📔');
    for (const g of res.goals) ui?.toast?.(`섬 일지 목표 「${g.goal.label}」 ${g.step}단계 (+${g.goal.pts[g.step - 1] ?? 0})`, '🏅');
    if (res.gained) ctx.events.emit('journal:points', { points: J().points, gained: res.gained });
    return res;
  }

  const fits = e => e.kind !== 'item' || !S().data?.inventory?.canFit || S().data.inventory.canFit(e.item, e.n);

  /** 교환: 'ok' | 'short' (포인트 모자람) | 'full' (가방 꽉 참) | 'none' */
  function buy(id) {
    const j = J(), e = (cfg.shop ?? []).find(x => x.id === id);
    if (!e) return 'none';
    if (j.points < e.cost) return 'short';
    if (!fits(e)) return 'full';
    if (!R.spend(j, e)) return 'short';
    const d = S().data;
    if (e.kind === 'acorns') d?.wallet?.add?.(e.n);
    else if (e.kind === 'item') d?.inventory?.add?.(e.item, e.n);
    ctx.events.emit('journal:points', { points: j.points, spent: e.cost, id });
    return 'ok';
  }

  function open() {
    ensureCss();
    const ui = S().ui;
    let p;
    const close = () => p?.close(null);
    const titleId = `jn-${Math.random().toString(36).slice(2, 8)}`;
    const body = el('div', { class: 'pk-card-body jn-body' });
    const card = el('section', { class: 'pk-card jn-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
      el('header', { class: 'pk-card-head' },
        el('h2', { class: 'pk-card-title', id: titleId }, el('span', { 'aria-hidden': 'true', text: '📔' }), ' 섬 일지'),
        el('button', { type: 'button', class: 'pk-x', 'aria-label': '닫기', onclick: close, text: '✕' })),
      body);
    const root = el('div', { class: 'pk-scrim' }, card);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    const msg = el('p', { class: 'jn-note', role: 'status' });

    function draw() {
      const v = R.view(J(), cfg);
      body.replaceChildren(
        el('div', { class: 'jn-pts' }, el('span', {}, `📔 포인트 ${v.points.toLocaleString()}`), el('small', {}, `오늘 ${v.n} / ${v.total}${v.allDone ? ' · 다 했어요!' : ''}`)),
        ...(live() ? [] : [el('p', { class: 'jn-note', text: '첫날 할 일을 마치면 섬 일지가 시작돼요.' })]),
        el('h3', { class: 'jn-h', text: `오늘 할 일 (다 하면 덤 +${cfg.allDoneBonus ?? 0})` }),
        el('ul', { class: 'jn-list', 'aria-label': '오늘 할 일' }, v.tasks.map(t => el('li', { class: t.done ? 'is-done' : '', 'data-task': t.id },
          el('span', { 'aria-hidden': 'true', text: t.done ? '✅' : t.icon }), el('span', { class: 'jn-t', text: t.label }),
          el('span', { class: 'jn-n', text: t.done ? `+${t.pts}` : `${t.n} / ${t.need} · +${t.pts}` })))),
        el('h3', { class: 'jn-h', text: '오래 하는 목표' }),
        el('ul', { class: 'jn-list', 'aria-label': '오래 하는 목표' }, v.goals.map(g => el('li', { class: g.max ? 'is-done' : '' },
          el('span', { 'aria-hidden': 'true', text: g.icon }), el('span', { class: 'jn-t', text: `${g.label} ${'★'.repeat(g.step)}${'☆'.repeat(g.steps.length - g.step)}` }),
          el('span', { class: 'jn-n', text: g.max ? '다 했어요' : `${g.n} / ${g.next} · +${g.nextPts}` })))),
        el('h3', { class: 'jn-h', text: '포인트로 바꾸기' }),
        el('div', { class: 'jn-shop' }, v.shop.map(e => el('button', {
          type: 'button', disabled: !e.can, 'data-jn': e.id,
          onclick: () => {
            const r = buy(e.id);
            msg.textContent = r === 'ok' ? `${e.label} 받았어요!` : r === 'full' ? '가방이 꽉 찼어요' : '포인트가 모자라요';
            if (r === 'ok') ctx.events.emit('sfx', { name: 'acorn' });
            draw();
          },
        }, el('b', { text: `${e.icon ?? '🎁'} ${e.label}` }), el('span', { text: `📔 ${e.cost}` })))),
        msg);
    }
    draw();
    p = ui.panel('journal', root, {});
    card.focus();
    return p.result;
  }

  /** 말한 사람이 섬 주민인지 (밤톨·나 · 장면 말은 빼고 싶지만, 주민 목록을 못 읽으면 그냥 센다) */
  function isVillager(name) {
    if (!name || name === ctx.state.player?.name) return false;
    const list = S().town?.villagers;   // [{ slug, person: { name } }]
    if (!Array.isArray(list) || !list.length) return name !== '밤톨';
    return list.some(v => (v?.person?.name ?? v?.name) === name);
  }

  function listen() {
    const ev = ctx.events;
    ev.on('sfx', ({ name, kind } = {}) => {
      if (name === 'catch') count('fish');
      else if (name === 'bug-catch') count('bug');
      else if (name === 'shake') count('shake');
      else if (name === 'fossil') count('dig');
      else if (name === 'pickup' && kind === 'weed') count('weed');
    });
    ev.on('gather:watered', ({ ids } = {}) => count('water', Math.max(1, ids?.length ?? 1)));
    ev.on('gather:planted', () => count('plant'));
    ev.on('house:craft', () => count('craft'));
    ev.on('dive:catch', () => count('sea'));   // M16 잠수: 바다 생물 잡기 (gather/dive.js)
    ev.on('museum:changed', ({ id } = {}) => { if (id) count('donate'); });
    ev.on('dialog:line', ({ speaker } = {}) => {
      if (!live() || !isVillager(speaker)) return;
      const j = J();
      j.talked ||= [];
      if (j.talked.includes(speaker)) return;
      j.talked.push(speaker);
      count('talk');
    });
    ev.on('ui:open', ({ panel } = {}) => { if (panel === 'shop') { shopOpen = true; acorns = S().data?.wallet?.get?.() ?? null; } });
    ev.on('ui:close', ({ panel } = {}) => { if (panel === 'shop') shopOpen = false; });
    ev.on('wallet:changed', ({ acorns: a } = {}) => {
      if (!Number.isFinite(a)) return;
      if (shopOpen && acorns != null && a > acorns) count('sell');
      acorns = a;
    });
  }

  return {
    listen, open,
    service: { open, count, buy, view: () => R.view(J(), cfg), get points() { return J().points; }, config: cfg },
  };
}

let JN = null;
export default {
  name: 'journal',
  async init(ctx) {
    const cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(CONFIG_FILE) : fetch(CONFIG_FILE).then(r => r.json()));
    JN = createJournal(ctx, cfg);
    ctx.services.journal = JN.service;
    JN.listen();
    const ui = ctx.services.ui;
    if (ui?.panel && !ui.journal) ui.journal = { open: () => JN.open() };
  },
  update() {},
};
