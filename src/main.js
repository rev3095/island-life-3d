// 포근섬 이야기 — 게임 시작점.
// 렌더러·장면·카메라·기본 조명과 공용 도구(ctx)를 만들고, 각 개발 트랙의 모듈을 순서대로 불러온다.
// 아직 없는 모듈은 건너뛰므로 어느 브랜치에서든 index.html 이 열린다. 모듈 계약은 docs/CONTRACTS.md.
import * as THREE from 'three';
import { createEvents } from './core/events.js';
import { createState } from './core/state.js';
import { createInput } from './core/input.js';
import * as assets from './core/assets.js';
import * as materials from './core/materials.js';
import * as constants from './core/constants.js';
import { createView } from './render/index.js';

// 불러오는 순서 = 초기화 순서. 앞 모듈이 ctx.services 에 올린 것을 뒤 모듈이 쓸 수 있다.
const MODULES = [
  ['data', './data/index.js'],         // 트랙 T2: 아이템·출현표·가방·지갑·저장
  ['sky', './sky/index.js'],           // 트랙 T5: 시간·계절·날씨·하늘
  ['world', './world/index.js'],       // 트랙 T1: 섬 지형·배경 배치·충돌
  ['player', './player/index.js'],     // 트랙 T1: 플레이어·카메라
  ['ui', './ui/index.js'],             // 트랙 T3: HUD·대화·가방·섬폰
  ['audio', './audio/index.js'],       // 트랙 T4: 배경음·효과음·목소리
  ['gameplay', './gameplay/index.js'], // 2차: 채집·주민·상점·박물관·집
];

const params = new URLSearchParams(location.search);

async function boot() {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // 품질: 휴대폰(터치 기기)이나 ?quality=low 면 해상도·그림자를 낮춘다 (그림자가 프레임 시간의 절반쯤 든다)
  const quality = params.get('quality') ?? (matchMedia('(pointer: coarse)').matches ? 'low' : 'high');
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#BFE6F7');
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  camera.position.set(0, 14, 16);
  camera.lookAt(0, 0, 0);

  // 기본 조명. sky 모듈이 시간대에 따라 색·세기·방향을 바꾼다.
  const hemi = new THREE.HemisphereLight(0xeef8ff, 0xc9d79f, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(-8, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(quality === 'low' ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun, sun.target);

  const events = createEvents();
  const ctx = {
    THREE, renderer, scene, camera, events,
    state: createState(),
    input: createInput(events, { touchRoot: document.getElementById('ui') }),
    assets, materials, constants,
    lights: { hemi, sun, sunOffset: new THREE.Vector3(-8, 16, 10) },   // sunOffset: focus 기준 해 방향·거리 (sky 가 바꾼다)
    uiRoot: document.getElementById('ui'),
    services: {},                       // 모듈이 서로에게 주는 기능: data, time, world, player, ui, audio ...
    focus: new THREE.Vector3(),         // 카메라가 따라가는 지점 (보통 플레이어). 곡면 월드 중심이기도 하다.
    debug: params.has('debug'),
    quality,                            // 'high' | 'low'
  };
  window.__island = ctx;                // 개발용: 콘솔에서 상태 확인

  // 그리기: 스타일 셰이더 값 + 화면 효과 (src/render). ?style=toon 이면 예전 툰 모습으로 비교
  const view = createView(ctx, { preset: params.get('style') });

  // 섬폰 설정의 외곽선 켜기/끄기: 외곽선 메시는 모두 userData.outline 표시가 있다 (core·world·player 공통)
  events.on('settings:changed', ({ key }) => {
    if (key !== 'outline') return;
    const on = ctx.state.settings.outline !== false;
    scene.traverse(o => { if (o.userData.outline) o.visible = on; });
  });

  const loaded = [];
  for (const [name, path] of MODULES) {
    let mod;
    try { mod = (await import(path)).default; }
    catch { if (ctx.debug) console.info(`[boot] ${name} 모듈 없음 — 건너뜀`); continue; }
    try { await mod.init?.(ctx); loaded.push([name, mod]); console.info(`[boot] ${name} 준비됨`); }
    catch (e) { console.error(`[boot] ${name} 초기화 실패`, e); }
  }
  if (!ctx.services.world) await coreCheck(ctx);
  events.emit('game:ready', { modules: loaded.map(([n]) => n) });

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    view.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  /** 한 프레임: 모듈 update → 해·곡면 중심 맞추기 → 그리기. 개발용으로 ctx.step(dt) 로도 부를 수 있다 (창이 숨겨져 rAF 가 멈출 때) */
  const step = dt => {
    ctx.input.update();
    for (const [name, mod] of loaded) {
      try { mod.update?.(dt, ctx); } catch (e) { console.error(`[loop] ${name}`, e); }
    }
    materials.curve.uCurveOrigin.value.copy(ctx.focus);
    sun.target.position.copy(ctx.focus);
    sun.position.copy(ctx.focus).add(ctx.lights.sunOffset);
    view.render(dt);
  };
  ctx.step = step;
  renderer.setAnimationLoop(() => step(Math.min(clock.getDelta(), 0.05)));
}

/** world 모듈이 없을 때: 공용 도구(모델 불러오기·툰 재질·곡면 월드)가 제대로 도는지 보여주는 확인 장면 */
async function coreCheck(ctx) {
  const { THREE, scene, assets, materials } = ctx;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 40, 40), materials.toonMaterial('#A9C46A', { name: 'ground' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const put = async (slug, x, z, rot = 0) => {
    const [gltf, spec] = await Promise.all([assets.loadEnv(slug), assets.loadEnvSpec(slug)]);
    const { scene: obj } = assets.instantiate(gltf);
    materials.applyToonStyle(obj, { spec });
    obj.position.set(x, 0, z);
    obj.rotation.y = rot;
    scene.add(obj);
  };
  const jobs = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    jobs.push(put(i % 3 ? 'tree' : 'cedar', Math.cos(a) * 7, Math.sin(a) * 7 - 2, a));
  }
  jobs.push(put('house-player', 0, -6), put('rock', 3, 2), put('tulip', -2, 2), put('cosmos', -2.6, 2.4), put('lamp', 2, -2.5));
  const [gltf] = await Promise.all([assets.loadCharacter('player'), ...jobs]);
  const { scene: player, animations } = assets.instantiate(gltf);
  materials.applyToonStyle(player, { outlineWidth: 0.006 });
  scene.add(player);
  const mixer = new THREE.AnimationMixer(player);
  mixer.clipAction(animations.find(a => a.name === 'idle')).play();
  ctx.focus.set(0, 0, 0);
  const note = document.createElement('div');
  note.className = 'core-check';
  note.textContent = '공용 기반 확인 장면 — 섬(world) 모듈이 아직 없어요';
  ctx.uiRoot.append(note);
  let t = 0;
  const tick = () => { const dt = 1 / 60; t += dt; mixer.update(dt); camTick(t); requestAnimationFrame(tick); };
  const camTick = time => { ctx.camera.position.set(Math.sin(time * 0.1) * 3, 12, 15); ctx.camera.lookAt(0, 0.5, 0); };
  tick();
}

boot().catch(e => {
  console.error(e);
  document.getElementById('ui').insertAdjacentHTML('beforeend', `<div class="core-check">시작하지 못했어요: ${String(e.message ?? e)}</div>`);
});
