// 별자리 지도 (요청 8 — 섬 이야기 오리지널 별자리 12개 IC-ST-01–12, 계절마다 셋). three·DOM 없음 → node 로도 돈다 (tests/stars.test.mjs).
//  - 하늘 좌표: az = 방위각(도, 0 북 · 90 동), alt = 고도(도, 0 지평선 · 90 머리 위). 게임 월드에서 북 = -z, 동 = +x (카메라가 남쪽에서 북쪽을 본다).
//  - 별자리 별은 가운데(az, alt)에서 하늘 평면으로 dx(오른쪽)·dy(위) 도만큼 떨어진 곳. mag 1 밝음 ~ 3 흐림.
//  - 3D 밤하늘(src/sky/stars.js)은 이 별을 dome.js 의 별 재질 그대로 Points 몇 개로 더 그리고,
//    망원경 보기(UI-32)·도감·별자리관 그림은 drawSky() 가 2D 캔버스에 그린다 (셰이더 없음 — 저사양에서도 같은 값).
//  - 바탕 별: dome.js 의 별 1400개와 같은 씨앗 7 로 만든다 (망원경으로 봐도 같은 하늘) + 망원경으로 당겨야 보이는 흐린 별.

const D2R = Math.PI / 180;
export const SEASON_NAME = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
/** 별을 볼 수 있는 시각 (게임 시각 0~24): 19시부터 다음 날 5시 전까지 (decor/telescope.js NIGHT 와 같다) */
export const STAR_HOURS = { from: 19, to: 5 };
export const isStarHour = hourF => Number.isFinite(hourF) && (hourF >= STAR_HOURS.from || hourF < STAR_HOURS.to);
/** 구름에 가려 별자리를 못 찍는 날씨 */
export const CLOUDY = new Set(['rain', 'snow', 'cloudy']);
/** 망원경 시야 (도): 넓게 ~ 좁게. 처음 = 42 */
export const FOV = { min: 10, max: 70, start: 42 };
/** 찍기: 가운데에서 시야의 이만큼 안 · 별자리 반지름이 시야의 lo~hi 배 · hold 초 동안 */
export const CAPTURE = { center: 0.16, lo: 0.14, hi: 0.5, hold: 1.6 };

const S = (id, slug, name, season, az, alt, stars, lines, desc) => ({ id, slug, name, season, az, alt, stars, lines, desc });
/** 별자리 12개: [dx, dy, mag] · lines = 별 번호 짝 */
export const CONSTELLATIONS = [
  S('IC-ST-01', 'acorn', '도토리자리', 'spring', -42, 40,
    [[0, 9, 2], [-7, 4, 1], [7, 4, 2], [-6, -2, 2], [6, -2, 3], [0, -9, 1]],
    [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 5], [4, 5]],
    '봄밤 북서쪽 하늘의 도토리. 섬에 처음 도토리나무를 심은 다람쥐가 겨울잠에서 깨어 맨 먼저 올려다본 별이라고 해요.'),
  S('IC-ST-02', 'petal', '벚꽃잎자리', 'spring', 12, 56,
    [[0, 8, 1], [7.6, 2.5, 2], [4.7, -6.5, 2], [-4.7, -6.5, 3], [-7.6, 2.5, 2], [0, 0, 3]],
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5]],
    '꽃잎 다섯 장이 동그랗게 모인 별자리. 꽃놀이 날 밤에 이 별을 보면 그해 벚꽃이 오래 간대요.'),
  S('IC-ST-03', 'sprout', '새싹자리', 'spring', 50, 34,
    [[0, -9, 2], [0, -2, 2], [-8, 4, 1], [7, 6, 2], [1, 4, 3]],
    [[0, 1], [1, 4], [1, 2], [1, 3]],
    '땅에서 막 고개를 내민 새싹. 씨앗을 심은 날 밤이면 조금 더 또렷해 보인다는 이야기가 있어요.'),
  S('IC-ST-04', 'straw-hat', '밀짚모자자리', 'summer', -38, 46,
    [[-11, -2, 2], [11, -2, 2], [-5, 0, 3], [5, 0, 3], [-4, 6, 1], [4, 6, 2]],
    [[0, 2], [2, 3], [3, 1], [2, 4], [4, 5], [5, 3]],
    '챙이 넓은 밀짚모자. 한여름 바닷바람에 날아간 모자가 하늘에 걸렸다는 섬 옛이야기의 그 모자예요.'),
  S('IC-ST-05', 'watermelon', '수박조각자리', 'summer', 16, 60,
    [[-10, -5, 1], [10, -5, 2], [0, 9, 2], [-2, 0, 3], [2, 2, 3]],
    [[0, 1], [0, 2], [1, 2]],
    '세모나게 자른 수박 한 조각. 가운데 흐린 별 둘은 씨앗이래요. 불꽃놀이 날 가장 높이 떠 있어요.'),
  S('IC-ST-06', 'firefly', '반딧불자리', 'summer', 56, 32,
    [[-8, 2, 2], [-2, 0, 2], [6, -1, 3], [9, -2, 1], [-3, 7, 3], [2, 6, 3]],
    [[0, 1], [1, 2], [2, 3], [1, 4], [1, 5]],
    '꼬리 끝 별이 유난히 노랗게 빛나는 반딧불이. 강가에서 반딧불이를 잡은 밤엔 꼭 한번 찾아봐요.'),
  S('IC-ST-07', 'maple', '단풍잎자리', 'autumn', -44, 38,
    [[0, -10, 3], [0, -3, 2], [0, 9, 1], [-9, 3, 2], [9, 3, 2], [-6, -5, 3], [6, -5, 3]],
    [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6]],
    '다섯 갈래로 갈라진 단풍잎. 가을 바람이 섬의 단풍을 하나 실어 올려 하늘에 붙였대요.'),
  S('IC-ST-08', 'mushroom', '버섯자리', 'autumn', 10, 54,
    [[-9, 1, 2], [0, 8, 1], [9, 1, 2], [-2, -8, 3], [2, -8, 3], [-2, 1, 3], [2, 1, 3]],
    [[0, 1], [1, 2], [0, 2], [5, 3], [6, 4], [3, 4]],
    '갓이 동그란 숲속 버섯. 수확 잔치 날이 가까워지면 이 별 아래 숲에서 버섯이 많이 난대요.'),
  S('IC-ST-09', 'fishing-rod', '낚싯대자리', 'autumn', 54, 36,
    [[-10, -8, 2], [-3, -1, 2], [7, 8, 1], [8, 0, 3], [6, -3, 2]],
    [[0, 1], [1, 2], [2, 3], [3, 4]],
    '휘어진 낚싯대 끝에 매달린 바늘. 가을밤 부둣가에서 이 별을 보며 낚시하면 큰 물고기가 문다는 말이 있어요.'),
  S('IC-ST-10', 'snowman', '눈사람자리', 'winter', -40, 44,
    [[0, 10, 2], [-3, 6, 2], [3, 6, 2], [-6, -2, 1], [6, -2, 2], [0, -9, 2]],
    [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 5], [4, 5]],
    '머리와 몸통이 둥근 눈사람. 눈사람 날에 만든 눈사람들이 녹지 않고 하늘로 올라갔다고 해요.'),
  S('IC-ST-11', 'mitten', '털장갑자리', 'winter', 14, 58,
    [[-5, -9, 3], [4, -9, 3], [-6, 2, 2], [-1, 9, 1], [4, 5, 2], [9, 1, 2], [5, -3, 3]],
    [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]],
    '엄지가 툭 튀어나온 털장갑 한 짝. 다른 한 짝은 아직 섬 어딘가에 있대요.'),
  S('IC-ST-12', 'lighthouse', '등대자리', 'winter', 52, 34,
    [[-4, -10, 2], [4, -10, 2], [-2, 4, 3], [2, 4, 3], [0, 8, 1], [10, 9, 3]],
    [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 4], [4, 5]],
    '꼭대기 별이 깜빡이는 등대. 긴 겨울밤에 바다에 나간 배가 이 별을 보고 섬으로 돌아온대요.'),
];
export const byId = id => CONSTELLATIONS.find(c => c.id === id) ?? null;
export const inSeason = season => CONSTELLATIONS.filter(c => c.season === season);

// ── 벡터 ──
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** (az, alt) 도 → 월드 방향 [x, y, z] (북 -z, 동 +x) */
export function dirOf(az, alt) {
  const a = az * D2R, e = alt * D2R;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}
/** 월드 방향 → { az, alt } (도) */
export function azAltOf(d) {
  const [x, y, z] = norm(d);
  return { az: Math.atan2(x, -z) / D2R, alt: Math.asin(Math.max(-1, Math.min(1, y))) / D2R };
}
/** 하늘의 한 곳을 보는 평면 바탕: f 앞 · r 오른쪽 · u 위 (머리 위 근처에서도 뒤집히지 않게 방위각으로 오른쪽을 정한다) */
export function basisOf(az, alt) {
  const f = dirOf(az, alt);
  const a = az * D2R;
  const r = [Math.cos(a), 0, Math.sin(a)];   // 수평 오른쪽 (북을 보면 동)
  const u = norm(cross(r, f));
  return { f, r, u };
}
/** 별자리 별 i → 월드 방향 */
export function starDir(c, i) {
  const { f, r, u } = basisOf(c.az, c.alt), [dx, dy] = c.stars[i];
  const tx = Math.tan(dx * D2R), ty = Math.tan(dy * D2R);
  return norm([f[0] + r[0] * tx + u[0] * ty, f[1] + r[1] * tx + u[1] * ty, f[2] + r[2] * tx + u[2] * ty]);
}
/** 별자리 반지름 (도) — 가운데에서 가장 먼 별 */
export const radiusOf = c => Math.max(...c.stars.map(([dx, dy]) => Math.hypot(dx, dy)));
/** 두 방향 사이 각 (도) */
export const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) / D2R;

/** 지금 하늘에 보이는 별자리: 그 계절 셋 (밤이 아니면 없음). → [별자리] */
export function visibleNow({ season, hourF } = {}) {
  return isStarHour(hourF) ? inSeason(season) : [];
}

/**
 * 찍을 수 있나: 시야(view = { az, alt, fov })의 가운데에 별자리가 있고 크기가 알맞은가 → { ok, off, fit, why }
 *  off = 가운데에서 떨어진 정도 (시야 비율), fit = 별자리 반지름 / 시야
 */
export function aimCheck(view, c) {
  const off = angleBetween(dirOf(view.az, view.alt), dirOf(c.az, c.alt)) / view.fov;
  const fit = radiusOf(c) / view.fov;
  const why = off > CAPTURE.center ? 'off' : fit < CAPTURE.lo ? 'small' : fit > CAPTURE.hi ? 'big' : null;
  return { ok: !why, off, fit, why };
}
/** 시야 안에서 가장 가운데에 가까운 별자리 → { c, check } | null */
export function aimTarget(view, list) {
  let best = null;
  for (const c of list) {
    const check = aimCheck(view, c);
    if (check.off < 0.6 && (!best || check.off < best.check.off)) best = { c, check };
  }
  return best;
}

// ── 바탕 별 ──
let FIELD = null;
/** 바탕 별 [{ d: 방향, m: 밝기 0~1, ph: 반짝임 위상, faint: 당겨야 보임 }] — dome.js 별 1400개와 같은 씨앗 + 흐린 별 2200 */
export function fieldStars() {
  if (FIELD) return FIELD;
  const out = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {   // dome.js createDome 의 별과 같은 순서로 난수를 뽑는다
    const y = 0.02 + Math.pow(rnd(), 1.3) * 0.98, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    const big = rnd() < 0.1, size = big ? 4.2 : 2.0 + rnd() * 1.6;
    out.push({ d: [Math.cos(a) * r, y, Math.sin(a) * r], m: Math.min(1, size / 4.2), ph: rnd(), faint: false });
  }
  seed = 31;
  for (let i = 0; i < 2200; i++) {
    const y = 0.03 + rnd() * 0.97, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    out.push({ d: [Math.cos(a) * r, y, Math.sin(a) * r], m: 0.18 + rnd() * 0.3, ph: rnd(), faint: true });
  }
  return (FIELD = out);
}

/**
 * 하늘 그리기 (2D 캔버스): 망원경 보기(UI-32) · 찍은 그림(UI-33) · 도감 · 별자리관 액자가 모두 이 함수.
 *  g = CanvasRenderingContext2D, w·h = 화소, view = { az, alt, fov }
 *  opt.t 반짝임 시각(초) · opt.lens 둥근 렌즈 테 · opt.list 그릴 별자리 (기본 전부) · opt.lines { id: 0~1 } 선 진하기 · opt.names 이름 쓰기
 *  opt.cloud 0~1 구름 가림 · opt.tint 바탕 색 [위, 아래]
 * → [{ id, x, y, r }] 화면에 들어온 별자리 가운데 자리 (이름표·찍기 표시용)
 */
export function drawSky(g, w, h, view, opt = {}) {
  const t = opt.t ?? 0, list = opt.list ?? CONSTELLATIONS, lines = opt.lines ?? {};
  const cx = w / 2, cy = h / 2, R = opt.lens ? Math.min(w, h) * 0.47 : Math.hypot(w, h) / 2;
  const k = (opt.lens ? R : Math.max(w, h) / 2) / Math.tan((view.fov / 2) * D2R);
  const { f, r, u } = basisOf(view.az, view.alt);
  const px = Math.max(1, Math.min(w, h) / 420);   // 그림 크기에 맞춘 점 크기
  g.save();
  const [top, bottom] = opt.tint ?? ['#0B1636', '#1C2A55'];
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, top);
  bg.addColorStop(1, bottom);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (opt.lens) { g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip(); }
  const proj = d => {
    const z = dot(d, f);
    if (z <= 0.05) return null;
    return [cx + (dot(d, r) / z) * k, cy - (dot(d, u) / z) * k];
  };
  // 지평선 아래는 어두운 땅빛
  const zoomIn = Math.max(0, Math.min(1, (45 - view.fov) / 30));   // 당길수록 흐린 별이 보인다
  for (const s of fieldStars()) {
    if (s.faint && zoomIn <= 0) continue;
    if (s.d[1] < 0) continue;
    const p = proj(s.d);
    if (!p || p[0] < -4 || p[1] < -4 || p[0] > w + 4 || p[1] > h + 4) continue;
    const tw = 0.7 + 0.3 * Math.sin(t * (1.3 + s.ph) + s.ph * 17);
    const a = (s.faint ? zoomIn * s.m : 0.35 + 0.55 * s.m) * tw;
    g.fillStyle = `rgba(255,248,226,${a.toFixed(3)})`;
    const sz = (s.faint ? 1 : 1 + s.m * 1.2) * px;
    g.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz);
  }
  const marks = [];
  for (const c of list) {
    const pts = c.stars.map((_, i) => proj(starDir(c, i)));
    const lv = lines[c.id] ?? 0;
    if (lv > 0) {
      g.strokeStyle = `rgba(150,200,255,${(0.75 * lv).toFixed(3)})`;
      g.lineWidth = 1.6 * px;
      g.beginPath();
      for (const [a, b] of c.lines) if (pts[a] && pts[b]) { g.moveTo(...pts[a]); g.lineTo(...pts[b]); }
      g.stroke();
    }
    c.stars.forEach(([, , mag], i) => {
      const p = pts[i];
      if (!p) return;
      const tw = 0.8 + 0.2 * Math.sin(t * 1.7 + i * 2.3 + c.az);
      const rad = (4.2 - mag) * 1.25 * px * (0.85 + 0.35 * (1 - view.fov / FOV.max));
      const glow = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad * 3.2);
      glow.addColorStop(0, `rgba(255,246,214,${(0.95 * tw).toFixed(3)})`);
      glow.addColorStop(0.35, `rgba(255,230,170,${(0.35 * tw).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255,230,170,0)');
      g.fillStyle = glow;
      g.fillRect(p[0] - rad * 3.2, p[1] - rad * 3.2, rad * 6.4, rad * 6.4);
    });
    const m = proj(dirOf(c.az, c.alt));
    if (m && m[0] > 0 && m[1] > 0 && m[0] < w && m[1] < h) {
      marks.push({ id: c.id, x: m[0], y: m[1], r: Math.tan(radiusOf(c) * D2R) * k });
      if (opt.names && lv > 0.5) {
        g.font = `${Math.round(13 * px)}px sans-serif`;
        g.textAlign = 'center';
        g.fillStyle = 'rgba(220,235,255,0.85)';
        g.fillText(c.name, m[0], m[1] + Math.tan(radiusOf(c) * D2R) * k + 16 * px);
      }
    }
  }
  if (opt.cloud > 0) {   // 구름: 흐린 덩어리 몇 개 (날씨가 나쁘면 별이 가린다)
    g.fillStyle = `rgba(70,78,98,${(0.75 * opt.cloud).toFixed(3)})`;
    g.fillRect(0, 0, w, h);
  }
  g.restore();
  if (opt.lens) {   // 렌즈 테 · 가장자리 어둡게
    const v = g.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#05070D';
    g.beginPath(); g.rect(0, 0, w, h); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fill();
    g.strokeStyle = '#B98A4A';
    g.lineWidth = Math.max(3, R * 0.025);
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  }
  return marks;
}

/** 찍은 그림을 다시 그릴 값 (저장에는 그림 대신 이것만 둔다 — 날마다 같은 그림) */
export const shotOf = (c, view) => ({ az: +view.az.toFixed(2), alt: +view.alt.toFixed(2), fov: +view.fov.toFixed(2) });
/** 찍은 값이 없을 때 (예전 저장·전시 견본): 별자리가 한가운데 알맞게 들어오는 시야 */
export const defaultShot = c => ({ az: c.az, alt: c.alt, fov: Math.min(FOV.max, Math.max(FOV.min, radiusOf(c) / 0.36)) });
