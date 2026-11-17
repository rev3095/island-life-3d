// M20-S1 첫 30분: 할 일 '어디로' 한 줄 · 처음 소개 카드 순서 · 놀이별 첫 소개 날
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../src/gameplay/intro/rules.js';
import * as T from '../src/gameplay/intro/tips.js';

const json = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('첫날 할 일마다 어디로 가면 되는지 한 줄', () => {
  for (const s of R.STEPS) assert.ok(R.whereFor(s.id).length > 4, s.id);
  assert.match(R.whereFor('reward'), /밤톨/);
  assert.match(R.whereFor('reward', { inside: true }), /집 밖/);
  assert.ok(R.STUCK.after > 60 && R.STUCK.max >= 1);
  assert.match(R.REWARD_TEXT, /1,000/);
});

test('처음 소개 카드: 하루에 하나, 날 순서대로', () => {
  assert.equal(T.introCardFor(0), null);
  assert.equal(T.introCardFor(1).id, 'journal');
  assert.equal(T.introCardFor(2, { seen: { journal: 'd' }, hour: 10 }), null);   // 밤 소개는 저녁에
  assert.equal(T.introCardFor(2, { seen: { journal: 'd' }, hour: 19 }).id, 'night');
  assert.equal(T.introCardFor(1, { has: k => k !== 'journal' }), null);
});

test('놀이별 첫 소개 날 (첫날 안내를 들은 날 + n일)', () => {
  const d = json('assets/daily/daily.json'), n = json('assets/night/night.json'), j = json('assets/journal/journal.json');
  assert.equal(d.opensAfterDay, 1);            // 유리병 둘째 날
  assert.equal(d.balloons.opensAfterDay, 2);   // 풍선 셋째 날
  assert.equal(d.peddler.opensAfterDay, 2);
  assert.equal(d.meteor.opensAfterDay, 3);     // 유성우 넷째 날
  assert.equal(n.opensAfterDay, 2);            // 밤 가게 셋째 날
  assert.equal(j.startsNextDay, true);         // 섬 일지 둘째 날
});
