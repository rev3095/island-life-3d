"""M21-P1 「친구 섬 구경」 기념 가구 빌더 (FU-109–112, 17차 보드 wave17 D287-A)

build_furniture.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import visit_furniture; BUILDERS.update(visit_furniture.builders(globals()))

가구 (assets/furniture, 아이템 furn.*, src/data/visit-items.js):
  친구 섬 액자 FU-109 (벽) · 방명록 책상 FU-110 (바닥 1×1) · 도장 깃발 FU-111 (바닥 1×1) · 작은 배 모형 FU-112 (바닥 1×1)
얻는 곳(방문 도장 수 · 선물 답례 등)은 M21-P2 가 정한다.
좌표: Blender Z-up, 정면 = -Y, 1.0 = 한 칸, 원점 = 바닥 가운데 (벽 가구는 벽면 바닥 — 등대 그림 FU-108 과 같은 자리).
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'capsule', 'tube', 'rot_xyz', 'star_shape', 'P', 'TAU')


def _wall_frame(m, cz, W, H, T=0.06, mat='frame', dark='frameDark'):
    """벽 액자 테 넷 + 걸이 끈 (story_furniture 와 같은 모양)"""
    for cx, z, sx, sz in ((0, cz + H / 2 - T / 2, W, T), (0, cz - H / 2 + T / 2, W, T), (-W / 2 + T / 2, cz, T, H), (W / 2 - T / 2, cz, T, H)):
        m.add(box((cx, -0.04, z), (sx, 0.06, sz), bevel=0.015), mat)
    nail = V((0, -0.02, cz + H / 2 + 0.12))
    for sx in (1, -1):
        m.add(tube([V((sx * W * 0.32, -0.02, cz + H / 2 - 0.02)), nail], [0.005, 0.005], seg=6), 'string', outline=False)
    m.add(ellipsoid(nail, (0.018, 0.012, 0.018), seg=10, rings=6), dark)


def b_friend_island_frame(M):
    """FU-109 친구 섬 액자 (벽): 하늘·바다 위 둥근 섬 하나 — 작은 집 · 나무 둘 · 선착장과 배 · 위에 도장 하나 (글자 없음)."""
    m = M.part('frame')
    cz, W, H = 1.5, 0.82, 0.6
    _wall_frame(m, cz, W, H)
    y = -0.03
    m.add(box((0, y, cz + 0.06), (W - 0.07, 0.01, H * 0.55), bevel=0.0), 'sky', outline=False)
    m.add(box((0, y, cz - 0.17), (W - 0.07, 0.01, H * 0.32), bevel=0.0), 'sea', outline=False)
    fy = y - 0.008
    for k in range(4):   # 물결
        m.add(box((-0.27 + k * 0.18, fy, cz - 0.2 - (k % 2) * 0.05), (0.08, 0.003, 0.012), bevel=0.0), 'wave', outline=False)
    m.add(ellipsoid((0, fy, cz - 0.1), (0.24, 0.004, 0.09), seg=20, rings=6), 'land', outline=False)
    m.add(ellipsoid((0, fy - 0.001, cz - 0.13), (0.27, 0.004, 0.04), seg=20, rings=4), 'sand', outline=False)
    # 작은 집 (가운데)
    m.add(box((0.02, fy - 0.002, cz - 0.03), (0.09, 0.003, 0.07), bevel=0.0), 'house', outline=False)
    m.add(box((0.02, fy - 0.003, cz + 0.02), (0.11, 0.003, 0.035), bevel=0.0, rot=rot_xyz(y=0.0)), 'roof', outline=False)
    # 나무 둘
    for x in (-0.13, 0.15):
        m.add(box((x, fy - 0.002, cz - 0.04), (0.012, 0.003, 0.05), bevel=0.0), 'frameDark', outline=False)
        m.add(ellipsoid((x, fy - 0.003, cz + 0.0), (0.04, 0.003, 0.045), seg=12, rings=4), 'tree', outline=False)
    # 선착장 + 작은 배 (오른쪽 아래)
    m.add(box((0.25, fy - 0.002, cz - 0.15), (0.1, 0.003, 0.012), bevel=0.0), 'frameDark', outline=False)
    m.add(ellipsoid((0.31, fy - 0.003, cz - 0.19), (0.06, 0.003, 0.02), seg=12, rings=4), 'boat', outline=False)
    m.add(box((0.31, fy - 0.004, cz - 0.165), (0.025, 0.003, 0.02), bevel=0.0), 'house', outline=False)
    # 해 · 도장 (왼쪽 위 — 둥근 도장)
    m.add(ellipsoid((0.27, fy - 0.002, cz + 0.19), (0.04, 0.003, 0.04), seg=14, rings=4), 'sun', outline=False)
    m.add(ellipsoid((-0.27, fy - 0.003, cz + 0.17), (0.06, 0.003, 0.06), seg=16, rings=4), 'stamp', outline=False)
    m.add(ellipsoid((-0.27, fy - 0.005, cz + 0.17), (0.04, 0.003, 0.04), seg=16, rings=4), 'sky', outline=False)
    m.add(star_shape(V((-0.27, fy - 0.007, cz + 0.17)), 0.025, 0.003, puff=0.1), 'stamp', outline=False)


def b_guestbook_desk(M):
    """FU-110 방명록 책상 (바닥 1×1): 작은 나무 책상 위 펼친 방명록 · 깃펜 꽂이 · 도장과 인주 · 앞 서랍 하나."""
    m = M.part('desk')
    top = 0.62
    for sx in (1, -1):
        for sy in (1, -1):
            m.add(box((sx * 0.33, sy * 0.25, top / 2 - 0.02), (0.06, 0.06, top - 0.04), bevel=0.015), 'woodDark')
    m.add(box((0, 0, top - 0.02), (0.82, 0.62, 0.05), bevel=0.02), 'wood')
    m.add(box((0, -0.2, top - 0.12), (0.7, 0.2, 0.14), bevel=0.015), 'wood')   # 서랍 상자
    m.add(box((0, -0.305, top - 0.12), (0.34, 0.012, 0.09), bevel=0.006), 'woodLight')
    m.add(ellipsoid((0, -0.315, top - 0.12), (0.025, 0.012, 0.018), seg=10, rings=5), 'brass')
    # 펼친 방명록
    bk = M.part('book')
    z = top + 0.005
    bk.add(box((-0.04, 0.02, z + 0.012), (0.46, 0.32, 0.022), bevel=0.006, rot=rot_xyz(z=0.08)), 'cover')
    for sx in (-1, 1):
        bk.add(box((-0.04 + sx * 0.108, 0.02 + sx * 0.009, z + 0.03), (0.2, 0.29, 0.014), bevel=0.004, rot=rot_xyz(y=sx * -0.05, z=0.08)), 'paper')
    for k in range(4):   # 왼쪽 쪽 글 줄 (선만)
        bk.add(box((-0.15 + k * 0.004, 0.1 - k * 0.055, z + 0.039), (0.14, 0.008, 0.003), bevel=0.0, rot=rot_xyz(z=0.08)), 'ink', outline=False)
    for x, y, mat in ((0.03, 0.08, 'stampA'), (0.11, -0.02, 'stampB')):   # 오른쪽 쪽 도장 둘
        bk.add(cylinder((x, y, z + 0.037), (x, y, z + 0.042), 0.035, seg=16), mat, outline=False)
    bk.add(tube([V((-0.04, 0.17, z + 0.04)), V((-0.03, 0.22, z + 0.0)), V((-0.02, 0.24, z - 0.06))], [0.006] * 3, seg=5), 'ribbon', outline=False)
    # 깃펜 꽂이 · 도장 · 인주 (오른쪽 뒤)
    pr = M.part('props')
    pr.add(cylinder((0.3, 0.2, top), (0.3, 0.2, top + 0.09), 0.04, 0.035, seg=14), 'brass')
    pr.add(tube([V((0.3, 0.2, top + 0.06)), V((0.33, 0.22, top + 0.2)), V((0.37, 0.24, top + 0.3))], [0.004, 0.006, 0.002], seg=6), 'quill')
    pr.add(ellipsoid((0.355, 0.235, top + 0.26), (0.03, 0.008, 0.06), rot=rot_xyz(y=-0.4), seg=10, rings=5), 'quill', outline=False)
    pr.add(cylinder((0.3, -0.02, top), (0.3, -0.02, top + 0.02), 0.05, seg=16), 'pad')
    pr.add(cylinder((0.3, -0.16, top), (0.3, -0.16, top + 0.07), 0.025, seg=12), 'stampA')
    pr.add(ellipsoid((0.3, -0.16, top + 0.09), (0.035, 0.035, 0.03), seg=12, rings=6), 'handle')


def b_stamp_flag(M):
    """FU-111 도장 깃발 (바닥 1×1): 둥근 받침에 꽂은 나무 깃대 + 삼각 깃발 두 장 (찍힌 도장 셋) + 깃대 끝 작은 별."""
    m = M.part('pole')
    m.add(cylinder((0, 0, 0), (0, 0, 0.06), 0.2, 0.18, seg=24), 'base')
    m.add(cylinder((0, 0, 0.06), (0, 0, 0.1), 0.12, 0.1, seg=20), 'baseTop')
    hp = 1.25 * P.get('height', 1)
    m.add(cylinder((0, 0, 0.1), (0, 0, hp), 0.025, 0.02, seg=12), 'pole')
    m.add(star_shape(V((0, 0, hp + 0.06)), 0.06, 0.025, puff=0.3), 'star')
    fl = M.part('flag')
    for k, (zt, ln, mat) in enumerate(((hp - 0.06, 0.48, 'flag'), (hp - 0.42, 0.36, 'flagB'))):
        h = 0.26 - k * 0.06
        # 삼각 깃발: 깃대에서 +X 로 뾰족해지는 얇은 판 조각 (띠를 겹쳐 쌓음)
        n = 6
        for i in range(n):
            t = (i + 0.5) / n
            fl.add(box((0.03 + ln * (i + 0.5) / n, 0, zt - h / 2), (ln / n + 0.002, 0.014, h * (1 - t) + 0.02), bevel=0.003), mat)
        fl.add(cylinder((0.025, 0, zt), (0.025, 0, zt - h), 0.03, seg=10), 'pole')   # 깃대 고리 띠
    for x, z, mat in ((0.12, hp - 0.18, 'stampA'), (0.24, hp - 0.16, 'stampB'), (0.12, hp - 0.53, 'stampC')):   # 찍힌 도장 (앞면)
        fl.add(cylinder((x, -0.008, z), (x, -0.014, z), 0.04, seg=16), mat, outline=False)


def b_ship_model(M):
    """FU-112 작은 배 모형 (바닥 1×1): 낮은 나무 진열대 위 받침 둘에 얹은 여객선 모형 (친구 섬 배 BD-20 을 작게) · 유리 대신 둥근 테 받침."""
    m = M.part('stand')
    m.add(box((0, 0, 0.21), (0.78, 0.42, 0.42), bevel=0.03), 'wood')
    m.add(box((0, 0, 0.44), (0.84, 0.48, 0.05), bevel=0.02), 'woodDark')
    m.add(box((0, -0.215, 0.21), (0.6, 0.012, 0.26), bevel=0.006), 'woodLight')
    m.add(box((0, -0.225, 0.08), (0.18, 0.01, 0.04), bevel=0.004), 'brass')   # 이름표 자리 (글자 없음)
    for sx in (-1, 1):   # 배 받침 둘
        m.add(box((sx * 0.18, 0, 0.5), (0.05, 0.16, 0.08), bevel=0.01), 'woodDark')
    s = M.part('ship')
    L, W, base = 0.64, 0.26, 0.6
    s.add(ellipsoid((0, 0, base), (L / 2, W / 2, 0.085), seg=24, rings=8), 'hull')
    s.add(ellipsoid((0, 0, base - 0.012), (L / 2 + 0.003, W / 2 + 0.003, 0.03), seg=24, rings=6), 'stripe', outline=False)
    s.add(ellipsoid((0, 0, base + 0.06), (L * 0.42, W * 0.38, 0.012), seg=20, rings=4), 'deck')
    s.add(box((-0.02, 0, base + 0.11), (0.26, 0.18, 0.08), bevel=0.012), 'cabin')
    for k in (-1, 0, 1):
        s.add(cylinder((-0.02 + k * 0.075, -0.09, base + 0.115), (-0.02 + k * 0.075, -0.096, base + 0.115), 0.017, seg=10), 'window', outline=False)
    s.add(box((-0.02, 0, base + 0.165), (0.3, 0.22, 0.02), bevel=0.008), 'roof')
    s.add(cylinder((-0.09, 0.04, base + 0.175), (-0.09, 0.04, base + 0.24), 0.022, 0.019, seg=12), 'funnel')
    s.add(cylinder((0.07, 0, base + 0.175), (0.07, 0, base + 0.33), 0.006, seg=6), 'woodDark')
    s.add(box((0.035, 0, base + 0.3), (0.06, 0.005, 0.04), bevel=0.002), 'flag')
    for sx in (-1, 1):
        s.add(tube([V((0.07, 0, base + 0.32)), V((sx * L * 0.44, 0, base + 0.07))], [0.002, 0.002], seg=4), 'string', outline=False)


def builders(g):
    """build_furniture.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {
        'friend-island-frame': b_friend_island_frame, 'guestbook-desk': b_guestbook_desk,
        'stamp-flag': b_stamp_flag, 'ship-model': b_ship_model,
    }
