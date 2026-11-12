// 축제까지 며칠? (M17-P3 · D41-A · D186-A) — 축제 설정 parts·rules.json town·이모티콘 규칙·편지 BOND 숫자로 「플레이어 셋」을 날마다 굴려 보는 순수 계산.
// node tools/festival-pace.mjs            → 처음 하는 사람 · 보통 · 잘하는 사람의 마음 열린 날 · 부품 다 모은 날 · 축제(엔딩) 날 표
// node tools/festival-pace.mjs --json     → 같은 결과 JSON
// tests/festival-pace.test.mjs 가 같은 함수로 「보통 플레이어 5~7일」을 지킨다. 숫자를 바꾸면(요소 반영) 이 표부터 다시 본다.
//
// 모델 (어림 — 실제 잰 값은 node tools/playtest.mjs [--novice] 의 festival-loop 「📅」 줄):
// - presence = 그날 그 주민을 만나 이야기하는 몫 (비·생일·외출·다른 놀이로 못 만나는 날을 평균으로).
// - 1일째 = 새 게임 날 (첫날 할 일 · 주민 만남 · 이모티콘 연습 1번). 축제 이야기(s04)는 2일째 아침부터 → 🎉 묻기는 2일째부터.
// - 부품 주민 다섯마다 날마다: 그날 처음 말 걸기 town.talkBonus · 이모티콘 대화 (talk.json countedPerDay 까지, 한 번 점수 = 프로필 섞임 × talk.json points × 주민 규칙 어려움)
//   · 얼굴 보고 주는 선물 (town.giftsCountedPerDay 까지, 좋아함·아주 좋아함이면 마음이 통한 일 하루 1) · 편지 (하루 BOND.letter.perDay 통을 다섯에게 나눠, 다음 날 답장 때 BOND.letter.points + 동봉 선물 점수).
// - 마음이 열린 날 = 그날 끝 친밀도 ≥ parts.open.tier 문턱 (rules.json town.tiers) 이고 마음이 통한 일 ≥ parts.open.wins.
// - 부품 건넨 날 = 열린 날 + lag(묻고 나서 다음 날 모아 오는 사람 1, 그날 바로 0) + (모으는 날 − 1). 모으는 날은 준비물 수 ÷ 하루 모으는 양 (프로필).
// - 축제 날 = 다섯 다 모은 다음 날 저녁 (D23-A). 주민 생일(그날은 집) · 비 오는 날은 빼고 셈 — 실제는 하루쯤 늦을 수 있다.
import { readFileSync } from 'node:fs';
import { BOND } from '../src/gameplay/town/bond.js';

const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

/** 이모티콘 규칙 → 그 주민이 얼마나 어려운가 (처음·보통 플레이어 기준 곱. 잘하는 사람은 규칙을 알아서 1) */
const RULE_EASE = { waitFirst: 0.75, greetFirst: 0.8, fewer: 0.9, more: 0.9, food: 0.95, askAnswers: 1 };

/** 플레이어 셋. mix = 이모티콘 대화 결과 섞임(talk.json points 키), gather = 하루에 모으는 양 (준비물 분류별) */
export const PROFILES = {
  novice: {
    name: '처음 하는 사람', convos: 3, presence: 0.9, mix: { puzzled: 0.1, okay: 0.4, happy: 0.5 }, gifts: 0, giftKind: null, letters: 0, letterGift: null, lag: 1, ruleAware: false,
    gather: { bug: 3, wood: 6, flower: 6, fruit: 6, bigFish: 1 },
  },
  normal: {
    name: '보통', convos: 3, presence: 0.9, mix: { okay: 0.2, happy: 0.8 }, gifts: 0.5, giftKind: 'like', letters: 1, letterGift: 'normal', lag: 1, ruleAware: false,
    gather: { bug: 5, wood: 10, flower: 10, fruit: 8, bigFish: 1 },
  },
  skilled: {
    name: '잘하는 사람', convos: 3, presence: 1, mix: { happy: 0.4, delight: 0.6 }, gifts: 1.5, giftKind: 'loveLike', letters: 3, letterGift: 'loveLike', lag: 0, ruleAware: true,
    gather: { bug: 8, wood: 16, flower: 14, fruit: 10, bigFish: 1.5 },
  },
};

/** 지금 파일들의 숫자 (cfg 를 넘기면 그것으로 — 초안 비교용) */
export function loadNumbers() {
  const rules = read('assets/data/rules.json'), fest = read('assets/festival/config.json'), talk = read('assets/emotes/talk.json');
  const villagers = Object.fromEntries(fest.parts.list.map(p => [p.who, read(`assets/villagers/${p.who}.json`)]));
  return { town: rules.town, parts: fest.parts, talk, villagers, letter: BOND.letter };
}

/** 준비물 하나 → 분류 · 개수 (any 는 가장 흔한 길 = 마지막 것) */
function needOf(need) {
  if (need.any) return needOf(need.any[need.any.length - 1]);
  const m = need.match ?? {};
  const kind = m.shadowMin != null ? 'bigFish' : m.id === 'mat.wood' ? 'wood' : m.category;
  return { kind, n: need.n };
}

const giftPts = (gp, kind) => (kind === 'loveLike' ? (gp.love + gp.like) / 2 : kind ? gp[kind] ?? 0 : 0);

/** 한 프로필로 굴리기 → { byVillager: {slug: {openDay, partDay, friend}}, readyDay, festivalDay } */
export function simulate(profileKey, N = loadNumbers(), { maxDays = 30 } = {}) {
  const P = PROFILES[profileKey];
  const { town, parts, talk, villagers, letter } = N;
  const need = town.tiers.find(([id]) => id === parts.open.tier)?.[1] ?? 30;
  const wins = parts.open.wins ?? 2, ways = parts.open.ways ?? ['emote'];
  const perConvo = Object.entries(P.mix).reduce((s, [k, w]) => s + w * (talk.points[k] ?? 0), 0);
  const convos = Math.min(P.convos, talk.countedPerDay);
  const winRate = Object.entries(P.mix).reduce((s, [k, w]) => s + ((talk.points[k] ?? 0) > 0 ? w : 0), 0);   // 점수가 난 대화만 마음이 통한 일
  const gifts = Math.min(P.gifts, town.giftsCountedPerDay);
  const giftWin = ['like', 'love', 'loveLike'].includes(P.giftKind) && ways.includes('gift') ? Math.min(1, gifts) : 0;
  const letterEach = (P.letters / parts.list.length) * (letter.points + giftPts(town.giftPoints, P.letterGift) * (letter.giftMult ?? 1));
  const byVillager = {};
  for (const part of parts.list) {
    const rule = Object.keys(villagers[part.who]?.emote?.rule ?? {}).find(k => RULE_EASE[k] != null);
    const ease = P.ruleAware ? 1 : RULE_EASE[rule] ?? 1;
    const emoteDay = convos * perConvo * ease, pres = P.presence ?? 1;
    let F = 0, W = 0, openDay = null;
    for (let d = 1; d <= maxDays && openDay == null; d++) {
      if (d === 1) { F += town.talkBonus + perConvo * ease; W += ways.includes('emote') ? winRate : 0; }
      else {
        F += pres * (town.talkBonus + emoteDay + gifts * giftPts(town.giftPoints, P.giftKind)) + letterEach;   // 편지 답장은 2일째부터 (못 만난 날에도 온다)
        W += pres * ((ways.includes('emote') ? convos * winRate : 0) + giftWin);
      }
      if (d >= 2 && F >= need && W >= wins) openDay = d;
    }
    const { kind, n } = needOf(part.need);
    const gatherDays = Math.max(1, Math.ceil(n / (P.gather[kind] ?? 1)));
    const partDay = openDay == null ? null : openDay + P.lag + gatherDays - 1;
    byVillager[part.who] = { openDay, partDay, gatherDays, perDay: Math.round((pres * (town.talkBonus + emoteDay + gifts * giftPts(town.giftPoints, P.giftKind)) + letterEach) * 10) / 10 };
  }
  const days = Object.values(byVillager).map(v => v.partDay);
  const readyDay = days.includes(null) ? null : Math.max(...days);
  return { profile: P.name, need, wins, byVillager, readyDay, festivalDay: readyDay == null ? null : readyDay + 1 };
}

export const simulateAll = (N = loadNumbers()) => Object.fromEntries(Object.keys(PROFILES).map(k => [k, simulate(k, N)]));

if (/festival-pace\.mjs$/.test(process.argv[1] ?? '')) {
  const all = simulateAll();
  if (process.argv.includes('--json')) console.log(JSON.stringify(all, null, 2));
  else {
    for (const r of Object.values(all)) {
      console.log(`\n${r.profile} — 문턱 ♥${r.need} · 🙂${r.wins} → 부품 다섯 ${r.readyDay}일째 · 축제(엔딩) ${r.festivalDay}일째`);
      for (const [slug, v] of Object.entries(r.byVillager)) console.log(`  ${slug.padEnd(8)} 하루 +${v.perDay} · 마음 열림 ${v.openDay}일째 · 모으기 ${v.gatherDays}일 · 부품 ${v.partDay}일째`);
    }
  }
}
