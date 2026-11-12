// 주민 데이터 파일(assets/villagers/<slug>.json, 6차 M6-P3) 의 모양·이름표·검사 (DOM·three 없음).
// people.js(게임)·캐릭터 편집기 「성격·대화」 탭(editor.html)·반영 도구(tools/apply-traits.mjs)·테스트가 같이 쓴다. 모양은 docs/notes/m6-p3-traits.md.

/** 파일 → 게임이 쓰던 주민 설정 모양 (6차 전 people.js 의 PEOPLE 항목과 같다) */
export function toPerson(d) {
  const s = d.schedule, g = d.gifts, q = d.requests;
  return {
    slug: d.slug, name: d.name, color: d.color,
    ...(d.voice ? { voice: d.voice } : {}), ...(d.joySeason ? { joySeason: d.joySeason } : {}),
    pace: d.pace,
    wake: s.wake, sleep: s.sleep, rainStay: s.rainStay, snowStay: s.snowStay, range: d.roam.range,
    ...(s.nocturnal ? { nocturnal: true } : {}), ...(Array.isArray(s.homeBefore) ? { homeBefore: s.homeBefore } : {}), ...(Array.isArray(s.homeBreak) ? { homeBreak: s.homeBreak } : {}),   // P44 FB-01 낮에 집에 들르는 시간   // M12 D108-A 야행성
    haunts: d.roam.haunts,
    loves: g.loves, likes: g.likes, dislikes: g.dislikes,
    wants: q.wants, rewards: q.rewards,
    gifts: g.back,
  };
}
/** 파일 → 가게 주인 설정 (돌아다니지 않는다) */
export const toKeeper = d => ({ slug: d.slug, name: d.name, color: d.color, pace: d.pace });

/** 자주 가는 곳 (town/index.js buildSpots 의 이름) */
export const SPOTS = { home: '집 앞', plaza: '광장', dock: '선착장', shop: '상점 앞', museum: '박물관 앞', orchard: '과수원', bridge: '다리', beach: '바닷가', river: '강가', pond: '연못', flowers: '꽃밭' };
export const SEASONS = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };

/** 판정 몸짓 이름 (festival/talk.js 의 MOTION — 모델 동작 AN-01–05 가 생기기 전엔 모델을 기울이고 흔든다). happy = 모델의 기뻐하기 동작 */
export const GESTURES = { happy: '기뻐하기', jump: '폴짝', hop: '깡충', flap: '파닥', wag: '살랑', nod: '끄덕', sway: '흔들', tilt: '갸웃', yawn: '하품', droop: '축 처짐', turn: '고개 돌림', rub: '쓱쓱', puff: '볼 부풀림', curl: '움츠림', shake: '도리도리', back: '물러남' };

/** 이모티콘 읽는 법 (emote.rule 칸, festival/judge.js) — 편집기의 켜고 끄기 */
export const RULE_FLAGS = [
  { key: 'more', label: '이어 말하면 신난다', hint: '셋을 이어 보내면 한 단계 위, 하나만 보내면 "더!" (갸웃)' },
  { key: 'fewer', label: '하나만 천천히', hint: '둘·셋을 보내면 그만큼 한 단계씩 아래' },
  { key: 'greetFirst', label: '인사를 먼저', hint: '고른 인사 이모티콘을 먼저 받아야 마음을 연다', keys: true },
  { key: 'waitFirst', label: '기다려 주면 말문을 연다', hint: '⏳ 를 먼저, 한꺼번에 많이 보내면 물러남 (maxCalm = 그 수)', num: 'maxCalm' },
  { key: 'food', label: '먹을 것이면 기쁨', hint: '맛있다·과일·물고기 같은 먹을 것 이모티콘이 있으면 적어도 기쁨' },
  { key: 'askAnswers', label: '물으면 힌트', hint: '❓ 를 보내면 오늘 원하는 것을 알려 준다' },
  { key: 'rainBonus', label: '비 오면 더 기쁨', hint: '비 오는 날 이만큼 단계 위', num: 'rainBonus' },
  { key: 'echo', label: '따라 하면 아주 기쁨', hint: '주민이 바로 전에 보인 이모티콘을 그대로 보내면' },
];

/** 대사 묶음 이름 (편집기 이름표). 없는 이름은 칸 이름 그대로 보인다 */
export const LINE_LABELS = {
  intro: '처음 만남', greet: '인사', weather: '날씨', season: '계절', tier: '친한 정도', time: '시간대 한마디', chat: '잡담', menu: '메뉴 물을 때',
  goingHome: '집에 갈 때', request: '부탁', gift: '선물', bye: '잘 가', tierUp: '더 친해졌을 때', photo: '사진 줄 때', home: '문 너머', chatting: '수다 중 말 걸 때',
  banter: '주민끼리 수다', letters: '편지', together: '같이 하기 (M15)', song: '저녁 광장 노래 (M15)', birthday: '생일', event: '계절 행사 기간', 'EV-01': '봄 꽃놀이', 'EV-02': '여름 불꽃놀이', 'EV-03': '가을 수확 잔치', 'EV-04': '겨울 눈사람 날',
  dawn: '새벽', morning: '아침', afternoon: '낮', evening: '저녁', night: '밤', clear: '맑음', cloudy: '흐림', rain: '비', snow: '눈', rainbow: '무지개',
  spring: '봄', summer: '여름', autumn: '가을', winter: '겨울', new: '처음', known: '아는 사이', friend: '친구', close: '단짝', best: '절친',
  ask: '부탁하기', accept: '들어줄게', decline: '다음에', remind: '다시 물을 때', notYet: '아직', thanks: '고마워', reward: '보상', done: '오늘은 끝',
  love: '아주 좋아함', like: '좋아함', normal: '보통', dislike: '싫어함', many: '너무 많이', back: '답례', surprise: '먼저 주기', pending: '못 준 것', full: '가방 꽉 참', cancel: '안 줄 때',
  day: '낮', sleep: '잘 때', festivalAgain: '해마다 축제 축하', gift_: '선물 동봉', moving: '이사 전날', movein: '이사 온 날', playerBirthday: '내 생일', self: '자기 생일', door: '생일 문 너머', cake: '케이크', player: '내 생일 축하',
  // 가게 주인 (밤톨 · 느루)
  hello: '인사', keys: '키보드 안내', touch: '터치 안내', after: '그다음', list: '할 일 목록', firstday: '첫날', sell: '팔기', visit: '찾아가기', again: '다시', nightAfter: '밤 첫날 판 뒤',
  today: '오늘 들어온 가구', closed: '문 닫은 때', early: '이른 아침', welcome: '환영 편지', lot: '집터 편지',
  firstVisit: '처음 왔을 때', none: '기증할 게 없을 때', firstDonation: '첫 기증', thanksMany: '여러 개 기증', fossil: '화석', milestone: '기증 수 이정표', milestoneAny: '이정표 (그 밖)',
  complete: '한 분류 다 모음', fish: '물고기', bug: '곤충', allComplete: '모두 모음', appraise: '화석 감정', notice: '감정할 것 알아챔', noticeMany: '여러 개 알아챔', later: '나중에',
  look: '살펴보기', next: '다음 것', result: '감정 결과', rare: '희귀', owned: '이미 있음', doneOwned: '모두 있음', bagFull: '가방 꽉 참', story: '이야기', fake: '가품 미술품', found: '가품 알아챔', more: '더 볼까', empty: '빈 때', open: '시작', close_: '끝',
};
/** M15 묶음 안 이름 (같은 칸 이름이 다른 뜻일 때) — 편지 답장 · 같이 하기 · 저녁 노래 */
export const SUB_LABELS = {
  letters: { gift: '선물 동봉', reply: '내 편지 답장', replyLove: '답장 (아주 좋은 선물)', replyDislike: '답장 (취향 아닌 선물)', together: '같이 논 다음 날' },
  together: { ask: '무엇을 할까', fishYes: '낚시 좋아', walkYes: '산책 좋아', busy: '오늘은 어려워', notYet: '아직 덜 친함', caught: '주민이 낚았을 때', cheer: '내가 낚았을 때',
    walking: '산책 중 말 걸 때', stop: '그만할 때', end: '헤어질 때', gift: '작은 선물', sleepy: '집에 갈 시간' },
  song: { sing: '노래 가사 (16자)', talk: '노래 중 말 걸 때' },
};
export const lineLabel = (key, parent) => SUB_LABELS[parent]?.[key] ?? (parent === 'story' && key === 'close' ? LINE_LABELS.close_ : LINE_LABELS[key] ?? key);

/** 대사 자리 {이름} 또는 {이름:조사} (town/rules.js fill) — 이 밖의 이름은 오타로 본다 */
export const PLACEHOLDERS = { player: '플레이어 이름', island: '섬 이름', want: '부탁한 것', item: '물건 이름', reward: '보상', other: '수다 상대', furn: '오늘 들어온 가구', n: '개수', cat: '분류 이름' };

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isLine = e => typeof e === 'string' || (Array.isArray(e) && e.length > 0 && e.every(s => typeof s === 'string'));

/** 대사 묶음의 맨 끝 칸들 (배열) → [{ path: 'greet/morning', list }] */
export function linePools(lines, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(lines ?? {})) {
    const p = prefix ? `${prefix}/${k}` : k;
    if (Array.isArray(v)) out.push({ path: p, list: v });
    else if (isObj(v)) out.push(...linePools(v, p));
  }
  return out;
}

/** 선물 반응 규칙 한 칸이 맞는 모양인가: 분류('fish') · 아이템 id · 'rare' · 'hybrid' · 'price>=1000' */
export const giftRuleOk = (rule, env) => typeof rule === 'string' && (rule === 'rare' || rule === 'hybrid' || /^price>=\d+$/.test(rule)
  || (rule.includes('.') ? !env.itemIds || env.itemIds.has(rule) : !env.categories || env.categories.has(rule)));

/**
 * 주민 파일 검사 → [{ path, why }] (비면 정상). env = { itemIds: Set, categories: Set, emoteKeys: Set, playerKeys: Set } — 없는 칸은 건너뛴다.
 * 편집기 「확인」·반영 도구·테스트가 같은 말로 알린다.
 */
export function checkVillager(d, env = {}) {
  const bad = [];
  const no = (path, why) => bad.push({ path, why });
  if (!/^[a-z]+$/.test(d?.slug ?? '')) { no('slug', '영어 소문자 이름이 필요해요'); return bad; }
  if (!Number.isInteger(d.version) || d.version < 1) no('version', '1 이상 정수');
  if (!d.name?.trim()) no('name', '이름이 비었어요');
  if (!['villager', 'keeper'].includes(d.role)) no('role', 'villager 또는 keeper');
  if (!/^#[0-9A-Fa-f]{6}$/.test(d.color ?? '')) no('color', '#RRGGBB 색');
  for (const k of ['species', 'personality', 'speech']) if (typeof d.traits?.[k] !== 'string') no(`traits/${k}`, '글이 필요해요');
  const p = d.pace ?? {};
  for (const k of ['walk', 'run', 'happy']) if (!(p[k] >= 0 && p[k] <= 10)) no(`pace/${k}`, '0~10 숫자');
  if (!(Array.isArray(p.idle) && p.idle.length === 2 && p.idle[0] > 0 && p.idle[1] >= p.idle[0])) no('pace/idle', '[짧게, 길게] 초');
  if (d.role === 'villager') {
    const s = d.schedule ?? {};
    if (!(s.wake >= 5 && s.wake <= (s.nocturnal ? 21 : 12))) no('schedule/wake', s.nocturnal ? '야행성 주민이 나오는 시각은 5~21시' : '나오는 시각은 5~12시');
    if (s.homeBefore != null && !(Array.isArray(s.homeBefore) && s.homeBefore.length === 2 && s.homeBefore[0] >= 0 && s.homeBefore[1] >= s.homeBefore[0] && s.homeBefore[1] <= 8)) no('schedule/homeBefore', '[짧게, 길게] 시간 (0~8)');
    if (!(s.sleep >= s.wake + 4 && s.sleep <= 29)) no('schedule/sleep', '들어가는 시각은 나오고 4시간 뒤 ~ 다음 날 5시(29)');
    if (s.homeBreak != null && !(Array.isArray(s.homeBreak) && s.homeBreak.length === 2 && s.homeBreak[0] >= s.wake && s.homeBreak[1] > s.homeBreak[0] && s.homeBreak[1] - s.homeBreak[0] <= 4 && s.homeBreak[1] <= s.sleep)) no('schedule/homeBreak', '[들어가는 시각, 나오는 시각] — 일어난 뒤 · 자기 전, 4시간 안');
    for (const k of ['rainStay', 'snowStay']) if (typeof s[k] !== 'boolean') no(`schedule/${k}`, '켜기/끄기');
    const r = d.roam ?? {};
    if (!(r.range >= 4 && r.range <= 64)) no('roam/range', '4~64칸');
    const h = Object.entries(r.haunts ?? {});
    if (!h.length) no('roam/haunts', '자주 가는 곳이 하나는 있어야 해요');
    for (const [k, w] of h) if (!SPOTS[k] || !(w > 0)) no(`roam/haunts/${k}`, SPOTS[k] ? '가중치는 0보다 크게' : '없는 장소');
    const g = d.gifts ?? {};
    for (const k of ['loves', 'likes', 'dislikes']) {
      if (!Array.isArray(g[k])) { no(`gifts/${k}`, '목록이 필요해요'); continue; }
      for (const rule of g[k]) if (!giftRuleOk(rule, env)) no(`gifts/${k}`, `모르는 아이템·분류: ${rule}`);
    }
    const both = (g.loves ?? []).filter(x => (g.dislikes ?? []).includes(x));
    if (both.length) no('gifts/dislikes', `아주 좋아함과 싫어함에 같이 있어요: ${both.join(', ')}`);
    if (!Array.isArray(g.back) || !g.back.length) no('gifts/back', '답례 선물이 하나는 있어야 해요');
    for (const b of g.back ?? []) if (!(b?.w > 0) || (env.itemIds && !env.itemIds.has(b.id))) no('gifts/back', `답례 선물: ${b?.id}`);
    const q = d.requests ?? {};
    if (!Array.isArray(q.wants) || !q.wants.length) no('requests/wants', '부탁할 것이 하나는 있어야 해요');
    for (const w of q.wants ?? []) {
      const ok = w?.w > 0 && (w.cat ? !env.categories || env.categories.has(w.cat) : w.id === 'native' || !env.itemIds || env.itemIds.has(w.id));
      if (!ok) no('requests/wants', `부탁: ${w?.cat ?? w?.id}`);
    }
    for (const id of q.rewards ?? []) if (env.itemIds && !env.itemIds.has(id)) no('requests/rewards', `보상: ${id}`);
    const b = d.birthday;
    if (b?.file !== 'assets/data/rules.json' || b?.path !== `birthdays/dates/${d.slug}`) no('birthday', `생일은 assets/data/rules.json 의 birthdays/dates/${d.slug} 를 가리켜야 해요`);
    if (d.emote) checkEmote(d.emote, env, no);
  }
  const pools = linePools(d.lines);
  if (!pools.length) no('lines', '대사가 없어요');
  // 대사 길이 (tests/town.test.mjs 「대사 데이터」 와 같은 규칙): 주민 한 줄 60자 · 수다 말풍선 16자 · 가게 주인 64자 · 편지는 여러 줄 · 주민은 100줄 이상
  const maxLen = path => (d.role === 'keeper' ? 64 : path === 'banter' || path === 'song/sing' ? 16 : 60);   // M15 노래 가사도 말풍선이라 16자
  let count = 0;
  for (const { path, list } of pools) {
    if (!list.length) no(`lines/${path}`, '켜 둔 대사가 하나는 있어야 해요');
    list.forEach((e, i) => {
      if (!isLine(e)) { no(`lines/${path}/${i}`, '글 한 줄 또는 이어지는 여러 줄'); return; }
      if (d.role === 'villager' && /^letters\/(friend|close|thanks|reply|replyLove|replyDislike|together)$/.test(path) && !Array.isArray(e)) no(`lines/${path}/${i}`, '편지는 여러 줄 (칸 안에서 줄 바꾸기)');
      for (const s of [e].flat()) {
        count++;
        if (!s.trim()) no(`lines/${path}/${i}`, '빈 줄');
        if (s.length > maxLen(path)) no(`lines/${path}/${i}`, `한 줄이 ${maxLen(path)}자를 넘어요 (${s.length}자)`);
        for (const m of s.matchAll(/\{(\w+)(?::\S+?)?\}/g)) if (!PLACEHOLDERS[m[1]]) no(`lines/${path}/${i}`, `모르는 자리 {${m[1]}}`);
      }
    });
  }
  if (d.role === 'villager' && count < 100) no('lines', `켜 둔 대사가 ${count}줄이에요 (주민은 100줄 이상)`);
  for (const { path, list } of linePools(d.linesOff)) {
    if (!pools.some(x => x.path === path)) no(`linesOff/${path}`, '켜면 돌아갈 대사 묶음이 없어요');
    if (!list.every(isLine)) no(`linesOff/${path}`, '글 한 줄 또는 이어지는 여러 줄');
  }
  return bad;
}

function checkEmote(E, env, no) {
  const known = k => !env.emoteKeys || env.emoteKeys.has(k);
  const sendable = k => !env.playerKeys || env.playerKeys.has(k);
  if (!/^TK-\d\d$/.test(E.id ?? '')) no('emote/id', 'TK-01 모양');
  for (const k of ['likes', 'dislikes', 'wants', 'reply']) {
    if (!Array.isArray(E[k])) { no(`emote/${k}`, '목록이 필요해요'); continue; }
    for (const key of E[k]) if (!known(key)) no(`emote/${k}`, `없는 이모티콘: ${key}`);
  }
  for (const k of ['likes', 'wants']) for (const key of E[k] ?? []) if (known(key) && !sendable(key)) no(`emote/${k}`, `플레이어가 보낼 수 없는 이모티콘: ${key}`);
  if (!E.likes?.length) no('emote/likes', '좋아하는 이모티콘이 하나는 있어야 해요');
  if (!E.wants?.length) no('emote/wants', '원하는 것 후보가 하나는 있어야 해요');
  if ((E.reply?.length ?? 0) < 2) no('emote/reply', '대답 팔레트는 둘 이상 (앞의 둘을 가장 많이 쓴다)');
  const both = (E.likes ?? []).filter(k => (E.dislikes ?? []).includes(k));
  if (both.length) no('emote/dislikes', `좋아함과 싫어함에 같이 있어요: ${both.join(', ')}`);
  const r = E.rule ?? {};
  for (const k of Object.keys(r)) if (!RULE_FLAGS.some(f => f.key === k || f.num === k)) no(`emote/rule/${k}`, '모르는 읽는 법');
  if (r.greetFirst && !(Array.isArray(r.greetFirst) && r.greetFirst.length && r.greetFirst.every(sendable))) no('emote/rule/greetFirst', '인사 이모티콘 목록');
  if (r.maxCalm != null && !(Number.isInteger(r.maxCalm) && r.maxCalm >= 1 && r.maxCalm <= 3)) no('emote/rule/maxCalm', '1~3');
  if (r.rainBonus != null && !(Number.isInteger(r.rainBonus) && r.rainBonus >= 1 && r.rainBonus <= 3)) no('emote/rule/rainBonus', '1~3');
  for (const k of ['happy', 'puzzled']) if (E.gesture?.[k] && !GESTURES[E.gesture[k]]) no(`emote/gesture/${k}`, `없는 몸짓: ${E.gesture[k]}`);
}
