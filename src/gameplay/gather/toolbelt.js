// 도구 들기: 가방에 있는 도구만 손에 든다. 숫자키 1~6 · Q/E · 0 을 player 대신 받는다 (player.toolKeys = false).
// 쓸 때마다 data.inventory.useTool 로 내구도를 깎고, 부서지면 알림을 띄우고 맨손이 된다.
import { iga } from './util.js';

export const STARTER_FLAG = 'gatherStarterTools';

export function createToolbelt(ctx, kit, { isBusy }) {
  const { events, state, constants } = ctx;
  const TOOLS = constants.TOOLS;                 // ['rod', 'net', 'shovel', 'axe', 'can']
  const inv = () => kit.data?.inventory;
  const has = tool => !!inv()?.hasTool?.(tool);
  const toolItem = tool => kit.data?.items?.list?.('tool')?.find(t => t.tool === tool) ?? null;
  const toolName = tool => toolItem(tool)?.name ?? tool;
  const player = () => kit.player;

  function set(tool) {
    const p = player();
    if (!p) return;
    p.setTool(tool && has(tool) ? tool : null);
  }

  // 처음 시작: 낚싯대·잠자리채 (새 게임이면 data 가 이미 넣어 준다 → 없을 때만)
  function giveStarter() {
    if (state.flags[STARTER_FLAG]) return;
    const i = inv();
    if (!i) return;
    for (const tool of ['rod', 'net']) {
      const it = toolItem(tool);
      if (it && !i.hasTool(tool)) i.add(it.id, 1);
    }
    state.flags[STARTER_FLAG] = true;
  }

  function onPress({ intent }) {
    const p = player();
    if (!p || p.toolKeys) return;
    if (ctx.services.ui?.isBlocking?.() || ctx.input.enabled === false || p.frozen || isBusy()) return;
    const n = /^tool([1-6])$/.exec(intent);
    if (n) {
      const tool = TOOLS[n[1] - 1];
      if (p.tool === tool) return set(null);
      if (!has(tool)) { kit.toast(`${iga(toolName(tool))} 가방에 없어요`, toolItem(tool)?.icon); return; }
      return set(tool);
    }
    if (intent === 'toolNone') return set(null);
    if (intent === 'toolNext' || intent === 'toolPrev') {
      const list = [null, ...TOOLS.filter(has)];
      const i = Math.max(0, list.indexOf(p.tool));
      set(list[(i + (intent === 'toolNext' ? 1 : list.length - 1)) % list.length]);
    }
  }

  return {
    init() {
      const p = player();
      if (p) p.toolKeys = false;
      giveStarter();
      if (p?.tool && !has(p.tool)) set(null);       // 저장된 도구가 가방에 없으면 맨손
      events.on('input:press', onPress);
      // 팔았거나 옮겨서 가방에서 빠지면 내려놓는다
      events.on('inventory:changed', () => { const q = player(); if (q?.tool && !has(q.tool)) q.setTool(null); });
      events.on('data:loaded', () => { giveStarter(); const q = player(); if (q?.tool && !has(q.tool)) q.setTool(null); });
    },
    has, toolName, toolItem,
    /** 도구 한 번 쓰기 → 부서졌으면 true (알림을 띄우고 맨손으로) */
    use(tool) {
      const r = inv()?.useTool?.(tool);
      if (!r?.ok || !r.broken) return false;
      kit.toast(`${iga(toolName(tool))} 부서졌다!`, toolItem(tool)?.icon);
      player()?.setTool(null);
      return true;
    },
  };
}
