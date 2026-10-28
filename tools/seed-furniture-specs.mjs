// 가구 20종(src/data/items.js 의 furn.*)을 스펙 파일(assets/furniture/specs/<slug>.json)로 만든다. 이미 있는 스펙은 건드리지 않는다.
// 사용: node tools/seed-furniture-specs.mjs [--force]   (--force: 있는 스펙도 다시 쓴다)
// 스펙 모양은 배경 스펙(assets/env/specs)과 같고, 가구용 칸이 더 있다:
//   item      아이템 id (furn.<slug>)
//   footprint [가로, 깊이] 칸 수 — 모델 정면(-Y, 게임 +Z) 기준. 돌리면 바뀐다
//   place     'floor' 바닥 | 'wall' 벽에 건다 | 'window' 창문에 건다 (벽·창문 가구는 모델 원점 = 벽면 바닥, 뒤가 +Y)
//   layer     'rug' 면 다른 가구를 위에 올릴 수 있는 깔개 (부딪히지 않는다)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = resolve(fileURLToPath(new URL("..", import.meta.url)), "assets/furniture/specs");
mkdirSync(dir, { recursive: true });
const force = process.argv.includes("--force");

const scale = { label: "전체 크기", value: 1, min: 0.6, max: 1.4, step: 0.01, live: true };
const num = (label, min, max, value = 1, step = 0.01) => ({ label, value, min, max, step });
const COLORS = (keys, list) => Object.fromEntries(list.map(([id, label, colors], i) => [id, {
  label: i === 0 ? `${label} (기본)` : label,
  palette: colors ? Object.fromEntries([colors].flat().map((c, k) => [[keys].flat()[k], c])) : {},
}]));

// 통나무 공통 색 (껍질·나이테 면·나이테 줄)
const LOG = { bark: "#8C6440", wood: "#E2C08D", ring: "#C29A66" };
const LOG_LABELS = { bark: "나무껍질", wood: "자른 면", ring: "나이테" };

const F = [
  { slug: "log-chair", name: "통나무 의자", footprint: [1, 1],
    concept: "통나무를 잘라 만든 작은 의자. 등받이도 통나무 한 토막이고, 옆에 새싹이 하나 돋아 있다.",
    keywords: ["통나무 토막", "나이테 윗면", "새싹"], references: ["캠핑장 통나무 의자"], avoid: ["매끈하게 깎은 공장 가구"],
    palette: { ...LOG, leaf: "#7FBF5E" }, labels: { ...LOG_LABELS, leaf: "새싹" },
    params: { scale, seatHeight: num("앉는 높이", 0.8, 1.2) }, noOutline: ["ring"] },
  { slug: "log-table", name: "통나무 테이블", footprint: [2, 2],
    concept: "굵은 나무를 둥글게 자른 상판에 뿌리가 뻗은 다리. 위에서 보면 나이테가 크게 보인다.",
    keywords: ["둥근 상판", "나이테 세 줄", "뿌리 다리"], references: ["숲속 오두막 탁자"], avoid: ["네모난 식탁"],
    palette: { ...LOG }, labels: { ...LOG_LABELS }, params: { scale, topSize: num("상판 크기", 0.8, 1.15) }, noOutline: ["ring"] },
  { slug: "wood-bed", name: "나무 침대", footprint: [2, 3],
    concept: "나무 머리판이 달린 포근한 침대. 줄무늬 이불을 덮고 베개가 하나 있다.",
    keywords: ["나무 머리판", "줄무늬 이불", "폭신한 베개"], references: ["그림책 속 아이 침대"], avoid: ["호텔 침대", "철제 침대"],
    palette: { frame: "#C99B68", frameDark: "#8C6440", sheet: "#F7F1E4", pillow: "#FFFDF6", blanket: "#7FC8B8", stripe: "#F7F1E4" },
    labels: { frame: "나무 틀", frameDark: "기둥·다리", sheet: "매트리스", pillow: "베개", blanket: "이불", stripe: "이불 줄무늬" },
    params: { scale }, noOutline: ["stripe"], variants: COLORS("blanket", [["mint", "민트"], ["pink", "분홍", "#F4A6C0"], ["yellow", "노랑", "#F6D35C"], ["blue", "파랑", "#7FA8E6"]]) },
  { slug: "campfire", name: "모닥불", footprint: [1, 1],
    concept: "돌로 둘러싼 작은 모닥불. 집 안에서도 밖에서도 피울 수 있고 불꽃이 일렁인다.",
    keywords: ["돌 아홉 개", "장작 셋", "두 겹 불꽃"], references: ["캠핑장 모닥불"], avoid: ["무섭게 큰 불"],
    palette: { rock: "#A49E92", bark: "#8C6440", flame: "#F39A3B", flameCore: "#F7E6A8" }, labels: { rock: "돌", bark: "장작", flame: "불꽃", flameCore: "불꽃 속" },
    params: { scale }, flat: ["flame", "flameCore"], animations: ["flicker"] },
  { slug: "woodpile", name: "장작더미", footprint: [1, 1],
    concept: "통나무 여섯 개를 세모로 쌓은 장작더미. 자른 면이 앞을 본다.",
    keywords: ["3-2-1 쌓기", "나이테 앞면", "받침 말뚝"], references: ["시골집 처마 밑 장작"], avoid: ["어지럽게 흩어진 나무"],
    palette: { ...LOG }, labels: { ...LOG_LABELS }, params: { scale }, noOutline: ["ring"] },
  { slug: "floor-lamp", name: "스탠드 조명", footprint: [1, 1],
    concept: "갓이 달린 키 큰 스탠드. 밤이 되면 갓 아래 전구가 따뜻하게 빛난다.",
    keywords: ["원뿔 갓", "가는 기둥", "둥근 받침"], references: ["북유럽 거실 스탠드"], avoid: ["차가운 형광등"],
    palette: { base: "#8C6440", shade: "#F7E3B5", trim: "#C99B68", glow: "#FFE7A8" }, labels: { base: "받침·기둥", shade: "갓", trim: "갓 테두리", glow: "전구" },
    params: { scale, height: num("높이", 0.85, 1.15) }, flat: ["glow"],
    variants: COLORS("shade", [["cream", "크림"], ["mint", "민트", "#BFE3D6"], ["pink", "분홍", "#F7C6D6"], ["blue", "파랑", "#C6D9F2"]]) },
  { slug: "plant-pot", name: "화분", footprint: [1, 1],
    concept: "토분에 심은 잎 큰 관엽식물. 잎 일곱 장이 위로 퍼진다.",
    keywords: ["토분", "흙", "넓은 잎 7장"], references: ["창가의 관엽식물"], avoid: ["가시 많은 선인장"],
    palette: { pot: "#D9875C", potDark: "#B86A44", soil: "#6B4A33", leaf: "#5FAE5A", leafLight: "#8CCB6E" },
    labels: { pot: "화분", potDark: "화분 테", soil: "흙", leaf: "잎", leafLight: "밝은 잎" },
    params: { scale }, variants: COLORS("pot", [["terracotta", "토분"], ["white", "하양", "#F2EEE6"], ["blue", "파랑", "#7FA8E6"]]) },
  { slug: "round-rug", name: "동그란 러그", footprint: [3, 3], layer: "rug",
    concept: "바닥에 까는 동그란 러그. 가운데와 테두리에 다른 색 동그라미 무늬가 있다. 위에 다른 가구를 올릴 수 있다.",
    keywords: ["납작한 원", "동심원 무늬", "물결 테두리"], references: ["손으로 짠 둥근 러그"], avoid: ["복잡한 페르시아 무늬"],
    palette: { rug: "#F2B36B", rugAccent: "#F7F1E4", rugDot: "#E8726A" }, labels: { rug: "바탕", rugAccent: "무늬", rugDot: "물결 테두리" },
    params: { scale }, outline: 0.006, noOutline: ["rugAccent"],
    variants: COLORS(["rug", "rugDot"], [["orange", "주황"], ["mint", "민트", ["#7FC8B8", "#4E9A8C"]], ["pink", "분홍", ["#F4A6C0", "#D9728F"]], ["blue", "파랑", ["#7FA8E6", "#4E6FB0"]]]) },
  { slug: "bookshelf", name: "책장", footprint: [2, 1],
    concept: "세 칸짜리 나무 책장. 알록달록한 책이 꽂혀 있고 몇 권은 기울어져 있다.",
    keywords: ["세 칸", "알록달록 책", "기울어진 책"], references: ["동네 도서관 책장"], avoid: ["텅 빈 선반"],
    palette: { wood: "#C99B68", woodDark: "#8C6440", bookRed: "#E8726A", bookBlue: "#6CA0DC", bookGreen: "#7FBF5E", bookYellow: "#F6C84C", bookPink: "#F4A6C0" },
    labels: { wood: "나무", woodDark: "뒤판·받침", bookRed: "책 빨강", bookBlue: "책 파랑", bookGreen: "책 초록", bookYellow: "책 노랑", bookPink: "책 분홍" },
    params: { scale, seed: num("책 꽂힘 번호", 1, 9, 4, 1) }, outline: 0.008 },
  { slug: "radio", name: "라디오", footprint: [1, 1],
    concept: "작은 협탁 위의 레트로 라디오. 손잡이와 안테나가 있고 켜면 음악이 나온다.",
    keywords: ["둥근 모서리 상자", "스피커 망", "다이얼", "안테나"], references: ["1960년대 휴대용 라디오"], avoid: ["최신 스피커"],
    palette: { radio: "#7FC8B8", grille: "#F7F1E4", grilleLine: "#C9BFA9", dial: "#FFF3C9", knob: "#8C6440", metal: "#B8B2A6", wood: "#C99B68", woodDark: "#8C6440" },
    labels: { radio: "몸통", grille: "스피커 망", grilleLine: "망 줄·바늘", dial: "다이얼 창", knob: "손잡이·단추", metal: "안테나", wood: "협탁 상판", woodDark: "협탁 다리" },
    params: { scale }, noOutline: ["dial", "grilleLine"],
    variants: COLORS("radio", [["mint", "민트"], ["red", "빨강", "#E8726A"], ["yellow", "노랑", "#F6C84C"]]) },
  { slug: "sofa", name: "소파", footprint: [2, 1],
    concept: "두 사람이 앉는 폭신한 소파. 둥근 팔걸이와 방석 두 개.",
    keywords: ["둥근 팔걸이", "방석 둘", "짧은 다리"], references: ["할머니 댁 거실 소파"], avoid: ["딱딱한 가죽 소파"],
    palette: { fabric: "#E8913A", cushion: "#F2B36B", leg: "#8C6440" }, labels: { fabric: "천", cushion: "방석", leg: "다리" },
    params: { scale },
    variants: COLORS(["fabric", "cushion"], [["orange", "주황"], ["green", "초록", ["#6E9E5A", "#8CCB6E"]], ["blue", "파랑", ["#5A7FBF", "#7FA8E6"]], ["pink", "분홍", ["#D9728F", "#F4A6C0"]]]) },
  { slug: "wardrobe", name: "옷장", footprint: [2, 1],
    concept: "문 두 짝짜리 키 큰 나무 옷장. 문에 네모 장식과 둥근 손잡이.",
    keywords: ["두 짝 문", "네모 장식", "위 장식 띠"], references: ["시골집 나무 옷장"], avoid: ["거울 붙은 붙박이장"],
    palette: { wood: "#C99B68", woodDark: "#8C6440", door: "#D9B382", knob: "#F6C84C" }, labels: { wood: "몸통", woodDark: "띠·받침", door: "문", knob: "손잡이" },
    params: { scale } },
  { slug: "wall-clock", name: "벽시계", footprint: [1, 1], place: "wall",
    concept: "벽에 거는 둥근 나무 시계. 바늘은 게임 시각을 그대로 가리킨다.",
    keywords: ["둥근 나무 테", "눈금 12개", "잎사귀 장식"], references: ["교실 벽시계"], avoid: ["전자시계 숫자"],
    palette: { wood: "#C99B68", face: "#FFF8E6", tick: "#8C6440", hand: "#4A3B32", leaf: "#7FBF5E" }, labels: { wood: "테", face: "시계판", tick: "눈금", hand: "바늘", leaf: "잎 장식" },
    params: { scale }, noOutline: ["face", "tick", "hand"], outline: 0.008 },
  { slug: "fish-tank", name: "어항", footprint: [1, 1],
    concept: "나무 받침 위 네모 어항. 물풀과 물고기 한 마리, 보글보글 공기 방울.",
    keywords: ["유리 테두리", "물풀", "물고기", "공기 방울"], references: ["교실 뒤 어항"], avoid: ["거대한 수족관"],
    palette: { wood: "#C99B68", woodDark: "#8C6440", frame: "#6B7F86", tankWater: "#9ED6E8", gravel: "#E2D2AE", seaweed: "#5FAE5A", fish: "#F39A3B", bubble: "#F2FBFF", glint: "#FFFFFF" },
    labels: { wood: "받침", woodDark: "받침 문", frame: "어항 테", tankWater: "물", gravel: "모래", seaweed: "물풀", fish: "물고기", bubble: "공기 방울", glint: "유리 반짝임" },
    params: { scale }, noOutline: ["bubble", "glint", "gravel", "tankWater"], flat: ["glint"], outline: 0.008 },
  { slug: "bug-case", name: "곤충 상자", footprint: [1, 1],
    concept: "나무 받침 위 유리 상자. 나뭇가지와 잎 위에 장수풍뎅이 한 마리.",
    keywords: ["나무 테 유리 상자", "나뭇가지", "풍뎅이"], references: ["곤충 채집 상자"], avoid: ["징그러운 벌레 표현"],
    palette: { wood: "#C99B68", woodDark: "#8C6440", caseBack: "#E6F3DC", soil: "#7A5A3E", twig: "#D9B382", leaf: "#7FBF5E", bug: "#4A3428", bugShine: "#B88C66", glint: "#FFFFFF" },
    labels: { wood: "테·받침", woodDark: "받침 문", caseBack: "뒤판", soil: "흙", twig: "나뭇가지", leaf: "잎", bug: "풍뎅이", bugShine: "풍뎅이 빛", glint: "유리 반짝임" },
    params: { scale }, noOutline: ["glint", "bugShine"], flat: ["glint"], outline: 0.008 },
  { slug: "picture-frame", name: "액자", footprint: [1, 1], place: "wall",
    concept: "주민이 선물한 그림 액자. 언덕과 해가 있는 섬 풍경 그림.",
    keywords: ["나무 액자", "언덕 그림", "걸이 끈"], references: ["거실 풍경화"], avoid: ["어두운 유화"],
    palette: { frame: "#B98957", canvasSky: "#BFE6F7", canvasHill: "#8CCB6E", canvasHill2: "#5FAE5A", canvasSun: "#F6C84C", canvasCloud: "#FFFFFF", string: "#8C6440" },
    labels: { frame: "액자 테", canvasSky: "하늘", canvasHill: "언덕", canvasHill2: "뒷언덕", canvasSun: "해", canvasCloud: "구름", string: "걸이 끈" },
    params: { scale }, noOutline: ["canvasSky", "canvasHill", "canvasHill2", "canvasSun", "canvasCloud", "string"], outline: 0.008 },
  { slug: "villager-photo", name: "주민 사진", footprint: [1, 1],
    concept: "아주 친해진 주민이 준 사진. 작은 협탁 위 사진틀에 주민 얼굴이 웃고 있다.",
    keywords: ["사진틀", "웃는 얼굴", "작은 협탁"], references: ["책상 위 가족사진"], avoid: ["실제 사람 사진"],
    palette: { frame: "#F7F1E4", photoBg: "#BFE6F7", photoFace: "#F2B36B", ink: "#4A3B32", wood: "#C99B68", woodDark: "#8C6440" },
    labels: { frame: "사진틀", photoBg: "사진 배경", photoFace: "주민 얼굴", ink: "눈", wood: "협탁 상판", woodDark: "협탁 다리" },
    params: { scale }, noOutline: ["photoBg", "photoFace", "ink"], outline: 0.008,
    variants: COLORS("photoFace", [["coco", "코코"], ["bori", "보리", "#6CA0DC"], ["mochi", "모찌", "#B9A6E0"], ["dubu", "두부", "#7FA36B"], ["pong", "퐁", "#FFD866"], ["chorong", "초롱", "#8CCB6E"]]) },
  { slug: "shell-curtain", name: "조개 커튼", footprint: [1, 1], place: "window",
    concept: "조개 여섯 개로 만든 창문 커튼. 막대에 실을 늘어뜨려 조개와 구슬을 꿰었다.",
    keywords: ["막대", "실 일곱 줄", "파스텔 조개", "구슬"], references: ["바닷가 집 조개 발"], avoid: ["무거운 천 커튼"],
    palette: { rod: "#B98957", string: "#E2D2AE", shellA: "#F9D9C4", shellB: "#F7C6D6", shellC: "#F7F3EE", bead: "#7FC8B8" },
    labels: { rod: "막대", string: "실", shellA: "조개 살구", shellB: "조개 분홍", shellC: "조개 하양", bead: "구슬" },
    params: { scale }, noOutline: ["string", "bead"], outline: 0.006 },
  { slug: "fruit-chair", name: "과일 의자", footprint: [1, 1],
    concept: "과일 열 개로 만든 커다란 과일 모양 의자. 속살 방석과 꼭지·잎이 달려 있다.",
    keywords: ["반쯤 잘린 과일", "속살 방석", "꼭지와 잎"], references: ["동화 속 사과 의자"], avoid: ["진짜 과일처럼 사실적인 것"],
    palette: { fruit: "#E8504F", flesh: "#FFF1D6", seed: "#6B4A33", stem: "#8C6440", leaf: "#5FAE5A" }, labels: { fruit: "껍질", flesh: "속살", seed: "씨", stem: "꼭지", leaf: "잎" },
    params: { scale }, noOutline: ["seed"],
    variants: COLORS(["fruit", "flesh"], [["apple", "사과"], ["orange", "오렌지", ["#F39A3B", "#FFD08A"]], ["pear", "배", ["#D9D36A", "#FBF4D6"]], ["peach", "복숭아", ["#F7A6A0", "#FFE3D2"]], ["cherry", "체리", ["#B5232F", "#F5C5C9"]]]) },
  { slug: "dino-model", name: "공룡 모형", footprint: [2, 2],
    concept: "박물관을 다 채운 선물. 받침대 위 목 긴 공룡 뼈 모형과 이름표.",
    keywords: ["목 긴 공룡", "갈비뼈", "받침대", "이름표"], references: ["자연사 박물관 공룡 뼈"], avoid: ["무서운 육식 공룡"],
    palette: { bone: "#EFE3C8", boneDark: "#C9B48F", pedestal: "#8C6440", pedestalTop: "#C99B68", metal: "#8E9A9C", plaque: "#F6C84C" },
    labels: { bone: "뼈", boneDark: "뼈 그늘", pedestal: "받침대", pedestalTop: "받침 윗면", metal: "지지대", plaque: "이름표" },
    params: { scale }, outline: 0.008, noOutline: ["boneDark"] },
];

// items.js 의 FURN 순서 = 아이템 code(FU-01 ~)
const ORDER = ["log-chair", "log-table", "wood-bed", "campfire", "woodpile", "floor-lamp", "plant-pot", "round-rug", "bookshelf", "radio", "sofa",
  "wardrobe", "wall-clock", "fish-tank", "bug-case", "picture-frame", "villager-photo", "shell-curtain", "fruit-chair", "dino-model"];

for (const e of F) {
  const path = resolve(dir, `${e.slug}.json`);
  if (existsSync(path) && !force) { console.log("건너뜀 (이미 있음):", e.slug); continue; }
  const i = ORDER.indexOf(e.slug);
  if (i < 0) throw new Error(`아이템 목록에 없는 가구: ${e.slug}`);
  const spec = {
    id: `FU-${String(i + 1).padStart(2, "0")}`, slug: e.slug, item: `furn.${e.slug}`, name: e.name, category: "furniture", kind: e.slug,
    version: "0.1", status: "review",
    prompt: { concept: e.concept, keywords: e.keywords, references: e.references, avoid: e.avoid, notes: "" },
    style: { shading: "toon", outline: true, outlineWidth: e.outline ?? 0.01, ...(e.flat ? { flat: e.flat } : {}), ...(e.noOutline ? { noOutline: e.noOutline } : {}) },
    params: e.params, palette: e.palette, paletteLabels: e.labels,
    ...(e.variants ? { variants: e.variants } : {}),
    footprint: e.footprint, place: e.place ?? "floor", ...(e.layer ? { layer: e.layer } : {}),
    animations: e.animations ?? [],
  };
  writeFileSync(path, JSON.stringify(spec, null, 2) + "\n");
  console.log("저장:", spec.id, e.slug);
}
