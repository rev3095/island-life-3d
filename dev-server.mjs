// 로컬 확인용 서버: island-life-3d 폴더를 서빙한다. (node dev-server.mjs → http://localhost:4180/editor.html)
// - 웹 공유 링크(아티팩트)와 같은 보안 규칙(CSP)을 걸어서, 로컬에서 되는 것이 웹에서도 되도록 확인한다.
// - 보드의 레퍼런스 업로드·요청 저장을 로컬 파일로 받는 간단한 API를 제공한다.
//     POST /api/assets?name=<파일명>   → assets/references/<id>  (본문 = 파일 바이트)
//     GET  /api/db/<collection>        → assets/review/<collection>.json 의 행 목록
//     POST /api/db/<collection>        → 행 추가, PATCH /api/db/<collection>/<id> → 행 병합
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 4180);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};
const EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm" };
// 아티팩트 뷰어와 비슷한 규칙: 스크립트는 허용된 CDN만, fetch 는 같은 출처만 (data: fetch 차단)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
].join("; ");

const dbFile = col => join(root, "assets/review", `${col}.json`);
async function readRows(col) {
  try { return JSON.parse(await readFile(dbFile(col), "utf8")); } catch { return []; }
}
async function writeRows(col, rows) {
  await mkdir(join(root, "assets/review"), { recursive: true });
  await writeFile(dbFile(col), JSON.stringify(rows, null, 2));
}
const body = req => new Promise((ok, no) => { const parts = []; req.on("data", c => parts.push(c)); req.on("end", () => ok(Buffer.concat(parts))); req.on("error", no); });
const json = (res, code, data) => res.writeHead(code, { "content-type": MIME[".json"] }).end(JSON.stringify(data));

async function api(req, res, path) {
  if (path === "/api/ping") return json(res, 200, { ok: true });
  if (path === "/api/assets" && req.method === "POST") {
    const type = (req.headers["content-type"] ?? "").split(";")[0];
    if (!EXT[type]) return json(res, 415, { code: "unsupported_type" });
    const name = (new URL(req.url, "http://x").searchParams.get("name") ?? "file").replace(/\.[^.]+$/, "").replace(/[^\w가-힣-]+/g, "_").slice(0, 40);
    const id = `${Date.now().toString(36)}-${name}${EXT[type]}`;
    await mkdir(join(root, "assets/references"), { recursive: true });
    await writeFile(join(root, "assets/references", id), await body(req));
    return json(res, 200, { id, url: `assets/references/${id}` });
  }
  const m = path.match(/^\/api\/db\/([\w-]+)(?:\/([\w-]+))?$/);
  if (m) {
    const [, col] = m;
    if (req.method === "GET") return json(res, 200, await readRows(col));
    const data = JSON.parse((await body(req)).toString("utf8") || "{}");
    // 같은 컬렉션 쓰기는 한 번에 하나씩 (읽고-고치고-쓰기 사이에 다른 쓰기가 끼면 값이 사라진다)
    const run = (queues[col] ?? Promise.resolve()).then(() => writeOne(res, req, m, data));
    queues[col] = run.catch(() => {});
    return run;
  }
  return json(res, 404, { code: "not_found" });
}

const queues = {};
async function writeOne(res, req, [, col, id], data) {
  const rows = await readRows(col);
  if (req.method === "POST" && !id) {
    const row = { ...data, id: `${Date.now().toString(36)}${randomBytes(3).toString("hex")}` };
    rows.push(row);
    await writeRows(col, rows);
    return json(res, 200, { id: row.id });
  }
  if (req.method === "PATCH" && id) {
    const row = rows.find(r => r.id === id);
    if (!row) return json(res, 404, { code: "not_found" });
    Object.assign(row, data);
    await writeRows(col, rows);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { code: "not_found" });
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path.startsWith("/api/")) return api(req, res, path).catch(e => json(res, 500, { code: "server_error", message: String(e) }));
  const target = normalize(join(root, path === "/" ? "/editor.html" : path));
  if (!target.startsWith(root)) return res.writeHead(403).end("forbidden");
  try {
    if (!(await stat(target)).isFile()) throw new Error("not a file");
    const file = await readFile(target);
    // 아티팩트처럼 skeleton 없이 쓴 페이지도 표준 모드로 보이도록 doctype을 붙여준다
    const html = extname(target) === ".html" && !file.subarray(0, 20).toString().toLowerCase().includes("<!doctype");
    res.writeHead(200, { "content-type": MIME[extname(target).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store", "content-security-policy": CSP });
    res.end(html ? Buffer.concat([Buffer.from('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'), file]) : file);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`island-life-3d: http://localhost:${port}/editor.html`));
