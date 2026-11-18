// M21-P2 친구 섬 구경 — 순수 규칙 (three·DOM·저장소 없음, 테스트와 dev-server 가 같이 쓴다).
// 보드 wave17: D281-A (보여 주기를 켠 사람만, 기본 꺼짐) · D284-A (섬 코드 6자리) · D285-A (날마다 바뀌는 「오늘의 섬」 셋).
// 노트 docs/notes/m21-p2-share.md.

/** 섬 코드 글자: 헷갈리는 0 O 1 I L 은 뺀 대문자·숫자 31자 */
export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 6;
/** 섬 사진 모양 판 (바뀌면 올림 — 구경 섬이 모르는 판은 건너뛴다) */
export const SNAP_VERSION = 1;
/** 저장소 컬렉션 — 섬 사진은 islands/<쓴 사람 id> (문서 안에 code), 방명록 등은 visits/… (M21-P4) */
export const ISLANDS = 'islands';
export const VISITS = 'visits';
/** 오늘의 섬 수 (D285-A) */
export const TODAY_COUNT = 3;
/** 섬 사진 하나의 크기 한도 (글자 수) — 저장소 문서가 커지지 않게 */
export const SNAP_MAX_CHARS = 60000;

/** 0 ≤ r < 1 을 주는 rng → 섬 코드 6자리 */
export function makeCode(rng = Math.random) {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[Math.floor(rng() * CODE_CHARS.length) % CODE_CHARS.length];
  return s;
}

/** 사람이 친 글을 섬 코드 꼴로 (공백·하이픈 빼고 대문자) → 맞으면 코드, 아니면 null (0 O 1 I L 이 섞이면 코드가 아님) */
export function normalizeCode(text) {
  const s = String(text ?? '').toUpperCase().replace(/[\s-]/g, '');
  return isCode(s) ? s : null;
}
export const isCode = s => typeof s === 'string' && s.length === CODE_LEN && [...s].every(c => CODE_CHARS.includes(c));

/** 쓴 사람 id 가 문서 id 로 쓸 수 있는 글자인가 (저장소 경로 한 칸) */
export const isUid = u => typeof u === 'string' && /^[\w-]{1,128}$/.test(u);
export const islandPath = uid => `${ISLANDS}/${uid}`;

const pickKeys = (o, keys) => {
  if (!o || typeof o !== 'object') return undefined;
  const out = {};
  for (const k of keys) if (o[k] != null) out[k] = o[k];
  return Object.keys(out).length ? out : undefined;
};
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
/** 주민 칸 중 겉모양만 (친밀도·대화·부탁·선물 기록은 넣지 않는다) */
export const VILLAGER_LOOK_KEYS = ['outfit', 'hat', 'top', 'look', 'lot', 'home'];

/**
 * 섬 사진: 지금 섬을 구경 섬으로 다시 세울 수 있는 최소 자료.
 * 넣는 것 = 시드 · island.added(놓은 것) · island.built(다리·경사로) · removed(치운 나무 등) · 집 겉모양 단계 · 주민 목록과 겉모양 · 섬 이름 · 주인공 이름 · 옷.
 * 넣지 않는 것 = 가방 · 도토리 · 박물관 · 편지 · 친밀도 · 저장 전체.
 * @param {object} state 게임 상태
 * @param {{ residents?: string[], dayKey?: string, now?: number }} extra
 */
export function snapshot(state, { residents, dayKey = '', now = 0 } = {}) {
  const island = state?.island ?? {};
  const player = state?.player ?? {};
  const slugs = Array.isArray(residents) ? residents : Object.keys(state?.villagers ?? {});
  return {
    v: SNAP_VERSION,
    island: {
      name: String(island.name ?? '').slice(0, 20),
      seed: island.seed ?? null,
      added: clone(Array.isArray(island.added) ? island.added : []),
      built: clone(Array.isArray(island.built) ? island.built : []),
      removed: clone(Array.isArray(island.removed) ? island.removed : []),
    },
    house: { stage: Number(state?.house?.grow?.stage) || 0 },
    player: {
      name: String(player.name ?? '').slice(0, 20),
      hair: player.hair ?? null,
      shirt: player.shirt ?? null,
      outfit: clone(player.outfit ?? null),
    },
    villagers: slugs.filter(s => typeof s === 'string').map(slug => ({ slug, ...(pickKeys(state?.villagers?.[slug], VILLAGER_LOOK_KEYS) ?? {}) })),
    dayKey,
    at: now,
  };
}

/** 저장소에 올릴 문서: { code, user, snap, dayKey, at } */
export function islandDoc({ code, user, snap, dayKey = '', now = 0, hide = null }) {
  const doc = { code, user, v: SNAP_VERSION, snap, dayKey, at: now };
  if (Array.isArray(hide) && hide.length) doc.hide = hide.filter(isNoteKey).slice(-HIDE_MAX);   // M21-P4 주인이 숨긴 글 (noteKey 목록)
  return doc;
}

/** 오늘 올려야 하나: 켜져 있고 오늘 아직 안 올렸으면 */
export function needsUpload(visit, dayKey) {
  return !!visit?.share && !!visit.code && visit.lastPut !== dayKey;
}

/** 날짜 글자 → 32비트 시드 (FNV-1a) */
export function daySeed(dayKey) {
  let h = 0x811c9dc5;
  for (const c of String(dayKey)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** mulberry32 */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 「오늘의 섬」 셋 고르기 (D285-A, 순수): 같은 날·같은 목록이면 누구에게나 같은 셋.
 * list = 섬 문서들 ({ code, user, … }) — 순서와 상관없게 code 로 정렬해서 고른다. 내 섬(mine = 내 code)은 뺀다.
 * @returns 고른 문서 n 개 (모자라면 있는 만큼)
 */
export function todayPicks(list, dayKey, { n = TODAY_COUNT, mine = null } = {}) {
  const pool = (Array.isArray(list) ? list : [])
    .filter(d => d && isCode(d.code) && d.code !== mine)
    .filter((d, i, a) => a.findIndex(x => x.code === d.code) === i)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const rng = seededRng(daySeed(dayKey));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/** 문서 목록에서 코드로 찾기 (normalizeCode 를 거친다) */
export function findCode(list, text) {
  const code = normalizeCode(text);
  if (!code) return null;
  return (Array.isArray(list) ? list : []).find(d => d?.code === code) ?? null;
}

// ---------- 저장소 규칙 (게시본은 플랫폼 rules, 개발 서버·게임은 이 함수로 같은 판단) ----------

/**
 * 섬 사진 쓰기 판단 (순수) → { ok: true } | { ok: false, why }.
 * - 문서 id(경로 끝) = 쓴 사람 id 여야 한다 (남의 칸에는 못 쓴다)
 * - 이미 있는 문서의 user 가 다르면 거절 (남의 섬 덮어쓰기 금지)
 * - 새 문서의 user 는 쓴 사람 id 와 같아야 한다
 * - 코드는 6자리 꼴, 다른 사람이 이미 쓰는 코드면 거절 (codeOwner = 그 코드를 쓰는 문서의 user)
 * @param {{ docId: string, uid: string, existing?: object|null, next: object, codeOwner?: string|null }} a
 */
export function canWriteIsland({ docId, uid, existing = null, next, codeOwner = null }) {
  if (!isUid(uid)) return { ok: false, why: 'no-user' };
  if (docId !== uid) return { ok: false, why: 'not-own-path' };
  if (existing && existing.user !== uid) return { ok: false, why: 'not-owner' };
  if (!next || next.user !== uid) return { ok: false, why: 'user-mismatch' };
  if (!isCode(next.code)) return { ok: false, why: 'bad-code' };
  if (codeOwner && codeOwner !== uid) return { ok: false, why: 'code-taken' };
  if (next.hide != null && !(Array.isArray(next.hide) && next.hide.length <= HIDE_MAX && next.hide.every(isNoteKey))) return { ok: false, why: 'bad-hide' };   // M21-P4 숨김 목록
  if (JSON.stringify(next).length > SNAP_MAX_CHARS) return { ok: false, why: 'too-big' };
  return { ok: true };
}
/** 섬 사진 지우기 판단: 자기 문서만 */
export function canDeleteIsland({ docId, uid, existing = null }) {
  if (!isUid(uid)) return { ok: false, why: 'no-user' };
  if (docId !== uid) return { ok: false, why: 'not-own-path' };
  if (existing && existing.user !== uid) return { ok: false, why: 'not-owner' };
  return { ok: true };
}


// ---------- M21-P4 방명록 도장 · 고른 문장 편지 · 선물 (17차 보드 wave17 D283-A · D284-A · D286-A) ----------
// 저장 모양 (노트 docs/notes/m21-p4-guestbook.md):
//   visits/<쓴 사람 uid> = { user, v, from: { name, island, code }, notes: [글…], at }   — 쓴 사람 한 사람에 문서 하나
//   글 = { id, to: <받는 섬 코드>, kind: 'stamp'|'letter'|'gift', line: <문장·도장 id>, item?: <아이템 id — gift 만>, day, at }
// 플랫폼 규칙은 경로만 보므로 「자기 것만 쓰기」 = 경로 칸 visits/{self}. 섬 주인은 남의 글을 고치지 않고
// 자기 섬 문서 islands/<주인 uid> 의 hide: [noteKey…] 로 숨긴다 (그것도 자기 문서만 — canWriteIsland).
// 받는 쪽은 visits 를 모두 읽어 to === 내 코드 인 글만 고른다 (inbox). 글 내용은 문장 표 id 뿐이라 자유 글이 없다 —
// 받는 쪽은 자기 문장 표(assets/visit/lines.json)에 있는 id 만 그린다.

export const VISIT_KINDS = ['stamp', 'letter', 'gift'];
/** 하루에 남길 수 있는 섬 수 (D286-A) */
export const LEAVE_ISLANDS_PER_DAY = 3;
/** 쓴 사람 문서에 남겨 두는 글 수 (오래된 것부터 뺌) */
export const NOTES_KEEP = 60;
/** 섬 주인 숨김 목록 최대 */
export const HIDE_MAX = 200;
/** 방문 도장 기념 가구 (D287-A FU-109–112): 도장 찍은 섬 수 → 가구 */
export const STAMP_REWARDS = [
  { n: 1, item: 'furn.friend-island-frame' },
  { n: 3, item: 'furn.guestbook-desk' },
  { n: 5, item: 'furn.stamp-flag' },
  { n: 10, item: 'furn.ship-model' },
];

const ID_RE = /^[\w-]{1,32}$/;
const ITEM_RE = /^[\w.-]{1,64}$/;
export const visitPath = uid => `${VISITS}/${uid}`;
/** 글 하나를 가리키는 열쇠 '<쓴 사람 uid>/<글 id>' */
export const noteKey = (writer, id) => `${writer}/${id}`;
export const isNoteKey = k => typeof k === 'string' && k.length <= 170 && /^[\w-]{1,128}\/[\w-]{1,32}$/.test(k);

const NOTE_KEYS = new Set(['id', 'to', 'kind', 'line', 'item', 'day', 'at']);
/** 글 하나가 약속한 모양인가 (자유 글 칸이 없어야 한다) */
export function isNote(n) {
  if (!n || typeof n !== 'object' || Array.isArray(n)) return false;
  if (Object.keys(n).some(k => !NOTE_KEYS.has(k))) return false;
  if (!ID_RE.test(n.id ?? '') || !isCode(n.to) || !VISIT_KINDS.includes(n.kind) || !ID_RE.test(n.line ?? '')) return false;
  if (n.kind === 'gift' ? !ITEM_RE.test(n.item ?? '') : n.item != null) return false;
  if (n.day != null && !(typeof n.day === 'string' && n.day.length <= 10)) return false;
  if (n.at != null && typeof n.at !== 'number') return false;
  return true;
}
const FROM_KEYS = new Set(['name', 'island', 'code']);
const isFrom = f => f == null || (typeof f === 'object' && !Array.isArray(f) && Object.keys(f).every(k => FROM_KEYS.has(k))
  && ['name', 'island'].every(k => f[k] == null || (typeof f[k] === 'string' && f[k].length <= 20)) && (f.code == null || isCode(f.code)));

/**
 * 방명록·편지·선물 문서 쓰기 판단 (순수 — 게임·개발 서버가 같이 씀) → { ok } | { ok:false, why }.
 * - 문서 id = 쓴 사람 id (visits/{self}) — 남의 칸은 not-own-path
 * - 이미 있는 문서의 user 가 다르면 not-owner (남의 글 덮어쓰기 금지), 새 문서 user = 쓴 사람
 * - 글은 약속한 모양만 (자유 글 칸 없음), 수는 NOTES_KEEP 까지
 */
export function canWriteVisit({ docId, uid, existing = null, next }) {
  if (!isUid(uid)) return { ok: false, why: 'no-user' };
  if (docId !== uid) return { ok: false, why: 'not-own-path' };
  if (existing && existing.user !== uid) return { ok: false, why: 'not-owner' };
  if (!next || next.user !== uid) return { ok: false, why: 'user-mismatch' };
  if (!Array.isArray(next.notes) || next.notes.length > NOTES_KEEP || !next.notes.every(isNote)) return { ok: false, why: 'bad-note' };
  if (new Set(next.notes.map(n => n.id)).size !== next.notes.length) return { ok: false, why: 'bad-note' };
  if (!isFrom(next.from)) return { ok: false, why: 'bad-from' };
  if (JSON.stringify(next).length > SNAP_MAX_CHARS) return { ok: false, why: 'too-big' };
  return { ok: true };
}

/** 내 문서에 글 하나 더한 새 문서 (오래된 것부터 NOTES_KEEP 까지) */
export function addNote(doc, { uid, from, note, now = 0 }) {
  const notes = [...(Array.isArray(doc?.notes) ? doc.notes : []).filter(isNote), note].slice(-NOTES_KEEP);
  return { user: uid, v: 1, from, notes, at: now };
}

/** 섬 주인 숨기기: 내 숨김 목록에 열쇠를 넣거나 뺀 새 목록 (순수) */
export function toggleHide(hide, key, on = true) {
  const list = (Array.isArray(hide) ? hide : []).filter(k => isNoteKey(k) && k !== key);
  if (on && isNoteKey(key)) list.push(key);
  return list.slice(-HIDE_MAX);
}

/**
 * 받은 글 고르기 (순수): visits 문서들 → 내 섬 코드로 온 글 (새것부터).
 * 문서 id(있으면)와 user 가 다르면 버린다 (남의 칸에 쓴 글). lineOk(kind, line) 가 false 인 글(모르는 문장)도 버린다.
 * → [{ key, writer, from, …글, hidden }]
 */
export function inbox(docs, code, { hide = [], mine = null, lineOk = () => true } = {}) {
  if (!isCode(code)) return [];
  const hidden = new Set(Array.isArray(hide) ? hide : []);
  const out = [];
  for (const d of Array.isArray(docs) ? docs : []) {
    const writer = d?.user;
    if (!isUid(writer) || writer === mine || (d.id != null && d.id !== writer) || !isFrom(d.from)) continue;
    for (const n of Array.isArray(d.notes) ? d.notes : []) {
      if (!isNote(n) || n.to !== code || !lineOk(n.kind, n.line)) continue;
      const key = noteKey(writer, n.id);
      out.push({ ...n, key, writer, from: { name: d.from?.name ?? '', island: d.from?.island ?? '', code: d.from?.code ?? null }, hidden: hidden.has(key) });
    }
  }
  return out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

/** 오늘 남기기 기록 (state.visit.left = { day, islands: { <코드>: [kind…] } }) — 날이 바뀌면 비운다 */
export function leftToday(left, day) {
  return left?.day === day && left.islands && typeof left.islands === 'object' ? left : { day, islands: {} };
}
/** 이 섬에 이 종류를 남길 수 있나 → { ok } | { ok:false, why: 'day-full'|'same'|'bad' } (하루 세 섬, 섬마다 종류 하나씩) */
export function canLeave(left, day, code, kind) {
  if (!isCode(code) || !VISIT_KINDS.includes(kind)) return { ok: false, why: 'bad' };
  const L = leftToday(left, day);
  const kinds = L.islands[code];
  if (!kinds && Object.keys(L.islands).length >= LEAVE_ISLANDS_PER_DAY) return { ok: false, why: 'day-full' };
  if (kinds?.includes(kind)) return { ok: false, why: 'same' };
  return { ok: true };
}
/** 남긴 것 기록한 새 left */
export function recordLeave(left, day, code, kind) {
  const L = leftToday(left, day);
  return { day, islands: { ...L.islands, [code]: [...(L.islands[code] ?? []), kind] } };
}
/** 도장 찍은 섬 수 → 아직 안 받은 기념 가구 목록 */
export function stampRewardsDue(count, given = []) {
  return STAMP_REWARDS.filter(r => count >= r.n && !given.includes(r.item));
}
