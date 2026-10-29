// 사운드 모듈 (트랙 T4): 배경음 · 효과음 · 주민 목소리를 전부 Web Audio 로 실시간 합성한다. 소리 파일은 쓰지 않는다.
// 곡·효과음·목소리 값과 '언제 어느 곡' 표는 assets/sound/ 의 JSON 데이터다 (곡 편집기 sound-editor.html 로 고치고 "소리 반영").
// 브라우저 자동재생 규칙 때문에 AudioContext 는 첫 클릭·키 입력(unlock) 때 만든다. 그 전의 bgm 요청은 기억했다가 그때 튼다.
// 배경음 고르는 순서: 열린 창(panels: 상점·박물관) > 직접 고른 곡(bgm 이벤트, 이름이 places 에 있으면 그 자리 곡) > 자동(날씨 > 시간대).
import { createEngine, volumeToGain, BUSES } from './engine.js';
import { createMusic, TRACKS } from './music.js';
import { SONGS } from './songs.js';
import { playSfx, SFX_NAMES, SFX_LABELS } from './sfx.js';
import { createVoice, VOICES } from './voice.js';
import { SCHEDULE, autoSong, slotForHour, loadSound, installSound } from './bank.js';

export { TRACKS, SONGS, SFX_NAMES, SFX_LABELS, VOICES, SCHEDULE };

/** 시각(시) → 시간대 배경음 (index.json 의 schedule.time) */
export function trackForHour(hour) { return slotForHour(hour)?.song ?? null; }

const LOOKAHEAD = 0.3;
// 데이터 경로(assets/…)는 프로젝트 뿌리 기준 → 이 파일 자리에서 찾는다 (demos/ 아래 페이지에서도 맞게)
const fetchJSON = url => fetch(new URL(`../../${url}`, import.meta.url)).then(r => { if (!r.ok) throw new Error(`불러오기 실패 (${r.status})`); return r.json(); });

/** ctx: 게임 공용 ctx. opts.load = url → Promise<JSON> (게임은 core/assets.js 의 loadJSON) */
export function createAudio(ctx, { load = fetchJSON } = {}) {
  const fallback = { bgm: 0.6, sfx: 0.8, voice: 0.7 };
  const S = () => ctx.state?.settings ?? fallback;     // 저장을 불러오면 객체가 바뀔 수 있어서 매번 읽는다
  let ac = null, engine = null, music = null, timer = null;
  let manual;                 // undefined = 자동, null = 끔, 'name' = 고른 곡
  let weather = null;
  const panels = [];          // 음악이 붙은 열린 창 (나중에 연 것이 위)
  const voice = createVoice(() => (engine && ac.state === 'running' ? engine : null));

  function autoTrack() {
    const t = ctx.services?.time;
    const hour = t?.now?.().hour ?? new Date().getHours();
    return autoSong({ hour, weather: t?.weather ?? weather });
  }
  function wanted() {
    if (panels.length) return SCHEDULE.panels[panels.at(-1)] || null;
    if (manual === null) return null;
    if (manual !== undefined) {
      const place = SCHEDULE.places[manual];
      if (place === undefined) return manual;
      return place || autoTrack();
    }
    return autoTrack();
  }
  // 타이머가 느려지면(창이 가려짐·무거운 프레임) 그만큼 더 앞까지 예약해서 음이 빠지지 않게 한다
  let lastTick = 0, ahead = LOOKAHEAD;
  function refresh(fade = SCHEDULE.fade.auto) {
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
      refresh(SCHEDULE.fade.manual);
    }
    if (ac.state !== 'running') ac.resume().then(() => refresh(SCHEDULE.fade.manual)).catch(() => {});
  }

  // ── 소리 데이터 불러오기 (한 번). 다 읽으면 지금 골라야 할 곡을 다시 튼다 ──
  let loading = null;
  function loadData() {
    loading ??= loadSound(load).then(data => {
      const errors = [...data.errors, ...installSound(data)];
      for (const e of errors) console.warn(`[audio] ${e}`);
      refresh(SCHEDULE.fade.manual);
      return { ...data, errors };
    });
    return loading;
  }

  const api = {
    unlock,
    /** 소리 데이터 불러오기 → Promise<{ index, sfx, voices, songs, errors }> (init 이 기다린다) */
    load: loadData,
    /** 효과음. opts: { volume, pitch, pan, delay } */
    sfx(name, opts) {
      if (!engine || ac.state !== 'running') return false;
      return playSfx(engine, name, opts);
    },
    /** 배경음 고르기: 곡 이름 | 자리 이름(places, 예: 'indoor' = 집 안) | 'auto'(자동으로 돌아가기) | null(끄기) */
    bgm(name) {
      if (name === 'auto' || name === undefined) manual = undefined;
      else if (name === null || name === 'off') manual = null;
      else if (SONGS[name] || SCHEDULE.places[name] !== undefined) manual = name;
      else { console.warn(`[audio] 없는 배경음: ${name}`); return; }
      refresh(SCHEDULE.fade.manual);
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
    else ac.resume().then(() => refresh(SCHEDULE.fade.manual)).catch(() => {});
  });

  // ── 이벤트 연결 (docs/CONTRACTS.md) ──
  const ev = ctx.events;
  if (ev) {
    ev.on('sfx', p => p?.name && api.sfx(p.name, p));
    ev.on('bgm', p => api.bgm(p?.name ?? null));
    ev.on('dialog:line', p => { if (p?.text && p.voice) api.speak(p.text, p.voice); });
    ev.on('time:part', () => refresh(SCHEDULE.fade.auto));
    ev.on('time:tick', () => { if (music && music.current !== wanted()) refresh(SCHEDULE.fade.auto); });
    ev.on('weather:change', p => { weather = p?.weather ?? null; refresh(SCHEDULE.fade.auto); });
    ev.on('ui:open', p => {
      if (SCHEDULE.panels[p?.panel]) { panels.push(p.panel); refresh(SCHEDULE.fade.panel); }
    });
    ev.on('ui:close', p => {
      const i = panels.lastIndexOf(p?.panel);
      if (i >= 0) { panels.splice(i, 1); refresh(SCHEDULE.fade.panel); }
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
  async init(ctx) {
    // 게임에서는 assets.js 의 loadJSON (웹 게시본 묶음 파일·다시 받기·로딩 화면 진행이 거기 있다). 못 부르면 fetch
    const assets = await import('../core/assets.js').catch(() => null);
    audio = createAudio(ctx, assets?.loadJSON ? { load: assets.loadJSON } : {});
    ctx.services.audio = audio;
    await audio.load();
  },
  update() { audio?.pump(); },
};
