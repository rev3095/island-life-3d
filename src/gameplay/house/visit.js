// 주민 집 들어가기 · 주민 방 (5차 Z2, 검수 보드 D9-A 주민마다 테마 방).
//  - 주민 집 문(world.places.villagerHouses[].door) 앞에서 행동 키(우선순위 91) 또는 문 쪽으로 밀기 → 그 주민 방으로. 문 매트에서 나온다.
//    드나드는 동작(문 열기·걷기·원형 전환)은 door.js — 내 집·상점·박물관과 같다.
//    문 규칙은 town 이 정한다 (Z4 약속, notes/z2-interior.md): town.atHome(slug) 'home' → 들어간다, 'out' → 잠김 알림,
//    'sleep'·'room' → 이 처리기는 비켜서 town:knock(90) 이 노크한다. town.residents() 에 없는 주민(이사 오기 전) 집 문은 없다.
//    atHome 이 없는 town 이면 언제나 열린다.
//  - 방은 x = 540 에 하나 지어 두고 들어갈 때마다 그 주민 방 스펙(assets/interior/rooms/rm-0N.json)대로 벽지·바닥·가구를 바꿔 끼운다.
//  - 가구: 아이템 id(item) 또는 FU 번호(fu). 가구 목록(assets/furniture/index.json)에 없으면 스펙의 box 크기·색으로 임시 상자 → 목록에 들어오면 저절로 모델.
//  - 주민 방 가구는 건드릴 수 없다 (충돌만). 주민을 방 안에 세우는 일은 town 이 house:enter { owner, host } 를 받아서 한다.
// 상태: state.house.visit = 주민 방 안에서 저장했으면 그 주민 slug (이어하기).
import { ROOM_W, ROOM_D, boxOf, moveCircle, inBox } from './grid.js';
import { VISIT_ROOM, buildRoom, wallMount, cornerOf, ENTRY, BOUNDS, cameraBox, CAMERA_CURVE } from './room.js';
import { resolveFurniture, visitRule, FACE, DEFAULT } from './interior.js';
import { josa } from './craft.js';

const PUSH_TIME = 0.2;
const WALL_Y = 1.15;   // 임시 벽 가구 아래 끝 높이

export function createVisits(ctx, { H, kit, interior, doors, toast, saveSoon }) {
  const { THREE, scene, events, state, materials } = ctx;
  const world = ctx.services.world, player = ctx.services.player;
  const S = state.house;
  const corner = cornerOf(VISIT_ROOM), { x0: vx0, z0: vz0 } = corner;
  const V = { where: null, spec: null, list: [], objs: [], pushT: 0, pushOutT: 0, busy: false };
  let room = null;   // 처음 들어갈 때 짓는다

  const houses = () => world.places?.villagerHouses ?? [];
  const houseOf = slug => houses().find(h => h.slug === slug) ?? null;
  const fallbackRoom = slug => ({ slug: null, owner: slug, name: '', wallpaper: DEFAULT.wallpaper, floor: DEFAULT.floor, host: { lx: ROOM_W / 2, lz: 3.6, face: 's' }, furniture: [] });
  async function roomSpecOf(slug) {
    const entry = (interior.index.rooms ?? []).find(r => r.owner === slug);
    if (!entry) return fallbackRoom(slug);
    try { return await interior.room(entry.slug); }
    catch (e) { console.warn('[house] 주민 방을 못 읽었어요', entry.slug, e); return fallbackRoom(slug); }
  }

  // ── 구역: 주민 방 바닥·벽·가구 충돌 ──
  const local = (x, z) => ({ lx: x - vx0, lz: z - vz0 });
  const blockers = () => V.list.filter(r => !r.rec.wall && r.layer !== 'rug').map(r => {
    const b = boxOf(r.rec, r.footprint);
    return { x0: b.x0 + 0.04, z0: b.z0 + 0.04, x1: b.x1 - 0.04, z1: b.z1 - 0.04 };
  });
  const onRug = (lx, lz) => V.list.some(r => r.layer === 'rug' && inBox(boxOf(r.rec, r.footprint), lx, lz, -0.1));
  world.addZone({
    contains: (x, z) => Math.abs(x - VISIT_ROOM.x) < ROOM_W && Math.abs(z - VISIT_ROOM.z) < ROOM_D,
    collide(fx, fz, nx, nz, r) {
      const p = moveCircle(blockers(), BOUNDS, fx - vx0, fz - vz0, nx - vx0, nz - vz0, r ?? 0.26);
      return { x: p.x + vx0, z: p.z + vz0 };
    },
    heightAt: (x, z) => { const { lx, lz } = local(x, z); return onRug(lx, lz) ? 0.03 : 0; },
    groundAt: () => room?.floor?.step ?? 'wood',
    isWalkable(x, z) {
      const { lx, lz } = local(x, z);
      if (lx < BOUNDS.x0 || lz < BOUNDS.z0 || lx > BOUNDS.x1 || lz > BOUNDS.z1) return false;
      return !blockers().some(b => inBox(b, lx, lz));
    },
  });

  // ── 행동 키 ──
  const I = ctx.services.gameplay.interactions;
  const free = () => !H.busy && !V.busy && !H.inside && !doors.busy;
  I.add({ name: 'house-visit-in', intent: 'action', priority: 91, label: t => (t.rule === 'locked' ? '노크' : '들어가기'),
    test: () => { const h = free() && !V.where ? doorInFront(true) : null; const rule = h && doorRule(h.slug); return rule ? { ...h, rule } : null; },
    run: t => (t.rule === 'locked' ? locked(t.slug) : enter(t.slug)) });
  I.add({ name: 'house-visit-out', intent: 'action', priority: 90, label: '나가기', test: () => (free() && V.where && onDoormat() ? true : null), run: () => leave() });
  // 주민 방 안에선 도구를 쓰지 않는다 (집 안 빈 바닥과 같은 자리 20)
  I.add({ name: 'house-visit-idle', intent: 'action', priority: 20, label: '', test: () => (V.where ? true : null), run: () => {} });

  /** 주민 집 문 앞인가 → 그 집 { slug, door } | null. needFacing: 문(북쪽)을 보고 있어야 하나 */
  function doorInFront(needFacing) {
    const p = player.position;
    for (const h of houses()) {
      const d = h.door;
      if (!d || !h.slug) continue;
      if (Math.hypot(p.x - d.x, p.z - (d.z - 0.25)) > 1.0) continue;
      if (!needFacing || Math.cos(player.facing) > 0.5) return h;
    }
    return null;
  }
  const doorRule = slug => visitRule(ctx.services.town, slug);
  const nameOf = slug => ctx.services.town?.villagers?.find?.(v => v.slug === slug)?.person?.name ?? slug;
  function locked(slug) {
    events.emit('sfx', { name: 'door', volume: 0.4 });
    toast(`${josa(nameOf(slug), '은/는')} 외출 중인가 봐요. 문이 잠겨 있어요`, '🔒');
  }
  function onDoormat() {
    const p = player.position;
    return Math.abs(p.x - (vx0 + ROOM_W / 2)) < 0.75 && p.z - vz0 > ROOM_D - 0.85;
  }

  // ── 꾸미기: 벽지·바닥·가구 ──
  function clearFurniture() {
    for (const o of V.objs) o.dispose();
    V.objs = [];
    V.list = [];
  }
  async function furnish(spec) {
    clearFurniture();
    if (!room) {
      room = buildRoom(ctx, { origin: VISIT_ROOM, wallpaper: interior.specs.get(spec.wallpaper), floor: interior.specs.get(spec.floor), frame: interior.frame });
      room.group.visible = false;
      scene.add(room.group);
    } else {
      if (room.wallpaper?.slug !== spec.wallpaper) room.setWallpaper(interior.specs.get(spec.wallpaper) ?? interior.specs.get(DEFAULT.wallpaper));
      if (room.floor?.slug !== spec.floor) room.setFloor(interior.specs.get(spec.floor) ?? interior.specs.get(DEFAULT.floor));
    }
    V.spec = spec;
    V.list = (spec.furniture ?? []).map((e, i) => resolveFurniture(e, { models: kit.list }, i));
    const made = await Promise.all(V.list.map(async r => {
      try { return r.real ? await realPiece(r) : placeholder(r); }
      catch (e) { console.warn('[house] 주민 방 가구를 못 만들었어요 → 임시 상자', r.key, e); return placeholder(r); }
    }));
    V.objs = made.filter(Boolean);
    for (const o of V.objs) room.group.add(o.root);
  }
  function poseRoot(root, r) {
    if (r.rec.wall) {
      const m = wallMount(r.rec.wall, r.rec.slot, corner);
      root.position.set(m.x, 0, m.z);
      root.rotation.y = m.rotY;
    } else {
      const b = boxOf(r.rec, r.footprint);
      root.position.set(vx0 + b.cx, 0, vz0 + b.cz);
      root.rotation.y = r.rec.rot * Math.PI / 2;
    }
  }
  async function realPiece(r) {
    const obj = await kit.make(r.item, { variant: r.entry.variant ?? null });
    poseRoot(obj.root, r);
    return obj;
  }
  /** 아직 모델이 없는 새 가구: 스펙 box [가로, 깊이, 높이] 크기의 둥근 색 상자 (정면 +Z, 원점 = 바닥 가운데 / 벽면) */
  function placeholder(r) {
    const [bw, bd, bh] = Array.isArray(r.entry.box) ? r.entry.box : [r.footprint[0], r.footprint[1], 0.8];
    const root = new THREE.Group();
    root.name = `placeholder:${r.fu ?? r.key}`;
    root.userData.placeholder = r.fu ?? r.key;
    const mat = materials.toonMaterial(r.entry.color ?? '#C9B79C', { name: 'placeholder' });
    const w = r.rec.wall ? bw : bw * 0.84, d = r.rec.wall ? bd : bd * 0.84;
    const geo = new THREE.BoxGeometry(w, bh, d);
    geo.translate(0, (r.rec.wall ? WALL_Y : 0) + bh / 2, r.rec.wall ? d / 2 : 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    poseRoot(root, r);
    return { root, tick() {}, dispose() { root.removeFromParent(); geo.dispose(); mat.dispose(); } };
  }

  // ── 드나들기 ──
  function hostSpot() {
    const h = V.spec?.host;
    if (!h) return null;
    return { x: vx0 + h.lx, z: vz0 + h.lz, facing: FACE[h.face] ?? Math.PI };
  }

  /** 방 문 매트 (door.js 가 걸어 들고 나는 곳, 월드) */
  const roomDoor = () => ({ x: vx0 + ROOM_W / 2, front: vz0 + ROOM_D, entry: vz0 + ENTRY.lz });

  async function enter(slug) {
    if (H.busy || V.busy || H.inside || V.where || !slug || doors.busy) return false;
    V.busy = H.busy = true;
    try {
      const spec = await roomSpecOf(slug);
      await doors.through({ dir: 'in', place: houseOf(slug), kind: 'house-villager', variant: slug, room: roomDoor(),
        arrive: async s => { await furnish(spec); goIn(slug, { lx: s.x - vx0, lz: s.z - vz0, facing: s.facing }); } });
    } finally { V.busy = H.busy = false; }
    return true;
  }

  async function leave() {
    if (H.busy || V.busy || !V.where || doors.busy) return false;
    V.busy = H.busy = true;
    const slug = V.where;
    try {
      await doors.through({ dir: 'out', place: houseOf(slug), kind: 'house-villager', variant: slug, room: roomDoor(), arrive: s => goOut({ spot: s }) });
    } finally { V.busy = H.busy = false; }
    return true;
  }

  function goIn(slug, { lx, lz, facing }) {
    V.where = slug;
    S.visit = slug;
    room.group.visible = true;
    player.camera?.setBounds?.(cameraBox(VISIT_ROOM));
    player.camera?.setCurveScale?.(CAMERA_CURVE);
    player.teleport(vx0 + lx, vz0 + lz, facing);
    ctx.services.time?.setIndoor?.(true);
    ctx.services.audio?.bgm?.('indoor');
    const spot = hostSpot();
    // room = 방 범위(월드, Z4 town 이 주인 세울 때 씀), roomId = 방 스펙 slug
    events.emit('house:enter', { owner: slug, roomId: V.spec?.slug ?? null, name: V.spec?.name ?? '', spot: spot && { x: spot.x, z: spot.z }, facing: spot?.facing ?? Math.PI,
      room: { x0: vx0, z0: vz0, x1: vx0 + ROOM_W, z1: vz0 + ROOM_D } });
    saveSoon(0.5);
  }

  /** quiet: 저장 불러오기 등으로 밖에 나와 있을 때 (자리를 옮기지 않는다). spot = 섬에 설 곳 { x, z, facing } (door.js — 문간) */
  function goOut({ quiet = false, spot = null } = {}) {
    const slug = V.where;
    V.where = null;
    S.visit = null;
    player.camera?.setBounds?.(null);   // 범위를 먼저 풀어야 순간이동 때 카메라가 바로 섬으로 온다
    player.camera?.setCurveScale?.(1);
    if (!quiet) {
      const d = houseOf(slug)?.door ?? world.places?.spawn ?? { x: 0, z: 0 };
      const s = spot ?? { x: d.x, z: d.z + 0.15, facing: Math.PI };
      player.teleport(s.x, s.z, s.facing ?? Math.PI);
    }
    if (room) room.group.visible = false;
    clearFurniture();
    ctx.services.time?.setIndoor?.(false);
    ctx.services.audio?.bgm?.('auto');
    events.emit('house:leave', { owner: slug });
    saveSoon(0.5);
  }

  /** 저장에서 이어하기: 주민 방 안에서 끝냈으면 다시 그 방에 */
  async function resume(slug) {
    const spec = await roomSpecOf(slug);
    await furnish(spec);
    const p = state.player, lx = p.x - vx0, lz = p.z - vz0;
    const ok = Number.isFinite(lx) && lx > BOUNDS.x0 && lx < BOUNDS.x1 && lz > BOUNDS.z0 && lz < BOUNDS.z1 && !blockers().some(b => inBox(b, lx, lz));
    goIn(slug, ok ? { lx, lz, facing: p.facing ?? 0 } : { ...ENTRY, facing: 0 });
  }

  function update(dt) {
    const input = ctx.input;
    const blocked = ctx.services.ui?.isBlocking?.() || input.enabled === false;
    // 저장 불러오기·처음부터 하기로 플레이어가 방 밖에 옮겨졌으면 조용히 나온다 (서 있는 곳은 player 가 정한다)
    if (V.where && !V.busy && !H.busy) {
      const p = player.position;
      if (Math.abs(p.x - VISIT_ROOM.x) > ROOM_W || Math.abs(p.z - VISIT_ROOM.z) > ROOM_D) goOut({ quiet: true });
    }
    if (S.visit !== V.where && !V.busy) S.visit = V.where;
    if (!H.busy && !V.busy && !blocked && !H.moving && !H.inside && !doors.busy) {
      if (!V.where) {
        // 문 쪽으로 밀어서 들어가기
        const h = doorInFront(false), p = player.position;
        const atDoor = h && doorRule(h.slug) === 'open' && Math.abs(p.x - h.door.x) < 0.45 && p.z < h.door.z - 0.2 && p.z > h.door.z - 1.0;
        V.pushT = atDoor && input.move.z < -0.5 ? V.pushT + dt : 0;
        if (V.pushT > PUSH_TIME) { V.pushT = 0; enter(h.slug); }
      } else {
        const p = player.position;
        const atMat = Math.abs(p.x - (vx0 + ROOM_W / 2)) < 0.75 && p.z - vz0 > ROOM_D - 0.5;
        V.pushOutT = atMat && input.move.z > 0.5 ? V.pushOutT + dt : 0;
        if (V.pushOutT > PUSH_TIME) { V.pushOutT = 0; leave(); }
      }
    }
    if (V.where && room) {
      const now = ctx.services.time?.now?.();
      for (const o of V.objs) o.tick(dt, now);
      room.setNight(ctx.services.time?.nightFactor ?? 0);
      // 카메라: setBounds 가 없는 예전 player 면 방 가운데 둘레로 당긴다 (집 안과 같다)
      if (!player.camera?.setBounds) {
        const f = ctx.focus, cam = ctx.camera, box = cameraBox(VISIT_ROOM);
        const cx = Math.max(box.x0, Math.min(box.x1, f.x)), cz = Math.max(box.z0, Math.min(box.z1, f.z));
        cam.position.x += cx - f.x;
        cam.position.z += cz - f.z;
        f.x = cx; f.z = cz;
        materials.curve.uCurve.value *= CAMERA_CURVE;
      }
    }
  }

  return {
    get where() { return V.where; },
    enter, leave, resume, update,
    /** 주민 방 안이면 문 매트 (월드) { x, z } */
    doormat: () => (V.where ? { x: vx0 + ROOM_W / 2, z: vz0 + ROOM_D - 0.45 } : null),
    /** 주민 방 자리 (월드): 주민을 세울 때 · 방 밖에서 미리 볼 때 */
    roomInfo: { x: VISIT_ROOM.x, z: VISIT_ROOM.z, w: ROOM_W, d: ROOM_D, x0: vx0, z0: vz0 },
    /** 지금 꾸민 주민 방에서 주민이 설 곳 { x, z, facing } (slug 를 주면 그 주민 방일 때만) */
    hostSpot: slug => (!slug || V.spec?.owner === slug ? hostSpot() : null),
    /** 개발용: 지금 방 가구 중 임시 상자인 것 (FU 번호) */
    placeholders: () => V.list.filter(r => !r.real).map(r => r.fu ?? r.key),
  };
}
