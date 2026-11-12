// M14 집 증축 규칙 (three·DOM 없음 → tests/home.test.mjs 가 node 로 돌린다). 그리기·충돌은 floors.js, 드나들기·가구는 index.js.
// 설정 assets/interior/home.json: 단계(stages) 넷 — 0 처음 집(8×8) · 1 방 넓히기 · 2 2층 · 3 다락. 단계마다 도토리 빚(cost)으로 짓고,
// 짓겠다고 한 다음 날 아침(05:00 하루 리셋, data:newday)에 다 지어진다. 빚을 다 갚아야 다음 단계를 물을 수 있다 (결정 D150-A).
// 방 배치는 assets/interior/rooms/rm-15.json (넓힌 1층) · rm-16.json (2층) · rm-17.json (다락) — owner 'player', floor 0·1·2.
// 상태 state.house.grow = { stage, debt, pending (다음 날 지어질 단계 | null), paid (지금까지 갚은 도토리), decor: { 1: {wallpaper, floor}, 2: … } }
//   가구 rec 에 floor (0 1층 · 1 2층 · 2 다락, 없으면 0) 를 더한다. state.house.level = 집 안에서 끝낸 층 (이어하기).

export const HOME_FILE = 'assets/interior/home.json';
export const ROOM_FILES = ['assets/interior/rooms/rm-15.json', 'assets/interior/rooms/rm-16.json', 'assets/interior/rooms/rm-17.json'];
export const FLOOR_NAME = ['1층', '2층', '다락'];

/** 설정이 없을 때 (테스트·편집기 기본값과 같다) */
export const DEFAULT_HOME = {
  version: 1,
  stages: [
    { stage: 0, name: '처음 집' },
    { stage: 1, name: '방 넓히기', cost: 20000, exterior: 'house-grown-1', room: 'rm-15', note: '1층을 10×10 칸으로' },
    { stage: 2, name: '2층 올리기', cost: 50000, exterior: 'house-grown-2', room: 'rm-16', note: '계단으로 오르는 2층 방' },
    { stage: 3, name: '다락 올리기', cost: 100000, exterior: 'house-grown-3', room: 'rm-17', note: '지붕 밑 다락방' },
  ],
  repay: [1000, 10000],
  afterIntro: true,
};

export const maxStage = cfg => Math.max(0, ...(cfg?.stages ?? DEFAULT_HOME.stages).map(s => s.stage));
export const stageOf = (cfg, n) => (cfg?.stages ?? DEFAULT_HOME.stages).find(s => s.stage === n) ?? null;

/** state.house.grow 를 바로잡아 돌려준다 (없으면 만든다) */
export function ensureGrow(S, cfg = DEFAULT_HOME) {
  const g = (S.grow && typeof S.grow === 'object') ? S.grow : (S.grow = {});
  const top = maxStage(cfg);
  const int = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : lo);
  g.stage = int(g.stage, 0, top);
  g.debt = int(g.debt, 0, 1e9);
  g.paid = int(g.paid, 0, 1e12);
  g.pending = Number.isFinite(g.pending) && g.pending === g.stage + 1 && g.pending <= top ? g.pending : null;
  if (!g.decor || typeof g.decor !== 'object') g.decor = {};
  return g;
}

/** 우편함에서 무엇을 말할까 → { kind: 'build' | 'pending' | 'debt' | 'done', next?, debt? } */
export function offer(g, cfg = DEFAULT_HOME) {
  if (g.pending != null) return { kind: 'pending', next: stageOf(cfg, g.pending) };
  if (g.debt > 0) return { kind: 'debt', debt: g.debt };
  const next = stageOf(cfg, g.stage + 1);
  return next ? { kind: 'build', next } : { kind: 'done' };
}

/**
 * M17-P2 (D185-A) 어디서 무슨 이야기를 하나: where 'mail' 우편함 · 'shop' 도토리상점 밤톨 「집을 넓히고 싶어요」.
 * 우편함은 빚 갚기만 ('repay' — 빚이 있으면 짓는 중이어도) · 빚이 없으면 'to-shop' (밤톨에게 가라는 한 줄).
 * 상점은 'build' 다음 단계 · 'pending' 짓는 중 · 'debt' 빚이 남음 (우편함에서 갚으라고) · 'done' 다 지음.
 */
export function growTopic(g, cfg = DEFAULT_HOME, where = 'mail') {
  if (where === 'mail') return g.debt > 0 ? 'repay' : 'to-shop';
  return offer(g, cfg).kind;
}

/** 다음 단계 짓기 시작 (빚이 없을 때만) → 시작한 단계 | null */
export function startBuild(g, cfg = DEFAULT_HOME) {
  const o = offer(g, cfg);
  if (o.kind !== 'build') return null;
  g.pending = o.next.stage;
  g.debt += Math.max(0, o.next.cost ?? 0);
  return o.next;
}

/** 하루가 지나면: 짓던 단계를 다 짓는다 → 새 단계 | null */
export function finishBuild(g) {
  if (g.pending == null) return null;
  g.stage = g.pending;
  g.pending = null;
  return g.stage;
}

/** 갚을 수 있는 금액 고르기: 'all' | 숫자 → 실제로 갚을 도토리 (지갑·빚 중 작은 쪽, 0 이면 못 갚음) */
export function repayAmount(g, wallet, want) {
  const cap = Math.min(g.debt, Math.max(0, Math.floor(wallet)));
  if (want === 'all') return cap;
  return Number.isFinite(want) && want > 0 ? Math.min(cap, Math.floor(want)) : 0;
}

/** 갚기 (도토리는 부르는 쪽이 지갑에서 뺀다) → 남은 빚 */
export function repay(g, amount) {
  const a = Math.max(0, Math.min(g.debt, Math.floor(amount) || 0));
  g.debt -= a;
  g.paid += a;
  return g.debt;
}

/** 우편함 갚기 단추: [{ label, amount }] — 지갑에 있는 만큼만 */
export function repayChoices(g, wallet, cfg = DEFAULT_HOME) {
  const out = [];
  for (const n of cfg.repay ?? DEFAULT_HOME.repay) {
    if (n < g.debt && wallet >= n) out.push({ label: `${n.toLocaleString('ko-KR')} 갚기`, amount: n });
  }
  const all = repayAmount(g, wallet, 'all');
  if (all > 0) out.push({ label: all === g.debt ? `다 갚기 (${all.toLocaleString('ko-KR')})` : `있는 만큼 갚기 (${all.toLocaleString('ko-KR')})`, amount: all });
  return out;
}

// ---------- 층 배치 ----------

/** 단계 → 지을 층 목록 (방 파일 rooms = { 'rm-15': {...}, … }) → [{ n, slug, size, origin, windows, door, wallH, workbench, fixtures, starter }]
 *  stage 0 은 처음 집 8×8 하나 (rm 파일 없이 기본값). 1층 방(rm-15)은 stage ≥ 1, 2층(rm-16) ≥ 2, 다락(rm-17) ≥ 3.
 *  계단(fixtures)은 그 계단이 닿는 층이 있을 때만 (1층 계단은 stage ≥ 2, 2층 다락 계단은 stage ≥ 3) */
export function floorsFor(stage, rooms, base) {
  const out = [];
  const pick = (slug, n) => {
    const r = rooms?.[slug];
    if (!r) return null;
    return {
      n, slug, id: r.id, name: r.name ?? FLOOR_NAME[n],
      size: r.size ?? [8, 8], origin: r.origin ?? { x: 500, z: n * 40 }, windows: r.windows ?? [], door: r.door ?? null,
      wallH: r.wallH ?? null, workbench: r.workbench ?? null, entry: r.entry ?? null,
      fixtures: (r.fixtures ?? []).filter(f => stage >= (f.from ?? 0)),
      starter: r.starter ?? [], wallpaper: r.wallpaper ?? null, floor: r.floor ?? null,
    };
  };
  out.push(stage >= 1 ? (pick('rm-15', 0) ?? base) : base);
  if (stage >= 2) { const f = pick('rm-16', 1); if (f) out.push(f); }
  if (stage >= 3) { const f = pick('rm-17', 2); if (f) out.push(f); }
  return out;
}

/** 1층이 커질 때 가구를 같은 월드 자리에 두는 칸 옮김 (가운데를 지키며 커진다) → { dx, dz } */
export function growShift(fromSize, toSize) {
  return { dx: Math.floor((toSize[0] - fromSize[0]) / 2), dz: Math.floor((toSize[1] - fromSize[1]) / 2) };
}

/** 가구 rec 들을 옮긴다 (그 층 것만). 바닥 가구 gx·gz += d, 벽 가구는 북쪽 벽 slot += dx, 서·동쪽 벽 slot += dz */
export function shiftRecs(recs, { dx, dz }, floor = 0) {
  for (const r of recs) {
    if ((r.floor ?? 0) !== floor) continue;
    if (r.wall) r.slot += r.wall === 'n' ? dx : dz;
    else { r.gx += dx; r.gz += dz; }
  }
  return recs;
}

/** 계단 칸 (방 기준 칸 단위) { x0, z0, x1, z1 } */
export const fixtureBox = f => ({ x0: f.gx, z0: f.gz, x1: f.gx + f.w, z1: f.gz + f.d });

/**
 * 계단 높이 (방 기준 lx, lz): 오르는 계단(kind 'up')은 남쪽 끝 0 → 북쪽 끝 top. 계단 밖이면 null.
 * 내려가는 곳(kind 'down', 위층의 구멍)은 높이를 바꾸지 않는다.
 */
export function stairHeight(f, lx, lz) {
  if (f.kind !== 'up') return null;
  const b = fixtureBox(f);
  if (lx < b.x0 || lx > b.x1 || lz < b.z0 || lz > b.z1) return null;
  const t = (b.z1 - lz) / (b.z1 - b.z0);
  return Math.max(0, Math.min(1, t)) * (f.top ?? 1.7);
}

/**
 * 계단으로 다른 층에 가는가: 오르는 계단은 북쪽 끝(top 칸 안쪽 0.75)까지 올라가면, 내려가는 곳은 열린 쪽에서 구멍 안으로 0.35 들어서면.
 * → 그 계단 f | null
 */
export function stairTrigger(fixtures, lx, lz) {
  for (const f of fixtures ?? []) {
    const b = fixtureBox(f);
    if (f.kind === 'up') {
      if (lx > b.x0 + 0.15 && lx < b.x1 - 0.15 && lz < b.z0 + 0.75) return f;
    } else if (f.kind === 'down') {
      const open = f.open ?? 'w';   // 열린 쪽 (북쪽 끝 한 칸)
      const inZ = lz > b.z0 && lz < b.z0 + 1.0;
      if (open === 'w' && inZ && lx > b.x0 + 0.35) return f;
      if (open === 'e' && inZ && lx < b.x1 - 0.35) return f;
    }
  }
  return null;
}

/**
 * 계단 둘레 막는 상자 (방 기준): 오르는 계단은 서쪽(또는 동쪽 open) 옆, 내려가는 곳은 남쪽 난간 + 옆 난간 + 구멍 안쪽 (열린 북쪽 한 칸만 남긴다).
 * 플레이어가 계단 옆으로 떨어지거나 구멍 남쪽에서 들어가지 않게.
 */
export function fixtureBlockers(f) {
  const b = fixtureBox(f), t = 0.08;
  if (f.kind === 'up') {
    const side = f.rail ?? 'w';
    // 아래 칸 0.6 은 열어 둔다 (남쪽에서 오른다)
    return side === 'w' ? [{ x0: b.x0 - t, z0: b.z0, x1: b.x0 + t, z1: b.z1 - 0.6 }] : [{ x0: b.x1 - t, z0: b.z0, x1: b.x1 + t, z1: b.z1 - 0.6 }];
  }
  const open = f.open ?? 'w';
  return [
    { x0: b.x0, z0: b.z1 - t, x1: b.x1, z1: b.z1 + t },                                         // 남쪽 난간
    open === 'w' ? { x0: b.x0 - t, z0: b.z0 + 1.0, x1: b.x0 + t, z1: b.z1 } : { x0: b.x1 - t, z0: b.z0 + 1.0, x1: b.x1 + t, z1: b.z1 },   // 옆 난간
    { x0: b.x0 + 0.2, z0: b.z0 + 1.0, x1: b.x1 - 0.2, z1: b.z1 - 0.2 },                       // 구멍 안쪽 (남쪽 칸)
  ];
}

/** 다른 층에 도착할 자리 (방 기준): 오르면 위층 구멍의 열린 쪽 바깥 한 칸, 내려오면 아래층 계단 꼭대기 → { lx, lz, facing, walk: {lx, lz} } */
export function arrivalAt(f, dir) {
  const b = fixtureBox(f);
  if (dir === 'up') {   // f = 위층의 내려가는 곳
    const open = f.open ?? 'w';
    const lz = b.z0 + 0.5;
    return open === 'w'
      ? { lx: b.x0 - 0.45, lz, facing: Math.PI / 2, walk: { lx: b.x0 - 1.25, lz } }
      : { lx: b.x1 + 0.45, lz, facing: -Math.PI / 2, walk: { lx: b.x1 + 1.25, lz } };
  }
  // f = 아래층의 오르는 계단: 꼭대기 조금 아래에서 남쪽을 보고 걸어 내려간다
  const cx = (b.x0 + b.x1) / 2;
  return { lx: cx, lz: b.z0 + 1.0, facing: Math.PI, walk: { lx: cx, lz: b.z1 + 0.55 } };
}

/** 방 파일 검사 (내 집 방 RM-15–17) → 문제 글 목록 */
export function checkHomeRoom(room) {
  const out = [];
  const [w, d] = room.size ?? [];
  if (!(w >= 4 && d >= 4)) out.push('size = [가로, 깊이] (4 이상)');
  if (!Number.isInteger(room.floorIndex)) out.push('floorIndex (0 1층 · 1 2층 · 2 다락) 가 필요해요');
  if (room.floorIndex === 0 && !room.door) out.push('1층은 문 매트 door 가 있어야 해요');
  if (room.floorIndex > 0 && room.door) out.push('위층에는 문이 없어요 (door: null)');
  for (const f of room.fixtures ?? []) {
    const b = fixtureBox(f);
    if (!(b.x0 >= 0 && b.z0 >= 0 && b.x1 <= w && b.z1 <= d)) out.push(`${f.slug}: 방 밖으로 나가요`);
    if (f.kind !== 'up' && f.kind !== 'down') out.push(`${f.slug}: kind 는 up · down`);
    if (!Number.isInteger(f.to)) out.push(`${f.slug}: to (닿는 층) 가 필요해요`);
  }
  for (const key of room.windows ?? []) if (!/^n:\d+$/.test(key)) out.push(`창문 ${key} 는 'n:칸'`);
  return out;
}
