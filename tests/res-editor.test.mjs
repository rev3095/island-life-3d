// 리소스 편집기 (p36) 약속: 교체 약속 검사(tools/res-contracts.mjs)가 지금 리소스는 모두 통과시키고 일부러 깬 후보는 잡는지,
// 편집기 페이지·요청 저장소·채팅 명령·편집기 홈 줄이 노트(docs/notes/p36-res-editor.md)와 맞는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { checkResource, glbInfo, summary, infoOf } from '../tools/res-contracts.mjs';
import { ITEMS } from '../src/data/items.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = p => readFileSync(resolve(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const glb = p => glbInfo(Buffer.from(json(p).data, 'base64'));

const SETS = [
  ['character', 'assets/models/index.json', 'assets/specs', 'assets/models'],
  ['env', 'assets/env/index.json', 'assets/env/specs', 'assets/env/models'],
  ['furniture', 'assets/furniture/index.json', 'assets/furniture/specs', 'assets/furniture/models'],
  ['fixture', 'assets/furniture/fixtures/index.json', 'assets/furniture/fixtures/specs', 'assets/furniture/fixtures/models'],
  ['item', 'assets/items/index.json', 'assets/items/specs', 'assets/items/models'],
  ['pattern', 'assets/interior/index.json', 'assets/interior/specs', null],
];

test('교체 약속 검사: 지금 리소스는 모두 ✗ 없이 통과한다 (tests/assets.test.mjs 와 같은 약속)', () => {
  let n = 0;
  for (const [area, ix, sd, md] of SETS) for (const r of json(ix).models) {
    if (area === 'pattern' && !['wallpaper', 'floor'].includes(r.kind)) continue;
    const spec = json(`${sd}/${r.slug}.json`);
    const rows = checkResource({ area, spec, row: r, stats: md ? json(`${md}/${r.slug}.stats.json`) : null, info: md ? glb(`${md}/${r.slug}.glb.json`) : null,
      extra: { item: area === 'furniture' ? ITEMS.find(i => i.id === r.item) : null } });
    const bad = rows.filter(x => x.state === 'fail');
    assert.equal(bad.length, 0, `${area} ${r.slug}: ${bad.map(x => `${x.label} ${x.detail}`).join(' / ')}`);
    n++;
  }
  assert.ok(n >= 268, `리소스 ${n}개`);
});

test('교체 약속 검사: 깬 후보는 잡는다 (재질 이름 · 동작 · 뼈 · 충돌 · 칸 · 목록)', () => {
  const bench = json('assets/env/specs/bench.json'), bst = json('assets/env/models/bench.stats.json'), binfo = glb('assets/env/models/bench.glb.json');
  const ok = checkResource({ area: 'env', spec: bench, stats: bst, info: binfo });
  assert.equal(summary(ok).fail, 0);
  // 소파 모델을 벤치 자리에: 재질 이름이 팔레트에 없고 충돌 상자가 모델보다 좁다
  const sofa = checkResource({ area: 'env', spec: bench, stats: json('assets/furniture/models/sofa.stats.json'), info: glb('assets/furniture/models/sofa.glb.json') });
  assert.equal(sofa.find(r => r.id === 'materials').state, 'fail');
  assert.equal(sofa.find(r => r.id === 'collider').state, 'fail');
  // 목록과 스펙 버전이 다르면
  assert.equal(checkResource({ area: 'env', spec: bench, row: { id: bench.id, version: '9.9', status: bench.status } }).find(r => r.id === 'index').state, 'fail');
  // 캐릭터: 뼈·동작 없는 모델
  const coco = json('assets/specs/coco.json');
  const flat = checkResource({ area: 'character', spec: coco, info: { materials: ['fur'], nodes: ['body'], clips: ['idle'], skins: 0, triangles: 100 } });
  for (const id of ['clips', 'bones', 'skin']) assert.equal(flat.find(r => r.id === id).state, 'fail', id);
  // 가구: 칸보다 큰 모델 → fail, 삼각형 예산 넘음 → warn
  const sp = json('assets/furniture/specs/sofa.json');
  const big = checkResource({ area: 'furniture', spec: sp, stats: { size: [2.5, 1, 1], triangles: 20000 }, info: glb('assets/furniture/models/sofa.glb.json') });
  assert.equal(big.find(r => r.id === 'footprint').state, 'fail');
  assert.equal(big.find(r => r.id === 'budget').state, 'warn');
  // glb 가 아닌 파일
  assert.throws(() => glbInfo(new Uint8Array(32)), /glb/);
  assert.deepEqual(infoOf({}).materials, []);
});

test('편집기 페이지: 저장소·명령·검사 모듈·주소 끝이 노트와 맞다', () => {
  const page = read('res-editor.html'), note = read('docs/notes/p36-res-editor.md');
  assert.ok(page.startsWith('<!doctype html>'), '완전한 문서 (게시 때 따로 감싸지 않는다)');
  assert.ok(page.includes("from './tools/res-contracts.mjs'"), '같은 검사 모듈을 브라우저에서');
  assert.ok(page.includes("requests: 'res-requests'") && page.includes("refs: 'res-refs'"), '요청 저장소 이름');
  assert.ok(page.includes('리소스 요청 확인') && note.includes('"리소스 요청 확인"'), '채팅 명령');
  for (const k of ['edit', 'swap', 'add', 'rollback', 'approve', 'reopen']) {
    assert.ok(page.includes(`${k}:`), `KIND_LABEL ${k}`);
    assert.ok(note.includes(`\`${k}\``), `노트에 kind ${k}`);
  }
  for (const k of ['blender', 'local', 'file']) assert.ok(note.includes(`\`${k}\``), `노트에 method ${k}`);
  assert.ok(!/\bid: row\?\.id/.test(page), '요청 문서에 id 칸을 쓰지 않는다 (저장소 문서 id 와 겹침) — 요소 ID 는 ref');
  // 주소 끝 #… = 예전 편집기와 같은 규칙 (홈 전체 관리 링크를 옮길 때 그대로)
  const b = read('tools/build-editor-index.mjs');
  for (const k of ['key: m => "furn-" + m.slug', 'key: m => "item-" + m.slug', 'key: m => "fix-" + m.slug']) assert.ok(b.includes(k), k);
  assert.ok(b.includes('{ as: "tools/res-contracts.mjs", path: "tools/res-contracts.mjs" }'), '게시 파일에 검사 모듈');
  for (const k of ['applied/res', 'history/res-v', 'res-requests', 'res-refs', 'newline']) assert.ok(note.includes(k), `노트에 ${k}`);
});

test('편집기 홈: 리소스 편집기 줄이 있고, 예전 캐릭터·배경 편집기는 지우지 않고 archive 로', () => {
  const home = read('editors.html');
  const LIST = JSON.parse(home.match(/<script type="application\/json" id="editors-list">([\s\S]*?)<\/script>/)[1]);
  const by = Object.fromEntries(LIST.map(e => [e.id, e]));
  assert.equal(by.res?.group, 'editor');
  assert.equal(by.res.command, '리소스 요청 확인');
  assert.equal(by.res.file, 'res-editor.html');
  assert.deepEqual(by.res.reads, ["res-requests: status == 'new'"]);
  assert.equal(by.character.group, 'archive');
  assert.equal(by.env.group, 'archive');
  assert.ok(read('docs/notes/p36-res-editor.md').includes(by.res.url), '노트에 게시 링크');
});
