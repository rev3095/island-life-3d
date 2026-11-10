// 스토리 장면 약속 검사: assets/story/ 의 장면 파일을 하나씩 바꿔 끼워도 재생기가 그대로 돌게.
// 장면 모양(rules.validateScene) · 타임라인(index.json) ↔ 파일 ↔ files.js 목록 · 배우 = 캐릭터 목록 · 트리거 · 카메라 계산.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import * as R from '../src/gameplay/story/rules.js';
import { INDEX_FILE, SCENE_FILES } from '../src/gameplay/story/files.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const CAST = json('assets/models/index.json').models.map(m => m.slug);
const files = readdirSync(resolve(root, 'assets/story/scenes')).filter(f => f.endsWith('.json')).sort();
const scenes = files.map(f => json(`assets/story/scenes/${f}`));
const ids = scenes.map(s => s.id);
const index = json(INDEX_FILE);

test('장면 파일마다 모양이 맞다 (연출안·컷·배우·카메라·선택지)', () => {
  const errs = scenes.flatMap(s => R.validateScene(s, { cast: CAST, ids }));
  assert.deepEqual(errs, []);
  for (const [i, s] of scenes.entries()) assert.equal(`${s.id}.json`, files[i], '파일 이름 = 장면 id');
});

test('타임라인 index.json · files.js 목록 · 장면 파일이 서로 맞다', () => {
  assert.deepEqual(R.validateIndex(index, ids), []);
  assert.deepEqual([...SCENE_FILES].sort(), files.map(f => `assets/story/scenes/${f}`), 'files.js 의 SCENE_FILES 를 장면 파일과 맞춘다 (웹 빌드가 이 목록을 묶는다)');
  const order = index.timeline.filter(r => r.scene).map(r => r.scene);
  assert.deepEqual(SCENE_FILES.map(f => f.match(/([^/]+)\.json$/)[1]), order, 'files.js 순서 = 타임라인 순서');
});

test('처음부터 엔딩 뒤까지 이어진다: 새 게임 → 첫날 → 축제 부품 1~5 → 축제 → 사진 → 그 뒤', () => {
  const on = k => scenes.filter(s => s.trigger.on === k);
  assert.equal(on('newgame').length, 1);
  assert.equal(on('firstday-done').length, 1);
  assert.deepEqual(on('festival-part').map(s => s.trigger.n).sort(), [1, 2, 3, 4, 5]);
  assert.equal(on('festival').length, 1);
  // 축제 → 엔딩 사진 → 엔딩 뒤 는 'after' 로 이어진다
  const fest = on('festival')[0].id;
  const photo = scenes.find(s => s.trigger.on === 'after' && s.trigger.scene === fest);
  assert.ok(photo, '축제 뒤 장면(엔딩)');
  assert.ok(scenes.some(s => s.trigger.on === 'after' && s.trigger.scene === photo.id), '엔딩 뒤 장면');
  // 사진 컷이 있다
  assert.ok(R.takeOf(photo).shots.some(sh => sh.photo), '엔딩 연출안에 photo 컷');
});

test('장면마다 연출안 2~3개, 추천 하나, 말풍선은 이모티콘 + 비워 둔 글 칸', () => {
  for (const s of scenes) {
    assert.ok(s.takes.length >= 2 && s.takes.length <= 3, `${s.id}: 연출안 ${s.takes.length}`);
    for (const t of s.takes) for (const sh of t.shots) for (const a of sh.actors) {
      if (a.emote != null) assert.equal(typeof a.text, 'string', `${s.id}/${t.key}/${sh.id}/${a.who}: 글 칸`);
    }
  }
});

test('트리거: 이벤트 → 장면 (본 장면·다음 날 조건)', () => {
  const list = index.timeline.filter(r => r.scene).map(r => scenes.find(s => s.id === r.scene));
  assert.deepEqual(R.scenesFor('intro:named', {}, list), ['s01-arrival']);
  assert.deepEqual(R.scenesFor('intro:named', { renamed: true }, list), [], '이름 다시 정하기는 새 게임이 아니다');
  assert.deepEqual(R.scenesFor('festival:part', { n: 3 }, list), ['s07-part3']);
  assert.deepEqual(R.scenesFor('festival:part', { n: 3 }, list, { 's07-part3': '2026-10-29' }), [], '한 번 본 장면은 다시 안 튼다');
  assert.deepEqual(R.scenesFor('data:newday', {}, list), [], '첫날 장면을 보기 전엔 다음 날 장면이 없다');
  assert.deepEqual(R.scenesFor('data:newday', {}, list, { 's03-firstday-done': true }), ['s04-stopped-festival']);
  assert.deepEqual(R.scenesFor('story:end', { id: 's10-festival' }, list), ['s11-ending-photo']);
});

test('카메라 계산: 각도 0 = 대상 남쪽, 크기·움직임', () => {
  const t = { x: 2, y: 0, z: 3 };
  const c = R.cameraAt({ size: 'full', angle: 0 }, t, 0);
  assert.ok(Math.abs(c.pos.x - 2) < 1e-9 && c.pos.z > 3 && c.pos.y > c.look.y, '남쪽 위에서 내려다본다');
  const back = R.cameraAt({ size: 'full', angle: 180 }, t, 0);
  assert.ok(back.pos.z < 3, '180 = 북쪽에서');
  const d = (cam, u) => { const k = R.cameraAt(cam, t, u); return Math.hypot(k.pos.x - k.look.x, k.pos.y - k.look.y, k.pos.z - k.look.z); };
  assert.ok(d({ size: 'full', move: 'push' }, 1) < d({ size: 'full', move: 'push' }, 0), '다가가기');
  assert.ok(d({ size: 'close' }, 0) < d({ size: 'wide' }, 0));
  const p = R.project(c.pos, c.look, c.look);
  assert.ok(Math.abs(p.x - 0.5) < 1e-6 && Math.abs(p.y - 0.5) < 1e-6, '바라보는 점 = 화면 가운데');
  assert.ok(Math.abs(d({ size: 'group', dist: 5 }, 0) - 5) < 1e-9, 'dist 로 거리를 정한다');
});

test('카메라가 집·부스 안에 들어가면 대상 쪽으로 당긴다 (QA-01)', () => {
  const look = { x: 0, y: 0.6, z: 0 };
  const c = R.cameraAt({ size: 'group', angle: 0 }, { x: 0, y: 0, z: 0 }, 0);
  const house = { x: 0, z: c.pos.z - 0.5, r: 1.45, h: 2.9 };
  const k = R.clearCam(c, [house]);
  assert.ok(Math.hypot(k.pos.x - house.x, k.pos.z - house.z) >= house.r, '집 밖으로');
  assert.ok(k.pos.z > look.z && k.pos.z < house.z, '집 앞 (대상 쪽)');
  assert.equal(R.clearCam(c, [{ x: 5, z: 5, r: 1, h: 3 }]), c, '안 걸리면 그대로');
  assert.equal(R.clearCam(c, [{ ...house, h: 1 }]), c, '카메라가 물체보다 높으면 그대로');
  assert.equal(R.clearCam(c, [{ x: 0, z: 0.5, r: 30, h: 9 }]), c, '대상이 물체 원 안이면 건드리지 않는다');
});

test('배우 자리 쌓기·걷기', () => {
  const take = { shots: [
    { id: 'a', actors: [{ who: 'coco', at: [1, 1], do: 'walk', to: [3, 1] }] },
    { id: 'b', actors: [{ who: 'coco', do: 'happy' }, { who: 'bori', at: [0, 0] }] },
  ] };
  assert.deepEqual(R.castAt(take, 1).coco.at, [3, 1], '걸어간 끝 자리');
  assert.deepEqual(Object.keys(R.castAt(take, 2)).sort(), ['bori', 'coco']);
  assert.deepEqual(R.actorPosAt([0, 0], { to: [4.2, 0], do: 'walk' }, 1, 1), [2.1, 0], '걷기 2.1칸/초');
  assert.deepEqual(R.actorPosAt([0, 0], { to: [1, 0], do: 'run' }, 1, 5), [1, 0], '도착하면 멈춘다');
  assert.deepEqual(R.actorPosAt([0, 0], { at: [-3.4, 0.4], to: [-0.6, -1.5] }, 1, 9), [-0.6, -1.5], '도착 자리는 소수 오차 없이 to 그대로');
  assert.equal(R.fillTokens('{part.emoji} {n}/5', { part: { emoji: '🏮' }, n: 2 }), '🏮 2/5');
  assert.equal(R.fillTokens('{player}', {}), '{player}', '모르는 자리는 그대로 (intro 가 채운다)');
});

test('밤 가게 첫 방문(s20·s21) · 첫 섬 여행(s22) 트리거', () => {
  assert.deepEqual(R.scenesFor('night:first', { kind: 'moonshop', x: 1, z: 2 }, scenes), ['s20-moonshop-first']);
  assert.deepEqual(R.scenesFor('night:first', { kind: 'tent' }, scenes), ['s21-tent-first']);
  assert.deepEqual(R.scenesFor('night:first', { kind: 'moonshop' }, scenes, { 's20-moonshop-first': '2026-11-11' }), [], '한 번만');
  assert.deepEqual(R.scenesFor('tour:arrive', { first: true, name: '초승달 섬' }, scenes), ['s22-first-tour']);
  assert.deepEqual(R.scenesFor('tour:arrive', { first: false }, scenes), [], '두 번째 여행부터는 안 나온다');
  assert.ok(R.validateScene({ ...scenes.find(s => s.id === 's20-moonshop-first'), trigger: { on: 'night-first', kind: 'shop' } }).some(e => /kind/.test(e)), 'kind 는 moonshop · tent');
  assert.equal(R.fillTokens('무인도 「{name}」', { name: '초승달 섬' }), '무인도 「초승달 섬」');
});
