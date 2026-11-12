// 박물관 기증과 도감. 기증은 물고기·곤충·화석·바다 생물(M16)만 (items.COLLECTIBLE), 같은 것은 한 번만.
// state.museum = { fish:[id], bug:[id], fossil:[id], sea:[id] }, state.encyclopedia = { fish:[id], bug:[id], sea:[id] } (한 번이라도 잡은 것)
import * as items from './items.js';

const KINDS = items.COLLECTIBLE;
const CAUGHT = new Set(['fish', 'bug', 'sea']);   // 도감에 '잡아 봤다' 를 적는 분류 (화석은 기증으로만)

export function createMuseum(state, { onChange = () => {} } = {}) {
  const shelf = cat => {
    state.museum ??= {};
    if (!Array.isArray(state.museum[cat])) state.museum[cat] = [];
    return state.museum[cat];
  };
  const book = cat => {
    state.encyclopedia ??= {};
    if (!Array.isArray(state.encyclopedia[cat])) state.encyclopedia[cat] = [];
    return state.encyclopedia[cat];
  };
  // 감정 전 화석(unknown)은 받지 않는다 — 느루가 감정한 뒤에 기증한다
  const catOf = id => {
    const it = items.get(id);
    return it && !it.unknown && KINDS.includes(it.category) ? it.category : null;
  };

  const has = id => {
    const c = catOf(id);
    return !!c && shelf(c).includes(id);
  };
  const canDonate = id => !!catOf(id) && !has(id);

  /** 기증 → 받아 주면 true (가방에서 빼는 건 부르는 쪽 몫. donateFromSlot 은 함께 한다) */
  function donate(id) {
    if (!canDonate(id)) return false;
    shelf(catOf(id)).push(id);
    record(id);
    onChange(id);
    return true;
  }

  /** 도감에 '잡아 봤다' 기록 (물고기·곤충·바다 생물). 새로 적었으면 true */
  function record(id) {
    const c = items.get(id)?.category;
    if (!CAUGHT.has(c)) return false;
    const b = book(c);
    if (b.includes(id)) return false;
    b.push(id);
    return true;
  }
  const caught = id => {
    const c = items.get(id)?.category;
    return CAUGHT.has(c) && book(c).includes(id);
  };

  /** { fish:[기증 수, 전체], bug:[..], fossil:[..], total:[..], complete } */
  function progress() {
    const out = {};
    let n = 0, t = 0;
    for (const c of KINDS) {
      const total = items.list(c).length;
      const done = shelf(c).filter(id => items.get(id)).length;
      out[c] = [done, total];
      n += done;
      t += total;
    }
    out.total = [n, t];
    out.complete = n === t;
    return out;
  }

  return {
    donate, has, canDonate, record, caught, progress,
    /** 기증한 id 목록 (카테고리별) */
    list: cat => shelf(cat).slice(),
  };
}
