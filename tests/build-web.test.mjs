// 웹 배포 빌드(tools/build-web.mjs) 검사: 게시 목록에 .glb 가 없고, 모듈·에셋이 읽는 파일이 모두 들어가고,
// 에셋은 묶음 파일(packs/*.json) 안에 원본 그대로 들어가고 (M6-P0), 페이지가 아티팩트 뼈대 규칙을 지키고, 255개·511개 제한에 맞게 나뉘는지.
// 마지막 검사는 src/core/packs.js 를 게시본 페이지처럼 꾸며 돌려 본다 (묶음에서 꺼내기·나중에 받기·진행 수·그림 주소·fetch 덮개).
import { quantizeGlbJson } from '../tools/glb-quantize.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveObjectURL } from 'node:buffer';
import { planWeb, writeWeb, makeBatches, splitBySize, planTransition, parseLive, FAMILIES, LIMITS, PACKS, PACK_BYTES, ROOT } from '../tools/build-web.mjs';

const plan = planWeb();
const sources = new Set(plan.files.map(f => f.path));   // 빌드에 든 원본 (plan.files)
const published = new Set(plan.publish.map(f => f.path));   // 게시할 파일 (plan.publish)
const read = p => readFileSync(join(ROOT, p), 'utf8');
const packOf = new Map(plan.packs.flatMap(p => p.files.map(f => [f.path, p])));
// 다른 트랙 브랜치에서 올 모듈 (합치기 전엔 이 작업 트리에 없다): 없을 때만 '없는 모듈 글자' 주의를 기다려 준다. 합친 뒤 비운다.
//   7차 M7-P4 저장 옮기기·문제 알리기 창 — src/ui/index.js 의 EXTRA_PANELS 가 있으면 불러온다 (M7-P3)
const PENDING_MODULES = {};   // 7차 P3·P4 가 합쳐져 비움 (다음 트랙이 아직 없는 모듈을 부를 때만 채운다)
const pending = p => PENDING_MODULES[p] && !existsSync(join(ROOT, p));
const warnings = plan.warnings.filter(w => !Object.keys(PENDING_MODULES).some(p => pending(p) && w === `없는 모듈 글자 (건너뜀): ${PENDING_MODULES[p]}: ./${posix.basename(p)}`));

test('build-web: 오류·주의·알림 없이 계획이 선다', () => {
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(plan.notes, []);
  assert.ok(sources.has('src/main.js') && published.has('src/main.js'));
});

test('build-web: .glb·렌더·stats 는 빠지고 모델은 .glb.json 만', () => {
  for (const p of sources) {
    assert.ok(!p.endsWith('.glb'), p);
    assert.ok(!p.endsWith('.stats.json'), p);
    assert.ok(!/\.(blend|blend1|py|mjs|md)$/.test(p), p);
    if (p.endsWith('.png')) assert.match(p, /^assets\/(furniture|items|clothes)\/renders\/[\w-]+_thumb\.png$/);   // 가구·아이템 썸네일 = 아이콘 · 11차 옷 썸네일 (상점·옷장)
    if (/\/models\/[^/]+$/.test(p) && !p.endsWith('index.json')) assert.ok(p.endsWith('.glb.json'), p);
  }
});

test('build-web: 게시 파일은 모듈·css + 에셋 묶음 몇 개 (에셋을 따로 올리지 않는다)', () => {
  for (const f of plan.publish) {
    if (f.path.startsWith('packs/')) { assert.match(f.path, /^packs\/[a-z]+(-[a-z]+)?-\d+\.json$/); assert.equal(f.src, `dist/web/${f.path}`); continue; }
    assert.match(f.path, /\.(m?js|css)$/, `따로 올라가는 에셋: ${f.path}`);
    assert.equal(f.path, f.src);
  }
  assert.equal(plan.publish.filter(f => f.path.startsWith('packs/')).length, plan.packs.length);
  assert.ok(plan.packs.length <= 21,   // + M13 daily 묶음 + M16 바다 생물 모델로 items 묶음 하나 더 (items-3) + M18-P4 계절 가구 썸네일로 icons 묶음 하나 더 (icons-3)
    `묶음 ${plan.packs.length}개`);
  assert.ok(plan.publish.length + 1 <= LIMITS.perPublish, `한 번에 다 올라가는 수 (지금 ${plan.publish.length + 1}개)`);
});

test('build-web: 원본 파일이 모두 있고 경로가 저장소 상대 경로', () => {
  assert.equal(sources.size, plan.files.length, '겹친 경로');
  for (const f of plan.files) {
    assert.equal(f.path, f.src);
    assert.ok(!f.path.startsWith('/') && !f.path.includes('..') && !f.path.includes('\\'), f.path);
    assert.ok(existsSync(join(ROOT, f.src)), `없는 파일 ${f.src}`);
    assert.equal(statSync(join(ROOT, f.src)).size, f.bytes);
  }
});

test('build-web: 목록에 든 모듈이 읽는 상대 경로·에셋이 모두 들어간다', () => {
  for (const file of [...published].filter(p => p.endsWith('.js'))) {
    const text = read(file);
    const refs = [
      ...[...text.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map(m => m[1]),
      ...[...text.matchAll(/\bimport\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map(m => m[1]),
      ...[...text.matchAll(/['"](\.{1,2}\/[\w./-]+\.(?:js|css))['"]/g)].map(m => m[1]),
    ];
    for (const ref of refs) {
      const p = posix.normalize(posix.join(posix.dirname(file), ref));
      if (!pending(p)) assert.ok(published.has(p), `${file} → ${ref}`);
    }
    for (const m of text.matchAll(/['"`](assets\/[^'"`\s${}]+\.\w+)['"`]/g)) assert.ok(packOf.has(m[1]), `${file} → ${m[1]} (묶음에 없음)`);
  }
});

test('build-web: 에셋 목록의 slug 마다 모델·스펙이 묶음에 들어간다', () => {
  for (const fam of FAMILIES) {
    assert.ok(packOf.has(fam.index), fam.index);
    const models = JSON.parse(read(fam.index)).models;
    assert.ok(models.length > 0, fam.index);
    for (const { slug } of models) for (const p of fam.each(slug)) assert.ok(packOf.has(p), `${fam.name} ${slug}: ${p}`);
  }
});

test('build-web: 에셋은 모두 한 묶음에 한 번씩, 내용은 원본 그대로 (JSON = 같은 값, 모델 = 법선·가중치만 줄인 원본, 그림 = base64 같은 바이트)', () => {
  const assets = plan.files.filter(f => f.path.startsWith('assets/'));
  assert.equal(packOf.size, assets.length, '묶음에 든 파일 수');
  for (const f of assets) assert.ok(packOf.has(f.path), `묶음 밖 에셋 ${f.path}`);
  for (const p of plan.packs) {
    assert.ok(p.bytes <= LIMITS.textBytes, p.path);
    assert.ok(p.bytes <= PACK_BYTES * 1.05 || p.files.length === 1, `${p.path} ${p.bytes}`);
    assert.equal(p.boot, !!PACKS.find(g => g.name === p.group).boot);
    const j = JSON.parse(p.text);
    assert.equal(j.pack, p.name);
    assert.deepEqual(Object.keys(j.files), p.files.map(f => f.path));
    for (const f of p.files) {
      if (f.path.endsWith('.glb.json')) assert.deepEqual(j.files[f.path], JSON.parse(quantizeGlbJson(read(f.path)).text), f.path);   // 모델 = 줄인 원본 (P40)
      else if (f.path.endsWith('.json')) assert.deepEqual(j.files[f.path], JSON.parse(read(f.path)), f.path);
      else assert.ok(Buffer.from(j.files[f.path], 'base64').equals(readFileSync(join(ROOT, f.path))), f.path);
    }
  }
  // 처음에 받는 묶음: 섬 배경·주인공·주민 (개발 서버에서 시작할 때 읽는 것)
  const boot = new Set(plan.packs.filter(p => p.boot).flatMap(p => p.files.map(f => f.path)));
  for (const p of ['assets/env/index.json', 'assets/env/models/tree.glb.json', 'assets/models/player.glb.json', 'assets/specs/coco.json', 'assets/furniture/index.json', 'assets/interior/index.json', 'assets/story/index.json']) assert.ok(boot.has(p), `boot 묶음에 ${p}`);
  for (const p of boot) assert.ok(!/\/(renders|items)\//.test(p) && !p.startsWith('assets/furniture/models/'), `boot 에 들어간 나중 것 ${p}`);
});

test('build-web: 고른 크기로 나누기 — 차례를 지키고 cap 을 넘지 않는다', () => {
  const ids = n => Array.from({ length: n }, (_, i) => i);
  assert.deepEqual(splitBySize(ids(6), () => 1, 10).map(p => p.length), [6]);
  assert.deepEqual(splitBySize(ids(6), () => 1, 4).map(p => p.length), [3, 3]);
  assert.deepEqual(splitBySize(ids(10), () => 1, 4).map(p => p.length), [3, 3, 4]);
  assert.deepEqual(splitBySize([5, 1, 1], x => x, 4).map(p => p.length), [1, 2], 'cap 보다 큰 것은 혼자');
  for (const cap of [3, 7, 20]) {
    const parts = splitBySize(ids(25), () => 1, cap);
    assert.deepEqual(parts.flat(), ids(25));
    for (const p of parts) assert.ok(p.length <= cap);
  }
});

test('build-web: 페이지는 뼈대 없이, 제목이 앞쪽에, importmap → modulepreload → 묶음 목록 → main.js 순서', () => {
  const page = plan.page;
  for (const tag of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) assert.doesNotMatch(page, tag);
  const title = page.indexOf('<title>');
  assert.ok(title >= 0 && Buffer.byteLength(page.slice(0, page.indexOf('</title>'))) < 8 * 1024, '제목은 앞 8KB 안에');
  const map = page.indexOf('<script type="importmap">');
  const firstPreload = page.indexOf('<link rel="modulepreload"');
  const packList = page.indexOf('<script type="application/json" id="island-packs">');
  const main = page.indexOf('<script type="module" src="src/main.js">');
  assert.ok(map >= 0 && firstPreload > map && packList > firstPreload && main > packList, '순서');
  assert.ok(page.indexOf('id="loader"') > 0 && page.indexOf('id="loader"') < main, '로딩 화면이 main.js 앞에');
  for (const [, href] of page.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)) {
    assert.ok(published.has(href) || plan.external.includes(href), href);
  }
  // 외부 주소는 아티팩트 CSP 가 허용하는 곳만
  for (const [, url] of page.matchAll(/(?:src|href)="(https:[^"]+)"/g)) assert.match(url, /^https:\/\/(cdn\.jsdelivr\.net\/npm\/|fonts\.googleapis\.com|fonts\.gstatic\.com)/);
  // 묶음 목록 = 계획의 묶음 (경로·boot·파일)
  const manifest = JSON.parse(page.match(/<script type="application\/json" id="island-packs">([^<]*)<\/script>/)[1]);
  assert.deepEqual(manifest, plan.manifest);
  assert.deepEqual(manifest.packs.map(p => p.path), plan.packs.map(p => p.path));
  for (const [i, p] of manifest.packs.entries()) {
    assert.equal(p.bytes, plan.packs[i].bytes);
    assert.deepEqual(p.files, plan.packs[i].files.map(f => f.path));
  }
  // 로딩 화면 설정: 모듈 이름은 main.js MODULES, 모듈 수는 게시하는 js 수, 에셋 수는 boot 묶음 안 파일 수
  const cfg = JSON.parse(page.match(/const CFG = (\{.*?\});/)[1]);
  assert.deepEqual(cfg.modules, ['data', 'sky', 'world', 'player', 'ui', 'audio', 'gameplay']);
  assert.equal(cfg.js, plan.publish.filter(f => f.path.endsWith('.js')).length);
  assert.equal(cfg.assets, manifest.packs.filter(p => p.boot).reduce((n, p) => n + p.files.length, 0));
  for (const m of cfg.modules) assert.ok(cfg.stages[m].service && cfg.stages[m].label && cfg.stages[m].name, m);
});

test('build-web: 게시 묶음은 제한 안에서 빠짐·겹침 없이', () => {
  const flat = plan.batches.flat().map(f => f.path);
  assert.deepEqual(flat, plan.publish.map(f => f.path));
  plan.batches.forEach((b, i) => {
    assert.ok(b.length <= (i === 0 ? LIMITS.perPublish - 1 : LIMITS.perPublish), `묶음 ${i + 1}: ${b.length}개`);
    assert.ok(b.reduce((s, f) => s + f.bytes, 0) <= LIMITS.publishBytes);
  });
  assert.ok(plan.publish.length + 1 <= LIMITS.perVersion);
  assert.ok(plan.totalBytes <= LIMITS.versionBytes);
});

test('build-web: 255개가 넘으면 첫 묶음 254 + 다음 255 … 로 나눈다', () => {
  const fake = Array.from({ length: 600 }, (_, i) => ({ path: `f${i}.json`, bytes: 10 }));
  assert.deepEqual(makeBatches(fake).map(b => b.length), [254, 255, 91]);
  const big = Array.from({ length: 5 }, (_, i) => ({ path: `m${i}.json`, bytes: 30 * 1024 * 1024 }));
  assert.deepEqual(makeBatches(big).map(b => b.length), [2, 2, 1], '64MB 마다 나눈다');
});

test('build-web: 게시본(파일 하나씩 510개)에서 묶음 빌드로 옮기는 차례 — 지우기 먼저, 어느 때도 511개를 넘지 않는다', () => {
  // 예전 게시본 = 페이지 + 모듈·css + 에셋 하나씩 (+ 새 빌드에서 사라진 파일 하나)
  // 에셋이 늘어 하나씩 다 두면 511 을 넘으므로(M10), 예전 게시본 크기 510 에 맞춰 에셋 일부만 낱개였다고 본다.
  const head = ['index.html', ...plan.publish.filter(f => !f.path.startsWith('packs/')).map(f => f.path)];
  const loose = plan.files.filter(f => f.path.startsWith('assets/')).map(f => f.path).slice(0, Math.max(0, 510 - head.length - 1));
  const live = [...head, ...loose, 'src/old-gone.js'];
  const steps = planTransition(plan.publish, live);
  const have = new Set(live);
  let removing = true;
  for (const step of steps) {
    assert.ok(step.length + 1 <= LIMITS.perPublish, `한 번에 ${step.length + 1}개`);
    for (const f of step) {
      if (f.src == null) { assert.ok(removing, '지우기는 올리기보다 먼저'); assert.ok(have.delete(f.path), f.path); } else { removing = false; have.add(f.path); }
    }
    assert.ok(have.size <= LIMITS.perVersion, `버전 ${have.size}개`);
  }
  assert.deepEqual([...have].sort(), ['index.html', ...plan.publish.map(f => f.path)].sort());
  assert.ok(!steps.flat().some(f => f.path === 'index.html'), '페이지는 file_path 로 올라간다');
  // 목록 글 읽기: list_files 결과 글·JSON 배열·객체
  assert.deepEqual(parseLive('index.html  text/html  41 KB\nsrc/main.js (text/javascript, 3.1 KB)\n  packs/island-1.json 1.7 MB\n12.3 KB\n'), ['index.html', 'src/main.js', 'packs/island-1.json']);
  assert.deepEqual(parseLive('["a/b.json", {"path": "c.js"}]'), ['a/b.json', 'c.js']);
  assert.deepEqual(parseLive('{"x/y.png": "x/y.png"}'), ['x/y.png']);
});

test('build-web: writeWeb 은 페이지·묶음·files.json(게시 경로 → 원본)·build.json·옮기는 차례를 쓴다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'island-web-'));
  try {
    writeWeb(plan, dir, { live: ['index.html', 'assets/env/index.json', ...plan.publish.map(f => f.path)] });
    assert.equal(readFileSync(join(dir, 'index.html'), 'utf8'), plan.page);
    const files = JSON.parse(readFileSync(join(dir, 'files.json'), 'utf8'));
    assert.deepEqual(Object.keys(files), plan.publish.map(f => f.path));
    for (const [k, v] of Object.entries(files)) {
      if (k.startsWith('packs/')) assert.equal(readFileSync(join(ROOT, v), 'utf8'), plan.packs.find(p => p.path === k).text, `${k} → ${v}`);
      else assert.equal(k, v);
    }
    const info = JSON.parse(readFileSync(join(dir, 'build.json'), 'utf8'));
    assert.equal(info.files, plan.publish.length + 1);
    assert.equal(info.batches.length, plan.batches.length);
    assert.deepEqual(info.packs.map(p => p.hash), plan.packs.map(p => p.hash));
    if (plan.batches.length > 1) plan.batches.forEach((b, i) => assert.equal(Object.keys(JSON.parse(readFileSync(join(dir, `files-${i + 1}.json`), 'utf8'))).length, b.length));
    const first = JSON.parse(readFileSync(join(dir, 'publish-1.json'), 'utf8'));
    assert.equal(first['assets/env/index.json'], null, '묶음으로 들어간 예전 경로는 null');
    assert.equal(info.transition[0].remove, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('packs.js: 게시본처럼 — boot 묶음만 먼저, 나머지는 읽을 때, 진행은 파일 수로, 그림은 blob URL, fetch 덮개', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'island-pack-'));
  const saved = { fetch: globalThis.fetch, document: globalThis.document, dispatchEvent: globalThis.dispatchEvent };
  try {
    writeWeb(plan, dir);
    const BASE = 'http://game.test/play/';
    const asked = [], events = [];
    let failOnce = 'packs/items-2.json';
    // 가짜 서버: 페이지 옆 packs/ 만 내준다. 본문은 64KB 씩 흘려 보내서 진행이 묶음 안에서도 움직이는지 본다
    globalThis.fetch = async input => {
      const u = new URL(typeof input === 'string' ? input : input.url, BASE);
      const rel = u.pathname.slice('/play/'.length);
      asked.push(rel);
      if (rel === failOnce) { failOnce = null; return new Response('없음', { status: 404 }); }
      if (!rel.startsWith('packs/') || !existsSync(join(dir, rel))) return new Response('없음', { status: 404 });
      const buf = readFileSync(join(dir, rel));
      let at = 0;
      return new Response(new ReadableStream({ pull(c) { if (at >= buf.length) return c.close(); c.enqueue(buf.subarray(at, at += 64 * 1024)); } }), { status: 200 });
    };
    globalThis.document = { baseURI: `${BASE}index.html`, getElementById: id => (id === 'island-packs' ? { textContent: JSON.stringify(plan.manifest) } : null) };
    globalThis.dispatchEvent = e => { events.push({ ...e.detail }); return true; };
    const P = await import('../src/core/packs.js?game-page');
    assert.equal(P.packed, true);

    // 1) 읽히자마자 boot 묶음만
    const bootPaths = plan.packs.filter(p => p.boot).map(p => p.path);
    assert.deepEqual(asked, bootPaths);
    const spec = await P.readJSON('assets/env/specs/tree.json');
    assert.deepEqual(spec, JSON.parse(read('assets/env/specs/tree.json')));
    assert.deepEqual(await P.readJSON('./assets/env/index.json'), JSON.parse(read('assets/env/index.json')), './ 로 시작해도');
    const bootN = plan.manifest.packs.filter(p => p.boot).reduce((n, p) => n + p.files.length, 0);
    await Promise.all(bootPaths.map(p => P.readJSON(plan.manifest.packs.find(m => m.path === p).files[0])));
    assert.deepEqual({ started: P.loadStats.started, done: P.loadStats.done, failed: P.loadStats.failed }, { started: bootN, done: bootN, failed: 0 });
    // 진행: done 은 줄지 않고, 묶음을 다 받기 전에도 중간 값이 있다 (받은 바이트만큼)
    for (let i = 1; i < events.length; i++) assert.ok(events[i].done >= events[i - 1].done, '진행이 뒤로 가지 않는다');
    assert.ok(events.some(e => e.done > 0 && e.done < bootN && e.ok === null), '묶음 안 중간 진행');

    // 2) 나중 묶음: 처음 읽을 때 한 번만 받는다
    const furnSpec = plan.files.find(f => f.path.startsWith('assets/furniture/specs/')).path;
    const furnPack = packOf.get(furnSpec).path;
    assert.ok(!asked.includes(furnPack));
    const [a, b] = await Promise.all([P.readJSON(furnSpec), P.readJSON(furnSpec)]);
    assert.deepEqual(a, JSON.parse(read(furnSpec)));
    assert.equal(a, b);
    assert.equal(asked.filter(x => x === furnPack).length, 1);

    // 3) 그림: urlNow 는 받기 전 null, url() 은 blob URL (바이트가 원본과 같음), 그다음 urlNow 가 바로 준다
    const icon = plan.files.find(f => f.path.endsWith('.png')).path;
    assert.equal(P.urlNow(icon), null);
    const u = await P.url(icon);
    assert.match(u, /^blob:/);
    assert.ok(Buffer.from(await resolveObjectURL(u).arrayBuffer()).equals(readFileSync(join(ROOT, icon))));
    assert.equal(P.urlNow(icon), u);
    assert.equal(P.urlNow('🐟'), '🐟', '경로가 아니면 그대로');
    assert.equal(P.urlNow('assets/없는/그림.png'), 'assets/없는/그림.png', '묶음 밖이면 그대로');

    // 4) fetch 덮개: 에셋 경로를 직접 fetch 하는 코드(스토리)도 묶음에서 대답, 묶음 밖은 원래 fetch 로
    const story = await (await fetch('assets/story/index.json')).json();
    assert.deepEqual(story, JSON.parse(read('assets/story/index.json')));
    assert.equal((await fetch(`${BASE}packs/nothing.json`)).status, 404);
    assert.equal((await fetch(icon)).headers.get('content-type'), 'image/png');

    // 5) 실패: 묶음이 안 받아지면 그 안 파일 수만큼 실패로 세고, 다시 부르면 다시 받는다
    const itemPath = plan.manifest.packs.find(p => p.path === 'packs/items-2.json')?.files[0];
    if (itemPath) {
      const before = P.loadStats.failed;
      await assert.rejects(P.readJSON(itemPath), /404/);
      assert.equal(P.loadStats.failed - before, plan.manifest.packs.find(p => p.path === 'packs/items-2.json').files.length);
      assert.ok(P.loadStats.failedUrls.includes('packs/items-2.json'));
      // 모델은 묶을 때 법선·가중치를 줄인다 (P40, tools/glb-quantize.mjs) — 원본을 같은 함수로 줄인 것과 같아야 한다
      const want = itemPath.endsWith('.glb.json') ? quantizeGlbJson(read(itemPath)).text : read(itemPath);
      assert.deepEqual(await P.readJSON(itemPath), JSON.parse(want));
    }
    assert.ok(P.packStatus().filter(p => p.boot).every(p => p.state === 'ready'));
  } finally {
    Object.assign(globalThis, saved);
    if (saved.document === undefined) delete globalThis.document;
    if (saved.dispatchEvent === undefined) delete globalThis.dispatchEvent;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('packs.js: 개발 서버처럼 (묶음 목록 없음) — 경로 그대로, 파일을 하나씩', async () => {
  const P = await import('../src/core/packs.js');
  assert.equal(P.packed, false);
  assert.equal(P.urlNow('assets/items/renders/fish-carp_thumb.png'), 'assets/items/renders/fish-carp_thumb.png');
  assert.equal(await P.url('assets/furniture/renders/bed_thumb.png'), 'assets/furniture/renders/bed_thumb.png');
  assert.deepEqual(P.packStatus(), []);
});
