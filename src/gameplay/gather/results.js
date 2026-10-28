// 잡은 것·주운 것 챙기기: data.collect (도감 기록·도토리 주머니는 지갑으로) → 알림 → 가방이 차면 안내.
// 물고기·곤충·화석은 머리 위로 들어 보이며 기뻐한다 (player 'happy').
import { eul } from './util.js';

const SHOW = 1.5;   // 들어 보이는 시간 (초)

export function createResults(ctx, kit, mk, fx, { lock }) {
  const { THREE: T, scene } = ctx;
  const shown = [];
  const v = new T.Vector3();

  /** 머리 위로 들어 보이기 (mesh 를 주면 그걸, 없으면 아이템 모양) */
  function show(id, mesh = null) {
    const m = mesh ?? mk.item(id);
    m.scale.multiplyScalar(1.25);
    m.rotation.set(0, 0, 0);
    scene.add(m);
    shown.push({ m, t: 0 });
    kit.player?.headTop(v);
    fx.sparkle(v, 7);
  }

  return {
    show,
    /**
     * 챙기기 → collect 결과 { added, left, acorns }.
     * opts: { verb: '잡았다'|'주웠다'|'파냈다', show: 들어 보이기, mesh: 들어 보일 모델, quiet: 알림 없이 }
     */
    gain(id, n = 1, { verb = '주웠다', show: showIt = false, mesh = null, quiet = false } = {}) {
      const data = kit.data;
      if (!data?.collect) return { added: 0, left: n, acorns: 0 };
      const r = data.collect(id, n);
      const name = kit.name(id), icon = kit.icon(id);
      if (r.acorns) {
        kit.sfx('acorn');
        kit.toast(`도토리 ${r.acorns.toLocaleString('ko-KR')}개를 얻었다!`, '🌰');
      } else if (!quiet) kit.toast(`${eul(name)} ${verb}!`, icon);
      if (showIt) {
        show(id, mesh);
        kit.player?.play('happy');
        lock(SHOW);
      }
      if (r.left > 0) kit.toast(showIt ? '가방이 꽉 차서 놓아주었다…' : '가방이 꽉 찼어요!', '🎒');
      return r;
    },
    /** 가방에 들어가나 (도토리 주머니는 늘 들어간다) */
    fits(id, n = 1) {
      const it = kit.item(id);
      if (it?.acorns) return true;
      return (kit.data?.inventory?.canFit?.(id, n) ?? 0) >= n;
    },
    update(dt) {
      for (let i = shown.length - 1; i >= 0; i--) {
        const s = shown[i];
        s.t += dt;
        kit.player?.headTop(v);
        const up = Math.min(1, s.t / 0.25);
        s.m.position.set(v.x, v.y - 0.25 + up * 0.25 + Math.sin(s.t * 4) * 0.02, v.z);
        s.m.rotation.y = Math.PI / 2 + Math.sin(s.t * 2.2) * 0.4;      // 카메라(남쪽)에서 옆모습이 보이게
        if (s.t > SHOW) { scene.remove(s.m); shown.splice(i, 1); }
      }
    },
  };
}
