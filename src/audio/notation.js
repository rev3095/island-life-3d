// 악보 적는 법: 음 이름·화음 기호·멜로디 문자열을 숫자(MIDI)로 바꾼다.
// DOM·Web Audio 없이 도는 순수 코드라 node 에서도 확인할 수 있다.
//   멜로디:  'c5:.5 e5 g5:1 r:1 | ...'  → 음이름:박자(생략하면 앞 박자 그대로), r = 쉼표, | = 마디선(길이 검사)
//   화음:    'Fmaj7 | Dm7 | Csus4 C | ...' → 마디마다 화음, 한 마디에 둘이면 반씩

const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const acc = s => (s === '#' ? 1 : s === 'b' ? -1 : 0);

export const mtof = m => 440 * 2 ** ((m - 69) / 12);

/** 'f#5' → 78 (C4 = 60) */
export function noteToMidi(name) {
  const m = /^([a-g])([#b]?)(-?\d)$/i.exec(name);
  if (!m) throw new Error(`음 이름을 읽을 수 없어요: ${name}`);
  return (Number(m[3]) + 1) * 12 + PC[m[1].toLowerCase()] + acc(m[2]);
}

/** 멜로디 문자열 → { notes:[{beat, midi, dur}], length } (박 단위) */
export function parseSeq(str, meter = 4) {
  const notes = [];
  let beat = 0, dur = 1;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') {
      if (Math.abs(beat / meter - Math.round(beat / meter)) > 1e-6) throw new Error(`마디 길이가 안 맞아요 (${beat}박 근처)`);
      continue;
    }
    const [name, d] = tok.split(':');
    if (d) dur = parseFloat(d);
    if (name !== 'r') notes.push({ beat, midi: noteToMidi(name), dur });
    beat += dur;
  }
  return { notes, length: beat };
}

/** 마디별로 나눈 멜로디: [[{beat(마디 안), midi, dur}], ...] */
export function splitBars(seq, meter, bars) {
  const out = Array.from({ length: bars }, () => []);
  for (const n of seq.notes) {
    const i = Math.floor(n.beat / meter + 1e-9);
    if (i < bars) out[i].push({ ...n, beat: n.beat - i * meter });
  }
  return out;
}

// 화음 종류 → 근음에서 반음 간격
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], 9: [0, 4, 7, 10, 14],
};

/** 'C#m9', 'D/F#' → { sym, root, iv, pcs, bass } */
export function parseChord(sym) {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m || !(m[3] in QUAL)) throw new Error(`화음 기호를 읽을 수 없어요: ${sym}`);
  const root = (PC[m[1].toLowerCase()] + acc(m[2]) + 12) % 12;
  const iv = QUAL[m[3]];
  const bass = m[4] ? (PC[m[4].toLowerCase()] + acc(m[5]) + 12) % 12 : root;
  return { sym, root, iv, pcs: iv.map(i => (root + i) % 12), bass };
}

/** 화음 진행 문자열 → 마디마다 [{beat, dur, chord}] */
export function parseProg(str, meter = 4) {
  return str.split('|').map(s => s.trim()).filter(Boolean).map(bar => {
    const syms = bar.split(/\s+/);
    const each = meter / syms.length;
    return syms.map((s, k) => ({ beat: k * each, dur: each, chord: parseChord(s) }));
  });
}

const pcOf = m => ((m % 12) + 12) % 12;

/** 가운데 음(center) 근처 한 옥타브 안에 화음 음을 모은 자리바꿈. 음이 많으면 5음을 뺀다 */
export function voicing(chord, center, max = 4) {
  let pcs = chord.pcs;
  if (pcs.length > max) pcs = pcs.filter((_, i) => i !== 2);
  return pcs.map(pc => {
    let m = center - 6;
    while (pcOf(m) !== pc) m++;
    return m;
  }).sort((a, b) => a - b);
}

/** 베이스 음: low ~ low+11 사이의 근음(또는 분수화음의 베이스) */
export function bassNote(chord, low) {
  let m = low;
  while (pcOf(m) !== chord.bass) m++;
  return m;
}

/** 음계(반음 집합) 안에서 midi 보다 step 칸 위/아래 음 */
export function scaleStep(midi, scale, step) {
  let m = midi, left = Math.abs(step);
  const dir = Math.sign(step);
  while (left > 0) {
    m += dir;
    if (scale.includes(pcOf(m))) left--;
  }
  return m;
}

/** 장조 5음계 (키 반음 0 = C) */
export const pentatonic = key => [0, 2, 4, 7, 9].map(i => (i + key) % 12);
/** 장음계 */
export const major = key => [0, 2, 4, 5, 7, 9, 11].map(i => (i + key) % 12);

/** 시드가 같으면 같은 순서로 나오는 난수 (곡 변주를 매번 똑같이 만들 때) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
