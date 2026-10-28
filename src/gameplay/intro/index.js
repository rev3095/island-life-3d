// 3차 X3 첫날 흐름: 이름 정하기 → (town) 밤톨 첫 안내 → 첫날 할 일 목록 → 다 하면 밤톨 축하·선물 (town keepers 가 말한다).
// 진행은 이벤트로만 알아챈다 — town:intro · player:tool · sfx(shake·pickup·acorn·catch·bug-catch) · encyclopedia:changed ·
// 상점 창이 열린 동안 wallet:changed(늘어남) · museum:changed · house:enter. 규칙·문구는 rules.js, 화면은 naming.js·checklist.js.
// 상태: state.player.name · state.island.name · state.flags.firstday. 서비스: ctx.services.intro (docs/notes/firstday.md).
import * as R from './rules.js';
import { el, loadCss } from './dom.js';
import { openNaming } from './naming.js';
import { createChecklist } from './checklist.js';

const TICK = 0.2;          // 안내·화살표 갱신 간격 (초)
const NEAR = 4;            // 이보다 가까우면 화살표를 숨긴다 (칸)
const HIDE_AFTER = 6;      // 선물을 받고 목록을 치우기까지 (초)

let I = null;

export default {
  name: 'intro',

  async init(ctx) {
    await loadCss();
    const { state, events } = ctx;
    const S = () => ctx.services;
    state.player ??= {};
    state.island ??= {};
    // 목록은 ui 층 밑에 (알림·창이 위로 덮는다), 이름 정하기 창은 맨 위에 (휴대폰 조이스틱보다도 위)
    const root = el('div', { class: `fd-root${ctx.input?.touch ? ' fd-touch' : ''}` });
    const top = el('div', { class: 'fd-root fd-top' });
    ctx.uiRoot.prepend(root);
    ctx.uiRoot.append(top);

    // 예전 저장 (첫 안내는 들었는데 목록 기록이 없음): 한 것으로 보이는 단계는 건너뛰고, 오래 한 저장이면 목록을 띄우지 않는다
    if (state.flags?.intro && !state.flags.firstday) {
      const p = R.progressOf(state), inf = R.inferDone(state);
      p.legacy = true;
      for (const id of inf.done) R.markDone(p, id, null);
      if (inf.veteran || R.allDone(p)) Object.assign(p, { finished: 'legacy', rewarded: true, hidden: true });
    }

    const rec = () => R.progressOf(state);
    const names = () => R.namesOf(state);
    const dayKey = () => S().time?.now?.().dayKey ?? S().data?.day?.key?.() ?? null;
    const toast = (text, icon) => { if (S().ui?.toast) S().ui.toast(text, icon); else events.emit('toast', { text, icon }); };
    const sfx = (name, opts) => events.emit('sfx', { name, ...opts });
    let saveT = -1;
    const saveSoon = () => { saveT = 0.4; };

    // ---- 대사의 {player}·{island} 자리: ui.dialog.open 을 감싸서 채운다 (주민·편지 대사도 이 자리를 쓰면 된다) ----
    const dialog = S().ui?.dialog;
    if (dialog?.open && !dialog.namesFilled) {
      const open = dialog.open;
      dialog.open = (opts = {}) => {
        const n = names(), f = t => R.fillNames(t, n);
        const o = { ...opts };
        if (o.lines != null) o.lines = Array.isArray(o.lines) ? o.lines.map(f) : f(o.lines);
        if (Array.isArray(o.choices)) o.choices = o.choices.map(f);
        if (o.speaker) o.speaker = f(o.speaker);
        return open(o);
      };
      dialog.namesFilled = true;
    }

    // ---- 이름 정하기 ----
    let naming = false, namingFailed = false;
    async function askNames() {
      if (naming) return;
      naming = true;
      refresh();
      try {
        const r = await openNaming(ctx, { mount: top, initial: { player: state.player.name, island: state.island.name }, again: !!state.flags?.intro });
        state.player.name = r.player;
        state.island.name = r.island;
        events.emit('intro:named', { player: r.player, island: r.island });
        S().data?.save?.save?.();
      } catch (e) {
        namingFailed = true;
        console.error('[intro] 이름 정하기', e);
      } finally { naming = false; }
      if (!S().town) complete('intro', { quiet: true });   // town 이 없는 브랜치: 첫 안내 없이 목록부터
      refresh();
    }

    // ---- 목록 ----
    const list = createChecklist(root, {
      onToggle() {
        const p = rec();
        p.collapsed = !collapsed();
        sfx('menu', { volume: 0.5 });
        saveSoon();
        refresh();
      },
    });
    const collapsed = () => rec().collapsed ?? (!!ctx.input?.touch || innerWidth < 640);
    /** 목록을 보일 때: 이름을 정했고, 첫 안내를 들었고, 다 치우지 않았을 때 */
    const listOn = () => !!state.player.name && !naming && !!rec().done.intro && !rec().hidden;
    let hideT = -1;

    /** 단계 하나 끝 (이미 했으면 무시). quiet = 알림 없이 */
    function complete(id, { quiet = false } = {}) {
      const p = rec();
      if (p.hidden) return;
      const shown = listOn();
      if (!R.markDone(p, id, dayKey())) return;
      const s = R.stepOf(id);
      events.emit('intro:step', { id, n: R.doneCount(p), total: R.STEPS.length });
      if (!quiet) {
        if (id === 'intro') { toast('첫날 할 일이 생겼어요! 왼쪽 목록을 봐요', '📋'); sfx('menu', { pitch: 1.2 }); }
        else if (shown) { toast(`${s.label} 완료! (${R.doneCount(p)}/${R.STEPS.length})`, '✅'); sfx('menu', { pitch: 1.3 }); }
      }
      if (R.allDone(p) && !p.finished) {
        p.finished = dayKey() ?? true;
        events.emit('intro:done', { dayKey: p.finished });
        if (!quiet) setTimeout(() => { toast('첫날 할 일을 모두 해냈어요! 밤톨에게 알려 줘요', '🎉'); sfx('fossil'); }, 900);
      }
      saveSoon();
      refresh();
      if (!quiet) requestAnimationFrame(() => list.pop(id));
    }

    /** 밤톨이 선물을 다 준 뒤 (town keepers 가 부른다) */
    function claimReward() {
      const p = rec();
      if (!p.finished || p.rewarded) return false;
      p.rewarded = true;
      events.emit('intro:reward', { ...R.REWARD });
      hideT = HIDE_AFTER;
      S().data?.save?.save?.();
      refresh();
      return true;
    }

    // ---- 진행 알아채기 ----
    let shopOpen = false, acorns = S().data?.wallet?.get?.() ?? state.wallet?.acorns ?? 0;
    const panels = [];
    /** 대화·창 없이 섬 위에서 혼자 한 일인가 (주민 선물·편지·집 안 가구 줍기를 빼려고) */
    const onMyOwn = () => !S().ui?.isBlocking?.() && !S().player?.frozen && !S().house?.inside;
    const itemCat = id => S().data?.items?.get?.(id)?.category;
    events.on('town:intro', ({ done } = {}) => { if (done) complete('intro'); });
    events.on('player:tool', ({ tool } = {}) => { if (tool) complete('tool'); });
    events.on('sfx', ({ name } = {}) => {
      if (name === 'shake') complete('gather');
      else if ((name === 'pickup' || name === 'acorn') && onMyOwn()) complete('gather');
      else if (name === 'catch' || name === 'bug-catch') complete('catch');
    });
    events.on('encyclopedia:changed', ({ id } = {}) => { const c = itemCat(id); if (c === 'fish' || c === 'bug') complete('catch'); });
    events.on('ui:open', ({ panel } = {}) => { panels.push(panel); if (panel === 'shop') shopOpen = true; });
    events.on('ui:close', ({ panel } = {}) => {
      const i = panels.lastIndexOf(panel);
      if (i >= 0) panels.splice(i, 1);
      if (panel === 'shop') shopOpen = false;
    });
    events.on('wallet:changed', ({ acorns: a } = {}) => {
      if (!Number.isFinite(a)) return;
      if (shopOpen && a > acorns) complete('sell');
      acorns = a;
    });
    events.on('museum:changed', ({ id } = {}) => { if (id) complete('donate'); });
    events.on('house:enter', () => complete('home'));

    // ---- 시작 ----
    events.once('game:ready', () => {
      // 저장에서 이어하기: 이미 그런 상태면 조용히 체크
      if (state.flags?.intro) complete('intro', { quiet: true });
      if (S().house?.inside && rec().done.intro) complete('home', { quiet: true });
      if (!state.player.name) askNames();
      refresh();
    });

    // ---- 안내·화살표 ----
    const fwd = new ctx.THREE.Vector3();
    function placeOf(target) {
      const w = S().world, places = w?.places ?? {};
      if (target === 'bamtol' || target === 'reward') return S().town?.keepers?.find(k => k.slug === 'bamtol')?.actor?.position ?? places.shop?.door ?? null;
      if (target === 'shop') return places.shop?.door ?? null;
      if (target === 'museum') return places.museum?.door ?? null;
      if (target === 'home') return places.playerHouse?.door ?? null;
      return null;
    }
    function hintOpts() {
      const d = S().data, slots = d?.inventory?.slots ?? [];
      const hour = S().time?.now?.().hour ?? new Date().getHours();
      return {
        touch: !!ctx.input?.touch,
        shopOpen: d?.economy?.isOpen?.(hour) ?? true,
        canSell: slots.some(s => s && itemCat(s.id) !== 'tool'),
        canDonate: slots.some(s => s && d.museum?.canDonate?.(s.id)),
        inside: !!S().house?.inside,
      };
    }
    function arrow(current) {
      const step = R.stepOf(current);
      const target = current === 'reward' ? 'reward' : step?.target;
      const pl = S().player?.position;
      const pt = target && !S().house?.inside && pl ? placeOf(target) : null;
      if (!pt) return list.direction(null);
      const dx = pt.x - pl.x, dz = pt.z - pl.z, dist = Math.hypot(dx, dz);
      if (dist < NEAR) return list.direction(null);
      ctx.camera.getWorldDirection(fwd);
      const l = Math.hypot(fwd.x, fwd.z) || 1, fx = fwd.x / l, fz = fwd.z / l;
      list.direction(Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz), dist);
    }

    function refresh() {
      const on = listOn() && !panels.some(n => n !== 'dialog');
      list.show(on);
      root.classList.toggle('fd-touch', !!ctx.input?.touch);
      if (!listOn()) return;
      const view = R.viewOf(rec());
      list.render({ ...view, hint: R.hintFor(view.current, hintOpts()), collapsed: collapsed() && !view.finished });
      arrow(view.current);
    }

    ctx.services.intro = {
      /** 이름을 정하기 전 (town 이 밤톨 첫 안내를 미룬다) */
      get holding() { return naming || (!state.player.name && !namingFailed); },
      get naming() { return naming; },
      names,
      fill: text => R.fillNames(text, names()),
      /** 지금 할 일 id ('reward' = 밤톨에게 알려 주기) 또는 null (목록이 없을 때) */
      current: () => (listOn() ? R.viewOf(rec()).current : null),
      rewardPending: () => R.rewardPending(rec()),
      reward: { ...R.REWARD },
      claimReward,
      progress: () => ({ ...rec(), done: { ...rec().done } }),
      // 개발용
      complete: id => complete(id),
      rename: () => askNames(),
      reset() { if (state.flags) delete state.flags.firstday; hideT = -1; refresh(); },
    };

    let t = 0;
    I = {
      update(dt) {
        if (saveT >= 0 && (saveT -= dt) < 0) S().data?.save?.save?.();
        if (hideT >= 0 && (hideT -= dt) < 0) { rec().hidden = true; S().data?.save?.save?.(); refresh(); }
        if ((t += dt) >= TICK) { t = 0; refresh(); }
      },
    };
    console.info(`[intro] 첫날 흐름 준비됨 · ${state.player.name ? `${state.player.name} · ${names().island}` : '이름 정하기 전'} · 할 일 ${R.doneCount(rec())}/${R.STEPS.length}`);
  },

  update(dt) {
    I?.update(dt);
  },
};
