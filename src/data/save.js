// 저장·불러오기. localStorage 'island-life-save-v1' 에 { v, savedAt, state } 로 넣는다.
// 저장소가 없거나(사생활 보호 창) 막혀 있어도 오류를 내지 않고 false 를 돌려준다.
// 불러올 때는 ctx.state 객체를 바꿔 끼우지 않고 안의 값만 채운다 (다른 모듈이 잡고 있는 참조가 그대로 산다).
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

export function createSave({ state, storage = defaultStorage(), key = SAVE_KEY, now = () => Date.now(), onDone = () => {}, onLoad = () => {}, onReset = () => {} }) {
  let blocked = false;         // 더 새 버전 저장이 있으면 덮어쓰지 않는다
  let lastSavedAt = null;

  function save() {
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

  /** 저장을 지우고 새 게임 상태로 되돌린다 */
  function reset() {
    let ok = true;
    if (storage) {
      try { storage.removeItem(key); } catch { ok = false; }
    }
    blocked = false;
    lastSavedAt = null;
    applyTo(state, createState());
    onReset();
    return ok;
  }

  function exists() {
    try { return !!storage && storage.getItem(key) != null; } catch { return false; }
  }

  return {
    save, load, reset, exists, key,
    get available() { return !!storage; },
    get blocked() { return blocked; },
    get lastSavedAt() { return lastSavedAt; },
  };
}
