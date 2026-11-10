// 배경 편집기용 묶음 파일. 아티팩트 한 버전에 파일을 511개까지만 둘 수 있어서, 편집기에는 요소마다 JSON 두 개 대신 묶음을 올린다.
// - assets/env/editor-index.json · assets/furniture/editor-index.json: index.json 의 요소마다 스펙(specs/<slug>.json)과 통계(models/<slug>.stats.json)
// - assets/items/editor-index.json: 아이템 모델 82개의 스펙·통계 + 아이콘 썸네일(items[].thumb, data: 주소) + 모델이 든 묶음 번호(bundle)
//   assets/items/editor-models-<n>.json: { slug: glb base64 } — 하나에 MODEL_CHUNK 바이트 안쪽, 목록 순서(분류별)대로 나눈다
// - assets/interior/editor-index.json: 벽지·바닥 스펙(models[].spec) + 방 틀(frame) + 주민 방 배치(rooms[].room) + 상점·박물관(places[].room) + 붙박이 FU-35–42(fixtures[], 모델은 assets/furniture/fixtures/editor-models-<n>.json)
// - assets/env|furniture/editor-renders-<n>.json · editor-thumbs.json: 렌더 그림·격자 썸네일 (10차 M10-P2 — 낱개 renders/*.png 는 올리지 않는다)
// 배경 편집기를 게시하기 전에(스펙·모델을 고친 뒤) 한 번 돌린다: node tools/build-editor-index.mjs
//   → 게시 파일 목록 dist/bg-editor/publish.json ({ files: [{ as, path }] } — publish_files 에 그대로, as 'index.html' = bg-editor.html)
//   --mirror 를 붙이면 그 파일들만 dist/bg-editor/ 에 복사한다 → dev-server 의 /dist/bg-editor/index.html 이 게시본 흉내 (낱개 파일이 없어 빠진 게 있으면 404)
// 게임은 이 파일들을 쓰지 않는다 (index.json + 스펙을 따로 읽음). 만들어지는 파일은 저장소에 넣지 않는다 (.gitignore).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const write = (p, data) => { const text = JSON.stringify(data) + "\n"; writeFileSync(resolve(root, p), text); return text.length; };
const mb = n => `${(n / 1048576).toFixed(2)}MB`;
const MODEL_CHUNK = 1.6 * 1048576;

// 모델(.glb.json base64)을 목록 순서대로 MODEL_CHUNK 안쪽 묶음 editor-models-<n>.json 에 나눠 넣고, 요소마다 묶음 번호(bundle)를 돌려준다
function bundleModels(dir, slugs) {
  const bundles = [{}], at = {};
  let size = 0;
  for (const slug of slugs) {
    const data = json(`${dir}/models/${slug}.glb.json`).data;
    if (size && size + data.length > MODEL_CHUNK) { bundles.push({}); size = 0; }
    bundles.at(-1)[slug] = data;
    size += data.length;
    at[slug] = bundles.length;
  }
  for (const f of readdirSync(resolve(root, dir))) if (/^editor-models-\d+\.json$/.test(f)) rmSync(resolve(root, dir, f));   // 예전 묶음 지우기
  const sizes = bundles.map((b, i) => write(`${dir}/editor-models-${i + 1}.json`, b));
  console.log(`${dir}/editor-models-1…${bundles.length}.json — ${sizes.map(mb).join(" · ")}`);
  return { at, count: bundles.length };
}

// 렌더 그림 묶음 (10차 M10-P2, 보드 wave10 D97-A — 9차 M9 에 새 요소만 하던 것을 모든 요소로): 배경·가구 요소의 렌더(main·front·top·variants·hero)는
// 낱개 파일 대신 editor-renders-<n>.json ({ 파일 이름: data: 주소 })에 — 한 요소의 그림은 한 묶음에, 분류(자연·소품·건물·타일·가구)를 넘지 않고
// RENDER_CHUNK 안쪽으로 목록 순서대로. 격자 썸네일은 영역마다 하나 editor-thumbs.json ({ slug: data: 주소 }) — 목록(editor-index.json)을 가볍게 두려고 따로.
// 목록에는 요소마다 renders(묶음 번호), 전체에 thumbs: 'editor-thumbs.json' 을 단다 (bg-editor.html 이 이 칸을 보고 묶음 모드로 읽는다).
const RENDER_CHUNK = 3 * 1048576;   // 요소 하나를 고를 때 받는 양 — 3MB 안팎 (요소 하나의 렌더는 0.5–1.5MB)
const MIME = { png: "image/png", jpg: "image/jpeg" };
const dataURL = p => `data:${MIME[p.split(".").pop()]};base64,` + readFileSync(resolve(root, p)).toString("base64");
function bundleRenders(dir, models) {
  const bundles = [], at = {}, thumbs = {};
  let size = 0, group = null;
  for (const m of models) {
    const files = (m.stats.renders ?? []).filter(f => f !== `${m.slug}_thumb.png`);
    if (m.stats.renders?.includes(`${m.slug}_thumb.png`)) thumbs[m.slug] = dataURL(`${dir}/renders/${m.slug}_thumb.png`);
    if (!files.length) continue;
    const urls = files.map(f => [f, dataURL(`${dir}/renders/${f}`)]);
    const bytes = urls.reduce((n, [, u]) => n + u.length, 0);
    const g = m.category ?? "";
    if (!bundles.length || g !== group || (size && size + bytes > RENDER_CHUNK)) { bundles.push({}); size = 0; group = g; }
    for (const [f, u] of urls) bundles.at(-1)[f] = u;
    size += bytes;
    at[m.slug] = bundles.length;
  }
  for (const f of readdirSync(resolve(root, dir))) if (/^editor-renders-\d+\.json$/.test(f)) rmSync(resolve(root, dir, f));
  const sizes = bundles.map((b, i) => write(`${dir}/editor-renders-${i + 1}.json`, b));
  const tn = write(`${dir}/editor-thumbs.json`, thumbs);
  console.log(`${dir}/editor-renders-1…${bundles.length}.json — 가장 큼 ${mb(Math.max(...sizes))} · 합 ${mb(sizes.reduce((a, b) => a + b, 0))} · 썸네일 editor-thumbs.json ${mb(tn)} (${Object.keys(thumbs).length}장)`);
  return { at, count: bundles.length };
}

// 배경·가구: 스펙·통계는 목록에, 모델은 묶음에 (요소마다 .glb.json 을 따로 올리면 파일 수가 511 을 넘어서 — 2026-10-30 축제 17개를 더할 때)
const counts = {};
for (const dir of ["assets/env", "assets/furniture"]) {
  const index = json(`${dir}/index.json`);
  const { at, count } = bundleModels(dir, index.models.map(m => m.slug));
  let models = index.models.map(m => ({ ...m, bundle: at[m.slug], spec: json(`${dir}/specs/${m.slug}.json`), stats: json(`${dir}/models/${m.slug}.stats.json`) }));
  const rp = bundleRenders(dir, models);
  models = models.map(m => ({ ...m, renders: rp.at[m.slug] ?? null }));
  write(`${dir}/editor-index.json`, { ...index, bundles: count, renderBundles: rp.count, thumbs: "editor-thumbs.json", models });
  counts[dir] = { models: count, renders: rp.count };
  console.log(`${dir}/editor-index.json — 요소 ${models.length}개`);
}

// 아이템: 아이콘은 그림 파일 대신 data: 주소로, 모델은 몇 MB 묶음으로
{
  const dir = "assets/items";
  const index = json(`${dir}/index.json`);
  const bundles = [{}];
  let size = 0;
  const models = index.models.map(m => {
    const data = json(`${dir}/models/${m.slug}.glb.json`).data;
    if (size && size + data.length > MODEL_CHUNK) { bundles.push({}); size = 0; }
    bundles.at(-1)[m.slug] = data;
    size += data.length;
    const items = m.items.map(it => ({ ...it, thumb: "data:image/png;base64," + readFileSync(resolve(root, it.icon)).toString("base64") }));
    return { ...m, items, bundle: bundles.length, spec: json(`${dir}/specs/${m.slug}.json`), stats: json(`${dir}/models/${m.slug}.stats.json`) };
  });
  for (const f of readdirSync(resolve(root, dir))) if (/^editor-models-\d+\.json$/.test(f)) rmSync(resolve(root, dir, f));   // 예전 묶음 지우기
  const sizes = bundles.map((b, i) => write(`${dir}/editor-models-${i + 1}.json`, b));
  const n = write(`${dir}/editor-index.json`, { ...index, bundles: bundles.length, models });
  console.log(`${dir}/editor-index.json — 모델 ${models.length}개 · 아이콘 ${models.reduce((s, m) => s + m.items.length, 0)}개 (${mb(n)})`);
  console.log(`${dir}/editor-models-1…${bundles.length}.json — ${sizes.map(mb).join(" · ")}`);
}

// 실내: 벽지·바닥 스펙 16 + 방 틀 + 주민 방 배치 + 상점·박물관 배치(places/) + 붙박이 목록(스펙·썸네일, 모델은 fixtures/editor-models-<n>.json)을 목록 하나에
{
  const dir = "assets/interior", fx = "assets/furniture/fixtures";
  const index = json(`${dir}/index.json`);
  const models = index.models.map(m => ({ ...m, spec: json(`${dir}/specs/${m.slug}.json`) }));
  const rooms = (index.rooms ?? []).map(r => ({ ...r, room: json(`${dir}/rooms/${r.slug}.json`) }));
  const places = readdirSync(resolve(root, `${dir}/places`)).filter(f => f.endsWith(".json")).sort().map(f => {
    const room = json(`${dir}/places/${f}`);
    return { id: room.id, slug: room.slug, name: room.name, version: room.version, status: room.status, room };
  });
  const fxIndex = json(`${fx}/index.json`);
  const { at } = bundleModels(fx, fxIndex.models.map(m => m.slug));
  const fixtures = fxIndex.models.map(m => ({ ...m, bundle: at[m.slug], spec: json(`${fx}/specs/${m.slug}.json`),
    thumb: "data:image/png;base64," + readFileSync(resolve(root, `${fx}/renders/${m.slug}_thumb.png`)).toString("base64") }));
  const n = write(`${dir}/editor-index.json`, { ...index, models, rooms, places, fixtures, frame: json(`${dir}/specs/frame.json`) });
  console.log(`${dir}/editor-index.json — 벽지·바닥·방 틀 ${models.length}개 · 방 ${rooms.length}개 · 상점·박물관 ${places.length}개 · 붙박이 ${fixtures.length}개 (${mb(n)})`);
}

// 게시 파일 목록 (10차 M10-P2): 편집기 페이지 + 위에서 만든 묶음 + 배경·가구 index.json(목록을 못 읽을 때의 예비). 이것 말고는 올리지 않는다
{
  const DIRS = ["assets/env", "assets/furniture", "assets/furniture/fixtures", "assets/items", "assets/interior"];
  const files = [{ as: "index.html", path: "bg-editor.html" }];
  for (const dir of DIRS) {
    for (const f of readdirSync(resolve(root, dir)).sort((a, b) => a.localeCompare(b, "en", { numeric: true })))
      if (/^editor-[a-z]+(-\d+)?\.json$/.test(f)) files.push({ as: `${dir}/${f}`, path: `${dir}/${f}` });
  }
  files.push({ as: "assets/env/index.json", path: "assets/env/index.json" }, { as: "assets/furniture/index.json", path: "assets/furniture/index.json" });
  const out = resolve(root, "dist/bg-editor");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const abs = files.map(f => ({ as: f.as, path: resolve(root, f.path), bytes: statSync(resolve(root, f.path)).size }));
  // publish_files 한 번에 64MiB 까지 → 60MiB 안쪽 차례(batches)로 나눈다. 첫 차례에 페이지(index.html)
  const batches = [[]];
  for (const f of abs) { const b = batches.at(-1); if (b.length && b.reduce((n, x) => n + x.bytes, 0) + f.bytes > 60 * 1048576) batches.push([]); batches.at(-1).push(f); }
  writeFileSync(resolve(out, "publish.json"), JSON.stringify({ note: "배경 편집기 게시 파일 (node tools/build-editor-index.mjs). publish_files 의 files 에 batches 를 차례로 — 처음 한 번은 첫 차례를 mode 'replace' 로 올려 예전 낱개 렌더(assets/env|furniture/renders/*)를 지우고, 나머지 차례는 patch", count: files.length, bytes: abs.reduce((n, f) => n + f.bytes, 0), batches: batches.map(b => b.map(({ as, path }) => ({ as, path }))) }, null, 1) + "\n");
  if (process.argv.includes("--mirror")) for (const f of files) { const to = resolve(out, f.as); mkdirSync(dirname(to), { recursive: true }); copyFileSync(resolve(root, f.path), to); }
  console.log(`게시 파일 ${files.length}개 (한도 511) → dist/bg-editor/publish.json${process.argv.includes("--mirror") ? " + 흉내 사본 dist/bg-editor/index.html" : ""}`);
}
