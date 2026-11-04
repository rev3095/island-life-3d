// 가구 스펙(assets/furniture/specs/<slug>.json)으로 Blender를 백그라운드 실행해 모델·렌더를 다시 만든다.
// 사용: node tools/build-furniture.mjs log-chair [sofa ...] [--no-render]
//       node tools/build-furniture.mjs --all
//       node tools/build-furniture.mjs --index            (Blender 없이 목록만 다시 씀: 스펙의 status·이름만 바꿨을 때)
//       node tools/build-furniture.mjs --fixtures shop-counter | --fixtures --all | --fixtures --index
//            상점·박물관 붙박이 (assets/furniture/fixtures — 계산대·진열 받침·수조 등, 아이템 표 밖이라 가구 목록과 따로)
// 빌드가 끝나면 게임이 읽는 가구 목록(assets/furniture/index.json, 붙박이는 assets/furniture/fixtures/index.json)을 다시 쓴다.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glbToJson } from "./glb-to-json.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixtures = process.argv.includes("--fixtures");
const furnDir = resolve(root, fixtures ? "assets/furniture/fixtures" : "assets/furniture");
const specDir = resolve(furnDir, "specs");
const modelDir = resolve(furnDir, "models");
const blender = process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

const args = process.argv.slice(2);
const readSpecs = () => readdirSync(specDir).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(resolve(specDir, f), "utf8")));
const flags = args.filter(a => a === "--no-render");
const slugs = args.includes("--all") ? readSpecs().map(s => s.slug) : args.filter(a => !a.startsWith("--"));

const indexOnly = args.includes("--index");
if (!indexOnly && !existsSync(blender)) throw new Error(`Blender를 찾을 수 없음: ${blender} (BLENDER 환경변수로 지정)`);
if (!indexOnly && !slugs.length) throw new Error("만들 가구를 지정하세요: node tools/build-furniture.mjs log-chair | --all");

let failed = 0;
for (const slug of slugs) {
  const spec = resolve(specDir, `${slug}.json`);
  if (!existsSync(spec)) { console.error(`스펙 파일이 없음: ${spec}`); failed++; continue; }
  console.log(`\n=== ${slug} ===`);
  const result = spawnSync(blender, ["-b", "--factory-startup", "--python", resolve(root, "assets/blender/build_furniture.py"), "--", spec, resolve(root, "assets"), ...flags, ...(fixtures ? [`--out=${furnDir}`] : [])], { stdio: "inherit" });
  if (result.status !== 0) { console.error(`실패: ${slug}`); failed++; continue; }
  console.log("저장:", glbToJson(resolve(modelDir, `${slug}.glb`)));
}

// 가구 목록: 한 번 이상 빌드된 것만, ID(아이템 code) 순서. 게임은 이 목록으로 아이템 id → 모델을 찾는다
const index = readSpecs()
  .filter(s => existsSync(resolve(modelDir, `${s.slug}.stats.json`)))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(s => {
    const st = JSON.parse(readFileSync(resolve(modelDir, `${s.slug}.stats.json`), "utf8"));
    return {
      id: s.id, slug: s.slug, item: s.item, name: s.name, place: s.place ?? "floor", ...(s.layer ? { layer: s.layer } : {}),
      footprint: s.footprint, size: st.size, variants: Object.keys(s.variants ?? {}), animations: s.animations ?? [],
      version: s.version, status: s.status ?? "review",
    };
  });
writeFileSync(resolve(furnDir, "index.json"), JSON.stringify({ models: index }, null, 2) + "\n");
console.log(`\n${fixtures ? "붙박이" : "가구"} 목록 ${index.length}개 → ${fixtures ? "assets/furniture/fixtures" : "assets/furniture"}/index.json`);
process.exit(failed ? 1 : 0);
