// 첫날 흐름 규칙 (DOM·three 없음, node 로 확인): 이름 다듬기·확인, 대사의 이름 자리 채우기,
// 첫날 할 일 단계·진행 기록·예전 저장에서 한 것 추정·안내 문구.
// 상태 칸: 플레이어 이름 = state.player.name, 섬 이름 = state.island.name ('…섬' 까지), 진행 = state.flags.firstday.

export const NAME_MAX = 8;          // 플레이어 이름 글자 수
export const ISLAND_MAX = 6;        // 섬 이름 글자 수 ('섬' 앞까지)
export const ISLAND_SUFFIX = '섬';
/** 이름을 아직 안 정했을 때 대사에 쓰는 값 */
export const DEFAULT_NAMES = { player: '친구', island: '포근섬' };
/** 다 마치면 밤톨이 주는 선물: 가구 하나 + 도토리 */
export const REWARD = { item: 'furn.radio', acorns: 1000 };

/** 첫날 할 일. target = 화살표가 가리킬 곳 (index.js 가 자리를 찾는다) */
export const STEPS = [
  { id: 'intro', label: '밤톨 이야기 듣기', icon: '🐿️', target: 'bamtol' },
  { id: 'tool', label: '도구 들어 보기', icon: '🎣' },
  { id: 'gather', label: '나무 흔들기나 줍기', icon: '🌳' },
  { id: 'catch', label: '물고기나 곤충 잡기', icon: '🐟' },
  { id: 'sell', label: '밤톨 상점에서 팔기', icon: '🌰', target: 'shop' },
  { id: 'donate', label: '느루에게 기증하기', icon: '🏛️', target: 'museum' },
  { id: 'home', label: '내 집에 들어가 보기', icon: '🏠', target: 'home' },
];
export const STEP_IDS = STEPS.map(s => s.id);
export const stepOf = id => STEPS.find(s => s.id === id) ?? null;

// ---------- 조사 ----------

// 숫자로 끝나는 이름의 받침 (영 일 이 삼 사 오 육 칠 팔 구)
const DIGIT_BATCHIM = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];
/** 마지막 글자 받침 번호: 0 = 없음, -1 = 모름(영어 등) */
export function batchim(word) {
  const ch = String(word ?? '').trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) return code % 28;
  if (ch >= '0' && ch <= '9') return DIGIT_BATCHIM[ch];
  return -1;
}

const PAIRS = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 와: ['과', '와'], 과: ['과', '와'],
  이랑: ['이랑', '랑'], 랑: ['이랑', '랑'], 아: ['아', '야'], 야: ['아', '야'], 으로: ['으로', '로'], 로: ['으로', '로'], 이에요: ['이에요', '예요'], 예요: ['이에요', '예요'] };

/** 받침에 맞춰 조사 붙이기 (town/rules.js 의 josa 와 같은 규칙 + 숫자 이름) */
export function josa(word, kind) {
  const w = String(word ?? '');
  const has = batchim(w);
  const p = PAIRS[kind];
  if (!p) return w + (kind.length > 1 && kind[0] === '이' && has <= 0 ? kind.slice(1) : kind);   // '이다'·'이야' → 받침 없으면 '이'를 뺀다
  if (has < 0) return w + p[1];
  if (p[0] === '으로') return w + (has && has !== 8 ? '으로' : '로');   // ㄹ 받침은 '로'
  return w + (has ? p[0] : p[1]);
}

/** 정한 이름들 (안 정했으면 기본값) */
export function namesOf(state) {
  return {
    player: state?.player?.name || DEFAULT_NAMES.player,
    island: state?.island?.name || DEFAULT_NAMES.island,
  };
}

/** '{player:아}'·'{island:에}' 같은 자리 채우기. 다른 자리({item} 등)는 그대로 둔다 */
export const fillNames = (text, names) => String(text ?? '').replace(/\{(player|island)(?::([^{}\s]+?))?\}/g, (m, k, j) => {
  const v = names?.[k];
  if (v == null || v === '') return m;
  return j ? josa(v, j) : String(v);
});

// ---------- 이름 정하기 ----------

const ALLOWED = /^[가-힣A-Za-z0-9 ]+$/;
const JAMO = /[ㄱ-ㅎㅏ-ㅣ]/;
export const countChars = s => Array.from(String(s ?? '')).length;
/** 앞뒤 빈칸 빼고, 빈칸 여러 개는 하나로 */
export const tidy = raw => String(raw ?? '').replace(/\s+/g, ' ').trim();

function checkWord(v, max, empty) {
  if (!v) return empty;
  if (JAMO.test(v)) return '글자를 끝까지 완성해 주세요';
  if (!ALLOWED.test(v)) return '한글·영어·숫자만 쓸 수 있어요';
  if (countChars(v) > max) return `${max}글자까지 쓸 수 있어요`;
  return null;
}

/** 플레이어 이름 → { ok, value, error } */
export function checkPlayerName(raw) {
  const value = tidy(raw);
  const error = checkWord(value, NAME_MAX, '이름을 적어 주세요');
  return { ok: !error, value, error };
}

/** 섬 이름 → { ok, base, value: base + '섬', error }. 끝에 '섬'을 붙여 적었으면 하나만 남긴다 */
export function checkIslandName(raw) {
  let base = tidy(raw);
  if (base.length > 1 && base.endsWith(ISLAND_SUFFIX)) base = base.slice(0, -1).trim();
  const error = checkWord(base, ISLAND_MAX, '섬 이름을 적어 주세요');
  return { ok: !error, base, value: base + ISLAND_SUFFIX, error };
}

/** 주사위 추천 이름 (모두 새로 지은 우리말) */
export const SUGGEST = {
  player: ['하늘', '보라', '다온', '이랑', '온유', '새봄', '도담', '나래', '가람', '라온', '미르', '윤슬', '해솔', '아라', '봄이', '단비'],
  island: ['포근', '몽글', '반짝', '소복', '달빛', '바람', '햇살', '구름', '노을', '도란', '꿈결', '별빛', '초록', '보들'],
};
export function suggest(kind, r = Math.random, not = '') {
  const list = (SUGGEST[kind] ?? []).filter(n => n !== not);
  return list[Math.floor(r() * list.length)] ?? '';
}

// ---------- 진행 기록 ----------

/**
 * state.flags.firstday 를 빈 칸 채워서 돌려준다.
 * { v, done: { 단계id: dayKey|true }, finished: dayKey|'legacy'|null, rewarded, hidden, legacy, collapsed }
 */
export function progressOf(state) {
  const f = (state.flags ??= {});
  if (!f.firstday || typeof f.firstday !== 'object') f.firstday = {};
  const p = f.firstday;
  p.v ??= 1;
  if (!p.done || typeof p.done !== 'object') p.done = {};
  p.finished ??= null;     // 다 마친 날
  p.rewarded ??= false;    // 밤톨 선물을 받았나
  p.hidden ??= false;      // 목록을 치웠나 (선물까지 끝, 또는 이미 오래 한 저장)
  p.legacy ??= false;      // 목록이 생기기 전부터 하던 저장
  p.collapsed ??= null;    // 목록 접기 (null = 화면 크기에 맞게)
  return p;
}

/** 단계 하나 끝 → 새로 끝났으면 true */
export function markDone(p, id, dayKey = null) {
  if (!STEP_IDS.includes(id) || p.done[id]) return false;
  p.done[id] = dayKey || true;
  return true;
}
export const doneCount = p => STEPS.filter(s => p.done[s.id]).length;
export const currentStep = p => STEPS.find(s => !p.done[s.id]) ?? null;
export const allDone = p => STEPS.every(s => p.done[s.id]);
export const rewardPending = p => !!p.finished && !p.rewarded;

/**
 * 목록이 생기기 전 저장(flags.intro 는 있는데 flags.firstday 가 없음)에서 이미 한 것으로 볼 단계.
 * 판 기록은 남지 않으므로 'sell' 은 오래 한 저장(잡고·기증하고·집에 들어가 봄)일 때만 한 것으로 본다.
 * → { done: [단계id], veteran }
 */
export function inferDone(state, { isTool = id => String(id).startsWith('tool.') } = {}) {
  const enc = state?.encyclopedia ?? {}, mus = state?.museum ?? {}, house = state?.house ?? {};
  const inv = Array.isArray(state?.inventory) ? state.inventory : [];
  const intro = !!state?.flags?.intro;
  const caught = (enc.fish?.length ?? 0) + (enc.bug?.length ?? 0) > 0;
  const donated = ['fish', 'bug', 'fossil'].some(c => mus[c]?.length > 0);
  const home = !!(house.seeded || house.inside || house.furniture?.length);
  const items = inv.some(s => s && s.id && !isTool(s.id)) || (state?.island?.drops?.length ?? 0) > 0;
  const veteran = intro && caught && donated && home;
  const done = {
    intro,
    tool: !!state?.player?.tool || caught || donated,
    gather: items || caught || donated,
    catch: caught,
    sell: veteran,
    donate: donated,
    home,
  };
  return { done: STEP_IDS.filter(id => done[id]), veteran };
}

// ---------- 안내 문구 ----------

/** 단계마다 짧은 안내 (누구에게·어디서·무슨 키). keys = 키보드, touch = 휴대폰 */
export const HINTS = {
  intro: { keys: '선착장의 밤톨에게 다가가 Space', touch: '선착장의 밤톨에게 다가가 A' },
  tool: { keys: '숫자키 1·2나 Q·E로 낚싯대·잠자리채를 들어요', touch: '오른쪽 아래 도구 단추를 누르면 도구를 들어요' },
  gather: { keys: '맨손(0)으로 나무 앞에서 Space를 누르면 흔들려요. 떨어진 건 F로 주워요', touch: '맨손으로 나무 앞에서 A를 누르면 흔들려요. 떨어진 건 B로 주워요' },
  catch: { keys: '낚싯대를 들고 물가에서 Space, 찌가 쏙 들어가면 다시 Space! 잠자리채로는 곤충을 잡아요', touch: '낚싯대를 들고 물가에서 A, 찌가 쏙 들어가면 다시 A! 잠자리채로는 곤충을 잡아요' },
  sell: { keys: "도토리상점 밤톨 앞에서 Space → '팔래요'", touch: "도토리상점 밤톨 앞에서 A → '팔래요'" },
  donate: { keys: '언덕 위 박물관 느루 앞에서 Space → 물고기·곤충·화석을 하나 기증해요', touch: '언덕 위 박물관 느루 앞에서 A → 물고기·곤충·화석을 하나 기증해요' },
  home: { keys: '우편함 옆 내 집 문 앞에서 Space', touch: '우편함 옆 내 집 문 앞에서 A' },
  reward: { keys: '밤톨에게 가서 Space로 알려 줘요 (보통은 도토리상점 앞에 있어요)', touch: '밤톨에게 가서 A로 알려 줘요 (보통은 도토리상점 앞에 있어요)' },
  rewardHome: { keys: '집에서 나와 보면 밤톨이 와 있을 거예요', touch: '집에서 나와 보면 밤톨이 와 있을 거예요' },
};

/**
 * 지금 단계 안내 한 줄.
 * opts: { touch, shopOpen(영업 중), canSell(팔 게 있나), canDonate(기증할 게 있나), inside(집 안) }
 */
export function hintFor(id, { touch = false, shopOpen = true, canSell = true, canDonate = true, inside = false } = {}) {
  const key = id === 'reward' && inside ? 'rewardHome' : id;
  const h = HINTS[key];
  if (!h) return '';
  let text = touch ? h.touch : h.keys;
  if (id === 'sell' && !canSell) text += ' (먼저 팔 걸 하나 구해요)';
  else if (id === 'sell' && !shopOpen) text += ' (지금은 문을 닫았어요 · 아침 8시~밤 10시)';
  if (id === 'donate' && !canDonate) text += ' (기증할 게 없으면 하나 더 잡아 와요)';
  if (id === 'reward' && !inside && !shopOpen) text += ' (문을 닫았어도 문 앞에서 불러요)';
  return text;
}

/** 목록 그리기용 → { steps: [{ id, label, icon, done, current }], n, total, current, finished, reward } */
export function viewOf(p) {
  const cur = currentStep(p);
  return {
    steps: STEPS.map(s => ({ id: s.id, label: s.label, icon: s.icon, done: !!p.done[s.id], current: cur?.id === s.id })),
    n: doneCount(p),
    total: STEPS.length,
    current: cur?.id ?? (rewardPending(p) ? 'reward' : null),
    finished: !!p.finished,
    reward: rewardPending(p),
  };
}
