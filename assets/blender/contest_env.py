"""M18-P3 대회 — 광장 대회 무대 빌더 (BD-17, 15차 보드 wave15 D194-A)

build_env.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import contest_env; BUILDERS.update(contest_env.builders(globals()))
대회 날(9–18시)에만 광장 한쪽에 놓고 저장하지 않는다 (게임 src/gameplay/contest/stage.js, world.objects persist:false).
좌표: Blender Z-up, 정면 = -Y (손님·카메라 쪽), 1.0 = 한 칸, 원점 = 바닥 가운데.
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'prism', 'rot_xyz', 'bezier', 'P', 'TAU', 'bmesh')


def _flag(m, a, b, k, n, mat):
    """a→b 줄에 매단 삼각 깃발 하나 (k 번째 / n 개) — 얇은 삼각기둥 대신 납작한 원뿔"""
    t = (k + 0.5) / n
    p = a + (b - a) * t
    p.z -= math.sin(math.pi * t) * 0.18   # 줄이 처진 만큼
    m.add(cone(p, p + V((0, 0, -0.22)), 0.08, 0.0, squash=0.15, seg=3), mat, outline=False)


def b_contest_stage(M):
    """BD-17 대회 무대 (3×2): 나무 마루 · 앞 계단 둘 · 시상대 세 단(가운데가 가장 높음) · 뒤 기둥 둘에 걸친 현수막 ·
    둘레 삼각 깃발 줄 · 무대 앞 왼쪽 접수 탁자(종 하나). 글자는 넣지 않는다."""
    W, D, H = P.get('width', 2.9), P.get('depth', 1.7), 0.34
    m = M.part('stage')
    # 마루: 받침 상자 + 윗판 널빤지
    m.add(box((0, 0, H / 2), (W, D, H), bevel=0.03), 'woodDark')
    n = 7
    for i in range(n):
        x = -W / 2 + (i + 0.5) * W / n
        m.add(box((x, 0, H + 0.015), (W / n - 0.02, D + 0.04, 0.03), bevel=0.008), 'wood')
    m.add(box((0, -D / 2 - 0.005, H * 0.55), (W - 0.1, 0.01, 0.12), bevel=0.004), 'trim', outline=False)   # 앞 띠
    # 앞 계단 둘 (가운데)
    for k, z in enumerate((H * 0.33, H * 0.66)):
        m.add(box((0, -D / 2 - 0.27 + k * 0.13, z / 2), (0.8, 0.26 - k * 0.13, z), bevel=0.015), 'wood')
    # 시상대 세 단: 가운데 1등 (높음) · 왼쪽 2등 · 오른쪽 3등
    for x, h, mat in ((0, 0.36, 'gold'), (-0.6, 0.24, 'silver'), (0.6, 0.16, 'bronze')):
        m.add(box((x, 0.25, H + 0.03 + h / 2), (0.55, 0.5, h), bevel=0.02), 'podium')
        m.add(box((x, 0.25 - 0.251, H + 0.03 + h * 0.6), (0.2, 0.01, 0.12), bevel=0.004), mat, outline=False)   # 앞 순위 패
    # 뒤 기둥 둘 + 현수막
    pz = 2.05
    for sx in (1, -1):
        m.add(cylinder((sx * (W / 2 - 0.12), D / 2 - 0.12, H), (sx * (W / 2 - 0.12), D / 2 - 0.12, pz + 0.1), 0.05, seg=10), 'pole')
        m.add(ellipsoid((sx * (W / 2 - 0.12), D / 2 - 0.12, pz + 0.14), (0.07, 0.07, 0.07), seg=12, rings=8), 'gold')
    m.add(box((0, D / 2 - 0.12, pz - 0.18), (W - 0.45, 0.04, 0.42), bevel=0.02), 'banner')
    m.add(box((0, D / 2 - 0.145, pz - 0.18), (W - 0.75, 0.01, 0.26), bevel=0.01), 'bannerMark', outline=False)
    for k in range(5):   # 현수막 위 물결 가장자리
        x = -W / 2 + 0.35 + (W - 0.7) * (k + 0.5) / 5
        m.add(ellipsoid((x, D / 2 - 0.12, pz + 0.04), (0.14, 0.03, 0.05), seg=10, rings=6), 'trim')
    # 트로피 장식 (현수막 가운데 위)
    m.add(cylinder((0, D / 2 - 0.12, pz + 0.04), (0, D / 2 - 0.12, pz + 0.12), 0.06, 0.04, seg=12), 'gold')
    m.add(cone((0, D / 2 - 0.12, pz + 0.12), (0, D / 2 - 0.12, pz + 0.3), 0.04, 0.12, seg=16), 'gold')
    # 깃발 줄: 기둥 꼭대기에서 앞 모서리 쪽으로 둘 (좌·우)
    fl = M.part('flags')
    for sx in (1, -1):
        a = V((sx * (W / 2 - 0.12), D / 2 - 0.12, pz + 0.05))
        b = V((sx * (W / 2 - 0.05), -D / 2 + 0.05, H + 0.95))
        pts = [a + (b - a) * (k / 8) - V((0, 0, math.sin(math.pi * k / 8) * 0.18)) for k in range(9)]
        fl.add(tube(pts, [0.008] * 9, seg=5), 'pole', outline=False)
        for k in range(4):
            _flag(fl, a, b, k, 4, ('flagA', 'flagB', 'flagC', 'flagA')[k])
        fl.add(cylinder((b.x, b.y, 0), (b.x, b.y, b.z + 0.05), 0.03, seg=8), 'pole')
    # 접수 탁자 (무대 앞 왼쪽 — 게임은 이 앞에서 Space)
    t = M.part('desk')
    tx, ty = -W / 2 + 0.35, -D / 2 - 0.45
    t.add(box((tx, ty, 0.62), (0.62, 0.38, 0.05), bevel=0.012), 'wood')
    t.add(box((tx, ty - 0.17, 0.42), (0.6, 0.02, 0.34), bevel=0.008), 'banner')   # 앞 천
    for sx in (1, -1):
        for sy in (1, -1):
            t.add(cylinder((tx + sx * 0.26, ty + sy * 0.14, 0), (tx + sx * 0.26, ty + sy * 0.14, 0.6), 0.02, seg=8), 'woodDark')
    t.add(cylinder((tx + 0.15, ty, 0.645), (tx + 0.15, ty, 0.66), 0.05, seg=14), 'woodDark')   # 종 받침
    t.add(ellipsoid((tx + 0.15, ty, 0.69), (0.045, 0.045, 0.04), seg=14, rings=8), 'gold')
    t.add(box((tx - 0.12, ty, 0.655), (0.2, 0.14, 0.012), bevel=0.003), 'paper', outline=False)   # 접수 종이


def builders(g):
    """build_env.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {'contest-stage': b_contest_stage}
