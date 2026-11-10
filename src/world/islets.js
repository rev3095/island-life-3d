// 투어 섬 (P35 무인도 투어, 보드 tour D126-A): 본섬과 같은 지형·물체·충돌 코드로 작은 섬 하나를 본섬에서 멀리(x = ox) 세운다.
// 섬 모양(gen)은 gameplay/tour/islet.js 가 만들고, 여기서는 그리기·충돌·물체만. 저장은 하지 않는다 (물체 변경은 이 섬 안의 가짜 칸에만).
// 칸마다 화면 밖 판정(prepareFrame)이 그대로 걸린다 — 본섬에 있으면 투어 섬이, 투어 섬에 있으면 본섬이 화면 밖이라 그리지 않는다.
import { createIslandApi } from './island.js';
import { buildTerrain } from './terrain.js';
import { createObjects } from './objects.js';
import { createCollision } from './collision.js';
import { createKit } from './kit.js';

/** 칸 좌표는 그 섬 그대로, 월드 좌표만 x 를 ox 만큼 옮긴 섬 api */
export function shiftIsland(local, ox) {
  return {
    ...local,
    toTile: (x, z) => local.toTile(x - ox, z),
    toWorld: (tx, tz) => { const p = local.toWorld(tx, tz); return { x: p.x + ox, z: p.z }; },
    heightAt: (x, z) => local.heightAt(x - ox, z),
    isWater: (x, z) => local.isWater(x - ox, z),
    groundAt: (x, z) => local.groundAt(x - ox, z),
  };
}

/**
 * 투어 섬 세우기 → { gen, api, collision, terrain, objects, contains(x, z), dispose() }
 * gen: gameplay/tour/islet.js generateIslet 결과 (칸·물체 자리는 그 섬 가운데 기준). ox: 월드 x 자리.
 * env = { kit, models, lazy, load } (world/index.js 의 것을 그대로)
 */
export function buildIslet(ctx, gen, ox, { models, lazy, load }) {
  // 따로 kit: 땅 재질의 풀·모래 섞기 텍스처(banks)가 재질마다 하나라 본섬과 나눠 쓰면 안 된다. 화면 밖 판정은 world.prepareFrame 이 둘 다 부른다
  const kit = createKit(ctx);
  gen.ox = ox;
  const local = createIslandApi(gen);
  const api = shiftIsland(local, ox);
  const collision = createCollision(api);
  const terrain = buildTerrain(ctx, gen, api, kit, models);
  // 물체 변경은 저장하지 않는다: 이 섬만의 island 칸 (없앤 것·놓은 것·변형)
  const ictx = Object.create(ctx);
  ictx.state = { ...ctx.state, island: { removed: [], added: [], variants: {}, fruit: {} } };
  const objects = createObjects(ictx, api, kit, models, collision, { lazy, loadKind: load });
  objects.populate(gen.objects.map(o => ({ ...o, x: o.x + ox })));
  const half = Math.max(gen.w, gen.h) / 2 + 60;
  return {
    gen, api, collision, terrain, objects, ox, kit,
    /** 이 섬 둘레(바다 포함)인가 */
    contains: (x, z) => Math.abs(x - ox) < half && Math.abs(z) < half,
    dispose() {
      for (const b of [...kit.batches]) { kit.batches.delete(b); for (const m of b.meshes) b.parent.remove(m); }
      ctx.scene.remove(terrain.group);
      objects.group?.parent?.remove(objects.group);
      terrain.group.traverse(o => { o.geometry?.dispose?.(); });
    },
  };
}
