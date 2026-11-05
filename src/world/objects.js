// 배경 물체 목록 (CONTRACTS 의 world.objects): 나무·바위·꽃·건물… 을 id 로 관리한다.
// 그리기는 (종류 · 변형 · 구역) 별 인스턴스 묶음, 충돌은 collision.js, 저장은 state.island.removed / added.
import { LEVEL_HEIGHT } from './island.js';
import { CHUNK } from './terrain.js';

// 충돌 모양·차지하는 칸은 배경 스펙의 world 칸에 있다 (assets/env/specs/<slug>.json → world.collider · extent · lot).
// 모델을 고칠 때 같은 파일에서 함께 고친다. collider (모델 원점 기준): r = 원, box = [가로, 세로] 가운데 정렬,
// boxes = [[x0, z0, x1, z1] …], circles = [[x, z, r] …]. extent = query 거리 계산용 반너비 [x, z, (안 씀), z 중심 이동].
// 건물은 extent 없이 집터(lot, 칸 수)의 절반을 쓴다.

// 계절 변형이 있는 종류: 계절 → 변형 이름
export const SEASONAL = {
  tree: s => s,
  cedar: s => (s === 'winter' ? 'snow' : 'green'),
  'cherry-tree': s => s,   // 8차 EN-12 벚나무 (봄 꽃놀이 동안 광장 둘레에 놓임)
};
const SWAY = new Set(['tree', 'fruit-tree', 'cedar', 'palm', 'cherry-tree', 'bush', 'tulip', 'cosmos', 'pansy', 'weed']);
const SINGLE = new Set(['campfire']);       // 따로 애니메이션을 돌리는 물체 (하나뿐)
const NO_SHADOW = new Set(['tulip', 'cosmos', 'pansy', 'weed', 'shell', 'fossil-spot']);   // 작은 것은 그림자를 드리우지 않는다 (그림자 계산 절약)

// lazy = 처음에 안 읽고 놓일 때 받는 종류 (계절 행사 모델 — assets/events/events.json 의 assets.env), loadKind(kind) → { gltf, spec }
export function createObjects(ctx, island, kit, models, collision, { lazy = new Set(), loadKind = null } = {}) {
  const { THREE: T, state, events } = ctx;
  const { w, h } = island;
  const COLLIDERS = {}, EXTENT = {};
  const learn = (kind, spec) => {
    const wd = spec.world ?? {};
    if (wd.collider) COLLIDERS[kind] = wd.collider;
    const e = wd.extent ?? (wd.lot && [wd.lot[0] / 2, wd.lot[1] / 2]);
    if (e) EXTENT[kind] = e;
  };
  for (const [kind, { spec }] of Object.entries(models)) learn(kind, spec);
  // 행사 모델 받기: 같은 종류는 한 번만. 받는 동안 놓인 물체는 waiting 에 두었다가 다 받으면 놓는다 (그 사이 remove 되면 버림)
  const loading = new Map();
  const waiting = new Map();
  function ensure(kind) {
    if (models[kind]) return Promise.resolve(true);
    if (!lazy.has(kind) || !loadKind) return Promise.resolve(false);
    if (!loading.has(kind)) {
      const job = loadKind(kind).then(m => { models[kind] = m; learn(kind, m.spec); return true; });
      job.catch(e => { loading.delete(kind); console.warn(`[world] 행사 모델을 못 받았어요: ${kind}`, e); });
      loading.set(kind, job);
    }
    return loading.get(kind);
  }
  function wait(o, emit) {
    waiting.set(o.id, o);
    ensure(o.kind).then(ok => {
      if (waiting.get(o.id) !== o) return;
      waiting.delete(o.id);
      if (!ok) return;
      insert(o);
      if (emit) events.emit('world:object', { type: 'add', id: o.id, kind: o.kind });
    }, () => waiting.delete(o.id));
  }
  const group = new T.Group();
  group.name = 'objects';
  ctx.scene.add(group);

  const byId = new Map();
  const tileIndex = new Map();          // 칸 번호 → Set(id)
  const templates = new Map();
  const batches = new Map();
  const singles = [];
  let season = 'autumn';

  const tplKey = (kind, variant) => (SEASONAL[kind] && !variant ? `${kind}|*` : `${kind}|${variant ?? ''}`);
  function template(kind, variant) {
    const key = tplKey(kind, variant);
    if (templates.has(key)) return templates.get(key);
    const { gltf, spec } = models[kind];
    const v = variant ?? (SEASONAL[kind] ? SEASONAL[kind](season) : null);
    const palette = { ...spec.palette, ...(spec.variants?.[v]?.palette ?? {}) };
    const tpl = kit.buildTemplate(prune(gltf, kind, variant), spec, { palette, sway: SWAY.has(kind), castShadow: !NO_SHADOW.has(kind) });
    tpl.kind = kind; tpl.variant = variant;
    templates.set(key, tpl);
    return tpl;
  }
  // 열매를 딴 과일나무·야자수('picked')처럼 일부 재질을 빼는 변형
  const PICKED = { 'fruit-tree': 'fruit', palm: 'coconut' };
  function prune(gltf, kind, variant) {
    if (!(PICKED[kind] && variant === 'picked')) return gltf;
    const scene = gltf.scene.clone(true);
    const drop = [];
    scene.traverse(o => { if (o.isMesh && o.material.name === PICKED[kind]) drop.push(o); });
    for (const o of drop) o.parent.remove(o);
    return { scene, animations: gltf.animations };
  }
  function batch(kind, variant, tx, tz) {
    const key = `${tplKey(kind, variant)}|${Math.floor(tx / CHUNK)},${Math.floor(tz / CHUNK)}`;
    if (!batches.has(key)) batches.set(key, new kit.Batch(template(kind, variant), 8, group));
    return batches.get(key);
  }

  const q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), m4 = new T.Matrix4(), pv = new T.Vector3(), sv = new T.Vector3();
  const matrixOf = o => m4.compose(pv.set(o.x, o.y, o.z), q.setFromAxisAngle(up, o.rot), sv.setScalar(o.scale));

  function draw(o) {
    if (SINGLE.has(o.kind)) {
      const { gltf, spec } = models[o.kind];
      const { scene: obj, animations } = ctx.assets.instantiate(gltf);
      ctx.materials.applyToonStyle(obj, { spec });
      obj.position.set(o.x, o.y, o.z); obj.rotation.y = o.rot; obj.scale.setScalar(o.scale);
      group.add(obj);
      const mixer = new T.AnimationMixer(obj);
      for (const clip of animations) mixer.clipAction(clip).play();
      o.single = { obj, mixer };
      singles.push(o);
      return;
    }
    o.batch = batch(o.kind, o.variant, o.tx, o.tz);
    o.slot = o.batch.add(o.id, matrixOf(o));
  }
  function undraw(o) {
    if (o.single) { group.remove(o.single.obj); singles.splice(singles.indexOf(o), 1); o.single = null; return; }
    if (!o.batch) return;
    const moved = o.batch.remove(o.slot);
    if (moved) byId.get(moved).slot = o.slot;
    o.batch = null;
  }

  function collidersOf(o) {
    const c = COLLIDERS[o.kind];
    if (!c) return [];
    const out = [];
    const s = o.scale, cos = Math.round(Math.cos(o.rot)), sin = Math.round(Math.sin(o.rot));
    const quarter = Math.abs(sin) === 1;      // 90° 돌린 물체 (울타리 세로, 벤치)
    if (c.r) out.push({ type: 'circle', x: o.x, z: o.z, r: c.r * s, y: o.y, id: o.id });
    if (c.box) {
      const [bw, bd] = quarter ? [c.box[1], c.box[0]] : c.box;
      out.push({ type: 'box', x0: o.x - bw / 2 * s, x1: o.x + bw / 2 * s, z0: o.z - bd / 2 * s, z1: o.z + bd / 2 * s, y: o.y, id: o.id });
    }
    for (const [x0, z0, x1, z1] of c.boxes ?? []) {
      // 건물은 남쪽을 본다 (rot 0). 다른 방향이면 90° 단위로 돌린다
      const pts = [[x0, z0], [x1, z1]].map(([a, b]) => [a * cos + b * sin, -a * sin + b * cos]);
      out.push({ type: 'box', x0: o.x + Math.min(pts[0][0], pts[1][0]) * s, x1: o.x + Math.max(pts[0][0], pts[1][0]) * s,
        z0: o.z + Math.min(pts[0][1], pts[1][1]) * s, z1: o.z + Math.max(pts[0][1], pts[1][1]) * s, y: o.y, id: o.id });
    }
    // 원은 아무 각도로나 돌 수 있다 (5차 Z5: 축제 광장 둘레 부스)
    const fc = Math.cos(o.rot), fs = Math.sin(o.rot);
    for (const [cx, cz, r] of c.circles ?? []) out.push({ type: 'circle', x: o.x + (cx * fc + cz * fs) * s, z: o.z + (-cx * fs + cz * fc) * s, r: r * s, y: o.y, id: o.id });
    return out;
  }

  // 물체가 걸친 칸들 (query 용)
  function tilesOf(o) {
    const e = EXTENT[o.kind];
    if (!e) return [o.tz * w + o.tx];
    const quarter = Math.abs(Math.round(Math.sin(o.rot))) === 1;
    const [ex, ez] = quarter ? [e[1], e[0]] : e;
    const cz = o.z + (e[3] ?? 0);
    const a = island.toTile(o.x - ex + 0.01, cz - ez + 0.01), b = island.toTile(o.x + ex - 0.01, cz + ez - 0.01);
    const out = [];
    for (let tz = a.tz; tz <= b.tz; tz++) for (let tx = a.tx; tx <= b.tx; tx++) if (tx >= 0 && tz >= 0 && tx < w && tz < h) out.push(tz * w + tx);
    return out;
  }

  function insert(o) {
    byId.set(o.id, o);
    o.tiles = tilesOf(o);
    for (const k of o.tiles) { if (!tileIndex.has(k)) tileIndex.set(k, new Set()); tileIndex.get(k).add(o.id); }
    o.colliders = collidersOf(o).map(collision.add);
    draw(o);
  }
  function erase(o) {
    undraw(o);
    for (const c of o.colliders) collision.remove(c);
    for (const k of o.tiles) tileIndex.get(k)?.delete(o.id);
    byId.delete(o.id);
  }

  const publicOf = o => ({ id: o.id, kind: o.kind, x: o.x, z: o.z, y: o.y, tile: { tx: o.tx, tz: o.tz }, variant: o.variant, scale: o.scale, data: o.data });

  const api = {
    /** (x, z) 에서 radius 안의 물체. 여러 칸 물체는 가장 가까운 테두리까지 거리로 잰다. */
    query(x, z, radius = 0.5) {
      const a = island.toTile(x - radius - 1, z - radius - 1), b = island.toTile(x + radius + 1, z + radius + 1);
      const seen = new Set(), out = [];
      for (let tz = Math.max(0, a.tz); tz <= Math.min(h - 1, b.tz); tz++) for (let tx = Math.max(0, a.tx); tx <= Math.min(w - 1, b.tx); tx++) {
        const s = tileIndex.get(tz * w + tx);
        if (!s) continue;
        for (const id of s) {
          if (seen.has(id)) continue;
          seen.add(id);
          const o = byId.get(id);
          const e = EXTENT[o.kind];
          let d;
          if (e) {
            const quarter = Math.abs(Math.round(Math.sin(o.rot))) === 1;
            const [ex, ez] = quarter ? [e[1], e[0]] : e;
            const cz = o.z + (e[3] ?? 0);
            d = Math.hypot(Math.max(0, Math.abs(x - o.x) - ex), Math.max(0, Math.abs(z - cz) - ez));
          } else d = Math.hypot(x - o.x, z - o.z);
          if (d <= radius) out.push({ ...publicOf(o), dist: d });
        }
      }
      return out.sort((p, q2) => p.dist - q2.dist);
    },
    get(id) { const o = byId.get(id); return o ? publicOf(o) : null; },
    /** 칸 위의 물체 (없으면 null) */
    at(tx, tz) { const s = tileIndex.get(tz * w + tx); return s?.size ? publicOf(byId.get([...s][0])) : null; },
    list(kind) { return [...byId.values()].filter(o => !kind || o.kind === kind).map(publicOf); },
    remove(id) {
      const o = byId.get(id) ?? waiting.get(id);
      if (!o) return false;
      if (waiting.get(id) === o) waiting.delete(id);
      else erase(o);
      const isl = state.island;
      const ai = isl.added.findIndex(a => a.id === id);
      if (ai >= 0) isl.added.splice(ai, 1);
      else if (o.generated && !isl.removed.includes(id)) isl.removed.push(id);
      events.emit('world:object', { type: 'remove', id, kind: o.kind });
      return true;
    },
    /** 칸 가운데에 물체를 놓는다. data: { rot, scale, variant, persist=true, at: {x, z, y}?, ... } → id (at = 칸 가운데 대신 그 자리, 5차 Z5 축제 부스) */
    add(kind, tx, tz, data = {}) {
      if (!models[kind] && !lazy.has(kind)) { console.warn(`[world] 모르는 배경 종류: ${kind}`); return null; }
      const { rot = 0, scale = 1, variant = null, persist = true, id: wantId, at = null, ...rest } = data;
      let id = wantId ?? `${kind}@${tx},${tz}`;
      for (let n = 2; byId.has(id) || waiting.has(id); n++) id = `${kind}@${tx},${tz}~${n}`;
      const c = at ?? island.toWorld(tx, tz);
      const lvl = island.levelAt(tx, tz);
      const o = { id, kind, tx, tz, x: c.x, z: c.z, y: at?.y ?? lvl * LEVEL_HEIGHT, rot, scale, variant, data: rest, generated: false };
      if (persist) state.island.added.push({ id, kind, tx, tz, data: { rot, scale, variant, ...(at ? { at } : {}), ...rest } });
      if (!models[kind]) { wait(o, true); return id; }   // 행사 모델: 받은 뒤 놓고 그때 알림
      insert(o);
      events.emit('world:object', { type: 'add', id, kind });
      return id;
    },
    setVariant(id, variant) {
      const o = byId.get(id);
      if (!o || o.variant === variant) return false;
      undraw(o);
      o.variant = variant;
      draw(o);
      const a = state.island.added.find(x => x.id === id);
      if (a) a.data.variant = variant;
      else if (o.generated) (state.island.variants ??= {})[id] = variant;
      return true;
    },
    /** 크기·data 바꾸기 (심은 나무가 자랄 때). data 의 값을 undefined 로 주면 그 칸을 뺀다 */
    update(id, { scale, data } = {}) {
      const o = byId.get(id);
      if (!o) return false;
      if (scale != null && scale !== o.scale) {
        undraw(o);
        for (const c of o.colliders) collision.remove(c);
        o.scale = scale;
        o.colliders = collidersOf(o).map(collision.add);
        draw(o);
      }
      const merge = (dst, src) => { for (const [k, v] of Object.entries(src)) { if (v === undefined) delete dst[k]; else dst[k] = v; } };
      if (data) merge(o.data, data);
      const a = state.island.added.find(x => x.id === id);
      if (a) { if (scale != null) a.data.scale = scale; if (data) merge(a.data, data); }
      return true;
    },
    /** 행사 모델을 미리 받아 둔다 (놓기 전에 부르면 놓을 때 멈칫하지 않는다) → Promise<boolean> */
    ensure: kinds => Promise.all([].concat(kinds).map(ensure)).then(r => r.every(Boolean)),
    /** 흔들기 연출 (나무·덤불). P2 채집에서 쓴다 */
    shake(id) { const o = byId.get(id); if (o?.batch) o.batch.shakeAt(o.slot); return !!o; },
  };

  return {
    api, group, templates, batches,
    /** 안쪽 기록 (묶음·칸 번호까지). 가림 투명(occlusion.js)이 쓴다 */
    raw: id => byId.get(id),
    /** 생성기가 만든 물체 + 저장된 변경(없앤 것·놓은 것·변형) 적용 */
    populate(list) {
      const isl = state.island;
      const removed = new Set(isl.removed ?? []);
      const variants = isl.variants ?? {};
      for (const g of list) {
        if (removed.has(g.id)) continue;
        insert({ ...g, data: { ...g.data }, variant: variants[g.id] ?? g.variant, generated: true });
      }
      for (const a of isl.added ?? []) {
        if (byId.has(a.id)) continue;
        const { rot = 0, scale = 1, variant = null, at = null, ...rest } = a.data ?? {};
        const c = at ?? island.toWorld(a.tx, a.tz);
        const o = { id: a.id, kind: a.kind, tx: a.tx, tz: a.tz, x: c.x, z: c.z, y: at?.y ?? island.levelAt(a.tx, a.tz) * LEVEL_HEIGHT, rot, scale, variant, data: rest, generated: false };
        if (models[a.kind]) insert(o); else if (lazy.has(a.kind)) wait(o, true);
      }
    },
    setSeason(s) {
      season = s;
      for (const tpl of templates.values()) {
        const fn = SEASONAL[tpl.kind];
        if (!fn || tpl.variant) continue;
        const spec = models[tpl.kind].spec;
        tpl.recolor({ ...spec.palette, ...(spec.variants?.[fn(s)]?.palette ?? {}) });
      }
    },
    update(dt) {
      for (const o of singles) o.single.mixer.update(dt);
    },
    setOutlineVisible(v) { for (const b of batches.values()) b.setOutlineVisible(v); },
  };
}
