// M7-P4 저장 옮기기 (UI-09): 저장 글 내보내기·검사·불러오기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/core/state.js';
import { createSave, exportSave, parseSave, checksum, saveInfo, SAVE_KEY, SAVE_VERSION, TRANSFER_TAG } from '../src/data/save.js';
import { fakeStorage, brokenStorage } from './helpers.mjs';

const sample = () => {
  const s = createState();
  s.player.name = '하늘';
  s.island.name = '포근섬';
  s.wallet.acorns = 4321;
  s.inventory[0] = { id: 'fruit.apple', count: 7 };
  s.inventory[2] = { id: 'tool.rod', count: 1, uses: 9 };
  s.museum.fish.push('fish.crucian');
  s.island.removed.push('tree-3');
  s.house.furniture.push({ id: 'furn.bed', x: 1, z: 2, rot: 1 });
  s.villagers.coco = { friendship: 12 };
  s.flags.firstday = { step: 4 };
  s.mail = [{ from: 'coco', read: false }];   // createState 에 없는 모듈 칸도 옮긴다
  return s;
};

test('저장 글 모양: 설명 줄 · 머리 줄 · base64 줄 (76자)', () => {
  const text = exportSave(sample(), { now: Date.UTC(2026, 9, 31, 3, 4), savedAt: 5, build: 'abc 2026-10-31' });
  const lines = text.split('\n');
  assert.match(lines[0], /^# 포근섬 이야기 저장 — 포근섬 · 하늘 — 2026-10-31 \d\d:04$/);
  const [tag, v, sum] = lines[1].split(' ');
  assert.equal(tag, TRANSFER_TAG);
  assert.equal(Number(v), SAVE_VERSION);
  assert.match(sum, /^[0-9a-f]{8}$/);
  assert.ok(lines.length > 2);
  for (const l of lines.slice(2, -1)) assert.equal(l.length, 76);
  assert.match(lines.slice(2).join(''), /^[A-Za-z0-9+/=]+$/);
});

test('내보내기 → 검사 왕복: 상태·요약·빌드가 그대로', () => {
  const src = sample();
  const r = parseSave(exportSave(src, { now: 1000, savedAt: 900, build: 'b1' }));
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.build, 'b1');
  assert.equal(r.data.savedAt, 900);
  assert.deepEqual(r.data.state.inventory, src.inventory);
  assert.deepEqual(r.data.state.house, src.house);
  assert.deepEqual(r.data.state.villagers, src.villagers);
  assert.deepEqual(r.data.state.mail, src.mail);
  assert.equal(r.data.state.player.name, '하늘');
  assert.deepEqual(r.info, { player: '하늘', island: '포근섬', acorns: 4321, items: 2, museum: 1, createdAt: src.createdAt, savedAt: 900, exportedAt: 1000 });
});

test('붙여 넣을 때 생기는 것들은 견딘다: 앞뒤 빈칸·CRLF·줄 들여쓰기·BOM·설명 줄 없음', () => {
  const text = exportSave(sample());
  const messy = `﻿\n\n  ${text.split('\n').slice(1).map(l => `  ${l}  `).join('\r\n')}\n\n`;
  assert.equal(parseSave(messy).ok, true);
  // base64 를 한 줄로 이어 붙여도
  const [, head, ...body] = text.split('\n');
  assert.equal(parseSave(`${head}\n${body.join('')}`).ok, true);
});

test('localStorage 저장 JSON 그대로 붙여 넣어도 된다 (예전 형식 v0 도 올린다)', () => {
  const s = sample();
  assert.equal(parseSave(JSON.stringify({ v: 1, savedAt: 7, state: s })).ok, true);
  const old = parseSave(JSON.stringify(s));
  assert.equal(old.ok, true);
  assert.equal(old.data.state.wallet.acorns, 4321);
});

test('잘못된 글은 이유와 함께 거절', () => {
  const text = exportSave(sample());
  const lines = text.split('\n');
  const cases = [
    ['', /없어요/],
    ['안녕하세요', /저장 글이 아니에요/],
    [`${TRANSFER_TAG} x 00000000\nAAAA`, /첫 줄/],
    [`${TRANSFER_TAG} ${SAVE_VERSION + 1} 00000000\nAAAA`, /더 새 버전/],
    [lines.slice(0, -2).join('\n'), /빠졌거나|잘렸거나|읽지 못했어요/],           // 끝이 잘림
    [lines.map((l, i) => (i === 3 ? l.replace(/[A-Z]/, c => (c === 'A' ? 'B' : 'A')) : l)).join('\n'), /빠졌거나|잘렸거나|읽지 못했어요/],   // 한 글자 바뀜
    [`${TRANSFER_TAG} 1 ${checksum('[1,2]')}\n${btoa('[1,2]')}`, /저장 형식이 아니에요|읽을 수 없는/],
    [JSON.stringify({ v: 1, state: { hello: 1 } }), /모양이 아니에요/],
    [JSON.stringify({ v: 9, state: sample() }), /더 새 버전/],
  ];
  for (const [t, re] of cases) {
    const r = parseSave(t);
    assert.equal(r.ok, false, `거절해야 함: ${t.slice(0, 40)}`);
    assert.match(r.reason, re, t.slice(0, 40));
  }
});

test('망가진 칸은 불러올 때 고쳐진다 (모르는 아이템·음수 도토리)', () => {
  const s = sample();
  s.inventory[5] = { id: 'nope.thing', count: 3 };
  s.wallet.acorns = -50;
  const r = parseSave(exportSave(s));
  assert.equal(r.ok, true);
  assert.equal(r.data.state.inventory[5], null);
  assert.equal(r.data.state.wallet.acorns, 0);
});

test('importText: 이 브라우저 저장을 바꾸고, 예전 저장은 사본으로, 지금 상태는 그대로', () => {
  const storage = fakeStorage();
  const mine = createState();
  mine.wallet.acorns = 10;
  const save = createSave({ state: mine, storage, now: () => 50 });
  save.save();
  const before = storage.getItem(SAVE_KEY);

  const other = sample();
  const r = save.importText(exportSave(other, { savedAt: 40 }));
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.info.player, '하늘');
  assert.equal(storage.getItem(`${SAVE_KEY}-before-import`), before);
  assert.equal(mine.wallet.acorns, 10, '지금 상태는 건드리지 않는다 (다시 열어 불러옴)');
  assert.equal(save.held, true);

  // 다시 열기 전 자동 저장(pagehide 등)이 새 저장을 덮지 않는다
  mine.wallet.acorns = 99;
  assert.equal(save.save(), true);
  // 다시 열면 = 새 게임이 이 저장소에서 불러오기 → 같은 상태
  const fresh = createState();
  assert.equal(createSave({ state: fresh, storage }).load(), true);
  assert.deepEqual(fresh.inventory, other.inventory);
  assert.deepEqual(fresh.house, other.house);
  assert.deepEqual(fresh.mail, other.mail);
  assert.equal(fresh.wallet.acorns, 4321);
});

test('importText: 잘못된 글이면 아무것도 쓰지 않는다 (지금 저장 지키기)', () => {
  const storage = fakeStorage();
  const save = createSave({ state: sample(), storage });
  save.save();
  const before = storage.getItem(SAVE_KEY);
  const r = save.importText('POGEUN-SAVE 1 deadbeef\nAAAA');
  assert.equal(r.ok, false);
  assert.equal(storage.getItem(SAVE_KEY), before);
  assert.equal(storage.getItem(`${SAVE_KEY}-before-import`), null);
  assert.equal(save.held, false);
});

test('importText: 저장소가 없거나 쓰기가 막히면 거절하고 저장을 그대로 둔다', () => {
  const text = exportSave(sample());
  const none = createSave({ state: createState(), storage: null }).importText(text);
  assert.equal(none.ok, false);
  assert.match(none.reason, /저장할 수 없어서/);
  const r = createSave({ state: createState(), storage: brokenStorage() }).importText(text);
  assert.equal(r.ok, false);
  assert.match(r.reason, /쓰지 못했어요/);
});

test('importText: 더 새 버전 저장으로 막힌 창(blocked)도 사용자가 고른 저장으로 풀린다', () => {
  const storage = fakeStorage({ [SAVE_KEY]: JSON.stringify({ v: SAVE_VERSION + 1, state: {} }) });
  const save = createSave({ state: createState(), storage });
  assert.equal(save.load(), false);
  assert.equal(save.blocked, true);
  assert.equal(save.importText(exportSave(sample())).ok, true);
  assert.equal(save.blocked, false);
  assert.match(storage.getItem(`${SAVE_KEY}-before-import`), /"v":2/);
});

test('exportText: 먼저 저장하고 같은 상태를 글로', () => {
  const storage = fakeStorage();
  const st = sample();
  const save = createSave({ state: st, storage, now: () => 77 });
  const r = parseSave(save.exportText({ build: 'x' }));
  assert.equal(r.ok, true);
  assert.equal(r.data.savedAt, 77);
  assert.ok(storage.getItem(SAVE_KEY));
  assert.deepEqual(r.data.state.inventory, st.inventory);
});

test('saveInfo 는 망가진 상태에서도 던지지 않는다', () => {
  assert.deepEqual(saveInfo(null), { player: '', island: '', acorns: 0, items: 0, museum: 0, createdAt: null, savedAt: null, exportedAt: null });
});
