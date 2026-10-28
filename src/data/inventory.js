// 가방 20칸. 칸마다 { id, count } 또는 null. 도구 칸은 { id, count: 1, uses } (남은 사용 횟수).
// 색·모양 변형이 있는 물건(가구 색, 주민 사진의 주민)은 { id, count, variant } — 같은 변형끼리만 쌓인다.
// 쌓이는 수는 카테고리마다 다르다 (items.STACK: 물고기·곤충·도구·가구 1, 과일·조개·꽃 10, 재료 30).
import * as items from './items.js';

export const SLOTS = 20;

const whole = n => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

export function createInventory(state, { onChange = () => {} } = {}) {
  if (!Array.isArray(state.inventory)) state.inventory = [];
  const slots = () => {
    const s = state.inventory;
    while (s.length < SLOTS) s.push(null);
    return s;
  };
  let muted = 0, dirty = false;
  const changed = () => {
    if (muted) dirty = true;
    else onChange(slots());
  };

  /** 여러 번 고칠 때 이벤트를 한 번만 보낸다. silent = true 면 아예 안 보낸다 (시험 삼아 고치고 되돌릴 때) */
  function batch(fn, { silent = false } = {}) {
    muted++;
    try { return fn(); }
    finally {
      if (--muted === 0 && dirty) {
        dirty = false;
        if (!silent) onChange(slots());
      }
    }
  }

  const sameVariant = (slot, variant) => (slot.variant ?? null) === (variant ?? null);

  /** 지금 몇 개까지 더 들어가나 (opts.variant: 그 변형으로) */
  function canFit(id, n = 1, { variant = null } = {}) {
    const item = items.get(id);
    if (!item) return 0;
    let room = 0;
    for (const s of slots()) {
      if (!s) room += item.stack;
      else if (s.id === id && item.stack > 1 && sameVariant(s, variant)) room += Math.max(0, item.stack - s.count);
    }
    return Math.min(whole(n), room);
  }

  /** 넣기 → 실제로 들어간 수. 같은 아이템(같은 변형) 칸을 먼저 채우고 빈칸을 쓴다. opts.variant: 변형 이름 */
  function add(id, n = 1, { variant = null } = {}) {
    const item = items.get(id);
    let left = whole(n);
    if (!item || left === 0) return 0;
    const s = slots();
    if (item.stack > 1) {
      for (const slot of s) {
        if (left === 0) break;
        if (slot && slot.id === id && slot.count < item.stack && sameVariant(slot, variant)) {
          const put = Math.min(left, item.stack - slot.count);
          slot.count += put;
          left -= put;
        }
      }
    }
    for (let i = 0; i < s.length && left > 0; i++) {
      if (s[i]) continue;
      const put = Math.min(left, item.stack);
      s[i] = item.durability ? { id, count: 1, uses: item.durability } : { id, count: put, ...(variant != null ? { variant: String(variant) } : {}) };
      left -= item.durability ? 1 : put;
    }
    const added = whole(n) - left;
    if (added) changed();
    return added;
  }

  /** 칸에서 빼기 → 실제로 뺀 수 */
  function remove(slotIndex, n = 1) {
    const s = slots();
    const slot = s[slotIndex];
    if (!slot) return 0;
    const out = Math.min(whole(n), slot.count);
    if (!out) return 0;
    slot.count -= out;
    if (slot.count <= 0) s[slotIndex] = null;
    changed();
    return out;
  }

  /** 아이템 id 로 빼기 (뒤 칸부터) → 뺀 수 */
  function removeId(id, n = 1) {
    let left = whole(n);
    const s = slots();
    for (let i = s.length - 1; i >= 0 && left > 0; i--) {
      if (s[i]?.id !== id) continue;
      const out = Math.min(left, s[i].count);
      s[i].count -= out;
      left -= out;
      if (s[i].count <= 0) s[i] = null;
    }
    const removed = whole(n) - left;
    if (removed) changed();
    return removed;
  }

  const count = id => slots().reduce((sum, s) => sum + (s?.id === id ? s.count : 0), 0);
  /** 카테고리 전체 개수 (예: 조개 아무거나 6개) */
  const countCategory = cat => slots().reduce((sum, s) => sum + (s && items.get(s.id)?.category === cat ? s.count : 0), 0);
  const isFull = () => slots().every(Boolean);
  const freeSlots = () => slots().filter(s => !s).length;
  const find = id => slots().findIndex(s => s?.id === id);

  /** 칸 옮기기: 같은 아이템이면 합치고, 아니면 자리를 바꾼다 */
  function move(from, to) {
    const s = slots();
    if (from === to || !s[from] || to < 0 || to >= s.length) return false;
    const a = s[from], b = s[to];
    const stack = items.stackOf(a.id);
    if (b && b.id === a.id && stack > 1 && !a.uses && sameVariant(a, b.variant)) {
      const put = Math.min(a.count, stack - b.count);
      b.count += put;
      a.count -= put;
      if (a.count <= 0) s[from] = null;
    } else {
      s[from] = b;
      s[to] = a;
    }
    changed();
    return true;
  }

  /** 'rod' 같은 도구 이름으로 가방에서 그 도구 칸 찾기 (-1 = 없음) */
  const findTool = tool => slots().findIndex(s => s && items.get(s.id)?.tool === tool);
  const hasTool = tool => findTool(tool) >= 0;

  /** 도구 한 번 쓰기 → { ok, uses, broken }. 다 쓰면 칸이 비고 broken = true */
  function useTool(tool) {
    const i = findTool(tool);
    if (i < 0) return { ok: false, uses: 0, broken: false };
    const s = slots();
    const slot = s[i];
    slot.uses = Math.max(0, (slot.uses ?? items.get(slot.id).durability) - 1);
    const broken = slot.uses === 0;
    if (broken) s[i] = null;
    changed();
    return { ok: true, uses: slot.uses, broken };
  }

  function clear() {
    const s = slots();
    for (let i = 0; i < s.length; i++) s[i] = null;
    changed();
  }

  /** 제작처럼 여러 번 고치다 실패하면 되돌릴 때 */
  const snapshot = () => slots().map(s => (s ? { ...s } : null));
  function restore(snap) {
    const s = slots();
    for (let i = 0; i < s.length; i++) s[i] = snap[i] ? { ...snap[i] } : null;
    changed();
  }

  return {
    get slots() { return slots(); },
    size: SLOTS,
    add, remove, removeId, count, countCategory, isFull, freeSlots, find, canFit, move,
    findTool, hasTool, useTool, clear, snapshot, restore, batch,
  };
}
