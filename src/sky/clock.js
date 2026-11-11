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

/**
 * P47 오늘 · 내일: 시계 바늘·−1/+1·낮/밤 단추가 움직이는 「오늘」 = 지금 게임 하루 (그날 새벽 5시 ~ 다음 날 새벽 5시 직전).
 * 내일로는 「내일 ▶」 로만 넘어간다 (실수로 날이 넘어가 오늘로 못 돌아오는 일이 없게). range = time.range() { floor, ceil }
 */
export function todayRange(dayKey, range = {}) {
  const start = msAtDayHour(dayKey, 5), end = msAtDayHour(dayKey, 29) - 60000;
  return { floor: Math.max(range.floor ?? -Infinity, start), ceil: Math.min(range.ceil ?? Infinity, end) };
}
/** 낮·밤 단추 (게임 하루 시각 5~29 — 새벽 3시 = 27, 그날 밤) */
export const DAY_JUMPS = Object.freeze([
  { key: 'morning', icon: '🌅', name: '아침', hour: 7 },
  { key: 'noon', icon: '☀️', name: '낮', hour: 12 },
  { key: 'evening', icon: '🌇', name: '저녁', hour: 18 },
  { key: 'night', icon: '🌙', name: '밤', hour: 22 },
  { key: 'dawn', icon: '🌌', name: '새벽', hour: 27 },
]);
/** 내일로 넘어갈 때 도착 시각 (다음 날 아침) */
export const TOMORROW_HOUR = 7;

/** 갈 시각을 [floor, ceil] 안으로 → { ms, clamped: 'floor'|'ceil'|null } */
export function clampShift(target, { floor = -Infinity, ceil = Infinity } = {}) {
  if (target < floor) return { ms: floor, clamped: 'floor' };
  if (target > ceil) return { ms: ceil, clamped: 'ceil' };
  return { ms: target, clamped: null };
}

// ── 시간 빠르기 (p41-fast-time, docs/notes/p41-fast-time.md) ──
// 값은 assets/data/rules.json time (요소 편집기 「규칙 숫자」 → 시간 빠르기): speed = 처음 빠르기 키, speeds = 키 → 배수, whenClosed = 'pause'|'catchUp'.
export const SPEED_KEYS = ['real', 'fast', 'faster', 'fastest'];   // P47 ⚡ 번개처럼 ×60 (게임 하루 = 실제 24분)
export const SPEED_NAME = { real: '실제와 같게', fast: '빠르게', faster: '아주 빠르게', fastest: '번개처럼' };
export const DEFAULT_TIME_RULES = Object.freeze({ speed: 'fast', speeds: Object.freeze({ real: 1, fast: 12, faster: 30, fastest: 60 }), whenClosed: 'pause' });
export const GAP_MS = 1500;            // 프레임 사이가 이보다 길면(탭 숨김·창 닫힘·멈춤) 그동안은 안 흐른 것으로 ('pause')
/** rules.time → 빠진 칸은 기본값 */
export function timeRules(r = {}) {
  const speeds = { ...DEFAULT_TIME_RULES.speeds, ...(r?.speeds ?? {}), real: 1 };
  for (const k of SPEED_KEYS) if (!(Number.isFinite(speeds[k]) && speeds[k] >= 1)) speeds[k] = DEFAULT_TIME_RULES.speeds[k];
  return {
    speed: SPEED_KEYS.includes(r?.speed) ? r.speed : DEFAULT_TIME_RULES.speed,
    speeds,
    whenClosed: r?.whenClosed === 'catchUp' ? 'catchUp' : 'pause',
  };
}
/** 배수 → '게임 하루 = 실제 2시간' 같은 글 */
export function dayLengthText(mult) {
  if (!(mult > 1)) return '실제 시계와 같아요';
  const m = Math.round(1440 / mult);
  return `게임 하루 = 실제 ${m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`}`;
}

/**
 * 시계 몸통 (sky/index.js 가 쓴다 · 테스트는 realNow 를 바꿔 끼운다).
 * getTime() → state.time ({ speed, offset, game, realAt, maxDay }), baseShift = 날짜 흉내로 옮긴 정도,
 * extraDay() → 함께 볼 '가 본 날' (진짜 섬은 data 의 island.dayKey, 날짜 흉내는 null), rules = timeRules().
 * - 「실제와 같게」(배수 1): 시각 = 실제 시계 + baseShift + offset — 닫아 둔 동안에도 실제 시계대로 흐른다.
 * - 「빠르게」(배수 > 1): 시각 = state.time.game, advance() 가 실제로 흐른 만큼 × 배수를 더한다.
 *   프레임 사이가 GAP_MS 보다 길면(숨김·닫힘) 'pause' 는 그동안 멈춘 것으로, 'catchUp' 은 흐른 만큼 더한다.
 */
export function createTimeline({ getTime, baseShift = 0, extraDay = () => null, realNow = () => Date.now(), rules = timeRules({ speed: 'real' }) }) {
  let pausedMs = null, lastReal = null;
  const R = rules;
  const t = () => {
    const s = getTime();
    // 예전 저장: mode 'fast' (실제 1분 = 1시간) → 그 시각에서 「아주 빠르게」로 이어서
    if (s.mode === 'fast' && !SPEED_KEYS.includes(s.speed)) { s.game = realNow() * FAST_SCALE + (Number(s.fastOffset) || 0); s.speed = 'faster'; }
    delete s.mode; delete s.fastOffset;
    if (s.speed != null && !SPEED_KEYS.includes(s.speed)) s.speed = null;
    if (!Number.isFinite(s.offset)) s.offset = 0;
    if (s.game != null && !Number.isFinite(s.game)) s.game = null;
    if (s.maxDay != null && !/^\d{4}-\d{2}-\d{2}$/.test(s.maxDay)) s.maxDay = null;
    return s;
  };
  const key = () => t().speed ?? R.speed;
  const mult = () => R.speeds[key()] ?? 1;
  const scaled = () => mult() > 1;
  const realMs = () => realNow() + baseShift;
  const ensureGame = s => { if (!Number.isFinite(s.game)) s.game = realMs() + s.offset; return s.game; };
  const clockMs = () => {
    if (pausedMs != null) return pausedMs;
    const s = t();
    return scaled() ? ensureGame(s) : realMs() + s.offset;
  };
  const maxDay = () => laterDay(t().maxDay, extraDay());
  const floorMs = () => floorMsOf(maxDay());
  /** 같은 흐름을 유지한 채 시계를 target(ms) 으로 */
  function shiftTo(target) {
    if (pausedMs != null) { pausedMs = target; return; }
    const s = t();
    if (scaled()) s.game = target;
    else s.offset += target - clockMs();
  }
  /** 날짜가 가 본 날보다 앞이면 하루씩 더해 맞춘다 → 더한 날 수 */
  function catchUp() {
    const md = maxDay();
    if (!md || pausedMs != null) return 0;
    const s = t();
    if (scaled()) { const r = catchUpOffset(0, ensureGame(s), md); s.game = r.offset; return r.days; }
    const r = catchUpOffset(realMs(), s.offset, md);
    s.offset = r.offset;
    return r.days;
  }
  /** 지금 날이 가 본 날보다 늦으면 적어 둔다 */
  function mark(dayKey) { const s = t(); if (!s.maxDay || dayKey > s.maxDay) s.maxDay = dayKey; }
  /** 매 프레임: 빠르게일 때 실제로 흐른 만큼 × 배수 → 이번에 더한 게임 ms */
  function advance() {
    const now = realNow(), s = t();
    let d = lastReal == null ? 0 : now - lastReal;
    lastReal = now;
    if (d < 0 || (d > GAP_MS && R.whenClosed === 'pause')) d = 0;
    s.realAt = now;
    if (pausedMs != null || !scaled()) return 0;
    ensureGame(s);
    s.game += d * mult();
    return d * mult();
  }
  /** 게임을 열 때 (fresh = 날짜 흉내라 저장 시각을 안 씀) */
  function start({ fresh = false } = {}) {
    const s = t(), now = realNow();
    if (fresh) { s.game = realMs(); s.offset = 0; }
    else if (scaled()) ensureGame(s);
    if (!fresh && scaled() && R.whenClosed === 'catchUp' && Number.isFinite(s.realAt) && now > s.realAt) s.game += (now - s.realAt) * mult();
    lastReal = now;
    s.realAt = now;
  }
  return {
    state: t, clockMs, maxDay, floorMs, shiftTo, catchUp, mark, advance, start,
    get speed() { return key(); }, get mult() { return mult(); },
    /** 실제 시계(날짜 흉내 포함)에서 떨어진 정도 */
    offset: () => clockMs() - realMs(),
    range: () => ({ floor: floorMs(), ceil: clockMs() + SHIFT_MAX_DAYS * DAY_MS }),
    /** 갈 시각을 범위 안으로 → { ms, clamped } */
    clamp: target => clampShift(target, { floor: floorMs(), ceil: clockMs() + SHIFT_MAX_DAYS * DAY_MS }),
    /** 빠르기 바꾸기 — 지금 시각에서 끊김 없이 이어서 (그 순간 시계는 그대로) → 바뀌었으면 true */
    setSpeed(k) {
      if (!SPEED_KEYS.includes(k)) return false;
      const s = t();
      if (s.speed === k) return false;
      const cur = clockMs();
      s.speed = k;
      if (pausedMs != null) return true;
      if (scaled()) s.game = cur;
      else s.offset = cur - realMs();
      return true;
    },
    /** 예전 이름 (debug 패널·옛 코드): 'real' = 실제와 같게, 'fast' = 빠르게 */
    setMode(mode) { this.setSpeed(mode === 'real' ? 'real' : 'fast'); },
    /** 「지금 시각으로 돌아가기」 갈 곳: 실제 시각 (가 본 날보다 앞이면 그 날 같은 시각) → { target(ms), caught, offset } — 시계는 옮기지 않는다 */
    resetTarget() {
      const md = maxDay();
      const r = md ? catchUpOffset(realMs(), 0, md) : { offset: 0, days: 0 };
      return { target: realMs() + r.offset, caught: r.days, offset: r.offset };
    },
    get paused() { return pausedMs != null; },
    setPaused(on) {
      if (on && pausedMs == null) pausedMs = clockMs();
      else if (!on && pausedMs != null) { const v = pausedMs; pausedMs = null; lastReal = realNow(); shiftTo(v); }
    },
  };
}
