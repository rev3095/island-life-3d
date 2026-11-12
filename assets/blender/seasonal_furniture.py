"""M18-P4 계절 가구 빌더 (15차 보드 wave15 D196-A — FU-92–104, 트로피 FU-89–91 은 대회 트랙 몫)

build_furniture.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import seasonal_furniture; BUILDERS.update(seasonal_furniture.builders(globals()))
builders(g) 는 build_furniture.py 의 도우미(box·cylinder·ellipsoid·annulus·star_shape …)를 이 모듈로 가져와 쓴다.

봄 벚꽃 FU-92–95 (의자 · 탁자 · 분재 · 벽 가지) · 여름 조개 FU-96–98 (등 · 의자 · 벽 거울) ·
가을 단풍 FU-99–101 (선반 · 깔개 · 등) · 겨울 눈 결정 FU-102–104 (등 · 탁자 · 벽 장식). 계절 레시피로만 얻는다.
좌표: Blender Z-up, 정면 = -Y, 1.0 = 한 칸, 원점 = 바닥 가운데 (벽 가구는 벽면 바닥). 재질 이름 = 팔레트 키, glow 는 밤에 켜짐.
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'rail', 'annulus', 'star_shape', 'rot_xyz', 'align_z', 'bezier',
           'scallop', 'P', 'TAU', 'bmesh', 'random')


# ---------------------------------------------------------------- 공용 도형
def blossom(m, c, r, mat='petal', center='center', normal_tilt=0.0, n=5, phase=0.0):
    """벚꽃 한 송이: 끝이 살짝 파인 꽃잎 다섯 + 가운데 (위를 본다 — normal_tilt 로 앞으로 기울임)"""
    c = V(c)
    for k in range(n):
        a = TAU * k / n + phase
        d = V((math.cos(a), math.sin(a), 0))
        m.add(ellipsoid(c + d * r * 0.62, (r * 0.62, r * 0.42, r * 0.12), rot=rot_xyz(x=normal_tilt, z=a), seg=12, rings=6), mat)
    m.add(ellipsoid(c + V((0, 0, r * 0.08)), (r * 0.26, r * 0.26, r * 0.16), seg=10, rings=6), center, outline=False)


def blossom_wall(m, c, r, mat='petal', center='center', n=5, phase=0.0):
    """벽에 붙은 벚꽃 (앞 -Y 를 본다)"""
    c = V(c)
    for k in range(n):
        a = TAU * k / n + phase
        d = V((math.cos(a), 0, math.sin(a)))
        m.add(ellipsoid(c + d * r * 0.62, (r * 0.62, r * 0.12, r * 0.42), rot=rot_xyz(y=-a), seg=12, rings=6), mat)
    m.add(ellipsoid(c + V((0, -r * 0.1, 0)), (r * 0.26, r * 0.16, r * 0.26), seg=10, rings=6), center, outline=False)


def maple_leaf(m, c, r, mat='leaf', rot_z=0.0, flat=True, thick=0.012):
    """단풍잎: 가운데 큰 잎 + 양옆 둘 + 아래 작은 둘 (납작, 위를 본다 — flat=False 면 앞 -Y 를 본다)"""
    lobes = ((0.0, 1.0, 0.55), (1.05, 0.82, 0.42), (-1.05, 0.82, 0.42), (2.1, 0.5, 0.3), (-2.1, 0.5, 0.3))
    c = V(c)
    for a, L, w in lobes:
        ang = rot_z + a + math.pi / 2
        d = V((math.cos(ang), math.sin(ang), 0)) if flat else V((math.cos(ang), 0, math.sin(ang)))
        size = (r * L * 0.55, r * w * 0.5, thick) if flat else (r * L * 0.55, thick, r * w * 0.5)
        rot = rot_xyz(z=ang) if flat else rot_xyz(y=-ang)
        m.add(ellipsoid(c + d * r * L * 0.5, size, rot=rot, seg=10, rings=5), mat)
    stem = c + (V((math.cos(rot_z - math.pi / 2), math.sin(rot_z - math.pi / 2), 0)) if flat else V((math.cos(rot_z - math.pi / 2), 0, math.sin(rot_z - math.pi / 2)))) * r * 0.55
    m.add(cylinder(c, stem, r * 0.05, seg=6), mat)


def snowflake(m, c, r, mat='crystal', thick=0.02, face_y=True):
    """눈 결정: 팔 여섯 (팔마다 곁가지 둘) + 가운데 육각. face_y = True 면 앞 -Y 를 보고 서 있다, 아니면 위를 본다"""
    c = V(c)
    def at(dx, dz):
        return c + (V((dx, 0, dz)) if face_y else V((dx, dz, 0)))
    for k in range(6):
        a = TAU * k / 6 + math.pi / 2
        d = (math.cos(a), math.sin(a))
        tip = at(d[0] * r, d[1] * r)
        m.add(cylinder(c, tip, thick, thick * 0.7, seg=6), mat)
        for t, L in ((0.55, 0.32), (0.8, 0.2)):
            base = at(d[0] * r * t, d[1] * r * t)
            for s in (1, -1):
                b = a + s * 0.85
                m.add(cylinder(base, base + (at(math.cos(b) * r * L, math.sin(b) * r * L) - c), thick * 0.7, thick * 0.5, seg=5), mat)
    axis = (0, -1, 0) if face_y else (0, 0, 1)
    m.add(cylinder(c - V(axis) * thick, c + V(axis) * thick, r * 0.2, seg=6), mat)


# ================================================================ 봄 벚꽃 FU-92–95
def b_cherry_chair(M):
    """FU-92 벚꽃 의자 (1×1, 앉기): 연한 나무 다리 넷 · 분홍 방석 · 둥근 등받이 위에 벚꽃 세 송이"""
    m = M.part('chair')
    sh = 0.44
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(cylinder((sx * 0.17, sy * 0.16, 0), (sx * 0.16, sy * 0.15, sh - 0.04), 0.028, 0.024, seg=10), 'wood')
    m.add(box((0, 0, sh - 0.04), (0.46, 0.44, 0.05), bevel=0.02), 'wood')
    m.add(ellipsoid((0, -0.01, sh + 0.0), (0.22, 0.21, 0.05), seg=24, rings=10), 'cushion')
    for sx in (1, -1):
        m.add(cylinder((sx * 0.17, 0.17, sh - 0.02), (sx * 0.17, 0.19, sh + 0.42), 0.024, seg=8), 'wood')
    arc = [V((math.cos(t) * 0.19, 0.19, sh + 0.42 + math.sin(t) * 0.09)) for t in (math.pi * i / 10 for i in range(11))]
    m.add(tube(arc, [0.026] * len(arc), seg=8), 'wood')
    m.add(box((0, 0.19, sh + 0.26), (0.34, 0.03, 0.2), bevel=0.015), 'woodLight')
    for x, z, r in ((0, sh + 0.53, 0.07), (-0.13, sh + 0.47, 0.055), (0.13, sh + 0.47, 0.055)):
        blossom_wall(m, (x, 0.165, z), r)


def b_cherry_table(M):
    """FU-93 벚꽃 탁자 (1×1): 둥근 상판 가장자리에 꽃잎 무늬 · 가운데 다리 하나 · 위에 벚꽃 가지 꽂은 작은 병"""
    m = M.part('table')
    zt = 0.62
    m.add(cylinder((0, 0, 0), (0, 0, 0.04), 0.24, 0.22, seg=24), 'wood')
    m.add(cylinder((0, 0, 0.04), (0, 0, zt - 0.04), 0.05, 0.045, seg=14), 'wood')
    m.add(cylinder((0, 0, zt - 0.04), (0, 0, zt), 0.4, seg=36), 'woodLight')
    for k in range(10):
        a = TAU * k / 10
        m.add(ellipsoid((math.cos(a) * 0.33, math.sin(a) * 0.33, zt + 0.003), (0.035, 0.022, 0.006), rot=rot_xyz(z=a), seg=8, rings=4), 'petal', outline=False)
    m.add(cylinder((0.08, 0.05, zt), (0.08, 0.05, zt + 0.14), 0.045, 0.03, seg=14), 'vase')
    for dx, dz, t in ((-0.06, 0.2, -0.4), (0.07, 0.24, 0.35), (0.0, 0.3, 0.05)):
        tip = V((0.08 + dx, 0.05, zt + 0.14 + dz))
        m.add(cylinder((0.08, 0.05, zt + 0.12), tip, 0.008, seg=5), 'branch')
        blossom(m, tip, 0.04, normal_tilt=t)


def b_cherry_bonsai(M):
    """FU-94 벚꽃 분재 (1×1): 낮은 네모 화분 · 굽은 줄기 · 둥근 꽃 덩이 셋 (분홍 덩이 + 송이 몇)"""
    m = M.part('bonsai')
    m.add(box((0, 0, 0.08), (0.5, 0.36, 0.16), bevel=0.02), 'pot')
    m.add(box((0, 0, 0.165), (0.44, 0.3, 0.02), bevel=0.006), 'soil')
    trunk = bezier(V((0.05, 0, 0.17)), V((-0.12, 0, 0.35)), V((0.16, 0, 0.5)), V((-0.02, 0, 0.7)), 12)
    m.add(tube(trunk, [0.05 - 0.03 * i / (len(trunk) - 1) for i in range(len(trunk))], seg=10), 'branch')
    m.add(cylinder(trunk[6], V((0.2, 0.02, 0.58)), 0.016, seg=6), 'branch')
    for c, r in (((-0.02, 0, 0.78), 0.17), ((0.2, 0.02, 0.62), 0.12), ((-0.16, 0, 0.6), 0.11)):
        m.add(ellipsoid(c, (r, r * 0.9, r * 0.75), seg=16, rings=10), 'bloom')
        for k in range(4):
            a = TAU * k / 4 + c[0] * 7
            blossom(m, V(c) + V((math.cos(a) * r * 0.75, -r * 0.55, math.sin(a) * r * 0.4 + r * 0.2)), 0.035, normal_tilt=0.9)
    for k in range(3):
        a = TAU * k / 3 + 0.4
        m.add(ellipsoid((math.cos(a) * 0.15, math.sin(a) * 0.09, 0.18), (0.022, 0.014, 0.004), rot=rot_xyz(z=a), seg=8, rings=4), 'petal', outline=False)


def b_cherry_wall(M):
    """FU-95 벚꽃 가지 벽 장식 (벽): 벽에 비스듬히 걸린 나무 가지 하나에 벚꽃 여러 송이 · 꽃잎 둘이 떨어지는 중"""
    m = M.part('branch')
    zc = 1.45
    pts = bezier(V((-0.42, -0.03, zc - 0.12)), V((-0.15, -0.05, zc + 0.08)), V((0.15, -0.05, zc - 0.02)), V((0.42, -0.03, zc + 0.16)), 14)
    m.add(tube(pts, [0.03 - 0.018 * i / (len(pts) - 1) for i in range(len(pts))], seg=8), 'branch')
    m.add(cylinder(pts[5], V((-0.02, -0.05, zc + 0.26)), 0.012, seg=6), 'branch')
    m.add(cylinder(pts[9], V((0.2, -0.05, zc - 0.17)), 0.01, seg=6), 'branch')
    for x, z, r, ph in ((-0.3, zc - 0.02, 0.06, 0.1), (-0.12, zc + 0.12, 0.07, 0.5), (-0.02, zc + 0.27, 0.055, 0.9),
                        (0.08, zc + 0.03, 0.065, 0.3), (0.2, zc - 0.16, 0.05, 0.7), (0.3, zc + 0.09, 0.06, 0.2), (0.43, zc + 0.18, 0.045, 0.6)):
        blossom_wall(m, (x, -0.07, z), r, phase=ph)
    for x, z, a in ((0.0, zc - 0.3, 0.6), (-0.22, zc - 0.42, -0.4)):
        m.add(ellipsoid((x, -0.08, z), (0.03, 0.006, 0.02), rot=rot_xyz(y=a), seg=8, rings=4), 'petal')


# ================================================================ 여름 조개 FU-96–98
def b_shell_lamp(M):
    """FU-96 조개 등 (1×1): 모래빛 받침 위 크게 벌어진 가리비 껍데기 · 안에 둥근 진주 불빛 (밤에 켜짐)"""
    m = M.part('lamp')
    m.add(cylinder((0, 0, 0), (0, 0, 0.06), 0.22, 0.2, seg=24), 'sand')
    for k in range(5):
        a = TAU * k / 5 + 0.3
        m.add(ellipsoid((math.cos(a) * 0.16, math.sin(a) * 0.16, 0.065), (0.035, 0.025, 0.018), rot=rot_xyz(z=a), seg=8, rings=4), 'pebble')
    # 아래 껍데기 (접시처럼) · 뒤에 선 위 껍데기 (부채)
    m.add(ellipsoid((0, 0, 0.12), (0.24, 0.2, 0.05), seg=24, rings=10), 'shell')
    sh = scallop((0, 0.12, 0.36), 0.25, 0.26, d=0.03, rot=rot_xyz(x=-0.35))
    m.add(sh, 'shell')
    for k in range(7):   # 부채 골
        a = -0.9 + 1.8 * k / 6
        base, tip = V((0, 0.07, 0.17)), V((math.sin(a) * 0.23, 0.12 - 0.08 * math.cos(a), 0.17 + math.cos(a) * 0.36))
        m.add(cylinder(base, tip, 0.006, seg=5), 'shellRib', outline=False)
    m.add(ellipsoid((0, -0.03, 0.22), (0.1, 0.1, 0.1), seg=20, rings=12), 'glow', outline=False)


def b_shell_chair(M):
    """FU-97 조개 의자 (1×1, 앉기): 하늘색 받침 · 진주빛 방석 · 등받이가 커다란 가리비 껍데기"""
    m = M.part('chair')
    sh = 0.44
    m.add(cylinder((0, 0, 0), (0, 0, 0.05), 0.24, 0.22, seg=24), 'sea')
    m.add(cylinder((0, 0, 0.05), (0, 0, sh - 0.06), 0.1, 0.14, seg=16), 'sea')
    m.add(cylinder((0, 0, sh - 0.06), (0, 0, sh - 0.02), 0.25, seg=28), 'sea')
    m.add(ellipsoid((0, -0.02, sh + 0.01), (0.24, 0.22, 0.05), seg=28, rings=10), 'cushion')
    m.add(scallop((0, 0.19, sh + 0.3), 0.3, 0.32, d=0.035, rot=rot_xyz(x=-0.15)), 'shell')
    for k in range(7):
        a = -0.95 + 1.9 * k / 6
        base, tip = V((0, 0.16, sh + 0.02)), V((math.sin(a) * 0.27, 0.17 - 0.02 * math.cos(a), sh + 0.02 + math.cos(a) * 0.55))
        m.add(cylinder(base, tip, 0.007, seg=5), 'shellRib', outline=False)
    m.add(ellipsoid((0, 0.15, sh + 0.06), (0.05, 0.035, 0.04), seg=12, rings=8), 'pearl')


def b_shell_mirror(M):
    """FU-98 조개 벽 거울 (벽): 둥근 거울 둘레에 작은 조개·불가사리 테"""
    m = M.part('mirror')
    cz, R = 1.5, 0.27
    m.add(cylinder((0, 0, cz), (0, -0.04, cz), R + 0.06, seg=40), 'sand')
    m.add(cylinder((0, -0.04, cz), (0, -0.05, cz), R, seg=40), 'mirror', outline=False)
    m.add(box((-0.08, -0.052, cz + 0.08), (0.03, 0.003, 0.16), bevel=0.002, rot=rot_xyz(y=0.6)), 'glint', outline=False)
    for k in range(12):
        a = TAU * k / 12
        p = (math.sin(a) * (R + 0.05), -0.06, cz + math.cos(a) * (R + 0.05))
        if k % 3 == 0:
            m.add(star_shape(p, 0.05, 0.02, rot=rot_xyz(y=-a), puff=0.2), 'star')
        else:
            m.add(scallop(p, 0.04, 0.045, d=0.012, rot=rot_xyz(y=-a)), 'shell' if k % 2 else 'shellPink')
    m.add(ellipsoid((0, -0.07, cz + R + 0.1), (0.035, 0.03, 0.035), seg=10, rings=6), 'pearl')


# ================================================================ 가을 단풍 FU-99–101
def b_maple_shelf(M):
    """FU-99 단풍 선반 (1×1): 짙은 나무 3단 선반 · 칸마다 도토리·책·작은 호박 · 위에 단풍잎 셋"""
    m = M.part('shelf')
    W, D, H = 0.8, 0.36, 1.0
    for sx in (1, -1):
        m.add(box((sx * (W / 2 - 0.02), 0, H / 2), (0.04, D, H), bevel=0.01), 'wood')
    m.add(box((0, D / 2 - 0.01, H / 2), (W - 0.04, 0.02, H), bevel=0.004), 'woodDark')
    for z in (0.04, 0.36, 0.68, H - 0.02):
        m.add(box((0, 0, z), (W, D, 0.04), bevel=0.01), 'wood')
    for k in range(4):   # 아래 칸 책
        m.add(box((-0.25 + k * 0.07, 0.02, 0.17), (0.055, 0.24, 0.22 - k % 2 * 0.03), bevel=0.006), ('book', 'leaf', 'leafDeep', 'book')[k])
    m.add(ellipsoid((0.2, 0.0, 0.14), (0.09, 0.09, 0.08), seg=16, rings=10), 'pumpkin')
    m.add(cylinder((0.2, 0.0, 0.21), (0.21, 0.0, 0.25), 0.012, seg=6), 'woodDark')
    for x in (-0.2, -0.08):   # 가운데 칸 도토리
        m.add(ellipsoid((x, 0, 0.45), (0.045, 0.045, 0.055), seg=12, rings=8), 'acorn')
        m.add(ellipsoid((x, 0, 0.5), (0.05, 0.05, 0.025), seg=12, rings=6), 'woodDark')
    m.add(box((0.17, 0.02, 0.48), (0.2, 0.16, 0.18), bevel=0.02), 'basket')
    maple_leaf(m, (0.12, 0.02, 0.48 + 0.12), 0.09, 'leaf', rot_z=0.3)
    m.add(box((-0.1, 0.03, 0.79), (0.24, 0.2, 0.18), bevel=0.02), 'jar', outline=True)
    maple_leaf(m, (-0.1, -0.075, 0.8), 0.08, 'leafDeep', flat=False)
    for x, r, mat, rz in ((-0.24, 0.1, 'leaf', 0.4), (0.08, 0.12, 'leafDeep', -0.3), (0.28, 0.09, 'leafGold', 0.9)):
        maple_leaf(m, (x, -0.02, H + 0.01), r, mat, rot_z=rz)


def b_maple_rug(M):
    """FU-100 단풍잎 깔개 (2×2, 바닥에 까는 것): 크림 바탕 둥근 깔개에 커다란 단풍잎 하나 + 작은 잎 넷"""
    m = M.part('rug')
    m.add(cylinder((0, 0, 0), (0, 0, 0.02), 0.95, seg=48), 'rugBase')
    m.add(annulus((0, 0, 0.02), 0.82, 0.88, thick=0.006, seg=48), 'rugEdge')
    maple_leaf(m, (0, 0.05, 0.026), 0.62, 'leaf', thick=0.006)
    for k in range(4):
        a = TAU * k / 4 + math.pi / 4
        maple_leaf(m, (math.cos(a) * 0.66, math.sin(a) * 0.66, 0.026), 0.16, ('leafGold', 'leafDeep')[k % 2], rot_z=a, thick=0.006)


def b_maple_lamp(M):
    """FU-101 단풍 등 (1×1): 굵은 통나무 받침 · 휜 가지 끝에 단풍잎 모양 종이 등 (안이 빛남)"""
    m = M.part('lamp')
    m.add(cylinder((0, 0, 0), (0, 0, 0.12), 0.18, 0.17, seg=20), 'wood')
    m.add(annulus((0, 0, 0.12), 0.08, 0.12, thick=0.004, seg=20), 'woodDark')
    arm = bezier(V((0, 0, 0.12)), V((0, 0, 0.7)), V((0.05, 0, 1.0)), V((0.18, -0.02, 1.05)), 12)
    m.add(tube(arm, [0.03 - 0.012 * i / (len(arm) - 1) for i in range(len(arm))], seg=8), 'woodDark')
    c = V((0.18, -0.04, 0.88))
    m.add(cylinder(arm[-1], c + V((0, 0, 0.14)), 0.004, seg=4), 'string', outline=False)
    m.add(ellipsoid(c, (0.14, 0.12, 0.13), seg=20, rings=12), 'glow', outline=False)
    maple_leaf(m, c + V((0, -0.12, 0)), 0.12, 'leaf', flat=False, thick=0.01)
    maple_leaf(m, c + V((0, 0.12, 0)), 0.12, 'leaf', flat=False, thick=0.01)
    maple_leaf(m, (0.12, -0.08, 0.13), 0.08, 'leafGold', rot_z=1.2)


# ================================================================ 겨울 눈 결정 FU-102–104
def b_snowflake_lamp(M):
    """FU-102 눈 결정 등 (1×1): 하얀 둥근 받침 · 가는 은빛 기둥 · 위에 서 있는 큰 눈 결정 (밤에 푸르게 빛남)"""
    m = M.part('lamp')
    m.add(cylinder((0, 0, 0), (0, 0, 0.06), 0.2, 0.18, seg=24), 'snow')
    m.add(ellipsoid((0, 0, 0.07), (0.16, 0.16, 0.04), seg=20, rings=8), 'snow')
    m.add(cylinder((0, 0, 0.08), (0, 0, 0.62), 0.02, seg=10), 'metal')
    snowflake(m, (0, 0, 0.88), 0.28, 'glow', thick=0.022)
    for k, (x, z) in enumerate(((-0.13, 0.2), (0.14, 0.16))):
        snowflake(m, (x, -0.1, z), 0.05, 'crystal', thick=0.008)


def b_snowflake_table(M):
    """FU-103 눈 결정 탁자 (1×1): 얼음빛 둥근 유리 상판에 눈 결정 무늬 · 하얀 다리 셋 · 위에 털모자 쓴 작은 찻잔"""
    m = M.part('table')
    zt = 0.6
    for k in range(3):
        a = TAU * k / 3 + math.pi / 2
        m.add(cylinder((math.cos(a) * 0.26, math.sin(a) * 0.26, 0), (math.cos(a) * 0.2, math.sin(a) * 0.2, zt - 0.03), 0.03, 0.025, seg=10), 'snow')
    m.add(annulus((0, 0, 0.22), 0.18, 0.22, thick=0.02, seg=24), 'metal')
    m.add(cylinder((0, 0, zt - 0.04), (0, 0, zt), 0.4, seg=6), 'ice')
    m.add(annulus((0, 0, zt - 0.04), 0.37, 0.41, thick=0.045, seg=6), 'snow')
    snowflake(m, (0, 0, zt + 0.002), 0.24, 'crystal', thick=0.006, face_y=False)
    m.add(cylinder((0.12, -0.08, zt), (0.12, -0.08, zt + 0.07), 0.045, 0.05, seg=14), 'cup')
    m.add(cylinder((0.12, -0.08, zt + 0.06), (0.12, -0.08, zt + 0.065), 0.04, seg=14), 'tea', outline=False)
    m.add(annulus((0.172, -0.08, zt + 0.035), 0.012, 0.02, axis=(0, 1, 0), thick=0.008, seg=10), 'cup')


def b_snowflake_wall(M):
    """FU-104 눈 결정 벽 장식 (벽): 벽에 건 은빛 둥근 테 안에 큰 눈 결정 하나 + 작은 결정 셋 (큰 결정은 밤에 빛남)"""
    m = M.part('deco')
    cz, R = 1.5, 0.3
    ring = [V((math.sin(TAU * i / 32) * R, -0.03, cz + math.cos(TAU * i / 32) * R)) for i in range(32)]
    m.add(tube(ring, [0.018] * 32, seg=8, closed=True), 'metal')
    m.add(cylinder((0, 0, cz), (0, -0.01, cz), R - 0.01, seg=32), 'night', outline=False)
    snowflake(m, (0, -0.04, cz), 0.22, 'glow', thick=0.016)
    for x, z, r in ((-0.2, cz + 0.37, 0.06), (0.24, cz - 0.36, 0.07), (0.33, cz + 0.2, 0.05)):
        snowflake(m, (x, -0.04, z), r, 'crystal', thick=0.009)
    m.add(cylinder((0, -0.03, cz + R), (0, -0.01, cz + R + 0.1), 0.004, seg=4), 'metal', outline=False)


def builders(g):
    """build_furniture.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {
        'cherry-chair': b_cherry_chair, 'cherry-table': b_cherry_table, 'cherry-bonsai': b_cherry_bonsai, 'cherry-wall': b_cherry_wall,
        'shell-lamp': b_shell_lamp, 'shell-chair': b_shell_chair, 'shell-mirror': b_shell_mirror,
        'maple-shelf': b_maple_shelf, 'maple-rug': b_maple_rug, 'maple-lamp': b_maple_lamp,
        'snowflake-lamp': b_snowflake_lamp, 'snowflake-table': b_snowflake_table, 'snowflake-wall': b_snowflake_wall,
    }
