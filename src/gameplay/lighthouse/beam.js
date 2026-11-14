// M19-P4 켜진 등대의 밤 빛 띠 (16차 보드 wave16 D203-A — 「켜지면 밤마다 빛 띠가 돌아요(높음·적정 셰이더, 낮음은 판)」).
// 사양별 (CLAUDE.md 「렌더링 규칙」 · P48 모양: 필요할 때만 만들고, 낮음·매우 낮음은 셰이더 글자를 더하지 않는다):
//   high · mid = 빛 원뿔 둘 (열린 원뿔 메시) + 셰이더: 길이를 따라 옅어지고, 가장자리(법선이 시선과 비스듬)는 부드럽게 사라짐 — 덧셈 섞기
//   low · min  = 판: 엇갈린 평면 둘씩 + 캔버스 그라데이션 그림 (MeshBasicMaterial 만, 셰이더 덧붙임 없음)
// 모두 materials.curved 로 곡면 월드에 맞게 휜다. 빛 띠는 밤(beamHours)에만 보이고, 끄면 메시를 장면에서 뺀다 (GPU 0).
import { curved } from '../../core/materials.js';

const HALO = 0.9;   // 등 둘레 빛무리 판 크기 (칸)

/** 캔버스 그라데이션: 길이(v) 쪽으로 옅어지고 가로(u) 가운데가 밝은 그림 — 판(낮음)·빛무리에 쓴다 */
function gradTexture(THREE, kind) {
  const W = 64, H = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a;
    if (kind === 'halo') { const d = Math.hypot(x / (W - 1) - 0.5, y / (H - 1) - 0.5) * 2; a = Math.max(0, 1 - d) ** 2; }
    else { const u = Math.abs(x / (W - 1) - 0.5) * 2, v = y / (H - 1); a = (1 - u * u) * (1 - v) ** 1.6; }
    const i = (y * W + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 240; img.data[i + 2] = 190; img.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 셰이더 빛 원뿔 재질 (높음·적정): 곡면 패치 위에 길이·가장자리 옅어짐을 더한다 */
function shaderBeamMaterial(THREE, uLevel) {
  const m = curved(new THREE.MeshBasicMaterial({ color: 0xFFF0B8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    sh.uniforms.uLhLevel = uLevel;
    sh.vertexShader = 'varying float vLhV;\nvarying float vLhEdge;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
  vLhV = uv.y;
  {
    vec4 lhMv = modelViewMatrix * vec4( position, 1.0 );
    vec3 lhN = normalize( normalMatrix * normal );
    vLhEdge = abs( dot( lhN, normalize( -lhMv.xyz ) ) );
  }`);
    sh.fragmentShader = 'uniform float uLhLevel;\nvarying float vLhV;\nvarying float vLhEdge;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>',
      `#include <alphamap_fragment>
  diffuseColor.a *= uLhLevel * pow( clamp( vLhEdge, 0.0, 1.0 ), 1.6 ) * pow( clamp( vLhV, 0.0, 1.0 ), 1.4 ) * 0.55;`);
  };
  m.customProgramCacheKey = () => 'curved-lh-beam';
  return m;
}

/**
 * 빛 띠 하나 묶음. at = { x, y, z } 등 자리 (월드), cfg = lighthouse.json lamp.
 * set(level 0..1) · update(dt, camera) · setQuality(q) · dispose()
 */
export function createBeam(ctx, at, cfg = {}) {
  const THREE = ctx.THREE;
  const length = cfg.length ?? 15, radius = cfg.radius ?? 1.7, speed = cfg.speed ?? 0.55;
  const root = new THREE.Group();
  root.name = 'lighthouse:beam';
  root.position.set(at.x, at.y, at.z);
  root.renderOrder = 5;
  const spin = new THREE.Group();
  root.add(spin);
  const uLevel = { value: 0 };
  let level = 0, angle = 0, tier = null, parts = [], added = false;
  let halo = null;

  function clear() {
    for (const o of parts) { spin.remove(o); o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }
    parts = [];
    if (halo) { root.remove(halo); halo.geometry.dispose(); halo.material.map?.dispose(); halo.material.dispose(); halo = null; }
  }
  function build(q) {
    clear();
    tier = q === 'high' || q === 'mid' ? 'shader' : 'flat';
    if (tier === 'shader') {
      // 열린 원뿔: 등 쪽(위 끝) 반지름 0.12 → 먼 끝 radius. uv.y 는 three ConeGeometry 와 같이 아래 끝 0 · 위 끝 1 → 등 쪽이 1
      const geo = new THREE.CylinderGeometry(0.12, radius, length, 20, 1, true);
      geo.translate(0, -length / 2, 0);
      geo.rotateZ(Math.PI / 2);   // 원뿔 축을 +x 로 (등에서 바깥쪽)
      const mat = shaderBeamMaterial(THREE, uLevel);
      for (const s of [0, Math.PI]) {
        const m = new THREE.Mesh(geo, mat);
        m.rotation.y = s;
        m.frustumCulled = false;
        m.renderOrder = 5;
        parts.push(m);
        spin.add(m);
      }
    } else {
      // 판: 등에서 바깥쪽으로 넓어지는 사다리꼴 평면 — 눕힌 것·세운 것 둘씩 (양쪽 빛 띠)
      const tex = gradTexture(THREE, 'beam');
      const mat = curved(new THREE.MeshBasicMaterial({ map: tex, color: 0xFFF0B8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, opacity: 0 }));
      const geo = new THREE.BufferGeometry();
      const w0 = 0.12, w1 = radius;
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -w0, 0, 0, w0, 0, length, w1, 0, length, -w1, 0], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      for (const s of [0, Math.PI]) for (const r of [0, Math.PI / 2]) {
        const m = new THREE.Mesh(geo, mat);
        m.rotation.set(r, s, 0, 'YXZ');
        m.frustumCulled = false;
        m.renderOrder = 5;
        parts.push(m);
        spin.add(m);
      }
    }
    // 등 둘레 빛무리 (두 사양 모두 판 하나, 카메라를 본다)
    const hm = curved(new THREE.MeshBasicMaterial({ map: gradTexture(THREE, 'halo'), color: 0xFFE7A0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    halo = new THREE.Mesh(new THREE.PlaneGeometry(HALO * 2, HALO * 2), hm);
    halo.frustumCulled = false;
    halo.renderOrder = 6;
    root.add(halo);
    apply();
  }
  function apply() {
    uLevel.value = level;
    for (const o of parts) if (tier === 'flat') o.material.opacity = level * 0.5;
    if (halo) halo.material.opacity = level * 0.85;
  }
  function attach(on) {
    if (on === added) return;
    added = on;
    if (on) { if (!tier) build(ctx.quality); ctx.scene.add(root); } else ctx.scene.remove(root);
  }

  return {
    root,
    get level() { return level; },
    get tier() { return tier; },
    /** 세기 0..1 — 0 이면 장면에서 뺀다 */
    set(v) { level = Math.max(0, Math.min(1, v)); attach(level > 0.001); apply(); },
    update(dt, camera) {
      if (!added) return;
      angle = (angle + dt * speed) % (Math.PI * 2);
      spin.rotation.y = angle;
      if (halo && camera) halo.quaternion.copy(camera.quaternion);
    },
    setQuality(q) { if (tier) build(q); },
    move(p) { root.position.set(p.x, p.y, p.z); },
    dispose() { attach(false); clear(); tier = null; },
  };
}
