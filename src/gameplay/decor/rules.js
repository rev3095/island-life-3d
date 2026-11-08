// 9차 M9-P2 섬 꾸미기 규칙 (DOM·three 없음 → tests/decor.test.mjs 가 섬 생성기로 돌린다).
// 칸 = world.island 칸 (tx, tz). 북쪽 = tz - 1 (게임 -Z). 길은 바닥 층('ground'), 울타리·야외 가구는 위 층('top') — 길 위에 가구는 놓을 수 있다.

export const DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const CORNERS = { ne: ['n', 'e'], nw: ['n', 'w'], se: ['s', 'e'], sw: ['s', 'w'] };
/** 놓을 수 있는 땅 (광장·물·절벽·비탈·다리·선착장은 안 됨) */
export const GROUND_OK = new Set(['grass', 'sand', 'path']);

/**
 * 이어짐 꼬리표: 같은 종류(same(tx, tz) = true)인 이웃 쪽 → ['n', 'e', …]. corners 면 길처럼 모서리도
 * (두 이웃과 그 대각선이 모두 같을 때만 'ne' 등 — 2×2 로 깔면 가운데 빈 곳이 메워진다)
 */
export function linkTags(tx, tz, same, { corners = false } = {}) {
  const out = [];
  for (const [d, [dx, dz]] of Object.entries(DIRS)) if (same(tx + dx, tz + dz)) out.push(d);
  if (corners) for (const [c, [a, b]] of Object.entries(CORNERS)) {
    if (!out.includes(a) || !out.includes(b)) continue;
    const dx = DIRS[a][0] + DIRS[b][0], dz = DIRS[a][1] + DIRS[b][1];
    if (same(tx + dx, tz + dz)) out.push(c);
  }
  return out;
}

/** 돌림 q(0~3, 90° 단위) 의 발자국 크기 [가로, 세로] */
export const turned = ([fw, fd], q) => (q % 2 ? [fd, fw] : [fw, fd]);

/**
 * 플레이어 앞 칸(anchor)에 놓을 때 차지하는 칸들. 앞쪽(facing 방향)으로 뻗고 옆으로는 가운데 맞춤.
 * dir = 앞 방향 [dx, dz] (DIRS 값), fp = 가구 발자국 → { tiles: [{tx, tz}], min: {tx, tz}, size: [w, d] }
 */
export function footprintTiles(anchor, dir, fp = [1, 1], q = 0) {
  const [w, d] = turned(fp, q);
  let x0 = anchor.tx - Math.floor((w - 1) / 2), z0 = anchor.tz - Math.floor((d - 1) / 2);
  if (dir[0] > 0) x0 = anchor.tx; else if (dir[0] < 0) x0 = anchor.tx - w + 1;
  if (dir[1] > 0) z0 = anchor.tz; else if (dir[1] < 0) z0 = anchor.tz - d + 1;
  const tiles = [];
  for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) tiles.push({ tx: x, tz: z });
  return { tiles, min: { tx: x0, tz: z0 }, size: [w, d] };
}

/** 바라보는 방향(facing, 0 = 북쪽) → 가장 가까운 네 방향 [dx, dz] */
export function dirOfFacing(facing) {
  const a = ((Math.round(facing / (Math.PI / 2)) % 4) + 4) % 4;   // 0 북 · 1 서 · 2 남 · 3 동 (player facing 뜻)
  return [DIRS.n, DIRS.w, DIRS.s, DIRS.e][a];
}

/**
 * 놓을 수 있나 → { ok, why } (why: 'outside' 'ground' 'level' 'taken' 'door' 'player' 'limit').
 * env = { inside(tx,tz), tileAt(tx,tz), levelAt(tx,tz), flagsAt(tx,tz), on(tx,tz) → [{ layer }], reserved(tx,tz), playerAt(tx,tz), count, limit }
 * layer = 'ground'(길) | 'top'(울타리·가구)
 */
export function canPlace(tiles, layer, env) {
  if (env.limit != null && env.count >= env.limit) return { ok: false, why: 'limit' };
  const lv = env.levelAt(tiles[0].tx, tiles[0].tz);
  for (const { tx, tz } of tiles) {
    if (!env.inside(tx, tz)) return { ok: false, why: 'outside' };
    if (!GROUND_OK.has(env.tileAt(tx, tz)) || env.flagsAt(tx, tz)) return { ok: false, why: 'ground' };
    if (env.levelAt(tx, tz) !== lv) return { ok: false, why: 'level' };
    if (env.reserved?.(tx, tz)) return { ok: false, why: 'door' };
    const here = env.on(tx, tz);
    // 길: 칸이 비어 있어야 (나무·바위·건물·다른 길 아래엔 안 깔림). 위 층: 길(바닥 층) 하나만 있어도 된다
    if (layer === 'ground' ? here.length > 0 : here.some(o => o.layer !== 'ground')) return { ok: false, why: 'taken' };
    if (layer !== 'ground' && env.playerAt?.(tx, tz)) return { ok: false, why: 'player' };
  }
  return { ok: true, why: null };
}

export const WHY_TEXT = {
  outside: '섬 밖이에요', ground: '여기엔 놓을 수 없어요 (풀밭·모래·흙길에만)', level: '높이가 다른 칸에 걸쳐요',
  taken: '이미 무언가 있어요', door: '문 앞은 비워 둬요', player: '서 있는 칸이에요', limit: '섬에 더 놓을 수 없어요',
};
