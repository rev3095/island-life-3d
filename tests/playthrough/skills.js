// 자동 플레이 기술: 봇(bot.js)의 걷기·키·창 처리 위에 "나무 흔들기", "낚시", "상점에서 팔기", "주민과 이모티콘 대화" 같은
// 사람이 하는 일 단위를 쌓는다. 모두 행동 키·창 단추로만 하고, 게임 상태는 읽기만 한다.
// 이모티콘 대화는 공략집을 본 사람처럼 주민 파일(assets/villagers/<slug>.json)의 좋아함·읽는 법을 알고 말풍선 💭 힌트를 따른다.

export function createSkills(bot) {
  const S = () => bot.ctx.services;
  const W = () => S().world;
  const P = () => S().player;
  const isl = () => W().island;
  const items = () => S().data.items;
  const log = bot.log;
  const cat = id => items().get(id)?.category;
  const sk = {};

  // ---------- 물체 찾기 ----------
  /** kind 물체 목록 (가까운 순), filter(o) */
  sk.objects = (kinds, filter = () => true) => {
    const ks = [].concat(kinds);
    const p = bot.pos();
    return W().objects.list().filter(o => ks.includes(o.kind) && filter(o)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  };
  const level = (x, z) => { const t = isl().toTile(x, z); return isl().levelAt(t.tx, t.tz); };

  // ---------- 줍기 ----------
  /** 발밑·앞에 떨어진 것 줍기 (F) — 다 주울 때까지 */
  sk.pickupAround = async (r = 2.2, max = 12) => {
    let n = 0;
    for (let k = 0; k < max; k++) {
      const drops = S().gather.drops.near(bot.pos().x, bot.pos().z, r);
      if (!drops.length || bot.free() === 0) break;
      const d = drops[0];
      if (bot.dist(d) > 0.5) await bot.walkTo(d, { near: 0.3, run: false, label: '떨어진 것' });
      const before = bot.count(() => true) + bot.acorns();
      if (bot.peek('pickup') !== 'gather-pickup') { await bot.face(d); }
      await bot.act('pickup');
      if (bot.count(() => true) + bot.acorns() > before) n++;
    }
    return n;
  };

  // ---------- 나무 ----------
  /** 나무 하나 흔들기 (맨손) → 떨어진 것 줍기. kinds 기본 모든 나무 */
  sk.shakeTree = async (o, { pick = true } = {}) => {
    await bot.tool(null);
    if (!(await bot.approach(o, { dist: 0.8, label: o.kind }))) return null;
    if (bot.peek() !== 'gather-shake') { await bot.face(o); }
    if (bot.peek() !== 'gather-shake') { bot.issue('minor', 'gather', `나무 앞에서 흔들기가 안 떠요 (${o.kind})`, { peek: bot.peek() }); return null; }
    const inv0 = bot.inv().map(s => s && `${s.id}:${s.count}`).join();
    await bot.act('action');
    await bot.wait(0.8);
    if (pick) await sk.pickupAround(2.4);
    return inv0 !== bot.inv().map(s => s && `${s.id}:${s.count}`).join();
  };

  // ---------- 낚시 ----------
  const fishing = () => S().gather.fishing;
  /** 물고기 하나 잡기 → 잡은 아이템 id | null. big = 그림자 크기 이상만 노린다 */
  sk.fish = async ({ minSize = 0, tries = 6, where = null } = {}) => {
    if (!bot.has('tool.rod') && !S().data.inventory.hasTool?.('rod')) { bot.issue('major', 'gather', '낚싯대가 없어 낚시를 못 해요'); return null; }
    if (where) await bot.walkTo(where, { label: '낚시터' });
    for (let k = 0; k < tries; k++) {
      // 보이는 그림자 고르기 (크기 조건)
      // 물가에서 닿는 그림자 (먼 바다 한가운데 것은 건너뛴다)
      let stood = false;
      for (let w = 0; w < 40 && !stood; w++) {
        const list = fishing().fish.filter(x => x.state === 'swim' && x.size >= minSize).sort((a, b) => bot.dist(a) - bot.dist(b));
        for (const f of list.slice(0, 4)) {
          for (const d of [2.1, 1.7, 2.6]) {
            if (await bot.approach({ x: f.x, z: f.z }, { dist: d, label: '물가', angles: 16, level: false, quiet: true })) { stood = true; break; }
          }
          if (stood) break;
        }
        if (!stood) { await bot.wait(0.5); if (w % 10 === 9) await wander(); }
      }
      if (!stood) { log('  닿는 그림자가 안 보여요'); continue; }
      await bot.tool('rod');
      const before = Object.fromEntries(bot.inv().filter(Boolean).map(s => [s.id, s.count]));
      const got = await castAndWait();
      if (got) {
        const after = bot.inv().filter(Boolean).find(s => cat(s.id) === 'fish' && s.count > (before[s.id] ?? 0));
        return after?.id ?? 'fish';
      }
    }
    return null;
  };
  async function wander() {
    // 그림자가 안 보이면 물가를 따라 조금 옮긴다 (사람도 자리를 바꾼다)
    const spots = [W().places.dock, W().places.pond, W().places.waterfall, ...(W().places.bridges ?? [])].filter(Boolean);
    const s = spots[Math.floor(Math.random() * spots.length)];
    if (s) await bot.walkTo(s, { label: '낚시터 옮기기' });
  }
  /** 던지고 입질·덥석 소리에 맞춰 당기기. 큰 물고기는 찌가 떠오르는 소리(slack)에 당긴다 */
  async function castAndWait() {
    let bite = false, slack = 0, caught = false, ended = false;
    const offs = [
      bot.on('sfx', e => {
        if (e?.name === 'bite' && !e.pitch) bite = true;
        if (e?.name === 'nibble' && e.pitch === 1.25) slack++;
        if (e?.name === 'catch') caught = true;
      }),
    ];
    try {
      bot.press('action');
      await bot.frames(3);
      if (!fishing().active) { log('  찌를 못 던졌어요'); return false; }
      const end = bot.gameT + 25;
      let pulled = 0, reacted = -1;
      while (bot.gameT < end && fishing().active) {
        if (bite && reacted < 0) { reacted = bot.gameT + 0.18 + Math.random() * 0.12; }   // 사람 반응 0.18~0.3초
        if (reacted > 0 && bot.gameT >= reacted) { bot.press('action'); reacted = -2; bite = false; }
        if (slack > pulled) { pulled = slack; await bot.wait(0.12 + Math.random() * 0.08); bot.press('action'); }
        await bot.stepFrame();
      }
      if (fishing().active) { bot.press('action'); await bot.frames(10); }
      await bot.settle(10, 0.3);
      ended = true;
      return caught;
    } finally { offs.forEach(o => o()); if (!ended) await bot.settle(5); }
  }

  // ---------- 곤충 ----------
  /** 곤충 하나 잡기 → id | null (걸어서 다가가 잠자리채) */
  sk.bug = async ({ tries = 8, test = () => true } = {}) => {
    for (let k = 0; k < tries; k++) {
      let b = null;
      for (let w = 0; w < 30 && !b; w++) {
        b = S().gather.bugs.bugs.filter(x => x.state !== 'flee' && x.mode !== 'fall' && test(x)).sort((a, c) => bot.dist(a) - bot.dist(c))[0] ?? null;
        if (!b) { await bot.wait(0.5); if (w === 15) await bot.walkTo(W().places.plaza, { label: '곤충 찾기' }); }
      }
      if (!b) continue;
      await bot.tool('net');
      // 달리면 3칸에서 도망 — 멀면 달리고, 4칸 안에선 걷는다
      if (bot.dist(b) > 4) await bot.walkTo(b, { near: 4, run: true, label: '곤충 쪽' });
      await bot.walkTo(b, { near: 0.8, run: false, timeout: 15, label: '곤충', allowTeleport: false, quiet: true });
      await bot.face(b, { timeout: 0.6 });
      const before = bot.count(it => it?.category === 'bug');
      await bot.act('action', { timeout: 10 });
      if (bot.count(it => it?.category === 'bug') > before) return bot.inv().filter(Boolean).map(s => s.id).find(id => cat(id) === 'bug') ?? 'bug';
    }
    return null;
  };

  // ---------- 꽃 ----------
  /** 꽃 꺾기 (F) — 서로 다른 종류를 먼저. n 송이 */
  sk.flowers = async (n = 6, { kinds = 3 } = {}) => {
    const garden = S().gather.garden;
    const got = new Set(bot.inv().filter(s => s && cat(s.id) === 'flower').map(s => s.id));
    let picked = 0;
    for (let k = 0; k < n * 3 && picked < n; k++) {
      const list = sk.objects(['tulip', 'cosmos', 'pansy'], o => !!garden.itemOfFlower(o));
      if (!list.length) break;
      const fresh = list.find(o => !got.has(garden.itemOfFlower(o)));
      const o = got.size < kinds && fresh ? fresh : list[0];
      await bot.tool(null);
      await bot.walkTo(o, { near: 0.55, run: true, label: '꽃' });
      await bot.face(o, { timeout: 0.6 });
      const before = bot.count(it => it?.category === 'flower');
      await bot.act('pickup');
      if (bot.count(it => it?.category === 'flower') > before) { picked++; got.add(garden.itemOfFlower(o) ?? ''); }
    }
    return picked;
  };

  // ---------- 도끼·삽 ----------
  /** 나무 n 개 얻기 (도끼로 나무 치기) */
  sk.wood = async (n = 5) => {
    if (!S().data.inventory.hasTool?.('axe')) { bot.issue('major', 'gather', '도끼가 없어요'); return 0; }
    const start = bot.has('mat.wood');
    const tried = new Set();
    for (let k = 0; k < 30 && bot.has('mat.wood') - start < n; k++) {
      const o = sk.objects(['tree', 'cedar'], x => !tried.has(x.id) && !x.data?.grow)[0];
      if (!o) break;
      tried.add(o.id);
      await bot.tool(null);
      if (!(await bot.approach(o, { dist: 0.8, label: '나무' }))) continue;
      await bot.tool('axe');
      for (let h = 0; h < 3; h++) { await bot.act('action', { timeout: 8 }); await bot.wait(0.3); }
      await sk.pickupAround(2.2);
    }
    return bot.has('mat.wood') - start;
  };
  /** 화석 자리 파기 (삽) → 판 수 */
  sk.fossils = async (max = 4) => {
    if (!S().data.inventory.hasTool?.('shovel')) { bot.issue('major', 'gather', '삽이 없어요'); return 0; }
    let n = 0;
    for (const o of sk.objects('fossil-spot').slice(0, max)) {
      const before = bot.count(it => it?.category === 'fossil');
      await bot.tool(null);
      if (!(await bot.approach(o, { dist: 0.9, label: '화석 자리' }))) continue;
      await bot.tool('shovel');
      await bot.act('action', { timeout: 10 });
      await sk.pickupAround(1.6);
      if (bot.count(it => it?.category === 'fossil') > before) n++;
    }
    return n;
  };

  /** 부탁 물건 구하기: req = { cat, id } → 구한 아이템 id | null */
  sk.obtain = async req => {
    const test = it => !!it && (req.id ? it.id === req.id : it.category === req.cat);
    const have = () => bot.inv().find(s => s && test(items().get(s.id)))?.id ?? null;
    for (let k = 0; k < 4 && !have(); k++) {
      if (req.cat === 'fish') await sk.fish({ tries: 2 });
      else if (req.cat === 'bug') await sk.bug({ tries: 3 });
      else if (req.cat === 'flower') await sk.flowers(1, { kinds: 1 });
      else if (req.cat === 'shell') {
        const o = sk.objects('shell')[0];
        if (o) { await bot.tool(null); await bot.walkTo(o, { near: 0.5, label: '조개' }); await bot.face(o, { timeout: 0.6 }); await bot.act('pickup'); }
      } else if (req.id === 'mat.wood') await sk.wood(1);
      else if (req.id === 'mat.branch') { for (const o of sk.objects('tree').slice(k * 2, k * 2 + 2)) await sk.shakeTree(o); }
      else if (req.id === 'fruit.coconut') { for (const o of sk.objects('palm').slice(k, k + 1)) await sk.shakeTree(o); }
      else if (req.cat === 'fruit' || req.id?.startsWith('fruit.')) { for (const o of sk.objects('fruit-tree').slice(k, k + 1)) await sk.shakeTree(o); }
      else break;
    }
    return have();
  };

  // ---------- 상점·박물관 ----------
  const place = k => W().places[k];
  /** 건물 문 앞에 서서 북쪽(문)을 본다 */
  sk.toDoor = async (key, label) => {
    const d = place(key)?.door;
    if (!d) { bot.issue('major', 'world', `${label ?? key} 문 자리가 없어요`); return false; }
    await bot.walkTo({ x: d.x, z: d.z + 0.15 }, { near: 0.25, label: `${label ?? key} 문` });
    await bot.faceDir(0);
    // 문 앞에 주민이 서 있으면 행동 키가 '말 걸기'로 간다 → 비켜 줄 때까지 기다린다 (사람도 A 글자를 보고 기다린다)
    const want = { shop: /town:(shop|firstday)/, museum: /town:museum/ }[key];
    if (want && !want.test(bot.peek() ?? '')) {
      const ok = await bot.until(() => want.test(bot.peek() ?? ''), { timeout: 20, ui: false });
      bot.issue('polish', 'town', `${label ?? key} 문 앞에 주민이 서 있으면 행동 키가 말 걸기로 가요 (비킬 때까지 ${ok ? '기다림' : '20초 넘게 안 비킴'})`);
      if (!ok) { await bot.walkTo({ x: d.x + 0.6, z: d.z + 0.15 }, { near: 0.2 }); await bot.faceDir(0); }
    }
    return true;
  };
  /** 상점: mode 'sell' | 'buy'. sellTest(item, slot) → 팔 개수(0 = 안 팜). buy = [id...] */
  sk.shop = async ({ sell = null, buy = [], decor = null } = {}) => {
    if (!(await sk.toDoor('shop', '상점'))) return null;
    const result = { sold: 0, earned: 0, bought: [], decor: null };
    const w0 = bot.acorns();
    let shopOpened = false;
    const buyQueue = [...buy];
    bot.policy = {
      dialog: texts => {
        const i = texts.findIndex(t => (sell && !buy.length ? /팔래요/ : /살래요/).test(t));
        return i >= 0 ? i : 0;
      },
      card: (kind, el, card) => {
        if (kind !== 'shop') return false;
        shopOpened = true;
        const tabs = [...card.querySelectorAll('.pk-tab')];
        const cur = tabs.find(t => t.getAttribute('aria-selected') === 'true')?.textContent;
        if (decor && !result.decor) {
          if (cur !== '사기') { bot.click(tabs.find(t => t.textContent === '사기')); return true; }
          const b = card.querySelector(`[data-decor="${decor}"]`) ?? [...card.querySelectorAll('[data-decor]')].find(x => !x.classList.contains('is-owned') && !x.classList.contains('is-short'));
          result.decor = b?.dataset.decor ?? 'none';
          if (b) { bot.click(b); return true; }
        }
        if (buyQueue.length) {
          if (cur !== '사기') { bot.click(tabs.find(t => t.textContent === '사기')); return true; }
          const id = buyQueue.shift();
          const b = card.querySelector(`[data-id="${id}"]`);
          if (!b) { bot.issue('minor', 'shop', `상점에 ${items().get(id)?.name ?? id} 이(가) 없어요 (오늘 목록)`); return true; }
          result.bought.push(id);
          bot.click(b);
          return true;
        }
        if (sell && !result.sellDone) {
          if (cur !== '팔기') { bot.click(tabs.find(t => t.textContent === '팔기')); return true; }
          result.sellDone = true;
          bot.click(card.querySelector('.pk-sell-go'));
          return true;
        }
        bot.click(card.querySelector('.pk-x'));
        return true;
      },
      bag: (mode, slots) => {
        if (mode !== 'sell' || !sell) return null;
        const i = slots.findIndex((s, k) => s && !s.id.startsWith('tool.') && !(result.skip ?? new Set()).has(k) && sell(items().get(s.id), s) > 0);
        if (i < 0) return null;
        result.want = sell(items().get(slots[i].id), slots[i]);
        (result.skip ??= new Set()).add(i);
        return i;
      },
      confirm: info => {
        if (info.title === '팔기') {
          const n = result.want ?? 1;
          const all = info.buttons.findIndex(b => /모두/.test(b)), one = info.buttons.findIndex(b => /1개만/.test(b));
          result.sold += 1;
          return n > 1 && all >= 0 ? all : one >= 0 ? one : 0;
        }
        if (/벽지|바닥/.test(info.title + info.text)) return Math.max(0, info.buttons.findIndex(b => /바로 붙일게요/.test(b)));
        return 0;
      },
    };
    await bot.act('action', { timeout: 60 });
    bot.policy = {};
    result.earned = bot.acorns() - w0;
    result.opened = shopOpened;
    return result;
  };
  /** 박물관: 기증할 수 있는 것을 모두 (같은 것은 하나만) */
  sk.museum = async () => {
    if (!(await sk.toDoor('museum', '박물관'))) return null;
    const res = { donated: [] };
    const tried = new Set();
    bot.policy = {
      dialog: texts => { const i = texts.findIndex(t => /기증하러|감정해/.test(t)); return i >= 0 ? i : 0; },
      card: (kind, el, card) => {
        if (kind !== 'museum') return false;
        if (!res.started) { res.started = true; bot.click(card.querySelector('.pk-donate-go')); return true; }
        bot.click(card.querySelector('.pk-x'));
        return true;
      },
      bag: (mode, slots) => {
        if (mode !== 'donate') return null;
        const i = slots.findIndex((s, k) => s && !tried.has(k) && S().data.museum.canDonate?.(s.id));
        if (i < 0) return null;
        tried.add(i);
        res.donated.push(slots[i].id);
        return i;
      },
    };
    await bot.act('action', { timeout: 60 });
    bot.policy = {};
    return res;
  };

  // ---------- 집 ----------
  const house = () => S().house;
  sk.enterHome = async () => {
    if (house().inside) return true;
    const d = W().places.playerHouse.door;
    await bot.walkTo({ x: d.x, z: d.z }, { near: 0.3, label: '내 집 문' });
    await bot.faceDir(0);
    if (bot.peek() !== 'house-door-in') { bot.issue('minor', 'house', `집 문 앞에서 '들어가기'가 안 떠요 (${bot.peek()})`); }
    await bot.act('action');
    await bot.until(() => house().inside, { timeout: 5 });
    return house().inside;
  };
  /** 집에서 나오기: 문 매트(남쪽 가운데)로 걸어가서 행동 키 */
  sk.leaveHome = async () => {
    if (!house().inside) return true;
    const room = house().room;
    const cx = room?.x0 != null ? room.x0 + room.w / 2 : null;
    // 들어온 자리(문 매트)는 기록해 둔 들어온 위치 기준
    if (sk.homeEntry) await bot.walkLocal(sk.homeEntry, { near: 0.25 });
    await bot.faceDir(180);
    if (bot.peek() !== 'house-door-out') { await bot.walkLocal({ x: bot.pos().x, z: bot.pos().z + 0.4 }); }
    await bot.act('action');
    await bot.until(() => !house().inside, { timeout: 5 });
    return !house().inside;
  };
  /** 가방의 가구 하나 놓기 (집 안에서 빈 바닥 보고) */
  sk.placeFurniture = async test => {
    if (!house().inside) return false;
    const before = house().furniture?.length ?? 0;
    // 빈 바닥을 바라봐야 '가구 놓기' (가구를 보고 누르면 그 가구 살피기·옮기기가 된다)
    let ok = false;
    for (const [dx, dz] of [[0, 0], [0.8, 0], [-0.8, 0], [0, -0.8], [1.2, -0.8], [-1.2, -0.8]]) {
      if (dx || dz) await bot.walkLocal({ x: bot.pos().x + dx, z: bot.pos().z + dz }, { near: 0.2, timeout: 4 });
      for (const deg of [0, 90, -90, 180]) { await bot.faceDir(deg); if (['house-place', 'house-decor'].includes(bot.peek())) { ok = true; break; } }
      if (ok) break;
    }
    if (!ok) { bot.issue('minor', 'house', `집 안에서 '가구 놓기' 자리를 못 찾았어요 (${bot.peek()})`); return false; }
    bot.policy = { bag: (mode, slots) => { const i = slots.findIndex(s => s && s.id.startsWith('furn.') && test(s)); return i >= 0 ? i : null; }, dialog: texts => Math.max(0, texts.findIndex(t => /가구 놓기/.test(t))) };
    await bot.act('action');
    bot.policy = {};
    return (house().furniture?.length ?? 0) > before;
  };

  /** 집 작업대에서 만들기 (want = 레시피 id = 만들어지는 아이템 id) → 만들었으면 true */
  sk.craft = async want => {
    if (!(await sk.enterHome())) return false;
    sk.homeEntry = bot.pos();
    const R = house().room;
    // 작업대는 서쪽 벽(칸 gx 0, gz 2~3)에 붙어 동쪽을 본다 → 그 앞에서 서쪽을 보고
    await bot.walkLocal({ x: R.x0 + 1.5, z: R.z0 + 3.0 }, { near: 0.2 });
    await bot.faceDir(90);
    const pk = S().gameplay.interactions.peek('action');
    if (pk?.label !== '만들기') bot.issue('minor', 'house', `작업대 앞인데 버튼이 '${pk?.label ?? '없음'}' 이에요`);
    const n0 = bot.has(want) + (S().data.inventory.hasTool?.(want.replace('tool.', '')) ? 1 : 0);
    const st = { picked: false, went: false };
    bot.policy = {
      card: (kind, el, card) => {
        if (kind !== 'craft') return false;
        const item = card.querySelector(`.pk-craft-item[data-id="${want}"]`);
        if (!st.picked && item) { st.picked = true; bot.click(item); return true; }
        const go = card.querySelector('.pk-craft-go');
        if (!st.went && go && !go.disabled) { st.went = true; bot.click(go); return true; }
        bot.click(card.querySelector('.pk-x'));
        return true;
      },
    };
    await bot.act('action', { timeout: 30 });
    bot.policy = {};
    const made = bot.has(want) + (S().data.inventory.hasTool?.(want.replace('tool.', '')) ? 1 : 0) > n0;
    await sk.leaveHome();
    return made;
  };

  // ---------- 주민 ----------
  const villager = slug => S().town.villagers.find(V => V.slug === slug) ?? null;
  sk.villager = villager;
  const rulesOf = slug => S().festival?.emotes?.rules?.villagers?.[slug] ?? null;
  /** 주민에게 다가가 말 걸기 (움직이면 따라간다) → 대화가 열렸으면 true */
  sk.reach = async (slug, { timeout = 60 } = {}) => {
    const V = villager(slug);
    if (!V) return false;
    const end = bot.gameT + timeout;
    while (bot.gameT < end) {
      if (!V.talkable) return false;
      const q = V.actor.position;
      if (bot.dist(q) > 1.0) await bot.walkTo(q, { near: 0.95, timeout: 6, label: V.person.name, allowTeleport: false, quiet: true });
      if (bot.dist(q) < 1.25) {
        await bot.face(q, { timeout: 0.5 });
        if (bot.peek() === 'town:talk') return true;
      }
      await bot.frames(2);
    }
    bot.issue('minor', 'town', `${V.person.name}에게 다가가 말 걸기가 오래 걸려요 (${timeout}초)`);
    return false;
  };

  /**
   * 이모티콘 대화 한 번: goal = { gift: slotTest | null, party: bool, ask: bool, wins: 3 }
   * → { opened, sent: [{keys, kind, points}], gift, party, ask }
   */
  sk.emoteTalk = async (slug, goal = {}) => {
    const V = villager(slug);
    const res = { slug, opened: false, sent: [], gift: null, party: null, ask: null };
    if (!V) return res;
    if (!(await sk.reach(slug))) return res;
    const R = rulesOf(slug);
    const st = { waited: false, greeted: false, lastHint: null, steps: [] };
    // 차례: 선물 → 이모티콘으로 마음 열기(오늘 wins 번) → 🎉 축제 이야기 → ❓ 부탁 → 잘 가
    const plan = [];
    if (goal.gift) plan.push('gift');
    const after = [];
    if (goal.party) after.push('party');
    if (goal.ask) after.push('ask');
    const offE = bot.on('festival:emote', e => { if (e?.slug === slug) res.sent.push({ keys: e.keys, kind: e.kind, points: e.points }); });
    const tut = S().festival?.emotes?.rules?.tutorial ?? [];
    let tutI = 0;
    const want = () => { const v = S().town.state(slug); return v; };
    bot.policy = {
      emote: ({ bubble }) => {
        res.opened = true;
        const tutorial = !bot.ctx.state.festival?.talkTutorial;
        const hintI = bubble.indexOf('bubble');
        const hint = hintI >= 0 ? bubble[hintI + 1] : null;
        if (tutorial) {
          // 연습: 말풍선에 맞는 대답 (talk.json tutorial ok 첫 낱말). 처음 하는 사람은 따라 하다가 💭 힌트를 본다
          if (sk.novice) return hint ? [hint] : [bubble.find(k => !['bubble', 'think'].includes(k)) ?? 'smile'];
          const t = tut.find(x => x.say.every(k => bubble.includes(k))) ?? tut[tutI] ?? tut[0];
          tutI++;
          return [t.ok[0]];
        }
        if (hint) st.lastHint = hint;
        const v = want();
        const today = v.emote?.day === bot.day() ? v.emote.today ?? 0 : 0;
        if (plan.length && !(hint && st.steps.at(-1) === 'msg')) {
          const k = plan.shift();
          st.steps.push(k);
          if (k === 'gift') res.gift = 'asked';
          if (k === 'party') res.party = 'asked';
          if (k === 'ask') res.ask = 'asked';
          return [k];
        }
        const limit = goal.wins ?? 3;
        if (today >= limit || st.steps.filter(s => s === 'msg').length >= 6) {
          const k = after.shift();
          if (!k) return null;   // 잘 가
          st.steps.push(k);
          if (k === 'party') res.party = 'asked';
          if (k === 'ask') res.ask = 'asked';
          return [k];
        }
        st.steps.push('msg');
        // 처음 하는 사람: 주민 좋아함을 모른다 → 💭 힌트가 보이면 그 낱말 하나, 아니면 인사 (판정 시뮬레이션의 '힌트 하나만')
        if (sk.novice) return hint ? [hint] : ['wave', 'smile'];
        return message(R, st, hint);
      },
      emoteChoice: (labels) => {
        // 줄게 / 여기 있어! / 좋아, 구해 올게! = 첫 번째 (기쁨·좋아) — 부탁은 goal.acceptRequest 가 false 면 두 번째
        if (goal.acceptRequest === false && res.ask === 'asked') return 1;
        return 0;
      },
      bag: (mode, slots, title) => {
        if (mode !== 'pick') return null;
        if (/선물/.test(title) && goal.gift) { const i = slots.findIndex(s => s && goal.gift(items().get(s.id), s)); res.gift = i >= 0 ? slots[i].id : 'none'; return i >= 0 ? i : null; }
        if (/부탁/.test(title)) { const i = slots.findIndex(s => s && goal.requestItem?.(items().get(s.id), s)); return i >= 0 ? i : slots.findIndex(s => s && !s.id.startsWith('tool.')); }
        return null;
      },
      dialog: () => 0,
    };
    bot.press('action');
    await bot.frames(3);
    await bot.settle(90, 0.5);
    bot.policy = {};
    offE();
    return res;
  };
  /** 이 주민이 좋아할 메시지 (공략: 좋아함 + 지금 말풍선의 💭 힌트 + 읽는 법). 힌트는 이번 말풍선 것만 따른다 (들어준 것을 또 보내면 갸웃) */
  function message(R, st, hint) {
    if (!R) return ['wave', 'smile'];
    const likes = R.likes ?? [];
    const rule = R.rule ?? {};
    const special = ['wait', 'ask', 'wave', 'heart'].includes(hint);
    if (hint === 'wait' || (rule.waitFirst && !st.waited)) { st.waited = true; return []; }   // 두부: 먼저 기다리기 (빈 보내기)
    const w = hint && !special ? hint : null;
    let msg;
    if (rule.fewer) msg = [w ?? likes[0]];                                       // 보리: 하나만
    else if (rule.more || hint === 'ask') msg = [w, ...likes].filter(Boolean).slice(0, 3);   // 코코: 셋 이어서 (하나면 "더!")
    else if (rule.waitFirst) msg = [w ?? likes.find(k => k !== 'wait'), likes.find(k => k !== 'wait' && k !== w)].filter(Boolean).slice(0, 2);
    else msg = [w, ...likes].filter(Boolean).slice(0, 2);
    if ((rule.greetFirst && !st.greeted) || hint === 'wave') { st.greeted = true; msg = [rule.greetFirst?.[0] ?? 'wave', ...msg].slice(0, 3); }
    return [...new Set(msg)];
  }

  /** 주민 집 문 앞 (문은 북쪽) */
  sk.toVillagerDoor = async slug => {
    const h = W().places.villagerHouses.find(x => x.slug === slug);
    if (!h?.door) return false;
    await bot.walkTo({ x: h.door.x, z: h.door.z }, { near: 0.3, label: `${slug} 집 문` });
    await bot.faceDir(0);
    return true;
  };

  /**
   * 주민 집 찾아가기: 문 앞 행동 키 → 집에 있으면 그 주민 방으로 들어가 말 걸고(goal = emoteTalk 목표) 문 매트로 나온다.
   * 자는 시간처럼 문이 '노크'면 노크 대화만. → { peek, entered, talked, left, knocked }
   */
  sk.visit = async (slug, { talk = true, goal = { wins: 1 }, shot = null } = {}) => {
    const res = { peek: null, entered: false, talked: null, left: false, knocked: false };
    if (!(await sk.toVillagerDoor(slug))) return res;
    res.peek = bot.peek();
    if (res.peek === 'town:knock') {
      bot.policy = { emote: () => null };
      await bot.act('action', { timeout: 40 });
      bot.policy = {};
      res.knocked = true;
      return res;
    }
    await bot.act('action', { timeout: 20 });
    res.entered = await bot.until(() => Math.abs(bot.pos().x) > 100, { timeout: 6 });
    if (!res.entered) return res;
    const entry = bot.pos();
    await bot.wait(1);
    if (shot) await bot.shot(shot, `${slug} 방`);
    if (talk) { const r = await sk.emoteTalk(slug, goal); res.talked = r.opened ? r.sent.map(x => x.kind) : false; }
    await bot.walkLocal(entry, { near: 0.25 });
    await bot.faceDir(180);
    await bot.act('action', { timeout: 10 });
    res.left = await bot.until(() => Math.abs(bot.pos().x) < 100, { timeout: 6 });
    if (!res.left) bot.issue('minor', 'house', `${slug} 방에서 문 매트로 나오기가 안 돼요 (${bot.peek()})`);
    return res;
  };

  // ---------- 우편함 ----------
  sk.mail = async () => {
    const ph = W().places.playerHouse;
    const unread = S().town.mail.unread?.()?.length ?? 0;
    // 우편함은 집 문 오른쪽(동쪽) 가까이
    const mb = bot.ctx.scene.getObjectByName?.('mailbox') ?? null;
    const at = mb?.position ?? { x: ph.door.x + 1.4, z: ph.door.z };
    await bot.approach(at, { dist: 0.75, label: '우편함' });
    if (bot.peek() !== 'town:mail') return { unread, opened: false };
    bot.policy = { dialog: () => 0 };
    await bot.act('action', { timeout: 60 });
    bot.policy = {};
    return { unread, opened: true, left: S().town.mail.unread?.()?.length ?? 0 };
  };

  return sk;
}
