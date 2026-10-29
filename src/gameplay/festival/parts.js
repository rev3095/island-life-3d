// 축제 부품 5개와 부스 (DOM·three 없음, node 로 확인). 검수 보드 z5 D20-B: 주민과 이모티콘으로 마음을 열고 🎉로 물으면
// 그 주민이 필요한 것을 이모티콘으로 알려 주고, 섬에서 채집해 가져다주면 부품을 준다. 부품 하나 = 부스 하나 (D22-A 건네면 바로 선다).
import { tierOf } from '../town/rules.js';

/** 마음을 열었나: 친구 단계(친밀도 30) + 이모티콘 대화로 기쁨 이상 두 번 */
export const OPEN_TIER = 'friend';
export const OPEN_WINS = 2;
const TIER_ORDER = ['new', 'known', 'friend', 'close', 'best'];

/**
 * need: 가방에서 무엇을 몇 개. pick(slots, items, c) → [{ slot, n }] | null (모자라면 null).
 * hint = 💭 말풍선 낱말, label = 알림 글 (화면 글자는 알림·메뉴에만)
 */
export const PARTS = [
  { id: 'FP-01', slug: 'festival-part-lantern', name: '반딧불 등불', emoji: '✨', who: 'chorong', booth: 'FB-01',
    hint: ['bubble', 'bug', 'moon'], label: '곤충 3마리 (반딧불이면 1마리)',
    pick: (slots, items) => takeAny(slots, items, it => it.id === 'bug.firefly', 1) ?? takeAny(slots, items, it => it.category === 'bug', 3) },
  { id: 'FP-02', slug: 'festival-part-drum', name: '응원 북', emoji: '🥁', who: 'coco', booth: 'FB-02',
    hint: ['bubble', 'item:mat.wood', 'music'], label: '나무 5개',
    pick: (slots, items) => takeAny(slots, items, it => it.id === 'mat.wood', 5) },
  { id: 'FP-03', slug: 'festival-part-garland', name: '꽃 가랜드', emoji: '🌸', who: 'mochi', booth: 'FB-03',
    hint: ['bubble', 'flower', 'rainbow'], label: '꽃 6송이 (색 3가지 이상)',
    pick: (slots, items) => takeVaried(slots, items, it => it.category === 'flower', 6, 3) },
  { id: 'FP-04', slug: 'festival-part-pot', name: '과일 솥', emoji: '🍲', who: 'pong', booth: 'FB-04',
    hint: ['bubble', 'fruit', 'yum'], label: '과일 5개 (섬 특산 아닌 과일 1개 포함)',
    pick: (slots, items, c) => takeWithOne(slots, items, it => it.category === 'fruit', 5, it => it.id !== c?.nativeFruit) },
  { id: 'FP-05', slug: 'festival-part-flag', name: '낚시 대회 깃발', emoji: '🚩', who: 'dubu', booth: 'FB-05',
    hint: ['bubble', 'fish', 'bang'], label: '큰 물고기 1마리 (그림자가 큰 것)',
    pick: (slots, items) => takeAny(slots, items, it => it.category === 'fish' && (it.shadow ?? 0) >= 5, 1) },
];
export const PART_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));
export const PART_OF = Object.fromEntries(PARTS.map(p => [p.who, p]));
/** 부품이 없는 주민의 축제 몫 (보리 = 개막 종, 단풍 = 사진사) */
export const ROLES = { bori: 'bell', danpung: 'photo' };

/** 이 주민이 마음을 열었나 (v = state.villagers[slug]) */
export function heartOpen(v) {
  return TIER_ORDER.indexOf(tierOf(v?.friendship ?? 0)) >= TIER_ORDER.indexOf(OPEN_TIER) && (v?.emote?.wins ?? 0) >= OPEN_WINS;
}

const slotItems = (slots, items) => slots.map((s, slot) => (s ? { slot, n: s.count ?? 1, item: items.get(s.id) } : null)).filter(x => x?.item);

/** 조건에 맞는 것 n 개 (여러 칸에서 모아도 된다) */
export function takeAny(slots, items, test, n) {
  const out = [];
  let left = n;
  for (const x of slotItems(slots, items)) {
    if (!test(x.item) || left <= 0) continue;
    const k = Math.min(left, x.n);
    out.push({ slot: x.slot, n: k });
    left -= k;
  }
  return left > 0 ? null : out;
}
/** n 개, 그중 서로 다른 아이템이 kinds 가지 이상 */
export function takeVaried(slots, items, test, n, kinds) {
  const xs = slotItems(slots, items).filter(x => test(x.item));
  const byId = new Map();
  for (const x of xs) byId.set(x.item.id, [...(byId.get(x.item.id) ?? []), x]);
  if (byId.size < kinds) return null;
  const out = [], used = new Map();
  const take = (x, k) => { out.push({ slot: x.slot, n: k }); used.set(x.slot, (used.get(x.slot) ?? 0) + k); };
  let left = n;
  for (const [, list] of [...byId].slice(0, kinds)) { take(list[0], 1); left--; }   // 먼저 종류마다 하나씩
  for (const x of xs) {
    if (left <= 0) break;
    const k = Math.min(left, x.n - (used.get(x.slot) ?? 0));
    if (k > 0) { take(x, k); left -= k; }
  }
  return left > 0 ? null : merge(out);
}
/** n 개, 그중 must 에 맞는 것이 하나 이상 */
export function takeWithOne(slots, items, test, n, must) {
  const xs = slotItems(slots, items).filter(x => test(x.item));
  const first = xs.find(x => must(x.item));
  if (!first) return null;
  const out = [{ slot: first.slot, n: 1 }];
  let left = n - 1;
  for (const x of xs) {
    if (left <= 0) break;
    const k = Math.min(left, x.n - (x.slot === first.slot ? 1 : 0));
    if (k > 0) { out.push({ slot: x.slot, n: k }); left -= k; }
  }
  return left > 0 ? null : merge(out);
}
const merge = list => [...list.reduce((m, x) => m.set(x.slot, (m.get(x.slot) ?? 0) + x.n), new Map())].map(([slot, n]) => ({ slot, n }));

/** state.festival 빈 칸 채우기 */
export function festState(state) {
  const f = (state.festival ??= {});
  f.parts ??= {};        // 부품 id → 받은 dayKey
  f.booths ??= {};       // 부스 id → { openedDay, ... 부스 놀이 기록 }
  f.asked ??= {};        // 주민 slug → 🎉로 물어 필요한 것을 들은 dayKey
  return f;
}
export const partCount = f => Object.keys(f.parts ?? {}).length;
export const allParts = f => PARTS.every(p => f.parts?.[p.id]);

/**
 * 축제 날인가 (D23-A 다 모은 다음 날부터 — 놓쳐도 다음 날 다시 · D25-A 연 뒤엔 해마다 같은 날).
 * f = state.festival, key = 오늘 dayKey
 */
export function festivalDueOn(f, key) {
  if (!key) return false;
  if (f.readyDay && !f.heldDay) return key > f.readyDay;
  if (f.heldDay && key.slice(5) === f.heldDay.slice(5) && key.slice(0, 4) > (f.lastYear ?? f.heldDay.slice(0, 4))) return true;
  return false;
}
