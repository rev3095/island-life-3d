// 웹사이트(GitHub Pages) 게시본: dist/web 을 dist/site 로 옮기고 index.html 을 문서 틀로 감싼다.
// dist/web/index.html 은 아티팩트용이라 틀(doctype·head·body)이 없다 — 아티팩트는 게시할 때 틀을 붙이지만 일반 웹 서버는 안 붙인다.
// 순서: node tools/build-web.mjs → node tools/build-site.mjs (.github/workflows/pages.yml 이 main 에 push 될 때마다 돌린다)
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = 'dist/web';
const OUT = 'dist/site';
if (!existsSync(`${SRC}/index.html`)) {
  console.error(`${SRC}/index.html 이 없어요 — 먼저 node tools/build-web.mjs`);
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
for (const f of ['build-prev.json', 'index.wrapped.html']) rmSync(`${OUT}/${f}`, { force: true });

const page = readFileSync(`${SRC}/index.html`, 'utf8');
const html = /^\s*<!doctype/i.test(page) ? page
  : `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>\n${page}\n</body></html>\n`;
writeFileSync(`${OUT}/index.html`, html);
writeFileSync(`${OUT}/.nojekyll`, '');
console.log(`→ ${OUT}/ (index.html 틀 감쌈)`);
