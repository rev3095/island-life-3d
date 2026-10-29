// 효과음: 소리 표(assets/sound/sfx.json)의 층(layers)을 짧은 합성음으로 만든다. 부를 때마다 음높이를 조금씩(±jitter) 흔들어서
// 같은 소리가 기계적으로 반복되지 않게 한다. 효과음마다 pitch(높이 배율)·length(길이 배율)·trim(크기 맞춤 dB) 을 데이터로 고친다.
// 층 종류: tone(사인·삼각파, f→to 로 휨) · noise(거른 잡음 한 번) · sweep(거르는 높이가 휘는 잡음) · bubble(물방울) · note(악기 음) · buzz(벌 윙윙).
//   f·to(·mid·end) 는 높이를 따라가고 keep 에 적은 칸은 그대로. [a, b] = 부를 때마다 a~b 사이 아무 값. n·every = 여러 번(사이 간격).
import { noteBuffer, INSTRUMENT_INFO } from './instruments.js';

/** 지금 쓰는 효과음 (이름 → { label, trim, pitch, length, layers }). 데이터를 불러오면 채운다 (bank.js installSound) */
export const SFX = {};
export const SFX_NAMES = [];
/** 화면에 보일 이름 */
export const SFX_LABELS = {};
let JITTER = 0.04;

const R = (a, b) => a + Math.random() * (b - a);

export const LAYER_KINDS = ['tone', 'noise', 'sweep', 'bubble', 'note', 'buzz'];
// 높이(pitch)를 따라가는 칸 · 길이(length)를 따라가는 칸
const PITCHED = { tone: ['f', 'to'], noise: ['f'], sweep: ['f', 'to'], bubble: ['f'], buzz: ['f', 'mid', 'end'] };
const TIMED = ['at', 'every', 'glide', 'a', 'd', 'hold', 'len', 'dur', 'rise', 'fall'];

/** 효과음 정의 하나 검사 → 문제 글 또는 null */
export function checkSfx(name, d) {
  if (!d || !Array.isArray(d.layers) || !d.layers.length) return `${name}: 소리 층이 없어요`;
  for (const k of ['pitch', 'length']) if (d[k] != null && !(d[k] > 0 && d[k] <= 8)) return `${name}: ${k} 는 0보다 크고 8 이하여야 해요`;
  for (const l of d.layers) {
    if (!LAYER_KINDS.includes(l.kind)) return `${name}: 없는 층 종류 '${l.kind}'`;
    if (l.kind === 'note' && INSTRUMENT_INFO[l.inst]?.kind !== 'tone') return `${name}: 음 층의 악기 '${l.inst}' 를 쓸 수 없어요`;
  }
  return null;
}

/** 소리 표 전체로 바꾸기 → 읽지 못한 효과음 오류 목록 */
export function setSfx(table) {
  for (const k of Object.keys(SFX)) delete SFX[k];
  for (const k of Object.keys(SFX_LABELS)) delete SFX_LABELS[k];
  SFX_NAMES.length = 0;
  JITTER = table?.jitter ?? 0.04;
  const errors = [];
  for (const [name, d] of Object.entries(table?.sfx ?? {})) {
    const err = checkSfx(name, d);
    if (err) { errors.push(err); continue; }
    SFX[name] = d;
    SFX_NAMES.push(name);
    SFX_LABELS[name] = d.label ?? name;
  }
  return errors;
}

/** 층 하나를 kit 으로 예약 (t0 = 시작 시각, p = 높이 배율, L = 길이 배율) */
function renderLayer(k, layer, t0, p, L) {
  const keep = layer.keep ?? [];
  const pitched = PITCHED[layer.kind] ?? [];
  for (let i = 0; i < (layer.n ?? 1); i++) {
    const v = {};
    for (const [key, val] of Object.entries(layer)) {
      if (key === 'keep' || key === 'kind') continue;
      v[key] = Array.isArray(val) ? R(val[0], val[1]) : val;                     // 칸 순서대로 뽑는다
      if (v[key] == null) continue;
      if (pitched.includes(key) && !keep.includes(key)) v[key] *= p;
      else if (TIMED.includes(key) && key !== 'at' && key !== 'every') v[key] *= L;
    }
    const t = t0 + ((v.at ?? 0) + i * (v.every ?? 0)) * L;
    switch (layer.kind) {
      case 'tone': k.tone(t, { type: v.type, f: v.f, to: v.to, glide: v.glide, peak: v.peak, a: v.a, d: v.d, hold: v.hold }); break;
      case 'noise': k.noiseHit(t, { type: v.type, f: v.f, q: v.q, peak: v.peak, a: v.a, d: v.d, hold: v.hold }); break;
      case 'sweep': k.noiseSweep(t, { type: v.type, f: v.f, to: v.to, q: v.q, peak: v.peak, a: v.a, d: v.d, len: v.len }); break;
      case 'bubble': k.bubble(t, v.f, v.peak); break;
      case 'note': k.inst(v.inst, v.midi, t, v.dur, v.vel, p); break;
      case 'buzz': k.buzz(t, v); break;
    }
  }
}

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
    /** 벌 윙윙: 톱니파가 f → mid → end 로 오르내리고, 빠른 떨림(vib)·크기 떨림(trem) */
    buzz(t, o) {
      const len = o.len;
      const osc = k.src(ac.createOscillator());
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(o.f, t);
      osc.frequency.linearRampToValueAtTime(o.mid, t + len * 0.45);
      osc.frequency.linearRampToValueAtTime(o.end, t + len);
      const vib = k.src(ac.createOscillator()); vib.frequency.value = o.vib;
      const vg = k.node(ac.createGain()); vg.gain.value = o.vibDepth;
      vib.connect(vg).connect(osc.frequency);
      const f = k.node(ac.createBiquadFilter()); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q;
      const g = k.node(ac.createGain());
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.peak, t + o.rise);
      g.gain.setValueAtTime(o.peak, t + len - o.fall);
      g.gain.linearRampToValueAtTime(0, t + len);
      const trem = k.src(ac.createOscillator()); trem.frequency.value = o.trem;
      const tg = k.node(ac.createGain()); tg.gain.value = o.tremDepth;
      trem.connect(tg).connect(g.gain);
      osc.connect(f).connect(g).connect(out);
      for (const s of [osc, vib, trem]) { s.start(t); s.stop(t + len + 0.02); }
    },
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

/** 효과음 재생. opts: { volume=1, pitch=1, pan=0, delay=0 }. def 를 주면 표 대신 그것으로 (편집기 미리 듣기) */
export function playSfx(engine, name, opts = {}, def = SFX[name]) {
  if (!def) { console.warn(`[audio] 없는 효과음: ${name}`); return false; }
  const { ac } = engine;
  const grp = engine.group();
  const out = grp.node(ac.createGain());
  out.gain.value = Math.max(0, opts.volume ?? 1) * 10 ** ((def.trim ?? 0) / 20);
  const pan = grp.node(ac.createStereoPanner());
  pan.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0));
  out.connect(pan);
  pan.connect(engine.buses.sfx);
  pan.connect(engine.sends.sfx);
  const t = ac.currentTime + 0.005 + (opts.delay ?? 0);
  const p = (opts.pitch ?? 1) * (def.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * JITTER);
  const k = kit(engine, out, grp);
  for (const layer of def.layers) renderLayer(k, layer, t, p, def.length ?? 1);
  return true;
}
