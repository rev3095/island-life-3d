// 품질 단계와 자동 판단.
// main.js 가 처음 품질을 정한다 (?quality=low · 터치 기기 → low). 데스크톱에서 high 로 시작했는데 처음 몇 초가 느리면 low 로 한 번 낮춘다.
// 재는 것: 화면이 보이는 동안의 실제 프레임 간격(rAF). 숨겨진 창·디버거 멈춤처럼 너무 긴 간격(50ms 넘음)은 버린다.
// GPU 시간(EXT_disjoint_timer_query_webgl2)이 있으면 같이 본다 — 프레임이 느려도 GPU 가 한가하면(다른 이유로 느림) 낮추지 않는다.
// (GPU 시간만 보면 안 된다: 60fps 에 맞춰 쉬는 GPU 는 클럭을 내려 같은 일을 더 오래 한다)

/** 품질 단계 값 (main.js 의 처음 값과 같게) */
export const QUALITY = {
  high: { maxRatio: 2, shadowSize: 2048 },
  low: { maxRatio: 1.5, shadowSize: 1024 },
};

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
    console.info(`[render] 자동 품질: 프레임 ${result.frame}ms · GPU ${result.gpu ?? '-'}ms (${result.samples}) → ${result.slow ? 'low' : '그대로'}`);
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
