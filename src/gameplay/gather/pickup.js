// 줍기 (F · 우선순위 50): 떨어진 물건(drops), 해변 조개, 잡초. 발밑·앞에 있는 것 중 가장 가까운 하나.
// 조개·잡초는 world.daily 가 날마다 놓은 물체이고, 하루 규칙은 data.harvest.pickShell / pullWeed 가 맡는다.

const REACH = 1.05;

export function createPickup(ctx, kit, { drops, results, fx, act }) {
  const keyOf = o => kit.world?.daily?.spotOf?.(o.id)?.key ?? `${o.tile.tx},${o.tile.tz}`;
  const itemOf = t => (t.type === 'drop' ? t.d.rec.item : t.type === 'weed' ? 'mat.weed' : kit.data?.harvest?.shellAt?.(keyOf(t.o)));
  const countOf = t => (t.type === 'drop' ? t.d.rec.count : 1);

  function find() {
    const p = kit.player, world = kit.world;
    if (!p || !world) return null;
    const pos = p.position, f = p.pointInFront(0.35);
    const cands = [];
    for (const d of drops.near(pos.x, pos.z, REACH)) cands.push({ type: 'drop', d, x: d.x, z: d.z, y: d.y });
    for (const o of world.objects.query(pos.x, pos.z, REACH)) if (o.kind === 'shell' || o.kind === 'weed') cands.push({ type: o.kind, o, x: o.x, z: o.z, y: o.y });
    let best = null, bd = Infinity;
    for (const c of cands) {
      if (Math.abs(c.y - pos.y) > 0.6) continue;
      const d = Math.hypot(c.x - f.x, c.z - f.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function take(t) {
    const world = kit.world, h = kit.data?.harvest;
    const id = itemOf(t);
    if (t.type === 'drop') {
      const r = results.gain(id, t.d.rec.count, { verb: '주웠다' });
      if (r.left > 0) t.d.rec.count = r.left;
      else drops.remove(t.d);
      if (r.added && !r.acorns) kit.sfx('pickup');
      if (r.added) fx.sparkle({ x: t.x, y: t.y + 0.2, z: t.z }, 3);
      return;
    }
    const key = keyOf(t.o);
    const got = t.type === 'shell' ? h?.pickShell?.(key) : h?.pullWeed?.()?.id;
    if (!world.daily?.take?.(t.o.id)) world.objects.remove(t.o.id);
    if (t.type === 'weed') fx.chips({ x: t.x, y: t.y + 0.1, z: t.z }, 'leaf', 4);
    if (!got) return;
    results.gain(got, 1, { verb: t.type === 'weed' ? '뽑았다' : '주웠다' });
    kit.sfx('pickup');
  }

  return {
    find,
    async run(t) {
      const id = itemOf(t);
      if (id && !results.fits(id, Math.min(countOf(t), 1))) { kit.toast('가방이 꽉 찼어요!', '🎒'); return; }
      kit.player.face(t.x, t.z);
      await act('pickup', { onHit: () => take(t) });
    },
  };
}
