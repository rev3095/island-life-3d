// 요소 편집기 (P36, 예전 게임 숫자 표 ET-09 + 섬 지도 ET-08 + 배경 편집기 「방 배치」 탭을 합친 것).
// 고친 칸은 저장소 drafts/elem 의 changes (경로 → 값, 첫 칸 = 파일: items · rules · layout · events · night · tour · rooms/<slug> · places/<slug>),
// 채팅 "요소 반영" → node tools/apply-edits.mjs elem … (순서는 docs/notes/p36-elem-editor.md).
import { applyChanges, canon, diffTables, getAt, same, isDelete, DELETE } from '../tools/edits.mjs';
import { checkElements, itemList, hourKo, CAT_KO, WEEKDAY_KO } from '../tools/elem-checks.mjs';
import { GROUPS, SHEETS, sheetOf, SOURCE_KO } from './sheets.js';
import { createMapTab, mapLabel, mapShow } from './map-tab.js';
import { createRoomTab } from './room-tab.js';
import { PLACE_FILES, PLACE_KINDS } from '../src/gameplay/house/placedata.js';
import { HALL_FILES, HALLS } from '../src/gameplay/house/museum-hall-data.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = t => (t ? new Date(t).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const won = n => Number(n).toLocaleString('ko-KR');
const FILES = { items: 'assets/data/items.json', rules: 'assets/data/rules.json', layout: 'assets/island/layout.json', events: 'assets/events/events.json', night: 'assets/night/night.json', tour: 'assets/tour/tour.json',
  home: 'assets/interior/home.json', rating: 'assets/rating/rating.json', journal: 'assets/journal/journal.json' };   // M17-P4: 집 증축 · 섬 별점 · 섬 일지
const BOARD_KO = { elem: '요소', data: '숫자 표', map: '섬 지도' };
const FILE_KO = { items: '아이템', rules: '규칙', layout: '섬 지도', events: '행사', night: '밤·새벽', tour: '투어', rooms: '방', places: '가게 실내', halls: '박물관 관', home: '집 증축', rating: '섬 별점', journal: '섬 일지' };

/* ---------- 상태 ---------- */
let base = null;           // { items, rules, layout, events, night, tour, rooms: { slug: 방 }, places: { slug: 가게 } } — 게임에 들어간 파일
let changes = {};          // 'items/fish/crucian/price' → 값
let note = '', draftStatus = 'editing', applied = null, hist = [];   // hist = 반영 기록 (window.history 와 안 겹치게)
let group = 'shop', tab = 'shop', query = '';
const invalid = new Map(); // 경로 → { why, raw } (저장하지 않은 잘못된 입력)
let W = null;              // 지금 값 (파일 + 바뀐 칸)
let ITEMS = [];
let mapTab = null, roomTab = null, furn = null, interior = null;
function rebuild() { W = applyChanges(base, changes).out; ITEMS = itemList(W.items); }
const baseAt = path => getAt(base, path);
const workAt = path => getAt(W, path);
const itemName = id => { const it = ITEMS.find(i => i.id === id); return it ? `${it.emoji} ${it.name}` : id; };
const needText = n => (n.id ? `${itemName(n.id)} ${n.n}` : `${CAT_KO[n.category] ?? n.category} 아무거나 ${n.n}`);

/* ---------- 칸 종류 ---------- */
const TYPES = {
  int: (v, c) => (Number.isInteger(v) && v >= (c.min ?? 0) && v <= (c.max ?? 1e9) ? null : `${c.min ?? 0}~${won(c.max ?? 1e9)} 사이 정수로`),
  num: (v, c) => (Number.isFinite(v) && v >= (c.min ?? 0) && v <= (c.max ?? 1e9) ? null : `${c.min ?? 0}~${c.max ?? '…'} 사이 숫자로`),
  prob: v => (Number.isFinite(v) && v >= 0 && v <= 1 ? null : '0~1 사이 (0.08 = 8%)'),
  text: (v, c) => (typeof v === 'string' && (c.empty || v.trim()) ? null : '비워 둘 수 없어요'),
  mmdd: v => (v === null || /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v) ? null : '월-일 (예: 07-14), 비우면 이사 온 날'),
};
const fmt = v => (v === undefined ? '(값으로 정함)' : v === null ? '(없음)' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/* ---------- 바뀐 칸 ---------- */
function setChange(path, value, { save = true } = {}) {
  invalid.delete(path);
  const b = baseAt(path);
  if (isDelete(value) ? b === undefined : same(b, value)) delete changes[path]; else changes[path] = value;
  draftStatus = 'editing';
  rebuild();
  if (save) saveSoon();
}
function dropChanges(pre, { prefix = false } = {}) {
  for (const k of Object.keys(changes)) if (k === pre || (prefix && k.startsWith(pre + '/'))) delete changes[k];
  draftStatus = 'editing'; rebuild(); saveSoon();
}
const prune = ch => Object.fromEntries(Object.entries(ch ?? {}).filter(([p, v]) => (isDelete(v) ? baseAt(p) !== undefined : !same(baseAt(p), v))));

/* ---------- 저장소 (웹 링크 = 아티팩트 db, 로컬 = dev-server /api/db/elem-*) ---------- */
const BOARDS = ['elem', 'data', 'map'];
function artifactStore(db, user) {
  return {
    label: '이 편집기 저장소에 저장돼요 (어느 기기에서 열어도 같아요)',
    watchDoc: (path, cb) => db.doc(path).onSnapshot(s => cb(s.exists ? s.data() : null), () => {}),
    getDoc: path => db.doc(path).get().then(s => (s.exists ? s.data() : null)).catch(() => null),
    watchHistory: cb => db.collection('history').onSnapshot(qs => cb(qs.docs.map(d => d.data()).filter(h => BOARDS.includes(h.board))), () => {}),   // 기록은 몇 개뿐이라 다 받아 거른다
    set: (path, data) => db.doc(path).set(data),
    who: async () => (await user?.id?.().catch(() => null)) ?? null,
    canWrite: async () => (await user?.can?.('data.write').catch(() => null)) !== false,
  };
}
function localStore() {
  const col = path => `elem-${path.split('/')[0]}`, did = path => path.split('/')[1];
  const rows = c => fetch(`api/db/${c}`).then(r => r.json()).catch(() => []);
  const subs = [];
  setInterval(() => subs.forEach(f => f()), 4000);
  return {
    label: '로컬 프로젝트 폴더(assets/review/elem-*.json)에 저장돼요',
    watchDoc(path, cb) { const f = async () => cb((await rows(col(path))).find(r => r.docId === did(path)) ?? null); subs.push(f); f(); },
    getDoc: async path => (await rows(col(path))).find(r => r.docId === did(path)) ?? null,
    watchHistory(cb) { const f = async () => cb((await rows('elem-history')).filter(r => BOARDS.includes(r.board))); subs.push(f); f(); },
    async set(path, data) {
      const c = col(path), id = did(path);
      const hit = (await rows(c)).find(r => r.docId === id);
      const opt = { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, docId: id }) };
      await fetch(hit ? `api/db/${c}/${hit.id}` : `api/db/${c}`, { method: hit ? 'PATCH' : 'POST', ...opt });
    },
    who: async () => 'local',
    canWrite: async () => true,
  };
}
async function connectStore() {
  if (window.claude?.use) {
    const [db, user] = await Promise.all(['db', 'user'].map(n => window.claude.use(n).catch(() => null)));
    if (db) return artifactStore(db, user);
  }
  try { if ((await fetch('api/ping')).ok) return localStore(); } catch {}
  return null;
}
let store = null, me = null, writable = true, saveMsg = '저장소에 연결하는 중…', saveTimer = null, lastSaved = '';
const versions = () => Object.fromEntries([...Object.keys(FILES).map(k => [k, base?.[k]?.version ?? 0])]);
const draftBody = () => ({ changes, note, status: draftStatus, basedOn: versions() });
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
  saveMsg = '저장하는 중…';
  renderStatus();
}
async function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const body = draftBody();
  const sig = canon(body);
  if (sig === lastSaved) { saveMsg = '저장됨'; renderStatus(); return; }
  if (!store) { saveMsg = '이 화면에서는 저장소를 쓸 수 없어요. 고친 칸은 창을 닫으면 사라져요.'; renderStatus(); return; }
  if (!writable) { saveMsg = '이 링크에서는 볼 수만 있어요. 고쳐 볼 수는 있지만 저장되지 않아요.'; renderStatus(); return; }
  try { await store.set('drafts/elem', { ...body, updatedAt: Date.now(), updatedBy: me }); lastSaved = sig; saveMsg = `저장됨 · ${when(Date.now())}`; }
  catch (e) { saveMsg = `저장하지 못했어요 (${e?.code ?? '오류'}). 잠시 뒤 다시 고쳐 보세요.`; if (e?.code === 'invalid_argument') writable = false; }
  renderStatus();
}

/* ---------- 찾기 ---------- */
const norm = s => String(s ?? '').toLowerCase();
const rowText = row => norm(Object.values(row).map(v => (typeof v === 'object' ? JSON.stringify(v) : v)).join(' '));
const rowsOf = (file, section) => getAt(W, `${file}/${section}`) ?? [];
const groupsOf = s => (s.object ? s.groups(W) : []);
const objectRows = s => groupsOf(s).flatMap(([, rows]) => rows);
function hitsOf(s) {
  if (!query || s.custom) return 0;
  if (s.object) return objectRows(s).filter(([p, label]) => norm(label).includes(query) || norm(JSON.stringify(workAt(p))).includes(query)).length;
  if (s.recipes) return rowsOf('rules', 'recipes').filter(r => norm(`${r.result} ${itemName(r.result)} ${r.needs.map(needText).join(' ')} ${r.note}`).includes(query)).length;
  return [s.section, s.extra?.section].filter(Boolean).reduce((n, sec) => n + rowsOf(s.file, sec).filter(r => rowText(r).includes(query)).length, 0);
}
function changedIn(s) {
  const ks = Object.keys(changes);
  if (s.custom === 'map') return ks.filter(k => k.startsWith('layout/')).length;
  if (s.custom === 'rooms') return ks.filter(k => k.startsWith('rooms/') || k.startsWith('places/') || k.startsWith('halls/')).length;
  if (s.object) { const pre = objectRows(s).map(([p]) => p); return ks.filter(p => pre.some(q => p === q || q.startsWith(p + '/') || p.startsWith(q + '/'))).length; }
  return ks.filter(p => [s.section, s.extra?.section].filter(Boolean).some(sec => p.startsWith(`${s.file}/${sec}/`) || p === `${s.file}/${sec}`)).length;
}
const changedPrefix = pre => Object.keys(changes).some(k => k === pre || k.startsWith(pre + '/'));

/* ---------- 탭 ---------- */
function renderTabs() {
  const sheetsIn = g => SHEETS.filter(s => s.group === g);
  $('groups').innerHTML = GROUPS.map(g => {
    const ch = sheetsIn(g.id).reduce((n, s) => n + changedIn(s), 0), hit = sheetsIn(g.id).reduce((n, s) => n + hitsOf(s), 0);
    return `<button type="button" class="tab" role="tab" aria-selected="${g.id === group}" data-group="${g.id}"><span class="emo" aria-hidden="true">${g.emo}</span>${esc(g.name)}${ch ? `<span class="n ch" title="바뀐 칸">${ch}</span>` : ''}${query && hit ? `<span class="n hit" title="찾은 줄">${hit}</span>` : ''}</button>`;
  }).join('');
  const subs = sheetsIn(group);
  $('tabs').hidden = subs.length < 2;
  $('tabs').innerHTML = subs.map(s => {
    const ch = changedIn(s), hit = hitsOf(s);
    return `<button type="button" class="subtab" role="tab" id="tab-${s.id}" aria-selected="${s.id === tab}" aria-controls="sheet" data-tab="${s.id}">${esc(s.name)}${ch ? `<span class="n ch">${ch}</span>` : ''}${query && hit ? `<span class="n hit">${hit}</span>` : ''}</button>`;
  }).join('');
  const total = query ? SHEETS.reduce((n, s) => n + hitsOf(s), 0) : 0;
  $('qInfo').textContent = query ? (total ? `${total}줄 찾음 — 탭 옆 숫자` : '찾은 줄이 없어요') : '';
}
function go(id, { scroll = false } = {}) {
  const s = sheetOf(id);
  if (!s) return;
  tab = id; group = s.group;
  try { localStorage.setItem('elem-editor-tab', id); } catch {}
  if (!location.hash.startsWith(`#${id}`)) history.replaceState(null, '', `#${id}`);
  renderAll();
  if (scroll) $('sheet').scrollIntoView({ block: 'start' });
}
$('groups').addEventListener('click', e => { const g = e.target.closest('[data-group]')?.dataset.group; if (g) go(SHEETS.find(s => s.group === g).id); });
$('tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]')?.dataset.tab; if (t) go(t); });
$('q').addEventListener('input', () => {
  query = norm($('q').value.trim());
  if (query && !hitsOf(sheetOf(tab))) { const first = SHEETS.find(s => hitsOf(s)); if (first) { tab = first.id; group = first.group; } }
  renderAll();
});

/* ---------- 표 그리기 ---------- */
function cellHtml(c, row, i, path) {
  const v = row[c.key];
  if (c.derived) return `<td class="derived${c.emo ? ' emo' : ''}${c.stick ? ' stick' : ''}">${esc(c.derived(row, i))}</td>`;
  const bad = invalid.get(path);
  const ch = changes[path] !== undefined && !bad;
  const cls = [ch ? 'changed' : '', bad ? 'invalid' : '', c.stick ? 'stick' : ''].filter(Boolean).join(' ');
  const was = ch ? ` title="반영된 값: ${esc(fmt(baseAt(path)))}"` : '';
  const id = `c-${path.replace(/[^\w-]+/g, '_')}`;
  const aria = `aria-label="${esc(`${row.name ?? row.result ?? ''} ${c.label}`)}"`;
  let input = '';
  switch (c.type) {
    case 'int': case 'num': input = `<input type="number" id="${id}" data-path="${esc(path)}" data-type="${c.type}" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''} step="${c.type === 'int' ? 1 : 'any'}" value="${esc(bad?.raw ?? v)}" class="${c.w ?? ''}" ${aria}>`; break;
    case 'text': input = `<input type="text" id="${id}" data-path="${esc(path)}" data-type="text" value="${esc(bad?.raw ?? v)}" class="${c.w ?? ''}" ${aria}>`; break;
    case 'select': input = `<select id="${id}" data-path="${esc(path)}" data-type="select" ${aria}>${c.options.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(c.labels?.[o] ?? o)}</option>`).join('')}${c.options.includes(v) ? '' : `<option selected>${esc(v)}</option>`}</select>`; break;
    case 'bool': input = `<input type="checkbox" id="${id}" data-path="${esc(path)}" data-type="bool" ${v ? 'checked' : ''} ${aria}>`; break;
    case 'weight': input = `<input type="number" id="${id}" data-path="${esc(path)}" data-type="weight" min="0.1" step="any" value="${esc(bad?.raw ?? v ?? '')}" placeholder="${c.auto(row)} (값으로)" class="w-m" ${aria}>`; break;
    case 'colors': input = `<span class="cols4">${(v ?? ['#8FA7B5', '#6E8898', '#F7F1E4', '#7E98A8']).map((col, k) => `<input type="color" id="${id}-${k}" data-path="${esc(path)}" data-type="color" data-k="${k}" value="${esc(col)}" aria-label="${esc(`${row.name} ${['몸', '등', '배', '지느러미'][k]} 색`)}">`).join('')}</span>`; break;
  }
  return `<td class="${cls}"${was}>${input}${bad ? `<span class="err">${esc(bad.why)}</span>` : ''}</td>`;
}
function tableHtml(file, section, cols) {
  const all = rowsOf(file, section);
  const rows = all.map((r, i) => [r, i]).filter(([r]) => !query || rowText(r).includes(query));
  const keyOf = r => r.slug ?? r.kind;
  return { n: all.length, shown: rows.length, html: `<div class="grid"><table><thead><tr>${cols.map(c => `<th scope="col" class="${c.stick ? 'stick' : ''}" ${c.fx ? `title="${esc(c.fx)}"` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([r, i]) => `<tr id="row-${file}-${section}-${esc(keyOf(r))}">${cols.map(c => cellHtml(c, r, i, `${file}/${section}/${keyOf(r)}/${c.key}`)).join('')}</tr>`).join('')
      || `<tr><td colspan="${cols.length}" class="empty">찾는 글자가 이 표에 없어요.</td></tr>`}</tbody></table></div>` };
}
const fxList = cols => {
  const xs = cols.filter(c => c.fx);
  return xs.length ? `<ul class="fxlist">${xs.map(c => `<li><b>${esc(c.label)}</b> — ${esc(c.fx)}</li>`).join('')}</ul>` : '';
};
function recipesHtml() {
  const rows = rowsOf('rules', 'recipes');
  const baseRows = getAt(base, 'rules/recipes');
  const removed = baseRows.filter(r => !rows.some(x => x.result === r.result));
  const show = rows.filter(r => !query || norm(`${r.result} ${itemName(r.result)} ${r.needs.map(needText).join(' ')} ${r.note}`).includes(query));
  const opts = (sel, withCats) => `${withCats ? `<optgroup label="분류 아무거나">${Object.entries(CAT_KO).map(([c, n]) => `<option value="@${c}" ${sel === `@${c}` ? 'selected' : ''}>${esc(n)} 아무거나</option>`).join('')}</optgroup>` : ''}
    ${Object.entries(CAT_KO).map(([c, n]) => `<optgroup label="${esc(n)}">${ITEMS.filter(i => i.cat === c).map(i => `<option value="${esc(i.id)}" ${i.id === sel ? 'selected' : ''}>${esc(`${i.emoji} ${i.name}`)}</option>`).join('')}</optgroup>`).join('')}`;
  const isNew = r => !baseRows.some(b => b.result === r.result);
  const used = new Set(rows.map(r => r.result));
  return `<div class="grid"><table><thead><tr><th scope="col" class="stick">만드는 것</th><th scope="col">재료</th><th scope="col">메모</th><th scope="col"></th></tr></thead><tbody>
    ${show.map(r => {
      const p = `rules/recipes/${r.result}`;
      const chNeeds = !isNew(r) && changes[`${p}/needs`] !== undefined, chNote = !isNew(r) && changes[`${p}/note`] !== undefined;
      return `<tr id="row-rules-recipes-${esc(r.result)}">
        <td class="stick ${isNew(r) ? 'changed' : ''}">${isNew(r) ? `<select data-recipe="${esc(r.result)}" data-field="result" aria-label="만드는 것">${opts(r.result, false).replace(/<option value="([^"]+)"/g, (m, id) => (used.has(id) && id !== r.result ? `${m} disabled` : m))}</select>` : esc(itemName(r.result))}</td>
        <td class="${chNeeds ? 'changed' : ''}" ${chNeeds ? `title="반영된 값: ${esc(getAt(base, `${p}/needs`).map(needText).join(' + '))}"` : ''}><div class="needs">${r.needs.map((n, k) => `<div class="need">
            <select data-recipe="${esc(r.result)}" data-need="${k}" data-field="what" aria-label="재료 ${k + 1}">${opts(n.id ?? `@${n.category}`, true)}</select>
            <input type="number" min="1" max="99" step="1" value="${n.n}" data-recipe="${esc(r.result)}" data-need="${k}" data-field="n" class="w-s" aria-label="재료 ${k + 1} 수">
            <button type="button" class="btn ghost tiny" data-recipe="${esc(r.result)}" data-need="${k}" data-act="del" ${r.needs.length < 2 ? 'disabled' : ''} aria-label="재료 ${k + 1} 빼기">빼기</button></div>`).join('')}
          <div><button type="button" class="btn ghost tiny" data-recipe="${esc(r.result)}" data-act="addNeed">+ 재료</button></div></div></td>
        <td class="${chNote ? 'changed' : ''}"><input type="text" class="w-m" value="${esc(r.note ?? '')}" data-recipe="${esc(r.result)}" data-field="note" aria-label="메모"></td>
        <td><button type="button" class="btn ghost tiny" data-recipe="${esc(r.result)}" data-act="delRow">레시피 빼기</button></td></tr>`;
    }).join('')}
    ${removed.map(r => `<tr class="removed"><td class="stick">${esc(itemName(r.result))}</td><td>${esc(r.needs.map(needText).join(' + '))}</td><td>뺄 예정</td>
      <td><button type="button" class="btn ghost tiny" data-undo="rules/recipes/${esc(r.result)}">되살리기</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="foot"><span>레시피 ${rows.length}개${removed.length ? ` · 뺄 것 ${removed.length}` : ''}</span><button type="button" class="btn" data-act="addRow">+ 레시피 더하기</button></div>`;
}
function inputFor(p, label, type, o, v, bad) {
  const id = `c-${p.replace(/[^\w-]+/g, '_')}`;
  if (type === 'pair' || type === 'hours') {
    const lo = o.min ?? 0, hi = o.max ?? 99, step = type === 'hours' ? 0.5 : 1;
    return [0, 1].map(k => `<input type="number" id="${id}-${k}" min="${lo}" max="${hi}" step="${step}" value="${v?.[k] ?? ''}" data-path="${esc(p)}" data-type="${type}" data-k="${k}" data-min="${lo}" data-max="${hi}" class="w-s" aria-label="${esc(label)} ${k ? (type === 'hours' ? '닫는 시각' : '많게') : (type === 'hours' ? '여는 시각' : '적게')}">`).join(' ~ ')
      + (type === 'hours' && Array.isArray(v) ? ` <span class="muted small">${esc(hourKo(v[0]))} ~ ${esc(hourKo(v[1]))}</span>` : '');
  }
  if (type === 'mmdd') return `<input type="text" id="${id}" value="${esc(bad?.raw ?? v ?? '')}" placeholder="이사 온 날" data-path="${esc(p)}" data-type="mmdd" class="w-s" aria-label="${esc(label)} 생일">`;
  if (type === 'bool') return `<input type="checkbox" id="${id}" data-path="${esc(p)}" data-type="bool" ${v ? 'checked' : ''} aria-label="${esc(label)}">`;
  if (type === 'select') return `<select id="${id}" data-path="${esc(p)}" data-type="select" ${o.number ? 'data-number="1"' : ''} aria-label="${esc(label)}">${o.options.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(o.labels?.[x] ?? x)}</option>`).join('')}</select>`;
  if (type === 'multi') return `<span class="multi">${o.options.map(x => `<label><input type="checkbox" data-path="${esc(p)}" data-type="multi" data-v="${esc(x)}" ${(v ?? []).includes(x) ? 'checked' : ''}> ${esc(o.labels?.[x] ?? x)}</label>`).join('')}</span>`;
  const pct = type === 'prob' && Number.isFinite(v) ? ` <span class="muted small">${Math.round(v * 1000) / 10}%</span>` : '';
  const hr = o.min >= 5 && o.max === 29 && Number.isFinite(v) ? ` <span class="muted small">${esc(hourKo(v))}</span>` : '';
  return `<input type="number" id="${id}" ${o.min != null ? `min="${o.min}"` : 'min="0"'} ${type === 'prob' ? 'max="1" step="0.01"' : `max="${o.max ?? ''}" step="${type === 'int' ? 1 : 'any'}"`} value="${esc(bad?.raw ?? v)}" data-path="${esc(p)}" data-type="${type}" data-min="${o.min ?? 0}" data-max="${o.max ?? ''}" aria-label="${esc(label)}">${pct}${hr}`;
}
const showValue = (p, v) => {
  if (v === undefined) return '(없음)';
  if (Array.isArray(v) && p.endsWith('/hours')) return `${hourKo(v[0])} ~ ${hourKo(v[1])}`;
  if (p === 'night/market/weekday') return WEEKDAY_KO[v] ?? String(v);
  return fmt(v);
};
function objectHtml(s) {
  return `<div class="grid"><table class="obj"><thead><tr><th scope="col" class="stick">칸 · 바꾸면</th><th scope="col">값</th><th scope="col">반영된 값</th></tr></thead><tbody>
    ${groupsOf(s).map(([g, rows]) => {
      const shown = rows.filter(([p, label]) => !query || norm(label).includes(query) || norm(JSON.stringify(workAt(p))).includes(query) || norm(g).includes(query));
      if (!shown.length) return '';
      return `<tr class="gh"><th colspan="3" scope="colgroup" class="stick">${esc(g)}</th></tr>` + shown.map(([p, label, type, o = {}, fx]) => {
        const v = workAt(p), b = baseAt(p), bad = invalid.get(p);
        const ch = !same(v, b);
        return `<tr id="row-${esc(p.replace(/[^\w-]+/g, '_'))}"><td class="stick lab">${esc(label)}${fx ? `<span class="fx">${esc(fx)}</span>` : ''}</td>
          <td class="${ch ? 'changed' : ''}${bad ? ' invalid' : ''}">${inputFor(p, label, type, o, v, bad)}${bad ? `<span class="err">${esc(bad.why)}</span>` : ''}</td>
          <td class="derived">${ch ? esc(showValue(p, b)) : '그대로'}</td></tr>`;
      }).join('');
    }).join('')}</tbody></table></div>`;
}
let shownCustom = null;
function renderSheet() {
  const s = sheetOf(tab);
  const head = `<header><div class="row"><h2><span class="emo" aria-hidden="true">${s.emo}</span> ${esc(s.name)}</h2><span class="small muted" id="sheetCount"></span></div><p class="small muted">${esc(s.hint)}</p></header>`;
  $('sheet').setAttribute('aria-labelledby', `tab-${s.id}`);
  // 지도·방 탭은 자기 칸을 한 번 만들어 두고 보였다 숨겼다만 (끄는 중에 다시 그리면 끌기가 끊긴다)
  $('customMap').hidden = s.custom !== 'map';
  $('customRooms').hidden = s.custom !== 'rooms';
  if (s.custom) {
    $('sheet').innerHTML = head;
    if (s.custom === 'map') { roomTab?.hide(); if (shownCustom !== 'map') mapTab?.show(); }
    if (s.custom === 'rooms') { mapTab?.hide(); roomTab?.show(location.hash.match(/^#rooms\.([\w-]+)/)?.[1]); }
    shownCustom = s.custom;
    return;
  }
  if (shownCustom) { mapTab?.hide(); roomTab?.hide(); shownCustom = null; }
  let body = '', count = '';
  if (s.recipes) body = recipesHtml();
  else if (s.object) body = objectHtml(s);
  else {
    const cols = s.cols(W.items), a = tableHtml(s.file, s.section, cols);
    body = fxList(cols) + a.html;
    count = `${query ? `${a.shown} / ` : ''}${a.n}줄`;
    if (s.extra) {
      const ec = s.extra.cols(W.items), b = tableHtml(s.file, s.extra.section, ec);
      body += `<header class="sub"><div class="row"><h2>${esc(s.extra.title)}</h2><span class="small muted">${query ? `${b.shown} / ` : ''}${b.n}줄</span></div>${s.extra.hint ? `<p class="small muted">${esc(s.extra.hint)}</p>` : ''}${fxList(ec)}</header>${b.html}`;
    }
  }
  const focusId = document.activeElement?.id;
  $('sheet').innerHTML = head + body;
  $('sheetCount').textContent = count;
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

/* ---------- 입력 ---------- */
function colOf(path) {
  const s = sheetOf(tab);
  if (!s.cols) return null;
  const [, sec, , key] = path.split('/');
  const cols = sec === s.section ? s.cols(W.items) : s.extra?.cols(W.items);
  return cols?.find(c => c.key === key) ?? null;
}
function readInput(el) {
  const p = el.dataset.path, type = el.dataset.type, raw = el.value;
  const col = colOf(p);
  const fail = why => { invalid.set(p, { why, raw }); delete changes[p]; rebuild(); renderAll(); };
  if (type === 'bool') return setChange(p, el.checked);
  if (type === 'select') return setChange(p, el.dataset.number ? Number(raw) : raw);
  if (type === 'multi') { const set = new Set(workAt(p) ?? []); el.checked ? set.add(el.dataset.v) : set.delete(el.dataset.v); return setChange(p, el.closest('.multi') ? [...el.closest('.multi').querySelectorAll('input')].filter(i => set.has(i.dataset.v)).map(i => i.dataset.v) : [...set]); }
  if (type === 'text') { const e = TYPES.text(raw, col ?? {}); return e ? fail(e) : setChange(p, raw); }
  if (type === 'mmdd') { const v = raw.trim() ? raw.trim() : null; const e = TYPES.mmdd(v); return e ? fail(e) : setChange(p, v); }
  if (type === 'color') { const arr = [...(workAt(p) ?? ['#8FA7B5', '#6E8898', '#F7F1E4', '#7E98A8'])]; arr[+el.dataset.k] = el.value.toUpperCase(); return setChange(p, arr); }
  if (type === 'pair' || type === 'hours') {
    const arr = [...workAt(p)], n = Number(raw), lo = Number(el.dataset.min), hi = Number(el.dataset.max);
    const okNum = type === 'hours' ? Number.isFinite(n) && n * 2 === Math.round(n * 2) : Number.isInteger(n);
    if (!okNum || n < lo || n > hi) return fail(`${lo}~${hi} 사이${type === 'hours' ? ' (30분 = .5)' : ' 정수'}`);
    arr[+el.dataset.k] = n;
    if (type === 'hours' ? arr[0] >= arr[1] : arr[0] > arr[1]) return fail(type === 'hours' ? '여는 시각 < 닫는 시각 (자정 넘으면 24 이상: 새벽 3시 = 27)' : '적게 ≤ 많게');
    return setChange(p, arr);
  }
  if (type === 'weight') {
    if (raw.trim() === '') return setChange(p, { ...DELETE });
    const n = Number(raw); return n > 0 && n <= 100 ? setChange(p, n) : fail('0 보다 크고 100 이하 (비우면 값으로 정함)');
  }
  const n = raw.trim() === '' ? NaN : Number(raw);
  const c = col ?? { min: Number(el.dataset.min ?? 0), max: el.dataset.max ? Number(el.dataset.max) : 1e9 };
  const e = (TYPES[type] ?? TYPES.num)(n, c);
  return e ? fail(e) : setChange(p, n);
}
$('sheet').addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.recipe) return recipeEdit(el);
  if (!el.dataset.path) return;
  readInput(el);
  renderAll();
});
$('sheet').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.undo) { delete changes[b.dataset.undo]; rebuild(); saveSoon(); renderAll(); return; }
  if (b.dataset.act) recipeAct(b);
});

/* ---------- 레시피 고치기 ---------- */
const recipeRow = id => rowsOf('rules', 'recipes').find(r => r.result === id);
const isNewRecipe = id => !getAt(base, 'rules/recipes').some(r => r.result === id);
function putRecipe(id, row) {
  if (isNewRecipe(id)) { delete changes[`rules/recipes/${id}`]; if (row) changes[`rules/recipes/${row.result}`] = row; draftStatus = 'editing'; rebuild(); saveSoon(); }
  else { setChange(`rules/recipes/${id}/needs`, row.needs); setChange(`rules/recipes/${id}/note`, row.note ?? ''); }
}
function recipeEdit(el) {
  const id = el.dataset.recipe, r = structuredClone(recipeRow(id));
  if (!r) return;
  if (el.dataset.field === 'result') { const nr = { ...r, result: el.value }; delete changes[`rules/recipes/${id}`]; changes[`rules/recipes/${el.value}`] = nr; rebuild(); saveSoon(); renderAll(); return; }
  if (el.dataset.field === 'note') r.note = el.value;
  else {
    const k = +el.dataset.need;
    if (el.dataset.field === 'what') r.needs[k] = el.value.startsWith('@') ? { category: el.value.slice(1), n: r.needs[k].n } : { id: el.value, n: r.needs[k].n };
    else { const n = Number(el.value); if (!Number.isInteger(n) || n < 1 || n > 99) { el.value = r.needs[k].n; return; } r.needs[k] = { ...r.needs[k], n }; }
  }
  putRecipe(id, r);
  renderAll();
}
function recipeAct(b) {
  const id = b.dataset.recipe;
  if (b.dataset.act === 'addRow') {
    const used = new Set(rowsOf('rules', 'recipes').map(r => r.result));
    const pick = ITEMS.find(i => (i.cat === 'furn' || i.cat === 'tool') && !used.has(i.id));
    if (!pick) return;
    changes[`rules/recipes/${pick.id}`] = { result: pick.id, needs: [{ id: 'mat.wood', n: 5 }], note: '' };
    rebuild(); saveSoon(); renderAll();
    document.getElementById(`row-rules-recipes-${pick.id}`)?.scrollIntoView({ block: 'nearest' });
    return;
  }
  const r = structuredClone(recipeRow(id));
  if (!r) return;
  if (b.dataset.act === 'delRow') {
    if (isNewRecipe(id)) delete changes[`rules/recipes/${id}`];
    else { for (const k of Object.keys(changes)) if (k.startsWith(`rules/recipes/${id}/`)) delete changes[k]; changes[`rules/recipes/${id}`] = null; }
    draftStatus = 'editing'; rebuild(); saveSoon(); renderAll(); return;
  }
  if (b.dataset.act === 'addNeed') r.needs.push({ id: 'mat.wood', n: 1 });
  if (b.dataset.act === 'del') r.needs.splice(+b.dataset.need, 1);
  putRecipe(id, r);
  renderAll();
}

/* ---------- 바뀐 칸 목록 ---------- */
function labelOf(path) {
  const [f, sec, row, ...rest] = path.split('/');
  if (f === 'layout') return [sheetOf('map'), `섬 지도 · ${mapLabel(path.slice(7))}`];
  if (f === 'rooms' || f === 'places' || f === 'halls') {
    const spec = W[f]?.[sec] ?? base[f]?.[sec];
    const PH = { day: '낮 매장', night: '밤 매장' };
    const what = row === 'phases' ? `${PH[rest[0]] ?? rest[0]} ${rest[1] === 'keeper' ? '주인 서는 곳' : '가구 자리'}`
      : { furniture: '가구 자리', starter: '처음 가구', fixtures: '계단', inner: '실내 문', halls: '관 입구', host: '주민 서는 곳', keeper: '주인 서는 곳', name: '이름', wallpaper: '벽지', floor: '바닥' }[row] ?? [row, ...rest].join('/');
    return [sheetOf('rooms'), `방 배치 · ${spec?.name ?? sec} · ${what}`, `rooms.${f === 'halls' ? `hall-${sec}` : sec}`];
  }
  for (const s of SHEETS) if (s.object) for (const [p, label] of objectRows(s)) if (p === path) return [s, `${s.name} · ${label}`];
  const s = SHEETS.find(s => s.file === f && (s.section === sec || s.extra?.section === sec)) ?? (sec === 'recipes' ? sheetOf('recipes') : null);
  if (!s) return [null, `${FILE_KO[f] ?? f} · ${[sec, row, ...rest].filter(Boolean).join('/')}`];
  if (sec === 'recipes') return [s, `레시피 · ${itemName(row)}${rest.length ? ` · ${rest[0] === 'needs' ? '재료' : '메모'}` : ''}`];
  const rowObj = rowsOf(f, sec).find(r => (r.slug ?? r.kind) === row) ?? getAt(base, `${f}/${sec}`)?.find(r => (r.slug ?? r.kind) === row);
  const cols = s.section === sec ? s.cols(W.items) : s.extra.cols(W.items);
  const col = cols.find(c => c.key === rest[0]);
  return [s, `${s.name} · ${rowObj?.emoji ?? ''} ${rowObj?.name ?? row} · ${col?.label || rest.join('/')}`];
}
const showVal = (path, v) => {
  if (path.startsWith('layout/')) return mapShow(path.slice(7), v);
  if (/^(rooms|places|halls)\/[\w-]+\/(furniture|starter|phases\/\w+\/furniture)$/.test(path)) return Array.isArray(v) ? `가구 ${v.length}개` : fmt(v);
  if (/^(rooms|places)\/[\w-]+\/fixtures$/.test(path)) return Array.isArray(v) ? v.map(f => `${f.slug} (${f.gx}, ${f.gz})${f.from ? ` ${f.from}단계부터` : ''}`).join(' · ') : fmt(v);
  if (/^places\/[\w-]+\/inner$/.test(path)) return Array.isArray(v) ? v.map(d => `→${d.to} ${d.wall}:${d.slot}${d.phase ? ` ${d.phase}` : ''}`).join(' · ') : fmt(v);
  if (/^places\/[\w-]+\/halls$/.test(path)) return Array.isArray(v) ? v.map(a => `${a.hall} ${a.wall}:${a.at}`).join(' · ') : fmt(v);
  if (/^(rooms|places)\/[\w-]+\/(host|keeper|phases\/\w+\/keeper)$/.test(path)) return v ? `(${v.lx}, ${v.lz}) ${v.face}` : fmt(v);
  if (path.startsWith('rules/recipes/')) {
    if (v === undefined) return '(없음)';
    if (v === null) return '(뺌)';
    if (Array.isArray(v)) return v.map(needText).join(' + ');
    if (v && v.needs) return `새 레시피: ${v.needs.map(needText).join(' + ')}`;
  }
  if (isDelete(v)) return path.endsWith('/weight') ? '(값으로 정함)' : '(칸 지움 — 기본값)';
  return showValue(path, v);
};
/** 가구 배열 두 개의 차이를 사람 말로: "공 바구니 (6, 4) → (5, 4) · 라디오 더함" */
function furnDiff(a = [], b = []) {
  const names = Object.fromEntries((W.items.furniture ?? []).map(f => [`furn.${f.slug}`, f.name]));
  const nm = e => names[e.item] ?? e.name ?? e.fu ?? e.item;
  const at = e => (e.wall ? `벽 ${e.wall}:${e.slot}` : `(${e.gx}, ${e.gz})${e.rot ? ` ↻${e.rot}` : ''}`);
  const out = [], used = new Set();
  b.forEach((e, i) => {
    const j = a[i] && nm(a[i]) === nm(e) ? i : a.findIndex((x, k) => !used.has(k) && nm(x) === nm(e));
    if (j < 0) { out.push(`${nm(e)} 더함 ${at(e)}`); return; }
    used.add(j);
    if (!same(a[j], e)) out.push(`${nm(e)} ${at(a[j])} → ${at(e)}${a[j].variant !== e.variant ? ` 색 ${e.variant ?? '기본'}` : ''}`);
  });
  a.forEach((e, k) => { if (!used.has(k)) out.push(`${nm(e)} 뺌`); });
  return out.join(' · ') || '순서만 바뀜';
}
function renderChanges() {
  const ks = Object.keys(changes);
  $('changes').innerHTML = ks.length ? ks.map(k => {
    const [s, label, hash] = labelOf(k);
    const what = /^(rooms|places)\/[\w-]+\/furniture$/.test(k) ? esc(furnDiff(baseAt(k), changes[k]))
      : `<span class="muted">${esc(showVal(k, baseAt(k)))} → </span>${esc(showVal(k, changes[k]))}`;
    return `<li><span class="what"><a href="#${esc(hash ?? s?.id ?? '')}" data-jump="${esc(k)}" data-tab="${s?.id ?? ''}" data-hash="${esc(hash ?? '')}">${esc(label)}</a> ${what}</span>
      <button type="button" class="btn ghost tiny" data-undo="${esc(k)}">되돌리기</button></li>`;
  }).join('') : '<li class="empty">반영한 값과 같아요. 표의 칸이나 지도·방을 고치면 여기에 쌓여요.</li>';
  $('resetAll').disabled = !ks.length;
}
$('changes').addEventListener('click', e => {
  const u = e.target.closest('[data-undo]')?.dataset.undo;
  if (u) { delete changes[u]; invalid.delete(u); rebuild(); saveSoon(); refreshCustom(); renderAll(); return; }
  const j = e.target.closest('[data-jump]');
  if (!j) return;
  e.preventDefault();
  query = ''; $('q').value = '';
  if (j.dataset.hash) history.replaceState(null, '', `#${j.dataset.hash}`);
  if (j.dataset.tab) go(j.dataset.tab);
  const [f, sec, row] = j.dataset.jump.split('/');
  const tr = document.getElementById(`row-${f}-${sec}-${row}`) ?? document.getElementById(`row-${j.dataset.jump.replace(/[^\w-]+/g, '_')}`) ?? document.getElementById(`c-${j.dataset.jump.replace(/[^\w-]+/g, '_')}`)?.closest('tr');
  if (tr) { tr.scrollIntoView({ block: 'center' }); tr.classList.add('flash'); setTimeout(() => tr.classList.remove('flash'), 1300); }
});
$('resetAll').onclick = () => { changes = {}; invalid.clear(); rebuild(); saveSoon(); refreshCustom(); renderAll(); };
$('note').addEventListener('input', () => { note = $('note').value; saveSoon(); });

/* ---------- 확인 ---------- */
function checks() {
  const out = checkElements(W).map(c => ({ ...c }));
  if (mapTab && (changedPrefix('layout') || tab === 'map')) for (const [ok, label, why] of mapTab.checks()) out.push({ tab: 'map', ok, label: `섬 지도: ${label}`, why: ok ? '' : why });
  if (roomTab) for (const [ok, label, why, slug] of roomTab.checks()) if (!ok || changedPrefix(`rooms/${slug}`) || changedPrefix(`places/${slug}`) || changedPrefix(`halls/${slug.replace(/^hall-/, '')}`)) out.push({ tab: 'rooms', hash: `rooms.${slug}`, ok, label, why });
  out.push({ tab: null, ok: invalid.size === 0, label: '잘못 쓴 칸 없음', why: `저장하지 않은 잘못된 칸 ${invalid.size}개 (빨간 테두리)` });
  return out;
}
let lastChecks = [];
function renderChecks() {
  lastChecks = checks();
  const bad = lastChecks.filter(c => !c.ok), good = lastChecks.filter(c => c.ok);
  const li = c => `<li class="${c.ok ? 'ok' : 'bad'}"><span class="mark">${c.ok ? '✓' : '!'}</span><span>${c.tab ? `<a href="#${esc(c.hash ?? c.tab)}" data-go="${esc(c.tab)}" data-hash="${esc(c.hash ?? '')}">${esc(c.label)}</a>` : esc(c.label)}${c.ok ? '' : ` — ${esc(c.why)}`}</span></li>`;
  $('checks').innerHTML = bad.map(li).join('') + `<li class="okfold"><details><summary>통과 ${good.length}개</summary><ul class="checks">${good.map(li).join('')}</ul></details></li>`;
}
$('checks').addEventListener('click', e => {
  const a = e.target.closest('[data-go]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.hash) history.replaceState(null, '', `#${a.dataset.hash}`);
  go(a.dataset.go, { scroll: true });
});

/* ---------- 반영 상태 ---------- */
const histKey = h => `${h.board}-${h.version}`;
function renderStatus() {
  const n = Object.keys(changes).length;
  const ok = !lastChecks.some(c => !c.ok);
  const head = applied
    ? `<b>게임에 들어간 요소 v${applied.version}</b> · ${esc(when(applied.appliedAt))}${applied.summary ? ` · <span class="muted">${esc(applied.summary)}</span>` : ''}`
    : '<b>게임에 들어간 요소</b> <span class="muted">· 아직 요소 반영 기록이 없어요</span>';
  const req = draftStatus === 'requested'
    ? '<p class="small"><b>반영 요청을 표시했어요.</b> 채팅에 <span class="say">"요소 반영"</span>이라고 보내 주세요 (편집기가 Claude 를 직접 부르지는 못해요).</p>' : '';
  const log = hist.length ? `<details><summary>반영 기록 ${hist.length}개 · 되돌리기</summary><ol class="hist">${hist.map(h => `
      <li><span><b>${esc(BOARD_KO[h.board] ?? h.board)} v${h.version}</b> · ${esc(when(h.appliedAt))} · ${esc(h.summary ?? '')}</span>
      <button type="button" class="btn ghost tiny" data-rollback="${esc(histKey(h))}" ${snapOf(h) ? '' : 'disabled'}>이때 값으로 되돌리기</button></li>`).join('')}</ol></details>` : '';
  $('status').innerHTML = `<div class="row">${head}</div>
    <div class="row"><span>${n ? `반영 뒤 바뀐 칸 <b>${n}개</b>` : '<span class="muted">반영한 뒤로 바뀐 칸이 없어요</span>'}</span>
      ${n && !ok ? '<span class="chip bad">확인에 걸린 것이 있어요</span>' : ''}
      <button type="button" class="btn ${n ? 'primary' : 'ghost'}" id="markRequest" ${n ? '' : 'disabled'}>반영 요청 표시</button>
      <span class="small muted">${esc(saveMsg)}</span></div>
    ${req}${log}
    <p class="small muted">${esc(store?.label ?? '')}</p>`;
  $('markRequest').onclick = () => { draftStatus = 'requested'; saveNow(); };
}
/** 기록 하나의 파일 사본 → { 파일 키: 내용 } (요소 = snapshot, 예전 숫자 표 = snapshot.items·rules, 예전 섬 지도 = layout) */
function snapOf(h) {
  if (h.board === 'map') return h.layout ? { layout: h.layout } : null;
  if (h.board === 'data') return h.snapshot ? { items: h.snapshot.items, rules: h.snapshot.rules } : null;
  return h.snapshot && Object.keys(h.snapshot).length ? h.snapshot : null;
}
$('status').addEventListener('click', e => {
  const k = e.target.closest('[data-rollback]')?.dataset.rollback;
  if (!k) return;
  const h = hist.find(x => histKey(x) === k), snap = h && snapOf(h);
  if (!snap) return;
  const next = { ...changes };
  for (const [key, content] of Object.entries(snap)) {
    const cur = getAt(base, key);
    if (!cur) continue;
    for (const p of Object.keys(next)) if (p.startsWith(`${key}/`)) delete next[p];
    const d = diffTables(cur, { ...content, version: cur.version, about: cur.about, note: cur.note });
    for (const [p, v] of Object.entries(d)) if (p) next[`${key}/${p}`] = v;
  }
  changes = prune(next);
  invalid.clear(); draftStatus = 'requested'; rebuild(); saveNow(); refreshCustom(); renderAll();
  saveMsg = `${BOARD_KO[h.board] ?? h.board} v${h.version} 값으로 되돌린 칸을 저장했어요. 채팅에 "요소 반영"이라고 보내 주세요.`;
  renderStatus();
});

function refreshCustom() { mapTab?.refresh(); roomTab?.refresh(); }
function renderAll() { renderTabs(); renderSheet(); renderChanges(); renderChecks(); renderStatus(); }

/* ---------- 시작 ---------- */
const getJSON = p => fetch(p, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); });
async function start() {
  const keys = Object.keys(FILES);
  const [files, idx, furnIdx, fixIdx, places] = await Promise.all([
    Promise.all(keys.map(k => getJSON(FILES[k]))),
    getJSON('assets/interior/index.json'),
    getJSON('assets/furniture/index.json'),
    getJSON('assets/furniture/fixtures/index.json').catch(() => ({ models: [] })),
    Promise.all(PLACE_FILES.map(getJSON)),
  ]);
  const halls = await Promise.all(HALL_FILES.map(getJSON));
  const rooms = await Promise.all((idx.rooms ?? []).map(r => getJSON(`assets/interior/rooms/${r.slug}.json`)));
  base = Object.fromEntries(keys.map((k, i) => [k, files[i]]));
  base.rooms = Object.fromEntries(rooms.map(r => [r.slug, r]));
  base.places = Object.fromEntries(PLACE_KINDS.map((k, i) => [k, places[i]]));
  base.halls = Object.fromEntries(HALLS.map((h, i) => [h, halls[i]]));   // 박물관 관 여섯 RM-25–30 (경로 halls/<관>/…)
  interior = idx; furn = { models: [...furnIdx.models, ...fixIdx.models] };
  rebuild();

  const api = pre => ({
    base: () => getAt(base, pre),
    work: () => getAt(W, pre),
    set: (p, v) => setChange(`${pre}/${p}`, v),
    del: (p, o) => dropChanges(`${pre}/${p}`, o),
    changed: () => Object.keys(changes).filter(k => k.startsWith(pre + '/')).map(k => k.slice(pre.length + 1)),
    onChange: () => { renderTabs(); renderChanges(); renderChecks(); renderStatus(); },
  });
  mapTab = createMapTab($('customMap'), api('layout'));
  roomTab = createRoomTab($('customRooms'), {
    base: () => base, work: () => W, furn, interior,
    set: (p, v) => setChange(p, v),
    changedIn: changedPrefix,
    onChange: () => { renderTabs(); renderChanges(); renderChecks(); renderStatus(); },
  });

  try { const t = localStorage.getItem('elem-editor-tab'); if (t && sheetOf(t)) { tab = t; group = sheetOf(t).group; } } catch {}
  const h = location.hash.slice(1).split('.')[0];
  if (sheetOf(h)) { tab = h; group = sheetOf(h).group; }
  renderAll();
  mapTab.ready.then(() => renderChecks()).catch(e => console.warn('[elem] 섬 지도', e));

  store = await connectStore();
  if (!store) { saveMsg = '이 화면에서는 저장소를 쓸 수 없어요. 고쳐 볼 수는 있지만 저장되지 않아요.'; renderStatus(); return; }
  me = await store.who();
  writable = await store.canWrite();
  saveMsg = writable ? '고치면 바로 저장돼요' : '이 링크에서는 볼 수만 있어요. 고쳐 볼 수는 있지만 저장되지 않아요.';
  // 예전 숫자 표 초안(drafts/data)이 남아 있으면 처음 한 번 옮겨 온다 (경로 모양이 같다)
  const old = await store.getDoc('drafts/data');
  let first = true;
  store.watchDoc('drafts/elem', d => {
    const moved = !d && first && old?.changes && Object.keys(old.changes).length ? { changes: old.changes, note: old.note ?? '' } : null;
    const src = d ?? moved;
    const incoming = { changes: prune(src?.changes), note: src?.note ?? '', status: src?.status ?? 'editing', basedOn: versions() };
    const sig = canon(incoming);
    if (!first && (saveTimer || sig === lastSaved || document.activeElement?.closest?.('#sheet, #note, #customMap, #customRooms'))) return;
    first = false;
    ({ changes, note, status: draftStatus } = incoming);
    lastSaved = moved ? '' : sig;
    $('note').value = note;
    rebuild(); refreshCustom(); renderAll();
    if (moved) saveSoon();
  });
  store.watchDoc('applied/elem', d => { applied = d; renderStatus(); });
  store.watchHistory(rows => { hist = rows.sort((a, b) => (b.appliedAt ?? 0) - (a.appliedAt ?? 0) || b.version - a.version); renderStatus(); });
}
start().catch(e => { $('status').innerHTML = `<p style="color:var(--warn)">표를 불러오지 못했어요: ${esc(e?.message ?? e)}. 새로고침해 보세요.</p>`; console.error(e); });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1).split('.')[0]; if (sheetOf(h) && h !== tab) go(h); else if (h === 'rooms') roomTab?.show(location.hash.match(/^#rooms\.([\w-]+)/)?.[1]); });
