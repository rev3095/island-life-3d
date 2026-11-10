"""배경 요소 빌더: assets/env/specs/<slug>.json → .blend / .glb / 렌더 / 통계

실행:  blender -b --factory-startup --python build_env.py -- <spec.json> <assets_dir> [--no-render]
(보통은 tools/build-env.mjs 로 실행한다)

스펙의 kind 가 아래 BUILDERS 중 어떤 함수로 만들지 정한다. params 의 숫자와 palette 의 색이 그대로 반영된다.
variants(계절·색 변형)는 같은 모양에 색만 바꾼 것이라 렌더에서 나란히 보여준다.
좌표계: Blender Z-up, 정면 = -Y. 1.0 = 게임 타일 1칸 (캐릭터 키 ≈ 1.0).
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from toonkit import (V, Model, add_outlines, aim, bezier, box, capsule, cone, cylinder, ellipsoid, jitter, prism,
                     reset_scene, rot_xyz, setup_render, shot, thumbnail, toonify, tube, wedge, world_bounds)

args = sys.argv[sys.argv.index('--') + 1:]
SPEC_PATH, ASSETS = os.path.abspath(args[0]), os.path.abspath(args[1])
DO_RENDER = '--no-render' not in args
spec = json.load(open(SPEC_PATH, encoding='utf-8'))
SLUG, KIND = spec['slug'], spec['kind']
P = {k: v['value'] for k, v in spec.get('params', {}).items()}
PAL = spec['palette']
OUT = {k: os.path.join(ASSETS, 'env', k) for k in ('models', 'renders', 'blender')}
for d in OUT.values():
    os.makedirs(d, exist_ok=True)
TAU = math.pi * 2


# ================================================================ 자연
def canopy_lumps(cs, cz):
    return [(0, 0, cz + 0.1 * cs, 0.62), (0.38, 0.1, cz - 0.08 * cs, 0.42), (-0.36, 0.12, cz - 0.05 * cs, 0.44),
            (0.05, -0.36, cz - 0.1 * cs, 0.42), (0.02, 0.38, cz - 0.02 * cs, 0.42), (0.0, 0.0, cz + 0.42 * cs, 0.36)]


def b_tree(M, fruit=False):
    th, cs = 1.0 * P.get('trunkHeight', 1), P.get('canopySize', 1)
    trunk = M.part('trunk')
    trunk.add(cylinder((0, 0, 0), (0, 0, th + 0.25), 0.15, 0.1, seg=16), 'trunk')
    trunk.add(ellipsoid((0, 0, 0.05), (0.21, 0.21, 0.1), seg=16, rings=8), 'trunk')
    trunk.add(capsule((0, 0, th * 0.72), (0.24, 0.04, th * 0.95), 0.045, seg=10, rings=6), 'trunk')
    can = M.part('canopy', pivot=(0, 0, th))
    cz = th + 0.55 * cs
    lumps = canopy_lumps(cs, cz)
    for x, y, z, r in lumps:
        can.add(ellipsoid((x * cs, y * cs, z), (r * cs, r * cs, r * cs * 0.9), seg=24, rings=14), 'leaf')
    if fruit:   # 앞쪽과 옆쪽 표면에 열매 5개
        for i, (li, yaw, pitch) in enumerate(((3, 0.0, 0.1), (1, -0.9, 0.2), (2, 0.9, 0.0), (0, 0.3, -0.35), (0, -0.5, -0.25))):
            x, y, z, r = lumps[li]
            d = V((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
            c = V((x * cs, y * cs, z)) + V((d.x * r * cs, d.y * r * cs, d.z * r * cs * 0.9)) * 0.97
            can.add(ellipsoid(c, (0.095, 0.095, 0.09), seg=16, rings=10), 'fruit')
            can.add(cylinder(c + V((0, 0, 0.07)), c + V((0.01, 0, 0.13)), 0.012, seg=6), 'trunk', outline=False)


def b_palm(M):
    h = 2.0 * P.get('trunkHeight', 1)
    pts = bezier((0, 0, 0), (0.05, 0, h * 0.4), (0.22, 0, h * 0.75), (0.32, 0, h), 9)
    trunk = M.part('trunk')
    for i in range(len(pts) - 1):   # 마디마다 아래가 살짝 넓은 원뿔대를 쌓는다
        r = 0.15 - 0.06 * i / len(pts)
        trunk.add(cylinder(pts[i], pts[i + 1] + (pts[i + 1] - pts[i]) * 0.08, r, r * 0.82, seg=14), 'trunk' if i % 2 else 'trunkRing')
    top = pts[-1]
    crown = M.part('canopy', pivot=top)
    for k in range(7):
        a = TAU * k / 7 + 0.3
        d, up = V((math.cos(a), math.sin(a), 0)), V((0, 0, 1))
        fr = bezier(top, top + d * 0.35 + up * 0.28, top + d * 0.8 + up * 0.12, top + d * 1.05 - up * 0.38, 10)
        crown.add(tube(fr, [0.03 + 0.12 * math.sin(math.pi * min(1, 0.15 + i / 10)) for i in range(11)], seg=10, flat=0.22), 'leaf')
    for k in range(3):
        a = TAU * k / 3
        crown.add(ellipsoid(top + V((math.cos(a) * 0.1, math.sin(a) * 0.1, -0.1)), (0.085, 0.085, 0.09), seg=14, rings=8), 'coconut')


def b_cedar(M):
    th, cs = P.get('trunkHeight', 1), P.get('canopySize', 1)
    M.part('trunk').add(cylinder((0, 0, 0), (0, 0, 0.5 * th), 0.12, 0.09, seg=14), 'trunk')
    can = M.part('canopy', pivot=(0, 0, 0.45 * th))
    for z, r, h in ((0.42, 0.75, 0.9), (0.95, 0.6, 0.78), (1.42, 0.44, 0.68), (1.85, 0.27, 0.5)):
        base = 0.45 * th + (z - 0.42) * cs
        can.add(cone((0, 0, base), (0, 0, base + h * cs), r * cs, 0.05 * cs, seg=20), 'leaf')


def b_rock(M):
    s, seed = P.get('size', 1), int(P.get('seed', 3))
    rock = M.part('rock')
    rock.add(jitter(ellipsoid((0, 0, 0.22 * s), (0.42 * s, 0.36 * s, 0.3 * s), seg=10, rings=7), 0.045 * s, seed, keep_bottom=0.0), 'rock', smooth=False)
    rock.add(jitter(ellipsoid((0.42 * s, -0.22 * s, 0.05 * s), (0.11 * s, 0.09 * s, 0.07 * s), seg=8, rings=5), 0.015 * s, seed + 1, keep_bottom=0.0), 'rock', smooth=False)
    for x, y in ((-0.1, -0.12), (0.12, 0.05)):
        rock.add(ellipsoid((x * s, y * s, 0.48 * s), (0.1 * s, 0.08 * s, 0.025 * s), seg=10, rings=6), 'rockDark', outline=False)


def b_tulip(M):
    f = M.part('flower')
    f.add(capsule((0, 0, 0), (0, 0, 0.27), 0.013, seg=8, rings=6), 'stem')
    for sx in (1, -1):
        f.add(ellipsoid((sx * 0.045, 0, 0.09), (0.028, 0.012, 0.1), rot=rot_xyz(y=-sx * 0.45), seg=12, rings=8), 'stem')
    f.add(ellipsoid((0, 0, 0.33), (0.068, 0.068, 0.075), seg=16, rings=10), 'petal')
    for k in range(3):
        a = TAU * k / 3 + 0.5
        f.add(ellipsoid((math.cos(a) * 0.045, math.sin(a) * 0.045, 0.345), (0.042, 0.026, 0.08), rot=rot_xyz(y=0.25, z=a), seg=12, rings=8), 'petal')


def b_cosmos(M):
    f = M.part('flower')
    stem = bezier((0, 0, 0), (0.0, 0, 0.15), (0.03, 0, 0.28), (0.02, -0.02, 0.36), 6)
    f.add(tube(stem, [0.011] * len(stem), seg=8), 'stem')
    for sx in (1, -1):
        f.add(ellipsoid((sx * 0.05, 0, 0.12), (0.05, 0.008, 0.012), rot=rot_xyz(y=-sx * 0.5), seg=10, rings=6), 'stem')
    tilt = rot_xyz(x=0.55)
    c = V((0.02, -0.02, 0.37))
    f.add(ellipsoid(c, (0.03, 0.03, 0.016), rot=tilt, seg=12, rings=8), 'center', outline=False)
    for k in range(8):
        a = TAU * k / 8
        off = tilt @ V((math.cos(a) * 0.065, math.sin(a) * 0.065, 0))
        f.add(ellipsoid(c + off, (0.045, 0.022, 0.007), rot=tilt @ rot_xyz(z=a), seg=12, rings=6), 'petal')


def b_pansy(M):
    f = M.part('flower')
    for k in range(6):
        a = TAU * k / 6
        f.add(ellipsoid((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.04), (0.06, 0.035, 0.018), rot=rot_xyz(y=0.3, z=a), seg=12, rings=6), 'stem')
    tilt = rot_xyz(x=1.0)
    c = V((0, -0.02, 0.13))
    for (x, z, r) in ((-0.035, 0.035, 0.042), (0.035, 0.035, 0.042), (-0.045, -0.01, 0.036), (0.045, -0.01, 0.036), (0, -0.04, 0.045)):
        f.add(ellipsoid(c + tilt @ V((x, z, 0)), (r, r, 0.009), rot=tilt, seg=14, rings=6), 'petal')
    f.add(ellipsoid(c + tilt @ V((0, -0.005, 0.006)), (0.03, 0.028, 0.006), rot=tilt, seg=12, rings=6), 'petalDark', outline=False)
    f.add(ellipsoid(c + tilt @ V((0, 0.0, 0.012)), (0.011, 0.011, 0.008), rot=tilt, seg=10, rings=6), 'center', outline=False)


def b_weed(M):
    f = M.part('flower')
    rnd = random.Random(7)
    for k in range(7):
        a = TAU * k / 7 + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(0.02, 0.08)
        base = V((math.cos(a) * r, math.sin(a) * r, 0))
        tip = base + V((math.cos(a) * 0.08, math.sin(a) * 0.08, rnd.uniform(0.16, 0.26)))
        f.add(cone(base, tip, 0.028, 0.003, squash=0.35, seg=8), 'weed')


def b_shell(M):
    s = M.part('shell')
    RX, RY, RZ, Z0 = 0.14, 0.12, 0.05, 0.015
    dome = ellipsoid((0, 0, Z0), (RX, RY, RZ), seg=28, rings=12)
    for v in dome.verts:   # 뒤(경첩 쪽)로 갈수록 좁아지는 부채꼴
        if v.co.y > 0:
            v.co.x *= 1 - 0.65 * (v.co.y / RY)
        if v.co.z < 0:
            v.co.z = 0.0
    s.add(dome, 'shell')

    def on_dome(x, y):
        w = RX * (1 - 0.65 * max(0.0, y / RY))
        return V((x, y, Z0 + RZ * math.sqrt(max(0.0, 1 - (x / w) ** 2 - (y / RY) ** 2)) + 0.004))

    hinge = V((0, RY * 0.92, 0))
    for k in range(7):
        a = math.pi * (0.18 + 0.64 * k / 6)
        edge = V((math.cos(a) * RX * 0.9, -math.sin(a) * RY * 0.9, 0))
        pts = [on_dome(*(hinge + (edge - hinge) * t).xy) for t in (i / 8 for i in range(9))]
        s.add(tube(pts, [0.006 + 0.006 * i / 8 for i in range(9)], seg=8), 'shellRib', outline=False)
    for sx in (1, -1):
        s.add(box((sx * 0.035, 0.115, 0.02), (0.05, 0.04, 0.03), bevel=0.01), 'shell')


def b_bush(M):
    b = M.part('bush')
    for x, y, z, r in ((0, 0, 0.36, 0.42), (0.3, 0.05, 0.28, 0.3), (-0.3, 0.06, 0.28, 0.3), (0.02, -0.25, 0.26, 0.3), (0, 0.22, 0.3, 0.3)):
        b.add(ellipsoid((x, y, z), (r, r, r * 0.88), seg=22, rings=12), 'leaf')
    rnd = random.Random(5)
    for k in range(11):   # 작은 꽃송이를 겉면에 뿌린다
        yaw, pitch = rnd.uniform(-1.6, 1.6), rnd.uniform(-0.1, 0.9)
        d = V((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
        b.add(ellipsoid(V((0, 0, 0.36)) + d * 0.43, (0.05, 0.05, 0.045), seg=10, rings=6), 'flower', outline=False)


# ================================================================ 소품
def b_lamp(M):
    m = M.part('lamp')
    m.add(cylinder((0, 0, 0), (0, 0, 0.12), 0.16, 0.13, seg=16), 'metal')
    m.add(cylinder((0, 0, 0.12), (0, 0, 1.45), 0.045, seg=12), 'metal')
    m.add(box((0, 0, 1.6), (0.24, 0.24, 0.28), bevel=0.02), 'glow', outline=False)
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        m.add(box((sx * 0.12, sy * 0.12, 1.6), (0.04, 0.04, 0.3), bevel=0.01), 'metal')
    m.add(box((0, 0, 1.45), (0.3, 0.3, 0.05), bevel=0.015), 'metal')
    m.add(cone((0, 0, 1.74), (0, 0, 1.92), 0.24, 0.02, seg=4), 'metal', smooth=False)
    m.add(ellipsoid((0, 0, 1.95), (0.035, 0.035, 0.035), seg=10, rings=6), 'metal')


def b_bench(M):
    m = M.part('bench')
    for y in (-0.14, 0.0, 0.14):
        m.add(box((0, y, 0.42), (1.4, 0.12, 0.05), bevel=0.02), 'wood')
    for z in (0.62, 0.78):
        m.add(box((0, 0.24, z), (1.4, 0.05, 0.11), bevel=0.02, rot=rot_xyz(x=-0.18)), 'wood')
    for sx in (1, -1):
        x = sx * 0.6
        m.add(box((x, -0.16, 0.2), (0.06, 0.06, 0.42), bevel=0.015), 'metal')
        m.add(box((x, 0.2, 0.4), (0.06, 0.06, 0.82), bevel=0.015, rot=rot_xyz(x=-0.18)), 'metal')
        m.add(box((x, 0.0, 0.58), (0.07, 0.46, 0.05), bevel=0.015), 'metal')


def b_mailbox(M):
    m = M.part('mailbox')
    m.add(box((0, 0, 0.36), (0.08, 0.08, 0.72), bevel=0.015), 'wood')
    m.add(box((0, 0, 0.88), (0.34, 0.5, 0.3), bevel=0.11), 'box')
    m.add(ellipsoid((0, -0.255, 0.9), (0.035, 0.02, 0.025), seg=10, rings=6), 'trim')
    m.add(box((0.185, 0.06, 0.96), (0.02, 0.02, 0.24), bevel=0.005), 'trim')
    m.add(box((0.19, 0.12, 1.04), (0.015, 0.12, 0.08), bevel=0.005), 'flag')


def b_signboard(M):
    m = M.part('sign')
    for sx in (1, -1):
        m.add(box((sx * 0.48, 0, 0.6), (0.08, 0.08, 1.2), bevel=0.015), 'wood')
    m.add(box((0, 0, 0.88), (1.1, 0.07, 0.62), bevel=0.035), 'board')
    m.add(box((-0.18, -0.04, 0.9), (0.34, 0.01, 0.4), bevel=0.004, rot=rot_xyz(y=0.06)), 'paper', outline=False)
    m.add(box((0.25, -0.04, 0.93), (0.26, 0.01, 0.3), bevel=0.004, rot=rot_xyz(y=-0.08)), 'paper', outline=False)
    m.add(prism((0, 0, 1.2), 1.26, 0.26, 0.16, overhang=0.02), 'roof')


def b_bridge(M):
    L, W = 3.0 * P.get('length', 1), 1.4 * P.get('width', 1)
    m = M.part('bridge')
    n = max(6, int(L / 0.19))
    arch = lambda x: 0.22 * math.cos(math.pi * x / L)
    for i in range(n):
        x = -L / 2 + (i + 0.5) * L / n
        m.add(box((x, 0, 0.12 + arch(x)), (L / n * 0.9, W, 0.07), bevel=0.015), 'wood' if i % 2 else 'woodDark')
    for sy in (1, -1):
        pts = [V((x, sy * (W / 2 - 0.02), 0.62 + arch(x))) for x in (L * (i / 10 - 0.5) for i in range(11))]
        m.add(tube(pts, [0.04] * len(pts), seg=10), 'wood')
        beam = [V((x, sy * (W / 2 - 0.12), 0.06 + arch(x))) for x in (L * (i / 10 - 0.5) for i in range(11))]
        m.add(tube(beam, [0.06] * len(beam), seg=10), 'woodDark')
        for x in (L * (i / 4 - 0.5) * 0.96 for i in range(5)):
            m.add(box((x, sy * (W / 2 - 0.02), 0.4 + arch(x)), (0.08, 0.08, 0.5), bevel=0.015), 'wood')


def b_fence(M):
    m = M.part('fence')
    for sx in (1, -1):
        m.add(box((sx * 0.45, 0, 0.36), (0.12, 0.12, 0.72), bevel=0.025), 'wood')
        m.add(cone((sx * 0.45, 0, 0.72), (sx * 0.45, 0, 0.82), 0.085, 0.0, seg=4), 'wood', smooth=False)
    for z in (0.3, 0.56):
        m.add(box((0, 0, z), (1.0, 0.06, 0.09), bevel=0.02), 'woodLight')


def b_fossil_spot(M):
    m = M.part('spot')
    m.add(ellipsoid((0, 0, 0), (0.42, 0.42, 0.05), seg=24, rings=8), 'dirt')
    for a in (math.pi / 4, -math.pi / 4):
        m.add(box((0, 0, 0.045), (0.5, 0.07, 0.03), bevel=0.012, rot=rot_xyz(z=a)), 'crack', outline=False)


def b_workbench(M):
    m = M.part('bench')
    m.add(box((0, 0, 0.72), (1.3, 0.7, 0.12), bevel=0.03), 'wood')
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * 0.56, sy * 0.26, 0.33), (0.1, 0.1, 0.66), bevel=0.02), 'woodDark')
    m.add(box((0, 0, 0.2), (1.1, 0.55, 0.05), bevel=0.015), 'woodDark')
    m.add(box((0.5, -0.3, 0.84), (0.18, 0.14, 0.12), bevel=0.02), 'metal')
    m.add(capsule((-0.35, -0.05, 0.8), (-0.05, -0.12, 0.8), 0.022, seg=8, rings=6), 'woodDark')
    m.add(box((-0.05, -0.12, 0.81), (0.07, 0.14, 0.05), bevel=0.01), 'metal')
    m.add(box((0.15, 0.15, 0.785), (0.42, 0.12, 0.012), bevel=0.003, rot=rot_xyz(z=0.25)), 'metal')


def b_campfire(M):
    m = M.part('fire')
    for k in range(9):
        a = TAU * k / 9
        m.add(jitter(ellipsoid((math.cos(a) * 0.33, math.sin(a) * 0.33, 0.05), (0.09, 0.08, 0.07), seg=8, rings=5), 0.012, k, keep_bottom=0.0), 'stone', smooth=False)
    for k in range(3):
        a = TAU * k / 3
        d = V((math.cos(a), math.sin(a), 0))
        m.add(capsule(d * 0.24 + V((0, 0, 0.04)), -d * 0.05 + V((0, 0, 0.16)), 0.045, seg=10, rings=6), 'wood')
    flame = M.part('flame', pivot=(0, 0, 0.08))
    flame.add(cone((0, 0, 0.08), (0, 0, 0.55), 0.15, 0.0, seg=12), 'flame', outline=False)
    flame.add(cone((0, -0.03, 0.08), (0, -0.03, 0.36), 0.08, 0.0, seg=10), 'flameCore', outline=False)


# ================================================================ 5차 소품: 이사·생일 (PR-10 ~ PR-12, 검수 보드 wave5)
def carton(m, c, size, mat, rot=0.0):
    """테이프 붙인 종이 상자: 윗면 가운데 테이프가 앞뒤 옆면으로 내려온다"""
    R = rot_xyz(z=rot)
    c = V(c)
    w, d, h = size
    m.add(box(c, size, bevel=0.015, rot=R), mat)
    m.add(box(c + R @ V((0, 0, h / 2 + 0.003)), (0.09, d + 0.006, 0.008), bevel=0.002, rot=R), 'tape')
    for sy in (1, -1):
        m.add(box(c + R @ V((0, sy * (d / 2 + 0.003), h / 2 - 0.06)), (0.09, 0.008, 0.12), bevel=0.002, rot=R), 'tape')


def b_moving_boxes(M):
    m = M.part('boxes')
    carton(m, (-0.27, 0.02, 0.21), (0.54, 0.5, 0.42), 'box')
    carton(m, (0.29, -0.03, 0.17), (0.48, 0.44, 0.34), 'boxLight', rot=0.12)
    carton(m, (-0.2, 0.0, 0.6), (0.48, 0.42, 0.36), 'boxLight', rot=-0.1)
    m.add(box((-0.43, -0.23, 0.26), (0.14, 0.008, 0.1), bevel=0.003), 'paper', outline=False)   # 이름표
    # 오른쪽 상자 위 보따리: 천을 묶은 매듭이 위로
    b = V((0.29, -0.03, 0.34))
    m.add(ellipsoid(b + V((0, 0, 0.1)), (0.17, 0.15, 0.11), seg=20, rings=10), 'cloth')
    for sx in (1, -1):
        m.add(ellipsoid(b + V((sx * 0.05, 0, 0.23)), (0.05, 0.03, 0.06), rot=rot_xyz(y=sx * 0.6), seg=12, rings=6), 'cloth')
    m.add(ellipsoid(b + V((0, 0, 0.2)), (0.04, 0.04, 0.035), seg=10, rings=6), 'cloth')
    for k in range(7):   # 보따리 점무늬
        a = TAU * k / 7 + 0.3
        dz = 0.04 * math.sin(3 * a)
        k = math.sqrt(1 - (dz / 0.11) ** 2)   # 보따리 겉면 위
        m.add(ellipsoid(b + V((math.cos(a) * 0.17 * k, math.sin(a) * 0.15 * k, 0.1 + dz)), (0.02, 0.02, 0.02), seg=8, rings=4), 'clothDot', outline=False)


def pennant(c, w, h, thick=0.008):
    """줄에 매다는 세모 깃발 (앞 -Y 를 본다)"""
    bm = bmesh.new()
    c = V(c)
    pts = [V((-w / 2, 0, 0)), V((w / 2, 0, 0)), V((0, 0, -h))]
    lo = [bm.verts.new(c + p + V((0, -thick / 2, 0))) for p in pts]
    hi = [bm.verts.new(c + p + V((0, thick / 2, 0))) for p in pts]
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    for k in range(3):
        j = (k + 1) % 3
        bm.faces.new([lo[k], hi[k], hi[j], lo[j]])
    return bm


def b_party_balloons(M):
    m = M.part('stand')
    hw, top = 0.75, 1.8
    for sx in (1, -1):
        m.add(cylinder((sx * hw, 0, 0), (sx * hw, 0, 0.05), 0.1, 0.08, seg=14), 'pole')
        m.add(cylinder((sx * hw, 0, 0.05), (sx * hw, 0, top), 0.03, seg=10), 'pole')
        m.add(ellipsoid((sx * hw, 0, top + 0.03), (0.05, 0.05, 0.05), seg=12, rings=8), 'flagA')
    sag = lambda t: V((-hw + 2 * hw * t, 0, top - 0.02 - 0.26 * math.sin(math.pi * t)))
    m.add(tube([sag(i / 20) for i in range(21)], [0.008] * 21, seg=6), 'string')
    for i in range(7):   # 깃발 일곱 + 사이사이 꼬마전구 (밤에 빛난다)
        t = (i + 0.5) / 7
        m.add(pennant(sag(t) + V((0, 0, 0.005)), 0.15, 0.17), 'flagA' if i % 2 == 0 else 'flagB')
        if i:
            m.add(ellipsoid(sag(i / 7) - V((0, 0, 0.035)), (0.025, 0.025, 0.03), seg=10, rings=6), 'glow', outline=False)
    g = V((0, -0.02, 0.1))   # 풍선을 묶은 선물 상자
    m.add(box(g, (0.24, 0.24, 0.2), bevel=0.02), 'gift')
    m.add(box(g, (0.25, 0.05, 0.205), bevel=0.01), 'ribbon')
    m.add(box(g, (0.05, 0.25, 0.205), bevel=0.01), 'ribbon')
    knot = g + V((0, 0, 0.11))
    for sx in (1, -1):
        m.add(ellipsoid(knot + V((sx * 0.045, 0, 0.02)), (0.05, 0.022, 0.035), rot=rot_xyz(y=-sx * 0.5), seg=12, rings=6), 'ribbon')
    b = M.part('balloons')
    for c, col in ((V((-0.33, -0.12, 1.02)), 'balloonRed'), (V((0.02, -0.16, 1.16)), 'balloonYellow'), (V((0.36, -0.1, 1.04)), 'balloonBlue')):
        b.add(ellipsoid(c, (0.16, 0.16, 0.2), seg=24, rings=14), col)
        b.add(cone(c - V((0, 0, 0.19)), c - V((0, 0, 0.24)), 0.012, 0.028, seg=8), col)
        b.add(ellipsoid(c + V((-0.06, -0.12, 0.08)), (0.03, 0.012, 0.05), rot=rot_xyz(y=0.4, z=0.5), seg=10, rings=6), 'shine', outline=False)
        s = bezier(c - V((0, 0, 0.24)), c - V((0, 0, 0.5)), knot + V((0, 0, 0.35)), knot, 14)
        b.add(tube(s, [0.005] * len(s), seg=5), 'string', outline=False)


def text_mesh(body, size, depth):
    """한글 글자를 메시로 (윈도 맑은 고딕). 글꼴이 없으면 None"""
    for path in ('C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf', '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf'):
        if os.path.exists(path):
            break
    else:
        return None
    cu = bpy.data.curves.new('label', 'FONT')
    cu.body, cu.font, cu.size, cu.extrude = body, bpy.data.fonts.load(path), size, depth
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    ob = bpy.data.objects.new('label', cu)
    bpy.context.scene.collection.objects.link(ob)
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    bm = bmesh.new()
    bm.from_mesh(ev.to_mesh())
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return bm


def b_lot_sign(M):
    """빈 집터(주민 집 3×3) 네 귀퉁이 말뚝 + 줄, 앞 가운데 '집터' 팻말. 원점 = 집터 가운데"""
    m = M.part('lot')
    S = 1.32
    corners = [(-S, -S), (S, -S), (S, S), (-S, S)]
    for x, y in corners:
        m.add(box((x, y, 0.2), (0.07, 0.07, 0.4), bevel=0.012), 'stake')
        m.add(cone((x, y, 0.4), (x, y, 0.47), 0.05, 0.0, seg=4), 'stake', smooth=False)
    for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1]):   # 말뚝 사이 늘어진 줄
        pts = [V((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.36 - 0.07 * math.sin(math.pi * t))) for t in (i / 16 for i in range(17))]
        m.add(tube(pts, [0.012] * len(pts), seg=6), 'rope')
    for x, y, rx, ry in ((-0.5, 0.3, 0.55, 0.4), (0.45, -0.25, 0.5, 0.45), (0.2, 0.6, 0.35, 0.3)):   # 고른 흙
        m.add(ellipsoid((x, y, 0.0), (rx, ry, 0.02), seg=20, rings=6), 'dirt', outline=False)
    fy = -S
    m.add(box((0, fy, 0.45), (0.08, 0.08, 0.9), bevel=0.015), 'stake')
    m.add(box((0, fy - 0.045, 0.8), (0.64, 0.05, 0.38), bevel=0.03), 'board')
    label = text_mesh('집터', 0.2, 0.006)
    if label:
        bmesh.ops.transform(label, matrix=Matrix.Translation(V((0, fy - 0.075, 0.795))) @ rot_xyz(x=math.pi / 2).to_4x4(), verts=label.verts)
        m.add(label, 'ink', outline=False, smooth=False)
    else:   # 글꼴이 없으면 집 그림
        m.add(box((0, fy - 0.072, 0.75), (0.16, 0.01, 0.13), bevel=0.004), 'ink', outline=False)
        m.add(prism((0, fy - 0.072, 0.815), 0.01, 0.22, 0.1, ridge='y'), 'ink', outline=False)


# ================================================================ 건물
def house_body(M, W, D, Hh, roofH, door_x=0.0):
    m = M.part('house')
    m.add(box((0, 0, 0.1), (W + 0.14, D + 0.14, 0.2), bevel=0.04), 'foundation')
    m.add(box((0, 0, 0.2 + Hh / 2), (W, D, Hh), bevel=0.06), 'wall')
    top = 0.2 + Hh
    m.add(prism((0, 0, top - 0.02), D, W, roofH * 0.96, ridge='y'), 'wall')
    m.add(prism((0, 0, top + 0.02), D, W, roofH, overhang=0.18, ridge='y'), 'roof')
    m.add(box((door_x, -D / 2 - 0.02, 0.2 + 0.52), (0.56, 0.08, 1.0), bevel=0.04), 'door')
    m.add(ellipsoid((door_x + 0.17, -D / 2 - 0.07, 0.68), (0.035, 0.03, 0.035), seg=10, rings=6), 'trim')
    m.add(box((door_x, -D / 2 - 0.28, 0.06), (0.86, 0.42, 0.12), bevel=0.03), 'foundation')
    return m, top


def window(m, x, y, z, w=0.48, h=0.42):
    m.add(box((x, y, z), (w, 0.07, h), bevel=0.025), 'trim')
    m.add(box((x, y - 0.012, z), (w - 0.1, 0.07, h - 0.1), bevel=0.012), 'window', outline=False)
    m.add(box((x, y - 0.05, z - h / 2 - 0.02), (w + 0.08, 0.1, 0.05), bevel=0.015), 'trim')


def b_house(M):
    W, D, Hh, roofH = 2.4 * P.get('width', 1), 2.2 * P.get('depth', 1), 1.5 * P.get('wallHeight', 1), 1.0 * P.get('roofHeight', 1)
    m, top = house_body(M, W, D, Hh, roofH)
    for sx in (1, -1):
        window(m, sx * W * 0.3, -D / 2 - 0.02, 0.2 + Hh * 0.6)
    m.add(box((W * 0.22, D * 0.18, top + roofH * 0.55), (0.24, 0.24, 0.7), bevel=0.03), 'foundation')
    if spec.get('awning'):
        m.add(box((0, -D / 2 - 0.22, 0.2 + 1.12), (0.95, 0.42, 0.05), bevel=0.02, rot=rot_xyz(x=0.35)), 'roof')


def b_shop(M):
    W, D, Hh = 4.0 * P.get('width', 1), 2.6 * P.get('depth', 1), 1.8 * P.get('wallHeight', 1)
    m = M.part('shop')
    m.add(box((0, 0, 0.1), (W + 0.14, D + 0.14, 0.2), bevel=0.04), 'foundation')
    m.add(box((0, 0, 0.2 + Hh / 2), (W, D, Hh), bevel=0.06), 'wall')
    top = 0.2 + Hh
    m.add(box((0, 0, top + 0.1), (W + 0.24, D + 0.24, 0.2), bevel=0.05), 'roof')
    n = 8
    for i in range(n):   # 줄무늬 차양: 앞으로 기울어진 조각 + 아래 물결 테두리
        x = -W / 2 + (i + 0.5) * W / n
        m.add(box((x, -D / 2 - 0.3, top - 0.15), (W / n, 0.62, 0.05), bevel=0.012, rot=rot_xyz(x=0.42)), 'awningA' if i % 2 else 'awningB')
        m.add(ellipsoid((x, -D / 2 - 0.58, top - 0.29), (W / n / 2, 0.03, 0.09), seg=14, rings=6), 'awningA' if i % 2 else 'awningB')
    m.add(box((0, -D / 2 - 0.02, 0.2 + 0.55), (0.66, 0.08, 1.05), bevel=0.04), 'door')
    for sx in (1, -1):
        window(m, sx * W * 0.29, -D / 2 - 0.02, 0.2 + Hh * 0.45, w=1.1, h=0.9)
    m.add(box((0, -D / 2 - 0.34, 0.06), (1.0, 0.5, 0.12), bevel=0.03), 'foundation')
    sign = V((0, -D / 2 + 0.25, top + 0.2))   # 지붕 위 도토리 간판
    m.add(cylinder(sign, sign + V((0, 0, 0.3)), 0.04, seg=8), 'trim')
    m.add(ellipsoid(sign + V((0, 0, 0.62)), (0.3, 0.26, 0.36), seg=24, rings=14), 'acorn')
    m.add(ellipsoid(sign + V((0, 0, 0.84)), (0.34, 0.3, 0.17), seg=24, rings=10), 'acornCap')
    m.add(cylinder(sign + V((0, 0, 0.95)), sign + V((0.03, 0, 1.08)), 0.03, seg=8), 'acornCap')


def b_museum(M):
    W, D = 5.0 * P.get('width', 1), 3.6 * P.get('depth', 1)
    m = M.part('museum')
    for i, (w, d) in enumerate(((W + 0.9, D + 1.5), (W + 0.6, D + 1.2), (W + 0.3, D + 0.9))):   # 계단식 기단
        m.add(box((0, -0.3, 0.075 + i * 0.15), (w, d, 0.15), bevel=0.03), 'stone')
    base = 0.45
    m.add(box((0, 0.2, base + 1.0), (W, D - 0.4, 2.0), bevel=0.06), 'wall')
    front = -D / 2 - 0.2
    for x in (-W * 0.36, -W * 0.12, W * 0.12, W * 0.36):
        m.add(cylinder((x, front, base), (x, front, base + 2.0), 0.17, seg=16), 'column')
        m.add(box((x, front, base + 2.02), (0.44, 0.44, 0.1), bevel=0.02), 'column')
        m.add(box((x, front, base + 0.05), (0.42, 0.42, 0.1), bevel=0.02), 'column')
    top = base + 2.07
    m.add(box((0, -0.15, top + 0.12), (W + 0.4, D + 0.6, 0.24), bevel=0.04), 'column')
    m.add(prism((0, -0.15, top + 0.24), D + 0.6, W + 0.4, 0.8, ridge='y'), 'column')
    gable_roof(m, (0, -0.15, top + 0.24), D + 0.6, W + 0.4, 0.8, overhang=0.16)
    m.add(box((0, -D / 2 + 0.18, base + 0.65), (0.9, 0.1, 1.3), bevel=0.04), 'door')
    m.add(ellipsoid((0, -D / 2 + 0.18, base + 1.3), (0.45, 0.06, 0.32), seg=20, rings=10), 'door')
    face_y = -0.15 - (D + 0.6) / 2 - 0.1
    spiral = [V((math.cos(t) * 0.022 * t, face_y, top + 0.55 + math.sin(t) * 0.022 * t)) for t in (i * 0.35 for i in range(1, 34))]
    m.add(tube(spiral, [0.018] * len(spiral), seg=8), 'trim', outline=False)   # 박공에 암모나이트 문양


def gable_roof(m, base, length, span, height, overhang=0.15, thick=0.09, mat='roof'):
    """앞뒤로 긴(Y) 박공지붕을 경사판 두 장으로: 앞쪽 삼각 박공면이 가려지지 않는다."""
    base = V(base)
    ang = math.atan2(height, span / 2)
    run = span / 2 + overhang
    L = run / math.cos(ang)
    for sx in (1, -1):
        cx = sx * run / 2
        cz = height - run * math.tan(ang) / 2
        nrm = V((sx * math.sin(ang), 0, math.cos(ang)))
        m.add(box(base + V((cx, 0, cz)) + nrm * thick / 2, (L, length + 2 * overhang, thick), bevel=0.03, rot=rot_xyz(y=sx * ang)), mat)


def b_dock(M):
    L, W = 4.0 * P.get('length', 1), 1.6 * P.get('width', 1)
    m = M.part('dock')
    n = int(L / 0.2)
    for i in range(n):
        y = -(i + 0.5) * L / n
        m.add(box((0, y, 0.35), (W, L / n * 0.88, 0.07), bevel=0.015), 'wood' if i % 2 else 'woodDark')
    for sx in (1, -1):
        m.add(box((sx * (W / 2 - 0.08), -L / 2, 0.28), (0.1, L, 0.1), bevel=0.02), 'woodDark')
        for k in range(int(L) + 1):
            y = -k * L / int(L) if k else -0.1
            m.add(cylinder((sx * (W / 2 - 0.05), y, -0.6), (sx * (W / 2 - 0.05), y, 0.48), 0.08, seg=12), 'woodDark')
    tip = V((W / 2 - 0.25, -L + 0.3, 0.38))
    m.add(cylinder(tip, tip + V((0, 0, 0.34)), 0.09, 0.08, seg=12), 'woodDark')
    m.add(ellipsoid(tip + V((0, 0, 0.36)), (0.1, 0.1, 0.05), seg=12, rings=6), 'woodDark')
    ring = [tip + V((math.cos(a) * 0.12, math.sin(a) * 0.12, 0.2)) for a in (TAU * i / 16 for i in range(16))]
    m.add(tube(ring, [0.022] * 16, seg=8, closed=True), 'rope')


# ================================================================ 타일 (1칸 = 1×1, 윗면 높이 0)
def top_side(top, side, top_z=0.0):
    return lambda c, n: top if n.z > 0.6 and c.z > top_z - 0.06 else side


def b_tile(M):
    t = M.part('tile')
    if KIND == 'tile-grass':
        t.add(box((0, 0, -0.25), (1, 1, 0.5), bevel=0.04), top_side('grass', 'dirt'))
        rnd = random.Random(2)
        for k in range(6):
            x, y = rnd.uniform(-0.38, 0.38), rnd.uniform(-0.38, 0.38)
            t.add(cone((x, y, -0.01), (x + 0.02, y, 0.09), 0.03, 0.002, squash=0.5, seg=6), 'grassDark', outline=False)
    elif KIND == 'tile-sand':
        t.add(box((0, 0, -0.25), (1, 1, 0.5), bevel=0.04), top_side('sand', 'sandDark'))
        for x, y, r in ((0.25, -0.2, 0.04), (-0.3, 0.15, 0.03), (0.05, 0.3, 0.025)):
            t.add(ellipsoid((x, y, 0.005), (r, r * 0.8, r * 0.4), seg=10, rings=6), 'sandDark', outline=False)
    elif KIND == 'tile-path':
        t.add(box((0, 0, -0.25), (1, 1, 0.5), bevel=0.04), top_side('path', 'dirt'))
        rnd = random.Random(4)
        for k in range(6):
            x, y, r = rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35), rnd.uniform(0.03, 0.06)
            t.add(ellipsoid((x, y, 0.004), (r, r * 0.8, r * 0.35), seg=10, rings=6), 'pebble', outline=False)
    elif KIND == 'tile-water':
        t.add(box((0, 0, -0.4), (1, 1, 0.5), bevel=0.02), top_side('water', 'waterDeep', -0.15))
        for x, y, w in ((-0.15, -0.2, 0.22), (0.2, 0.15, 0.16), (-0.25, 0.28, 0.12)):
            t.add(ellipsoid((x, y, -0.148), (w, 0.022, 0.004), seg=12, rings=4), 'waterLight', outline=False)
    elif KIND == 'tile-cliff':
        h = 1.0 * P.get('height', 1)
        layers = max(3, round((h + 0.5) / 0.26))
        lh = (h + 0.5) / layers
        rnd = random.Random(11)
        for i in range(layers):   # 지층: 살짝씩 들쭉날쭉한 판을 번갈아 쌓는다
            inset = rnd.uniform(0.0, 0.025)
            t.add(box((0, 0, -0.5 + lh * (i + 0.5)), (1 - inset, 1 - inset, lh + 0.002), bevel=0.03), 'cliff' if i % 2 else 'cliffDark')
        t.add(box((0, 0, h - 0.04), (1.04, 1.04, 0.1), bevel=0.04), top_side('grass', 'grass'))
    elif KIND == 'tile-ramp':
        h = 1.0 * P.get('height', 1)
        t.add(box((0, 0, -0.25), (1, 2, 0.5), bevel=0.03), top_side('path', 'dirt'))
        t.add(wedge(1.0, 2.0, h), lambda c, n: 'path' if n.z > 0.3 else 'dirt')
        slope = math.atan2(h, 2.0)
        for i in range(5):
            y = -0.8 + i * 0.4
            z = (y + 1.0) / 2.0 * h
            t.add(box((0, y, z + 0.02), (0.9, 0.09, 0.05), bevel=0.012, rot=rot_xyz(x=slope)), 'wood')
    elif KIND == 'tile-plaza':
        t.add(box((0, 0, -0.25), (1, 1, 0.5), bevel=0.03), top_side('grout', 'dirt'))
        for i, (x, y) in enumerate(((-0.24, -0.24), (0.24, -0.24), (-0.24, 0.24), (0.24, 0.24))):
            t.add(box((x, y, 0.02 + 0.006 * (i % 3)), (0.44, 0.44, 0.06), bevel=0.02), 'stone' if i in (0, 3) else 'stoneLight')


# ================================================================ 5차 Z5 축제 (검수 보드 z5: BD-06·07, TI-08, FB-01–05, PR-13–16, FP-01–05)
# 부스·부품 종류는 스펙의 festival 칸 ({"booth": "lantern"} / {"part": "drum"}) 이 정한다.
def turned(bm, angle, at):
    """bmesh 를 Z 축으로 돌리고 옮긴다"""
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(angle, 3, 'Z'))
    bmesh.ops.translate(bm, vec=V(at), verts=bm.verts)
    return bm


def annulus(r0, r1, a0, a1, z0, z1, seg=6):
    """두께 있는 고리 조각 (바닥 무늬)"""
    bm = bmesh.new()
    pts = [a0 + (a1 - a0) * k / seg for k in range(seg + 1)]
    lo = [[bm.verts.new((r * math.cos(a), r * math.sin(a), z0)) for a in pts] for r in (r0, r1)]
    hi = [[bm.verts.new((r * math.cos(a), r * math.sin(a), z1)) for a in pts] for r in (r0, r1)]
    for k in range(seg):
        bm.faces.new([hi[0][k], hi[1][k], hi[1][k + 1], hi[0][k + 1]])
        bm.faces.new([lo[0][k + 1], lo[1][k + 1], lo[1][k], lo[0][k]])
        bm.faces.new([lo[1][k], lo[1][k + 1], hi[1][k + 1], hi[1][k]])
        bm.faces.new([lo[0][k + 1], lo[0][k], hi[0][k], hi[0][k + 1]])
    bm.faces.new([lo[0][0], lo[1][0], hi[1][0], hi[0][0]])
    bm.faces.new([hi[0][seg], hi[1][seg], lo[1][seg], lo[0][seg]])
    return bm


def string_lights(m, a, b, sag, n, z_drop=0.04):
    """두 점 사이에 처진 전구 줄 (전구는 glow — 밤에 켜진다)"""
    a, b = V(a), V(b)
    pt = lambda t: a.lerp(b, t) - V((0, 0, sag * math.sin(math.pi * t)))
    m.add(tube([pt(i / 16) for i in range(17)], [0.012] * 17, seg=6), 'string', outline=False)
    for i in range(1, n + 1):
        m.add(ellipsoid(pt(i / (n + 1)) - V((0, 0, z_drop)), (0.035, 0.035, 0.045), seg=10, rings=6), 'glow', outline=False)


def b_festival_stage(M):
    W, D, H = P.get('width', 5.0), P.get('depth', 3.0), 0.36
    m = M.part('stage')
    # 둘레 두 단 계단 + 무대 바닥 (pads 의 steps 와 같은 높이: 0.12 · 0.24 · 0.36)
    for i, h in enumerate((0.12, 0.24)):
        g = 0.36 - i * 0.18
        m.add(box((0, -g / 2, h / 2), (W + g * 2, D + g, h), bevel=0.02), top_side('step', 'wood', h))
    m.add(box((0, 0, H / 2), (W, D, H), bevel=0.03), top_side('deck', 'wood', H))
    for k in range(1, 6):   # 널빤지 줄
        y = -D / 2 + D * k / 6
        m.add(box((0, y, H + 0.004), (W - 0.1, 0.025, 0.01), bevel=0.0), 'woodDark', outline=False)
    m.add(box((0, -D / 2 - 0.005, H * 0.55), (W - 0.04, 0.02, 0.12), bevel=0.005), 'skirt', outline=False)
    # 뒤 판 (색종이 동그라미)
    m.add(box((0, D / 2 - 0.1, H + 1.05), (W - 0.3, 0.1, 2.1), bevel=0.03), 'backdrop')
    rnd = random.Random(6)
    for k in range(14):
        x, z = rnd.uniform(-W / 2 + 0.45, W / 2 - 0.45), rnd.uniform(H + 0.35, H + 1.9)
        m.add(cylinder((x, D / 2 - 0.16, z), (x, D / 2 - 0.15, z), rnd.uniform(0.07, 0.13), seg=14), ('flagA', 'flagB', 'flagC')[k % 3], outline=False)
    # 기둥 넷 + 천막 지붕 + 앞 주름 천
    top = H + 2.55
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(cylinder((sx * (W / 2 - 0.15), sy * (D / 2 - 0.15), H), (sx * (W / 2 - 0.15), sy * (D / 2 - 0.15), top), 0.07, seg=12), 'wood')
    m.add(prism((0, 0, top), W, D, 0.75, overhang=0.12), 'cloth', smooth=False)
    for k in range(10):
        x = -W / 2 - 0.06 + (W + 0.12) * (k + 0.5) / 10
        m.add(ellipsoid((x, -D / 2 - 0.13, top - 0.02), ((W + 0.12) / 20, 0.03, 0.17), seg=14, rings=8), 'cloth' if k % 2 else 'clothB')
    # 현수막 (🎉 동그라미 무늬) · 전구 줄 · 개막 종
    m.add(box((0, -D / 2 + 0.1, top - 0.42), (W * 0.62, 0.05, 0.46), bevel=0.02), 'banner')
    for k, x in enumerate((-0.9, -0.45, 0, 0.45, 0.9)):
        m.add(cylinder((x * W / 5, -D / 2 + 0.07, top - 0.42), (x * W / 5, -D / 2 + 0.06, top - 0.42), 0.11, seg=16), ('flagA', 'flagB', 'flagC')[k % 3], outline=False)
    string_lights(m, (-W / 2 + 0.15, -D / 2 + 0.15, top - 0.08), (W / 2 - 0.15, -D / 2 + 0.15, top - 0.08), 0.25, 9)
    m.add(cylinder((-W / 2 + 0.45, -D / 2 + 0.15, top - 0.15), (-W / 2 + 0.45, -D / 2 + 0.15, top - 0.45), 0.012, seg=6), 'string', outline=False)
    m.add(cone((-W / 2 + 0.45, -D / 2 + 0.15, top - 0.75), (-W / 2 + 0.45, -D / 2 + 0.15, top - 0.45), 0.16, 0.07, seg=16), 'bell')
    m.add(ellipsoid((-W / 2 + 0.45, -D / 2 + 0.15, top - 0.78), (0.04, 0.04, 0.04), seg=10, rings=6), 'metal')


def b_festival_arch(M):
    W, Ht = P.get('width', 2.6), 2.7
    m = M.part('arch')
    for sx in (1, -1):
        m.add(cylinder((sx * W / 2, 0, 0), (sx * W / 2, 0, 0.12), 0.18, 0.15, seg=14), 'stone')
        m.add(cylinder((sx * W / 2, 0, 0.1), (sx * W / 2, 0, Ht - 0.2), 0.09, seg=12), 'wood')
    arc = [V((-W / 2 + W * t, 0, Ht - 0.25 + 0.35 * math.sin(math.pi * t))) for t in (i / 18 for i in range(19))]
    m.add(tube(arc, [0.1] * 19, seg=10), 'wood')
    rnd = random.Random(8)
    for k in range(13):   # 꽃 덩굴
        t = k / 12
        p = arc[round(t * 18)] if k % 3 else V((rnd.choice((-1, 1)) * W / 2, 0, rnd.uniform(0.6, Ht - 0.4)))
        m.add(ellipsoid(p + V((rnd.uniform(-0.05, 0.05), -0.08, 0.05)), (0.13, 0.08, 0.12), seg=12, rings=8), 'leaf')
        m.add(ellipsoid(p + V((rnd.uniform(-0.06, 0.06), -0.16, 0.08)), (0.08, 0.05, 0.08), seg=10, rings=6), ('flowerA', 'flowerB', 'flowerC')[k % 3])
    for k in range(5):   # 깃발
        t = (k + 0.5) / 5
        p = arc[round(t * 18)]
        m.add(pennant(p - V((0, 0.02, 0.1)), 0.2, 0.26), ('flagA', 'flagB', 'flagC')[k % 3])


def b_festival_floor(M):
    R = P.get('radius', 6.0)
    m = M.part('floor')
    m.add(cylinder((0, 0, 0), (0, 0, 0.02), R, seg=72), 'stone', outline=False)
    rings = [(0.0, 0.9, 'center', 1), (0.9, 1.15, 'line', 24), (1.15, 2.2, None, 12), (2.2, 2.4, 'line', 36), (3.9, 4.1, 'line', 48), (5.6, 5.95, 'edge', 60)]
    cols = ('stoneA', 'stoneB', 'stoneC')
    for r0, r1, mat, n in rings:
        for k in range(n):
            a0, a1 = TAU * k / n, TAU * (k + 1) / n - (0.02 if n > 1 else 0)
            m.add(annulus(max(r0, 0.001), r1, a0, a1, 0.02, 0.035, seg=max(2, 72 // max(n, 1))), mat or cols[k % 3], outline=False)
    for k in range(16):   # 해 모양 빛살
        a = TAU * k / 16
        m.add(annulus(2.5, 3.8, a - 0.06, a + 0.06, 0.02, 0.03, seg=2), cols[k % 3], outline=False)


BOOTH_GOODS = {}


def goods(name):
    def deco(fn):
        BOOTH_GOODS[name] = fn
        return fn
    return deco


def jar_lantern(m, c, s=1.0, glow='glow'):
    c = V(c)
    m.add(cylinder(c, c + V((0, 0, 0.26 * s)), 0.1 * s, 0.11 * s, seg=16), 'jar')
    m.add(cylinder(c + V((0, 0, 0.25 * s)), c + V((0, 0, 0.3 * s)), 0.08 * s, seg=14), 'lid')
    m.add(tube(bezier(c + V((-0.07 * s, 0, 0.3 * s)), c + V((-0.07 * s, 0, 0.42 * s)), c + V((0.07 * s, 0, 0.42 * s)), c + V((0.07 * s, 0, 0.3 * s)), 8), [0.008 * s] * 9, seg=5), 'lid', outline=False)
    for k, (dx, dz) in enumerate(((-0.03, 0.07), (0.035, 0.12), (0.0, 0.18), (-0.02, 0.21))):
        m.add(ellipsoid(c + V((dx * s, -0.04 * s, dz * s)), (0.022 * s, 0.022 * s, 0.022 * s), seg=8, rings=5), glow, outline=False)


@goods('lantern')
def g_lantern(m, z):
    for x in (-0.6, 0, 0.6):
        jar_lantern(m, (x, -0.05, z), 1.0)


@goods('music')
def g_music(m, z):
    m.add(cylinder((0, -0.05, z), (0, -0.05, z + 0.32), 0.3, seg=24), 'drumBody')
    m.add(cylinder((0, -0.05, z + 0.32), (0, -0.05, z + 0.35), 0.31, seg=24), 'drumHead')
    for sx in (1, -1):
        m.add(capsule((sx * 0.12, -0.15, z + 0.38), (sx * 0.42, -0.35, z + 0.62), 0.022, seg=8, rings=4), 'stick')
    for x in (-0.75, 0.75):
        m.add(cylinder((x, 0.0, z), (x, 0.0, z + 0.22), 0.14, seg=16), 'drumBody')
        m.add(cylinder((x, 0.0, z + 0.22), (x, 0.0, z + 0.24), 0.15, seg=16), 'drumHead')


@goods('flower')
def g_flower(m, z):
    for k, x in enumerate((-0.6, 0.0, 0.6)):
        m.add(cylinder((x, 0, z), (x, 0, z + 0.18), 0.12, 0.15, seg=14), 'pot')
        for j in range(5):
            a = TAU * j / 5
            m.add(ellipsoid((x + 0.08 * math.cos(a), 0.08 * math.sin(a), z + 0.3), (0.07, 0.07, 0.06), seg=10, rings=6), ('petalA', 'petalB', 'petalC')[(k + j) % 3])
        m.add(ellipsoid((x, 0, z + 0.25), (0.13, 0.13, 0.06), seg=12, rings=6), 'leaf')
    ring = [V((0.35 * math.cos(TAU * i / 20), -0.32, z + 0.55 + 0.35 * math.sin(TAU * i / 20))) for i in range(20)]
    m.add(tube(ring, [0.035] * 20, seg=8, closed=True), 'leaf')


@goods('food')
def g_food(m, z):
    m.add(cylinder((-0.45, 0, z), (-0.45, 0, z + 0.3), 0.3, 0.26, seg=20), 'metal')
    for k, (dx, dy) in enumerate(((-0.1, -0.05), (0.08, 0.06), (0.02, -0.12))):
        m.add(ellipsoid((-0.45 + dx, dy, z + 0.34), (0.1, 0.1, 0.1), seg=12, rings=8), ('fruitA', 'fruitB', 'fruitC')[k])
    m.add(cylinder((0.35, -0.05, z), (0.35, -0.05, z + 0.1), 0.24, 0.2, seg=20), 'pie')
    m.add(cylinder((0.35, -0.05, z + 0.1), (0.35, -0.05, z + 0.12), 0.2, seg=20), 'fruitA', outline=False)
    for k, x in enumerate((0.75, 0.95)):
        m.add(cylinder((x, -0.2, z), (x, -0.2, z + 0.22), 0.06, 0.075, seg=12), ('fruitB', 'fruitC')[k])


@goods('fish')
def g_fish(m, z):
    m.add(box((-0.3, 0, z + 0.22), (0.9, 0.45, 0.44), bevel=0.03), 'glass')
    m.add(box((-0.3, 0, z + 0.17), (0.84, 0.4, 0.32), bevel=0.02), 'water', outline=False)
    for k, (x, h) in enumerate(((-0.5, 0.18), (-0.15, 0.28))):
        m.add(ellipsoid((x, -0.05, z + h), (0.11, 0.04, 0.06), seg=12, rings=6), 'fish')
        m.add(cone((x + 0.1, -0.05, z + h), (x + 0.18, -0.05, z + h), 0.05, 0.0, squash=0.4, seg=6), 'fish')
    m.add(box((0.6, 0.05, z + 0.32), (0.42, 0.05, 0.64), bevel=0.02), 'boardW')
    for k, hh in enumerate((0.3, 0.45, 0.22)):
        m.add(box((0.48 + k * 0.12, 0.02, z + 0.08 + hh / 2), (0.07, 0.02, hh), bevel=0.005), 'band', outline=False)


def booth_frame(M, label=True):
    """3×2칸 부스 몸: 뒤 벽 · 기둥 · 줄무늬 차양 · 앞 판매대 · 위 팻말. 판매대 윗면 높이를 돌려준다"""
    W, D = 2.8, 1.7
    m = M.part('booth')
    m.add(box((0, D / 2 - 0.08, 1.05), (W - 0.2, 0.1, 2.0), bevel=0.02), 'wall')
    for sx in (1, -1):
        for y, top_z in ((-D / 2 + 0.12, 1.93), (D / 2 - 0.12, 2.28)):   # 앞기둥은 차양 아래까지
            m.add(cylinder((sx * (W / 2 - 0.1), y, 0), (sx * (W / 2 - 0.1), y, top_z), 0.06, seg=10), 'wood')
    n = 7
    for k in range(n):   # 줄무늬 차양: 뒤가 높고 앞으로 기운다
        x0, x1 = -W / 2 - 0.08 + (W + 0.16) * k / n, -W / 2 - 0.08 + (W + 0.16) * (k + 1) / n
        bm = bmesh.new()
        pts = [(x0, D / 2, 2.3), (x1, D / 2, 2.3), (x1, -D / 2 - 0.2, 1.9), (x0, -D / 2 - 0.2, 1.9)]
        lo = [bm.verts.new(V(p)) for p in pts]
        hi = [bm.verts.new(V(p) + V((0, 0, 0.04))) for p in pts]
        bm.faces.new(list(reversed(lo)))
        bm.faces.new(hi)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
        mat = 'awningA' if k % 2 == 0 else 'awningB'
        m.add(bm, mat, smooth=False)
        m.add(ellipsoid(((x0 + x1) / 2, -D / 2 - 0.2, 1.9), ((x1 - x0) / 2, 0.03, 0.13), seg=12, rings=6), mat)
    top = 0.95
    m.add(box((0, -D / 2 + 0.35, top / 2), (W, 0.6, top), bevel=0.03), top_side('counter', 'woodDark', top))
    m.add(box((0, -D / 2 + 0.04, top * 0.55), (W - 0.04, 0.02, 0.2), bevel=0.005), 'band', outline=False)
    if label:
        m.add(box((0, -D / 2 - 0.1, 2.45), (0.8, 0.06, 0.38), bevel=0.05), 'sign')
        m.add(cylinder((0, -D / 2 - 0.14, 2.45), (0, -D / 2 - 0.13, 2.45), 0.12, seg=16), 'awningA', outline=False)
    return m, top, D


def b_festival_booth(M):
    m, top, D = booth_frame(M)
    g = M.part('goods')
    BOOTH_GOODS[spec['festival']['booth']](g, top)
    # 판매대 위 물건은 판매대 앞쪽으로
    bmesh.ops.translate(g.bm, vec=V((0, -D / 2 + 0.35, 0)), verts=g.bm.verts)


def b_festival_cover(M):
    W, D = 2.8, 1.7
    m = M.part('cover')
    m.add(box((0, 0, 1.0), (W, D, 2.0), bevel=0.55, segments=5), 'cloth')   # 천을 덮은 둥근 덩어리
    for z in (0.6, 1.5):
        ring = [V(((W / 2 + 0.02) * math.cos(TAU * i / 32), (D / 2 + 0.02) * math.sin(TAU * i / 32), z)) for i in range(32)]
        m.add(tube(ring, [0.025] * 32, seg=6, closed=True), 'rope')
    m.add(box((0, -D / 2 - 0.08, 0.45), (0.04, 0.04, 0.9), bevel=0.01), 'wood')
    m.add(box((0, -D / 2 - 0.1, 0.95), (0.6, 0.05, 0.42), bevel=0.04), 'sign')
    for k, (x, z, r) in enumerate(((-0.12, 0.92, 0.09), (0.06, 1.0, 0.11), (0.16, 0.9, 0.06))):   # 💭 생각 풍선
        m.add(ellipsoid((x, -D / 2 - 0.14, z), (r, 0.015, r * 0.8), seg=12, rings=6), 'mark', outline=False)


def b_festival_lantern(M):
    Ht = P.get('height', 2.6)
    m = M.part('post')
    m.add(cylinder((0, 0, 0), (0, 0, 0.1), 0.14, 0.12, seg=14), 'stone')
    m.add(cylinder((0, 0, 0.08), (0, 0, Ht), 0.05, seg=10), 'wood')
    m.add(ellipsoid((0, 0, Ht + 0.03), (0.07, 0.07, 0.06), seg=12, rings=6), 'wood')
    m.add(box((0, -0.16, Ht - 0.12), (0.04, 0.34, 0.04), bevel=0.01), 'wood')
    jar_lantern(m, (0, -0.3, Ht - 0.62), 1.15)


def b_festival_garland(M):
    L, sag = P.get('length', 4.6), 0.45
    m = M.part('garland')
    pt = lambda t: V((-L / 2 + L * t, 0, -sag * math.sin(math.pi * t)))
    m.add(tube([pt(i / 24) for i in range(25)], [0.012] * 25, seg=6), 'string', outline=False)
    n = 11
    for i in range(n):
        t = (i + 0.5) / n
        m.add(pennant(pt(t) + V((0, 0, 0.005)), 0.22, 0.26), ('flagA', 'flagB', 'flagC', 'flagD', 'flagE')[i % 5])


def b_festival_board(M):
    W = 1.9
    m = M.part('board')
    for sx in (1, -1):
        m.add(box((sx * (W / 2 - 0.08), 0.02, 0.7), (0.09, 0.09, 1.4), bevel=0.015), 'wood')
    m.add(box((0, 0.05, 1.0), (W, 0.08, 0.72), bevel=0.04), 'board')
    m.add(prism((0, 0.05, 1.36), W + 0.12, 0.26, 0.16, overhang=0.03), 'roof')
    for k in range(5):   # 부품 다섯 자리 (검은 실루엣) + 앞 선반
        x = -W / 2 + 0.25 + (W - 0.5) * k / 4
        m.add(box((x, 0.0, 1.0), (0.3, 0.02, 0.5), bevel=0.04), 'slot', outline=False)
        m.add(box((x, -0.12, 0.6), (0.34, 0.22, 0.04), bevel=0.01), 'wood')


PART_SHAPES = {}


def part_shape(name):
    def deco(fn):
        PART_SHAPES[name] = fn
        return fn
    return deco


@part_shape('lantern')
def p_lantern(m):
    jar_lantern(m, (0, 0, 0), 1.25)


@part_shape('drum')
def p_drum(m):
    m.add(cylinder((0, 0, 0), (0, 0, 0.26), 0.19, seg=20), 'drumBody')
    m.add(cylinder((0, 0, 0.26), (0, 0, 0.28), 0.2, seg=20), 'drumHead')
    zig = [V((0.195 * math.cos(TAU * i / 16), 0.195 * math.sin(TAU * i / 16), 0.05 + 0.16 * (i % 2))) for i in range(16)]
    m.add(tube(zig, [0.012] * 16, seg=5, closed=True), 'trim', outline=False)
    for sx in (1, -1):
        m.add(capsule((sx * 0.06, -0.05, 0.3), (sx * 0.2, -0.15, 0.46), 0.016, seg=8, rings=4), 'stick')


@part_shape('garland')
def p_garland(m):
    pt = lambda t: V((-0.22 + 0.44 * t, 0, 0.36 - 0.12 * math.sin(math.pi * t)))
    m.add(tube([pt(i / 12) for i in range(13)], [0.01] * 13, seg=5), 'string', outline=False)
    for i in range(5):
        m.add(pennant(pt((i + 0.5) / 5), 0.08, 0.11), ('flagA', 'flagB', 'flagC')[i % 3])
    m.add(ellipsoid((0, -0.02, 0.1), (0.1, 0.1, 0.1), seg=12, rings=8), 'flagA')
    m.add(ellipsoid((0, -0.09, 0.12), (0.045, 0.03, 0.045), seg=10, rings=6), 'flagC')


@part_shape('pot')
def p_pot(m):
    m.add(cylinder((0, 0, 0), (0, 0, 0.2), 0.16, 0.2, seg=20), 'metal')
    m.add(cylinder((0, 0, 0.2), (0, 0, 0.23), 0.22, seg=20), 'trim')
    for k, (dx, dy) in enumerate(((-0.06, -0.03), (0.07, 0.04), (0.0, -0.08))):
        m.add(ellipsoid((dx, dy, 0.28), (0.07, 0.07, 0.07), seg=12, rings=8), ('fruitA', 'fruitB', 'fruitC')[k])


@part_shape('flag')
def p_flag(m):
    m.add(cylinder((-0.12, 0, 0), (-0.12, 0, 0.5), 0.015, seg=8), 'stick')
    bm = bmesh.new()
    pts = [(-0.11, 0, 0.48), (0.18, 0, 0.48), (0.12, 0, 0.39), (0.18, 0, 0.3), (-0.11, 0, 0.3)]
    lo = [bm.verts.new(V(p) - V((0, 0.006, 0))) for p in pts]
    hi = [bm.verts.new(V(p) + V((0, 0.006, 0))) for p in pts]
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    for i in range(5):
        j = (i + 1) % 5
        bm.faces.new([lo[i], hi[i], hi[j], lo[j]])
    m.add(bm, 'flagA', smooth=False)
    m.add(ellipsoid((0.02, -0.01, 0.39), (0.045, 0.01, 0.022), seg=10, rings=5), 'trim', outline=False)
    m.add(ellipsoid((-0.12, 0, 0.0), (0.06, 0.06, 0.02), seg=12, rings=5), 'stick')


def b_festival_part(M):
    PART_SHAPES[spec['festival']['part']](M.part('part'))


# ================================================================ 8차 M8 계절 행사 (보드 wave8)
def b_cherry_tree(M):
    """EN-12 벚나무: 굽은 줄기 위에서 가지 넷이 옆으로 길게 퍼지고, 가지 끝마다 납작한 꽃 구름이 따로 떠 있다 (가지가 사이로 보임).
    봄엔 분홍 꽃 + 나무 밑에 떨어진 꽃잎. 동글동글한 활엽수(EN-01)와 달리 옆으로 넓고 낮다."""
    th, cs = P.get('trunkHeight', 1), P.get('canopySize', 1)
    trunk = M.part('trunk')
    pts = bezier((0, 0, 0), (0.03, 0, 0.35 * th), (-0.1, 0.03, 0.62 * th), (0.02, 0, 0.82 * th), 8)
    trunk.add(tube(pts, [0.17 - 0.06 * i / 8 for i in range(len(pts))], seg=14), 'trunk')
    trunk.add(ellipsoid((0, 0, 0.04), (0.25, 0.25, 0.1), seg=16, rings=8), 'trunk')
    top = pts[-1]
    tips = []
    for yaw, out, up in ((0.25, 0.95, 0.42), (1.85, 0.85, 0.55), (3.4, 0.98, 0.38), (4.9, 0.8, 0.6)):
        d = V((math.cos(yaw), math.sin(yaw), 0))
        br = bezier(top - V((0, 0, 0.08)), top + d * out * 0.35 + V((0, 0, up * 0.55)), top + d * out * 0.75 + V((0, 0, up * 0.85)), top + d * out * cs + V((0, 0, up)), 7)
        trunk.add(tube(br, [0.085 - 0.05 * i / 7 for i in range(len(br))], seg=10), 'trunk')
        tips.append(br[-1])
    can = M.part('canopy', pivot=(0, 0, top.z))
    can.add(ellipsoid(top + V((0, 0, 0.8)), (0.42 * cs, 0.42 * cs, 0.26 * cs), seg=22, rings=10), 'leaf')
    for i, t in enumerate(tips):
        can.add(ellipsoid(t + V((0, 0, 0.1)), (0.46 * cs, 0.42 * cs, 0.24 * cs), rot=rot_xyz(z=i * 0.8), seg=22, rings=10), 'leaf')
        side = V((math.cos(i * 1.7), math.sin(i * 1.7), 0)) * 0.24 * cs   # 옆에 붙은 작은 뭉치 (구름처럼 울퉁불퉁)
        can.add(ellipsoid(t + side + V((0, 0, 0.2 * cs)), (0.28 * cs, 0.26 * cs, 0.2 * cs), seg=18, rings=10), 'leaf')
        for j in range(3):   # 꽃 구름 위 밝은 꽃송이
            a = TAU * j / 3 + i
            can.add(ellipsoid(t + V((math.cos(a) * 0.22 * cs, math.sin(a) * 0.22 * cs, 0.27 * cs)), (0.12 * cs, 0.12 * cs, 0.07 * cs), seg=12, rings=6), 'bloom', outline=False)
    ground = M.part('petals')   # 나무 밑에 떨어진 꽃잎 (땅에 붙은 얇은 조각, 외곽선 없음)
    for k in range(14):
        a, r = TAU * k / 14 + 0.3 * (k % 3), 0.35 + 0.22 * ((k * 7) % 5)
        ground.add(ellipsoid((math.cos(a) * r, math.sin(a) * r, 0.012), (0.055, 0.032, 0.008), rot=rot_xyz(z=a * 1.7), seg=8, rings=4), 'bloom', outline=False)


def b_picnic_mat(M):
    """PR-17 꽃놀이 돗자리·도시락: 2×2칸 체크 돗자리(칸마다 두 색) + 가운데 3단 도시락과 보자기."""
    W = 1.8 * P.get('size', 1)
    m = M.part('mat')
    n = 6
    for i in range(n):
        for j in range(n):
            x, y = -W / 2 + (i + 0.5) * W / n, -W / 2 + (j + 0.5) * W / n
            m.add(box((x, y, 0.012), (W / n, W / n, 0.024), bevel=0.004), 'matA' if (i + j) % 2 else 'matB', outline=False)
    m.add(box((0, 0, 0.004), (W + 0.03, W + 0.03, 0.008), bevel=0.004), 'matB')
    box_ = M.part('lunch', pivot=(0.15, 0.1, 0.03))
    for k, z in enumerate((0.03, 0.13, 0.23)):
        box_.add(box((0.15, 0.1, z + 0.05), (0.34, 0.34, 0.1), bevel=0.02), 'lunch' if k % 2 == 0 else 'lunchDark')
    box_.add(box((0.15, 0.1, 0.345), (0.36, 0.36, 0.03), bevel=0.012), 'lunchDark')
    box_.add(ellipsoid((0.15, 0.1, 0.38), (0.09, 0.06, 0.05), seg=10, rings=6), 'cloth')
    for sx in (1, -1):
        box_.add(ellipsoid((0.15 + sx * 0.07, 0.1, 0.41), (0.05, 0.03, 0.04), rot=rot_xyz(y=sx * 0.6), seg=10, rings=6), 'cloth')
    for x, y in ((-0.45, -0.35), (-0.25, 0.45)):   # 작은 찻잔 둘
        box_.add(cylinder((x, y, 0.024), (x, y, 0.1), 0.05, 0.06, seg=14), 'cup')


def b_event_sign(M):
    """PR-23 행사 간판: 나무 받침에 선 세움 간판. 가운데 그림판(plate)은 행사마다 색 변형 넷 + 위에 작은 지붕."""
    m = M.part('sign')
    for sx in (1, -1):
        m.add(box((sx * 0.42, 0, 0.55), (0.07, 0.07, 1.1), bevel=0.015), 'wood')
        m.add(box((sx * 0.42, 0, 0.03), (0.2, 0.3, 0.06), bevel=0.015), 'wood')
    m.add(box((0, 0, 0.82), (0.96, 0.08, 0.62), bevel=0.04), 'board')
    m.add(box((0, -0.045, 0.86), (0.74, 0.01, 0.44), bevel=0.01), 'plate', outline=False)
    m.add(ellipsoid((0, -0.055, 0.9), (0.12, 0.01, 0.12), seg=16, rings=6), 'mark', outline=False)
    for k in range(4):
        m.add(box((-0.2 + k * 0.13, -0.052, 0.7), (0.09, 0.01, 0.03), bevel=0.004), 'mark', outline=False)
    m.add(prism((0, 0, 1.13), 1.08, 0.22, 0.14, overhang=0.02), 'roof')


def b_fireworks_raft(M):
    """PR-18 불꽃 발사대 (8차 여름 불꽃놀이): 남쪽 바다 위 나무 뗏목에 발사 통 셋. 통마다 띠, 가장자리 밧줄과 작은 깃발. 불꽃놀이 밤에만 보인다."""
    m = M.part('raft')
    L, W = 1.6, 1.2
    for i in range(6):   # 통나무 판
        y = -W / 2 + (i + 0.5) * W / 6
        m.add(cylinder((-L / 2, y, 0.08), (L / 2, y, 0.08), W / 12 * 0.95, seg=12), 'wood' if i % 2 else 'woodDark')
    for x in (-0.6, 0.6):
        m.add(box((x, 0, 0.17), (0.12, W + 0.04, 0.05), bevel=0.015), 'woodDark')
    for k, (x, y, h) in enumerate(((-0.35, -0.15, 0.42), (0.05, 0.2, 0.52), (0.42, -0.12, 0.36))):
        m.add(cylinder((x, y, 0.15), (x, y, 0.15 + h), 0.12, 0.11, seg=18), 'tube')
        m.add(cylinder((x, y, 0.15 + h - 0.02), (x, y, 0.15 + h + 0.01), 0.13, seg=18), 'band')
        m.add(cylinder((x, y, 0.15 + h * 0.4), (x, y, 0.15 + h * 0.4 + 0.05), 0.125, seg=18), 'band')
        m.add(cylinder((x, y, 0.15 + h + 0.005), (x, y, 0.15 + h + 0.012), 0.085, seg=14), 'hole', outline=False)
    pts = [V((-L / 2 - 0.02, -W / 2, 0.2)), V((L / 2 + 0.02, -W / 2, 0.2)), V((L / 2 + 0.02, W / 2, 0.2)), V((-L / 2 - 0.02, W / 2, 0.2))]
    m.add(tube(pts, [0.025] * 4, seg=8, closed=True), 'rope')
    m.add(cylinder((0.7, 0.5, 0.15), (0.7, 0.5, 0.75), 0.018, seg=8), 'woodDark')
    m.add(box((0.79, 0.5, 0.66), (0.18, 0.012, 0.12), bevel=0.004), 'flag')


def b_harvest_pot(M):
    """PR-19 수확 큰 솥 (8차 가을 수확 잔치): 장작불 위 돌 받침에 얹힌 지름 2칸 무쇠 솥. 국물 위에 과일·버섯이 떠 있고 김이 오른다.
    축제 과일 솥(FP-04)보다 크고 낮다. 불꽃은 'flame' 덩어리라 flicker 로 일렁인다."""
    m = M.part('pot')
    for k in range(10):   # 돌 받침
        a = TAU * k / 10
        m.add(jitter(ellipsoid((math.cos(a) * 0.78, math.sin(a) * 0.78, 0.07), (0.15, 0.13, 0.1), seg=8, rings=5), 0.015, k, keep_bottom=0.0), 'stone', smooth=False)
    for k in range(4):   # 장작
        a = TAU * k / 4 + 0.4
        d = V((math.cos(a), math.sin(a), 0))
        m.add(capsule(d * 0.55 + V((0, 0, 0.06)), -d * 0.1 + V((0, 0, 0.12)), 0.06, seg=10, rings=6), 'wood')
    zb = 0.48   # 솥 밑 — 돌 받침 위로 띄워 아래 불이 보이게
    for k in range(3):   # 솥을 받치는 돌 기둥 셋
        a = TAU * k / 3 + 0.2
        m.add(jitter(box((math.cos(a) * 0.6, math.sin(a) * 0.6, zb / 2), (0.2, 0.2, zb), bevel=0.04), 0.01, k + 20, keep_bottom=0.0), 'stone', smooth=False)
    m.add(cylinder((0, 0, zb + 0.1), (0, 0, zb + 0.5), 0.7, 0.8, seg=32), 'iron')
    m.add(ellipsoid((0, 0, zb + 0.12), (0.7, 0.7, 0.16), seg=32, rings=10), 'iron')
    ring = [V((math.cos(TAU * i / 32) * 0.8, math.sin(TAU * i / 32) * 0.8, zb + 0.52)) for i in range(32)]
    m.add(tube(ring, [0.05] * 32, seg=10, closed=True), 'rim')
    m.add(cylinder((0, 0, zb + 0.5), (0, 0, zb + 0.515), 0.77, seg=32), 'soup', outline=False)   # 솥 몸통 윗면 바로 위
    for sx in (1, -1):   # 손잡이
        m.add(tube([V((sx * 0.8, -0.12, zb + 0.4)), V((sx * 0.95, 0, zb + 0.46)), V((sx * 0.8, 0.12, zb + 0.4))], [0.025] * 3, seg=8), 'ironDark')
    for k, (x, y, c, r) in enumerate(((-0.3, 0.1, 'fruitA', 0.11), (0.2, -0.25, 'fruitB', 0.1), (0.25, 0.3, 'shroom', 0.08), (-0.1, -0.35, 'fruitA', 0.09))):
        m.add(ellipsoid((x, y, zb + 0.53), (r, r, r * 0.7), seg=14, rings=8), c)
    fl = M.part('flame', pivot=(0, 0, 0.1))
    for k in range(3):
        a = TAU * k / 3 + 0.9
        p = V((math.cos(a) * 0.22, math.sin(a) * 0.22, 0.1))
        fl.add(cone(p, p + V((0, 0, 0.34)), 0.13, 0.0, seg=10), 'flame', outline=False)
        fl.add(cone(p + V((0, -0.03, 0)), p + V((0, -0.03, 0.2)), 0.07, 0.0, seg=8), 'flameCore', outline=False)
    st = M.part('steam')
    for k, (x, y, z, r) in enumerate(((-0.15, 0.05, 1.2, 0.14), (0.12, -0.05, 1.42, 0.11), (-0.05, 0.1, 1.62, 0.08))):
        st.add(ellipsoid((x, y, z), (r, r, r * 0.85), seg=14, rings=8), 'steam', outline=False)


def b_scarecrow(M):
    """PR-20 허수아비 (8차 가을 수확 잔치): 나무 기둥·가로대에 퐁을 닮은 노란 옷, 자루 얼굴, 밀짚모자. 소매 끝과 목에 밀짚이 삐져나온다."""
    m = M.part('scarecrow')
    m.add(box((0, 0, 0.7), (0.07, 0.07, 1.4), bevel=0.015), 'wood')
    m.add(box((0, 0, 1.02), (1.0, 0.06, 0.06), bevel=0.015), 'wood')
    m.add(box((0, 0, 0.88), (0.5, 0.2, 0.42), bevel=0.06), 'shirt')
    for sx in (1, -1):
        m.add(box((sx * 0.37, 0, 1.02), (0.26, 0.16, 0.16), bevel=0.05), 'shirt')
        for k in range(3):
            m.add(cone(V((sx * 0.5, 0, 1.02)), V((sx * 0.62, (k - 1) * 0.05, 0.98 + 0.03 * k)), 0.03, 0.0, seg=6), 'straw', outline=False)
    m.add(box((0, -0.105, 0.82), (0.12, 0.01, 0.1), bevel=0.01), 'patch', outline=False)
    m.add(ellipsoid((0, 0, 1.33), (0.19, 0.17, 0.2), seg=20, rings=12), 'sack')
    for sx in (1, -1):
        m.add(ellipsoid((sx * 0.07, -0.16, 1.36), (0.025, 0.01, 0.025), seg=8, rings=5), 'face', outline=False)
    m.add(box((0, -0.165, 1.27), (0.1, 0.008, 0.015), bevel=0.003), 'face', outline=False)
    for k in range(6):   # 목 밀짚
        a = TAU * k / 6
        m.add(cone(V((math.cos(a) * 0.08, math.sin(a) * 0.08, 1.14)), V((math.cos(a) * 0.15, math.sin(a) * 0.15, 1.1)), 0.025, 0.0, seg=6), 'straw', outline=False)
    m.add(cylinder((0, 0, 1.46), (0, 0, 1.49), 0.34, 0.32, seg=28), 'hat')
    m.add(cylinder((0, 0, 1.49), (0, 0, 1.64), 0.17, 0.15, seg=24), 'hat')
    m.add(cylinder((0, 0, 1.5), (0, 0, 1.55), 0.175, seg=24), 'hatBand')


def b_snowball(M):
    """PR-21 눈덩이 (8차 겨울 눈사람 날): 굴리면 커지는 눈덩이. 살짝 울퉁불퉁한 공 + 붙은 눈 뭉치·풀잎 조각. 크기는 게임이 모델 하나를 늘린다 (지름 0.4 → 1.6칸)."""
    m = M.part('ball', pivot=(0, 0, 0.4))
    m.add(ellipsoid((0, 0, 0.4), (0.4, 0.4, 0.39), seg=28, rings=16), 'snow')
    for k, (a, z, r) in enumerate(((0.3, 0.55, 0.1), (2.1, 0.3, 0.09), (3.9, 0.66, 0.08), (5.2, 0.22, 0.11), (1.2, 0.74, 0.07))):
        d = V((math.cos(a), math.sin(a), 0))
        hr = math.sqrt(max(0.0, 0.4 ** 2 - (z - 0.4) ** 2))   # 그 높이의 공 겉면
        m.add(ellipsoid(V((0, 0, z)) + d * hr * 0.96, (r, r, r * 0.8), seg=12, rings=8), 'snowShade')
    for k, a in enumerate((1.0, 4.4)):
        d = V((math.cos(a), math.sin(a), 0))
        m.add(ellipsoid(V((0, 0, 0.45)) + d * 0.39, (0.05, 0.012, 0.018), rot=rot_xyz(z=a + 1.2), seg=8, rings=4), 'grass', outline=False)


def b_snowman(M):
    """PR-22 눈사람 (8차 겨울 눈사람 날): 몸·머리 두 덩이(따로 된 덩어리 'body'·'head' — 게임이 굴린 크기대로 늘리고 비율로 표정을 고른다),
    숯 눈·입, 당근 코, 나뭇가지 팔, 목도리. 기본 표정은 웃음 (나머지 셋 😮·😌·🙂 은 M8-P6 놀이에서 입 모양을 바꿔 끼움)."""
    b = M.part('body', pivot=(0, 0, 0))
    b.add(jitter(ellipsoid((0, 0, 0.36), (0.38, 0.38, 0.36), seg=28, rings=16), 0.008, 3), 'snow')
    for k, z in enumerate((0.45, 0.3)):
        b.add(ellipsoid((0, -0.36 + 0.02 * k, z), (0.03, 0.02, 0.03), seg=8, rings=5), 'coal', outline=False)
    for sx in (1, -1):   # 나뭇가지 팔
        a = V((sx * 0.3, 0, 0.55))
        b.add(cylinder(a, a + V((sx * 0.38, -0.02, 0.22)), 0.022, 0.012, seg=6), 'twig')
        b.add(cylinder(a + V((sx * 0.26, -0.01, 0.15)), a + V((sx * 0.34, -0.02, 0.3)), 0.012, 0.006, seg=5), 'twig')
    h = M.part('head', pivot=(0, 0, 0.68))
    h.add(jitter(ellipsoid((0, 0, 0.9), (0.25, 0.25, 0.24), seg=24, rings=14), 0.006, 5), 'snow')
    for sx in (1, -1):
        h.add(ellipsoid((sx * 0.085, -0.225, 0.96), (0.028, 0.018, 0.03), seg=8, rings=5), 'coal', outline=False)
    h.add(cone(V((0, -0.23, 0.9)), V((0.02, -0.42, 0.88)), 0.035, 0.004, seg=10), 'carrot')
    # 표정 넷 (9차 M9-P1, D87-A): 입 모양 부품 'opt_face_<표정>' — 게임이 변형 끝 '+<표정>' 으로 하나만 남긴다 (world/objects.js, 없으면 smile)
    # 표정은 게임 winter.js faceOf: 딱 맞음 smile 😊 · 머리 큼 wow 😮 · 몸 큼 calm 😌 · 비슷 plain 🙂
    coal = lambda part, x, z, r=0.016: part.add(ellipsoid((x, -0.215 - 0.012 * (1 - min(1, abs(x) / 0.08)), z), (r, 0.012, r), seg=6, rings=4), 'coal', outline=False)
    f = M.part('opt_face_smile', parent='head', pivot=(0, 0, 0.68))
    for k in range(5):   # 활짝 웃는 입
        t = (k - 2) / 2
        coal(f, t * 0.08, 0.83 - 0.03 * (1 - t * t))
    f = M.part('opt_face_wow', parent='head', pivot=(0, 0, 0.68))
    f.add(ellipsoid((0, -0.222, 0.8), (0.04, 0.02, 0.048), seg=14, rings=8), 'coal', outline=False)   # 동그랗게 벌린 입
    f = M.part('opt_face_calm', parent='head', pivot=(0, 0, 0.68))
    for k in range(3):   # 작게 미소 짓는 입
        t = k - 1
        coal(f, t * 0.04, 0.82 - 0.012 * (1 - t * t), 0.013)
    f = M.part('opt_face_plain', parent='head', pivot=(0, 0, 0.68))
    for k in range(4):   # 일자 입
        coal(f, (k - 1.5) * 0.035, 0.815, 0.013)
    ring = [V((math.cos(TAU * i / 24) * 0.24, math.sin(TAU * i / 24) * 0.24, 0.7)) for i in range(24)]
    h.add(tube(ring, [0.06] * 24, seg=10, closed=True), 'scarf')
    h.add(box((0.14, -0.22, 0.6), (0.1, 0.04, 0.2), bevel=0.02, rot=rot_xyz(y=-0.15)), 'scarf')
    h.add(box((0.14, -0.235, 0.52), (0.1, 0.03, 0.03), bevel=0.01, rot=rot_xyz(y=-0.15)), 'scarfStripe', outline=False)


# ================================================================ 9차 M9 섬 꾸미기 (보드 wave9 D86-A): 길 TI-09–12 · 울타리 PR-24–25
# 이어지는 모양: 가운데 'core' + 이웃 쪽 팔 'link_n·e·s·w' (+ 길은 모서리 'link_ne·nw·se·sw'). 모두 내보내고,
# 게임(src/world/objects.js)이 이웃에 맞춰 안 쓰는 팔을 뺀다. Blender +Y = 북쪽(게임 -Z), +X = 동쪽.
# 무늬(벽돌·널빤지·돌)는 칸 전체 격자로 놓고 조각마다 잘라서, 팔이 이어지면 이음매 없이 한 판처럼 보인다.
PIECES = {'core': (-0.32, -0.32, 0.32, 0.32),
          'link_n': (-0.32, 0.32, 0.32, 0.5), 'link_s': (-0.32, -0.5, 0.32, -0.32),
          'link_e': (0.32, -0.32, 0.5, 0.32), 'link_w': (-0.5, -0.32, -0.32, 0.32),
          'link_ne': (0.32, 0.32, 0.5, 0.5), 'link_nw': (-0.5, 0.32, -0.32, 0.5),
          'link_se': (0.32, -0.5, 0.5, -0.32), 'link_sw': (-0.5, -0.5, -0.32, -0.32)}


def _hash(*k):
    h = 2166136261
    for v in k:
        for ch in str(v):
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h / 0xFFFFFFFF


def lay(part, rect, course, length, gap, z0, height, mats, bevel=0.012, along='x', jitter_h=0.0):
    """rect 안을 벽돌 쌓기처럼 덮는다: 줄(course) 폭마다 한 줄, 줄마다 반 칸 엇갈림.
    격자는 칸 전체(-0.5 ~ 0.5) 기준이라 조각을 나눠도 같은 자리에 같은 벽돌. 틈(gap)은 진짜 벽돌 끝에만."""
    x0, y0, x1, y1 = rect
    a0, a1, b0, b1 = (x0, x1, y0, y1) if along == 'x' else (y0, y1, x0, x1)
    r = math.floor((b0 + 0.5) / course + 1e-6)
    while -0.5 + r * course < b1 - 1e-6:
        rb0, rb1 = -0.5 + r * course + gap / 2, -0.5 + (r + 1) * course - gap / 2
        cb0, cb1 = max(rb0, b0), min(rb1, b1)
        if cb1 - cb0 > 0.01:
            shift = (r % 2) * length / 2
            k = math.floor((a0 + 0.5 + shift) / length + 1e-6)
            while -0.5 - shift + k * length < a1 - 1e-6:
                ra0, ra1 = -0.5 - shift + k * length + gap / 2, -0.5 - shift + (k + 1) * length - gap / 2
                ca0, ca1 = max(ra0, a0), min(ra1, a1)
                if ca1 - ca0 > 0.01:
                    hsh = _hash(r, k)
                    h = height + jitter_h * (hsh - 0.5)
                    mat = mats[int(hsh * len(mats)) % len(mats)]
                    cx, cy, sx, sy = ((ca0 + ca1) / 2, (cb0 + cb1) / 2, ca1 - ca0, cb1 - cb0) if along == 'x' else ((cb0 + cb1) / 2, (ca0 + ca1) / 2, cb1 - cb0, ca1 - ca0)
                    part.add(box((cx, cy, z0 + h / 2), (sx, sy, h), bevel=bevel), mat)
                k += 1
        r += 1


def slab(part, rect, z1, mat):
    """조각 밑판 (윗면 z1, 외곽선은 스펙 noOutline 으로 뺀다)"""
    x0, y0, x1, y1 = rect
    part.add(box(((x0 + x1) / 2, (y0 + y1) / 2, z1 / 2), (x1 - x0, y1 - y0, z1), bevel=0.004, segments=1), mat, outline=False)


def b_deco_path(M):
    """TI-09 돌길 · TI-10 벽돌길 · TI-11 나무판 길 · TI-12 꽃길 (kind 로 무늬를 고른다). 높이 약 0.04 — 풀 위에 살짝 얹힌다."""
    for name, rect in PIECES.items():
        p = M.part(name)
        if KIND == 'path-stone':
            slab(p, rect, 0.012, 'gravel')
            lay(p, rect, 0.25, 0.25, 0.05, 0.008, 0.03, ['stone', 'stoneLight', 'stone'], bevel=0.018, jitter_h=0.012)
        elif KIND == 'path-brick':
            slab(p, rect, 0.014, 'grout')
            lay(p, rect, 1 / 6, 1 / 3, 0.018, 0.01, 0.028, ['brick', 'brick', 'brickDark'], bevel=0.008)
        elif KIND == 'path-plank':
            slab(p, rect, 0.012, 'woodDark')
            lay(p, rect, 0.125, 1.0, 0.02, 0.012, 0.03, ['wood', 'woodLight'], bevel=0.008)
        else:   # path-flower: 다진 흙길 + 자갈 + 가장자리 작은 꽃 (꽃 색은 계절 변형)
            slab(p, rect, 0.022, 'path')
            rnd = random.Random(name)
            x0, y0, x1, y1 = rect
            for k in range(2 if name == 'core' else 1):
                x, y, r = rnd.uniform(x0 + 0.05, x1 - 0.05), rnd.uniform(y0 + 0.05, y1 - 0.05), rnd.uniform(0.02, 0.035)
                p.add(ellipsoid((x, y, 0.022), (r, r * 0.8, r * 0.35), seg=10, rings=6), 'pebble', outline=False)
            if len(name) == 6:   # 팔: 양옆 가장자리에 꽃 하나씩
                d = name[-1]
                spots = [(sx * 0.29, 0.42 if d == 'n' else -0.42) for sx in (1, -1)] if d in 'ns' else [(0.42 if d == 'e' else -0.42, sy * 0.29) for sy in (1, -1)]
            elif name == 'core':   # 가운데: 네 귀퉁이
                spots = [(sx * 0.27, sy * 0.27) for sx in (1, -1) for sy in (1, -1)]
            else:
                spots = []
            for i, (x, y) in enumerate(spots):
                p.add(cone((x, y, 0.02), (x, y, 0.07), 0.02, 0.008, seg=6), 'leaf', outline=False)
                for k in range(5):
                    a = TAU * k / 5 + i
                    p.add(ellipsoid((x + math.cos(a) * 0.022, y + math.sin(a) * 0.022, 0.075), (0.02, 0.014, 0.008), rot=rot_xyz(z=a), seg=8, rings=4), 'flower' if i % 2 == 0 else 'flowerAlt', outline=False)
                p.add(ellipsoid((x, y, 0.08), (0.01, 0.01, 0.008), seg=6, rings=4), 'center', outline=False)


def b_deco_fence(M):
    """PR-24 나무 울타리 · PR-25 흰 말뚝 울타리: 가운데 기둥 + 이웃 쪽으로 가로대 (팔 하나 = 반 칸)."""
    picket = KIND == 'fence-picket'
    post, rail = ('paint', 'paintShade') if picket else ('wood', 'woodLight')
    c = M.part('core')
    c.add(box((0, 0, 0.38), (0.13, 0.13, 0.76), bevel=0.025), post)
    c.add(cone((0, 0, 0.76), (0, 0, 0.86), 0.09, 0.0, seg=4), post, smooth=False)
    for d, (dx, dy) in {'n': (0, 1), 's': (0, -1), 'e': (1, 0), 'w': (-1, 0)}.items():
        p = M.part('link_' + d)
        for z in ((0.24, 0.5) if picket else (0.3, 0.56)):
            cx, cy = dx * 0.28, dy * 0.28
            p.add(box((cx, cy, z), (0.44 if dx else 0.05, 0.44 if dy else 0.05, 0.07 if picket else 0.09), bevel=0.018), rail)
        if picket:   # 반 칸마다 말뚝 둘 (뾰족 머리)
            for t in (0.2, 0.38):
                x, y = dx * t, dy * t
                p.add(box((x, y, 0.33), (0.07, 0.07, 0.6), bevel=0.012), post)
                p.add(cone((x, y, 0.63), (x, y, 0.71), 0.05, 0.0, seg=4), post, smooth=False)


# ================================================================ 9차 M9-P1 주민 행사 소품 (보드 wave9 D87-A · 8차 events.json props)
# 게임(src/gameplay/events/props.js)이 행사 주인공 주민 뼈에 붙인다. 크기는 키 1.0 캐릭터 기준 (게임이 키 비율로 늘린다).
# 원점: 머리띠 = 머리 위 고리 가운데 · 목도리·스카프 = 목 고리 가운데 · 부채 = 손잡이 끝(손).
def b_flower_crown(M):
    """꽃 머리띠 (EV-01 모찌): 푸른 덩굴 고리에 작은 꽃 여덟 송이."""
    m = M.part('crown')
    R = 0.18
    ring = [V((math.cos(TAU * i / 24) * R, math.sin(TAU * i / 24) * R, 0.008 * math.sin(TAU * i / 8))) for i in range(24)]
    m.add(tube(ring, [0.016] * 24, seg=8, closed=True), 'vine')
    for k in range(8):
        a = TAU * k / 8 + 0.2
        c = V((math.cos(a) * R, math.sin(a) * R, 0.02))
        for j in range(5):
            b = TAU * j / 5
            d = V((math.cos(b), math.sin(b), 0)) * 0.026
            m.add(ellipsoid(c + d, (0.026, 0.018, 0.01), rot=rot_xyz(z=b), seg=8, rings=5), 'flower' if k % 2 == 0 else 'flowerAlt')
        m.add(ellipsoid(c + V((0, 0, 0.008)), (0.012, 0.012, 0.01), seg=8, rings=5), 'center', outline=False)
        e = V((math.cos(a + 0.4) * R, math.sin(a + 0.4) * R, 0.0))
        m.add(ellipsoid(e, (0.024, 0.01, 0.006), rot=rot_xyz(z=a + 0.4 + math.pi / 2), seg=8, rings=4), 'leaf', outline=False)


def b_fan(M):
    """부채 (EV-02 코코): 대나무 손잡이에 둥근 종이 부채, 금붕어 무늬."""
    m = M.part('fan')
    m.add(cylinder((0, 0, 0), (0, 0, 0.13), 0.012, 0.01, seg=8), 'bamboo')
    m.add(cylinder((0, -0.006, 0.23), (0, 0.006, 0.23), 0.105, seg=28), 'fanPaper')
    ring = [V((math.cos(TAU * i / 28) * 0.105, 0, 0.23 + math.sin(TAU * i / 28) * 0.105)) for i in range(28)]
    m.add(tube(ring, [0.007] * 28, seg=6, closed=True), 'bamboo')
    for k in range(5):   # 살
        a = math.pi / 2 + (k - 2) * 0.45
        m.add(cylinder((0, 0, 0.13), (math.cos(a) * 0.1, 0, 0.23 + math.sin(a) * 0.1 - 0.1), 0.003, seg=4), 'bamboo', outline=False)
    for sx, z in ((-0.03, 0.25), (0.035, 0.2)):   # 금붕어 둘
        m.add(ellipsoid((sx, -0.008, z), (0.028, 0.004, 0.016), rot=rot_xyz(y=sx * 6), seg=10, rings=5), 'fanPattern', outline=False)
        m.add(cone((sx + (0.03 if sx < 0 else -0.03), -0.008, z), (sx + (0.05 if sx < 0 else -0.05), -0.008, z + 0.01), 0.012, 0.0, squash=0.3, seg=6), 'fanPattern', outline=False)


def b_neck_wrap(M):
    """스카프 (EV-03 퐁, 가볍게 한 바퀴 + 리본 매듭) · 목도리 (EV-04 두부, 두툼한 뜨개 + 줄무늬 + 술)."""
    thick = KIND == 'muffler'
    m = M.part('wrap')
    R, r = (0.17, 0.05) if thick else (0.16, 0.032)
    ring = [V((math.cos(TAU * i / 28) * R, math.sin(TAU * i / 28) * R, 0.012 * math.sin(TAU * i / 28 * 2))) for i in range(28)]
    m.add(tube(ring, [r] * 28, seg=12, closed=True, flat=0.75), 'cloth')
    if thick:
        for z in (-0.025, 0.025):   # 줄무늬 두 줄
            m.add(tube([p + V((0, 0, z)) for p in ring], [r * 0.6] * 28, seg=10, closed=True, flat=0.25), 'stripe', outline=False)
        for sx, tilt in ((0.05, 0.12), (0.12, -0.08)):   # 앞으로 늘어진 두 끝 + 술
            top = V((sx, -R - 0.02, -0.02))
            m.add(box(top + V((0, 0, -0.1)), (0.075, 0.035, 0.2), bevel=0.02, rot=rot_xyz(y=tilt)), 'cloth')
            m.add(box(top + V((0, -0.004, -0.12)), (0.078, 0.03, 0.025), bevel=0.008, rot=rot_xyz(y=tilt)), 'stripe', outline=False)
            for k in range(4):
                m.add(cylinder(top + V((-0.027 + k * 0.018, 0, -0.2)), top + V((-0.027 + k * 0.018, 0, -0.245)), 0.006, seg=5), 'stripe', outline=False)
    else:
        knot = V((0.07, -R - 0.01, -0.01))
        m.add(ellipsoid(knot, (0.035, 0.025, 0.03), seg=12, rings=8), 'cloth')
        for sx in (1, -1):   # 리본 두 날개 + 늘어진 끝
            m.add(ellipsoid(knot + V((sx * 0.045, -0.005, 0.01)), (0.045, 0.012, 0.028), rot=rot_xyz(y=sx * 0.4), seg=12, rings=6), 'cloth')
            m.add(box(knot + V((sx * 0.02, 0, -0.07)), (0.03, 0.01, 0.1), bevel=0.008, rot=rot_xyz(y=sx * 0.25)), 'stripe')


# ================================================================ 12차 밤·새벽 (밤·새벽 검수 보드 D106–D114)
def star_shape(c, r, thick, rot=None, points=5, inner=0.48, puff=0.3):
    """통통한 별: 끝 다섯 개, 가운데가 앞뒤로 볼록 (기본은 면이 -Y 를 보고 서 있다)"""
    bm = bmesh.new()
    ring_f, ring_b = [], []
    for k in range(points * 2):
        a = math.pi / 2 + math.pi * k / points
        rr = r if k % 2 == 0 else r * inner
        ring_f.append(bm.verts.new(V((math.cos(a) * rr, -thick / 2, math.sin(a) * rr))))
        ring_b.append(bm.verts.new(V((math.cos(a) * rr, thick / 2, math.sin(a) * rr))))
    cf, cb = bm.verts.new(V((0, -thick / 2 - r * puff, 0))), bm.verts.new(V((0, thick / 2 + r * puff, 0)))
    n = len(ring_f)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new([cf, ring_f[j], ring_f[k]])
        bm.faces.new([cb, ring_b[k], ring_b[j]])
        bm.faces.new([ring_f[k], ring_f[j], ring_b[j], ring_b[k]])
    M4 = Matrix.Translation(V(c)) @ (rot.to_4x4() if rot is not None else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=M4, verts=bm.verts)
    return bm


def crescent(m, c, R, thick, mat, a0=-70, a1=70, w=0.32, seg=24):
    """초승달 (면이 -Y): 원호를 따라 가운데가 굵은 띠. 오목한 쪽이 -X"""
    c = V(c)
    pts = [c + V((math.cos(a) * R, 0, math.sin(a) * R)) for a in (math.radians(a0 + (a1 - a0) * t / seg) for t in range(seg + 1))]
    radii = [R * (0.05 + w * math.sin(math.pi * t / seg)) for t in range(seg + 1)]
    m.add(tube(pts, radii, seg=12, flat=thick / max(radii)), mat)


def b_night_shop(M):
    """BD-08 달빛 가게 (별밤의 밤 가게, 밤 22–3시): 남색 벽 · 진보라 박공지붕 · 앞 가운데 문(door, 앞 = -Y → 게임 +Z) ·
    양옆 둥근 창(window — 밤에 켜짐) · 문 위 작은 차양 · 지붕 위 초승달 간판(glow) · 처마 끝 별 장식"""
    W, D, Hh = 3.2 * P.get('width', 1), 2.2 * P.get('depth', 1), 1.6 * P.get('wallHeight', 1)
    m = M.part('shop')
    m.add(box((0, 0, 0.1), (W + 0.14, D + 0.14, 0.2), bevel=0.04), 'foundation')
    m.add(box((0, 0, 0.2 + Hh / 2), (W, D, Hh), bevel=0.06), 'wall')
    top = 0.2 + Hh
    m.add(box((0, 0, top - 0.04), (W + 0.06, D + 0.06, 0.1), bevel=0.03), 'trim')
    m.add(prism((0, 0, top - 0.02), W, D, 0.85 * 0.96), 'wall')
    m.add(prism((0, 0, top + 0.02), W, D, 0.85, overhang=0.16), 'roof')
    # 문 + 손잡이 + 문 위 작은 차양 + 디딤돌
    m.add(box((0, -D / 2 - 0.02, 0.2 + 0.52), (0.62, 0.08, 1.0), bevel=0.04), 'door')
    m.add(ellipsoid((0.19, -D / 2 - 0.07, 0.7), (0.035, 0.03, 0.035), seg=10, rings=6), 'trim')
    m.add(box((0, -D / 2 - 0.2, 0.2 + 1.18), (0.95, 0.4, 0.05), bevel=0.02, rot=rot_xyz(x=0.35)), 'awning')
    m.add(box((0, -D / 2 - 0.3, 0.06), (0.9, 0.44, 0.12), bevel=0.03), 'foundation')
    # 둥근 창 둘 (창틀 고리 + 유리)
    for sx in (1, -1):
        c = V((sx * W * 0.3, -D / 2 - 0.02, 0.2 + Hh * 0.55))
        m.add(cylinder(c + V((0, 0.03, 0)), c - V((0, 0.05, 0)), 0.36, seg=28), 'trim')
        m.add(cylinder(c + V((0, 0.0, 0)), c - V((0, 0.065, 0)), 0.29, seg=28), 'window', outline=False)
        m.add(box(c - V((0, 0.07, 0)), (0.58, 0.02, 0.035), bevel=0.0), 'trim')
        m.add(box(c - V((0, 0.07, 0)), (0.035, 0.02, 0.58), bevel=0.0), 'trim')
        m.add(box(c + V((0, -0.08, -0.38)), (0.78, 0.12, 0.05), bevel=0.015), 'trim')
    # 지붕 위 초승달 간판 (받침 기둥 + 달 + 작은 별 둘)
    sign = V((0, -0.1, top + 0.85))
    m.add(cylinder(sign - V((0, 0, 0.1)), sign + V((0, 0, 0.25)), 0.04, seg=8), 'trim')
    crescent(m, sign + V((0.1, 0, 0.62)), 0.48, 0.08, 'glow', a0=-80, a1=80)
    for x, z, r in ((-0.26, 0.86, 0.1), (-0.14, 0.45, 0.07)):
        m.add(star_shape(sign + V((x, 0, z)), r, 0.03, puff=0.25), 'glow')
    m.add(cylinder(sign + V((-0.26, 0, 0.76)), sign + V((-0.26, 0, 0.3)), 0.006, seg=6), 'trim')
    # 처마 끝 늘어진 별 장식 셋
    for x in (-W * 0.42, W * 0.42):
        p = V((x, -D / 2 - 0.12, top - 0.05))
        m.add(cylinder(p, p - V((0, 0, 0.22)), 0.006, seg=6), 'trim')
        m.add(star_shape(p - V((0, 0, 0.29)), 0.07, 0.025, puff=0.25), 'glow')


def b_dawn_tent(M):
    """BD-09 새벽 천막 (여명의 점집, 3–5시): 보라 천 팔각뿔 천막 · 금빛 줄 띠 · 꼭대기 금빛 별(glow) ·
    앞(-Y → 게임 +Z) 입구: 기둥 둘 + 작은 박공 차양 + 드리운 천 문(door), 양옆으로 걷어 묶은 자락"""
    R, Ht = 1.2 * P.get('width', 1), 2.5 * P.get('height', 1)
    m = M.part('tent')
    rot = rot_xyz(z=math.pi / 8)                      # 팔각형의 한 면이 정면을 보게
    base = cylinder((0, 0, 0), (0, 0, 0.06), R + 0.05, seg=8)
    bmesh.ops.rotate(base, verts=base.verts, cent=(0, 0, 0), matrix=rot)
    m.add(base, 'foundation', smooth=False)
    body = cylinder((0, 0, 0.06), (0, 0, 0.62), R, R * 0.93, seg=8)          # 낮은 옆벽
    bmesh.ops.rotate(body, verts=body.verts, cent=(0, 0, 0), matrix=rot)
    m.add(body, lambda c, n: 'clothB' if (math.degrees(math.atan2(c.y, c.x)) // 45) % 2 else 'cloth', smooth=False)
    roof = cone((0, 0, 0.6), (0, 0, Ht), R * 1.06, 0.03, seg=8)              # 지붕 뿔 (조금 내밀어 처마)
    bmesh.ops.rotate(roof, verts=roof.verts, cent=(0, 0, 0), matrix=rot)
    m.add(roof, lambda c, n: 'clothB' if (math.degrees(math.atan2(c.y, c.x)) // 45) % 2 else 'cloth', smooth=False)
    ring = [V((math.cos(a) * R * 1.07, math.sin(a) * R * 1.07, 0.62)) for a in (math.pi / 8 + TAU * k / 8 for k in range(8))]
    m.add(tube(ring, [0.03] * 8, seg=6, closed=True), 'trim', smooth=False)   # 처마 금빛 줄
    for k in range(8):                                                      # 처마 술 장식
        a = TAU * k / 8
        p = V((math.cos(a) * R * 1.0, math.sin(a) * R * 1.0, 0.56))
        m.add(cone(p, p - V((0, 0, 0.14)), 0.04, 0.0, seg=8), 'trim')
    # 꼭대기 별
    m.add(cylinder((0, 0, Ht - 0.05), (0, 0, Ht + 0.2), 0.025, seg=8), 'trim')
    m.add(star_shape((0, 0, Ht + 0.36), 0.2, 0.07, puff=0.3), 'glow')
    # 입구 (정면 면 = y = -R·cos(22.5°))
    fy = -R * math.cos(math.pi / 8)
    ey = fy - 0.24
    for sx in (1, -1):
        m.add(cylinder((sx * 0.42, ey, 0.0), (sx * 0.42, ey, 1.25), 0.035, seg=8), 'pole')
        m.add(ellipsoid((sx * 0.42, ey, 1.27), (0.05, 0.05, 0.05), seg=10, rings=6), 'trim')
    m.add(prism((0, ey + 0.2, 1.2), 1.1, 0.62, 0.3, overhang=0.04), 'clothB')   # 입구 차양 (앞 경사면)
    m.add(box((0, ey + 0.14, 0.62), (0.86, 0.3, 1.2), bevel=0.03), 'cloth')       # 입구 몸 (천막과 잇는 짧은 통로)
    m.add(box((0, ey - 0.03, 0.06 + 0.5), (0.6, 0.06, 1.0), bevel=0.03), 'door')   # 드리운 천 문
    for sx in (1, -1):                                                           # 걷어 묶은 자락
        m.add(ellipsoid((sx * 0.35, ey - 0.05, 0.75), (0.09, 0.05, 0.42), rot=rot_xyz(y=sx * 0.12), seg=14, rings=10), 'clothB')
        m.add(ellipsoid((sx * 0.35, ey - 0.09, 0.78), (0.1, 0.03, 0.03), seg=10, rings=6), 'trim')
    m.add(box((0, ey - 0.17, 0.03), (0.8, 0.26, 0.06), bevel=0.02), 'rug')         # 입구 깔개
    for x, z, r in ((-0.75, 1.55, 0.07), (0.62, 1.85, 0.06), (0.15, 1.35, 0.05)):   # 천에 수놓은 별
        y = fy * (1 - (z - 0.6) / (Ht - 0.6)) * 1.06 - 0.02
        m.add(star_shape((x * (1 - (z - 0.6) / (Ht - 0.6)) * 1.0, y, z), r, 0.015, rot=rot_xyz(x=-0.45), puff=0.2), 'trim')


def paper_lantern(m, c, color, s=1.0):
    """종이 등불 하나: 위·아래 1/4 은 종이 색, 가운데 띠는 불빛(glow — 밤에 켜짐), 위 뚜껑 · 아래 술"""
    c = V(c)
    rx, rz = 0.1 * s, 0.13 * s
    band = 0.42
    m.add(ellipsoid(c, (rx, rx, rz), seg=14, rings=10), lambda p, n: 'glow' if abs(p.z - c.z) < rz * band else color)
    for k in range(4):   # 세로 살
        a = TAU * k / 4 + TAU / 8
        pts = [c + V((math.cos(a) * rx * math.cos(t) * 1.01, math.sin(a) * rx * math.cos(t) * 1.01, rz * math.sin(t))) for t in (math.pi * (i / 6 - 0.5) for i in range(7))]
        m.add(tube(pts, [0.005 * s] * 7, seg=4), color, outline=False)
    m.add(cylinder(c + V((0, 0, rz * 0.9)), c + V((0, 0, rz + 0.025 * s)), 0.045 * s, seg=12), 'cap')
    m.add(cylinder(c - V((0, 0, rz * 0.9)), c - V((0, 0, rz + 0.02 * s)), 0.04 * s, seg=12), 'cap')
    m.add(cone(c - V((0, 0, rz + 0.02 * s)), c - V((0, 0, rz + 0.1 * s)), 0.015 * s, 0.03 * s, seg=8), color)


def b_night_lanterns(M):
    """PR-30 종이 등불 줄 (야시장): 기둥 둘 사이에 처진 줄, 빨강·노랑·분홍 종이 등불 여섯"""
    m = M.part('lanterns')
    hw, top = 1.35, 2.0
    for sx in (1, -1):
        m.add(cylinder((sx * hw, 0, 0), (sx * hw, 0, 0.06), 0.11, 0.09, seg=14), 'pole')
        m.add(cylinder((sx * hw, 0, 0.06), (sx * hw, 0, top + 0.05), 0.035, seg=10), 'pole')
        m.add(ellipsoid((sx * hw, 0, top + 0.07), (0.05, 0.05, 0.05), seg=12, rings=8), 'cap')
    sag = lambda t: V((-hw + 2 * hw * t, 0, top - 0.3 * math.sin(math.pi * t)))
    m.add(tube([sag(i / 24) for i in range(25)], [0.008] * 25, seg=6), 'string')
    cols = ('paperRed', 'paperYellow', 'paperPink')
    for i in range(6):
        t = (i + 0.5) / 6
        p = sag(t)
        drop = 0.07 + 0.03 * (i % 2)
        m.add(cylinder(p, p - V((0, 0, drop)), 0.005, seg=5), 'string', outline=False)
        paper_lantern(m, p - V((0, 0, drop + 0.19)), cols[i % 3], 1.25 + 0.12 * (i % 2))


def b_sleep_note(M):
    """PR-32 「자는 중」 쪽지: 작은 나무 말뚝에 흰 쪽지, 쪽지에 Z 셋 (큰 Z · 작은 z 둘 — 글자가 아니라 막대 모양)"""
    m = M.part('note')
    m.add(box((0, 0, 0.3), (0.06, 0.06, 0.6), bevel=0.012), 'wood')
    m.add(cone((0, 0, 0.6), (0, 0, 0.65), 0.045, 0.0, seg=4), 'wood', smooth=False)
    m.add(box((0, -0.04, 0.5), (0.34, 0.02, 0.24), bevel=0.01, rot=rot_xyz(y=0.06)), 'card')
    m.add(ellipsoid((0, -0.055, 0.6), (0.02, 0.012, 0.02), seg=8, rings=5), 'pin', outline=False)
    y = -0.053

    def zee(cx, cz, s):
        w, h, t = 0.09 * s, 0.1 * s, 0.016 * s
        m.add(box((cx, y, cz + h / 2), (w, 0.006, t), bevel=0.0), 'ink', outline=False)
        m.add(box((cx, y, cz - h / 2), (w, 0.006, t), bevel=0.0), 'ink', outline=False)
        m.add(box((cx, y, cz), (math.hypot(w, h) * 0.95, 0.006, t), bevel=0.0, rot=rot_xyz(y=-math.atan2(h, w))), 'ink', outline=False)

    zee(-0.08, 0.47, 1.0)
    zee(0.04, 0.5, 0.7)
    zee(0.11, 0.55, 0.5)


BUILDERS = {
    'night-shop': b_night_shop, 'dawn-tent': b_dawn_tent, 'night-lanterns': b_night_lanterns, 'sleep-note': b_sleep_note,
    'path-stone': b_deco_path, 'path-brick': b_deco_path, 'path-plank': b_deco_path, 'path-flower': b_deco_path,
    'fence-wood': b_deco_fence, 'fence-picket': b_deco_fence,
    'flower-crown': b_flower_crown, 'fan': b_fan, 'scarf': b_neck_wrap, 'muffler': b_neck_wrap,
    'festival-stage': b_festival_stage, 'festival-arch': b_festival_arch, 'festival-floor': b_festival_floor,
    'festival-booth': b_festival_booth, 'festival-cover': b_festival_cover, 'festival-lantern': b_festival_lantern,
    'festival-garland': b_festival_garland, 'festival-board': b_festival_board, 'festival-part': b_festival_part,
    'tree': b_tree, 'fruit-tree': lambda M: b_tree(M, fruit=True), 'palm': b_palm, 'cedar': b_cedar, 'rock': b_rock,
    'flower-tulip': b_tulip, 'flower-cosmos': b_cosmos, 'flower-pansy': b_pansy, 'weed': b_weed, 'shell': b_shell, 'bush': b_bush,
    'lamp': b_lamp, 'bench': b_bench, 'mailbox': b_mailbox, 'signboard': b_signboard, 'bridge': b_bridge, 'fence': b_fence,
    'fossil-spot': b_fossil_spot, 'workbench': b_workbench, 'campfire': b_campfire,
    'house': b_house, 'shop': b_shop, 'museum': b_museum, 'dock': b_dock,
    'snowball': b_snowball, 'snowman': b_snowman,
    'harvest-pot': b_harvest_pot, 'scarecrow': b_scarecrow,
    'fireworks-raft': b_fireworks_raft,
    'cherry-tree': b_cherry_tree, 'picnic-mat': b_picnic_mat, 'event-sign': b_event_sign,
    'moving-boxes': b_moving_boxes, 'party-balloons': b_party_balloons, 'lot-sign': b_lot_sign,
}


def build(palette, suffix='', offset=(0, 0, 0)):
    M = Model(SLUG, palette, suffix, offset)
    (b_tile if KIND.startswith('tile-') else BUILDERS[KIND])(M)
    M.finish(scene)
    M.root.scale = (P.get('scale', 1.0),) * 3
    return M


# ================================================================ 만들기 · 동작 · 내보내기
scene = reset_scene()
main = build(PAL)
objects = list(main.objects.values())

ANIMS = {
    'sway': (48, lambda t: ((0.035 * math.sin(TAU * t), 0.025 * math.sin(TAU * t + 1.3), 0), None)),
    'shake': (18, lambda t: ((0.0, 0.14 * (1 - t) * math.sin(TAU * 3 * t), 0.06 * (1 - t) * math.sin(TAU * 3 * t + 0.6)), None)),
    'flicker': (24, lambda t: ((0, 0, 0.1 * math.sin(TAU * t)), (1 + 0.08 * math.sin(TAU * 2 * t), 1 + 0.08 * math.sin(TAU * 2 * t), 1 + 0.15 * math.sin(TAU * 3 * t + 1)))),
}
ANIM_TARGET = {'sway': ('canopy', 'flower', 'bush'), 'shake': ('canopy',), 'flicker': ('flame',)}
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
    'id': spec['id'], 'slug': SLUG, 'name': spec['name'], 'category': spec['category'], 'kind': KIND, 'version': spec.get('version'),
    'triangles': tris, 'parts': len(objects), 'materials': sorted({m.name for o in objects for m in o.data.materials}),
    'animations': {n: {'frames': f, 'seconds': round(f / 24, 2)} for n, f in anim_names},
    'size': [round(size.x, 2), round(size.y, 2), round(hi.z, 2)],
    'footprint': spec.get('footprint') or [max(1, math.ceil(size.x - 0.05)), max(1, math.ceil(size.y - 0.05))],
    'glbBytes': os.path.getsize(glb_path), 'blender': bpy.app.version_string,
}

# ================================================================ 렌더
if DO_RENDER:
    R = lambda name: os.path.join(OUT['renders'], f'{SLUG}_{name}.png')
    FLAT = set(spec.get('style', {}).get('flat', ['glow', 'flame', 'flameCore']))
    width = spec.get('style', {}).get('outlineWidth', 0.01)
    for m in list(bpy.data.materials):
        if 'hex' in m:
            toonify(m, flat=m.name.split('@')[0] in FLAT)
    add_outlines(scene, objects, width)
    # 고르는 부품 (9차): 이어짐 팔 'link_*' 는 스펙 world.render 에 적은 것만 (없으면 다), 'opt_<묶음>_<값>' 은
    # 기본 모델 = world.options 첫 값, 변형 i = i 번째 값 (눈사람 표정 넷을 변형 줄에 나란히)
    W = spec.get('world', {})
    def show_parts(model, idx=None):
        for name, obj in model.objects.items():
            hide = False
            if name.startswith('link_') and 'render' in W:
                hide = name not in W['render']
            elif name.startswith('opt_'):
                group, val = name[4:].split('_', 1)
                opts = W.get('options', {}).get(group, [val])
                hide = val != opts[(idx or 0) % len(opts)]
            for o in [obj] + list(obj.children_recursive):
                o.hide_render = hide
    show_parts(main)
    cam, target = setup_render(scene)
    center = (lo + hi) / 2
    radius = max(size.length / 2, 0.25)

    aim(cam, target, center, 35, 30, ortho_scale=radius * 2.1)
    shot(scene, R('main'), 640, 640)
    thumbnail(R('main'), R('thumb'))
    aim(cam, target, center, 0, 6, ortho_scale=max(size.x, size.z) * 1.3 + 0.1)
    shot(scene, R('front'), 640, 640)
    aim(cam, target, center, 0, 89.5, ortho_scale=max(size.x, size.y) * 1.3 + 0.1)
    shot(scene, R('top'), 640, 640)

    variants = [(k, v) for k, v in spec.get('variants', {}).items()]
    extras = []
    if variants:   # 같은 모양에 색만 바꾼 변형을 옆으로 나란히
        gap = max(size.x, size.y) * 1.25 + 0.2
        start = -gap * (len(variants) - 1) / 2
        main.root.location = (10000, 0, 0)
        for i, (key, var) in enumerate(variants):
            vm = build({**PAL, **var.get('palette', {})}, suffix='@' + key, offset=(start + i * gap, 0, 0))
            extras.append(vm)
        for m in bpy.data.materials:
            if '@' in m.name and 'hex' in m:
                toonify(m, flat=m.name.split('@')[0] in FLAT)
        for i, vm in enumerate(extras):
            add_outlines(scene, list(vm.objects.values()), width)
            show_parts(vm, i)
        span = gap * (len(variants) - 1) + max(size.x, size.y)
        aim(cam, target, center, 30, 22, ortho_scale=max(span * 1.05, radius * 2.2))
        shot(scene, R('variants'), 1280, 560)
        for vm in extras:   # 변형 모델과 그 외곽선 껍데기까지 지운다
            for o in list(vm.root.children_recursive) + [vm.root]:
                bpy.data.objects.remove(o, do_unlink=True)
        main.root.location = (0, 0, 0)

    # 히어로 컷: 섬 위에 놓아 본 모습 (타일은 3×3으로 깔아 본다)
    ground_kind = spec.get('heroGround', 'grass')
    if KIND.startswith('tile-'):
        fx, fy = stats['footprint']
        for ix in (-1, 0, 1):
            for iy in (-1, 0, 1):
                if ix or iy:
                    tm = build(PAL, suffix='', offset=(ix * fx, iy * fy, 0))
                    add_outlines(scene, list(tm.objects.values()), width)
        hero_r = 2.2 * max(fx, fy)
        aim(cam, target, V((0, 0, hi.z * 0.4)), 30, 38, dist=hero_r * 2.6 + hi.z, lens=40)
    else:
        if W.get('connect'):   # 이어지는 길·울타리: 양옆에 하나씩 더 놓아 이어진 모습
            for ix in (-1, 1):
                tm = build(PAL, suffix='', offset=(ix, 0, 0))
                add_outlines(scene, list(tm.objects.values()), width)
                show_parts(tm)
        colors = {'grass': '#A9C46A', 'sand': '#F1DFAE', 'water': '#6BB8D6'}
        if ground_kind in colors:
            from toonkit import principled
            g = bpy.data.meshes.new('ground')
            gbm = cylinder((0, 0, -0.1), (0, 0, 0), max(4.0, radius * 4), seg=64)
            gbm.to_mesh(g)
            gbm.free()
            gm = principled('ground', colors[ground_kind])
            toonify(gm)
            g.materials.append(gm)
            ground = bpy.data.objects.new('ground', g)
            scene.collection.objects.link(ground)
        aim(cam, target, center - V((0, 0, size.z * 0.1)), 28, 24, dist=radius * 4.0 + 0.6, lens=50)
    shot(scene, os.path.join(OUT['renders'], f'{SLUG}_hero.jpg'), 1280, 800, transparent=False, jpeg=True)

blend_path = os.path.join(OUT['blender'], SLUG + '.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
stats['renders'] = sorted(f for f in os.listdir(OUT['renders']) if f.startswith(SLUG + '_'))
json.dump(stats, open(os.path.join(OUT['models'], SLUG + '.stats.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('[build] 완료:', json.dumps({k: stats[k] for k in ('slug', 'triangles', 'size', 'footprint')}, ensure_ascii=False))
