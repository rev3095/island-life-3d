// 가구 모델 불러오기·만들기. assets/furniture/index.json 이 아이템 id → 모델 slug·발자국·놓는 곳을 알려 준다.
// 모델은 .glb.json (assets.loadModel), 재질은 materials.applyToonStyle(스펙 style 그대로).
// 움직이는 부분: 벽시계 바늘(hourHand·minuteHand) = 게임 시각, 모닥불 불꽃(flicker) = 반복 동작, 어항 물 = 반투명.
// 어항·곤충 상자에 넣은 물고기·곤충은 그 아이템 id 로 정한 색으로 안의 물고기(fish)·풍뎅이(bug) 재질을 칠한다.

const BASE = 'assets/furniture';
const HOLD_MAT = { 'fish-tank': 'fish', 'bug-case': 'bug' };

/** 넣은 생물 id → 색 (같은 id 는 늘 같은 색). 물고기는 밝게, 곤충은 진하게 */
function holdColor(THREE, id, kind) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const hue = ((h >>> 0) % 360) / 360;
  return `#${new THREE.Color().setHSL(hue, kind === 'fish' ? 0.7 : 0.45, kind === 'fish' ? 0.58 : 0.34).getHexString()}`;
}

export function createFurnitureKit(ctx) {
  const { THREE, assets, materials } = ctx;
  let index = null;
  const bySlug = new Map(), byItem = new Map(), specs = new Map();

  async function load() {
    index = await assets.loadJSON(`${BASE}/index.json`);
    for (const m of index.models) { bySlug.set(m.slug, m); byItem.set(m.item, m); }
    return index;
  }

  /** 아이템 id → { slug, footprint, place, layer, ... } | null */
  const info = item => byItem.get(item) ?? null;

  async function spec(slug) {
    if (!specs.has(slug)) specs.set(slug, assets.loadJSON(`${BASE}/specs/${slug}.json`));
    return specs.get(slug);
  }

  /** 미리 받아 두기 (기다리지 않아도 된다) */
  function preload(items) {
    for (const it of items) {
      const m = info(it);
      if (m) { assets.loadModel(`${BASE}/models/${m.slug}`).catch(() => {}); spec(m.slug).catch(() => {}); }
    }
  }

  /** 가구 하나 만들기 → { root, tick(dt, now), setVariant(v), dispose() } */
  async function make(item, { variant = null } = {}) {
    const m = info(item);
    if (!m) throw new Error(`가구 모델이 없어요: ${item}`);
    const [gltf, sp] = await Promise.all([assets.loadModel(`${BASE}/models/${m.slug}`), spec(m.slug)]);
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

  return { load, info, make, preload, get list() { return index?.models ?? []; } };
}
