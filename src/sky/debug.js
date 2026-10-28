// ?debug 로 켜는 하늘 조절 판: 시각 끌기, 멈춤, 시계 모드, 날씨·계절 바꾸기, 프레임 시간.
import { WEATHERS, WEATHER_NAMES } from './weather.js';
import { dayHour } from './clock.js';

const SEASON_NAMES = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const PART_NAMES = { dawn: '새벽', day: '낮', dusk: '노을', night: '밤' };

const CSS = `
.sky-debug { position: absolute; right: calc(10px + env(safe-area-inset-right, 0px)); bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  width: min(300px, calc(100vw - 20px)); box-sizing: border-box; background: rgba(255, 248, 230, .94); color: #4A3B32; border-radius: 14px;
  box-shadow: 0 3px 0 #E2D2AE, 0 6px 18px rgba(0,0,0,.12); font: 13px/1.4 "Gowun Dodum", "Malgun Gothic", sans-serif; padding: 10px 12px; z-index: 50; }
.sky-debug h4 { margin: 0; font: 15px "Jua", "Malgun Gothic", sans-serif; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
.sky-debug.closed .sd-body { display: none; }
.sky-debug .sd-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 7px; }
.sky-debug .sd-label { width: 34px; flex: none; color: #7A6656; }
.sky-debug input[type=range] { flex: 1; min-width: 0; accent-color: #E8913A; }
.sky-debug button { border: 0; border-radius: 999px; padding: 3px 9px; background: #F1E4C6; color: #4A3B32; font: inherit; cursor: pointer; }
.sky-debug button.on { background: #E8913A; color: #fff; }
.sky-debug .sd-clock { font: 18px "Jua", "Malgun Gothic", sans-serif; min-width: 52px; text-align: right; }
.sky-debug .sd-info { margin-top: 7px; color: #7A6656; font-size: 12px; }
`;

const fmt = hh => { const h = Math.floor(hh) % 24, m = Math.floor((hh % 1) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

export function createDebugPanel(root, time) {
  if (!document.getElementById('sky-debug-css')) {
    const st = document.createElement('style');
    st.id = 'sky-debug-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  const el = document.createElement('div');
  el.className = 'sky-debug';
  el.innerHTML = `
    <h4><span>하늘 조절</span><span class="sd-toggle">▾</span></h4>
    <div class="sd-body">
      <div class="sd-row"><span class="sd-label">시각</span><input type="range" min="5" max="28.99" step="0.0167" data-k="hour" aria-label="시각"><span class="sd-clock">--:--</span></div>
      <div class="sd-row"><span class="sd-label">시계</span>
        <button data-mode="real">실제 시계</button><button data-mode="fast">빠르게 (1분=1시간)</button><button data-k="pause">멈춤</button></div>
      <div class="sd-row"><span class="sd-label">날씨</span><button data-weather="auto">자동</button>${WEATHERS.map(w => `<button data-weather="${w}">${WEATHER_NAMES[w]}</button>`).join('')}</div>
      <div class="sd-row"><span class="sd-label">계절</span><button data-season="auto">자동</button>${Object.entries(SEASON_NAMES).map(([k, n]) => `<button data-season="${k}">${n}</button>`).join('')}</div>
      <div class="sd-info"></div>
    </div>`;
  root.append(el);
  const $ = s => el.querySelector(s);
  const slider = $('[data-k=hour]'), clock = $('.sd-clock'), info = $('.sd-info');
  let dragging = false;

  $('h4').addEventListener('click', () => { el.classList.toggle('closed'); $('.sd-toggle').textContent = el.classList.contains('closed') ? '▸' : '▾'; });
  slider.addEventListener('pointerdown', () => { dragging = true; });
  addEventListener('pointerup', () => { dragging = false; });
  slider.addEventListener('input', () => time.setHour(Number(slider.value)));
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) time.setMode(b.dataset.mode);
    if (b.dataset.k === 'pause') time.setPaused(!time.paused);
    if (b.dataset.weather) time.setWeather(b.dataset.weather === 'auto' ? null : b.dataset.weather);
    if (b.dataset.season) time.setSeasonOverride(b.dataset.season === 'auto' ? null : b.dataset.season);
  });
  // 패널 안 키 입력이 게임 조작으로 새지 않게
  el.addEventListener('keydown', e => e.stopPropagation());

  let frameMs = 16.7, last = performance.now(), shown = 0;
  return {
    el,
    update() {
      const t = performance.now();
      frameMs += (t - last - frameMs) * 0.05;
      last = t;
      if (t - shown < 120) return;          // 글자는 1초에 8번만 고친다
      shown = t;
      const now = time.now();
      const hh = dayHour(now.hourF);
      if (!dragging) slider.value = String(hh);
      clock.textContent = fmt(hh);
      el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === time.mode));
      $('[data-k=pause]').classList.toggle('on', time.paused);
      const ov = time.weatherOverride;
      el.querySelectorAll('[data-weather]').forEach(b => b.classList.toggle('on', ov ? b.dataset.weather === ov : b.dataset.weather === 'auto'));
      const so = time.seasonOverride;
      el.querySelectorAll('[data-season]').forEach(b => b.classList.toggle('on', so ? b.dataset.season === so : b.dataset.season === 'auto'));
      info.textContent = `${now.dayKey} (${now.weekdayName}) · ${SEASON_NAMES[now.season]} · ${PART_NAMES[now.part]} · ${WEATHER_NAMES[time.weather]}`
        + ` · 밤 ${time.nightFactor.toFixed(2)} · ${frameMs.toFixed(1)}ms`;
    },
  };
}
