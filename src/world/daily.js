// 날마다 새로 놓는 것: 해변 조개 · 풀밭 잡초 · 화석 자리, 그리고 과일나무·야자수 열매 다시 열기.
// data 의 하루 규칙(harvest.today = 오늘 남은 수)에 맞춰 spawnTiles 후보에서 data.day.pickSpots 로 자리를 고른다.
// 오늘 놓은 자리는 state.island.spots 에 적고 (주운 것은 뺀다), 다시 불러오면 같은 자리에 다시 놓는다.
//   spots = { dayKey, shell: ['tx,tz'], weed: [...], 'fossil-spot': [...], holes: ['tx,tz'] (오늘 판 구덩이) }
// 이 물체들은 objects.add(..., { persist: false }) 로 놓아서 state.island.added 에는 남지 않는다.
export const DAILY_KINDS = ['shell', 'weed', 'fossil-spot'];

const keyOf = (tx, tz) => `${tx},${tz}`;
const parse = key => key.split(',').map(Number);
// 자리마다 늘 같은 방향·크기
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

export function createDaily(ctx, { objects, spawnTiles, nativeFruit }) {
  const { state, events } = ctx;
  const data = () => ctx.services.data;
  const placed = new Map();          // 물체 id → { kind, key }
  let busy = false;

  function put(kind, key) {
    const [tx, tz] = parse(key);
    const at = objects.at(tx, tz);
    if (at) {
      if (at.kind !== kind) return false;             // 다른 물체가 자리를 차지했으면 오늘은 건너뛴다
      placed.set(at.id, { kind, key });
      return true;
    }
    const r = hash(kind + key);
    let variant = null, scale = 1;
    if (kind === 'shell') {
      const id = data()?.harvest?.shellAt?.(key);
      variant = data()?.items?.get?.(id)?.variant ?? 'peach';
      scale = 1.4;
    } else if (kind === 'weed') scale = 1.2 + r * 0.3;
    const id = objects.add(kind, tx, tz, { rot: r * Math.PI * 2, scale, variant, persist: false });
    if (id) placed.set(id, { kind, key });
    return !!id;
  }
  function drop(id) {
    objects.remove(id);
    placed.delete(id);
  }

  /** 오늘 자리 놓기. 새 날이면 새로 고르고, 같은 날이면 적어 둔 자리를 다시 놓는다 (여러 번 불러도 됨) */
  function layout() {
    const d = data();
    if (!d?.harvest || !d.day || busy) return;
    busy = true;
    try {
      d.day.check();
      const today = d.harvest.today();
      const isl = state.island;
      let sp = isl.spots;
      if (!sp || typeof sp !== 'object') {
        // 처음: 생성기가 놓은 조개·잡초·화석 자리는 치우고 하루 규칙에 맡긴다
        for (const kind of DAILY_KINDS) for (const o of objects.list(kind)) objects.remove(o.id);
        sp = null;
      }
      if (!sp || sp.dayKey !== today.dayKey) {
        // 조개는 쓸려 가고 화석 자리는 새로, 안 뽑은 잡초는 그대로 쌓인다
        for (const [id, p] of [...placed]) if (p.kind !== 'weed') drop(id);
        const fossils = d.day.pickSpots(spawnTiles('fossil-spot'), today.fossils, 'fossil').map(t => keyOf(t.tx, t.tz));
        const shells = d.day.pickSpots(spawnTiles('shell'), today.shells, 'shell').map(t => keyOf(t.tx, t.tz));
        const weeds = (sp?.weed ?? []).slice(0, today.weeds);
        const need = today.weeds - weeds.length;
        if (need > 0) {
          const taken = new Set([...weeds, ...fossils]);
          const cands = spawnTiles('weed').filter(t => !taken.has(keyOf(t.tx, t.tz)));
          weeds.push(...d.day.pickSpots(cands, need, 'weed').map(t => keyOf(t.tx, t.tz)));
        }
        for (const [id, p] of [...placed]) if (p.kind === 'weed' && !weeds.includes(p.key)) drop(id);
        sp = isl.spots = { dayKey: today.dayKey, shell: shells, weed: weeds, 'fossil-spot': fossils, holes: [] };
      }
      for (const kind of DAILY_KINDS) sp[kind] = (sp[kind] ?? []).filter(key => put(kind, key));
      sp.holes ??= [];
      regrowFruit();
      events.emit('world:daily', { dayKey: sp.dayKey, shells: sp.shell.length, weeds: sp.weed.length, fossils: sp['fossil-spot'].length });
    } finally {
      busy = false;
    }
  }

  /** 딴 지 사흘 지난 나무는 열매를 다시 단다 (아직이면 'picked' 모습) */
  function regrowFruit() {
    const h = data()?.harvest;
    if (!h?.fruitReady) return;
    for (const o of [...objects.list('fruit-tree'), ...objects.list('palm')]) {
      const ready = h.fruitReady(o.id);
      const want = !ready ? 'picked' : o.kind === 'fruit-tree' ? (o.data?.fruit ?? nativeFruit ?? null) : null;
      if (o.variant !== want) objects.setVariant(o.id, want);
    }
  }

  events.on('data:newday', layout);
  events.on('game:ready', layout);

  const spots = () => state.island.spots ?? null;
  return {
    layout, regrowFruit,
    /** 오늘 놓은 물체면 { kind, key } ('tx,tz' = harvest 의 spotKey) */
    spotOf: id => placed.get(id) ?? null,
    /** 주웠거나 판 물체를 치우고 오늘 목록에서 뺀다 → { kind, key } | null */
    take(id) {
      const p = placed.get(id);
      if (!p) return null;
      drop(id);
      const list = spots()?.[p.kind];
      if (list) { const i = list.indexOf(p.key); if (i >= 0) list.splice(i, 1); }
      return p;
    },
    /** 오늘 판 구덩이 (그리기는 gameplay 가 한다) */
    holes: () => spots()?.holes ?? [],
    addHole(tx, tz) { const s = spots(); if (s && !s.holes.includes(keyOf(tx, tz))) s.holes.push(keyOf(tx, tz)); },
    removeHole(tx, tz) { const s = spots(); const i = s?.holes.indexOf(keyOf(tx, tz)) ?? -1; if (i >= 0) s.holes.splice(i, 1); return i >= 0; },
    kinds: DAILY_KINDS,
  };
}
