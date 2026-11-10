// 캐릭터 스펙(assets/specs/<slug>.json)으로 Blender를 백그라운드 실행해 모델·렌더를 다시 만든다.
// 사용: node tools/build-character.mjs coco [--no-render]
//       node tools/build-character.mjs --all          (스펙 전부)
//       node tools/build-character.mjs --index            (Blender 없이 목록만 다시 씀: 스펙의 status·이름만 바꿨을 때)
// 빌드가 끝나면 편집기가 읽는 모델 목록(assets/models/index.json)을 다시 쓴다.
// Blender 경로가 다르면 BLENDER 환경변수로 지정한다.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glbToJson } from "./glb-to-json.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const specDir = resolve(root, "assets/specs");
const modelDir = resolve(root, "assets/models");
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith("--") && a !== "--all");
const slugs = args.includes("--all")
  ? readdirSync(specDir).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""))
  : args.filter(a => !a.startsWith("--"));
const blender = process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

const indexOnly = args.includes("--index");
if (!indexOnly && !existsSync(blender)) throw new Error(`Blender를 찾을 수 없음: ${blender} (BLENDER 환경변수로 지정)`);
if (!indexOnly && !slugs.length) throw new Error("만들 캐릭터를 지정하세요: node tools/build-character.mjs coco | --all");

let failed = 0;
for (const slug of slugs) {
  const spec = resolve(specDir, `${slug}.json`);
  if (!existsSync(spec)) { console.error(`스펙 파일이 없음: ${spec}`); failed++; continue; }
  console.log(`\n=== ${slug} ===`);
  const result = spawnSync(
    blender,
    ["-b", "--factory-startup", "--python", resolve(root, "assets/blender/build_character.py"), "--", spec, resolve(root, "assets"), ...flags],
    { stdio: "inherit" },
  );
  if (result.status !== 0) { console.error(`실패: ${slug}`); failed++; continue; }
  console.log("저장:", glbToJson(resolve(modelDir, `${slug}.glb`)));
}

// 편집기 모델 목록: 통계 파일이 있는(= 한 번 이상 빌드된) 스펙만
const ORDER = s => s.id ?? s.slug;
const index = readdirSync(specDir)
  .filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(readFileSync(resolve(specDir, f), "utf8")))
  .filter(s => existsSync(resolve(modelDir, `${s.slug}.stats.json`)))
  .sort((a, b) => ORDER(a).localeCompare(ORDER(b)))
  .map(s => {
    // 10차 AN-11: 앉는 자리 (빌더가 stats 에 쓴 sit = { hip, forward }, 모델 단위) — 게임이 모델을 받기 전에 목록에서 읽는다
    const sit = JSON.parse(readFileSync(resolve(modelDir, `${s.slug}.stats.json`), "utf8")).sit;
    return { id: s.id, slug: s.slug, name: s.name, species: s.species, role: s.role ?? "", category: "character", version: s.version, status: s.status ?? "review", ...(sit ? { sit } : {}) };
  });
writeFileSync(resolve(modelDir, "index.json"), JSON.stringify({ models: index }, null, 2) + "\n");
console.log(`\n모델 목록 ${index.length}개 → assets/models/index.json`);
process.exit(failed ? 1 : 0);
