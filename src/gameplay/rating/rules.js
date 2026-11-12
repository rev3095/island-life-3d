// M14 섬 별점 규칙 (DOM·three 없음 → tests/rating.test.mjs). 설정 assets/rating/rating.json (결정 D152-A).
// counts = { flowers, trees, furn, fences, paths, builds, home, residents, art, weeds } (art = 집 안에 놓은 미술품, M17-P2 D184-A) → 점수·별·칸별 점수·주민 한마디 갈래.
// 상태 state.rating = { best (지금까지 가장 높은 별), rewarded: [별], five (별 다섯 처음 날 dayKey), last: { day, stars, score } }

/** 물체 목록 (world.objects.list() 모양) → 세는 칸. extra = { home, residents, art } */
export function countIsland(objs, extra = {}) {
  const c = { flowers: 0, trees: 0, furn: 0, fences: 0, paths: 0, builds: 0, weeds: 0, home: extra.home ?? 0, residents: extra.residents ?? 0, art: extra.art ?? 0 };
  for (const o of objs) {
    const k = o.kind, d = o.data?.decor;
    if (d === 'furn') c.furn++;
    else if (d === 'fence') c.fences++;
    else if (d === 'path') c.paths++;
    else if (d === 'build') c.builds++;
    else if (k === 'tulip' || k === 'cosmos' || k === 'pansy' || k.startsWith('flower')) c.flowers++;
    else if (k === 'tree' || k === 'fruit-tree' || k === 'cedar' || k === 'palm' || k === 'cherry-tree' || k === 'sapling') c.trees++;
    else if (k === 'bush') c.trees += 0.5;
    else if (k === 'weed') c.weeds++;
  }
  c.trees = Math.round(c.trees);
  return c;
}

/** 칸 하나의 점수 */
export function partScore(part, n) {
  if (part.band) {
    const [lo, hi] = part.band, pts = part.pts ?? 40;
    if (n < lo) return pts * (n / lo);
    if (n > hi) return Math.max(0, pts - (n - hi));
    return pts;
  }
  return Math.min(n, part.max ?? Infinity) * (part.per ?? 0);
}

/** 별점 → { score, stars (1–5), parts: [{ id, name, icon, n, pts, ok, tip }], weakest } */
export function rate(counts, cfg) {
  let score = 0;
  const parts = (cfg.parts ?? []).map(p => {
    const n = counts[p.id] ?? 0, pts = partScore(p, n);
    score += pts;
    const ok = p.bad ? n <= (p.want ?? 0) + 5 : p.band ? n >= p.band[0] && n <= p.band[1] : n >= (p.want ?? 0);
    return { id: p.id, name: p.name, icon: p.icon, n, pts: Math.round(pts * 10) / 10, ok, tip: p.tip, bad: !!p.bad };
  });
  score = Math.round(score);
  const th = cfg.stars ?? [0, 90, 150, 230, 300];
  let stars = 1;
  for (let i = 1; i < th.length; i++) if (score >= th[i]) stars = i + 1;
  // 가장 아쉬운 칸: 잡초가 많으면 잡초 먼저, 아니면 모자란 칸 중 하나 (설정 순서)
  const weakest = parts.find(p => p.bad && !p.ok) ?? parts.find(p => !p.ok) ?? null;
  return { score, stars: Math.min(5, stars), parts, weakest, next: th[stars] ?? null };
}

/** 저장 칸 바로잡기 */
export function ensureRating(state) {
  const r = (state.rating && typeof state.rating === 'object') ? state.rating : (state.rating = {});
  r.best = Number.isInteger(r.best) && r.best >= 0 && r.best <= 5 ? r.best : 0;
  if (!Array.isArray(r.rewarded)) r.rewarded = [];
  return r;
}

/** 새 별점을 적고 받을 상 → { up: [새로 오른 별], acorns, firstFive } */
export function record(R, result, cfg, dayKey) {
  const up = [];
  let acorns = 0;
  for (let s = 2; s <= result.stars; s++) {
    if (R.rewarded.includes(s)) continue;
    R.rewarded.push(s);
    up.push(s);
    acorns += cfg.rewards?.[s] ?? 0;
  }
  const firstFive = result.stars >= 5 && !R.five;
  if (firstFive) R.five = dayKey ?? true;
  R.best = Math.max(R.best, result.stars);
  R.last = { day: dayKey ?? null, stars: result.stars, score: result.score };
  return { up, acorns, firstFive };
}

/** 주민 한마디: 별 칭찬 한 줄 + 아쉬운 칸 한 줄 (날·주민으로 고름) → [줄…] */
export function comment(result, cfg, seed = 0) {
  const pr = cfg.praise?.[result.stars] ?? [];
  const out = pr.length ? [pr[Math.abs(seed) % pr.length]] : [];
  if (result.weakest?.tip) out.push(result.weakest.tip);
  else if (result.stars >= 5) out.push('이대로만 지켜 주세요!');
  return out;
}
