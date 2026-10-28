// 시드 난수와 부드러운 잡음. 같은 시드면 늘 같은 섬이 나온다.

/** mulberry32: 0 이상 1 미만 실수를 돌려주는 함수를 만든다. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 정수 좌표 해시 → 0~1 */
function hash2(seed, x, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 값 잡음 (격자 크기 cell). 숲·빈터처럼 넓게 바뀌는 밀도에 쓴다. */
export function valueNoise(seed, cell = 8) {
  const s = t => t * t * (3 - 2 * t);
  return (x, z) => {
    const gx = x / cell, gz = z / cell;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = s(gx - ix), fz = s(gz - iz);
    const a = hash2(seed, ix, iz), b = hash2(seed, ix + 1, iz), c = hash2(seed, ix, iz + 1), d = hash2(seed, ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
}

/** 배열 섞기 (제자리) */
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
