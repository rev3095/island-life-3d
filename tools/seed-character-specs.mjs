// 컨셉 보드 v0.1의 캐릭터 9종을 스펙 파일(assets/specs/<slug>.json)로 만든다. 이미 있는 스펙은 건드리지 않는다.
// 사용: node tools/seed-character-specs.mjs
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = resolve(fileURLToPath(new URL("..", import.meta.url)), "assets/specs");
const common = { eye: "#3A2A22", blush: "#F6A8A0", outline: "#4A3B32" };
const plain = { top: "plain-tee", stripes: 0, bottom: "shorts" };

const CHARS = [
  { id: "CH-01", slug: "player", name: "플레이어", species: "human", role: "주인공",
    prompt: { concept: "섬에 막 이사 온 주인공. 담백하게 웃는 얼굴로, 누구나 자기라고 느낄 수 있는 평범하고 귀여운 모습.",
      keywords: ["2.5등신", "큰 머리", "짧은 머리", "민무늬 티셔츠", "반바지", "담백한 웃음"],
      references: ["장난감 피규어 같은 둥근 머리", "앞머리가 세 갈래로 나뉜 짧은 머리"],
      avoid: ["특정 성별이 강하게 드러나는 디자인", "날카로운 인상"] },
    palette: { fur: "#F6D3B6", hair: "#6B4A33", shirt: "#5DB7A8", pants: "#3E5577", ...common },
    proportions: { eyeSize: 0.92 } },
  { id: "CH-03", slug: "bori", name: "보리", species: "dog", role: "주민 · 강아지",
    prompt: { concept: "느긋한 강아지 주민. 햇볕 좋은 곳에서 낮잠 자는 게 제일 좋다. 축 늘어진 귀가 트레이드마크.",
      keywords: ["늘어진 귀", "통통한 주둥이", "느긋함", "파란 셔츠"], references: ["털이 짧은 황구", "졸린 눈매의 강아지 인형"],
      avoid: ["사실적인 털 표현", "사나운 인상"] },
    palette: { fur: "#D8A26E", muzzle: "#F6E3C8", ear: "#8C5A36", nose: "#3A2A22", tail: "#D8A26E", shirt: "#6CA0DC", pants: "#4D5E78", ...common } },
  { id: "CH-04", slug: "mochi", name: "모찌", species: "rabbit", role: "주민 · 토끼",
    prompt: { concept: "상냥한 토끼 주민. 꽃 가꾸기를 좋아하고 말투가 늘 부드럽다. 하얀 털에 연보라 옷.",
      keywords: ["긴 귀", "하얀 털", "분홍 귀 안쪽", "동그란 꼬리", "연보라"], references: ["찹쌀떡처럼 말랑한 느낌", "귀가 살짝 벌어진 토끼 인형"],
      avoid: ["너무 마른 몸", "빨간 눈"] },
    palette: { fur: "#F7F1EC", muzzle: "#FFFFFF", innerEar: "#F4B6C2", nose: "#E88C9C", tail: "#FFFFFF", shirt: "#B9A6E0", stripe: "#F4EEFB", pants: "#7D6AA8", ...common },
    outfit: { top: "striped-tee", stripes: 1, bottom: "shorts" } },
  { id: "CH-05", slug: "dubu", name: "두부", species: "bear", role: "주민 · 곰",
    prompt: { concept: "무뚝뚝하지만 다정한 곰 주민. 낚시가 취미이고 말수가 적다. 섬 주민 중 제일 크다.",
      keywords: ["둥근 귀", "큰 덩치", "무뚝뚝", "초록 셔츠"], references: ["갈색 테디베어", "어깨가 넓은 곰 인형"],
      avoid: ["무섭거나 사나운 표정"] },
    palette: { fur: "#9A8573", muzzle: "#DCCBB7", innerEar: "#DCCBB7", nose: "#3A2A22", tail: "#9A8573", shirt: "#7FA36B", pants: "#5B4A3E", ...common },
    proportions: { height: 1.1, bodyWidth: 1.12 } },
  { id: "CH-06", slug: "pong", name: "퐁", species: "duck", role: "주민 · 오리",
    prompt: { concept: "먹보 오리 주민. 요리를 좋아하고 맛있는 과일만 보면 신이 난다. 통통 튀는 말투.",
      keywords: ["노란 깃털", "넓적한 주황 부리", "정수리 깃털", "통통함"], references: ["고무 오리 장난감", "아기 오리"],
      avoid: ["사실적인 깃털"] },
    palette: { fur: "#FFD866", beak: "#F39A3B", feet: "#F39A3B", tail: "#FFD866", shirt: "#5BB5B0", pants: "#3F7F7B", ...common },
    proportions: { height: 0.9 } },
  { id: "CH-07", slug: "chorong", name: "초롱", species: "frog", role: "주민 · 개구리",
    prompt: { concept: "수다쟁이 개구리 주민. 비 오는 날을 제일 좋아해서 비가 오면 하루 종일 신나 있다.",
      keywords: ["납작하고 넓은 머리", "머리 위 동그란 눈", "큰 입", "연두색", "주황 셔츠"], references: ["청개구리 인형", "비 오는 날의 연못"],
      avoid: ["미끌미끌한 질감", "징그러운 표현"] },
    palette: { fur: "#8CCB6E", muzzle: "#E9F3C8", shirt: "#F2A65A", pants: "#7B6A3A", ...common },
    proportions: { height: 0.9 } },
  { id: "CH-08", slug: "bamtol", name: "밤톨", species: "squirrel", role: "도토리상점 주인 · 다람쥐",
    prompt: { concept: "부지런한 다람쥐 상점 주인. 첫날 섬을 안내해 주고, 늘 초록 앞치마를 두르고 있다.",
      keywords: ["큰 솜털 꼬리", "귀 끝 털", "초록 앞치마", "부지런함"], references: ["청설모보다 다람쥐에 가까운 둥근 얼굴", "가게 앞치마"],
      avoid: ["쥐처럼 보이는 디자인"] },
    palette: { fur: "#C7743E", tail: "#DA8E52", muzzle: "#F6E0C4", innerEar: "#F6E0C4", marking: "#8A4E2A", nose: "#3A2A22", shirt: "#F3E7D3", apron: "#5E8C61", pants: "#6A4A33", ...common },
    proportions: { height: 0.9 }, accessories: ["apron"] },
  { id: "CH-09", slug: "neuru", name: "느루", species: "tortoise", role: "박물관장 · 거북",
    prompt: { concept: "느릿느릿하지만 박식한 거북 박물관장. 화석 이야기만 나오면 눈이 반짝인다. 동그란 안경과 나비넥타이.",
      keywords: ["등껍질", "동그란 안경", "나비넥타이", "느긋함", "학자"], references: ["나이 지긋한 거북 인형", "박물관 큐레이터"],
      avoid: ["늙고 지쳐 보이는 표정"] },
    palette: { fur: "#B7C98A", shell: "#7A9A5A", marking: "#5F7F45", shirt: "#E9E1CF", bowtie: "#B5523B", glasses: "#4A3B32", pants: "#6B6B5A", ...common },
    proportions: { height: 0.95, headScale: 0.94 }, accessories: ["glasses", "bowtie"] },
];

for (const c of CHARS) {
  const path = resolve(dir, `${c.slug}.json`);
  if (existsSync(path)) { console.log("건너뜀 (이미 있음):", c.slug); continue; }
  const spec = {
    id: c.id, slug: c.slug, name: c.name, species: c.species, role: c.role, version: "0.1", status: "review",
    prompt: { ...c.prompt, notes: "" },
    style: { shading: "toon", outline: true, outlineWidth: 0.006 },
    proportions: { height: 1, headScale: 1, bodyWidth: 1, limbLength: 1, earSize: 1, earPointiness: 1, tailLength: 1, eyeSize: 1, eyeSpacing: 1, ...c.proportions },
    palette: c.palette,
    outfit: c.outfit ?? plain,
    markings: "none",
    ...(c.accessories ? { accessories: c.accessories } : {}),
    animations: ["idle", "walk", "run", "happy"],
  };
  writeFileSync(path, JSON.stringify(spec, null, 2) + "\n");
  console.log("저장:", path);
}
