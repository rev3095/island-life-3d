// 10차 M10-P5 별 망원경 (FU-53 star-telescope, 보드 wave10 D98-A): 섬에 놓은 별 망원경 앞에서 행동 키(Space·A)를 누르면
//   밤(19:00–05:00)엔 시점 올려다보기(player.camera.setLook — R/V 키와 같은 LOOK)를 몇 초 붙잡아 하늘을 보여 주고 "별이 반짝여요",
//   낮엔 짧은 안내만. 아무 키나 누르거나 걸으면 바로 끝나고, 놓으면 LOOK.back 대로 원래 시점으로 돌아온다.
// 섬 꾸미기 하위 모듈이 아니라 gameplay/index.js PARTS 의 한 줄로 불린다 (decor/index.js 는 고치지 않음).
// 실내(집 안 가구로 놓은 망원경)는 house 의 「살피기」가 맡는다 — 여기는 섬에 놓은 것(world 물체 'fu:star-telescope')만.
import { FURN_KIND } from '../../world/variants.js';
import { dirOfFacing } from './rules.js';

export const TELESCOPE_KIND = FURN_KIND + 'star-telescope';
/** 별을 볼 수 있는 시각 (게임 시각 0~24): 19시부터 다음 날 5시 전까지 */
export const NIGHT = { from: 19, to: 5 };
/** 올려다보는 시간 (초) */
export const LOOK_SECONDS = 6;

/** 시각(0~24) → 별을 볼 수 있는 밤인가 (순수 함수, 테스트용) */
export const isStarTime = hourF => Number.isFinite(hourF) && (hourF >= NIGHT.from || hourF < NIGHT.to);

const S = { ctx: null, view: null };   // view = { left: 남은 초, fresh: 이번 프레임에 시작함 }

/** 플레이어 앞(바라보는 칸)이나 바로 옆의 섬 별 망원경 → 물체 | null */
function telescopeInFront(ctx) {
  const sv = ctx.services, player = sv.player, objs = sv.world?.objects;
  if (!player?.position || !objs?.query) return null;
  if (sv.house?.inside || Math.abs(player.position.x) > 200) return null;   // 실내는 x 500– (집·주민 방·상점·박물관)
  if (sv.decor?.active) return null;                                        // 섬 꾸미기 중엔 놓기·고치기가 먼저
  const [dx, dz] = dirOfFacing(player.facing ?? 0);
  const p = player.position;
  const hits = objs.query(p.x + dx * 0.9, p.z + dz * 0.9, 0.75).filter(o => o.kind === TELESCOPE_KIND);
  return hits[0] ?? null;
}

function stop() {
  if (!S.view) return;
  S.view = null;
  S.ctx?.services.player?.camera?.setLook?.(0, 0);   // 목표를 0 으로 — 부드럽게 돌아온다
}

function start(ctx) {
  const sv = ctx.services, hourF = sv.time?.now?.().hourF;
  const toast = (t, icon) => sv.ui?.toast?.(t, icon);
  if (!isStarTime(hourF)) {
    toast('해가 지면 별을 볼 수 있어요. 저녁 7시부터예요', '🔭');
    return;
  }
  S.view = { left: LOOK_SECONDS, fresh: true };
  sv.player?.camera?.setLook?.(1, 0);
  toast('별이 반짝여요 ✨', '🔭');
  ctx.events.emit('sfx', { name: 'menu', volume: 0.4 });
}

export default {
  name: 'telescope',
  async init(ctx) {
    S.ctx = ctx;
    ctx.services.gameplay?.interactions?.add({
      name: 'decor:telescope', intent: 'action', priority: 85,   // 문(90)보다 아래, 실내 가구(80)보다 위 — 섬에서만 맞는다
      label: () => (S.view ? '그만 보기' : '별 보기'),
      test: () => (S.view ? 'stop' : telescopeInFront(ctx)),
      run: target => (target === 'stop' ? stop() : start(ctx)),
    });
    // 다른 키(줍기 등)를 눌러도 끝난다. 방금 시작한 그 누름은 건너뛴다
    ctx.events.on('input:press', () => { if (S.view && !S.view.fresh) stop(); });
    ctx.services.telescope = { get viewing() { return !!S.view; }, stop, isStarTime };
  },
  update(dt, ctx) {
    const v = S.view;
    if (!v) return;
    v.fresh = false;
    const sv = ctx.services, m = ctx.input?.move;
    if (sv.ui?.isBlocking?.() || (m && Math.hypot(m.x, m.z) > 0.2) || !isStarTime(sv.time?.now?.().hourF)) { stop(); return; }
    if ((v.left -= dt) <= 0) { stop(); return; }
    sv.player?.camera?.setLook?.(1, 0);   // LOOK.back 'release' 가 매 프레임 되돌리니 볼 동안은 목표를 계속 끝까지
  },
};
