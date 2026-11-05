// 8차 계절 행사 틀 M8-P1 (검수 보드 wave8 https://claude.ai/artifact/THtUdkR9e9G9qaf6FDLM5T, 반영 v1 = D74–D85 모두 A). 설계: docs/notes/m8-events.md
// 설정 = assets/events/events.json (결정 갈래·날짜·시간·주인공·할 것·보상). 날짜 계산은 calendar.js (순수 함수).
// 이 틀이 하는 일: 오늘 열린 행사 찾기 (D75 7일 · 섬 축제 날 저녁은 섬 축제 먼저) · 첫 축제 뒤부터 (D83) · 행사 시간엔 비 안 옴 (D80) ·
//   첫 접속 알림 + 오른쪽 아래 칸 (UI-14) · 섬폰 달력 (UI-13) · 도장 (UI-15) · 할 것 진행 기록. 행사마다의 놀이는 M8-P3–P6 이 progress() 로 채운다.
// 상태 ctx.state.events (주인: gameplay/events) = { told: {<id:해>: dayKey}, before: {<id:해>: dayKey}, runs: {<id:해>: { first, days: [dayKey], todo: {<할 것 id>: {n, day}} }}, stamps: {<id>: ['해']} }
// 이벤트 (보냄): events:start { id, year, first, dayKey } (그날 처음 행사 시간에 들어왔을 때) · events:todo { id, todo, n, goal, done } · events:stamp { id, year }
// 서비스 ctx.services.events = { config, today(), active(), live(), isOpen(), progress(id, todo, n), stamp(id), stamps(), calendar(year), debug }
import { activeOn, upcoming, yearCalendar, inHours, isOpen as openRule, runKey } from './calendar.js';
import { createChip, openCalendar, ensureEventsCss } from './eventsui.js';
import { createSpring } from './spring.js';

export const CONFIG_FILE = 'assets/events/events.json';
let E = null;

export function createEventsService(ctx, cfg) {
  const S = () => ctx.services;
  const st = () => {
    const e = (ctx.state.events ||= {});
    e.told ||= {}; e.before ||= {}; e.runs ||= {}; e.stamps ||= {};
    return e;
  };
  const now = () => S().time?.now?.() ?? null;
  const today = () => now()?.dayKey ?? null;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const festivalToday = () => { try { return !!S().festival?.due?.(); } catch { return false; } };
  const open = () => openRule(cfg, ctx.state.festival);

  /** 오늘 기간 안인 행사 (시간과 상관없이) */
  const active = (key = today()) => (key ? activeOn(cfg, key) : []);
  /** 지금 행사 시간인 행사 (섬 축제 날 저녁 빼고) */
  const live = () => {
    const n = now();
    if (!n) return [];
    const fest = festivalToday();
    return active(n.dayKey).filter(r => inHours(r.ev, n.hourF, { festivalToday: fest }));
  };
  const run = r => {
    const k = runKey(r.ev.id, r.year), e = st();
    return (e.runs[k] ||= { first: today(), days: [], todo: {} });
  };

  /** 할 것 진행 — 놀이 트랙(M8-P3–P6)이 부른다. daily 칸은 날마다 새로 센다. n = 더할 수 (기본 1) → 지금 값 */
  function progress(id, todoId, n = 1) {
    const r = active().find(x => x.ev.id === id);
    if (!r || !open()) return null;
    const t = r.ev.todo?.find(x => x.id === todoId);
    if (!t) return null;
    const rec = run(r), key = today();
    const cur = rec.todo[todoId] && (!t.daily || rec.todo[todoId].day === key) ? rec.todo[todoId] : { n: 0, day: key };
    cur.n = Math.min(t.goal, cur.n + n); cur.day = key;
    rec.todo[todoId] = cur;
    const done = cur.n >= t.goal;
    ctx.events.emit('events:todo', { id, todo: todoId, n: cur.n, goal: t.goal, done });
    chip.show(r);
    return { ...cur, goal: t.goal, done };
  }
  function todo(r) {
    const rec = run(r), key = today();
    return (r.ev.todo ?? []).map(t => {
      const c = rec.todo[t.id];
      const n = c && (!t.daily || c.day === key) ? c.n : 0;
      return { id: t.id, label: t.label, n, goal: t.goal, done: n >= t.goal, daily: !!t.daily };
    });
  }
  /** 도장 (D81-A: 해마다 행사마다 하나) — 행사 보상을 줄 때 놀이 트랙이 부른다 */
  function stamp(id) {
    const r = active().find(x => x.ev.id === id);
    if (!r) return false;
    const list = (st().stamps[id] ||= []), y = String(r.year);
    if (list.includes(y)) return false;
    list.push(y);
    ctx.events.emit('events:stamp', { id, year: r.year });
    return true;
  }

  // ---- 알림 (UI-14) ----
  const chip = createChip(ctx.uiRoot, { onOpen: () => openCal() });
  function check() {
    const key = today();
    if (!key) return;
    const e = st(), runs = active(key);
    chip.show(open() ? runs[0] ?? null : null);
    for (const r of runs) {
      const k = runKey(r.ev.id, r.year);
      if (!open()) {   // D83-A: 첫 축제 전엔 밤톨 한 줄만 (행사마다 한 해 한 번)
        if (!e.before[k]) { e.before[k] = key; toast(`${r.ev.emoji} ${r.ev.name} 주간이에요. ${cfg.open?.beforeLine ?? ''}`, '🐿'); }
        continue;
      }
      if (!live().some(x => x.ev.id === r.ev.id)) continue;
      if (e.told[k] === key) continue;
      const first = !e.told[k];
      e.told[k] = key;
      const rec = run(r);
      if (!rec.days.includes(key)) rec.days.push(key);
      toast(first ? `${r.ev.emoji} ${r.ev.name} 주간이 시작됐어요! (${r.left}일 남음) 섬폰 📅 달력에서 오늘 할 것을 볼 수 있어요` : `${r.ev.emoji} ${r.ev.name} ${r.day}일째예요`, r.ev.emoji);
      ctx.events.emit('events:start', { id: r.ev.id, year: r.year, first, dayKey: key });
    }
    weather();
  }
  // D80-A: 행사 시간엔 비 안 옴 (흐림으로). 날씨 강제는 다음 날 풀린다 (sky setWeather)
  function weather() {
    const T = S().time;
    if ((cfg.weather?.mode ?? 'noRain') !== 'noRain' || !T || !open()) return;
    if (T.weatherOverride) return;   // 개발 패널·다른 모듈이 고른 날씨는 그대로
    if (live().length && T.weather === 'rain') T.setWeather('cloudy');
  }

  // ---- 섬폰 달력 (UI-13 · UI-15) ----
  const festDay = () => { const f = ctx.state.festival; return f?.festivals?.[0] ?? f?.heldDay ?? null; };
  const openCal = () => openCalendar(ctx, {
    today: () => today() ?? '2000-01-01', active: () => active(), upcoming: () => upcoming(cfg, today() ?? '2000-01-01'),
    festival: () => ({ day: festDay() }), open, beforeLine: cfg.open?.beforeLine ?? '', todo, stamps: () => st().stamps, list: cfg.list ?? [],
  });

  return {
    check, openCal, chip,
    service: {
      config: cfg, today, active, live, isOpen: open, progress, todo: id => { const r = active().find(x => x.ev.id === id); return r ? todo(r) : []; },
      stamp, stamps: () => st().stamps, calendar: year => yearCalendar(cfg, year),
      debug: { check, openCalendar: () => openCal() },
    },
  };
}

export default {
  name: 'events',

  async init(ctx) {
    ensureEventsCss();
    const cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(CONFIG_FILE) : fetch(CONFIG_FILE).then(r => r.json()));
    E = createEventsService(ctx, cfg);
    ctx.services.events = E.service;
    const ui = ctx.services.ui;
    if (ui?.panel && !ui.calendar) ui.calendar = { open: () => E.openCal() };   // 섬폰 APPS 의 'calendar' 줄
    for (const name of ['time:tick', 'time:newday', 'data:loaded', 'festival:end']) ctx.events.on(name, () => E.check());
    ctx.events.on('story:start', () => E.chip.hide(true));
    ctx.events.on('story:end', () => E.chip.hide(false));
    // 행사 놀이 (M8-P3–P6): 행사마다 파일 하나 — 행동 키를 디스패처에 단다
    const gp = ctx.services.gameplay?.interactions;
    E.plays = { spring: createSpring(ctx, E.service) };
    if (gp) for (const p of Object.values(E.plays)) p.register(gp);
    E.service.debug.plays = E.plays;
    E.check();
  },

  update() {},
};
