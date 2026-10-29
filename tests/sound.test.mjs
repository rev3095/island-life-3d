// 소리 데이터 약속 검사: assets/sound/ 의 곡·효과음·목소리·선곡 표를 파일 하나씩 바꿔 끼워도 소리 모듈이 그대로 돌게.
// 목록 ↔ 파일 ↔ files.js · 곡 데이터 모양(반주 모양 파트·악기·채널·악보 길이) · 선곡 표 · 편집 값(세기·옥타브·끄기·높이·길이) ·
// 그리고 '같은 데이터면 같은 소리' 지문 — 코드(반주 모양·재생기·효과음 kit)를 고쳐도 소리가 그대로인지 지킨다.
// 데이터를 고친 곡·효과음·목소리는 소리가 바뀌는 게 당연하므로 지문 검사를 건너뛴다 (지문 열쇠 = 데이터 내용의 해시).
// 코드를 일부러 바꿔 소리가 달라졌으면: SOUND_FP=print node --test tests/sound.test.mjs → 찍힌 표를 FINGERPRINTS 에 붙인다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { INDEX_FILE, SFX_FILE, VOICES_FILE, SONG_FILES } from '../src/audio/files.js';
import { loadSound, installSound, autoSong, slotForHour, SCHEDULE, formatJSON } from '../src/audio/bank.js';
import { SONGS, TRACKS, buildSong, ARRANGE, ARRANGE_PARTS, setSong } from '../src/audio/songs.js';
import { createMusic } from '../src/audio/music.js';
import { playSfx, SFX, SFX_NAMES } from '../src/audio/sfx.js';
import { planSpeech, VOICES } from '../src/audio/voice.js';
import { INSTRUMENT_INFO } from '../src/audio/instruments.js';
import { WEATHERS } from '../src/sky/weather.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const text = p => readFileSync(resolve(root, p), 'utf8');
const json = p => JSON.parse(text(p));
const data = await loadSound(async p => json(p));
const installErrors = installSound(data);
const clone = o => JSON.parse(JSON.stringify(o));

// ── 가짜 Web Audio: 노드 만들기·값 바꾸기·시작/멈춤을 글줄로 기록 ──
const r10 = x => (typeof x === 'number' ? Number(x.toPrecision(10)) : x);
function mockAudio() {
  const log = [];
  let id = 0;
  const param = (owner, name) => {
    const p = { _v: 0 };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']) {
      p[m] = (...a) => { log.push(`${owner}.${name}.${m}(${a.map(r10).join(',')})`); return p; };
    }
    Object.defineProperty(p, 'value', { get: () => p._v, set: v => { p._v = v; log.push(`${owner}.${name}=${r10(v)}`); } });
    p.connect = () => {}; p.disconnect = () => {};
    return p;
  };
  const node = kind => {
    const n = `${kind}#${++id}`;
    log.push(`new ${n}`);
    const o = {
      _n: n,
      connect: x => { log.push(`${n}->${x?._n ?? (x?._v !== undefined ? 'param' : '?')}`); return x; },
      disconnect() {},
      start: (...a) => log.push(`${n}.start(${a.map(r10).join(',')})`),
      stop: (...a) => log.push(`${n}.stop(${a.map(r10).join(',')})`),
      setPeriodicWave() {},
    };
    for (const k of ['gain', 'pan', 'frequency', 'Q', 'detune', 'playbackRate']) o[k] = param(n, k);
    return new Proxy(o, {
      set(t, k, v) { if (k !== 'onended') log.push(`${n}.${String(k)}=${v?._n ?? (Array.isArray(v) || ArrayBuffer.isView(v) ? '[..]' : r10(v))}`); t[k] = v; return true; },
    });
  };
  const ac = {
    currentTime: 0, sampleRate: 44100, state: 'running',
    createGain: () => node('gain'), createStereoPanner: () => node('pan'), createOscillator: () => node('osc'),
    createBufferSource: () => node('buf'), createBiquadFilter: () => node('biquad'), createWaveShaper: () => node('shaper'),
    createConvolver: () => node('conv'), createDynamicsCompressor: () => node('comp'),
    createBuffer: (ch, len, sr) => { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { duration: len / sr, length: len, sampleRate: sr, numberOfChannels: ch, getChannelData: c => d[c] }; },
    createPeriodicWave: () => ({}),
  };
  const engine = {
    ac, sr: 44100, cache: new Map(), stats: { nodes: 0, sources: 0, started: 0 },
    buses: { bgm: node('bus-bgm'), sfx: node('bus-sfx'), voice: node('bus-voice') },
    sends: { sfx: node('send-sfx'), voice: node('send-voice') },
    voiceIn: node('voiceIn'),
    reverb: () => node('conv'),
    noise: loop => { const s = node('noise'); s.loop = !!loop; return s; },
    start: (s, t, stopAt) => log.push(`${s._n}.start*(${r10(t)}${stopAt != null ? ',' + r10(stopAt) : ''})`),
    own() {},
    group: () => ({ node: n => n, src: s => s, onRelease() {}, release() {} }),
  };
  return { engine, log };
}
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };

/** 곡 하나를 두 바퀴 펼친 음 나열 [시각, 악기, 채널, 음, 길이, 세기, 옵션] */
function songEvents(name) {
  const { engine } = mockAudio();
  const music = createMusic(engine);
  music.play(name, { fade: 0.02, restart: true });
  const p = music.player;
  for (let n = 0; n < p.def.bars * 2; n++) p.genBar(n);
  return p.queue.map(e => [e.time, e.inst, e.ch, e.midi, e.dur, e.vel, e.opts ? Object.fromEntries(Object.entries(e.opts).map(([k, v]) => [k, typeof v === 'object' && !Array.isArray(v) ? 'vib' : v])) : null]);
}
/** 효과음을 결정된 난수로 두 번(기본 · 높이 1.3·크기 0.5·0.1초 뒤) 부른 노드 기록 */
function sfxLog(name, def) {
  const logs = [];
  const real = Math.random;
  for (const opts of [{}, { pitch: 1.3, volume: 0.5, delay: 0.1 }]) {
    const { engine, log } = mockAudio();
    Math.random = seeded(7);
    try { playSfx(engine, name, opts, def); } finally { Math.random = real; }
    logs.push(log);
  }
  return logs;
}
const SAMPLE_LINES = ['안녕! 오늘 날씨 정말 좋다. 같이 산책할래?', '음… 그건 좀 어려운데~', '도토리 300개예요!', 'ㅋㅋ 정말? 알았어.'];

// 지문 [데이터 해시, 소리 해시] — 2026-10-29 데이터로 옮기기 전 코드(songs.js·sfx.js·voice.js 안의 값)와 같은 결과임을 확인한 값
const FINGERPRINTS = {"songs":{"dawn":["62a4d817","8a75e9e1"],"morning":["57b27ef7","6ff3881b"],"afternoon":["41c85909","96fae7d0"],"evening":["bb9499d8","2f8437c2"],"night":["cb452c27","a6223969"],"rain":["941858fe","331ebacd"],"indoor":["1c241be3","572ce998"],"shop":["1213ea89","686e8ec7"],"museum":["fe8d697a","005ec85d"]},"sfx":{"step-grass":["80584a73","88ee6315"],"step-sand":["c3a12242","62276c1b"],"step-wood":["ef3890d4","6cafcdae"],"cast":["f9105428","80a572c0"],"nibble":["567b70e9","b6920409"],"bite":["47e44973","4bc5b8c7"],"splash":["17346368","f9275368"],"catch":["7e0aafd6","231e08de"],"net-swing":["f3011b5f","5c4a58e8"],"bug-catch":["c4c66bf0","312b3ade"],"shake":["4cdb1847","4d3f9ada"],"fruit-drop":["8c2e9971","9a369ded"],"acorn":["5a390be4","ab8bcdff"],"dig":["0b98c8b5","1b37ad72"],"fossil":["0f7f5fc9","bac457e4"],"axe-wood":["c061d8cf","7de85f84"],"axe-rock":["83a344af","9b483d25"],"water":["b6ede516","dc1c6ec0"],"pickup":["04966c18","2b10efe4"],"bag-open":["afb84466","ffe9cddd"],"menu":["6cda0f98","061827d3"],"sell":["826c3369","bcbba04c"],"door":["9caa71e0","6ef1dc08"],"bee":["eb784ba4","a2a0d316"]},"voices":{"coco":["20e849bd","7f932267"],"bori":["4757656b","87f7c6bc"],"mochi":["69a1a753","dc1c708e"],"dubu":["e27b2e06","0d6d61f0"],"pong":["27057a65","13519af6"],"chorong":["66f3304e","49588bca"],"bamtol":["b40e9074","9cc4c80e"],"neuru":["41a1cba6","5fedf6a9"],"player":["69bdc8d8","0f88c7b2"]}};

test('소리 데이터를 다 읽고 문제가 없다', () => {
  assert.deepEqual(data.errors, []);
  assert.deepEqual(installErrors, []);
  assert.equal(TRACKS.length, data.index.songs.length);
  assert.ok(SFX_NAMES.length >= 24 && Object.keys(VOICES).length >= 9);
});

test('곡 목록 index.json · files.js · songs/ 파일이 서로 맞다', () => {
  const files = readdirSync(resolve(root, 'assets/sound/songs')).filter(f => f.endsWith('.json')).sort();
  assert.deepEqual([...SONG_FILES].sort(), files.map(f => `assets/sound/songs/${f}`), 'files.js 의 SONG_FILES 를 곡 파일과 맞춘다 (웹 빌드가 이 목록을 묶는다)');
  assert.deepEqual(SONG_FILES.map(f => f.match(/([^/]+)\.json$/)[1]), data.index.songs, 'files.js 순서 = index.json songs 순서');
  for (const s of data.songs) assert.equal(`${s.id}.json`, files.find(f => f === `${s.id}.json`), '파일 이름 = 곡 id');
  assert.deepEqual([INDEX_FILE, SFX_FILE, VOICES_FILE], ['assets/sound/index.json', 'assets/sound/sfx.json', 'assets/sound/voices.json']);
});

test('곡 데이터: 반주 모양의 파트가 다 있고, 악기·채널·울림이 있고, 악보 길이가 맞다', () => {
  for (const s of data.songs) {
    assert.ok(ARRANGE[s.arrange], `${s.id}: 반주 모양`);
    assert.ok(Number.isInteger(s.version) && s.version >= 1, `${s.id}: version`);
    for (const role of ARRANGE_PARTS[s.arrange]) assert.ok(s.parts[role], `${s.id}: 파트 ${role}`);
    for (const [role, p] of Object.entries(s.parts)) {
      assert.ok(INSTRUMENT_INFO[p.inst], `${s.id}.${role}: 악기 ${p.inst}`);
      assert.ok(s.channels[p.ch], `${s.id}.${role}: 채널 ${p.ch}`);
      assert.ok(p.label, `${s.id}.${role}: 편집기에 보일 이름`);
    }
    const def = SONGS[s.id];
    assert.equal(def.progBars.length, s.bars);
    assert.equal(def.melBars.length, s.bars);
  }
  for (const r of Object.keys(ARRANGE)) assert.ok(ARRANGE_PARTS[r], `ARRANGE_PARTS.${r}`);
});

test('곡 데이터가 틀리면 고칠 곳을 한국어로 알려 준다', () => {
  const dawn = data.songs.find(s => s.id === 'dawn');
  const bad = (patch, re) => assert.throws(() => buildSong({ ...clone(dawn), ...patch }), re);
  bad({ mel: ['c5:1 d5 e5'] }, /멜로디가 3박이에요/);
  bad({ mel: ['c5:1 d5 e5 | f5:2'] }, /멜로디 — 마디 길이가 안 맞아요/);
  bad({ prog: ['Fmaj7 | Xm7'] }, /화음 — 화음 기호를 읽을 수 없어요: Xm7/);
  bad({ prog: ['Fmaj7 | Dm7'] }, /화음이 2마디예요/);
  bad({ arrange: 'jazz' }, /없는 반주 모양/);
  bad({ bpm: 5 }, /빠르기는/);
  bad({ parts: { ...dawn.parts, melody: { ...dawn.parts.melody, inst: 'tuba' } } }, /없는 악기 'tuba'/);
  const { comp, ...noComp } = dawn.parts;
  bad({ parts: noComp }, /파트 'comp' 가 없어요/);
});

test('선곡 표: 시간대·날씨·자리·창 고르기 (처음 표로 예전 trackForHour 와 같은지) + 지금 표의 곡이 다 있다', () => {
  // 고르는 규칙은 처음 표(2026-10-29 옮길 때)로 본다 — 지금 표는 편집기에서 바뀔 수 있으니까
  const first = {
    time: [{ from: 5, song: 'dawn' }, { from: 8, song: 'morning' }, { from: 12, song: 'afternoon' }, { from: 17, song: 'evening' }, { from: 19, song: 'night' }],
    weather: { clear: '', cloudy: '', rain: 'rain', snow: '', rainbow: '' },
  };
  const old = h => (h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 19 ? 'evening' : 'night');
  for (let h = 0; h < 24; h++) assert.equal(autoSong({ hour: h }, first), old(h), `${h}시`);
  assert.equal(autoSong({ hour: 10, weather: 'rain' }, first), 'rain');
  for (const w of WEATHERS.filter(w => w !== 'rain')) assert.equal(autoSong({ hour: 10, weather: w }, first), 'morning', w);
  assert.equal(slotForHour(3, first).song, 'night', '첫 줄보다 이른 시각 = 마지막 줄');
  // 지금 표
  for (const w of WEATHERS) assert.equal(autoSong({ hour: 10, weather: w }), SCHEDULE.weather[w] || slotForHour(10).song, w);
  assert.deepEqual(Object.keys(SCHEDULE.weather).sort(), [...WEATHERS].sort(), '날씨 칸 = sky 의 WEATHERS');
  assert.ok('indoor' in SCHEDULE.places, 'house·visit 가 bgm("indoor") 로 부르는 자리');
  assert.ok(SCHEDULE.panels.shop && SCHEDULE.panels.museum, '상점·박물관 창 곡');
  for (const t of SCHEDULE.time) assert.ok(Number.isInteger(t.from) && t.from >= 0 && t.from < 24 && t.part && t.label, `시간대 ${t.part}`);
  const used = [...SCHEDULE.time.map(t => t.song), ...Object.values(SCHEDULE.weather), ...Object.values(SCHEDULE.places), ...Object.values(SCHEDULE.panels)];
  for (const id of used) if (id) assert.ok(SONGS[id], `선곡 표의 곡 ${id}`);
});

test('목소리: 캐릭터 9명 목소리가 있고 말하는 계획이 나온다', () => {
  for (const id of ['player', 'coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong', 'bamtol', 'neuru']) {
    assert.ok(VOICES[id], id);
    const plan = planSpeech('안녕하세요!', id);
    assert.ok(plan.total > 0.2 && plan.syllables.length === 5, id);
  }
});

test('같은 데이터면 같은 소리 (곡 두 바퀴 음 나열 · 효과음 노드 기록 · 목소리 계획 지문)', () => {
  const now = { songs: {}, sfx: {}, voices: {} };
  for (const s of data.songs) now.songs[s.id] = [fnv(JSON.stringify(s)), fnv(JSON.stringify(songEvents(s.id)))];
  for (const name of SFX_NAMES) now.sfx[name] = [fnv(JSON.stringify(SFX[name])), fnv(JSON.stringify(sfxLog(name)))];
  for (const [id, v] of Object.entries(VOICES)) now.voices[id] = [fnv(JSON.stringify(v)), fnv(JSON.stringify(SAMPLE_LINES.map(t => planSpeech(t, id))))];
  if (process.env.SOUND_FP === 'print') console.log(`const FINGERPRINTS = ${JSON.stringify(now)};`);
  let checked = 0;
  for (const kind of ['songs', 'sfx', 'voices']) {
    for (const [id, [dataHash, outHash]] of Object.entries(now[kind])) {
      const fp = FINGERPRINTS[kind][id];
      if (!fp || fp[0] !== dataHash) continue;           // 데이터를 고친 것은 건너뛴다
      assert.equal(outHash, fp[1], `${kind}/${id}: 데이터는 그대로인데 소리가 달라졌어요 (코드를 일부러 바꿨으면 지문을 다시 찍는다)`);
      checked++;
    }
  }
  assert.ok(checked > 0 || process.env.SOUND_FP === 'print');
});

test('편집 값: 세기·옥타브·끄기·악기 바꾸기·빠르기가 음 나열에 그대로 들어간다', () => {
  const base = data.songs.find(s => s.id === 'dawn');
  const before = songEvents('dawn');
  try {
    const mel = before.filter(e => e[2] === 'rh');
    const edit = patch => { const j = clone(base); patch(j); setSong(j); return songEvents('dawn'); };
    // 멜로디 한 옥타브 위 + 세기 반: 오른손 음만 바뀌고 나머지는 그대로
    let after = edit(j => { j.parts.melody.octave = 1; j.parts.melody.vel = 0.5; });
    assert.equal(after.length, before.length);
    assert.deepEqual(after.filter(e => e[2] === 'lh'), before.filter(e => e[2] === 'lh'));
    const melAfter = after.filter(e => e[2] === 'rh');
    assert.ok(melAfter.some((e, k) => e[3] === mel[k][3] + 12 && Math.abs(e[5] - mel[k][5] * 0.5) < 1e-12));
    // 끄기: 그 파트 음만 빠지고 다른 파트의 흔들림(난수)은 그대로
    after = edit(j => { j.parts.comp.on = false; });
    assert.ok(after.length < before.length);
    const lhBefore = new Set(before.filter(e => e[2] === 'lh').map(e => JSON.stringify(e)));
    assert.ok(after.filter(e => e[2] === 'lh').every(e => lhBefore.has(JSON.stringify(e))), '같은 채널의 베이스 음은 그대로');
    assert.deepEqual(after.filter(e => e[2] === 'rh'), mel);
    // 악기 바꾸기
    after = edit(j => { j.parts.melody.inst = 'marimba'; });
    assert.ok(after.filter(e => e[2] === 'rh').some(e => e[1] === 'marimba'));
    // 빠르기 두 배 → 한 바퀴 시간이 절반
    const loop1 = SONGS.dawn.loopSec;
    edit(j => { j.bpm = base.bpm * 2; });
    assert.ok(Math.abs(SONGS.dawn.loopSec - loop1 / 2) < 1e-9);
  } finally { setSong(base); }
  assert.deepEqual(songEvents('dawn'), before, '원래 데이터로 돌리면 원래 소리');
});

test('효과음 편집 값: 높이·길이·크기 배율이 노드 값에 들어간다', () => {
  const d = SFX.pickup;
  const get = (log, re) => log.filter(l => re.test(l));
  const base = sfxLog('pickup')[0];
  const hi = sfxLog('pickup', { ...d, pitch: (d.pitch ?? 1) * 2 })[0];
  const f0 = +get(base, /^osc#\d+\.frequency\.setValueAtTime/)[0].match(/\(([\d.]+)/)[1];
  const f1 = +get(hi, /^osc#\d+\.frequency\.setValueAtTime/)[0].match(/\(([\d.]+)/)[1];
  assert.ok(Math.abs(f1 / f0 - 2) < 1e-6, '높이 2배');
  const long = sfxLog('pickup', { ...d, length: (d.length ?? 1) * 2 })[0];
  const stopOf = log => Math.max(...get(log, /\.stop\(|start\*\(/).map(l => +l.match(/[(,]([\d.]+)\)$/)[1]));
  assert.ok(stopOf(long) > stopOf(base) * 1.5, '길이 2배면 더 오래');
  const loud = sfxLog('pickup', { ...d, trim: d.trim + 6 })[0];
  const outGain = log => +log.find(l => /^gain#\d+\.gain=/.test(l)).split('=')[1];
  assert.ok(Math.abs(outGain(loud) / outGain(base) - 10 ** (6 / 20)) < 1e-6, '크기 +6dB');
});

test('assets/sound/ 파일은 formatJSON 모양으로 적혀 있다 (소리 반영이 같은 모양으로 다시 쓴다)', () => {
  const files = [INDEX_FILE, SFX_FILE, VOICES_FILE, ...SONG_FILES];
  for (const f of files) assert.equal(text(f).replace(/\r\n/g, '\n'), formatJSON(json(f)) + '\n', f);
});
