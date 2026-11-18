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
export function islandDoc({ code, user, snap, dayKey = '', now = 0 }) {
  return { code, user, v: SNAP_VERSION, snap, dayKey, at: now };
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

/**
 * M21-P4 방명록·편지·선물 쓰기 판단 (모양 제안): 경로 visits/<섬 코드>/<쓴 사람 id>/<글 id>.
 * - 경로의 쓴 사람 칸 = 쓴 사람 id · 문서 user 필드 필수 · 이미 있는 남의 글은 덮어쓰기·지우기 금지
 * - 섬 주인은 자기 섬 글을 「숨기기」(hidden: true 만 바꿈)할 수 있다 — islandOwner = 그 코드 섬의 user
 */
export function canWriteVisit({ path, uid, existing = null, next = null, islandOwner = null }) {
  if (!isUid(uid)) return { ok: false, why: 'no-user' };
  const seg = String(path ?? '').split('/');
  if (seg.length !== 4 || seg[0] !== VISITS || !isCode(seg[1]) || !isUid(seg[2]) || !isUid(seg[3])) return { ok: false, why: 'bad-path' };
  const writer = seg[2];
  if (writer === uid) {
    if (existing && existing.user !== uid) return { ok: false, why: 'not-owner' };
    if (next && next.user !== uid) return { ok: false, why: 'user-mismatch' };
    return { ok: true };
  }
  // 섬 주인의 숨기기: 글 내용은 그대로, hidden 만
  if (islandOwner && islandOwner === uid && existing && next) {
    const { hidden: _a, ...a } = existing;
    const { hidden: _b, ...b } = next;
    if (JSON.stringify(a) === JSON.stringify(b)) return { ok: true, hideOnly: true };
  }
  return { ok: false, why: 'not-owner' };
}
