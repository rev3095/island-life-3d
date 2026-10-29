// 게임 숫자 표 (6차 M6-P5): assets/data/items.json (아이템 사전) · rules.json (시작 지급·상점·채집 확률·하루·레시피·생일·주민 숫자).
// 표 편집기(data-editor.html) 에서 고치고 채팅 "숫자 반영" 으로 들어온다 (docs/notes/m6-p5-mapdata.md).
// 표를 쓰는 모듈(items·spawns·economy …)이 읽자마자 쓸 수 있게 이 모듈이 표를 다 받을 때까지 기다린다 (top-level await).
// 브라우저는 assets.loadJSON (웹 게시본도 같은 경로), node(테스트·도구, 22.3+)는 파일을 바로 읽는다.
const fs = globalThis.process?.getBuiltinModule?.('node:fs');

async function load(path) {
  if (fs) return JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const { loadJSON } = await import('../core/assets.js');
  return loadJSON(path);
}

export const [ITEM_TABLE, RULES] = await Promise.all([load('assets/data/items.json'), load('assets/data/rules.json')]);
