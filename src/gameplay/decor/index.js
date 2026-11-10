// 9차 M9-P2 섬 꾸미기 (보드 wave9 D86-A, UI-16·UI-17): 섬폰 「🪴 섬 꾸미기」 → 밖에서 놓기 모드.
// 길 넷(TI-09–12)·울타리 둘(PR-24–25)은 거저 깔고, 야외 가구(아이템 outdoor: true — FU-47–50 등)는 가방에서 꺼내 놓는다.
// 놓을 칸 = 플레이어 앞 칸 (가구는 앞으로 뻗은 발자국), 초록/빨강 테두리 + 반투명 모델로 미리 보여 준다 (UI-17).
// 놓은 것은 world.objects.add(…, persist) → state.island.added 에 남는다 (data: { decor: 'path'|'fence'|'furn', item? }).
// 길·울타리는 같은 종류 이웃과 이어진다: 놓고 치울 때마다 그 칸과 이웃 넷의 변형 꼬리표(+n+e…)를 다시 맞춘다 (world/objects.js link_*).
// 조작: Space(A) 놓기 · Q/E 돌리기 · Tab 다음 것 · X 고치기(치우기·돌리기) · Esc 끝내기. 휴대폰은 화면 아래 칸의 단추.
// 10차 D95-A 옮기기: 고치기 대상에서 C(「옮기기」) → 들어 올려 미리 보기가 놓을 칸을 따라옴 → Space(「놓기」) 내려놓기 · Esc·C(「취소」) 제자리.
//   들고 있는 동안에도 저장 기록(state.island.added)은 옛 자리 그대로 남겨 둬서(keeper), 끄기·새로 고침에도 잃지 않는다.
// 10차 D96-A 칸 누르기: 꾸미는 동안 땅을 짧게 누르면(마우스 클릭·손가락 톡) 그 칸이 대상 (PICK_REACH 6칸 안) — 움직이면 다시 앞 칸.
//   마우스 걷기는 꾹 누르기·끌기로만 (player/mouse.js setClickHandler).
import { canPlace, dirOfFacing, footprintTiles, linkTags, WHY_TEXT, pickCell, targetCell } from './rules.js';
import { createDecorBar } from './bar.js';
import { createSeats } from './sit.js';   // 10차 앉기 (AN-11)

import { FURN_KIND } from '../../world/variants.js';   // 야외 가구 = 가구 모델 'fu:<slug>'

let D = null;

export default {
  name: 'decor',

  async init(ctx) {
    const S = () => ctx.services;
    const world = S().world, player = S().player;
    if (!world?.objects || !player) return;
    const { THREE, events, state } = ctx;
    const cfg = await ctx.assets.loadJSON('assets/decor/decor.json').catch(e => (console.warn('[decor] decor.json 없음', e), null));
    if (!cfg) return;
    const PATHS = cfg.paths ?? [], FENCES = cfg.fences ?? [];
    const GROUP = Object.fromEntries([...PATHS.map(p => [p.kind, 'path']), ...FENCES.map(f => [f.kind, 'fence'])]);
    const isl = world.island, objs = world.objects;
    const toast = (t, icon) => S().ui?.toast?.(t, icon);

    D = {
      active: false, mode: 'place',   // 'place' 놓기 · 'edit' 고치기(치우기·돌리기)
      pick: null,                     // { group, kind, name, icon, item?, variant? }
      q: 0,                           // 돌림 (90° 단위)
      view: null,                     // 지금 미리 보기 { tiles, ok, why, target? }
      cell: null,                     // 10차: 눌러 고른 칸 {tx, tz} (null = 앞 칸)
      moving: null,                   // 10차: 옮기는 중 { rec (옛 저장 기록), o, pick, prevPick, prevQ, from }
    };

    // ---------- 무엇을 놓을 수 있나 ----------
    const outdoorItems = () => (S().data?.items?.list?.('furn') ?? []).filter(it => it.outdoor);
    /** 고를 것 목록: 길·울타리 (거저) + 가방의 야외 가구 (같은 아이템·색 변형은 하나로) */
    function catalog() {
      const out = [
        ...PATHS.map(p => ({ group: 'path', kind: p.kind, name: p.name, icon: p.icon, code: p.id })),
        ...FENCES.map(f => ({ group: 'fence', kind: f.kind, name: f.name, icon: f.icon, code: f.id })),
      ];
      const inv = S().data?.inventory, seen = new Set();
      const outdoor = new Set(outdoorItems().map(it => it.id));
      for (const s of inv?.slots ?? []) {
        if (!s || !outdoor.has(s.id)) continue;
        const key = `${s.id}|${s.variant ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const it = S().data.items.get(s.id);
        out.push({ group: 'furn', kind: FURN_KIND + s.id.slice(5), item: s.id, variant: s.variant ?? null, name: it?.name ?? s.id, icon: it?.icon, emoji: it?.emoji, count: inv.count(s.id), code: it?.code });
      }
      return out;
    }

    const layerOf = kind => (GROUP[kind] === 'path' ? 'ground' : 'top');
    const decorObjs = () => objs.list().filter(o => o.data?.decor);
    const footprintOf = pick => (pick?.group === 'furn' ? (S().data?.items?.get?.(pick.item)?.size ?? [1, 1]) : [1, 1]);

    // 문 앞·빈 집터는 비워 둔다 (주민 드나들기·이사)
    const reservedSet = new Set();
    {
      const P = world.places ?? {};
      const add = (tx, tz) => reservedSet.add(`${tx},${tz}`);
      for (const b of [P.playerHouse, P.shop, P.museum, ...(P.villagerHouses ?? [])]) {
        if (!b || b.tx == null) continue;
        for (let dx = -1; dx <= 1; dx++) { add(b.tx + dx, b.tz); add(b.tx + dx, b.tz + 1); }
        if (b.lot) for (let z = b.lot.tz - 1; z <= b.lot.tz + b.lot.fd + 1; z++) for (let x = b.lot.tx - 1; x <= b.lot.tx + b.lot.fw; x++) add(x, z);
      }
    }
    const env = () => ({
      inside: (tx, tz) => tx >= 0 && tz >= 0 && tx < isl.w && tz < isl.h,
      tileAt: isl.tileAt, levelAt: isl.levelAt, flagsAt: isl.flagsAt,
      on: (tx, tz) => objs.on(tx, tz).map(o => ({ ...o, layer: layerOf(o.kind) })),
      reserved: (tx, tz) => reservedSet.has(`${tx},${tz}`),
      playerAt: (tx, tz) => { const t = isl.toTile(player.position.x, player.position.z); return t.tx === tx && t.tz === tz; },
      count: decorObjs().length, limit: cfg.limit ?? 400,
    });

    // ---------- 이어짐 ----------
    const sameAt = kind => (tx, tz) => objs.on(tx, tz).some(o => o.kind === kind);
    const tagsFor = (kind, tx, tz) => linkTags(tx, tz, sameAt(kind), { corners: GROUP[kind] === 'path' });
    const palOf = v => String(v ?? '').split('+')[0] || '';
    function relink(tx, tz, kinds) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        for (const o of objs.on(tx + dx, tz + dz)) {
          if (!kinds.includes(o.kind) || !o.data?.decor) continue;
          const tags = tagsFor(o.kind, o.tile.tx, o.tile.tz);
          const v = tags.length ? [palOf(o.variant), ...tags].join('+') : (palOf(o.variant) || null);
          objs.setVariant(o.id, v);
        }
      }
    }

    // ---------- 미리 보기 (UI-17): 테두리 + 반투명 모델 ----------
    const frameMat = ctx.materials.curved?.(new THREE.MeshBasicMaterial({ color: 0x7ccf6a, transparent: true, opacity: 0.9, depthWrite: false })) ?? new THREE.MeshBasicMaterial({ color: 0x7ccf6a, transparent: true, opacity: 0.9, depthWrite: false });
    const fillMat = ctx.materials.curved?.(new THREE.MeshBasicMaterial({ color: 0x7ccf6a, transparent: true, opacity: 0.18, depthWrite: false })) ?? new THREE.MeshBasicMaterial({ color: 0x7ccf6a, transparent: true, opacity: 0.18, depthWrite: false });
    const frame = new THREE.Group();
    frame.name = 'decor:preview';
    frame.renderOrder = 5;
    const bars = [0, 1, 2, 3].map(() => new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), frameMat));
    const fill = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 1), fillMat);
    frame.add(fill, ...bars);
    frame.visible = false;
    ctx.scene.add(frame);
    function setFrame(min, size, y, ok) {
      const [w, d] = size, c = isl.toWorld(min.tx, min.tz);
      const x0 = c.x - 0.5, z0 = c.z - 0.5, t = 0.07;
      frame.position.set(x0 + w / 2, y + 0.05, z0 + d / 2);
      const pos = [[0, -d / 2, w, t], [0, d / 2, w, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]];
      bars.forEach((b, i) => { const [px, pz, sx, sz] = pos[i]; b.position.set(px, 0, pz); b.scale.set(sx, 1, sz); });
      fill.scale.set(w - 0.04, 1, d - 0.04);
      const col = ok ? 0x7ccf6a : 0xe2574c;
      frameMat.color.setHex(col); fillMat.color.setHex(col);
      frame.visible = true;
    }

    let ghost = null;   // { key, root, toon }
    async function ghostFor(pick) {
      const key = pick ? `${pick.kind}|${pick.variant ?? ''}` : null;
      if (ghost?.key === key) return ghost;
      ghost?.root?.removeFromParent();
      ghost = key ? { key, root: null } : null;
      if (!pick) return null;
      const my = ghost;
      const ok = await objs.ensure(pick.kind);
      const m = world.debug?.models?.[pick.kind];
      if (!ok || !m || ghost !== my) return null;
      const { scene: root } = ctx.assets.instantiate(m.gltf);
      const spec = m.spec;
      const toon = ctx.materials.applyToonStyle(root, { spec });
      const pal = { ...spec.palette, ...(spec.variants?.[pick.variant ?? '']?.palette ?? {}) };
      for (const [n, hex] of Object.entries(pal)) toon.setColor?.(n, hex);
      root.userData.occluder = false;
      toon.setFade?.(0.55);
      root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      const holder = new THREE.Group();
      holder.add(root);
      ctx.scene.add(holder);
      my.root = holder; my.model = root;
      return my;
    }
    /** 미리 보기 모델의 이어짐 팔·고르는 부품 맞추기 (world/objects.js prune 과 같은 규칙) */
    function showParts(g, tags) {
      g.model.traverse(o => {
        if (!o.name) return;
        if (o.name.startsWith('link_')) o.visible = tags.includes(o.name.slice(5));
      });
    }

    // ---------- 고치기 대상: 앞 칸의 꾸민 것 (위 층 먼저) ----------
    function targetAt(tx, tz) {
      const here = objs.on(tx, tz).filter(o => o.data?.decor);
      return here.find(o => layerOf(o.kind) === 'top') ?? here[0] ?? null;
    }

    /** 대상 칸: 눌러 고른 칸이 있으면 그 칸(가운데 맞춤), 아니면 앞 칸 */
    function frontTile() {
      const t = isl.toTile(player.position.x, player.position.z);
      return targetCell(D.cell, t, dirOfFacing(player.facing));
    }

    function refresh() {
      if (!D.active) { frame.visible = false; if (ghost?.root) ghost.root.visible = false; D.view = null; return; }
      // 움직이면(키·패드·마우스 걷기) 눌러 고른 칸을 잊고 앞 칸으로
      const mv = ctx.input?.move;
      if (D.cell && mv && Math.hypot(mv.x, mv.z) > 0.1) D.cell = null;
      const { anchor, dir } = frontTile();
      if (D.mode === 'edit' && !D.moving) {
        if (ghost?.root) ghost.root.visible = false;
        const o = targetAt(anchor.tx, anchor.tz);
        if (!o) { setFrame(anchor, [1, 1], isl.levelAt(anchor.tx, anchor.tz), false); frameMat.color.setHex(0xd8d0be); fillMat.color.setHex(0xd8d0be); D.view = { target: null }; return; }
        const ext = o.kind.startsWith(FURN_KIND) ? (S().data?.items?.get?.(o.data.item)?.size ?? [1, 1]) : [1, 1];
        const q = Math.round(((o.rot ?? 0) / (Math.PI / 2))) % 2;
        const size = q ? [ext[1], ext[0]] : ext;
        const min = { tx: Math.round(o.x - size[0] / 2 + isl.w / 2), tz: Math.round(o.z - size[1] / 2 + isl.h / 2) };
        setFrame(min, size, o.y, false);
        frameMat.color.setHex(0xf2c14e); fillMat.color.setHex(0xf2c14e);
        D.view = { target: o };
        return;
      }
      const PK = D.moving?.pick ?? D.pick;
      if (!PK) { frame.visible = false; D.view = null; return; }
      const fp = footprintOf(PK);
      const { tiles, min, size } = footprintTiles(anchor, dir, fp, D.q);
      const res = canPlace(tiles, layerOf(PK.kind), env());
      const y = isl.levelAt(min.tx, min.tz) * 1.0;
      setFrame(min, size, y, res.ok);
      const c = isl.toWorld(min.tx, min.tz);
      const at = { x: c.x - 0.5 + size[0] / 2, z: c.z - 0.5 + size[1] / 2, y };
      D.view = { tiles, min, size, at, ok: res.ok, why: res.why, anchor };
      if (ghost?.key === `${PK.kind}|${PK.variant ?? ''}` && ghost.root) {
        ghost.root.visible = true;
        ghost.root.position.set(at.x, y, at.z);
        ghost.root.rotation.y = PK.group === 'furn' ? D.q * Math.PI / 2 : 0;
        if (PK.group !== 'furn') showParts(ghost, linkTags(anchor.tx, anchor.tz, (x, z) => sameAt(PK.kind)(x, z), { corners: PK.group === 'path' }));
      } else ghostFor(PK);
    }

    // ---------- 하기 ----------
    function place() {
      if (D.moving) return drop();
      const v = D.view;
      if (!D.active || D.mode !== 'place' || !D.pick || !v) return false;
      if (!v.ok) { toast(WHY_TEXT[v.why] ?? '여기엔 놓을 수 없어요', '🚫'); events.emit('sfx', { name: 'menu', volume: 0.5 }); return false; }
      const p = D.pick;
      if (p.group === 'furn') {
        const inv = S().data?.inventory;
        const slot = inv?.slots.findIndex(s => s?.id === p.item && (s.variant ?? null) === (p.variant ?? null));
        if (slot == null || slot < 0 || inv.remove(slot, 1) !== 1) { toast('가방에 그 가구가 없어요', '🎒'); D.pick = null; bar.render(); return false; }
        const rot = D.q * Math.PI / 2;
        const id = objs.add(p.kind, v.anchor.tx, v.anchor.tz, { rot, variant: p.variant, at: { x: v.at.x, z: v.at.z, y: v.at.y }, decor: 'furn', item: p.item });
        if (!id) { S().data.collect?.(p.item, 1, p.variant ? { variant: p.variant } : {}); return false; }
        if (!inv.count(p.item)) { D.pick = null; }
      } else {
        const { tx, tz } = v.anchor;
        const tags = tagsFor(p.kind, tx, tz);
        const id = objs.add(p.kind, tx, tz, { variant: tags.length ? ['', ...tags].join('+') : null, decor: p.group });
        if (!id) return false;
        relink(tx, tz, [p.kind]);
      }
      player.play?.('place');   // AN-10 놓기 동작
      events.emit('sfx', { name: p.group === 'path' ? 'dig' : 'step-wood', volume: 0.8 });
      events.emit('decor:place', { kind: p.kind, group: p.group, item: p.item ?? null, tx: v.anchor.tx, tz: v.anchor.tz });
      saveSoon();
      bar.render();
      return true;
    }

    /** 누가(주인공·주민) 앉아 있는 꾸밈 가구인가 (10차 앉기 — 치우기·옮기기·돌리기를 막는다) */
    const seated = o => [...seats.claims.keys()].some(k => k.startsWith(`decor:${o.id}#`));
    function remove() {
      const o = D.view?.target;
      if (!D.active || D.mode !== 'edit' || !o || D.moving) return false;
      if (seated(o)) { toast('누가 앉아 있어요', '🪑'); return false; }
      if (o.data.decor === 'furn') {
        const got = S().data?.collect?.(o.data.item, 1, o.variant && !o.variant.includes('+') ? { variant: o.variant } : {});
        if (!got?.added) { toast('가방이 가득 찼어요', '🎒'); return false; }
      }
      objs.remove(o.id);
      if (o.data.decor !== 'furn') relink(o.tile.tx, o.tile.tz, [o.kind]);
      events.emit('sfx', { name: 'step-wood', volume: 0.6 });   // 'pickup' 은 첫날 안내가 「줍기」로 센다 (intro)
      events.emit('decor:remove', { kind: o.kind, group: o.data.decor, item: o.data.item ?? null, tx: o.tile.tx, tz: o.tile.tz });
      toast(o.data.decor === 'furn' ? `${S().data?.items?.get?.(o.data.item)?.name ?? '가구'}를 가방에 넣었어요` : '치웠어요', '🧹');
      saveSoon();
      bar.render();
      return true;
    }

    /** 돌리기: 놓기 모드면 미리 보기, 고치기 모드면 앞의 가구를 제자리에서 90° (발자국이 바뀌면 다시 판정) */
    function rotate(step = 1) {
      if (!D.active) return false;
      if (D.moving) {
        if (D.moving.pick.group !== 'furn') { toast('길·울타리는 이웃에 맞춰 저절로 이어져요', '🔗'); return false; }
        D.q = (D.q + step + 4) % 4; events.emit('sfx', { name: 'menu', volume: 0.5 }); return true;
      }
      if (D.mode === 'place') { D.q = (D.q + step + 4) % 4; events.emit('sfx', { name: 'menu', volume: 0.5 }); return true; }
      const o = D.view?.target;
      if (!o || o.data.decor !== 'furn') { if (o) toast('길·울타리는 이웃에 맞춰 저절로 이어져요', '🔗'); return false; }
      if (seated(o)) { toast('누가 앉아 있어요', '🪑'); return false; }
      const fp = S().data?.items?.get?.(o.data.item)?.size ?? [1, 1];
      const q = (Math.round((o.rot ?? 0) / (Math.PI / 2)) + step + 4) % 4;
      const [w, d] = q % 2 ? [fp[1], fp[0]] : fp;
      const min = { tx: Math.round(o.x - w / 2 + isl.w / 2), tz: Math.round(o.z - d / 2 + isl.h / 2) };
      const tiles = [];
      for (let z = min.tz; z < min.tz + d; z++) for (let x = min.tx; x < min.tx + w; x++) tiles.push({ tx: x, tz: z });
      const e = env();
      const res = canPlace(tiles, 'top', { ...e, limit: null, on: (tx, tz) => e.on(tx, tz).filter(x => x.id !== o.id) });
      if (!res.ok) { toast(`돌릴 자리가 없어요 — ${WHY_TEXT[res.why]}`, '🚫'); return false; }
      const c = isl.toWorld(min.tx, min.tz);
      objs.remove(o.id);
      objs.add(o.kind, o.tile.tx, o.tile.tz, { rot: q * Math.PI / 2, variant: o.variant, at: { x: c.x - 0.5 + w / 2, z: c.z - 0.5 + d / 2, y: o.y }, decor: 'furn', item: o.data.item });
      events.emit('sfx', { name: 'menu' });
      saveSoon();
      return true;
    }

    // ---------- 10차 D95-A 옮기기 ----------
    const quarterOf = rot => ((Math.round((rot ?? 0) / (Math.PI / 2)) % 4) + 4) % 4;
    const addedOf = id => state.island.added.find(a => a.id === id) ?? null;
    const dropKeeper = rec => { const i = state.island.added.indexOf(rec); if (i >= 0) state.island.added.splice(i, 1); };
    /** 고치기 대상을 들어 올린다 (같은 종류·색·돌림). 옛 저장 기록은 남겨 둔다 → 끄기·새로 고침에도 제자리 */
    function pickUp() {
      const o = D.view?.target;
      if (!D.active || D.mode !== 'edit' || !o || D.moving) return false;
      if (seated(o)) { toast('누가 앉아 있어요', '🪑'); return false; }
      const saved = addedOf(o.id);
      if (!saved) return false;
      const rec = JSON.parse(JSON.stringify(saved));
      if (!objs.remove(o.id)) return false;
      state.island.added.push(rec);                    // 옛 자리 기록 (keeper) — 내려놓거나 취소할 때 뺀다
      if (o.data.decor !== 'furn') relink(o.tile.tx, o.tile.tz, [o.kind]);
      const furn = o.data.decor === 'furn';
      const it = furn ? S().data?.items?.get?.(o.data.item) : null;
      const c = catalog().find(x => x.kind === o.kind);
      D.moving = { rec, o, from: { ...o.tile }, prevPick: D.pick, prevQ: D.q,
        pick: { group: o.data.decor, kind: o.kind, item: o.data.item ?? null, variant: furn ? palOf(o.variant) || null : null, name: it?.name ?? c?.name ?? '꾸밈', icon: it?.icon ?? c?.icon } };
      D.q = furn ? quarterOf(o.rot) : 0;
      events.emit('sfx', { name: 'menu', volume: 0.7 });
      toast(`${D.moving.pick.name} 옮기는 중 — 놓을 칸에서 놓기`, '✋');
      bar.render();
      return true;
    }
    /** 들고 있는 것을 지금 대상 칸에 내려놓는다 (놓기와 같은 칸 판정) */
    function drop() {
      const m = D.moving, v = D.view;
      if (!m || !v) return false;
      if (!v.ok) { toast(WHY_TEXT[v.why] ?? '여기엔 놓을 수 없어요', '🚫'); events.emit('sfx', { name: 'menu', volume: 0.5 }); return false; }
      const p = m.pick;
      dropKeeper(m.rec);
      let id;
      if (p.group === 'furn') {
        id = objs.add(p.kind, v.anchor.tx, v.anchor.tz, { rot: D.q * Math.PI / 2, variant: p.variant, at: { x: v.at.x, z: v.at.z, y: v.at.y }, decor: 'furn', item: p.item });
      } else {
        const { tx, tz } = v.anchor, tags = tagsFor(p.kind, tx, tz);
        id = objs.add(p.kind, tx, tz, { variant: tags.length ? ['', ...tags].join('+') : null, decor: p.group });
        if (id) relink(tx, tz, [p.kind]);
      }
      if (!id) { putBack(m); endMove(); return false; }
      endMove();
      player.play?.('place');
      events.emit('sfx', { name: p.group === 'path' ? 'dig' : 'step-wood', volume: 0.8 });
      events.emit('decor:move', { kind: p.kind, group: p.group, item: p.item ?? null, from: m.from, tx: v.anchor.tx, tz: v.anchor.tz });
      saveSoon();
      return true;
    }
    /** 옛 자리에 그대로 되돌린다 (같은 id·변형·돌림) */
    function putBack(m) {
      dropKeeper(m.rec);
      const r = m.rec;
      objs.add(r.kind, r.tx, r.tz, { ...r.data, id: r.id });
      if (m.pick.group !== 'furn') relink(r.tx, r.tz, [r.kind]);
    }
    function cancelMove({ silent = false } = {}) {
      const m = D.moving;
      if (!m) return false;
      putBack(m);
      endMove();
      if (!silent) { events.emit('sfx', { name: 'menu', volume: 0.5 }); toast('제자리에 두었어요', '↩️'); }
      return true;
    }
    function endMove() {
      const m = D.moving;
      D.moving = null;
      if (m) { D.pick = m.prevPick; D.q = m.prevQ; }
      D.mode = 'edit';
      bar.render();
    }

    // ---------- 10차 D96-A 칸 누르기 ----------
    function onCell(point) {
      if (!D.active || S().ui?.isBlocking?.()) return;
      const r = pickCell(point, isl.toTile(player.position.x, player.position.z), { w: isl.w, h: isl.h });
      if (!r.ok) { if (r.why === 'far') toast('조금 더 가까이에서 골라요', '👣'); return; }
      D.cell = r.cell;
      events.emit('sfx', { name: 'menu', volume: 0.4 });
    }

    let saveT = 0;
    function saveSoon() { saveT = 1.2; }

    // ---------- 켜고 끄기 ----------
    function open() {
      if (S().house?.inside || Math.abs(player.position.x) > 200) { toast('섬 꾸미기는 밖에서 해요', '🏝️'); return false; }   // 실내는 x 500– (집·주민 방·상점·박물관)
      if (player.seated) player.stand();   // 앉아 있었으면 일어나서
      D.active = true; D.mode = 'place'; D.q = 0;
      const list = catalog();
      if (!D.pick || !list.some(c => c.kind === D.pick.kind && (c.variant ?? null) === (D.pick.variant ?? null))) D.pick = list[0] ?? null;
      D.cell = null;
      ctx.input?.pointerMove?.setClickHandler?.(onCell);   // 짧게 누르기 = 칸 고르기 (꾹 = 걷기)
      bar.show(true); bar.render();
      events.emit('decor:mode', { active: true });
      toast(ctx.input?.touch ? '앞 칸이나 톡 누른 칸에 놓아요 — A 놓기 · 아래 칸에서 고르기' : '앞 칸이나 누른 칸에 놓아요 — Space 놓기 · Q/E 돌리기 · Tab 다음 · X 고치기 · Esc 끝 (꾹 눌러 걷기)', '🪴');
      return true;
    }
    function close() {
      if (!D.active) return;
      cancelMove({ silent: true });   // 들고 있던 것은 제자리로
      D.active = false; D.cell = null;
      ctx.input?.pointerMove?.setClickHandler?.(null);
      bar.show(false);
      refresh();
      events.emit('decor:mode', { active: false });
    }
    function choose(pick) { cancelMove({ silent: true }); D.pick = pick; D.mode = 'place'; bar.render(); }
    function setMode(m) { cancelMove({ silent: true }); D.mode = m; bar.render(); }
    function next(step = 1) {
      const list = catalog();
      if (!list.length) return;
      const i = list.findIndex(c => c.kind === D.pick?.kind && (c.variant ?? null) === (D.pick?.variant ?? null));
      choose(list[((i < 0 ? 0 : i + step) + list.length) % list.length]);
    }

    const bar = createDecorBar(ctx, {
      get state() { return D; }, catalog, choose, setMode, place, remove, rotate, close, pickUp, cancelMove,
    });

    // 키 (꾸미기 동안만): 도구 바꾸기(Q/E)·가방(Tab)·섬폰(Esc)보다 먼저 받는다
    addEventListener('keydown', e => {
      if (!D.active || e.repeat || S().ui?.isBlocking?.()) return;
      const k = e.code;
      let used = true;
      if (k === 'KeyQ') rotate(-1);
      else if (k === 'KeyE') rotate(1);
      else if (k === 'Tab') { if (!D.moving) next(e.shiftKey ? -1 : 1); }
      else if (k === 'KeyX') { if (!D.moving) setMode(D.mode === 'edit' ? 'place' : 'edit'); }
      else if (k === 'KeyC') { if (D.moving) cancelMove(); else if (D.mode === 'edit') pickUp(); else used = false; }
      else if (k === 'Escape') { if (D.moving) cancelMove(); else close(); }
      else used = false;
      if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);

    // 행동 키: 꾸미기 동안은 놓기·치우기가 말 걸기·줍기보다 먼저 (110)
    const gp = S().gameplay?.interactions;
    gp?.add({ name: 'decor:place', intent: 'action', priority: 110, label: () => (D.moving ? '놓기' : D.mode === 'edit' ? '치우기' : '놓기'),
      test: () => (D.active && !S().ui?.isBlocking?.() ? (D.moving ? true : D.mode === 'edit' ? D.view?.target ?? null : D.pick ? true : null) : null),
      run: () => (D.moving ? drop() : D.mode === 'edit' ? remove() : place()) });
    gp?.add({ name: 'decor:rotate', intent: 'pickup', priority: 110, label: '돌리기',
      test: () => (D.active && !S().ui?.isBlocking?.() ? true : null), run: () => rotate(1) });

    // 시작할 때 이어짐을 한 번 다시 맞춘다 (예전 저장·모델을 받는 사이에 놓인 것)
    function fixLinks() {
      for (const o of decorObjs()) if (o.data.decor !== 'furn') relink(o.tile.tx, o.tile.tz, [o.kind]);
    }
    fixLinks();

    // 집에 들어가면·장면이 시작하면 끈다
    events.on('house:enter', close);
    events.on('story:start', close);
    events.on('inventory:changed', () => { if (D.active) bar.render(); });

    // 섬폰 줄 (ui/phone.js APPS 'decor')
    const ui = S().ui;
    if (ui && !ui.decor) ui.decor = { open: () => open() };

    ctx.services.decor = {
      open, close, place, remove, rotate, choose, setMode, catalog,
      /** 10차 D95-A: 고치기 대상 들기 · 내려놓기 · 제자리 */
      pickUp, drop, cancelMove,
      /** 10차 D96-A: 칸 고르기 (tx, tz) — null 이면 앞 칸으로. 화면 누르기는 player/mouse.js 가 onCell(땅 점) 으로 */
      setCell(tx, tz) { D.cell = tx == null ? null : { tx, tz }; },
      onCell,
      get active() { return D.active; }, get mode() { return D.mode; }, get pick() { return D.pick; }, get view() { return D.view; },
      get moving() { return D.moving ? { ...D.moving.pick, from: D.moving.from } : null; }, get cell() { return D.cell; },
      /** 놓은 꾸밈 목록 */
      list: decorObjs,
      /** 칸에 놓은 길이 있나 (주민 길찾기가 싸게 친다) */
      isRoad: (tx, tz) => objs.on(tx, tz).some(o => GROUP[o.kind] === 'path'),
      /**
       * 주민이 쉬러 가는 자리: 벤치·피크닉 탁자·통나무 의자의 빈 자리 (10차: 앉는다) → [{ x, z (서는 곳), face: {x, z}, id, seat }]
       * seat = seats.js seatsOf 의 하나 (key 로 seats.claim) — 누가(주인공·주민) 앉아 있는 자리는 빠진다
       */
      hangouts() {
        return seats.outdoor().filter(s => !seats.holder(s.key)).map(s => ({ id: s.id, x: s.stand.x, z: s.stand.z, face: { x: s.x, z: s.z }, seat: s }));
      },
      debug: { D, refresh, frame, get ghost() { return ghost; }, tagsFor, reservedSet },
    };
    D.refresh = refresh;
    // 10차 앉기: 자리 맡기 · 주인공 앉기/일어나기 행동 키 (sit.js) — 집 안 의자도 이 서비스로
    const seats = createSeats(ctx, { objs, isActive: () => D.active });
    ctx.services.seats = seats;
    D.tick = dt => { if (saveT > 0 && (saveT -= dt) <= 0) { try { S().data?.save?.save?.(); } catch (e) { console.warn('[decor] 저장 실패', e); } } };
    console.info(`[decor] 섬 꾸미기 준비 — 길 ${PATHS.length} · 울타리 ${FENCES.length} · 야외 가구 ${outdoorItems().length}`);
  },

  update(dt) {
    if (!D) return;
    D.refresh();
    D.tick(dt);
  },
};
