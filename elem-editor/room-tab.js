// 요소 편집기 「방 배치」 탭 — 주민 방(assets/interior/rooms/rm-0N.json)과 상점·박물관·달빛 가게·새벽 천막(assets/interior/places/<slug>.json)의
// 가구 자리를 위에서 본 칸 그림으로 옮긴다. 배치 검사는 게임 코드 그대로: 주민 방 interior.js checkRoom, 가게 placedata.js checkPlace.
// (예전 배경 편집기 「방 배치」 탭의 2D 부분 — 3D 보기·모델은 리소스 편집기 몫.) 바뀐 칸: rooms/<slug>/furniture · host · name · wallpaper · floor,
// places/<slug>/furniture · keeper (furniture 는 배열 통째로).
import { checkRoom, resolveFurniture, FACE } from '../src/gameplay/house/interior.js';
import { checkPlace, PLACE_KINDS } from '../src/gameplay/house/placedata.js';
import { boxOf, fits, dims } from '../src/gameplay/house/grid.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROOM_WINDOWS = ['n:1', 'n:6'];                 // src/gameplay/house/room.js WINDOWS (주민 방)
const ROOM_DOOR = { gx0: 3, gx1: 4 };
const PLACE_NAME = { shop: '도토리상점', museum: '박물관', moonshop: '달빛 가게', tent: '새벽 천막' };
const FACE_KO = { n: '북쪽(안쪽 벽)', e: '동쪽', s: '남쪽(문 쪽)', w: '서쪽' };
const COLORS = ['#E8B27A', '#9CC48A', '#8DB6D9', '#D9A0B8', '#C9B27A', '#A7A0D9', '#E59A7A', '#86C2B4'];
const hashColor = s => COLORS[[...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

/**
 * api = { work(): { rooms, places, items }, base(): 같은 모양 (반영된 파일), set(path, v), onChange(), furn: { models }, interior: interior/index.json }
 * → { show(slug?), hide(), refresh(), checks(): [[ok, label, why, slug]], select(slug) }
 */
export function createRoomTab(root, api) {
  const roomSlugs = (api.interior.rooms ?? []).map(r => r.slug);
  let cur = location.hash.match(/^#rooms\.([\w-]+)/)?.[1] ?? roomSlugs[0];
  let selIdx = null, drag = null, visible = false;
  const kindOf = slug => (PLACE_KINDS.includes(slug) ? 'places' : 'rooms');
  const specOf = slug => api.work()[kindOf(slug)]?.[slug];
  const baseSpecOf = slug => api.base()[kindOf(slug)]?.[slug];
  const furnNames = () => {
    const out = {};
    for (const f of api.work().items.furniture ?? []) out[`furn.${f.slug}`] = { name: f.name, emoji: f.emoji };
    return out;
  };
  const geom = spec => {
    const place = kindOf(spec.slug ?? '') === 'places' || spec.kind === 'place';
    return { w: place ? spec.size?.[0] ?? 8 : 8, d: place ? spec.size?.[1] ?? 8 : 8, windows: place ? spec.windows ?? [] : ROOM_WINDOWS, door: place ? spec.door ?? ROOM_DOOR : ROOM_DOOR, place };
  };
  const problemsOf = slug => {
    const s = specOf(slug);
    if (!s) return ['방 파일이 없어요'];
    return kindOf(slug) === 'places' ? checkPlace(s, api.furn) : checkRoom(s, api.furn, { windows: new Set(ROOM_WINDOWS) });
  };

  root.innerHTML = `
  <div class="roomwork">
    <div class="roomcol">
      <div class="roompick" role="tablist" aria-label="방 고르기" data-r="pick"></div>
      <div class="roomgrid" data-r="grid"></div>
      <p class="small muted">끌어 옮기기 (칸에 맞춤) · 누르고 R = 돌리기 · Delete = 빼기 · 화살표 = 한 칸. 벽 가구는 가까운 벽 자리로 붙어요. 점선은 진열·전시 자리(보기만), 동그라미는 주인·주민이 서는 곳.</p>
    </div>
    <div class="roomside">
      <section class="box"><header><h3 data-r="title">방</h3><span class="muted small" data-r="sub"></span></header><div data-r="meta"></div></section>
      <section class="box"><header><h3>고른 가구</h3></header><div data-r="sel"></div></section>
      <section class="box"><header><h3>가구 더하기</h3></header>
        <div class="seedrow"><select data-r="addSel" aria-label="더할 가구"></select><button type="button" class="btn ghost tiny" data-r="add">+ 더하기</button></div>
        <p class="fx">빈 칸(벽 가구는 빈 벽 자리)을 찾아 놓아요.</p></section>
      <section class="box"><header><h3>배치 검사</h3><span class="muted small">게임 테스트와 같은 규칙</span></header><ul class="checks" data-r="probs"></ul></section>
    </div>
  </div>`;
  const $ = k => root.querySelector(`[data-r="${k}"]`);

  function setFurniture(arr) { api.set(`${kindOf(cur)}/${cur}/furniture`, arr); }
  const furniture = () => structuredClone(specOf(cur)?.furniture ?? []);

  function renderPick() {
    const items = [...roomSlugs.map(s => ({ slug: s, label: `${api.interior.rooms.find(r => r.slug === s)?.name ?? s}` , sub: s.toUpperCase() })),
      ...PLACE_KINDS.map(k => ({ slug: k, label: PLACE_NAME[k] ?? k, sub: specOf(k)?.id ?? '' }))];
    $('pick').innerHTML = items.map(r => {
      const bad = problemsOf(r.slug).length, ch = api.changedIn(`${kindOf(r.slug)}/${r.slug}`);
      return `<button type="button" role="tab" class="rp" aria-selected="${r.slug === cur}" data-slug="${r.slug}"><span>${esc(specOf(r.slug)?.name ?? r.label)}</span><small>${esc(r.sub)}</small>${ch ? '<i class="dot ch" title="바뀜"></i>' : ''}${bad ? '<i class="dot bad" title="검사에 걸림"></i>' : ''}</button>`;
    }).join('');
  }
  $('pick').addEventListener('click', e => { const s = e.target.closest('[data-slug]')?.dataset.slug; if (s) select(s); });
  function select(slug) { cur = slug; selIdx = null; history.replaceState(null, '', `#rooms.${slug}`); render(); }

  /* ---------- 그림 ---------- */
  const M = 0.7;   // 벽 가구가 그려지는 바깥 여백 (칸)
  function svgPoint(e) {
    const svg = $('grid').querySelector('svg');
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }
  function renderGrid() {
    const spec = specOf(cur);
    if (!spec) { $('grid').innerHTML = '<p class="empty">방 파일이 없어요.</p>'; return; }
    const G = geom({ ...spec, slug: cur }), names = furnNames();
    const list = (spec.furniture ?? []).map((e, i) => resolveFurniture(e, api.furn, i));
    const bad = new Set(problemsOf(cur).join('\n').split('\n'));
    const badOf = (r) => [...bad].some(p => p.startsWith(`${r.entry.item ?? r.entry.fu}:`) || p.includes(` ${r.entry.item ?? r.entry.fu} `) || p.endsWith(` ${r.entry.item ?? r.entry.fu} 와 겹쳐요`));
    let s = `<svg viewBox="${-M} ${-M} ${G.w + 2 * M} ${G.d + 2 * M}" role="img" aria-label="${esc(spec.name)} 배치, ${G.w}×${G.d}칸">`;
    s += `<rect x="${-M}" y="${-M}" width="${G.w + 2 * M}" height="${G.d + 2 * M}" class="r-wall"/>`;
    s += `<rect x="0" y="0" width="${G.w}" height="${G.d}" class="r-floor"/>`;
    for (let x = 1; x < G.w; x++) s += `<line x1="${x}" y1="0" x2="${x}" y2="${G.d}" class="r-line"/>`;
    for (let z = 1; z < G.d; z++) s += `<line x1="0" y1="${z}" x2="${G.w}" y2="${z}" class="r-line"/>`;
    s += `<rect x="${G.door.gx0}" y="${G.d - 1}" width="${G.door.gx1 - G.door.gx0 + 1}" height="1" class="r-door"/><text x="${(G.door.gx0 + G.door.gx1 + 1) / 2}" y="${G.d + 0.45}" class="r-lab">문</text>`;
    for (const w of G.windows) { const [side, n] = w.split(':'); if (side === 'n') s += `<rect x="${+n + 0.1}" y="-0.16" width="0.8" height="0.16" class="r-win"/>`; }
    // 보기만: 진열·전시·화석·말 거는 자리
    for (const st of spec.stock ?? []) for (let k = 0; k < (st.count ?? 1); k++) s += `<circle cx="${st.lx}" cy="${st.lz + (st.dz ?? 0) * k}" r="0.13" class="r-stock"/>`;
    for (const c of spec.cases ?? []) s += `<rect x="${c.lx0}" y="${c.lz0}" width="${c.lx1 - c.lx0}" height="${c.lz1 - c.lz0}" class="r-case"/>`;
    for (const [x, z] of spec.fossils ?? []) s += `<circle cx="${x}" cy="${z}" r="0.16" class="r-stock"/>`;
    if (spec.talk) s += `<text x="${spec.talk.lx}" y="${spec.talk.lz + 0.15}" class="r-emo">💬</text>`;
    list.forEach((r, i) => {
      const e = r.entry, nm = names[e.item]?.emoji ?? (e.fu ? '▦' : '·'), label = names[e.item]?.name ?? e.name ?? e.fu ?? e.item;
      const cls = `r-furn${i === selIdx ? ' sel' : ''}${badOf(r) ? ' bad' : ''}${r.layer === 'rug' ? ' rug' : ''}`;
      if (e.wall) {
        const slot = e.slot;
        const [x, y, w, h] = e.wall === 'n' ? [slot + 0.1, -M + 0.08, 0.8, M - 0.16] : e.wall === 'w' ? [-M + 0.08, slot + 0.1, M - 0.16, 0.8] : [G.w + 0.08, slot + 0.1, M - 0.16, 0.8];
        s += `<g class="${cls}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(label)} (벽 ${e.wall}:${slot})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.08" fill="${e.color ?? hashColor(e.item ?? e.fu)}"/><text x="${x + w / 2}" y="${y + h / 2 + 0.14}" class="r-emo">${esc(nm)}</text></g>`;
        return;
      }
      const b = boxOf(r.rec, r.footprint);
      s += `<g class="${cls}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(label)} (${r.rec.gx}, ${r.rec.gz}) 돌림 ${r.rec.rot}">
        <rect x="${b.x0 + 0.04}" y="${b.z0 + 0.04}" width="${b.x1 - b.x0 - 0.08}" height="${b.z1 - b.z0 - 0.08}" rx="0.1" fill="${e.color ?? hashColor(e.item ?? e.fu)}"/>
        ${frontMark(b, r.rec.rot)}<text x="${(b.x0 + b.x1) / 2}" y="${(b.z0 + b.z1) / 2 + 0.14}" class="r-emo">${esc(nm)}</text>
        ${(b.x1 - b.x0) >= 2 ? `<text x="${(b.x0 + b.x1) / 2}" y="${(b.z0 + b.z1) / 2 + 0.52}" class="r-name">${esc(label)}</text>` : ''}</g>`;
    });
    const host = G.place ? spec.keeper : spec.host;
    if (host) s += `<g class="r-host${selIdx === 'host' ? ' sel' : ''}" data-i="host" tabindex="0" role="button" aria-label="${G.place ? '주인' : '주민'} 서는 곳 (${host.lx}, ${host.lz}) ${FACE_KO[host.face] ?? ''}"><circle cx="${host.lx}" cy="${host.lz}" r="0.3"/>${faceMark(host)}</g>`;
    s += '</svg>';
    $('grid').innerHTML = s;
    $('grid').style.setProperty('--ar', `${G.w + 2 * M} / ${G.d + 2 * M}`);
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

  /* ---------- 고른 가구 ---------- */
  function renderSel() {
    const spec = specOf(cur), G = geom({ ...spec, slug: cur }), names = furnNames();
    if (selIdx === 'host') {
      const h = G.place ? spec.keeper : spec.host;
      $('sel').innerHTML = `<p><b>${G.place ? `주인 (${esc(h.slug)})` : '주민'}이 서는 곳</b> · (${h.lx}, ${h.lz})</p>
        <label class="small">바라보는 쪽 <select data-act="face">${Object.entries(FACE_KO).map(([k, v]) => `<option value="${k}" ${h.face === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <p class="fx">바꾸면: ${G.place ? '가게에 들어가면 주인이 이 자리에서 맞아 줘요 (말 거는 자리 💬 는 Claude 가 반영 때 맞춰요).' : '방에 놀러 가면 주민이 여기 서서 이쪽을 봐요.'}</p>`;
      return;
    }
    const e = selIdx != null ? spec.furniture?.[selIdx] : null;
    if (!e) { $('sel').innerHTML = '<p class="empty">그림에서 가구를 누르세요.</p>'; return; }
    const m = api.furn.models.find(x => (e.item && x.item === e.item) || (e.fu && x.id === e.fu));
    const label = names[e.item]?.name ?? e.name ?? e.fu;
    const variants = m?.variants ?? [];
    $('sel').innerHTML = `<p><b>${esc(names[e.item]?.emoji ?? '')} ${esc(label)}</b> <span class="muted small">${esc(e.item ?? e.fu)}${e.role ? ` · ${esc(e.role)}` : ''}${e.deco ? ' · 작은 소품 (낮은 사양에선 안 보임)' : ''}</span></p>
      ${e.wall ? `<p class="small">벽 <b>${e.wall}</b> · 자리 ${e.slot}</p>` : `<p class="small">칸 (${e.gx}, ${e.gz}) · 돌림 ${e.rot ?? 0}</p>`}
      <div class="seedrow">${e.wall ? '' : '<button type="button" class="btn ghost tiny" data-act="rot">↻ 돌리기</button>'}
        <button type="button" class="btn ghost tiny" data-act="del">빼기</button>
        ${variants.length ? `<select data-act="variant" aria-label="색 변형"><option value="">기본 색</option>${variants.map(v => `<option ${e.variant === (v.id ?? v) ? 'selected' : ''} value="${esc(v.id ?? v)}">${esc(v.name ?? v.id ?? v)}</option>`).join('')}</select>` : ''}</div>`;
  }
  $('sel').addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'rot') rotate();
    if (act === 'del') remove();
  });
  $('sel').addEventListener('change', e => {
    const act = e.target.dataset.act;
    if (act === 'face') {
      const G = geom({ ...specOf(cur), slug: cur }), key = G.place ? 'keeper' : 'host';
      api.set(`${kindOf(cur)}/${cur}/${key}`, { ...specOf(cur)[key], face: e.target.value }); after();
    }
    if (act === 'variant') {
      const arr = furniture(); const it = arr[selIdx];
      if (e.target.value) it.variant = e.target.value; else delete it.variant;
      setFurniture(arr); after();
    }
  });
  function rotate() {
    const arr = furniture(), it = arr[selIdx];
    if (!it || it.wall) return;
    const r = resolveFurniture(it, api.furn, selIdx);
    const [w, d] = dims(r.footprint, ((it.rot ?? 0) + 1) % 4), G = geom({ ...specOf(cur), slug: cur });
    it.rot = ((it.rot ?? 0) + 1) % 4;
    it.gx = Math.min(it.gx, G.w - w); it.gz = Math.min(it.gz, G.d - d);
    setFurniture(arr); after();
  }
  function remove() {
    const arr = furniture();
    if (selIdx == null || selIdx === 'host') return;
    arr.splice(selIdx, 1); selIdx = null;
    setFurniture(arr); after();
  }
  function moveBy(dx, dz) {
    const arr = furniture(), it = arr[selIdx], G = geom({ ...specOf(cur), slug: cur });
    if (selIdx === 'host') {
      const key = G.place ? 'keeper' : 'host', h = { ...specOf(cur)[key] };
      h.lx = Math.min(G.w - 0.5, Math.max(0.5, h.lx + dx * 0.5)); h.lz = Math.min(G.d - 0.5, Math.max(0.5, h.lz + dz * 0.5));
      api.set(`${kindOf(cur)}/${cur}/${key}`, h); after(); return;
    }
    if (!it) return;
    if (it.wall) { const max = it.wall === 'n' ? G.w : G.d; it.slot = Math.min(max - 1, Math.max(0, it.slot + (it.wall === 'n' ? dx : dz))); }
    else {
      const r = resolveFurniture(it, api.furn, selIdx), [w, d] = dims(r.footprint, it.rot ?? 0);
      it.gx = Math.min(G.w - w, Math.max(0, it.gx + dx)); it.gz = Math.min(G.d - d, Math.max(0, it.gz + dz));
    }
    setFurniture(arr); after();
  }

  /* ---------- 끌기 ---------- */
  $('grid').addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-i]');
    if (!g) { selIdx = null; renderGrid(); renderSel(); return; }
    e.preventDefault();
    selIdx = g.dataset.i === 'host' ? 'host' : +g.dataset.i;
    const [x, z] = svgPoint(e);
    drag = { id: e.pointerId, x, z, moved: false, start: furniture(), host: structuredClone(geom({ ...specOf(cur), slug: cur }).place ? specOf(cur).keeper : specOf(cur).host) };
    try { $('grid').setPointerCapture(e.pointerId); } catch {}
    renderGrid(); renderSel();
    $('grid').querySelector(`[data-i="${selIdx}"]`)?.focus({ preventScroll: true });
  });
  $('grid').addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const [x, z] = svgPoint(e), G = geom({ ...specOf(cur), slug: cur });
    if (selIdx === 'host') {
      const key = G.place ? 'keeper' : 'host';
      const h = { ...drag.host, lx: Math.round(Math.min(G.w - 0.5, Math.max(0.5, x)) * 2) / 2, lz: Math.round(Math.min(G.d - 0.5, Math.max(0.5, z)) * 2) / 2 };
      if (h.lx === specOf(cur)[key].lx && h.lz === specOf(cur)[key].lz) return;
      api.set(`${kindOf(cur)}/${cur}/${key}`, h); drag.moved = true; renderGrid(); return;
    }
    const arr = structuredClone(drag.start), it = arr[selIdx];
    if (!it) return;
    const r = resolveFurniture(it, api.furn, selIdx);
    if (r.place === 'wall' || r.place === 'window' || it.wall) {
      // 가까운 벽: 북쪽(z<0.6) · 서쪽(x<1) · 동쪽(x>w-1), 그 밖엔 북쪽
      const wall = x < 0.6 && z > 0.4 ? 'w' : x > G.w - 0.6 && z > 0.4 ? 'e' : 'n';
      const max = wall === 'n' ? G.w : G.d;
      const slot = Math.min(max - 1, Math.max(0, Math.floor(wall === 'n' ? x : z)));
      if (it.wall === wall && it.slot === slot) return;
      Object.assign(it, { wall, slot }); delete it.gx; delete it.gz; delete it.rot;
    } else {
      const [w, d] = dims(r.footprint, it.rot ?? 0);
      const gx = Math.min(G.w - w, Math.max(0, Math.round(it.gx + (x - drag.x))));
      const gz = Math.min(G.d - d, Math.max(0, Math.round(it.gz + (z - drag.z))));
      const now = specOf(cur).furniture[selIdx];
      if (now && now.gx === gx && now.gz === gz) return;
      it.gx = gx; it.gz = gz;
    }
    setFurniture(arr); drag.moved = true; renderGrid();
  });
  const endDrag = e => { if (!drag || e.pointerId !== drag.id) return; const moved = drag.moved; drag = null; if (moved) after(); };
  $('grid').addEventListener('pointerup', endDrag);
  $('grid').addEventListener('pointercancel', endDrag);
  $('grid').addEventListener('keydown', e => {
    if (selIdx == null) return;
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
    const arr = furniture(), G = geom({ ...specOf(cur), slug: cur });
    const list = arr.map((e, i) => resolveFurniture(e, api.furn, i));
    if (m.place === 'wall' || m.place === 'window') {
      const used = new Set(list.filter(r => r.rec.wall).map(r => `${r.rec.wall}:${r.rec.slot}`));
      const spots = [...Array(G.w).keys()].map(n => `n:${n}`).concat([...Array(G.d - 1).keys()].flatMap(n => [`w:${n}`, `e:${n}`]));
      const ok = spots.find(k => !used.has(k) && (m.place === 'window' ? G.windows.includes(k) : !G.windows.includes(k)));
      if (!ok) return;
      const [wall, slot] = ok.split(':');
      arr.push({ item, wall, slot: +slot });
    } else {
      const info = it => { const r = list.find(x => x.key === it) ?? resolveFurniture({ item }, api.furn); return { footprint: r.footprint, layer: r.layer }; };
      const placed = list.filter(r => !r.rec.wall).map(r => r.rec);
      const reserved = new Set([`${G.door.gx0},${G.d - 1}`, `${G.door.gx1},${G.d - 1}`]);
      let spot = null;
      for (let gz = 0; gz < G.d && !spot; gz++) for (let gx = 0; gx < G.w && !spot; gx++) {
        const rec = { id: 'new', item, gx, gz, rot: 0 };
        if (fits(placed, rec, info, { reserved, w: G.w, d: G.d })) spot = { gx, gz };
      }
      if (!spot) return;
      arr.push({ item, gx: spot.gx, gz: spot.gz, rot: 0 });
    }
    selIdx = arr.length - 1;
    setFurniture(arr); after();
  };

  /* ---------- 방 정보 ---------- */
  function renderMeta() {
    const spec = specOf(cur), G = geom({ ...spec, slug: cur });
    const wps = (api.interior.models ?? []).filter(m => m.kind === 'wallpaper'), fls = (api.interior.models ?? []).filter(m => m.kind === 'floor');
    $('title').textContent = spec.name;
    $('sub').textContent = `${spec.id ?? cur} · ${G.w}×${G.d}칸 · v${baseSpecOf(cur)?.version ?? 0}`;
    const pre = `${kindOf(cur)}/${cur}`;
    $('meta').innerHTML = `${G.place ? '' : `<label class="small">방 이름 <input type="text" data-m="name" value="${esc(spec.name)}" class="w-m"></label>`}
      <label class="small">벽지 <select data-m="wallpaper">${wps.map(m => `<option value="${m.slug}" ${spec.wallpaper === m.slug ? 'selected' : ''}>${esc(`${m.id} ${m.name}`)}</option>`).join('')}</select></label>
      <label class="small">바닥 <select data-m="floor">${fls.map(m => `<option value="${m.slug}" ${spec.floor === m.slug ? 'selected' : ''}>${esc(`${m.id} ${m.name}`)}</option>`).join('')}</select></label>
      <p class="fx">바꾸면: ${G.place ? `${esc(PLACE_NAME[cur])}에 들어갔을 때 가구·벽지·바닥이 이대로 놓여요.` : `${esc(spec.ownerName ?? '')} 집에 놀러 가면 이 방이 보여요.`}${api.changedIn(pre) ? ' <b>· 반영 뒤 바뀜</b>' : ''}</p>`;
  }
  $('meta').addEventListener('change', e => {
    const k = e.target.dataset.m;
    if (!k) return;
    const v = e.target.value.trim();
    if (k === 'name' && !v) { e.target.value = specOf(cur).name; return; }
    api.set(`${kindOf(cur)}/${cur}/${k}`, v); after();
  });

  function renderProbs() {
    const p = problemsOf(cur);
    $('probs').innerHTML = p.length ? p.map(t => `<li class="bad"><span class="mark">!</span><span>${esc(t)}</span></li>`).join('') : '<li class="ok"><span class="mark">✓</span><span>문제없어요</span></li>';
  }
  function after() { render(); api.onChange(); }
  function render() {
    if (!visible) return;
    if (!specOf(cur)) cur = roomSlugs[0];
    renderPick(); renderGrid(); renderSel(); renderMeta(); renderProbs();
  }
  renderAdd();
  return {
    show(slug) { visible = true; if (slug && specOf(slug)) { cur = slug; selIdx = null; } render(); },
    hide() { visible = false; },
    refresh() { if (!drag) render(); },
    checks: () => [...roomSlugs, ...PLACE_KINDS].map(s => { const p = problemsOf(s); return [!p.length, `${specOf(s)?.name ?? s} 배치`, p.slice(0, 2).join(' · ') + (p.length > 2 ? ` 외 ${p.length - 2}` : ''), s]; }),
    current: () => cur,
  };
}
