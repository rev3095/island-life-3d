// 요소 편집기 표 정의 — 탭 묶음(GROUPS)과 표(SHEETS). tools/hub-catalog.mjs 가 이 파일의 `  { id: '…', name: '…'` 줄로 홈 「전체 관리」 목록을 만든다
// (주소 끝 #<표 id> 로 그 표가 열린다). 칸 경로의 첫 칸은 파일 이름: items · rules · events · night · tour · layout · rooms/<slug> · places/<slug>
// (tools/apply-edits.mjs ELEM_FILES). 각 칸의 fx = "바꾸면 게임에서 무엇이 달라지는지" 한 줄.
import { CAT_KO, WEEKDAY_KO, TOUR_SHAPES, hourKo } from '../tools/elem-checks.mjs';

export const SOURCE_KO = { craft: '제작', shop: '상점', gift: '주민 선물', friend: '친밀도 선물', museum: '박물관 보상', birthday: '생일 선물' };
export const VILLAGER_KO = { coco: '코코', bori: '보리', mochi: '모찌', dubu: '두부', pong: '퐁', chorong: '초롱', danpung: '단풍', gureum: '구름', pado: '파도', dalmuri: '달무리', bamtol: '밤톨', neuru: '느루', byeolbam: '별밤', yeomyeong: '여명' };
const TIER_KO = { new: '처음', known: '아는 사이', friend: '친구', close: '친한 친구', best: '단짝' };
const EVENT_KO = { 'EV-01': '봄 꽃놀이', 'EV-02': '여름 불꽃놀이', 'EV-03': '가을 수확 잔치', 'EV-04': '겨울 눈사람 날' };

/** 위 줄 탭 (묶음) → 아래 줄은 그 묶음의 표 */
export const GROUPS = [
  { id: 'shop', name: '상점', emo: '🏪' },
  { id: 'items', name: '아이템 값', emo: '🐟' },
  { id: 'rules', name: '채집·하루·주민', emo: '🎲' },
  { id: 'events', name: '행사', emo: '🌸' },
  { id: 'night', name: '밤·새벽', emo: '🌙' },
  { id: 'tour', name: '투어', emo: '⛵' },
  { id: 'moving', name: '이사', emo: '📦' },
  { id: 'map', name: '섬 지도', emo: '🗺' },
  { id: 'rooms', name: '방 배치', emo: '🛋' },
];

// type: int · num · prob(0~1) · text · select · bool · colors · weight(비우면 값으로 정함) · mmdd · pair(작은~큰) · hours(게임 하루 시각 5~29) · multi(고르기 여러 개)
const weightOf = (T, price, rare) => (rare ? T.weight.rare : T.weight.byPrice.find(([min]) => price >= min)?.[1] ?? T.weight.base);
const code = (p, i) => `${p}-${String(i + 1).padStart(2, '0')}`;
const keys = o => Object.keys(o ?? {});
const FX_PRICE = '상점(밤톨)에 팔 때 받는 도토리. 박물관·도감 값 표시도 같이 바뀌어요.';
const FX_BUY = '상점에서 살 때 내는 도토리 (0 = 팔지 않음).';
const FX_WEIGHT = '같은 자리·시간에 나오는 것들 사이에서 이 아이템이 뽑히는 몫. 크면 자주 나와요.';

export const SHEETS = [
  { id: 'shop', name: '상점', group: 'shop', emo: '🏪', object: true, hint: '도토리상점(밤톨) 문 여는 시간과 하루 진열. 진열 받침·계산대 자리는 「방 배치」 탭 → 도토리상점에서 옮겨요. 옷 칸은 아직 게임에 없어요 (옷 아이템이 생기면 여기에 칸이 더해져요).', groups: () => [
    ['도토리상점', [
      ['rules/shop/open', '여는 시각', 'int', { max: 23 }, '이 시각 전에는 문이 잠겨 있어요 (「아직 안 열었어요」 쪽지).'],
      ['rules/shop/close', '닫는 시각', 'int', { max: 24 }, '이 시각부터 문이 잠겨요. 상점 안에 있으면 그대로 둬요.'],
      ['rules/shop/furniturePerDay', '하루 가구 수', 'int', { min: 1, max: 4 }, '그날 진열 받침에 놓이는 가구 수 (받침 자리가 4개라 4까지).'],
      ['rules/shop/outdoorPerDay', '그중 야외 가구 수', 'int', { max: 4 }, '오른쪽 「야외 가구 받침」에 놓이는 섬 꾸미기 가구 수 (10차 D99-A).'],
      ['rules/shop/flowerSeedsPerDay', '하루 꽃씨 수', 'int', { max: 3 }, '씨앗 진열대에 그날 놓이는 꽃씨 종류 수.'],
    ]],
    ['시작 지급', [['rules/starter/acorns', '처음 도토리', 'int', { max: 99999 }, '새 게임을 시작할 때 지갑에 든 도토리.']]],
  ] },
  { id: 'fish', name: '물고기', group: 'items', file: 'items', section: 'fish', emo: '🐟', hint: '출현 몫은 비우면 값으로 정해요 (희귀 1 · 1000 이상 3 · 400 이상 6 · 그 밖 10). 그림자 1(아주 작음)~6(대형), 비·눈 오는 날은 5 이상이 두 배로 잘 물어요.',
    cols: T => [
      { key: '#', label: '번호', derived: (r, i) => code('FI', i) },
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-s', stick: true, fx: '도감·가방·말풍선에 보이는 이름.' },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'place', label: '장소', type: 'select', options: keys(T.fishPlaces), fx: '이 물가에서만 물어요 (강·연못·바다·선착장·하구).' },
      { key: 'time', label: '시간', type: 'select', options: keys(T.times), fx: '이 시간대에만 나와요.' },
      { key: 'season', label: '계절', type: 'select', options: keys(T.seasons), fx: '이 달들에만 나와요 (달 칸이 따라 바뀜).' },
      { key: 'months', label: '달', derived: r => (T.seasons[r.season] ?? []).join('·') },
      { key: 'shadow', label: '그림자', type: 'int', min: 1, max: 6, w: 'w-s', fx: '물속 그림자 크기 — 낚기 전에 크기로 짐작해요.' },
      { key: 'rare', label: '희귀', type: 'bool', fx: '희귀면 출현 몫이 1 이 되고 잡을 때 반짝여요.' },
      { key: 'weight', label: '출현 몫', type: 'weight', auto: r => weightOf(T, r.price, r.rare), fx: FX_WEIGHT },
      { key: 'colors', label: '몸 색 (몸·등·배·지느러미)', type: 'colors', fx: '물고기 모델·아이콘 색 (아이콘은 다시 만들 때).' },
      { key: 'desc', label: '도감 설명', type: 'text', w: 'w-l' },
    ] },
  { id: 'bugs', name: '곤충', group: 'items', file: 'items', section: 'bugs', emo: '🦋', hint: '나무 흔들기 = 나무를 흔들면 떨어지는 곤충, 바위 밑 = 바위를 치면 튀어나오는 곤충. 날아다니는 곤충은 비·눈 오면 숨어요.',
    cols: T => [
      { key: '#', label: '번호', derived: (r, i) => code('BU', i) },
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-s', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'place', label: '장소', type: 'select', options: keys(T.bugPlaces), fx: '이 자리에서만 나와요.' },
      { key: 'time', label: '시간', type: 'select', options: keys(T.times) },
      { key: 'season', label: '계절', type: 'select', options: keys(T.seasons) },
      { key: 'months', label: '달', derived: r => (T.seasons[r.season] ?? []).join('·') },
      { key: 'rare', label: '희귀', type: 'bool' },
      { key: 'flying', label: '날아다님', type: 'bool', fx: '켜면 비·눈 오는 날 숨어요.' },
      { key: 'weight', label: '출현 몫', type: 'weight', auto: r => weightOf(T, r.price, r.rare), fx: FX_WEIGHT },
      { key: 'desc', label: '도감 설명', type: 'text', w: 'w-l' },
    ] },
  { id: 'fossils', name: '화석', group: 'items', file: 'items', section: 'fossils', emo: '🦴', hint: '화석 자리를 파면 "알 수 없는 화석"이 나오고, 박물관에서 감정하면 출현 몫대로 하나가 돼요. 감정 전 화석 값은 「채집·하루·주민」 → 규칙 숫자에.',
    cols: T => [
      { key: '#', label: '번호', derived: (r, i) => `FO-0${i + 1}` },
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-m', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'rare', label: '희귀', type: 'bool' },
      { key: 'weight', label: '감정 몫', type: 'weight', auto: r => weightOf(T, r.price, r.rare), fx: '감정할 때 이 화석이 나올 몫.' },
      { key: 'desc', label: '도감 설명', type: 'text', w: 'w-l' },
    ] },
  { id: 'fruits', name: '과일·조개', group: 'items', file: 'items', section: 'fruits', emo: '🍎', hint: '특산 과일 값 = 우리 섬 고장 과일(섬 시드로 정해짐)을 팔 때. 다른 과일은 값대로 비싸게 팔려요.',
    cols: () => [
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-m', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: '다른 섬 과일일 때 파는 값.' },
      { key: 'nativePrice', label: '특산 과일일 때 값', type: 'int', max: 999999, fx: '우리 섬 고장 과일일 때 파는 값.' },
      { key: 'variant', label: '나무 모양', derived: r => r.variant ?? '야자수' },
    ],
    extra: { section: 'shells', title: '조개 (해변)', hint: '출현 몫이 클수록 자주 밀려와요.', cols: () => [
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-m', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'weight', label: '출현 몫', type: 'num', min: 0.1, max: 100, fx: '아침마다 해변에 놓이는 조개 중 이것이 뽑히는 몫.' },
      { key: 'variant', label: '모양', derived: r => r.variant },
    ] } },
  { id: 'flowers', name: '꽃·씨앗', group: 'items', file: 'items', section: 'flowers', emo: '🌷', hint: '꽃마다 색 4가지: 앞의 3색은 씨앗에서, 마지막 색은 교배로만 피어요 (교배 꽃 값).',
    cols: () => [
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-s', stick: true },
      { key: 'price', label: '값 (앞 3색)', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'hybridPrice', label: '교배 꽃 값', type: 'int', max: 999999, fx: '교배로만 피는 넷째 색 꽃을 팔 때.' },
      { key: 'colors', label: '색', derived: r => r.colors.map(([, c], i) => (i === 3 ? `${c}(교배)` : c)).join(' · ') },
    ],
    extra: { section: 'seeds', title: '씨앗·묘목 (상점)', hint: '사는 값 = 상점에서 살 때, 값 = 팔 때.', cols: () => [
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-m', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'buy', label: '사는 값', type: 'int', max: 999999, fx: FX_BUY },
      { key: 'grows', label: '자라는 것', derived: r => r.flower ?? r.tree },
    ] } },
  { id: 'mats', name: '재료·도구', group: 'items', file: 'items', section: 'mats', emo: '🪵', hint: '도구 내구도 = 부서지기 전까지 쓸 수 있는 횟수. 도구 사는 값이 상점 값이에요.',
    cols: () => [
      { key: 'code', label: '번호', derived: r => r.code },
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-m', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'from', label: '얻는 법', type: 'text', w: 'w-m' },
    ],
    extra: { section: 'tools', title: '도구', hint: '', cols: () => [
      { key: '#', label: '번호', derived: (r, i) => code('TL', i) },
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-s', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'buy', label: '사는 값', type: 'int', max: 999999, fx: FX_BUY },
      { key: 'durability', label: '내구도', type: 'int', min: 1, max: 999, fx: '이만큼 쓰면 부서져요.' },
      { key: 'use', label: '쓰임', type: 'text', w: 'w-m' },
      { key: 'from', label: '얻는 법', type: 'text', w: 'w-m' },
    ] } },
  { id: 'furniture', name: '가구', group: 'items', file: 'items', section: 'furniture', emo: '🪑', hint: '사는 값이 0 이면 상점에서 팔지 않아요. 얻는 법을 "상점" 으로 두면 사는 값이 있어야 해요. 크기는 모델에 맞춰져 있어 여기서 못 바꿔요.',
    cols: () => [
      { key: '#', label: '번호', derived: (r, i) => code('FU', i) },
      { key: 'emoji', label: '', derived: r => r.emoji, emo: true },
      { key: 'name', label: '이름', type: 'text', w: 'w-m', stick: true },
      { key: 'price', label: '값', type: 'int', max: 999999, fx: FX_PRICE },
      { key: 'buy', label: '사는 값', type: 'int', max: 999999, fx: FX_BUY },
      { key: 'source', label: '얻는 법 (종류)', type: 'select', options: keys(SOURCE_KO), labels: SOURCE_KO, fx: '「상점」이면 그날 진열 후보에 들어가요.' },
      { key: 'from', label: '얻는 법 (글)', type: 'text', w: 'w-m' },
      { key: 'size', label: '크기', derived: r => r.size },
    ] },
  { id: 'recipes', name: '레시피', group: 'items', file: 'rules', section: 'recipes', emo: '🔨', recipes: true, hint: '작업대에서 만드는 법. 재료는 정확한 아이템이나 "분류 아무거나"(예: 조개 아무거나 6). 바꾸면 작업대 목록과 필요한 재료가 바로 바뀌어요.' },
  { id: 'rules', name: '규칙 숫자', group: 'rules', emo: '🎲', object: true, hint: '채집 확률은 0~1 (0.08 = 8%). 나무 흔들기·바위 치기 확률은 더해서 1 을 넘을 수 없어요.', groups: () => [
    ['채집', [['rules/gather/fruitPerTree', '과일나무 열매 수', 'int', { min: 1, max: 9 }, '나무를 흔들면 떨어지는 과일 수.'], ['rules/gather/coconutPerPalm', '야자열매 수', 'int', { min: 1, max: 9 }],
      ['rules/gather/rockMaxHits', '바위 하루 칠 수 있는 횟수', 'int', { min: 1, max: 20 }, '바위 하나를 하루에 이만큼 치면 그날은 끝.'], ['rules/gather/chopMaxHits', '나무 하루 도끼질 횟수', 'int', { min: 1, max: 20 }],
      ['rules/gather/shakeBugChance', '나무 흔들기 → 곤충 떨어짐', 'prob'], ['rules/gather/rockBugChance', '바위 치기 → 곤충 튀어나옴', 'prob'],
      ['rules/gather/shake/bees', '나무 흔들기 → 벌집', 'prob', {}, '벌집이 떨어지면 벌에 쏘일 수 있어요.'], ['rules/gather/shake/beesOrchard', '과수원 나무 → 벌집', 'prob'],
      ['rules/gather/shake/furniture', '나무 흔들기 → 가구', 'prob'], ['rules/gather/shake/acornBag', '나무 흔들기 → 도토리 주머니', 'prob'], ['rules/gather/shake/branch', '나무 흔들기 → 나뭇가지', 'prob'],
      ['rules/gather/rock/acornBag', '바위 → 도토리 주머니 (처음)', 'prob'], ['rules/gather/rock/iron', '바위 → 철광석 (처음)', 'prob'], ['rules/gather/rock/clay', '바위 → 점토', 'prob'],
      ['rules/gather/rock/doubleStone', '바위 첫 번 → 돌 2개', 'prob'], ['rules/gather/chop/wood', '도끼질 → 나무 (나머지는 단단한 나무)', 'prob'],
      ['rules/gather/wetBigFish/shadow', '비 오는 날 잘 무는 그림자 크기 (이상)', 'int', { min: 1, max: 6 }], ['rules/gather/wetBigFish/mult', '그때 출현 몫 배수', 'num', { min: 1, max: 10 }],
      ['rules/gather/mouthMult', '하구 물고기 출현 몫 배수 (하구에서)', 'num', { min: 1, max: 10 }]]],
    ['하루', [['rules/day/boundaryHour', '하루가 바뀌는 시각', 'int', { max: 11 }, '이 시각에 날짜가 넘어가고 상점 진열·조개·잡초가 새로 놓여요.'], ['rules/day/fruitRegrowDays', '열매 다시 열리는 날', 'int', { min: 1, max: 30 }],
      ['rules/day/fossilsPerDay', '하루 화석 자리', 'int', { max: 12 }, '아침마다 섬에 새로 생기는 ✕ 자리 수.'], ['rules/day/shellsPerDay', '하루 조개 (적게~많게)', 'pair', { max: 30 }],
      ['rules/day/weedsPerDay', '하루 돋는 잡초 (적게~많게)', 'pair', { max: 20 }], ['rules/day/weedsStart', '처음 잡초', 'int', { max: 60 }], ['rules/day/weedsMax', '잡초 최대', 'int', { max: 99 }]]],
    ['시간 빠르기 (게임 시계)', [['rules/time/speed', '처음 시간 빠르기', 'select', { options: ['real', 'fast', 'faster'], labels: { real: '실제와 같게', fast: '빠르게', faster: '아주 빠르게' } }, '새 게임과 섬폰 설정을 안 고른 사람의 게임 시계. 섬폰 「시간 빠르기」로 고르면 그 값이 이겨요.'],
      ['rules/time/speeds/fast', '「빠르게」 = 실제 1분에 게임 몇 분', 'int', { min: 2, max: 120 }, '12 면 게임 하루가 실제 2시간이에요.'], ['rules/time/speeds/faster', '「아주 빠르게」 = 실제 1분에 게임 몇 분', 'int', { min: 2, max: 240 }, '30 이면 게임 하루가 실제 48분이에요.'],
      ['rules/time/whenClosed', '게임을 닫아 둔 동안 (빠르게일 때)', 'select', { options: ['pause', 'catchUp'], labels: { pause: '멈춰 있다가 이어서', catchUp: '흐른 만큼 따라잡기' } }, '「실제와 같게」는 언제나 실제 시계를 따라요. 따라잡기면 오래 닫아 두면 여러 날이 한 번에 지나요 (하루 일은 한 번만).']]],
    ['출현 몫 (값으로 정할 때)', [['items/weight/rare', '희귀', 'num', { min: 0.1, max: 100 }], ['items/weight/byPrice/0/1', '값 1000 이상', 'num', { min: 0.1, max: 100 }],
      ['items/weight/byPrice/1/1', '값 400 이상', 'num', { min: 0.1, max: 100 }], ['items/weight/base', '그 밖', 'num', { min: 0.1, max: 100 }]]],
    ['가방 한 칸에 쌓이는 수', Object.keys(CAT_KO).map(c => [`items/stack/${c}`, CAT_KO[c], 'int', { min: 1, max: 99 }])],
    ['그 밖 아이템', [['items/acornBag/price', '도토리 주머니 값', 'int', { max: 99999 }], ['items/acornBag/acorns', '도토리 주머니에 든 도토리', 'int', { min: 1, max: 99999 }, '주머니를 열면 지갑에 들어오는 도토리.'],
      ['items/unknownFossil/price', '감정 전 화석 값', 'int', { max: 99999 }]]],
  ] },
  { id: 'birthdays', name: '생일', group: 'rules', emo: '🎂', object: true, hint: '월-일 (예: 07-14). 단풍처럼 비워 두면 이사 온 날이 생일이 돼요.', groups: W => [
    ['주민 생일', Object.keys(W.rules.birthdays.dates).map(s => [`rules/birthdays/dates/${s}`, VILLAGER_KO[s] ?? s, 'mmdd', {}, '그날 그 주민 집 앞이 꾸며지고 선물 친밀도가 배로 올라요.'])],
    ['생일 선물', [['rules/birthdays/giftMult', '생일에 받은 선물 친밀도 배수', 'num', { min: 1, max: 10 }]]],
  ] },
  { id: 'town', name: '주민', group: 'rules', emo: '💛', object: true, hint: '친밀도는 0~최대. 단계 이름은 대사 묶음 이름과 같아요.', groups: () => [
    ['친밀도', [['rules/town/friendMax', '친밀도 최대', 'int', { min: 10, max: 999 }], ['rules/town/talkBonus', '그날 처음 말 걸면', 'int', { max: 50 }, '하루 첫 인사로 오르는 친밀도.'],
      ['rules/town/giftPoints/love', '선물: 아주 좋아함', 'int', { max: 50 }], ['rules/town/giftPoints/like', '선물: 좋아함', 'int', { max: 50 }],
      ['rules/town/giftPoints/normal', '선물: 보통', 'int', { max: 50 }], ['rules/town/giftPoints/dislike', '선물: 싫어함', 'int', { max: 50 }],
      ['rules/town/giftsCountedPerDay', '하루에 친밀도가 오르는 선물 수', 'int', { min: 1, max: 10 }],
      ...['known', 'friend', 'close', 'best'].map((t, i) => [`rules/town/tiers/${i + 1}/1`, `「${TIER_KO[t]}」 단계가 되는 친밀도`, 'int', { max: 999 }, '이 값을 넘으면 그 주민 대사 묶음이 바뀌어요.'])]],
    ['부탁', [['rules/town/requestPoints', '부탁 들어주면 친밀도', 'int', { max: 50 }], ['rules/town/requestDays', '부탁을 잊는 날', 'int', { min: 1, max: 30 }],
      ['rules/town/requestReward/furnitureChance', '보상이 가구일 확률', 'prob'], ['rules/town/requestReward/valueMult', '도토리 보상: 물건 값 × 이만큼', 'num', { max: 10 }],
      ['rules/town/requestReward/valuePlus', '도토리 보상: + 이만큼 (100 = 주머니 1)', 'int', { max: 5000 }], ['rules/town/requestReward/valueDefault', '값을 모를 때 물건 값', 'int', { max: 5000 }],
      ['rules/town/requestReward/bagMin', '도토리 주머니 최소', 'int', { min: 1, max: 99 }], ['rules/town/requestReward/bagMax', '도토리 주머니 최대', 'int', { min: 1, max: 99 }]]],
  ] },
  { id: 'events', name: '행사', group: 'events', emo: '🌸', object: true, hint: '계절 행사 넷. 날짜는 시작 날부터 기간만큼, 시간은 게임 하루 시각 (9 = 오전 9시, 24 = 자정, 27 = 새벽 3시). 첫 섬 축제(엔딩) 뒤부터 열려요. 날짜 흉내로 확인: 게임 주소 끝 #date=2027-04-02.', groups: W => [
    ['모든 행사', [['events/dates/days', '행사 기간 (날)', 'int', { min: 1, max: 14 }, '시작 날부터 이만큼 행사가 열려요 (달력·알림·도장).']]],
    ...(W.events.list ?? []).map(e => [`${e.emoji} ${e.name} (${e.id})`, [
      [`events/list/${e.slug}/start/month`, '시작 달', 'int', { min: 1, max: 12 }, '달력·알림이 이 날짜로 옮겨 가요.'],
      [`events/list/${e.slug}/start/day`, '시작 날', 'int', { min: 1, max: 31 }],
      [`events/list/${e.slug}/hours`, '여는 시간', 'hours', { min: 5, max: 29 }, '이 시간에만 행사 물건이 놓이고 주인공이 행사 자리에 서요 (그동안 비가 오지 않아요).'],
      ...(e.showAt != null ? [[`events/list/${e.slug}/showAt`, '불꽃 쇼 시각', 'num', { min: 5, max: 29 }, '이 시각에 북쪽 해변 하늘로 불꽃이 올라가요.']] : []),
      ...(e.todo ?? []).map((t, k) => [`events/list/${e.slug}/todo/${k}/goal`, `할 것: ${t.label}${t.daily ? ' (날마다)' : ''}`, 'int', { min: 1, max: 99 }, '이만큼 하면 도장 칸이 채워져요.']),
      [`events/list/${e.slug}/host`, '주인공 주민', 'select', { options: ['coco', 'bori', 'mochi', 'dubu', 'pong', 'chorong'], labels: VILLAGER_KO }, '행사 시간에 자리 둘레에 서서 행사 대사를 해요 (떠나지 않는 주민만 — 이사 탭 참고).'],
    ]]),
  ] },
  { id: 'night', name: '밤·새벽', group: 'night', emo: '🌙', object: true, hint: '시간은 게임 하루 시각 — 24 = 자정, 27 = 새벽 3시, 29 = 새벽 5시. 밤 콘텐츠는 게임을 시작하고 다음 날부터 열려요.', groups: W => {
    const N = W.night;
    return [
      ['모두', [['night/opensAfterDay', '밤 콘텐츠가 열리는 날 (시작 뒤)', 'int', { max: 30 }, '새 게임을 시작하고 이만큼 지나야 야시장·달빛 가게·천막이 나와요.']]],
      ['🏮 야시장', [
        ['night/market/weekday', '여는 요일', 'select', { options: [0, 1, 2, 3, 4, 5, 6], labels: WEEKDAY_KO, number: true }, '이 요일 저녁에 광장에 노점·등불이 서요.'],
        ['night/market/hours', '여는 시간', 'hours', { min: 17, max: 29 }],
        ['night/market/hostsLate', '노점 주민이 남는 시각', 'num', { min: 17, max: 29 }, '이 시각까지 노점 주민이 집에 안 가요.'],
        ['night/market/skipOnEvents', '이 행사 날엔 쉼', 'multi', { options: ['EV-01', 'EV-02', 'EV-03', 'EV-04'], labels: EVENT_KO }, '고른 행사 기간과 겹치는 요일엔 야시장이 서지 않아요.'],
        ['night/market/skipOnFestival', '섬 축제 날엔 쉼', 'bool'],
        ['night/market/ringCost', '고리 던지기 값', 'int', { min: 1, max: 9999 }, '한 판에 내는 도토리.'],
        ['night/market/ringThrows', '한 판에 던지는 수', 'int', { min: 1, max: 9 }],
        ['night/market/ringHit', '고리가 걸릴 확률', 'prob', {}, '한 번 던질 때 걸릴 확률. 걸린 수만큼 상품 칸이 올라가요.'],
        ...N.market.stalls.flatMap(s => Object.keys(s.prices ?? {}).map(k => [`night/market/stalls/${s.kind ?? s.id}/prices/${k}`, `${s.name}: ${k.replace('night.', '')}`, 'int', { min: 1, max: 99999 }, '노점에서 살 때 내는 도토리.'])),
      ]],
      ['🌙 달빛 가게 (별밤)', [
        ['night/shop/hours', '여는 시간', 'hours', { min: 17, max: 29 }, '이 시간에만 언덕에 가게 건물이 놓이고 들어갈 수 있어요.'],
        ['night/shop/sellBonus/bug', '곤충 팔 때 더 쳐 주는 몫', 'prob', {}, '0.2 = 곤충을 팔면 값 +20%.'],
      ]],
      ['⛺ 새벽 천막 (여명)', [['night/tent/hours', '여는 시간', 'hours', { min: 17, max: 29 }, '이 시간에만 동쪽에 천막이 서고 타로를 볼 수 있어요.']]],
      ['🦉 야행성 주민', [
        ['night/nocturnal/houseOpen', '집 문 여는 시간', 'hours', { min: 5, max: 29 }, '이 시간에만 달무리 집에 들어갈 수 있어요 (낮엔 「자는 중」 쪽지).'],
        ['night/nocturnal/firstNightVisitBonus', '밤에 처음 찾아가면 친밀도', 'int', { max: 20 }],
      ]],
      ['🔮 타로', [
        ['night/tarot/pick', '뽑는 카드 수', 'int', { min: 1, max: 5 }, '천막에서 펼친 카드 중 이만큼 골라 그날 운세가 돼요.'],
        ...N.tarot.cards.flatMap((c, i) => Object.entries(c.luck ?? {}).filter(([, v]) => typeof v === 'number').map(([k]) => [`night/tarot/cards/${i}/luck/${k}`, `${c.sym} ${c.name} — ${c.effect}`, 'num', { max: 9999 }, '이 카드를 뽑은 날의 효과 크기 (효과 글은 반영할 때 Claude 가 값에 맞춰 고쳐요).'])),
      ]],
    ];
  } },
  { id: 'tour', name: '투어', group: 'tour', emo: '⛵', object: true, hint: '선착장에서 표를 내고 배를 타면 그날의 무인도로 가요. 섬은 날짜·횟수로 정해지고, 나오는 섬 모양은 아래에서 골라요.', groups: () => [
    ['표', [
      ['tour/ticket/price', '표 값 (도토리)', 'int', { min: 1, max: 99999 }, '표가 없을 때 선착장에서 내는 도토리.'],
      ['tour/ticket/perDay', '하루 다녀올 수 있는 횟수', 'int', { min: 1, max: 5 }, '이만큼 다녀오면 다음 날 새벽 5시까지 배가 안 떠요.'],
      ['tour/ticket/firstFree', '첫 투어는 공짜', 'bool', {}, '처음 한 번은 표를 선물로 받아요.'],
    ]],
    ['섬', [
      ['tour/shapes', '나오는 섬 모양', 'multi', { options: Object.keys(TOUR_SHAPES), labels: TOUR_SHAPES }, '고른 모양 중에서 날마다 하나가 나와요. 하나만 고르면 늘 그 모양.'],
      ['tour/boat/sail', '배 타는 시간 (초 × 0.3)', 'num', { min: 0, max: 10 }, '바다를 건너는 화면이 이만큼 길어져요.'],
    ]],
    ['광석 바위', [
      ['tour/ore/maxHits', '바위 하나 칠 수 있는 횟수', 'int', { min: 1, max: 20 }],
      ['tour/ore/table/0/1', '금광석 확률', 'prob'], ['tour/ore/table/1/1', '수정 확률', 'prob'], ['tour/ore/table/2/1', '철광석 확률', 'prob'], ['tour/ore/table/3/1', '점토 확률', 'prob', {}, '나머지 몫은 돌이 나와요.'],
    ]],
    ['손님 주민', [
      ['tour/guest/firstTrip', '처음 손님이 오는 투어 (번째)', 'int', { min: 1, max: 20 }, '이 번째 투어에 이사 올 주민이 섬에 와 있어요.'],
      ['tour/guest/every', '그 뒤 몇 번마다', 'int', { min: 1, max: 20 }],
    ]],
  ] },
  { id: 'moving', name: '이사', group: 'moving', emo: '📦', object: true, hint: '엔딩(첫 섬 축제) 뒤에 새 주민이 이사 오고, 오래 산 주민이 가끔 떠나 볼까 물어요. 축제·행사 주인공(코코·모찌·두부·퐁·초롱)은 떠나지 않아요.', groups: () => [
    ['오기', [
      ['rules/moving/max', '섬 최대 주민 수 (가게 주인 포함)', 'int', { min: 9, max: 12 }, '이만큼 차면 새 주민이 오지 않아요 (지금 9명 + 집터 셋).'],
      ['rules/moving/every', '이사 오는 간격 (날)', 'int', { min: 1, max: 60 }, '엔딩 뒤 이만큼마다 한 명씩 와요 (표지판 → 이삿짐 → 집).'],
    ]],
    ['떠나기', [
      ['rules/moving/minStay', '이만큼 넘게 산 주민만 묻기 (날)', 'int', { min: 1, max: 365 }],
      ['rules/moving/quiet', '조용한 날 (엔딩·지난 묻기 뒤)', 'int', { max: 60 }, '이 날 수 동안은 아무도 떠나 볼까 묻지 않아요.'],
      ['rules/moving/chanceStep', '묻기 확률 하루 오름', 'prob'],
      ['rules/moving/chanceMax', '묻기 확률 최대', 'prob', {}, '하루에 섬 전체에서 한 번 굴리는 확률의 끝.'],
      ['rules/moving/askDays', '마음이 사라지는 날', 'int', { min: 1, max: 30 }, '물을 마음을 먹고 이만큼 말을 안 걸면 없던 일이 돼요.'],
      ['rules/moving/calmDays', '말리면 다시 안 묻는 날', 'int', { min: 1, max: 365 }],
      ['rules/moving/boxesAfter', '허락 뒤 이삿짐 (날)', 'int', { min: 0, max: 7 }],
      ['rules/moving/goneAfter', '허락 뒤 떠나는 날', 'int', { min: 1, max: 14 }],
    ]],
    ['떠난 주민 편지', [
      ['rules/moving/letters/first', '첫 편지 (떠난 뒤 날)', 'int', { min: 1, max: 60 }], ['rules/moving/letters/every', '그 뒤 간격 (날)', 'int', { min: 1, max: 60 }],
      ['rules/moving/letters/max', '편지 수', 'int', { max: 20 }],
    ]],
  ] },
  { id: 'map', name: '섬 지도', group: 'map', emo: '🗺', custom: 'map', hint: '건물·광장·다리·선착장·축제 광장 자리를 끌어 옮기고, 시드와 나무·꽃 밀도를 바꿔 보세요. 고칠 때마다 섬이 게임과 같은 규칙으로 다시 만들어져요.' },
  { id: 'rooms', name: '방 배치', group: 'rooms', emo: '🛋', custom: 'rooms', hint: '주민 방 7 · 도토리상점 · 박물관 · 달빛 가게 · 새벽 천막의 가구 자리. 끌어 옮기고(칸에 맞춤) ↻ 로 돌리고, 게임과 같은 배치 검사를 바로 보여 줘요.' },
];
export const sheetOf = id => SHEETS.find(s => s.id === id);
export { CAT_KO, hourKo };
