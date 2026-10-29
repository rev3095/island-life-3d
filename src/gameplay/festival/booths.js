// 축제 부스 놀이 (검수 보드 z5 D21-A 놀이 축제): 부스 앞에서 행동 키. 부스마다 섬에서 채집한 것을 쓴다.
// FB-01 등불 길: 곤충 하나 → 광장 등불 색 · FB-02 음악 무대: 리듬 놀이 · FB-03 꽃 공방: 꽃 3 → 화관 ·
// FB-04 먹거리: 과일 2 → 파이·주스 (하루 3번) · FB-05 낚시 대회: 물고기 길이 재기 → 한 주 기록, 두부를 이기면 메달.
import { takeAny } from './parts.js';
import { rngOf, villagerState, addFriendship, hashStr, josa } from '../town/rules.js';
import { giveItem } from '../town/talk.js';

export const PRODUCTS = { wreath: 'festival.wreath', pie: 'festival.pie', juice: 'festival.juice', medal: 'festival.medal' };
export const LABEL = { 'FB-01': '등불 띄우기', 'FB-02': '북 치기', 'FB-03': '화관 만들기', 'FB-04': '요리하기', 'FB-05': '물고기 재기' };
const OWNER = { 'FB-01': 'chorong', 'FB-02': 'coco', 'FB-03': 'mochi', 'FB-04': 'pong', 'FB-05': 'dubu' };
/** 등불 색 (festival-lantern 변형) — 곤충마다 정해진다 */
export const LANTERN_COLORS = ['green', 'gold', 'blue', 'pink'];
export const lanternColorOf = bugId => (bugId === 'bug.firefly' ? 'green' : LANTERN_COLORS[hashStr(bugId) % LANTERN_COLORS.length]);
/** 물고기 길이 (cm) — 그림자 크기에서, 같은 날 같은 물고기면 같은 길이 */
export const fishLength = (item, dayKey, k = 0) => {
  const r = rngOf(dayKey, item.id, 'fish-length', k)();
  return Math.round(((item.shadow ?? 3) * 9 + 6) * (0.85 + r * 0.3));
};
/** 그 주(월요일부터)의 열쇠와 두부 기록 */
export const weekOf = dayKey => Math.floor((Date.parse(`${dayKey}T00:00:00Z`) / 86400000 + 3) / 7);
export const dubuRecord = week => 38 + Math.floor(rngOf(String(week), 'dubu-record')() * 22);
export const RHYTHM = { beats: [0, 1, 2, 2.5, 3.5, 4, 5, 6], beat: 0.62, lead: 1.8, ok: 0.2, great: 0.09 };

export function createBooths(ctx, emo, fest) {
  const S = () => ctx.services;
  const f = fest.state;
  const today = () => S().time?.now?.().dayKey ?? S().data?.day?.key?.();
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const rec = id => (f.booths[id] ??= {});
  const friend = (id, n) => {
    const slug = OWNER[id];
    const v = villagerState(ctx.state, slug);
    const r = rec(id);
    if (r.friendDay === today()) return;
    r.friendDay = today();
    addFriendship(v, n);
  };

  async function lantern() {
    const r = rec('FB-01');
    if (r.day === today()) { toast('오늘 밤 등불은 벌써 띄웠어요. 내일 또 와요', '🌙'); return; }
    const d = S().data;
    const slot = await S().ui.bag.open({ mode: 'pick', title: '등불 길', hint: '등불 병에 넣어 띄울 곤충을 골라 주세요', filter: s => d.items.get(s.id)?.category === 'bug' });
    if (slot == null) return;
    const it = d.items.get(d.inventory.slots[slot].id);
    d.inventory.remove(slot, 1);
    r.day = today(); r.color = lanternColorOf(it.id); r.count = (r.count ?? 0) + 1;
    paintLanterns(r.color);
    friend('FB-01', 2);
    ctx.events.emit('sfx', { name: 'bug-catch' });
    toast(`${josa(it.name, '이')} 등불이 되어 날아올랐어요`, '✨');
  }
  function paintLanterns(color) {
    const objs = S().world?.objects;
    for (const o of objs?.list?.('festival-lantern') ?? []) objs.setVariant(o.id, color === 'warm' ? null : color);
  }

  async function music() {
    const score = await rhythm();
    if (score == null) return;
    const r = rec('FB-02');
    const best = Math.max(r.best ?? 0, score);
    const record = score > (r.best ?? 0);
    r.best = best; r.plays = (r.plays ?? 0) + 1;
    if (score >= 6) friend('FB-02', 2);
    for (const V of S().town?.villagers ?? []) {
      const p = V.actor.position, q = S().player.position;
      if (score >= 5 && Math.hypot(p.x - q.x, p.z - q.z) < 9) V.happy();
    }
    toast(`북 ${score}/${RHYTHM.beats.length}${record ? ' · 새 기록!' : ` · 최고 ${best}`}`, '🥁');
  }

  /** 리듬 놀이: 🎵 가 줄에 닿을 때 행동 키(스페이스·A) → 맞힌 수 (그만두면 null) */
  function rhythm() {
    return new Promise(resolve => {
      const T = RHYTHM, N = T.beats.length;
      const notes = T.beats.map(b => ({ t: T.lead + b * T.beat, hit: null }));
      const root = document.createElement('div');
      root.className = 'fe-rhythm';
      root.innerHTML = `<div class="fe-rh-card" role="dialog" aria-label="북 치기 — 음표가 줄에 닿을 때 행동 키"><div class="fe-rh-head">${emo.svg('music', false)}<span class="fe-rh-score" aria-live="polite">0 / ${N}</span></div>
        <div class="fe-rh-track"><span class="fe-rh-line"></span>${notes.map((_, i) => `<span class="fe-rh-note" data-i="${i}">${emo.svg('music', false)}</span>`).join('')}</div>
        <button type="button" class="fe-rh-hit" aria-label="북 치기 (스페이스·A)">${emo.svg('good', false)}</button></div>`;
      const track = root.querySelector('.fe-rh-track'), els = [...root.querySelectorAll('.fe-rh-note')], scoreEl = root.querySelector('.fe-rh-score');
      let t0 = null, done = false, raf = 0;
      const time = () => (performance.now() - t0) / 1000;
      const score = () => notes.filter(n => n.hit).length;
      function hit() {
        if (done || t0 == null) return;
        const t = time();
        const n = notes.find(x => x.hit == null && Math.abs(x.t - t) <= T.ok);
        if (!n) return;
        n.hit = Math.abs(n.t - t) <= T.great ? 'great' : 'ok';
        els[notes.indexOf(n)].classList.add(n.hit === 'great' ? 'is-great' : 'is-ok');
        ctx.events.emit('sfx', { name: n.hit === 'great' ? 'acorn' : 'pickup', volume: 0.6 });
        scoreEl.textContent = `${score()} / ${N}`;
      }
      function frame() {
        if (done) return;
        const t = time(), w = track.clientWidth || 300, lineX = w * 0.18, speed = w * 0.42;
        for (const [i, n] of notes.entries()) {
          if (n.hit == null && t > n.t + T.ok) { n.hit = false; els[i].classList.add('is-miss'); }
          els[i].style.transform = `translateX(${lineX + (n.t - t) * speed}px)`;
        }
        if (t > notes.at(-1).t + 0.8) { finish(score()); return; }
        raf = requestAnimationFrame(frame);
      }
      const finish = v => { if (done) return; done = true; cancelAnimationFrame(raf); p.close(); resolve(v); };
      root.querySelector('.fe-rh-hit').addEventListener('pointerdown', e => { e.preventDefault(); hit(); });
      const p = S().ui.panel('festival-rhythm', root, {
        initialFocus: () => root.querySelector('.fe-rh-hit'),
        onAction: () => hit(),
        onCancel: () => finish(null),
        onKey(e) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { if (!e.repeat) hit(); return true; } return false; },
        onClose: () => { if (!done) { done = true; cancelAnimationFrame(raf); resolve(null); } },
      });
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    });
  }

  async function flower() {
    const d = S().data;
    const plan = takeAny(d.inventory.slots, d.items, it => it.category === 'flower', 3);
    if (!plan) { toast('화관에는 꽃 3송이가 필요해요', '🌷'); return; }
    const ok = await S().ui.confirm({ title: '꽃 공방', text: '꽃 3송이로 화관을 만들까요?', icon: '🌸' });
    if (!ok) return;
    for (const { slot, n } of [...plan].sort((a, b) => b.slot - a.slot)) d.inventory.remove(slot, n);
    rec('FB-03').made = (rec('FB-03').made ?? 0) + 1;
    friend('FB-03', 2);
    giveItem(ctx, PRODUCTS.wreath);
  }

  async function food() {
    const r = rec('FB-04');
    if (r.day !== today()) { r.day = today(); r.today = 0; }
    if (r.today >= 3) { toast('오늘 요리는 다 했어요. 퐁이 내일 또 오래요', '😋'); return; }
    const d = S().data;
    const plan = takeAny(d.inventory.slots, d.items, it => it.category === 'fruit', 2);
    if (!plan) { toast('요리에는 과일 2개가 필요해요', '🍎'); return; }
    const pick = await S().ui.confirm({ title: '먹거리 부스', text: '과일 2개로 무엇을 만들까요?', icon: '🍲',
      buttons: [{ label: '과일 파이', value: 'pie', primary: true }, { label: '과일 주스', value: 'juice' }, { label: '그만', value: null }] });
    if (!pick) return;
    for (const { slot, n } of [...plan].sort((a, b) => b.slot - a.slot)) d.inventory.remove(slot, n);
    r.today++;
    friend('FB-04', 2);
    giveItem(ctx, PRODUCTS[pick]);
  }

  async function fish() {
    const d = S().data;
    const slot = await S().ui.bag.open({ mode: 'pick', title: '낚시 대회', hint: '길이를 잴 물고기를 골라 주세요 (재고 나면 바다로 돌려보내요)', filter: s => d.items.get(s.id)?.category === 'fish' });
    if (slot == null) return;
    const it = d.items.get(d.inventory.slots[slot].id);
    d.inventory.remove(slot, 1);
    const r = rec('FB-05'), key = today(), week = weekOf(key);
    if (r.week !== week) { r.week = week; r.best = null; r.medal = false; }
    r.n = (r.n ?? 0) + 1;
    const cm = fishLength(it, key, r.n);
    const record = !r.best || cm > r.best.cm;
    if (record) r.best = { cm, id: it.id, name: it.name, day: key };
    const dubu = dubuRecord(week);
    ctx.events.emit('sfx', { name: 'splash' });
    friend('FB-05', 2);
    toast(`${it.name} ${cm}cm${record ? ' · 이번 주 최고!' : ` · 이번 주 최고 ${r.best.cm}cm`} (두부 ${dubu}cm)`, '🐟');
    if (cm >= dubu && !r.medal) { r.medal = true; giveItem(ctx, PRODUCTS.medal); }
  }

  const PLAY = { 'FB-01': lantern, 'FB-02': music, 'FB-03': flower, 'FB-04': food, 'FB-05': fish };

  /** 부스 앞에 서서 부스를 보고 있으면 그 부스 */
  function boothInFront() {
    const P = S().world?.places?.festival, pl = S().player;
    if (!P || !pl) return null;
    const p = pl.position, fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
    for (const b of P.booths) {
      if (!f.booths[b.id]?.openedDay) continue;
      const dx = b.front.x - p.x, dz = b.front.z - p.z;
      if (Math.hypot(dx, dz) > 1.25) continue;
      const tx = b.x - p.x, tz = b.z - p.z, L = Math.hypot(tx, tz) || 1;
      if ((tx * fx + tz * fz) / L > 0.3) return b;
    }
    return null;
  }

  function register(gp) {
    gp.add({
      name: 'festival:booth', intent: 'action', priority: 85,
      label: b => LABEL[b?.id] ?? '부스',
      test: boothInFront,
      async run(b) {
        const pl = S().player;
        pl.freeze?.(true);
        try { await PLAY[b.id]?.(); } catch (e) { console.error('[festival] 부스', e); } finally { pl.freeze?.(false); }
      },
    });
  }

  // 불러온 저장: 마지막으로 띄운 등불 색
  const restore = () => { const c = f.booths['FB-01']?.color; if (c) paintLanterns(c); };
  return { register, restore, rhythm, PLAY };
}
