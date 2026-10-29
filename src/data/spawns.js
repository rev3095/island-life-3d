// 출현표: 어디서·몇 시에·몇 월에·어떤 날씨에 무엇이 나오나. 순수 함수라 rng 만 넘기면 결과가 정해진다.
import * as items from './items.js';
import { pickWeighted } from './rng.js';

/** 낚시 자리 → 잡히는 서식지. 선착장은 바다 물고기도, 하구는 강 물고기도 잡힌다 */
export const HABITAT_POOLS = { river: ['river'], pond: ['pond'], sea: ['sea'], pier: ['sea', 'pier'], mouth: ['river', 'mouth'] };
export const BUG_PLACES = ['flower', 'tree', 'ground', 'air', 'rock', 'water', 'lamp', 'fruit', 'palm', 'shake', 'under'];

export const FRUIT_PER_TREE = 5;      // 과일나무 한 그루 열매 수 (배경 스펙: 열매 5개)
export const COCONUT_PER_PALM = 2;
export const ROCK_MAX_HITS = 6;       // 바위 하나를 하루에 칠 수 있는 횟수
export const CHOP_MAX_HITS = 3;       // 나무 하나를 하루에 도끼로 칠 수 있는 횟수
export const SHAKE_BUG_CHANCE = 0.08; // 나무 흔들기: 벌집 대신 곤충이 떨어질 확률 (그 나무 그날 첫 '떨어짐' 몫)
export const ROCK_BUG_CHANCE = 0.15;  // 바위 치기 한 번마다 밑에서 곤충이 튀어나올 확률 (바위 하나에 하루 한 번)

const WET = new Set(['rain', 'snow']);
export const inHours = (hours, hour) => hours.some(([a, b]) => hour >= a && hour < b);

/** 지금 이 낚시 자리에서 잡힐 수 있는 물고기와 가중치 */
export function fishPool({ habitat = 'river', hour = 12, month = 1, weather = 'clear' } = {}) {
  const pool = HABITAT_POOLS[habitat];
  if (!pool) return [];
  const out = [];
  for (const it of items.list('fish')) {
    if (!it.habitats.some(h => pool.includes(h))) continue;
    if (!inHours(it.hours, hour) || !it.months.includes(month)) continue;
    let w = it.weight;
    if (WET.has(weather) && it.shadow >= 5) w *= 2;            // 비·눈 오는 날은 큰 물고기가 잘 문다
    if (habitat === 'mouth' && it.habitats.includes('mouth')) w *= 3;
    out.push({ item: it, weight: w });
  }
  return out;
}

/** 물고기 하나 정하기 → itemId (그 자리에 아무것도 없으면 null) */
export function fish({ rng = Math.random, ...opts } = {}) {
  return pickWeighted(fishPool(opts), e => e.weight, rng)?.item.id ?? null;
}

/** 물속 그림자 크기 1(아주 작음) ~ 6(대형) */
export const shadowOf = id => items.get(id)?.shadow ?? 0;

/** 지금 이 장소에 나올 수 있는 곤충과 가중치. place 는 하나 또는 배열 (예: 물가 꽃밭 ['flower', 'water']) */
export function bugPool({ place = 'flower', hour = 12, month = 1, weather = 'clear' } = {}) {
  const places = Array.isArray(place) ? place : [place];
  const wet = WET.has(weather);
  const out = [];
  for (const it of items.list('bug')) {
    if (!it.places.some(p => places.includes(p))) continue;
    if (!inHours(it.hours, hour) || !it.months.includes(month)) continue;
    if (it.rainOnly && weather !== 'rain') continue;            // 달팽이는 비 올 때만
    if (wet && it.flying) continue;                             // 비·눈 오면 날벌레는 숨는다
    out.push({ item: it, weight: it.weight });
  }
  return out;
}

/** 곤충 하나 정하기 → itemId | null */
export function bug({ rng = Math.random, ...opts } = {}) {
  return pickWeighted(bugPool(opts), e => e.weight, rng)?.item.id ?? null;
}

/** 화석 하나 정하기 → itemId (공룡 두개골이 가장 드묾). 감정 전 화석은 목록에 없다 */
export function fossil(rng = Math.random) {
  return pickWeighted(items.list('fossil'), it => it.weight, rng).id;
}
/** 화석 자리를 파면 나오는 것: 감정 전 화석 */
export const FOSSIL_UNKNOWN = items.UNKNOWN_FOSSIL;
/** 느루의 감정 → 진짜 화석 id (fossil 과 같은 가중치) */
export const appraise = (rng = Math.random) => fossil(rng);

/** 나무를 흔들면 떨어질 수 있는 곤충 (꿀벌 빼고): 'shake' 곤충과 나무 줄기 곤충 */
export function shakeBugPool({ hour = 12, month = 1, weather = 'clear' } = {}) {
  return bugPool({ place: ['shake', 'tree'], hour, month, weather }).filter(e => e.item.id !== 'bug.honeybee');
}
/** 바위를 치면 밑에서 튀어나올 수 있는 곤충 ('under') */
export const underRockPool = ({ hour = 12, month = 1, weather = 'clear' } = {}) => bugPool({ place: 'under', hour, month, weather });

/**
 * 바위 치기 한 번에 곤충이 튀어나오나 → itemId | null (ROCK_BUG_CHANCE, 그 시각·달에 나올 곤충이 있을 때만).
 * 하루 한 번 제한은 harvest.rockBug 가 맡는다
 */
export function rockBug(rng = Math.random, opts = {}) {
  const pool = underRockPool(opts);
  if (!pool.length || rng() >= ROCK_BUG_CHANCE) return null;
  return pickWeighted(pool, e => e.weight, rng)?.item.id ?? null;
}

/** 해변 조개 하나 → itemId */
export function shell(rng = Math.random) {
  return pickWeighted(items.list('shell'), it => it.weight, rng).id;
}

/**
 * 바위를 도끼로 치기 → { id, count } | null.
 * hits = 오늘 이 바위를 이미 친 횟수. 칠수록 철광석·도토리 주머니가 덜 나오고, ROCK_MAX_HITS 번 치면 그날은 끝(null).
 */
export function rock(rng = Math.random, hits = 0) {
  if (hits >= ROCK_MAX_HITS) return null;
  const fade = 1 - hits / ROCK_MAX_HITS;                       // 1 → 1/6
  const table = [
    ['mat.acorn-bag', 0.16 * fade * fade],
    ['mat.iron', 0.18 * fade],
    ['mat.clay', 0.2],
  ];
  let r = rng();
  for (const [id, p] of table) {
    if (r < p) return { id, count: 1 };
    r -= p;
  }
  return { id: 'mat.stone', count: hits === 0 && rng() < 0.3 ? 2 : 1 };
}

/** 나무에서 떨어질 수 있는 가구 (상점 가구 중 하나) */
export const SHAKE_FURNITURE = items.list('furn').filter(f => f.source === 'shop').map(f => f.id);

/**
 * 나무 흔들기 → { id, count, event? } | null
 * kind: 배경 slug 'tree' | 'fruit-tree' | 'palm' | 'cedar'
 * opts.fruit: 과일나무 열매 id ('fruit.apple' …), opts.fruitReady: 열매가 열려 있나
 * opts.dropped: 오늘 이 나무에서 이미 가구·도토리·벌집이 떨어졌나 (하루 한 번)
 * opts.orchard: 과수원 언덕이면 벌집 확률이 높다, opts.hour: 밤에는 벌이 안 나온다, opts.month·weather: 떨어지는 곤충
 * event 'bees' = 벌집이 떨어져 벌떼가 나옴. 잠자리채로 잡아야 꿀벌을 얻는다 (그냥 가방에 넣지 말 것)
 * event 'bug'  = 곤충이 툭 떨어져 기어 도망간다 (송충이 등). 이것도 잠자리채로 잡아야 한다
 */
export function treeShake(kind, rng = Math.random, opts = {}) {
  const { fruit = 'fruit.apple', fruitReady = false, dropped = false, orchard = false, hour = 12, month = 1, weather = 'clear' } = opts;
  if (kind === 'fruit-tree' && fruitReady) return { id: fruit, count: FRUIT_PER_TREE };
  if (kind === 'palm') return fruitReady ? { id: 'fruit.coconut', count: COCONUT_PER_PALM } : null;
  const r = rng();
  if (!dropped) {
    const bees = inHours(items.get('bug.honeybee').hours, hour) ? (orchard ? 0.15 : 0.06) : 0;
    if (r < bees) return { id: 'bug.honeybee', count: 1, event: 'bees' };
    const pool = shakeBugPool({ hour, month, weather });
    const bug = pool.length ? SHAKE_BUG_CHANCE : 0;
    if (r < bees + bug) return { id: pickWeighted(pool, e => e.weight, rng).item.id, count: 1, event: 'bug' };
    if (r < bees + bug + 0.03) return { id: SHAKE_FURNITURE[Math.floor(rng() * SHAKE_FURNITURE.length)], count: 1 };
    if (r < bees + bug + 0.1) return { id: 'mat.acorn-bag', count: 1 };
  }
  if (rng() < 0.35) return { id: 'mat.branch', count: 1 };
  return null;
}

/** 도끼로 나무 치기 → { id, count } | null. hits = 오늘 이 나무를 친 횟수 (CHOP_MAX_HITS 번까지) */
export function chopWood(rng = Math.random, hits = 0) {
  if (hits >= CHOP_MAX_HITS) return null;
  return { id: rng() < 0.6 ? 'mat.wood' : 'mat.hardwood', count: 1 };
}
