// 작은 효과: 물 튀김·물결, 흙먼지, 나무·돌 부스러기, 반짝임, 물뿌리개 물방울, 줍기 뿅.
// 메시는 모아 두고 다시 쓴다. 불투명 툰 재질이라 사라질 땐 크기를 줄이고, 물결 고리만 투명도를 쓴다.
import { rand } from './util.js';

const GRAVITY = 9;

export function createFx(ctx) {
  const { THREE: T, scene, materials } = ctx;
  const group = new T.Group();
  group.name = 'gather-fx';
  scene.add(group);

  const mats = new Map();
  const mat = (color, flat = false) => {
    const key = `${color}|${flat}`;
    if (!mats.has(key)) mats.set(key, materials.toonMaterial(color, { flat, name: 'fx' }));
    return mats.get(key);
  };
  const GEO = {
    ball: new T.SphereGeometry(1, 6, 4),
    chip: new T.BoxGeometry(1, 0.5, 0.7),
    star: new T.OctahedronGeometry(1, 0),
    ring: new T.RingGeometry(0.75, 1, 24).rotateX(-Math.PI / 2),
  };
  const free = { ball: [], chip: [], star: [], ring: [] };
  const live = [];

  function take(shape, color, flat) {
    let m = free[shape].pop();
    if (!m) {
      m = new T.Mesh(GEO[shape], mat(color, flat));
      m.frustumCulled = false;
      group.add(m);
    }
    if (shape === 'ring') {
      // 고리는 저마다 투명도가 달라서 재질을 따로 둔다
      if (!m.userData.own) { m.material = Object.assign(materials.toonMaterial(color, { flat: true, name: 'fx-ring' }), { transparent: true, depthWrite: false }); m.userData.own = true; }
      m.material.color.set(color);
    } else m.material = mat(color, flat);
    m.visible = true;
    m.userData.shape = shape;
    return m;
  }
  function spawn(shape, color, p, { v = [0, 0, 0], size = 0.05, life = 0.6, grav = 1, flat = false, spin = 0, grow = 0, ground = null } = {}) {
    const m = take(shape, color, flat);
    m.position.set(p.x, p.y, p.z);
    m.scale.setScalar(size);
    m.rotation.set(rand(0, 3), rand(0, 3), 0);
    live.push({ m, vx: v[0], vy: v[1], vz: v[2], size, life, t: 0, grav, spin, grow, ground });
    return m;
  }

  const api = {
    /** 물 튀김 (찌·물고기). big = 물고기를 낚았을 때 */
    splash(p, big = false) {
      const n = big ? 12 : 6;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(0.5, big ? 1.6 : 1.0);
        spawn('ball', '#F4FBFF', p, { v: [Math.cos(a) * s, rand(1.5, big ? 3.6 : 2.4), Math.sin(a) * s], size: rand(0.025, 0.05), life: 0.7, flat: true, ground: p.y });
      }
      api.ripple(p, big ? 0.9 : 0.5);
    },
    /** 물결 고리 */
    ripple(p, r = 0.5, life = 0.9) {
      const m = spawn('ring', '#F4FBFF', { x: p.x, y: p.y + 0.012, z: p.z }, { size: r * 0.25, life, grav: 0, grow: r * 1.1 });
      m.rotation.set(0, 0, 0);
      m.material.opacity = 0.8;
    },
    /** 흙먼지 (삽·떨어짐) */
    dust(p, n = 7, color = '#C8B08A') {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(0.3, 0.9);
        spawn('ball', color, { x: p.x + Math.cos(a) * 0.1, y: p.y + 0.05, z: p.z + Math.sin(a) * 0.1 }, { v: [Math.cos(a) * s, rand(0.8, 1.8), Math.sin(a) * s], size: rand(0.04, 0.07), life: 0.55, grav: 0.4 });
      }
    },
    /** 부스러기: 'wood' | 'stone' | 'leaf' */
    chips(p, kind = 'wood', n = 6) {
      const color = { wood: '#D9B27C', stone: '#B8B2A6', leaf: '#6FAE4A' }[kind] ?? '#D9B27C';
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(0.6, 1.5);
        spawn('chip', color, p, { v: [Math.cos(a) * s, rand(1.2, 2.6), Math.sin(a) * s], size: rand(0.03, 0.05), life: 0.75, spin: rand(6, 12), ground: p.y - 0.5 });
      }
    },
    /** 나뭇잎 몇 장이 팔랑 떨어진다 (나무 흔들기) */
    leaves(p, color = '#6FAE4A', n = 5) {
      for (let i = 0; i < n; i++) {
        spawn('chip', color, { x: p.x + rand(-0.6, 0.6), y: p.y + rand(0, 0.4), z: p.z + rand(-0.6, 0.6) }, { v: [rand(-0.3, 0.3), rand(-0.2, 0.3), rand(-0.3, 0.3)], size: rand(0.035, 0.05), life: 1.2, grav: 0.12, spin: rand(2, 5) });
      }
    },
    /** 반짝 (잡았을 때·물 준 꽃) */
    sparkle(p, n = 5, color = '#FFF3B0') {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(0.3, 0.8);
        spawn('star', color, { x: p.x, y: p.y, z: p.z }, { v: [Math.cos(a) * s, rand(0.6, 1.4), Math.sin(a) * s], size: rand(0.03, 0.05), life: 0.7, grav: 0, flat: true, spin: 4 });
      }
    },
    /** 물뿌리개 물줄기: from → to 로 물방울 */
    pour(from, to, n = 3) {
      for (let i = 0; i < n; i++) {
        const t = 0.32;
        const vx = (to.x - from.x) / t + rand(-0.3, 0.3), vz = (to.z - from.z) / t + rand(-0.3, 0.3);
        const vy = (to.y - from.y + 0.5 * GRAVITY * t * t) / t;
        spawn('ball', '#9ED8F5', from, { v: [vx, vy, vz], size: rand(0.02, 0.035), life: t, flat: true });
      }
    },
    /** 효과 하나 직접 */
    spawn,
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const f = live[i];
        f.t += dt;
        const k = f.t / f.life;
        if (k >= 1) {
          f.m.visible = false;
          free[f.m.userData.shape].push(f.m);
          live.splice(i, 1);
          continue;
        }
        f.vy -= GRAVITY * f.grav * dt;
        f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
        if (f.ground != null && f.m.position.y < f.ground) { f.m.position.y = f.ground; f.vy = Math.abs(f.vy) * 0.3; f.vx *= 0.5; f.vz *= 0.5; }
        if (f.spin) { f.m.rotation.x += f.spin * dt; f.m.rotation.y += f.spin * 0.7 * dt; }
        if (f.m.userData.shape === 'ring') {
          f.m.scale.setScalar(f.size + f.grow * k);
          f.m.material.opacity = 0.8 * (1 - k);
        } else f.m.scale.setScalar(f.size * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3));
      }
    },
    group,
  };
  return api;
}
