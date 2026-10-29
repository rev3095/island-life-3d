// 벽지·바닥 무늬 그리기: 스펙 pattern(검수 보드 SVG 무늬와 같은 좌표) → 캔버스 → three 텍스처 / 상점 견본 그림.
// 무늬 한 칸의 가장자리를 넘는 모양은 옆 칸 자리에도 한 번 더 그려서 이음매 없이 반복된다.
import { resolveFill } from './interior.js';

const MIN_PX = 128;      // 텍스처 한 칸의 짧은 변 (픽셀)
const MAX_PX = 512;

/** pattern 한 칸을 ctx2d 에 그린다 (k = 무늬 좌표 1 → 픽셀) */
function paint(g, spec, k) {
  const p = spec.pattern;
  const [tw, th] = p.tile;
  g.save();
  g.scale(k, k);
  g.fillStyle = resolveFill(spec, p.base) ?? '#FFFFFF';
  g.fillRect(0, 0, tw, th);
  for (const s of p.shapes ?? []) {
    for (const ox of [-tw, 0, tw]) for (const oy of [-th, 0, th]) {
      g.save();
      g.translate(ox, oy);
      g.globalAlpha = s.opacity ?? 1;
      let path;
      if (s.rect) {
        const [x, y, w, h] = s.rect;
        path = new Path2D();
        if (s.rx && path.roundRect) path.roundRect(x, y, w, h, s.rx); else path.rect(x, y, w, h);
      } else if (s.circle) {
        const [cx, cy, r] = s.circle;
        path = new Path2D();
        path.arc(cx, cy, r, 0, Math.PI * 2);
      } else if (s.ellipse) {
        const [cx, cy, rx, ry] = s.ellipse;
        path = new Path2D();
        path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else if (s.path) path = new Path2D(s.path);
      if (path) {
        const fill = resolveFill(spec, s.fill), stroke = resolveFill(spec, s.stroke);
        if (fill) { g.fillStyle = fill; g.fill(path); }
        if (stroke) { g.strokeStyle = stroke; g.lineWidth = s.strokeWidth ?? 1; g.stroke(path); }
      }
      g.restore();
    }
  }
  g.restore();
}

/** 스펙 → 무늬 한 칸 캔버스 */
export function patternCanvas(spec, minPx = MIN_PX) {
  const [tw, th] = spec.pattern.tile;
  const k = Math.min(MAX_PX / Math.max(tw, th), Math.max(1, Math.ceil(minPx / Math.min(tw, th))));
  const cv = document.createElement('canvas');
  cv.width = Math.round(tw * k);
  cv.height = Math.round(th * k);
  paint(cv.getContext('2d'), spec, cv.width / tw);
  return cv;
}

/** 스펙 → 반복 텍스처. UV 를 m 단위로 주면 repeat = 1 / size 로 실제 크기가 맞는다 */
export function patternTexture(THREE, spec, renderer) {
  const tex = new THREE.CanvasTexture(patternCanvas(spec));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / spec.pattern.size[0], 1 / spec.pattern.size[1]);
  tex.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
  tex.name = spec.slug;
  return tex;
}

/** 상점·메뉴 견본: 무늬를 몇 칸 반복한 네모 그림 (data: URL). 실제 크기 비율대로 m 칸을 보여 준다 */
export function swatchURL(spec, { px = 96, meters = 1.2 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d');
  const tile = patternCanvas(spec, 64);
  const [sw, sh] = spec.pattern.size;
  const pat = g.createPattern(tile, 'repeat');
  // 한 칸 = (sw / meters) * px 픽셀이 되게 비례
  const sx = (sw / meters) * px / tile.width, sy = (sh / meters) * px / tile.height;
  pat.setTransform?.(new DOMMatrix().scale(sx, sy));
  g.fillStyle = pat;
  g.fillRect(0, 0, px, px);
  return cv.toDataURL('image/png');
}
