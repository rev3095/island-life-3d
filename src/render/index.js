// 그리기 담당: 스타일 값(프리셋)을 재질 uniform·외곽선·화면 효과에 나눠 넣고, 매 프레임 장면을 그린다.
// ctx.services.style = { preset, presets, params, set(값|프리셋이름), get(), use(이름), compare({on, x, preset|params}), stats() }
// main.js 는 createView(ctx) 한 번, 창 크기가 바뀌면 view.setSize(w, h), 매 프레임 view.render(dt) 만 부른다.
// 처음 프리셋: 주소 ?style= > 섬폰 설정(state.settings.style, 저장됨) > cozy. 섬폰에서 바꾸면 settings:changed {key:'style'} 로 따라간다.
// 집 안(scene:indoor {on})에선 프리셋 위에 INDOOR 값을 잠깐 얹는다 (get() 은 얹기 전 값).
import * as THREE from 'three';
import * as materials from '../core/materials.js';
import { PARAMS, PRESETS, PRESET_LABELS, DEFAULT_PRESET, INDOOR } from './presets.js';
import { createPost } from './post.js';

const clone = o => JSON.parse(JSON.stringify(o));

/** 값을 범위 안으로 (모르는 키는 버린다) */
function sanitize(input, base) {
  const out = { ...base };
  for (const p of PARAMS) {
    if (!(p.key in (input ?? {}))) continue;
    const v = input[p.key];
    if (p.type === 'range') { const n = Number(v); if (Number.isFinite(n)) out[p.key] = Math.min(p.max, Math.max(p.min, n)); }
    else if (p.type === 'color') { if (/^#[0-9a-f]{6}$/i.test(String(v))) out[p.key] = String(v).toUpperCase(); }
    else if (p.type === 'select') { if (p.options.some(([k]) => k === v)) out[p.key] = v; }
    else if (p.type === 'bool') out[p.key] = !!v;
  }
  return out;
}

// sky 의 ShaderMaterial(하늘 돔·별·비·빛무리)은 화면 색(sRGB)을 그대로 내보낸다.
// 화면 효과를 쓸 때는 장면을 선형 버퍼에 그리므로, 그 재질들만 끝에서 선형으로 바꿔 준다 (uStyleLinear = 1 일 때만).
const linearOut = { value: 0 };
function linearize(m) {
  if (!m?.isShaderMaterial || m.isRawShaderMaterial || m.userData.styleLinear) return;
  m.userData.styleLinear = true;
  if (/colorspace_fragment|linearToOutputTexel/.test(m.fragmentShader)) return;     // 스스로 색 공간을 맞추는 재질
  const premul = (m.blending === THREE.CustomBlending && m.blendSrc === THREE.OneFactor) || m.premultipliedAlpha;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uStyleLinear = linearOut;
    const fix = premul
      ? 'float styleA = max( gl_FragColor.a, 1e-4 ); gl_FragColor.rgb = sRGBTransferEOTF( vec4( gl_FragColor.rgb / styleA, 1.0 ) ).rgb * styleA;'
      : 'gl_FragColor.rgb = sRGBTransferEOTF( vec4( gl_FragColor.rgb, 1.0 ) ).rgb;';
    sh.fragmentShader = sh.fragmentShader.replace(/void\s+main\s*\(\s*(void)?\s*\)/, 'void styleMainSrc()')
      + `\nuniform float uStyleLinear;\nvoid main() {\n  styleMainSrc();\n  if ( uStyleLinear > 0.5 ) { ${fix} }\n}\n`;
  };
  m.customProgramCacheKey = () => prevKey.call(m) + '|style-linear';
  m.needsUpdate = true;
}

export function createView(ctx, { preset: startPreset } = {}) {
  const { renderer, scene, camera, events } = ctx;
  const quality = ctx.quality ?? 'high';
  const look = materials.look;
  let post = null;                         // 화면 효과는 처음 쓸 때 만든다 ('toon' 만 쓰면 비용 0)
  const fromUrl = !!PRESETS[startPreset];
  const saved = ctx.state?.settings?.style;
  let presetName = fromUrl ? startPreset : PRESETS[saved] ? saved : DEFAULT_PRESET;
  let params = clone(PRESETS[presetName]);
  let indoor = false;
  /** 지금 그릴 값: 집 안이면 INDOOR 를 얹는다 */
  const live = () => (indoor && INDOOR[presetName] ? sanitize(INDOOR[presetName], params) : params);
  let compare = null;                      // { x: 0~1, params } — 왼쪽은 compare.params, 오른쪽은 지금 값
  let scanIn = 0;
  const last = { ms: 0, passes: [] };
  const size = { w: 1, h: 1 };

  function ensurePost() {
    if (!post) { post = createPost(renderer, scene, camera, { quality }); post.setSize(size.w, size.h); }
    return post;
  }

  /** 값 → 재질 uniform · 외곽선 · 화면 효과 */
  function apply(p) {
    look.uBands.value = p.bands; look.uBandSoft.value = p.bandSoft; look.uShadeFloor.value = p.shadeFloor;
    look.uWrap.value = p.wrap; look.uCastDark.value = p.castDark;
    look.uShadeTint.value.set(p.shadeTint); look.uLitTint.value.set(p.litTint); look.uShadeSat.value = p.shadeSat;
    look.uRim.value = p.rim; look.uRimChar.value = p.rimChar; look.uRimPower.value = p.rimPower;
    look.uSpec.value = p.spec; look.uSpecSize.value = p.specSize;
    look.uPaint.value = p.paint; look.uPaintScale.value = p.paintScale;
    look.uAO.value = p.ao; look.uAOHeight.value = p.aoHeight;
    look.uWind.value = p.wind; look.uWindSpeed.value = p.windSpeed;
    look.uWater.value = p.water; look.uWaterScale.value = p.waterScale;
    look.uGlow.value = p.glow;
    // 외곽선: ink = 예전 갈색 잉크 그대로, subtle = 가늘고 물체 색을 어둡게, off = 재질째 숨김 (섬폰 외곽선 끄기와는 따로)
    const ink = p.outline === 'ink';
    look.uOutlineScale.value = ink ? 1 : p.outlineScale;
    look.uOutlineTint.value = ink ? 0 : p.outlineTint;
    look.uOutlineDark.value = p.outlineDark;
    materials.setOutlinesVisible(p.outline !== 'off');
    if (p.post) ensurePost().apply(p);
  }

  function frame(p, dt) {
    if (p.post) {
      linearOut.value = 1;
      post.render(dt);
    } else {
      linearOut.value = 0;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  const service = {
    get preset() { return presetName; },
    get presets() { return clone(PRESETS); },
    labels: { ...PRESET_LABELS },
    params: PARAMS,
    get quality() { return quality; },
    /** set('toon') = 프리셋으로, set({ bloom: 0.5 }) = 지금 값에 덮어쓰기, set({ preset: 'cozy', ...값 }) = 프리셋 위에 덮어쓰기 */
    set(v) {
      if (typeof v === 'string') return service.use(v);
      const base = v?.preset && PRESETS[v.preset] ? (presetName = v.preset, PRESETS[v.preset]) : params;
      params = sanitize(v, base);
      apply(live());
      events?.emit('style:changed', { preset: presetName, params: clone(params) });
      return clone(params);
    },
    use(name) {
      if (!PRESETS[name]) return clone(params);
      presetName = name;
      params = clone(PRESETS[name]);
      apply(live());
      events?.emit('style:changed', { preset: presetName, params: clone(params) });
      return clone(params);
    },
    get() { return clone(params); },
    /** 나눠 보기 (편집기): on, x(0~1, 왼쪽 몫), preset 또는 params (왼쪽에 그릴 값) */
    compare({ on = true, x = 0.5, preset = 'toon', params: left } = {}) {
      compare = on ? { x, params: sanitize(left ?? PRESETS[preset] ?? PRESETS.toon, PRESETS.toon) } : null;
      if (!compare) apply(live());
    },
    stats() { return { ...last }; },
    /** 개발용: 화면 효과 묶음 (패스를 더하거나 재 볼 때) */
    get post() { return post; },
  };
  ctx.services.style = service;
  apply(live());
  // 저장을 불러온 뒤 / 섬폰 설정을 바꿨을 때 (주소로 고른 프리셋이 있으면 그게 먼저)
  events?.on('data:loaded', () => { const s = ctx.state?.settings?.style; if (!fromUrl && PRESETS[s] && s !== presetName) service.use(s); });
  events?.on('settings:changed', ({ key, value }) => { if (key === 'style' && PRESETS[value]) service.use(value); });
  events?.on('scene:indoor', ({ on }) => { indoor = !!on; apply(live()); });

  return {
    service,
    setSize(w, h) {
      size.w = w; size.h = h;
      renderer.setSize(w, h, false);
      if (post) { post.setSize(w, h); const p = live(); if (p.post) post.apply(p); }
    },
    render(dt) {
      const t0 = performance.now();
      look.uStyleTime.value = (look.uStyleTime.value + dt) % 3600;
      // 새로 생긴 sky 셰이더 재질 찾기 (가벼움: 1초에 한 번)
      if ((scanIn -= dt) <= 0) {
        scanIn = 1;
        scene.traverse(o => { const m = o.material; if (Array.isArray(m)) m.forEach(linearize); else if (m) linearize(m); });
      }
      if (!compare) {
        frame(live(), dt);
      } else {
        // 왼쪽 = 비교 값, 오른쪽 = 지금 값. 그림자 지도는 첫 번째 그릴 때 한 번만 만든다
        const w = size.w, h = size.h, sx = Math.round(w * compare.x);
        apply(compare.params);
        renderer.setScissorTest(false);
        frame(compare.params, dt);
        const right = live();
        apply(right);
        const auto = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        renderer.setScissor(sx, 0, w - sx, h);
        renderer.setScissorTest(true);
        frame(right, dt);
        renderer.setScissorTest(false);
        renderer.shadowMap.autoUpdate = auto;
      }
      last.ms = performance.now() - t0;
      last.passes = params.post && post ? post.composer.passes.filter(p => p.enabled).map(p => p.constructor.name === 'ShaderPass' ? p.material.name : p.constructor.name) : ['direct'];
    },
  };
}
