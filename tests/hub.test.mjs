// 편집기 홈 약속 검사 (M6-P1 · ET-01 · ET-11): editors.html 의 목록(editors-list) 이 문서의 링크·명령과 맞고,
// board-kit.js 의 반영 기록 공용 도구(window.ApplyLog) 가 보드 없이도 실린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = p => readFileSync(resolve(root, p), 'utf8');
const home = read('editors.html');
const LIST = JSON.parse(home.match(/<script type="application\/json" id="editors-list">([\s\S]*?)<\/script>/)[1]);
const byId = Object.fromEntries(LIST.map(e => [e.id, e]));
const GROUPS = ['editor', 'board', 'game', 'soon', 'archive'];
// 채팅 명령 → 그 명령을 설명하는 문서 (CLAUDE.md 편집기 절 · concept/README.md · 각 트랙 노트)
const COMMANDS = ['요청 확인', '배경 요청 확인', '시나리오 반영', '검수 보드 반영', '소리 반영', '지도 반영', '숫자 반영', '스타일 반영'];

test('홈 목록: id 가 겹치지 않고 링크·명령·읽을 곳 모양이 맞다', () => {
  assert.equal(new Set(LIST.map(e => e.id)).size, LIST.length, 'id 겹침');
  for (const e of LIST) {
    assert.match(e.id, /^[a-z0-9-]+$/, `${e.id}: id 는 #링크·status/<id> 문서 이름으로 쓰니 영문 소문자·숫자·- 만`);
    assert.ok(GROUPS.includes(e.group), `${e.id}: group`);
    assert.ok(e.name && e.edits && e.file, `${e.id}: name·edits·file`);
    if (e.url !== null) assert.match(e.url, /^https:\/\/claude\.ai\/artifact\/[\w-]+$/, `${e.id}: url`);
    if (e.command !== null) assert.ok(COMMANDS.includes(e.command), `${e.id}: 모르는 명령 "${e.command}"`);
    assert.ok(Array.isArray(e.reads), `${e.id}: reads`);
    // 링크가 있는 편집기·보드는 "전체 요청 확인" 때 읽을 곳이 있어야 한다
    if (e.url && e.command) assert.ok(e.reads.length, `${e.id}: 링크와 명령이 있으면 reads 도 적는다`);
    if (e.group === 'soon') assert.ok(e.et && e.track, `${e.id}: 새 편집기 자리는 ET·트랙을 적는다`);
  }
});

test('홈 링크 = 문서 링크 (CLAUDE.md · concept/README.md · 시나리오 노트)', () => {
  const claude = read('CLAUDE.md'), readme = read('concept/README.md');
  for (const id of ['character', 'env', 'game']) assert.ok(claude.includes(byId[id].url), `${id} 링크가 CLAUDE.md 와 다르다`);
  for (const id of ['wave5', 'z5', 'wave6', 'concept']) {
    const row = readme.split('\n').find(l => l.includes(byId[id].file.replace('concept/', '`')));
    assert.ok(row?.includes(byId[id].url), `${id} 링크가 concept/README.md 보드 표와 다르다`);
  }
  assert.ok(read('docs/notes/story.md').split('\n')[0].includes(byId.story.url), 'story 링크가 docs/notes/story.md 첫 줄과 다르다');
  // 보드 id = 보드 페이지의 window.BOARD.id = reads 의 boards/<id>
  for (const e of LIST.filter(x => x.group === 'board')) {
    assert.ok(read(e.file).includes(`id: '${e.id}'`), `${e.file} 의 window.BOARD.id 가 ${e.id} 가 아니다`);
    assert.deepEqual(e.reads, [`boards/${e.id}`, `applied/${e.id}`]);
  }
});

test('"전체 요청 확인" 순서와 status 모양이 문서에 있다', () => {
  const claude = read('CLAUDE.md'), readme = read('concept/README.md');
  for (const doc of [claude, readme]) assert.ok(doc.includes('전체 요청 확인'), '"전체 요청 확인" 설명');
  for (const key of ['status/<', 'meta/check', 'openItems', 'checkedAt', 'changed']) assert.ok(readme.includes(key), `README 에 ${key}`);
  assert.ok(home.includes('src="concept/board-kit.js"'), '홈은 concept/board-kit.js 로 반영 기록 공용 도구를 쓴다 (게시할 때 files 키도 이 경로)');
});

test('board-kit.js: window.BOARD 가 없어도 ApplyLog 가 실리고, 기록 목록을 새 것부터 그린다', () => {
  const window = {};
  const document = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] };
  vm.runInNewContext(read('concept/board-kit.js'), { window, document });
  const L = window.ApplyLog;
  assert.ok(L, 'window.ApplyLog');
  assert.equal(L.list([]), '');
  assert.equal(L.list(undefined), '');
  assert.match(L.head(null), /아직 반영 기록이 없어요/);
  const rows = L.sort([{ version: 1, summary: 'a' }, { version: 3, summary: '<b>' }, { version: 2, summary: 'c' }]);
  assert.deepEqual(Array.from(rows, r => r.version), [3, 2, 1]);   // vm 안 배열이라 Array.from 으로 이쪽 배열로
  const html = L.list(rows, { action: h => `<i data-v="${h.version}"></i>` });
  assert.ok(html.indexOf('v3') < html.indexOf('v1'), '새 것부터');
  assert.ok(html.includes('&lt;b&gt;') && !html.includes('<b><'), '요약 글은 escape');
  assert.equal((html.match(/data-v=/g) ?? []).length, 3);
  assert.match(L.head({ version: 2, appliedAt: 0, summary: 'x' }, { label: '게임에 들어간 시나리오' }), /게임에 들어간 시나리오 v2/);
});
