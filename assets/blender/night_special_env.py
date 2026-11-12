"""P54 밤 특별 상점 — 배경 빌더 (BD-13–15 · PR-35, 결정 D165–D169)

build_env.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import night_special_env; BUILDERS.update(night_special_env.builders(globals()))
builders(g) 는 build_env.py 의 도우미(box·cylinder·prism·star_shape·crescent·paper_lantern …)를 이 모듈로 가져와 쓴다.

건물 셋은 새벽 천막 BD-09 처럼 3×3 집터, 문(재질 door)은 앞 가운데 (Blender -Y → 게임 +Z), glow·window 는 밤에 켜짐.
좌표: Blender Z-up, 1.0 = 한 칸, 원점 = 바닥 가운데. 재질 이름 = 팔레트 키. 글자는 넣지 않는다 (모양만).
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'prism', 'rot_xyz', 'bezier', 'star_shape', 'crescent',
           'paper_lantern', 'P', 'TAU', 'bmesh')


def _h(*k):
    """조각 색 고르기용 작은 해시 (0 ≤ 값 < 1)"""
    x = 0
    for v in k:
        x = (x * 73856093 ^ (int(v) + 7) * 19349663) & 0xFFFFFFFF
    return (x % 997) / 997.0


def add_patches(m, rings, mats, seed=0, close_top=True):
    """고리(점 목록)들을 이어 붙인 천 껍데기. 칸마다 mats 중 하나 (헝겊 조각처럼), 맨 위 고리는 한 점으로 모아 닫는다."""
    n = len(rings[0])
    for i in range(len(rings) - 1):
        bm = bmesh.new()
        for j in range(n):
            k = (j + 1) % n
            q = [bm.verts.new(p) for p in (rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j])]
            bm.faces.new(q)
        _add_faces(m, bm, [mats[int(_h(i, j, seed) * len(mats))] for j in range(n)])
    if close_top:
        bm = bmesh.new()
        top = sum(rings[-1], V((0, 0, 0))) / n
        for j in range(n):
            bm.faces.new([bm.verts.new(rings[-1][j]), bm.verts.new(rings[-1][(j + 1) % n]), bm.verts.new(top)])
        _add_faces(m, bm, [mats[int(_h(99, j, seed) * len(mats))] for j in range(n)])


def _add_faces(m, bm, face_mats):
    """면 순서대로 재질을 준다 (Part.add 는 면 함수로만 나누므로, 면 중심 → 재질 표를 미리 만든다)"""
    bm.faces.ensure_lookup_table()
    table = {tuple(round(c, 5) for c in f.calc_center_median()): face_mats[i] for i, f in enumerate(bm.faces)}
    m.add(bm, lambda c, nrm: table.get(tuple(round(x, 5) for x in c), face_mats[0]), smooth=False)


# ---------------------------------------------------------------- BD-13 이상한 천막
def b_odd_tent(M):
    """BD-13 이상한 천막: 서너 가지 색 헝겊을 기워 만든 살짝 삐뚤어진 육각 천막. 꼭대기가 한쪽으로 기울고,
    옆에 기운 장대 · 매달린 등불(glow) · 입구 위 초승달과 물음표 모양 간판(모양만, glow). 앞 가운데 천 문(door)."""
    R, Hw, Ht = 1.12, 0.6, 2.45
    m = M.part('tent')
    seg = 6
    rot0 = math.pi / 6 - math.pi / 2   # 육각형의 한 면이 정면(-Y)을 보게
    mats = ('patchA', 'patchB', 'patchC', 'patchD')
    m.add(cylinder((0, 0, 0), (0, 0, 0.06), R + 0.06, seg=seg), 'foundation', smooth=False)
    def ring(r, z, dx=0.0, dy=0.0, wob=0.0):
        """육각 둘레 12점 (꼭짓점 + 변 가운데 — 헝겊 칸을 잘게), wob 만큼 들쭉날쭉"""
        out = []
        for k in range(seg * 2):
            a0 = rot0 + TAU * (k // 2) / seg
            p = V((math.cos(a0), math.sin(a0), 0))
            if k % 2:
                p = (p + V((math.cos(a0 + TAU / seg), math.sin(a0 + TAU / seg), 0))) / 2
            f = r * (1 + wob * (_h(k, z * 10) - 0.5))
            out.append(V((p.x * f + dx, p.y * f + dy, z)))
        return out
    walls = [ring(R, 0.06), ring(R * 0.99, Hw * 0.5, wob=0.04), ring(R * 0.97, Hw)]
    add_patches(m, walls, mats, seed=1, close_top=False)
    apex = V((0.22, 0.08, Ht))
    roof = []
    for i in range(5):   # 지붕: 처마에서 기운 꼭대기로 (가운데가 살짝 처짐)
        t = i / 4
        c = V((0, 0, Hw)) * (1 - t) + apex * t
        r = R * 1.06 * (1 - t) ** 1.08 + 0.04
        sag = -0.06 * math.sin(math.pi * t)
        roof.append(ring(r, c.z + sag, c.x, c.y, wob=0.05 * (1 - t)))
    add_patches(m, roof, mats, seed=2)
    eave = ring(R * 1.07, Hw + 0.01)
    m.add(tube(eave, [0.028] * len(eave), seg=6, closed=True), 'rope', smooth=False)
    for k in range(seg):   # 기운 자국: 처마에서 꼭대기까지 굵은 바늘땀 줄 (모서리마다)
        a = eave[k * 2]
        pts = [a * (1 - t) + apex * t + V((0, 0, -0.06 * math.sin(math.pi * t))) for t in (i / 6 for i in range(7))]
        m.add(tube(pts, [0.016] * 7, seg=5), 'rope')
    # 꼭대기: 기운 짧은 장대 + 작은 깃발 조각
    m.add(cylinder(apex - V((0, 0, 0.05)), apex + V((0.12, 0.02, 0.32)), 0.03, seg=8), 'pole')
    fl = apex + V((0.1, 0.02, 0.26))
    m.add(prism(fl + V((0.14, 0, -0.06)), 0.26, 0.02, 0.14, ridge='x'), 'patchB')
    # 입구 (앞 = -Y): 짧은 통로 · 천 문 · 걷은 자락 · 깔개
    fy = -R * math.cos(math.pi / 6)
    ey = fy - 0.22
    m.add(box((0, ey + 0.14, 0.6), (0.86, 0.32, 1.16), bevel=0.03), 'patchC')
    m.add(prism((0, ey + 0.16, 1.16), 1.0, 0.5, 0.3, overhang=0.05), 'patchA')
    m.add(box((0, ey - 0.03, 0.06 + 0.5), (0.6, 0.06, 1.0), bevel=0.03), 'door')
    for sx in (1, -1):
        m.add(ellipsoid((sx * 0.35, ey - 0.05, 0.72), (0.09, 0.05, 0.4), rot=rot_xyz(y=sx * 0.15), seg=12, rings=8), 'patchD')
        m.add(ellipsoid((sx * 0.35, ey - 0.09, 0.74), (0.1, 0.03, 0.03), seg=8, rings=5), 'rope')
    for x, z, w, h, mat in ((-0.12, 0.4, 0.16, 0.14, 'patchB'), (0.14, 0.75, 0.12, 0.12, 'patchD')):   # 문에 덧댄 헝겊
        m.add(box((x, ey - 0.065, z), (w, 0.012, h), bevel=0.004, rot=rot_xyz(y=0.15)), mat)
    m.add(box((0.05, ey - 0.2, 0.03), (0.82, 0.3, 0.06), bevel=0.02), 'rug')
    # 입구 위 간판: 비뚤게 매단 나무판 + 초승달 + 물음표 모양 (갈고리 + 점)
    sz = 1.62
    m.add(box((0, ey - 0.1, sz), (0.62, 0.05, 0.34), bevel=0.02, rot=rot_xyz(y=0.08)), 'pole')
    for sx in (1, -1):
        m.add(cylinder((sx * 0.25, ey - 0.08, sz + 0.17), (sx * 0.2, ey + 0.05, sz + 0.34), 0.008, seg=5), 'rope')
    crescent(m, (-0.08, ey - 0.13, sz), 0.12, 0.02, 'glow', a0=-80, a1=80)
    hook = [V((0.1 + 0.055 * math.cos(a), ey - 0.13, sz + 0.06 + 0.055 * math.sin(a))) for a in (math.radians(d) for d in (160, 110, 60, 10, -40, -80))]
    hook += [V((0.12, ey - 0.13, sz - 0.04)), V((0.12, ey - 0.13, sz - 0.07))]
    m.add(tube(hook, [0.02] * len(hook), seg=6), 'glow')
    m.add(ellipsoid((0.12, ey - 0.13, sz - 0.12), (0.024, 0.02, 0.024), seg=8, rings=5), 'glow')
    # 옆에 기운 장대 + 매달린 등불
    base = V((-R * 0.95, ey + 0.05, 0.0))
    top = base + V((-0.18, -0.08, 2.0))
    m.add(cylinder(base, base + V((0, 0, 0.06)), 0.1, 0.08, seg=10), 'foundation')
    m.add(cylinder(base, top, 0.04, 0.032, seg=8), 'pole')
    arm = [top - V((0.02, 0, 0.1)), top + V((0.22, -0.02, -0.06)), top + V((0.38, -0.04, -0.14))]
    m.add(tube(arm, [0.022] * 3, seg=6), 'pole')
    hang = arm[-1]
    m.add(cylinder(hang, hang - V((0, 0, 0.18)), 0.006, seg=5), 'rope')
    lc = hang - V((0, 0, 0.36))
    m.add(cylinder(lc + V((0, 0, 0.17)), lc + V((0, 0, 0.21)), 0.08, 0.06, seg=10), 'metal')
    m.add(cylinder(lc - V((0, 0, 0.15)), lc + V((0, 0, 0.17)), 0.11, 0.09, seg=8), 'glow')
    for k in range(4):
        a = TAU * k / 4 + TAU / 8
        m.add(cylinder(lc + V((math.cos(a) * 0.105, math.sin(a) * 0.105, -0.15)), lc + V((math.cos(a) * 0.088, math.sin(a) * 0.088, 0.17)), 0.012, seg=4), 'metal')
    m.add(cylinder(lc - V((0, 0, 0.19)), lc - V((0, 0, 0.15)), 0.1, 0.11, seg=10), 'metal')
    # 천막 옆면에 매단 작은 별·달 조각 둘 (patch 위 장식)
    for x, z, r in ((0.7, 1.2, 0.06), (-0.55, 1.45, 0.05)):
        t = (z - Hw) / (Ht - Hw)
        y = fy * (1 - t) * 1.05 - 0.03
        m.add(star_shape((x * (1 - t * 0.6), y, z), r, 0.015, rot=rot_xyz(x=-0.45), puff=0.2), 'rope')


# ---------------------------------------------------------------- BD-14 여우 상인 가게
def b_fox_shop(M):
    """BD-14 여우 상인 가게: 떠돌이 여우 상인의 작은 나무 가게집. 짙은 나무 벽 · 지붕 앞 양쪽에 여우 귀처럼 뾰족한 박공 둘 ·
    가운데 포렴처럼 드리운 천 문(door) · 문 양옆 종이 등불 둘(glow) · 문 옆에 걸린 작은 액자 둘 · 둥근 창(window)"""
    W, D, Hh = 2.3, 1.75, 1.45
    m = M.part('shop')
    m.add(box((0, 0, 0.08), (W + 0.16, D + 0.16, 0.16), bevel=0.04), 'foundation')
    m.add(box((0, 0, 0.16 + Hh / 2), (W, D, Hh), bevel=0.05), 'wall')
    top = 0.16 + Hh
    for x in (-W / 2 + 0.05, W / 2 - 0.05):   # 모서리 기둥
        for y in (-D / 2 + 0.05, D / 2 - 0.05):
            m.add(box((x, y, 0.16 + Hh / 2), (0.13, 0.13, Hh), bevel=0.02), 'trim')
    for z in (0.3, top - 0.08):   # 가로 띠
        m.add(box((0, -D / 2 - 0.01, z), (W - 0.1, 0.04, 0.07), bevel=0.012), 'trim')
    for k in range(7):   # 세로 판자 줄눈
        x = -W / 2 + (k + 0.5) * W / 7
        if abs(x) > 0.45:
            m.add(box((x, -D / 2 - 0.005, 0.16 + Hh / 2), (0.018, 0.02, Hh - 0.2), bevel=0.0), 'wallDark')
    m.add(box((0, 0, top + 0.03), (W + 0.1, D + 0.1, 0.08), bevel=0.02), 'trim')
    m.add(prism((0, 0, top + 0.05), W, D, 0.75 * 0.95), 'wall')
    m.add(prism((0, 0, top + 0.08), W, D, 0.75, overhang=0.18), 'roof')
    # 여우 귀 박공 둘: 지붕 앞 경사면 위에 앞을 보는 뾰족한 삼각 지붕 (귀 안쪽은 밝은 색)
    for sx in (1, -1):
        cx = sx * 0.62
        base_z = top + 0.18
        ear = prism((cx, -D * 0.22, base_z), 0.66, 0.52, 0.9, overhang=0.04, ridge='y')
        bmesh.ops.rotate(ear, verts=ear.verts, cent=(cx, -D * 0.22, base_z), matrix=rot_xyz(y=-sx * 0.12))
        m.add(ear, 'roof', smooth=False)
        tri = [V((cx - 0.17, -D * 0.22 - 0.38, base_z + 0.04)), V((cx + 0.17, -D * 0.22 - 0.38, base_z + 0.04)), V((cx, -D * 0.22 - 0.38, base_z + 0.74))]
        bm = bmesh.new()
        f = [bm.verts.new(p) for p in tri]
        b = [bm.verts.new(p + V((0, 0.03, 0))) for p in tri]
        bm.faces.new(f)
        bm.faces.new(list(reversed(b)))
        for i in range(3):
            j = (i + 1) % 3
            bm.faces.new([f[i], f[j], b[j], b[i]])
        m.add(bm, 'earInner', smooth=False)
        tip = prism((cx, -D * 0.22, base_z + 0.68), 0.7, 0.17, 0.24, overhang=0.02, ridge='y')
        bmesh.ops.rotate(tip, verts=tip.verts, cent=(cx, -D * 0.22, base_z), matrix=rot_xyz(y=-sx * 0.12))
        m.add(tip, 'earTip', smooth=False)
    # 문: 문틀 + 포렴 천 세 자락 (위는 막대, 아래는 갈라짐)
    dy = -D / 2 - 0.03
    m.add(box((0, dy + 0.02, 0.16 + 0.55), (0.72, 0.04, 1.1), bevel=0.02), 'wallDark')
    for sx in (1, -1):
        m.add(box((sx * 0.38, dy, 0.16 + 0.6), (0.07, 0.07, 1.2), bevel=0.015), 'trim')
    m.add(box((0, dy, 0.16 + 1.22), (0.86, 0.08, 0.08), bevel=0.015), 'trim')
    for k in range(3):
        x = -0.22 + 0.22 * k
        m.add(box((x, dy - 0.05, 0.16 + 0.85), (0.205, 0.03, 0.66), bevel=0.012), 'door')
    m.add(ellipsoid((0, dy - 0.07, 0.16 + 0.98), (0.09, 0.008, 0.09), seg=14, rings=6), 'doorMark')   # 포렴 무늬 (여우 꼬리 같은 동그라미)
    m.add(ellipsoid((0.03, dy - 0.075, 0.16 + 1.0), (0.05, 0.008, 0.05), seg=12, rings=6), 'door')
    m.add(box((0, dy - 0.22, 0.05), (0.8, 0.36, 0.1), bevel=0.03), 'foundation')
    # 등불 둘 (처마에서 매닮)
    for sx in (1, -1):
        p = V((sx * 0.62, dy - 0.12, top - 0.02))
        m.add(cylinder(p + V((0, 0.12, 0.02)), p, 0.012, seg=5), 'trim')
        m.add(cylinder(p, p - V((0, 0, 0.1)), 0.006, seg=5), 'trim')
        paper_lantern(m, p - V((0, 0, 0.27)), 'lantern', 1.15)
    # 둥근 창 (오른쪽)
    c = V((0.78, -D / 2 - 0.02, 0.16 + Hh * 0.45))
    m.add(cylinder(c + V((0, 0.03, 0)), c - V((0, 0.05, 0)), 0.26, seg=20), 'trim')
    m.add(cylinder(c, c - V((0, 0.065, 0)), 0.2, seg=20), 'window')
    m.add(box(c - V((0, 0.07, 0)), (0.4, 0.02, 0.03), bevel=0.0), 'trim')
    m.add(box(c - V((0, 0.07, 0)), (0.03, 0.02, 0.4), bevel=0.0), 'trim')
    m.add(box(c + V((0, -0.1, -0.3)), (0.6, 0.18, 0.05), bevel=0.015), 'trim')   # 창 아래 선반
    for k, x in enumerate((-0.15, 0.0, 0.15)):   # 선반 위 작은 항아리
        m.add(ellipsoid(c + V((x, -0.1, -0.22)), (0.05, 0.05, 0.055), seg=10, rings=6), 'lantern' if k % 2 else 'pictureB')
    # 문 왼쪽 벽에 걸린 작은 액자 둘
    for k, (x, z, w, h) in enumerate(((-0.72, 0.16 + Hh * 0.62, 0.36, 0.28), (-0.82, 0.16 + Hh * 0.3, 0.26, 0.32))):
        y = -D / 2 - 0.03
        m.add(box((x, y, z), (w, 0.04, h), bevel=0.01), 'frame')
        m.add(box((x, y - 0.022, z), (w - 0.07, 0.006, h - 0.07), bevel=0.0), 'pictureA' if k == 0 else 'pictureB')
        if k == 0:
            m.add(ellipsoid((x + 0.06, y - 0.027, z + 0.03), (0.04, 0.004, 0.04), seg=12, rings=5), 'lantern')
            m.add(ellipsoid((x - 0.03, y - 0.026, z - 0.05), (0.1, 0.004, 0.04), seg=12, rings=5), 'pictureB')
        else:
            m.add(ellipsoid((x, y - 0.027, z), (0.05, 0.004, 0.07), seg=12, rings=5), 'pictureA')
        m.add(cylinder((x, y + 0.01, z + h / 2 + 0.06), (x, y + 0.01, z + h / 2), 0.006, seg=5), 'trim')
    # 지붕 꼭대기 작은 꼬리 깃발
    fp = V((0, 0.1, top + 0.83))
    m.add(cylinder(fp - V((0, 0, 0.05)), fp + V((0, 0, 0.42)), 0.025, seg=8), 'trim')
    flag = [fp + V((0.03 + 0.07 * t, 0, 0.38 - 0.02 * t + 0.05 * math.sin(3 * t))) for t in (i / 6 for i in range(7))]
    m.add(tube(flag, [0.07 * (1 - 0.5 * i / 6) for i in range(7)], seg=8, flat=0.3), 'door')
    m.add(ellipsoid(flag[-1] + V((0.04, 0, 0)), (0.05, 0.022, 0.04), seg=10, rings=6), 'earInner')


# ---------------------------------------------------------------- BD-15 운세 부스
def b_fortune_booth(M):
    """BD-15 운세 부스: 작은 육각 부스. 별무늬 천 둥근 지붕 · 꼭대기 초승달 간판(glow) · 앞 가운데 커튼 문(door) ·
    처마에 매달린 작은 별 장식"""
    R, Hw = 1.05, 1.45
    m = M.part('booth')
    seg = 6
    rot = rot_xyz(z=math.pi / 6 + math.pi / 2)   # 한 면이 정면을 보게
    def hexcyl(a, b, r1, r2=None):
        bm = cylinder(a, b, r1, r2, seg=seg)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
        return bm
    m.add(hexcyl((0, 0, 0), (0, 0, 0.12), R + 0.1), 'foundation', smooth=False)
    m.add(hexcyl((0, 0, 0.12), (0, 0, Hw), R, R * 0.97), lambda c, n: 'wallB' if (round(math.degrees(math.atan2(c.y, c.x)) / 60) % 2) else 'wall', smooth=False)
    for k in range(seg):   # 모서리 기둥
        a = TAU * k / seg
        p = V((math.cos(a) * R * 0.99, math.sin(a) * R * 0.99, 0))
        m.add(cylinder(p + V((0, 0, 0.12)), p + V((0, 0, Hw + 0.05)), 0.05, seg=8), 'trim')
    m.add(hexcyl((0, 0, Hw - 0.02), (0, 0, Hw + 0.1), R + 0.14), 'trim', smooth=False)
    # 둥근 천 지붕 (위 반구) + 별
    dome = ellipsoid((0, 0, Hw + 0.08), (R + 0.08, R + 0.08, 0.95), seg=18, rings=12)
    bmesh.ops.delete(dome, geom=[v for v in dome.verts if v.co.z < Hw + 0.07], context='VERTS')
    m.add(dome, lambda c, n: 'roofB' if int((math.degrees(math.atan2(c.y, c.x)) + 180) // 20) % 2 else 'roof')
    for k in range(9):
        a = TAU * k / 9 + 0.2
        el = math.radians(20 + 25 * (k % 3))
        nrm = V((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        p = V((0, 0, Hw + 0.08)) + V((nrm.x * (R + 0.09), nrm.y * (R + 0.09), nrm.z * 0.96))
        m.add(star_shape(p, 0.07 if k % 2 else 0.05, 0.02, rot=rot_xyz(z=a + math.pi / 2) @ rot_xyz(x=-el), puff=0.2), 'trim')
    # 꼭대기 초승달 간판
    tz = Hw + 0.08 + 0.95
    m.add(cylinder((0, 0, tz - 0.06), (0, 0, tz + 0.18), 0.03, seg=8), 'trim')
    m.add(ellipsoid((0, 0, tz + 0.2), (0.05, 0.05, 0.05), seg=10, rings=6), 'trim')
    crescent(m, (0.06, -0.02, tz + 0.55), 0.34, 0.07, 'glow', a0=-80, a1=80)
    m.add(star_shape((-0.18, -0.02, tz + 0.62), 0.07, 0.025, puff=0.25), 'glow')
    # 앞 커튼 문 (앞 면 y = -R·cos30°)
    fy = -R * math.cos(math.pi / 6)
    m.add(box((0, fy - 0.03, 0.12 + 0.55), (0.7, 0.05, 1.1), bevel=0.02), 'wallB')
    for k in range(5):   # 커튼 주름
        x = -0.24 + 0.12 * k
        m.add(ellipsoid((x, fy - 0.07, 0.12 + 0.55), (0.065, 0.03, 0.54), seg=10, rings=8), 'door')
    m.add(box((0, fy - 0.06, 0.12 + 1.14), (0.84, 0.08, 0.08), bevel=0.02), 'trim')   # 커튼 봉
    for sx in (1, -1):
        m.add(ellipsoid((sx * 0.3, fy - 0.11, 0.62), (0.07, 0.03, 0.03), seg=8, rings=5), 'trim')   # 묶음 끈
    m.add(box((0, fy - 0.25, 0.05), (0.84, 0.36, 0.1), bevel=0.03), 'foundation')
    # 문 위 작은 별 무늬 판
    m.add(star_shape((0, fy - 0.1, 0.12 + 1.3), 0.08, 0.025, puff=0.25), 'trim')
    # 처마에 매단 별 장식 (면 가운데마다, 앞 면 문 위는 비움)
    for k in range(seg):
        a = TAU * k / seg + math.pi / 6
        if abs(a - (-math.pi / 2) % TAU) < 0.1:
            continue
        for off in (-0.3, 0.3):
            ca, sa = math.cos(a), math.sin(a)
            p = V((ca * (R + 0.16) - sa * off, sa * (R + 0.16) + ca * off, Hw - 0.02))
            drop = 0.18 + 0.08 * ((k + (off > 0)) % 2)
            m.add(cylinder(p, p - V((0, 0, drop)), 0.006, seg=5), 'trim')
            m.add(star_shape(p - V((0, 0, drop + 0.06)), 0.055, 0.02, rot=rot_xyz(z=a + math.pi / 2), puff=0.2), 'charm')


# ---------------------------------------------------------------- PR-35 선물 상자
def b_gift_box(M):
    """PR-35 선물 상자: 리본을 두르고 위에 나비 리본을 단 포장 상자 (≈0.45), 위에 작은 반짝임(glow)"""
    S = 0.42
    m = M.part('gift')
    m.add(box((0, 0, S / 2 - 0.01), (S, S, S - 0.02), bevel=0.02), 'box')
    m.add(box((0, 0, S - 0.02), (S + 0.03, S + 0.03, 0.08), bevel=0.02), 'box')   # 뚜껑
    for sx in (1, -1):   # 상자 무늬 점
        for sz in (0.12, 0.26):
            m.add(ellipsoid((sx * 0.12, -S / 2 - 0.003, sz), (0.025, 0.006, 0.025), seg=8, rings=4), 'dot')
            m.add(ellipsoid((-S / 2 - 0.003, sx * 0.12, sz + 0.05), (0.006, 0.025, 0.025), seg=8, rings=4), 'dot')
    m.add(box((0, 0, S / 2), (0.07, S + 0.045, S + 0.05), bevel=0.008), 'ribbon')
    m.add(box((0, 0, S / 2), (S + 0.045, 0.07, S + 0.05), bevel=0.008), 'ribbon')
    top = V((0, 0, S + 0.03))
    for sx in (1, -1):   # 나비 리본 고리 · 늘어진 끝
        m.add(ellipsoid(top + V((sx * 0.08, 0, 0.06)), (0.08, 0.035, 0.055), rot=rot_xyz(y=sx * 0.5), seg=12, rings=8), 'ribbon')
        m.add(box(top + V((sx * 0.06, -0.06, 0.0)), (0.04, 0.12, 0.012), bevel=0.004, rot=rot_xyz(z=sx * 0.5)), 'ribbon')
    m.add(ellipsoid(top + V((0, 0, 0.04)), (0.035, 0.035, 0.035), seg=10, rings=6), 'ribbon')
    m.add(star_shape(top + V((0.14, -0.05, 0.2)), 0.045, 0.014, puff=0.25), 'glow')
    m.add(star_shape(top + V((-0.12, -0.03, 0.14)), 0.025, 0.01, puff=0.25), 'glow')


def builders(g):
    """build_env.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {'odd-tent': b_odd_tent, 'fox-shop': b_fox_shop, 'fortune-booth': b_fortune_booth, 'gift-box': b_gift_box}
