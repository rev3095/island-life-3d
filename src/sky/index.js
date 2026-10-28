// 트랙 T5: 시간·계절·날씨·하늘.
// ctx.services.time 을 올리고, 매 프레임 하늘 돔·조명(ctx.lights)·안개·구름·비/눈·밤 조명을 시각과 날씨에 맞춘다.
// 약속은 docs/CONTRACTS.md 의 time 항목.
import * as THREE from 'three';
import { computeNow, dayHour, msAtDayHour, nightFactorAt, FAST_SCALE } from './clock.js';
import { forecast, weatherAt, WEATHERS } from './weather.js';
import { skyLook } from './look.js';
import { indoorLook } from './indoor.js';
import { createDome } from './dome.js';
import { createClouds } from './clouds.js';
import { createPrecip } from './precip.js';
import { createSurfaces } from './surfaces.js';
import { loadEnvSpecs, buildSeasonPalettes, fallbackPalettes } from './seasons.js';
import { createDebugPanel } from './debug.js';

// 날씨별 목표값. 실제 값은 몇 초에 걸쳐 이쪽으로 다가간다.
const WX = {
  clear: { overcast: 0, rain: 0, snow: 0, rainbow: 0, cover: 0, wet: 0 },
  cloudy: { overcast: 0.6, rain: 0, snow: 0, rainbow: 0, cover: 0.8, wet: 0 },
  rain: { overcast: 0.9, rain: 1, snow: 0, rainbow: 0, cover: 1, wet: 1 },
  snow: { overcast: 0.65, rain: 0, snow: 1, rainbow: 0, cover: 0.9, wet: 0 },
  rainbow: { overcast: 0.05, rain: 0, snow: 0, rainbow: 1, cover: 0.3, wet: 0.45 },
};
const TAU = { overcast: 4, rain: 2.5, snow: 3, rainbow: 5, cover: 6 };   // 초
const WET_IN = 25, WET_OUT = 60;                                         // 땅은 천천히 젖고 더 천천히 마른다
const SCAN_EVERY = 3;                                                    // 밤 조명 재질 다시 훑기 (초)
const SUN_DIST = 24;

const setSRGB = (color, a) => color.setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace);

export function createSky(ctx) {
  const { scene, camera, events, constants } = ctx;
  let realShift = 0, pausedMs = null, weatherOverride = null, seasonOverride = null;
  let indoor = false;               // 집 안: 하늘·구름·비·눈을 숨기고 실내 조명 (setIndoor)
  let palettes = fallbackPalettes();
  let fc = { key: null, segs: null };
  let memo = { ms: NaN, now: null };
  const last = { minute: null, part: null, dayKey: null, season: null, weather: null };
  const wx = { ...WX.clear };
  let elapsed = 0, scanIn = 0;

  const tstate = () => {
    const t = (ctx.state.time ||= {});
    if (t.mode !== 'fast') t.mode = 'real';
    if (typeof t.fastOffset !== 'number') t.fastOffset = 0;
    return t;
  };

  function clockMs() {
    if (pausedMs != null) return pausedMs;
    const t = tstate();
    return t.mode === 'fast' ? Date.now() * FAST_SCALE + t.fastOffset : Date.now() + realShift;
  }

  function now() {
    const ms = clockMs();
    // 같은 프레임 안에선 같은 객체를 돌려준다 (이벤트 받는 쪽이 고치지 못하게 얼림)
    if (ms !== memo.ms) memo = { ms, now: Object.freeze(computeNow(ms, { seasonOf: constants.seasonOf, parts: constants.DAY_PARTS, seasonOverride })) };
    return memo.now;
  }

  /** 그 날(dayKey)의 계절: 0~5시는 전날 기준이라 달이 바뀌는 밤에도 예보가 흔들리지 않는다 */
  const seasonOfDay = n => seasonOverride ?? constants.seasonOf(Number(n.dayKey.slice(5, 7)));

  function forecastFor(dayKey, season) {
    const key = `${dayKey}|${season}`;
    if (fc.key !== key) fc = { key, segs: forecast(dayKey, season, ctx.state.island?.seed ?? 0) };
    return fc.segs;
  }
  const autoWeather = n => weatherAt(forecastFor(n.dayKey, seasonOfDay(n)), dayHour(n.hourF));
  const currentWeather = () => weatherOverride ?? autoWeather(now());

  /** 같은 흐름을 유지한 채 시계를 target(ms) 으로 옮긴다 */
  function shiftTo(target) {
    if (pausedMs != null) { pausedMs = target; return; }
    const t = tstate();
    const d = target - clockMs();
    if (t.mode === 'fast') t.fastOffset += d;
    else realShift += d;
  }

  const service = {
    now,
    get mode() { return tstate().mode; },
    setMode(mode) {
      if (mode !== 'real' && mode !== 'fast') return;
      const t = tstate();
      if (t.mode === mode) return;
      const cur = clockMs();
      t.mode = mode;
      if (mode === 'fast') t.fastOffset = cur - Date.now() * FAST_SCALE;   // 지금 시각에서 이어서 빨리 간다
      else { realShift = 0; if (pausedMs != null) pausedMs = Date.now(); } // 실제 시계로 돌아간다
    },
    get weather() { return currentWeather(); },
    /** w: WEATHERS 중 하나. null 이면 예보대로. 다음 날이 되면 풀린다. { instant: true } 면 섞지 않고 바로 */
    setWeather(w, { instant = false } = {}) {
      weatherOverride = WEATHERS.includes(w) ? w : null;
      if (instant) Object.assign(wx, WX[currentWeather()]);
    },
    get nightFactor() { return nightFactorAt(now().hourF); },
    /** 계절 팔레트 { grass, grassDark, leaf, trunk, evergreen, snow, variants:{slug: 변형이름}, bySlug:{slug:{색}} } */
    seasonPalette(season = now().season) { return palettes[season] ?? palettes.autumn; },

    // ── 아래는 계약 밖의 개발·시연용 ──
    /** 오늘(dayKey) 예보 [{from, weather}] — from 은 5~29시 */
    forecast(dayKey = now().dayKey) { return forecastFor(dayKey, seasonOverride ?? constants.seasonOf(Number(dayKey.slice(5, 7)))).map(s => ({ ...s })); },
    /** 오늘 안에서 시각 옮기기. hh: 5~29 (0~5 를 주면 그날 밤으로) */
    setHour(hh) { if (hh < 5) hh += 24; shiftTo(msAtDayHour(now().dayKey, hh)); },
    get paused() { return pausedMs != null; },
    setPaused(on) {
      if (on && pausedMs == null) pausedMs = clockMs();
      else if (!on && pausedMs != null) { const t = pausedMs; pausedMs = null; shiftTo(t); }
    },
    get weatherOverride() { return weatherOverride; },
    get seasonOverride() { return seasonOverride; },
    setSeasonOverride(s) { seasonOverride = constants.SEASONS.includes(s) ? s : null; memo.ms = NaN; },

    // ── 실내 모드 (2차 P4: 집 안) ──
    get indoor() { return indoor; },
    /** 집 안이면 true: 하늘 돔·구름·비·눈을 숨기고 따뜻한 실내 조명, 안개 끔. false 면 그대로 되돌린다. 시계·날씨는 계속 흐른다 */
    setIndoor(on) {
      on = !!on;
      if (on === indoor) return;
      indoor = on;
      for (const g of [dome.group, clouds.group, precip.group]) g.visible = !on;
      step(0);
      events.emit('scene:indoor', { on });
    },
  };

  // 장면 물체
  const dome = createDome();
  const clouds = createClouds(ctx.materials);
  const precip = createPrecip(ctx.materials.curve);
  const surfaces = createSurfaces(ctx.materials.curve);
  let debug = null;

  function syncSeason(season) { try { ctx.services.world?.setSeason?.(season); } catch (e) { console.error('[sky] setSeason 실패', e); } }

  function emitAll(initial) {
    const n = now();
    events.emit('time:tick', { now: n });
    events.emit('time:part', { part: n.part, initial });
    events.emit('weather:change', { weather: last.weather, initial });
  }

  function step(dt) {
    const n = now();
    // 이벤트
    const minute = Math.floor(n.ms / 60000);
    if (minute !== last.minute) { last.minute = minute; events.emit('time:tick', { now: n }); }
    if (n.part !== last.part) { last.part = n.part; events.emit('time:part', { part: n.part }); }
    if (n.dayKey !== last.dayKey) {
      last.dayKey = n.dayKey;
      weatherOverride = null;
      events.emit('time:newday', { dayKey: n.dayKey });
    }
    if (n.season !== last.season) { last.season = n.season; syncSeason(n.season); }
    const w = currentWeather();
    if (w !== last.weather) { last.weather = w; events.emit('weather:change', { weather: w }); }

    // 날씨 섞기
    const target = WX[w];
    for (const k in TAU) wx[k] += (target[k] - wx[k]) * (1 - Math.exp(-dt / TAU[k]));
    wx.wet += (target.wet - wx.wet) * (1 - Math.exp(-dt / (target.wet > wx.wet ? WET_IN : WET_OUT)));

    // 하늘·조명
    const nf = nightFactorAt(n.hourF);
    const look = skyLook(n.hourF, wx, nf);
    const { hemi, sun, sunOffset } = ctx.lights;
    const lit = indoor ? indoorLook(nf) : look;
    setSRGB(hemi.color, lit.hemiSky);
    setSRGB(hemi.groundColor, lit.hemiGround);
    hemi.intensity = lit.hemiI;
    setSRGB(sun.color, lit.sunColor);
    sun.intensity = lit.sunI;
    sunOffset.fromArray(lit.lightDir).multiplyScalar(SUN_DIST);
    if (!scene.fog) scene.fog = new THREE.Fog(0xffffff, 30, 100);
    setSRGB(scene.fog.color, look.horizon);
    // 실내: 안개 객체는 두고(셰이더를 다시 만들지 않게) 아주 멀리 민다
    scene.fog.near = indoor ? 1e4 : look.fogNear;
    scene.fog.far = indoor ? 2e4 : look.fogFar;
    if (!scene.background?.isColor) scene.background = new THREE.Color();
    if (indoor) setSRGB(scene.background, lit.background);
    else scene.background.copy(scene.fog.color);

    elapsed = (elapsed + dt) % 2000;
    const viewH = ctx.renderer?.domElement.height || innerHeight;
    const viewScale = viewH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    dome.update(look, camera, elapsed, ctx.renderer?.getPixelRatio() ?? 1);
    clouds.update(dt, ctx.focus, wx.cover, Math.min(1, wx.overcast * 0.55 + wx.rain * 0.45), look.horizon);
    precip.update(dt, elapsed, ctx.focus, camera, { rain: wx.rain, snow: wx.snow, rainbow: wx.rainbow * (1 - nf) }, viewH, ctx.renderer?.getPixelRatio() ?? 1);

    if ((scanIn -= dt) <= 0) { scanIn = SCAN_EVERY; surfaces.scan(scene); }
    surfaces.update(elapsed, indoor ? nf : Math.max(nf, 0.4 * wx.rain), wx.wet, viewScale);   // 집 안 불빛은 비와 상관없이 밤에만
    debug?.update();
  }

  return {
    service,
    stats: () => ({ wx: { ...wx }, ...surfaces.counts() }),
    async init() {
      ctx.services.time = service;
      tstate();
      try { palettes = buildSeasonPalettes(await loadEnvSpecs(ctx.assets)); }
      catch (e) { console.warn('[sky] 배경 스펙을 못 읽어 기본 계절 팔레트를 씁니다', e); }
      scene.add(dome.group, clouds.group, precip.group, surfaces.group);

      // 시작 상태: 이벤트 없이 맞춰 두고, 모두 준비되면(game:ready) 한 번에 알린다
      const n = now();
      Object.assign(last, { minute: Math.floor(n.ms / 60000), part: n.part, dayKey: n.dayKey, season: n.season, weather: currentWeather() });
      Object.assign(wx, WX[last.weather]);
      events.on('world:ready', () => { syncSeason(now().season); scanIn = 0; });
      events.on('game:ready', () => { syncSeason(now().season); scanIn = 0; emitAll(true); });
      syncSeason(n.season);
      if (ctx.debug) debug = createDebugPanel(ctx.uiRoot, service);
      step(0);
    },
    update: step,
  };
}

let sky = null;
export default {
  name: 'sky',
  async init(ctx) {
    sky = createSky(ctx);
    await sky.init();
  },
  update(dt) { sky?.update(dt); },
};
