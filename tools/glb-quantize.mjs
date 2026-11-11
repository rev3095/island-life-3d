// P40 게시 묶음용 모델 줄이기 (WASM 없음 — 아티팩트 CSP 에서 그대로 풀린다).
// GLB 안의 꼭짓점 값 중 정밀도가 덜 필요한 것만 작은 정수로 바꾼다. three 의 GLTFLoader 가 그대로 읽는다 (normalized 속성).
//   NORMAL    float×3 (12B) → 부호 있는 byte×3 + 빈칸 (4B, normalized)       — KHR_mesh_quantization (extensionsRequired)
//   WEIGHTS_0 float×4 (16B) → byte×4 (4B, normalized, 합 = 255 로 맞춤)        — glTF 2.0 기본에서 허용
// POSITION·TEXCOORD·애니메이션·인덱스는 그대로 (자리 오차 없음). 원본 파일(assets/)은 안 바꾸고 build-web 이 묶을 때만 쓴다.
// 개발 서버(파일 하나씩)는 원본을 읽는다 — 화면 비교로 같음을 본다 (docs/notes/p40-perf.md).

const ARRAY_BUFFER = 34962;
const FLOAT = 5126, BYTE = 5120, UNSIGNED_BYTE = 5121;
const EXT = 'KHR_mesh_quantization';

/** glb Buffer → { buf, saved } (바꿀 것이 없거나 모르는 모양이면 원본 그대로) */
export function quantizeGlb(src) {
  if (src.readUInt32LE(0) !== 0x46546c67) return { buf: src, saved: 0 };
  const jsonLen = src.readUInt32LE(12);
  const gl = JSON.parse(src.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const binLen = jsonLen + 20 < src.length ? src.readUInt32LE(20 + jsonLen) : 0;
  const bin = src.subarray(binStart, binStart + binLen);
  if ((gl.buffers?.length ?? 0) !== 1 || gl.buffers[0].uri) return { buf: src, saved: 0 };
  const acc = gl.accessors ?? [], bv = gl.bufferViews ?? [];

  // 바꿀 접근자: 모든 프리미티브의 NORMAL·WEIGHTS_0 (morph target 이 쓰는 접근자·sparse·다른 곳에서 같이 쓰는 bufferView 는 건너뜀)
  const want = new Map();   // 접근자 번호 → 'n' | 'w'
  const elsewhere = new Set();
  for (const m of gl.meshes ?? []) for (const p of m.primitives) {
    for (const [k, a] of Object.entries(p.attributes)) {
      if (k === 'NORMAL') want.set(a, 'n');
      else if (k === 'WEIGHTS_0') want.set(a, 'w');
      else elsewhere.add(a);
    }
    if (p.indices != null) elsewhere.add(p.indices);
    for (const t of p.targets ?? []) for (const a of Object.values(t)) elsewhere.add(a);
  }
  for (const a of gl.animations ?? []) for (const s of a.samplers) { elsewhere.add(s.input); elsewhere.add(s.output); }
  for (const s of gl.skins ?? []) if (s.inverseBindMatrices != null) elsewhere.add(s.inverseBindMatrices);
  const viewUse = new Map();
  acc.forEach((a, i) => { if (a.bufferView != null) viewUse.set(a.bufferView, (viewUse.get(a.bufferView) ?? 0) + 1); });
  for (const [i, kind] of [...want]) {
    const a = acc[i];
    const ok = !elsewhere.has(i) && !a.sparse && a.bufferView != null && a.componentType === FLOAT && viewUse.get(a.bufferView) === 1
      && (kind === 'n' ? a.type === 'VEC3' : a.type === 'VEC4');
    if (!ok) want.delete(i);
  }
  if (!want.size) return { buf: src, saved: 0 };

  // 새 BIN: 바꾸지 않는 bufferView 는 그대로 복사, 바꾸는 것은 새 바이트로
  const replaced = new Map();   // bufferView 번호 → Buffer
  for (const [i, kind] of want) {
    const a = acc[i], v = bv[a.bufferView];
    const stride = v.byteStride ?? (kind === 'n' ? 12 : 16);
    const comps = kind === 'n' ? 3 : 4;
    const out = Buffer.alloc(a.count * 4);
    for (let e = 0; e < a.count; e++) {
      const base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + e * stride;
      const f = [];
      for (let k = 0; k < comps; k++) f.push(bin.readFloatLE(base + k * 4));
      if (kind === 'n') {
        const len = Math.hypot(f[0], f[1], f[2]) || 1;
        for (let k = 0; k < 3; k++) out.writeInt8(Math.max(-127, Math.min(127, Math.round(f[k] / len * 127))), e * 4 + k);
      } else {
        const sum = f.reduce((s, x) => s + Math.max(0, x), 0) || 1;
        const q = f.map(x => Math.round(Math.max(0, x) / sum * 255));
        // 반올림 오차를 가장 큰 값에 몰아 합을 정확히 255 로
        const big = q.indexOf(Math.max(...q));
        q[big] += 255 - q.reduce((s, x) => s + x, 0);
        for (let k = 0; k < 4; k++) out.writeUInt8(Math.max(0, Math.min(255, q[k])), e * 4 + k);
      }
    }
    replaced.set(a.bufferView, out);
    a.componentType = kind === 'n' ? BYTE : UNSIGNED_BYTE;
    a.normalized = true;
    delete a.byteOffset;
    if (kind === 'n') { delete a.min; delete a.max; }
  }
  const chunks = [];
  let off = 0;
  bv.forEach((v, i) => {
    const data = replaced.get(i) ?? bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const pad = (4 - (off % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
    v.byteOffset = off;
    v.byteLength = data.length;
    if (replaced.has(i)) { v.byteStride = 4; v.target = ARRAY_BUFFER; }
    chunks.push(data);
    off += data.length;
  });
  const newBin = Buffer.concat([...chunks, Buffer.alloc((4 - (off % 4)) % 4)]);
  gl.buffers[0].byteLength = newBin.length;
  if ([...want.values()].includes('n')) {
    gl.extensionsUsed = [...new Set([...(gl.extensionsUsed ?? []), EXT])];
    gl.extensionsRequired = [...new Set([...(gl.extensionsRequired ?? []), EXT])];
  }
  let json = Buffer.from(JSON.stringify(gl), 'utf8');
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const total = 12 + 8 + json.length + 8 + newBin.length;
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const buf = Buffer.concat([head, jh, json, bh, newBin]);
  return { buf, saved: src.length - buf.length };
}

/** <slug>.glb.json 글자 → 줄인 글자 (같은 모양 { format, bytes, data }) */
export function quantizeGlbJson(text) {
  const j = JSON.parse(text);
  if (j?.format !== 'glb-base64' || typeof j.data !== 'string') return { text: JSON.stringify(j), saved: 0 };
  const { buf, saved } = quantizeGlb(Buffer.from(j.data, 'base64'));
  if (!saved) return { text: JSON.stringify(j), saved: 0 };
  return { text: JSON.stringify({ ...j, bytes: buf.length, data: buf.toString('base64') }), saved };
}
