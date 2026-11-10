// 주민과 대화: 인사 → 잡담 / 부탁 있어? / 선물 주기 / 잘 가. 친밀도·부탁·선물·답례는 rules.js, 대사는 lines/.
// 5차 Z5: 기본은 이모티콘 대화 (festival 모듈의 session — say 의 뒤 두 인자가 말풍선·고르기 이모티콘). 섬폰 "주민 글 대사 보기" 를 켜면 글 대화.
// 5차 생일(party.js): 주민 생일엔 생일 인사·케이크 한 번·선물 친밀도 3배, 플레이어 생일엔 그날 처음 말 걸 때 축하.
import { BIRTHDAY_GIFT_MULT } from '../../data/birthdays.js';
import {
  villagerState, tierOf, dailyTalk, addFriendship, greetingLines, chatLines, pickLines, fill, slotOf,
  makeRequest, matchesRequest, currentRequest, requestReward, receiveGift, giftBack, surpriseGift,
  REQUEST_POINTS, FRIEND_MAX, josa, noteBond,
} from './rules.js';

export const MENU = ['잡담', '부탁 있어?', '선물 주기', '잘 가'];
const TIER_NAME = { known: '아는 사이', friend: '친구', close: '단짝', best: '절친' };

/** 지금 시각·날씨·계절 (time 서비스가 없으면 브라우저 시계) */
export function context(ctx) {
  const time = ctx.services.time;
  const d = new Date();
  const now = time?.now?.() ?? { hour: d.getHours(), minute: d.getMinutes(), month: d.getMonth() + 1, dayKey: d.toISOString().slice(0, 10) };
  return {
    now,
    weather: time?.weather ?? 'clear',
    season: now.season ?? ctx.constants.seasonOf(now.month),
    dayKey: now.dayKey ?? ctx.services.data?.day?.key?.(),
    slot: slotOf(now),
    event: eventToday(ctx),
  };
}

/** 오늘 열린 계절 행사 id (행사 기간 안 · 첫 섬 축제 뒤, 8차 M8) — 주민 대사 lines.event[id] 를 고른다. 없으면 null */
function eventToday(ctx) {
  const E = ctx.services.events;
  try { return E?.isOpen?.() ? E.active?.()[0]?.ev.id ?? null : null; } catch { return null; }
}

/** 말하는 사람 하나에 묶인 대화창 열기 */
export function speaker(ctx, who, vars = {}) {
  return (lines, choices) => {
    const list = [lines].flat().filter(l => l != null && l !== '').map(l => fill(l, vars));
    if (!list.length && !choices) return Promise.resolve(null);
    return ctx.services.ui.dialog.open({ speaker: who.name, color: who.color, lines: list, voice: who.voice ?? who.slug, choices });
  };
}

/** 물건 받기 (data.collect: 도토리 주머니는 지갑으로). opts.variant = 가방 칸 변형 (주민 사진의 주민 slug). 다 못 받았으면 남은 수 */
export function giveItem(ctx, id, n = 1, opts = {}) {
  const data = ctx.services.data, ui = ctx.services.ui;
  const it = data?.items?.get?.(id);
  if (!data || !it) return n;
  const res = data.collect(id, n, opts.variant ? { variant: opts.variant } : undefined);
  if (res.acorns > 0) {
    ui.toast(`도토리 ${res.acorns.toLocaleString('ko-KR')}개를 받았어요`, '🌰');
    ctx.events.emit('sfx', { name: 'acorn' });
  } else if (res.added > 0) {
    try { ctx.services.player?.act?.('pickup', { lock: false })?.catch?.(() => {}); } catch { /* 동작이 없어도 괜찮다 */ }
    ui.toast(`${josa(res.added > 1 ? `${it.name} ${res.added}개` : it.name, '을')} 받았어요`, it.icon);
    ctx.events.emit('sfx', { name: 'pickup' });
  }
  return res.left;
}

export function createTalk(ctx, { lines, party = null }) {
  const data = () => ctx.services.data;
  const ui = () => ctx.services.ui;
  const itemName = id => data()?.items?.get?.(id)?.name ?? id;

  /** 가방에서 부탁에 맞는 첫 칸 (없으면 -1) */
  const findMatch = req => (data()?.inventory?.slots ?? []).findIndex(s => s && matchesRequest(req, data().items.get(s.id)));

  /** 5차 Z5 이모티콘 대화 (festival 모듈, 섬폰 '주민 글 대사 보기' 가 꺼져 있을 때) — say(글, 선택지, 이모티콘, 선택지 이모티콘) 을 말풍선으로 */
  const emoteSession = V => (ctx.services.festival?.emote?.on?.() ? ctx.services.festival.emote.session(V) : null);

  async function converse(V) {
    const E = emoteSession(V);
    try { await converseWith(V, E); } finally { E?.close(); }
  }

  async function converseWith(V, E) {
    const P = V.person, L = lines[V.slug];
    const c = context(ctx);
    const v = villagerState(ctx.state, V.slug);
    const r = Math.random;
    const recent = (V.recent ??= []);
    const vars = {};
    const say = E ? E.say : speaker(ctx, P, vars);   // 글 대화는 뒤의 두 인자(이모티콘)를 쓰지 않는다
    const ups = [];
    const note = up => { if (up) ups.push(up); };
    /** 친밀도 단계가 올랐을 때 한마디 + 알림 */
    const tierUp = up => {
      V.happy();
      if (TIER_NAME[up]) ui().toast(`${josa(P.name, '와')} ${josa(TIER_NAME[up], '이')} 되었어요`, '💛');
      return pickLines(L.tierUp?.[up], r);
    };

    const first = !v.met;
    v.met = true;
    const daily = dailyTalk(v, c.dayKey);
    // M12 타로 「친구」(D112-A): 그날 처음 말 건 주민 마음 + (night 서비스가 하루 한 번만 내준다)
    if (daily.first) { const extra = ctx.services.night?.claimFriend?.(V.slug) ?? 0; if (extra > 0) { const fu = addFriendship(v, extra).up; daily.up ??= fu; } }
    const cc = { ...c, tier: tierOf(v.friendship), r, recent };
    const B = L.birthday;
    const bday = !!(B && party?.isBirthday(V.slug, c.dayKey));

    // 인사 (처음 만나면 자기소개, 집에 가던 길이면 그 얘기)
    let greet;
    if (first) greet = bday ? [...L.intro, ...pickLines(B.self, r, recent)] : L.intro.slice();
    else if (V.talkFrom === 'toDoor') greet = [...pickLines(L.greet[c.slot] ?? L.greet.evening, r, recent), ...pickLines(L.goingHome, r, recent)];
    else if (V.chatWith && L.chatting) { vars.other = V.chatWith.person.name; greet = pickLines(L.chatting, r, recent); }
    else if (bday && daily.first) greet = pickLines(B.self, r, recent);
    else greet = greetingLines(L, cc);
    V.chatWith = null;
    let gE = E ? E.greet({ first, bday: bday && (first || daily.first) }) : [];   // 인사 이모티콘
    // 플레이어 생일: 그날 처음 말 걸면 축하 한마디
    if (B && v.cheerDay !== c.dayKey && party?.isPlayerBirthday(c.dayKey)) {
      v.cheerDay = c.dayKey;
      greet.push(...pickLines(B.player, r, recent));
      gE = ['party', 'heart', gE[0]];
      V.happy();
    }
    if (daily.up) { greet.push(...tierUp(daily.up)); gE = [...gE.slice(0, 2), 'heart']; }   // 말 걸기 보너스로 단계가 올랐으면 인사에 붙인다

    // 자기 생일: 파티 케이크를 한 번 나눠 준다 (케이크 가구가 아이템 사전에 있을 때)
    const cake = bday && v.cakeDay !== c.dayKey ? party.cake() : null;
    if (cake) {
      v.cakeDay = c.dayKey;
      vars.item = itemName(cake);
      await say([...greet, ...pickLines(B.cake, r)], null, [gE[0], 'party', 'gift']);
      greet = []; gE = [];
      V.happy();
      const left = giveItem(ctx, cake);
      if (left > 0) { giveLater(v, cake, left); await say(pickLines(L.gift.full, r), null, ['sweat', 'gift']); }
    }

    // 지난번에 가방이 꽉 차서 못 준 물건 (항목은 id 또는 { id, variant })
    if (v.pending.length) {
      const entry = p => (typeof p === 'string' ? { id: p } : p);
      vars.item = itemName(entry(v.pending[0]).id);
      await say([...greet, ...pickLines(L.gift.pending, r)], null, [gE[0], 'gift', 'smile']);
      greet = []; gE = [];
      const left = [];
      for (const p of v.pending) { const e = entry(p); if (giveItem(ctx, e.id, 1, e) > 0) left.push(p); }
      v.pending = left;
    }
    // 친해지면 가끔 먼저 선물
    if (daily.first && !first) {
      const id = surpriseGift(v, P, c.dayKey, r);
      if (id) {
        vars.item = itemName(id);
        await say([...greet, ...pickLines(L.gift.surprise, r, recent)], null, [gE[0], 'gift', 'heart']);
        greet = []; gE = [];
        V.happy();
        const left = giveItem(ctx, id);
        if (left > 0) { giveLater(v, id, left); await say(pickLines(L.gift.full, r), null, ['sweat', 'gift']); }
      }
    }

    // 말 걸기만으로 친밀도가 꽉 찼으면 사진은 인사 때 준다
    if (v.friendship >= FRIEND_MAX && !v.photo) { await givePhoto(greet); greet = []; gE = []; }

    if (E) {
      // 이모티콘 대화: 인사 말풍선 뒤 플레이어가 자유롭게 보낸다 (🎁 하나 = 선물, ❓ 하나 = 부탁 있어?)
      if (gE.length) await say(greet, null, gE);
      await E.chat({
        gift: giftFlow, request: requestFlow, note,
        things: () => { const q = currentRequest(v, c.dayKey); return q ? [E.reqToken(q)] : []; },
        festival: ctx.services.festival?.ask ? () => ctx.services.festival.ask(V, E) : null,
      });
    } else {
      const choice = await say(greet.length ? greet : pickLines(L.menu, r, recent), MENU);
      if (choice === 0) await say(chatLines(L, { ...cc, tier: tierOf(v.friendship) }));
      else if (choice === 1) await requestFlow();
      else if (choice === 2) await giftFlow();
      else await say(pickLines(L.bye, r, recent));
    }

    // 부탁·선물로 단계가 올랐으면 한마디, 친밀도 최고면 사진 한 번
    if (ups.length) await say(tierUp(ups.at(-1)), null, ['heart', 'sparkle']);
    if (v.friendship >= FRIEND_MAX && !v.photo) await givePhoto([]);

    async function givePhoto(before) {
      v.photo = true;
      vars.item = itemName('furn.villager-photo');
      V.happy();
      await say([...before, ...L.photo], null, ['love', 'sparkle', 'gift']);
      // 사진 변형 = 주민 slug (집에 놓으면 그 주민 사진이 걸린다)
      const left = giveItem(ctx, 'furn.villager-photo', 1, { variant: V.slug });
      if (left > 0) { v.pending.push({ id: 'furn.villager-photo', variant: V.slug }); await say(pickLines(L.gift.full, r), null, ['sweat', 'gift']); }
    }

    // ---- 부탁 ----
    async function requestFlow() {
      const req = currentRequest(v, c.dayKey);
      if (req) {
        vars.want = req.label;
        const t = E?.reqToken(req);
        if (findMatch(req) >= 0) {
          const a = await say(pickLines(L.request.remind, r, recent), ['여기 있어!', '아직이야'], ['bubble', t, 'ask'], [['good', t], ['wait']]);
          const slot = a === 0 ? await pickForRequest(req) : null;
          if (slot != null) await completeRequest(slot, req);
          else await say(pickLines(L.request.notYet, r, recent), null, ['smile', 'wait']);
        } else await say([...pickLines(L.request.remind, r, recent), ...pickLines(L.request.notYet, r, recent)], null, ['bubble', t, 'wait']);
        return;
      }
      if (v.doneDay === c.dayKey) { await say(pickLines(L.request.done, r, recent), null, ['smile', 'good']); return; }
      const d = data();
      const nreq = makeRequest(P, { dayKey: c.dayKey, items: d?.items, nativeFruit: d?.economy?.nativeFruit?.() });
      vars.want = nreq.label;
      const a = await say(pickLines(L.request.ask, r, recent), ['좋아, 구해 올게!', '이번엔 어려워'], ['bubble', E?.reqToken(nreq), 'ask'], [['good'], ['sad']]);
      if (a === 0) {
        v.request = nreq;
        await say(pickLines(L.request.accept, r, recent), null, ['grin', 'good']);
        ui().toast(`${P.name}의 부탁: ${nreq.label}`, '📝');
      } else await say(pickLines(L.request.decline, r, recent), null, ['smile', 'dots']);
    }

    function pickForRequest(req) {
      return ui().bag.open({
        mode: 'pick', title: `${P.name}의 부탁`, hint: `${req.label}${req.id ? '' : ' 아무거나'} 골라 주세요`,
        filter: s => matchesRequest(req, data().items.get(s.id)),
      });
    }

    async function completeRequest(slot, req) {
      const d = data();
      const s = d.inventory.slots[slot];
      const item = s && d.items.get(s.id);
      if (!item || !matchesRequest(req, item)) return;
      d.inventory.remove(slot, 1);
      v.request = null;
      v.doneDay = c.dayKey;
      noteBond(v, 'favor', c.dayKey);
      note(addFriendship(v, REQUEST_POINTS).up);
      vars.item = item.name;
      V.happy();
      ctx.events.emit('sfx', { name: 'pickup' });
      await say(pickLines(L.request.thanks, r, recent), null, ['love', 'sparkle']);
      const rw = requestReward(P, item, r);
      vars.reward = rw.id === 'mat.acorn-bag' ? `도토리 ${(rw.n * 100).toLocaleString('ko-KR')}개` : itemName(rw.id);
      await say(pickLines(L.request.reward, r, recent), null, ['gift', `item:${rw.id}`]);
      const left = giveItem(ctx, rw.id, rw.n);
      if (left > 0 && rw.id !== 'mat.acorn-bag') { giveLater(v, rw.id, left); vars.item = itemName(rw.id); await say(pickLines(L.gift.full, r), null, ['sweat', 'gift']); }
    }

    // ---- 선물 ----
    async function giftFlow() {
      const d = data();
      const slot = await ui().bag.open({
        mode: 'pick', title: `${P.name}에게 선물`, hint: '줄 물건을 골라 주세요 (도구는 못 줘요)',
        filter: s => d.items.get(s.id)?.category !== 'tool',
      });
      if (slot == null) { await say(pickLines(L.gift.cancel, r, recent), null, ['smile', 'dots']); return; }
      const s = d.inventory.slots[slot];
      const item = s && d.items.get(s.id);
      if (!item) return;
      const req = currentRequest(v, c.dayKey);
      if (req && matchesRequest(req, item)) { vars.want = req.label; await completeRequest(slot, req); return; }
      d.inventory.remove(slot, 1);
      ctx.events.emit('sfx', { name: 'pickup' });
      const res = receiveGift(v, P, item, c.dayKey, bday ? BIRTHDAY_GIFT_MULT : 1);
      note(res.up);
      vars.item = item.name;
      if (res.reaction === 'love' || res.reaction === 'like' || bday) V.happy();
      const said = pickLines(v.giftsToday > 3 ? L.gift.many : L.gift[res.reaction], r, recent);
      if (bday && res.reaction !== 'dislike' && v.giftsToday <= 3) said.push(...pickLines(B.gift, r, recent));   // 생일 선물은 더 기뻐한다
      const saidE = v.giftsToday > 3 ? ['sweat', 'gift'] : { love: ['love', 'sparkle'], like: ['grin', 'heart'], normal: ['smile'], dislike: ['sweat', 'dots'] }[res.reaction] ?? ['smile'];
      await say(said, null, bday && res.reaction !== 'dislike' ? [...saidE.slice(0, 2), 'party'] : saidE);
      const back = giftBack(v, P, res.reaction, c.dayKey, r);
      if (back) {
        vars.item = itemName(back);
        await say(pickLines(L.gift.back, r, recent), null, ['gift', `item:${back}`]);
        const left = giveItem(ctx, back);
        if (left > 0) { giveLater(v, back, left); await say(pickLines(L.gift.full, r), null, ['sweat', 'gift']); }
      }
    }
  }

  /** 집에 있는 주민 문 두드리기 (생일인 낮엔 문 너머로 불러들이고 생일 대화) */
  async function knock(V) {
    const L = lines[V.slug];
    const c = context(ctx);
    const late = c.slot === 'night' || c.slot === 'dawn';
    /** 문 너머 한마디 (이모티콘 대화면 말풍선) */
    const through = async (pool, emotes) => {
      const E = emoteSession(V);
      if (!E) { await speaker(ctx, V.person)(pickLines(pool, Math.random)); return; }
      try { await E.say(null, null, emotes); } finally { E.close(); }
    };
    if (!late && L.birthday && party?.isBirthday(V.slug, c.dayKey)) {
      ctx.events.emit('sfx', { name: 'door', volume: 0.5 });
      await through(L.birthday.door, ['party', 'gift']);
      await converse(V);
      return;
    }
    const wet = c.weather === 'snow' || c.weather === 'rain';
    const pool = late ? L.home.sleep : c.weather === 'snow' ? L.home.snow ?? L.home.rain : c.weather === 'rain' ? L.home.rain : L.home.day;
    ctx.events.emit('sfx', { name: 'door', volume: 0.5 });
    await through(pool, late ? ['zz', 'moon'] : wet ? [c.weather === 'snow' ? 'sparkle' : 'rain', 'smile'] : ['wave', 'smile']);
  }

  return { converse, knock };
}

function giveLater(v, id, left) {
  for (let i = 0; i < left; i++) v.pending.push(id);
}

