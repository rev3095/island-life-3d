"""아이템 빌더: assets/items/specs/<slug>.json → .blend / .glb / 렌더(아이콘 썸네일) / 통계

실행:  blender -b --factory-startup --python build_item.py -- <spec.json> <assets_dir> [--no-render]
(보통은 tools/build-item.mjs 로 실행한다)

가방·상점·박물관 아이콘(가구를 뺀 아이템 93개, 5차 Z1 · 검수 보드 D8-B)을 3D 모델 렌더로 만든다.
배경·가구 빌더와 같은 toonkit 도구·재질 규칙(재질 이름 = 팔레트 키)을 쓰고, 스펙의 kind 가 BUILDERS 중 어떤 함수로 만들지 정한다.
물고기·곤충은 종마다 함수를 따로 두지 않고 몸 비율·꼬리·지느러미·날개 모양·무늬 같은 params 와 팔레트로 다르게 만든다.
꽃 4색·씨앗 봉투 3색처럼 색만 다른 아이템은 variants 로 두고, 변형마다 썸네일을 따로 찍는다 (<slug>_<변형>_thumb.png).

좌표계: Blender Z-up, 정면 = -Y. 1.0 = 게임 타일 1칸 (캐릭터 키 ≈ 1.0).
물고기·곤충은 머리가 정면(-Y) — 게임(three)에서는 +Z 가 머리. 크기는 잡아서 머리 위로 들어 보일 때 크기다.
원점: hold(들어 보이는 것 — 물고기·곤충·화석)는 모델 한가운데, 나머지는 바닥 가운데.
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import toonkit
from toonkit import (V, Model, add_outlines, align_z, bezier, box, capsule, cone, cylinder, ellipsoid, jitter,
                     reset_scene, rot_xyz, setup_render, shot, thumbnail, toonify, tube, world_bounds)

args = sys.argv[sys.argv.index('--') + 1:]
SPEC_PATH, ASSETS = os.path.abspath(args[0]), os.path.abspath(args[1])
DO_RENDER = '--no-render' not in args
spec = json.load(open(SPEC_PATH, encoding='utf-8'))
SLUG, KIND = spec['slug'], spec['kind']
P = {k: v['value'] for k, v in spec.get('params', {}).items()}
PAL = spec['palette']
HOLD = bool(spec.get('hold'))
OUT = {k: os.path.join(ASSETS, 'items', k) for k in ('models', 'renders', 'blender')}
for d in OUT.values():
    os.makedirs(d, exist_ok=True)
TAU = math.pi * 2

# src/core/materials.js 의 DEFAULT_NO_OUTLINE 과 같은 목록 + 스펙의 noOutline
NO_OUTLINE = {'eye', 'eyeHighlight', 'blush', 'marking', 'innerEar', 'glasses', 'glow', 'flame', 'flameCore', 'crack', 'paper',
              'waterLight', 'center', 'petalDark', 'rockDark', 'shellRib', 'flower', 'grassDark', 'pebble', 'window'}
NO_OUTLINE |= set(spec.get('style', {}).get('noOutline', []))
_part_add = toonkit.Part.add


def _add(self, tmp, mat, outline=None, smooth=None):
    """외곽선을 따로 정하지 않으면 재질 이름으로 정한다 (게임과 같은 규칙)"""
    if outline is None:
        outline = not (isinstance(mat, str) and mat in NO_OUTLINE)
    return _part_add(self, tmp, mat, outline, smooth)


toonkit.Part.add = _add


def pv(key, default):
    return P.get(key, default)


# ================================================================ 도형 도우미
def rail(points, radii, seg=10, flat=1.0, side=None):
    """점들을 따라가는 관. 방향이 크게 꺾여도 단면이 뒤틀리지 않게 앞 단면을 이어서 돌린다.
    flat < 1 이면 납작한 띠 — side 방향(첫 단면 기준)이 넓은 쪽이 된다."""
    pts = [V(p) for p in points]
    n = len(pts)
    if not hasattr(radii, '__len__'):
        radii = [radii] * n
    tans = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    if side is not None:
        x = (V(side) - tans[0] * V(side).dot(tans[0])).normalized()
    else:
        ref = V((0, 0, 1)) if abs(tans[0].z) < 0.9 else V((1, 0, 0))
        x = tans[0].cross(ref).normalized()
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        if i:
            x = (tans[i - 1].rotation_difference(tans[i]) @ x).normalized()
        y = tans[i].cross(x).normalized()
        rings.append([bm.verts.new(p + (x * math.cos(a) + y * math.sin(a) * flat) * max(radii[i], 1e-4))
                      for a in (TAU * k / seg for k in range(seg))])
    for i in range(n - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(seg):
            bm.faces.new([a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]])
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return bm


def slab(pts, origin=(0, 0, 0), u=(1, 0, 0), v=(0, 0, 1), thick=0.004):
    """평면 다각형(u·v 좌표 점들)에 두께를 준 판: 지느러미·날개·잎."""
    o, u, v = V(origin), V(u).normalized(), V(v).normalized()
    n = u.cross(v).normalized()
    bm = bmesh.new()
    f = [bm.verts.new(o + u * x + v * y + n * thick / 2) for x, y in pts]
    b = [bm.verts.new(o + u * x + v * y - n * thick / 2) for x, y in pts]
    bm.faces.new(f)
    bm.faces.new(list(reversed(b)))
    k = len(pts)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new([f[j], f[i], b[i], b[j]])
    return bm


def oval2d(rx, ry, n=18, cx=0.0, cy=0.0, squeeze=0.0):
    """타원 둘레 점. squeeze > 0 이면 -x 쪽(뿌리)이 좁아진다 (잎·날개)."""
    out = []
    for k in range(n):
        a = TAU * k / n
        x, y = math.cos(a) * rx, math.sin(a) * ry
        if squeeze:
            y *= 1 - squeeze * max(0.0, -x / rx)
        out.append((cx + x, cy + y))
    return out


def spline2d(ctrl, n=6):
    """꼭짓점 목록을 이어 둥근 닫힌 곡선으로 (Chaikin 두 번)."""
    pts = list(ctrl)
    for _ in range(2):
        out = []
        for i in range(len(pts)):
            a, b = V(pts[i] + (0,)), V(pts[(i + 1) % len(pts)] + (0,))
            out += [tuple((a * 0.75 + b * 0.25)[:2]), tuple((a * 0.25 + b * 0.75)[:2])]
        pts = out
    return pts


def dot_on(m, center, normal, r, mat, depth=0.3):
    """겉면에 붙은 납작한 점 (무늬)"""
    m.add(ellipsoid(V(center), (r, r, r * depth), rot=align_z(normal), seg=10, rings=6), mat, outline=False)


def leg(m, pts, r, mat='leg', seg=6):
    m.add(rail(pts, [r * (1 - 0.35 * i / (len(pts) - 1)) for i in range(len(pts))], seg=seg), mat)


def eyes(m, x, y, z, r, highlight=True, out=(1, 0, 0)):
    """양쪽 눈 (x 는 오른쪽 눈 자리). 하이라이트는 앞·위쪽에."""
    for sx in (1, -1):
        c = V((sx * x, y, z))
        m.add(ellipsoid(c, (r, r, r), seg=12, rings=8), 'eye')
        if highlight:
            m.add(ellipsoid(c + V((sx * r * 0.55, -r * 0.35, r * 0.35)), (r * 0.36, r * 0.36, r * 0.36), seg=8, rings=6), 'eyeHighlight')


# ================================================================ 물고기 (fish)
def tail_pts(kind, T, TH):
    a = TH * 0.12
    if kind == 'fork':
        return [(0, a), (T, TH / 2), (T * 0.5, 0), (T, -TH / 2), (0, -a)]
    if kind == 'moon':
        return [(0, a), (T * 0.75, TH * 0.5), (T * 1.05, TH * 0.62), (T * 0.42, 0), (T * 1.05, -TH * 0.62), (T * 0.75, -TH * 0.5), (0, -a)]
    if kind == 'straight':
        return [(0, a), (T, TH / 2), (T * 0.94, 0), (T, -TH / 2), (0, -a)]
    if kind == 'shark':
        return [(0, a), (T * 1.25, TH * 0.78), (T * 0.95, TH * 0.32), (T * 0.5, 0), (T * 0.7, -TH * 0.36), (T * 0.35, -TH * 0.2), (0, -a)]
    if kind == 'fan':
        return spline2d([(0, a), (T * 0.8, TH * 0.62), (T * 1.3, TH * 0.3), (T * 0.85, 0.0), (T * 1.3, -TH * 0.42), (T * 0.8, -TH * 0.72), (0, -a)])
    # round
    pts = [(0, a)]
    for k in range(9):
        f = math.radians(70 - 140 * k / 8)
        pts.append((T * (0.25 + 0.75 * math.cos(f)), TH / 2 * math.sin(f) / math.sin(math.radians(70))))
    return pts + [(0, -a)]


def b_fish(M):
    """보통 물고기: 몸(등·몸·배 색) + 꼬리·등·뒷지느러미 + 가슴지느러미 + 눈 + 수염·무늬. 머리 -Y."""
    L, H, W = pv('length', 0.36), pv('height', 0.36), pv('width', 0.16)
    BL = L * 0.74                      # 꼬리를 뺀 몸 길이
    R = (W * BL / 2, BL / 2, H * BL / 2)
    taper, blunt = pv('taper', 0.55), pv('blunt', 0.0)
    y0 = -L / 2 + BL / 2               # 몸 가운데 (머리 끝 = -L/2)
    m = M.part('fish')

    def k_at(t):                       # t: -1 머리 … +1 꼬리 → 단면 비율
        return 1 - taper * t ** 1.4 if t > 0 else 1.0
    body = ellipsoid((0, 0, 0), R, seg=26, rings=16)
    for v in body.verts:
        t = v.co.y / R[1]
        k = k_at(t)
        v.co.x *= k
        v.co.z *= k
        if t < 0 and blunt:            # 머리 쪽을 뭉툭하게 (메기·가물치)
            v.co.y *= 1 - blunt * 0.35 * (-t) ** 2
        v.co.y += y0
    H2 = R[2]
    m.add(body, lambda c, n: 'back' if c.z > H2 * 0.2 else ('belly' if c.z < -H2 * 0.3 else 'body'))

    def half_h(y):                     # 그 자리 몸 반높이
        t = (y - y0) / R[1]
        return R[2] * math.sqrt(max(0.0, 1 - t * t)) * k_at(t)

    def half_w(y, z=0.0):
        t = (y - y0) / R[1]
        k = k_at(t)
        return R[0] * k * math.sqrt(max(0.0, 1 - t * t - (z / max(R[2] * k, 1e-5)) ** 2))

    fin_t = pv('finThick', 0.006)
    # 꼬리
    TH = H * BL * pv('tailHeight', 1.0)
    tb = y0 + R[1] * 0.86
    m.add(slab(tail_pts(P.get('tail', 'fork'), L - (tb - (-L / 2)) + 0.01, TH), origin=(0, tb, 0), u=(0, 1, 0), v=(0, 0, 1), thick=fin_t), 'fin', smooth=False)
    # 등지느러미
    dorsal = P.get('dorsal', 'tri')
    if dorsal != 'none':
        ds, de = y0 + R[1] * pv('dorsalStart', -0.15), y0 + R[1] * pv('dorsalEnd', 0.35)
        FH = H * BL * pv('dorsalHeight', 0.35)
        n = 8
        base = [(ds + (de - ds) * i / n) for i in range(n + 1)]
        if dorsal == 'spiky':
            top = []
            for i, y in enumerate(base):
                hh = FH * (1.0 - 0.35 * i / n) * (1.0 if i % 2 == 0 else 0.7)
                top.append((y + (de - ds) * 0.04, half_h(y) + hh))
        elif dorsal == 'shark':
            top = [(ds + (de - ds) * 0.35, half_h(ds) + FH * 1.25), (de + (de - ds) * 0.15, half_h(de) + FH * 0.75)]
        elif dorsal == 'long':
            top = [(y, half_h(y) + FH * (0.6 + 0.4 * math.sin(math.pi * i / n))) for i, y in enumerate(base)]
        elif dorsal == 'sickle':
            top = [(ds + (de - ds) * 0.45, half_h(ds) + FH * 1.3), (ds + (de - ds) * 0.7, half_h(ds) + FH * 1.25)]
        else:
            top = [(ds + (de - ds) * 0.35, half_h(ds) + FH), (de, half_h(de) + FH * 0.25)]
        poly = [(ds, half_h(ds) - H2 * 0.15)] + top + [(de, half_h(de) - H2 * 0.15)]
        if dorsal == 'long':
            poly = [(ds, half_h(ds) - H2 * 0.1)] + top + [(de, half_h(de) - H2 * 0.1)]
        m.add(slab(poly, origin=(0, 0, 0), u=(0, 1, 0), v=(0, 0, 1), thick=fin_t), 'fin', smooth=False)
    # 뒷(배)지느러미
    anal = P.get('anal', 'small')
    if anal != 'none':
        as_, ae = y0 + R[1] * (0.0 if anal == 'long' else 0.35), y0 + R[1] * 0.72
        AH = H * BL * (0.16 if anal == 'long' else 0.2)
        poly = [(as_, -half_h(as_) + H2 * 0.15), (as_ + (ae - as_) * 0.3, -half_h(as_) - AH), (ae, -half_h(ae) - AH * 0.6), (ae, -half_h(ae) + H2 * 0.1)]
        m.add(slab(poly, u=(0, 1, 0), v=(0, 0, 1), thick=fin_t), 'fin', smooth=False)
    # 가슴지느러미
    pec = pv('pectoral', 1.0)
    if pec:
        py, pz = y0 - R[1] * 0.35, -R[2] * 0.25
        for sx in (1, -1):
            x = half_w(py, pz)
            PL = BL * 0.12 * pec
            m.add(slab(oval2d(PL, PL * 0.4, 12, cx=PL * 0.8, squeeze=0.5), origin=(sx * x * 0.92, py, pz),
                       u=(sx * 0.3, 1, -0.3), v=(0, -0.3, 1), thick=fin_t * 0.8), 'fin', smooth=False)
    # 수염
    whisk = int(P.get('whiskers', 0))
    if whisk:
        wl = BL * pv('whiskerLength', 0.25)
        mouth = V((0, -L / 2 + BL * 0.03, -R[2] * 0.15))
        for i in range(whisk):
            for sx in (1, -1):
                a = V((sx * R[0] * 0.25, mouth.y + i * BL * 0.035, mouth.z - i * R[2] * 0.08))
                d = V((sx * 0.75, 0.1 + 0.25 * i, -0.3 - 0.15 * i)).normalized()
                pts = bezier(a, a + V((sx * wl * 0.25, -wl * 0.25, 0)), a + d * wl * 0.8, a + d * wl + V((0, wl * 0.25, -wl * 0.1)), 6)
                m.add(rail(pts, [max(R[0] * 0.05 * (1 - 0.6 * j / 6), 0.0018) for j in range(7)], seg=6), 'fin')
    # 눈 (넙치처럼 한쪽에 몰린 눈: oneSide)
    er = R[2] * 0.22 * pv('eyeSize', 1.0)
    ey, ez = -L / 2 + BL * 0.16, R[2] * 0.18
    if P.get('oneSide'):
        for dy, dz in ((0.0, 0.25), (BL * 0.08, -0.05)):
            x = half_w(ey + dy, R[2] * dz) + er * 0.25
            c = V((x, ey + dy, R[2] * dz))
            m.add(ellipsoid(c, (er * 0.7, er, er), seg=12, rings=8), 'eye')
            m.add(ellipsoid(c + V((er * 0.45, -er * 0.3, er * 0.35)), (er * 0.35,) * 3, seg=8, rings=6), 'eyeHighlight')
    else:
        x = half_w(ey, ez)
        for sx in (1, -1):
            c = V((sx * (x - er * 0.25), ey, ez))
            m.add(ellipsoid(c, (er * 0.6, er, er), seg=12, rings=8), 'eye')
            m.add(ellipsoid(c + V((sx * er * 0.45, -er * 0.3, er * 0.35)), (er * 0.34,) * 3, seg=8, rings=6), 'eyeHighlight')
    # 아가미 줄
    if P.get('gills'):
        for i in range(int(P.get('gills'))):
            gy = ey + BL * (0.12 + 0.035 * i)
            for sx in (1, -1):
                pts = [V((sx * half_w(gy, z) * 1.01, gy, z)) for z in (R[2] * 0.25, 0, -R[2] * 0.3)]
                m.add(rail(pts, [R[0] * 0.035] * 3, seg=5), 'mark', outline=False)
    # 무늬
    pattern = P.get('pattern', 'none')
    rnd = random.Random(int(P.get('seed', 5)))
    if pattern == 'spots':
        n = int(P.get('spots', 10))
        sr = R[2] * pv('spotSize', 0.12)
        for _ in range(n):
            y = y0 + R[1] * rnd.uniform(-0.45, 0.7)
            z = R[2] * rnd.uniform(-0.15, 0.6) * k_at((y - y0) / R[1])
            for sx in ((1,) if P.get('oneSide') else (1, -1)):
                x = half_w(y, z)
                if x <= 1e-4:
                    continue
                nrm = V((x / R[0] ** 2, (y - y0) / R[1] ** 2, z / R[2] ** 2)).normalized()
                dot_on(m, (sx * x, y, z), V((sx * nrm.x, nrm.y, nrm.z)), sr * rnd.uniform(0.7, 1.2), 'mark')
    elif pattern == 'bands':
        n = int(P.get('bands', 5))
        for i in range(n):
            y = y0 + R[1] * (-0.35 + 1.0 * i / max(n - 1, 1))
            hh, hw = half_h(y), half_w(y)
            if hh < 1e-3:
                continue
            m.add(ellipsoid((0, y, hh * 0.15), (hw * 1.04, BL * 0.022, hh * 0.92), seg=16, rings=8), 'mark', outline=False)
    elif pattern == 'line':
        for sx in (1, -1):
            pts = [V((sx * half_w(y, R[2] * 0.08) * 1.01, y, R[2] * 0.08 * k_at((y - y0) / R[1]))) for y in (y0 + R[1] * t for t in (-0.45, -0.2, 0.1, 0.4, 0.7, 0.85))]
            m.add(rail(pts, [R[0] * 0.07] * len(pts), seg=6), 'mark', outline=False)
    elif pattern == 'waves':
        for sx in (1, -1):
            for j in range(6):
                y = y0 + R[1] * (-0.3 + 0.17 * j)
                zt = half_h(y)
                pts = [V((sx * half_w(y + dy, zt * f) * 1.01, y + dy, zt * f)) for dy, f in ((0, 0.95), (BL * 0.02, 0.7), (-BL * 0.01, 0.45))]
                m.add(rail(pts, [R[0] * 0.06] * 3, seg=5), 'mark', outline=False)
    elif pattern == 'patch':          # 아가미 뒤 점 하나 (은어)
        y, z = ey + BL * 0.22, R[2] * 0.12
        for sx in (1, -1):
            x = half_w(y, z)
            nrm = V((x / R[0] ** 2, (y - y0) / R[1] ** 2, z / R[2] ** 2)).normalized()
            dot_on(m, (sx * x, y, z), V((sx * nrm.x, nrm.y, nrm.z)), R[2] * 0.22, 'mark')
    # 꼬리자루 작은 지느러미 (참치·고등어)
    for i in range(int(P.get('finlets', 0))):
        y = y0 + R[1] * (0.45 + 0.08 * i)
        hh = half_h(y)
        for sz in (1, -1):
            m.add(slab([(0, 0), (BL * 0.04, sz * hh * 0.45), (BL * 0.05, 0)], origin=(0, y, sz * hh * 0.8), u=(0, 1, 0), v=(0, 0, 1), thick=fin_t * 0.7), 'mark', smooth=False)


def b_flatfish(M):
    """넙치: 납작한 마름모 몸에 가장자리 지느러미, 두 눈이 위(+Z)쪽 한 면에."""
    L = pv('length', 0.48)
    m = M.part('fish')
    BL, BW, T = L * 0.78, L * 0.48, L * 0.05
    yc = -L / 2 + BL / 2
    body = ellipsoid((0, yc, 0), (BW / 2, BL / 2, T), seg=26, rings=12)
    for v in body.verts:
        t = (v.co.y - yc) / (BL / 2)
        if t > 0:
            v.co.x *= 1 - 0.45 * t ** 1.5
    m.add(body, lambda c, n: 'body' if n.z >= 0 else 'belly')
    fringe = []
    for k in range(21):
        a = math.pi * (0.08 + 0.84 * k / 20)
        fringe.append((-math.cos(a) * BL * 0.5 + yc, math.sin(a) * BW * 0.5 * (1 - 0.35 * max(0, -math.cos(a)))))
    for sx in (1, -1):
        outer = [(y, x * 1.22) for y, x in fringe]
        inner = [(y, x * 0.85) for y, x in reversed(fringe)]
        m.add(slab([(x * sx, y) for y, x in outer + inner], u=(1, 0, 0), v=(0, 1, 0), thick=0.005), 'fin', smooth=False)
    tb = yc + BL * 0.46
    m.add(slab(tail_pts('round', L - (tb + L / 2) + 0.01, BW * 0.55), origin=(0, tb, 0), u=(0, 1, 0), v=(1, 0, 0), thick=0.006), 'fin', smooth=False)
    rnd = random.Random(3)
    for _ in range(int(P.get('spots', 9))):
        x, y = rnd.uniform(-0.3, 0.3) * BW, yc + rnd.uniform(-0.3, 0.38) * BL
        dot_on(m, (x, y, T * 0.95), (0, 0, 1), BW * 0.05 * rnd.uniform(0.7, 1.3), 'mark')
    er = BW * 0.07
    for x, y in ((BW * 0.1, -L / 2 + BL * 0.16), (-BW * 0.04, -L / 2 + BL * 0.24)):
        c = V((x, y, T * 0.9))
        m.add(ellipsoid(c, (er, er, er * 0.8), seg=12, rings=8), 'eye')
        m.add(ellipsoid(c + V((er * 0.3, -er * 0.35, er * 0.55)), (er * 0.35,) * 3, seg=8, rings=6), 'eyeHighlight')


def b_squid(M):
    """오징어: 몸통(외투막)이 뒤(+Y), 다리 여덟 + 긴 촉완 둘이 앞(-Y)."""
    L = pv('length', 0.42)
    m = M.part('squid')
    ML = L * 0.55
    mc = V((0, L / 2 - ML / 2, 0))
    mantle = ellipsoid(mc, (L * 0.09, ML / 2, L * 0.09), seg=20, rings=14)
    for v in mantle.verts:
        t = (v.co.y - mc.y) / (ML / 2)
        if t > 0:
            v.co.x *= 1 - 0.7 * t ** 2
            v.co.z *= 1 - 0.7 * t ** 2
    m.add(mantle, lambda c, n: 'back' if c.z > L * 0.03 else 'body')
    for sx in (1, -1):   # 지느러미 (끝 쪽 마름모)
        m.add(slab([(0, 0), (L * 0.12, ML * 0.08), (0, ML * 0.32)], origin=(sx * L * 0.03, L / 2 - ML * 0.36, 0), u=(sx, 0, 0), v=(0, 1, 0), thick=0.006), 'fin', smooth=False)
    hc = V((0, L / 2 - ML - L * 0.04, 0))
    m.add(ellipsoid(hc, (L * 0.075, L * 0.07, L * 0.07), seg=16, rings=10), 'body')
    eyes(m, L * 0.062, hc.y, L * 0.02, L * 0.03)
    base = hc + V((0, -L * 0.05, 0))
    for k in range(8):
        a = TAU * k / 8
        d = V((math.cos(a), 0, math.sin(a)))
        pts = bezier(base + d * L * 0.03, base + d * L * 0.05 + V((0, -L * 0.1, 0)), base + d * L * 0.08 + V((0, -L * 0.2, 0)), base + d * L * 0.06 + V((0, -L * 0.27, -L * 0.03)), 6)
        m.add(rail(pts, [L * 0.022 * (1 - 0.7 * i / 6) for i in range(7)], seg=7), 'fin')
    for sx in (1, -1):
        a = base + V((sx * L * 0.02, 0, -L * 0.01))
        pts = bezier(a, a + V((sx * L * 0.03, -L * 0.15, -L * 0.02)), a + V((sx * L * 0.06, -L * 0.3, -L * 0.05)), a + V((sx * L * 0.04, -L * 0.42, -L * 0.03)), 8)
        m.add(rail(pts, [L * 0.012] * 8 + [L * 0.028], seg=7), 'fin')


def b_octopus(M):
    """문어: 둥근 머리(+Y 뒤로 살짝 기운) + 다리 여덟이 아래로 퍼져 끝이 말린다."""
    L = pv('length', 0.4)
    m = M.part('octopus')
    hc = V((0, L * 0.08, L * 0.2))
    head = ellipsoid(hc, (L * 0.2, L * 0.24, L * 0.22), seg=22, rings=14)
    m.add(head, lambda c, n: 'back' if c.z > hc.z + L * 0.05 else 'body')
    m.add(ellipsoid((0, -L * 0.06, L * 0.04), (L * 0.15, L * 0.13, L * 0.11), seg=18, rings=12), 'body')
    eyes(m, L * 0.11, -L * 0.13, L * 0.08, L * 0.035)
    rnd = random.Random(2)
    for k in range(8):
        a = TAU * (k + 0.5) / 8
        d = V((math.cos(a), math.sin(a), 0))
        s = V((-d.y, d.x, 0)) * (1 if k % 2 else -1)
        r0 = V((0, -L * 0.02, 0)) + d * L * 0.08
        ln = L * rnd.uniform(0.38, 0.46)
        pts = bezier(r0, r0 + d * ln * 0.35 + V((0, 0, -L * 0.06)), r0 + d * ln * 0.8 + V((0, 0, -L * 0.04)), r0 + d * ln + s * ln * 0.25 + V((0, 0, L * 0.06)), 10)
        m.add(rail(pts, [L * 0.05 * (1 - 0.8 * i / 10) for i in range(11)], seg=8), 'body')
        for j in (2, 4, 6):   # 빨판
            p = pts[j]
            dot_on(m, p + V((0, 0, -L * 0.04 * (1 - j / 12))), V((0, 0, -1)), L * 0.014, 'mark', depth=0.6)


def b_seahorse(M):
    """해마: 선 몸이 S 자로 내려가 꼬리가 앞으로 말린다. 주둥이는 앞(-Y)."""
    L = pv('length', 0.3)
    m = M.part('seahorse')
    spine = [V(p) for p in ((0, 0.02, 0.42), (0, 0.06, 0.32), (0, 0.04, 0.18), (0, -0.02, 0.06), (0, 0.0, -0.06), (0, 0.06, -0.15),
                           (0, 0.05, -0.24), (0, -0.02, -0.28), (0, -0.07, -0.24), (0, -0.06, -0.18), (0, -0.02, -0.17))]
    spine = [p * L for p in spine]
    radii = [0.08, 0.1, 0.12, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025, 0.02]
    m.add(rail(spine, [r * L for r in radii], seg=14, flat=0.8, side=(1, 0, 0)), lambda c, n: 'belly' if n.y < -0.5 and c.z > -0.05 * L else 'body')
    hc = V((0, 0.0, 0.42)) * L
    m.add(ellipsoid(hc, (L * 0.075, L * 0.09, L * 0.075), seg=16, rings=10), 'body')
    m.add(rail([hc + V((0, -L * 0.05, -L * 0.01)), hc + V((0, -L * 0.15, -L * 0.03)), hc + V((0, -L * 0.2, -L * 0.04))], [L * 0.03, L * 0.022, L * 0.026], seg=10), 'body')
    for k in range(4):   # 머리 위 왕관 돌기
        m.add(cone(hc + V((0, L * (0.03 - 0.025 * k), L * 0.06)), hc + V((0, L * (0.04 - 0.025 * k), L * 0.11)), L * 0.015, 0.0, seg=6), 'back')
    for i in range(1, 7):  # 몸 마디 돌기
        p = spine[i]
        m.add(ellipsoid(p + V((0, L * 0.1 * (1 - i / 8), 0)), (L * 0.025, L * 0.02, L * 0.02), seg=8, rings=6), 'back')
    m.add(slab(oval2d(L * 0.08, L * 0.05, 12, cx=L * 0.06, squeeze=0.4), origin=(0, L * 0.09, L * 0.12), u=(0, 1, 0.4), v=(0, -0.4, 1), thick=0.005), 'fin', smooth=False)
    eyes(m, L * 0.06, hc.y - L * 0.02, hc.z + L * 0.015, L * 0.025)


# ================================================================ 곤충 (bug)
def antennae(m, head, s, length=0.5, club=0.0, feather=False, bend=0.25, mat='leg'):
    for sx in (1, -1):
        a = head + V((sx * s * 0.04, -s * 0.05, s * 0.05))
        tip = a + V((sx * s * length * 0.45, -s * length * 0.8, s * length * 0.45))
        pts = bezier(a, a + V((sx * s * 0.05, -s * length * 0.3, s * length * 0.25)), tip + V((0, s * length * bend, 0)), tip, 6)
        m.add(rail(pts, [s * 0.008] * 7, seg=5), mat)
        if club:
            m.add(ellipsoid(tip, (s * club, s * club * 1.4, s * club), seg=8, rings=6), mat)
        if feather:
            for j in range(1, 6):
                p = pts[j]
                for k in (1, -1):
                    m.add(rail([p, p + V((sx * s * 0.04 * k, -s * 0.01, s * 0.02))], [s * 0.006] * 2, seg=4), mat, outline=False)


def six_legs(m, s, width, z, ys=(-0.12, 0.02, 0.16), reach=0.22, drop=0.13, mat='leg', r=0.013):
    for sx in (1, -1):
        for i, y in enumerate(ys):
            root = V((sx * width, y * s, z))
            knee = root + V((sx * reach * s * 0.6, (y * 0.6 - 0.04 + 0.06 * i) * s, s * 0.08))
            foot = knee + V((sx * reach * s * 0.5, ((i - 1) * 0.18) * s, -drop * s))
            leg(m, [root, knee, foot], r * s, mat)


def wing_shape(kind, w, h):
    """날개 한 장의 2D 모양 (x = 바깥쪽, y = 앞쪽). 뿌리는 (0, 0)."""
    if kind == 'fore':      # 나비 앞날개: 앞쪽으로 뻗은 둥근 삼각형
        return spline2d([(0, 0.05 * h), (0.35 * w, 0.55 * h), (0.95 * w, 0.75 * h), (1.0 * w, 0.35 * h), (0.6 * w, -0.1 * h), (0.1 * w, -0.15 * h)])
    if kind == 'hind':      # 뒷날개: 뒤로 처진 둥근 모양
        return spline2d([(0, 0.05 * h), (0.55 * w, 0.0), (0.85 * w, -0.35 * h), (0.6 * w, -0.85 * h), (0.25 * w, -0.8 * h), (0.0, -0.3 * h)])
    if kind == 'hindTail':  # 호랑나비 뒷날개 (꼬리 달림)
        return spline2d([(0, 0.05 * h), (0.55 * w, 0.0), (0.8 * w, -0.35 * h), (0.6 * w, -0.75 * h), (0.5 * w, -1.25 * h), (0.38 * w, -0.8 * h), (0.15 * w, -0.75 * h), (0.0, -0.3 * h)])
    if kind == 'long':      # 잠자리: 길고 가는 날개
        return spline2d([(0, 0.02 * h), (0.3 * w, 0.12 * h), (0.95 * w, 0.1 * h), (1.0 * w, -0.02 * h), (0.6 * w, -0.12 * h), (0.0, -0.08 * h)])
    if kind == 'swept':     # 나방: 뒤로 젖힌 넓은 앞날개
        return spline2d([(0, 0.1 * h), (0.5 * w, 0.4 * h), (1.0 * w, 0.25 * h), (0.95 * w, -0.25 * h), (0.5 * w, -0.45 * h), (0.0, -0.2 * h)])
    return oval2d(w / 2, h / 2, 14, cx=w / 2)


def add_wing(m, root, side, shape, w, h, raise_deg, mat='wing', yaw_deg=0.0, thick=0.004, marks=()):
    """날개 한 장: 뿌리 root 에서 바깥(side)으로. yaw_deg > 0 이면 앞으로, < 0 이면 뒤로 젖히고, raise_deg 만큼 위로 든다."""
    a, yw = math.radians(raise_deg), math.radians(yaw_deg)
    u = V((side * math.cos(yw) * math.cos(a), -math.sin(yw) * math.cos(a), math.sin(a)))
    v = V((-side * math.sin(yw), -math.cos(yw), 0))
    pts = wing_shape(shape, w, h)
    m.add(slab([(x, y) for x, y in pts], origin=root, u=u, v=v, thick=thick), mat, smooth=False)
    n = u.normalized().cross(v).normalized()
    for (mx, my, mr, mm) in marks:   # 날개 위 무늬 (작은 판, 날개 윗면에)
        c = V(root) + u.normalized() * mx * w + v * my * h
        up = n if n.z > 0 else -n
        m.add(slab(oval2d(mr * w, mr * w * 0.85, 12), origin=c + up * thick * 0.9, u=u, v=v, thick=thick * 0.5), mm, outline=False, smooth=False)


def b_butterfly(M):
    s = pv('size', 0.3)                  # 날개 편 너비
    m = M.part('bug')
    body = P.get('bodyFat', 1.0)
    m.add(capsule((0, s * 0.12, 0), (0, -s * 0.1, 0), s * 0.035 * body, seg=12, rings=8), 'body')
    head = V((0, -s * 0.15, s * 0.01))
    m.add(ellipsoid(head, (s * 0.045 * body, s * 0.04, s * 0.04), seg=12, rings=8), 'body')
    eyes(m, s * 0.035, head.y - s * 0.01, head.z + s * 0.005, s * 0.018, highlight=False)
    antennae(m, head, s, length=0.32, club=0.0 if P.get('feather') else 0.018, feather=bool(P.get('feather')))
    fw, fh = s * 0.5, s * pv('foreHeight', 0.42)
    hw, hh = s * 0.4, s * pv('hindHeight', 0.36)
    rz = pv('raise', 16)
    fore = P.get('fore', 'fore')
    hind = P.get('hind', 'hind')
    fm = [tuple(x) for x in P.get('foreMarks', [])]
    hm = [tuple(x) for x in P.get('hindMarks', [])]
    for sx in (1, -1):
        add_wing(m, (sx * s * 0.02, -s * 0.04, s * 0.02), sx, fore, fw, fh, rz, 'wing', yaw_deg=pv('foreYaw', 10), marks=fm)
        add_wing(m, (sx * s * 0.02, s * 0.03, s * 0.0), sx, hind, hw, hh, rz - 6, 'wing2', yaw_deg=-10, marks=hm)


def b_dragonfly(M):
    s = pv('size', 0.34)
    m = M.part('bug')
    m.add(ellipsoid((0, -s * 0.12, 0), (s * 0.045, s * 0.07, s * 0.045), seg=12, rings=8), 'body')
    tail = [V((0, -s * 0.06 + s * 0.6 * i / 8, -s * 0.004 * i * i * 0.2)) for i in range(9)]
    m.add(rail(tail, [s * 0.026 * (1 - 0.4 * i / 8) for i in range(9)], seg=8), 'body')
    for i in range(1, 8, 2):
        m.add(ellipsoid(tail[i], (s * 0.028, s * 0.012, s * 0.028), seg=8, rings=6), 'stripe', outline=False)
    head = V((0, -s * 0.2, s * 0.01))
    m.add(ellipsoid(head, (s * 0.05, s * 0.035, s * 0.04), seg=12, rings=8), 'body')
    for sx in (1, -1):
        m.add(ellipsoid(head + V((sx * s * 0.035, -s * 0.005, s * 0.015)), (s * 0.035, s * 0.035, s * 0.035), seg=12, rings=8), 'eye')
        m.add(ellipsoid(head + V((sx * s * 0.05, -s * 0.03, s * 0.035)), (s * 0.01,) * 3, seg=6, rings=4), 'eyeHighlight')
    for y, sh in ((-s * 0.13, 0), (-s * 0.09, 1)):
        for sx in (1, -1):
            add_wing(m, (sx * s * 0.03, y, s * 0.04), sx, 'long', s * 0.48, s * 0.2, 4, 'wing', yaw_deg=8 - 18 * sh, thick=0.003,
                     marks=[(0.92, 0.0, 0.04, 'wingMark')])
    six_legs(m, s, s * 0.03, -s * 0.03, ys=(-0.17, -0.13, -0.09), reach=0.14, drop=0.08, r=0.01)


def b_bee(M):
    s = pv('size', 0.2)
    m = M.part('bug')
    ab = V((0, s * 0.18, -s * 0.02))
    m.add(ellipsoid(ab, (s * 0.2, s * 0.26, s * 0.19), seg=18, rings=12), 'body')
    for t in (-0.05, 0.12):
        m.add(ellipsoid(ab + V((0, s * t * 1.0 + s * 0.02, 0)), (s * 0.205, s * 0.05, s * 0.195), seg=18, rings=8), 'stripe')
    m.add(cone(ab + V((0, s * 0.24, -s * 0.02)), ab + V((0, s * 0.33, -s * 0.03)), s * 0.03, 0.0, seg=8), 'stripe')
    th = V((0, -s * 0.07, s * 0.02))
    m.add(ellipsoid(th, (s * 0.15, s * 0.14, s * 0.14), seg=16, rings=10), 'fuzz')
    head = V((0, -s * 0.24, s * 0.01))
    m.add(ellipsoid(head, (s * 0.11, s * 0.09, s * 0.1), seg=14, rings=10), 'stripe')
    eyes(m, s * 0.07, head.y - s * 0.04, head.z + s * 0.02, s * 0.03)
    antennae(m, head, s, length=0.35, club=0.02, mat='stripe')
    for sx in (1, -1):
        add_wing(m, (sx * s * 0.06, -s * 0.06, s * 0.13), sx, 'oval', s * 0.42, s * 0.2, 35, 'wing', yaw_deg=-30, thick=0.003)
        add_wing(m, (sx * s * 0.06, -s * 0.01, s * 0.12), sx, 'oval', s * 0.28, s * 0.14, 25, 'wing', yaw_deg=-45, thick=0.003)
    six_legs(m, s, s * 0.08, -s * 0.08, reach=0.18, drop=0.12, mat='stripe', r=0.02)


def b_firefly(M):
    s = pv('size', 0.18)
    m = M.part('bug')
    m.add(ellipsoid((0, s * 0.05, 0), (s * 0.13, s * 0.3, s * 0.07), seg=16, rings=10), 'body')
    for sx in (1, -1):   # 겉날개
        m.add(ellipsoid((sx * s * 0.065, s * 0.02, s * 0.045), (s * 0.075, s * 0.28, s * 0.04), seg=14, rings=8), 'wing')
    m.add(ellipsoid((0, -s * 0.26, s * 0.03), (s * 0.12, s * 0.08, s * 0.05), seg=14, rings=8), 'head')
    head = V((0, -s * 0.34, s * 0.0))
    m.add(ellipsoid(head, (s * 0.06, s * 0.05, s * 0.05), seg=10, rings=8), 'body')
    eyes(m, s * 0.045, head.y - s * 0.02, head.z + s * 0.01, s * 0.022, highlight=False)
    antennae(m, head, s, length=0.4)
    m.add(ellipsoid((0, s * 0.3, -s * 0.01), (s * 0.1, s * 0.1, s * 0.065), seg=14, rings=10), 'glow')
    six_legs(m, s, s * 0.1, -s * 0.05, reach=0.16, drop=0.08, r=0.012)


def b_beetle(M):
    """딱정벌레 무리 (무당벌레·장수풍뎅이·사슴벌레): 둥근 등껍질 + 머리 + 다리 여섯. 뿔·큰 턱·점박이는 params."""
    s = pv('size', 0.2)
    m = M.part('bug')
    BL, BW, BH = s * pv('length', 0.5), s * pv('width', 0.42), s * pv('height', 0.26)
    shell = ellipsoid((0, s * 0.06, 0), (BW / 2, BL / 2, BH), seg=24, rings=14)
    for v in shell.verts:
        if v.co.z < 0:
            v.co.z *= 0.35
    m.add(shell, lambda c, n: 'shell' if c.z > BH * 0.05 else 'body')
    m.add(cylinder((0, s * 0.06 - BL * 0.47, BH * 0.95), (0, s * 0.06 + BL * 0.5, BH * 0.15), BW * 0.012, seg=5), 'body', outline=False)
    pro = V((0, s * 0.06 - BL / 2 - s * 0.03, BH * 0.15))
    m.add(ellipsoid(pro, (BW * 0.36, s * 0.07, BH * 0.55), seg=16, rings=10), 'head')
    head = pro + V((0, -s * 0.08, -BH * 0.05))
    m.add(ellipsoid(head, (BW * 0.24, s * 0.06, BH * 0.4), seg=14, rings=8), 'head')
    eyes(m, BW * 0.2, head.y - s * 0.015, head.z + BH * 0.1, s * 0.02, highlight=True)
    if P.get('horn'):
        pts = bezier(head + V((0, -s * 0.03, BH * 0.2)), head + V((0, -s * 0.12, BH * 0.4)), head + V((0, -s * 0.16, BH * 1.0)), head + V((0, -s * 0.1, BH * 1.4)), 8)
        m.add(rail(pts, [s * 0.045 * (1 - 0.7 * i / 8) for i in range(9)], seg=8), 'head')
        m.add(cone(pts[-1], pts[-1] + V((0, s * 0.06, s * 0.02)), s * 0.02, 0.0, seg=6), 'head')
        m.add(cone(pro + V((0, 0, BH * 0.4)), pro + V((0, -s * 0.06, BH * 0.85)), s * 0.03, 0.0, seg=8), 'head')
    if P.get('jaws'):
        for sx in (1, -1):
            a = head + V((sx * BW * 0.12, -s * 0.04, 0))
            pts = bezier(a, a + V((sx * s * 0.08, -s * 0.1, BH * 0.15)), a + V((sx * s * 0.02, -s * 0.24, BH * 0.25)), a + V((-sx * s * 0.04, -s * 0.28, BH * 0.2)), 8)
            m.add(rail(pts, [s * 0.03 * (1 - 0.6 * i / 8) for i in range(9)], seg=7), 'head')
            m.add(cone(pts[4], pts[4] + V((-sx * s * 0.04, -s * 0.01, 0)), s * 0.012, 0.0, seg=5), 'head')
    rnd = random.Random(4)
    for (x, y) in P.get('dots', []):
        z = BH * math.sqrt(max(0.0, 1 - (x / 0.5) ** 2 - (y / 0.5) ** 2))
        c = V((x * BW, s * 0.06 + y * BL, z))
        nrm = V((c.x / (BW / 2) ** 2, (c.y - s * 0.06) / (BL / 2) ** 2, c.z / BH ** 2)).normalized()
        dot_on(m, c, nrm, s * 0.045, 'mark', depth=0.35)
    antennae(m, head, s, length=0.22 if not P.get('jaws') else 0.15, club=0.015)
    six_legs(m, s, BW * 0.3, -BH * 0.05, ys=(-0.1, 0.03, 0.16), reach=0.2 * pv('legs', 1.0), drop=0.14, r=0.014)


def b_cicada(M):
    s = pv('size', 0.24)
    m = M.part('bug')
    m.add(ellipsoid((0, s * 0.05, 0), (s * 0.13, s * 0.25, s * 0.1), seg=16, rings=10), 'body')
    head = V((0, -s * 0.22, s * 0.02))
    m.add(ellipsoid(head, (s * 0.14, s * 0.07, s * 0.07), seg=16, rings=8), 'body')
    for sx in (1, -1):
        m.add(ellipsoid(head + V((sx * s * 0.13, -s * 0.0, s * 0.03)), (s * 0.04,) * 3, seg=10, rings=8), 'eye')
    m.add(ellipsoid((0, -s * 0.12, s * 0.06), (s * 0.12, s * 0.08, s * 0.05), seg=14, rings=8), 'mark')
    for sx in (1, -1):   # 지붕처럼 접은 투명 날개
        add_wing(m, (sx * s * 0.02, -s * 0.12, s * 0.13), sx, 'oval', s * 0.5, s * 0.2, -16, 'wing', yaw_deg=-66, thick=0.004,
                 marks=[(0.45, 0.0, 0.05, 'wingMark'), (0.75, 0.0, 0.04, 'wingMark')])
    six_legs(m, s, s * 0.08, -s * 0.06, reach=0.15, drop=0.1)


def b_hopper(M):
    """메뚜기·귀뚜라미·방울벌레·사마귀: 긴 몸 + 큰 뒷다리 + 긴 더듬이. 사마귀는 세운 가슴과 낫 앞다리."""
    s = pv('size', 0.3)
    m = M.part('bug')
    BL, BW = s * pv('length', 0.55), s * pv('width', 0.12)
    mantis = bool(P.get('mantis'))
    ab = V((0, BL * 0.2, 0))
    m.add(ellipsoid(ab, (BW / 2, BL * 0.38, BW * 0.5), seg=16, rings=10), 'body')
    for sx in (1, -1):   # 접은 날개
        m.add(ellipsoid(ab + V((sx * BW * 0.18, BL * 0.06, BW * 0.38)), (BW * 0.32, BL * 0.42 * pv('wingLength', 1.0), BW * 0.12), seg=14, rings=8), 'wing')
    if mantis:
        neck = [V((0, -BL * 0.15, BW * 0.2)), V((0, -BL * 0.35, BW * 1.2)), V((0, -BL * 0.45, BW * 2.2))]
        m.add(rail(neck, [BW * 0.3, BW * 0.24, BW * 0.22], seg=10), 'body')
        head = neck[-1] + V((0, -BW * 0.3, BW * 0.2))
        tri = ellipsoid(head, (BW * 0.55, BW * 0.3, BW * 0.4), seg=14, rings=8)
        for v in tri.verts:
            if v.co.z < head.z:
                v.co.x *= 0.5 + 0.5 * (v.co.z - head.z + BW * 0.4) / (BW * 0.4)
        m.add(tri, 'body')
        for sx in (1, -1):
            m.add(ellipsoid(head + V((sx * BW * 0.48, 0, BW * 0.1)), (BW * 0.16,) * 3, seg=10, rings=6), 'eye')
            a = neck[1] + V((sx * BW * 0.25, -BW * 0.1, 0))
            leg(m, [a, a + V((sx * BW * 0.25, -BL * 0.12, BW * 0.8)), a + V((sx * BW * 0.3, -BL * 0.2, -BW * 0.1)), a + V((sx * BW * 0.25, -BL * 0.1, -BW * 0.5))], s * 0.022, 'body')
        antennae(m, head, s, length=0.3)
        ys = (0.05, 0.18)
    else:
        head = V((0, -BL * 0.25, BW * 0.12))
        m.add(ellipsoid(head + V((0, BL * 0.06, 0)), (BW * 0.48, BL * 0.1, BW * 0.5), seg=14, rings=8), 'body')
        m.add(ellipsoid(head, (BW * 0.4, BL * 0.08, BW * 0.5), seg=14, rings=8), 'head')
        eyes(m, BW * 0.38, head.y - BL * 0.02, head.z + BW * 0.15, BW * 0.12)
        antennae(m, head, s, length=pv('antenna', 0.6), bend=0.1)
        ys = (-0.2, -0.08)
    for sx in (1, -1):   # 큰 뒷다리 (무릎이 위로)
        hip = ab + V((sx * BW * 0.4, -BL * 0.05, -BW * 0.1))
        knee = hip + V((sx * BW * 0.6, BL * 0.25, BW * 1.2 * pv('kneeUp', 1.0)))
        foot = knee + V((sx * BW * 0.4, BL * 0.25, -BW * 1.8))
        m.add(rail([hip, hip.lerp(knee, 0.5) + V((sx * BW * 0.1, 0, BW * 0.1)), knee], [BW * 0.22, BW * 0.2, BW * 0.1], seg=8), 'leg2')
        leg(m, [knee, foot], s * 0.014, 'leg')
    for sx in (1, -1):
        for y in ys:
            root = V((sx * BW * 0.35, y * s, -BW * 0.1))
            leg(m, [root, root + V((sx * s * 0.08, -s * 0.03, s * 0.02)), root + V((sx * s * 0.12, -s * 0.02, -s * 0.07))], s * 0.012)
    if P.get('cerci'):
        for sx in (1, -1):
            a = ab + V((sx * BW * 0.1, BL * 0.36, 0))
            m.add(rail([a, a + V((sx * BW * 0.3, BL * 0.25, BW * 0.2))], [s * 0.01] * 2, seg=5), 'leg')


def b_ant(M):
    s = pv('size', 0.18)
    m = M.part('bug')
    m.add(ellipsoid((0, s * 0.2, s * 0.02), (s * 0.13, s * 0.17, s * 0.12), seg=16, rings=10), 'body')
    m.add(ellipsoid((0, -s * 0.03, 0), (s * 0.07, s * 0.11, s * 0.065), seg=14, rings=8), 'body')
    head = V((0, -s * 0.22, s * 0.03))
    m.add(ellipsoid(head, (s * 0.1, s * 0.09, s * 0.085), seg=14, rings=10), 'body')
    eyes(m, s * 0.08, head.y - s * 0.02, head.z + s * 0.03, s * 0.025)
    for sx in (1, -1):   # ㄱ 자 더듬이
        a = head + V((sx * s * 0.04, -s * 0.06, s * 0.06))
        b = a + V((sx * s * 0.04, -s * 0.02, s * 0.14))
        c = b + V((sx * s * 0.06, -s * 0.12, -s * 0.02))
        m.add(rail([a, b, c], [s * 0.012] * 3, seg=5), 'body')
    six_legs(m, s, s * 0.05, -s * 0.03, ys=(-0.08, -0.02, 0.04), reach=0.34, drop=0.2, mat='body', r=0.016)


def b_snail(M):
    s = pv('size', 0.24)
    m = M.part('bug')
    foot = ellipsoid((0, -s * 0.02, -s * 0.06), (s * 0.08, s * 0.32, s * 0.06), seg=18, rings=10)
    for v in foot.verts:
        if v.co.y < -s * 0.1:
            v.co.z += (-s * 0.1 - v.co.y) * 0.45
    m.add(foot, 'body')
    for sx in (1, -1):
        a = V((sx * s * 0.03, -s * 0.24, s * 0.06))
        tip = a + V((sx * s * 0.05, -s * 0.06, s * 0.14))
        m.add(rail([a, a.lerp(tip, 0.5), tip], [s * 0.014, s * 0.011, s * 0.009], seg=6), 'body')
        m.add(ellipsoid(tip, (s * 0.022,) * 3, seg=8, rings=6), 'eye')
    c = V((0, s * 0.08, s * 0.12))
    pts, radii = [], []
    for i in range(37):   # 소용돌이 껍데기 (옆에서 보면 동그라미)
        th = i / 36 * TAU * 2.2
        r = s * 0.16 * math.exp(-0.22 * th)
        pts.append(c + V((s * 0.012 * i / 36, math.cos(th) * r, math.sin(th) * r)))
        radii.append(r * 0.85)
    m.add(rail(pts, radii, seg=14, flat=0.75, side=(1, 0, 0)), 'shell')


def b_pillbug(M):
    s = pv('size', 0.18)
    m = M.part('bug')
    for i in range(7):   # 겹친 등판 마디
        y = s * (-0.18 + 0.06 * i)
        w = s * 0.14 * math.sqrt(max(0.2, 1 - ((i - 3) / 4.2) ** 2))
        m.add(ellipsoid((0, y, 0), (w, s * 0.045, w * 0.75), seg=16, rings=10), 'body' if i % 2 else 'shell')
    head = V((0, -s * 0.24, -s * 0.01))
    m.add(ellipsoid(head, (s * 0.07, s * 0.04, s * 0.05), seg=12, rings=8), 'body')
    eyes(m, s * 0.05, head.y - s * 0.01, head.z + s * 0.02, s * 0.015, highlight=False)
    antennae(m, head + V((0, 0, -s * 0.03)), s, length=0.25, bend=0.0)
    six_legs(m, s, s * 0.08, -s * 0.06, ys=(-0.12, 0.0, 0.12), reach=0.12, drop=0.08, r=0.018)


def b_skater(M):
    s = pv('size', 0.3)
    m = M.part('bug')
    m.add(ellipsoid((0, s * 0.02, 0), (s * 0.035, s * 0.16, s * 0.03), seg=12, rings=8), 'body')
    head = V((0, -s * 0.16, s * 0.005))
    m.add(ellipsoid(head, (s * 0.03, s * 0.035, s * 0.025), seg=10, rings=6), 'body')
    eyes(m, s * 0.028, head.y - s * 0.005, head.z + s * 0.01, s * 0.012, highlight=False)
    antennae(m, head, s, length=0.18, bend=0.0)
    for sx in (1, -1):
        a = V((sx * s * 0.02, -s * 0.09, -s * 0.01))
        leg(m, [a, a + V((sx * s * 0.06, -s * 0.06, s * 0.02)), a + V((sx * s * 0.08, -s * 0.12, -s * 0.03))], s * 0.012, 'leg')
        for y, d, ln in ((-0.03, -0.25, 0.5), (0.03, 0.55, 0.55)):
            a = V((sx * s * 0.025, y * s, -s * 0.01))
            knee = a + V((sx * s * 0.12, d * s * 0.2, s * 0.05))
            foot = knee + V((sx * s * ln * 0.55, d * s * ln * 0.5, -s * 0.06))
            leg(m, [a, knee, foot], s * 0.012, 'leg')
            m.add(ellipsoid(foot + V((0, 0, -s * 0.005)), (s * 0.04, s * 0.04, s * 0.003), seg=12, rings=4), 'ripple', outline=False)


def b_caterpillar(M):
    s = pv('size', 0.26)
    m = M.part('bug')
    n = 7
    for i in range(n):
        y = s * (0.3 - 0.085 * i)
        z = s * 0.03 * math.sin(math.pi * i / (n - 1)) * 1.4
        r = s * (0.055 + 0.004 * i)
        m.add(ellipsoid((0, y, z), (r, r * 0.9, r), seg=14, rings=10), lambda c, nn: 'belly' if c.z < z - r * 0.4 else 'body')
        if i % 2 == 0:
            m.add(ellipsoid((0, y, z + r * 0.15), (r * 1.02, r * 0.2, r * 0.9), seg=14, rings=6), 'stripe', outline=False)
        for sx in (1, -1):   # 털 뭉치
            m.add(cone((sx * r * 0.6, y, z + r * 0.7), (sx * r * 1.1, y, z + r * 1.5), r * 0.12, 0.0, seg=5), 'hair', outline=False)
    head = V((0, -s * 0.27, s * 0.02))
    m.add(ellipsoid(head, (s * 0.07, s * 0.065, s * 0.07), seg=14, rings=10), 'head')
    eyes(m, s * 0.045, head.y - s * 0.045, head.z + s * 0.015, s * 0.014)


def b_earwig(M):
    s = pv('size', 0.24)
    m = M.part('bug')
    for i in range(6):
        y = s * (-0.05 + 0.06 * i)
        m.add(ellipsoid((0, y, 0), (s * 0.06 * (1 - 0.05 * i), s * 0.04, s * 0.035), seg=12, rings=8), 'body')
    m.add(ellipsoid((0, -s * 0.1, s * 0.015), (s * 0.065, s * 0.06, s * 0.035), seg=12, rings=8), 'wing')
    m.add(ellipsoid((0, -s * 0.17, s * 0.005), (s * 0.05, s * 0.03, s * 0.03), seg=12, rings=8), 'body')
    head = V((0, -s * 0.23, 0))
    m.add(ellipsoid(head, (s * 0.05, s * 0.045, s * 0.03), seg=12, rings=8), 'head')
    eyes(m, s * 0.04, head.y - s * 0.01, head.z + s * 0.01, s * 0.013, highlight=False)
    antennae(m, head, s, length=0.35, bend=0.1)
    for sx in (1, -1):   # 꽁무니 집게
        a = V((sx * s * 0.02, s * 0.27, 0))
        pts = bezier(a, a + V((sx * s * 0.05, s * 0.06, 0)), a + V((sx * s * 0.03, s * 0.15, s * 0.01)), a + V((-sx * s * 0.02, s * 0.19, s * 0.01)), 7)
        m.add(rail(pts, [s * 0.02 * (1 - 0.6 * i / 7) for i in range(8)], seg=6), 'head')
    six_legs(m, s, s * 0.05, -s * 0.02, ys=(-0.17, -0.1, -0.02), reach=0.15, drop=0.08, r=0.012)


# ================================================================ 화석 (fossil)
def b_ammonite(M):
    s = pv('size', 0.32)
    m = M.part('fossil')
    pts, radii = [], []
    for i in range(61):
        th = i / 60 * TAU * 2.6
        r = s * 0.5 * math.exp(-0.2 * (TAU * 2.6 - th)) * 0.62
        pts.append(V((math.cos(th) * r, 0, math.sin(th) * r + s * 0.45)))
        radii.append(r * 0.55 + s * 0.008)
    m.add(rail(pts, radii, seg=14, flat=0.6, side=(1, 0, 0)), 'fossil')
    for i in range(4, 60, 3):   # 갈비 무늬
        p, nxt = pts[i], pts[min(i + 1, 60)]
        t = (nxt - p).normalized()
        m.add(ellipsoid(p, (radii[i] * 0.72, radii[i] * 0.72, radii[i] * 0.16), rot=align_z(t), seg=12, rings=6), 'fossilDark', outline=False)


def b_trilobite(M):
    s = pv('size', 0.32)
    m = M.part('fossil')
    m.add(jitter(ellipsoid((0, 0, s * 0.03), (s * 0.42, s * 0.5, s * 0.06), seg=16, rings=8), s * 0.015, 2, keep_bottom=0.0), 'stone', smooth=False)
    cz = s * 0.08
    head = ellipsoid((0, -s * 0.22, cz), (s * 0.23, s * 0.12, s * 0.04), seg=20, rings=10)
    for v in head.verts:
        if v.co.y > -s * 0.22:
            v.co.y = -s * 0.22 + (v.co.y + s * 0.22) * 0.4
    m.add(head, 'fossil')
    for sx in (1, -1):
        m.add(cone((sx * s * 0.2, -s * 0.18, cz), (sx * s * 0.27, -s * 0.0, cz - s * 0.01), s * 0.03, 0.0, seg=6), 'fossil')
        m.add(ellipsoid((sx * s * 0.09, -s * 0.24, cz + s * 0.03), (s * 0.03, s * 0.025, s * 0.02), seg=8, rings=6), 'fossilDark')
    for i in range(8):
        y = -s * 0.12 + s * 0.04 * i
        w = s * 0.2 * (1 - 0.6 * (i / 8) ** 1.4)
        m.add(ellipsoid((0, y, cz), (w, s * 0.024, s * 0.03), seg=16, rings=6), 'fossil')
        m.add(ellipsoid((0, y, cz + s * 0.015), (w * 0.28, s * 0.022, s * 0.03), seg=10, rings=6), 'fossilDark', outline=False)
    m.add(ellipsoid((0, s * 0.24, cz), (s * 0.08, s * 0.05, s * 0.025), seg=12, rings=6), 'fossil')


def b_amber(M):
    s = pv('size', 0.26)
    m = M.part('fossil')
    m.add(jitter(ellipsoid((0, 0, s * 0.3), (s * 0.4, s * 0.32, s * 0.3), seg=9, rings=6), s * 0.04, 6, keep_bottom=0.0), 'amber', smooth=False)
    bug = V((0, -s * 0.15, s * 0.32))
    m.add(ellipsoid(bug, (s * 0.06, s * 0.09, s * 0.04), seg=10, rings=6), 'inclusion', outline=False)
    for sx in (1, -1):
        m.add(rail([bug, bug + V((sx * s * 0.08, -s * 0.03, s * 0.0)), bug + V((sx * s * 0.1, s * 0.03, -s * 0.02))], [s * 0.008] * 3, seg=4), 'inclusion', outline=False)
    m.add(ellipsoid((-s * 0.14, -s * 0.2, s * 0.45), (s * 0.06, s * 0.03, s * 0.09), rot=rot_xyz(y=0.6), seg=8, rings=6), 'glint', outline=False)


def b_fern_fossil(M):
    s = pv('size', 0.36)
    m = M.part('fossil')
    m.add(jitter(box((0, 0, s * 0.06), (s * 0.9, s * 0.62, s * 0.12), bevel=s * 0.05), s * 0.012, 3, keep_bottom=0.0), 'stone', smooth=False)
    z = s * 0.121
    stem = [V((-s * 0.36 + s * 0.72 * i / 10, s * 0.05 * math.sin(i / 10 * math.pi) - s * 0.02, z)) for i in range(11)]
    m.add(rail(stem, [s * 0.012] * 11, seg=5), 'fern', outline=False)
    for i in range(1, 10):
        p = stem[i]
        ln = s * 0.18 * math.sin(math.pi * i / 10) + s * 0.03
        for sy in (1, -1):
            m.add(slab(oval2d(ln / 2, ln * 0.18, 10, cx=ln / 2, squeeze=0.4), origin=p, u=(0.35, sy, 0), v=(-sy, 0.35, 0), thick=0.003), 'fern', outline=False, smooth=False)


def b_shark_tooth(M):
    s = pv('size', 0.3)
    m = M.part('fossil')
    pts = spline2d([(-s * 0.32, 0), (s * 0.32, 0), (s * 0.08, s * 0.7), (0, s * 0.82), (-s * 0.06, s * 0.72)])
    m.add(slab(pts, origin=(0, 0, s * 0.18), u=(1, 0, 0), v=(0, 0, 1), thick=s * 0.12), 'tooth', smooth=False)
    m.add(jitter(ellipsoid((0, 0, s * 0.14), (s * 0.36, s * 0.08, s * 0.12), seg=14, rings=8), s * 0.01, 2), 'root')
    for i in range(7):   # 톱니
        t = i / 6
        for sx in (1, -1):
            x, z = sx * s * (0.3 - 0.27 * t), s * 0.2 + s * 0.6 * t
            m.add(cone((x, 0, z), (x + sx * s * 0.03, 0, z + s * 0.02), s * 0.02, 0.0, seg=5), 'tooth')


def b_dino_track(M):
    s = pv('size', 0.4)
    m = M.part('fossil')
    m.add(jitter(ellipsoid((0, 0, s * 0.04), (s * 0.5, s * 0.46, s * 0.09), seg=14, rings=8), s * 0.02, 5, keep_bottom=0.0), 'stone', smooth=False)
    z = s * 0.125
    heel = V((0, s * 0.14, z))
    m.add(ellipsoid(heel, (s * 0.1, s * 0.09, s * 0.012), seg=14, rings=6), 'track', outline=False)
    for a in (-0.42, 0.0, 0.42):
        d = V((math.sin(a), -math.cos(a), 0))
        pts = [heel + d * s * t for t in (0.05, 0.2, 0.33)]
        m.add(rail(pts, [s * 0.06, s * 0.05, s * 0.03], seg=10, flat=0.25, side=(0, 0, 1)), 'track', outline=False)
        m.add(cone(pts[-1], pts[-1] + d * s * 0.07, s * 0.025, 0.0, squash=0.3, seg=6), 'track', outline=False)


def b_tusk(M):
    s = pv('size', 0.5)
    m = M.part('fossil')
    pts = bezier((-s * 0.45, 0, s * 0.08), (-s * 0.1, 0, s * 0.02), (s * 0.3, 0, s * 0.12), (s * 0.42, 0, s * 0.45), 12)
    m.add(rail(pts, [s * 0.085 * (1 - 0.85 * (i / 12) ** 1.3) for i in range(13)], seg=14), 'ivory')
    for i in (1, 3, 5, 8):
        p, t = pts[i], (pts[i + 1] - pts[i]).normalized()
        r = s * 0.085 * (1 - 0.85 * (i / 12) ** 1.3)
        m.add(ellipsoid(p, (r * 1.03, r * 1.03, r * 0.12), rot=align_z(t), seg=14, rings=4), 'ivoryDark', outline=False)
    m.add(cylinder(pts[0] + V((-s * 0.02, 0, 0)), pts[0] + V((s * 0.02, 0, 0)), s * 0.088, seg=14), 'ivoryDark')


def b_dino_skull(M):
    s = pv('size', 0.42)
    m = M.part('fossil')
    cr = V((0, s * 0.12, s * 0.28))
    m.add(ellipsoid(cr, (s * 0.2, s * 0.22, s * 0.2), seg=20, rings=12), 'bone')
    snout = box((0, -s * 0.15, s * 0.24), (s * 0.24, s * 0.4, s * 0.18), bevel=s * 0.07)
    for v in snout.verts:
        if v.co.y < -s * 0.15:
            k = 1 - 0.35 * (-s * 0.15 - v.co.y) / (s * 0.2)
            v.co.x *= k
            v.co.z = s * 0.24 + (v.co.z - s * 0.24) * k
    m.add(snout, 'bone')
    jaw = box((0, -s * 0.08, s * 0.1), (s * 0.22, s * 0.46, s * 0.07), bevel=s * 0.03, rot=rot_xyz(x=-0.12))
    m.add(jaw, 'bone')
    for sx in (1, -1):
        m.add(ellipsoid((sx * s * 0.15, s * 0.1, s * 0.33), (s * 0.06, s * 0.07, s * 0.06), seg=12, rings=8), 'socket', outline=False)
        m.add(ellipsoid((sx * s * 0.11, -s * 0.07, s * 0.26), (s * 0.035, s * 0.06, s * 0.035), seg=10, rings=6), 'socket', outline=False)
        m.add(ellipsoid((sx * s * 0.08, -s * 0.3, s * 0.27), (s * 0.02, s * 0.025, s * 0.02), seg=8, rings=6), 'socket', outline=False)
        for i in range(6):
            y = -s * 0.32 + s * 0.06 * i
            m.add(cone((sx * s * 0.1, y, s * 0.16), (sx * s * 0.1, y, s * 0.1), s * 0.018, 0.0, seg=6), 'tooth')
            m.add(cone((sx * s * 0.09, y + s * 0.03, s * 0.13), (sx * s * 0.09, y + s * 0.03, s * 0.175), s * 0.015, 0.0, seg=6), 'tooth')
    m.add(jitter(ellipsoid((0, 0, s * 0.02), (s * 0.34, s * 0.42, s * 0.04), seg=12, rings=6), s * 0.01, 4, keep_bottom=0.0), 'stone', smooth=False)


def b_unknown_fossil(M):
    s = pv('size', 0.32)
    m = M.part('fossil')
    m.add(jitter(ellipsoid((0, 0, s * 0.18), (s * 0.4, s * 0.34, s * 0.22), seg=12, rings=8), s * 0.03, 7, keep_bottom=0.0), 'dirt', smooth=False)
    m.add(jitter(ellipsoid((s * 0.2, -s * 0.1, s * 0.3), (s * 0.16, s * 0.14, s * 0.12), seg=10, rings=6), s * 0.02, 8), 'dirt', smooth=False)
    a, b = V((-s * 0.12, -s * 0.12, s * 0.3)), V((-s * 0.3, -s * 0.22, s * 0.45))
    m.add(cylinder(a, b, s * 0.045, s * 0.04, seg=10), 'bone')
    for sx in (1, -1):
        m.add(ellipsoid(b + V((sx * s * 0.035, 0, s * 0.02)), (s * 0.045,) * 3, seg=10, rings=8), 'bone')
    for x, y in ((0.1, -0.25), (-0.05, -0.28), (0.25, -0.2)):
        m.add(ellipsoid((x * s, y * s, s * 0.12), (s * 0.03, s * 0.02, s * 0.03), seg=8, rings=6), 'dirtDark', outline=False)


# ================================================================ 도구 (tool) — 아이콘이 대각선으로 보이게 비스듬히 세운다
def b_rod(M):
    m = M.part('tool')
    L = 0.9
    m.add(cylinder((0, 0, 0), (0, 0, L), 0.026, 0.009, seg=12), 'wood')
    m.add(cylinder((0, 0, 0.0), (0, 0, 0.22), 0.034, 0.03, seg=12), 'grip')
    for z in (0.35, 0.55, 0.75):
        m.add(cylinder((0, 0, z - 0.01), (0, 0, z + 0.01), 0.02, seg=10), 'metal')
    rc = V((0.05, 0, 0.26))
    m.add(cylinder(rc + V((-0.02, 0, 0)), rc + V((0.02, 0, 0)), 0.05, seg=16), 'metal')
    m.add(cylinder(rc + V((0.02, 0, 0)), rc + V((0.035, 0, 0)), 0.03, seg=12), 'metalDark')
    m.add(cylinder(rc + V((0.035, 0, 0)), rc + V((0.06, 0.03, 0.03)), 0.008, seg=6), 'metalDark')
    m.add(cylinder((0.0, 0, 0.26), rc, 0.012, seg=6), 'metalDark')
    tip = V((0, 0, L))
    bob = V((0.2, 0, 0.36))
    pts = bezier(tip, tip + V((0.12, 0, -0.04)), bob + V((0.02, 0, 0.25)), bob + V((0, 0, 0.05)), 10)
    m.add(rail(pts, [0.0035] * 11, seg=4), 'line', outline=False)
    m.add(ellipsoid(bob + V((0, 0, 0.02)), (0.045, 0.045, 0.035), seg=14, rings=8), 'bobber')
    m.add(ellipsoid(bob + V((0, 0, -0.012)), (0.045, 0.045, 0.03), seg=14, rings=8), 'bobberLight')
    m.add(cylinder(bob + V((0, 0, 0.04)), bob + V((0, 0, 0.08)), 0.006, seg=6), 'metalDark')


def b_net(M):
    m = M.part('tool')
    m.add(cylinder((0, 0, 0), (0, 0, 0.62), 0.024, 0.02, seg=12), 'wood')
    m.add(cylinder((0, 0, 0), (0, 0, 0.16), 0.03, seg=12), 'grip')
    c, R = V((0, 0, 0.83)), 0.2
    ring = [c + V((math.cos(TAU * k / 32) * R, 0, math.sin(TAU * k / 32) * R)) for k in range(32)]
    m.add(tube(ring, [0.014] * 32, seg=8, closed=True), 'hoop')
    m.add(cylinder((0, 0, 0.6), (0, 0, 0.64), 0.03, seg=10), 'hoop')
    bag = ellipsoid(c + V((0, 0.12, -0.02)), (R * 0.95, 0.16, R * 0.95), seg=20, rings=12)
    for v in bag.verts:
        if v.co.y < c.y:
            v.co.y = c.y
    m.add(bag, 'net')
    for k in range(6):
        a = TAU * k / 6
        pts = [c + V((math.cos(a) * R * 0.95 * f, 0.12 * math.sin(math.pi * f / 2) * 1.3, math.sin(a) * R * 0.95 * f)) for f in (1.0, 0.7, 0.35)]
        m.add(rail(pts, [0.003] * 3, seg=4), 'netLine', outline=False)


def b_shovel(M):
    m = M.part('tool')
    m.add(cylinder((0, 0, 0.3), (0, 0, 0.95), 0.022, seg=12), 'wood')
    m.add(tube([V((math.cos(TAU * k / 24) * 0.06, 0, 0.98 + math.sin(TAU * k / 24) * 0.035)) for k in range(24)], [0.016] * 24, seg=8, closed=True), 'grip')
    m.add(cylinder((0, 0, 0.26), (0, 0, 0.36), 0.03, 0.024, seg=12), 'metalDark')
    blade = [(-0.13, 0.32), (0.13, 0.32), (0.14, 0.1), (0.07, -0.04), (0, -0.07), (-0.07, -0.04), (-0.14, 0.1)]
    bm = slab(spline2d(blade), u=(1, 0, 0), v=(0, 0, 1), thick=0.018)
    for v in bm.verts:   # 오목하게
        v.co.y += 0.05 * (v.co.x / 0.14) ** 2
    m.add(bm, 'metal', smooth=False)


def b_axe(M):
    m = M.part('tool')
    pts = bezier((0, 0, 0), (0.02, 0, 0.3), (-0.03, 0, 0.6), (0, 0, 0.82), 10)
    m.add(rail(pts, [0.026, 0.024, 0.022, 0.021, 0.02, 0.02, 0.021, 0.022, 0.023, 0.024, 0.025], seg=10), 'wood')
    m.add(cylinder((0, 0, 0.0), (0, 0, 0.14), 0.03, 0.028, seg=12), 'grip')
    head = [(-0.05, 0.07), (0.05, 0.07), (0.28, 0.17), (0.3, -0.03), (0.25, -0.22), (0.05, -0.07), (-0.05, -0.07)]
    m.add(slab(spline2d(head), origin=(0, 0, 0.76), u=(1, 0, 0), v=(0, 0, 1), thick=0.045), 'metal', smooth=False)
    m.add(slab(spline2d([(0.21, 0.14), (0.28, 0.17), (0.3, -0.03), (0.26, -0.21), (0.21, -0.15)]), origin=(0, 0, 0.76), u=(1, 0, 0), v=(0, 0, 1), thick=0.05), 'edge', outline=False, smooth=False)
    m.add(box((-0.035, 0, 0.76), (0.08, 0.055, 0.13), bevel=0.015), 'metalDark')


def b_can(M):
    m = M.part('tool')
    body = cylinder((0, 0, 0), (0, 0, 0.26), 0.15, 0.13, seg=24)
    m.add(body, 'can')
    m.add(cylinder((0, 0, 0.255), (0, 0, 0.27), 0.135, seg=24), 'canDark')
    m.add(cylinder((0, 0, -0.005), (0, 0, 0.02), 0.152, seg=24), 'canDark')
    sp = bezier((-0.1, 0, 0.06), (-0.22, 0, 0.12), (-0.3, 0, 0.22), (-0.36, 0, 0.32), 8)
    m.add(rail(sp, [0.035 - 0.015 * i / 8 for i in range(9)], seg=10), 'can')
    m.add(cylinder(sp[-1], sp[-1] + V((-0.03, 0, 0.04)), 0.025, 0.05, seg=14), 'canDark')
    hp = [V((0.05 + math.cos(a) * 0.12, 0, 0.2 + math.sin(a) * 0.14)) for a in (math.pi * (0.05 + 0.9 * k / 10) for k in range(11))]
    m.add(rail(hp, [0.017] * 11, seg=8), 'canDark')
    m.add(ellipsoid((0.0, -0.13, 0.15), (0.05, 0.02, 0.05), seg=12, rings=6), 'mark', outline=False)


# ================================================================ 재료 (mat)
def ring_marks(m, end, axis, r, mat='ring'):
    for r0 in (0.6, 0.25):
        m.add(ellipsoid(V(end), (r * r0, r * r0, 0.003), rot=align_z(axis), seg=16, rings=4), mat, outline=False)


def b_wood(M):
    m = M.part('mat')
    for (x, z, r, ln) in ((-0.085, 0.07, 0.07, 0.36), (0.085, 0.07, 0.07, 0.34), (0.0, 0.19, 0.068, 0.38)):
        a, b = V((x, -ln / 2, z)), V((x, ln / 2, z))
        m.add(cylinder(a, b, r, seg=16), lambda c, n: 'cut' if abs(n.y) > 0.7 else 'bark')
        ring_marks(m, a + V((0, -0.002, 0)), V((0, -1, 0)), r)
    m.add(capsule((0.085, 0.0, 0.135), (0.13, 0.0, 0.17), 0.012, seg=6, rings=4), 'bark')


def b_hardwood(M):
    m = M.part('mat')
    r, ln = 0.11, 0.38
    a, b = V((0, -ln / 2, r)), V((0, ln / 2, r))
    m.add(jitter(cylinder(a, b, r, seg=12), 0.006, 3), lambda c, n: 'cut' if abs(n.y) > 0.7 else 'bark', smooth=False)
    ring_marks(m, a + V((0, -0.004, 0)), V((0, -1, 0)), r * 0.95)
    for (y, ang) in ((-0.05, 0.6), (0.1, 2.2)):
        p = V((math.cos(ang) * r, y, r + math.sin(ang) * r))
        m.add(ellipsoid(p, (0.025, 0.025, 0.01), rot=align_z(p - V((0, y, r))), seg=10, rings=6), 'knot', outline=False)
    for k in range(5):
        ang = 0.3 + k * 1.1
        p0 = V((math.cos(ang) * r * 1.01, -ln * 0.4, r + math.sin(ang) * r * 1.01))
        m.add(rail([p0, p0 + V((0, ln * 0.35, 0)), p0 + V((0, ln * 0.7, 0))], [0.004] * 3, seg=4), 'knot', outline=False)


def b_branch(M):
    m = M.part('mat')
    pts = bezier((-0.22, 0.02, 0.025), (-0.08, -0.02, 0.03), (0.06, 0.03, 0.03), (0.22, 0.0, 0.025), 8)
    m.add(rail(pts, [0.022 - 0.01 * i / 8 for i in range(9)], seg=8), 'bark')
    for (t, d, ln) in ((3, (0.6, -0.8, 0.15), 0.13), (6, (0.5, 0.85, 0.2), 0.1)):
        a = pts[t]
        b = a + V(d).normalized() * ln
        m.add(rail([a, a.lerp(b, 0.5), b], [0.013, 0.01, 0.007], seg=6), 'bark')
    for c, ang in ((pts[8], 0.2), (pts[6] + V((0.05, 0.08, 0.04)), 1.0)):
        m.add(slab(oval2d(0.045, 0.022, 12, cx=0.045, squeeze=0.6), origin=c, u=(math.cos(ang), math.sin(ang), 0.25), v=(-math.sin(ang), math.cos(ang), 0), thick=0.005), 'leaf', smooth=False)


def b_stone(M):
    m = M.part('mat')
    m.add(jitter(ellipsoid((0, 0, 0.1), (0.17, 0.14, 0.11), seg=10, rings=7), 0.018, 3, keep_bottom=0.0), 'stone', smooth=False)
    m.add(jitter(ellipsoid((0.15, -0.1, 0.04), (0.07, 0.06, 0.045), seg=8, rings=5), 0.008, 4, keep_bottom=0.0), 'stone', smooth=False)
    m.add(ellipsoid((-0.04, -0.06, 0.19), (0.05, 0.035, 0.012), seg=10, rings=6), 'stoneLight', outline=False)


def b_iron(M):
    m = M.part('mat')
    m.add(jitter(ellipsoid((0, 0, 0.1), (0.17, 0.14, 0.11), seg=9, rings=6), 0.02, 9, keep_bottom=0.0), 'stone', smooth=False)
    rnd = random.Random(11)
    for _ in range(6):
        a, b = rnd.uniform(0, TAU), rnd.uniform(0.25, 1.2)
        n = V((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b)))
        c = V((0, 0, 0.1)) + V((n.x * 0.16, n.y * 0.13, n.z * 0.105))
        m.add(jitter(ellipsoid(c, (0.045, 0.045, 0.04), rot=align_z(n), seg=6, rings=4), 0.008, rnd.randint(0, 99)), 'metal', smooth=False)


def b_clay(M):
    m = M.part('mat')
    m.add(ellipsoid((0, 0, 0.07), (0.17, 0.15, 0.08), seg=18, rings=10), 'clay')
    m.add(ellipsoid((0.05, -0.03, 0.15), (0.1, 0.09, 0.05), seg=16, rings=8), 'clay')
    m.add(ellipsoid((0.17, -0.1, 0.03), (0.045, 0.04, 0.03), seg=10, rings=6), 'clay')
    m.add(ellipsoid((-0.02, -0.06, 0.19), (0.04, 0.03, 0.01), seg=10, rings=6), 'clayLight', outline=False)


def b_weed(M):
    m = M.part('mat')
    rnd = random.Random(7)
    for k in range(9):
        a = TAU * k / 9 + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(0.01, 0.05)
        base = V((math.cos(a) * r, math.sin(a) * r, 0.02))
        h = rnd.uniform(0.18, 0.3)
        tip = base + V((math.cos(a) * 0.12, math.sin(a) * 0.12, h))
        pts = bezier(base, base + V((0, 0, h * 0.5)), tip - V((math.cos(a) * 0.04, math.sin(a) * 0.04, 0)), tip, 5)
        m.add(rail(pts, [0.022 * (1 - 0.9 * i / 5) for i in range(6)], seg=6, flat=0.3, side=(-math.sin(a), math.cos(a), 0)), 'weed' if k % 3 else 'weedDark')
    m.add(ellipsoid((0, 0, 0.02), (0.07, 0.07, 0.03), seg=12, rings=6), 'soil')


def b_acorn_bag(M):
    m = M.part('mat')
    sack = ellipsoid((0, 0, 0.13), (0.15, 0.14, 0.13), seg=20, rings=12)
    for v in sack.verts:
        if v.co.z < 0.02:
            v.co.z = 0.02 + (v.co.z - 0.02) * 0.3
    m.add(sack, 'bag')
    m.add(cylinder((0, 0, 0.24), (0, 0, 0.29), 0.05, 0.07, seg=16), 'bag')
    m.add(ellipsoid((0, 0, 0.3), (0.075, 0.075, 0.025), seg=14, rings=6), 'bag')
    m.add(tube([V((math.cos(TAU * k / 20) * 0.058, math.sin(TAU * k / 20) * 0.058, 0.255)) for k in range(20)], [0.012] * 20, seg=6, closed=True), 'tie')
    c = V((0, -0.14, 0.13))
    m.add(ellipsoid(c + V((0, -0.005, -0.015)), (0.04, 0.02, 0.05), seg=12, rings=8), 'acorn')
    m.add(ellipsoid(c + V((0, -0.008, 0.03)), (0.048, 0.022, 0.025), seg=12, rings=6), 'acornCap')


# ================================================================ 씨앗·묘목 (seed)
def b_seed_bag(M):
    m = M.part('seed')
    m.add(box((0, 0, 0.17), (0.24, 0.05, 0.32), bevel=0.02), 'bag')
    m.add(box((0, 0, 0.345), (0.25, 0.055, 0.04), bevel=0.012), 'bagDark')
    m.add(box((0, -0.026, 0.15), (0.18, 0.004, 0.18), bevel=0.003), 'label', outline=False)
    c = V((0, -0.03, 0.17))
    m.add(rail([c + V((0, 0, -0.07)), c + V((0, 0, 0.0))], [0.006, 0.006], seg=5), 'leaf', outline=False)
    for k in range(5):
        a = TAU * k / 5 + math.pi / 2
        m.add(ellipsoid(c + V((math.cos(a) * 0.025, 0, math.sin(a) * 0.025 + 0.02)), (0.022, 0.004, 0.022), seg=10, rings=4), 'emblem', outline=False)
    m.add(ellipsoid(c + V((0, -0.003, 0.02)), (0.012, 0.004, 0.012), seg=8, rings=4), 'center', outline=False)
    m.add(slab(oval2d(0.025, 0.01, 10, cx=0.025, squeeze=0.5), origin=c + V((0.0, -0.002, -0.05)), u=(1, 0, 0.5), v=(0, 0, 1), thick=0.003), 'leaf', outline=False, smooth=False)
    for x, z in ((-0.06, 0.04), (0.05, 0.05), (0.0, 0.03)):
        m.add(ellipsoid((x, -0.05, z), (0.014, 0.01, 0.02), seg=8, rings=6), 'seed')


def b_sapling(M):
    m = M.part('seed')
    m.add(ellipsoid((0, 0, 0.07), (0.12, 0.12, 0.08), seg=18, rings=10), 'burlap')
    m.add(tube([V((math.cos(TAU * k / 20) * 0.1, math.sin(TAU * k / 20) * 0.1, 0.12)) for k in range(20)], [0.012] * 20, seg=6, closed=True), 'tie')
    m.add(ellipsoid((0, 0, 0.14), (0.085, 0.085, 0.02), seg=14, rings=6), 'soil')
    m.add(cylinder((0, 0, 0.12), (0, 0, 0.42), 0.022, 0.014, seg=10), 'trunk')
    m.add(rail([V((0, 0, 0.3)), V((0.06, 0, 0.36)), V((0.1, 0, 0.4))], [0.011, 0.009, 0.007], seg=6), 'trunk')
    for (x, y, z, r) in ((0, 0, 0.5, 0.11), (0.1, 0.02, 0.43, 0.075), (-0.07, -0.03, 0.44, 0.07), (0.02, -0.06, 0.56, 0.07)):
        m.add(ellipsoid((x, y, z), (r, r, r * 0.9), seg=16, rings=10), 'leaf')


def b_cedar_sapling(M):
    m = M.part('seed')
    m.add(ellipsoid((0, 0, 0.07), (0.12, 0.12, 0.08), seg=18, rings=10), 'burlap')
    m.add(tube([V((math.cos(TAU * k / 20) * 0.1, math.sin(TAU * k / 20) * 0.1, 0.12)) for k in range(20)], [0.012] * 20, seg=6, closed=True), 'tie')
    m.add(cylinder((0, 0, 0.12), (0, 0, 0.26), 0.022, 0.018, seg=10), 'trunk')
    for z, r, h in ((0.22, 0.17, 0.2), (0.35, 0.13, 0.18), (0.47, 0.09, 0.16)):
        m.add(cone((0, 0, z), (0, 0, z + h), r, 0.01, seg=18), 'leaf')


# ================================================================ 과일 (fruit)
def leaf_on(m, c, ang=0.3, size=0.05):
    m.add(slab(oval2d(size, size * 0.42, 14, cx=size, squeeze=0.6), origin=c, u=(math.cos(ang), 0, 0.45), v=(0, 1, 0), thick=0.006), 'leaf', smooth=False)


def b_fruit(M):
    m = M.part('fruit')
    shape = P.get('shape', 'apple')
    if shape == 'cherry':
        top = V((0, 0, 0.34))
        for sx in (1, -1):
            c = V((sx * 0.07, 0, 0.075))
            m.add(ellipsoid(c, (0.075, 0.075, 0.07), seg=20, rings=12), 'fruit')
            m.add(ellipsoid(c + V((-0.03, -0.05, 0.03)), (0.016, 0.01, 0.022), seg=8, rings=6), 'shine', outline=False)
            pts = bezier(c + V((0, 0, 0.06)), c + V((0, 0, 0.15)), top + V((sx * 0.03, 0, -0.05)), top, 6)
            m.add(rail(pts, [0.007] * 7, seg=6), 'stem')
        leaf_on(m, top, 0.4, 0.06)
        return
    R = {'apple': (0.14, 0.14, 0.13), 'pear': (0.12, 0.12, 0.11), 'peach': (0.14, 0.13, 0.14), 'orange': (0.14, 0.14, 0.13)}[shape]
    c = V((0, 0, R[2]))
    body = ellipsoid(c, R, seg=24, rings=14)
    for v in body.verts:
        d = v.co - c
        if shape == 'apple' and d.z > R[2] * 0.6:            # 꼭지 쪽 오목
            v.co.z -= (d.z - R[2] * 0.6) * 0.8 * (1 - (d.x * d.x + d.y * d.y) / (R[0] * R[0]))
        if shape == 'pear' and d.z > 0:
            v.co.x *= 1 - 0.45 * (d.z / R[2])
            v.co.y *= 1 - 0.45 * (d.z / R[2])
            v.co.z += d.z * 0.7
        if shape == 'peach':
            v.co.z += 0.03 * max(0, d.z / R[2]) ** 4
    m.add(body, 'fruit')
    if shape == 'peach':
        m.add(rail([c + V((0, -R[1] * 1.0, R[2] * 0.2 * k)) for k in range(-3, 5)], [0.004] * 8, seg=5), 'fruitDark', outline=False)
    if shape == 'orange':
        rnd = random.Random(5)
        for _ in range(14):
            a, b = rnd.uniform(0, TAU), rnd.uniform(-0.6, 0.9)
            n = V((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b)))
            m.add(ellipsoid(c + V((n.x * R[0], n.y * R[1], n.z * R[2])), (0.006, 0.006, 0.002), rot=align_z(n), seg=6, rings=4), 'fruitDark', outline=False)
    top = c.z + (R[2] * (1.7 if shape == 'pear' else 0.85))
    m.add(ellipsoid(c + V((-R[0] * 0.4, -R[1] * 0.6, R[2] * 0.4)), (R[0] * 0.15, R[0] * 0.08, R[0] * 0.2), rot=rot_xyz(y=-0.5), seg=8, rings=6), 'shine', outline=False)
    m.add(cylinder((0, 0, top - 0.02), (0.01, 0, top + 0.06), 0.009, 0.007, seg=8), 'stem')
    leaf_on(m, V((0.01, 0, top + 0.02)), 0.3, 0.07 if shape != 'orange' else 0.05)


def b_coconut(M):
    m = M.part('fruit')
    c = V((0, 0, 0.14))
    m.add(jitter(ellipsoid(c, (0.16, 0.15, 0.14), seg=16, rings=10), 0.006, 2), 'coconut')
    for k in range(3):
        a = TAU * k / 3 + 0.5
        m.add(ellipsoid(c + V((math.cos(a) * 0.035, -0.12 + 0.0, 0.05 + math.sin(a) * 0.035)), (0.016, 0.01, 0.016), seg=8, rings=6), 'coconutDark', outline=False)
    for k in range(10):
        a = TAU * k / 10
        p0 = c + V((math.cos(a) * 0.15, math.sin(a) * 0.14, 0.02))
        m.add(rail([p0, p0 + V((0, 0, 0.06)), c + V((math.cos(a) * 0.05, math.sin(a) * 0.05, 0.13))], [0.004] * 3, seg=4), 'coconutDark', outline=False)


# ================================================================ 조개 (shell)
def b_clam(M):
    m = M.part('shell')
    RX, RY, RZ = 0.15, 0.12, 0.06
    dome = ellipsoid((0, 0, 0.01), (RX, RY, RZ), seg=28, rings=12)
    for v in dome.verts:
        if v.co.y > 0:
            v.co.x *= 1 - 0.3 * (v.co.y / RY)
        if v.co.z < 0.01:
            v.co.z = 0.01 + (v.co.z - 0.01) * 0.4
    m.add(dome, 'shell')
    for k in range(1, 4):
        f = k / 4
        ring = []
        for j in range(24):
            y = math.sin(TAU * j / 24) * RY * f
            ring.append(V((math.cos(TAU * j / 24) * RX * f * (1 - 0.3 * max(0.0, y / RY)), y, 0.01 + RZ * math.sqrt(1 - f * f) * 1.0)))
        m.add(tube(ring, [0.004] * 24, seg=5, closed=True), 'shellRib', outline=False)
    m.add(ellipsoid((0, RY * 0.85, 0.05), (0.03, 0.02, 0.02), seg=10, rings=6), 'shellDark')
    rnd = random.Random(4)
    for _ in range(8):
        x, y = rnd.uniform(-0.6, 0.6) * RX, rnd.uniform(-0.5, 0.6) * RY
        z = 0.01 + RZ * math.sqrt(max(0, 1 - (x / RX) ** 2 - (y / RY) ** 2))
        dot_on(m, (x, y, z), V((x / RX ** 2, y / RY ** 2, (z - 0.01) / RZ ** 2)).normalized(), 0.012, 'shellDark')


def b_cowrie(M):
    m = M.part('shell')
    c = V((0, 0, 0.07))
    m.add(ellipsoid(c, (0.1, 0.15, 0.075), seg=24, rings=14), lambda cc, n: 'shell' if cc.z > 0.04 else 'shellBase')
    m.add(ellipsoid((0, 0, 0.003), (0.008, 0.12, 0.006), seg=10, rings=6), 'shellDark', outline=False)
    rnd = random.Random(6)
    for _ in range(16):
        a, b = rnd.uniform(0, TAU), rnd.uniform(0.25, 1.2)
        n = V((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b)))
        dot_on(m, c + V((n.x * 0.1, n.y * 0.15, n.z * 0.075)), n, 0.01, 'shellDark')
    m.add(ellipsoid(c + V((-0.03, -0.05, 0.065)), (0.02, 0.04, 0.008), seg=10, rings=6), 'shine', outline=False)


def b_scallop(M):
    m = M.part('shell')
    RX, RY, RZ = 0.16, 0.14, 0.05
    dome = ellipsoid((0, 0, 0.012), (RX, RY, RZ), seg=32, rings=12)
    for v in dome.verts:
        if v.co.y > 0:
            v.co.x *= 1 - 0.7 * (v.co.y / RY)
        if v.co.z < 0.012:
            v.co.z = 0.012 - (0.012 - v.co.z) * 0.3
        a = math.atan2(-v.co.y + RY, v.co.x)
        v.co.z += 0.008 * math.cos(a * 18) * max(0, (RY - v.co.y) / (2 * RY))
    m.add(dome, 'shell')
    hinge = V((0, RY * 0.95, 0))
    for k in range(9):
        a = math.pi * (0.12 + 0.76 * k / 8)
        edge = V((math.cos(a) * RX * 0.95, -math.sin(a) * RY * 0.95, 0))
        pts = []
        for i in range(9):
            p = hinge + (edge - hinge) * (i / 8)
            w = RX * (1 - 0.7 * max(0.0, p.y / RY))
            z = 0.012 + RZ * math.sqrt(max(0.0, 1 - (p.x / w) ** 2 - (p.y / RY) ** 2)) + 0.004
            pts.append(V((p.x, p.y, z)))
        m.add(rail(pts, [0.006 + 0.007 * i / 8 for i in range(9)], seg=6), 'shellRib', outline=False)
    for sx in (1, -1):
        m.add(box((sx * 0.04, RY * 0.95, 0.02), (0.06, 0.04, 0.025), bevel=0.01), 'shell')


def b_whelk(M):
    """고둥: 아래가 굵고 위로 뾰족해지는 소용돌이 탑 + 큰 입구(앞 -Y) + 아래로 뻗은 수관"""
    m = M.part('shell')
    z = 0.07
    for i in range(7):
        r = 0.1 * 0.74 ** i
        m.add(ellipsoid((0.004 * i, 0.006 * i, z), (r, r, r * 0.8), seg=18, rings=10), 'shell')
        if i:
            m.add(tube([V((0.004 * i + math.cos(TAU * k / 20) * r * 0.98, 0.006 * i + math.sin(TAU * k / 20) * r * 0.98, z - r * 0.35)) for k in range(20)],
                       [r * 0.08 + 0.002] * 20, seg=5, closed=True), 'shellDark', outline=False)
        z += r * 0.95 + 0.008
    m.add(cone((0.01, 0.0, z - 0.01), (0.012, 0.01, z + 0.03), 0.012, 0.0, seg=8), 'shell')
    m.add(cone((0, -0.02, 0.04), (0, -0.05, -0.05), 0.04, 0.012, seg=12), 'shell')
    m.add(ellipsoid((0, -0.075, 0.07), (0.05, 0.03, 0.075), seg=14, rings=8), 'shellBase')


def b_turban(M):
    """소라: 둥근 소용돌이에 뿔 돌기"""
    m = M.part('shell')
    pts, radii = [], []
    n = 40
    for i in range(n + 1):
        t = i / n
        th = t * TAU * 3.2
        r = 0.11 * (1 - t) ** 0.9 + 0.006
        pts.append(V((math.cos(th) * r * 0.85, math.sin(th) * r * 0.85, 0.1 + t * 0.2)))
        radii.append(r * 0.85 + 0.005)
    m.add(rail(pts, radii, seg=12), 'shell')
    for i in range(2, n - 6, 3):
        p, r = pts[i], radii[i]
        out = V((p.x, p.y, 0)).normalized() if V((p.x, p.y, 0)).length > 1e-4 else V((1, 0, 0))
        m.add(cone(p + out * r * 0.7 + V((0, 0, r * 0.3)), p + out * r * 1.5 + V((0, 0, r * 0.9)), r * 0.25, 0.0, seg=6), 'shellDark')
    m.add(ellipsoid((0, -0.07, 0.07), (0.055, 0.035, 0.05), seg=12, rings=8), 'shellBase')


def b_coral(M):
    m = M.part('shell')
    rnd = random.Random(12)

    def branch(a, d, ln, r, depth):
        b = a + d * ln
        m.add(rail([a, a.lerp(b, 0.5) + V((rnd.uniform(-1, 1) * ln * 0.1, rnd.uniform(-1, 1) * ln * 0.1, 0)), b], [r, r * 0.85, r * 0.7], seg=8), 'coral')
        if depth == 0:
            m.add(ellipsoid(b, (r * 0.8,) * 3, seg=8, rings=6), 'coral')
            return
        for k in (-1, 1):
            nd = (d + V((k * rnd.uniform(0.4, 0.8), rnd.uniform(-0.4, 0.4), 0.3))).normalized()
            branch(b, nd, ln * 0.72, r * 0.72, depth - 1)
    m.add(jitter(ellipsoid((0, 0, 0.02), (0.08, 0.07, 0.04), seg=10, rings=6), 0.006, 3, keep_bottom=0.0), 'coralDark')
    branch(V((0, 0, 0.03)), V((0, 0, 1)), 0.12, 0.025, 3)


# ================================================================ 꽃 (flower) — 배경 꽃(EN-06~08)과 같은 색, 아이콘용으로 잎을 더한다
def b_tulip(M):
    f = M.part('flower')
    f.add(capsule((0, 0, 0), (0, 0, 0.32), 0.012, seg=8, rings=6), 'stem')
    for sx in (1, -1):
        f.add(slab(oval2d(0.1, 0.03, 16, cx=0.1, squeeze=0.6), origin=(sx * 0.005, 0, 0.02), u=(sx * 0.35, -0.1, 1), v=(sx * -1, 0, 0.35), thick=0.006), 'stem', smooth=False)
    c = V((0, 0, 0.39))
    f.add(ellipsoid(c, (0.07, 0.07, 0.075), seg=18, rings=10), 'petal')
    for k in range(3):
        a = TAU * k / 3 + 0.5
        f.add(ellipsoid(c + V((math.cos(a) * 0.045, math.sin(a) * 0.045, 0.015)), (0.045, 0.028, 0.085), rot=rot_xyz(y=0.25, z=a), seg=14, rings=8), 'petal')


def b_cosmos(M):
    f = M.part('flower')
    stem = bezier((0, 0, 0), (0.0, 0, 0.15), (0.03, 0, 0.28), (0.02, -0.02, 0.36), 6)
    f.add(tube(stem, [0.01] * len(stem), seg=8), 'stem')
    for sx in (1, -1):
        for z in (0.1, 0.2):
            f.add(rail([V((0, 0, z)), V((sx * 0.04, -0.01, z + 0.03)), V((sx * 0.07, -0.02, z + 0.07))], [0.005, 0.004, 0.002], seg=4), 'stem')
    tilt = rot_xyz(x=0.75)
    c = V((0.02, -0.03, 0.37))
    f.add(ellipsoid(c, (0.028, 0.028, 0.018), rot=tilt, seg=12, rings=8), 'center', outline=False)
    for k in range(8):
        a = TAU * k / 8
        off = tilt @ V((math.cos(a) * 0.07, math.sin(a) * 0.07, 0))
        f.add(ellipsoid(c + off, (0.05, 0.024, 0.007), rot=tilt @ rot_xyz(z=a), seg=12, rings=6), 'petal')


def b_pansy(M):
    f = M.part('flower')
    for k in range(6):
        a = TAU * k / 6
        f.add(ellipsoid((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.035), (0.065, 0.035, 0.016), rot=rot_xyz(y=0.3, z=a), seg=12, rings=6), 'stem')
    f.add(cylinder((0, 0, 0.02), (0, -0.01, 0.12), 0.01, seg=8), 'stem')
    tilt = rot_xyz(x=1.05)
    c = V((0, -0.025, 0.15))
    for (x, z, r) in ((-0.035, 0.035, 0.045), (0.035, 0.035, 0.045), (-0.048, -0.01, 0.038), (0.048, -0.01, 0.038), (0, -0.042, 0.048)):
        f.add(ellipsoid(c + tilt @ V((x, z, 0)), (r, r, 0.009), rot=tilt, seg=14, rings=6), 'petal')
    f.add(ellipsoid(c + tilt @ V((0, -0.008, 0.006)), (0.032, 0.03, 0.006), rot=tilt, seg=12, rings=6), 'petalDark', outline=False)
    f.add(ellipsoid(c + tilt @ V((0, 0.0, 0.012)), (0.011, 0.011, 0.008), rot=tilt, seg=10, rings=6), 'center', outline=False)


# ================================================================ 5차 Z5 축제 부스에서 만드는 것 (IC-FE-01–04, 검수 보드 z5)
def b_pie(M):
    m = M.part('pie')
    m.add(cylinder((0, 0, 0), (0, 0, 0.03), 0.2, 0.21, seg=28), 'plate')
    m.add(cylinder((0, 0, 0.03), (0, 0, 0.1), 0.16, 0.18, seg=28), 'crust')
    m.add(cylinder((0, 0, 0.1), (0, 0, 0.112), 0.155, seg=28), 'filling', outline=False)
    for k in range(4):   # 격자 반죽
        x = -0.09 + 0.06 * k
        m.add(box((x, 0, 0.118), (0.025, 0.3 - abs(x) * 1.2, 0.014), bevel=0.006), 'crust')
        m.add(box((0, x, 0.122), (0.3 - abs(x) * 1.2, 0.025, 0.014), bevel=0.006), 'crust')
    m.add(tube([V((0.17 * math.cos(TAU * i / 28), 0.17 * math.sin(TAU * i / 28), 0.105)) for i in range(28)], [0.018] * 28, seg=6, closed=True), 'crust')


def b_juice(M):
    m = M.part('cup')
    m.add(cylinder((0, 0, 0), (0, 0, 0.28), 0.075, 0.09, seg=20), 'glass')
    m.add(cylinder((0, 0, 0.01), (0, 0, 0.23), 0.07, 0.083, seg=20), 'juice', outline=False)
    m.add(cylinder((0.03, 0.0, 0.16), (0.08, 0.02, 0.4), 0.009, seg=8), 'straw')
    m.add(ellipsoid((0.085, -0.02, 0.27), (0.045, 0.012, 0.045), rot=rot_xyz(y=0.6), seg=12, rings=6), 'slice')


def b_wreath(M):
    m = M.part('wreath')
    R = 0.17
    m.add(tube([V((R * math.cos(TAU * i / 32), R * math.sin(TAU * i / 32), 0.03)) for i in range(32)], [0.03] * 32, seg=8, closed=True), 'leaf')
    cols = ('petalA', 'petalB', 'petalC')
    for k in range(9):
        a = TAU * k / 9
        c = V((R * math.cos(a), R * math.sin(a), 0.06))
        for j in range(5):
            b = TAU * j / 5
            m.add(ellipsoid(c + V((0.022 * math.cos(b), 0.022 * math.sin(b), 0.0)), (0.02, 0.02, 0.012), seg=8, rings=5), cols[k % 3])
        m.add(ellipsoid(c + V((0, 0, 0.008)), (0.012, 0.012, 0.01), seg=8, rings=5), 'center', outline=False)


def b_medal(M):
    m = M.part('medal')
    for sx in (1, -1):
        m.add(box((sx * 0.04, 0.0, 0.2), (0.05, 0.012, 0.22), bevel=0.006, rot=rot_xyz(y=sx * 0.35)), 'ribbon')
    m.add(cylinder((0, 0.0, 0.0), (0, -0.03, 0.0), 0.1, seg=28), 'gold')
    m.add(cylinder((0, -0.03, 0.0), (0, -0.034, 0.0), 0.075, seg=28), 'goldLight', outline=False)
    m.add(ellipsoid((-0.01, -0.038, 0.0), (0.04, 0.006, 0.022), seg=12, rings=6), 'fish')
    m.add(cone((0.03, -0.038, 0.0), (0.06, -0.038, 0.0), 0.02, 0.0, squash=0.3, seg=6), 'fish')


def b_petal(M):
    """IC-EV-01 벚꽃잎 (8차 봄 꽃놀이 채집): 바닥에 겹쳐 놓인 꽃잎 석 장. 꽃잎 하나 = 살짝 벌어진 두 갈래 (끝에 벚꽃잎 홈) + 뿌리 쪽 진한 점."""
    m = M.part('petal')
    for k, (x, y, a, z) in enumerate(((0, 0, 0.3, 0.01), (0.075, 0.05, 1.5, 0.024), (-0.07, 0.04, -1.1, 0.038))):
        d, side = V((math.cos(a), math.sin(a), 0)), V((-math.sin(a), math.cos(a), 0))
        col = 'petalLight' if k == 1 else 'petal'
        for sgn in (1, -1):   # 두 갈래: 끝으로 갈수록 벌어진다
            c = V((x, y, z)) + d * 0.018 + side * sgn * 0.018
            m.add(ellipsoid(c, (0.062, 0.03, 0.009), rot=rot_xyz(z=a + sgn * 0.32), seg=16, rings=6), col)
        m.add(ellipsoid(V((x, y, z + 0.006)) - d * 0.03, (0.016, 0.012, 0.004), rot=rot_xyz(z=a), seg=8, rings=4), 'notch', outline=False)


def b_sparkler(M):
    """IC-EV-02 손 불꽃 (8차 여름 불꽃놀이): 손잡이 쪽은 맨 철사, 위쪽은 회색 화약이 입혀진 가는 막대. 끝에서 별 모양 불티가 튄다."""
    m = M.part('sparkler')
    m.add(cylinder((0, 0, 0), (0, 0, 0.16), 0.006, seg=8), 'wire')
    m.add(cylinder((0, 0, 0.16), (0, 0, 0.36), 0.012, 0.01, seg=10), 'coat')
    m.add(ellipsoid((0, 0, 0.375), (0.03, 0.03, 0.03), seg=14, rings=8), 'spark', outline=False)
    for k in range(10):   # 불티 가지
        a, up = TAU * k / 10, 0.4 * ((k % 3) - 1)
        d = V((math.cos(a), math.sin(a) * 0.4, up)).normalized()
        c = V((0, 0, 0.375))
        m.add(cylinder(c + d * 0.03, c + d * (0.075 + 0.02 * (k % 2)), 0.004, 0.0015, seg=5), 'spark', outline=False)
        m.add(ellipsoid(c + d * (0.085 + 0.02 * (k % 2)), (0.007, 0.007, 0.007), seg=6, rings=4), 'sparkTip', outline=False)


def b_mushroom(M):
    """IC-EV-03 버섯 (8차 가을 수확 잔치 채집): 통통한 대에 둥근 갓, 갓 위 점. 모양 하나에 색 변형 셋 = 표고 · 꾀꼬리 · 빨간 버섯."""
    m = M.part('mushroom')
    m.add(cylinder((0, 0, 0), (0, 0, 0.13), 0.055, 0.045, seg=14), 'stem')
    m.add(ellipsoid((0, 0, 0.14), (0.13, 0.13, 0.08), seg=22, rings=12), lambda c, n: 'cap' if n.z > -0.2 else 'gill')
    for k in range(5):
        a = TAU * k / 5 + 0.3
        r = 0.07 if k else 0.0
        m.add(ellipsoid((math.cos(a) * r, math.sin(a) * r, 0.212 - (0.012 if k else 0)), (0.022, 0.022, 0.008), seg=8, rings=4), 'dot', outline=False)
    m.add(cylinder((0.12, 0.05, 0), (0.12, 0.05, 0.07), 0.03, 0.025, seg=10), 'stem')
    m.add(ellipsoid((0.12, 0.05, 0.075), (0.065, 0.065, 0.04), seg=16, rings=8), 'cap')


def b_snow_crystal(M):
    """IC-EV-04 눈 결정 (8차 겨울 눈사람 날): 여섯 갈래 눈 결정, 갈래마다 잔가지 둘. 가운데 육각 판. 얼음빛."""
    m = M.part('crystal')
    m.add(cylinder((0, 0, 0), (0, 0, 0.02), 0.045, seg=6), 'ice')
    for k in range(6):
        a = TAU * k / 6
        d, s = V((math.cos(a), math.sin(a), 0)), V((-math.sin(a), math.cos(a), 0))
        m.add(box(d * 0.1 + V((0, 0, 0.01)), (0.2, 0.022, 0.016), bevel=0.004, rot=rot_xyz(z=a)), 'ice')
        for t, ln in ((0.09, 0.05), (0.15, 0.035)):
            for sg in (1, -1):
                c = d * t + (d * 0.5 + s * sg * 0.87) * ln * 0.5
                m.add(box(c + V((0, 0, 0.01)), (ln, 0.016, 0.014), bevel=0.003, rot=rot_xyz(z=a + sg * 1.05)), 'iceLight')
        m.add(ellipsoid(d * 0.205 + V((0, 0, 0.01)), (0.014, 0.014, 0.01), seg=8, rings=4), 'iceLight', outline=False)


# ================================================================ 12차 밤 야시장 먹거리 (IC-NT-01–04)
def fish_bread(m, c, s=1.0, z_rot=0.0):
    """붕어빵 하나: 납작한 물고기 몸 + 꼬리 + 등지느러미, 윗면에 비늘 자국과 눈 (머리 = -X)"""
    R = rot_xyz(z=z_rot)
    c = V(c)
    m.add(ellipsoid(c, (0.15 * s, 0.075 * s, 0.035 * s), rot=R, seg=24, rings=12), 'bread')
    tail = c + R @ V((0.15 * s, 0, 0))
    for sg in (1, -1):
        m.add(ellipsoid(tail + R @ V((0.04 * s, sg * 0.035 * s, 0)), (0.05 * s, 0.03 * s, 0.022 * s), rot=R @ rot_xyz(z=sg * 0.6), seg=14, rings=8), 'bread')
    m.add(ellipsoid(c + R @ V((0.02 * s, 0.07 * s, 0)), (0.06 * s, 0.022 * s, 0.018 * s), rot=R, seg=12, rings=6), 'bread')   # 지느러미
    m.add(ellipsoid(c + R @ V((0.02 * s, -0.07 * s, 0)), (0.06 * s, 0.022 * s, 0.018 * s), rot=R, seg=12, rings=6), 'bread')
    for i in range(3):   # 비늘 자국 (윗면 위 갈색 반달)
        for j in (-1, 0, 1):
            p = c + R @ V(((-0.02 + 0.045 * i) * s, j * 0.032 * s, 0.031 * s))
            m.add(ellipsoid(p, (0.014 * s, 0.018 * s, 0.006 * s), rot=R, seg=8, rings=4), 'breadDark', outline=False)
    m.add(ellipsoid(c + R @ V((-0.1 * s, -0.025 * s, 0.026 * s)), (0.011 * s, 0.011 * s, 0.008 * s), seg=8, rings=4), 'eye', outline=False)
    m.add(ellipsoid(c + R @ V((-0.142 * s, 0, 0.004 * s)), (0.014 * s, 0.03 * s, 0.01 * s), rot=R, seg=8, rings=4), 'breadDark', outline=False)   # 입


def b_bungeoppang(M):
    """IC-NT-01 붕어빵: 종이 봉투에 하나 꽂혀 있고, 앞에 하나 누워 있다"""
    m = M.part('bread')
    fish_bread(m, (0.02, -0.04, 0.035), 1.0, z_rot=0.15)
    bag = M.part('bag')
    bag.add(box((0.05, 0.12, 0.11), (0.22, 0.07, 0.22), bevel=0.01), 'paper')
    b2 = M.part('bread2')
    fish_bread(b2, V((0.0, 0.0, 0.0)), 0.9)
    # 봉투에 꽂힌 붕어빵: 머리를 위로 세운다
    for v in b2.bm.verts:
        x, y, z = v.co
        v.co = V((0.05 + y * 0.6, 0.12 - z, 0.2 - x))


def b_moon_tteok(M):
    """IC-NT-02 달떡: 나무 접시 위 둥근 떡 셋 (하나는 노란 고물), 잎 한 장"""
    m = M.part('tteok')
    m.add(cylinder((0, 0, 0), (0, 0, 0.025), 0.2, 0.22, seg=28), 'plate')
    m.add(cylinder((0, 0, 0.024), (0, 0, 0.03), 0.18, seg=28), 'plate')
    m.add(ellipsoid((0.04, 0.06, 0.04), (0.12, 0.055, 0.008), rot=rot_xyz(z=0.5), seg=14, rings=6), 'leaf')
    for (x, y, mat) in ((-0.07, -0.03, 'rice'), (0.07, -0.04, 'crumb'), (0.0, 0.07, 'rice')):
        m.add(ellipsoid((x, y, 0.075), (0.075, 0.075, 0.05), seg=22, rings=12), mat)
    m.add(ellipsoid((-0.1, -0.06, 0.1), (0.018, 0.01, 0.01), seg=8, rings=4), 'crumb', outline=False)


def b_cocoa(M):
    """IC-NT-03 따뜻한 코코아: 둥근 머그 · 손잡이 · 마시멜로 둘 · 김 두 줄기"""
    m = M.part('mug')
    m.add(cylinder((0, 0, 0), (0, 0, 0.2), 0.09, 0.1, seg=24), 'mug')
    m.add(cylinder((0, 0, 0.17), (0, 0, 0.196), 0.088, seg=24), 'cocoa', outline=False)
    hp = [V((0.095 + 0.055 * math.sin(math.pi * t), 0, 0.04 + 0.12 * t)) for t in (i / 10 for i in range(11))]
    m.add(tube(hp, [0.016] * 11, seg=8), 'mug')
    for x, y in ((-0.03, -0.02), (0.03, 0.03)):
        m.add(box((x, y, 0.205), (0.05, 0.05, 0.035), bevel=0.014, rot=rot_xyz(z=x * 10)), 'marsh')
    for k, x in enumerate((-0.03, 0.035)):
        pts = [V((x + 0.025 * math.sin(4 * t + k), 0.0, 0.25 + 0.16 * t)) for t in (i / 8 for i in range(9))]
        m.add(tube(pts, [0.012 * (1 - 0.6 * i / 8) for i in range(9)], seg=6), 'steam', outline=False)


def star_bm(c, r, thick, rot=None, points=5, inner=0.5):
    """납작한 별 (면이 위를 본다)"""
    bm = bmesh.new()
    top, bot = [], []
    for k in range(points * 2):
        a = math.pi / 2 + math.pi * k / points
        rr = r if k % 2 == 0 else r * inner
        top.append(bm.verts.new(V((math.cos(a) * rr, math.sin(a) * rr, thick / 2))))
        bot.append(bm.verts.new(V((math.cos(a) * rr, math.sin(a) * rr, -thick / 2))))
    ct, cb = bm.verts.new(V((0, 0, thick / 2 + r * 0.15))), bm.verts.new(V((0, 0, -thick / 2 - r * 0.15)))
    n = len(top)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new([ct, top[k], top[j]])
        bm.faces.new([cb, bot[j], bot[k]])
        bm.faces.new([top[k], bot[k], bot[j], top[j]])
    M4 = Matrix.Translation(V(c)) @ (rot.to_4x4() if rot is not None else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=M4, verts=bm.verts)
    return bm


def b_star_candy(M):
    """IC-NT-04 별사탕: 둥근 유리병에 알록달록 작은 별사탕 (병 앞면은 비워 사탕이 보이게), 목에 리본, 앞에 몇 알 흘림"""
    m = M.part('jar')
    cols = ('candyA', 'candyB', 'candyC', 'candyD')
    rnd = random.Random(7)
    for k in range(26):   # 병 안 사탕 (아래부터 쌓임)
        a, r = rnd.uniform(0, TAU), 0.075 * math.sqrt(rnd.random())
        z = 0.03 + 0.11 * (k / 26) + rnd.uniform(0, 0.02)
        m.add(ellipsoid((math.cos(a) * r, math.sin(a) * r, z), (0.024, 0.024, 0.022), seg=8, rings=5), cols[k % 4])
        for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1)):   # 별사탕 돌기
            p = V((math.cos(a) * r, math.sin(a) * r, z)) + V(d) * 0.022
            m.add(ellipsoid(p, (0.008, 0.008, 0.008), seg=6, rings=3), cols[k % 4], outline=False)
    glass = M.part('glass')
    gb = ellipsoid((0, 0, 0.1), (0.11, 0.11, 0.105), seg=28, rings=16)
    bmesh.ops.delete(gb, geom=[f for f in gb.faces if f.calc_center_median().y < -0.03 and f.calc_center_median().z > 0.02], context='FACES')   # 앞을 열어 속이 보이게
    glass.add(gb, 'jar', outline=False)
    glass.add(cylinder((0, 0, 0.19), (0, 0, 0.24), 0.05, seg=18), 'jar')
    glass.add(cylinder((0, 0, 0.2), (0, 0, 0.225), 0.056, seg=18), 'lid')
    for sg in (1, -1):   # 리본 고리
        glass.add(ellipsoid((sg * 0.05, -0.04, 0.215), (0.035, 0.012, 0.022), rot=rot_xyz(y=sg * 0.4), seg=10, rings=6), 'lid')
    for k, (x, y) in enumerate(((0.12, -0.08), (0.16, -0.02), (-0.13, -0.09))):
        glass.add(star_bm((x, y, 0.014), 0.026, 0.014, rot=rot_xyz(z=k)), cols[k])


BUILDERS = {
    'bungeoppang': b_bungeoppang, 'moon-tteok': b_moon_tteok, 'cocoa': b_cocoa, 'star-candy': b_star_candy,
    'snow-crystal': b_snow_crystal,
    'mushroom': b_mushroom,
    'sparkler': b_sparkler,
    'petal': b_petal,
    'pie': b_pie, 'juice': b_juice, 'wreath': b_wreath, 'medal': b_medal,
    'fish': b_fish, 'flatfish': b_flatfish, 'squid': b_squid, 'octopus': b_octopus, 'seahorse': b_seahorse,
    'butterfly': b_butterfly, 'dragonfly': b_dragonfly, 'bee': b_bee, 'firefly': b_firefly, 'beetle': b_beetle, 'cicada': b_cicada,
    'hopper': b_hopper, 'ant': b_ant, 'snail': b_snail, 'pillbug': b_pillbug, 'skater': b_skater, 'caterpillar': b_caterpillar, 'earwig': b_earwig,
    'ammonite': b_ammonite, 'trilobite': b_trilobite, 'amber': b_amber, 'fern-fossil': b_fern_fossil, 'shark-tooth': b_shark_tooth,
    'dino-track': b_dino_track, 'tusk': b_tusk, 'dino-skull': b_dino_skull, 'unknown-fossil': b_unknown_fossil,
    'rod': b_rod, 'net': b_net, 'shovel': b_shovel, 'axe': b_axe, 'can': b_can,
    'wood': b_wood, 'hardwood': b_hardwood, 'branch': b_branch, 'stone': b_stone, 'iron': b_iron, 'clay': b_clay, 'weed': b_weed, 'acorn-bag': b_acorn_bag,
    'seed-bag': b_seed_bag, 'sapling': b_sapling, 'cedar-sapling': b_cedar_sapling,
    'fruit': b_fruit, 'coconut': b_coconut,
    'clam': b_clam, 'cowrie': b_cowrie, 'scallop': b_scallop, 'whelk': b_whelk, 'turban': b_turban, 'coral': b_coral,
    'tulip': b_tulip, 'cosmos': b_cosmos, 'pansy': b_pansy,
}

# 렌더 방향 (스펙 render 칸이 없을 때): 물고기는 옆모습(머리 왼쪽), 곤충은 위에서 비스듬히
RENDER = {'fish': (-72, 14), 'bug': (160, 55), 'fossil': (-30, 35), 'tool': (-8, 10), 'mat': (-30, 30), 'seed': (-25, 18),
          'fruit': (-25, 18), 'shell': (-25, 45), 'flower': (-20, 14), 'festival': (-25, 32), 'event': (-25, 50), 'night': (-25, 32)}
KIND_RENDER = {'butterfly': (165, 68), 'dragonfly': (165, 66), 'bee': (150, 45)}


def build(palette, suffix=''):
    M = Model(SLUG, palette, suffix)
    BUILDERS[KIND](M)
    M.finish(scene)
    pose = spec.get('pose', {})
    M.root.rotation_euler = (math.radians(pose.get('x', 0)), math.radians(pose.get('y', 0)), math.radians(pose.get('z', 0)))
    M.root.scale = (P.get('scale', 1.0),) * 3
    bpy.context.view_layer.update()
    lo, hi = world_bounds(list(M.objects.values()))
    c = (lo + hi) / 2                  # 원점 맞추기: 들어 보이는 것은 한가운데, 나머지는 바닥 가운데
    M.root.location = -V((c.x, c.y, c.z if HOLD else lo.z))
    bpy.context.view_layer.update()
    return M


# ================================================================ 만들기 · 내보내기
scene = reset_scene()
main = build(PAL)
objects = list(main.objects.values())

glb_path = os.path.join(OUT['models'], SLUG + '.glb')
for o in scene.objects:
    o.select_set(o in objects or o is main.root)
bpy.context.view_layer.objects.active = main.root
try:
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=True, export_apply=False,
                              export_animations=False, export_yup=True)
except TypeError as e:
    print('[build] 일부 내보내기 옵션을 지원하지 않아 기본값으로 다시 시도:', e)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=True)

lo, hi = world_bounds(objects)
size = hi - lo
tris = 0
for o in objects:
    o.data.calc_loop_triangles()
    tris += len(o.data.loop_triangles)
stats = {
    'id': spec['id'], 'slug': SLUG, 'name': spec['name'], 'group': spec['group'], 'kind': KIND, 'version': spec.get('version'),
    'items': [x['item'] for x in spec.get('items', [])], 'hold': HOLD,
    'triangles': tris, 'parts': len(objects), 'materials': sorted({m.name for o in objects for m in o.data.materials}),
    'objects': sorted(main.objects.keys()),
    'size': [round(size.x, 3), round(size.y, 3), round(size.z, 3)],
    'bounds': [[round(lo.x, 3), round(lo.y, 3), round(lo.z, 3)], [round(hi.x, 3), round(hi.y, 3), round(hi.z, 3)]],
    'glbBytes': os.path.getsize(glb_path), 'blender': bpy.app.version_string,
}


# ================================================================ 렌더 (아이콘)
def frame(cam, target, objs, yaw_deg, pitch_deg, margin=1.1):
    """정사영 카메라를 yaw·pitch 방향에 두고, 꼭짓점을 화면에 비춰 꽉 차게 맞춘다."""
    yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
    d = V((-math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    fwd = -d
    right = fwd.cross(V((0, 0, 1))).normalized()
    up = right.cross(fwd).normalized()
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    xs, ys = [p.dot(right) for p in pts], [p.dot(up) for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    mid = sum(pts, V((0, 0, 0))) / len(pts)
    center = right * cx + up * cy + fwd * mid.dot(fwd)
    target.location = center
    cam.location = center + d * 20.0
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(max(xs) - min(xs), max(ys) - min(ys)) * margin
    cam.data.clip_end = 200


if DO_RENDER:
    R = lambda name: os.path.join(OUT['renders'], f'{SLUG}_{name}.png')
    FLAT = {'eye', 'eyeHighlight', 'glow'} | set(spec.get('style', {}).get('flat', []))
    # 아이콘 외곽선 굵기는 모델 크기에 맞춘다 (작은 조개도 큰 낚싯대도 썸네일에서 같은 굵기로 보이게)
    width = spec.get('style', {}).get('renderOutline') or max(size.length * 0.009, 0.0015)
    for m in list(bpy.data.materials):
        if 'hex' in m:
            toonify(m, flat=m.name.split('@')[0] in FLAT)
    add_outlines(scene, objects, width)
    cam, target = setup_render(scene)
    yaw, pitch = KIND_RENDER.get(KIND, RENDER[spec['group']])
    yaw, pitch = spec.get('render', {}).get('yaw', yaw), spec.get('render', {}).get('pitch', pitch)
    frame(cam, target, objects, yaw, pitch)
    shot(scene, R('main'), 480, 480)
    thumbnail(R('main'), R('thumb'), 200)
    # 색 변형: 같은 자리에 변형 색으로 다시 만들어 변형마다 썸네일
    variants = list(spec.get('variants', {}).items())
    if variants:
        main.root.location = V(main.root.location) + V((10000, 0, 0))
        for key, var in variants:
            vm = build({**PAL, **var.get('palette', {})}, suffix='@' + key)
            for mat in bpy.data.materials:
                if mat.name.endswith('@' + key) and 'hex' in mat:
                    toonify(mat, flat=mat.name.split('@')[0] in FLAT)
            vobjs = list(vm.objects.values())
            add_outlines(scene, vobjs, width)
            frame(cam, target, vobjs, yaw, pitch)
            shot(scene, R(f'{key}_main'), 480, 480)
            thumbnail(R(f'{key}_main'), R(f'{key}_thumb'), 200)
            for o in list(vm.root.children_recursive) + [vm.root]:
                bpy.data.objects.remove(o, do_unlink=True)
        main.root.location = V(main.root.location) - V((10000, 0, 0))

blend_path = os.path.join(OUT['blender'], SLUG + '.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
stats['renders'] = sorted(f for f in os.listdir(OUT['renders']) if f.startswith(SLUG + '_'))
json.dump(stats, open(os.path.join(OUT['models'], SLUG + '.stats.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('[build] 완료:', json.dumps({k: stats[k] for k in ('slug', 'triangles', 'size')}, ensure_ascii=False))
