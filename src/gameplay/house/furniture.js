// 가구 모델 불러오기·만들기. assets/furniture/index.json 이 아이템 id → 모델 slug·발자국·놓는 곳을 알려 준다.
// 모델은 .glb.json (assets.loadModel), 재질은 materials.applyToonStyle(스펙 style 그대로).
// 움직이는 부분: 벽시계 바늘(hourHand·minuteHand) = 게임 시각, 모닥불 불꽃(flicker) = 반복 동작, 어항 물·유리 선반(caseGlass) = 반투명.
// base 를 주면 다른 폴더의 같은 모양 목록을 읽는다 — 상점·박물관 붙박이 assets/furniture/fixtures (places.js).
// 어항·곤충 상자에 넣은 물고기·곤충은 그 아이템 id 로 정한 색으로 안의 물고기(fish)·풍뎅이(bug) 재질을 칠한다.
// M17-P2 (D184-A) 미술품: 집 가구 키트(기본 폴더)는 assets/items/index.json 의 art 모델도 가구처럼 안다 — 그림(art-painting)은 벽 칸(place 'wall'),
//   조각(art-sculpture)은 바닥 1칸. 모델은 아이템 모델(assets/items/models) 그대로: 그림은 받침(stand)을 숨기고 기운 것을 세워 벽 높이에 건다.
//   진품·가품 모두 (가품은 data.items 칸 fakeLook 색). 아이템 id 는 art.<slug>(-fake) 그대로라 가방 ↔ 집이 같은 id 로 오간다.

const BASE = 'assets/furniture';
const HOLD_MAT = { 'fish-tank': 'fish', 'bug-case': 'bug' };
const ITEM_INDEX = 'assets/items/index.json';
/** 미술품 놓기 값 (M17-P2): 그림 벽 높이(가운데) · 크기 배율, 조각 배율. 그림 모델이 뒤로 기운 각도 = night_special_items.py TILT */
export const ART_PLACE = { wallY: 1.45, wallScale: 1.7, floorScale: 1.6, tilt: 0.16 };

/** 아이템 표(assets/items/index.json) → 미술품 가구 칸 [{ item, slug, art, artKind, place, footprint, ... }] (순수 — 테스트가 쓴다) */
export function artInfos(itemIndex) {
  const out = [];
  for (const m of itemIndex?.models ?? []) {
    if (m.group !== 'art') continue;
    const painting = m.kind === 'art-painting';
    for (const x of m.items ?? []) out.push({ item: x.item, slug: m.slug, art: true, artKind: painting ? 'painting' : 'sculpture', place: painting ? 'wall' : 'floor', footprint: [1, 1], size: m.size, style: m.style ?? {}, name: m.name, variants: [], fake: /-fake$/.test(x.item) });
  }
  return out;
}

/** 넣은 생물 id → 색 (같은 id 는 늘 같은 색). 물고기는 밝게, 곤충은 진하게 */
function holdColor(THREE, id, kind) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const hue = ((h >>> 0) % 360) / 360;
  return `#${new THREE.Color().setHSL(hue, kind === 'fish' ? 0.7 : 0.45, kind === 'fish' ? 0.58 : 0.34).getHexString()}`;
}

export function createFurnitureKit(ctx, { base: dir = BASE } = {}) {
  const { THREE, assets, materials } = ctx;
  let index = null;
  const bySlug = new Map(), byItem = new Map(), specs = new Map(), arts = new Map();

  async function load() {
    index = await assets.loadJSON(`${dir}/index.json`);
    for (const m of index.models) { bySlug.set(m.slug, m); byItem.set(m.item, m); }
    if (dir === BASE) {   // M17-P2 미술품 (집 가구 키트만)
      try { for (const a of artInfos(await assets.loadJSON(ITEM_INDEX))) arts.set(a.item, a); } catch { /* 아이템 표가 없으면 미술품만 못 놓는다 */ }
    }
    return index;
  }

  /** 아이템 id → { slug, footprint, place, layer, ... } | null (미술품 art.* 은 artInfos 칸) */
  const info = item => byItem.get(item) ?? arts.get(item) ?? null;

  async function spec(slug) {
    if (!specs.has(slug)) specs.set(slug, assets.loadJSON(`${dir}/specs/${slug}.json`));
    return specs.get(slug);
  }

  /** 미리 받아 두기 (기다리지 않아도 된다) */
  function preload(items) {
    for (const it of items) {
      const m = info(it);
      if (m) { assets.loadModel(`${dir}/models/${m.slug}`).catch(() => {}); spec(m.slug).catch(() => {}); }
    }
  }

  /** 가구 하나 만들기 → { root, tick(dt, now), setVariant(v), dispose() } */
  async function make(item, { variant = null } = {}) {
    const m = info(item);
    if (!m) throw new Error(`가구 모델이 없어요: ${item}`);
    if (m.art) return makeArt(m);
    const [gltf, sp] = await Promise.all([assets.loadModel(`${dir}/models/${m.slug}`), spec(m.slug)]);
    const { scene: model, animations } = assets.instantiate(gltf);
    const toon = materials.applyToonStyle(model, { spec: sp });
    const root = new THREE.Group();
    root.name = `furniture:${m.slug}`;
    root.add(model);
    root.userData.furniture = m.slug;

    // 바닥에 붙어 그림자만 받는 것: 러그는 그림자를 드리우지 않는다
    if (m.layer === 'rug') model.traverse(o => { if (o.isMesh) o.castShadow = false; });
    // 어항 물은 반투명 (외곽선은 스펙에서 뺐다)
    for (const mat of toon.materials.tankWater ?? []) { mat.transparent = true; mat.opacity = 0.55; mat.depthWrite = false; }
    for (const mat of toon.materials.caseGlass ?? []) { mat.transparent = true; mat.opacity = 0.35; mat.depthWrite = false; }   // 곤충 유리 상자 위층 선반

    const hour = model.getObjectByName('hourHand'), minute = model.getObjectByName('minuteHand');
    let mixer = null;
    if (animations?.length) {
      mixer = new THREE.AnimationMixer(model);
      for (const clip of animations) mixer.clipAction(clip).play();
    }
    const base = { ...sp.palette };
    const holdKey = HOLD_MAT[m.slug] ?? null;
    let held = null;
    function setVariant(v) {
      variant = v;
      const pal = { ...base, ...(sp.variants?.[v]?.palette ?? {}) };
      for (const [name, hex] of Object.entries(pal)) toon.setColor(name, hex);
      if (held) setHolds(held);
    }
    /** 어항·곤충 상자 안의 생물 (아이템 id, null = 원래 색) */
    function setHolds(id) {
      if (!holdKey) return;
      held = id;
      toon.setColor(holdKey, id ? holdColor(THREE, id, holdKey) : (sp.variants?.[variant]?.palette?.[holdKey] ?? base[holdKey]));
    }
    if (variant) setVariant(variant);
    ctx.services?.album?.dress?.(m.slug, model, variant);   // M15 추억 액자 FU-71–72: 액자 속 'photo' 재질에 앨범 사진
    return {
      root, info: m, spec: sp,
      setVariant, setHolds,
      tick(dt, now) {
        mixer?.update(dt);
        if (hour && now) {
          // 앞에서 보아 시계 방향 = three 의 -Z 회전. 12시 = 0
          const h = (now.hour % 12) + now.minute / 60, mi = now.minute + (now.ms % 60000) / 60000;
          hour.rotation.z = -(h / 12) * Math.PI * 2;
          minute.rotation.z = -(mi / 60) * Math.PI * 2;
        }
      },
      dispose() { mixer?.stopAllAction(); root.removeFromParent(); },
    };
  }

  /** M17-P2 미술품 하나 → make 와 같은 모양 (색 바꾸기·넣기 없음) */
  async function makeArt(m) {
    const gltf = await assets.loadModel(`assets/items/models/${m.slug}`);
    const { scene: model } = assets.instantiate(gltf);
    const toon = materials.applyToonStyle(model, { spec: { style: m.style } });
    const look = ctx.services?.data?.items?.get?.(m.item)?.fakeLook;
    if (look) for (const [k, hex] of Object.entries(look)) toon?.setColor?.(k, hex);
    const root = new THREE.Group();
    root.name = `art:${m.slug}`;
    root.userData.furniture = m.slug;
    root.userData.art = m.item;
    const holder = new THREE.Group();
    holder.add(model);
    root.add(holder);
    // 보이는 메시만 (숨긴 받침·외곽선 껍데기는 빼고) 잰 상자
    const box = () => {
      holder.updateMatrixWorld(true);
      const b = new THREE.Box3(), t = new THREE.Box3();
      holder.traverse(o => {
        if (!o.isMesh || o.userData.outline || !o.geometry) return;
        for (let p = o; p && p !== holder; p = p.parent) if (!p.visible) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        b.union(t.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      });
      return b;
    };
    if (m.artKind === 'painting') {
      // 받침·뒤 다리는 숨기고 (외곽선 껍데기도), 뒤로 기운 그림을 세운다 — 기울기를 되돌리는 쪽은 두께가 얇아지는 쪽
      model.traverse(o => { if (o.isMesh && ([o.material].flat().some(mt => mt?.name === 'stand') || o.userData.outlineOf === 'stand')) o.visible = false; });
      const depth = a => { model.rotation.x = a; const b = box(); return b.max.z - b.min.z; };
      const a = depth(ART_PLACE.tilt) < depth(-ART_PLACE.tilt) ? ART_PLACE.tilt : -ART_PLACE.tilt;
      model.rotation.x = a;
      holder.scale.setScalar(ART_PLACE.wallScale);
      const b = box();
      holder.position.set(-(b.min.x + b.max.x) / 2, ART_PLACE.wallY - (b.min.y + b.max.y) / 2, 0.02 - b.min.z);
    } else {
      holder.scale.setScalar(ART_PLACE.floorScale);
      const b = box();
      holder.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    }
    return {
      root, info: m, spec: null,
      setVariant() {}, setHolds() {},
      tick() {},
      dispose() { root.removeFromParent(); },
    };
  }

  return { load, info, make, preload, get list() { return index?.models ?? []; } };
}
