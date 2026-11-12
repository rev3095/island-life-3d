// 트랙 T5: 시간·계절·날씨·하늘.
// ctx.services.time 을 올리고, 매 프레임 하늘 돔·조명(ctx.lights)·안개·구름·비/눈·밤 조명을 시각과 날씨에 맞춘다.
// 약속은 docs/CONTRACTS.md 의 time 항목.
import * as THREE from 'three';
import { computeNow, dayHour, msAtDayHour, nightFactorAt, msAtClock, dayDiff, dayKeyOf, createTimeline, timeRules, SPEED_KEYS, SPEED_NAME, dayLengthText } from './clock.js';
import { shiftedMs } from '../core/preview.js';
import { forecast, weatherAt, WEATHERS } from './weather.js';
import { skyLook } from './look.js';
import { indoorLook } from './indoor.js';
import { createDome, SKY_FX } from './dome.js';
import { createMeteors } from './meteors.js';   // M13 FX-02 별똥별 (유성우 밤에만 — daily 가 time.meteors.set)
import { createClouds } from './clouds.js';
import { createFlare, flareStrength } from './flare.js';
import { QUALITY } from '../render/quality.js';
import { SKY } from '../render/presets.js';
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
// 하늘 값은 assets/style/presets.json 의 sky (스타일 편집기 「하늘」 → "스타일 반영"). 없는 값은 dome.js SKY_FX · 아래 기본값
const { cloudShadow: SKY_CLOUD_SHADOW, ...SKY_FILE_FX } = SKY;
Object.assign(SKY_FX, SKY_FILE_FX);
let cloudShadow = SKY_CLOUD_SHADOW ?? 0.3;   // 구름 그림자 진하기 (해를 받은 곳에서 최대 30% 어둡게)
const CLOUD_DRIFT = [0.0042, 0.0014];  // 구름 그림자 흐름 (무늬 좌표/초 ≈ 0.35칸/초 — 하늘 구름과 같은 쪽으로)

const setSRGB = (color, a) => color.setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace);

export function createSky(ctx) {
  const { scene, camera, events, constants } = ctx;
  // 8차 D85-A: 날짜 흉내(#date=)면 실제 시계를 그 날짜의 지금 시각으로 옮겨 둔다 (실제 시계로 돌아가도 이 날짜)
  const baseShift = ctx.preview?.date ? shiftedMs(ctx.preview.date) - Date.now() : 0;
  // 11차 시계 + p41 시간 빠르기 — 몸통은 clock.js createTimeline:
  //   실제와 같게 = Date.now() + baseShift + state.time.offset · 빠르게 = state.time.game (열려 있는 동안 실제 × 배수로 흐름)
  const TR = timeRules(ctx.services.data?.rules?.time);   // rules.json time (요소 편집기) — data 가 sky 보다 먼저 뜬다
  const tl = createTimeline({ getTime: () => (ctx.state.time ||= {}), baseShift, rules: TR, extraDay: () => (ctx.preview ? null : ctx.state.island?.dayKey ?? null) });
  let weatherOverride = null, seasonOverride = null;
  let puffs = true;                 // 북쪽 3D 솜구름 (skyFx({ puffs })) — 매우 낮음 사양은 늘 숨김 (applyPuffs)
  let flare = null;                 // 해 렌즈 빛 (flare.js, 불러온 뒤)
  let indoor = false;               // 집 안: 하늘·구름·비·눈을 숨기고 실내 조명 (setIndoor)
  let palettes = fallbackPalettes();
  let fc = { key: null, segs: null };
  let memo = { ms: NaN, now: null };
  const last = { minute: null, part: null, dayKey: null, season: null, weather: null };
  const wx = { ...WX.clear };
  let elapsed = 0, scanIn = 0;
  let snowAcc = null, snowLite = 0;        // 셰이더 보드 D130: 땅에 쌓인 눈 0~1 (눈 오는 동안 쌓이고 그치면 녹는다). null = 다음 프레임에 지금 날씨로 바로

  const tstate = tl.state;
  const clockMs = tl.clockMs;
  const catchUp = tl.catchUp;

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
  /**
   * 셰이더 보드 효과 중 오늘 셰이더에 넣을 것 (사양 높음·적정만 — 낮음 아래는 render 가 'lite' = 하나도 안 넣음).
   * 잎 뒤 비침·낮은 안개·물 빛 그물은 늘, 눈은 오늘 예보에 눈이 있을 때, 젖은 땅은 비(무지개)가 있을 때, 반짝임은 그 둘 중 하나와 같이 (높음만).
   * 왜: 효과를 셰이더 글자로 늘 넣어 두면 값이 0 이어도 내장 그래픽이 느려진다 (적정 광장 +1.27ms) — 그날 필요한 것만 넣으면 맑은 날 +0.36ms.
   * 다시 만드는 때: 처음 · 하루가 바뀔 때 · 날씨를 직접 바꿀 때(setWeather) · 사양을 바꿀 때 (그때만 툰 재질을 한 번 다시 만든다)
   */
  function syncShaderFx() {
    const q = QUALITY[ctx.quality];
    if (!q || q.shaderFx !== 'full' || !ctx.materials?.setShaderTier) return;
    const n = now(), fx = q.fx ?? {};
    const ws = new Set(forecastFor(n.dayKey, seasonOfDay(n)).map(s => s.weather));
    ws.add(currentWeather());
    const list = ['leaf', 'hfog', 'caustic'].filter(k => fx[k]);
    const snow = !!fx.snow && ws.has('snow'), wet = !!fx.wet && (ws.has('rain') || ws.has('rainbow'));
    if (snow) list.push('snow');
    if (wet) list.push('wet');
    if (fx.glitter && (snow || wet)) list.push('glitter');
    if (ctx.materials.setShaderTier(list)) console.info(`[sky] 셰이더 효과: ${list.join(' · ') || '없음'}`);
  }

  /**
   * 11차 시계: 시계를 옮기고(move) 바로 하늘·조명·이벤트를 맞춘 뒤 time:shift 를 보낸다.
   * → { ok, now, prevMs, offset, days(바뀐 날 수), back(과거로), clamped, reason }
   */
  function jump(move, { reason = 'clock', clamped = null } = {}) {
    const prev = now();
    move();
    memo.ms = NaN;
    const n = now();
    const days = dayDiff(prev.dayKey, n.dayKey);
    // 시간을 건너뛴 것이라 날씨 섞기도 새 날씨로 바로 (비 그친 하늘이 몇 초 동안 남지 않게)
    Object.assign(wx, WX[currentWeather()]);
    scanIn = 0;
    step(0);
    const info = { now: n, prevMs: prev.ms, offset: tl.offset(), days, back: n.ms < prev.ms, clamped, reason };
    events.emit('time:shift', info);
    return { ok: true, ...info };
  }
  /** 갈 시각(ms) 으로 — 가 본 날 아침 5시보다 앞(floor)·SHIFT_MAX_DAYS 일 뒤(ceil)는 그 끝으로 붙인다 */
  const jumpClamped = (target, reason) => { const r = tl.clamp(target); return jump(() => tl.shiftTo(r.ms), { clamped: r.clamped, reason }); };

  const service = {
    now,
    /** 예전 이름: 'real' (실제와 같게) | 'fast' (빠르게·아주 빠르게) */
    get mode() { return tl.speed === 'real' ? 'real' : 'fast'; },
    setMode(mode) { service.setSpeed(mode === 'real' ? 'real' : 'fast'); },
    // ── p41 시간 빠르기 ──
    /** 'real' | 'fast' | 'faster' (state.time.speed, 안 골랐으면 rules.json time.speed) */
    get speed() { return tl.speed; },
    /** 지금 배수 (실제 1분 = 게임 몇 분) */
    get speedMult() { return tl.mult; },
    /** [{ key, name, mult, text }] — 섬폰 설정·HUD 가 쓴다 */
    speeds: () => SPEED_KEYS.map(k => ({ key: k, name: SPEED_NAME[k], mult: TR.speeds[k], text: dayLengthText(TR.speeds[k]) })),
    get whenClosed() { return TR.whenClosed; },
    /** 빠르기 바꾸기 (지금 시각에서 끊김 없이) → time:speed { speed, mult } */
    setSpeed(k) {
      if (!tl.setSpeed(k)) return false;
      memo.ms = NaN;
      events.emit('time:speed', { speed: tl.speed, mult: tl.mult });
      return true;
    },

    // ── 11차 시계 (섬폰 「🕰 시계」 · docs/CONTRACTS.md 「11차 시계」) ──
    /** 실제 시계(날짜 흉내 포함)에서 떨어진 정도 (ms). 0 = 실제 시각 */
    get offset() { return tl.offset(); },
    /** 가 본 가장 늦은 날 — 이 날 아침 5시보다 앞으로는 못 돌린다 */
    get maxDay() { return tl.maxDay(); },
    /** 돌릴 수 있는 범위 { floor, ceil } (ms) */
    range: () => tl.range(),
    /** offset 을 바로 정한다 (범위 밖은 끝에 붙음, 빠른 시간이면 실제 시간으로) → jump 결과 */
    setOffset(ms) {
      if (!Number.isFinite(ms)) return { ok: false };
      memo.ms = NaN;
      return jumpClamped(Date.now() + baseShift + ms, 'offset');
    },
    /** 갈 시각(ms) 으로 → jump 결과 */
    jumpTo: ms => (Number.isFinite(ms) ? jumpClamped(ms, 'clock') : { ok: false }),
    /** 오늘(dayKey)+days 날의 hour:minute 으로 (0~5시는 그날 밤, 5시 경계) → jump 결과 */
    shiftTo(hour, minute = 0, { days = 0 } = {}) {
      if (!Number.isFinite(hour)) return { ok: false };
      return jumpClamped(msAtClock(now().dayKey, hour, minute, days), 'clock');
    },
    /** 「지금 시각으로 돌아가기」: offset 0 (빠른 시간이면 실제 시간으로). 가 본 날보다 앞이면 그 날 같은 시각 → jump 결과 + caught(더한 날 수) */
    resetOffset() {
      const r = tl.resetTarget();
      return { ...jump(() => tl.shiftTo(r.target), { reason: 'reset' }), caught: r.caught };
    },
    get weather() { return currentWeather(); },
    /** w: WEATHERS 중 하나. null 이면 예보대로. 다음 날이 되면 풀린다. { instant: true } 면 섞지 않고 바로 */
    setWeather(w, { instant = false } = {}) {
      weatherOverride = WEATHERS.includes(w) ? w : null;
      if (instant) { Object.assign(wx, WX[currentWeather()]); snowAcc = null; }
      syncShaderFx();
    },
    get nightFactor() { return nightFactorAt(now().hourF); },
    /** 계절 팔레트 { grass, grassDark, leaf, trunk, evergreen, snow, variants:{slug: 변형이름}, bySlug:{slug:{색}} } */
    seasonPalette(season = now().season) { return palettes[season] ?? palettes.autumn; },

    // ── 아래는 계약 밖의 개발·시연용 ──
    /** 오늘(dayKey) 예보 [{from, weather}] — from 은 5~29시 */
    forecast(dayKey = now().dayKey) { return forecastFor(dayKey, seasonOverride ?? constants.seasonOf(Number(dayKey.slice(5, 7)))).map(s => ({ ...s })); },
    /** 오늘 안에서 시각 옮기기. hh: 5~29 (0~5 를 주면 그날 밤으로) */
    setHour(hh) { if (hh < 5) hh += 24; tl.shiftTo(msAtDayHour(now().dayKey, hh)); },   // 조용히 (time:shift 없음 — 봇·점검이 쓴다)
    get paused() { return tl.paused; },
    setPaused(on) { tl.setPaused(on); },
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
      if (!on) applyPuffs();
      step(0);
      events.emit('scene:indoor', { on });
    },
    /** 하늘 셰이더 값 (src/sky/dome.js SKY_FX 이름) + 땅 위 구름 그림자 cloudShadow 바꾸기 → 지금 값. puffs = 북쪽 먼 하늘의 3D 솜구름 보이기. 하늘 검수 보드·스타일 편집기가 쓴다 */
    skyFx(v = {}) {
      if (typeof v.puffs === 'boolean') { puffs = v.puffs; applyPuffs(); }
      if (typeof v.cloudShadow === 'number') cloudShadow = v.cloudShadow;
      return { ...dome.setFx(v), puffs, cloudShadow };
    },
  };

  // 장면 물체
  const dome = createDome({ quality: ctx.quality });   // 하늘 셰이더는 사양(render/quality.js)에 따라 구름 겹 수·빛살·은하수를 줄인다
  const meteors = createMeteors({ quality: ctx.quality });
  dome.group.add(meteors.group);   // 실내에선 돔과 같이 숨는다
  service.meteors = { set: on => meteors.set(on), get on() { return meteors.on; } };
  const clouds = createClouds(ctx.materials);
  /** 북쪽 3D 솜구름 보이기 = 보드 값(puffs) · 사양(매우 낮음은 숨김 — 그리기 호출·삼각형 아끼기) · 집 밖 */
  const applyPuffs = () => { clouds.group.visible = puffs && !indoor && QUALITY[ctx.quality]?.fx?.puffs !== false; };
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
    tl.advance();   // p41: 빠르게면 실제로 흐른 만큼 × 배수
    const n = now();
    // 이벤트
    const minute = Math.floor(n.ms / 60000);
    if (minute !== last.minute) { last.minute = minute; events.emit('time:tick', { now: n }); }
    if (n.part !== last.part) { last.part = n.part; events.emit('time:part', { part: n.part }); }
    if (n.dayKey !== last.dayKey) {
      last.dayKey = n.dayKey;
      tl.mark(n.dayKey);   // 11차 시계: 가 본 가장 늦은 날
      weatherOverride = null;
      syncShaderFx();
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
    dome.update(look, camera, elapsed, ctx.renderer?.getPixelRatio() ?? 1, { cover: wx.cover, grey: Math.min(1, wx.overcast * 0.6 + wx.rain * 0.4), night: nf });
    meteors.update(dt, camera, { night: nf, cover: wx.cover });
    clouds.update(dt, ctx.focus, wx.cover, Math.min(1, wx.overcast * 0.55 + wx.rain * 0.45), look.horizon);
    // 하늘 → 땅·물 셰이더 (core/materials.js look): 구름 그림자는 해가 보일 때만, 흐를수록 짙게 · 물에 비칠 하늘 색 (선형)
    const L = ctx.materials?.look;
    if (L?.uCloudShadow) {
      L.uCloudShadow.value = indoor ? 0 : cloudShadow * look.sunVis * (1 - 0.75 * wx.overcast);
      L.uCloudCover.value = wx.cover;
      L.uCloudOffset.value.x = (L.uCloudOffset.value.x + dt * CLOUD_DRIFT[0]) % 1;
      L.uCloudOffset.value.y = (L.uCloudOffset.value.y + dt * CLOUD_DRIFT[1]) % 1;
      L.uSkyZenithL.value.setRGB(look.zenith[0], look.zenith[1], look.zenith[2], THREE.SRGBColorSpace);
      L.uSkyHorizonL.value.setRGB(look.horizon[0], look.horizon[1], look.horizon[2], THREE.SRGBColorSpace);
      // 셰이더 보드 shader v1: 날씨·시각으로 바뀌는 셋 = 세기(render 가 프리셋 × 사양으로 weatherFx 에) × 지금 날씨. 집 안은 0
      const W = ctx.materials.weatherFx;
      if (W && L.uSnowCover) {
        // D130-B 눈 오는 날만: 눈이 오면 40초에 걸쳐 쌓이고, 그치면 150초에 걸쳐 녹는다 (처음·날씨 바로 바꾸기는 그 자리에서)
        snowAcc = snowAcc == null ? wx.snow : snowAcc + (wx.snow - snowAcc) * (1 - Math.exp(-dt / (wx.snow > snowAcc ? 40 : 150)));
        snowLite = !ctx.materials.hasShaderFx?.('snow') && !indoor ? W.snow * snowAcc : 0;   // 셰이더에 눈이 없으면(낮음 아래): 땅 재질 색으로 (surfaces)
        L.uSnowCover.value = indoor ? 0 : W.snow * snowAcc;
        // D132-A 비 올 때 또렷하게: 젖음(비 그친 뒤 천천히 마름)을 그대로
        L.uWetSheen.value = indoor ? 0 : W.wet * wx.wet;
        // D133-A 새벽(4–8시) 0.6 · 비 0.4
        const h = n.hourF % 24, sm = THREE.MathUtils.smoothstep;
        const dawn = sm(h, 4, 5) * (1 - sm(h, 7, 8.5));
        L.uHeightFog.value = indoor ? 0 : W.hfog * Math.min(1, 0.6 * dawn + 0.4 * wx.rain);
        // 낮음·매우 낮음(셰이더 글자 없음): 낮은 안개 대신 거리 안개를 가까이 당긴다 (이미 있는 안개 계산이라 GPU 몫 0)
        if (!indoor && !ctx.materials.hasShaderFx?.('hfog') && L.uHeightFog.value > 0) {
          scene.fog.near *= 1 - 0.45 * L.uHeightFog.value;
          scene.fog.far *= 1 - 0.3 * L.uHeightFog.value;
        }
      }
    }
    flare?.update(camera, look.sunSky, flareStrength({ enabled: !!QUALITY[ctx.quality]?.fx?.flare, indoor, sunVis: look.sunVis, overcast: wx.overcast }), Math.min(1, look.weights.dawn + look.weights.dusk));
    precip.update(dt, elapsed, ctx.focus, camera, { rain: wx.rain, snow: wx.snow, rainbow: wx.rainbow * (1 - nf) }, viewH, ctx.renderer?.getPixelRatio() ?? 1);

    if ((scanIn -= dt) <= 0) { scanIn = SCAN_EVERY; surfaces.scan(scene); }
    surfaces.update(elapsed, indoor ? nf : Math.max(nf, 0.4 * wx.rain), wx.wet, viewScale, snowLite);
    surfaces.snowVerts(snowLite);   // 집 안 불빛은 비와 상관없이 밤에만
    debug?.update();
  }

  return {
    service,
    stats: () => ({ wx: { ...wx }, ...surfaces.counts() }),
    async init() {
      ctx.services.time = service;
      const t0 = tstate();
      // 11차 시계: 날짜 흉내는 시험 칸이라 그 날짜에서 새로 센다. 진짜 섬은 가 본 날보다 앞이면 그날로 맞춘다
      if (ctx.preview) { t0.maxDay = null; t0.offset = 0; }
      tl.start({ fresh: !!ctx.preview });   // p41: 날짜 흉내는 그 날짜 지금 시각에서, 진짜 섬은 저장 시각에서 (닫아 둔 동안: rules time.whenClosed)
      if (!ctx.preview) catchUp();
      if (!t0.maxDay) t0.maxDay = dayKeyOf(clockMs());
      events.on('data:loaded', () => { tstate(); if (!ctx.preview) catchUp(); memo.ms = NaN; });
      try { palettes = buildSeasonPalettes(await loadEnvSpecs(ctx.assets)); }
      catch (e) { console.warn('[sky] 배경 스펙을 못 읽어 기본 계절 팔레트를 씁니다', e); }
      scene.add(dome.group, clouds.group, precip.group, surfaces.group);

      // 시작 상태: 이벤트 없이 맞춰 두고, 모두 준비되면(game:ready) 한 번에 알린다
      const n = now();
      Object.assign(last, { minute: Math.floor(n.ms / 60000), part: n.part, dayKey: n.dayKey, season: n.season, weather: currentWeather() });
      Object.assign(wx, WX[last.weather]);
      events.on('world:ready', () => { syncSeason(now().season); scanIn = 0; });
      events.on('game:ready', () => { syncSeason(now().season); scanIn = 0; emitAll(true); });
      const tier = q => { dome.setQuality(q); applyPuffs(); syncShaderFx(); };
      events.on('quality:changed', ({ quality }) => meteors.setQuality(quality));   // M13 별똥별 사양
      events.on('quality:changed', ({ quality }) => tier(quality));
      tier(ctx.quality);              // 처음 사양 (주소·저장된 사양). 바꾸면 quality:changed 로
      // 해 렌즈 빛 (three.js 예제 Lensflare) — 못 불러와도 하늘은 그대로
      createFlare(THREE).then(f => { flare = f; scene.add(f.object); }).catch(e => console.warn('[sky] 해 렌즈 빛을 못 불러왔어요', e));
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
