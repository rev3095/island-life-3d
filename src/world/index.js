// 트랙 T1: 섬 월드 — 지형 생성·그리기, 배경 물체, 충돌·높이. ctx.services.world 를 올린다 (docs/CONTRACTS.md).
import { generateIsland, createIslandApi, lotsOf, resolveLayout, KIND } from './island.js';
import { createKit } from './kit.js';
import { buildTerrain } from './terrain.js';
import { createObjects } from './objects.js';
import { createCollision } from './collision.js';
import { createDaily } from './daily.js';
import { createOcclusion } from './occlusion.js';
import { carveFestival } from './festival.js';
import { FURN_KIND, furnitureWorld } from './variants.js';
import { buildIslet } from './islets.js';
import { createBuilt } from './built.js';   // M14 섬 꾸미기 다리·경사로

let kit, terrain, objects, occlusion, stats = null, elapsed = 0;
let islet = null;          // P35 투어 섬 (buildIslet 결과) — 있으면 world.island·objects·places 의 칸 질문이 그 섬으로 간다

/** 계절 행사에만 놓는 배경 종류 (assets/events/events.json list[].assets.env) — 처음에 받지 않는다 */
async function eventKinds(assets) {
  const cfg = await assets.loadJSON('assets/events/events.json').catch(() => null);
  return new Set((cfg?.list ?? []).flatMap(ev => ev.assets?.env ?? []));
}
/** 9차 섬 꾸미기로 놓는 것 — 처음에 받지 않고 놓일 때(저장에 있으면 시작할 때) 받는다:
 *  길·울타리 (assets/decor/decor.json, 배경 모델) + 야외 가구 'fu:<가구 slug>' (아이템 outdoor: true, 가구 모델) */
async function decorKinds(assets, data) {
  const cfg = await assets.loadJSON('assets/decor/decor.json').catch(() => null);
  const env = [...(cfg?.paths ?? []), ...(cfg?.fences ?? []), ...(cfg?.builds ?? [])].map(d => d.kind).concat(cfg?.homes ?? []);   // M14 다리·경사로 · 커진 집 겉모양
  const furn = (data?.items?.list?.('furn') ?? []).filter(it => it.outdoor).map(it => FURN_KIND + it.id.slice(5));
  return [...env, ...furn];
}

/** M12 밤·새벽: 밤에만 놓는 것 (assets/night/night.json assets.env — 달빛 가게 · 새벽 천막 · 등불 줄 · 자는 중 쪽지) — 놓일 때 받는다 */
async function nightKinds(assets) {
  const cfg = await assets.loadJSON('assets/night/night.json').catch(() => null);
  return cfg?.assets?.env ?? [];
}

/** M13 매일 할 거리 (assets/daily/daily.json assets.env — 선물 풍선 · 유리병 · 행상 수레) — 놓일 때 받는다 */
async function dailyKinds(assets) {
  const cfg = await assets.loadJSON('assets/daily/daily.json').catch(() => null);
  return cfg?.assets?.env ?? [];
}

/** M18-P3 대회 무대 BD-17 (assets/contest/contest.json assets.env) — 처음에 받지 않고 대회 날 무대를 놓을 때 */
async function contestKinds(assets) {
  const cfg = await assets.loadJSON('assets/contest/contest.json').catch(() => null);
  return cfg?.assets?.env ?? [];
}

/** P35 무인도 투어 모델 (배·광석 바위, assets/tour/tour.json env) — 처음에 받지 않고 선착장에 배를 놓을 때·투어 섬을 세울 때 */
async function tourKinds(assets) {
  const cfg = await assets.loadJSON('assets/tour/tour.json').catch(() => null);
  return cfg?.env ?? [];
}

export default {
  name: 'world',

  async init(ctx) {
    const { THREE, constants, state, assets, events, scene } = ctx;
    const t0 = performance.now();
    // 특산 과일은 data 모듈(T2)이 시드로 정한다 → 과일나무 열매 색을 거기에 맞춘다 (item.variant = fruit-tree 변형 이름)
    const data = ctx.services.data;
    const fruitId = data?.economy?.nativeFruit?.();
    const nativeFruit = fruitId ? (data.items?.get?.(fruitId)?.variant ?? String(fruitId).split('.')[1]) : null;
    // 배경 모델을 한꺼번에 불러온다 (같은 모델은 assets 가 캐시). 건물 집터(world.lot)가 스펙에 있어서 섬 만들기보다 먼저.
    // 계절 행사 모델(events.json 의 assets.env)은 빼 두고 행사 때 놓일 때 받는다 — 게시본에서는 그 계절 묶음(packs/season-*)째로
    const index = await assets.loadEnvIndex();
    const lazy = await eventKinds(assets);
    for (const k of await decorKinds(assets, data)) lazy.add(k);
    for (const k of await nightKinds(assets)) lazy.add(k);
    for (const k of await tourKinds(assets)) lazy.add(k);
    for (const k of await dailyKinds(assets)) lazy.add(k);
    for (const k of await contestKinds(assets)) lazy.add(k);   // M18-P3 대회 무대
    const load = async slug => (slug.startsWith(FURN_KIND)
      ? { gltf: await assets.loadModel(`assets/furniture/models/${slug.slice(FURN_KIND.length)}`), spec: furnitureWorld(await assets.loadJSON(`assets/furniture/specs/${slug.slice(FURN_KIND.length)}.json`)) }
      : { gltf: await assets.loadEnv(slug), spec: await assets.loadEnvSpec(slug) });
    const models = Object.fromEntries(await Promise.all(index.models.filter(m => !lazy.has(m.slug)).map(async m => [m.slug, await load(m.slug)])));
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
    objects = createObjects(ctx, base, kit, models, collision, { lazy, loadKind: load });
    objects.populate(gen.objects);
    occlusion = createOcclusion(ctx, objects);

    // 구역(zone): 섬 밖에 따로 놓은 공간(집 실내 등)이 자기 바닥·벽을 쓰게 하는 갈고리.
    // zone = { contains(x, z), collide(fx, fz, nx, nz, r, y) → {x, z}, heightAt?(x, z), groundAt?(x, z), isWalkable?(x, z) }
    const zones = [];
    const zoneAt = (x, z) => zones.find(zn => zn.contains(x, z));
    // 칸 질문(tileAt·toTile …)은 투어 중이면 투어 섬이 받는다 (채집·낚시·곤충이 그 섬에서 그대로 돈다). 월드 좌표 질문은 자리로 고른다
    const cur = () => islet?.api ?? base;
    const at = (x, z) => (islet?.contains(x, z) ? islet.api : base);
    const island = {
      get w() { return cur().w; }, get h() { return cur().h; },
      tileAt: (tx, tz) => cur().tileAt(tx, tz), levelAt: (tx, tz) => cur().levelAt(tx, tz), isWater: (x, z) => at(x, z).isWater(x, z),
      heightAt: (x, z) => zoneAt(x, z)?.heightAt?.(x, z) ?? base.heightAt(x, z),
      toTile: (x, z) => cur().toTile(x, z), toWorld: (tx, tz) => cur().toWorld(tx, tz),
      /** 땅이 걸을 수 있고 물체 충돌체 안이 아니면 true */
      isWalkable(x, z) {
        const zn = zoneAt(x, z);
        if (zn) return zn.isWalkable ? zn.isWalkable(x, z) : true;
        const { tx, tz } = base.toTile(x, z);
        return base.isWalkableTile(tx, tz) && !collision.blockedAt(x, z, base.heightAt(x, z));
      },
      passable: (...a) => cur().passable(...a), rampAt: (tx, tz) => cur().rampAt(tx, tz), flagsAt: (tx, tz) => cur().flagsAt(tx, tz),
      isWalkableTile: (tx, tz) => cur().isWalkableTile(tx, tz),
      groundAt: (x, z) => {
        const zn = zoneAt(x, z);
        if (zn?.groundAt) return zn.groundAt(x, z);
        const t = base.toTile(x, z);
        return objects.api.groundAt(t.tx, t.tz) ?? base.groundAt(x, z);   // 9차 길 (돌·나무판 발소리)
      },
    };

    let season = null;
    function recolor(ter, objs) {
      const g = models['tile-grass'].spec;
      const pal = { ...g.palette, ...(g.variants?.[season]?.palette ?? {}) };
      ter.templates[KIND.GRASS].recolor(pal);
      ter.templates[KIND.CLIFF].recolor({ grass: pal.grass });
      ter.banks.setGrass(pal.grass);
      objs.setSeason(season);
    }
    function setSeason(s) {
      if (!s || s === season) return;
      season = s;
      recolor(terrain, objects);
      if (islet) recolor(islet.terrain, islet.objects);
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
        const k = base.tileAt(tx, tz);   // 본섬만 (투어 섬에 가 있어도 날마다 놓는 것은 본섬에)
        if (wantSand ? k !== 'sand' : k !== 'grass') continue;
        if (base.flagsAt(tx, tz) || objects.api.at(tx, tz)) continue;
        if (wantSand && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => base.tileAt(tx + a, tz + b) === 'sea')) continue;   // 조개는 물가 모래
        const { x, z } = base.toWorld(tx, tz);
        if (collision.blockedAt(x, z)) continue;
        out.push({ tx, tz, x, z, level: base.levelAt(tx, tz) });
      }
      return out;
    };
    // 날마다 조개·잡초·화석 자리 다시 놓기, 열매 다시 열기 (data:newday · game:ready 때)
    const daily = createDaily(ctx, { objects: objects.api, spawnTiles, nativeFruit: gen.nativeFruit });

    // 물체 api: 투어 중이면 투어 섬 물체 (나무 흔들기·꽃 꺾기·바위 치기가 그 섬 물체로)
    const objectsApi = new Proxy({}, { get: (_, k) => { const a = islet ? islet.objects.api : objects.api; const v = a[k]; return typeof v === 'function' ? v.bind(a) : v; } });
    const env = { models, lazy, load };
    let isletZone = null;
    ctx.services.world = {
      island, objects: objectsApi, setSeason, daily,
      get places() { return islet ? islet.gen.places : gen.places; },
      /** 본섬 물체·자리 (투어 중에도 본섬을 봐야 하는 곳) */
      home: { objects: objects.api, places: gen.places, island: base },
      /** P35 투어 섬: enter(gen, ox) → 세우고 들어가기 (칸 질문이 그 섬으로), leave() → 치우고 본섬으로. gen = gameplay/tour/islet.js */
      islet: {
        get active() { return !!islet; },
        get current() { return islet; },
        async enter(g, ox = 900) {
          this.leave();
          // 처음 받는 모델(투어 묶음)을 먼저 받는다
          const need = [...new Set(g.objects.map(o => o.kind))].filter(k => !models[k] && lazy.has(k));
          await Promise.all(need.map(async k => { models[k] = await load(k); }));
          const unknown = g.objects.filter(o => !models[o.kind]).map(o => o.kind);
          if (unknown.length) { console.warn('[world] 투어 섬: 모르는 물체 종류는 뺀다', [...new Set(unknown)]); g.objects = g.objects.filter(o => models[o.kind]); }
          islet = buildIslet(ctx, g, ox, env);
          if (season) recolor(islet.terrain, islet.objects);
          const it = islet;
          isletZone = this.zone = ctx.services.world.addZone({
            contains: (x, z) => it.contains(x, z),
            collide: (fx, fz, nx, nz, r, y) => it.collision.move(fx, fz, nx, nz, r, y),
            heightAt: (x, z) => it.api.heightAt(x, z),
            groundAt: (x, z) => { const t = it.api.toTile(x, z); return it.objects.api.groundAt(t.tx, t.tz) ?? it.api.groundAt(x, z); },
            isWalkable: (x, z) => { const t = it.api.toTile(x, z); return it.api.isWalkableTile(t.tx, t.tz) && !it.collision.blockedAt(x, z, it.api.heightAt(x, z)); },
          });
          events.emit('world:islet', { active: true, shape: g.shape, seed: g.seed });
          return islet;
        },
        leave() {
          if (!islet) return false;
          isletZone?.();
          isletZone = null;
          islet.dispose();
          islet = null;
          events.emit('world:islet', { active: false });
          return true;
        },
      },
      get season() { return season; },
      /** M14 놓는 다리·경사로: 본섬 칸 표를 바꾼다 (자리 고르기·놓기·치우기 — world/built.js, 저장은 decor) */
      build: createBuilt(gen),
      /** 원(반지름 r)을 (fx,fz) → (nx,nz) 로 옮긴다. 막히면 미끄러진 자리 {x, z} */
      collide: (fx, fz, nx, nz, r, y) => {
        const zn = zoneAt(fx, fz);
        return zn ? zn.collide(fx, fz, nx, nz, r, y) : collision.move(fx, fz, nx, nz, r, y);
      },
      /** 구역 등록 (집 실내 등). 돌려받은 함수를 부르면 해제된다 */
      addZone(zone) { zones.push(zone); return () => { const i = zones.indexOf(zone); if (i >= 0) zones.splice(i, 1); }; },
      /** 움직이는 충돌체 (주민·플레이어): m = { x, z, r, y?, active? } (getter 가능) → 해제 함수. 섬 위 collide 가 원으로 밀어낸다 (자기 자신은 빼고) */
      addMover: m => collision.addMover(m),
      setOutlineVisible(v) { terrain.setOutlineVisible(v); objects.setOutlineVisible(v); if (islet) { islet.terrain.setOutlineVisible(v); islet.objects.setOutlineVisible(v); } },
      /** 그리기 직전에 render 가 부른다: 배경 묶음마다 본 카메라·그림자 카메라에 걸리는 칸만 GPU 에 담기 (곡면 월드 반영) */
      prepareFrame: () => { kit.prepareFrame(); islet?.kit.prepareFrame(); },
      /** 부드러운 해안선에서 바다 쪽으로의 거리 (칸, 땅 안쪽 ≤ 0). 이 값이 coastWaterline 보다 작으면 모래 비탈 위라 물이 안 보인다 */
      coastDistance: (x, z) => (islet?.contains(x, z) ? islet.terrain : terrain).coast.field.at(x, z),
      coastWaterline: terrain.coast.waterline,
      /** 강물 칸이면 둥근 둑의 물가 선에서 물 쪽으로의 거리 (칸, 둑 위로 보이는 곳은 < 0), 강물 칸이 아니면 null.
       *  둑이 칸 경계보다 0.2칸쯤 물 쪽으로 나와 있다 → 낚시찌·물고기 그림자는 이 값 > 0.15 인 곳에 */
      riverDistance: (x, z) => (islet?.contains(x, z) ? islet.terrain : terrain).banks.riverDistance(x, z),
      /** 가림 투명: 카메라와 플레이어(·대화 상대) 사이 나무·건물·주민·가구를 비치게. watch(getPoint) → 해제 함수 로 보이게 할 점을 더한다.
       *  applyToonStyle 로 칠한 모델(root.userData.toonFade)은 저절로 대상, 그 밖의 것은 add({ box(out), setFade(v) }) → 해제 함수 */
      occlusion: {
        watch: fn => occlusion.watch(fn), add: item => occlusion.add(item),
        get enabled() { return occlusion.enabled; }, set enabled(v) { occlusion.enabled = v; }, list: () => occlusion.list(),
        get bottom() { return occlusion.bottom; }, set bottom(v) { occlusion.bottom = v; }, bottomPoint: () => occlusion.bottomPoint(),
      },
      get nativeFruit() { return islet ? islet.gen.nativeFruit : gen.nativeFruit; },
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
    if (islet) { islet.kit.uTime.value = elapsed; islet.terrain.update(dt, elapsed); islet.objects.update(dt); islet.kit.updateCulling(); }
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
