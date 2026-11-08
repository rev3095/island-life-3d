// 2차 W2 (P3): 주민 6명 배회·일과·대화·친밀도·부탁·선물·주민끼리 수다·편지, 밤톨 도토리상점, 느루 박물관, 첫날 안내, 이름표.
// 행동 키는 gameplay.interactions 로 받는다: 주민 말 걸기 100, 첫날 안내 100, 우편함 91, 상점·박물관·주민 집 문 90.
// 5차 Z4: 새 주민 이사(movein.js), 생일(party.js), 주민 방(house:enter {owner} 를 받으면 집에 있던 주인을 방 안에 세운다).
import { createNav } from './path.js';
import { PEOPLE } from './people.js';
import { createVillager } from './villager.js';
import { RADIUS } from './actor.js';
import { createKeepers } from './keepers.js';
import { createLabels } from './labels.js';
import { createTalk, context } from './talk.js';
import { createChatter } from './chatter.js';
import { createMail } from './mail.js';
import { villagerState, pickWeighted, ownerOf, isAsleep } from './rules.js';
import { createMovein, livesHere } from './movein.js';
import { createParty } from './party.js';
import LINES from './lines/index.js';

const TALK_DIST = 1.3;
const EVENT_CLEAR = 3.2;   // 행사 자리에서 주민이 비켜 서는 거리 (솥 1.9 + 말 걸기 1.3)
const ANIM_DIST = 30;        // 이보다 멀면 동작을 멈춘다 (화면 밖)
const PLAYER_RADIUS = 0.26; // player 모듈의 충돌 원
const BODY = RADIUS + PLAYER_RADIUS;
const ROOM_AHEAD = 2.3;      // house:enter 에 자리가 없으면: 들어온 플레이어 앞(북쪽) 이만큼에 주인을 세운다

let T = null;

export default {
  name: 'town',

  async init(ctx) {
    const world = ctx.services.world, player = ctx.services.player;
    if (!world || !player || !ctx.services.gameplay) { console.warn('[town] world·player 가 없어 주민을 놓지 않아요'); return; }
    const t0 = performance.now();
    const nav = createNav(world.island, { roadAt: (tx, tz) => !!ctx.services.decor?.isRoad?.(tx, tz) });   // 9차: 깐 길도 싸게
    const spots = buildSpots(ctx, nav);
    let busy = false;
    let party = null;         // 생일 (아래에서 만든다 — town.staysIn 이 쓴다)
    let actors = [];          // 비켜 가기·몸 밀기용 (주민 + 가게 주인)
    let villagers = [];
    // 7차 D56-A: 주민이 서지 않는 자리 — 상점·박물관 문 앞(1.6칸) · 광장 모닥불 둘레(2.8칸, 축제 시작 자리 2.4 + 몸)
    const keepClear = () => [
      world.places.shop?.door && { x: world.places.shop.door.x, z: world.places.shop.door.z, r: 1.6 },
      world.places.museum?.door && { x: world.places.museum.door.x, z: world.places.museum.door.z, r: 1.6 },
      world.places.festival && { x: world.places.festival.x, z: world.places.festival.z, r: 2.8 },
      ...eventSpots(),
    ].filter(Boolean);
    // 8차 행사 시간엔 그 행사 자리(간판·돗자리·솥·눈덩이)도 — 행동 거리(1.4~1.9) + 말 걸기 거리(1.3). 주인공이 1.4칸 둘레에 서서
    // 간판 앞 Space 가 「소원 빌기」 대신 말 걸기로 가던 것 (M8-P8 행사 점검 EV-02, 가끔)
    function eventSpots() {
      const E = ctx.services.events;
      if (!E?.live || !E.hostSpot) return [];
      return E.live().map(r => r.ev.host && E.hostSpot(r.ev.host)).filter(Boolean).map(p => ({ x: p.x, z: p.z, r: EVENT_CLEAR }));
    }
    const blocksAction = (x, z) => keepClear().some(c => Math.hypot(x - c.x, z - c.z) < c.r);

    const town = {
      houseOf: slug => world.places.villagerHouses?.find(h => h.slug === slug) ?? null,
      fallbackSpot: () => world.places.plaza,
      friendship: slug => villagerState(ctx.state, slug).friendship,
      /** 신나는 날: 초롱은 비, 단풍은 가을 (더 자주 뛰고 기뻐한다) */
      joy: V => (V.slug === 'chorong' && ctx.services.time?.weather === 'rain') || (!!V.person.joySeason && (world.season ?? context(ctx).season) === V.person.joySeason),
      /** 생일엔 하루 종일 집에 */
      staysIn: V => !!party?.staysIn(V.slug),
      /** 자주 가는 곳 하나 → {x, z} (다른 주민이 가려는 곳과 겹치지 않게) */
      /** 이 자리에 서면 행동 키를 가로막나: 상점·박물관 문 앞 · 광장 모닥불 둘레 (7차 D56-A — 주민이 비켜 선다) */
      blocksAction,
      pickSpot(person, V) {
        // 8차 D79-A: 계절 행사 주인공은 행사 시간 동안 대개 그 행사 자리 둘레에 (gameplay/events hostSpot)
        const ev = ctx.services.events?.hostSpot?.(person.slug);
        if (ev && Math.random() < 0.75) {
          for (let i = 0; i < 16; i++) {   // 무대·모닥불 둘레(blocksAction)에 걸리는 자리가 많아 넉넉히
            const a = Math.random() * Math.PI * 2, r = EVENT_CLEAR + 0.2 + Math.random() * 1.6;   // 행사 자리 바로 앞(EVENT_CLEAR)은 비워 둔다
            const x = ev.x + Math.cos(a) * r, z = ev.z + Math.sin(a) * r, t = world.island.toTile(x, z);
            if (!nav.walkable(t.tx, t.tz) || blocksAction(x, z)) continue;
            if (V) V.goal = { x, z };
            return { x, z };
          }
        }
        // 9차 D86-A: 섬에 놓은 벤치·피크닉 탁자 앞에서 쉬기 (가끔, 다른 주민이 안 가 있는 곳)
        const hang = ctx.services.decor?.hangouts?.() ?? [];
        if (hang.length && Math.random() < 0.2) {
          const s = hang[Math.floor(Math.random() * hang.length)], t = world.island.toTile(s.x, s.z);
          if (nav.walkable(t.tx, t.tz) && !blocksAction(s.x, s.z) && !villagers.some(o => o !== V && o.goal && Math.hypot(o.goal.x - s.x, o.goal.z - s.z) < 1)) {
            if (V) V.goal = { x: s.x, z: s.z };
            return { x: s.x, z: s.z };
          }
        }
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
          if (blocksAction(x, z)) continue;
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
        who.actor.lookAt?.(pl.position.x, pl.position.z);
        const unwatch = ctx.services.world?.occlusion?.watch?.(() => who.actor.position);   // 대화 상대 앞 나무도 비치게 (X2)
        try { await fn(); } catch (e) { console.error('[town] 대화', e); }
        finally { unwatch?.(); who.endTalk?.(); pl.freeze(false); busy = false; }
      },
    };

    const NEW = ctx.constants.NEWCOMERS ?? [];
    const canLive = s => PEOPLE[s] && LINES[s];
    /** 지금 섬에 사는 주민 slug (이사 오기 전 새 주민은 빠진다) */
    const residents = () => ctx.constants.VILLAGERS.filter(s => canLive(s) && livesHere(ctx.state, s, NEW));
    villagers = await Promise.all(residents().map(s => createVillager(ctx, PEOPLE[s], town)));
    const keepers = await createKeepers(ctx, town, LINES);
    actors = [...villagers.map(V => V.actor), ...keepers.all.map(K => K.actor)];
    // 몸은 단단하다: 주민·가게 주인·플레이어를 world 의 움직이는 충돌체로 (없으면 매 프레임 플레이어를 밀어낸다)
    const solid = !!world.addMover;
    const body = (pos, r, on = () => true) => ({ get x() { return pos.x; }, get z() { return pos.z; }, get y() { return pos.y; }, r, get active() { return on(); } });
    const solidify = a => world.addMover(body(a.position, RADIUS, () => a.visible && a.opacity > 0.5));
    if (solid) {
      for (const a of actors) solidify(a);
      world.addMover(body(player.position, PLAYER_RADIUS));
    }
    const toast = (text, icon) => { if (ctx.services.ui?.toast) ctx.services.ui.toast(text, icon); else ctx.events.emit('toast', { text, icon }); };
    const labels = createLabels(ctx);
    const mail = createMail(ctx, { lines: LINES });
    town.mail = mail;
    party = createParty(ctx, { mail, residents, toast });
    const talk = createTalk(ctx, { lines: LINES, party });
    const chatter = createChatter(villagers, LINES);

    /** 이사 온 주민을 섬에 들인다 (모델을 불러 villagers 에 더한다) */
    let adding = Promise.resolve();
    function addResident(slug) {
      adding = adding.then(async () => {
        if (!canLive(slug) || villagers.some(V => V.slug === slug)) return;
        const V = await createVillager(ctx, PEOPLE[slug], town);
        villagers.push(V);
        actors.push(V.actor);
        if (solid) solidify(V.actor);
        const cc = context(ctx);
        V.spawn(cc.now, cc.weather);
        console.info(`[town] ${PEOPLE[slug].name} 입주 — 주민 ${villagers.length}명`);
      });
      return adding;
    }
    const movein = createMovein(ctx, { mail, addResident, toast });

    // 아침 편지·이사·생일: 시작할 때 한 번, 하루가 바뀌면 (data 의 하루 리셋 뒤)
    const newDay = dayKey => {
      mail.deliver(dayKey);
      const key = dayKey ?? context(ctx).dayKey;
      movein.check(key);
      party.check(key);
    };
    newDay(undefined);
    ctx.events.on('data:newday', ({ dayKey } = {}) => newDay(dayKey));
    ctx.events.on('time:newday', ({ dayKey } = {}) => newDay(dayKey));
    // 첫날 안내가 끝나면 이사 흐름이 그날부터 센다
    ctx.events.on('town:intro', () => movein.check(context(ctx).dayKey));
    const mailbox = mail.spot && { position: { x: mail.spot.x, y: world.island.heightAt(mail.spot.x, mail.spot.z), z: mail.spot.z }, height: 0.95, visible: true, opacity: 1 };

    const c = context(ctx);
    for (const V of villagers) V.spawn(c.now, c.weather);

    // ---- 주민 방 (Z2 house 가 주민 집 문으로 들어가면 house:enter {owner}) ----
    let roomOwner = null;
    ctx.events.on('house:enter', (e = {}) => {
      const slug = ownerOf(e);
      roomOwner = slug;
      if (!slug) return;
      const V = villagers.find(v => v.slug === slug);
      if (!V) return;
      const p = player.position;
      const spot = e.spot ?? e.stand ?? e.at ?? { x: p.x + 0.4, z: p.z - ROOM_AHEAD };
      V.enterRoom(spot, e.facing ?? Math.PI);
    });
    ctx.events.on('house:leave', (e = {}) => {
      const slug = ownerOf(e) ?? roomOwner;
      roomOwner = null;
      villagers.find(v => v.slug === slug)?.leaveRoom();
    });

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
    /** 플레이어 집 우편함 앞 (그쪽을 볼 때) */
    function mailboxInFront() {
      if (!mailbox) return null;
      const p = pl.position, q = mailbox.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > 1.15 || Math.abs(q.y - p.y) > 0.6) return null;
      return d < 0.55 || (-Math.sin(pl.facing) * dx - Math.cos(pl.facing) * dz) / d > 0.45 ? mailbox : null;
    }
    const gp = ctx.services.gameplay.interactions;
    gp.add({ name: 'town:talk', intent: 'action', priority: 100, test: villagerInFront, run: V => town.conversation(V, () => talk.converse(V)) });
    gp.add({ name: 'town:knock', intent: 'action', priority: 90, test: homeDoorInFront, run: V => town.conversation(V, () => talk.knock(V), { face: true }) });
    gp.add({ name: 'town:mail', intent: 'action', priority: 91, test: mailboxInFront, run: box => town.conversation({ actor: box }, () => mail.read()) });
    keepers.register(gp);

    T = { ctx, villagers, keepers, labels, talk, town, nav, spots, solid, chatter, mail, mailbox, movein };
    ctx.services.town = {
      villagers, keepers: keepers.all,
      /** 지금 섬에 사는 주민 slug 목록 (새 주민은 입주한 뒤부터) */
      residents,
      /** 상점·박물관 문 (실내 보드): 'open' | 'closed' | null — house.places 가 문 쪽으로 밀 때 묻는다 */
      placeRule: kind => keepers.placeRule(kind),
      /** 주민이 지금 어디: 'out' 밖 · 'home' 집 안(깨어 있음, 생일·비·저녁) · 'sleep' 자는 시간 · 'room' 플레이어가 방에 있음 · null 섬에 안 삶 */
      atHome(slug) {
        const V = villagers.find(v => v.slug === slug);
        if (!V) return null;
        if (V.inRoom) return 'room';
        if (V.out) return 'out';
        // 7차 D57-A: 잠들기 전 1~2시간은 집에 깨어 있다 → 자는 때는 그 주민 일과로 (예전엔 밤·새벽 시간대 전부)
        return isAsleep(V.person, context(ctx).now) && !party.isBirthday(slug) ? 'sleep' : 'home';
      },
      /** 생일: of(slug) 'MM-DD', today() 오늘 생일인 주민, player() 플레이어 생일, setPlayer(달, 날 | null) — 섬폰이 쓴다 */
      birthday: {
        of: slug => party.birthdayOf(slug), today: () => party.birthdays(), isToday: slug => party.isBirthday(slug),
        player: () => party.player(), setPlayer: (m, d) => party.setPlayer(m, d), isPlayerToday: () => party.isPlayerBirthday(),
      },
      /** 이사: stage(slug) 'none'|'waiting'|'lot'|'boxes'|'moved', skip(slug) 개발용 다음 단계, lot(slug) 집터 */
      movein: { stage: slug => movein.stage(slug ?? NEW[0]), skip: slug => movein.skip(slug, context(ctx).dayKey), lot: slug => movein.lotOf(slug ?? NEW[0]) },
      /** 개발용: 주민 상태 보기·고치기 */
      state: slug => villagerState(ctx.state, slug),
      talkTo: slug => { const V = villagers.find(v => v.slug === slug); return V && town.conversation(V, () => talk.converse(V)); },
      mail: { unread: () => mail.unread(), post: (from, kind, gift) => mail.post(from, kind, gift), deliver: d => mail.deliver(d), spot: mail.spot },
      debug: { nav, spots, town, keepers, chatter, party, movein },
    };
    console.info(`[town] 주민 ${villagers.length}명 준비 ${Math.round(performance.now() - t0)}ms`);
  },

  update(dt) {
    if (!T) return;
    const { ctx, villagers, keepers, labels, solid, chatter, mail, mailbox, movein } = T;
    movein.update();
    const time = ctx.services.time;
    const now = time?.now?.() ?? null;
    const weather = time?.weather ?? 'clear';
    const f = ctx.focus;
    for (const V of villagers) {
      const p = V.actor.position;
      V.update(dt, now, weather, Math.hypot(p.x - f.x, p.z - f.z) < ANIM_DIST);
    }
    keepers.update(dt, now);
    chatter.update(dt);
    if (!solid) pushPlayer(ctx, [...villagers.map(V => V.actor), ...keepers.all.map(K => K.actor)]);
    const letters = mailbox ? mail.unread().length : 0;
    labels.update([
      ...villagers.map(V => ({ actor: V.actor, name: V.person.name, color: V.person.color, show: V.talkable, bubble: V.bubble })),
      ...keepers.all.map(K => ({ actor: K.actor, name: K.person.name, color: K.person.color })),
      ...(mailbox ? [{ actor: mailbox, bubble: letters ? `✉️ ${letters}` : null }] : []),
    ]);
  },
};

/** world.addMover 가 없을 때: 플레이어가 주민과 겹치면 (벽 충돌을 지키며) 살짝 밀어낸다 */
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
