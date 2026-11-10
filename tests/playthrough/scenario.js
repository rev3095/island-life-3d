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
  // 마음 열기 = 친구(30) + 마음이 통한 일 2번 (7차 D50-A: 이모티콘 성공 · 좋아하는 선물 · 부탁 — 말풍선 아래 하트 칸에 보이는 값)
  const heartOpen = slug => { const v = S().town.state(slug); return v.friendship >= 30 && (v.emote?.wins ?? 0) + (v.bonds?.gift ?? 0) + (v.bonds?.favor ?? 0) >= 2; };
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
      const ok = await bot.until(() => S().house.where === kind && !S().house.passing, { timeout: 12, label: `${label} 들어가기` });
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
    const want = (((hh * 60 - from) % 1440) + 1440) % 1440;                      // 앞으로 몇 분
    // 시침 끝을 잡고 시계 방향으로 10° (= 20분) 씩 끈다
    const r = dial.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.2;
    const at = deg => ({ clientX: cx + Math.sin(deg * Math.PI / 180) * R, clientY: cy - Math.cos(deg * Math.PI / 180) * R });
    const pe = (el, type, deg) => el.dispatchEvent(new bot.win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, ...at(deg) }));
    let a = ((from / 60) % 12) / 12 * 360;
    pe(bot.$('.pk-tclock-dial .h-hour .hit'), 'pointerdown', a);
    for (let left = want / 2; left > 0; left -= 10) { a += Math.min(10, left); pe(dial, 'pointermove', a); await bot.stepFrame(); }
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
    for (let k = 0; k < 3; k++) { await bot.click(bot.$('.pk-hclock-speed')); seen.push(S().time.speed); }
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
    note('clockPhone', { night, day, lit, out, spawned, bug, buy: cheap, spent: w0 - bot.acorns(), free0, soldFirst, freeAfter: freeSlots(), offset: S().time.offset, maxDay: S().time.maxDay, speeds: seen, speed: S().time.speed, plusMin });
    if (wasPaused) S().time.setPaused?.(true);   // 다음 단계도 봇 시계(setHour)로
    const bad = [];
    if (new Set(seen).size !== 3 || seen.at(-1) !== sp0) bad.push(`빠르기 단추 ${sp0} → ${seen.join('→')}`);
    if (Math.abs(plusMin - 60) > 2) bad.push(`+1시간 단추 ${plusMin}분`);
    if (lit < 0.9) bad.push(`밤 불빛 ${lit.toFixed(2)}`);
    if (!bug) bad.push('밤 곤충을 못 잡음');
    if (!cheap) bad.push('살 수 있는 물건 없음');
    else if (!(w0 - bot.acorns() > 0)) bad.push(`못 삼 (${cheap.id}${freeSlots() === 0 ? ' — 가방 꽉 참' : ''})`);
    const msg = `밤 ${Math.floor(night.to / 60)}시 곤충 ${bug ?? '-'} · 낮 ${day.day} ${Math.floor(day.to / 60)}시 ${cheap?.id ?? '-'} 🌰${w0 - bot.acorns()} · 가방 빈칸 ${free0}${soldFirst ? ` (먼저 ${soldFirst} 팔기)` : ''} · 밤에 밖 주민 ${out}`;
    return bad.length ? awk(`${bad.join(', ')} — ${msg}`) : pass(msg);
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
    await bot.act('action', { timeout: 30 });
    bot.policy = {};
    if (!(await bot.until(() => tour().active && !tour().busy, { timeout: 25, label: '무인도 도착' }))) return block(`무인도에 도착하지 못함 (묻기 창 ${asked ? '나옴' : '안 나옴'})`);
    const cur = tour().current, w = S().world;
    await bot.shot('15-tour-arrive', `무인도 ${cur.shape}`);
    const got = {}, inv0 = Object.fromEntries(bot.inv().filter(Boolean).map(s => [s.id, s.count]));
    // 과일나무 흔들기 (투어 섬 과일 = 망고·리치)
    const ft = w.objects.list('fruit-tree')[0];
    if (ft) {
      await bot.walkLocal({ x: ft.x, z: ft.z + 0.85 }, { timeout: 40, label: '무인도 과일나무' });
      await bot.face(ft);
      if (bot.peek() === 'gather-shake') { await bot.act('action'); await bot.wait(0.8); await sk.pickupAround(2.4); }
    }
    // 광석 바위 캐기 (삽)
    const ore = w.objects.list('ore-rock')[0];
    let oreHits = 0;
    const shovel = bot.has('tool.shovel') > 0;   // 새 게임 첫날엔 삽이 없다 (단계만 돌릴 때)
    if (ore && shovel && (await bot.tool('shovel'))) {
      await bot.walkLocal({ x: ore.x, z: ore.z + 0.95 }, { timeout: 40, label: '광석 바위' });
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
    note('tour', { shape: cur.shape, guest: cur.guest, paid: acorns0 - bot.acorns(), got, oreHits, shovel, free0, free, backPeek, home, pos: bot.pos() });
    if (!home) return block(`배로 못 돌아옴 (배 앞 ${backPeek})`);
    const odd = [];
    if (!Object.keys(got).some(id => /^fruit\.(mango|lychee)$/.test(id))) odd.push(`무인도 과일을 못 얻음 (가방 빈칸 ${free0} → ${free})`);
    if (shovel && !oreHits) odd.push('광석 바위를 못 침');
    if (Math.abs(bot.pos().x) > 100) odd.push('돌아왔는데 섬 밖 좌표');
    return odd.length ? awk(odd.join(' · ')) : pass(`${cur.shape} · 얻은 것 ${Object.entries(got).map(([k, v]) => `${k}×${v}`).join(', ')} · 광석 ${shovel ? `${oreHits}번` : '삽 없음'}`);
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
