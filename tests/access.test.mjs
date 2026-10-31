// 7차 M7-P3 휴대폰·접근성: 섬폰 「보기 편하게」(UI-10) 설정 풀이·저장, 소리 자막 표, 세로 화면 카메라, 섬폰 P4 줄, QA-12
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACCESS_DEFAULTS, ACCESS_KEYS, TEXT_SIZES, resolveAccess, captionFor, SOUND_CAPTIONS } from '../src/ui/access.js';
import { portraitView, BASE_FOV, PORTRAIT } from '../src/player/camera.js';
import { createSave } from '../src/data/save.js';
import { createState } from '../src/core/state.js';
import { fakeStorage } from './helpers.mjs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('보기 편하게: 기본값은 지금 화면 그대로 (글자 보통·나머지 끔), 흔들림은 기기 설정을 따른다', () => {
  assert.deepEqual(ACCESS_KEYS, ['textSize', 'shapes', 'calm', 'emoteText', 'soundText']);
  const a = resolveAccess({});
  assert.deepEqual(a, { textSize: 'normal', scale: 1, shapes: false, calm: false, emoteText: false, soundText: false });
  assert.equal(resolveAccess({}, true).calm, true, '기기가 움직임 줄이기면 켜진다');
  assert.equal(resolveAccess({ calm: false }, true).calm, false, '섬폰에서 끄면 기기 설정을 이긴다');
  assert.equal(resolveAccess({ calm: true }, false).calm, true);
  assert.equal(ACCESS_DEFAULTS.calm, undefined);
});

test('글자 크기 3단계: 보통 1 · 크게 1.15 · 아주 크게 1.3, 모르는 값은 보통', () => {
  assert.deepEqual(Object.keys(TEXT_SIZES), ['normal', 'large', 'huge']);
  assert.deepEqual(['normal', 'large', 'huge'].map(k => resolveAccess({ textSize: k }).scale), [1, 1.15, 1.3]);
  assert.equal(resolveAccess({ textSize: 'giant' }).textSize, 'normal');
  assert.equal(resolveAccess({ shapes: 'yes' }).shapes, false, 'true 만 켬');
});

test('보기 편하게 설정은 다른 설정처럼 저장·불러오기에 남는다 (state.settings)', () => {
  const storage = fakeStorage();
  const a = createState();
  Object.assign(a.settings, { textSize: 'huge', shapes: true, calm: false, emoteText: true, soundText: true });
  assert.equal(createSave({ state: a, storage }).save(), true);
  const b = createState();
  assert.equal(createSave({ state: b, storage }).load(), true);
  for (const k of ACCESS_KEYS) assert.equal(b.settings[k], a.settings[k], k);
  assert.equal(resolveAccess(b.settings, true).calm, false);
});

test('소리 신호 글자: 놀이에 뜻 있는 소리만, 이름은 sfx.json 에 있다, 입질·벌은 크게', () => {
  const sfx = JSON.parse(read('assets/sound/sfx.json')).sfx;
  for (const name of Object.keys(SOUND_CAPTIONS)) assert.ok(sfx[name], `${name} 이 sfx.json 에 없다`);
  for (const name of ['step-grass', 'step-sand', 'step-wood', 'menu', 'bag-open']) assert.equal(captionFor({ name }), null, name);
  assert.equal(captionFor({ name: 'bite' }).strong, true);
  assert.equal(captionFor({ name: 'bee' }).strong, true);
  assert.equal(captionFor({ name: 'acorn' }).strong, false);
  assert.equal(captionFor({ name: 'pickup', volume: 0.01 }), null, '거의 안 들리는 소리는 빼기');
  assert.equal(captionFor(null), null);
  assert.equal(captionFor({ name: 'nope' }), null);
});

test('세로 화면 카메라: 가로 화면은 그대로, 375×812 에서 시야각·거리를 끝까지 늘린다', () => {
  assert.deepEqual(portraitView(1280 / 800), { p: 0, fov: BASE_FOV, distK: 1, pitch: 0 });
  assert.equal(portraitView(1).fov, BASE_FOV);
  const phone = portraitView(375 / 812);
  assert.equal(phone.p, 1);
  assert.equal(phone.fov, BASE_FOV + PORTRAIT.fov);
  assert.ok(phone.distK > 1);
  const mid = portraitView(0.75);
  assert.ok(mid.fov > BASE_FOV && mid.fov < phone.fov, '사이 비율은 사이 값');
  assert.equal(portraitView(NaN).fov, BASE_FOV);
  // 375×812 에서 보이는 좌우 폭이 예전보다 넓어야 한다 (가운데 거리 기준)
  const width = (fov, k, aspect) => 2 * k * Math.tan((fov * Math.PI) / 360) * aspect;
  assert.ok(width(phone.fov, phone.distK, 375 / 812) > width(BASE_FOV, 1, 375 / 812) * 1.5);
});

test('섬폰: 보기 편하게 앱 + P4 창 두 줄은 ui.transfer / ui.report 가 있을 때만', async () => {
  const { APPS, visibleApps } = await import('../src/ui/phone.js');
  const ids = ui => visibleApps(ui).map(a => a.id);
  assert.ok(APPS.some(a => a.id === 'access'));
  assert.deepEqual(ids({}), ['dex', 'map', 'recipes', 'bag', 'settings', 'save', 'access']);
  assert.deepEqual(ids({ transfer: { open() {} } }).slice(-2), ['access', 'transfer']);
  assert.deepEqual(ids({ transfer: { open() {} }, report: { open() {} } }).slice(-3), ['access', 'transfer', 'report']);
  assert.deepEqual(ids({ report: {} }).includes('report'), false, 'open 이 없으면 숨김');
  const { EXTRA_PANELS } = await import('../src/ui/index.js');
  assert.deepEqual(EXTRA_PANELS, [['transfer', './transfer.js'], ['report', './report.js']]);
  for (const [name] of EXTRA_PANELS) assert.ok(APPS.some(a => a.panel === name), name);
});

test('글자 배율은 ui·축제 css 의 글자에 걸린다, 움직임 줄이기는 class 로', () => {
  const ui = read('src/ui/ui.css');
  assert.match(ui, /\.pk-root \{[^}]*font-size: calc\(16px \* var\(--pk-fs, 1\)\)/);
  assert.match(ui, /\.pk-dlg-box \{[^}]*var\(--pk-fs, 1\)/, '대화창 글자');
  assert.match(ui, /\.pk-calm \.pk-root \*/);
  assert.doesNotMatch(ui, /@media \(prefers-reduced-motion/, '기기 설정은 ui/access.js 가 pk-calm 으로 바꾼다 (섬폰에서 끄면 꺼지게)');
  const fe = read('src/gameplay/festival/festival.css');
  assert.match(fe, /\.pk-calm \.fe-talk \*/);
  assert.match(fe, /\.pk-emote-words \.fe-word/);
});

test('QA-12: 이모티콘 선택기 "잘 가" 단추는 손 흔들기 그림이 아니다', () => {
  const src = read('src/gameplay/festival/talkui.js');
  assert.doesNotMatch(src, /byeBtn\.innerHTML = emo\.svg\('wave'/);
  assert.match(src, /byeBtn\.innerHTML = ICON\.bye/);
});
