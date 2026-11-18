"""M21-P1 「친구 섬 구경」 배경 빌더 (17차 보드 wave17 D280-A · D287-A) — 친구 섬 배 BD-20 · 방명록 받침 PR-45 · 방문 도장 판 PR-46.

build_env.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import visit_env; BUILDERS.update(visit_env.builders(globals()))
놓는 자리·구경 놀이는 M21-P2 (src/gameplay/visit/ 쪽) 가 정한다. 배는 동쪽 선착장(어선 부두 BD-19 옆)에 매어 둔다.
좌표: Blender Z-up, +X = 뱃머리(게임 동쪽, 바다 쪽), -Y = 남쪽(카메라 쪽), 1.0 = 한 칸.
배 원점 = 물 위 기준 (어선 BD-19-2 와 같게 갑판 높이 DECK 0.18). 받침·도장 판 원점 = 바닥 가운데, 정면 -Y.
재질 이름 = 스펙 팔레트 키. 'glow' 는 밤에 켜진다.
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'prism', 'rot_xyz', 'P', 'TAU')


def _ring(c, r, t, n=16, axis='y'):
    """세운 고리 (구명 튜브 · 밧줄 고리): axis 'y' = 고리면이 XZ (정면에서 보임)"""
    if axis == 'y':
        pts = [V(c) + V((math.cos(a) * r, 0, math.sin(a) * r)) for a in (TAU * i / n for i in range(n))]
    else:
        pts = [V(c) + V((math.cos(a) * r, math.sin(a) * r, 0)) for a in (TAU * i / n for i in range(n))]
    return tube(pts, [t] * n, seg=8, closed=True)


def b_visit_boat(M):
    """BD-20 친구 섬 배: 작은 여객선. 통통한 배 몸 + 가운데 지붕 덮인 객실(긴 의자 둘 · 둥근 창) + 위 갑판 난간 + 작은 굴뚝·깃발
    + 옆구리 구명 튜브. 여행 배 BD-10 · 어선 BD-19 와 같은 툰 키트·크기 (길이 ≈ 2.7칸)."""
    L, W = 2.7 * P.get('length', 1), 1.2 * P.get('width', 1)
    DECK = 0.18
    zc = -0.1
    hull = M.part('hull')
    hull.add(ellipsoid((0, 0, zc), (L / 2, W / 2, 0.32), seg=24, rings=10), 'hull')
    hull.add(ellipsoid((0, 0, zc - 0.05), (L / 2 + 0.01, W / 2 + 0.01, 0.1), seg=24, rings=8), 'stripe', outline=False)
    hull.add(ellipsoid((0, 0, zc + 0.09), (L / 2 - 0.02, W / 2 - 0.01, 0.035), seg=24, rings=6), 'stripeB', outline=False)
    hull.add(ellipsoid((0, 0, DECK - 0.02), (L * 0.44, W * 0.4, 0.04), seg=24, rings=6), 'deck')
    rail = [V((math.cos(a) * L * 0.47, math.sin(a) * W * 0.46, DECK + 0.08)) for a in (TAU * i / 28 for i in range(28))]
    hull.add(tube(rail, [0.045] * 28, seg=8, closed=True), 'hullDark')
    hull.add(box((L * 0.37, -W * 0.45, DECK - 0.03), (0.3, 0.03, 0.1), bevel=0.01), 'trim')   # 뱃머리 이름판 (글자 없음)
    for sx in (-1, 1):   # 옆구리 구명 튜브 (남쪽 면)
        c = (sx * L * 0.27, -W * 0.5, DECK - 0.06)
        hull.add(_ring(c, 0.1, 0.035), 'buoy')
        for k in range(4):
            a = TAU * k / 4 + TAU / 8
            hull.add(box((c[0] + math.cos(a) * 0.1, c[1] - 0.005, c[2] + math.sin(a) * 0.1), (0.04, 0.075, 0.04), bevel=0.008), 'stripe', outline=False)
    # 객실 (가운데): 낮은 벽 + 둥근 창 + 기둥 넷 + 지붕
    cab = M.part('cabin')
    cx, cl, cw, wh = -L * 0.04, 1.05, 0.82, 0.3
    cab.add(box((cx, 0, DECK + wh / 2), (cl, cw, wh), bevel=0.03), 'cabin')
    for sy in (-1, 1):
        for k in (-1, 0, 1):
            cab.add(cylinder((cx + k * 0.3, sy * (cw / 2 + 0.005), DECK + 0.17), (cx + k * 0.3, sy * (cw / 2 + 0.03), DECK + 0.17), 0.065, seg=14), 'window', outline=False)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p = V((cx + sx * (cl / 2 - 0.05), sy * (cw / 2 - 0.05), DECK + wh))
            cab.add(cylinder(p, p + V((0, 0, 0.38)), 0.03, seg=10), 'post')
    roofZ = DECK + wh + 0.38
    cab.add(box((cx, 0, roofZ + 0.03), (cl + 0.16, cw + 0.16, 0.06), bevel=0.025), 'roof')
    for k in range(6):   # 지붕 끝 물결 장식 (차양)
        x = cx - (cl + 0.1) / 2 + (k + 0.5) * (cl + 0.1) / 6
        cab.add(ellipsoid((x, -(cw + 0.16) / 2, roofZ - 0.01), (0.09, 0.02, 0.05), seg=10, rings=5), 'roofB' if k % 2 else 'roof', outline=False)
    # 객실 안 긴 의자 둘 (벽 위로 등받이가 보임)
    for sy in (-1, 1):
        cab.add(box((cx, sy * 0.24, DECK + wh + 0.04), (cl - 0.2, 0.14, 0.05), bevel=0.015), 'seat')
        cab.add(box((cx, sy * 0.32, DECK + wh + 0.12), (cl - 0.2, 0.03, 0.14), bevel=0.01), 'seat')
    # 위 갑판: 굴뚝 · 깃발 · 등
    top = M.part('top')
    top.add(cylinder((cx - 0.28, 0.12, roofZ + 0.06), (cx - 0.28, 0.12, roofZ + 0.3), 0.08, 0.07, seg=14), 'funnel')
    top.add(cylinder((cx - 0.28, 0.12, roofZ + 0.24), (cx - 0.28, 0.12, roofZ + 0.3), 0.085, seg=14), 'stripe', outline=False)
    mast = (cx + 0.32, 0, roofZ + 0.06)
    hmast = 0.62 * P.get('mastHeight', 1)
    top.add(cylinder(mast, (mast[0], 0, mast[2] + hmast), 0.022, 0.018, seg=8), 'hullDark')
    top.add(box((mast[0] - 0.12, 0, mast[2] + hmast - 0.09), (0.22, 0.015, 0.13), bevel=0.004), 'flag')
    top.add(ellipsoid((mast[0] - 0.12, -0.009, mast[2] + hmast - 0.09), (0.035, 0.004, 0.035), seg=10, rings=4), 'flagMark', outline=False)   # 깃발 하트 자리 (둥근 무늬)
    top.add(ellipsoid((mast[0], 0, mast[2] + hmast + 0.03), (0.04, 0.04, 0.04), seg=10, rings=6), 'glow', outline=False)
    # 깃줄 (돛대 → 뱃머리 · 고물)
    top.add(tube([V((mast[0], 0, mast[2] + hmast - 0.05)), V((L * 0.43, 0, DECK + 0.14))], [0.008, 0.008], seg=5), 'rope', outline=False)
    top.add(tube([V((mast[0], 0, mast[2] + hmast - 0.05)), V((-L * 0.43, 0, DECK + 0.14))], [0.008, 0.008], seg=5), 'rope', outline=False)
    # 뱃머리 계류 기둥 · 고물 작은 사다리
    aft = M.part('aft')
    aft.add(cylinder((L * 0.38, 0.12, DECK), (L * 0.38, 0.12, DECK + 0.14), 0.04, seg=10), 'hullDark')
    for k in range(3):
        aft.add(box((-L * 0.44, -0.0, DECK - 0.02 - k * 0.1), (0.04, 0.24, 0.025), bevel=0.006), 'trim')


def b_guestbook_stand(M):
    """PR-45 방명록 받침: 우편함 옆에 두는 나무 받침 (기둥 + 비스듬한 판) 위 펼친 도장 책 · 옆에 도장 하나와 인주 · 작은 지붕."""
    h = 0.78 * P.get('height', 1)
    m = M.part('stand')
    m.add(box((0, 0, 0.03), (0.42, 0.32, 0.06), bevel=0.02), 'woodDark')   # 발판
    m.add(box((0, 0, h / 2), (0.1, 0.1, h), bevel=0.02), 'wood')
    tilt = rot_xyz(x=0.42)
    m.add(box((0, 0, h + 0.03), (0.52, 0.36, 0.05), bevel=0.015, rot=tilt), 'wood')
    m.add(box((0, -0.19, h - 0.04), (0.5, 0.03, 0.035), bevel=0.008), 'woodDark')   # 책 받침 턱
    # 펼친 도장 책
    bk = M.part('book')
    for sx in (-1, 1):
        bk.add(box((sx * 0.105, 0, h + 0.07), (0.2, 0.27, 0.02), bevel=0.004, rot=rot_xyz(x=0.42, y=sx * -0.08)), 'paper')
    bk.add(box((0, 0, h + 0.058), (0.44, 0.29, 0.02), bevel=0.006, rot=tilt), 'cover')
    for i, (x, y, mat) in enumerate(((-0.15, 0.06, 'stampA'), (-0.07, -0.04, 'stampB'), (0.09, 0.07, 'stampC'))):   # 찍힌 도장 셋 (오른쪽은 빈칸)
        z = h + 0.083 + y * math.sin(0.42)
        bk.add(cylinder((x, y * math.cos(0.42) - 0.004, z), (x, y * math.cos(0.42) - 0.004 - 0.004, z + 0.01), 0.032, seg=14), mat, outline=False)
    bk.add(tube([V((0.0, 0.1, h + 0.13)), V((0.01, -0.02, h + 0.05)), V((0.02, -0.17, h - 0.04))], [0.006] * 3, seg=5), 'ribbon', outline=False)   # 책갈피 끈
    # 도장 · 인주 (받침 턱 옆 작은 선반)
    sh = M.part('stamp')
    sh.add(box((0.3, -0.02, h - 0.12), (0.16, 0.18, 0.03), bevel=0.008), 'woodDark')
    sh.add(cylinder((0.3, -0.06, h - 0.105), (0.3, -0.06, h - 0.085), 0.045, seg=16), 'ink')
    sh.add(cylinder((0.3, 0.04, h - 0.105), (0.3, 0.04, h - 0.04), 0.022, seg=12), 'stampA')
    sh.add(ellipsoid((0.3, 0.04, h - 0.025), (0.03, 0.03, 0.03), seg=12, rings=6), 'handle')
    # 작은 지붕 (비 가림) 기둥 뒤로
    rf = M.part('roof')
    rf.add(box((0, 0.17, h + 0.22), (0.05, 0.05, 0.44), bevel=0.012), 'wood')
    rf.add(prism((0, 0.02, h + 0.46), 0.62, 0.42, 0.13, overhang=0.04, ridge='x'), 'roof')


def b_stamp_board(M):
    """PR-46 방문 도장 판: 기둥 둘에 걸친 나무 판 · 위 리본 띠 · 도장 자리 3×4 (몇 개는 찍힘, 색 넷) · 끈에 매단 큰 도장 하나."""
    Wd, Hb = 1.1 * P.get('width', 1), 0.72
    zc = 0.95
    m = M.part('board')
    for sx in (-1, 1):
        x = sx * (Wd / 2 - 0.04)
        m.add(box((x, 0.04, (zc + Hb / 2 + 0.1) / 2), (0.08, 0.08, zc + Hb / 2 + 0.1), bevel=0.02), 'woodDark')
        m.add(ellipsoid((x, 0.04, zc + Hb / 2 + 0.12), (0.06, 0.06, 0.05), seg=12, rings=6), 'woodDark')
    m.add(box((0, 0, zc), (Wd - 0.1, 0.06, Hb), bevel=0.02), 'wood')
    m.add(box((0, -0.03, zc), (Wd - 0.18, 0.02, Hb - 0.1), bevel=0.006), 'paper')
    m.add(box((0, -0.045, zc + Hb / 2 - 0.02), (Wd - 0.04, 0.025, 0.1), bevel=0.012), 'ribbon')   # 위 띠 (글자 없음)
    for sx in (-1, 1):
        m.add(box((sx * (Wd / 2 + 0.02), -0.045, zc + Hb / 2 - 0.08), (0.08, 0.02, 0.12), bevel=0.006, rot=rot_xyz(y=sx * 0.35)), 'ribbon')   # 띠 끝 꼬리
    # 도장 자리 3줄 × 4칸
    st = M.part('stamps')
    cols, rows = 4, 3
    stamped = {(0, 0): 'stampA', (1, 0): 'stampB', (2, 0): 'stampC', (0, 1): 'stampD', (1, 1): 'stampA', (3, 0): 'stampD'}
    for r in range(rows):
        for c in range(cols):
            x = (c - (cols - 1) / 2) * (Wd - 0.34) / (cols - 1)
            z = zc + 0.17 - r * 0.17
            st.add(cylinder((x, -0.04, z), (x, -0.048, z), 0.065, seg=18), 'slot', outline=False)
            mat = stamped.get((c, r))
            if mat:
                st.add(cylinder((x, -0.046, z), (x, -0.052, z), 0.052, seg=18), mat, outline=False)
                st.add(cylinder((x, -0.05, z), (x, -0.055, z), 0.022, seg=12), 'paper', outline=False)
    # 끈에 매단 큰 도장 (오른쪽 기둥)
    hg = M.part('hang')
    px = Wd / 2 - 0.04
    hg.add(tube([V((px, -0.02, zc + 0.2)), V((px + 0.08, -0.06, zc - 0.05))], [0.006, 0.006], seg=5), 'rope', outline=False)
    hg.add(cylinder((px + 0.08, -0.06, zc - 0.2), (px + 0.08, -0.06, zc - 0.08), 0.03, seg=12), 'stampB')
    hg.add(ellipsoid((px + 0.08, -0.06, zc - 0.06), (0.04, 0.04, 0.035), seg=12, rings=6), 'handle')
    # 받침 앞 작은 화분 둘 (발치)
    for sx in (-1, 1):
        p = (sx * (Wd / 2 - 0.04), -0.12, 0.07)
        hg.add(cylinder((p[0], p[1], 0), (p[0], p[1], 0.12), 0.07, 0.06, seg=12), 'pot')
        hg.add(ellipsoid((p[0], p[1], 0.15), (0.08, 0.08, 0.06), seg=12, rings=6), 'leaf')


def builders(g):
    """build_env.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {'visit-boat': b_visit_boat, 'guestbook-stand': b_guestbook_stand, 'stamp-board': b_stamp_board}
