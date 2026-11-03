// 해 렌즈 빛: 해가 화면 안에 있을 때 둘레 빛무리 + 화면 가운데 쪽으로 늘어선 빛 고리 몇 개.
// three.js 예제 Lensflare (three/addons/objects/Lensflare.js) 를 그대로 쓴다 — 해 자리 16×16 화소만 복사해 건물·나무에 가렸는지 깊이로 보고 가려지면 안 그린다.
// 그림은 캔버스로 만든다 (받을 파일 없음). 사양 높음·적정만 (render/quality.js QUALITY[].fx.flare), 집 안·흐림·밤엔 숨긴다.
// 해는 하늘 돔 안쪽(카메라에서 100칸)에 둔다 — 돔은 깊이를 쓰지 않으니 하늘은 해를 가리지 않는다.

/** 해 렌즈 빛 보이기: 사양 켜짐 · 집 밖 · 해가 보임 · 흐리지 않음 → 0~1 세기 (0 이면 숨김) */
export function flareStrength({ enabled = true, indoor = false, sunVis = 0, overcast = 0 } = {}) {
  if (!enabled || indoor) return 0;
  const k = sunVis * (1 - Math.min(1, overcast * 1.6));
  return k > 0.04 ? Math.min(1, k) : 0;
}

const GLOW = 0.32, GHOST = 0.2;   // 빛무리·고리 밝기 (하늘 셰이더 해 빛무리와 겹쳐 하얗게 날지 않게)

export async function createFlare(THREE) {
  const { Lensflare, LensflareElement } = await import('three/addons/objects/Lensflare.js');
  const tex = (size, draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // 둘레 빛무리: 가운데가 하얗고 부드럽게 퍼짐
  const glow = tex(256, (g, r) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(255,252,240,1)'); gr.addColorStop(0.12, 'rgba(255,240,200,0.75)');
    gr.addColorStop(0.4, 'rgba(255,214,160,0.18)'); gr.addColorStop(1, 'rgba(255,200,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  });
  // 빛 고리(고스트): 가장자리가 조금 진한 투명한 원
  const ring = tex(128, (g, r) => {
    const gr = g.createRadialGradient(r, r, r * 0.55, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  });
  const dot = tex(64, (g, r) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  });
  const flare = new Lensflare();
  flare.name = 'sky-flare';
  const els = [
    new LensflareElement(glow, 300, 0, new THREE.Color(1, 0.96, 0.86)),
    new LensflareElement(dot, 50, 0.32, new THREE.Color(0.75, 0.9, 1)),
    new LensflareElement(ring, 90, 0.55, new THREE.Color(1, 0.82, 0.62)),
    new LensflareElement(dot, 70, 0.78, new THREE.Color(0.7, 1, 0.8)),
    new LensflareElement(ring, 150, 1.0, new THREE.Color(0.8, 0.78, 1)),
  ];
  const base = els.map(e => e.color.clone());
  for (const e of els) flare.addElement(e);
  flare.visible = false;
  const dir = new THREE.Vector3();
  const WARM = new THREE.Color(1, 0.6, 0.4);
  return {
    object: flare,
    /** 매 프레임: sunDir = 하늘 방향(정규화 [x,y,z]), k = flareStrength, warm = 노을빛 0~1 */
    update(camera, sunDir, k, warm = 0) {
      flare.visible = k > 0;
      if (!flare.visible) return;
      dir.fromArray(sunDir).normalize();
      flare.position.copy(camera.position).addScaledVector(dir, 100);
      els.forEach((e, i) => {
        const b = k * (i ? GHOST : GLOW);   // 하늘 돔의 해 빛무리 위에 더해지므로 옅게
        e.color.copy(base[i]).multiplyScalar(b);
        if (warm > 0) e.color.lerp(WARM.clone().multiplyScalar(b), warm * 0.4);   // 노을엔 주황빛으로
      });
    },
  };
}
