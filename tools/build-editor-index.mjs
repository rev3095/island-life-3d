// 배경 편집기용 묶음 파일. 아티팩트 한 버전에 파일을 511개까지만 둘 수 있어서, 편집기에는 요소마다 JSON 두 개 대신 묶음을 올린다.
// - assets/env/editor-index.json · assets/furniture/editor-index.json: index.json 의 요소마다 스펙(specs/<slug>.json)과 통계(models/<slug>.stats.json)
// - assets/items/editor-index.json: 아이템 모델 82개의 스펙·통계 + 아이콘 썸네일(items[].thumb, data: 주소) + 모델이 든 묶음 번호(bundle)
//   assets/items/editor-models-<n>.json: { slug: glb base64 } — 하나에 MODEL_CHUNK 바이트 안쪽, 목록 순서(분류별)대로 나눈다
// - assets/interior/editor-index.json: 벽지·바닥 스펙(models[].spec) + 방 틀(frame) + 주민 방 배치(rooms[].room) + 상점·박물관(places[].room) + 붙박이 FU-35–42(fixtures[], 모델은 assets/furniture/fixtures/editor-models-<n>.json)
// 배경 편집기를 게시하기 전에(스펙·모델을 고친 뒤) 한 번 돌린다: node tools/build-editor-index.mjs
// 게임은 이 파일들을 쓰지 않는다 (index.json + 스펙을 따로 읽음). 만들어지는 파일은 저장소에 넣지 않는다 (.gitignore).
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

// 배경·가구: 스펙·통계는 목록에, 모델은 묶음에 (요소마다 .glb.json 을 따로 올리면 파일 수가 511 을 넘어서 — 2026-10-30 축제 17개를 더할 때)
for (const dir of ["assets/env", "assets/furniture"]) {
  const index = json(`${dir}/index.json`);
  const { at, count } = bundleModels(dir, index.models.map(m => m.slug));
  const models = index.models.map(m => ({ ...m, bundle: at[m.slug], spec: json(`${dir}/specs/${m.slug}.json`), stats: json(`${dir}/models/${m.slug}.stats.json`) }));
  write(`${dir}/editor-index.json`, { ...index, bundles: count, models });
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
