"""가구 빌더: assets/furniture/specs/<slug>.json → .blend / .glb / 렌더 / 통계

실행:  blender -b --factory-startup --python build_furniture.py -- <spec.json> <assets_dir> [--no-render]
(보통은 tools/build-furniture.mjs 로 실행한다)

배경 빌더(build_env.py)와 같은 toonkit 도구·재질 규칙을 쓴다. 스펙의 kind 가 BUILDERS 중 어떤 함수로 만들지 정한다.
좌표계: Blender Z-up, 정면 = -Y. 1.0 = 게임 타일 1칸 (캐릭터 키 ≈ 1.0).
바닥 가구는 원점 = 발자국(footprint) 가운데 바닥. 벽·창문 가구는 원점 = 벽면 바닥 (뒤 +Y 가 벽, 앞 -Y 로 나온다).
게임은 외곽선을 재질 이름으로 뺀다(style.noOutline) → 여기서도 같은 이름은 렌더 외곽선을 뺀다.
"""
import bpy, bmesh, json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import toonkit
from toonkit import (V, Model, add_outlines, aim, align_z, bezier, box, capsule, cone, cylinder, ellipsoid, jitter,
                     reset_scene, rot_xyz, setup_render, shot, thumbnail, toonify, world_bounds)

args = sys.argv[sys.argv.index('--') + 1:]
SPEC_PATH, ASSETS = os.path.abspath(args[0]), os.path.abspath(args[1])
DO_RENDER = '--no-render' not in args
spec = json.load(open(SPEC_PATH, encoding='utf-8'))
SLUG, KIND = spec['slug'], spec['kind']
P = {k: v['value'] for k, v in spec.get('params', {}).items()}
PAL = spec['palette']
OUT = {k: os.path.join(ASSETS, 'furniture', k) for k in ('models', 'renders', 'blender')}
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


# ================================================================ 도형 도우미
def annulus(center, r_in, r_out, axis=(0, 0, 1), thick=0.004, seg=32):
    """납작한 고리 (나이테·무늬 줄). axis 쪽으로 thick 만큼 두께가 있는 닫힌 도형."""
    bm = bmesh.new()
    R = align_z(V(axis))
    c = V(center)
    rings = []
    for z in (0.0, thick):
        for r in (r_out, r_in):
            rings.append([bm.verts.new(c + R @ V((math.cos(TAU * k / seg) * r, math.sin(TAU * k / seg) * r, z))) for k in range(seg)])
    bo, bi, to, ti = rings
    for k in range(seg):
        j = (k + 1) % seg
        bm.faces.new([to[k], to[j], ti[j], ti[k]])
        bm.faces.new([bo[k], bi[k], bi[j], bo[j]])
        bm.faces.new([bo[k], bo[j], to[j], to[k]])
        bm.faces.new([bi[k], ti[k], ti[j], bi[j]])
    return bm


def rail(points, radii, seg=10, flat=1.0, side=None):
    """점들을 따라가는 관. 방향이 위아래로 크게 꺾여도 단면이 뒤틀리지 않게 앞 단면을 이어서 돌린다.
    flat < 1 이면 납작한 띠 — side 방향(첫 단면 기준)이 넓은 쪽이 된다 (잎사귀를 눕힐 때)."""
    pts = [V(p) for p in points]
    n = len(pts)
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


def scallop(center, w, h, d=0.012, rot=None):
    """부채꼴 조개 (앞 -Y 를 본다). 위쪽(경첩)으로 갈수록 좁아진다."""
    from mathutils import Matrix
    bm = ellipsoid((0, 0, 0), (w, d, h), seg=16, rings=10)
    for v in bm.verts:
        if v.co.z > 0:
            v.co.x *= 1 - 0.55 * (v.co.z / h)
    M = Matrix.Translation(V(center)) @ (rot.to_4x4() if rot is not None else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm


def log(m, a, b, r, rings=(True, True), seg=24, side='bark', cut='wood'):
    """통나무 토막: 옆면 껍질, 자른 면 + 나이테 두 줄"""
    a, b = V(a), V(b)
    ax = (b - a).normalized()
    m.add(cylinder(a, b, r, seg=seg), lambda c, n: cut if abs(n.dot(ax)) > 0.7 else side)
    for end, out, on in ((a, -ax, rings[0]), (b, ax, rings[1])):
        if on:
            for r0, r1 in ((0.56, 0.65), (0.2, 0.28)):
                m.add(annulus(end, r * r0, r * r1, axis=out, thick=0.003, seg=seg), 'ring')


def side_table(m, top_z=0.5, w=0.6, d=0.5):
    """작은 협탁 (라디오·사진 받침)"""
    m.add(box((0, 0, top_z), (w, d, 0.05), bevel=0.018), 'wood')
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * (w / 2 - 0.06), sy * (d / 2 - 0.06), top_z / 2), (0.05, 0.05, top_z), bevel=0.012), 'woodDark')
    m.add(box((0, 0, 0.15), (w - 0.1, d - 0.1, 0.03), bevel=0.01), 'woodDark')


def glints(m, x, y, z, h=0.22):
    """유리 앞면 반짝임 두 줄"""
    m.add(box((x, y, z), (0.022, 0.004, h), bevel=0.002, rot=rot_xyz(y=0.55)), 'glint')
    m.add(box((x + 0.06, y, z + 0.02), (0.014, 0.004, h * 0.55), bevel=0.002, rot=rot_xyz(y=0.55)), 'glint')


def glass_frame(m, W, D, z0, z1, mat='frame', t=0.028):
    """유리 상자의 테두리만 (앞 유리는 비워 안이 보이게)"""
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * W / 2, sy * D / 2, (z0 + z1) / 2), (t, t, z1 - z0), bevel=0.006), mat)
    for z in (z0 + t / 2, z1 - t / 2):
        for sy in (1, -1):
            m.add(box((0, sy * D / 2, z), (W + t, t, t), bevel=0.006), mat)
        for sx in (1, -1):
            m.add(box((sx * W / 2, 0, z), (t, D + t, t), bevel=0.006), mat)


# ================================================================ 통나무 가구
def b_log_chair(M):
    sh = 0.42 * P.get('seatHeight', 1)
    m = M.part('chair')
    log(m, (0, -0.03, 0), (0, -0.03, sh), 0.26, rings=(False, True))
    for sx in (1, -1):   # 등받이 기둥 (앉는 통나무 뒤에 붙는다)
        m.add(cylinder((sx * 0.15, 0.17, 0.1), (sx * 0.15, 0.2, sh + 0.33), 0.045, 0.04, seg=10), 'bark')
    log(m, (-0.27, 0.21, sh + 0.35), (0.27, 0.21, sh + 0.35), 0.075, seg=16)
    sp = V((0.19, -0.21, sh * 0.62))   # 옆에 돋은 새싹
    m.add(cylinder(sp, sp + V((0.06, -0.05, 0.08)), 0.012, seg=6), 'leaf')
    m.add(ellipsoid(sp + V((0.1, -0.07, 0.1)), (0.06, 0.026, 0.012), rot=rot_xyz(y=-0.5, z=0.7), seg=12, rings=6), 'leaf')
    m.add(ellipsoid(sp + V((0.03, -0.1, 0.1)), (0.045, 0.02, 0.01), rot=rot_xyz(y=0.6, z=-0.5), seg=12, rings=6), 'leaf')


def b_log_table(M):
    r = 0.82 * P.get('topSize', 1)
    m = M.part('table')
    log(m, (0, 0, 0.6), (0, 0, 0.72), r, rings=(False, True), seg=40)
    m.add(annulus((0, 0, 0.72), r * 0.8, r * 0.85, thick=0.003, seg=40), 'ring')
    m.add(cylinder((0, 0, 0), (0, 0, 0.61), 0.2, 0.16, seg=18), 'bark')
    for k in range(4):   # 뿌리 넷
        a = TAU * k / 4 + 0.4
        d = V((math.cos(a), math.sin(a), 0))
        m.add(capsule(d * 0.08 + V((0, 0, 0.22)), d * 0.36 + V((0, 0, 0.06)), 0.06, seg=10, rings=6), 'bark')


def b_woodpile(M):
    m = M.part('pile')
    rnd = random.Random(3)
    r = 0.125
    for sy in (1, -1):   # 받침목
        m.add(box((0, sy * 0.22, 0.03), (0.84, 0.08, 0.06), bevel=0.015), 'bark')
    z0 = 0.06 + r
    rows = [(-2 * r - 0.01, z0), (0, z0), (2 * r + 0.01, z0),
            (-r - 0.005, z0 + 0.215), (r + 0.005, z0 + 0.215), (0, z0 + 0.43)]
    for x, z in rows:
        dy = rnd.uniform(-0.04, 0.04)
        log(m, (x, -0.34 + dy, z), (x, 0.34 + dy, z), r * rnd.uniform(0.94, 1.0), seg=18)
    for sx in (1, -1):   # 옆 말뚝
        m.add(cylinder((sx * 0.42, 0, 0), (sx * 0.42, 0, 0.58), 0.035, 0.03, seg=10), 'bark')


def b_campfire(M):
    m = M.part('fire')
    for k in range(9):
        a = TAU * k / 9
        m.add(jitter(ellipsoid((math.cos(a) * 0.33, math.sin(a) * 0.33, 0.05), (0.09, 0.08, 0.07), seg=8, rings=5), 0.012, k, keep_bottom=0.0), 'rock', smooth=False)
    for k in range(3):
        a = TAU * k / 3
        d = V((math.cos(a), math.sin(a), 0))
        m.add(capsule(d * 0.24 + V((0, 0, 0.04)), -d * 0.05 + V((0, 0, 0.16)), 0.045, seg=10, rings=6), 'bark')
    flame = M.part('flame', pivot=(0, 0, 0.08))
    flame.add(cone((0, 0, 0.08), (0, 0, 0.55), 0.15, 0.0, seg=12), 'flame')
    flame.add(cone((0, -0.03, 0.08), (0, -0.03, 0.36), 0.08, 0.0, seg=10), 'flameCore')


# ================================================================ 침대·소파·옷장·책장
def b_wood_bed(M):
    m = M.part('bed')
    L, W = 2.7, 1.6
    hy = L / 2
    m.add(box((0, 0, 0.24), (W, L, 0.18), bevel=0.04), 'frame')
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * (W / 2 - 0.06), sy * (hy - 0.06), 0.08), (0.12, 0.12, 0.16), bevel=0.02), 'frameDark')
    m.add(box((0, -0.04, 0.42), (W - 0.1, L - 0.2, 0.2), bevel=0.07), 'sheet')
    # 머리판 (+Y, 벽 쪽)
    m.add(box((0, hy - 0.02, 0.68), (W + 0.04, 0.1, 0.9), bevel=0.04), 'frame')
    m.add(capsule((-(W / 2 + 0.02), hy - 0.02, 1.12), (W / 2 + 0.02, hy - 0.02, 1.12), 0.065, seg=12, rings=6), 'frameDark')
    for sx in (1, -1):
        m.add(box((sx * (W / 2 + 0.02), hy - 0.02, 0.6), (0.14, 0.15, 1.2), bevel=0.04), 'frameDark')
        m.add(ellipsoid((sx * (W / 2 + 0.02), hy - 0.02, 1.24), (0.09, 0.09, 0.07), seg=14, rings=8), 'frameDark')
    # 발판 (-Y)
    m.add(box((0, -hy + 0.03, 0.42), (W + 0.04, 0.08, 0.42), bevel=0.03), 'frame')
    for sx in (1, -1):
        m.add(box((sx * (W / 2 + 0.02), -hy + 0.03, 0.36), (0.13, 0.13, 0.72), bevel=0.04), 'frameDark')
    m.add(ellipsoid((0, hy - 0.42, 0.6), (0.52, 0.22, 0.1), seg=24, rings=12), 'pillow')
    # 이불: 발 쪽 2/3 를 덮고 양옆으로 늘어진다
    by0, by1 = -hy + 0.12, 0.42
    bl, bc = by1 - by0, (by0 + by1) / 2
    m.add(box((0, bc, 0.54), (W - 0.02, bl, 0.07), bevel=0.03), 'blanket')
    for sx in (1, -1):
        m.add(box((sx * (W / 2 - 0.02), bc, 0.42), (0.05, bl, 0.26), bevel=0.02), 'blanket')
    m.add(box((0, by1 - 0.06, 0.58), (W - 0.02, 0.17, 0.05), bevel=0.02), 'stripe')     # 접어 올린 끝
    for y in (bc - 0.45, bc - 0.05):
        m.add(box((0, y, 0.576), (W - 0.04, 0.12, 0.012), bevel=0.004), 'stripe')


def b_sofa(M):
    m = M.part('sofa')
    W, D = 1.8, 0.84
    m.add(box((0, 0.02, 0.26), (W - 0.1, D - 0.04, 0.28), bevel=0.08), 'fabric')
    for sx in (1, -1):
        m.add(box((sx * 0.4, -0.06, 0.45), (0.78, 0.66, 0.14), bevel=0.06), 'cushion')
    m.add(box((0, 0.31, 0.6), (W - 0.1, 0.22, 0.66), bevel=0.1), 'fabric')
    for sx in (1, -1):
        m.add(box((sx * 0.4, 0.17, 0.68), (0.76, 0.14, 0.4), bevel=0.06, rot=rot_xyz(x=-0.16)), 'cushion')
        m.add(box((sx * (W / 2 - 0.1), 0.02, 0.4), (0.2, D, 0.44), bevel=0.08), 'fabric')
        m.add(capsule((sx * (W / 2 - 0.1), -D / 2 + 0.06, 0.62), (sx * (W / 2 - 0.1), D / 2 - 0.06, 0.62), 0.11, seg=14, rings=8), 'fabric')
        for sy in (1, -1):
            m.add(cone((sx * (W / 2 - 0.12), sy * (D / 2 - 0.1), 0.13), (sx * (W / 2 - 0.12), sy * (D / 2 - 0.1), 0.0), 0.04, 0.025, seg=10), 'leg')


def b_wardrobe(M):
    m = M.part('wardrobe')
    W, D, H = 1.6, 0.6, 2.0
    m.add(box((0, 0, 1.02), (W, D, 1.84), bevel=0.04), 'wood')
    m.add(box((0, 0, H - 0.03), (W + 0.1, D + 0.06, 0.1), bevel=0.03), 'woodDark')
    m.add(box((0, 0, 0.1), (W + 0.06, D + 0.04, 0.12), bevel=0.03), 'woodDark')
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), 0.02), (0.1, 0.1, 0.06), bevel=0.015), 'woodDark')
        m.add(box((sx * 0.385, -D / 2 - 0.005, 1.04), (0.74, 0.03, 1.68), bevel=0.02), 'door')
        for z in (1.42, 0.66):   # 문의 네모 장식
            m.add(box((sx * 0.385, -D / 2 - 0.022, z), (0.54, 0.012, 0.62), bevel=0.01), 'woodDark')
            m.add(box((sx * 0.385, -D / 2 - 0.03, z), (0.46, 0.012, 0.54), bevel=0.01), 'door')
        m.add(ellipsoid((sx * 0.06, -D / 2 - 0.04, 1.04), (0.03, 0.025, 0.03), seg=12, rings=8), 'knob')


def b_bookshelf(M):
    m = M.part('shelf')
    W, D, H = 1.72, 0.42, 1.56
    for sx in (1, -1):
        m.add(box((sx * (W / 2 - 0.04), 0, H / 2), (0.08, D, H), bevel=0.02), 'wood')
    m.add(box((0, 0, H - 0.035), (W + 0.04, D + 0.03, 0.07), bevel=0.02), 'wood')
    m.add(box((0, 0, 0.06), (W, D, 0.12), bevel=0.02), 'woodDark')
    m.add(box((0, D / 2 - 0.02, H / 2), (W - 0.1, 0.04, H - 0.1), bevel=0.01), 'woodDark')
    floors = [0.12, 0.6, 1.08]
    for z in floors[1:]:
        m.add(box((0, 0, z), (W - 0.12, D - 0.02, 0.05), bevel=0.012), 'wood')
    rnd = random.Random(int(P.get('seed', 4)))
    colors = ['bookRed', 'bookBlue', 'bookGreen', 'bookYellow', 'bookPink']
    inner = W - 0.18
    n = 0
    for zi, z0 in enumerate(floors):
        base = z0 + (0.06 if zi == 0 else 0.025)
        top = (floors[zi + 1] - 0.025) if zi + 1 < len(floors) else H - 0.07
        avail = top - base
        x = -inner / 2 + 0.01
        stop = inner / 2 - (0.04 if zi == 1 else 0.56)
        while x + 0.09 < stop:   # 세워 꽂은 책
            w, hh = rnd.uniform(0.07, 0.11), avail * rnd.uniform(0.66, 0.9)
            m.add(box((x + w / 2, -0.01, base + hh / 2), (w - 0.008, D - 0.1, hh), bevel=0.012), colors[n % 5])
            x += w
            n += 1
        if zi == 1:
            continue
        # 기울어진 책 하나: 왼쪽 아래 모서리를 축으로 왼쪽 책에 기댄다
        w, hh, th = 0.08, avail * 0.82, -0.3
        R = rot_xyz(y=th)
        pivot = V((x + abs(math.sin(th)) * hh + 0.005, -0.01, base))
        m.add(box(pivot + R @ V((w / 2, 0, hh / 2)), (w, D - 0.12, hh), bevel=0.012, rot=R), colors[n % 5])
        n += 1
        for k in range(2):   # 오른쪽에 눕힌 책 두 권
            m.add(box((inner / 2 - 0.18 + k * 0.015, -0.01, base + 0.03 + k * 0.055), (0.3 - k * 0.04, D - 0.14, 0.055), bevel=0.01), colors[(n + k) % 5])
        n += 2


# ================================================================ 조명·화분·러그
def b_floor_lamp(M):
    h = P.get('height', 1)
    m = M.part('lamp')
    m.add(cylinder((0, 0, 0), (0, 0, 0.05), 0.2, 0.18, seg=24), 'base')
    m.add(ellipsoid((0, 0, 0.05), (0.09, 0.09, 0.04), seg=16, rings=8), 'base')
    m.add(cylinder((0, 0, 0.05), (0, 0, 1.2 * h), 0.026, seg=10), 'base')
    zs = 1.16 * h
    # 갓: 위가 뚫려 빛이 새어 나오는 모습 (윗면 = 전구빛)
    m.add(cylinder((0, 0, zs), (0, 0, zs + 0.36), 0.3, 0.17, seg=32), lambda c, n: 'glow' if n.z > 0.9 else 'shade')
    m.add(annulus((0, 0, zs - 0.015), 0.27, 0.315, thick=0.04, seg=32), 'trim')
    m.add(ellipsoid((0, 0, zs - 0.02), (0.075, 0.075, 0.08), seg=16, rings=10), 'glow')


def b_plant_pot(M):
    m = M.part('pot')
    m.add(cylinder((0, 0, 0), (0, 0, 0.36), 0.18, 0.24, seg=24), 'pot')
    m.add(annulus((0, 0, 0.33), 0.225, 0.275, thick=0.09, seg=28), 'potDark')
    m.add(cylinder((0, 0, 0.3), (0, 0, 0.39), 0.23, seg=24), 'soil')
    plant = M.part('plant', pivot=(0, 0, 0.38))
    base = V((0, 0, 0.38))
    for k in range(7):
        a = TAU * k / 7 + 0.25
        d, up = V((math.cos(a), math.sin(a), 0)), V((0, 0, 1))
        L = 0.5 + 0.09 * ((k * 5) % 3)
        out = 0.55 + 0.18 * ((k * 3) % 4) / 3
        pts = bezier(base + d * 0.02, base + up * L * 0.55 + d * 0.04, base + up * L * 1.0 + d * L * out * 0.6, base + up * L * 0.82 + d * L * out, 12)
        radii = [0.012 if i < 5 else 0.012 + 0.1 * math.sin(math.pi * (i - 5) / 7) for i in range(13)]
        plant.add(rail(pts, radii, seg=10, flat=0.24, side=d.cross(up)), 'leaf' if k % 3 else 'leafLight')


def b_round_rug(M):
    m = M.part('rug')
    R = 1.3
    m.add(cylinder((0, 0, 0), (0, 0, 0.028), R, seg=64), 'rug')
    m.add(annulus((0, 0, 0.028), R * 0.68, R * 0.8, thick=0.004, seg=64), 'rugAccent')
    m.add(cylinder((0, 0, 0.026), (0, 0, 0.032), R * 0.3, seg=40), 'rugAccent')
    for k in range(8):   # 가운데 띠의 점무늬
        a = TAU * k / 8 + 0.2
        m.add(cylinder((math.cos(a) * R * 0.5, math.sin(a) * R * 0.5, 0.026), (math.cos(a) * R * 0.5, math.sin(a) * R * 0.5, 0.032), 0.07, seg=16), 'rugAccent')
    for k in range(26):   # 물결 테두리
        a = TAU * k / 26
        m.add(ellipsoid((math.cos(a) * R, math.sin(a) * R, 0.016), (0.1, 0.1, 0.017), seg=12, rings=6), 'rugDot')


# ================================================================ 작은 가구
def b_radio(M):
    m = M.part('table')
    side_table(m, top_z=0.5)
    r = M.part('radio')
    W, D, H, z0 = 0.5, 0.24, 0.3, 0.525
    fy = -D / 2
    r.add(box((0, 0, z0 + H / 2), (W, D, H), bevel=0.07), 'radio')
    r.add(box((-0.1, fy - 0.002, z0 + H / 2 - 0.01), (0.22, 0.02, 0.2), bevel=0.02), 'grille')
    for k in range(4):
        r.add(box((-0.1, fy - 0.013, z0 + 0.08 + k * 0.045), (0.17, 0.006, 0.012), bevel=0.003), 'grilleLine')
    r.add(box((0.12, fy - 0.004, z0 + 0.2), (0.15, 0.02, 0.07), bevel=0.012), 'dial')
    r.add(box((0.1, fy - 0.016, z0 + 0.2), (0.008, 0.006, 0.05), bevel=0.002), 'grilleLine')
    for x in (0.08, 0.16):
        r.add(cylinder((x, fy, z0 + 0.09), (x, fy - 0.03, z0 + 0.09), 0.026, seg=14), 'knob')
    top = z0 + H
    handle = bezier((-0.17, 0, top - 0.02), (-0.17, 0, top + 0.12), (0.17, 0, top + 0.12), (0.17, 0, top - 0.02), 12)
    r.add(rail(handle, [0.018] * len(handle), seg=8), 'knob')
    r.add(cylinder((0.2, 0.06, top - 0.02), (0.31, 0.1, top + 0.36), 0.008, seg=6), 'metal')
    r.add(ellipsoid((0.31, 0.1, top + 0.37), (0.018, 0.018, 0.018), seg=10, rings=6), 'metal')


def b_villager_photo(M):
    m = M.part('table')
    side_table(m, top_z=0.5, w=0.5, d=0.42)
    p = M.part('photo')
    T = rot_xyz(x=-0.2)   # 위가 살짝 뒤로 기운다
    base = V((0, 0.02, 0.525))
    at = lambda x, y, z: base + T @ V((x, y, z))
    p.add(box(at(0, 0, 0.22), (0.36, 0.04, 0.44), bevel=0.02, rot=T), 'frame')
    p.add(box(at(0, -0.018, 0.23), (0.28, 0.01, 0.34), bevel=0.004, rot=T), 'photoBg')
    p.add(ellipsoid(at(0, -0.026, 0.12), (0.11, 0.006, 0.04), rot=T, seg=16, rings=6), 'photoFace')   # 어깨
    p.add(ellipsoid(at(0, -0.027, 0.24), (0.09, 0.006, 0.08), rot=T, seg=20, rings=8), 'photoFace')
    for sx in (1, -1):
        p.add(ellipsoid(at(sx * 0.07, -0.026, 0.32), (0.034, 0.006, 0.042), rot=T @ rot_xyz(y=sx * 0.4), seg=12, rings=6), 'photoFace')
        p.add(ellipsoid(at(sx * 0.032, -0.032, 0.25), (0.012, 0.004, 0.014), rot=T, seg=10, rings=6), 'ink')
    p.add(ellipsoid(at(0, -0.032, 0.21), (0.022, 0.004, 0.007), rot=T, seg=10, rings=6), 'ink')
    p.add(box((0, 0.13, 0.66), (0.05, 0.02, 0.3), bevel=0.006, rot=rot_xyz(x=0.42)), 'frame')   # 뒤 받침


def b_fish_tank(M):
    m = M.part('stand')
    m.add(box((0, 0, 0.24), (0.72, 0.46, 0.48), bevel=0.03), 'wood')
    for sx in (1, -1):
        m.add(box((sx * 0.17, -0.232, 0.24), (0.3, 0.02, 0.36), bevel=0.012), 'woodDark')
        m.add(ellipsoid((sx * 0.045, -0.248, 0.26), (0.018, 0.012, 0.018), seg=10, rings=6), 'wood')
    t = M.part('tank')
    W, D, z0, z1 = 0.66, 0.4, 0.48, 0.98
    t.add(box((0, 0.02, (z0 + z1) / 2 - 0.02), (W - 0.04, D - 0.06, z1 - z0 - 0.1), bevel=0.01), 'tankWater')
    t.add(box((0, 0, z0 + 0.05), (W - 0.03, D - 0.03, 0.06), bevel=0.01), 'gravel')
    glass_frame(t, W, D, z0, z1)
    t.add(box((0, 0, z1 + 0.012), (W + 0.04, D + 0.04, 0.025), bevel=0.008), 'frame')
    fy = -0.165
    for x, hgt, ph in ((-0.2, 0.28, 0.0), (-0.12, 0.2, 1.3), (0.22, 0.24, 2.1)):   # 물풀
        pts = [V((x + 0.025 * math.sin(ph + k * 1.4), fy, z0 + 0.07 + k * hgt / 6)) for k in range(7)]
        t.add(rail(pts, [0.016 * (1 - k / 7) + 0.004 for k in range(7)], seg=8, flat=0.5), 'seaweed')
    fc = V((0.05, fy - 0.005, 0.78))
    t.add(ellipsoid(fc, (0.07, 0.022, 0.045), seg=16, rings=10), 'fish')
    t.add(ellipsoid(fc + V((0.085, 0, 0)), (0.035, 0.012, 0.045), rot=rot_xyz(y=0.0), seg=12, rings=6), 'fish')
    t.add(ellipsoid(fc + V((-0.04, -0.02, 0.012)), (0.009, 0.004, 0.009), seg=8, rings=4), 'frame')
    for k, (x, z, r) in enumerate(((-0.06, 0.66, 0.016), (-0.05, 0.76, 0.012), (-0.07, 0.85, 0.018), (-0.04, 0.91, 0.01))):
        t.add(ellipsoid((x, fy - 0.01, z), (r, r, r), seg=10, rings=6), 'bubble')
    glints(t, -0.2, -D / 2 - 0.01, 0.74)


def b_bug_case(M):
    m = M.part('stand')
    m.add(box((0, 0, 0.25), (0.66, 0.44, 0.5), bevel=0.03), 'wood')
    m.add(box((0, -0.222, 0.25), (0.5, 0.02, 0.34), bevel=0.012), 'woodDark')
    m.add(ellipsoid((0, -0.238, 0.36), (0.02, 0.012, 0.02), seg=10, rings=6), 'wood')
    c = M.part('case')
    W, D, z0, z1 = 0.6, 0.38, 0.5, 0.92
    c.add(box((0, D / 2 - 0.02, (z0 + z1) / 2), (W - 0.02, 0.03, z1 - z0 - 0.02), bevel=0.008), 'caseBack')
    c.add(box((0, 0, z0 + 0.04), (W - 0.02, D - 0.02, 0.07), bevel=0.01), 'soil')
    glass_frame(c, W, D, z0, z1, mat='wood', t=0.036)   # 뚜껑도 유리: 위에서 내려다봐도 안이 보인다
    twig = bezier((-0.25, -0.04, z0 + 0.07), (-0.1, -0.06, z0 + 0.12), (0.05, -0.05, z0 + 0.24), (0.22, -0.03, z0 + 0.3), 10)
    c.add(rail(twig, [0.024 - 0.012 * i / 10 for i in range(11)], seg=8), 'twig')
    fork = bezier(twig[5], twig[5] + V((0.0, -0.01, 0.05)), twig[5] + V((-0.02, -0.01, 0.1)), twig[5] + V((-0.05, -0.01, 0.14)), 6)
    c.add(rail(fork, [0.014 - 0.008 * i / 6 for i in range(7)], seg=6), 'twig')
    for p, a in ((twig[8], 0.6), (fork[-1], -0.5), (twig[2], 2.4)):
        c.add(ellipsoid(V(p) + V((0.03 * math.cos(a), -0.02, 0.03)), (0.06, 0.012, 0.03), rot=rot_xyz(x=-0.3, y=-a), seg=12, rings=6), 'leaf')
    b = V((0.0, -0.06, z0 + 0.25))   # 장수풍뎅이 (나뭇가지 위)
    c.add(ellipsoid(b, (0.085, 0.06, 0.05), rot=rot_xyz(y=-0.45), seg=18, rings=10), 'bug')
    c.add(ellipsoid(b + V((0.075, 0, 0.045)), (0.038, 0.036, 0.03), rot=rot_xyz(y=-0.45), seg=14, rings=8), 'bug')
    horn = bezier(b + V((0.09, 0, 0.06)), b + V((0.125, 0, 0.08)), b + V((0.15, 0, 0.12)), b + V((0.135, 0, 0.16)), 6)
    c.add(rail(horn, [0.015 - 0.009 * i / 6 for i in range(7)], seg=8), 'bug')
    tilt = rot_xyz(y=-0.45)
    c.add(box(b + tilt @ V((-0.012, 0, 0.049)), (0.13, 0.006, 0.006), bevel=0.002, rot=tilt), 'bugShine')   # 겉날개 가운데 줄
    for sy in (1, -1):   # 등 반짝임 두 점
        c.add(ellipsoid(b + tilt @ V((-0.03, sy * 0.022, 0.044)), (0.022, 0.01, 0.006), rot=tilt, seg=10, rings=6), 'bugShine')
    for sy in (1, -1):
        for x in (-0.03, 0.035):
            c.add(capsule(b + V((x, sy * 0.045, -0.02)), b + V((x - 0.015, sy * 0.075, -0.06)), 0.009, seg=6, rings=4), 'bug')
    glints(c, -0.25, -D / 2 - 0.01, 0.74, h=0.16)


def slab(points, axis, thick=0.004):
    """평평한 다각형 판 (points 는 한 평면 위, axis 쪽으로 두께). 자른 과일 속살 면 등."""
    bm = bmesh.new()
    off = V(axis).normalized() * thick
    lo = [bm.verts.new(V(p)) for p in points]
    hi = [bm.verts.new(V(p) + off) for p in points]
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    n = len(points)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new([lo[k], lo[j], hi[j], hi[k]])
    return bm


def b_fruit_chair(M):
    """과일 하나의 앞-위 4분의 1을 잘라낸 의자: 잘린 두 면(앉는 면·등받이)이 속살"""
    m = M.part('chair')
    rx, rz, cz = 0.42, 0.45, 0.45
    zc = 0.5                                   # 앉는 면 높이 (등받이 면은 y = 0)
    bm = ellipsoid((0, 0, cz), (rx, rx, rz), seg=40, rings=24)
    cut = lambda co: co.y < 0 and co.z > zc
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(cut(v.co) for v in f.verts)], context='FACES')
    for v in bm.verts:   # 잘린 가장자리에 걸친 점은 가까운 자른 면 위로
        if cut(v.co):
            if v.co.z - zc < -v.co.y:
                v.co.z = zc
            else:
                v.co.y = 0.0
    m.add(bm, 'fruit')
    k = math.sqrt(1 - ((zc - cz) / rz) ** 2)
    a = rx * k * 0.99
    seat = [V((a * math.cos(t), -a * math.sin(t), zc)) for t in (math.pi * i / 32 for i in range(33))]
    m.add(slab(seat, (0, 0, 1), thick=0.006), 'flesh')
    s0 = math.asin((zc - cz) / rz)
    back = [V((rx * 0.99 * math.cos(t), 0, cz + rz * 0.99 * math.sin(t))) for t in (s0 + (math.pi - 2 * s0) * i / 32 for i in range(33))]
    back = [V((p.x, p.y, max(p.z, zc))) for p in back]
    m.add(slab(back, (0, -1, 0), thick=0.006), 'flesh')
    for i in range(5):   # 앉는 면 가운데 별 모양 씨
        a = TAU * i / 5 + math.pi / 2
        m.add(ellipsoid((math.cos(a) * 0.045, -0.12 + math.sin(a) * 0.045, zc + 0.007), (0.022, 0.011, 0.005), rot=rot_xyz(z=a), seg=10, rings=6), 'seed')
    m.add(cylinder((0, 0.1, cz + rz - 0.02), (0.03, 0.12, cz + rz + 0.12), 0.024, 0.018, seg=8), 'stem')
    m.add(ellipsoid((0.12, 0.13, cz + rz + 0.08), (0.11, 0.045, 0.015), rot=rot_xyz(y=-0.35, z=0.25), seg=14, rings=6), 'leaf')


def b_dino_model(M):
    m = M.part('pedestal')
    m.add(box((0, 0, 0.08), (1.74, 0.9, 0.16), bevel=0.03), 'pedestal')
    m.add(box((0, 0, 0.163), (1.66, 0.82, 0.012), bevel=0.004), 'pedestalTop')
    m.add(box((0, -0.452, 0.08), (0.42, 0.012, 0.09), bevel=0.004), 'plaque')
    for x, z in ((-0.12, 0.66), (0.34, 0.74)):   # 지지대
        m.add(cylinder((x, 0, 0.17), (x, 0, z), 0.014, seg=8), 'metal')
    b = M.part('bones')
    spine = bezier((-0.86, 0, 0.32), (-0.5, 0, 0.62), (-0.25, 0, 0.84), (0.05, 0, 0.84), 10)[:-1] \
        + bezier((0.05, 0, 0.84), (0.32, 0, 0.84), (0.46, 0, 1.05), (0.56, 0, 1.46), 10)
    radii = [0.012 + 0.03 * min(1, i / 9) for i in range(10)] + [0.042 - 0.022 * i / 10 for i in range(11)]
    b.add(rail(spine, radii, seg=10), 'bone')
    for i in range(2, len(spine) - 1, 2):   # 등뼈 마디
        p = V(spine[i])
        b.add(ellipsoid(p + V((0, 0, radii[i] * 0.8)), (radii[i] * 0.8, radii[i] * 0.9, radii[i] * 0.9), seg=10, rings=6), 'boneDark')
    for x in (-0.22, -0.13, -0.04, 0.05, 0.14, 0.23):   # 갈비뼈
        z = 0.84 if x > -0.25 else 0.8
        for sy in (1, -1):
            rib = bezier((x, 0, z), (x, sy * 0.2, z), (x + 0.02, sy * 0.22, z - 0.22), (x + 0.03, sy * 0.1, z - 0.32), 8)
            b.add(rail(rib, [0.016 - 0.007 * k / 8 for k in range(9)], seg=6), 'bone')
    for hx, top in ((-0.3, 0.8), (0.24, 0.82)):   # 엉덩이·어깨뼈 + 다리 넷
        b.add(ellipsoid((hx, 0, top + 0.01), (0.08, 0.16, 0.055), seg=14, rings=8), 'bone')
        for sy in (1, -1):
            leg = [V((hx, sy * 0.13, top)), V((hx - 0.03, sy * 0.17, 0.48)), V((hx + 0.01, sy * 0.17, 0.21))]
            b.add(capsule(leg[0], leg[1], 0.034, seg=10, rings=6), 'bone')
            b.add(capsule(leg[1], leg[2], 0.028, seg=10, rings=6), 'bone')
            b.add(ellipsoid(leg[1], (0.04, 0.04, 0.04), seg=10, rings=6), 'boneDark')
            b.add(ellipsoid(leg[2] + V((0.04, 0, -0.025)), (0.07, 0.045, 0.025), seg=12, rings=6), 'bone')
    head = V(spine[-1]) + V((0.07, 0, 0.04))
    b.add(ellipsoid(head, (0.13, 0.075, 0.065), rot=rot_xyz(y=0.2), seg=18, rings=10), 'bone')
    for sy in (1, -1):
        b.add(ellipsoid(head + V((0.02, sy * 0.06, 0.015)), (0.022, 0.016, 0.02), seg=10, rings=6), 'boneDark')


# ================================================================ 벽·창문 가구 (원점 = 벽면 바닥)
def b_wall_clock(M):
    m = M.part('clock')
    cz, R = 1.55, 0.3
    m.add(cylinder((0, 0, cz), (0, -0.08, cz), R, seg=40), 'wood')
    m.add(annulus((0, -0.08, cz), R * 0.83, R, axis=(0, -1, 0), thick=0.025, seg=40), 'wood')
    m.add(cylinder((0, -0.08, cz), (0, -0.09, cz), R * 0.84, seg=40), 'face')
    for k in range(12):
        a = TAU * k / 12
        big = k % 3 == 0
        m.add(box((math.sin(a) * 0.19, -0.093, cz + math.cos(a) * 0.19), (0.022 if big else 0.014, 0.006, 0.05 if big else 0.028), bevel=0.002, rot=rot_xyz(y=a)), 'tick')
    for sx in (1, -1):   # 위 잎 장식
        m.add(ellipsoid((sx * 0.07, -0.05, cz + R + 0.03), (0.08, 0.03, 0.018), rot=rot_xyz(y=-sx * 0.45), seg=12, rings=6), 'leaf')
    m.add(ellipsoid((0, -0.112, cz), (0.022, 0.01, 0.022), seg=10, rings=6), 'hand')
    # 바늘은 따로 둔다: 게임이 시각에 맞춰 돌린다 (12시 방향이 0, 앞에서 보아 시계 방향)
    hh = M.part('hourHand', pivot=(0, -0.1, cz))
    hh.add(box((0, -0.1, cz + 0.05), (0.032, 0.008, 0.13), bevel=0.004), 'hand')
    mh = M.part('minuteHand', pivot=(0, -0.106, cz))
    mh.add(box((0, -0.106, cz + 0.08), (0.02, 0.008, 0.19), bevel=0.003), 'hand')


def b_picture_frame(M):
    m = M.part('frame')
    cz, W, H, T = 1.5, 0.84, 0.64, 0.07
    for cx, z, sx, sz in ((0, cz + H / 2 - T / 2, W, T), (0, cz - H / 2 + T / 2, W, T), (-W / 2 + T / 2, cz, T, H), (W / 2 - T / 2, cz, T, H)):
        m.add(box((cx, -0.04, z), (sx, 0.06, sz), bevel=0.015), 'frame')
    m.add(box((0, -0.025, cz), (W - T * 1.2, 0.02, H - T * 1.2), bevel=0.003), 'canvasSky')
    m.add(ellipsoid((0.15, -0.037, cz - 0.19), (0.26, 0.004, 0.12), seg=24, rings=8), 'canvasHill2')
    m.add(ellipsoid((-0.12, -0.039, cz - 0.22), (0.28, 0.003, 0.1), seg=24, rings=8), 'canvasHill')
    m.add(ellipsoid((0.19, -0.037, cz + 0.11), (0.055, 0.003, 0.055), seg=18, rings=8), 'canvasSun')
    for x, z, r in ((-0.18, cz + 0.12, 0.05), (-0.12, cz + 0.13, 0.04), (-0.23, cz + 0.11, 0.035)):
        m.add(ellipsoid((x, -0.037, z), (r, 0.003, r * 0.7), seg=14, rings=6), 'canvasCloud')
    nail = V((0, -0.02, cz + H / 2 + 0.16))
    for sx in (1, -1):
        m.add(cylinder((sx * 0.3, -0.03, cz + H / 2 - 0.02), nail, 0.005, seg=6), 'string')
    m.add(ellipsoid(nail, (0.014, 0.014, 0.014), seg=8, rings=6), 'string')


def b_shell_curtain(M):
    m = M.part('curtain')
    top, y = 1.86, -0.07
    m.add(cylinder((-0.56, y, top), (0.56, y, top), 0.022, seg=12), 'rod')
    for sx in (1, -1):
        m.add(ellipsoid((sx * 0.58, y, top), (0.04, 0.04, 0.04), seg=12, rings=8), 'rod')
        m.add(box((sx * 0.5, y / 2, top), (0.03, -y, 0.03), bevel=0.006), 'rod')
    shells = ['shellA', 'shellB', 'shellC']
    for i in range(7):
        x = -0.42 + 0.14 * i
        length = 0.6 + 0.24 * abs(i - 3) / 3        # 가운데가 짧아 물결 모양
        m.add(cylinder((x, y, top), (x, y, top - length), 0.005, seg=6), 'string')
        n = 5 if abs(i - 3) > 1 else 4
        for k in range(n):
            z = top - 0.12 - k * (length - 0.08) / (n - 0.6)
            if k % 2 == 0:
                m.add(scallop((x, y - 0.006, z), 0.045, 0.04, rot=rot_xyz(y=0.15 * (k - 1))), shells[(i + k // 2) % 3])
            else:
                m.add(ellipsoid((x, y, z), (0.017, 0.017, 0.017), seg=10, rings=6), 'bead')


BUILDERS = {
    'log-chair': b_log_chair, 'log-table': b_log_table, 'wood-bed': b_wood_bed, 'campfire': b_campfire, 'woodpile': b_woodpile,
    'floor-lamp': b_floor_lamp, 'plant-pot': b_plant_pot, 'round-rug': b_round_rug, 'bookshelf': b_bookshelf, 'radio': b_radio,
    'sofa': b_sofa, 'wardrobe': b_wardrobe, 'wall-clock': b_wall_clock, 'fish-tank': b_fish_tank, 'bug-case': b_bug_case,
    'picture-frame': b_picture_frame, 'villager-photo': b_villager_photo, 'shell-curtain': b_shell_curtain,
    'fruit-chair': b_fruit_chair, 'dino-model': b_dino_model,
}


def build(palette, suffix='', offset=(0, 0, 0)):
    M = Model(SLUG, palette, suffix, offset)
    BUILDERS[KIND](M)
    M.finish(scene)
    M.root.scale = (P.get('scale', 1.0),) * 3
    return M


# ================================================================ 만들기 · 동작 · 내보내기
scene = reset_scene()
main = build(PAL)
objects = list(main.objects.values())

ANIMS = {
    'flicker': (24, lambda t: ((0, 0, 0.1 * math.sin(TAU * t)), (1 + 0.08 * math.sin(TAU * 2 * t), 1 + 0.08 * math.sin(TAU * 2 * t), 1 + 0.15 * math.sin(TAU * 3 * t + 1)))),
}
ANIM_TARGET = {'flicker': ('flame',)}
anim_names = []
for name in spec.get('animations', []):
    target = next((main.objects[t] for t in ANIM_TARGET.get(name, ()) if t in main.objects), None)
    if target is None:
        continue
    frames, fn = ANIMS[name]
    target.rotation_mode = 'XYZ'
    target.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    target.animation_data.action = act
    try:
        if act.slots and target.animation_data.action_slot is None:
            target.animation_data.action_slot = act.slots[0]
    except AttributeError:
        pass
    for f in range(frames + 1):
        rot, scl = fn(f / frames)
        target.rotation_euler = rot
        target.keyframe_insert('rotation_euler', frame=f)
        if scl:
            target.scale = scl
            target.keyframe_insert('scale', frame=f)
    track = target.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    track.mute = True
    target.animation_data.action = None
    target.rotation_euler = (0, 0, 0)
    target.scale = (1, 1, 1)
    anim_names.append((name, frames))

glb_path = os.path.join(OUT['models'], SLUG + '.glb')
for o in scene.objects:
    o.select_set(o in objects or o is main.root)
bpy.context.view_layer.objects.active = main.root
try:
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=True, export_apply=False,
                              export_animations=bool(anim_names), export_animation_mode='ACTIONS', export_yup=True)
except TypeError as e:
    print('[build] 일부 내보내기 옵션을 지원하지 않아 기본값으로 다시 시도:', e)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=True)

bpy.context.view_layer.update()
lo, hi = world_bounds(objects)
size = hi - lo
tris = 0
for o in objects:
    o.data.calc_loop_triangles()
    tris += len(o.data.loop_triangles)
stats = {
    'id': spec['id'], 'slug': SLUG, 'item': spec.get('item'), 'name': spec['name'], 'category': spec['category'], 'kind': KIND,
    'version': spec.get('version'), 'place': spec.get('place', 'floor'),
    'triangles': tris, 'parts': len(objects), 'materials': sorted({m.name for o in objects for m in o.data.materials}),
    'objects': sorted(main.objects.keys()),
    'animations': {n: {'frames': f, 'seconds': round(f / 24, 2)} for n, f in anim_names},
    'size': [round(size.x, 2), round(size.y, 2), round(hi.z, 2)],
    'bounds': [[round(lo.x, 3), round(lo.y, 3), round(lo.z, 3)], [round(hi.x, 3), round(hi.y, 3), round(hi.z, 3)]],
    'footprint': spec.get('footprint') or [max(1, math.ceil(size.x - 0.05)), max(1, math.ceil(size.y - 0.05))],
    'glbBytes': os.path.getsize(glb_path), 'blender': bpy.app.version_string,
}
fw, fd = stats['footprint']
if spec.get('place', 'floor') == 'floor' and (size.x > fw + 0.02 or size.y > fd + 0.02):
    print(f'[build] 경고: 모델({size.x:.2f}×{size.y:.2f})이 발자국 {fw}×{fd} 보다 크다')

# ================================================================ 렌더
if DO_RENDER:
    R = lambda name: os.path.join(OUT['renders'], f'{SLUG}_{name}.png')
    FLAT = set(spec.get('style', {}).get('flat', []))
    width = spec.get('style', {}).get('outlineWidth', 0.01)
    for m in list(bpy.data.materials):
        if 'hex' in m:
            toonify(m, flat=m.name.split('@')[0] in FLAT)
    add_outlines(scene, objects, width)
    cam, target = setup_render(scene)
    center = (lo + hi) / 2
    radius = max(size.length / 2, 0.25)

    aim(cam, target, center, 35, 30, ortho_scale=radius * 2.1)
    shot(scene, R('main'), 640, 640)
    thumbnail(R('main'), R('thumb'))
    aim(cam, target, center, 0, 6, ortho_scale=max(size.x, size.z) * 1.25 + 0.1)
    shot(scene, R('front'), 640, 640)
    aim(cam, target, center, 0, 89.5, ortho_scale=max(size.x, size.y) * 1.25 + 0.1)
    shot(scene, R('top'), 640, 640)

    variants = [(k, v) for k, v in spec.get('variants', {}).items()]
    if variants:   # 같은 모양에 색만 바꾼 변형을 옆으로 나란히
        gap = max(size.x, size.y) * 1.2 + 0.2
        start = -gap * (len(variants) - 1) / 2
        main.root.location = (10000, 0, 0)
        extras = []
        for i, (key, var) in enumerate(variants):
            extras.append(build({**PAL, **var.get('palette', {})}, suffix='@' + key, offset=(start + i * gap, 0, 0)))
        for m in bpy.data.materials:
            if '@' in m.name and 'hex' in m:
                toonify(m, flat=m.name.split('@')[0] in FLAT)
        for vm in extras:
            add_outlines(scene, list(vm.objects.values()), width)
        span = gap * (len(variants) - 1) + max(size.x, size.y)
        aim(cam, target, V((0, center.y, center.z)), 30, 22, ortho_scale=max(span * 1.05, radius * 2.2))
        shot(scene, R('variants'), 1280, 560)
        for vm in extras:
            for o in list(vm.root.children_recursive) + [vm.root]:
                bpy.data.objects.remove(o, do_unlink=True)
        main.root.location = (0, 0, 0)

blend_path = os.path.join(OUT['blender'], SLUG + '.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
stats['renders'] = sorted(f for f in os.listdir(OUT['renders']) if f.startswith(SLUG + '_'))
json.dump(stats, open(os.path.join(OUT['models'], SLUG + '.stats.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('[build] 완료:', json.dumps({k: stats[k] for k in ('slug', 'triangles', 'size', 'footprint')}, ensure_ascii=False))
