// 8차 계절 행사 날짜 계산 (보드 wave8 D75 · D83). DOM·three 없이 순수 함수 — node 테스트(tests/events.test.mjs)가 그대로 돌린다.
// 날짜는 게임 하루(새벽 5시에 바뀜)의 dayKey 'YYYY-MM-DD', 시각은 '게임 하루 시각' 5~29 (sky/clock.js dayHour).

const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const DAY = 86400e3;
/** 두 dayKey 사이 날 수 (b - a). 서머타임이 있어도 하루로 센다 */
export const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / DAY);
const addDays = (key, n) => { const d = dateOf(key); d.setDate(d.getDate() + n); return keyOf(d); };
/** 0~24 시 → 5~29 */
export const dayHour = h => (h < 5 ? h + 24 : h);

/** 행사 ev 의 그 해 기간 → { year, from, to } (to 까지 포함, days 일). 2월 29일 시작은 평년이면 2월 28일 */
export function windowOf(ev, year, days = 7) {
  let { month, day } = ev.start;
  if (month === 2 && day === 29 && new Date(year, 1, 29).getMonth() !== 1) day = 28;
  const from = `${year}-${pad(month)}-${pad(day)}`;
  return { year, from, to: addDays(from, days - 1) };
}

/** dayKey 날에 열리는 기간 (해를 넘기는 기간까지 보려고 전해도 본다) → { year, from, to, day(1부터), left(오늘 포함 남은 날) } | null */
export function windowOn(ev, dayKey, days = 7) {
  const y = Number(dayKey.slice(0, 4));
  for (const year of [y, y - 1]) {
    const w = windowOf(ev, year, days);
    if (dayKey >= w.from && dayKey <= w.to) return { ...w, day: daysBetween(w.from, dayKey) + 1, left: daysBetween(dayKey, w.to) + 1 };
  }
  return null;
}

/** 오늘 열리는 행사들 → [{ ev, ...windowOn }] */
export function activeOn(cfg, dayKey) {
  const days = cfg.dates?.days ?? 7;
  return (cfg.list ?? []).map(ev => { const w = windowOn(ev, dayKey, days); return w ? { ev, ...w } : null; }).filter(Boolean);
}

/** 오늘부터 다음에 시작하는 행사 차례 (지금 열린 것 빼고) → [{ ev, from, to, year, until(남은 날) }] */
export function upcoming(cfg, dayKey) {
  const days = cfg.dates?.days ?? 7, y = Number(dayKey.slice(0, 4));
  const out = [];
  for (const ev of cfg.list ?? []) {
    if (windowOn(ev, dayKey, days)) continue;
    let w = windowOf(ev, y, days);
    if (w.from <= dayKey) w = windowOf(ev, y + 1, days);
    out.push({ ev, ...w, until: daysBetween(dayKey, w.from) });
  }
  return out.sort((a, b) => a.until - b.until);
}

/** 한 해 달력 (섬폰 UI-13): 행사마다 그 해 기간 */
export function yearCalendar(cfg, year) {
  const days = cfg.dates?.days ?? 7;
  return (cfg.list ?? []).map(ev => ({ ev, ...windowOf(ev, year, days) }));
}

/**
 * 지금 행사 시간인가. hourF = 0~24 시각.
 * festivalToday: 오늘이 섬 축제 날 (D75-A — 그날 저녁은 섬 축제가 먼저: 17시 뒤 행사는 쉰다, 낮 행사는 17시까지만)
 */
export function hoursOn(ev, { festivalToday = false } = {}) {
  let [from, to] = ev.hours ?? [5, 29];
  if (festivalToday) to = Math.min(to, 17);
  return to > from ? [from, to] : null;
}
export function inHours(ev, hourF, opts) {
  const h = hoursOn(ev, opts);
  const hh = dayHour(hourF);
  return !!h && hh >= h[0] && hh < h[1];
}

/** 행사를 할 수 있는가 (D83-A: 첫 섬 축제(엔딩) 뒤부터) — festival = state.festival */
export function isOpen(cfg, festival) {
  const after = cfg.open?.after ?? 'ending';
  if (after === 'always') return true;
  return !!festival?.endedDay;
}

/** 행사 진행 칸 열쇠 (해마다 따로) */
export const runKey = (id, year) => `${id}:${year}`;
