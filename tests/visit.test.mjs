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
  // M21-P4 방명록: 내 글만 쓰고, 섬 주인은 숨기기만
  const note = { user: 'friend', text: 'hi', hidden: false };
  assert.equal(R.canWriteVisit({ path: 'visits/ABC234/friend/n1', uid: 'friend', next: note }).ok, true);
  assert.equal(R.canWriteVisit({ path: 'visits/ABC234/friend/n1', uid: 'me', existing: note, next: { ...note, text: 'bye' }, islandOwner: 'me' }).ok, false);
  assert.equal(R.canWriteVisit({ path: 'visits/ABC234/friend/n1', uid: 'me', existing: note, next: { ...note, hidden: true }, islandOwner: 'me' }).hideOnly, true);
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
