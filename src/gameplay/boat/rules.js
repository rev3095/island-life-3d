// 어선·먼바다 낚시 규칙 (east-fishboat, D275–D279) — three·DOM 없음 → node 로도 돈다 (tests/boat.test.mjs).
// 화면·배·뱃사공은 index.js, 설정은 assets/boat/boat.json, 먼바다 물고기 표는 assets/data/items.json offshore.

/**
 * 섬 동쪽 끝 바닷가에서 부두 자리 찾기 (순수).
 * isl = { w, h, tileAt(tx, tz), toWorld(tx, tz) → {x, z} }, zr = 섬 세로 비율 (layout.fishDock[1]).
 * 그 줄 둘레(±span 줄)에서 동쪽 끝부터 서쪽으로 보며 「모래 칸, 바로 동쪽이 바다 칸이 pier+2칸 넘게 이어짐」 인 곳.
 * → { tx, tz, x, z (모래 끝 칸 가운데) } | null
 */
export function findDockSite(isl, zr = 0.55, { pier = 3, span = 8 } = {}) {
  const tz0 = Math.round(zr * (isl.h - 1));
  const sea = (tx, tz) => isl.tileAt(tx, tz) === 'sea';
  const seaRun = (tx, tz) => { let n = 0; while (tx + 1 + n < isl.w && sea(tx + 1 + n, tz)) n++; return tx + 1 + n >= isl.w ? Infinity : n; };
  for (let k = 0; k <= span; k++) {
    for (const tz of k ? [tz0 + k, tz0 - k] : [tz0]) {
      if (tz < 1 || tz >= isl.h - 1) continue;
      for (let tx = isl.w - 2; tx > isl.w / 2; tx--) {
        const t = isl.tileAt(tx, tz);
        if (t === 'sea') continue;
        if (t !== 'sand') break;                         // 동쪽 끝 첫 땅이 모래가 아니면(바위·풀) 다음 줄
        if (seaRun(tx, tz) < pier + 2 || seaRun(tx, tz - 1) < pier || seaRun(tx, tz + 1) < pier) break;
        const c = isl.toWorld(tx, tz);
        return { tx, tz, x: c.x, z: c.z };
      }
    }
  }
  return null;
}

/** 오늘 뱃삯 → { ok, pay: 'free' | 'acorns', price, reason? } (state = state.boat, acorns = 지금 도토리) */
export function fareOf(cfg, state = {}, acorns = 0) {
  const f = cfg.fare ?? {};
  if (f.firstFree && !state.freeUsed) return { ok: true, pay: 'free', price: 0 };
  const price = f.price ?? 0;
  if (f.perDay && state.day === state.today && (state.trips ?? 0) >= f.perDay) return { ok: false, pay: 'acorns', price, reason: 'day' };
  if (acorns < price) return { ok: false, pay: 'acorns', price, reason: 'short' };
  return { ok: true, pay: 'acorns', price };
}

/**
 * 먼바다에 남은 게임 시간 (분). startMs·nowMs = time.now().ms (게임 시계).
 * 시계를 뒤로 돌려 시작보다 앞이 되면 0 (돌아온다) — 날짜는 앞으로만 가니 하루를 넘겨도 그냥 끝.
 */
export function tripLeft(cfg, startMs, nowMs) {
  const total = (cfg.trip?.hours ?? 2) * 60;
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs) || nowMs < startMs) return 0;
  return Math.max(0, total - (nowMs - startMs) / 60000);
}

/** 갑판(타원) 안인가 — 배 기준 좌표 lx(뱃머리 +), lz */
export function onDeck(cfg, lx, lz, pad = 0) {
  const b = cfg.boat;
  return (lx / (b.deckRx + pad)) ** 2 + (lz / (b.deckRz + pad)) ** 2 <= 1;
}

/** 갑판 밖으로 나가려 하면 타원 안쪽 끝으로 (배 기준 좌표). 조타실(뱃머리 쪽 lx > boat.maxX)은 못 들어간다 */
export function clampDeck(cfg, lx, lz, r = 0.2) {
  const rx = Math.max(0.1, cfg.boat.deckRx - r), rz = Math.max(0.1, cfg.boat.deckRz - r);
  const k = (lx / rx) ** 2 + (lz / rz) ** 2;
  const s = k <= 1 ? 1 : 1 / Math.sqrt(k);
  return { x: Math.min(lx * s, cfg.boat.maxX ?? Infinity), z: lz * s };
}

/** 먼바다 물 자리의 서식지: 배 둘레(갑판 + 0.35) 는 null(배 몸), 그 밖 구역 안은 'offshore' */
export function habitatAt(cfg, lx, lz) {
  if (onDeck(cfg, lx, lz, 0.35)) return null;
  const half = (cfg.sea?.size ?? 220) / 2 - 2;
  return Math.abs(lx) < half && Math.abs(lz) < half ? 'offshore' : null;
}

/** 대사 글자 채우기 {fare} {hours} */
export const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m));
