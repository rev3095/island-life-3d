// 섬 전용 이모티콘 세트 (EM-01–36, assets/emotes/emotes.json) 읽기와 그리기. 대화 규칙은 assets/emotes/talk.json (공통) + 주민 파일 emote 칸 (6차 M6-P3).
// 말풍선·선택기에 쓰는 낱말(토큰): 이모티콘 key ('wave') 또는 아이템 'item:<아이템 id>' (그 아이템의 3D 아이콘, Z1).
import { withVillagers } from './judge.js';
import { url as assetUrl, urlNow } from '../../core/packs.js';

export const EMOTES_FILE = 'assets/emotes/emotes.json';
export const TALK_FILE = 'assets/emotes/talk.json';
const INK = '#4A3B32';

/** 부탁 분류 → 말풍선 낱말 (분류 이모티콘이 없으면 그 분류의 대표 아이템 아이콘) */
export const CAT_TOKEN = { fish: 'fish', bug: 'bug', fruit: 'fruit', flower: 'flower', shell: 'item:shell.clam', fossil: 'item:fossil.ammonite', mat: 'item:mat.wood', seed: 'item:seed.tulip', furn: 'gift' };

export async function loadEmotes() {
  const [set, rules] = await Promise.all([EMOTES_FILE, TALK_FILE].map(f => fetch(f).then(r => {
    if (!r.ok) throw new Error(`${f} ${r.status}`);
    return r.json();
  })));
  const { VILLAGERS } = await import('../town/people.js');
  return createEmoteSet(set, withVillagers(rules, VILLAGERS));
}

/**
 * set = emotes.json, rules = talk.json → 그리기·이름 도구.
 * imgUrl(path) = 아이템 그림 경로 → <img src> 주소 | null — 게시본에서는 그림이 묶음 안에 있어 blob 주소를 써야 한다 (core/packs.js).
 * 아직 주소가 없으면(null) 이번엔 이모지로 그리고 주소를 받아 둔다 (다음 말풍선부터 그림)
 */
export function createEmoteSet(set, rules, { imgUrl = urlNow, prefetch = p => assetUrl(p).catch(() => {}) } = {}) {
  const byKey = new Map(set.emotes.map(e => [e.key, e]));
  const svg = (key, label) => {
    const e = byKey.get(key);
    if (!e) return '';
    return `<svg viewBox="0 0 48 48" ${label ? `role="img" aria-label="${e.name}"` : 'aria-hidden="true"'} class="fe-emo"><g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${e.svg}</g></svg>`;
  };
  return {
    set, rules, byKey,
    cats: set.cats.filter(c => c.key !== 'reply'),
    player: set.emotes.filter(e => e.cat !== 'reply'),
    name: key => byKey.get(key)?.name ?? key,
    glyph: key => byKey.get(key)?.glyph ?? '',
    svg,
    /** 낱말 하나 → HTML (아이템은 아이콘 그림). items = data.items */
    token(tok, items, label = true) {
      if (typeof tok === 'string' && tok.startsWith('item:')) {
        const it = items?.get?.(tok.slice(5));
        if (!it) return svg('gift', label);
        const alt = label ? `alt="${it.name}"` : 'alt="" aria-hidden="true"';
        const isPic = /\.(png|webp|jpe?g|svg)$/i.test(it.icon ?? '');
        const src = isPic ? imgUrl(it.icon) : null;
        if (src) return `<img class="fe-emo fe-item" src="${src}" ${alt}>`;
        if (isPic) prefetch(it.icon);
        return `<span class="fe-emo fe-glyph" ${label ? `role="img" aria-label="${it.name}"` : 'aria-hidden="true"'}>${(isPic ? null : it.icon) ?? it.emoji ?? '🎁'}</span>`;
      }
      return svg(tok, label);
    },
    /** 스크린리더·목소리용 이름 줄 */
    say: (toks, items) => toks.map(t => (String(t).startsWith('item:') ? items?.get?.(t.slice(5))?.name ?? '물건' : byKey.get(t)?.name ?? t)).join(', '),
  };
}
