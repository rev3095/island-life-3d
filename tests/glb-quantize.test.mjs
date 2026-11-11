// P40 게시 묶음 모델 줄이기 (tools/glb-quantize.mjs): 자리·인덱스·애니메이션 바이트는 그대로, 법선은 1/127 안, 뼈 가중치 합은 정확히 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantizeGlbJson } from '../tools/glb-quantize.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const parse = text => {
  const buf = Buffer.from(JSON.parse(text).data, 'base64');
  const jl = buf.readUInt32LE(12);
  const gl = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  return { gl, bin: buf.subarray(20 + jl + 8) };
};
const READ = { 5126: [4, 'readFloatLE'], 5120: [1, 'readInt8'], 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'] };
const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function values({ gl, bin }, i) {
  const a = gl.accessors[i], v = gl.bufferViews[a.bufferView], [size, fn] = READ[a.componentType], n = N[a.type];
  const stride = v.byteStride ?? size * n, out = [];
  const div = a.normalized ? (a.componentType === 5120 ? 127 : 255) : 1;
  for (let e = 0; e < a.count; e++) for (let k = 0; k < n; k++) out.push(bin[fn]((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + e * stride + k * size) / div);
  return out;
}

for (const path of ['assets/models/coco.glb.json', 'assets/models/player.glb.json', 'assets/env/models/tree.glb.json', 'assets/furniture/models/sofa.glb.json']) {
  test(`glb-quantize: ${path}`, () => {
    const text = readFileSync(join(ROOT, path), 'utf8');
    const { text: out, saved } = quantizeGlbJson(text);
    assert.ok(saved > 0, '줄어듦');
    const A = parse(text), B = parse(out);
    assert.equal(B.gl.accessors.length, A.gl.accessors.length);
    assert.ok(B.gl.extensionsRequired.includes('KHR_mesh_quantization'));
    for (const [mi, m] of A.gl.meshes.entries()) for (const [pi, p] of m.primitives.entries()) {
      const q = B.gl.meshes[mi].primitives[pi];
      assert.deepEqual(values(B, q.attributes.POSITION), values(A, p.attributes.POSITION), '자리 그대로');
      if (p.indices != null) assert.deepEqual(values(B, q.indices), values(A, p.indices), '인덱스 그대로');
      const na = values(A, p.attributes.NORMAL), nb = values(B, q.attributes.NORMAL);
      for (let i = 0; i < na.length; i++) assert.ok(Math.abs(na[i] - nb[i]) < 1.5 / 127, `법선 ${i}`);
      if (p.attributes.WEIGHTS_0 != null) {
        const w = values(B, q.attributes.WEIGHTS_0), wa = values(A, p.attributes.WEIGHTS_0);
        for (let i = 0; i < w.length; i += 4) assert.equal(Math.round((w[i] + w[i + 1] + w[i + 2] + w[i + 3]) * 255), 255, '가중치 합');
        for (let i = 0; i < w.length; i++) assert.ok(Math.abs(w[i] - wa[i]) < 2 / 255, `가중치 ${i}`);
      }
    }
    for (const [ai, an] of (A.gl.animations ?? []).entries()) for (const [si, s] of an.samplers.entries()) {
      const t = B.gl.animations[ai].samplers[si];
      assert.deepEqual(values(B, t.output), values(A, s.output), '애니메이션 그대로');
    }
  });
}
