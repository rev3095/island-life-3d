// 스토리 장면 재생기: assets/story/ 의 장면 JSON 을 읽어 카메라·배우·이모티콘 말풍선·화면 전환·음악을 튼다.
// 다른 모듈은 이벤트로만 부른다 — 트리거(rules.js TRIGGERS)가 듣는 이벤트가 오면 장면을 줄 세웠다가, 창·대화·집 안이 아닐 때 튼다.
// 서비스 ctx.services.story = { play(id, opts) → Promise, preview(scene, take), stop(), playing, scenes(), seen(id), reset(id?) }.
// 이벤트: story:start {id, take} · story:shot {id, take, shot, index} · story:choice {id, shot, emote, index} · story:end {id, take, skipped}.
// 상태: state.story = { seen: { 장면id: dayKey } }. 설계: docs/notes/story.md
import * as R from './rules.js';
import { INDEX_FILE, SCENE_FILES } from './files.js';
import { createActor, facingOf } from '../town/actor.js';
import { createLayer } from './layer.js';

const CURVE = 0.0026;        // 장면 동안 곡면 월드 세기 (가까운 카메라에서 땅이 덜 휘게)
const FADE_IN = 0.5, FADE_OUT = 0.4;
const START_DELAY = 0.5;     // 트리거 뒤 바로 틀지 않고 조금 기다린다 (알림·소리가 먼저)
const PREVIEW_VARS = { part: { emoji: '🎁', name: '축제 부품' } };

let S = null;

export default {
  name: 'story',

  async init(ctx) {
    const { THREE, events, state } = ctx;
    const svc = () => ctx.services;
    const st = () => (state.story ??= { seen: {} });
    st().seen ??= {};

    // ---- 장면 읽기 ----
    const scenes = new Map();
    let index = { timeline: [] };
    try {
      index = await fetch(INDEX_FILE).then(r => r.json());
      const list = await Promise.all(SCENE_FILES.map(f => fetch(f).then(r => (r.ok ? r.json() : null)).catch(() => null)));
      for (const sc of list) if (sc?.id) scenes.set(sc.id, sc);
    } catch (e) { console.warn('[story] 장면을 읽지 못했어요', e); }
    const ordered = () => index.timeline.filter(r => r.scene && scenes.has(r.scene)).map(r => scenes.get(r.scene));

    const layer = createLayer(ctx);
    const actors = new Map();          // slug → actor (장면용 복제, 한 번 만들면 계속 쓴다)
    const loading = new Map();
    async function actorOf(slug) {
      if (actors.has(slug)) return actors.get(slug);
      if (!loading.has(slug)) loading.set(slug, createActor(ctx, slug).then(a => {
        a.root.name = `story:${slug}`;
        a.root.visible = false;
        actors.set(slug, a);
        return a;
      }).catch(e => { console.info(`[story] 배우 ${slug} 모델이 없어 빼고 틀어요`, e?.message ?? e); return null; }));
      return loading.get(slug);
    }

    // ---- 자리 ----
    function placeXZ(name, vars = {}) {
      const p = svc().world?.places ?? {};
      if (name === 'event') {
        const b = vars.booth ?? vars;
        if (Number.isFinite(b?.x) && Number.isFinite(b?.z)) return { x: b.x, z: b.z };
        return p.festival ?? p.plaza ?? { x: 0, z: 0 };
      }
      const v = p[name];
      if (v?.door) return { x: v.door.x, z: v.door.z };
      if (Number.isFinite(v?.x)) return { x: v.x, z: v.z };
      const pl = svc().player?.position;
      return pl ? { x: pl.x, z: pl.z } : { x: 0, z: 0 };
    }
    const heightAt = (x, z) => svc().world?.island?.heightAt?.(x, z) ?? 0;

    // ---- 줄 세우기 ----
    const queue = [];
    let P = null;                       // 지금 트는 장면
    function enqueue(ids, vars) {
      for (const id of ids) if (!queue.some(q => q.id === id) && P?.id !== id) queue.push({ id, vars, wait: START_DELAY });
    }
    const trigEvents = new Set(Object.values(R.TRIGGERS).map(t => t.event).filter(Boolean));
    for (const ev of trigEvents) events.on(ev, payload => enqueue(R.scenesFor(ev, payload ?? {}, ordered(), st().seen), payload ?? {}));
    // ---- 화면 막 (update 가 움직인다 — 창이 숨겨져도 ctx.step 으로 돌 수 있게) ----
    const fade = { v: 0, from: 0, to: 0, t: 0, dur: 0, color: '#2E2420' };
    function fadeTo(to, dur, color) {
      if (color) fade.color = color;
      Object.assign(fade, { from: fade.v, to, t: 0, dur: Math.max(0.001, dur) });
      layer.fade(fade.v, fade.color);
      return until(() => fade.v === fade.to);
    }
    const waits = [];
    const until = cond => new Promise(res => { if (cond()) res(); else waits.push({ cond, res }); });

    // ---- 장면 동안 다른 모듈 멈추기 ----
    // ui.isBlocking() 을 감싸서 장면 동안 true → 주민 자동 대화·행동 키 디스패처·채집이 창이 열린 것처럼 기다린다
    // (intro 가 ui.dialog.open 을 감싸는 것과 같은 방식. 합친 뒤엔 town 이 story.playing 을 보게 바꾸는 제안 — docs/notes/story.md H2)
    const ui = svc().ui;
    const uiBlocking = ui?.isBlocking ? ui.isBlocking.bind(ui) : () => false;
    if (ui?.isBlocking && !ui.storyWrapped) { ui.isBlocking = () => !!P || uiBlocking(); ui.storyWrapped = true; }
    /** 지금 틀어도 되나: 창·대화·이름 정하기·도구 동작 중이 아니고, 집 안이 아닐 때 */
    const free = () => !uiBlocking() && !svc().intro?.naming && !svc().player?.acting && !svc().house?.inside;
    // 디스패처가 막혀 있으니 장면 동안의 A·Space 는 여기서 직접 듣는다 (넘기기·고르기)
    events.on('input:press', ({ intent } = {}) => { if (P && intent === 'action') press(); });
    function press() {
      if (!P) return;
      if (P.choosing) layer.confirmChoice();
      else if (P.tapWait) P.tapWait = false;
    }
    addEventListener('keydown', e => {
      if (!P) return;
      if (e.code === 'Escape') { e.preventDefault(); skip(); }
    });
    layer.onSkip(() => skip());
    layer.onTap(() => press());
    function skip() { if (P) { P.skip = true; P.tapWait = false; layer.cancelChoice(); } }

    // ---- 장면 틀기 ----
    async function run(sc, opts = {}) {
      const take = R.takeOf(sc, opts.take);
      const vars = { ...PREVIEW_VARS, n: sc.trigger?.n, ...(opts.vars ?? {}) };
      const id = sc.id;
      if (!take) return { id, skipped: true };
      if (!take.shots?.length) {          // '연출 없음' 연출안
        events.emit('story:start', { id, take: take.key });
        finishSeen(sc, opts);
        events.emit('story:end', { id, take: take.key, skipped: false });
        return { id, take: take.key, skipped: false };
      }
      const placeName = take.place ?? sc.place;
      const base = placeXZ(placeName, vars);
      const cast = new Set(R.castOf({ takes: [take] }));
      // P 를 먼저 세운다 → 모델을 읽는 동안에도 ui.isBlocking() 이 true (주민 자동 대화가 끼어들지 않게)
      P = { id, sc, take, vars, base, cast, st: {}, t: 0, dur: 0, shot: null, cam: null, lastCam: null, skip: false, tapWait: false, choosing: false, music: false, photo: false };
      events.emit('story:start', { id, take: take.key });
      const fill = text => {
        let s = R.fillTokens(text, vars);
        s = svc().intro?.fill ? svc().intro.fill(s) : s.replace(/\{player(?::[^}]*)?\}/g, '친구').replace(/\{island(?::[^}]*)?\}/g, '포근섬');
        return R.fillTokens(s, PREVIEW_VARS);
      };
      await Promise.all([...cast].map(actorOf));

      // 시작: 어둡게 → 판 깔기
      layer.begin();
      await fadeTo(1, 0.35);
      svc().player?.freeze?.(true);
      svc().ui?.hud?.show?.(false);
      document.body.classList.add('story-on');
      const realPlayer = cast.has('player') ? ctx.scene.children.find(o => o.name === 'player') : null;
      P.realPlayer = realPlayer;

      let i = 0, steps = 0;
      const shots = take.shots;
      while (i < shots.length && !P.skip && steps++ < 200) {
        const shot = shots[i];
        if (i > 0 && shot.transition === 'fade') await fadeTo(1, 0.3);
        applyShot(shot, i, fill);
        events.emit('story:shot', { id, take: take.key, shot: shot.id, index: i });
        if (i === 0 || shot.transition === 'fade') await fadeTo(0, i === 0 ? FADE_IN : 0.35);
        else if (shot.transition === 'white') { fade.v = 1; fade.color = '#FFFFFF'; await fadeTo(0, 0.9, '#FFFFFF'); fade.color = '#2E2420'; }
        if (shot.photo) { P.photo = true; layer.photo(true, fill(shot.caption ?? '')); }
        await until(() => P.skip || P.t >= P.dur);
        let next = shot.goto ?? null;
        if (shot.choice && !P.skip) {
          P.choosing = true;
          const k = await layer.choose(shot.choice.options.map(o => fill(o.emote)));
          P.choosing = false;
          const o = shot.choice.options[k] ?? shot.choice.options[0];
          events.emit('story:choice', { id, shot: shot.id, emote: o.emote, index: k });
          next = o.goto ?? next;
        }
        if (shot.wait && !P.skip) { P.tapWait = true; layer.tapHint(true); await until(() => P.skip || !P.tapWait); layer.tapHint(false); }
        if (P.photo) { P.photo = false; layer.photo(false); }
        i = next === 'end' ? shots.length : next ? Math.max(0, R.shotIndex(take, next)) : i + 1;
        if (next && R.shotIndex(take, next) < 0 && next !== 'end') i = shots.length;
      }

      // 끝: 어둡게 → 판 치우기 → 밝게
      const skipped = P.skip;
      P.skip = false;
      await fadeTo(1, FADE_OUT);
      layer.clearBubbles();
      layer.caption('');
      const stand = actors.get('player');
      if (realPlayer) realPlayer.visible = true;
      if (sc.playerEnd === 'stay' && stand?.root.visible) svc().player?.teleport?.(stand.position.x, stand.position.z, stand.facing);
      else svc().player?.camera?.snap?.(svc().player.position);
      for (const slug of cast) { const a = actors.get(slug); if (a) a.root.visible = false; }
      restoreTown(cast);
      if (P.music) events.emit('bgm', { name: 'auto' });
      svc().player?.freeze?.(false);
      svc().ui?.hud?.show?.(true);
      document.body.classList.remove('story-on');
      const done = P;
      P = null;
      layer.end();
      finishSeen(sc, opts);
      fadeTo(0, FADE_IN);
      events.emit('story:end', { id, take: done.take.key, skipped });
      return { id, take: done.take.key, skipped };
    }

    function finishSeen(sc, opts) {
      if (opts.preview) return;
      st().seen[sc.id] = svc().time?.now?.().dayKey ?? svc().data?.day?.key?.() ?? true;
      svc().data?.save?.save?.();
    }

    /** 컷 하나 시작: 배우 자리·방향·동작·말풍선, 음악·효과음·자막 */
    function applyShot(shot, i, fill) {
      P.shot = shot; P.t = 0; P.dur = shot.dur ?? 2; P.index = i;
      P.lastCam = P.cam;
      layer.clearBubbles();
      for (const a of shot.actors ?? []) {
        const A = actors.get(a.who);
        if (!A) continue;
        const s = (P.st[a.who] ??= { at: [0, 0], walk: null, face: null, shown: false });
        if (a.at) s.at = [...a.at];
        const x = P.base.x + s.at[0], z = P.base.z + s.at[1];
        if (a.at || !s.shown) A.place(x, z, A.facing);
        if (!s.shown || a.at) { A.root.visible = true; A.setOpacity(1); A.fadeTo = 1; s.shown = true; }
        if (a.hide) A.fade(0, 0.4);
        s.face = a.face ?? s.face;
        // 걷기는 컷이 바뀌어도 이어 간다: 새 to 가 오면 지금 선 자리에서 다시, at 이 오면 멈추고 그 자리로
        if (a.to) {
          const from = [A.position.x - P.base.x, A.position.z - P.base.z];
          s.walk = { from, to: [...a.to], do: a.do === 'run' ? 'run' : 'walk', t: 0 };
          A.play(s.walk.do);
        } else {
          if (a.at) s.walk = null;
          if (a.do === 'happy') A.playOnce('happy');
          else if (a.do && !s.walk) A.play(a.do);
        }
        s.emote = a.emote ? fill(a.emote) : '';
        s.text = a.text ? fill(a.text) : '';
        if (s.emote || s.text) layer.bubble(a.who, s.emote, s.text);
      }
      if (shot.music != null && shot.music !== '') { events.emit('bgm', { name: shot.music === 'stop' ? null : shot.music }); P.music = true; }
      if (shot.sfx) events.emit('sfx', { name: shot.sfx });
      layer.caption(shot.photo ? '' : fill(shot.caption ?? ''));
      P.cam = camNow(0);
      for (const a of shot.actors ?? []) { const s = P.st[a.who]; if (s && !s.walk) faceActor(a.who, s.face); }
    }

    function faceActor(who, face) {
      const A = actors.get(who);
      if (!A || face == null) return;
      let pt = null;
      if (typeof face === 'number') { A.wantFacing = (face * Math.PI) / 180; return; }
      if (Array.isArray(face)) pt = { x: P.base.x + face[0], z: P.base.z + face[1] };
      else if (face === 'camera') pt = P.cam?.pos;
      else pt = actors.get(face)?.position;
      if (pt) A.lookAt(pt.x, pt.z);
    }

    /** 지금 카메라 대상 자리 (배우를 따라간다) */
    function targetNow(cam) {
      const tg = cam?.target;
      if (Array.isArray(tg) || !tg || tg === 'place') {
        const b = cam?.place ? placeXZ(cam.place, P.vars) : P.base;
        const off = Array.isArray(tg) ? tg : [0, 0];
        const x = b.x + off[0], z = b.z + off[1];
        return { x, y: heightAt(x, z), z };
      }
      if (tg === 'group') {
        const pts = [...P.cast].map(s => actors.get(s)).filter(a => a?.root.visible && a.opacity > 0.5).map(a => a.position);
        if (!pts.length) return { x: P.base.x, y: heightAt(P.base.x, P.base.z), z: P.base.z };
        const x = pts.reduce((s, p) => s + p.x, 0) / pts.length, z = pts.reduce((s, p) => s + p.z, 0) / pts.length;
        return { x, y: pts.reduce((s, p) => s + p.y, 0) / pts.length, z };
      }
      const a = actors.get(tg);
      return a?.root.visible ? { x: a.position.x, y: a.position.y, z: a.position.z } : { x: P.base.x, y: heightAt(P.base.x, P.base.z), z: P.base.z };
    }
    function camNow(u) {
      const cam = P.shot?.cam ?? {};
      let c = R.cameraAt(cam, targetNow(cam), u);
      if (cam.move === 'pan' && P.lastCam) c = R.blendCam(P.lastCam, c, u);
      return c;
    }

    function hideTown(show = false) {
      const town = svc().town;
      if (!town || !P) return;
      for (const V of [...(town.villagers ?? []), ...(town.keepers ?? [])]) {
        if (V?.actor && P.cast.has(V.slug)) V.actor.root.visible = show && V.actor.opacity > 0.01;
      }
    }
    function restoreTown(cast) {
      const town = svc().town;
      for (const V of [...(town?.villagers ?? []), ...(town?.keepers ?? [])]) if (V?.actor && cast.has(V.slug)) V.actor.root.visible = V.actor.opacity > 0.01;
    }

    const v3 = new THREE.Vector3();
    S = {
      update(dt) {
        // 화면 막
        if (fade.v !== fade.to) {
          fade.t += dt;
          const k = Math.min(1, fade.t / fade.dur);
          fade.v = k >= 1 ? fade.to : fade.from + (fade.to - fade.from) * k;
          layer.fade(fade.v, fade.color);
        }
        // 줄 선 장면
        if (!P && queue.length && free()) {
          const q = queue[0];
          if ((q.wait -= dt) <= 0) {
            queue.shift();
            const sc = scenes.get(q.id);
            if (sc && !(sc.once !== false && st().seen[sc.id])) run(sc, { vars: q.vars }).catch(e => console.error('[story] 장면', e));
          }
        }
        if (P) {
          P.t += dt;
          const u = P.dur > 0 ? Math.min(1, P.t / P.dur) : 1;
          // 배우
          for (const slug of P.cast) {
            const A = actors.get(slug), s = P.st[slug];
            if (!A || !s) continue;
            if (s.walk) {
              s.walk.t += dt;
              const [x, z] = R.actorPosAt(s.walk.from, { at: s.walk.from, to: s.walk.to, do: s.walk.do }, 1, s.walk.t);
              const px = A.position.x, pz = A.position.z;
              A.position.x = P.base.x + x; A.position.z = P.base.z + z;
              const dx = A.position.x - px, dz = A.position.z - pz;
              if (Math.hypot(dx, dz) > 1e-4) A.wantFacing = facingOf(dx, dz);
              if (x === s.walk.to[0] && z === s.walk.to[1]) { s.at = [...s.walk.to]; s.walk = null; A.play('idle'); faceActor(slug, s.face); }
            }
            A.update(dt, !P.photo);
          }
          if (P.realPlayer) P.realPlayer.visible = false;
          hideTown();
          // 카메라 (player 다음에 돈다 → player 카메라를 덮어쓴다)
          if (!P.photo && P.shot) P.cam = camNow(u);
          const c = P.cam;
          if (c) {
            ctx.camera.position.set(c.pos.x, c.pos.y, c.pos.z);
            ctx.camera.lookAt(v3.set(c.look.x, c.look.y, c.look.z));
            ctx.focus.set(c.look.x, c.look.y - 0.6, c.look.z);
            ctx.materials.curve.uCurve.value = CURVE;
            ctx.camera.updateMatrixWorld();
          }
          // 말풍선은 이 프레임 카메라로 (player 카메라의 lookAt 이 행렬을 먼저 바꿔 둔다)
          for (const slug of P.cast) {
            const A = actors.get(slug), s = P.st[slug];
            if (A?.root.visible && s && (s.emote || s.text)) layer.place(slug, A.position, A.height, ctx.camera);
          }
        }
        for (let k = waits.length - 1; k >= 0; k--) if (waits[k].cond()) waits.splice(k, 1)[0].res();
      },
    };

    ctx.services.story = {
      /** 장면 id 를 튼다 → Promise<{id, take, skipped}>. opts = { take: 'B', vars: {n, part}, force: 본 장면도 } */
      async play(id, opts = {}) {
        const sc = scenes.get(id);
        if (!sc || P) return null;
        return run(sc, opts);
      },
      /** 편집기에서 고친 장면 객체를 바로 틀어 보기 (본 기록에 안 남는다) */
      preview(scene, take) { if (P || !scene) return null; return run(scene, { take, preview: true }); },
      stop: skip,
      get playing() { return P ? { id: P.id, take: P.take.key, shot: P.shot?.id } : null; },
      get queue() { return queue.map(q => q.id); },
      scenes: () => ordered().map(sc => ({ id: sc.id, title: sc.title, trigger: sc.trigger, pick: sc.pick, seen: !!st().seen[sc.id] })),
      scene: id => scenes.get(id) ?? null,
      index: () => index,
      seen: id => !!st().seen[id],
      /** 본 기록 지우기 (id 없으면 전부) */
      reset(id) { if (id) delete st().seen[id]; else st().seen = {}; },
      debug: () => ({ P, queue, actors }),
    };

    // 개발용: ?story=<장면 id>[&take=B] → 시작하고 조금 뒤 그 장면을 튼다 (이름 정하기가 끝난 뒤)
    const q = new URLSearchParams(location.search);
    if (q.get('story')) {
      events.once('game:ready', () => {
        const id = q.get('story');
        const go = () => (free() && !P ? ctx.services.story.preview(scenes.get(id), q.get('take') ?? undefined) : setTimeout(go, 500));
        setTimeout(go, 1200);
      });
    }
    console.info(`[story] 장면 ${scenes.size}개 준비됨 · 본 장면 ${Object.keys(st().seen).length}`);
  },

  update(dt) {
    S?.update(dt);
  },
};
