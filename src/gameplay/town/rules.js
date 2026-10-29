// 주민 규칙 (DOM·three 없음, node 로 확인): 친밀도·하루 한 번 말 걸기·부탁·선물 반응·일과·대사 고르기.
// 상태는 state.villagers[slug] 에 둔다 (docs/CONTRACTS.md '상태' 표: villagers 는 2차 gameplay 몫).
// 숫자(친밀도·선물 점수·부탁 보상)는 assets/data/rules.json 의 town 칸 (게임 숫자 표 → "숫자 반영"), 주민마다의 값은 assets/villagers/<slug>.json.
import { RULES } from '../../data/tables.js';

const T = RULES.town;
export const FRIEND_MAX = T.friendMax;
/** 친밀도 단계: [id, 최소값] — 대사 묶음 이름과 같다 */
export const TIERS = T.tiers;
export const TALK_BONUS = T.talkBonus;                        // 그날 처음 말 걸면
export const GIFT_POINTS = T.giftPoints;                      // 선물 반응 → 친밀도
export const GIFTS_COUNTED_PER_DAY = T.giftsCountedPerDay;    // 하루에 친밀도가 오르는 선물 수
export const REQUEST_POINTS = T.requestPoints;                // 부탁 들어주기
export const REQUEST_DAYS = T.requestDays;                    // 부탁은 며칠 지나면 잊는다
export const CAT_LABEL = { fish: '물고기', bug: '곤충', fruit: '과일', flower: '꽃', shell: '조개', fossil: '화석', mat: '재료', furn: '가구', seed: '씨앗' };

// ---------- 난수 ----------

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** 같은 재료면 같은 수열 (mulberry32) */
export function rngOf(...parts) {
  let a = hashStr(parts.join('|'));
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pickWeighted(list, r, weight = x => x.w ?? 1) {
  const total = list.reduce((s, x) => s + weight(x), 0);
  let v = r() * total;
  for (const x of list) { v -= weight(x); if (v < 0) return x; }
  return list[list.length - 1];
}

// ---------- 주민 상태 ----------

/** state.villagers[slug] 을 빈 칸 채워서 돌려준다 (불러온 저장에 없는 칸도 채움) */
export function villagerState(state, slug) {
  state.villagers ??= {};
  const v = (state.villagers[slug] ??= {});
  v.friendship ??= 0;
  v.met ??= false;
  v.lastTalk ??= null;     // 마지막으로 말 건 dayKey
  v.talkDays ??= 0;        // 말 건 날 수
  v.giftDay ??= null;
  v.giftsToday ??= 0;
  v.backDay ??= null;      // 답례 선물을 준 날 (하루 한 번)
  v.request ??= null;      // { cat, id, label, day }
  v.doneDay ??= null;      // 부탁을 끝낸 날
  v.pending ??= [];        // 가방이 꽉 차서 못 준 물건: id 또는 { id, variant }
  v.photo ??= false;       // 친밀도 최고 사진을 줬나
  v.thankedDay ??= null;   // 고맙다는 편지를 보낸 부탁의 날
  v.cakeDay ??= null;      // 생일 케이크를 나눠 준 날 (5차)
  v.cheerDay ??= null;     // 플레이어 생일을 축하한 날 (5차)
  return v;
}

export const tierOf = f => TIERS.reduce((t, [id, min]) => (f >= min ? id : t), 'new');

/** 친밀도 더하기 → { before, after, up } (up = 올라간 새 단계 id) */
export function addFriendship(v, n) {
  const before = v.friendship;
  v.friendship = Math.max(0, Math.min(FRIEND_MAX, before + n));
  const a = tierOf(before), b = tierOf(v.friendship);
  return { before, after: v.friendship, up: a !== b && v.friendship > before ? b : null };
}

/** 그날 처음 말 걸었는지 기록 → { first, up } */
export function dailyTalk(v, dayKey) {
  if (v.lastTalk === dayKey) return { first: false, up: null };
  v.lastTalk = dayKey;
  v.talkDays++;
  return { first: true, up: addFriendship(v, TALK_BONUS).up };
}

// ---------- 주민 방 (5차) ----------

/** house:enter / house:leave 의 주인 slug (house 쪽 이름이 달라도 받게 여러 키를 본다). 플레이어 집이면 null */
export const ownerOf = e => {
  const o = e?.owner ?? e?.slug ?? e?.villager ?? e?.who ?? e?.house?.owner ?? null;
  return typeof o === 'string' && o !== 'player' ? o : null;
};

// ---------- 날짜 ----------

const dayNum = key => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
export const daysBetween = (a, b) => (a && b ? dayNum(b) - dayNum(a) : Infinity);

// ---------- 일과 ----------

/** 5~29 시 (밤 0~5시는 전날의 24~29시) */
export const dayHour = now => {
  const h = now.hourF ?? now.hour + (now.minute ?? 0) / 60;
  return h < 5 ? h + 24 : h;
};

/** 그날의 나오는 시각·들어가는 시각 (dayKey 시드로 ±0.5시간 흔들림) */
export function scheduleOf(person, dayKey) {
  const r = rngOf(dayKey, person.slug, 'schedule');
  return { wake: person.wake + (r() - 0.5), sleep: person.sleep + (r() - 0.5) };
}

/** 지금 밖에 있어야 하나 */
export function shouldBeOut(person, now, weather) {
  const h = dayHour(now);
  const { wake, sleep } = scheduleOf(person, now.dayKey);
  if (h < wake || h >= sleep) return false;
  if (weather === 'rain' && person.rainStay) return false;
  if (weather === 'snow' && person.snowStay) return false;
  return true;
}

/** 대사 시간대: dawn 5~8, morning 8~12, afternoon 12~17, evening 17~20, night 20~5 */
export function slotOf(now) {
  const h = dayHour(now);
  return h < 8 ? 'dawn' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 20 ? 'evening' : 'night';
}

// ---------- 대사 ----------

/** 마지막 글자 받침에 맞춘 조사. kind 는 '을','이','은','와','로','이랑','아' 중 하나 (받침 있는 쪽 이름) */
export function josa(word, kind) {
  const w = String(word ?? '');
  const code = w.charCodeAt(w.length - 1) - 0xac00;
  const has = code >= 0 && code <= 11171 ? code % 28 : -1;
  const pairs = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 와: ['과', '와'], 과: ['과', '와'],
    이랑: ['이랑', '랑'], 랑: ['이랑', '랑'], 아: ['아', '야'], 야: ['아', '야'], 으로: ['으로', '로'], 로: ['으로', '로'], 이에요: ['이에요', '예요'] };
  const p = pairs[kind];
  // '이다'·'이야'·'이냥' 처럼 '이'로 시작하는 서술격은 받침이 없으면 '이'를 뺀다 (사과다, 귤이다)
  if (!p) return w + (kind.length > 1 && kind[0] === '이' && has <= 0 ? kind.slice(1) : kind);
  if (has < 0) return w + p[1];
  if (p[0] === '으로') return w + (has && has !== 8 ? '으로' : '로');   // ㄹ 받침은 '로'
  return w + (has ? p[0] : p[1]);
}

/** '{item:을} 줄래?' 같은 자리 채우기. 값이 없는 자리는 그대로 둔다 */
export const fill = (text, vars = {}) => String(text).replace(/\{(\w+)(?::(\S+?))?\}/g, (m, k, j) => (vars[k] == null ? m : j ? josa(vars[k], j) : String(vars[k])));

/** 대사 묶음에서 하나 (최근에 한 말은 피한다). 항목은 문자열 또는 여러 줄 배열 → 늘 배열로 */
export function pickLines(pool, r, recent = null) {
  if (!pool?.length) return [];
  const key = e => (Array.isArray(e) ? e[0] : e);
  const fresh = recent ? pool.filter(e => !recent.includes(key(e))) : pool;
  const list = fresh.length ? fresh : pool;
  const e = list[Math.floor(r() * list.length)];
  if (recent) { recent.push(key(e)); if (recent.length > 12) recent.shift(); }
  return Array.isArray(e) ? e.slice() : [e];
}

/**
 * 인사 고르기: 시간대 인사 한 줄 + (날씨·계절·친밀도 가운데) 한 줄.
 * L = 주민 대사 묶음, c = { now, weather, season, tier, r, recent }
 */
export function greetingLines(L, c) {
  const slot = slotOf(c.now);
  const out = pickLines(L.greet?.[slot] ?? L.greet?.morning, c.r, c.recent);
  const roll = c.r();
  const notable = c.weather === 'rain' || c.weather === 'snow' || c.weather === 'rainbow';
  let extra = null;
  if (notable && roll < 0.7) extra = L.weather?.[c.weather];
  else if (roll < 0.4) extra = L.season?.[c.season];
  else if (roll < 0.75) extra = L.tier?.[c.tier];
  if (extra) out.push(...pickLines(extra, c.r, c.recent));
  return out;
}

/** 잡담 하나: 보통 잡담 + 친밀도·계절·날씨·시간대 묶음을 섞어서 */
export function chatLines(L, c) {
  const slot = slotOf(c.now);
  const pools = [[L.chat, 5], [L.tier?.[c.tier], 2], [L.season?.[c.season], 1.5], [L.weather?.[c.weather], 1.2], [L.time?.[slot], 1.2]]
    .filter(([p]) => p?.length).map(([p, w]) => ({ p, w }));
  if (!pools.length) return [];
  return pickLines(pickWeighted(pools, c.r).p, c.r, c.recent);
}

// ---------- 부탁 ----------

/** 오늘의 부탁 (같은 날 다시 물어도 같다). items = data.items, nativeFruit = 특산 과일 id */
export function makeRequest(person, { dayKey, items, nativeFruit }) {
  const r = rngOf(dayKey, person.slug, 'request');
  const w = pickWeighted(person.wants, r);
  const id = w.id === 'native' ? nativeFruit ?? 'fruit.apple' : w.id ?? null;
  const label = id ? items?.get?.(id)?.name ?? id : CAT_LABEL[w.cat] ?? w.cat;
  return { cat: id ? null : w.cat, id, label, day: dayKey };
}

/** 이 물건이 부탁한 것인가 */
export const matchesRequest = (req, item) => !!req && !!item && (req.id ? item.id === req.id : item.category === req.cat);

/** 오래된 부탁은 잊는다 → 지금 부탁(또는 null) */
export function currentRequest(v, dayKey) {
  if (v.request && daysBetween(v.request.day, dayKey) >= REQUEST_DAYS) v.request = null;
  return v.request;
}

/** 부탁 보상: 가구(주민마다 고른 것) 또는 도토리 주머니 → { id, n } */
export function requestReward(person, item, r) {
  const q = T.requestReward;
  if (person.rewards?.length && r() < q.furnitureChance) return { id: person.rewards[Math.floor(r() * person.rewards.length)], n: 1 };
  const value = item?.price ?? q.valueDefault;
  return { id: 'mat.acorn-bag', n: Math.max(q.bagMin, Math.min(q.bagMax, Math.round((value * q.valueMult + q.valuePlus) / 100))) };
}

// ---------- 선물 ----------

/** 좋아함 목록 항목: 카테고리('fish'), id('fruit.peach'), 'rare', 'hybrid', 'price>=1000' */
function matchOne(rule, item) {
  if (rule === 'rare') return !!item.rare;
  if (rule === 'hybrid') return !!item.hybrid;
  const m = /^price>=(\d+)$/.exec(rule);
  if (m) return (item.price ?? 0) >= Number(m[1]);
  return rule.includes('.') ? item.id === rule : item.category === rule;
}
const matchAny = (rules, item) => (rules ?? []).some(rule => matchOne(rule, item));

export function giftReaction(person, item) {
  if (!item) return 'normal';
  if (item.category === 'festival') return 'love';   // 5차 Z5: 축제 부스에서 만든 것은 누구나 좋아한다
  if (matchAny(person.loves, item)) return 'love';
  if (matchAny(person.dislikes, item)) return 'dislike';
  if (matchAny(person.likes, item)) return 'like';
  return 'normal';
}

/** 선물 받기 기록 → { reaction, points, up }. mult = 친밀도 배수 (생일이면 BIRTHDAY_GIFT_MULT) */
export function receiveGift(v, person, item, dayKey, mult = 1) {
  if (v.giftDay !== dayKey) { v.giftDay = dayKey; v.giftsToday = 0; }
  v.giftsToday++;
  const reaction = giftReaction(person, item);
  const points = v.giftsToday <= GIFTS_COUNTED_PER_DAY ? GIFT_POINTS[reaction] * mult : 0;
  return { reaction, points, up: addFriendship(v, points).up };
}

/** 답례 선물 (하루 한 번, 친할수록·좋아하는 걸 받을수록 잘 준다) → 아이템 id | null */
export function giftBack(v, person, reaction, dayKey, r) {
  if (v.backDay === dayKey || reaction === 'dislike' || !person.gifts?.length) return null;
  const chance = 0.15 + v.friendship / 400 + (reaction === 'love' ? 0.15 : 0);
  if (r() >= chance) return null;
  v.backDay = dayKey;
  return pickWeighted(person.gifts, r).id;
}

/** 인사 때 먼저 주는 선물 (친구 이상, 그날 처음 말 걸 때 가끔) */
export function surpriseGift(v, person, dayKey, r) {
  if (v.backDay === dayKey || v.friendship < 30 || !person.gifts?.length) return null;
  if (r() >= 0.12 + (v.friendship - 30) / 700) return null;
  v.backDay = dayKey;
  return pickWeighted(person.gifts, r).id;
}

// ---------- 편지 ----------

const LETTER_CHANCE = { friend: 0.18, close: 0.3, best: 0.4 };
export const LETTERS_PER_DAY = 3;

/**
 * 그날 아침 우편함에 올 편지 계획 (같은 날엔 같다) → [{ from, kind: 'thanks'|'friend'|'close', gift, mark? }]
 * thanks = 1~3일 안에 부탁을 들어준 주민 (mark 를 v.thankedDay 에 적으면 다시 안 보낸다). 친구 이상은 가끔.
 */
export function planLetters(state, people, dayKey) {
  const out = [];
  for (const P of Object.values(people)) {
    const v = state.villagers?.[P.slug];
    if (!v?.met) continue;
    const r = rngOf(dayKey, P.slug, 'mail');
    const gift = chance => (P.gifts?.length && r() < chance ? pickWeighted(P.gifts, r).id : null);
    const since = daysBetween(v.doneDay, dayKey);
    if (v.doneDay && v.thankedDay !== v.doneDay && since >= 1 && since <= 3) {
      out.push({ from: P.slug, kind: 'thanks', gift: gift(0.6), mark: v.doneDay });
      continue;
    }
    const tier = tierOf(v.friendship);
    if (LETTER_CHANCE[tier] && r() < LETTER_CHANCE[tier]) out.push({ from: P.slug, kind: tier === 'friend' ? 'friend' : 'close', gift: gift(0.5) });
  }
  const rank = p => (p.kind === 'thanks' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b)).slice(0, LETTERS_PER_DAY);
}
