// 축제까지 며칠 (M17-P3 · D41-A · D186-A): tools/festival-pace.mjs 의 순수 계산으로 「보통 플레이어 5~7일」을 지킨다.
// 숫자(assets/festival/config.json parts.open · assets/data/rules.json town · assets/emotes/talk.json)를 바꿔 이 테스트가 걸리면
// node tools/festival-pace.mjs 로 표를 보고 다시 맞춘다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadNumbers, simulate, simulateAll } from '../tools/festival-pace.mjs';

const N = loadNumbers();
const all = simulateAll(N);

test('축제(엔딩)까지: 보통 플레이어 5~7일째 (D41-A)', () => {
  const d = all.normal.festivalDay;
  assert.ok(d >= 5 && d <= 7, `보통 ${d}일째`);
});

test('잘하는 사람(편지·선물 많이)도 5일째보다 빠르지 않고, 처음 하는 사람은 9일 안', () => {
  assert.ok(all.skilled.festivalDay >= 5, `잘하는 사람 ${all.skilled.festivalDay}일째`);
  assert.ok(all.novice.festivalDay <= 9, `처음 하는 사람 ${all.novice.festivalDay}일째`);
  assert.ok(all.skilled.festivalDay <= all.normal.festivalDay && all.normal.festivalDay <= all.novice.festivalDay, '빠른 순서');
});

test('빠른 사람을 붙잡는 것은 마음이 통한 일 수 (하루 이모티콘 3번 상한): wins 를 예전 2로 두면 4일째로 당겨진다', () => {
  const old = structuredClone(N); old.letter = N.letter;
  old.parts.open.wins = 2;
  assert.ok(simulate('skilled', old).festivalDay < all.skilled.festivalDay);
  // 예전 숫자 (talkBonus 2 · wins 2) = 보통 7일째 · 잘하는 사람 4일째 — 노트 docs/notes/m17-p3-balance.md 전/후 표
  old.town.talkBonus = 2;
  assert.deepEqual([simulate('normal', old).festivalDay, simulate('skilled', old).festivalDay], [7, 4]);
});

test('모든 부품 주민이 maxDays 안에 마음을 연다 (막힘 없음)', () => {
  for (const r of Object.values(all)) for (const [slug, v] of Object.entries(r.byVillager)) assert.ok(v.openDay != null && v.partDay != null, `${r.profile} ${slug}`);
});
