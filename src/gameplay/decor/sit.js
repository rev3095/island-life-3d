// 10차 M10-P1 앉기 (AN-11 쓰기, 보드 wave10): 앉는 자리 맡기(누가 앉았나) · 주인공 앉기/일어나기 행동 키 · 밖에 놓은 의자 자리 목록.
// 자리 표·계산은 seats.js (순수). 주인공 앉기 동작은 player.sit(seat)/stand() (src/player/index.js), 주민은 town/villager.js.
// 집 안 의자는 house/index.js 가 같은 seats 서비스로 앉힌다 (자리 이름 'house:<가구 id>#n').
import { seatSpec, seatsOf, nearestSeat } from './seats.js';

export function createSeats(ctx, { objs, isActive }) {
  const S = () => ctx.services;
  const claims = new Map();   // 자리 이름 → 누구 ('player' | 주민 slug)

  const claim = (key, who) => {
    const h = claims.get(key);
    if (h && h !== who) return false;
    claims.set(key, who);
    return true;
  };
  const release = (key, who) => { if (key && (who == null || claims.get(key) === who)) claims.delete(key); };
  const holder = key => claims.get(key) ?? null;

  /** 섬에 놓은 꾸밈 가구 중 앉을 수 있는 것의 자리 전부 → [{ key, x, z, y, facing, dir, stand, id, kind }] */
  function outdoor() {
    const out = [];
    for (const o of objs.list()) {
      // 꾸밈으로 놓은 가구 + B-17 섬에 처음부터 있는 광장 벤치(배경 bench)
      if (!(o.data?.decor === 'furn' || o.kind === 'bench')) continue;
      const spec = seatSpec(o.kind);
      if (!spec) continue;
      for (const s of seatsOf(spec, { x: o.x, z: o.z, y: o.y ?? 0, rot: o.rot ?? 0 }, `decor:${o.id}`)) out.push({ ...s, id: o.id, kind: o.kind });
    }
    return out;
  }

  /** 주인공 앉히기: 일어나면 앉기 전 서 있던 곳으로 (걸을 수 있던 곳이라 안전) → 앉았으면 true */
  function sitPlayer(seat) {
    const player = S().player;
    if (!player?.sit || player.seated) return false;
    if (!claim(seat.key, 'player')) { S().ui?.toast?.('누가 앉아 있어요', '🪑'); return false; }
    const p = player.position;
    const near = Math.hypot(p.x - seat.x, p.z - seat.z) < 1.5;
    const ok = player.sit({ ...seat, stand: near ? { x: p.x, z: p.z } : seat.stand });
    if (!ok) { release(seat.key, 'player'); return false; }
    ctx.events.emit('sfx', { name: 'step-wood', volume: 0.5 });
    return true;
  }
  ctx.events.on('player:stand', ({ key }) => release(key, 'player'));

  // 행동 키: 앉아 있으면 Space(F) = 일어나기 (무엇보다 먼저, 문 지나기 300 아래) · 밖 의자 앞 Space = 앉기 (가구 80 위, 문 90 · 말 걸기 100 아래)
  const gp = S().gameplay?.interactions;
  gp?.add({ name: 'seat-stand', priority: 115, label: '일어나기',
    test: () => (S().player?.seated && !S().ui?.isBlocking?.() ? true : null), run: () => S().player.stand() });
  gp?.add({ name: 'decor-sit', intent: 'action', priority: 85, label: '앉기',
    test: () => {
      const pl = S().player;
      if (!pl?.hasClip?.('sit') || pl.seated || isActive() || S().ui?.isBlocking?.() || Math.abs(pl.position.x) > 200) return null;
      return nearestSeat(outdoor(), pl.position.x, pl.position.z, { reach: 1.25, facing: pl.facing, taken: k => !!holder(k) });
    },
    run: seat => sitPlayer(seat) });

  return { claim, release, holder, outdoor, sitPlayer, claims };
}
