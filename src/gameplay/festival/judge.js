// 이모티콘 대화 판정 (DOM·three 없음, node 로 확인). 같은 규칙·상태·입력이면 늘 같은 결과.
// 규칙 데이터: 공통(점수·인사·연습)은 assets/emotes/talk.json, 주민마다 읽는 법(TK-01–07)은 6차 M6-P3 부터 주민 파일 assets/villagers/<slug>.json 의
// emote 칸 (withVillagers 로 합친다). 이모티콘은 assets/emotes/emotes.json (EM-01–36). 검수 보드 z5 D18-A.
// 친밀도는 오르기만 한다 — 틀려도 깎지 않고, 갸웃·물러나며 💭 힌트를 다시 보여 준다 (오해는 벌이 아니라 단서).
import { rngOf } from '../town/rules.js';

export const MAX_SEND = 3;
/** 판정 6단계 (낮은 것부터) */
export const KINDS = ['retreat', 'awkward', 'puzzled', 'okay', 'happy', 'delight'];
export const KIND_NAME = { delight: '아주 기쁨', happy: '기쁨', okay: '그냥', puzzled: '갸웃', awkward: '어색', retreat: '물러남' };
/** 판정 → 몸짓 (주민별 gesture 가 이름을 바꿀 수 있다 — 지금 모델 동작이 없는 것은 연출 쪽에서 고개·몸 기울이기로) */
export const GESTURE = { delight: 'happy', happy: 'nod', okay: 'idle', puzzled: 'tilt', awkward: 'shake', retreat: 'back' };

const rank = k => KINDS.indexOf(k);
const at = i => KINDS[Math.max(0, Math.min(KINDS.length - 1, i))];
const bump = (k, d) => at(rank(k) + d);
const atLeast = (k, min) => (rank(k) < rank(min) ? min : k);

/** talk.json(공통) + 주민 파일들(emote 칸) → 판정이 받는 규칙 { ...talk, villagers: { slug: 규칙 } }. docs = 주민 파일 (town/people.js VILLAGERS) */
export const withVillagers = (talk, docs) => ({ ...talk, villagers: Object.fromEntries(docs.filter(d => d.emote).map(d => [d.slug, d.emote])) });

/** 빈 보내기 = 기다리기. 넘치면 앞에서부터 자른다 */
export function normalize(keys) {
  const list = (keys ?? []).filter(Boolean).slice(0, MAX_SEND);
  return list.length ? list : ['wait'];
}

/** 그 주민이 오늘 원하는 것 (wants 중 하루 하나, dayKey 시드) */
export function wantOf(rule, slug, dayKey) {
  const w = rule?.wants ?? [];
  if (!w.length) return null;
  return w[Math.floor(rngOf(dayKey ?? '', slug, 'emote-want')() * w.length)];
}

/**
 * 판정. rules = withVillagers(talk.json, 주민 파일), slug = 주민, keys = 보낸 이모티콘 key 목록.
 * c = { dayKey, weather, want (없으면 wantOf), greeted, waited, lastSaid: 주민이 바로 전에 보인 key 목록 }
 * → { kind, points, keys (정리한 입력), want, matchedWant, hint: key[] | null, reply: key[], gesture, flags: string[], greeted, waited }
 */
export function judge(rules, slug, keys, c = {}) {
  const R = rules.villagers[slug];
  if (!R) throw new Error(`[festival] 대화 규칙이 없는 주민: ${slug}`);
  const msg = normalize(keys);
  const rule = R.rule ?? {};
  const want = c.want !== undefined ? c.want : wantOf(R, slug, c.dayKey);
  const flags = [];
  const has = k => msg.includes(k);
  const n = msg.length;
  const onlyWait = msg.every(k => k === 'wait');
  let greeted = !!c.greeted, waited = !!c.waited, hint = null;

  // 점수: 좋아함 +2 · 싫어함 -2 · 오늘 원하는 것 +3
  let s = 0;
  for (const k of msg) s += R.likes.includes(k) ? 2 : R.dislikes.includes(k) ? -2 : 0;
  const matchedWant = !!want && has(want);
  if (matchedWant) s += 3;
  let kind = s >= 4 ? 'delight' : s >= 2 ? 'happy' : s >= 1 ? 'okay' : s === 0 ? (msg.some(k => rules.friendly.includes(k)) ? 'okay' : 'puzzled') : s >= -2 ? 'awkward' : 'retreat';

  // ⏳ 만 보내면 (두부가 아니면) 원하는 것을 다시 보여 준다
  if (onlyWait && !rule.waitFirst && !R.likes.includes('wait')) { kind = R.dislikes.includes('wait') ? 'puzzled' : 'okay'; hint = want ? [want] : null; flags.push('hint'); }

  // 주민마다 읽는 법
  if (rule.more) {                                   // 코코: 이어 말하면 신난다, 하나면 "더!"
    if (n === 3 && !onlyWait) { kind = bump(kind, 1); flags.push('more'); }
    else if (n === 1 && !matchedWant && rank(kind) >= rank('okay')) { kind = 'puzzled'; hint = ['ask']; flags.push('want-more'); }
  }
  if (rule.fewer && n >= 2) { kind = bump(kind, -(n - 1)); flags.push('too-many'); }   // 보리: 하나만 천천히
  if (rule.greetFirst) {                             // 모찌: 인사를 먼저
    if (msg.some(k => rule.greetFirst.includes(k))) greeted = true;
    else if (!greeted) { kind = 'puzzled'; hint = [rule.greetFirst[0]]; flags.push('greet-first'); }
  }
  if (rule.waitFirst) {                              // 두부: 기다려 주면 말문을 연다, 한꺼번에 셋은 물러남
    if (n > (rule.maxCalm ?? 2)) { kind = 'retreat'; hint = ['wait']; flags.push('too-many'); }
    else if (onlyWait) { kind = waited ? 'okay' : 'happy'; waited = true; hint = !matchedWant && want ? [want] : null; flags.push('waited'); }
    else if (!waited) { kind = atLeast(bump(kind, -2), 'puzzled'); hint = ['wait']; flags.push('wait-first'); }
  }
  if (rule.food && msg.some(k => rules.food.includes(k))) { kind = atLeast(kind, 'happy'); flags.push('food'); }   // 퐁
  if (rule.askAnswers && has('ask')) { kind = atLeast(kind, 'okay'); hint = want && !matchedWant ? [want] : hint; flags.push('answer'); }   // 초롱
  if (rule.rainBonus && c.weather === 'rain') { kind = bump(kind, rule.rainBonus); flags.push('rain'); }
  if (rule.echo && c.lastSaid?.length && msg.length === c.lastSaid.length && msg.every((k, i) => k === c.lastSaid[i])) { kind = 'delight'; flags.push('echo'); }   // 단풍

  if (!hint && rank(kind) <= rank('puzzled') && want) hint = [want];
  const reply = replyOf(R, kind, { want, hint, matchedWant });
  const gesture = (rank(kind) >= rank('happy') ? R.gesture?.happy : rank(kind) === rank('puzzled') ? R.gesture?.puzzled : null) ?? GESTURE[kind];
  return { kind, points: rules.points[kind] ?? 0, keys: msg, want, matchedWant, hint, reply, gesture, gestureBase: GESTURE[kind], flags, greeted, waited };
}

/** 주민 대답 (이모티콘 1–3개) — 주민 대답 팔레트(reply)에서 고른다 */
export function replyOf(R, kind, { want, hint, matchedWant } = {}) {
  const p = R.reply;
  const out = {
    delight: ['sparkle', p[0], matchedWant && want ? want : p[1]],
    happy: [p[0], 'heart'],
    okay: ['smile', p[1] ?? 'dots'],
    puzzled: ['think', ...(hint ? ['bubble', hint[0]] : ['ask'])],
    awkward: ['sweat', ...(hint ? ['bubble', hint[0]] : ['dots'])],
    retreat: ['dots', 'sweat'],
  }[kind] ?? ['dots'];
  return [...new Set(out.filter(Boolean))].slice(0, MAX_SEND);
}

/** 인사 말풍선 (시간대·날씨·친한 정도) */
export function greetOf(rules, slug, { slot, weather, tier } = {}) {
  const g = rules.greet;
  const base = (weather === 'rain' || weather === 'snow') ? g[weather] : g[slot] ?? g.afternoon;
  const close = tier === 'close' || tier === 'best' || tier === 'friend';
  return [...base, ...(close ? ['heart'] : [])].slice(0, MAX_SEND);
}

/** 연습(첫 이모티콘 대화) 한 단계 맞았나 */
export function tutorialOk(rules, step, keys) {
  const t = rules.tutorial[step];
  return !!t && normalize(keys).some(k => t.ok.includes(k));
}

/**
 * 하루에 친밀도가 오르는 이모티콘 대화 수 세기. v = state.villagers[slug] (emote 칸을 채운다).
 * → 이번 판정으로 올릴 친밀도 (그날 countedPerDay 번을 넘으면 0)
 */
export function countPoints(rules, v, dayKey, points) {
  const e = (v.emote ??= {});
  if (e.day !== dayKey) { e.day = dayKey; e.today = 0; e.wantDone = false; }
  e.wins ??= 0;
  if (points <= 0) return 0;
  if (e.today >= rules.countedPerDay) return 0;
  e.today++;
  e.wins++;
  return points;
}
