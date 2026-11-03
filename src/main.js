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
import { QUALITY, DEFAULT_QUALITY, urlQuality, ratioFor, createFrameGate, savedSpec } from './render/quality.js';
import { installErrors } from './core/errors.js';   // M7-P4: 오류 모으기 (문제 알리기 창이 담는다)

const errors = installErrors();

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
  // 사양: 처음은 적정(그림자·화면 효과 끔). 주소 ?quality=low · 게시본 #low 로 고를 수 있다 (render/quality.js QUALITY — 높음·적정·낮음·매우 낮음).
  // 섬폰 설정 「그래픽 사양」은 저장을 불러온 뒤 render 가 건다. 화소 배율은 창 크기에 따라 render(view.setSize)가 다시 정한다
  // 저장된 섬폰 사양은 저장을 다 읽기 전에 미리 엿봐서 처음부터 그 사양으로 연다 (열자마자 바꾸면 셰이더를 두 번 만든다).
  // 계단 무늬 줄이기(MSAA)는 렌더러를 만들 때만 정해진다 → 낮음·매우 낮음은 끔 (내장 그래픽에서 화소 칠하기가 가장 비싸다).
  // powerPreference: 그래픽 카드가 둘인 노트북에서 빠른 쪽을 쓴다
  let saved = null;
  try { saved = savedSpec(localStorage.getItem('island-life-save-v1')); } catch { /* 막힌 저장소 */ }
  const quality = urlQuality(location) ?? saved ?? DEFAULT_QUALITY;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY[quality].aa !== false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(ratioFor(quality, innerWidth, innerHeight, devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#BFE6F7');
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  camera.position.set(0, 14, 16);
  camera.lookAt(0, 0, 0);

  // 기본 조명. sky 모듈이 시간대에 따라 색·세기·방향을 바꾼다.
  const hemi = new THREE.HemisphereLight(0xeef8ff, 0xc9d79f, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(-8, 16, 10);
  sun.castShadow = QUALITY[quality].shadows;
  sun.shadow.mapSize.setScalar(QUALITY[quality].shadowSize);
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
    errors,                             // core/errors.js: 최근 오류 기록 (ui.report)
    services: {},                       // 모듈이 서로에게 주는 기능: data, time, world, player, ui, audio ...
    focus: new THREE.Vector3(),         // 카메라가 따라가는 지점 (보통 플레이어). 곡면 월드 중심이기도 하다.
    debug: params.has('debug'),
    quality,                            // 'high' | 'mid' | 'low' | 'min' (render 가 바꾼다)
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
  setTimeout(() => assets.prefetchPacks?.(), 3000);   // 게시본: 나머지 묶음을 쉬엄쉬엄 미리 받기 (처음 로딩 크기는 그대로)

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
  // 사양에 초당 장수 상한이 있으면(매우 낮음 30) 그 사이 화면 갱신은 건너뛴다 — 지나간 시간은 모아서 한 번에
  const gate = createFrameGate();
  renderer.setAnimationLoop(() => {
    const dt = gate(clock.getDelta(), QUALITY[ctx.quality]?.fps);
    if (dt !== null) step(dt);
  });
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
