// 처음부터 엔딩까지 자동 플레이 단계. 단계마다 { id, title, run(T) → { status, note } } — status: pass | awkward | block | skip.
// 막혀도 되도록 다음 단계로 간다 (막힌 단계 뒤 결과는 그 상태에서 이어 본 것). 시계만 time.setHour 로 당기고,
// 나머지는 모두 행동 키·창 단추로 한다 (festival.debug·상태 고치기 같은 지름길 없음).
// 날짜: 새 게임 = 실제 오늘 (어느 날이든 — 생일 단계는 가장 가까운 주민 생일까지 넘긴다). 단풍 이사 = 첫날 + 1(집터) + 3(이삿짐) + 1(입주).

const NAMES = { player: '하늘', island: '몽글' };
/** 부품 주인 → 무엇이 필요 (assets/festival/config.json parts.list 를 읽어 채운다) */
const PART_TESTS = {
  chorong: (bot, it) => it?.category === 'bug',
  coco: (bot, it) => it?.id === 'mat.wood',
  mochi: (bot, it) => it?.category === 'flower',
  pong: (bot, it) => it?.category === 'fruit',
  dubu: (bot, it) => it?.category === 'fish' && (it.shadow ?? 0) >= 5,
};

export function makeScenario(bot, sk, opts = {}) {
  const S = () => bot.ctx.services;
  const st = () => bot.ctx.state;
  const fest = () => st().festival ?? {};
  const T = { notes: {}, days: [], metrics: {} };
  const keep = new Set();   // 팔지 않을 아이템 id (부품 재료)
  const note = (k, v) => { T.notes[k] = v; };
  const pass = (n = '') => ({ status: 'pass', note: n });
  const awk = (n) => ({ status: 'awkward', note: n });
  const block = (n) => ({ status: 'block', note: n });
  const cfgParts = () => S().festival?.config?.parts?.list ?? [];
  const partOf = slug => cfgParts().find(p => p.who === slug);
  const hasPart = slug => !!fest().parts?.[partOf(slug)?.id];
  const heartOpen = slug => { const v = S().town.state(slug); return v.friendship >= 30 && (v.emote?.wins ?? 0) >= 2; };
  const residents = () => S().town.residents();

  // ---------- 매일 하는 일 ----------
  /** 주민이 좋아하는 선물 고르기 (공략: 주민 파일의 gifts.loves/likes) — 부품 재료는 빼고 */
  function giftTest(slug) {
    if (opts.novice) return (it) => !!it && ['fruit', 'flower', 'shell'].includes(it.category) && !isMaterialFor(it);   // 처음 하는 사람: 과일·꽃·조개를 아무에게나
    const P = S().town.villagers.find(V => V.slug === slug)?.person;
    const g = P?.gifts ?? {};
    const hit = (rules, it) => (rules ?? []).some(r => (r.includes('.') ? it.id === r : r === 'rare' ? it.rare : r === 'hybrid' ? it.hybrid : it.category === r));
    return (it, s) => !!it && it.category !== 'tool' && !keep.has(it.id) && !isMaterialFor(it) && (hit(g.loves, it) || hit(g.likes, it)) && !hit(g.dislikes, it);
  }
  /** 아직 안 낸 부품 재료인가 */
  function isMaterialFor(it) {
    for (const [slug, test] of Object.entries(PART_TESTS)) if (!hasPart(slug) && fest().started && test(bot, it)) return true;
    return false;
  }
  async function talkRound({ party = true } = {}) {
    const out = [];
    for (const slug of residents()) {
      const v = S().town.state(slug);
      const doneToday = v.emote?.day === bot.day() && (v.emote?.today ?? 0) >= 3;
      const wantParty = party && fest().started && partOf(slug) && !hasPart(slug) && (heartOpen(slug) || !fest().asked?.[slug]);
      if (doneToday && !wantParty) continue;
      const giftsToday = v.giftDay === bot.day() ? v.giftsToday ?? 0 : 0;
      const gift = giftsToday < 2 && bot.inv().some(s => s && giftTest(slug)(bot.item(s.id), s)) ? giftTest(slug) : null;
      const r = await sk.emoteTalk(slug, { gift, party: wantParty, wins: 3 });
      if (!r.opened) { out.push({ slug, opened: false }); continue; }
      const kinds = r.sent.map(x => x.kind);
      out.push({ slug, kinds, gift: r.gift, party: r.party, f: S().town.state(slug).friendship });
      bot.log(`  ${slug}: ${kinds.join(',')} · 친밀도 ${S().town.state(slug).friendship}${r.gift ? ` · 선물 ${r.gift}` : ''}${r.party ? ' · 🎉' : ''}`);
    }
    return out;
  }
  /** 부품 재료 모으기 (아직 안 낸 것만) */
  async function gatherForParts() {
    const got = {};
    // 처음 하는 사람(opts.novice)은 주민이 🎉 로 준비물을 알려 준 뒤에야 모은다 (설정 파일을 모른다)
    const need = slug => fest().started && !hasPart(slug) && residents().includes(slug) && (!opts.novice || !!fest().asked?.[slug]);
    if (need('pong') && bot.count(it => it?.category === 'fruit') < 5) {
      // 섬 과일 + 섬 특산 아닌 과일 하나 (야자열매)
      for (const o of sk.objects('fruit-tree').slice(0, 3)) { if (bot.count(it => it?.category === 'fruit') >= 6) break; await sk.shakeTree(o); }
      if (!bot.inv().some(s => s && bot.item(s.id)?.category === 'fruit' && s.id !== `fruit.${S().world.nativeFruit}`)) {
        for (const o of sk.objects('palm').slice(0, 3)) { await sk.shakeTree(o); if (bot.has('fruit.coconut')) break; }
      }
      got.fruit = bot.count(it => it?.category === 'fruit');
    }
    if (need('mochi') && bot.count(it => it?.category === 'flower') < 6) got.flower = await sk.flowers(6, { kinds: 3 });
    if (need('coco') && bot.has('mat.wood') < 5) got.wood = await sk.wood(5);
    if (need('chorong') && bot.count(it => it?.category === 'bug') < 3) {
      let n = 0;
      for (let k = 0; k < 6 && bot.count(it => it?.category === 'bug') < 3; k++) if (await sk.bug({ tries: 3 })) n++;
      got.bug = n;
    }
    if (need('dubu') && !bot.inv().some(s => s && PART_TESTS.dubu(bot, bot.item(s.id)))) {
      const mouth = findHabitat('mouth');
      const t0 = bot.gameT;
      let tries = 0, id = null;
      for (; tries < 6 && !id; tries++) {
        const r = await sk.fish({ minSize: 5, tries: 2, where: tries === 0 ? mouth : null });
        if (r && PART_TESTS.dubu(bot, bot.item(r))) id = r;
      }
      got.bigFish = { id, tries, sec: Math.round(bot.gameT - t0) };
    }
    return got;
  }
  /** 서식지가 hab 인 물가 자리 (하구 등) */
  function findHabitat(hab) {
    const isl = S().world.island, g = S().gather;
    for (let tz = 0; tz < isl.h; tz += 1) for (let tx = 0; tx < isl.w; tx += 1) {
      const c = isl.toWorld(tx, tz);
      if (g.habitatAt(c.x, c.z) === hab) return c;
    }
    return null;
  }
  /** 남는 것 팔기 (도구·가구·부품 재료·기증 안 한 것은 남긴다) */
  async function sellSurplus() {
    const m = S().data.museum;
    return sk.shop({ sell: (it, s) => {
      if (!it || it.category === 'tool' || it.category === 'furn' || it.category === 'festival' || keep.has(it.id) || isMaterialFor(it)) return 0;
      if (m.canDonate?.(it.id)) return 0;
      return s.count;
    } });
  }
  /** 열린 부스 놀이 하나씩 */
  async function playBooths() {
    const P = S().world.places.festival;
    const res = {};
    for (const b of P?.booths ?? []) {
      if (!fest().booths?.[b.id]?.openedDay || fest().booths[b.id].botPlayed === bot.day()) continue;
      const before = bot.inv().map(s => s && `${s.id}:${s.count}`).join();
      bot.policy = {
        bag: (mode, slots, title) => {
          const pick = test => { const i = slots.findIndex(s => s && test(bot.item(s.id))); return i >= 0 ? i : null; };   // 없으면 닫기
          if (/등불/.test(title)) return pick(it => it?.category === 'bug' && !keep.has(it.id));
          if (/낚시 대회/.test(title)) return pick(it => it?.category === 'fish');
          return null;
        },
      };
      await bot.walkTo(b.front, { near: 0.3, label: `부스 ${b.id}` });
      await bot.face(b);
      const peek = bot.peek();
      if (peek !== 'festival:booth') { res[b.id] = `행동 키 ${peek}`; bot.policy = {}; continue; }
      await bot.act('action', { timeout: 30 });
      bot.policy = {};
      res[b.id] = before === bot.inv().map(s => s && `${s.id}:${s.count}`).join() ? 'played' : 'played+item';
      fest().booths[b.id].botPlayed = bot.day();   // 봇 기록 (게임은 이 칸을 안 읽는다)
    }
    return res;
  }

  // ---------- 단계 ----------
  const steps = [];
  const add = (id, title, run, o = {}) => steps.push({ id, title, run, ...o });

  add('boot', '게임 열기 (모듈·콘솔)', async () => {
    const mods = Object.keys(S());
    const want = ['data', 'time', 'world', 'player', 'ui', 'audio', 'gameplay', 'gather', 'town', 'house', 'intro', 'story', 'festival'];
    const miss = want.filter(m => !mods.includes(m));
    note('modules', mods);
    if (miss.length) return block(`없는 모듈: ${miss.join(', ')}`);
    return pass(`서비스 ${mods.length}개`);
  });

  add('naming', '새 게임 · 이름 정하기', async () => {
    const ok = await bot.until(() => bot.$('.fd-input') && bot.visible(bot.$('.fd-go')), { timeout: 20 });
    if (!ok) return block('이름 창이 안 떠요');
    await bot.shot('01-naming', '이름 정하기 창');
    const ins = bot.$$('.fd-input');
    const type = (el, v) => { el.focus(); el.value = v; el.dispatchEvent(new bot.win.InputEvent('input', { bubbles: true, data: v, inputType: 'insertText' })); };
    type(ins[0], NAMES.player); type(ins[1], NAMES.island);
    await bot.click(bot.$('.fd-go'));
    const named = await bot.until(() => st().player.name === NAMES.player, { timeout: 20 });
    if (!named) return block('이름이 저장 안 됨');
    return pass(`${st().player.name} · ${st().island.name}`);
  });

  add('arrival', 's01 도착 장면 → 밤톨 첫 안내 → s02', async () => {
    const ok = await bot.until(() => st().flags.intro, { timeout: 180, label: '밤톨 안내' });
    await bot.settle(90);
    const seen = st().story.seen;
    if (!ok) return block('밤톨 첫 안내가 끝나지 않아요');
    await bot.shot('02-checklist', '첫날 할 일 목록');
    const miss = ['s01-arrival', 's02-guide-after'].filter(s => !seen[s]);
    return miss.length ? awk(`안 나온 장면 ${miss}`) : pass(`대사 ${bot.transcript.filter(x => x.who === '밤톨').length}줄`);
  });

  add('clock', '시계 9시로 (상점은 8시부터)', async () => {
    S().time.setPaused(true);
    await bot.setHour(9);
    return pass(`${bot.day()} ${bot.hour().toFixed(1)}시`);
  });

  const stepDone = id => !!S().intro.progress().done[id];
  add('fd-tool', '할 일 ② 도구 들어 보기', async () => {
    await bot.tool('rod');
    return stepDone('tool') ? pass() : block('도구를 들었는데 단계가 안 넘어가요');
  });
  add('fd-gather', '할 일 ③ 나무 흔들기', async () => {
    const trees = sk.objects(['tree', 'fruit-tree']);
    for (const o of trees.slice(0, 3)) { await sk.shakeTree(o); if (stepDone('gather')) break; }
    return stepDone('gather') ? pass() : block('나무를 흔들어도 단계가 안 넘어가요');
  });
  add('fd-catch', '할 일 ④ 물고기 잡기 (2마리 — 하나는 기증용)', async () => {
    const got = [];
    for (let k = 0; k < 4 && got.length < 2; k++) { const id = await sk.fish({ tries: 3 }); if (id) got.push(id); }
    note('firstFish', got);
    if (!stepDone('catch')) return block(`잡기 단계가 안 넘어감 (잡은 것 ${got.length})`);
    return got.length >= 2 ? pass(got.join(', ')) : awk(`한 마리만 ${got}`);
  });
  add('fd-sell', '할 일 ⑤ 상점에서 팔기', async () => {
    const fish = bot.inv().filter(s => s && bot.item(s.id)?.category === 'fish');
    const keepId = fish[0]?.id;
    const r = await sk.shop({ sell: (it, s) => (it.category === 'fish' && s !== fish[0] ? 1 : it.category === 'mat' ? s.count : 0) });
    if (!r?.opened) return block('상점 창이 안 열려요');
    note('sell1', r.earned);
    note('shopInside', { inside: r.inside, left: r.left });   // 실내 보드: 문 → 실내 → 계산대 → 문 매트로 나옴
    if (r.earned <= 0) { const r2 = await sk.shop({ sell: (it) => (it.category === 'fish' ? 1 : 0) }); note('sell1b', r2?.earned); }
    return stepDone('sell') ? pass(`🌰 +${r.earned}`) : block('팔았는데 단계가 안 넘어감');
  });
  add('fd-donate', '할 일 ⑥ 느루에게 기증', async () => {
    if (!bot.inv().some(s => s && S().data.museum.canDonate?.(s.id))) await sk.fish({ tries: 4 });
    const r = await sk.museum();
    return stepDone('donate') ? pass(`기증 ${r?.donated?.join(', ')}`) : block(`기증 단계가 안 넘어감 (${JSON.stringify(r)})`);
  });
  add('fd-home', '할 일 ⑦ 내 집 들어가기 → 밤톨 선물 → s03', async () => {
    const inn = await sk.enterHome();
    if (!inn) return block('집에 못 들어가요');
    sk.homeEntry = bot.pos();
    await bot.shot('03-home-inside', '처음 들어간 집');
    await bot.wait(0.8);
    await sk.leaveHome();
    const got = await bot.until(() => S().intro.progress().rewarded, { timeout: 60, label: '밤톨 선물' });
    await bot.settle(60);
    note('reward', { radio: bot.has('furn.radio'), acorns: bot.acorns() });
    if (!got) return block('밤톨 선물이 안 와요');
    return st().story.seen['s03-firstday-done'] ? pass(`라디오 + 🌰 → ${bot.acorns()}`) : awk('선물은 받았는데 s03 장면이 안 나옴');
  });

  add('buy-tools', '상점에서 삽·도끼 사기', async () => {
    const w0 = bot.acorns();
    const r = await sk.shop({ buy: ['tool.shovel', 'tool.axe'] });
    const has = ['shovel', 'axe'].filter(t => S().data.inventory.hasTool?.(t));
    note('buyTools', { before: w0, after: bot.acorns(), has });
    if (has.length < 2) return awk(`산 도구: ${has.join(',') || '없음'} (도토리 ${w0})`);
    return pass(`🌰 ${w0} → ${bot.acorns()}`);
  });

  add('meet', '주민 6명 만나기 (첫 이모티콘 대화 연습 포함)', async () => {
    const out = await talkRound({ party: false });
    note('meet', out);
    const opened = out.filter(x => x.opened !== false).length;
    const tut = !!fest().talkTutorial;
    await bot.shot('05-emote-talk', '이모티콘 대화 뒤');
    if (!tut) return awk(`연습이 안 끝남 · 만난 주민 ${opened}`);
    return opened >= residents().length ? pass(`만남 ${opened}/${residents().length}`) : awk(`만남 ${opened}/${residents().length}`);
  });

  add('mail', '우편함 읽기 (환영 편지)', async () => {
    const r = await sk.mail();
    note('mail', r);
    return r.opened ? pass(`안 읽은 편지 ${r.unread} → ${r.left}`) : awk('우편함 앞에서 행동 키가 안 떠요');
  });

  add('evening-bugs', '저녁 곤충 잡기 · 화석 파기 · 기증', async () => {
    const fossils = await sk.fossils(3);
    await bot.setHour(17);
    let bugs = 0;
    for (let k = 0; k < 3; k++) if (await sk.bug({ tries: 3 })) bugs++;
    const m = await sk.museum();
    note('day1extra', { fossils, bugs, donated: m?.donated });
    return pass(`화석 ${fossils} · 곤충 ${bugs} · 기증 ${m?.donated?.length ?? 0}`);
  });

  add('decor', '집 꾸미기: 라디오 놓기 · 벽지 사서 붙이기', async () => {
    const wp0 = st().house.wallpaper;
    const sold = await sellSurplus();   // 벽지 값 마련 (첫날 도구를 사면 거의 남지 않는다)
    note('decorMoney', { sold: sold?.earned, acorns: bot.acorns() });
    const r = await sk.shop({ decor: 'auto' });
    note('decorBuy', r?.decor);
    await sk.enterHome();
    sk.homeEntry = bot.pos();
    await bot.walkLocal({ x: bot.pos().x, z: bot.pos().z - 1.6 });
    const placed = bot.has('furn.radio') ? await sk.placeFurniture(s => s.id === 'furn.radio') : false;
    await bot.shot('04-home-decor', '라디오 놓고 벽지 바꾼 방');
    await sk.leaveHome();
    const wp1 = st().house.wallpaper ?? st().house.floor;
    const notes = [`라디오 ${placed ? '놓음' : '못 놓음'}`, `벽지·바닥 ${r?.decor ?? '안 삼'} (${wp0 ?? '기본'} → ${st().house.wallpaper ?? '기본'})`];
    if (!placed) return awk(notes.join(' · '));
    return r?.decor && r.decor !== 'none' && wp1 !== wp0 ? pass(notes.join(' · ')) : awk(notes.join(' · '));
  });

  // ---- 둘째 날부터: 축제 이야기 ----
  add('day2', '다음 날 → s04 멈춘 축제 (장면 중 I·M 키로 창이 안 열리나)', async () => {
    await bot.nextDay(8);
    // 장면이 도는 동안 가방(I)·지도(M) 키: 창이 열리면 안 된다 (Esc 건너뛰기가 섬폰을 같이 열던 것과 같은 길)
    const opened = [];
    const off = bot.on('ui:open', e => opened.push(e?.panel));
    if (await bot.until(() => bot.storyOn(), { timeout: 15, ui: false })) {
      await bot.wait(1.5, { ui: false });
      bot.key('KeyI'); await bot.frames(4); bot.key('KeyM'); await bot.frames(4);
      note('storyKeys', [...opened]);
      if (opened.length) bot.issue('major', 'ui', `장면 도중 키로 창이 열려요: ${opened.join(', ')}`);
    }
    off();
    await bot.settle(120);
    const seen = st().story.seen['s04-stopped-festival'];
    note('lot', S().town.movein.stage());
    if (!fest().started) return block(`축제 이야기가 시작 안 됨 (s04 ${seen ? '봄' : '안 봄'})`);
    return pass(`s04 ${seen ? '봄' : '안 봄'} · 집터 ${S().town.movein.stage()}`);
  });

  add('request-gift', '❓ 부탁 받고 들어주기 · 🎁 선물 주기', async () => {
    await bot.setHour(9);
    const out = { request: null, got: null, done: false, gift: null };
    // 부탁: 들어줄 수 있을 것 같은 주민부터 (분류가 물고기·곤충·과일·꽃·조개·나무)
    const can = r => r && (['fish', 'bug', 'fruit', 'flower', 'shell'].includes(r.cat) || ['mat.wood', 'mat.branch', 'fruit.coconut'].includes(r.id) || r.id?.startsWith('fruit.'));
    for (const slug of residents()) {
      if (out.request) break;
      const r1 = await sk.emoteTalk(slug, { ask: true, wins: 0 });
      const req = S().town.state(slug).request;
      if (r1.opened && req) { out.request = { slug, ...req }; if (!can(req)) out.request.skip = true; }
    }
    if (!out.request) return awk('부탁을 받은 주민이 없어요');
    const req = out.request;
    if (!req.skip) {
      const test = it => !!it && (req.id ? it.id === req.id : it.category === req.cat);
      keep.add(req.id ?? '');
      if (!bot.inv().some(s => s && test(bot.item(s.id)))) out.got = await sk.obtain(req);
      const r2 = await sk.emoteTalk(req.slug, { ask: true, wins: 0, requestItem: test });
      const v = S().town.state(req.slug);
      out.done = v.doneDay === bot.day();
      out.reward = bot.toasts.filter(t => t.step === 'request-gift').map(t => t.text).filter(t => /받았어요/.test(t)).at(-1) ?? null;
    }
    // 선물: 좋아하는 것을 가진 주민에게 하나 (없으면 아무 물건이나 — 보통 반응이라도 선물 흐름을 본다)
    const anyGift = it => !!it && !['tool', 'festival', 'furn'].includes(it.category) && !keep.has(it.id) && !isMaterialFor(it);   // 가구(받은 보상)는 남긴다
    for (const [k, slug] of [...residents().map(s => [0, s]), ...residents().map(s => [1, s])]) {
      const g = k === 0 ? giftTest(slug) : anyGift;
      if (!bot.inv().some(s => s && g(bot.item(s.id), s))) continue;
      const f0 = S().town.state(slug).friendship;
      const r = await sk.emoteTalk(slug, { gift: g, wins: 0 });
      out.gift = { slug, item: r.gift, before: f0, after: S().town.state(slug).friendship };
      break;
    }
    note('requestGift', out);
    const n = [`부탁 ${req.slug}: ${req.label}${req.skip ? ' (건너뜀)' : out.done ? ' → 들어줌' : ' → 못 들어줌'}${out.reward ? ` · ${out.reward}` : ''}`, out.gift ? `선물 ${out.gift.slug} ${out.gift.item} 친밀도 ${out.gift.before}→${out.gift.after}` : '선물할 것 없음'];
    if (!req.skip && !out.done) return awk(n.join(' · '));
    return pass(n.join(' · '));
  });

  add('festival-loop', '부품 5개 모으기 (주민 마음 열기 → 🎉 → 채집 → 전달), 날마다 반복', async () => {
    const maxDays = opts.maxDays ?? 10;
    const log = [];
    for (let d = 0; d < maxDays && Object.keys(fest().parts ?? {}).length < 5; d++) {
      const dayRec = { day: bot.day(), weather: S().time.weather };
      if (d > 0) { await bot.nextDay(8); await bot.settle(120); dayRec.day = bot.day(); dayRec.weather = S().time.weather; }
      await bot.setHour(9);
      dayRec.talk1 = await talkRound();
      dayRec.gather = await gatherForParts();
      await bot.setHour(13);
      dayRec.talk2 = await talkRound();        // 재료를 들고 다시 (마음을 열었으면 🎉)
      dayRec.booths = await playBooths();
      await bot.setHour(16);
      dayRec.sell = (await sellSurplus())?.earned;
      dayRec.parts = Object.keys(fest().parts ?? {}).length;
      dayRec.friend = Object.fromEntries(residents().map(s => [s, S().town.state(s).friendship]));
      dayRec.movein = S().town.movein.stage();
      log.push(dayRec);
      bot.log(`📅 ${dayRec.day} (${dayRec.weather}) 부품 ${dayRec.parts}/5 · 친밀도 ${JSON.stringify(dayRec.friend)}`);
      T.days.push(dayRec);
      if (S().town.birthday?.today?.().length) await birthday();
    }
    note('festivalLoop', log);
    const n = Object.keys(fest().parts ?? {}).length;
    T.metrics.partsDays = log.length;
    if (n < 5) return block(`${log.length}일 동안 부품 ${n}/5`);
    await bot.shot('06-all-parts', '부품 다섯 다 모음');
    return pass(`${log.length}일째에 5/5 (첫 부품 ${Object.values(fest().parts).sort()[0]})`);
  });

  async function birthday() {
    const who = S().town.birthday.today();
    for (const slug of who) {
      if (T.notes[`bday-${slug}`]) continue;
      const cake0 = bot.has('furn.birthday-cake');
      // 생일엔 하루 종일 집에 있다 → 집에 찾아가 방에서 (밖에 나와 있으면 그냥 말 걸기)
      const V = sk.villager(slug);
      let opened = false, how = '';
      if (V?.talkable) { opened = (await sk.emoteTalk(slug, { wins: 1 })).opened; how = '밖에서'; }
      if (!opened) { const v = await sk.visit(slug, { goal: { wins: 1 } }); opened = !!v.talked || v.knocked; how = v.entered ? '방에서' : v.knocked ? '노크' : `문 ${v.peek}`; }
      note(`bday-${slug}`, { day: bot.day(), opened, how, cake: bot.has('furn.birthday-cake') > cake0 });
    }
  }

  add('craft', '작업대에서 만들기 (나무 4 → 통나무 의자) · 방에 놓기', async () => {
    await bot.setHour(10);
    const w = await sk.wood(4);
    if (bot.has('mat.wood') < 4) return awk(`나무가 모자라요 (${bot.has('mat.wood')}/4)`);
    const made = await sk.craft('furn.log-chair');
    let placed = false;
    if (made) { await sk.enterHome(); sk.homeEntry = bot.pos(); await bot.walkLocal({ x: bot.pos().x - 1, z: bot.pos().z - 1.5 }); placed = await sk.placeFurniture(s => s.id === 'furn.log-chair'); await sk.leaveHome(); }
    note('craft', { wood: w, made, placed });
    if (!made) return block('작업대에서 만들기가 안 됐어요');
    return placed ? pass('통나무 의자 만들어 방에 놓음') : awk('만들었는데 방에 못 놓음');
  });

  add('birthday', '주민 생일 (시작한 날 뒤 가장 가까운)', async () => {
    // 예전엔 두부 생일(11-03)을 박아 두어, 그 뒤 날짜에 새 게임을 시작하면 막혔다 → 아무 주민이든 다음 생일까지 하루씩 넘긴다.
    // 10일까지만 (더 넘기면 이사·축제 단계가 다른 계절로 밀려 결과가 흐려진다 — 2026-11-04 60일로 했다가 1월까지 감)
    const got = () => Object.entries(T.notes).find(([k]) => k.startsWith('bday-'))?.[1] ?? null;
    if (!got()) {
      for (let k = 0; k < 10 && !got(); k++) {
        if (S().town.birthday?.today?.().length) { await birthday(); break; }
        await bot.nextDay(9); await bot.settle(60);
      }
    }
    const b = got();
    if (!b) return skip(`10일 안에 주민 생일이 없음 (오늘 ${bot.day()})`);
    return b.cake ? pass(`${b.day} ${b.how} 생일 대화 · 케이크 받음`) : awk(`${b.day} 생일 대화 ${b.opened ? `함(${b.how})` : `못 함(${b.how})`} · 케이크 ${b.cake ? '받음' : '없음'}`);
  });
  add('movein', '이사: 집터 → 이삿짐 → 단풍 입주', async () => {
    for (let k = 0; k < 6 && S().town.movein.stage() !== 'moved'; k++) { await bot.nextDay(9); await bot.settle(60); }
    const stage = S().town.movein.stage();
    const rec = st().town?.movein?.danpung;
    note('moveinRec', rec);
    if (stage !== 'moved') return block(`단계 ${stage}`);
    await bot.wait(2);
    const here = residents().includes('danpung');
    if (!here) return block('입주했다는데 주민 목록에 없음');
    // 입주한 날 아침엔 새 집 안에 있다 → 나올 때까지 기다린다 (사람도 집 앞에서 기다리거나 다른 일을 한다)
    const V = sk.villager('danpung');
    const outAt = await bot.until(() => V?.talkable, { timeout: 240, label: '단풍이 나오기' });
    note('danpungOut', { waited: outAt, hour: bot.hour().toFixed(2) });
    const r = await sk.emoteTalk('danpung', { wins: 2 });
    return r.opened ? pass(`${rec.lot} 집터 · ${rec.boxes} 이삿짐 · ${rec.moved} 입주 · 대화 ${r.sent.map(x => x.kind)}`) : awk(`입주했는데 말을 못 걸었어요 (나옴 ${outAt})`);
  });

  add('visit', '주민 집 들어가기 (방 구경)', async () => {
    // 주민은 자는 시간(밤)엔 노크만 된다. 낮에 '자주 가는 곳 = 집'으로 잠깐 들어가 있을 때 찾아간다 (시각을 바꿔 가며)
    let who = null, tried = [];
    for (const hh of [10, 12, 14, 16, 18.5]) {
      if (who) break;
      await bot.setHour(hh);
      for (let k = 0; k < 3 && !who; k++) {
        await bot.wait(15);
        const homes = residents().filter(s => S().town.atHome(s) === 'home').map(s => ({ s, h: S().world.places.villagerHouses.find(x => x.slug === s) })).filter(x => x.h?.door).sort((a, b) => bot.dist(a.h.door) - bot.dist(b.h.door));
        tried.push(`${hh}시 ${homes.length}`);
        if (!homes.length) continue;
        await sk.toVillagerDoor(homes[0].s);
        if (S().town.atHome(homes[0].s) === 'home') who = homes[0].s;
      }
    }
    note('visitTried', tried);
    if (!who) return awk(`낮에 집에 있는 주민을 못 찾았어요 (${tried.join(', ')})`);
    const v = await sk.visit(who, { goal: { wins: 1 }, shot: '07-villager-room' });
    note('visit', { who, ...v });
    if (!v.entered) return block(`${who} 집 문: 행동 키 ${v.peek}, 방에 못 들어감`);
    if (!v.left) return awk(`${who} 방에서 못 나옴`);
    return v.talked ? pass(`${who} 방에서 대화 ${v.talked}`) : awk(`${who} 방에 들어갔는데 말을 못 걸었어요`);
  });

  add('festival-day', '다 모은 다음 날 저녁 6시 → 광장에서 축제 시작 → s10 → s11 사진 → s12', async () => {
    if (Object.keys(fest().parts ?? {}).length < 5) return block('부품이 다 안 모여서 축제를 못 열어요');
    for (let k = 0; k < 3 && !S().festival.due(); k++) { await bot.nextDay(10); await bot.settle(60); }
    if (!S().festival.due()) return block(`축제 날이 안 와요 (readyDay ${fest().readyDay})`);
    await bot.setHour(18.2);
    await bot.settle(30);
    const P = S().world.places.festival;
    // 모닥불 둘레 1.6칸 자리를 돌며 '축제 시작'이 뜨는 쪽을 찾는다 (주민이 그쪽에 서 있으면 말 걸기가 먼저 — QA-17)
    let peek = null, tries = 0;
    for (const a of [0, 45, -45, 90, -90, 135, -135, 180, 0, 90]) {
      const r = a * Math.PI / 180;
      await bot.walkTo({ x: P.x + Math.sin(r) * 1.6, z: P.z + Math.cos(r) * 1.6 }, { near: 0.3, label: '광장 가운데' });
      await bot.face(P);
      peek = bot.peek(); tries++;
      if (peek === 'festival:start') break;
      if (peek === 'town:talk') bot.issue('polish', 'festival', '모닥불 앞에 주민이 서 있으면 행동 키가 축제 시작 대신 말 걸기로 가요 (우선순위 100 > 95)');
      await bot.wait(2);
    }
    note('festivalStartTries', tries);
    if (peek !== 'festival:start') return block(`광장 가운데에서 행동 키가 '${peek}' (축제 시작이 아님)`);
    bot.policy = { confirm: info => (/사진/.test(info.title) ? Math.max(0, info.buttons.findIndex(b => /괜찮아요/.test(b))) : 0) };
    const shotOn = bot.on('story:shot', e => { if (/s1[01]/.test(e?.id ?? '') && [1, 3].includes(e.index)) bot.shot(`08-${e.id}-${e.shot}`, '축제 장면').catch(() => {}); });
    bot.press('action');
    const ended = await bot.until(() => fest().endedDay, { timeout: 400, label: '엔딩' });
    await bot.settle(120);
    shotOn();
    bot.policy = {};
    const seen = st().story.seen;
    note('ending', { endedDay: fest().endedDay, photo: bot.has('furn.festival-photo'), seen: ['s10-festival', 's11-ending-photo', 's12-life-goes-on'].map(s => `${s}:${seen[s] ? 'o' : 'x'}`) });
    await bot.shot('09-after-ending', '엔딩 뒤 섬');
    if (!ended) return block('엔딩(festival:end)까지 못 감');
    const miss = ['s10-festival', 's11-ending-photo', 's12-life-goes-on'].filter(s => !seen[s]);
    if (miss.length) return awk(`안 나온 장면 ${miss}`);
    return bot.has('furn.festival-photo') ? pass(`${fest().endedDay} 엔딩 · 사진 액자 받음`) : awk('엔딩은 됐는데 사진 액자가 가방에 없음');
  });

  add('after', '엔딩 뒤 섬 생활 (다음 날 · 부스 · 대화)', async () => {
    if (!fest().endedDay) return skip('엔딩 전');
    await bot.nextDay(10);
    await bot.settle(60);
    const hud = bot.$('.fe-hud');
    const booths = await playBooths();
    const talk = await sk.emoteTalk(residents()[0], { wins: 1 });
    // 사진 액자 걸기
    let photo = false;
    if (bot.has('furn.festival-photo')) { await sk.enterHome(); sk.homeEntry = bot.pos(); await bot.walkLocal({ x: bot.pos().x + 1, z: bot.pos().z - 1.2 }); photo = await sk.placeFurniture(s => s.id === 'furn.festival-photo'); await sk.leaveHome(); }
    note('after', { hudHidden: !!hud?.hidden, booths, talk: talk.opened, photo, due: S().festival.due() });
    const odd = [];
    if (hud && !hud.hidden) odd.push('엔딩 뒤에도 진행판이 보임');
    if (!talk.opened) odd.push('주민과 말을 못 걸음');
    if (!photo) odd.push('사진 액자를 못 걸음');
    return odd.length ? awk(odd.join(' · ')) : pass(`부스 ${Object.keys(booths).length}곳 놀이 · 액자 걸음`);
  });

  add('yearly', '해마다 축제 (1년 뒤 같은 날)', async () => {
    if (!fest().heldDay || !opts.yearly) return skip(opts.yearly ? '엔딩 전' : '건너뜀 (?yearly=1 로 켜기)');
    const target = `${Number(fest().heldDay.slice(0, 4)) + 1}${fest().heldDay.slice(4)}`;
    const t0 = performance.now();
    let n = 0;
    while (bot.day() < target && n < 400) { S().time.setHour(29); await bot.frames(4); n++; }
    await bot.setHour(10);
    await bot.settle(60);
    const due = S().festival.due();
    note('yearly', { target, day: bot.day(), days: n, realSec: Math.round((performance.now() - t0) / 1000), due, hud: !bot.$('.fe-hud')?.hidden });
    return due ? pass(`${bot.day()} 축제 날 (${n}일 넘김, ${Math.round((performance.now() - t0) / 1000)}초)`) : block(`${bot.day()} 에 축제 날이 아님`);
  });
  const skip = n => ({ status: 'skip', note: n });

  return { steps, T, keep };
}

/** 단계 차례로 돌리기 → 결과 목록 */
export async function runSteps(bot, steps, { only = null, from = null, onStep = () => {} } = {}) {
  const out = [];
  let started = !from;
  for (const s of steps) {
    if (!started && s.id === from) started = true;
    if (!started || (only && !only.includes(s.id))) continue;
    bot.stepId = s.id;
    const e0 = bot.errors.length, g0 = bot.gameT, r0 = performance.now(), d0 = bot.day?.();
    bot.log(`▶ ${s.id} — ${s.title}`);
    let r;
    try { r = (await s.run()) ?? { status: 'pass' }; }
    catch (e) { r = { status: 'block', note: `봇 오류: ${e.message}` }; bot.errors.push({ step: s.id, text: `[bot] ${e.stack ?? e}` }); }
    bot.release();
    bot.policy = {};
    const rec = { id: s.id, title: s.title, ...r, gameSec: Math.round(bot.gameT - g0), realSec: Math.round((performance.now() - r0) / 100) / 10, day: d0, dayEnd: bot.day?.(), errors: bot.errors.slice(e0).map(x => x.text) };
    out.push(rec);
    bot.log(`  → ${rec.status} ${rec.note ?? ''} (${rec.gameSec}s 게임 · ${rec.realSec}s 실제)`);
    onStep(rec, out);
  }
  return out;
}
