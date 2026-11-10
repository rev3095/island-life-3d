// 하루와 하루 리셋. 하루는 새벽 5시에 바뀐다 (time 서비스가 있으면 그 dayKey 를 따른다).
// 리셋 기록은 state.island 에 남긴다:
//   island.dayKey  마지막으로 리셋한 날
//   island.fruit   { 나무id: 딴 날 }  → FRUIT_REGROW_DAYS 지나면 다시 열림
//   island.daily   { fossils, dug, shells, shellsPicked, weeds, rocks, chops, trees }  그날 남은 수·친 횟수
// 숫자는 assets/data/rules.json 의 day 칸 (표 편집기 → "숫자 반영").
import { rngFor, randInt, sample } from './rng.js';
import { RULES } from './tables.js';

const D = RULES.day;
export const DAY_BOUNDARY_HOUR = D.boundaryHour;
export const FRUIT_REGROW_DAYS = D.fruitRegrowDays;
export const FOSSILS_PER_DAY = D.fossilsPerDay;
export const SHELLS_PER_DAY = D.shellsPerDay;     // 날마다 이 범위에서 새로 밀려온다 (전날 것은 쓸려 감)
export const WEEDS_PER_DAY = D.weedsPerDay;       // 날마다 이만큼 더 돋는다 (안 뽑으면 쌓임)
export const WEEDS_START = D.weedsStart;
export const WEEDS_MAX = D.weedsMax;

const pad = n => String(n).padStart(2, '0');
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDayKey = s => typeof s === 'string' && DAY_RE.test(s);

/** 날짜 → 'YYYY-MM-DD'. 새벽 5시 전이면 아직 전날이다 */
export function dayKeyOf(date = new Date(), boundaryHour = DAY_BOUNDARY_HOUR) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getHours() < boundaryHour ? 1 : 0));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** time 서비스의 now() → dayKey. dayKey 가 없으면 연·월·일·시로 만든다 */
export function dayKeyFromNow(now) {
  if (!now) return null;
  if (isDayKey(now.dayKey)) return now.dayKey;
  if ([now.year, now.month, now.day].every(Number.isFinite)) {
    return dayKeyOf(new Date(now.year, now.month - 1, now.day, now.hour ?? 12, now.minute ?? 0));
  }
  return null;
}

const utc = key => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
/** a 에서 b 까지 며칠 (b 가 앞이면 음수) */
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

export function freshDaily() {
  return { fossils: FOSSILS_PER_DAY, dug: [], shells: 0, shellsPicked: [], weeds: 0, rocks: {}, chops: {}, trees: {} };
}

/**
 * 하루 리셋 (island 를 고친다). 같은 섬 상태 + 같은 dayKey 면 결과가 늘 같다.
 * 이미 그날이면 null, 아니면 { dayKey, prev, days, regrown, fossils, shells, weeds }.
 */
export function runDailyReset(island, dayKey, { allowBack = false } = {}) {
  if (!isDayKey(dayKey) || island.dayKey === dayKey) return null;
  const prev = isDayKey(island.dayKey) ? island.dayKey : null;
  // 11차 시계: 날짜는 앞으로만 — 지난 날로 돌아가도 하루를 다시 받지 않는다 (날짜 흉내 시험 칸만 allowBack)
  if (prev && dayKey < prev && !allowBack) return null;
  const days = prev ? Math.max(1, daysBetween(prev, dayKey)) : 0;    // 0 = 첫날, 시계를 되돌려도 하루로 친다
  const rng = rngFor(island.seed ?? 0, dayKey, 'daily');
  const old = island.daily ?? {};

  let weeds = prev ? (Number.isFinite(old.weeds) ? old.weeds : 0) : WEEDS_START;
  for (let i = 0; i < Math.min(days, 30); i++) weeds += randInt(rng, ...WEEDS_PER_DAY);
  weeds = Math.min(WEEDS_MAX, weeds);

  island.daily = { ...freshDaily(), shells: randInt(rng, ...SHELLS_PER_DAY), weeds };

  if (!island.fruit || typeof island.fruit !== 'object') island.fruit = {};
  const regrown = [];
  for (const [treeId, picked] of Object.entries(island.fruit)) {
    const age = isDayKey(picked) ? daysBetween(picked, dayKey) : FRUIT_REGROW_DAYS;
    if (age >= FRUIT_REGROW_DAYS || age < 0) {
      delete island.fruit[treeId];
      regrown.push(treeId);
    }
  }
  island.dayKey = dayKey;
  return { dayKey, prev, days, regrown, fossils: island.daily.fossils, shells: island.daily.shells, weeds };
}

/** 데이터 서비스의 day: key() · check() 와 그날 기록 도우미 */
export function createDay({ state, getNow = () => null, onNewDay = () => {}, allowBack = false }) {
  const key = () => dayKeyFromNow(safe(getNow)) ?? dayKeyOf(new Date());
  const daily = () => {
    if (!state.island.daily || state.island.dayKey !== key()) check();   // 지난 날이면 check 가 아무것도 안 하고 그날 기록을 그대로 쓴다
    return state.island.daily ?? (state.island.daily = freshDaily());
  };

  /** 새 날이면 하루 리셋을 하고 true */
  function check() {
    const r = runDailyReset(state.island, key(), { allowBack });
    if (r) onNewDay(r);
    return !!r;
  }

  return {
    key, check, daily,
    /** 오늘 놓을 자리 고르기: 후보 칸 중 n 개 (같은 날·같은 salt 면 늘 같다). 예: pickSpots(tiles, 4, 'fossil') */
    pickSpots: (candidates, n, salt = 'spot') => sample(candidates, n, rngFor(state.island.seed ?? 0, key(), salt)),
    /** 오늘 시드 난수 */
    rng: (...salt) => rngFor(state.island.seed ?? 0, key(), ...salt),
    daysSince: dayKey => (isDayKey(dayKey) ? daysBetween(dayKey, key()) : null),
  };
}

function safe(fn) {
  try { return fn(); } catch { return null; }
}
