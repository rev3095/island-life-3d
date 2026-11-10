// 트랙 W3 (P4): 집 실내 · 가구 배치 · 작업대 제작. src/gameplay/index.js 가 불러온다.
//  - 플레이어 집 문(world.places.playerHouse) 앞에서 행동 키(우선순위 90) 또는 문 쪽으로 밀기 → 문이 열리고 걸어 들어가 방 안으로 (door.js, 실내 보드 D67·D68).
//  - 방은 x = 500 에 지은 8×8 칸 (room.js), world.addZone 으로 바닥·벽 충돌을 바꿔 끼운다.
//  - 가구: 가방에서 골라 앞 칸에 놓기, 가구 앞 행동 키(80) → 돌리기·옮기기·색 바꾸기·라디오·어항/곤충 상자에 넣기·가방에 넣기, F → 바로 가방에.
//  - 작업대(방 서쪽 벽): ui.craft 창 (없으면 대화 선택지로, craft.js).
//  - 5차 Z2: 벽지·바닥(assets/interior 스펙, interior.js·pattern.js). 벽을 보고 행동 키(25) → 꾸미기 메뉴(벽지·바닥 바꾸기·가구 놓기).
//    상점 코너(ui/shop.js)는 house.interior 로 오늘의 벽지·바닥을 보고 산다. 주민 집 문 → 주민 방(visit.js).
//  - 실내 보드 interiors: 도토리상점·박물관 실내(places.js). 드나들기는 모두 door.js 의 through() 하나로.
// 상태 칸 state.house = { furniture: [rec], inside, seeded, radio, nextId, wallpaper, floor, owned, visit, place } — rec 모양은 grid.js 맨 위 (+ variant 색, holds 넣어 둔 물고기·곤충 id).
//   place = 상점·박물관 안에서 저장했으면 'shop'|'museum' (이어하기, places.js).
// 화면 전환은 ui.fade, 카메라 범위는 player.camera.setBounds — 없으면 직접 한다.
import { ROOM_W, ROOM_D, boxOf, fits, spotInFront, rotateInPlace, wallInFront, wallFree, moveCircle, inBox } from './grid.js';
import { ROOM, buildRoom, wallMount, x0, z0, WINDOWS, DOOR, ENTRY, BOUNDS, cameraBox, CAMERA_CURVE } from './room.js';
import { createFurnitureKit } from './furniture.js';
import { openWorkbench, josa } from './craft.js';
import { loadInterior, normalizeHouse, todayPick, listOf, entryOf, KIND_NAME } from './interior.js';
import { swatchURL } from './pattern.js';
import { createVisits } from './visit.js';
import { createDoors } from './door.js';
import { createPlaces } from './places.js';
import { seatSpec, seatsOf, nearestSeat } from '../decor/seats.js';   // 10차 앉기: 의자 자리 표

const WORKBENCH = { id: 'workbench', item: 'workbench', gx: 0, gz: 2, rot: 1 };   // 서쪽 벽에 붙여 동쪽을 본다
const WORKBENCH_INFO = { footprint: [2, 1], place: 'floor' };
const STARTER = [   // 처음 들어간 날 놓여 있는 가구
  { item: 'furn.round-rug', gx: 2, gz: 3, rot: 0 },
  { item: 'furn.floor-lamp', gx: 7, gz: 0, rot: 0 },
  { item: 'furn.plant-pot', gx: 0, gz: 0, rot: 0 },
];
const RESERVED = new Set([`${DOOR.gx0},${ROOM_D - 1}`, `${DOOR.gx1},${ROOM_D - 1}`]);   // 문 매트 칸은 비워 둔다
const WINDOW_SET = new Set(WINDOWS);
const PUSH_TIME = 0.2;                                // 문 쪽으로 이만큼 밀면 드나든다
const REACH = 0.62;                                   // 플레이어 앞 몇 칸까지 가구를 건드리나
const CAMERA_BOX = cameraBox(ROOM);
const DECOR_REACH = 0.95;                             // 벽에서 이만큼 안이면 꾸미기 메뉴
const PAGE = 5;                                       // 벽지·바닥 고르기 한 쪽에 보이는 수
// 라디오 채널 = 시간대 배경음 (실내 기본곡 'indoor' 는 '작은 라디오' 분위기라 켜지 않았을 때 쓴다)
const RADIO = { dawn: '새벽 · 조용한 피아노', morning: '오전 · 밝은 마림바', afternoon: '오후 · 느긋한 우쿨렐레', evening: '저녁 · 따뜻한 패드', night: '밤 · 오르골' };
const RADIO_ORDER = Object.keys(RADIO);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let H = null;   // 이 모듈의 상태

export default {
  name: 'house',

  async init(ctx) {
    const { THREE, scene, state, events } = ctx;
    const world = ctx.services.world, player = ctx.services.player;
    if (!world || !player) { console.warn('[house] world·player 가 없어 집을 만들지 않습니다'); return; }
    const kit = createFurnitureKit(ctx);
    await kit.load();
    const interior = await loadInterior(ctx.assets.loadJSON);

    const S = (state.house ||= { furniture: [] });
    if (!Array.isArray(S.furniture)) S.furniture = [];
    S.furniture = S.furniture.filter(r => r && typeof r.item === 'string' && kit.info(r.item));   // 모르는 가구는 버린다
    if (S.furniture.length) S.seeded = true;
    if (S.radio === true) S.radio = 'morning';                         // 예전 저장 (켜짐/꺼짐만 있던 때)
    for (const r of S.furniture) if (r.holds && !ctx.services.data?.items.get(r.holds)) delete r.holds;
    normalizeHouse(S, interior.index);

    const room = buildRoom(ctx, { wallpaper: interior.specs.get(S.wallpaper), floor: interior.specs.get(S.floor), frame: interior.frame });
    room.group.visible = false;
    scene.add(room.group);

    H = {
      ctx, kit, room, S, interior, inside: false, busy: false, moving: null,
      views: new Map(),          // rec.id → { obj, rec } (만들어지는 중이면 obj = null)
      pushT: 0, pushOutT: 0, saveT: 0, fadeEl: null, bench: null,
    };

    const info = item => (item === 'workbench' ? WORKBENCH_INFO : kit.info(item));
    H.info = info;

    // ── 구역: 방 안에서는 이 바닥·벽·가구 충돌을 쓴다 ──
    const local = (x, z) => ({ lx: x - x0, lz: z - z0 });
    const blockers = () => {
      const out = [boxOf(WORKBENCH, WORKBENCH_INFO.footprint)];
      for (const r of S.furniture) {
        if (r.wall || r === H.moving?.rec) continue;
        const fi = info(r.item);
        if (!fi || fi.layer === 'rug') continue;
        const b = boxOf(r, fi.footprint);
        out.push({ x0: b.x0 + 0.04, z0: b.z0 + 0.04, x1: b.x1 - 0.04, z1: b.z1 - 0.04 });
      }
      return out;
    };
    const onRug = (lx, lz) => S.furniture.some(r => !r.wall && info(r.item)?.layer === 'rug' && r !== H.moving?.rec && inBox(boxOf(r, info(r.item).footprint), lx, lz, -0.1));
    world.addZone({
      contains: (x, z) => Math.abs(x - ROOM.x) < ROOM_W && Math.abs(z - ROOM.z) < ROOM_D,
      collide(fx, fz, nx, nz, r) {
        const p = moveCircle(blockers(), BOUNDS, fx - x0, fz - z0, nx - x0, nz - z0, r ?? 0.26);
        return { x: p.x + x0, z: p.z + z0 };
      },
      heightAt: (x, z) => { const { lx, lz } = local(x, z); return onRug(lx, lz) ? 0.03 : 0; },
      groundAt: () => room.floor?.step ?? 'wood',
      isWalkable(x, z) {
        const { lx, lz } = local(x, z);
        if (lx < BOUNDS.x0 || lz < BOUNDS.z0 || lx > BOUNDS.x1 || lz > BOUNDS.z1) return false;
        return !blockers().some(b => inBox(b, lx, lz));
      },
    });

    // 작업대: 배경 모델(assets/env 'workbench')을 그대로 쓴다
    try {
      const [gltf, spec] = await Promise.all([ctx.assets.loadEnv('workbench'), ctx.assets.loadEnvSpec('workbench')]);
      const { scene: wb } = ctx.assets.instantiate(gltf);
      ctx.materials.applyToonStyle(wb, { spec });
      const b = boxOf(WORKBENCH, WORKBENCH_INFO.footprint);
      wb.position.set(x0 + b.cx, 0, z0 + b.cz);
      wb.rotation.y = WORKBENCH.rot * Math.PI / 2;
      room.group.add(wb);
      H.bench = wb;
    } catch (e) { console.warn('[house] 작업대 모델을 못 읽었어요', e); }

    // 어두워졌다 밝아지는 막: ui.fade 가 있으면 그것 (색·원형은 door.js 가 고른다), 없으면 #ui 맨 앞(ui 창보다 아래)에 직접
    let ownFade = null;
    function fadeTo(on, sec, color, opts) {
      if (ctx.services.ui?.fade) return ctx.services.ui.fade(on, sec, color, opts);
      if (!ownFade) {
        ownFade = document.createElement('div');
        ownFade.className = 'house-fade';
        ownFade.style.cssText = 'position:fixed;inset:0;background:#2E2420;opacity:0;pointer-events:none;transition:opacity .3s ease;';
        ctx.uiRoot.prepend(ownFade);
      }
      return new Promise(res => {
        ownFade.style.transitionDuration = `${sec}s`;
        ownFade.style.opacity = on ? '1' : '0';
        setTimeout(res, sec * 1000 + 30);
      });
    }

    // 문 드나들기 (내 집·주민 집·상점·박물관 공용)
    const doors = createDoors(ctx, { fadeTo });
    H.doors = doors;

    // 저장된 가구 다시 놓기
    await Promise.all(S.furniture.map(r => spawn(r)));
    H.list = S.furniture;
    // 게임 중에 저장을 다시 불러오거나 처음부터 하면(save.load/reset) data 가 가구 목록을 새 배열로 바꾼다 → 모델을 맞춘다
    H.resync = () => {
      if (!Array.isArray(S.furniture)) S.furniture = [];
      H.moving = null;
      const keep = new Set(S.furniture);
      for (const [id, v] of H.views) if (!keep.has(v.rec)) { v.obj?.dispose(); H.views.delete(id); }
      for (const r of S.furniture) if (!H.views.has(r.id) && kit.info(r.item)) spawn(r);
      H.list = S.furniture;
      S.inside = H.inside;   // 서 있는 곳은 player 가 정한다 — 지금 있는 곳을 그대로 적는다
    };

    // ── 행동 키 ──
    const I = ctx.services.gameplay.interactions;
    // 문을 지나는 동안(door.js)은 행동 키를 모두 삼킨다 — 문 앞 노크·말 걸기가 끼어들지 않게
    I.add({ name: 'house-door-busy', priority: 300, label: '', test: () => (doors.busy ? true : null), run: () => {} });
    I.add({ name: 'house-move-drop', intent: 'action', priority: 120, test: () => H.moving, run: () => dropMoving() });
    I.add({ name: 'house-move-cancel', intent: 'pickup', priority: 120, test: () => H.moving, run: () => cancelMoving() });
    I.add({ name: 'house-door-in', intent: 'action', priority: 90, test: () => (!H.inside && !H.busy && !doors.busy && nearDoor(true) ? true : null), run: () => enter() });
    I.add({ name: 'house-door-out', intent: 'action', priority: 90, test: () => (H.inside && !H.busy && !doors.busy && onDoormat() ? true : null), run: () => leave() });
    I.add({ name: 'house-furniture', intent: 'action', priority: 80, test: () => (H.inside && !H.busy ? targetInFront() : null),
      run: t => (t.kind === 'workbench' ? workbench() : menu(t.rec)) });
    I.add({ name: 'house-furniture-store', intent: 'pickup', priority: 80, test: () => { const t = H.inside && !H.busy ? targetInFront() : null; return t?.kind === 'furniture' ? t : null; },
      run: t => store(t.rec) });
    // 10차 M10-P1 앉기: 의자·소파 앞 Space = 앉기 (가구 메뉴 80 위, 문 90 아래), 그 가구의 메뉴(돌리기·옮기기·색)는 F 로 — 일어나기는 decor/sit.js 'seat-stand' 115
    I.add({ name: 'house-sit', intent: 'action', priority: 85, label: '앉기', test: () => (H.inside && !H.busy && !H.moving ? seatInFront() : null),
      run: seat => ctx.services.seats?.sitPlayer(seat) });
    I.add({ name: 'house-seat-menu', intent: 'pickup', priority: 85, label: '고치기', test: () => (H.inside && !H.busy && !H.moving && seatInFront() ? targetInFront() : null),
      run: t => menu(t.rec) });
    I.add({ name: 'house-decor', intent: 'action', priority: 25, label: '꾸미기', test: () => (H.inside && !H.busy && !H.moving ? decorWall() : null), run: () => decorate() });
    I.add({ name: 'house-place', intent: 'action', priority: 20, test: () => (H.inside && !H.busy ? true : null), run: () => placeFromBag() });

    // 주민 집·주민 방 (visit.js): 같은 화면 전환·가구 모델·스펙을 쓴다
    const visits = createVisits(ctx, { H, kit, interior, doors, toast, saveSoon });
    H.visits = visits;
    // 도토리상점·박물관 실내 (places.js): 같은 문·가구 모델·스펙
    const places = await createPlaces(ctx, { H, kit, interior, doors, toast, saveSoon });
    H.places = places;

    // 저장에서 이어하기: 집 안에서 끝냈으면 다시 집 안에
    if (S.inside) {
      const p = state.player;
      const lx = p.x - x0, lz = p.z - z0;
      const ok = Number.isFinite(lx) && lx > BOUNDS.x0 && lx < BOUNDS.x1 && lz > BOUNDS.z0 && lz < BOUNDS.z1 && !blockers().some(b => inBox(b, lx, lz));
      goInside(ok ? { lx, lz, facing: p.facing ?? 0 } : { ...ENTRY, facing: 0 });
    } else if (S.visit) await visits.resume(S.visit);
    else if (S.place) await places.resume(S.place);

    ctx.services.house = {
      get inside() { return H.inside; },
      get furniture() { return S.furniture; },
      enter: () => enter(), leave: () => leave(),
      /** 개발·다른 모듈용: 가구를 바로 놓기 (가방과 상관없이). spot 을 안 주면 플레이어 앞 → 놓은 rec 또는 null */
      place: (item, spot, { variant } = {}) => placeRec(item, spot ?? findSpot(item), { variant }),
      remove: id => { const r = S.furniture.find(o => o.id === id); if (r) removeRec(r); return !!r; },
      workbench: () => workbench(),
      models: () => kit.list.map(m => ({ ...m })),
      room: { x: ROOM.x, z: ROOM.z, w: ROOM_W, d: ROOM_D, x0, z0 },
      /** 지금 있는 방: 'player' (내 집) | 주민 slug (그 주민 방) | 'shop' | 'museum' | null (밖) */
      get where() { return H.inside ? 'player' : visits.where ?? places.where; },
      /** 지금 방의 문 매트 (나가는 곳, 월드) { x, z } | null — QA 봇·편집기용 */
      doormat() {
        if (H.inside) return { x: x0 + ROOM_W / 2, z: z0 + ROOM_D - 0.45 };
        return visits.doormat() ?? places.doormat();
      },
      /** 문 드나드는 중인가 (door.js) */
      get passing() { return doors.busy; },
      /** 상점·박물관 실내 (places.js): enter(kind) · leave() · info(kind) → { keeper, talk, doormat, room } */
      places: places.api,
      /** 주민 방 (visit.js): 들어가기·나오기, 방 자리, 주민이 설 곳 */
      get visiting() { return visits.where; },
      visit: slug => visits.enter(slug),
      leaveVisit: () => visits.leave(),
      visitRoom: visits.roomInfo,
      hostSpot: slug => visits.hostSpot(slug),
      /** 벽지·바닥: 상점 코너(ui/shop.js)·편집기가 쓴다 */
      interior: {
        get index() { return interior.index; },
        get current() { return { wallpaper: S.wallpaper, floor: S.floor }; },
        get owned() { return [...S.owned]; },
        /** kind 'wallpaper'|'floor' → [{ slug, id, kind, name, price, owned, current, shopOnly }] */
        list: kind => listOf(interior.index, kind).map(m => describe(m)),
        /** 오늘 상점 코너: [벽지 하나, 바닥 하나] (위 list 모양 + swatch 그림) */
        today: () => {
          const pick = todayPick(interior.index, { seed: state.island?.seed ?? 0, dayKey: state.island?.dayKey ?? ctx.services.time?.now?.()?.dayKey });
          return ['wallpaper', 'floor'].map(k => pick[k] && describe(entryOf(interior.index, pick[k]), { swatch: true })).filter(Boolean);
        },
        owns: slug => S.owned.includes(slug),
        /** 가진 목록에 넣기 (도토리는 상점이 받는다) → 새로 넣었으면 true */
        add(slug) {
          const m = entryOf(interior.index, slug);
          if (!m || !KIND_NAME[m.kind] || S.owned.includes(slug)) return false;
          S.owned.push(slug);
          events.emit('house:owned', { slug, kind: m.kind });
          saveSoon(0.5);
          return true;
        },
        /** 플레이어 방에 바로 붙이기 (가진 것만) → true | false */
        apply: (kind, slug) => applyDecor(kind, slug),
        swatch: slug => swatch(slug),
        spec: slug => interior.specs.get(slug) ?? null,
      },
    };
    console.info(`[house] 집 준비됨 · 가구 모델 ${kit.list.length}종 · 놓인 가구 ${S.furniture.length}개${H.inside ? ' · 집 안에서 이어하기' : ''}`);

    // ────────────────────────────── 드나들기 ──────────────────────────────

    function doorPoint() { return world.places?.playerHouse?.door ?? null; }
    /** 집 문 앞인가. needFacing: 문(북쪽)을 보고 있어야 하나 */
    function nearDoor(needFacing) {
      const d = doorPoint();
      if (!d) return false;
      const p = player.position;
      if (Math.hypot(p.x - d.x, p.z - (d.z - 0.25)) > 1.0) return false;
      return !needFacing || Math.cos(player.facing) > 0.5;
    }
    function onDoormat() {
      const p = player.position;
      return Math.abs(p.x - (x0 + ROOM_W / 2)) < 0.75 && p.z - z0 > ROOM_D - 0.85;
    }

    /** 방 문 매트 (door.js 가 걸어 들고 나는 곳, 월드) */
    const roomDoor = () => ({ x: x0 + ROOM_W / 2, front: z0 + ROOM_D, entry: z0 + ENTRY.lz });

    async function enter() {
      if (H.busy || H.inside || doors.busy) return;
      H.busy = true;
      try {
        await doors.through({ dir: 'in', place: world.places?.playerHouse, kind: 'house-player', room: roomDoor(),
          arrive: s => goInside({ lx: s.x - x0, lz: s.z - z0, facing: s.facing }) });
      } finally { H.busy = false; }
    }

    async function leave() {
      if (H.busy || !H.inside || doors.busy) return;
      H.busy = true;
      try {
        await doors.through({ dir: 'out', place: world.places?.playerHouse, kind: 'house-player', room: roomDoor(), arrive: s => goOutside(s) });
      } finally { H.busy = false; }
    }

    function goInside({ lx, lz, facing }) {
      H.inside = true;
      S.inside = true;
      room.group.visible = true;
      if (!H.preloaded) { H.preloaded = true; kit.preload(kit.list.map(m => m.item)); }   // 가구 모델은 처음 들어갈 때 미리 받아 둔다
      if (!S.seeded) {
        S.seeded = true;
        for (const s of STARTER) if (fits(S.furniture, { id: '__s', ...s }, info, { reserved: RESERVED })) placeRec(s.item, s, { silent: true });
      }
      player.camera?.setBounds?.(CAMERA_BOX);
      player.camera?.setCurveScale?.(CAMERA_CURVE);
      player.teleport(x0 + lx, z0 + lz, facing);
      ctx.services.time?.setIndoor?.(true);
      ctx.services.audio?.bgm?.(radioSong());
      events.emit('house:enter', { owner: 'player' });
      saveSoon(0.5);
    }

    /** spot = 섬에 설 곳 { x, z, facing } (door.js — 문간). 없으면 문 앞 */
    function goOutside(spot) {
      if (H.moving) cancelMoving();
      H.inside = false;
      S.inside = false;
      const d = doorPoint() ?? world.places?.spawn ?? { x: 0, z: 0 };
      player.camera?.setBounds?.(null);
      player.camera?.setCurveScale?.(1);
      const s = spot ?? { x: d.x, z: d.z + 0.15, facing: Math.PI };
      player.teleport(s.x, s.z, s.facing ?? Math.PI);
      room.group.visible = false;
      ctx.services.time?.setIndoor?.(false);
      ctx.services.audio?.bgm?.('auto');
      events.emit('house:leave', { owner: 'player' });
      saveSoon(0.5);
    }

    // ────────────────────────────── 벽지·바닥 ──────────────────────────────

    const swatches = new Map();
    function swatch(slug) {
      if (!swatches.has(slug)) {
        const sp = interior.specs.get(slug);
        let url = null;
        try { url = sp?.pattern ? swatchURL(sp) : null; } catch (e) { console.warn('[house] 견본 그림 실패', slug, e); }
        swatches.set(slug, url);
      }
      return swatches.get(slug);
    }
    function describe(m, { swatch: withSwatch = false } = {}) {
      const out = { slug: m.slug, id: m.id, kind: m.kind, name: m.name, price: m.price ?? 0, shopOnly: !!m.shopOnly, owned: S.owned.includes(m.slug), current: S[m.kind] === m.slug };
      if (withSwatch) out.swatch = swatch(m.slug);
      return out;
    }

    /** 바뀐 벽지·바닥을 방에 붙인다 (저장 불러오기·reset 뒤에도 update 가 부른다) */
    function showDecor() {
      normalizeHouse(S, interior.index);
      if (room.wallpaper?.slug !== S.wallpaper) room.setWallpaper(interior.specs.get(S.wallpaper));
      if (room.floor?.slug !== S.floor) room.setFloor(interior.specs.get(S.floor));
    }
    H.showDecor = showDecor;

    function applyDecor(kind, slug) {
      const m = entryOf(interior.index, slug);
      if (!m || m.kind !== kind || !S.owned.includes(slug) || !interior.specs.get(slug)) return false;
      S[kind] = slug;
      showDecor();
      events.emit('house:decor', { kind, slug });
      saveSoon();
      return true;
    }

    /** 바라보는 벽이 가까이 있고 그 자리에 벽 가구가 없으면 → 벽 자리 */
    function decorWall() {
      const { lx, lz } = playerLocal();
      const w = wallInFront(lx, lz, player.facing, { reach: DECOR_REACH });
      if (!w || S.furniture.some(r => r.wall === w.wall && r.slot === w.slot)) return null;
      return w;
    }

    async function decorate() {
      const ui = ctx.services.ui;
      if (!ui?.dialog) { placeFromBag(); return; }
      H.busy = true;
      let pick = null;
      try { pick = await ui.dialog.open({ speaker: '꾸미기', color: '#C99B68', lines: ['방을 어떻게 꾸밀까요?'], choices: ['벽지 바꾸기', '바닥 바꾸기', '가구 놓기', '그만두기'] }); }
      finally { H.busy = false; }
      if (pick === 0) await chooseDecor('wallpaper');
      else if (pick === 1) await chooseDecor('floor');
      else if (pick === 2) await placeFromBag();
    }

    /** 가진 벽지·바닥 고르기: 한 쪽에 PAGE 개씩, 고르면 바로 붙는다 */
    async function chooseDecor(kind) {
      const ui = ctx.services.ui, what = KIND_NAME[kind];
      const mine = listOf(interior.index, kind).filter(m => S.owned.includes(m.slug));
      if (mine.length < 2) { toast(`도토리상점에서 ${josa(what, '을/를')} 사 오면 바꿀 수 있어요`, '🏪'); return; }
      let page = 0;
      for (;;) {
        const pages = Math.ceil(mine.length / PAGE);
        const shown = mine.slice(page * PAGE, page * PAGE + PAGE);
        const choices = shown.map(m => (S[kind] === m.slug ? `${m.name} (지금)` : m.name));
        if (pages > 1) choices.push('다른 것 보기 ▶');
        choices.push('그만두기');
        const now = entryOf(interior.index, S[kind])?.name ?? '';
        H.busy = true;
        let i = null;
        try { i = await ui.dialog.open({ speaker: '꾸미기', color: '#C99B68', lines: [`지금 ${josa(what, '은/는')} ${josa(now, '이에요/예요')}. 어떤 걸로 바꿀까요?`], choices }); }
        finally { H.busy = false; }
        if (i == null || i >= choices.length - 1) return;
        if (pages > 1 && i === shown.length) { page = (page + 1) % pages; continue; }
        const m = shown[i];
        if (m && m.slug !== S[kind] && applyDecor(kind, m.slug)) {
          events.emit('sfx', { name: 'menu' });
          player.play?.('happy');
          toast(`${what}: ${m.name}`, kind === 'wallpaper' ? '🖼️' : '🟫');
        }
        return;
      }
    }

    // ────────────────────────────── 가구 놓기 ──────────────────────────────

    function newId() {
      let n = S.nextId ?? 1;
      while (S.furniture.some(r => r.id === `f${n}`)) n++;
      S.nextId = n + 1;
      return `f${n}`;
    }

    function playerLocal() { const p = player.position; return { lx: p.x - x0, lz: p.z - z0 }; }

    /** 가구 하나를 플레이어 앞에 놓을 자리 (벽 가구는 바라보는 벽) → spot | null */
    function findSpot(item, ignore = null) {
      const fi = info(item);
      if (!fi) return null;
      const { lx, lz } = playerLocal();
      if (fi.place === 'wall' || fi.place === 'window') {
        const w = wallInFront(lx, lz, player.facing);
        if (!w) return null;
        const tries = fi.place === 'window'
          ? WINDOWS.map(k => k.split(':')).filter(([wl]) => wl === w.wall).map(([, s]) => Number(s)).sort((a, b) => Math.abs(a - w.slot) - Math.abs(b - w.slot)).filter(s => Math.abs(s - w.slot) <= 2)
          : [w.slot, w.slot - 1, w.slot + 1].filter(s => s >= 0 && s < (w.wall === 'n' ? ROOM_W : ROOM_D));
        const slot = tries.find(s => wallFree(S.furniture, w.wall, s, fi.place, WINDOW_SET, ignore));
        return slot == null ? null : { wall: w.wall, slot };
      }
      const others = [...S.furniture, WORKBENCH];
      return spotInFront(others, item, lx, lz, player.facing, info, { reserved: RESERVED, ignore });
    }

    function placeRec(item, spot, { silent = false, variant = null } = {}) {
      if (!spot || !info(item)) return null;
      const rec = spot.wall ? { id: newId(), item, wall: spot.wall, slot: spot.slot } : { id: newId(), item, gx: spot.gx, gz: spot.gz, rot: spot.rot ?? 0 };
      if (variant) rec.variant = variant;
      S.furniture.push(rec);
      spawn(rec);
      if (!silent) { events.emit('sfx', { name: 'step-wood', volume: 1 }); saveSoon(); }
      return rec;
    }

    function removeRec(rec) {
      const i = S.furniture.indexOf(rec);
      if (i >= 0) S.furniture.splice(i, 1);
      const v = H.views.get(rec.id);
      v?.obj?.dispose();
      H.views.delete(rec.id);
      saveSoon();
    }

    async function spawn(rec) {
      const v = { rec, obj: null };
      H.views.set(rec.id, v);
      try {
        const obj = await kit.make(rec.item, { variant: rec.variant });
        if (H.views.get(rec.id) !== v) { obj.dispose(); return; }   // 만드는 사이에 치웠다
        v.obj = obj;
        if (rec.holds) obj.setHolds(rec.holds);
        room.group.add(obj.root);
        pose(rec);
      } catch (e) { console.error('[house] 가구를 못 만들었어요', rec.item, e); }
    }

    /** rec 의 자리로 모델을 옮긴다 (lift: 옮기는 중 살짝 띄우기) */
    function pose(rec, lift = 0) {
      const obj = H.views.get(rec.id)?.obj;
      if (!obj) return;
      if (rec.wall) {
        const m = wallMount(rec.wall, rec.slot);
        obj.root.position.set(m.x, lift, m.z);
        obj.root.rotation.y = m.rotY;
      } else {
        const b = boxOf(rec, info(rec.item).footprint);
        obj.root.position.set(x0 + b.cx, lift, z0 + b.cz);
        obj.root.rotation.y = rec.rot * Math.PI / 2;
      }
    }

    async function placeFromBag() {
      const data = ctx.services.data, ui = ctx.services.ui;
      if (!data || !ui?.bag) return;
      const isFurn = s => !!s && String(s.id).startsWith('furn.') && !!kit.info(s.id);
      if (!data.inventory.slots.some(isFurn)) { toast('가방에 놓을 가구가 없어요', '🪑'); return; }
      H.busy = true;
      try {
        const slot = await ui.bag.open({ mode: 'pick', title: '가구 놓기', hint: '방에 놓을 가구를 골라 주세요', filter: s => isFurn(s) });
        if (slot == null) return;
        const picked = data.inventory.slots[slot];
        if (!isFurn(picked)) return;
        const item = picked.id, variant = picked.variant ?? null;
        const fi = info(item), name = data.items.get(item)?.name ?? item;
        const spot = findSpot(item);
        if (!spot) {
          toast(fi.place === 'window' ? '창문 앞에서 걸 수 있어요' : fi.place === 'wall' ? '벽을 바라보고 서면 걸 수 있어요' : '앞에 놓을 자리가 없어요', data.items.get(item)?.icon);
          return;
        }
        if (data.inventory.remove(slot, 1) !== 1) return;
        placeRec(item, spot, { variant });
        player.play?.('place');   // 9차 AN-10 놓기 동작
        toast(`${josa(name, '을/를')} 놓았어요`, data.items.get(item)?.icon);
      } finally { H.busy = false; }
    }

    // ────────────────────────────── 가구 건드리기 ──────────────────────────────

    /** 플레이어 앞의 가구 · 작업대 → { kind: 'furniture', rec } | { kind: 'workbench' } | null */
    function targetInFront() {
      const { lx, lz } = playerLocal();
      const f = player.facing;
      const px = lx - Math.sin(f) * REACH, pz = lz - Math.cos(f) * REACH;
      let best = null, bestD = Infinity;
      const consider = (t, b) => {
        if (!inBox(b, px, pz, 0.22)) return;
        const d = Math.hypot(b.cx - lx, b.cz - lz);
        if (d < bestD) { best = t; bestD = d; }
      };
      consider({ kind: 'workbench' }, boxOf(WORKBENCH, WORKBENCH_INFO.footprint));
      for (const rec of S.furniture) {
        if (rec.wall || info(rec.item)?.layer === 'rug') continue;
        consider({ kind: 'furniture', rec }, boxOf(rec, info(rec.item).footprint));
      }
      if (best) return best;
      const w = wallInFront(lx, lz, f, { reach: 1.25 });
      const onWall = w && S.furniture.find(r => r.wall === w.wall && r.slot === w.slot);
      if (onWall) return { kind: 'furniture', rec: onWall };
      // 러그는 밖에서 바라볼 때만 (러그 위에 서 있으면 행동 키 = 가구 놓기)
      const rug = S.furniture.find(r => {
        if (r.wall || info(r.item)?.layer !== 'rug') return false;
        const b = boxOf(r, info(r.item).footprint);
        return inBox(b, px, pz) && !inBox(b, lx, lz);
      });
      return rug ? { kind: 'furniture', rec: rug } : null;
    }

    /** 10차 앉기: 앞의 가구가 앉을 수 있는 것이면 가장 가까운 빈 자리 (seats.js) → seat | null */
    function seatInFront() {
      const pl = ctx.services.player;
      if (!pl?.hasClip?.('sit') || pl.seated || !ctx.services.seats) return null;
      const t = targetInFront();
      const spec = t?.kind === 'furniture' ? seatSpec(t.rec.item) : null;
      if (!spec) return null;
      const b = boxOf(t.rec, info(t.rec.item).footprint);
      const cx = x0 + b.cx, cz = z0 + b.cz;
      const list = seatsOf(spec, { x: cx, z: cz, y: world.island.heightAt(cx, cz), rot: (t.rec.rot ?? 0) * Math.PI / 2 }, `house:${t.rec.id}`);
      return nearestSeat(list, pl.position.x, pl.position.z, { reach: 1.6, facing: pl.facing, taken: k => !!ctx.services.seats.holder(k) });
    }

    async function menu(rec) {
      const data = ctx.services.data, ui = ctx.services.ui;
      if (!ui?.dialog) return;
      const it = data?.items.get(rec.item), name = it?.name ?? rec.item;
      const spec = H.views.get(rec.id)?.obj?.spec;
      const variants = Object.keys(spec?.variants ?? {});
      const opts = [];
      if (!rec.wall && info(rec.item).layer !== 'rug') opts.push(['rotate', '돌리기']);
      opts.push(['move', '옮기기']);
      if (variants.length > 1) opts.push(['color', '색 바꾸기']);
      if (it?.plays === 'bgm') {
        if (S.radio) opts.push(['radio-next', '다른 곡 틀기'], ['radio-off', '라디오 끄기']);
        else opts.push(['radio-on', '라디오 켜기']);
      }
      if (it?.holds) opts.push(rec.holds ? ['take', `${nameOf(rec.holds)} 꺼내기`] : ['put', it.holds === 'fish' ? '물고기 넣기' : '곤충 넣기']);
      opts.push(['store', '가방에 넣기'], ['cancel', '그만두기']);
      let line = `${josa(name, '을/를')} 어떻게 할까요?`;
      if (rec.holds) line = `${josa(nameOf(rec.holds), '이/가')} ${it.holds === 'fish' ? '헤엄치고' : '쉬고'} 있어요. 어떻게 할까요?`;
      else if (it?.plays === 'bgm' && S.radio) line = `라디오에서 ${RADIO[S.radio]} 곡이 나오고 있어요.`;
      H.busy = true;
      let pick = null;
      try { pick = await ui.dialog.open({ speaker: name, color: '#C99B68', lines: [line], choices: opts.map(o => o[1]) }); }
      finally { H.busy = false; }
      const what = pick == null ? 'cancel' : opts[pick][0];
      if (what === 'rotate') {
        const next = rotateInPlace([...S.furniture, WORKBENCH], rec, info, { reserved: RESERVED, blockCells: new Set([playerCell()]) });
        if (!next) { toast('돌릴 자리가 없어요', it?.icon); return; }
        Object.assign(rec, next);
        pose(rec);
        events.emit('sfx', { name: 'menu' });
        saveSoon();
      } else if (what === 'move') startMoving(rec);
      else if (what === 'color') {
        const i = variants.indexOf(rec.variant ?? variants[0]);
        rec.variant = variants[(i + 1) % variants.length];
        H.views.get(rec.id)?.obj?.setVariant(rec.variant);
        toast(`${spec.variants[rec.variant].label.replace(/ \(기본\)$/, '')}`, it?.icon);
        events.emit('sfx', { name: 'menu' });
        saveSoon();
      } else if (what === 'radio-on' || what === 'radio-next') {
        S.radio = what === 'radio-on' ? radioForNow() : RADIO_ORDER[(RADIO_ORDER.indexOf(S.radio) + 1) % RADIO_ORDER.length];
        ctx.services.audio?.bgm?.(radioSong());
        toast(`라디오: ${RADIO[S.radio]}`, '📻');
        saveSoon();
      } else if (what === 'radio-off') {
        S.radio = null;
        ctx.services.audio?.bgm?.('indoor');
        toast('라디오를 껐어요', '📻');
        saveSoon();
      } else if (what === 'put') await putIn(rec, it);
      else if (what === 'take') takeOut(rec);
      else if (what === 'store') store(rec);
    }

    function nameOf(id) { return ctx.services.data?.items.get(id)?.name ?? id; }
    function radioSong() { return S.radio ? (RADIO[S.radio] ? S.radio : 'morning') : 'indoor'; }
    function radioForNow() {
      const h = ctx.services.time?.now?.().hour ?? new Date().getHours();
      return h < 5 ? 'night' : h < 8 ? 'dawn' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 19 ? 'evening' : 'night';
    }

    // 어항·곤충 상자: 가방의 물고기·곤충 하나를 넣어 두고 꺼낸다 (넣은 것에 따라 안의 물고기·풍뎅이 색이 바뀐다)
    async function putIn(rec, it) {
      const data = ctx.services.data, ui = ctx.services.ui;
      const cat = it.holds;
      const ok = s => !!s && data.items.get(s.id)?.category === cat;
      if (!data.inventory.slots.some(ok)) { toast(cat === 'fish' ? '가방에 물고기가 없어요' : '가방에 곤충이 없어요', it.icon); return; }
      H.busy = true;
      try {
        const slot = await ui.bag.open({ mode: 'pick', title: cat === 'fish' ? '어항에 넣기' : '곤충 상자에 넣기', hint: cat === 'fish' ? '넣을 물고기를 골라 주세요' : '넣을 곤충을 골라 주세요', filter: s => ok(s) });
        const picked = slot == null ? null : data.inventory.slots[slot];
        if (!ok(picked) || data.inventory.remove(slot, 1) !== 1) return;
        rec.holds = picked.id;
        H.views.get(rec.id)?.obj?.setHolds(rec.holds);
        events.emit('sfx', { name: cat === 'fish' ? 'splash' : 'bug-catch', volume: 0.6 });
        toast(`${josa(nameOf(picked.id), '을/를')} ${it.name}에 넣었어요`, data.items.get(picked.id)?.icon);
        saveSoon();
      } finally { H.busy = false; }
    }
    function takeOut(rec) {
      const data = ctx.services.data;
      const id = rec.holds;
      if (!id || !data.collect(id, 1).added) { toast('가방이 가득 찼어요', '🎒'); return false; }
      rec.holds = null;
      H.views.get(rec.id)?.obj?.setHolds(null);
      toast(`${josa(nameOf(id), '을/를')} 꺼냈어요`, data.items.get(id)?.icon);
      saveSoon();
      return true;
    }

    function playerCell() { const { lx, lz } = playerLocal(); return `${Math.floor(lx)},${Math.floor(lz)}`; }

    function store(rec) {
      const data = ctx.services.data;
      const it = data?.items.get(rec.item), name = it?.name ?? rec.item;
      if (!data) return;
      if (data.inventory.freeSlots() < (rec.holds ? 2 : 1)) { toast('가방이 가득 찼어요', '🎒'); return; }
      if (rec.holds && !takeOut(rec)) return;
      const opts = rec.variant ? { variant: rec.variant } : {};
      const got = data.collect ? data.collect(rec.item, 1, opts) : { added: data.inventory.add(rec.item, 1, opts) };
      if (!got.added) { toast('가방이 가득 찼어요', '🎒'); return; }
      if (it?.plays === 'bgm' && S.radio && !S.furniture.some(r => r !== rec && data.items.get(r.item)?.plays === 'bgm')) {
        S.radio = false;
        ctx.services.audio?.bgm?.('indoor');
      }
      removeRec(rec);
      events.emit('sfx', { name: 'pickup' });
      toast(`${josa(name, '을/를')} 가방에 넣었어요`, it?.icon);
    }

    // 옮기기: 가구가 플레이어 앞을 따라다니다가 행동 키로 내려놓는다 (F 는 그만두기)
    function startMoving(rec) {
      H.moving = { rec, orig: { ...rec }, t: 0 };
      toast(ctx.input?.touch ? '자리를 고르고 A 로 내려놓아요 (B: 그만두기)' : '자리를 고르고 Space 로 내려놓아요 (F: 그만두기)', '✋');
      events.emit('sfx', { name: 'pickup', volume: 0.6 });
    }
    function dropMoving() {
      const m = H.moving;
      if (!m) return;
      H.moving = null;
      pose(m.rec);
      player.play?.('place');
      events.emit('sfx', { name: 'step-wood', volume: 1 });
      saveSoon();
    }
    function cancelMoving() {
      const m = H.moving;
      if (!m) return;
      H.moving = null;
      Object.assign(m.rec, m.orig);
      pose(m.rec);
    }
    H.updateMoving = dt => {
      const m = H.moving;
      m.t += dt;
      const spot = findSpot(m.rec.item, m.rec.id);
      if (spot) {
        if (spot.wall) { m.rec.wall = spot.wall; m.rec.slot = spot.slot; }
        else Object.assign(m.rec, { gx: spot.gx, gz: spot.gz, rot: spot.rot });
      }
      pose(m.rec, 0.1 + Math.sin(m.t * 6) * 0.03);
    };

    async function workbench() {
      H.busy = true;
      try {
        const onCraft = id => { player.play?.('happy'); events.emit('house:craft', { id, result: ctx.services.data?.recipes?.get?.(id)?.result ?? id }); };
        if (ctx.services.ui?.craft) await ctx.services.ui.craft.open({ title: '작업대', onCraft });
        else await openWorkbench(ctx);
      } finally { H.busy = false; }
    }

    // ────────────────────────────── 기타 ──────────────────────────────

    function toast(text, icon) {
      if (ctx.services.ui?.toast) ctx.services.ui.toast(text, icon);
      else events.emit('toast', { text, icon });
    }
    function saveSoon(sec = 1.5) { H.saveT = H.saveT > 0 ? Math.min(H.saveT, sec) : sec; }
  },

  update(dt, ctx) {
    if (!H) return;
    if (H.S.furniture !== H.list) H.resync();
    if (H.room.wallpaper?.slug !== H.S.wallpaper || H.room.floor?.slug !== H.S.floor || !Array.isArray(H.S.owned)) H.showDecor();
    H.doors.update(dt);
    H.visits.update(dt);
    H.places.update(dt);
    const player = ctx.services.player, input = ctx.input;
    const blocked = ctx.services.ui?.isBlocking?.() || input.enabled === false;

    // 문 쪽으로 밀어서 드나들기
    if (!H.busy && !blocked && !H.moving && !H.doors.busy) {
      if (!H.inside) {
        const d = ctx.services.world.places?.playerHouse?.door;
        const p = player.position;
        const atDoor = d && Math.abs(p.x - d.x) < 0.45 && p.z < d.z - 0.2 && p.z > d.z - 1.0;
        H.pushT = atDoor && input.move.z < -0.5 ? H.pushT + dt : 0;
        if (H.pushT > PUSH_TIME) { H.pushT = 0; ctx.services.house.enter(); }
      } else {
        const p = player.position;
        const atMat = Math.abs(p.x - (x0 + ROOM_W / 2)) < 0.75 && p.z - z0 > ROOM_D - 0.5;
        H.pushOutT = atMat && input.move.z > 0.5 ? H.pushOutT + dt : 0;
        if (H.pushOutT > PUSH_TIME) { H.pushOutT = 0; ctx.services.house.leave(); }
      }
    }

    if (H.inside) {
      if (H.moving) H.updateMoving(dt);
      const now = ctx.services.time?.now?.();
      for (const v of H.views.values()) v.obj?.tick(dt, now);
      H.room.setNight(ctx.services.time?.nightFactor ?? 0);
      // 카메라: player.camera.setBounds 가 없는 예전 player 면 여기서 방 가운데 둘레로 당긴다
      if (!player.camera?.setBounds) {
        const f = ctx.focus, cam = ctx.camera;
        const cx = clamp(f.x, CAMERA_BOX.x0, CAMERA_BOX.x1), cz = clamp(f.z, CAMERA_BOX.z0, CAMERA_BOX.z1);
        cam.position.x += cx - f.x;
        cam.position.z += cz - f.z;
        f.x = cx; f.z = cz;
        ctx.materials.curve.uCurve.value *= CAMERA_CURVE;
      }
    }

    if (H.saveT > 0 && (H.saveT -= dt) <= 0) {
      H.saveT = 0;
      try { ctx.services.data?.save?.save?.(); } catch (e) { console.warn('[house] 저장 실패', e); }
    }
  },
};
