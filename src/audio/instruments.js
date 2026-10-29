// 악기 음색. 두 가지로 나뉜다.
//  1) 버퍼 악기 — 음 하나를 자바스크립트로 미리 계산해 둔다 (피아노·마림바·오르골·칼림바·종·비브라폰·전자피아노·
//     베이스·우쿨렐레·하프·뜯는 베이스, 그리고 타악기·빗방울·새·귀뚜라미). (악기, 음높이)마다 한 번만 만들고 캐시.
//     연주할 때는 음원 1개 + 게인 1개뿐이라 가볍다.
//  2) 오실레이터 악기 — 길이가 자유로운 음 (패드, 플루트).
import { mtof } from './notation.js';

const TAU = Math.PI * 2;

// ── 버퍼 계산 도구 ──────────────────────────────────────────

/** 감쇠하는 사인 배음을 더한다. parts = [[배수, 크기, 초당 감쇠], ...] (회전 페이저라 Math.sin 없이 빠르다) */
function addPartials(d, sr, f, parts) {
  for (const [ratio, amp, decay] of parts) {
    const fr = f * ratio;
    if (fr > sr * 0.45) continue;
    const w = TAU * fr / sr, cw = Math.cos(w), sw = Math.sin(w);
    const k = Math.exp(-decay / sr);
    let c = 1, s = 0, a = amp;
    for (let n = 0; n < d.length; n++) {
      d[n] += a * s;
      const nc = c * cw - s * sw;
      s = c * sw + s * cw; c = nc;
      a *= k;
      if (a < 2e-5) break;
    }
  }
}

function attackRamp(d, sr, sec) {
  const na = Math.max(1, Math.floor(sec * sr));
  for (let n = 0; n < na && n < d.length; n++) d[n] *= n / na;
}

/** 끝 부분을 부드럽게 0으로 (버퍼가 잘리는 소리 방지) */
function fadeTail(d, sr, sec = 0.12) {
  const nt = Math.min(d.length, Math.floor(sec * sr));
  for (let i = 0; i < nt; i++) d[d.length - 1 - i] *= i / nt;
}

function normalize(d, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) { const s = peak / m; for (let i = 0; i < d.length; i++) d[i] *= s; }
}

/** 현 악기: 처음 튕기는 잡음(첫 주기)은 빼고 몸통 소리로 크기를 맞춘 뒤, 튀는 부분만 둥글게 누른다 */
function normalizeBody(d, skip, peak = 0.8) {
  let m = 0;
  for (let i = skip; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (!m) return;
  const s = peak / m;
  for (let i = 0; i < d.length; i++) {
    const x = d[i] * s, a = Math.abs(x);
    d[i] = a <= 0.85 ? x : Math.sign(x) * (0.85 + 0.12 * Math.tanh((a - 0.85) / 0.12));
  }
}

function lowpass1(d, sr, fc) {
  const a = 1 - Math.exp(-TAU * fc / sr);
  let y = 0;
  for (let i = 0; i < d.length; i++) { y += a * (d[i] - y); d[i] = y; }
}

function highpass1(d, sr, fc) {
  const a = Math.exp(-TAU * fc / sr);
  let x1 = 0, y = 0;
  for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x1); x1 = x; d[i] = y; }
}

/** RBJ 2차 필터 (bandpass / lowpass / highpass) */
function biquad(d, sr, type, f0, q = 0.7) {
  const w = TAU * f0 / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'bandpass') { b0 = al; b1 = 0; b2 = -al; }
  else if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
  }
}

const rand = () => Math.random() * 2 - 1;

/** 카플러스-스트롱 현 뜯기 (분수 지연으로 음정 맞춤) */
function pluckString(d, sr, f, { t60 = 1.2, bright = 0.5 } = {}) {
  const D = sr / f - 0.5, Di = Math.floor(D), fr = D - Di;
  const rho = Math.pow(0.001, 1 / (f * t60));
  const N = Math.min(d.length, Di + 3);
  let lp = 0, mean = 0;
  for (let n = 0; n < N; n++) { lp += bright * (rand() - lp); d[n] = lp; mean += lp; }
  mean /= N;
  for (let n = 0; n < N; n++) d[n] -= mean;
  for (let n = N; n < d.length; n++) {
    const a = d[n - Di], b = d[n - Di - 1], c = d[n - Di - 2];
    d[n] = rho * 0.5 * ((a + (b - a) * fr) + (b + (c - b) * fr));
  }
}

// ── 음높이가 있는 버퍼 악기 ─────────────────────────────────

const TONED = {
  // 부드러운 피아노: 약간 어긋난 배음(현의 비조화성) + 두 단계 감쇠 + 해머 소리
  piano: { sec: 2.6, fill(d, sr, f) {
    const B = 0.00035, dk = (f / 262) ** 0.55;
    const bright = Math.min(1.2, Math.max(0.45, 1.05 - Math.log2(f / 262) * 0.28));
    const parts = [];
    for (let n = 1; n <= 8; n++) {
      const r = n * Math.sqrt(1 + B * n * n), a = (1 / n ** 1.6) * bright ** (n - 1);
      parts.push([r, a * 0.6, (2.8 + 1.6 * n) * dk], [r * 1.0004, a * 0.4, (0.7 + 0.45 * n) * dk]);
    }
    addPartials(d, sr, f, parts);
    const nh = Math.floor(0.012 * sr);
    let lp = 0;
    for (let n = 0; n < nh; n++) { lp += 0.3 * (rand() - lp); d[n] += lp * 0.08 * (1 - n / nh); }
    attackRamp(d, sr, 0.004);
  } },
  // 마림바: 1 : 3.9 : 9.7 배음, 높은 배음은 금방 사라진다
  marimba: { sec: 1.6, fill(d, sr, f) {
    const dk = (f / 262) ** 0.4;
    addPartials(d, sr, f, [[1, 1, 2.4 * dk], [3.93, 0.32, 14 * dk], [9.7, 0.07, 38]]);
    const nm = Math.floor(0.004 * sr);
    for (let n = 0; n < nm; n++) d[n] += rand() * 0.05 * (1 - n / nm);
    attackRamp(d, sr, 0.0015);
  } },
  // 오르골: 빗살 소리굽쇠처럼 맑고 금속성, 길게 울린다
  musicbox: { sec: 2.6, fill(d, sr, f) {
    addPartials(d, sr, f, [[1, 1, 1.1], [1.0016, 0.25, 1.2], [2.0, 0.05, 3], [5.96, 0.2, 7], [13.3, 0.06, 20], [21.1, 0.03, 90]]);
    attackRamp(d, sr, 0.001);
  } },
  // 칼림바: 따뜻한 기본음 + 약 6배 배음의 '띵'
  kalimba: { sec: 2, fill(d, sr, f) {
    addPartials(d, sr, f, [[1, 1, 1.9], [2, 0.04, 6], [5.8, 0.17, 12], [11.8, 0.04, 30]]);
    attackRamp(d, sr, 0.0015);
  } },
  // 종·글로켄슈필: 1 : 2.76 : 5.4 : 8.9
  bell: { sec: 2.4, fill(d, sr, f) {
    addPartials(d, sr, f, [[1, 1, 1.5], [2.76, 0.3, 4.2], [5.4, 0.13, 8], [8.93, 0.05, 14]]);
    attackRamp(d, sr, 0.0008);
  } },
  // 비브라폰 느낌: 1 : 4 : 10 배음 + 은은한 떨림
  vibes: { sec: 2.4, fill(d, sr, f) {
    addPartials(d, sr, f, [[1, 1, 1.1], [4, 0.2, 5], [10, 0.05, 16]]);
    for (let n = 0; n < d.length; n++) d[n] *= 1 - 0.18 * (0.5 + 0.5 * Math.sin(TAU * 4.6 * n / sr));
    attackRamp(d, sr, 0.002);
  } },
  // 전자피아노: FM(1:1) 변조 깊이가 빨리 줄고, 짧은 '팅' 소리가 붙는다
  ep: { sec: 2.2, fill(d, sr, f) {
    const w = TAU * f / sr, dk = (f / 262) ** 0.4;
    let ph = 0;
    for (let n = 0; n < d.length; n++) {
      const t = n / sr;
      const I = 1.5 * Math.exp(-t * 6) + 0.22;
      d[n] = Math.exp(-t * 1.2 * dk) * Math.sin(ph + I * Math.sin(ph)) + 0.12 * Math.exp(-t * 22) * Math.sin(ph * 7);
      ph += w; if (ph > TAU * 64) ph -= TAU * 64;
    }
    attackRamp(d, sr, 0.003);
  } },
  // 둥근 베이스
  bass: { sec: 1.8, fill(d, sr, f) {
    addPartials(d, sr, f, [[1, 1, 1.0], [2, 0.32, 2.2], [3, 0.1, 4], [4, 0.04, 6]]);
    attackRamp(d, sr, 0.008);
  } },
  // 우쿨렐레 같은 나일론 현
  uke: { string: true, sec: 1.6, fill(d, sr, f) { pluckString(d, sr, f, { t60: 1.1, bright: 0.5 }); lowpass1(d, sr, 4200); attackRamp(d, sr, 0.001); } },
  // 밝게 튕기는 현 (상점 멜로디)
  pluck: { string: true, sec: 1.2, fill(d, sr, f) { pluckString(d, sr, f, { t60: 0.75, bright: 0.8 }); attackRamp(d, sr, 0.0008); } },
  // 하프: 부드럽고 길게
  harp: { string: true, sec: 2.4, fill(d, sr, f) { pluckString(d, sr, f, { t60: 2.4, bright: 0.32 }); lowpass1(d, sr, 3000); attackRamp(d, sr, 0.002); } },
  // 뜯는 베이스: 현 + 기본음 보강
  pluckbass: { string: true, sec: 1.4, fill(d, sr, f) {
    pluckString(d, sr, f, { t60: 0.9, bright: 0.28 });
    addPartials(d, sr, f, [[1, 0.35, 3]]);
    lowpass1(d, sr, 1800);
    attackRamp(d, sr, 0.003);
  } },
};

// ── 음높이 없는 버퍼 (타악기·자연 소리). variant 로 몇 가지 변형 ──

const UNTONED = {
  kick: { sec: 0.45, fill(d, sr) {
    let ph = 0;
    for (let n = 0; n < d.length; n++) {
      const t = n / sr;
      ph += TAU * (46 + 85 * Math.exp(-t / 0.028)) / sr;
      d[n] = Math.sin(ph) * Math.exp(-t / 0.13) + (n < sr * 0.002 ? rand() * 0.2 : 0);
    }
    attackRamp(d, sr, 0.0015);
  } },
  shaker: { sec: 0.14, fill(d, sr) {
    for (let n = 0; n < d.length; n++) d[n] = rand();
    highpass1(d, sr, 4500); lowpass1(d, sr, 11000);
    for (let n = 0; n < d.length; n++) { const t = n / sr; d[n] *= Math.min(1, t / 0.008) * Math.exp(-t / 0.032); }
  } },
  snap: { sec: 0.16, fill(d, sr) {
    for (let n = 0; n < d.length; n++) d[n] = rand();
    biquad(d, sr, 'bandpass', 2100, 1.1);
    for (let n = 0; n < d.length; n++) { const t = n / sr; d[n] = d[n] * 3 * Math.exp(-t / 0.024) + 0.35 * Math.sin(TAU * 360 * t) * Math.exp(-t / 0.018); }
  } },
  brush: { sec: 0.3, fill(d, sr) {
    for (let n = 0; n < d.length; n++) d[n] = rand();
    highpass1(d, sr, 1500); lowpass1(d, sr, 6500);
    for (let n = 0; n < d.length; n++) { const t = n / sr; d[n] *= Math.min(1, t / 0.018) * Math.exp(-t / 0.075); }
  } },
  hat: { sec: 0.07, fill(d, sr) {
    for (let n = 0; n < d.length; n++) d[n] = rand();
    highpass1(d, sr, 7000);
    for (let n = 0; n < d.length; n++) d[n] *= Math.exp(-n / sr / 0.012);
  } },
  wood: { sec: 0.12, fill(d, sr) {
    addPartials(d, sr, 820, [[1, 1, 45], [1.62, 0.45, 60], [2.9, 0.15, 90]]);
    attackRamp(d, sr, 0.0006);
  } },
  drip: { sec: 0.09, fill(d, sr, v) {
    const f0 = 1500 + v * 420;
    let ph = 0;
    for (let n = 0; n < d.length; n++) {
      const t = n / sr;
      ph += TAU * f0 * (0.55 + 0.45 * Math.exp(-t / 0.012)) / sr;
      d[n] = Math.sin(ph) * Math.exp(-t / 0.018);
    }
    attackRamp(d, sr, 0.0008);
  } },
  crackle: { sec: 0.01, fill(d, sr) { for (let n = 0; n < d.length; n++) d[n] = rand() * Math.exp(-n / sr / 0.0015); highpass1(d, sr, 1500); } },
  // 귀뚜라미: 4.3kHz 를 3번 끊어 우는 소리
  cricket: { sec: 0.16, fill(d, sr, v) {
    const f = 4100 + v * 160;
    for (let n = 0; n < d.length; n++) {
      const t = n / sr, pulse = Math.sin(Math.PI * Math.min(1, (t % 0.045) / 0.03));
      d[n] = Math.sin(TAU * f * t) * (t % 0.045 < 0.03 ? pulse : 0) * (t < 0.135 ? 1 : 0);
    }
  } },
  // 새: 빠르게 오르내리는 짧은 지저귐 2~4번
  bird: { sec: 0.6, fill(d, sr, v) {
    const r = seeded(v * 7 + 3);
    const chirps = 2 + Math.floor(r() * 3), base = 2600 + r() * 1400;
    let ph = 0;
    for (let k = 0; k < chirps; k++) {
      const s0 = Math.floor((k * 0.11 + r() * 0.02) * sr), len = Math.floor((0.05 + r() * 0.03) * sr);
      const up = r() < 0.6;
      for (let n = 0; n < len && s0 + n < d.length; n++) {
        const x = n / len;
        const f = base * (up ? 0.8 + 0.5 * x : 1.3 - 0.45 * x) * (1 + 0.04 * Math.sin(TAU * 40 * n / sr));
        ph += TAU * f / sr;
        d[s0 + n] += Math.sin(ph) * Math.sin(Math.PI * x) * (1 - k * 0.15);
      }
    }
  } },
};

function seeded(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

// 음 버퍼는 24kHz 로 만든다 (재생할 때 자동 변환). 메모리가 절반이고, 이 악기들은 높은 배음이 원래 거의 없다.
const NOTE_RATE = 24000;
// 음 버퍼 캐시 한도. 넘으면 가장 오래 안 쓴 음부터 지운다 (곡을 여러 개 돌아도 메모리가 계속 늘지 않게)
const NOTE_CACHE_BYTES = 24 * 2 ** 20;

/** (악기, 음높이) 버퍼. 처음 한 번만 계산하고 최근 쓴 순서로 캐시 */
export function noteBuffer(engine, kind, midi) {
  const notes = (engine.notes ??= { map: new Map(), bytes: 0 });
  const key = `${kind}:${midi}`;
  let buf = notes.map.get(key);
  if (buf) { notes.map.delete(key); notes.map.set(key, buf); return buf; }
  const def = TONED[kind];
  const f = mtof(midi), rate = Math.min(engine.sr, NOTE_RATE);
  const sec = def.sec * Math.min(1.4, Math.max(0.55, (262 / f) ** 0.25));
  buf = engine.ac.createBuffer(1, Math.floor(sec * rate), rate);
  const d = buf.getChannelData(0);
  def.fill(d, rate, f);
  fadeTail(d, rate);
  if (def.string) normalizeBody(d, Math.floor(Math.max(0.008, 2 / f) * rate));
  else normalize(d);
  notes.map.set(key, buf);
  notes.bytes += buf.length * 4;
  while (notes.bytes > NOTE_CACHE_BYTES && notes.map.size > 1) {
    const [k, b] = notes.map.entries().next().value;
    notes.map.delete(k);
    notes.bytes -= b.length * 4;
  }
  return buf;
}

export function hitBuffer(engine, kind, variant = 0) {
  const key = `${kind}#${variant}`;
  let buf = engine.cache.get(key);
  if (buf) return buf;
  const def = UNTONED[kind];
  buf = engine.ac.createBuffer(1, Math.floor(def.sec * engine.sr), engine.sr);
  const d = buf.getChannelData(0);
  def.fill(d, engine.sr, variant);
  fadeTail(d, engine.sr, Math.min(0.02, def.sec / 4));
  normalize(d);
  engine.cache.set(key, buf);
  return buf;
}

/** 6초짜리 스테레오 빗소리 (고르게 쏴아 + 굵은 빗방울 톡톡). 반복 재생용 */
export function rainBuffer(engine) {
  if (engine.cache.has('rain')) return engine.cache.get('rain');
  const sr = Math.min(engine.sr, 22050), len = sr * 6;      // 2.6kHz 아래만 남기니 낮은 샘플레이트로 충분
  const buf = engine.ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let n = 0; n < len; n++) d[n] = rand() * 0.6;
    for (let k = 0; k < 700; k++) {
      const at = Math.floor(Math.random() * (len - sr * 0.01)), a = 0.4 + Math.random() * 1.2, nl = Math.floor(sr * (0.002 + Math.random() * 0.004));
      for (let n = 0; n < nl; n++) d[at + n] += rand() * a * (1 - n / nl);
    }
    lowpass1(d, sr, 2600); highpass1(d, sr, 180);
    let e = 0;
    for (let n = 0; n < len; n++) e += d[n] * d[n];
    const s = 0.25 / Math.sqrt(e / len);
    for (let n = 0; n < len; n++) d[n] *= s;
  }
  engine.cache.set('rain', buf);
  return buf;
}

/** 버퍼 한 번 재생: dur 뒤에 release 동안 줄어든다 (버퍼가 먼저 끝나면 그냥 끝) */
export function playBuffer(engine, dest, buf, t, dur, vel, { release = 0.3, rate = 1 } = {}) {
  const { ac } = engine;
  const src = ac.createBufferSource();
  src.buffer = buf;
  if (rate !== 1) src.playbackRate.value = rate;
  const g = ac.createGain();
  g.gain.setValueAtTime(vel, t);
  let stopAt = t + buf.duration / rate;
  if (dur + release < buf.duration / rate) {
    g.gain.setValueAtTime(vel, t + dur);
    g.gain.setTargetAtTime(0, t + dur, release / 4);
    stopAt = t + dur + release * 1.5;
  }
  src.connect(g).connect(dest);
  src.start(t);
  src.stop(stopAt);
  engine.own(src, g);
  return src;
}

// ── 오실레이터 악기 ─────────────────────────────────────────

/** 따뜻한 패드: 음마다 톱니+삼각파(살짝 어긋나게), 저역통과 필터가 천천히 열린다 */
function pad(engine, dest, t, midis, dur, vel, o = {}) {
  const { ac } = engine;
  const list = Array.isArray(midis) ? midis : [midis];
  const attack = o.attack ?? 0.9, release = o.release ?? 1.4, cutoff = o.cutoff ?? 1200;
  const hold = Math.max(attack, dur);
  const grp = engine.group();
  const f = grp.node(ac.createBiquadFilter());
  f.type = 'lowpass'; f.Q.value = 0.6;
  f.frequency.setValueAtTime(cutoff * 0.55, t);
  f.frequency.linearRampToValueAtTime(cutoff, t + attack * 1.4);
  f.frequency.linearRampToValueAtTime(cutoff * 0.7, t + hold + release);
  const g = grp.node(ac.createGain());
  const peak = vel / Math.sqrt(list.length);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + hold);
  g.gain.linearRampToValueAtTime(0, t + hold + release);
  f.connect(g).connect(dest);
  const end = t + hold + release + 0.05;
  for (const m of list) {
    for (const [type, det, lvl] of [['sawtooth', o.detune ?? 7, 0.55], ['triangle', -(o.detune ?? 7), 1]]) {
      const osc = grp.src(ac.createOscillator());
      osc.type = type;
      osc.frequency.value = mtof(m);
      osc.detune.value = det;
      const lg = grp.node(ac.createGain());
      lg.gain.value = lvl;
      osc.connect(lg).connect(f);
      osc.start(t); osc.stop(end);
    }
  }
}

/** 부드러운 플루트/오카리나: 삼각파 + 옥타브 위 사인 + 숨소리, 곡의 비브라토 LFO 를 받는다 */
function flute(engine, dest, t, midi, dur, vel, o = {}) {
  const { ac } = engine;
  const fr = mtof(midi);
  const grp = engine.group();
  const g = grp.node(ac.createGain());
  const atk = 0.06, rel = o.release ?? 0.18, end = t + dur + rel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + atk);
  g.gain.linearRampToValueAtTime(vel * 0.85, t + Math.max(atk + 0.01, dur));
  g.gain.linearRampToValueAtTime(0, end);
  g.connect(dest);
  const o1 = grp.src(ac.createOscillator());
  o1.type = 'triangle'; o1.frequency.value = fr;
  const o2 = grp.src(ac.createOscillator());
  o2.type = 'sine'; o2.frequency.value = fr * 2;
  const g2 = grp.node(ac.createGain()); g2.gain.value = 0.12;
  o1.connect(g); o2.connect(g2).connect(g);
  if (o.vibrato) {
    o.vibrato.connect(o1.detune); o.vibrato.connect(o2.detune);
    grp.onRelease(() => { o.vibrato.disconnect(o1.detune); o.vibrato.disconnect(o2.detune); });
  }
  // 숨소리
  const n = grp.src(engine.noise());
  const nf = grp.node(ac.createBiquadFilter()); nf.type = 'bandpass'; nf.frequency.value = Math.min(8000, fr * 2.2); nf.Q.value = 1.2;
  const ng = grp.node(ac.createGain());
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(vel * 0.09, t + 0.03);
  ng.gain.setTargetAtTime(vel * 0.025, t + 0.05, 0.08);
  ng.gain.linearRampToValueAtTime(0, end);
  n.connect(nf).connect(ng).connect(g);
  for (const s of [o1, o2]) { s.start(t); s.stop(end + 0.02); }
  engine.start(n, t, end + 0.02);
}

// ── 연주 진입점: INSTRUMENTS[이름](engine, 목적지, 시각, 음, 길이(초), 세기, 옵션) ──

const TONED_RELEASE = { piano: 0.5, marimba: 0.12, musicbox: 0.6, kalimba: 0.35, bell: 0.6, vibes: 0.4, ep: 0.35, bass: 0.25, uke: 0.12, pluck: 0.08, harp: 0.6, pluckbass: 0.1 };

export const INSTRUMENTS = { pad, flute };
for (const [kind, rel] of Object.entries(TONED_RELEASE)) {
  INSTRUMENTS[kind] = (engine, dest, t, midi, dur, vel, o = {}) =>
    playBuffer(engine, dest, noteBuffer(engine, kind, midi), t, dur, vel, { release: o.release ?? rel });
}
for (const kind of Object.keys(UNTONED)) {
  INSTRUMENTS[kind] = (engine, dest, t, _midi, _dur, vel, o = {}) =>
    playBuffer(engine, dest, hitBuffer(engine, kind, o.variant ?? 0), t, 99, vel, { rate: o.rate ?? 1 });
}

/** 편집기·검사용 악기 이름과 종류: tone = 음높이 있는 악기(서로 바꿔 끼울 수 있다), hit = 타악기, nature = 자연 소리(변형 번호가 악기마다 달라 바꾸지 않는다) */
export const INSTRUMENT_INFO = {
  piano: { label: '피아노', kind: 'tone' }, marimba: { label: '마림바', kind: 'tone' }, musicbox: { label: '오르골', kind: 'tone' },
  kalimba: { label: '칼림바', kind: 'tone' }, bell: { label: '종', kind: 'tone' }, vibes: { label: '비브라폰', kind: 'tone' },
  ep: { label: '전자피아노', kind: 'tone' }, bass: { label: '베이스', kind: 'tone' }, uke: { label: '우쿨렐레', kind: 'tone' },
  pluck: { label: '뜯는 소리', kind: 'tone' }, harp: { label: '하프', kind: 'tone' }, pluckbass: { label: '뜯는 베이스', kind: 'tone' },
  pad: { label: '패드', kind: 'tone' }, flute: { label: '플루트', kind: 'tone' },
  kick: { label: '킥 드럼', kind: 'hit' }, shaker: { label: '셰이커', kind: 'hit' }, snap: { label: '핑거 스냅', kind: 'hit' },
  brush: { label: '브러시', kind: 'hit' }, hat: { label: '하이햇', kind: 'hit' }, wood: { label: '우드블록', kind: 'hit' },
  drip: { label: '빗방울', kind: 'nature' }, crackle: { label: '판 긁힘', kind: 'nature' }, cricket: { label: '귀뚜라미', kind: 'nature' }, bird: { label: '새소리', kind: 'nature' },
};
