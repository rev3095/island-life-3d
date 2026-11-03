// 도토리상점·박물관 실내 규칙 (three·DOM 없음 → node 로도 돈다, tests/places.test.mjs). 짓기·그리기는 places.js.
// 방 배치 = assets/interior/places/<shop|museum>.json (실내 검수 보드 RM-08 · RM-09). 주민 방(RM-01–06) 모양에 더해:
//   size [가로, 깊이] 칸 · windows 북쪽 벽 창 자리 · door 문 매트 칸 { gx0, gx1 } · keeper 주인이 서는 곳 { slug, lx, lz, face } · talk 플레이어가 말 거는 곳 { lx, lz }
//   furniture[].role 'counter' = 계산대·안내대 (FU-36 자리), furniture[].scale [x, y, z] = 모델 늘이기·줄이기 (계산대를 주인 키에 맞춰 낮출 때), furniture[].look [가로, 깊이] = 임시 상자가 보이는 크기 (발자국 box 보다 가늘게)
//   상점 stock = [{ group: furniture|tools|seeds|saplings, from?, count, lx, lz, y, dz?, fit? }] — 오늘의 물건을 놓는 줄
//   박물관 cases = [{ kind: tank|terrarium, cat, lx0, lz0, lx1, lz1, h, levels }] 긴 수조·유리 상자, fossils = [[lx, lz]] 받침 위 (fossilY 높이)
import { fits, boxOf, inBox } from './grid.js';
import { resolveFurniture, FACE } from './interior.js';

// 웹 빌드는 JS 안에 따옴표로 적힌 에셋 경로 글자로 넣을 파일을 찾는다 (interior.js WEB_FILES 와 같은 까닭)
export const PLACE_FILES = ['assets/interior/places/shop.json', 'assets/interior/places/museum.json'];
export const PLACE_KINDS = ['shop', 'museum'];
/** 섬 건물 모델 slug (door.js 가 문 크기를 읽는다) */
export const PLACE_BUILDING = { shop: 'shop', museum: 'museum' };
export const MUSEUM_CATS = ['fish', 'bug', 'fossil'];
/** 케이스 안쪽 여백 (m) */
const CASE_PAD = 0.22;

export const sizeOf = spec => (Array.isArray(spec?.size) && spec.size.length === 2 ? spec.size : [8, 8]);
export const doorOf = spec => spec?.door ?? { gx0: 3, gx1: 4 };
/** 문 매트 (방 기준 좌표): 가운데 lx, 매트 위 lz, 방 앞 끝 front, 들어와서 서는 entry */
export function doormatOf(spec) {
  const [, d] = sizeOf(spec), dr = doorOf(spec);
  return { lx: (dr.gx0 + dr.gx1 + 1) / 2, lz: d - 0.45, front: d, entry: d - 0.7 };
}
/** 걸을 수 있는 네모 (방 기준, 벽 징두리만큼 안쪽) — room.js BOUNDS 와 같은 규칙 */
export const boundsOf = spec => { const [w, d] = sizeOf(spec); return { x0: 0.09, z0: 0.09, x1: w - 0.09, z1: d }; };
export const doorCellsOf = spec => { const [, d] = sizeOf(spec), dr = doorOf(spec); return new Set([`${dr.gx0},${d - 1}`, `${dr.gx1},${d - 1}`]); };

/** 막는 상자 (방 기준): 바닥 가구(깔개 빼고) · 케이스 · 주인 자리 → [{ x0, z0, x1, z1 }] */
export function blockersOf(spec, list) {
  const out = [];
  for (const r of list) {
    if (r.rec.wall || r.layer === 'rug') continue;
    const b = boxOf(r.rec, r.footprint);
    out.push({ x0: b.x0 + 0.04, z0: b.z0 + 0.04, x1: b.x1 - 0.04, z1: b.z1 - 0.04 });
  }
  for (const c of spec.cases ?? []) out.push({ x0: c.lx0, z0: c.lz0, x1: c.lx1, z1: c.lz1 });
  const k = spec.keeper;
  if (k) out.push({ x0: k.lx - 0.28, z0: k.lz - 0.28, x1: k.lx + 0.28, z1: k.lz + 0.28 });
  return out;
}

/** 케이스 안 자리 n 개 → [{ lx, lz, y }]. 앞뒤로 줄을 세우고 층(levels)을 번갈아, 층마다 조금 안팎으로 비킨다 */
export function caseSlots(c, n) {
  const levels = c.levels?.length ? c.levels : [0.45];
  const rows = Math.max(1, Math.ceil(n / levels.length));
  const cx = (c.lx0 + c.lx1) / 2, half = Math.max(0, (c.lx1 - c.lx0) / 2 - CASE_PAD);
  const z0 = c.lz0 + CASE_PAD, z1 = c.lz1 - CASE_PAD;
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / levels.length), lv = i % levels.length;
    const lz = rows === 1 ? (z0 + z1) / 2 : z0 + ((z1 - z0) * (row + (lv % 2 ? 0.75 : 0.25))) / rows;
    const off = levels.length > 1 ? (lv % 2 ? half : -half) * 0.35 : 0;   // 층이 여럿이면 층마다 안팎으로 비켜 겹쳐 보이지 않게
    out.push({ lx: cx + off, lz, y: levels[lv] });
  }
  return out;
}

/**
 * 박물관 전시: 분류마다 모든 자리와 기증 여부. lists = { fish: [id], bug: [id], fossil: [id] } (아이템 표 순서), has(id) → 기증했나.
 * 자리는 아이템 표 순서로 정해서 늘 같다 (빈 자리 = 아직). → [{ cat, id, lx, lz, y, donated }]
 */
export function exhibitPlan(spec, lists, has) {
  const out = [];
  for (const c of spec.cases ?? []) {
    const ids = lists[c.cat] ?? [];
    caseSlots(c, ids.length).forEach((s, i) => out.push({ cat: c.cat, id: ids[i], ...s, donated: !!has(ids[i]) }));
  }
  const fossils = lists.fossil ?? [];
  (spec.fossils ?? []).forEach(([lx, lz], i) => { if (fossils[i]) out.push({ cat: 'fossil', id: fossils[i], lx, lz, y: spec.fossilY ?? 0.55, donated: !!has(fossils[i]) }); });
  return out;
}

/** 상점 진열: 오늘의 물건 묶음(economy.stockGroups()) → [{ id, group, lx, lz, y, fit }] */
export function stockPlan(spec, groups) {
  const out = [];
  for (const row of spec.stock ?? []) {
    const ids = (groups?.[row.group] ?? []).slice(row.from ?? 0, (row.from ?? 0) + (row.count ?? 1));
    ids.forEach((id, i) => out.push({ id, group: row.group, lx: row.lx + (row.dx ?? 0) * i, lz: row.lz + (row.dz ?? 0) * i, y: row.y ?? 0, fit: row.fit ?? null }));
  }
  return out;
}

/** (방 기준) 점에서 점까지 걸어갈 수 있나 — 0.25 칸 격자 넓이 우선 (원 반지름 r) */
export function reachable(spec, list, from, to, r = 0.26) {
  const [w, d] = sizeOf(spec), B = boundsOf(spec), boxes = blockersOf(spec, list);
  const S = 0.25, W = Math.ceil(w / S), D = Math.ceil(d / S);
  const free = (i, j) => {
    const x = (i + 0.5) * S, z = (j + 0.5) * S;
    if (x < B.x0 + r || x > B.x1 - r || z < B.z0 + r || z > B.z1 - r) return false;
    return !boxes.some(b => inBox(b, x, z, r - 0.02));
  };
  const cell = p => [Math.min(W - 1, Math.max(0, Math.floor(p.lx / S))), Math.min(D - 1, Math.max(0, Math.floor(p.lz / S)))];
  const [si, sj] = cell(from), [gi, gj] = cell(to);
  const seen = new Set([`${si},${sj}`]), q = [[si, sj]];
  while (q.length) {
    const [i, j] = q.shift();
    if (Math.abs(i - gi) <= 1 && Math.abs(j - gj) <= 1) return true;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a, nj = j + b, k = `${ni},${nj}`;
      if (ni < 0 || nj < 0 || ni >= W || nj >= D || seen.has(k) || !free(ni, nj)) continue;
      seen.add(k);
      q.push([ni, nj]);
    }
  }
  return false;
}

/** 방 배치 검사 → 문제 글 목록 (비면 괜찮다). furnIndex = assets/furniture/index.json */
export function checkPlace(spec, furnIndex) {
  const out = [];
  const [w, d] = sizeOf(spec);
  if (!(w >= 6 && d >= 6 && w <= 16 && d <= 12)) out.push(`size ${w}×${d} 는 6×6 ~ 16×12 안이어야 해요`);
  const dr = doorOf(spec);
  if (!(dr.gx1 === dr.gx0 + 1 && dr.gx0 >= 0 && dr.gx1 < w)) out.push('door 는 앞쪽 붙은 두 칸 { gx0, gx1 = gx0 + 1 }');
  const windows = new Set(spec.windows ?? []);
  for (const k of windows) { const [wl, s] = k.split(':'); if (wl !== 'n' || !(Number(s) >= 0 && Number(s) < w)) out.push(`창 자리 ${k} 가 북쪽 벽 밖이에요`); }
  // 같은 FU 번호 임시 상자가 여럿이라(받침 여덟 등) 검사할 때는 줄마다 따로 이름을 붙인다
  const list = (spec.furniture ?? []).map((e, i) => { const r = resolveFurniture(e, furnIndex, i); return { ...r, rec: { ...r.rec, item: `${r.key}#${i}` } }; });
  const info = item => { const r = list.find(x => x.rec.item === item); return r ? { footprint: r.footprint, layer: r.layer } : null; };
  const placed = [];
  for (const r of list) {
    const name = r.entry.item ?? r.entry.fu;
    if (!r.entry.item && !r.entry.fu) { out.push('가구에 item 이나 fu 가 없어요'); continue; }
    if (r.entry.item && !r.real) out.push(`${name}: 가구 목록에 없는 아이템이에요`);
    if (r.place === 'wall' || r.place === 'window') {
      const key = `${r.rec.wall}:${r.rec.slot}`, max = r.rec.wall === 'n' ? w : d;
      if (!r.entry.wall) { out.push(`${name}: 벽 가구는 wall·slot 으로 놓아요`); continue; }
      if (!(r.rec.slot >= 0 && r.rec.slot < max)) out.push(`${name}: 벽 자리 ${key} 가 방 밖이에요`);
      if (r.place === 'window' ? !windows.has(key) : windows.has(key)) out.push(`${name}: ${r.place === 'window' ? '창문 자리가 아니에요' : '창문 자리에는 걸 수 없어요'} (${key})`);
      if (placed.some(o => o.wall === r.rec.wall && o.slot === r.rec.slot)) out.push(`${name}: 벽 자리 ${key} 에 다른 가구가 있어요`);
      placed.push(r.rec);
      continue;
    }
    if (!fits(placed, r.rec, info, { reserved: doorCellsOf(spec), w, d })) out.push(`${name}: (${r.rec.gx}, ${r.rec.gz}) rot ${r.rec.rot} 에 안 들어가요 (벽·문 매트·다른 가구)`);
    placed.push(r.rec);
  }
  if (!list.some(r => r.entry.role === 'counter')) out.push('계산대·안내대(role: counter)가 없어요');
  const B = boundsOf(spec), inRoom = p => p && Number.isFinite(p.lx) && Number.isFinite(p.lz) && p.lx > B.x0 && p.lx < B.x1 && p.lz > B.z0 && p.lz < B.z1;
  const boxes = blockersOf(spec, list);
  const k = spec.keeper;
  if (!k || !inRoom(k) || !(k.face in FACE) || !k.slug) out.push('keeper = { slug, lx, lz, face: n|e|s|w } 가 방 안에 있어야 해요');
  else if (boxes.slice(0, boxes.length - 1).some(b => inBox(b, k.lx, k.lz))) out.push('keeper 가 가구·케이스 위에 서 있어요');
  const t = spec.talk;
  if (!inRoom(t)) out.push('talk = { lx, lz } 가 방 안에 있어야 해요');
  else if (boxes.some(b => inBox(b, t.lx, t.lz, 0.2))) out.push('talk 자리가 가구·케이스와 겹쳐요');
  for (const c of spec.cases ?? []) {
    if (!(c.lx0 >= 0 && c.lz0 >= 0 && c.lx1 <= w && c.lz1 <= d - 1 && c.lx1 > c.lx0 && c.lz1 > c.lz0)) out.push(`${c.name ?? c.cat}: 케이스가 방 밖이거나 문 매트 줄에 걸려요`);
    for (const r of list) {
      if (r.rec.wall || r.layer === 'rug') continue;
      const b = boxOf(r.rec, r.footprint);
      if (b.x0 < c.lx1 && b.x1 > c.lx0 && b.z0 < c.lz1 && b.z1 > c.lz0) out.push(`${c.name ?? c.cat}: ${r.entry.item ?? r.entry.fu} 와 겹쳐요`);
    }
  }
  const m = doormatOf(spec);
  if (inRoom(t) && !reachable(spec, list, { lx: m.lx, lz: m.entry }, t)) out.push('문 매트에서 talk 자리까지 걸어갈 수 없어요');
  return out;
}
