// 데모(시연) 모드: 주소 ?demo (또는 #demo). 포트폴리오 페이지 등에 iframe 으로 실을 때 쓴다.
// - 저장하지 않는다: 저장소를 메모리로 바꿔 열 때마다 처음부터 (기기·브라우저에 남지 않음, 기존 저장도 읽지 않음)
// - 튜토리얼이 끝난 시점: 이름 정하기·밤톨 첫 안내·첫날 할 일 목록을 마친 것으로 (applyDemoState)
// - 낮 고정: sky 가 DEMO_HOUR 시로 옮기고 시계를 멈춘다 · 시작 화면은 web-loader 가 바로 걷는다
import { dayKeyOf } from '../sky/clock.js';
import { TIPS } from '../gameplay/intro/tips.js';

// 시각(낮 10시)은 sky/index.js NEW_GAME_HOUR · DEMO_HOUR (스타일 편집기가 sky 를 따로 읽어서 여기를 부르지 않는다)

/** 주소가 데모 모드인가 */
export function isDemo(loc = globalThis.location) {
  try {
    if (new URLSearchParams(loc?.search ?? '').has('demo')) return true;
    return /(?:^#|[#&])demo(?:[=&]|$)/.test(loc?.hash ?? '');
  } catch { return false; }
}

/** localStorage 모양의 메모리 저장소 (창을 닫으면 사라짐) */
export function memoryStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
  };
}

/** 새 상태를 「튜토리얼을 막 마친 첫날」로 */
export function applyDemoState(state, { now = Date.now(), name = '하늘', island = '포근' } = {}) {
  const day = dayKeyOf(now);
  state.player ??= {};
  state.island ??= {};
  if (!state.player.name) state.player.name = name;
  if (!state.island.name) state.island.name = island;
  const f = (state.flags ??= {});
  f.intro = true;                                   // 밤톨 첫 안내를 들었다 (town/keepers.js)
  f.firstday = {
    v: 1, skip: 'short', skipped: day, finished: day, rewarded: true, hidden: true, legacy: false, collapsed: null,
    done: { intro: day },
  };
  const off = Object.fromEntries(Object.keys(TIPS).map(id => [id, true]));
  f.tips = { v: 1, miss: {}, seen: {}, off, last: {} };   // 막힌 곳 힌트 카드도 끔
  return state;
}
