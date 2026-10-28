// 사운드 모듈 (트랙 T4): 배경음 9곡 · 효과음 24종 · 주민 목소리를 전부 Web Audio 로 실시간 합성한다. 소리 파일은 쓰지 않는다.
// 브라우저 자동재생 규칙 때문에 AudioContext 는 첫 클릭·키 입력(unlock) 때 만든다. 그 전의 bgm 요청은 기억했다가 그때 튼다.
// 배경음 고르는 순서: 열린 창(상점·박물관) > 직접 고른 곡(bgm 이벤트) > 자동(비 오면 rain, 아니면 시각별 5곡).
import { createEngine, volumeToGain, BUSES } from './engine.js';
import { createMusic, TRACKS } from './music.js';
import { SONGS } from './songs.js';
import { playSfx, SFX_NAMES, SFX_LABELS } from './sfx.js';
import { createVoice, VOICES } from './voice.js';

export { TRACKS, SONGS, SFX_NAMES, SFX_LABELS, VOICES };

/** 시각(시) → 시간대 배경음. DAY_PARTS 의 dawn(5~8) · day(8~17) · dusk(17~19) · night 에서 day 를 오전/오후로 나눈다 */
export function trackForHour(hour) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 19) return 'evening';
  return 'night';
}

const PANEL_MUSIC = { shop: 'shop', museum: 'museum' };
const FADE = { auto: 4, manual: 2, panel: 1.2 };
const LOOKAHEAD = 0.3;

export function createAudio(ctx) {
  const fallback = { bgm: 0.6, sfx: 0.8, voice: 0.7 };
  const S = () => ctx.state?.settings ?? fallback;     // 저장을 불러오면 객체가 바뀔 수 있어서 매번 읽는다
  let ac = null, engine = null, music = null, timer = null;
  let manual;                 // undefined = 자동, null = 끔, 'name' = 고른 곡
  let weather = null;
  const panels = [];          // 음악이 붙은 열린 창 (나중에 연 것이 위)
  const voice = createVoice(() => (engine && ac.state === 'running' ? engine : null));

  function autoTrack() {
    const t = ctx.services?.time;
    const w = t?.weather ?? weather;
    if (w === 'rain') return 'rain';
    const hour = t?.now?.().hour ?? new Date().getHours();
    return trackForHour(hour);
  }
  function wanted() {
    if (panels.length) return PANEL_MUSIC[panels.at(-1)];
    if (manual !== undefined) return manual;
    return autoTrack();
  }
  // 타이머가 느려지면(창이 가려짐·무거운 프레임) 그만큼 더 앞까지 예약해서 음이 빠지지 않게 한다
  let lastTick = 0, ahead = LOOKAHEAD;
  function refresh(fade = FADE.auto) {
    if (!music) return;
    music.play(wanted(), { fade });
    music.pump(ahead);
  }

  function applyVolumes(ramp = 0.05) {
    if (!engine) return;
    for (const k of BUSES) engine.buses[k].gain.setTargetAtTime(volumeToGain(S()[k] ?? 1), ac.currentTime, ramp);
  }

  function tick() {
    if (!music || ac.state !== 'running') return;
    const now = performance.now(), gap = lastTick ? (now - lastTick) / 1000 : 0;
    lastTick = now;
    ahead = Math.min(1.5, Math.max(LOOKAHEAD, ahead * 0.98, gap * 1.5 + 0.1));
    music.pump(ahead);
  }

  /** 첫 사용자 입력 때 부른다. 여러 번 불러도 괜찮다 */
  function unlock() {
    if (document.hidden) return;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC({ latencyHint: 'interactive' });
      engine = createEngine(ac, { volumes: S() });
      music = createMusic(engine);
      timer = setInterval(tick, 50);
      refresh(FADE.manual);
    }
    if (ac.state !== 'running') ac.resume().then(() => refresh(FADE.manual)).catch(() => {});
  }

  const api = {
    unlock,
    /** 효과음. opts: { volume, pitch, pan, delay } */
    sfx(name, opts) {
      if (!engine || ac.state !== 'running') return false;
      return playSfx(engine, name, opts);
    },
    /** 배경음 고르기: 곡 이름 | 'auto'(자동으로 돌아가기) | null(끄기) */
    bgm(name) {
      if (name === 'auto' || name === undefined) manual = undefined;
      else if (name === null || name === 'off') manual = null;
      else if (SONGS[name]) manual = name;
      else { console.warn(`[audio] 없는 배경음: ${name}`); return; }
      refresh(FADE.manual);
    },
    /** 동물 목소리. → Promise<boolean> (다 말하면 true, 끊기면 false). 소리가 꺼져 있어도 같은 시간 뒤에 끝난다 */
    speak(text, voiceId) { return voice.speak(text, voiceId); },
    stopVoice() { voice.stop(); },
    setVolume(kind, v) {
      if (!BUSES.includes(kind)) return;
      S()[kind] = Math.max(0, Math.min(1, Number(v) || 0));
      applyVolumes();
    },
    /** 개발·데모용 상태 */
    get unlocked() { return !!ac && ac.state === 'running'; },
    get context() { return ac; },
    get engine() { return engine; },
    get current() { return music?.current ?? null; },
    get wanted() { return wanted(); },
    get position() { return music?.position ?? null; },
    stats() { return engine ? { state: ac.state, lookahead: +ahead.toFixed(2), ...engine.stats, notes: engine.notes?.map.size ?? 0, noteMB: +((engine.notes?.bytes ?? 0) / 2 ** 20).toFixed(1) } : { state: 'locked' }; },
    pump: tick,
  };

  // ── 자동 잠금 해제 (첫 클릭·키·터치). 탭 전환 등으로 멈춘 뒤에도 다시 깨운다 ──
  for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true, passive: true });

  // 탭이 안 보이면 소리 전체를 멈추고, 돌아오면 이어서
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) { voice.stop(); ac.suspend().catch(() => {}); }
    else ac.resume().then(() => refresh(FADE.manual)).catch(() => {});
  });

  // ── 이벤트 연결 (docs/CONTRACTS.md) ──
  const ev = ctx.events;
  if (ev) {
    ev.on('sfx', p => p?.name && api.sfx(p.name, p));
    ev.on('bgm', p => api.bgm(p?.name ?? null));
    ev.on('dialog:line', p => { if (p?.text && p.voice) api.speak(p.text, p.voice); });
    ev.on('time:part', () => refresh(FADE.auto));
    ev.on('time:tick', () => { if (music && music.current !== wanted()) refresh(FADE.auto); });
    ev.on('weather:change', p => { weather = p?.weather ?? null; refresh(FADE.auto); });
    ev.on('ui:open', p => {
      if (PANEL_MUSIC[p?.panel]) { panels.push(p.panel); refresh(FADE.panel); }
    });
    ev.on('ui:close', p => {
      const i = panels.lastIndexOf(p?.panel);
      if (i >= 0) { panels.splice(i, 1); refresh(FADE.panel); }
      if (p?.panel === 'dialog') voice.stop();
    });
    ev.on('settings:changed', p => {
      for (const k of BUSES) if (typeof p?.[k] === 'number') S()[k] = p[k];
      if (BUSES.includes(p?.key) && typeof p.value === 'number') S()[p.key] = p.value;
      applyVolumes();
    });
  }
  return api;
}

let audio = null;

export default {
  name: 'audio',
  init(ctx) {
    audio = createAudio(ctx);
    ctx.services.audio = audio;
  },
  update() { audio?.pump(); },
};
