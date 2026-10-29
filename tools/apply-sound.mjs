// "소리 반영" 도우미: 곡 편집기(sound-editor.html) 저장소의 초안(drafts 컬렉션)을 assets/sound/ 파일에 넣는다.
//   node tools/apply-sound.mjs <초안.json> [--dry]
// <초안.json> = ArtifactData list 로 읽은 drafts 행 배열 (또는 { rows: [...] }). 행 모양은 docs/notes/m6-p4-sound.md 「저장소」.
// 하는 일: 곡 고침 → songs/<id>.json (version +1), 새 곡 → 파일 + index.json songs + src/audio/files.js, 언제 틀까 → index.json (version +1),
// 효과음 높이·길이·크기 → sfx.json (version +1), 목소리 값 → voices.json (version +1). 곡은 buildSong 으로 먼저 검사해서 틀리면 넣지 않는다.
// 의견(note·notes)은 파일에 넣지 않고 끝에 모아 보여 준다 — Claude 가 읽고 직접 고친다.
// 끝에 반영 기록(applied/sound)에 쓸 changed·notes 를 JSON 으로 찍는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJSON } from '../src/audio/bank.js';
import { buildSong } from '../src/audio/songs.js';
import { checkSfx } from '../src/audio/sfx.js';
import { INDEX_FILE, SFX_FILE, VOICES_FILE, songFile } from '../src/audio/files.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const input = args.find(a => !a.startsWith('--'));
if (!input) { console.error('쓰는 법: node tools/apply-sound.mjs <초안.json> [--dry]'); process.exit(1); }

const read = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const write = (p, v) => { if (!dry) writeFileSync(resolve(root, p), formatJSON(v) + '\n'); };
const canon = o => JSON.stringify(o);
const noVersion = ({ version, ...rest }) => rest;

const raw = JSON.parse(readFileSync(resolve(input), 'utf8'));
const rows = (Array.isArray(raw) ? raw : raw.rows ?? raw.docs ?? []).map(r => r.data ?? r);
const index = read(INDEX_FILE), sfx = read(SFX_FILE), voices = read(VOICES_FILE);
const changed = [], notes = {}, problems = [];
let indexDirty = false, filesDirty = false;

for (const d of rows) {
  if (d.kind === 'song') {
    if (d.note) notes[`song:${d.id}`] = d.note;
    if (d.removed || !d.song) continue;                                   // 편집기에서 뺀 새 곡
    if (!/^[a-z][a-z0-9-]*$/.test(d.id)) { problems.push(`곡 id '${d.id}' 는 영문 소문자·숫자·- 만`); continue; }
    const isNew = !index.songs.includes(d.id);
    const old = isNew ? null : read(songFile(d.id));
    if (old && canon(noVersion(d.song)) === canon(noVersion(old))) continue;
    const song = { ...d.song, id: d.id, version: (old?.version ?? 0) + 1 };
    try { buildSong(song); } catch (e) { problems.push(`곡 ${d.id}: ${e.message}`); continue; }
    write(songFile(d.id), song);
    if (isNew) { index.songs.push(d.id); indexDirty = filesDirty = true; }
    changed.push(`${isNew ? '새 곡' : '곡'} ${d.id} v${song.version}`);
  } else if (d.kind === 'schedule') {
    if (d.note) notes.schedule = d.note;
    if (d.schedule && canon(d.schedule) !== canon(index.schedule)) { index.schedule = d.schedule; indexDirty = true; changed.push('언제 틀까'); }
  } else if (d.kind === 'sfx') {
    for (const [n, t] of Object.entries(d.notes ?? {})) if (t) notes[`sfx:${n}`] = t;
    let any = false;
    for (const [n, v] of Object.entries(d.changes ?? {})) {
      const cur = sfx.sfx[n];
      if (!cur) { problems.push(`없는 효과음 ${n}`); continue; }
      const next = { ...cur, ...pick(v, ['pitch', 'length', 'trim']) };
      const err = checkSfx(n, next);
      if (err) { problems.push(err); continue; }
      if (canon(next) === canon(cur)) continue;
      sfx.sfx[n] = next; any = true; changed.push(`효과음 ${n}`);
    }
    if (any) { sfx.version++; write(SFX_FILE, sfx); }
  } else if (d.kind === 'voices') {
    for (const [id, t] of Object.entries(d.notes ?? {})) if (t) notes[`voice:${id}`] = t;
    let any = false;
    for (const [id, v] of Object.entries(d.changes ?? {})) {
      const cur = voices.voices[id];
      if (!cur) { problems.push(`없는 목소리 ${id}`); continue; }
      const next = { ...cur, ...pick(v, ['f0', 'syl', 'gap', 'formant', 'jitter', 'gain']) };
      if (canon(next) === canon(cur)) continue;
      voices.voices[id] = next; any = true; changed.push(`목소리 ${id}`);
    }
    if (any) { voices.version++; write(VOICES_FILE, voices); }
  }
}
if (indexDirty) { index.version++; write(INDEX_FILE, index); }
if (filesDirty && !dry) {
  // src/audio/files.js 의 SONG_FILES 를 index.json 순서로 다시 쓴다 (웹 빌드가 이 글자들로 파일을 묶는다)
  const p = resolve(root, 'src/audio/files.js');
  const src = readFileSync(p, 'utf8');
  const list = `export const SONG_FILES = [\n${index.songs.map(id => `  '${songFile(id)}',`).join('\n')}\n];`;
  writeFileSync(p, src.replace(/export const SONG_FILES = \[[\s\S]*?\];/, list));
}

function pick(o, keys) { return Object.fromEntries(keys.filter(k => typeof o?.[k] === 'number' && Number.isFinite(o[k])).map(k => [k, o[k]])); }

console.log(dry ? '(--dry: 파일은 쓰지 않았어요)' : '');
console.log(changed.length ? `바꾼 것 ${changed.length}개:\n  ${changed.join('\n  ')}` : '바꾼 파일 없음');
if (problems.length) console.log(`넣지 못한 것:\n  ${problems.join('\n  ')}`);
if (Object.keys(notes).length) console.log(`의견 (직접 반영):\n${Object.entries(notes).map(([k, t]) => `  ${k}: ${t}`).join('\n')}`);
console.log(`\n반영 기록용: ${JSON.stringify({ changed, notes })}`);
if (problems.length) process.exitCode = 2;
