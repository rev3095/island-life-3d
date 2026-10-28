// 시각·날씨 → 하늘색·조명 값. three 없이 sRGB [r,g,b](0~1) 배열로 계산한다.
// 하늘 팔레트는 컨셉 보드 PAL-T1~T4. 위(천정)는 차갑고 어두운 쪽, 지평선은 밝고 따뜻한 쪽.
import { smoothstep, dayHour, blendHour } from './clock.js';

export const hex = h => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};

// PAL-T1 새벽 #F9C9A5/#A9C9EE · T2 낮 #8FD3F4/#D8F1FF · T3 노을 #F59E79/#7A6BB3 · T4 밤 #1E2A5A/#3B4D8A
export const SKY = {
  dawn: { zenith: '#A9C9EE', horizon: '#F9C9A5', hemiSky: '#FFE4D2', hemiGround: '#B3AE98', hemiI: 1.3, sun: '#FFC9A0', sunI: 1.8 },
  day: { zenith: '#8FD3F4', horizon: '#D8F1FF', hemiSky: '#EEF8FF', hemiGround: '#C9D79F', hemiI: 1.5, sun: '#FFF8EC', sunI: 2.3 },
  dusk: { zenith: '#7A6BB3', horizon: '#F59E79', hemiSky: '#FFCDB3', hemiGround: '#9A88A8', hemiI: 1.2, sun: '#FF9C68', sunI: 1.9 },
  night: { zenith: '#1E2A5A', horizon: '#3B4D8A', hemiSky: '#98ACEC', hemiGround: '#55609A', hemiI: 1.15, sun: '#BCC8FF', sunI: 0.8 },
};
const PAL = Object.fromEntries(Object.entries(SKY).map(([k, p]) => [k, {
  ...p, zenith: hex(p.zenith), horizon: hex(p.horizon), hemiSky: hex(p.hemiSky), hemiGround: hex(p.hemiGround), sun: hex(p.sun),
}]));

// 시간대 사이 넘어가는 구간 (게임 하루 시각 5~29 기준)
const BLENDS = [
  [4.5, 5.6, 'night', 'dawn'],
  [7.0, 8.5, 'dawn', 'day'],
  [16.4, 17.5, 'day', 'dusk'],
  [18.5, 19.6, 'dusk', 'night'],
];

/** 시각 → { dawn, day, dusk, night } 섞는 비율 (합 1) */
export function partWeights(hourF) {
  const hh = blendHour(hourF);
  const w = { dawn: 0, day: 0, dusk: 0, night: 0 };
  for (let i = 0; i < BLENDS.length; i++) {
    const [a, b, from, to] = BLENDS[i];
    if (hh < a) { w[from] = 1; return w; }
    if (hh < b) { const t = smoothstep(a, b, hh); w[from] = 1 - t; w[to] = t; return w; }
  }
  w.night = 1;
  return w;
}

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
/** 잿빛으로 (살짝 푸른 회색) */
const grey = (c, amt, bright = 1) => { const l = lum(c) * bright; return mix3(c, [l * 0.96, l * 0.99, l * 1.05], amt); };

function blendPalette(w) {
  const out = { zenith: [0, 0, 0], horizon: [0, 0, 0], hemiSky: [0, 0, 0], hemiGround: [0, 0, 0], sun: [0, 0, 0], hemiI: 0, sunI: 0 };
  for (const k in w) {
    const t = w[k];
    if (!t) continue;
    const p = PAL[k];
    for (const c of ['zenith', 'horizon', 'hemiSky', 'hemiGround', 'sun']) for (let i = 0; i < 3; i++) out[c][i] += p[c][i] * t;
    out.hemiI += p.hemiI * t;
    out.sunI += p.sunI * t;
  }
  return out;
}

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

/**
 * 해·달 위치. 동(+X)에서 떠서 남쪽(+Z)으로 기울어 지나 서(-X)로 진다.
 * light: 그림자용 방향 (조금 들어 올려 그림자가 너무 길지 않게), sky: 하늘에 그릴 방향, vis: 0~1 보이는 정도
 */
export function celestial(hourF) {
  const hh = dayHour(hourF);
  // skyZ/lift: 하늘에 그릴 길. 달은 카메라가 보는 북쪽 하늘에 낮게 걸리게 (빛 방향과는 따로 노는 연출)
  const at = (a, b, skyX, lift, skyZ) => {
    if (hh < a || hh > b) return null;
    const th = Math.PI * (hh - a) / (b - a), s = Math.sin(th), c = Math.cos(th);
    return { light: norm([c, 0.18 + 0.95 * s, 0.5]), sky: norm([c * skyX, lift * s - 0.04, skyZ]), vis: smoothstep(0, 0.3, s) };
  };
  const sun = at(5, 19, 0.9, 0.98, 0.42), moon = at(19, 29, 0.45, 0.5, -0.8);
  return {
    sun: sun ?? { light: [-1, 0.18, 0.5], sky: [-1, -0.2, 0.42], vis: 0 },
    moon: moon ?? { light: [1, 0.18, 0.5], sky: [1, -0.2, -0.8], vis: 0 },
  };
}

/**
 * 이번 프레임 모습. wx = { overcast, rain, snow, rainbow, wet } (0~1, 날씨가 부드럽게 섞인 값)
 */
export function skyLook(hourF, wx, nightFactor) {
  const w = partWeights(hourF);
  const p = blendPalette(w);
  const cel = celestial(hourF);
  const oc = wx.overcast;
  const dark = 1 - 0.22 * wx.rain;                     // 비 오는 날은 더 어둡게
  const snowLift = 1 + 0.12 * wx.snow * (1 - nightFactor);

  const zenith = scale3(grey(p.zenith, oc * 0.8, snowLift), dark);
  const horizon = scale3(grey(p.horizon, oc * 0.75, snowLift), dark);
  const hemiSky = grey(p.hemiSky, oc * 0.55);
  const hemiGround = grey(p.hemiGround, oc * 0.35);
  const sunColor = grey(p.sun, oc * 0.5);

  // 해가 떠 있으면 해, 밤엔 달이 방향광. 둘 다 지평선 근처에선 0 이라 바뀌는 순간이 안 보인다.
  const useSun = cel.sun.vis >= cel.moon.vis;
  const body = useSun ? cel.sun : cel.moon;
  const sunI = p.sunI * body.vis * (1 - 0.82 * oc);
  const hemiI = p.hemiI * (1 - 0.12 * oc) * (1 - 0.1 * wx.rain) + 0.25 * (1 - body.vis) * (1 - nightFactor * 0.6);

  const fogNear = 26 - 8 * oc - 8 * wx.rain - 6 * wx.snow;
  const fogFar = 88 - 22 * oc - 18 * wx.rain - 14 * wx.snow;

  return {
    weights: w, zenith, horizon, hemiSky, hemiGround, hemiI, sunColor, sunI,
    lightDir: body.light,
    sunSky: cel.sun.sky, sunVis: cel.sun.vis * (1 - oc), sunDisc: mix3(p.sun, [1, 1, 0.92], 0.5),
    moonSky: cel.moon.sky, moonVis: cel.moon.vis * (1 - oc * 0.9),
    stars: smoothstep(0.55, 1, nightFactor) * (1 - oc * 0.95),   // 하늘이 충분히 어두워진 뒤에
    fogNear, fogFar,
  };
}
