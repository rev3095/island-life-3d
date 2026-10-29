// "지도 반영" · "숫자 반영" 때 편집기 초안(drafts/map · drafts/data)의 바뀐 칸을 JSON 파일에 얹는다.
//   node tools/apply-edits.mjs map  <초안.json> [--dry]   → assets/island/layout.json
//   node tools/apply-edits.mjs data <초안.json> [--dry]   → assets/data/items.json · rules.json
// <초안.json> = ArtifactData get 으로 받은 문서 그대로 ({ changes, note, … }) 또는 changes 만.
// 바뀐 파일은 version +1. 표에 없는 칸이 하나라도 있으면 아무것도 쓰지 않고 exit 1. 뒤이어 node --test tests/ 로 검사한다.
// 순서 전체는 docs/notes/m6-p5-mapdata.md 「지도 반영」·「숫자 반영」.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyChanges, pretty, splitPath } from './edits.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const FILES = {
  map: { layout: 'assets/island/layout.json' },
  data: { items: 'assets/data/items.json', rules: 'assets/data/rules.json' },
};
const fmt = v => (v === undefined ? '(없음)' : JSON.stringify(v));

/** kind 의 파일들에 changes 를 얹어 본다 → { files: { 이름: { path, before, after, applied } }, errors, unchanged } */
export function plan(kind, changes, read = p => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8'))) {
  const files = {}, errors = [], unchanged = [];
  const groups = {};
  for (const [path, v] of Object.entries(changes ?? {})) {
    const [head, ...rest] = splitPath(path);
    const file = kind === 'map' ? 'layout' : head;
    const sub = kind === 'map' ? path : rest.join('/');
    if (!FILES[kind][file]) { errors.push({ path, why: `파일 이름 '${head}' (items · rules)` }); continue; }
    (groups[file] ??= {})[sub] = v;
  }
  for (const [file, ch] of Object.entries(groups)) {
    const before = read(FILES[kind][file]);
    const r = applyChanges(before, ch);
    const pre = kind === 'map' ? '' : `${file}/`;
    errors.push(...r.errors.map(e => ({ ...e, path: pre + e.path })));
    unchanged.push(...r.unchanged.map(p => pre + p));
    if (r.applied.length) files[file] = { path: FILES[kind][file], before, after: { ...r.out, version: (before.version ?? 0) + 1 }, applied: r.applied.map(a => ({ ...a, path: pre + a.path })) };
  }
  return { files, errors, unchanged };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [kind, draftPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  if (!FILES[kind] || !draftPath) {
    console.error('쓰는 법: node tools/apply-edits.mjs map|data <초안.json> [--dry]');
    process.exit(2);
  }
  const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
  const changes = draft.changes ?? draft;
  const { files, errors, unchanged } = plan(kind, changes);
  for (const f of Object.values(files)) {
    console.log(`${f.path}  (version ${f.before.version ?? 0} → ${f.after.version})`);
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
  else for (const f of Object.values(files)) writeFileSync(`${ROOT}/${f.path}`, pretty(f.after) + '\n');
}
