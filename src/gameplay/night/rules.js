// 밤·새벽 규칙 (M12, 밤·새벽 검수 보드 night 반영 v1 = D106–D114 모두 A). three·DOM 없음 → node 로도 돈다 (tests/night.test.mjs).
// 시각은 언제나 sky 의 time.now() 를 받아서 쓴다 (섬폰 시계 바늘이 시각을 옮겨도 같이 따라오게) — 여기서 Date 를 읽지 않는다.
// 게임 하루 시각 h = 5~29 (자정 = 24, 새벽 3시 = 27). 하루는 새벽 5시에 바뀐다.

/** 시각(0~24, now.hourF) → 게임 하루 시각 5~29 */
export const dayHour = hourF => (hourF < 5 ? hourF + 24 : hourF);
/** [from, to) 안인가 (게임 하루 시각) */
export const within = (h, [from, to]) => h >= from && h < to;

/** 밤 단계: 'day' | 'evening' (19–20) | 'night' (20–27) | 'dawn' (27–29) */
export function phaseOf(hourF) {
  const h = dayHour(hourF);
  if (h >= 27) return 'dawn';
  if (h >= 20) return 'night';
  if (h >= 19) return 'evening';
  return 'day';
}

/** dayKey 'YYYY-MM-DD' → 그 날의 요일 (0 일 ~ 6 토) */
export function weekdayOf(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * D114-A: 밤 콘텐츠가 열렸나 — 첫날 안내가 끝난 다음 게임 날부터.
 * st = state.night ({ firstDay }), dayKey = 오늘, introDone = 첫날 할 일을 마쳤나
 */
export function opened(st, dayKey, { introDone = true, after = 1 } = {}) {
  if (!introDone || !st?.firstDay) return false;
  return daysBetween(st.firstDay, dayKey) >= after;
}
export function daysBetween(a, b) {
  const t = k => { const [y, m, d] = String(k).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400e3);
}

/**
 * D106-A · D113-A: 오늘 밤 야시장이 열리나 → { open, why }.
 * now = time.now(), market = 설정, eventsLive = 지금 열린 행사 id 목록, festivalToday = 섬 축제 날인가
 * 날 기준은 게임 하루(dayKey) — 자정 넘어서도 그 토요일 밤으로 친다.
 */
export function marketPlan(now, market, { eventsLive = [], festivalToday = false } = {}) {
  const day = weekdayOf(now.dayKey);
  if (day !== market.weekday) return { today: false, open: false, why: 'weekday' };
  if (festivalToday && market.skipOnFestival) return { today: false, open: false, why: 'festival' };
  const clash = eventsLive.find(id => (market.skipOnEvents ?? []).includes(id));
  if (clash) return { today: false, open: false, why: `event:${clash}` };
  const h = dayHour(now.hourF);
  return { today: true, open: within(h, market.hours), why: within(h, market.hours) ? 'open' : h < market.hours[0] ? 'later' : 'over' };
}

/** 달빛 가게 · 새벽 천막 영업 (게임 하루 시각) */
export const placeOpen = (cfg, hourF) => within(dayHour(hourF), cfg.hours);

/** D110-A: 야행성 주민 집 문이 열리는 때인가 */
export const nightHouseOpen = (cfg, hourF) => within(dayHour(hourF), cfg.houseOpen);

// ── 타로 (D112-A) ──

/** 문자열 → 32비트 씨앗 */
export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}
/** 그 새벽에 엎어 둘 카드 셋 (날·섬 씨앗으로 정해져 같은 새벽엔 늘 같다) → 카드 id 배열 */
export function spread(cards, dayKey, seed = 0, n = 3) {
  const ids = cards.map(c => c.id);
  let s = hash(`${seed}|${dayKey}|tarot`);
  const out = [];
  while (out.length < Math.min(n, ids.length)) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const id = ids[s % ids.length];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** 다음 게임 날 dayKey (새벽에 뽑은 카드는 다음 5시부터 하루 동안) */
export function nextDayKey(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** 오늘(dayKey) 기운이 있는 카드 → 카드 | null. tarot = state.night.tarot ({ card, forDay }) */
export function fortuneOf(tarot, cards, dayKey) {
  if (!tarot?.card || tarot.forDay !== dayKey) return null;
  return cards.find(c => c.id === tarot.card) ?? null;
}

/** 카드를 뽑을 수 있나: 이 새벽에 이미 뽑았으면 false (drawnOn = 뽑은 게임 날) */
export const canDraw = (tarot, dayKey) => tarot?.drawnOn !== dayKey;

/** 고리 던지기: throws 번, 한 번에 hit 확률 → 걸린 수 (rng 하나로 정해진다) */
export function ringToss(rng, throws, hit) {
  let n = 0;
  for (let i = 0; i < throws; i++) if (rng() < hit) n++;
  return n;
}
/** 걸린 수 → 상품 줄 (그 수 이하 가장 큰 줄) | null */
export function ringPrize(prizes, hits) {
  return [...prizes].filter(p => p.hits <= hits).sort((a, b) => b.hits - a.hits)[0] ?? null;
}

// ── 자리 (섬 생성기로 테스트) ──

/** 건물 바닥에 깔려도 되는 작은 것 (덮여서 안 보이고 부딪히지 않는다) */
export const SOFT_KINDS = new Set(['weed', 'tulip', 'cosmos', 'pansy', 'shell']);

/**
 * 건물 자리: 기준점(x, z)에서 가까운 순으로 → { tx, tz (왼쪽 위 칸), fw, fd, level, x, z (가운데), door: {x, z} } | null.
 *  - 바닥 fw×fd 칸: isFree (풀밭 · 단단한 물체 없음 — 꽃·잡초는 괜찮다)
 *  - 둘레 한 칸: isOpen (걸을 수 있는 땅 — 나무가 있어도 된다) · 모두 같은 단 (levelAt, 언덕 위도 된다)
 *  - 문 앞 칸(가운데 한두 칸)과 그 앞 한 칸: isClear (걸을 수 있고 물체 없음)
 */
export function buildingSpot({ x, z }, [fw, fd], { isFree, isOpen = isFree, isClear = isOpen, toTile, toWorld, levelAt = () => 0, reach = 12 }) {
  const c = toTile(x, z);
  const doorCols = tx0 => (fw % 2 ? [tx0 + (fw - 1) / 2] : [tx0 + fw / 2 - 1, tx0 + fw / 2]);
  const ok = (tx0, tz0) => {
    const lv = levelAt(tx0, tz0);
    for (let tz = tz0 - 1; tz <= tz0 + fd + 1; tz++) for (let tx = tx0 - 1; tx <= tx0 + fw; tx++) if (levelAt(tx, tz) !== lv) return false;
    for (let tz = tz0; tz < tz0 + fd; tz++) for (let tx = tx0; tx < tx0 + fw; tx++) if (!isFree(tx, tz)) return false;
    for (let tz = tz0 - 1; tz <= tz0 + fd; tz++) for (let tx = tx0 - 1; tx <= tx0 + fw; tx++) {
      const inside = tx >= tx0 && tx < tx0 + fw && tz >= tz0 && tz < tz0 + fd;
      if (!inside && !isOpen(tx, tz)) return false;
    }
    for (const tx of doorCols(tx0)) for (const tz of [tz0 + fd, tz0 + fd + 1]) if (!isClear(tx, tz)) return false;
    return true;
  };
  for (let r = 0; r <= reach; r++) {
    const ring = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r) ring.push([dx, dz]);
    ring.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
    for (const [dx, dz] of ring) {
      const tx0 = c.tx + dx - Math.floor(fw / 2), tz0 = c.tz + dz - Math.floor(fd / 2);
      if (!ok(tx0, tz0)) continue;
      const a = toWorld(tx0, tz0), b = toWorld(tx0 + fw - 1, tz0 + fd - 1);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      return { tx: tx0, tz: tz0, fw, fd, level: levelAt(tx0, tz0), x: cx, z: cz, door: { x: cx, z: toWorld(tx0, tz0 + fd).z } };
    }
  }
  return null;
}

/** 섬 건물 문 자리 (world.places — 상점·박물관·집·집터, 밤 건물 제외) → [{x, z}] */
export function doorsOf(places = {}) {
  const one = p => (p?.door ? [p.door] : []);
  return [...one(places.shop), ...one(places.museum), ...one(places.playerHouse),
    ...(places.villagerHouses ?? []).flatMap(one), ...(places.spareLots ?? []).flatMap(one)];
}
/** 문 앞마당 안인가 (문에서 r 칸 안, 문 앞쪽(남쪽)은 더 넓게) */
export const nearDoor = (doors, { x, z }, r = 3.2) => doors.some(d => Math.hypot(x - d.x, (z - d.z) * (z > d.z ? 0.7 : 1.4)) < r);

/** 등불 줄 자리: 노점 사이 (n-1 개) */
export const lanternSpots = stalls => stalls.slice(1).map((s, i) => ({ x: (s.x + stalls[i].x) / 2, z: (s.z + stalls[i].z) / 2 - 0.6, rot: 0 }));

// ── P54 밤 특별 상점 (D165–D169, docs/notes/night-special.md) ──
// 서는 날·진열은 모두 (섬 씨앗 · 날 · 이름) 으로 정해져서, 같은 날엔 다시 열어도 같다 (Math.random 을 쓰지 않는다).

/** (씨앗 · 날 · 이름) → 0~1 난수 함수 */
export function rngOf(seed, dayKey, tag) {
  let s = hash(`${seed}|${dayKey}|${tag}`) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * 오늘 밤 그 가게가 오나 (여우 상인 D167-A · 이상한 천막 D166-A): 확률 chance, 또는 마지막으로 온 날(last, 없으면 since)부터 guarantee 일이 지났으면 꼭.
 * last 가 없고 since 도 없으면 (처음) firstNight 이면 온다.
 */
export function visitsToday(dayKey, seed, c, { last = null, since = null } = {}) {
  if (!c) return false;
  if (last === dayKey) return true;
  const base = last ?? since;
  if (!base) return !!c.firstNight;
  if (c.guarantee && daysBetween(base, dayKey) >= c.guarantee) return true;
  return rngOf(seed, dayKey, c.tag ?? c.building ?? 'visit')() < (c.chance ?? 0);
}

/**
 * 오늘의 미술품 고르기 → 아이템 id 배열. works = [{ id, fake (가품 id | null) }], n = 몇 점, fakeChance = 가품이 있는 작품이 가품일 확률.
 * 서로 다른 작품만 (진품·가품이 같은 작품으로 둘 나오지 않음).
 */
export function pickArt(works, rng, n = 1, fakeChance = 0) {
  const pool = works.slice(), out = [];
  while (out.length < n && pool.length) {
    const w = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    out.push(w.fake && rng() < fakeChance ? w.fake : w.id);
  }
  return out;
}

/** 여우 상인 오늘의 미술품 2–3점 (D167-A) */
export function foxStock(works, dayKey, seed, c) {
  const r = rngOf(seed, dayKey, 'fox-stock'), [lo, hi] = c.artCount ?? [2, 3];
  return pickArt(works, r, lo + Math.floor(r() * (hi - lo + 1)), c.fakeChance ?? 0.5);
}

/** 이상한 천막 진열 하나 (D166-A): 확률 artChance 로 미술품 하나 { group: 'art', id }, 아니면 수상한 물건 { group: 'furniture', id } */
export function oddStock(works, dayKey, seed, c) {
  const r = rngOf(seed, dayKey, 'odd-stock');
  if (works.length && r() < (c.artChance ?? 0.5)) return { group: 'art', id: pickArt(works, r, 1, c.fakeChance ?? 0.4)[0] };
  const list = c.stock ?? [];
  return list.length ? { group: 'furniture', id: list[Math.floor(r() * list.length)] } : null;
}

/**
 * 선물 상자 PR-35 (D169-A): 오늘 섬에 떨어져 있나 → { today, contents: { kind: 'art'|'item'|'acorns', id?, n? } }.
 * 낮·밤 모두. 확률 chance, 안에는 artChance 로 미술품(가품 섞임), 아니면 가구 하나 또는 도토리.
 */
export function giftPlan(works, dayKey, seed, c) {
  const r = rngOf(seed, dayKey, 'gift');
  if (!(r() < (c.chance ?? 0))) return { today: false, contents: null };
  if (works.length && r() < (c.artChance ?? 0)) return { today: true, contents: { kind: 'art', id: pickArt(works, r, 1, c.fakeChance ?? 0.5)[0] } };
  const items = c.items ?? [];
  if (items.length && r() < (c.itemChance ?? 0.5)) return { today: true, contents: { kind: 'item', id: items[Math.floor(r() * items.length)] } };
  const [lo, hi] = c.acorns ?? [100, 300];
  return { today: true, contents: { kind: 'acorns', n: Math.round((lo + r() * (hi - lo)) / 10) * 10 } };
}

/** 칸 고르기: 섬 크기 w×h 에서 rng 로 ok(tx, tz) 인 칸 하나 (tries 번) → { tx, tz } | null */
export function pickCell(rng, w, h, ok, tries = 400) {
  for (let i = 0; i < tries; i++) {
    const tx = Math.floor(rng() * w), tz = Math.floor(rng() * h);
    if (ok(tx, tz)) return { tx, tz };
  }
  return null;
}

/** M18-P4 (D195-A): 여우 상인 살랑이 가품을 되사는 값 = 그 작품 여우 값(buy)의 반 (10 단위 내림, 가품 파는 값보다는 많이) */
export const foxBuyBack = (it, ratio = 0.5) => Math.max(it?.price ?? 0, Math.floor(((it?.buy ?? 0) * ratio) / 10) * 10);
