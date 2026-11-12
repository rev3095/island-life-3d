// M13-P5 방문 행상 (13차 보드 D145-A): 수·일 낮(9–17시) 광장 한쪽에 수레 BD-11 + 행상 송이 CH-16 (고슴도치 — 지금 섬에 없는 종족).
// 오늘의 진열 = 희귀 꽃 모종(교배로만 피는 넷째 색 꽃 — 심을 수 있다) 둘 · 묘목 하나 · 다른 곳에서 안 파는 벽지 하나 (wp-09, 목록 값 0 이라 도토리상점 코너엔 안 나옴).
// 사기는 대화 고르기 + 확인 창 (상점 창 ui/shop.js 는 실내 트랙 몫이라 건드리지 않음). 밤 상인(달빛 가게·여우)은 다른 트랙 — 여기는 낮만.
// 수레는 world 물체 persist:false (저장 안 함), 자리는 한 번 정하면 state.daily.peddler.spot. 처음 다가가면 daily:peddler { first } → 장면 s24 (트리거 peddler-first).
import * as R from './rules.js';
import { createActor } from '../town/actor.js';

const NEAR = 1.8;          // 행상 · 수레 앞 행동 거리
const SEE = 7;             // 처음 만남 장면을 트는 거리
const KIND_OK = new Set(['grass', 'plaza', 'path']);

export function createPeddler(K) {
  const { ctx, cfg: CFG, S, st, now, seed, toast, emit } = K;
  const cfg = CFG.peddler;
  const L = cfg.lines;
  const ps = () => { const s = st(); s.peddler ??= {}; return s.peddler; };
  const placed = { id: null, spot: null };
  let actor = null, loading = null, here = false, storyOn = false;

  // ── 수레 자리: 광장 + offset 둘레에서 빈 곳 (수레 2칸 + 오른쪽 행상 1칸 + 앞 줄 비움, 문·축제 무대 둘레 밖) ──
  function findSpot() {
    const W = K.world(), I = K.isl(), P = W?.places;
    if (!P?.plaza || !I) return null;
    const doors = [P.shop, P.museum, P.playerHouse, ...(P.villagerHouses ?? []), ...(P.spareLots ?? [])].map(b => b?.door).filter(Boolean);
    const fest = P.festival;
    const [ox, oz] = cfg.offset ?? [-7, 5];
    const a = I.toTile(P.plaza.x + ox, P.plaza.z + oz);
    const free = (tx, tz) => KIND_OK.has(I.tileAt(tx, tz)) && I.isWalkableTile?.(tx, tz) !== false && !W.objects.at(tx, tz);
    for (let r = 0; r <= 14; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const tx = a.tx + dx, tz = a.tz + dz;
      const cells = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2]];
      if (!cells.every(([x, z]) => free(tx + x, tz + z))) continue;
      const c = I.toWorld(tx, tz), x = c.x + 0.5, z = c.z;
      if (doors.some(d => Math.hypot(d.x - x, d.z - z) < 3.2)) continue;
      if (fest?.center && Math.hypot(fest.center.x - x, fest.center.z - z) < (fest.radius ?? 6) + 2) continue;
      if (Math.abs(I.levelAt(tx, tz) - I.levelAt(tx + 1, tz)) || Math.abs(I.levelAt(tx, tz) - I.levelAt(tx + 2, tz))) continue;
      return { tx, tz, x, z, keeper: { x: x + 1.35, z: z + 0.15 }, front: { x, z: z + 1.25 } };
    }
    return null;
  }

  function putCart() {
    const W = K.world();
    if (placed.id || !W?.objects) return;
    let s = ps().spot;
    if (!s || W.objects.at(s.tx, s.tz)) { s = findSpot(); if (s) ps().spot = s; }
    if (!s) { console.warn('[daily] 행상 수레 자리를 못 찾았어요'); return; }
    const id = W.objects.add(cfg.cart, s.tx, s.tz, { persist: false, at: { x: s.x, z: s.z }, rot: 0 });
    if (!id) return;
    placed.id = id; placed.spot = s;
    showKeeper();
  }
  function takeCart() {
    if (placed.id) K.world()?.objects?.remove(placed.id);
    placed.id = null; placed.spot = null;
    hideKeeper();
  }

  async function showKeeper() {
    loading ??= createActor(ctx, cfg.keeper).then(a => (actor = a)).catch(e => { console.warn('[daily] 행상 모델을 못 받았어요 (말은 걸 수 있어요)', e); return null; });
    const a = await loading;
    const s = placed.spot;
    if (!a || !s) return;
    a.root.visible = !storyOn;
    a.place(s.keeper.x, s.keeper.z, Math.PI);   // 남쪽(카메라 쪽)을 본다
    a.setOpacity(1); a.fadeTo = 1;
    a.play?.('idle');
  }
  function hideKeeper() { if (actor) { actor.root.visible = false; actor.setOpacity(0); } }

  // ── 오늘의 진열 ──
  function pools() {
    const items = S().data?.items;
    const flowers = (items?.list?.('flower') ?? []).filter(it => it.hybrid).map(it => it.id);
    const saplings = (cfg.saplingPool ?? []).filter(id => items?.get?.(id));
    return { flowers, saplings };
  }
  function stock(n = now()) {
    if (!n) return [];
    const items = S().data?.items;
    const list = R.peddlerStock(n.dayKey, seed(), cfg, pools()).map(id => { const it = items.get(id); return { kind: 'item', id, name: it.name, emoji: it.emoji ?? '🌱', price: R.peddlerPrice(it, cfg) }; });
    const wp = cfg.wallpaper, house = S().house?.interior;
    const entry = wp && house?.index?.models?.find?.(m => m.slug === wp.slug);
    if (entry) list.push({ kind: 'wallpaper', id: wp.slug, name: `${entry.name} 벽지`, emoji: '🖼️', price: wp.price, owned: !!house.owns?.(wp.slug) });
    return list;
  }

  const who = { name: cfg.name, color: cfg.color, voice: cfg.voice };
  const say = (lines, choices) => S().ui.dialog.open({ speaker: who.name, color: who.color, voice: who.voice, lines: [lines].flat().filter(Boolean), choices });
  const pick = list => list[Math.floor(Math.random() * list.length)];

  async function talk() {
    const n = now(), s = ps(), ui = S().ui;
    actor?.lookAt?.(S().player.position.x, S().player.position.z);
    if (!s.met) { s.met = n.dayKey; await say(L.first); }
    const a = await say([pick(L.greet)], ['구경할래요', '그냥 인사할래요']);
    if (a !== 0) { await say([pick(L.bye)]); return; }
    for (;;) {
      const list = stock(n);
      const labels = list.map(e => `${e.emoji} ${e.name} · 🌰 ${e.price.toLocaleString()}${e.owned ? ' (가지고 있음)' : ''}`);
      const quit = labels.push('그만') - 1;
      const i = await say([L.pick], labels);
      if (i == null || i === quit) break;
      const e = list[i];
      if (e.owned) { await say([L.owned]); continue; }
      const d = S().data;
      if ((d?.wallet?.get?.() ?? 0) < e.price) { await say([L.short]); continue; }
      if (e.kind === 'item' && d.inventory?.canFit && !(d.inventory.canFit(e.id, 1) > 0)) { await say([L.full]); continue; }
      const ok = await ui.confirm({ title: '사기', icon: e.emoji, text: `${e.name}을(를) 🌰 ${e.price.toLocaleString()}에 살까요?`,
        buttons: [{ label: '살게요', value: true, primary: true }, { label: '그만둘래요', value: false }], cancelValue: false });
      if (!ok) continue;
      if (!d.wallet.spend(e.price)) { await say([L.short]); continue; }
      if (e.kind === 'wallpaper') S().house?.interior?.add?.(e.id);
      else if (!(d.inventory.add(e.id, 1) > 0)) { d.wallet.add(e.price); await say([L.full]); continue; }
      ctx.events.emit('sfx', { name: 'acorn' });
      toast(`${e.name} 샀어요!`, e.emoji);
      emit('daily:peddler-buy', { id: e.id, kind: e.kind, price: e.price });
      await say([pick(L.bought)]);
    }
    await say([pick(L.bye)]);
  }

  function inFront() {
    const s = placed.spot, pl = S().player, p = pl?.position;
    if (!s || !here || !p || !K.onIsland()) return null;
    for (const q of [s.keeper, s.front]) {
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < NEAR && (d < 0.6 || (dx * -Math.sin(pl.facing) + dz * -Math.cos(pl.facing)) / d > 0.2)) return s;
    }
    return null;
  }

  function sync(n) {
    const open = K.isOpen(n);
    here = open && R.peddlerHere(n.dayKey, n.hourF, cfg);
    if (here) putCart(); else takeCart();
    const s = ps();
    if (here && s.arrived !== n.dayKey && K.onIsland()) { s.arrived = n.dayKey; toast(cfg.arrive, '🛒'); emit('daily:peddler', { arrive: true, dayKey: n.dayKey }); }
    // 처음 다가가면 장면 (한 번)
    const p = S().player?.position;
    if (here && placed.spot && p && !s.seenFirst && !S().story?.playing && K.onIsland() && Math.hypot(placed.spot.front.x - p.x, placed.spot.front.z - p.z) < SEE) {
      s.seenFirst = n.dayKey;
      emit('daily:peddler', { first: true, dayKey: n.dayKey, x: placed.spot.front.x, z: placed.spot.front.z });
    }
  }

  function register(gp) {
    gp.add({ name: 'daily:peddler', intent: 'action', priority: 101, label: '행상', test: () => inFront(), run: () => talk() });
    ctx.events.on('story:start', () => { storyOn = true; if (actor) actor.root.visible = false; });
    ctx.events.on('story:end', () => { storyOn = false; if (actor && placed.id) actor.root.visible = true; });
  }

  function update(dt) { if (actor?.root.visible) actor.update(dt, true); }

  return {
    sync, update, register,
    service: {
      get here() { return here; },
      stock: () => stock(),
      spot: () => (placed.spot ? JSON.parse(JSON.stringify(placed.spot)) : null),
      /** 이번 주 행상 오는 날인가 (오늘) */
      today: () => { const n = now(); return !!n && R.peddlerDay(n.dayKey, cfg); },
      /** town.keepClear 처럼: 주민이 서지 않을 자리 */
      clearSpots: () => (placed.spot ? [{ x: placed.spot.front.x, z: placed.spot.front.z, r: 1.8 }, { x: placed.spot.keeper.x, z: placed.spot.keeper.z, r: 0.9 }] : []),
    },
  };
}
