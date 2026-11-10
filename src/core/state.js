// 저장되는 게임 상태의 모양. 저장·불러오기 자체는 data 모듈(src/data/save.js)이 맡는다.
// 각 모듈은 자기 칸만 고친다 (docs/CONTRACTS.md "상태" 표 참고).
export const STATE_VERSION = 1;

export function createState() {
  return {
    version: STATE_VERSION,
    createdAt: Date.now(),
    player: { name: '', x: 0, z: 0, facing: 0, tool: null, hair: null, shirt: null },   // world/player
    wallet: { acorns: 0 },                                                               // data
    inventory: Array(20).fill(null),             // data: 칸마다 { id, count } 또는 null
    museum: { fish: [], bug: [], fossil: [] },   // data: 기증한 아이템 id
    encyclopedia: { fish: [], bug: [] },         // data: 한 번이라도 잡은 것
    island: { seed: 20261028, dayKey: null, removed: [], added: [], dug: [], fruit: {} },   // world + data(하루 리셋)
    villagers: {},                               // 주민별 { friendship, lastTalk, request }
    house: { furniture: [] },                    // 실내 가구 배치
    time: { speed: null, offset: 0, game: null, maxDay: null },   // sky: speed null = rules.json time.speed (p41 시간 빠르기), 실제와 같게 = 실제 시계 + offset, 빠르게 = game
    settings: { bgm: 0.6, sfx: 0.8, voice: 0.7, outline: true },
    flags: {},                                   // 튜토리얼 등 한 번만 일어나는 일
  };
}
