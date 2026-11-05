// 스토리 장면 규칙 (DOM·three 없음 — 게임 재생기·시나리오 편집기·node 테스트가 같이 쓴다).
// 장면 파일 모양·트리거·카메라 계산·배우 상태 쌓기·검사. 모양 설명은 docs/notes/story.md '장면 파일'.

/** 장면이 시작되는 때. event = 듣는 이벤트, test(payload, trigger) = 맞는지 */
export const TRIGGERS = {
  newgame: { label: '새 게임 (이름을 처음 정한 뒤)', event: 'intro:named', test: p => !p?.renamed },
  'firstday-done': { label: '첫날 할 일 끝 (밤톨 선물 뒤)', event: 'intro:reward' },
  after: { label: '다른 장면이 끝난 뒤 바로', event: 'story:end', test: (p, t) => p?.id === t.scene },
  'guide-done': { label: '밤톨 첫 안내 대화가 끝난 뒤', event: 'town:intro', test: p => !!p?.done },
  newday: { label: '다른 장면을 본 다음 날', event: 'data:newday' },
  'festival-part': { label: '축제 부품 n개째', event: 'festival:part', test: (p, t) => Number(p?.n) === Number(t.n) },
  festival: { label: '축제 시작', event: 'festival:start' },
  'event-start': { label: '계절 행사를 처음 할 때 (8차 — trigger.event = EV-01…)', event: 'events:start', test: (p, t) => p?.id === t.event && !!p?.first },
  manual: { label: '직접 부를 때만 (story.play)', event: null },
};
export const TRIGGER_KINDS = Object.keys(TRIGGERS);

/** 장면 기준 자리 = world.places 의 이름 (건물은 문 앞) */
export const PLACES = { event: '트리거가 알려 준 자리 (부스 등, 없으면 광장)', dock: '선착장', spawn: '선착장 앞', plaza: '광장', shop: '도토리상점 앞', museum: '박물관 앞', playerHouse: '내 집 앞', pond: '연못', orchard: '과수원', waterfall: '폭포' };
export const MOTIONS = { idle: '서 있기', walk: '걷기', run: '달리기', happy: '기뻐하기' };
/** 카메라 크기: dist = 대상까지 거리(칸), pitch = 내려다보는 각도(도), lift = 바라보는 높이 */
export const CAM_SIZES = {
  wide: { label: '멀리 (풍경)', dist: 15, pitch: 30, lift: 0.5 },
  full: { label: '온몸', dist: 7.5, pitch: 17, lift: 0.55 },
  group: { label: '여럿 한 화면', dist: 7.8, pitch: 14, lift: 0.6 },
  medium: { label: '허리 위', dist: 4.6, pitch: 11, lift: 0.7 },
  close: { label: '얼굴 가까이', dist: 2.6, pitch: 7, lift: 0.8 },
  overhead: { label: '하늘에서', dist: 22, pitch: 62, lift: 0 },
};
export const CAM_MOVES = {
  static: '고정',
  push: '다가가기',
  pull: '물러나기',
  orbit: '옆으로 돌기',
  crane: '위로 올라가기',
  pan: '앞 컷에서 이어 옮기기',
};
export const TRANSITIONS = { cut: '바로 넘기기', fade: '검게 어두워졌다 밝아지기', white: '하얗게 번쩍 (사진)' };
export const MUSIC = { '': '그대로', auto: '시각 따라 (자동)', stop: '끄기', dawn: '새벽', morning: '아침', afternoon: '낮', evening: '저녁', night: '밤', shop: '상점', museum: '박물관', indoor: '집 안' };
/** 이모티콘 고르기 판 (Z5 가 이모티콘 대화 팔레트를 정하면 그것으로 바꾼다 — docs/notes/story.md) */
export const EMOTES = ['👋', '😊', '😄', '🥹', '😢', '😮', '❓', '❗', '💡', '❤️', '✨', '🎉', '👍', '🙌', '💪', '🙏', '😴', '🎵', '🏝️', '🌰', '📋', '🎁', '🏮', '🎆', '🥁', '🎺', '🚩', '⛺', '🔔', '🧩', '📷', '📸', '✌️', '🌅', '🌙', '🏠', '⛵', '🐟', '🦋', '🌸', '👏', '🔨', '💃', '3️⃣', '2️⃣', '1️⃣', '⏲️', '📅', '🍰', '✉️'];
export const STATUSES = { draft: '초안', review: '검수 중', approved: '확정' };

export const CAM_TARGETS_SPECIAL = { place: '기준 자리', group: '모인 배우 가운데' };

const num = v => Number.isFinite(v);
const clamp01 = v => Math.max(0, Math.min(1, v));
export const ease = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
const rad = d => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- 연출안 ----------

/** 장면에서 재생할 연출안 (key 가 없거나 틀리면 pick → 추천 → 첫 번째) */
export function takeOf(scene, key) {
  const takes = scene?.takes ?? [];
  return takes.find(t => t.key === key) ?? takes.find(t => t.key === scene?.pick) ?? takes.find(t => t.recommended) ?? takes[0] ?? null;
}

/** 컷 id → 순번 */
export const shotIndex = (take, id) => (take?.shots ?? []).findIndex(s => s.id === id);

// ---------- 배우 ----------

/**
 * 컷 i 가 시작될 때 배우들 상태 (앞 컷들의 at·to·hide 를 쌓는다).
 * → { 배우: { at:[dx,dz], face, do, hidden } } — at 은 기준 자리에서 떨어진 칸 (x 동쪽+, z 남쪽+)
 */
export function castAt(take, i) {
  const cast = {};
  const shots = take?.shots ?? [];
  for (let k = 0; k < Math.min(i, shots.length); k++) {
    for (const a of shots[k].actors ?? []) {
      const c = (cast[a.who] ??= { at: [0, 0], face: null, do: 'idle', hidden: false });
      if (a.at) c.at = [...a.at];
      if (a.to) c.at = [...a.to];
      if (a.face != null) c.face = a.face;
      c.do = a.to || a.do === 'happy' ? 'idle' : (a.do ?? c.do);
      c.hidden = !!a.hide;
    }
  }
  return cast;
}

/** 컷 하나 동안 배우 자리 (u = 0~1). 걷기·달리기는 to 까지 일정한 빠르기로 간다 */
export const WALK_SPEED = { walk: 2.1, run: 4.2 };
export function actorPosAt(start, a, dur, u) {
  const from = a.at ?? start ?? [0, 0];
  if (!a.to) return from;
  const d = Math.hypot(a.to[0] - from[0], a.to[1] - from[1]);
  const speed = WALK_SPEED[a.do] ?? WALK_SPEED.walk;
  const need = d / speed;
  const k = need <= 0 ? 1 : clamp01((u * dur) / Math.max(need, 0.001));
  if (k >= 1) return [a.to[0], a.to[1]];        // 도착은 to 그대로 (lerp 끝값은 소수 오차로 to 와 달라 재생기가 도착을 못 알아챘다)
  return [lerp(from[0], a.to[0], k), lerp(from[1], a.to[1], k)];
}

/** 장면에 나오는 배우 slug 목록 (연출안 모두) */
export function castOf(scene) {
  const s = new Set();
  for (const t of scene?.takes ?? []) for (const sh of t.shots ?? []) for (const a of sh.actors ?? []) s.add(a.who);
  return [...s];
}

// ---------- 카메라 ----------

/**
 * 카메라 자리. cam = { size, target, angle(도, 0 = 대상 남쪽에서 북쪽을 봄 — 게임 기본 카메라와 같은 쪽), height(칸), dist(칸, 없으면 크기 기본값), move },
 * target = 대상 자리 {x, y, z}, u = 컷 안 진행 0~1. → { pos, look }
 */
export function cameraAt(cam = {}, target = { x: 0, y: 0, z: 0 }, u = 0) {
  const S = CAM_SIZES[cam.size] ?? CAM_SIZES.full;
  const e = ease(u);
  let dist = cam.dist > 0 ? cam.dist : S.dist, pitch = S.pitch, yaw = cam.angle ?? 0;
  if (cam.move === 'push') dist *= lerp(1.15, 0.85, e);
  if (cam.move === 'pull') dist *= lerp(0.85, 1.2, e);
  if (cam.move === 'orbit') yaw += lerp(-14, 14, e);
  if (cam.move === 'crane') pitch += lerp(-4, 16, e);
  const p = rad(Math.max(2, Math.min(85, pitch))), y = rad(yaw);
  const look = { x: target.x, y: (target.y ?? 0) + S.lift + (cam.height ?? 0), z: target.z };
  const pos = {
    x: look.x + Math.sin(y) * Math.cos(p) * dist,
    y: look.y + Math.sin(p) * dist,
    z: look.z + Math.cos(y) * Math.cos(p) * dist,
  };
  return { pos, look };
}

/**
 * 카메라가 건물·부스 같은 물체 안에 들어가면 대상 쪽으로 당겨 그 물체 앞에 세운다 (QA-01: 광장 남쪽 집 안에서 찍힘).
 * c = { pos, look }, obstacles = [{ x, z, r, h }] (바닥 원 · 높이). 카메라가 물체보다 높으면 그대로.
 * 고친 { pos, look } 를 돌려준다 (안 고쳤으면 c 그대로).
 */
export function clearCam(c, obstacles = [], { pad = 0.35, minFrac = 0.35 } = {}) {
  const dx = c.pos.x - c.look.x, dy = c.pos.y - c.look.y, dz = c.pos.z - c.look.z;
  const L2 = dx * dx + dz * dz;
  if (L2 < 1e-6) return c;
  let k = 1;
  for (const o of obstacles) {
    const R = o.r + pad;
    if (Math.hypot(c.pos.x - o.x, c.pos.z - o.z) >= R) continue;          // 카메라가 원 밖이면 상관없다 (사이를 가리는 건 가림 투명이 비친다)
    // 대상 → 카메라 선이 원에 들어가는 곳 t (0~1)
    const fx = c.look.x - o.x, fz = c.look.z - o.z;
    const b = fx * dx + fz * dz, cc = fx * fx + fz * fz - R * R;
    const disc = b * b - L2 * cc;
    if (cc <= 0) continue;                                                   // 대상이 원 안 = 대상이 그 물체 곁에 붙어 선 것 → 건드리지 않는다
    const t = (-b - Math.sqrt(Math.max(0, disc))) / L2;
    if (c.look.y + dy * t > (o.h ?? 3) + 0.2) continue;                     // 그 자리에서 카메라 높이가 물체 위
    k = Math.min(k, Math.max(minFrac, t));
  }
  if (k >= 1) return c;
  return { pos: { x: c.look.x + dx * k, y: c.look.y + dy * k, z: c.look.z + dz * k }, look: c.look };
}

/** 두 카메라 사이 (pan 이동) */
export function blendCam(a, b, t) {
  const e = ease(t), mix = (p, q) => ({ x: lerp(p.x, q.x, e), y: lerp(p.y, q.y, e), z: lerp(p.z, q.z, e) });
  return { pos: mix(a.pos, b.pos), look: mix(a.look, b.look) };
}

/** 카메라 대상 → 기준 자리에서 떨어진 칸 [dx, dz] (배우 자리표 cast 를 쓴다) */
export function targetOffset(target, cast) {
  if (Array.isArray(target)) return target;
  if (!target || target === 'place') return [0, 0];
  if (target === 'group') {
    const pts = Object.values(cast).filter(c => !c.hidden).map(c => c.at);
    if (!pts.length) return [0, 0];
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }
  return cast[target]?.at ?? [0, 0];
}

/**
 * 편집기 스케치용 투영: 카메라에서 본 화면 좌표 (0~1, y 아래로). fov = 세로 시야각(도, 게임 32).
 * → { x, y, depth } | null (카메라 뒤)
 */
export function project(camPos, look, pt, aspect = 16 / 9, fov = 32) {
  const f = norm(sub(look, camPos));
  const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const up = cross(r, f);
  const d = sub(pt, camPos);
  const z = dot(d, f);
  if (z < 0.1) return null;
  const t = Math.tan(rad(fov) / 2);
  return { x: 0.5 + (dot(d, r) / (z * t * aspect)) / 2, y: 0.5 - (dot(d, up) / (z * t)) / 2, depth: z };
}
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = a => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

// ---------- 글 자리 ----------

/** '{part.emoji}'·'{n}' 같은 자리를 트리거 내용으로 채운다 ({player}·{island} 는 intro.fill 이 먼저 채운다) */
export function fillTokens(text, vars = {}) {
  return String(text ?? '').replace(/\{([\w.]+)\}/g, (m, k) => {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), vars);
    return v == null || v === '' ? m : String(v);
  });
}

/** 장면 길이 (초, 선택지·탭 기다림 빼고, 갈래 없이 처음부터 끝까지) */
export const takeLength = take => (take?.shots ?? []).reduce((s, sh) => s + (num(sh.dur) ? sh.dur : 0), 0);

// ---------- 트리거 ----------

/** 이벤트 하나에 맞는 장면 id 들 (순서 = 타임라인). seen = 이미 본 장면 { id: dayKey } */
export function scenesFor(event, payload, scenes, seen = {}) {
  const out = [];
  for (const sc of scenes) {
    const t = sc.trigger ?? {}, def = TRIGGERS[t.on];
    if (!def || def.event !== event) continue;
    if (sc.once !== false && seen[sc.id]) continue;
    if (t.on === 'newday' && !seen[t.scene]) continue;
    if (def.test && !def.test(payload, t)) continue;
    out.push(sc.id);
  }
  return out;
}

// ---------- 검사 ----------

/** 장면 파일 하나 검사 → 오류 글 목록 (빈 배열 = 괜찮음). cast = 쓸 수 있는 배우 slug 목록 (없으면 안 봄) */
export function validateScene(sc, { cast = null, ids = null } = {}) {
  const err = [];
  const at = p => `${sc?.id ?? '?'}: ${p}`;
  if (!sc || typeof sc !== 'object') return ['장면이 객체가 아니에요'];
  if (!/^s\d{2}-[a-z0-9-]+$/.test(sc.id ?? '')) err.push(at(`id 모양 's01-이름' 이 아니에요 (${sc.id})`));
  if (!num(sc.version) || sc.version < 1) err.push(at('version 이 1 이상 숫자가 아니에요'));
  if (!STATUSES[sc.status]) err.push(at(`status ${sc.status}`));
  if (!sc.title) err.push(at('title 이 없어요'));
  const t = sc.trigger;
  if (!t || !TRIGGERS[t.on]) err.push(at(`trigger.on ${t?.on}`));
  else {
    if ((t.on === 'after' || t.on === 'newday') && !t.scene) err.push(at(`trigger ${t.on} 에 scene 이 없어요`));
    if ((t.on === 'after' || t.on === 'newday') && ids && !ids.includes(t.scene)) err.push(at(`trigger.scene ${t.scene} 장면이 없어요`));
    if (t.on === 'festival-part' && !(Number.isInteger(t.n) && t.n >= 1 && t.n <= 5)) err.push(at('festival-part 의 n 은 1~5'));
    if (t.on === 'event-start' && !/^EV-0[1-4]$/.test(t.event ?? '')) err.push(at('event-start 의 event 는 EV-01~04'));
  }
  if (!PLACES[sc.place]) err.push(at(`place ${sc.place}`));
  const takes = sc.takes ?? [];
  if (takes.length < 1 || takes.length > 4) err.push(at(`연출안은 1~4개 (${takes.length})`));
  const keys = takes.map(x => x.key);
  if (new Set(keys).size !== keys.length) err.push(at('연출안 key 가 겹쳐요'));
  if (takes.filter(x => x.recommended).length !== 1) err.push(at('추천 연출안은 하나여야 해요'));
  if (!keys.includes(sc.pick)) err.push(at(`pick ${sc.pick} 연출안이 없어요`));
  for (const tk of takes) {
    const tp = p => at(`${tk.key}: ${p}`);
    if (!/^[A-Z]$/.test(tk.key ?? '')) err.push(tp('key 는 A~Z 한 글자'));
    if (tk.place != null && !PLACES[tk.place]) err.push(tp(`place ${tk.place}`));
    if (!tk.title) err.push(tp('title 이 없어요'));
    const shots = tk.shots ?? [];
    const sid = shots.map(s => s.id);
    if (new Set(sid).size !== sid.length) err.push(tp('컷 id 가 겹쳐요'));
    for (const s of shots) {
      const sp = p => tp(`${s.id}: ${p}`);
      if (!s.id) err.push(tp('id 없는 컷'));
      if (!(num(s.dur) && s.dur > 0 && s.dur <= 30)) err.push(sp('dur 는 0~30초'));
      if (s.cam) {
        if (!CAM_SIZES[s.cam.size]) err.push(sp(`cam.size ${s.cam.size}`));
        if (s.cam.move && !CAM_MOVES[s.cam.move]) err.push(sp(`cam.move ${s.cam.move}`));
        if (s.cam.dist != null && !(num(s.cam.dist) && s.cam.dist >= 1 && s.cam.dist <= 40)) err.push(sp('cam.dist 는 1~40칸'));
        if (s.cam.place != null && !PLACES[s.cam.place]) err.push(sp(`cam.place ${s.cam.place}`));
        const tg = s.cam.target;
        if (tg != null && !Array.isArray(tg) && !CAM_TARGETS_SPECIAL[tg] && cast && !cast.includes(tg)) err.push(sp(`cam.target ${tg}`));
      } else err.push(sp('cam 이 없어요'));
      if (s.transition && !TRANSITIONS[s.transition]) err.push(sp(`transition ${s.transition}`));
      if (s.music != null && !(s.music in MUSIC)) err.push(sp(`music ${s.music}`));
      for (const a of s.actors ?? []) {
        if (cast && !cast.includes(a.who) && !a.optional) err.push(sp(`없는 배우 ${a.who}`));
        if (a.do && !MOTIONS[a.do]) err.push(sp(`${a.who}.do ${a.do}`));
        for (const k of ['at', 'to']) if (a[k] != null && !(Array.isArray(a[k]) && a[k].length === 2 && a[k].every(num))) err.push(sp(`${a.who}.${k} 는 [x, z]`));
        if (a.emote != null && typeof a.emote !== 'string') err.push(sp(`${a.who}.emote 는 글자`));
        if (a.text != null && typeof a.text !== 'string') err.push(sp(`${a.who}.text 는 글자`));
        if (a.face != null && !(num(a.face) || typeof a.face === 'string' || (Array.isArray(a.face) && a.face.length === 2))) err.push(sp(`${a.who}.face`));
      }
      if (s.choice) {
        const opts = s.choice.options ?? [];
        if (opts.length < 2 || opts.length > 4) err.push(sp('선택지는 2~4개'));
        for (const o of opts) {
          if (!o.emote) err.push(sp('선택지에 emote 가 없어요'));
          if (o.goto && !sid.includes(o.goto)) err.push(sp(`선택지 goto ${o.goto} 컷이 없어요`));
        }
      }
      if (s.goto && !sid.includes(s.goto) && s.goto !== 'end') err.push(sp(`goto ${s.goto} 컷이 없어요`));
    }
  }
  return err;
}

/** 타임라인 index.json 검사 → 오류 글 목록 */
export function validateIndex(index, sceneIds) {
  const err = [];
  const listed = (index?.timeline ?? []).filter(r => r.scene).map(r => r.scene);
  for (const id of listed) if (!sceneIds.includes(id)) err.push(`index: 없는 장면 ${id}`);
  for (const id of sceneIds) if (!listed.includes(id)) err.push(`index: 타임라인에 없는 장면 ${id}`);
  if (new Set(listed).size !== listed.length) err.push('index: 장면이 두 번 나와요');
  for (const r of index?.timeline ?? []) if (!r.scene && !(r.fixed && r.title)) err.push(`index: 줄 모양 ${JSON.stringify(r)}`);
  return err;
}
