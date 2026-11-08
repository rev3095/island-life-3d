// 9차 M9 순수 함수 (three 없음 → 테스트가 바로 부른다): 변형 이름 · 가구 스펙을 world 물체 스펙으로.

// 변형 이름 = '<색 변형>+<꼬리표>+…' (색 변형은 비워도 됨, 예 'red+wow' · '+n+e' · 'spring+n+s').
// 모델의 'link_<쪽>' 부품은 그 쪽 꼬리표(n·e·s·w·ne·nw·se·sw)가 있을 때만 남고 (이어지는 길·울타리, spec.world.connect),
// 'opt_<묶음>_<값>' 부품은 꼬리표 중 spec.world.options[묶음] 에 든 값 하나만 (없으면 첫 값 — 눈사람 표정). 고르는 일은 objects.js prune.
export const splitVariant = v => { const [pal, ...tags] = String(v ?? '').split('+'); return { pal: pal || null, tags }; };
export const joinVariant = (pal, tags = []) => (tags.length ? [pal ?? '', ...tags].join('+') : pal ?? null);

/** 섬 꾸미기 야외 가구 kind 접두사 ('fu:<가구 slug>', 가구 모델을 world 물체로) */
export const FURN_KIND = 'fu:';
/** 가구 스펙을 world 물체 스펙으로: 원점 = 발자국 가운데라 extent = 발자국 반, 충돌이 없으면 발자국 90% 상자 */
export function furnitureWorld(spec) {
  const [fw, fd] = spec.footprint ?? [1, 1];
  return { ...spec, world: { collider: { box: [fw * 0.9, fd * 0.9] }, ...(spec.world ?? {}), extent: [fw / 2, fd / 2] } };
}
