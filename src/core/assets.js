// 모델·스펙 불러오기. 웹 링크(아티팩트)에서는 .glb 와 data: fetch 가 막혀 있어
// tools/glb-to-json.mjs 가 만든 <이름>.glb.json (base64) 을 받아 GLTFLoader.parse 로 읽는다.
// 웹 빌드(tools/build-web.mjs)의 로딩 화면은 window 의 'island:load' 이벤트로 진행을 받는다.
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

/** 받은 파일 수 (캐시에서 꺼낸 것은 세지 않는다). 바뀔 때마다 window 에 'island:load' {…loadStats, url, ok} */
export const loadStats = { started: 0, done: 0, failed: 0, failedUrls: [] };
function report(url, ok) {
  if (ok === null) loadStats.started++;
  else if (ok) loadStats.done++;
  else { loadStats.failed++; loadStats.failedUrls.push(url); }
  if (typeof CustomEvent === 'function') globalThis.dispatchEvent?.(new CustomEvent('island:load', { detail: { ...loadStats, url, ok } }));
}

// 잠깐 끊긴 연결·서버 오류·덜 받은 파일은 조금 쉬었다가 두 번 더 받아 본다 (404 같은 건 바로 실패)
const RETRY_MS = [400, 1500];
const wait = ms => new Promise(ok => setTimeout(ok, ms));
async function fetchJSON(url) {
  for (let i = 0; ; i++) {
    let retry = true, err;
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) return await r.json();
      retry = r.status >= 500 || r.status === 408 || r.status === 429;
      err = new Error(`불러오기 실패 (${r.status}): ${url}`);
    } catch (e) {
      err = new Error(`불러오기 실패: ${url} — ${e.message ?? e}`);
    }
    if (!retry || i >= RETRY_MS.length) throw err;
    await wait(RETRY_MS[i]);
  }
}

export function loadJSON(url) {
  if (!jsonCache.has(url)) {
    report(url, null);
    const job = fetchJSON(url).then(
      j => { report(url, true); return j; },
      e => { jsonCache.delete(url); report(url, false); throw e; },   // 실패는 캐시에 남기지 않는다 → 나중에 다시 부르면 다시 받는다
    );
    jsonCache.set(url, job);
  }
  return jsonCache.get(url);
}

/** base64 → 바이트. 새 브라우저는 Uint8Array.fromBase64 가 빠르다 */
function fromBase64(s) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(s);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

export const loadCharacter = slug => loadModel(PATHS.character(slug));
export const loadEnv = slug => loadModel(PATHS.env(slug));
export const loadCharacterSpec = slug => loadJSON(PATHS.characterSpec(slug));
export const loadEnvSpec = slug => loadJSON(PATHS.envSpec(slug));
export const loadEnvIndex = () => loadJSON('assets/env/index.json');
export const loadCharacterIndex = () => loadJSON('assets/models/index.json');
