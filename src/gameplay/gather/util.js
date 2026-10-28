// 채집 공용 도우미: 조사 붙이기, 알림·효과음, 지금 시각·날씨, 각도.

/** 마지막 글자에 받침이 있나 (한글이 아니면 false) */
export function hasBatchim(word) {
  const c = String(word ?? '').trim().slice(-1).charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
}
/** '사과를' · '붕어를' · '잉어를' / '호박을' */
export const eul = w => `${w}${hasBatchim(w) ? '을' : '를'}`;
/** '삽이' · '도끼가' */
export const iga = w => `${w}${hasBatchim(w) ? '이' : '가'}`;

export const TAU = Math.PI * 2;
export const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pickOne = list => list[Math.floor(Math.random() * list.length)];

/** ctx 를 감싼 작은 도구 모음 */
export function createKit(ctx) {
  const { events } = ctx;
  const data = () => ctx.services.data;
  const kit = {
    get data() { return data(); },
    get world() { return ctx.services.world; },
    get player() { return ctx.services.player; },
    sfx(name, opts = {}) { events.emit('sfx', { name, ...opts }); },
    toast(text, icon) { events.emit('toast', { text, icon }); },
    item(id) { return data()?.items?.get?.(id) ?? null; },
    name(id) { return kit.item(id)?.name ?? id; },
    icon(id) { return kit.item(id)?.icon; },
    /** { hour(소수), month, weather } — time 서비스가 없으면 브라우저 시계 */
    now() {
      const t = ctx.services.time;
      const n = t?.now?.();
      if (n) return { hour: n.hourF ?? n.hour + (n.minute ?? 0) / 60, month: n.month, weather: t.weather ?? 'clear', night: t.nightFactor ?? 0 };
      const d = new Date();
      const h = d.getHours() + d.getMinutes() / 60;
      return { hour: h, month: d.getMonth() + 1, weather: 'clear', night: h >= 19 || h < 5 ? 1 : 0 };
    },
    /** UI 창이 열려 있으면 (이때는 낚시·곤충 시간도 멈춘다) */
    paused() { return !!ctx.services.ui?.isBlocking?.() || ctx.input.enabled === false; },
    /** 외곽선 설정 */
    outlineOn() { return ctx.state.settings?.outline !== false; },
  };
  return kit;
}
