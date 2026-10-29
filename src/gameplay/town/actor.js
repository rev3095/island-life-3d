// 캐릭터 한 명: 모델(툰 재질·외곽선은 ctx.materials) + 동작 섞기 + 서서히 나타나기·사라지기 + 길 따라 걷기.
// 방향은 player.facing 과 같은 뜻 (0 = 북쪽 -Z, 모델 rotation.y = facing + π).
import { LoopOnce, LoopRepeat } from 'three';

const FADE = 0.2;           // 동작 섞는 시간
const TURN = 7;             // 라디안/초
export const RADIUS = 0.24; // 충돌 원 반지름
export const facingOf = (dx, dz) => Math.atan2(-dx, -dz);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export async function createActor(ctx, slug) {
  const { THREE, assets, materials, scene } = ctx;
  const [gltf, spec] = await Promise.all([assets.loadCharacter(slug), assets.loadCharacterSpec(slug).catch(() => null)]);
  const { scene: model, animations } = assets.instantiate(gltf);
  // merge: 툰 부품을 [몸 · 눈·볼 · 외곽선] 세 메시로 합친다 (그리기 호출 줄이기). 카메라와 플레이어 사이면 world 가 toon.setFade 로 비치게 한다
  const toon = materials.applyToonStyle(model, { spec, merge: true });
  const root = new THREE.Group();
  root.name = `town:${slug}`;
  root.add(model);
  scene.add(root);

  // 이름표 높이: 모델 크기에서 (스펙 키 ≈ 1.0)
  const box = new THREE.Box3().setFromObject(model);
  const height = Number.isFinite(box.max.y) && box.max.y > 0.3 ? box.max.y : (spec?.proportions?.height ?? 1);

  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(animations.map(c => [c.name, mixer.clipAction(c)]));
  const mats = [];
  root.traverse(o => { if (o.isMesh) for (const m of [o.material].flat()) if (!mats.includes(m)) mats.push(m); });

  const A = {
    slug, root, model, height, toon,
    position: root.position,
    facing: 0, wantFacing: null,
    anim: null, oneShot: null, speed: 0,
    opacity: 1, fadeTo: 1, fadeSpeed: 2,
    path: [], goal: null, stuck: 0,

    play(name) {
      if (A.anim === name || !actions[name]) return;
      const next = actions[name], prev = A.anim && actions[A.anim];
      next.reset();
      next.setLoop(LoopRepeat, Infinity);
      next.enabled = true;
      next.setEffectiveTimeScale(1).setEffectiveWeight(1);
      if (prev) next.crossFadeFrom(prev, FADE, false);
      next.play();
      A.anim = name;
      A.oneShot = null;
    },
    /** 한 번만 하는 동작 (기뻐하기) — 끝나면 서기로 */
    playOnce(name) {
      const next = actions[name];
      if (!next) return;
      const prev = A.anim && actions[A.anim];
      next.reset();
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
      next.setEffectiveTimeScale(1).setEffectiveWeight(1);
      if (prev && prev !== next) next.crossFadeFrom(prev, FADE, false);
      next.play();
      A.anim = name;
      A.oneShot = name;
    },
    setFacing(f) { A.facing = wrap(f); A.wantFacing = null; root.rotation.y = A.facing + Math.PI; },
    lookAt(x, z) { A.wantFacing = facingOf(x - A.position.x, z - A.position.z); },
    /** 땅 높이에 맞춰 놓기 */
    place(x, z, facing = A.facing) {
      const y = ctx.services.world?.island.heightAt(x, z) ?? 0;
      A.position.set(x, y, z);
      A.setFacing(facing);
    },
    setOpacity(a) {
      a = Math.max(0, Math.min(1, a));
      const was = A.opacity < 0.999;
      A.opacity = a;
      root.visible = a > 0.01;
      const now = a < 0.999;
      for (const m of mats) {
        m.opacity = a;
        if (was !== now) { m.transparent = now; m.depthWrite = !now || m.side !== THREE.BackSide; m.needsUpdate = true; }
      }
    },
    fade(to, seconds = 0.6) { A.fadeTo = to; A.fadeSpeed = 1 / Math.max(0.05, seconds); },
    get visible() { return root.visible; },

    /** 길(월드 좌표 점 목록)을 걷는다. 매 프레임 walk(dt, speed) 를 부른다 */
    setPath(points) { A.path = points.slice(); A.stuck = 0; },
    /**
     * 다음 점으로 한 걸음. avoid(x, z) → {x, z} 밀어내기 벡터.
     * 돌려주는 값: 'walking' | 'arrived' | 'stuck'
     */
    walk(dt, speed, avoid) {
      const world = ctx.services.world;
      const p = A.position;
      while (A.path.length && Math.hypot(A.path[0].x - p.x, A.path[0].z - p.z) < (A.path.length > 1 ? 0.45 : 0.12)) A.path.shift();
      if (!A.path.length) { A.speed = 0; return 'arrived'; }
      const t = A.path[0];
      let dx = t.x - p.x, dz = t.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d; dz /= d;
      const push = avoid?.(p.x, p.z, dx, dz) ?? { x: 0, z: 0, wait: false };
      if (push.wait) { A.speed = 0; A.stuck += dt * 0.5; return A.stuck > 3 ? 'stuck' : 'walking'; }
      let vx = dx + push.x, vz = dz + push.z;
      const vl = Math.hypot(vx, vz) || 1;
      const step = Math.min(speed * dt, d);
      vx = (vx / vl) * step; vz = (vz / vl) * step;
      const r = world ? world.collide(p.x, p.z, p.x + vx, p.z + vz, RADIUS, p.y) : { x: p.x + vx, z: p.z + vz };
      const moved = Math.hypot(r.x - p.x, r.z - p.z);
      p.x = r.x; p.z = r.z;
      A.speed = dt > 0 ? moved / dt : 0;
      A.stuck = moved < step * 0.3 ? A.stuck + dt : Math.max(0, A.stuck - dt * 2);
      A.wantFacing = facingOf(vx, vz);
      return A.stuck > 1.4 ? 'stuck' : 'walking';
    },

    update(dt, animate = true) {
      // 높이 따라가기
      const world = ctx.services.world;
      if (world) {
        const gy = world.island.heightAt(A.position.x, A.position.z);
        const dy = gy - A.position.y;
        A.position.y = Math.abs(dy) > 0.6 ? gy : A.position.y + dy * (1 - Math.exp(-dt * 20));
      }
      // 부드럽게 돌기
      if (A.wantFacing != null) {
        const d = wrap(A.wantFacing - A.facing);
        A.facing = wrap(A.facing + Math.sign(d) * Math.min(Math.abs(d), TURN * dt));
        if (Math.abs(d) < 0.01) A.wantFacing = null;
        root.rotation.y = A.facing + Math.PI;
      }
      // 나타나기·사라지기
      if (A.opacity !== A.fadeTo) {
        const s = A.fadeSpeed * dt;
        A.setOpacity(A.opacity < A.fadeTo ? Math.min(A.fadeTo, A.opacity + s) : Math.max(A.fadeTo, A.opacity - s));
      }
      if (A.oneShot) {
        const a = actions[A.oneShot];
        if (!a.isRunning() || a.time >= a.getClip().duration - 0.02) A.play('idle');
      }
      if (animate && root.visible) mixer.update(dt);
    },
    /** 걷는 빠르기에 맞춰 걷기·달리기 동작 고르기 (플레이어와 같은 비율) */
    animateMove(speed, run = false) {
      if (A.oneShot && speed < 0.1) return;
      if (speed < 0.12) { A.play('idle'); return; }
      const name = run ? 'run' : 'walk';
      A.play(name);
      if (name === 'walk') actions.walk.timeScale = Math.max(0.55, speed / 2.6) * 1.45;
      else actions.run.timeScale = Math.max(0.7, speed / 5) * 1.2;
    },
  };
  A.setFacing(Math.PI);
  A.play('idle');
  // 처음 시작 위치가 서로 같아 보이지 않게 동작을 조금씩 어긋나게
  mixer.update(Math.random() * 2);
  return A;
}
