"""캐릭터 빌더: assets/specs/<slug>.json → .blend / .glb / 렌더 이미지 / 통계

실행:  blender -b --factory-startup --python build_character.py -- <spec.json> <assets_dir> [--no-render]
(보통은 tools/build-character.mjs 로 실행한다)

스펙의 proportions / palette / outfit / style 값이 모델에 그대로 반영된다.
prompt(컨셉·키워드·레퍼런스)는 사람이 읽는 설명이라 스크립트가 직접 쓰지 않는다.
좌표계: Blender Z-up, 캐릭터 정면 = -Y. 키 1.0 = 게임 타일 1칸.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SPEC_PATH, ASSETS = os.path.abspath(args[0]), os.path.abspath(args[1])
DO_RENDER = '--no-render' not in args

spec = json.load(open(SPEC_PATH, encoding='utf-8'))
SLUG = spec['slug']
P = {'height': 1.0, 'headScale': 1.0, 'bodyWidth': 1.0, 'limbLength': 1.0, 'earSize': 1.0,
     'earPointiness': 1.0, 'tailLength': 1.0, 'eyeSize': 1.0, 'eyeSpacing': 1.0, **spec.get('proportions', {})}
PAL = spec['palette']
OUTFIT = spec.get('outfit', {})
STYLE = spec.get('style', {})
H = P['height']

# 종족별 기본 생김새. 스펙의 "features" 로 하나씩 덮어쓸 수 있다.
FEATURES = {
    'human': {'ears': 'human', 'mouth': 'smile', 'hair': True, 'head': (1.04, 0.96, 0.92), 'eyeSpread': 1.05},
    'cat': {'ears': 'cat', 'muzzle': 'cat', 'tail': 'cat'},
    'dog': {'ears': 'floppy', 'muzzle': 'dog', 'tail': 'curl'},
    'rabbit': {'ears': 'long', 'muzzle': 'small', 'tail': 'puff'},
    'bear': {'ears': 'round', 'muzzle': 'bear', 'tail': 'puff'},
    'duck': {'muzzle': 'beak', 'tail': 'feather', 'crest': True},
    'frog': {'mouth': 'wide', 'eyes': 'bumps', 'faceBelly': True, 'head': (1.25, 0.95, 0.75), 'blushSpread': 1.1},
    'squirrel': {'ears': 'tuft', 'muzzle': 'small', 'tail': 'bushy'},
    'fox': {'ears': 'fox', 'muzzle': 'cat', 'tail': 'fox'},   # 고양이 귀(끝 진한 색) + 다람쥐 꼬리(끝 흰색) 다시 쓰기
    'tortoise': {'mouth': 'smile', 'tail': 'stub', 'shell': True, 'head': (1.0, 0.95, 0.9)},
    # 10차 M10-P3 (보드 wave10 D93-A) 새 주민 셋
    'sheep': {'ears': 'round', 'earSide': True, 'muzzle': 'small', 'tail': 'puff', 'wool': True, 'head': (1.06, 0.95, 0.9)},   # 곰 둥근 귀(옆으로) + 털 뭉치
    'penguin': {'muzzle': 'beak', 'beakScale': 0.6, 'tail': 'feather', 'wings': True, 'faceMask': True, 'head': (1.06, 0.96, 0.92)},   # 오리 부리 + 날개
    'owl': {'muzzle': 'hook', 'tail': 'feather', 'ears': 'tufts', 'eyes': 'big', 'head': (1.12, 0.95, 0.88), 'eyeSpread': 0.92},   # 귀깃 + 큰 눈
}
SPECIES = spec.get('species', 'cat')
F = {**FEATURES.get(SPECIES, {}), **spec.get('features', {})}
ACC = set(spec.get('accessories', []))


def col(key, fallback='fur'):
    """팔레트에 그 색이 있으면 그 재질 이름, 없으면 대체 재질 이름."""
    return key if key in PAL else fallback

for sub in ('models', 'renders', 'blender'):
    os.makedirs(os.path.join(ASSETS, sub), exist_ok=True)


def lin(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# ---------------------------------------------------------------- 씬 초기화
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.armatures, bpy.data.actions):
    for d in list(coll):
        coll.remove(d)
scene.render.fps = 24


# ---------------------------------------------------------------- 메시 조립기
class Builder:
    """여러 부품을 하나의 bmesh 로 합치면서 부품마다 재질·본 가중치를 기록한다."""

    def __init__(self):
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.verify()
        self.mats, self.groups = [], ['outline']

    def _idx(self, lst, name):
        if name not in lst:
            lst.append(name)
        return lst.index(name)

    def add(self, tmp, mat, weights, outline=True):
        vmap = {}
        for v in tmp.verts:
            nv = self.bm.verts.new(v.co)
            w = weights(v.co) if callable(weights) else {weights: 1.0}
            for g, val in w.items():
                if val > 1e-3:
                    nv[self.dl][self._idx(self.groups, g)] = val
            if outline:
                nv[self.dl][0] = 1.0
            vmap[v] = nv
        for f in tmp.faces:
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = self._idx(self.mats, mat(f.calc_center_median()) if callable(mat) else mat)
            nf.smooth = True
        tmp.free()


def ellipsoid(center, radii, rot=None, seg=24, rings=14):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    R = rot.to_4x4() if rot is not None else Matrix.Identity(4)
    M = Matrix.Translation(Vector(center)) @ R @ Matrix.Diagonal((*radii, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def capsule(a, b, r, seg=16, rings=10):
    a, b = Vector(a), Vector(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        if v.co.z > 1e-5:
            v.co.z += d.length
    M = Matrix.Translation(a) @ Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def cone(base, tip, r1, r2, squash=1.0, seg=20):
    base, tip = Vector(base), Vector(tip)
    d = tip - base
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=d.length)
    R = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    M = Matrix.Translation(base + d / 2) @ R @ Matrix.Diagonal((1.0, squash, 1.0, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def tube(points, radii, seg=12, closed=False):
    """점들을 따라가는 관. closed 면 고리(안경테), 아니면 양 끝을 막는다."""
    bm = bmesh.new()
    rings, n = [], len(points)
    for i, p in enumerate(points):
        if closed:
            t = (points[(i + 1) % n] - points[(i - 1) % n]).normalized()
        else:
            t = (points[min(i + 1, n - 1)] - points[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        x = t.cross(up).normalized()
        y = t.cross(x).normalized()
        rings.append([bm.verts.new(p + (x * math.cos(a) + y * math.sin(a)) * radii[i])
                      for a in (2 * math.pi * k / seg for k in range(seg))])
    for i in range(n if closed else n - 1):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            bm.faces.new([a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]])
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def ring_points(center, n, radius, seg=24):
    r = Vector((1, 0, 0))
    r = (r - n * r.dot(n)).normalized()
    u = n.cross(r).normalized()
    return [center + (r * math.cos(a) + u * math.sin(a)) * radius for a in (2 * math.pi * k / seg for k in range(seg))]


def bezier(p0, p1, p2, p3, n):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(p0 * u ** 3 + p1 * 3 * u * u * t + p2 * 3 * u * t * t + p3 * t ** 3)
    return out


# ---------------------------------------------------------------- 비율
legLen = 0.13 * P['limbLength']
bw = P['bodyWidth']
hs = P['headScale']
BODY_C = Vector((0, 0, legLen + 0.12))
BODY_R = (0.16 * bw, 0.14 * bw, 0.155)
bodyTop = BODY_C.z + BODY_R[2]
hr = 0.26 * hs
HF = F.get('head', (1.1, 0.95, 0.9))
HEAD_R = (hr * HF[0], hr * HF[1], hr * HF[2])
HEAD_C = Vector((0, 0, bodyTop + HEAD_R[2] * 0.78))


def ell_point(C, R, yaw, pitch, inset=0.0):
    """타원체 표면의 점과 법선. yaw 0 = 정면(-Y), π = 뒤, pitch + = 위쪽."""
    a, b, c = R
    d = Vector((a * math.cos(pitch) * math.sin(yaw), -b * math.cos(pitch) * math.cos(yaw), c * math.sin(pitch)))
    n = Vector((d.x / a ** 2, d.y / b ** 2, d.z / c ** 2)).normalized()
    return C + d - n * inset, n


def head_point(yaw, pitch, inset=0.0):
    return ell_point(HEAD_C, HEAD_R, yaw, pitch, inset)


def surface_frame(n):
    r = Vector((1, 0, 0))
    r = (r - n * r.dot(n)).normalized()
    return r, n.cross(r).normalized()


def decal(n):
    """로컬 -Y 가 법선 n 을 향하도록 하는 회전 (얼굴 위 부품용)."""
    r, u = surface_frame(n)
    return Matrix((r, -n, u)).transposed()


def align_z(d):
    return Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()


def rot_y(angle):
    return Matrix.Rotation(angle, 3, 'Y')


V = Vector

# ---------------------------------------------------------------- 모델링
B = Builder()

# 몸통: 셔츠 / 줄무늬 / 반바지 (+앞치마) 를 높이·앞뒤로 나눈다
pantsTop = BODY_C.z - 0.045
nstripe = OUTFIT.get('stripes', 0) if OUTFIT.get('top') == 'striped-tee' else 0
bands = [pantsTop + (i + 1) * (bodyTop - 0.03 - pantsTop) / (nstripe + 1) for i in range(nstripe)]


def body_mat(c):
    if 'apron' in ACC and c.y < -BODY_R[1] * 0.3 and abs(c.x) < BODY_R[0] * 0.6 and pantsTop - 0.07 < c.z < bodyTop - 0.045:
        return 'apron'
    if c.z < pantsTop:
        return 'pants'
    if any(abs(c.z - z) < 0.013 for z in bands):
        return 'stripe'
    return 'shirt'


def body_w(co):
    t = min(1.0, max(0.0, (co.z - (BODY_C.z - 0.06)) / 0.12))
    return {'hips': 1 - t, 'spine': t}


body_bm = ellipsoid(BODY_C, BODY_R, seg=32, rings=22)
for v in body_bm.verts:   # 아래쪽을 살짝 눌러서 반바지가 뾰족해 보이지 않게
    if v.co.z < BODY_C.z:
        v.co.z = BODY_C.z - (BODY_C.z - v.co.z) * 0.82
B.add(body_bm, body_mat, body_w)

ARMS, LEGS, EARS = {}, {}, {}
# 무릎 (10차 AN-11 앉기): 다리 뼈를 허벅지 leg.* + 정강이 shin.* 둘로 나눈다. 서 있을 때 모양·예전 동작은 그대로
KNEE_Z = 0.03 + (legLen + 0.01) * 0.5


def leg_w(side):
    def w(co):
        t = min(1.0, max(0.0, (KNEE_Z + 0.02 - co.z) / 0.04))
        return {'leg.' + side: 1 - t, 'shin.' + side: t}
    return w


for side, sx in (('L', 1), ('R', -1)):
    # 다리 + 발
    x = 0.068 * bw * sx
    top, bot = V((x, 0, legLen + 0.05)), V((x, 0, 0.05))
    B.add(capsule(top, bot, 0.05), lambda c: 'pants' if c.z > legLen - 0.005 else col('feet'), leg_w(side))
    B.add(ellipsoid(V((x, -0.02, 0.032)), (0.054, 0.068, 0.036)), col('feet'), 'shin.' + side)
    LEGS[side] = (V((x, 0, legLen + 0.04)), V((x, 0, KNEE_Z)), V((x, 0, 0.03)))

    # 팔 (윗부분은 소매) + 손
    sh = V((sx * BODY_R[0] * 0.9, 0, BODY_C.z + 0.075))
    hand = sh + V((sx * 0.055, -0.01, -0.15 * P['limbLength']))
    if F.get('wings'):   # 펭귄 날개: 손 대신 납작한 지느러미 날개 (팔 뼈에 붙어 같이 흔들린다)
        d = hand - sh
        L = d.length
        wb = ellipsoid(sh + d * 0.5 + V((sx * 0.012, 0, -0.012)), (0.026, 0.058, L * 0.5 + 0.035), rot=align_z(d), seg=18, rings=12)
        for v in wb.verts:   # 끝으로 갈수록 가늘게 (노 모양)
            k = 1.0 - 0.35 * max(0.0, (v.co - sh).dot(d.normalized()) / L)
            rel = v.co - (sh + d * 0.5)
            along = d.normalized() * rel.dot(d.normalized())
            v.co = sh + d * 0.5 + along + (rel - along) * k
        B.add(wb, 'fur', 'arm.' + side)
    else:
        B.add(capsule(sh, hand, 0.04, seg=14, rings=10), lambda c, z=sh.z: 'shirt' if c.z > z - 0.035 else 'fur', 'arm.' + side)
        B.add(ellipsoid(hand, (0.047, 0.047, 0.047), seg=16, rings=10), 'fur', 'arm.' + side)
    ARMS[side] = (sh, hand)

# 머리 (개구리는 얼굴 아래쪽을 배 색으로 칠한다)
head_mat = 'fur'
if F.get('faceBelly'):
    # 앞쪽은 높게, 뒤로 갈수록 낮아지는 비스듬한 경계 (옆에서 봐도 각진 자국이 없게)
    head_mat = lambda c: col('muzzle') if (c - HEAD_C).z / HEAD_R[2] < -0.3 - 0.18 * (c - HEAD_C).y / HEAD_R[1] else 'fur'
B.add(ellipsoid(HEAD_C, HEAD_R, seg=40, rings=26), head_mat, 'head')
MASK_LIFT = 0.009 * hs if F.get('faceMask') else 0.0   # 가면 두께 → 눈·볼·부리를 그만큼 띄운다
if F.get('faceMask'):
    # 펭귄 얼굴 흰 가면: 머리보다 아주 조금 작은 타원체를 앞으로 살짝 밀어 겹치면 머리 겉에 매끈한 둥근 경계로 드러난다.
    # 눈 둘레 두 덩이 + 볼·턱 한 덩이 = 이마 가운데가 파인 하트 모양. (yaw, pitch, 경계 반각)
    rm = sum(HEAD_R) / 3
    for yaw, pitch, half in ((0.36, 0.14, 0.62), (-0.36, 0.14, 0.62), (0.0, -0.32, 0.85)):
        u = V((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
        shrink = MASK_LIFT / (rm * (1 / math.cos(half) - 1))   # 가운데가 MASK_LIFT 만큼 솟게
        off = shrink * rm / math.cos(half)
        B.add(ellipsoid(HEAD_C + u * off, tuple(r * (1 - shrink) for r in HEAD_R), seg=48, rings=32), col('muzzle'), 'head', outline=False)


def line_tube(points, r=0.0055):
    B.add(tube(points, [r * hs] * len(points), seg=8), 'eye', 'head', outline=False)


# 주둥이 · 코 · 입
MUZZLES = {  # 반지름(x, 깊이, z), 위치 pitch, 코 크기
    'cat': ((0.085, 0.05, 0.062), -0.32, (0.022, 0.014, 0.015)),
    'dog': ((0.1, 0.066, 0.072), -0.27, (0.034, 0.022, 0.024)),
    'bear': ((0.095, 0.06, 0.07), -0.28, (0.03, 0.02, 0.022)),
    'small': ((0.068, 0.04, 0.05), -0.3, (0.018, 0.012, 0.013)),
}
mz = F.get('muzzle')
if mz in MUZZLES:
    R0, pitch, nose_r = MUZZLES[mz]
    MR = tuple(v * hs for v in R0)
    mp, mn = head_point(0, pitch, inset=0.02 * hs)
    B.add(ellipsoid(mp, MR, rot=decal(mn), seg=24, rings=14), col('muzzle'), 'head')
    mr, mu = surface_frame(mn)

    def on_muzzle(x, y):
        depth = MR[1] * math.sqrt(max(0.0, 1 - (x / MR[0]) ** 2 - (y / MR[2]) ** 2))
        return mp + mr * x + mu * y + mn * (depth + 0.002)

    ny = MR[2] * 0.32
    B.add(ellipsoid(on_muzzle(0, ny) - mn * 0.004 * hs, tuple(v * hs for v in nose_r), rot=decal(mn), seg=16, rings=10),
          col('nose', 'eye'), 'head')
    w = MR[0] * 0.42
    top_y = -0.13 * MR[2]
    line_tube([on_muzzle(x, top_y - 0.2 * MR[2] * math.sin(math.pi * abs(x) / w)) for x in (w * (i / 8 - 1) for i in range(17))])
    if mz in ('dog', 'bear'):   # 코에서 입까지 내려오는 선
        line_tube([on_muzzle(0, ny - nose_r[2] * hs * (1 - t) + (top_y - ny) * t) for t in (0, 0.5, 1)])
elif mz == 'beak':
    bs = F.get('beakScale', 1.0)   # 펭귄은 작게
    bp, bn = head_point(0, -0.2, inset=0.03 * hs - MASK_LIFT)
    B.add(ellipsoid(bp + bn * 0.045 * hs * bs, (0.13 * hs * bs, 0.085 * hs * bs, 0.045 * hs * bs), rot=decal(bn), seg=24, rings=12), col('beak'), 'head')
    br, bu = surface_frame(bn)
    line_tube([bp + bn * ((0.045 + 0.085 * math.sqrt(max(0.0, 1 - (x / 0.13) ** 2))) * hs * bs + 0.001) + br * x * hs * bs
               for x in (0.11 * (i / 8 - 1) for i in range(17))], r=0.004)
elif mz == 'hook':   # 부엉이: 두 눈 사이에서 아래로 굽은 작은 부리
    bp, bn = head_point(0, -0.1, inset=0.01 * hs)
    tip = bp + bn * 0.05 * hs + V((0, 0, -0.045 * hs))
    B.add(cone(bp - bn * 0.01 * hs, tip, 0.03 * hs, 0.004, squash=0.8), col('beak'), 'head')
mouth = F.get('mouth')
if mouth in ('smile', 'wide'):   # 주둥이 없는 얼굴: 머리 표면에 웃는 입
    wy, mpitch, dip = (0.13, -0.36, 0.06) if mouth == 'smile' else (0.5, -0.1, 0.07)
    pts = []
    for i in range(15):
        u = i / 7 - 1
        p, n = head_point(u * wy, mpitch - dip * (1 - u * u))
        pts.append(p + n * 0.003)
    line_tube(pts, r=0.006)

# 눈 · 하이라이트 · 볼터치
es, sp = P['eyeSize'], P['eyeSpacing']


def eye(p, n):
    B.add(ellipsoid(p, (0.032 * es * hs, 0.02 * hs, 0.046 * es * hs), rot=decal(n), seg=20, rings=12), 'eye', 'head', outline=False)
    r, u = surface_frame(n)
    B.add(ellipsoid(p + n * 0.016 * hs + u * 0.018 * es * hs + r * 0.009 * es * hs, (0.011 * es * hs,) * 3, seg=12, rings=8),
          'eyeHighlight', 'head', outline=False)


EYES = {}
for side, sx in (('L', 1), ('R', -1)):
    if F.get('eyes') == 'bumps':   # 개구리: 머리 위 눈두덩
        bump_p, _ = head_point(sx * 0.42 * sp, 0.5, inset=0.03 * hs)
        BR = (0.085 * hs,) * 3
        B.add(ellipsoid(bump_p, BR, seg=20, rings=12), 'fur', 'head')
        p, n = ell_point(bump_p, BR, 0, 0.12, inset=0.006)
    else:
        p, n = head_point(sx * 0.34 * sp * F.get('eyeSpread', 1.0), F.get('eyePitch', 0.03), inset=0.008 - MASK_LIFT)
    if F.get('eyes') == 'big':   # 부엉이 큰 눈: 얼굴 깃 원판(muzzle) + 금빛 홍채(iris) + 까만 눈동자
        B.add(ellipsoid(p - n * 0.004, (0.088 * es * hs, 0.014 * hs, 0.084 * es * hs), rot=decal(n), seg=24, rings=12), col('muzzle'), 'head')
        B.add(ellipsoid(p + n * 0.008 * hs, (0.054 * es * hs, 0.01 * hs, 0.054 * es * hs), rot=decal(n), seg=20, rings=12), col('iris', 'eye'), 'head', outline=False)
        q = p + n * 0.014 * hs
        B.add(ellipsoid(q, (0.03 * es * hs, 0.008 * hs, 0.034 * es * hs), rot=decal(n), seg=18, rings=10), 'eye', 'head', outline=False)
        r, u = surface_frame(n)
        B.add(ellipsoid(q + n * 0.008 * hs + u * 0.014 * es * hs + r * 0.008 * es * hs, (0.011 * es * hs,) * 3, seg=12, rings=8),
              'eyeHighlight', 'head', outline=False)
    else:
        eye(p, n)
    EYES[side] = (p, n)
    p, n = head_point(sx * 0.6 * F.get('blushSpread', 1.0), -0.2, inset=0.004 - MASK_LIFT)
    B.add(ellipsoid(p, (0.042 * hs, 0.008, 0.027 * hs), rot=decal(n), seg=16, rings=8), 'blush', 'head', outline=False)

# 이마 줄무늬
if spec.get('markings') == 'tabby':
    for yaw in (-0.16, 0.0, 0.16):
        p, n = head_point(yaw, 0.62, inset=0.004)
        B.add(ellipsoid(p, (0.014 * hs, 0.008, 0.045 * hs), rot=decal(n), seg=12, rings=8), 'marking', 'head', outline=False)

# 머리카락 (사람)
if F.get('hair'):
    HR = tuple(r * 1.07 for r in HEAD_R)
    hb = ellipsoid(HEAD_C + V((0, 0.006, 0.01)), HR, seg=40, rings=26)

    def keep(c):
        rel = c - HEAD_C
        front = max(-1.0, min(1.0, -rel.y / HR[1]))
        return rel.z > (-0.55 + (front + 1) / 2 * 0.93) * HR[2]

    bmesh.ops.delete(hb, geom=[f for f in hb.faces if not keep(f.calc_center_median())], context='FACES')
    B.add(hb, 'hair', 'head')
    for yaw in (-0.36, 0.0, 0.36):
        p, n = head_point(yaw, 0.44, inset=-0.012 * hs)
        B.add(ellipsoid(p, (0.075 * hs, 0.03 * hs, 0.05 * hs), rot=decal(n), seg=16, rings=10), 'hair', 'head')

# 귀
E = P['earSize']
ear_kind = F.get('ears')
for side, sx in (('L', 1), ('R', -1)):
    ear = 'ear.' + side
    if ear_kind in ('cat', 'tuft', 'fox'):
        p, n = head_point(sx * 0.62, 0.78)
        d = (n + V((0, 0, 0.5))).normalized()
        L = 0.17 * E * hs
        base = p - d * 0.035 * hs
        tip = base + d * L
        B.add(cone(base, tip, 0.085 * E * hs, 0.014 / P['earPointiness'], squash=0.55), 'fur', ear)
        ib = base + V((0, -0.028 * hs, 0)) + d * 0.02 * hs
        B.add(cone(ib, ib + d * L * 0.66, 0.05 * E * hs, 0.008, squash=0.35), col('innerEar', 'muzzle'), ear, outline=False)
        if ear_kind == 'tuft':   # 다람쥐 귀 끝 털
            B.add(cone(tip - d * 0.02 * hs, tip + d * 0.05 * hs + V((sx * 0.01, 0, 0)), 0.02 * hs, 0.004, squash=0.6), col('marking'), ear)
            tip = tip + d * 0.05 * hs
        if ear_kind == 'fox':    # 여우 귀 끝: 위쪽 1/3 을 진한 색 껍질로 덮는다
            tb = base + d * L * 0.6
            B.add(cone(tb, tip + d * 0.006 * hs, 0.085 * E * hs * 0.55, 0.016 / P['earPointiness'], squash=0.6), col('earTip', 'marking'), ear)
        EARS[side] = (base, tip)
    elif ear_kind == 'long':     # 토끼
        p, n = head_point(sx * 0.3, 0.98)
        d = V((sx * 0.2, 0.04, 1)).normalized()
        L = 0.3 * E * hs
        base = p - d * 0.03 * hs
        R = align_z(d)
        B.add(ellipsoid(base + d * L / 2, (0.055 * hs, 0.032 * hs, L / 2), rot=R, seg=20, rings=14), 'fur', ear)
        B.add(ellipsoid(base + d * L * 0.53 + V((0, -0.02 * hs, 0)), (0.03 * hs, 0.016 * hs, L * 0.38), rot=R, seg=16, rings=12),
              col('innerEar', 'muzzle'), ear, outline=False)
        EARS[side] = (base, base + d * L)
    elif ear_kind == 'round' and F.get('earSide'):   # 양: 곰 둥근 귀를 머리 옆에 눕혀 단다 (털 뭉치 아래로 나온다)
        p, n = head_point(sx * 1.2, 0.12)
        out = V((sx, 0, 0))
        c = p + out * 0.045 * hs + V((0, 0, -0.012 * hs))
        R = Matrix.Rotation(-sx * 0.38, 3, 'Y') @ Matrix.Rotation(sx * 0.25, 3, 'Z')
        B.add(ellipsoid(c, (0.078 * E * hs, 0.036 * hs, 0.042 * E * hs), rot=R, seg=20, rings=12), col('ear'), ear)
        B.add(ellipsoid(c + V((sx * 0.004, -0.022 * hs, 0)), (0.05 * E * hs, 0.018 * hs, 0.024 * E * hs), rot=R, seg=16, rings=10),
              col('innerEar', 'muzzle'), ear, outline=False)
        EARS[side] = (p, c + out * 0.07 * hs)
    elif ear_kind == 'round':    # 곰
        p, n = head_point(sx * 0.58, 0.75)
        d = (n + V((0, 0, 0.6))).normalized()
        c = p + d * 0.02 * hs
        R = rot_y(sx * 0.3)
        B.add(ellipsoid(c, (0.07 * E * hs, 0.04 * hs, 0.065 * E * hs), rot=R, seg=20, rings=12), 'fur', ear)
        B.add(ellipsoid(c + V((0, -0.026 * hs, -0.004)), (0.04 * E * hs, 0.02 * hs, 0.037 * E * hs), rot=R, seg=16, rings=10),
              col('innerEar', 'muzzle'), ear, outline=False)
        EARS[side] = (c - d * 0.04 * hs, c + d * 0.06 * hs)
    elif ear_kind == 'floppy':   # 강아지: 옆으로 늘어진 귀
        p, n = head_point(sx * 0.86, 0.42)
        c = p + V((sx * 0.03, 0, -0.085)) * hs * E
        B.add(ellipsoid(c, (0.03 * hs, 0.062 * E * hs, 0.11 * E * hs), rot=rot_y(-sx * 0.28), seg=20, rings=14), col('ear'), ear)
        EARS[side] = (p, c - V((0, 0, 0.1)) * hs * E)
    elif ear_kind == 'tufts':    # 부엉이 귀깃: 머리 위 양옆에 바깥으로 뻗은 깃 두 겹
        p, n = head_point(sx * 0.66, 0.74)
        d = V((sx * 0.85, 0.08, 1)).normalized()
        L = 0.11 * E * hs
        base = p - d * 0.035 * hs
        tip = base + d * L
        B.add(cone(base, tip, 0.06 * E * hs, 0.018 * hs, squash=0.42), 'fur', ear)
        B.add(ellipsoid(tip, (0.018 * hs, 0.008 * hs, 0.018 * hs), rot=align_z(d), seg=12, rings=8), 'fur', ear)   # 끝을 둥글게
        d2 = V((sx * 1.3, 0.08, 0.6)).normalized()
        B.add(cone(base - V((0, 0, 0.018 * hs)), base + d2 * L * 0.8, 0.045 * E * hs, 0.012 * hs, squash=0.4), col('earTip', 'fur'), ear)
        EARS[side] = (base, tip)
    elif ear_kind == 'human':
        p, n = head_point(sx * 1.5, -0.02)
        B.add(ellipsoid(p, (0.022 * hs, 0.032 * hs, 0.045 * hs), seg=14, rings=10), 'fur', 'head')

# 부리 위 깃털 (오리)
if F.get('crest'):
    p, n = head_point(0, 1.3)
    for k, (dx, dz) in enumerate(((0.0, 0.07), (0.03, 0.05))):
        B.add(cone(p - n * 0.01, p + V((dx, 0.02, dz)) * hs, 0.022 * hs, 0.004, squash=0.6), 'fur', 'head')

# 털 뭉치 (양, 10차): 머리 위를 구름처럼 덮는 몽실한 털 + 목둘레 털 깃
if F.get('wool'):
    wool = col('wool', 'fur')
    for yaw, pitch, r in ((0, 1.25, 0.1), (0, 0.66, 0.085), (0.42, 0.74, 0.088), (-0.42, 0.74, 0.088),
                          (0.9, 0.62, 0.085), (-0.9, 0.62, 0.085), (1.45, 0.66, 0.085), (-1.45, 0.66, 0.085),
                          (2.1, 0.55, 0.09), (-2.1, 0.55, 0.09), (math.pi, 0.6, 0.095), (2.6, 0.15, 0.08), (-2.6, 0.15, 0.08),
                          (math.pi, 0.1, 0.085), (0.7, 1.05, 0.085), (-0.7, 1.05, 0.085), (2.4, 1.0, 0.09), (-2.4, 1.0, 0.09)):
        p, n = head_point(yaw, pitch, inset=r * 0.5 * hs)
        B.add(ellipsoid(p, (r * hs, r * hs, r * 0.9 * hs), seg=16, rings=10), wool, 'head')
    z = bodyTop - 0.035
    for k in range(10):
        a = math.tau * k / 10
        rr = 0.95 * math.sqrt(max(0.0, 1 - ((z - BODY_C.z) / BODY_R[2]) ** 2))
        p = V((BODY_R[0] * rr * math.sin(a), -BODY_R[1] * rr * math.cos(a), z))
        B.add(ellipsoid(p, (0.042, 0.042, 0.036), seg=14, rings=8), wool, 'spine')

# 등껍질 (거북)
if F.get('shell'):
    SC = V((0, BODY_R[1] * 0.62, BODY_C.z + 0.015))
    SR = (BODY_R[0] * 1.18, 0.13, BODY_R[2] * 1.3)
    B.add(ellipsoid(SC, SR, seg=32, rings=18), 'shell', body_w)
    for yaw, pitch in ((0, 0), (0, 0.55), (0, -0.5), (0.75, 0.25), (-0.75, 0.25), (0.75, -0.3), (-0.75, -0.3)):
        p, n = ell_point(SC, SR, math.pi + yaw, pitch, inset=0.006)
        B.add(ellipsoid(p, (0.045, 0.01, 0.045), rot=decal(n), seg=14, rings=8), col('marking', 'shell'), body_w, outline=False)

# 꼬리
tl = P['tailLength']
tail_kind = F.get('tail')
t0 = V((0, BODY_R[1] * 0.8, BODY_C.z - 0.06))
TAIL = []
if tail_kind in ('cat', 'curl', 'bushy', 'fox'):
    if tail_kind == 'cat':
        TAIL = bezier(t0, t0 + V((0.0, 0.16, -0.02)) * tl, t0 + V((0.09, 0.2, 0.16)) * tl, t0 + V((0.06, 0.13, 0.27)) * tl, 14)
        radii = [0.032 - 0.006 * i / 14 for i in range(15)]
    elif tail_kind == 'curl':
        TAIL = bezier(t0, t0 + V((0, 0.1, 0.02)) * tl, t0 + V((0, 0.16, 0.12)) * tl, t0 + V((0, 0.1, 0.17)) * tl, 10)
        radii = [0.03 - 0.008 * i / 10 for i in range(11)]
    else:   # bushy · fox
        tb = V((0, BODY_R[1] * 0.85, BODY_C.z - 0.08))
        TAIL = bezier(tb, tb + V((0, 0.2, 0.0)) * tl, tb + V((0, 0.26, 0.34)) * tl, tb + V((0, 0.12, 0.44)) * tl, 16)
        radii = [0.04 + 0.07 * math.sin(math.pi * min(1.0, 0.25 + i / 16 * 0.75)) for i in range(17)]
    nt = len(TAIL) - 1

    def tail_w(co):
        i = min(range(len(TAIL)), key=lambda k: (TAIL[k] - co).length)
        t = min(1.0, max(0.0, (i / nt - 0.35) / 0.3))
        return {'tail.1': 1 - t, 'tail.2': t}

    tmat = col('tail')
    if tail_kind == 'fox':       # 여우 꼬리: 끝 1/4 은 흰색
        k = 12
        B.add(tube(TAIL[:k + 1], radii[:k + 1], seg=14), tmat, tail_w)
        tip_mat = col('tailTip', 'muzzle')
        B.add(tube(TAIL[k:], [r * 1.01 for r in radii[k:]], seg=14), tip_mat, tail_w)
        B.add(ellipsoid(TAIL[-1], (radii[-1],) * 3, seg=14, rings=8), tip_mat, 'tail.2')
    else:
        B.add(tube(TAIL, radii, seg=14), tmat, tail_w)
        B.add(ellipsoid(TAIL[-1], (radii[-1],) * 3, seg=14, rings=8), col('marking') if tail_kind == 'cat' else tmat, 'tail.2')
elif tail_kind == 'puff':
    c = t0 + V((0, 0.03, -0.01))
    B.add(ellipsoid(c, tuple(v * tl for v in (0.05, 0.045, 0.05)), seg=16, rings=10), col('tail'), 'tail.1')
    TAIL = [t0, c + V((0, 0.04, 0))]
elif tail_kind == 'feather':
    B.add(cone(t0, t0 + V((0, 0.1, 0.08)) * tl, 0.05, 0.01, squash=0.45), col('tail'), 'tail.1')
    TAIL = [t0, t0 + V((0, 0.1, 0.08)) * tl]
elif tail_kind == 'stub':
    B.add(cone(t0, t0 + V((0, 0.06, -0.01)) * tl, 0.03, 0.008), 'fur', 'tail.1')
    TAIL = [t0, t0 + V((0, 0.06, -0.01)) * tl]

# 소품: 안경 · 나비넥타이
if 'glasses' in ACC:
    for side in ('L', 'R'):
        p, n = EYES[side]
        B.add(tube(ring_points(p + n * 0.012 * hs, n, 0.05 * hs), [0.0055 * hs] * 24, seg=8, closed=True), 'glasses', 'head', outline=False)
    a = EYES['L'][0] + EYES['L'][1] * 0.012 * hs
    b = EYES['R'][0] + EYES['R'][1] * 0.012 * hs
    mid = (a + b) / 2 + V((0, -0.012 * hs, 0.004))
    line = [b + (a - b).normalized() * 0.05 * hs, mid, a - (a - b).normalized() * 0.05 * hs]
    B.add(tube(line, [0.005 * hs] * 3, seg=8), 'glasses', 'head', outline=False)
if 'bowtie' in ACC:
    z = bodyTop - 0.06
    y = -BODY_R[1] * math.sqrt(max(0.0, 1 - ((z - BODY_C.z) / BODY_R[2]) ** 2)) - 0.012
    K = V((0, y, z))
    for sx in (1, -1):
        B.add(cone(K + V((sx * 0.055, 0, 0)), K, 0.032, 0.008, squash=0.5), 'bowtie', 'spine')
    B.add(ellipsoid(K, (0.016, 0.014, 0.016), seg=12, rings=8), 'bowtie', 'spine')

# 마무리: 법선 정리, 키 적용
bmesh.ops.recalc_face_normals(B.bm, faces=B.bm.faces[:])
bmesh.ops.scale(B.bm, vec=V((H, H, H)), verts=B.bm.verts[:])
me = bpy.data.meshes.new(SLUG)
B.bm.to_mesh(me)
B.bm.free()
body = bpy.data.objects.new(SLUG, me)
scene.collection.objects.link(body)
for g in B.groups:
    body.vertex_groups.new(name=g)


def make_mat(name):
    m = bpy.data.materials.new(name)
    color = lin('#FFFFFF') if name == 'eyeHighlight' else lin(PAL[name])
    m.diffuse_color = color
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    bsdf = next((nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        bsdf = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        out = next(nd for nd in m.node_tree.nodes if nd.type == 'OUTPUT_MATERIAL')
        m.node_tree.links.new(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.2 if name in ('eye', 'eyeHighlight') else 0.75
    return m


for name in B.mats:
    me.materials.append(make_mat(name))

# ---------------------------------------------------------------- 리그
arm_data = bpy.data.armatures.new(SLUG + '_rig')
rig = bpy.data.objects.new(SLUG + '_rig', arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head, b.tail = V(head) * H, V(tail) * H
    b.align_roll(V((0, -1, 0)))   # 모든 본: 로컬 Z = 정면 → +X 회전 = 앞으로 숙이기/흔들기
    if parent:
        b.parent = eb[parent]
    return b


bone('root', (0, 0, 0), (0, 0, legLen * 0.6))
bone('hips', (0, 0, legLen), (0, 0, BODY_C.z), 'root')
bone('spine', (0, 0, BODY_C.z), (0, 0, bodyTop), 'hips')
bone('head', (0, 0, bodyTop), (0, 0, HEAD_C.z + HEAD_R[2]), 'spine')
for s in ('L', 'R'):
    if s in EARS:
        bone('ear.' + s, *EARS[s], 'head')
    bone('arm.' + s, *ARMS[s], 'spine')
    bone('leg.' + s, LEGS[s][0], LEGS[s][1], 'hips')
    bone('shin.' + s, LEGS[s][1], LEGS[s][2], 'leg.' + s)
if len(TAIL) > 2:
    bone('tail.1', TAIL[0], TAIL[len(TAIL) // 2], 'hips')
    bone('tail.2', TAIL[len(TAIL) // 2], TAIL[-1], 'tail.1')
elif TAIL:
    bone('tail.1', TAIL[0], TAIL[1], 'hips')
bpy.ops.object.mode_set(mode='OBJECT')


body.parent = rig
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = rig

# ---------------------------------------------------------------- 애니메이션
TAU = math.pi * 2
sin, cos = math.sin, math.cos


def idle(t):
    s = sin(TAU * t)
    twitch = math.exp(-((t - 0.7) / 0.04) ** 2)
    return {
        'hips': ((0, 0, 0), (0, 0.004 * (s + 1), 0)),
        'spine': ((0.03 * s, 0, 0), None),
        'head': ((-0.02 * s, 0, 0.05 * sin(TAU * t + 0.5)), None),
        'arm.L': ((0.04 * s, 0, 0.06 + 0.03 * s), None),
        'arm.R': ((0.04 * s, 0, -0.06 - 0.03 * s), None),
        'ear.L': ((0.3 * twitch, 0, 0), None),
        'tail.1': ((0.05 * s, 0, 0.3 * s), None),
        'tail.2': ((0, 0, 0.4 * sin(TAU * t - 0.8)), None),
    }


def walk(t):
    f = TAU * t
    s = sin(f)
    return {
        'hips': ((0, 0.1 * s, 0), (0, 0.012 * cos(2 * f), 0)),
        'spine': ((0.06, -0.1 * s, 0), None),
        'head': ((-0.05, 0, 0.04 * s), None),
        'leg.L': ((0.55 * s, 0, 0), None), 'leg.R': ((-0.55 * s, 0, 0), None),
        'arm.L': ((-0.5 * s, 0, 0.08), None), 'arm.R': ((0.5 * s, 0, -0.08), None),
        'ear.L': ((0.06 * cos(2 * f), 0, 0), None), 'ear.R': ((0.06 * cos(2 * f), 0, 0), None),
        'tail.1': ((0.1, 0, 0.25 * s), None),
        'tail.2': ((0, 0, 0.35 * sin(f - 0.8)), None),
    }


def run(t):
    f = TAU * t
    s = sin(f)
    return {
        'hips': ((0, 0.15 * s, 0), (0, 0.01 + 0.025 * cos(2 * f), 0)),
        'spine': ((0.22, -0.15 * s, 0), None),
        'head': ((-0.16, 0, 0.05 * s), None),
        'leg.L': ((0.95 * s, 0, 0), None), 'leg.R': ((-0.95 * s, 0, 0), None),
        'arm.L': ((-0.9 * s, 0, 0.25), None), 'arm.R': ((0.9 * s, 0, -0.25), None),
        'ear.L': ((-0.35, 0, 0), None), 'ear.R': ((-0.35, 0, 0), None),
        'tail.1': ((0.4, 0, 0.2 * s), None),
        'tail.2': ((0.3, 0, 0.3 * sin(f - 0.8)), None),
    }


def happy(t):
    hop = max(0.0, sin(2 * TAU * t))
    wave = sin(4 * TAU * t)
    return {
        'hips': ((0, 0, 0), (0, 0.07 * hop, 0)),
        'spine': ((-0.08, 0, 0), None),
        'head': ((-0.12, 0, 0.12 * sin(2 * TAU * t)), None),
        'leg.L': ((-0.3 * hop, 0, 0), None), 'leg.R': ((-0.3 * hop, 0, 0), None),
        'arm.L': ((-0.2, 0, 1.75 + 0.3 * wave), None), 'arm.R': ((-0.2, 0, -1.75 - 0.3 * wave), None),
        'ear.L': ((0.15 * wave, 0, 0), None), 'ear.R': ((0.15 * wave, 0, 0), None),
        'tail.1': ((0.3, 0, 0.5 * wave), None),
        'tail.2': ((0, 0, 0.6 * sin(4 * TAU * t - 0.8)), None),
    }


# 9차 M9-P1 (보드 wave9 D87-A) 사람 뼈대 동작 — 스펙 animations 에 이름이 있는 캐릭터만 (지금 주인공)
def sparkler(t):
    """AN-08 손 불꽃 흔들기 (반복): 오른팔을 앞으로 들고 손목으로 작은 원을 그린다. 고개는 살짝 들어 불꽃을 본다."""
    f = TAU * t
    s = sin(f)
    return {
        'hips': ((0, 0, 0), (0, 0.006 * (sin(2 * f) + 1), 0)),
        'spine': ((-0.04, 0.12 * s, 0), None),
        'head': ((-0.18, 0.08 * s, 0.06 * cos(f)), None),
        'arm.R': ((1.25 + 0.3 * s, 0.25 * cos(f), -0.2 - 0.3 * cos(f)), None),
        'arm.L': ((0.1, 0, 0.12 + 0.04 * s), None),
        'ear.L': ((0.1 * s, 0, 0), None), 'ear.R': ((0.1 * s, 0, 0), None),
        'tail.1': ((0.1, 0, 0.3 * s), None),
        'tail.2': ((0, 0, 0.35 * sin(f - 0.8)), None),
    }


def push(t):
    """AN-09 눈덩이 밀기 (반복, 걷기 대신): 몸을 앞으로 기울이고 두 팔을 앞으로 뻗어 밀며 무겁게 걷는다."""
    f = TAU * t
    s = sin(f)
    return {
        'hips': ((0, 0.06 * s, 0), (0, -0.01 + 0.01 * cos(2 * f), 0)),
        'spine': ((0.38, -0.05 * s, 0), None),
        'head': ((-0.3, 0, 0.03 * s), None),
        'leg.L': ((0.45 * s - 0.15, 0, 0), None), 'leg.R': ((-0.45 * s - 0.15, 0, 0), None),
        'arm.L': ((1.3 + 0.06 * s, 0, 0.18), None), 'arm.R': ((1.3 - 0.06 * s, 0, -0.18), None),
        'ear.L': ((-0.15, 0, 0), None), 'ear.R': ((-0.15, 0, 0), None),
        'tail.1': ((0.2, 0, 0.2 * s), None),
        'tail.2': ((0, 0, 0.3 * sin(f - 0.8)), None),
    }


def place(t):
    """AN-10 놓기 (한 번): 두 손으로 앞에 들고 있던 것을 허리를 굽혀 내려놓고 다시 선다 (섬 꾸미기·집 가구·눈덩이)."""
    k = sin(math.pi * min(1.0, t / 0.8)) if t < 0.8 else 0.0   # 0 → 1(굽힘) → 0
    lift = sin(math.pi * min(1.0, t / 0.35)) if t < 0.35 else 0.0
    return {
        'hips': ((0, 0, 0), (0, -0.05 * k, 0)),
        'spine': ((0.6 * k, 0, 0), None),
        'head': ((-0.25 * k + 0.1 * lift, 0, 0), None),
        'leg.L': ((-0.35 * k, 0, 0), None), 'leg.R': ((-0.35 * k, 0, 0), None),
        'arm.L': ((1.15 * max(k, lift) - 0.15 * k, 0, 0.15), None),
        'arm.R': ((1.15 * max(k, lift) - 0.15 * k, 0, -0.15), None),
        'tail.1': ((0.2 * k, 0, 0), None),
    }


# 10차 M10-P1 (보드 wave10 D95-A) AN-11 앉기 · 일어서기 — 주인공·주민 모두. 뿌리(root)는 발바닥 높이에 그대로 두고 엉덩이(hips)만 내린다.
# 게임은 모델 메타 sit.hip(앉은 엉덩이 아래 높이)·sit.forward(그 점이 뿌리보다 앞으로 얼마)로 뿌리를 자리 위에 놓는다 (아래 SIT 계산).
SIT_DROP = 0.07   # 엉덩이를 내리는 만큼 (키 1.0 기준) — 앉은 발바닥이 뿌리 높이 둘레에 오게


def seated(t=0.0):
    """앉은 자세: 허벅지는 앞으로, 정강이는 아래로 늘어뜨리고 손은 무릎 위. t 로 숨쉬기·고개·발 까딱 (t=0 이면 숨 0)."""
    f = TAU * t
    s = sin(f)
    return {
        'hips': ((0, 0, 0), (0, -SIT_DROP + 0.004 * s, 0)),
        'spine': ((0.04 + 0.025 * s, 0, 0), None),
        'head': ((-0.06 - 0.02 * s, 0, 0.07 * sin(f)), None),
        'leg.L': ((1.42, 0, 0.1), None), 'leg.R': ((1.42, 0, -0.1), None),
        'shin.L': ((-1.32 + 0.12 * sin(2 * f), 0, 0), None), 'shin.R': ((-1.32 - 0.12 * sin(2 * f), 0, 0), None),
        'arm.L': ((0.62 + 0.03 * s, 0, 0.04), None), 'arm.R': ((0.62 + 0.03 * s, 0, -0.04), None),
        'ear.L': ((0.06 * s, 0, 0), None), 'ear.R': ((0.06 * s, 0, 0), None),
        'tail.1': ((0.45, 0, 0.15 * s), None),   # 꼬리는 들어 올려 자리 뒤로 늘어지지 않게
        'tail.2': ((0, 0, 0.2 * sin(f - 0.8)), None),
    }


def mix_pose(a, b, k):
    """두 자세를 k(0~1)로 섞는다 (빠진 뼈는 0)."""
    out = {}
    for name in set(a) | set(b):
        ra, la = a.get(name, ((0, 0, 0), None))
        rb, lb = b.get(name, ((0, 0, 0), None))
        la, lb = la or (0, 0, 0), lb or (0, 0, 0)
        out[name] = (tuple(x + (y - x) * k for x, y in zip(ra, rb)), tuple(x + (y - x) * k for x, y in zip(la, lb)))
    return out


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def add_pose(p, name, rot=(0, 0, 0), loc=(0, 0, 0)):
    r, l = p.get(name, ((0, 0, 0), (0, 0, 0)))
    p[name] = (tuple(x + y for x, y in zip(r, rot)), tuple(x + y for x, y in zip(l or (0, 0, 0), loc)))


def sit_down(t):
    """AN-11 앉기 (한 번, 0.6초): 선 자세 → 상체를 살짝 숙이며 엉덩이를 내리고 다리를 앞으로 → 앉은 자세로 끝난다."""
    p = mix_pose({}, seated(0), smooth(t / 0.9))
    lean = sin(math.pi * min(1.0, t / 0.85))
    add_pose(p, 'spine', (0.32 * lean, 0, 0))
    add_pose(p, 'head', (-0.18 * lean, 0, 0))
    add_pose(p, 'arm.L', (0.35 * lean, 0, 0.1 * lean))
    add_pose(p, 'arm.R', (0.35 * lean, 0, -0.1 * lean))
    return p


def sit(t):
    """AN-11 앉아 있기 (반복): 숨쉬기 · 고개 살랑 · 늘어뜨린 발 까딱."""
    return seated(t)


def stand_up(t):
    """AN-11 일어서기 (한 번, 0.5초): 상체를 앞으로 숙여 힘을 주고 → 다리를 내려 선 자세로."""
    p = mix_pose(seated(0), {}, smooth((t - 0.1) / 0.85))
    lean = sin(math.pi * min(1.0, t / 0.8))
    add_pose(p, 'spine', (0.4 * lean, 0, 0))
    add_pose(p, 'head', (-0.22 * lean, 0, 0))
    add_pose(p, 'arm.L', (-0.25 * lean, 0, 0.12 * lean))
    add_pose(p, 'arm.R', (-0.25 * lean, 0, -0.12 * lean))
    add_pose(p, 'hips', loc=(0, 0.012 * sin(math.pi * min(1.0, max(0.0, (t - 0.45) / 0.45))), 0))
    return p


ANIMS = {'idle': (48, idle), 'walk': (24, walk), 'run': (16, run), 'happy': (36, happy),
         'sparkler': (36, sparkler), 'push': (28, push), 'place': (30, place),
         'sit_down': (14, sit_down), 'sit': (48, sit), 'stand_up': (12, stand_up)}
ANIMS = {k: v for k, v in ANIMS.items() if k in spec.get('animations', ANIMS)}


def assign_action(act):
    rig.animation_data.action = act
    try:
        if act.slots and rig.animation_data.action_slot is None:
            rig.animation_data.action_slot = act.slots[0]
    except AttributeError:
        pass


rig.animation_data_create()
for pb in rig.pose.bones:
    pb.rotation_mode = 'XYZ'
for name, (frames, fn) in ANIMS.items():
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    assign_action(act)
    for f in range(frames + 1):
        pose = fn(f / frames)
        for pb in rig.pose.bones:
            rot, loc = pose.get(pb.name, ((0, 0, 0), None))
            pb.rotation_euler = rot
            pb.location = tuple(v * H for v in (loc or (0, 0, 0)))
            pb.keyframe_insert('rotation_euler', frame=f)
            pb.keyframe_insert('location', frame=f)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    track.mute = True
    rig.animation_data.action = None

# ---------------------------------------------------------------- 앉는 자리 (AN-11)
# 앉은 자세(sit 0번 장)에서 몸통·허벅지 아래 가장 낮은 점 = 자리에 닿는 곳. 키 적용 뒤 모델 단위.
# hip = 뿌리(발바닥 높이)에서 그 점까지 높이, forward = 그 점이 뿌리보다 정면(-Y, 게임에서는 +Z 바라보는 쪽)으로 얼마나 앞인지.
SIT = None
if 'sit' in ANIMS:
    assign_action(bpy.data.actions['sit'])
    scene.frame_set(0)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    em = ev.to_mesh()
    gi = {g.index: g.name for g in body.vertex_groups}
    seat_groups = {'hips', 'spine', 'leg.L', 'leg.R'}
    skip_mats = {i for i, m in enumerate(me.materials) if m.name in ('shell', 'marking', 'tail')}   # 등껍질·꼬리는 자리 뒤로 늘어진다
    seat_verts = {vi for poly in me.polygons if poly.material_index not in skip_mats for vi in poly.vertices}
    pts = []
    for v in me.vertices:
        ws = [(g.weight, gi[g.group]) for g in v.groups if gi[g.group] != 'outline']
        if v.index in seat_verts and ws and max(ws)[1] in seat_groups:
            pts.append(em.vertices[v.index].co.copy())
    low = min(p.z for p in pts)
    band = [p for p in pts if p.z < low + 0.012 * H]
    SIT = {'hip': round(low, 4), 'forward': round(-sum(p.y for p in band) / len(band), 4)}
    ev.to_mesh_clear()
    rig['sit'] = SIT   # glTF extras → three.js 의 <slug>_rig 노드 userData.sit
    rig.animation_data.action = None
    scene.frame_set(0)

# ---------------------------------------------------------------- glb 내보내기
glb_path = os.path.join(ASSETS, 'models', SLUG + '.glb')
for o in scene.objects:
    o.select_set(o in (rig, body))
bpy.context.view_layer.objects.active = rig
export_kw = dict(filepath=glb_path, export_format='GLB', use_selection=True, export_apply=False,
                 export_animations=True, export_skins=True, export_animation_mode='ACTIONS', export_yup=True, export_extras=True)
try:
    bpy.ops.export_scene.gltf(**export_kw)
except TypeError as e:
    print('[build] 일부 내보내기 옵션을 지원하지 않아 기본값으로 다시 시도:', e)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=True)

me.calc_loop_triangles()
stats = {
    'id': spec['id'], 'slug': SLUG, 'name': spec.get('name'), 'species': SPECIES, 'version': spec.get('version'),
    'triangles': len(me.loop_triangles), 'vertices': len(me.vertices),
    'bones': len(arm_data.bones), 'materials': [m.name for m in me.materials],
    'animations': {k: {'frames': v[0], 'seconds': round(v[0] / 24, 2)} for k, v in ANIMS.items()},
    'height': H, 'glbBytes': os.path.getsize(glb_path), 'blender': bpy.app.version_string,
}
if SIT:
    stats['sit'] = SIT

# ---------------------------------------------------------------- 렌더 (툰 셰이딩 + 외곽선)
TOON_SHADOW = (0.76, 0.72, 0.82, 1.0)


def toon_material(m, rgba, flat=False):
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    if flat:
        em.inputs['Color'].default_value = rgba
        return
    dif = nt.nodes.new('ShaderNodeBsdfDiffuse')
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    e0, e1 = ramp.color_ramp.elements[0], ramp.color_ramp.elements[1]
    e0.position, e0.color = 0.0, TOON_SHADOW
    e1.position, e1.color = 0.6, (1, 1, 1, 1)
    mul = nt.nodes.new('ShaderNodeVectorMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = rgba[:3]
    nt.links.new(dif.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mul.inputs[0])
    nt.links.new(mul.outputs[0], em.inputs['Color'])


def mat_for(name, hexstr, flat=False):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    toon_material(m, lin(hexstr), flat)
    return m


if DO_RENDER:
    for m in me.materials:
        toon_material(m, lin('#FFFFFF') if m.name == 'eyeHighlight' else lin(PAL[m.name]),
                      flat=m.name in ('eye', 'eyeHighlight', 'blush', *STYLE.get('flat', [])))

    if STYLE.get('outline', True):
        # 뒤집은 껍데기(inverted hull) 외곽선: 법선을 뒤집은 복제 메시를 바깥으로 살짝 부풀린다
        hull_me = me.copy()
        bm = bmesh.new()
        bm.from_mesh(hull_me)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(hull_me)
        bm.free()
        hull = body.copy()
        hull.data = hull_me
        hull.name = SLUG + '_outline'
        scene.collection.objects.link(hull)
        omat = mat_for('outline', PAL.get('outline', '#4A3B32'), flat=True)
        omat.use_backface_culling = True
        hull_me.materials.clear()
        hull_me.materials.append(omat)
        for poly in hull_me.polygons:
            poly.material_index = 0
        disp = hull.modifiers.new('Hull', 'DISPLACE')
        disp.direction = 'NORMAL'
        disp.mid_level = 0.0
        disp.strength = -STYLE.get('outlineWidth', 0.006) * H
        disp.vertex_group = 'outline'
        try:
            hull.visible_shadow = False
        except AttributeError:
            pass

    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    try:
        scene.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    world = bpy.data.worlds.new('sky')
    scene.world = world
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    wn = world.node_tree.nodes
    wn.clear()
    amb = wn.new('ShaderNodeBackground')      # 조명용 주변광
    amb.inputs['Color'].default_value = lin('#CDEBF5')
    amb.inputs['Strength'].default_value = 0.55
    sky = wn.new('ShaderNodeBackground')      # 카메라에 보이는 하늘
    sky.inputs['Color'].default_value = lin('#BFE6F7')
    lp, mix, wout = wn.new('ShaderNodeLightPath'), wn.new('ShaderNodeMixShader'), wn.new('ShaderNodeOutputWorld')
    wl = world.node_tree.links
    wl.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
    wl.new(amb.outputs[0], mix.inputs[1])
    wl.new(sky.outputs[0], mix.inputs[2])
    wl.new(mix.outputs[0], wout.inputs['Surface'])

    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.energy = 3.2
    sun_data.angle = math.radians(4)
    sun = bpy.data.objects.new('sun', sun_data)
    sun.rotation_euler = (math.radians(58), 0, math.radians(-30))
    scene.collection.objects.link(sun)

    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def set_pose(action, frame):
        assign_action(bpy.data.actions[action])
        scene.frame_set(frame)

    def shot(fname, w, h):
        scene.render.resolution_x, scene.render.resolution_y = w, h
        scene.render.filepath = os.path.join(ASSETS, 'renders', f'{SLUG}_{fname}.png')
        bpy.ops.render.render(write_still=True)
        if fname == 'front':   # 편집기 모델 버튼용 작은 썸네일
            img = bpy.data.images.load(scene.render.filepath)
            img.scale(240, round(img.size[1] * 240 / img.size[0]))
            img.filepath_raw = os.path.join(ASSETS, 'renders', f'{SLUG}_thumb.png')
            img.file_format = 'PNG'
            img.save()
            bpy.data.images.remove(img)

    # 턴어라운드: 정사영 카메라 고정, 캐릭터를 돌린다
    scene.render.film_transparent = True
    cam_data.type = 'ORTHO'
    # 모델 크기에 맞춰 화면을 잡는다 (토끼 귀, 다람쥐 꼬리처럼 튀어나온 부분 포함)
    xs, ys, zs = zip(*((v.co.x, v.co.y, v.co.z) for v in me.vertices))
    top = max(zs)
    reach = max(max(abs(min(xs)), max(xs)), max(abs(min(ys)), max(ys))) * 2
    cam_data.ortho_scale = max(top, reach) * 1.16
    cam.location = (0, -6, top / 2)
    cam.rotation_euler = (math.radians(90), 0, 0)
    set_pose('idle', 0)
    for fname, yaw in (('front', 0), ('three_quarter', 35), ('side', 90), ('back', 180)):
        rig.rotation_euler = (0, 0, math.radians(yaw))
        shot(fname, 800, 860)

    # 포즈: 3/4 각도
    rig.rotation_euler = (0, 0, math.radians(30))
    for fname, action, frame in (('walk', 'walk', 6), ('run', 'run', 4), ('happy', 'happy', 4), ('sparkler', 'sparkler', 9), ('push', 'push', 7), ('place', 'place', 12)):
        if action in ANIMS:
            set_pose(action, frame)
            shot(fname, 800, 860)

    # 앉기 (AN-11): 계산한 sit.hip 높이의 나무 걸상을 받쳐 두고 찍는다 → 엉덩이가 걸상 위에 딱 닿는지 그림으로 확인
    if SIT:
        sb = bmesh.new()
        bmesh.ops.create_cube(sb, size=1.0)
        bmesh.ops.transform(sb, matrix=Matrix.Translation(V((0, -SIT['forward'] + 0.02 * H, SIT['hip'] / 2)))
                            @ Matrix.Diagonal((0.34 * H, 0.2 * H, SIT['hip'], 1.0)), verts=sb.verts)
        sm = bpy.data.meshes.new('seat')
        sb.to_mesh(sm)
        sb.free()
        sm.materials.append(mat_for('seat', '#B98A5E'))
        seat = bpy.data.objects.new('seat', sm)
        scene.collection.objects.link(seat)
        seat.parent = rig
        for fname, yaw in (('sit', 30),) + ((('sit_side', 90),) if '--sit-debug' in args else ()):
            rig.rotation_euler = (0, 0, math.radians(yaw))
            set_pose('sit', 0)
            shot(fname, 800, 860)
        if '--sit-debug' in args:
            for fname, action, frame in (('sitdown_mid', 'sit_down', 7), ('standup_mid', 'stand_up', 6)):
                set_pose(action, frame)
                shot(fname, 800, 860)
        bpy.data.objects.remove(seat, do_unlink=True)
        rig.rotation_euler = (0, 0, math.radians(30))

    # 히어로 컷: 가을 잔디 위
    def toon_obj(name, bm, hexstr, smooth=True):
        m = bpy.data.meshes.new(name)
        for f in bm.faces:
            f.smooth = smooth
        bm.to_mesh(m)
        bm.free()
        m.materials.append(mat_for(name, hexstr))
        o = bpy.data.objects.new(name, m)
        scene.collection.objects.link(o)
        return o

    g = bmesh.new()
    bmesh.ops.create_cone(g, cap_ends=True, cap_tris=False, segments=64, radius1=4.0, radius2=4.0, depth=0.1)
    bmesh.ops.translate(g, vec=Vector((0, 0, -0.05)), verts=g.verts)
    toon_obj('ground', g, '#A9C46A', smooth=False)
    tr = capsule(Vector((1.6, 2.3, 0)), Vector((1.6, 2.3, 0.6)), 0.075)
    toon_obj('trunk', tr, '#9A6B45')
    for i, (x, y, z, r) in enumerate(((1.6, 2.3, 0.92, 0.38), (1.37, 2.22, 0.74, 0.26), (1.83, 2.38, 0.76, 0.26))):
        toon_obj(f'leaves{i}', ellipsoid(Vector((x, y, z)), (r, r, r * 0.92), seg=24, rings=14), '#E8913A')
    for i, (x, y) in enumerate(((-0.45, -0.25), (0.35, -0.45), (-0.2, 0.4), (0.55, 0.1))):
        toon_obj(f'leaf{i}', ellipsoid(Vector((x, y, 0.004)), (0.05, 0.03, 0.006), seg=12, rings=6), '#D9583B')
    toon_obj('pebble', ellipsoid(Vector((-0.6, 0.15, 0.02)), (0.08, 0.06, 0.05), seg=14, rings=8), '#B8B2A6')

    scene.render.film_transparent = False
    cam_data.type = 'PERSP'
    cam_data.lens = 50
    cam.location = (-1.25 * H, -2.9 * H, 1.25 * H)
    target = bpy.data.objects.new('target', None)
    target.location = (0.12, 0, 0.42 * H)
    scene.collection.objects.link(target)
    con = cam.constraints.new('TRACK_TO')
    con.target = target
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    rig.rotation_euler = (0, 0, math.radians(-20))
    set_pose('happy' if 'happy' in ANIMS else 'idle', 4)
    shot('hero', 1280, 800)
    set_pose('idle', 0)
    rig.rotation_euler = (0, 0, 0)

blend_path = os.path.join(ASSETS, 'blender', SLUG + '.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
stats['renders'] = sorted(f for f in os.listdir(os.path.join(ASSETS, 'renders')) if f.startswith(SLUG + '_'))
json.dump(stats, open(os.path.join(ASSETS, 'models', SLUG + '.stats.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('[build] 완료:', json.dumps(stats, ensure_ascii=False))
