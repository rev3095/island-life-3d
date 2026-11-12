// M15 UI-27 추억 앨범: 같이 낚시·산책 · 저녁 노래 · 주민 생일 방 · 섬 축제 · 계절 행사 도장 같은 순간을 사진으로 남겨 섬폰 「📷 앨범」에서 본다.
// 사진 = 그 순간 3D 화면을 작게 줄인 JPEG (BOND.album 160×100, 한 장 ≈ 5–8KB) — state.album.list 에 글자(data URL)로 저장된다.
// 사진 하나를 액자로 만들면 (도토리) 가구 아이템 furn.album-frame (FU-71 탁상) · furn.album-frame-wall (FU-72 벽) 이 변형 '사진<id>' 로 가방에 들어오고,
// 집에 놓으면 house/furniture.js 가 album.dress() 를 불러 액자 속 'photo' 재질에 그 사진을 입힌다. 액자에 넣은 사진은 앨범이 꽉 차도 지우지 않는다.
// 서비스 ctx.services.album = { snap(meta), list(), get(id), dress(slug, model, variant), frame(id, kind) }, 창은 ctx.services.ui.album.open (phone.js APPS).
import { h } from './dom.js';
import { panelShell, button, confirmBox } from './panels.js';
import { BOND, albumOf, addPhoto, frameVariant, photoOfVariant } from '../gameplay/town/bond.js';

export const FRAMES = {
  desk: { item: 'furn.album-frame', slug: 'album-frame', name: '추억 액자', price: 300 },        // FU-71
  wall: { item: 'furn.album-frame-wall', slug: 'album-frame-wall', name: '추억 벽 액자', price: 500 },   // FU-72
};
const FRAME_SLUGS = new Set(Object.values(FRAMES).map(f => f.slug));
const KIND = { together: '🤝 같이 놀기', song: '🎵 저녁 노래', birthday: '🎂 생일', festival: '🎉 섬 축제', event: '🌸 계절 행사', snap: '📷 찰칵', letter: '✉️ 편지' };

const CSS = `
.pk-album { width: min(560px, 100%); }
.pk-album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
.pk-album-cell { display: flex; flex-direction: column; gap: 3px; padding: 5px 5px 7px; background: #fff; border: 1px solid #E3D6BE; border-radius: 6px; box-shadow: 0 2px 0 rgba(74,59,50,.08); font: inherit; text-align: left; cursor: pointer; transform: rotate(var(--tilt, 0deg)); }
.pk-album-cell img, .pk-album-big img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 3px; background: #EFE6D6; display: block; }
.pk-album-cell b { font-size: calc(12px * var(--pk-fs, 1)); line-height: 1.25; }
.pk-album-cell span, .pk-album-meta { font-size: calc(11px * var(--pk-fs, 1)); color: var(--pk-ink-soft, #7A6A5C); }
.pk-album-big { background: #fff; padding: 8px 8px 12px; border-radius: 6px; border: 1px solid #E3D6BE; }
.pk-album-big img { image-rendering: auto; }
.pk-album-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pk-album-flash { position: fixed; inset: 0; background: #fff; opacity: .75; pointer-events: none; z-index: 60; transition: opacity .45s ease-out; }
`;
let styled = false;
const style = () => { if (!styled && typeof document !== 'undefined') { styled = true; document.head.append(h('style', { 'data-pk-album': '' }, CSS)); } };

export function createAlbum(ctx, { toast = () => {} } = {}) {
  const S = () => ctx.services;
  const A = () => albumOf(ctx.state);
  const dayKey = () => S().time?.now?.()?.dayKey ?? S().data?.day?.key?.() ?? null;
  const texCache = new Map();   // 사진 id → THREE.Texture

  /** 지금 화면 → 작은 JPEG data URL (못 찍으면 null) */
  function capture() {
    const r = ctx.renderer, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!r || !cv || !ctx.scene || !ctx.camera) return null;
    try {
      r.render(ctx.scene, ctx.camera);
      const src = r.domElement, { width: W, height: H, quality } = BOND.album;
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      // 가운데(플레이어·주민 둘레)를 16:10 으로 잘라 줄인다 — 게임 카메라가 멀리서 내려다봐서 화면 전체면 사람이 너무 작다 (ZOOM)
      const ZOOM = 0.6, sw = src.width, sh = src.height, want = W / H;
      let cw = sw * ZOOM, ch = cw / want;
      if (ch > sh * ZOOM) { ch = sh * ZOOM; cw = ch * want; }
      g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
      return cv.toDataURL('image/jpeg', quality);
    } catch (e) { console.warn('[album] 사진을 못 찍었어요', e); return null; }
  }
  function flash() {
    if (typeof document === 'undefined') return;
    style();
    const f = h('div', { class: 'pk-album-flash', 'aria-hidden': 'true' });
    document.body.append(f);
    setTimeout(() => { f.style.opacity = '0'; setTimeout(() => f.remove(), 500); }, 30);   // rAF 는 탭이 숨으면 안 돌아 플래시가 남는다
  }

  /** 사진 한 장 남기기 → 기록 | null. meta = { kind, who: [slug], title, quiet } */
  async function snap({ kind = 'snap', who = [], title = '', quiet = false } = {}) {
    const img = capture();
    if (!img) return null;
    const rec = addPhoto(ctx.state, { img, day: dayKey(), kind, who, title: title || KIND[kind] || '추억' });
    if (!quiet) { flash(); ctx.events.emit('sfx', { name: 'menu', volume: 0.5 }); toast(`추억 앨범에 남겼어요 · ${rec.title}`, '📷'); }
    ctx.events.emit('album:snap', { id: rec.id, kind });
    return rec;
  }

  const get = id => A().list.find(p => p.id === id) ?? null;

  /** 액자 만들기: 도토리를 내고 가방에 액자 (변형 = 이 사진) → 'ok' | 'money' | 'full' | 'none' */
  function frame(id, kind = 'desk') {
    const p = get(id), F = FRAMES[kind], data = S().data;
    if (!p || !F || !data) return 'none';
    if ((data.inventory?.canFit?.(F.item, 1, { variant: frameVariant(id) }) ?? 1) < 1) return 'full';
    if (!data.wallet.spend(F.price)) return 'money';
    const r = data.collect(F.item, 1, { variant: frameVariant(id) });
    if (r.left > 0) { data.wallet.add(F.price); return 'full'; }
    p.framed = (p.framed ?? 0) + 1;
    ctx.events.emit('album:frame', { id, kind });
    return 'ok';
  }

  /** 집 가구 모델에 사진 입히기 (house/furniture.js make 가 부른다) — 'photo' 재질 메시에 이 사진 */
  function dress(slug, model, variant) {
    if (!FRAME_SLUGS.has(slug) || !model) return false;
    const id = photoOfVariant(variant), p = id != null ? get(id) : null;
    const { THREE } = ctx;
    if (!p || !THREE) return false;
    let tex = texCache.get(id);
    if (!tex) {
      tex = new THREE.TextureLoader().load(p.img);
      tex.colorSpace = THREE.SRGBColorSpace;
      texCache.set(id, tex);
    }
    let done = false;
    model.traverse(o => {
      if (!o.isMesh || ![o.material].flat().some(m => m?.name === 'photo')) return;
      // Blender 상자에는 UV 가 없을 수 있어 가로(x)·세로(y 또는 z 중 긴 쪽)로 다시 깐다
      const g = o.geometry = o.geometry.clone();
      g.computeBoundingBox();
      const b = g.boundingBox, e = new THREE.Vector3().subVectors(b.max, b.min);
      const vAxis = e.y >= e.z ? 'y' : 'z';
      const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) - b.min.x) / (e.x || 1);
        uv[i * 2 + 1] = vAxis === 'y' ? (pos.getY(i) - b.min.y) / (e.y || 1) : 1 - (pos.getZ(i) - b.min.z) / (e.z || 1);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const mat = ctx.materials.curved(new THREE.MeshBasicMaterial({ map: tex, color: 0xf2f2f2 }));
      mat.name = 'photo';
      o.material = mat;
      done = true;
    });
    return done;
  }

  // ---- 저절로 남기는 순간 ----
  const once = new Set();
  const later = (ms, meta, key) => { if (key && once.has(key)) return; if (key) once.add(key); setTimeout(() => snap(meta), ms); };
  ctx.events.on('house:enter', (e = {}) => {
    const slug = typeof e.owner === 'string' && e.owner !== 'player' ? e.owner : null;
    const town = S().town;
    if (!slug || !town?.birthday?.isToday?.(slug)) return;
    const P = town.villagers?.find(V => V.slug === slug)?.person;
    later(1600, { kind: 'birthday', who: [slug], title: `${P?.name ?? ''} 생일 파티` }, `bd:${slug}:${dayKey()}`);
  });
  ctx.events.on('festival:end', ({ day } = {}) => later(900, { kind: 'festival', title: '섬 축제' }, `fest:${day ?? dayKey()}`));
  ctx.events.on('events:stamp', ({ id, year } = {}) => {
    const name = S().events?.config?.list?.find?.(x => x.id === id)?.name ?? '계절 행사';
    later(700, { kind: 'event', title: name }, `ev:${id}:${year}`);
  });

  // ---- 창 (섬폰 앱) ----
  let current = null;
  function open() {
    if (current) return current.result;
    style();
    let p = null, view = 'grid', sel = null;
    const shell = panelShell({ cls: 'pk-album', title: '📷 추억 앨범', tagColor: '#E8B4A8', onClose: () => p?.close(null), onOutside: () => p?.close(null) });
    const body = h('div', { class: 'pk-album-body' });
    shell.body.append(body);
    const foot = shell.foot;
    function draw() {
      const list = A().list.slice().reverse();
      foot.replaceChildren();
      if (view === 'one' && (sel = get(sel?.id))) {
        const who = sel.who.map(s => S().town?.villagers?.find(V => V.slug === s)?.person?.name).filter(Boolean).join(' · ');
        const wallet = S().data?.wallet?.get?.() ?? 0;
        body.replaceChildren(h('figure', { class: 'pk-album-big', style: { margin: 0 } },
          h('img', { src: sel.img, alt: sel.title }),
          h('figcaption', null, h('b', null, sel.title), h('p', { class: 'pk-album-meta' }, `${KIND[sel.kind] ?? ''} · ${sel.day ?? ''}${who ? ` · ${who}` : ''}${sel.framed ? ` · 액자 ${sel.framed}개` : ''}`))),
        h('div', { class: 'pk-album-acts' },
          ...Object.entries(FRAMES).map(([k, F]) => button(`${F.name}로 만들기 · 🌰${F.price}`, { disabled: wallet < F.price || null, 'data-album-frame': k, onclick: () => doFrame(k) })),
          !sel.framed && button('지우기', { 'data-album-del': '', onclick: () => del() })));
        foot.append(button('← 앨범', { onclick: () => { view = 'grid'; draw(); } }));
        return;
      }
      view = 'grid';
      body.replaceChildren(list.length
        ? h('div', { class: 'pk-album-grid' }, list.map((ph, i) => h('button', { type: 'button', class: 'pk-album-cell', style: { '--tilt': `${((ph.id * 37) % 5) - 2}deg` }, dataset: { albumPhoto: String(ph.id) }, onclick: () => { sel = ph; view = 'one'; draw(); } },
          h('img', { src: ph.img, alt: '' }), h('b', null, ph.title), h('span', null, `${ph.day ?? ''}${ph.framed ? ' · 🖼️' : ''}`))))
        : h('p', { class: 'pk-muted' }, '아직 사진이 없어요. 주민과 같이 낚시·산책을 하거나 저녁 광장 노래를 들으면 저절로 남아요. 아래 「지금 찍기」로 직접 찍을 수도 있어요.'));
      foot.append(h('span', { class: 'pk-muted pk-small', style: { marginRight: 'auto' } }, `${list.filter(x => !x.framed).length} / ${BOND.album.max}장 (액자 사진 빼고)`),
        button('📷 지금 찍기', { 'data-album-snap': '', onclick: async () => { const r = await snap({ kind: 'snap', title: '찰칵' }); if (r) { sel = r; view = 'one'; } draw(); } }));
    }
    async function doFrame(k) {
      const r = frame(sel.id, k), F = FRAMES[k];
      toast({ ok: `${F.name}를 가방에 넣었어요 · 집에 놓아 보세요`, money: '도토리가 모자라요', full: '가방이 꽉 찼어요', none: '사진을 찾지 못했어요' }[r], r === 'ok' ? '🖼️' : '⚠️');
      if (r === 'ok') ctx.events.emit('sfx', { name: 'pickup' });
      draw();
    }
    async function del() {
      const ok = await confirmBox({ open: (n, root, o) => S().ui.panel(n, root, o) }, { title: '사진 지우기', text: `「${sel.title}」 사진을 지울까요?\n지우면 되돌릴 수 없어요.` });
      if (!ok) return;
      const L = A().list;
      L.splice(L.indexOf(sel), 1);
      view = 'grid'; draw();
    }
    draw();
    p = S().ui.panel('album', shell.root, {
      onCancel: () => (view === 'one' ? (view = 'grid', draw()) : p.close(null)),
      onClose: () => { current = null; },
    });
    current = p;
    return p.result;
  }

  return {
    open,
    service: { snap, list: () => A().list.slice(), get, frame, dress, capture, frames: FRAMES },
  };
}
