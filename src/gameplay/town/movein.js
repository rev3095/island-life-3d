// 5차 D10-A 새 주민 이사: 첫날(안내 끝난 날) 다음 날 빈 집터에 표지판(PR-12) → 3일 뒤 이삿짐(PR-10) → 다음 날 집 + 입주.
// 진행은 state.town.movein[slug] = { start, lot, boxes, moved } (각 단계가 시작된 dayKey). 아무도 떠나지 않는다.
// 집터는 world.places.villagerHouses 의 lot 칸 (island.js 가 비워 둔 자리). 소품·집은 저장하지 않는 물체(persist:false)로
// 시작할 때마다 단계에 맞게 다시 놓는다. 소품 모델이 아직 없으면(Z3 가 만드는 중) 건너뛰고, 합친 뒤엔 저절로 보인다.
import { daysBetween, josa } from './rules.js';
import { PEOPLE } from './people.js';
import { dayMmdd } from '../../data/birthdays.js';

/** 단계 사이 날 수: 시작 → 표지판, 표지판 → 이삿짐, 이삿짐 → 입주 */
export const MOVEIN_DAYS = { lot: 1, boxes: 3, house: 1 };
/** 소품: 배경 slug 후보(Z3 와 맞춘 이름, p8-furniture 26f6e0c) · 스펙 id · 없을 때 임시로 쓸 기존 배경.
 *  lot-sign 은 원점이 3×3 집터 가운데(말뚝이 네 귀퉁이), moving-boxes 는 2×1, party-balloons 는 폭 1.7 (기둥 ±0.75) */
export const PROPS = {
  sign: { slugs: ['lot-sign'], id: 'PR-12', fallback: 'signboard' },
  boxes: { slugs: ['moving-boxes'], id: 'PR-10' },
  balloons: { slugs: ['party-balloons'], id: 'PR-11' },
};
export const HOUSE_KIND = 'house-villager';
const MAILBOX = { danpung: 'red' };

/** state.town.movein[slug] (빈 칸 채움) */
export function moveinState(state, slug) {
  const t = (state.town ??= {});
  const all = (t.movein ??= {});
  const r = (all[slug] ??= {});
  r.start ??= null; r.lot ??= null; r.boxes ??= null; r.moved ??= null;
  return r;
}

export const stageOf = r => (r.moved ? 'moved' : r.boxes ? 'boxes' : r.lot ? 'lot' : r.start ? 'waiting' : 'none');

/** dayKey + n 일 */
export const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * 그날(dayKey)까지 진행 → 새로 시작된 단계들 ['lot', 'boxes', 'moved'] (첫날 안내 전엔 아무 일 없음, 시계를 되돌려도 물러나지 않는다).
 * 단계 날은 예정된 날(앞 단계 + 날 수)로 적는다 — 며칠 쉬었다 오면 그동안 지난 단계를 한꺼번에 따라잡는다.
 */
export function advanceMovein(r, dayKey, introDone, days = MOVEIN_DAYS) {
  if (!dayKey || !introDone) return [];
  const out = [];
  r.start ??= dayKey;
  const due = (from, n) => (daysBetween(from, dayKey) >= n ? addDays(from, n) : null);
  if (!r.lot && (r.lot = due(r.start, days.lot))) out.push('lot');
  if (r.lot && !r.boxes && (r.boxes = due(r.lot, days.boxes))) out.push('boxes');
  if (r.boxes && !r.moved && (r.moved = due(r.boxes, days.house))) out.push('moved');
  return out;
}

/** 이사 온 주민인가 (NEWCOMERS 가 아니면 늘 산다) */
export const livesHere = (state, slug, newcomers) => !newcomers.includes(slug) || !!state.town?.movein?.[slug]?.moved;

/** 소품 → 지금 쓸 수 있는 배경 종류 이름 (없으면 null) */
export function propKind(world, prop) {
  const models = world?.debug?.models;
  const has = k => (models ? !!models[k] : Object.keys(world?.palette?.(k) ?? {}).length > 0);
  for (const k of prop.slugs) if (has(k)) return k;
  if (models && prop.id) for (const [k, m] of Object.entries(models)) if (m.spec?.id === prop.id) return k;
  return prop.fallback && has(prop.fallback) ? prop.fallback : null;
}

/**
 * 이사 흐름 실행: opts = { mail, addResident(slug) → Promise, toast(text, icon) }
 * → { check(dayKey), sync(), update(), skip(slug), stage(slug), lotOf(slug) }
 */
export function createMovein(ctx, { mail, addResident, toast }) {
  const world = ctx.services.world;
  const newcomers = ctx.constants.NEWCOMERS ?? [];
  const placed = {};   // slug → { sign, boxes, house, mailbox } 물체 id
  const waiting = new Set();   // 플레이어가 집터 위에 있어서 집을 아직 못 세운 slug
  const lotOf = slug => world.places.villagerHouses?.find(h => h.slug === slug && h.lot) ?? null;

  function put(slug, key, kind, tx, tz, data = {}) {
    const P = (placed[slug] ??= {});
    if (P[key] || !kind) return;
    P[key] = world.objects.add(kind, tx, tz, { persist: false, id: `${kind}@${slug}`, ...data });
  }
  function drop(slug, key) {
    const P = placed[slug];
    if (!P?.[key]) return;
    world.objects.remove(P[key]);
    P[key] = null;
  }

  /** 플레이어가 집터(+둘레 반 칸) 안에 서 있나 — 그 위에 집을 세우면 갇힌다 */
  function playerOnLot(h) {
    const p = ctx.services.player?.position;
    if (!p) return false;
    const L = h.lot, c = world.island.toWorld(L.cx, L.cz);
    return Math.abs(p.x - c.x) < L.fw / 2 + 0.5 && Math.abs(p.z - c.z) < L.fd / 2 + 0.5;
  }

  function placeHouse(slug, h) {
    if (playerOnLot(h)) { waiting.add(slug); return; }
    waiting.delete(slug);
    const L = h.lot;
    put(slug, 'house', HOUSE_KIND, L.cx, L.cz, { variant: slug, owner: slug });
    put(slug, 'mailbox', 'mailbox', h.tx + 1, h.tz, { variant: MAILBOX[slug] ?? 'red', owner: slug });
    if (L.pad) L.pad.off = false;   // 문 앞 계단
  }

  /** 단계에 맞게 집터 위 물체 놓기 */
  function sync(slug) {
    const h = lotOf(slug);
    if (!h) return;
    const st = stageOf(moveinState(ctx.state, slug));
    const L = h.lot;
    const sign = propKind(world, PROPS.sign);
    // 집터 표지판은 집터 가운데에 (말뚝이 귀퉁이), 임시 안내판은 앞줄 가운데 칸에
    if (st === 'lot' || st === 'boxes') put(slug, 'sign', sign, L.cx, sign === PROPS.sign.fallback ? L.cz + 1 : L.cz, { owner: slug });
    else drop(slug, 'sign');
    if (st === 'boxes') put(slug, 'boxes', propKind(world, PROPS.boxes), L.cx, L.cz, { owner: slug });
    else drop(slug, 'boxes');
    if (st === 'moved') placeHouse(slug, h);
  }

  function notify(slug, step) {
    const intro = !!ctx.state.flags?.intro;
    if (step === 'lot') {
      if (intro) mail.post('bamtol', 'lot');
      toast('빈 집터에 표지판이 섰어요. 누군가 이사 온대요!', '🪧');
    } else if (step === 'boxes') {
      mail.post(slug, 'moving');
      toast('빈 집터에 이삿짐이 도착했어요', '📦');
    } else if (step === 'moved') {
      mail.post(slug, 'movein');
      toast(`${josa(PEOPLE[slug]?.name ?? slug, '이')} 섬으로 이사 왔어요!`, '🏡');
    }
  }

  /** 하루가 바뀌었을 때(와 시작할 때) 진행 → 새 단계 알림·물체 */
  function check(dayKey) {
    for (const slug of newcomers) {
      const r = moveinState(ctx.state, slug);
      const steps = advanceMovein(r, dayKey, !!ctx.state.flags?.intro);
      if (steps.length) {
        notify(slug, steps[steps.length - 1]);   // 며칠을 건너뛰었으면 마지막 소식만
        if (steps.includes('moved')) moved(slug, r.moved);
      }
      sync(slug);
    }
  }

  function moved(slug, dayKey) {
    const t = ctx.state.town;
    (t.birthdays ??= {})[slug] ??= dayMmdd(dayKey);   // 이사 온 날이 생일
    ctx.events.emit('town:movein', { slug });
    Promise.resolve(addResident(slug)).catch(e => console.error('[town] 입주', e));
  }

  return {
    check, sync, lotOf,
    stage: slug => stageOf(moveinState(ctx.state, slug)),
    /** 매 프레임: 집터 위에 서 있던 플레이어가 비켜나면 집을 세운다 */
    update() { for (const slug of waiting) { const h = lotOf(slug); if (h && !playerOnLot(h)) placeHouse(slug, h); } },
    /** 개발용: 다음 단계로 바로 (오늘 날짜로) */
    skip(slug = newcomers[0], dayKey) {
      const r = moveinState(ctx.state, slug);
      const st = stageOf(r);
      if (st === 'moved') return st;
      const key = dayKey ?? r.start ?? null;
      if (!key) return st;
      const next = st === 'none' || st === 'waiting' ? 'lot' : st === 'lot' ? 'boxes' : 'moved';
      r.start ??= key;
      r[next] = key;
      notify(slug, next);
      if (next === 'moved') moved(slug, key);
      sync(slug);
      return next;
    },
  };
}
