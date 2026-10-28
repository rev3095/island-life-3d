// 트랙 T1: 섬 월드 — 지형 생성·그리기, 배경 물체, 충돌·높이. ctx.services.world 를 올린다 (docs/CONTRACTS.md).
import { generateIsland, createIslandApi, KIND } from './island.js';
import { createKit } from './kit.js';
import { buildTerrain } from './terrain.js';
import { createObjects } from './objects.js';
import { createCollision } from './collision.js';

let kit, terrain, objects, stats = null, elapsed = 0;

export default {
  name: 'world',

  async init(ctx) {
    const { THREE, constants, state, assets, events, scene } = ctx;
    const t0 = performance.now();
    // 특산 과일은 data 모듈(T2)이 시드로 정한다 → 과일나무 열매 색을 거기에 맞춘다 (item.variant = fruit-tree 변형 이름)
    const data = ctx.services.data;
    const fruitId = data?.economy?.nativeFruit?.();
    const nativeFruit = fruitId ? (data.items?.get?.(fruitId)?.variant ?? String(fruitId).split('.')[1]) : null;
    const gen = generateIsland(state.island.seed, { ...constants.ISLAND, villagers: constants.VILLAGERS, nativeFruit });
    const base = createIslandApi(gen);

    // 배경 모델 32종을 한꺼번에 불러온다 (같은 모델은 assets 가 캐시)
    const index = await assets.loadEnvIndex();
    const models = Object.fromEntries(await Promise.all(index.models.map(async m =>
      [m.slug, { gltf: await assets.loadEnv(m.slug), spec: await assets.loadEnvSpec(m.slug) }])));

    kit = createKit(ctx);
    const collision = createCollision(base);
    terrain = buildTerrain(ctx, gen, base, kit, models);
    objects = createObjects(ctx, base, kit, models, collision);
    objects.populate(gen.objects);

    const island = {
      w: base.w, h: base.h,
      tileAt: base.tileAt, levelAt: base.levelAt, heightAt: base.heightAt, isWater: base.isWater,
      toTile: base.toTile, toWorld: base.toWorld,
      /** 땅이 걸을 수 있고 물체 충돌체 안이 아니면 true */
      isWalkable(x, z) {
        const { tx, tz } = base.toTile(x, z);
        return base.isWalkableTile(tx, tz) && !collision.blockedAt(x, z, base.heightAt(x, z));
      },
      passable: base.passable, rampAt: base.rampAt, groundAt: base.groundAt, flagsAt: base.flagsAt,
    };

    let season = null;
    function setSeason(s) {
      if (!s || s === season) return;
      season = s;
      const g = models['tile-grass'].spec;
      const pal = { ...g.palette, ...(g.variants?.[s]?.palette ?? {}) };
      terrain.templates[KIND.GRASS].recolor(pal);
      terrain.templates[KIND.CLIFF].recolor({ grass: pal.grass });
      objects.setSeason(s);
      events.emit('world:season', { season: s });
    }
    const month = ctx.services.time?.now?.().month ?? new Date().getMonth() + 1;
    setSeason(ctx.services.time?.now?.().season ?? constants.seasonOf(month));
    events.on('time:newday', () => { const t = ctx.services.time?.now?.(); if (t) setSeason(t.season ?? constants.seasonOf(t.month)); });

    // sky 모듈이 없을 때만 기본 안개 (먼 바다가 하늘색에 녹아들게)
    if (!scene.fog && !ctx.services.time) scene.fog = new THREE.Fog(scene.background?.getHex?.() ?? 0xbfe6f7, 48, 130);

    ctx.services.world = {
      island, places: gen.places, objects: objects.api, setSeason,
      get season() { return season; },
      /** 원(반지름 r)을 (fx,fz) → (nx,nz) 로 옮긴다. 막히면 미끄러진 자리 {x, z} */
      collide: (fx, fz, nx, nz, r, y) => collision.move(fx, fz, nx, nz, r, y),
      setOutlineVisible(v) { terrain.setOutlineVisible(v); objects.setOutlineVisible(v); },
      nativeFruit: gen.nativeFruit,
      /** 날마다 새로 놓는 것(조개·잡초·화석 자리·꽃)의 후보 칸. data.day.pickSpots(후보, n, 'fossil') 에 바로 넣으면 된다 */
      spawnTiles(kind) {
        const out = [];
        const wantSand = kind === 'shell';
        for (let tz = 0; tz < gen.h; tz++) for (let tx = 0; tx < gen.w; tx++) {
          const k = island.tileAt(tx, tz);
          if (wantSand ? k !== 'sand' : k !== 'grass') continue;
          if (base.flagsAt(tx, tz) || objects.api.at(tx, tz)) continue;
          if (wantSand && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => island.tileAt(tx + a, tz + b) === 'sea')) continue;   // 조개는 물가 모래
          const { x, z } = island.toWorld(tx, tz);
          if (collision.blockedAt(x, z)) continue;
          out.push({ tx, tz, x, z, level: island.levelAt(tx, tz) });
        }
        return out;
      },
      debug: { gen, kit, terrain, objects, collision, models },
    };
    if (ctx.debug) stats = createStats(ctx);
    console.info(`[world] 섬 준비 ${Math.round(performance.now() - t0)}ms · 물체 ${gen.objects.length}개 · 계절 ${season}`);
    events.emit('world:ready', { island });
  },

  update(dt, ctx) {
    elapsed += dt;
    kit.uTime.value = elapsed;
    terrain.update(dt, elapsed);
    objects.update(dt);
    kit.updateCulling();
    stats?.update(dt);
  },
};

/** ?debug 일 때 왼쪽 위에 fps·그리기 호출·삼각형 수 */
function createStats(ctx) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:8px;top:8px;padding:4px 8px;border-radius:8px;background:rgba(74,59,50,.75);color:#FFF8E6;font:12px/1.4 monospace;pointer-events:none;white-space:pre';
  ctx.uiRoot.append(el);
  let last = performance.now(), frames = 0;
  return {
    update() {
      frames++;
      const now = performance.now(), acc = (now - last) / 1000;
      if (acc < 0.5) return;
      const i = ctx.renderer.info, p = ctx.services.player?.position;
      const t = p && ctx.services.world.island.toTile(p.x, p.z);
      el.textContent = `fps ${Math.round(frames / acc)}  calls ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k\n`
        + `geo ${i.memory.geometries}  prog ${i.programs?.length ?? '-'}` + (t ? `  tile ${t.tx},${t.tz} ${ctx.services.world.island.tileAt(t.tx, t.tz)}` : '');
      last = now; frames = 0;
    },
  };
}
