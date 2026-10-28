// 삽·도끼·물뿌리개.
//   삽: 앞 칸의 화석 자리를 파면 data.harvest.digFossil → 화석. 빈 풀밭·모래를 파면 구덩이(오늘 하루), 구덩이를 또 파면 메운다.
//       꽃을 파면 꽃 아이템이 되고 구덩이가 남는다. 구덩이에 F 로 심는다 (garden.js).
//   도끼: 바위 → harvest.hitRock (돌·철광석·점토·도토리 주머니가 튀어나온다), 나무 → harvest.chopTree (나무를 베지 않고 목재만)
//   물뿌리개: 앞 꽃들이 오늘 하루 반짝이고, 새 날에 옆 같은 꽃과 새 꽃을 피울 수 있다 (garden.js)
import { rand } from './util.js';
import { FLOWER_KINDS } from './garden.js';

const ROCK = new Set(['rock']);
const WOOD = new Set(['tree', 'cedar', 'fruit-tree']);
const FLOWERS = new Set(['tulip', 'cosmos', 'pansy', 'bush']);

export function createWork(ctx, kit, { mk, fx, drops, results, toolbelt, act, garden }) {
  const { THREE: T, scene, state, events } = ctx;
  const front = (d = 0.7) => kit.player.pointInFront(d);
  const sameLevel = o => Math.abs(o.y - kit.player.position.y) < 0.5;

  // ---------- 구덩이 (world.daily 가 오늘 판 자리를 적어 둔다) ----------
  const holes = new Map();      // 'tx,tz' → mesh
  function syncHoles() {
    const want = new Set(kit.world?.daily?.holes?.() ?? []);
    for (const [k, m] of holes) if (!want.has(k)) { scene.remove(m); holes.delete(k); }
    for (const k of want) {
      if (holes.has(k)) continue;
      const [tx, tz] = k.split(',').map(Number);
      const c = kit.world.island.toWorld(tx, tz);
      const m = mk.hole();
      m.position.set(c.x, kit.world.island.heightAt(c.x, c.z), c.z);
      m.rotation.y = (tx * 7 + tz * 13) % 6;
      scene.add(m);
      holes.set(k, m);
    }
  }

  // ---------- 물 준 꽃 (오늘 하루 반짝) ----------
  // 읽을 때는 고치지 않는다: 어제 기록은 새 날에 garden.bloom 이 쓰고 비운다
  const today = () => kit.data?.day?.key?.() ?? null;
  const wateredToday = () => { const w = state.island.watered; return w && w.dayKey === today() ? w.ids : []; };
  const markWatered = id => {
    let w = state.island.watered;
    if (!w || w.dayKey !== today()) w = state.island.watered = { dayKey: today(), ids: [] };
    if (w.ids.includes(id)) return false;
    w.ids.push(id);
    return true;
  };
  const twinkles = new Map();   // 꽃 id → [{ m, phase }]
  let starGeo = null, starMat = null;
  function syncTwinkles() {
    const ids = new Set(wateredToday());
    for (const [id, list] of twinkles) if (!ids.has(id)) { for (const s of list) scene.remove(s.m); twinkles.delete(id); }
    for (const id of ids) {
      if (twinkles.has(id)) continue;
      const o = kit.world?.objects.get(id);
      if (!o) continue;
      starGeo ??= new T.OctahedronGeometry(0.055, 0);
      starMat ??= ctx.materials.toonMaterial('#FFF6C2', { flat: true, name: 'sparkle' });
      const list = [];
      for (let i = 0; i < 3; i++) {
        const m = new T.Mesh(starGeo, starMat);
        m.position.set(o.x + rand(-0.25, 0.25), o.y + rand(0.35, 0.65), o.z + rand(-0.25, 0.25));
        scene.add(m);
        list.push({ m, phase: rand(0, Math.PI * 2), y: m.position.y });
      }
      twinkles.set(id, list);
    }
  }

  // ---------- 삽 ----------
  async function dig() {
    const world = kit.world, isl = world.island;
    const t = kit.player.tileInFront();
    const c = isl.toWorld(t.tx, t.tz);
    const spot = world.objects.query(c.x, c.z, 0.45).find(o => o.kind === 'fossil-spot' && sameLevel(o));
    const key = `${t.tx},${t.tz}`;
    const hasHole = world.daily?.holes?.().includes(key);
    const ground = isl.tileAt(t.tx, t.tz);
    const myLevel = isl.levelAt(...Object.values(isl.toTile(kit.player.position.x, kit.player.position.z)));
    const level = isl.levelAt(t.tx, t.tz) === myLevel;
    const soft = ['grass', 'sand', 'path', 'cliff'].includes(ground) && level;
    const onTile = world.objects.at(t.tx, t.tz);
    const flower = onTile && FLOWER_KINDS.has(onTile.kind) && !onTile.data?.grow && level ? onTile : null;
    // 구덩이를 팔 수 있는 빈 땅 (길·절벽 가장자리 말고)
    const open = ['grass', 'sand'].includes(ground) && level && !onTile && isl.isWalkable(c.x, c.z);
    await act('dig', {
      onHit() {
        const at = { x: c.x, y: isl.heightAt(c.x, c.z), z: c.z };
        if (!spot && !hasHole && !soft) { kit.sfx('axe-rock', { volume: 0.4, pitch: 1.5 }); return; }
        kit.sfx('dig');
        fx.dust(at, 8, ground === 'sand' ? '#E8D6A8' : '#C8B08A');
        toolbelt.use('shovel');
        if (flower) {
          const id = garden.itemOfFlower(flower);
          if (!results.fits(id)) { kit.toast('가방이 꽉 찼어요!', '🎒'); return; }
          garden.takeFlower(flower);
          results.gain(id, 1, { verb: '파냈다' });
          world.daily?.addHole?.(t.tx, t.tz);
          syncHoles(); syncTwinkles();
        } else if (spot) {
          const k = world.daily?.spotOf?.(spot.id)?.key ?? key;
          const fossil = kit.data?.harvest?.digFossil?.(k);
          if (!world.daily?.take?.(spot.id)) world.objects.remove(spot.id);
          world.daily?.addHole?.(t.tx, t.tz);
          syncHoles();
          if (fossil) {
            kit.sfx('fossil', { delay: 0.15 });
            results.gain(fossil, 1, { verb: '파냈다', show: true });
          }
        } else if (hasHole) {
          world.daily.removeHole(t.tx, t.tz);
          syncHoles();
        } else if (open) {
          world.daily?.addHole?.(t.tx, t.tz);
          syncHoles();
        }
      },
    });
  }

  // ---------- 도끼 ----------
  async function chop() {
    const world = kit.world, p = kit.player;
    const f = front(0.65);
    const target = world.objects.query(f.x, f.z, 0.6).find(o => (ROCK.has(o.kind) || (WOOD.has(o.kind) && !o.data?.grow)) && sameLevel(o));
    if (target) p.face(target.x, target.z);
    await act('chop', {
      onHit() {
        if (!target) { kit.sfx('net-swing', { volume: 0.5, pitch: 0.7 }); return; }
        const isRock = ROCK.has(target.kind);
        const hit = { x: target.x + (p.position.x - target.x) * 0.35, y: target.y + (isRock ? 0.3 : 0.45), z: target.z + (p.position.z - target.z) * 0.35 };
        kit.sfx(isRock ? 'axe-rock' : 'axe-wood');
        fx.chips(hit, isRock ? 'stone' : 'wood', 6);
        toolbelt.use('axe');
        const h = kit.data?.harvest;
        const r = isRock ? h?.hitRock?.(target.id) : h?.chopTree?.(target.id);
        if (!isRock) world.objects.shake(target.id);
        if (!r) return;
        const toward = Math.atan2(p.position.x - target.x, p.position.z - target.z);
        const spot = drops.findSpot(target.x, target.z, { rMin: isRock ? 0.65 : 0.55, rMax: 1.05, toward });
        if (!spot) { results.gain(r.id, r.count); return; }
        drops.drop(r.id, r.count, spot, { from: { x: hit.x, y: hit.y + 0.2, z: hit.z }, sound: r.id === 'mat.acorn-bag' ? 'acorn' : 'fruit-drop' });
      },
    });
  }

  // ---------- 물뿌리개 ----------
  async function water() {
    const world = kit.world, p = kit.player;
    const f = front(0.95);
    const flowers = world.objects.query(f.x, f.z, 0.85).filter(o => FLOWERS.has(o.kind) && sameLevel(o));
    await act('water', {
      onHit() {
        kit.sfx('water');
        toolbelt.use('can');
        pouring = true;
        if (!flowers.length) return;
        let fresh = 0;
        for (const o of flowers) if (markWatered(o.id)) fresh++;
        syncTwinkles();
        for (const o of flowers) fx.sparkle({ x: o.x, y: o.y + 0.45, z: o.z }, 3);
        if (fresh) events.emit('gather:watered', { ids: flowers.map(o => o.id) });
      },
    });
    pouring = false;
  }

  let pouring = false, pourT = 0;
  const tip = new T.Vector3();
  return {
    dig, chop, water,
    syncHoles, syncTwinkles,
    update(dt) {
      // 물뿌리개를 기울이는 동안 물방울
      const p = kit.player;
      if (pouring && p?.acting === 'water') {
        pourT -= dt;
        if (pourT <= 0 && p.toolTip(tip)) {
          pourT = 0.05;
          const f = front(0.95);
          fx.pour(tip, { x: f.x, y: kit.world.island.heightAt(f.x, f.z) + 0.05, z: f.z }, 2);
        }
      }
      const t = performance.now() / 1000;
      for (const list of twinkles.values()) for (const s of list) {
        const k = Math.max(0, Math.sin(t * 2.2 + s.phase));
        s.m.scale.setScalar(0.25 + k * 0.9);
        s.m.position.y = s.y + Math.sin(t * 1.3 + s.phase) * 0.04;
        s.m.rotation.y = t * 2 + s.phase;
      }
    },
  };
}
