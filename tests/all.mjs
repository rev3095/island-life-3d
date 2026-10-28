// `node --test tests/` 는 (Node 22+ 에서) 폴더를 하나의 모듈로 실행한다 → package.json main 인 이 파일이
// 같은 폴더의 *.test.mjs 를 모두 불러온다. 파일 하나만 돌릴 때: node --test tests/save.test.mjs
import { readdirSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
for (const f of readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort()) await import(new URL(f, dir));
