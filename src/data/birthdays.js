// 생일표 (5차 D11-A: 주민 생일 + 플레이어 생일). DOM·three 없음 — town·섬폰·테스트가 같이 쓴다.
// 날짜는 'MM-DD' 문자열. 이사 온 주민(단풍)은 이사 온 날이 생일이 되어 state.town.birthdays 에 적힌다 (town 이 적는다).
// 플레이어 생일은 섬폰에서 고르면 state.town.playerBirthday 에 'MM-DD' 로 (town 서비스가 적는다).

/** 주민 생일 (검수 보드 생일표). 단풍은 이사 온 날 정한다 */
export const BIRTHDAYS = {
  coco: '07-14',      // 해변 달리기 좋은 한여름
  bori: '03-21',      // 낮잠 자기 좋은 봄볕
  mochi: '04-08',     // 튤립이 피는 때
  dubu: '11-03',      // 연어가 올라오는 늦가을
  pong: '09-27',      // 과일이 잘 익는 가을
  chorong: '06-18',   // 장마 시작
  danpung: null,      // 이사 온 날
};

/** 생일에 받은 선물은 친밀도가 평소의 이만큼 */
export const BIRTHDAY_GIFT_MULT = 3;
/** 생일 케이크 (FU-33, 가구 — Z3 가 FURN 표에 넣는다). 아이템 사전에 없으면 건너뛴다 */
export const BIRTHDAY_CAKE = 'furn.birthday-cake';

const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad = n => String(n).padStart(2, '0');

/** 달·날 → 'MM-DD' (맞지 않는 날이면 null). 2월 29일은 고를 수 있다 */
export function mmdd(month, day) {
  const m = Math.floor(Number(month)), d = Math.floor(Number(day));
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= DAYS_IN[m - 1])) return null;
  return `${pad(m)}-${pad(d)}`;
}
/** 'MM-DD' 가 맞는 날인가 */
export const validMmdd = s => typeof s === 'string' && /^\d\d-\d\d$/.test(s) && mmdd(Number(s.slice(0, 2)), Number(s.slice(3))) === s;
/** 'MM-DD' → '11월 3일' */
export const birthdayLabel = s => (validMmdd(s) ? `${Number(s.slice(0, 2))}월 ${Number(s.slice(3))}일` : '');
/** dayKey ('YYYY-MM-DD') → 'MM-DD' */
export const dayMmdd = dayKey => (typeof dayKey === 'string' && dayKey.length >= 10 ? dayKey.slice(5, 10) : null);

const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** 생일 'MM-DD' 가 그날(dayKey)인가 — 2월 29일 생일은 윤년이 아니면 2월 28일에 */
export function sameDay(bd, dayKey) {
  const today = dayMmdd(dayKey);
  if (!bd || !today) return false;
  if (bd === today) return true;
  return bd === '02-29' && today === '02-28' && !leap(Number(dayKey.slice(0, 4)));
}

/** 주민 생일 'MM-DD' (표에 없으면 state.town.birthdays 에서, 없으면 null) */
export const birthdayOf = (slug, state) => BIRTHDAYS[slug] ?? state?.town?.birthdays?.[slug] ?? null;
export const isBirthday = (slug, dayKey, state) => sameDay(birthdayOf(slug, state), dayKey);
/** 그날 생일인 주민들 (slugs 가운데) */
export const birthdaysOn = (dayKey, state, slugs = Object.keys(BIRTHDAYS)) => slugs.filter(s => isBirthday(s, dayKey, state));

export const playerBirthday = state => (validMmdd(state?.town?.playerBirthday) ? state.town.playerBirthday : null);
export const isPlayerBirthday = (state, dayKey) => sameDay(playerBirthday(state), dayKey);

/** 플레이어 생일 정하기 (지우려면 null) → 'MM-DD' | null. state.town 칸은 town 몫이라 섬폰은 town 서비스를 거친다 */
export function setPlayerBirthday(state, month, day) {
  const t = (state.town ??= {});
  if (month == null) { t.playerBirthday = null; return null; }
  const s = mmdd(month, day);
  if (!s) return playerBirthday(state);
  t.playerBirthday = s;
  return s;
}

/** 오늘부터 다음 생일까지 며칠 (오늘이면 0, 정해지지 않았으면 null) */
export function daysUntil(bd, dayKey) {
  if (!validMmdd(bd) || !dayKey) return null;
  const y = Number(dayKey.slice(0, 4));
  const t0 = Date.parse(`${dayKey.slice(0, 10)}T00:00:00Z`);
  for (const yy of [y, y + 1, y + 2, y + 3, y + 4]) {
    let md = bd;
    if (md === '02-29' && !leap(yy)) md = '02-28';
    const t = Date.parse(`${yy}-${md}T00:00:00Z`);
    if (t >= t0) return Math.round((t - t0) / 86400000);
  }
  return null;
}
