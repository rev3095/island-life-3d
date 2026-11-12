// M13-P2 유성우 · 소원 (13차 보드 D144-A): 맑은 밤 주 1–2번 20–4시 별똥별 (하늘 FX-02 = src/sky/meteors.js, time.meteors.set).
// 하늘을 올려다보고(카메라 LOOK tilt — R/V 키 · 두 손가락 · 오른쪽 끌기) Space → 소원 (주인공 AN-13 'wish'), 하룻밤 cfg.wishesPerNight 번까지.
// 다음 날 아침 바닷가 모래에 별 조각 IC-MA-11 (빈 소원 수만큼, 색 셋 중 — gather drops 라 F 로 줍고 저장된다).
// 그날 아침 달무리(야행성 주민)가 쪽지로 알린다 · 처음 별똥별이 떨어지면 daily:meteor { first } → 장면 s23 (story 트리거 meteor-first).
import * as R from './rules.js';
import { STAR_IDS } from '../../data/daily-items.js';
import { isSpecial } from '../../sky/special.js';   // M18-P2 큰 유성우 밤 (8월·12월 둘째 토요일 — 규칙은 sky/special.js)

export function createMeteor(K) {
  const { ctx, cfg: CFG, S, st, now, seed, toast, emit, count } = K;
  const cfg = CFG.meteor;
  let memo = { day: null, on: false };
  let active = false, hinted = null, lastTilt = 0;

  /** 오늘 밤이 유성우인가 (그 주의 날 + 예보 맑음 — 하루 한 번 계산) */
  function tonight(n = now()) {
    if (!n) return false;
    if (memo.day !== n.dayKey) {
      let fc = null;
      try { fc = S().time?.forecast?.(n.dayKey) ?? null; } catch { fc = null; }
      const big = isSpecial(n.dayKey, 'big-meteor');   // 큰 유성우 밤은 하늘이 17시부터 늘 맑다 (special.js applySpecial)
      memo = { day: n.dayKey, big, on: big || R.meteorTonight(n.dayKey, seed(), cfg, fc) };
    }
    return memo.on;
  }
  /** 오늘 밤이 큰 유성우인가 (M18-P2 D192-A) */
  const bigTonight = (n = now()) => (tonight(n), !!memo.big);
  const bigCfg = () => ({ ...cfg, ...(CFG.bigMeteor ?? {}) });

  const lookTilt = () => S().player?.camera?.look?.tilt ?? 0;
  const wishesTonight = n => (st().wish?.day === n.dayKey ? st().wish.n : 0);

  /** 다음 날 아침: 어젯밤 소원 → 바닷가에 별 조각 */
  function dropStars(n) {
    const s = st(), w = s.wish;
    if (!w || w.dropped || w.day === n.dayKey || !K.onIsland()) return;
    const k = R.starsForWishes(w.n, w.big ? bigCfg() : cfg);   // 큰 유성우 밤의 소원은 별 조각 두 배
    w.dropped = true;
    if (!k) return;
    const cells = R.pickSandCells(K.sandCells(), k, n.dayKey, seed(), 'stars', 3);
    const I = K.isl(), drops = S().gather?.drops;
    const ids = R.starColors(cells.length, n.dayKey, seed(), STAR_IDS);
    cells.forEach((c, i) => { const p = I.toWorld(c.tx, c.tz); drops?.drop?.(ids[i], 1, { x: p.x, z: p.z }, { sound: null }); });
    if (cells.length) { toast(cfg.stars, '🌟'); emit('daily:stars', { n: cells.length, dayKey: n.dayKey }); }
  }

  function sync(n) {
    const open = K.isOpen(n);
    const t = open && tonight(n);
    const s = st();
    if (open) dropStars(n);
    // 그날 아침 예고 (5–20시 사이 처음 볼 때)
    const big = t && bigTonight(n), B = CFG.bigMeteor ?? {};
    if (t && s.notice !== n.dayKey && R.inHours(n.hourF, [5, cfg.hours[0]])) {
      s.notice = n.dayKey;
      const owl = (S().town?.residents?.() ?? []).includes('dalmuri');
      toast(big ? (owl ? B.notice : B.noticeNoOwl) ?? cfg.notice : owl ? cfg.notice : cfg.noticeNoOwl, owl ? '🦉' : '🌠');
      emit('daily:meteor-notice', { dayKey: n.dayKey, owl });
    }
    const on = R.meteorNow(t, n.hourF, cfg, !K.onIsland());
    S().time?.meteors?.set?.(on, { big });
    if (on && !active) {
      // 큰 유성우 밤이 처음이면 장면 s31 (meteor-big) — 그날이 첫 유성우여도 s31 이 소원 빌기까지 알려 주므로 s23 은 건너뛴다
      const bigFirst = big && !s.seen.bigMeteor;
      const first = !s.seen.meteorFirst && !bigFirst;
      if (s.seen.meteor !== n.dayKey) { s.seen.meteor = n.dayKey; toast(big ? B.start ?? cfg.start : cfg.start, '🌠'); }
      s.seen.meteorFirst ??= n.dayKey;
      if (big) s.seen.bigMeteor ??= n.dayKey;
      const p = S().player?.position;
      emit('daily:meteor', { on: true, first, big, bigFirst, dayKey: n.dayKey, x: p?.x ?? 0, z: p?.z ?? 0 });
    } else if (!on && active) emit('daily:meteor', { on: false, dayKey: n.dayKey });
    active = on;
  }

  function canWish() {
    const n = now();
    if (!active || !n || lookTilt() < (cfg.lookTilt ?? 0.45)) return null;
    return n;
  }

  function wish(n = now()) {
    const s = st();
    if (wishesTonight(n) >= (cfg.wishesPerNight ?? 3)) { toast(cfg.full, '🌠'); return false; }
    if (s.wish?.day !== n.dayKey) s.wish = { day: n.dayKey, n: 0, dropped: false, big: bigTonight(n) };
    s.wish.n++;
    const pl = S().player;
    pl?.play?.(pl.hasClip?.('wish') ? 'wish' : 'happy');
    ctx.events.emit('sfx', { name: 'menu', volume: 0.5, pitch: 1.5 });
    const L = cfg.wished;
    toast(L[(s.wish.n - 1) % L.length], '✨');
    count('wish');
    emit('daily:wish', { dayKey: n.dayKey, n: s.wish.n });
    return true;
  }

  function register(gp) {
    gp.add({ name: 'daily:wish', intent: 'action', priority: 103, label: '소원 빌기', test: () => canWish(), run: n => wish(n) });
  }

  function update() {
    if (!active) return;
    const t = lookTilt();
    // 올려다보기 시작하면 하룻밤 한 번 알려 준다
    const n = now();
    if (t > (cfg.lookTilt ?? 0.45) && lastTilt <= (cfg.lookTilt ?? 0.45) && n && hinted !== n.dayKey) { hinted = n.dayKey; toast(cfg.lookHint, '🌠'); }
    lastTilt = t;
  }

  return {
    sync, update, register,
    service: {
      tonight: () => tonight(),
      big: () => bigTonight(),
      get active() { return active; },
      canWish: () => !!canWish(),
      wishes: () => { const n = now(); return n ? wishesTonight(n) : 0; },
      /** 이번 주 유성우 날 (그 주 월요일 기준, 날씨는 안 봄) */
      week: (dayKey = now()?.dayKey) => (dayKey ? R.meteorDaysOfWeek(dayKey, seed(), cfg) : []),
    },
  };
}
