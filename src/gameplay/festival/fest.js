// 축제 흐름 (검수 보드 z5 D20-B · D22-A · D23-A · D24-A · D25-A): 🎉 묻기 → 필요한 것 → 부품 → 부스가 선다 →
// 다섯 다 모은 다음 날 저녁 6시 광장 가운데서 축제 → 단체 사진(스토리 s10·s11) → 사진 액자 → 엔딩 뒤에도 섬은 그대로, 해마다 축제.
// 장면 연출은 스토리 세션 재생기가 이벤트를 듣고 튼다 (docs/notes/z5-festival.md). 재생기가 없으면 짧게 알림으로 넘긴다.
import { makeParts, festState, partCount, allParts, festivalDueOn } from './parts.js';
import { partSvg } from './icons.js';
import { villagerState, dayHour, josa } from '../town/rules.js';
import { giveItem } from '../town/talk.js';

const STORY_PART = n => `s0${4 + n}-part${n}`;
const nextDay = key => new Date(Date.parse(`${key}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** 설정(assets/festival/config.json) 중 아직 만들지 않은 안 → 알림만 하고 추천안대로 */
const BUILT = { 'parts.method': ['heart+gather'], 'booths.appear': ['immediate'], 'festival.start': ['nextDayEvening'], 'photo.mode': ['stageGroup'], 'after.mode': ['yearly', 'boothsOnly'] };
export function checkConfig(cfg, warn = console.warn) {
  for (const [path, ok] of Object.entries(BUILT)) {
    const v = path.split('.').reduce((o, k) => o?.[k], cfg);
    if (v != null && !ok.includes(v)) warn(`[festival] 설정 ${path} = ${v} 은 아직 없어서 ${ok[0]} 로 해요 (docs/notes/z5-festival.md 바꿀 자리)`);
  }
}

export function createFestival(ctx, emo, cfg) {
  checkConfig(cfg);
  const { PARTS, PART_BY_ID, PART_OF, ROLES, heartOpen } = makeParts(cfg);
  const FESTIVAL_HOUR = cfg.festival?.hour ?? 18;
  const PHOTO_ITEM = cfg.photo?.item ?? 'furn.festival-photo';
  const YEARLY = (cfg.after?.mode ?? 'yearly') === 'yearly';
  const { events } = ctx;
  const S = () => ctx.services;
  const f = festState(ctx.state);
  const now = () => S().time?.now?.() ?? (() => { const d = new Date(); return { hour: d.getHours(), minute: d.getMinutes(), dayKey: d.toISOString().slice(0, 10) }; })();
  const today = () => now().dayKey ?? S().data?.day?.key?.();
  const toast = (t, icon = '🎉') => S().ui?.toast?.(t, icon);
  const places = () => S().world?.places?.festival;

  // ---- 축제 이야기 시작: 스토리 s04(멈춘 축제)를 본 뒤, 스토리가 없으면 첫날 할 일을 마친 다음 날 ----
  const start = why => { if (f.started) return; f.started = today(); hud.draw(); events.emit('festival:started', { why }); };
  events.on('story:end', ({ id } = {}) => {
    if (id === 's04-stopped-festival') start('story');
    const n = /^s0[5-9]-part[1-5]$/.test(id ?? '') ? Number(id[2]) - 4 : 0;
    if (n && waitingReveal.has(n)) waitingReveal.get(n)();
    if (id === 's11-ending-photo') ending();
  });
  events.on('data:newday', () => {
    if (!f.started && !S().story) start('newday');   // 스토리 재생기가 없는 빌드: 둘째 날부터
    announce();
  });

  // ---- 진행판 화면 (UI-05): 시계 아래 부품 다섯 칸 ----
  const hud = (() => {
    const root = document.createElement('div');
    root.className = 'fe-hud';
    root.setAttribute('role', 'status');
    ctx.uiRoot?.append(root);
    return {
      draw() {
        const due = festivalDue();
        const on = !!f.started && (!f.endedDay || due);   // 엔딩 뒤엔 해마다 축제 날에만
        root.hidden = !on;
        if (!on) return;
        root.innerHTML = `<span class="fe-hud-head" aria-hidden="true">${emo.svg('party', false)}</span>${PARTS.map(p => partSvg(p.id, !!f.parts[p.id], `${p.name} ${f.parts[p.id] ? '모음' : '아직'}`)).join('')}${due ? `<span class="fe-hud-due">${emo.svg('moon', false)}</span>` : ''}`;
        root.setAttribute('aria-label', `축제 부품 ${partCount(f)}/5${due ? ', 오늘 저녁 축제' : ''}`);
      },
      hide(h) { root.style.visibility = h ? 'hidden' : ''; },
    };
  })();

  // ---- 🎉 로 묻기 (이모티콘 대화 안, town/talk.js → festival.ask) ----
  async function ask(V, E) {
    const slug = V.slug;
    if (!f.started) { await E.say(null, null, ['party', 'think']); return true; }
    const role = ROLES[slug];
    if (role) { await E.say(null, null, role === 'bell' ? ['party', 'music', 'smile'] : ['party', 'look', 'sparkle']); E.gesture('nod'); return true; }
    const P = PART_OF[slug];
    if (!P) { await E.say(null, null, ['party', 'smile']); return true; }
    if (f.parts[P.id]) { E.gesture('happy'); await E.say(null, null, ['party', 'grin', 'sparkle']); return true; }
    const v = villagerState(ctx.state, slug);
    if (!heartOpen(v)) {
      // 아직 마음을 덜 열었다: 💭 하트만 보여 주고 알림으로 길잡이
      E.gesture('tilt');
      await E.say(null, null, ['party', 'bubble', 'heart']);
      toast(`${josa(V.person.name, '와')} 더 친해지면 축제 이야기를 들려줄 거예요`, '💭');
      return true;
    }
    const d = S().data;
    const plan = d ? P.pick(d.inventory.slots, d.items, { nativeFruit: d.economy?.nativeFruit?.() }) : null;
    if (!f.asked[slug]) {
      f.asked[slug] = today();
      E.gesture('nod');
      await E.say(null, null, ['party', 'think']);
      await E.say(null, null, P.hint);
      toast(`${V.person.name}의 축제 준비물: ${P.label}`, '📝');
      if (!plan) return true;
    }
    if (!plan) { await E.say(null, null, P.hint); return true; }
    const a = await E.say(null, ['줄게', '아직'], [...P.hint.slice(0, 2), 'ask'], [['good', P.hint[1]], ['wait']]);
    if (a !== 0) { await E.say(null, null, ['smile', 'wait']); return true; }
    for (const { slot, n } of [...plan].sort((x, y) => y.slot - x.slot)) d.inventory.remove(slot, n);
    events.emit('sfx', { name: 'pickup' });
    E.gesture('happy');
    await E.say(null, null, ['love', 'sparkle', 'party']);
    await givePart(P, V);
    return true;
  }

  // ---- 부품 받기 → 부스가 선다 ----
  const waitingReveal = new Map();
  async function givePart(P, V) {
    f.parts[P.id] = today();
    const n = partCount(f);
    try { S().player?.act?.('pickup', { lock: false })?.catch?.(() => {}); } catch { /* 동작이 없어도 괜찮다 */ }
    events.emit('sfx', { name: 'fossil' });
    toast(`축제 부품 「${P.name}」를 받았어요 (${n}/5)`, P.emoji);
    hud.draw();
    const b = places()?.booths?.find(x => x.id === P.booth);
    const story = S().story;
    const hasScene = !!story?.scene?.(STORY_PART(n));
    // 스토리 장면이 있으면 장면이 끝난 뒤 부스를 연다 (겹치지 않게). 없으면 바로
    const reveal = new Promise(res => {
      if (!hasScene) { setTimeout(res, 400); return; }
      waitingReveal.set(n, res);
      setTimeout(res, 90000);   // 장면이 안 오면 그래도 연다
    });
    events.emit('festival:part', { n, total: PARTS.length, id: P.id, name: P.name, emoji: P.emoji, from: V?.slug, booth: b ? { x: b.x, z: b.z } : null, x: b?.x, z: b?.z });
    reveal.then(() => { waitingReveal.delete(n); openBooth(P.booth); });
    if (allParts(f, PARTS)) { f.readyDay ??= today(); events.emit('festival:ready', { day: f.readyDay }); hud.draw(); }
  }

  function openBooth(id) {
    if (f.booths[id]?.openedDay) return;
    f.booths[id] = { ...(f.booths[id] ?? {}), openedDay: today() };
    const objs = S().world?.objects;
    const b = places()?.booths?.find(x => x.id === id);
    if (objs && b) {
      objs.remove(`festival-cover@${id}`);
      const t = S().world.island.toTile(b.x, b.z);
      objs.add(b.slug, t.tx, t.tz, { id: `${b.slug}@${id}`, at: { x: b.x, z: b.z, y: 0 }, rot: b.rot, scale: b.scale, persist: false, festival: id, booth: id });
    }
    events.emit('sfx', { name: 'door' });
    toast(`${boothName(id)} 부스가 열렸어요`, '🎪');
    events.emit('festival:booth', { id });
  }
  const boothName = id => cfg.booths.list.find(b => b.id === id)?.name ?? id;

  // ---- 축제 날 (다 모은 다음 날 저녁 6시 · 해마다 같은 날) ----
  const festivalDue = (key = today()) => festivalDueOn(f, key, { yearly: YEARLY });
  const evening = () => dayHour(now()) >= FESTIVAL_HOUR;
  function announce() {
    hud.draw();
    if (festivalDue() && f.announced !== today()) {
      f.announced = today();
      toast(f.heldDay ? '오늘은 섬 축제 날! 저녁 6시에 광장으로 와요' : '주민들이 초대했어요: 오늘 저녁 6시, 광장에서 축제가 열려요', '🎉');
    }
  }

  async function startFestival() {
    const key = today();
    const first = !f.heldDay;
    if (first) f.heldDay = key;
    f.lastYear = key.slice(0, 4);
    (f.festivals ??= []).push(key);
    hud.draw();
    events.emit('sfx', { name: 'acorn' });
    events.emit('festival:start', { first, day: key });
    // 장면이 없으면(또는 두 번째 해부터) 바로 사진
    if (!(first && S().story?.scene?.('s10-festival'))) setTimeout(() => ending(), 1200);
  }

  // 사진 장면(s11 의 photo 컷)에서 화면을 그림으로 잡아 둔다
  let lastShot = null;
  events.on('story:shot', ({ id, shot } = {}) => {
    const sc = id && S().story?.scene?.(id);
    const take = sc?.takes?.find(t => t.key === sc.pick) ?? sc?.takes?.[0];
    if (take?.shots?.find(s => s.id === shot)?.photo) setTimeout(() => { lastShot = capture(); }, 350);
  });
  function capture() {
    try {
      ctx.renderer.render(ctx.scene, ctx.camera);
      return ctx.renderer.domElement.toDataURL('image/png');
    } catch { return null; }
  }
  let ending_ = false;
  async function ending() {
    if (ending_) return;
    ending_ = true;
    const key = today();
    f.endedDay ??= key;
    const shot = lastShot ?? capture();
    (f.photos ??= []).push({ day: key });
    const left = giveItem(ctx, PHOTO_ITEM);
    if (left > 0) toast('가방이 꽉 차서 사진 액자는 우편함으로 보낼게요', '📸');   // 아래 newday 에서 다시 준다
    if (left > 0) f.photoPending = (f.photoPending ?? 0) + 1;
    events.emit('festival:photo', { day: key, url: shot });
    events.emit('festival:end', { day: key, first: f.festivals?.length === 1 });
    hud.draw();
    if (shot && S().ui?.confirm) {
      const save = await S().ui.confirm({ title: '단체 사진', text: '찍은 사진을 그림 파일로 저장할까요?\n(사진 액자는 가방에 넣었어요)', icon: '📸', buttons: [{ label: '저장하기', value: true, primary: true }, { label: '괜찮아요', value: false }] });
      if (save) download(shot, `포근섬-축제-${key}.png`);
    }
    ending_ = false;
  }
  function download(url, name) {
    try {
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.append(a); a.click(); a.remove();
    } catch { toast('이 창에서는 그림 파일을 저장할 수 없어요', '⚠️'); }
  }
  events.on('data:newday', () => {
    if (f.photoPending > 0 && giveItem(ctx, PHOTO_ITEM) === 0) f.photoPending--;
  });

  // ---- 행동 키: 광장 가운데(모닥불)에서 축제 시작 ----
  function register(gp) {
    gp.add({
      name: 'festival:start', intent: 'action', priority: 95, label: '축제 시작',
      test() {
        const P = places(), pl = S().player?.position;
        if (!P || !pl || !festivalDue() || !evening()) return null;
        return Math.hypot(pl.x - P.x, pl.z - P.z) < 2.4 ? P : null;
      },
      run: () => startFestival(),
    });
  }

  hud.draw();
  return {
    state: f, parts: PARTS, ask, register, hud, openBooth, givePart, festivalDue, startFestival, ending,
    /** 개발용: 부품 하나 바로 받기 / 다 모으기 / 축제 날로 */
    debug: {
      part: id => givePart(PART_BY_ID[id] ?? PARTS.find(p => !f.parts[p.id]), null),
      all: () => { for (const p of PARTS) if (!f.parts[p.id]) { f.parts[p.id] = today(); openBooth(p.booth); } f.readyDay ??= today(); hud.draw(); },
      ready: () => { f.readyDay = '2000-01-01'; f.started ??= today(); hud.draw(); },
      start: () => { f.started ??= today(); hud.draw(); },
      nextDay,
    },
  };
}
