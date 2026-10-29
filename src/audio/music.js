// 배경음 재생기: 곡 정의(songs.js 가 곡 데이터로 만든 것)를 마디 단위로 펼쳐서 '조금 앞서 예약'(look-ahead) 방식으로 연주한다.
// 실제 재생은 엔진 타이머가 50ms 마다 pump() 를 불러 0.3초 앞까지 음을 예약하고,
// 레벨 측정(OfflineAudioContext)은 pump(끝시각) 한 번으로 전부 예약한 뒤 렌더링한다.
import { SONGS, TRACKS } from './songs.js';
import { INSTRUMENTS } from './instruments.js';
import { voicing, bassNote, rng, hashString } from './notation.js';

export { TRACKS };

class SongPlayer {
  constructor(engine, def, t0, from = 0) {
    const ac = this.ac = engine.ac;
    this.engine = engine;
    this.def = def;
    this.beatSec = 60 / def.bpm;
    this.barSec = this.beatSec * def.meter;
    this.half = def.bars / 2;           // 반주 모양이 '곡 뒤쪽 절반' 변주에 쓴다
    this.scale = def.scaleSet;          // 꾸밈음·아래 화음에 쓰는 음계
    this.t0 = t0 - from * this.barSec;  // from 마디부터 (편집기에서 고친 뒤 그 자리부터 다시 듣기)
    this.startAt = t0;
    this.nextBar = from;
    this.queue = [];
    this.endAt = Infinity;
    this.nodes = [];          // 곡이 끝날 때 끊을 노드
    this.loops = [];          // 곡 내내 도는 음원 (빗소리·LFO)
    this.channels = {};
    this.rand = Math.random;

    this.out = this.node(ac.createGain());           // 페이드 인/아웃
    this.out.gain.value = 0;
    this.out.connect(engine.buses.bgm);
    this.bus = this.node(ac.createGain());           // 곡 전체 음량
    this.bus.gain.value = def.gain ?? 1;
    const rv = def.reverb ?? { seconds: 2, damp: 0.5 };
    this.verb = this.node(engine.reverb(rv.seconds, rv.damp));
    this.verb.connect(this.bus);
    let last = this.bus;
    for (const fx of def.post?.(this) ?? []) { last.connect(fx); last = fx; }
    last.connect(this.out);
    def.setup(this);
  }

  node(n) { this.nodes.push(n); this.engine.stats.nodes++; return n; }

  /** 악기 채널: 음량·좌우 위치·잔향 보내기 */
  channel(name, { gain = 1, pan = 0, verb = 0.25 } = {}) {
    const ac = this.ac;
    const input = this.node(ac.createGain());
    input.gain.value = gain;
    const p = this.node(ac.createStereoPanner());
    p.pan.value = pan;
    input.connect(p).connect(this.bus);
    if (verb > 0) {
      const send = this.node(ac.createGain());
      send.gain.value = verb;
      p.connect(send).connect(this.verb);
    }
    this.channels[name] = input;
    return input;
  }

  /** 곡 내내 도는 음원(빗소리 등)을 등록. 곡이 끝나면 멈춘다 */
  loop(src, t = this.startAt) {
    this.engine.start(src, t);
    this.loops.push(src);
    return src;
  }

  /** 플루트용 비브라토 LFO (센트 단위 출력) */
  vibrato(rate = 5.2, cents = 9) {
    if (this._vib) return this._vib;
    const lfo = this.node(this.ac.createOscillator());
    lfo.frequency.value = rate;
    const g = this._vib = this.node(this.ac.createGain());
    g.gain.value = cents;
    lfo.connect(g);
    this.loop(lfo);
    return g;
  }

  // ── 곡 정의(bar 함수)에서 쓰는 도구 ──
  chords(i) { return this.def.progBars[i]; }
  melody(i) { return this.def.melBars[i]; }
  voicing(chord, center, max) { return voicing(chord, center, max); }
  bass(chord, low) { return bassNote(chord, low); }

  /**
   * 파트로 음 하나 예약: 곡 데이터 parts[role] 의 악기·채널로, 세기(vel 배율)·옥타브를 적용해서.
   * 끈 파트(on: false)도 난수는 똑같이 써서 다른 파트의 흔들림이 바뀌지 않게 한다.
   */
  play(role, midi, beat, dur, vel, opts) {
    const p = this.def.parts[role];
    if (!p) { this.warnOnce(`파트 없음 ${role}`); return; }
    if (p.octave) midi = Array.isArray(midi) ? midi.map(m => m + 12 * p.octave) : midi + 12 * p.octave;
    if (p.vel != null) vel *= p.vel;
    if (p.opts) opts = opts ? { ...p.opts, ...opts } : p.opts;
    if (p.inst === 'flute') opts = { ...opts, vibrato: this.vibrato(this.def.vibrato?.rate, this.def.vibrato?.cents) };
    this.note(p.inst, p.ch, midi, beat, dur, vel, opts, p.on === false);
  }

  warnOnce(msg) {
    if ((this._warned ??= new Set()).has(msg)) return;
    this._warned.add(msg);
    console.warn(`[audio] ${this.def.name}: ${msg}`);
  }

  /** 음 하나 예약: beat = 마디 안 박, dur = 박 단위 */
  note(inst, ch, midi, beat, dur, vel, opts, mute = false) {
    let b = beat;
    if (this.def.swing && Math.abs((b % 1) - 0.5) < 1e-6) b += this.def.swing;
    const jitter = (this.rand() - 0.5) * 0.014 * (this.def.human ?? 1);
    const time = Math.max(this.startAt, this.barStart + b * this.beatSec + jitter + (opts?.nudge ?? 0));
    const v = vel * (1 + (this.rand() - 0.5) * 0.12);
    if (mute) return;
    this.queue.push({ time, inst, ch, midi, dur: dur * this.beatSec, vel: v, opts });
  }

  genBar(n) {
    const def = this.def;
    this.bar = n % def.bars;
    this.pass = Math.floor(n / def.bars);
    this.barStart = this.t0 + n * this.barSec;
    this.rand = rng(hashString(def.name) + n * 7919);
    def.bar(this, this.bar, this.pass);
    this.queue.sort((a, b) => a.time - b.time);
  }

  /** until 시각 전까지의 음을 예약 */
  pump(until) {
    until = Math.min(until, this.endAt);
    while (this.t0 + this.nextBar * this.barSec < until) this.genBar(this.nextBar++);
    const now = this.ac.currentTime;
    while (this.queue.length && this.queue[0].time < until) {
      const ev = this.queue.shift();
      if (ev.time < now - 0.04) continue;           // 너무 늦은 음은 버린다 (탭 전환 직후 등)
      const dest = this.channels[ev.ch];
      if (!dest || !INSTRUMENTS[ev.inst]) { this.warnOnce(`채널/악기 없음 ${ev.ch}/${ev.inst}`); continue; }
      const t = Math.max(ev.time, now);
      if (Array.isArray(ev.midi) && ev.inst !== 'pad') {     // 패드가 아닌 악기로 바꾼 화음 파트: 음마다 따로 (크기는 패드처럼 나눔)
        const vel = ev.vel / Math.sqrt(ev.midi.length);
        for (const m of ev.midi) INSTRUMENTS[ev.inst](this.engine, dest, t, m, ev.dur, vel, ev.opts);
      } else INSTRUMENTS[ev.inst](this.engine, dest, t, ev.midi, ev.dur, ev.vel, ev.opts);
    }
  }

  fadeIn(t, sec) {
    const g = this.out.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(1, t + sec);
  }

  fadeOut(t, sec) {
    const g = this.out.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.linearRampToValueAtTime(0, t + sec);
    this.endAt = Math.min(this.endAt, t + sec);
  }

  dispose() {
    for (const s of this.loops) { try { s.stop(); } catch { /* 이미 멈춤 */ } }
    for (const n of this.nodes) n.disconnect();
    this.engine.stats.nodes -= this.nodes.length;
    this.loops.length = this.nodes.length = this.queue.length = 0;
  }
}

/** 곡 바꾸기(크로스페이드)와 예약 관리 */
export function createMusic(engine) {
  let cur = null;
  const fading = new Set();
  return {
    get current() { return cur?.def.name ?? null; },
    get player() { return cur; },
    get position() {
      if (!cur) return null;
      const t = Math.max(engine.ac.currentTime, cur.startAt) - cur.t0;
      return { bar: Math.max(0, Math.floor(t / cur.barSec)) % cur.def.bars, pass: Math.floor(Math.max(0, t) / cur.barSec / cur.def.bars), loopSec: cur.barSec * cur.def.bars };
    },
    /**
     * name = null 이면 페이드아웃만. 같은 곡이면 그대로 둔다 (restart: true 면 새로 시작).
     * from = 몇 번째 마디부터 (바퀴 포함: 두 번째 바퀴 첫 마디 = bars)
     */
    play(name, { fade = 2, restart = false, from = 0 } = {}) {
      if (!restart && (cur?.def.name ?? null) === (name ?? null)) return;
      const now = engine.ac.currentTime;
      if (cur) { cur.fadeOut(now, fade); fading.add(cur); }
      cur = null;
      if (!name) return;
      const def = SONGS[name];
      if (!def) { console.warn(`[audio] 없는 배경음: ${name}`); return; }
      cur = new SongPlayer(engine, def, now + 0.06, from);
      cur.fadeIn(now + 0.06, Math.max(0.02, fade * 0.8));
    },
    pump(ahead = 0.3) {
      const now = engine.ac.currentTime;
      cur?.pump(now + ahead);
      for (const p of fading) {
        p.pump(now + ahead);
        if (now > p.endAt + 0.25) { p.dispose(); fading.delete(p); }
      }
    },
    /** 측정용: 지금 곡을 끝까지 바로 예약 */
    scheduleAll(until) { cur?.pump(until); },
    dispose() { cur?.dispose(); for (const p of fading) p.dispose(); fading.clear(); cur = null; },
  };
}
