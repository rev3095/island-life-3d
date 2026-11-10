// P35 무인도 투어 (보드 tour, 반영 v1 = D120–D128 모두 A). 설정 assets/tour/tour.json, 약속 docs/CONTRACTS.md 「투어」, 노트 docs/notes/p35-tour.md.
//  - 본섬 선착장(BD-05) 끝 동쪽 바다에 작은 배(BD-10)를 놓는다 (저장 안 함). Space → 여행 묻기 창(UI-22) → 표 한 장(없으면 1,000 도토리) → 원형 전환
//  - 투어 섬: 그날 날짜·횟수로 모양 틀(TO-01–04)·시드를 정해 gameplay/tour/islet.js 로 만들고 world.islet.enter 로 x 900 에 세운다.
//    world 의 칸 질문이 그 섬으로 가서 나무 흔들기·낚시·곤충·바위 치기·꽃 꺾기가 그대로 돈다. 광석 바위(EN-13)만 여기서 (삽·도끼, 우선순위 11).
//  - 다른 섬 주민: 다섯 번에 한 번쯤 아직 안 온 이사 주민이 놀러 와 있다 → 말 걸면 초대 → town.moving.invite(slug) (다음 이사 주민)
//  - 돌아오기: 투어 섬 배에서 Space, 또는 05:00 (data:newday) 에 저절로. 섬에서 끄면 다음엔 본섬 선착장에서 시작.
//  - 저장: state.tour = { day, trips (그날 다녀온 횟수), total, gifted (첫 표 받음), invited: [slug], last: {shape, seed} } 만. 섬 지형·물체는 저장 안 함.
import { generateIslet, isletOf, SHAPES } from './islet.js';
import { createActor } from '../town/actor.js';

const REACH = 1.7;          // 배에서 이만큼 안이면 Space
let T = null;

export default {
  name: 'tour',

  async init(ctx) {
    const { events, services } = ctx;
    const world = services.world, player = services.player, data = services.data, ui = services.ui;
    const interactions = services.gameplay?.interactions;
    if (!world?.islet || !player || !data || !interactions) { console.warn('[tour] world.islet·player·data·gameplay 가 있어야 투어를 켤 수 있다 — 건너뜀'); return; }
    const cfg = await ctx.assets.loadJSON('assets/tour/tour.json');
    const S = () => {
      const t = (ctx.state.tour ??= {});
      t.trips ??= 0; t.total ??= 0; t.gifted ??= false; t.invited ??= []; t.day ??= null; t.last ??= null;
      return t;
    };
    const dayKey = () => data.day?.key?.() ?? new Date().toISOString().slice(0, 10);
    const sfx = (name, o = {}) => events.emit('sfx', { name, ...o });
    const toast = (text, icon) => events.emit('toast', { text, icon });
    const gather = () => services.gather;

    // ---------- 본섬 배 ----------
    const home = world.home;
    const dock = home.places.dock;      // { x, z: 선착장 끝쪽 } (generateIsland places.dock)
    const dockObj = home.objects.list('dock')[0];
    const boatAt = dockObj ? { x: dockObj.x + 1.55, z: dockObj.z + 3.3 } : dock ? { x: dock.x + 1.55, z: dock.z + 0.8 } : null;
    const standAt = dockObj ? { x: dockObj.x + 0.15, z: dockObj.z + 3.4 } : dock;   // 배 옆 선착장 끝
    let homeBoat = null;
    if (boatAt) {
      const t = home.island.toTile(boatAt.x, boatAt.z);
      homeBoat = home.objects.add('tour-boat', t.tx, t.tz, { persist: false, id: 'tour:home-boat', at: { x: boatAt.x, z: boatAt.z, y: 0 } });
    }

    // ---------- 상태 ----------
    let current = null;        // { gen, shape, guest: { slug, name, actor }, oreHits: {} }
    let busy = false;
    const active = () => !!current;

    /** 오늘 갈 수 있나 → { ok, reason, pay: 'ticket' | 'acorns' | 'gift' } */
    function canGo() {
      const t = S();
      if (t.day !== dayKey()) { t.day = dayKey(); t.trips = 0; }
      if (t.trips >= cfg.ticket.perDay) return { ok: false, reason: '오늘은 이미 다녀왔어요. 내일 새벽 5시가 지나면 배가 다시 떠요.' };
      if (cfg.ticket.firstFree && !t.gifted) return { ok: true, pay: 'gift' };
      if (data.inventory.slots.some(s => s?.id === cfg.ticket.item)) return { ok: true, pay: 'ticket' };
      if (data.wallet.canAfford(cfg.ticket.price)) return { ok: true, pay: 'acorns' };
      return { ok: false, reason: `표가 없고 도토리도 모자라요 (${cfg.ticket.price.toLocaleString('ko-KR')} 도토리).` };
    }

    // ---------- 다른 섬 주민 ----------
    function guestFor(trip) {
      const town = services.town?.moving;
      if (!town?.movers) return null;
      const M = town.state();
      const t = S();
      const left = town.movers().filter(s => !M.arrived?.includes(s) && !(M.departed ?? []).some(d => d.slug === s) && M.coming !== s && !t.invited.includes(s));
      if (!left.length) return null;
      const n = t.total + 1;
      if (n !== cfg.guest.firstTrip && n % cfg.guest.every !== 0) return null;
      return left[(trip + n) % left.length];
    }
    async function placeGuest(slug, at) {
      try {
        const info = await ctx.assets.loadJSON(`assets/villagers/${slug}.json`).catch(() => ({}));
        const actor = await createActor(ctx, slug);
        actor.position.set(at.x, world.island.heightAt(at.x, at.z), at.z);
        actor.setFacing(Math.PI);
        actor.play('idle');
        return { slug, name: info.name ?? slug, actor, invited: false, x: at.x, z: at.z };
      } catch (e) { console.warn('[tour] 다른 섬 주민을 못 불렀다', slug, e); return null; }
    }

    // ---------- 오가기 ----------
    async function go() {
      if (busy || current) return;
      const can = canGo();
      if (!can.ok) { toast(can.reason, '⛵'); return; }
      const price = cfg.ticket.price.toLocaleString('ko-KR');
      const text = can.pay === 'gift' ? '첫 여행은 표를 선물로 드려요! 무인도로 떠나 볼까요?'
        : can.pay === 'ticket' ? '섬 여행 표 한 장을 내고 무인도로 떠나 볼까요?'
        : `표가 없어요. ${price} 도토리를 내고 무인도로 떠나 볼까요?`;
      const yes = await ui.confirm({ title: '⛵ 섬 여행', text: `${text}\n(오늘 한 번 · 새벽 5시가 되면 저절로 돌아와요)`, icon: data.items.get(cfg.ticket.item)?.icon,
        buttons: [{ label: '떠나요', value: true, primary: true }, { label: '다음에', value: false }] });
      if (!yes) return;
      const t = S();
      if (can.pay === 'gift') t.gifted = true;
      else if (can.pay === 'ticket') data.inventory.removeId(cfg.ticket.item, 1);
      else if (!data.wallet.spend(cfg.ticket.price)) { toast('도토리가 모자라요.', '🌰'); return; }
      t.trips++;
      const { seed, shape } = isletOf(dayKey(), t.trips - 1, ctx.state.island?.seed ?? 0);
      const guest = guestFor(t.trips);
      busy = true;
      try {
        player.freeze(true);
        if (standAt) await player.walkTo(standAt.x, standAt.z, { speed: 2.2 }).catch(() => {});
        if (boatAt) player.face(boatAt.x, boatAt.z);
        sfx('splash', { volume: 0.5, pitch: 0.8 });
        await ui.fade(true, 0.6, '#1E2A3A', { shape: 'circle' });
        toast(`⛵ 바다를 건너는 중… (${SHAPES[shape].name})`, '🌊');
        const gen = generateIslet(seed, { shape, guest: !!guest });
        await Promise.all([world.islet.enter(gen, cfg.ox), new Promise(r => setTimeout(r, cfg.boat.sail * 300))]);   // 바다 건너는 시간 (모델 받기와 같이)
        current = { gen, shape, seed, guest: null, ores: {} };
        t.total++; t.last = { shape, seed, day: dayKey() };
        const sp = gen.places.spawn;
        player.teleport(sp.x + cfg.ox, sp.z, sp.facing ?? 0);
        if (guest && gen.places.guest) current.guest = await placeGuest(guest, { x: gen.places.guest.x + cfg.ox, z: gen.places.guest.z });
        spawnRare();
        await ui.fade(false, 0.6, '#1E2A3A', { shape: 'circle' });
        toast(`무인도 「${SHAPES[shape].name}」에 도착했어요! 과일·광석·희귀한 물고기와 곤충을 찾아보세요`, '🏝️');
        if (current.guest) toast(`누군가 섬에 와 있어요… ${current.guest.name}?`, '👀');
        events.emit('tour:arrive', { shape, seed, guest: current.guest?.slug ?? null });
      } catch (e) {
        console.error('[tour] 떠나기', e);
        cleanup();
        ui.fade(false, 0.2);
      } finally { player.freeze(false); busy = false; }
    }

    function cleanup() {
      if (current?.guest?.actor) { ctx.scene.remove(current.guest.actor.root); }
      // 투어 섬에 떨어진 것·곤충은 치운다 (본섬 저장에 남지 않게)
      const g = gather();
      if (g?.drops) for (const d of [...g.drops.list]) if (d.x > cfg.ox - 100) g.drops.remove(d);
      // 그날 기록 중 투어 섬 물체(id 'tour:') 것은 지운다
      const isl = ctx.state.island ?? {};
      for (const k of Object.keys(isl.fruit ?? {})) if (k.startsWith('tour:')) delete isl.fruit[k];
      const d = isl.daily;
      if (d) for (const key of ['trees', 'rocks', 'chops']) for (const k of Object.keys(d[key] ?? {})) if (k.startsWith('tour:')) delete d[key][k];
      if (d?.rockBugs) d.rockBugs = d.rockBugs.filter(k => !String(k).startsWith('tour:'));
      world.islet.leave();
      current = null;
    }

    async function back({ auto = false } = {}) {
      if (busy || !current) return;
      if (!auto) {
        const yes = await ui.confirm({ title: '⛵ 돌아가기', text: '본섬으로 돌아갈까요? (오늘은 다시 올 수 없어요)', buttons: [{ label: '돌아가요', value: true, primary: true }, { label: '조금 더', value: false }] });
        if (!yes) return;
      }
      busy = true;
      try {
        player.freeze(true);
        await ui.fade(true, 0.6, '#1E2A3A', { shape: 'circle' });
        if (auto) toast('날이 밝았어요. 배가 본섬으로 돌아가요', '🌅');
        cleanup();
        const to = standAt ?? { x: 0, z: 0 };
        player.teleport(to.x, to.z - 0.4, 0);
        await new Promise(r => setTimeout(r, 300));
        await ui.fade(false, 0.6, '#1E2A3A', { shape: 'circle' });
        events.emit('tour:return', { auto });
      } finally { player.freeze(false); busy = false; }
    }

    // ---------- 희귀 곤충 (도착할 때 한둘) ----------
    function spawnRare() {
      const g = gather();
      if (!g?.bugs?.debugSpawn || !current) return;
      const hour = services.time?.now?.().hour ?? new Date().getHours();
      const night = hour >= 19 || hour < 5;
      const ores = world.objects.list('ore-rock');
      if (!night && ores[0]) g.bugs.debugSpawn('bug.jewel-beetle', 'rock', ores[0].x + 0.6, ores[0].z + 0.3);
      if (night) {
        const tr = world.objects.list('tree')[0];
        if (tr) g.bugs.debugSpawn('bug.moon-moth', 'air', tr.x + 0.8, tr.z + 0.5);
      }
    }

    // ---------- 광석 바위 (EN-13) ----------
    const oreTable = cfg.ore.table;
    function oreFront() {
      if (!current || !['shovel', 'axe'].includes(player.tool)) return null;
      const f = player.pointInFront(0.6);
      return world.objects.query(f.x, f.z, 0.6).find(o => o.kind === 'ore-rock') ?? null;
    }
    async function hitOre(o) {
      const hits = current.ores[o.id] ?? 0;
      const tool = player.tool;
      player.face(o.x, o.z);
      await player.act(tool === 'axe' ? 'chop' : 'dig', {
        onHit() {
          const hitAt = { x: o.x + (player.position.x - o.x) * 0.35, y: o.y + 0.3, z: o.z + (player.position.z - o.z) * 0.35 };
          sfx('axe-rock', tool === 'shovel' ? { pitch: 1.15 } : {});
          gather()?.fx?.chips?.(hitAt, 'stone', 6);
          gather()?.fx?.sparkle?.(hitAt, 2);
          gather()?.toolbelt?.use?.(tool);
          if (hits >= cfg.ore.maxHits) { toast('이 바위는 오늘 다 캤어요', '🪨'); return; }
          current.ores[o.id] = hits + 1;
          let r = Math.random(), id = cfg.ore.rest;
          for (const [it, p] of oreTable) { if (r < p) { id = it; break; } r -= p; }
          const drops = gather()?.drops;
          const toward = Math.atan2(player.position.x - o.x, player.position.z - o.z);
          const spot = drops?.findSpot(o.x, o.z, { rMin: 0.65, rMax: 1.05, toward });
          if (spot) drops.drop(id, 1, spot, { from: { x: hitAt.x, y: hitAt.y + 0.2, z: hitAt.z } });
          else gather()?.results?.gain(id, 1, { verb: '캤다' });
          if (id === 'mat.gold-ore' || id === 'mat.crystal') toast(`반짝! ${data.items.get(id)?.name ?? id}이 나왔어요`, '✨');
        },
      }).catch(() => {});
    }

    // ---------- 행동 키 ----------
    const near = (p, at) => at && Math.hypot(p.x - at.x, p.z - at.z) < REACH;
    const isletBoat = () => (current ? { x: current.gen.places.boat.x + cfg.ox, z: current.gen.places.boat.z } : null);
    interactions.add({
      name: 'tour-boat', intent: 'action', priority: 95, label: () => (current ? '돌아가기' : '섬 여행'),
      test: () => {
        if (busy) return null;
        const p = player.position;
        if (current) return near(p, isletBoat()) ? 'back' : null;
        return near(p, boatAt) ? 'go' : null;
      },
      run: what => (what === 'back' ? back() : go()),
    });
    interactions.add({
      name: 'tour-guest', intent: 'action', priority: 99, label: '말 걸기',
      test: () => {
        const g = current?.guest;
        if (!g || busy) return null;
        return Math.hypot(player.position.x - g.actor.position.x, player.position.z - g.actor.position.z) < 1.4 ? g : null;
      },
      run: async g => {
        g.actor.lookAt(player.position.x, player.position.z);
        player.face(g.actor.position.x, g.actor.position.z);
        if (g.invited) { toast(`${g.name}: 곧 이삿짐 싸서 갈게!`, '🏡'); return; }
        const yes = await ui.confirm({ title: `${g.name}`, text: `${g.name}: 어머, 여기서 사람을 만나다니! 여행 왔어? 이 섬 참 좋지…\n\n우리 섬에 와서 같이 살자고 해 볼까요?`,
          buttons: [{ label: '우리 섬에 올래?', value: true, primary: true }, { label: '그냥 인사만', value: false }] });
        if (!yes) { toast(`${g.name}: 또 만나!`, '👋'); return; }
        g.invited = true;
        S().invited.push(g.slug);
        services.town?.moving?.invite?.(g.slug);
        g.actor.playOnce?.('happy');
        sfx('happy');
        toast(`${g.name}: 정말? 좋아! 집터가 생기면 이사 갈게!`, '🏡');
        events.emit('tour:invite', { slug: g.slug });
      },
    });
    interactions.add({ name: 'tour-ore', intent: 'action', priority: 11, label: '캐기', test: () => oreFront(), run: o => hitOre(o) });

    // 05:00 새 날: 투어 중이면 돌아온다
    events.on('data:newday', () => { if (current) back({ auto: true }); });
    // 투어 섬에서 끈 저장: 다음엔 본섬 선착장에서 (섬 x 자리에 서 있으면)
    events.on('game:ready', () => {
      const p = player.position;
      if (!current && p.x > cfg.ox - 100 && standAt) player.teleport(standAt.x, standAt.z - 0.4, 0);
    });

    T = { update(dt) { current?.guest?.actor?.update?.(dt); } };
    services.tour = {
      get active() { return active(); },
      get busy() { return busy; },
      /** 지금 투어 섬 { shape, seed, guest } | null */
      get current() { return current ? { shape: current.shape, seed: current.seed, guest: current.guest?.slug ?? null, invited: !!current.guest?.invited } : null; },
      canGo, go, back,
      /** 배 자리 (봇·점검용): 본섬 / 투어 섬 */
      boat: () => (current ? isletBoat() : boatAt),
      stand: () => standAt,
      config: cfg,
      homeBoat,
    };
    console.info('[tour] 무인도 투어 준비됨');
  },

  update(dt) { T?.update(dt); },
};
