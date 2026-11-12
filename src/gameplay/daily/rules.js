// M13 「매일 할 거리」 규칙 (순수 — DOM·three 없음, tests/daily.test.mjs 가 Node 에서 돌린다). 설정 assets/daily/daily.json.
// 날짜는 게임 날 'YYYY-MM-DD' (하루 = 새벽 5시 ~ 다음 새벽 5시 직전, 시각 hourF 는 5~29). 섬 씨앗을 섞어 같은 섬·같은 날이면 늘 같다.

/** 글자 → 32비트 씨앗 */
export function hashOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** 씨앗 글자 → 0~1 난수 함수 (늘 같은 차례) */
export function rngOf(...parts) {
  let x = hashOf(parts.join('|')) || 1;
  return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296;
}

const DAY = 86400000;
const ms = k => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
export const dayNo = k => Math.round(ms(k) / DAY);
export const daysBetween = (a, b) => dayNo(b) - dayNo(a);
export const addDays = (k, n) => new Date(ms(k) + n * DAY).toISOString().slice(0, 10);
/** 0 = 일요일 … 6 = 토요일 */
export const weekdayOf = k => new Date(ms(k)).getUTCDay();
/** 게임 시각(5~29) → 0~24 */
export const hour24 = h => ((h % 24) + 24) % 24;
/** [from, to) 시각 구간 안인가 (게임 하루 시각 5~29 기준, to 가 from 보다 작으면 자정 넘김) */
export function inHours(hourF, [from, to]) {
  const h = hourF < 5 ? hourF + 24 : hourF;
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

// ───────────────────────── 유성우 (D144-A: 맑은 밤 주 1–2번 20–4시)

/**
 * 그 주(월요일 시작)의 유성우 날 목록 — 주마다 1~2 번 (twoChance), 서로 이틀 넘게 떨어진 요일.
 * 날씨는 보지 않는다 (meteorTonight 가 그날 예보로 거른다)
 */
export function meteorDaysOfWeek(dayKey, seed, cfg) {
  const wd = (weekdayOf(dayKey) + 6) % 7;          // 0 = 월요일
  const monday = addDays(dayKey, -wd);
  const r = rngOf('meteor', monday, seed);
  const n = r() < (cfg.twoChance ?? 0.4) ? 2 : 1;
  const pool = [0, 1, 2, 3, 4, 5, 6];
  const out = [];
  for (let guard = 0; out.length < n && guard < 40; guard++) {
    const d = pool[Math.floor(r() * pool.length)];
    if (out.every(o => Math.abs(o - d) > 1)) out.push(d);
  }
  return out.sort((a, b) => a - b).map(d => addDays(monday, d));
}

/** 밤 시간(20–28시)의 예보가 맑은가 — forecast = [{from, weather}] (sky time.forecast) */
export function clearNight(forecast, hours, okWeather = ['clear', 'rainbow']) {
  if (!Array.isArray(forecast) || !forecast.length) return true;
  const [from, to] = hours;
  const at = h => { let w = forecast[0].weather; for (const s of forecast) if (s.from <= h) w = s.weather; return w; };
  for (let h = from; h < to; h += 0.5) if (!okWeather.includes(at(h))) return false;
  return true;
}

/** 오늘 밤이 유성우인가 (그 주의 날 + 맑은 밤) */
export function meteorTonight(dayKey, seed, cfg, forecast) {
  return meteorDaysOfWeek(dayKey, seed, cfg).includes(dayKey) && clearNight(forecast, cfg.hours ?? [20, 28], cfg.weather);
}

/** 별똥별이 지금 보이나: 유성우 날 · 시각 · 밖 */
export const meteorNow = (tonight, hourF, cfg, indoor = false) => !!tonight && !indoor && inHours(hourF, cfg.hours ?? [20, 28]);

/** 소원 몇 번이 별 조각 몇 개 (빈 소원 수 → 다음 날 바닷가에 떨어질 개수) */
export const starsForWishes = (wishes, cfg) => Math.min(cfg.maxStars ?? 3, Math.max(0, wishes) * (cfg.starsPerWish ?? 1));

/** 별 조각 색 고르기 — 같은 날 같은 섬이면 늘 같다 */
export function starColors(n, dayKey, seed, ids) {
  const r = rngOf('stars', dayKey, seed);
  return Array.from({ length: n }, () => ids[Math.floor(r() * ids.length)]);
}

// ───────────────────────── 선물 풍선 (D142-A: 하루 몇 번 바다 쪽에서)

/** 그날 풍선 계획: [{ i, at (게임 시각), color, side (-1 서쪽에서 · 1 동쪽에서), lane (남북 어긋남 −1~1) }] */
export function balloonPlan(dayKey, seed, cfg) {
  const r = rngOf('balloons', dayKey, seed);
  const [from, to] = cfg.hours ?? [9, 18];
  const n = cfg.perDay ?? 3;
  const colors = cfg.colors ?? ['#F26B6B'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const slot = (to - from) / n;
    out.push({ i, at: +(from + slot * i + r() * slot * 0.8).toFixed(2), color: colors[Math.floor(r() * colors.length)], side: r() < 0.5 ? -1 : 1, lane: +(r() * 2 - 1).toFixed(2) });
  }
  return out;
}

/** 가중치 표에서 하나 — table = [{ item, n, w }] */
export function weighted(table, r) {
  const total = table.reduce((s, x) => s + (x.w ?? 1), 0);
  let t = r() * total;
  for (const x of table) { t -= x.w ?? 1; if (t < 0) return x; }
  return table[table.length - 1] ?? null;
}

/** 풍선 선물: 표에서 하나 (레시피 쪽지는 열 레시피가 남았을 때만) */
export function balloonGift(cfg, r, { canNote = true } = {}) {
  const table = (cfg.gifts ?? []).filter(g => canNote || !g.note);
  return weighted(table, r);
}

/** 풍선 위치: 출발 뒤 t 초 → { x, z, y(땅 위 높이), done } — b = { x0, z0, dir (+1 동쪽으로), lane, span (갈 거리) }.
 *  바다 쪽에서 반대편 바다로 곧게, 남북으로 살짝 굽이 · 위아래로 둥실 */
export function balloonPos(b, t, cfg) {
  const speed = cfg.speed ?? 1.2;
  const x = b.x0 + (b.dir ?? 1) * speed * t;
  const z = b.z0 + Math.sin(t * 0.21 + b.lane * 3) * 1.6;
  const y = (cfg.height ?? 5) + Math.sin(t * 0.9 + b.lane * 5) * 0.35;
  return { x, z, y, done: speed * t > (b.span ?? 80) };
}

/** 새총이 풍선에 닿나: 플레이어 (px, pz) 에서 바라보는 쪽 (fx, fz) — 수평 거리 reach 안 · 앞쪽 반원 (바로 위는 늘 됨) */
export function slingHits(px, pz, fx, fz, bx, bz, reach = 3.2) {
  const dx = bx - px, dz = bz - pz, d = Math.hypot(dx, dz);
  if (d > reach) return false;
  if (d < 1.2) return true;
  return (dx * fx + dz * fz) / d > 0.2;
}

// ───────────────────────── 유리병 · 레시피 (D143-A · D146-A)

/** 바닷가 칸 고르기: cells = [{tx, tz}] 모래 칸 → 그날 n 개 (서로 minGap 칸 넘게) */
export function pickSandCells(cells, n, dayKey, seed, tag = 'bottle', minGap = 4) {
  if (!cells.length) return [];
  const r = rngOf(tag, dayKey, seed);
  const out = [];
  for (let guard = 0; out.length < n && guard < 200; guard++) {
    const c = cells[Math.floor(r() * cells.length)];
    if (out.every(o => Math.hypot(o.tx - c.tx, o.tz - c.tz) > minGap)) out.push(c);
  }
  return out;
}

/** 다음에 열 레시피 = 잠긴 것 중 표 순서 첫째 (없으면 null) */
export const nextRecipe = locked => (Array.isArray(locked) && locked.length ? locked[0] : null);

// ───────────────────────── 방문 행상 (D145-A: 수·일 낮 광장)

/** 오늘이 행상 오는 날인가 (요일) */
export const peddlerDay = (dayKey, cfg) => (cfg.weekdays ?? [3, 0]).includes(weekdayOf(dayKey));
/** 지금 수레가 광장에 있나 */
export const peddlerHere = (dayKey, hourF, cfg) => peddlerDay(dayKey, cfg) && inHours(hourF, cfg.hours ?? [9, 17]);

/**
 * 오늘의 진열: pools = { flowers: [id], saplings: [id] } → [id] (꽃 cfg.flowers 개 · 묘목 cfg.saplings 개, 같은 날 같은 섬이면 같다)
 */
export function peddlerStock(dayKey, seed, cfg, pools) {
  const r = rngOf('peddler', dayKey, seed);
  const take = (list, n) => {
    const a = [...(list ?? [])];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, Math.max(0, n));
  };
  return [...take(pools.flowers, cfg.flowers ?? 2), ...take(pools.saplings, cfg.saplings ?? 1)];
}

/** 행상 값: 아이템의 살 값(buy) 이 있으면 그것, 없으면 파는 값 × markup */
export const peddlerPrice = (it, cfg) => (it?.buy > 0 ? it.buy : Math.round((it?.price ?? 0) * (cfg.markup ?? 4) / 10) * 10);

// ───────────────────────── M18-P4 계절 레시피 · 행상 계절 진열 (15차 보드 D196-A)

/** 오늘 유리병에 계절 레시피가 들어 있나 (같은 날 같은 섬이면 늘 같다) — 그 계절 레시피가 남았는지는 부르는 쪽이 본다 */
export const seasonBottle = (dayKey, seed, cfg) => !!cfg && rngOf('season-bottle', dayKey, seed)() < (cfg.bottleChance ?? 0.3);

/** 행상 계절 진열: cfg.seasonal[season] = { seeds: [id], wallpaper: { slug, price } } → { seeds: [id], wallpaper } (없으면 빈 것) */
export function peddlerSeasonal(season, cfg) {
  const s = cfg?.seasonal?.[season];
  return { seeds: [...(s?.seeds ?? [])], wallpaper: s?.wallpaper ?? null, n: cfg?.seasonal?.seedPack ?? 5 };
}

/** 받침에 맞는 조사 붙이기: withJosa('퐁', '이', '가') → '퐁이' · ('코코', …) → '코코가' */
export function withJosa(word, a, b) {
  const ch = String(word ?? '').slice(-1).charCodeAt(0);
  const has = ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 > 0;
  return `${word}${has ? a : b}`;
}
