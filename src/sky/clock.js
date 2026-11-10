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

// ── 11차 시계 (섬폰 「🕰 시계」, docs/notes/p33-clock.md) ──
// 바꾼 시각은 실제 시계에서 떨어진 정도(offset, ms)로 state.time.offset 에 저장한다.
// 하루 일(리셋·주민·상점 물건·행사 기록)은 dayKey 로 갈리므로, 날짜는 앞으로만 간다:
// state.time.maxDay(가 본 가장 늦은 날) 의 아침 5시보다 앞으로는 돌릴 수 없다.
export const DAY_MS = 24 * HOUR;
export const SHIFT_MAX_DAYS = 7;       // 한 번에 앞으로 옮길 수 있는 날 수

/** 이 날(dayKey)부터 그 뒤만 갈 수 있다 → 그 날 아침 5시(ms). 날짜가 없으면 -Infinity */
export const floorMsOf = maxDay => (typeof maxDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(maxDay) ? dayStartMs(maxDay) : -Infinity);

/** 두 dayKey 사이 날 수 (b - a) */
export function dayDiff(a, b) {
  const u = k => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((u(b) - u(a)) / DAY_MS);
}

/** 늦은 쪽 dayKey (없는 값은 건너뜀) */
export const laterDay = (a, b) => (!a ? b ?? null : !b ? a : a > b ? a : b);

/**
 * 날짜가 maxDay 보다 앞이면 offset 에 하루씩 더해 그날로 맞춘다 (시·분은 그대로).
 * 「지금 시각으로 돌아가기」·불러오기·PC 시계를 되돌렸을 때 — 하루를 두 번 받지 않게.
 * → { offset, days(더한 날 수) }
 */
export function catchUpOffset(realMs, offset, maxDay) {
  let days = 0;
  if (typeof maxDay === 'string') {
    while (dayKeyOf(realMs + offset) < maxDay && days < 3660) { offset += DAY_MS; days++; }
  }
  return { offset, days };
}

/**
 * 시계 창이 고른 곳 → 갈 시각(ms). baseDayKey 날의 hour:minute (0~5시는 그날 밤 = 다음 달력 날),
 * days 만큼 뒤의 날. 5시 경계 규칙을 따른다.
 */
export function msAtClock(baseDayKey, hour, minute = 0, days = 0) {
  const hh = dayHour(((hour % 24) + 24) % 24 + minute / 60);
  return msAtDayHour(baseDayKey, hh) + days * DAY_MS;
}

/** 갈 시각을 [floor, ceil] 안으로 → { ms, clamped: 'floor'|'ceil'|null } */
export function clampShift(target, { floor = -Infinity, ceil = Infinity } = {}) {
  if (target < floor) return { ms: floor, clamped: 'floor' };
  if (target > ceil) return { ms: ceil, clamped: 'ceil' };
  return { ms: target, clamped: null };
}

/**
 * 시계 몸통 (sky/index.js 가 쓴다 · 테스트는 realNow 를 바꿔 끼운다).
 * getTime() → state.time ({ mode, fastOffset, offset, maxDay }), baseShift = 날짜 흉내로 옮긴 정도,
 * extraDay() → 함께 볼 '가 본 날' (진짜 섬은 data 의 island.dayKey, 날짜 흉내는 null).
 */
export function createTimeline({ getTime, baseShift = 0, extraDay = () => null, realNow = () => Date.now() }) {
  let pausedMs = null;
  const t = () => {
    const s = getTime();
    if (s.mode !== 'fast') s.mode = 'real';
    if (typeof s.fastOffset !== 'number') s.fastOffset = 0;
    if (!Number.isFinite(s.offset)) s.offset = 0;
    if (s.maxDay != null && !/^\d{4}-\d{2}-\d{2}$/.test(s.maxDay)) s.maxDay = null;
    return s;
  };
  const clockMs = () => {
    if (pausedMs != null) return pausedMs;
    const s = t();
    return s.mode === 'fast' ? realNow() * FAST_SCALE + s.fastOffset : realNow() + baseShift + s.offset;
  };
  const maxDay = () => laterDay(t().maxDay, extraDay());
  const floorMs = () => floorMsOf(maxDay());
  /** 같은 흐름을 유지한 채 시계를 target(ms) 으로 */
  function shiftTo(target) {
    if (pausedMs != null) { pausedMs = target; return; }
    const s = t();
    const d = target - clockMs();
    if (s.mode === 'fast') s.fastOffset += d;
    else s.offset += d;
  }
  /** 날짜가 가 본 날보다 앞이면 하루씩 더해 맞춘다 → 더한 날 수 */
  function catchUp() {
    const s = t(), md = maxDay();
    if (!md || pausedMs != null) return 0;
    const fast = s.mode === 'fast';
    const r = catchUpOffset(fast ? realNow() * FAST_SCALE : realNow() + baseShift, fast ? s.fastOffset : s.offset, md);
    if (fast) s.fastOffset = r.offset; else s.offset = r.offset;
    return r.days;
  }
  /** 지금 날이 가 본 날보다 늦으면 적어 둔다 */
  function mark(dayKey) { const s = t(); if (!s.maxDay || dayKey > s.maxDay) s.maxDay = dayKey; }
  return {
    state: t, clockMs, maxDay, floorMs, shiftTo, catchUp, mark,
    range: () => ({ floor: floorMs(), ceil: clockMs() + SHIFT_MAX_DAYS * DAY_MS }),
    /** 갈 시각을 범위 안으로 → { ms, clamped } */
    clamp: target => clampShift(target, { floor: floorMs(), ceil: clockMs() + SHIFT_MAX_DAYS * DAY_MS }),
    setMode(mode) {
      const s = t();
      if ((mode !== 'real' && mode !== 'fast') || s.mode === mode) return;
      const cur = clockMs();
      s.mode = mode;
      if (mode === 'fast') s.fastOffset = cur - realNow() * FAST_SCALE;
      else { s.offset = 0; if (pausedMs != null) pausedMs = realNow() + baseShift; catchUp(); }
    },
    /** offset 0 (빠른 시간이면 실제로) + 가 본 날 맞추기 → { target(ms), caught } — 시계는 옮기지 않는다 */
    resetTarget() {
      const s = t(), prev = clockMs();
      const save = { mode: s.mode, offset: s.offset, fastOffset: s.fastOffset };
      s.mode = 'real'; s.offset = 0;
      const caught = catchUp();
      const target = clockMs();
      Object.assign(s, save);
      if (pausedMs != null) pausedMs = prev;
      return { target, caught, offset: target - realNow() - baseShift };
    },
    get paused() { return pausedMs != null; },
    setPaused(on) {
      if (on && pausedMs == null) pausedMs = clockMs();
      else if (!on && pausedMs != null) { const v = pausedMs; pausedMs = null; shiftTo(v); }
    },
  };
}
