// 스타일 조절 값 표와 프리셋 읽기. 값 하나 = 슬라이더 하나 (style-editor.html 이 이 표로 조절판을 만든다).
// 프리셋 값(cozy · toon · 집 안 덧씌우기)은 assets/style/presets.json 에 있다 — 스타일 편집기에서 고르고 채팅 "스타일 반영" 으로 고친다.
// 새 값을 더하려면: PARAMS 에 한 줄 + presets.json 의 프리셋마다 기본값 + src/render/index.js 의 apply() 에서 uniform 에 연결. (docs/SHADERS.md)

export const STYLE_FILE = 'assets/style/presets.json';

/** 조절 값: key, 이름(화면), 묶음, 종류(range|color|select|bool), 범위 */
export const PARAMS = [
  // ── 명암 ──
  { key: 'bands', label: '명암 띠 수', group: '명암', type: 'range', min: 2, max: 5, step: 1 },
  { key: 'bandSoft', label: '띠 경계 부드러움', group: '명암', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'shadeFloor', label: '그늘 쪽 밝기', group: '명암', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'wrap', label: '감싸는 빛', group: '명암', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'castDark', label: '드리운 그림자 진하기', group: '명암', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'ao', label: '바닥 접촉 그늘', group: '명암', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'aoHeight', label: '접촉 그늘 높이', group: '명암', type: 'range', min: 0.1, max: 1.5, step: 0.01 },
  // ── 색 ──
  { key: 'shadeTint', label: '그늘 색', group: '색', type: 'color' },
  { key: 'litTint', label: '햇빛 색', group: '색', type: 'color' },
  { key: 'shadeSat', label: '그늘 채도', group: '색', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'paint', label: '붓질 색 흔들림', group: '색', type: 'range', min: 0, max: 0.3, step: 0.005 },
  { key: 'paintScale', label: '붓질 무늬 크기', group: '색', type: 'range', min: 0.05, max: 1.5, step: 0.01 },
  // ── 빛 ──
  { key: 'rim', label: '가장자리 빛 (배경)', group: '빛', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'rimChar', label: '가장자리 빛 (캐릭터)', group: '빛', type: 'range', min: 0, max: 2, step: 0.01 },
  { key: 'rimPower', label: '가장자리 빛 폭', group: '빛', type: 'range', min: 1, max: 6, step: 0.1 },
  { key: 'spec', label: '장난감 하이라이트', group: '빛', type: 'range', min: 0, max: 2, step: 0.01 },
  { key: 'specSize', label: '하이라이트 크기', group: '빛', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'glow', label: '불꽃·반딧불 빛나기', group: '빛', type: 'range', min: 0, max: 3, step: 0.01 },
  // ── 움직임 ──
  { key: 'wind', label: '바람 (잎·꽃)', group: '움직임', type: 'range', min: 0, max: 2, step: 0.01 },
  { key: 'windSpeed', label: '바람 빠르기', group: '움직임', type: 'range', min: 0.2, max: 3, step: 0.01 },
  { key: 'water', label: '물결 반짝임', group: '움직임', type: 'range', min: 0, max: 2, step: 0.01 },
  { key: 'waterScale', label: '물결 무늬 크기', group: '움직임', type: 'range', min: 0.3, max: 3, step: 0.01 },
  // ── 외곽선 ──
  { key: 'outline', label: '외곽선', group: '외곽선', type: 'select', options: [['off', '없음'], ['subtle', '은은하게'], ['ink', '잉크 (예전)']] },
  { key: 'outlineScale', label: '굵기 (은은하게)', group: '외곽선', type: 'range', min: 0.1, max: 1.5, step: 0.01 },
  { key: 'outlineTint', label: '물체 색 섞기', group: '외곽선', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'outlineDark', label: '물체 색 어둡게', group: '외곽선', type: 'range', min: 0.1, max: 1, step: 0.01 },
  // ── 화면 효과 ──
  { key: 'post', label: '화면 효과 켜기', group: '화면 효과', type: 'bool' },
  { key: 'exposure', label: '노출', group: '화면 효과', type: 'range', min: 0.5, max: 1.6, step: 0.01 },
  { key: 'shoulder', label: '밝은 곳 눌러주기 시작', group: '화면 효과', type: 'range', min: 0.4, max: 1, step: 0.01 },
  { key: 'bloom', label: '빛 번짐', group: '화면 효과', type: 'range', min: 0, max: 1.5, step: 0.01 },
  { key: 'bloomRadius', label: '빛 번짐 폭', group: '화면 효과', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'bloomThreshold', label: '빛 번짐 문턱', group: '화면 효과', type: 'range', min: 0.5, max: 2, step: 0.01 },
  { key: 'tiltTop', label: '위쪽 흐림 (먼 곳)', group: '화면 효과', type: 'range', min: 0, max: 4, step: 0.01 },
  { key: 'tiltBottom', label: '아래쪽 흐림', group: '화면 효과', type: 'range', min: 0, max: 4, step: 0.01 },
  { key: 'tiltFocus', label: '또렷한 줄 위치', group: '화면 효과', type: 'range', min: 0.2, max: 0.8, step: 0.01 },
  { key: 'tiltRange', label: '또렷한 띠 폭', group: '화면 효과', type: 'range', min: 0.05, max: 0.8, step: 0.01 },
  { key: 'fxaa', label: '가장자리 매끈 (FXAA)', group: '화면 효과', type: 'bool' },
  // ── 색 보정 ──
  { key: 'saturation', label: '채도', group: '색 보정', type: 'range', min: 0.5, max: 1.6, step: 0.01 },
  { key: 'contrast', label: '대비', group: '색 보정', type: 'range', min: 0.7, max: 1.3, step: 0.01 },
  { key: 'warmth', label: '따뜻함', group: '색 보정', type: 'range', min: -1, max: 1, step: 0.01 },
  { key: 'lift', label: '어두운 곳 띄우기', group: '색 보정', type: 'range', min: -0.1, max: 0.2, step: 0.005 },
  { key: 'liftTint', label: '띄우는 색', group: '색 보정', type: 'color' },
  { key: 'gamma', label: '중간 밝기', group: '색 보정', type: 'range', min: 0.7, max: 1.4, step: 0.01 },
  { key: 'gain', label: '밝은 곳', group: '색 보정', type: 'range', min: 0.8, max: 1.2, step: 0.01 },
  { key: 'vignette', label: '가장자리 어둡게', group: '색 보정', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'vignetteSoft', label: '가장자리 퍼짐', group: '색 보정', type: 'range', min: 0.1, max: 1, step: 0.01 },
];

/** 값 하나 검사: 맞으면 null, 아니면 이유 글 */
export function checkValue(p, v) {
  if (p.type === 'range') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '숫자가 아니에요';
    if (v < p.min || v > p.max) return `범위 ${p.min}~${p.max} 밖이에요`;
    if (p.step >= 1 && !Number.isInteger(v)) return '정수여야 해요';
    return null;
  }
  if (p.type === 'color') return /^#[0-9a-f]{6}$/i.test(String(v)) ? null : '#RRGGBB 색이 아니에요';
  if (p.type === 'select') return p.options.some(([k]) => k === v) ? null : `${p.options.map(([k]) => k).join('·')} 중 하나여야 해요`;
  if (p.type === 'bool') return typeof v === 'boolean' ? null : 'true/false 여야 해요';
  return '모르는 종류';
}

/** presets.json 모양 검사 → 문제 목록 (빈 배열이면 통과). 테스트·스타일 편집기·"스타일 반영" 이 같이 쓴다 */
export function checkStyle(data) {
  const out = [];
  if (!data || typeof data !== 'object') return ['스타일 값이 객체가 아니에요'];
  const byKey = new Map(PARAMS.map(p => [p.key, p]));
  if (!Number.isInteger(data.version) || data.version < 0) out.push('version 은 0 이상 정수');
  const names = Object.keys(data.presets ?? {});
  if (!names.length) out.push('presets 가 비었어요');
  if (!names.includes(data.default)) out.push(`default '${data.default}' 프리셋이 없어요`);
  for (const name of names) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) out.push(`프리셋 이름 '${name}' 은 영문 소문자·숫자·- 로`);
    if (typeof data.labels?.[name] !== 'string' || !data.labels[name]) out.push(`labels.${name} 이름이 없어요`);
    const v = data.presets[name] ?? {};
    for (const p of PARAMS) {
      if (!(p.key in v)) { out.push(`${name}.${p.key} 값이 없어요`); continue; }
      const why = checkValue(p, v[p.key]);
      if (why) out.push(`${name}.${p.key} = ${JSON.stringify(v[p.key])}: ${why}`);
    }
    for (const k of Object.keys(v)) if (!byKey.has(k)) out.push(`${name}.${k}: 모르는 값`);
  }
  for (const [name, v] of Object.entries(data.indoor ?? {})) {
    if (!names.includes(name)) out.push(`indoor.${name}: 그런 프리셋이 없어요`);
    for (const [k, x] of Object.entries(v ?? {})) {
      const p = byKey.get(k);
      if (!p) { out.push(`indoor.${name}.${k}: 모르는 값`); continue; }
      const why = checkValue(p, x);
      if (why) out.push(`indoor.${name}.${k} = ${JSON.stringify(x)}: ${why}`);
    }
  }
  return out;
}

// 값 읽기: 브라우저는 게임 로더(assets.js 의 loadJSON — 웹 빌드 묶음·다시 받기까지 같이 탄다).
// Node(테스트)는 읽지 않고 비워 둔다 — 테스트는 파일을 직접 읽어 checkStyle 에 넣는다.
const data = typeof document === 'undefined' ? null : await (await import('../core/assets.js')).loadJSON(STYLE_FILE);
if (data) { const bad = checkStyle(data); if (bad.length) console.warn(`[render] ${STYLE_FILE} 문제 ${bad.length}개 (범위 밖 값은 잘라 쓴다)`, bad); }

/** 프리셋 { cozy: {...}, toon: {...} } — 'toon' = 2차 이전 모습 (2단 명암, 갈색 잉크 외곽선, 화면 효과 없음), 'cozy' = 동숲풍 기본 */
export const PRESETS = structuredClone(data?.presets ?? {});
/** 집 안(scene:indoor)에서 프리셋 위에 얹는 값: 실내 빛이 이미 따뜻해서 햇빛 색·따뜻함·채도를 덜고, 그늘은 덜 파랗게, 흐림은 약하게 */
export const INDOOR = structuredClone(data?.indoor ?? {});
export const DEFAULT_PRESET = data?.default ?? 'cozy';
export const PRESET_LABELS = { ...(data?.labels ?? {}) };
/** 게임에 들어간 스타일 반영 버전 (편집기의 applied/style 과 같다) */
export const STYLE_VERSION = data?.version ?? 0;

/** 스타일 편집기 전용: 집 안 덧씌우기 값을 통째로 바꿔 끼운다 (render 가 다음 apply 때 읽는다). 게임은 쓰지 않는다 */
export function replaceIndoor(map) {
  for (const k of Object.keys(INDOOR)) delete INDOOR[k];
  Object.assign(INDOOR, structuredClone(map ?? {}));
}
