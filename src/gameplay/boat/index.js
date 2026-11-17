// 어선·뱃사공·먼바다 낚시 (east-fishboat, D275–D279). 설정 assets/boat/boat.json, 규칙(순수) rules.js, 노트 docs/notes/east-fishboat.md.
//  - 섬 동쪽 끝 바닷가(assets/island/layout.json fishDock = [x, z] 비율, z 만 씀)에 부두 BD-19 fish-dock + 어선 fish-boat 를 놓는다 (저장 안 함, persist:false).
//    부두 뿌리 모래밭에 뱃사공 너울(CH-21, 해달). 처음 가까이 가면 boat:meet { first } → 장면 s68 (트리거 boat-meet).
//  - 너울에게 말 걸기(99) → 「먼바다 낚시 — 🌰 N」 → 뱃삯(처음은 공짜) → 배가 동쪽으로 떠남(sail 초) → 원형 전환 → x 1100 먼바다:
//    따로 띄운 바다 판 + 어선 + 갑판 구역(world.addZone, 갑판 타원 안만 걸음). 배 위에서 낚싯대를 던지면 gather/fishing.js 의 habitatAt 이
//    services.boat.habitatAt 을 먼저 물어 'offshore' 서식지 → 먼바다 물고기 IC-OF-01–12 (섬 물에서는 안 나옴).
//    첫 출항이면 도착하며 boat:sail { first } → 장면 s69 (트리거 boat-sail).
//  - 돌아오기: 게임 시간 trip.hours 가 지나면 저절로 · 배 위 너울에게 「돌아가요」 · 05:00 새 날. 먼바다에서 끈 저장은 다음에 부두 앞에서 시작.
//  - 저장: state.boat = { met, freeUsed, trips, total, day, caught } 만. 배 위·먼바다는 저장 안 함 (투어처럼).
import * as R from './rules.js';
import { createActor } from '../town/actor.js';

const TALK = 1.5;          // 너울 앞 말 걸기 거리
const SEE = 6;             // 처음 만남 장면을 트는 거리
const SEA_Y = -0.17;       // 바다 판 높이 (world/terrain.js SEA_Y 와 같게)
const SAIL_DIST = 7;
let B = null;

export default {
  name: 'boat',

  async init(ctx) {
    const { events, services, THREE } = ctx;
    const world = services.world, player = services.player, data = services.data, ui = services.ui;
    const interactions = services.gameplay?.interactions;
    if (!world?.home || !player || !data || !interactions) { console.warn('[boat] world·player·data·gameplay 가 있어야 어선을 켤 수 있다 — 건너뜀'); return; }
    const [cfg, talkFile, layout] = await Promise.all([
      ctx.assets.loadJSON('assets/boat/boat.json'),
      ctx.assets.loadJSON('assets/boat/neoul.json').catch(() => ({ name: '너울', lines: {} })),
      ctx.assets.loadJSON('assets/island/layout.json').catch(() => ({})),
    ]);
    const L = talkFile.lines ?? {};
    const who = { speaker: talkFile.name ?? '너울', color: talkFile.color, voice: talkFile.voice };
    const S = () => {
      const b = (ctx.state.boat ??= {});
      b.trips ??= 0; b.total ??= 0; b.caught ??= 0; b.met ??= null; b.freeUsed ??= false; b.day ??= null;
      return b;
    };
    const now = () => services.time?.now?.() ?? { ms: Date.now(), hourF: new Date().getHours(), dayKey: new Date().toISOString().slice(0, 10) };
    const sfx = (name, o = {}) => events.emit('sfx', { name, ...o });
    const toast = (text, icon) => events.emit('toast', { text, icon });
    const pick = list => (Array.isArray(list) && list.length ? list[Math.floor(Math.random() * list.length)] : '');
    const vars = () => ({ fare: (cfg.fare?.price ?? 0).toLocaleString('ko-KR'), hours: cfg.trip?.hours ?? 2 });
    const fillAll = list => [list].flat().filter(Boolean).map(s => R.fill(s, vars()));
    const say = (lines, choices) => ui.dialog.open({ ...who, lines: fillAll(lines), choices });

    // ---------- 부두 자리 (본섬 동쪽 끝) ----------
    const home = world.home;
    const zr = Array.isArray(layout.fishDock) ? layout.fishDock[1] : 0.55;
    const site = R.findDockSite(home.island, zr, { pier: cfg.dock.pier });
    if (!site) { console.warn('[boat] 동쪽 바닷가에서 부두 자리를 못 찾았다 — 건너뜀'); return; }
    const root = { x: site.x + 0.5, z: site.z };                                   // 모래 끝 = 부두 뿌리
    const boatAt = { x: root.x + cfg.dock.boat[0], z: root.z + cfg.dock.boat[1] };
    const keeperHome = { x: root.x + cfg.dock.keeper[0], z: root.z + cfg.dock.keeper[1] };
    const frontHome = { x: root.x + cfg.dock.front[0], z: root.z + cfg.dock.front[1] };
    const putObj = (kind, id, at) => {
      if (home.objects.get?.(id)) return;
      const t = home.island.toTile(at.x, at.z);
      home.objects.add(kind, Math.min(home.island.w - 1, t.tx), t.tz, { persist: false, id, at: { x: at.x, z: at.z, y: 0 } });
    };
    putObj('fish-dock', 'boat:dock', root);
    const putHomeBoat = () => putObj('fish-boat', 'boat:home-boat', boatAt);
    putHomeBoat();

    // ---------- 뱃사공 ----------
    let keeper = null, storyOn = false;
    const keeperReady = createActor(ctx, cfg.keeper).then(a => {
      keeper = a;
      a.place(keeperHome.x, keeperHome.z, Math.PI);
      a.play?.('idle');
      return a;
    }).catch(e => { console.warn('[boat] 너울 모델을 못 받았다 (말은 걸 수 있다)', e); return null; });
    const keeperPos = () => (keeper ? keeper.position : current ? seaKeeper() : keeperHome);
    events.on('story:start', () => { storyOn = true; if (keeper) keeper.root.visible = false; });
    events.on('story:end', () => { storyOn = false; if (keeper) keeper.root.visible = true; });

    // ---------- 먼바다 (x ox) ----------
    const ox = cfg.ox;
    let sea = null;        // { group, boat }
    async function buildSea() {
      if (sea) return sea;
      const group = new THREE.Group();
      group.name = 'boat:offshore';
      const size = cfg.sea.size;
      const geo = new THREE.PlaneGeometry(size, size, 60, 60);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      const near = new THREE.Color(cfg.sea.color), deep = new THREE.Color(cfg.sea.deep), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i), pos.getZ(i));
        c.copy(near).lerp(deep, THREE.MathUtils.smoothstep(d, 4, 40));
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = ctx.materials.toonMaterial('#ffffff', { name: 'offshoreSea' });
      mat.vertexColors = true;
      const water = new THREE.Mesh(geo, mat);
      water.position.set(ox, SEA_Y, 0);
      water.receiveShadow = true;
      group.add(water);
      const boat = await boatMesh('boat:sea-boat');
      boat.position.set(ox, 0, 0);
      boat.visible = true;
      group.add(boat);
      group.visible = false;
      ctx.scene.add(group);
      return (sea = { group, boat, water });
    }
    async function boatMesh(name) {
      const [gltf, spec] = await Promise.all([ctx.assets.loadModel('assets/env/models/fish-boat'), ctx.assets.loadJSON('assets/env/specs/fish-boat.json').catch(() => null)]);
      const { scene: obj } = ctx.assets.instantiate(gltf);
      ctx.materials?.applyToonStyle?.(obj, { spec });
      obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
      obj.name = name;
      return obj;
    }
    const deck = cfg.boat.deck;
    const seaKeeper = () => ({ x: ox + cfg.boat.keeperAt[0], z: cfg.boat.keeperAt[1] });
    const seaZone = {
      contains: (x, z) => Math.abs(x - ox) < cfg.sea.size / 2 && Math.abs(z) < cfg.sea.size / 2,
      collide(fx, fz, nx, nz, r) { const p = R.clampDeck(cfg, nx - ox, nz, r ?? 0.22); return { x: p.x + ox, z: p.z }; },
      heightAt: (x, z) => (R.onDeck(cfg, x - ox, z, 0.05) ? deck : SEA_Y),
      groundAt: () => 'wood',
      isWalkable: (x, z) => { const p = R.clampDeck(cfg, x - ox, z, 0.22); return Math.abs(p.x - (x - ox)) < 1e-6 && Math.abs(p.z - z) < 1e-6; },
    };

    // ---------- 떠나는 배 연출 (tour sailAway 와 같은 모양) ----------
    let sailMesh = null, sailing = null;
    async function sailAway() {
      sailMesh ??= await boatMesh('boat:sail-boat').then(m => { ctx.scene.add(m); return m; }).catch(e => { console.warn('[boat] 떠나는 배 모델', e); return null; });
      if (!sailMesh) return;
      home.objects.remove('boat:home-boat');
      sailMesh.position.set(boatAt.x, 0, boatAt.z);
      sailMesh.visible = true;
      player.teleport(boatAt.x - 0.6, boatAt.z, -Math.PI / 2);
      sfx('splash', { volume: 0.5, pitch: 0.8 });
      await new Promise(res => { sailing = { t: 0, dur: cfg.boat.sail ?? 3, res }; });
    }
    function sailStep(dt) {
      const s = sailing;
      if (!s) return;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur), e = k * k * (3 - 2 * k);
      const x = boatAt.x + e * SAIL_DIST, bob = Math.sin(s.t * 4.2) * 0.04;
      sailMesh.position.set(x, bob, boatAt.z);
      sailMesh.rotation.x = Math.sin(s.t * 3.1) * 0.03;
      player.position.set(x - 0.6, deck + bob, boatAt.z);
      if (k >= 1) { sailing = null; s.res(); }
    }

    // ---------- 상태 ----------
    let current = null;      // { startMs, warned, zoneOff }
    let busy = false;
    const hasRod = () => !!data.inventory?.hasTool?.('rod') || data.inventory?.slots?.some?.(s => s?.id === 'tool.rod');

    async function talkHome() {
      const b = S(), n = now();
      keeper?.lookAt?.(player.position.x, player.position.z);
      player.face?.(keeperPos().x, keeperPos().z);
      if (!b.met) { b.met = n.dayKey; await say(L.first); }
      if (b.today !== n.dayKey) { b.today = n.dayKey; }
      const part = n.hourF < 11 ? 'morning' : n.hourF < 17 ? 'afternoon' : n.hourF < 20 ? 'evening' : 'night';
      const fare = R.fareOf(cfg, { ...b, today: n.dayKey }, data.wallet?.get?.() ?? 0);
      const label = fare.pay === 'free' ? '먼바다 낚시 — 처음은 공짜' : `먼바다 낚시 — 🌰 ${vars().fare}`;
      const a = await say([pick(L.greet?.[part]) || pick(L.chat)], [label, '이야기해 줘요', '그냥 인사만']);
      if (a === 1) { await say([pick(L.chat)]); return; }
      if (a !== 0) { await say([pick(L.bye)]); return; }
      if (!hasRod()) { await say(L.norod); return; }
      if (!fare.ok) { await say(L.short); return; }
      const yes = await ui.confirm({ title: '🚤 먼바다 낚시', icon: '🎣', text: R.fill(fare.pay === 'free' ? L.askFree : L.ask, vars()),
        buttons: [{ label: '나가요', value: true, primary: true }, { label: '다음에', value: false }], cancelValue: false });
      if (!yes) { await say([pick(L.bye)]); return; }
      if (fare.pay === 'acorns' && !data.wallet.spend(fare.price)) { await say(L.short); return; }
      if (fare.pay === 'free') b.freeUsed = true;
      await say([pick(L.sail)]);
      go();
    }

    async function go() {
      if (busy || current) return;
      const b = S(), n = now();
      busy = true;
      try {
        player.freeze(true);
        await keeperReady;
        if (keeper) keeper.root.visible = false;         // 너울도 배에 탄다
        await sailAway();
        await ui.fade(true, 0.6, '#1E2A3A', { shape: 'circle' });
        if (sailMesh) sailMesh.visible = false;
        toast('🚤 먼바다로 나가는 중…', '🌊');
        const s = await buildSea();
        s.group.visible = true;
        const zoneOff = world.addZone(seaZone);
        current = { startMs: now().ms, warned: false, zoneOff };
        if (b.day !== n.dayKey) { b.day = n.dayKey; b.trips = 0; }
        b.trips++; b.total++;
        const sp = cfg.boat.spawn;
        player.teleport(ox + sp[0], sp[1], -Math.PI / 2);
        if (keeper) { const k = seaKeeper(); keeper.place(k.x, k.z, Math.PI / 2); keeper.root.visible = !storyOn; }
        await new Promise(r => setTimeout(r, 300));
        await ui.fade(false, 0.6, '#1E2A3A', { shape: 'circle' });
        toast(R.fill(pick(L.arrive) || '먼바다에 도착했어요!', vars()), '🎣');
        events.emit('boat:sail', { first: b.total === 1, x: ox + sp[0], z: sp[1] });
      } catch (e) {
        console.error('[boat] 떠나기', e);
        cleanup();
        player.teleport(frontHome.x, frontHome.z, Math.PI / 2);
        ui.fade(false, 0.2);
      } finally { player.freeze(false); busy = false; }
    }

    function cleanup() {
      current?.zoneOff?.();
      if (sea) sea.group.visible = false;
      if (sailMesh) sailMesh.visible = false;
      if (sailing) { const r = sailing.res; sailing = null; r(); }
      current = null;
      putHomeBoat();
      if (keeper) { keeper.place(keeperHome.x, keeperHome.z, Math.PI); keeper.root.visible = !storyOn; }
    }

    async function back({ auto = false } = {}) {
      if (busy || !current) return;
      if (!auto) {
        const yes = await ui.confirm({ title: '🚤 돌아가기', text: '섬으로 돌아갈까요?', buttons: [{ label: '돌아가요', value: true, primary: true }, { label: '조금 더', value: false }], cancelValue: false });
        if (!yes) return;
      }
      busy = true;
      try {
        player.freeze(true);
        await ui.fade(true, 0.6, '#1E2A3A', { shape: 'circle' });
        // 바다에 떨어진 것(가방이 꽉 차서 떨군 물고기 등)은 부두 앞으로 옮긴다
        const g = services.gather;
        const moved = g?.drops ? g.drops.list.filter(d => d.x > ox - 100) : [];
        cleanup();
        for (const d of moved) {
          g.drops.remove(d);
          const spot = g.drops.findSpot?.(frontHome.x, frontHome.z, { rMin: 0.4, rMax: 1.4 }) ?? frontHome;
          g.drops.drop(d.rec.item, d.rec.count ?? 1, spot);
        }
        player.teleport(frontHome.x, frontHome.z, Math.PI / 2);
        await new Promise(r => setTimeout(r, 300));
        await ui.fade(false, 0.6, '#1E2A3A', { shape: 'circle' });
        if (auto) toast('시간이 다 됐어요. 어선이 섬으로 돌아왔어요', '🚤');
        else toast(R.fill(pick(L.back) || '섬으로 돌아왔어요', vars()), '🚤');
        events.emit('boat:return', { auto });
      } finally { player.freeze(false); busy = false; }
    }

    async function talkSea() {
      keeper?.lookAt?.(player.position.x, player.position.z);
      const left = Math.round(R.tripLeft(cfg, current.startMs, now().ms));
      const a = await say([`${pick(L.atSea)} (남은 시간 약 ${left}분)`], ['돌아가요', '조금 더 있을래요', '이야기해 줘요']);
      if (a === 0) back({ auto: true });
      else if (a === 2) await say([pick(L.chat)]);
    }

    // ---------- 갈고리: 낚시 서식지 (gather/fishing.js habitatAt 이 먼저 묻는다) ----------
    /** 먼바다 중이면 그 물 자리의 서식지('offshore' | null), 아니면 undefined (섬 물 판정 그대로) */
    const habitatAt = (x, z) => (current && seaZone.contains(x, z) ? R.habitatAt(cfg, x - ox, z) : undefined);

    // ---------- 행동 키 ----------
    const near = (at, r) => Math.hypot(player.position.x - at.x, player.position.z - at.z) < r;
    interactions.add({
      name: 'boat-keeper', intent: 'action', priority: 99, label: () => (current ? '너울과 이야기' : '말 걸기'),
      test: () => {
        if (busy || storyOn) return null;
        if (current) return near(seaKeeper(), TALK + 0.3) ? 'sea' : null;
        return near(keeperPos(), TALK) ? 'home' : null;
      },
      run: what => (what === 'sea' ? talkSea() : talkHome()),
    });

    // 처음 만남 (장면 s68): 부두 가까이 오면 한 번
    function meetCheck() {
      const b = S();
      if (b.seenFirst || current || storyOn || services.story?.playing) return;
      if (!near(keeperHome, SEE)) return;
      b.seenFirst = now().dayKey;
      events.emit('boat:meet', { first: true, x: frontHome.x, z: frontHome.z });
    }
    // 잡은 먼바다 물고기 (일지 「먼바다 물고기」)
    events.on('gather:catch', ({ id } = {}) => {
      if (!current || !data.items.get(id)?.offshore) return;
      S().caught++;
      events.emit('boat:catch', { id });
    });
    events.on('data:newday', () => { if (current) back({ auto: true }); });
    // 먼바다에서 끈 저장: 다음엔 부두 앞에서 (tour 의 game:ready 뒤에 돌아 이긴다 — gameplay 모듈 순서 tour → boat)
    events.on('game:ready', () => { if (!current && player.position.x > ox - 100) player.teleport(frontHome.x, frontHome.z, Math.PI / 2); });

    let t = 0;
    B = {
      update(dt) {
        sailStep(dt);
        if (keeper?.root.visible) keeper.update(dt, true);
        t += dt;
        if (current && sea) {
          const bob = Math.sin(t * 1.6) * 0.025;
          sea.boat.position.y = bob;
          sea.boat.rotation.x = Math.sin(t * 1.1) * 0.02;
          if (!busy) {
            const left = R.tripLeft(cfg, current.startMs, now().ms);
            if (!current.warned && left <= (cfg.trip.warnMinutes ?? 20)) { current.warned = true; toast(R.fill(pick(L.warn), vars()), '⏳'); }
            if (left <= 0) back({ auto: true });
          }
        } else if (!busy && (t % 0.5) < dt) meetCheck();
      },
    };
    services.boat = {
      get active() { return !!current; },
      get busy() { return busy; },
      habitatAt, go, back,
      /** 봇·점검용 자리 */
      site: () => ({ root: { ...root }, boat: { ...boatAt }, keeper: { ...keeperHome }, front: { ...frontHome } }),
      left: () => (current ? R.tripLeft(cfg, current.startMs, now().ms) : 0),
      config: cfg,
    };
    console.info('[boat] 어선 선착장 준비됨', root);
  },

  update(dt) { B?.update(dt); },
};
