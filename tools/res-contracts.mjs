// 리소스 교체 약속 검사 (p36 리소스 편집기). docs/CONTRACTS.md 끝 「리소스 교체 약속」 과 tests/assets.test.mjs · items-assets.test.mjs 가
// 보는 것을 요소 하나 단위로 — 같은 함수를 세 곳이 쓴다:
//   1) tools/build-editor-index.mjs: 지금 들어 있는 모델마다 미리 검사해 편집기 목록(assets/res/editor-index.json)에 결과를 적는다
//   2) res-editor.html: 사용자가 고른 바꿀 파일(.glb)을 브라우저에서 풀어 바로 검사한다 (게시본에는 src/ 가 없어서 import 없는 순수 함수)
//   3) tests/res-editor.test.mjs: 지금 리소스는 모두 통과하고, 일부러 깬 후보는 걸리는지
// 결과 줄: { id, label, state: 'ok'|'fail'|'warn'|'skip', detail } — fail 은 게임 테스트가 실패하는 것, warn 은 테스트는 통과하지만 손볼 것.

export const FIXED_MATERIALS = ['eyeHighlight'];                    // 빌더가 늘 붙이는 고정 재질 (팔레트 밖이어도 됨)
export const CLIPS = ['idle', 'walk', 'run', 'happy'];               // player/index.js · town/actor.js · gather/results.js
export const SIT_CLIPS = ['sit_down', 'sit', 'stand_up'];            // 10차 AN-11 (없으면 앉지 않고 서기만)
export const BONES = ['arm.L', 'arm.R', 'spine', 'head'];            // player/motions.js
// 삼각형 예산 (docs/notes/local-resources.md 1절 — 지금 가장 큰 것 근처, Intel UHD 기준). 넘으면 warn
export const BUDGET = { character: 12500, env: 8000, furniture: 8000, fixture: 8000, item: 6000 };
// 코드가 이름으로 찾는 재질 (world/objects.js PICKED · terrain.js)
export const NAMED_MATERIALS = { 'fruit-tree': ['fruit'], palm: ['coconut'], 'tile-grass': ['grass', 'dirt'], 'tile-sand': ['sand'], 'tile-path': ['path'], 'tile-plaza': ['stone'] };
export const NAMED_NODES = { 'wall-clock': ['hourHand', 'minuteHand'] };   // house/furniture.js 벽시계 바늘
export const LABEL = {
  index: '목록 = 스펙 (id·version·status)', status: '상태 (review · approved)', palette: '팔레트 색 #RRGGBB', materials: '재질 이름 = 팔레트 키',
  named: '코드가 이름으로 찾는 재질·노드', clips: '동작 idle·walk·run·happy', sit: '앉기 동작 (AN-11)', bones: '뼈 arm.L·arm.R·spine·head', skin: '뼈대(skin) 하나',
  height: '키 ≈ 1.0 (캐릭터)', collider: '충돌 world.collider ↔ 모델 크기', lot: '집터 world.lot ↔ 건물 크기', footprint: '칸 footprint ↔ 모델 크기',
  item: '가구 표(items.js) 놓는 곳·칸 수', budget: '삼각형 예산', pattern: '무늬 한 칸 크기 pattern.size',
};

const HEX = /^#[0-9A-Fa-f]{6}$/;
const row = (id, state, detail = '') => ({ id, label: LABEL[id], state, detail });
const f2 = n => (Math.round(n * 100) / 100).toString();

/** .glb 바이트(Uint8Array) → 이름 정보. 브라우저·node 둘 다 (TextDecoder) */
export function glbInfo(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('glb 파일이 아니에요 (머리 글자 glTF 가 없어요)');
  const len = dv.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  return infoOf(gltf);
}
/** glTF JSON → { materials, nodes, clips, skins, triangles? } */
export function infoOf(gltf) {
  let triangles = 0;
  for (const m of gltf.meshes ?? []) for (const p of m.primitives ?? []) {
    const acc = gltf.accessors?.[p.indices ?? p.attributes?.POSITION];
    if (acc && (p.mode ?? 4) === 4) triangles += Math.floor(acc.count / 3);
  }
  return {
    materials: (gltf.materials ?? []).map(m => m.name ?? ''),
    nodes: (gltf.nodes ?? []).map(n => n.name ?? ''),
    clips: (gltf.animations ?? []).map(a => a.name ?? ''),
    skins: gltf.skins?.length ?? 0,
    triangles,
  };
}

/** 스펙 팔레트 키 (+ 변형 팔레트) */
export function paletteKeys(spec) {
  return new Set([...Object.keys(spec?.palette ?? {}), ...Object.values(spec?.variants ?? {}).flatMap(v => Object.keys(v?.palette ?? {}))]);
}

/**
 * 요소 하나 검사.
 * area: character | env | furniture | fixture | item | pattern
 * spec: 스펙 JSON, row: 목록(index.json) 줄 (없으면 건너뜀)
 * stats: { size: [가로 X, 깊이 Y, 높이 Z] (Blender 축, m), triangles, height? } — 바꿀 파일은 편집기가 three.js Box3 로 잰 값
 * info: glbInfo/infoOf 결과 (없으면 모델 검사는 skip)
 * extra: { item: items.js 의 가구 줄 { place, size } } (가구만, 없으면 skip)
 */
export function checkResource({ area, spec, row: r, stats, info, extra = {} }) {
  const out = [];
  if (!spec) return [row('index', 'fail', '스펙이 없어요')];
  // 목록 = 스펙
  if (r) {
    const bad = ['id', 'version'].filter(k => r[k] !== spec[k]);
    if ((spec.status ?? 'review') !== r.status) bad.push('status');
    out.push(row('index', bad.length ? 'fail' : 'ok', bad.length ? `${bad.join('·')} 이 목록과 달라요 → node tools/build-*.mjs --index` : `${spec.id} v${spec.version}`));
  }
  out.push(row('status', ['review', 'approved'].includes(spec.status ?? 'review') ? 'ok' : 'fail', spec.status ?? 'review'));
  const pal = Object.entries(spec.palette ?? {});
  const badHex = pal.filter(([, v]) => !HEX.test(v ?? '')).map(([k]) => k);
  out.push(row('palette', badHex.length ? 'fail' : 'ok', badHex.length ? `색 글자가 이상해요: ${badHex.join(', ')}` : `색 ${pal.length}개`));

  if (area === 'pattern') {
    const s = spec.pattern?.size;
    const ok = Array.isArray(s) && s.length === 2 && s.every(n => n > 0 && n < 10) && Array.isArray(spec.pattern?.tile);
    out.push(row('pattern', ok ? 'ok' : 'fail', ok ? `${s[0]}×${s[1]}m` : 'pattern.size·tile 이 없거나 이상해요'));
    return out;
  }

  // 재질 이름 = 팔레트 키
  if (info) {
    const keys = paletteKeys(spec);
    const extraMats = [...new Set(info.materials)].filter(m => !keys.has(m) && !FIXED_MATERIALS.includes(m));
    out.push(row('materials', !info.materials.length ? 'fail' : extraMats.length ? 'fail' : 'ok',
      !info.materials.length ? '재질이 없어요' : extraMats.length ? `팔레트에 없는 재질: ${extraMats.join(', ')} → 재질 이름을 팔레트 키로` : `재질 ${new Set(info.materials).size}개 모두 팔레트 키`));
    const named = [...(NAMED_MATERIALS[spec.slug] ?? []).map(n => ['재질', n, info.materials.includes(n)]), ...(NAMED_NODES[spec.slug] ?? []).map(n => ['노드', n, info.nodes.includes(n)])];
    if (named.length) {
      const miss = named.filter(x => !x[2]);
      out.push(row('named', miss.length ? 'fail' : 'ok', miss.length ? `없음: ${miss.map(x => `${x[0]} ${x[1]}`).join(', ')}` : named.map(x => x[1]).join(', ')));
    }
  } else out.push(row('materials', 'skip', '모델 정보 없음'));

  const size = stats?.size;
  if (area === 'character') {
    if (info) {
      const clips = new Set(info.clips), nodes = new Set(info.nodes);
      const missC = CLIPS.filter(c => !clips.has(c)), missB = BONES.filter(b => !nodes.has(b) && !nodes.has(b.replace('.', '')));
      out.push(row('clips', missC.length ? 'fail' : 'ok', missC.length ? `없는 동작: ${missC.join(', ')}` : `동작 ${clips.size}개`));
      const wantsSit = (spec.animations ?? []).some(a => SIT_CLIPS.includes(a));
      const missS = SIT_CLIPS.filter(c => !clips.has(c));
      out.push(row('sit', !wantsSit ? 'skip' : missS.length ? 'warn' : 'ok', !wantsSit ? '스펙에 앉기 없음' : missS.length ? `없는 동작: ${missS.join(', ')} (앉지 않고 서기만)` : 'sit_down·sit·stand_up'));
      out.push(row('bones', missB.length ? 'fail' : 'ok', missB.length ? `없는 뼈: ${missB.join(', ')}` : BONES.join(' · ')));
      out.push(row('skin', info.skins === 1 ? 'ok' : 'fail', `뼈대 ${info.skins}개`));
    }
    if (size) {
      const h = size[2];
      out.push(row('height', h >= 0.6 && h <= 1.4 ? 'ok' : 'warn', `높이 ${f2(h)} (타일 1칸 = 1.0)`));
    }
  }

  if (area === 'env') {
    const c = spec.world?.collider;
    if (!c) out.push(row('collider', 'skip', '충돌 없음 (지나갈 수 있는 것)'));
    else if (!size) out.push(row('collider', 'skip', '모델 크기 모름'));
    else {
      const [sx, sy] = size, probs = [];
      const boxes = [...(c.box ? [[-c.box[0] / 2, -c.box[1] / 2, c.box[0] / 2, c.box[1] / 2]] : []), ...(c.boxes ?? [])];
      let detail = '';
      if (boxes.length && spec.slug !== 'dock') {
        const bw = Math.max(...boxes.map(b => b[2])) - Math.min(...boxes.map(b => b[0]));
        const bd = Math.max(...boxes.map(b => b[3])) - Math.min(...boxes.map(b => b[1]));
        if (!(bw >= sx * 0.88 && bw <= sx + 0.1)) probs.push(`충돌 가로 ${f2(bw)} ↔ 모델 ${f2(sx)} (88%~+0.1 이어야)`);
        if (!(bd <= sy + 0.1)) probs.push(`충돌 깊이 ${f2(bd)} > 모델 ${f2(sy)}`);
        detail = `상자 ${f2(bw)}×${f2(bd)} ↔ 모델 ${f2(sx)}×${f2(sy)}`;
      }
      if (c.r) {
        if (!(c.r * 2 <= Math.max(sx, sy) + 0.1)) probs.push(`충돌 원 지름 ${f2(c.r * 2)} > 모델 ${f2(Math.max(sx, sy))}`);
        detail = detail || `원 r ${c.r} ↔ 모델 ${f2(sx)}×${f2(sy)}`;
      }
      out.push(row('collider', probs.length ? 'fail' : 'ok', probs.length ? `${probs.join(' · ')} → 같은 스펙의 world.collider 를 맞춰요` : detail || '모양 충돌'));
    }
    const lot = spec.world?.lot;
    if (lot && size) {
      const ok = lot[0] >= size[0] && lot[1] >= size[1];
      out.push(row('lot', ok ? 'ok' : 'fail', ok ? `집터 ${lot.join('×')} 안 (모델 ${f2(size[0])}×${f2(size[1])})` : `모델 ${f2(size[0])}×${f2(size[1])} 이 집터 ${lot.join('×')} 보다 커요 → world.lot`));
    }
  }

  if (area === 'furniture' || area === 'fixture') {
    const fp = spec.footprint;
    if (spec.place === 'floor' && fp && size) {
      const ok = size[0] <= fp[0] + 0.05 && size[1] <= fp[1] + 0.05;
      out.push(row('footprint', ok ? 'ok' : 'fail', ok ? `모델 ${f2(size[0])}×${f2(size[1])} ≤ ${fp.join('×')}칸` : `모델 ${f2(size[0])}×${f2(size[1])} 이 칸 ${fp.join('×')} 보다 커요 → footprint 와 items.js 칸 글자`));
    } else out.push(row('footprint', 'skip', spec.place && spec.place !== 'floor' ? `${spec.place === 'wall' ? '벽' : spec.place} 가구 (칸 대신 벽에)` : '칸 없음'));
    if (area === 'furniture' && extra.item) {
      const bad = [];
      if (extra.item.place !== spec.place) bad.push(`놓는 곳 ${extra.item.place} ↔ ${spec.place}`);
      if (spec.place === 'floor' && JSON.stringify(extra.item.size) !== JSON.stringify(fp)) bad.push(`칸 ${JSON.stringify(extra.item.size)} ↔ ${JSON.stringify(fp)}`);
      out.push(row('item', bad.length ? 'fail' : 'ok', bad.length ? `${bad.join(' · ')} → src/data/items.js 도 같이` : `${extra.item.id ?? spec.item}`));
    }
  }

  const tri = stats?.triangles ?? info?.triangles;
  const budget = BUDGET[area];
  if (budget && tri) out.push(row('budget', tri <= budget ? 'ok' : 'warn', `삼각형 ${tri.toLocaleString('en-US')} / ${budget.toLocaleString('en-US')}`));
  return out;
}

/** 결과 줄 → { fail, warn, ok } 개수 */
export function summary(rows) {
  const n = { ok: 0, fail: 0, warn: 0, skip: 0 };
  for (const r of rows ?? []) n[r.state] = (n[r.state] ?? 0) + 1;
  return n;
}
