// 웹 배포 빌드(tools/build-web.mjs) 검사: 게시 목록에 .glb 가 없고, 모듈·에셋이 읽는 파일이 모두 목록에 있고,
// 페이지가 아티팩트 뼈대 규칙을 지키고, 255개 제한에 맞게 나뉘는지.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { planWeb, writeWeb, makeBatches, FAMILIES, LIMITS, ROOT } from '../tools/build-web.mjs';

const plan = planWeb();
const paths = new Set(plan.files.map(f => f.path));
const read = p => readFileSync(join(ROOT, p), 'utf8');

test('build-web: 오류·주의 없이 계획이 선다', () => {
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.warnings, []);
  assert.ok(paths.has('src/main.js'));
});

test('build-web: .glb·렌더·stats 는 빠지고 모델은 .glb.json 만', () => {
  for (const p of paths) {
    assert.ok(!p.endsWith('.glb'), p);
    assert.ok(!p.endsWith('.stats.json'), p);
    assert.ok(!/\.(blend|blend1|py|mjs|md)$/.test(p), p);
    if (p.endsWith('.png')) assert.match(p, /^assets\/furniture\/renders\/[\w-]+_thumb\.png$/);
    if (/\/models\/[^/]+$/.test(p) && !p.endsWith('index.json')) assert.ok(p.endsWith('.glb.json'), p);
  }
});

test('build-web: 모든 파일이 있고 게시 경로 = 저장소 상대 경로', () => {
  assert.equal(paths.size, plan.files.length, '겹친 경로');
  for (const f of plan.files) {
    assert.equal(f.path, f.src);
    assert.ok(!f.path.startsWith('/') && !f.path.includes('..') && !f.path.includes('\\'), f.path);
    assert.ok(existsSync(join(ROOT, f.src)), `없는 파일 ${f.src}`);
    assert.equal(statSync(join(ROOT, f.src)).size, f.bytes);
  }
});

test('build-web: 목록에 든 모듈이 읽는 상대 경로·에셋이 모두 목록에 있다', () => {
  for (const file of [...paths].filter(p => p.endsWith('.js'))) {
    const text = read(file);
    const refs = [
      ...[...text.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map(m => m[1]),
      ...[...text.matchAll(/\bimport\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map(m => m[1]),
      ...[...text.matchAll(/['"](\.{1,2}\/[\w./-]+\.(?:js|css))['"]/g)].map(m => m[1]),
    ];
    for (const ref of refs) assert.ok(paths.has(posix.normalize(posix.join(posix.dirname(file), ref))), `${file} → ${ref}`);
    for (const m of text.matchAll(/['"`](assets\/[^'"`\s${}]+\.\w+)['"`]/g)) assert.ok(paths.has(m[1]), `${file} → ${m[1]}`);
  }
});

test('build-web: 에셋 목록의 slug 마다 모델·스펙이 들어간다', () => {
  for (const fam of FAMILIES) {
    assert.ok(paths.has(fam.index), fam.index);
    const models = JSON.parse(read(fam.index)).models;
    assert.ok(models.length > 0, fam.index);
    for (const { slug } of models) for (const p of fam.each(slug)) assert.ok(paths.has(p), `${fam.name} ${slug}: ${p}`);
  }
});

test('build-web: 페이지는 뼈대 없이, 제목이 앞쪽에, importmap → modulepreload → main.js 순서', () => {
  const page = plan.page;
  for (const tag of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) assert.doesNotMatch(page, tag);
  const title = page.indexOf('<title>');
  assert.ok(title >= 0 && Buffer.byteLength(page.slice(0, page.indexOf('</title>'))) < 8 * 1024, '제목은 앞 8KB 안에');
  const map = page.indexOf('<script type="importmap">');
  const firstPreload = page.indexOf('<link rel="modulepreload"');
  const main = page.indexOf('<script type="module" src="src/main.js">');
  assert.ok(map >= 0 && firstPreload > map && main > firstPreload, '순서');
  assert.ok(page.indexOf('id="loader"') > 0 && page.indexOf('id="loader"') < main, '로딩 화면이 main.js 앞에');
  for (const [, href] of page.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)) {
    assert.ok(paths.has(href) || plan.external.includes(href), href);
  }
  // 외부 주소는 아티팩트 CSP 가 허용하는 곳만
  for (const [, url] of page.matchAll(/(?:src|href)="(https:[^"]+)"/g)) assert.match(url, /^https:\/\/(cdn\.jsdelivr\.net\/npm\/|fonts\.googleapis\.com|fonts\.gstatic\.com)/);
  // 로딩 화면 설정: 모듈 이름은 main.js MODULES, 모듈 수는 목록의 js 수
  const cfg = JSON.parse(page.match(/const CFG = (\{.*?\});/)[1]);
  assert.deepEqual(cfg.modules, ['data', 'sky', 'world', 'player', 'ui', 'audio', 'gameplay']);
  assert.equal(cfg.js, plan.files.filter(f => f.path.endsWith('.js')).length);
  for (const m of cfg.modules) assert.ok(cfg.stages[m].service && cfg.stages[m].label && cfg.stages[m].name, m);
});

test('build-web: 게시 묶음은 제한 안에서 빠짐·겹침 없이', () => {
  const flat = plan.batches.flat().map(f => f.path);
  assert.deepEqual(flat, plan.files.map(f => f.path));
  plan.batches.forEach((b, i) => {
    assert.ok(b.length <= (i === 0 ? LIMITS.perPublish - 1 : LIMITS.perPublish), `묶음 ${i + 1}: ${b.length}개`);
    assert.ok(b.reduce((s, f) => s + f.bytes, 0) <= LIMITS.publishBytes);
  });
  assert.ok(plan.files.length + 1 <= LIMITS.perVersion);
  assert.ok(plan.totalBytes <= LIMITS.versionBytes);
});

test('build-web: 255개가 넘으면 첫 묶음 254 + 다음 255 … 로 나눈다', () => {
  const fake = Array.from({ length: 600 }, (_, i) => ({ path: `f${i}.json`, bytes: 10 }));
  assert.deepEqual(makeBatches(fake).map(b => b.length), [254, 255, 91]);
  const big = Array.from({ length: 5 }, (_, i) => ({ path: `m${i}.json`, bytes: 30 * 1024 * 1024 }));
  assert.deepEqual(makeBatches(big).map(b => b.length), [2, 2, 1], '64MB 마다 나눈다');
});

test('build-web: writeWeb 은 페이지·files.json(게시 경로 → 원본)·build.json 을 쓴다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'island-web-'));
  try {
    writeWeb(plan, dir);
    assert.equal(readFileSync(join(dir, 'index.html'), 'utf8'), plan.page);
    const files = JSON.parse(readFileSync(join(dir, 'files.json'), 'utf8'));
    assert.deepEqual(Object.keys(files), plan.files.map(f => f.path));
    for (const [k, v] of Object.entries(files)) assert.equal(k, v);
    const info = JSON.parse(readFileSync(join(dir, 'build.json'), 'utf8'));
    assert.equal(info.files, plan.files.length + 1);
    assert.equal(info.batches.length, plan.batches.length);
    if (plan.batches.length > 1) plan.batches.forEach((b, i) => assert.equal(Object.keys(JSON.parse(readFileSync(join(dir, `files-${i + 1}.json`), 'utf8'))).length, b.length));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
