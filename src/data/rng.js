// 시드 난수. 같은 시드면 같은 결과가 나와서 하루 리셋·상점 물건·테스트가 다시 돌려도 똑같다.

/** 문자열·숫자 여러 개 → 32비트 시드 (xmur3 해시) */
export function hashSeed(...parts) {
  const str = parts.map(String).join('|');
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** 시드 → () => [0, 1) 난수 함수 (mulberry32) */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 여러 값으로 바로 난수 함수 만들기: rngFor(섬시드, dayKey, 'shop') */
export const rngFor = (...parts) => createRng(hashSeed(...parts));

/** min 이상 max 이하 정수 */
export const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

/** 가중치대로 하나 고르기. list 가 비면 null */
export function pickWeighted(list, weightOf, rng = Math.random) {
  let total = 0;
  for (const x of list) total += Math.max(0, weightOf(x));
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of list) {
    r -= Math.max(0, weightOf(x));
    if (r < 0) return x;
  }
  return list[list.length - 1];
}

/** 겹치지 않게 n 개 뽑기 (원래 배열은 그대로) */
export function sample(list, n, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, n));
}
