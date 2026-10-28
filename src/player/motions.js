// 도구 동작 (절차적 한 번짜리 동작). 캐릭터 클립은 idle/walk/run/happy 뿐이라
// mixer.update 뒤에 팔·허리·머리 뼈를 부모 공간에서 더 돌려 휘두르기·던지기·파기·찍기·물 주기를 만든다.
// 매 프레임 클립이 뼈 회전을 새로 쓰므로 덧돌린 값이 쌓이지 않는다.
// 키 = [시각(0~1), { 뼈: [x, y, z] }] — 라디안, Euler 'YXZ' (X 로 들어 올리고 Y 로 돌린다). 빠진 뼈는 0.
//   팔: x 가 - 면 앞으로 들어 올림 (-π/2 = 앞으로 나란히, -π = 머리 위), z 는 바깥쪽 벌리기 (오른팔 -, 왼팔 +)
//   허리·머리: x 가 + 면 앞으로 숙임, y 는 몸 돌리기.
//   tool: 손목 꺾기 (x 가 - 면 도구 끝이 앞·아래로). 손목은 팔과 같이 돌아서, 팔을 θ 만큼 들면 도구도 θ 만큼 뒤로 젖혀진다 →
//         도구를 앞에서 φ(앞 수평 = 0, 위 = π/2) 로 겨누려면 tool x ≈ φ - 0.94 - θ (0.94 = 쥔 각도, 삽·물뿌리개는 tools.js GRIP 만큼 더)
import { Euler, Quaternion } from 'three';

const PARTS = ['armR', 'armL', 'spine', 'head', 'tool'];

// 낚싯대를 앞으로 내밀고 기다리는 자세 (던지기 끝 = 기다리기 = 감기 시작)
const FISH = { armR: [-0.95, 0.1, 0], armL: [-0.75, -0.25, 0.15], spine: [0.08, 0, 0], tool: [-1.15, 0, 0.2] };

/** dur 초, hit = 효과가 나는 순간(0~1), then = 끝난 뒤 이어서 잡고 있을 자세 */
export const MOTIONS = {
  // 잠자리채: 오른쪽 위에서 앞 아래로 쓸어내리기
  swing: { dur: 0.55, hit: 0.5, keys: [
    [0, {}],
    [0.32, { armR: [-2.7, 0.3, -0.2], armL: [-0.4, 0, 0.2], spine: [-0.1, 0.3, 0], tool: [-1.6, 0, 0.5] }],
    [0.55, { armR: [-1.25, 0, 0], armL: [-0.3, 0, 0.1], spine: [0.28, -0.15, 0], head: [0.15, 0, 0], tool: [-2.1, 0, 0.5] }],
    [0.78, { armR: [-0.95, -0.3, 0], spine: [0.22, -0.2, 0], head: [0.1, 0, 0], tool: [-2.2, 0, 0.7] }],
    [1, {}],
  ] },
  // 낚싯대: 어깨 뒤로 젖혔다가 앞으로 휙 → 기다리는 자세로
  cast: { dur: 0.75, hit: 0.55, then: 'fish', keys: [
    [0, {}],
    [0.38, { armR: [-2.95, 0.15, -0.1], armL: [-0.5, 0, 0.2], spine: [-0.18, 0.15, 0], head: [-0.15, 0, 0], tool: [-1.6, 0, 0.3] }],
    [0.58, { armR: [-1.4, 0, 0], armL: [-0.7, -0.2, 0.15], spine: [0.22, 0, 0], head: [0.05, 0, 0], tool: [-1.4, 0, 0.2] }],
    [0.8, { ...FISH, spine: [0.12, 0, 0] }],
    [1, FISH],
  ] },
  // 낚싯대 감기: 기다리는 자세에서 위로 홱 당겼다가 내린다
  reel: { dur: 0.45, hit: 0.35, keys: [
    [0, FISH],
    [0.38, { armR: [-2.5, 0.1, 0], armL: [-1.2, -0.2, 0.1], spine: [-0.15, 0, 0], head: [-0.2, 0, 0], tool: [-2.0, 0, 0.3] }],
    [0.7, { armR: [-1.6, 0, 0], spine: [-0.05, 0, 0], tool: [-1.4, 0, 0.2] }],
    [1, {}],
  ] },
  // 삽: 두 손으로 앞 땅을 찍고 흙을 떠 올린다
  dig: { dur: 0.8, hit: 0.55, keys: [
    [0, {}],
    [0.3, { armR: [-1.15, 0, 0.35], armL: [-1.15, 0, -0.35], spine: [0.15, 0, 0], tool: [-0.74, 0, 0] }],
    [0.55, { armR: [-0.7, 0, 0.35], armL: [-0.7, 0, -0.35], spine: [0.6, 0, 0], head: [0.25, 0, 0], tool: [0.42, 0, 0] }],
    [0.78, { armR: [-1.35, 0, 0.35], armL: [-1.35, 0, -0.35], spine: [0.2, 0, 0], tool: [-0.54, 0, 0] }],
    [1, {}],
  ] },
  // 도끼: 두 손으로 머리 위에서 내려찍기
  chop: { dur: 0.62, hit: 0.6, keys: [
    [0, {}],
    [0.38, { armR: [-2.85, 0, 0.3], armL: [-2.85, 0, -0.3], spine: [-0.22, 0, 0], head: [-0.2, 0, 0], tool: [-1.2, 0, 0.2] }],
    [0.6, { armR: [-1.25, 0, 0.3], armL: [-1.25, 0, -0.3], spine: [0.42, 0, 0], head: [0.12, 0, 0], tool: [-2.15, 0, 0.2] }],
    [0.8, { armR: [-1.1, 0, 0.3], armL: [-1.1, 0, -0.3], spine: [0.35, 0, 0], tool: [-2.15, 0, 0.2] }],
    [1, {}],
  ] },
  // 물뿌리개: 앞으로 내밀고 기울여 붓기
  water: { dur: 1.1, hit: 0.3, keys: [
    [0, {}],
    [0.22, { armR: [-1.25, -0.1, 0], spine: [0.1, 0, 0], tool: [-0.9, 0, 0] }],
    [0.36, { armR: [-1.2, -0.1, 0], spine: [0.18, 0, 0], head: [0.15, 0, 0], tool: [-1.45, 0, 0] }],
    [0.6, { armR: [-1.15, -0.2, 0], spine: [0.18, -0.1, 0], head: [0.15, 0, 0], tool: [-1.55, 0, 0] }],
    [0.82, { armR: [-1.2, 0.05, 0], spine: [0.15, 0.1, 0], head: [0.1, 0, 0], tool: [-1.45, 0, 0] }],
    [1, {}],
  ] },
  // 맨손으로 나무 흔들기: 두 팔로 줄기를 잡고 좌우로
  shake: { dur: 0.95, hit: 0.22, keys: [
    [0, {}],
    [0.14, { armR: [-1.45, 0, 0.2], armL: [-1.45, 0, -0.2], spine: [0.12, 0, 0] }],
    ...[0.24, 0.34, 0.44, 0.54, 0.64, 0.74].map((t, i) => {
      const s = i % 2 ? -1 : 1;
      return [t, { armR: [-1.45, 0.28 * s, 0.2], armL: [-1.45, 0.28 * s, -0.2], spine: [0.12, 0.2 * s, 0], head: [0, -0.15 * s, 0] }];
    }),
    [0.86, { armR: [-1.3, 0, 0.2], armL: [-1.3, 0, -0.2], spine: [0.08, 0, 0] }],
    [1, {}],
  ] },
  // 줍기: 허리 숙여 손 뻗기
  pickup: { dur: 0.5, hit: 0.5, keys: [
    [0, {}],
    [0.45, { armR: [-0.55, 0, 0.1], armL: [-0.35, 0, -0.05], spine: [0.75, 0, 0], head: [0.3, 0, 0] }],
    [0.6, { armR: [-0.6, 0, 0.1], armL: [-0.35, 0, -0.05], spine: [0.72, 0, 0], head: [0.3, 0, 0] }],
    [1, {}],
  ] },
  // 벌에 쏘였을 때: 두 팔 번쩍, 고개 도리도리
  ouch: { dur: 0.95, keys: [
    [0, {}],
    [0.18, { armR: [-2.7, 0, -0.45], armL: [-2.7, 0, 0.45], spine: [-0.15, 0, 0], head: [-0.3, 0, 0] }],
    [0.36, { armR: [-2.5, 0, -0.5], armL: [-2.5, 0, 0.5], spine: [-0.12, 0, 0], head: [-0.3, 0.45, 0] }],
    [0.52, { armR: [-2.6, 0, -0.45], armL: [-2.6, 0, 0.45], spine: [-0.12, 0, 0], head: [-0.3, -0.45, 0] }],
    [0.68, { armR: [-2.5, 0, -0.5], armL: [-2.5, 0, 0.5], spine: [-0.12, 0, 0], head: [-0.3, 0.4, 0] }],
    [0.86, { armR: [-0.6, 0, -0.2], armL: [-0.6, 0, 0.2] }],
    [1, {}],
  ] },
};
export const HOLDS = { fish: FISH };

const BLEND_IN = 0.08;   // 앞 자세에서 섞어 들어가는 시간 (초)
const BLEND_OUT = 0.1;   // 잡고 있던 자세를 놓을 때
const ease = t => t * t * (3 - 2 * t);

/** model = 캐릭터 장면, toolMount = 오른손에 붙은 도구 받침 */
export function createMotions(model, toolMount) {
  const bones = {
    armR: model.getObjectByName('armR') ?? model.getObjectByName('arm.R'),
    armL: model.getObjectByName('armL') ?? model.getObjectByName('arm.L'),
    spine: model.getObjectByName('spine'),
    head: model.getObjectByName('head'),
  };
  const toolBase = toolMount.quaternion.clone();
  const zero = () => Object.fromEntries(PARTS.map(p => [p, [0, 0, 0]]));
  let pose = zero();          // 지금 덧돌린 값
  let from = zero();          // 동작을 시작할 때의 자세 (섞어 들어가기)
  let cur = null;             // { name, def, t, hitDone, opts, resolve }
  let hold = null;            // 잡고 있는 자세 이름
  let holdBlend = 0;          // 잡은 자세 → 0 으로 놓는 중이면 1 → 0
  const e = new Euler(0, 0, 0, 'YXZ'), q = new Quaternion();

  function sample(keys, t, out) {
    let i = 1;
    while (i < keys.length - 1 && keys[i][0] < t) i++;
    const [t0, a] = keys[i - 1], [t1, b] = keys[i];
    const k = ease(Math.min(1, Math.max(0, (t - t0) / ((t1 - t0) || 1))));
    for (const p of PARTS) {
      const va = a[p] ?? [0, 0, 0], vb = b[p] ?? [0, 0, 0], o = out[p];
      for (let j = 0; j < 3; j++) o[j] = va[j] + (vb[j] - va[j]) * k;
    }
    return out;
  }
  const copy = (src, dst) => { for (const p of PARTS) for (let j = 0; j < 3; j++) dst[p][j] = src[p][j]; return dst; };

  function finish(done) {
    const c = cur;
    cur = null;
    if (!c) return;
    if (done && c.def.then) hold = c.def.then;
    c.resolve(done);
  }

  return {
    /** 동작 시작 → Promise<bool> (끝까지 하면 true, 다른 동작이 끊으면 false). opts: { speed, onHit } */
    play(name, opts = {}) {
      const def = MOTIONS[name];
      if (!def) return Promise.resolve(false);
      finish(false);
      copy(pose, from);
      hold = null;
      holdBlend = 0;
      return new Promise(resolve => { cur = { name, def, t: 0, el: 0, hitDone: def.hit == null, opts, resolve }; });
    },
    /** 잡고 있을 자세 (null = 놓기). 동작 중이면 동작이 끝난 뒤의 자세를 바꾼다 */
    hold(name) {
      if (name && !HOLDS[name]) return;
      if (!name && hold && !cur) { copy(pose, from); holdBlend = 1; }
      hold = name;
    },
    get active() { return cur?.name ?? null; },
    get holding() { return hold; },
    /** 이동을 막아야 하나 (동작 중) */
    get locked() { return !!cur && cur.opts.lock !== false; },
    cancel() { finish(false); hold = null; holdBlend = 0; },
    /** mixer.update 뒤에 부른다 */
    update(dt) {
      if (cur) {
        const c = cur;
        c.el += dt;
        c.t = Math.min(1, c.t + (dt * (c.opts.speed ?? 1)) / c.def.dur);
        sample(c.def.keys, c.t, pose);
        if (c.el < BLEND_IN) {
          const k = ease(c.el / BLEND_IN);
          for (const p of PARTS) for (let j = 0; j < 3; j++) pose[p][j] = from[p][j] + (pose[p][j] - from[p][j]) * k;
        }
        if (!c.hitDone && c.t >= c.def.hit) { c.hitDone = true; try { c.opts.onHit?.(); } catch (err) { console.error('[player] 동작 onHit', err); } }
        if (c.t >= 1) finish(true);
      } else if (hold) {
        const h = HOLDS[hold];
        for (const p of PARTS) for (let j = 0; j < 3; j++) pose[p][j] = h[p]?.[j] ?? 0;
      } else if (holdBlend > 0) {
        holdBlend = Math.max(0, holdBlend - dt / BLEND_OUT);
        const k = ease(holdBlend);
        for (const p of PARTS) for (let j = 0; j < 3; j++) pose[p][j] = from[p][j] * k;
      } else {
        const any = PARTS.some(p => pose[p].some(v => v !== 0));
        if (any) copy(zero(), pose);
      }
      // 덧돌리기 (부모 공간)
      for (const p of ['armR', 'armL', 'spine', 'head']) {
        const b = bones[p], v = pose[p];
        if (!b || (!v[0] && !v[1] && !v[2])) continue;
        q.setFromEuler(e.set(v[0], v[1], v[2], 'YXZ'));
        b.quaternion.premultiply(q);
      }
      const v = pose.tool;
      toolMount.quaternion.copy(toolBase);
      if (v[0] || v[1] || v[2]) toolMount.quaternion.multiply(q.setFromEuler(e.set(v[0], v[1], v[2], 'YXZ')));
    },
  };
}
