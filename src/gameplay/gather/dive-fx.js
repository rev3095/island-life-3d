// M16 잠수 효과 (D163): 물방울 FX-03 · 물속 화면.
// - 물방울: 바다 생물 그림자 위로 뽀글뽀글 올라와 터지는 작은 방울, 잠긴 주인공 자리에서도 줄지어 오른다.
//   InstancedMesh 하나(작은 납작 구) + materials.toonMaterial(flat) → 곡면 월드 패치가 그대로 걸린다. 사양별 방울 수 BUBBLES.
// - 물속 화면: 잠겨 있는 동안 — 모든 사양: 안개 색을 깊은 바다색으로 · 안개를 가깝게 (sky 가 매 장면 안개를 다시 칠하므로
//   gameplay update(하늘 다음)에서 덧칠하면 나오자마자 저절로 돌아온다). 높음·적정만: 화면 한 장 셰이더(물빛 그물·가장자리 어둡게).
//   낮음·매우 낮음은 셰이더 없이 색·안개만 (p48 셰이더 규칙: 낮은 사양 GPU 시간 그대로).
const BUBBLES = { high: 72, mid: 56, low: 32, min: 20 };
export const SHADER_SPECS = new Set(['high', 'mid']);
const DEEP = '#1F5D86';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */`
uniform float uTime, uK;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv * vec2(9.0, 6.0);
  float w = sin(p.x + uTime * 0.9 + sin(p.y * 1.3 + uTime * 0.7) * 1.6) * sin(p.y * 1.1 - uTime * 0.6 + sin(p.x * 0.8 - uTime) * 1.4);
  float net = smoothstep(0.72, 0.98, abs(w));                 // 물빛 그물
  vec2 c = vUv - 0.5;
  float vig = smoothstep(0.25, 0.75, length(c * vec2(1.25, 1.0))); // 가장자리 어둡게
  float a = uK * (0.22 + 0.38 * vig);
  vec3 col = mix(uColor, vec3(0.75, 0.95, 1.0), net * 0.55 * (1.0 - vig));
  gl_FragColor = vec4(col, a + net * 0.12 * uK * (1.0 - vig));
}`;

export function createDiveFx(ctx) {
  const { THREE: T, scene, materials } = ctx;
  const spec = () => (BUBBLES[ctx.quality] ? ctx.quality : 'mid');
  const MAX = BUBBLES.high;

  // ---------- 물방울 ----------
  const geo = new T.SphereGeometry(1, 7, 5);
  geo.scale(1, 0.7, 1);
  const mat = materials.toonMaterial('#EAF8FF', { flat: true, name: 'bubble' });
  const mesh = new T.InstancedMesh(geo, mat, MAX);
  mesh.name = 'dive-bubbles';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 3;
  scene.add(mesh);
  const live = [];   // { x, y, z, r, t, life, vy }
  const m4 = new T.Matrix4(), q = new T.Quaternion(), sv = new T.Vector3(), pv = new T.Vector3();

  /** 방울 하나: (x, z) 물낯 y 에서 n 개, 퍼지는 반지름 spread */
  function bubble(x, y, z, { n = 1, spread = 0.12, size = 1 } = {}) {
    const cap = BUBBLES[spec()];
    for (let i = 0; i < n && live.length < cap; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      live.push({ x: x + Math.sin(a) * r, y: y - 0.05, z: z + Math.cos(a) * r, r: (0.025 + Math.random() * 0.03) * size, t: 0, life: 0.55 + Math.random() * 0.5, vy: 0.12 + Math.random() * 0.12 });
    }
  }

  // ---------- 물속 화면 ----------
  const overlayMat = new T.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uK: { value: 0 }, uColor: { value: new T.Color(DEEP) } },
  });
  const overlay = new T.Mesh(new T.PlaneGeometry(2, 2), overlayMat);
  overlay.name = 'dive-underwater';
  overlay.frustumCulled = false;
  overlay.renderOrder = 10000;
  overlay.visible = false;
  overlay.userData.occluder = false;
  scene.add(overlay);
  const deep = new T.Color(DEEP);
  let under = 0;   // 0 물 밖 ~ 1 다 잠김

  return {
    bubble,
    /** 잠긴 정도 0~1 (dive.js 가 매 장면) */
    set underwater(k) { under = Math.max(0, Math.min(1, k)); },
    get underwater() { return under; },
    get shader() { return overlay.visible; },
    get count() { return live.length; },
    update(dt) {
      // 방울: 떠오르며 커졌다가 물낯에서 톡 (마지막 20% 에 납작하게 터짐)
      let n = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        b.t += dt;
        if (b.t >= b.life) { live.splice(i, 1); continue; }
      }
      for (const b of live) {
        const k = b.t / b.life;
        const pop = k > 0.8 ? 1 + (k - 0.8) * 4 : 1;
        const s = b.r * Math.min(1, k * 4) * pop;
        pv.set(b.x, b.y + Math.min(0.06, b.vy * b.t), b.z);
        sv.set(s, k > 0.8 ? s * Math.max(0.15, 1 - (k - 0.8) * 4) : s, s);
        mesh.setMatrixAt(n++, m4.compose(pv, q, sv));
      }
      mesh.count = n;
      if (n) mesh.instanceMatrix.needsUpdate = true;
      // 물속 화면
      const fog = scene.fog;
      if (under > 0 && fog) {
        fog.color.lerp(deep, 0.65 * under);
        if (fog.near != null) { fog.near *= 1 - 0.8 * under; fog.far *= 1 - 0.6 * under; }
      }
      const shade = under > 0.01 && SHADER_SPECS.has(ctx.quality);
      overlay.visible = shade;
      if (shade) { overlayMat.uniforms.uTime.value += dt; overlayMat.uniforms.uK.value = under; }
    },
    clear() { live.length = 0; mesh.count = 0; under = 0; overlay.visible = false; },
  };
}
