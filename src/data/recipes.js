// 작업대 제작법 (DIY). 컨셉 보드 TOOLS·FURN 표의 '제작' 항목 + 5차 검수 보드(wave5) FU 카드의 제작 가구.
// 6차(M6-P5)부터 표는 assets/data/rules.json 의 recipes (표 편집기 → "숫자 반영"), note 칸은 사람이 읽는 메모.
// 재료 한 줄: { id, n } 정확한 아이템, 또는 { category, n } 그 카테고리 아무거나 (예: 조개 6개).
import * as items from './items.js';
import { RULES } from './tables.js';

/** 레시피 id = 만들어지는 아이템 id */
export const RECIPES = RULES.recipes.map(({ result, needs, count }) => Object.freeze({ id: result, count: count ?? 1, result, needs }));

const BY_ID = new Map(RECIPES.map(r => [r.id, r]));

/** 재료 한 줄을 사람이 읽는 말로: '나무 5', '조개 아무거나 6' */
export const needText = need => (need.id ? `${items.get(need.id)?.name ?? need.id} ${need.n}` : `${items.CATEGORY_NAMES[need.category]} 아무거나 ${need.n}`);

export function createRecipes(inventory) {
  const have = need => (need.id ? inventory.count(need.id) : inventory.countCategory(need.category));

  /** 모자란 재료 목록 [{ ...need, have }] (빈 배열 = 다 있음) */
  function missing(recipeId) {
    const r = BY_ID.get(recipeId);
    if (!r) return null;
    return r.needs.map(need => ({ ...need, have: have(need) })).filter(x => x.have < x.n);
  }

  /** 재료가 다 있고, 만든 물건이 가방에 들어갈 자리가 있나 */
  function canCraft(recipeId) {
    const m = missing(recipeId);
    if (!m || m.length) return false;
    return trial(BY_ID.get(recipeId), false);
  }

  /** 만들기 → 성공하면 재료가 빠지고 결과물이 가방에 들어간다. 실패하면 가방은 그대로 */
  function craft(recipeId) {
    const r = BY_ID.get(recipeId);
    if (!r || missing(recipeId).length) return false;
    return trial(r, true);
  }

  // 재료를 빼고 결과물을 넣어 본다. keep = false 이거나 실패하면 원래대로 되돌린다
  function trial(r, keep) {
    const snap = inventory.snapshot();
    let ok = false;
    inventory.batch(() => {
      for (const need of r.needs) consume(need);
      ok = inventory.add(r.result, r.count) === r.count;
      if (!ok || !keep) inventory.restore(snap);
    }, { silent: !keep });
    return ok;
  }

  function consume(need) {
    if (need.id) return inventory.removeId(need.id, need.n);
    // 카테고리 재료: 가장 많이 가진 것부터 쓴다
    let left = need.n;
    const ids = [...new Set(inventory.slots.filter(s => s && items.get(s.id)?.category === need.category).map(s => s.id))]
      .sort((a, b) => inventory.count(b) - inventory.count(a));
    for (const id of ids) {
      if (left <= 0) break;
      left -= inventory.removeId(id, left);
    }
    return need.n - left;
  }

  return {
    list: () => RECIPES.slice(),
    get: id => BY_ID.get(id) ?? null,
    missing, canCraft, craft,
  };
}
