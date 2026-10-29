// 집 안 방: 섬에서 멀리 떨어진 곳(플레이어 집 x = 500, 주민 방 x = 540)에 8×8 칸 방을 짓는다. 바닥·벽지·징두리·창문 둘·문 매트.
// 카메라가 남쪽 위에서 보므로 앞(남쪽) 벽은 세우지 않는다 (동물의 숲 실내처럼).
// 색·무늬는 모두 스펙(assets/interior/specs): 벽지(WP) = 무늬 + 징두리·몰딩·걸레받이 색, 바닥(FL) = 무늬 + 앞 턱 색, 방 틀(frame) = 창틀·창유리·문 매트.
// 벽지·바닥은 무늬 텍스처를 붙인 판 (UV = m 단위, 텍스처 repeat = 1 / 무늬 크기) — setWallpaper / setFloor 로 바꿔 끼운다.
// 재질은 툰 재질만 쓰고 외곽선은 넣지 않는다 (상자 모서리 외곽선이 끊겨 보여서). 재질 이름은 sky 가 건드리는 이름(window·ground·stone…)을 피한다.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM_W, ROOM_D } from './grid.js';
import { patternTexture } from './pattern.js';

export const ROOM = { x: 500, z: 0 };               // 플레이어 방 가운데 (월드)
export const VISIT_ROOM = { x: 540, z: 0 };         // 주민 방 가운데 (방 하나를 주민마다 다시 꾸며 쓴다)
export const WALL_H = 2.6;
export const WAINSCOT_H = 0.85;
export const WINDOWS = ['n:1', 'n:6'];               // 북쪽 벽 창문 자리 (칸 번호)
export const WINDOW_Y = 1.35, WINDOW_W = 0.9, WINDOW_H = 0.8;
export const DOOR = { gx0: 3, gx1: 4 };              // 앞쪽 가운데 두 칸 = 문 매트 (나가는 곳)
export const ENTRY = { lx: ROOM_W / 2, lz: ROOM_D - 0.7 };   // 들어오면 문 매트 위, 북쪽을 본다
export const BOUNDS = { x0: 0.09, z0: 0.09, x1: ROOM_W - 0.09, z1: ROOM_D };   // 걸을 수 있는 네모 (벽 징두리만큼 안쪽)
export const FADE_OUT = 0.28, FADE_IN = 0.42;         // 드나들 때 어두워졌다 밝아지는 시간 (초)
/** 방 안 카메라 중심이 머무는 곳 (어디 서도 방 전체가 보이게 좁게) */
export const cameraBox = (o = ROOM) => ({ x0: o.x - 0.6, x1: o.x + 0.6, z0: o.z, z1: o.z + 1.4 });
export const CAMERA_CURVE = 0.3;                      // 방 안 곡면 월드 세기 배율

/** 방 가운데 → 북서쪽 모서리 (방 기준 좌표 0,0 의 월드 위치) */
export const cornerOf = (o = ROOM) => ({ x0: o.x - ROOM_W / 2, z0: o.z - ROOM_D / 2 });
/** 플레이어 방 기준 좌표 → 월드 */
export const { x0, z0 } = cornerOf(ROOM);

/**
 * 방 하나 짓기. specs = { wallpaper, floor, frame } (스펙 JSON).
 * → { group, materials, origin, x0, z0, setWallpaper(spec), setFloor(spec), setNight(nf), dispose() }
 */
export function buildRoom(ctx, { origin = ROOM, wallpaper, floor, frame } = {}) {
  const { THREE, materials } = ctx;
  const { x0: rx0, z0: rz0 } = cornerOf(origin);
  const parts = {};   // 재질 이름 → [geometry]
  const add = (name, w, h, d, x, y, z, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    (parts[name] ||= []).push(g);
  };

  // ── 바닥: 무늬 판 + 밑받침·앞 턱 (앞에서 보면 판 두께가 보이게) ──
  add('floorEdge', ROOM_W + 0.4, 0.3, ROOM_D + 0.2, origin.x, -0.152, origin.z - 0.1);
  add('floorEdge', ROOM_W + 0.4, 0.34, 0.06, origin.x, -0.15, origin.z + ROOM_D / 2 + 0.03);

  // ── 벽: 북·서·동. 아래는 징두리, 위는 벽지 판 ──
  const walls = [
    { len: ROOM_W + 0.48, inner: ROOM_W, cx: origin.x, cz: rz0 - 0.12, rot: 0, inX: 0, inZ: 1 },                         // 북 (안쪽 면 z = z0)
    { len: ROOM_D + 0.24, inner: ROOM_D, cx: rx0 - 0.12, cz: origin.z + 0.12, rot: Math.PI / 2, inX: 1, inZ: 0 },          // 서 (안쪽 면 x = x0)
    { len: ROOM_D + 0.24, inner: ROOM_D, cx: rx0 + ROOM_W + 0.12, cz: origin.z + 0.12, rot: Math.PI / 2, inX: -1, inZ: 0 }, // 동
  ];
  const paperGeos = [];
  for (const w of walls) {
    const at = (off, y) => [w.cx + w.inX * off, y, w.cz + w.inZ * off];
    add('wallEdge', w.len, WALL_H, 0.24, ...at(0, WALL_H / 2), w.rot);
    add('wainscot', w.len - 0.24, WAINSCOT_H, 0.05, ...at(0.135, WAINSCOT_H / 2), w.rot);
    add('molding', w.len - 0.24, 0.07, 0.09, ...at(0.165, WAINSCOT_H + 0.01), w.rot);
    add('baseboard', w.len - 0.24, 0.13, 0.08, ...at(0.17, 0.065), w.rot);
    add('molding', w.len, 0.1, 0.1, ...at(0.13, WALL_H - 0.05), w.rot);
    // 벽지 판: 안쪽 면에 딱 붙인다. UV = (벽을 따라 m, 높이 m)
    const h = WALL_H - WAINSCOT_H;
    const g = new THREE.PlaneGeometry(w.inner, h, Math.round(w.inner * 2), 4);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w.inner, WAINSCOT_H + uv.getY(i) * h);
    if (w.inX) g.rotateY(w.inX > 0 ? Math.PI / 2 : -Math.PI / 2);
    const [px, , pz] = at(0.122, 0);   // 벽 상자 안쪽 면에서 2mm 앞
    g.translate(w.inX ? px : origin.x, WAINSCOT_H + h / 2, w.inX ? origin.z : pz);
    paperGeos.push(g);
  }
  // 앞쪽 모서리 기둥 (벽 끝이 깔끔하게)
  for (const sx of [-1, 1]) add('molding', 0.3, WALL_H + 0.04, 0.3, origin.x + sx * (ROOM_W / 2 + 0.12), WALL_H / 2, rz0 + ROOM_D + 0.1);

  // ── 창문 (북쪽 벽) ──
  for (const key of WINDOWS) {
    const gx = Number(key.split(':')[1]);
    const cx = rx0 + gx + 0.5, wz = rz0 + 0.01;
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
  const mx = rx0 + (DOOR.gx0 + DOOR.gx1 + 1) / 2, mz = rz0 + ROOM_D - 0.42;
  add('doormatEdge', 1.36, 0.03, 0.66, mx, 0.012, mz);
  add('doormat', 1.2, 0.034, 0.52, mx, 0.014, mz);

  const group = new THREE.Group();
  group.name = origin === ROOM ? 'house-room' : 'visit-room';
  const mats = {};
  const colorOf = name => frame?.palette?.[name] ?? wallpaper?.palette?.[name] ?? '#FFFFFF';
  for (const [name, geos] of Object.entries(parts)) {
    const geo = mergeGeometries(geos);
    geos.forEach(g => g.dispose());
    const mat = materials.toonMaterial(colorOf(name), { name });
    mats[name] = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `room-${name}`;
    mesh.receiveShadow = true;
    mesh.castShadow = !name.startsWith('floor') && name !== 'doormat' && name !== 'doormatEdge' && name !== 'pane';
    group.add(mesh);
  }

  // 무늬 판: 벽지 하나, 바닥 하나 (텍스처만 바꿔 끼운다)
  const paperGeo = mergeGeometries(paperGeos);
  paperGeos.forEach(g => g.dispose());
  mats.wallpaper = materials.toonMaterial('#FFFFFF', { name: 'wallpaper' });
  const paper = new THREE.Mesh(paperGeo, mats.wallpaper);
  paper.name = 'room-wallpaper';
  paper.receiveShadow = true;
  group.add(paper);

  const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D, 16, 16);
  const fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * ROOM_W, fuv.getY(i) * ROOM_D);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(origin.x, 0, origin.z);
  mats.roomFloor = materials.toonMaterial('#FFFFFF', { name: 'roomFloor' });
  const floorMesh = new THREE.Mesh(floorGeo, mats.roomFloor);
  floorMesh.name = 'room-floor';
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  const paneDay = new THREE.Color(frame?.palette?.pane ?? '#CDEBF5'), paneNight = new THREE.Color(frame?.palette?.paneNight ?? '#3A4A78');
  const swap = (mat, tex) => { mat.map?.dispose(); mat.map = tex; mat.needsUpdate = true; };
  const room = {
    group, materials: mats, origin, x0: rx0, z0: rz0,
    wallpaper: null, floor: null,
    /** 벽지 스펙 바꾸기: 무늬 + 징두리·몰딩·걸레받이·벽 두께 색 */
    setWallpaper(spec) {
      if (!spec?.pattern) return;
      room.wallpaper = spec;
      swap(mats.wallpaper, patternTexture(THREE, spec, ctx.renderer));
      const pal = spec.palette ?? {};
      for (const k of ['wainscot', 'molding', 'baseboard']) if (pal[k]) mats[k].color.set(pal[k]);
      mats.wallEdge.color.set(pal[spec.pattern.base] ?? pal.base ?? '#F7EBD3');
    },
    /** 바닥 스펙 바꾸기: 무늬 + 앞 턱 색 */
    setFloor(spec) {
      if (!spec?.pattern) return;
      room.floor = spec;
      swap(mats.roomFloor, patternTexture(THREE, spec, ctx.renderer));
      if (spec.palette?.edge) mats.floorEdge.color.set(spec.palette.edge);
    },
    /** 창밖 색: 밤 정도(0~1)에 맞춰 */
    setNight(nf) { mats.pane.color.copy(paneDay).lerp(paneNight, Math.min(1, Math.max(0, nf))); },
    dispose() {
      group.removeFromParent();
      group.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      for (const m of Object.values(mats)) { m.map?.dispose(); m.dispose(); }
    },
  };
  room.setWallpaper(wallpaper);
  room.setFloor(floor);
  return room;
}

/** 벽 가구 자리 → 월드 위치·회전 (모델 원점 = 벽면 바닥, 정면 +Z). corner = 방 북서쪽 모서리 (기본 = 플레이어 방) */
export function wallMount(wall, slot, corner = { x0, z0 }) {
  const gap = 0.012;
  if (wall === 'n') return { x: corner.x0 + slot + 0.5, z: corner.z0 + gap, rotY: 0 };
  if (wall === 'w') return { x: corner.x0 + gap, z: corner.z0 + slot + 0.5, rotY: Math.PI / 2 };
  return { x: corner.x0 + ROOM_W - gap, z: corner.z0 + slot + 0.5, rotY: -Math.PI / 2 };
}
