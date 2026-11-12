// 스토리 편집기 (P36): 장면 · 주민 · 편지 · 그 밖의 글 탭, 게시 파일 목록, "스토리 반영" 도구 (apply-traits · apply-texts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';
import { scanModule } from '../tools/build-web.mjs';
import { diffTables } from '../tools/edits.mjs';
import { plan as planTraits, checkEnv } from '../tools/apply-traits.mjs';
import { plan as planTexts, TEXT_FILES } from '../tools/apply-texts.mjs';
import { textLeaves, textDiff, LETTER_WHEN } from '../story-editor/words.js';
import { VILLAGER_FILES } from '../src/gameplay/town/files.js';
import { SCENE_FILES, INDEX_FILE } from '../src/gameplay/story/files.js';

const ROOT = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), 'utf8');
const readJSON = p => JSON.parse(read(p));

test('스토리 편집기: 탭 넷과 명령 "스토리 반영", 주민·글 초안 컬렉션', () => {
  const html = read('story-editor.html');
  for (const t of ['scenes', 'villager', 'letters', 'texts']) assert.ok(html.includes(`id="tab-${t}"`) && html.includes(`id="pane-${t}"`), `탭 ${t}`);
  assert.ok(html.includes('"스토리 반영"'), '채팅 명령');
  for (const c of ["watchCol('talk'", "watchCol('texts'", "watchCol('drafts'", "watchDoc('timeline/main'", "watchDoc('applied/story'"]) assert.ok(html.includes(c), c);
  const words = read('story-editor/words.js');
  assert.ok(words.includes("kind: 'traits'"), '주민 초안은 apply-traits 요청 모양 (kind: traits)');
  assert.ok(!/\bhistory\.replaceState/.test(html.replace(/window\.history\.replaceState/g, '')), '페이지의 history 변수(반영 기록)가 브라우저 history 를 가린다 — window.history 로');
});

test('스토리 편집기: 게시 파일 목록이 페이지에서 닿는 모듈·데이터를 모두 담고, 한도 안이다', () => {
  const list = readJSON('assets/story/editor-files.json');
  assert.equal(list.page, 'story-editor.html');
  const need = new Set([INDEX_FILE, ...SCENE_FILES, ...VILLAGER_FILES, ...Object.values(TEXT_FILES), 'assets/models/index.json',
    'assets/emotes/emotes.json', 'assets/emotes/talk.json', 'assets/data/items.json', 'assets/data/rules.json']);
  const html = read(list.page);
  const script = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const queue = [...scanModule(script).imports].filter(s => s.startsWith('./')).map(s => posix.normalize(s));
  assert.ok(queue.includes('story-editor/words.js'));
  const seen = new Set();
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f); need.add(f);
    for (const s of scanModule(read(f)).imports) if (/^\.{1,2}\//.test(s)) queue.push(posix.normalize(posix.join(posix.dirname(f), s)));
  }
  for (const m of readJSON('assets/models/index.json').models) need.add(`assets/renders/${m.slug}_thumb.png`);
  for (const f of need) assert.ok(list.files.includes(f), `목록에 없음: ${f}`);
  for (const f of list.files) assert.ok(existsSync(new URL(f, ROOT)), `없는 파일: ${f}`);
  assert.equal(new Set(list.files).size, list.files.length, '겹침');
  assert.ok(list.files.length + 1 <= 255, '한 번에 올릴 수 있는 수 (아티팩트 한 버전 511 한도 안)');
});

test('주민 초안 (talk/<slug>) = apply-traits 요청: 대사 한 줄·생일을 고친 초안이 그대로 얹힌다', async () => {
  const doc = readJSON('assets/villagers/coco.json'), draft = structuredClone(doc);
  draft.lines.chat[2] = '오늘은 바다까지 달려갔다 왔다냥!';
  draft.lines.letters.friend[0][1] = '오늘 아침에 바닷가를 뛰다가 네 생각이 났다냥.';
  const req = { slug: 'coco', kind: 'traits', base: doc.version, changes: diffTables(doc, draft), rules: { 'birthdays/dates/coco': '07-08' }, request: '' };
  const r = planTraits(req, await checkEnv());
  assert.deepEqual(r.errors, []);
  const v = r.files.find(f => f.path === 'assets/villagers/coco.json');
  assert.equal(v.after.version, doc.version + 1);
  assert.equal(v.after.lines.chat[2], '오늘은 바다까지 달려갔다 왔다냥!');
  assert.equal(v.after.lines.letters.friend[0][1], '오늘 아침에 바닷가를 뛰다가 네 생각이 났다냥.');
  assert.ok(r.files.some(f => f.rules && f.after.birthdays.dates.coco === '07-08'));
  // 편지는 여러 줄이어야 한다 (검사가 막는다)
  const bad = structuredClone(doc);
  bad.lines.letters.friend[0] = '한 줄짜리 편지';
  assert.ok(planTraits({ ...req, changes: diffTables(doc, bad), rules: {} }, await checkEnv()).errors.length);
});

test('그 밖의 글 (texts/<id>) = apply-texts: 글 칸만 고치고, 파일 모양은 그대로, version +1', () => {
  for (const [id, file] of Object.entries(TEXT_FILES)) assert.ok(existsSync(new URL(file, ROOT)), `${id}: ${file}`);
  const night = readJSON('assets/night/night.json'), src = read('assets/night/night.json');
  const leaves = textLeaves(night);
  assert.ok(leaves.includes('lines/byeolbam/greet/0') && leaves.includes('tarot/cards/0/text'), '밤 글 칸');
  assert.ok(!leaves.includes('about') && !leaves.some(p => p.endsWith('/sym')), '설명·기호는 글 칸이 아니다');
  const edited = structuredClone(night);
  edited.lines.byeolbam.greet[0] = '…찍. 어서 와. 달빛 가게야찍.';
  edited.tarot.cards[0].effect = '팔 때 값 조금 더';
  const changes = textDiff(night, edited);
  assert.deepEqual(Object.keys(changes).sort(), ['lines/byeolbam/greet/0', 'tarot/cards/0/effect']);
  const r = planTexts({ which: 'night', file: 'assets/night/night.json', base: night.version, changes });
  assert.deepEqual(r.errors, []);
  assert.equal(r.after.version, night.version + 1);
  assert.deepEqual(JSON.parse(r.text), r.after);
  const diffLines = r.text.split('\n').filter((l, i) => l !== src.split('\n')[i]);
  assert.equal(diffLines.length, 3, '바뀐 줄 = 글 둘 + version 하나 (파일 모양 그대로)');
  // 숫자·때·빈 글은 막는다
  assert.ok(planTexts({ which: 'night', changes: { 'market/hours/0': '20' } }).errors.length, '숫자 칸');
  assert.ok(planTexts({ which: 'night', changes: { 'lines/byeolbam/bye/0': ' ' } }).errors.length, '빈 글');
  assert.ok(planTexts({ which: 'nope', changes: {} }).errors.length, '모르는 파일');
  // 행사 이름·할 일
  const ev = readJSON('assets/events/events.json');
  assert.ok(textLeaves(ev).includes('list/0/todo/0/label') && textLeaves(ev).includes('open/beforeLine'));
});

test('편지 탭: 주민 파일의 편지 종류마다 「언제 나오나」 설명이 있다', () => {
  const kinds = new Set();
  for (const f of VILLAGER_FILES) for (const k of Object.keys(readJSON(f).lines.letters ?? {})) kinds.add(k);
  for (const k of kinds) assert.ok(LETTER_WHEN[k], `편지 ${k} 의 설명`);
});

test('M17-P4: 그 밖의 글이 섬 일상(daily.json)과 밤 특별 상점 글을 보이고, 편집기와 반영 도구의 글 파일 목록이 같다', () => {
  const words = read('story-editor/words.js');
  const edTF = Function(`return ${words.match(/const TEXT_FILES = (\{[^}]+\})/)[1]}`)();
  assert.deepEqual(edTF, TEXT_FILES, 'words.js TEXT_FILES = apply-texts.mjs TEXT_FILES');
  assert.ok(readJSON('assets/story/editor-files.json').files.includes(TEXT_FILES.daily), '게시 목록에 daily.json');
  const daily = readJSON(TEXT_FILES.daily), leaves = textLeaves(daily);
  assert.ok(leaves.some(p => p.startsWith('peddler/')) && leaves.some(p => p.startsWith('meteor/')), '행상·유성우 글 칸');
  const edited = structuredClone(daily);
  const p = leaves.find(x => x.startsWith('peddler/'));
  const seg = p.split('/'); let o = edited; for (const k of seg.slice(0, -1)) o = o[k]; o[seg.at(-1)] = '떠돌이 행상 송이가 왔어요!';
  const r = planTexts({ which: 'daily', changes: textDiff(daily, edited) });
  assert.deepEqual(r.errors, []);
  assert.equal(r.after.version, daily.version + 1);
  // 밤: 살랑·이상한 천막·선물 상자 글이 묶음에 든다 (어느 묶음에도 없으면 「그 밖」)
  const night = readJSON('assets/night/night.json');
  for (const g of ['lines/salang', 'fox', 'odd', 'gift']) if (getPath(night, g)) assert.ok(words.includes(`'${g}'`) || words.includes(` ${g}:`), `밤 묶음 ${g}`);
  assert.ok(words.includes("label: '그 밖'"), '남은 글 칸 묶음');
  assert.ok(words.includes("'nightShop'"), '밤톨 밤 매장 안내 (편지 탭)');
});
function getPath(o, p) { return p.split('/').reduce((a, k) => a?.[k], o); }
