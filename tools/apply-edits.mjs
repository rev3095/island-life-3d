// "요소 반영" (예전 "지도 반영" · "숫자 반영") 때 편집기 초안의 바뀐 칸을 JSON 파일에 얹는다.
//   node tools/apply-edits.mjs elem <초안.json> [--dry]   → 요소 편집기 drafts/elem (첫 칸 = 파일 이름, 아래 ELEM_FILES)
//   node tools/apply-edits.mjs map  <초안.json> [--dry]   → assets/island/layout.json (예전 섬 지도 편집기 drafts/map, 경로에 파일 이름 없음)
//   node tools/apply-edits.mjs data <초안.json> [--dry]   → assets/data/items.json · rules.json (예전 숫자 표 drafts/data)
// <초안.json> = 저장소 문서 그대로 ({ changes, note, … }) 또는 changes 만.
// 바뀐 파일은 version +1. 방 배치(rooms/<slug>)를 고치면 assets/interior/index.json 의 그 방 줄(name·wallpaper·floor·version)도 맞춘다.
// 표에 없는 칸이 하나라도 있으면 아무것도 쓰지 않고 exit 1. 뒤이어 node --test tests/ 로 검사한다.
// 순서 전체는 docs/notes/p36-elem-editor.md 「요소 반영」 (예전 흐름은 docs/notes/m6-p5-mapdata.md).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyChanges, pretty, splitPath } from './edits.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** 요소 편집기 경로의 첫 칸 → 파일. rooms·places 는 둘째 칸이 slug (rooms/rm-01/furniture → assets/interior/rooms/rm-01.json 의 furniture) */
export const ELEM_FILES = {
  items: 'assets/data/items.json',
  rules: 'assets/data/rules.json',
  layout: 'assets/island/layout.json',
  events: 'assets/events/events.json',
  night: 'assets/night/night.json',
  tour: 'assets/tour/tour.json',
  rooms: slug => `assets/interior/rooms/${slug}.json`,
  places: slug => `assets/interior/places/${slug}.json`,
};
export const FILES = {
  map: { layout: 'assets/island/layout.json' },
  data: { items: 'assets/data/items.json', rules: 'assets/data/rules.json' },
};
export const INTERIOR_INDEX = 'assets/interior/index.json';
const fmt = v => (v === undefined ? '(없음)' : JSON.stringify(v));

/** 요소 편집기 경로 → { key: 'events' | 'rooms/rm-01', file, sub: 파일 안 경로 } (모르는 파일이면 null) */
export function elemTarget(path) {
  const [head, ...rest] = splitPath(path);
  const f = ELEM_FILES[head];
  if (!f) return null;
  if (typeof f === 'function') {
    const [slug, ...sub] = rest;
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
    return { key: `${head}/${slug}`, file: f(slug), sub: sub.join('/') };
  }
  return { key: head, file: f, sub: rest.join('/') };
}

/** kind 의 파일들에 changes 를 얹어 본다 → { files: { 이름: { path, before, after, applied } }, errors, unchanged } */
export function plan(kind, changes, read = p => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8')), exists = p => existsSync(`${ROOT}/${p}`)) {
  const files = {}, errors = [], unchanged = [];
  const groups = {}, where = {};
  for (const [path, v] of Object.entries(changes ?? {})) {
    let key, file, sub;
    if (kind === 'elem') {
      const t = elemTarget(path);
      if (!t) { errors.push({ path, why: `파일 이름 '${splitPath(path)[0]}' (${Object.keys(ELEM_FILES).join(' · ')})` }); continue; }
      if (!exists(t.file)) { errors.push({ path, why: `파일이 없어요: ${t.file}` }); continue; }
      ({ key, file, sub } = t);
    } else {
      const [head, ...rest] = splitPath(path);
      key = kind === 'map' ? 'layout' : head;
      sub = kind === 'map' ? path : rest.join('/');
      file = FILES[kind][key];
      if (!file) { errors.push({ path, why: `파일 이름 '${head}' (items · rules)` }); continue; }
    }
    if (!sub) { errors.push({ path, why: '파일 통째로는 바꿀 수 없어요' }); continue; }
    (groups[key] ??= {})[sub] = v;
    where[key] = file;
  }
  for (const [key, ch] of Object.entries(groups)) {
    const before = read(where[key]);
    const r = applyChanges(before, ch);
    const pre = kind === 'map' ? '' : `${key}/`;
    errors.push(...r.errors.map(e => ({ ...e, path: pre + e.path })));
    unchanged.push(...r.unchanged.map(p => pre + p));
    if (r.applied.length) files[key] = { path: where[key], before, after: { ...r.out, version: (before.version ?? 0) + 1 }, applied: r.applied.map(a => ({ ...a, path: pre + a.path })) };
  }
  // 방 파일을 고치면 목록(interior/index.json)의 그 방 줄도 같게 (tests/interior.test.mjs 가 본다)
  const rooms = Object.entries(files).filter(([k]) => k.startsWith('rooms/'));
  if (rooms.length && exists(INTERIOR_INDEX)) {
    const before = read(INTERIOR_INDEX);
    const after = structuredClone(before);
    const applied = [];
    for (const [, f] of rooms) {
      const row = after.rooms?.find(r => r.slug === f.after.slug);
      if (!row) continue;
      for (const k of ['name', 'wallpaper', 'floor', 'version', 'status']) {
        if (f.after[k] !== undefined && row[k] !== f.after[k]) { applied.push({ path: `interior-index/rooms/${row.slug}/${k}`, from: row[k], to: f.after[k] }); row[k] = f.after[k]; }
      }
    }
    if (applied.length) files['interior-index'] = { path: INTERIOR_INDEX, before, after, applied, keepVersion: true };
  }
  return { files, errors, unchanged };
}

/** JSON 글을 읽으며 칸마다 원래 글 자리를 남긴다 → { s, e, kids } (kids: 객체 = { 키: 노드 }, 배열 = [노드]) */
function parseSpans(text) {
  let i = 0;
  const ws = () => { while (/\s/.test(text[i])) i++; };
  const node = () => {
    ws();
    const s = i, c = text[i];
    if (c === '{' || c === '[') {
      const obj = c === '{', kids = obj ? {} : [];
      i++; ws();
      if (text[i] === (obj ? '}' : ']')) { i++; return { s, e: i, kids }; }
      for (;;) {
        if (obj) { const k = node(); ws(); i++; kids[JSON.parse(text.slice(k.s, k.e))] = node(); } else kids.push(node());
        ws();
        if (text[i] === ',') { i++; continue; }
        i++; return { s, e: i, kids };
      }
    }
    if (c === '"') { i++; while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1; i++; return { s, e: i }; }
    while (i < text.length && !/[\s,\]}]/.test(text[i])) i++;
    return { s, e: i };
  };
  return node();
}
/**
 * 파일이 쓰던 모양 그대로 다시 쓰기 — 값이 같은 칸은 원래 글 그대로, 바뀐 칸은 원래 한 줄이면 한 줄로, 여러 줄이면 여러 줄로,
 * 새로 생긴 칸은 pretty 규칙 (방 목록 interior/index.json 처럼 줄 모양이 섞인 파일도 diff 가 바뀐 줄만 나오게).
 */
export function formatLike(text, obj) {
  const src = text.replace(/\r\n/g, '\n');
  const old = JSON.parse(src), root = parseSpans(src);
  const sameV = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const emit = (v, o, sp, ind) => {
    if (sp && sameV(v, o)) return src.slice(sp.s, sp.e);
    if (v === null || typeof v !== 'object' || !sp?.kids || Array.isArray(v) !== Array.isArray(o)) return pretty(v, ind);
    if (!src.slice(sp.s, sp.e).includes('\n')) return pretty(v, '    ');   // 원래 한 줄 → 한 줄 (pretty 는 들여쓰기 4칸부터 한 줄)
    const ni = ind + '  ';
    if (Array.isArray(v)) return `[\n${v.map((x, k) => ni + emit(x, o[k], sp.kids[k], ni)).join(',\n')}\n${ind}]`;
    return `{\n${Object.keys(v).map(k => `${ni}${JSON.stringify(k)}: ${emit(v[k], o?.[k], sp.kids[k], ni)}`).join(',\n')}\n${ind}}`;
  };
  return emit(obj, old, root, '') + '\n';
}
/** 바뀐 파일 쓰기 (원래 모양대로, 끝 줄바꿈 — 윈도우에서도 \n) */
export function write(files) {
  for (const f of Object.values(files)) writeFileSync(`${ROOT}/${f.path}`, formatLike(readFileSync(`${ROOT}/${f.path}`, 'utf8'), f.after));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [kind, draftPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  if (!['elem', 'map', 'data'].includes(kind) || !draftPath) {
    console.error('쓰는 법: node tools/apply-edits.mjs elem|map|data <초안.json> [--dry]');
    process.exit(2);
  }
  const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
  const changes = draft.changes ?? draft;
  const { files, errors, unchanged } = plan(kind, changes);
  for (const f of Object.values(files)) {
    console.log(f.keepVersion ? `${f.path}  (목록 줄 맞춤)` : `${f.path}  (version ${f.before.version ?? 0} → ${f.after.version})`);
    for (const a of f.applied) console.log(`  ${a.path}: ${fmt(a.from)} → ${fmt(a.to)}`);
  }
  if (unchanged.length) console.log(`이미 같은 값 ${unchanged.length}칸: ${unchanged.join(', ')}`);
  if (errors.length) {
    for (const e of errors) console.error(`  ✖ ${e.path}: ${e.why}`);
    console.error('표에 없는 칸이 있어 아무것도 쓰지 않았어요.');
    process.exit(1);
  }
  if (!Object.keys(files).length) console.log('바뀐 칸이 없어요.');
  else if (dry) console.log('(--dry: 쓰지 않음)');
  else write(files);
}
