// 11차 M11-P3 옷 (보드 wave11 D100-A · D101-A): 옷 스펙(assets/clothes/specs/<slug>.json)으로 Blender 를 백그라운드 실행해
// 옷 모델·렌더를 만든다. 옷은 주인공 몸(스펙 body, 지금 player)과 같은 뼈대로 build_clothes.py → build_character.py 가 만든다.
// 사용: node tools/build-clothes.mjs straw-hat [--no-render]
//       node tools/build-clothes.mjs --all [--jobs 3]
//       node tools/build-clothes.mjs --index       (Blender 없이 목록만: status·이름·값만 바꿨을 때)
// 끝나면 게임·편집기가 읽는 목록 assets/clothes/index.json 을 다시 쓴다. 기본 옷(builtin, CL-00)은 몸 모델에 들어 있어 빌드하지 않는다.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glbToJson } from "./glb-to-json.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = resolve(root, "assets/clothes");
const specDir = resolve(dir, "specs"), modelDir = resolve(dir, "models");
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith("--") && !["--all", "--index", "--jobs"].includes(a));
const jobsAt = args.indexOf("--jobs");
const jobs = jobsAt >= 0 ? Math.max(1, Number(args[jobsAt + 1]) || 1) : 1;
const readSpec = slug => JSON.parse(readFileSync(resolve(specDir, `${slug}.json`), "utf8"));
const allSlugs = () => readdirSync(specDir).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
const slugs = (args.includes("--all") ? allSlugs() : args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--jobs"))
  .filter(s => !readSpec(s).builtin);
const blender = process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const indexOnly = args.includes("--index");
if (!indexOnly && !existsSync(blender)) throw new Error(`Blender를 찾을 수 없음: ${blender} (BLENDER 환경변수로 지정)`);
if (!indexOnly && !slugs.length) throw new Error("만들 옷을 지정하세요: node tools/build-clothes.mjs straw-hat | --all");

function run(slug) {
  return new Promise(res => {
    const p = spawn(blender, ["-b", "--factory-startup", "--python", resolve(root, "assets/blender/build_clothes.py"), "--",
      resolve(specDir, `${slug}.json`), resolve(root, "assets"), ...flags], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", d => { out += d; });
    p.stderr.on("data", d => { out += d; });
    p.on("close", code => {
      const ok = code === 0 && existsSync(resolve(modelDir, `${slug}.glb`)) && /옷 완료/.test(out);
      if (!ok) console.error(`실패: ${slug}\n${out.split("\n").filter(l => /Error|error|clothes|Traceback|line \d+/.test(l)).slice(-25).join("\n")}`);
      else console.log(`${slug}: ${glbToJson(resolve(modelDir, `${slug}.glb`)).replace(root, "")}`);
      res(ok);
    });
  });
}

let failed = 0;
if (!indexOnly) {
  const q = [...slugs];
  await Promise.all(Array.from({ length: Math.min(jobs, q.length) }, async () => {
    while (q.length) if (!(await run(q.shift()))) failed++;
  }));
}

// 목록: 게임(src/player/outfit.js)·리소스 편집기·상점이 읽는다. 모델이 있는(또는 몸에 든) 옷만
const SLOTS = ["hat", "top", "shoes"];
const list = allSlugs().map(readSpec)
  .filter(s => s.builtin || existsSync(resolve(modelDir, `${s.slug}.stats.json`)))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(s => {
    const st = s.builtin ? null : JSON.parse(readFileSync(resolve(modelDir, `${s.slug}.stats.json`), "utf8"));
    const variants = Object.fromEntries(Object.entries(s.variants ?? {}).map(([k, v]) => [k, { label: v.label, palette: v.palette ?? {} }]));
    return {
      id: s.id, slug: s.slug, name: s.name, slot: s.slot, kind: s.kind, version: s.version, status: s.status ?? "review",
      buy: s.buy ?? 0, sell: s.sell ?? 0, palette: s.palette, ...(Object.keys(variants).length ? { variants } : {}),
      ...(s.builtin ? { builtin: true, part: s.part ?? "player_top" } : { model: `assets/clothes/models/${s.slug}.glb.json`, triangles: st.triangles, bones: st.bones }),
    };
  });
// M16 잠수복 칸 suit: 옷장·상점 칸(slots)이 아니라 바다에서만 게임이 입히는 칸 — 목록에는 들어가되 slots 에는 넣지 않는다
const EXTRA_SLOTS = ["suit"];
for (const c of list) if (![...SLOTS, ...EXTRA_SLOTS].includes(c.slot)) throw new Error(`${c.slug}: slot 은 ${[...SLOTS, ...EXTRA_SLOTS].join("|")}`);
writeFileSync(resolve(dir, "index.json"), JSON.stringify({ version: 1, slots: SLOTS, models: list }, null, 2) + "\n");
console.log(`\n옷 목록 ${list.length}개 → assets/clothes/index.json`);
process.exit(failed ? 1 : 0);
