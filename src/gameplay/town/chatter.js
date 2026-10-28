// 주민끼리 수다: 가까이 서서 쉬는 두 주민을 짝지어 마주 보게 하고, 번갈아 짧은 말풍선을 띄운다.
import { pickLines, fill } from './rules.js';

const LOOK_EVERY = 1.5;       // 짝 찾기 간격 (초)
const NEAR = 2.2;             // 이 거리 안의 두 주민
const CHANCE = 0.35;
const COOLDOWN = 45;          // 한 번 수다 떤 주민은 잠깐 쉰다

export function createChatter(villagers, lines) {
  let look = LOOK_EVERY;
  const pairs = [];

  function tryPair() {
    const free = villagers.filter(V => V.mode === 'idle' && V.talkable && V.clock - V.chatAt > COOLDOWN);
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j], p = a.actor.position, q = b.actor.position;
      if (Math.hypot(p.x - q.x, p.z - q.z) > NEAR || Math.abs(p.y - q.y) > 0.5 || Math.random() > CHANCE) continue;
      const t = 6 + Math.random() * 5;
      a.startChat(b, t); b.startChat(a, t);
      pairs.push({ who: [a, b], turn: Math.random() < 0.5 ? 0 : 1, t: 0.4 });
      return;
    }
  }

  function update(dt) {
    if ((look -= dt) <= 0) { look = LOOK_EVERY; tryPair(); }
    for (let i = pairs.length - 1; i >= 0; i--) {
      const pr = pairs[i], [a, b] = pr.who;
      if (a.mode !== 'chat' || b.mode !== 'chat' || a.partner !== b || b.partner !== a) {
        if (a.partner !== b) a.bubble = null;
        if (b.partner !== a) b.bubble = null;
        pairs.splice(i, 1);
        continue;
      }
      if ((pr.t -= dt) > 0) continue;
      pr.turn ^= 1;
      pr.t = 1.5 + Math.random() * 0.9;
      const s = pr.who[pr.turn], o = pr.who[1 - pr.turn];
      s.bubble = fill(pickLines(lines[s.slug]?.banter, Math.random, (s.recentBanter ??= []))[0] ?? '…', { other: o.person.name });
      o.bubble = null;
      if (Math.random() < 0.15) s.happy();
    }
  }

  return { update, pairs };
}
