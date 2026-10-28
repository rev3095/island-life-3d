// 게임 시계 계산. DOM·three 없이 순수 함수로만 짠다 (node 로도 돈다).
// 하루는 새벽 5시에 바뀐다: 새벽 2시는 아직 '어제'의 dayKey.

export const DAY_START_HOUR = 5;
export const FAST_SCALE = 60;          // fast 모드: 실제 1분 = 게임 1시간
const HOUR = 3600e3;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = n => String(n).padStart(2, '0');
const keyOfDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 시각(ms) → 'YYYY-MM-DD'. 5시 전이면 전날. */
export function dayKeyOf(ms) {
  return keyOfDate(new Date(ms - DAY_START_HOUR * HOUR));
}

/** dayKey 날의 아침 5시 시각(ms, 현지 시간) */
export function dayStartMs(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, DAY_START_HOUR, 0, 0, 0).getTime();
}

/** 0~24 시 → 5~29 '게임 하루 시각' (밤 0~5시는 24~29) */
export const dayHour = h => (h < DAY_START_HOUR ? h + 24 : h);

/** 하늘 섞기용 시각 4.5~28.5 (새벽 4시 반부터 '오늘'로 넘어가기 시작해서 5시 경계에서 끊기지 않게) */
export const blendHour = h => (h < 4.5 ? h + 24 : h);

/** 시각 → 시간대 id. parts 는 constants.DAY_PARTS 모양 ({id, from, to}, 밤은 19~29). */
export function partOf(hourF, parts) {
  const hh = dayHour(hourF);
  return (parts.find(p => hh >= p.from && hh < p.to) ?? parts[parts.length - 1]).id;
}

/** 시각(ms) → time.now() 모양 */
export function computeNow(ms, { seasonOf, parts, seasonOverride = null }) {
  const d = new Date(ms);
  const hour = d.getHours(), minute = d.getMinutes();
  const hourF = hour + minute / 60 + d.getSeconds() / 3600 + d.getMilliseconds() / 3600e3;
  const month = d.getMonth() + 1;
  const part = partOf(hourF, parts);
  return {
    year: d.getFullYear(), month, day: d.getDate(), hour, minute,
    weekday: d.getDay(), weekdayName: WEEKDAYS[d.getDay()],
    season: seasonOverride ?? seasonOf(month),
    part, isNight: part === 'night',
    dayKey: dayKeyOf(ms),
    hourF, ms,
  };
}

/** 같은 dayKey 안에서 '게임 하루 시각'(5~29) 으로 옮긴 시각(ms) */
export function msAtDayHour(dayKey, hh) {
  return dayStartMs(dayKey) + (hh - DAY_START_HOUR) * HOUR;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 밤 정도 0(낮) ~ 1(밤). 저녁 6시쯤 가로등이 켜지기 시작하고 새벽 6시쯤 꺼진다. */
export function nightFactorAt(hourF) {
  const hh = blendHour(hourF);   // 4.5~28.5: 아침엔 둘째 항, 저녁·한밤엔 첫째 항이 1
  return Math.max(smoothstep(17.4, 19.0, hh), 1 - smoothstep(4.9, 6.2, hh));
}
