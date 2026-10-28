// 스타일 프리셋과 조절 값 목록. 값 하나 = 슬라이더 하나 (demos/style.html 이 이 표로 조절판을 만든다).
// 새 값을 더하려면: PARAMS 에 한 줄 + 두 프리셋에 기본값 + src/render/index.js 의 apply() 에서 uniform 에 연결. (docs/SHADERS.md)

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

// 'toon' = 2차 이전 모습 그대로 (2단 명암, 갈색 잉크 외곽선, 화면 효과 없음)
const TOON = {
  bands: 2, bandSoft: 0, shadeFloor: 0.659, wrap: 1, castDark: 1, ao: 0, aoHeight: 0.45,
  shadeTint: '#FFFFFF', litTint: '#FFFFFF', shadeSat: 0, paint: 0, paintScale: 0.35,
  rim: 0, rimChar: 0, rimPower: 3, spec: 0, specSize: 0.5,
  wind: 0, windSpeed: 1, water: 0, waterScale: 1,
  outline: 'ink', outlineScale: 1, outlineTint: 0, outlineDark: 0.55,
  post: false, exposure: 1, shoulder: 1, bloom: 0, bloomRadius: 0.4, bloomThreshold: 1.1,
  tiltTop: 0, tiltBottom: 0, tiltFocus: 0.45, tiltRange: 0.35, fxaa: false,
  saturation: 1, contrast: 1, warmth: 0, lift: 0, liftTint: '#FFFFFF', gamma: 1, gain: 1, vignette: 0, vignetteSoft: 0.6,
};

// 'cozy' = 동숲풍 기본: 부드러운 3단 명암, 보랏빛 그늘·따뜻한 햇빛, 은은한 외곽선, 빛 번짐·위쪽 흐림·색 보정
const COZY = {
  bands: 3, bandSoft: 0.55, shadeFloor: 0.5, wrap: 0.45, castDark: 0.7, ao: 0.35, aoHeight: 0.45,
  shadeTint: '#D8CEF2', litTint: '#FFF6E8', shadeSat: 0.3, paint: 0.07, paintScale: 0.35,
  rim: 0.25, rimChar: 0.9, rimPower: 2.6, spec: 0.8, specSize: 0.5,
  wind: 1, windSpeed: 1, water: 1, waterScale: 1,
  outline: 'subtle', outlineScale: 0.6, outlineTint: 0.8, outlineDark: 0.5,
  post: true, exposure: 1.06, shoulder: 0.72, bloom: 0.35, bloomRadius: 0.5, bloomThreshold: 1.05,
  tiltTop: 1.2, tiltBottom: 0.45, tiltFocus: 0.5, tiltRange: 0.4, fxaa: true,
  saturation: 1.12, contrast: 1.02, warmth: 0.1, lift: 0.03, liftTint: '#9C8FD0', gamma: 1, gain: 1, vignette: 0.25, vignetteSoft: 0.6,
};

export const PRESETS = { cozy: COZY, toon: TOON };
export const DEFAULT_PRESET = 'cozy';
export const PRESET_LABELS = { cozy: '포근 (동숲풍)', toon: '툰 (예전)' };
