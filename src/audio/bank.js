// 소리 데이터 묶음: assets/sound/ 의 JSON(곡 목록·언제 틀까 index.json, 곡 songs/<id>.json, 효과음 sfx.json, 목소리 voices.json)을
// 읽어서 곡·효과음·목소리·선곡 표에 넣는다. DOM·Web Audio 를 쓰지 않아서 node 테스트·편집기·게임이 같이 쓴다.
import { INDEX_FILE, SFX_FILE, VOICES_FILE, SONG_FILES, songFile } from './files.js';
import { setSongs, SONGS } from './songs.js';
import { setSfx } from './sfx.js';
import { setVoices } from './voice.js';

/**
 * 언제 어느 곡을 틀지 (index.json 의 schedule · fade).
 *   time    [{ part, label, from, song }] — from 시(0~23)부터 다음 줄 전까지. 첫 줄보다 이른 시각은 마지막 줄(밤)
 *   weather { 날씨: 곡 | '' }            — '' 이면 시간대 곡
 *   places  { 이름: 곡 | '' }            — 다른 모듈이 bgm(이름) 으로 부르는 자리 (집 안 = indoor). '' 이면 바깥처럼 자동
 *   panels  { 창: 곡 }                   — 열려 있는 동안 트는 창 (ui:open 의 panel)
 */
export const SCHEDULE = { time: [], weather: {}, places: {}, panels: {}, fade: { auto: 4, manual: 2, panel: 1.2 } };

export function setSchedule(index) {
  const s = index?.schedule ?? {};
  SCHEDULE.time = [...(s.time ?? [])].sort((a, b) => a.from - b.from);
  SCHEDULE.weather = { ...(s.weather ?? {}) };
  SCHEDULE.places = { ...(s.places ?? {}) };
  SCHEDULE.panels = { ...(s.panels ?? {}) };
  SCHEDULE.fade = { auto: 4, manual: 2, panel: 1.2, ...(index?.fade ?? {}) };
}

/** 시각 → 그 시간대 줄 */
export function slotForHour(hour, sched = SCHEDULE) {
  const list = sched.time;
  if (!list.length) return null;
  let pick = list.at(-1);
  for (const t of list) if (hour >= t.from) pick = t;
  return pick;
}

/** 바깥에서 자동으로 틀 곡: 날씨 칸이 있으면 그 곡, 아니면 시간대 곡 */
export function autoSong({ hour, weather }, sched = SCHEDULE) {
  const w = weather ? sched.weather[weather] : '';
  if (w) return w;
  return slotForHour(hour, sched)?.song || null;
}

/** 불러오기 (load = url → Promise<JSON>). 실패한 파일은 errors 에 적고 넘어간다 */
export async function loadSound(load) {
  const errors = [];
  const get = url => Promise.resolve().then(() => load(url)).catch(e => { errors.push(`${url}: ${e?.message ?? e}`); return null; });
  const [index, sfx, voices, ...listed] = await Promise.all([get(INDEX_FILE), get(SFX_FILE), get(VOICES_FILE), ...SONG_FILES.map(get)]);
  const songs = listed.filter(Boolean);
  // 목록에는 있는데 files.js 에 안 적힌 곡 (웹 빌드에는 빠지니 테스트가 잡는다)
  const missing = (index?.songs ?? []).filter(id => !songs.some(s => s.id === id));
  songs.push(...(await Promise.all(missing.map(id => get(songFile(id))))).filter(Boolean));
  return { index, sfx, voices, songs, errors };
}

/** 불러온 데이터를 곡·효과음·목소리·선곡 표에 넣는다 → 문제 목록 */
export function installSound({ index, sfx, voices, songs = [] }) {
  const byId = Object.fromEntries(songs.map(s => [s.id, s]));
  const order = index?.songs ?? songs.map(s => s.id);
  const errors = setSongs(order.map(id => byId[id]).filter(Boolean));
  for (const id of order) if (!byId[id]) errors.push(`곡 파일이 없어요: ${id}`);
  if (sfx) errors.push(...setSfx(sfx));
  if (voices) errors.push(...setVoices(voices));
  setSchedule(index);
  const used = [...SCHEDULE.time.map(t => t.song), ...Object.values(SCHEDULE.weather), ...Object.values(SCHEDULE.places), ...Object.values(SCHEDULE.panels)];
  for (const id of used) if (id && !SONGS[id]) errors.push(`선곡 표에 없는 곡: ${id}`);
  return errors;
}

// ── JSON 모양 (assets/sound/ 파일은 이 모양으로 쓴다 — 짧은 묶음은 한 줄로) ──
function inline(v) {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  if (v && typeof v === 'object') {
    const e = Object.entries(v);
    return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(v);
}
export function formatJSON(v, ind = '', width = 140) {
  const flat = inline(v);
  if (v === null || typeof v !== 'object' || flat.length + ind.length <= width) return flat;
  const next = ind + '  ';
  if (Array.isArray(v)) return `[\n${v.map(x => next + formatJSON(x, next, width)).join(',\n')}\n${ind}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${next}${JSON.stringify(k)}: ${formatJSON(x, next, width)}`).join(',\n')}\n${ind}}`;
}
