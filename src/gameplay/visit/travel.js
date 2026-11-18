// M21-P3 친구 섬 구경 가기 (17차 보드 wave17 D282-A · D285-A). 설정 assets/visit/visit.json, 노트 docs/notes/m21-p3-visit.md.
//  - 본섬 동쪽 어선 부두(boat.site()) 옆에 친구 섬 배 BD-20 을 놓는다 (persist:false). Space(96) → 섬 고르기 창 UI-39 (오늘의 섬 셋 · 섬 코드 · 닫기)
//    — 내 섬 보여 주기를 켜지 않았어도 구경은 된다.
//  - 고른 섬 문서의 snap 으로 x 1300 에 섬을 세운다: 투어 섬 틀 world.islet.enter(gen, ox, { island }) 를 다시 쓰고, gen 은 본섬과 같은 생성기(islet-build.js).
//    주민은 겉모양만 세우고 말 걸면 인사 두 줄 (부탁·선물·친밀도 없음).
//  - 읽기만: 구경 중에는 행동 키를 「visit-hands」(94)가 받아 흔들기·줍기·채집·문·가구·도구를 막는다 → drops·하루 기록이 생기지 않는다. 남의 문서는 쓰지 않는다.
//  - 떠나기: 구경 섬 선착장 배 Space → 원형 전환 → 본섬 배 옆. 05:00 새 날에도 저절로. 저장은 state.visit.trip (구경 중 표시) 만 — 끈 저장은 본섬 배 옆에서 시작.
//  - 고리: visit.trip() → { code, user, island, owner, guestbook: {x, z} } | null (M21-P4 방명록·편지·선물이 쓴다), 이벤트 visit:arrive · visit:leave.
import { resolveLayout } from '../../world/island.js';
import { createActor } from '../town/actor.js';
import { stageOf } from '../house/home.js';
import { visitable, tripOf, tripWhy, greetLines } from './trip.js';
import { planVisitIsland, villagerSpots } from './islet-build.js';
import { openPicker } from './picker.js';

const FADE = '#1E2A3A';

export async function attachTravel(ctx, api) {
  const { events, services } = ctx;
  const world = services.world, player = services.player, ui = services.ui;
  const interactions = services.gameplay?.interactions;
  if (!world?.islet || !player || !ui || !interactions) { console.warn('[visit] world.islet·player·ui·gameplay 가 있어야 구경을 갈 수 있다 — 건너뜀'); return; }
  const cfg = await ctx.assets.loadJSON('assets/visit/visit.json');
  const ox = cfg.ox ?? 1300, REACH = cfg.reach ?? 1.9;
  const V = () => (ctx.state.visit ||= {});
  const toast = (text, icon) => events.emit('toast', { text, icon });
  const sfx = (name, o = {}) => events.emit('sfx', { name, ...o });

  // ---------- 본섬 배 (어선 부두 옆) ----------
  const home = world.home;
  const site = services.boat?.site?.();
  const root = site?.root ?? (home.places.dock ? { x: home.places.dock.x + 2, z: home.places.dock.z } : null);
  if (!root) { console.warn('[visit] 배를 매어 둘 자리가 없다 — 건너뜀'); return; }
  const homeBoat = { x: root.x + cfg.dock.boat[0], z: root.z + cfg.dock.boat[1] };
  const homeStand = { x: root.x + cfg.dock.stand[0], z: root.z + cfg.dock.stand[1] };
  const putHomeBoat = () => {
    if (home.objects.get?.('visit:home-boat')) return;
    const t = home.island.toTile(homeBoat.x, homeBoat.z);
    home.objects.add('visit-boat', Math.min(home.island.w - 1, t.tx), t.tz, { persist: false, id: 'visit:home-boat', at: { x: homeBoat.x, z: homeBoat.z, y: 0 } });
  };
  putHomeBoat();

  // ---------- 구경 섬 재료 (처음 갈 때 한 번) ----------
  let parts = null;
  async function partsOf() {
    if (parts) return parts;
    const A = ctx.assets;
    const [index, layoutRaw, festival, decor, homeCfg] = await Promise.all([
      A.loadEnvIndex(),
      A.loadJSON('assets/island/layout.json').catch(() => null),
      A.loadJSON('assets/festival/config.json').catch(() => null),
      A.loadJSON('assets/decor/decor.json').catch(() => ({})),
      A.loadJSON('assets/interior/home.json').catch(() => null),
    ]);
    const specs = Object.fromEntries(await Promise.all(index.models.map(async m => [m.slug, await A.loadEnvSpec(m.slug).catch(() => null)])));
    for (const k of Object.keys(specs)) if (!specs[k]) delete specs[k];
    return (parts = { specs, layout: resolveLayout(layoutRaw), festival, builds: decor.builds ?? [], homeCfg });
  }
  function fruitOf(seed) {
    const d = services.data;
    const id = d?.economy?.rules?.nativeFruit?.(seed);
    return id ? (d.items?.get?.(id)?.variant ?? String(id).split('.')[1]) : null;
  }

  // ---------- 상태 ----------
  let current = null;    // { doc, trip, gen, boat, stand, guestbook, actors: [{ slug, name, actor, k }] }
  let busy = false;
  let tag = null;
  const showTag = text => {
    hideTag();
    const box = document.querySelector('.pk-top-right');
    if (!box) return;
    tag = document.createElement('div');
    tag.className = 'pk-bubble pk-tour-tag';
    tag.setAttribute('role', 'status');
    tag.textContent = text;
    box.prepend(tag);
  };
  function hideTag() { tag?.remove(); tag = null; }
  const otherTrip = () => !!(services.tour?.active || services.boat?.active || world.islet.active || services.gather?.dive?.active);

  async function placeVillagers(gen, snap, trip) {
    const slugs = (snap.villagers ?? []).map(v => v?.slug).filter(s => typeof s === 'string' && /^[\w-]{1,40}$/.test(s)).slice(0, cfg.villagers?.max ?? 10);
    const spots = villagerSpots(gen, slugs);
    const out = [];
    await Promise.all(spots.map(async (s, i) => {
      try {
        const info = await ctx.assets.loadJSON(`assets/villagers/${s.slug}.json`).catch(() => ({}));
        const actor = await createActor(ctx, s.slug);
        if (!current || current.trip !== trip) { ctx.scene.remove(actor.root); return; }   // 그새 떠났다
        const x = s.x + ox;
        actor.position.set(x, world.island.heightAt(x, s.z), s.z);
        actor.setFacing(s.facing ?? Math.PI);
        actor.play('idle');
        out.push({ slug: s.slug, name: info.name ?? s.slug, color: info.color, voice: info.voice, actor, k: i });
      } catch (e) { console.warn('[visit] 주민을 못 세웠다', s.slug, e); }
    }));
    return out;
  }

  function cleanup() {
    hideTag();
    for (const a of current?.actors ?? []) ctx.scene.remove(a.actor.root);
    // 혹시 생긴 것은 치운다 (읽기만이라 없어야 한다 — 저장에 남지 않게)
    const g = services.gather;
    if (g?.drops) for (const d of [...g.drops.list]) if (d.x > ox - 100) g.drops.remove(d);
    if (world.islet.active && current) world.islet.leave();
    current = null;
    V().trip = null;
  }

  // ---------- 오가기 ----------
  async function pick() {
    if (busy || current) return;
    if (otherTrip()) { toast(tripWhy('busy'), '⛴'); return; }
    const st = api.status();
    const doc = await openPicker(ui, {
      readable: st.readable,
      today: () => api.today(),
      find: text => api.find(text),
      check: d => visitable(d, { uid: api.uid, mine: V().code }),
      why: tripWhy,
    });
    if (doc) await go(doc);
  }

  async function go(doc) {
    if (busy || current) return { ok: false, why: 'busy' };
    const can = visitable(doc, { uid: api.uid, mine: V().code });
    if (!can.ok) { toast(tripWhy(can.why), '⛴'); return can; }
    if (otherTrip()) { toast(tripWhy('busy'), '⛴'); return { ok: false, why: 'busy' }; }
    const trip = tripOf(doc);
    busy = true;
    try {
      player.freeze(true);
      await player.walkTo(homeStand.x, homeStand.z, { speed: 2.2 }).catch(() => {});
      player.face(homeBoat.x, homeBoat.z);
      sfx('splash', { volume: 0.5, pitch: 0.85 });
      await ui.fade(true, 0.6, FADE, { shape: 'circle' });
      toast(`⛴ 「${trip.island}」로 바다를 건너는 중…`, '🌊');
      const P = await partsOf();
      const plan = planVisitIsland(doc.snap, {
        constants: ctx.constants, layout: P.layout, specs: P.specs, festival: P.festival, builds: P.builds, ox,
        nativeFruit: fruitOf(P.layout?.seed ?? Number(doc.snap.island.seed)),
        exterior: stage => stageOf(P.homeCfg, stage)?.exterior ?? 'house-player',
      });
      const gen = plan.gen;
      await Promise.all([world.islet.enter(gen, ox, { island: plan.island }), new Promise(r => setTimeout(r, 700))]);
      // 구경 섬 선착장(BD-05) 옆 배 · 서는 자리 · 방명록 받침 자리 (투어 섬과 같은 셈)
      const dockObj = world.objects.list('dock')[0];
      const sp = gen.places.spawn;
      const boat = dockObj ? { x: dockObj.x + cfg.islet.boat[0], z: dockObj.z + cfg.islet.boat[1] } : { x: sp.x + ox + 1.5, z: sp.z + 2 };
      const stand = dockObj ? { x: dockObj.x + cfg.islet.stand[0], z: dockObj.z + cfg.islet.stand[1] } : { x: sp.x + ox, z: sp.z };
      const guestbook = { x: sp.x + ox + cfg.islet.guestbook[0], z: sp.z + cfg.islet.guestbook[1] };
      const t = world.island.toTile(boat.x, boat.z);
      world.objects.add('visit-boat', Math.max(0, Math.min(world.island.w - 1, t.tx)), Math.max(0, Math.min(world.island.h - 1, t.tz)), { persist: false, id: 'visit:islet-boat', at: { x: boat.x, z: boat.z, y: 0 } });
      current = { doc, trip, gen, boat, stand, guestbook, actors: [] };
      V().trip = { code: trip.code, user: trip.user, day: services.data?.day?.key?.() ?? null };
      player.teleport(sp.x + ox, sp.z, sp.facing ?? 0);
      current.actors = await placeVillagers(gen, doc.snap, trip);
      await ui.fade(false, 0.6, FADE, { shape: 'circle' });
      showTag(`🏝 ${trip.island}`);
      toast(`${trip.owner}의 「${trip.island}」에 왔어요! 구경만 할 수 있어요 👀`, '🏝️');
      events.emit('visit:arrive', { code: trip.code, user: trip.user, island: trip.island, owner: trip.owner, x: sp.x + ox, z: sp.z, guestbook: { ...guestbook } });
      return { ok: true };
    } catch (e) {
      console.error('[visit] 구경 가기', e);
      cleanup();
      putHomeBoat();
      player.teleport(homeStand.x, homeStand.z, Math.PI / 2);
      ui.fade(false, 0.2);
      toast(tripWhy('version'), '⛴');
      return { ok: false, why: 'error' };
    } finally { player.freeze(false); busy = false; }
  }

  async function back({ auto = false } = {}) {
    if (busy || !current) return;
    if (!auto) {
      const yes = await ui.confirm({ title: '⛴ 돌아가기', text: '내 섬으로 돌아갈까요?', buttons: [{ label: '돌아가요', value: true, primary: true }, { label: '조금 더', value: false }] });
      if (!yes || !current) return;
    }
    busy = true;
    const was = current.trip;
    try {
      player.freeze(true);
      await ui.fade(true, 0.6, FADE, { shape: 'circle' });
      if (auto) toast('날이 밝았어요. 배가 내 섬으로 돌아가요', '🌅');
      cleanup();
      putHomeBoat();
      player.teleport(homeStand.x, homeStand.z, Math.PI / 2);
      await new Promise(r => setTimeout(r, 300));
      await ui.fade(false, 0.6, FADE, { shape: 'circle' });
      events.emit('visit:leave', { code: was.code, user: was.user, auto });
    } finally { player.freeze(false); busy = false; }
  }

  // ---------- 행동 키 ----------
  const near = (p, at, r = REACH) => at && Math.hypot(p.x - at.x, p.z - at.z) < r;
  interactions.add({
    name: 'visit-boat', intent: 'action', priority: 96, label: () => (current ? '돌아가기' : '친구 섬 구경'),
    test: () => {
      if (busy) return null;
      const p = player.position;
      if (current) return near(p, current.boat) ? 'back' : null;
      return near(p, homeBoat) && !otherTrip() ? 'pick' : null;
    },
    run: what => (what === 'back' ? back() : pick()),
  });
  interactions.add({
    name: 'visit-greet', intent: 'action', priority: 99, label: '말 걸기',
    test: () => {
      if (!current || busy) return null;
      const p = player.position;
      let best = null, bd = 1.4;
      for (const a of current.actors) { const d = Math.hypot(p.x - a.actor.position.x, p.z - a.actor.position.z); if (d < bd) { bd = d; best = a; } }
      return best;
    },
    run: async a => {
      a.actor.lookAt(player.position.x, player.position.z);
      player.face(a.actor.position.x, a.actor.position.z);
      const lines = greetLines(cfg.greet, a.k + (a.said = (a.said ?? -1) + 1), { owner: current?.trip.owner ?? '', island: current?.trip.island ?? '' });
      await ui.dialog.open({ speaker: a.name, color: a.color, voice: a.voice, lines });
    },
  });
  // 읽기만: 구경 중에는 위 둘(과 그보다 높은 것)만 — 흔들기·줍기·채집·문·가구·도구는 여기서 멈춘다 (M21-P4 방명록 받침은 95 쯤에 달면 된다)
  let warned = 0;
  interactions.add({
    name: 'visit-hands', priority: 94, label: '',
    test: () => (current && !busy ? true : null),
    run: () => {
      const n = performance.now();
      if (n - warned > 2500) { warned = n; toast('친구 섬에서는 구경만 할 수 있어요 👀', '🏝️'); }
    },
  });

  // 05:00 새 날: 구경 중이면 돌아온다
  events.on('data:newday', () => { if (current) back({ auto: true }); });
  // 구경 섬에서 끈 저장: 다음엔 본섬 배 옆에서 (tour·boat 의 game:ready 가 먼저 옮긴 뒤에 이긴다 — gameplay 목록에서 visit 가 맨 끝)
  events.on('game:ready', () => {
    if (current) return;
    const v = V();
    if (v.trip || player.position.x > ox - 100) { v.trip = null; player.teleport(homeStand.x, homeStand.z, Math.PI / 2); }
  });

  // 서비스 고리 (visit 서비스에 붙인다)
  Object.assign(api, {
    /** 지금 구경 중인 섬 { code, user(주인 uid), island, owner, guestbook: {x, z} (방명록 받침 PR-45 자리, 월드 좌표) } | null — M21-P4 가 쓴다 */
    trip: () => (current ? { code: current.trip.code, user: current.trip.user, island: current.trip.island, owner: current.trip.owner, guestbook: { ...current.guestbook } } : null),
    get visiting() { return !!current; },
    get travelBusy() { return busy; },
    /** 섬 고르기 창 열기 · 섬 문서로 바로 가기 · 돌아오기 (봇·점검용) */
    pick, go, back,
    /** 배 자리 (봇·점검용): 본섬 / 구경 섬 */
    boat: () => (current ? { ...current.boat } : { ...homeBoat }),
    stand: () => ({ ...homeStand }),
    travelConfig: cfg,
  });

  console.info('[visit] 친구 섬 배 준비됨', homeBoat);
  return { update(dt) { for (const a of current?.actors ?? []) a.actor.update?.(dt); } };
}
