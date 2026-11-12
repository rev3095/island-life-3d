// 트랙 W3 (P4): 집 실내 · 가구 배치 · 작업대 제작. src/gameplay/index.js 가 불러온다.
//  - 플레이어 집 문(world.places.playerHouse) 앞에서 행동 키(우선순위 90) 또는 문 쪽으로 밀기 → 문이 열리고 걸어 들어가 방 안으로 (door.js, 실내 보드 D67·D68).
//  - 방은 x = 500 에 지은 8×8 칸 (room.js), world.addZone 으로 바닥·벽 충돌을 바꿔 끼운다.
//  - 가구: 가방에서 골라 앞 칸에 놓기, 가구 앞 행동 키(80) → 돌리기·옮기기·색 바꾸기·라디오·어항/곤충 상자에 넣기·가방에 넣기, F → 바로 가방에.
//  - 작업대(방 서쪽 벽): ui.craft 창 (없으면 대화 선택지로, craft.js).
//  - 5차 Z2: 벽지·바닥(assets/interior 스펙, interior.js·pattern.js). 벽을 보고 행동 키(25) → 꾸미기 메뉴(벽지·바닥 바꾸기·가구 놓기).
//    상점 코너(ui/shop.js)는 house.interior 로 오늘의 벽지·바닥을 보고 산다. 주민 집 문 → 주민 방(visit.js).
//  - 실내 보드 interiors: 도토리상점·박물관 실내(places.js). 드나들기는 모두 door.js 의 through() 하나로.
//  - M14 집 증축 (home.js · assets/interior/home.json, 결정 D150–D151): 내 집 우편함(92)에서 도토리 빚으로 다음 단계를 짓고 갚는다.
//    단계 1 방 넓히기(1층 10×10, RM-15) · 2 2층(z 40, RM-16) · 3 다락(z 80, RM-17). 층마다 방·구역(zone)이 따로이고,
//    계단(FU-67·68, 붙박이 assets/furniture/fixtures)을 걸어 올라 꼭대기에 닿으면 / 위층 구멍(FU-69·70)의 열린 쪽으로 들어서면 짧게 어두워졌다가 다른 층.
//    집 겉모양은 단계마다 BD-12 (env house-grown-1–3) 로 바꿔 놓는다 (처음 집 BD-01 은 치운다).
// 상태 칸 state.house = { furniture: [rec], inside, seeded, radio, nextId, wallpaper, floor, owned, visit, place, level, grow } — rec 모양은 grid.js 맨 위 (+ variant 색, holds 넣어 둔 물고기·곤충 id, floor 층 번호).
//   place = 상점·박물관 안에서 저장했으면 'shop'|'museum' (이어하기, places.js). level = 집 안 층 (0 1층). grow = 집 증축 (home.js).
// 화면 전환은 ui.fade, 카메라 범위는 player.camera.setBounds — 없으면 직접 한다.
import { ROOM_W, ROOM_D, boxOf, fits, spotInFront, rotateInPlace, wallInFront, wallFree, moveCircle, inBox } from './grid.js';
import { ROOM, buildRoom, wallMount, cornerOf, WINDOWS, DOOR, cameraBox, CAMERA_CURVE } from './room.js';
import { createFurnitureKit } from './furniture.js';
import { openWorkbench, josa } from './craft.js';
import { loadInterior, normalizeHouse, todayPick, listOf, entryOf, KIND_NAME } from './interior.js';
import { swatchURL } from './pattern.js';
import { createVisits } from './visit.js';
import { createDoors } from './door.js';
import { createPlaces } from './places.js';
import { FIXTURE_BASE } from './placedata.js';
import { HOME_FILE, DEFAULT_HOME, ROOM_FILES, FLOOR_NAME, ensureGrow, floorsFor, growShift, shiftRecs, fixtureBox, stairHeight, stairTrigger, fixtureBlockers, arrivalAt,
  offer, growTopic, startBuild, finishBuild, repay, repayChoices, stageOf, maxStage } from './home.js';
import { seatSpec, seatsOf, nearestSeat } from '../decor/seats.js';   // 10차 앉기: 의자 자리 표

const TELESCOPE_ITEM = 'furn.star-telescope';         // 10차 FU-53 별 망원경 — 집 안에선 가구 메뉴 「망원경 보기」(M17-P2)
const WORKBENCH_INFO = { footprint: [2, 1], place: 'floor' };
const STARTER = [   // 처음 들어간 날 놓여 있는 가구
  { item: 'furn.round-rug', gx: 2, gz: 3, rot: 0 },
  { item: 'furn.floor-lamp', gx: 7, gz: 0, rot: 0 },
  { item: 'furn.plant-pot', gx: 0, gz: 0, rot: 0 },
];
/** 처음 집 (단계 0, 방 파일 없음) */
const BASE_FLOOR = { n: 0, slug: null, name: '1층', size: [ROOM_W, ROOM_D], origin: ROOM, windows: WINDOWS, door: DOOR, workbench: { gx: 0, gz: 2, rot: 1 }, fixtures: [], starter: STARTER };
const PUSH_TIME = 0.2;                                // 문 쪽으로 이만큼 밀면 드나든다
const REACH = 0.62;                                   // 플레이어 앞 몇 칸까지 가구를 건드리나
const DECOR_REACH = 0.95;                             // 벽에서 이만큼 안이면 꾸미기 메뉴
const PAGE = 5;                                       // 벽지·바닥 고르기 한 쪽에 보이는 수
const STAIR_FADE = { out: 0.24, in: 0.32, color: '#2E2420', cool: 0.7 };   // 계단 드나들기 (원 없이 짧게)
// 라디오 채널 = 시간대 배경음 (실내 기본곡 'indoor' 는 '작은 라디오' 분위기라 켜지 않았을 때 쓴다)
const RADIO = { dawn: '새벽 · 조용한 피아노', morning: '오전 · 밝은 마림바', afternoon: '오후 · 느긋한 우쿨렐레', evening: '저녁 · 따뜻한 패드', night: '밤 · 오르골' };
const RADIO_ORDER = Object.keys(RADIO);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Number(n).toLocaleString('ko-KR');

let H = null;   // 이 모듈의 상태

/** 층 정의 → 층 (칸 크기·모서리·문 매트·막는 칸·카메라) — 방(room)·구역은 init 이 붙인다 */
function levelOf(def) {
  const [w, d] = def.size, o = def.origin;
  const { x0, z0 } = cornerOf(o, w, d);
  const door = def.door ?? null;
  const reserved = new Set(door ? [`${door.gx0},${d - 1}`, `${door.gx1},${d - 1}`] : []);
  const fixtures = (def.fixtures ?? []).map(f => ({ ...f }));
  for (const f of fixtures) {
    const b = fixtureBox(f);
    for (let z = b.z0; z < b.z1; z++) for (let x = b.x0; x < b.x1; x++) reserved.add(`${x},${z}`);
    if (f.kind === 'up') for (let x = b.x0; x < b.x1; x++) reserved.add(`${x},${b.z1}`);            // 계단 아래 오르는 칸
    else reserved.add(`${(f.open ?? 'w') === 'w' ? b.x0 - 1 : b.x1},${b.z0}`);                      // 구멍 열린 쪽 칸
  }
  return {
    n: def.n, def, w, d, origin: o, x0, z0, door, reserved, fixtures,
    wb: def.workbench ? { id: 'workbench', item: 'workbench', ...def.workbench } : null,
    windows: def.windows ?? [], windowSet: new Set(def.windows ?? []),
    bounds: { x0: 0.09, z0: 0.09, x1: w - 0.09, z1: door ? d : d - 0.12 },
    cam: cameraBox(o, w, d),
    entry: { lx: w / 2, lz: d - 0.7 },
    room: null, fixObjs: [],
  };
}

export default {
  name: 'house',

  async init(ctx) {
    const { scene, state, events } = ctx;
    const world = ctx.services.world, player = ctx.services.player;
    if (!world || !player) { console.warn('[house] world·player 가 없어 집을 만들지 않습니다'); return; }
    const kit = createFurnitureKit(ctx);
    await kit.load();
    const fixKit = createFurnitureKit(ctx, { base: FIXTURE_BASE });   // M14 계단 붙박이 FU-67–70
    await fixKit.load().catch(e => console.warn('[house] 붙박이 목록을 못 읽었어요 (계단은 상자로)', e));
    const interior = await loadInterior(ctx.assets.loadJSON);
    const homeCfg = await ctx.assets.loadJSON(HOME_FILE).catch(e => (console.warn('[house] home.json 없음 — 기본 증축 단계', e), DEFAULT_HOME));
    const homeRooms = Object.fromEntries((await Promise.all(ROOM_FILES.map(f => ctx.assets.loadJSON(f).catch(() => null)))).filter(Boolean).map(r => [r.slug, r]));

    const S = (state.house ||= { furniture: [] });
    if (!Array.isArray(S.furniture)) S.furniture = [];
    S.furniture = S.furniture.filter(r => r && typeof r.item === 'string' && kit.info(r.item));   // 모르는 가구는 버린다
    if (S.furniture.length) S.seeded = true;
    if (S.radio === true) S.radio = 'morning';                         // 예전 저장 (켜짐/꺼짐만 있던 때)
    for (const r of S.furniture) if (r.holds && !ctx.services.data?.items.get(r.holds)) delete r.holds;
    normalizeHouse(S, interior.index);
    let G = ensureGrow(S, homeCfg);

    H = {
      ctx, kit, S, interior, inside: false, busy: false, moving: null,
      views: new Map(),          // rec.id → { obj, rec } (만들어지는 중이면 obj = null)
      pushT: 0, pushOutT: 0, saveT: 0, fadeEl: null, bench: null, stairCool: 0,
      levels: [], level: 0,
    };
    const L = () => H.levels[H.level] ?? H.levels[0];
    const levelOfRec = rec => H.levels[rec.floor ?? 0] ?? H.levels[0];
    const recsOn = n => S.furniture.filter(r => (r.floor ?? 0) === n);
    Object.defineProperty(H, 'room', { get: () => H.levels[0]?.room });

    const info = item => (item === 'workbench' ? WORKBENCH_INFO : kit.info(item));
    H.info = info;

    // ── 층 짓기: 단계에 맞는 층 목록, 층마다 방·구역 ──
    const decorOf = lv => (lv.n === 0 ? { wallpaper: S.wallpaper, floor: S.floor } : (G.decor[lv.n] ||= { wallpaper: lv.def.wallpaper ?? 'wp-01', floor: lv.def.floor ?? 'fl-01' }));
    function buildLevel(lv) {
      const dec = decorOf(lv);
      lv.room = buildRoom(ctx, { origin: lv.origin, size: [lv.w, lv.d], windows: lv.windows, door: lv.door, wallH: lv.def.wallH ?? undefined,
        wallpaper: interior.specs.get(dec.wallpaper), floor: interior.specs.get(dec.floor), frame: interior.frame, name: lv.n ? `house-room-${lv.n}` : 'house-room' });
      lv.room.group.visible = H.inside && H.level === lv.n;
      scene.add(lv.room.group);
      for (const f of lv.fixtures) placeFixture(lv, f);
    }
    async function placeFixture(lv, f) {
      const b = fixtureBox(f), at = { x: lv.x0 + (b.x0 + b.x1) / 2, z: lv.z0 + (b.z0 + b.z1) / 2 };
      const item = `fixture.${f.slug}`;
      const room = lv.room;
      try {
        if (!fixKit.info(item)) throw new Error(`붙박이 ${f.slug} 가 목록에 없어요`);
        const obj = await fixKit.make(item);
        if (lv.room !== room) { obj.dispose(); return; }   // 그 사이 방을 다시 지었다
        obj.root.position.set(at.x, 0, at.z);
        room.group.add(obj.root);
        lv.fixObjs.push(obj);
      } catch (e) {
        console.warn('[house] 계단 모델을 못 만들었어요 — 임시 상자', f.slug, e);
        const { THREE, materials } = ctx;
        const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.kind === 'up' ? (f.top ?? 1.7) : 0.05, f.d), materials.toonMaterial('#B98957', { name: 'stairBox' }));
        m.position.set(at.x, f.kind === 'up' ? (f.top ?? 1.7) / 2 : 0.02, at.z);
        room.group.add(m);
      }
    }
    function addZone(lv) {
      const local = (x, z) => ({ lx: x - lv.x0, lz: z - lv.z0 });
      lv.zoneOff = world.addZone({
        contains: (x, z) => Math.abs(x - lv.origin.x) < lv.w && Math.abs(z - lv.origin.z) < lv.d,
        collide(fx, fz, nx, nz, r) {
          const p = moveCircle(blockers(lv), lv.bounds, fx - lv.x0, fz - lv.z0, nx - lv.x0, nz - lv.z0, r ?? 0.26);
          return { x: p.x + lv.x0, z: p.z + lv.z0 };
        },
        heightAt: (x, z) => {
          const { lx, lz } = local(x, z);
          for (const f of lv.fixtures) { const y = stairHeight(f, lx, lz); if (y != null) return y; }
          return onRug(lv, lx, lz) ? 0.03 : 0;
        },
        groundAt: () => lv.room?.floor?.step ?? 'wood',
        isWalkable(x, z) {
          const { lx, lz } = local(x, z);
          const B = lv.bounds;
          if (lx < B.x0 || lz < B.z0 || lx > B.x1 || lz > B.z1) return false;
          return !blockers(lv).some(b => inBox(b, lx, lz));
        },
      });
    }
    function disposeLevel(lv) {
      for (const o of lv.fixObjs) o.dispose();
      lv.fixObjs = [];
      // 가구·작업대 모델은 다시 지은 방에 옮겨 붙인다 — 방 dispose 가 그 메시까지 지우지 않게 먼저 떼어 둔다
      H.bench?.removeFromParent();
      for (const v of H.views.values()) if (v.obj && levelOfRec(v.rec) === lv) v.obj.root.removeFromParent();
      lv.room?.dispose();
      lv.room = null;
      lv.zoneOff?.();
      lv.zoneOff = null;
    }
    /** 단계에 맞춰 층을 (다시) 짓는다. 1층이 커지면 가구를 같은 월드 자리로 옮긴다 */
    function buildLevels() {
      const defs = floorsFor(G.stage, homeRooms, BASE_FLOOR);
      const before = H.levels[0] ? [H.levels[0].w, H.levels[0].d] : null;
      for (const lv of H.levels) disposeLevel(lv);
      H.levels = defs.map(levelOf);
      // 예전 저장: 1층 크기가 단계와 다르면 (넓힌 날) 가구를 옮긴다 — 크기는 S.grow.size0 에 적어 둔다
      const size0 = [H.levels[0].w, H.levels[0].d];
      const was = Array.isArray(G.size0) ? G.size0 : (before ?? [ROOM_W, ROOM_D]);
      if (was[0] !== size0[0] || was[1] !== size0[1]) {
        shiftRecs(S.furniture, growShift(was, size0), 0);
        for (const r of S.furniture) if ((r.floor ?? 0) === 0 && !r.wall && !fits(S.furniture, r, info, { reserved: H.levels[0].reserved, w: size0[0], d: size0[1] })) r.gz = clamp(r.gz, 0, size0[1] - 2);
      }
      G.size0 = size0;
      for (const r of S.furniture) if ((r.floor ?? 0) >= H.levels.length) r.floor = 0;   // 없는 층의 가구 (예전 저장) → 1층
      for (const lv of H.levels) settleRecs(lv);
      for (const lv of H.levels) { buildLevel(lv); addZone(lv); }
      poseBench();
      for (const v of H.views.values()) { if (v.obj) { levelOfRec(v.rec).room.group.add(v.obj.root); pose(v.rec); } }
      if (H.level >= H.levels.length) H.level = 0;
    }

    /** 새 계단·구멍·작업대 자리와 겹친 바닥 가구를 가까운 빈자리로 옮긴다 (2층을 지은 날 1층 계단 자리에 있던 스탠드 등) */
    function settleRecs(lv) {
      const others = () => (lv.wb ? [...recsOn(lv.n), lv.wb] : recsOn(lv.n));
      const opts = r => ({ reserved: lv.reserved, w: lv.w, d: lv.d, ignore: r.id });
      for (const r of recsOn(lv.n)) {
        if (r.wall || !info(r.item) || fits(others(), r, info, opts(r))) continue;
        let best = null, bestD = Infinity;
        for (let gz = 0; gz < lv.d; gz++) for (let gx = 0; gx < lv.w; gx++) {
          const d = Math.abs(gx - r.gx) + Math.abs(gz - r.gz);
          if (d < bestD && fits(others(), { ...r, gx, gz }, info, opts(r))) { best = { gx, gz }; bestD = d; }
        }
        if (best) Object.assign(r, best);
      }
    }
    function blockers(lv) {
      const out = [];
      if (lv.wb) out.push(boxOf(lv.wb, WORKBENCH_INFO.footprint));
      for (const f of lv.fixtures) out.push(...fixtureBlockers(f));
      for (const r of S.furniture) {
        if (r.wall || r === H.moving?.rec || (r.floor ?? 0) !== lv.n) continue;
        const fi = info(r.item);
        if (!fi || fi.layer === 'rug') continue;
        const b = boxOf(r, fi.footprint);
        out.push({ x0: b.x0 + 0.04, z0: b.z0 + 0.04, x1: b.x1 - 0.04, z1: b.z1 - 0.04 });
      }
      return out;
    }
    const onRug = (lv, lx, lz) => S.furniture.some(r => (r.floor ?? 0) === lv.n && !r.wall && info(r.item)?.layer === 'rug' && r !== H.moving?.rec && inBox(boxOf(r, info(r.item).footprint), lx, lz, -0.1));

    // 작업대: 배경 모델(assets/env 'workbench')을 그대로 쓴다 (1층 서쪽 벽)
    try {
      const [gltf, spec] = await Promise.all([ctx.assets.loadEnv('workbench'), ctx.assets.loadEnvSpec('workbench')]);
      const { scene: wb } = ctx.assets.instantiate(gltf);
      ctx.materials.applyToonStyle(wb, { spec });
      H.bench = wb;
    } catch (e) { console.warn('[house] 작업대 모델을 못 읽었어요', e); }
    function poseBench() {
      const lv = H.levels[0], wb = H.bench;
      if (!wb || !lv?.wb) return;
      const b = boxOf(lv.wb, WORKBENCH_INFO.footprint);
      wb.position.set(lv.x0 + b.cx, 0, lv.z0 + b.cz);
      wb.rotation.y = lv.wb.rot * Math.PI / 2;
      lv.room.group.add(wb);
    }
    buildLevels();

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
      S.level = H.level;
      // 증축 단계도 저장을 따라간다
      const g = ensureGrow(S, homeCfg);
      if (g !== G || g.stage !== H.stageBuilt) { G = g; H.stageBuilt = G.stage; buildLevels(); applyExterior(); }
    };
    H.stageBuilt = G.stage;

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
    // M14 집 증축: 내 집 우편함 (안 읽은 편지가 있으면 town:mail 91 이 먼저 읽게 둔다 — 다 읽은 뒤 Space = 집 증축 묻기·갚기)
    // M17-P2 (D185-A): 우편함은 집 빚 갚기만 (빚이 있을 때만 잡는다 — 없으면 우편함 = 편지 town:mail). 넓히기는 도토리상점 밤톨 대화 「집을 넓히고 싶어요」
    I.add({ name: 'house-grow', intent: 'action', priority: 92, label: '집 빚 갚기', test: () => (!H.inside && !H.busy && !doors.busy && G.debt > 0 && mailboxInFront() ? true : null), run: () => growTalk() });

    // 주민 집·주민 방 (visit.js): 같은 화면 전환·가구 모델·스펙을 쓴다
    const visits = createVisits(ctx, { H, kit, interior, doors, toast, saveSoon });
    H.visits = visits;
    // 도토리상점·박물관 실내 (places.js): 같은 문·가구 모델·스펙
    const places = await createPlaces(ctx, { H, kit, interior, doors, toast, saveSoon });
    H.places = places;

    // 저장에서 이어하기: 집 안에서 끝냈으면 다시 집 안에 (그 층)
    if (S.inside) {
      const p = state.player;
      const lv = H.levels[S.level ?? 0] ?? H.levels[0];
      const lx = p.x - lv.x0, lz = p.z - lv.z0, B = lv.bounds;
      const ok = Number.isFinite(lx) && lx > B.x0 && lx < B.x1 && lz > B.z0 && lz < B.z1 && !blockers(lv).some(b => inBox(b, lx, lz));
      goInside(ok ? { lx, lz, facing: p.facing ?? 0, level: lv.n } : { ...H.levels[0].entry, facing: 0, level: 0 });
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
      /** 지금 층의 방 (밖이면 1층) { x, z, w, d, x0, z0, floor } */
      get room() { const lv = H.inside ? L() : H.levels[0]; return { x: lv.origin.x, z: lv.origin.z, w: lv.w, d: lv.d, x0: lv.x0, z0: lv.z0, floor: lv.n }; },
      /** 지금 있는 방: 'player' (내 집) | 주민 slug (그 주민 방) | 'shop' | 'museum' | null (밖) */
      get where() { return H.inside ? 'player' : visits.where ?? places.where; },
      /** 지금 방의 문 매트 (나가는 곳, 월드) { x, z } | null — QA 봇·편집기용. 내 집 위층이면 null */
      doormat() {
        if (H.inside) { const lv = L(); return lv.door ? { x: lv.x0 + (lv.door.gx0 + lv.door.gx1 + 1) / 2, z: lv.z0 + lv.d - 0.45 } : null; }
        return visits.doormat() ?? places.doormat();
      },
      /** 문 드나드는 중인가 (door.js) */
      get passing() { return doors.busy; },
      /** M14 집 증축: 단계·빚·층 (home.js) — 봇·점검 도구·섬폰이 읽는다 */
      grow: {
        get stage() { return G.stage; }, get debt() { return G.debt; }, get pending() { return G.pending; },
        get max() { return maxStage(homeCfg); }, get config() { return homeCfg; },
        get level() { return H.inside ? H.level : null; },
        floors: () => H.levels.map(lv => ({ n: lv.n, name: lv.def.name ?? FLOOR_NAME[lv.n], slug: lv.def.slug, w: lv.w, d: lv.d, x0: lv.x0, z0: lv.z0, fixtures: lv.fixtures.map(f => ({ ...f })) })),
        /** 계단 꼭대기·구멍 열린 쪽 (월드) — 봇이 걸어갈 곳: [{ to, kind, x, z, from: {x, z} }] */
        stairs() {
          const lv = L();
          return lv.fixtures.map(f => {
            const b = fixtureBox(f), cx = (b.x0 + b.x1) / 2;
            if (f.kind === 'up') return { to: f.to, kind: 'up', x: lv.x0 + cx, z: lv.z0 + b.z0 + 0.4, from: { x: lv.x0 + cx, z: lv.z0 + b.z1 + 0.5 } };
            const ox = (f.open ?? 'w') === 'w' ? b.x0 - 0.5 : b.x1 + 0.5, ix = (f.open ?? 'w') === 'w' ? b.x0 + 0.7 : b.x1 - 0.7;
            return { to: f.to, kind: 'down', x: lv.x0 + ix, z: lv.z0 + b.z0 + 0.5, from: { x: lv.x0 + ox, z: lv.z0 + b.z0 + 0.5 } };
          });
        },
        /** 우편함 대화 (빚 갚기 — 봇은 우편함 앞 Space 로 · 이건 섬폰·편집기용) */
        talk: () => growTalk(),
        /** M17-P2 (D185-A) 도토리상점 밤톨 「집을 넓히고 싶어요」 (town/keepers.js shopFlow 가 자기 say 로 부른다) */
        ask: ({ say } = {}) => growTalk({ where: 'shop', say }),
        /** 넓힐 수 있나 (밤톨 대화에 줄을 넣을지): 'build' 다음 단계 · 'debt' · 'pending' · 'done' · null (첫날 전) */
        offer: () => (afterIntro() ? offer(G, homeCfg).kind : null),
        /** 개발·점검 도구: 다음 날을 기다리지 않고 짓던 것을 다 짓기 */
        finish: () => completeBuild(),
      },
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
        /** 플레이어 방에 바로 붙이기 (가진 것만, 집 안이면 지금 층) → true | false */
        apply: (kind, slug) => applyDecor(kind, slug),
        swatch: slug => swatch(slug),
        spec: slug => interior.specs.get(slug) ?? null,
      },
    };
    applyExterior();
    console.info(`[house] 집 준비됨 · 가구 모델 ${kit.list.length}종 · 놓인 가구 ${S.furniture.length}개 · 증축 ${G.stage}단계${G.debt ? ` (빚 ${fmt(G.debt)})` : ''}${H.inside ? ` · 집 안(${FLOOR_NAME[H.level]})에서 이어하기` : ''}`);

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
    /** 1층 문 매트 가운데 (방 기준 lx) */
    const matX = lv => (lv.door.gx0 + lv.door.gx1 + 1) / 2;
    function onDoormat() {
      const lv = L();
      if (!lv.door) return false;
      const p = player.position;
      return Math.abs(p.x - (lv.x0 + matX(lv))) < 0.75 && p.z - lv.z0 > lv.d - 0.85;
    }
    H.onDoormatPush = () => {
      const lv = L();
      if (!lv.door) return false;
      const p = player.position;
      return Math.abs(p.x - (lv.x0 + matX(lv))) < 0.75 && p.z - lv.z0 > lv.d - 0.5;
    };

    /** 방 문 매트 (door.js 가 걸어 들고 나는 곳, 월드) — 언제나 1층 */
    const roomDoor = () => { const lv = H.levels[0]; return { x: lv.x0 + matX(lv), front: lv.z0 + lv.d, entry: lv.z0 + lv.entry.lz }; };
    /** 지금 집 겉모양 모델 (문짝 크기를 그 모델에서 잰다) */
    function houseKind() { return stageOf(homeCfg, G.stage)?.exterior ?? 'house-player'; }   // 함수 선언 — init 중간(applyExterior)에도 부른다

    async function enter() {
      if (H.busy || H.inside || doors.busy) return;
      H.busy = true;
      try {
        await doors.through({ dir: 'in', place: world.places?.playerHouse, kind: H.exteriorKind ?? 'house-player', room: roomDoor(),
          arrive: s => goInside({ lx: s.x - H.levels[0].x0, lz: s.z - H.levels[0].z0, facing: s.facing, level: 0 }) });
      } finally { H.busy = false; }
    }

    async function leave() {
      if (H.busy || !H.inside || doors.busy) return;
      if (H.level !== 0) {   // 위층에서 부르면 (점검 도구·장면): 1층 문 매트로 옮긴 뒤 나간다
        const lv = H.levels[0];
        showLevel(0);
        player.teleport(lv.x0 + matX(lv), lv.z0 + lv.d - 0.6, Math.PI);
      }
      H.busy = true;
      try {
        await doors.through({ dir: 'out', place: world.places?.playerHouse, kind: H.exteriorKind ?? 'house-player', room: roomDoor(), arrive: s => goOutside(s) });
      } finally { H.busy = false; }
    }

    function showLevel(n) {
      H.level = n;
      S.level = n;
      for (const lv of H.levels) lv.room.group.visible = H.inside && lv.n === n;
      player.camera?.setBounds?.(L().cam);
    }

    function goInside({ lx, lz, facing, level = 0 }) {
      H.inside = true;
      S.inside = true;
      if (!H.preloaded) { H.preloaded = true; kit.preload(kit.list.map(m => m.item)); }   // 가구 모델은 처음 들어갈 때 미리 받아 둔다
      if (!S.seeded) {
        S.seeded = true;
        for (const s of STARTER) if (fits(recsOn(0), { id: '__s', ...s }, info, { reserved: H.levels[0].reserved, w: H.levels[0].w, d: H.levels[0].d })) placeRec(s.item, s, { silent: true, floor: 0 });
      }
      seedLevels();
      showLevel(level);
      player.camera?.setCurveScale?.(CAMERA_CURVE);
      const lv = L();
      player.teleport(lv.x0 + lx, lv.z0 + lz, facing);
      ctx.services.time?.setIndoor?.(true);
      ctx.services.audio?.bgm?.(radioSong());
      events.emit('house:enter', { owner: 'player', floor: level });
      saveSoon(0.5);
    }
    /** 새로 생긴 층에 처음 놓이는 가구 (방 파일 starter) — 층마다 한 번 */
    function seedLevels() {
      const done = (G.seeded ||= []);
      for (const lv of H.levels) {
        if (!lv.n || done.includes(lv.n)) continue;
        done.push(lv.n);
        for (const s of lv.def.starter ?? []) if (info(s.item) && fits(recsOn(lv.n), { id: '__s', ...s }, info, { reserved: lv.reserved, w: lv.w, d: lv.d })) placeRec(s.item, s, { silent: true, floor: lv.n });
      }
    }

    /** spot = 섬에 설 곳 { x, z, facing } (door.js — 문간). 없으면 문 앞 */
    function goOutside(spot) {
      if (H.moving) cancelMoving();
      H.inside = false;
      S.inside = false;
      showLevel(0);
      const d = doorPoint() ?? world.places?.spawn ?? { x: 0, z: 0 };
      player.camera?.setBounds?.(null);
      player.camera?.setCurveScale?.(1);
      const s = spot ?? { x: d.x, z: d.z + 0.15, facing: Math.PI };
      player.teleport(s.x, s.z, s.facing ?? Math.PI);
      for (const lv of H.levels) lv.room.group.visible = false;
      ctx.services.time?.setIndoor?.(false);
      ctx.services.audio?.bgm?.('auto');
      events.emit('house:leave', { owner: 'player' });
      if (G.pendingDone) Promise.resolve().then(() => completeBuild());   // 집 안에 있는 동안 날이 바뀌었으면 나올 때 짓는다
      saveSoon(0.5);
    }

    // ────────────────────────────── 계단 (M14) ──────────────────────────────

    /** 계단 꼭대기·구멍에 닿았으면 다른 층으로 (update 가 부른다) */
    H.checkStairs = () => {
      if (H.stairCool > 0 || H.moving) return;
      const lv = L(), p = player.position;
      const f = stairTrigger(lv.fixtures, p.x - lv.x0, p.z - lv.z0);
      if (f) climb(f);
    };
    async function climb(f) {
      const from = L(), to = H.levels[f.to];
      const pair = to?.fixtures.find(x => x.to === from.n);
      if (!to || !pair || H.busy) return;
      const dir = f.kind === 'up' ? 'up' : 'down';
      H.busy = true;
      player.freeze?.(true);
      try {
        events.emit('sfx', { name: 'step-wood', volume: 1 });
        await fadeTo(true, STAIR_FADE.out, STAIR_FADE.color);
        const a = arrivalAt(pair, dir);
        showLevel(to.n);
        player.teleport(to.x0 + a.lx, to.z0 + a.lz, a.facing);
        const calm = !!ctx.services.ui?.access?.calm;
        const walk = !calm && player.walkTo ? player.walkTo(to.x0 + a.walk.lx, to.z0 + a.walk.lz, { speed: 2.2 }) : null;
        await Promise.all([fadeTo(false, STAIR_FADE.in, STAIR_FADE.color), walk]);
        if (calm) player.teleport(to.x0 + a.walk.lx, to.z0 + a.walk.lz, a.facing);
        events.emit('house:floor', { floor: to.n, from: from.n, dir });
        saveSoon(0.5);
      } catch (e) {
        console.error('[house] 계단', e);
        fadeTo(false, 0.2);
      } finally {
        player.freeze?.(false);
        H.busy = false;
        H.stairCool = STAIR_FADE.cool;
      }
    }

    // ────────────────────────────── 집 증축 (M14) ──────────────────────────────

    function mailSpot() {
      const s = ctx.services.town?.mail?.spot;
      if (s) return s;
      const d = world.home?.places?.playerHouse?.door ?? doorPoint();
      return d ? { x: d.x + 1, z: d.z } : null;
    }
    function mailboxInFront() {
      const q = mailSpot();
      if (!q || (ctx.services.town?.mail?.unread?.().length ?? 0) > 0) return null;
      const p = player.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > 1.15) return null;
      return d < 0.55 || (-Math.sin(player.facing) * dx - Math.cos(player.facing) * dz) / d > 0.45;
    }
    const afterIntro = () => !homeCfg.afterIntro || !!state.flags?.firstday?.finished || !ctx.services.intro;

    /**
     * 집 증축 대화 (M14 · M17-P2 D185-A). where 'mail' = 우편함 (빚 갚기만 — 빚이 없으면 밤톨에게 가라는 한 줄),
     * 'shop' = 도토리상점 밤톨 「집을 넓히고 싶어요」 (다음 단계 짓기 · 짓는 중 · 다 지음 · 빚이 남았으면 갚기도). say 를 주면 그 대화창으로 (밤톨 대화 안)
     */
    async function growTalk({ where = 'mail', say: sayIn = null } = {}) {
      const ui = ctx.services.ui, wallet = ctx.services.data?.wallet;
      if (!ui?.dialog || !wallet || (!sayIn && H.busy)) return;
      const own = !sayIn;
      if (own) H.busy = true;
      const say = sayIn ?? ((lines, choices) => ui.dialog.open({ speaker: '밤톨', color: '#C98F52', lines, choices }));
      try {
        if (!afterIntro()) { await say(['집을 넓히는 이야기는 섬 생활에 익숙해진 뒤에 해요!']); return; }
        const o = offer(G, homeCfg), topic = growTopic(G, homeCfg, where);
        if (topic === 'to-shop') { await say(['집을 넓히고 싶으면 도토리상점에 들러 주세요!', '계산대에서 저한테 말해 주면 돼요.']); return; }
        if (topic === 'pending') { await say([`「${o.next.name}」 공사 중이에요!`, '내일 아침이면 다 지어져 있을 거예요.']); return; }
        if (topic === 'done') { await say(['집이 이제 다 자랐어요!', `그동안 갚은 도토리 ${fmt(G.paid)}개 — 정말 고생 많았어요.`]); return; }
        if (topic === 'debt') { await say([`아직 집 빚이 도토리 ${fmt(G.debt)}개 남았어요.`, '빚은 집 앞 우편함에서 갚아요. 다 갚으면 더 넓혀 드릴게요!']); return; }
        if (topic === 'repay') {
          const have = wallet.get();
          const list = repayChoices(G, have, homeCfg);
          const letter = where === 'mail' && !!ctx.services.town?.mail?.canWrite?.() && !!ctx.services.town?.mail?.write;   // 우편함은 편지도 (M15)
          const pick = await say([`남은 집 빚은 도토리 ${fmt(G.debt)}개예요.`, list.length ? '얼마나 갚을까요?' : '도토리가 모이면 갚으러 와 주세요.'], [...list.map(c => c.label), ...(letter ? ['편지 쓸래요'] : []), '다음에 갚을게요']);
          if (letter && pick === list.length) { await ctx.services.town.mail.write(); return; }
          const c = pick == null ? null : list[pick];
          if (!c) return;
          if (!wallet.spend(c.amount)) { toast('도토리가 모자라요', '🌰'); return; }
          const left = repay(G, c.amount);
          events.emit('sfx', { name: 'acorn' });
          events.emit('house:repay', { amount: c.amount, debt: left });
          if (left === 0) {
            const next = stageOf(homeCfg, G.stage + 1);
            await say(['빚을 다 갚았어요! 대단해요!', next ? `다음엔 「${next.name}」도 할 수 있어요. 가게에 오면 또 물어봐 주세요.` : '이제 집이 다 자랐어요.']);
            events.emit('house:paid', { stage: G.stage });
          } else toast(`집 빚 ${fmt(c.amount)} 갚음 — 남은 빚 ${fmt(left)}`, '🏠');
          saveSoon(0.3);
          return;
        }
        // 다음 단계 짓기
        const n = o.next;
        const pick = await say([G.stage === 0 ? '집이 조금 좁지 않아요?' : '집을 더 키워 볼까요?', `「${n.name}」 — ${n.note ?? ''}`, `도토리 ${fmt(n.cost)}개를 빌려 지을 수 있어요. 갚는 건 천천히, 언제든요.`], ['지어 주세요!', '다음에요']);
        if (pick !== 0) return;
        const st = startBuild(G, homeCfg);
        if (!st) return;
        events.emit('sfx', { name: 'menu' });
        player.play?.('happy');
        events.emit('house:build', { stage: st.stage, cost: st.cost, debt: G.debt });
        await say([`좋아요! 「${st.name}」 공사를 시작할게요.`, '내일 아침이면 다 지어져 있을 거예요. 빚은 우편함에서 갚아요!']);
        saveSoon(0.3);
      } finally { if (own) H.busy = false; }
    }

    /** 짓던 단계를 다 짓는다 (하루 리셋 때 · 집 안이면 나올 때) */
    function completeBuild() {
      if (G.pending == null) { G.pendingDone = false; return false; }
      if (H.inside) { G.pendingDone = true; return false; }
      G.pendingDone = false;
      const st = finishBuild(G);
      H.stageBuilt = st;
      buildLevels();
      applyExterior();
      const s = stageOf(homeCfg, st);
      toast(`집 공사가 끝났어요 — ${s?.name ?? ''}`, '🏠');
      events.emit('house:grown', { stage: st, floors: H.levels.length });
      saveSoon(0.3);
      return true;
    }
    events.on('data:newday', () => completeBuild());

    /** 집 겉모양: 단계 1 부터 BD-12 (house-grown-N) — 처음 집 BD-01 은 치우고 그 자리에 저장하지 않는 물체로 놓는다 */
    async function applyExterior() {
      const objs = world.home?.objects ?? world.objects;
      const ph = world.home?.places?.playerHouse ?? world.places?.playerHouse;
      const isl = world.home?.island ?? world.island;
      const kind = houseKind();
      const mine = objs.list().filter(o => o.data?.grownHouse);
      const orig = objs.list('house-player')[0];
      if (kind === 'house-player') {
        H.exteriorKind = 'house-player';
        for (const o of mine) objs.remove(o.id);
        if (!orig && mine.length && ph) { const t = isl.toTile(ph.x, ph.z); objs.add('house-player', t.tx, t.tz, { persist: false, at: { x: ph.x, z: ph.z, y: mine[0].y }, rot: mine[0].rot }); }   // 저장을 예전 것으로 바꿨을 때
        return;
      }
      if (mine.some(o => o.kind === kind)) { H.exteriorKind = kind; if (orig) objs.remove(orig.id); return; }
      const ok = await objs.ensure(kind).catch(() => false);
      if (!ok || !ph) { console.warn('[house] 커진 집 모델을 못 받았어요 — 처음 집 그대로', kind); H.exteriorKind = orig ? 'house-player' : kind; return; }
      for (const o of objs.list().filter(x => x.data?.grownHouse)) objs.remove(o.id);
      const { tx, tz } = orig?.tile ?? isl.toTile(ph.x, ph.z);   // 건물 가운데 칸 (place.tx·tz 는 문 앞 칸)
      const y = orig?.y ?? isl.levelAt(tx, tz);
      objs.add(kind, tx, tz, { persist: false, rot: orig?.rot ?? 0, at: { x: orig?.x ?? ph.x, z: orig?.z ?? ph.z, y }, grownHouse: true });
      if (orig) objs.remove(orig.id);
      H.exteriorKind = kind;
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

    /** 바뀐 벽지·바닥을 방에 붙인다 (저장 불러오기·reset 뒤에도 update 가 부른다) — 층마다 */
    function showDecor() {
      normalizeHouse(S, interior.index);
      for (const lv of H.levels) {
        const dec = decorOf(lv), room = lv.room;
        if (!room) continue;
        if (room.wallpaper?.slug !== dec.wallpaper) room.setWallpaper(interior.specs.get(dec.wallpaper));
        if (room.floor?.slug !== dec.floor) room.setFloor(interior.specs.get(dec.floor));
      }
    }
    H.showDecor = showDecor;
    H.decorChanged = () => H.levels.some(lv => { const dec = decorOf(lv); return lv.room && (lv.room.wallpaper?.slug !== dec.wallpaper || lv.room.floor?.slug !== dec.floor); });

    function applyDecor(kind, slug) {
      const m = entryOf(interior.index, slug);
      if (!m || m.kind !== kind || !S.owned.includes(slug) || !interior.specs.get(slug)) return false;
      const lv = H.inside ? L() : H.levels[0];
      if (lv.n === 0) S[kind] = slug;
      else decorOf(lv)[kind] = slug;
      showDecor();
      events.emit('house:decor', { kind, slug, floor: lv.n });
      saveSoon();
      return true;
    }

    /** 바라보는 벽이 가까이 있고 그 자리에 벽 가구가 없으면 → 벽 자리 */
    function decorWall() {
      const { lx, lz } = playerLocal(), lv = L();
      const w = wallInFront(lx, lz, player.facing, { reach: DECOR_REACH, w: lv.w, d: lv.d });
      if (!w || recsOn(lv.n).some(r => r.wall === w.wall && r.slot === w.slot)) return null;
      return w;
    }

    async function decorate() {
      const ui = ctx.services.ui;
      if (!ui?.dialog) { placeFromBag(); return; }
      H.busy = true;
      let pick = null;
      try { pick = await ui.dialog.open({ speaker: '꾸미기', color: '#C99B68', lines: [H.levels.length > 1 ? `${FLOOR_NAME[H.level]}을 어떻게 꾸밀까요?` : '방을 어떻게 꾸밀까요?'], choices: ['벽지 바꾸기', '바닥 바꾸기', '가구 놓기', '그만두기'] }); }
      finally { H.busy = false; }
      if (pick === 0) await chooseDecor('wallpaper');
      else if (pick === 1) await chooseDecor('floor');
      else if (pick === 2) await placeFromBag();
    }

    /** 가진 벽지·바닥 고르기: 한 쪽에 PAGE 개씩, 고르면 바로 붙는다 (지금 층) */
    async function chooseDecor(kind) {
      const ui = ctx.services.ui, what = KIND_NAME[kind];
      const cur = () => decorOf(L())[kind];
      const mine = listOf(interior.index, kind).filter(m => S.owned.includes(m.slug));
      if (mine.length < 2) { toast(`도토리상점에서 ${josa(what, '을/를')} 사 오면 바꿀 수 있어요`, '🏪'); return; }
      let page = 0;
      for (;;) {
        const pages = Math.ceil(mine.length / PAGE);
        const shown = mine.slice(page * PAGE, page * PAGE + PAGE);
        const choices = shown.map(m => (cur() === m.slug ? `${m.name} (지금)` : m.name));
        if (pages > 1) choices.push('다른 것 보기 ▶');
        choices.push('그만두기');
        const now = entryOf(interior.index, cur())?.name ?? '';
        H.busy = true;
        let i = null;
        try { i = await ui.dialog.open({ speaker: '꾸미기', color: '#C99B68', lines: [`지금 ${josa(what, '은/는')} ${josa(now, '이에요/예요')}. 어떤 걸로 바꿀까요?`], choices }); }
        finally { H.busy = false; }
        if (i == null || i >= choices.length - 1) return;
        if (pages > 1 && i === shown.length) { page = (page + 1) % pages; continue; }
        const m = shown[i];
        if (m && m.slug !== cur() && applyDecor(kind, m.slug)) {
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

    function playerLocal() { const p = player.position, lv = L(); return { lx: p.x - lv.x0, lz: p.z - lv.z0 }; }

    /** 가구 하나를 플레이어 앞에 놓을 자리 (벽 가구는 바라보는 벽) → spot | null — 지금 층 */
    function findSpot(item, ignore = null) {
      const fi = info(item);
      if (!fi) return null;
      const lv = L();
      const { lx, lz } = playerLocal();
      const here = recsOn(lv.n);
      if (fi.place === 'wall' || fi.place === 'window') {
        const w = wallInFront(lx, lz, player.facing, { w: lv.w, d: lv.d });
        if (!w) return null;
        const tries = fi.place === 'window'
          ? lv.windows.map(k => k.split(':')).filter(([wl]) => wl === w.wall).map(([, s]) => Number(s)).sort((a, b) => Math.abs(a - w.slot) - Math.abs(b - w.slot)).filter(s => Math.abs(s - w.slot) <= 2)
          : [w.slot, w.slot - 1, w.slot + 1].filter(s => s >= 0 && s < (w.wall === 'n' ? lv.w : lv.d));
        const slot = tries.find(s => wallFree(here, w.wall, s, fi.place, lv.windowSet, ignore));
        return slot == null ? null : { wall: w.wall, slot };
      }
      const others = lv.wb ? [...here, lv.wb] : here;
      return spotInFront(others, item, lx, lz, player.facing, info, { reserved: lv.reserved, ignore, w: lv.w, d: lv.d });
    }

    function placeRec(item, spot, { silent = false, variant = null, floor = null } = {}) {
      if (!spot || !info(item)) return null;
      const rec = spot.wall ? { id: newId(), item, wall: spot.wall, slot: spot.slot } : { id: newId(), item, gx: spot.gx, gz: spot.gz, rot: spot.rot ?? 0 };
      if (variant) rec.variant = variant;
      const fl = floor ?? (H.inside ? H.level : 0);
      if (fl) rec.floor = fl;
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
        levelOfRec(rec).room.group.add(obj.root);
        pose(rec);
      } catch (e) { console.error('[house] 가구를 못 만들었어요', rec.item, e); }
    }

    /** rec 의 자리로 모델을 옮긴다 (lift: 옮기는 중 살짝 띄우기) */
    function pose(rec, lift = 0) {
      const obj = H.views.get(rec.id)?.obj;
      if (!obj) return;
      const lv = levelOfRec(rec);
      if (rec.wall) {
        const m = wallMount(rec.wall, rec.slot, { x0: lv.x0, z0: lv.z0, w: lv.w });
        obj.root.position.set(m.x, lift, m.z);
        obj.root.rotation.y = m.rotY;
      } else {
        const b = boxOf(rec, info(rec.item).footprint);
        obj.root.position.set(lv.x0 + b.cx, lift, lv.z0 + b.cz);
        obj.root.rotation.y = rec.rot * Math.PI / 2;
      }
    }

    async function placeFromBag() {
      const data = ctx.services.data, ui = ctx.services.ui;
      if (!data || !ui?.bag) return;
      // M17-P2 (D184-A): 미술품 art.*(진품·가품)도 가구처럼 — 그림은 벽, 조각은 바닥 (furniture.js artInfos)
      const isFurn = s => !!s && (String(s.id).startsWith('furn.') || String(s.id).startsWith('art.')) && !!kit.info(s.id);
      if (!data.inventory.slots.some(isFurn)) { toast('가방에 놓을 가구가 없어요', '🪑'); return; }
      H.busy = true;
      try {
        const slot = await ui.bag.open({ mode: 'pick', title: '가구 놓기', hint: '방에 놓을 가구·미술품을 골라 주세요', filter: s => isFurn(s) });
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

    /** 플레이어 앞의 가구 · 작업대 → { kind: 'furniture', rec } | { kind: 'workbench' } | null (지금 층) */
    function targetInFront() {
      const { lx, lz } = playerLocal(), lv = L();
      const f = player.facing;
      const px = lx - Math.sin(f) * REACH, pz = lz - Math.cos(f) * REACH;
      let best = null, bestD = Infinity;
      const consider = (t, b) => {
        if (!inBox(b, px, pz, 0.22)) return;
        const d = Math.hypot(b.cx - lx, b.cz - lz);
        if (d < bestD) { best = t; bestD = d; }
      };
      if (lv.wb) consider({ kind: 'workbench' }, boxOf(lv.wb, WORKBENCH_INFO.footprint));
      const here = recsOn(lv.n);
      for (const rec of here) {
        if (rec.wall || info(rec.item)?.layer === 'rug') continue;
        consider({ kind: 'furniture', rec }, boxOf(rec, info(rec.item).footprint));
      }
      if (best) return best;
      const w = wallInFront(lx, lz, f, { reach: 1.25, w: lv.w, d: lv.d });
      const onWall = w && here.find(r => r.wall === w.wall && r.slot === w.slot);
      if (onWall) return { kind: 'furniture', rec: onWall };
      // 러그는 밖에서 바라볼 때만 (러그 위에 서 있으면 행동 키 = 가구 놓기)
      const rug = here.find(r => {
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
      const lv = levelOfRec(t.rec);
      const b = boxOf(t.rec, info(t.rec.item).footprint);
      const cx = lv.x0 + b.cx, cz = lv.z0 + b.cz;
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
      if (rec.item === 'furn.wardrobe' && ctx.services.outfit && ui.closet) opts.push(['dress', '갈아입기']);   // 11차 D100-A 옷장 창 UI-19
      if (rec.item === TELESCOPE_ITEM && ctx.services.stars?.open) opts.push(['scope', '망원경 보기']);   // M17-P2: 박물관 앞 망원경과 같은 망원경 보기 UI-32
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
      if (opts[0]?.[0] === 'dress') line = '옷장이에요. 무엇을 할까요?';
      if (opts[0]?.[0] === 'scope') line = '별 망원경이에요. 창밖 밤하늘을 볼까요?';
      if (rec.holds) line = `${josa(nameOf(rec.holds), '이/가')} ${it.holds === 'fish' ? '헤엄치고' : '쉬고'} 있어요. 어떻게 할까요?`;
      else if (it?.plays === 'bgm' && S.radio) line = `라디오에서 ${RADIO[S.radio]} 곡이 나오고 있어요.`;
      H.busy = true;
      let pick = null;
      try { pick = await ui.dialog.open({ speaker: name, color: '#C99B68', lines: [line], choices: opts.map(o => o[1]) }); }
      finally { H.busy = false; }
      const what = pick == null ? 'cancel' : opts[pick][0];
      if (what === 'scope') { ctx.services.stars.open({ where: '집 안 별 망원경' }); return; }
      if (what === 'dress') {
        H.busy = true;
        try { await ui.closet.open(); } finally { H.busy = false; }
        return;
      }
      if (what === 'rotate') {
        const lv = levelOfRec(rec), here = recsOn(lv.n);
        const next = rotateInPlace(lv.wb ? [...here, lv.wb] : here, rec, info, { reserved: lv.reserved, blockCells: new Set([playerCell()]), w: lv.w, d: lv.d });
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
    H.level0 = () => H.levels[0];
    H.cur = L;
  },

  update(dt, ctx) {
    if (!H) return;
    if (H.S.furniture !== H.list || H.S.grow?.stage !== H.stageBuilt || (H.S.grow && H.S.grow.stage == null)) H.resync();
    if (H.decorChanged() || !Array.isArray(H.S.owned)) H.showDecor();
    H.doors.update(dt);
    H.visits.update(dt);
    H.places.update(dt);
    if (H.stairCool > 0) H.stairCool -= dt;
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
        H.pushOutT = H.onDoormatPush() && input.move.z > 0.5 ? H.pushOutT + dt : 0;
        if (H.pushOutT > PUSH_TIME) { H.pushOutT = 0; ctx.services.house.leave(); }
        H.checkStairs();   // M14 계단 꼭대기·구멍
      }
    }

    if (H.inside) {
      if (H.moving) H.updateMoving(dt);
      const now = ctx.services.time?.now?.();
      for (const v of H.views.values()) v.obj?.tick(dt, now);
      H.cur().room.setNight(ctx.services.time?.nightFactor ?? 0);
      // 카메라: player.camera.setBounds 가 없는 예전 player 면 여기서 방 가운데 둘레로 당긴다
      if (!player.camera?.setBounds) {
        const f = ctx.focus, cam = ctx.camera, box = H.cur().cam;
        const cx = clamp(f.x, box.x0, box.x1), cz = clamp(f.z, box.z0, box.z1);
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
