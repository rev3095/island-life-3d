// M18-P4 미술품 주고받기 · 계절 레시피 · 행상 계절 진열 (15차 보드 wave15 D195-A · D196-A, docs/notes/m18-p4-seasonal.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as items from '../src/data/items.js';
import { createRecipes, LOCKED, RECIPES, SEASON_RECIPES } from '../src/data/recipes.js';
import { createInventory } from '../src/data/inventory.js';
import { createState } from '../src/core/state.js';
import { SEASON_FURN, SEASON_FURN_IDS, SEASONS } from '../src/data/seasonal-items.js';
import { SEASON_ITEMS } from '../tools/elem-checks.mjs';
import { SEASON_FILES } from '../tools/build-web.mjs';
import * as D from '../src/gameplay/daily/rules.js';
import * as N from '../src/gameplay/night/rules.js';
import { ART_WISH, artWishDays, pickArtWish, wishLive, tradeReward, artStep } from '../src/gameplay/town/artwish.js';
import { LINES, PEOPLE } from '../src/gameplay/town/people.js';
import { PLACEHOLDERS, checkVillager } from '../src/gameplay/town/traits.js';
import { SEATS } from '../src/gameplay/decor/seats.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = p => JSON.parse(read(p));
const daily = json('assets/daily/daily.json');
const night = json('assets/night/night.json');
const days = (from, n) => Array.from({ length: n }, (_, i) => D.addDays(from, i));

test('계절 가구 13 (FU-92–104): 아이템·스펙·모델·썸네일, 봄 4 · 여름 3 · 가을 3 · 겨울 3, 새 모델은 검수 대기', () => {
  assert.equal(SEASON_FURN.length, 13);
  assert.deepEqual(SEASON_FURN.map(r => r[8]), Array.from({ length: 13 }, (_, i) => `FU-${92 + i}`));
  assert.deepEqual(SEASONS.map(s => SEASON_FURN.filter(r => r[9] === s).length), [4, 3, 3, 3]);
  const index = json('assets/furniture/index.json').models;
  for (const [slug, , size, , , , , source, id, season] of SEASON_FURN) {
    const it = items.get(`furn.${slug}`);
    assert.ok(it, slug);
    assert.equal(it.code, id);
    assert.equal(it.source, 'season');
    const spec = json(`assets/furniture/specs/${slug}.json`);
    assert.equal(spec.id, id); assert.equal(spec.season, season); assert.equal(spec.status, 'review', `${slug} 검수 대기`);
    assert.equal(spec.place, size === '벽' ? 'wall' : 'floor');
    for (const f of [`assets/furniture/models/${slug}.glb.json`, `assets/furniture/models/${slug}.stats.json`, `assets/furniture/renders/${slug}_thumb.png`]) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
    assert.ok(index.find(m => m.slug === slug), `${slug} 가구 목록`);
  }
  // 상점·나무 흔들기 가구에 안 섞인다 (출처 season)
  assert.ok(items.list('furn').filter(it => it.source === 'shop').every(it => !SEASON_FURN_IDS.includes(it.id)));
  // 요소 편집기 값 검사가 아는 목록 = 가구 13 + 재료 행사 채집
  assert.deepEqual(SEASON_ITEMS.filter(id => id.startsWith('furn.')), SEASON_FURN_IDS);
  // 앉는 의자 둘은 앉기 자리가 있거나(있으면 좋음) — 없으면 그냥 놓는 가구 (지금은 없음: 노트 남은 것)
  assert.ok(typeof SEATS === 'object');
});

test('계절 가구 모델은 그 계절 묶음 (D197-A) — 썸네일·스펙은 그대로', () => {
  for (const [slug, , , , , , , , , season] of SEASON_FURN) {
    assert.equal(SEASON_FILES.get(`assets/furniture/models/${slug}.glb.json`), season, slug);
    assert.equal(SEASON_FILES.get(`assets/furniture/specs/${slug}.json`), undefined);
  }
});

test('계절 레시피: 13개 · 쪽지로는 안 열리고 seasonLocked 로만 · 재료는 있는 아이템', () => {
  const sea = RECIPES.filter(r => r.season);
  assert.equal(sea.length, 13);
  assert.deepEqual(Object.fromEntries(SEASONS.map(s => [s, SEASON_RECIPES[s].length])), { spring: 4, summer: 3, autumn: 3, winter: 3 });
  for (const r of sea) {
    assert.ok(r.unlock, r.id);
    assert.ok(!LOCKED.includes(r.id), `${r.id} 는 쪽지 순서에 없다`);
    assert.equal(json('assets/furniture/specs/' + r.id.slice(5) + '.json').season, r.season);
    for (const n of r.needs) assert.ok(n.id ? items.get(n.id) : items.CATEGORY_NAMES[n.category], `${r.id} 재료 ${n.id ?? n.category}`);
  }
  const state = createState();
  const inv = createInventory(state);
  const known = [];
  const R = createRecipes(inv, { known: id => known.includes(id) });
  assert.ok(R.locked().every(id => !id.startsWith('furn.cherry')), '쪽지 목록엔 계절 레시피가 없다');
  assert.deepEqual(R.seasonLocked('spring'), SEASON_RECIPES.spring);
  assert.equal(R.seasonLocked().length, 13);
  assert.ok(!R.list().some(r => r.season), '처음엔 계절 레시피를 모른다');
  known.push(SEASON_RECIPES.spring[0]);
  assert.deepEqual(R.seasonLocked('spring'), SEASON_RECIPES.spring.slice(1));
  assert.ok(R.list().some(r => r.id === SEASON_RECIPES.spring[0]));
  // 열린 계절 레시피는 계절이 지나도 만들 수 있다 (재료만 있으면)
  inv.add('event.petal', 6); inv.add('mat.wood', 4);
  assert.ok(R.canCraft('furn.cherry-chair'));
  assert.ok(R.craft('furn.cherry-chair'));
  assert.equal(inv.count('furn.cherry-chair'), 1);
});

test('계절 유리병: 같은 날 같은 섬이면 같고, 대략 bottleChance 만큼', () => {
  const C = daily.seasonal;
  assert.ok(C.bottleChance > 0 && C.bottleChance < 1 && C.villagerChance > 0 && C.villagerChance < 1);
  const list = days('2027-03-01', 400);
  const hits = list.filter(d => D.seasonBottle(d, 7, C)).length;
  assert.ok(Math.abs(hits / list.length - C.bottleChance) < 0.08, `${hits}/${list.length}`);
  for (const d of list.slice(0, 30)) assert.equal(D.seasonBottle(d, 7, C), D.seasonBottle(d, 7, C));
  assert.notDeepEqual(list.map(d => D.seasonBottle(d, 7, C)), list.map(d => D.seasonBottle(d, 8, C)));
  assert.equal(D.seasonBottle('2027-03-01', 7, null), false);
  for (const k of ['found', 'bottle', 'villager']) assert.ok(C[k], k);
  assert.equal(D.withJosa('퐁', '이', '가'), '퐁이');
  assert.equal(D.withJosa('코코', '이', '가'), '코코가');
  for (const s of SEASONS) assert.ok(C.mark[s], s);
});

test('행상 계절 진열: 계절마다 꽃씨 묶음 · 계절 벽지 WP-10–13 (목록 값 0 + peddler, 도토리상점엔 안 나옴)', () => {
  const P = daily.peddler;
  const wpIndex = json('assets/interior/index.json').models;
  const seen = new Set();
  for (const s of SEASONS) {
    const x = D.peddlerSeasonal(s, P);
    assert.ok(x.seeds.length >= 1, s);
    for (const id of x.seeds) assert.equal(items.get(id)?.category, 'seed', id);
    assert.equal(x.n, P.seasonal.seedPack);
    const m = wpIndex.find(w => w.slug === x.wallpaper.slug);
    assert.ok(m && m.kind === 'wallpaper' && m.price === 0 && m.peddler && m.season === s, `${s} ${x.wallpaper.slug}`);
    assert.ok(x.wallpaper.price > 0);
    seen.add(x.wallpaper.slug);
  }
  assert.equal(seen.size, 4);
  assert.deepEqual(D.peddlerSeasonal('nope', P), { seeds: [], wallpaper: null, n: P.seasonal.seedPack });
  assert.ok(P.lines.season);
});

test('미술품 부탁 날: 주마다 1~2 번, 서로 이틀 넘게, 같은 섬·같은 날이면 같다', () => {
  let two = 0;
  for (let w = 0; w < 52; w++) {
    const monday = D.addDays('2026-11-09', w * 7);
    const list = artWishDays(monday, 5);
    assert.ok(list.length >= 1 && list.length <= 2);
    if (list.length === 2) { two++; assert.ok(D.daysBetween(list[0], list[1]) > 1); }
    for (const d of days(monday, 7)) assert.deepEqual(artWishDays(d, 5), list);
  }
  assert.ok(two > 5 && two < 40, `두 번인 주 ${two}`);
});

test('미술품 부탁 고르기: 친구 이상 주민 · 가진 작품을 더 자주 · 남는 날 · 답례 가구', () => {
  const works = items.list('art').map(a => a.id);
  assert.equal(works.length, 16);
  assert.ok(works.every(id => !id.endsWith('-fake')));
  const wishDays = days('2026-11-09', 70).filter(d => artWishDays(d, 5).includes(d));
  const other = days('2026-11-09', 70).find(d => !wishDays.includes(d));
  assert.equal(pickArtWish(other, 5, { friends: ['coco'], works }), null, '부탁 날이 아니면 없다');
  assert.equal(pickArtWish(wishDays[0], 5, { friends: [], works }), null, '친구가 없으면 없다');
  const w = pickArtWish(wishDays[0], 5, { friends: ['coco', 'bori'], works });
  assert.ok(['coco', 'bori'].includes(w.slug) && works.includes(w.id));
  assert.deepEqual(pickArtWish(wishDays[0], 5, { friends: ['coco', 'bori'], works }), w, '같은 날 같은 답');
  // 가진 작품이 있으면 대개 그것 (ownedChance)
  const mine = [works[3]];
  const hits = wishDays.filter(d => pickArtWish(d, 5, { friends: ['coco'], works, owned: [...mine, 'art.sea-morning-fake'] }).id === works[3]).length;
  assert.ok(hits >= wishDays.length * 0.5, `${hits}/${wishDays.length}`);
  // 남는 날
  assert.ok(wishLive({ id: 'x', day: '2026-11-10' }, '2026-11-10'));
  assert.ok(wishLive({ id: 'x', day: '2026-11-10' }, '2026-11-12'));
  assert.ok(!wishLive({ id: 'x', day: '2026-11-10' }, '2026-11-13'), `${ART_WISH.days}일 뒤엔 잊는다`);
  assert.ok(!wishLive({ id: 'x', day: '2026-11-10', done: 'show' }, '2026-11-10'));
  // 답례 가구: 주민 선물 표의 가구 → 없으면 상점·제작 가구
  const furn = items.list('furn');
  const a = tradeReward(PEOPLE.coco, furn, '2026-11-10', 1);
  assert.ok(items.get(a)?.category === 'furn', a);
  const b = tradeReward({ slug: 'x', gifts: [] }, furn, '2026-11-10', 1);
  assert.ok(['shop', 'craft'].includes(items.get(b).source));
});

test('미술품 대사: 주민마다 lines.art 여덟 칸 + 계절 레시피 한 줄, 자리 {art}, 검사 통과', () => {
  assert.ok(PLACEHOLDERS.art);
  const villagers = Object.keys(PEOPLE).map(slug => ({ slug }));
  assert.equal(villagers.length, 10);
  for (const p of villagers) {
    const A = LINES[p.slug].art;
    for (const k of ['ask', 'remind', 'notYet', 'fake', 'show', 'trade', 'reward', 'later', 'recipe']) assert.ok(A?.[k]?.length, `${p.slug}.art.${k}`);
    assert.ok(A.ask.every(l => l.includes('{art}')), `${p.slug} ask 에 작품 이름`);
    assert.ok(A.reward.every(l => l.includes('{reward')), `${p.slug} reward 에 답례`);
    assert.ok(A.recipe.every(l => l.includes('{item')), `${p.slug} recipe 에 가구 이름`);
    assert.deepEqual(JSON.stringify(checkVillager(json(`assets/villagers/${p.slug}.json`))).match(/lines\/art[^"]*/g) ?? [], [], p.slug);
  }
});

test('미술품 대화 단계: 보여 주기 = 친밀도 +show · 바꿔 주기 = 작품 건넴 + 친밀도 +trade + 가구 · 가품만 있으면 안 받음', async () => {
  const works = items.list('art').map(a => a.id);
  const run = async ({ pick, has = true, fake = false }) => {
    const state = createState();
    const inv = createInventory(state);
    const id = works[0];
    if (has) inv.add(id, 1);
    if (fake) inv.add(`${id}-fake`, 1);
    const emitted = [], said = [];
    const ctx = {
      state, events: { emit: (n, p) => emitted.push([n, p]) },
      services: {
        data: { inventory: inv, items: { get: items.get, list: items.list }, collect: (i, n) => ({ added: inv.add(i, n), left: 0, acorns: 0 }) },
        town: { art: { today: () => ({ slug: 'coco', id }) } },
        ui: { toast() {} },
      },
    };
    const v = { friendship: 40, pending: [] };
    let happy = 0;
    const V = { slug: 'coco', person: PEOPLE.coco, happy: () => happy++ };
    const ups = [];
    const say = async (lines, choices) => { said.push([lines].flat()); return choices ? pick : null; };
    const vars = {};
    const giveItem = (c, i, n = 1) => { inv.add(i, n); return 0; };
    const addFriendship = (vv, n) => { vv.friendship += n; return { up: null }; };
    const pickLines = (pool) => (pool ?? []).slice(0, 1);
    const did = await artStep({ ctx, V, v, L: LINES.coco, say, vars, r: Math.random, recent: [], note: u => ups.push(u), addFriendship, pickLines, giveItem, giveLater() {}, E: null, dayKey: '2026-11-10' });
    return { did, v, inv, id, said, emitted, happy, vars };
  };
  const show = await run({ pick: 0 });
  assert.ok(show.did);
  assert.equal(show.v.friendship, 40 + ART_WISH.show);
  assert.equal(show.inv.count(show.id), 1, '보여 주기는 작품이 그대로');
  assert.equal(show.v.artWish.done, 'show');
  assert.ok(show.emitted.some(([n, p]) => n === 'town:art' && p.kind === 'show'));
  const trade = await run({ pick: 1 });
  assert.equal(trade.v.friendship, 40 + ART_WISH.trade);
  assert.equal(trade.inv.count(trade.id), 0, '바꿔 주면 작품을 건넨다');
  assert.deepEqual(trade.v.arts, [trade.id]);
  const reward = trade.emitted.find(([n, p]) => n === 'town:art' && p.kind === 'trade')[1].reward;
  assert.equal(items.get(reward)?.category, 'furn');
  assert.equal(trade.inv.count(reward), 1, '답례 가구를 받는다');
  const later = await run({ pick: 2 });
  assert.equal(later.v.friendship, 40);
  assert.ok(!later.v.artWish.done, '다음에 하면 바라는 마음이 남는다');
  const fakeOnly = await run({ pick: 0, has: false, fake: true });
  assert.equal(fakeOnly.v.friendship, 40);
  assert.equal(fakeOnly.inv.count(`${fakeOnly.id}-fake`), 1);
  assert.ok(fakeOnly.emitted.some(([n, p]) => n === 'town:art' && p.kind === 'fake'));
  // 같은 날 두 번째 말 걸기엔 다시 꺼내지 않는다
  const again = await run({ pick: 2 });
  const second = await artStep({ ctx: { state: again.v, events: { emit() {} }, services: { data: { inventory: again.inv, items }, town: { art: { today: () => null } } } }, V: { slug: 'coco', person: PEOPLE.coco, happy() {} }, v: again.v, L: LINES.coco, say: async () => 0, vars: {}, r: Math.random, recent: [], note() {}, addFriendship() { return {}; }, pickLines: p => p, giveItem() {}, giveLater() {}, E: null, dayKey: '2026-11-10' });
  assert.equal(second, false);
});

test('여우 상인 가품 되사기: 반값 (여우 값의 반, 가품 파는 값보다는 많이) · 메뉴 · 대사', () => {
  const fakes = items.ITEMS.filter(it => it.fake);
  assert.ok(fakes.length >= 8);
  for (const it of fakes) {
    const p = N.foxBuyBack(it);
    assert.equal(p, Math.max(it.price, Math.floor(it.buy / 2 / 10) * 10), it.id);
    assert.ok(p > it.price && p <= it.buy / 2, it.id);
  }
  const L = night.lines.salang;
  assert.deepEqual(L.menu, ['미술품 보기', '여우불 등 사기', '가품 되팔기', '그만']);
  for (const k of ['ask', 'done', 'none', 'cancel']) assert.ok(L.buyBack[k]?.length, k);
  assert.ok(L.buyBack.ask.every(l => l.includes('{price}') && l.includes('{name}')));
});
