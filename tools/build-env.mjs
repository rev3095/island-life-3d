// 배경 요소 스펙(assets/env/specs/<slug>.json)으로 Blender를 백그라운드 실행해 모델·렌더를 다시 만든다.
// 사용: node tools/build-env.mjs tree [rock ...] [--no-render]
//       node tools/build-env.mjs --all              (스펙 전부)
//       node tools/build-env.mjs --category nature  (분류 하나: nature | prop | building | tile)
// 빌드가 끝나면 배경 편집기가 읽는 목록(assets/env/index.json)을 다시 쓴다.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glbToJson } from "./glb-to-json.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const envDir = resolve(root, "assets/env");
const specDir = resolve(envDir, "specs");
const modelDir = resolve(envDir, "models");
const CATEGORIES = ["nature", "prop", "building", "tile"];
const blender = process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

const args = process.argv.slice(2);
const readSpecs = () => readdirSync(specDir).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(resolve(specDir, f), "utf8")));
const catArg = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
const flags = args.filter(a => a === "--no-render");
const slugs = args.includes("--all") ? readSpecs().map(s => s.slug)
  : catArg ? readSpecs().filter(s => s.category === catArg).map(s => s.slug)
  : args.filter(a => !a.startsWith("--") && a !== catArg);

if (!existsSync(blender)) throw new Error(`Blender를 찾을 수 없음: ${blender} (BLENDER 환경변수로 지정)`);
if (!slugs.length) throw new Error("만들 요소를 지정하세요: node tools/build-env.mjs tree | --all | --category nature");

let failed = 0;
for (const slug of slugs) {
  const spec = resolve(specDir, `${slug}.json`);
  if (!existsSync(spec)) { console.error(`스펙 파일이 없음: ${spec}`); failed++; continue; }
  console.log(`\n=== ${slug} ===`);
  const result = spawnSync(blender, ["-b", "--factory-startup", "--python", resolve(root, "assets/blender/build_env.py"), "--", spec, resolve(root, "assets"), ...flags], { stdio: "inherit" });
  if (result.status !== 0) { console.error(`실패: ${slug}`); failed++; continue; }
  console.log("저장:", glbToJson(resolve(modelDir, `${slug}.glb`)));
}

// 배경 편집기 목록: 한 번 이상 빌드된 요소만, 분류 순서 → ID 순서
const index = readSpecs()
  .filter(s => existsSync(resolve(modelDir, `${s.slug}.stats.json`)))
  .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.id.localeCompare(b.id))
  .map(s => ({ id: s.id, slug: s.slug, name: s.name, category: s.category, kind: s.kind, version: s.version, status: s.status ?? "review" }));
writeFileSync(resolve(envDir, "index.json"), JSON.stringify({ categories: CATEGORIES, models: index }, null, 2) + "\n");
console.log(`\n배경 요소 목록 ${index.length}개 → assets/env/index.json`);
process.exit(failed ? 1 : 0);
