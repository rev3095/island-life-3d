// 효과음 24종. 전부 짧고 부드럽게, 부를 때마다 음높이를 조금씩(±4%) 흔들어서 같은 소리가 기계적으로 반복되지 않게 한다.
// 레시피마다 (k, t, p) 를 받는다: k = 노드 만드는 도구, t = 시작 시각, p = 음높이 배율.
import { noteBuffer } from './instruments.js';

export const SFX_NAMES = [
  'step-grass', 'step-sand', 'step-wood', 'cast', 'nibble', 'bite', 'splash', 'catch', 'net-swing', 'bug-catch',
  'shake', 'fruit-drop', 'acorn', 'dig', 'fossil', 'axe-wood', 'axe-rock', 'water', 'pickup', 'bag-open',
  'menu', 'sell', 'door', 'bee',
];

/** 화면에 보일 이름 (데모용) */
export const SFX_LABELS = {
  'step-grass': '발소리·풀', 'step-sand': '발소리·모래', 'step-wood': '발소리·나무', cast: '찌 던지기', nibble: '톡톡(입질)',
  bite: '덥석(물기)', splash: '첨벙', catch: '낚시 성공', 'net-swing': '잠자리채', 'bug-catch': '곤충 잡기', shake: '나무 흔들기',
  'fruit-drop': '과일 떨어짐', acorn: '도토리 짤랑', dig: '삽 파기', fossil: '화석 발견', 'axe-wood': '도끼·나무', 'axe-rock': '도끼·바위',
  water: '물 주기', pickup: '줍기 뽁', 'bag-open': '가방 열기', menu: '메뉴 클릭', sell: '판매 짤랑', door: '문 열기', bee: '벌 윙윙',
};

// 소리마다 크기 맞춤 (dB). 레벨 측정(levels.js)으로 버스 음량 1 기준 peak 를
// 발소리 −14 · 메뉴 −16 · 줍기류 −10 · 도구류 −8~−9 · 팡파르 −6 dBFS 근처로 맞춘 값
const TRIM_DB = {
  'step-grass': 9.3, 'step-sand': 12.2, 'step-wood': 9.1, cast: 8.6, nibble: 10.5, bite: 11.8, splash: 8.5, catch: -3.2,
  'net-swing': 8.6, 'bug-catch': 3.9, shake: 5.7, 'fruit-drop': 7.9, acorn: 11.1, dig: 12.2, fossil: 1.6, 'axe-wood': 13.9,
  'axe-rock': 14.9, water: 2.9, pickup: 14.7, 'bag-open': 8.7, menu: 16.1, sell: 9.8, door: 10.9, bee: 6.6,
};

const R = (a, b) => a + Math.random() * (b - a);

const RECIPES = {
  'step-grass'(k, t, p) {
    k.noiseHit(t, { type: 'bandpass', f: 2800 * p, q: 0.9, peak: 0.32, a: 0.004, d: 0.07 });
    k.noiseHit(t + 0.006, { type: 'highpass', f: 6000, q: 0.7, peak: 0.08, a: 0.002, d: 0.035 });
  },
  'step-sand'(k, t, p) {
    k.noiseHit(t, { type: 'lowpass', f: 1500 * p, q: 0.6, peak: 0.42, a: 0.012, d: 0.09 });
    k.noiseHit(t + 0.02, { type: 'bandpass', f: 4200 * p, q: 1.2, peak: 0.07, a: 0.004, d: 0.05 });
  },
  'step-wood'(k, t, p) {
    k.tone(t, { type: 'sine', f: 175 * p, to: 120 * p, glide: 0.06, peak: 0.42, a: 0.002, d: 0.08 });
    k.noiseHit(t, { type: 'bandpass', f: 1100 * p, q: 2, peak: 0.2, a: 0.001, d: 0.03 });
  },
  cast(k, t, p) {
    k.noiseSweep(t, { f: 500 * p, to: 2600 * p, q: 1.2, peak: 0.3, a: 0.12, d: 0.18, len: 0.3 });
    k.tone(t + 0.05, { type: 'triangle', f: 1300 * p, to: 600 * p, glide: 0.35, peak: 0.03, a: 0.02, d: 0.3 });
  },
  nibble(k, t, p) {
    k.tone(t, { type: 'sine', f: 1100 * p, to: 700 * p, glide: 0.03, peak: 0.22, a: 0.002, d: 0.04 });
    k.tone(t + 0.09, { type: 'sine', f: 1000 * p, to: 650 * p, glide: 0.03, peak: 0.14, a: 0.002, d: 0.04 });
  },
  bite(k, t, p) {
    k.tone(t, { type: 'sine', f: 520 * p, to: 160 * p, glide: 0.12, peak: 0.45, a: 0.003, d: 0.14 });
    k.noiseHit(t, { type: 'lowpass', f: 1800, q: 0.7, peak: 0.22, a: 0.004, d: 0.12 });
  },
  splash(k, t, p) {
    k.noiseSweep(t, { type: 'lowpass', f: 3400 * p, to: 800, q: 0.6, peak: 0.42, a: 0.01, d: 0.4, len: 0.45 });
    k.noiseHit(t, { type: 'highpass', f: 3000, q: 0.7, peak: 0.12, a: 0.005, d: 0.15 });
    for (let i = 0; i < 4; i++) k.bubble(t + R(0.08, 0.4), R(500, 1100) * p, 0.08);
  },
  catch(k, t, p) {
    [72, 76, 79].forEach((m, i) => k.inst('marimba', m, t + i * 0.075, 0.4, 0.42, p));
    k.inst('marimba', 84, t + 0.225, 0.8, 0.5, p);
    k.inst('bell', 91, t + 0.3, 1, 0.16, p);
    k.inst('bell', 96, t + 0.42, 1, 0.1, p);
  },
  'net-swing'(k, t, p) {
    k.noiseSweep(t, { f: 900 * p, to: 3500 * p, q: 1.5, peak: 0.3, a: 0.07, d: 0.13, len: 0.22 });
  },
  'bug-catch'(k, t, p) {
    k.tone(t, { type: 'sine', f: 600 * p, to: 1250 * p, glide: 0.05, peak: 0.22, a: 0.002, d: 0.06 });
    k.inst('bell', 81, t + 0.06, 0.5, 0.26, p);
    k.inst('bell', 88, t + 0.16, 0.8, 0.26, p);
    k.inst('bell', 93, t + 0.26, 0.8, 0.1, p);
  },
  shake(k, t, p) {
    for (let i = 0; i < 7; i++) k.noiseHit(t + i * 0.07 + R(0, 0.03), { type: 'bandpass', f: R(3000, 5200) * p, q: 1.1, peak: R(0.1, 0.2), a: 0.01, d: 0.07 });
    k.noiseHit(t, { type: 'lowpass', f: 900, q: 0.7, peak: 0.08, a: 0.05, d: 0.3 });
  },
  'fruit-drop'(k, t, p) {
    k.tone(t, { type: 'sine', f: 240 * p, to: 110 * p, glide: 0.1, peak: 0.5, a: 0.002, d: 0.15 });
    k.noiseHit(t, { type: 'lowpass', f: 900, q: 0.7, peak: 0.2, a: 0.002, d: 0.05 });
    k.tone(t + 0.17, { type: 'sine', f: 210 * p, to: 120 * p, glide: 0.07, peak: 0.2, a: 0.002, d: 0.08 });
  },
  acorn(k, t, p) {
    k.tone(t, { type: 'sine', f: 2600 * p, peak: 0.16, a: 0.001, d: 0.08 });
    k.tone(t, { type: 'sine', f: 3900 * p, peak: 0.06, a: 0.001, d: 0.05 });
    k.tone(t + 0.06, { type: 'sine', f: 2300 * p, peak: 0.12, a: 0.001, d: 0.08 });
    k.tone(t + 0.06, { type: 'sine', f: 3450 * p, peak: 0.04, a: 0.001, d: 0.05 });
  },
  dig(k, t, p) {
    k.noiseHit(t, { type: 'lowpass', f: 700 * p, q: 0.7, peak: 0.5, a: 0.01, d: 0.14 });
    k.noiseHit(t + 0.01, { type: 'bandpass', f: 2500 * p, q: 1, peak: 0.1, a: 0.004, d: 0.08 });
    k.tone(t, { type: 'sine', f: 95 * p, to: 70, glide: 0.08, peak: 0.3, a: 0.003, d: 0.1 });
  },
  fossil(k, t, p) {
    k.tone(t, { type: 'sine', f: 150 * p, to: 90, glide: 0.12, peak: 0.4, a: 0.003, d: 0.15 });
    k.noiseHit(t, { type: 'lowpass', f: 800, q: 0.7, peak: 0.2, a: 0.005, d: 0.1 });
    [76, 79, 84, 88].forEach((m, i) => k.inst('bell', m, t + 0.18 + i * 0.09, 0.9, 0.28 - i * 0.03, p));
  },
  'axe-wood'(k, t, p) {
    k.tone(t, { type: 'triangle', f: 320 * p, to: 200 * p, glide: 0.05, peak: 0.42, a: 0.001, d: 0.07 });
    k.noiseHit(t, { type: 'bandpass', f: 1800 * p, q: 1.5, peak: 0.3, a: 0.001, d: 0.04 });
    k.tone(t, { type: 'sine', f: 140 * p, peak: 0.16, a: 0.002, d: 0.12 });
  },
  'axe-rock'(k, t, p) {
    const f = 1250 * p;
    k.tone(t, { type: 'sine', f, peak: 0.18, a: 0.001, d: 0.25 });
    k.tone(t, { type: 'sine', f: f * 2.76, peak: 0.1, a: 0.001, d: 0.12 });
    k.tone(t, { type: 'sine', f: f * 5.4, peak: 0.05, a: 0.001, d: 0.06 });
    k.noiseHit(t, { type: 'highpass', f: 3500, q: 0.7, peak: 0.25, a: 0.001, d: 0.02 });
  },
  water(k, t, p) {
    k.noiseHit(t, { type: 'bandpass', f: 2200 * p, q: 0.6, peak: 0.16, a: 0.08, d: 0.25, hold: 0.35 });
    for (let i = 0; i < 6; i++) k.bubble(t + R(0.02, 0.6), R(700, 1600) * p, 0.06);
  },
  pickup(k, t, p) {
    k.tone(t, { type: 'sine', f: 380 * p, to: 980 * p, glide: 0.07, peak: 0.36, a: 0.003, d: 0.08 });
    k.noiseHit(t, { type: 'highpass', f: 4000, q: 0.7, peak: 0.05, a: 0.001, d: 0.01 });
  },
  'bag-open'(k, t, p) {
    k.noiseHit(t, { type: 'bandpass', f: 1800 * p, q: 0.7, peak: 0.2, a: 0.03, d: 0.1 });
    k.tone(t + 0.08, { type: 'sine', f: 500 * p, to: 820 * p, glide: 0.04, peak: 0.16, a: 0.002, d: 0.06 });
  },
  menu(k, t, p) {
    k.tone(t, { type: 'triangle', f: 990 * p, peak: 0.14, a: 0.002, d: 0.05 });
    k.tone(t, { type: 'sine', f: 1980 * p, peak: 0.04, a: 0.002, d: 0.03 });
  },
  sell(k, t, p) {
    [1, 1.19, 1.5].forEach((r, i) => {
      const f = 2093 * p * r;
      k.tone(t + i * 0.055, { type: 'sine', f, peak: 0.15, a: 0.001, d: 0.12 });
      k.tone(t + i * 0.055, { type: 'sine', f: f * 2.76, peak: 0.04, a: 0.001, d: 0.05 });
    });
    k.inst('bell', 96, t + 0.18, 0.8, 0.08, p);
  },
  door(k, t, p) {
    k.tone(t, { type: 'sine', f: 110 * p, to: 85, glide: 0.12, peak: 0.42, a: 0.003, d: 0.18 });
    k.noiseHit(t + 0.02, { type: 'highpass', f: 2500, q: 0.7, peak: 0.15, a: 0.001, d: 0.015 });
    k.noiseHit(t, { type: 'bandpass', f: 400 * p, q: 3, peak: 0.2, a: 0.004, d: 0.1 });
  },
  bee(k, t, p) {
    const { ac } = k;
    const len = 0.85;
    const o = k.src(ac.createOscillator());
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(210 * p, t);
    o.frequency.linearRampToValueAtTime(245 * p, t + len * 0.45);
    o.frequency.linearRampToValueAtTime(200 * p, t + len);
    const vib = k.src(ac.createOscillator()); vib.frequency.value = 18;
    const vg = k.node(ac.createGain()); vg.gain.value = 10;
    vib.connect(vg).connect(o.frequency);
    const f = k.node(ac.createBiquadFilter()); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 2;
    const g = k.node(ac.createGain());
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.15);
    g.gain.setValueAtTime(0.09, t + len - 0.3);
    g.gain.linearRampToValueAtTime(0, t + len);
    const trem = k.src(ac.createOscillator()); trem.frequency.value = 9;
    const tg = k.node(ac.createGain()); tg.gain.value = 0.025;
    trem.connect(tg).connect(g.gain);
    o.connect(f).connect(g).connect(k.out);
    for (const s of [o, vib, trem]) { s.start(t); s.stop(t + len + 0.02); }
  },
};

/** 레시피가 쓰는 도구 묶음 */
function kit(engine, out, grp) {
  const { ac } = engine;
  const k = {
    ac, out,
    node: n => grp.node(n),
    src: s => grp.src(s),
    /** 감쇠 엔벨로프: 0 → peak (a초) → (hold) → 0 으로 d초 동안 */
    env(param, t, peak, a, d, hold = 0) {
      param.setValueAtTime(0, t);
      param.linearRampToValueAtTime(peak, t + a);
      if (hold) param.setValueAtTime(peak, t + a + hold);
      param.setTargetAtTime(0, t + a + hold, d / 4);
      return t + a + hold + d * 1.6;
    },
    tone(t, { type = 'sine', f, to, glide = 0.05, peak, a, d, hold = 0 }) {
      const o = k.src(ac.createOscillator());
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + glide);
      const g = k.node(ac.createGain());
      const end = k.env(g.gain, t, peak, a, d, hold);
      o.connect(g).connect(out);
      o.start(t); o.stop(end);
    },
    noiseHit(t, { type = 'bandpass', f, q = 1, peak, a, d, hold = 0 }) {
      const n = k.src(engine.noise());
      const fl = k.node(ac.createBiquadFilter());
      fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = k.node(ac.createGain());
      const end = k.env(g.gain, t, peak * (type === 'bandpass' ? 1.8 : 1), a, d, hold);
      n.connect(fl).connect(g).connect(out);
      engine.start(n, t, end);
    },
    noiseSweep(t, { type = 'bandpass', f, to, q = 1, peak, a, d, len }) {
      const n = k.src(engine.noise());
      const fl = k.node(ac.createBiquadFilter());
      fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(f, t);
      fl.frequency.exponentialRampToValueAtTime(to, t + len);
      const g = k.node(ac.createGain());
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak * (type === 'bandpass' ? 1.8 : 1), t + a);
      g.gain.setTargetAtTime(0, t + a, d / 4);
      n.connect(fl).connect(g).connect(out);
      engine.start(n, t, t + a + d * 1.6);
    },
    /** 물방울 '뽀글': 위로 휘는 짧은 사인 */
    bubble(t, f, peak) { k.tone(t, { type: 'sine', f, to: f * 1.8, glide: 0.03, peak, a: 0.002, d: 0.03 }); },
    /** 악기 버퍼 음 (팡파르·종소리) */
    inst(kind, midi, t, dur, vel, p = 1) {
      const buf = noteBuffer(engine, kind, midi);
      const s = k.src(ac.createBufferSource());
      s.buffer = buf; s.playbackRate.value = p;
      const g = k.node(ac.createGain());
      g.gain.setValueAtTime(vel, t);
      g.gain.setTargetAtTime(0, t + dur, 0.08);
      s.connect(g).connect(out);
      s.start(t); s.stop(t + Math.min(buf.duration / p, dur + 0.4));
    },
  };
  return k;
}

/** 효과음 재생. opts: { volume=1, pitch=1, pan=0, delay=0 } */
export function playSfx(engine, name, opts = {}) {
  const recipe = RECIPES[name];
  if (!recipe) { console.warn(`[audio] 없는 효과음: ${name}`); return false; }
  const { ac } = engine;
  const grp = engine.group();
  const out = grp.node(ac.createGain());
  out.gain.value = Math.max(0, opts.volume ?? 1) * 10 ** ((TRIM_DB[name] ?? 0) / 20);
  const pan = grp.node(ac.createStereoPanner());
  pan.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0));
  out.connect(pan);
  pan.connect(engine.buses.sfx);
  pan.connect(engine.sends.sfx);
  const t = ac.currentTime + 0.005 + (opts.delay ?? 0);
  const p = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * 0.04);
  recipe(kit(engine, out, grp), t, p);
  return true;
}
