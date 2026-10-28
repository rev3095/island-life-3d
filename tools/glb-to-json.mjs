// .glb 를 base64로 감싼 JSON(<name>.glb.json)으로 바꾼다.
// 웹 공유 링크(아티팩트)는 .glb 파일을 올릴 수 없고, data: 주소를 fetch 하는 것도 막혀 있다.
// 그래서 보드는 이 JSON을 받아 직접 바이트로 풀고 GLTFLoader.parse 로 읽는다.
// 사용: node tools/glb-to-json.mjs assets/models/coco.glb
import { readFileSync, writeFileSync } from "node:fs";

export function glbToJson(glbPath) {
  const glb = readFileSync(glbPath);
  if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error(`glb 파일이 아님: ${glbPath}`);
  const out = glbPath.replace(/\.glb$/, ".glb.json");
  writeFileSync(out, JSON.stringify({ format: "glb-base64", bytes: glb.length, data: glb.toString("base64") }));
  return out;
}

if (process.argv[1]?.endsWith("glb-to-json.mjs")) {
  for (const path of process.argv.slice(2)) console.log("저장:", glbToJson(path));
}
