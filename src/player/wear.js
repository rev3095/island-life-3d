// 11차 M11-P2 옷 끼우는 틀 (보드 wave11 D100-A · D101-A) — 게임(player/outfit.js)과 리소스 편집기가 같이 쓴다.
// three 를 import 하지 않는다 (node 테스트에서도 읽히게) — 새 객체는 받은 객체의 생성자로 만든다.
// 옷 .glb (assets/clothes/models/<slug>.glb.json) 는 주인공과 같은 뼈대(이름·쉰 자세)로 만든 뼈대 + 옷 메시다 (build_clothes.py).
// 옷 메시를 주인공 모델의 뼈에 이름으로 다시 묶는다: 새 Skeleton(주인공 뼈, 옷 쪽 boneInverses) + 옷 쪽 bindMatrix.
// 쉰 자세가 같아서 boneInverses 를 그대로 쓰면 주인공 뼈를 따라 움직인다 (뼈 이름이 없으면 묶지 않고 null).

/** 칸: 모자 · 윗옷 · 신발 (CONTRACTS 「11차 옷」) */
export const SLOTS = ['hat', 'top', 'shoes'];
export const SLOT_LABEL = { hat: '모자', top: '윗옷', shoes: '신발' };
/** 칸마다 옷이 써도 되는 뼈 (tests 가 옷 통계 bones 로 본다) */
export const SLOT_BONES = {
  hat: ['head'],
  top: ['hips', 'spine', 'arm.L', 'arm.R'],
  shoes: ['shin.L', 'shin.R', 'leg.L', 'leg.R'],
};
/** 주인공 모델에 든 기본 윗옷 메시 이름 (player.json clothes.split → build_character.py) */
export const BASE_TOP = 'player_top';

/** 뼈 이름으로 찾기 — glTF 를 three 가 읽으면 'arm.L' 이 'armL' 이 된다 (점이 빠짐) */
export function boneMap(model) {
  const m = new Map();
  model.traverse(o => { if (o.isBone) { m.set(o.name, o); m.set(o.name.replace(/\./g, ''), o); } });
  return m;
}

/**
 * 옷 gltf.scene(복제본) → 주인공 뼈대에 묶은 SkinnedMesh 들을 담은 Group (아직 장면에 안 붙음).
 * model = 주인공 모델 (instantiate 한 scene). 뼈를 못 찾으면 null.
 */
export function bindClothes(model, clothesScene, { name = 'outfit' } = {}) {
  const bones = boneMap(model);
  const group = new clothesScene.constructor();   // Group (Object3D)
  group.name = name;
  const meshes = [];
  clothesScene.updateMatrixWorld(true);
  clothesScene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  for (const src of meshes) {
    const sk = src.skeleton;
    const mine = sk.bones.map(b => bones.get(b.name) ?? bones.get(b.name.replace(/\./g, '')));
    if (mine.some(b => !b)) { console.warn('[wear] 주인공 뼈대에 없는 뼈', sk.bones.filter((b, i) => !mine[i]).map(b => b.name)); return null; }
    const mesh = new src.constructor(src.geometry, src.material);   // SkinnedMesh
    mesh.name = src.name;
    mesh.bind(new sk.constructor(mine, sk.boneInverses.map(m => m.clone())), src.bindMatrix.clone());
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return meshes.length ? group : null;
}

/** 기본 윗옷(player_top) 보이기 — 툰 합치기 뒤에는 이름이 'player_top:toon' 처럼 바뀐다 */
export function setBaseTop(model, visible) {
  model.traverse(o => { if (o.isMesh && (o.name === BASE_TOP || o.name.startsWith(`${BASE_TOP}:`))) o.visible = visible; });
}

/** 옷 이름 'slug' 또는 'slug@변형' → { slug, variant } */
export function parseWear(id) {
  if (!id || typeof id !== 'string') return null;
  const [slug, variant = null] = id.split('@');
  return { slug, variant };
}
export const wearId = (slug, variant) => (variant ? `${slug}@${variant}` : slug);

/** 목록의 옷 한 벌(index.json clothes 줄) + 변형 → 칠할 팔레트 {재질: 색} */
export function paletteOf(entry, variant) {
  const v = variant && entry?.variants?.[variant];
  return { ...(entry?.palette ?? {}), ...(v?.palette ?? {}) };
}

/** 이름: '줄무늬 티' / 변형이 기본이 아니면 '딸기 줄무늬 줄무늬 티' 대신 변형 이름(라벨에서 '(기본)' 뺀 것) */
export function wearName(entry, variant) {
  if (!entry) return '';
  const keys = Object.keys(entry.variants ?? {});
  if (!variant || !keys.length || variant === keys[0]) return entry.name;
  return (entry.variants[variant]?.label ?? entry.name).replace(/ \(기본\)$/, '');
}
