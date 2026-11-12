// M18-P2 「그날만」 하늘 (15차 보드 D192-A · D193-A): 해마다 같은 규칙으로 정해지는 특별한 날 다섯.
// 순수 — three·DOM 없음 (tests/sky-special.test.mjs 가 Node 에서 돌린다). 섬 씨앗을 섞지 않는다 → 어느 섬이든 같은 날 (날짜 흉내로 찾기 쉽게).
//  - 장마 하루    monsoon        6월 셋째 수요일 — 하루 종일 굵은 비 FX-03, 비 오는 날 생물, 우산 쓴 주민, 장면 s30
//  - 태풍         typhoon        9월 둘째 일요일 — 하루 종일 비바람 (굵은 비 FX-03, 바람 세게)
//  - 태풍 다음 날 after-typhoon  그다음 월요일 — 맑음, 아침 바닷가에 떠밀려 온 것이 가득
//  - 첫눈 하루    first-snow     12월 첫째 토요일 — 8시부터 눈, 하루 동안 쌓이는 눈 FX-04 · 발자국 · 눈 장식 레시피, 장면 s32
//  - 큰 유성우 밤 big-meteor     8월 둘째 토요일 · 12월 둘째 토요일 — 17시부터 맑음, 별똥별 두 배·별 조각 두 배, 장면 s31
// 12월은 첫눈 전까지 눈 대신 흐림 (그래야 「첫눈」). 주 1–2번 오는 보통 유성우(daily)는 그대로다.

export const SPECIAL_NAME = {
  monsoon: '장마', typhoon: '태풍', 'after-typhoon': '태풍 다음 날', 'first-snow': '첫눈', 'big-meteor': '큰 유성우 밤',
};
export const SPECIAL_EMOJI = { monsoon: '☔', typhoon: '🌀', 'after-typhoon': '🌊', 'first-snow': '❄️', 'big-meteor': '🌠' };
/** 날 정하는 규칙: [kind, 달, 몇째, 요일(0 일 … 6 토), 더할 날] */
export const SPECIAL_RULES = [
  ['monsoon', 6, 3, 3, 0],
  ['typhoon', 9, 2, 0, 0],
  ['after-typhoon', 9, 2, 0, 1],
  ['first-snow', 12, 1, 6, 0],
  ['big-meteor', 8, 2, 6, 0],
  ['big-meteor', 12, 2, 6, 0],
];
/** 첫눈 날 눈이 오기 시작하는 시각 · 다 쌓이는 데 걸리는 시간 (게임 시각) */
export const FIRST_SNOW = { from: 8, fill: 6 };
/** 큰 유성우 밤: 이 시각부터 맑음 */
export const BIG_METEOR_CLEAR = 17;

const pad = n => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
/** 그 해 그 달 n째 요일 (1일부터 센다) → 일(1~31) */
export function nthWeekday(year, month, nth, weekday) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
}

const cache = new Map();
/** 그 해의 특별한 날 → { 'YYYY-MM-DD': kind } */
export function specialDays(year) {
  if (cache.has(year)) return cache.get(year);
  const out = {};
  for (const [kind, m, nth, wd, add] of SPECIAL_RULES) {
    const t = new Date(Date.UTC(year, m - 1, nthWeekday(year, m, nth, wd) + add));
    out[keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())] = kind;
  }
  cache.set(year, out);
  return out;
}
/** 그 해 kind 날들 ['YYYY-MM-DD'] (날짜 흉내·점검용) */
export const daysOf = (year, kind) => Object.entries(specialDays(year)).filter(([, k]) => k === kind).map(([d]) => d);

/** 그날이 특별한 날인가 → { kind, name, emoji, heavy (굵은 비), dayKey } | null */
export function specialOf(dayKey) {
  if (typeof dayKey !== 'string' || dayKey.length < 10) return null;
  const kind = specialDays(+dayKey.slice(0, 4))[dayKey.slice(0, 10)];
  if (!kind) return null;
  return { kind, name: SPECIAL_NAME[kind], emoji: SPECIAL_EMOJI[kind], heavy: kind === 'monsoon' || kind === 'typhoon', dayKey };
}
export const isSpecial = (dayKey, kind) => specialOf(dayKey)?.kind === kind;
/** 12월 첫눈 전인가 (그날 눈은 흐림으로) */
export function beforeFirstSnow(dayKey) {
  if (typeof dayKey !== 'string' || dayKey.slice(5, 7) !== '12') return false;
  const [first] = daysOf(+dayKey.slice(0, 4), 'first-snow');
  return dayKey < first;
}

/**
 * 보통 예보(sky/weather.js forecast) 위에 특별한 날을 덮는다 → 새 [{ from, weather }] (원래 배열은 안 고침)
 */
export function applySpecial(dayKey, segs) {
  const sp = specialOf(dayKey);
  if (sp?.kind === 'monsoon' || sp?.kind === 'typhoon') return [{ from: 5, weather: 'rain' }];
  if (sp?.kind === 'after-typhoon') return [{ from: 5, weather: 'clear' }];
  if (sp?.kind === 'first-snow') return [{ from: 5, weather: 'cloudy' }, { from: FIRST_SNOW.from, weather: 'snow' }];
  let out = (segs ?? [{ from: 5, weather: 'clear' }]).map(s => ({ ...s }));
  if (beforeFirstSnow(dayKey)) out = out.map(s => (s.weather === 'snow' ? { ...s, weather: 'cloudy' } : s));
  if (sp?.kind === 'big-meteor') {
    out = out.filter(s => s.from < BIG_METEOR_CLEAR);
    if (!out.length) out = [{ from: 5, weather: 'clear' }];
    out.push({ from: BIG_METEOR_CLEAR, weather: 'clear' });
  }
  return out;
}

/**
 * 첫눈 날 땅에 쌓인 눈 0~1 (FX-04): 눈이 오기 시작한 뒤 FIRST_SNOW.fill 시간에 걸쳐 차오른다. 다른 날 = null (예전처럼 날씨로)
 *  hourF = 게임 하루 시각 (0~5 는 그날 밤)
 */
export function snowDepthAt(dayKey, hourF) {
  if (!isSpecial(dayKey, 'first-snow')) return null;
  const h = hourF < 5 ? hourF + 24 : hourF;
  return Math.max(0, Math.min(1, (h - FIRST_SNOW.from) / FIRST_SNOW.fill));
}
