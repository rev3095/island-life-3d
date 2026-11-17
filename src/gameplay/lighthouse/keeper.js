// 서쪽 등대 (west-lighthouse D271-A · D272-A): 등대지기 윤슬 CH-20 (바다표범 노인) — 등대 앞에 늘 서 있다 (돌아다니지 않음).
// 배우는 행상 송이처럼 town/actor.js createActor (모델 assets/models/yunseul.glb.json, 처음에 받지 않는 daily 묶음과 같이 늦게 받아도 됨).
// 대사는 assets/villagers/yunseul.json (role keeper — town/people.js LINES). 말 걸기 = 지금 단계 · 필요한 재료와 개수 · 가방에 있는 수 · 도토리 → 건네기.
// 처음 가까이(cfg.keeper.see 칸) 오면 lighthouse:scene { kind: 'keeper' } → s66 (한 번, state.lighthouse.keeperMet).
import { createActor } from '../town/actor.js';

const NEAR = 1.6;

export function createKeeper(ctx, K, { onTalk, onFirst }) {
  const S = () => ctx.services;
  let actor = null, loading = null, spot = null, storyOn = false;

  async function show(at) {
    spot = at;
    loading ??= createActor(ctx, K.slug).then(a => (actor = a)).catch(e => { console.warn('[lighthouse] 등대지기 모델을 못 받았어요 (말은 걸 수 있어요)', e); return null; });
    const a = await loading;
    if (!a || !spot) return;
    a.root.visible = !storyOn;
    a.place(spot.x, spot.z, Math.PI);   // 남쪽(카메라 쪽)을 본다
    a.setOpacity?.(1); a.fadeTo = 1;
    a.play?.('idle');
  }
  function hide() { spot = null; if (actor) { actor.root.visible = false; actor.setOpacity?.(0); } }

  function inFront(outdoors) {
    const pl = S().player, p = pl?.position;
    if (!spot || !p || !outdoors) return null;
    const dx = spot.x - p.x, dz = spot.z - p.z, d = Math.hypot(dx, dz);
    if (d > NEAR) return null;
    return d < 0.6 || (dx * -Math.sin(pl.facing) + dz * -Math.cos(pl.facing)) / d > 0.2 ? spot : null;
  }
  /** 처음 만남 (가까이 오면 한 번) */
  function near(outdoors, met) {
    const p = S().player?.position;
    if (met || !spot || !p || !outdoors || S().story?.playing) return false;
    if (Math.hypot(spot.x - p.x, spot.z - p.z) >= (K.see ?? 7)) return false;
    onFirst(spot);
    return true;
  }

  return {
    show, hide, inFront, near,
    get spot() { return spot; },
    lookAtPlayer() { const p = S().player?.position; if (p) actor?.lookAt?.(p.x, p.z); },
    register(gp, outdoors, label) {
      gp.add({ name: 'lighthouse:keeper', intent: 'action', priority: 99, label, test: () => inFront(outdoors()), run: () => onTalk() });
      ctx.events.on('story:start', () => { storyOn = true; if (actor) actor.root.visible = false; });
      ctx.events.on('story:end', () => { storyOn = false; if (actor && spot) actor.root.visible = true; });
    },
    update(dt) { if (actor?.root.visible) actor.update(dt, true); },
    clear: () => (spot ? [{ x: spot.x, z: spot.z, r: 0.9 }] : []),
  };
}
