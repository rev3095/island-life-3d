// 레벨 측정: OfflineAudioContext 로 렌더링해서 최고값(peak)·평균 크기(RMS)를 dBFS 로 잰다.
// 귀로 듣지 않고도 '너무 크다(클리핑) / 안 들린다(무음) / 곡끼리 크기 차이'를 확인하는 용도. 데모 페이지에서 쓴다.
import { createEngine } from './engine.js';
import { createMusic, TRACKS } from './music.js';
import { SONGS } from './songs.js';
import { playSfx, SFX_NAMES } from './sfx.js';
import { scheduleSpeech, planSpeech, VOICES } from './voice.js';

export const db = x => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/** buf 분석: 전체 peak·RMS, 0.4초 창 RMS 최댓값, 0.999 이상 샘플 수 */
export function analyse(buf, skipSec = 0) {
  const sr = buf.sampleRate, s0 = Math.floor(skipSec * sr), win = Math.floor(0.4 * sr);
  let peak = 0, sum = 0, n = 0, clipped = 0, maxShort = 0;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const ring = new Float64Array(win);   // 0.4초 창 (고리 버퍼)
  let wsum = 0;
  for (let i = s0; i < buf.length; i++) {
    let e = 0;
    for (const d of chans) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
      e += d[i] * d[i];
    }
    e /= chans.length;
    sum += e;
    const k = n % win;
    wsum += e - ring[k];
    ring[k] = e;
    n++;
    if (n >= win) maxShort = Math.max(maxShort, wsum / win);
  }
  if (n < win && n) maxShort = wsum / n;
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { peak, rms, peakDb: db(peak), rmsDb: db(rms), shortDb: db(Math.sqrt(maxShort)), clipped, lufs: loudness(chans, sr, s0) };
}

/** 대략적인 라우드니스 (K-가중 필터 → 평균 제곱, 게이트 없음). 귀에 들리는 크기 비교용 (LUFS 비슷한 값) */
function loudness(chans, sr, s0) {
  let total = 0;
  for (const d of chans) {
    const y = d.slice(s0);
    filter(y, shelf(sr, 1681.97, 4, 0.7071));
    filter(y, highpass(sr, 38.13, 0.5));
    let e = 0;
    for (let i = 0; i < y.length; i++) e += y[i] * y[i];
    total += e / Math.max(1, y.length);
  }
  return total > 0 ? -0.691 + 10 * Math.log10(total) : -Infinity;
}
function shelf(sr, f0, g, q) {
  const A = 10 ** (g / 40), w = 2 * Math.PI * f0 / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), r = 2 * Math.sqrt(A) * al;
  return [A * ((A + 1) + (A - 1) * c + r), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - r), (A + 1) - (A - 1) * c + r, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - r];
}
function highpass(sr, f0, q) {
  const w = 2 * Math.PI * f0 / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  return [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al];
}
function filter(y, [b0, b1, b2, a0, a1, a2]) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < y.length; i++) {
    const x = y[i], o = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = o; y[i] = o;
  }
}

function offline(seconds, sampleRate) {
  return new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
}

/** 배경음 한 곡을 seconds 초 렌더링 (버스 음량 1, 리미터 켜고/끄고 선택) */
export async function measureTrack(name, { seconds = 20, sampleRate = 44100, limiter = true, solo } = {}) {
  const off = offline(seconds, sampleRate);
  const engine = createEngine(off, { limiter, volumes: { bgm: 1, sfx: 1, voice: 1 } });
  const music = createMusic(engine);
  music.play(name, { fade: 0.02 });
  // solo: 이 채널만 남기고 나머지는 끈다 (어느 악기가 큰지 찾을 때)
  if (solo) for (const [ch, g] of Object.entries(music.player.channels)) if (ch !== solo) g.gain.value = 0;
  music.scheduleAll(seconds);
  const buf = await off.startRendering();
  return { name, title: SONGS[name].title, seconds, ...analyse(buf, 1) };
}

export async function measureAllTracks(opts) {
  const out = [];
  for (const name of TRACKS) out.push(await measureTrack(name, opts));
  return out;
}

/** 효과음 하나씩 1.5초 렌더링 */
export async function measureSfx({ sampleRate = 44100 } = {}) {
  const out = [];
  for (const name of SFX_NAMES) {
    const off = offline(1.5, sampleRate);
    const engine = createEngine(off, { volumes: { bgm: 1, sfx: 1, voice: 1 } });
    playSfx(engine, name);
    const buf = await off.startRendering();
    out.push({ name, ...analyse(buf) });
  }
  return out;
}

/** 목소리마다 같은 문장을 렌더링 */
export async function measureVoices({ text = '안녕! 오늘 날씨 정말 좋다. 같이 산책할래?', sampleRate = 44100 } = {}) {
  const out = [];
  for (const id of Object.keys(VOICES)) {
    const off = offline(planSpeech(text, id).total + 0.3, sampleRate);   // 말하는 길이만큼만 (뒤 무음이 평균을 낮추지 않게)
    const engine = createEngine(off, { volumes: { bgm: 1, sfx: 1, voice: 1 } });
    const plan = scheduleSpeech(engine, text, id, 0.05);
    const buf = await off.startRendering();
    out.push({ name: id, seconds: plan.total, syllables: plan.syllables.length, ...analyse(buf) });
  }
  return out;
}
