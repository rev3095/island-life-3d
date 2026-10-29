// 게임 파일 받기 층 (M6-P0). 게시본(웹 빌드)에서는 에셋을 묶음 파일(packs/<갈래>-<n>.json)에서 꺼내고,
// 개발 서버(/index.html)에서는 지금처럼 파일을 하나씩 받는다. three 를 부르지 않아 ui/dom.js·node 테스트도 쓴다.
//   readJSON(path)  JSON·.glb.json 읽기 — assets.loadJSON 이 캐시를 얹어 쓴다
//   url(path)       그림 경로 → <img src> 주소 (묶음 안이면 blob URL, 밖이면 경로 그대로). urlNow(path) 는 지금 바로 줄 수 있을 때만 (아니면 null)
//   loadStats       받은 파일 수 — 바뀔 때마다 window 'island:load' {…loadStats, url, ok} (웹 빌드 로딩 화면 tools/web-loader.html 이 듣는다)
// - 묶음 목록은 tools/build-web.mjs 가 페이지에 <script type="application/json" id="island-packs"> 로 넣는다. 없으면 묶음 없이.
// - boot 묶음은 이 파일이 읽히자마자 한꺼번에 받고, 나머지 묶음은 그 안의 파일을 처음 읽을 때 받는다.
// - 묶음 하나를 받는 동안 받은 바이트만큼 그 안의 파일 수를 나눠 센다 → 로딩 화면 진행이 큰 묶음에서도 고르게 움직인다.
// - 에셋 경로를 직접 fetch 하는 코드(스토리 장면 등, docs/notes/m6-p0-pack.md)를 위해 게시본에서는 window.fetch 가 묶음 안 경로를 묶음에서 대답한다.

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
/** 그림 경로면 그 MIME, 아니면 null (묶음 안에서 그림은 base64 글자, 나머지는 JSON 값) */
export const imageType = path => IMAGE_TYPES[/\.(\w+)$/.exec(path)?.[1]?.toLowerCase()] ?? null;

/** base64 → 바이트. 새 브라우저는 Uint8Array.fromBase64 가 빠르다 */
export function fromBase64(s) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(s);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- 받은 수 ----------

/** 받은 파일 수 (캐시에서 꺼낸 것은 세지 않는다). 묶음은 그 안의 파일 수로 센다 */
export const loadStats = { started: 0, done: 0, failed: 0, failedUrls: [] };
function emit(url, ok) {
  if (typeof CustomEvent === 'function') globalThis.dispatchEvent?.(new CustomEvent('island:load', { detail: { ...loadStats, url, ok } }));
}

// 잠깐 끊긴 연결·서버 오류·덜 받은 파일은 조금 쉬었다가 두 번 더 받아 본다 (404 같은 건 바로 실패)
const RETRY_MS = [400, 1500];
const wait = ms => new Promise(ok => setTimeout(ok, ms));
const nativeFetch = globalThis.fetch?.bind(globalThis);
async function fetchRetry(url, read) {
  for (let i = 0; ; i++) {
    let retry = true, err;
    try {
      const r = await nativeFetch(url, { cache: 'no-cache' });
      if (r.ok) return await read(r);
      retry = r.status >= 500 || r.status === 408 || r.status === 429;
      err = new Error(`불러오기 실패 (${r.status}): ${url}`);
    } catch (e) {
      err = new Error(`불러오기 실패: ${url} — ${e.message ?? e}`);
    }
    if (!retry || i >= RETRY_MS.length) throw err;
    await wait(RETRY_MS[i]);
  }
}

function fetchFile(url) {
  loadStats.started++;
  emit(url, null);
  return fetchRetry(url, r => r.json()).then(
    j => { loadStats.done++; emit(url, true); return j; },
    e => { loadStats.failed++; loadStats.failedUrls.push(url); emit(url, false); throw e; },
  );
}

// ---------- 묶음 ----------

function readManifest() {
  try {
    const el = globalThis.document?.getElementById?.('island-packs');
    return el ? JSON.parse(el.textContent) : null;
  } catch (e) {
    console.warn('[assets] 묶음 목록을 읽지 못했어요 — 파일을 하나씩 받아요', e);
    return null;
  }
}
const manifest = readManifest();
/** 게시본(묶음 목록이 있는 페이지)인가 */
export const packed = !!manifest;
const where = new Map();          // 경로 → 묶음 번호
manifest?.packs.forEach((p, i) => p.files.forEach(f => where.set(f, i)));
const base = packed ? new URL('.', globalThis.document.baseURI) : null;
const packJobs = new Map();       // 묶음 번호 → Promise<{ 경로: 값 }>
const packState = new Map();      // 묶음 번호 → 'loading' | 'ready' | 'failed'

/** 주소(글자·URL·Request) → 묶음 안 경로 (페이지 기준 상대 경로), 묶음 밖이면 null */
function packedPath(input) {
  if (!packed) return null;
  let u;
  try { u = new URL(typeof input === 'string' ? input : input?.href ?? input?.url ?? String(input), globalThis.document.baseURI); } catch { return null; }
  if (u.origin !== base.origin || !u.pathname.startsWith(base.pathname)) return null;
  const rel = decodeURIComponent(u.pathname.slice(base.pathname.length));
  return where.has(rel) ? rel : null;
}

/** 본문 읽기 + 받은 바이트 알리기. 바이트는 복제본 스트림에서 세고 본문은 r.text() 로 받는다
 *  (본문 스트림을 직접 다 읽으면 Chrome 이 시작 때 큰 묶음 받기를 '취소됨(ERR_ABORTED)' 으로 적는다 — 받은 것은 같지만 헷갈린다) */
async function readText(r, onBytes) {
  const watch = r.body && typeof r.clone === 'function' ? r.clone().body?.getReader?.() : null;
  if (watch) (async () => {
    for (let got = 0; ;) {
      const { done, value } = await watch.read();
      if (done) break;
      onBytes(got += value.length);
    }
  })().catch(() => {});
  return r.text();
}

function loadPack(i) {
  if (!packJobs.has(i)) {
    const p = manifest.packs[i], n = p.files.length;
    let shown = 0;                 // 이 묶음에서 '받음' 으로 센 파일 수
    const show = k => { loadStats.done += k - shown; shown = k; };
    loadStats.started += n;
    packState.set(i, 'loading');
    emit(p.path, null);
    const job = fetchRetry(p.path, async r => {
      show(0);                     // 다시 받기면 처음부터 센다
      let live = true;             // 이 받기가 끝난 뒤 늦게 오는 바이트 알림은 버린다
      try {
        const text = await readText(r, got => {
          const k = Math.min(n - 1, Math.floor(n * got / p.bytes));
          if (live && k > shown) { show(k); emit(p.path, null); }
        });
        return JSON.parse(text).files;   // 덜 받은 묶음은 여기서 깨져서 다시 받는다
      } finally {
        live = false;
      }
    }).then(
      files => { show(n); packState.set(i, 'ready'); emit(p.path, true); return files; },
      e => {
        show(0);
        loadStats.failed += n;
        loadStats.failedUrls.push(p.path);
        packJobs.delete(i);        // 실패는 남기지 않는다 → 나중에 다시 부르면 다시 받는다
        packState.set(i, 'failed');
        emit(p.path, false);
        throw e;
      },
    );
    packJobs.set(i, job);
  }
  return packJobs.get(i);
}

async function entry(path) {
  const files = await loadPack(where.get(path));
  if (!(path in files)) throw new Error(`묶음에 없는 파일: ${path}`);
  return files[path];
}

/** JSON 읽기: 묶음 안이면 묶음에서, 밖이면 파일을 받는다 (캐시는 부르는 쪽 몫) */
export function readJSON(url) {
  const p = packedPath(url);
  return p == null ? fetchFile(url) : entry(p);
}

// ---------- 그림 주소 ----------

const urlJobs = new Map();        // 경로 → Promise<주소>
const urlReady = new Map();       // 경로 → 주소 (다 만든 것)
let blobOk = null;                // blob: 그림이 되는 곳인가 — 첫 그림으로 한 번 본다 (CSP 가 막으면 data: URL 로)
async function imageUrl(b64, type) {
  const blob = URL.createObjectURL(new Blob([fromBase64(b64)], { type }));
  blobOk ??= typeof Image !== 'function' ? Promise.resolve(true) : new Promise(ok => {
    const im = new Image();
    im.onload = () => ok(true);
    im.onerror = () => ok(false);
    im.src = blob;
  });
  return (await blobOk) ? blob : `data:${type};base64,${b64}`;
}

/** 그림 경로 → <img src> 에 넣을 주소 (Promise). 묶음 밖이면 경로 그대로 */
export function url(path) {
  const p = packedPath(path);
  if (p == null) return Promise.resolve(path);
  if (!urlJobs.has(p)) {
    const job = entry(p).then(b64 => imageUrl(b64, imageType(p) ?? 'application/octet-stream'));
    job.then(u => urlReady.set(p, u), () => urlJobs.delete(p));
    urlJobs.set(p, job);
  }
  return urlJobs.get(p);
}

/** 지금 바로 줄 수 있는 주소: 묶음 밖이면 경로 그대로, 묶음 안이면 만들어 둔 주소 또는 null (그때는 url() 을 기다린다) */
export function urlNow(path) {
  const p = packedPath(path);
  return p == null ? path : urlReady.get(p) ?? null;
}

/** 묶음 상태 (확인용): [{ path, boot, files, bytes, state }] — 개발 서버에서는 [] */
export const packStatus = () => (manifest?.packs ?? []).map((p, i) => ({ path: p.path, boot: !!p.boot, files: p.files.length, bytes: p.bytes, state: packState.get(i) ?? 'idle' }));

// ---------- 게시본에서만: 처음 묶음 받기 + fetch 덮개 ----------

if (packed) {
  if (nativeFetch) {
    globalThis.fetch = function fetch(input, init) {
      const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
      const p = method === 'GET' ? packedPath(input) : null;
      if (p == null) return nativeFetch(input, init);
      return entry(p).then(v => {
        const type = imageType(p);
        const body = type ? new Blob([fromBase64(v)], { type }) : JSON.stringify(v);
        return new Response(body, { status: 200, headers: { 'content-type': type ?? 'application/json; charset=utf-8' } });
      });
    };
  }
  manifest.packs.forEach((p, i) => { if (p.boot) loadPack(i).catch(() => {}); });
}
