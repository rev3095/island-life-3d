// M15 「주민과 더 가깝게」 규칙 (DOM·three 없음, node 로 확인): 내가 보낸 편지 → 다음 날 답장 · 같이 낚시·산책 · 저녁 광장 노래 · 추억 앨범 크기.
// 상태: state.mail.sent (보낸 편지) · state.villagers[slug].together (같이 논 날) · state.town.song (노래한 날) · state.album (사진).
// 숫자는 여기 BOND 한 곳 (D155-A 추천안: 따로 표를 두지 않고 코드 상수 — 요소 편집기 표로 옮기려면 rules.json town 에 칸을 더하고 여기서 읽는다).
// town/rules.js 의 planLetters·지문 대상 함수는 건드리지 않는다 (tests/villagers.test.mjs 핀).
import { rngOf, pickWeighted, tierOf, giftReaction, GIFT_POINTS, daysBetween, dayHour, TIERS } from './rules.js';

export const BOND = {
  letter: {
    maxText: 80,          // 편지 글 글자 수
    perDay: 3,            // 하루에 보낼 수 있는 편지 (한 주민에게는 하루 한 통)
    points: 3,            // 편지만으로 오르는 친밀도
    giftMult: 1,          // 동봉 선물 친밀도 = 선물 반응 점수 × 이것 (얼굴 보고 주는 선물 하루 2개 칸과 따로 센다)
    backChance: 0.3,      // 답장에 작은 선물이 들어 있을 확률 (아주 좋아한 선물이면 + backLove)
    backLove: 0.25,
  },
  together: {
    minTier: 'friend',    // 같이 놀 수 있는 친밀도 단계 (친구 30 이상)
    points: 5,            // 끝까지 같이 놀면
    fishGoal: 3,          // 같이 낚시: 둘이 합쳐 이만큼 낚으면 끝
    fishMaxSec: 150,      // 또는 이만큼 (실제 초)
    walkGoal: 36,         // 같이 산책: 이만큼 칸을 걸으면 끝
    walkMaxSec: 120,
    catchEvery: [14, 24], // 주민이 물가에 서 있을 때 낚는 간격 (실제 초)
    giftChance: 0.8,      // 끝나고 작은 선물
    letterNext: 0.5,      // 다음 날 아침 「어제 즐거웠어」 편지
  },
  song: {
    chance: 0.5,          // 저녁마다 노래할 확률 (날마다 같은 값)
    from: 18, to: 20,     // 시작할 수 있는 게임 시각 (dayHour)
    seconds: 80,          // 부르는 시간 (실제 초)
    lineEvery: 3.2,       // 번갈아 부르는 간격
    hear: 7,              // 이 거리 안이면 목소리가 들린다
    first: ['chorong', 'mochi'],   // 첫 노래 = 장면 s26 의 두 주민 (둘 다 섬에 있을 때)
    points: 1,            // 끝까지 들으면 두 주민 친밀도 +1 (하루 한 번)
  },
  album: {
    max: 24,              // 액자에 넣지 않은 사진은 이만큼만 (오래된 것부터 지움)
    width: 160, height: 100, quality: 0.62,   // 저장하는 사진 크기 (JPEG, 한 장 ≈ 5–8KB)
  },
};

// ---------- 편지 보내기 ----------

/** state.mail 의 보낸 편지 칸 (없으면 만든다) */
export function sentBox(state) {
  const m = (state.mail ??= {});
  if (!Array.isArray(m.sent)) m.sent = [];
  m.sentId ??= 1;
  return m.sent;
}

/** 편지 글 다듬기: 앞뒤 공백·줄바꿈 정리 + 글자 수 자르기 */
export function cleanText(text, max = BOND.letter.maxText) {
  return String(text ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/** 오늘 더 보낼 수 있나 → { ok, why: null | 'day' (오늘 다 보냄) | 'same' (이 주민에겐 오늘 보냄) | 'text' (빈 글) } */
export function canSend(state, to, dayKey, text = 'x') {
  const sent = sentBox(state);
  if (!cleanText(text)) return { ok: false, why: 'text' };
  const today = sent.filter(s => s.day === dayKey);
  if (to && today.some(s => s.to === to)) return { ok: false, why: 'same' };
  if (today.length >= BOND.letter.perDay) return { ok: false, why: 'day' };
  return { ok: true, why: null };
}

/** 편지 한 통 적어 두기 (선물은 이미 가방에서 뺀 아이템 id) → 기록 */
export function recordSent(state, { to, text, gift = null, dayKey }) {
  const sent = sentBox(state);
  const rec = { id: state.mail.sentId++, to, text: cleanText(text), gift, day: dayKey, replied: null };
  sent.push(rec);
  // 답장까지 받은 편지는 최근 20통만
  const done = sent.filter(s => s.replied);
  if (done.length > 20) sent.splice(sent.indexOf(done[0]), 1);
  return rec;
}

/**
 * 그날 아침 답장 계획 (같은 날엔 같다) → [{ rec, from, kind: 'reply'|'replyLove'|'replyDislike', reaction, points, back }]
 * 전날까지 보낸 편지마다 하나. person = PEOPLE[slug], item(id) = 아이템. 떠난 주민(people 에 없음)은 답장하지 않고 넘긴다.
 */
export function planReplies(state, people, dayKey, item = () => null) {
  const out = [];
  for (const rec of sentBox(state)) {
    if (rec.replied || !(daysBetween(rec.day, dayKey) >= 1)) continue;
    const P = people[rec.to];
    if (!P) continue;
    const it = rec.gift ? item(rec.gift) : null;
    const reaction = it ? giftReaction(P, it) : null;
    const points = BOND.letter.points + (reaction ? Math.round(GIFT_POINTS[reaction] * BOND.letter.giftMult) : 0);
    const kind = reaction === 'love' ? 'replyLove' : reaction === 'dislike' ? 'replyDislike' : 'reply';
    const r = rngOf(dayKey, rec.to, 'reply', rec.id);
    const chance = reaction === 'dislike' ? 0 : BOND.letter.backChance + (reaction === 'love' ? BOND.letter.backLove : 0);
    const back = P.gifts?.length && r() < chance ? pickWeighted(P.gifts, r).id : null;
    out.push({ rec, from: rec.to, kind, reaction, points, back });
  }
  return out;
}

// ---------- 같이 하기 ----------

const TIER_RANK = Object.fromEntries(TIERS.map(([id], i) => [id, i]));
/** 이 주민과 같이 놀 수 있나 → { ok, why: null | 'tier' (덜 친함) | 'today' (오늘 이미 같이 놂) } */
export function canTogether(v, dayKey) {
  if ((TIER_RANK[tierOf(v?.friendship ?? 0)] ?? 0) < TIER_RANK[BOND.together.minTier]) return { ok: false, why: 'tier' };
  if (v?.together?.day === dayKey) return { ok: false, why: 'today' };
  return { ok: true, why: null };
}

/** 같이 놀기 끝: 기록 (kind = 'fish'|'walk', full = 끝까지 했나) → 오른 친밀도 */
export function noteTogether(v, kind, dayKey, full) {
  const t = (v.together ??= { day: null, kind: null, count: 0, fish: 0, walk: 0 });
  t.day = dayKey; t.kind = kind;
  t.count = (t.count ?? 0) + 1;
  t[kind] = (t[kind] ?? 0) + 1;
  return full ? BOND.together.points : Math.ceil(BOND.together.points / 2);
}

/** 끝나고 주는 작은 선물 (낚시면 같이 낚은 물고기 하나, 아니면 답례 선물 목록) → 아이템 id | null */
export function togetherGift(person, kind, caught, r) {
  if (r() >= BOND.together.giftChance) return null;
  if (kind === 'fish' && caught?.length) return caught[Math.floor(r() * caught.length)];
  return person.gifts?.length ? pickWeighted(person.gifts, r).id : null;
}

/** 같이 하기가 끝났나 → null | 'goal' | 'time' */
export function togetherDone(kind, { caught = 0, walked = 0, sec = 0 } = {}) {
  const T = BOND.together;
  if (kind === 'fish') return caught >= T.fishGoal ? 'goal' : sec >= T.fishMaxSec ? 'time' : null;
  return walked >= T.walkGoal ? 'goal' : sec >= T.walkMaxSec ? 'time' : null;
}

/** 다음 주민 낚기까지 (실제 초) */
export const catchDelay = r => BOND.together.catchEvery[0] + r() * (BOND.together.catchEvery[1] - BOND.together.catchEvery[0]);

// ---------- 저녁 광장 노래 ----------

/** 오늘 노래하나 · 언제 → { at: 게임 시각 } | null (같은 날엔 같다) */
export function songPlan(dayKey) {
  const r = rngOf(dayKey, 'town-song');
  if (r() >= BOND.song.chance) return null;
  const S = BOND.song;
  return { at: S.from + r() * (S.to - S.from - 0.5) };
}

/**
 * 노래할 두 주민 고르기 → [a, b] | null. free = 지금 밖에 있고 다른 일 없는 주민 slug (순서 = 주민 순서).
 * 첫 노래(firstDone 아님)는 s26 의 두 주민이 다 있으면 그 둘.
 */
export function songPair(free, dayKey, firstDone) {
  const F = BOND.song.first;
  if (!firstDone && F.every(s => free.includes(s))) return [...F];
  if (free.length < 2) return null;
  const r = rngOf(dayKey, 'song-pair');
  const a = free[Math.floor(r() * free.length)];
  const rest = free.filter(s => s !== a);
  return [a, rest[Math.floor(r() * rest.length)]];
}

/** 지금 시각이 노래 시작 때인가 (plan.at 부터 저녁 끝 to 까지) */
export const songTime = (plan, now) => !!plan && dayHour(now) >= plan.at && dayHour(now) < BOND.song.to + 0.5;

// ---------- 추억 앨범 ----------

/** state.album (없으면 만든다) */
export function albumOf(state) {
  const a = (state.album ??= {});
  if (!Array.isArray(a.list)) a.list = [];
  a.next ??= 1;
  return a;
}

/** 사진 한 장 넣기 → 기록. 액자에 넣지 않은 사진이 max 를 넘으면 오래된 것부터 지운다 (액자 사진은 집에 걸려 있어 지우지 않음) */
export function addPhoto(state, { img, day, kind, who = [], title }) {
  const A = albumOf(state);
  const rec = { id: A.next++, img, day, kind, who: [...who], title: String(title ?? '').slice(0, 30), framed: 0 };
  A.list.push(rec);
  let loose = A.list.filter(p => !p.framed);
  while (loose.length > BOND.album.max) {
    A.list.splice(A.list.indexOf(loose[0]), 1);
    loose = A.list.filter(p => !p.framed);
  }
  return rec;
}

/** 액자 아이템 변형 이름 ↔ 사진 id ('사진12') — 가방 칸 변형 이름표에 그대로 보인다 */
export const frameVariant = id => `사진${id}`;
export const photoOfVariant = v => { const m = /^사진(\d+)$/.exec(String(v ?? '')); return m ? Number(m[1]) : null; };
