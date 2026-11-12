// M18-P4 미술품 주고받기 (15차 검수 보드 wave15 D195-A, concept/wave15-board.html).
// 주에 한두 번(월요일 시작 주, 섬 씨앗·날짜로 늘 같음) 친구 이상 주민 하나가 「○○ 보고 싶어요」 하고 작품 하나를 바란다.
//  - 보여 주기: 가방에 그 진품이 있으면 → 친밀도 +show (작품은 그대로)
//  - 바꿔 주기: 진품을 건네면 → 친밀도 +trade + 가구 하나 (주민 선물 표 → 없으면 상점·제작 가구 중 하나), 주민이 그 작품을 간직한다 (v.arts)
//  - 가품만 있으면 주민이 「조금 다른 것 같아요」 하고 받지 않는다. 바라는 마음은 days 일 동안 남는다 (그 뒤 잊음).
// 대사는 주민 파일 lines.art (ask · remind · show · trade · reward · fake · notYet · later) — 자리 {art} = 작품 이름 (traits.js PLACEHOLDERS).
// 규칙(순수)은 위쪽 함수들 (tests/seasonal.test.mjs 가 Node 에서 돌린다), 대화는 talk.js 가 artStep 을 부른다.
import { rngOf, weekdayOf, addDays, daysBetween } from '../daily/rules.js';

/** 숫자 (바꾸면 노트 m18-p4-seasonal.md 표도) */
export const ART_WISH = {
  twoChance: 0.4,      // 그 주에 두 번일 확률
  minFriendship: 30,   // 친구 이상 (rules.json town.tiers friend)
  days: 3,             // 바라는 마음이 남는 날 수 (그날 포함)
  show: 4,             // 보여 주면 친밀도
  trade: 10,           // 바꿔 주면 친밀도 (+ 가구 하나)
  ownedChance: 0.7,    // 플레이어가 가진 작품이 있으면 그중에서 고를 확률
};

/** 그 주(월요일 시작)의 미술품 부탁 날 — 1~2 번, 서로 이틀 넘게 떨어진 요일 */
export function artWishDays(dayKey, seed, cfg = ART_WISH) {
  const wd = (weekdayOf(dayKey) + 6) % 7;
  const monday = addDays(dayKey, -wd);
  const r = rngOf('art-wish', monday, seed);
  const n = r() < (cfg.twoChance ?? 0.4) ? 2 : 1;
  const out = [];
  for (let guard = 0; out.length < n && guard < 40; guard++) {
    const d = Math.floor(r() * 7);
    if (out.every(o => Math.abs(o - d) > 1)) out.push(d);
  }
  return out.sort((a, b) => a - b).map(d => addDays(monday, d));
}

/**
 * 오늘 누가 무엇을 바라나 → { slug, id } | null.
 * friends = 친구 이상 주민 slug (주민 순서), works = 진품 미술품 id 전부, owned = 플레이어 가방에 있는 진품 id
 */
export function pickArtWish(dayKey, seed, { friends = [], works = [], owned = [] } = {}, cfg = ART_WISH) {
  if (!friends.length || !works.length || !artWishDays(dayKey, seed, cfg).includes(dayKey)) return null;
  const r = rngOf('art-wish-pick', dayKey, seed);
  const slug = friends[Math.floor(r() * friends.length)];
  const mine = owned.filter(id => works.includes(id));
  const pool = mine.length && r() < (cfg.ownedChance ?? 0.7) ? mine : works;
  return { slug, id: pool[Math.floor(r() * pool.length)] };
}

/** 바라는 마음이 아직 남았나 (wish = { id, day, done? }) */
export const wishLive = (wish, dayKey, cfg = ART_WISH) => !!wish && !wish.done && daysBetween(wish.day, dayKey) < (cfg.days ?? 3) && daysBetween(wish.day, dayKey) >= 0;

/** 바꿔 준 답례 가구: 주민 선물 표의 가구 → 없으면 상점·제작 가구 중 하나 (같은 날 같은 주민이면 같다) */
export function tradeReward(person, furniture, dayKey, seed = 0) {
  const r = rngOf('art-trade', person?.slug ?? '', dayKey, seed);
  const own = (person?.gifts ?? []).map(g => g.id).filter(id => typeof id === 'string' && id.startsWith('furn.'));
  const pool = own.length ? own : furniture.filter(f => f.source === 'shop' || f.source === 'craft').map(f => f.id);
  return pool.length ? pool[Math.floor(r() * pool.length)] : null;
}

/**
 * 대화 한 단계 (talk.js converseWith 안, 인사 뒤 · 메뉴 앞): 오늘 이 주민이 바라는 작품이 있으면 말하고 보여 주기/바꿔 주기.
 * K = { ctx, V, v, L, say, vars, r, recent, note, addFriendship, pickLines, giveItem, giveLater, E, dayKey } → 무언가 말했으면 true
 */
export async function artStep(K) {
  const { ctx, V, v, L, say, vars, r, recent, note, addFriendship, pickLines, giveItem, giveLater, E, dayKey } = K;
  const A = L.art;
  const svc = ctx.services.town?.art;
  if (!A || !svc) return false;
  // 오늘의 부탁이 이 주민이면 마음에 새긴다 (그날 한 번)
  const today = svc.today();
  if (today?.slug === V.slug && v.artWish?.day !== dayKey && !(v.artWish && wishLive(v.artWish, dayKey))) v.artWish = { id: today.id, day: dayKey };
  const wish = v.artWish;
  if (!wishLive(wish, dayKey)) return false;
  if (wish.toldDay === dayKey) return false;   // 하루에 한 번만 꺼낸다
  const d = ctx.services.data;
  const it = d?.items?.get?.(wish.id);
  if (!it) return false;
  vars.art = it.name;
  vars.item = it.name;
  const first = !wish.asked;
  wish.asked = true; wish.toldDay = dayKey;
  const token = `item:${wish.id}`;
  const has = (d.inventory?.count?.(wish.id) ?? 0) > 0;
  const fake = !has && (d.inventory?.count?.(`${wish.id}-fake`) ?? 0) > 0;
  ctx.events.emit('town:art', { slug: V.slug, id: wish.id, kind: first ? 'ask' : 'remind' });
  if (!has) {
    await say([...pickLines(first ? A.ask : A.remind, r, recent), ...pickLines(fake ? A.fake : A.notYet, r, recent)], null, ['bubble', token, fake ? 'dots' : 'wait']);
    if (fake) ctx.events.emit('town:art', { slug: V.slug, id: wish.id, kind: 'fake' });
    return true;
  }
  const a = await say(pickLines(first ? A.ask : A.remind, r, recent), ['보여 줄게요', '바꿔 줄게요', '다음에요'], ['bubble', token, 'ask'], [['look', token], ['gift', token], ['wait']]);
  if (a === 0) {
    wish.done = 'show';
    note(addFriendship(v, ART_WISH.show).up);
    V.happy();
    await say(pickLines(A.show, r, recent), null, ['love', 'sparkle']);
    ctx.events.emit('town:art', { slug: V.slug, id: wish.id, kind: 'show' });
  } else if (a === 1) {
    if (!(d.inventory.removeId(wish.id, 1) > 0)) return true;
    wish.done = 'trade';
    (v.arts ??= []).push(wish.id);
    note(addFriendship(v, ART_WISH.trade).up);
    V.happy();
    ctx.events.emit('sfx', { name: 'pickup' });
    await say(pickLines(A.trade, r, recent), null, ['love', 'gift', 'sparkle']);
    const furn = tradeReward(V.person, d.items.list?.('furn') ?? [], dayKey, ctx.state.island?.seed ?? 0);
    if (furn) {
      vars.reward = d.items.get(furn)?.name ?? furn;
      await say(pickLines(A.reward, r, recent), null, ['gift', `item:${furn}`]);
      const left = giveItem(ctx, furn);
      if (left > 0) { giveLater(v, furn, left); vars.item = vars.reward; await say(pickLines(L.gift.full, r), null, ['sweat', 'gift']); }
    }
    ctx.events.emit('town:art', { slug: V.slug, id: wish.id, kind: 'trade', reward: furn });
  } else {
    await say(pickLines(A.later, r, recent), null, ['smile', 'wait']);
  }
  return true;
}

/**
 * town 서비스 칸 town.art: 오늘의 부탁을 정한다 (state.town.artWish = { day, slug, id } — 하루 한 번 계산해 둔다).
 * residents() = 지금 섬 주민 slug, people = { slug: person }
 */
export function createArtWish(ctx, { residents, people, lines }) {
  const S = () => ctx.services;
  const owned = () => {
    const inv = S().data?.inventory;
    const ids = new Set((inv?.slots ?? []).filter(Boolean).map(s => s.id));
    return [...ids].filter(id => id.startsWith('art.') && !id.endsWith('-fake'));
  };
  function today() {
    const n = S().time?.now?.();
    if (!n) return null;
    const t = (ctx.state.town ??= {});
    if (t.artWish?.day === n.dayKey) return t.artWish.slug ? t.artWish : null;
    const works = (S().data?.items?.list?.('art') ?? []).map(a => a.id);
    const friends = residents().filter(s => people[s]?.role !== 'keeper' && lines[s]?.art && (ctx.state.villagers?.[s]?.friendship ?? 0) >= ART_WISH.minFriendship);
    const w = pickArtWish(n.dayKey, ctx.state.island?.seed ?? 0, { friends, works, owned: owned() });
    t.artWish = { day: n.dayKey, ...(w ?? {}) };
    return w;
  }
  return {
    today,
    /** 주민마다 지금 바라는 작품 { slug: { id, day, done } } (점검·봇) */
    wishes: () => Object.fromEntries(residents().map(s => [s, ctx.state.villagers?.[s]?.artWish ?? null]).filter(([, w]) => w)),
    config: ART_WISH,
  };
}
