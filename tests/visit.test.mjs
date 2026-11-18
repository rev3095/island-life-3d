// M21-P2 친구 섬 구경: 저장소 규칙 (남의 섬 덮어쓰기 거절) · 섬 코드 · 섬 사진 · 오늘의 섬
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/gameplay/visit/rules.js';

const doc = (user, code = 'ABC234') => R.islandDoc({ code, user, snap: { v: 1 }, dayKey: '2026-11-18' });

test('섬 사진 저장소 규칙: 자기 칸만 쓰고, 남의 섬은 덮어쓰기·지우기 거절', () => {
  // 내 칸에 내 섬 = 됨
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', existing: null, next: doc('me') }).ok, true);
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', existing: doc('me'), next: doc('me', 'XYZ789') }).ok, true);
  // 남의 칸에 쓰기 = 거절 (경로가 남의 id)
  assert.deepEqual(R.canWriteIsland({ docId: 'friend', uid: 'me', existing: doc('friend'), next: doc('me') }), { ok: false, why: 'not-own-path' });
  // 남의 user 를 단 채 덮어쓰기 = 거절
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', existing: doc('friend'), next: doc('me') }).why, 'not-owner');
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', existing: null, next: doc('friend') }).why, 'user-mismatch');
  // 남이 쓰는 코드 = 거절
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', next: doc('me'), codeOwner: 'friend' }).why, 'code-taken');
  // 지우기도 자기 것만
  assert.equal(R.canDeleteIsland({ docId: 'me', uid: 'me', existing: doc('me') }).ok, true);
  assert.equal(R.canDeleteIsland({ docId: 'friend', uid: 'me', existing: doc('friend') }).ok, false);
  // 로그인 안 함
  assert.equal(R.canWriteIsland({ docId: '', uid: '', next: doc('') }).why, 'no-user');
});

test('섬 코드 · 섬 사진 · 오늘의 섬', () => {
  let i = 0;
  const code = R.makeCode(() => (i++ * 0.137) % 1);
  assert.ok(R.isCode(code) && !/[01OIL]/.test(code));
  assert.equal(R.normalizeCode(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `), code);
  assert.equal(R.normalizeCode('ABC10O'), null);

  const state = {
    island: { name: '포근섬', seed: 7, added: [{ id: 'fence' }], built: [], removed: [] },
    player: { name: '나', outfit: { hat: 'straw-hat' } },
    house: { grow: { stage: 2 } }, inventory: [{ id: 'apple' }], wallet: { acorns: 999 },
    villagers: { coco: { friendship: 50, outfit: 'x' } },
  };
  const snap = R.snapshot(state, { residents: ['coco'] });
  assert.equal(snap.house.stage, 2);
  assert.deepEqual(snap.villagers, [{ slug: 'coco', outfit: 'x' }]);
  const text = JSON.stringify(snap);
  assert.ok(!text.includes('acorns') && !text.includes('apple') && !text.includes('friendship'));

  const list = ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD', 'EEEEEE'].map(c => ({ code: c, user: c }));
  const a = R.todayPicks(list, '2026-11-18', { mine: 'AAAAAA' });
  assert.equal(a.length, 3);
  assert.ok(!a.some(d => d.code === 'AAAAAA'));
  assert.deepEqual(R.todayPicks([...list].reverse(), '2026-11-18', { mine: 'AAAAAA' }), a);   // 순서와 상관없이 같은 셋
  assert.equal(R.findCode(list, 'cccccc')?.user, 'CCCCCC');
});

test('M21-P4 방명록·편지·선물 저장 규칙: 남의 글 덮어쓰기 · 남의 섬 숨기기 거절', () => {
  const note = (id, kind = 'stamp', extra = {}) => ({ id, to: 'ABC234', kind, line: kind === 'stamp' ? 'flower' : 'hello', day: '2026-11-18', at: 1, ...extra });
  const mine = R.addNote(null, { uid: 'me', from: { name: '나', island: '포근섬' }, note: note('n1') });
  // 내 칸(visits/me)에 내 글 = 됨
  assert.equal(R.canWriteVisit({ docId: 'me', uid: 'me', next: mine }).ok, true);
  assert.equal(R.visitPath('me'), 'visits/me');
  // 남의 칸에 쓰기 = 거절 (남의 글 문서를 덮어쓰기)
  const friend = R.addNote(null, { uid: 'friend', from: { name: '친구' }, note: note('n9') });
  assert.equal(R.canWriteVisit({ docId: 'friend', uid: 'me', existing: friend, next: { ...friend, notes: [] } }).why, 'not-own-path');
  assert.equal(R.canWriteVisit({ docId: 'friend', uid: 'me', existing: friend, next: R.addNote(friend, { uid: 'me', note: note('n2') }) }).why, 'not-own-path');
  // 내 칸이어도 남의 user 가 달린 문서는 덮어쓰기 거절 · 새 문서 user 는 나
  assert.equal(R.canWriteVisit({ docId: 'me', uid: 'me', existing: friend, next: mine }).why, 'not-owner');
  assert.equal(R.canWriteVisit({ docId: 'me', uid: 'me', next: friend }).why, 'user-mismatch');
  // 자유 글 칸 금지 · 선물 아닌 글에 item 금지 · 모르는 종류 금지
  for (const bad of [note('x', 'letter', { text: '아무 말' }), note('x', 'stamp', { item: 'apple' }), note('x', 'shout'), note('x', 'gift'), { ...note('x'), to: 'abc' }]) {
    assert.equal(R.canWriteVisit({ docId: 'me', uid: 'me', next: { ...mine, notes: [bad] } }).why, 'bad-note', JSON.stringify(bad));
  }
  assert.equal(R.canWriteVisit({ docId: 'me', uid: 'me', next: { ...mine, from: { name: '나', bio: '자유 글' } } }).why, 'bad-from');
  assert.equal(R.canWriteVisit({ docId: 'me', uid: 'me', next: { ...mine, notes: [note('a'), note('a')] } }).why, 'bad-note');
  assert.equal(R.canWriteVisit({ docId: '', uid: '', next: mine }).why, 'no-user');
  // 글 수는 NOTES_KEEP 까지 (오래된 것부터 뺌)
  let d = null;
  for (let i = 0; i < R.NOTES_KEEP + 5; i++) d = R.addNote(d, { uid: 'me', note: note(`n${i}`) });
  assert.equal(d.notes.length, R.NOTES_KEEP);
  assert.equal(d.notes[0].id, 'n5');
  assert.equal(R.canWriteVisit({ docId: 'me', uid: 'me', existing: mine, next: d }).ok, true);

  // 숨기기는 섬 주인 자기 섬 문서(islands/<주인 uid>.hide)로만 — 남의 섬 문서에 hide 를 넣는 것은 거절
  const key = R.noteKey('friend', 'n9');
  const myIsland = R.islandDoc({ code: 'ABC234', user: 'me', snap: { v: 1 }, hide: R.toggleHide([], key) });
  assert.deepEqual(myIsland.hide, [key]);
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', existing: myIsland, next: myIsland }).ok, true);
  const theirs = R.islandDoc({ code: 'XYZ789', user: 'friend', snap: { v: 1 } });
  assert.equal(R.canWriteIsland({ docId: 'friend', uid: 'me', existing: theirs, next: { ...theirs, hide: [R.noteKey('me', 'n1')] } }).why, 'not-own-path');
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', existing: theirs, next: { ...theirs, user: 'me' } }).why, 'not-owner');
  assert.equal(R.canWriteIsland({ docId: 'me', uid: 'me', next: { ...myIsland, hide: ['아무 글'] } }).why, 'bad-hide');
  assert.deepEqual(R.toggleHide([key], key, false), []);

  // 받는 쪽: 내 코드로 온 글만 · 숨김 표시 · 남의 칸에 쓴 문서(id ≠ user)·모르는 문장은 버림
  const forged = { ...R.addNote(null, { uid: 'friend', note: note('f1', 'letter') }), id: 'someone-else' };
  const other = R.addNote(null, { uid: 'pal', from: { name: '벗' }, note: note('p1', 'letter', { to: 'XYZ789' }) });
  const odd = R.addNote(null, { uid: 'odd', note: note('o1', 'letter', { line: 'unknown' }) });
  const got = R.inbox([{ ...friend, id: 'friend' }, forged, other, odd, { ...mine, id: 'me' }], 'ABC234', { hide: [key], mine: 'me', lineOk: (k, l) => ['flower', 'hello'].includes(l) });
  assert.deepEqual(got.map(n => [n.key, n.hidden]), [['friend/n9', true]]);
});

test('M21-P4 하루 세 섬 · 섬마다 종류 하나 · 도장 기념 가구 1·3·5·10', () => {
  let left = null;
  const day = '2026-11-18';
  for (const code of ['AAAAAA', 'BBBBBB', 'CCCCCC']) {
    assert.equal(R.canLeave(left, day, code, 'stamp').ok, true);
    left = R.recordLeave(left, day, code, 'stamp');
  }
  assert.equal(R.canLeave(left, day, 'AAAAAA', 'stamp').why, 'same');
  assert.equal(R.canLeave(left, day, 'AAAAAA', 'letter').ok, true, '같은 섬 다른 종류는 됨');
  assert.equal(R.canLeave(left, day, 'DDDDDD', 'stamp').why, 'day-full');
  assert.equal(R.canLeave(left, '2026-11-19', 'DDDDDD', 'stamp').ok, true, '다음 날 다시');
  assert.deepEqual(R.stampRewardsDue(0), []);
  assert.deepEqual(R.stampRewardsDue(3, ['furn.friend-island-frame']).map(r => r.item), ['furn.guestbook-desk']);
  assert.equal(R.stampRewardsDue(10).length, 4);
});

test('M21-P4 문장 표: id 겹침 없음 · 자유 글 칸 없음 · 기념 가구는 있는 아이템', async () => {
  const { readFileSync } = await import('node:fs');
  const L = JSON.parse(readFileSync(new URL('../assets/visit/lines.json', import.meta.url), 'utf8'));
  for (const list of [L.stamps, L.letters]) {
    const ids = list.map(x => x.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[\w-]{1,32}$/);
  }
  assert.ok(L.stamps.length >= 4 && L.letters.some(l => l.id === 'gift'), '선물 글 gift');
  const items = await import('../src/data/items.js');
  for (const r of R.STAMP_REWARDS) assert.ok(items.has(r.item), r.item);
});
