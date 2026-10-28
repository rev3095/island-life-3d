// 우편함: 친해진 주민이 아침마다 가끔 편지(와 선물)를 보낸다. 부탁을 들어주면 며칠 안에 고맙다는 편지.
// 플레이어 집 우편함 앞에서 행동 키로 읽는다. 상태는 state.mail = { list:[편지], day, nextId }.
import { planLetters, pickLines, villagerState, rngOf } from './rules.js';
import { speaker, giveItem, context } from './talk.js';
import { PEOPLE, KEEPERS } from './people.js';

const KEEP = 30;              // 읽은 편지는 이만큼만 남긴다
const BOX = { name: '', color: '#C9A27A', voice: '' };

export function createMail(ctx, { lines }) {
  const world = ctx.services.world;
  const box = () => {
    const m = (ctx.state.mail ??= {});
    if (!Array.isArray(m.list)) m.list = [];
    m.day ??= null;
    m.nextId ??= 1;
    return m;
  };
  // 플레이어 집 우편함 자리 (world 가 집 문 오른쪽에 놓는다)
  const spot = (() => {
    const o = world.objects.list?.('mailbox')?.find(m => m.data?.owner === 'player');
    if (o) return { x: o.x, z: o.z };
    const h = world.places.playerHouse;
    return h ? { x: h.door.x + 1, z: h.door.z } : null;
  })();
  const who = slug => PEOPLE[slug] ?? KEEPERS[slug];
  const itemName = id => ctx.services.data?.items?.get?.(id)?.name ?? id;

  /** 편지 한 통 넣기 (kind = 대사 묶음 letters 의 키) */
  function post(from, kind, gift = null) {
    const m = box();
    const pool = lines[from]?.letters?.[kind];
    if (!pool?.length || !who(from)) return null;
    const letter = { id: m.nextId++, from, kind, day: context(ctx).dayKey, lines: pickLines(pool, rngOf(m.nextId, from, kind)), gift, read: false };
    m.list.push(letter);
    while (m.list.length > KEEP) { const i = m.list.findIndex(l => l.read); if (i < 0) break; m.list.splice(i, 1); }
    ctx.events.emit('mail:new', { from, kind });
    return letter;
  }

  /** 그날 아침 편지 배달 (하루 한 번, 첫날 안내 뒤부터) → 넣은 수 */
  function deliver(dayKey = context(ctx).dayKey) {
    const m = box();
    if (!dayKey || m.day === dayKey) return 0;
    m.day = dayKey;
    if (!ctx.state.flags?.intro) return 0;
    let n = 0;
    for (const p of planLetters(ctx.state, PEOPLE, dayKey)) {
      if (p.mark) villagerState(ctx.state, p.from).thankedDay = p.mark;
      if (post(p.from, p.kind, p.gift)) n++;
    }
    return n;
  }

  const unread = () => box().list.filter(l => !l.read);

  /** 우편함 열기: 안 읽은 편지를 차례로 읽고 붙은 선물을 받는다 */
  async function read() {
    const list = unread();
    const say = speaker(ctx, BOX);
    ctx.events.emit('sfx', { name: 'bag-open', volume: 0.6 });
    if (!list.length) { await say(['(우편함이 비어 있다.)']); return; }
    await say([`(편지가 ${list.length}통 와 있다.)`]);
    for (const l of list) {
      const P = who(l.from);
      const vars = { item: l.gift ? itemName(l.gift) : '' };
      const text = [...l.lines];
      if (l.gift && !l.stub) text.push(...pickLines(lines[l.from]?.letters?.gift, Math.random), '(편지에 {item:이} 들어 있다!)');
      await speaker(ctx, { name: P ? `${P.name}의 편지` : '편지', color: P?.color ?? BOX.color, voice: '' }, vars)(text);
      l.read = true;
      if (!l.gift) continue;
      if (giveItem(ctx, l.gift) > 0) {
        // 가방이 꽉 찼으면 선물만 남은 쪽지로 남겨 둔다
        Object.assign(l, { read: false, stub: true, lines: ['(지난번에 꺼내지 못한 {item:이} 아직 들어 있다.)'] });
        await say(['(가방이 꽉 차서 꺼내지 못했다. 가방을 비우고 다시 열어 보자.)']);
        break;
      }
      l.gift = null;
    }
  }

  return { spot, deliver, post, unread, read, box };
}
