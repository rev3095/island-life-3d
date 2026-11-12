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
  // 마음 열기 = 친구(30) + 마음이 통한 일 parts.open.wins 번 (7차 D50-A: 이모티콘 성공 · 좋아하는 선물 · 부탁 — 말풍선 아래 하트 칸에 보이는 값, M17-P3 에 2 → 10)
  const heartOpen = slug => { const v = S().town.state(slug), need = S().festival?.config?.parts?.open?.wins ?? 2; return v.friendship >= 30 && (v.emote?.wins ?? 0) + (v.bonds?.gift ?? 0) + (v.bonds?.favor ?? 0) >= need; };
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
  async function sellSurplus({ spare = false } = {}) {
    const m = S().data.museum;
    const extra = spare ? spareMaterials() : null;
    return sk.shop({ sell: (it, s) => {
      if (!it || it.category === 'tool' || it.category === 'furn' || it.category === 'festival' || keep.has(it.id)) return 0;
      if (isMaterialFor(it)) return extra?.get(s) ?? 0;
      if (m.canDonate?.(it.id)) return 0;
      return s.count;
    } });
  }
  /**
   * spare: 부품 재료라도 낼 만큼(곤충 3 · 나무 5 · 꽃 6 · 과일 6 + 섬 특산 아닌 과일 · 큰 물고기 1)만 남기고 넘는 것은 판다 → Map(칸 → 팔 개수).
   * 축제가 시작되면 물고기·과일·곤충이 모두 「아직 안 낸 재료」라 하나도 안 팔려서, 살랑 미술품 돈을 모으던 봇이 8일 동안 🌰15 를 벌었다 (M17-P5).
   * 기증 안 한 종류는 남긴다. sk.shop 이 sell 을 칸마다 여러 번 부르므로 처음 가방으로 한 번에 정한다.
   */
  function spareMaterials() {
    const quota = { chorong: 3, coco: 5, mochi: 6, pong: 6, dubu: 1 }, out = new Map(), m = S().data.museum, native = `fruit.${S().world.nativeFruit}`;
    for (const s of S().data.inventory.slots) {
      const it = s && bot.item(s.id);
      if (!it || m.canDonate?.(it.id)) continue;
      if (it.category === 'fruit' && it.id !== native) continue;   // 퐁에게 낼 다른 섬 과일
      let keepN = 0;
      for (const [slug, test] of Object.entries(PART_TESTS)) if (!hasPart(slug) && fest().started && test(bot, it) && quota[slug] > 0) { keepN = Math.min(quota[slug], s.count); quota[slug] -= keepN; break; }
      out.set(s, s.count - keepN);
    }
    return out;
  }
  /**
   * 부서진 도구 다시 사기 (도구는 내구도가 있어 다 쓰면 칸이 빈다 — 사람은 상점에서 새로 산다). 낮 매장(8–22시)만. → 산 도구 id[]
   * M17-P5: 살랑 미술품 돈을 모으다 낚싯대가 부서져 「낚싯대가 없어 낚시를 못 해요」 37번 · 번 돈 0 → 축제 부품 모으기에서 「도끼가 없어요」까지 이어졌다.
   */
  async function ensureTools(tools = ['rod', 'net', 'axe', 'shovel'], { earn = true } = {}) {
    const inv = S().data.inventory, h = S().time.now().hour;
    const need = tools.filter(t => !inv.hasTool?.(t)).map(t => `tool.${t}`);
    if (!need.length || h < 8 || h >= 22) return [];
    const cost = need.reduce((n, id) => n + (S().data.items.get(id)?.buy ?? 0), 0);
    if (bot.acorns() < cost) await sellSurplus({ spare: true });
    if (bot.acorns() < cost && earn) await earnUntil(cost, { maxRounds: 4, untilHour: 21 });   // 살랑 그림을 사고 🌰80 남은 다음 날처럼
    if (bot.acorns() < cost) return [];
    await sk.shop({ buy: need });
    return need.filter(id => inv.hasTool?.(id.slice(5)));
  }
  /**
   * 사람처럼 돈 모으기: 낚시 · 과일 흔들기(저녁엔 곤충) → 상점에 팔기를 target 이 될 때까지 (하루 maxRounds 번, untilHour 시 전까지).
   * decor(QA-10)·night-shops(M17-P5 살랑 미술품) 가 같이 쓴다. 한 번에 보통 🌰700 안팎.
   */
  async function earnUntil(target, { maxRounds = 6, untilHour = 20, from = 0 } = {}) {
    const hour = () => S().time.now().hour;
    const money = { acorns0: bot.acorns(), rounds: 0, earned: 0, tools: [] };
    for (let k = 0; k < maxRounds && bot.acorns() < target && hour() >= 5 && hour() < untilHour; k++) {
      money.rounds++;
      money.tools.push(...(await ensureTools(['rod', 'net'], { earn: false })));   // 낚싯대는 30번 쓰면 부서진다 — 사람은 다시 산다
      await sk.fish({ tries: 3 });
      if (hour() >= 19 || hour() < 5) await sk.bug({ tries: 2 });
      else {
        const trees = sk.objects('fruit-tree'), n = trees.length;
        for (let j = 0; j < 2 && n; j++) await sk.shakeTree(trees[((from + k) * 2 + j) % n]);
      }
      if (bot.free() < 4 && hour() < 18) { await sk.museum(); money.donated = (money.donated ?? 0) + 1; }   // 새 종류는 기증해서 칸을 비운다 (박물관은 18시까지)
      const sold = await sellSurplus({ spare: true });
      money.earned += sold?.earned ?? 0;
    }
    money.acorns = bot.acorns();
    return money;
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
    // 게시본(/artifact/): 사람처럼 로딩 화면의 시작 단추를 누른다 (B-50). 소리는 봇에게 필요 없어 「소리 없이 시작」
    let started = '';
    if (bot.$('#loader')) {
      const shown = await bot.until(() => { const b = bot.$('#ld-start'); return !bot.$('#loader') || (b && !b.hidden); }, { timeout: 60, label: '시작 단추' });
      const btn = bot.$('#ld-mute') ?? bot.$('#ld-sound');
      if (shown && bot.$('#loader') && btn) {
        await bot.click(btn);
        const gone = await bot.until(() => { const l = bot.$('#loader'); return !l || !bot.visible(l); }, { timeout: 20, label: '로딩 화면 닫힘' });
        if (!gone) return block('시작 단추를 눌러도 로딩 화면이 안 닫혀요');
        started = ' · 시작 단추';
      }
    }
    return pass(`서비스 ${mods.length}개${started}`);
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
    // 비·눈 오는 날엔 rainStay·snowStay 주민(보리·모찌·퐁 등)이 집에 있다 → 플레이어처럼 집을 찾아가 방에서 만난다 (생일 단계와 같은 방법)
    const weather = S().time?.weather ?? null, inside = [];
    for (const x of out) {
      if (x.opened !== false || S().town.atHome(x.slug) !== 'home') continue;
      const v = await sk.visit(x.slug, { goal: { wins: 3 } });
      inside.push(`${x.slug} ${v.entered ? '방에서' : v.knocked ? '노크' : `문 ${v.peek}`}`);
      if (v.talked) Object.assign(x, { opened: true, kinds: v.talked, room: true });
    }
    note('meet', { weather, inside, out });
    const opened = out.filter(x => x.opened !== false).length;
    const tut = !!fest().talkTutorial;
    await bot.shot('05-emote-talk', '이모티콘 대화 뒤');
    if (!tut) return awk(`연습이 안 끝남 · 만난 주민 ${opened}`);
    const tail = inside.length ? ` · ${weather} — 집에서 ${inside.join(', ')}` : '';
    return opened >= residents().length ? pass(`만남 ${opened}/${residents().length}${tail}`) : awk(`만남 ${opened}/${residents().length}${tail}`);
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

  // 요청 9 박물관 재단장: 로비 아치로 관 여섯에 걸어 들어가 기증한 것이 제자리에 있는지 (sea·art 는 분류가 없으면 「곧 열려요」)
  add('museum-halls', '박물관 관: 로비 아치 → 물고기관·곤충관·화석관·바다 생물관·미술관·별자리관 → 문 매트로 로비', async () => {
    if (!S().house?.places?.halls) return skip('박물관 관 모듈이 없어요');
    if (!(await sk.toDoor('museum', '박물관'))) return block('박물관 문에 못 감');
    if (!(await sk.enterPlace('museum', '박물관'))) return block('박물관 로비로 못 들어감');
    const H = S().house.places.halls, odd = [], got = {};
    await bot.shot('museum-lobby', '박물관 로비 (아치 여섯)');
    for (const hall of ['fish', 'bug', 'fossil', 'sea', 'art', 'star']) {
      const a = H.arches().find(x => x.hall === hall);
      if (!a) { odd.push(`${hall} 아치 없음`); continue; }
      await bot.walkLocal({ x: a.door.x + Math.sin(a.facing) * 0.35, z: a.door.z + Math.cos(a.facing) * 0.35 }, { near: 0.2, label: `${hall} 아치 앞` });
      await bot.faceDir(a.facing * 180 / Math.PI);
      if (bot.peek() !== 'museum-hall-in') { odd.push(`${hall} 아치 앞 행동 키가 ${bot.peek()}`); continue; }
      bot.press('action');
      const inside = await bot.until(() => H.where === hall && !H.busy && !S().house.passing, { timeout: 15, label: `${hall} 들어가기` });
      if (!inside) { odd.push(`${hall} 에 못 들어감`); continue; }
      const st = H.status(hall), shown = H.shown(hall);
      got[hall] = { shown, donated: st.donated, total: st.total, soon: st.soon };
      if (hall !== 'star' && shown !== st.donated) odd.push(`${hall} 전시 ${shown} ≠ 기증 ${st.donated}`);
      if (hall === 'star' && shown !== 18) odd.push(`별자리관 액자 ${shown}/18`);   // M18-P2 별자리 18
      await bot.shot(`museum-hall-${hall}`, `박물관 ${hall} 관`);
      // 나가기: 문 매트로 가서 아래로 민다 (사람처럼)
      const m = H.doormat();
      await bot.walkLocal(m, { near: 0.15, label: `${hall} 문 매트` });
      bot.stick(0, 1, false);
      await bot.until(() => !H.where && !H.busy && !S().house.passing, { timeout: 8, ui: false, label: `${hall} 나가기` });
      bot.release();
      await bot.settle(10);
      if (H.where) { odd.push(`${hall} 에서 로비로 못 나옴`); await H.leave?.(); await bot.settle(10); }
    }
    const left = await sk.leavePlace();
    note('museumHalls', got);
    if (!left) odd.push('로비에서 섬으로 못 나옴');
    const n = Object.keys(got).length;
    return odd.length ? (n ? awk(odd.join(' · ')) : block(odd.join(' · '))) : pass(`관 ${n}/6 들어감 · ${Object.entries(got).map(([k, v]) => `${k} ${v.soon ? '곧 열려요' : `${v.shown}/${v.total}`}`).join(' · ')}`);
  });

  add('decor', '집 꾸미기: 라디오 놓기 · 벽지 사서 붙이기', async () => {
    const wp0 = st().house.wallpaper, fl0 = st().house.floor;
    // QA-10 (11차 보드 D105-A): 첫날 삽·도끼를 사면 50 도토리쯤 남아 오늘의 벽지(1,200~)를 못 사고 「wp-01 → wp-01」 로 끝났다.
    // 사람처럼 벽지 값이 될 때까지 낚시·곤충·과일로 벌어 판 뒤, 지금 붙은 것과 다른 벽지(없으면 바닥)를 고른다. 상점이 닫히기(22시) 전까지만.
    const decorToday = () => (S().house?.interior?.today?.() ?? []).filter(d => !d.owned && !d.current && d.slug !== (st().house[d.kind] ?? null));
    const want = () => decorToday().sort((x, y) => (x.kind === 'wallpaper' ? 0 : 1) - (y.kind === 'wallpaper' ? 0 : 1) || x.price - y.price);
    const cheapest = () => Math.min(...decorToday().map(d => d.price));
    const sold = await sellSurplus();
    const acorns0 = bot.acorns();
    const money = decorToday().length ? await earnUntil(cheapest(), { maxRounds: 6, untilHour: 20 }) : { rounds: 0, earned: 0, acorns: bot.acorns() };
    Object.assign(money, { acorns0, earned: (sold?.earned ?? 0) + money.earned });
    note('decorMoney', money);
    const pickDecor = want().find(d => d.price <= bot.acorns()) ?? null;
    const r = pickDecor ? await sk.shop({ decor: pickDecor.slug }) : { decor: 'none' };
    note('decorBuy', r?.decor);
    await sk.enterHome();
    sk.homeEntry = bot.pos();
    await bot.walkLocal({ x: bot.pos().x, z: bot.pos().z - 1.6 });
    const placed = bot.has('furn.radio') ? await sk.placeFurniture(s => s.id === 'furn.radio') : false;
    await bot.shot('04-home-decor', '라디오 놓고 벽지 바꾼 방');
    await sk.leaveHome();
    const changed = st().house.wallpaper !== wp0 || st().house.floor !== fl0;
    const notes = [`라디오 ${placed ? '놓음' : '못 놓음'}`, `벽지·바닥 ${r?.decor ?? '안 삼'} (${wp0 ?? '기본'} → ${st().house.wallpaper ?? '기본'} · 바닥 ${st().house.floor ?? '기본'})`, `번 돈 🌰${money.earned} (${money.rounds}번)`];
    if (!placed) return awk(notes.join(' · '));
    return r?.decor && r.decor !== 'none' && changed ? pass(notes.join(' · ')) : awk(notes.join(' · '));
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

  // M12 밤·새벽 (보드 night D106–D114 = A): 둘째 날 밤 달빛 가게 → 새벽 천막 카드 뽑기 → 다음 날 오늘 운세 칸. 토요일이면 야시장 노점도.
  // 문·계산대·카드 창은 모두 키·단추로 (시계만 time.setHour 로 당긴다).
  add('night', '밤·새벽: 달빛 가게(22–3시) 들어가 별밤과 말하기 → 새벽 3시 천막에서 카드 뽑기 → 다음 날 운세 칸', async () => {
    const N = S().night;
    if (!N) return block('밤 모듈(night)이 없어요');
    if (!N.open) return skip('밤 콘텐츠가 아직 안 열림 (첫날 안내를 마친 다음 날부터)');
    const odd = [], got = {};
    const enter = async (kind, label) => {
      for (let k = 0; k < 20 && !W().places[kind]; k++) await bot.wait(0.5);
      if (!W().places[kind]) { odd.push(`${label} 건물이 안 섬`); return false; }
      if (!(await sk.toDoor(kind, label))) return false;
      if (bot.peek() !== 'night:door') { odd.push(`${label} 문 앞 행동 키가 ${bot.peek()}`); return false; }
      bot.press('action');
      if (await bot.until(() => S().story?.playing, { timeout: 4 })) { await bot.wait(5.5); await bot.shot(`night-${kind}-scene`, `${label} 첫 방문 장면`); }
      // 처음 들어갈 때는 문 앞에서 첫 방문 장면(s20·s21)이 먼저 나온다 (봇은 장면을 끝까지 본다 → 그 뒤 들어감)
      const scene = kind === 'moonshop' ? 's20-moonshop-first' : 's21-tent-first';
      const ok = await bot.until(() => S().house.where === kind && !S().house.passing, { timeout: 60, label: `${label} 들어가기` });
      (got.scenes ??= {})[scene] = !!S().story?.seen?.(scene);
      if (!ok) { odd.push(`${label} 안으로 못 들어감`); return false; }
      await bot.walkLocal(S().house.places.info(kind).talk, { near: 0.2, label: `${label} 계산대 앞` });
      await bot.faceDir(0);
      await bot.shot(`night-${kind}`, `${label} 안`);
      return true;
    };
    const W = () => S().world;
    // 1) 밤 10시 반 달빛 가게
    await bot.setHour(22.5);
    await bot.settle(30);
    if (await enter('moonshop', '달빛 가게')) {
      let who = null;
      bot.policy = { dialog: (texts, speaker) => { who ??= speaker; const i = texts.findIndex(t => /구경/.test(t)); return i >= 0 ? i : texts.length - 1; } };
      if (bot.peek() === 'night:desk') await bot.act('action', { timeout: 40 });
      else odd.push(`달빛 가게 계산대 앞 행동 키가 ${bot.peek()}`);
      bot.policy = {};
      got.shop = who;
      if (!who) odd.push('별밤과 말을 못 함');
      await sk.leavePlace();
    }
    // 2) 새벽 3시 반 천막: 카드 뽑기
    await bot.setHour(27.5);
    await bot.settle(30);
    if (await enter('tent', '새벽 천막')) {
      let flipped = false;
      bot.policy = {
        dialog: texts => { const i = texts.findIndex(t => /카드 뽑기/.test(t)); return i >= 0 ? i : texts.length - 1; },
        card: (kind, el, card) => {
          if (!card?.classList.contains('nt-card')) return false;   // 카드 뽑기 창 (bot.top 은 kind 'card')
          if (!flipped) { const b = card.querySelector('.nt-pick:not([disabled])'); if (b) { bot.click(b); flipped = true; return true; } }
          const take = [...card.querySelectorAll('.pk-btn')].find(b => b.textContent.trim() === '받기' && !b.hidden);
          if (take) { bot.click(take); return true; }
          return true;
        },
      };
      if (bot.peek() === 'night:desk') await bot.act('action', { timeout: 60 });
      else odd.push(`천막 탁자 앞 행동 키가 ${bot.peek()}`);
      bot.policy = {};
      got.card = st().night?.tarot?.card ?? null;
      if (!got.card) odd.push('카드를 못 뽑음');
    for (const [id, seen] of Object.entries(got.scenes ?? {})) if (!seen && S().story?.scene?.(id)) odd.push(`첫 방문 장면 ${id} 가 안 나옴`);
      await sk.leavePlace();
    }
    // 3) 다음 날: 오늘 운세 칸
    await bot.nextDay(8);
    await bot.settle(30);
    got.fortune = N.fortune()?.id ?? null;
    const chip = bot.$('.nt-chip');
    got.chip = !!chip && !chip.hidden;
    if (got.card && got.fortune !== got.card) odd.push(`뽑은 카드(${got.card})가 다음 날 기운이 아님 (${got.fortune})`);
    if (got.card && !got.chip) odd.push('오늘 운세 칸이 안 보임');
    // 4) 토요일이면 야시장
    const m = N.market();
    if (m.today) {
      await bot.setHour(20);
      await bot.settle(30);
      got.market = N.market().open;
      if (!got.market) odd.push('토요일 밤 8시인데 야시장이 안 열림');
    }
    note('night', got);
    return odd.length ? awk(odd.join(' · ')) : pass(`별밤 대화 · 카드 ${got.card} → 다음 날 ${got.fortune}${m.today ? ' · 야시장' : ''}`);
  });

  // 요청 8 별자리: 밤에 박물관 앞 망원경대 → 행동 키 → 망원경 보기(UI-32)에서 방향키·줌 키로 이 계절 별자리 하나를 가운데에 → 찰칵(UI-33) → 도감 「⭐ 별자리」
  add('stars', '별자리: 밤 9시 박물관 앞 망원경 → 방향키로 별자리 맞추기 → 찰칵 → 섬폰 도감 별자리 칸', async () => {
    const ST = S().stars;
    if (!ST) return skip('별자리 모듈이 없어요');
    await bot.setHour(21);
    await bot.settle(20);
    if (S().time.weather === 'rain' || S().time.weather === 'snow' || S().time.weather === 'cloudy') {
      for (let k = 0; k < 4 && ['rain', 'snow', 'cloudy'].includes(S().time.weather); k++) { await bot.nextDay(21); await bot.settle(30); }
    }
    for (let k = 0; k < 20 && !ST.stand(); k++) await bot.wait(0.5);
    const stand = ST.stand();
    if (!stand) return block('망원경대가 안 섬');
    await bot.walkTo({ x: stand.x, z: stand.z + 0.95 }, { near: 0.25, label: '망원경대 앞' });
    await bot.faceDir(0);
    if (bot.peek() !== 'stars:scope') return block(`망원경대 앞 행동 키가 ${bot.peek()}`);
    const n0 = ST.count();
    bot.press('action');
    if (!(await bot.until(() => ST.viewing, { timeout: 5, ui: false, label: '망원경 보기' }))) return block('망원경 보기가 안 열림');
    await bot.shot('stars-scope', '망원경 보기 (UI-32)');
    const sc = ST.scope, list = ST.list().filter(c => c.season === S().time.now().season && !c.found);
    if (!list.length) { bot.key('Escape'); return pass('이 계절 별자리는 이미 다 찍음'); }
    const c = list[0];
    // 사람처럼 방향키를 누르고 있다가 뗀다 (화면이 가운데를 맞추면 찰칵)
    const win = bot.win ?? window, doc = win.document;
    const hold = async (code, until, max = 12) => {
      const t = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body;
      t.dispatchEvent(new win.KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
      const end = bot.gameT + max;
      while (bot.gameT < end && !until() && !sc.card) await bot.stepFrame();
      t.dispatchEvent(new win.KeyboardEvent('keyup', { code, bubbles: true }));
    };
    const dAz = () => ((c.az - sc.view.az + 540) % 360) - 180;
    if (dAz() < 0) await hold('ArrowLeft', () => dAz() >= 0); else await hold('ArrowRight', () => dAz() <= 0);
    if (sc.view.alt < c.alt) await hold('ArrowUp', () => sc.view.alt >= c.alt); else await hold('ArrowDown', () => sc.view.alt <= c.alt);
    await bot.until(() => sc.card, { timeout: 4, ui: false, label: '찰칵' });
    const card = sc.card;
    if (card) await bot.shot('stars-capture', '찍은 결과 (UI-33)');
    bot.key('Enter');
    await bot.frames(4);
    bot.key('Escape');
    await bot.until(() => !ST.viewing, { timeout: 3, ui: false });
    await bot.settle(10);
    // 섬폰 → 도감 → ⭐ 별자리 (그동안 봇이 섬폰을 닫지 않게)
    bot.policy = { card: kind => kind === 'phone' };
    bot.press('phone');
    await bot.until(() => bot.top()?.kind === 'phone', { timeout: 4, ui: false });
    const dexBtn = [...doc.querySelectorAll('.pk-stack button')].find(b => /도감/.test(b.textContent));
    if (dexBtn) await bot.click(dexBtn);
    await bot.frames(4);
    const tab = [...doc.querySelectorAll('.pk-stack [role=tab]')].find(b => /별자리/.test(b.textContent));
    if (tab) await bot.click(tab);
    await bot.frames(4);
    const cells = doc.querySelectorAll('.pk-dex-stars .pk-dex-cell:not(.is-unknown)').length;
    if (tab) await bot.shot('stars-dex', '섬폰 도감 별자리 칸');
    bot.policy = {};
    bot.key('Escape'); await bot.frames(3); bot.key('Escape');
    await bot.settle(10);
    note('stars', { id: c.id, card, n0, n1: ST.count(), dexTab: !!tab, cells, view: sc.view });
    if (!card || ST.count() !== n0 + 1) return block(`${c.name} 을 못 찍음 (시야 ${JSON.stringify(sc.view)})`);
    const odd = [];
    if (!tab) odd.push('도감에 별자리 탭이 없음');
    else if (cells !== ST.count()) odd.push(`도감 별자리 칸 ${cells} ≠ 찍은 수 ${ST.count()}`);
    return odd.length ? awk(odd.join(' · ')) : pass(`${c.name} 찰칵 · 도감 ${ST.count()}/18`);
  });

  // P54 밤 특별 상점 (D165–D169): 운세 부스(20–3시)에서 여명에게 카드 → 여우 상인 살랑(오는 밤만)에게 미술품 감정·사기 → 이상한 천막(오는 밤만) 들어가 진열 보기
  // → 낮에 선물 상자가 있으면 열기. 가게가 안 온 밤은 다음 날로 (여우는 6일, 천막은 7일 넘게 안 오면 꼭 온다). 시계만 당긴다.
  add('night-shops', '밤 상점: 운세 부스 카드 → 여우 상인 살랑 미술품 → 이상한 천막 → 선물 상자', async () => {
    const N = S().night;
    if (!N?.places?.().includes('foxshop')) return skip('밤 특별 상점이 없는 판 (P54 전)');
    if (!N.open) return skip('밤 콘텐츠가 아직 안 열림');
    const odd = [], got = { days: 0 };
    const W = () => S().world;
    const enter = async (kind, label) => {
      if (!W().places[kind]) return false;
      if (!(await sk.toDoor(kind, label))) return false;
      if (bot.peek() !== 'night:door') { odd.push(`${label} 문 앞 행동 키가 ${bot.peek()}`); return false; }
      bot.press('action');
      if (await bot.until(() => S().story?.playing, { timeout: 4 })) { await bot.wait(5.5); await bot.shot(`night-${kind}-scene`, `${label} 첫 방문 장면`); }
      const ok = await bot.until(() => S().house.where === kind && !S().house.passing, { timeout: 60, label: `${label} 들어가기` });
      if (!ok) { odd.push(`${label} 안으로 못 들어감`); return false; }
      const info = S().house.places.info(kind);
      if (info.talk) { await bot.walkLocal(info.talk, { near: 0.2, label: `${label} 말 거는 자리` }); await bot.faceDir(0); }
      await bot.shot(`night-${kind}`, `${label} 안`);
      return true;
    };
    // 1) 운세 부스: 여명에게 카드 뽑기 (오늘 아직 안 뽑았으면)
    await bot.setHour(20.5);
    await bot.settle(30);
    if (await enter('fortune', '운세 부스')) {
      let flipped = false, who = null;
      bot.policy = {
        dialog: (texts, speaker) => { who ??= speaker; const i = texts.findIndex(t => /카드 뽑기/.test(t)); return i >= 0 ? i : texts.length - 1; },
        card: (kind, el, card) => {
          if (!card?.classList.contains('nt-card')) return false;
          if (!flipped) { const b = card.querySelector('.nt-pick:not([disabled])'); if (b) { bot.click(b); flipped = true; return true; } }
          const take = [...card.querySelectorAll('.pk-btn')].find(b => b.textContent.trim() === '받기' && !b.hidden);
          if (take) { bot.click(take); return true; }
          return true;
        },
      };
      if (bot.peek() === 'night:desk') await bot.act('action', { timeout: 60 });
      else odd.push(`운세 부스 탁자 앞 행동 키가 ${bot.peek()}`);
      bot.policy = {};
      got.booth = { who, card: st().night?.tarot?.card ?? null, flipped };
      if (!who) odd.push('운세 부스에서 여명과 말을 못 함');
      await sk.leavePlace();
    } else odd.push('운세 부스가 안 섬');
    // 2)–4) 여우 상인 · 이상한 천막 · 선물 상자: 올 때까지 밤마다 (최대 8일)
    // M17-P5: 살랑의 미술품은 🌰4,000–5,600 이라 처음 밤엔 못 산다 (2026-11-13 전체 플레이 「못 삼(도토리)」 → fake-art 건너뜀).
    // 사람처럼: 값을 들어 두고 → 낮에 낚시·과일로 벌어 판 뒤 → 살랑이 다시 온 밤에 산다. 살랑 말투(「색이 특별하지」·「독특한 판」·「묘한 맛」)로
    // 가품인 줄 알아채면 그걸 산다 (가품을 느루에게 보여 주는 fake-art 단계를 보려고). 진품만 있는 밤은 그냥 나온다.
    const FAKE_CUE = /특별하지콩|독특한 판|묘한 맛/;
    const hasFake = () => S().data.inventory.slots.some(s => s && S().data.items.get(s.id)?.fake);
    const artPrices = (S().data.items.list?.('art') ?? []).map(it => it.buy).filter(Boolean);
    let wantPrice = 0;   // 살랑에게 들은 가품 값 (모아야 할 돈)
    const foxVisit = async () => {
      const said = [], tried = [], heard = [];
      let bought = null, n = null;
      for (let round = 0; round < 4 && !bought; round++) {
        let pick = null, cue = null, price = null, declined = false;
        bot.policy = {
          dialog: (texts, speaker, text) => {
            said.push(speaker);
            if (texts.includes('미술품 보기')) return texts.indexOf('미술품 보기');
            if (texts.includes('살게요')) {
              const m = /🌰\s*([\d,]+)/.exec(text || '');
              price = m ? Number(m[1].replace(/,/g, '')) : null;
              const prev = [...bot.transcript].reverse().find(l => l.who === speaker && l.text && l.text !== text)?.text ?? '';
              cue = FAKE_CUE.test(prev) ? 'fake' : 'real';
              heard.push({ name: pick, cue, price });
              if (cue === 'fake' && price != null && bot.acorns() >= price) return texts.indexOf('살게요');
              declined = true;
              return texts.indexOf('그만둘래요');
            }
            if (texts[texts.length - 1] === '그만' && texts.length > 1) {   // 고르기: 아직 안 들어 본 작품
              n ??= texts.length - 1;
              const i = texts.findIndex((t, k) => k < texts.length - 1 && !tried.includes(t));
              if (i < 0) return texts.length - 1;
              tried.push(pick = texts[i]);
              return i;
            }
            return texts.length - 1;
          },
        };
        const before = S().data.inventory.slots.filter(Boolean).map(s => s.id);
        if (bot.peek() !== 'night:desk') { odd.push(`여우 상인 계산대 앞 행동 키가 ${bot.peek()}`); break; }
        await bot.act('action', { timeout: 60 });
        bot.policy = {};
        await bot.settle(10);
        bought = S().data.inventory.slots.filter(Boolean).map(s => s.id).find(id => id.startsWith('art.') && !before.includes(id)) ?? null;
        if (!pick || (n != null && tried.length >= n)) break;   // 다 들어 봄 (또는 고르기까지 못 감)
        if (declined && cue === 'fake') break;                   // 가품인데 돈이 모자람 → 벌어서 다시
      }
      const fakeHeard = heard.find(h => h.cue === 'fake');
      if (!bought && fakeHeard?.price) wantPrice = fakeHeard.price;
      return { talked: said.includes('살랑'), heard, bought };
    };
    got.foxNights = [];
    for (let d = 0; d < 9 && !((got.fox?.bought || hasFake()) && got.odd); d++) {
      if (d) { await bot.nextDay(8); got.days++; }
      await bot.settle(20);
      const g = N.giftSpot?.();
      if (g && !got.gift) {
        const w0 = bot.acorns(), bag0 = JSON.stringify(S().data.inventory.slots);
        await bot.walkTo(g, { near: 0.9, label: '선물 상자' });
        await bot.face(g);
        if (bot.peek() === 'night:gift') { await bot.act('action'); got.gift = { acorns: bot.acorns() - w0, bag: JSON.stringify(S().data.inventory.slots) !== bag0, gone: !N.giftSpot() }; }
        else odd.push(`선물 상자 앞 행동 키가 ${bot.peek()}`);
      }
      // 낮: 살랑에게 가품을 살 돈 모으기 (값을 들었으면 그 값, 아직이면 미술품 값 아는 만큼 — 공략을 아는 사람)
      if (!got.fox?.bought && !hasFake() && d) {
        const target = wantPrice || (artPrices.length ? Math.max(...artPrices) : 0);
        if (bot.acorns() < target) {
          if (S().time.now().hour < 9) await bot.setHour(9);
          const m = await earnUntil(target, { maxRounds: 8, untilHour: 19, from: d * 3 });
          (got.earn ??= []).push({ day: bot.day(), target, ...m });
        }
      }
      await bot.setHour(21.5);
      await bot.settle(30);
      if (!got.fox?.bought && !hasFake() && W().places.foxshop && (await enter('foxshop', '여우 상인 가게'))) {
        const v = await foxVisit();
        got.foxNights.push({ day: bot.day(), acorns: bot.acorns(), heard: v.heard.map(h => `${h.cue}:${h.price}`), bought: v.bought });
        got.fox = { day: bot.day(), talked: v.talked || got.fox?.talked, stock: N.debug?.today?.().fox ?? null, bought: v.bought, scene: !!S().story?.seen?.('s27-fox-first'), shown: S().house.places.shown('foxshop') };
        if (!v.talked) odd.push('살랑과 말을 못 함');
        if (!got.fox.shown) odd.push('여우 상인 받침에 미술품이 없음');
        await sk.leavePlace();
      }
      if (!got.odd && W().places.oddtent && (await enter('oddtent', '이상한 천막'))) {
        got.odd = { day: bot.day(), shown: S().house.places.shownSpots('oddtent'), scene: !!S().story?.seen?.('s28-odd-tent-first') };
        if (!got.odd.shown.length) odd.push('이상한 천막 받침이 비어 있음');
        await sk.leavePlace();
      }
    }
    note('nightShops', got);
    if (!got.fox) odd.push(`여우 상인이 ${got.days + 1}밤 동안 안 옴`);
    if (!got.odd) odd.push(`이상한 천막이 ${got.days + 1}밤 동안 안 섬`);
    const msg = `부스 카드 ${got.booth?.card ?? '-'} · 살랑 ${got.fox ? `${got.fox.stock?.length ?? 0}점${got.fox.bought ? ` · 산 것 ${got.fox.bought}` : wantPrice ? ` · 못 삼(도토리 ${wantPrice})` : ' · 가품 없음'} · ${got.foxNights.length}밤${got.earn ? ` · 번 돈 🌰${got.earn.reduce((n, e) => n + e.earned, 0)}` : ''}` : '-'} · 천막 ${got.odd?.shown?.[0]?.id ?? '-'} · 선물 ${got.gift ? (got.gift.acorns > 0 ? `도토리 ${got.gift.acorns}` : '물건') : '없음'} · ${got.days}일 더`;
    return odd.length ? awk(`${odd.join(' · ')} — ${msg}`) : pass(msg);
  });

  // M17-P2 (D181-A) 가품 대사: 가방에 가품 미술품이 있으면(살랑·선물 상자에서) 박물관 느루에게 내밀어 본다 — 「이건 가품이에요…」 + 다른 점 한 줄 → 돌려받음
  add('fake-art', '가품 미술품: 박물관 기증 창에서 가품을 고르면 느루가 다른 점을 짚고 돌려준다', async () => {
    const fakeSlot = () => S().data.inventory.slots.findIndex(s => s && S().data.items.get(s.id)?.fake);
    if (fakeSlot() < 0) return skip('가방에 가품 미술품이 없음 (살랑에게 못 샀거나 진품을 삼)');
    const id = S().data.inventory.slots[fakeSlot()].id;
    await bot.setHour(11);
    await bot.settle(10);
    if (!(await sk.toDoor('museum', '박물관'))) return awk('박물관 문 자리가 없음');
    const inside = await sk.enterPlace('museum', '박물관');
    const told = [], said = [];
    const off = bot.ctx.events.on('museum:fake-told', e => told.push(e));
    let picked = false;
    bot.policy = {
      dialog: texts => { said.push(texts.join('/')); const i = texts.findIndex(t => /기증하러|괜찮아요/.test(t)); return i >= 0 ? i : texts.length - 1; },
      card: (kind, el, card) => {
        if (kind !== 'museum') return false;
        if (!picked) { bot.click(card.querySelector('.pk-donate-go')); return true; }
        bot.click(card.querySelector('.pk-x'));
        return true;
      },
      bag: mode => { if (mode !== 'donate' || picked) return null; picked = true; return fakeSlot(); },
    };
    await bot.act('action', { timeout: 60 });
    bot.policy = {};
    off();
    if (inside) await sk.leavePlace();
    const kept = S().data.inventory.count(id) > 0, donated = S().data.museum.has(id);
    note('fakeArt', { id, told, kept, donated, said: said.length });
    if (!told.length) return awk(`느루가 가품 대사를 안 함 (${id}, 골랐나 ${picked})`);
    if (!kept || donated) return awk(`가품이 가방에서 빠짐 (남음 ${kept} · 기증됨 ${donated})`);
    return pass(`${S().data.items.get(id)?.name} — 「${told[0].tell}」`);
  });

  add('festival-loop', '부품 5개 모으기 (주민 마음 열기 → 🎉 → 채집 → 전달), 날마다 반복', async () => {
    const maxDays = opts.maxDays ?? 10;
    const log = [];
    for (let d = 0; d < maxDays && Object.keys(fest().parts ?? {}).length < 5; d++) {
      const dayRec = { day: bot.day(), weather: S().time.weather };
      if (d > 0) { await bot.nextDay(8); await bot.settle(120); dayRec.day = bot.day(); dayRec.weather = S().time.weather; }
      await bot.setHour(9);
      dayRec.talk1 = await talkRound();
      const bought = await ensureTools();
      if (bought.length) dayRec.tools = bought;
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
    note('danpungOut', { waited: outAt, hour: bot.hour().toFixed(2), weather: S().time?.weather ?? null });
    // 비·눈 오는 날엔 일과대로 집에 있다 → 집에 찾아가 방에서 말 건다 (moving-in 과 같게)
    let r = { opened: false, sent: [] };
    if (outAt || S().town.atHome('danpung') !== 'home') r = await sk.emoteTalk('danpung', { wins: 2 });
    else { const v = await sk.visit('danpung', { goal: { wins: 2 } }); r = { opened: !!v.talked, sent: (v.talked || []).map(kind => ({ kind })) }; }
    return r.opened ? pass(`${rec.lot} 집터 · ${rec.boxes} 이삿짐 · ${rec.moved} 입주 · 대화 ${r.sent.map(x => x.kind)}`) : awk(`입주했는데 말을 못 걸었어요 (나옴 ${outAt})`);
  });

  add('visit', '주민 집 들어가기 (방 구경)', async () => {
    // 주민은 자는 시간(밤)엔 노크만 된다. 낮에 '자주 가는 곳 = 집'으로 잠깐 들어가 있을 때, 또는 저녁에 잠들기 1~2시간 전 집에 들어와 있을 때(D57) 찾아간다 (시각을 바꿔 가며)
    let who = null, tried = [];
    for (const hh of [10, 12, 14, 16, 18.5, 20.5, 21.5]) {
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

  // 9차 M9 섬 꾸미기 (보드 wave9 D86-A): 섬폰 앱 단추 → 아래 칸에서 고르기 → Space 로 놓기 · X 로 고치기 → Space 로 치우기 → Esc.
  // 빈 칸 찾기는 읽기만 (world.objects.on), 놓기·치우기는 모두 키·단추로.
  add('island-decor', '섬 꾸미기: 섬폰 → 돌길 셋 · 나무 울타리 둘 놓기 · 하나 치우기 (이어짐·저장 기록)', async () => {
    if (S().house?.inside) await sk.leaveHome();
    await bot.settle(30);
    const isl = S().world.island, O = S().world.objects, dec = () => S().decor;
    if (!dec()) return block('섬 꾸미기 모듈이 없어요');
    const before = dec().list().length;
    // 집 둘레 빈 땅(풀밭·모래): 가로 3 × 세로 5 칸이 비고 같은 높이 (문 앞 자리 빼고), 가까운 곳부터
    const home = S().world.places.playerHouse ?? { tx: Math.floor(isl.w / 2), tz: Math.floor(isl.h / 2) };
    const free = (x, z, lv) => ['grass', 'sand'].includes(isl.tileAt(x, z)) && !O.on(x, z).length && !isl.flagsAt(x, z) && isl.levelAt(x, z) === lv && !dec().debug.reservedSet.has(`${x},${z}`);
    let spot = null;
    for (let r = 2; r < 48 && !spot; r++) for (let dz = -r; dz <= r && !spot; dz++) for (let dx = -r; dx <= r && !spot; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const tx = home.tx + dx, tz = home.tz + dz, lv = isl.levelAt(tx, tz);
      let ok = true;
      for (let z = tz - 1; z <= tz + 3 && ok; z++) for (let x = tx - 1; x <= tx + 1 && ok; x++) ok = free(x, z, lv);
      if (ok) spot = { tx, tz };
    }
    if (!spot) return awk('섬에 빈 땅(3×5)을 못 찾음');
    const stand = (tx, tz) => isl.toWorld(tx, tz + 1);   // 그 칸 바로 남쪽에 서서 북쪽(앞)을 본다
    const goTo = async (tx, tz) => { await bot.walkTo(stand(tx, tz), { near: 0.25, label: '섬 꾸미기 자리' }); await bot.faceDir(0); };
    await goTo(spot.tx, spot.tz + 2);
    // 섬폰 → 🪴 섬 꾸미기
    bot.press('phone');
    await bot.until(() => bot.$('.pk-app[data-app="decor"]'), { timeout: 5, ui: false });
    await bot.click(bot.$('.pk-app[data-app="decor"]'));
    if (!await bot.until(() => dec().active, { timeout: 5, ui: false })) return block('섬폰 「섬 꾸미기」를 눌러도 놓기 모드가 안 켜짐');
    const pick = async kind => { await bot.click(bot.$(`.pk-decor-item[data-decor="${kind}"]`)); await bot.frames(3); return dec().pick?.kind === kind; };
    const why = [];
    // 미리 보기 칸(앞 칸)이 목표 칸이 될 때까지 다시 서 본다 (칸 가운데에서 조금 어긋나면 앞 칸이 옆으로 갈 수 있다)
    const placeAt = async (tx, tz) => {
      for (let k = 0; k < 3; k++) {
        await goTo(tx, tz); await bot.frames(3);
        const a = dec().view?.anchor;
        if (a?.tx === tx && a?.tz === tz) break;
      }
      const n = dec().list().length;
      bot.press('action'); await bot.frames(4);
      const ok = dec().list().length > n;
      if (!ok) why.push(`${tx},${tz}: ${dec().view?.why ?? '?'} (앞 칸 ${dec().view?.anchor?.tx},${dec().view?.anchor?.tz})`);
      return ok;
    };
    const res = { path: 0, fence: 0, removed: false };
    if (await pick('path-stone')) for (const z of [2, 1, 0]) if (await placeAt(spot.tx, spot.tz + z)) res.path++;
    if (await pick('fence-wood')) for (const x of [0, 1]) if (await placeAt(spot.tx + x, spot.tz - 1)) res.fence++;
    await bot.shot('11-island-decor', '섬 꾸미기: 돌길 셋 · 울타리 둘');
    const link = O.on(spot.tx, spot.tz + 1).find(o => o.kind === 'path-stone')?.variant ?? '';
    const fenceLink = O.on(spot.tx, spot.tz - 1).find(o => o.kind === 'fence-wood')?.variant ?? '';
    // 고치기(X) → 앞의 돌길 하나 치우기 (Space)
    bot.key('KeyX'); await bot.frames(3);
    await goTo(spot.tx, spot.tz);
    const n = dec().list().length;
    bot.press('action'); await bot.frames(4);
    res.removed = dec().list().length === n - 1;
    bot.press('esc'); await bot.frames(3);
    const saved = st().island.added.filter(a => a.data?.decor).length;
    note('islandDecor', { ...res, link, fenceLink, saved, before, after: dec().list().length, open: dec().active, why });
    await bot.settle(10);
    const odd = [];
    if (res.path < 3) odd.push(`돌길 ${res.path}/3 ${why.join(' / ')}`);
    if (res.fence < 2) odd.push(`울타리 ${res.fence}/2`);
    if (!/\+n/.test(link) || !/\+s/.test(link)) odd.push(`돌길이 안 이어짐 (${link || '없음'})`);
    if (!/\+e/.test(fenceLink)) odd.push(`울타리가 안 이어짐 (${fenceLink || '없음'})`);
    if (!res.removed) odd.push('치우기 안 됨');
    if (dec().active) odd.push('Esc 로 안 꺼짐');
    if (saved !== dec().list().length) odd.push(`저장 기록 ${saved} ≠ 놓인 것 ${dec().list().length}`);
    return odd.length ? awk(odd.join(' · ')) : pass(`돌길 3 · 울타리 2 이어짐 · 하나 치움 · 저장 기록 ${saved}`);
  });

  // M14 집과 섬이 자란다 (결정 D150–D153): 우편함 Space → 밤톨 「지어 주세요!」 → 다음 날 넓어진 1층 · 커진 겉모양 → 빚 갚기 (지갑에 있는 만큼) →
  // 빚을 다 갚았으면 2층도 짓고 계단을 걸어 오르내린다 → 섬폰 「⭐ 섬 평가」 열어 별·주민 한마디. 봇은 시계만 넘기고 우편함·창·걷기는 키로.
  add('home-grow', '집 증축: 도토리상점 밤톨에게 「집을 넓히고 싶어요」 → 다음 날 넓어진 방 · 겉모양 → 우편함에서 빚 갚기 → (2층 · 계단 오르내리기) → 섬폰 섬 평가', async () => {
    const H = () => S().house, G = () => H()?.grow;
    if (!G()) return block('집 증축(house.grow)이 없어요');
    if (H().inside) await sk.leaveHome();
    await bot.settle(20);
    const odd = [], log = {};
    const mailbox = async pick => {
      const ph = S().world.places.playerHouse, at = S().town?.mail?.spot ?? { x: ph.door.x + 1, z: ph.door.z };
      if (S().town?.mail?.unread?.()?.length) await sk.mail();   // 안 읽은 편지가 있으면 먼저 읽는다 (그동안 우편함 Space = 편지)
      await bot.approach(at, { dist: 0.75, label: '우편함' });
      if (bot.peek() !== 'house-grow') return `우편함 앞 행동 키가 '${bot.peek()}'`;
      const said = [];
      bot.policy = { dialog: texts => { said.push(texts.join('/')); const i = texts.findIndex(pick); return i >= 0 ? i : texts.length - 1; } };
      await bot.act('action', { timeout: 30 });
      bot.policy = {};
      await bot.settle(10);
      return said;
    };
    // M17-P2 (D185-A): 넓히기는 밤톨에게 (우편함은 빚 갚기만 — 빚이 없으면 우편함 Space = 편지 town:mail)
    const shopAsk = async pick => {
      await bot.setHour(10);
      await bot.settle(10);
      if (!(await sk.toDoor('shop', '상점'))) return '상점 문 자리가 없음';
      const inside = await sk.enterPlace('shop', '상점');
      if (!/town:(shop|firstday)/.test(bot.peek() ?? '')) { if (inside) await sk.leavePlace(); return `밤톨 앞 행동 키가 '${bot.peek()}'`; }
      const said = [];
      bot.policy = { dialog: texts => { said.push(texts.join('/')); let i = texts.findIndex(t => /집을 넓히고 싶어요/.test(t)); if (i < 0) i = texts.findIndex(pick); return i >= 0 ? i : texts.length - 1; } };
      await bot.act('action', { timeout: 30 });
      bot.policy = {};
      await bot.settle(10);
      if (inside) await sk.leavePlace();
      if (!said.some(t => /집을 넓히고 싶어요/.test(t))) return `밤톨 대화에 「집을 넓히고 싶어요」가 없음 (${said.join(' | ')})`;
      return said;
    };
    const build = async want => {
      if (!G().debt && !S().town?.mail?.unread?.()?.length) {   // 빚이 없으면 우편함은 편지 (집 넓히기 아님)
        const ph = S().world.places.playerHouse, at = S().town?.mail?.spot ?? { x: ph.door.x + 1, z: ph.door.z };
        await bot.approach(at, { dist: 0.75, label: '우편함' });
        if (bot.peek() === 'house-grow') odd.push('빚이 없는데 우편함이 집 넓히기를 잡음');
      }
      const r = await shopAsk(t => /지어 주세요/.test(t));
      if (typeof r === 'string') { odd.push(r); return false; }
      if (G().pending !== want) { odd.push(`${want}단계 짓기 시작 안 됨 (${r.join(' | ')})`); return false; }
      await bot.nextDay(9);
      await bot.settle(30);
      if (G().stage !== want) { odd.push(`다음 날 ${want}단계가 안 지어짐 (지금 ${G().stage})`); return false; }
      return true;
    };
    const repayAll = async () => {
      if (!G().debt) return true;
      // 뒤 단계(시계로 낮 → 상점에서 사기 등)가 쓸 도토리는 남긴다: 3,000 넘게 있으면 1,000 만 갚는다 (빚이 그보다 적으면 다 갚기)
      if (bot.acorns() < Math.min(G().debt, 1000) + 3000) return false;
      const r = await mailbox(t => (G().debt <= 1000 ? /다 갚기/ : /^1,000 갚기/).test(t));
      if (typeof r === 'string') odd.push(r);
      return G().debt === 0;
    };
    // 1단계: 방 넓히기
    if (G().stage < 1 && !await build(1)) return awk(odd.join(' · '));
    const ext = (S().world.home?.objects ?? S().world.objects).list().filter(o => /^house-(player|grown)/.test(o.kind)).map(o => o.kind);
    log.exterior = ext;
    if (!ext.includes('house-grown-1') && G().stage === 1) odd.push(`겉모양이 안 바뀜 (${ext.join(',')})`);
    await sk.enterHome();
    const f0 = H().room;
    log.room = `${f0.w}×${f0.d}`;
    if (f0.w !== 10 || f0.d !== 10) odd.push(`1층이 10×10 이 아님 (${log.room})`);
    await bot.shot('m14-home-wide', '넓힌 1층 (10×10)');
    await sk.leaveHome();
    // 빚 갚기 → 다 갚았으면 2층
    log.debt0 = G().debt; log.acorns0 = bot.acorns();
    const paid = await repayAll();
    log.debt1 = G().debt;
    if (G().debt >= log.debt0 && log.acorns0 >= 4000) odd.push(`빚을 못 갚음 (빚 ${G().debt}, 도토리 ${bot.acorns()})`);
    if (paid && G().stage < 2) await build(2);
    if (G().stage >= 2) {
      await sk.enterHome();
      const goStairs = async to => {
        const s = H().grow.stairs().find(x => x.to === to);
        if (!s) { odd.push(`${to}층 가는 계단 없음`); return false; }
        await bot.walkLocal(s.from, { near: 0.2, label: '계단 앞' });
        const from = H().grow.level, dx = s.x - s.from.x, dz = s.z - s.from.z, d = Math.hypot(dx, dz) || 1;
        const end = bot.gameT + 8;
        while (H().grow.level === from && bot.gameT < end) { if (!S().player.frozen) bot.stick(dx / d, dz / d, false); await bot.stepFrame(); }
        bot.release();
        await bot.until(() => !S().player.frozen, { timeout: 4 });
        await bot.frames(10);
        if (H().grow.level !== to) { odd.push(`계단으로 ${to}층에 못 감 (지금 ${H().grow.level})`); return false; }
        return true;
      };
      log.up = await goStairs(1);
      if (log.up) await bot.shot('m14-home-2f', '계단으로 올라온 2층');
      log.down = log.up && await goStairs(0);
      await sk.leaveHome();
    } else log.second = '빚이 남아 2층은 다음에';
    // 섬폰 → ⭐ 섬 평가
    bot.press('phone');
    await bot.until(() => bot.$('.pk-app[data-app="rating"]'), { timeout: 5, ui: false });
    const app = bot.$('.pk-app[data-app="rating"]');
    if (!app) odd.push('섬폰에 섬 평가 줄이 없어요');
    else {
      await bot.click(app);
      await bot.until(() => bot.$('.rt-stars'), { timeout: 5, ui: false });
      log.stars = Number(bot.$('.rt-stars')?.dataset.stars ?? 0);
      log.talk = bot.$('[data-rating-talk]')?.textContent?.trim().slice(0, 80) ?? '';
      if (!(log.stars >= 1 && log.stars <= 5)) odd.push('섬 평가 별이 안 보여요');
      if (!log.talk) odd.push('주민 한마디가 없어요');
      await bot.shot('m14-rating', '섬폰 섬 평가');
      bot.press('esc'); await bot.until(() => !bot.$('.rt-stars'), { timeout: 3, ui: false });
    }
    bot.press('esc'); await bot.until(() => !bot.blocking(), { timeout: 3, ui: false });
    log.stage = G().stage; log.debt = G().debt;
    note('homeGrow', log);
    return odd.length ? awk(odd.join(' · ')) : pass(`${log.stage}단계 · 1층 ${log.room} · 빚 ${log.debt}${log.up ? ' · 계단 오르내림' : log.second ? ` · ${log.second}` : ''} · 별 ${log.stars}`);
  });

  // 10차 M10-P4 이사 오가기 (보드 wave10 D94-A): 엔딩 뒤 7일마다 새 주민이 빈 집터로, 30일 넘게 산 주민이 가끔 "떠나 볼까…".
  // 봇은 시계만 넘기고(다음 날) 우편함·말 걸기·창 단추로만 한다. 누가 물을 마음인지는 읽기만 (사람은 💭 말풍선을 보고 말을 건다).
  const moving = () => S().town.moving;
  add('moving-in', '엔딩 뒤 이사 오기: 오기 전날 편지 → 표지판 → 이삿짐 → 새 주민 입주 → 말 걸기 → 저녁 첫 만남 장면', async () => {
    if (!fest().endedDay) return skip('엔딩 전');
    if (!moving()) return block('이사 오가기(town.moving) 서비스가 없어요');
    let slug = null, letter = null;
    const days = [];
    const offMail = bot.on('mail:new', e => { if (e?.kind === 'moving' && e.from === moving().state().coming) letter ??= { from: e.from, day: bot.day() }; });
    for (let k = 0; k < 14; k++) {
      slug = moving().state().coming ?? slug;
      if (slug && residents().includes(slug)) break;
      await bot.nextDay(9); await bot.settle(60);
      slug = moving().state().coming ?? slug;
      if (slug) days.push(`${bot.day().slice(5)} ${S().town.movein.stage(slug)}`);
      if (letter && !letter.read) { letter.read = (await sk.mail()).opened; }
    }
    offMail();
    note('movingIn', { slug, letter, days, lots: moving().lots().filter(l => l.free || l.owner === slug) });
    if (!slug) return block(`엔딩(${fest().endedDay}) 뒤 14일 안에 이사가 시작되지 않음`);
    if (!residents().includes(slug)) return block(`${slug} 입주 안 됨 (${days.join(', ')})`);
    await bot.shot('12-moving-in', `${slug} 입주한 날`);
    const V = sk.villager(slug);
    const outAt = await bot.until(() => V?.talkable, { timeout: 240, label: `${slug} 나오기` });
    // 이삿날이 비·눈이면 새 주민도 일과대로(rainStay·snowStay) 집에 있다 → 사람처럼 집에 찾아가 방에서 말 건다
    let talk = { opened: false }, visited = null;
    if (outAt || S().town.atHome(slug) !== 'home') talk = await sk.emoteTalk(slug, { wins: 1 });
    else {
      const v = await sk.visit(slug, { goal: { wins: 1 } });
      visited = { weather: S().time?.weather ?? null, entered: v.entered, talked: v.talked, knocked: v.knocked, left: v.left };
      talk = { opened: !!v.talked };
    }
    // 이삿날 저녁: 첫 만남 장면 (s17–s19, 트리거 move-in — 플레이어가 밖에 있을 때만 town:welcome)
    if (S().house?.where || S().house?.inside || Math.abs(bot.pos().x) > 100) await bot.exitRoom();
    await bot.setHour(17.6);
    await bot.settle(120);
    const seenScene = () => Object.keys(st().story?.seen ?? {}).find(id => /^s1[789]-/.test(id) && id.includes(slug)) ?? null;
    if (!seenScene()) await bot.until(() => !!seenScene() && !bot.storyOn(), { timeout: 90, label: '첫 만남 장면' });
    const scene = seenScene();
    note('movingInTalk', { outAt, talk: talk.opened, visited, scene, at17: { where: S().house?.where ?? null, inside: !!S().house?.inside, x: +bot.pos().x.toFixed(1), welcomed: moving().state().welcomed?.[slug] ?? null } });
    const odd = [];
    if (!letter) odd.push('오기 전날 편지가 없음');
    else if (!letter.read) odd.push('편지를 못 읽음');
    if (!talk.opened) odd.push('새 주민에게 말을 못 걸음');
    if (!scene) odd.push('첫 만남 장면이 안 나옴');
    return odd.length ? awk(`${slug}: ${odd.join(' · ')} (${days.join(', ')})`) : pass(`${slug} ${days.join(' → ')} · 편지 ${letter.day} · 대화${visited ? ` (${visited.weather} — 집에 찾아가서)` : ''} · 장면 ${scene}`);
  });

  add('moving-out', '떠나 볼까: 30일 넘게 산 주민이 물으면 허락 → 이삿짐 → 떠남 → 빈 집터 표지판 → 떠난 주민 편지', async () => {
    if (!fest().endedDay) return skip('엔딩 전');
    if (!moving()) return block('이사 오가기(town.moving) 서비스가 없어요');
    const MAX = opts.leaveDays ?? 50;
    let who = null, n = 0;
    for (; n < MAX; n++) {
      who = residents().find(s => moving().asking(s)) ?? null;
      if (who) break;
      await bot.nextDay(10); await bot.settle(60);
    }
    if (!who) return skip(`${MAX}일 안에 떠나 볼까 묻는 주민이 없었어요 (${bot.day()}) — ?date= 로 손 점검 (docs/notes/m10-moving.md)`);
    const V = sk.villager(who);
    let asked = null, how = [];
    const ask = async () => {
      if (!(await sk.reach(who))) return false;
      bot.policy = { dialog: () => 0, confirm: info => { asked = info; return /떠나 볼까/.test(info.title) ? Math.max(0, info.buttons.indexOf('허락')) : null; } };
      await bot.act('action', { timeout: 60 });
      bot.policy = {};
      return true;
    };
    // 밖에 있으면 다가가 말 걸고, 집에 있으면(비·저녁) 집에 들어가 방에서 말 건다 — 시각을 바꿔 가며
    for (const hh of [10, 12, 14, 16, 18.5]) {
      if (asked || !moving().asking(who)) break;
      await bot.setHour(hh);
      await bot.until(() => V?.talkable || S().town.atHome(who) === 'home', { timeout: 40, label: `${who} 찾기` });
      if (V?.talkable) { how.push(`${hh}시 밖`); await ask(); continue; }
      if (S().town.atHome(who) === 'home' && await sk.toVillagerDoor(who)) {
        await bot.act('action', { timeout: 20 });
        if (await bot.until(() => Math.abs(bot.pos().x) > 100 && !S().house?.passing, { timeout: 8 })) {
          how.push(`${hh}시 방`);
          await bot.wait(1);
          await ask();
          await bot.exitRoom(); await bot.settle(20);
        }
      }
    }
    if (!asked) return block(`${who} 에게 말을 걸었는데 떠나기 묻기 창이 안 나옴 (${how.join(', ') || '못 찾음'} · 물을 마음 ${moving().asking(who)})`);
    const plan = moving().state().leaving;
    if (plan?.slug !== who) return block(`허락했는데 떠날 일정이 없음 (${JSON.stringify(plan)})`);
    await bot.shot('13-leave-asked', `${who} 떠나기 허락`);
    await bot.nextDay(10); await bot.settle(60);
    const boxes = S().world.objects.list('moving-boxes').some(o => o.id.includes(`leave-${who}`));
    await bot.nextDay(10); await bot.settle(60);
    const gone = !residents().includes(who) && !S().town.villagers.some(v => v.slug === who);
    const next = moving().state().coming;
    await bot.shot('14-left-lot', `${who} 떠난 집터`);
    let away = null;
    const offMail = bot.on('mail:new', e => { if (e?.from === who && e.kind === 'away') away ??= bot.day(); });
    for (let k = 0; k < 5 && !away; k++) { await bot.nextDay(10); await bot.settle(60); }
    offMail();
    const read = away ? (await sk.mail()).opened : false;
    note('movingOut', { who, waitedDays: n, asked: asked?.text, boxes, gone, next, away, read });
    const odd = [];
    if (!boxes) odd.push('다음 날 이삿짐이 안 보임');
    if (!gone) odd.push('그다음 날에도 섬에 있음');
    if (!away) odd.push('떠난 뒤 편지가 안 옴');
    return odd.length ? awk(`${who}: ${odd.join(' · ')}`) : pass(`${who} ${n}일 뒤 물음 → 허락 → 이삿짐 → 떠남 · 다음 이사 ${next ?? '없음'} · 편지 ${away}`);
  });

  // 11차 시계 (p33-clock): 섬폰 「🕰 시계」 바늘을 사람처럼 끌어 시각을 바꾼다 (setHour 지름길 없이)
  /** 섬폰 → 시계 → 시침을 앞으로 돌려 hh 시(다음에 오는 그 시각)로 → 적용. → { ok, from, to, hour, day } */
  const clockTo = async hh => {
    if (bot.blocking()) await bot.settle(10);
    const keep = bot.policy;
    bot.policy = { ...keep, card: (kind, el, card) => !!card?.classList.contains('pk-tclock') || !!keep.card?.(kind, el, card) };   // 시계 창은 봇이 닫지 않게
    try { return await clockSteps(hh); } finally { bot.policy = keep; }
  };
  const clockSteps = async hh => {
    bot.press('phone');
    if (!await bot.until(() => bot.$('.pk-app[data-app="clock"]'), { timeout: 5, ui: false })) return { ok: false, why: '섬폰에 시계 줄이 없어요' };
    await bot.click(bot.$('.pk-app[data-app="clock"]'));
    if (!await bot.until(() => bot.$('.pk-tclock-dial'), { timeout: 5, ui: false })) return { ok: false, why: '시계 창이 안 열려요' };
    const dial = bot.$('.pk-tclock-dial');
    const from = Number(dial.getAttribute('aria-valuenow'));                   // 0~1439 (지금 시·분)
    // P47 오늘·내일: 바늘은 오늘(새벽 5시 ~ 다음 새벽 5시) 안에서만 → 오늘 안의 그 시각까지 앞으로든 뒤로든 (밤 → 낮은 거꾸로 돌린다)
    const g = m => (m < 300 ? m + 1440 : m);
    const want = g(hh * 60 % 1440) - g(from);                                   // + 앞으로 · − 뒤로 (분)
    // 시침 끝을 잡고 시계 방향으로 10° (= 20분) 씩 끈다
    const r = dial.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.2;
    const at = deg => ({ clientX: cx + Math.sin(deg * Math.PI / 180) * R, clientY: cy - Math.cos(deg * Math.PI / 180) * R });
    const pe = (el, type, deg) => el.dispatchEvent(new bot.win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, ...at(deg) }));
    let a = ((from / 60) % 12) / 12 * 360;
    pe(bot.$('.pk-tclock-dial .h-hour .hit'), 'pointerdown', a);
    const dir = Math.sign(want);
    for (let left = Math.abs(want) / 2; left > 0; left -= 10) { a += dir * Math.min(10, left); pe(dial, 'pointermove', a); await bot.stepFrame(); }
    pe(dial, 'pointerup', a);
    // 5분 단위로 붙은 끝은 ←→ (15분) 로 맞춘다
    for (let k = 0; k < 8; k++) {
      const cur = Number(dial.getAttribute('aria-valuenow')), diff = ((((hh * 60 - cur) % 1440) + 1440 + 720) % 1440) - 720;
      if (Math.abs(diff) < 8) break;
      dial.focus(); bot.key(diff > 0 ? 'ArrowRight' : 'ArrowLeft'); await bot.stepFrame();
    }
    const to = Number(dial.getAttribute('aria-valuenow'));
    const apply = [...bot.$$('.pk-tclock .pk-btn')].find(b => b.textContent === '적용');
    if (!apply || apply.disabled) return { ok: false, why: `적용 단추가 없거나 꺼짐 (창 ${!!bot.$('.pk-tclock')}, ${from} → ${to})` };
    await bot.click(apply);
    await bot.until(() => !bot.$('.pk-tclock'), { timeout: 3, ui: false });
    bot.press('esc');                                                             // 섬폰 닫기
    await bot.until(() => !bot.blocking(), { timeout: 3, ui: false });
    await bot.frames(4);
    return { ok: true, from, to, hour: bot.hour(), day: bot.day() };
  };

  // p41: 화면 왼쪽 위 원형 시계(HUD) — 시침을 끌어 놓으면 바로 그 시각, 남은 끝은 ←→ 미리 보기 + Enter
  const hudClockTo = async hh => {
    if (bot.blocking()) await bot.settle(10);
    const dial = bot.$('.pk-hclock-dial');
    if (!dial) return { ok: false, why: 'HUD 원형 시계가 없어요' };
    const from = Number(dial.getAttribute('aria-valuenow'));
    const want = (((hh * 60 - from) % 1440) + 1440) % 1440;
    const r = dial.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.25;
    const at = deg => ({ clientX: cx + Math.sin(deg * Math.PI / 180) * R, clientY: cy - Math.cos(deg * Math.PI / 180) * R });
    const pe = (el, type, deg) => el.dispatchEvent(new bot.win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'mouse', button: 0, buttons: 1, ...at(deg) }));
    let a = ((from / 60) % 12) / 12 * 360;
    pe(bot.$('.pk-hclock-dial .h-hour .hit'), 'pointerdown', a);
    for (let left = want / 2; left > 0; left -= 10) { a += Math.min(10, left); pe(dial, 'pointermove', a); await bot.stepFrame(); }
    pe(dial, 'pointerup', a);                                                     // 놓으면 바로 적용
    await bot.stepFrame();
    for (let k = 0; k < 8; k++) {
      const cur = Number(dial.getAttribute('aria-valuenow')), diff = ((((hh * 60 - cur) % 1440) + 1440 + 720) % 1440) - 720;
      if (Math.abs(diff) < 8) break;
      dial.focus(); bot.key(diff > 0 ? 'ArrowRight' : 'ArrowLeft'); await bot.stepFrame();
    }
    if (bot.$('.pk-hclock-dial.is-preview')) { dial.focus(); bot.key('Enter'); }
    await bot.frames(4);
    return { ok: true, from, to: S().time.now().hour * 60 + S().time.now().minute, hour: bot.hour(), day: bot.day() };
  };

  add('clock-phone', '시계로 밤 → 밤 곤충 잡기 · 낮으로 → 상점에서 사기 (HUD 원형 시계 · 섬폰 시계 창 · ±1시간 · 빠르기)', async () => {
    if (S().house?.inside) await sk.leaveHome();
    await bot.settle(20);
    if (!S().ui?.clock) return block('섬폰 시계 창(ui.clock)이 없어요');
    const wasPaused = !!S().time.paused;
    S().time.setPaused?.(false);
    // p41 HUD 조정 칸: 빠르기 단추(한 바퀴 돌려 제자리) · +1시간 단추
    const strip = bot.$('.pk-hclock-strip');
    if (strip?.hidden) await bot.click(bot.$('.pk-hclock-dial'));             // 좁은 화면은 접혀 있다 → 시계를 눌러 펼침
    const sp0 = S().time.speed, seen = [];
    for (let k = 0; k < 4; k++) { await bot.click(bot.$('.pk-hclock-speed')); seen.push(S().time.speed); }   // P47 빠르기 넷 (번개처럼)
    const h0 = S().time.now().ms;
    await bot.click([...bot.$$('.pk-hclock-strip button')].find(b => /\+1/.test(b.textContent)));
    const plusMin = Math.round((S().time.now().ms - h0) / 60000);
    const night = await hudClockTo(21);
    if (!night.ok) return block(night.why);
    const n1 = S().time.now();
    if (n1.part !== 'night') return block(`밤으로 안 바뀜 (${n1.hour}:${n1.minute}, ${n1.part})`);
    await bot.shot('clock-night', '시계로 돌린 밤');
    const lit = S().time.nightFactor;
    const out = S().town.villagers.filter(V => V.mode !== 'home' && V.mode !== 'enter' && V.mode !== 'toDoor').length;
    const spawned = S().gather.bugs.bugs.map(b => b.id);   // 시각을 옮긴 뒤 새로 나온 곤충
    // 엔딩 뒤엔 가방이 꽉 차 있어 잡아도 못 담는다 (2026-11-11 전체 플레이: 빈칸 0 → 「밤 곤충을 못 잡음」) → 상점(22시까지)에서 남는 것을 먼저 판다
    const bagFree0 = bot.free();
    if (bagFree0 < 2) await sellSurplus();
    const bug = await sk.bug({ tries: 4 });
    const day = await clockTo(10);
    if (!day.ok) return block(day.why);
    const n2 = S().time.now();
    if (n2.part !== 'day') return block(`낮으로 안 바뀜 (${n2.hour}:${n2.minute})`);
    await bot.shot('clock-day', '시계로 돌린 낮');
    const stock = S().data.economy.stock().filter(id => !String(id).startsWith('tool.') || !S().data.inventory.hasTool?.(String(id).slice(5)));
    const cheap = stock.map(id => ({ id, p: S().data.economy.buyPrice(id) })).filter(x => x.p > 0 && x.p <= bot.acorns()).sort((x, y) => x.p - y.p)[0];
    // 상점은 가방이 꽉 차면 조용히 안 판다 (알림은 상점 자체 toast 라 봇 기록에 안 남음) → 늦은 게임처럼 가방이 차 있으면 하나 팔아 칸을 비운다
    const inv = S().data.inventory, freeSlots = () => inv.slots.filter(s => !s).length;
    const free0 = freeSlots();
    let soldFirst = null;
    if (cheap && free0 === 0) {
      await sk.shop({ sell: (it, s) => (soldFirst || !it || keep.has(it.id) || it.id.startsWith('tool.') ? 0 : ((soldFirst = it.id), s.count)) });
    }
    const w0 = bot.acorns();
    if (cheap) await sk.shop({ buy: [cheap.id] });
    note('clockPhone', { bagFree0, night, day, lit, out, spawned, bug, buy: cheap, spent: w0 - bot.acorns(), free0, soldFirst, freeAfter: freeSlots(), offset: S().time.offset, maxDay: S().time.maxDay, speeds: seen, speed: S().time.speed, plusMin });
    if (wasPaused) S().time.setPaused?.(true);   // 다음 단계도 봇 시계(setHour)로
    const bad = [];
    if (new Set(seen).size !== 4 || seen.at(-1) !== sp0) bad.push(`빠르기 단추 ${sp0} → ${seen.join('→')}`);
    if (Math.abs(plusMin - 60) > 2) bad.push(`+1시간 단추 ${plusMin}분`);
    if (lit < 0.9) bad.push(`밤 불빛 ${lit.toFixed(2)}`);
    if (!bug) bad.push('밤 곤충을 못 잡음');
    if (!cheap) bad.push('살 수 있는 물건 없음');
    else if (!(w0 - bot.acorns() > 0)) bad.push(`못 삼 (${cheap.id}${freeSlots() === 0 ? ' — 가방 꽉 참' : ''})`);
    const msg = `밤 ${Math.floor(night.to / 60)}시 곤충 ${bug ?? '-'} · 낮 ${day.day} ${Math.floor(day.to / 60)}시 ${cheap?.id ?? '-'} 🌰${w0 - bot.acorns()} · 가방 빈칸 ${free0}${soldFirst ? ` (먼저 ${soldFirst} 팔기)` : ''} · 밤에 밖 주민 ${out}`;
    return bad.length ? awk(`${bad.join(', ')} — ${msg}`) : pass(msg);
  });

  // 11차 M11-P5 옷 (보드 wave11 D100-A · D102-A): 도토리상점 「오늘의 옷」에서 하나 사기만 → (첫 옷이면 옷장을 덤으로) → 집에 옷장 놓기 → 「갈아입기」 → 입기.
  add('clothes', '옷 사기 · 갈아입기: 상점 옷 진열대 → 집 옷장 「갈아입기」 → 입기 (저장 칸)', async () => {
    const O = S().outfit;
    if (!O) return block('옷 서비스(outfit)가 없어요');
    if (S().house?.inside) await sk.leaveHome();
    if ((S().time.now().hour ?? 10) < 9 || S().time.now().hour >= 21) await clockTo(10);
    const today = O.today().filter(c => !c.owned);
    if (!today.length) return awk('오늘 살 옷이 없어요');
    const price = Math.min(...today.map(c => c.buy));
    if (bot.acorns() < price) await sellSurplus();
    const cheap = today.filter(c => c.buy <= bot.acorns()).sort((a, b) => a.buy - b.buy)[0];
    if (!cheap) return awk(`도토리가 모자라요 (🌰 ${bot.acorns()} < ${price})`);
    const w0 = bot.acorns();
    const r = await sk.shop({ clothes: cheap.id });
    const bought = O.owns(cheap.id);
    if (S().house?.places?.where === 'shop') await sk.leavePlace();
    const ch = bought ? await sk.changeClothes(cheap.id) : null;
    note('clothes', { today: O.today().map(c => c.id), pick: cheap.id, price: cheap.buy, spent: w0 - bot.acorns(), shop: r?.clothes, gift: st().flags?.wardrobeGift ?? null, change: ch, worn: O.worn() });
    const msg = `${cheap.name} 🌰${w0 - bot.acorns()} · 옷장 ${ch?.placed ? '받아서 놓음' : '있음'} · 입은 옷 ${Object.values(O.worn()).filter(Boolean).join(', ')}`;
    if (!bought) return awk(`못 삼 — ${msg}`);
    if (!ch?.wore) return awk(`갈아입기 못 함 (창 ${ch?.opened ? '열림' : '안 열림'}) — ${msg}`);
    return pass(msg);
  });

  // M16 잠수 (D160–D164): 도토리상점에서 스쿠버 키트 사기 → 해변 물가에서 행동 키로 바다에 → 헤엄 → 잠수해 바다 생물 잡기 → 물가로 나오기 → 도감·섬 일지.
  add('dive', '잠수: 상점에서 스쿠버 키트 → 해변 물가 → 헤엄 · 잠수로 바다 생물 잡기 → 나오기 (도감 · 섬 일지)', async () => {
    const D = S().gather?.dive;
    if (!D) return block('잠수(gather.dive)가 없어요');
    if (S().house?.inside) await sk.leaveHome();
    if ((S().time.now().hour ?? 10) < 9 || S().time.now().hour >= 20) await clockTo(10);
    const KIT = 'tool.scuba-kit', price = bot.item(KIT)?.buy ?? 0;
    if (!bot.has(KIT)) {
      if (bot.acorns() < price) await sellSurplus();
      if (bot.acorns() < price && !new URLSearchParams(window.location.search).get('only')) note('dive-earn', await earnUntil(price, { maxRounds: 6, untilHour: 20 }));   // 사람처럼 벌어서 산다 (M17-P5: 살랑 미술품을 사고 🌰2,450)
      // 단계만 골라 돌릴 때(?only=)는 앞 단계 벌이가 없으니 준비로만 도토리를 채운다 (check-interiors 의 「준비만 직접」과 같은 뜻 — 전체 실행은 그대로)
      if (bot.acorns() < price && new URLSearchParams(window.location.search).get('only')) {
        const short = price - bot.acorns();
        S().data.wallet.add(short);
        note('dive-setup', { topUp: short });
      }
      if (bot.acorns() < price) return awk(`도토리가 모자라 스쿠버 키트를 못 사요 (🌰 ${bot.acorns()} < ${price})`);
      const w0 = bot.acorns();
      await sk.shop({ buy: [KIT] });
      if (S().house?.places?.where === 'shop') await sk.leavePlace();
      note('dive-buy', { price, spent: w0 - bot.acorns(), has: bot.has(KIT) });
      if (!bot.has(KIT)) return block('상점에서 스쿠버 키트를 못 샀어요 (늘 파는 목록)');
    }
    const j0 = st().journal?.counts?.sea ?? 0, dex0 = (st().encyclopedia?.sea ?? []).length;
    const r = await sk.dive({ want: 1, timeout: 150 });
    const dex = (st().encyclopedia?.sea ?? []).length;
    note('dive', { ...r, dex0, dex, journal: [j0, st().journal?.counts?.sea ?? 0] });
    let msg = `${r.entered ? '들어감' : '못 들어감'} · 잠수복 ${r.suit ? '입음' : '안 보임'} · 잡은 것 ${r.caught.map(id => bot.item(id)?.name ?? id).join(', ') || '없음'} (${r.tries}번) · 도감 ${dex0}→${dex} · ${r.left ? '나옴' : '물에 남음'}`;
    if (!r.entered || !r.left) return block(msg);
    if (!r.caught.length || dex <= dex0 || !r.suit) return awk(msg);
    // 박물관 바다 생물관 (요청 9 관): 잡은 것을 느루에게 기증 → 로비 🐙 아치 → 관에 전시가 하나 늘었는지
    const H = S().house?.places?.halls;
    if (!H) return pass(msg);
    const m0 = H.status('sea')?.donated ?? 0;
    const don = await sk.museum();
    const gave = (don?.donated ?? []).filter(id => id.startsWith('sea.'));
    const hall = { gave, before: m0 };
    if (gave.length && (await sk.toDoor('museum', '박물관')) && (await sk.enterPlace('museum', '박물관'))) {
      const a = H.arches().find(x => x.hall === 'sea');
      if (a) {
        await bot.walkLocal({ x: a.door.x + Math.sin(a.facing) * 0.35, z: a.door.z + Math.cos(a.facing) * 0.35 }, { near: 0.2, label: '바다 생물관 아치 앞' });
        await bot.faceDir(a.facing * 180 / Math.PI);
        if (bot.peek() === 'museum-hall-in') {
          bot.press('action');
          if (await bot.until(() => H.where === 'sea' && !H.busy && !S().house.passing, { timeout: 15, label: '바다 생물관 들어가기' })) {
            const s = H.status('sea');
            Object.assign(hall, { shown: H.shown('sea'), donated: s.donated, total: s.total, soon: s.soon });
            await bot.shot('dive-museum-sea', '박물관 바다 생물관 (잠수로 잡아 기증)');
            const mat = H.doormat();
            await bot.walkLocal(mat, { near: 0.15, label: '바다 생물관 문 매트' });
            bot.stick(0, 1, false);
            await bot.until(() => !H.where && !H.busy && !S().house.passing, { timeout: 8, ui: false, label: '바다 생물관 나가기' });
            bot.release();
            await bot.settle(10);
            if (H.where) { await H.leave?.(); await bot.settle(10); }
          }
        } else hall.peek = bot.peek();
      }
      await sk.leavePlace();
    }
    note('dive-museum', hall);
    msg += ` · 바다 생물관 ${hall.shown ?? '?'}/${hall.total ?? '?'}`;
    if (!gave.length) return awk(`${msg} (기증 못 함)`);
    if (hall.soon || hall.shown !== hall.donated || !(hall.donated > m0)) return awk(`${msg} (관 ${JSON.stringify(hall)})`);
    return pass(msg);
  });

  // P35 무인도 투어 (보드 tour D120–D128): 선착장 끝 배 → 여행 묻기 창(첫 여행은 표 선물) → 무인도 → 과일 흔들기·광석 캐기·줍기 → 배로 돌아오기.
  // 투어 섬은 x 900 이라 봇은 섬 밖 좌표처럼 walkLocal(구역 isWalkable 로 0.25칸 길찾기)로 걷는다.
  add('tour', '무인도 투어: 선착장 배 → 표 → 무인도 → 과일·광석 캐기 → 배로 돌아오기', async () => {
    const tour = () => S().tour;
    if (!tour()) return block('무인도 투어(tour) 서비스가 없어요');
    const can = tour().canGo();
    if (!can.ok) return skip(can.reason);
    await bot.setHour(10);
    await bot.tool(null);
    // 엔딩 뒤엔 가방이 차 있어서(2026-11-10 전체 플레이: 광석 3번 · 과일 흔들기 모두 줍지 못함) 먼저 남는 것을 판다 — 사람도 빈칸을 만들고 떠난다
    const free0 = bot.free();
    if (free0 < 6) await sellSurplus();
    const free = bot.free();
    if (!(await bot.walkTo(tour().stand(), { near: 0.45, label: '선착장 끝 배' }))) return block('선착장 끝까지 못 감');
    await bot.face(tour().boat());
    if (bot.peek() !== 'tour-boat') return block(`배 앞에서 「섬 여행」이 안 떠요 (${bot.peek()})`);
    const acorns0 = bot.acorns();
    let asked = null;
    bot.policy = { confirm: info => { if (!/섬 여행/.test(info.title)) return null; asked = info.text; return Math.max(0, info.buttons.indexOf('떠나요')); } };
    // 배가 바다로 나가는 연출(약 3초)을 한 장 — 주인공이 배와 같이 동쪽으로
    const b0 = tour().boat();
    bot.press('action');
    const sailed = await bot.until(() => S().player.position.x > b0.x + 2.5 && !tour().active, { timeout: 30, label: '배 떠나기' });
    if (sailed) await bot.shot('15-tour-sail', '배가 바다로 나감');
    if (!(await bot.until(() => tour().active && !tour().busy, { timeout: 25, label: '무인도 도착' }))) return block(`무인도에 도착하지 못함 (묻기 창 ${asked ? '나옴' : '안 나옴'})`);
    const cur = tour().current, w = S().world;
    if (await bot.until(() => S().story?.playing?.id === 's22-first-tour', { timeout: 3 })) { await bot.wait(5); await bot.shot('15-tour-s22', '장면 s22 첫 섬 여행'); }
    await bot.settle(60);   // 첫 여행이면 장면 s22 (봇은 끝까지 본다)
    const s22 = !!S().story?.seen?.('s22-first-tour');
    await bot.shot('15-tour-arrive', `무인도 ${cur.shape}`);
    const tag = bot.$('.pk-tour-tag')?.textContent ?? null;   // UI-23 오른쪽 위 섬 이름 칸 (B-13)
    const got = {}, inv0 = Object.fromEntries(bot.inv().filter(Boolean).map(s => [s.id, s.count]));
    // 물체 앞 설 자리: 남·동·서·북 중 몸(반지름 0.25)이 들어가는 가까운 쪽 — 늘 남쪽으로만 가다 그쪽이 막힌 바위 앞에서 멈췄다 (M17-P5 「광석 바위에서 걷다가 막혔어요」)
    const frontOf = (o, d) => {
      const ok = q => [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]].every(([a, c]) => w.island.isWalkable(q.x + a, q.z + c));
      return [[0, d], [d, 0], [-d, 0], [0, -d]].map(([a, c]) => ({ x: o.x + a, z: o.z + c })).filter(ok).sort((p, q) => bot.dist(p) - bot.dist(q))[0] ?? { x: o.x, z: o.z + d };
    };
    // 과일나무 흔들기 (투어 섬 과일 = 망고·리치)
    const ft = w.objects.list('fruit-tree')[0];
    if (ft) {
      await bot.walkLocal(frontOf(ft, 0.85), { timeout: 40, label: '무인도 과일나무' });
      await bot.face(ft);
      if (bot.peek() === 'gather-shake') { await bot.act('action'); await bot.wait(0.8); await sk.pickupAround(2.4); }
    }
    // 광석 바위 캐기 (삽)
    const ore = w.objects.list('ore-rock')[0];
    let oreHits = 0;
    const shovel = bot.has('tool.shovel') > 0;   // 새 게임 첫날엔 삽이 없다 (단계만 돌릴 때)
    if (ore && shovel && (await bot.tool('shovel'))) {
      await bot.walkLocal(frontOf(ore, 0.95), { timeout: 40, label: '광석 바위' });
      await bot.face(ore);
      for (let k = 0; k < 3 && bot.peek() === 'tour-ore'; k++) { await bot.act('action'); oreHits++; }
      await bot.tool(null);
      await sk.pickupAround(2.4);
    }
    for (const s of bot.inv().filter(Boolean)) if (s.count > (inv0[s.id] ?? 0)) got[s.id] = s.count - (inv0[s.id] ?? 0);
    // 돌아오기
    const b = tour().boat();
    await bot.walkLocal({ x: b.x - 1.45, z: b.z }, { timeout: 60, label: '무인도 배' });
    await bot.face(b);
    const backPeek = bot.peek();
    bot.policy = { confirm: info => (/돌아가기/.test(info.title) ? Math.max(0, info.buttons.indexOf('돌아가요')) : null) };
    if (backPeek === 'tour-boat') await bot.act('action', { timeout: 30 });
    bot.policy = {};
    const home = await bot.until(() => !tour().active && !tour().busy, { timeout: 25, label: '본섬 도착' });
    const tagGone = !bot.$('.pk-tour-tag');
    note('tour', { s22, sailed, tag, tagGone, shape: cur.shape, guest: cur.guest, paid: acorns0 - bot.acorns(), got, oreHits, shovel, free0, free, backPeek, home, pos: bot.pos() });
    if (!home) return block(`배로 못 돌아옴 (배 앞 ${backPeek})`);
    const odd = [];
    if (!tag) odd.push('섬 이름 칸(UI-23)이 안 보임');
    if (!tagGone) odd.push('돌아온 뒤에도 섬 이름 칸이 남음');
    if (!Object.keys(got).some(id => /^fruit\.(mango|lychee)$/.test(id))) odd.push(`무인도 과일을 못 얻음 (가방 빈칸 ${free0} → ${free})`);
    if (shovel && !oreHits) odd.push('광석 바위를 못 침');
    if (!s22 && S().story?.scene?.('s22-first-tour')) odd.push('첫 여행인데 장면 s22 가 안 나옴');
    if (Math.abs(bot.pos().x) > 100) odd.push('돌아왔는데 섬 밖 좌표');
    return odd.length ? awk(odd.join(' · ')) : pass(`${cur.shape} · 얻은 것 ${Object.entries(got).map(([k, v]) => `${k}×${v}`).join(', ')} · 광석 ${shovel ? `${oreHits}번` : '삽 없음'}`);
  });

  add('daily', 'M13 매일 할 거리: 바닷가 유리병 → 레시피 쪽지 · 새총으로 선물 풍선 · 유성우 밤 소원 → 다음 날 별 조각 · 수·일 행상', async () => {
    const D = () => S().daily;
    if (!D()) return block('매일 할 거리(daily) 서비스가 없어요');
    if (!D().open) await bot.nextDay(9);   // 단계만 돌릴 때: 첫날 안내 다음 날부터 열린다
    if (!D().open) return skip('아직 안 열림 (첫날 안내 다음 날부터)');
    const odd = [], res = {};
    await bot.tool(null);
    // ① 아침 바닷가 유리병 → 쪽지 → 레시피 하나 열림 (확인 창은 「좋아요」)
    await bot.setHour(9);
    await bot.frames(30);
    bot.policy = { confirm: info => (/레시피 쪽지/.test(info.title) ? 0 : null) };
    const known0 = D().recipes.known().length, sp = D().bottle.spot();
    if (sp) {
      await bot.walkTo({ x: sp.x, z: sp.z + 0.9 }, { near: 0.35, label: '바닷가 유리병' });
      await bot.face(sp);
      res.bottlePeek = bot.peek();
      if (res.bottlePeek === 'daily:bottle') { await bot.act('action'); await bot.settle(10); }
      res.bottle = D().bottle.opened();
      res.recipes = D().recipes.known().length - known0;
      if (!res.bottle) odd.push(`유리병을 못 엶 (${res.bottlePeek})`);
      await bot.shot('16-daily-bottle', `유리병 · 새 레시피 ${res.recipes}`);
    } else odd.push(D().bottle.opened() ? '오늘 유리병은 이미 열었음' : '바닷가에 유리병이 없음');
    bot.policy = {};
    // ② 새총: 가방에 없으면 도토리상점에서 (도구 진열) — 안 되면 쪽지로 연 레시피로
    const hasSling = () => !!S().data.inventory.hasTool?.('sling');
    if (!hasSling()) await sk.shop({ buy: ['tool.sling'] });
    if (!hasSling() && D().recipes.known().includes('tool.sling')) {   // 상점 진열 받침에 새총 자리가 아직 없으면 쪽지 레시피로 (나무 3 · 나뭇가지 4)
      if (bot.has('mat.wood') < 3) await sk.wood(3);
      for (const o of sk.objects('tree')) { if (bot.has('mat.branch') >= 4) break; await sk.shakeTree(o); }
      await sk.craft('tool.sling');
    }
    res.sling = hasSling();
    // ③ 선물 풍선: 오늘 계획에서 아직 안 한 것의 시각으로 → 풍선 밑으로 따라가 새총 Space
    if (res.sling) {
      const plan = D().balloons.plan().filter(e => !D().balloons.done().includes(e.i));
      const e = plan[0];
      if (e) {
        await bot.setHour(e.at + 0.05);
        const seen = await bot.until(() => D().balloons.list().length > 0, { timeout: 15, label: '풍선 나타남' });
        res.balloonSeen = seen;
        if (seen) {
          await bot.tool('sling');
          let shots = 0;
          for (let k = 0; k < 40 && !D().balloons.done().includes(e.i); k++) {
            const b = D().balloons.list()[0];
            if (!b) break;
            const under = { x: b.x + (b.x > bot.pos().x ? 1.2 : -1.2), z: b.z + 0.8 };
            const land = S().world.island.isWalkable(under.x, under.z) && !S().world.island.isWater(under.x, under.z);
            if (!D().balloons.canHit() && land) await bot.walkTo(under, { near: 0.9, timeout: 5, quiet: true, allowTeleport: false, label: '풍선 밑' });
            else if (!D().balloons.canHit()) await bot.wait(1);   // 아직 바다 위 — 섬으로 올 때까지 기다린다
            await bot.face(b);
            if (D().balloons.canHit() && bot.peek() === 'daily:sling') { bot.press('action'); shots++; await bot.wait(1.2); }
          }
          await bot.until(() => D().balloons.done().includes(e.i), { timeout: 8, label: '풍선 맞힘' });
          res.balloon = { shots, hit: D().balloons.done().includes(e.i) && !D().balloons.list().some(x => x.i === e.i) };
          if (res.balloon.hit) { await bot.shot('16-daily-balloon', '풍선 선물'); await sk.pickupAround(3.5); }
          else odd.push(`풍선을 못 맞힘 (쏜 수 ${shots})`);
          await bot.tool(null);
        } else odd.push('풍선 시각인데 풍선이 안 나옴');
      }
    } else odd.push('새총을 못 구함');
    // ④ 유성우 밤: 이번 주·다음 주 유성우 날까지 넘기고 21시 밖에서 올려다보기(R 꾹) + Space
    let met = null;
    for (let d = 0; d < 16 && !met; d++) {
      if (D().meteor.tonight()) { met = bot.day(); break; }
      await bot.nextDay(9);
    }
    res.meteorDay = met;
    if (met) {
      await bot.setHour(21);
      await bot.frames(20);
      const on = await bot.until(() => D().meteor.active, { timeout: 10, label: '별똥별' });
      if (await bot.until(() => S().story?.playing?.id === 's23-first-meteor', { timeout: 3 })) { await bot.wait(4); await bot.shot('16-daily-s23', '장면 s23 첫 유성우'); }
      await bot.settle(40);
      res.meteor = on;
      bot.key('KeyR', { up: false });
      await bot.until(() => D().meteor.canWish(), { timeout: 4, label: '올려다보기' });
      res.wishPeek = bot.peek();
      for (let k = 0; k < 2 && bot.peek() === 'daily:wish'; k++) { bot.press('action'); await bot.wait(2.4); }
      await bot.shot('16-daily-wish', '올려다보고 소원');
      bot.keyUp('KeyR');
      res.wishes = D().meteor.wishes();
      if (!res.wishes) odd.push(`소원을 못 빎 (${res.wishPeek})`);
      // 다음 날 아침 바닷가 별 조각
      const before = bot.has('mat.star-yellow') + bot.has('mat.star-pink') + bot.has('mat.star-blue');
      await bot.nextDay(8);
      await bot.frames(30);
      const stars = S().gather.drops.list.filter(dd => /^mat\.star-/.test(dd.rec.item));
      res.starsOnBeach = stars.length;
      for (const s of stars.slice(0, 3)) { await bot.walkTo({ x: s.x, z: s.z + 0.5 }, { near: 0.5, quiet: true, label: '별 조각' }); await sk.pickupAround(1.5); }
      res.starsGot = bot.has('mat.star-yellow') + bot.has('mat.star-pink') + bot.has('mat.star-blue') - before;
      if (res.wishes && !stars.length) odd.push('소원을 빌었는데 다음 날 별 조각이 없음');
    } else odd.push('16일 안에 맑은 유성우 밤이 없음');
    // ⑤ 행상: 수·일까지 넘기고 낮 11시 광장 수레 → 구경 → 하나 사기
    for (let d = 0; d < 7 && !D().peddler.today(); d++) await bot.nextDay(9);
    await bot.setHour(11);
    await bot.frames(30);
    if (bot.acorns() < 2000) await sellSurplus();   // 행상 물건 값 (꽃 모종·묘목 640–1600) — 사람도 팔고 온다
    res.acorns = bot.acorns();
    const ps = D().peddler.spot();
    res.peddler = !!ps;
    if (ps) {
      await bot.walkTo({ x: ps.front.x, z: ps.front.z + 0.4 }, { near: 0.4, label: '행상 수레' });
      if (await bot.until(() => S().story?.playing?.id === 's24-peddler-first', { timeout: 3 })) { await bot.wait(4); await bot.shot('16-daily-s24', '장면 s24 행상 첫 방문'); }
      await bot.settle(40);
      await bot.face({ x: ps.keeper.x, z: ps.keeper.z });
      res.peddlerPeek = bot.peek();
      const w0 = bot.acorns();
      let menu = 0;
      bot.policy = {
        dialog: texts => {
          const i = texts.findIndex(t => /구경/.test(t));
          if (i >= 0) return i;
          if (texts.some(t => /🌰/.test(t))) {   // 살 수 있는 것 중 가장 싼 것 하나 → 다음엔 그만
            menu++;
            const price = t => Number((/🌰 ([\d,]+)/.exec(t)?.[1] ?? '0').replace(/,/g, ''));
            const ok = texts.map((t, k) => [k, price(t)]).filter(([k, v]) => v > 0 && v <= bot.acorns() && !/가지고 있음/.test(texts[k])).sort((a, b) => a[1] - b[1]);
            return menu === 1 && ok.length ? ok[0][0] : texts.length - 1;
          }
          return texts.length - 1;
        },
        confirm: info => (/사기/.test(info.title) ? Math.max(0, info.buttons.findIndex(b => /살게요/.test(b))) : 0),
      };
      if (res.peddlerPeek === 'daily:peddler') { await bot.act('action', { timeout: 60 }); await bot.settle(20); }
      bot.policy = {};
      res.peddlerSpent = w0 - bot.acorns();
      res.s24 = !!S().story?.seen?.('s24-peddler-first');
      if (!res.s24 && S().story?.scene?.('s24-peddler-first')) odd.push('행상 첫 방문인데 장면 s24 가 안 나옴');
      await bot.shot('16-daily-peddler', '행상 송이 수레');
      if (res.peddlerPeek !== 'daily:peddler') odd.push(`행상 앞 행동 키가 ${res.peddlerPeek}`);
      else if (!res.peddlerSpent) odd.push('행상에게서 아무것도 못 삼');
    } else odd.push('행상 수레가 안 나옴');
    note('daily', res);
    return odd.length ? awk(odd.join(' · ')) : pass(`레시피 +${res.recipes} · 풍선 ${res.balloon?.shots ?? 0}발 · 소원 ${res.wishes} → 별 조각 ${res.starsGot} · 행상 🌰${res.peddlerSpent}`);
  });

  // M15 「주민과 더 가깝게」: 우편함 편지 쓰기(UI-26, 선물 동봉) → 친구 이상 주민에게 🎣(낚싯대) = 같이 낚시 → 다음 날 답장 → 섬폰 📷 앨범(UI-27) → 추억 액자(FU-71)
  add('villagers-close', 'M15 주민과 더 가깝게: 편지 쓰기 → 같이 낚시 → 다음 날 답장 → 섬폰 앨범 → 추억 액자', async () => {
    const T = S().town, W = () => S().world;
    if (!T?.together || !S().album) return block('M15 서비스(town.together · album)가 없어요');
    if (S().house?.inside) await sk.leaveHome();
    if (S().house?.places?.where) await sk.leavePlace();
    await bot.setHour(10);
    await bot.tool(null);
    const done = [], miss = [];
    // 엔딩 뒤엔 우편함 선물 편지로 가방이 꽉 찬다 → 「가방이 꽉 차서 꺼내지 못했다」 뒤 편지 쓰기를 못 함 (M17-P5) — 먼저 팔아 칸을 비운다
    if (bot.free() < 4) await sellSurplus();
    // 그래도 차 있으면 주민 편지로 받은 가구(액자·라디오 …)도 판다 — 사진·추억 액자·축제 사진은 남긴다
    if (bot.free() < 2) await sk.shop({ sell: (it, s) => (it?.category === 'furn' && !s.variant && !/album|festival-photo/.test(it.id) ? s.count : 0) });
    // ① 편지: 가장 친한 주민에게 과일·꽃·조개 하나 넣어서
    const met = residents().filter(s => T.state(s).met).sort((a, b) => T.state(b).friendship - T.state(a).friendship);
    const to = met[0];
    const f0 = to ? T.state(to).friendship : 0;
    const m = to ? await sk.mail({ write: { to, gift: it => !!it && ['fruit', 'flower', 'shell'].includes(it.category) && !keep.has(it.id) } }) : null;
    if (m?.sent?.to === to) done.push(`편지 → ${to}${m.sent.gift ? ` (${m.sent.gift})` : ''}`); else miss.push(`편지 못 보냄 (창 ${m?.opened ? '열림' : '안 열림'})`);
    // ② 같이 낚시: 오늘 같이 놀 수 있는 친구 (밖에 있고 말 걸 수 있는)
    const pal = residents().filter(s => T.together.can(s).ok).find(s => S().town.villagers.find(V => V.slug === s)?.talkable);
    let fished = null;
    if (!pal) miss.push('같이 놀 친구가 없음 (친구 30 이상 · 밖)');
    else if (await sk.reach(pal)) {
      let asked = false;
      bot.policy = { emote: () => (asked ? null : (asked = true, ['item:tool.rod'])), emoteChoice: () => 0, dialog: () => 0 };
      bot.press('action');
      await bot.frames(3);
      await bot.settle(60, 0.5);
      bot.policy = {};
      if (!(await bot.until(() => T.together.active()?.slug === pal, { timeout: 5 }))) miss.push(`${pal} 같이 낚시가 안 시작됨`);
      else {
        // 가까운 물가로 가서 선다 → 주민이 옆 물가 칸에서 낚싯대를 든다 (AN-14)
        const isl = W().island, nav = T.debug.nav, p = bot.pos(), t0 = isl.toTile(p.x, p.z);
        let best = null, bd = 1e9;
        for (let dz = -18; dz <= 18; dz++) for (let dx = -18; dx <= 18; dx++) {
          const tx = t0.tx + dx, tz = t0.tz + dz;
          if (!nav.walkable(tx, tz) || isl.tileAt(tx, tz) === 'sand') continue;
          const wn = [[0, -1], [1, 0], [-1, 0]].find(([a, b]) => isl.tileAt(tx + a, tz + b) === 'water');
          if (wn && Math.hypot(dx, dz) < bd) { bd = Math.hypot(dx, dz); best = { tx, tz, wn }; }
        }
        if (best) {
          const c = isl.toWorld(best.tx, best.tz);
          await bot.walkTo(c, { near: 0.3, label: '강가' });
          await bot.face({ x: c.x + best.wn[0], z: c.z + best.wn[1] });
        }
        let shot = false;
        await bot.until(() => {
          if (!shot && T.together.active()?.phase === 'fish') { shot = true; bot.shot('16-m15-fish', `${pal}와 같이 낚시 (AN-14)`); }
          return !T.together.active();
        }, { timeout: 175, label: '같이 낚시 끝' });
        await bot.settle(40);
        const t = T.state(pal).together;
        fished = { pal, phase: shot ? 'fish' : 'follow', day: t?.day, f: T.state(pal).friendship };
        if (t?.day === bot.day()) done.push(`같이 낚시 ${pal}${shot ? ' (물가에서)' : ''}`); else miss.push(`${pal} 같이 낚시가 끝나지 않음`);
      }
    } else miss.push(`${pal} 에게 못 감`);
    // ③ 다음 날 아침: 답장
    await bot.nextDay(9); await bot.settle(60);
    const replies = (T.mail.unread?.() ?? []).filter(l => /^reply/.test(l.kind));
    const r = await sk.mail();
    if (to && replies.some(l => l.from === to)) done.push(`답장 ${replies.map(l => `${l.from}:${l.kind}`).join(',')} · 친밀도 ${f0}→${T.state(to).friendship}`); else if (to) miss.push('답장이 안 옴');
    // ④ 섬폰 📷 앨범 → 사진 → 추억 액자 (도토리 300)
    const photos = S().album.list().length;
    // M17-P5: 2026-11-13 전체 플레이 🟡 「액자 못 만듦」 = 도토리는 1565 인데 「가방이 꽉 찼어요」 (엔딩 뒤라 가방이 참) → 사람처럼 먼저 팔아 칸을 비운다
    const free0 = bot.free();
    if (bot.acorns() < 300 || free0 < 1) await sellSurplus();
    bot.policy = { card: (kind, el, card) => !!card?.classList.contains('pk-album') };   // 앨범 창은 봇이 직접 누른다 (기본 정책은 모르는 창을 닫는다)
    bot.press('phone');
    let framed = false;
    if (await bot.until(() => bot.$('.pk-app[data-app="album"]'), { timeout: 5, ui: false })) {
      await bot.wait(0.3, { ui: false });
      await bot.click(bot.$('.pk-app[data-app="album"]'));
      if (await bot.until(() => bot.$('.pk-album [data-album-photo]'), { timeout: 5, ui: false })) {
        await bot.click(bot.$('.pk-album [data-album-photo]'));
        await bot.frames(3);
        await bot.shot('16-m15-album', '추억 앨범');
        const b = bot.$('.pk-album [data-album-frame="desk"]');
        if (b && !b.disabled) { await bot.click(b); framed = bot.has('furn.album-frame') > 0; }
      }
      await bot.click(bot.$('.pk-album .pk-x'));
    }
    bot.policy = {};
    await bot.frames(3);
    for (let k = 0; k < 4 && bot.top(); k++) { bot.press('esc'); await bot.frames(4); }
    if (photos) done.push(`앨범 ${photos}장${framed ? ' · 추억 액자' : ''}`); else miss.push('앨범에 사진이 없음');
    if (photos && !framed) miss.push(`액자 못 만듦 (도토리 ${bot.acorns()} · 가방 빈칸 ${free0} → ${bot.free()})`);
    note('m15', { to, letter: m?.sent ?? null, free0, fished, replies: replies.map(l => l.kind), photos, framed, song: T.song.today() });
    return miss.length ? awk(`${miss.join(' · ')} — ${done.join(' · ')}`) : pass(done.join(' · '));
  });

  // M18-P3 계절 대회 (D194-A): 날짜를 넘겨 다음 대회 날(낚시 3·7·12월 · 곤충 5·10월)로 → 10시 광장 무대 BD-17 접수 탁자에서 Space → 초롱 대화 「나갈래요!」
  //   → (처음이면 s29) → 3분 동안 낚시·곤충 잡기 → 결과 발표 → 트로피·도토리 · 섬 일지 「대회 나가기」. 날짜는 시계를 29시로 넘기며 하루씩 (봇은 ?date= 를 쓰지 않는다)
  add('contest', 'M18-P3 계절 대회: 다음 대회 날까지 날짜 넘기기 → 광장 무대 접수 → 3분 낚시·곤충 → 결과 발표 · 트로피 · 섬 일지', async () => {
    const C = () => S().contest;
    if (!C()) return block('대회(contest) 서비스가 없어요');
    if (!fest().endedDay) return skip('엔딩 전 (대회는 첫 섬 축제 뒤부터)');
    if (S().house?.inside) await sk.leaveHome();
    if (S().house?.places?.where) await sk.leavePlace();
    const odd = [], res = {};
    // ① 다음 대회 날까지 (오늘이 대회 날이면 그대로) — 섬 축제 날과 겹치면 다음 대회
    const next = C().upcoming()[0];
    res.target = next?.day ?? null;
    const t0 = performance.now();
    let n = 0;
    while (!C().today() && n < 160) { S().time.setHour(29); await bot.frames(4); n++; }
    res.daysSkipped = n;
    if (!C().today()) return block(`${n}일 넘겨도 대회 날이 아님 (목표 ${res.target})`);
    await bot.setHour(10);
    await bot.settle(60);
    const c = C().today(), kind = c.kind;
    res.contest = `${c.id} ${c.name} ${bot.day()}`;
    // ② 무대 접수 탁자 앞에서 Space → 초롱 대화 (첫 고르기 = 「나갈래요!」)
    const tool = kind === 'fish' ? 'tool.rod' : 'tool.net';
    if (!bot.has(tool)) await sk.shop({ buy: [tool] });
    if (!(await bot.until(() => !!C().desk(), { timeout: 10, label: '무대' }))) return block('대회 무대가 안 놓임');
    const desk = C().desk();
    await bot.tool(null);
    await bot.walkTo(desk.front, { near: 0.3, label: '대회 접수 탁자' });
    await bot.face(desk.desk);
    res.peek = bot.peek();
    if (res.peek !== 'contest:desk') odd.push(`접수 탁자 앞 행동 키가 ${res.peek}`);
    const firstBefore = !st().contest?.first;
    bot.policy = { dialog: () => 0 };
    bot.press('action');
    await bot.until(() => C().running, { timeout: 30, label: '대회 시작' });
    bot.policy = {};
    await bot.settle(60);   // 처음이면 s29 장면
    res.s29 = firstBefore ? !!st().story?.seen?.['s29-first-contest'] : 'already';
    if (firstBefore && !res.s29) odd.push('첫 대회 장면 s29 가 안 나옴');
    if (!C().running && !C().record(c.id)) return block('대회가 시작되지 않음');
    await bot.shot('17-contest-start', `${c.name} 접수 · 대회 창 UI-34`);
    res.ui = !bot.$('.ct-box')?.hidden;
    if (!res.ui) odd.push('대회 창 UI-34 가 안 보임');
    // ③ 제한 시간 동안 잡기 (사람처럼 — 낚시는 물가 그림자, 곤충은 둘레에서)
    let tries = 0, shot = false;
    while (C().running && tries < 40) {
      tries++;
      if (kind === 'fish') await sk.fish({ tries: 1 }); else await sk.bug({ tries: 1 });
      if (!shot && (C().view()?.me?.count ?? 0) > 0) { shot = true; await bot.shot('17-contest-catch', `대회 중 기록 ${C().view().me.score}점 · ${C().view().me.rank}위`); }
    }
    await bot.until(() => !C().running, { timeout: 200, label: '대회 끝' });
    bot.policy = { dialog: () => 0 };
    await bot.settle(60);
    bot.policy = {};
    // ④ 결과: 기록 · 상 · 섬 일지
    const rec = C().record(c.id);
    if (!rec) return block('대회 기록이 없음');
    res.rank = rec.rank; res.score = rec.score; res.count = rec.count; res.prize = rec.prize;
    if (rec.prize?.item && !bot.has(rec.prize.item) && !(st().contest?.owed ?? []).includes(rec.prize.item)) odd.push(`상 ${rec.prize.item} 을 못 받음`);
    res.journal = st().journal?.counts?.contest ?? 0;
    if (!res.journal) odd.push('섬 일지 「대회 나가기」가 안 셈');
    res.uiGone = !!bot.$('.ct-box')?.hidden;
    if (!res.uiGone) odd.push('대회가 끝났는데 대회 창이 남음');
    // ⑤ 다시 Space → 「벌써 나갔어요」 (접수는 하루 한 번)
    await bot.tool(null);
    await bot.walkTo(desk.front, { near: 0.3, label: '대회 접수 탁자' });
    await bot.face(desk.desk);
    const again = bot.peek();
    if (again !== 'contest:desk') odd.push(`대회 뒤 접수 탁자 행동 키 ${again}`);
    await bot.act('action', { timeout: 20 });
    if (C().running) odd.push('같은 날 두 번 접수됨');
    res.realSec = Math.round((performance.now() - t0) / 1000);
    note('contest', res);
    const msg = `${res.contest} · ${res.daysSkipped}일 넘김 · ${rec.count}마리 ${rec.score}점 ${rec.rank}위 → ${rec.prize?.item ?? '참가'} + 🌰${rec.prize?.acorns}`;
    return odd.length ? awk(`${odd.join(' · ')} — ${msg}`) : pass(msg);
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
