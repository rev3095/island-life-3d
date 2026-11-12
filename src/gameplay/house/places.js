// 도토리상점·박물관 실내 (실내 검수 보드 interiors — RM-08 상점 D69-A · RM-09 박물관 D70-A · 기증품 D71-A).
//  - 방 배치는 assets/interior/places/<shop|museum>.json (모양은 placedata.js 맨 위). 상점 x = 580, 박물관 x = 620 (room.js PLACE_ROOMS).
//  - 들어가기는 town 이 정한다: 문 앞 행동 키(town:shop · town:museum, 우선순위 90)가 영업 중이면 house.places.enter(kind). 문 쪽으로 밀기는 여기서 하되
//    town.placeRule(kind) 이 'open' 일 때만. 나가기는 문 매트에서 행동 키(90) 또는 아래로 밀기. 드나드는 동작은 door.js (내 집·주민 집과 같다).
//  - 상점: 진열 받침·진열대에 오늘의 물건(economy.stockGroups — 가구 2 · 도구 · 꽃씨 · 묘목)을 진짜 모델로. 날마다 들어갈 때 다시 놓는다.
//  - 박물관: 긴 수조(물고기)·곤충 유리 상자·화석 받침. 아이템 표 순서로 자리가 정해져 있고, 기증한 것만 그 자리에 아이템 모델(assets/items)이 놓인다.
//  - 계산대·진열 받침·수조 같은 붙박이는 가구와 같은 빌더로 만든 모델 assets/furniture/fixtures (FU-35–42, 아이템 표 밖). 배치의 fu 로 고르고,
//    모델을 못 읽으면 배치의 box·color 로 임시 상자(케이스는 코드 상자)를 그린다.
//  - 사양(ctx.quality)이 낮음·매우 낮음이면 배치의 deco 소품·수조 물·물풀 장식을 숨기고, 매우 낮음이면 전시 물고기가 움직이지 않는다 (그림자·외곽선은 render 가 사양대로 끈다).
//  - 주인(밤톨·느루)을 계산대·안내대 뒤에 세우는 일은 town 이 한다 (keepers.js 가 info(kind).keeper 를 본다). 들고 날 때 place:enter / place:leave { place }.
// 상태: state.house.place = 실내에서 저장했으면 'shop'|'museum' (이어하기).
import { boxOf, moveCircle, inBox } from './grid.js';
import { PLACE_ROOMS, buildRoom, wallMount, cornerOf, cameraBox, CAMERA_CURVE } from './room.js';
import { resolveFurniture, FACE, DEFAULT } from './interior.js';
import { PLACE_FILES, PLACE_KINDS, PLACE_BUILDING, EXHIBIT_KINDS, MUSEUM_CATS, FIXTURE_BASE, sizeOf, doorOf, doormatOf, boundsOf, blockersOf, exhibitPlan, stockPlan } from './placedata.js';
import { createFurnitureKit } from './furniture.js';
import { patternTexture } from './pattern.js';
import { createMuseumHalls } from './museum-hall.js';   // 요청 9: 박물관 로비 아치로 들어가는 관 여섯 (RM-25–30)

const PUSH_TIME = 0.2;
const WALL_Y = 1.15;                    // 임시 벽 가구 아래 끝 높이 (visit.js 와 같다)
const ITEM_INDEX = 'assets/items/index.json';
const EXHIBIT_MAX = { fish: 0.8, bug: 0.42, fossil: 0.58 };   // 전시 모델 가장 긴 변 (m) — 작으면 1.8배까지 키우고 넘으면 줄인다
/** 붙박이 케이스 모델에서 사양 낮음·매우 낮음이면 숨기는 재질 (물·물풀·돌·거품·잔가지·낙엽) */
const CASE_DECO = new Set(['tankWater', 'seaweed', 'rock', 'bubble', 'twig', 'leafDark']);
const CASE_LOOK = {
  tank: { glass: '#CDEBF5', fill: '#7EC3DD', fillOpacity: 0.32, floor: '#E9D7A8', frame: '#7A5A3E' },
  terrarium: { glass: '#DDEFE4', fill: null, floor: '#9CCB7A', soil: '#8B6B4A', frame: '#7A5A3E' },
};

export async function createPlaces(ctx, { H, kit, interior, doors, toast, saveSoon }) {
  const { THREE, scene, events, state, materials } = ctx;
  const world = ctx.services.world, player = ctx.services.player;
  const S = state.house;
  const P = { where: null, busy: false, pushT: 0, pushOutT: 0, clock: 0 };
  const rooms = {};
  /** 사양 낮음·매우 낮음: 작은 장식은 뺀다 */
  const light = () => ctx.quality === 'low' || ctx.quality === 'min';
  function applyQuality(R) {
    const lite = light();
    for (const o of R.objs) if (o.deco) o.root.visible = !lite;
    for (const c of R.cases) c.group.traverse(m => { if (m.userData.deco) m.visible = !lite; });
  }
  events.on('quality:changed', () => { for (const R of Object.values(rooms)) if (R.room) applyQuality(R); });

  // 붙박이 모델 목록 (없거나 못 읽으면 임시 상자로)
  const fixtures = createFurnitureKit(ctx, { base: FIXTURE_BASE });
  await fixtures.load().catch(e => console.warn('[house] 붙박이 목록을 못 읽었어요 (임시 상자로)', e));
  const models = () => [...kit.list, ...fixtures.list];
  const makerOf = item => (fixtures.info(item) ? fixtures : kit);

  await Promise.all(PLACE_KINDS.map(async (kind, i) => {
    try { rooms[kind] = makePlace(kind, await ctx.assets.loadJSON(PLACE_FILES[i])); }
    catch (e) { console.warn('[house] 실내 배치를 못 읽었어요', kind, e); }
  }));
  // 요청 9 박물관 관: 로비(rooms.museum) 벽 아치 → 관 RM-25–30. 관 안에서도 P.where 는 'museum'
  const halls = rooms.museum ? await createMuseumHalls(ctx, { H, P, kit, fixtures, interior, doors, saveSoon, lobby: () => rooms.museum, free: () => free() })
    .catch(e => { console.warn('[house] 박물관 관을 못 만들었어요', e); return null; }) : null;

  /** 방 하나의 자리·충돌 (짓기는 처음 들어갈 때) */
  function makePlace(kind, spec) {
    const origin = PLACE_ROOMS[kind], [w, d] = sizeOf(spec);
    const corner = cornerOf(origin, w, d);
    const list = (spec.furniture ?? []).map((e, i) => resolveFurniture(e, { models: models() }, i));
    const R = { kind, spec, origin, w, d, corner, x0: corner.x0, z0: corner.z0, list, room: null, ready: null, objs: [], shown: [], shownKey: null, cases: [] };
    // 사양이 낮아 deco 소품을 숨기면 충돌에서도 뺀다 (보이지 않는 것에 부딪히지 않게)
    const all = blockersOf(spec, list), lite = blockersOf(spec, list.filter(r => !r.entry.deco)), bounds = boundsOf(spec);
    const blockers = () => (light() ? lite : all);
    const local = (x, z) => ({ lx: x - R.x0, lz: z - R.z0 });
    const onRug = (lx, lz) => list.some(r => r.layer === 'rug' && inBox(boxOf(r.rec, r.footprint), lx, lz, -0.1));
    world.addZone({
      contains: (x, z) => Math.abs(x - origin.x) < w && Math.abs(z - origin.z) < d,
      collide(fx, fz, nx, nz, r) {
        const p = moveCircle(blockers(), bounds, fx - R.x0, fz - R.z0, nx - R.x0, nz - R.z0, r ?? 0.26);
        return { x: p.x + R.x0, z: p.z + R.z0 };
      },
      heightAt: (x, z) => { const { lx, lz } = local(x, z); return onRug(lx, lz) ? 0.03 : 0; },
      groundAt: () => R.room?.floor?.step ?? 'wood',
      isWalkable(x, z) {
        const { lx, lz } = local(x, z);
        if (lx < bounds.x0 || lz < bounds.z0 || lx > bounds.x1 || lz > bounds.z1) return false;
        return !blockers().some(b => inBox(b, lx, lz));
      },
    });
    return R;
  }

  // ── 행동 키: 문 매트에서 나가기, 실내에선 도구를 쓰지 않는다 (주민 방과 같은 자리 20) ──
  const I = ctx.services.gameplay.interactions;
  const free = () => !P.busy && !H.busy && !doors.busy;
  I.add({ name: 'house-place-out', intent: 'action', priority: 90, label: '나가기', test: () => (free() && P.where && onDoormat() ? true : null), run: () => leave() });
  I.add({ name: 'house-place-idle', intent: 'action', priority: 20, label: '', test: () => (P.where ? true : null), run: () => {} });
  // P45 (동물의 숲처럼): 가게 진열품 앞에서 바로 「보기」 → 설명·값 → 사기, 박물관 전시물 앞에서 「살펴보기」 → 설명판. 계산대 말 걸기(90)·문(90)보다 아래
  I.add({ name: 'house-place-look', intent: 'action', priority: 91,   // 91: 계산대 옆 견본 판(B-21) 앞에서도 「보기」 (진열품이 바로 앞에 있을 때만 뜸)
     label: t => (t.meta.exhibit ? '살펴보기' : '보기'), test: () => (free() && P.where ? shownInFront() : null), run: t => lookAt(t) });

  /** 플레이어 앞(0.9칸)에 있는 진열품·전시물 → shown 하나 | null */
  function shownInFront(reach = 0.9) {
    const R = rooms[P.where];
    if (!R?.shown?.length) return null;
    const f = player.facing, px = player.position.x - Math.sin(f) * reach, pz = player.position.z - Math.cos(f) * reach;
    let best = null, bestD = 0.75;
    for (const o of R.shown) {
      if (!o.meta) continue;
      const d = Math.hypot(o.meta.x - px, o.meta.z - pz);
      if (d < bestD) { best = o; bestD = d; }
    }
    return best;
  }
  const fmt = n => Number(n ?? 0).toLocaleString('ko-KR');
  async function lookAt(o) {
    const ui = ctx.services.ui, d = ctx.services.data, m = o.meta;
    if (!ui?.confirm || !d) return;
    P.busy = true;
    try {
      if (m.exhibit) {   // 박물관 설명판
        const it = d.items.get(m.id);
        const CAT = { fish: '물고기', bug: '곤충', fossil: '화석' };
        const when = [it?.place, it?.time, it?.season].filter(Boolean).join(' · ');
        await ui.confirm({ title: `${CAT[m.group] ?? ''} · ${it?.name ?? m.id}`, icon: it?.icon, text: `${it?.desc ?? ''}${when ? `

📍 ${when}` : ''}

— 기증해 준 ${ctx.services.intro?.fill?.('{player}') ?? '친구'}에게 고마워요.`, buttons: [{ label: '다 봤어요', value: true, primary: true }], cancelValue: true });
        return;
      }
      if (m.group === 'decor') {   // B-21 견본 판: 벽지·바닥 골라 사기 (상점 창 buyDecor 와 같은 규칙)
        const inter = ctx.services.house?.interior, w = d.wallet;
        const NAME = { wallpaper: '벽지', floor: '바닥' };
        const opts = (m.decor ?? []).map(x => ({ label: `${NAME[x.kind]} ${x.name}${inter?.owns?.(x.slug) ? ' (가짐)' : ` 🌰 ${fmt(x.price)}`}`, value: x.slug }));
        const pick = await ui.confirm({ title: '오늘의 벽지·바닥', icon: '🧱', text: '도토리상점에서 오늘 파는 벽지와 바닥이에요.\n산 것은 집 안에서 벽·바닥을 보고 행동 키로 바꿀 수 있어요.', buttons: [...opts, { label: '그만둘래요', value: false }], cancelValue: false });
        const x = (m.decor ?? []).find(v => v.slug === pick);
        if (!x || !inter || !w) return;
        if (inter.owns(x.slug)) { ui.toast?.(`이미 가진 ${NAME[x.kind]}예요. 집에서 바꿀 수 있어요`, '🧱'); return; }
        const how = await ui.confirm({ title: `${NAME[x.kind]} ${x.name}`, icon: '🧱', text: `🌰 ${fmt(x.price)}에 살까요?`, buttons: [{ label: '사서 바로 붙일게요', value: 'apply', primary: true }, { label: '사기만 할게요', value: 'buy' }, { label: '그만둘래요', value: false }], cancelValue: false });
        if (!how) return;
        if (!w.spend(x.price)) { ui.toast?.('도토리가 모자라요', '🌰'); return; }
        if (!inter.add(x.slug)) { w.add(x.price); return; }
        if (how === 'apply') inter.apply?.(x.kind, x.slug);
        ctx.events.emit('sfx', { name: 'acorn' });
        ui.toast?.(how === 'apply' ? `${NAME[x.kind]}를 ${x.name}(으)로 바꿨어요!` : `${NAME[x.kind]} ${x.name} 샀어요!`, '🧱');
        return;
      }
      if (m.group === 'clothes') {   // 옷: 입어 본 모습 → 사기 (상점 창 「오늘의 옷」 과 같은 규칙)
        const O = ctx.services.outfit, c = O?.today?.().find(x => x.id === m.id);
        if (!O || !c) return;
        if (O.owns(c.id)) { ui.toast?.(`이미 옷장에 있어요. 집 옷장에서 갈아입을 수 있어요`, '👕'); return; }
        O.preview({ [c.slot]: c.id });
        const v = await ui.confirm({ title: c.name, icon: c.thumb ?? '👕', text: `${c.slotName} · 🌰 ${fmt(c.buy)}
산 옷은 집 옷장에 걸려요.`, buttons: [{ label: '사서 바로 입을게요', value: 'wear', primary: true }, { label: '사기만 할게요', value: 'buy' }, { label: '그만둘래요', value: false }], cancelValue: false });
        if (!v) { O.revert(); return; }
        const r = O.buy(c.id);
        if (r.result !== 'ok') { O.revert(); ui.toast?.(r.result === 'money' ? '도토리가 모자라요' : '살 수 없는 옷이에요', '🌰'); return; }
        if (v === 'wear') await O.wear({ [c.slot]: r.info.id }, { spin: true }); else O.revert();
        ctx.events.emit('sfx', { name: 'acorn' });
        ui.toast?.(v === 'wear' ? `${c.name} 사서 입었어요!` : `${c.name} 샀어요! 옷장에 걸어 둘게요`, c.thumb ?? '👕');
        if (r.gift) setTimeout(() => ui.toast?.('밤톨이 옷장을 덤으로 줬어요 — 집에 놓고 「갈아입기」 해 봐요', '🚪'), 900);
        return;
      }
      const it = d.items.get(m.id);
      if (!it) return;
      const price = it.buy ?? 0;
      const v = await ui.confirm({ title: it.name, icon: it.icon, text: `${it.desc ? `${it.desc}

` : ''}${it.sizeText ? `크기 ${it.sizeText}` : ''}${it.from ? `${it.sizeText ? ' · ' : ''}구하는 곳 ${it.from}` : ''}

🌰 ${fmt(price)}에 살까요?`, buttons: [{ label: '살게요', value: true, primary: true }, { label: '그만둘래요', value: false }], cancelValue: false });
      if (!v) return;
      const fits = d.inventory?.canFit ? d.inventory.canFit(m.id, 1) > 0 : !d.inventory?.isFull?.();
      if (!fits) { ui.toast?.('가방이 꽉 찼어요', '🎒'); return; }
      if (!d.wallet.spend(price)) { ui.toast?.('도토리가 모자라요', '🌰'); return; }
      if (!(d.inventory.add(m.id, 1) > 0)) { d.wallet.add(price); ui.toast?.('가방이 꽉 찼어요', '🎒'); return; }
      ctx.events.emit('sfx', { name: 'acorn' });
      ui.toast?.(`${it.name} 샀어요!`, it.icon);
    } finally { P.busy = false; }
  }

  function onDoormat(margin = 0.85) {
    const R = rooms[P.where];
    if (!R || halls?.inside) return false;   // 요청 9: 박물관 관 안(z 40+)은 로비 문 매트가 아니다 — 관 문 매트는 museum-hall.js
    const m = doormatOf(R.spec), p = player.position;
    return Math.abs(p.x - (R.x0 + m.lx)) < 0.75 && p.z - R.z0 > R.d - margin;
  }

  // ── 짓기: 방·가구·케이스 ──
  function build(R) {
    if (R.ready) return R.ready;
    const sp = interior.specs;
    R.room = buildRoom(ctx, {
      origin: R.origin, size: [R.w, R.d], windows: R.spec.windows ?? [], door: doorOf(R.spec), name: `place-${R.kind}`,
      wallpaper: sp.get(R.spec.wallpaper) ?? sp.get(DEFAULT.wallpaper), floor: sp.get(R.spec.floor) ?? sp.get(DEFAULT.floor), frame: interior.frame,
    });
    R.room.group.visible = false;
    scene.add(R.room.group);
    const cases = Promise.all((R.spec.cases ?? []).map(c => caseFixture(R, c).catch(e => { console.warn('[house] 케이스 모델을 못 만들었어요 → 코드 상자', c.fixture, e); return null; })
      .then(made => made ?? buildCase(R, c)))).then(list => { R.cases = list; });
    R.ready = Promise.all([cases, ...R.list.map(async r => {
      try { return r.real ? await realPiece(R, r) : placeholder(R, r); }
      catch (e) { console.warn('[house] 실내 가구를 못 만들었어요 → 임시 상자', r.key, e); return placeholder(R, r); }
    })]).then(([, ...objs]) => { R.objs = objs.filter(Boolean); for (const o of R.objs) R.room.group.add(o.root); applyQuality(R); });
    return R.ready;
  }
  function poseRoot(R, root, r) {
    if (Array.isArray(r.entry.scale)) root.scale.set(...r.entry.scale);   // 계산대: 주인 키(0.8)에 맞춰 낮춘다
    if (r.rec.wall) {
      const m = wallMount(r.rec.wall, r.rec.slot, R.corner);
      root.position.set(m.x, 0, m.z);
      root.rotation.y = m.rotY;
    } else {
      const b = boxOf(r.rec, r.footprint);
      root.position.set(R.x0 + b.cx, 0, R.z0 + b.cz);
      root.rotation.y = r.rec.rot * Math.PI / 2;
    }
  }
  async function realPiece(R, r) {
    const obj = await makerOf(r.item).make(r.item, { variant: r.entry.variant ?? null });
    poseRoot(R, obj.root, r);
    obj.deco = !!r.entry.deco;
    return obj;
  }
  /** 긴 수조·곤충 유리 상자 붙박이 모델 (FU-41·42) → { group, dispose } | null (모델이 없으면 코드 상자로) */
  async function caseFixture(R, c) {
    const m = c.fixture && fixtures.list.find(x => x.slug === c.fixture);
    if (!m) return null;
    const obj = await fixtures.make(m.item);
    obj.root.position.set(R.x0 + (c.lx0 + c.lx1) / 2, 0, R.z0 + (c.lz0 + c.lz1) / 2);
    obj.root.traverse(o => { if (o.isMesh && !o.userData.outline && CASE_DECO.has(String(o.material?.name ?? '').split('@')[0])) o.userData.deco = true; });
    R.room.group.add(obj.root);
    return { group: obj.root, dispose: () => obj.dispose() };
  }
  /** 모델이 아직 없는 가구 (FU-35 받침 등): box [가로, 깊이, 높이] 색 상자 — visit.js 와 같은 모양 */
  function placeholder(R, r) {
    const [bw0, bd0, bh] = Array.isArray(r.entry.box) ? r.entry.box : [r.footprint[0], r.footprint[1], 0.8];
    const [bw, bd] = Array.isArray(r.entry.look) ? r.entry.look : [bw0, bd0];   // look = 보이는 가로·깊이 (발자국 box 보다 가늘게 — 화석 받침)
    const root = new THREE.Group();
    root.name = `placeholder:${r.fu ?? r.key}`;
    root.userData.placeholder = r.fu ?? r.key;
    const mat = materials.toonMaterial(r.entry.color ?? '#C9B79C', { name: 'placeholder' });
    const w = r.rec.wall ? bw : bw * 0.92, d = r.rec.wall ? bd : bd * 0.92;
    const geo = new THREE.BoxGeometry(w, bh, d);
    geo.translate(0, (r.rec.wall ? WALL_Y : 0) + bh / 2, r.rec.wall ? d / 2 : 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    poseRoot(R, root, r);
    return { root, deco: !!r.entry.deco, tick() {}, dispose() { root.removeFromParent(); geo.dispose(); mat.dispose(); } };
  }

  /** 긴 수조·곤충 유리 상자: 받침 + 바닥(모래·풀) + 물 + 유리 + 테두리 (모델이 생기기 전 FU-35 같은 임시 모양) */
  function buildCase(R, c) {
    const look = CASE_LOOK[c.kind] ?? CASE_LOOK.tank;
    const g = new THREE.Group();
    g.name = `case:${c.cat}`;
    const w = c.lx1 - c.lx0, d = c.lz1 - c.lz0, h = c.h ?? 1.5;
    g.position.set(R.x0 + (c.lx0 + c.lx1) / 2, 0, R.z0 + (c.lz0 + c.lz1) / 2);
    const mats = [];
    const box = (bw, bh, bd, y, color, { opacity = 1, name = 'caseFrame', shadow = true, x = 0, z = 0, deco = false } = {}) => {
      const m = materials.toonMaterial(color, { name });
      if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
      mats.push(m);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
      mesh.position.set(x, y + bh / 2, z);
      mesh.castShadow = shadow && opacity >= 1;
      mesh.receiveShadow = true;
      if (opacity < 1) mesh.renderOrder = 2;
      mesh.userData.deco = deco;
      g.add(mesh);
      return mesh;
    };
    box(w, 0.1, d, 0, look.frame);                                                // 받침
    if (look.soil) box(w - 0.08, 0.06, d - 0.08, 0.1, look.soil);
    box(w - 0.08, 0.05, d - 0.08, look.soil ? 0.16 : 0.1, look.floor);            // 모래·풀
    if (look.fill) box(w - 0.1, h - 0.3, d - 0.1, 0.15, look.fill, { opacity: look.fillOpacity, name: 'caseWater', deco: true });   // 물 = 반투명 한 겹 더 (사양 낮으면 뺀다)
    if (c.kind === 'terrarium') for (const lv of (c.levels ?? []).slice(1)) box(w - 0.1, 0.03, d - 0.1, lv - 0.04, look.glass, { opacity: 0.45, name: 'caseGlass' });   // 위층 유리 선반
    box(w, h - 0.1, d, 0.1, look.glass, { opacity: 0.22, name: 'caseGlass' });   // 유리
    // 위 테두리 (막대 넷 — 뚜껑으로 덮으면 위에서 보는 카메라에 안이 안 보인다) · 모서리 기둥
    for (const sz of [-1, 1]) box(w + 0.04, 0.06, 0.06, h, look.frame, { z: sz * (d / 2) });
    for (const sx of [-1, 1]) box(0.06, 0.06, d + 0.04, h, look.frame, { x: sx * (w / 2) });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, h - 0.1, 0.05, 0.1, look.frame, { x: sx * (w / 2), z: sz * (d / 2) });
    // 물풀·잔가지 몇 개 (자리 표시 — 늘 같다)
    const deco = materials.toonMaterial(c.kind === 'tank' ? '#5FA36B' : '#8A6A4A', { name: 'caseDeco' });
    mats.push(deco);
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6, side = i % 2 ? 1 : -1;
      const geo = c.kind === 'tank' ? new THREE.ConeGeometry(0.05, 0.32 + (i % 3) * 0.1, 5) : new THREE.CylinderGeometry(0.018, 0.024, 0.5, 5);
      const m = new THREE.Mesh(geo, deco);
      m.position.set(side * (w / 2 - 0.16), 0.3, -d / 2 + 0.2 + t * (d - 0.4));
      if (c.kind !== 'tank') m.rotation.z = side * 0.5;
      m.userData.deco = true;
      g.add(m);
    }
    R.room.group.add(g);
    return { group: g, dispose() { g.traverse(o => o.geometry?.dispose()); mats.forEach(m => m.dispose()); g.removeFromParent(); } };
  }

  // ── 진열·전시 (들어갈 때마다 맞춘다) ──
  let itemIndex = null;
  const templates = new Map();
  const loadItemIndex = () => (itemIndex ??= ctx.assets.loadJSON(ITEM_INDEX)
    .then(j => new Map(j.models.flatMap(m => m.items.map(x => [x.item, m]))))
    .catch(() => { itemIndex = null; return new Map(); }));
  /** 아이템 id → 모델 사본 (손에 들어 보이는 모델과 같은 assets/items) | null */
  async function itemModel(id) {
    const m = (await loadItemIndex()).get(id);
    if (!m) return null;
    if (!templates.has(m.slug)) {
      const job = ctx.assets.loadModel(`assets/items/models/${m.slug}`).then(gltf => {
        const { scene: model } = ctx.assets.instantiate(gltf);
        materials.applyToonStyle(model, { spec: { style: m.style ?? {} } });
        model.name = `item:${m.slug}`;
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        return { model, size };
      });
      job.catch(() => templates.delete(m.slug));
      templates.set(m.slug, job);
    }
    try { const t = await templates.get(m.slug); return { root: t.model.clone(), size: t.size }; } catch { return null; }
  }
  function clearShown(R) {
    for (const o of R.shown) o.dispose();
    R.shown = [];
  }
  /** 지금 보여 줄 것의 열쇠 (같으면 다시 놓지 않는다) */
  function shownKey(R) {
    if (!EXHIBIT_KINDS.includes(R.kind)) return `${R.kind}:${JSON.stringify(stockGroupsOf(R.kind))}:${R.spec.sample ? todayDecor().map(d => d.slug).join(',') : ''}`;
    const mu = ctx.services.data?.museum;
    return `museum:${MUSEUM_CATS.map(c => (mu?.list?.(c) ?? []).length).join(',')}:${MUSEUM_CATS.map(c => (mu?.list?.(c) ?? []).join('|')).join('/')}`;
  }
  async function refresh(R) {
    const key = shownKey(R);
    if (key === R.shownKey) return;
    R.shownKey = key;
    clearShown(R);
    const jobs = EXHIBIT_KINDS.includes(R.kind) ? exhibitJobs(R) : stockJobs(R);
    const made = (await Promise.all(jobs)).filter(Boolean);
    if (R.shownKey !== key) { made.forEach(o => o.dispose()); return; }   // 그 사이 또 바뀌었다
    R.shown = made;
    for (const o of made) R.room.group.add(o.root);
  }
  /** 진열할 오늘의 물건 묶음: 도토리상점 = economy, M12 달빛 가게·새벽 천막 = night 서비스 */
  function stockGroupsOf(kind) {
    if (kind === 'shop') {   // + 11차 D102-A 옷 진열대 (outfit.today — 옷장에 있는 옷도 진열은 그대로)
      const g = ctx.services.data?.economy?.stockGroups?.() ?? {};
      const clothes = ctx.services.outfit?.today?.().map(c => c.id) ?? [];
      return clothes.length ? { ...g, clothes } : g;
    }
    return ctx.services.night?.stockGroups?.(kind) ?? {};
  }
  /** B-21 오늘의 벽지·바닥 (house.interior.today — 상점 창 「오늘의 벽지·바닥」과 같은 둘) */
  const todayDecor = () => { try { return ctx.services.house?.interior?.today?.() ?? []; } catch { return []; } };
  /**
   * B-21 상점 견본 판: 방 배치 sample { wall, slot } 자리에 나무 틀 판 하나 — 위 칸 오늘의 벽지 · 아래 칸 오늘의 바닥 (무늬 실제 크기대로).
   * 판 앞에서 「보기」 → 벽지·바닥 골라 사기 (lookAt 의 decor 갈래)
   */
  function sampleJob(R) {
    const s = R.spec.sample, today = todayDecor();
    if (!s || !today.length) return [];
    const m = wallMount(s.wall, s.slot, R.corner);
    const g = new THREE.Group();
    g.name = 'place-decor-sample';
    const W = 0.86, H = 0.62, y0 = 0.95;   // 칸 하나 크기 (벽지 위 · 바닥 아래)
    const wood = materials.toonMaterial('#B98A5A', { name: 'wood' });
    const shown = [];
    [today.find(d => d.kind === 'wallpaper'), today.find(d => d.kind === 'floor')].forEach((d, i) => {
      if (!d) return;
      const spec = interior.specs.get(d.slug);
      const geo = new THREE.PlaneGeometry(W, H);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * W, uv.getY(k) * H);   // m 단위 → 무늬 실제 크기
      const mat = materials.toonMaterial('#FFFFFF', { name: 'sample' });
      if (spec?.pattern) { mat.map = patternTexture(THREE, spec, ctx.renderer); mat.needsUpdate = true; }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, y0 + (1 - i) * (H + 0.06) + H / 2, 0.03);
      g.add(mesh);
      shown.push(d);
    });
    const bar = (w, h, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), wood); b.position.set(x, y, 0.02); g.add(b); };
    const top = y0 + 2 * H + 0.12;
    bar(W + 0.1, 0.05, 0, top); bar(W + 0.1, 0.05, 0, y0 - 0.02); bar(W + 0.1, 0.04, 0, y0 + H + 0.03);
    bar(0.05, top - y0 + 0.02, -W / 2 - 0.03, (top + y0) / 2); bar(0.05, top - y0 + 0.02, W / 2 + 0.03, (top + y0) / 2);
    g.position.set(m.x, 0, m.z);
    g.rotation.y = m.rotY;
    const ax = m.x + Math.sin(m.rotY) * 0.05, az = m.z + Math.cos(m.rotY) * 0.05;   // 판 바로 앞 — 「보기」가 잡는 자리
    return [Promise.resolve({ root: g, meta: { id: 'decor-sample', group: 'decor', decor: shown, x: ax, z: az }, tick() {},
      dispose() { g.removeFromParent(); g.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); }); } })];
  }
  function stockJobs(R) {
    const groups = stockGroupsOf(R.kind);
    return [...sampleJob(R), ...stockPlan(R.spec, groups).map(async s => {
      const tag = o => (o ? Object.assign(o, { meta: { id: s.id, group: s.group, x: R.x0 + s.lx, z: R.z0 + s.lz } }) : o);   // P45 진열품 앞 「보기」
      try {
        if (s.group === 'clothes') {   // 11차 옷: 윗옷은 가로대(hang)에 걸고, 모자·신발은 아래 단(y)에
          const m = await ctx.services.outfit?.displayModel?.(s.id);
          if (!m) return null;
          const b = m.size, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
          const top = m.slot === 'top' && s.hang != null;
          m.root.position.set(R.x0 + s.lx - cx, top ? s.hang - b.max.y : s.y - b.min.y, R.z0 + s.lz - cz);
          return tag(m);
        }
        if (s.group === 'furniture' && kit.info(s.id)) {   // 오늘의 가구 (붙박이가 아닌 진짜 가구)
          const obj = await kit.make(s.id);
          const fp = kit.info(s.id).footprint ?? [1, 1];
          obj.root.scale.setScalar(Math.min(1, (s.fit ?? 2) / Math.max(...fp)));
          obj.root.position.set(R.x0 + s.lx, s.y, R.z0 + s.lz);
          // 10차: 벽 가구(액자 등)는 모델이 벽 높이에 떠 있어서 받침 위로 내려 앉힌다 (바닥 가구는 아랫면이 0 이라 그대로)
          if (kit.info(s.id).place === 'wall' || kit.info(s.id).place === 'window') {
            obj.root.updateMatrixWorld(true);
            const box = new ctx.THREE.Box3().setFromObject(obj.root);
            if (Number.isFinite(box.min.y)) obj.root.position.y += s.y - box.min.y;
            if (Number.isFinite(box.min.z)) obj.root.position.z += (R.z0 + s.lz) - (box.min.z + box.max.z) / 2;
          }
          return tag(obj);
        }
        const m = await itemModel(s.id);
        if (!m) return null;
        m.root.position.set(R.x0 + s.lx, s.y, R.z0 + s.lz);
        return tag({ root: m.root, tick() {}, dispose() { m.root.removeFromParent(); } });
      } catch (e) { console.warn('[house] 진열 물건을 못 놓았어요', s.id, e); return null; }
    })];
  }
  function exhibitJobs(R) {
    const data = ctx.services.data, mu = data?.museum;
    const lists = Object.fromEntries(MUSEUM_CATS.map(c => [c, (data?.items?.list?.(c) ?? []).map(it => it.id)]));
    return exhibitPlan(R.spec, lists, id => !!mu?.has?.(id)).filter(e => e.donated).map(async (e, i) => {
      const m = await itemModel(e.id);
      if (!m) return null;
      const k = Math.min(1.8, EXHIBIT_MAX[e.cat] / Math.max(m.size.x, m.size.y, m.size.z, 0.01));
      m.root.scale.setScalar(k);
      const x = R.x0 + e.lx, z = R.z0 + e.lz;
      m.root.position.set(x, e.y, z);
      // 물고기는 옆모습이 보이게 (머리가 동서로), 곤충·화석은 앞(남쪽)을 본다
      const turn = e.cat === 'fish' ? (i % 2 ? Math.PI / 2 : -Math.PI / 2) : (i % 3 - 1) * 0.25;
      m.root.rotation.y = turn;
      const phase = i * 1.7;
      return {
        root: m.root, cat: e.cat, meta: { id: e.id, group: e.cat, x, z, exhibit: true },
        tick() {
          const t = P.clock;
          if (e.cat === 'fish') { m.root.position.y = e.y + Math.sin(t * 1.3 + phase) * 0.04; m.root.rotation.y = turn + Math.sin(t * 0.8 + phase) * 0.18; }
          else if (e.cat === 'bug') m.root.rotation.y = turn + Math.sin(t * 0.6 + phase) * 0.1;
        },
        dispose() { m.root.removeFromParent(); },
      };
    });
  }
  // 박물관 안에서 기증하면 바로 전시 (창이 닫히면 보인다)
  events.on('museum:changed', () => { const R = rooms.museum; if (R?.room && P.where === 'museum') refresh(R); });

  // ── 드나들기 ──
  const roomDoor = R => { const m = doormatOf(R.spec); return { x: R.x0 + m.lx, front: R.z0 + m.front, entry: R.z0 + m.entry }; };
  const keeperSpot = R => { const k = R.spec.keeper; return k ? { x: R.x0 + k.lx, z: R.z0 + k.lz, facing: FACE[k.face] ?? Math.PI } : null; };
  const roomBox = R => ({ x0: R.x0, z0: R.z0, x1: R.x0 + R.w, z1: R.z0 + R.d });

  async function enter(kind) {
    const R = rooms[kind];
    if (!R || P.where || !free() || H.inside || H.visits?.where) return false;
    P.busy = H.busy = true;
    try {
      await ctx.services.night?.firstVisit?.(kind);   // M12 s20·s21: 밤 가게 첫 방문이면 문 앞 장면이 끝날 때까지
      await build(R);
      await refresh(R);
      await doors.through({ dir: 'in', place: world.places?.[kind], kind: PLACE_BUILDING[kind], room: roomDoor(R),
        arrive: s => goIn(kind, { lx: s.x - R.x0, lz: s.z - R.z0, facing: s.facing }) });
    } finally { P.busy = H.busy = false; }
    return true;
  }

  async function leave() {
    const R = rooms[P.where];
    if (!R || !free()) return false;
    P.busy = H.busy = true;
    try {
      await doors.through({ dir: 'out', place: world.places?.[R.kind], kind: PLACE_BUILDING[R.kind], room: roomDoor(R), arrive: s => goOut({ spot: s }) });
    } finally { P.busy = H.busy = false; }
    return true;
  }

  function goIn(kind, { lx, lz, facing }) {
    const R = rooms[kind];
    P.where = kind;
    S.place = kind;
    R.room.group.visible = true;
    applyQuality(R);
    player.camera?.setBounds?.(cameraBox(R.origin, R.w, R.d));
    player.camera?.setCurveScale?.(CAMERA_CURVE);
    player.teleport(R.x0 + lx, R.z0 + lz, facing);
    ctx.services.time?.setIndoor?.(true);
    ctx.services.audio?.bgm?.(kind);
    const k = keeperSpot(R);
    events.emit('place:enter', { place: kind, name: R.spec.name ?? '', keeper: k, room: roomBox(R) });
    saveSoon(0.5);
  }

  /** quiet: 저장 불러오기 등으로 밖에 나와 있을 때 (자리를 옮기지 않는다). spot = 섬에 설 곳 (door.js — 문간) */
  function goOut({ quiet = false, spot = null } = {}) {
    const kind = P.where, R = rooms[kind];
    if (kind === 'museum') halls?.drop();   // 요청 9: 관 안에서 밖으로 옮겨졌을 때
    P.where = null;
    S.place = null;
    player.camera?.setBounds?.(null);   // 범위를 먼저 풀어야 순간이동 때 카메라가 바로 섬으로 온다
    player.camera?.setCurveScale?.(1);
    if (!quiet) {
      const d = world.places?.[kind]?.door ?? world.places?.spawn ?? { x: 0, z: 0 };
      const s = spot ?? { x: d.x, z: d.z + 0.15, facing: Math.PI };
      player.teleport(s.x, s.z, s.facing ?? Math.PI);
    }
    if (R?.room) R.room.group.visible = false;
    ctx.services.time?.setIndoor?.(false);
    ctx.services.audio?.bgm?.('auto');
    events.emit('place:leave', { place: kind });
    saveSoon(0.5);
  }

  /** 저장에서 이어하기: 실내에서 끝냈으면 다시 그 안에 (서 있던 자리가 걸을 수 없으면 문 매트) */
  async function resume(kind) {
    const R = rooms[kind];
    if (!R) { S.place = null; return; }
    await build(R);
    await refresh(R);
    const p = state.player, lx = p.x - R.x0, lz = p.z - R.z0;
    const B = boundsOf(R.spec), m = doormatOf(R.spec);
    const ok = Number.isFinite(lx) && lx > B.x0 && lx < B.x1 && lz > B.z0 && lz < B.z1 && blockersOf(R.spec, R.list).every(b => !inBox(b, lx, lz));
    const p0 = { x: p.x, z: p.z, facing: p.facing };
    goIn(kind, ok ? { lx, lz, facing: p.facing ?? 0 } : { lx: m.lx, lz: m.entry, facing: 0 });
    if (kind === 'museum' && halls) await halls.resume(p0);   // 요청 9: 관 안에서 저장했으면 그 관으로
  }

  function update(dt) {
    P.clock += dt;
    const input = ctx.input;
    const blocked = ctx.services.ui?.isBlocking?.() || input.enabled === false;
    const R = rooms[P.where];
    // 저장 불러오기·처음부터 하기로 플레이어가 방 밖에 옮겨졌으면 조용히 나온다
    if (R && free() && !halls?.inside) {   // 요청 9: 박물관 관 안은 로비 밖이어도 실내
      const p = player.position;
      if (Math.abs(p.x - R.origin.x) > R.w || Math.abs(p.z - R.origin.z) > R.d) goOut({ quiet: true });
    }
    if (S.place !== P.where && !P.busy) S.place = P.where ?? null;
    if (free() && !blocked && !H.moving && !H.inside && !H.visits?.where) {
      const p = player.position;
      if (!P.where) {
        // 문 쪽으로 밀어서 들어가기 (town 이 연 곳만 — 상점은 영업시간)
        let hit = null;
        for (const kind of PLACE_KINDS) {
          const d = world.places?.[kind]?.door;
          if (d && rooms[kind] && Math.abs(p.x - d.x) < 0.45 && p.z < d.z - 0.2 && p.z > d.z - 1.0) hit = kind;
        }
        const rule = hit && (PLACE_BUILDING[hit] === hit ? ctx.services.town?.placeRule?.(hit) ?? 'open' : ctx.services.night?.placeRule?.(hit) ?? null);   // M12: 밤 가게는 night 가 연다
        const open = rule === 'open';
        P.pushT = open && input.move.z < -0.5 ? P.pushT + dt : 0;
        if (P.pushT > PUSH_TIME) { P.pushT = 0; enter(hit); }
      } else {
        P.pushOutT = onDoormat(0.5) && input.move.z > 0.5 ? P.pushOutT + dt : 0;
        if (P.pushOutT > PUSH_TIME) { P.pushOutT = 0; leave(); }
      }
    }
    if (R?.room) {
      const now = ctx.services.time?.now?.();
      for (const o of R.objs) o.tick(dt, now);
      if (ctx.quality !== 'min') for (const o of R.shown) o.tick?.(dt, now);   // 매우 낮음: 전시 물고기·곤충은 가만히
      R.room.setNight(ctx.services.time?.nightFactor ?? 0);
    }
    halls?.update(dt);
  }

  const api = {
    enter, leave,
    get where() { return P.where; },
    /** 실내 자리 (월드): keeper 주인이 설 곳 { x, z, facing } · talk 말 거는 곳 { x, z } · doormat · room 범위. 방 배치가 없으면 null */
    info(kind) {
      const R = rooms[kind];
      if (!R) return null;
      const t = R.spec.talk, m = doormatOf(R.spec);
      return { keeper: keeperSpot(R), keeperSlug: R.spec.keeper?.slug ?? null, talk: t ? { x: R.x0 + t.lx, z: R.z0 + t.lz } : null, doormat: { x: R.x0 + m.lx, z: R.z0 + m.lz }, room: roomBox(R), name: R.spec.name ?? '' };
    },
    /** 개발용: 지금 진열·전시된 것 수, 임시 상자, 붙박이 모델 목록 */
    shown: kind => (rooms[kind]?.shown ?? []).length,
    /** 진열품·전시물 자리 (P45 「보기」·「살펴보기」 — 봇·점검이 앞에 서 볼 곳) → [{ id, group, x, z, exhibit? }] */
    shownSpots: kind => (rooms[kind]?.shown ?? []).filter(o => o.meta).map(o => ({ ...o.meta })),
    fixtures: () => fixtures.list.map(m => m.slug),
    /** 요청 9 박물관 관 (museum-hall.js api) | null */
    halls: halls?.api ?? null,
    placeholders: kind => (rooms[kind]?.list ?? []).filter(r => !r.real).map(r => r.fu ?? r.key),
  };

  return {
    get where() { return P.where; },
    enter, leave, resume, update, api,
    doormat: () => (P.where ? (halls?.inside ? halls.doormat() : api.info(P.where).doormat) : null),
  };
}
