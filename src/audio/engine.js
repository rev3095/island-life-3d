// 소리 엔진 바탕: 마스터 → bgm / sfx / voice 버스, 부드러운 리미터, 잔향(IR 직접 생성), 노이즈 버퍼, 노드 수 세기.
// 실제 AudioContext 와 OfflineAudioContext(레벨 측정) 양쪽에서 똑같이 쓴다.

export const BUSES = ['bgm', 'sfx', 'voice'];

/** 설정값(0~1) → 실제 게인. 슬라이더가 귀에 고르게 들리도록 제곱 곡선 */
export const volumeToGain = v => Math.max(0, Math.min(1, Number(v) || 0)) ** 2;

export function createEngine(ac, { limiter = true, volumes = {} } = {}) {
  const sr = ac.sampleRate;
  const stats = { nodes: 0, sources: 0, started: 0 };
  const cache = new Map();

  // 마스터: 컴프레서를 높은 문턱(-6dB)·큰 비율로 써서 리미터처럼 + 넘치는 부분만 둥글게 누르는 웨이브셰이퍼.
  // (DynamicsCompressor 는 자동 보정 게인 약 +3.4dB 를 더하므로 마스터를 그만큼 낮춰 둔다)
  const master = ac.createGain();
  master.gain.value = limiter ? 0.85 : 0.85 * 10 ** (3.4 / 20);
  let tail = master;
  if (limiter) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 4;
    comp.ratio.value = 20;
    comp.attack.value = 0.002;
    comp.release.value = 0.2;
    const clip = ac.createWaveShaper();
    clip.curve = softClipCurve();
    clip.oversample = '2x';
    master.connect(comp).connect(clip);
    tail = clip;
  }
  tail.connect(ac.destination);

  const buses = {};
  for (const k of BUSES) {
    const g = ac.createGain();
    g.gain.value = volumeToGain(volumes[k] ?? 1);
    g.connect(master);
    buses[k] = g;
  }

  // 목소리 입력: 포먼트 공명 때문에 순간 크기가 튀어서 부드러운 컴프레서로 고른다 (음량 슬라이더보다 앞)
  const voiceIn = ac.createDynamicsCompressor();
  voiceIn.threshold.value = -20;
  voiceIn.knee.value = 10;
  voiceIn.ratio.value = 3;
  voiceIn.attack.value = 0.003;
  voiceIn.release.value = 0.12;
  const voiceTrim = ac.createGain();
  voiceTrim.gain.value = 0.55;          // 컴프레서 자동 보정 게인을 되돌려 배경음과 비슷한 크기로
  voiceIn.connect(voiceTrim).connect(buses.voice);

  // 효과음·목소리용 작은 방 잔향 (각자 버스로 돌아가야 음량 설정이 맞다)
  const sends = {};
  for (const k of ['sfx', 'voice']) {
    const verb = ac.createConvolver();
    verb.normalize = false;
    verb.buffer = impulse(0.9, { damp: 0.65 });
    const send = ac.createGain();
    send.gain.value = k === 'sfx' ? 0.16 : 0.12;
    send.connect(verb).connect(buses[k]);
    sends[k] = send;
  }

  /** 잔향 IR: 양쪽 채널이 다른 노이즈 × 지수 감쇠, 시간이 갈수록 어두워지게 거른다. 에너지 1로 맞춤 */
  function impulse(seconds, { damp = 0.5, pre = 0.012 } = {}) {
    const key = `ir:${seconds}:${damp}:${pre}`;
    if (cache.has(key)) return cache.get(key);
    const len = Math.floor(sr * seconds);
    const buf = ac.createBuffer(2, len, sr);
    const p0 = Math.floor(pre * sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0, energy = 0;
      for (let n = p0; n < len; n++) {
        const x = (n - p0) / (len - p0);
        const c = 0.92 - damp * 0.8 * x;          // 저역통과 계수: 뒤로 갈수록 어둡게
        lp += c * (Math.random() * 2 - 1 - lp);
        d[n] = lp * Math.exp(-6.9 * x);
      }
      // 초기 반사 몇 개
      for (let k = 0; k < 6; k++) {
        const at = p0 + Math.floor((0.004 + Math.random() * 0.05) * sr);
        if (at < len) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - k * 0.06);
      }
      for (let n = 0; n < len; n++) energy += d[n] * d[n];
      const s = 1 / Math.sqrt(energy || 1);
      for (let n = 0; n < len; n++) d[n] *= s;
    }
    cache.set(key, buf);
    return buf;
  }

  /** 곡마다 쓰는 잔향 노드 */
  function reverb(seconds, damp = 0.5) {
    const verb = ac.createConvolver();
    verb.normalize = false;
    verb.buffer = impulse(seconds, { damp });
    return verb;
  }

  // 백색 잡음 3초 (모든 노이즈 소리의 재료)
  const noiseBuf = ac.createBuffer(1, sr * 3, sr);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  /** 노이즈 음원. 매번 다른 위치에서 시작해서 같은 소리가 반복되지 않게 한다 */
  function noise(loop = false) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = loop;
    src._offset = Math.random() * 2;
    return src;
  }

  /**
   * 음원 하나 + 딸린 노드들: 음원이 끝나면 전부 연결을 끊는다 (노드가 쌓이지 않게).
   * 반드시 start/stop 이 불린 음원만 넘긴다.
   */
  function own(src, ...nodes) {
    stats.sources++; stats.started++;
    stats.nodes += nodes.length + 1;
    src.onended = () => {
      stats.sources--; stats.nodes -= nodes.length + 1;
      src.disconnect();
      for (const n of nodes) n.disconnect();
    };
    return src;
  }

  /** 음원 여러 개가 한 묶음일 때: 모든 음원이 끝나면 묶음 전체를 끊는다 */
  function group() {
    const nodes = [], after = [];
    let pending = 0;
    const g = {
      node(n) { nodes.push(n); stats.nodes++; return n; },
      src(s) {
        nodes.push(s); stats.nodes++; stats.sources++; stats.started++; pending++;
        s.onended = () => {
          stats.sources--;
          if (--pending === 0) g.release();
        };
        return s;
      },
      onRelease(fn) { after.push(fn); },
      release() {
        for (const fn of after.splice(0)) { try { fn(); } catch { /* 이미 끊김 */ } }
        for (const n of nodes.splice(0)) { n.disconnect(); stats.nodes--; }
      },
    };
    return g;
  }

  /** 버퍼 음원을 정해진 시각에 시작 (노이즈는 임의 위치부터) */
  function start(src, t, stopAt) {
    src.start(t, src._offset ?? 0);
    if (stopAt != null) src.stop(stopAt);
  }

  return { ac, sr, master, buses, sends, voiceIn, cache, stats, impulse, reverb, noise, own, group, start };
}

/** |x| 0.8 까지는 그대로, 그 위는 tanh 로 부드럽게 눌러서 최대 0.95 */
function softClipCurve(n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
  }
  return c;
}
