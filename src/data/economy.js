// 사고팔기: 파는 값, 사는 값, 날마다 바뀌는 도토리상점 물건 (dayKey 시드라 같은 날엔 늘 같다).
// 영업 시각·하루 물건 수는 assets/data/rules.json 의 shop 칸, 값은 items.json (표 편집기 → "숫자 반영").
import * as items from './items.js';
import { rngFor, sample } from './rng.js';
import { RULES } from './tables.js';

export const SHOP_HOURS = { open: RULES.shop.open, close: RULES.shop.close };   // 도토리상점 영업 8~22시
export const SHOP_FURNITURE_PER_DAY = RULES.shop.furniturePerDay;
export const SHOP_FLOWER_SEEDS_PER_DAY = RULES.shop.flowerSeedsPerDay;

const FRUIT_TREES = items.list('fruit').filter(f => f.variant).map(f => f.id);
/** 섬 특산 과일: 섬 시드로 정해진다. 특산 과일은 싸게(nativePrice 100), 나머지는 비싸게(500) 팔린다 */
export const nativeFruit = seed => FRUIT_TREES[Math.floor(rngFor(seed, 'native-fruit')() * FRUIT_TREES.length)];

/** 파는 값 (가방 한 개 기준) */
export function sellPrice(id, { native = null } = {}) {
  const it = items.get(id);
  if (!it) return 0;
  if (it.category === 'fruit' && id === native) return it.nativePrice;
  return it.price;
}

/** 사는 값. 상점에서 안 파는 물건은 0 */
export const buyPrice = id => items.get(id)?.buy ?? 0;

export const isShopOpen = hour => hour >= SHOP_HOURS.open && hour < SHOP_HOURS.close;

/** 그날의 상점 물건: 가구 2 + 도구 5 + 꽃씨 2 + 묘목 */
export function shopStock(dayKey, seed = 0) {
  const rng = rngFor(seed, dayKey, 'shop');
  const furniture = sample(items.list('furn').filter(f => f.source === 'shop').map(f => f.id), SHOP_FURNITURE_PER_DAY, rng);
  const tools = items.list('tool').map(t => t.id);
  const seeds = sample(items.list('seed').filter(s => s.flower).map(s => s.id), SHOP_FLOWER_SEEDS_PER_DAY, rng);
  const saplings = items.list('seed').filter(s => s.tree).map(s => s.id);
  return { furniture, tools, seeds, saplings, all: [...furniture, ...tools, ...seeds, ...saplings] };
}

/** 가방·지갑에 붙여 쓰는 판매·구매. getSeed / getDayKey 는 그때그때 상태에서 읽는다 */
export function createEconomy({ inventory, wallet, getSeed = () => 0, getDayKey = () => null }) {
  const native = () => nativeFruit(getSeed());
  const price = id => sellPrice(id, { native: native() });
  const stock = (dayKey = getDayKey()) => shopStock(dayKey, getSeed()).all;

  return {
    sellPrice: price,
    buyPrice,
    nativeFruit: native,
    isOpen: isShopOpen,
    stock,
    stockGroups: (dayKey = getDayKey()) => shopStock(dayKey, getSeed()),
    /** 가방 칸 팔기 → 받은 도토리 (0 = 못 팜). 가구·도구도 팔린다 */
    sell(slotIndex, n = 1) {
      const slot = inventory.slots[slotIndex];
      if (!slot) return 0;
      const each = price(slot.id);
      if (each <= 0) return 0;
      const sold = inventory.remove(slotIndex, n);
      return sold ? (wallet.add(each * sold), each * sold) : 0;
    },
    /** 사기 → 'ok' | 'money' (도토리 모자람) | 'full' (가방 꽉 참) | 'none' (안 파는 물건) */
    buy(id, n = 1) {
      const cost = buyPrice(id) * n;
      if (!cost) return 'none';
      if (inventory.canFit(id, n) < n) return 'full';
      if (!wallet.spend(cost)) return 'money';
      inventory.add(id, n);
      return 'ok';
    },
  };
}
