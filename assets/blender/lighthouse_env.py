"""M19-P4 등대 다시 켜기 — 옛 등대 BD-18 (꺼진 모습 · 고치는 중 · 켜진 모습) · 단계 소품 PR-41–44 빌더 (16차 보드 wave16 D203-A)

build_env.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import lighthouse_env; BUILDERS.update(lighthouse_env.builders(globals()))
게임은 src/gameplay/lighthouse/ 가 섬 북쪽 바위 끝(assets/lighthouse/lighthouse.json site)에 놓는다 (world.objects persist:false — 단계는 state.lighthouse 에 저장).
좌표: Blender Z-up, 정면 = -Y (남쪽 · 카메라 쪽), 1.0 = 한 칸, 원점 = 바닥 가운데.
재질 이름 = 스펙 팔레트 키 (src/core/materials.js): 'window' · 'glow' 는 밤에 켜진다 → 꺼진 등대는 'glassDark' · 'lampDark' 를 쓴다.
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'prism', 'rot_xyz', 'bezier', 'jitter', 'P', 'TAU', 'bmesh')

BASE_TOP = 0.36      # 바위 받침 윗면 높이 (탑이 서는 곳)
TOWER_TOP = 3.35     # 탑 몸통 꼭대기 (난간 바닥)
R0, R1 = 0.56, 0.4   # 탑 아래·위 반지름


def _r_at(z):
    """탑 몸통 높이 z 에서의 반지름 (아래가 넓은 원뿔대)"""
    t = max(0.0, min(1.0, (z - BASE_TOP) / (TOWER_TOP - BASE_TOP)))
    return R0 + (R1 - R0) * t


def _rock_base(M, seed=7):
    """섬 북쪽 바위 끝: 넓적한 바위 받침 + 둘레 바위 몇 개 (뒤쪽이 더 높아 바다 쪽 끝처럼)"""
    r = M.part('rock')
    r.add(jitter(ellipsoid((0, 0.08, 0.14), (1.12, 1.0, 0.3), seg=14, rings=8), 0.05, seed, keep_bottom=0.0), 'rock', smooth=False)
    for k, (x, y, s) in enumerate(((0.85, 0.55, 0.42), (-0.9, 0.5, 0.36), (0.25, 0.95, 0.4), (-0.4, 0.9, 0.3), (1.05, -0.2, 0.24), (-1.05, -0.1, 0.22))):
        r.add(jitter(ellipsoid((x, y, s * 0.55), (s, s * 0.85, s * 0.75), seg=10, rings=7), 0.03, seed + k + 1, keep_bottom=0.0), 'rock', smooth=False)
    for x, y in ((0.55, -0.55), (-0.62, -0.4), (0.1, 0.7)):
        r.add(ellipsoid((x, y, 0.4), (0.14, 0.1, 0.02), seg=10, rings=5), 'rockDark', outline=False)
    # 탑 받침 둥근 돌단
    r.add(cylinder((0, 0, BASE_TOP - 0.12), (0, 0, BASE_TOP + 0.02), R0 + 0.16, R0 + 0.12, seg=24), 'stone')


def _tower(M, look):
    """탑 몸통 · 띠 · 문 · 창 · 난간 · 등실 · 지붕. look = 0 꺼짐(낡음) · 1 고치는 중 · 2 켜짐"""
    t = M.part('tower')
    seg = 24
    # 몸통: 고치는 중이면 아래 반은 새 칠, 위 반은 옛 칠
    if look == 1:
        mid = BASE_TOP + (TOWER_TOP - BASE_TOP) * 0.5
        t.add(cylinder((0, 0, BASE_TOP), (0, 0, mid), R0, _r_at(mid), seg=seg), 'paint')
        t.add(cylinder((0, 0, mid), (0, 0, TOWER_TOP), _r_at(mid), R1, seg=seg), 'paintOld')
    else:
        t.add(cylinder((0, 0, BASE_TOP), (0, 0, TOWER_TOP), R0, R1, seg=seg), 'paint')
    # 빨간 띠 둘 (꺼진 등대는 바랜 색 — 팔레트가 다름)
    for z0, z1 in ((1.15, 1.6), (2.3, 2.75)):
        t.add(cylinder((0, 0, z0), (0, 0, z1), _r_at(z0) + 0.012, _r_at(z1) + 0.012, seg=seg), 'band')
    # 문 (앞 = -Y): 문틀 + 문짝 (꺼짐 = 판자로 막음 · 고치는 중 = 열려 어두운 안 · 켜짐 = 새 문)
    dy = -_r_at(0.8) - 0.01
    t.add(box((0, dy, BASE_TOP + 0.46), (0.5, 0.08, 0.92), bevel=0.03), 'trim')
    if look == 1:
        t.add(box((0, dy - 0.03, BASE_TOP + 0.43), (0.38, 0.04, 0.8), bevel=0.02), 'doorDark', outline=False)
    else:
        t.add(box((0, dy - 0.03, BASE_TOP + 0.43), (0.38, 0.04, 0.8), bevel=0.02), 'door')
        t.add(ellipsoid((0.12, dy - 0.06, BASE_TOP + 0.45), (0.025, 0.02, 0.025), seg=8, rings=6), 'trim')
    if look == 0:   # 문을 가로지른 판자 둘
        for z, a in ((BASE_TOP + 0.3, 0.35), (BASE_TOP + 0.62, -0.3)):
            t.add(box((0, dy - 0.07, z), (0.56, 0.035, 0.09), bevel=0.01, rot=rot_xyz(y=a)), 'plank')
    # 작은 창 둘 (앞)
    glass = 'glassDark' if look == 0 else 'window'
    for z in (1.85, 3.0):
        y = -_r_at(z) - 0.005
        t.add(box((0, y, z), (0.24, 0.06, 0.3), bevel=0.02), 'trim')
        t.add(box((0, y - 0.02, z), (0.17, 0.03, 0.22), bevel=0.01), glass, outline=False)
    # 난간 바닥 + 기둥 + 둥근 손잡이 줄
    g = M.part('gallery')
    g.add(cylinder((0, 0, TOWER_TOP - 0.06), (0, 0, TOWER_TOP + 0.06), R1 + 0.24, R1 + 0.26, seg=seg), 'trim')
    n = 14
    pts = []
    for k in range(n + 1):
        a = TAU * k / n
        x, y = math.cos(a) * (R1 + 0.22), math.sin(a) * (R1 + 0.22)
        pts.append(V((x, y, TOWER_TOP + 0.36)))
        if k < n and not (look == 0 and k in (3, 4)):   # 꺼진 등대는 난간 기둥 둘이 빠짐
            g.add(cylinder((x, y, TOWER_TOP + 0.06), (x, y, TOWER_TOP + 0.36), 0.016, seg=6), 'rail', outline=False)
    g.add(tube(pts, [0.022] * len(pts), seg=6), 'rail')
    # 등실: 유리 원통 + 세로 창살 + 위아래 테
    L = M.part('lantern')
    lz0, lz1 = TOWER_TOP + 0.06, TOWER_TOP + 0.78
    lr = 0.33
    L.add(cylinder((0, 0, lz0), (0, 0, lz0 + 0.1), lr + 0.03, seg=20), 'trim')
    L.add(cylinder((0, 0, lz0 + 0.1), (0, 0, lz1 - 0.05), lr, seg=20), {0: 'glassDark', 1: 'glassClean', 2: 'window'}[look], outline=False)
    for k in range(8):
        a = TAU * k / 8 + 0.2
        x, y = math.cos(a) * (lr + 0.01), math.sin(a) * (lr + 0.01)
        L.add(cylinder((x, y, lz0 + 0.1), (x, y, lz1 - 0.05), 0.018, seg=6), 'rail', outline=False)
    L.add(cylinder((0, 0, lz1 - 0.06), (0, 0, lz1), lr + 0.04, seg=20), 'trim')
    # 등불: 꺼짐 = 빈 받침 · 고치는 중 = 아직 안 켠 등 · 켜짐 = 빛나는 별 조각 등 (glow — 밤에 켜짐)
    L.add(cylinder((0, 0, lz0 + 0.1), (0, 0, lz0 + 0.2), 0.12, 0.09, seg=12), 'rail')
    if look >= 1:
        lamp = 'glow' if look == 2 else 'lampDark'
        L.add(ellipsoid((0, 0, lz0 + 0.38), (0.17, 0.17, 0.19), seg=16, rings=10), lamp, outline=False)
        if look == 2:   # 별 조각 다섯이 등 둘레에
            for k in range(5):
                a = TAU * k / 5
                L.add(cone((math.cos(a) * 0.16, math.sin(a) * 0.16, lz0 + 0.38), (math.cos(a) * 0.27, math.sin(a) * 0.27, lz0 + 0.4), 0.05, 0.0, seg=4), 'glow', outline=False)
    # 지붕: 둥근 갓 + 꼭지 구슬 + 바람개비 막대
    roof = M.part('roof')
    roof.add(cone((0, 0, lz1 - 0.01), (0, 0, lz1 + 0.42), lr + 0.12, 0.05, seg=20), 'roof')
    roof.add(ellipsoid((0, 0, lz1 + 0.46), (0.07, 0.07, 0.07), seg=12, rings=8), 'trim')
    roof.add(cylinder((0, 0, lz1 + 0.5), (0, 0, lz1 + 0.68), 0.012, seg=6), 'rail', outline=False)
    roof.add(cone((0, 0, lz1 + 0.62), (0.16, 0, lz1 + 0.64), 0.04, 0.0, squash=0.2, seg=3), 'band', outline=False)
    if look == 0:   # 낡은 등대: 담쟁이 · 금 · 깨진 유리 조각
        iv = M.part('ivy')
        for k, (a, z, s) in enumerate(((-1.9, 0.75, 0.22), (-2.3, 1.2, 0.16), (-1.2, 0.55, 0.18), (2.2, 0.9, 0.2), (2.6, 1.4, 0.13), (-2.0, 2.0, 0.12))):
            r = _r_at(z) + 0.02
            iv.add(ellipsoid((math.cos(a) * r, math.sin(a) * r, z), (s, s * 0.45, s * 0.9), rot=rot_xyz(z=a + math.pi / 2), seg=10, rings=6), 'ivy', outline=False)
        for a, z0, z1 in ((-1.25, 1.95, 2.25), (-1.9, 2.6, 2.95), (-0.9, 0.9, 1.1)):
            r = _r_at(z0) + 0.006
            iv.add(box((math.cos(a) * r, math.sin(a) * r, (z0 + z1) / 2), (0.02, 0.015, z1 - z0), bevel=0.003, rot=rot_xyz(z=a, y=0.25)), 'crack', outline=False)
    if look == 1:   # 고치는 중: 탑에 걸친 밧줄 + 페인트 통
        rp = M.part('repair')
        pts = [V((math.cos(a) * (_r_at(2.0) + 0.02), math.sin(a) * (_r_at(2.0) + 0.02), 2.0 + 0.06 * math.sin(a * 2))) for a in [TAU * k / 16 for k in range(17)]]
        rp.add(tube(pts, [0.014] * len(pts), seg=5), 'rope', outline=False)
        rp.add(cylinder((-0.55, -0.62, BASE_TOP - 0.02), (-0.55, -0.62, BASE_TOP + 0.2), 0.1, seg=12), 'paint')
        rp.add(cylinder((-0.55, -0.62, BASE_TOP + 0.18), (-0.55, -0.62, BASE_TOP + 0.21), 0.085, seg=12), 'band', outline=False)


def _lighthouse(M, look):
    _rock_base(M)
    _tower(M, look)


def b_lighthouse(M):
    """BD-18 옛 등대 — params.look 0 꺼진 모습 · 1 고치는 중 · 2 켜진 모습 (스펙 셋이 같은 빌더)"""
    _lighthouse(M, int(P.get('look', 0)))


def b_lighthouse_scaffold(M):
    """PR-41 비계: 나무 기둥 넷 · 발판 셋 · 엇갈린 버팀대 · 밧줄 매듭 (등대 동쪽 옆, 고치는 동안만)"""
    s = M.part('scaffold')
    W, D, H = 0.78, 0.62, 3.0
    for sx in (1, -1):
        for sy in (1, -1):
            s.add(cylinder((sx * W / 2, sy * D / 2, 0), (sx * W / 2, sy * D / 2, H), 0.035, seg=8), 'pole')
    for z in (0.95, 1.95, 2.85):
        s.add(box((0, 0, z), (W + 0.12, D + 0.04, 0.05), bevel=0.01), 'plank')
        for sy in (1, -1):
            s.add(box((0, sy * D / 2, z + 0.32), (W, 0.03, 0.03), bevel=0.005), 'pole', outline=False)   # 난간 막대
    for sy in (1, -1):   # 옆 엇갈린 버팀대
        for z0, z1 in ((0.1, 0.95), (0.95, 1.95)):
            s.add(tube([V((-W / 2, sy * D / 2, z0)), V((W / 2, sy * D / 2, z1))], [0.018, 0.018], seg=5), 'pole', outline=False)
    for z in (0.95, 1.95):   # 밧줄 매듭
        s.add(ellipsoid((W / 2, -D / 2, z), (0.05, 0.05, 0.04), seg=8, rings=6), 'rope', outline=False)
    s.add(box((0, 0, 0.03), (W + 0.2, D + 0.2, 0.06), bevel=0.01), 'plank')   # 바닥 받침
    # 사다리 (앞면)
    for sx in (1, -1):
        s.add(cylinder((sx * 0.14, -D / 2 - 0.05, 0), (sx * 0.14, -D / 2 - 0.05, 2.0), 0.018, seg=6), 'pole', outline=False)
    for k in range(7):
        z = 0.25 + k * 0.27
        s.add(cylinder((-0.14, -D / 2 - 0.05, z), (0.14, -D / 2 - 0.05, z), 0.012, seg=5), 'pole', outline=False)


def b_lighthouse_stairs(M):
    """PR-42 새 계단: 바위 받침을 올라 문으로 가는 돌계단 셋 + 나무 손잡이 (앞 = -Y 가 아래 단)"""
    s = M.part('stairs')
    for k in range(3):
        h = 0.12 * (k + 1)
        y = -0.3 + k * 0.24
        s.add(box((0, y, h / 2), (0.72, 0.3, h), bevel=0.025), 'stone')
        s.add(box((0, y - 0.13, h - 0.01), (0.74, 0.05, 0.02), bevel=0.005), 'stoneEdge', outline=False)
    for sx in (1, -1):
        x = sx * 0.42
        for y, z in ((-0.4, 0.0), (0.38, 0.36)):
            s.add(cylinder((x, y, z), (x, y, z + 0.52), 0.025, seg=8), 'wood')
        s.add(tube([V((x, -0.4, 0.5)), V((x, 0.38, 0.86))], [0.022, 0.022], seg=6), 'wood')


def b_lighthouse_lens(M):
    """PR-43 렌즈: 나무 받침대 위 겹겹 고리 렌즈(프레넬 렌즈 느낌) + 놋쇠 테 (닦는 동안 등대 앞 서쪽)"""
    s = M.part('stand')
    for sx in (1, -1):
        for sy in (1, -1):
            s.add(cylinder((sx * 0.2, sy * 0.15, 0), (sx * 0.17, sy * 0.12, 0.42), 0.025, seg=8), 'wood')
    s.add(box((0, 0, 0.44), (0.5, 0.4, 0.05), bevel=0.01), 'wood')
    s.add(box((0.17, -0.12, 0.48), (0.14, 0.1, 0.03), bevel=0.005), 'cloth', outline=False)   # 닦는 천
    L = M.part('lens')
    cz = 0.78
    L.add(cylinder((0, 0.02, cz), (0, -0.02, cz), 0.3, seg=28), 'brass')
    for k, r in enumerate((0.27, 0.21, 0.15, 0.09)):
        y = -0.02 - k * 0.025
        L.add(cylinder((0, y + 0.02, cz), (0, y, cz), r, r - 0.02, seg=28), 'lens', outline=False)
    L.add(ellipsoid((0, -0.13, cz), (0.07, 0.04, 0.07), seg=12, rings=8), 'lens', outline=False)
    L.add(cylinder((0, 0, 0.46), (0, 0, cz - 0.28), 0.03, seg=8), 'brass')
    L.add(ellipsoid((0.1, -0.12, cz + 0.12), (0.04, 0.01, 0.025), seg=8, rings=5), 'shine', outline=False)


def b_star_lantern(M):
    """PR-44 별 조각 등불: 쇠 등 틀(받침·기둥 넷·뾰족 지붕·고리) 안에 별 조각 덩이 (glow — 밤에 빛남)"""
    f = M.part('frame')
    f.add(cylinder((0, 0, 0), (0, 0, 0.08), 0.2, 0.18, seg=16), 'iron')
    for k in range(4):
        a = TAU * k / 4 + TAU / 8
        x, y = math.cos(a) * 0.15, math.sin(a) * 0.15
        f.add(cylinder((x, y, 0.08), (x, y, 0.46), 0.016, seg=6), 'iron', outline=False)
    f.add(cylinder((0, 0, 0.45), (0, 0, 0.49), 0.19, seg=16), 'iron')
    f.add(cone((0, 0, 0.49), (0, 0, 0.66), 0.19, 0.02, seg=4), 'iron')
    f.add(tube([V((0, 0, 0.66)), V((0, 0.05, 0.74)), V((0, 0, 0.8)), V((0, -0.05, 0.74)), V((0, 0, 0.66))], [0.012] * 5, seg=5), 'iron', outline=False)
    f.add(cylinder((0, 0, 0.09), (0, 0, 0.45), 0.145, seg=16), 'pane', outline=False)
    s = M.part('stars')
    s.add(ellipsoid((0, 0, 0.26), (0.08, 0.08, 0.08), seg=12, rings=8), 'glow', outline=False)
    for k in range(5):
        a = TAU * k / 5
        s.add(cone((math.cos(a) * 0.06, math.sin(a) * 0.06, 0.26), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.27), 0.035, 0.0, seg=4), 'glow', outline=False)
    for x, y, z in ((0.07, -0.04, 0.13), (-0.06, 0.05, 0.14), (0.0, 0.07, 0.36)):
        s.add(ellipsoid((x, y, z), (0.03, 0.03, 0.03), seg=8, rings=6), 'starPink', outline=False)


def builders(g):
    """build_env.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {
        'lighthouse': b_lighthouse,
        'lighthouse-scaffold': b_lighthouse_scaffold,
        'lighthouse-stairs': b_lighthouse_stairs,
        'lighthouse-lens': b_lighthouse_lens,
        'star-lantern': b_star_lantern,
    }
