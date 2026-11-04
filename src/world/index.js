// 트랙 T1: 섬 월드 — 지형 생성·그리기, 배경 물체, 충돌·높이. ctx.services.world 를 올린다 (docs/CONTRACTS.md).
import { generateIsland, createIslandApi, lotsOf, resolveLayout, KIND } from './island.js';
import { createKit } from './kit.js';
import { buildTerrain } from './terrain.js';
import { createObjects } from './objects.js';
import { createCollision } from './collision.js';
import { createDaily } from './daily.js';
import { createOcclusion } from './occlusion.js';
import { carveFestival } from './festival.js';

let kit, terrain, objects, occlusion, stats = null, elapsed = 0;

export default {
  name: 'world',

  async init(ctx) {
    const { THREE, constants, state, assets, events, scene } = ctx;
    const t0 = performance.now();
    // 특산 과일은 data 모듈(T2)이 시드로 정한다 → 과일나무 열매 색을 거기에 맞춘다 (item.variant = fruit-tree 변형 이름)
    const data = ctx.services.data;
    const fruitId = data?.economy?.nativeFruit?.();
    const nativeFruit = fruitId ? (data.items?.get?.(fruitId)?.variant ?? String(fruitId).split('.')[1]) : null;
    // 배경 모델 32종을 한꺼번에 불러온다 (같은 모델은 assets 가 캐시). 건물 집터(world.lot)가 스펙에 있어서 섬 만들기보다 먼저
    const index = await assets.loadEnvIndex();
    const models = Object.fromEntries(await Promise.all(index.models.map(async m =>
      [m.slug, { gltf: await assets.loadEnv(m.slug), spec: await assets.loadEnvSpec(m.slug) }])));
    // 지도 자리·시드·밀도 (섬 지도 편집기 → "지도 반영"). 없으면 island.js 기본값 = 지금 섬. layout.seed 가 null 이면 저장의 섬 시드
    const layout = resolveLayout(await assets.loadJSON('assets/island/layout.json').catch(e => (console.warn('[world] layout.json 없음 — 기본 지도', e), null)));
    const gen = generateIsland(layout.seed ?? state.island.seed, { ...constants.ISLAND, villagers: constants.VILLAGERS, nativeFruit, layout,
      lots: lotsOf(Object.fromEntries(Object.entries(models).map(([k, v]) => [k, v.spec]))) });
    // 5차 Z5 축제 광장: 지금 광장을 넓혀 무대·부스 자리·등불을 깐다 (열린 부스 = state.festival.booths 의 열쇠, 자리 = 축제 설정 plaza 칸)
    const festivalConfig = await fetch('assets/festival/config.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (festivalConfig) carveFestival(gen, { opened: new Set(Object.keys(state.festival?.booths ?? {})), config: festivalConfig, specs: Object.fromEntries(Object.entries(models).map(([k, v]) => [k, v.spec])) });
    const base = createIslandApi(gen);

    kit = createKit(ctx);
    const collision = createCollision(base);
    terrain = buildTerrain(ctx, gen, base, kit, models);
    objects = createObjects(ctx, base, kit, models, collision);
    objects.populate(gen.objects);
    occlusion = createOcclusion(ctx, objects);

    // 구역(zone): 섬 밖에 따로 놓은 공간(집 실내 등)이 자기 바닥·벽을 쓰게 하는 갈고리.
    // zone = { contains(x, z), collide(fx, fz, nx, nz, r, y) → {x, z}, heightAt?(x, z), groundAt?(x, z), isWalkable?(x, z) }
    const zones = [];
    const zoneAt = (x, z) => zones.find(zn => zn.contains(x, z));
    const island = {
      w: base.w, h: base.h,
      tileAt: base.tileAt, levelAt: base.levelAt, isWater: base.isWater,
      heightAt: (x, z) => zoneAt(x, z)?.heightAt?.(x, z) ?? base.heightAt(x, z),
      toTile: base.toTile, toWorld: base.toWorld,
      /** 땅이 걸을 수 있고 물체 충돌체 안이 아니면 true */
      isWalkable(x, z) {
        const zn = zoneAt(x, z);
        if (zn) return zn.isWalkable ? zn.isWalkable(x, z) : true;
        const { tx, tz } = base.toTile(x, z);
        return base.isWalkableTile(tx, tz) && !collision.blockedAt(x, z, base.heightAt(x, z));
      },
      passable: base.passable, rampAt: base.rampAt, flagsAt: base.flagsAt,
      groundAt: (x, z) => zoneAt(x, z)?.groundAt?.(x, z) ?? base.groundAt(x, z),
    };

    let season = null;
    function setSeason(s) {
      if (!s || s === season) return;
      season = s;
      const g = models['tile-grass'].spec;
      const pal = { ...g.palette, ...(g.variants?.[s]?.palette ?? {}) };
      terrain.templates[KIND.GRASS].recolor(pal);
      terrain.templates[KIND.CLIFF].recolor({ grass: pal.grass });
      terrain.banks.setGrass(pal.grass);
      objects.setSeason(s);
      events.emit('world:season', { season: s });
    }
    const month = ctx.services.time?.now?.().month ?? new Date().getMonth() + 1;
    setSeason(ctx.services.time?.now?.().season ?? constants.seasonOf(month));
    events.on('time:newday', () => { const t = ctx.services.time?.now?.(); if (t) setSeason(t.season ?? constants.seasonOf(t.month)); });

    // sky 모듈이 없을 때만 기본 안개 (먼 바다가 하늘색에 녹아들게)
    if (!scene.fog && !ctx.services.time) scene.fog = new THREE.Fog(scene.background?.getHex?.() ?? 0xbfe6f7, 48, 130);

    const spawnTiles = kind => {
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
    };
    // 날마다 조개·잡초·화석 자리 다시 놓기, 열매 다시 열기 (data:newday · game:ready 때)
    const daily = createDaily(ctx, { objects: objects.api, spawnTiles, nativeFruit: gen.nativeFruit });

    ctx.services.world = {
      island, places: gen.places, objects: objects.api, setSeason, daily,
      get season() { return season; },
      /** 원(반지름 r)을 (fx,fz) → (nx,nz) 로 옮긴다. 막히면 미끄러진 자리 {x, z} */
      collide: (fx, fz, nx, nz, r, y) => {
        const zn = zoneAt(fx, fz);
        return zn ? zn.collide(fx, fz, nx, nz, r, y) : collision.move(fx, fz, nx, nz, r, y);
      },
      /** 구역 등록 (집 실내 등). 돌려받은 함수를 부르면 해제된다 */
      addZone(zone) { zones.push(zone); return () => { const i = zones.indexOf(zone); if (i >= 0) zones.splice(i, 1); }; },
      /** 움직이는 충돌체 (주민·플레이어): m = { x, z, r, y?, active? } (getter 가능) → 해제 함수. 섬 위 collide 가 원으로 밀어낸다 (자기 자신은 빼고) */
      addMover: m => collision.addMover(m),
      setOutlineVisible(v) { terrain.setOutlineVisible(v); objects.setOutlineVisible(v); },
      /** 그리기 직전에 render 가 부른다: 배경 묶음마다 본 카메라·그림자 카메라에 걸리는 칸만 GPU 에 담기 (곡면 월드 반영) */
      prepareFrame: () => kit.prepareFrame(),
      /** 부드러운 해안선에서 바다 쪽으로의 거리 (칸, 땅 안쪽 ≤ 0). 이 값이 coastWaterline 보다 작으면 모래 비탈 위라 물이 안 보인다 */
      coastDistance: (x, z) => terrain.coast.field.at(x, z),
      coastWaterline: terrain.coast.waterline,
      /** 강물 칸이면 둥근 둑의 물가 선에서 물 쪽으로의 거리 (칸, 둑 위로 보이는 곳은 < 0), 강물 칸이 아니면 null.
       *  둑이 칸 경계보다 0.2칸쯤 물 쪽으로 나와 있다 → 낚시찌·물고기 그림자는 이 값 > 0.15 인 곳에 */
      riverDistance: (x, z) => terrain.banks.riverDistance(x, z),
      /** 가림 투명: 카메라와 플레이어(·대화 상대) 사이 나무·건물·주민·가구를 비치게. watch(getPoint) → 해제 함수 로 보이게 할 점을 더한다.
       *  applyToonStyle 로 칠한 모델(root.userData.toonFade)은 저절로 대상, 그 밖의 것은 add({ box(out), setFade(v) }) → 해제 함수 */
      occlusion: {
        watch: fn => occlusion.watch(fn), add: item => occlusion.add(item),
        get enabled() { return occlusion.enabled; }, set enabled(v) { occlusion.enabled = v; }, list: () => occlusion.list(),
        get bottom() { return occlusion.bottom; }, set bottom(v) { occlusion.bottom = v; }, bottomPoint: () => occlusion.bottomPoint(),
      },
      nativeFruit: gen.nativeFruit,
      /** 배경 스펙 팔레트 + 변형 (+ 계절이 있는 종류는 지금 계절) → { 재질 이름: 색 } (부스러기·잎 색 맞추기) */
      palette(kind, variant = null) {
        const spec = models[kind]?.spec;
        if (!spec) return {};
        const v = variant ?? (kind === 'tree' ? season : kind === 'cedar' ? (season === 'winter' ? 'snow' : 'green') : null);
        return { ...spec.palette, ...(spec.variants?.[v]?.palette ?? {}) };
      },
      /** 날마다 새로 놓는 것(조개·잡초·화석 자리·꽃)의 후보 칸. data.day.pickSpots(후보, n, 'fossil') 에 바로 넣으면 된다 */
      spawnTiles,
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
    occlusion.update(dt);
    kit.updateCulling();
    stats?.update(dt);
  },
};

/** ?debug 일 때 왼쪽 위에 fps·그리기 호출·삼각형 수 */
function createStats(ctx) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:8px;bottom:8px;padding:4px 8px;border-radius:8px;background:rgba(74,59,50,.75);color:#FFF8E6;font:12px/1.4 monospace;pointer-events:none;white-space:pre';
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
