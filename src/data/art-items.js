// P54 밤 특별 상점 · 미술품 (사용자 요청 3·4·5번, 결정 D165–D169 — docs/notes/night-special.md).
// 표는 assets/data/items.json 의 art (요소 편집기로 값을 고친다), 여기서는 게임 칸(id·icon·fake…)을 붙인다. items.js 는 붙이기만 한다.
//  - 진품 16점 IC-AR-01–16 (그림 01–10 · 조각 11–16) = list('art') · 박물관 기증 (COLLECTIBLE).
//  - 가품이 있는 작품(표의 fake)은 같은 모델의 색 변형 하나 = art.<slug>-fake. 이름·설명은 진품과 같고(겉으로는 모른다),
//    아이콘 색 한 군데가 다르다 (fake.key = 다른 팔레트 칸, fake.tell = 여우 상인·박물관이 짚는 차이). 가품은 list('art') 에서 빠지고 박물관이 받지 않는다.
//  - M17-P2: 가품 칸에 fakeLook(3D 색, FAKE_LOOK) · museumTell(느루가 짚는 줄, MUSEUM_TELL). 진품·가품 모두 집 벽(그림)·바닥(조각)에 가구처럼 놓는다 (house/furniture.js artInfo).
//  - 아이콘: 가품이 있는 작품은 assets/items/renders/art-<slug>_real|fake_thumb.png, 없는 작품은 art-<slug>_thumb.png.

/** 아이템 분류 하나 (미술품은 하나씩만 든다) */
export const ART_CATEGORY = { key: 'art', name: '미술품', stack: 1 };
/** 가품을 팔 때 값 (도토리) */
export const FAKE_PRICE = 30;

/**
 * M17-P2 (D181-A) 가품 3D 색: 아이템 스펙 assets/items/specs/art-<slug>.json 의 variants.fake.palette 와 같다
 * (게시본엔 아이템 스펙이 없어서 게임 칸으로도 둔다 — tests/gaps.test.mjs 가 스펙과 맞는지 본다). 실내 진열·집에 놓은 가품을 이 색으로 칠한다.
 */
export const FAKE_LOOK = {
  'sea-morning': { sun: '#E8604F' },
  'star-river': { river: '#5FA88A' },
  'flower-window': { vase: '#8A5AB8' },
  'three-pears': { pear: '#E8913C' },
  'dancing-leaves': { bg: '#A9B8CC' },
  'thinking-frog': { bronze: '#7F8F7A' },
  'big-acorn': { cap: '#B8503E' },
  'bear-bust': { marble: '#F2C4C4' },
};

/**
 * M17-P2 (D181-A) 박물관 느루가 가품을 돌려주며 짚는 한 줄 — 작품마다 (느루 말투, 진품과 다른 점).
 * 여우 상인의 tell(items.json art.fake.tell)은 그대로 두고, 느루는 이 줄을 말한다. 없으면 tell 로.
 */
export const MUSEUM_TELL = {
  'sea-morning': '진품의… 해는… 노랗게 떠오르는데… 이건… 해가… 붉군요…',
  'star-river': '진품의 강은… 파랗게 흐르는데… 이 강물은… 초록빛이에요…',
  'flower-window': '진품의 꽃병은… 파란색이랍니다… 이건… 보라색이군요…',
  'three-pears': '진품의 배는… 세 알 모두… 연두빛인데… 한 알이… 주황색이에요…',
  'dancing-leaves': '진품은… 크림빛 바탕인데… 이건… 잿빛 파랑이군요…',
  'thinking-frog': '진품은… 청동이라… 따뜻한 갈색이 돌아요… 이건… 푸르스름한 돌빛이고요…',
  'big-acorn': '진품의 깍정이는… 갈색인데… 이건… 붉은색이에요…',
  'bear-bust': '진품은… 새하얀 대리석인데… 이건… 분홍빛이… 돌아요…',
};

/** 아이템 표에 넣을 것: rows = items.json art, itemIcon = items.js 의 itemIcon */
export function artItems(rows = [], itemIcon) {
  const out = [];
  for (const { slug, code, name, kind, emoji, price, buy, desc, fake } of rows) {
    const model = `art-${slug}`;
    const base = { category: ART_CATEGORY.key, code, name, emoji, desc, artKind: kind, buy, from: '밤의 특별 상점 · 선물 상자' };
    out.push({ ...base, id: `art.${slug}`, icon: itemIcon(model, fake ? 'real' : null), price });
    if (fake) out.push({ ...base, id: `art.${slug}-fake`, icon: itemIcon(model, 'fake'), price: FAKE_PRICE, fake: true, genuine: `art.${slug}`, tell: fake.tell, tellKey: fake.key,
      museumTell: MUSEUM_TELL[slug] ?? fake.tell, fakeLook: FAKE_LOOK[slug] ?? null });
  }
  return out;
}
