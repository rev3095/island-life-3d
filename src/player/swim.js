// M16 잠수 (D161): 헤엄 AN-15 · 잠기기 AN-16 자세와 잠수복 CL-13 입히기 — gameplay/gather/dive.js 가 쓴다.
// 동작은 주인공 glb 를 다시 굽지 않고 코드로 한다 (motions.js 처럼 mixer.update 뒤에 뼈를 부모 공간에서 덧돌림 + 몸 전체 기울이기).
//   다른 트랙(M13·M15)도 주인공 동작을 더할 수 있어 .glb.json 충돌을 피하려는 것 — 나중에 build_character.py 클립(swim·dive)으로 옮겨도
//   이 파일의 pose() 만 바꾸면 된다. 서기 클립(idle)을 그대로 틀어 두고(dive.js 가 setGait/setStance('idle')) 그 위에 덧돌린다.
// 잠수복은 옷 칸(모자·윗옷·신발)과 따로 — 바다에 있는 동안만 입고 나오면 원래 옷으로 (assets/clothes/index.json 의 slot 'suit').
// three 를 import 하지 않는다 (node 테스트가 pose·bodyPlace 를 읽게) — Euler·Quaternion·Vector3 는 모델의 것으로 만든다
import { bindClothes } from './wear.js';

export const SUIT_SLUG = 'wetsuit';
const CLOTHES_INDEX = 'assets/clothes/index.json';
const BONES = ['hips', 'spine', 'head', 'armL', 'armR', 'legL', 'legR', 'shinL', 'shinR'];
export const SWIM_PITCH = 1.2;    // 헤엄칠 때 몸 기울기 (라디안, 앞으로 엎드림)
export const DIVE_PITCH = 2.15;   // 다 잠겼을 때 (머리가 아래로)
const HIP_Y = { swim: -0.05, dive: -1.05 };   // 물낯(뿌리 높이) 기준 엉덩이 높이

const lerp = (a, b, k) => a + (b - a) * k;

/**
 * 헤엄 자세 (순수 — tests/dive.test.mjs): ph = 팔다리 주기(라디안), go = 앞으로 가는 정도 0~1, d = 잠긴 정도 0~1, k = 섞기 0~1
 * → { 뼈: [x, y, z] } (부모 공간 Euler YXZ, motions.js 와 같은 뜻: 팔 x − = 앞으로 들어 올림, 허리·머리 x + = 숙임)
 */
export function pose(ph, go, d, k = 1) {
  const s = Math.sin(ph), c = Math.cos(ph);
  // 제자리 헤엄(팔을 옆으로 젓기) ↔ 앞으로(자유형 팔 돌리기)
  const tread = { armR: [-0.5 + 0.25 * s, 0, -1.0 - 0.3 * c], armL: [-0.5 - 0.25 * s, 0, 1.0 + 0.3 * c] };
  const crawl = { armR: [-1.7 + 1.5 * s, 0, -0.25], armL: [-1.7 - 1.5 * s, 0, 0.25] };
  // 잠길 때: 두 팔을 머리 앞으로 모아 뻗는다
  const dive = { armR: [-2.9, 0, -0.15], armL: [-2.9, 0, 0.15] };
  const arm = side => [0, 1, 2].map(j => lerp(lerp(tread[side][j], crawl[side][j], go), dive[side][j], d) * k);
  const kick = 0.35 + 0.25 * go;
  return {
    armR: arm('armR'), armL: arm('armL'),
    spine: [0, 0.18 * go * s * (1 - d) * k, 0],
    head: [lerp(-0.95, -0.25, d) * k, 0, 0],                       // 엎드린 채 앞을 보게 고개를 든다
    legL: [kick * Math.sin(ph * 2) * k, 0, 0.05 * k], legR: [-kick * Math.sin(ph * 2) * k, 0, -0.05 * k],
    shinL: [-0.25 * (1 + Math.sin(ph * 2)) * k, 0, 0], shinR: [-0.25 * (1 - Math.sin(ph * 2)) * k, 0, 0],
    hips: [0, 0, 0],
  };
}

/** 몸 전체 놓기 (순수): 엉덩이 높이 hipH 인 모델을 pitch 만큼 앞으로 기울여 엉덩이를 (0, hipY, 0) 에 → { rx, y, z } */
export function bodyPlace(hipH, pitch, hipY) {
  return { rx: pitch, y: hipY - hipH * Math.cos(pitch), z: -hipH * Math.sin(pitch) };
}

export function createSwim(ctx) {
  const { assets, materials, scene } = ctx;
  const root = scene.children.find(o => o.isGroup && o.name === 'player');
  const model = root?.children?.[0];
  if (!model) return null;
  const Euler = model.rotation.constructor, Quaternion = model.quaternion.constructor, Vector3 = model.position.constructor;
  const bone = {};
  for (const b of BONES) bone[b] = model.getObjectByName(b) ?? model.getObjectByName(b.replace(/([LR])$/, '.$1'));
  const base = {}, last = {};
  for (const b of BONES) if (bone[b]) { base[b] = bone[b].quaternion.clone(); last[b] = null; }
  // 엉덩이 높이 (쉰 자세, 모델 원점 = 발바닥)
  let hipH = 0.34;
  if (bone.hips) {
    model.updateMatrixWorld(true);
    const v = bone.hips.getWorldPosition(new Vector3());
    const r = root.getWorldPosition(new Vector3());
    if (v.y - r.y > 0.1 && v.y - r.y < 0.8) hipH = v.y - r.y;
  }
  const e = new Euler(0, 0, 0, 'YXZ'), q = new Quaternion();
  let k = 0, want = 0, d = 0, dWant = 0, ph = 0, go = 0;

  // ---------- 잠수복 ----------
  let suit = null, suitJob = null, worn = false;
  const hidden = [];   // 입는 동안 숨긴 것 [obj, 예전 visible]
  function loadSuit() {
    suitJob ??= (async () => {
      const cat = await assets.loadJSON(CLOTHES_INDEX);
      const entry = (cat?.models ?? []).find(m => m.slug === SUIT_SLUG && m.model);
      if (!entry) throw new Error('잠수복(CL-13)이 옷 목록에 없어요');
      const gltf = await assets.loadModel(entry.model.replace(/\.glb\.json$/, ''));
      const group = bindClothes(model, assets.instantiate(gltf).scene, { name: 'swim:suit' });
      if (!group) throw new Error('잠수복을 뼈대에 못 묶었어요');
      const toon = materials.applyToonStyle(group, { outlineWidth: 0.006, merge: true });
      for (const [key, hex] of Object.entries(entry.palette ?? {})) toon.setColor?.(key, hex);
      group.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.outline; o.frustumCulled = false; } });
      return group;
    })().catch(err => { console.warn('[swim] 잠수복을 못 입혔어요 — 입던 옷 그대로', err); suitJob = null; return null; });
    return suitJob;
  }
  function hideClothes() {
    hidden.length = 0;
    model.traverse(o => {
      const isOutfit = o.name?.startsWith('outfit:');
      const isBaseTop = o.isMesh && (o.name === 'player_top' || o.name.startsWith('player_top:'));
      if (isOutfit || isBaseTop) { hidden.push([o, o.visible]); o.visible = false; }
    });
  }
  function showClothes() { for (const [o, v] of hidden) o.visible = v; hidden.length = 0; }
  async function wear(v) {
    worn = v;
    if (!v) { suit?.removeFromParent(); showClothes(); return true; }
    const g = await loadSuit();
    if (!worn || !g) return false;          // 그 사이 나왔거나 못 받았다
    suit = g;
    hideClothes();
    model.add(g);
    return true;
  }

  function restoreBones() {
    for (const b of BONES) {
      const o = bone[b];
      if (o && last[b] && o.quaternion.equals(last[b])) o.quaternion.copy(base[b]);
      last[b] = null;
    }
  }

  return {
    hipHeight: hipH,
    loadSuit, wear,
    get wearing() { return worn && !!suit?.parent; },
    /** 헤엄 켜기·끄기 (섞어서) */
    set active(v) { want = v ? 1 : 0; },
    get active() { return want > 0 || k > 0; },
    /** 잠긴 정도 목표 0~1 (AN-16 잠기기) */
    set depth(v) { dWant = Math.max(0, Math.min(1, v)); },
    get depth() { return d; },
    /** 플레이어 update(mixer) 뒤에 매 장면: speed = 지금 빠르기(칸/초) */
    update(dt, speed = 0) {
      k += Math.sign(want - k) * Math.min(Math.abs(want - k), dt / 0.35);
      d += Math.sign(dWant - d) * Math.min(Math.abs(dWant - d), dt / 0.45);
      go += (Math.min(1, speed / 1.2) - go) * (1 - Math.exp(-dt * 6));
      ph += dt * lerp(2.4, 6.5, go);
      if (k <= 0 && want <= 0) {
        if (model.rotation.x || model.position.y || model.position.z) { model.rotation.x = 0; model.position.set(0, 0, 0); restoreBones(); }
        return;
      }
      const ease = k * k * (3 - 2 * k);
      const place = bodyPlace(hipH, lerp(SWIM_PITCH, DIVE_PITCH, d) * ease, lerp(HIP_Y.swim, HIP_Y.dive, d) * ease);
      model.rotation.x = place.rx;
      model.position.set(0, place.y + (1 - ease) * 0, place.z);
      const p = pose(ph, go, d, ease);
      for (const b of BONES) {
        const o = bone[b], v = p[b];
        if (!o || !v) continue;
        // mixer 가 이 뼈를 다시 쓰지 않았으면(서기 클립에 없는 뼈) 지난번 덧돌림을 지우고 시작 — 쌓이지 않게
        if (last[b] && o.quaternion.equals(last[b])) o.quaternion.copy(base[b]);
        else base[b].copy(o.quaternion);
        if (v[0] || v[1] || v[2]) o.quaternion.premultiply(q.setFromEuler(e.set(v[0], v[1], v[2], 'YXZ')));
        (last[b] ??= new Quaternion()).copy(o.quaternion);
      }
    },
    /** 바로 끄기 (장면·순간이동) */
    reset() { want = k = 0; dWant = d = 0; model.rotation.x = 0; model.position.set(0, 0, 0); restoreBones(); },
  };
}
