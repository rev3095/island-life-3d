"""M18-P3 대회 — 트로피 가구 빌더 (FU-89–91, 15차 보드 wave15 D194-A)

build_furniture.py 가 BUILDERS 를 만든 뒤 한 줄로 부른다:
    import contest_furniture; BUILDERS.update(contest_furniture.builders(globals()))
builders(g) 는 build_furniture.py 의 도우미(box·cylinder·cone·ellipsoid·tube·annulus·star_shape …)를 이 모듈로 가져와 쓴다.

가구 (assets/furniture, 아이템 furn.*): 금 트로피 FU-89 · 은 트로피 FU-90 · 동 트로피 FU-91 — 모양은 하나(kind contest-trophy),
크기(params.height)·별 크기(params.star)·팔레트만 다르다. 좌표: Blender Z-up, 정면 = -Y, 1.0 = 한 칸, 원점 = 바닥 가운데.
"""
import math

HELPERS = ('V', 'box', 'cylinder', 'cone', 'ellipsoid', 'tube', 'annulus', 'star_shape', 'rot_xyz', 'bezier', 'P', 'TAU')


def b_contest_trophy(M):
    """FU-89–91 대회 트로피 (1×1): 나무 받침 두 단 · 앞에 리본 · 가는 기둥 위 손잡이 둘 달린 잔 · 잔 위 별 (금·은·동은 색과 키만 다르다)."""
    h = P.get('height', 1.0)
    star = P.get('star', 1.0)
    m = M.part('trophy')
    # 받침: 나무 두 단 + 금속 띠
    m.add(box((0, 0, 0.06), (0.4, 0.4, 0.12), bevel=0.02), 'base')
    m.add(box((0, 0, 0.17), (0.3, 0.3, 0.1), bevel=0.018), 'base')
    m.add(box((0, -0.151, 0.17), (0.2, 0.01, 0.05), bevel=0.004), 'plate')   # 앞 이름판 (글자 없음)
    # 리본: 받침 앞으로 늘어진 두 갈래
    for sx in (1, -1):
        m.add(box((sx * 0.05, -0.205, 0.08), (0.06, 0.012, 0.15), bevel=0.004, rot=rot_xyz(y=sx * 0.18)), 'ribbon')
    m.add(ellipsoid((0, -0.21, 0.17), (0.05, 0.02, 0.04), seg=12, rings=6), 'ribbon')
    # 기둥
    z0 = 0.22
    m.add(cylinder((0, 0, z0), (0, 0, z0 + 0.04), 0.09, 0.07, seg=20), 'metalDark')
    m.add(cylinder((0, 0, z0 + 0.04), (0, 0, z0 + 0.2 * h), 0.03, seg=12), 'metal')
    m.add(ellipsoid((0, 0, z0 + 0.12 * h), (0.05, 0.05, 0.03), seg=14, rings=8), 'metal')
    # 잔: 아래가 좁고 위가 넓은 그릇 + 테
    zc = z0 + 0.2 * h
    m.add(cone((0, 0, zc), (0, 0, zc + 0.08 * h), 0.04, 0.12, seg=24), 'metal')
    m.add(cylinder((0, 0, zc + 0.08 * h), (0, 0, zc + 0.26 * h), 0.12, 0.16, seg=28), 'metal')
    m.add(annulus((0, 0, zc + 0.26 * h), 0.13, 0.17, thick=0.012, seg=28), 'metalDark')
    m.add(cylinder((0, 0, zc + 0.255 * h), (0, 0, zc + 0.262 * h), 0.13, seg=24), 'metalDark', outline=False)   # 잔 속 (어둡게)
    # 손잡이 둘 (옆으로 둥근 고리)
    for sx in (1, -1):
        pts = [V((sx * (0.13 + 0.07 * math.sin(math.pi * k / 8)), 0, zc + 0.08 * h + 0.16 * h * k / 8)) for k in range(9)]
        m.add(tube(pts, [0.014] * len(pts), seg=8), 'metal')
    # 잔 앞 보석 하나
    m.add(ellipsoid((0, -0.145, zc + 0.16 * h), (0.03, 0.012, 0.03), seg=12, rings=6), 'gem')
    # 별: 잔 위 가는 대 + 별
    m.add(cylinder((0, 0, zc + 0.26 * h), (0, 0, zc + 0.33 * h), 0.012, seg=8), 'metalDark')
    m.add(star_shape((0, 0, zc + 0.33 * h + 0.07 * star), 0.09 * star, 0.035, puff=0.3), 'metal')


def builders(g):
    """build_furniture.py 의 globals 를 받아 도우미를 이 모듈에 묶고, 새 빌더 표를 돌려준다."""
    globals().update({k: g[k] for k in HELPERS if k in g})
    return {'contest-trophy': b_contest_trophy}
