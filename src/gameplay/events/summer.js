// 8차 M8-P4 여름 불꽃놀이 EV-02 놀이 (보드 wave8 D77-A · D78-A, 설정 assets/events/events.json 의 EV-02: 8/1–7 · 20–22시 · showAt 20).
// 행사 기간 동안 북쪽 해변 앞 바다에 불꽃 발사대(PR-18)·해변 모래에 행사 간판(PR-23 변형 summer)을 놓고 (저장 안 함),
// 행사 시간에: 간판에서 손 불꽃(IC-EV-02) 받기 하루 하나 → 20시 정각부터 10분 바다 위 불꽃 쇼(FX-01, render/fireworks.js) → 해변에서 1분 넘게 보면 '불꽃 보기'
// → 쇼가 끝난 뒤 간판에서 소원 셋 중 하나 → 도장, 다음 날 아침 「여름밤 풍경」(FU-44)이 들어온다.
// 섬 축제 날은 calendar.hoursOn 이 그날 밤 행사를 쉬게 한다 (섬 축제 먼저, D75-A).
// 자리 고르기 summerSpots 는 순수 함수 — tests/events.test.mjs.
import { giveItem } from '../town/talk.js';
import { createFireworks } from '../../render/fireworks.js';
import { dayHour } from './calendar.js';

export const EV = 'EV-02';
const SPARKLER = 'event.sparkler', CHIME = 'furn.wind-chime';
const SHOW_SECONDS = 600, WATCH_NEED = 60, WATCH_RANGE = 26;
const SEA_Y = -0.17;   // 바다 판 높이 (world/terrain.js SEA_Y)
const LAUNCH_OUT = 6;  // 발사대에서 바다 쪽으로 더 나간 자리에서 쏜다 — 그래야 낮은 카메라의 하늘 띠(바다 수평선 위)에 터진다
export const WISHES = ['내년에도 다 같이 불꽃 보기', '바다에서 큰 물고기 낚기', '섬이 더 예뻐지기'];

/**
 * 해변 자리: 섬 가운데 세로줄 근처(±6칸)에서 **북쪽** 끝 모래 칸을 찾고, 그 앞 바다 3칸에 발사대, 모래 칸에 간판.
 * 북쪽인 까닭: 게임 카메라는 남쪽에서 북쪽을 보므로, 북쪽 바다 위 불꽃이 화면 위쪽에 올라간다 (남쪽 바다면 카메라 뒤).
 * isl = { w, h, tileAt, toWorld } → { sign: {x, z}, raft: {x, z}, beach: {tx, tz} } | null
 */
export function summerSpots(isl) {
  const cx = Math.floor(isl.w / 2);
  let best = null;
  for (let dx = 0; dx <= 6 && !best; dx++) for (const tx of dx ? [cx + dx, cx - dx] : [cx]) {
    for (let tz = 0; tz < isl.h / 2; tz++) {
      const k = isl.tileAt(tx, tz);
      if (k === 'sea') continue;
      if (k === 'sand' && isl.tileAt(tx, tz - 1) === 'sea' && isl.tileAt(tx, tz - 3) === 'sea') best = { tx, tz };
      break;
    }
    if (best) break;
  }
  if (!best) return null;
  const s = isl.toWorld(best.tx, best.tz), r = isl.toWorld(best.tx, best.tz - 3);
  return { beach: best, sign: { x: s.x + 0.8, z: s.z + 0.2 }, raft: { x: r.x, z: r.z - 0.4 } };
}

export function createSummer(ctx, events) {
  const S = () => ctx.services;
  const cfg = events.config.list.find(e => e.id === EV);
  const st = () => (((ctx.state.events ||= {}).summer ||= { watched: {}, wish: null, chimePending: 0 }));
  const fx = createFireworks(ctx);
  let placed = null, watchSec = 0;

  const active = () => events.active().some(r => r.ev.id === EV);
  const live = () => events.isOpen() && events.live().some(r => r.ev.id === EV);
  const hour = () => dayHour(S().time?.now?.().hourF ?? 0);
  const showAt = cfg.showAt ?? 20;
  const inShow = () => live() && hour() >= showAt && hour() < showAt + SHOW_SECONDS / 3600;
  const showOver = () => live() && hour() >= showAt + SHOW_SECONDS / 3600;
  const player = () => S().player?.position;
  const near = (p, q, d) => !!p && !!q && Math.hypot(p.x - q.x, p.z - q.z) < d;
  const toast = (t, icon) => S().ui?.toast?.(t, icon);
  const todo = id => events.todo(EV).find(t => t.id === id);

  function place() {
    const W = S().world;
    if (!W?.objects || placed) return;
    const spots = summerSpots(W.island);
    if (!spots) { console.warn('[events] 여름 불꽃놀이: 남쪽 해변 자리를 못 찾았어요'); return; }
    const ids = [];
    const at = (kind, p, data = {}) => { const t = W.island.toTile(p.x, p.z); ids.push(W.objects.add(kind, t.tx, t.tz, { persist: false, at: { x: p.x, z: p.z, ...(p.y != null ? { y: p.y } : {}) }, ...data })); };
    at('event-raft', { ...spots.raft, y: SEA_Y - 0.05 });
    at('event-sign', spots.sign, { variant: 'summer', rot: 0 });   // 앞면(+Z)이 남쪽 — 해변에 선 사람·카메라 쪽
    placed = { ids: ids.filter(Boolean), spots };
  }
  function clear() {
    if (!placed) return;
    for (const id of placed.ids) S().world?.objects?.remove(id);
    placed = null;
    fx.stop();
  }
  function sync() { if (active()) place(); else clear(); deliver(); }

  // 소원 다음 날 아침 풍경 (가방이 꽉 차 있었으면 다음 날 또)
  function deliver() {
    const s = st();
    if (!s.chimePending || !s.wish || s.wish.day === events.today()) return;
    if (giveItem(ctx, CHIME, 1) === 0) { s.chimePending = 0; toast('우편함에 「여름밤 풍경」이 왔어요. 코코가 보냈대요!', '🎐'); }
  }

  // ---- 쇼: 시계를 따라 켜고 끈다 (도중에 들어오면 지난 만큼 건너뛴다) ----
  function update(dt) {
    if (!placed) return fx.update(dt);
    if (inShow() && !fx.running) {
      const startAt = (hour() - showAt) * 3600;
      const r = placed.spots.raft;
      fx.show({ x: r.x, y: SEA_Y, z: r.z - LAUNCH_OUT }, { seconds: SHOW_SECONDS, seed: Number(events.today().replace(/-/g, '')), startAt });
      toast('🎆 불꽃놀이가 시작됐어요! 해변에서 바다 쪽을 봐요', '🎆');
    }
    if (!inShow() && fx.running) fx.stop();
    fx.update(dt);
    // 해변에서 1분 넘게 보면 '불꽃 보기' (창이 열려 있어도 센다)
    if (fx.running && near(player(), placed.spots.raft, WATCH_RANGE) && !todo('watch')?.done) {
      watchSec += dt;
      if (watchSec >= WATCH_NEED) { watchSec = 0; events.progress(EV, 'watch'); st().watched[events.today()] = true; toast('불꽃을 끝까지 봤어요. 끝나면 간판에서 소원을 빌어요', '✨'); }
    }
  }

  async function wish() {
    const pick = await S().ui?.dialog?.open({ speaker: '행사 간판', lines: ['밤하늘에 소원 하나를 빌어 봐요.'], choices: WISHES });
    if (pick == null || pick < 0) return;
    const s = st();
    s.wish = { day: events.today(), i: pick, text: WISHES[pick] };
    s.chimePending = 1;
    events.progress(EV, 'wish');
    if (events.stamp(EV)) toast(`「${WISHES[pick]}」 — ${cfg.name} 도장을 받았어요! 내일 아침 선물이 와요`, '🎐');
  }

  function register(gp) {
    const atSign = () => { const p = placed?.spots.sign; return events.isOpen() && active() && near(player(), p, 1.4) ? p : null; };
    const sign = {
      intent: 'action',
      label: () => (canWish() ? '소원 빌기' : live() && !todo('sparkler')?.done ? '손 불꽃 받기' : '행사 안내'),
      run() {
        if (canWish()) return wish();
        if (live() && !todo('sparkler')?.done) {
          if (giveItem(ctx, SPARKLER, 1) === 0) { events.progress(EV, 'sparkler'); toast('코코가 두고 간 손 불꽃이에요. 오늘 밤 하나!', '🎇'); }
          return;
        }
        const lines = [`🎆 ${cfg.name} — 저녁 ${cfg.hours[0]}시부터 해변에서. ${showAt}시 정각에 바다 위로 불꽃이 올라가요 (10분).`];
        if (!live()) lines.push('지금은 행사 시간이 아니에요.');
        else if (!todo('watch')?.done) lines.push('불꽃을 해변에서 1분 넘게 보고 나면 여기서 소원을 빌 수 있어요.');
        else if (todo('wish')?.done) lines.push('소원을 빌었어요. 내일 아침 선물을 기다려요!');
        S().ui?.dialog?.open({ speaker: '행사 간판', lines });
      },
    };
    // 할 수 있는 행사 행동은 101 로 한 번 더 — 말 걸기(100)보다 먼저 (7차 D56-A 축제 시작과 같은 까닭: 주인공 주민이 자리 옆에 서 있으면 Space 가 말 걸기로 갔다, M8-P8)
    gp.add({ ...sign, name: 'events:summer-sign-do', priority: 101, test: () => (canWish() || (live() && !todo('sparkler')?.done) ? atSign() : null) });
    gp.add({ ...sign, name: 'events:summer-sign', priority: 96, test: atSign });
  }
  const canWish = () => live() && todo('watch')?.done && !todo('wish')?.done && !fx.running;

  ctx.events.on('time:newday', () => { clear(); sync(); });
  ctx.events.on('data:loaded', deliver);
  ctx.events.on('festival:end', sync);
  events.spot?.(EV, () => placed?.spots.sign ?? null);
  sync();

  return { register, update, sync, debug: { fx, get placed() { return placed; }, place, clear, inShow, showOver, get watchSec() { return watchSec; } } };
}
