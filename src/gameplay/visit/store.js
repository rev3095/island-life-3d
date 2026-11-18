// M21-P2 섬 사진 저장소: 게시본 = 게임 아티팩트 저장소 (claude.use('db') · 'user'), 개발 서버 = /api/db/islands 흉내.
// 둘 다 없으면 null → visit 모듈이 조용히 끈다. 쓰기 판단은 rules.js canWriteIsland 를 먼저 거친다
// (게시본은 플랫폼 rules 가 진짜로 막고, 이 판단은 친절한 거절·개발 서버 흉내용).
import { ISLANDS, islandPath, canWriteIsland, canDeleteIsland } from './rules.js';

const TIMEOUT = 10000;
function withTimeout(p, ms = TIMEOUT) {
  let t;
  return Promise.race([Promise.resolve(p).catch(() => null), new Promise(res => { t = setTimeout(() => res(null), ms); })]).finally(() => clearTimeout(t));
}

/** 개발용 쓴 사람 id (브라우저마다 하나, localStorage) */
function devUid() {
  const KEY = 'island-life-dev-uid';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = `dev-${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem(KEY, id); }
    return id;
  } catch { return 'dev-local'; }
}

/** 아티팩트 저장소 → { kind:'db', uid, get, put, remove, list } | null */
async function artifactStore(claude) {
  if (!claude?.use) return null;
  const [db, user] = await Promise.all([withTimeout(claude.use('db')), withTimeout(claude.use('user'))]);
  if (!db || !user?.id) return null;
  const uid = await withTimeout(user.id());
  if (!uid) return null;
  // 쓸 수 없는 사람(공유 링크로 본 사람 등)은 null → 보여 주기는 끈다 (구경은 P3 가 따로 read 로)
  let canWrite = null;
  try { canWrite = user.can?.('data.write') ?? null; } catch { canWrite = null; }
  const read = async path => { const s = await db.doc(path).get(); return s.exists ? s.data() : null; };
  return {
    kind: 'db', uid, writable: canWrite !== false,
    get: id => read(islandPath(id)),
    async put(doc) {
      const existing = await read(islandPath(uid));
      const same = await db.collection(ISLANDS).where('code', '==', doc?.code ?? '').limit(1).get().catch(() => null);
      const codeOwner = same?.docs?.[0]?.data()?.user ?? null;
      const verdict = canWriteIsland({ docId: uid, uid, existing, next: doc, codeOwner });
      if (!verdict.ok) return verdict;
      await db.doc(islandPath(uid)).set(doc);
      return { ok: true };
    },
    async remove() {
      const existing = await read(islandPath(uid));
      if (!existing) return { ok: true };
      const verdict = canDeleteIsland({ docId: uid, uid, existing });
      if (!verdict.ok) return verdict;
      await db.doc(islandPath(uid)).delete();
      return { ok: true };
    },
    async list() {
      const qs = await db.collection(ISLANDS).limit(500).get();
      return qs.docs.map(d => d.data());
    },
    async byCode(code) {
      const qs = await db.collection(ISLANDS).where('code', '==', code).limit(1).get();
      return qs.docs[0]?.data() ?? null;
    },
  };
}

/** 개발 서버 흉내 (dev-server.mjs /api/db/islands) */
async function devStore(fetchFn) {
  if (!fetchFn) return null;
  const ok = await withTimeout(fetchFn('api/ping').then(r => r.ok, () => false), 3000);
  if (!ok) return null;
  const uid = devUid();
  const headers = { 'content-type': 'application/json', 'x-island-user': uid };
  const call = async (method, path, body) => {
    const r = await fetchFn(`api/db/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => null);
    return r.ok ? { ok: true, data } : { ok: false, why: data?.why ?? data?.code ?? `http-${r.status}` };
  };
  return {
    kind: 'local', uid, writable: true,
    get: async id => { const r = await call('GET', `${ISLANDS}/${id}`); return r.ok ? r.data : null; },
    put: async doc => call('PUT', `${ISLANDS}/${uid}`, doc),
    remove: async () => call('DELETE', `${ISLANDS}/${uid}`),
    list: async () => { const r = await call('GET', ISLANDS); return r.ok && Array.isArray(r.data) ? r.data : []; },
    byCode: async code => { const r = await call('GET', `${ISLANDS}?code=${code}`); return r.ok && Array.isArray(r.data) ? r.data[0] ?? null : null; },
  };
}

/**
 * 저장소 열기 → store | null. 게시본(claude 있음)은 아티팩트 저장소만, 그 밖은 개발 서버만.
 * @param {{ claude?: any, fetchFn?: Function }} o
 */
export async function openStore({ claude = globalThis.claude, fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
  if (claude) return artifactStore(claude);
  return devStore(fetchFn);
}
