// 집 안(실내 모드) 조명 값. look.js 처럼 three 없이 sRGB 0~1 배열을 돌려준다.
// 낮엔 창으로 드는 밝고 하얀 빛, 밤엔 스탠드 불빛 같은 따뜻한 빛. 하늘·안개·구름·비·눈은 index.js 가 숨긴다.

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const DAY = { hemiSky: hex('#FFF7EA'), hemiGround: hex('#D9B98F'), hemiI: 1.75, sunColor: hex('#FFF1DC'), sunI: 1.45 };
const NIGHT = { hemiSky: hex('#FFE2B8'), hemiGround: hex('#B98A5E'), hemiI: 1.35, sunColor: hex('#FFD08A'), sunI: 1.1 };

/** 방 밖(벽 너머·바닥 아래) 어둠 */
export const INDOOR_BACKGROUND = hex('#2E2420');

// 빛 방향: 천장 앞쪽 왼편에서 거의 내리비춘다 → 가구 그림자가 뒤 오른쪽으로 짧게 진다
const DIR = (() => { const v = [-0.32, 1, 0.42]; const l = Math.hypot(...v); return v.map(x => x / l); })();

/** nf: 밤 정도 0~1 (time.nightFactor) */
export function indoorLook(nf) {
  const t = Math.min(1, Math.max(0, nf));
  return {
    hemiSky: mix(DAY.hemiSky, NIGHT.hemiSky, t),
    hemiGround: mix(DAY.hemiGround, NIGHT.hemiGround, t),
    hemiI: DAY.hemiI + (NIGHT.hemiI - DAY.hemiI) * t,
    sunColor: mix(DAY.sunColor, NIGHT.sunColor, t),
    sunI: DAY.sunI + (NIGHT.sunI - DAY.sunI) * t,
    lightDir: DIR,
    background: INDOOR_BACKGROUND,
  };
}
