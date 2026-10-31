// 7차 M7-P5 첫날 안내·힌트 확인 (src/gameplay/intro/tips.js · rules.js): 힌트 표 모양, 진짜 판정(judge.js)에서 막힌 것 고르기,
// 단계별로 한 번씩만 보이기, 친해지기 정도(QA-13), 밤에 닫힌 상점 건너뛰기(QA-09), 저장, 섬폰 「안내」 줄, 장면 층 클릭 막힘.
// node --test tests/tips.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../src/gameplay/intro/tips.js';
import * as R from '../src/gameplay/intro/rules.js';
import { judge, withVillagers } from '../src/gameplay/festival/judge.js';
import { VILLAGERS } from '../src/gameplay/town/people.js';
import { TIERS } from '../src/gameplay/town/rules.js';
import { createState } from '../src/core/state.js';
import { createSave } from '../src/data/save.js';
import { fakeStorage } from './helpers.mjs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RULES = withVillagers(JSON.parse(read('assets/emotes/talk.json')), VILLAGERS);
const FEST = JSON.parse(read('assets/festival/config.json'));
const ruleOf = slug => RULES.villagers[slug].rule;
/** 진짜 판정으로 한 번 보내고 → { kind, ids(걸린 힌트), conv(다음 대화 상태) } */
function send(slug, keys, conv = {}) {
  const res = judge(RULES, slug, keys, { dayKey: '2026-11-01', want: null, waited: !!conv.waited, greeted: !!conv.greeted });
  return { kind: res.kind, ids: T.missesOf(ruleOf(slug), res.keys, res.kind, conv), conv: T.nextConv(conv, ruleOf(slug), res.keys, res.kind) };
}

test('힌트 표: 아이콘·제목·단계(after 오름차순)가 있고, 자리를 채우면 { } 가 남지 않는다', () => {
  const vars = { name: '두부', greet: '👋 · 💗', player: '윤슬', island: '몽글섬' };
  for (const [id, tip] of Object.entries(T.TIPS)) {
    assert.ok(tip.icon && tip.title, id);
    assert.ok(tip.steps.length >= 1, id);
    tip.steps.forEach((s, i) => { if (i) assert.ok(s.after > tip.steps[i - 1].after, `${id} 단계 순서`); });
    for (let i = 0; i < tip.steps.length; i++) {
      const v = T.tipText(id, i, vars);
      assert.doesNotMatch(v.title + v.text, /[{}]/, id);
      if (!tip.live) assert.ok(v.text.length > 10, `${id} 글`);
      assert.doesNotMatch(T.tipText(id, i, vars, { touch: true }).text, /Space/, `${id} 터치 글에 키 이름`);
    }
  }
  // 받침에 맞는 조사
  assert.equal(T.tipText('waitFirst', 0, { name: '두부' }).title, '두부는 기다려 주는 걸 좋아해요');
  assert.match(T.tipText('greetFirst', 0, { name: '단풍', greet: '👋' }).title, /^단풍은 /);
  assert.ok(T.SHORT_INTRO.every(l => !/[{}]/.test(R.fillNames(l, { player: '윤슬', island: '몽글섬' }))));
});

test('두부(기다리기 먼저, QA-05): 인사만 보내면 waitFirst, 셋이면 waitFirstMany, ⏳ 하나면 풀림', () => {
  let r = send('dubu', ['wave', 'smile']);
  assert.ok(['puzzled', 'awkward'].includes(r.kind), r.kind);
  assert.deepEqual(r.ids, ['waitFirst']);
  r = send('dubu', ['wait', 'smile']);            // 힌트 + 다른 것 (QA: 12일 걸리던 방식)
  assert.deepEqual(r.ids, ['waitFirst']);
  assert.deepEqual(send('dubu', ['wave', 'smile', 'heart']).ids, ['waitFirstMany']);
  r = send('dubu', ['wait']);                     // 기다리기 하나
  assert.equal(r.kind, 'happy');
  assert.deepEqual(r.ids, []);
  assert.equal(r.conv.waited, true);
  assert.deepEqual(send('dubu', [], {}).ids, [], '빈 보내기도 기다리기');
  // 기다려 준 다음엔 다른 이모티콘에 waitFirst 힌트를 내지 않는다
  r = send('dubu', ['fish', 'good'], { waited: true });
  assert.ok(!r.ids.includes('waitFirst'));
});

test('모찌·보리·코코: 인사 먼저 / 하나만 / 셋 이어서 — 진짜 판정에서 걸린다', () => {
  assert.deepEqual(send('mochi', ['fish']).ids, ['greetFirst']);
  assert.deepEqual(send('mochi', ['wave']).ids, []);
  assert.deepEqual(send('mochi', ['fish'], { greeted: true }).ids.includes('greetFirst'), false);
  assert.ok(send('bori', ['wave', 'smile', 'heart']).ids.includes('fewer'));
  assert.deepEqual(send('bori', ['smile']).ids.includes('fewer'), false);
  const c = send('coco', ['wave']);
  if (c.kind === 'puzzled') assert.deepEqual(c.ids, ['more']);
  assert.deepEqual(send('coco', ['wave', 'smile', 'heart']).ids, []);
  // 규칙이 없는 갸웃은 두 번째부터 💭 일반 힌트
  assert.deepEqual(T.missesOf({}, ['wave'], 'puzzled', {}), []);
  assert.deepEqual(T.missesOf({}, ['wave'], 'puzzled', { puzzled: 1 }), ['puzzled']);
});

test('막힌 횟수: 단계마다 한 번만 보이고, 풀리면 그 주민 힌트는 그만', () => {
  const t = T.tipsOf({});
  const a = T.miss(t, 'waitFirst', 'dubu');
  assert.deepEqual([a.key, a.step], ['waitFirst:dubu', 0]);
  T.markSeen(t, a, '2026-11-01', 1);
  assert.equal(T.miss(t, 'waitFirst', 'dubu'), null, '2번째는 조용히');
  const b = T.miss(t, 'waitFirst', 'dubu');
  assert.equal(b.step, 1, '3번째에 더 또렷한 단계');
  T.markSeen(t, b, '2026-11-01', 2);
  assert.equal(T.miss(t, 'waitFirst', 'dubu'), null);
  assert.equal(t.miss['waitFirst:dubu'], 3, '끝 단계를 본 뒤엔 더 세지 않는다');
  assert.equal(T.miss(t, 'waitFirst', 'mochi').key, 'waitFirst:mochi', '주민마다 따로');
  T.solved(t, 'mochi');
  assert.equal(T.miss(t, 'waitFirst', 'mochi'), null);
  assert.equal(t.off['heart:mochi'], undefined, '친해지기 정도는 끄지 않는다');
  // 주민이 없는 힌트는 하나 (밤 상점)
  const n = T.miss(t, 'night', 'dubu');
  assert.deepEqual([n.key, n.slug], ['night', null]);
  T.markSeen(t, n, '2026-11-01', 3);
  for (let i = 0; i < 5; i++) assert.equal(T.miss(t, 'night'), null);
  assert.deepEqual(T.seenList(t).map(x => x.key), ['night', 'waitFirst:dubu'], '새 것부터');
  assert.equal(T.miss(t, 'nope'), null);
});

test('친해지기 정도 (QA-13): 축제 설정 parts.open · rules.json tiers 로 n/30 · n/2', () => {
  const open = FEST.parts.open;
  const need = TIERS.find(([id]) => id === open.tier)[1];
  let p = T.heartProgress({ friendship: 22.6, emote: { wins: 1 } }, open, TIERS);
  assert.deepEqual(p, { friendship: 22, need, wins: 1, needWins: open.wins, open: false });
  assert.match(T.heartText('두부', p), new RegExp(`두부와 .*친밀도 22/${need} · 이모티콘 대화 성공 1/${open.wins}`));
  p = T.heartProgress({ friendship: need, emote: { wins: 0 } }, open, TIERS);
  assert.doesNotMatch(T.heartText('코코', p), /친밀도/);
  assert.match(T.heartText('코코', p), /코코와 .*성공 0\//);
  p = T.heartProgress({ friendship: need + 5, emote: { wins: 9 } }, open, TIERS);
  assert.equal(p.open, true);
  assert.match(T.heartText('퐁', p), /마음이 통했어요/);
  assert.equal(T.heartProgress(undefined, open, TIERS).friendship, 0);
});

test('첫날 할 일: 밤에 상점이 닫히면 팔기를 미루고 다음 할 일부터 (QA-09), 다 했거나 건너뛰면 밤톨에게 알려 주기만', () => {
  const p = R.progressOf({});
  for (const id of ['intro', 'tool', 'gather', 'catch']) R.markDone(p, id);
  let v = R.viewOf(p, { blocked: ['sell'] });
  assert.equal(v.current, 'donate');
  assert.equal(v.ahead, true);
  assert.equal(R.viewOf(p).current, 'sell', '열려 있으면 순서대로');
  R.markDone(p, 'donate'); R.markDone(p, 'home');
  v = R.viewOf(p, { blocked: ['sell'] });
  assert.equal(v.current, 'sell', '남은 게 팔기뿐이면 팔기');
  assert.equal(v.ahead, false);
  // 건너뛰기 (index.js skipRest): 다 안 했어도 finished → 밤톨에게 알려 주기만
  const q = R.progressOf({});
  R.markDone(q, 'intro');
  q.finished = '2026-10-31'; q.skipped = '2026-10-31';
  v = R.viewOf(q);
  assert.equal(v.current, 'reward');
  assert.equal(v.steps.filter(s => s.current).length, 0);
  assert.equal(R.rewardPending(q), true);
});

test('저장: 힌트 기록·건너뛰기·안내 짧게가 남는다', () => {
  const storage = fakeStorage();
  const state = createState();
  const save = createSave({ state, storage });
  state.player.name = '윤슬';
  const p = R.progressOf(state);
  p.skip = 'short'; p.skipped = '2026-10-31'; p.finished = '2026-10-31';
  const t = T.tipsOf(state);
  T.markSeen(t, T.miss(t, 'waitFirst', 'dubu'), '2026-10-31', 5);
  assert.equal(save.save(), true);
  const again = createState();
  assert.equal(createSave({ state: again, storage }).load(), true);
  assert.equal(again.flags.firstday.skip, 'short');
  assert.equal(again.flags.firstday.skipped, '2026-10-31');
  assert.deepEqual(T.seenList(T.tipsOf(again)).map(x => [x.id, x.slug, x.step]), [['waitFirst', 'dubu', 0]]);
});

test('섬폰: 「안내」 줄은 intro 가 ui.guide 를 채웠을 때만', async () => {
  const { APPS, visibleApps } = await import('../src/ui/phone.js');
  const g = APPS.find(a => a.id === 'guide');
  assert.equal(g?.panel, 'guide');
  assert.equal(visibleApps({}).some(a => a.id === 'guide'), false);
  assert.equal(visibleApps({ guide: { open() {} } }).some(a => a.id === 'guide'), true);
  const src = read('src/gameplay/intro/index.js');
  assert.match(src, /ui\.guide = \{ open: \(\) => openGuide\(ctx, guideSrc\) \}/);
});

test('장면 층(.st-root)은 장면 중이 아니면 클릭을 막지 않는다 (index.html 의 #ui > * 규칙보다 세게)', () => {
  assert.match(read('index.html'), /#ui > \* \{ pointer-events: auto; \}/);
  assert.match(read('src/gameplay/story/story.css'), /#ui > \.st-root:not\(\.is-on\) \{ pointer-events: none; \}/);
  // #ui 바로 밑에 화면 전체를 덮는 층을 붙이는 모듈은 같은 식으로 풀어 둔다
  assert.match(read('src/gameplay/intro/intro.css'), /#ui > \.fd-root \{ pointer-events: none; \}/);
});
