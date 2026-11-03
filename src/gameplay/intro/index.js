// 3차 X3 첫날 흐름: 이름 정하기 → (town) 밤톨 첫 안내 → 첫날 할 일 목록 → 다 하면 밤톨 축하·선물 (town keepers 가 말한다).
// 진행은 이벤트로만 알아챈다 — town:intro · player:tool · sfx(shake·pickup·acorn·catch·bug-catch) · encyclopedia:changed ·
// 상점 창이 열린 동안 wallet:changed(늘어남) · museum:changed · house:enter. 규칙·문구는 rules.js, 화면은 naming.js·checklist.js.
// 상태: state.player.name · state.island.name · state.flags.firstday. 서비스: ctx.services.intro (docs/notes/firstday.md).
// 7차 M7-P5 (D44-A): 막힌 곳 힌트 카드(festival:emote·festival.ask·축제 이벤트를 보고, 규칙은 그대로) · 안내 짧게/건너뛰기 ·
// 섬폰 「💡 안내」(ui.guide.open) — 힌트 글·규칙은 tips.js, 카드·창은 guide.js, 기록은 state.flags.tips (docs/notes/p11-tune.md).
import * as R from './rules.js';
import * as T from './tips.js';
import { el, loadCss } from './dom.js';
import { openNaming } from './naming.js';
import { createChecklist } from './checklist.js';
import { createTipCard, openGuide } from './guide.js';

const TICK = 0.2;          // 안내·화살표 갱신 간격 (초)
const NEAR = 4;            // 이보다 가까우면 화살표를 숨긴다 (칸)
const HIDE_AFTER = 6;      // 선물을 받고 목록을 치우기까지 (초)
const KEEPER = 'bamtol';   // 첫 안내·환영 선물을 주는 가게 주인

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
    // 안내를 '짧게' 고른 새 게임: 밤톨 첫 안내(town keepers introFlow)의 첫 말을 SHORT_INTRO 로 바꾸고, 나머지 말은 바로 넘긴다 ('알겠어요!' = 0)
    const keeperName = () => S().town?.keepers?.find(k => k.slug === KEEPER)?.person?.name ?? '밤톨';
    let shortSaid = false;
    const shortIntro = o => rec().skip === 'short' && !state.flags?.intro && o.speaker === keeperName();
    const dialog = S().ui?.dialog;
    if (dialog?.open && !dialog.namesFilled) {
      const open = dialog.open;
      dialog.open = (opts = {}) => {
        const n = names(), f = t => R.fillNames(t, n);
        const o = { ...opts };
        if (shortIntro(o)) {
          if (shortSaid) return Promise.resolve(0);
          shortSaid = true;
          o.lines = T.SHORT_INTRO;
          delete o.choices;
        }
        if (o.lines != null) o.lines = Array.isArray(o.lines) ? o.lines.map(f) : f(o.lines);
        if (Array.isArray(o.choices)) o.choices = o.choices.map(f);
        if (o.speaker) o.speaker = f(o.speaker);
        return open(o);
      };
      dialog.namesFilled = true;
    }

    // ---- 이름 정하기 ----
    let naming = false, namingFailed = false;
    /** 이름 정하기 창. rename = 이미 정한 이름 바꾸기 (그만두기 단추가 있다) → 정했으면 true */
    async function askNames({ rename = false } = {}) {
      if (naming) return false;
      naming = true;
      refresh();
      let named = false;
      try {
        const r = await openNaming(ctx, { mount: top, initial: { player: state.player.name, island: state.island.name }, again: !!state.flags?.intro, rename });
        if (r) {
          const before = { player: state.player.name, island: state.island.name };
          state.player.name = r.player;
          state.island.name = r.island;
          if (r.guide === 'short') rec().skip = 'short';
          named = true;
          events.emit('intro:named', { player: r.player, island: r.island, ...(rename ? { renamed: true, before } : {}) });
          S().data?.save?.save?.();
          if (rename) toast(`이제 ${r.player}, ${r.island}이에요!`, '🏝️');
        }
      } catch (e) {
        namingFailed = true;
        console.error('[intro] 이름 정하기', e);
      } finally { naming = false; }
      if (!rename && !S().town) complete('intro', { quiet: true });   // town 이 없는 브랜치: 첫 안내 없이 목록부터
      refresh();
      return named;
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
      onSkip: () => askSkip(),
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
        if (id === 'intro' && p.skip === 'short') { skipRest('short'); return; }
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

    /** 건너뛰기: 목록을 치우고 다 마친 것으로 쳐서 밤톨 환영 선물을 받을 수 있게 (할 일 기록 done 은 그대로 — 섬폰 안내엔 한 것만 ✔) */
    function skipRest(why) {
      const p = rec();
      p.skipped = dayKey() ?? true;
      p.hidden = true;
      hideT = -1;
      if (!p.finished) { p.finished = dayKey() ?? true; events.emit('intro:done', { dayKey: p.finished, skipped: true }); }
      events.emit('intro:skip', { why });
      if (!p.rewarded) tip('skipped');
      saveSoon();
      refresh();
    }
    /** 목록 머리 ✕: 다 했으면 그냥 치우고, 아니면 한 번 묻는다 */
    async function askSkip() {
      const p = rec();
      if (p.finished) { p.hidden = true; hideT = -1; saveSoon(); refresh(); if (!p.rewarded) tip('skipped'); return; }
      const ui = S().ui;
      const ok = ui?.confirm ? await ui.confirm({
        title: '첫날 할 일을 건너뛸까요?', icon: '📋', cancelValue: false,
        text: '목록을 치우고, 밤톨에게 바로 환영 선물을 받을 수 있게 해요.\n할 일과 하는 법은 섬폰 💡「안내」에서 다시 볼 수 있어요.',
        buttons: [{ label: '건너뛸래요', value: true, primary: true }, { label: '계속할래요', value: false }],
      }) : true;
      if (ok && !rec().finished) skipRest('list');
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
    events.on('ui:open', ({ panel } = {}) => {
      panels.push(panel);
      if (panel === 'shop') shopOpen = true;
      if (panel === 'emote') conv = {};
      else if (panel !== 'dialog') card.hide();   // 가방·섬폰·확인 창 위에는 띄우지 않는다 (이모티콘 대화·대사 중엔 그대로)
    });
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

    // ---- 힌트 (7차 M7-P5): 막힌 것을 보고 카드로 알려 주고, 본 것은 섬폰 「안내」에 남긴다 ----
    const card = createTipCard(top);
    const tipRec = () => T.tipsOf(state);
    const touch = () => !!ctx.input?.touch;
    const fest = () => S().festival;
    const emoteRule = slug => fest()?.emotes?.rules?.villagers?.[slug]?.rule ?? null;
    const personName = slug => S().town?.villagers?.find(v => v.slug === slug)?.person?.name ?? slug;
    const glyph = key => fest()?.emotes?.glyph?.(key) || key;
    /** 힌트 글의 자리 값: 주민 이름·그 주민의 인사 이모티콘 */
    const varsFor = slug => (slug ? { name: personName(slug), greet: (emoteRule(slug)?.greetFirst ?? ['wave']).map(glyph).join(' · ') } : {});
    let tiers;
    import('../town/rules.js').then(m => { tiers = m.TIERS; }).catch(() => {});
    const heartOf = slug => T.heartProgress(state.villagers?.[slug], fest()?.config?.parts?.open, tiers);
    /** 섬폰·카드에 보일 글 하나 */
    function tipView(id, step, slug) {
      const v = T.tipText(id, step, varsFor(slug), { touch: touch() });
      if (v && id === 'heart' && slug) v.text = T.heartText(personName(slug), heartOf(slug));
      return v;
    }
    let waiting = null;   // 장면·이름 창이 끝나면 띄울 카드
    /** 힌트 하나 띄우기 (id 의 다음 단계가 있을 때만). slug = 주민마다 세는 힌트 */
    function tip(id, slug = null) {
      const shown = T.miss(tipRec(), id, slug);
      if (shown) showTip(shown);
      return !!shown;
    }
    function showTip(shown) {
      T.markSeen(tipRec(), shown, dayKey(), Date.now());
      waiting = tipView(shown.id, shown.step, shown.slug);
      events.emit('intro:tip', { id: shown.id, slug: shown.slug, step: shown.step });
      saveSoon();
      flushTip();
    }
    const storyBusy = () => !!(S().story?.playing || S().story?.queue?.length);
    function flushTip() {
      if (!waiting || naming || storyBusy()) return;
      card.show(waiting);
      waiting = null;
    }
    // 장면이 시작되면 카드를 내렸다가 장면이 끝난 뒤 다시 띄운다 (첫 안내 바로 뒤 s02 처럼 같은 때 오는 것)
    events.on('story:start', () => { if (card.current) { waiting ??= card.current; card.hide(); } });

    // 이모티콘 대화: 주민마다 읽는 법에 걸렸을 때 (두부 '기다리기 먼저' = QA-05 가 가장 크다)
    let conv = {};    // 이번 대화의 { [slug]: { waited, greeted, puzzled } } — 대화 창(emote)이 새로 열리면 비운다
    events.on('festival:emote', ({ slug, keys = [], kind } = {}) => {
      const rule = slug && emoteRule(slug);
      if (!rule) return;
      const c = conv[slug] ?? {};
      const ids = T.missesOf(rule, keys, kind, c);
      conv[slug] = T.nextConv(c, rule, keys, kind);
      if (!ids.length && (kind === 'happy' || kind === 'delight')) { T.solved(tipRec(), slug); return; }
      if (ids.length) tip(ids[0], slug);
    });
    // 친해지기 정도 (QA-13): 🎉 를 보냈는데 아직 마음이 덜 열렸으면 지금 값을 알려 준다 (festival 의 '더 친해지면…' 알림 다음에)
    function afterAsk(V) {
      const F = fest(), f = F?.state, part = F?.config?.parts?.list?.find(x => x.who === V?.slug);
      if (!f?.started || !part || f.parts?.[part.id]) return;
      if (heartOf(V.slug).open) return;
      showTip({ id: 'heart', slug: V.slug, key: T.tipKey('heart', V.slug), step: 0 });
    }
    // 축제 흐름
    events.on('festival:started', () => tip('festival'));
    events.on('festival:ready', () => tip('ready'));
    events.on('festival:start', ({ day } = {}) => { tipRec().last.tonight = day ?? dayKey(); });
    /** 축제 날 저녁: 아직 안 열었으면 한 번 알려 준다 (해마다 축제 날도) */
    function checkTonight() {
      const F = fest(), now = S().time?.now?.();
      if (!F?.due?.() || !now || now.hour < (F.config?.festival?.hour ?? 18)) return;
      const t = tipRec();
      if (t.last.tonight === now.dayKey) return;
      t.last.tonight = now.dayKey;
      delete t.seen.tonight;
      delete t.miss.tonight;
      tip('tonight');
    }

    // ---- 시작 ----
    events.once('game:ready', () => {
      // 저장에서 이어하기: 이미 그런 상태면 조용히 체크
      if (state.flags?.intro) complete('intro', { quiet: true });
      if (S().house?.inside && rec().done.intro) complete('home', { quiet: true });
      if (!state.player.name) askNames();
      // festival.ask 감싸기 (town 대화가 부를 때마다 ctx.services.festival.ask 를 찾으므로 여기서 바꿔 끼우면 된다)
      const F = fest();
      if (F?.ask && !F.askHinted) {
        const ask = F.ask;
        F.ask = async (V, E) => {
          const r = await ask(V, E);
          try { afterAsk(V); } catch (e) { console.error('[intro] 친해지기 힌트', e); }
          return r;
        };
        F.askHinted = true;
      }
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
      const pt = target && !(S().house?.where ?? S().house?.inside) && pl ? placeOf(target) : null;   // 실내(집·주민 방·상점·박물관)에선 섬 방향을 가리키지 않는다
      if (!pt) return list.direction(null);
      const dx = pt.x - pl.x, dz = pt.z - pl.z, dist = Math.hypot(dx, dz);
      if (dist < NEAR) return list.direction(null);
      ctx.camera.getWorldDirection(fwd);
      const l = Math.hypot(fwd.x, fwd.z) || 1, fx = fwd.x / l, fz = fwd.z / l;
      list.direction(Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz), dist);
    }

    /** 지금은 못 하는 단계: 밤에 상점이 닫혔으면 '팔기' 는 미루고 다음 할 일부터 (QA-09) */
    const blocked = (o = hintOpts()) => (o.shopOpen ? [] : ['sell']);
    function refresh() {
      const on = listOn() && !panels.some(n => n !== 'dialog');
      list.show(on);
      root.classList.toggle('fd-touch', !!ctx.input?.touch);
      if (!listOn()) return;
      const o = hintOpts();
      const view = R.viewOf(rec(), { blocked: blocked(o) });
      if (view.ahead && on) tip('night');
      list.render({ ...view, hint: R.hintFor(view.current, o), collapsed: collapsed() && !view.finished });
      arrow(view.current);
    }

    // ---- 섬폰 「💡 안내」 (phone.js APPS 의 'guide' 줄이 ui.guide.open 을 부른다) ----
    async function relisten() {
      const K = S().town?.keepers?.find(k => k.slug === KEEPER);
      let lines = null;
      try { lines = (await import('../town/lines/index.js')).default?.[KEEPER]?.intro; } catch { /* town 이 없는 빌드 */ }
      if (!lines || !S().ui?.dialog) return;
      await S().ui.dialog.open({ speaker: K?.person?.name ?? '밤톨', color: K?.person?.color, voice: KEEPER, lines: touch() ? lines.touch : lines.keys });
    }
    const guideSrc = {
      steps: () => R.STEPS.map(s => ({ id: s.id, icon: s.icon, label: s.label, done: !!rec().done[s.id], hint: R.hintFor(s.id, { touch: touch() }) })),
      listShown: () => listOn(),
      canToggleList: () => !!state.player.name && !!rec().done.intro,
      toggleList() {
        const p = rec();
        p.hidden = !p.hidden;
        if (!p.hidden) { p.collapsed = false; hideT = -1; }
        sfx('menu', { volume: 0.5 });
        saveSoon();
        refresh();
      },
      skipped: () => !!rec().skipped,
      friends() {
        const F = fest();
        if (!F?.state?.started) return null;
        return (F.config?.parts?.list ?? []).map(x => ({ name: personName(x.who), ...heartOf(x.who), part: !!F.state.parts?.[x.id] }));
      },
      tips: () => T.seenList(tipRec()).map(x => tipView(x.id, x.step, x.slug)).filter(Boolean),
      relisten,
    };
    const ui = S().ui;
    if (ui?.panel && !ui.guide) ui.guide = { open: () => openGuide(ctx, guideSrc) };

    ctx.services.intro = {
      /** 이름을 정하기 전 (town 이 밤톨 첫 안내를 미룬다) */
      get holding() { return naming || (!state.player.name && !namingFailed); },
      get naming() { return naming; },
      names,
      fill: text => R.fillNames(text, names()),
      /** 지금 할 일 id ('reward' = 밤톨에게 알려 주기) 또는 null (목록이 없을 때) */
      current: () => (listOn() ? R.viewOf(rec(), { blocked: blocked() }).current : null),
      rewardPending: () => R.rewardPending(rec()),
      reward: { ...R.REWARD },
      claimReward,
      /** 첫날 할 일 건너뛰기 (묻지 않고) */
      skip: () => skipRest('api'),
      /** 힌트: tips() 기록 사본, tip(id, slug) 다음 단계 띄우기, guide() 섬폰 「안내」 창 */
      tips: () => JSON.parse(JSON.stringify(tipRec())),
      tip,
      guide: () => ui?.guide?.open?.(),
      progress: () => ({ ...rec(), done: { ...rec().done } }),
      /** 이름 다시 정하기 (섬폰 설정) → Promise<정했으면 true, 그만두면 false> */
      rename: () => askNames({ rename: !!state.player.name }),
      // 개발용
      complete: id => complete(id),
      reset() { if (state.flags) { delete state.flags.firstday; delete state.flags.tips; } hideT = -1; refresh(); },
    };

    let t = 0;
    I = {
      update(dt) {
        if (saveT >= 0 && (saveT -= dt) < 0) S().data?.save?.save?.();
        if (hideT >= 0 && (hideT -= dt) < 0) { rec().hidden = true; S().data?.save?.save?.(); refresh(); }
        if ((t += dt) >= TICK) { t = 0; refresh(); checkTonight(); flushTip(); }
      },
    };
    console.info(`[intro] 첫날 흐름 준비됨 · ${state.player.name ? `${state.player.name} · ${names().island}` : '이름 정하기 전'} · 할 일 ${R.doneCount(rec())}/${R.STEPS.length}`);
  },

  update(dt) {
    I?.update(dt);
  },
};
