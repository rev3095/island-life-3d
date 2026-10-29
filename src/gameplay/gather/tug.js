// 큰 물고기 줄다리기 (4차 Y2) 순수 규칙. 그림자 5~6 은 덥석 문 뒤 바로 올라오지 않고 버틴다.
// 물고기가 당기는 동안(pull)은 찌가 잠기고, 힘이 빠지는 짧은 틈(slack)에 찌가 떠오른다 — 그때 Space/A 로 당긴다.
// 당기는 동안 누르면 줄이 팽팽해지고(tension), 너무 빨리 연달아 눌러도 팽팽해진다. 1 이 되면 줄이 끊긴다.
// 틈을 여러 번 놓치면 물고기가 줄을 끌고 도망간다. fishing.js 가 화면·소리를 맡고, 여기는 수만 센다 (tests/content.test.mjs).

export const TUG = {
  minShadow: 5,           // 이 크기부터 줄다리기
  pull: [0.7, 1.25],      // 물고기가 당기는 시간 (초)
  slack: [0.55, 0.48],    // 틈 길이: 크기 5 · 6
  wrong: 0.45,            // 당기는 동안 누르면 늘어나는 팽팽함
  fast: 0.3,              // 연달아 너무 빨리 누르면 더 늘어남
  fastGap: 0.22,          // 이보다 짧은 간격이면 '너무 빨리'
  decay: 0.3,             // 초당 풀리는 팽팽함
  maxMiss: 3,             // 틈을 연달아 이만큼 놓치면 도망
};

/** 그림자 크기로 줄다리기를 하나 */
export const needsTug = size => (size ?? 0) >= TUG.minShadow;
/** 당겨야 하는 횟수: 크기 5 → 3번, 6 → 4번 */
export const pullsFor = size => (size >= 6 ? 4 : 3);

/** 줄다리기 하나 시작 (rng 를 주면 같은 흐름) */
export function createTug(size, rng = Math.random) {
  return {
    size, rng, phase: 'pull', timer: lerp(TUG.pull, rng()), left: pullsFor(size), total: pullsFor(size),
    tension: 0, miss: 0, clock: 0, lastPress: -9, done: null,
  };
}
const lerp = ([a, b], k) => a + (b - a) * k;
const slackOf = s => (s.size >= 6 ? TUG.slack[1] : TUG.slack[0]);

/** 시간 흐르기 → 바뀐 일: 'slack'(틈이 생김) · 'pull'(다시 당김) · 'escape'(도망) · null */
export function tugStep(s, dt) {
  if (s.done) return null;
  s.clock += dt;
  s.tension = Math.max(0, s.tension - TUG.decay * dt);
  s.timer -= dt;
  if (s.timer > 0) return null;
  if (s.phase === 'pull') {
    s.phase = 'slack';
    s.timer = slackOf(s);
    return 'slack';
  }
  // 틈을 놓쳤다
  if (++s.miss >= TUG.maxMiss) { s.done = 'escape'; return 'escape'; }
  s.phase = 'pull';
  s.timer = lerp(TUG.pull, s.rng());
  return 'pull';
}

/** Space/A → 'good'(한 번 당김) · 'caught'(다 당김) · 'strain'(팽팽해짐) · 'snap'(끊김) · null(이미 끝) */
export function tugPress(s) {
  if (s.done) return null;
  const fast = s.clock - s.lastPress < TUG.fastGap;
  s.lastPress = s.clock;
  if (s.phase === 'slack') {
    s.left--;
    s.miss = 0;
    if (fast) s.tension += TUG.fast;
    if (s.left <= 0) { s.done = 'caught'; return 'caught'; }
    s.phase = 'pull';                    // 당기면 물고기가 다시 버틴다
    s.timer = lerp(TUG.pull, s.rng());
    return 'good';
  }
  s.tension += TUG.wrong + (fast ? TUG.fast : 0);
  if (s.tension >= 1) { s.done = 'snap'; return 'snap'; }
  return 'strain';
}
