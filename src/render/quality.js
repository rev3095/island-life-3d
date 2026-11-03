// 사양(품질) 단계와 자동 판단.
// 단계 넷 (가벼운 것 ← → 무거운 것): min 매우 낮음 · low 낮음 · mid 적정 · high 높음. 처음은 적정(DEFAULT_QUALITY).
// 주소(?quality=low · 게시본 #low)나 섬폰 설정 「그래픽 사양」(state.settings.spec)으로 고르면 그대로, 아니면 자동:
// 처음 몇 초가 느리면 한 칸 낮추고, 그 뒤에도 광장(축제 광장)에서 평균 프레임이 33ms 를 넘으면 한 칸씩 (createPlazaWatch, 아래 「광장 기준」).
// 재는 것: 화면이 보이는 동안의 실제 프레임 간격(rAF). 숨겨진 창·디버거 멈춤처럼 너무 긴 간격(50ms 넘음)은 버린다.
// GPU 시간(EXT_disjoint_timer_query_webgl2)이 있으면 같이 본다 — 프레임이 느려도 GPU 가 한가하면(다른 이유로 느림) 낮추지 않는다.
// (GPU 시간만 보면 안 된다: 60fps 에 맞춰 쉬는 GPU 는 클럭을 내려 같은 일을 더 오래 한다)
// 2026-11-01 Intel UHD · 1280×800 광장 GPU 시간: 높음 38ms · (예전 보통 22ms) · 적정 14.6ms. 칠하는 화소(땅·물체)·외곽선·그림자·화면 효과 순으로 무겁다.

/** 사양 단계 값.
 *  maxRatio·maxPixels: 화소 배율 = min(기기 배율, maxRatio, √(maxPixels ÷ 화면 CSS 화소)), 0.5 아래로는 안 내린다 (ratioFor).
 *    — 낮음·매우 낮음은 큰 화면에서 작게 그려 늘린다 (휴대폰처럼 작은 화면은 1 그대로).
 *  shadows: 해 그림자 (광장 그리기 삼각형의 절반 넘게가 그림자 몫) · post: 화면 효과 5단계(빛 번짐·흐림·색 보정·FXAA) — 끄면 바로 그리기
 *  outlines: 외곽선 껍데기 (그리기 호출·삼각형이 그만큼 더) · fps: 초당 장수 상한 (0 = 화면 주사율대로)
 *  aa: 계단 무늬 줄이기(MSAA) — 렌더러를 만들 때만 정할 수 있어서, 처음 사양(주소·저장된 사양)으로 정하고 바꾸면 다시 열 때 걸린다
 *  fx: 셰이더 켜고 끄기 (uniform 이라 셰이더를 다시 만들지 않는다, render/index.js apply):
 *    cloudShadow 구름 그림자 · skyReflect 물 하늘 반사 · flare 해 렌즈 빛(sky) · spec 하이라이트 · rim 가장자리 빛 · ao 접촉 그늘 · water 물결 무늬 · puffs 북쪽 3D 솜구름(sky) */
export const QUALITY = {
  high: { maxRatio: 2, maxPixels: Infinity, shadowSize: 2048, shadows: true, post: true, outlines: true, fps: 0, aa: true,
    fx: { cloudShadow: 1, skyReflect: 1, flare: true, spec: 1, rim: 1, ao: 1, water: 1, puffs: true } },
  mid: { maxRatio: 1, maxPixels: Infinity, shadowSize: 1024, shadows: false, post: false, outlines: true, fps: 0, aa: true,
    fx: { cloudShadow: 1, skyReflect: 1, flare: true, spec: 1, rim: 1, ao: 1, water: 1, puffs: true } },
  low: { maxRatio: 1, maxPixels: 750_000, shadowSize: 1024, shadows: false, post: false, outlines: false, fps: 0, aa: false,
    fx: { cloudShadow: 0, skyReflect: 1, flare: false, spec: 0, rim: 1, ao: 0, water: 1, puffs: true } },
  min: { maxRatio: 1, maxPixels: 400_000, shadowSize: 1024, shadows: false, post: false, outlines: false, fps: 30, aa: false,
    fx: { cloudShadow: 0, skyReflect: 0, flare: false, spec: 0, rim: 0, ao: 0, water: 0, puffs: false } },
};
/** 저장 글(localStorage 'island-life-save-v1' 의 JSON 글자)에서 섬폰 「그래픽 사양」만 빨리 꺼낸다 → 사양 이름 | null.
 *  main.js 가 렌더러를 만들기 전에(저장을 다 읽기 전) 계단 무늬 줄이기를 정하려고 쓴다 */
export function savedSpec(raw) {
  const m = typeof raw === 'string' ? /"spec"\s*:\s*"(\w+)"/.exec(raw) : null;
  return m ? normalizeQuality(m[1]) : null;
}
export const DEFAULT_QUALITY = 'mid';
/** 무거운 것부터. 자동 판단은 느리면 한 칸씩 내려간다 */
export const QUALITY_ORDER = ['high', 'mid', 'low', 'min'];
export const QUALITY_LABELS = { high: '높음', mid: '적정', low: '낮음', min: '매우 낮음' };
/** 예전 이름 (v14 #lite 링크 = 지금 적정) */
const ALIASES = { lite: 'mid' };
export const normalizeQuality = q => (QUALITY[q] ? q : ALIASES[q] ?? null);
export const lowerQuality = q => QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, QUALITY_ORDER.indexOf(normalizeQuality(q) ?? 'low') + 1)];

/** 초당 장수 상한 문지기: gate(지난 화면 갱신 뒤 흐른 초, 상한) → 이번에 그릴 dt(초, 0.05 까지) 또는 null(건너뜀).
 *  상한이 0 이면 늘 그린다. 건너뛴 시간은 모아 두었다가 다음에 한 번에 (main.js 의 화면 갱신마다 부른다) */
export function createFrameGate() {
  let waited = 0;
  return (elapsed, cap = 0) => {
    waited += elapsed;
    if (cap && waited < 1 / cap - 0.004) return null;
    const dt = Math.min(waited, 0.05);
    waited = 0;
    return dt;
  };
}

/** 화소 배율: 기기 배율·단계 상한·화소 수 상한 중 가장 작은 것 (0.5 아래로는 안 내림). w·h = 화면 CSS 크기 */
export function ratioFor(q, w, h, dpr = 1) {
  const cfg = QUALITY[normalizeQuality(q) ?? DEFAULT_QUALITY];
  const byPixels = Number.isFinite(cfg.maxPixels) && w > 0 && h > 0 ? Math.sqrt(cfg.maxPixels / (w * h)) : Infinity;
  const r = Math.min(dpr, cfg.maxRatio, byPixels);
  return Math.max(0.5, Math.round(r * 100) / 100);
}

/** 주소로 고른 사양: ?quality=low · claude.ai 게시본은 ?… 가 안 넘어오므로 #low · #min · #mid · #high · #quality=low 도 (#lite = 적정). 없으면 null */
export function urlQuality({ search = '', hash = '' } = {}) {
  const q = normalizeQuality(new URLSearchParams(search).get('quality'));
  if (q) return q;
  const h = /^#(?:quality=)?(high|mid|low|min|lite)(?:$|[&?])/.exec(hash);
  return h ? normalizeQuality(h[1]) : null;
}

const WARMUP = 2.5;          // 시작 뒤 셰이더 만들기·첫 그림자 등으로 튀는 시간은 건너뛴다 (초)
const SAMPLE = 3;            // 재는 시간 (초)
const TIMEOUT = 12;          // 쓸 만한 표본이 모자라도 이만큼 지나면 그만 (낮추지 않음)
const MIN_SAMPLES = 60;
const SLOW_FRAME = 22;       // 프레임 간격 가운데 값이 이보다 길면 (≈ 45fps 아래) 느림
const SLOW_GPU = 10;         // … 그리고 GPU 가 프레임마다 이만큼은 일할 때 (확장이 없으면 프레임 간격만 본다)
const GAP_MAX = 50;          // 이보다 긴 간격은 숨겨진 창·멈춤으로 보고 버린다

export function createAutoQuality(ctx, { onSlow }) {
  const gl = ctx.renderer.getContext();
  const ext = gl.getExtension?.('EXT_disjoint_timer_query_webgl2') ?? null;
  const result = { state: 'wait', gpu: null, frame: null, samples: 0, slow: false };
  let t = 0, active = null, lastNow = 0;
  const pending = [], pool = [], gpu = [], frames = [];
  let ready = false;
  if (ctx.events?.once) ctx.events.once('game:ready', () => { ready = true; });
  else ready = true;

  const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  function decide() {
    result.state = 'done';
    result.gpu = gpu.length ? +median(gpu).toFixed(2) : null;
    result.frame = frames.length ? +median(frames).toFixed(2) : null;
    result.samples = frames.length;
    result.slow = frames.length >= MIN_SAMPLES && result.frame > SLOW_FRAME && (result.gpu == null || result.gpu > SLOW_GPU);
    if (ext) for (const q of [...pending, ...pool]) gl.deleteQuery(q);
    pending.length = pool.length = 0;
    console.info(`[render] 자동 품질: 프레임 ${result.frame}ms · GPU ${result.gpu ?? '-'}ms (${result.samples}) → ${result.slow ? '한 칸 낮춤' : '그대로'}`);
    if (result.slow) onSlow?.();
  }

  return {
    result,
    /** 그리기 직전 */
    begin() {
      if (result.state !== 'sample' || !ext || active) return;
      active = pool.pop() ?? gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    },
    /** 그린 직후 (dt = 이번 프레임 시간) */
    end(dt) {
      if (result.state === 'done') return;
      if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; }
      // 끝난 쿼리 읽기 (몇 프레임 늦게 나온다)
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift();
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(ns / 1e6);
        pool.push(q);
      }
      const now = performance.now();
      const gap = now - lastNow;
      lastNow = now;
      if (!ready || document.hidden) return;
      t += dt;
      if (result.state === 'wait') { if (t >= WARMUP) { result.state = 'sample'; t = 0; } return; }
      if (gap > 2 && gap < GAP_MAX) frames.push(gap);
      if ((t >= SAMPLE && frames.length >= MIN_SAMPLES) || t >= TIMEOUT) decide();
    },
  };
}

// ── 광장 기준 (M7-P2, 보드 wave7 D39-A: 목표 광장 33ms 아래, 넘으면 저사양) ──
// 처음 몇 초 판단(위)은 어디서든 프레임 간격 가운데 값을 본다. 이것은 사람이 많이 머무는 광장(축제 광장)에 있을 때만,
// 느린 기기의 긴 프레임(50ms 넘음)도 버리지 않고 평균을 잰다. 한 번 판단하면 그만 (느리면 한 칸 낮춤 — render 가 낮춘 뒤 새로 하나 만들어 매우 낮음까지).

/** 광장 판단 값. 재는 시간은 광장 안에 있던 시간을 모두 더한 것 (드나들어도 이어 잰다) */
export const PLAZA = {
  slowMs: 33,        // 평균 프레임 간격이 이보다 길면 (≈ 30fps 아래) 저사양으로
  sampleSec: 3,      // 광장 안에서 이만큼 재면 판단
  settleSec: 1,      // 광장에 들어온 뒤 (순간이동·컷신 뒤 그림자·가림 다시 계산) 건너뛰는 시간
  minSamples: 20,    // 10fps 기기도 3초면 30개
  gapMax: 250,       // 이보다 긴 간격은 숨겨진 창·멈춤
  radius: 7,         // 축제 광장 자리가 없을 때 광장 가운데에서 이만큼
  pad: 2,            // 축제 광장 반지름 + 이만큼 (둘레 등불까지)
};

/** 정렬된 배열의 q 분위 (0~1, 가까운 순위) */
export function percentile(sorted, q) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

/** 프레임 시간 목록 → { n, avg, p50, p95, max } (ms, 소수 둘째 자리). 비면 n 0 · 나머지 null */
export function frameStats(list) {
  const n = list?.length ?? 0;
  if (!n) return { n: 0, avg: null, p50: null, p95: null, max: null };
  const s = [...list].sort((a, b) => a - b);
  const r = v => +v.toFixed(2);
  return { n, avg: r(s.reduce((a, b) => a + b, 0) / n), p50: r(percentile(s, 0.5)), p95: r(percentile(s, 0.95)), max: r(s[n - 1]) };
}

/** 광장 프레임이 목표보다 느린가: 표본이 충분하고 평균이 slowMs 를 넘으면 */
export function isPlazaSlow(stats, { slowMs = PLAZA.slowMs, minSamples = PLAZA.minSamples } = {}) {
  return !!stats && stats.n >= minSamples && stats.avg > slowMs;
}

/** world.places → 광장 자리 { x, z, r } (축제 광장이 있으면 그 가운데·반지름). 없으면 null */
export function plazaArea(places) {
  const f = places?.festival;
  if (f?.center && Number.isFinite(f.radius)) return { x: f.center.x, z: f.center.z, r: f.radius + PLAZA.pad };
  const p = places?.plaza;
  return p ? { x: p.x, z: p.z, r: PLAZA.radius } : null;
}

export const inArea = (area, pos) => !!area && !!pos && (pos.x - area.x) ** 2 + (pos.z - area.z) ** 2 <= area.r ** 2;

/** 광장에 있을 때만 프레임 간격을 모아 한 번 판단한다. end(dt) 를 그린 직후마다 부른다 */
export function createPlazaWatch(ctx, { onSlow, opts = PLAZA, now: clock = () => performance.now() } = {}) {
  const result = { state: 'wait', frame: null, slow: false };
  const gaps = [];
  let indoor = false, inside = 0, sampled = 0, lastNow = 0;
  ctx.events?.on?.('scene:indoor', ({ on }) => { indoor = !!on; });
  return {
    result,
    end(dt) {
      if (result.state === 'done') return;
      const now = clock(), gap = now - lastNow;
      lastNow = now;
      const pos = ctx.services?.player?.position;
      const area = plazaArea(ctx.services?.world?.places);
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (indoor || hidden || !inArea(area, pos)) { inside = 0; return; }
      inside += dt;
      if (inside < opts.settleSec) return;
      result.state = 'sample';
      if (gap > 2 && gap < opts.gapMax) { gaps.push(gap); sampled += dt; }
      if (sampled < opts.sampleSec) return;
      result.state = 'done';
      result.frame = frameStats(gaps);
      result.slow = isPlazaSlow(result.frame, opts);
      console.info(`[render] 광장 프레임: 평균 ${result.frame.avg}ms · 95% ${result.frame.p95}ms (${result.frame.n}) → ${result.slow ? '한 칸 낮춤' : '그대로'}`);
      if (result.slow) onSlow?.();
    },
  };
}
