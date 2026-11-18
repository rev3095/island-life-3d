// M21-P3 구경 섬 만들기 — 친구 섬 사진(snap)으로 본섬과 같은 생성기를 돌려 world.islet.enter 에 넘길 gen 을 만든다 (순수, three·DOM 없음).
//  - 시드: 지도 layout.seed 가 있으면 그것 (그러면 모든 섬이 같은 지도), 없으면 snap.island.seed — 본섬 world/index.js 와 같은 규칙
//  - 축제 광장 깎기(열린 부스 없음) · 다리·경사로(snap.island.built → world/built.js) · 집 겉모양 단계(snap.house.stage → 커진 집 모델)
//  - 치운 것·놓은 것(removed·added)은 world/islets.js 가 가짜 island 칸으로 받는다 (저장 안 함) — 여기서는 돌려주기만
// 노트 docs/notes/m21-p3-visit.md.
import { generateIsland, lotsOf } from '../../world/island.js';
import { carveFestival } from '../../world/festival.js';
import { createBuilt } from '../../world/built.js';
import { shiftAdded } from './trip.js';

/**
 * @param {object} snap 섬 사진 (visit/rules.js snapshot 모양, v 는 미리 visitable 로 본다)
 * @param {object} o
 *   constants = { ISLAND, VILLAGERS } · layout = resolveLayout 결과 · specs = { slug: 배경 스펙 } (집터 lots·축제 광장)
 *   festival = assets/festival/config.json | null · nativeFruit = 특산 과일 변형 이름 | null
 *   builds = decor.json builds ([{ kind, type }]) · exterior(stage) → 집 겉모양 종류 · ox = 월드 x 자리
 * @returns {{ gen, island: { removed, added }, houseKind, built: number }}
 */
export function planVisitIsland(snap, { constants = {}, layout = null, specs = {}, festival = null, nativeFruit = null, builds = [], exterior = () => 'house-player', ox = 1300 } = {}) {
  const isl = snap?.island ?? {};
  const seed = layout?.seed ?? Number(isl.seed);
  const gen = generateIsland(seed, { ...(constants.ISLAND ?? {}), ...(constants.VILLAGERS ? { villagers: constants.VILLAGERS } : {}), nativeFruit, layout, lots: lotsOf(specs) });
  if (festival) {
    try { carveFestival(gen, { opened: new Set(), config: festival, specs }); } catch (e) { console.warn('[visit] 구경 섬 축제 광장', e); }
  }
  // 다리·경사로: 본섬 decor 와 같은 자리 검사 → 칸 표를 바꾸고 모델 물체를 생성기 물체로 더한다
  const B = createBuilt(gen);
  let built = 0;
  for (const rec of Array.isArray(isl.built) ? isl.built : []) {
    const kind = builds.find(b => b.type === rec?.type)?.kind;
    if (!kind) continue;
    const s = rec.type === 'bridge' ? B.bridgeSpot(rec.tx, rec.tz, rec.axis === 'x' ? [1, 0] : [0, 1]) : B.rampSpot(rec.tx, rec.tz);
    if (!s.ok || s.cells[0].tx !== rec.tx || s.cells[0].tz !== rec.tz || (rec.type === 'bridge' && s.axis !== rec.axis)) continue;
    if (rec.type === 'bridge') B.addBridge(s); else B.addRamp(s);
    gen.objects.push({ id: `visit:built-${rec.type}@${rec.tx},${rec.tz}`, kind, tx: rec.tx, tz: rec.tz, x: s.x, z: s.z, y: s.y, rot: s.rot ?? 0, scale: 1, variant: null, data: {} });
    built++;
  }
  // 집 겉모양 단계: 처음 집(house-player) 물체를 그 단계 모델로 바꿔 끼운다
  const houseKind = exterior(Number(snap?.house?.stage) || 0) ?? 'house-player';
  if (houseKind !== 'house-player') {
    const h = gen.objects.find(o => o.kind === 'house-player');
    if (h) h.kind = houseKind;
  }
  const removed = (Array.isArray(isl.removed) ? isl.removed : []).filter(id => typeof id === 'string');
  return { gen, island: { removed, added: shiftAdded(isl.added, ox) }, houseKind, built };
}

/** 주민이 설 자리: 자기 집 문 앞(남쪽 1.1칸, 남쪽을 봄), 집이 없으면 광장 둘레 — 구경 섬 칸 기준(ox 더하기 전) */
export function villagerSpots(gen, slugs) {
  const houses = gen.places?.villagerHouses ?? [];
  const plaza = gen.places?.plaza ?? { x: 0, z: 0 };
  let ring = 0;
  return slugs.map(slug => {
    const hs = houses.find(h => h.slug === slug && h.door && !h.lot);
    if (hs) return { slug, x: hs.door.x, z: hs.door.z + 1.1, facing: Math.PI };
    const a = (ring++ / 6) * Math.PI * 2;
    return { slug, x: plaza.x + Math.cos(a) * 2.6, z: plaza.z + Math.sin(a) * 2.6, facing: Math.atan2(Math.cos(a), Math.sin(a)) };   // 광장 가운데를 본다
  });
}
