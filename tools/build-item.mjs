// 아이템 스펙(assets/items/specs/<slug>.json)으로 Blender를 백그라운드 실행해 모델·아이콘 썸네일을 다시 만든다. (5차 Z1)
// 사용: node tools/build-item.mjs fish-crucian [bug-ant ...] [--no-render]
//       node tools/build-item.mjs --all [--jobs 4]
//       node tools/build-item.mjs --category fish          (분류: tool mat seed fruit shell flower fish bug fossil)
//       node tools/build-item.mjs --index                  (Blender 없이 목록만 다시 씀: 스펙의 status·이름만 바꿨을 때)
// 빌드가 끝나면 게임이 읽는 아이템 모델 목록(assets/items/index.json)을 다시 쓴다.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glbToJson } from "./glb-to-json.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const itemDir = resolve(root, "assets/items");
const specDir = resolve(itemDir, "specs");
const modelDir = resolve(itemDir, "models");
const blender = process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

const args = process.argv.slice(2);
const valueOf = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const readSpecs = () => readdirSync(specDir).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(resolve(specDir, f), "utf8")));
const flags = args.filter(a => a === "--no-render");
const category = valueOf("--category");
const jobs = Math.max(1, Number(valueOf("--jobs") ?? 3));
const slugs = args.includes("--all") ? readSpecs().map(s => s.slug)
  : category ? readSpecs().filter(s => s.group === category).map(s => s.slug)
  : args.filter((a, i) => !a.startsWith("--") && !["--jobs", "--category"].includes(args[i - 1]));

const indexOnly = args.includes("--index");
if (!indexOnly && !existsSync(blender)) throw new Error(`Blender를 찾을 수 없음: ${blender} (BLENDER 환경변수로 지정)`);
if (!indexOnly && !slugs.length) throw new Error("만들 아이템을 지정하세요: node tools/build-item.mjs fish-crucian | --all | --category fish");

/** 하나 빌드 → 성공 여부. 로그는 끝난 뒤 한꺼번에 (여러 개를 같이 돌려도 섞이지 않게) */
function buildOne(slug) {
  const spec = resolve(specDir, `${slug}.json`);
  if (!existsSync(spec)) { console.error(`스펙 파일이 없음: ${spec}`); return Promise.resolve(false); }
  return new Promise(done => {
    const p = spawn(blender, ["-b", "--factory-startup", "--python", resolve(root, "assets/blender/build_item.py"), "--", spec, resolve(root, "assets"), ...flags]);
    let log = "";
    p.stdout.on("data", d => { log += d; });
    p.stderr.on("data", d => { log += d; });
    p.on("close", code => {
      const ok = code === 0 && /\[build\] 완료/.test(log);
      const lines = log.split(/\r?\n/).filter(l => /\[build\]|Error|Traceback|line \d+/.test(l));
      console.log(`=== ${slug} ${ok ? "" : "실패"}\n${lines.join("\n")}`);
      if (ok) console.log("저장:", glbToJson(resolve(modelDir, `${slug}.glb`)));
      done(ok);
    });
  });
}

let failed = 0;
const queue = [...slugs];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length) if (!(await buildOne(queue.shift()))) failed++;
}));

// 아이템 모델 목록: 한 번 이상 빌드된 것만, ID 순서. 게임은 이 목록으로 아이템 id → 모델·아이콘을 찾는다
//   icons: 아이템 id → 썸네일 경로 (변형이 있으면 <slug>_<변형>_thumb.png) — src/data/items.js 의 icon 과 같아야 한다 (tests/items-assets.test.mjs)
//   style: 게임 재질 규칙 (materials.applyToonStyle 에 그대로) — 들어 보일 때 스펙을 따로 받지 않게 목록에 같이 둔다
const index = readSpecs()
  .filter(s => existsSync(resolve(modelDir, `${s.slug}.stats.json`)))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(s => {
    const st = JSON.parse(readFileSync(resolve(modelDir, `${s.slug}.stats.json`), "utf8"));
    return {
      id: s.id, slug: s.slug, name: s.name, group: s.group, kind: s.kind, hold: !!s.hold,
      items: s.items.map(x => ({ item: x.item, code: x.code, ...(x.variant ? { variant: x.variant } : {}),
        icon: `assets/items/renders/${s.slug}${x.variant ? `_${x.variant}` : ""}_thumb.png` })),
      variants: Object.keys(s.variants ?? {}), size: st.size,
      style: Object.fromEntries(Object.entries(s.style ?? {}).filter(([k]) => ["outlineWidth", "flat", "noOutline"].includes(k))),
      version: s.version, status: s.status ?? "review",
    };
  });
writeFileSync(resolve(itemDir, "index.json"), JSON.stringify({ models: index }, null, 2) + "\n");
console.log(`\n아이템 모델 ${index.length}개 · 아이콘 ${index.reduce((n, m) => n + m.items.length, 0)}개 → assets/items/index.json${failed ? ` (실패 ${failed})` : ""}`);
process.exit(failed ? 1 : 0);
