// 집 안 방: 섬에서 멀리 떨어진 곳(x = 500)에 8×8 칸 방을 짓는다. 바닥 판자·벽지·징두리·창문 둘·문 매트.
// 카메라가 남쪽 위에서 보므로 앞(남쪽) 벽은 세우지 않는다 (동물의 숲 실내처럼).
// 재질은 툰 재질만 쓰고 외곽선은 넣지 않는다 (상자 모서리 외곽선이 끊겨 보여서). 재질 이름은 sky 가 건드리는 이름(window·ground…)을 피한다.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM_W, ROOM_D } from './grid.js';

export const ROOM = { x: 500, z: 0 };               // 방 가운데 (월드)
export const WALL_H = 2.6;
export const WINDOWS = ['n:1', 'n:6'];               // 북쪽 벽 창문 자리 (칸 번호)
export const WINDOW_Y = 1.35, WINDOW_W = 0.9, WINDOW_H = 0.8;
export const DOOR = { gx0: 3, gx1: 4 };              // 앞쪽 가운데 두 칸 = 문 매트 (나가는 곳)

const COLORS = {
  floorWood: '#D9B382', floorWoodLight: '#E4C594', floorGap: '#8C6440', floorEdge: '#7A5636',
  wallpaper: '#F7EBD3', wallpaperStripe: '#F0DDBA', wainscot: '#B98957', molding: '#8C6440', baseboard: '#6E4E33',
  frameTrim: '#FFF8E6', pane: '#CDEBF5', doormat: '#C96F4A', doormatEdge: '#8C4A33',
};
const PANE_DAY = '#CDEBF5', PANE_NIGHT = '#3A4A78';

/** 방 기준 좌표 → 월드 */
export const x0 = ROOM.x - ROOM_W / 2, z0 = ROOM.z - ROOM_D / 2;

export function buildRoom(ctx) {
  const { THREE, materials } = ctx;
  const parts = {};   // 재질 이름 → [geometry]
  const add = (name, w, h, d, x, y, z, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    (parts[name] ||= []).push(g);
  };

  // ── 바닥: 동서로 긴 판자 16줄, 줄마다 이음매 자리를 엇갈리게 ──
  add('floorGap', ROOM_W + 0.4, 0.3, ROOM_D + 0.2, ROOM.x, -0.17, ROOM.z - 0.1);
  add('floorEdge', ROOM_W + 0.4, 0.34, 0.06, ROOM.x, -0.15, ROOM.z + ROOM_D / 2 + 0.03);
  const rows = 16, pw = ROOM_D / rows;
  for (let r = 0; r < rows; r++) {
    const z = z0 + pw * (r + 0.5);
    const cut = 1.5 + ((r * 3) % 5);           // 이음매 위치 (방 기준 x)
    const name = r % 2 ? 'floorWood' : 'floorWoodLight';
    add(name, cut - 0.02, 0.06, pw - 0.025, x0 + cut / 2, -0.03, z);
    add(name, ROOM_W - cut - 0.02, 0.06, pw - 0.025, x0 + cut + (ROOM_W - cut) / 2, -0.03, z);
  }

  // ── 벽: 북·서·동. 아래는 나무 징두리, 위는 줄무늬 벽지 ──
  const walls = [
    { len: ROOM_W + 0.48, cx: ROOM.x, cz: z0 - 0.12, rot: 0, inX: 0, inZ: 1 },                  // 북 (안쪽 면 z = z0)
    { len: ROOM_D + 0.24, cx: x0 - 0.12, cz: ROOM.z + 0.12, rot: Math.PI / 2, inX: 1, inZ: 0 },   // 서 (안쪽 면 x = x0)
    { len: ROOM_D + 0.24, cx: x0 + ROOM_W + 0.12, cz: ROOM.z + 0.12, rot: Math.PI / 2, inX: -1, inZ: 0 },   // 동
  ];
  for (const w of walls) {
    const at = (off, y) => [w.cx + w.inX * off, y, w.cz + w.inZ * off];
    add('wallpaper', w.len, WALL_H, 0.24, ...at(0, WALL_H / 2), w.rot);
    add('wainscot', w.len - 0.24, 0.85, 0.05, ...at(0.135, 0.425), w.rot);
    add('molding', w.len - 0.24, 0.07, 0.09, ...at(0.165, 0.86), w.rot);
    add('baseboard', w.len - 0.24, 0.13, 0.08, ...at(0.17, 0.065), w.rot);
    add('molding', w.len, 0.1, 0.1, ...at(0.13, WALL_H - 0.05), w.rot);
    // 벽지 세로 줄무늬
    const n = Math.round((w.len - 0.24) / 0.5);
    for (let i = 0; i < n; i++) {
      const s = -((w.len - 0.24) / 2) + 0.25 + i * 0.5;
      const [px, , pz] = at(0.124, 0);
      add('wallpaperStripe', 0.09, WALL_H - 0.98, 0.01, px + (w.rot ? 0 : s), 0.88 + (WALL_H - 0.98) / 2 - 0.02, pz + (w.rot ? s : 0), w.rot);
    }
  }
  // 앞쪽 모서리 기둥 (벽 끝이 깔끔하게)
  for (const sx of [-1, 1]) add('molding', 0.3, WALL_H + 0.04, 0.3, ROOM.x + sx * (ROOM_W / 2 + 0.12), WALL_H / 2, z0 + ROOM_D + 0.1);

  // ── 창문 (북쪽 벽) ──
  for (const key of WINDOWS) {
    const gx = Number(key.split(':')[1]);
    const cx = x0 + gx + 0.5, wz = z0 + 0.01;
    add('pane', WINDOW_W - 0.08, WINDOW_H - 0.08, 0.02, cx, WINDOW_Y, wz + 0.005);
    add('frameTrim', WINDOW_W + 0.06, 0.07, 0.06, cx, WINDOW_Y + WINDOW_H / 2, wz + 0.02);
    add('frameTrim', WINDOW_W + 0.06, 0.07, 0.06, cx, WINDOW_Y - WINDOW_H / 2, wz + 0.02);
    add('frameTrim', 0.07, WINDOW_H, 0.06, cx - WINDOW_W / 2, WINDOW_Y, wz + 0.02);
    add('frameTrim', 0.07, WINDOW_H, 0.06, cx + WINDOW_W / 2, WINDOW_Y, wz + 0.02);
    add('frameTrim', 0.04, WINDOW_H - 0.08, 0.03, cx, WINDOW_Y, wz + 0.02);
    add('frameTrim', WINDOW_W - 0.08, 0.04, 0.03, cx, WINDOW_Y, wz + 0.02);
    add('frameTrim', WINDOW_W + 0.18, 0.06, 0.14, cx, WINDOW_Y - WINDOW_H / 2 - 0.05, wz + 0.07);   // 창턱
  }

  // ── 문 매트 (앞쪽 가운데: 여기서 나간다) ──
  const mx = x0 + (DOOR.gx0 + DOOR.gx1 + 1) / 2, mz = z0 + ROOM_D - 0.42;
  add('doormatEdge', 1.36, 0.03, 0.66, mx, 0.012, mz);
  add('doormat', 1.2, 0.034, 0.52, mx, 0.014, mz);

  const group = new THREE.Group();
  group.name = 'house-room';
  const mats = {};
  for (const [name, geos] of Object.entries(parts)) {
    const geo = mergeGeometries(geos);
    geos.forEach(g => g.dispose());
    const mat = materials.toonMaterial(COLORS[name], { name });
    mats[name] = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `room-${name}`;
    mesh.receiveShadow = true;
    mesh.castShadow = !name.startsWith('floor') && name !== 'doormat' && name !== 'doormatEdge' && name !== 'pane';
    group.add(mesh);
  }
  const paneDay = new THREE.Color(PANE_DAY), paneNight = new THREE.Color(PANE_NIGHT);
  return {
    group, materials: mats,
    /** 창밖 색: 밤 정도(0~1)에 맞춰 */
    setNight(nf) { mats.pane.color.copy(paneDay).lerp(paneNight, Math.min(1, Math.max(0, nf))); },
  };
}

/** 벽 가구 자리 → 월드 위치·회전 (모델 원점 = 벽면 바닥, 정면 +Z) */
export function wallMount(wall, slot) {
  const gap = 0.012;
  if (wall === 'n') return { x: x0 + slot + 0.5, z: z0 + gap, rotY: 0 };
  if (wall === 'w') return { x: x0 + gap, z: z0 + slot + 0.5, rotY: Math.PI / 2 };
  return { x: x0 + ROOM_W - gap, z: z0 + slot + 0.5, rotY: -Math.PI / 2 };
}
