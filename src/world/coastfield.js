// 해안 거리장 (three·DOM 없이 도는 순수 계산 — node 로도 확인할 수 있다). 그리기는 coast.js.
// 땅(바다·강물이 아닌 칸) 가면을 4배 촘촘한 격자에서 흐리게 → 문턱 THETA 의 등고선 = 부드러운 해안선, 그 바깥으로의 거리(칸).
import { KIND } from './island.js';

const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const R = 4;                 // 칸당 격자 수
export const M = 8;                 // 섬 둘레 여백 (칸)
export const SIGMA = 0.55;          // 해안선 흐림 (칸)
export const THETA = 0.28;          // 해안선 문턱 (0.5 보다 낮으면 바깥으로 부푼다 → 튀어나온 칸 모서리를 감싼다)
export const APRON = 1.15;          // 앞치마 폭 (해안선에서 바깥으로, 칸)
export const TOP = -0.008;          // 앞치마 윗면 (모래 타일 윗면 ≈ -0.004 바로 아래)
export const DROP = 0.5;            // 앞치마 바깥 끝 깊이
export const DMAX = 12;             // 텍스처에 담는 거리 한계 (칸)

/** 해안 거리장 만들기 (three 없이도 도는 순수 계산) */
export function coastField(gen) {
  const { w, h } = gen;
  const NX = (w + 2 * M) * R, NZ = (h + 2 * M) * R, N = NX * NZ;
  const x0 = -w / 2 - M + (gen.ox ?? 0), z0 = -h / 2 - M;          // 격자 왼쪽 위 (월드). gen.ox = 떨어뜨려 세운 섬(투어 섬)의 x 자리
  const kindAt = (tx, tz) => (tx < 0 || tz < 0 || tx >= w || tz >= h ? KIND.SEA : gen.kind[tz * w + tx]);
  // 칸 가운데 표본: 땅 = 바다·강물이 아님, 강 = 강물
  const land = new Float32Array(N), river = new Float32Array(N);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const tx = Math.floor(i / R) - M, tz = Math.floor(j / R) - M;
    const k = kindAt(tx, tz);
    land[j * NX + i] = k !== KIND.SEA && k !== KIND.WATER ? 1 : 0;
    river[j * NX + i] = k === KIND.WATER ? 1 : 0;
  }
  const v = blur(land, NX, NZ, SIGMA * R);
  const rv = blur(river, NX, NZ, 0.9 * R);
  const d = contourDistance(v, NX, NZ, R, THETA, DMAX);
  return {
    NX, NZ, x0, z0, R, d, river: rv,
    /** 월드 (x, z) 의 해안 거리 (칸, 이중 선형). 땅 안쪽 ≤ 0 */
    at(x, z) {
      const fi = (x - x0) * R - 0.5, fj = (z - z0) * R - 0.5;
      const i = Math.max(0, Math.min(NX - 2, Math.floor(fi))), j = Math.max(0, Math.min(NZ - 2, Math.floor(fj)));
      const u = Math.min(1, Math.max(0, fi - i)), t = Math.min(1, Math.max(0, fj - j));
      const c = j * NX + i;
      return (d[c] * (1 - u) + d[c + 1] * u) * (1 - t) + (d[c + NX] * (1 - u) + d[c + NX + 1] * u) * t;
    },
  };
}

/**
 * 흐린 가면 v 의 문턱 theta 등고선에서 바깥(v < theta 쪽)으로의 거리 (칸). 안쪽은 -1 ~ 0, 바깥은 dmax 까지.
 * 등고선 가까이는 기울기로 칸 안쪽까지 잰다 (부드럽게), 멀리는 모따기 거리 전파. 강 둑(banksfield.js)도 같이 쓴다.
 */
export function contourDistance(v, NX, NZ, R, theta, dmax) {
  const N = NX * NZ, THETA = theta;
  const d = new Float32Array(N).fill(1e9);
  for (let j = 1; j < NZ - 1; j++) for (let i = 1; i < NX - 1; i++) {
    const c = j * NX + i;
    const gx = (v[c + 1] - v[c - 1]) * R / 2, gz = (v[c + NX] - v[c - NX]) * R / 2;
    const g = Math.hypot(gx, gz);
    const s = g > 0.05 ? (THETA - v[c]) / g : (v[c] >= THETA ? -1 : 1e9);
    if (v[c] >= THETA) d[c] = Math.max(-1, Math.min(0, s));           // 안쪽 (앞치마 윗면)
    else if (s < 0.5) d[c] = Math.max(0, s);                          // 등고선 바로 바깥 (씨앗)
  }
  const a = 1 / R, b = Math.SQRT2 / R;
  // 안쪽 칸(≤ 0)은 해안선(0)으로 친다 → 안쪽 깊은 곳의 -1 이 바깥으로 새지 않게
  const relax = (c, n, step) => { const v2 = Math.max(0, d[n]) + step; if (v2 < d[c]) d[c] = v2; };
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 1; j < NZ - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const c = j * NX + i;
      if (d[c] <= 0) continue;
      relax(c, c - 1, a); relax(c, c - NX, a); relax(c, c - NX - 1, b); relax(c, c - NX + 1, b);
    }
    for (let j = NZ - 2; j > 0; j--) for (let i = NX - 2; i > 0; i--) {
      const c = j * NX + i;
      if (d[c] <= 0) continue;
      relax(c, c + 1, a); relax(c, c + NX, a); relax(c, c + NX + 1, b); relax(c, c + NX - 1, b);
    }
  }
  for (let c = 0; c < N; c++) d[c] = Math.min(dmax, d[c]);
  // 모따기 거리의 꺾인 줄을 살짝 문지른다 (등고선 바깥만)
  const ds = blur(d, NX, NZ, 1.2);
  for (let c = 0; c < N; c++) if (d[c] > 0.6) d[c] = ds[c];
  return d;
}

/** 가우스 흐림 (가로·세로 따로) */
export function blur(src, nx, nz, sigma) {
  const r = Math.ceil(sigma * 3), k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += (k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)));
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let s = 0;
    for (let q = -r; q <= r; q++) s += src[j * nx + Math.min(nx - 1, Math.max(0, i + q))] * k[q + r];
    tmp[j * nx + i] = s;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let s = 0;
    for (let q = -r; q <= r; q++) s += tmp[Math.min(nz - 1, Math.max(0, j + q)) * nx + i] * k[q + r];
    out[j * nx + i] = s;
  }
  return out;
}

/** 앞치마 높이: 해안선 안쪽은 모래 윗면, 바깥으로 부드럽게 내려가 바다 밑으로 */
export const apronY = dd => TOP - DROP * smoothstep(dd, 0, APRON);
/** 물가 선 (바다 판 높이 seaY 와 앞치마가 만나는 해안 거리) */
export function waterlineD(seaY) {
  let lo = 0, hi = APRON;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (apronY(m) > seaY) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
