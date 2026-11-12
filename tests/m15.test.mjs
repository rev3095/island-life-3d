// M15 「주민과 더 가깝게」 규칙 (src/gameplay/town/bond.js): 편지 보내기·답장 · 같이 하기 · 저녁 노래 · 추억 앨범 + 주민 대사 칸 + 장면 s26
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../src/gameplay/town/bond.js';
import { villagerState } from '../src/gameplay/town/rules.js';
import { PEOPLE, LINES } from '../src/gameplay/town/people.js';
import * as items from '../src/data/items.js';
import { TRIGGERS, scenesFor } from '../src/gameplay/story/rules.js';
import { SCENE_FILES } from '../src/gameplay/story/files.js';

const ROOT = new URL('../', import.meta.url);
const readJSON = p => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const day = d => new Date(Date.UTC(2026, 10, 1) + d * 86400000).toISOString().slice(0, 10);

test('편지 보내기: 하루 세 통 · 한 주민에게 하루 한 통 · 빈 글은 안 됨 · 글 80자', () => {
  const st = {};
  assert.equal(B.canSend(st, 'coco', day(0), '  ').why, 'text');
  assert.equal(B.cleanText('a'.repeat(200)).length, B.BOND.letter.maxText);
  B.recordSent(st, { to: 'coco', text: '안녕', dayKey: day(0) });
  assert.equal(B.canSend(st, 'coco', day(0)).why, 'same');
  B.recordSent(st, { to: 'bori', text: '안녕', dayKey: day(0) });
  B.recordSent(st, { to: 'mochi', text: '안녕', dayKey: day(0) });
  assert.equal(B.canSend(st, 'dubu', day(0)).why, 'day');
  assert.ok(B.canSend(st, 'coco', day(1)).ok, '다음 날엔 다시');
});

test('답장: 다음 날부터 · 선물 반응으로 종류·친밀도 · 한 번만 · 같은 날 같은 계획', () => {
  const st = {};
  const get = id => items.get(id);
  const love = PEOPLE.coco.loves.find(r => r.includes('.')) ?? items.ITEMS.find(it => PEOPLE.coco.loves.includes(it.category))?.id;
  B.recordSent(st, { to: 'coco', text: '선물이야', gift: love, dayKey: day(0) });
  B.recordSent(st, { to: 'bori', text: '잘 지내?', dayKey: day(0) });
  assert.deepEqual(B.planReplies(st, PEOPLE, day(0), get), [], '보낸 날엔 답장 없음');
  const plan = B.planReplies(st, PEOPLE, day(1), get);
  assert.equal(plan.length, 2);
  const coco = plan.find(p => p.from === 'coco'), bori = plan.find(p => p.from === 'bori');
  assert.equal(coco.kind, 'replyLove');
  assert.ok(coco.points > bori.points, '좋아하는 선물이 든 편지가 더 오른다');
  assert.equal(bori.kind, 'reply');
  assert.equal(bori.points, B.BOND.letter.points);
  assert.deepEqual(B.planReplies(st, PEOPLE, day(1), get).map(p => p.back), plan.map(p => p.back), '같은 날엔 같은 답례');
  for (const p of plan) p.rec.replied = day(1);
  assert.deepEqual(B.planReplies(st, PEOPLE, day(2), get), [], '답장은 한 번');
  B.recordSent(st, { to: 'gone', text: '…', dayKey: day(2) });
  assert.deepEqual(B.planReplies(st, PEOPLE, day(3), get), [], '섬에 없는 주민은 답장하지 않는다');
});

test('같이 하기: 친구(30) 이상 · 하루 한 번 · 끝 조건 · 선물', () => {
  const v = villagerState({}, 'coco');
  v.friendship = 20;
  assert.equal(B.canTogether(v, day(0)).why, 'tier');
  v.friendship = 30;
  assert.ok(B.canTogether(v, day(0)).ok);
  assert.equal(B.noteTogether(v, 'fish', day(0), true), B.BOND.together.points);
  assert.equal(B.canTogether(v, day(0)).why, 'today');
  assert.ok(B.canTogether(v, day(1)).ok);
  assert.ok(B.noteTogether(v, 'walk', day(1), false) < B.BOND.together.points, '중간에 그만두면 덜 오른다');
  assert.equal(v.together.count, 2);
  const T = B.BOND.together;
  assert.equal(B.togetherDone('fish', { caught: T.fishGoal }), 'goal');
  assert.equal(B.togetherDone('fish', { caught: 0, sec: T.fishMaxSec }), 'time');
  assert.equal(B.togetherDone('walk', { walked: T.walkGoal - 1, sec: 1 }), null);
  assert.equal(B.togetherDone('walk', { walked: T.walkGoal }), 'goal');
  const r = () => 0;   // 늘 선물
  assert.equal(B.togetherGift(PEOPLE.dubu, 'fish', ['fish.carp'], r), 'fish.carp', '낚시면 같이 낚은 물고기');
  assert.ok(PEOPLE.coco.gifts.some(g => g.id === B.togetherGift(PEOPLE.coco, 'walk', [], r)), '산책이면 답례 선물 목록에서');
});

test('저녁 노래: 날마다 같은 계획 · 저녁 안 · 첫 노래는 초롱·모찌', () => {
  let n = 0;
  for (let d = 0; d < 200; d++) {
    const p = B.songPlan(day(d));
    assert.deepEqual(B.songPlan(day(d)), p);
    if (!p) continue;
    n++;
    assert.ok(p.at >= B.BOND.song.from && p.at < B.BOND.song.to);
  }
  assert.ok(n > 60 && n < 140, `200일 중 ${n}일 — 반쯤`);
  const free = ['coco', 'chorong', 'mochi', 'bori'];
  assert.deepEqual(B.songPair(free, day(0), false), ['chorong', 'mochi']);
  const pair = B.songPair(free, day(0), true);
  assert.equal(new Set(pair).size, 2);
  assert.ok(pair.every(s => free.includes(s)));
  assert.equal(B.songPair(['coco'], day(0), true), null);
  assert.ok(B.songTime({ at: 18.5 }, { hourF: 19, dayKey: day(0) }));
  assert.ok(!B.songTime({ at: 18.5 }, { hourF: 18, dayKey: day(0) }));
});

test('추억 앨범: 넘치면 오래된 것부터 · 액자 사진은 남는다 · 변형 이름', () => {
  const st = {};
  const first = B.addPhoto(st, { img: 'data:,', day: day(0), kind: 'snap', title: '첫 사진' });
  first.framed = 1;
  for (let i = 0; i < B.BOND.album.max + 5; i++) B.addPhoto(st, { img: 'data:,', day: day(0), kind: 'snap', title: `${i}` });
  const A = B.albumOf(st);
  assert.equal(A.list.filter(p => !p.framed).length, B.BOND.album.max);
  assert.ok(A.list.includes(first), '액자에 넣은 사진은 지우지 않는다');
  assert.equal(B.photoOfVariant(B.frameVariant(12)), 12);
  assert.equal(B.photoOfVariant('blue'), null);
  // 액자 가구 둘 (FU-71 탁상 · FU-72 벽), 상점 진열에는 안 섞임
  const frames = ['furn.album-frame', 'furn.album-frame-wall'].map(id => items.get(id));
  assert.deepEqual(frames.map(f => f?.code), ['FU-71', 'FU-72']);
  assert.deepEqual(frames.map(f => f.place), ['floor', 'wall']);
  assert.ok(frames.every(f => f.source === 'album'));
});

test('주민 대사: 열 명 모두 답장 넷 · 같이 하기 · 노래 칸이 있다', () => {
  const keys = ['ask', 'fishYes', 'walkYes', 'busy', 'notYet', 'caught', 'cheer', 'walking', 'stop', 'end', 'gift', 'sleepy'];
  for (const slug of Object.keys(PEOPLE)) {
    const L = LINES[slug];
    for (const k of ['reply', 'replyLove', 'replyDislike', 'together']) assert.ok(L.letters?.[k]?.length && L.letters[k].every(Array.isArray), `${slug} letters.${k}`);
    for (const k of keys) assert.ok(L.together?.[k]?.length, `${slug} together.${k}`);
    assert.ok(L.together.gift.every(l => /\{item(:\S+?)?\}/.test(l)), `${slug} together.gift 에 {item}`);
    assert.ok(L.song?.sing?.length >= 2 && L.song.sing.every(l => l.length <= 16), `${slug} song.sing 16자`);
    assert.ok(L.song?.talk?.length, `${slug} song.talk`);
  }
});

test('장면 s26: 트리거 song-first (town:song 의 first) · 목록에 있음 · 배우 = 첫 노래 두 주민', () => {
  assert.ok(TRIGGERS['song-first']);
  assert.ok(SCENE_FILES.includes('assets/story/scenes/s26-evening-song.json'));
  const sc = readJSON('assets/story/scenes/s26-evening-song.json');
  assert.deepEqual(scenesFor('town:song', { first: true, x: 0, z: 0 }, [sc]), ['s26-evening-song']);
  assert.deepEqual(scenesFor('town:song', { first: false }, [sc]), []);
  const cast = new Set(sc.takes.flatMap(t => t.shots.flatMap(s => s.actors.map(a => a.who))));
  for (const s of B.BOND.song.first) assert.ok(cast.has(s));
});
