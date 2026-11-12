// M18-P3 계절 낚시·곤충 대회 규칙 (15차 보드 wave15 D194-A). DOM·three 없이 순수 함수 — tests/contest.test.mjs 가 Node 에서 돌린다.
// 설정 assets/contest/contest.json. 날짜는 게임 하루(새벽 5시에 바뀜)의 dayKey 'YYYY-MM-DD', 시각은 0~24 (hourF).
//
// 점수 = 가장 큰 것(cm) + 마릿수 × score.perCatch. 순위는 점수가 높은 쪽, 같으면 그 점수에 먼저 닿은 쪽 (주민 기록은 제한 시간 안의 시각 t 가 있다).
// 주민 참가자 셋은 날짜 씨앗으로 뽑고 (사회 주민 빼고), 잡는 시각·크기도 날짜로 정해서 같은 날엔 늘 같다 → 대회 창이 시간에 따라 순위를 바꿔 보여 준다.

const pad = n => String(n).padStart(2, '0');

/** 글자 → 32비트 씨앗 (journal/rules.js hashOf 와 같은 FNV) */
export function hashOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** 씨앗 → 0..1 난수 함수 (mulberry32) */
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 그 해 대회 날짜 dayKey */
export const dateOf = (c, year) => `${year}-${pad(c.date.month)}-${pad(c.date.day)}`;

/** 대회를 할 수 있나 (D194-A: 첫 섬 축제(엔딩) 뒤부터, 계절 행사와 같은 규칙) — festival = state.festival */
export function isOpen(cfg, festival) {
  if ((cfg.open?.after ?? 'ending') === 'always') return true;
  return !!festival?.endedDay;
}

/** dayKey 날의 대회 → 대회 칸 | null. festivalToday = 섬 축제 날이면 대회는 쉰다 (그날은 축제가 먼저) */
export function contestOn(cfg, dayKey, { festivalToday = false } = {}) {
  if (!dayKey || festivalToday) return null;
  const y = Number(dayKey.slice(0, 4));
  return (cfg.list ?? []).find(c => dateOf(c, y) === dayKey) ?? null;
}

/** 대회 시간인가 (hourF 0~24) */
export function inHours(cfg, hourF) {
  const [a, b] = cfg.hours ?? [9, 18];
  return hourF >= a && hourF < b;
}

/** 오늘부터 다음 대회 차례 (오늘 것 포함) → [{ c, day, until }] */
export function upcoming(cfg, dayKey) {
  const y = Number(dayKey.slice(0, 4)), out = [];
  for (const c of cfg.list ?? []) {
    let d = dateOf(c, y);
    if (d < dayKey) d = dateOf(c, y + 1);
    out.push({ c, day: d, until: Math.round((new Date(d) - new Date(dayKey)) / 86400e3) });
  }
  return out.sort((a, b) => a.until - b.until);
}

/** 그 해 대회 날짜들 (달력 · 겹침 검사) */
export const yearDays = (cfg, year) => (cfg.list ?? []).map(c => ({ c, day: dateOf(c, year) }));

/**
 * 잡은 것 크기 (cm, 소수 한 자리). it = 아이템 칸 (물고기 shadow · 곤충 price), kind = 'fish'|'bug', r = 0..1 난수.
 * 물고기 = 그림자 크기별 기준, 곤충 = 값 구간별 기준 · 둘 다 기준 × (1 ± spread)
 */
export function sizeOf(cfg, kind, it, r = 0.5) {
  const S = cfg.size ?? {}, spread = S.spread ?? 0.25;
  let base;
  if (kind === 'fish') base = S.fish?.byShadow?.[String(it?.shadow ?? 2)] ?? 14;
  else base = [...(S.bug?.byPrice ?? [[0, 4]])].reverse().find(([min]) => (it?.price ?? 0) >= min)?.[1] ?? 4;
  return Math.round(base * (1 - spread + 2 * spread * r) * 10) / 10;
}

/** 기록 → { best, count, score } (catches = [{ size, t }]) */
export function scoreOf(cfg, catches) {
  const best = catches.reduce((m, x) => Math.max(m, x.size), 0), count = catches.length;
  return { best, count, score: Math.round((best + count * (cfg.score?.perCatch ?? 10)) * 10) / 10 };
}

/** 점수에 처음 닿은 시각 (같은 점수일 때 앞선 쪽) — 기록이 시각 순이라고 본다 */
function reachedAt(cfg, catches) {
  if (!catches.length) return Infinity;
  const fin = scoreOf(cfg, catches).score;
  for (let i = 1; i <= catches.length; i++) if (scoreOf(cfg, catches.slice(0, i)).score >= fin) return catches[i - 1].t ?? 0;
  return catches[catches.length - 1].t ?? 0;
}

/**
 * 주민 참가자 (사회 주민·빠진 주민 빼고 날짜로 셋) → [{ slug, catches: [{ t(초), size }] }].
 * residents = 섬에 지금 사는 주민 slug (순서는 상관없음 — 이름순으로 정렬해 뽑는다)
 */
export function rivalsOf(cfg, c, dayKey, residents, seed = 0) {
  const R = cfg.rivals ?? {}, kind = c.kind, sec = cfg.seconds ?? 180;
  const pool = [...new Set(residents)].filter(s => s && s !== cfg.host).sort();
  const rnd = rng(hashOf(`${dayKey}|${c.id}|${seed}`));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const [lo, hi] = (Array.isArray(R.catches) ? R.catches : R.catches?.[kind]) ?? [2, 5];
  const [b0, b1] = R.best?.[kind] ?? [10, 40];
  return pool.slice(0, R.count ?? 3).map(slug => {
    const n = lo + Math.floor(rnd() * (hi - lo + 1));
    const best = Math.round((b0 + (b1 - b0) * rnd()) * 10) / 10;
    const bestAt = Math.floor(rnd() * n);
    const times = Array.from({ length: n }, () => Math.round((8 + rnd() * (sec - 16)) * 10) / 10).sort((a, b) => a - b);
    const catches = times.map((t, i) => ({ t, size: i === bestAt ? best : Math.round(best * (0.35 + 0.55 * rnd()) * 10) / 10 }));
    return { slug, catches };
  });
}

/** t 초까지 잡은 것만 */
export const upTo = (catches, t) => catches.filter(x => (x.t ?? 0) <= t);

/**
 * 순위표 → [{ who, name?, best, count, score, rank }] (점수 높은 순, 같은 점수는 먼저 닿은 쪽, 그래도 같으면 플레이어 먼저).
 * entries = [{ who: 'player'|slug, catches }], t = 지금까지 흐른 초 (없으면 끝까지)
 */
export function standings(cfg, entries, t = Infinity) {
  const rows = entries.map(e => {
    const cs = upTo(e.catches, t);
    return { ...e, catches: cs, ...scoreOf(cfg, cs), at: reachedAt(cfg, cs) };
  });
  rows.sort((a, b) => b.score - a.score || a.at - b.at || (a.who === 'player' ? -1 : b.who === 'player' ? 1 : 0));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** 순위 → 상 { rank, item, acorns } (상이 없는 순위는 마지막 줄 = 참가상). 하나도 못 잡았으면 참가상만 */
export function prizeOf(cfg, rank, count = 1) {
  const list = cfg.prizes ?? [];
  if (!count) return { ...(list[list.length - 1] ?? { acorns: 0 }), item: null, rank };
  return { ...(list.find(p => p.rank === rank) ?? list[list.length - 1] ?? { acorns: 0, item: null }), rank };
}

/** 대사 칸 채우기: {name} {emoji} {time} {what} {tool} */
export function fill(line, vars) {
  return String(line ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

/** 남은 초 → 'm:ss' */
export const clock = s => { const v = Math.max(0, Math.ceil(s)); return `${Math.floor(v / 60)}:${pad(v % 60)}`; };

// 무대 BD-17 모델 기준 자리 (assets/blender/contest_env.py — 원점 = 무대 가운데, 게임 +z = 앞(남쪽))
export const DESK = { x: -1.1, z: 1.3 };          // 접수 탁자
export const DESK_FRONT = { x: -1.1, z: 1.95 };   // 탁자 앞 (손님 자리)
/** 자리 고르기 단계: 앞 줄까지 비고 문에서 넉넉히 → 손님 줄만 줄임 → 축제 광장 안(모닥불·부스 사이)도 */
export const STAGE_TIERS = [
  { rows: 3, door: 4, fest: 3 },
  { rows: 2, door: 3.2, fest: 3 },
  { rows: 2, door: 3.2, fest: -2.5 },
];

/**
 * 대회 무대 자리 (순수 — tests/contest.test.mjs 가 섬 생성기로 돌린다).
 * places = world.places (plaza · festival · 문 있는 건물), q = { isFree(tx, tz), levelAt, toTile, toWorld }, avoid = [{x, z, r}] (행상 수레 등).
 * 가운데 칸 (tx, tz) 둘레 x −1..1 · z −1..rows 칸이 비고 평평한 곳 중 광장(plaza + offset)에서 가까운 것 → { tx, tz, x, z, desk, front, tier } | null
 */
export function stageSpot(places, q, { offset = [0, 0], avoid = [], radius = 24 } = {}) {
  const P = places;
  if (!P?.plaza) return null;
  const doors = [P.shop, P.museum, P.playerHouse, ...(P.villagerHouses ?? []), ...(P.spareLots ?? [])].map(b => b?.door).filter(Boolean);
  const F = P.festival, FR = F?.radius ?? 6;
  const a = q.toTile(P.plaza.x + offset[0], P.plaza.z + offset[1]);
  for (const [tier, T] of STAGE_TIERS.entries()) {
    for (let r = 0; r <= radius; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const tx = a.tx + dx, tz = a.tz + dz;
      let ok = true;
      const lv = q.levelAt(tx, tz);
      for (let z = -1; z <= T.rows && ok; z++) for (let x = -1; x <= 1 && ok; x++) ok = q.isFree(tx + x, tz + z) && q.levelAt(tx + x, tz + z) === lv;
      if (!ok) continue;
      const c = q.toWorld(tx, tz), x = c.x, z = c.z;
      const front = { x: x + DESK_FRONT.x, z: z + DESK_FRONT.z };
      if (doors.some(d => Math.hypot(d.x - x, d.z - z) < T.door || Math.hypot(d.x - front.x, d.z - front.z) < T.door)) continue;
      if (F?.center && Math.hypot(F.center.x - x, F.center.z - z) < FR + T.fest) continue;
      if (F?.center && Math.hypot(F.center.x - x, F.center.z - z) < 3.5) continue;   // 모닥불 둘레는 늘 비움
      if (F?.stage && Math.hypot(F.stage.x - x, F.stage.z - z) < 3.5) continue;     // 축제 무대와 안 겹치게
      if (avoid.some(o => Math.hypot(o.x - x, o.z - z) < (o.r ?? 5))) continue;
      return { tx, tz, x, z, desk: { x: x + DESK.x, z: z + DESK.z }, front, tier };
    }
  }
  return null;
}
