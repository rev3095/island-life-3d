// 배경 편집기용 묶음 목록: index.json 의 요소마다 스펙(specs/<slug>.json)과 통계(models/<slug>.stats.json)를 넣어
// assets/env/editor-index.json · assets/furniture/editor-index.json 을 만든다.
// 아티팩트 한 버전에 파일을 511개까지만 둘 수 있어서, 편집기에는 요소마다 JSON 두 개 대신 이 파일 하나를 올린다.
// 배경 편집기를 게시하기 전에(스펙·모델을 고친 뒤) 한 번 돌린다: node tools/build-editor-index.mjs
// 게임은 이 파일을 쓰지 않는다 (index.json + 스펙을 따로 읽음). 만들어지는 파일은 저장소에 넣지 않는다 (.gitignore).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));

for (const dir of ["assets/env", "assets/furniture"]) {
  const index = json(`${dir}/index.json`);
  const models = index.models.map(m => ({ ...m, spec: json(`${dir}/specs/${m.slug}.json`), stats: json(`${dir}/models/${m.slug}.stats.json`) }));
  writeFileSync(resolve(root, `${dir}/editor-index.json`), JSON.stringify({ ...index, models }) + "\n");
  console.log(`${dir}/editor-index.json — 요소 ${models.length}개`);
}
