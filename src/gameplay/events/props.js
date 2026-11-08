// 9차 M9-P1 (보드 wave9 D87-A) 주민 행사 소품: 행사 주간 동안 주인공 주민이 소품을 몸에 단다.
// 소품 = events.json list[].props 의 이름 → 배경 모델 event-<이름> (PR-26 꽃 머리띠 · PR-27 부채 · PR-28 스카프 · PR-29 목도리, build_env.py).
// 모델은 행사 묶음(season-*)에 들어 있어 그 행사 때만 받는다 (events.json assets.env 에도 적어 둠).
// 붙이는 자리는 캐릭터 빌더(build_character.py)의 비율로 셈한다: 뼈의 쉬는 자세(boneInverses)에서 메시 공간의 목·손 자리를 구해
// 뼈 공간으로 옮겨 단다 → 걷기·인사 동작을 따라 같이 움직인다. 키(spec proportions.height)만큼 소품도 늘린다.

// 소품 이름 → [붙일 뼈, 쉬는 자세에서 그 뼈 원점 기준 자리 (키 1.0 캐릭터, 메시 공간 y 위 · z 앞)]
//   머리 뼈 원점 = 목 (bodyTop). 머리 꼭대기 ≈ 목 + 0.42 → 머리띠는 조금 아래 둥근 곳에.
//   몸 뼈(spine) 원점 = 몸 가운데 (BODY_C), 목 = 그 위 0.155 → 목도리·스카프는 목 조금 아래.
//   오른손 = 어깨(arm.R 원점) + (−0.055, −0.15, +0.01) (build_character.py ARMS)
export const PROP_MOUNT = {
  'flower-crown': ['head', [0, 0.36, -0.01]],
  fan: ['arm.R', [-0.055, -0.14, 0.03]],
  scarf: ['spine', [0, 0.13, 0]],
  muffler: ['spine', [0, 0.13, 0]],
};
const boneName = n => n.replace(/\./g, '');   // three 가 노드 이름의 '.' 를 뺀다 (arm.R → armR)

/** 액터 모델에서 뼈 하나 찾기 → { bone, rest: 메시 공간 쉬는 자세 행렬 } | null */
function restBone(THREE, model, name) {
  let skin = null;
  model.traverse(o => { if (!skin && o.isSkinnedMesh) skin = o; });
  const bones = skin?.skeleton?.bones ?? [];
  const i = bones.findIndex(b => b.name === name || b.name === boneName(name));
  if (i < 0) return null;
  return { bone: bones[i], rest: new THREE.Matrix4().copy(skin.skeleton.boneInverses[i]).invert(), bindInv: skin.bindMatrixInverse };
}

export function createHostProps(ctx, events) {
  const { THREE } = ctx;
  const S = () => ctx.services;
  const worn = new Map();   // 주민 slug → { prop, obj, ev }
  const cache = new Map();  // 소품 이름 → Promise<{ scene, spec }>
  let gen = 0, t = 0;

  function model(prop) {
    if (!cache.has(prop)) {
      const slug = `event-${prop}`;
      cache.set(prop, Promise.all([ctx.assets.loadEnv(slug), ctx.assets.loadEnvSpec(slug)]).then(([gltf, spec]) => ({ gltf, spec })));
      cache.get(prop).catch(e => { cache.delete(prop); console.warn(`[events] 행사 소품을 못 받았어요: ${prop}`, e); });
    }
    return cache.get(prop);
  }

  function takeOff(slug) {
    const w = worn.get(slug);
    if (!w) return;
    w.obj?.removeFromParent();
    worn.delete(slug);
  }

  async function putOn(V, prop, ev) {
    const my = gen;
    worn.set(V.slug, { prop, obj: null, ev });
    const [m, cspec] = await Promise.all([model(prop).catch(() => null), ctx.assets.loadCharacterSpec?.(V.slug).catch(() => null)]);
    const w = worn.get(V.slug);
    if (!m || my !== gen || w?.prop !== prop || w.obj) return;
    const [bname, at] = PROP_MOUNT[prop] ?? PROP_MOUNT.scarf;
    const rb = restBone(THREE, V.actor.model, bname);
    if (!rb) { console.warn(`[events] ${V.slug} 에게 ${bname} 뼈가 없어요`); return; }
    const H = cspec?.proportions?.height ?? 1;
    const { scene: obj } = ctx.assets.instantiate(m.gltf);
    const toon = ctx.materials.applyToonStyle(obj, { spec: m.spec });
    obj.userData.occluder = false;   // 가림 투명은 주인을 따라간다 (update 에서 주인 fade 를 옮겨 씀)
    obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // 메시 공간 자리 = 뼈 쉬는 자리 + at×키, 방향은 똑바로 → 뼈 공간 = rest⁻¹ · T · S
    const restPos = new THREE.Vector3().setFromMatrixPosition(rb.rest);
    const want = new THREE.Matrix4().compose(restPos.add(new THREE.Vector3(...at).multiplyScalar(H)), new THREE.Quaternion(), new THREE.Vector3(H, H, H));
    const local = new THREE.Matrix4().copy(rb.rest).invert().multiply(want);
    local.decompose(obj.position, obj.quaternion, obj.scale);
    obj.name = `event-prop:${prop}`;
    rb.bone.add(obj);
    w.obj = obj; w.toon = toon; w.host = V;
  }

  /** 지금 행사 주간인 행사의 주인공에게 소품, 아니면 뗀다 */
  function sync() {
    const town = S().town;
    if (!town?.villagers) return;
    const want = new Map();
    for (const r of events.active?.() ?? []) {
      const prop = r.ev.props?.[0];
      if (r.ev.host && prop && PROP_MOUNT[prop]) want.set(r.ev.host, { prop, ev: r.ev.id });
    }
    for (const slug of [...worn.keys()]) if (worn.get(slug).prop !== want.get(slug)?.prop) takeOff(slug);
    for (const [slug, { prop, ev }] of want) {
      if (worn.has(slug)) continue;
      const V = town.villagers.find(v => v.slug === slug);
      if (V?.actor?.model) putOn(V, prop, ev);
    }
  }

  ctx.events.on('time:newday', () => { gen++; sync(); });
  ctx.events.on('festival:end', sync);
  ctx.events.on('game:ready', sync);

  return {
    register() {},
    update(dt) {
      t += dt;
      if (t > 2) { t = 0; sync(); }   // 주민이 늦게 생기거나 이사 와도
      for (const w of worn.values()) if (w.toon) w.toon.setFade?.(Math.min(w.host.actor.toon?.fade?.value ?? 1, w.host.actor.opacity ?? 1));   // 주인이 비치거나 나타나고 사라지면 같이
    },
    sync,
    debug: { worn, putOn, takeOff },
  };
}
