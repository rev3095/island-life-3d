// 벽지·바닥·주민 방 규칙 (three·DOM 없음 → node 로도 돈다). 그리기는 pattern.js, 방 짓기는 room.js.
// 리소스는 assets/interior/ — specs/<slug>.json (벽지 WP · 바닥 FL · 방 틀 frame), rooms/<slug>.json (주민 방 RM), index.json (요약 목록).
// 무늬 스펙 pattern = { tile: [가로, 세로] (무늬 한 칸, 검수 보드 SVG 좌표), size: [가로, 세로] (한 칸의 실제 크기 m), base: 팔레트 키, shapes: [...] }
//   shape = { rect: [x, y, w, h], rx? } | { circle: [cx, cy, r] } | { ellipse: [cx, cy, rx, ry] } | { path: 'SVG 경로' }
//           + fill (팔레트 키 또는 #색), opacity?, stroke?, strokeWidth?
// 상태 state.house 에 더하는 칸: wallpaper·floor (지금 플레이어 방의 slug), owned (가진 벽지·바닥 slug), visit (주민 방 안에서 저장했으면 그 주민 slug).
import { rngFor } from '../../data/rng.js';
import { ROOM_W, ROOM_D, fits, boxOf } from './grid.js';

export const BASE = 'assets/interior';
export const DEFAULT = { wallpaper: 'wp-01', floor: 'fl-01' };
export const KIND_NAME = { wallpaper: '벽지', floor: '바닥' };
export const SHAPES = ['rect', 'circle', 'ellipse', 'path'];
/** 방 host.face 글자 → player facing 라디안 (0 = 북쪽, π/2 = 서쪽) */
export const FACE = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 };
export const HEX = /^#[0-9A-Fa-f]{6}$/;

// 웹 빌드(tools/build-web.mjs)는 JS 안에 따옴표로 적힌 에셋 경로 글자로 넣을 파일을 찾는다 → 게임이 읽는 interior 파일 전부.
// 스펙·방을 더하면 여기도 더한다 (목록과 같은지 tests/interior.test.mjs 가 본다). 빌드 도구에 interior 묶음이 생기면 지워도 된다 (notes/z2-interior.md).
export const WEB_FILES = [
  'assets/interior/index.json', 'assets/interior/specs/wp-01.json', 'assets/interior/specs/wp-02.json',
  'assets/interior/specs/wp-03.json', 'assets/interior/specs/wp-04.json', 'assets/interior/specs/wp-05.json',
  'assets/interior/specs/wp-06.json', 'assets/interior/specs/wp-07.json', 'assets/interior/specs/wp-08.json',
  'assets/interior/specs/fl-01.json', 'assets/interior/specs/fl-02.json', 'assets/interior/specs/fl-03.json',
  'assets/interior/specs/fl-04.json', 'assets/interior/specs/fl-05.json', 'assets/interior/specs/fl-06.json',
  'assets/interior/specs/fl-07.json', 'assets/interior/specs/fl-08.json', 'assets/interior/specs/frame.json',
  'assets/interior/rooms/rm-01.json', 'assets/interior/rooms/rm-02.json', 'assets/interior/rooms/rm-03.json',
  'assets/interior/rooms/rm-04.json', 'assets/interior/rooms/rm-05.json', 'assets/interior/rooms/rm-06.json',
  'assets/interior/rooms/rm-07.json', 'assets/interior/rooms/rm-12.json', 'assets/interior/rooms/rm-13.json',
  'assets/interior/rooms/rm-14.json',   // P44 이사 오는 주민 방: 구름 RM-12 · 파도 RM-13 · 달무리 RM-14 (RM-08–11 은 상점·박물관·달빛 가게·새벽 천막)
];

/** 팔레트 키 또는 #색 → #색 (모르면 null) */
export function resolveFill(spec, key) {
  if (key == null) return null;
  if (HEX.test(key)) return key;
  const c = spec?.palette?.[key];
  return HEX.test(c ?? '') ? c : null;
}

/** 벽지·바닥 스펙 검사 → 문제 글 목록 (비면 괜찮다) */
export function checkPattern(spec) {
  const out = [];
  const p = spec?.pattern;
  if (!p) return ['pattern 이 없어요'];
  const okPair = a => Array.isArray(a) && a.length === 2 && a.every(n => Number.isFinite(n) && n > 0);
  if (!okPair(p.tile)) out.push('pattern.tile 은 [가로, 세로] 양수');
  if (!okPair(p.size)) out.push('pattern.size 는 [가로, 세로] m 양수');
  if (!resolveFill(spec, p.base)) out.push(`pattern.base '${p.base}' 색을 못 찾아요`);
  for (const [i, s] of (p.shapes ?? []).entries()) {
    const kind = SHAPES.find(k => k in s);
    if (!kind) { out.push(`shapes[${i}] 모양이 없어요 (${SHAPES.join('·')})`); continue; }
    const need = { rect: 4, circle: 3, ellipse: 4 }[kind];
    if (need && !(Array.isArray(s[kind]) && s[kind].length === need && s[kind].every(Number.isFinite))) out.push(`shapes[${i}].${kind} 숫자 ${need}개`);
    if (kind === 'path' && (typeof s.path !== 'string' || !/^[Mm]/.test(s.path.trim()))) out.push(`shapes[${i}].path 는 M 으로 시작하는 SVG 경로`);
    if (s.fill != null && !resolveFill(spec, s.fill)) out.push(`shapes[${i}].fill '${s.fill}' 색을 못 찾아요`);
    if (s.stroke != null && !resolveFill(spec, s.stroke)) out.push(`shapes[${i}].stroke '${s.stroke}' 색을 못 찾아요`);
    if (s.fill == null && s.stroke == null) out.push(`shapes[${i}] 에 fill·stroke 가 없어요`);
  }
  for (const [k, v] of Object.entries(spec.palette ?? {})) if (!HEX.test(v)) out.push(`palette.${k} '${v}' 는 #RRGGBB 가 아니에요`);
  return out;
}

/**
 * 목록·벽지·바닥·방 틀 스펙을 모두 읽는다 (작은 JSON 17개). 방 배치는 room(slug) 로 그때그때.
 * loadJSON = ctx.assets.loadJSON → { index, specs: Map(slug → spec), frame, room(slug) → Promise }
 */
export async function loadInterior(loadJSON) {
  let index = { models: [], rooms: [] };
  try { index = await loadJSON(`${BASE}/index.json`); }
  catch (e) { console.warn('[house] 벽지·바닥 목록을 못 읽었어요 (방은 흰 벽으로)', e); }
  const specs = new Map();
  await Promise.all((index.models ?? []).map(async m => {
    try { specs.set(m.slug, await loadJSON(`${BASE}/specs/${m.slug}.json`)); }
    catch (e) { console.warn('[house] 벽지·바닥 스펙을 못 읽었어요', m.slug, e); }
  }));
  const rooms = new Map();
  return {
    index, specs,
    frame: specs.get('frame') ?? null,
    room(slug) {
      if (!rooms.has(slug)) rooms.set(slug, loadJSON(`${BASE}/rooms/${slug}.json`));
      return rooms.get(slug);
    },
  };
}

/** 목록에서 종류별 */
export const listOf = (index, kind) => (index?.models ?? []).filter(m => m.kind === kind);
export const entryOf = (index, slug) => (index?.models ?? []).find(m => m.slug === slug) ?? null;

/** 상점 오늘의 벽지 하나·바닥 하나 (같은 섬·같은 날이면 늘 같다). 처음부터 가진 것(starter)은 팔지 않는다 → { wallpaper, floor } slug */
export function todayPick(index, { seed = 0, dayKey = null } = {}) {
  const rng = rngFor(seed, dayKey ?? 'day0', 'interior');
  const pick = kind => {
    const pool = listOf(index, kind).filter(m => !m.starter && m.price > 0);
    return pool.length ? pool[Math.floor(rng() * pool.length)].slug : null;
  };
  return { wallpaper: pick('wallpaper'), floor: pick('floor') };
}

/** state.house 의 벽지·바닥 칸을 바로잡는다 (예전 저장·모르는 slug·reset 뒤). 바뀌었으면 true */
export function normalizeHouse(S, index) {
  const before = JSON.stringify([S.wallpaper, S.floor, S.owned]);
  const known = new Set((index?.models ?? []).filter(m => m.kind === 'wallpaper' || m.kind === 'floor').map(m => m.slug));
  const starters = (index?.models ?? []).filter(m => m.starter).map(m => m.slug);
  const owned = Array.isArray(S.owned) ? S.owned.filter(s => known.has(s)) : [];
  for (const s of [...starters, DEFAULT.wallpaper, DEFAULT.floor]) if (known.has(s) && !owned.includes(s)) owned.unshift(s);
  S.owned = [...new Set(owned)];
  for (const kind of ['wallpaper', 'floor']) {
    const ok = entryOf(index, S[kind])?.kind === kind && S.owned.includes(S[kind]);
    if (!ok) S[kind] = DEFAULT[kind];
  }
  return JSON.stringify([S.wallpaper, S.floor, S.owned]) !== before;
}

/**
 * 주민 방 가구 한 줄 → 놓을 정보. 지금 있는 가구는 item(아이템 id), 새 가구는 fu(FU 번호)로 적는다.
 * furnIndex = assets/furniture/index.json. 목록에 있으면 그 모델(real), 없으면 box [가로, 깊이, 높이] 로 임시 상자.
 * → { key, item, fu, real, footprint, place, layer, rec } (rec 는 grid.js 모양: 바닥 { item, gx, gz, rot } · 벽 { item, wall, slot })
 */
export function resolveFurniture(entry, furnIndex, i = 0) {
  const models = furnIndex?.models ?? [];
  const m = (entry.item && models.find(x => x.item === entry.item)) || (entry.fu && models.find(x => x.id === entry.fu)) || null;
  const box = Array.isArray(entry.box) ? entry.box : [1, 1, 0.8];
  const place = m?.place ?? (entry.wall ? 'wall' : 'floor');
  const footprint = m?.footprint ?? (entry.wall ? [1, 1] : [box[0], box[1]]);
  const key = m?.item ?? entry.item ?? `fu:${entry.fu ?? i}`;
  const rec = entry.wall ? { id: `v${i}`, item: key, wall: entry.wall, slot: entry.slot } : { id: `v${i}`, item: key, gx: entry.gx, gz: entry.gz, rot: entry.rot ?? 0 };
  return { key, item: m?.item ?? entry.item ?? null, fu: entry.fu ?? m?.id ?? null, real: !!m, footprint, place, layer: m?.layer ?? null, rec, entry };
}

/**
 * 주민 집 문 규칙 (Z4 town 약속, 실내 전수에서 바꿈 — 사용자 요청 6번 「실내 무조건 전부 들어갈 수 있게」):
 *  'open' 주민이 집에 있다 → 들어가면 방 안에 주민 · 'away' 외출 중 → 들어가면 빈 방 (조용히 구경) · 'asleep' 자는 중 → 살금살금 들어가면 빈 방(주민은 안쪽에서 잔다)
 *  · null 문이 없음(이사 오기 전) 또는 플레이어가 이미 그 방에 있음('room'). 예전의 'locked'(외출 중 잠김)·노크만 되던 'sleep' 은 없앴다. atHome 이 없으면 언제나 open.
 */
export function visitRule(town, slug) {
  if (town?.residents && !town.residents().includes(slug)) return null;
  const at = town?.atHome?.(slug);
  if (at === undefined) return 'open';
  return at === 'home' ? 'open' : at === 'out' ? 'away' : at === 'sleep' ? 'asleep' : null;
}

/** 문 매트 칸 (가구를 두지 않는다) — house/index.js 의 RESERVED 와 같다 */
export const doorCells = door => new Set([`${door.gx0},${ROOM_D - 1}`, `${door.gx1},${ROOM_D - 1}`]);

/** 주민 방 배치 검사 → 문제 글 목록. 벽·창문 자리는 windows Set('n:1'), 문 매트 칸은 door */
export function checkRoom(room, furnIndex, { windows = new Set(), door = { gx0: 3, gx1: 4 } } = {}) {
  const out = [];
  const list = (room.furniture ?? []).map((e, i) => resolveFurniture(e, furnIndex, i));
  const info = item => { const r = list.find(x => x.key === item); return r ? { footprint: r.footprint, layer: r.layer } : null; };
  const placed = [];
  for (const r of list) {
    const name = r.entry.item ?? r.entry.fu;
    if (!r.entry.item && !r.entry.fu) { out.push('가구에 item 이나 fu 가 없어요'); continue; }
    if (r.entry.item && !r.real) out.push(`${name}: 가구 목록에 없는 아이템이에요`);
    if (r.place === 'wall' || r.place === 'window') {
      if (!r.entry.wall) { out.push(`${name}: 벽 가구는 wall·slot 으로 놓아요`); continue; }
      const key = `${r.rec.wall}:${r.rec.slot}`;
      const max = r.rec.wall === 'n' ? ROOM_W : ROOM_D;
      if (!(r.rec.slot >= 0 && r.rec.slot < max)) out.push(`${name}: 벽 자리 ${key} 가 방 밖이에요`);
      if (r.place === 'window' ? !windows.has(key) : windows.has(key)) out.push(`${name}: ${r.place === 'window' ? '창문 자리가 아니에요' : '창문 자리에는 걸 수 없어요'} (${key})`);
      if (placed.some(o => o.wall === r.rec.wall && o.slot === r.rec.slot)) out.push(`${name}: 벽 자리 ${key} 에 다른 가구가 있어요`);
      placed.push(r.rec);
      continue;
    }
    if (r.entry.wall) { out.push(`${name}: 바닥 가구인데 wall 로 적었어요`); continue; }
    if (!fits(placed, r.rec, info, { reserved: doorCells(door) })) out.push(`${name}: (${r.rec.gx}, ${r.rec.gz}) rot ${r.rec.rot} 에 안 들어가요 (벽·문 매트·다른 가구)`);
    placed.push(r.rec);
  }
  // 주민이 서는 자리: 방 안, 바닥 가구 밖
  const h = room.host;
  if (!h || !Number.isFinite(h.lx) || !Number.isFinite(h.lz) || !(h.face in FACE)) out.push('host = { lx, lz, face: n|e|s|w } 가 필요해요');
  else {
    if (h.lx < 0.5 || h.lx > ROOM_W - 0.5 || h.lz < 0.5 || h.lz > ROOM_D - 1.2) out.push('host 가 방 가장자리·문 매트에 너무 가까워요');
    for (const r of list) {
      if (r.rec.wall || r.layer === 'rug') continue;
      const b = boxOf(r.rec, r.footprint);
      if (h.lx > b.x0 - 0.3 && h.lx < b.x1 + 0.3 && h.lz > b.z0 - 0.3 && h.lz < b.z1 + 0.3) out.push(`host 가 ${r.entry.item ?? r.entry.fu} 와 겹쳐요`);
    }
  }
  return out;
}
