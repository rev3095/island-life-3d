// 첫날 흐름 규칙 확인 (src/gameplay/intro/rules.js): 이름 다듬기·조사·이름 자리, 진행 기록, 예전 저장 추정, 안내 문구, 밤톨 대사.
// node --test tests/intro.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/gameplay/intro/rules.js';
import { fill } from '../src/gameplay/town/rules.js';
import LINES from '../src/gameplay/town/lines/index.js';
const BAMTOL = LINES.bamtol;   // 대사는 assets/villagers/bamtol.json (6차 M6-P3)
import { createState } from '../src/core/state.js';
import { createSave } from '../src/data/save.js';
import { fakeStorage } from './helpers.mjs';

test('조사: 이름 받침(한글·숫자·영어)에 맞춘다', () => {
  assert.equal(R.josa('윤슬', '아'), '윤슬아');
  assert.equal(R.josa('하늘', '이'), '하늘이');
  assert.equal(R.josa('다온', '은'), '다온은');
  assert.equal(R.josa('보라', '아'), '보라야');
  assert.equal(R.josa('보라', '이에요'), '보라예요');
  assert.equal(R.josa('포근섬', '에'), '포근섬에');
  assert.equal(R.josa('포근섬', '은'), '포근섬은');
  assert.equal(R.josa('포근섬', '으로'), '포근섬으로');
  assert.equal(R.josa('바다마을', '으로'), '바다마을로');   // ㄹ 받침은 '로'
  assert.equal(R.josa('라디오', '이랑'), '라디오랑');
  assert.equal(R.josa('하늘3', '이'), '하늘3이');           // 삼
  assert.equal(R.josa('하늘2', '이'), '하늘2가');           // 이
  assert.equal(R.josa('Mimi', '을'), 'Mimi를');             // 영어는 받침 없는 쪽
  assert.equal(R.josa('보라', '이다'), '보라다');
});

test('이름 자리: {player}·{island} 만 채우고 다른 자리는 그대로', () => {
  const names = { player: '윤슬', island: '몽글섬' };
  assert.equal(R.fillNames('{player} 씨, {island}에 온 걸 환영해요!', names), '윤슬 씨, 몽글섬에 온 걸 환영해요!');
  assert.equal(R.fillNames('{player:아}, {island:은} 어때?', names), '윤슬아, 몽글섬은 어때?');
  assert.equal(R.fillNames('{item:을} 줄게, {player:아}', names), '{item:을} 줄게, 윤슬아');
  assert.equal(R.fillNames('{player}', { player: '' }), '{player}');
  // town 의 fill 은 모르는 자리를 남기므로 둘을 차례로 써도 된다
  assert.equal(R.fillNames(fill('{item:은} {player} 씨 거예요', { item: '라디오' }), names), '라디오는 윤슬 씨 거예요');
  assert.deepEqual(R.namesOf(createState()), R.DEFAULT_NAMES);
  const s = createState(); s.player.name = '다온'; s.island.name = '별빛섬';
  assert.deepEqual(R.namesOf(s), { player: '다온', island: '별빛섬' });
});

test('플레이어 이름: 빈칸 정리·글자 수·쓸 수 있는 글자', () => {
  assert.deepEqual(R.checkPlayerName('  하늘  별 '), { ok: true, value: '하늘 별', error: null });
  assert.equal(R.checkPlayerName('').error, '이름을 적어 주세요');
  assert.equal(R.checkPlayerName('   ').ok, false);
  assert.equal(R.checkPlayerName('ㅎㅎ').error, '글자를 끝까지 완성해 주세요');
  assert.equal(R.checkPlayerName('하늘ㅂ').ok, false);
  assert.equal(R.checkPlayerName('<b>').error, '한글·영어·숫자만 쓸 수 있어요');
  assert.equal(R.checkPlayerName('{player}').ok, false);   // 이름 자리 표시가 끼어들지 않게
  assert.equal(R.checkPlayerName('가나다라마바사아').ok, true);        // 8글자
  assert.equal(R.checkPlayerName('가나다라마바사아자').error, '8글자까지 쓸 수 있어요');
  assert.equal(R.checkPlayerName('Mimi 2').ok, true);
});

test('섬 이름: 끝의 섬은 하나만, 글자 수는 섬 앞까지', () => {
  assert.deepEqual(R.checkIslandName('포근'), { ok: true, base: '포근', value: '포근섬', error: null });
  assert.equal(R.checkIslandName('포근섬').value, '포근섬');
  assert.equal(R.checkIslandName(' 달빛 섬 ').value, '달빛섬');
  assert.equal(R.checkIslandName('섬').value, '섬섬');                  // '섬' 하나만 적으면 그대로 이름
  assert.equal(R.checkIslandName('무지개구름').ok, true);
  assert.equal(R.checkIslandName('무지개구름빛섬').value, '무지개구름빛섬'); // 6글자 + 섬
  assert.equal(R.checkIslandName('무지개구름빛깔').error, '6글자까지 쓸 수 있어요');
  assert.equal(R.checkIslandName('').error, '섬 이름을 적어 주세요');
  assert.equal(R.countChars('별빛'), 2);
});

test('추천 이름: 목록 안에서, 지금 이름은 피한다', () => {
  let i = 0;
  const r = () => [0, 0.99][i++ % 2];
  const a = R.suggest('player', r), b = R.suggest('player', r);
  assert.ok(R.SUGGEST.player.includes(a) && R.SUGGEST.player.includes(b));
  for (let k = 0; k < 20; k++) assert.notEqual(R.suggest('island', Math.random, '포근'), '포근');
  for (const n of [...R.SUGGEST.player]) assert.ok(R.checkPlayerName(n).ok, n);
  for (const n of [...R.SUGGEST.island]) assert.ok(R.checkIslandName(n).ok, n);
});

test('진행 기록: 빈 칸 채우기·한 번만 끝내기·지금 할 일·다 마침', () => {
  const s = createState();
  const p = R.progressOf(s);
  assert.equal(s.flags.firstday, p);
  assert.deepEqual(p.done, {});
  assert.equal(R.currentStep(p).id, 'intro');
  assert.equal(R.markDone(p, 'tool', '2026-10-29'), true);
  assert.equal(R.markDone(p, 'tool', '2026-10-29'), false);
  assert.equal(R.markDone(p, 'fly', '2026-10-29'), false);
  assert.equal(R.currentStep(p).id, 'intro');     // 순서와 상관없이 기록되고, 지금 할 일은 맨 앞 빈칸
  R.markDone(p, 'intro');
  assert.equal(p.done.intro, true);
  assert.equal(R.currentStep(p).id, 'gather');
  assert.equal(R.doneCount(p), 2);
  for (const id of R.STEP_IDS) R.markDone(p, id, 'd');
  assert.equal(R.allDone(p), true);
  assert.equal(R.currentStep(p), null);
  assert.equal(R.rewardPending(p), false);
  p.finished = 'd';
  assert.equal(R.rewardPending(p), true);
  assert.equal(R.viewOf(p).current, 'reward');
  assert.equal(R.viewOf(p).reward, true);
  p.rewarded = true;
  assert.equal(R.viewOf(p).current, null);
  // 망가진 기록은 다시 만든다
  s.flags.firstday = 'oops';
  assert.deepEqual(R.progressOf(s).done, {});
});

test('예전 저장 추정: 한 것만 건너뛰고, 오래 한 저장은 다 한 것으로', () => {
  const fresh = createState();
  fresh.inventory[0] = { id: 'tool.rod', count: 1, uses: 30 };
  assert.deepEqual(R.inferDone(fresh), { done: [], veteran: false });
  fresh.flags.intro = true;
  assert.deepEqual(R.inferDone(fresh).done, ['intro']);
  fresh.inventory[1] = { id: 'fruit.apple', count: 2 };
  assert.deepEqual(R.inferDone(fresh).done, ['intro', 'gather']);
  fresh.player.tool = 'net';
  assert.deepEqual(R.inferDone(fresh).done, ['intro', 'tool', 'gather']);

  const vet = createState();
  vet.flags.intro = true;
  vet.encyclopedia.fish.push('fish.crucian');
  vet.museum.fossil.push('fossil.ammonite');
  assert.equal(R.inferDone(vet).veteran, false);            // 집에 안 들어가 봤다
  assert.deepEqual(R.inferDone(vet).done, ['intro', 'tool', 'gather', 'catch', 'donate']);
  vet.house.seeded = true;
  const v = R.inferDone(vet);
  assert.equal(v.veteran, true);
  assert.deepEqual(v.done, R.STEP_IDS);
});

test('안내 문구: 단계마다 키보드·터치가 다르고, 형편에 맞춰 덧붙인다', () => {
  for (const s of [...R.STEPS, { id: 'reward' }]) {
    const k = R.hintFor(s.id), t = R.hintFor(s.id, { touch: true });
    assert.ok(k && t, s.id);
    if (s.id !== 'tool') assert.ok(/Space|F|0/.test(k) && !/Space|\bF로/.test(t), `${s.id}: ${k} / ${t}`);
  }
  assert.match(R.hintFor('tool'), /숫자키 1·2/);
  assert.match(R.hintFor('tool', { touch: true }), /도구 단추/);
  assert.match(R.hintFor('gather', { touch: true }), /A를 누르면.*B로 주워요/);
  assert.match(R.hintFor('sell', { shopOpen: false }), /문을 닫았어도 오늘은 문 앞에서 밤톨이/);   // 7차 D51-A
  assert.match(R.hintFor('sell', { canSell: false, shopOpen: false }), /먼저 팔 걸/);
  assert.doesNotMatch(R.hintFor('sell', { canSell: false, shopOpen: false }), /문을 닫았어도/);
  assert.match(R.hintFor('donate', { canDonate: false }), /하나 더 잡아 와요/);
  assert.match(R.hintFor('reward', { inside: true }), /집에서 나와 보면/);
  assert.equal(R.hintFor('nope'), '');
});

test('밤톨 대사: 이름 자리·첫날 묶음이 있고, 채우면 자리 표시가 남지 않는다', () => {
  const names = { player: '윤슬', island: '몽글섬' };
  const all = JSON.stringify(BAMTOL);
  const keys = new Set([...all.matchAll(/\{(\w+)(?::[^}]*)?\}/g)].map(m => m[1]));
  assert.deepEqual([...keys].sort(), ['furn', 'island', 'item', 'player']);
  for (const k of ['hello', 'keys', 'touch', 'after', 'list', 'bye']) assert.ok(BAMTOL.intro[k]?.length, k);
  for (const k of ['sell', 'visit', 'done', 'after', 'full', 'again']) assert.ok(BAMTOL.firstday[k]?.length, k);
  assert.ok(BAMTOL.intro.hello.some(l => l.includes('{player}')) && BAMTOL.intro.hello.some(l => l.includes('{island}')));
  assert.ok(!all.includes('포근섬'), '섬 이름은 {island} 자리로');
  const vars = { ...names, item: '라디오', furn: '소파' };
  for (const l of [...Object.values(BAMTOL.intro).flat(), ...Object.values(BAMTOL.firstday).flat(), ...BAMTOL.letters.welcome.flat()]) {
    const out = R.fillNames(fill(l, vars), names);
    assert.doesNotMatch(out, /[{}]/, l);
  }
  assert.equal(fill(BAMTOL.intro.hello[2], names), '오늘부터 몽글섬은 윤슬 씨의 섬이기도 해요. 먼저 몸 움직이는 법부터 알려 줄게요!');
  // 터치 안내에 키보드 키 이름이 없다
  assert.ok(BAMTOL.intro.touch.every(l => !/Space|Shift|WASD|\bF로/.test(l)));
});

test('저장: 이름·첫날 기록이 남고, 새로 시작하면 지워진다', () => {
  const storage = fakeStorage();
  const state = createState();
  const save = createSave({ state, storage });
  state.player.name = '윤슬';
  state.island.name = '몽글섬';
  const p = R.progressOf(state);
  R.markDone(p, 'intro', '2026-10-29');
  R.markDone(p, 'tool', '2026-10-29');
  assert.equal(save.save(), true);

  const again = createState();
  const load = createSave({ state: again, storage });
  assert.equal(load.load(), true);
  assert.equal(again.player.name, '윤슬');
  assert.equal(again.island.name, '몽글섬');
  assert.deepEqual(Object.keys(again.flags.firstday.done), ['intro', 'tool']);
  assert.equal(R.currentStep(R.progressOf(again)).id, 'gather');

  load.reset();
  assert.equal(again.player.name, '');
  assert.equal(again.island.name, undefined);
  assert.equal(again.flags.firstday, undefined);
});
