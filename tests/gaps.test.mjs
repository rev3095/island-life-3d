// M17-P2 빈칸 트랙 (14차 보드 D181–D185 추천안 A): 가품 대사 · 일지 조건 · 미술품 집에 놓기 · 증축은 밤톨에게 · 집 안 별 망원경
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as items from '../src/data/items.js';
import { FAKE_LOOK, MUSEUM_TELL } from '../src/data/art-items.js';
import { createMuseum } from '../src/data/museum.js';
import { artInfos, ART_PLACE } from '../src/gameplay/house/furniture.js';
import * as J from '../src/gameplay/journal/rules.js';
import { growTopic, offer, startBuild, repay, DEFAULT_HOME } from '../src/gameplay/house/home.js';
import * as R from '../src/gameplay/rating/rules.js';
import { MUSEUM_CATEGORIES, DEX_CATEGORIES, CATEGORY_NAME } from '../src/ui/dom.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = p => JSON.parse(read(p));
const ART = json('assets/data/items.json').art;
const FAKES = ART.filter(a => a.fake);

test('D181 가품: 작품마다 느루 한 줄(MUSEUM_TELL)·3D 색(FAKE_LOOK) — 색은 아이템 스펙 variants.fake 와 같다', () => {
  assert.equal(FAKES.length, 8);
  assert.deepEqual(Object.keys(MUSEUM_TELL).sort(), FAKES.map(a => a.slug).sort(), '가품이 있는 작품마다 느루 한 줄');
  assert.deepEqual(Object.keys(FAKE_LOOK).sort(), FAKES.map(a => a.slug).sort());
  for (const a of FAKES) {
    const spec = json(`assets/items/specs/art-${a.slug}.json`);
    assert.deepEqual(FAKE_LOOK[a.slug], spec.variants.fake.palette, `${a.slug}: 스펙 가품 색과 다르다`);
    assert.ok(Object.keys(FAKE_LOOK[a.slug]).includes(a.fake.key), `${a.slug}: 다른 칸(fake.key)이 색 칸에 있다`);
    const it = items.get(`art.${a.slug}-fake`);
    assert.equal(it.museumTell, MUSEUM_TELL[a.slug]);
    assert.deepEqual(it.fakeLook, FAKE_LOOK[a.slug]);
    assert.ok(it.museumTell.length <= 64 && !/[{}]/.test(it.museumTell), `${a.slug}: 대화창 한 줄`);
    assert.equal(items.get(`art.${a.slug}`).fakeLook, undefined, '진품은 색을 바꾸지 않는다');
  }
});

test('D181 가품: 박물관은 받지 않고, 기증 창은 미술품도 받는다 · 느루 대사 칸 fake', () => {
  const mu = createMuseum({});
  assert.equal(mu.donate('art.sea-morning-fake'), false);
  assert.equal(mu.donate('art.sea-morning'), true);
  assert.ok(MUSEUM_CATEGORIES.includes('art') && !DEX_CATEGORIES.includes('art'), '박물관 기증은 미술품까지 · 도감 탭은 그대로');
  assert.equal(CATEGORY_NAME.art, '미술품');
  const neuru = json('assets/villagers/neuru.json');
  assert.ok(neuru.version >= 2);
  for (const k of ['look', 'found', 'back', 'more']) assert.ok(neuru.lines.fake[k]?.length, `느루 lines.fake.${k}`);
  for (const pool of Object.values(neuru.lines.fake)) for (const e of pool) for (const l of e) assert.ok(l.length <= 64, l);
  // 이어진 곳: 창이 가품을 고르면 museum:fake → 느루 fakeTalk
  assert.match(read('src/ui/museum.js'), /museum:fake/);
  assert.match(read('src/ui/bag.js'), /isFake\(slot\.id\)/);
  const keepers = read('src/gameplay/town/keepers.js');
  assert.match(keepers, /'museum:fake'/);
  assert.match(keepers, /async function fakeTalk/);
  const places = read('src/gameplay/house/places.js');
  assert.match(places, /fakeLook/, '실내 진열 가품 색');
  assert.match(places, /kit\.info\(s\.id\) && !kit\.info\(s\.id\)\.art/, '진열 미술품은 집 키트(벽에 거는 모양)가 아니라 아이템 모델로');
});

test('D183 일지 조건 needs: 스쿠버 키트·새총이 없으면 sea1·balloon 이 안 뽑히고, 있으면 예전과 같다', () => {
  const cfg = json('assets/journal/journal.json');
  assert.equal(cfg.tasks.find(t => t.id === 'sea1').needs, 'tool.scuba-kit');
  assert.equal(cfg.tasks.find(t => t.id === 'balloon').needs, 'tool.sling');
  for (const t of cfg.tasks) for (const id of [t.needs ?? []].flat()) assert.ok(items.has(id), `${t.id}: needs ${id}`);
  const none = () => false, all = () => true;
  let sawSea = false;
  for (let d = 1; d <= 60; d++) {
    const day = `2027-01-${String((d % 28) + 1).padStart(2, '0')}`, seed = d;
    const plain = J.pickTasks(cfg, day, seed).map(t => t.id);
    assert.deepEqual(J.pickTasks(cfg, day, seed, all).map(t => t.id), plain, '다 가졌으면 조건 없을 때와 같다');
    const poor = J.pickTasks(cfg, day, seed, none);
    assert.equal(poor.length, cfg.daily);
    assert.ok(!poor.some(t => t.id === 'sea1' || t.id === 'balloon'), `${day}: 조건 못 맞춘 할 일이 뽑혔다`);
    if (plain.includes('sea1')) sawSea = true;
  }
  assert.ok(sawSea, '키트가 있으면 sea1 도 뽑힌다');
  assert.equal(J.needsMet({ needs: ['tool.sling', 'tool.scuba-kit'] }, id => id === 'tool.sling'), false);
  // ensure 가 has 를 넘긴다
  const st = {};
  J.ensure(st, { ...cfg, tasks: cfg.tasks.filter(t => t.on === 'sea' || t.on === 'fish'), daily: 2 }, '2027-02-01', 1, none);
  assert.ok(!st.journal.tasks.some(r => r.id === 'sea1'));
});

test('D184 미술품 집에 놓기: 그림은 벽 칸 · 조각은 바닥 1칸 · 진품·가품 모두 · 별점에 조금', () => {
  const idx = json('assets/items/index.json');
  const infos = artInfos(idx);
  assert.equal(infos.length, ART.length + FAKES.length);
  for (const a of ART) {
    for (const id of [`art.${a.slug}`, ...(a.fake ? [`art.${a.slug}-fake`] : [])]) {
      const f = infos.find(x => x.item === id);
      assert.ok(f, id);
      assert.equal(f.place, a.kind === 'painting' ? 'wall' : 'floor', id);
      assert.deepEqual(f.footprint, [1, 1]);
      assert.equal(f.slug, `art-${a.slug}`);
    }
  }
  assert.ok(ART_PLACE.wallY > 1 && ART_PLACE.wallY < 2.2);
  const house = read('src/gameplay/house/index.js');
  assert.match(house, /startsWith\('art\.'\)/, '가구 놓기 가방에 미술품');
  // 별점: 집 안 미술품 칸
  const cfg = json('assets/rating/rating.json');
  const part = cfg.parts.find(p => p.id === 'art');
  assert.ok(part && part.per > 0 && part.per * part.max <= 20, '조금만 더한다');
  const base = R.rate({ flowers: 100, trees: 100 }, cfg).score;
  assert.equal(R.rate({ flowers: 100, trees: 100, art: 2 }, cfg).score, base + part.per * 2);
  assert.equal(R.countIsland([], { art: 3 }).art, 3);
  assert.match(read('src/gameplay/rating/index.js'), /startsWith\('art\.'\)/);
});

test('D185 증축은 밤톨에게: 우편함은 빚 갚기만 · 상점에서 짓기', () => {
  const g = { stage: 0, debt: 0, paid: 0, pending: null };
  assert.equal(growTopic(g, DEFAULT_HOME, 'mail'), 'to-shop');
  assert.equal(growTopic(g, DEFAULT_HOME, 'shop'), 'build');
  assert.ok(startBuild(g, DEFAULT_HOME));
  assert.equal(growTopic(g, DEFAULT_HOME, 'mail'), 'repay', '짓는 중이어도 우편함에서 갚는다');
  assert.equal(growTopic(g, DEFAULT_HOME, 'shop'), 'pending');
  g.pending = null; g.stage = 1;
  assert.equal(growTopic(g, DEFAULT_HOME, 'shop'), 'debt');
  repay(g, g.debt);
  assert.equal(growTopic(g, DEFAULT_HOME, 'mail'), 'to-shop');
  assert.equal(growTopic(g, DEFAULT_HOME, 'shop'), offer(g, DEFAULT_HOME).kind);
  const house = read('src/gameplay/house/index.js');
  assert.match(house, /G\.debt > 0 && mailboxInFront\(\)/, '우편함 처리기는 빚이 있을 때만');
  assert.match(house, /ask: \(\{ say \} = \{\}\) => growTalk\(\{ where: 'shop', say \}\)/);
  assert.match(read('src/gameplay/town/keepers.js'), /'집을 넓히고 싶어요'/);
  assert.ok(!json('assets/rating/rating.json').parts.find(p => p.id === 'home').tip.includes('우편함'));
});

test('집 안 별 망원경 FU-53 → 박물관 옆과 같은 망원경 보기', () => {
  const house = read('src/gameplay/house/index.js');
  assert.match(house, /TELESCOPE_ITEM = 'furn\.star-telescope'/);
  assert.match(house, /\['scope', '망원경 보기'\]/);
  assert.match(house, /stars\.open\(\{ where: '집 안 별 망원경' \}\)/);
  assert.ok(items.get('furn.star-telescope'));
});
