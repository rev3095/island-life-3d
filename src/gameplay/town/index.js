// 2차 W2 (P3): 주민 6명 배회·일과·대화·친밀도·부탁·선물, 밤톨 도토리상점, 느루 박물관, 첫날 안내, 이름표.
// 행동 키는 gameplay.interactions 로 받는다: 주민 말 걸기 100, 첫날 안내 100, 상점·박물관·주민 집 문 90.
import { createNav } from './path.js';
import { PEOPLE } from './people.js';
import { createVillager } from './villager.js';
import { createKeepers } from './keepers.js';
import { createLabels } from './labels.js';
import { createTalk, context } from './talk.js';
import { villagerState, pickWeighted } from './rules.js';
import LINES from './lines/index.js';

const TALK_DIST = 1.3;
const ANIM_DIST = 30;        // 이보다 멀면 동작을 멈춘다 (화면 밖)
const BODY = 0.5;            // 플레이어와 주민이 겹치지 않는 거리

let T = null;

export default {
  name: 'town',

  async init(ctx) {
    const world = ctx.services.world, player = ctx.services.player;
    if (!world || !player || !ctx.services.gameplay) { console.warn('[town] world·player 가 없어 주민을 놓지 않아요'); return; }
    const t0 = performance.now();
    const nav = createNav(world.island);
    const spots = buildSpots(ctx, nav);
    let busy = false;
    let actors = [];          // 비켜 가기·몸 밀기용 (주민 + 가게 주인)
    let villagers = [];

    const town = {
      houseOf: slug => world.places.villagerHouses?.find(h => h.slug === slug) ?? null,
      fallbackSpot: () => world.places.plaza,
      friendship: slug => villagerState(ctx.state, slug).friendship,
      rainJoy: V => V.slug === 'chorong' && ctx.services.time?.weather === 'rain',
      /** 자주 가는 곳 하나 → {x, z} (다른 주민이 가려는 곳과 겹치지 않게) */
      pickSpot(person, V) {
        const haunts = Object.entries(person.haunts).map(([k, w]) => ({ k, w }));
        for (let i = 0; i < 8; i++) {
          const k = pickWeighted(haunts, Math.random).k;
          const list = k === 'home' ? spots.home[person.slug] : spots[k];
          if (!list?.length) continue;
          const t = list[Math.floor(Math.random() * list.length)];
          if (!nav.walkable(t.tx, t.tz)) continue;
          const c = world.island.toWorld(t.tx, t.tz);
          const x = c.x + (Math.random() - 0.5) * 0.4, z = c.z + (Math.random() - 0.5) * 0.4;
          const home = V?.door;
          if (home && person.range && k !== 'home' && Math.hypot(x - home.x, z - home.z) > person.range) continue;
          if (villagers.some(o => o !== V && o.goal && Math.hypot(o.goal.x - x, o.goal.z - z) < 1.5)) continue;
          if (V) V.goal = { x, z };
          return { x, z };
        }
        return null;
      },
      /** 지금 자리 → 목표까지 걸을 점 목록 (못 가면 null) */
      route(from, to) {
        const a = world.island.toTile(from.x, from.z), b = world.island.toTile(to.x, to.z);
        const tiles = nav.findPath(a, b, { maxNodes: 3600 });
        if (!tiles) return null;
        const pts = nav.smooth(tiles.slice(1), from.x, from.z);
        if (pts.length) pts[pts.length - 1] = { x: to.x, z: to.z };
        else pts.push({ x: to.x, z: to.z });
        return pts;
      },
      /** 걷는 중 밀어내기: 다른 캐릭터는 옆으로 비켜 가고, 플레이어가 바로 앞에 서 있으면 잠깐 기다린다 */
      avoid(self, x, z, dx, dz) {
        let px = 0, pz = 0, wait = false;
        for (const o of actors) {
          if (o === self.actor || !o.visible) continue;
          const ex = x - o.position.x, ez = z - o.position.z, d = Math.hypot(ex, ez);
          if (d > 0.95 || d < 1e-4) continue;
          const k = ((0.95 - d) / 0.95) * 1.3;
          px += (ex / d) * k; pz += (ez / d) * k;
          if (-(ex * dx + ez * dz) / d > 0.5) { px += -dz * k; pz += dx * k; }   // 마주 오면 오른쪽으로
        }
        const pl = ctx.services.player?.position;
        if (pl) {
          const ex = x - pl.x, ez = z - pl.z, d = Math.hypot(ex, ez);
          if (d < 1.1 && d > 1e-4) {
            if (-(ex * dx + ez * dz) / d > 0.75 && d < 0.85) wait = true;
            const k = ((1.1 - d) / 1.1) * 1.2;
            px += (ex / d) * k - dz * k * 0.6; pz += (ez / d) * k + dx * k * 0.6;
          }
        }
        return { x: px, z: pz, wait };
      },
      /** 거리에 따라 작아지는 효과음 (멀면 안 낸다) */
      sfxAt(name, pt, base = 0.6) {
        const pl = ctx.services.player?.position;
        const d = pl ? Math.hypot(pl.x - pt.x, pl.z - pt.z) : 0;
        const volume = base * Math.max(0, 1 - d / 14);
        if (volume > 0.04) ctx.events.emit('sfx', { name, volume });
      },
      /** 대화 하나: 플레이어를 멈추고 서로 마주 본 뒤 fn() 이 끝나면 풀어 준다 */
      async conversation(who, fn, { face = true } = {}) {
        if (busy) return;
        busy = true;
        const pl = ctx.services.player;
        pl.freeze(true);
        if (face) pl.face(who.actor.position.x, who.actor.position.z);
        who.beginTalk?.();
        who.actor.lookAt(pl.position.x, pl.position.z);
        try { await fn(); } catch (e) { console.error('[town] 대화', e); }
        finally { who.endTalk?.(); pl.freeze(false); busy = false; }
      },
    };

    villagers = await Promise.all(ctx.constants.VILLAGERS.filter(s => PEOPLE[s] && LINES[s]).map(s => createVillager(ctx, PEOPLE[s], town)));
    const keepers = await createKeepers(ctx, town, LINES);
    actors = [...villagers.map(V => V.actor), ...keepers.all.map(K => K.actor)];
    const labels = createLabels(ctx);
    const talk = createTalk(ctx, { lines: LINES });

    const c = context(ctx);
    for (const V of villagers) V.spawn(c.now, c.weather);

    // ---- 행동 키 ----
    const pl = player;
    /** 앞에 있는(가까우면 옆도) 말 걸 수 있는 주민 */
    function villagerInFront() {
      const p = pl.position, fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
      let best = null, bestScore = Infinity;
      for (const V of villagers) {
        if (!V.talkable) continue;
        const q = V.actor.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d > TALK_DIST || Math.abs(q.y - p.y) > 0.6) continue;
        const dot = d > 1e-4 ? (dx * fx + dz * fz) / d : 1;
        if (d > 0.8 && dot < 0.35) continue;
        const score = d - dot * 0.4;
        if (score < bestScore) { best = V; bestScore = score; }
      }
      return best;
    }
    /** 주민이 집에 있을 때 그 집 문 앞 */
    function homeDoorInFront() {
      const p = pl.position;
      for (const V of villagers) {
        if (V.mode !== 'home' || !V.door) continue;
        const dx = V.door.x - p.x, dz = V.door.z - 0.4 - p.z, d = Math.hypot(dx, dz);
        if (d < 1.2 && (d < 0.5 || (-Math.sin(pl.facing) * dx - Math.cos(pl.facing) * dz) / d > 0.3)) return V;
      }
      return null;
    }
    const gp = ctx.services.gameplay.interactions;
    gp.add({ name: 'town:talk', intent: 'action', priority: 100, test: villagerInFront, run: V => town.conversation(V, () => talk.converse(V)) });
    gp.add({ name: 'town:knock', intent: 'action', priority: 90, test: homeDoorInFront, run: V => town.conversation(V, () => talk.knock(V), { face: true }) });
    keepers.register(gp);

    T = { ctx, villagers, keepers, labels, talk, town, nav, spots };
    ctx.services.town = {
      villagers, keepers: keepers.all,
      /** 개발용: 주민 상태 보기·고치기 */
      state: slug => villagerState(ctx.state, slug),
      talkTo: slug => { const V = villagers.find(v => v.slug === slug); return V && town.conversation(V, () => talk.converse(V)); },
      debug: { nav, spots, town, keepers },
    };
    console.info(`[town] 주민 ${villagers.length}명 준비 ${Math.round(performance.now() - t0)}ms`);
  },

  update(dt) {
    if (!T) return;
    const { ctx, villagers, keepers, labels } = T;
    const time = ctx.services.time;
    const now = time?.now?.() ?? null;
    const weather = time?.weather ?? 'clear';
    const f = ctx.focus;
    for (const V of villagers) {
      const p = V.actor.position;
      V.update(dt, now, weather, Math.hypot(p.x - f.x, p.z - f.z) < ANIM_DIST);
    }
    keepers.update(dt, now);
    pushPlayer(ctx, [...villagers.map(V => V.actor), ...keepers.all.map(K => K.actor)]);
    labels.update([
      ...villagers.map(V => ({ actor: V.actor, name: V.person.name, color: V.person.color, show: V.talkable })),
      ...keepers.all.map(K => ({ actor: K.actor, name: K.person.name, color: K.person.color })),
    ]);
  },
};

/** 주민 몸은 단단하다: 플레이어가 겹치면 (벽 충돌을 지키며) 살짝 밀어낸다 */
function pushPlayer(ctx, actors) {
  const pl = ctx.services.player, world = ctx.services.world;
  if (!pl || !world) return;
  const p = pl.position;
  for (const a of actors) {
    if (!a.visible || a.opacity < 0.5) continue;
    const ex = p.x - a.position.x, ez = p.z - a.position.z, d = Math.hypot(ex, ez);
    if (d >= BODY || Math.abs(p.y - a.position.y) > 0.6) continue;
    const k = d > 1e-4 ? (BODY - d) / d : 0;
    const nx = d > 1e-4 ? p.x + ex * k : p.x + BODY, nz = d > 1e-4 ? p.z + ez * k : p.z;
    const r = world.collide(p.x, p.z, nx, nz, 0.26, p.y);
    p.x = r.x; p.z = r.z;
  }
}

/** 자주 가는 곳 후보 칸들 (처음 한 번) */
function buildSpots(ctx, nav) {
  const world = ctx.services.world;
  const { island, places, objects } = world;
  const T = p => island.toTile(p.x, p.z);
  const S = { home: {} };
  const reach = (p, depth, test) => (p ? nav.reach(T(p), depth, test) : []);
  const tileIs = (tx, tz, ...k) => k.includes(island.tileAt(tx, tz));
  const nearWater = (tx, tz) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => island.tileAt(tx + a, tz + b) === 'water');

  S.plaza = reach(places.plaza, 4);
  S.dock = reach(places.spawn, 3);
  S.shop = places.shop ? reach({ x: places.shop.door.x, z: places.shop.door.z + 1.5 }, 3) : [];
  S.museum = places.museum ? reach({ x: places.museum.door.x, z: places.museum.door.z + 1 }, 3) : [];
  S.orchard = reach(places.orchard, 4);
  S.bridge = (places.bridges ?? []).flatMap(b => [...reach({ x: b.x - 2.3, z: b.z }, 1), ...reach({ x: b.x + 2.3, z: b.z }, 1)]);
  S.beach = []; S.river = [];
  for (let tz = 0; tz < island.h; tz++) for (let tx = 0; tx < island.w; tx++) {
    if (!nav.walkable(tx, tz) || island.flagsAt?.(tx, tz)) continue;
    if (tileIs(tx, tz, 'sand')) S.beach.push({ tx, tz });
    else if (tileIs(tx, tz, 'grass', 'path') && nearWater(tx, tz)) S.river.push({ tx, tz });
  }
  const pond = places.pond;
  S.pond = pond ? S.river.filter(t => { const c = island.toWorld(t.tx, t.tz); return Math.hypot(c.x - pond.x, c.z - pond.z) < 7; }) : [];
  S.flowers = [];
  const seen = new Set();
  for (const o of objects.list?.() ?? []) {
    if (!/tulip|cosmos|pansy|flower|bush/.test(o.kind)) continue;
    const t = T(o);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${t.tx + a},${t.tz + b}`;
      if (!seen.has(key) && nav.walkable(t.tx + a, t.tz + b)) { seen.add(key); S.flowers.push({ tx: t.tx + a, tz: t.tz + b }); }
    }
  }
  for (const h of places.villagerHouses ?? []) S.home[h.slug] = reach({ x: h.door.x, z: h.door.z + 1 }, 5);
  return S;
}
