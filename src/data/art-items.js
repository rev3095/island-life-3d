// P54 밤 특별 상점 · 미술품 (사용자 요청 3·4·5번, 결정 D165–D169 — docs/notes/night-special.md).
// 표는 assets/data/items.json 의 art (요소 편집기로 값을 고친다), 여기서는 게임 칸(id·icon·fake…)을 붙인다. items.js 는 붙이기만 한다.
//  - 진품 16점 IC-AR-01–16 (그림 01–10 · 조각 11–16) = list('art') · 박물관 기증 (COLLECTIBLE).
//  - 가품이 있는 작품(표의 fake)은 같은 모델의 색 변형 하나 = art.<slug>-fake. 이름·설명은 진품과 같고(겉으로는 모른다),
//    아이콘 색 한 군데가 다르다 (fake.key = 다른 팔레트 칸, fake.tell = 여우 상인·박물관이 짚는 차이). 가품은 list('art') 에서 빠지고 박물관이 받지 않는다.
//  - 아이콘: 가품이 있는 작품은 assets/items/renders/art-<slug>_real|fake_thumb.png, 없는 작품은 art-<slug>_thumb.png.

/** 아이템 분류 하나 (미술품은 하나씩만 든다) */
export const ART_CATEGORY = { key: 'art', name: '미술품', stack: 1 };
/** 가품을 팔 때 값 (도토리) */
export const FAKE_PRICE = 30;

/** 아이템 표에 넣을 것: rows = items.json art, itemIcon = items.js 의 itemIcon */
export function artItems(rows = [], itemIcon) {
  const out = [];
  for (const { slug, code, name, kind, emoji, price, buy, desc, fake } of rows) {
    const model = `art-${slug}`;
    const base = { category: ART_CATEGORY.key, code, name, emoji, desc, artKind: kind, buy, from: '밤의 특별 상점 · 선물 상자' };
    out.push({ ...base, id: `art.${slug}`, icon: itemIcon(model, fake ? 'real' : null), price });
    if (fake) out.push({ ...base, id: `art.${slug}-fake`, icon: itemIcon(model, 'fake'), price: FAKE_PRICE, fake: true, genuine: `art.${slug}`, tell: fake.tell, tellKey: fake.key });
  }
  return out;
}
