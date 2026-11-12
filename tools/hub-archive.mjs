// 편집기 홈 「검수 보드 보관함」 — 보드마다의 반영 기록(applied·history)을 n차 순서 문서 archive/<n차 id> 로 모은다.
//   node tools/hub-archive.mjs --boards <보드 기록.json> [--out <폴더>] [--local] [--print]
// 아티팩트는 서로의 저장소를 못 읽어서, Claude 가 보드 저장소마다 applied · history 를 db_list 로 읽어 한 파일로 모으고
// 이걸 돌려 나온 문서를 홈 저장소 archive/<id> 에 db_write(set) 한다.
//   --boards  { <보드 id>: { applied: {…applied/<id> 의 data}, history: [{…history/<id>-v<n> 의 data}, …] } } (db_list 결과의 data 그대로)
//   --out     문서를 쓸 폴더 (기본 assets/review/hub — archive/<id>.json, gitignore)
//   --local   dev-server 흉내도 고친다: assets/review/hub-archive.json (행마다 docId)
// 차례(n차 번호·결정 범위·만든 날)는 editors.html 의 archive-index, 이름·링크는 editors-list, 문서 계산은 HubLogic.archiveDoc (홈 화면과 같은 함수).
// 저장소가 없는 보드(1차 컨셉 보드)는 archive-index 의 fallback 으로 채운다. 차수 규칙은 docs/notes/board-archive.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { hubLogic } from './hub-game.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function readIndex(html = readFileSync(join(ROOT, 'editors.html'), 'utf8')) {
  const grab = id => JSON.parse(html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`))[1]);
  return { index: grab('archive-index'), list: grab('editors-list') };
}

/** 보드 기록 → { docs: { <n차 id>: 문서 }, missing: [저장소 기록도 fallback 도 없는 보드 id] } */
export function buildArchive({ boards = {}, now = Date.now(), html } = {}) {
  const H = hubLogic(html);
  const { index, list } = readIndex(html);
  const byId = Object.fromEntries(list.map(e => [e.id, e]));
  const docs = {}, missing = [];
  for (const en of [...index].sort((a, b) => a.seq - b.seq)) {
    const rec = boards[en.board] ?? null;
    const doc = JSON.parse(JSON.stringify(H.archiveDoc(en, byId[en.board], rec, now)));   // vm 안 값 → 이쪽 값
    if (doc.source === 'none') missing.push(en.board);
    docs[en.id] = doc;
  }
  return { docs, missing };
}

/* ---------- 실행 ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const file = opt('--boards');
  const boards = file && existsSync(resolve(file)) ? JSON.parse(readFileSync(resolve(file), 'utf8')) : {};
  const { docs, missing } = buildArchive({ boards });
  const out = resolve(ROOT, opt('--out') ?? 'assets/review/hub');
  mkdirSync(join(out, 'archive'), { recursive: true });
  for (const [id, d] of Object.entries(docs)) writeFileSync(join(out, 'archive', `${id}.json`), JSON.stringify(d, null, 1));
  if (args.includes('--local')) {
    const rev = join(ROOT, 'assets/review');
    mkdirSync(rev, { recursive: true });
    writeFileSync(join(rev, 'hub-archive.json'), JSON.stringify(Object.entries(docs).map(([id, d]) => ({ ...d, docId: id })), null, 1));
  }
  const n = Object.keys(docs).length;
  console.log(`archive 문서 ${n}개 → ${join(out, 'archive')}${args.includes('--local') ? ' (+ assets/review/hub-archive.json)' : ''}`);
  for (const d of Object.values(docs)) console.log(`  ${d.id.padEnd(14)} ${d.label.padEnd(10)} ${d.source.padEnd(5)} v${d.applied?.version ?? '-'} ${d.picksSummary}`);
  if (missing.length) console.log(`기록 없음: ${missing.join(', ')}`);
  if (args.includes('--print')) console.log(JSON.stringify(docs, null, 1));
}
