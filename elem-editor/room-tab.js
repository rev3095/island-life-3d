// 요소 편집기 「방 배치」 탭 — 주민 방·내 집 증축 층(assets/interior/rooms/rm-NN.json), 상점·박물관·밤 가게(assets/interior/places/<slug>.json),
// 박물관 관 여섯(assets/interior/halls/<관>.json)의 가구 자리를 위에서 본 칸 그림으로 옮긴다. 배치 검사는 게임 코드 그대로:
// 주민 방 interior.js checkRoom, 가게 placedata.js checkPlace (낮/밤 매장마다 phaseSpec), 관 museum-hall-data.js checkHall, 내 집 층 home.js checkHomeRoom.
// (예전 배경 편집기 「방 배치」 탭의 2D 부분 — 3D 보기·모델은 리소스 편집기 몫.) 바뀐 칸 (모두 파일 키 + slug 로 시작):
//   rooms/<slug>/furniture · starter (내 집 층의 처음 가구) · fixtures (계단) · host · name · wallpaper · floor
//   places/<slug>/furniture · phases/<day|night>/furniture (낮/밤 매장 가구) · keeper · inner (1층 실내 문) · halls (박물관 로비 관 입구)
//   halls/<관>/furniture · wallpaper · floor   (furniture·starter·fixtures·inner·halls 는 배열 통째로)
import { checkRoom, resolveFurniture, FACE } from '../src/gameplay/house/interior.js';
import { checkPlace, PLACE_KINDS, PLACE_PARENT, phaseSpec, phasesOf, innerSpot } from '../src/gameplay/house/placedata.js';
import { checkHall, hallPlan, HALLS, HALL_NAME, HALL_ICON } from '../src/gameplay/house/museum-hall-data.js';
import { checkHomeRoom, fixtureBox, FLOOR_NAME } from '../src/gameplay/house/home.js';
import { boxOf, fits, dims } from '../src/gameplay/house/grid.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROOM_WINDOWS = ['n:1', 'n:6'];                 // src/gameplay/house/room.js WINDOWS (주민 방)
const ROOM_DOOR = { gx0: 3, gx1: 4 };
const PLACE_NAME = { shop: '도토리상점', museum: '박물관', moonshop: '달빛 가게', tent: '새벽 천막', 'shop-garden': '정원·도구 코너', 'shop-night': '지하 밤 코너', fortune: '운세 부스', foxshop: '여우 상인 가게', oddtent: '이상한 천막' };
const PHASE_KO = { day: '☀️ 낮 매장', night: '🌙 밤 매장' };
const FACE_KO = { n: '북쪽(안쪽 벽)', e: '동쪽', s: '남쪽(문 쪽)', w: '서쪽' };
const WALL_KO = { n: '북쪽 벽', w: '서쪽 벽', e: '동쪽 벽' };
const COLORS = ['#E8B27A', '#9CC48A', '#8DB6D9', '#D9A0B8', '#C9B27A', '#A7A0D9', '#E59A7A', '#86C2B4'];
const hashColor = s => COLORS[[...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];
const HALL_SLUGS = HALLS.map(h => `hall-${h}`);
/** 박물관 관 전시 자리 수를 셀 아이템 목록 (items.js list(c) 와 같은 순서 — 표 순서) */
export function hallLists(T = {}) {
  return {
    fish: (T.fish ?? []).map(r => ({ id: `fish.${r.slug}` })),
    bug: (T.bugs ?? []).map(r => ({ id: `bug.${r.slug}` })),
    fossil: (T.fossils ?? []).map(r => ({ id: `fossil.${r.slug}` })),
    sea: (T.sea ?? []).map(r => ({ id: `sea.${r.slug}` })),
    art: (T.art ?? []).map(r => ({ id: `art.${r.slug}`, artKind: r.kind })),
  };
}

/**
 * api = { work(): { rooms, places, halls, items, home }, base(): 같은 모양 (반영된 파일), set(path, v), onChange(), changedIn(pre), furn: { models }, interior: interior/index.json }
 * → { show(slug?), hide(), refresh(), checks(): [[ok, label, why, slug]], current() }
 */
export function createRoomTab(root, api) {
  const roomSlugs = (api.interior.rooms ?? []).map(r => r.slug);
  const allSlugs = () => [...roomSlugs, ...PLACE_KINDS, ...HALL_SLUGS];
  let cur = location.hash.match(/^#rooms\.([\w-]+)/)?.[1] ?? roomSlugs[0];
  let sel = null, drag = null, visible = false, phase = null;   // sel = 숫자(가구 줄) | 'host' | 'fx:N' 계단 | 'in:N' 실내 문 | 'arch:N' 관 입구
  const kindOf = slug => (PLACE_KINDS.includes(slug) ? 'places' : HALL_SLUGS.includes(slug) ? 'halls' : 'rooms');
  const keyOf = slug => (kindOf(slug) === 'halls' ? slug.slice(5) : slug);
  const preOf = slug => `${kindOf(slug)}/${keyOf(slug)}`;
  const specOf = slug => api.work()[kindOf(slug)]?.[keyOf(slug)];
  const baseSpecOf = slug => api.base()[kindOf(slug)]?.[keyOf(slug)];
  const isHome = spec => spec?.owner === 'player';
  const furnNames = () => {
    const out = {};
    for (const f of api.work().items.furniture ?? []) out[`furn.${f.slug}`] = { name: f.name, emoji: f.emoji };
    return out;
  };
  const geom = (spec, slug = cur) => {
    const k = kindOf(slug), sized = k !== 'rooms' || Array.isArray(spec?.size);
    const door = spec?.door === null ? null : spec?.door ?? ROOM_DOOR;
    return { w: sized ? spec?.size?.[0] ?? 8 : 8, d: sized ? spec?.size?.[1] ?? 8 : 8, windows: k === 'rooms' && !isHome(spec) ? ROOM_WINDOWS : spec?.windows ?? [], door, place: k !== 'rooms', hall: k === 'halls', home: isHome(spec) };
  };
  /** 지금 고르는 매장 (phases 가 있는 가게만) */
  const phaseOf = spec => (spec?.phases && phase && spec.phases[phase] ? phase : null);
  /** 그림에 놓이는 가구 배열들: [{ src: 파일 안 경로, arr }] — 새 가구는 맨 끝 배열에 더한다 */
  const srcsOf = spec => {
    if (isHome(spec)) return [...((spec.furniture ?? []).length ? ['furniture'] : []), 'starter'];
    const ph = phaseOf(spec);
    return ph ? ['furniture', `phases/${ph}/furniture`] : ['furniture'];
  };
  const arrAt = (spec, src) => src.split('/').reduce((o, k) => o?.[k], spec) ?? [];
  /** 가구 줄 모두 (그림·고르기 번호 = 이 순서) → [{ src, i, e }] */
  const entries = (spec = specOf(cur)) => srcsOf(spec).flatMap(src => arrAt(spec, src).map((e, i) => ({ src, i, e })));
  const setArr = (src, arr) => api.set(`${preOf(cur)}/${src}`, arr);
  function editEntry(k, fn) {
    const en = entries()[k];
    if (!en) return false;
    const arr = structuredClone(arrAt(specOf(cur), en.src));
    if (fn(arr[en.i], arr, en.i) === false) return false;
    setArr(en.src, arr);
    return true;
  }
  /** 검사할 모양: 가게는 매장마다 phaseSpec, 관은 checkHall, 내 집 층은 checkHomeRoom + 처음 가구 자리 */
  const problemsOf = slug => {
    const s = specOf(slug);
    if (!s) return ['방 파일이 없어요'];
    const k = kindOf(slug), out = [];
    if (k === 'halls') return checkHall(s, { checkPlace, furnIndex: api.furn, lists: hallLists(api.work().items) });
    if (k === 'places') {
      // 매장마다 검사 → 모든 매장에 걸린 것은 그대로, 한 매장에만 걸린 것은 앞에 매장 이름
      const phs = phasesOf(s), per = phs.map(ph => checkPlace(phaseSpec(s, ph), api.furn));
      const merged = [];
      phs.forEach((ph, n) => per[n].forEach(t => {
        const line = !ph || per.every(p => p.includes(t)) ? t : `${PHASE_KO[ph] ?? ph}: ${t}`;
        if (!merged.includes(line)) merged.push(line);
      }));
      if (PLACE_PARENT[slug] && s.parent !== PLACE_PARENT[slug]) merged.push(`parent 는 '${PLACE_PARENT[slug]}' 이어야 해요 (placedata PLACE_PARENT)`);
      if (PLACE_PARENT[slug]) {
        const door = (specOf(PLACE_PARENT[slug])?.inner ?? []).find(d => d.to === slug);
        if (!door) merged.push(`${PLACE_NAME[PLACE_PARENT[slug]]} 1층에 이 방으로 가는 실내 문(inner)이 없어요`);
        else if ((door.phase ?? null) !== (s.phase ?? null)) merged.push(`실내 문 매장(${door.phase ?? '늘'})과 이 방 phase(${s.phase ?? '늘'})가 달라요`);
      }
      for (const d of s.inner ?? []) if (!PLACE_KINDS.includes(d.to) || PLACE_PARENT[d.to] !== slug) merged.push(`실내 문 ${d.to}: 이 가게에 딸린 방이 아니에요`);
      return merged;
    }
    if (isHome(s)) {
      out.push(...checkHomeRoom(s));
      const G = geom(s, slug), list = entries(s).map((en, i) => resolveFurniture(en.e, api.furn, i));
      const info = item => { const r = list.find(x => x.key === item); return r ? { footprint: r.footprint, layer: r.layer } : null; };
      const reserved = new Set(G.door ? [`${G.door.gx0},${G.d - 1}`, `${G.door.gx1},${G.d - 1}`] : []);
      for (const f of s.fixtures ?? []) { const b = fixtureBox(f); for (let x = b.x0; x < b.x1; x++) for (let z = b.z0; z < b.z1; z++) reserved.add(`${x},${z}`); }
      const placed = [];
      for (const r of list) {
        const name = r.entry.item ?? r.entry.fu;
        if (r.entry.item && !r.real) out.push(`${name}: 가구 목록에 없는 아이템이에요`);
        if (r.rec.wall) { placed.push(r.rec); continue; }
        if (!fits(placed, r.rec, info, { reserved, w: G.w, d: G.d })) out.push(`${name}: (${r.rec.gx}, ${r.rec.gz}) 에 안 들어가요 (벽·문 매트·계단·다른 가구)`);
        placed.push(r.rec);
      }
      return out;
    }
    return checkRoom(s, api.furn, { windows: new Set(ROOM_WINDOWS) });
  };

  root.innerHTML = `
  <div class="roomwork">
    <div class="roomcol">
      <div class="roompick" role="tablist" aria-label="방 고르기" data-r="pick"></div>
      <div class="phasebar" data-r="phase" role="group" aria-label="매장 고르기" hidden></div>
      <div class="roomgrid" data-r="grid"></div>
      <p class="small muted">끌어 옮기기 (칸에 맞춤) · 누르고 R = 돌리기 · Delete = 빼기 · 화살표 = 한 칸. 벽 가구는 가까운 벽 자리로 붙어요. 점선은 진열·전시 자리(보기만), 동그라미는 주인·주민이 서는 곳, 갈색 문은 실내 문·관 입구, 빗금은 계단.</p>
    </div>
    <div class="roomside">
      <section class="box"><header><h3 data-r="title">방</h3><span class="muted small" data-r="sub"></span></header><div data-r="meta"></div></section>
      <section class="box"><header><h3>고른 것</h3></header><div data-r="sel"></div></section>
      <section class="box"><header><h3>가구 더하기</h3></header>
        <div class="seedrow"><select data-r="addSel" aria-label="더할 가구"></select><button type="button" class="btn ghost tiny" data-r="add">+ 더하기</button></div>
        <p class="fx" data-r="addFx">빈 칸(벽 가구는 빈 벽 자리)을 찾아 놓아요.</p></section>
      <section class="box"><header><h3>배치 검사</h3><span class="muted small">게임 테스트와 같은 규칙</span></header><ul class="checks" data-r="probs"></ul></section>
    </div>
  </div>`;
  const $ = k => root.querySelector(`[data-r="${k}"]`);

  /* ---------- 방 고르기 ---------- */
  function pickItems() {
    const rooms = roomSlugs.map(s => ({ slug: s, label: api.interior.rooms.find(r => r.slug === s)?.name ?? s, sub: s.toUpperCase() }));
    const places = [];
    for (const k of PLACE_KINDS.filter(k => !PLACE_PARENT[k])) {
      places.push({ slug: k, label: PLACE_NAME[k] ?? k, sub: specOf(k)?.id ?? '' });
      for (const c of PLACE_KINDS.filter(c => PLACE_PARENT[c] === k)) places.push({ slug: c, label: PLACE_NAME[c] ?? c, sub: `└ ${specOf(c)?.id ?? ''}`, child: true });
      if (k === 'museum') for (const h of HALLS) places.push({ slug: `hall-${h}`, label: `${HALL_ICON[h]} ${HALL_NAME[h]}`, sub: `└ ${specOf(`hall-${h}`)?.id ?? ''}`, child: true });
    }
    return [...rooms, ...places];
  }
  function renderPick() {
    $('pick').innerHTML = pickItems().map(r => {
      const bad = problemsOf(r.slug).length, ch = api.changedIn(preOf(r.slug)), s = specOf(r.slug);
      const sub = isHome(s) ? `${r.sub} · 내 집 ${FLOOR_NAME[s.floorIndex] ?? ''}` : r.sub;
      return `<button type="button" role="tab" class="rp${r.child ? ' child' : ''}" aria-selected="${r.slug === cur}" data-slug="${r.slug}"><span>${esc(s?.name ?? r.label)}</span><small>${esc(sub)}</small>${ch ? '<i class="dot ch" title="바뀜"></i>' : ''}${bad ? '<i class="dot bad" title="검사에 걸림"></i>' : ''}</button>`;
    }).join('');
  }
  $('pick').addEventListener('click', e => { const s = e.target.closest('[data-slug]')?.dataset.slug; if (s) select(s); });
  function select(slug) {
    cur = slug; sel = null;
    const s = specOf(slug);
    phase = s?.phases ? (phase && s.phases[phase] ? phase : Object.keys(s.phases)[0]) : null;
    history.replaceState(null, '', `#rooms.${slug}`); render();
  }

  /* ---------- 매장 (낮/밤) ---------- */
  function renderPhase() {
    const s = specOf(cur), el = $('phase');
    if (!s?.phases) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<span class="small muted">매장:</span> ${[...Object.keys(s.phases), ''].map(p => `<button type="button" class="btn ghost tiny" aria-pressed="${(phase ?? '') === p}" data-ph="${p}">${esc(p ? `${PHASE_KO[p] ?? p}${s.phases[p].name && !(PHASE_KO[p] ?? '').includes(s.phases[p].name) ? ` · ${s.phases[p].name}` : ''}` : '늘 있는 칸만')}</button>`).join(' ')}
      <span class="small muted">${phase ? `늘 있는 가구 + ${esc(PHASE_KO[phase] ?? phase)} 가구 (새 가구는 이 매장에 더해요)` : '두 매장에 같이 놓이는 가구만'}</span>`;
  }
  $('phase').addEventListener('click', e => { const b = e.target.closest('[data-ph]'); if (!b) return; phase = b.dataset.ph || null; sel = null; render(); });

  /* ---------- 그림 ---------- */
  const M = 0.7;   // 벽 가구가 그려지는 바깥 여백 (칸)
  function svgPoint(e) {
    const svg = $('grid').querySelector('svg');
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }
  /** 벽 자리(칸 번호 또는 at 좌표) → 그림 네모 [x, y, w, h] (벽 바깥 여백 안) */
  const wallRect = (wall, at, G, len = 0.8) => (wall === 'n' ? [at - len / 2, -M + 0.08, len, M - 0.16] : wall === 'w' ? [-M + 0.08, at - len / 2, M - 0.16, len] : [G.w + 0.08, at - len / 2, M - 0.16, len]);
  function renderGrid() {
    const spec = specOf(cur);
    if (!spec) { $('grid').innerHTML = '<p class="empty">방 파일이 없어요.</p>'; return; }
    const G = geom(spec), names = furnNames(), ph = phaseOf(spec), view = ph ? phaseSpec(spec, ph) : spec;
    const ens = entries(spec), list = ens.map((en, i) => resolveFurniture(en.e, api.furn, i));
    const bad = new Set(problemsOf(cur).join('\n').split('\n'));
    const badOf = (r) => [...bad].some(p => p.includes(`${r.entry.item ?? r.entry.fu}:`) || p.includes(` ${r.entry.item ?? r.entry.fu} `) || p.endsWith(` ${r.entry.item ?? r.entry.fu} 와 겹쳐요`));
    let s = `<svg viewBox="${-M} ${-M} ${G.w + 2 * M} ${G.d + 2 * M}" role="img" aria-label="${esc(spec.name)} 배치, ${G.w}×${G.d}칸">`;
    s += `<rect x="${-M}" y="${-M}" width="${G.w + 2 * M}" height="${G.d + 2 * M}" class="r-wall"/>`;
    s += `<rect x="0" y="0" width="${G.w}" height="${G.d}" class="r-floor"/>`;
    for (let x = 1; x < G.w; x++) s += `<line x1="${x}" y1="0" x2="${x}" y2="${G.d}" class="r-line"/>`;
    for (let z = 1; z < G.d; z++) s += `<line x1="0" y1="${z}" x2="${G.w}" y2="${z}" class="r-line"/>`;
    if (G.door) s += `<rect x="${G.door.gx0}" y="${G.d - 1}" width="${G.door.gx1 - G.door.gx0 + 1}" height="1" class="r-door"/><text x="${(G.door.gx0 + G.door.gx1 + 1) / 2}" y="${G.d + 0.45}" class="r-lab">${PLACE_PARENT[cur] ? `문 → ${esc(PLACE_NAME[PLACE_PARENT[cur]])} 1층` : G.hall ? '문 → 로비' : '문'}</text>`;
    else s += `<text x="${G.w / 2}" y="${G.d + 0.45}" class="r-lab">(문 없음 — 계단으로 오르내려요)</text>`;
    for (const w of G.windows) { const [side, n] = w.split(':'); if (side === 'n') s += `<rect x="${+n + 0.1}" y="-0.16" width="0.8" height="0.16" class="r-win"/>`; }
    // 보기만: 진열·전시·화석·말 거는 자리 · 관 전시 자리
    for (const st of view.stock ?? []) for (let k = 0; k < (st.count ?? 1); k++) s += `<circle cx="${st.lx + (st.dx ?? 0) * k}" cy="${st.lz + (st.dz ?? 0) * k}" r="0.13" class="r-stock"/>`;
    for (const c of spec.cases ?? []) s += `<rect x="${c.lx0}" y="${c.lz0}" width="${c.lx1 - c.lx0}" height="${c.lz1 - c.lz0}" class="r-case"/>`;
    for (const [x, z] of spec.fossils ?? []) s += `<circle cx="${x}" cy="${z}" r="0.16" class="r-stock"/>`;
    if (G.hall) {
      for (const r of spec.racks ?? []) if (r.kind === 'line') s += `<rect x="${r.x0}" y="${r.z0}" width="${r.x1 - r.x0}" height="${r.z1 - r.z0}" class="r-case"/>`;
      for (const p of hallPlan(spec, hallLists(api.work().items))) s += `<circle cx="${p.lx}" cy="${p.lz}" r="0.08" class="r-slot"/>`;
    }
    if (view.talk) s += `<text x="${view.talk.lx}" y="${view.talk.lz + 0.15}" class="r-emo">💬</text>`;
    // 계단 (내 집 층)
    (spec.fixtures ?? []).forEach((f, n) => {
      const st = api.work().home?.stages?.find(x => x.stage === (f.from ?? 0));
      s += `<g class="r-fix${sel === `fx:${n}` ? ' sel' : ''}" data-i="fx:${n}" tabindex="0" role="button" aria-label="${esc(`${f.kind === 'up' ? '오르는' : '내려가는'} 계단 ${f.slug} (${f.gx}, ${f.gz})`)}">
        <rect x="${f.gx + 0.04}" y="${f.gz + 0.04}" width="${f.w - 0.08}" height="${f.d - 0.08}" rx="0.06"/>
        <text x="${f.gx + f.w / 2}" y="${f.gz + f.d / 2}" class="r-emo">${f.kind === 'up' ? '⬆' : '⬇'}</text>
        <text x="${f.gx + f.w / 2}" y="${f.gz + f.d / 2 + 0.42}" class="r-name">${esc(`${FLOOR_NAME[f.to] ?? f.to}${f.from ? ` · ${st ? st.stage : f.from}단계부터` : ''}`)}</text></g>`;
    });
    list.forEach((r, i) => {
      const e = r.entry, nm = names[e.item]?.emoji ?? (e.fu ? '▦' : '·'), label = names[e.item]?.name ?? e.name ?? e.fu ?? e.item;
      const own = ens[i].src !== 'furniture' && !G.home;   // 이 매장에만 있는 가구
      const cls = `r-furn${i === sel ? ' sel' : ''}${badOf(r) ? ' bad' : ''}${r.layer === 'rug' ? ' rug' : ''}${own ? ' own' : ''}`;
      if (e.wall) {
        const [x, y, w, h] = wallRect(e.wall, e.slot + 0.5, G);
        s += `<g class="${cls}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(label)} (벽 ${e.wall}:${e.slot})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.08" fill="${e.color ?? hashColor(e.item ?? e.fu)}"/><text x="${x + w / 2}" y="${y + h / 2 + 0.14}" class="r-emo">${esc(nm)}</text></g>`;
        return;
      }
      const b = boxOf(r.rec, r.footprint);
      s += `<g class="${cls}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(label)} (${r.rec.gx}, ${r.rec.gz}) 돌림 ${r.rec.rot}${own ? ` · ${PHASE_KO[ph] ?? ''}만` : ''}">
        <rect x="${b.x0 + 0.04}" y="${b.z0 + 0.04}" width="${b.x1 - b.x0 - 0.08}" height="${b.z1 - b.z0 - 0.08}" rx="0.1" fill="${e.color ?? hashColor(e.item ?? e.fu)}"/>
        ${frontMark(b, r.rec.rot)}<text x="${(b.x0 + b.x1) / 2}" y="${(b.z0 + b.z1) / 2 + 0.14}" class="r-emo">${esc(nm)}</text>
        ${(b.x1 - b.x0) >= 2 ? `<text x="${(b.x0 + b.x1) / 2}" y="${(b.z0 + b.z1) / 2 + 0.52}" class="r-name">${esc(label)}</text>` : ''}</g>`;
    });
    // 실내 문 (1층 → 딸린 방) — 그 매장에서 열리는 것만 진하게
    (spec.inner ?? []).forEach((d, n) => {
      const [x, y, w, h] = wallRect(d.wall, d.slot + 0.5, G, 0.9), open = !ph || !d.phase || d.phase === ph;
      const f = innerSpot(spec, d);
      s += `<g class="r-inner${sel === `in:${n}` ? ' sel' : ''}${open ? '' : ' off'}" data-i="in:${n}" tabindex="0" role="button" aria-label="${esc(`실내 문 → ${PLACE_NAME[d.to] ?? d.to} (${WALL_KO[d.wall]} ${d.slot}${d.phase ? `, ${PHASE_KO[d.phase]}` : ''})`)}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.06"/><circle cx="${f.sx}" cy="${f.sz}" r="0.12" class="r-spot"/>
        <text x="${f.sx}" y="${f.sz + 0.42}" class="r-name">${esc(`→ ${PLACE_NAME[d.to] ?? d.to}${d.phase ? ` (${d.phase === 'day' ? '낮' : '밤'})` : ''}`)}</text></g>`;
    });
    // 박물관 로비 관 입구 (halls[]: wall · at 칸 좌표)
    (spec.halls ?? []).forEach((a, n) => {
      const [x, y, w, h] = wallRect(a.wall, a.at, G, 1.3);
      const tx = a.wall === 'n' ? a.at : a.wall === 'w' ? 0.75 : G.w - 0.75, tz = a.wall === 'n' ? 0.55 : a.at;
      s += `<g class="r-inner arch${sel === `arch:${n}` ? ' sel' : ''}" data-i="arch:${n}" tabindex="0" role="button" aria-label="${esc(`관 입구 ${HALL_NAME[a.hall] ?? a.hall} (${WALL_KO[a.wall]} ${a.at})`)}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.2"/><text x="${tx}" y="${tz + 0.14}" class="r-emo">${esc(HALL_ICON[a.hall] ?? '🚪')}</text>
        <text x="${tx}" y="${tz + 0.5}" class="r-name">${esc(HALL_NAME[a.hall] ?? a.hall)}</text></g>`;
    });
    const hk = hostKeyOf(spec), host = hk ? arrAt(spec, hk) : null;
    if (hk && host && !Array.isArray(host)) s += `<g class="r-host${sel === 'host' ? ' sel' : ''}" data-i="host" tabindex="0" role="button" aria-label="${G.place ? '주인' : '주민'} 서는 곳 (${host.lx}, ${host.lz}) ${FACE_KO[host.face] ?? ''}"><circle cx="${host.lx}" cy="${host.lz}" r="0.3"/>${faceMark(host)}</g>`;
    s += '</svg>';
    $('grid').innerHTML = s;
    $('grid').style.setProperty('--ar', `${G.w + 2 * M} / ${G.d + 2 * M}`);
  }
  /** 주인·주민이 서는 곳 칸 (매장에 따로 keeper 가 있으면 그것) */
  function hostKeyOf(spec) {
    const k = kindOf(cur);
    if (k === 'rooms') return spec.host ? 'host' : null;
    if (k === 'halls') return null;
    const ph = phaseOf(spec);
    if (ph && spec.phases[ph].keeper) return `phases/${ph}/keeper`;
    return spec.keeper ? 'keeper' : null;
  }
  const frontMark = (b, rot) => {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const [x, z] = [[cx, b.z1 - 0.12], [b.x1 - 0.12, cz], [cx, b.z0 + 0.12], [b.x0 + 0.12, cz]][rot % 4];
    return `<circle cx="${x}" cy="${z}" r="0.07" class="r-front"/>`;
  };
  const faceMark = h => {
    const a = FACE[h.face] ?? Math.PI;   // 0 = 북쪽(-z)
    const dx = -Math.sin(a) * 0.45, dz = -Math.cos(a) * 0.45;
    return `<line x1="${h.lx}" y1="${h.lz}" x2="${h.lx + dx}" y2="${h.lz + dz}" class="r-face"/>`;
  };
  const selKind = () => (typeof sel === 'number' ? 'furn' : String(sel ?? '').split(':')[0] || null);
  const selN = () => Number(String(sel).split(':')[1]);

  /* ---------- 고른 것 ---------- */
  function renderSel() {
    const spec = specOf(cur), G = geom(spec), names = furnNames(), kind = selKind();
    if (kind === 'host') {
      const h = arrAt(spec, hostKeyOf(spec));
      $('sel').innerHTML = `<p><b>${G.place ? `주인 (${esc(h.slug)})` : '주민'}이 서는 곳</b> · (${h.lx}, ${h.lz})${hostKeyOf(spec).startsWith('phases/') ? ` · ${esc(PHASE_KO[phase])}만` : ''}</p>
        <label class="small">바라보는 쪽 <select data-act="face">${Object.entries(FACE_KO).map(([k, v]) => `<option value="${k}" ${h.face === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <p class="fx">바꾸면: ${G.place ? '가게에 들어가면 주인이 이 자리에서 맞아 줘요 (말 거는 자리 💬 는 Claude 가 반영 때 맞춰요).' : '방에 놀러 가면 주민이 여기 서서 이쪽을 봐요.'}</p>`;
      return;
    }
    if (kind === 'fx') {
      const f = spec.fixtures?.[selN()];
      if (!f) { sel = null; return renderSel(); }
      const stages = api.work().home?.stages ?? [];
      $('sel').innerHTML = `<p><b>${f.kind === 'up' ? '⬆ 오르는' : '⬇ 내려가는'} 계단</b> <span class="muted small">${esc(f.slug)} · ${esc(f.fu ?? '')}</span></p>
        <p class="small">칸 (${f.gx}, ${f.gz}) · ${f.w}×${f.d}칸 · 닿는 층 ${esc(FLOOR_NAME[f.to] ?? f.to)}</p>
        <label class="small">보이는 단계 <select data-act="fxFrom">${stages.map(st => `<option value="${st.stage}" ${(f.from ?? 0) === st.stage ? 'selected' : ''}>${st.stage}단계 「${esc(st.name)}」부터</option>`).join('')}</select></label>
        <p class="fx">화살표로 한 칸씩 옮겨요. 바꾸면: 집을 그 단계까지 넓혔을 때 이 자리에 계단이 놓이고, 밟으면 ${esc(FLOOR_NAME[f.to] ?? '')}으로 가요 (계단 칸에는 가구를 둘 수 없어요).</p>`;
      return;
    }
    if (kind === 'in') {
      const d = spec.inner?.[selN()];
      if (!d) { sel = null; return renderSel(); }
      const max = d.wall === 'n' ? G.w : G.d;
      $('sel').innerHTML = `<p><b>🚪 실내 문 → ${esc(PLACE_NAME[d.to] ?? d.to)}</b> ${d.name && d.name !== PLACE_NAME[d.to] ? ` <span class="muted small">${esc(d.name)}</span>` : ''}</p>
        <div class="seedrow"><label class="small">벽 <select data-act="inWall">${['n', 'w', 'e'].map(w => `<option value="${w}" ${d.wall === w ? 'selected' : ''}>${WALL_KO[w]}</option>`).join('')}</select></label>
          <label class="small">자리 <input type="number" min="0" max="${max - 1}" step="1" value="${d.slot}" data-act="inSlot" class="w-s"></label></div>
        <label class="small">열리는 매장 <select data-act="inPhase"><option value="">늘</option>${['day', 'night'].map(p => `<option value="${p}" ${d.phase === p ? 'selected' : ''}>${PHASE_KO[p]}</option>`).join('')}</select></label>
        <label class="small">이름표 <input type="text" value="${esc(d.name ?? '')}" data-act="inName" class="w-m"></label>
        <div class="seedrow"><button type="button" class="btn ghost tiny" data-act="goTo" data-to="${esc(d.to)}">${esc(PLACE_NAME[d.to] ?? d.to)} 배치 열기</button></div>
        <p class="fx">문을 옮기면 그 벽 자리의 문 모델(벽 가구)도 같이 옮겨요. 바꾸면: ${d.phase ? `${esc(PHASE_KO[d.phase])} 시간에만` : '늘'} 이 문 앞 행동 키로 ${esc(PLACE_NAME[d.to] ?? d.to)}에 들어가요.</p>`;
      return;
    }
    if (kind === 'arch') {
      const a = spec.halls?.[selN()];
      if (!a) { sel = null; return renderSel(); }
      $('sel').innerHTML = `<p><b>${esc(HALL_ICON[a.hall] ?? '')} ${esc(HALL_NAME[a.hall] ?? a.hall)} 입구</b> <span class="muted small">${esc(WALL_KO[a.wall])} · ${a.at}</span></p>
        <div class="seedrow"><label class="small">벽 <select data-act="archWall">${['n', 'w', 'e'].map(w => `<option value="${w}" ${a.wall === w ? 'selected' : ''}>${WALL_KO[w]}</option>`).join('')}</select></label>
          <label class="small">안내판 <select data-act="archSign"><option value="1" ${(a.signSide ?? 1) === 1 ? 'selected' : ''}>오른쪽(+)</option><option value="-1" ${a.signSide === -1 ? 'selected' : ''}>왼쪽(−)</option></select></label></div>
        <div class="seedrow"><button type="button" class="btn ghost tiny" data-act="goTo" data-to="hall-${esc(a.hall)}">${esc(HALL_NAME[a.hall] ?? a.hall)} 배치 열기</button></div>
        <p class="fx">화살표로 0.5칸씩 옮겨요. 바꾸면: 로비의 이 벽에 아치가 서고, 앞에서 행동 키 「${esc(HALL_NAME[a.hall] ?? '')} 들어가기」.</p>`;
      return;
    }
    const en = typeof sel === 'number' ? entries(spec)[sel] : null, e = en?.e;
    if (!e) {
      $('sel').innerHTML = `<p class="empty">그림에서 가구${spec.inner?.length ? '·실내 문' : ''}${spec.halls?.length ? '·관 입구' : ''}${spec.fixtures?.length ? '·계단' : ''}을 누르세요.</p>`;
      return;
    }
    const m = api.furn.models.find(x => (e.item && x.item === e.item) || (e.fu && x.id === e.fu));
    const label = names[e.item]?.name ?? e.name ?? e.fu;
    const variants = m?.variants ?? [];
    const where = G.home ? (en.src === 'starter' ? '처음 가구 (그 층을 지을 때 놓임)' : '') : en.src !== 'furniture' ? `${PHASE_KO[phase] ?? ''}에만` : spec.phases ? '두 매장 모두' : '';
    $('sel').innerHTML = `<p><b>${esc(names[e.item]?.emoji ?? '')} ${esc(label)}</b> <span class="muted small">${esc(e.item ?? e.fu)}${e.role ? ` · ${esc(e.role)}` : ''}${e.deco ? ' · 작은 소품 (낮은 사양에선 안 보임)' : ''}${where ? ` · ${esc(where)}` : ''}</span></p>
      ${e.wall ? `<p class="small">벽 <b>${e.wall}</b> · 자리 ${e.slot}</p>` : `<p class="small">칸 (${e.gx}, ${e.gz}) · 돌림 ${e.rot ?? 0}</p>`}
      <div class="seedrow">${e.wall ? '' : '<button type="button" class="btn ghost tiny" data-act="rot">↻ 돌리기</button>'}
        <button type="button" class="btn ghost tiny" data-act="del">빼기</button>
        ${spec.phases && phase ? `<button type="button" class="btn ghost tiny" data-act="movePhase">${en.src === 'furniture' ? `${esc(PHASE_KO[phase])}로만` : '두 매장 모두로'}</button>` : ''}
        ${variants.length ? `<select data-act="variant" aria-label="색 변형"><option value="">기본 색</option>${variants.map(v => `<option ${e.variant === (v.id ?? v) ? 'selected' : ''} value="${esc(v.id ?? v)}">${esc(v.name ?? v.id ?? v)}</option>`).join('')}</select>` : ''}</div>`;
  }
  $('sel').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'), act = b?.dataset.act;
    if (act === 'rot') rotate();
    if (act === 'del') remove();
    if (act === 'goTo') select(b.dataset.to);
    if (act === 'movePhase') movePhase();
  });
  $('sel').addEventListener('change', e => {
    const act = e.target.dataset.act, spec = specOf(cur), pre = preOf(cur), v = e.target.value;
    if (act === 'face') { const hk = hostKeyOf(spec); api.set(`${pre}/${hk}`, { ...arrAt(spec, hk), face: v }); after(); }
    if (act === 'variant') { editEntry(sel, it => { if (v) it.variant = v; else delete it.variant; }); after(); }
    if (act === 'fxFrom') { const arr = structuredClone(spec.fixtures); if (+v) arr[selN()].from = +v; else delete arr[selN()].from; api.set(`${pre}/fixtures`, arr); after(); }
    if (act === 'inWall' || act === 'inSlot') {
      const d = spec.inner[selN()], G = geom(spec), wall = act === 'inWall' ? v : d.wall;
      const max = wall === 'n' ? G.w : G.d, slot = Math.min(max - 1, Math.max(0, act === 'inSlot' ? Math.round(+v) || 0 : d.slot));
      moveInner(selN(), wall, slot);
    }
    if (act === 'inPhase' || act === 'inName') {
      const arr = structuredClone(spec.inner), d = arr[selN()];
      if (act === 'inPhase') { if (v) d.phase = v; else delete d.phase; } else if (v.trim()) d.name = v.trim(); else { e.target.value = d.name ?? ''; return; }
      api.set(`${pre}/inner`, arr); after();
    }
    if (act === 'archWall' || act === 'archSign') {
      const arr = structuredClone(spec.halls), a = arr[selN()], G = geom(spec);
      if (act === 'archWall') { a.wall = v; a.at = Math.min((v === 'n' ? G.w : G.d) - 1, Math.max(1, a.at)); } else a.signSide = +v;
      api.set(`${pre}/halls`, arr); after();
    }
  });
  /** 실내 문을 옮기고, 그 벽 자리의 문 모델(벽 가구)도 같이 옮긴다 */
  function moveInner(n, wall, slot) {
    const spec = specOf(cur), inner = structuredClone(spec.inner), d = inner[n];
    if (d.wall === wall && d.slot === slot) return;
    for (const src of ['furniture', ...Object.keys(spec.phases ?? {}).map(p => `phases/${p}/furniture`)]) {
      const arr = structuredClone(arrAt(spec, src));
      const k = arr.findIndex(e => e.wall === d.wall && e.slot === d.slot);
      if (k >= 0) { arr[k].wall = wall; arr[k].slot = slot; setArr(src, arr); break; }
    }
    Object.assign(d, { wall, slot });
    api.set(`${preOf(cur)}/inner`, inner); after();
  }
  function movePhase() {
    const spec = specOf(cur), en = entries(spec)[sel];
    if (!en || !phase) return;
    const to = en.src === 'furniture' ? `phases/${phase}/furniture` : 'furniture';
    const from = structuredClone(arrAt(spec, en.src)), dst = structuredClone(arrAt(spec, to));
    const [it] = from.splice(en.i, 1);
    dst.push(it);
    setArr(en.src, from); setArr(to, dst);
    sel = entries().findIndex(x => x.src === to && x.i === dst.length - 1);
    after();
  }
  function rotate() {
    if (typeof sel !== 'number') return;
    const G = geom(specOf(cur));
    editEntry(sel, (it, arr, i) => {
      if (!it || it.wall) return false;
      const r = resolveFurniture(it, api.furn, i);
      const [w, d] = dims(r.footprint, ((it.rot ?? 0) + 1) % 4);
      it.rot = ((it.rot ?? 0) + 1) % 4;
      it.gx = Math.min(it.gx, G.w - w); it.gz = Math.min(it.gz, G.d - d);
    }) && after();
  }
  function remove() {
    if (typeof sel !== 'number') return;
    editEntry(sel, (it, arr, i) => { arr.splice(i, 1); });
    sel = null; after();
  }
  function moveBy(dx, dz) {
    const spec = specOf(cur), G = geom(spec), pre = preOf(cur), kind = selKind();
    if (kind === 'host') {
      const hk = hostKeyOf(spec), h = { ...arrAt(spec, hk) };
      h.lx = Math.min(G.w - 0.5, Math.max(0.5, h.lx + dx * 0.5)); h.lz = Math.min(G.d - 0.5, Math.max(0.5, h.lz + dz * 0.5));
      api.set(`${pre}/${hk}`, h); after(); return;
    }
    if (kind === 'fx') {
      const arr = structuredClone(spec.fixtures), f = arr[selN()];
      f.gx = Math.min(G.w - f.w, Math.max(0, f.gx + dx)); f.gz = Math.min(G.d - f.d, Math.max(0, f.gz + dz));
      api.set(`${pre}/fixtures`, arr); after(); return;
    }
    if (kind === 'in') {
      const d = spec.inner[selN()], max = d.wall === 'n' ? G.w : G.d;
      moveInner(selN(), d.wall, Math.min(max - 1, Math.max(0, d.slot + (d.wall === 'n' ? dx : dz)))); return;
    }
    if (kind === 'arch') {
      const arr = structuredClone(spec.halls), a = arr[selN()], max = a.wall === 'n' ? G.w : G.d;
      a.at = Math.min(max - 1, Math.max(1, a.at + (a.wall === 'n' ? dx : dz) * 0.5));
      api.set(`${pre}/halls`, arr); after(); return;
    }
    editEntry(sel, (it, arr, i) => {
      if (!it) return false;
      if (it.wall) { const max = it.wall === 'n' ? G.w : G.d; it.slot = Math.min(max - 1, Math.max(0, it.slot + (it.wall === 'n' ? dx : dz))); }
      else {
        const r = resolveFurniture(it, api.furn, i), [w, d] = dims(r.footprint, it.rot ?? 0);
        it.gx = Math.min(G.w - w, Math.max(0, it.gx + dx)); it.gz = Math.min(G.d - d, Math.max(0, it.gz + dz));
      }
    }) && after();
  }

  /* ---------- 끌기 ---------- */
  $('grid').addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-i]');
    if (!g) { sel = null; renderGrid(); renderSel(); return; }
    e.preventDefault();
    const id = g.dataset.i;
    sel = /^\d+$/.test(id) ? +id : id;
    const [x, z] = svgPoint(e), spec = specOf(cur);
    const en = typeof sel === 'number' ? entries(spec)[sel] : null;
    drag = { id: e.pointerId, x, z, moved: false, entry: en ? structuredClone(en.e) : null, host: selKind() === 'host' ? structuredClone(arrAt(spec, hostKeyOf(spec))) : null,
      fx: selKind() === 'fx' ? structuredClone(spec.fixtures[selN()]) : null };
    try { $('grid').setPointerCapture(e.pointerId); } catch {}
    renderGrid(); renderSel();
    $('grid').querySelector(`[data-i="${sel}"]`)?.focus({ preventScroll: true });
  });
  $('grid').addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const [x, z] = svgPoint(e), spec = specOf(cur), G = geom(spec), pre = preOf(cur);
    if (selKind() === 'host') {
      const hk = hostKeyOf(spec), now = arrAt(spec, hk);
      const h = { ...drag.host, lx: Math.round(Math.min(G.w - 0.5, Math.max(0.5, x)) * 2) / 2, lz: Math.round(Math.min(G.d - 0.5, Math.max(0.5, z)) * 2) / 2 };
      if (h.lx === now.lx && h.lz === now.lz) return;
      api.set(`${pre}/${hk}`, h); drag.moved = true; renderGrid(); return;
    }
    if (selKind() === 'fx') {
      const arr = structuredClone(spec.fixtures), f = arr[selN()];
      const gx = Math.min(G.w - f.w, Math.max(0, Math.round(drag.fx.gx + (x - drag.x)))), gz = Math.min(G.d - f.d, Math.max(0, Math.round(drag.fx.gz + (z - drag.z))));
      if (gx === f.gx && gz === f.gz) return;
      Object.assign(f, { gx, gz }); api.set(`${pre}/fixtures`, arr); drag.moved = true; renderGrid(); return;
    }
    if (typeof sel !== 'number' || !drag.entry) return;   // 실내 문·관 입구는 화살표·칸으로
    const start = drag.entry, r = resolveFurniture(start, api.furn, sel);
    let next = structuredClone(start);
    if (r.place === 'wall' || r.place === 'window' || start.wall) {
      // 가까운 벽: 북쪽(z<0.6) · 서쪽(x<1) · 동쪽(x>w-1), 그 밖엔 북쪽
      const wall = x < 0.6 && z > 0.4 ? 'w' : x > G.w - 0.6 && z > 0.4 ? 'e' : 'n';
      const max = wall === 'n' ? G.w : G.d;
      const slot = Math.min(max - 1, Math.max(0, Math.floor(wall === 'n' ? x : z)));
      Object.assign(next, { wall, slot }); delete next.gx; delete next.gz; delete next.rot;
    } else {
      const [w, d] = dims(r.footprint, start.rot ?? 0);
      next.gx = Math.min(G.w - w, Math.max(0, Math.round(start.gx + (x - drag.x))));
      next.gz = Math.min(G.d - d, Math.max(0, Math.round(start.gz + (z - drag.z))));
    }
    const now = entries(spec)[sel]?.e;
    if (now && now.gx === next.gx && now.gz === next.gz && now.wall === next.wall && now.slot === next.slot) return;
    editEntry(sel, (it, arr, i) => { arr[i] = next; });
    drag.moved = true; renderGrid();
  });
  const endDrag = e => { if (!drag || e.pointerId !== drag.id) return; const moved = drag.moved; drag = null; if (moved) after(); };
  $('grid').addEventListener('pointerup', endDrag);
  $('grid').addEventListener('pointercancel', endDrag);
  $('grid').addEventListener('keydown', e => {
    if (sel == null) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) { e.preventDefault(); moveBy(...d); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rotate(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
  });

  /* ---------- 더하기 ---------- */
  function renderAdd() {
    const names = furnNames();
    $('addSel').innerHTML = api.furn.models.filter(m => m.item).map(m => `<option value="${esc(m.item)}">${esc(`${names[m.item]?.emoji ?? ''} ${m.name ?? m.item}`)}${m.place !== 'floor' ? ` (${m.place === 'wall' ? '벽' : '창문'})` : ''}</option>`).join('');
  }
  $('add').onclick = () => {
    const item = $('addSel').value, m = api.furn.models.find(x => x.item === item);
    if (!m) return;
    const spec = specOf(cur), G = geom(spec), srcs = srcsOf(spec), src = srcs[srcs.length - 1];
    const arr = structuredClone(arrAt(spec, src));
    const list = entries(spec).map((en, i) => resolveFurniture(en.e, api.furn, i));
    if (m.place === 'wall' || m.place === 'window') {
      const used = new Set([...list.filter(r => r.rec.wall).map(r => `${r.rec.wall}:${r.rec.slot}`), ...(spec.inner ?? []).map(d => `${d.wall}:${d.slot}`)]);
      const spots = [...Array(G.w).keys()].map(n => `n:${n}`).concat([...Array(G.d - 1).keys()].flatMap(n => [`w:${n}`, `e:${n}`]));
      const ok = spots.find(k => !used.has(k) && (m.place === 'window' ? G.windows.includes(k) : !G.windows.includes(k)));
      if (!ok) return;
      const [wall, slot] = ok.split(':');
      arr.push({ item, wall, slot: +slot });
    } else {
      const info = it => { const r = list.find(x => x.key === it) ?? resolveFurniture({ item }, api.furn); return { footprint: r.footprint, layer: r.layer }; };
      const placed = list.filter(r => !r.rec.wall).map(r => r.rec);
      const reserved = new Set(G.door ? [`${G.door.gx0},${G.d - 1}`, `${G.door.gx1},${G.d - 1}`] : []);
      for (const f of spec.fixtures ?? []) { const b = fixtureBox(f); for (let x = b.x0; x < b.x1; x++) for (let z = b.z0; z < b.z1; z++) reserved.add(`${x},${z}`); }
      let spot = null;
      for (let gz = 0; gz < G.d && !spot; gz++) for (let gx = 0; gx < G.w && !spot; gx++) {
        const rec = { id: 'new', item, gx, gz, rot: 0 };
        if (fits(placed, rec, info, { reserved, w: G.w, d: G.d })) spot = { gx, gz };
      }
      if (!spot) return;
      arr.push({ item, gx: spot.gx, gz: spot.gz, rot: 0 });
    }
    setArr(src, arr);
    sel = entries().findIndex(x => x.src === src && x.i === arr.length - 1);
    after();
  };

  /* ---------- 방 정보 ---------- */
  function renderMeta() {
    const spec = specOf(cur), G = geom(spec), k = kindOf(cur);
    const wps = (api.interior.models ?? []).filter(m => m.kind === 'wallpaper'), fls = (api.interior.models ?? []).filter(m => m.kind === 'floor');
    $('title').textContent = spec.name;
    $('sub').textContent = `${spec.id ?? cur} · ${G.w}×${G.d}칸 · v${baseSpecOf(cur)?.version ?? 0}${spec.status ? ` · ${spec.status}` : ''}`;
    const pre = preOf(cur);
    const info = [];
    if (G.home) {
      const st = (api.work().home?.stages ?? []).find(x => x.room === cur);
      info.push(`🏠 <b>내 집 ${esc(FLOOR_NAME[spec.floorIndex] ?? '')}</b>${st ? ` — 증축 ${st.stage}단계 「${esc(st.name)}」 · 도토리 ${Number(st.cost ?? 0).toLocaleString('ko-KR')} (값은 표 「집·별점·일지 → 집 증축」)` : ''}`);
      if (spec.fixtures?.length) info.push(`계단 ${spec.fixtures.length}: ${spec.fixtures.map(f => `${f.kind === 'up' ? '⬆' : '⬇'} ${esc(FLOOR_NAME[f.to] ?? f.to)}${f.from ? ` (${f.from}단계부터)` : ''}`).join(' · ')}`);
      info.push(`처음 가구 ${(spec.starter ?? []).length}개 — 그 층이 다 지어진 아침에 놓여요`);
    }
    if (PLACE_PARENT[cur]) {
      const door = (specOf(PLACE_PARENT[cur])?.inner ?? []).find(d => d.to === cur);
      info.push(`↳ <b>딸린 방</b> — ${esc(PLACE_NAME[PLACE_PARENT[cur]])} 1층 ${door ? `${esc(WALL_KO[door.wall])} 실내 문(「${esc(door.name ?? '')}」)` : '실내 문'}으로 드나들어요${spec.phase ? ` (${esc(PHASE_KO[spec.phase])} 시간에만)` : ''}. 주인·계산대 없이 진열품 앞 「보기」로 사요. <button type="button" class="btn ghost tiny" data-go="${esc(PLACE_PARENT[cur])}">1층 열기</button>`);
    }
    if (spec.inner?.length) info.push(`🚪 실내 문 ${spec.inner.length}: ${spec.inner.map(d => `<button type="button" class="btn ghost tiny" data-go="${esc(d.to)}">→ ${esc(PLACE_NAME[d.to] ?? d.to)}${d.phase ? ` (${d.phase === 'day' ? '낮' : '밤'})` : ''}</button>`).join(' ')}`);
    if (spec.phases) info.push(`매장 ${Object.keys(spec.phases).length}: ${Object.entries(spec.phases).map(([p, P]) => `${esc(PHASE_KO[p] ?? p)} 가구 ${(P.furniture ?? []).length} · 진열 줄 ${(P.stock ?? []).length}${P.note ? ` — ${esc(P.note)}` : ''}`).join(' / ')}`);
    if (spec.halls?.length) info.push(`🏛 관 입구 ${spec.halls.length}: ${spec.halls.map(a => `<button type="button" class="btn ghost tiny" data-go="hall-${esc(a.hall)}">${esc(HALL_ICON[a.hall] ?? '')} ${esc(HALL_NAME[a.hall] ?? a.hall)}</button>`).join(' ')}`);
    if (G.hall) {
      const lists = hallLists(api.work().items), n = (spec.cats ?? []).reduce((s, c) => s + (lists[c]?.length ?? 0), 0);
      info.push(`${esc(HALL_ICON[spec.hall] ?? '')} 박물관 관 — 전시 ${(spec.cats ?? []).map(c => esc(c)).join('·')} ${spec.hall === 'star' ? '별자리 12' : `${n}점`} (작은 점 = 전시 자리) · <button type="button" class="btn ghost tiny" data-go="museum">로비 열기</button>`);
      if (spec.intro) info.push(`안내판: “${esc(spec.intro)}”`);
    }
    $('meta').innerHTML = `${info.map(t => `<p class="small">${t}</p>`).join('')}
      ${G.place ? '' : `<label class="small">방 이름 <input type="text" data-m="name" value="${esc(spec.name)}" class="w-m"></label>`}
      <label class="small">벽지 <select data-m="wallpaper">${wps.map(m => `<option value="${m.slug}" ${spec.wallpaper === m.slug ? 'selected' : ''}>${esc(`${m.id} ${m.name}`)}</option>`).join('')}</select></label>
      <label class="small">바닥 <select data-m="floor">${fls.map(m => `<option value="${m.slug}" ${spec.floor === m.slug ? 'selected' : ''}>${esc(`${m.id} ${m.name}`)}</option>`).join('')}</select></label>
      <p class="fx">바꾸면: ${G.home ? '집을 그 단계까지 넓히면 이 층이 이 벽지·바닥·처음 가구로 지어져요 (이미 지은 층은 저장된 대로).' : G.hall ? '박물관 로비에서 이 관에 들어가면 이대로 보여요.' : G.place ? `${esc(PLACE_NAME[cur] ?? spec.name)}에 들어갔을 때 가구·벽지·바닥이 이대로 놓여요.` : `${esc(spec.ownerName ?? '')} 집에 놀러 가면 이 방이 보여요.`}${api.changedIn(pre) ? ' <b>· 반영 뒤 바뀜</b>' : ''}</p>`;
  }
  $('meta').addEventListener('click', e => { const g = e.target.closest('[data-go]')?.dataset.go; if (g) select(g); });
  $('meta').addEventListener('change', e => {
    const k = e.target.dataset.m;
    if (!k) return;
    const v = e.target.value.trim();
    if (k === 'name' && !v) { e.target.value = specOf(cur).name; return; }
    api.set(`${preOf(cur)}/${k}`, v); after();
  });

  function renderProbs() {
    const p = problemsOf(cur);
    $('probs').innerHTML = p.length ? p.map(t => `<li class="bad"><span class="mark">!</span><span>${esc(t)}</span></li>`).join('') : '<li class="ok"><span class="mark">✓</span><span>문제없어요</span></li>';
    $('addFx').textContent = `빈 칸(벽 가구는 빈 벽 자리)을 찾아 놓아요${specOf(cur)?.phases && phase ? ` — ${PHASE_KO[phase]}에만` : isHome(specOf(cur)) ? ' — 처음 가구로' : ''}.`;
  }
  function after() { render(); api.onChange(); }
  function render() {
    if (!visible) return;
    if (!specOf(cur)) cur = roomSlugs[0];
    const s = specOf(cur);
    if (s?.phases && phase && !s.phases[phase]) phase = null;
    renderPick(); renderPhase(); renderGrid(); renderSel(); renderMeta(); renderProbs();
  }
  renderAdd();
  if (specOf(cur)?.phases) phase = Object.keys(specOf(cur).phases)[0];
  return {
    show(slug) { visible = true; if (slug && specOf(slug) && slug !== cur) { select(slug); return; } render(); },
    hide() { visible = false; },
    refresh() { if (!drag) render(); },
    checks: () => allSlugs().map(s => { const p = problemsOf(s); return [!p.length, `${specOf(s)?.name ?? s} 배치`, p.slice(0, 2).join(' · ') + (p.length > 2 ? ` 외 ${p.length - 2}` : ''), s]; }),
    current: () => cur,
  };
}
