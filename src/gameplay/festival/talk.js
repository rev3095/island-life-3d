// 이모티콘 대화 (검수 보드 z5 D14-A · D15-A · D17-A · D18-A). town/talk.js 가 대화를 열 때 session(V) 을 받아
// 글 대신 말풍선(say)·고르기(choose)·자유롭게 보내기(chat)로 쓴다. 친밀도·부탁·선물 규칙은 town/rules.js 그대로.
// 섬폰 설정 '주민 글 대사 보기'(settings.textLines)를 켜면 예전 글 대화로 돌아간다.
import { judge, greetOf, tutorialOk, countPoints, wantOf } from './judge.js';
import { openTalkUI } from './talkui.js';
import { CAT_TOKEN } from './emotes.js';
import { villagerState, addFriendship, tierOf, slotOf } from '../town/rules.js';

/** 몸짓 길이(초)와 모양 — 동작 모델(AN-01–05)이 생기기 전엔 모델을 살짝 기울이고 흔든다 */
const MOTION = {
  nod: { t: 0.7, f: (k, m) => { m.rotation.x = Math.sin(k * Math.PI * 4) * 0.16 * (1 - k); } },
  tilt: { t: 0.9, f: (k, m) => { m.rotation.z = Math.sin(Math.min(1, k * 2.2) * Math.PI / 2) * 0.28 * (k < 0.75 ? 1 : (1 - k) * 4); } },
  shake: { t: 0.8, f: (k, m) => { m.rotation.y = Math.sin(k * Math.PI * 4) * 0.35 * (1 - k); } },
  back: { t: 0.9, f: (k, m) => { m.position.z = -Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 0.18 * (k < 0.7 ? 1 : (1 - k) / 0.3); m.rotation.x = -0.12 * Math.sin(k * Math.PI); } },
  jump: { t: 0.6, f: (k, m) => { m.position.y = Math.sin(k * Math.PI) * 0.25; } },
};
MOTION.hop = MOTION.jump; MOTION.flap = MOTION.jump; MOTION.wag = MOTION.nod; MOTION.sway = MOTION.tilt;
MOTION.yawn = MOTION.tilt; MOTION.droop = MOTION.back; MOTION.turn = MOTION.shake; MOTION.rub = MOTION.nod; MOTION.puff = MOTION.tilt; MOTION.curl = MOTION.tilt;

export function createEmoteTalk(ctx, emo, cfg = {}) {
  // D14 대화 방식: emote(이모티콘으로만, 반영 v1) · emote+text(이모티콘 + 짧은 글 — 아직 없어서 emote 로) · text(글 대사 그대로)
  const MODE = cfg.talk?.mode ?? 'emote';
  if (!['emote', 'text'].includes(MODE)) console.warn(`[festival] 설정 talk.mode = ${MODE} 은 아직 없어서 emote 로 해요`);
  const rules = emo.rules;
  const motions = [];
  let active = null;
  const fest = () => (ctx.state.festival ??= {});

  function gesture(V, name) {
    if (!V?.actor) return;
    if (name === 'happy') { V.happy?.(); return; }
    const M = MOTION[name];
    const m = V.actor.model;
    if (!M || !m) return;
    for (const g of motions) if (g.m === m) g.t = g.M.t;   // 하던 몸짓은 끝낸다
    motions.push({ m, M, t: 0 });
  }

  /** 지금 대화 상대에게 말을 거는 도구 묶음. town/talk.js 가 쓴다 */
  function session(V) {
    const P = V.person;
    const c0 = () => {
      const time = ctx.services.time;
      const d = new Date();
      const now = time?.now?.() ?? { hour: d.getHours(), minute: d.getMinutes(), dayKey: d.toISOString().slice(0, 10) };
      return { now, slot: slotOf(now), weather: time?.weather ?? 'clear', dayKey: now.dayKey ?? ctx.services.data?.day?.key?.() };
    };
    const ui = openTalkUI(ctx, emo, { name: P.name, color: P.color, voice: P.voice ?? V.slug });
    active = { V, ui };
    const talkable = !!rules.villagers[V.slug];
    const st = { greeted: false, waited: false, lastSaid: [] };

    const S = {
      /** 글 대화의 say 자리: lines 는 무시하고 emotes 를 말풍선으로. choices 가 있으면 choiceEmotes 로 고르기. opts.meter = 말풍선 아래 하트 칸 */
      say(lines, choices, emotes, choiceEmotes, opts) {
        const toks = emotes?.length ? emotes : ['dots'];
        st.lastSaid = toks.filter(t => !String(t).startsWith('item:'));
        if (Array.isArray(choices) && choices.length) {
          const opts = choiceEmotes?.length === choices.length ? choiceEmotes : choices.map((_, i) => [['good', 'wait', 'sad', 'wave'][i] ?? 'dots']);
          return ui.choose(toks, opts);
        }
        return ui.say(toks, opts);
      },
      /** 인사 말풍선 낱말 */
      greet({ first, bday } = {}) {
        const c = c0();
        const v = villagerState(ctx.state, V.slug);
        const g = greetOf(rules, V.slug, { slot: c.slot, weather: c.weather, tier: tierOf(v.friendship) });
        if (first) return ['wave', 'smile', rules.villagers[V.slug]?.likes?.find(k => k !== 'wave' && k !== 'smile') ?? 'heart'];
        if (bday) return ['party', 'grin', 'gift'];
        return g;
      },
      reqToken: req => (req?.id && ctx.services.data?.items?.get?.(req.id) ? `item:${req.id}` : CAT_TOKEN[req?.cat] ?? 'gift'),
      gesture: name => gesture(V, name),
      /**
       * 자유 대화: 플레이어가 이모티콘을 골라 보낸다. 🎁 하나 = 선물 주기, ❓ 하나 = 부탁 있어?, 🎉 하나 = 축제 이야기(있으면), 잘 가 = 끝.
       * h = { gift(), request(), festival?() → true 면 처리함, note(up), things() → 물건 탭에 더할 낱말, special?(낱말) → 'end' 끝 · true 처리함 · null 보통 판정 (M15) }
       */
      async chat(h = {}) {
        if (!talkable) { await ui.say(['smile', 'wave']); return; }
        if (!fest().talkTutorial) await tutorial(h);
        const v = villagerState(ctx.state, V.slug);
        for (let turn = 0; turn < 12 && !ui.closed; turn++) {
          const c = c0();
          const e = v.emote ?? {};
          const want = wantOf(rules.villagers[V.slug], V.slug, c.dayKey);
          const wantDone = e.day === c.dayKey && e.wantDone;
          const keep = turn === 0 && want && !wantDone ? ['bubble', want] : null;
          const keys = await ui.compose({ things: h.things?.() ?? [], keep });
          if (keys == null) break;
          const one = keys.length === 1 ? keys[0] : null;
          if (one === 'gift' && h.gift) { await h.gift(); continue; }
          if (one === 'ask' && h.request) { await h.request(); continue; }
          if (one === 'party' && h.festival && (await h.festival())) continue;
          const sp = one && h.special ? await h.special(one) : null;   // M15 같이 하기 (town/talk.js) — 'end' 면 대화를 끝낸다
          if (sp === 'end') break;
          if (sp) continue;
          const res = judge(rules, V.slug, keys.filter(k => !String(k).startsWith('item:')), { dayKey: c.dayKey, weather: c.weather, want: wantDone ? null : want, ...st });
          st.greeted = res.greeted; st.waited = res.waited;
          const pts = countPoints(rules, v, c.dayKey, res.points);
          if (pts > 0) h.note?.(addFriendship(v, pts).up);
          if (res.matchedWant && (res.kind === 'delight' || res.kind === 'happy')) v.emote.wantDone = true;
          gesture(V, MOTION[res.gesture] || res.gesture === 'happy' ? res.gesture : res.gestureBase);
          ctx.events.emit('festival:emote', { slug: V.slug, keys: res.keys, kind: res.kind, points: pts });
          if (res.kind === 'delight') ctx.events.emit('sfx', { name: 'acorn', volume: 0.5 });
          await S.say(null, null, res.reply);
        }
        if (!ui.closed) { gesture(V, 'nod'); await ui.say(['wave']); }
      },
      close() { ui.close(); if (active?.ui === ui) active = null; },
      get closed() { return ui.closed; },
    };

    /** 첫 이모티콘 대화: 연습 세 번 (주민 말에 맞게 답하기, 틀리면 갸웃 → 다시) */
    async function tutorial() {
      for (let i = 0; i < rules.tutorial.length && !ui.closed; i++) {
        const t = rules.tutorial[i];
        for (let tries = 0; tries < 4 && !ui.closed; tries++) {
          const keys = await ui.compose({ keep: t.say });
          if (keys == null) return;
          if (tutorialOk(rules, i, keys) || tries === 3) { gesture(V, 'happy'); await ui.say(['sparkle', 'grin']); break; }
          gesture(V, 'tilt');
          await ui.say(['think', 'bubble', t.ok[0]]);
        }
      }
      if (!ui.closed) fest().talkTutorial = true;
    }
    return S;
  }

  return {
    /** 이모티콘 대화를 쓰나 (섬폰 '주민 글 대사 보기' 가 꺼져 있으면) */
    on: () => MODE !== 'text' && ctx.state.settings?.textLines !== true,
    session,
    update(dt) {
      for (let i = motions.length - 1; i >= 0; i--) {
        const g = motions[i];
        g.t += dt;
        const k = Math.min(1, g.t / g.M.t);
        g.M.f(k, g.m);
        if (k >= 1) { g.m.rotation.set(0, 0, 0); g.m.position.set(0, 0, 0); motions.splice(i, 1); }
      }
      if (active && !active.ui.closed) active.ui.place(active.V.actor.position, active.V.actor.height ?? 1, ctx.camera);
    },
  };
}
