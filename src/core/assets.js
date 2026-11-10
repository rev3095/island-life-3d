// 모델·스펙 불러오기. 웹 링크(아티팩트)에서는 .glb 와 data: fetch 가 막혀 있어
// tools/glb-to-json.mjs 가 만든 <이름>.glb.json (base64) 을 받아 GLTFLoader.parse 로 읽는다.
// 받기는 packs.js 가 한다: 게시본(웹 빌드)은 묶음 파일(packs/*.json)에서 꺼내고, 개발 서버는 파일을 하나씩 (M6-P0, docs/notes/m6-p0-pack.md).
// 웹 빌드(tools/build-web.mjs)의 로딩 화면은 window 의 'island:load' 이벤트로 진행을 받는다 (loadStats).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { readJSON, fromBase64 } from './packs.js';

/** 받은 파일 수, 그림 주소(url·urlNow — <img src> 용 blob URL), 게시본인지(packed), 묶음 상태 */
export { loadStats, url, urlNow, packed, packStatus, prefetchPacks } from './packs.js';

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
    const job = readJSON(url);
    job.catch(() => jsonCache.delete(url));   // 실패는 캐시에 남기지 않는다 → 나중에 다시 부르면 다시 받는다
    jsonCache.set(url, job);
  }
  return jsonCache.get(url);
}

/** base 는 확장자 없는 경로 (예: PATHS.env('tree')). 같은 모델은 한 번만 읽고 캐시한다. */
export function loadModel(base) {
  if (!gltfCache.has(base)) {
    const job = loadJSON(`${base}.glb.json`).then(j => {
      const bin = fromBase64(j.data);
      return new Promise((ok, no) => loader.parse(bin.buffer, '', ok, no));
    });
    job.catch(() => gltfCache.delete(base));
    gltfCache.set(base, job);
  }
  return gltfCache.get(base);
}

/** 불러온 모델을 장면에 넣을 사본으로 만든다 (뼈대가 있는 캐릭터도 안전하게 복제). */
export function instantiate(gltf) {
  return { scene: cloneSkinned(gltf.scene), animations: gltf.animations };
}

/** 확인용 (P40 성능 재기): 지금까지 읽은 모델·JSON 수 */
export const cacheStats = () => ({ models: gltfCache.size, json: jsonCache.size });
export const loadCharacter = slug => loadModel(PATHS.character(slug));
export const loadEnv = slug => loadModel(PATHS.env(slug));
export const loadCharacterSpec = slug => loadJSON(PATHS.characterSpec(slug));
export const loadEnvSpec = slug => loadJSON(PATHS.envSpec(slug));
export const loadEnvIndex = () => loadJSON('assets/env/index.json');
export const loadCharacterIndex = () => loadJSON('assets/models/index.json');
