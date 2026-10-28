// 곤충 20종 + 꿀벌 모델 (도형을 합친 작은 툰 메시). 날개는 따로 두어 팔랑인다.
// build(id) → { root: Group, wings: [{ mesh, side: ±1, axis: 'z'|'x' }], glow: Mesh|null, size }
// 머리가 +Z 쪽. 실제보다 크게 만든다 (캐릭터 키 1.0 기준 손가락 한두 마디).

// 종류별 모양과 색
const LOOK = {
  'cabbage-white': { type: 'butterfly', body: '#4A4440', wing: '#F7F5EE', wing2: '#D9D6CC', size: 1 },
  swallowtail: { type: 'butterfly', body: '#3B3530', wing: '#F5D66A', wing2: '#3B3530', size: 1.25 },
  'yellow-butterfly': { type: 'butterfly', body: '#4A4440', wing: '#F7DE5A', wing2: '#E8C23A', size: 0.95 },
  moth: { type: 'butterfly', body: '#8C7A62', wing: '#BFAE90', wing2: '#9C8A6E', size: 1.05 },
  'red-dragonfly': { type: 'dragonfly', body: '#D8493A', wing: '#EEF6F8', size: 1 },
  skimmer: { type: 'dragonfly', body: '#7FA3BE', wing: '#EEF6F8', size: 1.05 },
  honeybee: { type: 'bee', body: '#F2C230', stripe: '#3B3530', wing: '#F4FAFC', size: 1 },
  firefly: { type: 'firefly', body: '#3B3530', glow: '#E8F77A', size: 0.8 },
  ladybug: { type: 'beetle', body: '#E0413A', head: '#2F2A26', dots: '#2F2A26', size: 0.7 },
  cicada: { type: 'cicada', body: '#6E5A3E', wing: '#DDEBE6', size: 1.1 },
  'rhino-beetle': { type: 'beetle', body: '#5A3A24', head: '#3E281A', horn: true, size: 1.3 },
  'stag-beetle': { type: 'beetle', body: '#3A2A20', head: '#2A1E16', jaws: true, size: 1.35 },
  mantis: { type: 'hopper', body: '#7DBA52', size: 1.25, arms: true },
  grasshopper: { type: 'hopper', body: '#8CBF4A', size: 1.05 },
  cricket: { type: 'hopper', body: '#4E3B2A', size: 0.9 },
  'bell-cricket': { type: 'hopper', body: '#5E5240', size: 0.85 },
  ant: { type: 'ant', body: '#2F2A26', size: 0.7 },
  snail: { type: 'snail', body: '#D9C7A3', shell: '#C47A4E', size: 1 },
  'pill-bug': { type: 'pill', body: '#6E7275', size: 0.85 },
  'pond-skater': { type: 'skater', body: '#4E4438', size: 1 },
};

export function createBugModels(ctx, mk) {
  const { THREE: T } = ctx;
  const { part, geometry, mesh, G } = mk;
  const wingGeo = new Map();
  let wingMat = null;
  const wingMaterial = () => {
    if (!wingMat) {
      wingMat = ctx.materials.toonMaterial('#ffffff', { flat: true, name: 'bugWing' });
      wingMat.vertexColors = true;
      wingMat.side = T.DoubleSide;
    }
    return wingMat;
  };
  // 날개 한 장: 몸 옆(+X)으로 뻗는 판 (side = -1 이면 뒤집어 쓴다)
  function wing(key, build) {
    if (!wingGeo.has(key)) wingGeo.set(key, mk.merge(build()));
    return wingGeo.get(key);
  }
  const plane = (w, h) => new T.PlaneGeometry(w, h).rotateX(-Math.PI / 2).translate(w / 2, 0, 0);
  const disc = (rx, rz, n = 10) => new T.CircleGeometry(1, n).rotateX(-Math.PI / 2).scale(rx, 1, rz).translate(rx, 0, 0);

  function build(id) {
    const slug = String(id).split('.')[1] ?? id;
    const L = LOOK[slug] ?? LOOK.ladybug;
    const s = 0.14 * L.size;           // 기본 크기 (기본 카메라에서도 보이게 실제보다 크게)
    const root = new T.Group();
    root.name = `bug-${slug}`;
    const wings = [];
    let glow = null;
    const addWing = (geo, side, x, y, z, axis = 'z') => {
      const w = new T.Mesh(geo, wingMaterial());
      const pivot = new T.Group();
      pivot.position.set(x, y, z);
      if (side < 0) pivot.scale.x = -1;
      pivot.add(w);
      root.add(pivot);
      wings.push({ mesh: pivot, side, axis });
    };
    const body = parts => { const m = mesh(geometry(`bug:${slug}`, parts), { outline: 0.0035 }); root.add(m); return m; };

    switch (L.type) {
      case 'butterfly': {
        body(() => [part(G.cyl(s * 0.08, s * 0.06, s * 0.7, 6), L.body, { r: [Math.PI / 2, 0, 0] }), part(G.sphere(s * 0.1, 6, 4), L.body, { p: [0, 0, s * 0.38] })]);
        const g = wing(`bw:${slug}`, () => [part(disc(s * 0.55, s * 0.42), L.wing, { p: [0, 0, s * 0.15] }), part(disc(s * 0.4, s * 0.32), L.wing2, { p: [0, 0.001, -s * 0.22] }), part(disc(s * 0.12, s * 0.1, 6), L.wing2, { p: [s * 0.7, 0.002, s * 0.22] })]);
        addWing(g, 1, 0, 0, 0); addWing(g, -1, 0, 0, 0);
        break;
      }
      case 'dragonfly': {
        body(() => [part(G.cyl(s * 0.05, s * 0.035, s * 1.3, 6), L.body, { p: [0, 0, -s * 0.35], r: [Math.PI / 2, 0, 0] }), part(G.sphere(s * 0.11, 7, 5), L.body, { p: [0, 0, s * 0.35], sc: [1.1, 0.9, 1] }), part(G.sphere(s * 0.07, 6, 4), '#3B3530', { p: [s * 0.07, s * 0.03, s * 0.42] }), part(G.sphere(s * 0.07, 6, 4), '#3B3530', { p: [-s * 0.07, s * 0.03, s * 0.42] })]);
        const g = wing('dw', () => [part(disc(s * 0.6, s * 0.11), L.wing)]);
        addWing(g, 1, 0, s * 0.03, s * 0.25, 'x'); addWing(g, -1, 0, s * 0.03, s * 0.25, 'x');
        addWing(g, 1, 0, s * 0.03, s * 0.08, 'x'); addWing(g, -1, 0, s * 0.03, s * 0.08, 'x');
        break;
      }
      case 'bee': {
        body(() => [part(G.sphere(s * 0.32, 8, 6), L.body, { sc: [1, 0.95, 1.35] }), part(G.cyl(s * 0.31, s * 0.31, s * 0.1, 10), L.stripe, { r: [Math.PI / 2, 0, 0], p: [0, 0, -s * 0.08] }),
          part(G.cyl(s * 0.25, s * 0.25, s * 0.08, 10), L.stripe, { r: [Math.PI / 2, 0, 0], p: [0, 0, -s * 0.28] }), part(G.sphere(s * 0.2, 7, 5), L.stripe, { p: [0, 0, s * 0.38] })]);
        const g = wing('beew', () => [part(disc(s * 0.3, s * 0.18), L.wing)]);
        addWing(g, 1, s * 0.1, s * 0.25, 0, 'x'); addWing(g, -1, -s * 0.1, s * 0.25, 0, 'x');
        break;
      }
      case 'firefly': {
        body(() => [part(G.sphere(s * 0.2, 7, 5), L.body, { sc: [0.8, 0.7, 1.4] }), part(G.sphere(s * 0.12, 6, 4), '#D8493A', { p: [0, s * 0.05, s * 0.28] })]);
        const gm = new T.Mesh(G.sphere(s * 0.2, 8, 6), ctx.materials.toonMaterial(L.glow, { flat: true, name: 'firefly' }));
        gm.position.set(0, 0, -s * 0.28);
        root.add(gm);
        glow = gm;
        const g = wing('ffw', () => [part(disc(s * 0.25, s * 0.12), '#F4FAFC')]);
        addWing(g, 1, 0, s * 0.12, 0, 'x'); addWing(g, -1, 0, s * 0.12, 0, 'x');
        break;
      }
      case 'beetle': {
        body(() => {
          const out = [part(G.sphere(s * 0.4, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), L.body, { sc: [1, 0.8, 1.25] }), part(G.sphere(s * 0.2, 8, 6), L.head, { p: [0, s * 0.02, s * 0.45] })];
          if (L.dots) for (const [x, z] of [[0.18, 0.12], [-0.18, 0.12], [0.2, -0.18], [-0.2, -0.18], [0, -0.05]]) out.push(part(G.sphere(s * 0.07, 6, 4), L.dots, { p: [x * s, s * 0.27, z * s] }));
          if (L.horn) out.push(part(G.cone(s * 0.07, s * 0.45, 6), L.head, { p: [0, s * 0.22, s * 0.62], r: [0.6, 0, 0] }));
          if (L.jaws) for (const k of [-1, 1]) out.push(part(G.cone(s * 0.05, s * 0.4, 5), L.head, { p: [k * s * 0.1, s * 0.03, s * 0.72], r: [Math.PI / 2, 0, -k * 0.35] }));
          for (const k of [-1, 1]) for (const z of [-0.2, 0.05, 0.3]) out.push(part(G.cyl(s * 0.02, s * 0.02, s * 0.3, 4), '#2F2A26', { p: [k * s * 0.38, -s * 0.02, z * s], r: [0, 0, k * 1.2] }));
          return out;
        });
        break;
      }
      case 'cicada': {
        body(() => [part(G.sphere(s * 0.25, 8, 6), L.body, { sc: [1, 0.8, 1.6] }), part(G.sphere(s * 0.18, 7, 5), L.body, { p: [0, 0, s * 0.38] }), part(G.sphere(s * 0.06, 5, 4), '#3B3530', { p: [s * 0.14, s * 0.05, s * 0.45] }), part(G.sphere(s * 0.06, 5, 4), '#3B3530', { p: [-s * 0.14, s * 0.05, s * 0.45] })]);
        const g = wing('cw', () => [part(disc(s * 0.22, s * 0.55), L.wing, { p: [-s * 0.08, 0, -s * 0.1] })]);
        addWing(g, 1, 0, s * 0.18, 0); addWing(g, -1, 0, s * 0.18, 0);
        break;
      }
      case 'hopper': {
        body(() => {
          const out = [part(G.sphere(s * 0.2, 8, 6), L.body, { sc: [0.8, 0.85, 2.6] }), part(G.sphere(s * 0.17, 7, 5), L.body, { p: [0, s * 0.08, s * 0.55] })];
          for (const k of [-1, 1]) {
            out.push(part(G.cyl(s * 0.04, s * 0.025, s * 0.7, 4), L.body, { p: [k * s * 0.2, s * 0.15, -s * 0.2], r: [-0.5, 0, k * 0.3] }));       // 뒷다리
            out.push(part(G.cyl(s * 0.015, s * 0.015, s * 0.5, 3), L.body, { p: [k * s * 0.06, s * 0.3, s * 0.85], r: [0.9, 0, k * 0.2] }));   // 더듬이
            if (L.arms) out.push(part(G.cyl(s * 0.035, s * 0.03, s * 0.4, 4), L.body, { p: [k * s * 0.1, s * 0.2, s * 0.62], r: [1.1, 0, 0] }));
          }
          return out;
        });
        break;
      }
      case 'ant': {
        body(() => [part(G.sphere(s * 0.18, 7, 5), L.body, { p: [0, 0, -s * 0.25] }), part(G.sphere(s * 0.12, 6, 4), L.body), part(G.sphere(s * 0.14, 6, 4), L.body, { p: [0, 0, s * 0.22] }),
          ...[-1, 1].flatMap(k => [-0.1, 0, 0.1].map(z => part(G.cyl(s * 0.015, s * 0.015, s * 0.35, 3), L.body, { p: [k * s * 0.12, -s * 0.05, z * s], r: [0, 0, k * 1.1] })))]);
        break;
      }
      case 'snail': {
        body(() => [part(G.sphere(s * 0.16, 8, 6), L.body, { p: [0, 0, s * 0.05], sc: [0.8, 0.6, 3] }), part(G.sphere(s * 0.32, 10, 8), L.shell, { p: [0, s * 0.3, -s * 0.05], sc: [0.7, 1, 1] }),
          part(G.torus(s * 0.16, s * 0.05, 5, 12), '#A85E36', { p: [s * 0.23, s * 0.3, -s * 0.05], r: [0, Math.PI / 2, 0] }),
          ...[-1, 1].map(k => part(G.cyl(s * 0.02, s * 0.02, s * 0.25, 4), L.body, { p: [k * s * 0.06, s * 0.15, s * 0.5], r: [0.5, 0, k * 0.3] }))]);
        break;
      }
      case 'pill': {
        body(() => [part(G.sphere(s * 0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), L.body, { sc: [0.85, 0.7, 1.3] }),
          ...[-0.2, 0, 0.2].map(z => part(G.torus(s * 0.28, s * 0.025, 4, 12, Math.PI), '#555A5C', { p: [0, 0, z * s], sc: [1, 0.85, 1] }))]);
        break;
      }
      case 'skater': {
        body(() => [part(G.sphere(s * 0.12, 7, 5), L.body, { sc: [0.7, 0.6, 3] }),
          ...[-1, 1].flatMap(k => [[0.25, 0.6], [-0.05, 0.9], [-0.3, 0.8]].map(([z, len]) => part(G.cyl(s * 0.012, s * 0.012, s * len, 3), L.body, { p: [k * s * len * 0.45, -s * 0.03, z * s], r: [0, -k * z * 0.8, k * 1.45] })))]);
        break;
      }
    }
    return { root, wings, glow, size: s, type: L.type };
  }

  /** 날개 팔랑 (t = 초, speed = 1 이면 보통) */
  function flap(model, t, speed = 1) {
    const ty = model.type;
    const hz = ty === 'butterfly' ? 7 : ty === 'dragonfly' || ty === 'bee' || ty === 'firefly' ? 34 : 0;
    if (!hz) return;
    const amp = ty === 'butterfly' ? 0.9 : 0.45;
    const a = Math.sin(t * hz * speed) * amp + (ty === 'butterfly' ? 0.25 : 0);
    // 왼쪽 날개는 받침을 x 로 뒤집어 놓았으므로 각도 부호도 뒤집어야 두 날개가 같이 올라간다
    for (const w of model.wings) w.mesh.rotation.z = a * (w.axis === 'x' ? 0.6 : 1) * w.side;
  }

  return { build, flap, LOOK };
}
