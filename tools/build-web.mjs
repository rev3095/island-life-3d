// 웹 배포 빌드: 게임을 claude.ai 아티팩트 "페이지 하나 + 파일들" 로 묶는다. (트랙 X4 · M6-P0 묶음 파일, docs/notes/deploy.md)
//   node tools/build-web.mjs            → dist/web/index.html (게시할 페이지), packs/<갈래>-<n>.json (에셋 묶음),
//                                          files.json (게시 경로 → 원본 경로), 255개가 넘으면 files-1.json, files-2.json … (한 번에 올릴 묶음), build.json (요약)
//   node tools/build-web.mjs --check    → 쓰지 않고 검사·표만
//   node tools/build-web.mjs --live <게시본 파일 목록>  → 위에 더해 publish-1.json, publish-2.json … (게시본에서 이 빌드로 옮기는 차례: 없어질 경로 null 먼저)
// - 페이지는 index.html 을 바탕으로 만든다. 아티팩트가 <!doctype>·<head>·<body> 뼈대를 씌우므로 뼈대 없이 쓰고,
//   tools/web-loader.html (로딩 화면·소리 안내), 묶음 목록(<script id="island-packs">), 모듈 미리 받기(modulepreload)를 넣는다.
// - 게시 경로 = 저장소 경로. JS 모듈은 모듈 묶음 packs/src-<폴더>-<n>.js 로 (M20-S3, 아래 transformModule·srcRuntime), css 는 따로.
// - 에셋(assets/ 의 JSON · .glb.json · 그림)은 아티팩트 한 버전 511파일 제한 때문에 묶음 파일 몇 개로 모은다 (PACKS 표).
//   src/core/packs.js 가 게시본에서 묶음에서 꺼내 준다. 개발 서버(/index.html)는 묶음 없이 파일을 하나씩.
// - 넣는 파일: main.js 에서 닿는 모듈·css + 게임이 읽는 에셋(.glb.json·스펙·목록·가구 썸네일). .glb·렌더·stats 는 빼고.
import { quantizeGlbJson } from './glb-quantize.mjs';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { imageType } from '../src/core/packs.js';
import { seaPackOf } from '../src/data/sea-items.js';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MB = 1024 * 1024;
// 아티팩트 제한 (Artifact 도구 설명): 한 번 게시 255파일·64MB, 버전당 511파일·256MB, 글 파일 16MB·그림 등 15MB
export const LIMITS = { perPublish: 255, perVersion: 511, publishBytes: 64 * MB, versionBytes: 256 * MB, textBytes: 16 * MB, binaryBytes: 15 * MB };
const TEXT_EXT = /\.(html|js|mjs|css|json|svg|txt|md)$/i;

// 에셋 묶음 갈래: 위에서부터 먼저 맞는 것. boot = 페이지를 열자마자 받는다 (처음 섬을 그리는 데 드는 것),
// 나머지는 그 안의 파일을 처음 읽을 때 받는다. 갈래 하나가 PACK_BYTES 를 넘으면 고른 크기로 <갈래>-1, -2 … 로 나눈다.
// 시작할 때 읽는 것 (개발 서버에서 잰 것, 새 게임): 배경 목록·모델·스펙 전부, 주인공·주민 8 모델·스펙, 가구 목록, 집 안 목록·스펙 17, 장면 13.
export const PACK_BYTES = 3 * MB;
// 계절 행사 묶음 (최적화, p29-perf): 행사 하나에만 쓰는 배경·아이템 모델 (assets/events/events.json list[].assets) → season-<slug>.
// 처음에 받지 않고, 미리 받기(prefetchPacks)도 그 행사가 열렸거나 곧 열릴 때만. 여럿이 같이 쓰는 것(행사 간판)은 섬 묶음에 남는다.
// 보상 가구·아이템 아이콘은 행사가 끝나도 집·가방에 남아서 가구·아이콘 묶음 그대로. M18-P4 계절 가구(스펙 season) 모델은 그 계절 묶음 (집에 놓으면 그때 받음).
export const SEASON_FILES = (() => {
  const list = JSON.parse(readFileSync(join(ROOT, 'assets/events/events.json'), 'utf8')).list ?? [];
  const uses = new Map();   // 경로 → [행사 slug]
  const use = (path, slug) => uses.set(path, [...(uses.get(path) ?? []), slug]);
  for (const ev of list) {
    for (const k of ev.assets?.env ?? []) { use(`assets/env/models/${k}.glb.json`, ev.slug); use(`assets/env/specs/${k}.json`, ev.slug); }
    for (const k of ev.assets?.items ?? []) use(`assets/items/models/${k}.glb.json`, ev.slug);
  }
  // M18-P4 (D196-A · D197-A): 계절 가구 FU-92–104 모델(스펙 season)은 그 계절 묶음 — 썸네일은 icons, 스펙은 furniture 묶음 그대로
  const furnSpecs = join(ROOT, 'assets/furniture/specs');
  for (const f of readdirSync(furnSpecs).filter(f => f.endsWith('.json'))) {
    const sp = JSON.parse(readFileSync(join(furnSpecs, f), 'utf8'));
    if (sp.season && list.some(ev => ev.slug === sp.season)) use(`assets/furniture/models/${sp.slug}.glb.json`, sp.season);
  }
  return new Map([...uses].filter(([, s]) => s.length === 1).map(([p, [slug]]) => [p, slug]));
})();
const seasonPacks = [...new Set(SEASON_FILES.values())].map(slug => ({ name: `season-${slug}`, season: slug, test: p => SEASON_FILES.get(p) === slug }));
// M18-P1 계절 바다 생물 묶음 (D197-A): 한 계절에만 나오는 바다 생물(items.json sea 의 season 이 봄·여름·가을·겨울 하나)의 모델 → sea-<계절>.
// 처음에 받지 않고, 미리 받기도 그 계절(이 달·다음 달)일 때만 (main.js → items.seaPacksFor). 잡거나 박물관·상점에서 처음 읽으면 그때 받는다.
// 아이콘(작은 그림)은 도감·가방이 철과 상관없이 보여서 icons 묶음 그대로.
export const SEA_SEASON_FILES = (() => {
  const T = JSON.parse(readFileSync(join(ROOT, 'assets/data/items.json'), 'utf8'));
  return new Map((T.sea ?? []).filter(r => seaPackOf(r.season)).map(r => [`assets/items/models/sea-${r.slug}.glb.json`, seaPackOf(r.season)]));
})();
const seaSeasonPacks = [...new Set(SEA_SEASON_FILES.values())].map(name => ({ name, season: name, test: p => SEA_SEASON_FILES.get(p) === name }));
// 9차 섬 꾸미기 묶음: 길·울타리 배경 모델 (assets/decor/decor.json) — 처음에 받지 않고 섬 꾸미기를 켜거나 저장에 놓은 것이 있을 때.
// 야외 가구는 집 가구와 같은 모델이라 furniture 묶음 그대로
export const DECOR_FILES = (() => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'assets/decor/decor.json'), 'utf8'));
  return new Set([...(cfg.paths ?? []), ...(cfg.fences ?? []), ...(cfg.builds ?? [])].map(d => d.kind).concat(cfg.homes ?? []).flatMap(k => [`assets/env/models/${k}.glb.json`, `assets/env/specs/${k}.json`]));   // M14 다리·경사로·커진 집
})();
// P35 무인도 투어 묶음: 배·광석 바위 배경 모델 (assets/tour/tour.json env) — 처음에 받지 않고 선착장에 다가가거나 배를 놓을 때 (보드 tour D127-A)
export const TOUR_FILES = (() => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'assets/tour/tour.json'), 'utf8'));
  return new Set((cfg.env ?? []).flatMap(k => [`assets/env/models/${k}.glb.json`, `assets/env/specs/${k}.json`]));
})();
// P40 밤 묶음: 밤에만 놓는 배경(달빛 가게·새벽 천막·등불 줄·자는 중 쪽지)과 밤 가게 주인 모델 (assets/night/night.json assets) —
// 처음에 받지 않고 그 밤 건물·주인이 처음 나올 때 (world 가 env 를 lazy 로, night 가 주인을 keeperOf 로 늦게 읽는다).
// 스펙(작은 JSON)은 다른 모듈이 시작할 때 읽을 수 있어 섬·사람 묶음에 그대로 — 모델만 뺀다
export const NIGHT_FILES = (() => {
  const a = JSON.parse(readFileSync(join(ROOT, 'assets/night/night.json'), 'utf8')).assets ?? {};
  return new Set([
    ...(a.env ?? []).map(k => `assets/env/models/${k}.glb.json`),
    ...(a.characters ?? []).map(k => `assets/models/${k}.glb.json`),
  ]);
})();
// P40 이사 오는 주민 묶음: 처음 섬에 없는 주민(assets/villagers/<slug>.json "arrives": "moving")의 캐릭터 모델 — 이사 와서 처음 세울 때
// (주민 성격·대사 파일은 작아서 섬 묶음 그대로). 이미 이사 온 저장이면 시작할 때 이 묶음을 받는다
export const MOVER_FILES = (() => {
  const dir = join(ROOT, 'assets/villagers');
  const slugs = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'editor-files.json')
    .filter(f => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')).arrives === 'moving'; } catch { return false; } })
    .map(f => f.replace(/\.json$/, ''));
  return new Set(slugs.map(k => `assets/models/${k}.glb.json`));
})();
// M13 매일 할 거리 묶음: 선물 풍선 · 유리병 · 행상 수레 배경 모델과 행상 송이 모델 (assets/daily/daily.json assets) —
// 처음에 받지 않고 그것이 처음 나올 때 (world 가 env 를 lazy 로, daily 가 풍선·행상을 늦게 읽는다). 스펙은 섬·사람 묶음 그대로
export const DAILY_FILES = (() => {
  const a = JSON.parse(readFileSync(join(ROOT, 'assets/daily/daily.json'), 'utf8')).assets ?? {};
  return new Set([
    ...(a.env ?? []).map(k => `assets/env/models/${k}.glb.json`),
    ...(a.characters ?? []).map(k => `assets/models/${k}.glb.json`),
  ]);
})();
// M18-P3 대회 무대 BD-17 (assets/contest/contest.json assets.env) — 대회 날에만 놓여서 처음엔 안 받고 daily 묶음에 같이 (묶음 수를 늘리지 않게)
export const CONTEST_FILES = (() => {
  const a = JSON.parse(readFileSync(join(ROOT, 'assets/contest/contest.json'), 'utf8')).assets ?? {};
  return new Set((a.env ?? []).map(k => `assets/env/models/${k}.glb.json`));
})();
// M19-P4 옛 등대 BD-18 · 단계 소품 PR-41–44 (assets/lighthouse/lighthouse.json assets.env) — game:ready 뒤에 놓여서 처음엔 안 받고 daily 묶음에 같이 (묶음 수를 늘리지 않게)
export const LIGHTHOUSE_FILES = (() => {
  const j = JSON.parse(readFileSync(join(ROOT, 'assets/lighthouse/lighthouse.json'), 'utf8')), a = j.assets ?? {};
  // 서쪽 등대: 등대지기 윤슬 CH-20 모델도 같이 (등대와 함께 game:ready 뒤에 세움)
  return new Set([...(a.env ?? []).map(k => `assets/env/models/${k}.glb.json`), ...(j.keeper?.slug ? [`assets/models/${j.keeper.slug}.glb.json`] : [])]);
})();
// east-fishboat 어선 부두·어선 BD-19 · 뱃사공 너울 CH-21 (assets/boat/boat.json assets) — 섬을 연 뒤 놓여서 처음엔 안 받고 daily 묶음에 같이
export const BOAT_FILES = (() => {
  const a = JSON.parse(readFileSync(join(ROOT, 'assets/boat/boat.json'), 'utf8')).assets ?? {};
  return new Set([
    ...(a.env ?? []).map(k => `assets/env/models/${k}.glb.json`),
    ...(a.characters ?? []).map(k => `assets/models/${k}.glb.json`),
  ]);
})();
// 묶을 때 모델 줄이기 (tools/glb-quantize.mjs). --no-quantize 로 끄면 원본 그대로 (비교용)
const QUANTIZE = !process.argv.includes('--no-quantize');
export const PACKS = [
  { name: 'clothes', test: p => p.startsWith('assets/clothes/') && p !== 'assets/clothes/index.json' },   // 11차 옷 모델·썸네일 (처음에 받지 않고 상점·옷장·입은 옷이 있을 때 — 목록만 섬 묶음)
  { name: 'icons', test: p => !!imageType(p) },                                     // 그림: 아이템 아이콘·가구 썸네일 (가방·상점·박물관을 처음 열 때)
  ...seasonPacks,                                                                   // 계절 행사 모델 (그 행사 때)
  ...seaSeasonPacks,                                                                // M18-P1 계절 바다 생물 모델 (그 계절 무렵)
  { name: 'decor', test: p => DECOR_FILES.has(p) },                                 // 9차 섬 꾸미기 길·울타리 (놓을 때)
  { name: 'tour', test: p => TOUR_FILES.has(p) },                                   // P35 무인도 투어 배·광석 바위 (배를 놓을 때)
  { name: 'night', test: p => NIGHT_FILES.has(p) },                                 // P40 밤 건물·등불·밤 가게 주인 (밤에 처음 나올 때)
  { name: 'movers', test: p => MOVER_FILES.has(p) },
  { name: 'daily', test: p => DAILY_FILES.has(p) || CONTEST_FILES.has(p) || LIGHTHOUSE_FILES.has(p) || BOAT_FILES.has(p) },                                 // M13 풍선·유리병·행상 수레·행상 (처음 나올 때)                                // P40 이사 오는 주민 모델 (이사 와서 처음 세울 때)
  { name: 'island', boot: true, test: p => /^assets\/(env|interior|story|island|data|sound|style|emotes|festival|villagers|events|decor|night|tour|journal|daily|rating|contest|town|lighthouse|boat|visit)\//.test(p) || p === 'assets/furniture/index.json' || p === 'assets/furniture/fixtures/index.json' || p === 'assets/clothes/index.json' },   // 섬 배경·집 안·장면·표 (+ 가구·붙박이 목록) (visit 는 M21-P4 문장 표 · island·data·sound·style 은 6차 P4–P6, emotes·festival·villagers 는 5차 Z5, events 는 8차 M8)
  { name: 'people', boot: true, test: p => /^assets\/(models|specs)\//.test(p) },  // 주인공·주민 모델·스펙
  { name: 'furniture', test: p => p.startsWith('assets/furniture/') },             // 가구 모델·스펙 (집에 들어갈 때, 저장에 가구가 있으면 시작할 때) · 상점·박물관 붙박이 (처음 들어갈 때)
  { name: 'items', test: p => p.startsWith('assets/items/') },                     // 들어 보이는 아이템 모델 (처음 잡았을 때)
  { name: 'more', test: () => true },                                              // 갈래 없는 새 에셋 → 표에 갈래를 더할 것 (빌드 표에 알림)
];
/** 묶음에 넣는 파일: assets/ 의 JSON·그림 (css 가 url() 로 부르는 것은 빼고 — css 는 묶음을 못 읽는다) */
const packable = p => p.startsWith('assets/') && (p.endsWith('.json') || !!imageType(p));

// 게임이 slug 로 읽는 에셋 묶음. 목록(index.json)의 slug 마다 이 파일들을 넣는다.
//   env       — world·sky: assets.loadEnv / loadEnvSpec (src/core/assets.js PATHS)
//   character — player·town: assets.loadCharacter / loadCharacterSpec (목록은 assets.loadCharacterIndex)
//   furniture — house: src/gameplay/house/furniture.js, 썸네일 = data 아이템 icon (src/data/items.js)
//   fixtures  — 상점·박물관 붙박이 (house/places.js, 계산대·진열 받침·수조): 모델·스펙만 (썸네일은 게임이 안 씀)
//   items     — 가구를 뺀 아이템 아이콘 = data 아이템 icon (변형마다 하나) + 모델 .glb.json 모두
//               (들어 보이기 gather/meshes.js heldModel · 상점 진열·박물관 전시 house/places.js itemModel — 실내가 생긴 뒤로 모든 아이템 모델을 쓴다)
const itemFiles = slug => {
  const m = JSON.parse(read('assets/items/index.json')).models.find(x => x.slug === slug);
  return [...(m?.items ?? []).map(x => x.icon), ...(m ? [`assets/items/models/${slug}.glb.json`] : [])];
};
export const FAMILIES = [
  { name: 'env', index: 'assets/env/index.json', each: s => [`assets/env/models/${s}.glb.json`, `assets/env/specs/${s}.json`] },
  { name: 'character', index: 'assets/models/index.json', each: s => [`assets/models/${s}.glb.json`, `assets/specs/${s}.json`] },
  { name: 'furniture', index: 'assets/furniture/index.json', each: s => [`assets/furniture/models/${s}.glb.json`, `assets/furniture/specs/${s}.json`, `assets/furniture/renders/${s}_thumb.png`] },
  { name: 'fixtures', index: 'assets/furniture/fixtures/index.json', each: s => [`assets/furniture/fixtures/models/${s}.glb.json`, `assets/furniture/fixtures/specs/${s}.json`] },
  { name: 'items', index: 'assets/items/index.json', each: itemFiles },
  // 11차 옷 (player/outfit.js): 모델 + 상점·옷장 그림. 기본 옷(builtin, CL-00)은 주인공 모델에 들어 있어 파일이 없다
  { name: 'clothes', index: 'assets/clothes/index.json', each: s => (s === 'basic-tee' ? [] : [`assets/clothes/models/${s}.glb.json`, `assets/clothes/renders/${s}_thumb.png`]) },
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

/** 빌드 계획: 게시할 파일·묶음·페이지와 문제 목록. 쓰지는 않는다 (테스트도 이걸 부른다)
 *  files = 게임이 읽는 원본 파일 전부 (빌드에 든 것), publish = 게시할 파일 (모듈·css + 묶음, 페이지 빼고), packs = 에셋 묶음 */
export function planWeb() {
  const errors = [], warnings = [], notes = [];
  const html = read('index.html');
  const importMap = readImportMap(html);
  const files = new Set();
  const cssRefs = new Set();  // css 가 url()·@import 로 부르는 파일 — 묶지 않고 따로 올린다
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
        if (exists(p)) { files.add(p); cssRefs.add(p); } else errors.push(`${file}: 없는 파일 ${ref}`);
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
  const sources = [...files]
    .map(path => ({ path, src: path, bytes: statSync(join(ROOT, path)).size, group: groupOf(path) }))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.path.localeCompare(b.path));
  for (const f of sources) {
    if (/\.(glb|blend|blend1)$/.test(f.path) || f.path.endsWith('.stats.json')) errors.push(`넣으면 안 되는 파일: ${f.path}`);
    const max = TEXT_EXT.test(f.path) ? LIMITS.textBytes : LIMITS.binaryBytes;
    if (f.bytes > max) errors.push(`파일이 너무 커요 (${fmt(f.bytes)} > ${fmt(max)}): ${f.path}`);
  }

  // 4) 에셋 → 묶음 (PACKS 표). 모듈·css·css 가 부르는 파일은 따로
  const loose = sources.filter(f => !packable(f.path) || cssRefs.has(f.path));
  const packs = makePacks(sources.filter(f => packable(f.path) && !cssRefs.has(f.path)), errors);
  const more = packs.filter(p => p.group === 'more').reduce((n, p) => n + p.files.length, 0);
  if (more) notes.push(`묶음 갈래가 없는 에셋 ${more}개 → more 묶음 (필요할 때 받음). 시작할 때 읽는 것이면 PACKS 표에 boot 갈래를 더해 주세요`);
  for (const p of packs) if (p.bytes > LIMITS.textBytes) errors.push(`묶음이 너무 커요 (${fmt(p.bytes)} > ${fmt(LIMITS.textBytes)}): ${p.path}`);
  // M20-S3: JS 모듈은 모듈 묶음 packs/src-*.js 로 (css·css 가 부르는 파일만 따로)
  const srcPacks = makeSrcPacks(loose.filter(f => f.group === '모듈 (js)'), errors);
  const published = [
    ...srcPacks.map(p => ({ path: p.path, src: `dist/web/${p.path}`, bytes: p.bytes, group: '모듈 묶음 (src)' })),
    ...loose.filter(f => f.group !== '모듈 (js)'),
    ...packs.map(p => ({ path: p.path, src: `dist/web/${p.path}`, bytes: p.bytes, group: '묶음 (packs)' })),
  ];
  const manifest = { v: 1, packs: packs.map(p => ({ path: p.path, boot: p.boot, ...(p.season ? { season: p.season } : {}), bytes: p.bytes, hash: p.hash, files: p.files.map(f => f.path) })) };

  // 5) 페이지
  const modules = readModules();
  for (const m of modules) if (!files.has(`src/${m}/index.js`)) warnings.push(`main.js 모듈 '${m}' 이 빌드에 없어요 (로딩 화면이 실패로 보여 줘요)`);
  const page = buildPage({ html, srcPacks, external: [...external].sort(), modules, manifest });
  if (Buffer.byteLength(page) > LIMITS.textBytes) errors.push('페이지가 16MB 를 넘어요');

  const batches = makeBatches(published, Buffer.byteLength(page));
  const totalBytes = published.reduce((s, f) => s + f.bytes, 0) + Buffer.byteLength(page);
  if (published.length + 1 > LIMITS.perVersion) errors.push(`파일이 버전당 ${LIMITS.perVersion}개를 넘어요 (${published.length + 1})`);
  if (totalBytes > LIMITS.versionBytes) errors.push(`총 용량이 버전당 ${fmt(LIMITS.versionBytes)} 를 넘어요`);

  return { page, files: sources, publish: published, packs, srcPacks, manifest, batches, external: [...external].sort(), modules, errors, warnings, notes, totalBytes };
}

// ---------- M20-S3 모듈 묶음 (packs/src-<갈래>-<n>.js) ----------
// 게시 파일 수를 줄이려고 src 의 JS 모듈을 묶음 파일 몇 개에 넣는다. 아티팩트 CSP 는 스크립트를 같은 출처 파일·인라인·jsdelivr 만
// 받는다고 보고(blob:·data: 모듈은 dev-server CSP 에서도 막힘) 묶음은 진짜 .js 모듈 파일로 둔다:
//   - 모듈 하나 = 등록 함수 하나. import 는 $isl_req('src/…') (먼저 실행된 모듈의 내보내기 객체), export 는 그 객체의 getter (값이 바뀌어도 따라감).
//   - import('./x.js')·import(path) 는 $isl_dyn — 상대 경로는 그 모듈 기준으로 풀고, 'three/addons/…' 같은 이름은 진짜 import (importmap).
//   - import.meta 는 { url: 페이지 기준 원래 경로 } → new URL('./ui.css', import.meta.url) 이 원래 자리의 css 를 가리킨다 (css 는 따로 올린다).
//   - 'three' 등 바깥 모듈은 묶음 파일 맨 위의 진짜 import 로 받고 등록 함수가 그 내보내기를 쓴다.
//   - 실행 순서는 ES 모듈과 같게: 의존 모듈부터 import 순서대로, 한 번만. top-level await 모듈(data/tables.js)은 async 함수.
// 실행기는 srcRuntime (페이지 안 인라인 <script>), 시작은 인라인 <script type="module"> 이 묶음을 import 한 뒤 run('src/main.js').
// 개발 서버(/index.html)는 그대로 모듈 파일 하나씩. 바꾸는 규칙이 못 다루는 모양(순환 import · export let 다시 넣기 · export *)이면 빌드 오류.
export const SRC_PACK_BYTES = 640 * 1024;
const SRC_DIR_ORDER = ['core', 'data', 'render', 'sky', 'world', 'player', 'ui', 'audio', 'gameplay'];
/** 모듈 → 묶음 갈래: src/<폴더>/ (main.js 는 core). gameplay 는 크기로 나뉜다 */
export const srcGroupOf = p => (p === 'src/main.js' ? 'core' : p.split('/')[1]?.replace(/\.m?js$/, '') ?? 'core');
const ID = '[A-Za-z_$][\\w$]*';
const IMPORT_RE = new RegExp(`^[ \\t]*import\\s*(?:(?:(${ID})\\s*,?\\s*)?(?:\\*\\s*as\\s+(${ID})|\\{([^}]*)\\})?\\s*from\\s*)?(['"])([^'"\\n]+)\\4[ \\t]*;?`, 'gm');

/** 자리 i 에서 JS 식 하나를 건너뛴다: 괄호·글자·템플릿·주석·정규식을 따라가며 깊이 0 의 ',' 또는 ';' 또는 문장 끝 줄바꿈에서 멈춤 → 멈춘 자리 */
function skipExpr(s, i) {
  const stack = [];
  let last = '=';   // 앞의 의미 있는 글자 (정규식/나눗셈 가르기)
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i) - 1; if (i < 0) return s.length; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'") { for (i++; i < s.length && s[i] !== c; i++) if (s[i] === '\\') i++; last = c; continue; }
    if (c === '`') { stack.push('`'); i = skipTemplate(s, i + 1, stack); last = '`'; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(last)) {   // 정규식
      let cls = false;
      for (i++; i < s.length; i++) { const d = s[i]; if (d === '\\') { i++; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; }
      while (/[a-z]/i.test(s[i + 1] ?? '')) i++;
      last = '/'; continue;
    }
    if ('([{'.includes(c)) stack.push(c);
    else if (')]}'.includes(c)) { if (!stack.length) return i; stack.pop(); }
    else if (!stack.length && (c === ',' || c === ';')) return i;
    else if (!stack.length && c === '\n') {
      const next = s.slice(i + 1).match(/^\s*(\S)/)?.[1] ?? '';
      if (!/[,=([{+\-*/%&|?:<>!~^.]/.test(last) && !/[.,?:+\-*/%&|=<>]/.test(next)) return i;
    }
    if (!/\s/.test(c)) last = c;
  }
  return i;
}
/** 템플릿 글자 안 (여는 ` 다음부터) → 닫는 ` 자리 */
function skipTemplate(s, i, stack) {
  for (; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '`') { stack.pop(); return i; }
    if (s[i] === '$' && s[i + 1] === '{') {
      let depth = 1;
      for (i += 2; i < s.length && depth; i++) {
        if (s[i] === '`') { const st = ['`']; i = skipTemplate(s, i + 1, st); continue; }
        if (s[i] === '"' || s[i] === "'") { const q = s[i]; for (i++; i < s.length && s[i] !== q; i++) if (s[i] === '\\') i++; continue; }
        if (s[i] === '{') depth++; else if (s[i] === '}') depth--;
      }
      i--;
    }
  }
  return i;
}
/** 깊이 0 의 쉼표로 나누기 */
function splitTop(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of s) {
    if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
    if (c === ',' && !depth) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
/** 묶는 꼴(구조 분해)에서 이름들: [a, b] · { x, y: z, ...r } · a = 기본값 */
function patternNames(p) {
  p = p.trim();
  if (p.startsWith('[') || p.startsWith('{')) {
    const obj = p.startsWith('{');
    return splitTop(p.slice(1, -1)).flatMap(part => {
      let t = part.trim().replace(/^\.\.\./, '');
      if (obj) t = t.replace(new RegExp(`^(?:${ID}|'[^']*'|"[^"]*")\\s*:`), '');   // { 키: 이름 }
      return t ? patternNames(t) : [];   // 이름 = 기본값 → patternNames 가 앞 이름만 읽는다
    });
  }
  const m = p.match(new RegExp(`^(${ID})`));
  return m ? [m[1]] : [];
}
/** `export const|let|var` 뒤 자리 i 부터 선언 이름들 */
function declNames(s, i) {
  const names = [];
  for (;;) {
    while (/\s/.test(s[i])) i++;
    let end = i;
    if (s[i] === '[' || s[i] === '{') { const st = []; for (; end < s.length; end++) { if ('[{'.includes(s[end])) st.push(1); else if (']}'.includes(s[end])) { st.pop(); if (!st.length) { end++; break; } } } }
    else end = i + (s.slice(i).match(new RegExp(`^${ID}`))?.[0].length ?? 0);
    names.push(...patternNames(s.slice(i, end)));
    i = end;
    while (/[ \t]/.test(s[i])) i++;
    if (s[i] === '=') i = skipExpr(s, i + 1);
    if (s[i] !== ',') return names;
    i++;
  }
}

/** 모듈 글 하나 → 등록 함수 몸 { body, deps, externals, exports, imports, async }. deps = import 순서의 src 경로 */
export function transformModule(path, text) {
  const deps = [], externals = [], imports = [], exportsMap = {}, problems = [];
  const ext = spec => { let k = externals.indexOf(spec); if (k < 0) { externals.push(spec); k = externals.length - 1; } return `$isl_x${k}`; };
  const rel = spec => /^\.{1,2}\//.test(spec);
  const target = spec => {
    if (!rel(spec)) return ext(spec);
    const id = norm(posix.join(posix.dirname(path), spec));
    if (!deps.includes(id)) deps.push(id);
    return `$isl_req(${JSON.stringify(id)})`;
  };
  const keepLines = (orig, code) => code + '\n'.repeat((orig.match(/\n/g) ?? []).length);
  let n = 0;
  // 1) import 문
  let body = text.replace(IMPORT_RE, (all, def, star, named, _q, spec) => {
    const ref = target(spec);
    const id = rel(spec) ? norm(posix.join(posix.dirname(path), spec)) : spec;
    const names = (named ?? '').split(',').map(x => x.trim()).filter(Boolean).map(x => {
      const m = x.match(new RegExp(`^(${ID}|default)(?:\\s+as\\s+(${ID}))?$`));
      if (!m) problems.push(`${path}: 못 읽는 import 이름 '${x}'`);
      return m ? [m[1], m[2] ?? m[1]] : [x, x];
    });
    imports.push({ from: id, names: [...(def ? ['default'] : []), ...names.map(([a]) => a)] });
    if (!def && !star && !named) return keepLines(all, `${ref};`);
    const tmp = `$isl_i${n++}`;
    const parts = [`const ${tmp} = ${ref};`];
    if (def) parts.push(`const ${def} = ${tmp}.default;`);
    if (star) parts.push(`const ${star} = ${tmp};`);
    if (names.length) parts.push(`const { ${names.map(([a, b]) => (a === b ? a : `${a}: ${b}`)).join(', ')} } = ${tmp};`);
    return keepLines(all, parts.join(' '));
  });
  // 2) export 문
  const reexports = [];
  body = body.replace(new RegExp(`^export\\s*\\{([^}]*)\\}\\s*from\\s*(['"])([^'"\\n]+)\\2[ \\t]*;?`, 'gm'), (all, list, _q, spec) => {
    const tmp = `$isl_r${n++}`;
    reexports.push(`const ${tmp} = ${target(spec)};`);
    const id = rel(spec) ? norm(posix.join(posix.dirname(path), spec)) : spec;
    const names = [];
    for (const x of list.split(',').map(t => t.trim()).filter(Boolean)) {
      const [a, b = a] = x.split(/\s+as\s+/);
      exportsMap[b] = `${tmp}.${a}`;
      names.push(a);
    }
    imports.push({ from: id, names });
    return keepLines(all, '');
  });
  body = body.replace(/^export\s*\{([^}]*)\}[ \t]*;?/gm, (all, list) => {
    for (const x of list.split(',').map(t => t.trim()).filter(Boolean)) { const [a, b = a] = x.split(/\s+as\s+/); exportsMap[b] = a; }
    return keepLines(all, '');
  });
  body = body.replace(/^export\s+default\s+(?:(async\s+function\s*\*?|function\s*\*?|class)\s*(\w*))?/gm, (all, kind, name) => {
    if (!kind) { exportsMap.default = '$isl_default'; return 'const $isl_default = '; }
    exportsMap.default = name || '$isl_default';
    return `${kind.trim()} ${name || '$isl_default'}`;
  });
  body = body.replace(new RegExp(`^export\\s+(async\\s+function\\s*\\*?|function\\s*\\*?|class)\\s*(${ID})`, 'gm'), (all, kind, name) => { exportsMap[name] = name; return `${kind.trim()} ${name}`; });
  body = body.replace(/^export\s+(const|let|var)(\s+)/gm, (all, kind, sp, off, whole) => {
    for (const name of declNames(whole, off + all.length)) exportsMap[name] = name;
    if (kind !== 'const') problems.push(`${path}: export ${kind} 은 묶음에서 가져간 쪽이 바뀐 값을 못 봐요 — const 나 함수로`);
    return kind + sp;
  });
  for (const [name, local] of Object.entries(exportsMap)) if (new RegExp(`^(?:let|var)\\s+[^;\\n]*\\b${local.replace(/\$/g, '\\$')}\\b`, 'm').test(body)) problems.push(`${path}: export { ${name} } 이 let/var 이에요 — 묶음에서는 가져간 쪽이 바뀐 값을 못 봐요`);
  if (/^export\b/m.test(body)) problems.push(`${path}: 못 바꾼 export 문 '${body.match(/^export\b.*$/m)[0].slice(0, 60)}'`);
  // 3) 동적 import · import.meta
  body = body.replace(/\bimport\s*\(\s*(?:(['"])([^'"\n]+)\1)?/g, (all, q, spec) => (spec && !rel(spec) ? all : `$isl_dyn(${spec ? q + spec + q : ''}`));
  body = body.replace(/\bimport\.meta\b/g, '$isl_meta');
  const getters = Object.entries(exportsMap).map(([k, v]) => `${JSON.stringify(k)}: () => ${v}`).join(', ');
  body = `${reexports.join(' ')}$isl_exp({ ${getters} });\n${body}`;
  return { body, deps, externals, exports: Object.keys(exportsMap), imports, problems };
}

/** 한 모듈 몸이 동기 함수로 읽히는지 (아니면 top-level await → async). 둘 다 안 되면 오류 글 */
function compileKind(path, body) {
  const wrap = a => `"use strict";(${a}function ($isl_exp, $isl_req, $isl_dyn, $isl_meta) {\n${body}\n})`;
  try { new vm.Script(wrap(''), { filename: path }); return { async: false }; } catch (e) {
    try { new vm.Script(wrap('async '), { filename: path }); return { async: true }; } catch { return { error: `${path}: 바꾼 모듈이 JS 로 안 읽혀요 (${e.message})` }; }
  }
}

/** 모듈들 → 모듈 묶음 [{ name, group, path, ids, text, bytes, hash, files }]. 갈래(폴더)마다 경로 순, SRC_PACK_BYTES 를 넘으면 나눈다 */
export function makeSrcPacks(modules, errors = []) {
  const info = new Map();
  for (const f of modules) {
    const t = transformModule(f.path, read(f.path));
    errors.push(...t.problems);
    const kind = compileKind(f.path, t.body);
    if (kind.error) errors.push(kind.error);
    info.set(f.path, { ...t, async: !!kind.async, f });
  }
  // 가져가는 이름이 그 모듈 내보내기에 있는지 (묶음에서는 없는 이름이 조용히 undefined 가 되므로 빌드에서 막는다)
  for (const [p, t] of info) for (const imp of t.imports) {
    const from = info.get(imp.from);
    if (!from) { if (/^\.|^src\//.test(imp.from)) errors.push(`${p}: 묶음에 없는 모듈 ${imp.from}`); continue; }
    for (const name of imp.names) if (!from.exports.includes(name)) errors.push(`${p}: ${imp.from} 에 없는 내보내기 '${name}'`);
  }
  // 순환 import 는 못 다룬다 (가져간 값을 한 번 꺼내 두므로)
  const state = new Map();
  const visit = (id, stack) => {
    state.set(id, 1);
    for (const d of info.get(id)?.deps ?? []) {
      if (state.get(d) === 1) errors.push(`순환 import: ${[...stack.slice(stack.indexOf(d)), d].join(' → ')}`);
      else if (!state.get(d)) visit(d, [...stack, d]);
    }
    state.set(id, 2);
  };
  for (const id of info.keys()) if (!state.get(id)) visit(id, [id]);
  const out = [];
  const groups = [...new Set([...info.keys()].map(srcGroupOf))].sort((a, b) => (SRC_DIR_ORDER.indexOf(a) + 1 || 99) - (SRC_DIR_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  for (const g of groups) {
    const list = [...info.values()].filter(t => srcGroupOf(t.f.path) === g).sort((a, b) => a.f.path.localeCompare(b.f.path));
    splitBySize(list, t => Buffer.byteLength(t.body), SRC_PACK_BYTES).forEach((part, i) => {
      const name = `src-${g}-${i + 1}`;
      const ext = [...new Set(part.flatMap(t => t.externals))];
      const head = ext.map((spec, k) => `import * as $isl_e${k} from ${JSON.stringify(spec)};\n`).join('');
      const defs = part.map(t => {
        const alias = t.externals.map((spec, k) => `const $isl_x${k} = $isl_e${ext.indexOf(spec)};`).join(' ');
        return `// ── ${t.f.path}\n$isl_def(${JSON.stringify(t.f.path)}, ${JSON.stringify(t.deps)}, ${t.async ? 'async ' : ''}function ($isl_exp, $isl_req, $isl_dyn, $isl_meta) {${alias}\n${t.body}\n});`;
      }).join('\n');
      const text = `// 포근섬 이야기 모듈 묶음 ${name} — node tools/build-web.mjs 가 src/ 모듈로 만든 것 (직접 고치지 말 것)\n${head}const $isl_def = globalThis.__islandSrc.def;\n${defs}\n`;
      out.push({
        name, group: g, path: `packs/${name}.js`, ids: part.map(t => t.f.path), files: part.map(t => t.f), text,
        bytes: Buffer.byteLength(text), hash: createHash('sha256').update(text).digest('hex').slice(0, 12),
      });
    });
  }
  return out;
}

/** 페이지 안 모듈 실행기 (인라인 <script> 로 들어간다 — 이 함수의 글자 그대로). globalThis.__islandSrc = { def, run, status } */
export function srcRuntime(g) {
  const defs = new Map(), spaces = new Map(), jobs = new Map();
  const resolve = (spec, from) => new URL(spec, `http://m/${from}`).pathname.slice(1);
  const space = id => {
    let ns = spaces.get(id);
    if (!ns) { ns = Object.create(null); Object.defineProperty(ns, Symbol.toStringTag, { value: 'Module' }); spaces.set(id, ns); }
    return ns;
  };
  const req = id => {
    if (!defs.has(id)) throw new Error(`묶음에 없는 모듈: ${id}`);
    return space(id);
  };
  const dyn = (spec, from) => (typeof spec === 'string' && /^\.{0,2}\//.test(spec) ? run(resolve(spec, from)) : import(spec));
  function run(id) {
    if (!jobs.has(id)) {
      const d = defs.get(id);
      jobs.set(id, !d ? Promise.reject(new TypeError(`모듈을 불러오지 못했어요: ${id} (게시 모듈 묶음에 없음)`)) : (async () => {
        for (const dep of d.deps) await run(dep);
        const ns = space(id);
        const exp = getters => { for (const k of Object.keys(getters)) Object.defineProperty(ns, k, { get: getters[k], enumerable: true }); };
        await d.fn(exp, req, spec => dyn(spec, id), { url: new URL(id, g.document?.baseURI ?? 'http://localhost/').href });
        return ns;
      })());
    }
    return jobs.get(id);
  }
  g.__islandSrc = {
    def(id, deps, fn) { defs.set(id, { deps, fn }); },
    run,
    status: () => ({ defined: defs.size, ran: jobs.size }),
  };
}

/** 묶음에 들어갈 글자: JSON 은 공백을 줄여 그대로, 그림은 base64 글자 */
function packValue(f, errors) {
  const buf = readFileSync(join(ROOT, f.src));
  if (imageType(f.path)) return JSON.stringify(buf.toString('base64'));
  // P40: 모델(.glb.json)은 법선·뼈 가중치를 작은 정수로 줄여 묶는다 (tools/glb-quantize.mjs — WASM 없이 GLTFLoader 가 그대로 읽음, 원본은 그대로)
  if (f.path.endsWith('.glb.json') && QUANTIZE) { try { return quantizeGlbJson(buf.toString('utf8')).text; } catch (e) { errors.push(`모델 줄이기 실패: ${f.path} (${e.message})`); return 'null'; } }
  try { return JSON.stringify(JSON.parse(buf.toString('utf8'))); } catch (e) { errors.push(`JSON 이 아니에요: ${f.path} (${e.message})`); return 'null'; }
}

/** 에셋 → 묶음 [{ name, group, boot, path, files, text, bytes, hash }]. 갈래마다 경로 순으로, PACK_BYTES 를 넘으면 고른 크기로 나눈다 */
export function makePacks(assets, errors = []) {
  const out = [];
  for (const g of PACKS) {
    const list = assets.filter(f => PACKS.find(x => x.test(f.path)) === g)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(f => ({ f, value: packValue(f, errors) }));
    if (!list.length) continue;
    splitBySize(list, x => Buffer.byteLength(x.value) + Buffer.byteLength(x.f.path) + 4, PACK_BYTES).forEach((part, i) => {
      const name = `${g.name}-${i + 1}`;
      const text = `{"pack":${JSON.stringify(name)},"files":{${part.map(x => `${JSON.stringify(x.f.path)}:${x.value}`).join(',')}}}`;
      out.push({
        name, group: g.name, boot: !!g.boot, ...(g.season ? { season: g.season } : {}), path: `packs/${name}.json`, text,
        files: part.map(x => x.f),
        bytes: Buffer.byteLength(text),
        hash: createHash('sha256').update(text).digest('hex').slice(0, 12),
      });
    });
  }
  return out;
}

/** 차례를 지키며 고른 크기로 나누기: 합이 cap 안이면 하나, 넘으면 ceil(합/cap) 개쯤으로 (한 조각이 cap 을 넘지 않게) */
export function splitBySize(list, sizeOf, cap) {
  const total = list.reduce((s, x) => s + sizeOf(x), 0);
  const n = Math.max(1, Math.ceil(total / cap));
  const target = total / n;
  const parts = [];
  let cur = [], bytes = 0;
  for (const x of list) {
    const sz = sizeOf(x);
    if (cur.length && (bytes + sz > cap || (parts.length < n - 1 && bytes + sz / 2 > target))) { parts.push(cur); cur = []; bytes = 0; }
    cur.push(x);
    bytes += sz;
  }
  if (cur.length) parts.push(cur);
  return parts;
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

/**
 * 게시본(live = 지금 올라가 있는 경로들)에서 이 빌드로 옮기는 게시 차례.
 * 새 빌드에 없는 경로를 먼저 null 로 지우고 그다음 파일을 올린다 → 버전당 511개를 어느 때도 넘지 않는다.
 * 한 번에 페이지 + 254개 (페이지는 매번 같은 file_path 로). → [[{ path, src | null, bytes }]]
 */
export function planTransition(files, live) {
  const keep = new Set(files.map(f => f.path));
  const remove = [...new Set(live)].filter(p => p !== 'index.html' && !keep.has(p)).sort().map(path => ({ path, src: null, bytes: 0 }));
  const entries = [...remove, ...files];
  const steps = [];
  for (let i = 0; i < entries.length; i += LIMITS.perPublish - 1) steps.push(entries.slice(i, i + LIMITS.perPublish - 1));
  return steps;
}

/** 게시본 파일 목록 글(Artifact list_files 결과를 그대로 저장한 것, JSON 배열·객체도 됨) → 경로들 */
export function parseLive(text) {
  try {
    const j = JSON.parse(text);
    return Array.isArray(j) ? j.map(x => (typeof x === 'string' ? x : x.path)).filter(Boolean) : Object.keys(j);
  } catch { /* 글 */ }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/(?:^|[\s"'`(])((?:[\w.-]+\/)*[\w.-]+\.(?:html|m?js|css|json|png|jpe?g|webp|gif|svg|mp4|webm|txt|md))(?=$|[\s"'`),:])/);
    if (m) out.push(m[1]);
  }
  return out;
}

/** main.js 의 MODULES 표 → 모듈 이름 순서 */
function readModules() {
  const block = read('src/main.js').match(/const MODULES = \[([\s\S]*?)\];/)?.[1] ?? '';
  return [...block.matchAll(/\[\s*'(\w+)'\s*,\s*'\.\/[^']+'\s*\]/g)].map(m => m[1]);
}

/** index.html → 아티팩트 페이지 (뼈대 없이) */
function buildPage({ html, srcPacks, external, modules, manifest }) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
  const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
  const title = head.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>포근섬 이야기</title>';
  // 뼈대가 charset 을 넣는다. viewport 는 index.html 의 것을 그대로 둔다 (X1 이 정한 값, viewport-fit=cover)
  const viewport = head.match(/<meta name="viewport"[^>]*>/)?.[0] ?? '';
  const rest = head.replace(title, '').replace(viewport, '').replace(/<meta charset[^>]*>\s*/i, '').trim();
  // 로딩 진행 어림값: 처음에 받는 모듈 수 + boot 묶음 안 파일 수 (packs.js 가 묶음을 받으며 그 안의 파일 수로 센다)
  const bootAssets = manifest.packs.filter(p => p.boot).reduce((n, p) => n + p.files.length, 0);
  const config = {
    build: buildStamp(),
    modules,
    stages: Object.fromEntries(modules.map(m => [m, { service: STAGES[m]?.[0] ?? m, label: STAGES[m]?.[1] ?? '준비하는 중', name: STAGES[m]?.[2] ?? m }])),
    js: srcPacks.length,   // M20-S3: 받는 같은 출처 .js = 모듈 묶음 수
    assets: bootAssets,
  };
  const loader = read('tools/web-loader.html').replace('/*CONFIG*/{}', () => JSON.stringify(config));
  // 묶음 목록: src/core/packs.js 가 읽는다. 실행되지 않는 JSON 글자 ('<' 는 \u003c 로 적어 </script> 가 끼지 않게)
  const packList = `<script type="application/json" id="island-packs">${JSON.stringify(manifest).replace(/</g, '\\u003c')}</script>`;
  // 모듈 미리 받기: main.js 가 모듈을 하나씩 차례로 불러오므로, 목록을 먼저 알려 주면 한꺼번에 받는다 (importmap 뒤에 둬야 한다)
  const preload = [...external, ...srcPacks.map(p => p.path)].map(href => `<link rel="modulepreload" href="${href}">`).join('\n');
  const mainTag = body.match(/<script type="module"[^>]*><\/script>/)?.[0];
  const entry = mainTag?.match(/src="([^"]+)"/)?.[1];
  if (!entry) throw new Error('index.html 에 <script type="module" src="src/main.js"> 가 없어요');
  // M20-S3: main.js 대신 — 모듈 실행기(인라인) → 모듈 묶음을 모두 import (등록만) → 첫 모듈 실행
  const start = `<script>(${srcRuntime.toString()})(globalThis);</script>\n`
    + `<script type="module" id="island-src">${srcPacks.map(p => `import "./${p.path}";`).join(' ')}\nglobalThis.__islandSrc.run(${JSON.stringify(entry)});</script>`;
  const bodyOut = body.replace(mainTag, () => `${packList}\n${loader.trim()}\n${start}`).trim();
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

/** 계획 → dist/web 에 쓰기. 묶음은 outDir/packs/ 에, files.json 의 묶음 원본 경로는 작업 폴더 기준 outDir/packs/… */
export function writeWeb(plan, outDir = join(ROOT, 'dist/web'), { live } = {}) {
  mkdirSync(join(outDir, 'packs'), { recursive: true });
  for (const f of readdirSync(outDir)) if (/^(files|publish)(-\d+)?\.json$/.test(f)) rmSync(join(outDir, f));   // 예전 묶음·차례 지우기
  for (const f of readdirSync(join(outDir, 'packs'))) rmSync(join(outDir, 'packs', f));
  for (const p of [...plan.packs, ...plan.srcPacks]) writeFileSync(join(outDir, p.path), p.text);
  const packSrc = new Map([...plan.packs, ...plan.srcPacks].map(p => [p.path, relative(ROOT, join(outDir, p.path)).replaceAll('\\', '/')]));
  const srcOf = f => (f.src == null ? null : packSrc.get(f.path) ?? f.src);
  const map = list => Object.fromEntries(list.map(f => [f.path, srcOf(f)]));
  writeFileSync(join(outDir, 'index.html'), plan.page);
  writeFileSync(join(outDir, 'files.json'), JSON.stringify(map(plan.publish), null, 1));
  if (plan.batches.length > 1) plan.batches.forEach((b, i) => writeFileSync(join(outDir, `files-${i + 1}.json`), JSON.stringify(map(b), null, 1)));
  const steps = live ? planTransition(plan.publish, live) : null;
  steps?.forEach((b, i) => writeFileSync(join(outDir, `publish-${i + 1}.json`), JSON.stringify(map(b), null, 1)));
  writeFileSync(join(outDir, 'build.json'), JSON.stringify({
    build: plan.page.match(/웹 빌드 ([^·]+)·/)?.[1].trim(),
    files: plan.publish.length + 1,
    bytes: plan.totalBytes,
    batches: plan.batches.map((b, i) => ({ file: plan.batches.length > 1 ? `files-${i + 1}.json` : 'files.json', count: b.length, bytes: b.reduce((s, f) => s + f.bytes, 0) })),
    groups: summarize(plan.publish),
    packs: [
      ...plan.packs.map(p => ({ path: p.path, boot: p.boot, count: p.files.length, bytes: p.bytes, hash: p.hash, groups: summarize(p.files) })),
      ...plan.srcPacks.map(p => ({ path: p.path, boot: true, kind: 'src', count: p.files.length, bytes: p.bytes, hash: p.hash, modules: p.ids })),   // M20-S3 모듈 묶음 (늘 boot)
    ],
    assets: summarize(plan.files.filter(f => f.path.startsWith('assets/'))),
    ...(steps ? { transition: steps.map((b, i) => ({ file: `publish-${i + 1}.json`, remove: b.filter(f => f.src == null).length, upload: b.filter(f => f.src != null).length })) } : {}),
    largest: [...plan.publish].sort((a, b) => b.bytes - a.bytes).slice(0, 10).map(f => ({ path: f.path, bytes: f.bytes })),
    external: plan.external,
    warnings: plan.warnings,
    notes: plan.notes,
  }, null, 1));
  return outDir;
}

function summarize(files) {
  const g = {};
  for (const f of files) { g[f.group] ??= { count: 0, bytes: 0 }; g[f.group].count++; g[f.group].bytes += f.bytes; }
  return g;
}

export const fmt = n => (n >= MB ? `${(n / MB).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);

function report(plan, outDir, live) {
  const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)));
  const lpad = (s, n) => ' '.repeat(Math.max(0, n - String(s).length)) + s;
  const line = '-'.repeat(56);
  const assets = plan.files.filter(f => f.path.startsWith('assets/') && plan.packs.some(p => p.files.includes(f)));
  console.log(`\n포근섬 이야기 웹 빌드 — 게시 파일 ${plan.publish.length + 1}개 (페이지 포함), 총 ${fmt(plan.totalBytes)}`);
  console.log(line);
  for (const [g, { count, bytes }] of Object.entries(summarize(plan.publish))) console.log(`${pad(g, 22)}${lpad(count, 6)}개${lpad(fmt(bytes), 13)}`);
  console.log(`${pad('페이지 index.html', 22)}${lpad(1, 6)}개${lpad(fmt(Buffer.byteLength(plan.page)), 13)}`);
  console.log(line);
  console.log(`에셋 묶음 ${plan.packs.length}개 (원본 ${assets.length}파일 ${fmt(assets.reduce((s, f) => s + f.bytes, 0))}, boot = 열자마자 받음)`);
  for (const p of plan.packs) {
    const what = Object.entries(summarize(p.files)).map(([g, { count }]) => `${g} ${count}`).join(' · ');
    console.log(`  ${pad(p.path, 24)}${p.boot ? 'boot' : '    '}${lpad(p.files.length, 5)}개${lpad(fmt(p.bytes), 11)}  ${what}`);
  }
  const srcIn = plan.srcPacks.reduce((s, p) => s + p.files.reduce((t, f) => t + f.bytes, 0), 0);
  console.log(`모듈 묶음 ${plan.srcPacks.length}개 (모듈 ${plan.srcPacks.reduce((n, p) => n + p.files.length, 0)}개 원본 ${fmt(srcIn)}, 모두 boot)`);
  for (const p of plan.srcPacks) console.log(`  ${pad(p.path, 24)}boot${lpad(p.files.length, 5)}개${lpad(fmt(p.bytes), 11)}`);
  console.log(line);
  console.log('가장 큰 게시 파일');
  for (const f of [...plan.publish].sort((a, b) => b.bytes - a.bytes).slice(0, 5)) console.log(`  ${lpad(fmt(f.bytes), 10)}  ${f.path}`);
  console.log(line);
  console.log(`게시 묶음 (한 번에 ${LIMITS.perPublish}개까지, 첫 묶음은 페이지 포함)`);
  plan.batches.forEach((b, i) => console.log(`  ${plan.batches.length > 1 ? `files-${i + 1}.json` : 'files.json'}: ${b.length + (i === 0 ? 1 : 0)}개, ${fmt(b.reduce((s, f) => s + f.bytes, 0))}`));
  if (live) {
    const steps = planTransition(plan.publish, live);
    console.log(`게시본(${live.length}개)에서 옮기는 차례 — 같은 file_path 로 차례대로 (null = 지우기)`);
    steps.forEach((b, i) => console.log(`  publish-${i + 1}.json: 지우기 ${b.filter(f => f.src == null).length} · 올리기 ${b.filter(f => f.src != null).length} (+ 페이지)`));
  }
  console.log(`외부 모듈 ${plan.external.length}개 (jsdelivr, importmap)`);
  for (const n of plan.notes) console.log(`알림: ${n}`);
  for (const w of plan.warnings) console.log(`주의: ${w}`);
  for (const e of plan.errors) console.log(`오류: ${e}`);
  if (outDir) console.log(`\n→ ${relative(ROOT, outDir).replaceAll('\\', '/')}/ (index.html, packs/, files.json${plan.batches.length > 1 ? `, files-1~${plan.batches.length}.json` : ''}${live ? ', publish-*.json' : ''}, build.json)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const liveArg = process.argv[process.argv.indexOf('--live') + 1];
  const live = process.argv.includes('--live') ? parseLive(readFileSync(liveArg, 'utf8')) : null;
  const plan = planWeb();
  const outDir = !check && !plan.errors.length ? writeWeb(plan, undefined, { live }) : null;
  report(plan, outDir, live);
  if (plan.errors.length) process.exitCode = 1;
}
