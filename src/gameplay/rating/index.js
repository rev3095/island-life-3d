// M14 섬 별점 평가 (결정 D152-A): 꽃·나무·꾸민 가구·울타리·길·다리·경사로·집·주민 − 잡초 → 별 1–5 (규칙 rules.js, 설정 assets/rating/rating.json).
// 섬폰 「⭐ 섬 평가」 = ui.rating.open (phone.js APPS, UI-25): 별·칸별 점수·주민 한마디. 하루 리셋(data:newday)과 창을 열 때 다시 잰다.
// 처음 오른 별마다 도토리 (rewards), 별 다섯 처음이면 rating:stars { first5 } → 장면 s25 (story 트리거 rating-five). 저장 state.rating.
// 첫날 할 일이 끝난 뒤부터 잰다 (첫날 섬은 잡초투성이라 별 하나 — 상은 그다음부터).
import * as R from './rules.js';
import { el } from '../intro/dom.js';

export const CONFIG_FILE = 'assets/rating/rating.json';

const CSS = `
.rt-body { display: grid; gap: 12px; }
.rt-stars { display: grid; justify-items: center; gap: 2px; padding: 12px; border-radius: 14px; background: #FFF4D6; }
.rt-stars b { font-size: 30px; letter-spacing: 4px; color: #F2B33D; }
.rt-stars b .off { color: #E3D6BF; }
.rt-stars small { color: #6B5B4E; }
.rt-talk { display: grid; gap: 4px; padding: 10px 12px; border-radius: 12px; background: #F3F7EF; }
.rt-talk strong { font-size: 13px; color: #6B8F5A; }
.rt-talk p { margin: 0; }
.rt-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.rt-list li { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 10px; background: #FFFDF8; border: 2px solid #EFE4D0; }
.rt-list li.is-ok { border-color: #CFE6C2; }
.rt-n { font-size: 13px; color: #6B5B4E; white-space: nowrap; }
.rt-note { margin: 0; font-size: 13px; color: #6B5B4E; }
`;
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  document.head.append(el('style', { 'data-rt-css': true }, CSS));
}

function createRating(ctx, cfg) {
  const S = () => ctx.services;
  const dayKey = () => S().time?.now?.().dayKey ?? S().data?.day?.key?.() ?? '';
  const live = () => !!ctx.state.flags?.firstday?.finished || !S().intro;
  const RS = () => R.ensureRating(ctx.state);

  /** 지금 섬 세기 (본섬 물체 — 투어 중에도 본섬) */
  function counts() {
    const w = S().world;
    const objs = (w?.home?.objects ?? w?.objects)?.list?.() ?? [];
    const town = S().town;
    return R.countIsland(objs, { home: S().house?.grow?.stage ?? 0, residents: town?.residents?.()?.length ?? town?.villagers?.length ?? 0 });
  }
  const evaluate = () => R.rate(counts(), cfg);

  /** 재고 상 주기 (오른 별) → 결과 */
  function check({ quiet = false } = {}) {
    const res = evaluate();
    if (!live()) return res;
    const got = R.record(RS(), res, cfg, dayKey());
    if (got.acorns) S().data?.wallet?.add?.(got.acorns);
    if (got.up.length && !quiet) {
      S().ui?.toast?.(`섬 평가 별 ${'★'.repeat(res.stars)} — 상으로 도토리 ${got.acorns.toLocaleString('ko-KR')}개!`, '⭐');
      ctx.events.emit('sfx', { name: 'acorn' });
    }
    if (got.up.length) ctx.events.emit('rating:stars', { stars: res.stars, up: got.up, acorns: got.acorns, first5: got.firstFive });
    return res;
  }

  /** 오늘 한마디할 주민 (날마다 바뀜) → { name, seed } */
  function speaker() {
    const town = S().town, list = town?.residents?.() ?? [];
    const day = dayKey();
    let h = 0;
    for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const slug = list.length ? list[Math.abs(h) % list.length] : null;
    const v = town?.villagers?.find?.(x => x.slug === slug);
    return { name: v?.person?.name ?? v?.name ?? '밤톨', seed: h };
  }

  function open() {
    ensureCss();
    const ui = S().ui;
    let p;
    const close = () => p?.close(null);
    const titleId = `rt-${Math.random().toString(36).slice(2, 8)}`;
    const body = el('div', { class: 'pk-card-body rt-body' });
    const card = el('section', { class: 'pk-card rt-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
      el('header', { class: 'pk-card-head' },
        el('h2', { class: 'pk-card-title', id: titleId }, el('span', { 'aria-hidden': 'true', text: '⭐' }), ' 섬 평가'),
        el('button', { type: 'button', class: 'pk-x', 'aria-label': '닫기', onclick: close, text: '✕' })),
      body);
    const root = el('div', { class: 'pk-scrim' }, card);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    const res = check();
    const who = speaker();
    const talk = R.comment(res, cfg, who.seed);
    const rs = RS();
    body.replaceChildren(
      el('div', { class: 'rt-stars', 'data-stars': String(res.stars), 'aria-label': `별 ${res.stars}개` },
        el('b', {}, '★'.repeat(res.stars), el('span', { class: 'off', text: '★'.repeat(5 - res.stars) })),
        el('small', { text: res.next ? `섬 점수 ${res.score} · 다음 별까지 ${res.next - res.score}` : `섬 점수 ${res.score} · 별 다섯!` })),
      el('div', { class: 'rt-talk', 'data-rating-talk': '' }, el('strong', { text: `${who.name}의 한마디` }), ...talk.map(t => el('p', { text: t }))),
      el('ul', { class: 'rt-list', 'aria-label': '섬 평가 칸' }, res.parts.map(pt => el('li', { class: pt.ok ? 'is-ok' : '', 'data-part': pt.id },
        el('span', { 'aria-hidden': 'true', text: pt.icon }), el('span', { text: pt.name }),
        el('span', { class: 'rt-n', text: `${pt.n} · ${pt.pts >= 0 ? '+' : ''}${pt.pts}` })))),
      el('p', { class: 'rt-note', text: live()
        ? `가장 높았던 별 ${rs.best} · 처음 오른 별마다 도토리 상 (${Object.entries(cfg.rewards ?? {}).map(([s, n]) => `★${s} ${n.toLocaleString('ko-KR')}`).join(' · ')})`
        : '첫날 할 일을 마치면 별 상을 받을 수 있어요.' }));
    p = ui.panel('rating', root, {});
    card.focus();
    return p.result;
  }

  return { open, check, evaluate, counts, get state() { return RS(); }, config: cfg };
}

let RT = null;
export default {
  name: 'rating',
  async init(ctx) {
    const cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(CONFIG_FILE) : fetch(CONFIG_FILE).then(r => r.json()));
    RT = createRating(ctx, cfg);
    ctx.services.rating = { open: () => RT.open(), check: o => RT.check(o), evaluate: () => RT.evaluate(), counts: () => RT.counts(), get state() { return RT.state; }, config: cfg };
    ctx.events.on('data:newday', () => { try { RT.check(); } catch (e) { console.warn('[rating] 하루 평가 실패', e); } });
    const ui = ctx.services.ui;
    if (ui?.panel && !ui.rating) ui.rating = { open: () => RT.open() };
  },
  update() {},
};
