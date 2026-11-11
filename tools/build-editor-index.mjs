// 배경 편집기용 묶음 파일. 아티팩트 한 버전에 파일을 511개까지만 둘 수 있어서, 편집기에는 요소마다 JSON 두 개 대신 묶음을 올린다.
// - assets/env/editor-index.json · assets/furniture/editor-index.json: index.json 의 요소마다 스펙(specs/<slug>.json)과 통계(models/<slug>.stats.json)
// - assets/items/editor-index.json: 아이템 모델 82개의 스펙·통계 + 아이콘 썸네일(items[].thumb, data: 주소) + 모델이 든 묶음 번호(bundle)
//   assets/items/editor-models-<n>.json: { slug: glb base64 } — 하나에 MODEL_CHUNK 바이트 안쪽, 목록 순서(분류별)대로 나눈다
// - assets/interior/editor-index.json: 벽지·바닥 스펙(models[].spec) + 방 틀(frame) + 주민 방 배치(rooms[].room) + 상점·박물관(places[].room) + 붙박이 FU-35–42(fixtures[], 모델은 assets/furniture/fixtures/editor-models-<n>.json)
// - assets/env|furniture/editor-renders-<n>.json · editor-thumbs.json: 렌더 그림·격자 썸네일 (10차 M10-P2 — 낱개 renders/*.png 는 올리지 않는다)
// - (p36 리소스 편집기) assets/models/editor-index.json · editor-models-<n>.json + assets/renders/editor-renders-<n>.json · editor-thumbs.json: 캐릭터 15
//   assets/res/editor-index.json: 모든 리소스의 교체 약속 검사 결과(tools/res-contracts.mjs)·주제(행사·밤·투어·축제)·예전 버전 표시
//   assets/res/editor-prev.json: 요소마다 바로 전 버전의 썸네일 (git 기록에서, 무늬는 예전 스펙) — 버전 비교 칸
//   (11차 옷) assets/res/editor-clothes.json: 옷 13벌 목록·스펙·통계·썸네일 + editor-clothes-models.json (모델 base64 하나) + editor-clothes-renders-<n>.json (보기 넷)
// 배경·리소스 편집기를 게시하기 전에(스펙·모델을 고친 뒤) 한 번 돌린다: node tools/build-editor-index.mjs
//   → 게시 파일 목록 dist/bg-editor/publish.json ({ files: [{ as, path }] } — publish_files 에 그대로, as 'index.html' = bg-editor.html)
//     · dist/res-editor/publish.json (as 'index.html' = res-editor.html)
//   --mirror 를 붙이면 그 파일들만 dist/bg-editor/ · dist/res-editor/ 에 복사한다 → dev-server 의 /dist/<편집기>/index.html 이 게시본 흉내 (낱개 파일이 없어 빠진 게 있으면 404)
// 게임은 이 파일들을 쓰지 않는다 (index.json + 스펙을 따로 읽음). 만들어지는 파일은 저장소에 넣지 않는다 (.gitignore).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkResource, glbInfo, summary } from "./res-contracts.mjs";
import { ITEMS } from "../src/data/items.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const write = (p, data) => { const text = JSON.stringify(data) + "\n"; writeFileSync(resolve(root, p), text); return text.length; };
const mb = n => `${(n / 1048576).toFixed(2)}MB`;
const MODEL_CHUNK = 1.6 * 1048576;

// 모델(.glb.json base64)을 목록 순서대로 MODEL_CHUNK 안쪽 묶음 editor-models-<n>.json 에 나눠 넣고, 요소마다 묶음 번호(bundle)를 돌려준다
// modelDir: 모델 .glb.json 이 있는 폴더 (캐릭터만 assets/models 바로 아래 — 나머지는 <dir>/models)
function bundleModels(dir, slugs, modelDir = `${dir}/models`) {
  const bundles = [{}], at = {};
  let size = 0;
  for (const slug of slugs) {
    const data = json(`${modelDir}/${slug}.glb.json`).data;
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
// renderDir: 렌더 폴더 (캐릭터만 assets/renders), keep: 묶음에 넣을 렌더 파일 고르기 (캐릭터는 보기 넷만 — 동작 렌더는 3D 뷰어가 직접 튼다)
function bundleRenders(dir, models, renderDir = `${dir}/renders`, keep = () => true) {
  const bundles = [], at = {}, thumbs = {};
  let size = 0, group = null;
  for (const m of models) {
    const files = (m.stats.renders ?? []).filter(f => f !== `${m.slug}_thumb.png` && keep(f));
    if (m.stats.renders?.includes(`${m.slug}_thumb.png`)) thumbs[m.slug] = dataURL(`${renderDir}/${m.slug}_thumb.png`);
    if (!files.length) continue;
    const urls = files.map(f => [f, dataURL(`${renderDir}/${f}`)]);
    const bytes = urls.reduce((n, [, u]) => n + u.length, 0);
    const g = m.category ?? "";
    if (!bundles.length || g !== group || (size && size + bytes > RENDER_CHUNK)) { bundles.push({}); size = 0; group = g; }
    for (const [f, u] of urls) bundles.at(-1)[f] = u;
    size += bytes;
    at[m.slug] = bundles.length;
  }
  for (const f of readdirSync(resolve(root, dir))) if (/^editor-(renders-\d+|thumbs)\.json$/.test(f)) rmSync(resolve(root, dir, f));
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

/* ---------- p36 리소스 편집기 (res-editor.html) ---------- */
// 캐릭터: 스펙·통계는 목록에, 모델은 묶음에, 렌더는 보기 넷(3/4·정면·옆·뒤)만 묶음에 (동작은 3D 뷰어가 직접 튼다)
{
  const dir = "assets/models";
  const index = json(`${dir}/index.json`);
  const { at, count } = bundleModels(dir, index.models.map(m => m.slug), dir);
  let models = index.models.map(m => ({ ...m, bundle: at[m.slug], spec: json(`assets/specs/${m.slug}.json`), stats: json(`${dir}/${m.slug}.stats.json`) }));
  const VIEWS = /_(three_quarter|front|side|back)\.png$/;
  const rp = bundleRenders("assets/renders", models.map(m => ({ ...m, category: "character" })), "assets/renders", f => VIEWS.test(f));
  models = models.map(m => ({ ...m, renders: rp.at[m.slug] ?? null }));
  write(`${dir}/editor-index.json`, { ...index, bundles: count, renderBundles: rp.count, thumbs: "editor-thumbs.json", models });
  console.log(`${dir}/editor-index.json — 캐릭터 ${models.length}명`);
}

// 11차 옷 (assets/clothes): 목록·스펙·통계·썸네일은 editor-clothes.json 하나, 모델은 editor-clothes-models.json 하나 (한 벌 40–80KB),
// 렌더는 보기 넷(3/4·정면·옆·뒤 — 걷기는 3D 뷰어가 직접 튼다)만 editor-clothes-renders-<n>.json 에. 묶음은 모두 assets/res/ (gitignore) — 옷마다 파일을 두지 않는다.
// 기본 윗옷 CL-00(builtin, 몸 모델 player 의 player_top)은 모델·렌더가 따로 없다 → 편집기가 캐릭터 묶음의 player 를 쓴다 (썸네일만 player_thumb).
{
  const dir = "assets/clothes", out = "assets/res";
  mkdirSync(resolve(root, out), { recursive: true });
  for (const f of readdirSync(resolve(root, out))) if (/^editor-clothes-renders-\d+\.json$/.test(f)) rmSync(resolve(root, out, f));
  const index = json(`${dir}/index.json`);
  const VIEWS = /_(three_quarter|front|side|back)\.png$/;
  const models = {}, packs = [];
  let size = 0;
  const clothes = index.models.map(c => {
    const spec = json(`${dir}/specs/${c.slug}.json`);
    if (c.builtin) return { ...c, spec, stats: null, renders: null, thumb: dataURL("assets/renders/player_thumb.png") };
    const stats = json(`${dir}/models/${c.slug}.stats.json`);
    models[c.slug] = json(`${dir}/models/${c.slug}.glb.json`).data;
    const urls = (stats.renders ?? []).filter(f => VIEWS.test(f)).map(f => [f, dataURL(`${dir}/renders/${f}`)]);
    const bytes = urls.reduce((n, [, u]) => n + u.length, 0);
    if (!packs.length || (size && size + bytes > RENDER_CHUNK)) { packs.push({}); size = 0; }
    for (const [f, u] of urls) packs.at(-1)[f] = u;
    size += bytes;
    return { ...c, spec, stats, renders: packs.length, thumb: stats.renders?.includes(`${c.slug}_thumb.png`) ? dataURL(`${dir}/renders/${c.slug}_thumb.png`) : null };
  });
  const mn = write(`${out}/editor-clothes-models.json`, models);
  const sizes = packs.map((p, i) => write(`${out}/editor-clothes-renders-${i + 1}.json`, p));
  const n = write(`${out}/editor-clothes.json`, { ...index, renderBundles: packs.length, models: clothes });
  console.log(`${out}/editor-clothes.json — 옷 ${clothes.length}벌 (${mb(n)}) · 모델 ${Object.keys(models).length}벌 editor-clothes-models.json ${mb(mn)} · 렌더 editor-clothes-renders-1…${packs.length}.json 합 ${mb(sizes.reduce((a, b) => a + b, 0))}`);
}

// 리소스 목록 (모든 영역 한 줄씩): 편집기 주소 끝 key · 교체 약속 검사 · 주제 · 예전 버전
const RES = [
  { area: "character", index: "assets/models/index.json", specs: "assets/specs", models: "assets/models", renders: "assets/renders", key: m => m.slug },
  { area: "env", index: "assets/env/index.json", specs: "assets/env/specs", models: "assets/env/models", renders: "assets/env/renders", key: m => m.slug },
  { area: "furniture", index: "assets/furniture/index.json", specs: "assets/furniture/specs", models: "assets/furniture/models", renders: "assets/furniture/renders", key: m => "furn-" + m.slug },
  { area: "fixture", index: "assets/furniture/fixtures/index.json", specs: "assets/furniture/fixtures/specs", models: "assets/furniture/fixtures/models", renders: "assets/furniture/fixtures/renders", key: m => "fix-" + m.slug },
  { area: "item", index: "assets/items/index.json", specs: "assets/items/specs", models: "assets/items/models", renders: "assets/items/renders", key: m => "item-" + m.slug },
  { area: "pattern", index: "assets/interior/index.json", specs: "assets/interior/specs", models: null, renders: null, key: m => m.slug, only: m => m.kind === "wallpaper" || m.kind === "floor" },
  // 11차 옷: 분류(cat) = 칸 hat·top·shoes, 기본 윗옷(builtin)은 모델 없이 목록·상태·색만 검사
  { area: "clothes", index: "assets/clothes/index.json", specs: "assets/clothes/specs", models: "assets/clothes/models", renders: "assets/clothes/renders", key: m => "cloth-" + m.slug },
];
// 주제: 그 설정 파일이 slug(또는 아이템 id)를 부르면 그 주제 — 행사·밤·투어·축제 모델을 따로 걸러 보게
const THEMES = [["event", "assets/events/events.json"], ["festival", "assets/festival/config.json"], ["night", "assets/night/night.json"], ["tour", "assets/tour/tour.json"]];
const themeText = THEMES.map(([t, p]) => [t, readFileSync(resolve(root, p), "utf8")]);
function themesOf(spec) {
  const words = [spec.slug, spec.item, ...(spec.items ?? []).map(i => i.item)].filter(Boolean);
  const out = themeText.filter(([, text]) => words.some(w => text.includes(`"${w}"`))).map(([t]) => t);
  if (/^festival-/.test(spec.slug) || spec.festival) out.push("festival");
  if (/^event-/.test(spec.slug) || spec.group === "event") out.push("event");
  if (spec.group === "night") out.push("night");
  return [...new Set(out)];
}
// git 기록에서 바로 전 버전: 썸네일(무늬는 스펙)이 바뀐 커밋 목록 → 지금 파일이 커밋돼 있으면 두 번째, 고친 채 아직 커밋 안 했으면 첫 번째
const git = (args, input) => spawnSync("git", args, { cwd: root, input, maxBuffer: 512 * 1048576, encoding: input === undefined ? "utf8" : "buffer" });
function prevFiles(paths) {
  const dirs = [...new Set(paths.map(p => dirname(p)))];
  const log = git(["log", "--format=@%H %ct", "--name-only", "--", ...dirs]).stdout ?? "";
  const hist = {};
  let c = null;
  for (const line of log.split("\n")) {
    if (line.startsWith("@")) { const [h, t] = line.slice(1).split(" "); c = { h, t: +t * 1000 }; continue; }
    if (line.trim() && c) (hist[line.trim()] ??= []).push(c);
  }
  const dirty = new Set((git(["diff", "--name-only", "HEAD", "--", ...dirs]).stdout ?? "").split("\n").map(s => s.trim()).filter(Boolean));
  return Object.fromEntries(paths.map(p => { const h = hist[p] ?? []; return [p, dirty.has(p) ? h[0] : h[1]]; }).filter(([, v]) => v));
}
// git cat-file --batch 로 한 번에 읽기: [[커밋, 경로]] → Buffer[] (없으면 null)
function catFiles(list) {
  if (!list.length) return [];
  const out = git(["cat-file", "--batch"], Buffer.from(list.map(([c, p]) => `${c}:${p}`).join("\n") + "\n")).stdout;
  const res = [];
  let at = 0;
  for (let i = 0; i < list.length; i++) {
    const nl = out.indexOf(10, at), head = out.subarray(at, nl).toString();
    if (head.endsWith("missing")) { res.push(null); at = nl + 1; continue; }
    const size = +head.split(" ")[2];
    res.push(out.subarray(nl + 1, nl + 1 + size));
    at = nl + 1 + size + 1;
  }
  return res;
}
{
  const rows = [], ask = [];
  for (const S of RES) {
    const ix = json(S.index);
    for (const m of (S.list ? S.list(ix) : ix.models).filter(S.only ?? (() => true))) {
      const spec = json(`${S.specs}/${m.slug}.json`);
      const hasModel = S.models && !m.builtin;
      const stats = hasModel ? json(`${S.models}/${m.slug}.stats.json`) : null;
      const info = hasModel ? glbInfo(Buffer.from(json(`${S.models}/${m.slug}.glb.json`).data, "base64")) : null;
      const item = S.area === "furniture" ? ITEMS.find(i => i.id === m.item) : null;
      const checks = checkResource({ area: S.area, spec, row: m, stats, info, extra: { item } });
      const thumb = S.area === "item" ? (m.items?.[0]?.icon ?? null) : m.builtin ? "assets/renders/player_thumb.png" : S.renders ? `${S.renders}/${m.slug}_thumb.png` : null;
      const r = { key: S.key(m), area: S.area, cat: S.area === "item" ? m.group : S.area === "pattern" ? m.kind : S.area === "clothes" ? m.slot : (spec.category ?? S.area), id: m.id, slug: m.slug, name: m.name,
        status: m.status, version: m.version, themes: themesOf(spec), checks, sum: summary(checks), tri: stats?.triangles ?? null, size: stats?.size ?? null,
        specFile: `${S.specs}/${m.slug}.json`, thumbFile: thumb };
      rows.push(r);
      ask.push({ key: r.key, file: thumb ?? r.specFile, spec: r.specFile, kind: thumb ? "thumb" : "spec" });
    }
  }
  const keys = new Set();
  for (const r of rows) { if (keys.has(r.key)) throw new Error(`리소스 key 겹침: ${r.key}`); keys.add(r.key); }
  // 예전 버전 (그림·스펙)
  const at = prevFiles(ask.map(p => p.file));
  const want = ask.filter(p => at[p.file]);
  const blobs = catFiles(want.flatMap(p => [[at[p.file].h, p.file], [at[p.file].h, p.spec]]));
  const prev = {};
  want.forEach((p, i) => {
    const file = blobs[i * 2], specBuf = blobs[i * 2 + 1];
    if (!file) return;
    let old = null;
    try { old = specBuf ? JSON.parse(specBuf.toString("utf8")) : null; } catch {}
    prev[p.key] = { commit: at[p.file].h.slice(0, 7), at: at[p.file].t, version: old?.version ?? null, status: old?.status ?? null,
      ...(p.kind === "thumb" ? { thumb: "data:image/png;base64," + file.toString("base64") } : { spec: old }) };
  });
  for (const r of rows) r.prev = prev[r.key] ? { version: prev[r.key].version, at: prev[r.key].at, commit: prev[r.key].commit } : null;
  mkdirSync(resolve(root, "assets/res"), { recursive: true });
  const fails = rows.filter(r => r.sum.fail), warns = rows.filter(r => r.sum.warn);
  const n = write("assets/res/editor-index.json", { builtAt: Date.now(), commit: (git(["rev-parse", "--short", "HEAD"]).stdout ?? "").trim(), count: rows.length, rows });
  const pn = write("assets/res/editor-prev.json", prev);
  console.log(`assets/res/editor-index.json — 리소스 ${rows.length}개 · 약속 어긋남 ${fails.length} · 손볼 것 ${warns.length} (${mb(n)}) · editor-prev.json 예전 버전 ${Object.keys(prev).length}개 (${mb(pn)})`);
  for (const r of fails) console.log(`  ✗ ${r.key}: ${r.checks.filter(c => c.state === "fail").map(c => c.detail).join(" / ")}`);
  for (const r of warns) console.log(`  △ ${r.key}: ${r.checks.filter(c => c.state === "warn").map(c => c.detail).join(" / ")}`);
}

// 리소스 편집기 게시 파일 목록: 페이지 + 검사 모듈 + 반영 기록 도구 + 영역마다 묶음 (배경 편집기와 같은 묶음을 같이 쓴다)
{
  const DIRS = ["assets/models", "assets/renders", "assets/env", "assets/furniture", "assets/furniture/fixtures", "assets/items", "assets/interior", "assets/res"];
  // 옷 3D 보기는 게임과 같은 끼우는 틀(src/player/wear.js — three 만 씀)을 그대로 불러온다
  const files = [{ as: "index.html", path: "res-editor.html" }, { as: "tools/res-contracts.mjs", path: "tools/res-contracts.mjs" }, { as: "concept/board-kit.js", path: "concept/board-kit.js" }, { as: "src/player/wear.js", path: "src/player/wear.js" }];
  for (const dir of DIRS) {
    for (const f of readdirSync(resolve(root, dir)).sort((a, b) => a.localeCompare(b, "en", { numeric: true })))
      if (/^editor-[a-z]+(-[a-z]+)*(-\d+)?\.json$/.test(f)) files.push({ as: `${dir}/${f}`, path: `${dir}/${f}` });
  }
  const out = resolve(root, "dist/res-editor");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const abs = files.map(f => ({ as: f.as, path: resolve(root, f.path), bytes: statSync(resolve(root, f.path)).size }));
  const batches = [[]];
  for (const f of abs) { const b = batches.at(-1); if (b.length && b.reduce((n, x) => n + x.bytes, 0) + f.bytes > 60 * 1048576) batches.push([]); batches.at(-1).push(f); }
  writeFileSync(resolve(out, "publish.json"), JSON.stringify({ note: "리소스 편집기 게시 파일 (node tools/build-editor-index.mjs). publish_files 의 files 에 batches 를 차례로 — 첫 차례에 index.html (<!doctype html>…<body> + res-editor.html + </body></html> 로 감싼 사본, docs/notes/p36-res-editor.md)", count: files.length, bytes: abs.reduce((n, f) => n + f.bytes, 0), batches: batches.map(b => b.map(({ as, path }) => ({ as, path }))) }, null, 1) + "\n");
  if (process.argv.includes("--mirror")) for (const f of files) { const to = resolve(out, f.as); mkdirSync(dirname(to), { recursive: true }); copyFileSync(resolve(root, f.path), to); }
  console.log(`리소스 편집기 게시 파일 ${files.length}개 · ${mb(abs.reduce((n, f) => n + f.bytes, 0))} (한도 511개 · 256MB) → dist/res-editor/publish.json`);
}
