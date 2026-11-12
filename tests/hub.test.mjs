// 편집기 홈 약속 검사 (M6-P1 · ET-01 · ET-11 · 전체 관리): editors.html 의 목록(editors-list) 이 문서의 링크·명령과 맞고,
// board-kit.js 의 반영 기록 공용 도구(window.ApplyLog) 가 보드 없이도 실리고, 게시본에서 실패해도 화면이 비지 않고,
// 전체 관리 표(tools/hub-catalog.mjs 목록 + 홈 계산 hub-logic)가 저장소 파일·편집기 주소와 맞는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = p => readFileSync(resolve(root, p), 'utf8');
const home = read('editors.html');
const LIST = JSON.parse(home.match(/<script type="application\/json" id="editors-list">([\s\S]*?)<\/script>/)[1]);
const byId = Object.fromEntries(LIST.map(e => [e.id, e]));
const GROUPS = ['editor', 'board', 'game', 'soon', 'archive'];
// 채팅 명령 → 그 명령을 설명하는 문서 (CLAUDE.md 편집기 절 · concept/README.md · 각 트랙 노트)
const COMMANDS = ['전체 요청 확인', '요청 확인', '배경 요청 확인', '리소스 요청 확인', '시나리오 반영', '스토리 반영', '검수 보드 반영', '소리 반영', '지도 반영', '숫자 반영', '요소 반영', '스타일 반영'];

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
  // 편집기 (새 셋 res·story·elem + 곡·스타일) · 예전 편집기 (concept/ 밖 archive) · 게임 링크는 CLAUDE.md 에 그대로 적혀 있어야 한다
  for (const e of LIST.filter(x => x.url && (x.group === 'editor' || x.group === 'game' || (x.group === 'archive' && !x.file.startsWith('concept/')))))
    assert.ok(claude.includes(e.url), `${e.id} 링크가 CLAUDE.md 와 다르다`);
  for (const id of ['res', 'story', 'elem']) assert.ok(readme.includes(byId[id].url), `${id} 링크가 concept/README.md 에 없다`);
  // 보드 링크 = README 보드 표 줄, 보드 id = 보드 페이지의 window.BOARD.id = reads 의 boards/<id>.
  // 다른 브랜치에서 막 생긴 보드는 합치기 전엔 이 작업 트리에 파일·README 줄이 없다 → 여기 적은 것만 기다려 주고, 파일이 생기면 같은 검사를 받는다.
  const PENDING_BOARDS = {};
  // 예전 편집기(archive 인데 concept/ 밖, p36)는 보드 표 대신 CLAUDE.md 링크로 본다 (아래 character·env)
  for (const e of LIST.filter(x => x.group === 'board' || (x.group === 'archive' && x.file.startsWith('concept/')))) {
    if (!existsSync(resolve(root, e.file))) {
      assert.ok(PENDING_BOARDS[e.id], `${e.id}: ${e.file} 가 없다 (다른 브랜치에서 오는 보드면 PENDING_BOARDS 에)`);
      continue;
    }
    const row = readme.split('\n').find(l => l.includes(e.file.replace('concept/', '`')));
    assert.ok(row?.includes(e.url), `${e.id} 링크가 concept/README.md 보드 표와 다르다`);
    if (e.group !== 'board') continue;
    assert.ok(read(e.file).includes(`id: '${e.id}'`), `${e.file} 의 window.BOARD.id 가 ${e.id} 가 아니다`);
    assert.deepEqual(e.reads, [`boards/${e.id}`, `applied/${e.id}`]);
  }
  assert.ok(read('docs/notes/story.md').split('\n')[0].includes(byId.story.url), 'story 링크가 docs/notes/story.md 첫 줄과 다르다');
});

test('깨진 링크 없음: 문서·홈·노트의 claude.ai 아티팩트 링크는 모두 홈 목록(또는 홈 자신)의 링크', () => {
  const HOME = 'https://claude.ai/artifact/8HRgTYch2hkp3fcVv4wZVv';
  const known = new Set([HOME, ...LIST.map(e => e.url).filter(Boolean)]);
  const docs = ['CLAUDE.md', 'concept/README.md', 'devlog.md', 'docs/PLAN.md', 'editors.html',
    ...readdirSync(resolve(root, 'docs/notes')).filter(f => f.endsWith('.md')).map(f => `docs/notes/${f}`)];
  const bad = [];
  for (const d of docs) for (const m of read(d).matchAll(/https:\/\/claude\.ai\/(?:code\/)?artifact\/([\w-]+)/g))
    if (!known.has(`https://claude.ai/artifact/${m[1]}`)) bad.push(`${d}: ${m[0]}`);
  assert.deepEqual(bad, [], '홈 목록에 없는 링크 (새 편집기·보드면 editors.html 목록과 바로 가기에 더한다)');
  // 문서가 부르는 채팅 명령은 홈 명령 표에도 있다
  for (const c of ['리소스 요청 확인', '스토리 반영', '요소 반영']) {
    assert.ok(home.includes(`<code>"${c}"</code>`), `홈 명령 표에 "${c}"`);
    for (const d of ['CLAUDE.md', 'concept/README.md']) assert.ok(read(d).includes(c), `${d} 에 "${c}"`);
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
  const urls = new Set(LIST.flatMap(e => (e.url ? [e.url, ...(e.links ?? []).map(l => `${e.url}#${l.hash}`)] : [])));
  assert.deepEqual([...hrefs].sort(), [...urls].sort(), '바로 가기(nav.quick) 링크 = editors-list 의 url 전부 (+ links 의 #…)');
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
  assert.equal(docs.furniture.count, files('assets/furniture/specs').length + files('assets/furniture/fixtures/specs').length, '가구 + 상점·박물관 붙박이');
  assert.ok(docs.furniture.items.filter(i => i.id.startsWith('fix-')).every(i => i.link?.endsWith(`#${i.id}`)), '붙박이는 리소스 편집기 #fix-<slug>');
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
  if (existsSync(resolve(root, 'concept/wave7-board.html'))) for (let n = 36; n <= 48; n++) assert.ok(docs.decision.items.some(d => d.id === `D${n}`), `보드 결정 D${n} (wave7)`);
  assert.deepEqual(Object.keys(docs), GROUPS.map(g => g.id));
  assert.equal(meta.total, Object.values(docs).reduce((n, d) => n + d.count, 0));

  const H = loadLogic();
  const res = read('res-editor.html'), story = read('story-editor.html'), elemSheets = read('elem-editor/sheets.js');
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
      // 리소스 편집기: 키 = 영역 앞글자 + slug (res-editor.html keyOf — 가구 furn- · 붙박이 fix- · 아이템 item- · 캐릭터·배경·무늬는 slug 그대로)
      if (d.editor === 'res') {
        const pre = { furniture: it.id.startsWith('fix-') ? '' : 'furn-', item: 'item-' }[d.group] ?? '';
        assert.ok(hash === pre + it.id && res.includes("furniture: 'furn-', fixture: 'fix-', item: 'item-'"), `${d.group}/${it.id}: 리소스 편집기 #${hash}`);
      }
      // 스토리 편집기: #<탭> (story-editor.html TABS — claude.ai 는 #a/b 를 넘기지 않아 탭까지만)
      if (d.editor === 'story') assert.ok(hash === 'villager' && story.includes("const TABS = ['scenes', 'villager',"), `스토리 편집기 #${hash}`);
      // 요소 편집기: #<표 id> (elem-editor/sheets.js) 또는 방 배치 #rooms.<방·가게 slug>
      if (d.editor === 'elem') assert.ok(/^rooms\.[\w-]+$/.test(hash) ? existsSync(resolve(root, `assets/interior/rooms/${hash.slice(6)}.json`)) || existsSync(resolve(root, `assets/interior/places/${hash.slice(6)}.json`)) : elemSheets.includes(`{ id: '${hash}', name:`), `요소 편집기 #${hash}`);
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


/* ---------- 게임 저장소 (문제 알리기 reports · 기기 점검 checks) → 홈 status/game ---------- */
test('홈 목록 game: 게임 저장소 reports·checks 를 읽고, 기기 점검 링크(#check)가 게임이 켜는 주소와 같다', async () => {
  const g = byId.game;
  assert.deepEqual(g.reads, ['reports', 'checks']);
  assert.equal(g.openLabel, '새 문제');
  assert.equal(g.command, '전체 요청 확인', '게임 문제는 "전체 요청 확인" 때 처리');
  const { checkRequested, CHECK_STORE } = await import('../src/render/check.js');
  assert.equal(CHECK_STORE.collection, g.reads[1], '기기 점검 컬렉션');
  assert.ok(read('src/ui/report.js').includes('db.doc(`reports/${id}`)'), '문제 알리기는 reports/<id> 에 쓴다');
  // 8차 D85-A: 행사 미리 해 보기 링크 #date=… 는 게임이 그 날짜로 연다 (기기 점검 링크는 그대로 기기 점검)
  const { urlDate } = await import('../src/core/preview.js');
  const { CASES } = await import('../tools/check-events.mjs');
  for (const l of g.links) {
    assert.match(l.hash, /^[\w.~=&-]+$/);
    if (l.hash.startsWith('date=')) {
      assert.ok(urlDate({ hash: `#${l.hash}` }), `게임이 #${l.hash} 를 날짜로 읽는다`);
      assert.ok(!checkRequested({ hash: `#${l.hash}` }), `#${l.hash} 는 기기 점검이 아니다`);
      assert.ok(CASES.some(c => `date=${c.date}` === l.hash), `${l.hash} 는 행사 점검 도구(tools/check-events.mjs)와 같은 날짜`);
    } else assert.ok(checkRequested({ hash: `#${l.hash}` }), `게임이 #${l.hash} 로 기기 점검을 켠다`);
  }
  assert.equal(g.links.filter(l => l.hash.startsWith('date=')).length, 4, '행사 넷');
});

test('게임 카드 요약 (HubLogic.game · tools/hub-game.mjs): 게임이 쓰는 문서 모양 그대로 → 새 문제 수·최근 점검', async () => {
  const H = loadLogic();
  const { REPORT_KINDS } = await import('../src/ui/report.js');
  const { buildRecord } = await import('../src/render/check.js');
  const { ROUTE, readRows, gameStatus } = await import('../tools/hub-game.mjs');
  assert.deepEqual(plain(H.REPORT_KINDS), Object.fromEntries(REPORT_KINDS), '문제 종류·이름 = 게임 문제 알리기 창');
  assert.deepEqual(Object.keys(ROUTE).sort(), REPORT_KINDS.map(([k]) => k).sort(), 'D47 처리 길이 종류마다 있다');

  const reports = [
    { id: 'r20261031-100000-aaaa', status: 'new', kind: 'stuck', text: '  다리 앞에서\n  못 가요 ' + '가'.repeat(60), createdAt: 100 },
    { id: 'r20261031-110000-bbbb', status: 'new', kind: 'look', text: '', createdAt: 200 },
    { id: 'r20261030-090000-cccc', status: 'done', kind: 'error', createdAt: 50, reply: '고쳤어요', commit: 'abc1234' },
    { id: 'r20261030-080000-dddd', status: 'board', kind: 'other', createdAt: 40, qa: 'QA-20' },
  ];
  const device = { gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', screen: { w: 1170, h: 2532, vw: 390, vh: 844, dpr: 3 }, touch: true };
  const rec = (gap, at) => buildRecord({ spots: [{ id: 'plaza', label: '광장' }], samples: { plaza: { gaps: Array(90).fill(gap) } }, device,
    quality: { start: 'high', end: gap > 33 ? 'low' : 'high' }, startedAt: at, ms: 28000, build: 'b1', where: 'claude' });
  const checks = [{ id: 'c1', ...rec(41, '2026-10-31T03:00:00.000Z') }, { id: 'c2', ...rec(16, '2026-10-31T04:00:00.000Z') }, { id: 'x', kind: 'something-else' }];

  const g = plain(H.game(reports, checks));
  assert.equal(g.open, 2, 'status new 만 센다');
  assert.deepEqual(g.openItems.map(i => i.id), ['r20261031-110000-bbbb', 'r20261031-100000-aaaa'], '새 것부터');
  assert.equal(g.openItems[1].text.length, 40, '글은 40자 (빈칸 줄임)');
  assert.ok(g.openItems[1].text.startsWith('다리 앞에서 못 가요'));
  assert.deepEqual(Object.keys(g.openItems[0]).sort(), ['createdAt', 'id', 'kind', 'text']);
  assert.deepEqual(g.reports, { total: 4, new: 2, working: 0, done: 1, board: 1, dup: 0 });
  assert.equal(g.checks.total, 2, '기기 점검 문서만');
  assert.equal(g.checks.slow, 1, '광장 평균 33ms 넘은 점검');
  assert.deepEqual(g.checks.recent.map(c => c.id), ['c2', 'c1']);
  assert.deepEqual(g.checks.recent[1], { id: 'c1', at: Date.parse('2026-10-31T03:00:00.000Z'), where: 'claude', build: 'b1', gpu: 'Intel(R) UHD Graphics 620', touch: true,
    screen: '390×844 ×3', quality: { start: 'high', end: 'low', fixed: false }, plaza: { avg: 41, p95: 41, goal: 33, ok: false }, errors: 0 });
  assert.equal(H.gpuName('ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'), 'Apple M1');
  assert.equal(H.gpuName('Mali-G78'), 'Mali-G78');
  assert.equal(H.gpuName(null), null);
  assert.deepEqual(plain(H.game()), { open: 0, openItems: [], reports: { total: 0, new: 0, working: 0, done: 0, board: 0, dup: 0 }, checks: { total: 0, slow: 0, recent: [] } });
  const many = Array.from({ length: 300 }, (_, i) => ({ id: `r${i}`, status: 'new', kind: 'other', text: 'x'.repeat(1000), createdAt: i }));
  const big = plain(H.game(many, Array.from({ length: 300 }, (_, i) => ({ id: `c${i}`, ...rec(20, new Date(i * 1000).toISOString()) }))));
  assert.equal(big.open, 300);
  assert.equal(big.openItems.length, 5);
  assert.equal(big.checks.recent.length, 5);
  assert.ok(Buffer.byteLength(JSON.stringify(big)) < 8 * 1024, 'status/game 은 작게 (최근 5개씩)');

  // 도구: ArtifactData out_dir 폴더(<id>.json) 와 dev-server 행 배열(docId) 을 같게 읽는다
  const dir = mkdtempSync(join(tmpdir(), 'hub-game-'));
  try {
    mkdirSync(join(dir, 'reports'));
    for (const { id, ...d } of reports) writeFileSync(join(dir, 'reports', `${id}.json`), JSON.stringify(d));
    writeFileSync(join(dir, 'game-reports.json'), JSON.stringify(reports.map(({ id, ...d }) => ({ ...d, docId: id, id: 'auto' + id.slice(-4) }))));
    const a = readRows(dir, 'reports'), b = readRows(join(dir, 'game-reports.json'), 'reports');
    assert.deepEqual(a.map(r => r.id).sort(), reports.map(r => r.id).sort(), 'out_dir 폴더: 문서 id = 파일 이름 (부모 폴더를 줘도 reports/ 를 찾는다)');
    assert.deepEqual(b.map(r => r.id).sort(), reports.map(r => r.id).sort(), '행 배열: docId 가 문서 id');
    assert.deepEqual(readRows(join(dir, 'none'), 'checks'), []);
    const st = gameStatus({ reports: a, checks, now: 7 });
    assert.equal(st.checkedAt, 7);
    assert.equal(st.updatedBy, 'claude');
    assert.deepEqual({ ...st, checkedAt: 0, updatedAt: 0, updatedBy: 0 }, { ...plain(H.game(reports, checks)), checkedAt: 0, updatedAt: 0, updatedBy: 0 });
    assert.ok(!('published' in st) && !('note' in st), 'update 칸만 (게시 버전·글은 그대로)');
  } finally { rmSync(dir, { recursive: true, force: true }); }

  // 홈: 로컬 dev-server 는 게임 흉내 파일을 바로 읽고, 카드가 새 문제 줄을 사람 말로 그린다
  assert.ok(home.includes("'game-reports', 'checks'") && home.includes('H.game('), '로컬 흉내: api/db/game-reports · api/db/checks');
  assert.ok(home.includes('function todoText') && home.includes('H.REPORT_KINDS'), 'openItems 의 { kind, text } 를 글로');
});

test('게임 저장소 처리 순서가 문서에 있다 (D47: 고침 → done, 보드로 → board)', () => {
  const claude = read('CLAUDE.md'), readme = read('concept/README.md'), note = read('docs/notes/hub-manage.md');
  for (const [name, doc] of [['CLAUDE.md', claude], ['README', readme]]) for (const k of ['reports', 'checks', 'hub-game.mjs', 'status/game', "'board'", 'D47']) assert.ok(doc.includes(k), `${name} 에 ${k}`);
  for (const k of ['assets/review/game-reports.json', 'assets/review/checks.json', 'hub-game.mjs']) assert.ok(note.includes(k), `hub-manage 노트에 ${k}`);
});

/* ---------- 검수 보드 보관함 (archive-index → 홈 저장소 archive/<n차 id>, docs/notes/board-archive.md) ---------- */
const AINDEX = JSON.parse(home.match(/<script type="application\/json" id="archive-index">([\s\S]*?)<\/script>/)[1]);
const dRange = s => { const m = /^D(\d+)–D(\d+)$/.exec(s); return m ? [+m[1], +m[2]] : null; };

test('보관함 차례: 모든 보드가 한 번씩, 결정 번호 순서 = n차 순서, id = <두 자리 차수>-<보드 id>', () => {
  const boards = LIST.filter(e => e.group === 'board' || (e.group === 'archive' && e.file.startsWith('concept/'))).map(e => e.id).sort();
  assert.deepEqual(AINDEX.map(a => a.board).sort(), boards, '홈 목록의 보드(지난 보드 포함) = 보관함 차례 (새 보드는 차례 끝에 한 줄)');
  assert.deepEqual(AINDEX.map(a => a.seq), AINDEX.map((_, i) => i + 1), 'seq 는 1부터 빈틈없이 줄 순서대로');
  const readme = read('concept/README.md');
  const dRow = readme.split('\n').find(l => l.startsWith('| D | 결정 |'));
  const span = {};   // README ID 표 D 줄: 'D36–D48 (wave7) · D49–D57 (wave7 QA 결과)' → 보드마다 [처음, 끝]
  for (const m of dRow.matchAll(/D(\d+)–D(\d+) \(([\w.]+)/g)) {
    const id = m[3] === 'v0.1' ? 'concept' : m[3];
    span[id] = [Math.min(span[id]?.[0] ?? Infinity, +m[1]), Math.max(span[id]?.[1] ?? 0, +m[2])];
  }
  let lastD = 0, lastCha = 0;
  for (const a of AINDEX) {
    assert.match(a.id, /^\d{2}-[a-z0-9-]+$/);
    assert.equal(a.id, `${String(a.cha).padStart(2, '0')}-${a.board}`, `${a.id}: id = 차수 두 자리 + 보드 id`);
    assert.ok(['concept', 'main', 'theme'].includes(a.kind), `${a.id}: kind`);
    assert.ok(a.label.startsWith(`${a.cha}차`), `${a.id}: 이름은 「${a.cha}차」로 시작`);
    if (a.kind === 'theme') assert.ok(a.label.includes(' · '), `${a.id}: 주제 보드는 「n차 · 주제」`);
    assert.match(a.made, /^\d{4}-\d{2}-\d{2}$/);
    const r = dRange(a.decisions);
    assert.ok(r, `${a.id}: 결정 범위 'Dn–Dm'`);
    assert.deepEqual(r, span[a.board], `${a.id}: 결정 범위가 concept/README.md ID 표 D 줄과 같다`);
    assert.ok(r[0] > lastD, `${a.id}: 결정 번호 순서대로`);
    assert.ok(a.cha >= lastCha, `${a.id}: 차수는 줄어들지 않는다`);
    if (a.kind === 'theme') assert.equal(a.cha, lastCha, `${a.id}: 주제 보드는 바로 앞 본 보드의 차수에 붙는다`);
    lastD = r[1]; lastCha = a.cha;
    const file = byId[a.board].file;
    if (a.kind !== 'concept') assert.ok(read(file).includes(`id: '${a.board}'`), `${file} 는 저장소가 있는 보드 (window.BOARD)`);
    else assert.ok(a.fallback?.from && a.fallback.summary && Object.keys(a.fallback.picks).length === r[1] - r[0] + 1, `${a.id}: 저장 없는 보드는 문서 기록(fallback)으로 결정 전부`);
  }
  // 13차는 wave13 (보드 이름 「13차 검수 보드」와 같은 번호)
  for (const a of AINDEX.filter(x => /^wave\d+$/.test(x.board))) assert.equal(a.cha, +a.board.slice(4), `${a.board} = ${a.board.slice(4)}차`);
});

test('보관함 계산 (HubLogic.archiveDoc · archiveRows · tools/hub-archive.mjs): 보드 저장소 기록 → archive 문서 → 화면 줄', async () => {
  const H = loadLogic();
  assert.equal(H.pickSummary({ D8: 'B', D9: 'A', D10: 'A', D13: 'CH10' }), 'D8-B · D13-CH10 · 나머지 A (4개)');
  assert.equal(H.pickSummary({ D58: 'A', D59: 'A' }), '모두 A (2개)');
  assert.equal(H.pickSummary({ D130: 'B', 'D130-spec': 'all', D131: 'A', D132: 'A' }), 'D130-B · 나머지 A (3개 · 사양 고르기 1)');
  assert.equal(H.pickSummary(null), '');
  const en = AINDEX.find(a => a.board === 'wave7');
  const v1 = { board: 'wave7', version: 1, appliedAt: 10, summary: '첫 반영', commit: 'aaaaaaa', picks: { D36: 'A', D37: 'B' }, notes: { D41: '임시' } };
  const v2 = { ...v1, version: 2, appliedAt: '2026-11-04T00:00:00Z', summary: '확정', commit: 'bbbbbbb', picks: { D36: 'A', D37: 'B', D49: 'A' } };
  const doc = plain(H.archiveDoc(en, byId.wave7, { applied: { ...v2, commit: undefined }, history: [v1, v2] }, 5));
  assert.equal(doc.id, '07-wave7');
  assert.equal(doc.source, 'store');
  assert.deepEqual(doc.applied, { version: 2, appliedAt: Date.parse('2026-11-04T00:00:00Z'), summary: '확정', commit: 'bbbbbbb' }, 'applied 에 commit 이 없으면 같은 버전 history 의 commit');
  assert.deepEqual(doc.history.map(h => h.version), [2, 1], '기록은 새 것부터');
  assert.deepEqual(doc.commits, ['aaaaaaa', 'bbbbbbb'], '반영 커밋은 오래된 것부터');
  assert.equal(doc.picksSummary, 'D37-B · 나머지 A (3개)');
  assert.equal(doc.notesCount, 1);
  assert.equal(doc.url, byId.wave7.url);
  const concept = AINDEX.find(a => a.kind === 'concept');
  const cd = plain(H.archiveDoc(concept, byId.concept, null, 5));
  assert.equal(cd.source, 'docs');
  assert.equal(cd.picksFrom, 'recommended');
  assert.equal(cd.applied.version, 0);
  // 화면: 차례 순서, 저장소 문서가 있으면 그것, 차례에 없는 새 문서(15차)는 끝에
  const rows = plain(H.archiveRows(AINDEX, LIST, { '07-wave7': doc, '15-wave15': { seq: 17, cha: 15, label: '15차', board: 'wave15', name: '15차', history: [] } }));
  assert.equal(rows.length, AINDEX.length + 1);
  assert.deepEqual(rows.slice(0, AINDEX.length).map(r => r.id), AINDEX.map(a => a.id));
  assert.equal(rows.find(r => r.id === '07-wave7').stored, true);
  assert.equal(rows.find(r => r.id === '05-wave5').stored, false, '저장소 문서 없으면 차례만 (stored false)');
  assert.equal(rows.at(-1).id, '15-wave15');

  const { buildArchive } = await import('../tools/hub-archive.mjs');
  const boards = Object.fromEntries(AINDEX.filter(a => a.kind !== 'concept').map(a => [a.board, { applied: { ...v1, board: a.board }, history: [{ ...v1, board: a.board }] }]));
  const { docs, missing } = buildArchive({ boards, now: 1 });
  assert.deepEqual(Object.keys(docs), AINDEX.map(a => a.id));
  assert.deepEqual(missing, []);
  for (const d of Object.values(docs)) {
    assert.ok(Buffer.byteLength(JSON.stringify(d)) < 64 * 1024, `${d.id}: 문서 하나는 작게`);
    for (const k of ['id', 'seq', 'cha', 'label', 'board', 'name', 'url', 'made', 'decisions', 'source', 'applied', 'picks', 'picksSummary', 'history', 'commits', 'builtAt', 'by']) assert.ok(k in d, `${d.id}: ${k}`);
  }
  assert.equal(buildArchive({}).missing.length, AINDEX.length - 1, '기록을 안 주면 컨셉 보드(문서 기록) 밖은 모두 기록 없음');
});

test('보관함: 홈이 archive 를 구독하고 로컬은 hub-archive 를 읽으며, 규칙과 노트가 있다', () => {
  assert.ok(home.includes("db.collection('archive').onSnapshot"), '홈 저장소 archive 구독');
  assert.ok(home.includes("'hub-archive'"), '로컬 흉내 api/db/hub-archive');
  assert.ok(home.includes('id="archive-boards"') && home.includes('href="#archive-boards"'), '보관함 칸과 목차 링크');
  const note = read('docs/notes/board-archive.md');
  for (const k of ['archive/<', 'hub-archive.mjs', 'archive-index', '문서 세션이 반영할 문장', '"path":"archive"']) assert.ok(note.includes(k), `노트에 ${k}`);
});
