// "스토리 반영" 때 스토리 편집기 「그 밖의 글」 탭 초안(texts/<id>)의 바뀐 글을 파일에 얹는다 (P36).
//   node tools/apply-texts.mjs <초안.json> [--dry]
// <초안.json> = 저장소 문서 그대로 ({ which: 'night'|'events'|'tour'|'daily', file, base, changes: { '<파일 안 경로>': '새 글' }, request }).
// 고칠 수 있는 것: 지금 파일에서 글(한글이 든 문자열)인 칸만 — 숫자·때·id·구조는 「요소」 편집기 몫이라 여기서는 막는다.
// 파일 모양(줄바꿈·들여쓰기)은 그대로 두려고 글자 단위로 바꾸고, 결과를 다시 읽어 기대한 값과 같은지 본다 (다르면 JSON.stringify 2칸으로 통째로).
// 바뀐 파일은 version +1. 기준 버전(base)이 지금 파일과 다르면 알린다. 걸리는 칸이 하나라도 있으면 아무것도 쓰지 않고 exit 1.
// 순서 전체는 docs/notes/p36-story-editor.md 「스토리 반영」.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getAt, same, splitPath } from './edits.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** 이 탭이 고치는 파일 (편집기 story-editor/words.js TEXT_FILES 와 같다) */
export const TEXT_FILES = { night: 'assets/night/night.json', events: 'assets/events/events.json', tour: 'assets/tour/tour.json', daily: 'assets/daily/daily.json' };   // daily = M13 섬 일상 (M17-P4)
const SKIP = new Set(['about', 'note', 'id', 'sym', 'color', 'kind', 'host', 'keeper', 'building', 'lanterns', 'side', 'near']);
const isText = (root, path) => typeof getAt(root, path) === 'string' && /[가-힣]/.test(getAt(root, path)) && !splitPath(path).some(k => SKIP.has(k));

function setAt(root, path, v) {
  const s = splitPath(path);
  let cur = root;
  for (const k of s.slice(0, -1)) cur = cur[k];
  cur[s.at(-1)] = v;
}

/** 초안 하나를 얹어 본다 → { file, before, after, text, applied, errors, warnings } */
export function plan(draft, read = p => readFileSync(`${ROOT}/${p}`, 'utf8')) {
  const errors = [], warnings = [], applied = [];
  const id = draft?.which ?? draft?.docId ?? draft?.id;   // 편집기는 which 에 적는다 (저장소 행의 id 와 겹치지 않게)
  const file = TEXT_FILES[id];
  if (!file) return { errors: [{ path: 'id', why: `모르는 글 파일 "${id}" (${Object.keys(TEXT_FILES).join('·')})` }], warnings, applied };
  if (draft.file && draft.file !== file) errors.push({ path: 'file', why: `${id} 의 파일은 ${file}` });
  const src = read(file), before = JSON.parse(src);
  if (draft.base != null && draft.base !== (before.version ?? 0)) warnings.push(`기준 v${draft.base} 로 고친 초안인데 지금 파일은 v${before.version ?? 0} — 칸 단위로 얹어요`);
  const after = structuredClone(before);
  for (const [p, v] of Object.entries(draft.changes ?? {})) {
    if (!isText(before, p)) { errors.push({ path: p, why: '글 칸이 아니에요 (숫자·때·이름표 id 는 「요소」 편집기에서)' }); continue; }
    if (typeof v !== 'string' || !v.trim()) { errors.push({ path: p, why: '빈 글은 넣을 수 없어요' }); continue; }
    if (v.length > 200) { errors.push({ path: p, why: '200자보다 길어요' }); continue; }
    if (getAt(before, p) === v) continue;
    applied.push({ path: p, from: getAt(before, p), to: v });
    setAt(after, p, v);
  }
  if (!applied.length) return { file, before, after: before, text: src, applied, errors, warnings };
  after.version = (before.version ?? 0) + 1;
  // 글자 단위로 바꾸기: 옛 글이 파일에 한 번만 있고 바꾸는 것도 그 하나일 때
  let text = src, ok = true;
  for (const a of applied) {
    const from = JSON.stringify(a.from), n = text.split(from).length - 1;
    if (n !== 1) { ok = false; break; }
    text = text.replace(from, () => JSON.stringify(a.to));
  }
  if (ok) text = text.replace(/("version"\s*:\s*)(\d+)/, (m, k) => `${k}${after.version}`);
  if (!ok || !same(JSON.parse(text), after)) text = `${JSON.stringify(after, null, 2)}\n`;
  return { file, before, after, text, applied, errors, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [draftPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  if (!draftPath) { console.error('쓰는 법: node tools/apply-texts.mjs <초안.json> [--dry]'); process.exit(2); }
  const r = plan(JSON.parse(readFileSync(draftPath, 'utf8')));
  for (const w of r.warnings) console.warn(`  ! ${w}`);
  if (r.file) console.log(`${r.file}  (version ${r.before?.version ?? 0} → ${r.after?.version ?? 0})`);
  for (const a of r.applied) console.log(`  ${a.path}: ${JSON.stringify(a.from)} → ${JSON.stringify(a.to)}`);
  if (r.errors.length) {
    for (const e of r.errors) console.error(`  ✖ ${e.path}: ${e.why}`);
    console.error('고칠 수 없는 칸이 있어 아무것도 쓰지 않았어요.');
    process.exit(1);
  }
  if (!r.applied.length) console.log('바뀐 글이 없어요.');
  else if (dry) console.log('(--dry: 쓰지 않음)');
  else writeFileSync(`${ROOT}/${r.file}`, r.text);
}
