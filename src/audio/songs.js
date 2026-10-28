// 배경음 9곡 (모두 오리지널). 장조 5음계 위주 멜로디 + 화음 진행 + 곡마다 다른 반주 패턴.
// 한 바퀴 30~60초, 두 번째 바퀴(pass 홀수)는 옥타브·꾸밈음·악기 바꾸기 같은 변주가 들어간다.
// bar(s, i, pass): i 번째 마디의 음을 s.note(악기, 채널, 음, 박, 길이(박), 세기, 옵션) 로 예약한다.
import { parseSeq, parseProg, splitBars, scaleStep, pentatonic, major } from './notation.js';
import { rainBuffer } from './instruments.js';

function define(def) {
  def.progBars = parseProg(def.prog, def.meter);
  const seq = parseSeq(def.mel, def.meter);
  if (def.progBars.length !== def.bars) throw new Error(`${def.name}: 화음 ${def.progBars.length}마디 ≠ ${def.bars}`);
  if (Math.abs(seq.length - def.bars * def.meter) > 1e-6) throw new Error(`${def.name}: 멜로디 ${seq.length}박 ≠ ${def.bars * def.meter}`);
  def.melBars = splitBars(seq, def.meter, def.bars);
  def.loopSec = (60 / def.bpm) * def.meter * def.bars;
  return def;
}

// 잔향 크기 4가지 (곡끼리 IR 버퍼를 같이 쓴다)
const ROOM = { small: { seconds: 1.4, damp: 0.55 }, medium: { seconds: 2.6, damp: 0.6 }, large: { seconds: 3.2, damp: 0.65 }, hall: { seconds: 5, damp: 0.35 } };

const pick = (s, arr) => arr[Math.floor(s.rand() * arr.length)];
const offBeat = b => b % 1 !== 0;

const bird = (s, p = 0.3) => {
  if (s.rand() < p) s.note('bird', 'amb', 0, s.rand() * (s.def.meter - 1), 1, 0.05 + s.rand() * 0.03, { variant: Math.floor(s.rand() * 5), rate: 0.85 + s.rand() * 0.3 });
};

// ── BGM-01 새벽: 조용한 피아노, F장조 72bpm ──
const F_PENTA = pentatonic(5);
const dawn = define({
  name: 'dawn', title: '새벽', mood: '조용한 피아노', bpm: 72, meter: 4, bars: 16, gain: 1.33,
  reverb: ROOM.medium,
  prog: `Fmaj7 | Dm7 | Bbmaj7 | C7sus4 | Fmaj7 | Am7 | Bbmaj7 | Csus4 C |
         Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | Am7 | Gm7 | C7sus4`,
  mel: `r:1 a4:.5 c5 d5:1 c5 | a4:1.5 g4:.5 f4:2 | r:1 f4:.5 g4 a4:1 d5 | c5:3 r:1 |
        r:1 a4:.5 c5 f5:1 e5:.5 d5 | c5:1.5 a4:.5 g4:2 | f4:1 g4 a4 c5 | g4:3 r:1 |
        d5:1.5 c5:.5 d5:1 f5 | e5:1.5 c5:.5 a4:2 | d5:1 c5:.5 a4 g4:1 a4 | c5:3 r:1 |
        d5:1 f5 g5:1.5 f5:.5 | e5:1 c5 a4:2 | g4:1 a4 c5 d5 | c5:2 r:2`,
  setup(s) {
    s.channel('rh', { gain: 0.6, pan: 0.08, verb: 0.38 });
    s.channel('lh', { gain: 0.5, pan: -0.12, verb: 0.32 });
    s.channel('amb', { gain: 0.6, pan: 0.45, verb: 0.5 });
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.note('piano', 'lh', s.bass(chord, 41), beat, dur, 0.5);
      const v = s.voicing(chord, 60);
      if (!alt) {
        const pat = [v[0], v[1], v[2], v[1], v[2], v.at(-1), v[2]];      // 왼손 분산화음 (8분음표)
        for (let k = 0; k < dur * 2 - 1; k++) s.note('piano', 'lh', pat[k], beat + 0.5 + k * 0.5, 0.9, 0.24);
      } else {
        for (let k = 1; k < dur; k++) for (const m of (k % 2 ? [v[1], v[2]] : [v[0], v.at(-1)])) s.note('piano', 'lh', m, beat + k, 0.95, 0.2);
      }
    }
    const hi = alt && i >= 8;                                             // 두 번째 바퀴 후반: 한 옥타브 위
    for (const n of s.melody(i)) {
      const vel = offBeat(n.beat) ? 0.44 : 0.5;
      if (alt && n.dur >= 1.5 && n.beat > 0 && s.rand() < 0.45) s.note('piano', 'rh', scaleStep(n.midi, F_PENTA, 1) + (hi ? 12 : 0), n.beat - 0.18, 0.2, 0.2);
      s.note('piano', 'rh', n.midi + (hi ? 12 : 0), n.beat, n.dur * 1.2, hi ? vel * 0.85 : vel);
      if (hi) s.note('piano', 'rh', n.midi, n.beat, n.dur, vel * 0.32);
    }
    if (s.rand() < (alt ? 0.45 : 0.25)) s.note('piano', 'rh', pick(s, [84, 86, 89, 91, 93]), 3.5, 1.5, 0.12);
    bird(s, 0.3);
  },
});

// ── BGM-02 오전: 밝은 마림바, C장조 96bpm ──
const C_MAJOR = major(0);
const morning = define({
  name: 'morning', title: '오전', mood: '밝은 마림바', bpm: 96, meter: 4, bars: 16, gain: 1.05,
  reverb: ROOM.medium,
  prog: `C | Am | F | G | C | Em | F G | C | F | G | Em | Am | Dm7 | G | C/E F | G`,
  mel: `c5:.5 e5 g5:1 a5:.5 g5 e5:1 | d5:.5 e5 c5:1 a4:2 | a4:.5 c5 d5:1 e5:.5 d5 c5:1 | d5:1.5 e5:.5 d5:2 |
        c5:.5 e5 g5:1 a5:.5 g5 c6:1 | b5:.5 g5 e5:1 g5:2 | a5:.5 g5 a5:1 g5:.5 e5 d5:1 | c5:3 r:1 |
        c5:.5 d5 f5:1 a5 g5 | g5:.5 a5 g5 e5 d5:2 | e5:.5 g5 b5:1 a5:.5 g5 e5:1 | a5:1.5 g5:.5 e5:2 |
        d5:.5 e5 f5 a5 c6:1 a5 | g5:1 d5:.5 e5 g5:2 | e5:.5 g5 c6:1 a5:.5 g5 f5:1 | e5:1 d5 r:2`,
  setup(s) {
    s.channel('mel', { gain: 0.62, pan: 0.12, verb: 0.24 });
    s.channel('har', { gain: 0.5, pan: 0.3, verb: 0.24 });
    s.channel('comp', { gain: 0.5, pan: -0.28, verb: 0.2 });
    s.channel('bass', { gain: 0.62, pan: 0, verb: 0.05 });
    s.channel('kick', { gain: 0.5, pan: 0, verb: 0 });
    s.channel('perc', { gain: 0.42, pan: 0.32, verb: 0.12 });
    s.channel('amb', { gain: 0.55, pan: -0.45, verb: 0.45 });
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const root = s.bass(chord, 36);
      s.note('bass', 'bass', root, beat, 0.9, 0.5);
      if (dur === 4) s.note('bass', 'bass', root + 7, beat + 2, 0.9, 0.4);
      if (alt && dur === 4) s.note('bass', 'bass', root + 12, beat + 3.5, 0.4, 0.26);
      const v = s.voicing(chord, 66);
      for (let k = 0.5; k < dur; k += 1) for (const m of [v[0], v[2] ?? v[1]]) s.note('marimba', 'comp', m, beat + k, 0.4, 0.22);
    }
    for (let k = 0; k < 8; k++) s.note('shaker', 'perc', 0, k * 0.5, 0.2, k % 2 ? 0.16 : 0.09);
    s.note('kick', 'kick', 0, 0, 1, 0.34);
    s.note('kick', 'kick', 0, 2, 1, 0.26);
    if (alt && i % 4 === 3) { s.note('wood', 'perc', 0, 3, 0.2, 0.22); s.note('wood', 'perc', 0, 3.5, 0.2, 0.18); }
    for (const n of s.melody(i)) {
      const vel = offBeat(n.beat) ? 0.48 : 0.55;
      if (alt && n.dur >= 2) {                                            // 긴 음은 마림바답게 굴린다
        for (let b = 0; b < n.dur - 0.2; b += 0.25) s.note('marimba', 'mel', n.midi, n.beat + b, 0.3, vel * (b ? 0.5 : 1));
      } else s.note('marimba', 'mel', n.midi, n.beat, n.dur, vel);
      if (alt && i >= 8) s.note('marimba', 'har', scaleStep(n.midi, C_MAJOR, -2), n.beat, n.dur, vel * 0.42);
    }
    bird(s, 0.28);
  },
});

// ── BGM-03 오후: 느긋한 우쿨렐레풍, G장조 88bpm (살짝 스윙) ──
const STRUM = [[0, 'D'], [1, 'D'], [1.5, 'U'], [2.5, 'U'], [3, 'D'], [3.5, 'U']];
const STRUM_LAZY = [[0, 'D'], [2, 'D'], [2.5, 'U'], [3.5, 'U']];
const afternoon = define({
  name: 'afternoon', title: '오후', mood: '느긋한 우쿨렐레', bpm: 88, meter: 4, bars: 16, swing: 0.1, gain: 1.7,
  reverb: ROOM.small,
  prog: `G | Em7 | Cmaj7 | D | G | Bm7 | Cmaj7 | D7 | C | D | Bm7 | Em7 | Am7 | D | G Em7 | Am7 D`,
  mel: `d5:1 b4:.5 d5 e5:1 d5 | b4:1.5 a4:.5 g4:2 | e4:.5 g4 a4 b4 d5:1 b4 | a4:3 r:1 |
        d5:1 b4:.5 d5 g5:1 e5 | d5:1.5 b4:.5 a4:1 b4 | g4:.5 a4 b4 d5 e5:1 g5 | f#5:2 e5:1 d5 |
        e5:1.5 d5:.5 e5:1 g5 | a5:1.5 g5:.5 e5:1 d5 | d5:1 b4 d5:.5 e5 d5:1 | b4:3 r:1 |
        c5:.5 b4 a4 g4 e4:1 g4 | a4:1.5 b4:.5 d5:2 | b4:.5 d5 g5:1 e5:.5 d5 b4:1 | a4:2 r:2`,
  setup(s) {
    s.channel('strum', { gain: 0.55, pan: -0.22, verb: 0.18 });
    s.channel('mel', { gain: 0.66, pan: 0.14, verb: 0.22 });
    s.channel('flute', { gain: 0.5, pan: 0.25, verb: 0.3 });
    s.channel('bass', { gain: 0.6, pan: 0, verb: 0.04 });
    s.channel('perc', { gain: 0.36, pan: 0.3, verb: 0.1 });
    s.channel('amb', { gain: 0.5, pan: -0.45, verb: 0.45 });
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const v = s.voicing(chord, 64);
      const pat = (alt ? STRUM_LAZY : STRUM).filter(([b]) => b < dur);
      pat.forEach(([b, dir], k) => {
        const next = pat[k + 1]?.[0] ?? dur;
        const strings = dir === 'D' ? v : v.slice(1).reverse();          // 위로 칠 때는 높은 줄만, 반대 순서
        strings.forEach((m, j) => s.note('uke', 'strum', m, beat + b, (next - b) * 0.95, dir === 'D' ? 0.2 : 0.13, { nudge: j * 0.014 }));
      });
      const root = s.bass(chord, 40);
      s.note('pluckbass', 'bass', root, beat, Math.min(dur, 2) * 0.8, 0.5);
      if (dur === 4) s.note('pluckbass', 'bass', root + 7, beat + 2, 1.4, 0.42);
      if (alt && dur === 4) s.note('pluckbass', 'bass', root + 12, beat + 3.5, 0.4, 0.3);
    }
    for (let k = 0; k < 4; k++) s.note('shaker', 'perc', 0, k + 0.5, 0.2, 0.1);
    for (const n of s.melody(i)) {
      s.note('uke', 'mel', n.midi, n.beat, n.dur, offBeat(n.beat) ? 0.46 : 0.52);
      if (alt && i >= 8) s.note('flute', 'flute', n.midi, n.beat, n.dur * 0.95, 0.16, { vibrato: s.vibrato() });
    }
    bird(s, 0.15);
  },
});

// ── BGM-04 저녁: 따뜻한 패드, E♭장조 76bpm ──
const evening = define({
  name: 'evening', title: '저녁', mood: '따뜻한 패드', bpm: 76, meter: 4, bars: 16, gain: 0.77,
  reverb: ROOM.medium,
  prog: `Ebmaj7 | Cm7 | Abmaj7 | Bb7sus4 | Ebmaj7 | Gm7 | Abmaj7 | Bbsus4 Bb |
         Abmaj7 | Bb | Gm7 | Cm7 | Fm7 | Bb7sus4 | Ebmaj7 Abmaj7 | Bbsus4`,
  mel: `g4:2 bb4:1 c5 | bb4:3 g4:1 | c5:1.5 bb4:.5 g4:1 f4 | f4:4 |
        g4:2 bb4:1 eb5 | d5:2 bb4 | c5:1 eb5 f5 eb5 | bb4:4 |
        c5:2 eb5:1 f5 | f5:2 d5:1 bb4 | bb4:1.5 c5:.5 d5:1 bb4 | g4:3 r:1 |
        ab4:1 c5 eb5 f5 | f5:2 eb5:1 c5 | bb4:2 c5 | bb4:4`,
  setup(s) {
    s.channel('pad', { gain: 0.55, pan: 0, verb: 0.35 });
    s.channel('lead', { gain: 0.6, pan: 0.1, verb: 0.34 });
    s.channel('keys', { gain: 0.5, pan: -0.25, verb: 0.3 });
    s.channel('bass', { gain: 0.55, pan: 0, verb: 0.05 });
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.note('pad', 'pad', s.voicing(chord, 60), beat, dur, 0.24, { attack: 0.9, release: 1.6, cutoff: 1400 });
      const root = s.bass(chord, 39);
      s.note('bass', 'bass', root, beat, dur * 0.95, 0.45);
      if (alt && dur === 4) s.note('bass', 'bass', root + 7, beat + 2.5, 1.3, 0.28);
      const v = s.voicing(chord, 74);
      (alt ? [0.5, 1.5, 2, 3] : [1, 2, 3]).filter(b => b < dur)
        .forEach((b, k) => s.note('ep', 'keys', v[(k + 1) % v.length], beat + b, 1, 0.14));
    }
    const useEp = alt && i < 8;                                           // 두 번째 바퀴 앞부분은 전자피아노가 노래
    for (const n of s.melody(i)) {
      if (useEp) s.note('ep', 'lead', n.midi, n.beat, n.dur, 0.36);
      else s.note('flute', 'lead', n.midi, n.beat, n.dur * 0.96, 0.32, { vibrato: s.vibrato(4.8, 10) });
    }
  },
});

// ── BGM-05 밤: 오르골, D장조 3/4박자 64bpm ──
const night = define({
  name: 'night', title: '밤', mood: '오르골', bpm: 64, meter: 3, bars: 16, gain: 1.29,
  reverb: ROOM.medium,
  prog: `D | Bm | G | A | D | F#m | G | A | G | A | F#m | Bm | Em | A | D/F# G | A`,
  mel: `a5:1.5 f#5:.5 e5:1 | d5:2 b4:1 | b4:1 d5 e5 | e5:2 r:1 |
        a5:1.5 b5:.5 a5:1 | f#5:2 e5:1 | d5:.5 e5 f#5:1 d5 | e5:3 |
        b5:1.5 a5:.5 f#5:1 | e5:1.5 f#5:.5 a5:1 | a5:1 f#5 e5 | d5:2 b4:1 |
        e5:1 g5 b5 | a5:2 e5:1 | f#5:1.5 e5:.5 d5:1 | e5:2 r:1`,
  setup(s) {
    s.channel('mel', { gain: 0.6, pan: 0.12, verb: 0.3 });
    s.channel('low', { gain: 0.55, pan: -0.15, verb: 0.28 });
    s.channel('pad', { gain: 0.5, pan: 0, verb: 0.3 });
    s.channel('amb', { gain: 0.5, pan: 0.5, verb: 0.4 });
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const b0 = s.bass(chord, 50), v = s.voicing(chord, 69);
      const pat = [b0, v[0], v[1], v[2], v[1], v[0]];
      for (let k = 0; k < dur * 2; k++) s.note('musicbox', 'low', pat[k], beat + k * 0.5, 1.2, k ? 0.17 : 0.24);
      s.note('pad', 'pad', [b0 - 12, b0 - 5], beat, dur, 0.09, { attack: 1.2, release: 1.8, cutoff: 650 });
    }
    const up = alt && i < 8;
    for (const n of s.melody(i)) s.note('musicbox', 'mel', n.midi + (up ? 12 : 0), n.beat, n.dur * 1.5, up ? 0.36 : 0.44);
    if (s.rand() < 0.35) s.note('cricket', 'amb', 0, s.rand() * 2.5, 1, 0.045, { variant: Math.floor(s.rand() * 3), rate: 0.95 + s.rand() * 0.1 });
  },
});

// ── BGM-06 비 오는 날: 낮은 패드 + 빗소리, A단조 5음계 66bpm ──
const rain = define({
  name: 'rain', title: '비 오는 날', mood: '낮은 패드 + 빗소리', bpm: 66, meter: 4, bars: 12, gain: 0.9,
  reverb: ROOM.large,
  prog: `Am9 | Fmaj7 | Cmaj7 | G6 | Am9 | Fmaj7 | Dm9 | Em7 | Fmaj7 | G6 | Am9 | Esus4`,
  mel: `r:1 e5:1.5 d5:.5 c5:1 | a4:3 r:1 | r:1 g4 c5 d5 | e5:2 d5 |
        r:1 e5:1.5 g5:.5 e5:1 | d5 c5 a4:2 | r:1 a4 c5 e5 | d5:3 r:1 |
        c5:1.5 a4:.5 c5:1 e5 | d5:2 b4:1 g4 | c5 e5 a5:2 | e5:3 r:1`,
  setup(s) {
    s.channel('pad', { gain: 0.6, pan: 0, verb: 0.3 });
    s.channel('mel', { gain: 0.62, pan: 0.1, verb: 0.36 });
    s.channel('echo', { gain: 0.5, pan: -0.35, verb: 0.5 });
    s.channel('bass', { gain: 0.55, pan: 0, verb: 0.04 });
    s.channel('amb', { gain: 0.5, pan: 0.3, verb: 0.3 });
    // 빗소리 (곡 내내) + 바람처럼 천천히 커졌다 작아지는 LFO
    const { ac } = s;
    const src = s.node(ac.createBufferSource());
    src.buffer = rainBuffer(s.engine);
    src.loop = true;
    const g = s.node(ac.createGain());
    g.gain.value = 0.12;
    const lfo = s.node(ac.createOscillator());
    lfo.frequency.value = 0.06;
    const lg = s.node(ac.createGain());
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    src.connect(g).connect(s.bus);
    s.loop(src); s.loop(lfo);
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.note('pad', 'pad', s.voicing(chord, 55), beat, dur, 0.2, { attack: 1.8, release: 2.2, cutoff: 800 });
      s.note('bass', 'bass', s.bass(chord, 33), beat, dur * 0.95, 0.4);
    }
    for (const n of s.melody(i)) {
      s.note('kalimba', 'mel', n.midi, n.beat, n.dur * 1.4, 0.48);
      if (alt) s.note('kalimba', 'echo', n.midi, n.beat + 0.75, n.dur, 0.16);   // 메아리처럼 한 번 더
    }
    for (let b = 0; b < 4; b++) {
      if (s.rand() < 0.55) s.note('drip', 'amb', 0, b + s.rand() * 0.9, 1, 0.05 + s.rand() * 0.05, { variant: Math.floor(s.rand() * 4), rate: 0.75 + s.rand() * 0.6 });
    }
  },
});

// ── BGM-07 실내: 작은 라디오 음질, B♭장조 84bpm (스윙) ──
const indoor = define({
  name: 'indoor', title: '실내', mood: '작은 라디오', bpm: 84, meter: 4, bars: 16, swing: 0.1, gain: 0.76,
  reverb: ROOM.small,
  prog: `Bbmaj7 | Gm7 | Cm7 | F7 | Dm7 | Gm7 | Cm7 | F7sus4 F7 |
         Ebmaj7 | Dm7 | Cm7 | Bbmaj7 | Ebmaj7 | Dm7 G7 | Cm7 | F7sus4`,
  mel: `d5:1 f5:.5 g5 f5:1 d5 | bb4:1.5 c5:.5 d5:2 | c5:.5 d5 eb5 g5 f5:1 eb5 | c5:3 r:1 |
        f5:1 d5:.5 f5 a5:1 g5 | f5:1.5 d5:.5 bb4:2 | c5:1 eb5 g5 f5 | f5:2 r:2 |
        g5:1.5 f5:.5 d5:1 bb4 | a4:1 c5 d5:2 | eb5:1 d5:.5 c5 bb4:1 g4 | d5:3 r:1 |
        g4:.5 bb4 d5 f5 g5:2 | f5:1 d5 b4 d5 | c5:1.5 d5:.5 eb5:1 g5 | f5:2 r:2`,
  // 라디오: 저음·고음을 깎고 가운데를 살짝 올린 뒤 약하게 찌그러뜨린다
  post(s) {
    const { ac } = s;
    const hp = s.node(ac.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 320; hp.Q.value = 0.7;
    const pk = s.node(ac.createBiquadFilter()); pk.type = 'peaking'; pk.frequency.value = 1500; pk.gain.value = 4; pk.Q.value = 0.9;
    const lp = s.node(ac.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 3300; lp.Q.value = 0.9;
    const sh = s.node(ac.createWaveShaper()); sh.curve = saturate(1.8);
    return [hp, pk, lp, sh];
  },
  setup(s) {
    s.channel('keys', { gain: 0.5, pan: -0.1, verb: 0.15 });
    s.channel('lead', { gain: 0.6, pan: 0.08, verb: 0.18 });
    s.channel('bass', { gain: 0.6, pan: 0, verb: 0.02 });
    s.channel('drums', { gain: 0.5, pan: 0, verb: 0.08 });
    s.channel('hat', { gain: 0.4, pan: 0.2, verb: 0.05 });
    s.channel('amb', { gain: 0.5, pan: 0, verb: 0 });
    // 라디오 잡음 '쉬—'
    const { ac } = s;
    const n = s.node(s.engine.noise(true));
    const bp = s.node(ac.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.5;
    const g = s.node(ac.createGain()); g.gain.value = 0.02;
    n.connect(bp).connect(g).connect(s.bus);
    s.loop(n);
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const v = s.voicing(chord, 63);
      const hits = dur === 4 ? [[0, 1.4, 0.2], [2.5, 1.2, 0.16]] : [[0, 1.4, 0.18]];
      if (alt && dur === 4) hits.push([1.5, 0.4, 0.11]);
      for (const [b, d, vel] of hits) for (const m of v) s.note('ep', 'keys', m, beat + b, d, vel);
      const root = s.bass(chord, 46);
      const walk = dur === 4 ? [root, root + 7, root + 12, root + 7] : [root, root + 7];
      walk.forEach((m, k) => s.note('bass', 'bass', m, beat + k, 0.85, k ? 0.36 : 0.44));
    }
    s.note('kick', 'drums', 0, 0, 1, 0.42);
    s.note('kick', 'drums', 0, 2.5, 1, 0.3);
    s.note('brush', 'drums', 0, 1, 1, 0.32);
    s.note('brush', 'drums', 0, 3, 1, 0.32);
    for (let k = 0; k < 8; k++) s.note('hat', 'hat', 0, k * 0.5, 0.1, k % 2 ? 0.1 : 0.06);
    for (const n of s.melody(i)) s.note('vibes', 'lead', n.midi, n.beat, n.dur, offBeat(n.beat) ? 0.4 : 0.46);
    const pops = Math.floor(s.rand() * 4);
    for (let k = 0; k < pops; k++) s.note('crackle', 'amb', 0, s.rand() * 4, 1, 0.04 + s.rand() * 0.06);
  },
});

// ── BGM-08 도토리상점: 경쾌한 리듬, D장조 112bpm ──
const shop = define({
  name: 'shop', title: '도토리상점', mood: '경쾌한 리듬', bpm: 112, meter: 4, bars: 16, gain: 1.35,
  reverb: ROOM.small,
  prog: `D | Bm | G | A | D | Bm | Em A | D | G | A | F#m | Bm | G | A | Em A | D`,
  mel: `f#5:.5 a5 r a5 b5 a5 f#5:1 | d5:.5 f#5 r e5 d5:1 b4 | b4:.5 d5 r e5 d5 b4 d5:1 | e5:.5 e5 r f#5 e5:1 r |
        f#5:.5 a5 r a5 b5 a5 d6:1 | b5:.5 a5 r f#5 e5:1 d5 | e5:.5 g5 b5:1 a5:.5 g5 e5:1 | d5:2 r |
        d5:.5 e5 d5 b4 d5:1 e5 | e5:.5 f#5 e5 c#5 e5:1 a5 | a5:.5 f#5 r e5 f#5:1 a5 | b5:2 a5:1 f#5 |
        g5:.5 f#5 e5 d5 b4:1 d5 | e5:.5 f#5 a5 b5 a5:2 | b4:.5 d5 e5:1 a4:.5 c#5 e5:1 | d5:.5 r a4 d5 r:2`,
  setup(s) {
    s.channel('mel', { gain: 0.62, pan: 0.12, verb: 0.16 });
    s.channel('bell', { gain: 0.5, pan: 0.3, verb: 0.25 });
    s.channel('keys', { gain: 0.5, pan: -0.25, verb: 0.14 });
    s.channel('bass', { gain: 0.62, pan: 0, verb: 0.02 });
    s.channel('drums', { gain: 0.5, pan: 0, verb: 0.05 });
    s.channel('perc', { gain: 0.4, pan: 0.3, verb: 0.08 });
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      const root = s.bass(chord, 38);
      const pat = dur === 4
        ? [[0, root], [1, root + 7], [1.5, root + 12], [2, root], [3, root + 7], [3.5, root + 12]]
        : [[0, root], [1, root + 7]];
      for (const [b, m] of pat) s.note('pluckbass', 'bass', m, beat + b, offBeat(b) ? 0.22 : 0.4, offBeat(b) ? 0.32 : 0.48);
      const v = s.voicing(chord, 67, 3);
      for (let b = 0.5; b < dur; b += 1) for (const m of v) s.note('marimba', 'keys', m, beat + b, 0.25, 0.14);
    }
    s.note('kick', 'drums', 0, 0, 1, 0.45);
    s.note('kick', 'drums', 0, 2, 1, 0.4);
    s.note('snap', 'drums', 0, 1, 1, 0.3);
    s.note('snap', 'drums', 0, 3, 1, 0.3);
    for (let k = 0; k < 8; k++) s.note('shaker', 'perc', 0, k * 0.5, 0.2, k % 2 ? 0.15 : 0.08);
    if (s.rand() < 0.35) s.note('wood', 'perc', 0, 3.75, 0.2, 0.2);
    for (const n of s.melody(i)) {
      s.note('pluck', 'mel', n.midi, n.beat, n.dur * 0.7, offBeat(n.beat) ? 0.48 : 0.55);
      if (alt) s.note('bell', 'bell', n.midi + 12, n.beat, n.dur * 0.6, 0.12);
    }
  },
});

// ── BGM-09 박물관: 잔향 큰 느린 멜로디, E장조 60bpm ──
const museum = define({
  name: 'museum', title: '박물관', mood: '잔향 큰 느린 멜로디', bpm: 60, meter: 4, bars: 12, gain: 1.22,
  reverb: ROOM.hall,
  prog: `Emaj9 | C#m9 | Amaj7 | Bsus4 | Emaj9 | G#m7 | Amaj7 | B6 | C#m7 | Amaj7 | F#m9 | Bsus4`,
  mel: `e5:2 f#5:1 g#5 | g#5:3 e5:1 | c#5:2 e5:1 b4 | b4:4 |
        e5:2 f#5:1 b5 | b5:2 g#5 | c#6:1.5 b5:.5 g#5:1 e5 | f#5:4 |
        e5:2 g#5 | e5:1 c#5 b4:2 | c#5:2 a4:1 b4 | b4:4`,
  setup(s) {
    s.channel('pad', { gain: 0.5, pan: 0, verb: 0.55 });
    s.channel('mel', { gain: 0.6, pan: 0.08, verb: 0.6 });
    s.channel('flute', { gain: 0.55, pan: 0.15, verb: 0.6 });
    s.channel('harp', { gain: 0.5, pan: -0.25, verb: 0.55 });
    s.channel('bass', { gain: 0.5, pan: 0, verb: 0.25 });
  },
  bar(s, i, pass) {
    const alt = pass % 2 === 1;
    for (const { beat, dur, chord } of s.chords(i)) {
      s.note('pad', 'pad', s.voicing(chord, 64), beat, dur, 0.24, { attack: 2.2, release: 3, cutoff: 1700 });
      s.note('bass', 'bass', s.bass(chord, 40), beat, dur, 0.34, { release: 1.2 });
      const v = [s.bass(chord, 52), ...s.voicing(chord, 66)];
      if (alt) {
        for (let k = 0; k < dur * 2; k++) s.note('harp', 'harp', v[Math.min(k < 4 ? k : 8 - k, v.length - 1)], beat + k * 0.5, 2, 0.1);
      } else {
        for (let k = 0; k < dur; k++) s.note('harp', 'harp', v[k % v.length], beat + k, 2.5, 0.15);
      }
    }
    for (const n of s.melody(i)) {
      if (alt) {
        s.note('flute', 'flute', n.midi, n.beat, n.dur * 0.97, 0.19, { vibrato: s.vibrato(4.6, 8) });
        s.note('bell', 'mel', n.midi + 12, n.beat, n.dur, 0.07);
      } else s.note('bell', 'mel', n.midi, n.beat, n.dur * 1.5, 0.36);
    }
  },
});

function saturate(drive) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / drive; }
  return c;
}


export const SONGS = { dawn, morning, afternoon, evening, night, rain, indoor, shop, museum };
