// 포근섬 이야기 웹사이트 + 저장 서버 (Cloudflare Workers + D1).
// - 정적 파일(dist/site)은 Workers 정적 자산이 내주고, /api/* 만 이 Worker 가 받는다 (wrangler.jsonc run_worker_first).
// - 누구인지 = 브라우저 쿠키 island_uid (처음 오면 새로 만들어 심는다, HttpOnly). 로그인 없음.
//   게임은 GET api/ping 의 uid 를 쓴 사람 id 로 쓴다 (src/gameplay/visit/store.js devStore).
// - 길은 dev-server.mjs 흉내와 같다: /api/db/islands · /api/db/visits · POST /api/db/game-reports · /api/db/checks.
//   쓰기 판단은 게임·dev-server 와 같은 src/gameplay/visit/rules.js (남의 문서면 403).
import { canWriteIsland, canDeleteIsland, canWriteVisit } from '../src/gameplay/visit/rules.js';

const COOKIE = 'island_uid';
const YEAR2 = 60 * 60 * 24 * 365 * 2;
const APPEND_ONLY = new Set(['game-reports', 'checks']);
const APPEND_MAX = 200_000;     // 문제 알리기·점검 한 건 글자 수
const LIST_MAX = 500;

const rid = (n = 16) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
function readUid(req) {
  const m = (req.headers.get('cookie') ?? '').match(/(?:^|;\s*)island_uid=(w-[a-z0-9]{16})(?:;|$)/);
  return m ? m[1] : null;
}
const json = (code, data) => new Response(JSON.stringify(data), { status: code, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function getDoc(db, col, id) {
  const row = await db.prepare('SELECT data FROM docs WHERE col = ? AND id = ?').bind(col, id).first();
  return row ? JSON.parse(row.data) : null;
}
async function listDocs(db, col, code = null) {
  const q = code
    ? db.prepare('SELECT id, data FROM docs WHERE col = ? AND code = ? LIMIT ?').bind(col, code, LIST_MAX)
    : db.prepare('SELECT id, data FROM docs WHERE col = ? ORDER BY at DESC LIMIT ?').bind(col, LIST_MAX);
  const { results } = await q.all();
  return results.map(r => ({ ...JSON.parse(r.data), id: r.id }));
}
const putDoc = (db, col, id, doc, code = null) => db.prepare(
  'INSERT INTO docs (col, id, code, data, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET code = excluded.code, data = excluded.data, at = excluded.at',
).bind(col, id, code, JSON.stringify(doc), Date.now()).run();
async function readBody(req, max) {
  const text = await req.text();
  if (text.length > max) return { err: 'too-big' };
  try { return { data: JSON.parse(text || '{}') }; } catch { return { err: 'bad-json' }; }
}

async function islands(req, db, uid, id, url) {
  if (req.method === 'GET') {
    if (id) { const d = await getDoc(db, 'islands', id); return d ? json(200, { ...d, id }) : json(404, { code: 'not_found' }); }
    return json(200, await listDocs(db, 'islands', url.searchParams.get('code')));
  }
  if (!id) return json(404, { code: 'not_found' });
  const existing = await getDoc(db, 'islands', id);
  if (req.method === 'PUT') {
    const { data: next, err } = await readBody(req, 80_000);
    if (err) return json(400, { code: err, why: err });
    const same = next?.code ? await db.prepare('SELECT data FROM docs WHERE col = ? AND code = ? AND id != ? LIMIT 1').bind('islands', String(next.code), id).first() : null;
    const codeOwner = same ? JSON.parse(same.data).user ?? null : null;
    const v = canWriteIsland({ docId: id, uid, existing, next, codeOwner });
    if (!v.ok) return json(403, { code: 'permission_denied', why: v.why });
    const { id: _drop, ...doc } = next;
    await putDoc(db, 'islands', id, doc, doc.code);
    return json(200, { ok: true });
  }
  if (req.method === 'DELETE') {
    const v = canDeleteIsland({ docId: id, uid, existing });
    if (!v.ok) return json(403, { code: 'permission_denied', why: v.why });
    await db.prepare('DELETE FROM docs WHERE col = ? AND id = ?').bind('islands', id).run();
    return json(200, { ok: true });
  }
  return json(405, { code: 'method_not_allowed' });
}

async function visits(req, db, uid, id) {
  if (req.method === 'GET') {
    if (!id) return json(200, await listDocs(db, 'visits'));
    const d = await getDoc(db, 'visits', id);
    return d ? json(200, { ...d, id }) : json(404, { code: 'not_found' });
  }
  if (!id || req.method !== 'PUT') return json(405, { code: 'method_not_allowed' });
  const { data: next, err } = await readBody(req, 80_000);
  if (err) return json(400, { code: err, why: err });
  const existing = await getDoc(db, 'visits', id);
  const v = canWriteVisit({ docId: id, uid, existing, next });
  if (!v.ok) return json(403, { code: 'permission_denied', why: v.why });
  const { id: _drop, ...doc } = next;
  await putDoc(db, 'visits', id, doc);
  return json(200, { ok: true });
}

async function api(req, env, uid) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === '/api/ping') return json(200, { ok: true, uid });
  const db = env.DB;
  let m = path.match(/^\/api\/db\/islands(?:\/([\w-]{1,128}))?$/);
  if (m) return islands(req, db, uid, m[1] ?? null, url);
  m = path.match(/^\/api\/db\/visits(?:\/([\w-]{1,128}))?$/);
  if (m) return visits(req, db, uid, m[1] ?? null);
  m = path.match(/^\/api\/db\/([\w-]+)$/);
  if (m && APPEND_ONLY.has(m[1]) && req.method === 'POST') {
    const { data, err } = await readBody(req, APPEND_MAX);
    if (err) return json(400, { code: err });
    const id = `${Date.now().toString(36)}-${rid(6)}`;
    await putDoc(db, m[1], id, { ...data, by: uid });
    return json(200, { id });
  }
  return json(404, { code: 'not_found' });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    let uid = readUid(req);
    const fresh = !uid;
    if (fresh) uid = `w-${rid()}`;
    let res;
    try { res = await api(req, env, uid); } catch (e) { res = json(500, { code: 'server_error', message: String(e?.message ?? e) }); }
    if (fresh) {
      res = new Response(res.body, res);
      res.headers.append('set-cookie', `${COOKIE}=${uid}; Path=/; Max-Age=${YEAR2}; HttpOnly; Secure; SameSite=Lax`);
    }
    return res;
  },
};
