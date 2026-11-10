// 편집기 홈 「전체 관리」 목록 — 저장소의 스펙·데이터·보드 결정을 읽어 홈 저장소 catalog/<분류> 문서를 만든다.
//   node tools/hub-catalog.mjs [--boards <보드 반영.json>] [--out <폴더>] [--local] [--print]
// 홈(아티팩트)은 다른 아티팩트 저장소도 저장소 파일도 못 읽어서, "전체 요청 확인"·각 반영 끝에 Claude 가 이걸 돌려
// 나온 문서를 ArtifactData 로 홈 저장소에 써 넣는다 (catalog/<분류> 13개 + meta/catalog).
//   --boards  보드마다 applied 문서 {wave5: {version, picks}, …} (ArtifactData get 결과의 data 그대로) → 결정 줄에 고른 안
//   --out     문서를 쓸 폴더 (기본 assets/review/hub — gitignore). <out>/catalog/<분류>.json · <out>/meta-catalog.json
//   --local   dev-server 흉내도 고친다: assets/review/hub-catalog.json (행마다 docId) · hub-meta.json 의 catalog 행
// 문서 모양·처리 순서는 concept/README.md 「전체 관리」·「"전체 요청 확인"」.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const ENV_CAT = { nature: '자연', prop: '소품', building: '건물', tile: '타일' };
const ITEM_GROUP = { fish: '물고기', bug: '곤충', fossil: '화석', fruit: '과일', shell: '조개', flower: '꽃', mat: '재료', seed: '씨앗', tool: '도구', festival: '축제' };
const LAYOUT = {   // assets/island/layout.json 칸 → 이름 (섬 지도 편집기와 같은 말)
  seed: '섬 시드', pond: '연못·폭포', bridges: '다리', ramps: '비탈', dock: '선착장', plaza: '광장',
  museum: '박물관 (언덕 위)', museumLow: '박물관 아래 자리', shop: '도토리상점', playerHouse: '내 집',
  villagers: '주민 집 자리', orchard: '과수원 언덕', rocks: '바위', festival: '축제 광장', density: '나무·꽃 밀도',
};
// 파일이 없지만 편집기에 자리가 있는 것 (배경 편집기 RM07 상수 — 만들면 파일이 생겨 이 줄은 저절로 빠진다)
const PENDING_ROOMS = [{ id: 'RM-07', slug: 'rm-07', name: '단풍 방', ownerName: '단풍' }];

/**
 * 분류 표. how: spec = 파일의 status(approved|review)가 상태 · value = 값 데이터(확정·검수 단계 없음, 홈 marks 로만 표시) · board = 보드 결정.
 * hash(it) = 그 편집기 주소 끝 #… (그 요소로 바로 감). 없으면 편집기 첫 화면.
 */
export const GROUPS = [
  { id: 'character', label: '캐릭터', editor: 'character', how: 'spec' },
  { id: 'villager', label: '주민 성격·대화', editor: 'character', how: 'spec' },
  { id: 'env', label: '배경', editor: 'env', how: 'spec' },
  { id: 'furniture', label: '가구', editor: 'env', how: 'spec' },
  { id: 'item', label: '아이템', editor: 'env', how: 'spec' },
  { id: 'interior', label: '벽지·바닥', editor: 'env', how: 'spec' },
  { id: 'room', label: '방 배치', editor: 'elem', how: 'spec' },   // P36: 방·가게 가구 배치는 요소 편집기 「방 배치」 탭 (#rooms.<slug>)
  { id: 'scene', label: '장면', editor: 'story', how: 'spec' },
  { id: 'sound', label: '소리', editor: 'sound', how: 'value' },
  { id: 'map', label: '섬 지도', editor: 'elem', how: 'value' },          // P36: 요소 편집기 「섬 지도」 탭
  { id: 'data', label: '요소 값', editor: 'elem', how: 'value' },         // P36: 요소 편집기의 값 표 (상점·아이템·규칙·행사·밤·투어·이사)
  { id: 'style', label: '스타일', editor: 'style', how: 'value' },
  { id: 'decision', label: '보드 결정', editor: null, how: 'board' },
];

/* ---------- 읽기 ---------- */
function reader(root) {
  const text = p => readFileSync(resolve(root, p), 'utf8');
  const json = p => JSON.parse(text(p));
  const dir = d => readdirSync(resolve(root, d)).filter(f => f.endsWith('.json')).sort().map(f => ({ file: `${d}/${f}`, data: json(`${d}/${f}`) }));
  return { text, json, dir, has: p => existsSync(resolve(root, p)) };
}
/** editors.html 의 editors-list (홈 목록 = 링크의 원본) */
export function editorsList(html) {
  const m = html.match(/<script type="application\/json" id="editors-list">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('editors.html 에 editors-list 가 없어요');
  return JSON.parse(m[1]);
}
/** 보드 html 의 const DECISIONS = [ … ] 를 꺼내 값으로 (보드 페이지 글 그대로 — 따옴표 안 괄호는 건너뜀) */
export function boardDecisions(html) {
  const at = html.indexOf('const DECISIONS = [');
  if (at < 0) return [];
  let i = html.indexOf('[', at), depth = 0, q = null;
  const start = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) break;
  }
  return vm.runInNewContext(`(${html.slice(start, i + 1)})`, {});
}
const version = v => (v === undefined || v === null ? null : v);
const stateOf = s => (s === 'approved' ? 'approved' : 'review');   // 스펙에 status 가 없으면 검수 대기 (tests/assets.test.mjs 와 같은 규칙)

/* ---------- 분류마다 줄 ---------- */
function rowsFor(g, R, ctx) {
  const L = ctx.links;
  switch (g.id) {
    case 'character':
      return R.dir('assets/specs').map(({ file, data: s }) => ({ id: s.slug, ref: s.id, name: s.name, sub: s.role ?? '', state: stateOf(s.status), version: version(s.version), hash: s.slug, file }));
    case 'villager': {
      const role = Object.fromEntries(R.dir('assets/specs').map(({ data: s }) => [s.slug, s.role]));
      return R.dir('assets/villagers').filter(({ data: v }) => v.slug).map(({ file, data: v }) => ({
        id: v.slug, ref: v.id ?? '', name: `${v.name} 성격·대화`, sub: role[v.slug] ?? '', state: stateOf(v.status), version: version(v.version), hash: `${v.slug}.talk`, file }));
    }
    case 'env':
      return R.dir('assets/env/specs').map(({ file, data: s }) => ({
        id: s.slug, ref: s.id, name: s.name, sub: `${ENV_CAT[s.category] ?? s.category}${s.slug.startsWith('festival-') ? ' · 축제' : ''}`,
        state: stateOf(s.status), version: version(s.version), hash: s.slug, file }));
    case 'furniture': {
      const rows = R.dir('assets/furniture/specs').map(({ file, data: s }) => ({
        id: s.slug, ref: s.id, name: s.name, sub: s.variants ? `색 ${Object.keys(s.variants).length}가지` : '', state: stateOf(s.status), version: version(s.version), hash: `furn-${s.slug}`, file }));
      // 상점·박물관 붙박이 FU-35–42 (가구 탭 밖, 배경 편집기에서는 그 실내의 방 배치 격자에 보인다 → 그 방으로 링크)
      // 붙박이 → 처음 쓴 방 (상점·박물관 — M12 달빛 가게·천막도 FU-35·36 을 다시 쓰지만 링크는 원래 방으로)
      const placeOf = Object.fromEntries(R.dir('assets/interior/places').flatMap(({ data: r }) => [...(r.furniture ?? []).map(f => f.fu), ...(r.cases ?? []).map(c => c.fixture)].filter(Boolean).map(k => [k, r.slug])).reverse().filter(([k, slug]) => ['shop', 'museum'].includes(slug)));
      for (const { file, data: s } of R.dir('assets/furniture/fixtures/specs')) {
        const place = placeOf[s.id] ?? placeOf[s.slug];
        rows.push({ id: `fix-${s.slug}`, ref: s.id, name: s.name, sub: `붙박이 · ${place === 'museum' ? '박물관' : '도토리상점'}`, state: stateOf(s.status), version: version(s.version), hash: place ? `place-${place}` : null, file });
      }
      return rows;
    }
    case 'item':
      return R.dir('assets/items/specs').map(({ file, data: s }) => {
        const n = Array.isArray(s.items) ? s.items.length : 1;
        return { id: s.slug, ref: s.id, name: s.name, sub: `${ITEM_GROUP[s.group] ?? s.group}${n > 1 ? ` · 아이콘 ${n}` : ''}`, icons: n,
          state: stateOf(s.status), version: version(s.version), hash: `item-${s.slug}`, file };
      });
    case 'interior':
      return R.dir('assets/interior/specs').filter(({ data: s }) => s.kind === 'wallpaper' || s.kind === 'floor').map(({ file, data: s }) => ({
        id: s.slug, ref: s.id, name: s.name, sub: s.kind === 'wallpaper' ? '벽지' : '바닥', state: stateOf(s.status), version: version(s.version), hash: s.slug, file }));
    case 'room': {
      const rows = R.dir('assets/interior/rooms').map(({ file, data: r }) => ({
        id: r.slug, ref: r.id, name: r.name, sub: `${r.ownerName ?? r.owner} 방`, state: stateOf(r.status), version: version(r.version), hash: `rooms.${r.slug}`, file }));
      for (const p of PENDING_ROOMS) if (!rows.some(r => r.id === p.slug)) rows.push({
        id: p.slug, ref: p.id, name: p.name, sub: `${p.ownerName} 방 · 파일 없음`, state: 'new', version: null, hash: null, file: null });
      // 상점·박물관·달빛 가게·새벽 천막 (RM-08–11): 요소 편집기 방 배치 #rooms.<slug>
      for (const { file, data: r } of R.dir('assets/interior/places')) rows.push({
        id: `place-${r.slug}`, ref: r.id, name: r.name, sub: `${r.size?.join('×') ?? ''} 실내`, state: stateOf(r.status), version: version(r.version), hash: `rooms.${r.slug}`, file });
      return rows;
    }
    case 'scene': {
      const order = R.json('assets/story/index.json').timeline.filter(t => t.scene).map(t => t.scene);
      const rows = R.dir('assets/story/scenes').map(({ file, data: s }) => ({
        id: s.id, ref: s.id.split('-')[0], name: s.title, sub: `${s.chapter ?? ''}${s.pick ? ` · 연출안 ${s.pick}` : ''}`, state: stateOf(s.status), version: version(s.version), hash: null, file }));
      return rows.sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999));
    }
    case 'sound': {
      const ix = R.json('assets/sound/index.json'), sfx = R.json('assets/sound/sfx.json'), vo = R.json('assets/sound/voices.json');
      const songs = ix.songs.map(id => {
        const s = R.json(`assets/sound/songs/${id}.json`);
        return { id: `song-${id}`, ref: s.code ?? id, name: `곡 · ${s.title}`, sub: s.mood ?? '', state: 'approved', version: version(s.version), hash: 'songs', file: `assets/sound/songs/${id}.json` };
      });
      return [...songs,
        { id: 'schedule', ref: 'BGM', name: '선곡 표 (시간대·날씨·자리·창마다 곡)', sub: '', state: 'approved', version: version(ix.version), hash: 'schedule', file: 'assets/sound/index.json' },
        ...Object.entries(sfx.sfx).map(([k, v]) => ({ id: `sfx-${k}`, ref: 'SFX', name: `효과음 · ${v.label ?? k}`, sub: k, state: 'approved', version: version(sfx.version), hash: 'sfx', file: 'assets/sound/sfx.json' })),
        ...Object.entries(vo.voices).map(([k, v]) => ({ id: `voice-${k}`, ref: 'VO', name: `목소리 · ${v.name ?? k}`, sub: v.desc ?? '', state: 'approved', version: version(vo.version), hash: 'voices', file: 'assets/sound/voices.json' })),
      ];
    }
    case 'map': {
      const lay = R.json('assets/island/layout.json');
      return Object.keys(lay).filter(k => k !== 'version' && k !== 'about').map(k => {
        const v = lay[k];
        const n = Array.isArray(v) && Array.isArray(v[0]) ? v.length : (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).length : 0);
        const sub = k === 'density' ? `값 ${n}개` : n ? `${n}곳` : k === 'seed' ? String(v) : '';
        return { id: k, ref: 'MAP', name: LAYOUT[k] ?? k, sub, state: 'approved', version: version(lay.version), hash: 'map', file: 'assets/island/layout.json' };
      });
    }
    case 'data': {
      const SHEET_FILE = { events: 'assets/events/events.json', night: 'assets/night/night.json', tour: 'assets/tour/tour.json' };
      const files = { items: R.json('assets/data/items.json'), rules: R.json('assets/data/rules.json') };
      // 요소 편집기의 값 표 = elem-editor/sheets.js SHEETS 의 id·이름 (주소 끝 #<표 id> 로 그 표가 열린다). 섬 지도·방 배치 탭은 map·room 분류가 따로 센다
      const sheets = [...R.text('elem-editor/sheets.js').split('export const SHEETS')[1].matchAll(/^ {2}\{ id: '(\w+)', name: '([^']+)'(?:, group: '\w+')?(?:, file: '(\w+)', section: '(\w+)')?/gm)].filter(([, id]) => !['map', 'rooms'].includes(id));
      return sheets.map(([, id, name, file, section]) => {
        const src = file ? files[file]?.[section] : null;
        const path = SHEET_FILE[id] ?? `assets/data/${file ?? 'rules'}.json`;
        return { id, ref: 'DATA', name, sub: Array.isArray(src) ? `${src.length}줄` : '', state: 'approved',
          version: version(SHEET_FILE[id] ? R.json(path).version : files[file ?? 'rules'].version), hash: id, file: path };
      });
    }
    case 'style': {
      const st = R.json('assets/style/presets.json');
      return [
        ...Object.keys(st.presets).map(k => ({ id: k, ref: 'STYLE', name: st.labels?.[k] ?? k, sub: k === st.default ? '기본 프리셋' : '프리셋', state: 'approved', version: version(st.version), hash: null, file: 'assets/style/presets.json' })),
        ...Object.keys(st.indoor ?? {}).map(k => ({ id: `indoor-${k}`, ref: 'STYLE', name: `집 안 덧씌우기 · ${st.labels?.[k] ?? k}`, sub: '실내', state: 'approved', version: version(st.version), hash: null, file: 'assets/style/presets.json' })),
      ];
    }
    case 'decision':
      return ctx.list.filter(e => e.group === 'board').sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true })).flatMap(b => {
        // 다른 브랜치에서 막 생긴 보드는 합치기 전엔 파일이 없다 → 건너뛰고 알린다 (합친 뒤 다시 돌리면 들어간다)
        if (!R.has(b.file)) { ctx.skipped.push(`${b.id} (${b.file} 없음)`); return []; }
        const ap = ctx.boards?.[b.id] ?? null;
        return boardDecisions(R.text(b.file)).map(d => {
          const rec = d.opts.find(o => o[3])?.[0] ?? null;
          const pick = ap?.picks?.[d.id] ?? null;
          const opt = d.opts.find(o => o[0] === pick);
          const note = ap?.notes?.[d.id] ? ` · 의견: ${String(ap.notes[d.id]).slice(0, 60)}` : '';
          return { id: d.id, ref: d.id, name: d.q, sub: `${b.id} · ${pick ? `고른 안 ${pick}${opt ? ` ${opt[1]}` : ''}` : '아직 안 고름'}${rec && pick && rec !== pick ? ` (추천 ${rec})` : ''}${note}`,
            state: pick ? 'approved' : 'review', version: version(ap?.version), board: b.id, pick, rec, link: b.url, file: b.file };
        });
      }).sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
  }
  throw new Error(`모르는 분류 ${g.id}`);
}

/**
 * 저장소 전체를 읽어 분류마다 문서 → { docs: {<분류>: catalog 문서}, meta: meta/catalog 문서 }
 * boards = {wave5: {version, picks}, …} (없으면 결정은 "아직 안 고름" 대신 반영 버전 없이)
 */
export function buildCatalog({ root = ROOT, boards = null, now = Date.now(), commit = gitHead(root) } = {}) {
  const R = reader(root);
  const list = editorsList(R.text('editors.html'));
  const byId = Object.fromEntries(list.map(e => [e.id, e]));
  const docs = {}, skipped = [];
  for (const g of GROUPS) {
    const ed = g.editor ? byId[g.editor] : null;
    const items = rowsFor(g, R, { list, boards, skipped }).map(({ hash, ...it }) => ({
      ...it, link: it.link ?? (ed?.url ? ed.url + (hash ? `#${hash}` : '') : null) }));
    const count = s => items.filter(i => i.state === s).length;
    docs[g.id] = {
      group: g.id, label: g.label, editor: g.editor, editorName: ed?.name ?? '검수 보드', how: g.how,
      count: items.length, approved: count('approved'), review: count('review'), new: count('new'),
      ...(g.id === 'item' ? { icons: items.reduce((n, i) => n + (i.icons ?? 1), 0) } : {}),
      items, builtAt: now, commit, by: 'claude',
    };
  }
  const meta = {
    at: now, commit, by: 'claude',
    total: Object.values(docs).reduce((n, d) => n + d.count, 0),
    review: Object.values(docs).reduce((n, d) => n + d.review + d.new, 0),
    groups: GROUPS.map(g => ({ id: g.id, label: g.label, count: docs[g.id].count, review: docs[g.id].review, new: docs[g.id].new })),
    ...(skipped.length ? { skipped } : {}),
  };
  return { docs, meta, skipped };
}
function gitHead(root) {
  try { return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

/* ---------- 실행 ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const boardsPath = opt('--boards');
  const boards = boardsPath ? JSON.parse(readFileSync(boardsPath, 'utf8')) : null;
  const out = resolve(ROOT, opt('--out') ?? 'assets/review/hub');
  const { docs, meta, skipped } = buildCatalog({ boards });
  mkdirSync(join(out, 'catalog'), { recursive: true });
  for (const [id, d] of Object.entries(docs)) writeFileSync(join(out, 'catalog', `${id}.json`), JSON.stringify(d, null, 1));
  writeFileSync(join(out, 'meta-catalog.json'), JSON.stringify(meta, null, 1));
  if (args.includes('--local')) {
    const rev = resolve(ROOT, 'assets/review');
    mkdirSync(rev, { recursive: true });
    writeFileSync(join(rev, 'hub-catalog.json'), JSON.stringify(Object.entries(docs).map(([id, d]) => ({ ...d, docId: id, id })), null, 1));
    const metaFile = join(rev, 'hub-meta.json');
    const rows = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')).filter(r => r.docId !== 'catalog') : [];
    writeFileSync(metaFile, JSON.stringify([...rows, { ...meta, docId: 'catalog', id: 'catalog' }], null, 1));
  }
  const size = d => Buffer.byteLength(JSON.stringify(d));
  console.log(`catalog ${Object.keys(docs).length}개 → ${out} (커밋 ${meta.commit ?? '?'})`);
  for (const d of Object.values(docs)) console.log(`  ${d.group.padEnd(10)} ${String(d.count).padStart(3)}개 · 확정 ${d.approved} · 검수 대기 ${d.review}${d.new ? ` · 새로 ${d.new}` : ''} · ${(size(d) / 1024).toFixed(1)} KB`);
  console.log(`  합계 ${meta.total}개 · 검수 대기·새로 ${meta.review}${boards ? '' : ' (--boards 없음: 보드 결정은 "아직 안 고름")'}`);
  if (skipped.length) console.warn(`  ⚠ 건너뛴 보드: ${skipped.join(', ')} — 그 브랜치를 합친 뒤 다시 돌린다`);
  if (args.includes('--print')) console.log(JSON.stringify(meta, null, 1));
}
