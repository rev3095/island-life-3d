// 꽃 교배 규칙 (three·DOM 없음 — node 로 테스트한다).
// 어제 물 준 꽃 옆(8칸)에 같은 종류 꽃이 있으면, 새 날에 두 꽃 둘레의 빈 칸에 새 꽃이 핀다.
// 색: 꽃마다 색 4가지 중 앞의 셋은 씨앗에서도 나오고, 마지막 하나는 교배로만 핀다 (items 의 hybrid).

export const BLOOM_CHANCE = 0.5;       // 둘 다 물을 줬을 때 한 쌍이 꽃을 피울 확률
export const LONE_FACTOR = 0.5;        // 한쪽만 물을 줬으면 이만큼 곱한다
export const HYBRID = { same: 0.12, mix: 0.3, withHybrid: 0.5 };

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

/**
 * 부모 두 색 → 아이 색. colors = 그 꽃의 색 목록 (마지막 = 교배로만 피는 색), rng() → 0~1
 * 같은 기본색끼리는 대개 같은 색, 다른 기본색끼리는 교배색이 잘 나오고, 교배색이 끼면 절반은 교배색.
 */
export function childColor(a, b, colors, rng = Math.random) {
  const hybrid = colors[colors.length - 1];
  const base = colors.slice(0, -1);
  if (a === hybrid && b === hybrid) return rng() < 0.7 ? hybrid : base[Math.floor(rng() * base.length)];
  if (a === hybrid || b === hybrid) return rng() < HYBRID.withHybrid ? hybrid : (a === hybrid ? b : a);
  if (a === b) return rng() < HYBRID.same ? hybrid : a;
  return rng() < HYBRID.mix ? hybrid : (rng() < 0.5 ? a : b);
}

/**
 * 새로 필 꽃 고르기.
 * flowers: [{ id, kind, variant, tx, tz, watered }]  (이미 핀 꽃만, 자라는 중인 것 빼고)
 * opts: { colors: kind → [색...], free(tx, tz) → 새 꽃을 놓을 수 있나, rng, chance }
 * → [{ kind, variant, tx, tz, parents: [id, id] }]  (한 꽃은 하루에 한 번만 부모가 된다)
 */
export function breed(flowers, { colors, free, rng = Math.random, chance = BLOOM_CHANCE } = {}) {
  const at = new Map(flowers.map(f => [`${f.tx},${f.tz}`, f]));
  const used = new Set();
  const taken = new Set();
  const out = [];
  const order = flowers.filter(f => f.watered).sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  for (const a of order) {
    if (used.has(a.id) || !colors[a.kind]) continue;
    const mates = N8.map(([dx, dz]) => at.get(`${a.tx + dx},${a.tz + dz}`))
      .filter(b => b && b.kind === a.kind && !used.has(b.id));
    if (!mates.length) continue;
    mates.sort((p, q) => Number(q.watered) - Number(p.watered));            // 물 준 짝을 먼저
    const b = mates[0].watered ? mates[0] : mates[Math.floor(rng() * mates.length)];
    if (rng() >= chance * (b.watered ? 1 : LONE_FACTOR)) continue;
    const spots = [];
    for (const p of [a, b]) for (const [dx, dz] of N8) {
      const tx = p.tx + dx, tz = p.tz + dz, key = `${tx},${tz}`;
      if (at.has(key) || taken.has(key) || spots.some(s => s.key === key) || !free(tx, tz)) continue;
      spots.push({ tx, tz, key });
    }
    if (!spots.length) continue;
    const s = spots[Math.floor(rng() * spots.length)];
    used.add(a.id); used.add(b.id); taken.add(s.key);
    out.push({ kind: a.kind, variant: childColor(a.variant, b.variant, colors[a.kind], rng), tx: s.tx, tz: s.tz, parents: [a.id, b.id] });
  }
  return out;
}
