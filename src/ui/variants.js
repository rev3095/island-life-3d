// 가방 칸 변형(가구 색·주민 사진의 주민)의 이름과 색. assets/furniture/specs/<slug>.json 의 variants[v].label 을 읽어 둔다.
// 썸네일은 기본 색이라 파란 소파도 주황으로 보이므로, 칸에 색 점과 이름표를 붙이는 데 쓴다.
// 처음엔 비어 있다가 스펙을 받으면 onReady() 를 불러 다시 그리게 한다.
const BASE = 'assets/furniture';

export function createVariants(ctx, onReady) {
  const load = url => (ctx.assets?.loadJSON ? ctx.assets.loadJSON(url) : fetch(url).then(r => r.json()));
  let index = null;             // Promise<Map 아이템 id → slug>
  const specs = new Map();      // slug → spec | null (못 읽음) | Promise (읽는 중)

  const slugs = () => (index ??= load(`${BASE}/index.json`)
    .then(j => new Map((j.models ?? []).map(m => [m.item, m.slug])))
    .catch(() => new Map()));

  function want(item) {
    slugs().then(map => {
      const slug = map.get(item);
      if (!slug || specs.has(slug)) return;
      specs.set(slug, load(`${BASE}/specs/${slug}.json`)
        .then(s => specs.set(slug, s), () => specs.set(slug, null))
        .then(() => onReady?.()));
    });
  }

  let itemSlug = null;   // 동기로 쓰려고 index 를 다 받은 뒤의 Map
  slugs().then(m => { itemSlug = m; });

  /** 칸 → { label, color } | null. 아직 스펙을 못 받았으면 null 을 주고 받으러 간다 */
  function of(slot) {
    if (!slot?.variant) return null;
    const slug = itemSlug?.get(slot.id);
    const spec = slug ? specs.get(slug) : undefined;
    if (spec === undefined || spec instanceof Promise) { want(slot.id); return null; }
    const v = spec?.variants?.[slot.variant];
    if (!v) return { label: String(slot.variant), color: null };
    return { label: String(v.label ?? slot.variant).replace(/\s*\(기본\)$/, ''), color: colorOf(spec, slot.variant) };
  }

  /** '파랑 소파' 처럼 문장에 쓰는 이름 */
  const name = (slot, base) => {
    const v = of(slot);
    return v ? `${v.label} ${base}` : base;
  };

  return { of, name };
}

/** 변형을 대표하는 색: 변형들이 바꾸는 첫 팔레트 칸 (기본 변형은 스펙 기본 팔레트에서) */
function colorOf(spec, variant) {
  const vs = Object.values(spec.variants ?? {});
  const key = vs.map(v => Object.keys(v.palette ?? {})[0]).find(Boolean);
  if (!key) return null;
  return spec.variants[variant]?.palette?.[key] ?? spec.palette?.[key] ?? null;
}
