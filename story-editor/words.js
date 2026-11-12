// 스토리 편집기 (P36) — 「주민 · 편지 · 그 밖의 글」 탭.
// 장면 탭은 story-editor.html 이 그대로 맡고, 이 모듈은 글과 성격을 맡는다:
//   주민   = assets/villagers/<slug>.json 의 성격·말버릇·선물·부탁·이모티콘 규칙·글 대사·시간표, 생일(assets/data/rules.json)
//            (예전 캐릭터 편집기 「성격·대화」 탭을 옮겨 옴 — 판정·선물 반응·대사 고르기는 게임 코드 그대로 import)
//   편지   = 주민 파일 lines.letters (친구·단짝·고마워·생일·이사·떠난 뒤) + 밤톨 편지·안내 글
//   그 밖의 글 = assets/night/night.json · assets/events/events.json 의 말·이름 (+ 행사 기간 주민 대사), assets/tour/tour.json (글은 코드 안 → 의견) · assets/daily/daily.json (M13 섬 일상, M17-P4)
// 고친 것은 바로 이 페이지 저장소에 남는다: talk/<slug> (= tools/apply-traits.mjs 요청 모양 kind:'traits'),
// texts/<night|events|tour> (= tools/apply-texts.mjs 모양). 채팅 "스토리 반영" 때 Claude 가 파일에 얹는다 (docs/notes/p36-story-editor.md).
// 저장 기준(base)은 파일 version — 반영되어 파일 version 이 오르면 예전 초안은 저절로 안 읽힌다.

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => structuredClone(o);
const canon = o => JSON.stringify(o);
const loadJSON = url => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(url); return r.json(); });
const thumb = slug => `assets/renders/${slug}_thumb.png`;

/* ---------- 이름표 ---------- */
const TALK_GROUPS = {
  villager: [['traits', '성격·말버릇'], ['gifts', '좋아하는 것·부탁'], ['emote', '이모티콘 반응'], ['lines', '글 대사'], ['home', '생일·시간표']],
  keeper: [['traits', '성격·말버릇'], ['lines', '글 대사']],
};
const GROUP_OF = { name: 'traits', traits: 'traits', color: 'traits', pace: 'traits', gifts: 'gifts', requests: 'gifts', emote: 'emote', lines: 'lines', linesOff: 'lines', schedule: 'home', roam: 'home' };
const TOP_LABEL = { name: '이름', traits: '성격', color: '이름표 색', pace: '움직임', schedule: '시간표', roam: '자주 가는 곳', gifts: '선물', requests: '부탁', emote: '이모티콘', lines: '글 대사', linesOff: '꺼 둔 대사' };
const SUB_LABEL = { species: '종족', personality: '성격', speech: '말투', ending: '말끝', walk: '걷기', run: '달리기', runChance: '뛰는 정도', idle: '가만히 있는 시간',
  wake: '나오는 시각', sleep: '들어가는 시각', rainStay: '비 오면 집에', snowStay: '눈 오면 집에', range: '멀리 가는 한계', haunts: '자주 가는 곳',
  loves: '아주 좋아함', likes: '좋아함', dislikes: '싫어함', wants: '원하는 것', rewards: '보상 가구', reply: '대답 팔레트', rule: '읽는 법', gesture: '몸짓' };
const CAT_EMO = { fish: '🐟', bug: '🦋', fossil: '🦴', fruit: '🍎', shell: '🐚', flower: '🌷', mat: '🪵', tool: '🧰', furn: '🪑', seed: '🌱', festival: '🎪' };
const REACT_LABEL = { love: '아주 좋아함', like: '좋아함', normal: '보통', dislike: '싫어함' };
const FLAG_TEXT = { more: '이어 말해서 신났어요', 'want-more': '하나만 보내서 더 듣고 싶어 해요', 'too-many': '한꺼번에 너무 많았어요', 'greet-first': '인사를 먼저 기다려요',
  waited: '기다려 줘서 말문을 열었어요', 'wait-first': '먼저 기다려 주길 바라요', food: '먹을 것이라 기뻐요', answer: '물어봐서 원하는 것을 알려 줘요', rain: '비가 와서 더 기뻐요',
  echo: '따라 해 줘서 아주 기뻐요', hint: '원하는 것을 다시 보여 줘요' };
const SAMPLE = { player: '윤슬', island: '몽글섬', want: '물고기', item: '사과', reward: '라디오', other: '보리', furn: '소파·책장', n: 3, cat: '물고기',
  cost: 100, hits: 2, prize: '달떡', part: '' };
const SLOT_HOUR = { dawn: 6, morning: 9, afternoon: 14, evening: 18, night: 22 };
const SLOT_TIME = { dawn: '5–8시', morning: '8–12시', afternoon: '12–17시', evening: '17–20시', night: '20–5시' };
const PACE = [['walk', '걷기 빠르기', 0.4, 2.5, 0.05], ['run', '달리기 빠르기', 1, 4.5, 0.05], ['runChance', '뛰어다니는 정도', 0, 1, 0.05], ['happy', '기뻐하는 정도', 0, 0.5, 0.01],
  ['idle/0', '가만히 (짧게·초)', 0.5, 15, 0.5], ['idle/1', '가만히 (길게·초)', 0.5, 20, 0.5]];
const seasonOf = day => ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][Number(day.slice(5, 7)) - 1] ?? 'spring';
const clockOf = h => `${h >= 24 ? '다음 날 ' : ''}${Math.floor(h % 24)}:${h % 1 ? '30' : '00'}`;
const hourOf = h => `${h % 24}시`;
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** 어느 글이 언제 나오나 (대사 묶음 맨 위 칸 · 편지 종류) — 게임 코드(town/*.js)에서 읽어 온 설명 */
const WHEN = {
  intro: '처음 말 걸었을 때 한 번', greet: '말 걸 때 첫인사 (그 시간대)', weather: '인사에 섞이는 날씨 한마디', season: '인사에 섞이는 계절 한마디', tier: '친한 정도에 맞는 인사',
  time: '그 시간대 한마디', chat: '「이야기」를 고르면 (잡담)', menu: '무엇을 할지 물을 때', goingHome: '집에 들어갈 시각이 가까울 때', request: '부탁 (하루 하나, 3일 지나면 잊음)',
  gift: '선물을 줬을 때 (반응마다)', event: '계절 행사 기간에 말 걸 때', bye: '대화를 끝낼 때', tierUp: '친한 정도가 오른 날 한 번', photo: '절친이 되어 사진을 줄 때',
  home: '집 문 너머 (낮 · 비 · 잘 때)', chatting: '주민끼리 수다 중일 때 말 걸면', banter: '주민 둘이 수다 떨 때 머리 위 말풍선', leave: '이사 가겠다고 할 때 (이사 오가기)',
  letters: '우편함 편지 (편지 탭)', birthday: '그 주민 생일 (하루 종일 집에서 파티)',
  together: '친구 이상 주민에게 「같이 놀자」 (🎣 낚싯대 · 🏃) — 같이 낚시·산책하는 동안과 끝날 때 (M15)', song: '저녁 18–20시 광장에서 주민 둘이 번갈아 노래할 때 — 가사는 머리 위 🎵 말풍선 (M15)',
  art: '주에 한두 번 친구 이상 주민이 「○○ 보고 싶어요」 — 그날 처음 말 걸 때 · 보여 주면 친밀도, 바꿔 주면 친밀도+가구 · 자리 {art} = 작품 이름 (M18-P4)',
  // 가게 주인
  firstday: '첫날 안내 (밤톨)', today: '오늘 들어온 가구 안내', after: '첫날 할 일을 마친 뒤', closed: '가게 문 닫은 때 (8–22시 밖)', nightShop: '밤 매장 (22–8시) — 지하 밤 코너·덮개 천 안내 (실내 전수)',
  firstVisit: '박물관에 처음 왔을 때', none: '기증할 게 없을 때', firstDonation: '첫 기증', thanks: '기증 고마워', thanksMany: '여러 개 기증', fossil: '화석 감정',
  milestone: '기증 수 이정표', milestoneAny: '이정표 (그 밖)', complete: '한 분류를 다 모았을 때', allComplete: '모두 모았을 때', appraise: '화석 감정', bagFull: '가방이 꽉 찼을 때', story: '느루의 옛이야기', fake: '가품 미술품을 내밀 때 (M17-P2 — 다른 점 한 줄은 art-items.js MUSEUM_TELL)',
};
export const LETTER_WHEN = {
  friend: '친구가 된 뒤 가끔 아침 우편함', close: '단짝이 된 뒤 가끔 아침 우편함', thanks: '부탁을 들어준 다음 날 아침', gift: '편지에 선물이 들어 있을 때 끝에 붙는 한 줄',
  birthday: '그 주민 생일 아침 — 파티 초대', playerBirthday: '내 생일 아침 (만난 주민 몇 명이)', moving: '이사 오기 전날 (집터 표지판 뒤)', movein: '이사 온 날',
  away: '섬을 떠난 뒤 며칠마다', welcome: '첫날 할 일을 마친 다음 (밤톨 환영)', lot: '빈 집터에 표지판이 선 날 (밤톨)',
  festival: '첫 섬 축제(엔딩)가 끝난 다음 아침 — 섬 주민 모두', festivalAgain: '해마다 섬 축제가 끝난 다음 아침 (두 번째부터)',
  reply: '내가 우편함에서 보낸 편지의 답장 — 다음 날 아침 (선물이 없거나 보통·좋아함, M15)', replyLove: '내 편지에 넣은 선물을 아주 좋아했을 때 답장 — {item} = 내가 넣은 선물 (M15)',
  replyDislike: '내 편지에 넣은 선물이 취향이 아닐 때 답장 (M15)', together: '같이 낚시·산책한 다음 날 아침 (가끔, M15)',
};
const LETTER_ORDER = ['friend', 'close', 'thanks', 'gift', 'reply', 'replyLove', 'replyDislike', 'together', 'birthday', 'playerBirthday', 'festival', 'festivalAgain', 'moving', 'movein', 'away', 'welcome', 'lot'];
const LETTER_NAME = { friend: '친구', close: '단짝', thanks: '고마워', gift: '선물 동봉', birthday: '주민 생일', playerBirthday: '내 생일', moving: '이사 전날', movein: '이사 온 날', away: '떠난 뒤', welcome: '환영 (밤톨)', lot: '집터 (밤톨)', guide: '밤톨 안내 글', festival: '첫 축제 축하', festivalAgain: '해마다 축제 축하', reply: '내 편지 답장', replyLove: '답장 · 아주 좋은 선물', replyDislike: '답장 · 취향 아닌 선물', together: '같이 논 다음 날' };
const GUIDE_POOLS = ['intro', 'firstday', 'today', 'after', 'closed', 'nightShop'];   // 밤톨 안내 글 (편지 탭 — nightShop = 실내 전수 밤 매장)

/** 그 밖의 글: 파일 · 언제 · 글 칸 이름 */
const TEXT_FILES = { night: 'assets/night/night.json', events: 'assets/events/events.json', tour: 'assets/tour/tour.json', daily: 'assets/daily/daily.json' };   // daily = M13 섬 일상 (M17-P4)
const TEXT_TITLE = { night: '밤 · 새벽', events: '계절 행사', tour: '무인도 투어', daily: '섬 일상' };
const KEY_LABEL = { name: '이름', text: '카드 글', effect: '효과 설명', greet: '인사', first: '처음 만남', after: '그다음', bye: '잘 가', closed: '문 닫은 때', already: '오늘 이미 뽑음',
  start: '열렸을 때 알림', morning: '아침 알림', ringIntro: '고리 던지기 안내', ringLose: '하나도 못 걸었을 때', ringWin: '걸었을 때', sleepNote: '자는 중 쪽지', visit: '밤에 놀러 갔을 때',
  label: '할 일', beforeLine: '축제 전에 행사 날이 오면 (주민 한마디)' };
const SKIP_TEXT = new Set(['about', 'note', 'id', 'sym', 'color', 'kind', 'host', 'keeper', 'building', 'lanterns', 'side', 'near']);

/* ---------- 경로 'a/b/0' (tools/edits.mjs 와 같은 모양) ---------- */
const segs = p => String(p).split('/').filter(Boolean);
const getIn = (o, p) => segs(p).reduce((v, k) => (v == null ? undefined : v[k]), o);
function setIn(o, p, val) {
  const s = segs(p);
  let cur = o;
  for (const [i, k] of s.slice(0, -1).entries()) cur = (cur[k] ??= /^\d+$/.test(s[i + 1]) ? [] : {});
  cur[s.at(-1)] = val;
}
function pruneIn(o, p) {
  const s = segs(p);
  for (let n = s.length; n > 0; n--) {
    const parent = n > 1 ? getIn(o, s.slice(0, n - 1).join('/')) : o, v = parent?.[s[n - 1]];
    const empty = Array.isArray(v) ? !v.length : v && typeof v === 'object' && !Object.keys(v).length;
    if (!empty) break;
    delete parent[s[n - 1]];
  }
}
/** 글 칸 (한글이 든 문자열) 경로 목록 — 그 밖의 글 */
export function textLeaves(o, prefix = '') {
  const out = [];
  if (typeof o === 'string') { if (/[가-힣]/.test(o)) out.push(prefix); return out; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!SKIP_TEXT.has(k)) out.push(...textLeaves(v, prefix ? `${prefix}/${k}` : k));
  return out;
}
/** 글 칸만 비교 (구조는 그대로라 경로 → 새 글) */
export const textDiff = (a, b) => Object.fromEntries(textLeaves(a).filter(p => getIn(a, p) !== getIn(b, p)).map(p => [p, getIn(b, p)]));

/* ================================================================== */
export function createWords({ saveSoon, busy, writable, onChange }) {
  let TK = null;
  const V = new Map();       // slug → { doc, draft, bday0, bday, note }
  const T = {};              // id → { file, doc, draft, note }
  const seen = {};           // 저장소에서 마지막으로 받은 것 (되돌이 막기)
  let vsel = 'coco', tsub = 'traits', tlpool = null, lsel = 'friend', lastText = null, tryS = null;

  async function load() {
    const [J, E, R, F, Tr, I, Tb, B, Ed] = await Promise.all([
      import('../src/gameplay/festival/judge.js'), import('../src/gameplay/festival/emotes.js'), import('../src/gameplay/town/rules.js'),
      import('../src/gameplay/town/files.js'), import('../src/gameplay/town/traits.js'), import('../src/data/items.js'),
      import('../src/data/tables.js'), import('../src/data/birthdays.js'), import('../tools/edits.mjs')]);
    const [set, talk, ...rest] = await Promise.all(['assets/emotes/emotes.json', 'assets/emotes/talk.json', ...F.VILLAGER_FILES, ...Object.values(TEXT_FILES)].map(loadJSON));
    const files = rest.slice(0, F.VILLAGER_FILES.length), texts = rest.slice(F.VILLAGER_FILES.length);
    const docs = new Map(files.map(d => [d.slug, d]));
    const emo = E.createEmoteSet(set, J.withVillagers(talk, files));
    const items = I.ITEMS.filter(it => !it.unknown);
    const env = { itemIds: new Set([...items.map(i => i.id), 'native']), categories: new Set(I.CATEGORIES),
      emoteKeys: new Set(set.emotes.map(e => e.key)), playerKeys: new Set(emo.player.map(e => e.key)) };
    TK = { J, R, Tr, I, B, Ed, RULES: Tb.RULES, talk, emo, docs, items, env, order: files.map(d => d.slug) };
    Object.keys(TEXT_FILES).forEach((id, i) => { T[id] = { id, file: TEXT_FILES[id], doc: texts[i], draft: clone(texts[i]), note: '' }; });
    for (const d of files) vs(d.slug);
    if (!docs.has(vsel)) vsel = TK.order[0];
    return TK;
  }
  function vs(slug) {
    if (!V.has(slug)) {
      const doc = TK.docs.get(slug);
      const bday0 = doc.role === 'villager' ? (TK.RULES.birthdays.dates[slug] ?? null) : null;
      V.set(slug, { doc, draft: clone(doc), bday0, bday: bday0, note: '' });
    }
    return V.get(slug);
  }
  const cur = () => vs(vsel);
  const svgOf = (k, label = true) => TK.emo.svg(k, label);
  const emoName = k => TK.emo.name(k);
  const gestureName = g => (g === 'idle' ? '그대로' : TK.Tr.GESTURES[g] ?? g);

  /* ----- 바뀐 것 ----- */
  function vChanges(st) {
    const changes = TK.Ed.diffTables(st.doc, st.draft);
    const rules = st.doc.role === 'villager' && st.bday !== st.bday0 ? { [`birthdays/dates/${st.doc.slug}`]: st.bday } : {};
    return { changes, rules };
  }
  const vDirty = st => { const c = vChanges(st); return Object.keys(c.changes).length + Object.keys(c.rules).length; };
  const tChanges = t => textDiff(t.doc, t.draft);
  /** 머리 상태 칸이 쓰는 목록 → [{ key, label, what }] */
  function changes() {
    if (!TK) return [];
    const out = [];
    for (const st of V.values()) {
      const n = vDirty(st);
      const what = [n ? `${n}칸` : '', st.note ? '의견' : ''].filter(Boolean);
      if (what.length) out.push({ key: `talk/${st.doc.slug}`, label: st.doc.name, what: what.join('·') });
    }
    for (const t of Object.values(T)) {
      const n = Object.keys(tChanges(t)).length;
      const what = [n ? `${n}칸` : '', t.note ? '의견' : ''].filter(Boolean);
      if (what.length) out.push({ key: `texts/${t.id}`, label: TEXT_TITLE[t.id], what: what.join('·') });
    }
    return out;
  }
  const pathLabel = (st, p) => {
    const s = segs(p);
    const out = [TOP_LABEL[s[0]] ?? s[0]];
    for (const [i, k] of s.slice(1).entries()) {
      const parent = s.slice(0, i + 1).join('/'), inList = Array.isArray(getIn(st.draft, parent) ?? getIn(st.doc, parent));
      out.push(inList ? `${+k + 1}번째` : s[0].startsWith('lines') ? TK.Tr.lineLabel(k, s[i]) : SUB_LABEL[k] ?? TK.Tr.SPOTS[k] ?? k);
    }
    return out.join(' › ');
  };
  function vProblems(st) {
    const out = TK.Tr.checkVillager(st.draft, TK.env).map(b => ({ path: b.path, why: b.why }));
    if (st.doc.role === 'villager' && st.bday != null && !TK.B.validMmdd(st.bday)) out.push({ path: 'birthday', why: '맞지 않는 날짜' });
    return out;
  }
  const tProblems = t => Object.entries(tChanges(t)).filter(([, v]) => !String(v ?? '').trim()).map(([p]) => ({ path: p, why: '빈 글' }));

  /* ----- 저장 (talk/<slug> · texts/<id>) ----- */
  const short = v => { const s = v === undefined ? '(없음)' : typeof v === 'string' ? v : JSON.stringify(v); return s.length > 140 ? `${s.slice(0, 137)}…` : s; };
  function vText(st) {
    const { changes: ch, rules } = vChanges(st), d = st.doc;
    const out = [`[스토리 편집기 · ${d.id} ${d.name} 성격·대화 · 기준 주민 파일 v${d.version}]`];
    if (st.note) out.push('', '■ 의견', st.note);
    const keys = Object.keys(ch);
    if (keys.length) out.push('', `■ 바뀐 칸 ${keys.length}`, ...keys.map(p => `- ${pathLabel(st, p)} (${p}): ${short(getIn(d, p))} → ${short(ch[p])}`));
    if (Object.keys(rules).length) out.push('', '■ 생일 (assets/data/rules.json)', `- ${st.bday0 ?? '이사 온 날'} → ${st.bday ?? '이사 온 날'}`);
    return out.join('\n');
  }
  function tText(t) {
    const ch = tChanges(t);
    const out = [`[스토리 편집기 · ${TEXT_TITLE[t.id]} 글 · ${t.file} v${t.doc.version ?? 0}]`];
    if (t.note) out.push('', '■ 의견', t.note);
    const keys = Object.keys(ch);
    if (keys.length) out.push('', `■ 바뀐 글 ${keys.length}`, ...keys.map(p => `- ${p}: ${short(getIn(t.doc, p))} → ${short(ch[p])}`));
    return out.join('\n');
  }
  function saveV(st) {
    const slug = st.doc.slug;
    saveSoon(`talk/${slug}`, () => {
      const { changes: ch, rules } = vChanges(st);
      const data = { slug, kind: 'traits', base: st.doc.version, changes: ch, rules, request: st.note, text: vText(st) };
      seen[`talk/${slug}`] = canon([data.base, ch, rules, st.note]);
      return data;
    });
    onChange();
  }
  function saveT(t) {
    saveSoon(`texts/${t.id}`, () => {
      const ch = tChanges(t);
      const data = { which: t.id, file: t.file, base: t.doc.version ?? 0, changes: ch, request: t.note, text: tText(t) };
      seen[`texts/${t.id}`] = canon([data.base, ch, t.note]);
      return data;
    });
    onChange();
  }
  /** 저장소에서 받은 초안 얹기 (기준 버전이 지금 파일과 같을 때만 — 반영된 뒤 예전 초안은 저절로 빠진다) */
  function fromStore(col, rows) {
    if (!TK) return false;
    let touched = false;
    for (const r of rows) {
      const id = r._id ?? r.slug ?? r.id;
      if (col === 'talk') {
        const doc = TK.docs.get(id);
        if (!doc || r.base !== doc.version) continue;
        const sig = canon([r.base, r.changes ?? {}, r.rules ?? {}, r.request ?? '']);
        if (seen[`talk/${id}`] === sig || (busy() && id === vsel)) continue;
        seen[`talk/${id}`] = sig;
        const st = vs(id), res = TK.Ed.applyChanges(clone(doc), r.changes ?? {});
        st.draft = res.out;
        const key = `birthdays/dates/${id}`;
        st.bday = r.rules && key in r.rules ? r.rules[key] : st.bday0;
        st.note = r.request ?? '';
        touched = true;
      } else {
        const t = T[id];
        if (!t || r.base !== (t.doc.version ?? 0)) continue;
        const sig = canon([r.base, r.changes ?? {}, r.request ?? '']);
        if (seen[`texts/${id}`] === sig || busy()) continue;
        seen[`texts/${id}`] = sig;
        t.draft = clone(t.doc);
        for (const [p, v] of Object.entries(r.changes ?? {})) if (typeof getIn(t.doc, p) === 'string' && typeof v === 'string') setIn(t.draft, p, v);
        t.note = r.request ?? '';
        touched = true;
      }
    }
    if (touched) { renderAll(); onChange(); }
    return touched;
  }

  /* ================= 주민 탭 ================= */
  function renderVill() {
    const host = $('pane-villager');
    if (!host) return;
    const st = cur(), d = st.draft;
    if (!TALK_GROUPS[d.role].some(([k]) => k === tsub)) tsub = 'traits';
    const pick = role => TK.order.map(vs).filter(x => x.doc.role === role).map(x => `<button type="button" class="vbtn" data-v="${esc(x.doc.slug)}" aria-pressed="${x.doc.slug === vsel}">
        <img src="${thumb(x.doc.slug)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(x.draft.name)}</span>${vDirty(x) || x.note ? '<i class="dot" title="반영 뒤 바뀜"></i>' : ''}</button>`).join('');
    host.innerHTML = `<div class="scene">
      <div class="side">
        <div class="box"><h3>주민</h3><div class="vlist">${pick('villager')}</div><h3>가게 주인</h3><div class="vlist">${pick('keeper')}</div></div>
        ${d.role === 'villager' ? tryBoxHTML() : `<div class="box"><h3>글 대사로 말 걸어 보기</h3><p class="small muted">가게 주인은 이모티콘 대화 대신 정해진 말을 해요. 글 대사 갈래에서 묶음마다 언제 나오는지 볼 수 있어요.</p></div>`}
      </div>
      <div class="box" id="talkCard" style="gap:14px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><img class="face" src="${thumb(d.slug)}" alt="" onerror="this.style.visibility='hidden'">
          <div style="display:grid;gap:2px"><h2>${esc(d.name)} <span class="small muted">${esc(d.traits?.species ?? '')}</span></h2>
          <span class="mono">${esc(d.id)} · 주민 파일 v${st.doc.version} · ${d.role === 'villager' ? '주민' : '가게 주인'}</span></div></div>
        <div class="subtabs" id="subtabs" role="group" aria-label="고칠 갈래">${TALK_GROUPS[d.role].map(([k, label]) => `<button type="button" data-sub="${k}" aria-pressed="${k === tsub}">${label}<span class="n"></span></button>`).join('')}</div>
        <div class="tsec" id="talkSec">${{ traits: secTraits, gifts: secGifts, emote: secEmote, lines: secLines, home: secHome }[tsub]()}</div>
        ${footHTML('v')}
      </div></div>`;
    if (tsub === 'emote') fillReact();
    if (d.role === 'villager') renderTry(true);
    refreshVMeta();
  }
  function footHTML(kind) {
    const note = kind === 'v' ? cur().note : T[tsel].note;
    const ph = kind === 'v' ? '예: 코코가 비 오는 날엔 좀 더 시무룩했으면 좋겠어. 잡담에 바다 이야기를 두 줄 더 넣어 줘' : '예: 달빛 가게 인사가 조금 더 수줍었으면. 투어 배 안내 글을 짧게';
    return `<div class="tsec foot">
      <div><span class="group-title">반영 뒤 바뀐 것 <span class="n" id="${kind}ChgN"></span></span><ul class="changes" id="${kind}ChgList"></ul></div>
      <div id="${kind}ProbBox" hidden><span class="group-title" style="color:var(--warn)">고칠 것 (이대로는 게임에 넣을 수 없어요)</span><ul class="problems" id="${kind}ProbList"></ul></div>
      <label class="f">의견 · 자유 요청<textarea rows="3" id="${kind}Note" placeholder="${esc(ph)}">${esc(note)}</textarea></label>
      <div class="actions edit-only"><button type="button" class="btn ghost tiny" id="${kind}Copy">글로 복사하기</button><button type="button" class="btn ghost tiny" id="${kind}Reset">처음 값으로</button>
        <span class="small muted" id="${kind}Msg">고친 것은 바로 저장돼요. 게임에 넣으려면 맨 위 「반영 요청 표시」 뒤 채팅에 <b>"스토리 반영"</b>.</span></div>
      <div id="${kind}OutWrap" hidden><textarea rows="8" id="${kind}Out" readonly class="mono" aria-label="요청 글"></textarea></div></div>`;
  }
  function refreshVMeta() {
    const st = cur(), { changes: ch, rules } = vChanges(st);
    const keys = Object.keys(ch);
    const items = keys.map(p => `<li>${esc(pathLabel(st, p))} <code>${esc(p)}</code></li>`);
    if (Object.keys(rules).length) items.push(`<li>생일: ${esc(st.bday0 ? TK.B.birthdayLabel(st.bday0) : '이사 온 날')} → ${esc(st.bday ? TK.B.birthdayLabel(st.bday) : '이사 온 날')} <code>rules.json</code></li>`);
    if (!$('vChgList')) return;
    $('vChgN').textContent = items.length ? `${items.length}칸` : '';
    $('vChgList').innerHTML = items.join('') || '<li class="muted" style="list-style:none;margin-left:-18px">아직 없어요. 고치면 여기에 칸마다 적혀요.</li>';
    const probs = vProblems(st);
    $('vProbBox').hidden = !probs.length;
    $('vProbList').innerHTML = probs.map(b => `<li>${esc(pathLabel(st, b.path))} — ${esc(b.why)} <code>${esc(b.path)}</code></li>`).join('');
    const per = {};
    for (const p of keys) { const g = GROUP_OF[segs(p)[0]] ?? 'traits'; per[g] = (per[g] ?? 0) + 1; }
    if (Object.keys(rules).length) per.home = (per.home ?? 0) + 1;
    for (const b of document.querySelectorAll('#subtabs [data-sub]')) { const n = b.querySelector('.n'); if (n) n.textContent = per[b.dataset.sub] || ''; }
    const btn = document.querySelector(`.vbtn[data-v="${vsel}"]`);
    if (btn) { const has = !!(items.length || st.note); const dot = btn.querySelector('.dot'); if (has && !dot) btn.insertAdjacentHTML('beforeend', '<i class="dot" title="반영 뒤 바뀜"></i>'); else if (!has && dot) dot.remove(); }
  }
  function touchV(rerender = false) {
    const st = cur();
    saveV(st);
    if (rerender) { const y = scrollY; $('talkSec').innerHTML = { traits: secTraits, gifts: secGifts, emote: secEmote, lines: secLines, home: secHome }[tsub](); if (tsub === 'emote') fillReact(); scrollTo(0, y); }
    refreshVMeta();
    if (st.doc.role === 'villager') { drawWant(); if (tsub === 'emote') fillReact(); }
  }

  /* ----- 고르기 목록 ----- */
  function ruleLabel(rule) {
    if (rule === 'rare') return '✨ 희귀한 것';
    if (rule === 'hybrid') return '🌸 교배로 핀 꽃';
    if (rule === 'native') return '🍑 섬 특산 과일';
    const m = /^price>=(\d+)$/.exec(rule);
    if (m) return `💰 값 ${Number(m[1]).toLocaleString('ko-KR')} 이상`;
    if (!rule.includes('.')) return `${CAT_EMO[rule] ?? '📦'} ${TK.I.CATEGORY_NAMES[rule] ?? rule} 전부`;
    const it = TK.I.get(rule);
    return it ? `${it.emoji ?? ''} ${it.name}` : rule;
  }
  function ruleOptions(kind, selected = '') {
    const opt = (v, label) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`;
    const out = [selected ? '' : '<option value="">— 고르기 —</option>'];
    const val = id => (kind === 'want' ? `id:${id}` : id);
    if (kind === 'gift') out.push(`<optgroup label="특별">${['rare', 'hybrid', 'price>=1000', 'price>=3000', 'price>=5000'].map(r => opt(r, ruleLabel(r))).join('')}</optgroup>`);
    if (kind === 'gift' || kind === 'want') out.push(`<optgroup label="분류 전부">${TK.I.CATEGORIES.map(c => opt(kind === 'want' ? `cat:${c}` : c, ruleLabel(c))).join('')}</optgroup>`);
    if (kind === 'want') out.push(opt('id:native', ruleLabel('native')));
    for (const c of TK.I.CATEGORIES) {
      if (kind === 'furn' && c !== 'furn') continue;
      const list = TK.items.filter(it => it.category === c);
      if (list.length) out.push(`<optgroup label="${esc(TK.I.CATEGORY_NAMES[c] ?? c)}">${list.map(it => opt(val(it.id), `${it.emoji ?? ''} ${it.name}`)).join('')}</optgroup>`);
    }
    const html = out.join('');
    return selected && !html.includes(`value="${esc(selected)}"`) ? opt(selected, `${selected} (목록에 없음)`) + html : html;
  }
  const slider = (path, label, min, max, step, val, show = v => v) =>
    `<label class="slider"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-f="${path}" data-type="num" aria-label="${esc(label)}"><output>${esc(show(val))}</output></label>`;

  /* ----- 갈래 ----- */
  function secTraits() {
    const d = cur().draft, t = d.traits;
    return `<h3>성격 · 말버릇 <span class="small muted">대사를 새로 쓰거나 고칠 때 Claude 가 따르는 기준이에요 (게임 화면에는 바로 나오지 않아요)</span></h3>
      <div class="grid2">
        <label class="f">종족<input type="text" data-f="traits/species" value="${esc(t.species)}"></label>
        <label class="f">말끝 (대사 끝에 붙는 말)<input type="text" data-f="traits/ending" value="${esc(t.ending)}" placeholder="없으면 비워 두기"></label>
      </div>
      <label class="f">성격<input type="text" data-f="traits/personality" value="${esc(t.personality)}"></label>
      <label class="f">말투<textarea rows="3" data-f="traits/speech">${esc(t.speech)}</textarea></label>
      <div><span class="group-title">이름표 · 말풍선 색</span>
        <label class="swatch"><input type="color" data-f="color" data-type="color" value="${esc(d.color.toLowerCase())}"><span>${esc(d.name)} 이름표 <code>${esc(d.color)}</code></span></label></div>
      <div><span class="group-title">움직임 (섬에서 걸어 다닐 때)</span><div class="sliders">
        ${PACE.filter(([k]) => getIn(d.pace, k) != null).map(([k, label, min, max, step]) => slider(`pace/${k}`, label, min, max, step, getIn(d.pace, k))).join('')}</div></div>`;
  }
  function secGifts() {
    const d = cur().draft, g = d.gifts, q = d.requests, P = TK.R.GIFT_POINTS;
    const chips = (list, path, label) => list.map((r, i) => `<span class="tchip">${esc(label(r))}<button type="button" data-rm="${path}" data-i="${i}" aria-label="${esc(label(r))} 빼기">✕</button></span>`).join('') || '<span class="small muted">없음</span>';
    const ruleList = (key, label, pts) => `<div><span class="group-title">${label} <span class="pts">친밀도 +${pts}</span></span>
        <div class="chiprow">${chips(g[key], `gifts/${key}`, ruleLabel)}</div>
        <div class="addrow"><select id="add-${key}" aria-label="${label}에 더할 것">${ruleOptions('gift')}</select><button type="button" class="btn ghost tiny" data-add="gifts/${key}" data-from="add-${key}">더하기</button></div></div>`;
    const row = (path, i, value, w, kind) => `<div class="rowline"><select data-row="${path}" data-i="${i}" data-k="what" aria-label="${i + 1}번째 줄">${ruleOptions(kind, value)}</select>
        <input type="number" min="1" max="20" step="1" value="${w}" data-row="${path}" data-i="${i}" data-k="w" aria-label="${i + 1}번째 줄 무게">
        <button type="button" class="btn ghost tiny" data-rm="${path}" data-i="${i}" aria-label="${i + 1}번째 줄 빼기">✕</button></div>`;
    return `<h3>선물 반응 <span class="small muted">위에서부터 먼저 맞는 것으로 정해요 · 그 밖은 보통 +${P.normal}</span></h3>
      ${ruleList('loves', '아주 좋아함', P.love)}${ruleList('dislikes', '싫어함', P.dislike)}${ruleList('likes', '좋아함', P.like)}
      <div><span class="group-title">답례로 주는 것 (무게가 클수록 자주)</span><div class="rows">${g.back.map((b, i) => row('gifts/back', i, b.id, b.w, 'item')).join('')}</div>
        <button type="button" class="btn ghost tiny" data-addrow="gifts/back">줄 더하기</button></div>
      <h3>부탁 <span class="small muted">하루에 하나, 무게가 클수록 자주 · 3일 지나면 잊어요</span></h3>
      <div><span class="group-title">부탁할 것</span><div class="rows">${q.wants.map((w, i) => row('requests/wants', i, w.cat ? `cat:${w.cat}` : `id:${w.id}`, w.w, 'want')).join('')}</div>
        <button type="button" class="btn ghost tiny" data-addrow="requests/wants">줄 더하기</button></div>
      <div><span class="group-title">부탁을 들어주면 주는 가구 (가끔 — 아니면 도토리 주머니)</span>
        <div class="chiprow">${chips(q.rewards, 'requests/rewards', ruleLabel)}</div>
        <div class="addrow"><select id="add-rewards" aria-label="보상 가구 더하기">${ruleOptions('furn')}</select><button type="button" class="btn ghost tiny" data-add="requests/rewards" data-from="add-rewards">더하기</button></div></div>`;
  }
  function secEmote() {
    const E = cur().draft.emote, r = E.rule ?? {};
    const pal = E.reply.map((k, i) => `<span class="tchip emo">${svgOf(k, false)}<span>${esc(emoName(k))}</span>
        <button type="button" data-mv="emote/reply" data-i="${i}" data-d="-1" aria-label="${esc(emoName(k))} 앞으로">←</button><button type="button" data-mv="emote/reply" data-i="${i}" data-d="1" aria-label="${esc(emoName(k))} 뒤로">→</button>
        <button type="button" data-rm="emote/reply" data-i="${i}" aria-label="${esc(emoName(k))} 빼기">✕</button></span>`).join('');
    const addable = TK.emo.set.emotes.filter(e => !E.reply.includes(e.key));
    const greetKeys = [...new Set([...TK.emo.player.filter(e => e.cat === 'greet').map(e => e.key), ...TK.talk.friendly])];
    const flags = TK.Tr.RULE_FLAGS.map(f => {
      const on = f.key in r && r[f.key] !== false;
      let extra = '';
      if (on && f.keys) extra = `<div class="extra">${greetKeys.map(k => `<button type="button" class="emo-btn" data-greet="${k}" aria-pressed="${(r.greetFirst ?? []).includes(k)}">${svgOf(k, false)}<span>${esc(emoName(k))}</span></button>`).join('')}</div>`;
      if (on && f.num) extra = `<div class="extra"><label class="small">${f.num === 'maxCalm' ? '한 번에 괜찮은 수' : '올라가는 단계'} <input type="number" min="1" max="3" step="1" value="${r[f.num] ?? (f.num === 'maxCalm' ? 2 : 1)}" data-rulenum="${f.num}"></label></div>`;
      return `<div class="flag"><input type="checkbox" id="rf-${f.key}" data-rule="${f.key}"${on ? ' checked' : ''}><label for="rf-${f.key}">${esc(f.label)}</label><span class="small muted">${esc(f.hint)}</span>${extra}</div>`;
    }).join('');
    const gsel = k => `<select data-f="emote/gesture/${k}">${Object.entries(TK.Tr.GESTURES).map(([g, n]) => `<option value="${g}"${E.gesture?.[k] === g ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const rows = TK.emo.player.map(({ key: k }) => {
      const v = E.likes.includes(k) ? 'like' : E.dislikes.includes(k) ? 'dislike' : 'none';
      return `<tr class="${v}"><td class="em">${svgOf(k, false)}<span>${esc(emoName(k))}</span></td>
        <td><select data-react="${k}" aria-label="${esc(emoName(k))} 반응">${[['like', '좋아함 +2'], ['none', '보통'], ['dislike', '싫어함 −2']].map(([o, l]) => `<option value="${o}"${o === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
        <td style="text-align:center"><input type="checkbox" data-want="${k}"${E.wants.includes(k) ? ' checked' : ''} aria-label="${esc(emoName(k))}: 원하는 것 후보"></td>
        <td><span class="res" id="rr-${k}"></span></td></tr>`;
    }).join('');
    return `<h3>대답 팔레트 <span class="small muted">주민이 대답에 쓰는 이모티콘 · 앞의 둘을 가장 많이 써요</span></h3>
      <div class="chiprow">${pal}</div>
      <div class="addrow"><select id="add-reply" aria-label="대답 팔레트에 더할 이모티콘"><option value="">— 이모티콘 고르기 —</option>${addable.map(e => `<option value="${e.key}">${esc(e.glyph)} ${esc(e.name)}</option>`).join('')}</select><button type="button" class="btn ghost tiny" data-add="emote/reply" data-from="add-reply">더하기</button></div>
      <h3>읽는 법 <span class="small muted">같은 이모티콘도 주민마다 다르게 읽어요 (${esc(E.id)})</span></h3>
      <div class="flagrow">${flags}</div>
      <div class="grid2"><label class="f">기쁠 때 몸짓${gsel('happy')}</label><label class="f">갸웃할 때 몸짓${gsel('puzzled')}</label></div>
      <h3>반응표 <span class="small muted">받은 이모티콘 → 대답 · 판정 · 친밀도 (${r.more ? '같은 것 셋' : '하나만'} 보냈을 때, 인사·기다리기는 한 뒤, 오늘 원하는 것은 빼고)</span></h3>
      <div class="react-wrap"><table class="react"><thead><tr><th>받은 이모티콘</th><th>반응</th><th>원하는 것 후보</th><th>대답 · 판정 · 친밀도</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const draftRules = () => ({ ...TK.talk, villagers: { [vsel]: cur().draft.emote } });
  const tryCtx = () => ({ dayKey: $('tryDay')?.value || todayKey(), weather: $('tryWeather')?.value ?? 'clear', slot: $('trySlot')?.value ?? 'afternoon', tier: $('tryTier')?.value || 'new' });
  function fillReact() {
    const rules = draftRules(), c = tryCtx(), E = cur().draft.emote;
    for (const { key: k } of TK.emo.player) {
      const cell = $(`rr-${k}`);
      if (!cell) continue;
      try {
        const x = TK.J.judge(rules, vsel, E.rule?.more ? [k, k, k] : [k], { dayKey: c.dayKey, weather: c.weather, want: null, greeted: true, waited: true, lastSaid: [] });
        cell.innerHTML = `${x.reply.map(t => svgOf(t, false)).join('')}<span class="kind">${esc(TK.J.KIND_NAME[x.kind])} · ${esc(gestureName(x.gesture))} · +${x.points}</span>`;
        cell.title = x.flags.map(f => FLAG_TEXT[f] ?? f).join(' · ');
      } catch { cell.textContent = '—'; }
      cell.closest('tr').className = E.likes.includes(k) ? 'like' : E.dislikes.includes(k) ? 'dislike' : 'none';
    }
  }
  /** 대사 묶음이 언제 나오나 */
  function whenOf(path) {
    const s = segs(path), top = s[0];
    let w = WHEN[top] ?? '';
    if (top === 'letters') w = LETTER_WHEN[s[1]] ?? w;
    if ((top === 'greet' || top === 'time') && SLOT_TIME[s[1]]) w += ` · ${TK.Tr.lineLabel(s[1])} ${SLOT_TIME[s[1]]}`;
    if (top === 'event' && s[1]) { const ev = T.events?.doc.list.find(e => e.id === s[1]); if (ev) w += ` · ${eventWhen(ev)}`; }
    if (top === 'request' && s[1]) w += ` · ${TK.Tr.lineLabel(s[1])}`;
    if (top === 'gift' && s[1]) w += ` · ${TK.Tr.lineLabel(s[1])}`;
    return w;
  }
  const linePreview = e => `↳ <b>${[e].flat().map(s => esc(TK.R.fill(s, SAMPLE))).join(' / ')}</b>`;
  function lineCard(e, i, on, attr) {
    const text = Array.isArray(e) ? e.join('\n') : e;
    return `<div class="lcard${on ? '' : ' off'}">${attr.toggle ? `<input type="checkbox" data-lon="${on ? 1 : 0}" data-i="${i}"${on ? ' checked' : ''} aria-label="${on ? '이 대사 끄기' : '이 대사 다시 켜기'}">` : '<span></span>'}
      <textarea rows="${Math.min(5, Math.max(1, text.split('\n').length))}" ${attr.data} data-i="${i}" aria-label="대사 ${i + 1}">${esc(text)}</textarea>
      <div class="pv">${linePreview(e)}</div></div>`;
  }
  const phButtons = () => `자리: ${Object.entries(TK.Tr.PLACEHOLDERS).map(([k, v]) => `<button type="button" class="btn link" data-ph="${k}" title="${esc(v)}">{${k}}</button>`).join(' ')} — <code>{item:을}</code> 처럼 쓰면 받침에 맞는 조사가 붙어요.`;
  function secLines() {
    const d = cur().draft;
    const pools = TK.Tr.linePools(d.lines).filter(p => !p.path.startsWith('letters/'));
    const off = new Map(TK.Tr.linePools(d.linesOff).map(p => [p.path, p.list]));
    if (!pools.some(p => p.path === tlpool)) tlpool = pools[0]?.path ?? null;
    const label = p => segs(p).map((k, i, a) => TK.Tr.lineLabel(k, a[i - 1])).join(' · ');
    const groups = [];
    for (const p of pools) {
      const top = segs(p.path)[0];
      let g = groups.find(x => x.top === top);
      if (!g) groups.push(g = { top, list: [] });
      g.list.push(p);
    }
    const sel = groups.map(g => `<optgroup label="${esc(TK.Tr.lineLabel(g.top))}">${g.list.map(p => `<option value="${esc(p.path)}"${p.path === tlpool ? ' selected' : ''}>${esc(label(p.path))} (${p.list.length}${off.get(p.path)?.length ? ` · 꺼 둠 ${off.get(p.path).length}` : ''})</option>`).join('')}</optgroup>`).join('');
    const list = getIn(d.lines, tlpool) ?? [], offList = off.get(tlpool) ?? [];
    const ends = d.traits.ending ? ` · 말끝 '${esc(d.traits.ending)}'` : '';
    return `<h3>글 대사 <span class="small muted">섬폰 '주민 글 대사 보기'를 켰을 때 나오는 말 · 지우지 않고 끄면 게임에서만 빠져요${ends} · 편지는 「편지」 탭</span></h3>
      <label class="f">대사 묶음<select id="linePool">${sel}</select></label>
      <p class="when">🕰 ${esc(whenOf(tlpool) || '—')}</p>
      <p class="small muted">한 칸 = 한 번에 하는 말이에요. 칸 안에서 줄을 바꾸면 이어서 차례로 나와요. ${phButtons()}</p>
      <div class="lines">${list.map((e, i) => lineCard(e, i, true, { toggle: true, data: 'data-lt="on"' })).join('')}${offList.length ? `<p class="small muted">꺼 둔 대사 ${offList.length}개 (체크하면 다시 켜져요)</p>` : ''}${offList.map((e, i) => lineCard(e, i, false, { toggle: true, data: 'data-lt="off"' })).join('')}</div>
      <div class="edit-only"><button type="button" class="btn ghost tiny" data-addline>줄 더하기</button></div>`;
  }
  function secHome() {
    const st = cur(), s = st.draft.schedule, ro = st.draft.roam, B = TK.B;
    const [m, dd] = st.bday ? st.bday.split('-').map(Number) : [0, 0];
    const newcomer = st.bday0 === null;
    const days = m ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] : 31;
    const pct = h => ((h - 5) / 24 * 100).toFixed(2);
    const ticks = [6, 9, 12, 15, 18, 21, 24, 27].map(h => `<span class="tick" style="left:${pct(h)}%"></span><span class="lbl" style="left:${pct(h)}%">${h % 24}</span>`).join('');
    const sleepMin = Math.min(29, s.wake + 4);
    return `<h3>생일 <span class="small muted">게임 숫자 표(<code>assets/data/rules.json</code>)와 같은 칸 — 생일 대사·편지가 이날 나와요</span></h3>
      <div class="grid2">
        <label class="f">달<select id="bdM">${newcomer ? `<option value="0"${m ? '' : ' selected'}>이사 온 날 (정하지 않음)</option>` : ''}${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === m ? ' selected' : ''}>${i + 1}월</option>`).join('')}</select></label>
        <label class="f">날<select id="bdD"${m ? '' : ' disabled'}>${Array.from({ length: days }, (_, i) => `<option value="${i + 1}"${i + 1 === dd ? ' selected' : ''}>${i + 1}일</option>`).join('')}</select></label>
      </div>
      <p class="small muted">${st.bday ? `${esc(B.birthdayLabel(st.bday))} — 그날은 하루 종일 집에서 파티, 선물 친밀도 ×${B.BIRTHDAY_GIFT_MULT}` : '섬에 이사 온 날이 생일이 돼요.'}</p>
      <h3>집에 있는 시간표 <span class="small muted">날마다 ±30분 흔들려요</span></h3>
      <div class="timebar" aria-hidden="true"><span class="band" style="left:${pct(s.wake)}%;width:${(pct(s.sleep) - pct(s.wake)).toFixed(2)}%"></span>${ticks}</div>
      <div class="sliders">${slider('schedule/wake', '나오는 시각', 5, 12, 0.5, s.wake, clockOf)}${slider('schedule/sleep', '들어가는 시각', sleepMin, 29, 0.5, Math.max(sleepMin, s.sleep), clockOf)}</div>
      <div class="chiprow"><label class="small"><input type="checkbox" data-f="schedule/rainStay"${s.rainStay ? ' checked' : ''}> 비 오면 집에</label>
        <label class="small"><input type="checkbox" data-f="schedule/snowStay"${s.snowStay ? ' checked' : ''}> 눈 오면 집에</label></div>
      <h3>자주 가는 곳 <span class="small muted">숫자가 클수록 자주 · 0 = 안 가요</span></h3>
      <div class="sliders">${slider('roam/range', '멀리 가는 한계', 4, 64, 1, ro.range, v => `${v}칸`)}</div>
      <div class="haunts">${Object.entries(TK.Tr.SPOTS).map(([k, n]) => `<label class="f">${esc(n)}<input type="number" min="0" max="9" step="1" value="${ro.haunts[k] ?? 0}" data-haunt="${k}"></label>`).join('')}</div>`;
  }

  /* ----- 대답 시험 (게임 판정 그대로, 3D 모델 없이) ----- */
  function tryBoxHTML() {
    return `<div class="box try"><div style="display:grid;gap:2px"><h3>대답 시험</h3><p class="small muted">고치는 값으로 바로 판정해요 (게임 판정 코드 <code>festival/judge.js</code> 그대로).</p></div>
      <div class="try-ctx">
        <label class="f">날짜<input type="date" id="tryDay"></label>
        <label class="f">날씨<select id="tryWeather"><option value="clear">맑음</option><option value="cloudy">흐림</option><option value="rain">비</option><option value="snow">눈</option><option value="rainbow">무지개</option></select></label>
        <label class="f">때<select id="trySlot"><option value="dawn">새벽</option><option value="morning">아침</option><option value="afternoon" selected>낮</option><option value="evening">저녁</option><option value="night">밤</option></select></label>
        <label class="f">친한 정도<select id="tryTier">${TK.R.TIERS.map(([id, min]) => `<option value="${id}">${esc(TK.Tr.lineLabel(id))} (${min}~)</option>`).join('')}</select></label>
      </div>
      <div class="want" id="tryWant"></div>
      <div class="tlog" id="tryLog" aria-live="polite"></div>
      <div class="tray" id="tray" aria-label="보낼 이모티콘 (세 개까지)"></div>
      <div class="actions"><button type="button" class="btn primary tiny" id="trySend">보내기</button><button type="button" class="btn ghost tiny" id="tryWait">⏳ 기다리기</button><button type="button" class="btn ghost tiny" id="tryReset">처음부터</button></div>
      <div class="emo-grid" id="emoGrid">${TK.emo.player.map(e => `<button type="button" class="emo-btn" data-k="${e.key}" title="${esc(e.name)}">${svgOf(e.key, false)}<span>${esc(e.name)}</span></button>`).join('')}</div>
      <label class="f">선물 시험<select id="tryGift">${ruleOptions('item')}</select></label><div id="tryGiftOut" class="small"></div>
      <div class="actions"><button type="button" class="btn ghost tiny" id="tryGreet">글 대사로 말 걸어 보기</button></div>
      <div id="tryText"></div></div>`;
  }
  function renderTry(reset) {
    if (!$('tryDay')) return;
    if (!$('tryDay').value) $('tryDay').value = todayKey();
    if (reset || !tryS) {
      tryS = { log: [], tray: [], greeted: false, waited: false, lastSaid: [], v: {}, wantDone: false };
      const c = tryCtx(), g = TK.J.greetOf(draftRules(), vsel, { slot: c.slot, weather: c.weather, tier: c.tier });
      tryS.log.push({ who: 'them', keys: g, note: '인사' });
      tryS.lastSaid = g;
    }
    drawTry();
  }
  function drawWant() {
    if (!$('tryWant') || !cur().draft.emote) return;
    const c = tryCtx(), w = TK.J.wantOf(cur().draft.emote, vsel, c.dayKey);
    $('tryWant').innerHTML = w ? `<span class="emo-chip">${svgOf(w)}</span><span>${esc(c.dayKey)} 에 원하는 것: <b>${esc(emoName(w))}</b>${tryS?.wantDone ? ' (들어줬어요)' : ''}</span>` : '<span class="muted">원하는 것 후보가 없어요</span>';
  }
  function drawTry() {
    if (!$('tryLog')) return;
    drawWant();
    const name = cur().draft.name;
    $('tryLog').innerHTML = tryS.log.map(m => {
      if (m.who === 'err') return `<p class="small" style="color:var(--warn)">${esc(m.text)}</p>`;
      const bub = `<div class="bub">${m.keys.map(k => svgOf(k)).join('')}</div>`;
      if (m.who === 'me') return `<div class="say me">${bub}<span class="meta">나</span></div>`;
      const r = m.res;
      const meta = r ? `<b>${esc(TK.J.KIND_NAME[r.kind])}</b> · 친밀도 +${m.pts}${m.pts < r.points ? ' (오늘은 세 번 다 올랐어요)' : ''} · 몸짓 ${esc(gestureName(r.gesture))}${r.flags.length ? ` · ${r.flags.map(f => esc(FLAG_TEXT[f] ?? f)).join(', ')}` : ''}` : esc(m.note ?? '');
      return `<div class="say">${bub}<span class="meta">${esc(name)} — ${meta}</span></div>`;
    }).join('');
    $('tryLog').scrollTop = $('tryLog').scrollHeight;
    $('tray').innerHTML = [0, 1, 2].map(i => { const k = tryS.tray[i]; return `<button type="button" class="slot${k ? ' full' : ''}" data-slot="${i}" aria-label="${k ? `${esc(emoName(k))} 빼기` : '빈 칸'}">${k ? svgOf(k, false) : ''}</button>`; }).join('')
      + `<span class="small muted">${tryS.tray.length ? `${tryS.tray.length}/3` : '아래에서 골라 담아요 (세 개까지)'}</span>`;
  }
  function trySend(keys) {
    const c = tryCtx(), rules = draftRules();
    const want = TK.J.wantOf(cur().draft.emote, vsel, c.dayKey);
    tryS.log.push({ who: 'me', keys: TK.J.normalize(keys) });
    let res;
    try { res = TK.J.judge(rules, vsel, keys, { dayKey: c.dayKey, weather: c.weather, want: tryS.wantDone ? null : want, greeted: tryS.greeted, waited: tryS.waited, lastSaid: tryS.lastSaid }); }
    catch { tryS.log.push({ who: 'err', text: '판정할 수 없어요. 「고칠 것」을 먼저 봐 주세요.' }); tryS.tray = []; drawTry(); return; }
    tryS.greeted = res.greeted; tryS.waited = res.waited;
    const pts = TK.J.countPoints(rules, tryS.v, c.dayKey, res.points);
    if (res.matchedWant && (res.kind === 'delight' || res.kind === 'happy')) tryS.wantDone = true;
    tryS.lastSaid = res.reply;
    tryS.log.push({ who: 'them', keys: res.reply, res, pts });
    tryS.tray = [];
    drawTry();
  }

  /* ================= 편지 탭 ================= */
  function renderLetters() {
    const host = $('pane-letters');
    if (!host) return;
    const kinds = LETTER_ORDER.filter(k => TK.order.some(s => vs(s).draft.lines.letters?.[k]));
    if (![...kinds, 'guide'].includes(lsel)) lsel = kinds[0];
    const who = lsel === 'guide' ? ['bamtol'] : TK.order.filter(s => vs(s).draft.lines.letters?.[lsel]);
    const cnt = k => TK.order.reduce((n, s) => n + (vs(s).draft.lines.letters?.[k]?.length ?? 0), 0);
    const body = lsel === 'guide' ? guideHTML() : who.map(slug => {
      const st = vs(slug), list = st.draft.lines.letters[lsel];
      return `<div class="lgroup"><div class="lwho"><img src="${thumb(slug)}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(st.draft.name)}</b>
          <span class="small muted">${esc(st.draft.traits?.ending ? `말끝 '${st.draft.traits.ending}'` : '')}</span>${vDirty(st) || st.note ? '<span class="chip changed">바뀜</span>' : ''}</div>
        <div class="lines">${list.map((e, i) => lineCard(e, i, true, { data: `data-letter="${slug}" data-path="lines/letters/${lsel}"` })).join('')}</div>
        <div class="edit-only"><button type="button" class="btn ghost tiny" data-addletter="${slug}">+ 편지 한 통</button></div></div>`;
    }).join('');
    host.innerHTML = `<div class="box" style="gap:14px">
      <div class="board-head"><h2>편지</h2><span class="small muted">우편함에 오는 편지와 밤톨 안내 글. 편지 한 통 = 한 칸, 칸 안의 줄 = 편지의 줄 (끝 줄에 서명).</span></div>
      <div class="subtabs" id="letterKinds">${kinds.map(k => `<button type="button" data-lk="${k}" aria-pressed="${k === lsel}">${esc(LETTER_NAME[k] ?? k)}<span class="n">${cnt(k)}</span></button>`).join('')}
        <button type="button" data-lk="guide" aria-pressed="${lsel === 'guide'}">${LETTER_NAME.guide}</button></div>
      <p class="when">🕰 ${esc(lsel === 'guide' ? '밤톨이 첫날·가게에서 하는 안내 — 묶음마다 아래에' : LETTER_WHEN[lsel] ?? '')}</p>
      <p class="small muted">${phButtons()}</p>
      ${body}
      <p class="small muted">편지마다의 의견은 「주민」 탭에서 그 주민을 고르고 의견 칸에 적어 주세요 (같은 초안에 들어가요).</p></div>`;
  }
  function guideHTML() {
    const st = vs('bamtol'), L = st.draft.lines;
    return GUIDE_POOLS.filter(k => L[k]).map(k => {
      const pools = Array.isArray(L[k]) ? [{ path: k, list: L[k] }] : TK.Tr.linePools(L[k], k);
      return pools.map(p => `<div class="lgroup"><div class="lwho"><b>${esc(segs(p.path).map((x, i, a) => TK.Tr.lineLabel(x, a[i - 1])).join(' · '))}</b><span class="small muted">${esc(WHEN[k] ?? '')}</span></div>
        <div class="lines">${p.list.map((e, i) => lineCard(e, i, true, { data: `data-letter="bamtol" data-path="lines/${p.path}"` })).join('')}</div></div>`).join('');
    }).join('');
  }

  /* ================= 그 밖의 글 탭 ================= */
  let tsel = 'night';
  function eventWhen(ev) {
    const h = ev.hours ? `${hourOf(ev.hours[0])}–${hourOf(ev.hours[1])}` : '';
    return `${ev.start.month}월 ${ev.start.day}일부터 ${T.events.doc.dates?.days ?? 7}일 ${h} · ${ev.place === 'anywhere' ? '섬 어디서나' : ev.place}`;
  }
  const NIGHT_WHEN = n => ({
    market: `야시장 — 매주 토요일 ${hourOf(n.market.hours[0])}–${hourOf(n.market.hours[1])} 광장 (행사 날 쉼)`,
    shop: `달빛 가게 (별밤) — ${hourOf(n.shop.hours[0])}–${hourOf(n.shop.hours[1])}`,
    tent: `새벽 천막 (여명) — ${hourOf(n.tent.hours[0])}–${hourOf(n.tent.hours[1])} 동쪽 숲`,
    tarot: '새벽 천막에서 하루 한 장 (그날 효과)',
    'lines/byeolbam': `달빛 가게 주인 별밤 — ${hourOf(n.shop.hours[0])}–${hourOf(n.shop.hours[1])}`,
    'lines/yeomyeong': `새벽 천막 주인 여명 — ${hourOf(n.tent.hours[0])}–${hourOf(n.tent.hours[1])}`,
    'lines/market': '야시장 알림 · 고리 던지기',
    'lines/nocturnal': `야행성 주민 집 — ${hourOf(n.nocturnal.houseOpen[0])}–${hourOf(n.nocturnal.houseOpen[1])}만 열림`,
    ...(n.fortune ? { fortune: `운세 부스 (여명) — ${hourOf(n.fortune.hours[0])}–${hourOf(n.fortune.hours[1])} 광장 남서쪽 (P54)` } : {}),
    ...(n.fox ? { fox: `여우 상인 가게 (살랑) — 오는 밤 ${hourOf(n.fox.hours[0])}–${hourOf(n.fox.hours[1])} (P54)`, 'lines/salang': `여우 상인 살랑의 말 — 오는 밤 ${hourOf(n.fox.hours[0])}부터`, 'lines/fox': '여우 상인이 온 밤 알림' } : {}),
    ...(n.odd ? { odd: `이상한 천막 — 오는 밤 ${hourOf(n.odd.hours[0])}–${hourOf(n.odd.hours[1])}, 주인 없음 (P54)`, 'lines/odd': '이상한 천막 알림 · 닫힌 때' } : {}),
    ...(n.gift ? { gift: '선물 상자 — 날마다 섬 어딘가 풀밭 (P54)', 'lines/gift': '선물 상자 열 때' } : {}),
  });
  /** 그 밖의 글 묶음 제목 (밤 · 섬 일상) */
  const GROUP_LABEL = { market: '🏮 야시장', shop: '🌙 달빛 가게', tent: '⛺ 새벽 천막', tarot: '🔮 타로 카드', 'lines/byeolbam': '별밤의 말', 'lines/yeomyeong': '여명의 말', 'lines/market': '야시장 알림', 'lines/nocturnal': '야행성 주민',
    fortune: '🔮 운세 부스', fox: '🦊 여우 상인 가게', 'lines/salang': '살랑(여우 상인)의 말', 'lines/fox': '여우 상인 알림', odd: '🎪 이상한 천막', 'lines/odd': '이상한 천막 알림', gift: '🎁 선물 상자', 'lines/gift': '선물 상자 열 때',
    meteor: '🌠 유성우', balloons: '🎈 선물 풍선', bottle: '🍾 유리병', recipes: '📜 레시피 쪽지', peddler: '🛒 행상 송이' };
  /** 섬 일상 (daily.json): 묶음 → 언제 */
  const DAILY_WHEN = d => ({
    meteor: `유성우 — 맑은 밤 ${hourOf(d.meteor?.hours?.[0] ?? 20)}–${hourOf(d.meteor?.hours?.[1] ?? 28)} (올려다보고 소원)`,
    balloons: `선물 풍선 — 낮 ${hourOf(d.balloons?.hours?.[0] ?? 9)}–${hourOf(d.balloons?.hours?.[1] ?? 18)}, 하루 ${d.balloons?.perDay ?? 3}번 (새총으로)`,
    bottle: '유리병 — 날마다 아침 바닷가',
    recipes: '레시피 쪽지 펼칠 때',
    peddler: `떠돌이 행상 송이 — ${(d.peddler?.weekdays ?? []).map(w => '일월화수목금토'[w]).join('·')}요일 ${hourOf(d.peddler?.hours?.[0] ?? 9)}–${hourOf(d.peddler?.hours?.[1] ?? 17)} 광장`,
  });
  /** 묶음(앞 칸)마다 글 칸을 모으고, 어느 묶음에도 안 든 칸은 「그 밖」으로 (새 칸이 생겨도 숨지 않게) */
  function groupedTexts(t, W) {
    const leaves = textLeaves(t.draft), used = new Set();
    const groups = Object.keys(W).map(g => { const paths = leaves.filter(p => (p === g || p.startsWith(`${g}/`)) && !used.has(p)); paths.forEach(p => used.add(p)); return { g, label: GROUP_LABEL[g] ?? leafLabel(g), when: W[g], paths }; }).filter(x => x.paths.length);
    const rest = leaves.filter(p => !used.has(p));
    if (rest.length) groups.push({ g: '', label: '그 밖', when: '위 묶음에 들지 않은 글', paths: rest });
    return groups.map(({ label, when, paths }) => `<div class="lgroup"><div class="lwho"><b>${esc(label)}</b><span class="when">🕰 ${esc(when)}</span></div><div class="txgrid">${textFields(t, paths)}</div></div>`).join('');
  }
  const leafLabel = p => segs(p).map((k, i, a) => (/^\d+$/.test(k) ? `${+k + 1}` : KEY_LABEL[k] ?? TK.Tr.LINE_LABELS[k] ?? k)).join(' › ');
  function textFields(t, paths) {
    return paths.map(p => {
      const v = getIn(t.draft, p), changed = v !== getIn(t.doc, p);
      const field = v.length > 28 ? `<textarea rows="2" data-tx="${t.id}" data-path="${esc(p)}">${esc(v)}</textarea>` : `<input type="text" data-tx="${t.id}" data-path="${esc(p)}" value="${esc(v)}">`;
      return `<label class="f tx${changed ? ' changed' : ''}">${esc(leafLabel(p))} <code>${esc(p)}</code>${field}</label>`;
    }).join('');
  }
  function renderTexts() {
    const host = $('pane-texts');
    if (!host) return;
    const t = T[tsel];
    let body = '';
    if (tsel === 'night') {
      const n = t.draft, W = NIGHT_WHEN(n);
      body = `<p class="small muted">밤은 둘째 날부터 열려요 (opensAfterDay ${n.opensAfterDay}). 말 안의 <code>{cost}</code> <code>{n}</code> <code>{hits}</code> <code>{prize}</code> 는 게임이 채워요.</p>`
        + groupedTexts(t, W);
    } else if (tsel === 'events') {
      const E = t.draft;
      body = `<div class="lgroup"><div class="lwho"><b>행사 전</b><span class="when">🕰 엔딩(섬 축제) 전에 행사 날이 오면</span></div><div class="txgrid">${textFields(t, ['open/beforeLine'])}</div></div>`
        + E.list.map((ev, i) => {
          const vill = TK.order.filter(s => vs(s).draft.lines.event?.[ev.id]);
          return `<div class="lgroup"><div class="lwho"><span class="emo">${esc(ev.emoji)}</span><b>${esc(ev.id)} ${esc(ev.name)}</b><span class="when">🕰 ${esc(eventWhen(ev))} · 맡은 주민 ${esc(vs(ev.host)?.draft.name ?? ev.host)} · 장면 ${esc(ev.scene)}</span></div>
            <div class="txgrid">${textFields(t, textLeaves(ev, `list/${i}`))}</div>
            <details><summary class="small">행사 기간 주민 대사 (${vill.length}명) — 주민 파일 <code>lines/event/${esc(ev.id)}</code></summary>
              ${vill.map(slug => `<div class="lwho"><img src="${thumb(slug)}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(vs(slug).draft.name)}</b></div>
              <div class="lines">${vs(slug).draft.lines.event[ev.id].map((e, k) => lineCard(e, k, true, { data: `data-letter="${slug}" data-path="lines/event/${ev.id}"` })).join('')}</div>`).join('')}</details></div>`;
        }).join('');
    } else if (tsel === 'daily') {
      const d = t.draft;
      body = `<p class="small muted">섬 일상은 게임을 시작하고 ${d.opensAfterDay ?? 1}일째부터 (M13). 말 안의 <code>{name}</code> <code>{n}</code> 는 게임이 채워요. 행상 송이의 이름·말도 여기서.</p>`
        + groupedTexts(t, DAILY_WHEN(d));
    } else {
      const o = t.draft;
      body = `<div class="lgroup"><div class="lwho"><b>무인도 투어</b><span class="when">🕰 선착장 끝 배 — 표 ${o.ticket?.price ?? 1000} 도토리 (첫 여행 무료), 하루 ${o.ticket?.perDay ?? 1}번, ${o.returnHour ?? 5}시에 저절로 돌아옴 · 손님 주민은 ${o.guest?.every ?? 5}번째 여행마다</span></div>
        <p class="small">투어의 글(배 안내 · 여행 묻기 창 · 돌아올 때 말)은 아직 데이터가 아니라 게임 코드 <code>src/gameplay/tour/index.js</code> 안에 있어요. 바꾸고 싶은 말을 아래 의견에 적어 주시면 "스토리 반영" 때 Claude 가 코드에서 고치거나 이 파일로 옮겨요.</p></div>`;
    }
    host.innerHTML = `<div class="box" style="gap:14px">
      <div class="board-head"><h2>그 밖의 글</h2><span class="small muted">밤·새벽(밤 특별 상점·선물 상자 포함) · 계절 행사 · 투어 · 섬 일상(유성우·풍선·유리병·행상)에 들어간 말과 이름. 숫자·때는 「요소」 편집기에서 고쳐요 — 여기서는 글만.</span></div>
      <div class="subtabs" id="textKinds">${Object.keys(T).map(k => `<button type="button" data-tk2="${k}" aria-pressed="${k === tsel}">${esc(TEXT_TITLE[k])}<span class="n">${Object.keys(tChanges(T[k])).length || ''}</span></button>`).join('')}</div>
      <p class="small muted mono">${esc(t.file)} · v${t.doc.version ?? 0}</p>
      ${body}${footHTML('t')}</div>`;
    refreshTMeta();
  }
  function refreshTMeta() {
    const t = T[tsel];
    if (!$('tChgList')) return;
    const ch = tChanges(t), keys = Object.keys(ch);
    $('tChgN').textContent = keys.length ? `${keys.length}칸` : '';
    $('tChgList').innerHTML = keys.map(p => `<li>${esc(leafLabel(p))}: ${esc(short(getIn(t.doc, p)))} → <b>${esc(short(ch[p]))}</b> <code>${esc(p)}</code></li>`).join('') || '<li class="muted" style="list-style:none;margin-left:-18px">아직 없어요.</li>';
    const probs = tProblems(t);
    $('tProbBox').hidden = !probs.length;
    $('tProbList').innerHTML = probs.map(b => `<li>${esc(b.path)} — ${esc(b.why)}</li>`).join('');
    const n = document.querySelector(`#textKinds [data-tk2="${tsel}"] .n`);
    if (n) n.textContent = keys.length || '';
  }

  /* ================= 고치기 (세 탭을 한 곳에서) ================= */
  /** 칸 글 → 대사 한 칸 (편지는 늘 여러 줄 배열, 그 밖은 한 줄이면 글자 — 예전 「성격·대화」 탭과 같다) */
  function lineEntry(orig, value, letter = false) {
    const parts = value.split('\n').map(s => s.trim()).filter(Boolean);
    return letter && Array.isArray(orig) ? parts : parts.length > 1 ? parts : parts[0] ?? '';
  }
  function onInput(e) {
    const t = e.target;
    if (!writable() || !TK) return;
    if (t.id === 'vNote') { cur().note = t.value; saveV(cur()); refreshVMeta(); return; }
    if (t.id === 'tNote') { T[tsel].note = t.value; saveT(T[tsel]); return; }
    if (t.dataset.tx) {
      const tt = T[t.dataset.tx];
      setIn(tt.draft, t.dataset.path, t.value);
      t.closest('label')?.classList.toggle('changed', t.value !== getIn(tt.doc, t.dataset.path));
      saveT(tt); refreshTMeta(); return;
    }
    if (t.dataset.letter) {
      const st = vs(t.dataset.letter), list = getIn(st.draft, t.dataset.path), i = +t.dataset.i;
      list[i] = lineEntry(list[i], t.value, t.dataset.path.startsWith('lines/letters/'));
      t.parentElement.querySelector('.pv').innerHTML = linePreview(list[i]);
      saveV(st); if (st === cur()) refreshVMeta(); return;
    }
    const st = cur(), d = st.draft;
    if (t.dataset.f && t.type !== 'checkbox' && t.tagName !== 'SELECT') {
      const v = t.dataset.type === 'num' ? +t.value : t.dataset.type === 'color' ? t.value.toUpperCase() : t.value;
      setIn(d, t.dataset.f, v);
      const out = t.closest('.slider')?.querySelector('output');
      if (out) out.textContent = t.dataset.f.startsWith('schedule/') ? clockOf(v) : t.dataset.f === 'roam/range' ? `${v}칸` : v;
      if (t.dataset.type === 'color') t.parentElement.querySelector('code').textContent = v;
      if (t.dataset.f.startsWith('schedule/')) {
        const bar = document.querySelector('.timebar .band'), s = d.schedule, pct = h => (h - 5) / 24 * 100;
        if (bar) { bar.style.left = `${pct(s.wake)}%`; bar.style.width = `${pct(s.sleep) - pct(s.wake)}%`; }
      }
      touchV(false);
    } else if (t.dataset.lt) {
      const base = t.dataset.lt === 'on' ? d.lines : d.linesOff, list = getIn(base, tlpool), i = +t.dataset.i;
      list[i] = lineEntry(list[i], t.value);
      t.parentElement.querySelector('.pv').innerHTML = linePreview(list[i]);
      touchV(false);
    } else if (t.dataset.row && t.dataset.k === 'w') {
      getIn(d, t.dataset.row)[+t.dataset.i].w = Math.max(1, Math.min(20, Math.round(+t.value || 1)));
      touchV(false);
    } else if (t.dataset.haunt) {
      const n = Math.max(0, Math.min(9, Math.round(+t.value || 0)));
      if (n) d.roam.haunts[t.dataset.haunt] = n; else delete d.roam.haunts[t.dataset.haunt];
      touchV(false);
    } else if (t.dataset.rulenum) {
      d.emote.rule[t.dataset.rulenum] = Math.max(1, Math.min(3, Math.round(+t.value || 1)));
      touchV(false);
    }
  }
  function onChangeEv(e) {
    const t = e.target;
    if (!TK) return;
    if (['tryDay', 'tryWeather', 'trySlot', 'tryTier'].includes(t.id)) { renderTry(true); if (tsub === 'emote') fillReact(); return; }
    if (t.id === 'tryGift') { giftTry(); return; }
    if (t.id === 'linePool') { tlpool = t.value; touchV(true); return; }
    if (!writable()) return;
    const st = cur(), d = st.draft;
    if (t.dataset.f && (t.type === 'checkbox' || t.tagName === 'SELECT')) { setIn(d, t.dataset.f, t.type === 'checkbox' ? t.checked : t.value); touchV(false); }
    else if (t.dataset.f === 'schedule/wake') touchV(true);
    else if (t.dataset.row && t.dataset.k === 'what') {
      const row = getIn(d, t.dataset.row)[+t.dataset.i];
      if (t.dataset.row === 'requests/wants') { const [k, v] = t.value.split(/:(.*)/); delete row.cat; delete row.id; row[k === 'cat' ? 'cat' : 'id'] = v; const w = row.w; delete row.w; row.w = w; }
      else row.id = t.value;
      touchV(false);
    } else if (t.dataset.react) {
      const k = t.dataset.react, E = d.emote;
      E.likes = E.likes.filter(x => x !== k); E.dislikes = E.dislikes.filter(x => x !== k);
      if (t.value === 'like') E.likes.push(k); else if (t.value === 'dislike') E.dislikes.push(k);
      touchV(false);
    } else if (t.dataset.want) {
      const k = t.dataset.want, E = d.emote;
      E.wants = t.checked ? [...E.wants, k] : E.wants.filter(x => x !== k);
      touchV(false);
    } else if (t.dataset.rule) {
      const f = TK.Tr.RULE_FLAGS.find(x => x.key === t.dataset.rule), r = (d.emote.rule ??= {});
      if (t.checked) r[f.key] = f.keys ? ['wave'] : f.num === f.key ? 1 : true;
      else delete r[f.key];
      if (f.num && f.num !== f.key) { if (t.checked) r[f.num] ??= 2; else delete r[f.num]; }
      touchV(true);
    } else if (t.dataset.lon) {
      const i = +t.dataset.i, from = t.dataset.lon === '1' ? 'lines' : 'linesOff', to = from === 'lines' ? 'linesOff' : 'lines';
      const list = getIn(d[from], tlpool), [entry] = list.splice(i, 1);
      if (!getIn(d[to], tlpool)) setIn(d[to], tlpool, []);
      getIn(d[to], tlpool).push(entry);
      if (from === 'linesOff') pruneIn(d.linesOff, tlpool);
      touchV(true);
    } else if (t.id === 'bdM' || t.id === 'bdD') {
      const m = +$('bdM').value, dd = +$('bdD').value || 1;
      st.bday = m ? TK.B.mmdd(m, Math.min(dd, [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])) : null;
      touchV(true);
    }
  }
  function giftTry() {
    const it = TK.I.get($('tryGift').value), d = cur().draft;
    if (!it) { $('tryGiftOut').textContent = ''; return; }
    try {
      const reaction = TK.R.giftReaction(TK.Tr.toPerson(d), it), pool = d.lines.gift?.[reaction] ?? [];
      const line = pool.length ? [pool[Math.floor(Math.random() * pool.length)]].flat().map(s => TK.R.fill(s, { ...SAMPLE, item: it.name })).join(' ') : '';
      $('tryGiftOut').innerHTML = `<b>${esc(REACT_LABEL[reaction])}</b> · 친밀도 +${TK.R.GIFT_POINTS[reaction]} (생일이면 ×${TK.B.BIRTHDAY_GIFT_MULT})${line ? ` — “${esc(line)}”` : ''}`;
    } catch { $('tryGiftOut').textContent = '지금 값으로는 선물 반응을 알 수 없어요.'; }
  }
  function copyOut(kind) {
    const ta = $(`${kind}Out`);
    ta.value = kind === 'v' ? vText(cur()) : tText(T[tsel]);
    $(`${kind}OutWrap`).hidden = false;
    try { navigator.clipboard.writeText(ta.value).then(() => { $(`${kind}Msg`).textContent = '복사했어요. 채팅에 붙여넣어 주세요.'; }, () => ta.select()); } catch { ta.select(); }
  }
  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || !TK) return;
    if (b.dataset.v) { vsel = b.dataset.v; tlpool = null; tryS = null; renderVill(); try { localStorage.setItem('story-editor-villager', vsel); } catch {} return; }
    if (b.dataset.sub) { tsub = b.dataset.sub; renderVill(); return; }
    if (b.dataset.lk) { lsel = b.dataset.lk; renderLetters(); return; }
    if (b.dataset.tk2) { tsel = b.dataset.tk2; renderTexts(); return; }
    if (b.id === 'vCopy' || b.id === 'tCopy') { copyOut(b.id[0]); return; }
    if (b.dataset.k && tryS && tryS.tray.length < 3 && b.closest('#emoGrid')) { tryS.tray.push(b.dataset.k); drawTry(); return; }
    if (b.dataset.slot && tryS) { tryS.tray.splice(+b.dataset.slot, 1); drawTry(); return; }
    if (b.id === 'trySend') { if (tryS?.tray.length) trySend(tryS.tray); return; }
    if (b.id === 'tryWait') { if (tryS) trySend([]); return; }
    if (b.id === 'tryReset') { renderTry(true); return; }
    if (b.id === 'tryGreet') {
      const c = tryCtx(), d = cur().draft;
      const lines = TK.R.greetingLines(d.lines, { now: { hourF: SLOT_HOUR[c.slot], dayKey: c.dayKey }, weather: c.weather, season: seasonOf(c.dayKey), tier: c.tier, r: TK.R.rngOf(String(Date.now())), recent: [] });
      $('tryText').innerHTML = lines.length ? `<div class="say"><div class="text">${lines.map(l => esc(TK.R.fill(l, SAMPLE))).join('<br>')}</div><span class="meta">${esc(d.name)} · 예시 이름 ${SAMPLE.player} · ${SAMPLE.island}</span></div>` : '<p class="small muted">이 때에 맞는 인사 대사가 없어요.</p>';
      return;
    }
    if (b.dataset.ph && lastText) {
      const ta = lastText, at = ta.selectionStart ?? ta.value.length, ins = `{${b.dataset.ph}}`;
      ta.value = ta.value.slice(0, at) + ins + ta.value.slice(ta.selectionEnd ?? at);
      ta.focus(); ta.selectionStart = ta.selectionEnd = at + ins.length;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (!writable()) return;
    if (b.id === 'vReset') { const st = cur(); if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 처음 값으로'; return; } st.draft = clone(st.doc); st.bday = st.bday0; st.note = ''; saveV(st); renderVill(); return; }
    if (b.id === 'tReset') { const t = T[tsel]; if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 처음 값으로'; return; } t.draft = clone(t.doc); t.note = ''; saveT(t); renderTexts(); return; }
    if (b.dataset.addletter) { const st = vs(b.dataset.addletter); st.draft.lines.letters[lsel].push(lsel === 'gift' ? '' : ['', `— ${st.draft.name}`]); saveV(st); renderLetters(); return; }
    const d = cur().draft;
    if (b.dataset.rm) { getIn(d, b.dataset.rm).splice(+b.dataset.i, 1); touchV(true); }
    else if (b.dataset.mv) {
      const list = getIn(d, b.dataset.mv), i = +b.dataset.i, j = i + +b.dataset.d;
      if (j >= 0 && j < list.length) { [list[i], list[j]] = [list[j], list[i]]; touchV(true); }
    } else if (b.dataset.add) {
      const v = $(b.dataset.from).value, list = getIn(d, b.dataset.add);
      if (v && !list.includes(v)) { list.push(v); touchV(true); }
    } else if (b.dataset.addrow) {
      getIn(d, b.dataset.addrow).push(b.dataset.addrow === 'requests/wants' ? { cat: 'fish', w: 1 } : { id: 'mat.acorn-bag', w: 1 });
      touchV(true);
    } else if (b.dataset.greet) {
      const r = d.emote.rule, k = b.dataset.greet;
      r.greetFirst = r.greetFirst.includes(k) ? r.greetFirst.filter(x => x !== k) : [...r.greetFirst, k];
      touchV(true);
    } else if (b.hasAttribute('data-addline')) {
      getIn(d.lines, tlpool).push('');
      touchV(true);
      const all = document.querySelectorAll('textarea[data-lt="on"]');
      all[all.length - 1]?.focus();
    }
  }

  function renderAll() { renderVill(); renderLetters(); renderTexts(); }
  function bind(root) {
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChangeEv);
    root.addEventListener('click', onClick);
    root.addEventListener('focusin', e => { if (e.target.matches?.('textarea[data-lt], textarea[data-letter]')) lastText = e.target; });
  }
  return {
    async start(root) {
      try { const s = localStorage.getItem('story-editor-villager'); if (s) vsel = s; } catch {}
      await load();
      bind(root);
      renderAll();
    },
    select(slug) { if (TK?.docs.has(slug)) { vsel = slug; renderVill(); } },
    fromStore, changes, renderAll,
    get ready() { return !!TK; },
  };
}
