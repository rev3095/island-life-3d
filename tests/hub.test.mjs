// 편집기 홈 약속 검사 (M6-P1 · ET-01 · ET-11 · 전체 관리): editors.html 의 목록(editors-list) 이 문서의 링크·명령과 맞고,
// board-kit.js 의 반영 기록 공용 도구(window.ApplyLog) 가 보드 없이도 실리고, 게시본에서 실패해도 화면이 비지 않고,
// 전체 관리 표(tools/hub-catalog.mjs 목록 + 홈 계산 hub-logic)가 저장소 파일·편집기 주소와 맞는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

/* ---------- 열리게 (게시본에서 스크립트·파일이 실패해도 화면이 비지 않게) ---------- */
test('홈: 바로 가기 링크가 목록과 같고, 스크립트 없이도 보인다', () => {
  const quick = home.match(/<nav class="quick"[\s\S]*?<\/nav>/)?.[0] ?? '';
  const hrefs = new Set([...quick.matchAll(/href="([^"]+)"/g)].map(m => m[1]));
  const urls = new Set(LIST.map(e => e.url).filter(Boolean));
  assert.deepEqual([...hrefs].sort(), [...urls].sort(), '바로 가기(nav.quick) 링크 = editors-list 의 url 전부');
});

test('홈: 실패 상자를 맨 먼저 걸고, 외부 글꼴·파일에 화면이 막히지 않는다', () => {
  const firstScript = home.indexOf('<script>'), firstStyle = home.indexOf('<style>');
  assert.ok(firstScript > 0 && firstScript < firstStyle, '오류를 잡는 작은 스크립트가 <style> 보다 먼저');
  const boot = home.slice(firstScript, home.indexOf('</script>', firstScript));
  for (const k of ['hubFail', "addEventListener('error'", 'unhandledrejection', 'fonts.googleapis.com']) assert.ok(boot.includes(k), `맨 앞 스크립트에 ${k}`);
  assert.ok(home.includes('id="bootErr"') && home.includes('[hidden] { display: none !important; }'), '실패 상자 자리와 [hidden] 규칙');
  assert.ok(!/<link[^>]+rel="stylesheet"/.test(home), '글꼴 stylesheet 를 <link> 로 걸지 않는다 (늦으면 화면을 막는다) — 맨 앞 스크립트가 붙인다');
  assert.ok(!/<script[^>]+src="https?:/.test(home), '외부 스크립트 없음');
  assert.ok(home.includes('window.ApplyLog ||'), 'board-kit.js 를 못 받아도 그려지게 대신 도구');
  assert.ok(home.includes('window.hubReady = true') && home.includes('if (!window.hubReady'), '본 스크립트가 끝까지 못 돌면 알림');
  assert.ok(!home.includes('window.claude.db') && !home.includes('window.claude.user'), 'window.claude 는 use() 만 쓴다');
});

/* ---------- 전체 관리 ---------- */
const logicSrc = home.match(/<script id="hub-logic">([\s\S]*?)<\/script>/)[1];
const loadLogic = () => { const window = {}; vm.runInNewContext(logicSrc, { window }); return window.HubLogic; };
const plain = v => JSON.parse(JSON.stringify(v));   // vm 안 값 → 이쪽 값

test('전체 관리 계산: 목록 + 표시(marks) + 남긴 요청 → 줄, 거르기, 요청 문서', () => {
  const H = loadLogic();
  const catalog = {
    env: { label: '배경', editorName: '배경 편집기', how: 'spec', items: [
      { id: 'bench', ref: 'PR-02', name: '벤치', sub: '소품', state: 'approved', version: '0.1', link: 'https://claude.ai/artifact/LuEvzroBSW2RFhVWvm6tkh#bench' },
      { id: 'tree', ref: 'EN-01', name: '나무', state: 'review', version: '0.1', link: 'javascript:alert(1)' }] },
    sound: { label: '소리', how: 'value', items: [{ id: 'song-dawn', ref: 'BGM-01', name: '곡 · 새벽', state: 'approved', version: 1 }] },
  };
  const marks = { sound: { items: { 'song-dawn': { state: 'review', note: '다시 들어 볼게요' } } } };
  const manage = [
    { id: 'm1', kind: 'fix', status: 'new', items: [{ group: 'env', id: 'bench' }] },
    { id: 'm2', kind: 'reopen', status: 'done', items: [{ group: 'env', id: 'tree' }] },
  ];
  const rows = plain(H.rows(catalog, marks, manage, { groups: [{ id: 'sound' }, { id: 'env' }] }));
  assert.deepEqual(rows.map(r => r.key), ['sound:song-dawn', 'env:bench', 'env:tree'], 'meta.groups 순서');
  assert.equal(rows[0].state, 'review', 'marks 가 값 데이터 상태를 덮는다');
  assert.equal(rows[1].pending.length, 1, '처리 전 요청만 걸린다');
  assert.equal(rows[2].pending.length, 0, '끝난 요청은 안 걸린다');
  assert.equal(rows[2].link, null, 'claude.ai 아티팩트 링크만');
  assert.equal(H.filter(rows, { state: 'review' }).length, 2);
  assert.equal(H.filter(rows, { state: 'pending' }).length, 1);
  assert.equal(H.filter(rows, { group: 'env', q: 'pr-02' }).length, 1, 'ID 로 찾기 (대소문자 무시)');
  assert.equal(plain(H.counts(rows)).all.review, 2);
  assert.match(H.request('fix', rows, '  ', 'u_x').error, /의견/, '고쳐 주세요에는 의견');
  assert.match(H.request('reopen', [], '').error, /골라/);
  assert.match(H.request('reopen', Array(H.MAX + 1).fill(rows[0]), '').error, /까지/);
  const { doc } = plain(H.request('reopen', rows.slice(1), ' 다시 볼게요 ', 'u_x', 5));
  assert.deepEqual(doc, { kind: 'reopen', note: '다시 볼게요', status: 'new', from: 'hub', createdAt: 5, by: 'u_x',
    items: [{ group: 'env', id: 'bench', ref: 'PR-02', name: '벤치', state: 'approved', version: '0.1' }, { group: 'env', id: 'tree', ref: 'EN-01', name: '나무', state: 'review', version: '0.1' }] });
  assert.ok(Buffer.byteLength(JSON.stringify(H.request('fix', Array(H.MAX).fill(rows[0]), 'x'.repeat(4000)).doc)) < 256 * 1024, '요청 문서는 256 KiB 안');
  assert.match(H.chatText('approve', rows.slice(1, 2), ''), /^전체 요청 확인 — 확정 1개: 벤치\(PR-02\)$/);
});

test('목록 도구(tools/hub-catalog.mjs): 저장소 파일 수와 같고, 링크는 그 편집기·그 요소로 간다', async () => {
  const { buildCatalog, GROUPS } = await import('../tools/hub-catalog.mjs');
  const boards = Object.fromEntries(LIST.filter(e => e.group === 'board').map(b => [b.id, { version: 1, picks: {} }]));
  boards.wave5.picks = { D8: 'B' };
  const { docs, meta } = buildCatalog({ boards, now: 1, commit: 'test' });
  const files = d => readdirSync(resolve(root, d)).filter(f => f.endsWith('.json'));
  const specCount = (d, f) => files(d).filter(n => f(JSON.parse(read(`${d}/${n}`)))).length;
  assert.equal(docs.character.count, files('assets/specs').length);
  assert.equal(docs.villager.count, specCount('assets/villagers', v => v.slug));
  assert.equal(docs.env.count, files('assets/env/specs').length);
  assert.equal(docs.furniture.count, files('assets/furniture/specs').length);
  assert.equal(docs.item.count, files('assets/items/specs').length);
  assert.equal(docs.item.icons, files('assets/items/specs').reduce((n, f) => n + (JSON.parse(read(`assets/items/specs/${f}`)).items?.length ?? 1), 0));
  assert.equal(docs.interior.count, specCount('assets/interior/specs', s => s.kind === 'wallpaper' || s.kind === 'floor'));
  assert.ok(docs.room.count >= files('assets/interior/rooms').length);
  assert.equal(docs.scene.count, files('assets/story/scenes').length);
  const lay = JSON.parse(read('assets/island/layout.json'));
  assert.equal(docs.map.count, Object.keys(lay).length - 2, '섬 지도: version·about 밖 칸 전부');
  assert.equal(docs.sound.count, JSON.parse(read('assets/sound/index.json')).songs.length + 1
    + Object.keys(JSON.parse(read('assets/sound/sfx.json')).sfx).length + Object.keys(JSON.parse(read('assets/sound/voices.json')).voices).length);
  assert.ok(docs.decision.items.some(d => d.id === 'D8' && d.pick === 'B' && d.state === 'approved'));
  assert.ok(docs.decision.items.some(d => d.id === 'D9' && d.pick === null && d.state === 'review'), '반영에 없는 결정은 검수 대기');
  for (let n = 8; n <= 35; n++) assert.ok(docs.decision.items.some(d => d.id === `D${n}`), `보드 결정 D${n}`);
  assert.deepEqual(Object.keys(docs), GROUPS.map(g => g.id));
  assert.equal(meta.total, Object.values(docs).reduce((n, d) => n + d.count, 0));

  const H = loadLogic();
  const bg = read('bg-editor.html'), ch = read('editor.html'), dataEd = read('data-editor.html');
  const soundTabs = read('sound-editor.html').match(/const TABS = \[([^\]]*)\]/)[1];
  for (const d of Object.values(docs)) {
    assert.ok(Buffer.byteLength(JSON.stringify(d)) < 200 * 1024, `${d.group}: 문서 하나는 256 KiB 안 (넉넉히 200)`);
    assert.equal(new Set(d.items.map(i => i.id)).size, d.items.length, `${d.group}: id 겹침`);
    const ed = d.editor ? byId[d.editor] : null;
    for (const it of d.items) {
      assert.ok(it.name && H.STATES[it.state], `${d.group}/${it.id}: 이름·상태`);
      assert.match(it.link, /^https:\/\/claude\.ai\/artifact\/[\w-]+(#[\w.~-]+)?$/, `${d.group}/${it.id}: 링크 (주소 끝 #… 는 글자·숫자·. _ ~ - 만 닿는다)`);
      if (ed) assert.ok(it.link.startsWith(ed.url), `${d.group}/${it.id}: ${ed.id} 편집기 링크`);
      const hash = it.link.split('#')[1];
      if (!hash) continue;
      // 그 편집기가 주소 끝 # 를 읽는 방식과 맞는지
      if (d.editor === 'env') assert.ok(d.group === 'furniture' ? hash === `furn-${it.id}` && bg.includes("'furn-' + m.slug")
        : d.group === 'item' ? hash === `item-${it.id}` && bg.includes("'item-' + m.slug") : hash === it.id, `${d.group}/${it.id}: 배경 편집기 #${hash}`);
      if (d.editor === 'character') assert.ok(hash === it.id || (hash === `${it.id}.talk` && ch.includes(".replace(/\\.talk$/, '')")), `캐릭터 편집기 #${hash}`);
      if (d.editor === 'data') assert.ok(dataEd.includes(`{ id: '${hash}', name:`), `숫자 표 #${hash}`);
      if (d.editor === 'sound') assert.ok(soundTabs.includes(`'${hash}'`), `곡 편집기 #${hash}`);
    }
  }
});

test('전체 관리 흐름이 문서에 있다 (확정해도 지우지 않고 언제든 다시 연다)', () => {
  const claude = read('CLAUDE.md'), readme = read('concept/README.md');
  for (const k of ['manage/', 'catalog/', 'marks/', "'reopen'", "'fix'", "'approve'", 'hub-catalog.mjs']) assert.ok(readme.includes(k), `README 에 ${k}`);
  for (const k of ['전체 관리', 'hub-catalog.mjs', 'manage']) assert.ok(claude.includes(k), `CLAUDE.md 에 ${k}`);
  assert.ok(/지우지 않/.test(readme) && /지우지 않/.test(claude), '확정해도 편집기·요소를 지우지 않는다는 규칙');
});
