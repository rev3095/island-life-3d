// DOM 만들기 도우미와 화면 곳곳에서 같이 쓰는 표시 함수 (아이템·도구·시계·조사).

/** h('button', { class, text, onclick, ... }, ...자식) → 요소 */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

let uid = 0;
export const nextId = prefix => `${prefix}-${++uid}`;

export const fmt = n => Number(n || 0).toLocaleString('ko-KR');

// ---------- 아이템 ----------

/** data 모듈에 아이템 정보가 없을 때 쓰는 분류별 기본 아이콘 (자리표시) */
const CATEGORY_ICON = { fish: '🐟', bug: '🦋', fossil: '🦴', fruit: '🍎', mat: '🪵', tool: '🛠️', furn: '🪑', shell: '🐚', flower: '🌷', seed: '🌱' };
export const CATEGORY_NAME = { fish: '물고기', bug: '곤충', fossil: '화석', fruit: '과일', mat: '재료', tool: '도구', furn: '가구', shell: '조개', flower: '꽃', seed: '씨앗' };
export const DEX_CATEGORIES = ['fish', 'bug', 'fossil'];

/** 아이템 id → 화면에 쓸 정보. data 가 없거나 모르는 id 여도 무언가를 보여준다. */
export function itemInfo(ctx, id) {
  const it = id ? ctx.services.data?.items?.get?.(id) : null;
  const category = it?.category ?? String(id ?? '').split('.')[0];
  // 값은 data.economy 가 정한다 (섬 특산 과일은 싸게 사 준다). 없으면 아이템 칸에서
  const eco = it ? ctx.services.data?.economy : null;
  return {
    id, category, known: !!it,
    name: it?.name ?? id ?? '',
    icon: it?.icon ?? CATEGORY_ICON[category] ?? '❔',
    sell: eco?.sellPrice?.(id) ?? it?.sellPrice ?? it?.price ?? 0,                  // 상점이 사 주는 값
    buy: eco?.buyPrice?.(id) || (it?.buyPrice ?? it?.buy ?? it?.price ?? 0),       // 상점에서 살 때 값
  };
}

/** 아이콘 값(이모지 글자 또는 그림 경로) → 요소 */
export function iconEl(icon, cls = 'pk-icon') {
  if (typeof icon === 'string' && /\.(svg|png|webp|jpe?g)$/i.test(icon)) return h('img', { class: cls, src: icon, alt: '' });
  return h('span', { class: cls, 'aria-hidden': 'true', text: icon ?? '' });
}

// ---------- 도구 ----------

const O = 'stroke="#4A3B32" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
// 테두리 있는 굵은 선: 진한 선 위에 색 선을 겹친다
const stick = (d, color) => `<path d="${d}" fill="none" stroke="#4A3B32" stroke-width="7.5" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`;
const TOOL_SVG = {
  none: `<ellipse cx="24" cy="31" rx="10" ry="8.5" fill="#F6D7B0" ${O}/>${[[12.5, 20], [19.5, 13.5], [28.5, 13.5], [35.5, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#F6D7B0" ${O}/>`).join('')}`,
  rod: `${stick('M9 41 L35 8', '#B98957')}<circle cx="15" cy="33.5" r="3.6" fill="#E9E1CF" ${O}/><path d="M35 8 Q42 17 39 28" fill="none" stroke="#4A3B32" stroke-width="1.6"/><circle cx="39" cy="32" r="4.6" fill="#F07A6A" ${O}/><path d="M34.6 32 h8.8" stroke="#fff" stroke-width="2"/>`,
  net: `${stick('M8 42 L23 25', '#B98957')}<circle cx="31" cy="17" r="11" fill="#EAF6F8" ${O}/><path d="M24 11 L38 23 M22 18 L32 28 M27 7 L40 18 M38 9 L24 25 M41 15 L29 27" stroke="#9DB9C0" stroke-width="1.3"/><circle cx="31" cy="17" r="11" fill="none" ${O}/>`,
  shovel: `${stick('M10 10 L28 28', '#B98957')}${stick('M5 13 L13 5', '#B98957')}<path d="M26 31 L31 26 L41 34 Q44 40 40 43 Q35 45 32 41 Z" fill="#C5CDD4" ${O}/>`,
  axe: `${stick('M13 42 L33 9', '#B98957')}<path d="M26 10 Q33 3 41 9 Q40 18 33 21 Z" fill="#C5CDD4" ${O}/>`,
  can: `<path d="M14 21 Q21 7 29 21" fill="none" stroke="#4A3B32" stroke-width="3"/>${stick('M31 29 L41 18', '#8FC0D8')}<circle cx="42" cy="17" r="3.4" fill="#8FC0D8" ${O}/><rect x="9" y="20" width="24" height="19" rx="5" fill="#8FC0D8" ${O}/><path d="M13 26 h16" stroke="#fff" stroke-width="2" opacity=".7"/>`,
};
export const TOOL_NAME = { none: '맨손', rod: '낚싯대', net: '잠자리채', shovel: '삽', axe: '도끼', can: '물뿌리개' };
export const toolSvg = id => `<svg viewBox="0 0 48 48" aria-hidden="true">${TOOL_SVG[id ?? 'none'] ?? TOOL_SVG.none}</svg>`;

// ---------- 주민·말하는 사람 ----------

/** 캐릭터 slug → 이름·이름표 색 (assets/specs 팔레트에서 골랐다). dialog.open 에 color 가 없을 때 쓴다. */
export const SPEAKERS = {
  player: { name: '나', color: '#5DB7A8' }, coco: { name: '코코', color: '#F2B36B' }, bori: { name: '보리', color: '#6CA0DC' },
  mochi: { name: '모찌', color: '#B9A6E0' }, dubu: { name: '두부', color: '#7FA36B' }, pong: { name: '퐁', color: '#FFD866' },
  chorong: { name: '초롱', color: '#8CCB6E' }, bamtol: { name: '밤톨', color: '#C7743E' }, neuru: { name: '느루', color: '#7A9A5A' },
};

/** 배경색 위에서 더 잘 읽히는 글자색 (흰색 또는 잉크색) */
export function inkOn(hex) {
  const lum = c => {
    let s = String(c).replace('#', '');
    if (s.length === 3) s = [...s].map(x => x + x).join('');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const L = lum(hex);
  if (Number.isNaN(L)) return '#4A3B32';
  return 1.05 / (L + 0.05) >= (L + 0.05) / (lum('#4A3B32') + 0.05) ? '#FFFFFF' : '#4A3B32';
}

// ---------- 시계 ----------

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** time 서비스의 now() 모양 → { time: '오전 10:24', date: '10월 28일 (수)' } */
export function clockText(now) {
  const hr = now.hour ?? 0;
  const wd = typeof now.weekday === 'number' ? WEEK[now.weekday] : now.weekday;
  return {
    time: `${hr < 12 ? '오전' : '오후'} ${hr % 12 || 12}:${String(now.minute ?? 0).padStart(2, '0')}`,
    date: `${now.month}월 ${now.day}일${wd ? ` (${wd})` : ''}`,
  };
}
/** time 서비스가 없을 때: 브라우저 시계로 now() 와 같은 모양을 만든다 */
export function nowFromDate(d = new Date()) {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), weekday: d.getDay() };
}
export const WEATHER_ICON = { clear: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', rainbow: '🌈' };
export const WEATHER_NAME = { clear: '맑음', cloudy: '흐림', rain: '비', snow: '눈', rainbow: '무지개' };

// ---------- 한국어 조사 ----------

/** josa('사과', '을/를') → '사과를' — 마지막 글자 받침에 맞춰 붙인다 */
export function josa(word, pair) {
  const w = String(word ?? '');
  const [withB, withoutB] = pair.split('/');
  const code = w.charCodeAt(w.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${w}${withB}(${withoutB})`;
  const jong = code % 28;
  if (pair === '으로/로') return w + (jong && jong !== 8 ? '으로' : '로');
  return w + (jong ? withB : withoutB);
}
