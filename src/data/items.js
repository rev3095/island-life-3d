// 아이템 사전. 원본은 concept/concept-board.html 의 FISH·BUGS·FOSSILS·MATS·TOOLS·FURN 표.
// 표 값(이름·장소·시간·계절·가격)은 그대로 두고, 게임에서 쓰기 좋은 칸(habitats, hours, months …)을 덧붙인다.
// price = 파는 값(도토리), buy = 상점에서 살 때 값.

export const CATEGORIES = ['fish', 'bug', 'fossil', 'fruit', 'shell', 'flower', 'mat', 'tool', 'furn', 'seed'];
export const CATEGORY_NAMES = { fish: '물고기', bug: '곤충', fossil: '화석', fruit: '과일', shell: '조개', flower: '꽃', mat: '재료', tool: '도구', furn: '가구', seed: '씨앗·묘목' };

/** 한 칸에 쌓이는 최대 개수 (아이템에 stack 이 있으면 그 값) */
export const STACK = { fish: 1, bug: 1, fossil: 1, fruit: 10, shell: 10, flower: 10, mat: 30, tool: 1, furn: 1, seed: 10 };

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** 계절 표기 → 달 목록 */
export const SEASON_MONTHS = {
  '연중': range(1, 12), '봄': [3, 4, 5], '여름': [6, 7, 8], '가을': [9, 10, 11], '겨울': [12, 1, 2],
  '봄~가을': range(3, 11), '봄~여름': range(3, 8), '여름~가을': range(6, 11), '겨울~봄': [12, 1, 2, 3, 4, 5],
  '봄·가을': [3, 4, 5, 9, 10, 11], '초여름': [6],
};
/** 시간 표기 → [시작, 끝) 시각 구간. 낮 = 새벽~저녁(5~19시), 밤 = 저녁~새벽(17~5시). 저녁엔 둘 다 나온다 */
export const TIME_HOURS = { '종일': [[0, 24]], '낮': [[5, 19]], '밤': [[17, 24], [0, 5]], '비 올 때': [[0, 24]] };
/** 물고기 장소 표기 → 서식지. 하구는 강 끝이라 강으로도 친다 */
const FISH_PLACE = { '강': ['river'], '연못': ['pond'], '강 · 연못': ['river', 'pond'], '하구': ['river', 'mouth'], '바다': ['sea'], '선착장': ['pier'] };
/** 곤충 장소 표기 → 계약의 place 값 ('shake' 는 나무 흔들기 때만, 'under' 는 바위를 칠 때만 — 4차 Y2) */
const BUG_PLACE = {
  '꽃 주변': ['flower'], '꽃 위': ['flower'], '나무 흔들기': ['shake'], '공중': ['air'], '물가 공중': ['water'], '나무 줄기': ['tree'],
  '야자수': ['palm'], '풀밭': ['ground'], '떨어진 과일': ['fruit'], '바위': ['rock'], '바위 밑': ['under'], '강 위': ['water'], '가로등·창문': ['lamp'],
};

/** 출현 가중치: 희귀 1, 비쌀수록 드묾 */
const weightOf = (price, rare) => (rare ? 1 : price >= 1000 ? 3 : price >= 400 ? 6 : 10);

// ---------- 물고기 (FI-01 ~ FI-20): 이름, 장소, 시간, 계절, 그림자, 가격, 희귀 ----------
const FISH = [
  ['crucian', '붕어', '강', '종일', '연중', 2, 160, 0, '🐟', '어디서나 흔하게 잡히는 강의 터줏대감. 넓적한 몸에 은빛 비늘이 반짝인다.'],
  ['pale-chub', '피라미', '강', '종일', '연중', 1, 200, 0, '🐟', '물살 빠른 여울을 좋아하는 날쌘 물고기. 여름이면 수컷 몸에 무지갯빛이 돈다.'],
  ['medaka', '송사리', '강', '종일', '봄~가을', 1, 300, 0, '🐟', '손가락 한 마디만 한 작은 물고기. 떼 지어 다니며 물 위를 톡톡 건드린다.'],
  ['carp', '잉어', '강 · 연못', '종일', '연중', 4, 300, 0, '🐟', '입가에 수염이 두 쌍 달린 큰 물고기. 오래 살수록 몸이 묵직해진다.'],
  ['loach', '미꾸라지', '강', '종일', '봄~여름', 2, 400, 0, '🐟', '진흙 바닥에 숨어 사는 미끌미끌한 물고기. 손으로 잡으면 쏙 빠져나간다.'],
  ['sweetfish', '은어', '강', '낮', '여름', 3, 900, 0, '🐟', '맑은 여름 강에만 찾아오는 물고기. 몸에서 수박 같은 향이 난다고 한다.'],
  ['catfish', '메기', '연못', '밤', '여름~가을', 4, 800, 0, '🐟', '넓은 입과 긴 수염으로 밤 연못 바닥을 더듬는다. 비 오기 전이면 유난히 바쁘다.'],
  ['mandarin-fish', '쏘가리', '강', '밤', '연중', 3, 1000, 0, '🐟', '표범 같은 무늬를 두른 강의 사냥꾼. 바위 틈에 숨어 먹이를 기다린다.'],
  ['salmon', '연어', '하구', '종일', '가을', 5, 700, 0, '🐟', '가을이면 태어난 강으로 돌아오는 여행자. 거센 물살도 힘차게 거슬러 오른다.'],
  ['goldfish', '금붕어', '연못', '종일', '연중', 1, 1300, 1, '🐠', '누군가 연못에 놓아준 걸까? 하늘하늘한 지느러미로 춤을 춘다.'],
  ['snakehead', '가물치', '연못', '밤', '여름', 5, 5500, 1, '🐟', '연못 바닥의 무법자. 물 밖에서도 한참을 버티는 끈질긴 물고기다.'],
  ['horse-mackerel', '전갱이', '바다', '종일', '연중', 2, 150, 0, '🐟', '선착장 아래를 무리 지어 도는 바다 물고기. 꼬리 쪽 단단한 비늘이 특징이다.'],
  ['mackerel', '고등어', '바다', '종일', '연중', 3, 150, 0, '🐟', '등에 푸른 물결무늬가 있는 바다의 단골손님. 굽는 냄새가 섬을 가득 채운다.'],
  ['flounder', '광어', '바다', '종일', '연중', 4, 800, 0, '🐟', '두 눈이 한쪽에 몰린 납작한 물고기. 모래 바닥에 몸을 묻고 숨어 있다.'],
  ['squid', '오징어', '바다', '종일', '겨울~봄', 3, 500, 0, '🦑', '다리가 열 개인 바다의 재주꾼. 놀라면 먹물을 뿜고 사라진다.'],
  ['octopus', '문어', '바다', '종일', '연중', 3, 1200, 0, '🐙', '다리 여덟 개로 무엇이든 붙잡는 똑똑한 친구. 병뚜껑도 연다는 소문이 있다.'],
  ['seahorse', '해마', '바다', '종일', '봄~가을', 1, 1100, 0, '🐟', '말을 닮은 얼굴로 꼿꼿이 서서 헤엄친다. 알은 아빠가 배 주머니에 품는다.'],
  ['sea-bream', '도미', '바다', '종일', '연중', 4, 3000, 0, '🐟', '분홍빛 몸이 고운 바다의 귀한 손님. 잔칫날이면 꼭 찾는 물고기다.'],
  ['tuna', '참치', '선착장', '종일', '겨울', 6, 7000, 1, '🐟', '쉬지 않고 바다를 가로지르는 커다란 물고기. 선착장 끝에서 운이 좋아야 만난다.'],
  ['shark', '상어', '바다', '밤', '여름', 6, 15000, 1, '🦈', '여름밤 바다에 커다란 등지느러미가 보이면 이 녀석이다. 낚싯줄을 꽉 잡자!'],
];

// ---------- 곤충 (BU-01 ~ BU-20): 이름, 장소, 시간, 계절, 가격, 희귀, 날아다님 ----------
const BUGS = [
  ['cabbage-white', '배추흰나비', '꽃 주변', '낮', '봄~가을', 160, 0, 1, '🦋', '하얀 날개에 까만 점 몇 개. 봄 들판을 가장 먼저 날아다닌다.'],
  ['swallowtail', '호랑나비', '꽃 주변', '낮', '봄~여름', 240, 0, 1, '🦋', '호랑이 무늬 날개를 펄럭이는 큰 나비. 꽃 사이를 우아하게 미끄러진다.'],
  ['yellow-butterfly', '노랑나비', '꽃 주변', '낮', '봄', 160, 0, 1, '🦋', '봄 햇살을 닮은 노란 나비. 낮게 날아서 잡기 쉬운 편이다.'],
  ['ladybug', '무당벌레', '꽃 위', '낮', '봄·가을', 200, 0, 0, '🐞', '빨간 등에 까만 점박이. 진딧물을 먹어 주는 꽃밭의 친구다.'],
  ['honeybee', '꿀벌', '나무 흔들기', '낮', '연중', 2500, 0, 1, '🐝', '나무를 흔들면 벌집과 함께 쏟아진다. 화가 나기 전에 재빨리 잡자!'],
  ['red-dragonfly', '고추잠자리', '공중', '낮', '가을', 180, 0, 1, '🪰', '가을 하늘을 빨갛게 물들이는 잠자리. 장대 끝에 즐겨 앉는다.'],
  ['skimmer', '밀잠자리', '물가 공중', '낮', '여름', 230, 0, 1, '🪰', '물가를 순찰하듯 오가는 잠자리. 수컷은 몸이 푸르스름하다.'],
  ['cicada', '매미', '나무 줄기', '낮', '여름', 250, 0, 0, '🪲', '여름 내내 나무에 붙어 맴맴 노래한다. 땅속에서 몇 해를 기다렸다 나온 가수.'],
  ['firefly', '반딧불이', '물가 공중', '밤', '초여름', 1600, 1, 1, '✨', '초여름 밤 물가에 작은 불빛을 켠다. 깨끗한 물이 있는 곳에만 산다.'],
  ['rhino-beetle', '장수풍뎅이', '나무 줄기', '밤', '여름', 1350, 0, 0, '🪲', '이마의 큰 뿔이 자랑인 힘센 곤충. 밤마다 나무즙을 먹으러 온다.'],
  ['stag-beetle', '사슴벌레', '야자수', '밤', '여름', 8000, 1, 0, '🪲', '사슴뿔 같은 큰 턱을 가진 귀한 곤충. 야자수에 몰래 붙어 있다.'],
  ['mantis', '사마귀', '꽃 위', '낮', '봄~가을', 430, 0, 0, '🦗', '앞발을 모으고 꽃 위에서 기도하듯 기다린다. 사실은 사냥하는 중이다.'],
  ['grasshopper', '메뚜기', '풀밭', '낮', '여름~가을', 160, 0, 0, '🦗', '풀밭에서 톡 튀어 오르는 점프 선수. 다가가면 금세 멀리 뛴다.'],
  ['cricket', '귀뚜라미', '풀밭', '밤', '가을', 130, 0, 0, '🦗', '가을밤 풀숲에서 또르르 운다. 날개를 비벼서 소리를 낸다.'],
  ['bell-cricket', '방울벌레', '풀밭', '밤', '가을', 430, 0, 0, '🦗', '작은 방울을 흔드는 듯 맑게 우는 곤충. 소리는 들려도 모습은 잘 안 보인다.'],
  ['ant', '개미', '떨어진 과일', '종일', '연중', 80, 0, 0, '🐜', '떨어진 과일 냄새를 맡고 줄지어 온다. 자기보다 무거운 것도 거뜬히 든다.'],
  ['snail', '달팽이', '바위', '비 올 때', '연중', 250, 0, 0, '🐌', '비 오는 날 바위 위로 느릿느릿 산책을 나온다. 집을 등에 지고 다닌다.'],
  ['pill-bug', '쥐며느리', '바위 밑', '종일', '연중', 250, 0, 0, '🪲', '바위를 들추면 동그랗게 몸을 마는 작은 친구. 축축한 곳을 좋아한다.'],
  ['pond-skater', '소금쟁이', '강 위', '낮', '여름', 130, 0, 0, '🦟', '긴 다리로 물 위를 미끄러지듯 걷는다. 물에 빠지지 않는 신기한 곤충이다.'],
  ['moth', '나방', '가로등·창문', '밤', '연중', 130, 0, 1, '🦋', '밤이면 가로등과 창문 불빛으로 모여든다. 날개에 고운 가루가 묻어 있다.'],
  // 4차 Y2: 들추기 곤충 (나무를 흔들면 떨어지고, 바위를 치면 밑에서 튀어나온다)
  ['caterpillar', '송충이', '나무 흔들기', '종일', '봄~가을', 300, 0, 0, '🐛', '나뭇잎을 갉아 먹다가 흔들리면 실을 타고 툭 떨어진다. 언젠가 날개를 달 날을 꿈꾼다.'],
  ['earwig', '집게벌레', '바위 밑', '밤', '봄~가을', 450, 0, 0, '🪲', '꽁무니에 작은 집게를 단 밤 손님. 무섭게 생겼지만 사실은 겁이 많다.'],
];

// ---------- 화석 (FO-01 ~ FO-08): 이름, 가격, 희귀 ----------
const FOSSILS = [
  ['ammonite', '암모나이트', 1100, 0, '🐚', '소용돌이 껍데기를 가진 옛 바다 생물. 공룡보다도 먼저 바다를 누볐다.'],
  ['trilobite', '삼엽충', 1300, 0, '🪨', '몸이 세 갈래로 나뉜 아주 오래된 바다 생물. 둥글게 몸을 말 수 있었다.'],
  ['amber', '호박', 1200, 0, '🟠', '나뭇진이 굳어 생긴 노란 보석. 안에 작은 벌레가 갇혀 있기도 하다.'],
  ['fern-fossil', '고사리 화석', 1000, 0, '🌿', '바위에 찍힌 아주 오래된 고사리 잎. 잎맥 하나하나가 또렷하다.'],
  ['shark-tooth', '상어 이빨', 1000, 0, '🦷', '옛 바다를 지배한 큰 상어의 이빨. 이빨 하나가 손바닥만 하다.'],
  ['dino-track', '공룡 발자국', 1500, 0, '🐾', '진흙 위를 걸어간 공룡이 남긴 커다란 발자국. 세 발가락 자국이 선명하다.'],
  ['mammoth-tusk', '매머드 엄니', 2500, 0, '🦣', '털북숭이 코끼리의 휘어진 엄니. 추운 시대를 견뎌 낸 흔적이다.'],
  ['dino-skull', '공룡 두개골', 6000, 1, '🦖', '거대한 공룡의 머리뼈. 박물관 한가운데에 놓일 섬의 보물이다.'],
];

// 감정 전 화석 (4차 Y2): 화석 자리를 파면 이것이 나오고, 박물관 느루가 감정하면 위 8종 중 하나가 된다.
// 카테고리는 화석이지만 list('fossil')·박물관·도감에는 들어가지 않는다 (unknown: true). 상점에선 싸게 팔린다.
export const UNKNOWN_FOSSIL = 'fossil.unknown';

// 물고기 몸 색 (잡아서 들어 보일 때): 몸·등·배·지느러미. 모양은 모두 같고 색만 다르다
const FISH_COLORS = {
  crucian: ['#A9B49A', '#7D8A6E', '#E8E6D2', '#8E9A7E'], 'pale-chub': ['#B8C8D2', '#7E98A8', '#F4F2EA', '#E8907A'],
  medaka: ['#D9D2B0', '#B4AA80', '#F6F2DE', '#C9BE92'], carp: ['#C9A062', '#8C6A3A', '#EEDDB4', '#B0844A'],
  loach: ['#9A8462', '#6E5A40', '#D8C8A4', '#857050'], sweetfish: ['#B5C9AE', '#7E9A86', '#F2F0DC', '#E8C45A'],
  catfish: ['#6E6650', '#4A4436', '#C8C0A4', '#5A5242'], 'mandarin-fish': ['#BFA25E', '#6E5A30', '#EADCAE', '#9C7E40'],
  salmon: ['#E58C6C', '#7E8E98', '#F6E2D2', '#C86A50'], goldfish: ['#F28A36', '#E0602A', '#FBD9A8', '#F7B26A'],
  snakehead: ['#605A48', '#3E3A2E', '#B8AE8E', '#4E4838'], 'horse-mackerel': ['#A9BAC4', '#6E8698', '#F2F4F2', '#D8C26A'],
  mackerel: ['#6F9DB4', '#3E6A86', '#F0F2EE', '#5A88A0'], flounder: ['#B39C80', '#8A735A', '#F4EEE2', '#9C8468'],
  squid: ['#F2E4D6', '#E2B8A0', '#FAF4EC', '#ECCDB8'], octopus: ['#D8605A', '#B84A46', '#F0A49A', '#C85650'],
  seahorse: ['#F2B262', '#D88E3E', '#F8D69C', '#E8A050'], 'sea-bream': ['#F2A2AA', '#E07A86', '#FBE4E2', '#E88A94'],
  tuna: ['#4F6C8C', '#2E4560', '#DCE4EA', '#E8C04A'], shark: ['#7E8F9C', '#5E6E7C', '#EEF0EE', '#6E808E'],
};

// ---------- 과일 (MA-01, MA-02) ----------
// 섬 특산 과일(economy.nativeFruit)은 100, 나머지는 500. variant = 배경 fruit-tree 변형 이름
const FRUITS = [
  ['apple', '사과', '🍎', 500, 'apple'], ['pear', '배', '🍐', 500, 'pear'], ['peach', '복숭아', '🍑', 500, 'peach'],
  ['cherry', '체리', '🍒', 500, 'cherry'], ['orange', '오렌지', '🍊', 500, 'orange'], ['coconut', '야자열매', '🥥', 250, null],
];

// ---------- 조개 (MA-07, 6종): 이름, 가격, 해변 출현 가중치, 배경 shell 변형 ----------
const SHELLS = [
  ['clam', '바지락', '🐚', 60, 30, 'white'], ['cowrie', '개오지', '🐚', 60, 30, 'white'], ['scallop', '가리비', '🐚', 120, 20, 'peach'],
  ['whelk', '고둥', '🐚', 100, 15, 'white'], ['turban', '소라', '🐚', 200, 10, 'peach'], ['coral', '분홍 산호', '🪸', 500, 4, 'pink'],
];

// ---------- 꽃 (PR-06: 튤립·코스모스·팬지 × 색 4). 씨앗에서는 앞의 3색, 마지막 색은 교배로만 핀다 ----------
const FLOWERS = [
  ['tulip', '튤립', '🌷', [['red', '빨강'], ['yellow', '노랑'], ['white', '하양'], ['pink', '분홍']]],
  ['cosmos', '코스모스', '🌸', [['pink', '분홍'], ['white', '하양'], ['orange', '주황'], ['red', '빨강']]],
  ['pansy', '팬지', '🌼', [['purple', '보라'], ['yellow', '노랑'], ['blue', '파랑'], ['orange', '주황']]],
];

// ---------- 재료 (MA-03 ~ MA-06, MA-08) ----------
const MATS = [
  ['wood', '나무', '🪵', 60, '나무를 도끼로'], ['hardwood', '단단한 나무', '🪵', 60, '나무를 도끼로'], ['branch', '나뭇가지', '🌿', 5, '나무 흔들기'],
  ['stone', '돌', '🪨', 75, '바위를 도끼로'], ['iron', '철광석', '⛓️', 375, '바위를 도끼로'], ['clay', '점토', '🟤', 100, '바위를 도끼로'],
  ['weed', '잡초', '🌱', 10, '뽑기'],
];

// ---------- 도구 (TL-01 ~ TL-05): 이름, 용도, 얻는 법, 내구도(쓸 수 있는 횟수), 상점 값 ----------
const TOOLS = [
  ['rod', '낚싯대', '🎣', '물가에서 찌 던지기', '시작 지급', 30, 400],
  ['net', '잠자리채', '🥅', '곤충 잡기', '시작 지급', 30, 400],
  ['shovel', '삽', '⛏️', '화석 파기 · 나무 심기', '상점 800 / 제작: 나무 5', 40, 800],
  ['axe', '도끼', '🪓', '나무 베기 · 바위 치기', '상점 800 / 제작: 나뭇가지 5 + 돌 1', 60, 800],
  ['can', '물뿌리개', '🚿', '꽃에 물 주기 → 새 꽃 번식', '상점 800 / 제작: 나무 5', 40, 800],
];

// ---------- 가구 (FU-01 ~ FU-20): 이름, 크기, 얻는 법, 아이콘, 판매가, 상점가, 놓는 곳 ----------
// 얻는 법(source): craft 제작, shop 상점, gift 주민 선물, friend 친밀도, museum 박물관 보상
const FURN = [
  ['log-chair', '통나무 의자', '1×1', '제작', '🪑', 240, 0, 'craft'],
  ['log-table', '통나무 테이블', '2×2', '제작', '🪵', 480, 0, 'craft'],
  ['wood-bed', '나무 침대', '2×3', '제작', '🛏️', 600, 0, 'craft'],
  ['campfire', '모닥불', '1×1', '제작 (야외 가능)', '🔥', 120, 0, 'craft'],
  ['woodpile', '장작더미', '1×1', '제작', '🪵', 360, 0, 'craft'],
  ['floor-lamp', '스탠드 조명', '1×1', '상점', '💡', 300, 1200, 'shop'],
  ['plant-pot', '화분', '1×1', '상점', '🪴', 200, 800, 'shop'],
  ['round-rug', '동그란 러그', '3×3', '상점', '⭕', 375, 1500, 'shop'],
  ['bookshelf', '책장', '2×1', '상점', '📚', 600, 2400, 'shop'],
  ['radio', '라디오', '1×1', '상점 · BGM 재생', '📻', 500, 2000, 'shop'],
  ['sofa', '소파', '2×1', '상점', '🛋️', 750, 3000, 'shop'],
  ['wardrobe', '옷장', '2×1', '상점', '🚪', 700, 2800, 'shop'],
  ['wall-clock', '벽시계', '벽', '상점', '🕰️', 350, 1400, 'shop'],
  ['fish-tank', '어항', '1×1', '물고기를 넣어 장식', '🐠', 400, 0, 'craft'],
  ['bug-case', '곤충 상자', '1×1', '곤충을 넣어 장식', '🪲', 300, 0, 'craft'],
  ['picture-frame', '액자', '벽', '주민 선물', '🖼️', 500, 0, 'gift'],
  ['villager-photo', '주민 사진', '1×1', '친밀도 최대', '📷', 10, 0, 'friend'],
  ['shell-curtain', '조개 커튼', '창문', '제작: 조개 6', '🐚', 600, 0, 'craft'],
  ['fruit-chair', '과일 의자', '1×1', '제작: 과일 10', '🍎', 1500, 0, 'craft'],
  ['dino-model', '공룡 모형', '2×2', '박물관 완성 보상', '🦕', 3000, 0, 'museum'],
];

// ---------- 씨앗·묘목 (상점 판매) ----------
const SEEDS = [
  ['tulip', '튤립 씨앗', '🌱', 60, 240, { flower: 'tulip' }], ['cosmos', '코스모스 씨앗', '🌱', 60, 240, { flower: 'cosmos' }],
  ['pansy', '팬지 씨앗', '🌱', 60, 240, { flower: 'pansy' }], ['sapling', '어린 나무', '🌳', 160, 640, { tree: 'tree' }],
  ['cedar-sapling', '삼나무 묘목', '🌲', 160, 640, { tree: 'cedar' }],
];

const code = (p, i) => `${p}-${String(i + 1).padStart(2, '0')}`;
const sizeOf = s => (s.includes('×') ? s.split('×').map(Number) : [1, 1]);
const placeOf = s => (s === '벽' ? 'wall' : s === '창문' ? 'window' : 'floor');

/** @type {object[]} 모든 아이템 (읽기 전용) */
export const ITEMS = [
  ...FISH.map(([slug, name, place, time, season, shadow, price, rare, icon, desc], i) => ({
    id: `fish.${slug}`, category: 'fish', code: code('FI', i), name, icon, price, desc,
    place, time, season, habitats: FISH_PLACE[place], hours: TIME_HOURS[time], months: SEASON_MONTHS[season],
    shadow, rare: !!rare, weight: weightOf(price, rare),
    colors: (([body, back, belly, fin]) => ({ body, back, belly, fin }))(FISH_COLORS[slug] ?? ['#8FA7B5', '#6E8898', '#F7F1E4', '#7E98A8']),
  })),
  ...BUGS.map(([slug, name, place, time, season, price, rare, flying, icon, desc], i) => ({
    id: `bug.${slug}`, category: 'bug', code: code('BU', i), name, icon, price, desc,
    place, time, season, places: BUG_PLACE[place], hours: TIME_HOURS[time], months: SEASON_MONTHS[season],
    rainOnly: time === '비 올 때', flying: !!flying, rare: !!rare, weight: weightOf(price, rare),
  })),
  ...FOSSILS.map(([slug, name, price, rare, icon, desc], i) => ({
    id: `fossil.${slug}`, category: 'fossil', code: `FO-0${i + 1}`, name, icon, price, desc, rare: !!rare, weight: weightOf(price, rare),
  })),
  { id: UNKNOWN_FOSSIL, category: 'fossil', code: 'FO-00', name: '알 수 없는 화석', icon: '🦴', price: 200, unknown: true,
    desc: '흙이 잔뜩 묻은 오래된 무언가. 박물관 느루에게 가져가면 무엇인지 감정해 준다.' },
  ...FRUITS.map(([slug, name, icon, price, variant]) => ({
    id: `fruit.${slug}`, category: 'fruit', code: slug === 'coconut' ? 'MA-02' : 'MA-01', name, icon, price,
    nativePrice: variant ? 100 : price, variant, tree: variant ? 'fruit-tree' : 'palm',
  })),
  ...SHELLS.map(([slug, name, icon, price, weight, variant]) => ({
    id: `shell.${slug}`, category: 'shell', code: 'MA-07', name, icon, price, weight, variant,
  })),
  ...FLOWERS.flatMap(([kind, kindName, icon, colors]) => colors.map(([variant, color], ci) => ({
    id: `flower.${kind}-${variant}`, category: 'flower', code: 'PR-06', name: `${color} ${kindName}`, icon,
    price: ci === 3 ? 240 : 80, kind, variant, hybrid: ci === 3,
  }))),
  ...MATS.map(([slug, name, icon, price, from], i) => ({
    id: `mat.${slug}`, category: 'mat', code: ['MA-03', 'MA-03', 'MA-04', 'MA-05', 'MA-05', 'MA-05', 'MA-06'][i], name, icon, price, from,
  })),
  { id: 'mat.acorn-bag', category: 'mat', code: 'MA-08', name: '도토리 주머니', icon: '💰', price: 100, acorns: 100, stack: 10, from: '나무·바위에서 가끔' },
  ...TOOLS.map(([slug, name, icon, use, from, durability, buy], i) => ({
    id: `tool.${slug}`, category: 'tool', code: code('TL', i), name, icon, price: buy / 4, buy, tool: slug, use, from, durability,
  })),
  // 가구 아이콘 = 가구 모델 썸네일 그림 (assets/furniture, W3). 글자로 써야 하는 곳(대화 선택지 등)은 emoji
  ...FURN.map(([slug, name, size, from, icon, price, buy, source], i) => ({
    id: `furn.${slug}`, category: 'furn', code: code('FU', i), name, icon: `assets/furniture/renders/${slug}_thumb.png`, emoji: icon, price, ...(buy ? { buy } : {}),
    size: sizeOf(size), place: placeOf(size), sizeText: size, from, source,
    ...(slug === 'campfire' ? { outdoor: true } : {}), ...(slug === 'radio' ? { plays: 'bgm' } : {}),
    ...(slug === 'fish-tank' ? { holds: 'fish' } : {}), ...(slug === 'bug-case' ? { holds: 'bug' } : {}),
  })),
  ...SEEDS.map(([slug, name, icon, price, buy, extra]) => ({ id: `seed.${slug}`, category: 'seed', name, icon, price, buy, ...extra })),
];

const deepFreeze = v => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    Object.values(v).forEach(deepFreeze);
  }
  return v;
};
for (const it of ITEMS) {
  if (it.stack == null) it.stack = STACK[it.category] ?? 1;
  if (it.buy) it.buyPrice = it.buy;   // 계약 이름 (docs/CONTRACTS.md: buyPrice = 상점에서 살 때 값)
  deepFreeze(it);   // months·hours 같은 배열은 여러 아이템이 같이 쓴다
}

const BY_ID = new Map(ITEMS.map(it => [it.id, it]));
// 감정 전 화석은 카테고리 목록(도감·박물관 칸·화석 뽑기)에서 뺀다
const BY_CAT = new Map(CATEGORIES.map(c => [c, ITEMS.filter(it => it.category === c && !it.unknown)]));

/** id → 아이템 또는 null */
export const get = id => BY_ID.get(id) ?? null;
/** 카테고리의 아이템 목록 (카테고리를 안 주면 전부) */
export const list = category => (category == null ? ITEMS.slice() : (BY_CAT.get(category) ?? []).slice());
export const has = id => BY_ID.has(id);
/** 한 칸에 몇 개까지 쌓이나 (모르는 id 는 1) */
export const stackOf = id => BY_ID.get(id)?.stack ?? 1;
/** 박물관·도감에 들어가는 카테고리 */
export const COLLECTIBLE = ['fish', 'bug', 'fossil'];
