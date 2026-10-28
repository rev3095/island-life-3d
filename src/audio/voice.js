// 주민 목소리 '웅얼웅얼'. 한글 한 글자 = 짧은 모음 소리 하나.
//  - 중성(모음)으로 포먼트(입 모양 공명) F1·F2 를 정하고, ㅑ·ㅘ 처럼 미끄러지는 모음은 시작 위치를 다르게 한다.
//  - 초성은 짧은 잡음(ㄱㄷㅂ 터짐, ㅅ 쉿, ㅎ 숨)으로, 받침은 소리를 짧게 끊거나 콧소리로 닫는다.
//  - 띄어쓰기·문장부호는 쉼. '?' 는 끝을 올리고 '!' 는 조금 크고 높게, '~' 는 앞 글자를 늘이며 올린다.
// 한 줄 전체를 오실레이터 1개 + 공명 필터 3개 + 잡음 1개의 자동화(automation)로 만들어서 노드가 적다.
import { rng, hashString } from './notation.js';

/** 캐릭터 slug → 목소리 (f0 = 기본 높이 Hz, syl = 글자 길이 초, formant = 입 크기 배율, gain = 크기 맞춤 dB) */
export const VOICES = {
  coco:    { name: '코코', desc: '높고 빠름',      f0: 410, syl: 0.072, gap: 0.012, formant: 1.22, jitter: 2.6, wave: 'glottal', gain: -1 },
  bori:    { name: '보리', desc: '중간 · 느림',    f0: 245, syl: 0.125, gap: 0.03,  formant: 1.0,  jitter: 1.6, wave: 'glottal', droop: 1.5, gain: 0.8 },
  mochi:   { name: '모찌', desc: '가장 높음',      f0: 590, syl: 0.085, gap: 0.016, formant: 1.38, jitter: 2.4, wave: 'soft', gain: -3 },
  dubu:    { name: '두부', desc: '가장 낮음',      f0: 118, syl: 0.12,  gap: 0.03,  formant: 0.8,  jitter: 1.3, wave: 'glottal', droop: 1, gain: 3.2 },
  pong:    { name: '퐁',   desc: '높고 통통 튐',   f0: 370, syl: 0.085, gap: 0.022, formant: 1.12, jitter: 1.5, wave: 'nasal', bounce: 4.5, gain: -0.4 },
  chorong: { name: '초롱', desc: '중간 · 빠름',    f0: 290, syl: 0.066, gap: 0.01,  formant: 1.05, jitter: 3,   wave: 'glottal', croak: 0.35, gain: 1.4 },
  bamtol:  { name: '밤톨', desc: '높고 또박또박',  f0: 475, syl: 0.085, gap: 0.04,  formant: 1.25, jitter: 1.4, wave: 'glottal', crisp: 1.6, gain: -2 },
  neuru:   { name: '느루', desc: '낮고 아주 느림', f0: 160, syl: 0.19,  gap: 0.055, formant: 0.92, jitter: 1,   wave: 'soft', droop: 3, gain: 2.2 },
  player:  { name: '플레이어', desc: '보통',       f0: 320, syl: 0.085, gap: 0.02,  formant: 1.08, jitter: 2,   wave: 'glottal', gain: -0.4 },
};

// 모음 포먼트 (Hz, 성인 기준 → 캐릭터 배율을 곱한다)
const VOWEL = { a: [760, 1250], e: [500, 1820], eo: [580, 960], o: [400, 760], u: [330, 850], eu: [360, 1380], i: [290, 2250] };
// 중성 21개: [모음, 미끄러짐 시작] (y = ㅣ에서, w = ㅜ에서, eu = ㅡ에서)
const JUNG = [
  ['a'], ['e'], ['a', 'y'], ['e', 'y'], ['eo'], ['e'], ['eo', 'y'], ['e', 'y'], ['o'], ['a', 'w'], ['e', 'w'],
  ['e', 'w'], ['o', 'y'], ['u'], ['eo', 'w'], ['e', 'w'], ['i', 'w'], ['u', 'y'], ['eu'], ['i', 'eu'], ['i'],
];
const GLIDE_FROM = { y: 'i', w: 'u', eu: 'eu' };
// 초성 19개 → 자음 종류
const CHO = ['stop', 'tense', 'nasal', 'stop', 'tense', 'liquid', 'nasal', 'stop', 'tense', 'fric', 'fric', 'none', 'affric', 'affric', 'asp', 'asp', 'asp', 'asp', 'breath'];
// 초성 터짐 소리 높이 (입 앞쪽일수록 높다): ㄱ계열 1800, ㄷ계열 3500, ㅂ계열 1000 ...
const CHO_F = [1800, 1800, 0, 3500, 3500, 0, 0, 1000, 1000, 5500, 5800, 0, 3800, 3800, 3800, 1900, 3500, 1100, 1500];
// 받침 28개 (0 = 없음) → 'stop' 끊김 / 'nasal' 콧소리 / 'liquid' ㄹ
const JONG = [null, 'stop', 'stop', 'stop', 'nasal', 'nasal', 'nasal', 'stop', 'liquid', 'liquid', 'liquid', 'liquid', 'liquid', 'liquid', 'liquid', 'liquid',
  'nasal', 'stop', 'stop', 'stop', 'stop', 'nasal', 'stop', 'stop', 'stop', 'stop', 'stop', 'stop'];
// 자음 잡음 모양: 길이(초), 크기, 필터 Q
const CONS = {
  stop: { len: 0.012, lvl: 0.5, q: 1.4 }, tense: { len: 0.008, lvl: 0.6, q: 1.6 }, asp: { len: 0.035, lvl: 0.42, q: 1 },
  fric: { len: 0.05, lvl: 0.32, q: 1.6 }, affric: { len: 0.03, lvl: 0.4, q: 1.3 }, breath: { len: 0.04, lvl: 0.22, q: 0.6 },
};
// 한글 낱자(ㄱ~ㅎ, ㅏ~ㅣ): 자음은 'ㅡ' 모음으로, 모음은 그대로
const COMPAT_CONS = 'ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const COMPAT_CONS_CHO = [0, 1, 0, 2, 2, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 7, 8, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const COMPAT_VOWEL = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const LATIN_VOWEL = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', y: 'i' };
const LATIN_ROT = ['a', 'eo', 'i', 'o', 'e', 'u', 'eu'];

const MAX_SYLLABLES = 60;

/** 글자 하나 → 소리 단위 { vowel, from, cho, jong } | { pause } | null(무시) */
function unitOf(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0xAC00 && c <= 0xD7A3) {
    const k = c - 0xAC00;
    const [vowel, from] = JUNG[Math.floor(k / 28) % 21];
    const cho = Math.floor(k / 588);
    return { vowel, from, cho, jong: JONG[k % 28] };
  }
  let i = COMPAT_CONS.indexOf(ch);
  if (i >= 0) return { vowel: 'eu', cho: COMPAT_CONS_CHO[i], jong: null, letter: true };
  i = COMPAT_VOWEL.indexOf(ch);
  if (i >= 0) { const [vowel, from] = JUNG[i]; return { vowel, from, cho: 11, jong: null }; }
  const low = ch.toLowerCase();
  if (/[a-z]/.test(low)) return { vowel: LATIN_VOWEL[low] ?? LATIN_ROT[low.charCodeAt(0) % LATIN_ROT.length], cho: LATIN_VOWEL[low] ? 11 : 0, jong: null, letter: true };
  if (/[0-9]/.test(ch)) return { vowel: LATIN_ROT[Number(ch) % LATIN_ROT.length], cho: 3, jong: null };
  if (/\s/.test(ch)) return { pause: 0.7 };
  if (/[,、·]/.test(ch)) return { pause: 2.2, extra: 0.06 };
  if (/[.。]/.test(ch)) return { pause: 2.6, extra: 0.1, end: 'period' };
  if (ch === '!') return { pause: 2.6, extra: 0.1, end: 'bang' };
  if (ch === '?') return { pause: 2.6, extra: 0.1, end: 'ask' };
  if (ch === '…') return { pause: 3.5, extra: 0.16 };
  if (ch === '~' || ch === '～') return { tilde: true };
  return null;
}

/**
 * 말하기 계획 (오디오 없이 계산 — 시간 맞추기·테스트용)
 * → { syllables:[{ t, dur, f0a, f0b, F1a, F2a, F1b, F2b, F1c, F2c, vel, cons }], total }
 */
export function planSpeech(text, voiceId) {
  const v = VOICES[voiceId] ?? VOICES.player;
  const r = rng(hashString(`${voiceId}:${text}`));
  const units = [];
  for (const ch of String(text ?? '')) {
    const u = unitOf(ch);
    if (!u) continue;
    if (u.tilde) { const last = units.findLast(x => x.vowel); if (last) last.tilde = true; continue; }
    units.push(u);
  }
  // 문장 끝 부호를 앞 글자들에 표시 ('?' → 끝 두 글자 올림, '!' → 문장 전체 강하게)
  let sentence = [];
  for (const u of units) {
    if (u.vowel) { sentence.push(u); continue; }
    if (u.end === 'ask') sentence.slice(-2).forEach((x, k, a) => { x.rise = k === a.length - 1 ? 5 : 2.5; });
    if (u.end === 'bang') sentence.forEach(x => { x.bang = true; });
    if (u.end) sentence = [];
  }

  const syllables = [];
  const total = units.filter(u => u.vowel).length;
  let t = 0, idx = 0, lastWasPause = true;
  for (const u of units) {
    if (u.pause) {
      if (!lastWasPause) t += v.syl * u.pause + (u.extra ?? 0);
      lastWasPause = true;
      continue;
    }
    if (idx >= MAX_SYLLABLES) break;
    const prog = total > 1 ? idx / (total - 1) : 0;
    let semi = (r() * 2 - 1) * v.jitter - prog * (v.droop ?? 2);
    if (v.bounce) semi += idx % 2 ? -v.bounce * 0.35 : v.bounce * 0.65;   // 통통 튀는 높낮이
    if (u.bang) semi += 1.5;
    if (u.rise) semi += u.rise;
    const f0a = v.f0 * 2 ** (semi / 12);
    const f0b = f0a * 2 ** ((u.tilde ? 3 : u.rise ? 1.5 : -0.8 - r() * 0.6) / 12);
    let dur = v.syl * (0.85 + r() * 0.3) * (u.tilde ? 1.7 : 1) * (u.jong === 'stop' ? 0.78 : 1) * (u.letter ? 0.8 : 1);
    const fs = v.formant * (1 + (r() * 2 - 1) * 0.04);
    const [F1, F2] = VOWEL[u.vowel];
    const [G1, G2] = u.from ? VOWEL[GLIDE_FROM[u.from]] : CHO[u.cho] === 'nasal' ? [260, 1100] : CHO[u.cho] === 'liquid' ? [380, 1500] : [F1, F2];
    const [C1, C2] = u.jong === 'nasal' ? [260, 1050] : u.jong === 'liquid' ? [360, 1450] : [F1, F2];
    const type = CHO[u.cho];
    const cons = CONS[type] ? { ...CONS[type], f: CHO_F[u.cho] * Math.sqrt(fs), lvl: CONS[type].lvl * (v.crisp ?? 1) } : null;
    syllables.push({
      t, dur, f0a, f0b,
      F1a: G1 * fs, F2a: G2 * fs, F1b: F1 * fs, F2b: F2 * fs, F1c: C1 * fs, F2c: C2 * fs,
      vel: (u.bang ? 1.12 : 1) * (0.85 + r() * 0.15), cons, soft: type === 'nasal' || type === 'none' || type === 'liquid', jong: u.jong,
    });
    t += (cons?.len ?? 0) + dur + v.gap;
    idx++;
    lastWasPause = false;
  }
  return { syllables, total: syllables.length ? t : 0, voice: v };
}

/** 목소리 음색 (배음 크기가 다른 주기파) */
function periodicWave(engine, kind) {
  const key = `wave:${kind}`;
  if (engine.cache.has(key)) return engine.cache.get(key);
  const N = 40, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    im[n] = kind === 'soft' ? 1 / n ** 1.7 : kind === 'nasal' ? (n % 2 ? 1 / n : 0.45 / n) : 1 / n ** 1.25;
  }
  const w = engine.ac.createPeriodicWave(re, im);
  engine.cache.set(key, w);
  return w;
}

/** 계획대로 소리를 예약한다. 반환: { stop(), end } */
function synth(engine, plan, t0, dest) {
  const { ac } = engine;
  const v = plan.voice;
  const grp = engine.group();
  const N = n => grp.node(n);
  const end = t0 + plan.total + 0.08;

  const out = N(ac.createGain());
  out.gain.value = 10 ** ((v.gain ?? 0) / 20);
  out.connect(dest.dry);
  out.connect(dest.send);
  const env = N(ac.createGain());
  env.gain.setValueAtTime(0, t0);
  env.connect(out);

  const osc = grp.src(ac.createOscillator());
  osc.setPeriodicWave(periodicWave(engine, v.wave));
  const pre = N(ac.createGain());
  pre.gain.value = 1;
  osc.connect(pre);
  if (v.croak) {   // 개구리: 한 옥타브 아래 음을 섞어서 꺽꺽
    const sub = grp.src(ac.createOscillator());
    sub.type = 'triangle';
    const sg = N(ac.createGain()); sg.gain.value = v.croak;
    sub.connect(sg).connect(pre);
    plan.syllables.forEach(s => {
      sub.frequency.setValueAtTime(s.f0a / 2, t0 + s.t);
      sub.frequency.exponentialRampToValueAtTime(s.f0b / 2, t0 + s.t + (s.cons?.len ?? 0) + s.dur);
    });
    sub.start(t0); sub.stop(end);
  }
  const bands = [[1, 5, 1], [2, 7, 0.6], [3, 6, 0.18]].map(([k, q, lvl]) => {
    const f = N(ac.createBiquadFilter()); f.type = 'bandpass'; f.Q.value = q;
    const g = N(ac.createGain()); g.gain.value = lvl * 2.4;
    pre.connect(f).connect(g).connect(env);
    return f;
  });
  bands[2].frequency.value = 2750 * v.formant;
  const body = N(ac.createBiquadFilter()); body.type = 'lowpass'; body.frequency.value = 700 * v.formant;
  const bg = N(ac.createGain()); bg.gain.value = 0.22;
  pre.connect(body).connect(bg).connect(env);

  // 자음 잡음
  const nz = grp.src(engine.noise(true));
  const nf = N(ac.createBiquadFilter()); nf.type = 'bandpass';
  const ng = N(ac.createGain()); ng.gain.setValueAtTime(0, t0);
  nz.connect(nf).connect(ng).connect(out);

  const PEAK = 0.5;
  for (const s of plan.syllables) {
    const ts = t0 + s.t;
    const tv = ts + (s.cons?.len ?? 0);         // 모음 시작
    const te = tv + s.dur;                      // 모음 끝
    if (s.cons) {
      nf.frequency.setValueAtTime(Math.min(9000, s.cons.f), ts);
      nf.Q.setValueAtTime(s.cons.q, ts);
      ng.gain.setValueAtTime(0, ts);
      ng.gain.linearRampToValueAtTime(s.cons.lvl * s.vel * PEAK, ts + Math.min(0.004, s.cons.len / 2));
      ng.gain.linearRampToValueAtTime(0, tv + 0.006);
    }
    osc.frequency.setValueAtTime(s.f0a, ts);
    osc.frequency.exponentialRampToValueAtTime(s.f0b, te);
    const [b1, b2] = bands;
    b1.frequency.setValueAtTime(s.F1a, tv); b1.frequency.linearRampToValueAtTime(s.F1b, tv + s.dur * 0.35);
    b2.frequency.setValueAtTime(s.F2a, tv); b2.frequency.linearRampToValueAtTime(s.F2b, tv + s.dur * 0.35);
    if (s.jong === 'nasal' || s.jong === 'liquid') {
      b1.frequency.setValueAtTime(s.F1b, tv + s.dur * 0.65); b1.frequency.linearRampToValueAtTime(s.F1c, te);
      b2.frequency.setValueAtTime(s.F2b, tv + s.dur * 0.65); b2.frequency.linearRampToValueAtTime(s.F2c, te);
    }
    const atk = Math.min(s.soft ? 0.018 : 0.007, s.dur * 0.3), rel = Math.min(s.jong === 'stop' ? 0.012 : 0.03, s.dur * 0.3);
    const pk = s.vel * PEAK;
    env.gain.setValueAtTime(0, tv);
    env.gain.linearRampToValueAtTime(pk, tv + atk);
    env.gain.linearRampToValueAtTime(pk * (s.jong === 'nasal' ? 0.6 : 0.8), te - rel);
    env.gain.linearRampToValueAtTime(0, te);
  }
  osc.start(t0); osc.stop(end);
  engine.start(nz, t0, end);

  return {
    end,
    stop() {
      const now = ac.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.03);
      for (const s of [osc, nz]) { try { s.stop(now + 0.04); } catch { /* 이미 끝남 */ } }
    },
  };
}

/** 목소리 담당: 한 번에 한 줄만 말하고, 새 줄이 오면 앞 줄을 끊는다 */
export function createVoice(getEngine) {
  let cur = null;   // { handle, timer, resolve }
  const finish = ok => {
    if (!cur) return;
    const c = cur; cur = null;
    clearTimeout(c.timer);
    c.resolve(ok);
  };
  return {
    /** → Promise<boolean> (끝까지 말했으면 true, 끊겼으면 false) */
    speak(text, voiceId) {
      this.stop();
      const plan = planSpeech(text, voiceId);
      return new Promise(resolve => {
        const engine = getEngine();
        let handle = null;
        if (engine && plan.total > 0) {
          const dest = { dry: engine.voiceIn, send: engine.sends.voice };
          handle = synth(engine, plan, engine.ac.currentTime + 0.02, dest);
        }
        cur = { handle, resolve, timer: setTimeout(() => { cur?.handle === handle && finish(true); }, (plan.total + 0.05) * 1000) };
      });
    },
    stop() {
      if (!cur) return;
      cur.handle?.stop();
      finish(false);
    },
    get speaking() { return !!cur; },
  };
}

/** 측정용: 계획을 바로 예약 */
export function scheduleSpeech(engine, text, voiceId, t0 = 0) {
  const plan = planSpeech(text, voiceId);
  synth(engine, plan, t0, { dry: engine.voiceIn, send: engine.sends.voice });
  return plan;
}
