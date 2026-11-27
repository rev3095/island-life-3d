// 웹사이트(GitHub Pages) 게시본: dist/web 을 dist/site 로 옮기고 index.html 을 문서 틀로 감싼다.
// dist/web/index.html 은 아티팩트용이라 틀(doctype·head·body)이 없다 — 아티팩트는 게시할 때 틀을 붙이지만 일반 웹 서버는 안 붙인다.
// dist/web 에는 묶음(packs/)만 있고, 묶음 밖 파일(css·css 가 부르는 그림)은 files.json 이 「게시 경로 → 원본 경로」로만 적어 둔다.
// 아티팩트 게시는 그 원본 경로에서 올리므로, 여기서도 files*.json 을 읽어 원본을 게시 경로로 복사한다 (빠지면 ui.css 등이 404 → UI 가 깨진다).
// 순서: node tools/build-web.mjs → node tools/build-site.mjs (.github/workflows/pages.yml 이 main 에 push 될 때마다 돌린다)
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SRC = 'dist/web';
const OUT = 'dist/site';
if (!existsSync(`${SRC}/index.html`)) {
  console.error(`${SRC}/index.html 이 없어요 — 먼저 node tools/build-web.mjs`);
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
const lists = readdirSync(SRC).filter(f => /^files(-\d+)?\.json$/.test(f));
for (const f of ['build-prev.json', 'index.wrapped.html', ...lists]) rmSync(`${OUT}/${f}`, { force: true });

// 묶음 밖 파일: 게시 경로에 아직 없는 것만 원본에서 복사
let copied = 0;
const missing = [];
for (const list of lists) {
  const map = JSON.parse(readFileSync(`${SRC}/${list}`, 'utf8'));
  for (const [served, source] of Object.entries(map)) {
    const dst = join(OUT, served);
    if (existsSync(dst)) continue;
    if (!existsSync(source)) { missing.push(`${served} ← ${source}`); continue; }
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(source, dst);
    copied++;
  }
}
if (missing.length) {
  console.error(`원본이 없는 게시 파일 ${missing.length}개:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

// 틀: <body> 를 직접 열지 않아야 앞쪽 title·meta(viewport)·link·style·importmap 이 head 에 남는다 (첫 본문 요소에서 body 가 저절로 열린다)
const page = readFileSync(`${SRC}/index.html`, 'utf8');
// 아티팩트 뷰어가 페이지 앞에 붙이는 기본 스타일 (dev-server.mjs SKELETON 과 같은 글): body 여백 0 · 기본 글꼴 · [hidden] 숨기기 · 안전 영역.
// 이것이 없으면 body 여백 8px·숨긴 창이 보이는 등 아티팩트와 달라진다. 페이지 자기 스타일이 뒤에 와서 덮는다.
const BASE = '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>';
const html = /^\s*<!doctype/i.test(page) ? page
  : `<!doctype html><html lang="ko"><head><meta charset="utf-8">${BASE}\n${page}\n</html>\n`;
writeFileSync(`${OUT}/index.html`, html);
writeFileSync(`${OUT}/.nojekyll`, '');
console.log(`→ ${OUT}/ (index.html 틀 감쌈, 묶음 밖 파일 ${copied}개 복사)`);
