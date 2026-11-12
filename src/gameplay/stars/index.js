// 별자리 (요청 8): 박물관 앞 공용 망원경(망원경대 PR-40) · 망원경 보기(UI-32) · 찍은 결과(UI-33) · 별자리 도감 · 별자리관에 줄 그림.
//  - 별자리 18개(IC-ST-01–12 · M18-P2 IC-ST-13–18)와 그리기는 src/sky/starmap.js (순수). 3D 밤하늘의 별자리 별은 src/sky/stars.js.
//  - 망원경대는 world 물체 'telescope-stand' 로 박물관 문 오른쪽 앞마당 밖에 하나 (persist: false — 들어올 때마다 같은 자리에 다시 놓는다,
//    자리는 state.stars.spot 에 둔다). 섬에 놓은 별 망원경 가구 FU-53(decor/telescope.js)도 같은 보기를 연다 (stars.open).
//  - 행동 키: 망원경대 앞 「망원경 보기」 85 (문 90 아래 · 가구 80 위 — telescope.js 와 같은 자리). 밤(19–5시)만, 낮엔 안내 한 줄.
//  - 찍은 것: state.stars.found[id] = { day, az, alt, fov } — 그림 대신 시야 값만 저장하고 그릴 때마다 drawSky 로 다시 그린다 (저장 크기 0에 가깝다).
//  - 이벤트 stars:captured { id } (박물관 별자리관이 받아 바로 건다), stars:view { on }.
//  - 저사양: 보기 화면은 2D 캔버스(낮음·매우 낮음 화소 배율 1, 90만 화소 상한)라 GPU 셰이더 몫이 없다. 3D 하늘엔 점 20개 안팎만 더해진다.
import { CONSTELLATIONS, byId, isStarHour, SEASON_NAME, drawSky, shotOf, defaultShot } from '../../sky/starmap.js';
import { openScope } from './view.js';
import { buildingSpot, doorsOf, nearDoor, SOFT_KINDS } from '../night/rules.js';
import { dirOfFacing } from '../decor/rules.js';

export const STAND_KIND = 'telescope-stand';
/** 망원경대 자리: 박물관 문에서 (오른쪽 칸, 앞쪽 칸) — 앞마당(문 앞 3.2칸)은 비워 둔다 */
export const STAND_OFFSET = [4.5, 1.5];

const S = { ctx: null, scope: null, placed: null, pending: false, checkT: 0 };
const st = () => (S.ctx.state.stars ||= { found: {}, spot: null });

function found(id) { return st().found?.[id] ?? null; }
const has = id => !!found(id);
const count = () => CONSTELLATIONS.filter(c => has(c.id)).length;

/** 찍기 → 저장 값 (이미 있으면 null) */
function capture(id, view) {
  const c = byId(id);
  if (!c || has(id)) return null;
  const shot = shotOf(c, view);
  (st().found ||= {})[id] = { day: S.ctx.services.time?.now?.().dayKey ?? null, ...shot };
  S.ctx.events.emit('stars:captured', { id });
  try { S.ctx.services.data?.save?.save?.(); } catch (e) { console.warn('[stars] 저장 실패', e); }
  return shot;
}

/** 별자리 그림 캔버스 (도감·별자리관 액자). 못 찍었으면 null (견본이 필요하면 sample: true) */
function picture(id, size = 128, { sample = false, t = 1.3 } = {}) {
  const c = byId(id), f = found(id);
  if (!c || (!f && !sample)) return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  drawSky(cv.getContext('2d'), size, size, f ?? defaultShot(c), { list: [c], lines: { [id]: 1 }, lens: true, t });
  return cv;
}

// ── 공용 망원경대 ──
const world = () => S.ctx.services.world;
function standFree() {
  const W = world(), I = W?.island, doors = doorsOf(W?.places ?? {});
  const hard = (tx, tz) => W.objects.on?.(tx, tz)?.some(o => !SOFT_KINDS.has(o.kind)) ?? !!W.objects.at(tx, tz);
  const ok = mode => (tx, tz) => {
    if (tx < 0 || tz < 0 || tx >= I.w || tz >= I.h) return false;
    const k = I.tileAt(tx, tz);
    if (k === 'water' || k === 'sea' || k === 'cliff' || k === 'ramp') return false;
    if (mode === 'open') return true;
    if (mode === 'clear') return !hard(tx, tz);
    return k === 'grass' && !hard(tx, tz) && !nearDoor(doors, I.toWorld(tx, tz), 2.6);
  };
  return { isFree: ok('floor'), isOpen: ok('open'), isClear: ok('clear') };
}
async function placeStand() {
  const W = world();
  if (S.pending || !W?.objects || !W.places?.museum || !W.island) return;
  if (S.placed && W.objects.get(S.placed)) return;
  S.pending = true;
  try {
    const I = W.island, m = W.places.museum, f = standFree();
    let spot = st().spot;
    if (!(spot && f.isFree(spot.tx, spot.tz))) {
      const anchor = { x: m.door.x + STAND_OFFSET[0], z: m.door.z + STAND_OFFSET[1] };
      spot = buildingSpot(anchor, [1, 1], { ...f, levelAt: (tx, tz) => I.levelAt(tx, tz), toTile: I.toTile, toWorld: I.toWorld, reach: 10 });
      if (!spot) { console.warn('[stars] 망원경대 자리를 못 찾았어요'); return; }
      st().spot = { tx: spot.tx, tz: spot.tz, x: spot.x, z: spot.z };
    }
    S.placed = W.objects.add(STAND_KIND, spot.tx, spot.tz, { persist: false, rot: 0 });
  } finally { S.pending = false; }
}

/** 플레이어 앞(바라보는 칸)이나 바로 옆의 망원경대 → 물체 | null */
function standInFront() {
  const sv = S.ctx.services, player = sv.player, objs = world()?.objects;
  if (!player?.position || !objs?.query || S.scope) return null;
  if (sv.house?.inside || sv.house?.where || Math.abs(player.position.x) > 200) return null;
  if (sv.decor?.active) return null;
  const [dx, dz] = dirOfFacing(player.facing ?? 0);
  const p = player.position;
  return objs.query(p.x + dx * 0.9, p.z + dz * 0.9, 0.8).find(o => o.kind === STAND_KIND) ?? null;
}

/** 망원경 보기 열기 (공용 망원경대 · FU-53 별 망원경이 같이 쓴다) → 열었으면 true */
function open({ where = '박물관 앞 망원경' } = {}) {
  const sv = S.ctx.services;
  if (S.scope) return false;
  const n = sv.time?.now?.();
  if (!isStarHour(n?.hourF)) {
    sv.ui?.toast?.('해가 지면 별자리를 볼 수 있어요. 저녁 7시부터예요', '🔭');
    return false;
  }
  S.scope = openScope(S.ctx, {
    stars: { has, capture, count }, where,
    onClose: () => { S.scope = null; S.ctx.events.emit('stars:view', { on: false }); },
  });
  if (!S.scope) return false;
  S.ctx.events.emit('stars:view', { on: true });
  S.ctx.events.emit('sfx', { name: 'menu', volume: 0.4 });
  return true;
}

/** 섬폰 도감 「⭐ 별자리」 칸 (ui/phone.js 가 부른다): panel 에 별자리 수(18)만큼 칸을 그린다 */
function dexPanel(panel, { bar } = {}) {
  const n = count();
  const grid = document.createElement('ul');
  grid.className = 'pk-dex-grid pk-dex-stars';
  grid.setAttribute('aria-label', '별자리 목록');
  for (const c of CONSTELLATIONS) {
    const got = has(c.id);
    const li = document.createElement('li');
    li.className = `pk-dex-cell${got ? '' : ' is-unknown'}`;
    li.title = got ? `${c.name} — ${c.desc}` : `${SEASON_NAME[c.season]} 밤하늘에서 찾아봐요`;
    const pic = got ? picture(c.id, 96) : null;
    if (pic) { pic.className = 'pk-dex-icon'; pic.style.cssText = 'width:44px;height:44px;border-radius:50%'; pic.setAttribute('aria-hidden', 'true'); li.append(pic); }
    else { const q = document.createElement('span'); q.className = 'pk-dex-icon'; q.setAttribute('aria-hidden', 'true'); q.textContent = '?'; li.append(q); }
    const name = document.createElement('span');
    name.className = 'pk-dex-name';
    name.textContent = got ? c.name : `??? (${SEASON_NAME[c.season]})`;
    li.append(name);
    grid.append(li);
  }
  const head = bar ? bar('찍은 별자리', n, CONSTELLATIONS.length) : null;
  const note = document.createElement('p');
  note.className = 'pk-dex-note';
  note.style.cssText = 'margin:4px 2px 8px;font-size:13px;opacity:.8';
  note.textContent = '🔭 박물관 앞 망원경으로 밤하늘을 보고, 별자리를 가운데에 잠깐 맞추면 찍혀요. 계절마다 셋씩 떠요.';
  panel.replaceChildren(...[head, note, grid].filter(Boolean));
}

export default {
  name: 'stars',
  async init(ctx) {
    S.ctx = ctx;
    ctx.services.gameplay?.interactions?.add({
      name: 'stars:scope', intent: 'action', priority: 85,
      label: () => '망원경 보기',
      test: () => standInFront(),
      run: () => open(),
    });
    ctx.events.on('game:ready', () => placeStand());
    ctx.events.on('world:ready', () => { S.placed = null; placeStand(); });
    ctx.events.on('data:loaded', () => { S.placed = null; placeStand(); });
    ctx.services.stars = {
      list: () => CONSTELLATIONS.map(c => ({ ...c, found: found(c.id) })),
      has, count, found, picture, open, dexPanel,
      close: () => S.scope?.close(),
      get viewing() { return !!S.scope; },
      get scope() { return S.scope; },
      /** 망원경대 자리 { id, x, z } | null (봇·점검이 앞에 설 곳) */
      stand: () => { const o = S.placed && world()?.objects?.get(S.placed); return o ? { id: o.id, x: o.x, z: o.z } : null; },
    };
  },
  update(dt) {
    S.scope?.update(dt);
    if ((S.checkT -= dt) <= 0) { S.checkT = 5; if (!S.ctx.services.tour?.active) placeStand(); }
  },
};
