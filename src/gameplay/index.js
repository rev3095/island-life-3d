// 2차 게임 규칙 모듈 모음. 트랙마다 자기 하위 폴더만 만든다 (docs/PLAN.md 2차 표):
//   gather/ = P2 채집, town/ = P3 주민·상점·박물관, house/ = P4 집·가구·제작
// 각 하위 폴더의 index.js 는 { name, init(ctx), update(dt, ctx) } 를 export default 한다. 없는 폴더는 건너뛴다.
const PARTS = [
  ['gather', './gather/index.js'],
  ['town', './town/index.js'],
  ['house', './house/index.js'],
];

const loaded = [];

export default {
  name: 'gameplay',
  async init(ctx) {
    // 행동 키(action / pickup)를 한 곳에서 나눠 준다: 우선순위가 높은 처리기부터 test() 해서 처음 맞는 것만 run().
    // 권장 우선순위: 주민 말 걸기 100, 문·건물 90, 실내 가구 80, 줍기 50, 도구 쓰기 10
    const handlers = [];
    ctx.services.gameplay = {
      interactions: {
        /** h = { name, intent: 'action'|'pickup'|undefined(둘 다), priority, test(ctx) → 대상|null, run(대상, ctx) } → 해제 함수 */
        add(h) {
          handlers.push(h);
          handlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
          return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); };
        },
        list: () => handlers.map(h => ({ name: h.name, intent: h.intent, priority: h.priority ?? 0 })),
      },
    };
    ctx.events.on('input:press', ({ intent }) => {
      if (intent !== 'action' && intent !== 'pickup') return;
      if (ctx.services.ui?.isBlocking?.() || ctx.input.enabled === false) return;
      for (const h of handlers) {
        if (h.intent && h.intent !== intent) continue;
        let target = null;
        try { target = h.test(ctx); } catch (e) { console.error(`[gameplay] ${h.name} test`, e); }
        if (target == null || target === false) continue;
        try { h.run(target, ctx); } catch (e) { console.error(`[gameplay] ${h.name} run`, e); }
        return;
      }
    });
    for (const [name, path] of PARTS) {
      let mod;
      try { mod = (await import(path)).default; }
      catch { if (ctx.debug) console.info(`[gameplay] ${name} 없음 — 건너뜀`); continue; }
      try { await mod.init?.(ctx); loaded.push([name, mod]); console.info(`[gameplay] ${name} 준비됨`); }
      catch (e) { console.error(`[gameplay] ${name} 초기화 실패`, e); }
    }
  },
  update(dt, ctx) {
    for (const [name, mod] of loaded) {
      try { mod.update?.(dt, ctx); } catch (e) { console.error(`[gameplay] ${name}`, e); }
    }
  },
};
