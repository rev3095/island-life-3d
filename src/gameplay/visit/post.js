// M21-P4 방명록·편지·선물 저장소: 게시본 = 게임 아티팩트 저장소 visits/<쓴 사람 uid> (claude.use('db')),
// 개발 서버 = /api/db/visits 흉내 (dev-server.mjs, 같은 canWriteVisit 판단 — 남의 글이면 403).
// 쓴 사람 id 는 visit 서비스(P2 store.js)가 이미 정한 것을 받는다 (개발 서버는 같은 localStorage 열쇠 → 머리글 x-island-user).
// 둘 다 없으면 null → guestbook 이 조용히 꺼 둔다. 노트 docs/notes/m21-p4-guestbook.md.
import { VISITS, visitPath, canWriteVisit } from './rules.js';

const TIMEOUT = 10000;
const withTimeout = (p, ms = TIMEOUT) => {
  let t;
  return Promise.race([Promise.resolve(p).catch(() => null), new Promise(res => { t = setTimeout(() => res(null), ms); })]).finally(() => clearTimeout(t));
};

/** 아티팩트 저장소 → { kind:'db', uid, mine, putMine, all } | null */
async function artifactPost(claude, uid) {
  const db = await withTimeout(claude.use('db'));
  if (!db) return null;
  const read = async path => { const s = await db.doc(path).get(); return s.exists ? s.data() : null; };
  return {
    kind: 'db', uid,
    mine: () => read(visitPath(uid)),
    async putMine(next) {
      const existing = await read(visitPath(uid));
      const verdict = canWriteVisit({ docId: uid, uid, existing, next });
      if (!verdict.ok) return verdict;
      await db.doc(visitPath(uid)).set(next);
      return { ok: true };
    },
    async all() {
      const qs = await db.collection(VISITS).limit(500).get();
      return qs.docs.map(d => ({ ...d.data(), id: d.id }));
    },
  };
}

/** 개발 서버 흉내 */
function devPost(fetchFn, uid) {
  const headers = { 'content-type': 'application/json', 'x-island-user': uid };
  const call = async (method, path, body) => {
    const r = await fetchFn(`api/db/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => null);
    return r.ok ? { ok: true, data } : { ok: false, why: data?.why ?? data?.code ?? `http-${r.status}` };
  };
  return {
    kind: 'local', uid,
    mine: async () => { const r = await call('GET', visitPath(uid)); return r.ok ? r.data : null; },
    putMine: async doc => call('PUT', visitPath(uid), doc),
    all: async () => { const r = await call('GET', VISITS); return r.ok && Array.isArray(r.data) ? r.data : []; },
  };
}

/**
 * 저장소 열기 → store | null. uid = visit 서비스의 쓴 사람 id, kind = 'db' | 'local'.
 * @param {{ uid: string, kind: string, claude?: any, fetchFn?: Function }} o
 */
export async function openPost({ uid, kind, claude = globalThis.claude, fetchFn = globalThis.fetch?.bind(globalThis) }) {
  if (!uid) return null;
  if (kind === 'db' && claude?.use) return artifactPost(claude, uid);
  if (kind === 'local' && fetchFn) return devPost(fetchFn, uid);
  return null;
}
