// 트랙 W3 (P4): 집 실내 · 가구 배치 · 작업대 제작. src/gameplay/index.js 가 불러온다.
//  - 플레이어 집 문(world.places.playerHouse) 앞에서 행동 키(우선순위 90) 또는 문 쪽으로 밀기 → 잠깐 어두워졌다가 방 안으로.
//  - 방은 x = 500 에 지은 8×8 칸 (room.js), world.addZone 으로 바닥·벽 충돌을 바꿔 끼운다.
//  - 가구: 가방에서 골라 앞 칸에 놓기, 가구 앞 행동 키(80) → 돌리기·옮기기·색 바꾸기·가방에 넣기, F → 바로 가방에. state.house.furniture 에 저장.
//  - 작업대(방 서쪽 벽): 레시피 목록 → 만들기 (craft.js).
// 상태 칸 state.house = { furniture: [rec], inside, seeded, radio } — rec 모양은 grid.js 맨 위.
import { ROOM_W, ROOM_D, boxOf, fits, spotInFront, rotateInPlace, wallInFront, wallFree, moveCircle, inBox } from './grid.js';
import { ROOM, buildRoom, wallMount, x0, z0, WINDOWS, DOOR } from './room.js';
import { createFurnitureKit } from './furniture.js';
import { openWorkbench, josa } from './craft.js';

const WORKBENCH = { id: 'workbench', item: 'workbench', gx: 0, gz: 2, rot: 1 };   // 서쪽 벽에 붙여 동쪽을 본다
const WORKBENCH_INFO = { footprint: [2, 1], place: 'floor' };
const STARTER = [   // 처음 들어간 날 놓여 있는 가구
  { item: 'furn.round-rug', gx: 2, gz: 3, rot: 0 },
  { item: 'furn.floor-lamp', gx: 7, gz: 0, rot: 0 },
  { item: 'furn.plant-pot', gx: 0, gz: 0, rot: 0 },
];
const ENTRY = { lx: ROOM_W / 2, lz: ROOM_D - 0.7 };   // 들어오면 문 매트 위, 북쪽을 본다
const BOUNDS = { x0: 0.09, z0: 0.09, x1: ROOM_W - 0.09, z1: ROOM_D };   // 걸을 수 있는 네모 (벽 징두리만큼 안쪽)
const RESERVED = new Set([`${DOOR.gx0},${ROOM_D - 1}`, `${DOOR.gx1},${ROOM_D - 1}`]);   // 문 매트 칸은 비워 둔다
const WINDOW_SET = new Set(WINDOWS);
const FADE_OUT = 0.28, FADE_IN = 0.42;                // 초
const PUSH_TIME = 0.2;                                // 문 쪽으로 이만큼 밀면 드나든다
const REACH = 0.62;                                   // 플레이어 앞 몇 칸까지 가구를 건드리나
const RADIO_SONG = 'morning';
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

    const S = (state.house ||= { furniture: [] });
    if (!Array.isArray(S.furniture)) S.furniture = [];
    S.furniture = S.furniture.filter(r => r && typeof r.item === 'string' && kit.info(r.item));   // 모르는 가구는 버린다
    if (S.furniture.length) S.seeded = true;

    const room = buildRoom(ctx);
    room.group.visible = false;
    scene.add(room.group);

    H = {
      ctx, kit, room, S, inside: false, busy: false, moving: null,
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
      groundAt: () => 'wood',
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

    // 어두워졌다 밝아지는 막 (ui 창보다 아래)
    const fade = document.createElement('div');
    fade.className = 'house-fade';
    fade.style.cssText = 'position:fixed;inset:0;background:#2E2420;opacity:0;pointer-events:none;transition:opacity .3s ease;';
    ctx.uiRoot.prepend(fade);
    H.fadeEl = fade;

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
    I.add({ name: 'house-move-drop', intent: 'action', priority: 120, test: () => H.moving, run: () => dropMoving() });
    I.add({ name: 'house-move-cancel', intent: 'pickup', priority: 120, test: () => H.moving, run: () => cancelMoving() });
    I.add({ name: 'house-door-in', intent: 'action', priority: 90, test: () => (!H.inside && !H.busy && nearDoor(true) ? true : null), run: () => enter() });
    I.add({ name: 'house-door-out', intent: 'action', priority: 90, test: () => (H.inside && !H.busy && onDoormat() ? true : null), run: () => leave() });
    I.add({ name: 'house-furniture', intent: 'action', priority: 80, test: () => (H.inside && !H.busy ? targetInFront() : null),
      run: t => (t.kind === 'workbench' ? workbench() : menu(t.rec)) });
    I.add({ name: 'house-furniture-store', intent: 'pickup', priority: 80, test: () => { const t = H.inside && !H.busy ? targetInFront() : null; return t?.kind === 'furniture' ? t : null; },
      run: t => store(t.rec) });
    I.add({ name: 'house-place', intent: 'action', priority: 20, test: () => (H.inside && !H.busy ? true : null), run: () => placeFromBag() });

    // 저장에서 이어하기: 집 안에서 끝냈으면 다시 집 안에
    if (S.inside) {
      const p = state.player;
      const lx = p.x - x0, lz = p.z - z0;
      const ok = Number.isFinite(lx) && lx > BOUNDS.x0 && lx < BOUNDS.x1 && lz > BOUNDS.z0 && lz < BOUNDS.z1 && !blockers().some(b => inBox(b, lx, lz));
      goInside(ok ? { lx, lz, facing: p.facing ?? 0 } : { ...ENTRY, facing: 0 });
    }

    ctx.services.house = {
      get inside() { return H.inside; },
      get furniture() { return S.furniture; },
      enter: () => enter(), leave: () => leave(),
      /** 개발·다른 모듈용: 가구를 바로 놓기 (가방과 상관없이). spot 을 안 주면 플레이어 앞 → 놓은 rec 또는 null */
      place: (item, spot) => placeRec(item, spot ?? findSpot(item)),
      remove: id => { const r = S.furniture.find(o => o.id === id); if (r) removeRec(r); return !!r; },
      workbench: () => workbench(),
      models: () => kit.list.map(m => ({ ...m })),
      room: { x: ROOM.x, z: ROOM.z, w: ROOM_W, d: ROOM_D, x0, z0 },
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

    function fadeTo(v, sec) {
      return new Promise(res => {
        fade.style.transitionDuration = `${sec}s`;
        fade.style.opacity = String(v);
        setTimeout(res, sec * 1000 + 30);
      });
    }

    async function enter() {
      if (H.busy || H.inside) return;
      H.busy = true;
      player.freeze(true);
      events.emit('sfx', { name: 'door' });
      try {
        await fadeTo(1, FADE_OUT);
        goInside({ ...ENTRY, facing: 0 });
        await fadeTo(0, FADE_IN);
      } finally { player.freeze(false); H.busy = false; }
    }

    async function leave() {
      if (H.busy || !H.inside) return;
      H.busy = true;
      player.freeze(true);
      events.emit('sfx', { name: 'door' });
      try {
        await fadeTo(1, FADE_OUT);
        goOutside();
        await fadeTo(0, FADE_IN);
      } finally { player.freeze(false); H.busy = false; }
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
      player.teleport(x0 + lx, z0 + lz, facing);
      ctx.services.time?.setIndoor?.(true);
      ctx.services.audio?.bgm?.(S.radio ? RADIO_SONG : 'indoor');
      events.emit('house:enter', {});
      saveSoon(0.5);
    }

    function goOutside() {
      if (H.moving) cancelMoving();
      H.inside = false;
      S.inside = false;
      const d = doorPoint() ?? world.places?.spawn ?? { x: 0, z: 0 };
      player.teleport(d.x, d.z + 0.15, Math.PI);
      room.group.visible = false;
      ctx.services.time?.setIndoor?.(false);
      ctx.services.audio?.bgm?.('auto');
      events.emit('house:leave', {});
      saveSoon(0.5);
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

    function placeRec(item, spot, { silent = false } = {}) {
      if (!spot || !info(item)) return null;
      const rec = spot.wall ? { id: newId(), item, wall: spot.wall, slot: spot.slot } : { id: newId(), item, gx: spot.gx, gz: spot.gz, rot: spot.rot ?? 0 };
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
        const item = data.inventory.slots[slot]?.id;
        if (!isFurn(data.inventory.slots[slot])) return;
        const fi = info(item), name = data.items.get(item)?.name ?? item;
        const spot = findSpot(item);
        if (!spot) {
          toast(fi.place === 'window' ? '창문 앞에서 걸 수 있어요' : fi.place === 'wall' ? '벽을 바라보고 서면 걸 수 있어요' : '앞에 놓을 자리가 없어요', data.items.get(item)?.icon);
          return;
        }
        if (data.inventory.remove(slot, 1) !== 1) return;
        placeRec(item, spot);
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
      if (it?.plays === 'bgm') opts.push(['radio', S.radio ? '라디오 끄기' : '라디오 켜기']);
      opts.push(['store', '가방에 넣기'], ['cancel', '그만두기']);
      H.busy = true;
      let pick = null;
      try { pick = await ui.dialog.open({ speaker: name, color: '#C99B68', lines: [`${josa(name, '을/를')} 어떻게 할까요?`], choices: opts.map(o => o[1]) }); }
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
      } else if (what === 'radio') {
        S.radio = !S.radio;
        ctx.services.audio?.bgm?.(S.radio ? RADIO_SONG : 'indoor');
        toast(S.radio ? '라디오를 켰어요' : '라디오를 껐어요', '📻');
        saveSoon();
      } else if (what === 'store') store(rec);
    }

    function playerCell() { const { lx, lz } = playerLocal(); return `${Math.floor(lx)},${Math.floor(lz)}`; }

    function store(rec) {
      const data = ctx.services.data;
      const it = data?.items.get(rec.item), name = it?.name ?? rec.item;
      const got = data?.collect ? data.collect(rec.item, 1) : { added: data?.inventory?.add?.(rec.item, 1) ?? 0 };
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
      try { await openWorkbench(ctx); } finally { H.busy = false; }
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
    const player = ctx.services.player, input = ctx.input;
    const blocked = ctx.services.ui?.isBlocking?.() || input.enabled === false;

    // 문 쪽으로 밀어서 드나들기
    if (!H.busy && !blocked && !H.moving) {
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
      // 카메라: 방 가운데 둘레에서만 따라다니게 (벽 너머 어둠이 덜 보이게), 곡면 월드도 약하게
      const f = ctx.focus, cam = ctx.camera;
      const cx = clamp(f.x, ROOM.x - 1.2, ROOM.x + 1.2), cz = clamp(f.z, ROOM.z - 0.6, ROOM.z + 1.4);
      cam.position.x += cx - f.x;
      cam.position.z += cz - f.z;
      f.x = cx; f.z = cz;
      ctx.materials.curve.uCurve.value *= 0.3;
    }

    if (H.saveT > 0 && (H.saveT -= dt) <= 0) {
      H.saveT = 0;
      try { ctx.services.data?.save?.save?.(); } catch (e) { console.warn('[house] 저장 실패', e); }
    }
  },
};
