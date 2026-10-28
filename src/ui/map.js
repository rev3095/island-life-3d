// 지도: world 서비스의 섬 타일을 위에서 본 그림으로 그리고, 장소 표시와 플레이어 위치를 얹는다.
// world 가 없으면 섬 크기만 맞춘 임시 섬을 그린다.
import { h, SPEAKERS } from './dom.js';
import { panelShell } from './panels.js';

const TILE_COLOR = {
  sea: '#6FC0DC', water: '#6BB8D6', sand: '#F1DFAE', grass: '#8FC96E', path: '#D9C089',
  plaza: '#E8D5A8', cliff: '#5E8F4A', ramp: '#C9B07C',
};
const SHALLOW = '#9ED6E8', HIGH_GRASS = '#74B45A';
const PLACE = {
  dock: ['선착장', '⚓'], plaza: ['광장', '⛲'], shop: ['도토리상점', '🏪'], museum: ['박물관', '🏛️'], playerHouse: ['우리 집', '🏠'],
};

export function createMap(ctx, panels) {
  let current = null;

  function open() {
    if (current) return current.p.result;
    let p, focusKey = null;
    const world = ctx.services.world;
    const island = world?.island ?? placeholderIsland(ctx.constants?.ISLAND ?? { w: 64, h: 56 });
    const shell = panelShell({ cls: 'pk-map', title: '섬 지도', onClose: () => p.close(null), onOutside: () => p.close(null) });
    const canvas = h('canvas', { class: 'pk-map-canvas', role: 'img', 'aria-label': '섬을 위에서 본 지도' });
    const frame = h('div', { class: 'pk-map-frame' }, canvas, h('span', { class: 'pk-map-north', 'aria-hidden': 'true' }, '북 ▲'));
    const marks = placeMarks(world?.places);
    const legend = h('ul', { class: 'pk-map-legend', 'aria-label': '장소' },
      h('li', null, h('button', { type: 'button', class: 'pk-legend-btn is-me', dataset: { key: 'me' } }, h('i', { 'aria-hidden': 'true' }, '📍'), '나')),
      marks.map(mk => h('li', null, h('button', { type: 'button', class: 'pk-legend-btn', dataset: { key: mk.key } }, h('i', { 'aria-hidden': 'true' }, mk.icon), mk.label))));
    legend.addEventListener('focusin', e => { focusKey = e.target.closest('[data-key]')?.dataset.key ?? null; draw(); });
    legend.addEventListener('pointerover', e => { const k = e.target.closest('[data-key]')?.dataset.key; if (k && k !== focusKey) { focusKey = k; draw(); } });
    legend.addEventListener('click', e => { const k = e.target.closest('[data-key]')?.dataset.key; if (k) { focusKey = k; draw(); } });
    shell.body.append(h('div', { class: 'pk-map-wrap' }, frame, legend));
    if (island.placeholder) shell.body.prepend(h('p', { class: 'pk-map-note' }, '섬(world) 모듈이 아직 없어서 임시 지도를 보여줘요.'));

    // 타일 그림은 한 번만 그려 두고, 표시만 다시 얹는다
    const S = 10, dpr = Math.min(devicePixelRatio || 1, 2);
    const base = document.createElement('canvas');
    base.width = island.w * S; base.height = island.h * S;
    paintTiles(base.getContext('2d'), island, S);
    canvas.width = Math.round(island.w * S * dpr); canvas.height = Math.round(island.h * S * dpr);
    canvas.style.aspectRatio = `${island.w} / ${island.h}`;
    const g = canvas.getContext('2d');

    function playerPos() {
      const pos = ctx.services.player?.position ?? ctx.state.player;
      return pos ? toTile(island, pos.x, pos.z) : null;
    }
    function draw() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(base, 0, 0, canvas.width, canvas.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const mk of marks) {
        const t = toTile(island, mk.x, mk.z);
        if (t) pin(g, (t.tx + 0.5) * S, (t.tz + 0.5) * S, mk.icon, mk.key === focusKey ? mk.label : null);
      }
      const me = playerPos();
      if (me) meDot(g, (me.tx + 0.5) * S, (me.tz + 0.5) * S, ctx.services.player?.facing, focusKey === 'me');
    }
    draw();

    const offMove = ctx.events.on('player:moved', draw);
    p = panels.open('map', shell.root, {
      toggleKey: 'KeyM',
      initialFocus: () => legend.querySelector('button'),
      onClose: () => { offMove(); current = null; },
    });
    current = { p };
    ctx.events.emit('sfx', { name: 'menu' });
    return p.result;
  }

  return { open };
}

function placeMarks(places) {
  if (!places) return [];
  const out = [];
  for (const [key, [label, icon]] of Object.entries(PLACE)) if (places[key]) out.push({ key, label, icon, ...places[key] });
  (places.villagerHouses ?? []).forEach((v, i) => out.push({ key: `v${i}`, label: `${SPEAKERS[v.slug]?.name ?? v.slug}네 집`, icon: '🏡', x: v.x, z: v.z }));
  return out;
}

function toTile(island, x, z) {
  if (x == null || z == null) return null;
  return island.toTile ? island.toTile(x, z) : { tx: Math.floor(x + island.w / 2), tz: Math.floor(z + island.h / 2) };
}

function paintTiles(g, island, S) {
  const { w, h } = island;
  const at = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? 'sea' : island.tileAt(x, z));
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const t = at(x, z);
    let c = TILE_COLOR[t] ?? TILE_COLOR.grass;
    if (t === 'sea') {
      // 땅 가까운 바다는 얕은 색
      let near = false;
      for (let dz = -2; dz <= 2 && !near; dz++) for (let dx = -2; dx <= 2; dx++) if (at(x + dx, z + dz) !== 'sea') { near = true; break; }
      if (near) c = SHALLOW;
    } else if (t === 'grass' && island.levelAt?.(x, z) > 0) c = HIGH_GRASS;
    g.fillStyle = c;
    g.fillRect(x * S, z * S, S, S);
  }
  // 언덕 가장자리 그림자: 높은 칸 아래(남쪽)가 낮으면 진하게
  if (island.levelAt) {
    g.fillStyle = 'rgba(74, 59, 50, .28)';
    for (let z = 0; z < h - 1; z++) for (let x = 0; x < w; x++) {
      if (island.levelAt(x, z) > island.levelAt(x, z + 1) && at(x, z + 1) !== 'ramp' && at(x, z) !== 'ramp') g.fillRect(x * S, (z + 1) * S - 3, S, 3);
    }
  }
}

function pin(g, x, y, icon, label) {
  g.save();
  g.shadowColor = 'rgba(74,59,50,.3)'; g.shadowOffsetY = 2; g.shadowBlur = 3;
  g.fillStyle = '#FFF8E6';
  g.beginPath(); g.arc(x, y - 4, 11, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = label ? '#E0663A' : '#A8642E'; g.lineWidth = label ? 3 : 2;
  g.beginPath(); g.arc(x, y - 4, 11, 0, Math.PI * 2); g.stroke();
  g.font = '13px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  g.fillText(icon, x, y - 3);
  if (label) tag(g, x, y - 26, label);
}

function meDot(g, x, y, facing, focused) {
  g.save();
  g.fillStyle = 'rgba(224, 102, 58, .25)';
  g.beginPath(); g.arc(x, y, focused ? 14 : 10, 0, Math.PI * 2); g.fill();
  g.translate(x, y);
  g.rotate(-(facing ?? 0));   // facing 0 = -Z = 지도 위쪽. three 의 rotation.y 처럼 +값이면 위에서 볼 때 반시계
  g.fillStyle = '#E0663A'; g.strokeStyle = '#FFF8E6'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath();
  g.fill(); g.stroke();
  g.restore();
  if (focused) tag(g, x, y - 20, '나');
}

function tag(g, x, y, text) {
  g.font = '13px Jua, "Malgun Gothic", sans-serif';
  const w = g.measureText(text).width + 14;
  g.fillStyle = '#4A3B32';
  g.beginPath();
  if (g.roundRect) g.roundRect(x - w / 2, y - 10, w, 20, 10); else g.rect(x - w / 2, y - 10, w, 20);
  g.fill();
  g.fillStyle = '#FFF8E6';
  g.fillText(text, x, y + 1);
}

/** world 가 없을 때 쓰는 임시 섬: 둥근 섬 + 모래 테두리 */
function placeholderIsland({ w, h }) {
  return {
    w, h, placeholder: true,
    tileAt(x, z) {
      const dx = (x + 0.5 - w / 2) / (w * 0.42), dz = (z + 0.5 - h / 2) / (h * 0.42);
      const r = Math.hypot(dx, dz) + 0.05 * Math.sin(x * 0.7) * Math.cos(z * 0.5);
      return r > 1 ? 'sea' : r > 0.88 ? 'sand' : 'grass';
    },
  };
}
