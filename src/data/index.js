// 데이터 모듈 (트랙 T2): 아이템 사전·출현표·가방·지갑·박물관·제작·상점·저장·하루 리셋.
// ctx.services.data 에 올리고, 바뀌면 inventory:changed / wallet:changed / museum:changed / save:done 을 보낸다.
// 다른 서비스(time 등)가 없어도 돈다. 약속은 docs/CONTRACTS.md 'data' 절.
import * as items from './items.js';
import * as spawns from './spawns.js';
import * as economyRules from './economy.js';
import { createInventory } from './inventory.js';
import { createWallet } from './wallet.js';
import { createMuseum } from './museum.js';
import { createRecipes } from './recipes.js';
import { createEconomy } from './economy.js';
import { createSave } from './save.js';
import { createDay } from './day.js';
import { createHarvest } from './harvest.js';
import { RULES } from './tables.js';
import { setLuck, luck } from './luck.js';

export const AUTOSAVE_GAME_MINUTES = 5;   // time:tick(게임 1분) 이만큼마다 저장
export const AUTOSAVE_MIN_GAP_SEC = 15;   // 빠른 시간 모드에서 너무 자주 저장하지 않게
export const AUTOSAVE_FALLBACK_SEC = 60;  // time 서비스가 없으면 실제 시간으로
const DAY_POLL_SEC = 10;                  // 5시가 넘었는지 가끔 확인 (time:newday 가 없을 때 대비)

/** 새 게임 시작 지급: 낚싯대·잠자리채 (컨셉 보드 TL-01·02) + 도토리 조금 — assets/data/rules.json 의 starter */
export const STARTER = { items: RULES.starter.items, acorns: RULES.starter.acorns };

/** 서비스 만들기. 테스트·데모에서도 쓴다. opts.storage 로 가짜 localStorage 를 넣을 수 있다 */
export function createDataService(ctx, opts = {}) {
  const { state, events } = ctx;
  const emit = (name, payload) => events?.emit(name, payload);
  const getNow = () => ctx.services?.time?.now?.() ?? null;

  const inventory = createInventory(state, { onChange: slots => emit('inventory:changed', { slots }) });
  const wallet = createWallet(state, { onChange: acorns => emit('wallet:changed', { acorns }) });
  const museum = createMuseum(state, { onChange: id => emit('museum:changed', { id }) });
  const recipes = createRecipes(inventory);
  const day = createDay({ state, getNow, onNewDay: summary => emit('data:newday', summary), allowBack: !!ctx.preview });
  const harvest = createHarvest({ state, day });
  const economy = createEconomy({ inventory, wallet, getSeed: () => state.island.seed, getDayKey: () => day.key() });

  const announceAll = () => {
    emit('inventory:changed', { slots: inventory.slots });
    emit('wallet:changed', { acorns: wallet.get() });
  };
  const giveStarter = () => {
    inventory.batch(() => { for (const [id, n] of STARTER.items) inventory.add(id, n); }, { silent: true });
    state.wallet.acorns = STARTER.acorns;
  };
  const save = createSave({
    state,
    ...(opts.storage !== undefined ? { storage: opts.storage } : {}),
    ...(ctx.preview?.saveKey ? { key: ctx.preview.saveKey } : {}),   // 8차 D85-A: 날짜 흉내는 저장 칸을 따로 (진짜 섬과 안 섞임)
    onDone: ({ ok }) => emit('save:done', { ok }),
    onLoad: () => emit('data:loaded', {}),
    onReset: () => { giveStarter(); announceAll(); },
  });

  /** 주운 것·잡은 것을 챙기기 → { added, left, acorns }. 도토리 주머니는 바로 지갑으로, 물고기·곤충은 도감에 기록.
   *  opts.variant: 변형 (가구 색, 주민 사진의 주민 slug) */
  function collect(id, n = 1, opts = {}) {
    const item = items.get(id);
    if (!item || !(n > 0)) return { added: 0, left: n > 0 ? n : 0, acorns: 0 };
    if (item.acorns) {
      wallet.add(item.acorns * n);
      return { added: n, left: 0, acorns: item.acorns * n };
    }
    if (museum.record(id)) emit('encyclopedia:changed', { id });
    const added = inventory.add(id, n, opts);
    return { added, left: n - added, acorns: 0 };
  }

  /** 가방의 도토리 주머니 열기 → 받은 도토리 */
  function openBag(slotIndex) {
    const slot = inventory.slots[slotIndex];
    const each = slot && items.get(slot.id)?.acorns;
    if (!each) return 0;
    const n = inventory.remove(slotIndex, slot.count);
    wallet.add(each * n);
    return each * n;
  }

  /** 가방 칸을 박물관에 기증 → 받아 주면 true (가방에서 한 개 빠짐) */
  function donateFromSlot(slotIndex) {
    const slot = inventory.slots[slotIndex];
    if (!slot || !museum.canDonate(slot.id)) return false;
    inventory.remove(slotIndex, 1);
    return museum.donate(slot.id);
  }

  const service = {
    items: { get: items.get, list: items.list, has: items.has, stackOf: items.stackOf, categories: items.CATEGORIES, categoryName: c => items.CATEGORY_NAMES[c] ?? c },
    // 출현표: 투어 섬에 가 있으면(tour 서비스 active) 투어 섬에만 나오는 물고기·곤충이 섞인다 (P35)
    spawns: { ...spawns, fish: o => spawns.fish({ islet: !!ctx.services.tour?.active, ...o }), bug: o => spawns.bug({ islet: !!ctx.services.tour?.active, ...o }),
      fishPool: o => spawns.fishPool({ islet: !!ctx.services.tour?.active, ...o }), bugPool: o => spawns.bugPool({ islet: !!ctx.services.tour?.active, ...o }) },
    inventory,
    wallet,
    museum,
    recipes,
    economy: { ...economy, rules: economyRules },
    rules: RULES,   // p41: 다른 모듈이 읽는 표 (sky 가 time — 시간 빠르기)
    /** M12 D112-A: 그날 보너스 (타로·달빛 가게). set(fn) — fn() → { 열쇠: 값 } | null, get(열쇠) → 숫자. 열쇠 표는 luck.js */
    luck: { set: setLuck, get: luck },
    save,
    day,
    harvest,
    collect, openBag, donateFromSlot,
  };

  // ----- 자동 저장과 하루 확인 -----
  let ticks = 0, sinceSave = 0, sincePoll = 0;
  const offs = [];
  const trySave = () => {
    ticks = 0;
    sinceSave = 0;
    return save.save();
  };
  if (events) {
    offs.push(events.on('time:newday', () => day.check()));
    offs.push(events.on('game:ready', () => day.check()));
    offs.push(events.on('time:tick', () => {
      if (++ticks >= AUTOSAVE_GAME_MINUTES && sinceSave >= AUTOSAVE_MIN_GAP_SEC) trySave();
    }));
  }
  const doc = globalThis.document;
  const onHide = () => { if (doc?.visibilityState === 'hidden') trySave(); };
  const onPageHide = () => trySave();
  doc?.addEventListener?.('visibilitychange', onHide);
  globalThis.addEventListener?.('pagehide', onPageHide);
  offs.push(() => doc?.removeEventListener?.('visibilitychange', onHide), () => globalThis.removeEventListener?.('pagehide', onPageHide));

  function update(dt) {
    sinceSave += dt;
    sincePoll += dt;
    if (sincePoll >= DAY_POLL_SEC) {
      sincePoll = 0;
      day.check();
    }
    if (!ctx.services?.time && sinceSave >= AUTOSAVE_FALLBACK_SEC) trySave();
  }

  /** 저장 불러오기, 없으면 새 게임 지급 → 불러왔으면 true */
  function start() {
    const loaded = save.load();
    if (!loaded) giveStarter();
    return loaded;
  }

  return { service, update, start, dispose: () => offs.splice(0).forEach(off => off()) };
}

let instance = null;

export default {
  name: 'data',
  init(ctx) {
    instance?.dispose();
    instance = createDataService(ctx);
    ctx.services.data = instance.service;
    const loaded = instance.start();
    if (ctx.debug) console.info(`[data] ${loaded ? '저장 불러옴' : '새 게임'} · 아이템 ${items.ITEMS.length}개`);
  },
  update(dt) {
    instance?.update(dt);
  },
};
