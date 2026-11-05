// 8차 FX-01 불꽃 (보드 wave8 D77-A): 모델이 아니라 점 입자. 올라가는 꼬리 → 퍼짐 → 아래로 처지며 사라짐, 색 넷.
// 사양별 발 수(FIREWORK_QUALITY)는 render/quality.js 의 사양 이름 그대로. 점은 materials.curved 로 곡면 월드에 맞게 휜다.
// 계획(언제 몇 발)은 순수 함수 showPlan — tests/events.test.mjs 가 돌린다. 장면에 붙이는 쪽은 createFireworks.

/** 사양마다 쇼 한 번(10분)에 쏘는 발 수 · 한 발의 점 수 · 물에 비침 */
export const FIREWORK_QUALITY = {
  high: { shots: 120, sparks: 90, reflect: true },
  mid: { shots: 60, sparks: 64, reflect: false },
  low: { shots: 30, sparks: 44, reflect: false },
  min: { shots: 12, sparks: 28, reflect: false },
};
export const FIREWORK_COLORS = ['#FFD866', '#F7A6C4', '#8FD3F4', '#A8E57A'];
const RISE = 1.1, LIFE = 2.4, GRAVITY = 0.9;

/** 쇼 계획: seconds 동안 사양 q 의 발 수를 고르게(앞뒤로 조금씩 흔들어) → [{ t, dx, dz, h, color, r }] (seed 같으면 같음) */
export function showPlan(q = 'mid', seconds = 600, seed = 1) {
  const Q = FIREWORK_QUALITY[q] ?? FIREWORK_QUALITY.mid;
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const gap = seconds / Q.shots;
  return Array.from({ length: Q.shots }, (_, i) => ({
    t: Math.max(0, (i + 0.5 + (rnd() - 0.5) * 0.8) * gap),
    dx: (rnd() - 0.5) * 6, dz: (rnd() - 0.5) * 2,
    h: 2.0 + rnd() * 0.7, color: Math.floor(rnd() * FIREWORK_COLORS.length), r: 1.2 + rnd() * 0.6,   // 게임 카메라는 아래를 내려다봐서 바다 위 하늘 띠가 낮다 (2026-11-05 잰 값: 해변에서 6칸 너머 높이 1.5~3)
  })).sort((a, b) => a.t - b.t);
}

function dotTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 불꽃 묶음. at = 발사대 자리 {x, y, z}. show(seconds, seed) 로 쇼 시작, stop() 로 끝, update(dt) 는 매 장면. 사양은 ctx.quality 를 따른다 */
export function createFireworks(ctx) {
  const { THREE, materials } = ctx;
  const MAX = 5200;   // 동시에 살아 있는 점 (높음 사양 겹침 기준)
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), born = new Float32Array(MAX), base = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mat = materials.curved(new THREE.PointsMaterial({ size: 0.45, map: dotTexture(THREE), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 1001;   // 하늘(1000) 다음
  points.name = 'fx:fireworks';
  const group = new THREE.Group();
  group.add(points);
  ctx.scene.add(group);
  const colors = FIREWORK_COLORS.map(c => new THREE.Color(c));
  let n = 0, clock = 0, plan = [], next = 0, at = null, rockets = [], running = false;
  const tmp = new THREE.Vector3();
  /** 화면 높이(NDC y) 가 goal 이 되는 터질 높이 — 게임 카메라는 아래를 내려다보고 플레이어를 따라가서, 고정 높이면 화면 밖으로 나간다.
   *  곡면 월드는 중심(curve.uCurveOrigin)에서 먼 만큼 uCurve·거리² 아래로 휜다 (materials.js 곡면 패치). 못 맞추면 plan 높이 */
  function aimHeight(x, z, goal, fallback) {
    const cam = ctx.camera, c = materials.curve;
    if (!cam) return fallback;
    const o = c.uCurveOrigin.value, drop = c.uCurve.value * ((x - o.x) ** 2 + (z - o.z) ** 2);
    const ndc = h => tmp.set(x, at.y + h - drop, z).project(cam).y;
    let lo = 0.6, hi = 40;
    if (ndc(lo) > goal) return lo;
    if (ndc(hi) < goal) return fallback;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (ndc(m) < goal) lo = m; else hi = m; }
    return lo;
  }

  function spawn(x, y, z, vx, vy, vz, c, l, k = 1) {
    if (n >= MAX) return;
    const i = n++;
    pos.set([x, y, z], i * 3); base.set([c.r * k, c.g * k, c.b * k], i * 3); col.set([c.r * k, c.g * k, c.b * k], i * 3);
    vel.set([vx, vy, vz], i * 3); life[i] = l; born[i] = clock;
  }
  function burst(p, shot) {
    const Q = FIREWORK_QUALITY[ctx.quality] ?? FIREWORK_QUALITY.mid, c = colors[shot.color];
    for (let k = 0; k < Q.sparks; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const sp = shot.r * (0.85 + Math.random() * 0.3) * (p.y > 3 ? p.y / 3 : 1);   // 높이 터지면(먼 카메라) 그만큼 크게
      spawn(p.x, p.y, p.z, Math.cos(a) * s * sp, u * sp, Math.sin(a) * s * sp, c, LIFE * (0.8 + Math.random() * 0.4), 0.85);   // 덧칠(additive)이라 겹치면 하얘진다 — 색이 남게 낮게
    }
    ctx.events?.emit('sfx', { name: 'splash' });   // 펑 (합성 효과음 중 가장 가까운 것 — 소리 편집기에서 'firework' 를 따로 만들면 바꿀 것)
  }
  function step(dt) {
    clock += dt;
    // 계획대로 로켓 쏘기
    while (running && next < plan.length && plan[next].t <= clock) {
      const s = plan[next++];
      const x = at.x + s.dx, z = at.z + s.dz;
      const h = aimHeight(x, z, 0.7 + (s.h - 2) * 0.2, s.h);   // 수평선 위 하늘 띠 가운데쯤 (0.7~0.84)
      rockets.push({ x, y: at.y + 0.3, z, vy: (h - 0.3) / RISE, t: 0, shot: s });
    }
    if (running && next >= plan.length && !rockets.length && n === 0) running = false;
    for (const r of rockets) {
      r.t += dt; r.y += r.vy * dt;
      spawn(r.x + (Math.random() - 0.5) * 0.05, r.y, r.z, 0, -0.4, 0, colors[r.shot.color], 0.5, 0.7);   // 꼬리
    }
    for (const r of rockets.filter(q => q.t >= RISE)) burst(r, r.shot);
    rockets = rockets.filter(q => q.t < RISE);
    // 점 움직이기 · 죽은 점 지우기 (마지막 점을 그 자리로 옮겨 빈칸 없이)
    for (let i = 0; i < n; i++) {
      const age = clock - born[i];
      if (age >= life[i]) {
        const j = --n;
        if (i !== j) {
          pos.copyWithin(i * 3, j * 3, j * 3 + 3); vel.copyWithin(i * 3, j * 3, j * 3 + 3); base.copyWithin(i * 3, j * 3, j * 3 + 3);
          life[i] = life[j]; born[i] = born[j];
        }
        i--; continue;
      }
      const drag = Math.exp(-1.6 * dt);
      vel[i * 3] *= drag; vel[i * 3 + 2] *= drag; vel[i * 3 + 1] = vel[i * 3 + 1] * drag - GRAVITY * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const fade = Math.max(0, 1 - age / life[i]) * (0.6 + 0.4 * Math.sin(age * 30 + i));   // 반짝이며 사라짐
      col[i * 3] = base[i * 3] * fade; col[i * 3 + 1] = base[i * 3 + 1] * fade; col[i * 3 + 2] = base[i * 3 + 2] * fade;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return {
    group,
    get running() { return running; },
    get sparks() { return n; },
    /** 쇼 시작: where = {x, y, z}, seconds 동안 (startAt = 쇼 안에서 이미 지난 초 — 도중에 들어왔을 때) */
    show(where, { seconds = 600, seed = 1, startAt = 0 } = {}) {
      at = where; plan = showPlan(ctx.quality, seconds, seed); clock = startAt; next = plan.findIndex(s => s.t >= startAt);
      if (next < 0) next = plan.length;
      rockets = []; running = true;
    },
    stop() { running = false; plan = []; rockets = []; n = 0; geo.setDrawRange(0, 0); },
    update(dt) { if (running || n) step(Math.min(dt, 0.1)); },
    dispose() { ctx.scene.remove(group); geo.dispose(); mat.map?.dispose(); mat.dispose(); },
  };
}
