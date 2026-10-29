// 5차 Z5 축제·이모티콘 대화·엔딩 (검수 보드 z5, https://claude.ai/artifact/Cqjh9RiTwUn1CcPhCNtoWS). 설계: docs/notes/z5-festival.md
// 서비스 ctx.services.festival = { emote: { on(), session(V) }, emotes } — town/talk.js 가 대화를 열 때 쓴다.
import { loadEmotes } from './emotes.js';
import { createEmoteTalk } from './talk.js';

let F = null;

export default {
  name: 'festival',

  async init(ctx) {
    const emo = await loadEmotes();
    const talk = createEmoteTalk(ctx, emo);
    ctx.state.festival ??= {};
    F = { ctx, emo, talk };
    ctx.services.festival = {
      emotes: emo,
      emote: { on: () => talk.on(), session: V => talk.session(V) },
    };
  },

  update(dt) {
    if (!F) return;
    F.talk.update(dt);
  },
};
