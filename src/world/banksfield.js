// 강 둑·풀/모래 경계 거리장 (three·DOM 없이 도는 순수 계산 — node 로도 확인할 수 있다). 그리기는 banks.js.
// 해안선(coastfield.js)과 같은 방식: 칸 가면을 촘촘한 격자에서 흐리게 → 문턱 등고선 = 부드러운 경계.
//  1. 강 둑: 높이(층)마다 '같은 층의 땅' 가면을 흐려 강물 칸 쪽으로의 거리. 등고선이 칸 경계보다 조금 물 쪽으로 부풀어
//     튀어나온 땅 모서리를 감싸고, 물 칸 모서리(안쪽으로 꺾인 곳)는 둥글게 메운다.
//  2. 풀/모래: 같은 층의 풀·모래 칸만 보고 '모래 정도'(0 풀 ~ 1 모래)를 흐린다 → 0.5 가 부드러운 경계 (셰이더가 다시 칠한다).
import { KIND } from './island.js';
import { blur, contourDistance } from './coastfield.js';

const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const BANK = {
  R: 8,              // 칸당 격자 수 (둑은 좁아서 해안보다 촘촘하게)
  PAD: 2,            // 강물 칸을 감싸는 네모 둘레 여백 (칸)
  SIGMA: 0.32,       // 경계 흐림 (칸) — 모서리 둥근 정도
  THETA: 0.27,       // 문턱 (0.25 = 튀어나온 땅 모서리 바로 위 → 그보다 조금 높게 둬서 모서리를 덮는다)
  TOP: -0.006,       // 둑 윗면 (풀 타일 윗면 0 · 모래 -0.004 바로 아래)
  DROP: 0.36,        // 둑 바깥 끝 깊이 (물 밑으로)
  W: 0.16,           // 둑 비탈 폭 (칸) — 좁을수록 벽처럼 선다
  REACH: 0.5,        // 물 칸 안에서 둑 판을 까는 거리 (칸)
  FALL: 1.8,         // 폭포 가까이(칸)는 둑을 칸 경계로 되돌린다 (폭포 판이 강 너비 그대로라 좁아지면 둑 위로 떨어진다)
};
// 곧은 둑에서 등고선이 칸 경계보다 물 쪽으로 나온 거리 (흐린 반평면 = 정규분포 누적 → 문턱 THETA 자리)
const BULGE = (() => { let lo = 0, hi = 3; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (normalTail(m) > BANK.THETA) lo = m; else hi = m; } return lo * BANK.SIGMA; })();
function normalTail(x) {      // P(Z > x)
  const t = 1 / (1 + 0.2316419 * x), y = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  return y * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
}
export const GROUND = {
  R: 4,              // 칸당 격자 수 (풀/모래 경계)
  SIGMA: 0.42,       // 흐림 (칸)
};

/** 둑 높이: 등고선 안쪽은 땅 윗면, 바깥으로 빠르게 내려가 물 밑으로 (칸 높이 기준) */
export const bankY = d => BANK.TOP - BANK.DROP * smoothstep(d, 0, BANK.W);
/** 물가 선 (물 윗면 높이 waterY 와 둑이 만나는 거리) */
export function bankWaterline(waterY) {
  let lo = 0, hi = BANK.W;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bankY(m) > waterY) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/** 둑 쪽 땅으로 치는 칸 (같은 층일 때): 풀·모래·길·광장 */
const BANK_LAND = new Set([KIND.GRASS, KIND.SAND, KIND.PATH, KIND.PLAZA]);

/**
 * 강 둑 거리장 → 층마다 { level, NX, NZ, x0, z0, R, d(거리, 칸), land(가장 가까운 땅 칸 종류), tx0, tz0 }.
 * d 는 그 층 강물 칸 안에서만 쓴다 (땅 쪽 ≤ 0, 물 쪽 > 0).
 */
export function riverBanks(gen) {
  const { w, h } = gen;
  const { R, PAD, SIGMA, THETA } = BANK;
  const kindAt = (tx, tz) => (tx < 0 || tz < 0 || tx >= w || tz >= h ? KIND.SEA : gen.kind[tz * w + tx]);
  const levelAt = (tx, tz) => (tx < 0 || tz < 0 || tx >= w || tz >= h ? 0 : gen.level[tz * w + tx]);
  // 층마다 강물 칸을 감싸는 네모
  const boxes = new Map();
  for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
    if (kindAt(tx, tz) !== KIND.WATER) continue;
    const L = levelAt(tx, tz);
    const b = boxes.get(L) ?? { x0: tx, z0: tz, x1: tx, z1: tz };
    b.x0 = Math.min(b.x0, tx); b.z0 = Math.min(b.z0, tz); b.x1 = Math.max(b.x1, tx); b.z1 = Math.max(b.z1, tz);
    boxes.set(L, b);
  }
  const out = [];
  for (const [level, b] of boxes) {
    const tx0 = b.x0 - PAD, tz0 = b.z0 - PAD, TW = b.x1 - b.x0 + 1 + 2 * PAD, TH = b.z1 - b.z0 + 1 + 2 * PAD;
    const NX = TW * R, NZ = TH * R, N = NX * NZ;
    const mask = new Float32Array(N);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const tx = tx0 + Math.floor(i / R), tz = tz0 + Math.floor(j / R);
      mask[j * NX + i] = BANK_LAND.has(kindAt(tx, tz)) && levelAt(tx, tz) === level ? 1 : 0;
    }
    const d = contourDistance(blur(mask, NX, NZ, SIGMA * R), NX, NZ, R, THETA, 4);
    // 폭포 둘레: 등고선을 칸 경계 쪽으로 밀어 강 너비를 되찾는다 (폭포 칸 남쪽 가장자리 = 떨어지는 선, 위·아래 층 모두)
    const falls = (gen.waterfalls ?? []).map(f => ({ x0: f.tx, x1: f.tx + 1, z: f.tz + 1 }));
    if (falls.length) {
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const x = tx0 + (i + 0.5) / R, z = tz0 + (j + 0.5) / R;
        let near = Infinity;
        for (const f of falls) near = Math.min(near, Math.hypot(Math.max(f.x0 - x, 0, x - f.x1), z - f.z));
        if (near < BANK.FALL) d[j * NX + i] += BULGE * (1 - smoothstep(near, 0.4, BANK.FALL));
      }
    }
    // 칸마다 가장 가까운 같은 층 땅 칸 종류 (둑 윗면 색): 강물 칸이면 둘레 8칸 중 변으로 붙은 것 먼저
    const land = new Uint8Array(TW * TH);
    for (let tz = 0; tz < TH; tz++) for (let tx = 0; tx < TW; tx++) {
      const gx = tx0 + tx, gz = tz0 + tz, k = kindAt(gx, gz);
      let best = BANK_LAND.has(k) ? k : 0;
      if (!best) {
        for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nk = kindAt(gx + a, gz + c);
          if (BANK_LAND.has(nk) && levelAt(gx + a, gz + c) === level) { best = nk; break; }
        }
      }
      land[tz * TW + tx] = best || KIND.GRASS;
    }
    out.push({
      level, NX, NZ, R, tx0, tz0, TW, TH, d, land,
      x0: tx0 - w / 2 + (gen.ox ?? 0), z0: tz0 - h / 2,            // 격자 왼쪽 위 (월드, gen.ox = 투어 섬 x 자리)
      /** 격자 꼭짓점 (i, j) 의 거리 (둘레 네 칸 평균) */
      nodeD(i, j) {
        const ii = [Math.max(0, i - 1), Math.min(NX - 1, i)], jj = [Math.max(0, j - 1), Math.min(NZ - 1, j)];
        return (d[jj[0] * NX + ii[0]] + d[jj[0] * NX + ii[1]] + d[jj[1] * NX + ii[0]] + d[jj[1] * NX + ii[1]]) / 4;
      },
      /** 격자 칸 (i, j) 가 이 층의 강물 칸 안인가 */
      inWater(i, j) {
        const tx = tx0 + Math.floor(i / R), tz = tz0 + Math.floor(j / R);
        return kindAt(tx, tz) === KIND.WATER && levelAt(tx, tz) === level;
      },
      /** 격자 꼭짓점 둘레 땅 칸 종류 */
      landAt(i, j) {
        const tx = Math.min(TW - 1, Math.max(0, Math.floor((i - 0.5) / R))), tz = Math.min(TH - 1, Math.max(0, Math.floor((j - 0.5) / R)));
        return land[tz * TW + tx];
      },
    });
  }
  return out;
}

/**
 * 풀/모래 경계: 칸 격자 R 배에서 '모래 정도' (0 풀 · 1 모래, 같은 층의 풀·모래 칸만 센다).
 * 다른 종류 칸은 무게 0 (경계를 밀지 않는다). → { NX, NZ, R, x0, z0, s: Uint8Array(0~255) }
 */
export function groundBlend(gen) {
  const { w, h } = gen;
  const { R, SIGMA } = GROUND;
  const NX = w * R, NZ = h * R, N = NX * NZ;
  const s = new Uint8Array(N);
  const levels = new Set();
  for (let i = 0; i < w * h; i++) if (gen.kind[i] === KIND.GRASS || gen.kind[i] === KIND.SAND) levels.add(gen.level[i]);
  for (const L of levels) {
    const num = new Float32Array(N), den = new Float32Array(N);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const t = Math.floor(j / R) * w + Math.floor(i / R), k = gen.kind[t];
      if (gen.level[t] !== L || (k !== KIND.GRASS && k !== KIND.SAND)) continue;
      den[j * NX + i] = 1;
      num[j * NX + i] = k === KIND.SAND ? 1 : 0;
    }
    const bn = blur(num, NX, NZ, SIGMA * R), bd = blur(den, NX, NZ, SIGMA * R);
    for (let c = 0; c < N; c++) {
      if (!den[c]) continue;                                  // 이 층의 풀·모래 칸만 쓴다
      s[c] = Math.round(255 * Math.min(1, Math.max(0, bn[c] / Math.max(bd[c], 1e-4))));
    }
  }
  return { NX, NZ, R, x0: -w / 2 + (gen.ox ?? 0), z0: -h / 2, s };
}
