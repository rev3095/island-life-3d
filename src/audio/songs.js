// 배경음 곡 만들기: 곡 데이터(assets/sound/songs/<id>.json) + 반주 모양(ARRANGE, 아래 코드) → 재생기(music.js)가 쓰는 곡 정의.
// 데이터에 있는 것: 빠르기·박자·마디 수·스윙·크기·울림·조성, 채널(크기·좌우·울림), 파트(악기·채널·세기·옥타브·끄기), 화음·멜로디 악보, 빗소리 같은 배경 소리.
// 코드에 남은 것: 반주 모양(arrange) — 마디마다 어떤 파트가 어떤 박에 무엇을 치는지. 배경 빌더의 kind → BUILDERS 와 같은 생각이다.
// 반주 모양 함수 (s, i, pass): i 번째 마디의 음을 s.play(파트, 음, 박, 길이(박), 세기, 옵션) 로 예약한다. pass 홀수 = 두 번째 바퀴 변주.
import { parseSeq, parseProg, splitBars, scaleStep, SCALES, keyToPc } from './notation.js';
import { rainBuffer, INSTRUMENTS } from './instruments.js';

/** 잔향 크기 4가지 (곡끼리 IR 버퍼를 같이 쓴다) */
export const ROOMS = { small: { seconds: 1.4, damp: 0.55 }, medium: { seconds: 2.6, damp: 0.6 }, large: { seconds: 3.2, damp: 0.65 }, hall: { seconds: 5, damp: 0.35 } };

const pick = (s, arr) => arr[Math.floor(s.rand() * arr.length)];
const offBeat = b => b % 1 !== 0;

const bird = (s, role, p = 0.3) => {
  if (s.rand() < p) s.play(role, 0, s.rand() * (s.def.meter - 1), 1, 0.05 + s.rand() * 0.03, { variant: Math.floor(s.rand() * 5), rate: 0.85 + s.rand() * 0.3 });
};

const STRUM = [[0, 'D'], [1, 'D'], [1.5, 'U'], [2.5, 'U'], [3, 'D'], [3.5, 'U']];
const STRUM_LAZY = [[0, 'D'], [2, 'D'], [2.5, 'U'], [3.5, 'U']];

/** 반주 모양 9가지 (처음 쓴 곡 이름). 곡 데이터의 arrange 로 고른다 */
export const ARRANGE = {
  // BGM-01 새벽: 왼손 분산화음 피아노, 두 번째 바퀴는 화음을 두 음씩·뒤쪽은 한 옥타브 위 + 꾸밈음
  dawn(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.play('bass', s.bass(chord, 41), beat, dur, 0.5);
      const v = s.voicing(chord, 60);
      if (!alt) {
        const pat = [v[0], v[1], v[2], v[1], v[2], v.at(-1), v[2]];      // 왼손 분산화음 (8분음표)
        for (let k = 0; k < dur * 2 - 1; k++) s.play('comp', pat[k], beat + 0.5 + k * 0.5, 0.9, 0.24);
      } else {
        for (let k = 1; k < dur; k++) for (const m of (k % 2 ? [v[1], v[2]] : [v[0], v.at(-1)])) s.play('comp', m, beat + k, 0.95, 0.2);
      }
    }
    const hi = alt && i >= s.half;                                         // 두 번째 바퀴 후반: 한 옥타브 위
    for (const n of s.melody(i)) {
      const vel = offBeat(n.beat) ? 0.44 : 0.5;
      if (alt && n.dur >= 1.5 && n.beat > 0 && s.rand() < 0.45) s.play('melody', scaleStep(n.midi, s.scale, 1) + (hi ? 12 : 0), n.beat - 0.18, 0.2, 0.2);
      s.play('melody', n.midi + (hi ? 12 : 0), n.beat, n.dur * 1.2, hi ? vel * 0.85 : vel);
      if (hi) s.play('melody', n.midi, n.beat, n.dur, vel * 0.32);
    }
    if (s.rand() < (alt ? 0.45 : 0.25)) s.play('sparkle', pick(s, [84, 86, 89, 91, 93]), 3.5, 1.5, 0.12);
    bird(s, 'bird', 0.3);
  },

  // BGM-02 오전: 뒷박 마림바 화음 + 베이스·킥·셰이커, 두 번째 바퀴는 긴 음 굴리기·우드블록·아래 화음
  morning(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const root = s.bass(chord, 36);
      s.play('bass', root, beat, 0.9, 0.5);
      if (dur === s.def.meter) s.play('bass', root + 7, beat + 2, 0.9, 0.4);
      if (alt && dur === s.def.meter) s.play('bass', root + 12, beat + 3.5, 0.4, 0.26);
      const v = s.voicing(chord, 66);
      for (let k = 0.5; k < dur; k += 1) for (const m of [v[0], v[2] ?? v[1]]) s.play('comp', m, beat + k, 0.4, 0.22);
    }
    for (let k = 0; k < s.def.meter * 2; k++) s.play('shaker', 0, k * 0.5, 0.2, k % 2 ? 0.16 : 0.09);
    s.play('kick', 0, 0, 1, 0.34);
    s.play('kick', 0, 2, 1, 0.26);
    if (alt && i % 4 === 3) { s.play('wood', 0, 3, 0.2, 0.22); s.play('wood', 0, 3.5, 0.2, 0.18); }
    for (const n of s.melody(i)) {
      const vel = offBeat(n.beat) ? 0.48 : 0.55;
      if (alt && n.dur >= 2) {                                            // 긴 음은 마림바답게 굴린다
        for (let b = 0; b < n.dur - 0.2; b += 0.25) s.play('melody', n.midi, n.beat + b, 0.3, vel * (b ? 0.5 : 1));
      } else s.play('melody', n.midi, n.beat, n.dur, vel);
      if (alt && i >= s.half) s.play('harmony', scaleStep(n.midi, s.scale, -2), n.beat, n.dur, vel * 0.42);
    }
    bird(s, 'bird', 0.28);
  },

  // BGM-03 오후: 우쿨렐레 위아래 스트럼 + 뜯는 베이스, 두 번째 바퀴는 느긋한 스트럼·뒤쪽 플루트 겹치기
  afternoon(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const v = s.voicing(chord, 64);
      const pat = (alt ? STRUM_LAZY : STRUM).filter(([b]) => b < dur);
      pat.forEach(([b, dir], k) => {
        const next = pat[k + 1]?.[0] ?? dur;
        const strings = dir === 'D' ? v : v.slice(1).reverse();          // 위로 칠 때는 높은 줄만, 반대 순서
        strings.forEach((m, j) => s.play('strum', m, beat + b, (next - b) * 0.95, dir === 'D' ? 0.2 : 0.13, { nudge: j * 0.014 }));
      });
      const root = s.bass(chord, 40);
      s.play('bass', root, beat, Math.min(dur, 2) * 0.8, 0.5);
      if (dur === s.def.meter) s.play('bass', root + 7, beat + 2, 1.4, 0.42);
      if (alt && dur === s.def.meter) s.play('bass', root + 12, beat + 3.5, 0.4, 0.3);
    }
    for (let k = 0; k < s.def.meter; k++) s.play('shaker', 0, k + 0.5, 0.2, 0.1);
    for (const n of s.melody(i)) {
      s.play('melody', n.midi, n.beat, n.dur, offBeat(n.beat) ? 0.46 : 0.52);
      if (alt && i >= s.half) s.play('flute', n.midi, n.beat, n.dur * 0.95, 0.16);
    }
    bird(s, 'bird', 0.15);
  },

  // BGM-04 저녁: 긴 패드 + 베이스 + 전자피아노 뒷박, 멜로디는 플루트 (두 번째 바퀴 앞쪽은 전자피아노가 노래)
  evening(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.play('pad', s.voicing(chord, 60), beat, dur, 0.24);
      const root = s.bass(chord, 39);
      s.play('bass', root, beat, dur * 0.95, 0.45);
      if (alt && dur === s.def.meter) s.play('bass', root + 7, beat + 2.5, 1.3, 0.28);
      const v = s.voicing(chord, 74);
      (alt ? [0.5, 1.5, 2, 3] : [1, 2, 3]).filter(b => b < dur)
        .forEach((b, k) => s.play('keys', v[(k + 1) % v.length], beat + b, 1, 0.14));
    }
    const useAlt = alt && i < s.half;
    for (const n of s.melody(i)) {
      if (useAlt) s.play('leadAlt', n.midi, n.beat, n.dur, 0.36);
      else s.play('lead', n.midi, n.beat, n.dur * 0.96, 0.32);
    }
  },

  // BGM-05 밤 (3박자): 오르골 분산화음 + 아주 낮은 패드, 두 번째 바퀴 앞쪽은 멜로디가 한 옥타브 위
  night(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const b0 = s.bass(chord, 50), v = s.voicing(chord, 69);
      const pat = [b0, v[0], v[1], v[2], v[1], v[0]];
      for (let k = 0; k < dur * 2; k++) s.play('arp', pat[k], beat + k * 0.5, 1.2, k ? 0.17 : 0.24);
      s.play('pad', [b0 - 12, b0 - 5], beat, dur, 0.09);
    }
    const up = alt && i < s.half;
    for (const n of s.melody(i)) s.play('melody', n.midi + (up ? 12 : 0), n.beat, n.dur * 1.5, up ? 0.36 : 0.44);
    if (s.rand() < 0.35) s.play('cricket', 0, s.rand() * (s.def.meter - 0.5), 1, 0.045, { variant: Math.floor(s.rand() * 3), rate: 0.95 + s.rand() * 0.1 });
  },

  // BGM-06 비 오는 날: 낮은 패드·베이스 + 칼림바 멜로디, 두 번째 바퀴는 메아리, 빗방울
  rain(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.play('pad', s.voicing(chord, 55), beat, dur, 0.2);
      s.play('bass', s.bass(chord, 33), beat, dur * 0.95, 0.4);
    }
    for (const n of s.melody(i)) {
      s.play('melody', n.midi, n.beat, n.dur * 1.4, 0.48);
      if (alt) s.play('echo', n.midi, n.beat + 0.75, n.dur, 0.16);   // 메아리처럼 한 번 더
    }
    for (let b = 0; b < s.def.meter; b++) {
      if (s.rand() < 0.55) s.play('drip', 0, b + s.rand() * 0.9, 1, 0.05 + s.rand() * 0.05, { variant: Math.floor(s.rand() * 4), rate: 0.75 + s.rand() * 0.6 });
    }
  },

  // BGM-07 실내: 전자피아노 화음 + 워킹 베이스 + 킥·브러시·하이햇, 판 긁힘
  indoor(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const v = s.voicing(chord, 63);
      const whole = dur === s.def.meter;
      const hits = whole ? [[0, 1.4, 0.2], [2.5, 1.2, 0.16]] : [[0, 1.4, 0.18]];
      if (alt && whole) hits.push([1.5, 0.4, 0.11]);
      for (const [b, d, vel] of hits) for (const m of v) s.play('keys', m, beat + b, d, vel);
      const root = s.bass(chord, 46);
      const walk = whole ? [root, root + 7, root + 12, root + 7] : [root, root + 7];
      walk.forEach((m, k) => s.play('bass', m, beat + k, 0.85, k ? 0.36 : 0.44));
    }
    s.play('kick', 0, 0, 1, 0.42);
    s.play('kick', 0, 2.5, 1, 0.3);
    s.play('brush', 0, 1, 1, 0.32);
    s.play('brush', 0, 3, 1, 0.32);
    for (let k = 0; k < s.def.meter * 2; k++) s.play('hat', 0, k * 0.5, 0.1, k % 2 ? 0.1 : 0.06);
    for (const n of s.melody(i)) s.play('melody', n.midi, n.beat, n.dur, offBeat(n.beat) ? 0.4 : 0.46);
    const pops = Math.floor(s.rand() * 4);
    for (let k = 0; k < pops; k++) s.play('crackle', 0, s.rand() * s.def.meter, 1, 0.04 + s.rand() * 0.06);
  },

  // BGM-08 도토리상점: 통통 튀는 뜯는 베이스 + 뒷박 마림바 + 킥·스냅·셰이커, 두 번째 바퀴는 종 겹치기
  shop(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const root = s.bass(chord, 38);
      const pat = dur === s.def.meter
        ? [[0, root], [1, root + 7], [1.5, root + 12], [2, root], [3, root + 7], [3.5, root + 12]]
        : [[0, root], [1, root + 7]];
      for (const [b, m] of pat) s.play('bass', m, beat + b, offBeat(b) ? 0.22 : 0.4, offBeat(b) ? 0.32 : 0.48);
      const v = s.voicing(chord, 67, 3);
      for (let b = 0.5; b < dur; b += 1) for (const m of v) s.play('keys', m, beat + b, 0.25, 0.14);
    }
    s.play('kick', 0, 0, 1, 0.45);
    s.play('kick', 0, 2, 1, 0.4);
    s.play('snap', 0, 1, 1, 0.3);
    s.play('snap', 0, 3, 1, 0.3);
    for (let k = 0; k < s.def.meter * 2; k++) s.play('shaker', 0, k * 0.5, 0.2, k % 2 ? 0.15 : 0.08);
    if (s.rand() < 0.35) s.play('wood', 0, 3.75, 0.2, 0.2);
    for (const n of s.melody(i)) {
      s.play('melody', n.midi, n.beat, n.dur * 0.7, offBeat(n.beat) ? 0.48 : 0.55);
      if (alt) s.play('bell', n.midi + 12, n.beat, n.dur * 0.6, 0.12);
    }
  },

  // BGM-09 박물관: 긴 패드 + 하프 분산화음 + 종 멜로디, 두 번째 바퀴는 플루트 + 높은 종
  museum(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.play('pad', s.voicing(chord, 64), beat, dur, 0.24);
      s.play('bass', s.bass(chord, 40), beat, dur, 0.34);
      const v = [s.bass(chord, 52), ...s.voicing(chord, 66)];
      if (alt) {
        for (let k = 0; k < dur * 2; k++) s.play('harp', v[Math.min(k < 4 ? k : 8 - k, v.length - 1)], beat + k * 0.5, 2, 0.1);
      } else {
        for (let k = 0; k < dur; k++) s.play('harp', v[k % v.length], beat + k, 2.5, 0.15);
      }
    }
    for (const n of s.melody(i)) {
      if (alt) {
        s.play('flute', n.midi, n.beat, n.dur * 0.97, 0.19);
        s.play('bellHigh', n.midi + 12, n.beat, n.dur, 0.07);
      } else s.play('melody', n.midi, n.beat, n.dur * 1.5, 0.36);
    }
  },
};

/** 반주 모양마다 쓰는 파트 (곡 데이터 parts 에 이 이름이 있어야 한다) */
export const ARRANGE_PARTS = {
  dawn: ['melody', 'sparkle', 'bass', 'comp', 'bird'],
  morning: ['melody', 'harmony', 'comp', 'bass', 'kick', 'shaker', 'wood', 'bird'],
  afternoon: ['melody', 'flute', 'strum', 'bass', 'shaker', 'bird'],
  evening: ['lead', 'leadAlt', 'pad', 'keys', 'bass'],
  night: ['melody', 'arp', 'pad', 'cricket'],
  rain: ['melody', 'echo', 'pad', 'bass', 'drip'],
  indoor: ['melody', 'keys', 'bass', 'kick', 'brush', 'hat', 'crackle'],
  shop: ['melody', 'bell', 'keys', 'bass', 'kick', 'snap', 'shaker', 'wood'],
  museum: ['melody', 'flute', 'bellHigh', 'pad', 'harp', 'bass'],
};

// ── 곡 내내 도는 배경 소리 (곡 데이터 loops) ──
const LOOPS = {
  // 빗소리 + 바람처럼 천천히 커졌다 작아지는 LFO
  rain(s, o) {
    const { ac } = s;
    const src = s.node(ac.createBufferSource());
    src.buffer = rainBuffer(s.engine);
    src.loop = true;
    const g = s.node(ac.createGain());
    g.gain.value = o.gain ?? 0.12;
    const lfo = s.node(ac.createOscillator());
    lfo.frequency.value = o.lfo ?? 0.06;
    const lg = s.node(ac.createGain());
    lg.gain.value = o.depth ?? 0.03;
    lfo.connect(lg).connect(g.gain);
    src.connect(g).connect(s.bus);
    s.loop(src); s.loop(lfo);
  },
  // 라디오 잡음 '쉬—'
  hiss(s, o) {
    const { ac } = s;
    const n = s.node(s.engine.noise(true));
    const bp = s.node(ac.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = o.f ?? 2600; bp.Q.value = o.q ?? 0.5;
    const g = s.node(ac.createGain()); g.gain.value = o.gain ?? 0.02;
    n.connect(bp).connect(g).connect(s.bus);
    s.loop(n);
  },
};
export const LOOP_KINDS = Object.keys(LOOPS);

// 라디오 음질: 저음·고음을 깎고 가운데를 살짝 올린 뒤 약하게 찌그러뜨린다 (곡 데이터 radio)
function radioChain(s, o) {
  const { ac } = s;
  const hp = s.node(ac.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = o.low ?? 320; hp.Q.value = 0.7;
  const pk = s.node(ac.createBiquadFilter()); pk.type = 'peaking'; pk.frequency.value = o.mid ?? 1500; pk.gain.value = o.midGain ?? 4; pk.Q.value = 0.9;
  const lp = s.node(ac.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = o.high ?? 3300; lp.Q.value = 0.9;
  const sh = s.node(ac.createWaveShaper()); sh.curve = saturate(o.drive ?? 1.8);
  return [hp, pk, lp, sh];
}

function saturate(drive) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / drive; }
  return c;
}

const text = v => (Array.isArray(v) ? v.join('\n') : String(v ?? ''));

/** 곡 데이터 → 곡 정의. 맞지 않는 곳이 있으면 한국어 오류를 던진다 (편집기가 그대로 보여 준다) */
export function buildSong(json) {
  const id = json?.id;
  if (!id) throw new Error('곡 id 가 없어요');
  const fail = msg => { throw new Error(`${json.title ?? id}: ${msg}`); };
  const bar = ARRANGE[json.arrange];
  if (!bar) fail(`없는 반주 모양 '${json.arrange}'`);
  if (!(json.bpm >= 20 && json.bpm <= 300)) fail(`빠르기는 20~300 이어야 해요 (지금 ${json.bpm})`);
  if (![2, 3, 4, 5, 6].includes(json.meter)) fail(`박자는 2~6 이어야 해요 (지금 ${json.meter})`);
  if (!(Number.isInteger(json.bars) && json.bars >= 1 && json.bars <= 64)) fail(`마디 수는 1~64 이어야 해요 (지금 ${json.bars})`);
  const channels = json.channels ?? {};
  const parts = json.parts ?? {};
  for (const role of ARRANGE_PARTS[json.arrange]) if (!parts[role]) fail(`파트 '${role}' 가 없어요 (반주 모양 ${json.arrange})`);
  for (const [role, p] of Object.entries(parts)) {
    if (!INSTRUMENTS[p.inst]) fail(`파트 ${p.label ?? role}: 없는 악기 '${p.inst}'`);
    if (!channels[p.ch]) fail(`파트 ${p.label ?? role}: 없는 채널 '${p.ch}'`);
  }
  for (const l of json.loops ?? []) if (!LOOPS[l.kind]) fail(`없는 배경 소리 '${l.kind}'`);
  if (json.room && !ROOMS[json.room]) fail(`없는 울림 '${json.room}'`);
  const scale = SCALES[json.scale ?? 'major'];
  if (!scale) fail(`없는 음계 '${json.scale}'`);

  const def = {
    ...json, name: id,
    prog: text(json.prog), mel: text(json.mel),
    reverb: ROOMS[json.room ?? 'medium'],
    scaleSet: scale(keyToPc(json.key)),
    bar,
    post: json.radio ? s => radioChain(s, json.radio) : undefined,
    setup(s) {
      for (const [name, c] of Object.entries(channels)) s.channel(name, c);
      for (const l of json.loops ?? []) LOOPS[l.kind](s, l);
    },
  };
  try { def.progBars = parseProg(def.prog, def.meter); } catch (e) { fail(`화음 — ${e.message}`); }
  let seq;
  try { seq = parseSeq(def.mel, def.meter); } catch (e) { fail(`멜로디 — ${e.message}`); }
  if (def.progBars.length !== def.bars) fail(`화음이 ${def.progBars.length}마디예요 (마디 수 ${def.bars})`);
  if (Math.abs(seq.length - def.bars * def.meter) > 1e-6) fail(`멜로디가 ${seq.length}박이에요 (${def.bars}마디 × ${def.meter}박 = ${def.bars * def.meter}박)`);
  def.melBars = splitBars(seq, def.meter, def.bars);
  def.loopSec = (60 / def.bpm) * def.meter * def.bars;
  return def;
}

/** 지금 쓰는 곡들 (id → 곡 정의). 데이터를 불러오면 채운다 (bank.js installSound) */
export const SONGS = {};
/** 곡 id 순서 (index.json 의 songs) */
export const TRACKS = [];

/** 곡 데이터 여러 개로 바꾸기 → 읽지 못한 곡의 오류 목록 */
export function setSongs(list) {
  for (const k of Object.keys(SONGS)) delete SONGS[k];
  TRACKS.length = 0;
  const errors = [];
  for (const json of list) {
    try { SONGS[json.id] = buildSong(json); TRACKS.push(json.id); }
    catch (e) { errors.push(e.message); }
  }
  return errors;
}

/** 곡 하나만 바꾸기 (편집기 미리 듣기) */
export function setSong(json) {
  const def = buildSong(json);
  if (!SONGS[json.id]) TRACKS.push(json.id);
  SONGS[json.id] = def;
  return def;
}
