// 저장·불러오기. localStorage 'island-life-save-v1' 에 { v, savedAt, state } 로 넣는다.
// 저장소가 없거나(사생활 보호 창) 막혀 있어도 오류를 내지 않고 false 를 돌려준다.
// 불러올 때는 ctx.state 객체를 바꿔 끼우지 않고 안의 값만 채운다 (다른 모듈이 잡고 있는 참조가 그대로 산다).
// 저장 옮기기 (M7-P4 UI-09): exportSave → 저장 글 (머리 줄 + base64), parseSave 가 검사해 되돌린다. 모양은 docs/notes/p11-save.md.
import { createState, STATE_VERSION } from '../core/state.js';
import * as items from './items.js';
import { SLOTS } from './inventory.js';
import { WALLET_MAX } from './wallet.js';

export const SAVE_KEY = 'island-life-save-v1';
export const SAVE_VERSION = 1;

/**
 * 버전 올리기: MIGRATIONS[n] 은 n 버전 저장 { v, savedAt, state } 를 n+1 버전으로 바꾼다.
 * 0 = 버전 정보 없이 state 만 통째로 들어 있는 저장 (감싸기 전 형식).
 */
export const MIGRATIONS = {
  0: ({ state }) => ({ v: 1, savedAt: Number.isFinite(state.savedAt) ? state.savedAt : null, state: { ...state, version: 1 } }),
};

/** 쓸 수 있는 localStorage 또는 null (접근만 해도 예외가 나는 브라우저가 있다) */
export function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__island_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** 저장 덩어리 → 최신 버전 { v, savedAt, state }. 이 게임보다 새 버전이면 null */
export function migrate(raw) {
  if (!isObj(raw)) throw new Error('저장 형식이 아니에요');
  let data = Number.isFinite(raw.v) && isObj(raw.state) ? raw : { v: 0, state: raw };
  while (data.v < SAVE_VERSION) {
    const step = MIGRATIONS[data.v];
    if (!step) throw new Error(`${data.v} 버전 저장을 올릴 수 없어요`);
    data = step(data);
  }
  if (data.v > SAVE_VERSION) return null;
  if (!isObj(data.state)) throw new Error('state 가 없어요');
  return data;
}

/** 빠진 칸은 기본값으로, 망가진 값은 고쳐서 지금 게임이 읽을 수 있는 state 로 만든다 */
export function normalize(saved) {
  const base = createState();
  const out = { ...saved };
  for (const [k, def] of Object.entries(base)) {
    const v = saved?.[k];
    if (isObj(def)) out[k] = isObj(v) ? { ...def, ...v } : def;
    else if (Array.isArray(def)) out[k] = Array.isArray(v) ? v : def;
    else out[k] = v ?? def;
  }
  out.version = STATE_VERSION;

  const inv = [];
  for (let i = 0; i < SLOTS; i++) inv.push(cleanSlot(out.inventory[i]));
  out.inventory = inv;

  const a = Number(out.wallet.acorns);
  out.wallet.acorns = Number.isFinite(a) ? Math.min(WALLET_MAX, Math.max(0, Math.floor(a))) : 0;

  for (const cat of ['fish', 'bug', 'fossil']) out.museum[cat] = cleanIds(out.museum[cat], cat);
  for (const cat of ['fish', 'bug']) out.encyclopedia[cat] = cleanIds(out.encyclopedia[cat], cat);
  if (!isObj(out.island.fruit)) out.island.fruit = {};
  return out;
}

function cleanSlot(s) {
  if (!isObj(s) || typeof s.id !== 'string') return null;
  const item = items.get(s.id);
  const count = Math.floor(Number(s.count));
  if (!item || !(count > 0)) return null;
  const slot = { id: s.id, count: Math.min(count, item.stack) };
  if (typeof s.variant === 'string' && s.variant && s.variant.length <= 40 && !item.durability) slot.variant = s.variant;
  if (item.durability) slot.uses = Number.isFinite(s.uses) ? Math.max(1, Math.min(item.durability, Math.floor(s.uses))) : item.durability;
  return slot;
}
const cleanIds = (list, cat) => (Array.isArray(list) ? [...new Set(list.filter(id => items.get(id)?.category === cat))] : []);

/** target 안을 source 값으로 바꾼다 (객체·배열은 같은 참조를 유지) */
export function applyTo(target, source) {
  for (const [k, v] of Object.entries(source)) {
    const cur = target[k];
    if (isObj(cur) && isObj(v)) {
      for (const key of Object.keys(cur)) delete cur[key];
      Object.assign(cur, v);
    } else if (Array.isArray(cur) && Array.isArray(v)) {
      cur.length = 0;
      cur.push(...v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

// ---------- 저장 옮기기 (글로 내보내기·불러오기) ----------

/** 저장 글 머리 줄: `POGEUN-SAVE <저장 버전> <확인 값 8자리>`. 그 뒤 줄들은 base64 (줄바꿈·띄어쓰기는 무시) */
export const TRANSFER_TAG = 'POGEUN-SAVE';
const B64_LINE = 76;

/** FNV-1a 32비트 → 16진 8자리. 글이 잘리거나 바뀐 것을 알아내는 확인 값 (암호가 아니다) */
export function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** 화면에 보여 줄 요약: 누구의 어느 섬, 도토리, 가방 칸 수, 기증 수 */
export function saveInfo(state, { savedAt = null, exportedAt = null } = {}) {
  const inv = Array.isArray(state?.inventory) ? state.inventory.filter(Boolean).length : 0;
  const museum = ['fish', 'bug', 'fossil'].reduce((n, c) => n + (Array.isArray(state?.museum?.[c]) ? state.museum[c].length : 0), 0);
  return {
    player: typeof state?.player?.name === 'string' ? state.player.name : '',
    island: typeof state?.island?.name === 'string' ? state.island.name : '',
    acorns: Number.isFinite(state?.wallet?.acorns) ? state.wallet.acorns : 0,
    items: inv, museum,
    createdAt: Number.isFinite(state?.createdAt) ? state.createdAt : null,
    savedAt, exportedAt,
  };
}

/**
 * 지금 상태 → 저장 글. 안의 JSON 은 { v, savedAt, exportedAt, build, state } (localStorage 저장과 같은 모양 + 내보낸 때·빌드).
 * 첫 줄 '#' 은 사람이 읽는 설명 (불러올 때 무시).
 */
export function exportSave(state, { now = Date.now(), savedAt = null, build = null } = {}) {
  const json = JSON.stringify({ v: SAVE_VERSION, savedAt, exportedAt: now, build, state });
  const b64 = toBase64(json);
  const info = saveInfo(state);
  const who = [info.island, info.player].filter(Boolean).join(' · ') || '이름 없는 섬';
  const d = new Date(now), p2 = n => String(n).padStart(2, '0');
  const when = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const lines = [`# 포근섬 이야기 저장 — ${who} — ${when}`,`${TRANSFER_TAG} ${SAVE_VERSION} ${checksum(json)}`];
  for (let i = 0; i < b64.length; i += B64_LINE) lines.push(b64.slice(i, i + B64_LINE));
  return lines.join('\n');
}

const fail = reason => ({ ok: false, reason });

/** 저장으로 볼 수 있는 모양인가 (normalize 가 빠진 칸은 채우지만, 이 칸들도 없으면 다른 글이다) */
function looksLikeState(st) {
  return isObj(st) && isObj(st.player) && isObj(st.island) && isObj(st.wallet) && Array.isArray(st.inventory);
}

/**
 * 저장 글(또는 localStorage 에 있던 JSON 그대로) 검사 → { ok: true, data: { v, savedAt, state }, info } | { ok: false, reason }.
 * reason 은 화면에 그대로 보여 줄 한국어 글. 확인 값·버전·모양을 본다. data.state 는 normalize 를 거친 것.
 */
export function parseSave(text) {
  if (typeof text !== 'string' || !text.trim()) return fail('붙여 넣은 글이 없어요.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  let json, raw;
  if (lines[0]?.startsWith('{')) {
    json = lines.join('');                       // 저장 JSON 그대로 (localStorage 값을 복사해 온 것)
  } else {
    const head = lines[0]?.split(/\s+/) ?? [];
    if (head[0] !== TRANSFER_TAG) return fail('포근섬 저장 글이 아니에요. 「글 복사」로 받은 글을 통째로 붙여 넣어 주세요.');
    const v = Number(head[1]);
    if (!Number.isInteger(v) || v < 0) return fail('저장 글 첫 줄이 망가졌어요.');
    if (v > SAVE_VERSION) return fail('더 새 버전 게임에서 만든 저장이에요. 게임을 새로 고친 뒤 다시 해 주세요.');
    try { json = fromBase64(lines.slice(1).join('').replace(/\s+/g, '')); } catch { return fail('글이 잘렸거나 바뀌었어요. 처음부터 끝까지 다시 복사해 주세요.'); }
    if (head[2] && checksum(json) !== head[2].toLowerCase()) return fail('글 일부가 빠졌거나 바뀌었어요 (확인 값이 달라요). 처음부터 끝까지 다시 복사해 주세요.');
  }
  try { raw = JSON.parse(json); } catch { return fail('저장 글을 읽지 못했어요. 글이 잘리지 않았는지 확인해 주세요.'); }
  let data;
  try { data = migrate(raw); } catch (e) { return fail(`이 게임이 읽을 수 없는 저장이에요 (${e.message}).`); }
  if (!data) return fail('더 새 버전 게임에서 만든 저장이에요. 게임을 새로 고친 뒤 다시 해 주세요.');
  if (!looksLikeState(data.state)) return fail('포근섬 저장 모양이 아니에요 (플레이어·섬·가방 칸이 없어요).');
  const state = normalize(data.state);
  const savedAt = Number.isFinite(data.savedAt) ? data.savedAt : null;
  const exportedAt = Number.isFinite(raw.exportedAt) ? raw.exportedAt : null;
  return { ok: true, data: { v: SAVE_VERSION, savedAt, state }, info: saveInfo(state, { savedAt, exportedAt }), build: typeof raw.build === 'string' ? raw.build : null };
}

export function createSave({ state, storage = defaultStorage(), key = SAVE_KEY, now = () => Date.now(), onDone = () => {}, onLoad = () => {}, onReset = () => {} }) {
  let blocked = false;         // 더 새 버전 저장이 있으면 덮어쓰지 않는다
  let held = false;            // 불러오기로 새 저장을 써 넣었다 → 다시 열 때까지 지금 상태로 덮어쓰지 않는다
  let lastSavedAt = null;

  function save() {
    if (held) { onDone({ ok: true, held: true }); return true; }
    let ok = false;
    if (storage && !blocked) {
      try {
        const at = now();
        storage.setItem(key, JSON.stringify({ v: SAVE_VERSION, savedAt: at, state }));
        lastSavedAt = at;
        ok = true;
      } catch { ok = false; }
    }
    onDone({ ok });
    return ok;
  }

  function load() {
    if (!storage) return false;
    let text = null;
    try { text = storage.getItem(key); } catch { return false; }
    if (text == null) return false;
    try {
      const data = migrate(JSON.parse(text));
      if (!data) { blocked = true; return false; }
      applyTo(state, normalize(data.state));
      lastSavedAt = data.savedAt ?? null;
      onLoad(data);
      return true;
    } catch {
      // 망가진 저장은 옆에 남겨 두고 새로 시작한다
      try { storage.setItem(`${key}-broken`, text); } catch { /* 저장 공간 부족 */ }
      return false;
    }
  }

  /** 저장을 지우고 새 게임 상태로 되돌린다. createState 에 없는 칸(state.mail 같은 모듈 칸)도 지운다 */
  function reset() {
    let ok = true;
    if (storage) {
      try { storage.removeItem(key); } catch { ok = false; }
    }
    blocked = false;
    lastSavedAt = null;
    const fresh = createState();
    for (const k of Object.keys(state)) if (!(k in fresh)) delete state[k];
    applyTo(state, fresh);
    onReset();
    return ok;
  }

  /** 지금 상태를 저장 글로 (먼저 저장해서 이 브라우저 저장과 같게 맞춘다) */
  function exportText({ build = null } = {}) {
    if (!held) save();
    return exportSave(state, { now: now(), savedAt: lastSavedAt, build });
  }

  /**
   * 저장 글을 이 브라우저 저장으로 써 넣는다 → { ok, info } | { ok: false, reason }.
   * 지금 상태(ctx.state)는 건드리지 않는다: 모듈마다 화면·모델이 상태를 따로 들고 있어서 쓰고 나면 페이지를 다시 연다 (ui/transfer.js).
   * 그 사이 자동 저장(pagehide 등)이 새 저장을 덮지 않게 held. 원래 저장은 `<key>-before-import` 에 남긴다.
   * 글이 잘못되면 아무것도 쓰지 않는다 (지금 저장 지키기).
   */
  function importText(text) {
    const parsed = parseSave(text);
    if (!parsed.ok) return parsed;
    if (!storage) return fail('이 창에서는 저장할 수 없어서 불러올 수도 없어요.');
    let before = null;
    try { before = storage.getItem(key); } catch { /* 읽기 막힘 */ }
    try {
      if (before != null) storage.setItem(`${key}-before-import`, before);
    } catch { /* 공간 부족: 예전 저장 사본만 못 남긴다 */ }
    try {
      storage.setItem(key, JSON.stringify({ v: SAVE_VERSION, savedAt: parsed.data.savedAt ?? now(), state: parsed.data.state }));
    } catch {
      try { if (before != null) storage.setItem(key, before); } catch { /* 그대로 */ }
      return fail('이 브라우저 저장 공간에 쓰지 못했어요. 지금 저장은 그대로예요.');
    }
    held = true;
    blocked = false;
    return { ok: true, info: parsed.info };
  }

  function exists() {
    try { return !!storage && storage.getItem(key) != null; } catch { return false; }
  }

  return {
    save, load, reset, exists, key, exportText, importText,
    get available() { return !!storage; },
    get held() { return held; },
    get blocked() { return blocked; },
    get lastSavedAt() { return lastSavedAt; },
  };
}
