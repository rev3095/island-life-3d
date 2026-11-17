// M19-P4 등대 다시 켜기 (16차 검수 보드 wave16 https://claude.ai/artifact/7vq1nQedDmmGB45RJGxTNU, D203-A · D206-A). 노트 docs/notes/m19-p4-lighthouse.md
// 설정 assets/lighthouse/lighthouse.json · 규칙(순수) rules.js · 진행판 UI-37 ui.js · 밤 빛 띠 beam.js.
//
// 서쪽 등대 (west-lighthouse D270–D274): 자리는 섬 서쪽 끝 바닷가 곶 (site v2 — 예전 북쪽 자리 저장은 자리만 다시 고르고 단계는 그대로, R.siteFor).
// 등대 앞에 등대지기 윤슬 CH-20 (keeper.js) — 말 걸면 지금 단계 · 재료(가방에 있는 수) · 도토리를 알려 주고, 다 모이면 재료 + 도토리(stages[].acorns)를 받아 단계를 진행.
// 처음 가까이 오면 s66 (lighthouse:scene kind 'keeper'). 불 켜는 밤 s60 뒤 등대지기 한마디 s67 (kind 'lit-keeper').
// (예전 M19-P4 설명) 섬 북쪽 바위 끝(lighthouse.json site — layout 비율 자리에서 가까운 빈 모래·풀밭)에 옛 등대 BD-18 이 늘 서 있다 (게임이 열리고 game:ready 뒤에 놓음 —
// 모델은 처음에 받지 않는 daily 묶음). 엔딩(첫 섬 축제) 다음 날부터 구름이 섬에 살면, 섬에 나와 있는 낮(9–18시)에 s54 「구름의 옛 그림」 → 시작.
// 단계 다섯 (길 내기 · 계단 고치기 · 렌즈 닦기 · 별 조각 등불 · 불 켜는 밤) — 단계마다 재료 + 주민 둘 도움(그 주민 앞에서 행동 키 「등대 부탁」) →
// 등대 앞 Space → 재료를 내고 장면(s55–s59). 다음 단계는 그 단계를 끝낸 날부터 7일 뒤(time.now 의 dayKey). 다섯째 뒤 밤(19–4시)에 등대 앞 Space →
// 불 켜는 밤 s60 (섬 사람 모두 + 밤 상인들) → 다음 날 아침 7시 뒤 s61. 켠 뒤엔 밤마다 빛 띠가 돈다 (beam.js — 높음·적정 셰이더, 낮음·매우 낮음 판).
// 등대 모델·단계 소품 PR-41–44·돌길은 world.objects persist:false 로 놓고, 무엇을 놓을지는 저장된 state.lighthouse 로 정한다 (불러오면 그 단계 모습).
//
// 행동 키: 'lighthouse:ask' 101 (단계 할 일 중 돕는 주민 앞 — 말 걸기 100 보다 먼저, 행사 할 일 101 과 같은 값: 행사 주인공과 겹치면 먼저 더한 쪽)
//          'lighthouse:site' 98 (등대 앞 1.6칸 — 말 걸기 100 아래, 행사 간판 96 위. 주민은 등대 앞 2.6칸에 서지 않는다 town keepClear)
// 상태 ctx.state.lighthouse (주인: gameplay/lighthouse) — rules.js 맨 위 모양.
// 이벤트 (보냄): lighthouse:start { host, dayKey } · lighthouse:help { slug, stage } · lighthouse:stage { id, n, dayKey } · lighthouse:lit { dayKey }
//               lighthouse:scene { kind: 'start'|<단계 id>|'lit'|'morning', x, z } (story 트리거 'lighthouse')
// 서비스 ctx.services.lighthouse = { config, state(), phase(), view(), site(), clearSpots(), debug }
import * as R from './rules.js';
import { createProgressBox } from './ui.js';
import { createBeam } from './beam.js';
import { createKeeper } from './keeper.js';
import { LINES } from '../town/people.js';

export const CONFIG_FILE = 'assets/lighthouse/lighthouse.json';
const NEAR = 1.6;            // 등대 앞 행동 거리
const TALK_DIST = 1.3;       // 돕는 주민 앞 (town 말 걸기와 같은 값)
const CLEAR = 2.6;           // 주민이 서지 않는 등대 앞 둘레
const IGNORE = /^(shell|weed|flower-|tulip|cosmos|pansy)/;   // 등대 자리에 있어도 되는 것 (놓을 때 치운다)

export function createLighthouse(ctx, cfg) {
  const S = () => ctx.services;
  const st = () => (ctx.state.lighthouse = R.normalize(ctx.state.lighthouse));
  let ST = st();
  const now = () => S().time?.now?.() ?? null;
  const toast = (t, icon) => S().ui?.toast?.(t, icon ?? '🗼');
  const world = () => S().world;
  const residents = () => { try { return S().town?.residents?.() ?? []; } catch { return []; } };
  const villager = slug => S().town?.villagers?.find?.(v => v.slug === slug) ?? null;
  const nameOf = slug => villager(slug)?.person?.name ?? slug;
  const getItem = id => S().data?.items?.get?.(id) ?? null;
  const slots = () => S().data?.inventory?.slots ?? ctx.state.inventory ?? [];
  const acorns = () => S().data?.wallet?.get?.() ?? 0;
  const K = cfg.keeper ?? null;
  const KL = (K && LINES[K.slug]) || {};
  const kpick = k => { const l = KL[k]; return Array.isArray(l) ? l[Math.floor(Math.random() * l.length)] : l; };
  const kline = (k, v) => [kpick(k)].flat().filter(Boolean).map(x => R.fill(x, v));
  const inTour = () => !!S().tour?.active;
  const outdoors = () => {
    const p = S().player?.position;
    return !!p && Math.abs(p.x) < 200 && Math.abs(p.z) < 200 && !S().house?.where && !S().house?.inside && !inTour();
  };
  const busy = () => !!S().ui?.isBlocking?.() || !!S().story?.playing || !!ctx.paused;

  // ── 자리 · 모델 ──
  let site = null;            // { tx, tz, x, z, front, door }
  const placed = { main: null, mainKind: null, props: new Map(), path: [] };
  function query() {
    const W = world(), I = W?.island;
    if (!I || !W.objects) return null;
    const isFree = (tx, tz) => (W.objects.on?.(tx, tz) ?? [W.objects.at(tx, tz)].filter(Boolean)).every(o => o && IGNORE.test(o.kind));
    return { w: I.w, h: I.h, tileAt: I.tileAt, levelAt: I.levelAt, toWorld: I.toWorld, toTile: I.toTile, isFree };
  }
  function findSite() {
    if (site) return site;
    const q = query();
    if (!q) return null;
    const s = R.siteFor(cfg, ST) ?? R.siteSpot(cfg, q);
    if (!s) { console.warn('[lighthouse] 등대 자리를 못 찾았어요'); return null; }
    ST.site = { tx: s.tx, tz: s.tz };
    ST.siteV = cfg.site?.v ?? 1;
    site = { ...ST.site, ...R.siteWorld(ST.site, q.toWorld) };
    // 몸통·소품 칸의 조개·잡초·꽃은 치운다 (등대 밑에 묻히지 않게)
    const W = world();
    for (let dz = -1; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      for (const o of W.objects.on?.(s.tx + dx, s.tz + dz) ?? []) if (o?.id && IGNORE.test(o.kind) && !String(o.id).startsWith('lighthouse')) W.objects.remove(o.id);
    }
    // 장면 자리 'lighthouse' (story PLACES) — 문(앞 일하는 자리)을 기준으로
    if (W.places) W.places.lighthouse = { x: site.x, z: site.z, door: { ...site.front } };
    if (K) site.keeper = R.keeperSpot(K, ST.site, site, q);
    return site;
  }
  function addObj(kind, x, z) {
    const W = world(), q = query();
    const t = q.toTile(x, z);
    return W.objects.add(kind, t.tx, t.tz, { persist: false, at: { x, z }, rot: 0, id: `lighthouse:${kind}` });
  }
  /** 지금 단계 모습으로 등대·소품·돌길을 맞춘다 (바뀐 것만) */
  function refresh() {
    if (!ready || inTour() || !world()?.objects) return;
    const s = findSite();
    if (!s) return;
    const W = world();
    const kind = cfg.models[R.lookOf(ST)];
    if (placed.mainKind !== kind) {
      if (placed.main) W.objects.remove(placed.main);
      placed.main = addObj(kind, s.x, s.z);
      placed.mainKind = kind;
    }
    const want = new Map(R.propsOf(cfg, ST).map(p => [p.env, p]));
    for (const [env, id] of placed.props) if (!want.has(env)) { W.objects.remove(id); placed.props.delete(env); }
    for (const [env, p] of want) if (!placed.props.has(env)) { const id = addObj(env, s.x + p.at[0], s.z + p.at[1]); if (id) placed.props.set(env, id); }
    const P = cfg.path;
    if (P && ST.stage >= (P.from ?? 1) && !placed.path.length) {
      const q = query();
      const strict = { ...q, isFree: (tx, tz) => !(W.objects.on?.(tx, tz) ?? []).length && !W.objects.at(tx, tz) };
      for (const t of R.pathTiles(ST.site, strict, P.tiles ?? 6)) {
        const id = W.objects.add(P.env ?? 'path-stone', t.tx, t.tz, { persist: false, id: `lighthouse:path@${t.tx},${t.tz}` });
        if (id) placed.path.push(id);
      }
    }
    beamAt();
    if (keeper && s.keeper && keeper.spot !== s.keeper) keeper.show(s.keeper);
  }

  // ── 빛 띠 ──
  let beam = null;
  function beamAt() {
    if (!site) return;
    const y = (world()?.island?.heightAt?.(site.x, site.z) ?? 0) + (cfg.lamp?.height ?? 3.8);
    const at = { x: site.x, y, z: site.z };
    if (!beam) beam = createBeam(ctx, at, cfg.lamp);
    else beam.move(at);
  }
  function beamUpdate(dt) {
    if (!beam) return;
    const n = now();
    const on = !!ST.lit && !!n && !inTour() && !S().house?.inside && !S().house?.where;
    beam.set(on ? R.beamLevel(cfg, n.hourF) : 0);
    beam.update(dt, ctx.camera);
  }

  // ── 진행판 UI-37 ──
  const box = createProgressBox(ctx.uiRoot);
  const helperRows = (stage, helpers) => helpers.map(slug => ({ text: `${nameOf(slug)} 도움`, ok: !!ST.helped[slug] }));
  function view() {
    const n = now();
    const ph = R.phase(cfg, ST, n?.dayKey);
    if (ph === 'closed' || ph === 'done') return null;
    const stages = cfg.stages.map((s, i) => ({ name: s.name, emoji: s.emoji, state: i < ST.stage ? 'done' : i === ST.stage && ph !== 'lit' ? 'now' : 'todo' }));
    const s = R.stageNow(cfg, ST);
    if (ph === 'wait') {
      const left = R.daysLeft(cfg, ST, n.dayKey), od = R.openDay(cfg, ST);
      return { stages, line: `${s.n}단계 ${s.emoji} ${s.name} — ${left}일 뒤 (${R.md(od)})`, rows: [] };
    }
    if (ph === 'work') {
      const helpers = R.helpersOf(s, residents());
      const rows = R.needsOf(s, slots(), getItem).map(r => ({ text: r.label, n: `${r.have}/${r.n}`, ok: r.ok }));
      if (R.acornsOf(s)) { const a = R.acornRow(s, acorns()); rows.push({ text: '🌰 도토리', n: `${Math.min(a.have, a.n).toLocaleString()}/${a.n.toLocaleString()}`, ok: a.ok }); }
      rows.push(...helperRows(s, helpers));
      if (rows.every(r => r.ok)) rows.push({ text: K ? `등대지기 ${K.name}에게 건네기` : '등대 앞에서 시작하기', ok: false });
      return { stages, line: `${s.n}단계 ${s.emoji} ${s.name} — ${s.goal}`, rows };
    }
    if (ph === 'night') return { stages, line: '🗼 불 켜는 밤 — 밤(19시 뒤)에 등대 앞에서', rows: [{ text: '섬 사람들이 등대 앞에 모여요', ok: true }] };
    if (ph === 'lit') return { stages, line: '등대에 불이 켜졌어요!', rows: [] };
    return null;
  }

  // ── 시작 · 아침 (조건이 맞고 한가할 때) ──
  function tryStart(n) {
    if (ST.started || !n || busy() || !outdoors() || !site) return;
    if (!R.inRange(cfg.open?.hours ?? [9, 18], n.hourF)) return;
    if (S().festival?.due?.()) return;
    const host = R.startHost(cfg, { endedDay: ctx.state.festival?.endedDay, dayKey: n.dayKey, residents: residents() });
    if (!host) return;
    ST.started = n.dayKey;
    ctx.events.emit('lighthouse:start', { host, dayKey: n.dayKey });
    ctx.events.emit('lighthouse:scene', { kind: 'start', host, x: site.front.x, z: site.front.z });
    toast(cfg.lines.begin);
  }
  function tryMorning(n) {
    if (!ST.lit || ST.morning || !n || busy() || !outdoors() || !site) return;
    if (R.daysBetween(ST.lit, n.dayKey) < 1 || n.hourF < 7) return;
    ST.morning = n.dayKey;
    ctx.events.emit('lighthouse:scene', { kind: 'morning', x: site.front.x, z: site.front.z });
  }
  let toldOpen = null;
  function tellOpen(n) {
    if (R.phase(cfg, ST, n.dayKey) !== 'work' || toldOpen === `${ST.stage}:${n.dayKey}` || !outdoors() || busy()) return;
    const od = R.openDay(cfg, ST);
    toldOpen = `${ST.stage}:${n.dayKey}`;
    if (ST.stage > 0 && od === n.dayKey) toast(R.fill(cfg.lines.openNow, { stage: R.stageNow(cfg, ST).name }));
  }

  // ── 등대 앞 ──
  function siteInFront() {
    const s = site, pl = S().player, p = pl?.position;
    if (!s || !p || !outdoors()) return null;
    const df = Math.hypot(s.front.x - p.x, s.front.z - p.z);
    const dc = Math.hypot(s.x - p.x, s.z - p.z);
    if (df > NEAR && dc > 1.9) return null;
    const dx = s.x - p.x, dz = s.z - p.z;
    return df < 0.7 || (dx * -Math.sin(pl.facing) + dz * -Math.cos(pl.facing)) / Math.max(1e-4, dc) > 0.3 ? s : null;
  }
  const dialog = (lines, choices) => S().ui.dialog.open({ speaker: '옛 등대', color: '#3F7FC9', lines: [lines].flat().filter(Boolean), choices });
  const ksay = (lines, choices) => S().ui.dialog.open({ speaker: K.name, color: K.color, voice: K.voice, lines: [lines].flat().filter(Boolean), choices });
  const needText = r => `${r.acorn ? '🌰 ' : ''}${r.label} ${r.acorn ? `${Math.min(r.have, r.n).toLocaleString()}/${r.n.toLocaleString()}` : `${r.have}/${r.n}`}${r.ok ? ' ✓' : ''}`;

  /** 등대지기 말 걸기: 지금 단계 · 필요한 재료와 개수 · 가방에 있는 수 · 도토리 → 다 모이면 건네기 (D272-A · D273-A) */
  async function keeperTalk() {
    const n = now();
    if (!n || !K) return;
    keeper?.lookAtPlayer();
    if (!ST.keeperMet) { ST.keeperMet = n.dayKey; await ksay(kline('first')); }
    const ph = R.phase(cfg, ST, n.dayKey), s = R.stageNow(cfg, ST), L = cfg.lines;
    if (ph === 'closed') { await ksay([...kline('greet'), ...kline('closed')]); return; }
    if (ph === 'lit' || ph === 'done') { await ksay(kline('lit')); return; }
    if (ph === 'wait') {
      const od = R.openDay(cfg, ST);
      await ksay([...kline('stage', { item: `${s.n}단계 ${s.emoji} ${s.name}` }), ...kline('wait', { n: R.daysLeft(cfg, ST, n.dayKey) }), `(${R.md(od)}부터)`]);
      return;
    }
    if (ph === 'night') {
      if (!R.isNight(cfg, n.hourF)) { await ksay(kline('night')); return; }
      if ((await ksay(L.lightAsk, [L.light, L.later])) !== 0) return;
      lightUp(n);
      return;
    }
    const res = R.canFinish(cfg, ST, n.dayKey, { slots: slots(), getItem, residents: residents(), acorns: acorns() });
    const rows = [...(res.rows ?? R.needsOf(s, slots(), getItem))];
    if (R.acornsOf(s)) rows.push(res.acorn ?? R.acornRow(s, acorns()));
    const helpers = res.helpers ?? R.helpersOf(s, residents());
    const lines = [...kline('stage', { item: `${s.n}단계 ${s.emoji} ${s.name}` }), `${s.goal}`,
      ...kline('needs'), rows.map(needText).join(' · ')];
    const missing = res.short ?? R.shortOf(rows);
    if (missing.length) lines.push(...kline('short', { n: missing.length }), `모자란 것: ${missing.map(m => `${m.acorn ? '🌰 ' : ''}${m.label} ${m.short.toLocaleString()}개`).join(' · ')}`);
    if (helpers.length) {
      lines.push(R.fill(L.helpWanted, { helpers: helpers.map(h => `${nameOf(h)}${ST.helped[h] ? ' ✓' : ''}`).join(' · ') }));
      if (!R.helpedAll(ST, helpers)) lines.push(...kline('helpers'));
    }
    if (!res.ok) { await ksay([...lines, ...kline('bye')]); return; }
    const pick = await ksay([...lines, ...kline('ready')], [kpick('give') ?? '건네기', kpick('later') ?? L.later]);
    if (pick !== 0) return;
    if (finish(n)) await ksay(kline('thanks'));
  }

  async function atSite() {
    if (K) { await keeperTalk(); return; }   // 서쪽 등대: 등대 앞 Space 도 등대지기와 같은 이야기
    const n = now();
    if (!n) return;
    const ph = R.phase(cfg, ST, n.dayKey), s = R.stageNow(cfg, ST), L = cfg.lines;
    if (ph === 'closed') { await dialog(L.look); return; }
    if (ph === 'lit' || ph === 'done') { await dialog(L.lit); return; }
    if (ph === 'wait') {
      const od = R.openDay(cfg, ST);
      await dialog([`${s.n}단계 ${s.emoji} ${s.name} — ${s.goal}`, R.fill(L.wait, { days: R.daysLeft(cfg, ST, n.dayKey), date: R.md(od) })]);
      return;
    }
    if (ph === 'night') {
      if (!R.isNight(cfg, n.hourF)) { await dialog(L.night); return; }
      if ((await dialog(L.lightAsk, [L.light, L.later])) !== 0) return;
      lightUp(n);
      return;
    }
    // work
    const res = R.canFinish(cfg, ST, n.dayKey, { slots: slots(), getItem, residents: residents() });
    const rows = res.rows ?? R.needsOf(s, slots(), getItem);
    const helpers = res.helpers ?? R.helpersOf(s, residents());
    const lines = [`${s.n}단계 ${s.emoji} ${s.name} — ${s.goal}`,
      `${R.fill(L.need, { stage: s.name })}: ${rows.map(r => `${r.label} ${r.have}/${r.n}${r.ok ? ' ✓' : ''}`).join(' · ')}`,
      R.fill(L.helpWanted, { helpers: helpers.map(h => `${nameOf(h)}${ST.helped[h] ? ' ✓' : ''}`).join(' · ') || '—' })];
    if (!res.ok) { await dialog(lines); return; }
    const pick = await dialog([...lines, R.fill(L.allReady, { helpers: helpers.map(nameOf).join(', ') })], [L.start, L.later]);
    if (pick !== 0) return;
    finish(n);
  }

  function finish(n) {
    const s = R.stageNow(cfg, ST);
    const plan = R.takePlan(s, slots(), getItem);
    if (!plan) { toast('재료가 모자라요'); return false; }
    const cost = R.acornsOf(s), wallet = S().data?.wallet;
    if (cost && !(wallet?.spend?.(cost))) { toast('도토리가 모자라요', '🌰'); return false; }
    const inv = S().data?.inventory;
    for (const { id, n: k } of plan) inv?.removeId?.(id, k);
    const done = R.finishStage(cfg, ST, n.dayKey);
    ctx.events.emit('sfx', { name: 'acorn' });
    ctx.events.emit('lighthouse:stage', { id: done.id, n: done.n, dayKey: n.dayKey });
    ctx.events.emit('lighthouse:scene', { kind: done.id, x: site.front.x, z: site.front.z });
    refresh();
    if (ST.stage < cfg.stages.length) {
      const next = R.stageNow(cfg, ST);
      setTimeout(() => toast(R.fill(cfg.lines.next, { stage: next.name, days: cfg.gapDays ?? 7 })), 400);
    } else setTimeout(() => toast(cfg.lines.night), 400);
    return true;
  }
  function lightUp(n) {
    if (!R.light(ST, n.dayKey)) return;
    ctx.events.emit('sfx', { name: 'acorn' });
    ctx.events.emit('lighthouse:lit', { dayKey: n.dayKey });
    ctx.events.emit('lighthouse:scene', { kind: 'lit', x: site.front.x, z: site.front.z });
    refresh();
    if (K) litKeeper = true;   // s60 이 끝나면 등대지기 한마디 s67
  }
  let litKeeper = false;
  ctx.events.on('story:end', () => {
    if (!litKeeper || !site) return;
    litKeeper = false;
    setTimeout(() => ctx.events.emit('lighthouse:scene', { kind: 'lit-keeper', x: site.front.x, z: site.front.z }), 300);
  });

  // ── 등대지기 ──
  const keeper = K ? createKeeper(ctx, K, {
    onTalk: () => keeperTalk(),
    onFirst: () => {
      ST.keeperMet = now()?.dayKey ?? 'met';
      ctx.events.emit('lighthouse:scene', { kind: 'keeper', x: site.front.x, z: site.front.z });
    },
  }) : null;

  // ── 돕는 주민 앞 ──
  function helperInFront() {
    const n = now();
    if (!n || R.phase(cfg, ST, n.dayKey) !== 'work' || !outdoors()) return null;
    const helpers = R.helpersOf(R.stageNow(cfg, ST), residents()).filter(h => !ST.helped[h]);
    if (!helpers.length) return null;
    const pl = S().player, p = pl.position, fx = -Math.sin(pl.facing), fz = -Math.cos(pl.facing);
    let best = null, bestScore = Infinity;
    for (const slug of helpers) {
      const V = villager(slug);
      if (!V?.talkable) continue;
      const q = V.actor.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > TALK_DIST || Math.abs(q.y - p.y) > 0.6) continue;
      const dot = d > 1e-4 ? (dx * fx + dz * fz) / d : 1;
      if (d > 0.8 && dot < 0.35) continue;
      const score = d - dot * 0.4;
      if (score < bestScore) { best = V; bestScore = score; }
    }
    return best;
  }
  async function askHelper(V) {
    const s = R.stageNow(cfg, ST), P = V.person ?? {};
    const lines = s.ask?.[V.slug] ?? cfg.lines.askGeneric;
    const talk = async () => {
      await S().ui.dialog.open({ speaker: P.name ?? V.slug, color: P.color, voice: P.voice ?? V.slug, lines });
      ST.helped[V.slug] = true;
      const n = Object.keys(ST.helped).length;
      toast(R.fill(cfg.lines.helped, { name: P.name ?? V.slug, josa: R.josa(P.name ?? V.slug, '가'), n }), '🤝');
      try { S().town?.befriend?.(V.slug, 2); } catch { /* 친밀도는 덤 */ }
      ctx.events.emit('lighthouse:help', { slug: V.slug, stage: s.id });
    };
    const conv = S().town?.debug?.town?.conversation;
    if (conv) await conv(V, talk); else await talk();
  }

  function register(gp) {
    keeper?.register(gp, outdoors, () => `${K.name}에게 말 걸기`);
    gp.add({ name: 'lighthouse:ask', intent: 'action', priority: 101, label: () => cfg.lines.askLabel ?? '등대 부탁', test: () => helperInFront(), run: V => askHelper(V) });
    gp.add({
      name: 'lighthouse:site', intent: 'action', priority: 98,
      label: () => {
        const n = now(), ph = n ? R.phase(cfg, ST, n.dayKey) : 'closed';
        if (ph === 'work') return '등대 고치기';
        if (ph === 'night' && n && R.isNight(cfg, n.hourF)) return '불 켜기';
        return ph === 'closed' ? '살펴보기' : '등대';
      },
      test: () => siteInFront(), run: () => atSite(),
    });
  }

  // ── 날마다 · 1초마다 ──
  let ready = false, tick = 0;
  function sync() {
    ST = st();
    if (!ready) return;
    refresh();
    const n = now();
    if (!n) return;
    if (keeper && !busy()) keeper.near(outdoors(), ST.keeperMet);
    tryStart(n);
    tryMorning(n);
    tellOpen(n);
  }
  function update(dt) {
    beamUpdate(dt);
    keeper?.update(dt);
    if ((tick += dt) >= 1) {
      tick = 0;
      sync();
      box.show(!busy() && outdoors() ? view() : null);
    }
  }
  function reset() {   // 불러오기 뒤 다시 놓기
    const W = world();
    if (W?.objects) {
      if (placed.main) W.objects.remove(placed.main);
      for (const id of placed.props.values()) W.objects.remove(id);
      for (const id of placed.path) W.objects.remove(id);
    }
    Object.assign(placed, { main: null, mainKind: null, props: new Map(), path: [] });
    keeper?.hide();
    site = null;
    ST = st();
    sync();
  }

  return {
    sync, update, register, reset,
    setReady: () => { ready = true; sync(); },
    quality: () => beam?.setQuality(ctx.quality),
    service: {
      config: cfg,
      state: () => JSON.parse(JSON.stringify(ST)),
      phase: () => { const n = now(); return R.phase(cfg, ST, n?.dayKey); },
      view: () => view(),
      site: () => (site ? JSON.parse(JSON.stringify(site)) : null),
      /** town.keepClear: 주민이 서지 않을 자리 (등대 앞) */
      clearSpots: () => (site ? [{ x: site.front.x, z: site.front.z, r: CLEAR }, ...(keeper?.clear() ?? [])] : []),
      /** 등대지기 자리 (서쪽 등대) */
      keeper: () => (keeper?.spot ? { slug: K.slug, ...keeper.spot } : null),
      helpers: () => R.helpersOf(R.stageNow(cfg, ST), residents()),
      debug: { refresh, reset, get beam() { return beam; }, get placed() { return placed; } },
    },
  };
}

let C = null;
export default {
  name: 'lighthouse',
  async init(ctx) {
    const cfg = await (ctx.assets?.loadJSON ? ctx.assets.loadJSON(CONFIG_FILE) : fetch(CONFIG_FILE).then(r => r.json()));
    C = createLighthouse(ctx, cfg);
    ctx.services.lighthouse = C.service;
    ctx.events.on('game:ready', () => C.setReady());
    ctx.events.on('data:loaded', () => C.reset());
    ctx.events.on('quality:changed', () => C.quality());
    for (const name of ['time:newday', 'festival:end', 'place:leave', 'house:leave', 'tour:return', 'inventory:changed']) ctx.events.on(name, () => C.sync());
    const gp = ctx.services.gameplay?.interactions;
    if (gp) C.register(gp);
  },
  update(dt) { C?.update(dt); },
};
