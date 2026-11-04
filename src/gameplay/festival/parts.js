// 축제 부품 5개와 부스 (DOM·three 없음, node 로 확인). 검수 보드 z5 D20-B: 주민과 이모티콘으로 마음을 열고 🎉로 물으면
// 그 주민이 필요한 것을 이모티콘으로 알려 주고, 섬에서 채집해 가져다주면 부품을 준다. 부품 하나 = 부스 하나 (D22-A 건네면 바로 선다).
// 부품 목록·필요한 것·마음 여는 기준은 assets/festival/config.json 의 parts 칸 (결정이 바뀌면 그 파일만 고친다).
import { tierOf, heartCount } from '../town/rules.js';
export const CONFIG_FILE = 'assets/festival/config.json';
const TIER_ORDER = ['new', 'known', 'friend', 'close', 'best'];

/** 아이템이 match 에 맞나: { id } · { category } · { shadowMin } */
const matches = (m, it) => (!m.id || it.id === m.id) && (!m.category || it.category === m.category) && (m.shadowMin == null || (it.shadow ?? 0) >= m.shadowMin);

/**
 * 설정의 need 칸 → pick(slots, items, c) → [{ slot, n }] | null (모자라면 null).
 * need = { match, n } · { match, n, kinds } (서로 다른 것 kinds 가지 이상) · { match, n, oneNot: 'native' } (섬 특산 아닌 것 하나 이상) ·
 *        { any: [need, …] } (앞에서부터 처음 맞는 것)
 */
export function needPicker(need) {
  if (need.any) { const ps = need.any.map(needPicker); return (slots, items, c) => { for (const p of ps) { const r = p(slots, items, c); if (r) return r; } return null; }; }
  const test = it => matches(need.match ?? {}, it);
  if (need.kinds) return (slots, items) => takeVaried(slots, items, test, need.n, need.kinds);
  if (need.oneNot === 'native') return (slots, items, c) => takeWithOne(slots, items, test, need.n, it => it.id !== c?.nativeFruit);
  return (slots, items) => takeAny(slots, items, test, need.n);
}

/** 설정 → 부품 도구 { PARTS, PART_BY_ID, PART_OF, ROLES, heartOpen(v) } */
export function makeParts(cfg) {
  const P = cfg.parts;
  const PARTS = P.list.map(p => ({ ...p, pick: needPicker(p.need) }));
  const open = P.open ?? { tier: 'friend', wins: 2 };
  return {
    PARTS,
    PART_BY_ID: Object.fromEntries(PARTS.map(p => [p.id, p])),
    PART_OF: Object.fromEntries(PARTS.map(p => [p.who, p])),
    /** 부품이 없는 주민의 축제 몫 (보리 = 개막 종, 단풍 = 사진사) */
    ROLES: P.roles ?? {},
    /** 이 주민이 마음을 열었나 (v = state.villagers[slug]). 친밀도 단계 + 마음이 통한 일 wins 번 (open.ways — 7차 D50-A 이모티콘·선물·부탁). D20-A(마음 열기만)·C(탐험)는 method 로 */
    heartOpen: v => TIER_ORDER.indexOf(tierOf(v?.friendship ?? 0)) >= TIER_ORDER.indexOf(open.tier) && heartCount(v, open.ways) >= open.wins,
  };
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
export const allParts = (f, PARTS) => PARTS.every(p => f.parts?.[p.id]);

/** 해마다 축제를 여는 날수 (7차 D55-A: 그 날짜부터 사흘 안, 한 해 한 번) */
export const YEARLY_DAYS = 3;
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** 그해의 축제 날짜 (처음 연 날의 월·일 — 2월 29일은 없는 해엔 2월 28일) */
export function anniversary(heldDay, year) {
  const md = heldDay.slice(5);
  return `${String(year).padStart(4, '0')}-${md === '02-29' && !leap(year) ? '02-28' : md}`;
}
/** 오늘이 몇 년 축제 사흘 안인가 → 그 해 (문자열) | null. 연말 축제는 다음 해 1월로 넘어갈 수 있다 */
export function festivalYearOf(f, key, days = YEARLY_DAYS) {
  if (!f.heldDay || !key) return null;
  const y = Number(key.slice(0, 4));
  for (const Y of [y, y - 1]) {
    const a = anniversary(f.heldDay, Y);
    if (key >= a && key <= addDays(a, days - 1)) return String(Y);
  }
  return null;
}

/**
 * 축제 날인가 (D23-A 다 모은 다음 날부터 — 놓쳐도 다음 날 다시 · D25-A 연 뒤엔 해마다 같은 날, 7차 D55-A 그 날부터 사흘 안).
 * f = state.festival, key = 오늘 dayKey, yearly = 설정 after.mode 가 'yearly' 인가
 */
export function festivalDueOn(f, key, { yearly = true, days = YEARLY_DAYS } = {}) {
  if (!key) return false;
  if (f.readyDay && !f.heldDay) return key > f.readyDay;
  if (!yearly || !f.heldDay) return false;
  const Y = festivalYearOf(f, key, days);
  return !!Y && Y > (f.lastYear ?? f.heldDay.slice(0, 4));
}
