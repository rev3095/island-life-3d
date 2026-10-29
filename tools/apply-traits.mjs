// "요청 확인" 때 캐릭터 편집기 「성격·대화」 탭 요청(kind: 'traits')의 바뀐 칸을 주민 파일에 얹는다 (6차 M6-P3).
//   node tools/apply-traits.mjs <요청.json> [--dry]
// <요청.json> = ArtifactData 로 받은 요청 문서 그대로 ({ slug, base, changes, rules, request, … }).
//   changes = 주민 파일 assets/villagers/<slug>.json 안 경로 → 값 (규칙은 tools/edits.mjs — 편집기가 diffTables 로 만든다)
//   rules   = assets/data/rules.json 안 경로 → 값 (생일 birthdays/dates/<slug> 만 — 생일은 숫자 표 한 곳에 있다)
// 바뀐 파일은 version +1. 기준 버전(base)이 지금 파일과 다르면 알린다 (그래도 칸 단위로 얹는다).
// 고칠 수 없는 칸·검사(src/gameplay/town/traits.js checkVillager)에 걸리는 값이 하나라도 있으면 아무것도 쓰지 않고 exit 1.
// 뒤이어 node --test tests/ 로 검사한다. 순서 전체는 docs/notes/m6-p3-traits.md 「요청 확인 (성격·대화)」.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyChanges, splitPath } from './edits.mjs';
import { checkVillager } from '../src/gameplay/town/traits.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RULES_FILE = 'assets/data/rules.json';
/** 주민 파일에서 편집기가 고칠 수 있는 맨 위 칸 (version·slug·id·role·birthday 가리키기는 Claude 만) */
export const EDITABLE = ['name', 'traits', 'color', 'pace', 'schedule', 'roam', 'gifts', 'requests', 'emote', 'lines', 'linesOff'];
const fmt = v => (v === undefined ? '(없음)' : JSON.stringify(v).slice(0, 160));

/** 사람이 읽기 좋은 JSON: 한 줄에 들어가면 한 줄로, 아니면 펼친다 (대사는 한 줄에 하나) */
const inline = v => (v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(inline).join(', ')}]`
  : Object.keys(v).length ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}');
export function formatJSON(v, ind = '') {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const one = inline(v);
  if (ind.length + one.length <= 110) return one;
  const ni = ind + '  ';
  if (Array.isArray(v)) return `[\n${v.map(x => ni + formatJSON(x, ni)).join(',\n')}\n${ind}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${ni}${JSON.stringify(k)}: ${formatJSON(x, ni)}`).join(',\n')}\n${ind}}`;
}

/** 검사에 쓰는 이름표 (아이템 id·분류·이모티콘) */
export async function checkEnv() {
  const items = await import('../src/data/items.js');
  const em = JSON.parse(readFileSync(`${ROOT}/assets/emotes/emotes.json`, 'utf8')).emotes;
  return {
    itemIds: new Set([...items.ITEMS.map(i => i.id), 'native']), categories: new Set(items.CATEGORIES),
    emoteKeys: new Set(em.map(e => e.key)), playerKeys: new Set(em.filter(e => e.cat !== 'reply').map(e => e.key)),
  };
}

/** 요청 하나를 얹어 본다 → { files: [{ path, before, after, applied }], errors, warnings, unchanged } */
export function plan(req, env = {}, read = p => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8'))) {
  const errors = [], warnings = [], unchanged = [], files = [];
  const slug = req?.slug;
  if (!/^[a-z]+$/.test(slug ?? '')) return { files, errors: [{ path: 'slug', why: '주민 이름(slug)이 없어요' }], warnings, unchanged };
  const path = `assets/villagers/${slug}.json`;
  let before;
  try { before = read(path); } catch { return { files, errors: [{ path, why: '주민 파일이 없어요' }], warnings, unchanged }; }
  if (req.base != null && req.base !== before.version) warnings.push(`기준 v${req.base} 로 고친 요청인데 지금 파일은 v${before.version} — 칸 단위로 얹어요 (사이에 바뀐 칸은 요청 값이 이겨요)`);
  const changes = {};
  for (const [p, v] of Object.entries(req.changes ?? {})) {
    if (!EDITABLE.includes(splitPath(p)[0])) errors.push({ path: p, why: '편집기에서 고칠 수 없는 칸' });
    else changes[p] = v;
  }
  const r = applyChanges(before, changes);
  errors.push(...r.errors);
  unchanged.push(...r.unchanged);
  if (r.applied.length) {
    const after = { ...r.out, version: before.version + 1 };
    errors.push(...checkVillager(after, env).map(b => ({ path: b.path, why: `검사: ${b.why}` })));
    files.push({ path, before, after, applied: r.applied });
  }
  const rc = {};
  for (const [p, v] of Object.entries(req.rules ?? {})) {
    if (p !== `birthdays/dates/${slug}`) { errors.push({ path: `rules/${p}`, why: '이 탭에서는 그 주민 생일만 고쳐요' }); continue; }
    if (v !== null && !(typeof v === 'string' && /^\d\d-\d\d$/.test(v))) { errors.push({ path: `rules/${p}`, why: "생일은 'MM-DD' (이사 온 주민은 null = 이사 온 날)" }); continue; }
    rc[p] = v;
  }
  if (Object.keys(rc).length) {
    const rb = read(RULES_FILE), rr = applyChanges(rb, rc);
    errors.push(...rr.errors.map(e => ({ ...e, path: `rules/${e.path}` })));
    unchanged.push(...rr.unchanged.map(p => `rules/${p}`));
    if (rr.applied.length) files.push({ path: RULES_FILE, before: rb, after: { ...rr.out, version: (rb.version ?? 0) + 1 }, applied: rr.applied.map(a => ({ ...a, path: `rules/${a.path}` })), rules: true });
  }
  return { files, errors, warnings, unchanged };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [reqPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  if (!reqPath) { console.error('쓰는 법: node tools/apply-traits.mjs <요청.json> [--dry]'); process.exit(2); }
  const req = JSON.parse(readFileSync(reqPath, 'utf8'));
  const { files, errors, warnings, unchanged } = plan(req, await checkEnv());
  for (const w of warnings) console.warn(`  ! ${w}`);
  for (const f of files) {
    console.log(`${f.path}  (version ${f.before.version ?? 0} → ${f.after.version})`);
    for (const a of f.applied) console.log(`  ${a.path}: ${fmt(a.from)} → ${fmt(a.to)}`);
  }
  if (unchanged.length) console.log(`이미 같은 값 ${unchanged.length}칸: ${unchanged.join(', ')}`);
  if (errors.length) {
    for (const e of errors) console.error(`  ✖ ${e.path}: ${e.why}`);
    console.error('고칠 수 없는 칸이 있어 아무것도 쓰지 않았어요.');
    process.exit(1);
  }
  if (!files.length) console.log('바뀐 칸이 없어요.');
  else if (dry) console.log('(--dry: 쓰지 않음)');
  else for (const f of files) writeFileSync(`${ROOT}/${f.path}`, (f.rules ? (await import('./edits.mjs')).pretty(f.after) : formatJSON(f.after)) + '\n');
}
