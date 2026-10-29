// 스타일 값 (M6-P6): assets/style/presets.json 이 조절 값 표(PARAMS)와 맞는지, 스타일 편집기 게시 파일 목록이 빠짐없는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { PARAMS, STYLE_FILE, checkStyle } from '../src/render/presets.js';
import { planWeb, scanModule } from '../tools/build-web.mjs';

const ROOT = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), 'utf8');
const style = JSON.parse(read(STYLE_FILE));

test('스타일: presets.json 이 PARAMS 표와 맞다 (모든 값·범위·집 안 덧씌우기)', () => {
  assert.deepEqual(checkStyle(style), []);
  // 섬폰 설정 '화면 모습' 버튼이 이 두 이름을 쓴다 (src/ui/phone.js)
  assert.ok(style.presets.cozy && style.presets.toon, 'cozy · toon 프리셋');
  assert.equal(new Set(PARAMS.map(p => p.key)).size, PARAMS.length, 'PARAMS 키가 겹치지 않는다');
});

test('스타일: 검사가 틀린 값을 잡는다', () => {
  const bad = structuredClone(style);
  bad.presets.cozy.bands = 2.5;
  bad.presets.cozy.outline = 'thick';
  bad.presets.cozy.shadeTint = 'purple';
  bad.presets.cozy.bloom = 9;
  delete bad.presets.toon.fxaa;
  bad.presets.toon.foo = 1;
  bad.indoor.nope = { ao: 0.2 };
  bad.default = 'nope';
  const out = checkStyle(bad).join('\n');
  for (const s of ['cozy.bands', 'cozy.outline', 'cozy.shadeTint', 'cozy.bloom', 'toon.fxaa', 'toon.foo', 'indoor.nope', "default 'nope'"]) assert.ok(out.includes(s), `못 잡음: ${s}`);
});

test('스타일: 게임 웹 빌드에 presets.json 이 들어간다', () => {
  assert.ok(planWeb().files.some(f => f.path === STYLE_FILE));
});

test('스타일 편집기: 게시 파일 목록이 편집기가 읽는 모듈·모델을 모두 담는다', () => {
  const list = JSON.parse(read('assets/style/editor-files.json'));
  const html = read(list.page);
  const need = new Set([STYLE_FILE]);
  // 모듈: 페이지 스크립트에서 닿는 것 (진짜 섬 보기 ./src/main.js 는 로컬 dev-server 전용이라 뺀다)
  const script = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const queue = [...scanModule(script).imports].filter(s => s.startsWith('./') && s !== './src/main.js').map(s => posix.normalize(s));
  while (queue.length) {
    const f = queue.shift();
    if (need.has(f)) continue;
    need.add(f);
    for (const s of scanModule(read(f)).imports) if (/^\.{1,2}\//.test(s)) queue.push(posix.normalize(posix.join(posix.dirname(f), s)));
  }
  // 무대 모델 (STAGE 표): 캐릭터는 모델 + 스펙(플레이어는 스펙 없이), 배경은 모델 + 스펙
  const stage = html.match(/const STAGE = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  const slugs = key => [...(stage.match(new RegExp(`${key}: (\\[.*?\\]\\])`))?.[1] ?? '').matchAll(/\['([\w-]+)'/g)].map(m => m[1]);
  const actors = slugs('actors'), props = slugs('props');
  assert.ok(actors.length && props.length, 'STAGE 표를 읽었다');
  for (const s of actors) { need.add(`assets/models/${s}.glb.json`); if (s !== 'player') need.add(`assets/specs/${s}.json`); }
  for (const s of props) need.add(`assets/env/models/${s}.glb.json`).add(`assets/env/specs/${s}.json`);
  for (const f of need) assert.ok(list.files.includes(f), `목록에 없음: ${f}`);
  for (const f of list.files) assert.ok(existsSync(new URL(f, ROOT)), `없는 파일: ${f}`);
  assert.ok(!list.files.includes(list.page) && list.files.length <= 60, '게시 파일은 적게 (페이지 빼고 60개 이하)');
});
