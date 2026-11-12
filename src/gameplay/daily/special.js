// M18-P2 「그날만」 날씨 놀이 (15차 보드 D193-A). 날씨 자체(장마·태풍 비, 첫눈, 큰 유성우 밤 맑음)는 하늘이 정한다 — src/sky/special.js 규칙 → time.special().
// 이 파일은 그날 섬에서 달라지는 것만 맡는다 (설정 daily.json special):
//  - 장마 하루: 아침 알림 · 처음 맞는 장마면 장면 s30 (daily:special { kind: 'monsoon', first }) · 비 오는 날 생물 많이(gather 가 service.rainBoost 를 읽음) · 우산 쓴 주민(town/umbrella.js 가 service.umbrella 를 읽음)
//  - 태풍: 아침 알림 (우산 쓴 주민도). 다음 날 아침 바닷가 모래 칸에 떠밀려 온 것 count 개 (gather drops — F 로 줍고 저장된다)
//  - 첫눈 하루: 아침 알림 → 8시 눈이 오기 시작하면 「첫눈」 알림 · 눈 장식 레시피(rules.json special 'first-snow') 열기 + 눈 결정 셋 · 처음이면 장면 s32
// 열리는 때는 daily 와 같다 (첫날 안내 다음 날부터). 저장 state.daily.special = { day, notice, drop, snow }, 처음 본 것 state.daily.seen.<kind>.
import * as R from './rules.js';
import { specialOf, FIRST_SNOW } from '../../sky/special.js';

const CRYSTAL = 'event.snow-crystal';

export function createSpecial(K) {
  const { ctx, cfg: CFG, S, st, now, seed, toast, emit, give } = K;
  const cfg = CFG.special ?? {};
  let shown = null;   // 확인 창 하나씩

  const today = (n = now()) => (n ? specialOf(n.dayKey) : null);
  const day = n => {
    const s = st();
    if (s.special?.day !== n.dayKey) s.special = { day: n.dayKey, notice: false, drop: false, snow: false };
    return s.special;
  };
  const h24 = n => n.hourF % 24;

  /** 태풍 다음 날 아침: 바닷가 모래 칸에 떠밀려 온 것 */
  function washUp(n, d) {
    if (d.drop || !K.onIsland()) return;
    const c = cfg.afterTyphoon ?? {};
    const cells = R.pickSandCells(K.sandCells(), c.count ?? 14, n.dayKey, seed(), 'typhoon', 1.5);
    if (!cells.length) return;
    d.drop = true;
    const r = R.rngOf('typhoon-drop', n.dayKey, seed());
    const canNote = !!R.nextRecipe(S().data?.recipes?.locked?.() ?? []);
    const table = (c.drops ?? []).filter(x => canNote || !x.note);
    let notes = 0;
    const I = K.isl(), drops = S().gather?.drops;
    for (const cell of cells) {
      let g = R.weighted(table, r);
      if (g?.note && notes++ >= 1) g = table[0];   // 쪽지는 하나만
      if (!g) continue;
      const p = I.toWorld(cell.tx, cell.tz);
      drops?.drop?.(g.item, g.n ?? 1, { x: p.x + (r() - 0.5) * 0.4, z: p.z + (r() - 0.5) * 0.4 }, { sound: null });
    }
    toast(c.notice, '🌊');
    emit('daily:washup', { dayKey: n.dayKey, n: cells.length });
  }

  /** 첫눈: 눈 장식 레시피 열기 + 눈 결정 셋 */
  function firstSnow(n, d) {
    if (d.snow || !K.onIsland() || h24(n) < FIRST_SNOW.from && h24(n) >= 5) return;
    d.snow = true;
    const s = st(), c = cfg.firstSnow ?? {};
    const first = !s.seen.firstSnow;
    s.seen.firstSnow ??= n.dayKey;
    toast(c.start, '❄️');
    const p = S().player?.position;
    emit('daily:special', { kind: 'first-snow', first, dayKey: n.dayKey, x: p?.x ?? 0, z: p?.z ?? 0 });
    const D = S().data, id = c.recipe;
    if (!id || !D?.recipes?.lockedSpecial?.('first-snow')?.includes(id)) return;
    S().daily?.recipes?.unlock?.(id);
    give(CRYSTAL, 3);
    const it = D.items?.get?.(id), rc = D.recipes.get?.(id);
    const needs = (rc?.needs ?? []).map(x => `${D.items.get(x.id)?.name ?? x.id} ${x.n}`).join(' · ');
    const text = (c.recipeText ?? '{name}').replace('{name}', it?.name ?? id).replace('{needs}', needs);
    shown = { title: '❄️ 첫눈 레시피', icon: it?.icon ?? '⛄', text: `${text}\n눈 결정 셋을 주웠어요.` };
  }

  function sync(n) {
    const sp = today(n);
    if (!sp || !K.isOpen(n)) return;
    const d = day(n), s = st(), c = cfg[{ monsoon: 'monsoon', typhoon: 'typhoon', 'after-typhoon': 'afterTyphoon', 'first-snow': 'firstSnow' }[sp.kind]] ?? null;
    if (!c) return;   // big-meteor 는 meteor.js
    // 아침 알림 (태풍 다음 날은 떠밀려 온 것 알림이 대신, 첫눈은 눈이 오기 전에만 — 온 뒤엔 「첫눈」 알림이 대신)
    const late = sp.kind === 'first-snow' && (h24(n) >= FIRST_SNOW.from || h24(n) < 5);
    if (!d.notice && K.onIsland() && sp.kind !== 'after-typhoon' && !late) { d.notice = true; toast(c.notice, sp.emoji); }
    if (sp.kind === 'monsoon' && K.onIsland() && !s.seen.monsoon && h24(n) >= 6 && h24(n) < 20) {
      s.seen.monsoon = n.dayKey;
      const p = S().player?.position;
      emit('daily:special', { kind: 'monsoon', first: true, dayKey: n.dayKey, x: p?.x ?? 0, z: p?.z ?? 0 });
    }
    if (sp.kind === 'after-typhoon') washUp(n, d);
    if (sp.kind === 'first-snow') firstSnow(n, d);
  }

  async function update() {
    if (!shown) return;
    const ui = S().ui;
    if (ui?.isBlocking?.() || S().story?.playing) return;
    const m = shown;
    shown = null;
    ctx.events.emit('sfx', { name: 'bag-open' });
    if (ui?.confirm) await ui.confirm({ ...m, buttons: [{ label: '좋아요', value: true, primary: true }], cancelValue: true });
    else toast(m.text, '⛄');
  }

  return {
    sync, update,
    service: {
      /** 오늘 특별한 날 (time.special 과 같음) */
      today: () => today(),
      /** 장마 하루: 비 오는 날 생물 가중치 배수 (아니면 1) */
      rainBoost: () => (today()?.kind === 'monsoon' ? cfg.monsoon?.rainBoost ?? 3 : 1),
      /** 주민이 우산을 쓰고 나오는 날인가 (장마·태풍) — 날씨가 비일 때만 */
      umbrella: () => !!today()?.heavy && S().time?.weather === 'rain',
    },
  };
}
