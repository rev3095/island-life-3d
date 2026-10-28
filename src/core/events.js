// 모듈끼리 직접 부르지 않고 이벤트로 주고받는다. 이벤트 이름과 내용은 docs/CONTRACTS.md 에 정리돼 있다.
export function createEvents() {
  const map = new Map();
  const api = {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => api.off(name, fn);
    },
    off(name, fn) { map.get(name)?.delete(fn); },
    once(name, fn) {
      const off = api.on(name, (...a) => { off(); fn(...a); });
      return off;
    },
    emit(name, payload) {
      for (const fn of [...(map.get(name) ?? [])]) {
        try { fn(payload); } catch (e) { console.error(`[events] ${name} 처리 중 오류`, e); }
      }
    },
  };
  return api;
}
