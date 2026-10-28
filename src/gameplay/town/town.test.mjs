// 주민 규칙·대사 데이터 확인: node --test src/gameplay/town/
// (tests/ 는 T2 폴더라 여기에 둔다. 합칠 때 tests/ 로 옮겨도 된다 — docs/notes/town.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './rules.js';
import { createNav } from './path.js';
import { PEOPLE } from './people.js';
import LINES from './lines/index.js';
import * as items from '../../data/items.js';

const DAY = '2026-10-29';
const nowAt = (hourF, dayKey = DAY) => ({ hour: Math.floor(hourF % 24), minute: 0, hourF: hourF % 24, dayKey, month: 10 });

test('조사: 받침에 맞춰 붙는다', () => {
  assert.equal(R.josa('사과', '을'), '사과를');
  assert.equal(R.josa('붕어빵', '을'), '붕어빵을');
  assert.equal(R.josa('물고기', '이'), '물고기가');
  assert.equal(R.josa('곤충', '이'), '곤충이');
  assert.equal(R.josa('코코', '와'), '코코와');
  assert.equal(R.josa('보리밭', '와'), '보리밭과');
  assert.equal(R.josa('오렌지', '이다냥'), '오렌지다냥');
  assert.equal(R.josa('고등어', '이야'), '고등어야');
  assert.equal(R.josa('잉어', '이야'), '잉어야');
  assert.equal(R.josa('호박', '이다'), '호박이다');
  assert.equal(R.josa('라디오', '이에요'), '라디오예요');
  assert.equal(R.josa('책장', '이에요'), '책장이에요');
  assert.equal(R.josa('도토리 300개', '을'), '도토리 300개를');
  assert.equal(R.fill('{item:을} 줄래? {want}', { item: '복숭아', want: '과일' }), '복숭아를 줄래? 과일');
  assert.equal(R.fill('{missing} 그대로'), '{missing} 그대로');
});

test('친밀도: 하루 한 번 말 걸기 보너스와 단계', () => {
  const state = {};
  const v = R.villagerState(state, 'coco');
  assert.equal(v.friendship, 0);
  assert.equal(R.dailyTalk(v, DAY).first, true);
  assert.equal(v.friendship, R.TALK_BONUS);
  assert.equal(R.dailyTalk(v, DAY).first, false);
  assert.equal(v.friendship, R.TALK_BONUS);
  v.friendship = 8;
  assert.equal(R.dailyTalk(v, '2026-10-30').up, 'known');
  assert.equal(R.tierOf(95), 'best');
  assert.equal(R.addFriendship(v, 999).after, R.FRIEND_MAX);
  assert.equal(state.villagers.coco, v, 'state.villagers 에 그대로 들어간다');
});

test('일과: 밤엔 집, 낮엔 밖, 비 오는 날 집에 있는 주민', () => {
  const bori = PEOPLE.bori, coco = PEOPLE.coco;
  assert.equal(R.shouldBeOut(coco, nowAt(14), 'clear'), true);
  assert.equal(R.shouldBeOut(coco, nowAt(2), 'clear'), false);       // 새벽 2시 = 26시
  assert.equal(R.shouldBeOut(bori, nowAt(14), 'rain'), false);
  assert.equal(R.shouldBeOut(coco, nowAt(14), 'rain'), true);
  assert.equal(R.shouldBeOut(PEOPLE.pong, nowAt(23), 'clear'), true);  // 퐁은 밤늦게까지
  const s1 = R.scheduleOf(coco, DAY), s2 = R.scheduleOf(coco, DAY);
  assert.deepEqual(s1, s2, '같은 날은 같은 일과');
  assert.ok(Math.abs(s1.wake - coco.wake) <= 0.5);
  assert.equal(R.slotOf(nowAt(6)), 'dawn');
  assert.equal(R.slotOf(nowAt(13)), 'afternoon');
  assert.equal(R.slotOf(nowAt(1)), 'night');
});

test('부탁: 같은 날엔 같은 부탁, 맞는 물건만 받는다', () => {
  const ctx = { dayKey: DAY, items, nativeFruit: 'fruit.apple' };
  for (const P of Object.values(PEOPLE)) {
    const a = R.makeRequest(P, ctx), b = R.makeRequest(P, ctx);
    assert.deepEqual(a, b);
    assert.ok(a.label, `${P.slug} 부탁 이름`);
    if (a.id) assert.ok(items.get(a.id), `${P.slug} 부탁 물건 ${a.id}`);
    const good = a.id ? items.get(a.id) : items.list(a.cat)[0];
    assert.equal(R.matchesRequest(a, good), true);
    assert.equal(R.matchesRequest(a, items.get('tool.rod')), false);
  }
  const v = R.villagerState({}, 'coco');
  v.request = { cat: 'fish', id: null, label: '물고기', day: '2026-10-25' };
  assert.equal(R.currentRequest(v, DAY), null, '3일 지나면 잊는다');
  const rw = R.requestReward(PEOPLE.coco, items.get('fish.carp'), R.rngOf('x'));
  assert.ok(items.get(rw.id) && rw.n >= 1);
});

test('선물: 좋아함·싫어함과 하루 횟수', () => {
  assert.equal(R.giftReaction(PEOPLE.pong, items.get('fruit.peach')), 'love');
  assert.equal(R.giftReaction(PEOPLE.pong, items.get('fossil.ammonite')), 'dislike');
  assert.equal(R.giftReaction(PEOPLE.mochi, items.get('flower.tulip-pink')), 'love');   // 교배 꽃
  assert.equal(R.giftReaction(PEOPLE.mochi, items.get('flower.tulip-red')), 'like');
  assert.equal(R.giftReaction(PEOPLE.dubu, items.get('furn.sofa')), 'normal');
  const v = R.villagerState({}, 'pong');
  const peach = items.get('fruit.peach');
  const pts = [1, 2, 3].map(() => R.receiveGift(v, PEOPLE.pong, peach, DAY).points);
  assert.deepEqual(pts, [R.GIFT_POINTS.love, R.GIFT_POINTS.love, 0]);
  // 답례는 하루 한 번
  v.friendship = 100;
  const r = () => 0;
  assert.ok(R.giftBack(v, PEOPLE.pong, 'love', DAY, r));
  assert.equal(R.giftBack(v, PEOPLE.pong, 'love', DAY, r), null);
});

test('대사 고르기: 최근 대사를 피하고 늘 배열을 준다', () => {
  const pool = ['가', '나', ['다', '라']];
  const recent = [];
  const r = R.rngOf('pick');
  const seen = new Set();
  for (let i = 0; i < 3; i++) seen.add(R.pickLines(pool, r, recent)[0]);
  assert.equal(seen.size, 3);
  const L = LINES.coco;
  const g = R.greetingLines(L, { now: nowAt(9), weather: 'rain', season: 'autumn', tier: 'new', r: R.rngOf('g'), recent: [] });
  assert.ok(g.length >= 1 && g.every(s => typeof s === 'string'));
});

test('대사 데이터: 주민마다 필요한 묶음이 다 있고 자리 이름이 맞다', () => {
  const need = ['intro', 'greet.dawn', 'greet.morning', 'greet.afternoon', 'greet.evening', 'greet.night',
    'weather.clear', 'weather.cloudy', 'weather.rain', 'weather.snow', 'weather.rainbow',
    'season.spring', 'season.summer', 'season.autumn', 'season.winter',
    'tier.new', 'tier.known', 'tier.friend', 'tier.close', 'tier.best', 'chat', 'menu', 'goingHome',
    'request.ask', 'request.accept', 'request.decline', 'request.remind', 'request.notYet', 'request.thanks', 'request.reward', 'request.done',
    'gift.love', 'gift.like', 'gift.normal', 'gift.dislike', 'gift.many', 'gift.back', 'gift.surprise', 'gift.pending', 'gift.full', 'gift.cancel',
    'bye', 'tierUp.known', 'tierUp.friend', 'tierUp.close', 'tierUp.best', 'photo', 'home.day', 'home.rain', 'home.sleep'];
  const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
  const strings = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
  const KEYS = new Set(['item', 'want', 'reward', 'furn', 'n', 'cat']);
  for (const slug of ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong']) {
    const L = LINES[slug];
    for (const p of need) assert.ok(get(L, p)?.length, `${slug}.${p}`);
    const all = strings(L);
    assert.ok(all.length >= 100, `${slug} 대사 ${all.length}줄`);
    for (const s of all) {
      for (const [, k] of s.matchAll(/\{(\w+)/g)) assert.ok(KEYS.has(k), `${slug}: 모르는 자리 {${k}} — ${s}`);
      assert.ok(s.length <= 60, `${slug}: 한 줄이 너무 길다 (${s.length}) — ${s}`);
    }
  }
  for (const s of strings(LINES.bamtol).concat(strings(LINES.neuru))) assert.ok(s.length <= 64, `가게 주인 대사가 길다 — ${s}`);
});

test('설정: 좋아하는 것·보상·선물 id 가 아이템 사전에 있다', () => {
  for (const P of Object.values(PEOPLE)) {
    for (const id of [...P.rewards, ...P.gifts.map(g => g.id), ...P.wants.filter(w => w.id && w.id !== 'native').map(w => w.id)]) assert.ok(items.get(id), `${P.slug}: ${id}`);
    for (const rule of [...P.loves, ...P.likes, ...P.dislikes]) {
      if (['rare', 'hybrid'].includes(rule) || rule.startsWith('price')) continue;
      assert.ok(rule.includes('.') ? items.get(rule) : items.CATEGORIES.includes(rule), `${P.slug}: ${rule}`);
    }
  }
});

test('길찾기: 막힌 칸을 돌아가고 못 가는 곳은 null', () => {
  // 7×5 섬: 가운데 세로 벽(구멍 하나)
  const map = [
    '.......',
    '...#...',
    '...#...',
    '.......',
    '...#~..',
  ];
  const w = 7, h = 5;
  const at = (tx, tz) => (tx >= 0 && tz >= 0 && tx < w && tz < h ? map[tz][tx] : '#');
  const island = {
    w, h,
    toWorld: (tx, tz) => ({ x: tx + 0.5, z: tz + 0.5 }),
    toTile: (x, z) => ({ tx: Math.floor(x), tz: Math.floor(z) }),
    isWalkable: (x, z) => at(Math.floor(x), Math.floor(z)) === '.',
    passable: (ax, az, bx, bz) => at(bx, bz) !== '~',
    tileAt: () => 'grass',
  };
  const nav = createNav(island);
  const p = nav.findPath({ tx: 0, tz: 1 }, { tx: 6, tz: 1 });
  assert.ok(p, '길이 있다');
  assert.ok(p.every(t => at(t.tx, t.tz) === '.'), '벽을 지나지 않는다');
  assert.ok(p.some(t => t.tz === 0 || t.tz === 3), '위나 아래로 돌아간다');
  assert.equal(nav.findPath({ tx: 0, tz: 0 }, { tx: 3, tz: 1 }), null, '벽 칸은 못 간다');
  assert.ok(nav.reach({ tx: 0, tz: 0 }, 2).length > 3);
  const pts = nav.smooth(p.slice(1), 0.5, 1.5);
  assert.ok(pts.length <= p.length - 1);
  assert.deepEqual(pts.at(-1), { x: 6.5, z: 1.5 });
});
