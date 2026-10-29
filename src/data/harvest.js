// 섬 채집을 하루 규칙에 맞춰 굴린다: 나무 흔들기·베기, 바위 치기, 화석 파기, 조개 줍기, 잡초 뽑기.
// 무엇이 나올지는 spawns, 오늘 몇 번 했는지는 state.island (day.js) 에 적는다.
// rng 를 안 주면 (섬 시드, 날, 물체 id, 횟수) 시드를 써서 다시 불러와도 같은 결과가 나온다.
import * as spawns from './spawns.js';
import { FRUIT_REGROW_DAYS, daysBetween, isDayKey } from './day.js';

export function createHarvest({ state, day }) {
  const island = () => state.island;
  const rngOf = (...salt) => day.rng(...salt);

  /** 이 나무에 열매가 열려 있나 (딴 지 FRUIT_REGROW_DAYS 일이 지나면 다시 열림) */
  function fruitReady(treeId) {
    const picked = island().fruit?.[treeId];
    if (!isDayKey(picked)) return true;
    const age = daysBetween(picked, day.key());
    return age >= FRUIT_REGROW_DAYS || age < 0;
  }

  /** 나무 흔들기 → { id, count, event? } | null.  opts: { fruit, orchard, hour, rng } */
  function shakeTree(treeId, kind, opts = {}) {
    const d = day.daily();
    const tree = (d.trees[treeId] ??= { shakes: 0, dropped: false });
    const hasFruit = kind === 'fruit-tree' || kind === 'palm';
    const rng = opts.rng ?? rngOf('shake', treeId, tree.shakes);
    const r = spawns.treeShake(kind, rng, { ...opts, fruitReady: hasFruit && fruitReady(treeId), dropped: tree.dropped });
    tree.shakes++;
    if (r && hasFruit && r.id.startsWith('fruit.')) (island().fruit ??= {})[treeId] = day.key();
    else if (r && r.id !== 'mat.branch') tree.dropped = true;
    return r;
  }

  /** 도끼로 나무 치기 → { id, count } | null (하루 CHOP_MAX_HITS 번) */
  function chopTree(treeId, rng) {
    const d = day.daily();
    const hits = d.chops[treeId] ?? 0;
    const r = spawns.chopWood(rng ?? rngOf('chop', treeId, hits), hits);
    if (r) d.chops[treeId] = hits + 1;
    return r;
  }

  /** 바위 치기 → { id, count } | null (하루 ROCK_MAX_HITS 번, 갈수록 덜 나옴) */
  function hitRock(rockId, rng) {
    const d = day.daily();
    const hits = d.rocks[rockId] ?? 0;
    const r = spawns.rock(rng ?? rngOf('rock', rockId, hits), hits);
    if (r) d.rocks[rockId] = hits + 1;
    return r;
  }
  /**
   * 바위를 친 뒤: 밑에서 곤충이 튀어나오나 → bug id | null. 바위 하나에 하루 한 번까지 (state.island.daily.rockBugs).
   * opts: { hour, month, weather, rng }
   */
  function rockBug(rockId, opts = {}) {
    const d = day.daily();
    const seen = (d.rockBugs ??= []);
    const key = String(rockId);
    if (seen.includes(key)) return null;
    const id = spawns.rockBug(opts.rng ?? rngOf('rock-bug', key, d.rocks[key] ?? 0), opts);
    if (id) seen.push(key);
    return id;
  }
  const rockHitsLeft = rockId => Math.max(0, spawns.ROCK_MAX_HITS - (day.daily().rocks[rockId] ?? 0));

  /** 오늘의 화석 자리 파기 → 'fossil.unknown' | null (이미 판 자리거나 오늘 4곳을 다 팠으면 null). 무슨 화석인지는 느루가 감정한다 */
  function digFossil(spotKey) {
    const d = day.daily();
    const key = String(spotKey);
    if (d.dug.includes(key) || d.dug.length >= d.fossils) return null;
    d.dug.push(key);
    return spawns.FOSSIL_UNKNOWN;
  }
  /** 감정 → 진짜 화석 id (가방 바꾸기는 부르는 쪽 몫) */
  const appraise = rng => spawns.appraise(rng ?? Math.random);
  const fossilsLeft = () => Math.max(0, day.daily().fossils - day.daily().dug.length);

  /** 해변 조개 줍기 → 조개 id | null. 조개 자리마다 오늘 무엇이 있는지 정해져 있다 */
  function pickShell(spotKey, rng) {
    const d = day.daily();
    const key = String(spotKey);
    if (d.shellsPicked.includes(key) || d.shellsPicked.length >= d.shells) return null;
    d.shellsPicked.push(key);
    return spawns.shell(rng ?? rngOf('shell', key));
  }
  /** 이 자리에 오늘 어떤 조개가 놓이나 (world 가 모양을 고를 때) */
  const shellAt = spotKey => spawns.shell(rngOf('shell', String(spotKey)));

  /** 잡초 뽑기 → { id: 'mat.weed', count: 1 } | null */
  function pullWeed() {
    const d = day.daily();
    if (d.weeds <= 0) return null;
    d.weeds--;
    return { id: 'mat.weed', count: 1 };
  }

  return {
    fruitReady, shakeTree, chopTree, hitRock, rockBug, rockHitsLeft, digFossil, appraise, fossilsLeft, pickShell, shellAt, pullWeed,
    /** 오늘 남은 수: 화석 자리·조개·잡초 (world 가 그만큼 배치한다) */
    today: () => {
      const d = day.daily();
      return { dayKey: day.key(), fossils: fossilsLeft(), shells: Math.max(0, d.shells - d.shellsPicked.length), weeds: d.weeds };
    },
  };
}
