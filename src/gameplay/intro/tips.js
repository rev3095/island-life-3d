// 7차 M7-P5 (보드 wave7 D44-A): 처음 하는 사람이 막히는 자리의 힌트 글과 규칙 (DOM·three 없음, node 로 확인).
// QA(docs/qa/playthrough-2026-10-30.md)가 막힌 곳: 두부 '⏳ 하나만'(QA-05) · 친해지려면 얼마나 더(QA-13) · 밤에 시작한 첫날(QA-09) ·
// 축제 준비물을 언제 묻나 · 축제 날 저녁을 놓침. 규칙(judge.js·주민 파일 emote)은 그대로 두고, 판정 결과(festival:emote)를 보고 알려 주기만 한다.
// 본 힌트는 state.flags.tips 에 남아 섬폰 「안내」에서 다시 본다. 글의 {name:이} = 주민 이름 + 받침에 맞춘 조사.
import { josa } from './rules.js';
import { heartCount } from '../town/rules.js';

/** 판정 순서 (festival/judge.js KINDS 와 같다) */
export const KINDS = ['retreat', 'awkward', 'puzzled', 'okay', 'happy', 'delight'];
const rank = k => KINDS.indexOf(k);

/**
 * 힌트 표. 한 힌트에 단계(steps)가 여럿이면 그만큼 더 막혔을 때 더 또렷하게 알려 준다 (after = 몇 번째 막혔을 때부터).
 * keys/touch 가 다르면 touch 칸을 둔다. who = 주민마다 따로 세는 힌트 (주민 이모티콘 읽는 법 emote.rule 의 이름).
 */
export const TIPS = {
  // ---- 이모티콘 대화: 주민마다 읽는 법 (주민 파일 emote.rule) ----
  waitFirst: {
    who: true, icon: '⏳', title: '{name:은} 기다려 주는 걸 좋아해요',
    steps: [
      { after: 1, text: '{name:이} 갸웃했어요. 말을 아끼는 친구라 먼저 조용히 기다려 주면 마음을 열어요. 💭 속 이모티콘을 그것만 보내 봐요.' },
      { after: 3, text: '⏳ 하나만 보내 봐요 — 아무것도 안 고르고 보내기를 눌러도 기다리기예요. 한 번 기다려 준 다음엔 다른 이모티콘도 들어 줘요.' },
    ],
  },
  waitFirstMany: {
    who: true, icon: '⏳', title: '{name:은} 한꺼번에 들으면 놀라요',
    steps: [{ after: 1, text: '셋을 한꺼번에 보내면 {name:이} 물러나요. 둘까지, 처음엔 ⏳ 하나로 천천히 시작해 봐요.' }],
  },
  greetFirst: {
    who: true, icon: '👋', title: '{name:은} 인사부터 받고 싶어 해요',
    steps: [{ after: 1, text: '{name:은} 인사를 먼저 받아야 이야기를 들어요. 대화를 시작하면 {greet} 같은 인사부터 보내 봐요.' }],
  },
  fewer: {
    who: true, icon: '🐢', title: '{name:은} 하나씩 천천히가 좋아요',
    steps: [{ after: 2, text: '{name:은} 여러 개를 한꺼번에 들으면 정신없어해요. 이모티콘을 하나만 골라 보내 봐요.' }],
  },
  more: {
    who: true, icon: '🎶', title: '{name:은} 이어 말하면 신나요',
    steps: [{ after: 2, text: '하나만 보내면 {name:이} "더!" 하고 갸웃해요. 이모티콘을 셋까지 이어 골라 보내 봐요.' }],
  },
  puzzled: {
    who: true, icon: '💭', title: '갸웃할 땐 💭 말풍선을 봐요',
    steps: [{ after: 3, text: '주민이 갸웃하면 💭 말풍선 속 이모티콘을 봐요. 그게 그 주민이 지금 바라는 거예요. 좋아하는 것은 주민마다 달라요.' }],
  },

  // ---- 축제 이야기 ----
  heart: {
    who: true, live: true, icon: '💗', title: '{name:와} 친해지기',
    // 진행 정도 알림 (QA-13): 🎉 를 보냈는데 아직일 때마다 지금 값으로 — 글은 heartText 가 만든다 (miss 를 거치지 않는다)
    steps: [{ after: 1, text: '' }],
  },
  festival: {
    icon: '🎉', title: '축제 준비',
    steps: [{ after: 1, text: '축제 이야기가 시작됐어요! 주민과 친해진 뒤 대화에서 🎉 하나만 보내면 축제 준비물을 알려 줘요. 부품 다섯을 모으면 광장에서 축제가 열려요.' }],
  },
  ready: {
    icon: '🌙', title: '축제 날',
    steps: [{ after: 1, text: '부품 다섯을 다 모았어요! 다음 날 저녁 6시부터 광장 가운데 모닥불 앞에서 축제를 시작할 수 있어요.' }],
  },
  tonight: {
    icon: '🔥', title: '오늘 저녁 축제',
    steps: [{ after: 1, text: '축제 시간이에요! 광장 가운데 모닥불 앞에 서서 Space를 눌러요.', touch: '축제 시간이에요! 광장 가운데 모닥불 앞에 서서 A를 눌러요.' }],
  },

  // ---- 첫날 ----
  night: {
    icon: '🌙', title: '밤에 시작했어요',
    // 7차 D51-A: 첫날엔 문을 닫았어도 밤톨이 문 너머로 사 준다
    steps: [{ after: 1, text: '도토리상점은 밤 10시~아침 8시엔 문을 닫아요. 그래도 첫날엔 상점 문 앞에서 밤톨을 부르면 문 너머로 사 줘요!' }],
  },
  skipped: {
    icon: '🎁', title: '환영 선물', again: false,
    steps: [{ after: 1, text: '도토리상점 앞의 밤톨에게 말을 걸면 환영 선물을 줘요. 조작과 할 일은 섬폰 💡「안내」에 다 있어요.' }],
  },
};

/** 안내를 짧게 고른 사람에게 밤톨이 하는 말 (긴 첫 안내 대신) */
export const SHORT_INTRO = [
  '어서 와요, {player} 씨! {island}에 온 걸 환영해요! 저는 도토리상점 밤톨이에요.',
  '섬 생활은 마음 가는 대로 해 봐요. 조작이랑 할 일은 섬폰 「안내」에 다 적어 뒀어요.',
  '가게에 들르면 환영 선물도 줄게요. 그럼 천천히 둘러봐요!',
];

/** '{name:이}' · '{greet}' 같은 자리 채우기 */
export const fillTip = (text, vars = {}) => String(text ?? '').replace(/\{(\w+)(?::([^{}\s]+?))?\}/g, (m, k, j) => {
  const v = vars[k];
  if (v == null || v === '') return m;
  return j ? josa(v, j) : String(v);
});

// ---------- 기록 (state.flags.tips) ----------

/**
 * state.flags.tips 를 빈 칸 채워서 돌려준다.
 * { v, miss: { 'waitFirst:dubu': n }, seen: { 'waitFirst:dubu': { step, day, at } }, off: { 'waitFirst:dubu': true } (풀었으면 그만), last: { tonight: dayKey } }
 */
export function tipsOf(state) {
  const f = (state.flags ??= {});
  if (!f.tips || typeof f.tips !== 'object') f.tips = {};
  const t = f.tips;
  t.v ??= 1;
  for (const k of ['miss', 'seen', 'off', 'last']) if (!t[k] || typeof t[k] !== 'object') t[k] = {};
  return t;
}

export const tipKey = (id, slug) => (slug ? `${id}:${slug}` : id);

/**
 * 한 번 더 막혔다 → 새로 보여 줄 단계가 생겼으면 { id, slug, step, text } (아니면 null).
 * 같은 단계는 한 번만 보여 준다 (섬폰에서 다시 본다). off 면 세지 않는다.
 */
export function miss(t, id, slug = null, n = 1) {
  const tip = TIPS[id];
  if (!tip) return null;
  const k = tipKey(id, tip.who ? slug : null);
  if (t.off[k] || (t.seen[k]?.step ?? -1) >= tip.steps.length - 1) return null;   // 끝 단계까지 봤으면 더 세지 않는다
  const count = (t.miss[k] = (t.miss[k] ?? 0) + n);
  let step = -1;
  tip.steps.forEach((s, i) => { if (count >= s.after) step = i; });
  if (step < 0 || (t.seen[k] && t.seen[k].step >= step)) return null;
  return { id, slug: tip.who ? slug : null, key: k, step };
}

/** 보여 줬다고 적기 */
export function markSeen(t, shown, day = null, at = 0) {
  t.seen[shown.key] = { step: shown.step, day, at };
}

/** 그 주민과 잘 풀렸다 → 그 주민 힌트는 그만 (이미 본 것은 섬폰에 남는다) */
export function solved(t, slug) {
  for (const id of Object.keys(TIPS)) {
    if (!TIPS[id].who || TIPS[id].live) continue;
    t.off[tipKey(id, slug)] = true;
    delete t.miss[tipKey(id, slug)];
  }
}

/** 힌트 글 한 줄 → { icon, title, text } */
export function tipText(id, step = 0, vars = {}, { touch = false } = {}) {
  const tip = TIPS[id];
  if (!tip) return null;
  const s = tip.steps[Math.min(step, tip.steps.length - 1)];
  return { icon: tip.icon, title: fillTip(tip.title, vars), text: fillTip(touch && s.touch ? s.touch : s.text, vars), again: tip.again !== false };
}

/** 본 힌트 목록 (새 것부터) → [{ key, id, slug, step, day, at }] */
export function seenList(t) {
  return Object.entries(t.seen)
    .map(([key, s]) => { const [id, slug = null] = key.split(':'); return { key, id, slug, ...s }; })
    .filter(x => TIPS[x.id])
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

// ---------- 이모티콘 대화를 보고 막힌 것 고르기 ----------

/**
 * 판정 하나(festival:emote) → 걸리는 힌트 id 목록 (가장 또렷한 것부터). 판정 자체는 바꾸지 않는다.
 * rule = 주민 파일 emote.rule, keys = 보낸 이모티콘 (정리한 것), kind = 판정, conv = 이번 대화에서 { waited, greeted, puzzled(연속 갸웃 수) }
 */
export function missesOf(rule = {}, keys = [], kind = 'okay', conv = {}) {
  const k = keys.length ? keys : ['wait'];
  const low = rank(kind) <= rank('puzzled');
  const onlyWait = k.every(x => x === 'wait');
  const out = [];
  if (rule.waitFirst) {
    if (k.length > (rule.maxCalm ?? 2) && kind === 'retreat') out.push('waitFirstMany');
    else if (low && !onlyWait && !conv.waited) out.push('waitFirst');
  }
  if (rule.greetFirst && kind === 'puzzled' && !conv.greeted && !k.some(x => rule.greetFirst.includes(x))) out.push('greetFirst');
  if (rule.fewer && k.length >= 2 && rank(kind) <= rank('okay')) out.push('fewer');
  if (rule.more && k.length === 1 && kind === 'puzzled') out.push('more');
  if (low && !out.length && (conv.puzzled ?? 0) >= 1) out.push('puzzled');
  return out;
}

/** 이번 대화 상태 갱신 (judge.js 의 greeted·waited 와 같은 뜻 — 대화가 새로 열리면 비운다) */
export function nextConv(conv, rule = {}, keys = [], kind = 'okay') {
  const k = keys.length ? keys : ['wait'];
  const c = { ...conv };
  if (rule.waitFirst && k.every(x => x === 'wait') && k.length <= (rule.maxCalm ?? 2)) c.waited = true;
  if (rule.greetFirst && k.some(x => rule.greetFirst.includes(x))) c.greeted = true;
  c.puzzled = rank(kind) <= rank('puzzled') ? (c.puzzled ?? 0) + 1 : 0;
  return c;
}

// ---------- 친해지기 정도 (QA-13) ----------

/**
 * 축제 마음 열기까지 얼마나: v = state.villagers[slug], open = 축제 설정 parts.open { tier, wins }, tiers = rules.json town.tiers
 * → { friendship, need, wins, needWins, open }
 */
export function heartProgress(v, open = { tier: 'friend', wins: 2 }, tiers = [['new', 0], ['known', 10], ['friend', 30]]) {
  const need = tiers.find(([id]) => id === open.tier)?.[1] ?? 30;
  // wins = 마음이 통한 일 (7차 D50-A: open.ways 가 이모티콘·선물·부탁이면 셋을 다 센다)
  const friendship = Math.floor(v?.friendship ?? 0), wins = heartCount(v, open.ways), needWins = open.wins ?? 2;
  return { friendship, need, wins, needWins, open: friendship >= need && wins >= needWins, ways: open.ways ?? ['emote'] };
}

/** 말풍선 아래 하트 칸 글 (7차 D54-A): ♥ 22/30 · 🙂 1/2 */
export const heartMeter = p => `♥ ${Math.min(p.friendship, p.need)}/${p.need} · 🙂 ${Math.min(p.wins, p.needWins)}/${p.needWins}`;
/** 마음이 통한 일의 이름 (ways 에 따라) */
export const winsLabel = ways => (ways?.length > 1 ? '마음이 통한 일' : '이모티콘 대화 성공');
const WAY_NAME = { emote: '이모티콘 대화 성공', gift: '좋아하는 선물', favor: '부탁 들어주기' };

/** 진행 정도 알림 글 */
export function heartText(name, p) {
  const left = [];
  if (p.friendship < p.need) left.push(`친밀도 ${p.friendship}/${p.need}`);
  if (p.wins < p.needWins) left.push(`${winsLabel(p.ways)} ${p.wins}/${p.needWins}`);
  if (!left.length) return `${josa(name, '와')} 마음이 통했어요! 🎉 를 보내 축제 이야기를 들어 봐요.`;
  const how = (p.ways?.length ?? 1) > 1 ? ` (${p.ways.map(w => WAY_NAME[w] ?? w).join(' · ')} 모두 세요)` : '';
  return `${josa(name, '와')} 축제 이야기까지 — ${left.join(' · ')}${how}. 이모티콘 대화는 하루 3번까지 친해지고, 선물도 도와줘요.`;
}
