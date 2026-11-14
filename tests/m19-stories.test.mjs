// M19-P2 주민 사연 장면 s33–s52 (16차 보드 D201-A): 장면 20 · 트리거 bond-tier · 하루 하나 따라잡기 · 답례 · 가구 FU-105–108
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as R from '../src/gameplay/story/rules.js';
import { SCENE_FILES } from '../src/gameplay/story/files.js';
import { BOND_STORY, bondReward, giftEmotes } from '../src/gameplay/town/bond.js';
import * as items from '../src/data/items.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SLUGS = ['bori', 'chorong', 'coco', 'danpung', 'dubu', 'mochi', 'pong', 'gureum', 'pado', 'dalmuri'];
const files = SCENE_FILES.filter(f => { const n = Number(/\/s(\d\d)-/.exec(f)?.[1]); return n >= 33 && n <= 52; });
const scenes = files.map(f => JSON.parse(read(f)));

test('사연 장면 20: 주민 열 × 친구·단짝, id s33–s52, 목록·타임라인에 있고 모양이 맞다', () => {
  assert.equal(scenes.length, 20);
  const idx = JSON.parse(read('assets/story/index.json')).timeline.map(r => r.scene);
  for (const sc of scenes) {
    assert.deepEqual(R.validateScene(sc, { ids: idx }), [], sc.id);
    assert.ok(idx.includes(sc.id), `${sc.id} 타임라인`);
    assert.equal(sc.trigger.on, 'bond-tier');
    assert.equal(sc.takes.length, 2, `${sc.id} 연출안 둘`);
    assert.equal(sc.pick, 'A');
    assert.equal(sc.status, 'review');
    // 마지막 컷 = 사진 (앨범에 들어간다)
    for (const t of sc.takes) assert.ok(t.shots.at(-1).photo, `${sc.id} ${t.key} 사진 컷`);
  }
  for (const slug of SLUGS) for (const tier of ['friend', 'close']) {
    assert.equal(scenes.filter(s => s.trigger.slug === slug && s.trigger.tier === tier).length, 1, `${slug} ${tier}`);
  }
  // 주민 slug 는 주민 파일이 있는 것만
  for (const slug of SLUGS) assert.ok(existsSync(new URL(`../assets/villagers/${slug}.json`, import.meta.url)), slug);
});

test('bond-tier 트리거: 같은 주민 · 그 단계 이상이면 고른다 (scenesFor)', () => {
  const s = R.scenesFor('town:bond', { slug: 'bori', tier: 'close' }, scenes, {});
  assert.deepEqual(s.sort(), ['s33-bori-nap-spot', 's34-bori-first-nap']);
  assert.deepEqual(R.scenesFor('town:bond', { slug: 'bori', tier: 'known' }, scenes, {}), []);
  assert.deepEqual(R.scenesFor('town:bond', { slug: 'bori', tier: 'friend' }, scenes, { 's33-bori-nap-spot': '2027-01-01' }), []);
  assert.equal(R.TRIGGERS['bond-tier'].event, 'town:bond');
  assert.ok(R.tierReached('best', 'close') && !R.tierReached('friend', 'close'));
});

test('bondPick: 방금 오른 단계는 그 장면만 · 따라잡기는 하루 하나, 낮은 단계부터 · 줄 선 사연이 있으면 쉰다', () => {
  const byId = id => scenes.find(s => s.id === id);
  const both = ['s34-bori-first-nap', 's33-bori-nap-spot'];
  assert.deepEqual(R.bondPick(both, { slug: 'bori', tier: 'close', up: 'close' }, byId, { lastDay: '2027-01-02', today: '2027-01-02' }), ['s34-bori-first-nap']);
  assert.deepEqual(R.bondPick(both, { slug: 'bori', tier: 'best', up: 'best' }, byId), []);
  assert.deepEqual(R.bondPick(both, { slug: 'bori', tier: 'close' }, byId, { lastDay: '2027-01-01', today: '2027-01-02' }), ['s33-bori-nap-spot']);
  assert.deepEqual(R.bondPick(both, { slug: 'bori', tier: 'close' }, byId, { lastDay: '2027-01-02', today: '2027-01-02' }), []);
  assert.deepEqual(R.bondPick(both, { slug: 'bori', tier: 'close' }, byId, { today: '2027-01-03', queued: ['s35-chorong-frog-choir'] }), []);
  // 엔딩 뒤 오래 한 저장: 열 명 모두 단짝이어도 날마다 하나씩 → 20일
  const seen = {}; let lastDay = null, days = 0;
  for (let d = 1; d <= 40; d++) {
    const today = `2027-02-${String(d).padStart(2, '0')}`;
    let got = false;
    for (const slug of SLUGS) {
      const ids = R.scenesFor('town:bond', { slug, tier: 'best' }, scenes, seen);
      const pick = R.bondPick(ids, { slug, tier: 'best' }, byId, { lastDay, today });
      assert.ok(pick.length <= 1);
      if (pick.length) { assert.ok(!got, '하루 둘'); got = true; seen[pick[0]] = today; lastDay = today; }
    }
    if (got) days++;
  }
  assert.equal(days, 20);
  assert.equal(Object.keys(seen).length, 20);
});

test('답례: ② 단짝만 · 가구 넷(FU-105–108) + 말버릇 이모티콘 여섯(주민 대답 전용 reply) · 한 번만', () => {
  assert.deepEqual(Object.keys(BOND_STORY).sort(), [...SLUGS].sort());
  const emotes = JSON.parse(read('assets/emotes/emotes.json')).emotes;
  const reply = emotes.filter(e => e.cat === 'reply').map(e => e.key).sort();
  assert.deepEqual(Object.values(BOND_STORY).filter(r => r.emote).map(r => r.emote).sort(), reply);
  for (const [id, code] of [['furn.nap-cushion', 'FU-105'], ['furn.flower-word-frame', 'FU-106'], ['furn.grandma-cookbook', 'FU-107'], ['furn.lighthouse-painting', 'FU-108']]) {
    const it = items.get(id);
    assert.ok(it, id); assert.equal(it.code, code); assert.equal(it.source, 'story'); assert.equal(it.category, 'furn');
    assert.ok(Object.values(BOND_STORY).some(r => r.item === id));
    const slug = id.slice(5);
    const spec = JSON.parse(read(`assets/furniture/specs/${slug}.json`));
    assert.equal(spec.id, code); assert.equal(spec.status, 'review');
    assert.ok(existsSync(new URL(`../assets/furniture/models/${slug}.glb.json`, import.meta.url)), `${slug} 모델`);
  }
  assert.deepEqual(bondReward('bori', 'friend', 's33-bori-nap-spot'), { photo: true });
  assert.deepEqual(bondReward('bori', 'close', 's34-bori-first-nap'), { item: 'furn.nap-cushion', photo: true });
  assert.equal(bondReward('bori', 'close', 's34-bori-first-nap', ['s34-bori-first-nap']), null);
  const st = {}; giftEmotes(st).push('dots'); assert.deepEqual(st.town.giftEmotes, ['dots']);
});

test('갈고리: talk.js 가 단계가 오를 때·대화 끝에 town:bond, story 가 home 자리·같이 하기 기다림, talkui 가 배운 이모티콘을 보여 줌', () => {
  const talk = read('src/gameplay/town/talk.js');
  assert.match(talk, /emit\('town:bond', \{ slug: V\.slug, tier: up, up \}\)/);
  assert.match(talk, /emit\('town:bond', \{ slug: V\.slug, tier: tierOf\(v\.friendship\), up: null \}\)/);
  const story = read('src/gameplay/story/index.js');
  assert.match(story, /name === 'home'/);
  assert.match(story, /R\.bondPick\(/);
  assert.match(read('src/gameplay/festival/talkui.js'), /giftEmotes/);
  assert.ok(R.PLACES.home);
});
