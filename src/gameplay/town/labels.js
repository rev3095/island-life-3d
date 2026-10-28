// 머리 위 표시: 가까이 가면 이름 띠, 주민끼리 수다 떨 때 말풍선, 우편함 편지 알림. DOM (ctx.uiRoot) 에 그리고 창이 열려 있으면 숨긴다.
// 곡면 월드 셰이더와 같은 식으로 높이를 내려서 머리 위에 붙어 보이게 한다.

const SHOW_DIST = 3.4;       // 이름표
const BUBBLE_DIST = 11;      // 말풍선·알림

export function createLabels(ctx) {
  const { THREE } = ctx;
  const layer = document.createElement('div');
  layer.className = 'town-labels';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  ctx.uiRoot.prepend(layer);           // HUD·창보다 아래 층
  const v = new THREE.Vector3();
  const tags = new Map(), bubbles = new Map();

  const make = css => {
    const el = document.createElement('span');
    el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;opacity:0;transition:opacity .25s;will-change:transform;${css}`;
    layer.append(el);
    return { el, shown: false };
  };
  function tagFor(actor, name, color) {
    let t = tags.get(actor);
    if (!t) {
      t = make(`padding:2px 11px 3px;border-radius:999px;font:15px/1.2 var(--display, "Jua", sans-serif);background:${color};color:${inkOn(color)};box-shadow:0 2px 0 rgba(74,59,50,.22)`);
      t.el.textContent = name;
      tags.set(actor, t);
    }
    return t;
  }
  function bubbleFor(key) {
    let b = bubbles.get(key);
    if (!b) {
      b = make('padding:4px 12px 5px;border-radius:14px;font:14px/1.25 var(--body, "Gowun Dodum", sans-serif);background:#FFF8E6;color:#4A3B32;box-shadow:0 2px 0 #E2D2AE,0 4px 10px rgba(74,59,50,.12)');
      const tail = document.createElement('i');
      tail.style.cssText = 'position:absolute;left:50%;bottom:-6px;width:12px;height:12px;margin-left:-6px;background:#FFF8E6;transform:rotate(45deg);box-shadow:2px 2px 0 #E2D2AE';
      const text = document.createElement('b');
      text.style.cssText = 'position:relative;font-weight:400';
      b.el.append(tail, text);
      b.text = text;
      bubbles.set(key, b);
    }
    return b;
  }

  /** 월드 점 → 화면 좌표 (곡면 보정). 화면 밖이면 null */
  function screenOf(p, lift) {
    const W = ctx.uiRoot.clientWidth || innerWidth, H = ctx.uiRoot.clientHeight || innerHeight;
    const k = ctx.materials.curve.uCurve.value, oz = ctx.materials.curve.uCurveOrigin.value.z;
    const dz = p.z - oz;
    v.set(p.x, p.y + lift - dz * dz * k, p.z).project(ctx.camera);
    if (!(v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1)) return null;
    return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
  }
  const show = (t, on, xy, rot = 0) => {
    if (on && xy) t.el.style.transform = `translate(${xy[0]}px, ${xy[1]}px) translate(-50%, -100%)${rot ? ` rotate(${rot}deg)` : ''}`;
    const vis = on && !!xy;
    if (vis !== t.shown) { t.shown = vis; t.el.style.opacity = vis ? '1' : '0'; }
  };

  /**
   * list = [{ actor, name, color, show, bubble }] — show 가 false 면 이름표를 숨긴다.
   * bubble = 말풍선 글자 (없으면 숨김). actor 는 { position, height, visible, opacity } 만 있으면 된다 (우편함 알림도 이걸로).
   */
  function update(list) {
    const pl = ctx.services.player?.position;
    const blocking = !!ctx.services.ui?.isBlocking?.();
    for (const it of list) {
      const a = it.actor, p = a.position;
      const d = pl ? Math.hypot(p.x - pl.x, p.z - pl.z) : 99;
      const seen = !blocking && a.visible && a.opacity > 0.6;
      if (it.name) {
        const t = tagFor(a, it.name, it.color);
        const on = seen && it.show !== false && d < SHOW_DIST && !it.bubble;
        show(t, on, on && screenOf(p, a.height + 0.22), -3);
      }
      const b = bubbleFor(a);
      const on = seen && !!it.bubble && d < BUBBLE_DIST;
      if (on && b.text.textContent !== it.bubble) b.text.textContent = it.bubble;
      show(b, on, on && screenOf(p, a.height + 0.3));
    }
  }

  return { update, layer };
}

/** 이름표 배경색 위에서 읽기 좋은 글자색 */
function inkOn(hex) {
  const s = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? '#4A3B32' : '#FFFFFF';
}
