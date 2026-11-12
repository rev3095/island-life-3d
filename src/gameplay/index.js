// 2차 게임 규칙 모듈 모음. 트랙마다 자기 하위 폴더만 만든다 (docs/PLAN.md 2차 표):
//   gather/ = P2 채집, town/ = P3 주민·상점·박물관, house/ = P4 집·가구·제작
// 각 하위 폴더의 index.js 는 { name, init(ctx), update(dt, ctx) } 를 export default 한다. 없는 폴더는 건너뛴다.
const PARTS = [
  ['gather', './gather/index.js'],
  ['town', './town/index.js'],
  ['house', './house/index.js'],
  ['intro', './intro/index.js'],   // 3차 X3 첫날 흐름 (이름 정하기·첫날 할 일)
  ['story', './story/index.js'],   // 5차 스토리 장면 재생기 (assets/story/)
  ['festival', './festival/index.js'],   // 5차 Z5 축제·이모티콘 대화·엔딩
  ['events', './events/index.js'],       // 8차 M8 계절 행사 (assets/events/, 보드 wave8)
  ['decor', './decor/index.js'],         // 9차 M9 섬 꾸미기 (assets/decor/, 보드 wave9 D86-A)
  ['telescope', './decor/telescope.js'], // 10차 M10-P5 섬에 놓은 별 망원경 — 밤에 하늘 올려다보기 (FU-53)
  ['night', './night/index.js'],         // M12 밤·새벽: 야시장 · 달빛 가게 · 새벽 천막 타로 · 야행성 주민 (assets/night/, 보드 night)
  ['tour', './tour/index.js'],           // P35 무인도 투어 (assets/tour/, 보드 tour D120–D128)
  ['journal', './journal/index.js'],     // M13-P1 섬 일지: 하루 할 일 · 오래 하는 목표 · 포인트 교환 (assets/journal/, 13차 보드 D141-A)
  ['daily', './daily/index.js'],         // M13-P2–P5 매일 할 거리: 유성우·소원 · 선물 풍선·새총 · 유리병·레시피 · 방문 행상 (assets/daily/, D142–D147 A)
];

/** 맞는 처리기가 없을 때 버튼 글자 */
export const INTENT_LABEL = { action: '행동', pickup: '줍기' };
/** 맨손이 아닐 때 행동 키 = 든 도구 쓰기 */
export const TOOL_LABEL = { rod: '낚시', net: '채집', shovel: '파기', axe: '찍기', can: '물 주기', sling: '쏘기' };
/**
 * 처리기 이름 → 버튼 글자 (문자열 또는 (대상, ctx) → 문자열). 처리기가 스스로 label 을 주면 그것이 먼저다.
 * '' = 누르면 아무 일도 없다 (화면은 기본 글자)
 */
export const LABELS = {
  'gather-busy': (t, ctx) => (ctx.services.gather?.fishing?.active ? '당기기' : ''),
  'gather-shake': '흔들기',
  'gather-pickup': t => ({ weed: '뽑기', flower: '꺾기' })[t?.type] ?? '줍기',
  'gather-plant': '심기',
  'gather-tool': t => TOOL_LABEL[t] ?? '',
  'town:talk': '말 걸기',
  'town:intro': '말 걸기',
  'town:firstday': '말 걸기',
  'town:knock': '노크',
  'town:mail': '우편함',
  'town:shop': '가게',
  'town:museum': '박물관',
  'house-move-drop': '내려놓기',
  'house-move-cancel': '취소',
  'house-door-in': '들어가기',
  'house-door-out': '나가기',
  'house-door-busy': '',
  'house-place-out': '나가기',
  'house-place-idle': '',
  'house-furniture': t => (t?.kind === 'workbench' ? '만들기' : '살피기'),
  'house-furniture-store': '넣기',
  'house-place': '가구 놓기',
  'decor:rotate': '돌리기',
};
/** test() 에 부작용이 있어 peek 가 부르지 않는 처리기 (docs/notes/ux.md 표). 처리기에 pure: false 를 달아도 같다 */
export const IMPURE = new Set();

/** 처리기 h 가 target 을 골랐을 때 버튼 글자 */
export function labelOf(h, target, intent, ctx) {
  for (const l of [h.label, LABELS[h.name]]) {
    if (l == null) continue;
    try { return (typeof l === 'function' ? l(target, ctx) : l) ?? ''; } catch { return ''; }
  }
  return INTENT_LABEL[intent] ?? '';
}

/** 행동 키 나눠 주기: 우선순위가 높은 처리기부터 test() 해서 처음 맞는 것만 run() */
export function createInteractions(ctx) {
  const handlers = [];
  const blocked = () => !!ctx.services.ui?.isBlocking?.() || ctx.input?.enabled === false;
  const matches = (h, intent) => !h.intent || h.intent === intent;
  function test(h) {
    try { return h.test(ctx) ?? null; } catch (e) { console.error(`[gameplay] ${h.name} test`, e); return null; }
  }
  const api = {
    /** h = { name, intent: 'action'|'pickup'|undefined(둘 다), priority, test(ctx) → 대상|null, run(대상, ctx), label?, pure? } → 해제 함수 */
    add(h) {
      handlers.push(h);
      handlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); };
    },
    list: () => handlers.map(h => ({ name: h.name, intent: h.intent, priority: h.priority ?? 0 })),
    /**
     * 지금 intent 키를 누르면 처리할 처리기 → { name, label } | null (창이 열렸거나 아무것도 안 맞음).
     * run 은 하지 않는다. test 에 부작용이 있는 처리기(IMPURE·pure: false)는 건너뛴다.
     */
    peek(intent) {
      if (blocked()) return null;
      for (const h of handlers) {
        if (!matches(h, intent) || h.pure === false || IMPURE.has(h.name)) continue;
        const target = test(h);
        if (target == null || target === false) continue;
        return { name: h.name, label: labelOf(h, target, intent, ctx) };
      }
      return null;
    },
  };
  function dispatch(intent) {
    if (intent !== 'action' && intent !== 'pickup') return false;
    if (blocked()) return false;
    for (const h of handlers) {
      if (!matches(h, intent)) continue;
      const target = test(h);
      if (target == null || target === false) continue;
      try { h.run(target, ctx); } catch (e) { console.error(`[gameplay] ${h.name} run`, e); }
      return true;
    }
    return false;
  }
  return { api, dispatch };
}

const loaded = [];

export default {
  name: 'gameplay',
  async init(ctx) {
    // 행동 키(action / pickup)를 한 곳에서 나눠 준다: 우선순위가 높은 처리기부터 test() 해서 처음 맞는 것만 run().
    // 권장 우선순위: 주민 말 걸기 100, 문·건물 90, 실내 가구 80, 줍기 50, 도구 쓰기 10
    const { api, dispatch } = createInteractions(ctx);
    ctx.services.gameplay = { interactions: api };
    ctx.events.on('input:press', ({ intent }) => { dispatch(intent); });
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
