// 이름표: 가까이 가면 머리 위에 작은 이름 띠. DOM (ctx.uiRoot) 에 그리고, 창·대화가 열려 있으면 숨긴다.
// 곡면 월드 셰이더와 같은 식으로 높이를 내려서 머리 위에 붙어 보이게 한다.

const SHOW_DIST = 3.4;

export function createLabels(ctx) {
  const { THREE } = ctx;
  const layer = document.createElement('div');
  layer.className = 'town-labels';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  ctx.uiRoot.prepend(layer);           // HUD·창보다 아래 층
  const v = new THREE.Vector3();
  const tags = new Map();

  function tagFor(actor, name, color) {
    let t = tags.get(actor);
    if (t) return t;
    const el = document.createElement('span');
    el.textContent = name;
    el.style.cssText = `position:absolute;left:0;top:0;padding:2px 11px 3px;border-radius:999px;white-space:nowrap;
      font:15px/1.2 var(--display, "Jua", sans-serif);background:${color};color:${inkOn(color)};
      box-shadow:0 2px 0 rgba(74,59,50,.22);opacity:0;transition:opacity .25s;will-change:transform`;
    layer.append(el);
    t = { el, shown: false };
    tags.set(actor, t);
    return t;
  }

  /** list = [{ actor, name, color, show }] — show 가 false 면 거리와 상관없이 숨긴다 */
  function update(list) {
    const player = ctx.services.player;
    const blocking = !!ctx.services.ui?.isBlocking?.();
    const W = ctx.uiRoot.clientWidth || innerWidth, H = ctx.uiRoot.clientHeight || innerHeight;
    const k = ctx.materials.curve.uCurve.value, oz = ctx.materials.curve.uCurveOrigin.value.z;
    for (const it of list) {
      const t = tagFor(it.actor, it.name, it.color);
      const p = it.actor.position;
      const near = player && it.show !== false && it.actor.visible && it.actor.opacity > 0.6
        && Math.hypot(p.x - player.position.x, p.z - player.position.z) < SHOW_DIST;
      let on = near && !blocking;
      if (on) {
        const dz = p.z - oz;
        v.set(p.x, p.y + it.actor.height + 0.22 - dz * dz * k, p.z).project(ctx.camera);
        on = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        if (on) t.el.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px) translate(-50%, -100%) rotate(-3deg)`;
      }
      if (on !== t.shown) { t.shown = on; t.el.style.opacity = on ? '1' : '0'; }
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
