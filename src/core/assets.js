// 모델·스펙 불러오기. 웹 링크(아티팩트)에서는 .glb 와 data: fetch 가 막혀 있어
// tools/glb-to-json.mjs 가 만든 <이름>.glb.json (base64) 을 받아 GLTFLoader.parse 로 읽는다.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const gltfCache = new Map();
const jsonCache = new Map();

export const PATHS = {
  character: slug => `assets/models/${slug}`,     // 캐릭터 9종: player, coco, bori, mochi, dubu, pong, chorong, bamtol, neuru
  env: slug => `assets/env/models/${slug}`,       // 배경 32종: assets/env/index.json 참고
  characterSpec: slug => `assets/specs/${slug}.json`,
  envSpec: slug => `assets/env/specs/${slug}.json`,
};

export function loadJSON(url) {
  if (!jsonCache.has(url)) {
    jsonCache.set(url, fetch(url, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`불러오기 실패: ${url}`);
      return r.json();
    }));
  }
  return jsonCache.get(url);
}

/** base 는 확장자 없는 경로 (예: PATHS.env('tree')). 같은 모델은 한 번만 읽고 캐시한다. */
export function loadModel(base) {
  if (!gltfCache.has(base)) {
    gltfCache.set(base, loadJSON(`${base}.glb.json`).then(j => {
      const bin = Uint8Array.from(atob(j.data), c => c.charCodeAt(0));
      return new Promise((ok, no) => loader.parse(bin.buffer, '', ok, no));
    }));
  }
  return gltfCache.get(base);
}

/** 불러온 모델을 장면에 넣을 사본으로 만든다 (뼈대가 있는 캐릭터도 안전하게 복제). */
export function instantiate(gltf) {
  return { scene: cloneSkinned(gltf.scene), animations: gltf.animations };
}

export const loadCharacter = slug => loadModel(PATHS.character(slug));
export const loadEnv = slug => loadModel(PATHS.env(slug));
export const loadCharacterSpec = slug => loadJSON(PATHS.characterSpec(slug));
export const loadEnvSpec = slug => loadJSON(PATHS.envSpec(slug));
export const loadEnvIndex = () => loadJSON('assets/env/index.json');
export const loadCharacterIndex = () => loadJSON('assets/models/index.json');
