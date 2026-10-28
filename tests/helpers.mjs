// 테스트 도우미: 가짜 localStorage, 가짜 ctx
import { createEvents } from '../src/core/events.js';
import { createState } from '../src/core/state.js';

export function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

/** 쓰기만 하면 예외를 내는 저장소 (용량 초과·사생활 보호 창 흉내) */
export function brokenStorage() {
  return {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  };
}

/** 이벤트를 받아 적어 두는 ctx */
export function fakeCtx({ time } = {}) {
  const events = createEvents();
  const log = [];
  const emit = events.emit;
  events.emit = (name, payload) => { log.push([name, payload]); emit(name, payload); };
  return { events, log, state: createState(), services: time ? { time } : {} };
}

/** 고정 시각을 돌려주는 time 서비스 흉내 */
export const fakeTime = now => ({ now: () => ({ ...now }) });
