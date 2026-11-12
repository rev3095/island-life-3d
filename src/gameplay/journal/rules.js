// M13-P1 섬 일지 규칙 (순수 — tests/journal.test.mjs 가 Node 에서 돌린다). 설정 assets/journal/journal.json.
// 저장 state.journal = { day, tasks:[{id,n,done}], points, earned, counts:{on:n}, goals:{goalId:단계 수}, allDay, bought:{id:n} }

/** 글자 → 32비트 씨앗 */
export function hashOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** 그날 할 일 n 개 — 날짜 + 섬 씨앗으로 늘 같게, 같은 on(셀 일) 은 하나만 */
export function pickTasks(cfg, dayKey, seed = 0) {
  let x = hashOf(`${dayKey}|${seed}`) || 1;
  const rnd = () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296;
  const pool = [...(cfg.tasks ?? [])];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [], seen = new Set();
  for (const t of pool) { if (out.length >= (cfg.daily ?? 5)) break; if (seen.has(t.on)) continue; seen.add(t.on); out.push(t); }
  return out;
}

/** 저장 칸을 채우고, 날이 바뀌었으면 그날 할 일로 새로 */
export function ensure(state, cfg, dayKey, seed = 0) {
  const j = (state.journal ||= {});
  j.points ??= 0; j.earned ??= 0; j.counts ||= {}; j.goals ||= {}; j.bought ||= {};
  if (j.day !== dayKey) {
    j.day = dayKey;
    j.tasks = pickTasks(cfg, dayKey, seed).map(t => ({ id: t.id, n: 0, done: false }));
    j.talked = [];
  }
  return j;
}

const taskOf = (cfg, id) => (cfg.tasks ?? []).find(t => t.id === id);

/**
 * 한 번 셈: on 을 amount 만큼. 돌려줌 { gained, done:[할 일], allDone, goals:[{goal, step}] }
 * 오래 하는 목표는 counts[on] 이 steps 를 넘을 때마다 한 단계씩 (포인트 바로 더함)
 */
export function bump(j, cfg, on, amount = 1) {
  const res = { gained: 0, done: [], allDone: false, goals: [] };
  if (!(amount > 0)) return res;
  for (const row of j.tasks ?? []) {
    const t = taskOf(cfg, row.id);
    if (!t || row.done || t.on !== on) continue;
    row.n = Math.min(t.need, row.n + amount);
    if (row.n >= t.need) { row.done = true; res.gained += t.pts; res.done.push(t); }
  }
  if (res.done.length && j.tasks.length && j.tasks.every(r => r.done) && j.allDay !== j.day) {
    j.allDay = j.day; res.allDone = true; res.gained += cfg.allDoneBonus ?? 0;
    goalBump(j, cfg, 'allDone', 1, res);
  }
  goalBump(j, cfg, on, amount, res);
  j.points += res.gained; j.earned += res.gained;
  return res;
}

function goalBump(j, cfg, on, amount, res) {
  j.counts[on] = (j.counts[on] ?? 0) + amount;
  for (const g of cfg.goals ?? []) {
    if (g.on !== on) continue;
    let s = j.goals[g.id] ?? 0;
    while (s < g.steps.length && j.counts[on] >= g.steps[s]) { res.gained += g.pts[s] ?? 0; res.goals.push({ goal: g, step: s + 1 }); s++; }
    j.goals[g.id] = s;
  }
}

/** 화면용 — 오늘 할 일 · 목표 다음 단계 · 교환 칸 */
export function view(j, cfg) {
  const tasks = (j.tasks ?? []).map(r => ({ ...taskOf(cfg, r.id), n: r.n, done: r.done })).filter(t => t.id);
  const goals = (cfg.goals ?? []).map(g => {
    const s = j.goals?.[g.id] ?? 0, n = j.counts?.[g.on] ?? 0;
    return { ...g, step: s, n, next: g.steps[s] ?? null, nextPts: g.pts[s] ?? 0, max: s >= g.steps.length };
  });
  const shop = (cfg.shop ?? []).map(e => ({ ...e, can: (j.points ?? 0) >= e.cost }));
  return { points: j.points ?? 0, earned: j.earned ?? 0, tasks, goals, shop, n: tasks.filter(t => t.done).length, total: tasks.length, allDone: j.allDay === j.day };
}

/** 교환: 포인트가 모자라면 false, 되면 포인트를 빼고 true (물건 주기는 부르는 쪽) */
export function spend(j, entry) {
  if (!entry || (j.points ?? 0) < entry.cost) return false;
  j.points -= entry.cost;
  j.bought[entry.id] = (j.bought[entry.id] ?? 0) + 1;
  return true;
}
