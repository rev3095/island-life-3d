// 자동 플레이 봇: 게임 창(iframe 안 /index.html 또는 /artifact/)을 사람처럼 조작한다.
// - 프레임: 게임의 rAF 를 멈추고 ctx.step(dt) 를 직접 돌린다 (창이 숨겨져도 진행, 빠르게 감기도 가능)
// - 이동: 가상 조이스틱(input.move 를 터치 패드처럼 채움) + 칸 길찾기(town/path.js 와 같은 A*)
// - 행동: 진짜 키 이벤트(Space·F·숫자키), 창 안에서는 단추 click() — 사람이 누르는 것과 같은 길
// - 기록: 콘솔 오류·경고, 알림(toast), 이벤트 수, 막힘(길찾기 실패·순간이동 대신 걷기 실패)
// 사람이 못 하는 지름길(festival.debug, 상태 직접 고치기)은 쓰지 않는다. 시계만 time.setHour 로 당긴다 (과제 허용).
import { createNav } from '../../src/gameplay/town/path.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const facingOf = (dx, dz) => Math.atan2(-dx, -dz);

export function createBot(win, { log = () => {}, dt = 1 / 30, renderEvery = 1 } = {}) {
  const ctx = win.__island;
  if (!ctx?.step) throw new Error('게임 ctx(__island.step)가 없어요');
  const doc = win.document;
  const S = () => ctx.services;
  const bot = {
    ctx, win, doc, dt, log,
    frame: 0, gameT: 0,
    errors: [], warnings: [], toasts: [], issues: [], counts: {},
    policy: {},
    stats: { walked: 0, stuck: 0, teleports: 0, keys: 0, clicks: 0 },
  };

  // ---- 콘솔·오류 기록 ----
  const origErr = win.console.error.bind(win.console), origWarn = win.console.warn.bind(win.console);
  const str = a => (a instanceof win.Error || a instanceof Error ? `${a.message}\n${(a.stack ?? '').split('\n').slice(1, 4).join('\n')}` : typeof a === 'object' ? (() => { try { return JSON.stringify(a).slice(0, 300); } catch { return String(a); } })() : String(a));
  win.console.error = (...a) => { bot.errors.push({ t: bot.gameT, frame: bot.frame, step: bot.stepId, text: a.map(str).join(' ') }); origErr(...a); };
  win.console.warn = (...a) => { bot.warnings.push({ t: bot.gameT, step: bot.stepId, text: a.map(str).join(' ') }); origWarn(...a); };
  win.addEventListener('error', e => bot.errors.push({ t: bot.gameT, step: bot.stepId, text: `${e.message} @ ${e.filename}:${e.lineno}` }));
  win.addEventListener('unhandledrejection', e => bot.errors.push({ t: bot.gameT, step: bot.stepId, text: `거부된 약속: ${str(e.reason)}` }));

  // ---- 이벤트·알림 기록 ----
  const listeners = new Map();
  const origEmit = ctx.events.emit.bind(ctx.events);
  ctx.events.emit = (name, payload) => {
    bot.counts[name] = (bot.counts[name] ?? 0) + 1;
    for (const fn of listeners.get(name) ?? []) { try { fn(payload); } catch (e) { console.error('[bot] 이벤트 듣기', e); } }
    for (const fn of listeners.get('*') ?? []) { try { fn(name, payload); } catch { /* 무시 */ } }
    return origEmit(name, payload);
  };
  /** 게임 이벤트 듣기 (봇 쪽) → 해제 */
  bot.on = (name, fn) => { const l = listeners.get(name) ?? []; l.push(fn); listeners.set(name, l); return () => l.splice(l.indexOf(fn), 1); };
  bot.once = (name, test = () => true) => new Promise(res => { const off = bot.on(name, p => { if (test(p)) { off(); res(p ?? {}); } }); });
  const ui0 = S().ui, toast0 = ui0?.toast;
  if (toast0) ui0.toast = (text, icon) => { bot.toasts.push({ t: bot.gameT, day: day(), step: bot.stepId, text: String(text), icon }); log(`  💬 ${text}`); return toast0(text, icon); };
  let lastOpen = 0;
  bot.on('ui:open', () => { lastOpen = performance.now(); });

  // ---- 프레임 ----
  ctx.renderer.setAnimationLoop(null);              // 게임 rAF 끄고 봇이 돌린다
  const mc = new MessageChannel();
  const q = [];
  mc.port1.onmessage = () => q.shift()?.();
  const yieldTask = () => new Promise(r => { q.push(r); mc.port2.postMessage(0); });
  // 그리기 건너뛰기 (빨리 감기): renderEvery 프레임마다 한 번만 그린다
  const origRender = ctx.renderer.render.bind(ctx.renderer);
  let drawNow = true;
  ctx.renderer.render = (s, c) => (drawNow ? origRender(s, c) : undefined);
  bot.renderEvery = renderEvery;
  // 최대 배속: 게임 시간이 실제 시간보다 이만큼 넘게 앞서지 않게 (화면 막·말 걸기 지연처럼 setTimeout·CSS 로 도는 연출이 따라오게)
  bot.maxSpeed = 4;
  let lastYield = performance.now(), pace = { real: performance.now(), game: 0 };
  bot.stepFrame = async () => {
    drawNow = bot.renderEvery <= 1 || bot.frame % bot.renderEvery === 0;
    bot.beforeFrame?.();
    ctx.step(bot.dt);
    drawNow = true;
    bot.frame++; bot.gameT += bot.dt;
    const now = performance.now();
    if (now - pace.real > 4000) pace = { real: now - 1000, game: bot.gameT - bot.maxSpeed };   // 기준을 가끔 옮긴다 (멈춰 있던 시간은 갚지 않는다)
    const ahead = (bot.gameT - pace.game) / bot.maxSpeed - (now - pace.real) / 1000;
    if (ahead > 0.004) { await new Promise(r => setTimeout(r, Math.min(50, ahead * 1000))); lastYield = performance.now(); }
    else if (now - lastYield > 12) { lastYield = now; await yieldTask(); }
  };
  /** 실제 시간도 기다린다 (setTimeout 으로 도는 연출) — 그동안 프레임은 계속 돈다 */
  bot.real = async ms => { const end = performance.now() + ms; while (performance.now() < end) { await bot.stepFrame(); await new Promise(r => setTimeout(r, 8)); } };

  // ---- 가상 조이스틱 ----
  const stick = { on: false, x: 0, z: 0, run: false };
  const origInputUpdate = ctx.input.update.bind(ctx.input);
  ctx.input.update = () => {
    origInputUpdate();
    if (stick.on && ctx.input.enabled) { ctx.input.move.x = stick.x; ctx.input.move.z = stick.z; ctx.input.run = stick.run; }
  };
  bot.stick = (x, z, run = false) => { stick.on = true; stick.x = x; stick.z = z; stick.run = run; };
  bot.release = () => { stick.on = false; stick.x = stick.z = 0; stick.run = false; };

  // ---- 키·클릭 ----
  const KEY_OF = { action: 'Space', pickup: 'KeyF', bag: 'KeyI', phone: 'KeyP', map: 'KeyM', toolNone: 'Digit0', tool1: 'Digit1', tool2: 'Digit2', tool3: 'Digit3', tool4: 'Digit4', tool5: 'Digit5', esc: 'Escape' };
  bot.key = (code, { up = true } = {}) => {
    bot.stats.keys++;
    const target = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body;
    target.dispatchEvent(new win.KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true, cancelable: true }));
    if (up) target.dispatchEvent(new win.KeyboardEvent('keyup', { code, bubbles: true }));
  };
  bot.press = intent => bot.key(KEY_OF[intent] ?? intent);
  /** 사람이 누르는 것처럼: 창이 막 열렸으면(fresh 160ms) 조금 기다린 뒤 */
  bot.click = async el => {
    if (!el) return false;
    while (performance.now() - lastOpen < 200) await bot.stepFrame();
    bot.stats.clicks++;
    el.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    el.click();
    return true;
  };

  // ---- 기다리기 ----
  /** cond() 가 참이 될 때까지 프레임을 돌린다 (게임 초 timeout). 그동안 열린 창·장면은 정책대로 처리 → 참이면 true */
  bot.until = async (cond, { timeout = 30, ui = true, label = '' } = {}) => {
    const end = bot.gameT + timeout;
    while (bot.gameT < end) {
      let ok = false;
      try { ok = !!cond(); } catch (e) { bot.errors.push({ t: bot.gameT, step: bot.stepId, text: `[bot] 조건 ${label}: ${e.message}` }); }
      if (ok) return true;
      if (ui) await bot.handleUI();
      await bot.stepFrame();
    }
    if (label) log(`  ⏱ 기다리다 그만둠: ${label}`);
    return false;
  };
  bot.wait = async (sec, opts = {}) => { await bot.until(() => false, { timeout: sec, ...opts }); };
  bot.blocking = () => !!S().ui?.isBlocking?.();
  bot.storyOn = () => !!S().story?.playing;
  /** 창·장면이 다 닫히고 조용해질 때까지 (그동안 정책대로 넘김) */
  bot.settle = async (timeout = 60, quietFor = 0.6) => {
    let calm = 0;
    return bot.until(() => {
      const busy = bot.blocking() || bot.storyOn() || (S().story?.queue?.length ?? 0) > 0 || !!S().gather?.busy || !!S().player?.acting || ctx.input.enabled === false
        || !!S().house?.passing;   // 문 드나드는 중 (실내 보드 — 문 열기·걷기·원형 전환)
      calm = busy ? 0 : calm + bot.dt;
      return calm >= quietFor;
    }, { timeout, label: '조용해지기' });
  };

  // ---- 시간 ----
  const time = () => S().time;
  const day = () => time()?.now?.().dayKey;
  bot.day = day;
  bot.hour = () => { const n = time()?.now?.(); return n ? n.hour + n.minute / 60 : 0; };
  /** 오늘 안에서 hh 시로 (5~29). 새 날이 되면 하루 리셋이 돈다 */
  bot.setHour = async hh => { time().setHour(hh); await bot.frames(3); };
  /** 다음 날 아침 hh 시로 (자기 전 집에 있어도 된다) */
  bot.nextDay = async (hh = 8) => {
    const before = day();
    time().setHour(29);
    await bot.until(() => day() !== before, { timeout: 5, label: '다음 날' });
    await bot.frames(5);
    time().setHour(hh);
    await bot.frames(5);
    return day();
  };
  bot.frames = async n => { for (let i = 0; i < n; i++) { await bot.handleUI(); await bot.stepFrame(); } };

  // ---- 화면 읽기 ----
  bot.$ = sel => doc.querySelector(sel);
  bot.$$ = sel => [...doc.querySelectorAll(sel)];
  const visible = el => !!el && !el.hidden && el.offsetParent !== null && win.getComputedStyle(el).visibility !== 'hidden';
  bot.visible = visible;
  /** 맨 위 창 { kind, el } */
  bot.top = () => {
    const stack = doc.querySelector('.pk-stack');
    const el = stack?.lastElementChild;
    if (!el) return null;
    const card = el.querySelector?.('.pk-card');
    const kind = el.classList.contains('pk-dialog') ? 'dialog' : el.classList.contains('fe-talk') ? 'emote' : el.classList.contains('fe-rhythm') ? 'rhythm'
      : card ? ['confirm', 'bag', 'shop', 'museum', 'craft', 'phone', 'map'].find(k => card.classList.contains(`pk-${k}`)) ?? 'card' : 'other';
    return { kind, el, card };
  };
  bot.dialogText = () => bot.$('.pk-dialog .pk-dlg-text')?.textContent ?? '';
  bot.dialogSpeaker = () => bot.$('.pk-dialog .pk-name')?.textContent ?? '';
  const emo = () => S().festival?.emotes;
  const keyOfName = name => { for (const [k, e] of emo()?.byKey ?? []) if (e.name === name) return k; return null; };
  /** 이모티콘 말풍선 낱말 (아이템은 item:<이름>) */
  bot.bubbleKeys = () => bot.$$('.fe-talk .fe-bubble-emos > *').map(e => (e.tagName.toLowerCase() === 'svg' ? keyOfName(e.getAttribute('aria-label')) ?? '?' : `item:${e.getAttribute('alt') ?? e.getAttribute('aria-label') ?? '?'}`));

  // ---- 창 정책 (기본값) ----
  // 각 단계가 bot.policy 에 덮어쓴다: dialog(texts, speaker) → 고를 번호 · confirm({title,text,buttons}) → 번호 · bag(mode, slots, title) → 칸 번호|null ·
  // emote(state) → 보낼 낱말[] | null(잘 가) · emoteChoice(options) → 번호 · card(kind, el) → true(처리함)
  let lastUI = 0, uiStuck = 0;
  bot.transcript = [];
  // 창 처리 중 봇 오류는 기록만 하고 단계는 계속 (봇 실수로 플레이가 멈추지 않게)
  bot.handleUI = async () => {
    try { await handleUI(); }
    catch (e) { bot.errors.push({ t: bot.gameT, step: bot.stepId, text: `[bot] 창 처리: ${e.message}` }); bot.issue('minor', 'bot', `창 처리 중 봇 오류: ${e.message}`); }
  };
  async function handleUI() {
    // 장면: 넘기기·고르기 (0.5초마다 A)
    if (bot.storyOn()) {
      const P = S().story.debug?.().P;
      if (P && (P.tapWait || P.choosing) && bot.gameT - lastUI > 0.5) { lastUI = bot.gameT; bot.press('action'); }
      return;
    }
    const top = bot.top();
    if (!top) { uiStuck = 0; return; }
    if (bot.gameT - lastUI < (bot.policy.uiDelay ?? 0.25) || performance.now() - lastOpen < 200) return;
    lastUI = bot.gameT;
    const P = bot.policy;
    // 창 종류마다 처음 뜰 때 한 장 (휴대폰 폭 배치 확인용)
    if (bot.uiShots) {
      const sub = top.kind === 'emote' ? (visible(top.el.querySelector('.fe-picker')) ? 'emote-picker' : visible(top.el.querySelector('.fe-choices')) ? 'emote-choice' : 'emote-bubble')
        : top.kind === 'bag' ? `bag-${[...top.card.classList].find(c => c.startsWith('is-'))?.slice(3)}` : top.kind;
      if (!bot.uiShots.has(sub)) { bot.uiShots.add(sub); await bot.shot(`ui-${sub}`, `처음 뜬 창: ${sub}`); }
    }
    if (top.kind === 'dialog') {
      const choices = [...top.el.querySelectorAll('.pk-choice')].filter(visible);
      if (choices.length) {
        const texts = choices.map(c => c.textContent.trim());
        const i = P.dialog?.(texts, bot.dialogSpeaker(), bot.dialogText()) ?? 0;
        bot.transcript.push({ day: day(), who: bot.dialogSpeaker(), text: bot.dialogText(), pick: texts[i] });
        await bot.click(choices[Math.max(0, Math.min(choices.length - 1, i))]);
      } else {
        const box = top.el.querySelector('.pk-dlg-box');
        if (box?.classList.contains('is-ready')) bot.transcript.push({ day: day(), who: bot.dialogSpeaker(), text: bot.dialogText() });
        await bot.click(box);
      }
      return;
    }
    if (top.kind === 'confirm') {
      const btns = [...top.card.querySelectorAll('.pk-btn')];
      const info = { title: top.card.querySelector('.pk-card-title')?.textContent ?? '', text: top.card.querySelector('.pk-confirm-text')?.textContent ?? '', buttons: btns.map(b => b.textContent.trim()) };
      let i = P.confirm?.(info);
      if (i == null) i = Math.max(0, btns.findIndex(b => b.classList.contains('is-primary') && !b.disabled));
      bot.transcript.push({ day: day(), confirm: info.title, text: info.text, pick: info.buttons[i] });
      await bot.click(btns[i]);
      return;
    }
    if (top.kind === 'bag') {
      const mode = [...top.card.classList].find(c => c.startsWith('is-'))?.slice(3);
      const title = top.card.querySelector('.pk-card-title')?.textContent ?? '';
      const slots = S().data.inventory.slots;
      const i = P.bag?.(mode, slots, title);
      if (i == null || i < 0) { await bot.click(top.card.querySelector('.pk-x')); return; }
      const cell = top.card.querySelectorAll('.pk-slot')[i];
      await bot.click(cell);
      return;
    }
    if (top.kind === 'emote') { await emoteUI(top); return; }
    if (top.kind === 'rhythm') { await rhythmUI(top); return; }
    if (P.card?.(top.kind, top.el, top.card)) return;
    // 그 밖의 창 (상점·박물관·섬폰…): 정책이 없으면 닫는다
    if (++uiStuck > 2) log(`  (창 ${top.kind} 닫음)`);
    await bot.click(top.card?.querySelector('.pk-x') ?? null) || bot.press('esc');
  };

  async function emoteUI(top) {
    const el = top.el, P = bot.policy;
    const picker = el.querySelector('.fe-picker'), choices = el.querySelector('.fe-choices');
    if (visible(choices) && choices.children.length) {
      const opts = [...choices.children];
      const i = P.emoteChoice?.(opts.map(o => o.getAttribute('aria-label')), bot.bubbleKeys()) ?? 0;
      bot.transcript.push({ day: day(), emote: 'choose', bubble: bot.bubbleKeys(), pick: opts[i]?.getAttribute('aria-label') });
      await bot.click(opts[i]);
      return;
    }
    if (visible(picker)) {
      const keys = P.emote?.({ bubble: bot.bubbleKeys(), name: el.querySelector('.fe-name')?.textContent }) ?? null;
      bot.transcript.push({ day: day(), emote: 'send', bubble: bot.bubbleKeys(), send: keys });
      if (keys == null) { await bot.click(el.querySelector('.fe-bye')); return; }
      await composeKeys(el, keys);
      await bot.click(el.querySelector('.fe-send'));
      return;
    }
    // 말풍선: 넘기기
    await bot.click(el.querySelector('.fe-bubble'));
  }
  /** 선택기에서 낱말들을 골라 보낼 칸에 넣는다 (탭을 돌며 단추 찾기) */
  async function composeKeys(el, keys) {
    const E = emo();
    for (const k of keys.slice(0, 3)) {
      const isItem = String(k).startsWith('item:');
      const cat = isItem ? 'thing' : E.byKey.get(k)?.cat;
      const tabI = E.cats.findIndex(c => c.key === cat);
      const tab = el.querySelectorAll('.fe-tab')[tabI];
      if (tab && tab.getAttribute('aria-selected') !== 'true') await bot.click(tab);
      const label = isItem ? E.say([k], S().data.items) : E.name(k);
      const cell = [...el.querySelectorAll('.fe-cell')].find(b => b.getAttribute('aria-label') === label);
      if (!cell) { bot.issue('minor', 'festival', `이모티콘 선택기에 「${label}」 단추가 없어요`, { key: k }); continue; }
      await bot.click(cell);
    }
  }
  async function rhythmUI(top) {
    // 리듬 놀이: 음표가 줄에 닿을 때 (사람 반응처럼 ±40ms 흔들림)
    if (top.el.dataset.botOn) return;
    top.el.dataset.botOn = '1';
    const t0 = lastOpen;   // 놀이 시작 = 창이 열린 때 (booths.js 가 panel 을 연 바로 뒤 t0 를 잰다)
    const RHYTHM = await rhythmTable();
    for (const b of RHYTHM.beats) {
      const at = t0 + (RHYTHM.lead + b * RHYTHM.beat) * 1000 + (Math.random() - 0.5) * 80;
      while (performance.now() < at) await bot.stepFrame();
      bot.key('Space');
    }
  }

  /** 리듬 놀이 박자표 (booths.js RHYTHM). CSP 가 eval 을 막아서 게임 창에 인라인 모듈 스크립트로 불러온다 (importmap·게시본 경로 그대로) */
  async function rhythmTable() {
    if (!win.__botRhythm && !doc.querySelector('script[data-bot-rhythm]')) {
      const s = doc.createElement('script');
      s.type = 'module'; s.dataset.botRhythm = '';
      s.textContent = `import { RHYTHM } from ${JSON.stringify(new URL('src/gameplay/festival/booths.js', win.location.href).href)}; window.__botRhythm = RHYTHM;`;
      doc.head.append(s);
    }
    const end = performance.now() + 3000;
    while (!win.__botRhythm && performance.now() < end) await new Promise(r => setTimeout(r, 20));
    if (!win.__botRhythm) bot.issue('minor', 'bot', '리듬 박자표를 못 불러와 기본값으로 쳐요');
    return win.__botRhythm ?? { beats: [0, 1, 2, 2.5, 3.5, 4, 5, 6], beat: 0.62, lead: 1.8 };
  }
  rhythmTable();   // 미리 불러 둔다

  // ---- 기록 ----
  /** 버그·어색함 기록: sev = 'critical'|'major'|'minor'|'polish' */
  bot.issue = (sev, module, text, extra = {}) => {
    const key = `${module}|${text}`;
    const had = bot.issues.find(i => i.key === key);
    if (had) { had.n++; return had; }
    const it = { key, sev, module, text, step: bot.stepId, day: day(), n: 1, ...extra };
    bot.issues.push(it);
    log(`  ⚠ [${sev}] ${module}: ${text}`);
    return it;
  };

  // ---- 길찾기·걷기 ----
  const world = () => S().world;
  const player = () => S().player;
  let nav = null;
  const getNav = () => (nav ??= createNav(world().island));
  bot.pos = () => ({ x: player().position.x, z: player().position.z });
  bot.dist = (a, b = bot.pos()) => Math.hypot(a.x - b.x, a.z - b.z);
  const tileOf = p => world().island.toTile(p.x, p.z);
  const inZone = () => Math.abs(player().position.x) > 100;   // 집·주민 방·상점·박물관 실내 (섬 밖 좌표)

  /** 가까운 걸을 수 있는 칸 (목표 칸이 막혀 있으면 둘레에서) */
  function walkableNear(p, maxR = 3) {
    const n = getNav(), t = tileOf(p);
    if (n.walkable(t.tx, t.tz)) return t;
    let best = null, bd = 1e9;
    for (let dz = -maxR; dz <= maxR; dz++) for (let dx = -maxR; dx <= maxR; dx++) {
      const tx = t.tx + dx, tz = t.tz + dz;
      if (!n.walkable(tx, tz)) continue;
      const c = world().island.toWorld(tx, tz), d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; best = { tx, tz }; }
    }
    return best;
  }

  /**
   * 길찾기 시작 칸: 선 자리 칸의 가운데가 막혀 있으면(예: 초롱네 문 앞 — 집·우편함·덤불 사이 틈) 바로 옆 걸을 수 있는 칸.
   * 칸 가운데로만 길을 찾으므로, 틈에 서 있으면 대각선으로만 열린 이웃 칸으로는 못 나가 "길이 없어요"가 났다 (2026-11-04 실내 문 전환 뒤 —
   * 문에서 걸어 나온 자리가 문 앞 0.15칸이라). → { tile, step: 먼저 걸어갈 그 칸 가운데 | null }
   */
  function startOf() {
    const t = tileOf(bot.pos());
    if (getNav().walkable(t.tx, t.tz)) return { tile: t, step: null };
    const n = walkableNear(bot.pos(), 1);
    return n ? { tile: n, step: world().island.toWorld(n.tx, n.tz) } : { tile: t, step: null };
  }

  /**
   * (x,z) 까지 걷는다. opts = { near = 0.35, run = true, timeout (게임 초), label }
   * 길이 없거나 오래 막히면 issue 로 남기고 false (allowTeleport 면 그 자리로 옮겨 계속)
   */
  bot.walkTo = async (to, { near = 0.35, run = true, timeout = 90, label = '', allowTeleport = true, quiet = false } = {}) => {
    if (inZone()) {
      if (Math.abs(to.x) > 100) return bot.walkLocal(to, { near, timeout });
      // 방 안인데 섬 쪽 목표: 먼저 문 매트(방 남쪽 가운데)로 가서 나온다 (내 집 x 500 · 주민 방 x 540, 방 8×8)
      bot.issue('minor', 'bot', `방 안에서 바깥으로 가라고 해서 먼저 나왔어요 (${label || '목표'})`);
      if (!(await bot.exitRoom())) return false;
    }
    const start = bot.gameT;
    const goalT = walkableNear(to);
    // 목표가 물·건물처럼 못 서는 곳이면 가장 가까운 땅 칸 가운데로 (그 자리 자체로 걸어 들어가려다 막히지 않게)
    if (goalT && !world().island.isWalkable(to.x, to.z)) { to = world().island.toWorld(goalT.tx, goalT.tz); near = Math.max(near, 0.3); }
    let pts = null, tries = 0;
    const plan = () => {
      const { tile: a, step } = startOf();
      const tiles = goalT && getNav().findPath(a, goalT, { maxNodes: 6000 });
      if (!tiles) return null;
      const from = step ?? bot.pos();
      const out = [...(step ? [step] : []), ...getNav().smooth(tiles.slice(1), from.x, from.z)];
      out.push({ x: to.x, z: to.z });
      return out;
    };
    pts = plan();
    if (!pts) {
      bot.issue('major', 'world', `길이 없어요: ${label || `${to.x.toFixed(1)},${to.z.toFixed(1)}`}`, { from: bot.pos(), to });
      if (allowTeleport) { teleport(to); return true; }
      return false;
    }
    let i = 0, lastP = bot.pos(), lastProg = bot.gameT, sidestep = 0;
    while (bot.gameT - start < timeout) {
      if (bot.blocking() || bot.storyOn() || player().frozen) { bot.release(); await bot.handleUI(); await bot.stepFrame(); lastProg = bot.gameT; continue; }
      const p = bot.pos();
      if (bot.dist(to, p) < near) { bot.release(); await bot.frames(2); bot.stats.walked += bot.gameT - start; return true; }
      let wp = pts[i];
      while (wp && i < pts.length - 1 && bot.dist(wp, p) < 0.4) wp = pts[++i];
      const dx = wp.x - p.x, dz = wp.z - p.z, L = Math.hypot(dx, dz) || 1;
      const slow = i === pts.length - 1 && L < 1.2;
      let sx = dx / L, sz = dz / L;
      if (sidestep > 0) { sidestep -= bot.dt; const s = Math.sign(Math.sin(bot.frame * 0.05)) || 1; [sx, sz] = [sx * 0.4 - sz * s, sz * 0.4 + sx * s]; }
      bot.stick(slow ? sx * Math.max(0.35, L / 1.2) : sx, slow ? sz * Math.max(0.35, L / 1.2) : sz, run && !slow);
      await bot.stepFrame();
      if (bot.dist(p, lastP) > 0.25) { lastP = bot.pos(); lastProg = bot.gameT; }
      else if (bot.gameT - lastProg > 1.6) {
        tries++;
        bot.stats.stuck++;
        if (tries > 4) break;
        sidestep = 0.5;
        const np = plan();
        if (np) { pts = np; i = 0; }
        lastProg = bot.gameT;
      }
    }
    bot.release();
    if (quiet) return false;
    bot.issue('minor', 'world', `걷다가 막혔어요: ${label || '목표'} (남은 거리 ${bot.dist(to).toFixed(1)}칸)`, { at: bot.pos(), to });
    if (allowTeleport) { teleport(to); return true; }
    return false;
  };
  /** 집 안·주민 방처럼 섬 밖 구역: 곧게 걷기 */
  bot.walkLocal = async (to, { near = 0.3, timeout = 20, label = '방 안' } = {}) => {
    const end = bot.gameT + timeout;
    // 방 안 가구를 돌아가는 길 (0.25칸 격자 BFS, 구역의 isWalkable — 플레이어가 구역 안이면 island.isWalkable 이 구역 것)
    const pts = [...(localPath(bot.pos(), to) ?? []), to];
    let i = 0, lastP = bot.pos(), lastProg = bot.gameT;
    while (bot.gameT < end) {
      if (bot.blocking() || player().frozen) { bot.release(); await bot.handleUI(); await bot.stepFrame(); lastProg = bot.gameT; continue; }
      const p = bot.pos(), d = bot.dist(to, p);
      if (d < near) { bot.release(); await bot.frames(2); return true; }
      while (i < pts.length - 1 && bot.dist(pts[i], p) < 0.18) i++;
      const w = pts[i], dw = bot.dist(w, p) || 1;
      const k = i === pts.length - 1 && dw < 0.8 ? Math.max(0.3, dw / 0.8) : 0.8;
      bot.stick(((w.x - p.x) / dw) * k, ((w.z - p.z) / dw) * k, false);
      await bot.stepFrame();
      if (bot.dist(p, lastP) > 0.15) { lastP = bot.pos(); lastProg = bot.gameT; }
      else if (bot.gameT - lastProg > 2.5) break;
    }
    bot.release();
    // 사람이라면 돌아서 갔을 자리 — 막힘으로 남기고 그 자리로 옮긴다 (다음 단계가 방에 갇히지 않게)
    bot.issue('minor', 'house', `${label}에서 걷다가 막혔어요 (남은 거리 ${bot.dist(to).toFixed(1)}칸)`, { at: bot.pos(), to });
    bot.stats.teleports++;
    player().teleport(to.x, to.z);
    await bot.frames(2);
    return true;
  };
  /**
   * 집·주민 방·상점·박물관에서 나오기: 문 매트(방 남쪽 가운데, 판정 띠가 좁다)로 가서 문 쪽(남쪽)으로 민다 — 사람이 문으로 걸어 나가듯.
   * 안 되면 남쪽을 보고 행동 키. 문 매트 자리는 house.doormat() (없는 예전 게임이면 내 집 x 500 · 주민 방 x 540, 방 8×8 의 z 3.35)
   */
  bot.exitRoom = async () => {
    if (!inZone()) return true;
    const mat = S().house?.doormat?.();
    const cx = mat?.x ?? (Math.abs(bot.pos().x - 540) < 10 ? 540 : 500);
    await bot.walkLocal({ x: cx, z: mat?.z ?? 3.35 }, { near: 0.12, label: '문 매트' });
    for (let k = 0; k < 3 && inZone(); k++) {
      bot.stick(0, 1, false);
      await bot.until(() => !inZone() || bot.blocking(), { timeout: 0.8, ui: false });
      bot.release();
      await bot.until(() => !inZone(), { timeout: 3 });
      if (!inZone()) break;
      await bot.faceDir(180);
      bot.press('action');
      await bot.until(() => !inZone(), { timeout: 4 });
    }
    if (inZone()) bot.issue('minor', 'house', `방에서 문으로 나가기가 안 돼요 (${bot.peek()})`);
    return !inZone();
  };
  function localPath(from, to) {
    const isl = world().island, S = 0.25, R = 0.2;
    const free = (x, z) => [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]].every(([a, b]) => isl.isWalkable(x + a, z + b));
    const x0 = Math.min(from.x, to.x) - 4, z0 = Math.min(from.z, to.z) - 4;
    const W = Math.ceil((Math.abs(from.x - to.x) + 8) / S), H = Math.ceil((Math.abs(from.z - to.z) + 8) / S);
    if (W * H > 40000) return null;   // 방 하나(8×8)를 넘는 거리는 곧게
    const cell = p => [Math.round((p.x - x0) / S), Math.round((p.z - z0) / S)];
    const [sx, sz] = cell(from), [gx, gz] = cell(to);
    const prev = new Map([[`${sx},${sz}`, null]]), q = [[sx, sz]];
    while (q.length) {
      const [cx, cz] = q.shift();
      if (Math.abs(cx - gx) <= 1 && Math.abs(cz - gz) <= 1) {
        const out = [];
        for (let k = `${cx},${cz}`; k; k = prev.get(k)) { const [a, b] = k.split(',').map(Number); out.unshift({ x: x0 + a * S, z: z0 + b * S }); }
        return out.filter((_, j) => j % 2 === 0 || j === out.length - 1);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, nz = cz + dz, key = `${nx},${nz}`;
        if (nx < 0 || nz < 0 || nx > W || nz > H || prev.has(key) || !free(x0 + nx * S, z0 + nz * S)) continue;
        prev.set(key, `${cx},${cz}`);
        q.push([nx, nz]);
      }
    }
    return null;
  }
  function teleport(to) {
    bot.stats.teleports++;
    const t = walkableNear(to, 4);
    const c = t ? world().island.toWorld(t.tx, t.tz) : to;
    player().teleport(c.x, c.z);
  }
  /** 그쪽을 본다 (아주 살짝 밀어서 돌기) */
  bot.face = async (target, { tol = 0.12, timeout = 2 } = {}) => {
    const end = bot.gameT + timeout;
    while (bot.gameT < end) {
      const p = bot.pos(), want = facingOf(target.x - p.x, target.z - p.z);
      if (Math.abs(angDiff(want, player().facing)) < tol) break;
      const dx = target.x - p.x, dz = target.z - p.z, L = Math.hypot(dx, dz) || 1;
      bot.stick((dx / L) * 0.07, (dz / L) * 0.07, false);
      await bot.stepFrame();
    }
    bot.release();
    await bot.frames(2);
    return Math.abs(angDiff(facingOf(target.x - bot.pos().x, target.z - bot.pos().z), player().facing)) < tol * 2;
  };
  /** 방향(도, 0 = 북 · 90 = 서 · 180 = 남 · -90 = 동) 보기 */
  bot.faceDir = async deg => { const a = deg * Math.PI / 180, p = bot.pos(); return bot.face({ x: p.x - Math.sin(a) * 3, z: p.z - Math.cos(a) * 3 }); };
  /**
   * 물체 앞에 가서 그쪽을 본다: 물체 둘레 dist 칸 자리 중 갈 수 있는 가장 가까운 곳.
   * obj = {x, z} (+ 피할 방향 없음) → 선 자리
   */
  bot.approach = async (obj, { dist = 0.85, label = '', angles = 12, level = true, quiet = false } = {}) => {
    const isl = world().island;
    const objLv = (() => { const t = isl.toTile(obj.x, obj.z); return isl.levelAt(t.tx, t.tz); })();
    const n = getNav();
    const me = startOf().tile;   // 틈에 서 있어도 바로 옆 칸에서 찾는다 (walkTo 가 그 칸으로 먼저 걷는다)
    let best = null;
    for (let k = 0; k < angles; k++) {
      const a = (k / angles) * TAU;
      const x = obj.x + Math.sin(a) * dist, z = obj.z + Math.cos(a) * dist;
      if (!isl.isWalkable(x, z)) continue;
      const t = isl.toTile(x, z);
      if (!n.walkable(t.tx, t.tz)) continue;
      if (level && isl.levelAt(t.tx, t.tz) !== objLv && isl.tileAt(t.tx, t.tz) !== 'ramp') continue;
      const path = n.findPath(me, t, { maxNodes: 6000 });
      if (!path) continue;
      const cost = path.length + Math.hypot(x - bot.pos().x, z - bot.pos().z) * 0.01;
      if (!best || cost < best.cost) best = { x, z, cost };
    }
    if (!best) { if (!quiet) bot.issue('minor', 'world', `다가갈 자리가 없어요: ${label}`, { obj }); return false; }
    await bot.walkTo(best, { near: 0.18, label });
    await bot.face(obj);
    return true;
  };

  // ---- 행동 ----
  /** 지금 행동 키를 누르면 처리할 처리기 이름 (ui 의 peek — 화면 A 버튼 글자와 같은 것) */
  bot.peek = (intent = 'action') => S().gameplay?.interactions?.peek?.(intent)?.name ?? null;
  /** 행동 키를 누르고 동작·창이 끝날 때까지 */
  bot.act = async (intent = 'action', { settle = true, timeout = 40 } = {}) => {
    bot.press(intent);
    await bot.frames(3);
    if (settle) await bot.settle(timeout, 0.4);
  };
  /** 도구 들기 ('rod'|'net'|'shovel'|'axe'|'can'|null) — 숫자키 */
  bot.tool = async tool => {
    const T = ctx.constants.TOOLS;
    if (player().tool === tool) return true;
    bot.press(tool ? `tool${T.indexOf(tool) + 1}` : 'toolNone');
    await bot.frames(3);
    return player().tool === tool;
  };

  // ---- 가방 ----
  bot.inv = () => S().data.inventory.slots;
  bot.item = id => S().data.items.get(id);
  bot.count = test => bot.inv().reduce((n, s) => n + (s && test(bot.item(s.id), s) ? s.count : 0), 0);
  bot.has = id => S().data.inventory.count(id);
  bot.acorns = () => S().data.wallet.get();
  bot.free = () => bot.inv().filter(s => !s).length;

  // ---- 스크린샷 요청 (바깥 실행기가 받으면 화면 전체, 아니면 캔버스만) ----
  bot.shots = [];
  bot.shot = async (name, note = '') => {
    await bot.stepFrame();
    const host = win.parent?.__playtest;
    const rec = { name, note, day: day(), hour: bot.hour().toFixed(2), step: bot.stepId };
    if (host?.wantShots) {
      host.beforeShot?.();
      await bot.stepFrame();
      host.pendingShot = rec;
      const end = performance.now() + 8000;
      while (host.pendingShot && performance.now() < end) await new Promise(r => setTimeout(r, 30));
      rec.file = host.lastShotFile ?? null;
      host.afterShot?.();
    } else {
      try { origRender(ctx.scene, ctx.camera); rec.canvas = ctx.renderer.domElement.toDataURL('image/jpeg', 0.7); } catch { /* 캔버스를 못 읽음 */ }
    }
    bot.shots.push(rec);
    log(`  📸 ${name}`);
    return rec;
  };

  bot.restore = () => {
    ctx.events.emit = origEmit;
    ctx.input.update = origInputUpdate;
    ctx.renderer.render = origRender;
    win.console.error = origErr; win.console.warn = origWarn;
    if (ui0?.toast && toast0) ui0.toast = toast0;
  };
  return bot;
}
