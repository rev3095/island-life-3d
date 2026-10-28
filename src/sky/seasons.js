// 계절 팔레트. 배경 스펙(assets/env/specs/*.json)의 variants 중 spring/summer/autumn/winter 키를 모아 만든다.
// 사계절 변형이 없고 겨울용 'snow' 변형만 있는 스펙(삼나무)은 겨울에 snow 를 쓴다.
import { SEASONS } from '../core/constants.js';

// 스펙을 못 읽었을 때 쓰는 컨셉 보드 PAL-S1~S4 값
const FALLBACK = {
  spring: { grass: '#9BD47A', grassDark: '#7FBF5E', leaf: '#F4B6C8' },
  summer: { grass: '#6CC160', grassDark: '#55A84C', leaf: '#5FAE5A' },
  autumn: { grass: '#A9C46A', grassDark: '#8FB052', leaf: '#E8913A' },
  winter: { grass: '#EEF3F6', grassDark: '#D5E0E6', leaf: '#DCE8E2' },
};

/** 배경 스펙 전부 읽기 (assets 의 캐시를 같이 쓰므로 world 가 다시 읽어도 공짜) */
export async function loadEnvSpecs(assets) {
  const index = await assets.loadEnvIndex();
  const specs = await Promise.all(index.models.map(m => assets.loadEnvSpec(m.slug).catch(() => null)));
  return specs.filter(Boolean);
}

/** 스펙 목록 → { spring: 팔레트, summer: ..., ... } */
export function buildSeasonPalettes(specs) {
  const out = {};
  for (const season of SEASONS) {
    const pal = { season, snow: season === 'winter', variants: {}, bySlug: {} };
    const flat = {};
    for (const spec of specs) {
      const v = spec.variants ?? {};
      const key = v[season] ? season : season === 'winter' && v.snow ? 'snow' : null;
      if (!key) continue;
      const colors = { ...(spec.palette ?? {}), ...(v[key].palette ?? {}) };
      pal.variants[spec.slug] = key;
      pal.bySlug[spec.slug] = colors;
      // 사계절 스펙의 색만 납작한 키로 (먼저 나온 것이 이김: tile-grass 의 grass, tree 의 leaf ...)
      if (v[season]) for (const [k, c] of Object.entries(colors)) flat[k] ??= c;
    }
    // 상록수(삼나무) 잎은 따로
    const cedar = specs.find(s => s.slug === 'cedar');
    if (cedar) pal.evergreen = (season === 'winter' && cedar.variants?.snow?.palette?.leaf) || cedar.palette?.leaf;
    out[season] = { ...FALLBACK[season], ...flat, ...pal };
  }
  return out;
}

export const fallbackPalettes = () => buildSeasonPalettes([]);
