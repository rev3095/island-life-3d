"""P54 밤 특별 상점 — 가구·붙박이 빌더 (FU-73–78, 결정 D165–D169)

build_furniture.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import night_special_furniture; BUILDERS.update(night_special_furniture.builders(globals()))
builders(g) 는 build_furniture.py 의 도우미(box·cylinder·ellipsoid·annulus·rail·star_shape …)를 이 모듈로 가져와 쓴다.

가구 (assets/furniture, 아이템 furn.*): 여우불 등 FU-73 · 수상한 궤짝 FU-75 · 점괘 등 FU-76 · 타로 액자 FU-78 (벽)
붙박이 (assets/furniture/fixtures, --fixtures): 미술품 받침 FU-74 · 운세 탁자 FU-77
좌표: Blender Z-up, 정면 = -Y, 1.0 = 한 칸, 원점 = 바닥 가운데 (벽 가구는 벽면 바닥). 재질 이름 = 팔레트 키, glow 는 밤에 켜짐.
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'rail', 'annulus', 'star_shape', 'rot_xyz', 'align_z', 'bezier',
           'P', 'TAU', 'bmesh', 'random')


# ---------------------------------------------------------------- FU-73 여우불 등
def b_fox_lantern(M):
    """FU-73 여우불 등 (1×1): 짧은 나무 받침대 위 여우 얼굴 종이 등. 뾰족한 귀 둘(끝 진한 색) · 붉은 볼 무늬 ·
    눈과 가운데 띠로 푸르스름한 여우불(glow)이 비친다. 등 위로 작은 여우불 한 점이 떠 있다."""
    m = M.part('stand')
    m.add(box((0, 0, 0.03), (0.42, 0.42, 0.06), bevel=0.015), 'wood')
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * 0.13, sy * 0.13, 0.22), (0.045, 0.045, 0.34), bevel=0.01), 'wood')
    m.add(box((0, 0, 0.4), (0.38, 0.38, 0.04), bevel=0.012), 'wood')
    for sx in (1, -1):   # 다리 가로대
        m.add(box((sx * 0.13, 0, 0.16), (0.03, 0.26, 0.03), bevel=0.006), 'woodDark')
        m.add(box((0, sx * 0.13, 0.16), (0.26, 0.03, 0.03), bevel=0.006), 'woodDark')
    m.add(cylinder((0, 0, 0.42), (0, 0, 0.45), 0.13, 0.12, seg=16), 'woodDark')
    L = M.part('lantern')
    c = V((0, 0, 0.64))
    rx, ry, rz = 0.2, 0.18, 0.19
    band = 0.035
    L.add(ellipsoid(c, (rx, ry, rz), seg=20, rings=12), lambda p, n: 'glow' if abs(p.z - c.z + 0.02) < band else 'shade')
    for k in range(6):   # 세로 살
        a = TAU * k / 6 + TAU / 12
        pts = [c + V((math.cos(a) * rx * math.cos(t) * 1.01, math.sin(a) * ry * math.cos(t) * 1.01, rz * math.sin(t))) for t in (math.pi * (i / 6 - 0.5) for i in range(7))]
        L.add(tube(pts, [0.005] * 7, seg=4), 'woodDark', outline=False)
    L.add(cylinder(c + V((0, 0, rz * 0.92)), c + V((0, 0, rz + 0.03)), 0.07, 0.06, seg=14), 'woodDark')
    for sx in (1, -1):   # 귀: 머리 위 양옆 뾰족한 삼각뿔 + 진한 끝
        base = c + V((sx * 0.11, 0.0, rz * 0.78))
        tip = base + V((sx * 0.05, 0.0, 0.17))
        L.add(cone(base, tip, 0.065, 0.0, squash=0.55, seg=10), 'shade')
        L.add(cone(base + (tip - base) * 0.62, tip + (tip - base) * 0.03, 0.065 * 0.4, 0.0, squash=0.55, seg=10), 'earTip')
        L.add(cone(base + V((0, -0.02, 0.01)), base + (tip - base) * 0.7 + V((0, -0.024, 0)), 0.035, 0.0, squash=0.4, seg=8), 'glow', outline=False)
    # 얼굴 (앞 = -Y): 가늘게 웃는 눈 (여우불이 비치는 틈), 볼 붉은 무늬, 작은 코
    fy = lambda x, z: c.y - ry * math.sqrt(max(0.0, 1 - (x / rx) ** 2 - ((z - c.z) / rz) ** 2)) - 0.003
    for sx in (1, -1):
        x, z = sx * 0.075, c.z + 0.055
        pts = [V((x + sx * 0.035 * t, fy(x + sx * 0.035 * t, z + 0.012 * math.sin(math.pi * (t + 1) / 2)), z + 0.012 * math.sin(math.pi * (t + 1) / 2))) for t in (-1, -0.5, 0, 0.5, 1)]
        L.add(tube(pts, [0.009] * 5, seg=6), 'glow', outline=False)
        for k in range(2):   # 볼 붉은 줄무늬 (여우 가면 무늬)
            zz = c.z - 0.025 - 0.028 * k
            xx = sx * (0.12 + 0.01 * k)
            a, b = V((xx - sx * 0.035, 0, zz)), V((xx + sx * 0.02, 0, zz + 0.012))
            a.y, b.y = fy(a.x, a.z), fy(b.x, b.z)
            L.add(tube([a, b], [0.008, 0.005], seg=6), 'mark', outline=False)
    nz = c.z - 0.01
    L.add(ellipsoid((0, fy(0, nz) + 0.004, nz), (0.022, 0.012, 0.016), seg=10, rings=6), 'earTip', outline=False)
    L.add(ellipsoid((0, fy(0, c.z + 0.12) + 0.002, c.z + 0.12), (0.016, 0.006, 0.026), seg=8, rings=5), 'mark', outline=False)   # 이마 무늬
    # 떠 있는 여우불 한 점 (물방울 모양)
    w = c + V((0.24, -0.05, 0.2))
    L.add(ellipsoid(w, (0.03, 0.03, 0.03), seg=10, rings=6), 'glow')
    L.add(cone(w + V((0, 0, 0.015)), w + V((-0.02, 0, 0.075)), 0.024, 0.0, seg=8), 'glow')


# ---------------------------------------------------------------- FU-75 수상한 궤짝
def b_odd_chest(M):
    """FU-75 수상한 궤짝 (1×1): 낡은 나무 궤짝. 덧댄 헝겊 조각과 띠, 삐뚤어진 자물쇠,
    살짝 들린 뚜껑 틈으로 별빛(glow)이 새어 나오고 작은 별 셋이 빠져나온다."""
    W, D, H = 0.72, 0.48, 0.36
    m = M.part('chest')
    m.add(box((0, 0, H / 2 + 0.03), (W, D, H), bevel=0.025), 'wood')
    for sx in (1, -1):   # 발
        for sy in (1, -1):
            m.add(box((sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), 0.02), (0.08, 0.08, 0.04), bevel=0.01), 'woodDark')
    for x in (-W / 2 + 0.03, W / 2 - 0.03):   # 모서리 쇠
        for y in (-D / 2 + 0.03, D / 2 - 0.03):
            m.add(box((x, y, H / 2 + 0.03), (0.075, 0.075, H + 0.01), bevel=0.01), 'metal')
    m.add(box((0, 0, H + 0.02), (W - 0.06, D - 0.06, 0.03), bevel=0.0), 'glow', outline=False)   # 안에서 새는 빛
    for x in (-0.18, 0.18):   # 가죽 띠 (앞·위)
        m.add(box((x, -D / 2 - 0.006, H / 2 + 0.03), (0.07, 0.014, H - 0.02), bevel=0.004), 'strap')
    m.add(box((-0.25, -D / 2 - 0.012, 0.13), (0.11, 0.008, 0.09), bevel=0.003, rot=rot_xyz(y=0.12)), 'patch')
    m.add(box((0.25, -D / 2 - 0.012, 0.26), (0.09, 0.008, 0.08), bevel=0.003, rot=rot_xyz(y=-0.2)), 'patch2')
    for k, (x, z) in enumerate(((-0.25, 0.13), (0.25, 0.26))):   # 헝겊 바늘땀
        for i in (-1, 1):
            m.add(box((x + i * 0.035, -D / 2 - 0.018, z), (0.004, 0.004, 0.05), bevel=0.0, rot=rot_xyz(y=0.12 if k == 0 else -0.2)), 'stitch', outline=False)
    # 뚜껑: 뒤 경첩을 축으로 조금 들림
    lid = M.part('lid', pivot=(0, D / 2, H + 0.03))
    hinge = V((0, D / 2, H + 0.03))
    Rl = rot_xyz(x=-0.24)
    lp = lid.bm
    n0 = len(lp.verts)
    lb = H + 0.03
    lid.add(box((0, 0, lb + 0.03), (W + 0.02, D + 0.02, 0.06), bevel=0.02), 'wood')
    def round_top(x0, x1, r, mat, z0=0.045, sq=0.42):
        cyl = cylinder((x0, 0, 0), (x1, 0, 0), r, seg=16)
        for v in cyl.verts:
            v.co.z = lb + z0 + v.co.z * sq
        lid.add(cyl, mat)
    round_top(-W / 2 - 0.005, W / 2 + 0.005, D / 2 + 0.005, 'wood')
    for x in (-0.18, 0.18):
        round_top(x - 0.035, x + 0.035, D / 2 + 0.018, 'strap')
    for x in (-W / 2 - 0.006, W / 2 + 0.006):
        round_top(x - 0.01, x + 0.01, D / 2 + 0.014, 'metal')
    for v in list(lp.verts)[n0:]:
        v.co = hinge + Rl @ (v.co - hinge)
    # 삐뚤어진 자물쇠 (앞 가운데, 뚜껑 아래)
    lk = V((0.0, -D / 2 - 0.03, H - 0.02))
    m.add(box(lk, (0.1, 0.03, 0.1), bevel=0.012, rot=rot_xyz(y=0.32)), 'metal')
    m.add(tube([lk + V((-0.03, 0, 0.04)), lk + V((-0.032, 0, 0.09)), lk + V((0.01, 0, 0.1)), lk + V((0.03, 0, 0.06))], [0.009] * 4, seg=6), 'metal')
    m.add(ellipsoid(lk + V((0.005, -0.017, -0.005)), (0.012, 0.006, 0.018), seg=8, rings=5), 'woodDark', outline=False)
    # 틈으로 새어 나오는 별
    s = M.part('stars')
    for k, (x, y, z, r) in enumerate(((-0.14, -0.33, H + 0.14, 0.045), (0.13, -0.36, H + 0.22, 0.038), (-0.02, -0.38, H + 0.3, 0.03))):
        s.add(star_shape(V((x, y, z)), r, 0.018, rot=rot_xyz(y=0.3 * k), puff=0.25), 'glow')


# ---------------------------------------------------------------- FU-76 점괘 등
def b_fortune_lamp(M):
    """FU-76 점괘 등 (1×1): 둥근 놋쇠 받침 · 가는 기둥 위 위로 편 손바닥 받침 · 손바닥 위 둥근 등.
    등은 놋쇠 위·아래 덮개 사이로 빛나는 구슬(glow)이 보이고, 덮개의 별자리 구멍에서도 빛이 샌다."""
    m = M.part('lamp')
    m.add(cylinder((0, 0, 0), (0, 0, 0.05), 0.22, 0.2, seg=24), 'brass')
    m.add(annulus((0, 0, 0.05), 0.12, 0.17, thick=0.012, seg=24), 'brassDark')
    m.add(cylinder((0, 0, 0.05), (0, 0, 0.38), 0.03, 0.025, seg=10), 'brass')
    m.add(ellipsoid((0, 0, 0.22), (0.045, 0.045, 0.035), seg=12, rings=6), 'brassDark')
    # 손바닥 (위로 편 손): 납작한 손바닥 + 손가락 넷 + 엄지
    hc = V((0, 0, 0.42))
    m.add(cone((0, 0, 0.36), hc, 0.03, 0.08, seg=12), 'hand')
    m.add(ellipsoid(hc, (0.12, 0.11, 0.035), seg=16, rings=8), 'hand')
    for k in range(4):   # 손가락 넷 (뒤쪽에서 등을 감싸 올라감)
        a = math.radians(45 + 30 * k)
        out = V((math.cos(a), math.sin(a), 0))
        root = hc + out * 0.09
        pts = [root, root + out * 0.045 + V((0, 0, 0.04)), root + out * 0.05 + V((0, 0, 0.1)), root + out * 0.035 + V((0, 0, 0.15))]
        m.add(tube(pts, [0.026, 0.024, 0.021, 0.017], seg=8), 'hand')
        m.add(ellipsoid(pts[-1], (0.017, 0.017, 0.017), seg=8, rings=5), 'hand')
    out = V((math.cos(math.radians(-50)), math.sin(math.radians(-50)), 0))   # 엄지 (앞 오른쪽)
    root = hc + out * 0.085
    m.add(tube([root, root + out * 0.05 + V((0, 0, 0.03)), root + out * 0.05 + V((0, 0, 0.09))], [0.028, 0.024, 0.019], seg=8), 'hand')
    m.add(ellipsoid(root + out * 0.05 + V((0, 0, 0.09)), (0.019, 0.019, 0.019), seg=8, rings=5), 'hand')
    # 등: 빛 구슬 + 위 놋쇠 덮개(별자리 구멍) + 아래 작은 놋쇠 컵
    C = V((0, 0, 0.6))
    R = 0.15
    m.add(ellipsoid(C, (R, R, R), seg=20, rings=12), 'glow')
    cap = ellipsoid(C, (R + 0.01, R + 0.01, R + 0.01), seg=20, rings=12)
    bmesh.ops.delete(cap, geom=[v for v in cap.verts if v.co.z - C.z < R * 0.3], context='VERTS')
    m.add(cap, 'brass')
    m.add(annulus(C + V((0, 0, R * 0.32 - 0.006)), R * 0.9, R + 0.025, thick=0.012, seg=20), 'brassDark')
    cup = ellipsoid(C, (R + 0.008, R + 0.008, R + 0.008), seg=20, rings=12)
    bmesh.ops.delete(cup, geom=[v for v in cup.verts if v.co.z - C.z > -R * 0.7], context='VERTS')
    m.add(cup, 'brass')
    rnd = random.Random(76)
    for k in range(14):   # 덮개의 별자리 구멍 (빛 점)
        a = TAU * k / 14 + rnd.uniform(-0.15, 0.15)
        el = math.radians(rnd.choice((40, 55, 70)))
        n = V((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        m.add(ellipsoid(C + n * (R + 0.011), (0.011, 0.011, 0.004), rot=align_z(n), seg=8, rings=4), 'glow', outline=False)
    m.add(cylinder(C + V((0, 0, R + 0.005)), C + V((0, 0, R + 0.05)), 0.02, 0.012, seg=10), 'brass')
    m.add(star_shape(C + V((0, 0, R + 0.1)), 0.05, 0.016, puff=0.25), 'brass')


# ---------------------------------------------------------------- FU-78 타로 액자 (벽)
def b_tarot_frame(M):
    """FU-78 타로 액자 (벽): 금빛 테 · 남색 벨벳 바탕 · 카드 셋 (해 · 달 · 별 그림). 원점 = 벽면 바닥 (액자 그림 FU-16 과 같은 자리)"""
    m = M.part('frame')
    cz, W, H, T = 1.5, 0.86, 0.58, 0.06
    for cx, z, sx, sz in ((0, cz + H / 2 - T / 2, W, T), (0, cz - H / 2 + T / 2, W, T), (-W / 2 + T / 2, cz, T, H), (W / 2 - T / 2, cz, T, H)):
        m.add(box((cx, -0.04, z), (sx, 0.06, sz), bevel=0.015), 'frame')
    for x in (-W / 2 + T / 2, W / 2 - T / 2):   # 모서리 장식 구슬
        for z in (cz - H / 2 + T / 2, cz + H / 2 - T / 2):
            m.add(ellipsoid((x, -0.075, z), (0.028, 0.012, 0.028), seg=10, rings=6), 'frameDark')
    m.add(box((0, -0.025, cz), (W - T * 1.2, 0.02, H - T * 1.2), bevel=0.003), 'velvet')
    y = -0.038
    for i, x in enumerate((-0.24, 0.0, 0.24)):
        z = cz + (0.015 if i == 1 else 0.0)
        m.add(box((x, y, z), (0.19, 0.008, 0.34), bevel=0.006, rot=rot_xyz(y=(i - 1) * -0.06)), 'cardEdge')
        m.add(box((x, y - 0.005, z), (0.16, 0.004, 0.31), bevel=0.0, rot=rot_xyz(y=(i - 1) * -0.06)), 'card', outline=False)
        fy = y - 0.009
        if i == 0:   # 해: 둥근 해 + 빛살 여덟
            m.add(ellipsoid((x, fy, z + 0.02), (0.042, 0.003, 0.042), seg=16, rings=6), 'sun', outline=False)
            for k in range(8):
                a = TAU * k / 8
                m.add(box((x + math.cos(a) * 0.062, fy, z + 0.02 + math.sin(a) * 0.062), (0.026, 0.003, 0.009), bevel=0.0, rot=rot_xyz(y=-a)), 'sun', outline=False)
        elif i == 1:   # 달: 초승달 (둥근 달 위에 카드 색 원을 비켜 겹침)
            m.add(ellipsoid((x, fy, z + 0.02), (0.055, 0.003, 0.055), seg=18, rings=6), 'moon', outline=False)
            m.add(ellipsoid((x + 0.026, fy - 0.002, z + 0.035), (0.05, 0.003, 0.05), seg=18, rings=6), 'card', outline=False)
        else:   # 별: 큰 별 하나 + 작은 별 둘
            m.add(star_shape(V((x, fy, z + 0.02)), 0.055, 0.004, puff=0.1), 'star', outline=False)
            for dx, dz in ((-0.05, 0.1), (0.05, -0.07)):
                m.add(star_shape(V((x + dx, fy, z + dz)), 0.016, 0.003, puff=0.1), 'star', outline=False)
        m.add(box((x, fy, z - 0.12), (0.11, 0.003, 0.012), bevel=0.0), 'cardMark', outline=False)   # 카드 아래 이름 칸 (글자 없음)
    nail = V((0, -0.02, cz + H / 2 + 0.14))
    for sx in (1, -1):
        m.add(cylinder((sx * 0.3, -0.03, cz + H / 2 - 0.02), nail, 0.005, seg=6), 'string')
    m.add(ellipsoid(nail, (0.014, 0.014, 0.014), seg=8, rings=6), 'string')


# ---------------------------------------------------------------- FU-74 미술품 받침 (붙박이)
def b_art_plinth(M):
    """FU-74 미술품 받침 (1×1, 높이 0.35): 낮은 네모 돌 받침 · 짙은 빨강 벨벳 윗면 · 금빛 모서리 · 앞 이름표.
    미술품 아이템은 윗면(y ≈ 0.35, Blender z)에 올린다."""
    W, H = 0.8, 0.35
    m = M.part('plinth')
    m.add(box((0, 0, 0.025), (W, W, 0.05), bevel=0.012), 'stoneDark')
    m.add(box((0, 0, 0.05 + (H - 0.1) / 2), (W - 0.06, W - 0.06, H - 0.1), bevel=0.015), 'stone')
    m.add(box((0, 0, H - 0.035), (W - 0.01, W - 0.01, 0.03), bevel=0.01), 'stoneDark')
    m.add(box((0, 0, H - 0.01), (W - 0.06, W - 0.06, 0.022), bevel=0.008), 'velvet')
    for sx in (1, -1):   # 금빛 모서리
        for sy in (1, -1):
            m.add(box((sx * (W / 2 - 0.03), sy * (W / 2 - 0.03), H - 0.03), (0.07, 0.07, 0.045), bevel=0.01), 'brass')
            m.add(box((sx * (W / 2 - 0.045), sy * (W / 2 - 0.045), 0.03), (0.06, 0.06, 0.03), bevel=0.008), 'brass')
    m.add(box((0, -W / 2 + 0.02, 0.17), (0.26, 0.012, 0.09), bevel=0.004), 'brass')    # 이름표 테
    m.add(box((0, -W / 2 + 0.013, 0.17), (0.22, 0.006, 0.065), bevel=0.0), 'plate', outline=False)
    for k in range(3):   # 이름표 글줄 (글자 아님)
        m.add(box((0, -W / 2 + 0.009, 0.19 - 0.02 * k), (0.15 - 0.03 * k, 0.003, 0.007), bevel=0.0), 'brass', outline=False)


# ---------------------------------------------------------------- FU-77 운세 탁자 (붙박이)
def b_fortune_table(M):
    """FU-77 운세 탁자 (2×2, 지름 ≈ 1.6): 바닥까지 늘어진 남색 별무늬 탁자보 · 금빛 물결 자락 ·
    위에 수정 구슬(받침 + 빛) · 엎어 둔 카드 셋 · 작은 초(flame, 깜빡임)"""
    R, H = 0.78, 0.68
    m = M.part('table')
    m.add(cylinder((0, 0, 0), (0, 0, H - 0.02), R, R * 0.93, seg=28), 'cloth')
    m.add(cylinder((0, 0, H - 0.03), (0, 0, H + 0.02), R * 0.96, R * 0.94, seg=28), 'cloth')
    n = 16
    for k in range(n):   # 늘어진 주름
        a = TAU * (k + 0.5) / n
        m.add(ellipsoid((math.cos(a) * R * 0.94, math.sin(a) * R * 0.94, H * 0.5), (0.07, 0.04, H * 0.48), rot=rot_xyz(z=a + math.pi / 2), seg=8, rings=6), 'cloth')
    m.add(annulus((0, 0, 0.0), R * 0.93, R + 0.03, thick=0.07, seg=28), 'trim')   # 아래 금빛 자락
    for k in range(n):
        a = TAU * k / n
        m.add(ellipsoid((math.cos(a) * (R + 0.01), math.sin(a) * (R + 0.01), 0.1), (0.04, 0.02, 0.03), rot=rot_xyz(z=a + math.pi / 2), seg=8, rings=5), 'trim')
    rnd = random.Random(77)
    for k in range(12):   # 탁자보의 별
        a = TAU * k / 12 + rnd.uniform(-0.1, 0.1)
        z = rnd.uniform(0.22, H - 0.12)
        r = R * (0.93 + 0.07 * (1 - z / H)) + 0.025
        p = V((math.cos(a) * r, math.sin(a) * r, z))
        rot = rot_xyz(z=a + math.pi / 2)
        m.add(star_shape(p, 0.035 + 0.015 * (k % 3 == 0), 0.01, rot=rot, puff=0.15), 'star' if k % 3 else 'glow', outline=False)
    # 위: 수정 구슬
    t = M.part('top')
    zt = H + 0.02
    t.add(cylinder((0, 0.1, zt), (0, 0.1, zt + 0.05), 0.11, 0.08, seg=18), 'brass')
    t.add(annulus((0, 0.1, zt + 0.05), 0.06, 0.1, thick=0.03, seg=18), 'brass')
    C = V((0, 0.1, zt + 0.2))
    t.add(ellipsoid(C, (0.15, 0.15, 0.15), seg=24, rings=14), 'ball')
    t.add(ellipsoid(C + V((0, 0, -0.01)), (0.07, 0.07, 0.07), seg=12, rings=8), 'glow', outline=False)
    t.add(ellipsoid(C + V((-0.06, -0.12, 0.07)), (0.03, 0.012, 0.02), rot=rot_xyz(y=0.6), seg=8, rings=5), 'shine', outline=False)
    for i, (x, rz) in enumerate(((-0.3, 0.25), (-0.12, 0.05), (0.07, -0.2))):   # 엎어 둔 카드 셋
        y = -0.38 + 0.03 * abs(i - 1)
        t.add(box((x + 0.1, y, zt + 0.005), (0.13, 0.21, 0.008), bevel=0.003, rot=rot_xyz(z=rz)), 'card')
        t.add(box((x + 0.1, y, zt + 0.01), (0.09, 0.16, 0.003), bevel=0.0, rot=rot_xyz(z=rz)), 'cardMark', outline=False)
        t.add(star_shape(V((x + 0.1, y, zt + 0.013)), 0.025, 0.003, rot=rot_xyz(x=-math.pi / 2) @ rot_xyz(y=rz), puff=0.1), 'card', outline=False)
    cx, cy = 0.4, -0.1   # 작은 초
    t.add(cylinder((cx, cy, zt), (cx, cy, zt + 0.02), 0.07, 0.06, seg=14), 'brass')
    t.add(cylinder((cx, cy, zt + 0.02), (cx, cy, zt + 0.14), 0.028, seg=12), 'wax')
    f = M.part('flame', pivot=(cx, cy, zt + 0.14))
    f.add(cone((cx, cy, zt + 0.14), (cx, cy, zt + 0.23), 0.022, 0.0, seg=10), 'flame')


def builders(g):
    """build_furniture.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {'fox-lantern': b_fox_lantern, 'odd-chest': b_odd_chest, 'fortune-lamp': b_fortune_lamp, 'tarot-frame': b_tarot_frame,
            'art-plinth': b_art_plinth, 'fortune-table': b_fortune_table}
