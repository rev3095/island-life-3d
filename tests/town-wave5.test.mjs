// 5차 Z4: 새 주민 단풍·이사 흐름·생일 확인 (src/gameplay/town/movein.js · src/data/birthdays.js · lines/). node --test tests/town-wave5.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/town/rules.js';
import * as BD from '../src/data/birthdays.js';
import { advanceMovein, moveinState, stageOf, livesHere, propKind, PROPS, MOVEIN_DAYS } from '../src/gameplay/town/movein.js';
import { PEOPLE } from '../src/gameplay/town/people.js';
import LINES from '../src/gameplay/town/lines/index.js';
import { generateIsland, lotsOf, BUILDING_KINDS, createIslandApi } from '../src/world/island.js';
import { ISLAND, VILLAGERS, NEWCOMERS, CHARACTERS } from '../src/core/constants.js';

const lots = lotsOf(Object.fromEntries(BUILDING_KINDS.map(k => [k, JSON.parse(readFileSync(new URL(`../assets/env/specs/${k}.json`, import.meta.url), 'utf8'))])));
const strings = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const KEYS = new Set(['item', 'want', 'reward', 'furn', 'n', 'cat', 'other', 'player', 'island']);

test('상수: 단풍은 주민·캐릭터이고 처음엔 이사 올 주민', () => {
  assert.ok(CHARACTERS.includes('danpung') && VILLAGERS.includes('danpung'));
  assert.deepEqual(NEWCOMERS, ['danpung']);
  for (const s of NEWCOMERS) assert.ok(VILLAGERS.includes(s));
  assert.equal(PEOPLE.danpung.color, '#D9583B');
  assert.equal(PEOPLE.danpung.joySeason, 'autumn');
  const spec = JSON.parse(readFileSync(new URL('../assets/specs/danpung.json', import.meta.url), 'utf8'));
  assert.equal(spec.id, 'CH-10');
  assert.equal(spec.species, 'fox');
  for (const k of ['earTip', 'tailTip', 'muzzle']) assert.ok(spec.palette[k], `팔레트 ${k}`);
});

test('생일표: 보드 날짜, 이사 온 주민은 state 에서, 2월 29일은 평년 28일', () => {
  assert.equal(BD.BIRTHDAYS.dubu, '11-03');
  assert.deepEqual(['coco', 'bori', 'mochi', 'pong', 'chorong'].map(s => BD.BIRTHDAYS[s]), ['07-14', '03-21', '04-08', '09-27', '06-18']);
  const state = {};
  assert.equal(BD.birthdayOf('danpung', state), null);
  state.town = { birthdays: { danpung: '11-04' } };
  assert.equal(BD.birthdayOf('danpung', state), '11-04');
  assert.ok(BD.isBirthday('dubu', '2026-11-03', state));
  assert.ok(!BD.isBirthday('dubu', '2026-11-04', state));
  assert.deepEqual(BD.birthdaysOn('2026-11-04', state), ['danpung']);
  assert.ok(BD.sameDay('02-29', '2027-02-28'), '평년엔 28일');
  assert.ok(!BD.sameDay('02-29', '2028-02-28'), '윤년엔 29일');
  assert.ok(BD.sameDay('02-29', '2028-02-29'));
  assert.equal(BD.birthdayLabel('11-03'), '11월 3일');
  assert.equal(BD.daysUntil('11-03', '2026-10-29'), 5);
  assert.equal(BD.daysUntil('10-28', '2026-10-29'), 364);
});

test('플레이어 생일: 맞는 날만 정해지고, 지울 수 있다', () => {
  const state = {};
  assert.equal(BD.setPlayerBirthday(state, 2, 30), null, '없는 날');
  assert.equal(BD.setPlayerBirthday(state, 12, 25), '12-25');
  assert.equal(BD.setPlayerBirthday(state, 13, 1), '12-25', '틀린 값은 그대로 둔다');
  assert.ok(BD.isPlayerBirthday(state, '2026-12-25'));
  assert.equal(BD.setPlayerBirthday(state, null), null);
  assert.equal(BD.playerBirthday(state), null);
  state.town.playerBirthday = '99-99';
  assert.equal(BD.playerBirthday(state), null, '망가진 저장 값은 무시');
});

test('선물: 생일엔 친밀도 3배 (하루 두 개까지 세는 건 같다)', () => {
  const v = R.villagerState({}, 'dubu');
  const fish = { id: 'fish.carp', category: 'fish', price: 300 };
  const a = R.receiveGift(v, PEOPLE.dubu, fish, '2026-11-03', BD.BIRTHDAY_GIFT_MULT);
  assert.equal(a.points, R.GIFT_POINTS.like * 3);
  R.receiveGift(v, PEOPLE.dubu, fish, '2026-11-03', 3);
  assert.equal(R.receiveGift(v, PEOPLE.dubu, fish, '2026-11-03', 3).points, 0);
  assert.equal(R.receiveGift(R.villagerState({}, 'dubu'), PEOPLE.dubu, fish, '2026-11-04').points, R.GIFT_POINTS.like);
});

test('이사: 안내 다음 날 표지판 → 3일 뒤 이삿짐 → 다음 날 입주, 물러나지 않는다', () => {
  const state = { flags: {} };
  const r = moveinState(state, 'danpung');
  assert.deepEqual(advanceMovein(r, '2026-10-29', false), [], '첫날 안내 전엔 아무 일 없음');
  assert.equal(stageOf(r), 'none');
  assert.deepEqual(advanceMovein(r, '2026-10-29', true), []);
  assert.equal(stageOf(r), 'waiting');
  assert.deepEqual(advanceMovein(r, '2026-10-30', true), ['lot']);
  assert.deepEqual(advanceMovein(r, '2026-11-01', true), []);
  assert.deepEqual(advanceMovein(r, '2026-11-02', true), ['boxes']);
  assert.ok(!livesHere(state, 'danpung', NEWCOMERS));
  assert.deepEqual(advanceMovein(r, '2026-10-01', true), [], '시계를 되돌려도');
  assert.equal(stageOf(r), 'boxes');
  assert.deepEqual(advanceMovein(r, '2026-11-03', true), ['moved']);
  assert.ok(livesHere(state, 'danpung', NEWCOMERS));
  assert.ok(livesHere(state, 'coco', NEWCOMERS), '원래 주민은 늘 산다');
  assert.equal(MOVEIN_DAYS.lot + MOVEIN_DAYS.boxes + MOVEIN_DAYS.house, 5);
  // 오래 쉬었다 오면 한 번에
  const r2 = moveinState({}, 'danpung');
  advanceMovein(r2, '2026-10-29', true);
  assert.deepEqual(advanceMovein(r2, '2026-12-01', true), ['lot', 'boxes', 'moved']);
  assert.deepEqual([r2.lot, r2.boxes, r2.moved], ['2026-10-30', '2026-11-02', '2026-11-03'], '예정된 날로 적는다');
});

test('소품 찾기: 이름 → 스펙 id → 임시 대체 순, 없으면 null', () => {
  const world = models => ({ debug: { models } });
  assert.equal(propKind(world({ 'lot-sign': {}, signboard: {} }), PROPS.sign), 'lot-sign');
  assert.equal(propKind(world({ 'zone-marker': { spec: { id: 'PR-12' } }, signboard: {} }), PROPS.sign), 'zone-marker', 'Z3 가 다른 이름을 써도 id 로');
  assert.equal(propKind(world({ signboard: {} }), PROPS.sign), 'signboard', '없으면 안내판으로 임시');
  assert.equal(propKind(world({ signboard: {} }), PROPS.boxes), null, '이삿짐은 임시가 없다');
  assert.equal(propKind({ palette: k => (k === 'party-balloons' ? { a: 1 } : {}) }, PROPS.balloons), 'party-balloons', 'debug 가 없으면 palette 로');
});

test('주민 방: house:enter 의 주인 이름을 여러 키에서 받는다', () => {
  assert.equal(R.ownerOf({ owner: 'coco' }), 'coco');
  assert.equal(R.ownerOf({ slug: 'bori' }), 'bori');
  assert.equal(R.ownerOf({ villager: 'mochi' }), 'mochi');
  assert.equal(R.ownerOf({ house: { owner: 'dubu' } }), 'dubu');
  assert.equal(R.ownerOf({}), null, '플레이어 집');
  assert.equal(R.ownerOf({ owner: 'player' }), null);
  assert.equal(R.ownerOf(undefined), null);
});

test('섬: 7번째 집터는 비어 있고(집·우편함 없음, 계단 꺼짐) 길이 닿는다', () => {
  for (const seed of [20261028, 12345, 777, 2026]) {
    const g = generateIsland(seed, { ...ISLAND, villagers: VILLAGERS, lots });
    const houses = g.places.villagerHouses;
    assert.equal(houses.length, 7, `${seed}: 집터 7곳`);
    const lot = houses.find(h => h.slug === 'danpung');
    assert.ok(lot?.lot, `${seed}: 단풍 집터`);
    assert.equal(houses.filter(h => h.lot).length, 1);
    assert.ok(!g.objects.some(o => o.kind === 'house-villager' && o.data?.owner === 'danpung'), '처음엔 집이 없다');
    assert.ok(!g.objects.some(o => o.kind === 'mailbox' && o.data?.owner === 'danpung'), '우편함도 입주 뒤에');
    assert.equal(g.objects.filter(o => o.kind === 'house-villager').length, 6);
    assert.equal(lot.lot.pad.off, true);
    // 집 가운데 칸 = 집터 가운데 (objects.add 로 칸 가운데에 놓으면 생성기 자리와 같다)
    const api = createIslandApi(g);
    const c = api.toWorld(lot.lot.cx, lot.lot.cz);
    assert.ok(Math.abs(c.x - lot.x) < 1e-6 && Math.abs(c.z - lot.z) < 1e-6, '칸 가운데 = 집 가운데');
    // 계단이 꺼져 있으면 문 앞 높이가 땅 높이, 켜면 올라간다
    const y0 = api.heightAt(lot.x, lot.z + 1.35);
    lot.lot.pad.off = false;
    assert.ok(api.heightAt(lot.x, lot.z + 1.35) > y0, '계단을 켜면 높아진다');
    // 문 앞 칸 근처에 흙길
    const near = [];
    for (let dz = 0; dz <= 2; dz++) for (let dx = -1; dx <= 1; dx++) near.push(api.tileAt(lot.tx + dx, lot.tz + dz));
    assert.ok(near.includes('path'), `${seed}: 문 앞 길 ${near.join(',')}`);
  }
});

test('대사: 단풍 묶음이 다 있고, 주민 7명 생일 대사·편지, 밤톨 소식 편지', () => {
  const need = ['intro', 'greet.dawn', 'greet.morning', 'greet.afternoon', 'greet.evening', 'greet.night',
    'weather.clear', 'weather.cloudy', 'weather.rain', 'weather.snow', 'weather.rainbow',
    'season.spring', 'season.summer', 'season.autumn', 'season.winter',
    'tier.new', 'tier.known', 'tier.friend', 'tier.close', 'tier.best', 'chat', 'menu', 'goingHome',
    'request.ask', 'request.accept', 'request.decline', 'request.remind', 'request.notYet', 'request.thanks', 'request.reward', 'request.done',
    'gift.love', 'gift.like', 'gift.normal', 'gift.dislike', 'gift.many', 'gift.back', 'gift.surprise', 'gift.pending', 'gift.full', 'gift.cancel',
    'bye', 'tierUp.known', 'tierUp.friend', 'tierUp.close', 'tierUp.best', 'photo', 'home.day', 'home.rain', 'home.sleep',
    'chatting', 'banter', 'letters.friend', 'letters.close', 'letters.thanks', 'letters.gift', 'letters.moving', 'letters.movein'];
  const L = LINES.danpung;
  for (const p of need) assert.ok(get(L, p)?.length, `danpung.${p}`);
  assert.ok(/\{player/.test(L.intro[0]), '첫 줄에 {player} 자리');
  assert.ok(strings(L).length >= 100, `단풍 대사 ${strings(L).length}줄`);
  for (const s of L.banter) assert.ok(s.length <= 16, `말풍선이 길다 — ${s}`);
  const bday = ['birthday.self', 'birthday.door', 'birthday.cake', 'birthday.gift', 'birthday.player', 'letters.birthday', 'letters.playerBirthday'];
  for (const slug of VILLAGERS) {
    for (const p of bday) assert.ok(get(LINES[slug], p)?.length, `${slug}.${p}`);
    assert.ok(LINES[slug].birthday.cake.every(s => s.includes('{item')), `${slug}: 케이크 대사에 {item}`);
    for (const letter of [...LINES[slug].letters.birthday, ...LINES[slug].letters.playerBirthday]) assert.ok(Array.isArray(letter) && letter.length >= 2);
  }
  for (const k of ['lot', 'playerBirthday']) assert.ok(LINES.bamtol.letters[k]?.length, `bamtol.letters.${k}`);
  for (const slug of [...VILLAGERS, 'bamtol']) for (const s of strings(LINES[slug])) {
    for (const [, k] of s.matchAll(/\{(\w+)/g)) assert.ok(KEYS.has(k), `${slug}: 모르는 자리 {${k}} — ${s}`);
    assert.ok(s.length <= (slug === 'bamtol' ? 64 : 60), `${slug}: 한 줄이 너무 길다 (${s.length}) — ${s}`);
  }
});
