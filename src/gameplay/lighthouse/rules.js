// M19-P4 등대 다시 켜기 — 규칙 (순수: DOM·three 없음. 게임 index.js · node 테스트 tests/lighthouse.test.mjs 가 같이 쓴다)
// 설정 assets/lighthouse/lighthouse.json · 노트 docs/notes/m19-p4-lighthouse.md (16차 보드 wave16 D203-A · D206-A)
//
// 상태 st = state.lighthouse = {
//   site: { tx, tz } | null        등대 자리 (처음 놓을 때 한 번 정해 저장 — 조개·잡초가 날마다 바뀌어도 자리가 안 움직이게)
//   siteV: 정수 | null              그 자리를 고른 설정 판 (cfg.site.v — 서쪽 등대 v2. 다르면 자리만 다시 고르고 단계는 그대로, siteFor)
//   keeperMet: dayKey | null       등대지기 윤슬을 처음 만난 날 (s66, 서쪽 등대)
//   started: dayKey | null         s54 를 본 날 (= 첫 단계가 열린 날)
//   stage: 0..5                    끝낸 단계 수
//   done: { <단계 id>: dayKey }    단계를 끝낸 날
//   helped: { <slug>: true }       지금 단계에 돕기로 한 주민
//   lit: dayKey | null             불 켠 날 (s60)
//   morning: dayKey | null         다음 날 아침 장면(s61)을 본 날
// }

const DAY = 86400000;
const dateOf = key => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
const keyOf = t => new Date(t).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / DAY);
export const addDays = (key, n) => keyOf(dateOf(key) + n * DAY);
/** '2027-04-02' → '4/2' */
export const md = key => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;

export function fresh() {
  return { site: null, siteV: null, started: null, stage: 0, done: {}, helped: {}, lit: null, morning: null, keeperMet: null };
}
/** 저장에서 읽은 값을 모양에 맞춘다 (없거나 깨진 칸은 처음 값) */
export function normalize(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const f = fresh();
  const site = s.site && Number.isInteger(s.site.tx) && Number.isInteger(s.site.tz) ? { tx: s.site.tx, tz: s.site.tz } : f.site;
  return {
    site,
    // 예전 저장(M19-P4)엔 siteV 가 없다 → 북쪽 자리 = 판 1
    siteV: !site ? null : Number.isInteger(s.siteV) ? s.siteV : 1,
    started: typeof s.started === 'string' ? s.started : null,
    stage: Number.isInteger(s.stage) ? Math.max(0, Math.min(5, s.stage)) : 0,
    done: s.done && typeof s.done === 'object' ? { ...s.done } : {},
    helped: s.helped && typeof s.helped === 'object' ? { ...s.helped } : {},
    lit: typeof s.lit === 'string' ? s.lit : null,
    morning: typeof s.morning === 'string' ? s.morning : null,
    keeperMet: typeof s.keeperMet === 'string' ? s.keeperMet : null,
  };
}
/** 저장된 자리를 그대로 써도 되는지 → { tx, tz } | null (설정 판이 바뀌었으면 null — 다시 고른다. 단계·도움·날짜는 건드리지 않음) */
export function siteFor(cfg, st) {
  if (!st?.site) return null;
  return (st.siteV ?? 1) === (cfg.site?.v ?? 1) ? st.site : null;
}

/** 시각이 [from, to) 안인지 — to < from 이면 자정을 넘는다 (19 → 4) */
export function inRange([from, to], hourF) {
  return from <= to ? hourF >= from && hourF < to : hourF >= from || hourF < to;
}
export const isNight = (cfg, hourF) => inRange(cfg.nightHours ?? [19, 4], hourF);
export const beamOn = (cfg, hourF) => inRange(cfg.beamHours ?? [18.5, 5.5], hourF);
/** 빛 띠 세기 0..1 — 켜질 때·꺼질 때 반 시간 동안 천천히 */
export function beamLevel(cfg, hourF) {
  const [a, b] = cfg.beamHours ?? [18.5, 5.5];
  if (!inRange([a, b], hourF)) return 0;
  const h = hourF < a ? hourF + 24 : hourF, end = b + 24;
  return Math.max(0, Math.min(1, (h - a) / 0.5, (end - h) / 0.5));
}

/**
 * 시작해도 되는지: 엔딩(첫 섬 축제) 뒤 · 그다음 날부터 · 시작 주민(구름)이 섬에 살 때.
 * 구름이 fallbackDays 지나도 안 오면 fallbackHost(코코)가 대신 그림을 보여 준다 → 시작 주민 slug | null
 */
export function startHost(cfg, { endedDay, dayKey, residents = [] }) {
  const o = cfg.open ?? {};
  if ((o.after ?? 'ending') !== 'always') {
    if (!endedDay || !dayKey || daysBetween(endedDay, dayKey) < 1) return null;
  }
  if (!o.host || residents.includes(o.host)) return o.host ?? null;
  if (endedDay && dayKey && daysBetween(endedDay, dayKey) >= (o.fallbackDays ?? 14) && residents.includes(o.fallbackHost)) return o.fallbackHost;
  return null;
}

/** 다음 단계가 열리는 날 (첫 단계 = 시작한 날, 그 뒤 = 앞 단계를 끝낸 날 + gapDays) */
export function openDay(cfg, st) {
  if (!st.started) return null;
  if (st.stage <= 0) return st.started;
  const prev = cfg.stages[st.stage - 1];
  const d = st.done[prev?.id];
  return d ? addDays(d, cfg.gapDays ?? 7) : null;
}

/**
 * 지금 어디까지: 'closed' 시작 전 · 'wait' 다음 단계까지 기다림 · 'work' 단계 할 일 · 'night' 다섯 단계 끝 — 밤에 불 켜기 ·
 * 'lit' 불 켬 (다음 날 아침 장면 전) · 'done' 다 끝남
 */
export function phase(cfg, st, dayKey) {
  if (!st.started) return 'closed';
  if (st.lit) return st.morning ? 'done' : 'lit';
  if (st.stage >= cfg.stages.length) return 'night';
  const od = openDay(cfg, st);
  if (!od || !dayKey) return 'wait';
  return daysBetween(od, dayKey) >= 0 ? 'work' : 'wait';
}
/** 지금 단계 칸 (다섯 단계 안이면) */
export const stageNow = (cfg, st) => cfg.stages[Math.min(st.stage, cfg.stages.length - 1)] ?? null;
/** 다음 단계가 열리기까지 남은 날 (0 = 오늘 열림) */
export function daysLeft(cfg, st, dayKey) {
  const od = openDay(cfg, st);
  return od && dayKey ? Math.max(0, daysBetween(dayKey, od)) : null;
}

// ── 재료 ──
/** 필요한 것 하나에 맞는 아이템인지: { id } 같은 id · { category } 분류 · { prefix } id 앞부분 (별 조각 mat.star-*) */
export function matches(need, id, item) {
  if (!id) return false;
  if (need.id) return id === need.id;
  if (need.prefix) return id.startsWith(need.prefix);
  if (need.category) return item?.category === need.category;
  return false;
}
/** 가방(slots = [{id, count} | null])에서 필요한 것마다 가진 수 → [{ need, have, n, ok, label }] */
export function needsOf(stage, slots, getItem = () => null) {
  return (stage?.needs ?? []).map(need => {
    let have = 0;
    for (const s of slots ?? []) if (s && matches(need, s.id, getItem(s.id))) have += s.count ?? 1;
    const label = need.label ?? getItem(need.id)?.name ?? need.id ?? need.prefix ?? need.category;
    return { need, have: Math.min(have, need.n), n: need.n, ok: have >= need.n, label };
  });
}
export const needsMet = rows => rows.every(r => r.ok);
/** 그 단계에 내는 도토리 (서쪽 등대 D273-A — lighthouse.json stages[].acorns, 없으면 0) */
export const acornsOf = stage => Math.max(0, Math.floor(stage?.acorns ?? 0));
/** 도토리 줄 { label, have, n, ok } (have = 지갑, 넘쳐도 그대로 보여 줌) */
export function acornRow(stage, wallet = 0) {
  const n = acornsOf(stage), have = Math.max(0, Math.floor(wallet ?? 0));
  return { acorn: true, label: '도토리', have, n, ok: have >= n };
}
/** 모자란 것 [{ label, short }] — 재료 줄 + 도토리 줄에서 */
export const shortOf = rows => rows.filter(r => !r.ok).map(r => ({ label: r.label, short: r.n - r.have, acorn: !!r.acorn }));
/**
 * 가져갈 것 정하기: 필요한 것마다 가방 칸을 앞에서부터 → [{ id, n }] (같은 id 는 합침).
 * 분류·앞부분으로 받는 칸(조개·꽃·별 조각)은 값이 싼 것부터 가져간다 (getItem(id).price).
 */
export function takePlan(stage, slots, getItem = () => null) {
  const left = new Map();
  for (const s of slots ?? []) if (s) left.set(s.id, (left.get(s.id) ?? 0) + (s.count ?? 1));
  const out = new Map();
  for (const need of stage?.needs ?? []) {
    let want = need.n;
    const ids = [...left.keys()].filter(id => matches(need, id, getItem(id)) && left.get(id) > 0)
      .sort((a, b) => (getItem(a)?.price ?? 0) - (getItem(b)?.price ?? 0) || (a < b ? -1 : 1));
    for (const id of ids) {
      if (want <= 0) break;
      const k = Math.min(want, left.get(id));
      left.set(id, left.get(id) - k);
      out.set(id, (out.get(id) ?? 0) + k);
      want -= k;
    }
    if (want > 0) return null;   // 모자람
  }
  return [...out].map(([id, n]) => ({ id, n }));
}

// ── 돕는 주민 ──
/** 단계의 돕는 주민 둘: 후보 순서대로 섬에 사는 주민 (앞 둘이 없으면 다음 후보) */
export function helpersOf(stage, residents = []) {
  const out = [];
  for (const s of stage?.helpers ?? []) if (residents.includes(s) && !out.includes(s) && out.length < 2) out.push(s);
  return out;
}
export const helpedAll = (st, helpers) => helpers.length > 0 && helpers.every(s => st.helped?.[s]);

// ── 단계 끝내기 (상태만 바꾼다) ──
/** 지금 단계를 끝낸다 → 끝낸 단계 칸 (재료·도움·날 검사는 부르는 쪽이 canFinish 로) */
export function finishStage(cfg, st, dayKey) {
  const s = cfg.stages[st.stage];
  if (!s) return null;
  st.done[s.id] = dayKey;
  st.stage += 1;
  st.helped = {};
  return s;
}
export function canFinish(cfg, st, dayKey, { slots, getItem, residents, acorns = Infinity }) {
  if (phase(cfg, st, dayKey) !== 'work') return { ok: false, why: 'phase' };
  const s = stageNow(cfg, st);
  const rows = needsOf(s, slots, getItem);
  const acorn = acornRow(s, acorns);
  const helpers = helpersOf(s, residents);
  const short = shortOf([...rows, acorn]);
  if (!needsMet(rows)) return { ok: false, why: 'needs', rows, acorn, helpers, short };
  if (!acorn.ok) return { ok: false, why: 'acorns', rows, acorn, helpers, short };
  if (!helpedAll(st, helpers)) return { ok: false, why: 'helpers', rows, acorn, helpers, short };
  return { ok: true, rows, acorn, helpers, short };
}
export function light(st, dayKey) { if (!st.lit) st.lit = dayKey; return st.lit === dayKey; }

// ── 모양 (그 단계의 모델·소품) ──
/** 지금 등대 모델 열쇠: dark · repair · lit */
export const lookOf = st => (st.lit ? 'lit' : st.stage >= 1 ? 'repair' : 'dark');
/** 지금 놓일 소품 [{ env, at }] */
export function propsOf(cfg, st) {
  return (cfg.props ?? []).filter(p => st.stage >= (p.from ?? 1) && !(p.until === 'lit' && st.lit)).map(p => ({ env: p.env, at: p.at }));
}

// ── 자리 ──
/**
 * 등대 자리: layout 비율 자리(cfg.site.at — 서쪽 등대 v2 는 섬 서쪽 끝 곶 side "west", 예전 v1 은 북쪽 바위 끝)에서 가까운 칸부터.
 * q = { w, h, tileAt(tx,tz) → 'sand'…, levelAt, isFree(tx,tz), toWorld(tx,tz) → {x,z} }
 * 몸통 3×3 (가운데 tx,tz 둘레) + 소품 자리 (양옆 tx±2 의 z, z+1) + 앞 일하는 칸 (tz+2, tx-1..tx+1) 이 모두 땅·높이 0 같은 단·비어 있어야.
 * 같은 거리면 북쪽(작은 z)부터 → { tx, tz }
 */
export function siteSpot(cfg, q) {
  const S = cfg.site ?? {};
  const kinds = new Set(S.kinds ?? ['sand', 'grass']);
  const at = S.at ?? [0.45, 0.1];
  const west = S.side === 'west';   // 서쪽 등대 (v2): 섬 서쪽 절반 · 같은 거리면 서쪽(작은 x)부터 · 서쪽 귀퉁이가 바다여도 됨
  const ax = Math.round(at[0] * q.w), az = Math.round(at[1] * q.h);
  const cells = [];
  for (let dz = -1; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    if (dz === -1 && Math.abs(dx) === 2) continue;   // 북쪽 귀퉁이는 바다여도 된다 (바위 끝)
    if (west && dx === -2 && dz <= 0) continue;        // 서쪽 끝: 뒤 서쪽 귀퉁이도 바다여도 된다 (곶 끝)
    cells.push([dx, dz]);
  }
  // 시드가 다른 섬(layout.seed = null)은 북쪽 끝이 언덕·숲일 수 있다 → 반지름을 넓히고, 그래도 없으면 높은 단(언덕 위)도 본다.
  // 섬 북쪽 절반 안에서만 (z < h/2).
  const R = S.radius ?? 9;
  for (const [rad, levels] of [[R, [0]], [R * 2.5, [0]], [R * 2.5, [0, 1]]]) {
    const cand = [];
    for (let dz = -Math.ceil(rad); dz <= rad; dz++) for (let dx = -Math.ceil(rad); dx <= rad; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > rad || (west ? ax + dx >= q.w / 2 : az + dz >= q.h / 2)) continue;
      cand.push({ tx: ax + dx, tz: az + dz, d });
    }
    cand.sort(west ? (a, b) => a.d - b.d || a.tx - b.tx || a.tz - b.tz : (a, b) => a.d - b.d || a.tz - b.tz || a.tx - b.tx);
    for (const c of cand) {
      const lv = q.levelAt(c.tx, c.tz);
      if (!levels.includes(lv)) continue;
      const ok = cells.every(([dx, dz]) => {
        const x = c.tx + dx, z = c.tz + dz;
        return kinds.has(q.tileAt(x, z)) && q.levelAt(x, z) === lv && q.isFree(x, z);
      });
      if (ok) return { tx: c.tx, tz: c.tz };
    }
  }
  return null;
}
/**
 * 등대지기 자리 (서쪽 등대 D272-A): 등대 가운데에서 keeper.at, 안 되면 keeper.alt 차례로 — 땅(바다·강 아님)·등대와 같은 단·비어 있는 칸.
 * q = { tileAt, levelAt, toTile, isFree } · c = 등대 가운데 월드 {x, z} → { x, z } (다 안 되면 앞 일하는 자리 옆)
 */
export function keeperSpot(K, site, c, q) {
  const lv = q.levelAt(site.tx, site.tz);
  for (const [dx, dz] of [K?.at ?? [-2.1, 2.2], ...(K?.alt ?? [])]) {
    const x = c.x + dx, z = c.z + dz, t = q.toTile(x, z);
    if (['sand', 'grass', 'path'].includes(q.tileAt(t.tx, t.tz)) && q.levelAt(t.tx, t.tz) === lv && q.isFree(t.tx, t.tz)) return { x, z };
  }
  return { x: c.x + 1.2, z: c.z + 2.4 };
}
/** 자리 칸 → 월드 자리들: 등대 가운데 · 앞 일하는 자리(Space) · 장면 기준 자리 */
export function siteWorld(site, toWorld) {
  const c = toWorld(site.tx, site.tz);
  return { x: c.x, z: c.z, front: { x: c.x, z: c.z + 1.85 }, door: { x: c.x, z: c.z + 2.1 } };
}
/**
 * 「길 내기」 돌길 칸: 앞 일하는 줄(tz+2, tx-1..tx+1)을 깔고, 가운데에서 남쪽으로 이어지는 만큼 (막히면 거기서 멈춤) — 모두 n 칸까지.
 * 걸을 수 있는 같은 단 땅(모래·풀·흙길)이고 비어 있는 칸만. q = { tileAt, levelAt, isFree }
 */
export function pathTiles(site, q, n = 6) {
  const lv = q.levelAt(site.tx, site.tz);
  const ok = (tx, tz) => ['sand', 'grass', 'path'].includes(q.tileAt(tx, tz)) && q.levelAt(tx, tz) === lv;
  const out = [];
  for (const dx of [0, -1, 1]) if (out.length < n && ok(site.tx + dx, site.tz + 2) && q.isFree(site.tx + dx, site.tz + 2)) out.push({ tx: site.tx + dx, tz: site.tz + 2 });
  for (let k = 3; out.length < n && k < 3 + n; k++) {
    const tx = site.tx, tz = site.tz + k;
    if (!ok(tx, tz)) break;
    if (q.isFree(tx, tz)) out.push({ tx, tz });
  }
  return out;
}

/** 글 칸 채우기 '{name}' */
export const fill = (s, v = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m));
/** 받침 있는 말 뒤 조사 (이/가) */
export function josa(word, pair = '가') {
  const c = String(word ?? '').charCodeAt(String(word ?? '').length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0;
  const P = { 가: ['이', '가'], 는: ['은', '는'], 를: ['을', '를'], 와: ['과', '와'] }[pair] ?? ['이', '가'];
  return has ? P[0] : P[1];
}
