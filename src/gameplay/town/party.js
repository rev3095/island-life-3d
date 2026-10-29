// 5차 D11-A 생일: 주민 생일엔 그 주민이 하루 종일 집 안에 있고 집 앞에 풍선 장식(PR-11), 아침에 초대 편지,
// 선물 친밀도 3배·생일 케이크(FU-33)는 talk.js. 플레이어 생일(섬폰에서 고름)엔 친한 주민들이 축하 편지를 보내고 대화 때 축하한다.
// 하루 한 번 보내는 편지는 state.town.partyDay 로 막는다.
import { isBirthday, isPlayerBirthday, setPlayerBirthday, playerBirthday, birthdayOf, BIRTHDAY_CAKE } from '../../data/birthdays.js';
import { villagerState } from './rules.js';
import { context } from './talk.js';
import { PEOPLE } from './people.js';
import { PROPS, propKind } from './movein.js';

const PLAYER_LETTERS = 3;   // 플레이어 생일 축하 편지를 보내는 주민 수 (친한 순)

export function createParty(ctx, { mail, residents, toast }) {
  const world = ctx.services.world;
  const today = () => context(ctx).dayKey;
  const balloons = new Map();   // slug → 물체 id
  const houseOf = slug => world.places.villagerHouses?.find(h => h.slug === slug) ?? null;

  const party = {
    /** 생일인가 (이사 온 주민은 이사 온 날이 생일이지만 그날 당일엔 아직 파티를 안 한다 — 다음 해부터) */
    isBirthday: (slug, dayKey = today()) => isBirthday(slug, dayKey, ctx.state) && ctx.state.town?.movein?.[slug]?.moved !== dayKey,
    isPlayerBirthday: (dayKey = today()) => isPlayerBirthday(ctx.state, dayKey),
    /** 오늘 생일인 (섬에 사는) 주민들 */
    birthdays: (dayKey = today()) => residents().filter(s => party.isBirthday(s, dayKey)),
    /** 생일이라 하루 종일 집에 있나 */
    staysIn: slug => party.isBirthday(slug),
    birthdayOf: slug => birthdayOf(slug, ctx.state),
    player: () => playerBirthday(ctx.state),
    /** 플레이어 생일 정하기 (섬폰) → 'MM-DD' | null. 오늘로 정했으면 바로 축하가 시작된다 */
    setPlayer(month, day) {
      const s = setPlayerBirthday(ctx.state, month, day);
      ctx.events.emit('town:birthday', { who: 'player', date: s });
      if (s && party.isPlayerBirthday()) cheerPlayer(today());
      return s;
    },
    cake: () => (ctx.services.data?.items?.get?.(BIRTHDAY_CAKE) ? BIRTHDAY_CAKE : null),
    check, sync,
  };

  /** 오늘 생일인 주민 집 앞 풍선 (없는 날은 치운다) */
  function sync(dayKey = today()) {
    const kind = propKind(world, PROPS.balloons);
    const want = new Set(kind ? party.birthdays(dayKey) : []);
    for (const [slug, id] of balloons) if (!want.has(slug)) { world.objects.remove(id); balloons.delete(slug); }
    for (const slug of want) {
      if (balloons.has(slug)) continue;
      const h = houseOf(slug);
      if (!h) continue;
      const tx = world.island.tileAt(h.tx - 1, h.tz) === 'path' ? h.tx - 2 : h.tx - 1;   // 문 왼쪽 (오른쪽은 우편함)
      const id = world.objects.add(kind, tx, h.tz, { persist: false, id: `${kind}@${slug}`, owner: slug });
      if (id) balloons.set(slug, id);
    }
  }

  function cheerPlayer(dayKey) {
    const t = (ctx.state.town ??= {});
    if (t.cheerDay === dayKey) return;
    t.cheerDay = dayKey;
    toast('생일 축하해요! 오늘은 섬 모두가 축하해 줄 거예요', '🎂');
    if (!ctx.state.flags?.intro) return;
    const met = residents().map(s => ({ s, v: villagerState(ctx.state, s) })).filter(x => x.v.met).sort((a, b) => b.v.friendship - a.v.friendship);
    met.slice(0, PLAYER_LETTERS).forEach(({ s }, i) => mail.post(s, 'playerBirthday', i === 0 ? party.cake() : null));
    if (!met.length) mail.post('bamtol', 'playerBirthday');
  }

  /** 하루가 바뀌었을 때(와 시작할 때): 생일 알림·초대 편지·풍선 */
  function check(dayKey = today()) {
    if (!dayKey) return;
    const t = (ctx.state.town ??= {});
    sync(dayKey);
    if (t.partyDay !== dayKey) {
      t.partyDay = dayKey;
      for (const slug of party.birthdays(dayKey)) {
        const P = PEOPLE[slug];
        toast(`오늘은 ${P?.name ?? slug}의 생일이에요! 집에서 파티 중이에요`, '🎈');
        if (villagerState(ctx.state, slug).met && ctx.state.flags?.intro) mail.post(slug, 'birthday');
      }
    }
    if (party.isPlayerBirthday(dayKey)) cheerPlayer(dayKey);
  }

  return party;
}
