// 박물관 관 규칙 (요청 9 재단장·증축 — three·DOM 없음 → node 로도 돈다, tests/museum-hall.test.mjs). 짓기·그리기는 museum-hall.js.
//  - 로비 = 예전 박물관 실내 RM-09 (assets/interior/places/museum.json, version 3): 안내대·느루 + 벽마다 관 입구(아치) halls[].
//  - 관 여섯 = assets/interior/halls/<hall>.json (RM-25–30). 방 모양은 상점·박물관 배치(placedata.js 맨 위)와 같고, 더해서
//      hall 관 이름(fish|bug|fossil|sea|art|star) · cats 전시할 아이템 분류 · racks 전시 자리 · intro 안내판 글
//      racks[] = { cat, kind: 'line'|'spots'|'frames', filter?, ... }
//        line   : 수조·유리 상자 안 한 줄 { x0, x1, z0, z1, levels } — 긴 쪽(axis 자동)을 따라 층을 번갈아 고르게 (caseSlots 와 같은 모양)
//        spots  : 받침·진열장 윗면 [[lx, lz, y], …] — 하나에 하나
//        frames : 이 방의 FU-87 그림 액자(벽 가구) 순서대로 — 액자 캔버스 앞 (y = FRAME_Y)
//        filter : 'painting' | 'sculpture' (미술품 artKind) — 없으면 그 분류 모두
//  - 별자리관(star)은 아이템 대신 별자리 18개(IC-ST-01–18)를 frames 에 건다 (gameplay/stars 가 찍은 그림).
//  - 자리는 아이템 표 순서로 정해서 늘 같다. 아이템이 자리보다 많으면 line 줄이 더 촘촘해진다 (분류가 늘어도 넘치지 않게).
//  - 분류에 아이템이 하나도 없으면(다른 트랙이 아직 sea·art 를 안 넣음) 그 관은 「곧 열려요」 — 들어가 볼 수는 있고 빈 수조·액자만.

export const HALL_FILES = [
  'assets/interior/halls/fish.json', 'assets/interior/halls/bug.json', 'assets/interior/halls/fossil.json',
  'assets/interior/halls/sea.json', 'assets/interior/halls/art.json', 'assets/interior/halls/star.json',
];
export const HALLS = ['fish', 'bug', 'fossil', 'sea', 'art', 'star'];
export const HALL_NAME = { fish: '물고기관', bug: '곤충관', fossil: '화석관', sea: '바다 생물관', art: '미술관', star: '별자리관' };
export const HALL_ICON = { fish: '🐟', bug: '🦋', fossil: '🦴', sea: '🐙', art: '🖼️', star: '🔭' };
/** 관 방 가운데 (월드). 로비 RM-09 은 x 620 · z 0 (room.js PLACE_ROOMS.museum). 관은 같은 x 줄 북쪽으로 30칸씩 (다른 실내 x 500–700 · 투어 x 800+ 와 안 겹침) */
export const hallOrigin = i => ({ x: 620, z: 40 + i * 30 });
/** 그림 액자(FU-87) 캔버스 가운데 높이 · 벽에서 나온 거리 */
export const FRAME_Y = 1.5, FRAME_OUT = 0.1;   // 액자 캔버스 앞면 = 벽 0.012 + 0.064
/** 아치 입구: 폭 · 높이 · 벽에서 들어가기 판정 거리 */
export const ARCH = { w: 1.3, h: 2.15, reach: 0.95 };
/** 안내판: 아치 옆 (벽을 따라) 거리 */
export const SIGN_OFF = 1.15;

/** 아치·안내판의 방 기준 자리. wall n|w|e, at = 벽을 따라 칸 좌표 → { lx, lz, nx, nz (방 안쪽 방향) } */
export function wallPoint(wall, at, [w], out = 0) {
  if (wall === 'n') return { lx: at, lz: out, nx: 0, nz: 1 };
  if (wall === 'w') return { lx: out, lz: at, nx: 1, nz: 0 };
  return { lx: w - out, lz: at, nx: -1, nz: 0 };
}

/** 로비 halls[] → 아치마다 { hall, wall, at, door: 아치 앞(들어가기 자리), sign: 안내판 앞, signAt: 안내판 벽 자리 } (방 기준) */
export function archesOf(lobby) {
  const size = lobby?.size ?? [8, 8];
  return (lobby?.halls ?? []).map(a => {
    const dir = a.signSide ?? 1;
    return {
      ...a,
      door: wallPoint(a.wall, a.at, size, 0.55),
      sign: wallPoint(a.wall, a.at + dir * SIGN_OFF, size, 0.55),
      signAt: a.at + dir * SIGN_OFF,
    };
  });
}

/** 줄(line) 안 자리 n 개 → [{ lx, lz, y }] — 긴 쪽을 따라 줄을 세우고 층을 번갈아, 층마다 조금 안팎으로 비킨다 */
export function lineSlots(r, n) {
  if (n <= 0) return [];
  const levels = r.levels?.length ? r.levels : [0.8];
  const alongX = (r.x1 - r.x0) >= (r.z1 - r.z0);
  const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
  const c = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2, half = alongX ? (r.z1 - r.z0) / 2 : (r.x1 - r.x0) / 2;
  const rows = Math.max(1, Math.ceil(n / levels.length));
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / levels.length), lv = i % levels.length;
    const t = rows === 1 ? 0.5 : (row + (lv % 2 ? 0.75 : 0.25)) / rows;
    const a = a0 + (a1 - a0) * t;
    const off = levels.length > 1 ? (lv % 2 ? 1 : -1) * half * 0.35 : 0;
    out.push(alongX ? { lx: a, lz: c + off, y: levels[lv] } : { lx: c + off, lz: a, y: levels[lv] });
  }
  return out;
}

/** 랙의 자리 수 (spots·frames 는 정해져 있고, line 은 길이 비례 — 넘치면 늘어난다) */
const lineLen = r => Math.max(r.x1 - r.x0, r.z1 - r.z0);
/** 방의 그림 액자 (FU-87 벽 가구) 자리 → [{ wall, slot }] (배치 순서) */
export const framesOf = spec => (spec.furniture ?? []).filter(e => e.fu === 'FU-87' && e.wall).map(e => ({ wall: e.wall, slot: e.slot }));
/** 벽 자리 (방 기준) → 캔버스 앞 { lx, lz, rotY } — room.js wallMount 와 같은 규칙 */
export function frameSpot({ wall, slot }, [w]) {
  if (wall === 'n') return { lx: slot + 0.5, lz: FRAME_OUT, rotY: 0 };
  if (wall === 'w') return { lx: FRAME_OUT, lz: slot + 0.5, rotY: Math.PI / 2 };
  return { lx: w - FRAME_OUT, lz: slot + 0.5, rotY: -Math.PI / 2 };
}

/**
 * 관 전시 자리: lists = { <분류>: [아이템 {id, artKind?}] } (아이템 표 순서), has(id) → 기증했나.
 * → [{ id, cat, kind: 'line'|'spots'|'frames', lx, lz, y, rotY?, donated }] — 기증 안 한 자리도 준다 (빈 자리)
 */
export function hallPlan(spec, lists, has = () => false) {
  const out = [];
  const size = spec.size ?? [8, 8];
  const frames = framesOf(spec);
  let frameI = 0;
  const byCat = {};
  for (const r of spec.racks ?? []) (byCat[r.cat] ||= []).push(r);
  for (const [cat, racks] of Object.entries(byCat)) {
    let left = (lists[cat] ?? []).slice();
    // 고정 자리(spots·frames) 먼저 — filter 가 맞는 것부터
    const fixedTake = (r, cap) => {
      const ok = it => !r.filter || (it.artKind ?? 'painting') === r.filter;
      const got = [];
      for (const it of left) { if (got.length >= cap) break; if (ok(it)) got.push(it); }
      left = left.filter(it => !got.includes(it));
      return got;
    };
    for (const r of racks) {
      if (r.kind === 'spots') {
        fixedTake(r, r.spots.length).forEach((it, i) => { const [lx, lz, y] = r.spots[i]; out.push({ id: it.id, cat, kind: 'spots', lx, lz, y, donated: !!has(it.id) }); });
      } else if (r.kind === 'frames') {
        const n = Math.min(r.count ?? frames.length, frames.length - frameI);
        fixedTake(r, n).forEach(it => { const f = frameSpot(frames[frameI++], size); out.push({ id: it.id, cat, kind: 'frames', lx: f.lx, lz: f.lz, y: FRAME_Y, rotY: f.rotY, donated: !!has(it.id) }); });
      }
    }
    // 남은 것은 줄(line)에 길이 비례로
    const lines = racks.filter(r => r.kind === 'line' && (!r.filter));
    if (left.length && lines.length) {
      const total = lines.reduce((s, r) => s + lineLen(r), 0);
      let i0 = 0;
      lines.forEach((r, k) => {
        const n = k === lines.length - 1 ? left.length - i0 : Math.round(left.length * lineLen(r) / total);
        lineSlots(r, n).forEach((s, j) => { const it = left[i0 + j]; out.push({ id: it.id, cat, kind: 'line', ...s, donated: !!has(it.id) }); });
        i0 += n;
      });
      left = [];
    }
  }
  return out;
}

/** 관 하나의 형편 → { total, donated, soon } (soon = 그 분류 아이템이 아직 없음 → 「곧 열려요」) */
export function hallStatus(spec, lists, has = () => false) {
  const ids = (spec.cats ?? []).flatMap(c => (lists[c] ?? []).map(it => it.id));
  return { total: ids.length, donated: ids.filter(id => has(id)).length, soon: ids.length === 0 };
}

/** 안내판 글 (창) */
export function signText(spec, st) {
  const name = HALL_NAME[spec.hall] ?? spec.name;
  if (st.soon) return `${spec.intro ?? ''}\n\n🚧 곧 열려요 — 아직 이 섬에서 ${name}에 놓을 것을 찾지 못했어요. 찾게 되면 느루에게 기증해 주세요. 그때부터 여기 채워져요.`;
  const line = spec.hall === 'star' ? `🔭 찍은 별자리 ${st.donated}/${st.total}` : `🏛️ 기증 ${st.donated}/${st.total}`;
  const tail = spec.hall === 'star' ? '박물관 앞 망원경으로 밤하늘의 별자리를 찍으면 여기 걸려요.' : st.donated < st.total ? '기증은 로비 안내대의 느루에게 해 주세요.' : '다 모았어요! 느루가 정말 기뻐해요.';
  return `${spec.intro ?? ''}\n\n${line}\n${tail}`;
}

/** 관 방 배치 검사 (checkPlace 에 더해) → 문제 글 목록 */
export function checkHall(spec, { checkPlace, furnIndex, lists }) {
  const out = [];
  if (!HALLS.includes(spec.hall)) out.push(`hall 이 ${HALLS.join('|')} 중 하나가 아니에요`);
  if (!/^RM-(2[5-9]|30)$/.test(spec.id ?? '')) out.push('id 는 RM-25–30');
  // checkPlace 는 계산대(role counter)·주인·talk 를 보니, 관은 그 셋 없이 따로 본다
  const base = checkPlace({ ...spec, keeper: { slug: 'none', lx: 0.5, lz: 0.5, face: 's' }, talk: spec.talk ?? { lx: (spec.size?.[0] ?? 8) / 2, lz: (spec.size?.[1] ?? 8) - 1.6 }, furniture: [...(spec.furniture ?? []), { fu: 'FU-00', box: [1, 1, 0.1], gx: 0, gz: (spec.size?.[1] ?? 8) - 1, role: 'counter' }] }, furnIndex)
    .filter(t => !/keeper|계산대|FU-00/.test(t));
  out.push(...base);
  if (spec.hall !== 'star') {
    const plan = hallPlan(spec, lists);
    const n = (spec.cats ?? []).reduce((s, c) => s + (lists[c]?.length ?? 0), 0);
    if (plan.length !== n) out.push(`전시 자리 ${plan.length} ≠ 아이템 ${n}`);
  }
  return out;
}
