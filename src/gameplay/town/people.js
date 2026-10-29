// 주민·가게 주인 설정: 이름표 색(assets/specs 팔레트), 걸음 빠르기, 일과, 자주 가는 곳, 좋아하는 선물, 부탁, 보상, 대사.
// 6차 M6-P3 부터 값은 주민마다 assets/villagers/<slug>.json 한 파일 (캐릭터 편집기 「성격·대화」 탭 → 채팅 "요청 확인").
// 여기서는 파일을 받아 게임이 쓰던 모양(PEOPLE · KEEPERS · LINES)으로 펼친다 (traits.js toPerson). 이모티콘 규칙은 파일의 emote 칸,
// 생일은 assets/data/rules.json birthdays (data/birthdays.js). 시각은 5~29 (24 넘으면 다음 날 새벽), haunts 이름은 index.js 의 장소 후보(spots).
// 표 불러오기는 data/tables.js 와 같다: 쓰는 모듈이 바로 쓸 수 있게 파일을 다 받을 때까지 기다린다 (top-level await).
import { VILLAGER_FILES } from './files.js';
import { toPerson, toKeeper } from './traits.js';

const fs = globalThis.process?.getBuiltinModule?.('node:fs');
async function load(path) {
  if (fs) return JSON.parse(fs.readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
  const { loadJSON } = await import('../../core/assets.js');
  return loadJSON(path);
}

/** 주민 파일 그대로 (순서 = files.js) — festival 의 이모티콘 규칙, 편집기가 쓴다 */
export const VILLAGERS = await Promise.all(VILLAGER_FILES.map(load));

export const PEOPLE = Object.fromEntries(VILLAGERS.filter(d => d.role === 'villager').map(d => [d.slug, toPerson(d)]));

/** 가게 주인 (돌아다니지 않는다) */
export const KEEPERS = Object.fromEntries(VILLAGERS.filter(d => d.role === 'keeper').map(d => [d.slug, toKeeper(d)]));

/** 대사 묶음 (lines/index.js 가 그대로 내보낸다). 꺼 둔 대사(linesOff)는 넣지 않는다 */
export const LINES = Object.fromEntries(VILLAGERS.map(d => [d.slug, d.lines]));
