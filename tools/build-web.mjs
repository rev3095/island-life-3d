// 웹 배포 빌드: 게임을 claude.ai 아티팩트 "페이지 하나 + 파일들" 로 묶는다. (트랙 X4, docs/notes/deploy.md)
//   node tools/build-web.mjs            → dist/web/index.html (게시할 페이지), files.json (게시 경로 → 원본 경로),
//                                          255개가 넘으면 files-1.json, files-2.json … (한 번에 올릴 묶음), build.json (요약)
//   node tools/build-web.mjs --check    → 쓰지 않고 검사·표만
// - 페이지는 index.html 을 바탕으로 만든다. 아티팩트가 <!doctype>·<head>·<body> 뼈대를 씌우므로 뼈대 없이 쓰고,
//   tools/web-loader.html (로딩 화면·소리 안내) 과 모듈 미리 받기(modulepreload)를 넣는다.
// - 게시 경로 = 저장소 경로. 모듈·fetch 가 상대 경로라 페이지 옆에 같은 모양으로 올리면 그대로 돈다.
// - 넣는 파일: main.js 에서 닿는 모듈·css + 게임이 읽는 에셋(.glb.json·스펙·목록·가구 썸네일). .glb·렌더·stats 는 빼고.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MB = 1024 * 1024;
// 아티팩트 제한 (Artifact 도구 설명): 한 번 게시 255파일·64MB, 버전당 511파일·256MB, 글 파일 16MB·그림 등 15MB
export const LIMITS = { perPublish: 255, perVersion: 511, publishBytes: 64 * MB, versionBytes: 256 * MB, textBytes: 16 * MB, binaryBytes: 15 * MB };
const TEXT_EXT = /\.(html|js|mjs|css|json|svg|txt|md)$/i;

// 게임이 slug 로 읽는 에셋 묶음. 목록(index.json)의 slug 마다 이 파일들을 넣는다.
//   env       — world·sky: assets.loadEnv / loadEnvSpec (src/core/assets.js PATHS)
//   character — player·town: assets.loadCharacter / loadCharacterSpec (목록은 assets.loadCharacterIndex)
//   furniture — house: src/gameplay/house/furniture.js, 썸네일 = data 아이템 icon (src/data/items.js)
//   items     — 가구를 뺀 아이템 아이콘 = data 아이템 icon (변형마다 하나), 들어 보이는 모델(hold)만 .glb.json (gather/meshes.js heldModel, 5차 Z1)
const itemFiles = slug => {
  const m = JSON.parse(read('assets/items/index.json')).models.find(x => x.slug === slug);
  return [...(m?.items ?? []).map(x => x.icon), ...(m?.hold ? [`assets/items/models/${slug}.glb.json`] : [])];
};
export const FAMILIES = [
  { name: 'env', index: 'assets/env/index.json', each: s => [`assets/env/models/${s}.glb.json`, `assets/env/specs/${s}.json`] },
  { name: 'character', index: 'assets/models/index.json', each: s => [`assets/models/${s}.glb.json`, `assets/specs/${s}.json`] },
  { name: 'furniture', index: 'assets/furniture/index.json', each: s => [`assets/furniture/models/${s}.glb.json`, `assets/furniture/specs/${s}.json`, `assets/furniture/renders/${s}_thumb.png`] },
  { name: 'items', index: 'assets/items/index.json', each: itemFiles },
];

// 로딩 화면의 단계: main.js MODULES 이름 → [그 모듈이 올리는 서비스, 진행 글, 실패 때 부르는 이름]
const STAGES = {
  data: ['data', '아이템 도감을 펼치는 중', '도감·가방'],
  sky: ['time', '하늘과 시계를 맞추는 중', '하늘·시계'],
  world: ['world', '섬 땅을 고르는 중', '섬'],
  player: ['player', '주인공을 깨우는 중', '주인공'],
  ui: ['ui', '섬폰을 켜는 중', '화면'],
  audio: ['audio', '악기를 조율하는 중', '소리'],
  gameplay: ['gameplay', '주민들을 부르는 중', '주민·채집·집'],
};

// 표에 쓰는 묶음 이름 (위에서부터 먼저 맞는 것)
const GROUPS = [
  ['모듈 (js)', p => /\.m?js$/.test(p)],
  ['스타일 (css)', p => p.endsWith('.css')],
  ['캐릭터 모델', p => p.startsWith('assets/models/') && p.endsWith('.glb.json')],
  ['배경 모델', p => p.startsWith('assets/env/models/')],
  ['가구 모델', p => p.startsWith('assets/furniture/models/')],
  ['아이템 모델', p => p.startsWith('assets/items/models/')],
  ['아이템 아이콘', p => p.startsWith('assets/items/renders/')],
  ['가구 썸네일', p => p.endsWith('.png')],
  ['목록 (index.json)', p => p.endsWith('/index.json')],
  ['스펙 (json)', p => p.endsWith('.json')],
  ['기타', () => true],
];
export const groupOf = p => GROUPS.find(([, t]) => t(p))[0];

const read = p => readFileSync(join(ROOT, p), 'utf8');
const exists = p => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isFile();
const norm = p => posix.normalize(p).replace(/^\.\//, '');

/** JS 파일 하나에서 읽는 경로들: 정적 import/export, import('…'), 그리고 './x.js' 같은 상대 경로 글자 (MODULES 표·new URL) */
export function scanModule(text) {
  const out = { imports: new Set(), literals: new Set(), assets: new Set() };
  for (const m of text.matchAll(/(?:^|[\s;}])(?:import|export)\s*(?:[\w*{}\s,$]+?\s*from\s*)?['"]([^'"\n]+)['"]/g)) out.imports.add(m[1]);
  for (const m of text.matchAll(/\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g)) out.imports.add(m[1]);
  for (const m of text.matchAll(/['"`](\.{1,2}\/[^'"`\s${}]+\.(?:m?js|css|json))['"`]/g)) out.literals.add(m[1]);
  for (const m of text.matchAll(/['"`](assets\/[^'"`\s${}]+\.(?:json|png|svg|webp|jpg|glb))['"`]/g)) out.assets.add(m[1]);
  return out;
}

/** index.html 의 importmap → { 이름: 주소 } */
function readImportMap(html) {
  const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]).imports ?? {} : {};
}
function resolveBare(spec, map) {
  if (map[spec]) return map[spec];
  const prefix = Object.keys(map).filter(k => k.endsWith('/') && spec.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return prefix ? map[prefix] + spec.slice(prefix.length) : null;
}

/** 빌드 계획: 게시할 파일·페이지·묶음과 문제 목록. 쓰지는 않는다 (테스트도 이걸 부른다) */
export function planWeb() {
  const errors = [], warnings = [];
  const html = read('index.html');
  const importMap = readImportMap(html);
  const files = new Set();
  const external = new Set();
  const optional = [];        // 문자열로만 적힌 모듈 중 없는 것 (main.js 가 건너뛰는 모듈)

  // 1) main.js 에서 닿는 모듈 그래프
  const queue = ['src/main.js'];
  while (queue.length) {
    const file = queue.shift();
    if (files.has(file)) continue;
    if (!exists(file)) { errors.push(`없는 모듈: ${file}`); continue; }
    files.add(file);
    if (file.endsWith('.css')) {
      for (const m of read(file).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)) {
        const ref = m[1] ?? m[2];
        if (/^(data:|https?:|#)/.test(ref)) continue;
        const p = norm(posix.join(posix.dirname(file), ref));
        if (exists(p)) files.add(p); else errors.push(`${file}: 없는 파일 ${ref}`);
      }
      continue;
    }
    if (!/\.m?js$/.test(file)) continue;
    const { imports, literals, assets } = scanModule(read(file));
    for (const spec of imports) {
      if (/^\.{1,2}\//.test(spec)) { queue.push(norm(posix.join(posix.dirname(file), spec))); continue; }
      if (/^https?:/.test(spec)) { external.add(spec); continue; }
      const url = resolveBare(spec, importMap);
      if (url) external.add(url); else errors.push(`${file}: importmap 에 없는 이름 '${spec}'`);
    }
    for (const lit of literals) {
      if (imports.has(lit)) continue;
      const p = norm(posix.join(posix.dirname(file), lit));
      if (exists(p)) queue.push(p); else optional.push(`${file}: ${lit}`);
    }
    for (const a of assets) {
      if (a.endsWith('.glb')) errors.push(`${file}: .glb 는 웹에서 못 읽어요 (${a} → .glb.json)`);
      else if (exists(a)) files.add(a);
      else errors.push(`${file}: 없는 에셋 ${a}`);
    }
  }
  if (optional.length) warnings.push(...optional.map(o => `없는 모듈 글자 (건너뜀): ${o}`));

  // 2) 에셋 묶음
  for (const fam of FAMILIES) {
    if (!exists(fam.index)) { errors.push(`없는 목록: ${fam.index}`); continue; }
    files.add(fam.index);
    for (const { slug } of JSON.parse(read(fam.index)).models ?? []) {
      for (const p of fam.each(slug)) {
        if (exists(p)) files.add(p); else errors.push(`${fam.name} '${slug}': 없는 파일 ${p}`);
      }
    }
  }

  // 3) 정리: 묶음 순서 → 경로 순. 크기 재기, 제한 확인
  const order = GROUPS.map(([g]) => g);
  const list = [...files]
    .map(path => ({ path, src: path, bytes: statSync(join(ROOT, path)).size, group: groupOf(path) }))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.path.localeCompare(b.path));
  for (const f of list) {
    if (/\.(glb|blend|blend1)$/.test(f.path) || f.path.endsWith('.stats.json')) errors.push(`넣으면 안 되는 파일: ${f.path}`);
    const max = TEXT_EXT.test(f.path) ? LIMITS.textBytes : LIMITS.binaryBytes;
    if (f.bytes > max) errors.push(`파일이 너무 커요 (${fmt(f.bytes)} > ${fmt(max)}): ${f.path}`);
  }

  // 4) 페이지
  const modules = readModules();
  for (const m of modules) if (!files.has(`src/${m}/index.js`)) warnings.push(`main.js 모듈 '${m}' 이 빌드에 없어요 (로딩 화면이 실패로 보여 줘요)`);
  const js = list.filter(f => f.group === '모듈 (js)');
  const page = buildPage({ html, js, external: [...external].sort(), modules, assets: list });
  if (Buffer.byteLength(page) > LIMITS.textBytes) errors.push('페이지가 16MB 를 넘어요');

  const batches = makeBatches(list, Buffer.byteLength(page));
  const totalBytes = list.reduce((s, f) => s + f.bytes, 0) + Buffer.byteLength(page);
  if (list.length + 1 > LIMITS.perVersion) errors.push(`파일이 버전당 ${LIMITS.perVersion}개를 넘어요 (${list.length + 1})`);
  if (totalBytes > LIMITS.versionBytes) errors.push(`총 용량이 버전당 ${fmt(LIMITS.versionBytes)} 를 넘어요`);

  return { page, files: list, batches, external: [...external].sort(), modules, errors, warnings, totalBytes };
}

/** 한 번에 올릴 묶음으로 나누기: 255개·64MB 씩. 첫 묶음은 페이지와 같이 올라가므로 페이지 자리를 비운다 */
export function makeBatches(list, pageBytes = 0) {
  const batches = [];
  let cur = [], curBytes = pageBytes;
  for (const f of list) {
    const cap = batches.length === 0 ? LIMITS.perPublish - 1 : LIMITS.perPublish;
    if (cur.length && (cur.length >= cap || curBytes + f.bytes > LIMITS.publishBytes)) { batches.push(cur); cur = []; curBytes = 0; }
    cur.push(f);
    curBytes += f.bytes;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/** main.js 의 MODULES 표 → 모듈 이름 순서 */
function readModules() {
  const block = read('src/main.js').match(/const MODULES = \[([\s\S]*?)\];/)?.[1] ?? '';
  return [...block.matchAll(/\[\s*'(\w+)'\s*,\s*'\.\/[^']+'\s*\]/g)].map(m => m[1]);
}

/** index.html → 아티팩트 페이지 (뼈대 없이) */
function buildPage({ html, js, external, modules, assets }) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
  const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
  const title = head.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>포근섬 이야기</title>';
  // 뼈대가 charset 을 넣는다. viewport 는 index.html 의 것을 그대로 둔다 (X1 이 정한 값, viewport-fit=cover)
  const viewport = head.match(/<meta name="viewport"[^>]*>/)?.[0] ?? '';
  const rest = head.replace(title, '').replace(viewport, '').replace(/<meta charset[^>]*>\s*/i, '').trim();
  // 로딩 진행 어림값: 처음에 받는 모듈 수 + 처음에 읽는 에셋 수 (가구는 집에 들어갈 때, 아이템 모델은 처음 잡았을 때 읽어서 뺀다)
  const bootAssets = assets.filter(f => f.path.endsWith('.json') && f.path.startsWith('assets/') && !f.path.startsWith('assets/furniture/') && !f.path.startsWith('assets/items/') && f.path !== 'assets/models/index.json').length;
  const config = {
    build: buildStamp(),
    modules,
    stages: Object.fromEntries(modules.map(m => [m, { service: STAGES[m]?.[0] ?? m, label: STAGES[m]?.[1] ?? '준비하는 중', name: STAGES[m]?.[2] ?? m }])),
    js: js.length,
    assets: bootAssets,
  };
  const loader = read('tools/web-loader.html').replace('/*CONFIG*/{}', () => JSON.stringify(config));
  // 모듈 미리 받기: main.js 가 모듈을 하나씩 차례로 불러오므로, 목록을 먼저 알려 주면 한꺼번에 받는다 (importmap 뒤에 둬야 한다)
  const preload = [...external, ...js.map(f => f.path)].map(href => `<link rel="modulepreload" href="${href}">`).join('\n');
  const mainTag = body.match(/<script type="module"[^>]*><\/script>/)?.[0];
  if (!mainTag) throw new Error('index.html 에 <script type="module" src="src/main.js"> 가 없어요');
  const bodyOut = body.replace(mainTag, `${loader.trim()}\n${mainTag}`).trim();
  return [
    title,
    viewport,
    `<!-- 포근섬 이야기 웹 빌드 ${config.build} · node tools/build-web.mjs 가 index.html 로 만든 페이지 (직접 고치지 말 것) -->`,
    rest,
    preload,
    bodyOut,
    '',
  ].filter(s => s !== '').join('\n');
}

function buildStamp() {
  let hash = 'nogit';
  try { hash = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* git 없음 */ }
  const d = new Date();
  return `${hash} ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 계획 → dist/web 에 쓰기 */
export function writeWeb(plan, outDir = join(ROOT, 'dist/web')) {
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (/^files(-\d+)?\.json$/.test(f)) rmSync(join(outDir, f));   // 예전 묶음 지우기
  const map = list => Object.fromEntries(list.map(f => [f.path, f.src]));
  writeFileSync(join(outDir, 'index.html'), plan.page);
  writeFileSync(join(outDir, 'files.json'), JSON.stringify(map(plan.files), null, 1));
  if (plan.batches.length > 1) plan.batches.forEach((b, i) => writeFileSync(join(outDir, `files-${i + 1}.json`), JSON.stringify(map(b), null, 1)));
  writeFileSync(join(outDir, 'build.json'), JSON.stringify({
    build: plan.page.match(/웹 빌드 ([^·]+)·/)?.[1].trim(),
    files: plan.files.length + 1,
    bytes: plan.totalBytes,
    batches: plan.batches.map((b, i) => ({ file: plan.batches.length > 1 ? `files-${i + 1}.json` : 'files.json', count: b.length, bytes: b.reduce((s, f) => s + f.bytes, 0) })),
    groups: summarize(plan.files),
    largest: [...plan.files].sort((a, b) => b.bytes - a.bytes).slice(0, 10).map(f => ({ path: f.path, bytes: f.bytes })),
    external: plan.external,
    warnings: plan.warnings,
  }, null, 1));
  return outDir;
}

function summarize(files) {
  const g = {};
  for (const f of files) { g[f.group] ??= { count: 0, bytes: 0 }; g[f.group].count++; g[f.group].bytes += f.bytes; }
  return g;
}

export const fmt = n => (n >= MB ? `${(n / MB).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);

function report(plan, outDir) {
  const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)));
  const lpad = (s, n) => ' '.repeat(Math.max(0, n - String(s).length)) + s;
  const line = '-'.repeat(48);
  console.log(`\n포근섬 이야기 웹 빌드 — 파일 ${plan.files.length + 1}개 (페이지 포함), 총 ${fmt(plan.totalBytes)}`);
  console.log(line);
  for (const [g, { count, bytes }] of Object.entries(summarize(plan.files))) console.log(`${pad(g, 22)}${lpad(count, 6)}개${lpad(fmt(bytes), 13)}`);
  console.log(`${pad('페이지 index.html', 22)}${lpad(1, 6)}개${lpad(fmt(Buffer.byteLength(plan.page)), 13)}`);
  console.log(line);
  console.log('가장 큰 파일');
  for (const f of [...plan.files].sort((a, b) => b.bytes - a.bytes).slice(0, 8)) console.log(`  ${lpad(fmt(f.bytes), 10)}  ${f.path}`);
  console.log(line);
  console.log(`게시 묶음 (한 번에 ${LIMITS.perPublish}개까지, 첫 묶음은 페이지 포함)`);
  plan.batches.forEach((b, i) => console.log(`  ${plan.batches.length > 1 ? `files-${i + 1}.json` : 'files.json'}: ${b.length + (i === 0 ? 1 : 0)}개, ${fmt(b.reduce((s, f) => s + f.bytes, 0))}`));
  console.log(`외부 모듈 ${plan.external.length}개 (jsdelivr, importmap)`);
  for (const w of plan.warnings) console.log(`주의: ${w}`);
  for (const e of plan.errors) console.log(`오류: ${e}`);
  if (outDir) console.log(`\n→ ${relative(ROOT, outDir).replaceAll('\\', '/')}/ (index.html, files.json${plan.batches.length > 1 ? `, files-1~${plan.batches.length}.json` : ''}, build.json)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const plan = planWeb();
  const outDir = !check && !plan.errors.length ? writeWeb(plan) : null;
  report(plan, outDir);
  if (plan.errors.length) process.exitCode = 1;
}
