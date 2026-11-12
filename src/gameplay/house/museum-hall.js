// 박물관 관 여섯 (요청 9 재단장·증축): 로비(RM-09, places.js 가 짓는 박물관 실내)의 벽 아치로 걸어 들어가는 관 RM-25–30.
//  - 규칙·자리 계산은 museum-hall-data.js (node 로 테스트). 여기는 짓기·드나들기·전시·안내판.
//  - places.js 에는 짧은 고리만 (만들기 · update · 실내 밖 판정 · 이어 하기 · api). 관 안에 있는 동안도 places 의 where 는 'museum' 이라
//    실내 조명·박물관 음악·도구 막기·저장 이어 하기가 그대로다. state.house.hall = 지금 관 (이어 하기).
//  - 드나들기는 door.js through() 그대로 (place 없이 → 원형 전환만): 로비 아치 앞 행동 키(90) 또는 아치 쪽으로 밀기 → 관 문 매트,
//    관 문 매트에서 행동 키·아래로 밀기 → 로비의 그 아치 앞.
//  - 아치 옆 안내판(행동 키 91) = 그 관 설명 창 (기증은 로비 안내대의 느루와 말할 때만 — keepers.js 그대로).
//  - 전시: 기증한 것만 제자리에 (아이템 표 순서). 수조·온실 상자는 줄(line), 받침·진열장은 spots, 미술 그림은 액자(frames) 캔버스에 아이콘 그림.
//    분류에 아이템이 없으면(sea·art 아직) 「곧 열려요」 — 관은 비어 있고 안내판·들어갈 때 알림.
//  - 별자리관: 액자 열여덟에 gameplay/stars 가 찍은 별자리 그림(2D 캔버스 → 텍스처), 가운데 투영기 위에 별 점 구름(Points 하나, 매우 낮음이면 숨김).
//  - 사양 낮음·매우 낮음: deco 소품·수조 물 장식 숨김(places 와 같은 규칙), 매우 낮음은 전시물이 가만히.
import { boxOf, moveCircle, inBox } from './grid.js';
import { buildRoom, wallMount, cornerOf, cameraBox, CAMERA_CURVE } from './room.js';
import { resolveFurniture, DEFAULT } from './interior.js';
import { sizeOf, doorOf, doormatOf, boundsOf, blockersOf } from './placedata.js';
import { HALL_FILES, HALLS, HALL_NAME, HALL_ICON, hallOrigin, hallPlan, hallStatus, archesOf, framesOf, frameSpot, signText, wallPoint, ARCH, FRAME_Y } from './museum-hall-data.js';
import { CONSTELLATIONS, SEASON_NAME } from '../../sky/starmap.js';

const PUSH_TIME = 0.2;
const ITEM_INDEX = 'assets/items/index.json';
const EXHIBIT_MAX = { fish: 0.7, bug: 0.42, fossil: 0.58, sea: 0.62, art: 0.62 };
const CASE_DECO = new Set(['tankWater', 'seaweed', 'rock', 'bubble', 'twig', 'leafDark']);
const CAT_NAME = { fish: '물고기', bug: '곤충', fossil: '화석', sea: '바다 생물', art: '미술품' };

export async function createMuseumHalls(ctx, { H, P, kit, fixtures, interior, doors, saveSoon, lobby, free }) {
  const { THREE, materials, events, state } = ctx;
  const world = ctx.services.world, player = ctx.services.player;
  const light = () => ctx.quality === 'low' || ctx.quality === 'min';
  const models = () => [...kit.list, ...fixtures.list];
  const makerOf = item => (fixtures.info(item) ? fixtures : kit);
  const Hs = { where: null, busy: false, pushT: 0, pushOutT: 0, clock: 0, arches: null, lobbyKey: null };
  const halls = {};

  const specs = await Promise.all(HALL_FILES.map(f => ctx.assets.loadJSON(f).catch(e => { console.warn('[house] 박물관 관 배치를 못 읽었어요', f, e); return null; })));
  specs.forEach((spec, i) => { if (spec?.hall) halls[spec.hall] = makeHall(spec, i); });
  if (!Object.keys(halls).length) return null;

  // ── 데이터 ──
  const data = () => ctx.services.data;
  const listsNow = () => Object.fromEntries(['fish', 'bug', 'fossil', 'sea', 'art'].map(c => [c, (data()?.items?.list?.(c) ?? []).map(it => ({ id: it.id, artKind: it.artKind }))]));
  const has = id => !!data()?.museum?.has?.(id);
  const stars = () => ctx.services.stars;
  function statusOf(R) {
    if (R.hall === 'star') return { total: CONSTELLATIONS.length, donated: stars()?.count?.() ?? 0, soon: !stars() };
    return hallStatus(R.spec, listsNow(), has);
  }

  /** 관 방 하나의 자리·충돌 (짓기는 처음 들어갈 때) — places.js makePlace 와 같은 모양 */
  function makeHall(spec, i) {
    const origin = hallOrigin(HALLS.indexOf(spec.hall) >= 0 ? HALLS.indexOf(spec.hall) : i), [w, d] = sizeOf(spec);
    const corner = cornerOf(origin, w, d);
    const list = (spec.furniture ?? []).map((e, k) => resolveFurniture(e, { models: models() }, k));
    const R = { hall: spec.hall, spec, origin, w, d, corner, x0: corner.x0, z0: corner.z0, list, room: null, ready: null, objs: [], shown: [], shownKey: null, extra: [] };
    const all = blockersOf(spec, list), lite = blockersOf(spec, list.filter(r => !r.entry.deco)), bounds = boundsOf(spec);
    const blockers = () => (light() ? lite : all);
    world.addZone({
      contains: (x, z) => Math.abs(x - origin.x) < w && Math.abs(z - origin.z) < d,
      collide(fx, fz, nx, nz, r) {
        const p = moveCircle(blockers(), bounds, fx - R.x0, fz - R.z0, nx - R.x0, nz - R.z0, r ?? 0.26);
        return { x: p.x + R.x0, z: p.z + R.z0 };
      },
      heightAt: (x, z) => { const lx = x - R.x0, lz = z - R.z0; return list.some(r => r.layer === 'rug' && inBox(boxOf(r.rec, r.footprint), lx, lz, -0.1)) ? 0.03 : 0; },
      groundAt: () => R.room?.floor?.step ?? 'wood',
      isWalkable(x, z) {
        const lx = x - R.x0, lz = z - R.z0;
        if (lx < bounds.x0 || lz < bounds.z0 || lx > bounds.x1 || lz > bounds.z1) return false;
        return !blockers().some(b => inBox(b, lx, lz));
      },
    });
    return R;
  }
  function applyQuality(R) {
    const lite = light();
    for (const o of R.objs) {
      if (o.deco) o.root.visible = !lite;
      o.root.traverse(m => { if (m.isMesh && !m.userData.outline && CASE_DECO.has(String(m.material?.name ?? '').split('@')[0])) m.visible = !lite; });
    }
    for (const x of R.extra) if (x.userData.lowHide) x.visible = ctx.quality !== 'min';
  }
  events.on('quality:changed', () => { for (const R of Object.values(halls)) if (R.room) applyQuality(R); });

  // ── 짓기 ──
  function build(R) {
    if (R.ready) return R.ready;
    const sp = interior.specs;
    R.room = buildRoom(ctx, {
      origin: R.origin, size: [R.w, R.d], windows: R.spec.windows ?? [], door: doorOf(R.spec), name: `museum-${R.hall}`,
      wallpaper: sp.get(R.spec.wallpaper) ?? sp.get(DEFAULT.wallpaper), floor: sp.get(R.spec.floor) ?? sp.get(DEFAULT.floor), frame: interior.frame,
    });
    R.room.group.visible = false;
    ctx.scene.add(R.room.group);
    R.ready = Promise.all(R.list.map(async r => {
      try {
        const obj = await makerOf(r.item).make(r.item, { variant: r.entry.variant ?? null });
        if (r.rec.wall) { const m = wallMount(r.rec.wall, r.rec.slot, R.corner); obj.root.position.set(m.x, 0, m.z); obj.root.rotation.y = m.rotY; }
        else { const b = boxOf(r.rec, r.footprint); obj.root.position.set(R.x0 + b.cx, 0, R.z0 + b.cz); obj.root.rotation.y = r.rec.rot * Math.PI / 2; }
        obj.deco = !!r.entry.deco;
        return obj;
      } catch (e) { console.warn('[house] 박물관 관 가구를 못 만들었어요', R.hall, r.key, e); return null; }
    })).then(objs => {
      R.objs = objs.filter(Boolean);
      for (const o of R.objs) R.room.group.add(o.root);
      if (R.hall === 'star') projector(R);
      applyQuality(R);
    });
    return R.ready;
  }
  /** 별자리관 투영기 위 별 점 구름 (Points 하나 — 곡면 월드 재질) */
  function projector(R) {
    const n = 260, pos = new Float32Array(n * 3);
    let seed = 30;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const y = 0.15 + rnd() * 0.85, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 2.4, y * 1.3, Math.sin(a) * r * 2.4], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = materials.curved(new THREE.PointsMaterial({ color: 0xFFF1C2, size: 0.05, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const pts = new THREE.Points(g, m);
    pts.name = 'museum-star-cloud';
    pts.position.set(R.x0 + 6, 1.15, R.z0 + 3);
    pts.userData.lowHide = true;
    pts.userData.spin = true;
    R.room.group.add(pts);
    R.extra.push(pts);
  }

  // ── 글씨 판 (아치 이름 · 안내판 · 「?」 액자) ──
  function textCanvas(lines, { w = 512, h = 160, bg = '#F3E7CC', ink = '#4A3B32', border = '#9C7452', sizes = [] } = {}) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = border; g.fillRect(0, 0, w, h);
    g.fillStyle = bg; g.fillRect(8, 8, w - 16, h - 16);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((t, i) => {
      g.font = `bold ${sizes[i] ?? (i === 0 ? 64 : 40)}px sans-serif`;
      g.fillText(t, w / 2, h * (i + 0.5) / n);
    });
    return cv;
  }
  function planeOf(canvas, pw, ph, name = 'sample') {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = materials.toonMaterial('#FFFFFF', { name });
    mat.map = tex;
    mat.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
    mesh.userData.dispose = () => { mesh.geometry.dispose(); tex.dispose(); mat.dispose(); };
    return mesh;
  }
  /** 방 기준 벽 점 → 월드 놓기 (벽면에서 out 만큼 앞, 높이 y, 벽을 등지고 방 안을 본다) */
  function onWall(Rm, mesh, wall, at, y, out = 0.02) {
    const p = wallPoint(wall, at, [Rm.w, Rm.d], out);
    mesh.position.set(Rm.x0 + p.lx, y, Rm.z0 + p.lz);
    mesh.rotation.y = wall === 'n' ? 0 : wall === 'w' ? Math.PI / 2 : -Math.PI / 2;
    return mesh;
  }

  // ── 로비 아치·안내판 (로비 방이 지어진 뒤 한 번) ──
  function buildArches(L) {
    const group = new THREE.Group();
    group.name = 'museum-arches';
    const frameMat = materials.toonMaterial('#F7F1E4', { name: 'archFrame' });
    const darkMat = materials.toonMaterial('#2A1F1B', { name: 'archDark' });
    const arches = archesOf(L.spec).filter(a => halls[a.hall]);
    for (const a of arches) {
      const box = (w, h, d, along, y, out, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        onWall(L, m, a.wall, a.at + along, y, out);
        group.add(m);
        return m;
      };
      box(ARCH.w, ARCH.h, 0.04, 0, ARCH.h / 2, 0.03, darkMat);                          // 어두운 문간
      for (const s of [-1, 1]) box(0.16, ARCH.h, 0.16, s * (ARCH.w / 2 + 0.08), ARCH.h / 2, 0.08, frameMat);
      box(ARCH.w + 0.4, 0.2, 0.18, 0, ARCH.h + 0.1, 0.09, frameMat);
      const R = halls[a.hall];
      const name = planeOf(textCanvas([`${HALL_ICON[a.hall]} ${HALL_NAME[a.hall]}`], { w: 512, h: 120, sizes: [62] }), 1.15, 0.27);
      group.add(onWall(L, name, a.wall, a.at, ARCH.h + 0.36, 0.1));
      const sign = planeOf(signCanvas(R), 0.62, 0.46);
      group.add(onWall(L, sign, a.wall, a.signAt, 1.25, 0.03));
      a.signMesh = sign;
      a.R = R;
    }
    L.room.group.add(group);
    Hs.arches = arches;
    Hs.lobbyKey = signKey();
  }
  function signCanvas(R) {
    const st = statusOf(R);
    const line = st.soon ? '🚧 곧 열려요' : R.hall === 'star' ? `찍은 별자리 ${st.donated}/${st.total}` : `기증 ${st.donated}/${st.total}`;
    return textCanvas([HALL_NAME[R.hall], line, '행동 키: 안내'], { w: 384, h: 288, sizes: [54, 46, 30], bg: st.soon ? '#F1E2D8' : '#F3E7CC' });
  }
  const signKey = () => Object.values(halls).map(R => { const s = statusOf(R); return `${s.donated}/${s.total}/${s.soon}`; }).join(',');
  function refreshSigns() {
    if (!Hs.arches) return;
    const k = signKey();
    if (k === Hs.lobbyKey) return;
    Hs.lobbyKey = k;
    for (const a of Hs.arches) {
      const old = a.signMesh.material.map;
      a.signMesh.material.map = new THREE.CanvasTexture(signCanvas(a.R));
      a.signMesh.material.map.colorSpace = THREE.SRGBColorSpace;
      a.signMesh.material.needsUpdate = true;
      old?.dispose();
    }
  }

  // ── 전시 ──
  let itemIndex = null;
  const templates = new Map();
  const loadItemIndex = () => (itemIndex ??= ctx.assets.loadJSON(ITEM_INDEX)
    .then(j => new Map(j.models.flatMap(m => m.items.map(x => [x.item, m]))))
    .catch(() => { itemIndex = null; return new Map(); }));
  async function itemModel(id) {
    const m = (await loadItemIndex()).get(id);
    if (!m) return null;
    if (!templates.has(m.slug)) {
      const job = ctx.assets.loadModel(`assets/items/models/${m.slug}`).then(gltf => {
        const { scene: model } = ctx.assets.instantiate(gltf);
        materials.applyToonStyle(model, { spec: { style: m.style ?? {} } });
        model.name = `item:${m.slug}`;
        return { model, size: new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()) };
      });
      job.catch(() => templates.delete(m.slug));
      templates.set(m.slug, job);
    }
    try { const t = await templates.get(m.slug); return { root: t.model.clone(), size: t.size }; } catch { return null; }
  }
  /** 아이템 아이콘 → 그림 판 (미술 그림·모델이 없는 아이템) */
  async function iconPlane(id, pw, ph) {
    const it = data()?.items?.get?.(id);
    const icon = it?.icon ?? '❔';
    if (typeof icon === 'string' && /\.(png|webp|jpe?g)$/i.test(icon)) {
      try {
        const url = await ctx.assets.url(icon);
        const tex = await new THREE.TextureLoader().loadAsync(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = materials.toonMaterial('#FFFFFF', { name: 'sample' });
        mat.map = tex;
        mat.transparent = true;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
        mesh.userData.dispose = () => { mesh.geometry.dispose(); tex.dispose(); mat.dispose(); };
        return mesh;
      } catch { /* 아래 글자 그림으로 */ }
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#F3EBD8'; g.fillRect(0, 0, 256, 256);
    g.font = '150px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(icon), 128, 136);
    return planeOf(cv, pw, ph);
  }
  function clearShown(R) { for (const o of R.shown) o.dispose(); R.shown = []; }
  function shownKey(R) {
    if (R.hall === 'star') return `star:${CONSTELLATIONS.map(c => (stars()?.has?.(c.id) ? 1 : 0)).join('')}`;
    const l = listsNow();
    return `${R.hall}:${(R.spec.cats ?? []).map(c => (l[c] ?? []).map(it => (has(it.id) ? it.id : '')).join('|')).join('/')}`;
  }
  async function refresh(R) {
    const key = shownKey(R);
    if (key === R.shownKey) return;
    R.shownKey = key;
    clearShown(R);
    const jobs = R.hall === 'star' ? starJobs(R) : itemJobs(R);
    const made = (await Promise.all(jobs)).filter(Boolean);
    if (R.shownKey !== key) { made.forEach(o => o.dispose()); return; }
    R.shown = made;
    for (const o of made) R.room.group.add(o.root);
  }
  function itemJobs(R) {
    return hallPlan(R.spec, listsNow(), has).filter(e => e.donated).map(async (e, i) => {
      try {
        const x = R.x0 + e.lx, z = R.z0 + e.lz;
        const meta = { id: e.id, group: e.cat, x, z, exhibit: true };
        if (e.kind === 'frames') {   // 그림: 액자 캔버스 위에 그림 판
          const mesh = await iconPlane(e.id, 0.78, 0.6);
          mesh.position.set(x, e.y, z);
          mesh.rotation.y = e.rotY ?? 0;
          return { root: mesh, meta, tick() {}, dispose() { mesh.removeFromParent(); mesh.userData.dispose?.(); } };
        }
        const m = await itemModel(e.id);
        if (!m) {   // 모델이 없으면 받침 위 세운 그림 판
          const mesh = await iconPlane(e.id, 0.42, 0.42);
          mesh.position.set(x, e.y + 0.24, z);
          return { root: mesh, meta, tick() {}, dispose() { mesh.removeFromParent(); mesh.userData.dispose?.(); } };
        }
        const k = Math.min(1.8, (EXHIBIT_MAX[e.cat] ?? 0.6) / Math.max(m.size.x, m.size.y, m.size.z, 0.01));
        m.root.scale.setScalar(k);
        m.root.position.set(x, e.y, z);
        const swim = e.cat === 'fish' || (e.cat === 'sea' && e.kind === 'line');
        const turn = swim ? (i % 2 ? Math.PI / 2 : -Math.PI / 2) : (i % 3 - 1) * 0.25;
        m.root.rotation.y = turn;
        const phase = i * 1.7;
        return {
          root: m.root, meta,
          tick() {
            const t = Hs.clock;
            if (swim) { m.root.position.y = e.y + Math.sin(t * 1.3 + phase) * 0.04; m.root.rotation.y = turn + Math.sin(t * 0.8 + phase) * 0.18; }
            else if (e.cat === 'bug') m.root.rotation.y = turn + Math.sin(t * 0.6 + phase) * 0.1;
          },
          dispose() { m.root.removeFromParent(); },
        };
      } catch (err) { console.warn('[house] 전시물을 못 놓았어요', e.id, err); return null; }
    });
  }
  function starJobs(R) {
    const frames = framesOf(R.spec);
    return CONSTELLATIONS.slice(0, frames.length).map(async (c, i) => {
      const f = frameSpot(frames[i], [R.w, R.d]);
      const got = !!stars()?.has?.(c.id);
      const cv = got ? stars().picture(c.id, 256) : textCanvas(['?', `${SEASON_NAME[c.season]} 밤하늘`], { w: 256, h: 256, bg: '#18224A', ink: '#C9D6FF', border: '#0D1430', sizes: [120, 30] });
      const mesh = planeOf(cv, 0.6, 0.6);
      const x = R.x0 + f.lx, z = R.z0 + f.lz;
      mesh.position.set(x, FRAME_Y, z);
      mesh.rotation.y = f.rotY;
      return { root: mesh, meta: { id: c.id, group: 'star', x, z, exhibit: true, star: got }, tick() {}, dispose() { mesh.removeFromParent(); mesh.userData.dispose(); } };
    });
  }
  events.on('museum:changed', () => { refreshSigns(); const R = halls[Hs.where]; if (R?.room) refresh(R); });
  events.on('stars:captured', () => { refreshSigns(); const R = halls.star; if (R?.room) { R.shownKey = null; if (Hs.where === 'star') refresh(R); } });

  // ── 드나들기 ──
  const hallDoor = R => { const m = doormatOf(R.spec); return { x: R.x0 + m.lx, front: R.z0 + m.front, entry: R.z0 + m.entry }; };
  const archWorld = (L, a, p = a.door) => ({ x: L.x0 + p.lx, z: L.z0 + p.lz });
  const facingOf = (nx, nz) => Math.atan2(-nx, -nz);   // 앞 = (-sin f, -cos f)
  const fwd = () => ({ x: -Math.sin(player.facing ?? 0), z: -Math.cos(player.facing ?? 0) });
  const lobbyFree = () => P.where === 'museum' && !Hs.where && !Hs.busy && free();

  async function enter(hall) {
    const R = halls[hall], L = lobby(), a = Hs.arches?.find(x => x.hall === hall);
    if (!R || !L || !a || !lobbyFree()) return false;
    Hs.busy = true;
    try {
      await build(R);
      await refresh(R);
      const w = archWorld(L, a, wallPoint(a.wall, a.at, [L.w, L.d], 0.3));
      await Promise.race([player.walkTo?.(w.x, w.z, { speed: 2.6 }), new Promise(r => setTimeout(r, 450))]);
      await doors.through({ dir: 'in', place: null, room: hallDoor(R), arrive: s => goIn(R, s) });
    } finally { Hs.busy = false; }
    return true;
  }
  function goIn(R, s, { quiet = false } = {}) {
    const L = lobby();
    Hs.where = R.hall;
    state.house.hall = R.hall;
    R.room.group.visible = true;
    if (L?.room) L.room.group.visible = false;
    applyQuality(R);
    player.camera?.setBounds?.(cameraBox(R.origin, R.w, R.d));
    player.camera?.setCurveScale?.(CAMERA_CURVE);
    player.teleport(s.x, s.z, s.facing ?? 0);
    events.emit('museum:hall', { hall: R.hall, on: true });
    if (!quiet) {
      const st = statusOf(R);
      ctx.services.ui?.toast?.(st.soon ? `${HALL_NAME[R.hall]} — 곧 열려요` : `${HALL_NAME[R.hall]} · ${R.hall === 'star' ? '찍은 별자리' : '기증'} ${st.donated}/${st.total}`, HALL_ICON[R.hall]);
    }
    saveSoon(0.5);
  }
  async function leave() {
    const R = halls[Hs.where];
    if (!R || Hs.busy || !free()) return false;
    Hs.busy = true;
    try { await doors.through({ dir: 'out', place: null, room: hallDoor(R), arrive: () => goOut(R) }); }
    finally { Hs.busy = false; }
    return true;
  }
  function goOut(R) {
    const L = lobby(), a = Hs.arches?.find(x => x.hall === R.hall);
    Hs.where = null;
    state.house.hall = null;
    R.room.group.visible = false;
    if (L?.room) L.room.group.visible = true;
    if (L) {
      player.camera?.setBounds?.(cameraBox(L.origin, L.w, L.d));
      const w = a ? archWorld(L, a) : { x: L.origin.x, z: L.origin.z };
      player.teleport(w.x, w.z, a ? facingOf(a.door.nx, a.door.nz) : 0);
    }
    events.emit('museum:hall', { hall: R.hall, on: false });
    saveSoon(0.5);
  }
  /** 저장 이어 하기: 관 안에서 끝냈으면 → 그 관 안 (places.resume 이 로비에 넣은 뒤 부른다) → 넣었으면 true */
  async function resume(p) {
    const R = Object.values(halls).find(r => p && Math.abs(p.x - r.origin.x) < r.w / 2 && Math.abs(p.z - r.origin.z) < r.d / 2);
    if (!R) { state.house.hall = null; return false; }
    await build(R);
    await refresh(R);
    const L = lobby();
    if (L?.room && !Hs.arches) buildArches(L);
    const lx = p.x - R.x0, lz = p.z - R.z0, B = boundsOf(R.spec), m = doormatOf(R.spec);
    const ok = lx > B.x0 && lx < B.x1 && lz > B.z0 && lz < B.z1 && blockersOf(R.spec, R.list).every(b => !inBox(b, lx, lz));
    goIn(R, ok ? { x: p.x, z: p.z, facing: p.facing ?? 0 } : { x: R.x0 + m.lx, z: R.z0 + m.entry, facing: 0 }, { quiet: true });
    return true;
  }
  /** 관 밖으로 조용히 (저장 불러오기 등 — places 의 goOut quiet 와 짝) */
  function drop() {
    const R = halls[Hs.where];
    if (!R) return;
    Hs.where = null;
    state.house.hall = null;
    R.room.group.visible = false;
    const L = lobby();
    if (L?.room) L.room.group.visible = true;
  }

  function onDoormat(margin = 0.85) {
    const R = halls[Hs.where];
    if (!R) return false;
    const m = doormatOf(R.spec), p = player.position;
    return Math.abs(p.x - (R.x0 + m.lx)) < 0.75 && p.z - R.z0 > R.d - margin;
  }
  /** 로비: 바라보는 쪽의 아치·안내판 → { type: 'in'|'sign', a } | null */
  function archInFront() {
    const L = lobby();
    if (!L || !Hs.arches || !lobbyFree()) return null;
    const p = player.position, f = fwd(), fp = { x: p.x + f.x * 0.6, z: p.z + f.z * 0.6 };
    let best = null, bestD = 0.8;
    for (const a of Hs.arches) for (const type of ['in', 'sign']) {
      const w = archWorld(L, a, type === 'in' ? a.door : a.sign);
      const d = Math.hypot(w.x - fp.x, w.z - fp.z);
      if (d < bestD) { best = { type, a }; bestD = d; }
    }
    return best;
  }
  /** 관 안: 바라보는 전시물 → shown | null */
  function shownInFront(reach = 0.9) {
    const R = halls[Hs.where];
    if (!R?.shown?.length || Hs.busy) return null;
    const p = player.position, f = fwd(), px = p.x + f.x * reach, pz = p.z + f.z * reach;
    let best = null, bestD = 0.8;
    for (const o of R.shown) { const d = Math.hypot(o.meta.x - px, o.meta.z - pz); if (d < bestD) { best = o; bestD = d; } }
    return best;
  }

  async function signWindow(R) {
    const ui = ctx.services.ui;
    if (!ui?.confirm) return;
    Hs.busy = true;
    try {
      const st = statusOf(R);
      const v = await ui.confirm({ title: `${HALL_ICON[R.hall]} ${HALL_NAME[R.hall]}`, text: signText(R.spec, st),
        buttons: [{ label: '들어가 볼래요', value: 'in', primary: true }, { label: '다 봤어요', value: false }], cancelValue: false });
      Hs.busy = false;
      if (v === 'in') await enter(R.hall);
    } finally { Hs.busy = false; }
  }
  async function lookAt(o) {
    const ui = ctx.services.ui, d = data(), m = o.meta;
    if (!ui?.confirm) return;
    Hs.busy = true;
    try {
      if (m.group === 'star') {
        const c = CONSTELLATIONS.find(x => x.id === m.id);
        const f = stars()?.found?.(m.id);
        await ui.confirm({ title: m.star ? `별자리 · ${c.name}` : '아직 못 찍은 별자리', icon: '🔭',
          text: m.star ? `${c.desc}\n\n📸 ${f?.day ?? ''} 에 찍었어요 · ${SEASON_NAME[c.season]} 밤하늘` : `${SEASON_NAME[c.season]} 밤하늘에 떠요. 박물관 앞 망원경으로 찾아 찍으면 여기 걸려요.`,
          buttons: [{ label: '다 봤어요', value: true, primary: true }], cancelValue: true });
        return;
      }
      const it = d?.items?.get?.(m.id);
      const when = [it?.place, it?.time, it?.season].filter(Boolean).join(' · ');
      await ui.confirm({ title: `${CAT_NAME[m.group] ?? ''} · ${it?.name ?? m.id}`, icon: it?.icon, text: `${it?.desc ?? ''}${when ? `\n\n📍 ${when}` : ''}\n\n— 기증해 준 ${ctx.services.intro?.fill?.('{player}') ?? '친구'}에게 고마워요.`,
        buttons: [{ label: '다 봤어요', value: true, primary: true }], cancelValue: true });
    } finally { Hs.busy = false; }
  }

  const I = ctx.services.gameplay.interactions;
  I.add({ name: 'museum-hall-in', intent: 'action', priority: 90,
    label: t => (t.type === 'in' ? `${HALL_NAME[t.a.hall]} 들어가기` : `${HALL_NAME[t.a.hall]} 안내`),
    test: () => archInFront(), run: t => (t.type === 'in' ? enter(t.a.hall) : signWindow(t.a.R)) });
  I.add({ name: 'museum-hall-out', intent: 'action', priority: 90, label: '로비로',
    test: () => (Hs.where && !Hs.busy && free() && onDoormat() ? true : null), run: () => leave() });
  I.add({ name: 'museum-hall-look', intent: 'action', priority: 91, label: t => (t.meta.group === 'star' && !t.meta.star ? '살펴보기' : '살펴보기'),
    test: () => (Hs.where && free() ? shownInFront() : null), run: t => lookAt(t) });

  function update(dt) {
    Hs.clock += dt;
    const L = lobby();
    if (L?.room && !Hs.arches) buildArches(L);
    if ((Hs.signT = (Hs.signT ?? 0) - dt) <= 0) { Hs.signT = 2; refreshSigns(); }
    const R = halls[Hs.where];
    // 저장 불러오기·처음부터로 관 밖에 옮겨졌으면 조용히
    if (R && !Hs.busy && free()) {
      const p = player.position;
      if (Math.abs(p.x - R.origin.x) > R.w || Math.abs(p.z - R.origin.z) > R.d) drop();
    }
    const input = ctx.input, blocked = ctx.services.ui?.isBlocking?.() || input.enabled === false;
    if (!blocked && free() && !Hs.busy) {
      if (Hs.where) {
        Hs.pushOutT = onDoormat(0.5) && input.move.z > 0.5 ? Hs.pushOutT + dt : 0;
        if (Hs.pushOutT > PUSH_TIME) { Hs.pushOutT = 0; leave(); }
      } else if (lobbyFree() && L && Hs.arches) {
        // 아치 쪽으로 밀어 들어가기: 벽에 붙어 아치 폭 안에서 벽 쪽으로
        const p = player.position;
        let hit = null;
        for (const a of Hs.arches) {
          const w = archWorld(L, a, wallPoint(a.wall, a.at, [L.w, L.d], 0));
          const nx = a.door.nx, nz = a.door.nz;
          const out = (p.x - w.x) * nx + (p.z - w.z) * nz, side = Math.abs((p.x - w.x) * nz - (p.z - w.z) * nx);
          if (out < 0.55 && side < ARCH.w / 2 - 0.15 && (input.move.x * -nx + input.move.z * -nz) > 0.5) hit = a;
        }
        Hs.pushT = hit ? Hs.pushT + dt : 0;
        if (hit && Hs.pushT > PUSH_TIME) { Hs.pushT = 0; enter(hit.hall); }
      }
    }
    if (R?.room) {
      if (ctx.quality !== 'min') for (const o of R.shown) o.tick?.(dt);
      for (const x of R.extra) if (x.userData.spin) x.rotation.y += dt * 0.05;
      R.room.setNight(ctx.services.time?.nightFactor ?? 0);
    }
  }

  const api = {
    get where() { return Hs.where; },
    get busy() { return Hs.busy; },
    halls: () => Object.values(halls).map(R => ({ hall: R.hall, name: HALL_NAME[R.hall], ...statusOf(R), room: { x0: R.x0, z0: R.z0, x1: R.x0 + R.w, z1: R.z0 + R.d } })),
    /** 로비 아치·안내판 앞 자리 (월드) — 봇·점검이 설 곳 */
    arches: () => { const L = lobby(); return L && Hs.arches ? Hs.arches.map(a => ({ hall: a.hall, door: archWorld(L, a), sign: archWorld(L, a, a.sign), facing: facingOf(-a.door.nx, -a.door.nz) })) : []; },
    doormat: () => { const R = halls[Hs.where]; if (!R) return null; const m = doormatOf(R.spec); return { x: R.x0 + m.lx, z: R.z0 + m.lz }; },
    shown: hall => (halls[hall]?.shown ?? []).length,
    shownSpots: hall => (halls[hall]?.shown ?? []).map(o => ({ ...o.meta })),
    status: hall => (halls[hall] ? statusOf(halls[hall]) : null),
    enter, leave,
  };
  return { get inside() { return !!Hs.where; }, update, resume, drop, doormat: api.doormat, api };
}
