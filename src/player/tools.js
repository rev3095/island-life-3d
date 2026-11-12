// 손에 드는 도구 5종: 낚싯대·잠자리채·삽·도끼·물뿌리개. 간단한 도형으로 만든 임시 모델 (툰 재질 + 외곽선).
// 손잡이 아래쪽이 원점, +Y 가 손잡이 끝 방향이다. userData.tip = 도구 끝(낚싯줄·그물·주둥이), userData.bobber = 낚싯대에 달린 찌.

// 쥐는 각도 (손잡이 받침 기준 Euler x·y·z): 삽은 날이 아래로, 물뿌리개는 똑바로 세우고 주둥이가 앞으로
export const GRIP = { shovel: [0.8, 0, 0], can: [0.63, Math.PI, 0] };

export function buildTool(ctx, id) {
  const { THREE, materials } = ctx;
  const g = new THREE.Group();
  g.name = `tool-${id}`;
  const mat = c => materials.toonMaterial(c, { name: 'tool' });
  const add = (geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const stick = (len, r = 0.018, color = '#B98957') => add(new THREE.CylinderGeometry(r, r, len, 8), color, 0, len / 2, 0);
  const tip = (x, y, z) => { const t = new THREE.Object3D(); t.name = 'tip'; t.position.set(x, y, z); g.add(t); g.userData.tip = t; };
  switch (id) {
    case 'rod': {
      stick(0.62, 0.014, '#9A6B45');
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), '#4E5A57', 0, 0.12, 0.025, Math.PI / 2);          // 릴
      g.userData.bobber = add(new THREE.SphereGeometry(0.03, 8, 6), '#E8504F', 0, 0.6, 0.08);                 // 찌
      tip(0, 0.62, 0);
      break;
    }
    case 'net': {
      stick(0.5);
      const ring = add(new THREE.TorusGeometry(0.11, 0.012, 6, 18), '#4E5A57', 0, 0.6, 0, Math.PI / 2);
      ring.rotation.set(0, 0, 0);
      add(new THREE.ConeGeometry(0.1, 0.16, 12, 1, true), '#F7F1E4', 0, 0.6, -0.08, -Math.PI / 2);
      tip(0, 0.6, 0);
      break;
    }
    case 'shovel': {
      stick(0.45);
      add(new THREE.BoxGeometry(0.12, 0.03, 0.02), '#7F5636', 0, 0.45, 0);
      add(new THREE.BoxGeometry(0.13, 0.16, 0.025), '#9AA6A8', 0, -0.07, 0);
      tip(0, -0.15, 0);
      break;
    }
    case 'axe': {
      stick(0.42, 0.02, '#9A6B45');
      add(new THREE.BoxGeometry(0.05, 0.1, 0.13), '#9AA6A8', 0, 0.36, 0.06);
      add(new THREE.BoxGeometry(0.052, 0.12, 0.03), '#4E5A57', 0, 0.36, 0.13);
      tip(0, 0.36, 0.14);
      break;
    }
    case 'can': {
      add(new THREE.CylinderGeometry(0.075, 0.085, 0.13, 14), '#7FA36B', 0, 0.06, 0);
      add(new THREE.CylinderGeometry(0.012, 0.02, 0.16, 8), '#7FA36B', 0, 0.12, 0.1, Math.PI / 3.2);
      add(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), '#5E8A4F', 0, 0.13, -0.02, 0, Math.PI / 2);
      tip(0, 0.165, 0.166);
      break;
    }
    case 'sling': {   // M13 TO-07 새총: Y 자 가지 + 고무줄 (손잡이 아래가 원점)
      stick(0.2, 0.02, '#B07A4A');
      for (const s of [1, -1]) {
        add(new THREE.CylinderGeometry(0.014, 0.017, 0.16, 6), '#B07A4A', s * 0.04, 0.27, 0, 0, 0, -s * 0.5);
        add(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6), '#E8604F', s * 0.075, 0.34, 0);
      }
      add(new THREE.BoxGeometry(0.15, 0.008, 0.008), '#E8604F', 0, 0.34, 0.02);
      add(new THREE.SphereGeometry(0.022, 8, 6), '#8A5A3A', 0, 0.34, 0.03);
      tip(0, 0.36, 0.03);
      break;
    }
    default: return null;
  }
  if (GRIP[id]) g.rotation.set(...GRIP[id]);
  // 외곽선
  const ol = materials.outlineMaterial(0.006);
  for (const m of g.children.filter(c => c.isMesh)) { const hull = new THREE.Mesh(m.geometry, ol); hull.userData.outline = true; m.add(hull); }
  return g;
}
