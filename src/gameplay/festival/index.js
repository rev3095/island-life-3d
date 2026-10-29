// 5차 Z5 축제·이모티콘 대화·엔딩 (검수 보드 z5, https://claude.ai/artifact/Cqjh9RiTwUn1CcPhCNtoWS). 설계: docs/notes/z5-festival.md
// 서비스 ctx.services.festival = { emote: { on(), session(V) }, emotes, ask(V, E), state, debug } — town/talk.js 가 대화를 열 때 쓴다.
// 이벤트 (보냄): festival:emote · festival:started · festival:part {n,total,id,name,emoji,booth} · festival:booth {id} · festival:ready ·
//               festival:start {first,day} · festival:photo {day,url} · festival:end. 광장·부스 자리는 world.places.festival (world/festival.js).
import { loadEmotes } from './emotes.js';
import { createEmoteTalk } from './talk.js';
import { createFestival } from './fest.js';
import { createBooths } from './booths.js';
import { ensureCss } from './talkui.js';

let F = null;

export default {
  name: 'festival',

  async init(ctx) {
    ensureCss();
    const emo = await loadEmotes();
    const talk = createEmoteTalk(ctx, emo);
    const fest = createFestival(ctx, emo);
    const booths = createBooths(ctx, emo, fest);
    const gp = ctx.services.gameplay?.interactions;
    if (gp) { fest.register(gp); booths.register(gp); }
    booths.restore();
    // 장면 동안엔 진행판을 숨긴다 (스토리 재생기가 HUD 를 숨기는 것과 같게)
    ctx.events.on('story:start', () => fest.hud.hide(true));
    ctx.events.on('story:end', () => fest.hud.hide(false));
    F = { ctx, emo, talk, fest, booths };
    ctx.services.festival = {
      emotes: emo,
      emote: { on: () => talk.on(), session: V => talk.session(V) },
      ask: (V, E) => fest.ask(V, E),
      state: fest.state,
      due: () => fest.festivalDue(),
      debug: { ...fest.debug, rhythm: () => booths.rhythm(), booth: id => booths.PLAY[id]?.(), ending: () => fest.ending(), startFestival: () => fest.startFestival() },
    };
  },

  update(dt) {
    if (!F) return;
    F.talk.update(dt);
  },
};
