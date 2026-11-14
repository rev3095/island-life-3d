// M19-P5 섬폰 🎬 추억 UI-36 (16차 D205-A) · 새 주민 이사 연결 · 사연 s62–s65 · 편집기 짝·등대 글 (D204-A)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/story/rules.js';
import { SCENE_FILES } from '../src/gameplay/story/files.js';
import { BOND_STORY, bondReward } from '../src/gameplay/town/bond.js';
import { plan as planTexts, TEXT_FILES } from '../tools/apply-texts.mjs';
import { textLeaves } from '../story-editor/words.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = p => JSON.parse(read(p));
const NEW = ['s62-ssalal-first-chair', 's63-ssalal-cheek-seeds', 's64-boreum-faded-photo', 's65-boreum-trunk-song'];

test('새 주민 사연 s62–s65: P2 모양 그대로 (bond-tier · 연출안 둘 · 마지막 사진 컷) · 목록 셋에 있다', () => {
  const idx = json('assets/story/index.json').timeline.map(r => r.scene);
  const ed = json('assets/story/editor-files.json').files;
  const want = { 's62-ssalal-first-chair': ['ssalal', 'friend'], 's63-ssalal-cheek-seeds': ['ssalal', 'close'], 's64-boreum-faded-photo': ['boreum', 'friend'], 's65-boreum-trunk-song': ['boreum', 'close'] };
  for (const id of NEW) {
    const f = `assets/story/scenes/${id}.json`, sc = json(f);
    assert.deepEqual(R.validateScene(sc, { ids: idx }), [], id);
    assert.ok(SCENE_FILES.includes(f) && ed.includes(f) && idx.includes(id), `${id} 목록`);
    assert.deepEqual([sc.trigger.on, sc.trigger.slug, sc.trigger.tier], ['bond-tier', ...want[id]]);
    assert.equal(sc.takes.length, 2); assert.equal(sc.pick, 'A'); assert.equal(sc.status, 'review');
    for (const t of sc.takes) assert.ok(t.shots.at(-1).photo, `${id} ${t.key} 사진 컷`);
    assert.ok(!/gureum|구름/.test(JSON.stringify(sc)), `${id} 바탕 장면 배우가 남지 않음`);
  }
  assert.equal(R.scenesFor('town:bond', { slug: 'boreum', tier: 'close' }, NEW.map(id => json(`assets/story/scenes/${id}.json`)), {}).length, 2);
  // ② 답례: 쌀알 씨앗 · 보름 라디오 (있는 아이템)
  assert.deepEqual(bondReward('ssalal', 'close', 's63-ssalal-cheek-seeds'), { item: 'seed.cosmos', photo: true });
  assert.deepEqual(bondReward('boreum', 'close', 's65-boreum-trunk-song'), { item: 'furn.radio', photo: true });
  assert.ok(BOND_STORY.ssalal && BOND_STORY.boreum);
});

test('새 주민 첫 만남: 장면 파일 없이 s17 을 배우만 바꾸고 주민 파일 welcome 으로 말풍선·자막을 덮는다', () => {
  const base = json(`assets/story/scenes/${R.WELCOME_BASE.scene}.json`);
  for (const slug of ['ssalal', 'boreum']) {
    const v = json(`assets/villagers/${slug}.json`);
    assert.equal(v.arrives, 'moving');
    assert.ok(v.welcome?.takes?.A && v.welcome.title, `${slug} welcome`);
    for (const take of base.takes) {
      const t = R.welcomeTake(take, slug, v.welcome);
      const s = JSON.stringify(t);
      assert.ok(!/"gureum"/.test(s), `${slug} ${take.key} 배우 바뀜`);
      assert.ok(!/구름/.test(t.shots.map(x => x.caption ?? '').join('')), `${slug} ${take.key} 자막에 구름 없음`);
      for (const [shot, o] of Object.entries(v.welcome.takes[take.key] ?? {})) {
        const sh = t.shots.find(x => x.id === shot);
        assert.ok(sh, `${slug} ${take.key}.${shot} 컷이 바탕 장면에 있음`);
        if (o.caption) assert.equal(sh.caption, o.caption);
        if (o.emote) assert.equal(sh.actors.find(a => a.who === slug).emote, o.emote);
      }
    }
  }
  assert.equal(R.welcomeKey('ssalal'), 'welcome:ssalal');
  // 이사 흐름이 welcome 칸을 실어 보내고, story 가 장면 없는 주민이면 s17 을 돌려 쓴다
  assert.ok(/town:welcome', \{ slug, x: door\.x, z: door\.z, welcome:/.test(read('src/gameplay/town/moving.js')));
  const st = read('src/gameplay/story/index.js');
  assert.ok(st.includes("ev === 'town:welcome' && !ids.length && payload?.welcome") && st.includes('R.welcomeTake('));
});

test('추억 목록: 이야기·주민·계절로 나누고, 못 본 칸은 힌트 · 첫 만남 칸은 s17 바로 뒤', () => {
  const idx = json('assets/story/index.json').timeline.filter(r => r.scene).map(r => r.scene);
  const scenes = idx.map(id => json(`assets/story/scenes/${id}.json`));
  const seen = { 's01-arrival': '2027-01-01', 's33-bori-nap-spot': '2027-02-03', 'welcome:boreum': '2027-03-01' };
  const nameOf = s => ({ bori: '보리', ssalal: '쌀알', boreum: '보름' }[s] ?? s);
  const welcomes = ['ssalal', 'boreum'].map(slug => ({ slug, welcome: json(`assets/villagers/${slug}.json`).welcome, title: json(`assets/villagers/${slug}.json`).welcome.title }));
  const L = R.memoryList(scenes, seen, { welcomes, nameOf });
  assert.equal(L.length, scenes.length + 2);
  assert.deepEqual(Object.keys(R.MEMORY_GROUPS), ['story', 'folk', 'season']);
  const by = id => L.find(m => m.id === id);
  assert.equal(by('s01-arrival').group, 'story'); assert.ok(by('s01-arrival').seen); assert.equal(by('s01-arrival').day, '2027-01-01');
  assert.equal(by('s33-bori-nap-spot').group, 'folk'); assert.deepEqual(by('s33-bori-nap-spot').vars, { slug: 'bori' });
  assert.equal(by('s13-spring-blossom').group, 'season'); assert.ok(!by('s13-spring-blossom').seen);
  assert.equal(by('s13-spring-blossom').hint, '봄 꽃놀이 날에');
  assert.equal(by('s63-ssalal-cheek-seeds').hint, '쌀알과 단짝이 되면 들려줄 이야기예요');
  assert.equal(by('s34-bori-first-nap').hint, '보리와 단짝이 되면 들려줄 이야기예요');
  const i17 = L.findIndex(m => m.id === R.WELCOME_BASE.scene);
  assert.deepEqual(L.slice(i17 + 1, i17 + 3).map(m => m.id), ['welcome:ssalal', 'welcome:boreum']);
  const wb = by('welcome:boreum');
  assert.ok(wb.seen); assert.equal(wb.group, 'folk'); assert.equal(wb.scene, R.WELCOME_BASE.scene); assert.equal(wb.vars.welcomeSlug, 'boreum');
  assert.equal(by('welcome:ssalal').hint, '쌀알이 섬에 이사 온 날 저녁에');
  // 모든 칸에 힌트 한 줄
  for (const m of L) assert.ok(m.hint && !m.hint.includes('\n'), m.id);
});

test('재생 전용: story.replay 는 본 기록·이벤트·시계를 건드리지 않고, 섬폰 🎬 추억 앱이 앨범 창의 추억 칸을 연다', () => {
  const st = read('src/gameplay/story/index.js');
  assert.ok(st.includes('if (opts.preview || opts.replay) return;'), '본 기록 안 남김');
  assert.ok(st.includes("events.emit('story:replay'"), '장면 이벤트 대신 story:replay');
  assert.ok(st.includes('setPaused?.(true)') && st.includes('setPaused?.(false)'), '재생 동안 시계 멈춤');
  assert.ok(/replay\(id, vars = \{\}\)/.test(st) && /memories: \(opts = \{\}\) => R\.memoryList/.test(st));
  assert.ok(read('src/ui/phone.js').includes("{ id: 'memories', name: '추억', icon: '🎬'"));
  assert.ok(read('src/gameplay/town/index.js').includes('ctx.services.ui.memories = { open: () => album.openMemories() }'));
  const al = read('src/ui/album.js');
  assert.ok(al.includes("['memories', '🎬 추억']") && al.includes('st.replay(m.scene, m.vars'));
});

test('스토리 편집기 「그 밖의 글」: 짝(pairs.json) · 등대(lighthouse.json) 글을 고치고 apply-texts 가 얹는다', () => {
  assert.equal(TEXT_FILES.pairs, 'assets/town/pairs.json');
  assert.equal(TEXT_FILES.lighthouse, 'assets/lighthouse/lighthouse.json');
  const ed = json('assets/story/editor-files.json').files;
  assert.ok(ed.includes(TEXT_FILES.pairs) && ed.includes(TEXT_FILES.lighthouse), '게시 목록');
  for (const which of ['pairs', 'lighthouse']) {
    const doc = json(TEXT_FILES[which]), leaves = textLeaves(doc);
    assert.ok(leaves.length > 5, `${which} 글 칸`);
    assert.ok(!leaves.some(p => p.startsWith('about')), `${which} about 은 글 칸 아님`);
    const p = leaves.find(x => x.startsWith('lines/'));
    const r = planTexts({ which, base: doc.version, changes: { [p]: '새 글 시험' } });
    assert.deepEqual(r.errors, []); assert.equal(r.applied.length, 1);
    assert.equal(r.after.version, (doc.version ?? 0) + 1);
    assert.equal(JSON.parse(r.text).lines ? 'ok' : 'x', 'ok');
    // 숫자 칸은 막힌다
    const bad = planTexts({ which, changes: { version: '2' } });
    assert.ok(bad.errors.length);
  }
});

test('이사: 구름·파도·달무리 뒤에 쌀알 → 보름 차례, 집터가 비면 7일마다 하나씩 · 섬 12명이면 안 온다', async () => {
  const { MOVERS, planArrival, movingState, MOVING } = await import('../src/gameplay/town/moving.js');
  assert.deepEqual(MOVERS.slice(-2), ['ssalal', 'boreum']);
  const st = {}, M = movingState(st);
  M.arrived = ['gureum', 'pado', 'dalmuri']; M.last = '2027-03-01';
  const p = planArrival({ M, endedDay: '2027-02-01', today: '2027-03-08', count: 11, freeLots: ['home:bori'] });
  assert.equal(p?.slug, 'ssalal');
  M.arrived.push('ssalal'); M.last = '2027-03-08';
  assert.equal(planArrival({ M, endedDay: '2027-02-01', today: '2027-03-15', count: 11, freeLots: ['home:pong'] })?.slug, 'boreum');
  assert.equal(planArrival({ M, endedDay: '2027-02-01', today: '2027-03-15', count: MOVING.max, freeLots: ['home:pong'] }), null);
  assert.equal(MOVING.max, 12);
});
