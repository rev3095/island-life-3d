// 7차 M7-P3 섬폰 "보기 편하게" (UI-10, 보드 wave7 D42-A 기본 묶음): 글자 크기 3단계 · 색만으로 구분하지 않기 ·
// 흔들림 줄이기 · 이모티콘 뜻 글자 · 소리 신호 글자. 값은 state.settings 에 (다른 설정처럼 저장된다),
// 화면에는 <html> 의 CSS 변수·class 로 건다 → ui 밖 모듈(축제·장면·첫날 css)도 같은 class 로 따라올 수 있다.
//   --pk-fs        글자 배율 (1 · 1.15 · 1.3)            html[data-pk-text="normal|large|huge"]
//   .pk-shapes     색 말고 모양·글자로도 (✓·켬/끔·밑줄)
//   .pk-calm       흔들림 줄이기 (움직임·튀는 효과 끄기, 카메라 앞보기 줄이기) / .pk-calm-off = 꺼 둠 (ui 가 없는 페이지는 둘 다 없어 기기 설정)
//   .pk-emote-words 이모티콘 밑에 뜻 글자
//   (소리 신호 글자는 ui 가 sfx 이벤트를 듣고 화면에 자막으로)
// DOM 없이도 불러올 수 있다 (tests/access.test.mjs).

/** 설정 칸 이름과 기본값. calm 은 정하지 않으면(undefined) 기기 설정(prefers-reduced-motion)을 따른다 */
export const ACCESS_DEFAULTS = { textSize: 'normal', shapes: false, calm: undefined, emoteText: false, soundText: false };
export const ACCESS_KEYS = Object.keys(ACCESS_DEFAULTS);

/** 글자 크기 3단계: 키 → [배율, 화면 이름] */
export const TEXT_SIZES = { normal: [1, '보통'], large: [1.15, '크게'], huge: [1.3, '아주 크게'] };

/** settings + 기기 움직임 줄이기 → 화면에 걸 값 */
export function resolveAccess(settings = {}, systemCalm = false) {
  const textSize = TEXT_SIZES[settings.textSize] ? settings.textSize : ACCESS_DEFAULTS.textSize;
  return {
    textSize,
    scale: TEXT_SIZES[textSize][0],
    shapes: settings.shapes === true,
    calm: typeof settings.calm === 'boolean' ? settings.calm : !!systemCalm,
    emoteText: settings.emoteText === true,
    soundText: settings.soundText === true,
  };
}

/** 풀어 둔 값을 <html> 에 건다 */
export function applyAccess(a, root = document.documentElement) {
  root.style.setProperty('--pk-fs', String(a.scale));
  root.dataset.pkText = a.textSize;
  root.classList.toggle('pk-shapes', a.shapes);
  root.classList.toggle('pk-calm', a.calm);
  root.classList.toggle('pk-calm-off', !a.calm);   // 기기는 움직임 줄이기인데 섬폰에서 끈 경우 — css 의 @media 를 이긴다
  root.classList.toggle('pk-emote-words', a.emoteText);
  root.classList.toggle('pk-sound-words', a.soundText);
}

/**
 * 소리 신호 → 자막. 이름은 assets/sound/sfx.json 의 키. 놀이에 뜻이 있는 소리만 (발소리·메뉴 딸깍·가방 열기는 뺀다).
 * strong = 놓치면 안 되는 신호 (낚시 입질) → 크게·오래
 */
export const SOUND_CAPTIONS = {
  cast: { text: '휙 — 찌를 던졌어요', icon: '🎣' },
  nibble: { text: '톡톡 — 찌를 건드려요', icon: '🎣' },
  bite: { text: '덥석! 지금 당겨요', icon: '❗', strong: true },
  splash: { text: '첨벙', icon: '💦' },
  catch: { text: '잡았다! (짠)', icon: '🎵' },
  'net-swing': { text: '휙 — 잠자리채', icon: '🥅' },
  'bug-catch': { text: '잡았다! (뽁)', icon: '🎵' },
  shake: { text: '바스락 — 나무가 흔들려요', icon: '🌳' },
  'fruit-drop': { text: '툭 — 무언가 떨어졌어요', icon: '⬇️' },
  acorn: { text: '짤랑 — 도토리', icon: '🌰' },
  dig: { text: '푹 — 땅을 팠어요', icon: '⛏️' },
  fossil: { text: '무언가 묻혀 있었어요!', icon: '✨' },
  'axe-wood': { text: '탁 — 나무를 찍었어요', icon: '🪓' },
  'axe-rock': { text: '깡 — 바위를 쳤어요', icon: '🪨' },
  water: { text: '졸졸 — 물을 줬어요', icon: '💧' },
  pickup: { text: '뽁 — 주웠어요', icon: '👜' },
  sell: { text: '짤랑 — 팔았어요', icon: '🌰' },
  door: { text: '끼익 — 문', icon: '🚪' },
  bee: { text: '윙윙 — 벌이에요! 도망쳐요', icon: '🐝', strong: true },
};

/** sfx 이벤트 내용 → 자막 { text, icon, strong } | null (너무 작은 소리·뜻 없는 소리는 null) */
export function captionFor(p) {
  const c = p?.name && SOUND_CAPTIONS[p.name];
  if (!c) return null;
  if (p.volume != null && p.volume < 0.05) return null;
  return { icon: c.icon, text: c.text, strong: !!c.strong };
}

const SHOW_SEC = 1.8, STRONG_SEC = 2.6, MAX_LINES = 3;

/**
 * 자막 줄 (화면 아래 가운데, 손가락 조작 자리는 ui.css 가 피한다). 같은 자막이 곧바로 또 오면 줄을 늘리지 않고 ×2 로.
 * show(caption) · root
 */
export function createCaptions(h) {
  const root = h('div', { class: 'pk-captions', 'aria-hidden': 'true' });
  const lines = [];
  function drop(line) {
    clearTimeout(line.timer);
    line.el.classList.add('is-out');
    setTimeout(() => line.el.remove(), 250);
    lines.splice(lines.indexOf(line), 1);
  }
  return {
    root,
    show(c) {
      if (!c) return;
      const sec = (c.strong ? STRONG_SEC : SHOW_SEC) * 1000;
      const same = lines.find(l => l.text === c.text);
      if (same) {
        same.n += 1;
        same.count.textContent = `×${same.n}`;
        clearTimeout(same.timer);
        same.timer = setTimeout(() => drop(same), sec);
        return;
      }
      const count = h('span', { class: 'pk-caption-n' });
      const el = h('div', { class: `pk-caption${c.strong ? ' is-strong' : ''}` },
        h('span', { class: 'pk-caption-icon' }, c.icon), h('span', null, c.text), count);
      const line = { text: c.text, el, count, n: 1 };
      line.timer = setTimeout(() => drop(line), sec);
      lines.push(line);
      root.append(el);
      while (lines.length > MAX_LINES) drop(lines[0]);
    },
    clear() { [...lines].forEach(drop); },
  };
}
