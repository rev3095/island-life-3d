// 날씨 예보. dayKey + 계절(+ 섬 시드)로 정해지므로 같은 날은 몇 번을 열어도 같은 날씨다.
// 하루(5시~다음날 5시)는 '아침 날씨' 하나로 시작해서 한낮(11~14시)에 한 번 바뀔 수 있다.
// 눈은 겨울에만, 무지개는 비 온 뒤 한낮에 드물게 (두 시간쯤).

export const WEATHERS = ['clear', 'cloudy', 'rain', 'snow', 'rainbow'];
export const WEATHER_NAMES = { clear: '맑음', cloudy: '흐림', rain: '비', snow: '눈', rainbow: '무지개' };

// 계절별 아침 날씨 확률 (나머지는 맑음)
const CHANCE = {
  spring: { rain: 0.22, cloudy: 0.22 },
  summer: { rain: 0.26, cloudy: 0.16 },
  autumn: { rain: 0.18, cloudy: 0.24 },
  winter: { snow: 0.28, rain: 0.04, cloudy: 0.24 },
};

/** 문자열 → 32비트 해시 (FNV-1a) */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** 시드 고정 난수 (mulberry32) */
export function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(season, r) {
  const c = CHANCE[season] ?? CHANCE.spring;
  let acc = 0;
  for (const w of ['snow', 'rain', 'cloudy']) {
    acc += c[w] ?? 0;
    if (r < acc) return w;
  }
  return 'clear';
}

/**
 * 하루 예보 → [{ from, weather }] (from 은 '게임 하루 시각' 5~29, 오름차순).
 * 첫 칸은 항상 from: 5.
 */
export function forecast(dayKey, season, seed = 0) {
  const rnd = rng32(hashString(`${seed}|${dayKey}|${season}`));
  const morning = pick(season, rnd());
  const turn = 11 + rnd() * 3;                       // 바뀌는 시각 11~14시
  const segs = [{ from: 5, weather: morning }];
  const changeChance = morning === 'clear' ? 0.25 : 0.5;
  if (rnd() < changeChance) {
    if (morning === 'rain' && season !== 'winter' && rnd() < 0.35) {
      segs.push({ from: turn, weather: 'rainbow' }, { from: turn + 2, weather: 'clear' });
    } else {
      const later = pick(season, rnd());
      if (later !== morning) segs.push({ from: turn, weather: later });
    }
  }
  return segs;
}

/** 예보 중 '게임 하루 시각' hh(5~29) 의 날씨 */
export function weatherAt(segs, hh) {
  let w = segs[0].weather;
  for (const s of segs) if (hh >= s.from) w = s.weather;
  return w;
}
