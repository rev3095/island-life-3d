// 주민 데이터 (6차 M6-P3): assets/villagers/<slug>.json ↔ town 이 읽는 모양 · 이모티콘 규칙 · 생일 · 반영 도구 · 편집기 게시 목록
import { test } from 'node:test';
import { EVENT_GOODS, EVENT_FURN } from '../src/data/event-items.js';
import { DECOR_FURN, FAVOR_FURN } from '../src/data/decor-items.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { posix } from 'node:path';
import * as R from '../src/gameplay/town/rules.js';
import { PEOPLE, KEEPERS, LINES, VILLAGERS } from '../src/gameplay/town/people.js';
import { VILLAGER_FILES } from '../src/gameplay/town/files.js';
import { toPerson, checkVillager, linePools, GESTURES, RULE_FLAGS } from '../src/gameplay/town/traits.js';
import * as J0 from '../src/gameplay/festival/judge.js';
import * as items from '../src/data/items.js';
import * as BD from '../src/data/birthdays.js';
import { RULES as TABLE } from '../src/data/tables.js';
import { VILLAGERS as RESIDENTS, NEWCOMERS } from '../src/core/constants.js';
import { plan, formatJSON, checkEnv } from '../tools/apply-traits.mjs';
import { diffTables } from '../tools/edits.mjs';
import { scanModule, planWeb } from '../tools/build-web.mjs';

const ROOT = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), 'utf8');
const readJSON = p => JSON.parse(read(p));
const TALK = readJSON('assets/emotes/talk.json');
const EM = readJSON('assets/emotes/emotes.json');
const T = J0.withVillagers(TALK, VILLAGERS);
const J = { ...J0, keys: EM.emotes.map(e => e.key), player: EM.emotes.filter(e => e.cat !== 'reply').map(e => e.key) };
const ENV = await checkEnv();
// 10차 이사 오는 주민(파일 arrives: 'moving' — 구름·파도·달무리): 처음 섬 주민 목록(constants VILLAGERS)에 없어도 주민 파일·규칙·생일은 있다
const MOVERS = VILLAGERS.filter(d => d.arrives === 'moving' && !RESIDENTS.includes(d.slug)).map(d => d.slug);
const ALL_RES = [...RESIDENTS, ...MOVERS];

// ---------- 지문 (주민마다 데이터·결과를 한 줄 글로 → sha256 앞 16자) ----------
const TOUR_IDS = ['fish.rainbow-wrasse', 'fish.flower-scorpionfish', 'bug.jewel-beetle', 'bug.moon-moth', 'fruit.mango', 'fruit.lychee', 'mat.gold-ore', 'mat.crystal', 'mat.tour-ticket'];   // P35 무인도 투어 아이템도 지문에서 뺀다
const EVENT_IDS = new Set([...TOUR_IDS, ...EVENT_GOODS.map(([slug]) => `event.${slug}`), ...EVENT_FURN.map(([slug]) => `furn.${slug}`), ...DECOR_FURN.map(([slug]) => `furn.${slug}`), ...FAVOR_FURN.map(([slug]) => `furn.${slug}`)]);   // 9차 야외 가구 · 10차 좋아하는 가구도 지문에서 뺀다
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const dayOf = d => new Date(Date.UTC(2026, 0, 1) + d * 86400000).toISOString().slice(0, 10);

/** 주민 한 명의 결과 기록: 선물 반응 · 부탁 · 보상 · 답례 · 일과 · 인사/잡담 고르기 · 이모티콘 판정 */
function playLog(slug, { P, L, T, R, J, items }) {
  // 8차 행사 아이템(event-items.js — 행사 채집·보상 가구)은 빼고 뜬다: 목록 순번으로 고르는 칸이 많아 아이템이 늘면 모든 지문이 바뀌기 때문 (행동은 그대로)
  const out = [], all = items.ITEMS.filter(it => !EVENT_IDS.has(it.id)), n = all.length;
  if (!P.wants) return '';   // 가게 주인: 데이터 지문만
  out.push(all.map(it => R.giftReaction(P, it)).join(','));
  for (let d = 0; d < 120; d++) out.push(canon(R.makeRequest(P, { dayKey: dayOf(d * 3), items, nativeFruit: d % 2 ? 'fruit.peach' : 'fruit.pear' })));
  for (let i = 0; i < 60; i++) out.push(canon(R.requestReward(P, i % 5 ? all[(i * 37) % n] : null, R.rngOf('reward', slug, i))));
  const v = R.villagerState({}, slug);
  for (let d = 0; d < 60; d++) {
    const dayKey = dayOf(d);
    if (d % 4 === 0) R.addFriendship(v, 9);
    out.push(R.surpriseGift(v, P, dayKey, R.rngOf('surprise', slug, d)));
    for (let g = 0; g < 3; g++) {
      const res = R.receiveGift(v, P, all[(d * 7 + g * 13) % n], dayKey, d % 9 ? 1 : 3);
      out.push(canon(res), R.giftBack(v, P, res.reaction, dayKey, R.rngOf('back', slug, d, g)));
    }
  }
  for (let d = 0; d < 40; d++) {
    let bits = '';
    for (let h = 5; h < 29; h += 0.25) for (const w of ['clear', 'rain', 'snow']) bits += R.shouldBeOut(P, { hourF: h % 24, dayKey: dayOf(d * 5) }, w) ? 1 : 0;
    out.push(bits);
  }
  if (L?.greet) {
    const recent = [];
    let i = 0;
    for (const hourF of [6, 9, 14, 18, 22, 2]) for (const weather of ['clear', 'cloudy', 'rain', 'snow', 'rainbow']) for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const tier of ['new', 'known', 'friend', 'close', 'best']) {
      const c = { now: { hourF, dayKey: dayOf(i) }, weather, season, tier, r: R.rngOf('lines', slug, i++), recent };
      out.push(R.greetingLines(L, c).join('/'), R.chatLines(L, c).join('/'));
    }
  }
  const E = T.villagers[slug];
  if (E) {
    const keys = J.keys, player = J.player;
    for (const d of [0, 101, 222]) {
      const dayKey = dayOf(d), r = R.rngOf('emote', slug, d);
      const sends = [...keys.map(k => [k]), ...player.flatMap(a => player.map(b => [a, b])), ...Array.from({ length: 300 }, () => [0, 1, 2].map(() => player[Math.floor(r() * player.length)])), []];
      const ctxs = [{ dayKey }, { dayKey, greeted: true, waited: true }, { dayKey, weather: 'rain' }, { dayKey, want: null, lastSaid: ['dots', 'think'] }];
      for (const c of ctxs) out.push(sends.map(s => { const x = J.judge(T, slug, s, c); return `${x.kind}${x.points}${x.reply.join('.')}${x.gesture}${(x.hint ?? []).join('.')}${x.flags.join('.')}${+x.greeted}${+x.waited}${x.want}`; }).join(','));
    }
    out.push(Array.from({ length: 365 }, (_, d) => J.wantOf(E, slug, dayOf(d))).join(','));
  }
  return out.join('\n');
}

// 8차 행사 대사(lines.event — 행사 기간에만 고른다)도 빼고 뜬다: 행사가 없는 날의 대사 고르기는 그대로라 (playLog 는 event 없이 고른다)
const withoutEvent = L => { if (!L?.event) return L; const { event, ...rest } = L; return rest; };

/** D = { PEOPLE, KEEPERS, LINES, T(이모티콘 규칙: talk.json + 주민 규칙), R(town/rules.js), J({judge, wantOf, greetOf, tutorialOk, keys, player}), items(data/items.js), BD(data/birthdays.js) } */
function fingerprint(D) {
  const { PEOPLE, KEEPERS, LINES, T, R, J, BD } = D;
  const out = {};
  for (const [slug, P] of [...Object.entries(PEOPLE), ...Object.entries(KEEPERS)]) {
    const L = LINES[slug];
    out[slug] = {
      data: sha([canon(P), JSON.stringify(Object.keys(P.haunts ?? {})), canon(withoutEvent(L)), canon(T.villagers[slug] ?? null)].join('|')),
      play: sha(playLog(slug, { ...D, P, L })),
    };
  }
  const shared = [JSON.stringify([Object.keys(PEOPLE), Object.keys(KEEPERS), Object.keys(LINES)])];
  shared.push(canon([R.FRIEND_MAX, R.TIERS, R.TALK_BONUS, R.GIFT_POINTS, R.GIFTS_COUNTED_PER_DAY, R.REQUEST_POINTS, R.REQUEST_DAYS, R.CAT_LABEL, R.LETTERS_PER_DAY]));
  const { villagers, version, status, note, ...common } = T;   // talk.json 의 version·설명 글은 지문에서 뺀다
  shared.push(canon(common));
  for (const slot of ['dawn', 'morning', 'afternoon', 'evening', 'night']) for (const weather of ['clear', 'rain', 'snow']) for (const tier of ['new', 'friend', 'best']) shared.push(J.greetOf(T, 'coco', { slot, weather, tier }).join('.'));
  for (let i = 0; i < T.tutorial.length; i++) shared.push(J.keys.map(k => +J.tutorialOk(T, i, [k])).join(''));
  const state = { town: { birthdays: { danpung: '10-12' } }, villagers: {} };
  for (const slug of Object.keys(PEOPLE)) shared.push(slug + Array.from({ length: 731 }, (_, d) => +BD.isBirthday(slug, dayOf(d + 365), state)).join('') + BD.birthdayOf(slug, state));
  const st = { villagers: {} };
  Object.keys(PEOPLE).forEach((slug, i) => { const v = R.villagerState(st, slug); v.met = i !== 3; v.friendship = [5, 35, 65, 95, 40, 70, 20][i % 7]; });
  for (let d = 0; d < 60; d++) {
    const dayKey = dayOf(d);
    if (d % 7 === 2) st.villagers.bori.doneDay = dayKey;
    const plan = R.planLetters(st, PEOPLE, dayKey);
    for (const p of plan) if (p.mark) st.villagers[p.from].thankedDay = p.mark;
    shared.push(canon(plan));
  }
  out.shared = sha(shared.join('\n'));
  return out;
}

// ---------- 테스트 ----------

test('주민 파일: 폴더 = files.js 목록, 이름 = 파일 이름, 주민 7 · 가게 주인 2, 순서 = 주민 순서', () => {
  const inDir = readdirSync(new URL('assets/villagers/', ROOT)).filter(f => f.endsWith('.json') && f !== 'editor-files.json').map(f => `assets/villagers/${f}`).sort();
  assert.deepEqual([...VILLAGER_FILES].sort(), inDir, 'assets/villagers/ 의 파일과 src/gameplay/town/files.js 가 다르다 (웹 빌드는 files.js 글자로 묶는다)');
  VILLAGERS.forEach((d, i) => assert.equal(VILLAGER_FILES[i], `assets/villagers/${d.slug}.json`));
  assert.deepEqual(Object.keys(PEOPLE), ALL_RES, '주민 순서 = core/constants.js VILLAGERS (편지·목록 순서) + 이사 오는 주민');
  assert.deepEqual(Object.keys(KEEPERS), ['bamtol', 'neuru']);
  assert.deepEqual(Object.keys(LINES), [...ALL_RES, 'bamtol', 'neuru']);
  const models = readJSON('assets/models/index.json').models;
  for (const d of VILLAGERS) assert.equal(models.find(m => m.slug === d.slug)?.id, d.id, `${d.slug}: 캐릭터 ID 가 모델 목록과 같다`);
});

test('주민 파일 검사: 모두 통과 (편집기 「확인」 · 반영 도구와 같은 검사)', () => {
  for (const d of VILLAGERS) assert.deepEqual(checkVillager(d, ENV), [], `${d.slug}: ${JSON.stringify(checkVillager(d, ENV))}`);
  for (const P of Object.values(PEOPLE)) assert.deepEqual(toPerson(VILLAGERS.find(d => d.slug === P.slug)), P);
  // 검사가 실제로 잡는지
  const bad = structuredClone(VILLAGERS[0]);
  bad.gifts.loves.push('fruit.nope'); bad.emote.likes.push('nope'); bad.lines.bye = []; bad.lines.chat.push('{itme:을} 줘'); bad.schedule.sleep = 8; bad.emote.gesture.happy = 'spin';
  bad.roam.haunts.moon = 1; bad.birthday.path = 'birthdays/dates/bori'; bad.emote.rule.flyFirst = true;
  const why = checkVillager(bad, ENV).map(b => `${b.path} ${b.why}`).join('\n');
  for (const s of ['gifts/loves', 'emote/likes', 'lines/bye', '{itme}', 'schedule/sleep', 'emote/gesture/happy', 'roam/haunts/moon', 'birthday', 'emote/rule/flyFirst']) assert.ok(why.includes(s), `못 잡음: ${s}\n${why}`);
});

test('한 곳만 정답: 이모티콘 주민 규칙은 주민 파일에만, 생일은 rules.json 에만 (주민 파일은 가리키기만)', () => {
  assert.equal(TALK.villagers, undefined, 'talk.json 에 주민 칸이 남아 있다 — 주민 규칙은 assets/villagers/<slug>.json 의 emote');
  assert.deepEqual(Object.keys(T.villagers), ALL_RES);
  for (const d of VILLAGERS.filter(x => x.role === 'villager')) {
    assert.ok(d.birthday.path === `birthdays/dates/${d.slug}` && d.slug in TABLE.birthdays.dates, `${d.slug}: 생일 칸`);
    assert.ok(!('date' in d.birthday) && !('mmdd' in d.birthday), '주민 파일에 생일 날짜를 적지 않는다');
  }
  assert.deepEqual(Object.keys(TABLE.birthdays.dates).sort(), [...ALL_RES].sort());
  for (const s of NEWCOMERS) assert.equal(TABLE.birthdays.dates[s], null, `${s}: 이사 온 날이 생일`);
  // town 숫자는 rules.json town 칸에서 (M6-P5 연결 제안)
  assert.deepEqual([R.FRIEND_MAX, R.TIERS, R.TALK_BONUS, R.GIFT_POINTS], [TABLE.town.friendMax, TABLE.town.tiers, TABLE.town.talkBonus, TABLE.town.giftPoints]);
});

test('몸짓·읽는 법 이름표가 판정·연출 코드와 맞는다', () => {
  const talkJs = read('src/gameplay/festival/talk.js'), judgeJs = read('src/gameplay/festival/judge.js');
  for (const g of Object.keys(GESTURES)) if (g !== 'happy') assert.ok(new RegExp(`(?:\\b${g}: \\{|MOTION\\.${g} =)`).test(talkJs), `몸짓 ${g} 가 festival/talk.js MOTION 에 없다`);
  for (const f of RULE_FLAGS) assert.ok(judgeJs.includes(`rule.${f.key}`), `읽는 법 ${f.key} 가 judge.js 에 없다`);
  for (const d of VILLAGERS) for (const p of linePools(d.lines)) assert.ok(p.list.length, `${d.slug} ${p.path}`);
});

// 6차 전(코드에 박혀 있던 때) 결과와 같은지: 주민마다 데이터·결과 지문. 바꾸기 전 HEAD(21f7b80)와 바꾼 뒤를 같은 함수로 떠서 같음을 확인한 값.
// 주민 파일을 "요청 확인" 으로 고치면 version 이 올라가 그 주민은 건너뛴다 (일부러 바꾼 것). 공통은 모든 주민 v1 · rules.json v0 · talk.json v2 일 때만.
// 2026-11-04 7차 QA 결정(보드 wave7 D50-A 선물·부탁도 마음 열기 · D57-A 잠들기 전 1~2시간은 집에)으로 주민 play 지문을 일부러 다시 뜸 (data 는 그대로).
const PINS = {
  coco: { data: "b5f61fd127d20641", play: "d85af81b3405045a" },
  bori: { data: "0f11c1eec440e4b5", play: "b839d3cb9097b65b" },
  mochi: { data: "93a55bd09a94abca", play: "e9a56330621808eb" },
  dubu: { data: "ac459043ce862379", play: "9e8a4f2536f2b5af" },
  pong: { data: "a65bf742e97b8e87", play: "c7e0118e0cbefc88" },
  chorong: { data: "551266b60426cf68", play: "5aff53d1af974f00" },
  danpung: { data: "b21d0219f0fc1341", play: "0af0c32483a5e1de" },
  bamtol: { data: "3db0c3d7509f6f73", play: "e3b0c44298fc1c14" },
  neuru: { data: "2cd6cddef9148de0", play: "e3b0c44298fc1c14" },
  shared: "58e06ad451d54e5b",
};
test('같은 결과 지문: 대화·선물·부탁·보상·일과·대사 고르기·이모티콘 판정·생일·편지가 6차 전과 같다', t => {
  const fp = fingerprint({ PEOPLE, KEEPERS, LINES, T, R, J, items, BD });
  const skipped = [];
  for (const d of VILLAGERS) {
    if (d.version !== 1) { skipped.push(`${d.slug} v${d.version}`); continue; }
    if (!PINS[d.slug]) { skipped.push(`${d.slug} 새 주민`); continue; }   // 10차 새 주민(구름·파도·달무리)은 6차 전 지문이 없다 — 핀 값은 그대로
    assert.deepEqual(fp[d.slug], PINS[d.slug], `${d.name}: 6차 전과 결과가 다르다 (data = 파일 값, play = 결과)`);
  }
  if (VILLAGERS.every(d => d.version === 1) && TABLE.version === 0 && TALK.version === 2) assert.equal(fp.shared, PINS.shared, '공통(생일·편지·인사·town 숫자)이 6차 전과 다르다');
  else skipped.push('공통');
  if (skipped.length) t.diagnostic(`일부러 고친 것은 건너뜀: ${skipped.join(', ')}`);
});

test('반영 도구: 바뀐 칸만 얹고 version +1, 생일은 rules.json, 고칠 수 없는 칸·검사 실패는 막는다', () => {
  const coco = VILLAGERS[0];
  const draft = structuredClone(coco);
  draft.gifts.loves = [...draft.gifts.loves, 'fish.tuna'];
  draft.emote.reply = ['run', 'grin', 'sun'];
  const off = draft.lines.bye.pop();
  draft.linesOff = { bye: [off] };
  draft.lines.greet.morning[0] = '좋은 아침이다냥! 오늘도 달리자냥!';
  const changes = diffTables(coco, draft);
  assert.deepEqual(Object.keys(changes).sort(), ['emote/reply', 'gifts/loves', 'lines/bye', 'lines/greet/morning', 'linesOff/bye']);
  const p = plan({ slug: 'coco', base: coco.version, changes, rules: { 'birthdays/dates/coco': '07-15' } }, ENV);
  assert.deepEqual(p.errors, []);
  const [vf, rf] = p.files;
  assert.equal(vf.after.version, coco.version + 1);
  assert.deepEqual(toPerson(vf.after).loves, draft.gifts.loves);
  assert.equal(vf.after.lines.bye.length, coco.lines.bye.length - 1);
  assert.equal(rf.after.birthdays.dates.coco, '07-15');
  assert.equal(rf.after.version, TABLE.version + 1);
  assert.deepEqual(JSON.parse(formatJSON(vf.after)), vf.after, '쓰는 모양으로 읽어도 같다');
  // 판정은 바뀐 대답 팔레트를 쓴다
  const r2 = J0.withVillagers(TALK, [vf.after]);
  assert.equal(J0.judge(r2, 'coco', ['run', 'sun', 'grin'], { dayKey: '2026-10-30', want: null }).reply[1], 'run');
  // 막는 것
  const bad = plan({ slug: 'coco', changes: { version: 9, 'emote/likes': ['nope'], 'lines/bye': [] }, rules: { 'birthdays/dates/bori': '01-01' } }, ENV);
  const why = bad.errors.map(e => e.path).join(' ');
  for (const s of ['version', 'emote/likes', 'lines/bye', 'rules/birthdays/dates/bori']) assert.ok(why.includes(s), `못 막음: ${s} (${why})`);
  assert.ok(plan({ slug: 'coco', base: 0, changes }, ENV).warnings.length, '기준 버전이 다르면 알린다');
});

test('게임 웹 빌드에 주민 파일 9개가 들어간다 (boot 묶음)', () => {
  const web = planWeb();
  for (const f of VILLAGER_FILES) assert.ok(web.files.some(x => x.path === f), `빌드에 없음: ${f}`);
  const boot = web.packs.filter(p => p.boot).flatMap(p => p.files.map(f => f.path));
  for (const f of VILLAGER_FILES) assert.ok(boot.includes(f), `boot 묶음에 없음: ${f}`);
});

test('캐릭터 편집기: 「성격·대화」 탭 게시 파일 목록이 편집기가 읽는 모듈·데이터를 모두 담는다', () => {
  const list = readJSON('assets/villagers/editor-files.json');
  const html = read(list.page);
  assert.ok(html.includes("kind: 'traits'"), '성격·대화 요청은 kind: traits');
  const need = new Set([...VILLAGER_FILES, 'assets/emotes/emotes.json', 'assets/emotes/talk.json', 'assets/data/items.json', 'assets/data/rules.json', 'concept/board-kit.js']);
  const script = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const queue = [...scanModule(script).imports].filter(s => s.startsWith('./')).map(s => posix.normalize(s));
  assert.ok(queue.includes('src/gameplay/festival/judge.js'), '판정 코드를 그대로 불러 쓴다');
  while (queue.length) {
    const f = queue.shift();
    if (need.has(f)) continue;
    need.add(f);
    for (const s of scanModule(read(f)).imports) if (/^\.{1,2}\//.test(s)) queue.push(posix.normalize(posix.join(posix.dirname(f), s)));
  }
  for (const f of need) assert.ok(list.files.includes(f), `목록에 없음: ${f}`);
  for (const f of list.files) assert.ok(existsSync(new URL(f, ROOT)), `없는 파일: ${f}`);
});
