// 가게 주인: 밤톨(도토리상점 문 옆)·느루(박물관 문 옆). 첫날엔 밤톨이 선착장에서 맞이하고 조작을 알려 준다.
// 상점·박물관 문 앞에서 행동 키(우선순위 90) → 인사 → ui.shop / ui.museum. 첫날 안내는 우선순위 100.
import { createActor } from './actor.js';
import { KEEPERS } from './people.js';
import { context, speaker, giveItem } from './talk.js';
import { pickLines } from './rules.js';

const DOOR_DIST = 1.5, KEEPER_DIST = 1.5, LOOK_DIST = 3;
const MILESTONES = [5, 10, 20, 30, 40];
const CAT_KO = { fish: '물고기', bug: '곤충', fossil: '화석' };

export async function createKeepers(ctx, town, lines) {
  const world = ctx.services.world;
  const { places } = world;
  const [bActor, nActor] = await Promise.all([createActor(ctx, 'bamtol'), createActor(ctx, 'neuru')]);
  const LB = lines.bamtol, LN = lines.neuru;
  const r = Math.random;

  // 서 있을 자리: 문 옆 한 칸 (걸을 수 있는 곳을 찾는다)
  const beside = (door, side) => {
    for (const [dx, dz] of [[side * 1.35, 0.15], [side * 1.35, 0.7], [-side * 1.35, 0.15], [0, 1.4]]) {
      const x = door.x + dx, z = door.z + dz;
      if (world.island.isWalkable(x, z)) return { x, z };
    }
    return { x: door.x, z: door.z + 1 };
  };
  const shopDoor = places.shop?.door ?? places.plaza;
  const museumDoor = places.museum?.door ?? places.plaza;
  const B = makeKeeper('bamtol', bActor, beside(shopDoor, 1));
  const N = makeKeeper('neuru', nActor, beside(museumDoor, -1));
  const all = [B, N];

  function makeKeeper(slug, actor, spot) {
    const K = {
      slug, actor, spot, person: KEEPERS[slug], mode: 'stand', run: false, noticedAt: -99, clock: 0, recent: [],
      get talkable() { return actor.visible && actor.opacity > 0.9; },
      beginTalk() { K.prev = K.mode; if (K.mode === 'walk') K.mode = 'talk-walk'; else K.mode = 'talk'; actor.speed = 0; actor.play('idle'); },
      endTalk() { K.mode = K.mode === 'talk-walk' ? 'walk' : K.prev === 'talk' ? 'stand' : K.prev; },
      happy() { actor.playOnce('happy'); },
    };
    actor.place(spot.x, spot.z, Math.PI);
    return K;
  }

  // ---- 밤톨: 영업시간엔 문 옆, 아니면 가게 안 (첫날엔 선착장) ----
  // 첫 입력(키·터치) 뒤에 말을 건다 — 소리 잠금이 풀려야 밤톨 목소리가 난다. 아무 입력이 없어도 12초 뒤엔 시작
  const intro = { pending: !ctx.state.flags?.intro, running: false, wait: 1.6, idle: 0, heard: ctx.services.audio?.unlocked === true };
  if (intro.pending && !intro.heard) {
    const heard = () => { intro.heard = true; intro.wait = Math.min(intro.wait, 0.7); };
    addEventListener('keydown', heard, { once: true, capture: true });
    addEventListener('pointerdown', heard, { once: true, capture: true });
  }
  const isOpen = hour => ctx.services.data?.economy?.isOpen?.(hour) ?? (hour >= 8 && hour < 22);
  if (intro.pending) {
    // 보통은 선착장(처음 서는 곳) 옆. 저장된 자리에서 시작하면 플레이어 곁에서 기다린다
    const pl = ctx.services.player?.position;
    const spawn = places.spawn ?? places.plaza;
    const sp = pl && Math.hypot(pl.x - spawn.x, pl.z - spawn.z) > 6 ? { x: pl.x, z: pl.z + 1.3 } : spawn;
    let s = { x: sp.x + 1.1, z: sp.z - 1.3 };
    if (!world.island.isWalkable(s.x, s.z)) s = { x: sp.x, z: sp.z - 1.6 };
    B.mode = 'intro';
    B.actor.place(s.x, s.z, Math.PI);
  } else if (!isOpen(context(ctx).now.hour)) { B.mode = 'inside'; B.actor.setOpacity(0); B.actor.fadeTo = 0; }

  function update(dt, now) {
    const pl = ctx.services.player?.position;
    for (const K of all) {
      K.clock += dt;
      const a = K.actor, p = a.position;
      const pd = pl ? Math.hypot(pl.x - p.x, pl.z - p.z) : 99;
      if (K.mode === 'walk') {
        const res = a.walk(dt, K.person.pace.walk, (x, z, dx, dz) => town.avoid(K, x, z, dx, dz));
        a.animateMove(a.speed);
        if (res === 'arrived' || res === 'stuck') { K.mode = 'stand'; a.path = []; a.lookAt(p.x, p.z + 5); if (res === 'stuck') a.place(K.spot.x, K.spot.z, Math.PI); }
      } else {
        a.animateMove(0);
        if (pl && pd < LOOK_DIST && a.visible) {
          a.lookAt(pl.x, pl.z);
          if (K.mode === 'stand' && pd < 2.2 && K.clock - K.noticedAt > 45) { K.noticedAt = K.clock; if (r() < 0.35) K.happy(); }
        } else if (K.mode === 'stand' && a.wantFacing == null && Math.abs(a.facing) < 2.9) a.lookAt(p.x, p.z + 5);   // 다시 앞(남쪽)을 본다
      }
      a.update(dt, pd < 30);
    }
    // 밤톨 영업시간
    if (now && !intro.pending) {
      const open = isOpen(now.hour);
      if (B.mode === 'stand' && !open) { B.mode = 'inside'; B.actor.fade(0, 0.8); town.sfxAt('door', shopDoor, 0.5); }
      else if (B.mode === 'inside' && open) { B.mode = 'stand'; B.actor.place(B.spot.x, B.spot.z, Math.PI); B.actor.fade(1, 0.8); town.sfxAt('door', shopDoor, 0.5); }
    }
    // 첫날: 선착장 가까이 오면 밤톨이 먼저 말을 건다
    if (intro.pending && !intro.running && pl && !ctx.services.ui?.isBlocking?.()) {
      intro.idle += dt;
      if (intro.heard) intro.wait -= dt;
      if ((intro.wait <= 0 || intro.idle > 12) && Math.hypot(pl.x - B.actor.position.x, pl.z - B.actor.position.z) < 5) town.conversation(B, introFlow);
    }
  }

  // ---- 첫날 안내 ----
  async function introFlow() {
    if (intro.running || !intro.pending) return;
    intro.running = true;
    try {
      const say = speaker(ctx, B.person);
      B.happy();
      await say(LB.intro.hello);
      for (;;) {
        const a = await say(ctx.input?.touch ? LB.intro.touch : LB.intro.keys, ['알겠어요!', '한 번 더 들을래요']);
        if (a !== 1) break;
      }
      await say(LB.intro.after);
      ctx.state.flags ??= {};
      ctx.state.flags.intro = true;
      intro.pending = false;
      ctx.events.emit('town:intro', { done: true });
      town.mail?.post('bamtol', 'welcome');
      // 가게로 걸어간다 (길이 없으면 그냥 옮긴다)
      const pts = town.route(B.actor.position, B.spot);
      if (pts) { B.actor.setPath(pts); B.mode = 'walk'; B.prev = 'walk'; }
      else { B.actor.place(B.spot.x, B.spot.z, Math.PI); B.mode = 'stand'; B.prev = 'stand'; }
    } finally { intro.running = false; }
  }

  // ---- 도토리상점 ----
  async function shopFlow() {
    const c = context(ctx), d = ctx.services.data, ui = ctx.services.ui;
    const furn = (d?.economy?.stockGroups?.()?.furniture ?? []).map(id => d.items.get(id)?.name).filter(Boolean);
    const say = speaker(ctx, B.person, { furn: furn.join('랑 ') || '가구' });
    if (!isOpen(c.now.hour) || B.mode === 'inside') {
      ctx.events.emit('sfx', { name: 'door', volume: 0.5 });
      await say(pickLines(c.slot === 'dawn' || c.now.hour < 8 && c.now.hour >= 5 ? LB.closed.early : LB.closed.night, r, B.recent));
      return;
    }
    const greet = [...pickLines(LB.greet[c.slot] ?? LB.greet.morning, r, B.recent)];
    if (furn.length && r() < 0.45) greet.push(...pickLines(LB.today, r, B.recent));
    else if (r() < 0.3) greet.push(...pickLines(LB.chat, r, B.recent));
    const a = await say(greet, ['살래요', '팔래요', '그냥 구경할게요']);
    if (a === 0 || a === 1) {
      await ui.shop.open({ stock: d.economy.stock(), tab: a === 1 ? 'sell' : 'buy', keeper: B.person.name, color: B.person.color });
      await say(pickLines(LB.after, r, B.recent));
    } else await say(pickLines(LB.bye, r, B.recent));
  }

  // ---- 박물관 ----
  async function museumFlow() {
    const c = context(ctx), d = ctx.services.data, ui = ctx.services.ui;
    const flags = (ctx.state.flags ??= {});
    const vars = {};
    const say = speaker(ctx, N.person, vars);
    const firstVisit = !flags.museumVisit;
    flags.museumVisit = true;
    const greet = firstVisit ? LN.firstVisit : pickLines(LN.greet[c.slot] ?? LN.greet.morning, r, N.recent);
    const a = await say(greet, ['기증하러 왔어요', '이야기 들려주세요', '다음에 올게요']);
    if (a === 0) {
      const before = d.museum.progress();
      const got = [];
      const off = ctx.events.on('museum:changed', ({ id } = {}) => { if (id) got.push(id); });
      try { await ui.museum.open({ keeper: N.person.name, color: N.person.color }); } finally { off(); }
      await donationTalk(got, before, d.museum.progress(), say, vars);
    } else if (a === 1) await story(say, vars);
    else await say(pickLines(LN.bye, r, N.recent));
  }

  async function donationTalk(got, before, after, say, vars) {
    const d = ctx.services.data;
    if (!got.length) { await say(pickLines(LN.none, r, N.recent)); return; }
    const flags = ctx.state.flags;
    vars.item = d.items.get(got[0])?.name ?? '';
    vars.n = got.length;
    N.happy();
    if (before.total[0] === 0) await say(LN.firstDonation);
    else await say(pickLines(got.length > 1 ? LN.thanksMany : LN.thanks, r, N.recent));
    if (got.some(id => d.items.get(id)?.category === 'fossil')) await say(pickLines(LN.fossil, r, N.recent));
    for (const m of MILESTONES) if (before.total[0] < m && after.total[0] >= m) { vars.n = m; await say(LN.milestone[m] ?? pickLines(LN.milestoneAny, r)); }
    for (const cat of Object.keys(CAT_KO)) {
      const [b] = before[cat], [n, t] = after[cat];
      if (b < t && n >= t) { vars.cat = CAT_KO[cat]; await say(LN.complete[cat]); }
    }
    if (after.complete && !flags.museumReward) {
      flags.museumReward = true;
      N.happy();
      await say(LN.allComplete);
      const left = giveItem(ctx, 'furn.dino-model');
      if (left > 0) { flags.museumReward = false; await say(LN.bagFull); }
    }
  }

  async function story(say, vars) {
    const d = ctx.services.data;
    const given = ['fossil', 'fish', 'bug'].flatMap(cat => d?.museum?.list?.(cat) ?? []);
    if (!given.length) { await say(pickLines(LN.story.empty, r, N.recent)); return; }
    const it = d.items.get(given[Math.floor(r() * given.length)]);
    vars.item = it.name;
    await say([...pickLines(LN.story.open, r), it.desc, ...pickLines(LN.story.close, r, N.recent)]);
  }

  // ---- 행동 키 ----
  const near = (pt, dist) => {
    const pl = ctx.services.player?.position;
    return !!pl && !!pt && Math.hypot(pl.x - pt.x, pl.z - pt.z) < dist && Math.abs((pl.y ?? 0) - world.island.heightAt(pt.x, pt.z)) < 0.7;
  };
  /** 플레이어가 그쪽을 보고 있나 (가까우면 상관없음) */
  const facingTo = (pt, loose = 0.75) => {
    const pl = ctx.services.player;
    const dx = pt.x - pl.position.x, dz = pt.z - pl.position.z, d = Math.hypot(dx, dz) || 1;
    return d < loose || (-Math.sin(pl.facing) * dx - Math.cos(pl.facing) * dz) / d > 0.2;
  };
  function register(gp) {
    const offs = [];
    offs.push(gp.add({
      name: 'town:intro', intent: 'action', priority: 100,
      test: () => (intro.pending && !intro.running && near(B.actor.position, 2.2) ? B : null),
      run: () => town.conversation(B, introFlow),
    }));
    offs.push(gp.add({
      name: 'town:shop', intent: 'action', priority: 90,
      test: () => {
        if (intro.pending || !places.shop) return null;
        if (near(shopDoor, DOOR_DIST) && facingTo(shopDoor)) return 'door';
        if (B.talkable && B.mode !== 'walk' && near(B.actor.position, KEEPER_DIST) && facingTo(B.actor.position)) return 'keeper';
        return null;
      },
      run: () => town.conversation(B, shopFlow, { face: B.mode !== 'inside' }),
    }));
    offs.push(gp.add({
      name: 'town:museum', intent: 'action', priority: 90,
      test: () => {
        if (!places.museum) return null;
        if (near(museumDoor, DOOR_DIST) && facingTo(museumDoor)) return 'door';
        if (N.talkable && near(N.actor.position, KEEPER_DIST) && facingTo(N.actor.position)) return 'keeper';
        return null;
      },
      run: () => town.conversation(N, museumFlow),
    }));
    return () => offs.forEach(f => f());
  }

  return { all, bamtol: B, neuru: N, intro, update, register, flows: { introFlow, shopFlow, museumFlow } };
}
