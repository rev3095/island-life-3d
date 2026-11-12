// 도토리상점·박물관 실내 규칙 (three·DOM 없음 → node 로도 돈다, tests/places.test.mjs). 짓기·그리기는 places.js.
// 방 배치 = assets/interior/places/<shop|museum>.json (실내 검수 보드 RM-08 · RM-09). 주민 방(RM-01–06) 모양에 더해:
//   size [가로, 깊이] 칸 · windows 북쪽 벽 창 자리 · door 문 매트 칸 { gx0, gx1 } · keeper 주인이 서는 곳 { slug, lx, lz, face } · talk 플레이어가 말 거는 곳 { lx, lz }
//   furniture[].role 'counter' = 계산대·안내대 (FU-36 자리), furniture[].scale [x, y, z] = 모델 늘이기·줄이기 (계산대를 주인 키에 맞춰 낮출 때), furniture[].look [가로, 깊이] = 임시 상자가 보이는 크기 (발자국 box 보다 가늘게)
//   상점 stock = [{ group: furniture|tools|seeds|saplings|clothes, from?, count, lx, lz, y, dx?, dz?, fit?, hang? }] — 오늘의 물건을 놓는 줄 (11차 clothes: 윗옷은 hang 높이 가로대에 건다)
//   박물관 cases = [{ kind: tank|terrarium, cat, lx0, lz0, lx1, lz1, h, levels, fixture? }] 긴 수조·유리 상자 (fixture = 붙박이 모델 slug), fossils = [[lx, lz]] 받침 위 (fossilY 높이)
import { fits, boxOf, inBox } from './grid.js';
import { resolveFurniture, FACE } from './interior.js';

// 웹 빌드는 JS 안에 따옴표로 적힌 에셋 경로 글자로 넣을 파일을 찾는다 (interior.js WEB_FILES 와 같은 까닭)
// M12 밤·새벽 (보드 night D109-A · D111-A): 달빛 가게 moonshop RM-10 · 새벽 천막 tent RM-11 — 건물은 gameplay/night 가 밤에 섬에 놓고 world.places 에 문을 알린다
// 실내 전수: 도토리상점 딸린 방 — shop-garden 정원·도구 코너 RM-22 (낮) · shop-night 지하 밤 코너 RM-21 (밤). 섬 문이 아니라 1층 실내 문(inner)으로 드나든다
export const PLACE_FILES = ['assets/interior/places/shop.json', 'assets/interior/places/museum.json', 'assets/interior/places/moonshop.json', 'assets/interior/places/tent.json', 'assets/interior/places/shop-garden.json', 'assets/interior/places/shop-night.json'];
export const PLACE_KINDS = ['shop', 'museum', 'moonshop', 'tent', 'shop-garden', 'shop-night'];
/** 딸린 방 → 그 방으로 들어가는 1층 (섬 건물이 없다) */
export const PLACE_PARENT = { 'shop-garden': 'shop', 'shop-night': 'shop' };
/** 섬 문으로 들어가는 곳 (딸린 방 빼고) */
export const OUTER_KINDS = PLACE_KINDS.filter(k => !PLACE_PARENT[k]);
/** 그 장소의 맨 바깥 (딸린 방이면 1층) */
export const rootOf = kind => PLACE_PARENT[kind] ?? kind;
/** 진열(stock) 대신 박물관 전시(cases)를 쓰는 곳 */
export const EXHIBIT_KINDS = ['museum'];
/** 상점·박물관 붙박이 모델 (FU-35–42, tools/build-furniture.mjs --fixtures) — 가구 목록·아이템 표 밖 */
export const FIXTURE_BASE = 'assets/furniture/fixtures';
export const FIXTURE_INDEX = 'assets/furniture/fixtures/index.json';
/** 섬 건물 모델 slug (door.js 가 문 크기를 읽는다) */
export const PLACE_BUILDING = { shop: 'shop', museum: 'museum', moonshop: 'night-shop', tent: 'dawn-tent', 'shop-garden': 'shop', 'shop-night': 'shop' };
export const MUSEUM_CATS = ['fish', 'bug', 'fossil'];
/** 케이스 안쪽 여백 (m) */
const CASE_PAD = 0.22;

/** 이름표(UI-31) 앞 그림 */
export const PLACE_ICON = { shop: '🏪', 'shop-garden': '🪴', 'shop-night': '🌙', museum: '🏛', moonshop: '🌙', tent: '🔮' };
/**
 * 매장(phase)의 진열 묶음 (economy.stockGroups() → 방 배치 stock[].group 이 읽는 이름표). 밤엔 groups.night 의 것에 night- 를 붙여 더한다:
 * night-furniture · night-tools · night-snacks (rules.json shop.night). 낮·밤 모두 always (rules.json shop.always)
 */
export function phaseGroups(groups, phase) {
  if (phase !== 'night' || !groups) return groups ?? {};
  const n = groups.night ?? {};
  return { ...groups, 'night-furniture': n.furniture ?? [], 'night-tools': n.tools ?? [], 'night-snacks': n.snacks ?? [] };
}
/** 낮/밤 매장 (실내 전수): 방 배치 phases.{day,night} 를 늘 있는 칸에 더한 배치. phases 가 없으면 그대로 */
export function phaseSpec(spec, phase) {
  const P = spec?.phases?.[phase];
  if (!P) return spec;
  return { ...spec, furniture: [...(spec.furniture ?? []), ...(P.furniture ?? [])], stock: [...(spec.stock ?? []), ...(P.stock ?? [])], keeper: P.keeper ?? spec.keeper, talk: P.talk ?? spec.talk, phase, phaseName: P.name ?? null };
}
/** 방 배치의 매장 갈래 이름들 (phases 가 없으면 [null]) */
export const phasesOf = spec => (spec?.phases ? Object.keys(spec.phases) : [null]);
/** 실내 문 (1층 벽 → 딸린 방): { to, wall, slot, phase, name } 가 그 매장에서 열렸나 */
export const innerOpen = (door, phase) => !door.phase || door.phase === phase;
/** 실내 문 앞 (방 기준): 문 자리 lx, lz · 문 앞에 설 곳 sx, sz · 문을 보는 방향 facing (player.facing 규칙: 앞 = (-sin f, -cos f)) · 나올 때 볼 방향 back */
export function innerSpot(spec, door) {
  const [w, d] = sizeOf(spec), s = door.slot + 0.5;
  if (door.wall === 'n') return { lx: s, lz: 0, sx: s, sz: 0.75, facing: 0, back: Math.PI };
  if (door.wall === 'w') return { lx: 0, lz: s, sx: 0.75, sz: s, facing: Math.PI / 2, back: -Math.PI / 2 };
  return { lx: w, lz: s, sx: w - 0.75, sz: s, facing: -Math.PI / 2, back: Math.PI / 2 };
}

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
    ids.forEach((id, i) => out.push({ id, group: row.group, lx: row.lx + (row.dx ?? 0) * i, lz: row.lz + (row.dz ?? 0) * i, y: row.y ?? 0, fit: row.fit ?? null, ...(row.hang != null ? { hang: row.hang } : {}) }));
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
  const sub = !!spec.parent;   // 딸린 방 (정원 코너·지하 밤 코너): 주인·계산대 없이 진열품 앞 「보기」로 산다
  if (!sub && !list.some(r => r.entry.role === 'counter')) out.push('계산대·안내대(role: counter)가 없어요');
  const B = boundsOf(spec), inRoom = p => p && Number.isFinite(p.lx) && Number.isFinite(p.lz) && p.lx > B.x0 && p.lx < B.x1 && p.lz > B.z0 && p.lz < B.z1;
  const boxes = blockersOf(spec, list);
  const k = spec.keeper;
  if (sub) { /* 주인·말 거는 자리 없음 */ } else if (!k || !inRoom(k) || !(k.face in FACE) || !k.slug) out.push('keeper = { slug, lx, lz, face: n|e|s|w } 가 방 안에 있어야 해요');
  else if (boxes.slice(0, boxes.length - 1).some(b => inBox(b, k.lx, k.lz))) out.push('keeper 가 가구·케이스 위에 서 있어요');
  const t = spec.talk;
  if (sub) { /* 없음 */ } else if (!inRoom(t)) out.push('talk = { lx, lz } 가 방 안에 있어야 해요');
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
  if (!sub && inRoom(t) && !reachable(spec, list, { lx: m.lx, lz: m.entry }, t)) out.push('문 매트에서 talk 자리까지 걸어갈 수 없어요');
  // 실내 문: 벽 안 · 그 벽 자리에 문 모델(벽 가구) · 문 매트에서 문 앞까지 길
  for (const dr2 of spec.inner ?? []) {
    const max = dr2.wall === 'n' ? w : d;
    if (!['n', 'e', 'w'].includes(dr2.wall) || !(dr2.slot >= 0 && dr2.slot < max)) { out.push(`실내 문 ${dr2.to}: 벽 자리 ${dr2.wall}:${dr2.slot} 가 방 밖이에요`); continue; }
    if (!list.some(r => r.rec.wall === dr2.wall && r.rec.slot === dr2.slot)) out.push(`실내 문 ${dr2.to}: ${dr2.wall}:${dr2.slot} 에 문 모델(벽 가구)이 없어요`);
    const f = innerSpot(spec, dr2);
    if (boxes.some(b => inBox(b, f.sx, f.sz, 0.15))) out.push(`실내 문 ${dr2.to}: 문 앞이 가구로 막혀요`);
    else if (!reachable(spec, list, { lx: m.lx, lz: m.entry }, { lx: f.sx, lz: f.sz })) out.push(`실내 문 ${dr2.to}: 문 매트에서 문 앞까지 걸어갈 수 없어요`);
  }
  // 진열 줄: 방 안
  for (const row of spec.stock ?? []) if (!inRoom({ lx: row.lx, lz: row.lz })) out.push(`진열 ${row.group}: (${row.lx}, ${row.lz}) 가 방 밖이에요`);
  return out;
}
